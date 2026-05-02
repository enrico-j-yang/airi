import type { Object3D } from 'three'

import type { SceneBootstrap, Vec3 } from '../stores/model-store'

import JSZip from 'jszip'

import { Box3, LoadingManager, Vector3 } from 'three'
import { MMDLoader } from 'three-stdlib'

import { analyzeMmdArchive, resolveMmdArchivePath } from './mmd-archive'

const WINDOWS_PATH_SEPARATOR_PATTERN = /\\/g
const MMD_MODEL_FILE_PATTERN = /\.(?:pmx|pmd)$/i

function toVec3(value: Vector3): Vec3 {
  return { x: value.x, y: value.y, z: value.z }
}

function normalizeArchiveReference(path: string) {
  const resolvedSegments: string[] = []

  for (const segment of path.replace(WINDOWS_PATH_SEPARATOR_PATTERN, '/').split('/')) {
    if (!segment || segment === '.') {
      continue
    }

    if (segment === '..') {
      resolvedSegments.pop()
      continue
    }

    resolvedSegments.push(segment)
  }

  return resolvedSegments.join('/')
}

function dirname(path: string) {
  const segments = normalizeArchiveReference(path).split('/').filter(Boolean)
  segments.pop()
  return segments.length > 0 ? `${segments.join('/')}/` : ''
}

export function buildMmdSceneBootstrap(root: Object3D, cameraFov: number, eyeHeight: number, cameraAspect = 1): SceneBootstrap {
  const box = new Box3().setFromObject(root)
  const modelSize = new Vector3()
  const modelCenter = new Vector3()
  box.getSize(modelSize)
  box.getCenter(modelCenter)
  modelCenter.y += modelSize.y / 8

  const verticalFovRadians = (cameraFov / 2 * Math.PI) / 180
  const horizontalFovRadians = Math.atan(Math.tan(verticalFovRadians) * Math.max(cameraAspect, 1e-3))
  const requiredVerticalDistance = (modelSize.y / 2) / Math.tan(verticalFovRadians)
  const requiredHorizontalDistance = (modelSize.x / 2) / Math.tan(horizontalFovRadians)
  const framingDistance = Math.max(requiredVerticalDistance, requiredHorizontalDistance) * 1.15
  const initialCameraOffset = new Vector3(
    0,
    modelSize.y / 10,
    framingDistance,
  )
  const cameraPosition = modelCenter.clone().add(initialCameraOffset)

  return {
    cacheHit: false,
    cameraDistance: cameraPosition.distanceTo(modelCenter),
    cameraPosition: toVec3(cameraPosition),
    eyeHeight,
    lookAtTarget: {
      x: modelCenter.x,
      y: eyeHeight,
      z: modelCenter.z + 100,
    },
    modelOffset: {
      x: root.position.x,
      y: root.position.y,
      z: root.position.z,
    },
    modelOrigin: toVec3(modelCenter),
    modelSize: toVec3(modelSize),
  }
}

export async function loadMmdSceneFromZip(file: Blob & { name?: string }, selectedModelPath?: string) {
  const analysis = await analyzeMmdArchive(file)
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const modelPath = selectedModelPath || analysis.primaryModelPath
  const modelDirectory = dirname(modelPath)
  const archiveResourceRoot = `mmd-archive://${encodeURIComponent(analysis.archiveName || 'archive')}/`
  const objectUrls = new Map<string, string>()
  const unresolvedTextures = new Set<string>()

  const manager = new LoadingManager()
  manager.setURLModifier((requestedPath) => {
    if (!requestedPath.startsWith(archiveResourceRoot)) {
      return requestedPath
    }

    const archiveRelativePath = normalizeArchiveReference(requestedPath.slice(archiveResourceRoot.length))
    const resolvedPath = resolveMmdArchivePath(analysis, archiveRelativePath)

    if (!resolvedPath) {
      unresolvedTextures.add(archiveRelativePath)
      return requestedPath
    }

    const objectUrl = objectUrls.get(resolvedPath)
    if (objectUrl) {
      return objectUrl
    }

    const entry = zip.file(resolvedPath)
    if (!entry) {
      unresolvedTextures.add(archiveRelativePath)
      return requestedPath
    }

    // NOTICE: MMDLoader's LoadingManager URL hook is synchronous, so all texture
    // object URLs must exist before the texture loader requests them.
    throw new Error(`Texture object URL was requested before preparation: ${resolvedPath}`)
  })

  const textureEntries = analysis.entryPaths.filter(path => !MMD_MODEL_FILE_PATTERN.test(path))
  await Promise.all(textureEntries.map(async (path) => {
    const entry = zip.file(path)
    if (!entry) {
      return
    }

    const bytes = await entry.async('arraybuffer')
    objectUrls.set(path, URL.createObjectURL(new Blob([bytes])))
  }))

  const modelEntry = zip.file(modelPath)
  if (!modelEntry) {
    throw new Error(`Selected MMD model not found: ${modelPath}`)
  }

  const modelObjectUrl = URL.createObjectURL(new Blob([await modelEntry.async('arraybuffer')]))

  function revokeAll() {
    URL.revokeObjectURL(modelObjectUrl)
    objectUrls.forEach(url => URL.revokeObjectURL(url))
    objectUrls.clear()
  }

  const modelUrl = withMmdModelExtension(modelObjectUrl, analysis.primaryModelFormat)
  const loader = new MMDLoader(manager)
  loader.setResourcePath(`${archiveResourceRoot}${modelDirectory}`)

  let mesh
  try {
    mesh = await loader.loadAsync(modelUrl)
  }
  catch (error) {
    revokeAll()
    throw error
  }

  return {
    analysis,
    mesh,
    unresolvedTextures: [...unresolvedTextures],
    revokeAll,
  }
}

function withMmdModelExtension(url: string, format: 'pmx' | 'pmd') {
  return `${url}#model.${format}`
}

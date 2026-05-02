import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'

import { buildMmdSceneBootstrap, loadMmdSceneFromZip } from './mmd-loader'
import { markObjectMaterialsForUpdate, waitForObjectTextures } from './mmd-preview-textures'
import { disposeObject3DResources } from './three-disposal'

export const MMD_PREVIEW_WIDTH = 1440
export const MMD_PREVIEW_HEIGHT = 1920
export const MMD_PREVIEW_CAMERA_DISTANCE_SCALE = 1.08
export const MMD_PREVIEW_LOOK_AT_Y_OFFSET_RATIO = -0.11

export async function loadMmdModelPreview(file: Blob & { name?: string }) {
  const canvas = document.createElement('canvas')
  canvas.width = MMD_PREVIEW_WIDTH
  canvas.height = MMD_PREVIEW_HEIGHT

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(canvas.width, canvas.height, false)

  const scene = new Scene()
  scene.add(new AmbientLight(0xFFFFFF, 0.8))

  const directionalLight = new DirectionalLight(0xFFFFFF, 0.8)
  directionalLight.position.set(1, 1, 1)
  scene.add(directionalLight)

  const { mesh, revokeAll } = await loadMmdSceneFromZip(file)
  scene.add(mesh)

  try {
    const bootstrap = buildMmdSceneBootstrap(mesh, 40, mesh.position.y + 1, canvas.width / canvas.height)
    const previewCameraOffset = new Vector3(
      bootstrap.cameraPosition.x - bootstrap.modelOrigin.x,
      bootstrap.cameraPosition.y - bootstrap.modelOrigin.y,
      bootstrap.cameraPosition.z - bootstrap.modelOrigin.z,
    ).multiplyScalar(MMD_PREVIEW_CAMERA_DISTANCE_SCALE)
    const camera = new PerspectiveCamera(40, canvas.width / canvas.height, 0.01, 1000)
    camera.position.set(
      bootstrap.modelOrigin.x + previewCameraOffset.x,
      bootstrap.modelOrigin.y + previewCameraOffset.y,
      bootstrap.modelOrigin.z + previewCameraOffset.z,
    )
    camera.lookAt(
      bootstrap.modelOrigin.x,
      bootstrap.modelOrigin.y + bootstrap.modelSize.y * MMD_PREVIEW_LOOK_AT_Y_OFFSET_RATIO,
      bootstrap.modelOrigin.z,
    )
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    mesh.updateMatrixWorld(true)

    await waitForObjectTextures(mesh)
    markObjectMaterialsForUpdate(mesh)

    renderer.render(scene, camera)
    return canvas.toDataURL()
  }
  finally {
    disposeObject3DResources(mesh)
    revokeAll()
    scene.clear()
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

export async function loadMmdModelPreviewFromUrl(url: string, fileName?: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch MMD archive preview source: ${response.status} ${response.statusText}`)
  }

  const source = await response.blob()
  const previewSource = new File(
    [source],
    fileName ?? resolveFileNameFromUrl(url),
    { type: source.type || 'application/zip' },
  )

  return loadMmdModelPreview(previewSource)
}

function resolveFileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url, globalThis.location?.href).pathname
    const lastSegment = pathname.split('/').filter(Boolean).at(-1)
    return lastSegment ? decodeURIComponent(lastSegment) : 'archive.zip'
  }
  catch {
    return 'archive.zip'
  }
}

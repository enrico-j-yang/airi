import type { MmdArchiveAnalysis, MmdModelFormat } from './mmd-archive'

import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { buildMmdSceneBootstrap, loadMmdSceneFromZip } from './mmd-loader'

const {
  analyzeMmdArchiveMock,
  resolveMmdArchivePathMock,
  jsZipLoadAsyncMock,
  loadAsyncMock,
} = vi.hoisted(() => ({
  analyzeMmdArchiveMock: vi.fn<(file: Blob & { name?: string }) => Promise<MmdArchiveAnalysis>>(),
  resolveMmdArchivePathMock: vi.fn(),
  jsZipLoadAsyncMock: vi.fn(),
  loadAsyncMock: vi.fn(),
}))

vi.mock('./mmd-archive', () => ({
  analyzeMmdArchive: analyzeMmdArchiveMock,
  resolveMmdArchivePath: resolveMmdArchivePathMock,
}))

vi.mock('jszip', () => ({
  default: {
    loadAsync: jsZipLoadAsyncMock,
  },
}))

vi.mock('three-stdlib', () => ({
  MMDLoader: class {
    setResourcePath(_value: string) {
      return this
    }

    loadAsync = loadAsyncMock
  },
}))

const modelObjectUrl = 'blob:model-url'
const textureObjectUrl = 'blob:texture-url'

describe('buildMmdSceneBootstrap', () => {
  it('derives camera distance and model size from visible meshes', () => {
    const root = new Object3D()
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial())
    mesh.position.set(0, 2, 0)
    root.add(mesh)
    root.updateMatrixWorld(true)

    const bootstrap = buildMmdSceneBootstrap(root, 40, 3)

    expect(bootstrap.modelSize.y).toBeGreaterThan(3.9)
    expect(bootstrap.cameraDistance).toBeGreaterThan(0)
    expect(bootstrap.eyeHeight).toBe(3)
  })

  it('places the default camera in front of the model on the positive z axis', () => {
    const root = new Object3D()
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial())
    mesh.position.set(0, 2, 0)
    root.add(mesh)
    root.updateMatrixWorld(true)

    const bootstrap = buildMmdSceneBootstrap(root, 40, 3)

    expect(bootstrap.cameraPosition.z).toBeGreaterThan(bootstrap.modelOrigin.z)
    expect(bootstrap.lookAtTarget.z).toBeGreaterThan(bootstrap.modelOrigin.z)
  })
})

describe('loadMmdSceneFromZip', () => {
  beforeEach(() => {
    analyzeMmdArchiveMock.mockReset()
    resolveMmdArchivePathMock.mockReset()
    jsZipLoadAsyncMock.mockReset()
    loadAsyncMock.mockReset()

    vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce(textureObjectUrl)
      .mockReturnValueOnce(modelObjectUrl)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it.each([
    { format: 'pmx' },
    { format: 'pmd' },
  ] as const)('preserves the $format extension when loading the primary model from a blob URL', async ({ format }) => {
    const archive = createArchiveAnalysis(format)
    const mesh = { name: `mesh-${format}` }

    analyzeMmdArchiveMock.mockResolvedValue(archive)
    jsZipLoadAsyncMock.mockResolvedValue(createZipArchive(archive.primaryModelPath))
    loadAsyncMock.mockResolvedValue({ meshUrl: `${modelObjectUrl}#model.${format}`, mesh })

    const loadedScene = await loadMmdSceneFromZip(new File([Uint8Array.of(1)], `test.${format}.zip`))

    expect(loadAsyncMock).toHaveBeenCalledOnce()
    expect(loadAsyncMock).toHaveBeenCalledWith(`${modelObjectUrl}#model.${format}`)
    expect(loadedScene.mesh).toEqual({ meshUrl: `${modelObjectUrl}#model.${format}`, mesh })
  })

  it('revokes prepared object URLs when the loader fails', async () => {
    const archive = createArchiveAnalysis('pmx')

    analyzeMmdArchiveMock.mockResolvedValue(archive)
    jsZipLoadAsyncMock.mockResolvedValue(createZipArchive(archive.primaryModelPath))
    loadAsyncMock.mockRejectedValue(new Error('broken model'))

    await expect(loadMmdSceneFromZip(new File([Uint8Array.of(1)], 'broken.zip')))
      .rejects
      .toThrow('broken model')

    expect(URL.revokeObjectURL).toHaveBeenCalledWith(modelObjectUrl)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(textureObjectUrl)
  })
})

function createArchiveAnalysis(format: MmdModelFormat): MmdArchiveAnalysis {
  return {
    archiveName: `archive.${format}.zip`,
    entryPaths: [`textures/diffuse.png`, `model.${format}`],
    primaryModelFormat: format,
    primaryModelPath: `model.${format}`,
    models: [{ path: `model.${format}`, format }],
  }
}

function createZipArchive(modelPath: string) {
  const entries = new Map([
    ['textures/diffuse.png', { async: vi.fn().mockResolvedValue(new ArrayBuffer(2)) }],
    [modelPath, { async: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }],
  ])

  return {
    file: vi.fn((path: string) => entries.get(path)),
  }
}

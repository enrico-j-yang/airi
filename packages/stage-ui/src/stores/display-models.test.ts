import localforage from 'localforage'

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, watch } from 'vue'

import { DisplayModelFormat, displayModelsPresets, resolveMmdDisplayModelFormat, useDisplayModelsStore } from './display-models'

const {
  loadMmdModelPreviewFromUrlMock,
} = vi.hoisted(() => ({
  loadMmdModelPreviewFromUrlMock: vi.fn<(url: string, fileName?: string, selectedModelPath?: string) => Promise<string | undefined>>(),
}))

vi.mock('@proj-airi/stage-ui-live2d/utils/live2d-zip-loader', () => ({}))
vi.mock('@proj-airi/stage-ui-live2d/utils/live2d-opfs-registration', () => ({}))
vi.mock('@proj-airi/stage-ui-three/utils/mmd-archive', () => ({
  analyzeMmdArchive: vi.fn(),
}))
vi.mock('@proj-airi/stage-ui-live2d/utils/live2d-preview', () => ({
  loadLive2DModelPreview: vi.fn(),
}))
vi.mock('@proj-airi/stage-ui-three/utils/mmd-preview', () => ({
  loadMmdModelPreview: vi.fn(),
  loadMmdModelPreviewFromUrl: loadMmdModelPreviewFromUrlMock,
}))
vi.mock('@proj-airi/stage-ui-three/utils/vrm-preview', () => ({
  loadVrmModelPreview: vi.fn(),
}))

describe('display model MMD helpers', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
    vi.spyOn(localforage, 'iterate').mockResolvedValue(undefined)
    const presetMmdModel = displayModelsPresets.find(model => model.id === 'preset-mmd-1')
    if (presetMmdModel) {
      delete presetMmdModel.previewImage
    }
  })

  it('maps analyzed archive formats to display model formats', () => {
    expect(resolveMmdDisplayModelFormat('pmx')).toBe(DisplayModelFormat.PMXZip)
    expect(resolveMmdDisplayModelFormat('pmd')).toBe(DisplayModelFormat.PMD)
  })

  it('registers a bundled default mmd preset', () => {
    expect(displayModelsPresets.some(model => model.id === 'preset-mmd-1' && model.format === DisplayModelFormat.PMXZip)).toBe(true)
  })

  it('reactively hydrates missing preset mmd previews after async generation resolves', async () => {
    let resolvePreview: ((value: string) => void) | undefined
    const previewImage = 'data:image/png;base64,preview'
    loadMmdModelPreviewFromUrlMock.mockImplementation(() => new Promise((resolve) => {
      resolvePreview = resolve
    }))

    const displayModelsStore = useDisplayModelsStore()
    const previewStates: Array<string | undefined> = []

    watch(
      () => displayModelsStore.displayModels.find(model => model.id === 'preset-mmd-1')?.previewImage,
      value => previewStates.push(value),
      { immediate: true },
    )

    await displayModelsStore.initialize()
    await displayModelsStore.loadDisplayModelsFromIndexedDB()

    expect(previewStates).toEqual([undefined])

    resolvePreview?.(previewImage)
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(displayModelsStore.displayModels.find(model => model.id === 'preset-mmd-1')?.previewImage).toBe(previewImage)
    expect(previewStates).toEqual([undefined, previewImage])
  })
})

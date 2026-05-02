// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { useModelStore } from './model-store'

describe('useModelStore MMD runtime metadata', () => {
  beforeEach(() => {
    const storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
  })

  it('defaults the MMD-only tracking mode to none', () => {
    setActivePinia(createPinia())
    const store = useModelStore()

    expect(store.mmdTrackingMode).toBe('none')
  })

  it('rehydrates MMD tracking mode independently from shared VRM tracking mode', async () => {
    setActivePinia(createPinia())
    const firstStore = useModelStore()

    firstStore.trackingMode = 'mouse'
    firstStore.mmdTrackingMode = 'head-track'
    await nextTick()

    setActivePinia(createPinia())
    const secondStore = useModelStore()

    expect(secondStore.trackingMode).toBe('mouse')
    expect(secondStore.mmdTrackingMode).toBe('head-track')
  })

  it('rehydrates runtime metadata across fresh store instances', async () => {
    setActivePinia(createPinia())
    const firstStore = useModelStore()

    firstStore.mmdPrimaryModelFormat = 'pmx'
    firstStore.mmdPrimaryModelPath = 'Models/Keqing/keqing.pmx'
    firstStore.mmdDetectedBones = {
      head: '頭',
      leftEye: '左目',
      rightEye: '右目',
    }
    firstStore.mmdUnresolvedTextures = ['textures/missing.png']
    await nextTick()

    setActivePinia(createPinia())
    const secondStore = useModelStore()

    expect(secondStore.mmdPrimaryModelFormat).toBe('pmx')
    expect(secondStore.mmdPrimaryModelPath).toBe('Models/Keqing/keqing.pmx')
    expect(secondStore.mmdDetectedBones).toEqual({
      head: '頭',
      leftEye: '左目',
      rightEye: '右目',
    })
    expect(secondStore.mmdUnresolvedTextures).toEqual(['textures/missing.png'])
  })

  it('resets both shared and MMD tracking modes to none', () => {
    setActivePinia(createPinia())
    const store = useModelStore()

    store.trackingMode = 'mouse'
    store.mmdTrackingMode = 'head-track'

    store.resetModelStore()

    expect(store.trackingMode).toBe('none')
    expect(store.mmdTrackingMode).toBe('none')
  })
})

function createMemoryStorage(): Storage {
  const values = new Map<string, string>()

  return {
    get length() {
      return values.size
    },
    clear() {
      values.clear()
    },
    getItem(key) {
      return values.get(key) ?? null
    },
    key(index) {
      return [...values.keys()][index] ?? null
    },
    removeItem(key) {
      values.delete(key)
    },
    setItem(key, value) {
      values.set(key, value)
    },
  }
}

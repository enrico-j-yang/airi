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

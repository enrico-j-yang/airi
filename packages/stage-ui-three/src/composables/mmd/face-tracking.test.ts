// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@proj-airi/model-driver-mediapipe', () => ({
  createMocapEngine: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    start: vi.fn(),
    stop: vi.fn(),
    updateConfig: vi.fn(),
    resetState: vi.fn(),
  })),
  createMediaPipeBackend: vi.fn(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    isBusy: vi.fn(() => false),
    run: vi.fn(),
  })),
}))

describe('useFaceTracking', () => {
  beforeEach(() => {
    vi.resetModules()
    const storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }),
      },
    })
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'video') {
        let onLoadedMetaHandler: (() => void) | null = null
        const el = {
          srcObject: null as any,
          play: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn(),
          set onloadedmetadata(h: (() => void) | null) {
            onLoadedMetaHandler = h
            if (h)
              setTimeout(h, 0)
          },
          get onloadedmetadata() { return onLoadedMetaHandler },
        }
        return el as any
      }
      return document.createElement(tag)
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns face tracking state', async () => {
    const { useFaceTracking } = await import('./face-tracking')
    const { faceState, isTracking } = useFaceTracking()

    expect(faceState.value.detected).toBe(false)
    expect(isTracking.value).toBe(false)
  })

  it('startTracking sets isTracking to true after engine init', async () => {
    const { useFaceTracking } = await import('./face-tracking')
    const { isTracking, startTracking } = useFaceTracking()

    await startTracking()

    expect(isTracking.value).toBe(true)
  })

  it('stopTracking sets isTracking to false', async () => {
    const { useFaceTracking } = await import('./face-tracking')
    const { isTracking, startTracking, stopTracking } = useFaceTracking()

    await startTracking()
    stopTracking()

    expect(isTracking.value).toBe(false)
  })
})

describe('resolveFaceCenterFromLandmarks', () => {
  it('returns center position from landmarks', async () => {
    const { resolveFaceCenterFromLandmarks } = await import('./face-tracking')

    const landmarks = [
      { x: 0.4, y: 0.3 },
      { x: 0.35, y: 0.25 },
      { x: 0.45, y: 0.25 },
    ]

    const result = resolveFaceCenterFromLandmarks(landmarks as any)

    expect(result.faceX).toBeCloseTo(0.4, 1)
    expect(result.faceY).toBeCloseTo(0.27, 1)
  })

  it('returns default position when landmarks empty', async () => {
    const { resolveFaceCenterFromLandmarks } = await import('./face-tracking')

    const result = resolveFaceCenterFromLandmarks([])

    expect(result.faceX).toBe(0.5)
    expect(result.faceY).toBe(0.5)
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

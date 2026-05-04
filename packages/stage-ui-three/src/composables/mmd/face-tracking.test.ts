// @vitest-environment jsdom

import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, shallowRef } from 'vue'

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
  let createdVideo: HTMLVideoElement | undefined
  let videoReadyState = 2
  let videoWidth = 640
  let videoHeight = 480
  let stopVideoTrack: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    document.body.innerHTML = ''
    createdVideo = undefined
    videoReadyState = 2
    videoWidth = 640
    videoHeight = 480
    stopVideoTrack = vi.fn()
    const storage = createMemoryStorage()
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('sessionStorage', storage)
    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: stopVideoTrack }],
          getVideoTracks: () => [{ label: 'mock-camera', stop: stopVideoTrack }],
        }),
      },
    })
    const createElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: ElementCreationOptions) => {
      const element = createElement(tag, options)
      if (tag === 'video') {
        createdVideo = element as HTMLVideoElement
        Object.defineProperties(createdVideo, {
          readyState: { get: () => videoReadyState, configurable: true },
          videoWidth: { get: () => videoWidth, configurable: true },
          videoHeight: { get: () => videoHeight, configurable: true },
        })
        createdVideo.play = vi.fn().mockResolvedValue(undefined)
        createdVideo.pause = vi.fn()
      }
      return element
    })
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
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

  it('keeps camera video in an on-screen decode host for Android WebView', async () => {
    const { useFaceTracking } = await import('./face-tracking')
    const { startTracking } = useFaceTracking()

    await startTracking()

    const host = document.querySelector('[data-airi-face-tracking-video-host="decode"]') as HTMLElement | null
    expect(host).toBeTruthy()
    expect(createdVideo?.parentElement).toBe(host)
    expect(Number.parseFloat(host!.style.left)).toBeGreaterThanOrEqual(0)
    expect(Number.parseFloat(host!.style.top)).toBeGreaterThanOrEqual(0)
    expect(Number.parseFloat(host!.style.width)).toBeGreaterThan(1)
    expect(Number.parseFloat(host!.style.height)).toBeGreaterThan(1)
    expect(host!.style.opacity).not.toBe('0')
  })

  it('waits for a decoded camera frame before starting the MediaPipe engine', async () => {
    videoReadyState = 1
    videoWidth = 0
    videoHeight = 0

    const { createMocapEngine } = await import('@proj-airi/model-driver-mediapipe')
    const { useFaceTracking } = await import('./face-tracking')
    const { startTracking } = useFaceTracking()

    const started = startTracking()
    await waitUntil(() => !!createdVideo)

    const engine = vi.mocked(createMocapEngine).mock.results[0]!.value
    expect(engine.start).not.toHaveBeenCalled()

    videoReadyState = 2
    videoWidth = 640
    videoHeight = 480
    createdVideo!.dispatchEvent(new Event('loadeddata'))

    await started

    expect(engine.start).toHaveBeenCalledTimes(1)
  })

  it('moves camera video into a preview host and restores the decode host on cleanup', async () => {
    const { useFaceTracking, useFaceTrackingCameraPreview } = await import('./face-tracking')
    const { startTracking } = useFaceTracking()

    await startTracking()

    const previewHost = document.createElement('div')
    document.body.appendChild(previewHost)
    const previewRef = shallowRef<HTMLElement | null>(previewHost)
    const scope = effectScope()

    scope.run(() => {
      useFaceTrackingCameraPreview(previewRef)
    })
    await nextTick()

    expect(createdVideo?.parentElement).toBe(previewHost)

    scope.stop()
    await nextTick()

    expect(createdVideo?.parentElement?.getAttribute('data-airi-face-tracking-video-host')).toBe('decode')
  })

  it('shares one camera session until all tracking consumers stop', async () => {
    const { useFaceTracking } = await import('./face-tracking')
    const firstConsumer = useFaceTracking()
    const secondConsumer = useFaceTracking()

    await firstConsumer.startTracking()
    await secondConsumer.startTracking()

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledTimes(1)

    firstConsumer.stopTracking()
    expect(stopVideoTrack).not.toHaveBeenCalled()
    expect(createdVideo?.parentElement?.getAttribute('data-airi-face-tracking-video-host')).toBe('decode')

    secondConsumer.stopTracking()
    expect(stopVideoTrack).toHaveBeenCalledTimes(1)
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

async function waitUntil(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const startedAt = Date.now()

  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs)
      throw new Error('Timed out waiting for condition')

    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

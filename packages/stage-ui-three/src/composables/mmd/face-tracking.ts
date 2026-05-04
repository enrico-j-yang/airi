import type { FrameSource, Landmark2D, MocapEngine, PerceptionState } from '@proj-airi/model-driver-mediapipe'
import type { Ref } from 'vue'

import type { FaceTrackingState } from '../../stores/model-store'

import { createMocapEngine } from '@proj-airi/model-driver-mediapipe'
import { storeToRefs } from 'pinia'
import { computed, getCurrentScope, onScopeDispose, shallowRef, watch } from 'vue'

import { useModelStore } from '../../stores/model-store'

export interface FaceTrackingOptions {
  enabled?: boolean
}

export interface FaceTrackingReturn {
  faceState: Ref<FaceTrackingState>
  isTracking: Ref<boolean>
  startTracking: () => Promise<void>
  stopTracking: () => void
  confidence: Ref<number>
}

const CAMERA_FRAME_READY_STATE = 2
const CAMERA_FRAME_TIMEOUT_MS = 5000
const CAMERA_DECODE_HOST_ATTRIBUTE = 'data-airi-face-tracking-video-host'

const isTracking = shallowRef(false)

let engine: MocapEngine | null = null
let videoStream: MediaStream | null = null
let videoElement: HTMLVideoElement | null = null
let activeModelStore: ReturnType<typeof useModelStore> | null = null
let activeConsumers = 0
let startPromise: Promise<boolean> | null = null
let decodeHost: HTMLElement | null = null
let previewHost: HTMLElement | null = null

export function resolveFaceCenterFromLandmarks(
  landmarks: Landmark2D[],
): { faceX: number, faceY: number } {
  if (!landmarks || landmarks.length === 0) {
    return { faceX: 0.5, faceY: 0.5 }
  }

  let sumX = 0
  let sumY = 0

  for (const landmark of landmarks) {
    sumX += landmark.x
    sumY += landmark.y
  }

  return {
    faceX: sumX / landmarks.length,
    faceY: sumY / landmarks.length,
  }
}

function ensureDecodeHost() {
  if (decodeHost?.isConnected) {
    return decodeHost
  }

  const host = document.createElement('div')
  host.setAttribute(CAMERA_DECODE_HOST_ATTRIBUTE, 'decode')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    height: '12px',
    left: '0px',
    opacity: '0.01',
    overflow: 'hidden',
    pointerEvents: 'none',
    position: 'fixed',
    top: '0px',
    width: '16px',
    zIndex: '0',
  })

  document.body.appendChild(host)
  decodeHost = host
  return host
}

function styleCameraVideo(video: HTMLVideoElement) {
  Object.assign(video.style, {
    display: 'block',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)',
    width: '100%',
  })
}

function attachVideoToHost(host: HTMLElement) {
  if (!videoElement)
    return

  styleCameraVideo(videoElement)

  if (videoElement.parentElement !== host)
    host.appendChild(videoElement)
}

function attachVideoToBestHost() {
  if (!videoElement)
    return

  attachVideoToHost(previewHost?.isConnected ? previewHost : ensureDecodeHost())
}

function hasDecodedCameraFrame(video: HTMLVideoElement) {
  return video.readyState >= CAMERA_FRAME_READY_STATE && video.videoWidth > 0 && video.videoHeight > 0
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function playCameraVideo(video: HTMLVideoElement, retries = 3): Promise<void> {
  try {
    await video.play()
  }
  catch (error) {
    if (retries <= 0)
      throw error

    await delay(100)
    await playCameraVideo(video, retries - 1)
  }
}

function waitForDecodedCameraFrame(video: HTMLVideoElement, timeoutMs = CAMERA_FRAME_TIMEOUT_MS): Promise<void> {
  if (hasDecodedCameraFrame(video))
    return Promise.resolve()

  return new Promise((resolve, reject) => {
    let settled = false
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      video.removeEventListener('canplay', handleFrameReady)
      video.removeEventListener('loadeddata', handleFrameReady)
      video.removeEventListener('resize', handleFrameReady)
      video.removeEventListener('error', handleError)

      if (timeoutId != null)
        clearTimeout(timeoutId)
    }

    const finish = () => {
      if (settled)
        return

      settled = true
      cleanup()
      resolve()
    }

    function handleFrameReady() {
      if (hasDecodedCameraFrame(video))
        finish()
    }

    function handleError() {
      if (settled)
        return

      settled = true
      cleanup()
      reject(new Error('Camera video failed to decode a frame'))
    }

    video.addEventListener('canplay', handleFrameReady)
    video.addEventListener('loadeddata', handleFrameReady)
    video.addEventListener('resize', handleFrameReady)
    video.addEventListener('error', handleError)

    const requestVideoFrameCallback = video.requestVideoFrameCallback?.bind(video)
    if (requestVideoFrameCallback) {
      requestVideoFrameCallback(() => {
        handleFrameReady()
      })
    }

    timeoutId = setTimeout(() => {
      if (settled)
        return

      settled = true
      cleanup()
      reject(new Error('Timed out waiting for a decoded camera frame'))
    }, timeoutMs)
  })
}

async function initEngine() {
  if (engine)
    return

  const backend = await import('@proj-airi/model-driver-mediapipe').then(m => m.createMediaPipeBackend?.())

  if (!backend) {
    console.warn('MediaPipe backend not available')
    return
  }

  engine = createMocapEngine(backend, {
    enabled: { pose: false, hands: false, face: true },
    hz: { pose: 0, hands: 0, face: 30 },
    maxPeople: 1,
  })

  await engine.init()
}

async function startCamera(modelStore: ReturnType<typeof useModelStore>) {
  if (videoStream && videoElement) {
    attachVideoToBestHost()
    await waitForDecodedCameraFrame(videoElement)
    return true
  }

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        height: { ideal: 480 },
        width: { ideal: 640 },
      },
    })

    videoElement = document.createElement('video')
    videoElement.setAttribute('playsinline', 'true')
    videoElement.setAttribute('autoplay', 'true')
    videoElement.muted = true
    videoElement.srcObject = videoStream
    attachVideoToBestHost()

    // NOTICE: MediaPipe can receive a <video>, but Android WebView may report
    // ready metadata before the first camera frame is decoded. Starting after a
    // real frame avoids permanent "no face" detections from zero-sized frames.
    await playCameraVideo(videoElement)
    await waitForDecodedCameraFrame(videoElement)

    return true
  }
  catch (error) {
    console.error('Failed to start camera:', error)
    stopCamera()
    modelStore.updateFaceTrackingState({ detected: false, confidence: 0 })
    return false
  }
}

function stopCamera() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop())
    videoStream = null
  }
  if (videoElement) {
    videoElement.pause()
    videoElement.srcObject = null
    videoElement.remove()
    videoElement = null
  }
  if (decodeHost) {
    decodeHost.remove()
    decodeHost = null
  }
}

function onStateUpdate(state: PerceptionState) {
  const faceData = state.face

  if (!faceData || !faceData.hasFace) {
    activeModelStore?.updateFaceTrackingState({
      detected: false,
      confidence: 0.1,
    })
    return
  }

  const { faceX, faceY } = resolveFaceCenterFromLandmarks(faceData.landmarks2d || [])

  activeModelStore?.updateFaceTrackingState({
    detected: true,
    faceX,
    faceY,
    confidence: 0.9,
  })
}

async function startSharedTracking(modelStore: ReturnType<typeof useModelStore>) {
  try {
    activeModelStore = modelStore
    await initEngine()
    if (!engine) {
      isTracking.value = false
      return false
    }

    const hasCamera = await startCamera(modelStore)
    if (!hasCamera || !videoElement) {
      isTracking.value = false
      return false
    }

    isTracking.value = true

    const frameSource: FrameSource = {
      getFrame: () => videoElement!,
    }

    engine.start(
      frameSource,
      onStateUpdate,
      { onError: err => console.error('Face tracking error:', err) },
    )

    return true
  }
  catch (error) {
    console.error('Failed to start face tracking:', error)
    isTracking.value = false
    modelStore.updateFaceTrackingState({ detected: false, confidence: 0 })
    return false
  }
}

function stopSharedTracking() {
  isTracking.value = false

  if (engine) {
    engine.stop()
    engine = null
  }

  stopCamera()
  activeModelStore?.updateFaceTrackingState({ detected: false, confidence: 0 })
  activeModelStore = null
  startPromise = null
}

export function useFaceTracking(_options: FaceTrackingOptions = {}): FaceTrackingReturn {
  const modelStore = useModelStore()
  const { faceTrackingState: faceState } = storeToRefs(modelStore)
  const confidence = computed(() => faceState.value.confidence)

  let consumerStarted = false

  async function startTracking() {
    if (!consumerStarted) {
      consumerStarted = true
      activeConsumers += 1
    }

    if (isTracking.value)
      return

    if (!startPromise) {
      startPromise = startSharedTracking(modelStore).finally(() => {
        startPromise = null
      })
    }

    const started = await startPromise

    if (!started && consumerStarted) {
      consumerStarted = false
      activeConsumers = Math.max(0, activeConsumers - 1)
    }

    if (started && activeConsumers <= 0)
      stopSharedTracking()
  }

  function stopTracking() {
    if (!consumerStarted)
      return

    consumerStarted = false
    activeConsumers = Math.max(0, activeConsumers - 1)

    if (activeConsumers > 0)
      return

    stopSharedTracking()
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopTracking()
    })
  }

  return {
    faceState,
    isTracking,
    startTracking,
    stopTracking,
    confidence,
  }
}

export function useFaceTrackingCameraPreview(host: Ref<HTMLElement | null>) {
  const stopPreviewWatch = watch(host, (nextHost) => {
    previewHost = nextHost

    if (previewHost)
      attachVideoToHost(previewHost)
    else
      attachVideoToBestHost()
  }, { immediate: true })

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stopPreviewWatch()
      if (previewHost === host.value)
        previewHost = null

      attachVideoToBestHost()
    })
  }
}

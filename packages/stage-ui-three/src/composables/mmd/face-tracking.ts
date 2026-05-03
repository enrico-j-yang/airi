import type { FrameSource, Landmark2D, MocapEngine, PerceptionState } from '@proj-airi/model-driver-mediapipe'
import type { Ref } from 'vue'

import type { FaceTrackingState } from '../../stores/model-store'

import { createMocapEngine } from '@proj-airi/model-driver-mediapipe'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref } from 'vue'

import { useModelStore } from '../../stores/model-store'

export interface FaceTrackingOptions {
  enabled?: boolean
}

export interface FaceTrackingReturn {
  faceState: Ref<FaceTrackingState>
  isTracking: Ref<boolean>
  startTracking: () => void
  stopTracking: () => void
  confidence: Ref<number>
}

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

export function useFaceTracking(_options: FaceTrackingOptions = {}): FaceTrackingReturn {
  const modelStore = useModelStore()
  const { faceTrackingState: faceState } = storeToRefs(modelStore)
  const isTracking = ref(false)

  const confidence = computed(() => faceState.value.confidence)

  let engine: MocapEngine | null = null
  let videoStream: MediaStream | null = null
  let videoElement: HTMLVideoElement | null = null

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

  async function startCamera() {
    try {
      videoStream = await navigator.mediaDevices.getUserMedia({ video: true })
      videoElement = document.createElement('video')
      videoElement.srcObject = videoStream
      videoElement.play()

      await new Promise<void>((resolve) => {
        videoElement!.onloadedmetadata = () => resolve()
      })
    }
    catch (error) {
      console.error('Failed to start camera:', error)
      modelStore.updateFaceTrackingState({ detected: false, confidence: 0 })
    }
  }

  function stopCamera() {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop())
      videoStream = null
    }
    if (videoElement) {
      videoElement.remove()
      videoElement = null
    }
  }

  function onStateUpdate(state: PerceptionState) {
    const faceData = state.face

    if (!faceData || !faceData.hasFace) {
      modelStore.updateFaceTrackingState({
        detected: false,
        confidence: 0.1,
      })
      return
    }

    const { faceX, faceY } = resolveFaceCenterFromLandmarks(faceData.landmarks2d || [])

    modelStore.updateFaceTrackingState({
      detected: true,
      faceX,
      faceY,
      confidence: 0.9,
    })
  }

  async function startTracking() {
    if (isTracking.value)
      return

    try {
      await initEngine()
      if (!engine) {
        isTracking.value = false
        return
      }

      await startCamera()
      if (!videoElement) {
        isTracking.value = false
        return
      }

      isTracking.value = true

      const frameSource: FrameSource = {
        getFrame: () => videoElement!,
      }

      engine!.start(
        frameSource,
        onStateUpdate,
        { onError: err => console.error('Face tracking error:', err) },
      )
    }
    catch (error) {
      console.error('Failed to start face tracking:', error)
      isTracking.value = false
      modelStore.updateFaceTrackingState({ detected: false, confidence: 0 })
    }
  }

  function stopTracking() {
    isTracking.value = false

    if (engine) {
      engine.stop()
      engine = null
    }

    stopCamera()
    modelStore.updateFaceTrackingState({ detected: false, confidence: 0 })
  }

  onUnmounted(() => {
    stopTracking()
  })

  return {
    faceState,
    isTracking,
    startTracking,
    stopTracking,
    confidence,
  }
}

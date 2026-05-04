/// <reference types="vite/client" />

export interface VisionTaskAssets {
  pose: string
  hands: string
  face: string
}

export const visionTaskAssets: VisionTaskAssets = {
  pose: new URL('./assets/pose_landmarker_lite.task', import.meta.url).href,
  hands: new URL('./assets/hand_landmarker.task', import.meta.url).href,
  face: new URL('./assets/face_landmarker.task', import.meta.url).href,
}

export function resolveVisionTaskWasmRoot(isProd: boolean, devRoot: string) {
  return isProd ? '/mediapipe-wasm' : devRoot
}

export const visionTaskWasmRoot = resolveVisionTaskWasmRoot(
  import.meta.env?.PROD ?? false,
  // NOTICE: In production builds, Vite does not bundle directory-level new URL()
  // references. MediaPipe's FilesetResolver.forVisionTasks() dynamically creates
  // <script> tags for WASM files, so these must be served as static assets with
  // preserved filenames. A Vite plugin in each app's config copies them to
  // public/mediapipe-wasm/.
  new URL('./assets/wasm', import.meta.url).href,
)

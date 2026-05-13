export interface ThreeScenePostProcessingMountState {
  canvasReady: boolean
  rendererInstance?: unknown
  scene?: unknown
}

export function canMountThreeScenePostProcessing(state: ThreeScenePostProcessingMountState) {
  return state.canvasReady && !!state.rendererInstance && !!state.scene
}

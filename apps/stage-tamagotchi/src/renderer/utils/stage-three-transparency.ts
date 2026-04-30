import type { StageModelRenderer } from '@proj-airi/stage-ui/stores/settings/stage-model'

import { isThreeStageModelRenderer } from '@proj-airi/stage-ui/stores/settings/stage-model'

export type StageComponentState = 'pending' | 'loading' | 'mounted'

export function shouldSampleStageTransparency(params: {
  componentState: StageComponentState
  fadeOnHoverEnabled: boolean
  stageModelRenderer: StageModelRenderer
  stagePaused: boolean
}) {
  return params.fadeOnHoverEnabled
    && !params.stagePaused
    && params.componentState === 'mounted'
    && isThreeStageModelRenderer(params.stageModelRenderer)
}

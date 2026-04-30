import { describe, expect, it } from 'vitest'

import { shouldSampleStageTransparency } from './stage-three-transparency'

describe('shouldSampleStageTransparency', () => {
  it('enables three-scene transparency sampling for MMD models', () => {
    expect(shouldSampleStageTransparency({
      componentState: 'mounted',
      fadeOnHoverEnabled: true,
      stageModelRenderer: 'mmd',
      stagePaused: false,
    })).toBe(true)
  })

  it('disables sampling when the stage is paused', () => {
    expect(shouldSampleStageTransparency({
      componentState: 'mounted',
      fadeOnHoverEnabled: true,
      stageModelRenderer: 'mmd',
      stagePaused: true,
    })).toBe(false)
  })
})

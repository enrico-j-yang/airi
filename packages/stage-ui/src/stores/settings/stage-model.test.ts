import { describe, expect, it } from 'vitest'

import { DisplayModelFormat } from '../display-models'
import {
  isThreeStageModelRenderer,
  resolveStageModelRenderer,
  supportsStageDepthViewControl,
} from './stage-model'

describe('resolveStageModelRenderer', () => {
  it('routes pmx and pmd formats to the mmd renderer', () => {
    expect(resolveStageModelRenderer(DisplayModelFormat.PMXZip)).toBe('mmd')
    expect(resolveStageModelRenderer(DisplayModelFormat.PMD)).toBe('mmd')
    expect(resolveStageModelRenderer(DisplayModelFormat.VRM)).toBe('vrm')
  })

  it('treats MMD as a three-scene renderer for shared controls', () => {
    expect(isThreeStageModelRenderer('vrm')).toBe(true)
    expect(isThreeStageModelRenderer('mmd')).toBe(true)
    expect(isThreeStageModelRenderer('live2d')).toBe(false)
  })

  it('keeps the depth control available for MMD stage models', () => {
    expect(supportsStageDepthViewControl('vrm')).toBe(true)
    expect(supportsStageDepthViewControl('mmd')).toBe(true)
    expect(supportsStageDepthViewControl('live2d')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'

import { DisplayModelFormat } from '../display-models'
import { resolveStageModelRenderer } from './stage-model'

describe('resolveStageModelRenderer', () => {
  it('routes pmx and pmd formats to the mmd renderer', () => {
    expect(resolveStageModelRenderer(DisplayModelFormat.PMXZip)).toBe('mmd')
    expect(resolveStageModelRenderer(DisplayModelFormat.PMD)).toBe('mmd')
    expect(resolveStageModelRenderer(DisplayModelFormat.VRM)).toBe('vrm')
  })
})

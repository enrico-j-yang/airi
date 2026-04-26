import { describe, expect, it } from 'vitest'

import { DisplayModelFormat, displayModelsPresets, resolveMmdDisplayModelFormat } from './display-models'

describe('display model MMD helpers', () => {
  it('maps analyzed archive formats to display model formats', () => {
    expect(resolveMmdDisplayModelFormat('pmx')).toBe(DisplayModelFormat.PMXZip)
    expect(resolveMmdDisplayModelFormat('pmd')).toBe(DisplayModelFormat.PMD)
  })

  it('registers a bundled default mmd preset', () => {
    expect(displayModelsPresets.some(model => model.id === 'preset-mmd-1' && model.format === DisplayModelFormat.PMXZip)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'

import {
  createEmptyModelSettingsRuntimeSnapshot,
  resolveThreeModelSettingsControlsLocked,
} from './runtime'

describe('model settings runtime snapshot', () => {
  it('supports mmd as a first-class renderer', () => {
    const snapshot = createEmptyModelSettingsRuntimeSnapshot({
      renderer: 'mmd',
      phase: 'mounted',
      previewAvailable: true,
    })

    expect(snapshot.renderer).toBe('mmd')
    expect(snapshot.phase).toBe('mounted')
    expect(snapshot.previewAvailable).toBe(true)
  })

  it('keeps MMD controls editable even while the scene is still binding', () => {
    expect(resolveThreeModelSettingsControlsLocked({
      hasModel: true,
      renderer: 'mmd',
      sceneMutationLocked: true,
      stageMounted: false,
    })).toBe(false)
  })

  it('keeps VRM controls locked until the scene is mounted and stable', () => {
    expect(resolveThreeModelSettingsControlsLocked({
      hasModel: true,
      renderer: 'vrm',
      sceneMutationLocked: true,
      stageMounted: true,
    })).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'

import { createEmptyModelSettingsRuntimeSnapshot } from './runtime'

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
})

import { describe, expect, it } from 'vitest'

import {
  MMD_PREVIEW_CAMERA_DISTANCE_SCALE,
  MMD_PREVIEW_HEIGHT,
  MMD_PREVIEW_LOOK_AT_Y_OFFSET_RATIO,
  MMD_PREVIEW_WIDTH,
} from './mmd-preview'

describe('mMD preview canvas', () => {
  it('matches the model selector card aspect ratio', () => {
    expect(MMD_PREVIEW_WIDTH / MMD_PREVIEW_HEIGHT).toBeCloseTo(12 / 16)
  })

  it('uses extra camera distance to keep full-body models inside the card frame', () => {
    expect(MMD_PREVIEW_CAMERA_DISTANCE_SCALE).toBeGreaterThan(1)
  })

  it('looks slightly lower than the bootstrap origin to keep more leg space in frame', () => {
    expect(MMD_PREVIEW_LOOK_AT_Y_OFFSET_RATIO).toBeLessThan(0)
  })
})

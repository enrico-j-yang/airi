// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { canMountThreeScenePostProcessing } from './three-scene-post-processing'

describe('canMountThreeScenePostProcessing', () => {
  it('returns false when the canvas is not ready', () => {
    expect(canMountThreeScenePostProcessing({
      canvasReady: false,
      rendererInstance: {},
      scene: {},
    })).toBe(false)
  })

  it('returns false when the renderer instance is missing', () => {
    expect(canMountThreeScenePostProcessing({
      canvasReady: true,
      rendererInstance: null,
      scene: {},
    })).toBe(false)
  })

  it('returns false when the scene is missing', () => {
    expect(canMountThreeScenePostProcessing({
      canvasReady: true,
      rendererInstance: {},
      scene: null,
    })).toBe(false)
  })

  it('returns true once canvas, renderer, and scene are all ready', () => {
    expect(canMountThreeScenePostProcessing({
      canvasReady: true,
      rendererInstance: {},
      scene: {},
    })).toBe(true)
  })
})

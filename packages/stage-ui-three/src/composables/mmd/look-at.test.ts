import { Bone } from 'three'
import { describe, expect, it } from 'vitest'

import {
  clampMmdLookAtAngles,
  dampMmdLookAtValue,
  resolveMmdLookAtAngles,
  resolveMmdLookAtBones,
  resolveMmdTrackedBoneRotations,
} from './look-at'

describe('resolveMmdLookAtBones', () => {
  it('prefers manual overrides over auto-detected names', () => {
    const root = new Bone()
    const head = new Bone()
    head.name = '頭'
    const leftEye = new Bone()
    leftEye.name = '左目'
    const rightEye = new Bone()
    rightEye.name = '右目'
    const customHead = new Bone()
    customHead.name = 'custom_head'
    root.add(head, leftEye, rightEye, customHead)

    const resolved = resolveMmdLookAtBones(root, {
      headBoneName: 'custom_head',
      leftEyeBoneName: '',
      rightEyeBoneName: '',
    })

    expect(resolved.head?.name).toBe('custom_head')
    expect(resolved.leftEye?.name).toBe('左目')
    expect(resolved.rightEye?.name).toBe('右目')
  })
})

describe('mMD look-at math', () => {
  it('treats positive z as the forward direction for zero-yaw targets', () => {
    expect(resolveMmdLookAtAngles({ x: 0, y: 0, z: 1 })).toEqual({
      pitch: 0,
      yaw: 0,
    })
  })

  it('clamps yaw and pitch to configured bounds', () => {
    expect(clampMmdLookAtAngles({ yaw: 60, pitch: -40 }, { maxYawDeg: 30, maxPitchDeg: 20 })).toEqual({ yaw: 30, pitch: -20 })
  })

  it('damps values toward the target', () => {
    expect(dampMmdLookAtValue(0, 20, 10, 0.016)).toBeGreaterThan(0)
    expect(dampMmdLookAtValue(0, 20, 10, 0.016)).toBeLessThan(20)
  })

  it('resolves head-track as head-only rotation', () => {
    expect(resolveMmdTrackedBoneRotations('head-track', {
      yaw: 20,
      pitch: -10,
    }, {
      head: 0.35,
      eye: 1,
    })).toEqual({
      head: { yaw: 7, pitch: -3.5 },
      eye: { yaw: 0, pitch: 0 },
    })
  })

  it('keeps mouse mode driving both head and eyes', () => {
    expect(resolveMmdTrackedBoneRotations('mouse', {
      yaw: 20,
      pitch: -10,
    }, {
      head: 0.35,
      eye: 1,
    })).toEqual({
      head: { yaw: 7, pitch: -3.5 },
      eye: { yaw: 20, pitch: -10 },
    })
  })

  it('keeps camera mode driving both head and eyes', () => {
    expect(resolveMmdTrackedBoneRotations('camera', {
      yaw: 20,
      pitch: -10,
    }, {
      head: 0.35,
      eye: 1,
    })).toEqual({
      head: { yaw: 7, pitch: -3.5 },
      eye: { yaw: 20, pitch: -10 },
    })
  })

  it('zeroes both head and eyes when mode is none', () => {
    expect(resolveMmdTrackedBoneRotations('none', {
      yaw: 20,
      pitch: -10,
    }, {
      head: 0.35,
      eye: 1,
    })).toEqual({
      head: { yaw: 0, pitch: 0 },
      eye: { yaw: 0, pitch: 0 },
    })
  })
})

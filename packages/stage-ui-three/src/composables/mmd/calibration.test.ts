import type { CalibrationPoint } from './calibration'

import { describe, expect, it } from 'vitest'

import {
  CALIBRATION_POSITIONS,

  interpolateCalibrationAngles,
  resolveDefaultHeadAngles,
} from './calibration'

describe('cALIBRATION_POSITIONS', () => {
  it('contains exactly 9 calibration positions', () => {
    expect(CALIBRATION_POSITIONS.length).toBe(9)
  })

  it('has correct screen coordinates for top-left (first position)', () => {
    expect(CALIBRATION_POSITIONS[0]).toEqual({ screenX: 0, screenY: 0, label: 'top-left' })
  })

  it('has correct screen coordinates for center (last position)', () => {
    expect(CALIBRATION_POSITIONS[8]).toEqual({ screenX: 0.5, screenY: 0.5, label: 'center' })
  })
})

describe('resolveDefaultHeadAngles', () => {
  it('returns zero angles for centered face position', () => {
    const result = resolveDefaultHeadAngles(0.5, 0.5, 30, 20)
    expect(result.yaw).toBe(0)
    expect(result.pitch).toBe(0)
  })

  it('returns negative yaw for face on left side', () => {
    const result = resolveDefaultHeadAngles(0, 0.5, 30, 20)
    expect(result.yaw).toBe(-30)
  })

  it('returns positive yaw for face on right side', () => {
    const result = resolveDefaultHeadAngles(1, 0.5, 30, 20)
    expect(result.yaw).toBe(30)
  })

  it('returns negative pitch for face on top', () => {
    const result = resolveDefaultHeadAngles(0.5, 0, 30, 20)
    expect(result.pitch).toBe(-20)
  })

  it('returns positive pitch for face on bottom', () => {
    const result = resolveDefaultHeadAngles(0.5, 1, 30, 20)
    expect(result.pitch).toBe(20)
  })
})

describe('interpolateCalibrationAngles', () => {
  it('returns default angles when calibration is null', () => {
    const result = interpolateCalibrationAngles(0.5, 0.5, null, 30, 20)
    expect(result.yaw).toBe(0)
    expect(result.pitch).toBe(0)
  })

  it('returns default angles when calibration has fewer than 9 points', () => {
    const partialCalibration: CalibrationPoint[] = [
      { screenX: 0, screenY: 0, faceX: 0.1, faceY: 0.1, yaw: -30, pitch: -20, capturedAt: 0, confidence: 0.9 },
    ]
    const result = interpolateCalibrationAngles(0.5, 0.5, partialCalibration, 30, 20)
    expect(result.yaw).toBe(0)
    expect(result.pitch).toBe(0)
  })

  it('returns exact angles at calibration point location', () => {
    const calibration: CalibrationPoint[] = CALIBRATION_POSITIONS.map(pos => ({
      screenX: pos.screenX,
      screenY: pos.screenY,
      faceX: pos.screenX,
      faceY: pos.screenY,
      yaw: (pos.screenX - 0.5) * 60,
      pitch: (pos.screenY - 0.5) * 40,
      capturedAt: Date.now(),
      confidence: 0.9,
    }))

    const result = interpolateCalibrationAngles(0, 0, calibration, 30, 20)
    expect(result.yaw).toBe(-30)
    expect(result.pitch).toBe(-20)
  })

  it('interpolates between calibration points', () => {
    const calibration: CalibrationPoint[] = CALIBRATION_POSITIONS.map(pos => ({
      screenX: pos.screenX,
      screenY: pos.screenY,
      faceX: pos.screenX,
      faceY: pos.screenY,
      yaw: (pos.screenX - 0.5) * 60,
      pitch: (pos.screenY - 0.5) * 40,
      capturedAt: Date.now(),
      confidence: 0.9,
    }))

    const result = interpolateCalibrationAngles(0.25, 0.25, calibration, 30, 20)
    expect(result.yaw).toBeLessThan(0)
    expect(result.pitch).toBeLessThan(0)
  })
})

export interface CalibrationPoint {
  screenX: number
  screenY: number
  faceX: number
  faceY: number
  yaw: number
  pitch: number
  capturedAt: number
  confidence: number
}

export interface CalibrationPosition {
  screenX: number
  screenY: number
  label: string
}

export const CALIBRATION_POSITIONS: CalibrationPosition[] = [
  { screenX: 0, screenY: 0, label: 'top-left' },
  { screenX: 1, screenY: 0, label: 'top-right' },
  { screenX: 0.5, screenY: 0, label: 'top-center' },
  { screenX: 0, screenY: 0.5, label: 'left-center' },
  { screenX: 1, screenY: 0.5, label: 'right-center' },
  { screenX: 0, screenY: 1, label: 'bottom-left' },
  { screenX: 1, screenY: 1, label: 'bottom-right' },
  { screenX: 0.5, screenY: 1, label: 'bottom-center' },
  { screenX: 0.5, screenY: 0.5, label: 'center' },
]

export interface FaceTrackingCalibrationData {
  points: CalibrationPoint[]
  calibratedAt: string
}

export function resolveDefaultHeadAngles(
  faceX: number,
  faceY: number,
  maxYawDeg: number,
  maxPitchDeg: number,
): { yaw: number, pitch: number } {
  const yaw = (faceX - 0.5) * maxYawDeg * 2
  const pitch = (faceY - 0.5) * maxPitchDeg * 2
  return { yaw, pitch }
}

export function interpolateCalibrationAngles(
  faceX: number,
  faceY: number,
  calibration: CalibrationPoint[] | null,
  maxYawDeg: number,
  maxPitchDeg: number,
): { yaw: number, pitch: number } {
  if (!calibration || calibration.length < 9) {
    return resolveDefaultHeadAngles(faceX, faceY, maxYawDeg, maxPitchDeg)
  }

  const sorted = [...calibration].sort((a, b) => {
    const distA = Math.sqrt((a.faceX - faceX) ** 2 + (a.faceY - faceY) ** 2)
    const distB = Math.sqrt((b.faceX - faceX) ** 2 + (b.faceY - faceY) ** 2)
    return distA - distB
  })

  const distanceToClosest = Math.sqrt((sorted[0].faceX - faceX) ** 2 + (sorted[0].faceY - faceY) ** 2)
  if (distanceToClosest < 0.001) {
    return { yaw: sorted[0].yaw, pitch: sorted[0].pitch }
  }

  const nearest4 = sorted.slice(0, 4)

  let totalWeight = 0
  let weightedYaw = 0
  let weightedPitch = 0

  for (const point of nearest4) {
    const distance = Math.sqrt((point.faceX - faceX) ** 2 + (point.faceY - faceY) ** 2)
    const weight = distance < 0.001 ? 1000 : 1 / distance
    totalWeight += weight
    weightedYaw += point.yaw * weight
    weightedPitch += point.pitch * weight
  }

  if (totalWeight === 0) {
    return resolveDefaultHeadAngles(faceX, faceY, maxYawDeg, maxPitchDeg)
  }

  return {
    yaw: weightedYaw / totalWeight,
    pitch: weightedPitch / totalWeight,
  }
}

export function createCalibrationPointFromCapture(
  position: CalibrationPosition,
  faceX: number,
  faceY: number,
  maxYawDeg: number,
  maxPitchDeg: number,
  confidence: number,
): CalibrationPoint {
  const yaw = (position.screenX - 0.5) * maxYawDeg * 2
  const pitch = (position.screenY - 0.5) * maxPitchDeg * 2

  return {
    screenX: position.screenX,
    screenY: position.screenY,
    faceX,
    faceY,
    yaw,
    pitch,
    capturedAt: Date.now(),
    confidence,
  }
}

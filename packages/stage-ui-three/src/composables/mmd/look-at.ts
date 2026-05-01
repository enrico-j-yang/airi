import type { Bone, Object3D } from 'three'

const headCandidates = ['頭', 'head', 'Head']
const leftEyeCandidates = ['左目', '左目先', 'eye_l', 'leftEye', 'LeftEye']
const rightEyeCandidates = ['右目', '右目先', 'eye_r', 'rightEye', 'RightEye']
const EPSILON = 1e-8

export type MmdTrackingMode = 'camera' | 'mouse' | 'head-track' | 'none'
export type MmdTrackingTargetSource = 'camera' | 'mouse' | 'default'

interface MmdTrackedRotation {
  yaw: number
  pitch: number
}

interface MmdScreenLookAtParams {
  clientX: number
  clientY: number
  viewportWidth: number
  viewportHeight: number
  viewportLeft?: number
  viewportTop?: number
  maxYawDeg: number
  maxPitchDeg: number
}

function resolveBoneNameMap(root: Object3D) {
  const map = new Map<string, Bone>()

  root.traverse((node) => {
    if (!(node as Bone).isBone) {
      return
    }

    const bone = node as Bone
    if (!map.has(bone.name)) {
      map.set(bone.name, bone)
    }
  })

  return map
}

function findBone(root: Object3D, preferredName: string, fallbackNames: string[]) {
  const bonesByName = resolveBoneNameMap(root)

  for (const name of [preferredName, ...fallbackNames].filter(Boolean)) {
    const bone = bonesByName.get(name)
    if (bone) {
      return bone
    }
  }
}

export function resolveMmdLookAtBones(root: Object3D, overrides: {
  headBoneName: string
  leftEyeBoneName: string
  rightEyeBoneName: string
}) {
  return {
    head: findBone(root, overrides.headBoneName, headCandidates),
    leftEye: findBone(root, overrides.leftEyeBoneName, leftEyeCandidates),
    rightEye: findBone(root, overrides.rightEyeBoneName, rightEyeCandidates),
  }
}

export function clampMmdLookAtAngles(angles: { yaw: number, pitch: number }, limits: { maxYawDeg: number, maxPitchDeg: number }) {
  return {
    yaw: Math.max(-limits.maxYawDeg, Math.min(limits.maxYawDeg, angles.yaw)),
    pitch: Math.max(-limits.maxPitchDeg, Math.min(limits.maxPitchDeg, angles.pitch)),
  }
}

export function resolveMmdLookAtAngles(direction: { x: number, y: number, z: number }) {
  return {
    pitch: Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * 180 / Math.PI,
    yaw: Math.atan2(direction.x, direction.z) * 180 / Math.PI,
  }
}

export function resolveMmdScreenLookAtAngles(params: MmdScreenLookAtParams) {
  const {
    clientX,
    clientY,
    viewportWidth,
    viewportHeight,
    viewportLeft = 0,
    viewportTop = 0,
    maxYawDeg,
    maxPitchDeg,
  } = params

  const safeViewportWidth = Math.max(viewportWidth, 1)
  const safeViewportHeight = Math.max(viewportHeight, 1)
  const normalizedX = Math.max(-1, Math.min(1, ((clientX - viewportLeft) / safeViewportWidth) * 2 - 1))
  const normalizedY = Math.max(-1, Math.min(1, -((clientY - viewportTop) / safeViewportHeight) * 2 + 1))
  const yaw = normalizedX * maxYawDeg
  const pitch = -normalizedY * maxPitchDeg

  return {
    yaw: Math.abs(yaw) < EPSILON ? 0 : yaw,
    pitch: Math.abs(pitch) < EPSILON ? 0 : pitch,
  }
}

export function dampMmdLookAtValue(current: number, target: number, smoothing: number, delta: number) {
  const blend = 1 - Math.exp(-Math.max(smoothing, 0.0001) * delta)
  return current + (target - current) * blend
}

export function resolveMmdTrackedBoneRotations(
  mode: MmdTrackingMode,
  angles: { yaw: number, pitch: number },
  influences: { head: number, eye: number },
): {
  head: MmdTrackedRotation
  eye: MmdTrackedRotation
} {
  if (mode === 'none') {
    return {
      head: { yaw: 0, pitch: 0 },
      eye: { yaw: 0, pitch: 0 },
    }
  }

  if (mode === 'head-track') {
    return {
      head: {
        yaw: angles.yaw * influences.head,
        pitch: angles.pitch * influences.head,
      },
      eye: { yaw: 0, pitch: 0 },
    }
  }

  return {
    head: {
      yaw: angles.yaw * influences.head,
      pitch: angles.pitch * influences.head,
    },
    eye: {
      yaw: angles.yaw * influences.eye,
      pitch: angles.pitch * influences.eye,
    },
  }
}

export function resolveMmdTrackingTargetSource(mode: MmdTrackingMode, options: {
  paused?: boolean
} = {}): MmdTrackingTargetSource {
  if (options.paused) {
    return 'default'
  }

  if (mode === 'camera') {
    return 'camera'
  }

  if (mode === 'mouse' || mode === 'head-track') {
    return 'mouse'
  }

  return 'default'
}

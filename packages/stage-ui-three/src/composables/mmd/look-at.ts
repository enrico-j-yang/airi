import type { Bone, Object3D } from 'three'

const headCandidates = ['頭', 'head', 'Head']
const leftEyeCandidates = ['左目', '左目先', 'eye_l', 'leftEye', 'LeftEye']
const rightEyeCandidates = ['右目', '右目先', 'eye_r', 'rightEye', 'RightEye']

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

export function dampMmdLookAtValue(current: number, target: number, smoothing: number, delta: number) {
  const blend = 1 - Math.exp(-Math.max(smoothing, 0.0001) * delta)
  return current + (target - current) * blend
}

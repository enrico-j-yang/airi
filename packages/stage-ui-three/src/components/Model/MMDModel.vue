<script setup lang="ts">
import type { Bone, Object3D, PerspectiveCamera } from 'three'
import type { WatchStopHandle } from 'vue'

import type { SceneBootstrap, Vec3 } from '../../stores/model-store'

import { useLoop, useTresContext } from '@tresjs/core'
import { until, useMouse } from '@vueuse/core'
import { storeToRefs } from 'pinia'
import { Box3, MathUtils, Vector3 } from 'three'
import { computed, onMounted, onUnmounted, ref, shallowRef, toRefs, watch } from 'vue'

import {
  clampMmdLookAtAngles,
  dampMmdLookAtValue,
  resolveMmdLookAtBones,
} from '../../composables/mmd/look-at'
import { useModelStore } from '../../stores/model-store'
import { projectClientPointToLookAtTarget } from '../../utils/look-at-target'
import { buildMmdSceneBootstrap, loadMmdSceneFromZip } from '../../utils/mmd-loader'

type ModelLoadReason = 'initial-load' | 'model-reload' | 'model-switch'

const props = withDefaults(defineProps<{
  lastCommittedModelSrc?: string
  modelSrc?: string
  paused?: boolean
  modelOffset: Vec3
  modelRotationY: number
  lookAtTarget: Vec3
  trackingMode: string
  eyeHeight: number
  cameraPosition: Vec3
  camera: PerspectiveCamera
}>(), {
  paused: false,
})

const emit = defineEmits<{
  (e: 'loadStart', value: ModelLoadReason): void
  (e: 'sceneBootstrap', value: SceneBootstrap): void
  (e: 'lookAtTarget', value: Vec3): void
  (e: 'error', value: unknown): void
  (e: 'loaded', value: string): void
}>()

const {
  lastCommittedModelSrc,
  modelSrc,
  modelOffset,
  modelRotationY,
  lookAtTarget,
  trackingMode,
  eyeHeight,
  cameraPosition,
  camera,
} = toRefs(props)

const { scene, renderer } = useTresContext()
const modelStore = useModelStore()
const {
  mmdLookAtSmoothing,
  mmdLookAtMaxYaw,
  mmdLookAtMaxPitch,
  mmdHeadInfluence,
  mmdEyeInfluence,
  mmdHeadBoneName,
  mmdLeftEyeBoneName,
  mmdRightEyeBoneName,
} = storeToRefs(modelStore)

const { onBeforeRender } = useLoop()
const { x: mouseX, y: mouseY } = useMouse()

const mmdRoot = shallowRef<Object3D>()
const disposeResources = shallowRef<(() => void) | undefined>()
const resolvedBones = shallowRef<ReturnType<typeof resolveMmdLookAtBones>>()
const baseBoneRotations = shallowRef<{
  head?: Vec3
  leftEye?: Vec3
  rightEye?: Vec3
}>({})
const currentRotation = ref({
  eyePitch: 0,
  eyeYaw: 0,
  headPitch: 0,
  headYaw: 0,
})

let loadSequence = 0
let stopMouseWatch: WatchStopHandle | undefined
let stopCameraWatch: WatchStopHandle | undefined

function cloneRotation(bone?: Bone) {
  if (!bone) {
    return
  }

  return {
    x: bone.rotation.x,
    y: bone.rotation.y,
    z: bone.rotation.z,
  }
}

function resolveModelLoadReason(): ModelLoadReason {
  if (!lastCommittedModelSrc.value) {
    return 'initial-load'
  }

  if (lastCommittedModelSrc.value !== modelSrc.value) {
    return 'model-switch'
  }

  return 'model-reload'
}

function resolveArchiveFileName(src: string) {
  const path = src.split('?')[0]?.split('#')[0] ?? src
  const name = path.split('/').pop() ?? 'model.zip'

  try {
    return decodeURIComponent(name)
  }
  catch {
    return name
  }
}

function invalidatePendingLoads() {
  loadSequence += 1
  return loadSequence
}

function isLoadRequestCurrent(requestId: number) {
  return requestId === loadSequence
}

function clearLookAtTrackingWatches() {
  stopMouseWatch?.()
  stopMouseWatch = undefined
  stopCameraWatch?.()
  stopCameraWatch = undefined
}

function defaultLookAtTarget(nextEyeHeight: number): Vec3 {
  return {
    x: 0,
    y: nextEyeHeight,
    z: -100,
  }
}

function applyModelTransform() {
  if (!mmdRoot.value) {
    return
  }

  mmdRoot.value.position.set(
    modelOffset.value.x,
    modelOffset.value.y,
    modelOffset.value.z,
  )
  mmdRoot.value.rotation.y = MathUtils.degToRad(modelRotationY.value)
}

function updateResolvedBones() {
  if (!mmdRoot.value) {
    resolvedBones.value = undefined
    baseBoneRotations.value = {}
    modelStore.mmdDetectedBones = {
      head: '',
      leftEye: '',
      rightEye: '',
    }
    return
  }

  const bones = resolveMmdLookAtBones(mmdRoot.value, {
    headBoneName: mmdHeadBoneName.value,
    leftEyeBoneName: mmdLeftEyeBoneName.value,
    rightEyeBoneName: mmdRightEyeBoneName.value,
  })

  resolvedBones.value = bones
  baseBoneRotations.value = {
    head: cloneRotation(bones.head),
    leftEye: cloneRotation(bones.leftEye),
    rightEye: cloneRotation(bones.rightEye),
  }
  modelStore.mmdDetectedBones = {
    head: bones.head?.name ?? '',
    leftEye: bones.leftEye?.name ?? '',
    rightEye: bones.rightEye?.name ?? '',
  }
}

function resolveEyeHeightFromModel(root: Object3D, headBone?: Bone) {
  if (headBone) {
    const headPosition = new Vector3()
    headBone.getWorldPosition(headPosition)
    return headPosition.y
  }

  const box = new Box3().setFromObject(root)
  const center = new Vector3()
  const size = new Vector3()
  box.getCenter(center)
  box.getSize(size)
  return center.y + size.y / 5
}

function cleanupLoadedModel(resetRuntimeState = true) {
  mmdRoot.value?.removeFromParent()
  mmdRoot.value = undefined
  disposeResources.value?.()
  disposeResources.value = undefined
  resolvedBones.value = undefined
  baseBoneRotations.value = {}
  currentRotation.value = {
    eyePitch: 0,
    eyeYaw: 0,
    headPitch: 0,
    headYaw: 0,
  }

  if (resetRuntimeState) {
    modelStore.resetMmdRuntimeState()
  }
}

async function loadModel() {
  const requestId = invalidatePendingLoads()

  try {
    if (!modelSrc.value) {
      cleanupLoadedModel()
      return
    }

    if (!scene.value) {
      await until(() => scene.value).toBeTruthy()
    }

    if (!isLoadRequestCurrent(requestId)) {
      return
    }

    const currentLoadReason = resolveModelLoadReason()
    emit('loadStart', currentLoadReason)

    const response = await fetch(modelSrc.value)
    if (!response.ok) {
      throw new Error(`Failed to fetch MMD model archive: ${response.status} ${response.statusText}`)
    }

    const blob = await response.blob()
    const file = new File([blob], resolveArchiveFileName(modelSrc.value), { type: blob.type || 'application/zip' })
    const loaded = await loadMmdSceneFromZip(file)

    if (!isLoadRequestCurrent(requestId)) {
      loaded.revokeAll()
      return
    }

    cleanupLoadedModel(false)
    mmdRoot.value = loaded.mesh
    disposeResources.value = loaded.revokeAll
    scene.value?.add(loaded.mesh)
    applyModelTransform()

    modelStore.mmdPrimaryModelPath = loaded.analysis.primaryModelPath
    modelStore.mmdPrimaryModelFormat = loaded.analysis.primaryModelFormat
    modelStore.mmdUnresolvedTextures = [...loaded.unresolvedTextures]

    updateResolvedBones()
    const nextEyeHeight = resolveEyeHeightFromModel(loaded.mesh, resolvedBones.value?.head)
    emit('sceneBootstrap', buildMmdSceneBootstrap(loaded.mesh, camera.value.fov, nextEyeHeight))
    emit('loaded', modelSrc.value)
  }
  catch (error) {
    if (!isLoadRequestCurrent(requestId)) {
      return
    }

    cleanupLoadedModel()
    emit('error', error)
  }
}

function applyBoneLookAt(
  bone: Bone | undefined,
  baseRotation: Vec3 | undefined,
  pitchDeg: number,
  yawDeg: number,
) {
  if (!bone || !baseRotation) {
    return
  }

  bone.rotation.set(
    baseRotation.x + MathUtils.degToRad(pitchDeg),
    baseRotation.y + MathUtils.degToRad(yawDeg),
    baseRotation.z,
  )
}

function resolveTrackingTargetFromMouse(clientX: number, clientY: number) {
  const canvas = renderer?.instance.domElement

  return projectClientPointToLookAtTarget({
    camera: camera.value,
    clientX,
    clientY,
    planeDistance: 1,
    viewportHeight: canvas?.clientHeight ?? window.innerHeight,
    viewportWidth: canvas?.clientWidth ?? window.innerWidth,
  })
}

function syncTrackingMode() {
  clearLookAtTrackingWatches()

  if (trackingMode.value === 'camera') {
    stopCameraWatch = watch(cameraPosition, newPosition => emit('lookAtTarget', { ...newPosition }), {
      deep: true,
      immediate: true,
    })
    return
  }

  if (trackingMode.value === 'mouse') {
    stopMouseWatch = watch([mouseX, mouseY], ([newX, newY]) => {
      emit('lookAtTarget', resolveTrackingTargetFromMouse(newX, newY))
    }, { immediate: true })
    return
  }

  emit('lookAtTarget', defaultLookAtTarget(eyeHeight.value))
}

onBeforeRender(({ delta }) => {
  if (!mmdRoot.value || !resolvedBones.value) {
    return
  }

  const lookAtOrigin = new Vector3()
  ;(resolvedBones.value.head ?? mmdRoot.value).getWorldPosition(lookAtOrigin)

  const target = new Vector3(lookAtTarget.value.x, lookAtTarget.value.y, lookAtTarget.value.z)
  const direction = target.sub(lookAtOrigin)
  const clampedAngles = clampMmdLookAtAngles({
    pitch: Math.atan2(direction.y, Math.hypot(direction.x, direction.z)) * 180 / Math.PI,
    yaw: Math.atan2(direction.x, -direction.z) * 180 / Math.PI,
  }, {
    maxPitchDeg: mmdLookAtMaxPitch.value,
    maxYawDeg: mmdLookAtMaxYaw.value,
  })

  currentRotation.value.headYaw = dampMmdLookAtValue(currentRotation.value.headYaw, clampedAngles.yaw * mmdHeadInfluence.value, mmdLookAtSmoothing.value, delta)
  currentRotation.value.headPitch = dampMmdLookAtValue(currentRotation.value.headPitch, clampedAngles.pitch * mmdHeadInfluence.value, mmdLookAtSmoothing.value, delta)
  currentRotation.value.eyeYaw = dampMmdLookAtValue(currentRotation.value.eyeYaw, clampedAngles.yaw * mmdEyeInfluence.value, mmdLookAtSmoothing.value, delta)
  currentRotation.value.eyePitch = dampMmdLookAtValue(currentRotation.value.eyePitch, clampedAngles.pitch * mmdEyeInfluence.value, mmdLookAtSmoothing.value, delta)

  applyBoneLookAt(
    resolvedBones.value.head,
    baseBoneRotations.value.head,
    currentRotation.value.headPitch,
    currentRotation.value.headYaw,
  )
  applyBoneLookAt(
    resolvedBones.value.leftEye,
    baseBoneRotations.value.leftEye,
    currentRotation.value.eyePitch,
    currentRotation.value.eyeYaw,
  )
  applyBoneLookAt(
    resolvedBones.value.rightEye,
    baseBoneRotations.value.rightEye,
    currentRotation.value.eyePitch,
    currentRotation.value.eyeYaw,
  )
})

onMounted(() => {
  watch(modelSrc, () => {
    void loadModel()
  }, { immediate: true })

  watch(modelOffset, () => {
    applyModelTransform()
  }, { deep: true, immediate: true })

  watch(modelRotationY, () => {
    applyModelTransform()
  }, { immediate: true })

  watch([mmdHeadBoneName, mmdLeftEyeBoneName, mmdRightEyeBoneName], () => {
    updateResolvedBones()
  }, { immediate: true })

  watch(trackingMode, () => {
    syncTrackingMode()
  }, { immediate: true })
})

onUnmounted(() => {
  invalidatePendingLoads()
  clearLookAtTrackingWatches()
  cleanupLoadedModel()
})

defineExpose({
  lookAtUpdate(target: Vec3) {
    emit('lookAtTarget', target)
  },
  scene: computed(() => mmdRoot.value),
  setExpression() {},
  setVrmFrameHook() {},
})
</script>

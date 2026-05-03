<script setup lang="ts">
import type { ModelSettingsRuntimeSnapshot } from './runtime'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import FaceTrackingPrompt from '../../../dialogs/FaceTrackingPrompt.vue'
import DetectionIndicator from '../../../stage/DetectionIndicator.vue'
import CalibrationWizard from './calibration/CalibrationWizard.vue'
import ThreeScene from './three-scene.vue'

import { Container, PropertyNumber } from '../../../data-pane'

const props = withDefaults(defineProps<{
  palette: string[]
  allowExtractColors?: boolean
  runtimeSnapshot: ModelSettingsRuntimeSnapshot
}>(), {
  allowExtractColors: true,
})

defineEmits<{
  (e: 'extractColorsFromModel'): void
}>()

const { t } = useI18n()
const modelStore = useModelStore()
const {
  mmdLookAtSmoothing,
  mmdLookAtMaxYaw,
  mmdLookAtMaxPitch,
  mmdHeadInfluence,
  mmdEyeInfluence,
  mmdPrimaryModelFormat,
  mmdPrimaryModelPath,
  mmdDetectedBones,
  mmdUnresolvedTextures,
  mmdTrackingMode,
  faceTrackingCalibration,
} = storeToRefs(modelStore)

const controlsLocked = computed(() => props.runtimeSnapshot.controlsLocked)
const settingsLockClass = computed(() => {
  return controlsLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})
const trackingOptions = computed<{
  value: 'camera' | 'mouse' | 'head-track' | 'none'
  label: string
  class: string
}[]>(() => [
  { value: 'camera', label: t('settings.mmd.look-at.mode.options.camera'), class: 'col-start-2' },
  { value: 'mouse', label: t('settings.mmd.look-at.mode.options.mouse'), class: 'col-start-3' },
  { value: 'head-track', label: t('settings.mmd.look-at.mode.options.head-track'), class: 'col-start-4' },
  { value: 'none', label: t('settings.mmd.look-at.mode.options.disabled'), class: 'col-start-5' },
])

const showCalibrationWizard = ref(false)
const showFirstTimePrompt = ref(false)
const previousTrackingMode = ref<string>('none')

function updateTrackingMode(value: string) {
  if (value === 'head-track' && !faceTrackingCalibration.value) {
    previousTrackingMode.value = mmdTrackingMode.value
    showFirstTimePrompt.value = true
  }
  else {
    mmdTrackingMode.value = value as typeof mmdTrackingMode.value
  }
}

function handlePromptStartCalibration() {
  showFirstTimePrompt.value = false
  showCalibrationWizard.value = true
}

function handlePromptCancel() {
  showFirstTimePrompt.value = false
  mmdTrackingMode.value = previousTrackingMode.value as typeof mmdTrackingMode.value
}

function handleWizardComplete() {
  showCalibrationWizard.value = false
  mmdTrackingMode.value = 'head-track'
}

function handleWizardCancel() {
  showCalibrationWizard.value = false
  if (!faceTrackingCalibration.value) {
    mmdTrackingMode.value = previousTrackingMode.value as typeof mmdTrackingMode.value
  }
}

function startRecalibration() {
  showCalibrationWizard.value = true
}

const calibrationDateFormatted = computed(() => {
  if (!faceTrackingCalibration.value?.calibratedAt)
    return ''
  const date = new Date(faceTrackingCalibration.value.calibratedAt)
  return date.toLocaleDateString()
})
</script>

<template>
  <FaceTrackingPrompt
    v-if="showFirstTimePrompt"
    @start-calibration="handlePromptStartCalibration"
    @cancel="handlePromptCancel"
  />

  <CalibrationWizard
    v-if="showCalibrationWizard"
    @complete="handleWizardComplete"
    @cancel="handleWizardCancel"
  />

  <ThreeScene
    :allow-extract-colors="allowExtractColors"
    :palette="palette"
    :runtime-snapshot="runtimeSnapshot"
    :tracking-mode="mmdTrackingMode"
    :tracking-options="trackingOptions"
    :tracking-title="t('settings.mmd.look-at.mode.title')"
    @extract-colors-from-model="$emit('extractColorsFromModel')"
    @update:tracking-mode="updateTrackingMode"
  />

  <Container
    v-if="mmdTrackingMode === 'head-track'"
    :title="t('settings.mmd.face-tracking.calibration.title')"
    icon="i-solar:face-scan-circle-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80 dark:bg-black/75',
      'backdrop-blur-lg',
      'mt-2',
    ]"
  >
    <div class="px-2 pb-2">
      <div class="flex items-center justify-between gap-4 py-2">
        <div>
          <p class="text-sm text-neutral-600 dark:text-neutral-400">
            {{ faceTrackingCalibration
              ? t('settings.mmd.face-tracking.calibration.status-calibrated', { date: calibrationDateFormatted })
              : t('settings.mmd.face-tracking.calibration.status-not-calibrated')
            }}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          @click="startRecalibration"
        >
          {{ faceTrackingCalibration
            ? t('settings.mmd.face-tracking.calibration.button-recalibrate')
            : t('settings.mmd.face-tracking.calibration.button-start')
          }}
        </Button>
      </div>
    </div>
  </Container>

  <DetectionIndicator v-if="mmdTrackingMode === 'head-track'" />

  <Container
    :title="t('settings.mmd.title')"
    icon="i-solar:people-nearby-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80 dark:bg-black/75',
      'backdrop-blur-lg',
    ]"
  >
    <div :class="['px-2 pb-3 text-sm text-neutral-500 dark:text-neutral-400']">
      <div>{{ t('settings.mmd.info.format') }}: {{ mmdPrimaryModelFormat || '-' }}</div>
      <div>{{ t('settings.mmd.info.primary-path') }}: {{ mmdPrimaryModelPath || '-' }}</div>
      <div>{{ t('settings.mmd.info.head-bone') }}: {{ mmdDetectedBones.head || '-' }}</div>
      <div>{{ t('settings.mmd.info.texture-warnings') }}: {{ mmdUnresolvedTextures.length }}</div>
    </div>
    <div grid="~ cols-5 gap-1" p-2 :class="settingsLockClass">
      <PropertyNumber
        v-model="mmdLookAtSmoothing"
        :config="{ min: 1, max: 30, step: 1, label: t('settings.mmd.look-at.smoothing'), disabled: controlsLocked }"
        :label="t('settings.mmd.look-at.smoothing')"
      />
      <PropertyNumber
        v-model="mmdLookAtMaxYaw"
        :config="{ min: 1, max: 90, step: 1, label: t('settings.mmd.look-at.max-yaw'), disabled: controlsLocked }"
        :label="t('settings.mmd.look-at.max-yaw')"
      />
      <PropertyNumber
        v-model="mmdLookAtMaxPitch"
        :config="{ min: 1, max: 90, step: 1, label: t('settings.mmd.look-at.max-pitch'), disabled: controlsLocked }"
        :label="t('settings.mmd.look-at.max-pitch')"
      />
      <PropertyNumber
        v-model="mmdHeadInfluence"
        :config="{ min: 0, max: 1, step: 0.05, label: t('settings.mmd.look-at.head-influence'), disabled: controlsLocked }"
        :label="t('settings.mmd.look-at.head-influence')"
      />
      <PropertyNumber
        v-model="mmdEyeInfluence"
        :config="{ min: 0, max: 1, step: 0.05, label: t('settings.mmd.look-at.eye-influence'), disabled: controlsLocked }"
        :label="t('settings.mmd.look-at.eye-influence')"
      />
    </div>
  </Container>
</template>

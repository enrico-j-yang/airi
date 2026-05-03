<script setup lang="ts">
import type { CalibrationPosition, FaceTrackingCalibrationData } from '@proj-airi/stage-ui-three'

import { CALIBRATION_POSITIONS, createCalibrationPointFromCapture, useModelStore } from '@proj-airi/stage-ui-three'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  (e: 'complete'): void
  (e: 'cancel'): void
}>()
const { t } = useI18n()
const modelStore = useModelStore()
const {
  mmdLookAtMaxYaw,
  mmdLookAtMaxPitch,
  mmdTrackingMode,
  faceTrackingState: faceState,
  faceTrackingCalibration,
} = storeToRefs(modelStore)

const currentStep = ref(0)
const capturedPoints = ref<ReturnType<typeof createCalibrationPointFromCapture>[]>([])

const currentPosition = computed<CalibrationPosition>(() => {
  if (currentStep.value < 1 || currentStep.value > 9) {
    return CALIBRATION_POSITIONS[0]
  }
  return CALIBRATION_POSITIONS[currentStep.value - 1]
})

const progressGrid = computed(() => {
  return CALIBRATION_POSITIONS.map((_, index) => ({
    completed: index < capturedPoints.value.length,
    current: index === currentStep.value - 1,
    pending: index >= currentStep.value,
  }))
})

const canCapture = computed(() => {
  return faceState.value.detected && faceState.value.confidence > 0.5
})

const positionLabel = computed(() => {
  const labels: Record<string, string> = {
    'top-left': t('settings.mmd.face-tracking.wizard.capture.positions.top-left'),
    'top-right': t('settings.mmd.face-tracking.wizard.capture.positions.top-right'),
    'top-center': t('settings.mmd.face-tracking.wizard.capture.positions.top-center'),
    'left-center': t('settings.mmd.face-tracking.wizard.capture.positions.left-center'),
    'right-center': t('settings.mmd.face-tracking.wizard.capture.positions.right-center'),
    'bottom-left': t('settings.mmd.face-tracking.wizard.capture.positions.bottom-left'),
    'bottom-right': t('settings.mmd.face-tracking.wizard.capture.positions.bottom-right'),
    'bottom-center': t('settings.mmd.face-tracking.wizard.capture.positions.bottom-center'),
    'center': t('settings.mmd.face-tracking.wizard.capture.positions.center'),
  }
  return labels[currentPosition.value.label] || currentPosition.value.label
})

function startWizard() {
  currentStep.value = 1
  if (!faceTrackingCalibration.value) {
    mmdTrackingMode.value = 'head-track'
  }
}

function capturePosition() {
  if (!canCapture.value)
    return

  const point = createCalibrationPointFromCapture(
    currentPosition.value,
    faceState.value.faceX,
    faceState.value.faceY,
    mmdLookAtMaxYaw.value,
    mmdLookAtMaxPitch.value,
    faceState.value.confidence,
  )

  capturedPoints.value.push(point)

  if (currentStep.value < 9) {
    currentStep.value++
  }
  else {
    completeCalibration()
  }
}

function goBack() {
  if (currentStep.value > 1) {
    capturedPoints.value.pop()
    currentStep.value--
  }
}

function completeCalibration() {
  const calibrationData: FaceTrackingCalibrationData = {
    points: capturedPoints.value,
    calibratedAt: new Date().toISOString(),
  }

  modelStore.setFaceTrackingCalibration(calibrationData)
  currentStep.value = 10
}

function closeWizard() {
  if (currentStep.value === 10) {
    emit('complete')
  }
  else {
    emit('cancel')
  }
}
</script>

<template>
  <div :class="['fixed inset-0 z-100 flex items-center justify-center', 'bg-black/50 backdrop-blur-sm']">
    <div :class="['bg-white dark:bg-neutral-900 rounded-xl p-6 max-w-lg w-full', 'shadow-lg']">
      <!-- Welcome Screen (Step 0) -->
      <div v-if="currentStep === 0" class="text-center">
        <h3 class="mb-3 text-lg font-semibold">
          {{ t('settings.mmd.face-tracking.wizard.welcome.title') }}
        </h3>
        <p class="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {{ t('settings.mmd.face-tracking.wizard.welcome.description') }}
        </p>

        <div :class="['bg-neutral-100 dark:bg-neutral-800 rounded-md p-3 mb-4']">
          <ul class="text-xs text-neutral-500 space-y-1 dark:text-neutral-400">
            <li>{{ t('settings.mmd.face-tracking.wizard.welcome.requirements.camera') }}</li>
            <li>{{ t('settings.mmd.face-tracking.wizard.welcome.requirements.face') }}</li>
            <li>{{ t('settings.mmd.face-tracking.wizard.welcome.requirements.time') }}</li>
          </ul>
        </div>

        <Button variant="primary" @click="startWizard">
          {{ t('settings.mmd.face-tracking.wizard.welcome.start') }}
        </Button>
      </div>

      <!-- Capture Screen (Steps 1-9) -->
      <div v-else-if="currentStep >= 1 && currentStep <= 9">
        <div class="flex gap-4">
          <!-- Left: Instructions and camera preview -->
          <div class="flex-1">
            <div class="mb-3 flex items-center gap-2">
              <span :class="['text-xs px-2 py-1 rounded', 'bg-primary-500 text-white']">
                {{ t('settings.mmd.face-tracking.wizard.capture.point-label', { current: currentStep }) }}
              </span>
              <h4 class="font-medium">
                {{ positionLabel }}
              </h4>
            </div>

            <p class="mb-3 text-sm text-neutral-600 dark:text-neutral-400">
              {{ t('settings.mmd.face-tracking.wizard.capture.instruction', { position: positionLabel }) }}
            </p>

            <!-- Camera preview -->
            <div :class="['bg-neutral-900 rounded-md p-2 mb-3']">
              <div class="mb-1 text-xs text-neutral-500">
                {{ t('settings.mmd.face-tracking.wizard.capture.camera-preview') }}
              </div>
              <div :class="['h-24 rounded flex items-center justify-center', 'bg-black']">
                <template v-if="faceState.detected">
                  <div class="h-8 w-8 border-2 border-green-500 rounded-full" />
                  <span class="ml-2 text-xs text-green-500">
                    {{ t('settings.mmd.face-tracking.wizard.capture.detected') }}
                  </span>
                </template>
                <template v-else>
                  <span class="text-xs text-neutral-500">
                    {{ t('settings.mmd.face-tracking.wizard.capture.not-detected') }}
                  </span>
                </template>
              </div>
            </div>

            <div class="flex gap-2">
              <Button
                variant="secondary"
                :disabled="currentStep === 1"
                @click="goBack"
              >
                {{ t('settings.mmd.face-tracking.wizard.capture.back') }}
              </Button>
              <Button
                variant="primary"
                :disabled="!canCapture"
                @click="capturePosition"
              >
                {{ t('settings.mmd.face-tracking.wizard.capture.capture') }}
              </Button>
            </div>
          </div>

          <!-- Right: Progress grid -->
          <div class="w-28">
            <div class="mb-2 text-xs text-neutral-500">
              Progress
            </div>
            <div class="grid grid-cols-3 gap-1">
              <template v-for="(status, index) in progressGrid" :key="index">
                <div
                  :class="[
                    'h-8 rounded text-xs flex items-center justify-center',
                    status.completed ? 'bg-green-500 text-white' : '',
                    status.current ? 'bg-primary-500 text-white border-2 border-accent-500' : '',
                    status.pending ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500' : '',
                  ]"
                >
                  {{ status.completed ? '✓' : index + 1 }}
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>

      <!-- Complete Screen (Step 10) -->
      <div v-else-if="currentStep === 10" class="text-center">
        <div class="mb-4 text-4xl text-green-500">
          ✓
        </div>
        <h3 class="mb-2 text-lg font-semibold">
          {{ t('settings.mmd.face-tracking.wizard.complete.title') }}
        </h3>
        <p class="mb-4 text-sm text-neutral-600 dark:text-neutral-400">
          {{ t('settings.mmd.face-tracking.wizard.complete.description') }}
        </p>

        <div :class="['bg-neutral-100 dark:bg-neutral-800 rounded-md p-3 mb-4']">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('settings.mmd.face-tracking.wizard.complete.tip') }}
          </p>
        </div>

        <Button variant="primary" @click="closeWizard">
          {{ t('settings.mmd.face-tracking.wizard.complete.done') }}
        </Button>
      </div>
    </div>
  </div>
</template>

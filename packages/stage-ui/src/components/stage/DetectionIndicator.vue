<script setup lang="ts">
import { useModelStore } from '@proj-airi/stage-ui-three'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const modelStore = useModelStore()
const { faceTrackingState } = storeToRefs(modelStore)

const showPopover = ref(false)

const statusColor = computed(() => {
  if (faceTrackingState.value.detected) {
    return 'bg-green-500'
  }
  if (faceTrackingState.value.confidence > 0) {
    return 'bg-yellow-500'
  }
  return 'bg-gray-400'
})

const statusText = computed(() => {
  if (faceTrackingState.value.detected) {
    return t('settings.mmd.face-tracking.indicator.detected')
  }
  if (faceTrackingState.value.confidence > 0) {
    return t('settings.mmd.face-tracking.indicator.searching')
  }
  return t('settings.mmd.face-tracking.indicator.no-camera')
})

const confidencePercent = computed(() => {
  return Math.round(faceTrackingState.value.confidence * 100)
})

function togglePopover() {
  showPopover.value = !showPopover.value
}
</script>

<template>
  <div
    class="fixed right-3 top-3 z-50"
    @click="togglePopover"
  >
    <div
      :class="[
        'flex items-center gap-2',
        'bg-black/60 backdrop-blur-sm',
        'rounded-md px-2 py-1',
        'cursor-pointer',
      ]"
    >
      <div :class="['w-2 h-2 rounded-full', statusColor]" />
      <span class="text-xs text-white/80">{{ statusText }}</span>
    </div>

    <div
      v-if="showPopover"
      :class="[
        'absolute top-full right-0 mt-2',
        'bg-black/80 backdrop-blur-sm',
        'rounded-md p-3 min-w-40',
      ]"
    >
      <div class="mb-2 flex items-center gap-2">
        <div :class="['w-2 h-2 rounded-full', statusColor]" />
        <span class="text-sm text-white/90">{{ statusText }}</span>
      </div>

      <div class="h-15 flex items-center justify-center rounded bg-black/50">
        <div v-if="faceTrackingState.detected" class="h-5 w-5 border border-green-500 rounded-full" />
        <span v-else class="text-xs text-white/50">&mdash;</span>
      </div>

      <p class="mt-2 text-center text-xs text-white/50">
        {{ t('settings.mmd.face-tracking.indicator.confidence', { percent: confidencePercent }) }}
      </p>
    </div>
  </div>
</template>

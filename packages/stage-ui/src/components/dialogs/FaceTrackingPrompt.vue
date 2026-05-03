<script setup lang="ts">
import { Button } from '@proj-airi/ui'
import { useI18n } from 'vue-i18n'

defineEmits<{
  (e: 'startCalibration'): void
  (e: 'cancel'): void
}>()

const { t } = useI18n()
</script>

<template>
  <div :class="['fixed inset-0 z-100 flex items-center justify-center', 'bg-black/50 backdrop-blur-sm']">
    <div :class="['bg-white dark:bg-neutral-900 rounded-xl p-6 max-w-sm', 'shadow-lg']">
      <div class="mb-4 text-center">
        <div :class="['w-12 h-12 rounded-xl mx-auto mb-3', 'bg-primary-500/20 flex items-center justify-center']">
          <span class="text-2xl">&#x1f464;</span>
        </div>
        <h3 class="text-lg font-semibold">
          {{ t('settings.mmd.face-tracking.prompt.title') }}
        </h3>
      </div>

      <p class="mb-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
        {{ t('settings.mmd.face-tracking.prompt.description') }}
      </p>

      <div :class="['bg-neutral-100 dark:bg-neutral-800 rounded-md p-3 mb-4']">
        <p class="text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('settings.mmd.face-tracking.prompt.info') }}
        </p>
        <p class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
          {{ t('settings.mmd.face-tracking.prompt.later-info') }}
        </p>
      </div>

      <div class="flex gap-3">
        <Button variant="secondary" class="flex-1" @click="$emit('cancel')">
          {{ t('settings.mmd.face-tracking.prompt.cancel') }}
        </Button>
        <Button variant="primary" class="flex-1" @click="$emit('startCalibration')">
          {{ t('settings.mmd.face-tracking.prompt.start') }}
        </Button>
      </div>
    </div>
  </div>
</template>

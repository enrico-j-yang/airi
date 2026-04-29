<script setup lang="ts">
import type { ModelSettingsRuntimeSnapshot } from './runtime'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
  trackingMode,
} = storeToRefs(modelStore)

const controlsLocked = computed(() => props.runtimeSnapshot.controlsLocked)
const settingsLockClass = computed(() => {
  return controlsLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})
const trackingOptions = computed<{
  value: 'camera' | 'mouse' | 'none'
  label: string
  class: string
}[]>(() => [
  { value: 'camera', label: t('settings.mmd.look-at.mode.options.camera'), class: 'col-start-3' },
  { value: 'mouse', label: t('settings.mmd.look-at.mode.options.mouse'), class: 'col-start-4' },
  { value: 'none', label: t('settings.mmd.look-at.mode.options.disabled'), class: 'col-start-5' },
])
</script>

<template>
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
      <div class="text-xs">
        {{ t('settings.mmd.look-at.mode.title') }}:
      </div>
      <div />
      <template v-for="option in trackingOptions" :key="option.value">
        <Button
          :class="[option.class, 'w-auto']"
          :disabled="controlsLocked"
          size="sm"
          :variant="trackingMode === option.value ? 'primary' : 'secondary'"
          :label="option.label"
          @click="trackingMode = option.value"
        />
      </template>

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

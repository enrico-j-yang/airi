<script setup lang="ts">
import type { ModelSettingsRuntimeSnapshot } from './runtime'

import { useModelStore } from '@proj-airi/stage-ui-three'
import { Button, SelectTab } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { Container, PropertyColor, PropertyNumber, PropertyPoint } from '../../../data-pane'
import { ColorPalette } from '../../../widgets'

const props = withDefaults(defineProps<{
  palette: string[]
  allowExtractColors?: boolean
  runtimeSnapshot: ModelSettingsRuntimeSnapshot
  trackingMode: string
  trackingTitle: string
  trackingOptions: {
    value: string
    label: string
    class: string
  }[]
}>(), {
  allowExtractColors: true,
})

const emit = defineEmits<{
  (e: 'extractColorsFromModel'): void
  (e: 'update:trackingMode', value: string): void
}>()

const { t } = useI18n()
const modelStore = useModelStore()
const {
  modelSize,
  modelOffset,
  cameraFOV,
  modelRotationY,
  cameraDistance,
  directionalLightRotation,
  directionalLightIntensity,
  directionalLightColor,
  ambientLightIntensity,
  ambientLightColor,
  hemisphereLightIntensity,
  hemisphereSkyColor,
  hemisphereGroundColor,
  envSelect,
  skyBoxIntensity,
  renderScale,
} = storeToRefs(modelStore)

const controlsLocked = computed(() => props.runtimeSnapshot.controlsLocked)
const canExtractColors = computed(() => props.runtimeSnapshot.canCapturePreview)
const settingsLockClass = computed(() => {
  return controlsLocked.value ? ['pointer-events-none', 'opacity-60'] : []
})
const envOptions = computed(() => [
  {
    value: 'hemisphere',
    label: 'Hemisphere',
    icon: envSelect.value === 'hemisphere'
      ? 'i-solar:forbidden-circle-bold rotate-45'
      : 'i-solar:forbidden-circle-linear rotate-45',
  },
  {
    value: 'skyBox',
    label: 'SkyBox',
    icon: envSelect.value === 'skyBox'
      ? 'i-solar:gallery-circle-bold'
      : 'i-solar:gallery-circle-linear',
  },
])

function updateTrackingMode(value: string) {
  emit('update:trackingMode', value)
}
</script>

<template>
  <Container
    :title="t('settings.pages.models.sections.section.scene')"
    icon="i-solar:people-nearby-bold-duotone"
    :class="[
      'rounded-xl',
      'bg-white/80 dark:bg-black/75',
      'backdrop-blur-lg',
    ]"
  >
    <template v-if="allowExtractColors">
      <ColorPalette class="mb-4 mt-2" :colors="palette.map(hex => ({ hex, name: hex }))" mx-auto />
      <Button variant="secondary" :disabled="controlsLocked || !canExtractColors" @click="$emit('extractColorsFromModel')">
        {{ t('settings.vrm.theme-color-from-model.button-extract.title') }}
      </Button>
    </template>

    <div grid="~ cols-5 gap-1" p-2 :class="settingsLockClass">
      <PropertyPoint
        v-model:x="modelOffset.x"
        v-model:y="modelOffset.y"
        v-model:z="modelOffset.z"
        :disabled="controlsLocked"
        label="Model Position"
        :x-config="{ min: -modelSize.x * 2, max: modelSize.x * 2, step: modelSize.x / 10000, label: 'X', formatValue: val => val?.toFixed(4) }"
        :y-config="{ min: -modelSize.y * 2, max: modelSize.y * 2, step: modelSize.y / 10000, label: 'Y', formatValue: val => val?.toFixed(4) }"
        :z-config="{ min: -modelSize.z * 2, max: modelSize.z * 2, step: modelSize.z / 10000, label: 'Z', formatValue: val => val?.toFixed(4) }"
      />
      <PropertyNumber
        v-model="renderScale"
        :config="{ min: 0.5, max: 2, step: 0.25, label: t('settings.vrm.render-scale.title'), formatValue: val => val?.toFixed(2), disabled: controlsLocked }"
        :label="t('settings.vrm.render-scale.title')"
      />
      <PropertyNumber
        v-model="cameraFOV"
        :config="{ min: 1, max: 180, step: 1, label: t('settings.vrm.scale-and-position.fov'), disabled: controlsLocked }"
        :label="t('settings.vrm.scale-and-position.fov')"
      />
      <PropertyNumber
        v-model="cameraDistance"
        :config="{ min: modelSize.z, max: modelSize.z * 20, step: modelSize.z / 100, label: t('settings.vrm.scale-and-position.camera-distance'), formatValue: val => val?.toFixed(4), disabled: controlsLocked }"
        :label="t('settings.vrm.scale-and-position.camera-distance')"
      />
      <PropertyNumber
        v-model="modelRotationY"
        :config="{ min: -180, max: 180, step: 1, label: t('settings.vrm.scale-and-position.rotation-y'), disabled: controlsLocked }"
        :label="t('settings.vrm.scale-and-position.rotation-y')"
      />

      <div class="text-xs">
        {{ trackingTitle }}:
      </div>
      <div />
      <template v-for="option in trackingOptions" :key="option.value">
        <Button
          :class="[option.class, 'w-auto']"
          :disabled="controlsLocked"
          size="sm"
          :variant="trackingMode === option.value ? 'primary' : 'secondary'"
          :label="option.label"
          @click="updateTrackingMode(option.value)"
        />
      </template>

      <PropertyNumber
        v-model="directionalLightRotation.x"
        :config="{ min: -180, max: 180, step: 1, label: 'RotationXDeg', formatValue: val => val?.toFixed(0), disabled: controlsLocked }"
        label="Directional Light Rotation - X"
      />
      <PropertyNumber
        v-model="directionalLightRotation.y"
        :config="{ min: -180, max: 180, step: 1, label: 'RotationYDeg', formatValue: val => val?.toFixed(0), disabled: controlsLocked }"
        label="Directional Light Rotation - Y"
      />
      <PropertyColor
        v-model="directionalLightColor"
        :disabled="controlsLocked"
        label="Directional Light Color"
      />

      <PropertyNumber
        v-model="directionalLightIntensity"
        :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: controlsLocked }"
        label="Directional Light Intensity"
      />

      <PropertyNumber
        v-model="ambientLightIntensity"
        :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: controlsLocked }"
        label="Ambient Light Intensity"
      />
      <PropertyColor
        v-model="ambientLightColor"
        :disabled="controlsLocked"
        label="Ambient Light Color"
      />
    </div>
    <div>
      <div
        :class="[
          'px-2',
          'pt-2',
          'text-xs',
          'text-neutral-500',
          'dark:text-neutral-400',
        ]"
      >
        Environment
      </div>
      <div :class="['p-2', ...settingsLockClass]">
        <SelectTab v-model="envSelect" :options="envOptions" :disabled="controlsLocked" size="sm" />
      </div>
      <div v-if="envSelect === 'hemisphere'">
        <div grid="~ cols-5 gap-1" p-2 :class="settingsLockClass">
          <PropertyNumber
            v-model="hemisphereLightIntensity"
            :config="{ min: 0, max: 10, step: 0.01, label: 'Intensity', disabled: controlsLocked }"
            label="Hemisphere Light Intensity"
          />
          <PropertyColor
            v-model="hemisphereSkyColor"
            :disabled="controlsLocked"
            label="Hemisphere Sky Color"
          />
          <PropertyColor
            v-model="hemisphereGroundColor"
            :disabled="controlsLocked"
            label="Hemisphere Ground Color"
          />
        </div>
      </div>
      <div v-else>
        <div grid="~ cols-5 gap-1" p-2 :class="settingsLockClass">
          <PropertyNumber
            v-model="skyBoxIntensity"
            :config="{ min: 0, max: 1, step: 0.01, label: 'Intensity', disabled: controlsLocked }"
            :label="t('settings.vrm.skybox.skybox-intensity')"
          />
        </div>
      </div>
    </div>
  </Container>
</template>

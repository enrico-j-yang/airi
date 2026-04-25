# MMD Model Support Design

## Goal

Add first-class MMD model support to Project AIRI by extending the existing VRM-capable 3D model pipeline so that both `stage-web` and `stage-tamagotchi` can:

- import arbitrary user-provided MMD zip packages,
- ship with a default bundled MMD model,
- preview MMD models in the model selector,
- adjust model parameters in Settings -> Models,
- use the selected MMD model on the main stage, and
- make the model follow the mouse with head/eye gaze tracking.

This first version intentionally supports only `PMX` / `PMD` models plus textures and static rendering. `VMD`, `VPD`, MMD physics, IK-driven animation authoring, and lip sync are out of scope.

## Current State

The current model system already supports:

- 2D models through `@proj-airi/stage-ui-live2d`,
- VRM models through `@proj-airi/stage-ui-three`,
- a shared display-model catalog in `packages/stage-ui/src/stores/display-models.ts`,
- stage model selection in `packages/stage-ui/src/stores/settings/stage-model.ts`,
- model previews in the model selector,
- a shared model settings page in `packages/stage-ui/src/components/scenarios/settings/model-settings`, and
- shared stage rendering for the web and Electron apps.

The display-model store already defines dormant MMD-related formats:

- `DisplayModelFormat.PMXZip`
- `DisplayModelFormat.PMXDirectory`
- `DisplayModelFormat.PMD`

However, these formats are not wired into the renderer, settings UI, preview generation, or stage model selection flow.

## Requirements Confirmed With The User

1. Use scheme 1: extend the existing Three/Tres-based rendering stack instead of adding a second rendering engine.
2. Support both `stage-web` and `stage-tamagotchi`.
3. Support user import of arbitrary MMD zip packages.
4. Ship one default bundled MMD zip package that contains a PMX model and textures.
5. Support model parameter adjustment from Settings -> Models.
6. Support previewing MMD models in the model selection dialog.
7. Support mouse gaze tracking.
8. First version scope is limited to `PMX` / `PMD` + textures + static display + parameter adjustment + mouse gaze tracking.

## Alternatives Investigated

### Option 1: Extend The Existing Three/Tres Pipeline

Use the current `packages/stage-ui-three` scene and add a new `MMDModel` branch next to `VRMModel`, powered by Three.js MMD loader add-ons plus AIRI-owned zip parsing and path resolution helpers.

Pros:

- Reuses the current `ThreeScene`, camera controls, lighting, settings page, stage bootstrap, and runtime snapshot flow.
- Keeps web and desktop on the same implementation path.
- Minimizes architecture churn and regression risk for VRM and Live2D.

Cons:

- Three.js MMD support is lower-level than `@pixiv/three-vrm`.
- Texture-path reconciliation and file mapping must be handled by AIRI.
- Material fidelity may need additional tuning for some PMX models.

### Option 2: Use A Three.js Wrapper Such As `three-mmd-loader`

Use a dedicated wrapper around the Three.js MMD toolchain.

Pros:

- Slightly nicer TypeScript ergonomics.
- Some loader setup is prepackaged.

Cons:

- Adds another dependency layer without removing the underlying MMD limitations.
- Increases future compatibility risk with AIRI's pinned Three/Tres stack.
- Still requires AIRI-owned zip, preview, and gaze logic.

### Option 3: Add A Separate Babylon.js + `babylon-mmd` Runtime

Treat MMD as a separate rendering subsystem.

Pros:

- Stronger long-term ceiling for full MMD features such as VMD, physics, and advanced material behavior.

Cons:

- Introduces a second rendering engine and second scene lifecycle.
- Duplicates settings, preview, and stage integration logic.
- Much larger first-version cost and maintenance burden.

### Decision

Option 1 is selected. It best matches AIRI's current architecture, user requirements, and first-version scope.

## Non-Goals

The following are explicitly out of scope for this design:

- `VMD` motion loading
- `VPD` pose loading
- MMD physics simulation
- IK authoring tools
- MMD lip sync or expression automation
- direct folder import in the browser
- replacing the current VRM or Live2D runtime architecture

## Architecture Overview

The design keeps AIRI's current split between model catalog/state and runtime rendering.

### Catalog And Selection Layer

This layer remains in `packages/stage-ui` and owns:

- model metadata,
- imported files,
- selected model ID,
- renderer routing, and
- preview images.

Primary files:

- `packages/stage-ui/src/stores/display-models.ts`
- `packages/stage-ui/src/stores/settings/stage-model.ts`
- `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue`

### 3D Runtime Layer

This layer remains in `packages/stage-ui-three` and owns:

- Three.js scene lifecycle,
- model loading,
- camera bootstrap,
- lighting,
- render loop updates,
- offscreen preview rendering, and
- mouse gaze tracking.

Primary files:

- `packages/stage-ui-three/src/components/ThreeScene.vue`
- `packages/stage-ui-three/src/components/Model/VRMModel.vue`
- `packages/stage-ui-three/src/components/Model/MMDModel.vue` (new)

### Settings And Stage Composition Layer

This layer remains in `packages/stage-ui` and owns:

- the Settings -> Models page,
- runtime snapshot display state,
- preview-stage composition, and
- stage composition used by both apps.

Primary files:

- `packages/stage-ui/src/components/scenarios/settings/model-settings/index.vue`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/panel.vue`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/preview-stage.vue`
- `packages/stage-ui/src/components/scenes/Stage.vue`
- `packages/stage-pages/src/pages/settings/models/index.vue`

## High-Level Data Flow

1. The user imports an MMD zip from the model selector.
2. `display-models` validates the zip and stores the original file in IndexedDB/localforage.
3. `display-models` generates and stores a preview image for the imported model.
4. The selected model ID is written to `settings/stage/model`.
5. `settings/stage-model` resolves the selected display model and maps it to renderer `mmd`.
6. Settings preview and main stage both render the selected model through `ThreeScene`.
7. `ThreeScene` routes to `MMDModel`, which unpacks the zip, resolves textures, loads the model, emits scene bootstrap data, and updates gaze every frame.

## Model Catalog Design

### Display Model Formats

The existing `DisplayModelFormat` enum remains the single source of truth for model import formats.

This design activates:

- `DisplayModelFormat.PMXZip`
- `DisplayModelFormat.PMD`

`PMXDirectory` remains defined but not user-exposed in the first version.

### Default Bundled Model

The user-provided bundled default MMD zip under `packages/stage-ui/src/assets/mmd/` becomes a preset display model alongside the existing Live2D and VRM presets.

The preset should include:

- a stable preset ID, such as `preset-mmd-1`,
- `format: DisplayModelFormat.PMXZip`,
- `type: 'url'`,
- the zipped MMD model URL, and
- a static preview image URL checked into the repo.

Using a checked-in preview image avoids generating a preview every application start for the preset asset.

### User Imports

User imports continue to store only the original `File`, metadata, and preview image in localforage. The system will not persist expanded per-texture files or an extracted archive tree in IndexedDB.

Reasons:

- avoids multiplying storage size,
- keeps the model catalog implementation consistent with existing Live2D/VRM behavior,
- avoids long-lived extracted blobs that are harder to clean up, and
- allows runtime loaders to own blob URL lifecycle explicitly.

## Zip Parsing And Archive Resolution

### Input Contract

The first version accepts only `.zip` files for MMD import.

The zip may contain:

- a `.pmx` or `.pmd` model file,
- textures in nested directories,
- toon or sphere textures,
- extra files that should be ignored.

### Archive Tooling

Use `JSZip`, which is already present in both app workspaces and already used by `packages/stage-ui-live2d`.

### Archive Helper Responsibilities

New helpers under `packages/stage-ui-three/src` should cover:

- normalizing path separators,
- collecting all archive entries,
- locating the main `.pmx` or `.pmd` file,
- creating a case-insensitive path index,
- mapping archive entries to blob URLs,
- revoking all blob URLs on cleanup,
- surfacing missing-file diagnostics.

### Main Model Selection Rules

When multiple `.pmx` / `.pmd` files exist in one zip, the loader should choose a stable primary model using the following priority:

1. prefer `.pmx` over `.pmd`,
2. prefer shallower directory depth,
3. prefer file names closest to the zip base name,
4. fall back to lexical ordering.

This is stable, deterministic, and does not require prompting the user during first-version import.

### Texture Path Resolution

The runtime must support imperfect real-world archives. Resolution should try:

1. exact normalized path match,
2. slash-normalized match,
3. case-insensitive match,
4. relative path cleanup after removing `./` and duplicate separators,
5. basename-based fallback only when the basename is unique in the archive.

If a texture still cannot be resolved, the model should continue loading when possible and record a warning for diagnostics/UI messaging.

## Renderer Routing

### `settings/stage-model`

`packages/stage-ui/src/stores/settings/stage-model.ts` must map selected MMD formats to `stageModelRenderer = 'mmd'`.

Expected renderer mapping:

- Live2D zip -> `live2d`
- VRM -> `vrm`
- PMX zip / PMD -> `mmd`
- unknown -> `disabled`

### Runtime Snapshot

`packages/stage-ui/src/components/scenarios/settings/model-settings/runtime.ts` should expand:

- `ModelSettingsRuntimeRenderer` from `disabled | live2d | vrm`
- to `disabled | live2d | vrm | mmd`

This keeps preview availability, control-locking, and capture availability aligned with current settings-page behavior.

## Shared 3D Scene Design

### `ThreeScene.vue`

`packages/stage-ui-three/src/components/ThreeScene.vue` becomes the shared 3D model scene, not a VRM-specific scene.

It will continue to own:

- canvas lifecycle,
- camera state,
- orbit controls,
- light/environment configuration,
- post-processing,
- `SceneBootstrap` reconciliation,
- scene phase and mutation lock state,
- render-target inspection.

It will no longer assume that every 3D model is VRM.

### Model Type Routing

`ThreeScene.vue` should receive an explicit 3D model kind prop, such as `modelRenderer` or `modelFormat`, instead of inferring loader type only from `modelSrc`.

Routing:

- `vrm` -> render `VRMModel`
- `mmd` -> render `MMDModel`

This keeps loader decisions explicit and prevents ambiguous behavior if future 3D formats are added.

### Unified Model Contract

`VRMModel` and `MMDModel` should expose the same outward contract to `ThreeScene`:

- `loadStart`
- `sceneBootstrap`
- `lookAtTarget`
- `loaded`
- `error`

This keeps scene phase management centralized and reusable.

## `MMDModel` Runtime Design

### Responsibilities

`packages/stage-ui-three/src/components/Model/MMDModel.vue` should own:

- archive loading and validation,
- MMD asset URL mapping,
- Three.js MMD loader integration,
- model insertion/removal from scene,
- bootstrap calculation,
- per-frame gaze updates,
- resource disposal.

### Scene Bootstrap

`MMDModel` must emit the same `SceneBootstrap` shape currently used by VRM:

- `modelSize`
- `modelOrigin`
- `modelOffset`
- `cameraDistance`
- `cameraPosition`
- `eyeHeight`
- `lookAtTarget`

This keeps existing 3D settings controls reusable across VRM and MMD.

### Bootstrap Heuristics

The bootstrap logic should parallel VRM:

- compute a bounding box from visible meshes,
- derive a model center and user-friendly origin,
- derive default camera offset from model size and FOV,
- estimate `eyeHeight` from detected head or eye bones when possible,
- otherwise fall back to upper-body heuristics from the bounding box.

### Resource Management

`MMDModel` must explicitly clean up:

- blob URLs for archive entries,
- textures,
- materials,
- geometries,
- skeleton helpers or loaders if allocated,
- any per-frame watchers.

Unlike VRM, the first version does not need cross-mount instance caching. Simpler deterministic cleanup is preferred.

## Preview Generation

### Goal

Generate a preview image for user-imported MMD zip files so they appear correctly inside the model selector.

### Approach

Add `packages/stage-ui-three/src/utils/mmd-preview.ts`, modeled after `vrm-preview.ts`.

The preview renderer should:

- create an offscreen Three.js renderer,
- load the MMD model through the same archive-resolution helpers,
- use a neutral ambient + directional light setup,
- frame the camera using the model bounding box,
- render a single still image,
- export a portrait preview data URL.

### Failure Behavior

If preview generation fails:

- the import should still succeed when the model archive is structurally valid,
- `previewImage` should be omitted,
- the selector should fall back to the existing "Preview unavailable" placeholder card.

## Settings Page Design

### Panel Routing

`packages/stage-ui/src/components/scenarios/settings/model-settings/panel.vue` currently routes to Live2D or VRM settings UI. It should expand to route:

- `live2d`
- `vrm`
- `mmd`

### Shared 3D Controls

MMD should reuse the existing 3D controls where they already apply:

- model position
- model Y rotation
- render scale
- camera FOV
- camera distance
- environment mode
- skybox intensity
- directional / ambient / hemisphere lighting
- tracking mode selector

This is important because the user requested feature parity with the current VRM-capable settings experience.

### MMD-Specific Controls

Add a new `mmd.vue` settings panel with MMD-specific controls layered on top of the shared 3D controls:

- `lookAtSmoothing`
- `lookAtMaxYaw`
- `lookAtMaxPitch`
- `headInfluence`
- `eyeInfluence`
- optional manual bone-name overrides for:
  - `headBoneName`
  - `leftEyeBoneName`
  - `rightEyeBoneName`

These values should persist in the same shared 3D settings store unless a later refactor extracts per-renderer state.

### Model Information

The MMD settings panel should display basic detected runtime information:

- selected source format (`PMX` or `PMD`)
- resolved main model path within the zip
- whether head/eye bones were auto-detected
- unresolved texture warning count, if any

## Mouse Gaze Tracking Design

### Shared Target Semantics

The current VRM pipeline already uses:

- `trackingMode`
- `lookAtTarget`
- `cameraPosition`

These semantics should remain the single gaze-state model for all 3D renderers.

Modes:

- `camera`: look at the camera position
- `mouse`: look at a mouse-derived 3D target in front of the camera
- `none`: look at a neutral forward target

### Shared Target Generation

The existing VRM implementation computes a 3D target by projecting the mouse through the camera and intersecting a plane in front of the camera.

This logic should be extracted into a shared helper so both VRM and MMD use the same target computation. This keeps user interaction consistent across 3D model types.

### MMD Bone Application

MMD has no VRM-like high-level look-at API in AIRI, so `MMDModel` must apply gaze manually each frame:

1. resolve head and eye bones,
2. convert `lookAtTarget` into local-space direction vectors,
3. compute yaw and pitch,
4. clamp by configured pitch/yaw limits,
5. split contribution between head and eyes using influence factors,
6. interpolate toward the target using smoothing.

### Fallback Order

If automatic bone detection fails:

1. use manually configured bone names when provided,
2. if only head is available, rotate head only,
3. if neither head nor eyes are available, disable gaze updates but keep model rendering active.

### Automatic Bone Detection

The first version should attempt common Japanese MMD bone names and common English equivalents for:

- head
- left eye
- right eye

This covers most standard models while still allowing manual override for non-standard rigs.

## Error Handling And Diagnostics

### Import-Time Errors

Reject import when:

- the file is not a zip,
- the zip cannot be parsed,
- no `.pmx` or `.pmd` exists,
- the selected primary model file cannot be read.

### Recoverable Runtime Warnings

Allow import and rendering when:

- some textures are missing,
- preview generation fails,
- eye bones are missing but head exists,
- some optional material resources cannot be resolved.

Warnings should be captured for display in settings/runtime diagnostics.

### Non-Recoverable Runtime Errors

Do not switch the active stage model when:

- archive expansion fails at render time,
- the MMD loader fails to build the mesh,
- scene bootstrap cannot be computed.

Instead:

- keep the previously active stage model intact,
- surface an error message,
- leave the selected broken model available in the catalog so the user can remove or reconfigure it.

## Cross-App Integration

The same implementation should power:

- `apps/stage-web`
- `apps/stage-tamagotchi`

No Electron-only archive loading path should be introduced. Both apps should rely on browser-compatible zip parsing and blob URL resolution.

This reduces cross-surface divergence and allows the web and Electron renderers to behave the same way.

## Files Expected To Change

Likely modified files:

- `packages/stage-ui/src/stores/display-models.ts`
- `packages/stage-ui/src/stores/settings/stage-model.ts`
- `packages/stage-ui/src/components/scenarios/dialogs/model-selector/model-selector.vue`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/runtime.ts`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/panel.vue`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/preview-stage.vue`
- `packages/stage-ui/src/components/scenes/Stage.vue`
- `packages/stage-ui-three/src/components/ThreeScene.vue`
- `packages/stage-pages/src/pages/settings/models/index.vue` if copy or layout text needs adjustment
- i18n files under `packages/i18n/src/locales/*/settings.yaml`

Likely new files:

- `packages/stage-ui-three/src/components/Model/MMDModel.vue`
- `packages/stage-ui-three/src/utils/mmd-preview.ts`
- `packages/stage-ui-three/src/utils/mmd-archive.ts`
- `packages/stage-ui-three/src/utils/mmd-path-resolver.ts`
- `packages/stage-ui-three/src/composables/mmd/look-at.ts`
- `packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue`

## Testing Strategy

### Unit Tests

Add unit tests for pure logic:

- archive entry discovery
- primary model selection
- path normalization and case-insensitive matching
- missing-texture handling
- renderer mapping in `settings/stage-model`
- MMD gaze angle clamping and smoothing

### Component/Runtime Tests

Extend existing tests to cover:

- `stageModelRenderer === 'mmd'`
- runtime snapshot handling for `mmd`
- stage behavior branching so MMD does not trigger Live2D-only flows

### Manual Verification

Manual verification is required for:

- importing the bundled preset and user zips,
- preview generation in the selector,
- settings-page parameter editing,
- stage rendering in both web and Electron,
- mouse gaze behavior,
- no regression when switching back to Live2D and VRM.

## Risks And Mitigations

### Risk: Real-World Zip Variability

Some user zips will contain:

- multiple model files,
- unusual nested folders,
- path-case mismatches,
- partially missing textures.

Mitigation:

- deterministic primary-model selection,
- tolerant path resolution,
- warnings instead of unnecessary hard failure.

### Risk: MMD Material Fidelity

Rendered output may differ from native MMD tooling or from model authors' expectations.

Mitigation:

- use a conservative default lighting setup,
- expose lighting controls in settings,
- keep material tuning isolated in `MMDModel` helpers.

### Risk: Non-Standard Bone Naming

Some models will not use expected head/eye names.

Mitigation:

- auto-detect common names,
- expose manual overrides in settings,
- degrade gracefully to head-only or no gaze behavior.

## Rollout Result

When this design is implemented, AIRI will support:

- default bundled MMD models,
- user-imported MMD zip packages,
- preview generation in the model selector,
- adjustable MMD parameters in Settings -> Models,
- shared web/Electron MMD rendering through the existing 3D stack,
- mouse-driven gaze tracking,
- continued coexistence with the current Live2D and VRM systems.

## Future Work

The chosen architecture leaves room for later additions without replacing the first-version structure:

- `VMD` playback
- `VPD` import
- physics / IK
- richer material tuning
- expression and lip-sync support
- per-model settings profiles

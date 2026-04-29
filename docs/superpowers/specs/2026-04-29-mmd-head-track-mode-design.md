# MMD Head Track Mode Design

## Goal

Add an independent `head track` mode for MMD models so users can choose a mouse-follow mode that rotates only the head bone, without rotating the eye bones.

This change applies only to MMD models. VRM behavior and VRM settings remain unchanged.

## Current State

Today, MMD and VRM both share the global `trackingMode` state in `packages/stage-ui-three/src/stores/model-store.ts`.

For MMD models:

- `camera` points the model toward the camera,
- `mouse` updates `lookAtTarget` from mouse position, and
- runtime bone updates always apply both head rotation and eye rotation.

That means the current MMD `mouse` mode is effectively a full look-at mode. It does not support a head-only follow mode.

## Requirements Confirmed With The User

1. Add a new independent `head track` mode.
2. Keep the existing `mouse` mode available.
3. `head track` should move only the head, not the eyes.
4. Scope this change to MMD only.
5. Do not change VRM behavior.

## Alternatives Considered

### Option A: Extend The Shared Global `trackingMode`

Add `head-track` to the existing shared union:

- `camera | mouse | head-track | none`

Pros:

- smallest number of files touched
- minimal migration logic

Cons:

- leaks an MMD-only concept into VRM state
- weakens the shared state contract
- makes future renderer-specific behavior harder to reason about

### Option B: Add An MMD-Specific Tracking Mode

Keep the shared `trackingMode` for VRM as-is, and add a new MMD-only persisted setting:

- `mmdTrackingMode = camera | mouse | head-track | none`

Pros:

- clean renderer boundary
- no VRM regression risk from new mode values
- clearer long-term ownership of MMD-only behavior

Cons:

- one extra local-storage key
- slightly more wiring in MMD settings UI

### Option C: Keep `mouse` As-Is And Add A Secondary Toggle

Keep modes unchanged and add a second switch such as:

- `mouse behavior = look-at | head-only`

Pros:

- fewer top-level mode values

Cons:

- more confusing UI
- does not satisfy the user request for an independent mode cleanly

## Decision

Use Option B.

We will add an MMD-specific tracking mode and keep VRM on the existing shared tracking mode. This keeps the feature boundary explicit and avoids polluting VRM logic with MMD-only semantics.

## Design

### State Ownership

`packages/stage-ui-three/src/stores/model-store.ts` will own a new MMD-only persisted state:

- type: `MmdTrackingMode = 'camera' | 'mouse' | 'head-track' | 'none'`
- storage key: `settings/stage-ui-three/mmd/tracking-mode`
- default: `'none'`

The existing shared `trackingMode` remains unchanged for VRM:

- type: `TrackingMode = 'camera' | 'mouse' | 'none'`

### Settings UI

`packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue` will switch from the shared `trackingMode` binding to the new `mmdTrackingMode` binding.

The MMD settings section will expose four buttons:

- `Look at camera`
- `Look at mouse`
- `Head track`
- `Disabled`

`packages/i18n/src/locales/en/settings.yaml` and `packages/i18n/src/locales/zh-Hans/settings.yaml` will gain the new label.

VRM settings UI stays exactly as it is.

### Runtime Behavior

`packages/stage-ui-three/src/components/Model/MMDModel.vue` will read `mmdTrackingMode` instead of the shared `trackingMode`.

Mode behavior:

- `camera`
  - update `lookAtTarget` from camera position
  - apply head and eye rotation as today
- `mouse`
  - update `lookAtTarget` from mouse position
  - apply head and eye rotation as today
- `head-track`
  - update `lookAtTarget` from mouse position
  - apply head rotation only
  - keep left and right eye bones at their base rotations
- `none`
  - reset `lookAtTarget` to default forward target
  - head and eyes return to their damped neutral state

### Rotation Resolution

The current runtime directly calculates clamped angles and then applies them to both head and eyes.

We will extract a small pure helper in the MMD look-at utilities that resolves the per-mode output rotations. That helper will:

- receive clamped yaw and pitch
- receive head and eye influence values
- receive current MMD mode
- return the desired target rotations for head and eyes

Expected outputs:

- `camera` / `mouse`
  - head target uses `headInfluence`
  - eye target uses `eyeInfluence`
- `head-track`
  - head target uses `headInfluence`
  - eye target is `0` yaw and `0` pitch
- `none`
  - both targets are `0` yaw and `0` pitch

This keeps mode branching out of the render-loop body as much as possible and makes the behavior directly unit-testable.

## Component Map

- `packages/stage-ui-three/src/stores/model-store.ts`
  - Owns persisted MMD-only mode state.
- `packages/stage-ui/src/components/scenarios/settings/model-settings/mmd.vue`
  - Renders the MMD mode buttons and binds to `mmdTrackingMode`.
- `packages/stage-ui-three/src/components/Model/MMDModel.vue`
  - Translates `mmdTrackingMode` into mouse/camera tracking and per-bone rotation behavior.
- `packages/stage-ui-three/src/composables/mmd/look-at.ts`
  - Owns the pure helper that resolves target head/eye rotations.
- `packages/stage-ui-three/src/composables/mmd/look-at.test.ts`
  - Locks in the new mode behavior with regression tests.

## Data Flow

1. User changes mode in MMD settings.
2. `mmdTrackingMode` persists under the MMD-specific local-storage key.
3. `MMDModel.vue` watches `mmdTrackingMode`.
4. Mouse or camera tracking updates `lookAtTarget` depending on mode.
5. Per-frame MMD look-at math computes yaw and pitch from `lookAtTarget`.
6. The new pure helper resolves whether head-only or head-plus-eyes rotation should be applied.
7. Head and eye bones update from those resolved target rotations.

## Error Handling And Compatibility

- Existing users with `settings/stage-ui-three/trackingMode = 'mouse'` keep current VRM behavior.
- Existing MMD users will default `mmdTrackingMode` to `none` unless they explicitly choose a mode.
- No migration is required because the new key is additive and renderer-scoped.
- If an MMD model is missing eye bones, `head-track` still works because it only depends on the head bone.
- If an MMD model is missing the head bone, behavior remains the current fallback behavior: no head rotation is applied.

## Testing Plan

Follow TDD for the pure mode-resolution helper and the store/UI wiring that is practical to cover.

### Unit Tests

In `packages/stage-ui-three/src/composables/mmd/look-at.test.ts`:

- add a failing test proving `head-track` resolves non-zero head rotation but zero eye rotation
- keep a regression test proving `mouse` still resolves non-zero head and eye rotation
- keep existing angle math and damping coverage

In `packages/stage-ui/src/components/scenarios/settings/model-settings/runtime.test.ts` if needed:

- add a focused snapshot/assertion proving MMD settings expose the new mode while VRM settings remain unchanged

### Verification

Run at minimum:

- `pnpm -F @proj-airi/stage-ui-three exec vitest run src/composables/mmd/look-at.test.ts`
- `pnpm -F @proj-airi/stage-ui exec vitest run src/components/scenarios/settings/model-settings/runtime.test.ts`
- `pnpm typecheck`
- `pnpm lint:fix`

If repo-wide `pnpm lint:fix` still fails on unrelated existing issues, report that clearly and separately from feature verification.

## Non-Goals

This design does not:

- add a head-only mode for VRM
- rename existing VRM tracking options
- change MMD camera-mode semantics
- add separate smoothing or angle limits for `head-track`
- add eye-only or mixed custom tracking profiles

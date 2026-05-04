import { describe, expect, it } from 'vitest'

import { resolveVisionTaskWasmRoot } from './tasks'

describe('resolveVisionTaskWasmRoot', () => {
  it('uses a production root without a trailing slash', () => {
    const root = resolveVisionTaskWasmRoot(true, 'https://localhost/assets/wasm')

    expect(root).toBe('/mediapipe-wasm')
    expect(`${root}/vision_wasm_internal.js`).toBe('/mediapipe-wasm/vision_wasm_internal.js')
  })

  it('keeps the dev-time bundled wasm URL unchanged', () => {
    const devRoot = 'https://localhost/assets/model-driver-mediapipe/tasks/assets/wasm'

    expect(resolveVisionTaskWasmRoot(false, devRoot)).toBe(devRoot)
  })
})

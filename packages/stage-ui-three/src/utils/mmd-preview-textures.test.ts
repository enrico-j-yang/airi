import { beforeEach, describe, expect, it, vi } from 'vitest'

import { waitForTextureReady } from './mmd-preview-textures'

describe('waitForTextureReady', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  it('waits for late-bound texture image sources before resolving', async () => {
    const texture = {
      needsUpdate: false,
      source: {
        data: undefined,
      },
    } as any

    let resolved = false
    const waitPromise = waitForTextureReady(texture, 50).then(() => {
      resolved = true
    })

    await sleep(5)
    expect(resolved).toBe(false)

    const image = new EventTarget() as EventTarget & { complete?: boolean }
    image.complete = false
    texture.source.data = image

    setTimeout(() => {
      image.complete = true
      image.dispatchEvent(new Event('load'))
    }, 5)

    await waitPromise

    expect(resolved).toBe(true)
    expect(texture.needsUpdate).toBe(true)
  })
})

async function sleep(timeoutMs: number) {
  await new Promise(resolve => setTimeout(resolve, timeoutMs))
}

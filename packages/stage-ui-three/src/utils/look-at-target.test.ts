import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import { projectClientPointToLookAtTarget } from './look-at-target'

describe('projectClientPointToLookAtTarget', () => {
  it('returns a point on the camera-facing plane', () => {
    const camera = new PerspectiveCamera(40, 1, 0.01, 100)
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 1, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)

    const target = projectClientPointToLookAtTarget({
      camera,
      clientX: 200,
      clientY: 200,
      viewportWidth: 400,
      viewportHeight: 400,
      planeDistance: 1,
    })

    expect(target.z).toBeLessThan(5)
    expect(target.y).toBeGreaterThan(0.5)
  })

  it('treats client coordinates as viewport-relative when the canvas is offset', () => {
    const camera = new PerspectiveCamera(40, 1, 0.01, 100)
    camera.position.set(0, 1, 5)
    camera.lookAt(0, 1, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)

    const centeredTarget = projectClientPointToLookAtTarget({
      camera,
      clientX: 200,
      clientY: 200,
      viewportWidth: 400,
      viewportHeight: 400,
      planeDistance: 1,
    })

    const offsetParams = {
      camera,
      clientX: 300,
      clientY: 250,
      viewportWidth: 400,
      viewportHeight: 400,
      planeDistance: 1,
      viewportLeft: 100,
      viewportTop: 50,
    }
    const offsetTarget = projectClientPointToLookAtTarget(offsetParams)

    expect(offsetTarget.x).toBeCloseTo(centeredTarget.x, 5)
    expect(offsetTarget.y).toBeCloseTo(centeredTarget.y, 5)
    expect(offsetTarget.z).toBeCloseTo(centeredTarget.z, 5)
  })
})

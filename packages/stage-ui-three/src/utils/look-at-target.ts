import type { Camera } from 'three'

import type { Vec3 } from '../stores/model-store'

import { Plane, Raycaster, Vector2, Vector3 } from 'three'

export interface ProjectClientPointToLookAtTargetParams {
  camera: Camera
  clientX: number
  clientY: number
  viewportWidth: number
  viewportHeight: number
  planeDistance?: number
}

export function projectClientPointToLookAtTarget(params: ProjectClientPointToLookAtTargetParams): Vec3 {
  const {
    camera,
    clientX,
    clientY,
    viewportWidth,
    viewportHeight,
    planeDistance = 1,
  } = params

  const raycaster = new Raycaster()
  const pointer = new Vector2(
    (clientX / viewportWidth) * 2 - 1,
    -(clientY / viewportHeight) * 2 + 1,
  )
  raycaster.setFromCamera(pointer, camera)

  const cameraDirection = new Vector3()
  camera.getWorldDirection(cameraDirection)

  const planePoint = camera.position.clone().addScaledVector(cameraDirection, planeDistance)
  const plane = new Plane().setFromNormalAndCoplanarPoint(cameraDirection, planePoint)
  const target = new Vector3()

  raycaster.ray.intersectPlane(plane, target)

  return {
    x: target.x,
    y: target.y,
    z: target.z,
  }
}

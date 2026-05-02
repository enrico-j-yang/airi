import type { Camera } from 'three'

import type { Vec3 } from '../stores/model-store'

import { Plane, Raycaster, Vector2, Vector3 } from 'three'

export interface ProjectClientPointToLookAtTargetParams {
  camera: Camera
  clientX: number
  clientY: number
  viewportWidth: number
  viewportHeight: number
  viewportLeft?: number
  viewportTop?: number
  planeDistance?: number
}

export function projectClientPointToLookAtTarget(params: ProjectClientPointToLookAtTargetParams): Vec3 {
  const {
    camera,
    clientX,
    clientY,
    viewportWidth,
    viewportHeight,
    viewportLeft = 0,
    viewportTop = 0,
    planeDistance = 1,
  } = params

  const localX = clientX - viewportLeft
  const localY = clientY - viewportTop

  const raycaster = new Raycaster()
  const pointer = new Vector2(
    (localX / viewportWidth) * 2 - 1,
    -(localY / viewportHeight) * 2 + 1,
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

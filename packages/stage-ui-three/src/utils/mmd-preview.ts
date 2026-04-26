import { AmbientLight, DirectionalLight, PerspectiveCamera, Scene, WebGLRenderer } from 'three'

import { buildMmdSceneBootstrap, loadMmdSceneFromZip } from './mmd-loader'

export async function loadMmdModelPreview(file: File) {
  const canvas = document.createElement('canvas')
  canvas.width = 1440
  canvas.height = 2560

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true })
  renderer.setPixelRatio(1)
  renderer.setSize(canvas.width, canvas.height, false)

  const scene = new Scene()
  scene.add(new AmbientLight(0xFFFFFF, 0.8))

  const directionalLight = new DirectionalLight(0xFFFFFF, 0.8)
  directionalLight.position.set(1, 1, 1)
  scene.add(directionalLight)

  const { mesh, revokeAll } = await loadMmdSceneFromZip(file)
  scene.add(mesh)

  try {
    const bootstrap = buildMmdSceneBootstrap(mesh, 40, mesh.position.y + 1)
    const camera = new PerspectiveCamera(40, canvas.width / canvas.height, 0.01, 1000)
    camera.position.set(bootstrap.cameraPosition.x, bootstrap.cameraPosition.y, bootstrap.cameraPosition.z)
    camera.lookAt(bootstrap.modelOrigin.x, bootstrap.modelOrigin.y, bootstrap.modelOrigin.z)
    camera.updateProjectionMatrix()

    renderer.render(scene, camera)
    return canvas.toDataURL()
  }
  finally {
    revokeAll()
    scene.clear()
    renderer.renderLists.dispose()
    renderer.dispose()
    renderer.forceContextLoss()
  }
}

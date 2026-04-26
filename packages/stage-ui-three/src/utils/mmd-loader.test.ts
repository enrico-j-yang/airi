import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three'
import { describe, expect, it } from 'vitest'

import { buildMmdSceneBootstrap } from './mmd-loader'

describe('buildMmdSceneBootstrap', () => {
  it('derives camera distance and model size from visible meshes', () => {
    const root = new Object3D()
    const mesh = new Mesh(new BoxGeometry(2, 4, 1), new MeshBasicMaterial())
    mesh.position.set(0, 2, 0)
    root.add(mesh)
    root.updateMatrixWorld(true)

    const bootstrap = buildMmdSceneBootstrap(root, 40, 3)

    expect(bootstrap.modelSize.y).toBeGreaterThan(3.9)
    expect(bootstrap.cameraDistance).toBeGreaterThan(0)
    expect(bootstrap.eyeHeight).toBe(3)
  })
})

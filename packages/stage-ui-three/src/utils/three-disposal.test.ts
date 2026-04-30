import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, Texture } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { disposeObject3DResources } from './three-disposal'

describe('disposeObject3DResources', () => {
  it('disposes mesh geometry, materials, and texture maps', () => {
    const texture = new Texture()
    const textureDisposeSpy = vi.spyOn(texture, 'dispose')
    const geometry = new BoxGeometry(1, 1, 1)
    const geometryDisposeSpy = vi.spyOn(geometry, 'dispose')
    const material = new MeshBasicMaterial({ map: texture })
    const materialDisposeSpy = vi.spyOn(material, 'dispose')
    const root = new Object3D()
    root.add(new Mesh(geometry, material))

    disposeObject3DResources(root)

    expect(textureDisposeSpy).toHaveBeenCalledOnce()
    expect(geometryDisposeSpy).toHaveBeenCalledOnce()
    expect(materialDisposeSpy).toHaveBeenCalledOnce()
  })

  it('only disposes shared textures once', () => {
    const texture = new Texture()
    const textureDisposeSpy = vi.spyOn(texture, 'dispose')
    const root = new Object3D()
    root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ map: texture })))
    root.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ map: texture })))

    disposeObject3DResources(root)

    expect(textureDisposeSpy).toHaveBeenCalledOnce()
  })
})

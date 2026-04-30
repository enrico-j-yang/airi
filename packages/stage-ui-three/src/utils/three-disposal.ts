import type { Material, Object3D, Texture } from 'three'

function isDisposableTexture(value: unknown): value is Texture {
  return typeof value === 'object'
    && value != null
    && 'isTexture' in value
    && 'dispose' in value
}

function disposeMaterialResources(material: Material, disposedTextures: Set<Texture>) {
  for (const value of Object.values(material)) {
    if (!isDisposableTexture(value) || disposedTextures.has(value)) {
      continue
    }

    value.dispose()
    disposedTextures.add(value)
  }

  material.dispose()
}

export function disposeObject3DResources(root?: Object3D) {
  if (!root) {
    return
  }

  const disposedTextures = new Set<Texture>()

  root.traverse((node) => {
    const geometry = (node as Object3D & {
      geometry?: { dispose: () => void }
      material?: Material | Material[]
    }).geometry
    geometry?.dispose()

    const material = (node as Object3D & {
      material?: Material | Material[]
    }).material
    const materials = Array.isArray(material) ? material : material ? [material] : []

    materials.forEach(currentMaterial => disposeMaterialResources(currentMaterial, disposedTextures))
  })
}

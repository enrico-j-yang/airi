import type { Material, Object3D, Texture } from 'three'

type TextureSourceImage = Partial<EventTarget & {
  complete?: boolean
  height?: number
  naturalHeight?: number
  naturalWidth?: number
  width?: number
}>

export function isTexture(value: unknown): value is Texture {
  return typeof value === 'object' && value != null && (value as Texture).isTexture === true
}

export function collectObjectMaterials(root: Object3D) {
  const materials = new Set<Material>()

  root.traverse((object) => {
    const maybeMaterial = (object as Object3D & { material?: Material | Material[] }).material
    if (!maybeMaterial) {
      return
    }

    const materialList = Array.isArray(maybeMaterial) ? maybeMaterial : [maybeMaterial]
    materialList.forEach(material => materials.add(material))
  })

  return [...materials]
}

export function collectMaterialTextures(material: Material) {
  const textures = new Set<Texture>()

  Object.values(material).forEach((value) => {
    if (isTexture(value)) {
      textures.add(value)
    }
  })

  return [...textures]
}

export async function waitForObjectTextures(root: Object3D, timeoutMs = 2000) {
  const textures = collectObjectMaterials(root)
    .flatMap(material => collectMaterialTextures(material))

  await Promise.all(textures.map(texture => waitForTextureReady(texture, timeoutMs)))
}

export async function waitForTextureReady(texture: Texture, timeoutMs: number) {
  const startedAt = Date.now()

  while ((Date.now() - startedAt) < timeoutMs) {
    const image = texture.source.data as TextureSourceImage | null | undefined
    if (isTextureSourceReady(image)) {
      texture.needsUpdate = true
      return
    }

    await waitForTextureSourceTick(image, Math.min(32, timeoutMs - (Date.now() - startedAt)))
  }

  if (isTextureSourceReady(texture.source.data as TextureSourceImage | null | undefined)) {
    texture.needsUpdate = true
  }
}

export function markObjectMaterialsForUpdate(root: Object3D) {
  collectObjectMaterials(root).forEach((material) => {
    material.needsUpdate = true
  })
}

function isTextureSourceReady(image: TextureSourceImage | null | undefined) {
  if (!image) {
    return false
  }

  if (typeof image.complete === 'boolean') {
    return image.complete
  }

  const width = image.naturalWidth ?? image.width
  const height = image.naturalHeight ?? image.height
  return typeof width === 'number' && width > 0 && typeof height === 'number' && height > 0
}

async function waitForTextureSourceTick(image: TextureSourceImage | null | undefined, timeoutMs: number) {
  if (timeoutMs <= 0) {
    return
  }

  await new Promise<void>((resolve) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout>

    const finish = () => {
      if (settled) {
        return
      }

      settled = true
      clearTimeout(timer)
      image?.removeEventListener?.('load', finish)
      image?.removeEventListener?.('error', finish)
      resolve()
    }

    timer = setTimeout(finish, timeoutMs)
    image?.addEventListener?.('load', finish, { once: true })
    image?.addEventListener?.('error', finish, { once: true })
  })
}

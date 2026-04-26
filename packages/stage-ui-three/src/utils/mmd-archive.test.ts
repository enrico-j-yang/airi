import JSZip from 'jszip'

import { describe, expect, it } from 'vitest'

import {
  analyzeMmdArchive,
  normalizeMmdArchivePath,
  resolveMmdArchivePath,
} from './mmd-archive'

describe('mmd archive helpers', () => {
  it('prefers pmx files and resolves case-insensitive textures', async () => {
    const zip = new JSZip()
    zip.file('Model/Avatar.pmd', 'pmd')
    zip.file('Model/Avatar.pmx', 'pmx')
    zip.file('Model/Tex/Body.PNG', 'png')

    const file = new File([await zip.generateAsync({ type: 'blob' })], 'Avatar-Pack.zip', { type: 'application/zip' })
    const analysis = await analyzeMmdArchive(file)

    expect(analysis.primaryModelPath).toBe('Model/Avatar.pmx')
    expect(analysis.primaryModelFormat).toBe('pmx')
    expect(resolveMmdArchivePath(analysis, 'model/tex/body.png')).toBe('Model/Tex/Body.PNG')
    expect(normalizeMmdArchivePath('.\\Model\\Tex\\Body.PNG')).toBe('Model/Tex/Body.PNG')
  })

  it('throws when the archive has no pmx or pmd file', async () => {
    const zip = new JSZip()
    zip.file('README.txt', 'missing model')
    const file = new File([await zip.generateAsync({ type: 'blob' })], 'broken.zip', { type: 'application/zip' })

    await expect(analyzeMmdArchive(file)).rejects.toThrow('No PMX or PMD model file found in archive')
  })

  it('prefers an exact archive-name stem match over a lexicographic fallback', async () => {
    const zip = new JSZip()
    zip.file('Model/afoo.pmx', 'pmx')
    zip.file('Model/foo.pmx', 'pmx')

    const file = new File([await zip.generateAsync({ type: 'blob' })], 'foo.zip', { type: 'application/zip' })
    const analysis = await analyzeMmdArchive(file)

    expect(analysis.primaryModelPath).toBe('Model/foo.pmx')
  })
})

import JSZip from 'jszip'

export type MmdModelFormat = 'pmx' | 'pmd'

export interface MmdArchiveAnalysis {
  archiveName: string
  entryPaths: string[]
  primaryModelPath: string
  primaryModelFormat: MmdModelFormat
}

interface ModelEntry {
  path: string
  format: MmdModelFormat
}

export function normalizeMmdArchivePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^(?:\.\/|\/)+/, '')
    .replace(/\/+/g, '/')
}

export async function analyzeMmdArchive(file: Blob & { name?: string }): Promise<MmdArchiveAnalysis> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer())
  const archiveName = file.name ?? 'archive.zip'
  const entryPaths = Object.values(zip.files)
    .filter(entry => !entry.dir)
    .map(entry => normalizeMmdArchivePath(entry.name))
    .filter(path => path.length > 0)

  const models = entryPaths
    .map((path): ModelEntry | undefined => {
      const format = modelFormatFromPath(path)
      return format ? { path, format } : undefined
    })
    .filter((entry): entry is ModelEntry => entry != null)
    .sort((left, right) => compareModelEntries(left, right, archiveName))

  const primaryModel = models[0]
  if (primaryModel == null) {
    throw new Error('No PMX or PMD model file found in archive')
  }

  return {
    archiveName,
    entryPaths,
    primaryModelPath: primaryModel.path,
    primaryModelFormat: primaryModel.format,
  }
}

export function resolveMmdArchivePath(analysis: MmdArchiveAnalysis, requestedPath: string): string | undefined {
  const normalizedRequestedPath = normalizeMmdArchivePath(requestedPath)
  const exactMatch = analysis.entryPaths.find(path => path === normalizedRequestedPath)
  if (exactMatch != null) {
    return exactMatch
  }

  const lowerRequestedPath = normalizedRequestedPath.toLowerCase()
  const caseInsensitiveMatch = analysis.entryPaths.find(path => path.toLowerCase() === lowerRequestedPath)
  if (caseInsensitiveMatch != null) {
    return caseInsensitiveMatch
  }

  const requestedBasename = basename(normalizedRequestedPath).toLowerCase()
  const basenameMatches = analysis.entryPaths.filter(path => basename(path).toLowerCase() === requestedBasename)
  return basenameMatches.length === 1 ? basenameMatches[0] : undefined
}

function compareModelEntries(left: ModelEntry, right: ModelEntry, archiveName: string): number {
  return compareModelFormat(left.format, right.format)
    || compareDepth(left.path, right.path)
    || compareArchiveNameMatch(left.path, right.path, archiveName)
    || left.path.localeCompare(right.path)
}

function compareModelFormat(left: MmdModelFormat, right: MmdModelFormat): number {
  const rank: Record<MmdModelFormat, number> = { pmx: 0, pmd: 1 }
  return rank[left] - rank[right]
}

function compareDepth(left: string, right: string): number {
  return left.split('/').length - right.split('/').length
}

function compareArchiveNameMatch(left: string, right: string, archiveName: string): number {
  return Number(!matchesArchiveName(left, archiveName)) - Number(!matchesArchiveName(right, archiveName))
}

function matchesArchiveName(path: string, archiveName: string): boolean {
  const archiveStem = stem(basename(archiveName)).toLowerCase()
  if (archiveStem.length === 0) {
    return false
  }

  return stem(basename(path)).toLowerCase() === archiveStem
}

function modelFormatFromPath(path: string): MmdModelFormat | undefined {
  const extension = path.split('.').pop()?.toLowerCase()
  return extension === 'pmx' || extension === 'pmd' ? extension : undefined
}

function basename(path: string): string {
  return path.split('/').at(-1) ?? ''
}

function stem(path: string): string {
  const extensionIndex = path.lastIndexOf('.')
  return extensionIndex === -1 ? path : path.slice(0, extensionIndex)
}

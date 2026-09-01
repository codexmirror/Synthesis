import type { FilesystemFile, FilesystemState } from './types'

export interface DirectoryEntry {
  readonly name: string
  readonly type: 'directory' | 'file'
}

export type ListDirectoryResult =
  | { readonly status: 'ok'; readonly entries: readonly DirectoryEntry[] }
  | { readonly status: 'invalid_path' }
  | { readonly status: 'not_found' }
  | { readonly status: 'not_directory' }

export type ReadTextFileResult =
  | { readonly status: 'ok'; readonly content: string }
  | { readonly status: 'invalid_path' }
  | { readonly status: 'not_found' }
  | { readonly status: 'not_file' }
  | { readonly status: 'not_text_file' }

export type GetFilesystemFileResult =
  | { readonly status: 'ok'; readonly file: FilesystemFile }
  | { readonly status: 'invalid_path' }
  | { readonly status: 'not_found' }
  | { readonly status: 'not_file' }

export type CopyFilesystemFileResult =
  | { readonly status: 'copied'; readonly filesystem: FilesystemState; readonly file: FilesystemFile }
  | { readonly status: 'invalid_path' | 'destination_exists' | 'destination_conflict' }

export type DestinationPlacementStatus = 'ok' | 'invalid_path' | 'destination_exists' | 'destination_conflict'

function normalizeAbsolutePath(path: string): string | undefined {
  if (!path.startsWith('/') || path.includes('//') || path.includes('/./') || path.includes('/../') || path.endsWith('/.') || path.endsWith('/..')) return undefined
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
}

function isDirectory(filesystem: FilesystemState, path: string): boolean {
  if (path === '/') return true
  const prefix = `${path}/`
  return filesystem.files.some((file) => file.path.startsWith(prefix))
}

export function listDirectory(filesystem: FilesystemState, path: string): ListDirectoryResult {
  const normalized = normalizeAbsolutePath(path)
  if (!normalized) return { status: 'invalid_path' }
  if (filesystem.files.some((file) => file.path === normalized)) return { status: 'not_directory' }
  if (!isDirectory(filesystem, normalized)) return { status: 'not_found' }

  const prefix = normalized === '/' ? '/' : `${normalized}/`
  const entries = new Map<string, DirectoryEntry['type']>()
  for (const file of filesystem.files) {
    if (!file.path.startsWith(prefix)) continue
    const remainder = file.path.slice(prefix.length)
    if (!remainder) continue
    const separator = remainder.indexOf('/')
    const name = separator === -1 ? remainder : remainder.slice(0, separator)
    const type = separator === -1 ? 'file' : 'directory'
    if (entries.get(name) !== 'directory') entries.set(name, type)
  }

  return {
    status: 'ok',
    entries: [...entries].map(([name, type]) => ({ name, type })).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

export function readTextFile(filesystem: FilesystemState, path: string): ReadTextFileResult {
  const result = getFilesystemFile(filesystem, path)
  if (result.status !== 'ok') return result
  if (result.file.kind !== 'text') return { status: 'not_text_file' }
  return { status: 'ok', content: result.file.content }
}

export function getFilesystemFile(filesystem: FilesystemState, path: string): GetFilesystemFileResult {
  const normalized = normalizeAbsolutePath(path)
  if (!normalized) return { status: 'invalid_path' }
  const file = filesystem.files.find((candidate) => candidate.path === normalized)
  if (file) return { status: 'ok', file }
  if (isDirectory(filesystem, normalized)) return { status: 'not_file' }
  return { status: 'not_found' }
}

export function getFilesystemFileSizeBytes(file: FilesystemFile): number {
  if (file.kind === 'text') return new TextEncoder().encode(file.content).byteLength
  if (!Number.isSafeInteger(file.sizeBytes) || file.sizeBytes <= 0) {
    throw new RangeError('Represented artifact size must be a positive safe integer')
  }
  return file.sizeBytes
}

/** Compare represented artifact semantics while deliberately excluding concrete copy ID and location. */
export function sameFilesystemArtifactIgnoringPath(a: FilesystemFile, b: FilesystemFile): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'text' && b.kind === 'text') return a.content === b.content
  if (a.kind === 'software_package' && b.kind === 'software_package') {
    return a.releaseId === b.releaseId
      && a.buildId === b.buildId
      && a.productId === b.productId
      && a.name === b.name
      && a.version === b.version
      && a.channel === b.channel
      && a.publisher === b.publisher
      && a.sizeBytes === b.sizeBytes
  }
  if (a.kind === 'software_module' && b.kind === 'software_module') {
    return a.hostProductId === b.hostProductId
      && a.moduleId === b.moduleId
      && a.releaseId === b.releaseId
      && a.buildId === b.buildId
      && a.name === b.name
      && a.version === b.version
      && a.sizeBytes === b.sizeBytes
  }
  if (a.kind === 'executable' && b.kind === 'executable') {
    return a.programId === b.programId
      && a.releaseId === b.releaseId
      && a.buildId === b.buildId
      && a.name === b.name
      && a.version === b.version
      && a.sizeBytes === b.sizeBytes
  }
  if (a.kind === 'rattler_payload' && b.kind === 'rattler_payload') {
    return a.sizeBytes === b.sizeBytes
      && a.rattlerReleaseId === b.rattlerReleaseId
      && a.rattlerBuildId === b.rattlerBuildId
      && a.targetDeviceId === b.targetDeviceId
      && a.targetAddressSnapshot === b.targetAddressSnapshot
  }
  return false
}

/**
 * Validate a destination location against existing collision/conflict rules
 * without allocating or mutating anything. Shared by the copy operation
 * itself and by callers that must confirm a destination stays free across an
 * elapsed interval (e.g. FileTransfer start/completion admission).
 */
export function checkDestinationPlacement(destinationFilesystem: FilesystemState, destinationPath: string): DestinationPlacementStatus {
  const normalized = normalizeAbsolutePath(destinationPath)
  if (!normalized || normalized === '/') return 'invalid_path'
  if (destinationFilesystem.files.some(({ path }) => path === normalized)) return 'destination_exists'
  if (destinationFilesystem.files.some(({ path }) => path.startsWith(`${normalized}/`))) return 'destination_conflict'

  const segments = normalized.slice(1).split('/')
  let ancestor = ''
  for (const segment of segments.slice(0, -1)) {
    ancestor += `/${segment}`
    if (destinationFilesystem.files.some(({ path }) => path === ancestor)) return 'destination_conflict'
  }
  return 'ok'
}

/** Copy one represented file without deriving its semantics from its path. */
export function copyFilesystemFileToPath(sourceFile: FilesystemFile, destinationFilesystem: FilesystemState, destinationPath: string): CopyFilesystemFileResult {
  const placement = checkDestinationPlacement(destinationFilesystem, destinationPath)
  if (placement !== 'ok') return { status: placement }

  getFilesystemFileSizeBytes(sourceFile)
  const allocatedId = `file-${String(destinationFilesystem.nextFileId).padStart(4, '0')}`
  const file = { ...sourceFile, id: allocatedId, path: normalizeAbsolutePath(destinationPath)! }
  return {
    status: 'copied',
    filesystem: { nextFileId: destinationFilesystem.nextFileId + 1, files: [...destinationFilesystem.files, file] },
    file,
  }
}

import type { FilesystemState } from './types'

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
  const normalized = normalizeAbsolutePath(path)
  if (!normalized) return { status: 'invalid_path' }
  const file = filesystem.files.find((candidate) => candidate.path === normalized)
  if (file) return { status: 'ok', content: file.content }
  if (isDirectory(filesystem, normalized)) return { status: 'not_file' }
  return { status: 'not_found' }
}

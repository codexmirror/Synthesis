import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { copyFilesystemFileToPath, getFilesystemFile, getFilesystemFileSizeBytes, listDirectory, readTextFile, sameFilesystemArtifactIgnoringPath } from './filesystem'
import type { ExecutableFile, SoftwarePackageFile, TextFile } from './types'

const filesystem = createInitialGameState().player.localDevice.filesystem
const text: TextFile = { kind: 'text', id: 'file-source', path: '/remote/file.pkg', content: 'same content' }
const packageFile: SoftwarePackageFile = { kind: 'software_package', id: 'file-package', path: '/remote/file.txt', releaseId: 'release-1', productId: 'tool', name: 'Tool', version: '1.2', channel: 'test', sizeBytes: 1_000 }
const executable: ExecutableFile = { kind: 'executable', id: 'file-executable', path: '/remote/tool', programId: 'tool', releaseId: 'tool-1', name: 'Tool', version: '1.0', sizeBytes: 4_096 }

describe('filesystem reads and identity', () => {
  it('derives only direct directory children from canonical paths', () => {
    expect(listDirectory(filesystem, '/')).toEqual({ status: 'ok', entries: [{ name: 'home', type: 'directory' }] })
    expect(listDirectory(filesystem, '/home/user')).toEqual({ status: 'ok', entries: [{ name: 'downloads', type: 'directory' }, { name: 'welcome.txt', type: 'file' }] })
  })

  it('initializes deterministic, stable filesystem-local IDs', () => {
    const first = createInitialGameState()
    const second = createInitialGameState()
    expect(first.player.localDevice.filesystem.files.map(({ id }) => id).every(Boolean)).toBe(true)
    expect(first.world.network.hosts[0].filesystem!.files.map(({ id }) => id)).toEqual(['file-0001', 'file-0002'])
    expect(first.player.localDevice.filesystem).toEqual(second.player.localDevice.filesystem)
  })

  it('reads canonical content and uses explicit kinds rather than extensions', () => {
    expect(readTextFile(filesystem, '/home/user/welcome.txt')).toEqual({ status: 'ok', content: 'Welcome to your local filesystem.' })
    const mixed = { nextFileId: 4, files: [packageFile, { ...packageFile, id: 'file-package-2', path: '/local/copy.txt' }, { ...text, path: '/readable.pkg' }] }
    expect(getFilesystemFile(mixed, '/local/copy.txt')).toEqual({ status: 'ok', file: mixed.files[1] })
    expect(readTextFile(mixed, '/local/copy.txt')).toEqual({ status: 'not_text_file' })
    expect(readTextFile(mixed, '/readable.pkg')).toEqual({ status: 'ok', content: 'same content' })
    expect(getFilesystemFile(mixed, 'release')).toEqual({ status: 'invalid_path' })
  })
})

describe('filesystem sizes', () => {
  it('derives text UTF-8 bytes and returns explicit represented binary sizes', () => {
    expect(getFilesystemFileSizeBytes({ ...text, content: 'ASCII' })).toBe(5)
    expect(getFilesystemFileSizeBytes({ ...text, content: 'café 🚀' })).toBe(10)
    expect(getFilesystemFileSizeBytes(packageFile)).toBe(1_000)
    expect(getFilesystemFileSizeBytes(executable)).toBe(4_096)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])('rejects invalid represented binary size %s', (sizeBytes) => {
    expect(() => getFilesystemFileSizeBytes({ ...packageFile, sizeBytes })).toThrow(RangeError)
    expect(() => getFilesystemFileSizeBytes({ ...executable, sizeBytes })).toThrow(RangeError)
  })
})

describe('filesystem copies', () => {
  it('allocates a new deterministic destination identity while preserving artifact truth', () => {
    const destination = { nextFileId: 42, files: [] }
    const result = copyFilesystemFileToPath(packageFile, destination, '/home/user/downloads/tool.txt')
    expect(result).toMatchObject({ status: 'copied', file: { ...packageFile, id: 'file-0042', path: '/home/user/downloads/tool.txt' }, filesystem: { nextFileId: 43 } })
    if (result.status !== 'copied') throw new Error('expected copy')
    expect(result.file.id).not.toBe(packageFile.id)
    expect(packageFile.id).toBe('file-package')
    expect(sameFilesystemArtifactIgnoringPath(packageFile, result.file)).toBe(true)
    expect(destination).toEqual({ nextFileId: 42, files: [] })
  })

  it('allocates a distinct identity when copying an existing file within one filesystem', () => {
    const source = { ...text, id: 'file-0001', path: '/source.txt' }
    const destination = { nextFileId: 2, files: [source] }
    const result = copyFilesystemFileToPath(source, destination, '/copy.txt')
    expect(result).toMatchObject({
      status: 'copied',
      file: { ...source, id: 'file-0002', path: '/copy.txt' },
      filesystem: { nextFileId: 3 },
    })
    expect(destination).toEqual({ nextFileId: 2, files: [source] })
  })

  it('preserves collision behavior without mutation', () => {
    const existing = { nextFileId: 2, files: [{ ...text, path: '/home/user/downloads/file' }] }
    expect(copyFilesystemFileToPath(text, existing, '/home/user/downloads/file')).toEqual({ status: 'destination_exists' })
    expect(copyFilesystemFileToPath(text, existing, '/home/user/downloads')).toEqual({ status: 'destination_conflict' })
    const blocked = { nextFileId: 2, files: [{ ...text, path: '/home/user/downloads' }] }
    expect(copyFilesystemFileToPath(text, blocked, '/home/user/downloads/file')).toEqual({ status: 'destination_conflict' })
    expect(existing.files).toHaveLength(1)
  })
})

describe('filesystem artifact sameness', () => {
  it('excludes ID and path but compares all represented semantics', () => {
    expect(sameFilesystemArtifactIgnoringPath(text, { ...text, id: 'file-copy', path: '/copy' })).toBe(true)
    expect(sameFilesystemArtifactIgnoringPath(text, { ...text, content: 'different' })).toBe(false)
    expect(sameFilesystemArtifactIgnoringPath(packageFile, { ...packageFile, id: 'copy', path: '/copy' })).toBe(true)
    expect(sameFilesystemArtifactIgnoringPath(packageFile, { ...packageFile, sizeBytes: 2_000 })).toBe(false)
    expect(sameFilesystemArtifactIgnoringPath(packageFile, { ...packageFile, releaseId: 'release-2' })).toBe(false)
    expect(sameFilesystemArtifactIgnoringPath(executable, { ...executable, id: 'copy', path: '/copy' })).toBe(true)
    expect(sameFilesystemArtifactIgnoringPath(executable, { ...executable, programId: 'other' })).toBe(false)
    expect(sameFilesystemArtifactIgnoringPath(executable, { ...executable, sizeBytes: 5_000 })).toBe(false)
  })
})

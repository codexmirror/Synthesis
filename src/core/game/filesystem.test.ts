import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { copyFilesystemFileToPath, getFilesystemFile, listDirectory, readTextFile } from './filesystem'

const filesystem = createInitialGameState().player.localDevice.filesystem

describe('filesystem reads', () => {
  it('derives only direct directory children from canonical file paths', () => {
    expect(listDirectory(filesystem, '/')).toEqual({ status: 'ok', entries: [{ name: 'home', type: 'directory' }] })
    expect(listDirectory(filesystem, '/home')).toEqual({ status: 'ok', entries: [{ name: 'user', type: 'directory' }] })
    expect(listDirectory(filesystem, '/home/user')).toEqual({ status: 'ok', entries: [{ name: 'welcome.txt', type: 'file' }] })
  })

  it('reads canonical content and closes expected failures', () => {
    expect(readTextFile(filesystem, '/home/user/welcome.txt')).toEqual({ status: 'ok', content: 'Welcome to your local filesystem.' })
    expect(readTextFile(filesystem, '/home/user/missing.txt')).toEqual({ status: 'not_found' })
    expect(readTextFile(filesystem, '/home/user')).toEqual({ status: 'not_file' })
    expect(readTextFile(filesystem, 'home/user/welcome.txt')).toEqual({ status: 'invalid_path' })
    expect(listDirectory(createInitialGameState().world.network.hosts[0].filesystem!, '/opt')).toEqual({ status: 'ok', entries: [{ name: 'packages', type: 'directory' }] })
    expect(listDirectory(createInitialGameState().world.network.hosts[0].filesystem!, '/opt/packages')).toEqual({ status: 'ok', entries: [{ name: 'nodescan-exp-1.1.pkg', type: 'file' }] })
  })

  it('resolves represented files and reads only explicitly discriminated text', () => {
    const files = { files: [
      { kind: 'software_package' as const, path: '/remote/nodescan.pkg', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental' },
      { kind: 'software_package' as const, path: '/local/nodescan-copy.txt', releaseId: 'nodescan-1.1-experimental', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental' },
      { kind: 'text' as const, path: '/readable.pkg', content: 'Still text.' },
    ] }
    expect(getFilesystemFile(files, '/remote/nodescan.pkg')).toEqual({ status: 'ok', file: files.files[0] })
    expect(getFilesystemFile(files, '/local/nodescan-copy.txt')).toEqual({ status: 'ok', file: files.files[1] })
    expect(files.files[0].releaseId).toBe(files.files[1].releaseId)
    expect(getFilesystemFile(files, '/')).toEqual({ status: 'not_file' })
    expect(getFilesystemFile(files, 'release')).toEqual({ status: 'invalid_path' })
    expect(readTextFile(files, '/missing')).toEqual({ status: 'not_found' })
    expect(readTextFile(files, '/local')).toEqual({ status: 'not_file' })
    expect(readTextFile(files, '/local/nodescan-copy.txt')).toEqual({ status: 'not_text_file' })
    expect(readTextFile(files, '/readable.pkg')).toEqual({ status: 'ok', content: 'Still text.' })
  })
})

describe('filesystem copies', () => {
  it('preserves text and package semantics while changing only the path', () => {
    const text = { kind: 'text' as const, path: '/remote/readme.pkg', content: 'Canonical text.' }
    const packageFile = { kind: 'software_package' as const, path: '/remote/tool.txt', releaseId: 'release-1', productId: 'tool', name: 'Tool', version: '1.2', channel: 'test' }
    const first = copyFilesystemFileToPath(text, { files: [] }, '/home/user/downloads/readme.pkg')
    expect(first).toEqual({ status: 'copied', filesystem: { files: [{ ...text, path: '/home/user/downloads/readme.pkg' }] }, file: { ...text, path: '/home/user/downloads/readme.pkg' } })
    if (first.status !== 'copied') throw new Error('expected copy')
    const second = copyFilesystemFileToPath(packageFile, first.filesystem, '/home/user/downloads/tool.txt')
    expect(second).toMatchObject({ status: 'copied', file: { ...packageFile, path: '/home/user/downloads/tool.txt' } })
    expect(text).toEqual({ kind: 'text', path: '/remote/readme.pkg', content: 'Canonical text.' })
    expect(packageFile.releaseId).toBe('release-1')
  })

  it('rejects existing destinations, derived directories, and blocking ancestors without mutation', () => {
    const source = { kind: 'text' as const, path: '/source', content: 'new' }
    const existing = { files: [{ kind: 'text' as const, path: '/home/user/downloads/file', content: 'old' }] }
    expect(copyFilesystemFileToPath(source, existing, '/home/user/downloads/file')).toEqual({ status: 'destination_exists' })
    expect(copyFilesystemFileToPath(source, existing, '/home/user/downloads')).toEqual({ status: 'destination_conflict' })
    const blocked = { files: [{ kind: 'text' as const, path: '/home/user/downloads', content: 'block' }] }
    expect(copyFilesystemFileToPath(source, blocked, '/home/user/downloads/file')).toEqual({ status: 'destination_conflict' })
    expect(existing.files).toHaveLength(1); expect(blocked.files).toHaveLength(1)
  })
})

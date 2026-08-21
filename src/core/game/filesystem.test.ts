import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { getFilesystemFile, listDirectory, readTextFile } from './filesystem'

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
      { kind: 'software_package' as const, path: '/release', packageId: 'package-1', productId: 'product-1', name: 'Altered', version: '9.2', channel: 'preview' },
      { kind: 'text' as const, path: '/readable.pkg', content: 'Still text.' },
    ] }
    expect(getFilesystemFile(files, '/release')).toEqual({ status: 'ok', file: files.files[0] })
    expect(getFilesystemFile(files, '/')).toEqual({ status: 'not_file' })
    expect(getFilesystemFile(files, 'release')).toEqual({ status: 'invalid_path' })
    expect(readTextFile(files, '/release')).toEqual({ status: 'not_text_file' })
    expect(readTextFile(files, '/readable.pkg')).toEqual({ status: 'ok', content: 'Still text.' })
  })
})

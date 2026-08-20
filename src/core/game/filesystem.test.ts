import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { listDirectory, readTextFile } from './filesystem'

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
  })
})

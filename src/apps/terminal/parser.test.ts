import { describe, expect, it } from 'vitest'
import { parseCommand } from './parser'

describe('parseCommand', () => {
  it('parses a command without arguments', () => {
    expect(parseCommand('help')).toEqual({ raw: 'help', name: 'help', args: [] })
  })

  it('trims input and normalizes command case', () => {
    expect(parseCommand('  STATUS  ')).toEqual({ raw: 'STATUS', name: 'status', args: [] })
  })

  it('separates arguments across repeated whitespace', () => {
    expect(parseCommand('probe   198.51.100.42')).toEqual({
      raw: 'probe   198.51.100.42',
      name: 'probe',
      args: ['198.51.100.42'],
    })
  })
})

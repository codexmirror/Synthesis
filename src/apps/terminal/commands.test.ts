import { describe, expect, it } from 'vitest'
import { initialGameState } from '../../core/game/initialState'
import { dispatchCommand } from './commands'
import { parseCommand } from './parser'

const dispatch = (input: string) => dispatchCommand(parseCommand(input), { state: initialGameState })

describe('command dispatcher', () => {
  it('dispatches help', () => {
    const result = dispatch('help')
    expect(result.type).toBe('output')
    if (result.type === 'output') expect(result.lines).toContain('Available commands:')
  })
  it('dispatches ip', () => expect(dispatch('ip')).toEqual({ type: 'output', lines: ['Local address: 198.51.100.23'] }))
  it('dispatches status', () => expect(dispatch('status')).toEqual({ type: 'output', lines: ['CPU: 18%', 'RAM: 23%', 'Network: ONLINE'] }))
  it('reports unknown commands', () => expect(dispatch('probe target')).toMatchObject({ type: 'output', lines: [expect.stringContaining('Command not found: probe')] }))
  it('dispatches clear as a structured result', () => expect(dispatch('clear')).toEqual({ type: 'clear' }))
})

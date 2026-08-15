import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { commands, dispatchCommand, type CommandContext } from './commands'
import { parseCommand } from './parser'

const state = createInitialGameState()
const context: CommandContext = {
  player: { ip: state.player.ip },
  runtime: { ...state.system.runtime },
}
const dispatch = (input: string) => dispatchCommand(parseCommand(input), context)

describe('command dispatcher', () => {
  it('derives help output from the command registry', () => {
    const result = dispatch('help')
    expect(result.type).toBe('output')
    if (result.type === 'output') {
      expect(result.lines.filter(Boolean).slice(1)).toEqual(Object.keys(commands))
    }
  })
  it('dispatches ip with the narrowed context', () => expect(dispatch('ip')).toEqual({ type: 'output', lines: ['Local address: 198.51.100.23'] }))
  it('dispatches status with the narrowed context', () => expect(dispatch('status')).toEqual({ type: 'output', lines: ['CPU: 18%', 'RAM: 23%', 'Network: ONLINE'] }))
  it('reports unknown commands', () => expect(dispatch('probe target')).toMatchObject({ type: 'output', lines: [expect.stringContaining('Command not found: probe')] }))
  it('dispatches clear as a structured result', () => expect(dispatch('clear')).toEqual({ type: 'clear' }))
})

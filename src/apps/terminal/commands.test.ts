import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import type { CommandContext } from './commandTypes'
import { clearCommand } from './commands/clear'
import { createHelpCommand } from './commands/help'
import { ipCommand } from './commands/ip'
import { statusCommand } from './commands/status'
import { parseCommand } from './parser'
import { commands, dispatchCommand } from './registry'

const state = createInitialGameState()
const context: CommandContext = {
  player: { ip: state.player.ip },
  runtime: { ...state.system.runtime },
}
const dispatch = (input: string) => dispatchCommand(parseCommand(input), context)

describe('command dispatcher', () => {
  it('registers every current public command exactly once', () => {
    expect(Object.keys(commands)).toEqual(['help', 'clear', 'ip', 'status'])
    expect(new Set(Object.values(commands)).size).toBe(4)
  })

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
  it('preserves empty command dispatch behavior', () => expect(dispatch('')).toEqual({ type: 'output', lines: [] }))
  it('dispatches clear as a structured result', () => expect(dispatch('clear')).toEqual({ type: 'clear' }))
})

describe('individual commands', () => {
  it('builds help output from the supplied registry names', () => {
    const help = createHelpCommand(() => ['help', 'local-command'])
    expect(help.run(context, [])).toEqual({
      type: 'output',
      lines: ['Available commands:', '', 'help', 'local-command'],
    })
  })

  it('returns a structured clear result', () => {
    expect(clearCommand.run(context, [])).toEqual({ type: 'clear' })
  })

  it('reads the player address for ip output', () => {
    const narrowContext = { ...context, player: { ip: '203.0.113.7' } }
    expect(ipCommand.run(narrowContext, [])).toEqual({ type: 'output', lines: ['Local address: 203.0.113.7'] })
  })

  it('reads runtime utilization for status output', () => {
    const narrowContext: CommandContext = {
      ...context,
      runtime: { cpuLoad: 4, ramUsage: 12, networkStatus: 'OFFLINE' },
    }
    expect(statusCommand.run(narrowContext, [])).toEqual({
      type: 'output',
      lines: ['CPU: 4%', 'RAM: 12%', 'Network: OFFLINE'],
    })
  })
})

import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import type { CommandContext } from './commandTypes'
import { clearCommand } from './commands/clear'
import { createHelpCommand } from './commands/help'
import { ipCommand } from './commands/ip'
import { statusCommand } from './commands/status'
import { scanCommand } from './commands/scan'
import { inspectCommand } from './commands/inspect'
import { scanNetworkTarget } from '../../core/game/scan'
import { inspectNetworkTarget } from '../../core/game/inspect'
import { parseCommand } from './parser'
import { commands, dispatchCommand } from './registry'

const state = createInitialGameState()
const context: CommandContext = {
  localDevice: { ip: state.player.localDevice.network.ip },
  runtime: { ...state.player.localDevice.runtime },
  operations: {
    scanTarget: (target) => scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, target),
    inspectTarget: (target) => inspectNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, target),
  },
}
const dispatch = (input: string) => dispatchCommand(parseCommand(input), context)

describe('command dispatcher', () => {
  it('registers every current public command exactly once', () => {
    expect(Object.keys(commands)).toEqual(['help', 'clear', 'ip', 'status', 'scan', 'inspect'])
    expect(Object.keys(commands).filter((name) => name === 'scan')).toHaveLength(1)
    expect(Object.keys(commands).filter((name) => name === 'inspect')).toHaveLength(1)
    expect(new Set(Object.values(commands)).size).toBe(6)
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
  it('guides missing and extra scan arguments', () => {
    expect(dispatch('scan')).toEqual({ type: 'output', lines: ['Usage: scan <ipv4>'] })
    expect(dispatch('scan 203.0.113.42 extra')).toEqual({ type: 'output', lines: ['Usage: scan <ipv4>'] })
  })
  it('renders invalid, online, offline, and valid unknown scan observations', () => {
    expect(dispatch('scan 999.999.999.999')).toEqual({ type: 'output', lines: ['Invalid target: 999.999.999.999'] })
    expect(dispatch('scan 203.0.113.42')).toEqual({ type: 'output', lines: ['Scanning 203.0.113.42...', '', 'HOST ONLINE', 'Address: 203.0.113.42', 'Scope:   REMOTE'] })
    expect(dispatch('scan 203.0.113.99')).toEqual({ type: 'output', lines: ['Scanning 203.0.113.99...', '', 'NO RESPONSE'] })
    expect(dispatch('scan 192.0.2.10')).toEqual({ type: 'output', lines: ['Scanning 192.0.2.10...', '', 'NO RESPONSE'] })
  })
  it('renders local scope when scanning the current device', () => {
    expect(dispatch('scan 198.51.100.23')).toEqual({
      type: 'output',
      lines: ['Scanning 198.51.100.23...', '', 'HOST ONLINE', 'Address: 198.51.100.23', 'Scope:   LOCAL'],
    })
  })

  it('renders no response when the local device is offline', () => {
    const offlineDevice = {
      ...state.player.localDevice,
      runtime: { ...state.player.localDevice.runtime, networkStatus: 'OFFLINE' as const },
    }
    const offlineContext: CommandContext = {
      ...context,
      operations: {
        ...context.operations,
        scanTarget: (target) => scanNetworkTarget({ localDevice: offlineDevice, network: state.world.network }, target),
      },
    }
    expect(dispatchCommand(parseCommand('scan 198.51.100.23'), offlineContext)).toEqual({
      type: 'output', lines: ['Scanning 198.51.100.23...', '', 'NO RESPONSE'],
    })
  })

  it('guides missing and extra inspect arguments and rejects invalid targets', () => {
    expect(dispatch('inspect')).toEqual({ type: 'output', lines: ['Usage: inspect <ipv4>'] })
    expect(dispatch('inspect 203.0.113.42 extra')).toEqual({ type: 'output', lines: ['Usage: inspect <ipv4>'] })
    expect(dispatch('inspect invalid')).toEqual({ type: 'output', lines: ['Invalid target: invalid'] })
  })

  it('renders state-derived local inspection and supported remote truth', () => {
    expect(dispatch('inspect 198.51.100.23')).toEqual({ type: 'output', lines: [
      'TARGET', 'Address: 198.51.100.23', 'Scope:   LOCAL', 'Status:  ONLINE', 'CPU:     Basic CPU', 'RAM:     4 GB',
      'Network: home-net',
    ] })
    expect(dispatch('inspect 203.0.113.42')).toEqual({ type: 'output', lines: [
      'TARGET', 'Address: 203.0.113.42', 'Scope:   REMOTE', 'Status:  ONLINE',
    ] })
  })

  it('keeps network names outside the IPv4-only inspect and scan grammars', () => {
    expect(dispatch('inspect home-net')).toEqual({ type: 'output', lines: ['Invalid target: home-net'] })
    expect(dispatch('scan home-net')).toEqual({ type: 'output', lines: ['Invalid target: home-net'] })
  })

  it('does not reveal whether inspect targets are offline or unknown', () => {
    expect(dispatch('inspect 203.0.113.99')).toEqual({ type: 'output', lines: ['NO RESPONSE'] })
    expect(dispatch('inspect 192.0.2.10')).toEqual({ type: 'output', lines: ['NO RESPONSE'] })
  })
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
    const narrowContext = { ...context, localDevice: { ip: '203.0.113.7' } }
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

  it('delegates scan rules through the narrow operation dependency', () => {
    const scanTarget = vi.fn(() => ({ status: 'no_response' as const, address: '203.0.113.42' }))
    expect(scanCommand.run({ ...context, operations: { ...context.operations, scanTarget } }, ['203.0.113.42'])).toEqual({
      type: 'output', lines: ['Scanning 203.0.113.42...', '', 'NO RESPONSE'],
    })
    expect(scanTarget).toHaveBeenCalledExactlyOnceWith('203.0.113.42')
  })

  it('delegates inspect rules through only the narrow operation dependency', () => {
    const inspectTarget = vi.fn(() => ({
      status: 'reachable' as const, targetId: 'changed-device', address: '192.0.2.44', scope: 'local' as const, networkStatus: 'ONLINE' as const,
      hardware: { cpu: 'Changed CPU', ram: '12 GB' },
    }))
    expect(inspectCommand.run({ ...context, operations: { ...context.operations, inspectTarget } }, ['192.0.2.44'])).toEqual({
      type: 'output',
      lines: ['TARGET', 'Address: 192.0.2.44', 'Scope:   LOCAL', 'Status:  ONLINE', 'CPU:     Changed CPU', 'RAM:     12 GB'],
    })
    expect(inspectTarget).toHaveBeenCalledExactlyOnceWith('192.0.2.44')
  })
})

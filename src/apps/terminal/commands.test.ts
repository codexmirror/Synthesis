import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { target, text, type CommandContext } from './commandTypes'
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
  runtime: { cpuLoad: 18, ramUsage: 23, networkStatus: state.player.localDevice.runtime.networkStatus },
  operations: {
    scanTarget: (target) => scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, target),
    inspectTarget: (target) => inspectNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, target),
  },
}
const dispatch = (input: string) => dispatchCommand(parseCommand(input), context)
const labeledTarget = (label: string, value: string) => [text(label), target(value)]

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
  it('describes the Scan and Inspect semantic distinction concisely', () => {
    expect(commands.scan.description).toBe('Discover relationships and connected targets')
    expect(commands.inspect.description).toBe('Show properties of one target')
  })
  it('dispatches ip with the player-visible address marked as a target', () => expect(dispatch('ip')).toEqual({ type: 'output', lines: [labeledTarget('Local address: ', '198.51.100.23')] }))
  it('dispatches status with the narrowed context', () => expect(dispatch('status')).toEqual({ type: 'output', lines: ['CPU: 18%', 'RAM: 23%', 'Network: ONLINE'] }))
  it('reports unknown commands', () => expect(dispatch('probe target')).toMatchObject({ type: 'output', lines: [expect.stringContaining('Command not found: probe')] }))
  it('preserves empty command dispatch behavior', () => expect(dispatch('')).toEqual({ type: 'output', lines: [] }))
  it('dispatches clear as a structured result', () => expect(dispatch('clear')).toEqual({ type: 'clear' }))
  it('guides missing and extra scan arguments', () => {
    expect(dispatch('scan')).toEqual({ type: 'output', lines: ['Usage: scan <ipv4|network-name>'] })
    expect(dispatch('scan 203.0.113.42 extra')).toEqual({ type: 'output', lines: ['Usage: scan <ipv4|network-name>'] })
  })
  it('renders invalid, online, offline, and valid unknown scan observations', () => {
    expect(dispatch('scan 999.999.999.999')).toEqual({ type: 'output', lines: ['Unknown scan target: 999.999.999.999'] })
    expect(dispatch('scan 203.0.113.42')).toEqual({ type: 'output', lines: ['Scanning 203.0.113.42...', '', 'NO RELATIONSHIPS OR SERVICES FOUND'] })
    expect(dispatch('scan 203.0.113.99')).toEqual({ type: 'output', lines: ['Scanning 203.0.113.99...', '', 'NO RESPONSE'] })
    expect(dispatch('scan 192.0.2.10')).toEqual({ type: 'output', lines: ['Scanning 192.0.2.10...', '', 'NO RESPONSE'] })
  })
  it('renders local scope when scanning the current device', () => {
    expect(dispatch('scan 198.51.100.23')).toEqual({
      type: 'output',
      lines: ['Scanning 198.51.100.23...', '', 'RELATIONSHIPS FOUND: 1', '', labeledTarget('Network: ', 'home-net'), '', 'SERVICES FOUND: 0'],
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
    expect(dispatch('inspect')).toEqual({ type: 'output', lines: ['Usage: inspect <ipv4|network-name>'] })
    expect(dispatch('inspect 203.0.113.42 extra')).toEqual({ type: 'output', lines: ['Usage: inspect <ipv4|network-name>'] })
    expect(dispatch('inspect invalid')).toEqual({ type: 'output', lines: ['Unknown inspect target: invalid'] })
  })

  it('renders state-derived local inspection and supported remote truth', () => {
    expect(dispatch('inspect 198.51.100.23')).toEqual({ type: 'output', lines: [
      'DEVICE', labeledTarget('Address: ', '198.51.100.23'), 'Scope:   SELF', 'Status:  ONLINE', 'CPU:     Basic CPU', 'RAM:     4 GB',
    ] })
    expect(dispatch('inspect 203.0.113.42')).toEqual({ type: 'output', lines: [
      'DEVICE', labeledTarget('Address: ', '203.0.113.42'), 'Scope:   REMOTE', 'Status:  ONLINE',
    ] })
    expect(dispatch('inspect 198.51.100.47')).toEqual({ type: 'output', lines: [
      'SERVER', labeledTarget('Address: ', '198.51.100.47'), 'Scope:   LAN', 'Status:  ONLINE',
    ] })
  })

  it('renders server services without exposing IDs or making service facts Target Tokens', () => {
    const inspection = dispatch('inspect 198.51.100.47')
    expect(JSON.stringify(inspection)).not.toMatch(/service-ssh-001|host-lan-001|CPU|RAM|SSH/)

    const output = dispatch('scan 198.51.100.47')
    expect(output).toEqual({ type: 'output', lines: [
      'Scanning 198.51.100.47...', '', 'RELATIONSHIPS FOUND: 1', '', labeledTarget('Network: ', 'home-net'),
      '', 'SERVICES FOUND: 1', '', 'SSH', 'Port: 22', 'Protocol: TCP',
    ] })
    expect(JSON.stringify(output)).not.toMatch(/service-ssh-001|host-lan-001/)
    if (output.type === 'output') {
      expect(output.lines.flatMap((line) => typeof line === 'string' ? [] : line).filter(({ type }) => type === 'target'))
        .toEqual([target('home-net')])
    }
  })

  it('scans and inspects real network names without exposing stable IDs', () => {
    const inspection = dispatch('inspect home-net')
    expect(inspection).toEqual({ type: 'output', lines: ['NETWORK', labeledTarget('Name: ', 'home-net'), 'Connected: YES'] })
    expect(JSON.stringify(inspection)).not.toMatch(/network-local-001|device-local-v0|host-lan-001/)
    const output = dispatch('scan home-net')
    expect(output).toEqual({ type: 'output', lines: ['Scanning home-net...', '', 'DEVICES FOUND: 2', '', [target('198.51.100.23')], [target('198.51.100.47')]] })
    expect(JSON.stringify(output)).not.toMatch(/network-local-001|device-local-v0|host-lan-001/)
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
    expect(ipCommand.run(narrowContext, [])).toEqual({ type: 'output', lines: [labeledTarget('Local address: ', '203.0.113.7')] })
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
      status: 'device' as const, targetId: 'changed-device', address: '192.0.2.44', scope: 'self' as const, networkStatus: 'ONLINE' as const,
      hardware: { cpu: 'Changed CPU', ram: '12 GB' },
    }))
    expect(inspectCommand.run({ ...context, operations: { ...context.operations, inspectTarget } }, ['192.0.2.44'])).toEqual({
      type: 'output',
      lines: ['DEVICE', labeledTarget('Address: ', '192.0.2.44'), 'Scope:   SELF', 'Status:  ONLINE', 'CPU:     Changed CPU', 'RAM:     12 GB'],
    })
    expect(inspectTarget).toHaveBeenCalledExactlyOnceWith('192.0.2.44')
  })
})

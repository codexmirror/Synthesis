import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from '../../core/game/initialState'
import { target, text, type CommandContext, type CommandResult } from './commandTypes'
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
import { listDirectory, readTextFile } from '../../core/game/filesystem'

const state = createInitialGameState()
// @ts-expect-error Implemented Terminal operations are required integration contracts.
const invalidContext: CommandContext = { localDevice: { ip: '198.51.100.23', installedSoftware: [] }, runtime: { cpuLoad: 0, ramUsage: 0, networkStatus: 'ONLINE' }, operations: {} }
void invalidContext
const context: CommandContext = {
  localDevice: { ip: state.player.localDevice.network.ip, installedSoftware: state.player.localDevice.installedSoftware },
  runtime: { cpuLoad: 18, ramUsage: 23, networkStatus: state.player.localDevice.runtime.networkStatus },
  filesystem: {
    list: (path) => listDirectory(state.player.localDevice.filesystem, path),
    readText: (path) => readTextFile(state.player.localDevice.filesystem, path),
  },
  nodeMiner: { available: false },
  operations: {
    scanTarget: (target) => scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, target),
    inspectTarget: (target) => inspectNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, target),
    analyzeEndpoint: () => ({ status: 'endpoint_not_found' }),
    knownWeaknesses: () => [],
    attackEndpoint: () => ({ status: 'not_available' }),
    connectAddress: () => ({ status: 'target_not_known' }),
    disconnectRemote: () => ({ status: 'not_connected' }),
    installLocalSoftwarePackage: () => ({ status: 'package_not_found' }),
    nodeMiner: { run: () => ({ status: 'unavailable' }), status: () => ({ status: 'idle' }), stop: () => ({ status: 'not_running' }), payout: () => ({ status: 'not_running' }), configurePayout: () => ({ status: 'not_running' }) },
  },
}
const dispatch = (input: string) => dispatchCommand(parseCommand(input), context) as CommandResult
const labeledTarget = (label: string, value: string, scope: 'local' | 'external' = 'external') => [text(label), target(value, scope)]

describe('command dispatcher', () => {
  it('registers every current public command exactly once', () => {
    expect(Object.keys(commands)).toEqual(['help', 'clear', 'ip', 'status', 'ping', 'scan', 'inspect', 'analyze', 'attack', 'ls', 'cat', 'install', 'connect', 'disconnect', 'node-miner'])
    expect(Object.keys(commands).filter((name) => name === 'scan')).toHaveLength(1)
    expect(new Set(Object.values(commands)).size).toBe(15)
  })

  it('groups current commands by their concrete provider', () => {
    const result = dispatch('help')
    expect(result.type).toBe('output')
    if (result.type === 'output') {
      expect(result.lines).toEqual([
        'AVAILABLE COMMANDS', '', 'NODE-OS', '',
        'help — List available commands', 'clear — Clear terminal output', 'ip — Show local address',
        'status — Show system status', 'ls — List a local absolute directory path',
        'cat — Read a local text file by absolute path',
        'install — <local-absolute-file-path>  Install a local software package',
        'connect — <ipv4>  Open a remote session using established access', 'disconnect — Close the active remote session',
        '', 'NODESCAN 1.0 STANDARD', '', 'ping — Check whether a Device responds at an IPv4 address', 'scan — Discover devices, relationships, and exposed services',
        'analyze — Investigate a service endpoint', '', 'BASIC CREDENTIAL TOOLKIT 1.0', '',
        'attack — Attempt a known attack method against an observed service',
      ])
    }
  })
  it('derives provider help from installed software and omits absent providers', () => {
    const nodeScanOnly = { ...context, localDevice: { ...context.localDevice, installedSoftware: [{ id: 'nodescan' as const, releaseId: 'opaque-preview', name: 'NodeScan', version: '2.4', channel: 'preview' }] } }
    expect(JSON.stringify(dispatchCommand(parseCommand('help'), nodeScanOnly))).toContain('NODESCAN 2.4 PREVIEW')
    expect(JSON.stringify(dispatchCommand(parseCommand('help'), nodeScanOnly))).not.toContain('BASIC CREDENTIAL TOOLKIT')
    expect(JSON.stringify(dispatchCommand(parseCommand('help'), nodeScanOnly))).not.toContain('inspect —')
    const experimental = { ...context, localDevice: { ...context.localDevice, installedSoftware: [{ id: 'nodescan' as const, releaseId: 'nodescan-1.1-experimental', name: 'NodeScan', version: '1.1', channel: 'experimental' }] } }
    expect(JSON.stringify(dispatchCommand(parseCommand('help'), experimental))).toContain('inspect —')
    const builtInsOnly = { ...context, localDevice: { ...context.localDevice, installedSoftware: [] } }
    const help = JSON.stringify(dispatchCommand(parseCommand('help'), builtInsOnly))
    expect(help).not.toContain('NODESCAN')
    expect(help).not.toContain('BASIC CREDENTIAL TOOLKIT')
  })
  it('describes the public operational commands concisely', () => {
    expect(commands.scan.description).toBe('Discover devices, relationships, and exposed services')
    expect(commands.analyze.description).toBe('Investigate a service endpoint')
    expect(commands.attack.description).toBe('Attempt a known attack method against an observed service')
    expect(commands.connect.description).toBe('<ipv4>  Open a remote session using established access')
    expect(commands.disconnect.description).toBe('Close the active remote session')
  })
  it('dispatches inspect as a direct player verb', () => {
    expect(dispatch('inspect 198.51.100.47')).toMatchObject({ type: 'output', lines: ['SERVER', expect.any(Array), 'Scope:   LAN', 'Status:  ONLINE'] })
  })
  it('dispatches ip with the player-visible address marked as a local target', () => expect(dispatch('ip')).toEqual({ type: 'output', lines: [labeledTarget('Local address: ', '198.51.100.23', 'local')] }))
  it('dispatches status with the narrowed context', () => expect(dispatch('status')).toEqual({ type: 'output', lines: ['CPU: 18%', 'RAM: 23%', 'Network: ONLINE'] }))
  it('reports unknown commands', () => expect(dispatch('probe target')).toMatchObject({ type: 'output', lines: [expect.stringContaining('Command not found: probe')] }))
  it('preserves empty command dispatch behavior', () => expect(dispatch('')).toEqual({ type: 'output', lines: [] }))
  it('reads altered filesystem state through narrow ls and cat operations', () => {
    const filesystem = { nextFileId: 2, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/home/user/proof.txt', content: 'line one\nline two\nline three' }] }
    const filesystemContext: CommandContext = {
      ...context,
      filesystem: {
        list: (path) => listDirectory(filesystem, path),
        readText: (path) => readTextFile(filesystem, path),
      },
    }
    const run = (input: string) => dispatchCommand(parseCommand(input), filesystemContext)
    expect(run('ls /')).toEqual({ type: 'output', lines: ['home/'] })
    expect(run('ls /home')).toEqual({ type: 'output', lines: ['user/'] })
    expect(run('ls /home/user')).toEqual({ type: 'output', lines: ['proof.txt'] })
    expect(run('cat /home/user/proof.txt')).toEqual({ type: 'output', lines: ['line one', 'line two', 'line three'] })
    expect(run('cat /home/user/missing.txt')).toEqual({ type: 'output', lines: ['FILE NOT FOUND'] })
  })
  it('dispatches clear as a structured result', () => expect(dispatch('clear')).toEqual({ type: 'clear' }))
  it('delegates install through the shared narrow operation and presents canonical results', () => {
    const installLocalSoftwarePackage = vi.fn(() => ({ status: 'started' as const, processId: 'process-0001', productId: 'nodescan' as const, name: 'Canonical Scanner', version: '1.1', channel: 'experimental' }))
    const installContext = { ...context, operations: { ...context.operations, installLocalSoftwarePackage } }
    expect(dispatchCommand(parseCommand('install /home/user/package.bin'), installContext)).toEqual({ type: 'output', lines: ['INSTALLING', 'Canonical Scanner 1.1 Experimental', 'PROCESS process-0001'] })
    expect(installLocalSoftwarePackage).toHaveBeenCalledExactlyOnceWith('/home/user/package.bin')
    expect(dispatchCommand(parseCommand('install'), installContext)).toEqual({ type: 'output', lines: ['Usage: install <local-absolute-file-path>'] })

    const unrecognized = { ...context, operations: { ...context.operations, installLocalSoftwarePackage: () => ({ status: 'unrecognized_package_extension' as const }) } }
    expect(dispatchCommand(parseCommand('install /home/user/downloads/node-miner-1.0.pkd'), unrecognized)).toEqual({ type: 'output', lines: ['UNRECOGNIZED PACKAGE EXTENSION'] })
  })
  it('guides missing and extra scan arguments', () => {
    expect(dispatch('scan')).toEqual({ type: 'output', lines: ['Usage: scan <ipv4|network-name>'] })
    expect(dispatch('scan 203.0.113.42 extra')).toEqual({ type: 'output', lines: ['Usage: scan <ipv4|network-name>'] })
    expect(JSON.stringify(dispatch('scan 192.0.2.77:443'))).toContain('service endpoint')
  })
  it('validates analyze syntax and delegates through the narrow operation', () => {
    expect(dispatch('analyze')).toEqual({ type: 'output', lines: ['Usage: analyze <ipv4:port>'] })
    const analyzeEndpoint = vi.fn(() => ({ status: 'started' as const, processId: 'process-9' }))
    const result = dispatchCommand(parseCommand('analyze 198.51.100.47:22'), { ...context, operations: { ...context.operations, analyzeEndpoint } })
    expect(analyzeEndpoint).toHaveBeenCalledExactlyOnceWith('198.51.100.47:22')
    expect(result).toEqual({ type: 'process', processId: 'process-9' })
  })
  it('distinguishes missing NodeScan from an unavailable analysis target', () => {
    const run = (status: 'software_unavailable' | 'unavailable') => dispatchCommand(parseCommand('analyze 198.51.100.47:22'), {
      ...context,
      operations: { ...context.operations, analyzeEndpoint: () => ({ status }) },
    })
    expect(run('software_unavailable')).toEqual({ type: 'output', lines: ['NODESCAN NOT INSTALLED'] })
    expect(run('unavailable')).toEqual({ type: 'output', lines: ['SERVICE UNAVAILABLE'] })
    expect(JSON.stringify(run('unavailable'))).not.toContain('NODESCAN NOT INSTALLED')
  })
  it('validates attack targets, delegates once, and maps shared operation results', () => {
    expect(dispatch('attack home-net')).toEqual({ type: 'output', lines: ['Usage: attack <ipv4:port>', 'Attack requires an observed service endpoint.'] })
    expect(dispatch('attack 198.51.100.47')).toEqual({ type: 'output', lines: ['Usage: attack <ipv4:port>', 'Attack requires an observed service endpoint.'] })
    const cases = [
      [{ status: 'started' as const, processId: 'process-9' }, null],
      [{ status: 'already_running' as const }, ['ATTEMPT ALREADY RUNNING']],
      [{ status: 'access_established' as const }, ['ACCESS ALREADY ESTABLISHED']],
      [{ status: 'insufficient_memory' as const, requiredMiB: 896, availableMiB: 539.4 }, ['INSUFFICIENT MEMORY', '896 MiB required', '539 MiB available']],
      [{ status: 'endpoint_not_found' as const }, ['ENDPOINT NOT AVAILABLE']],
      [{ status: 'not_available' as const }, ['NO KNOWN ATTACK METHOD']],
    ] as const
    for (const [operationResult, lines] of cases) {
      const attackEndpoint = vi.fn(() => operationResult)
      const expected = lines === null ? { type: 'process', processId: 'process-9' } : { type: 'output', lines }
      expect(dispatchCommand(parseCommand('attack 198.51.100.47:22'), { ...context, operations: { ...context.operations, attackEndpoint } })).toEqual(expected)
      expect(attackEndpoint).toHaveBeenCalledExactlyOnceWith('198.51.100.47:22')
    }
  })
  it('renders invalid, online, offline, and valid unknown scan observations', () => {
    expect(dispatch('scan 999.999.999.999')).toEqual({ type: 'output', lines: ['Unknown scan target: 999.999.999.999'] })
    expect(dispatch('scan 203.0.113.42')).toEqual({ type: 'output', lines: ['Scanning 203.0.113.42...', '', 'RELATIONSHIPS FOUND: 0', '', 'SERVICES FOUND: 2', '', 'SSH', labeledTarget('Endpoint: ', '203.0.113.42:22'), 'Protocol: TCP', '', 'RackUpdate', labeledTarget('Endpoint: ', '203.0.113.42:8443'), 'Protocol: TCP'] })
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

  it('renders server services without exposing IDs or making service facts Target Tokens', () => {
    const output = dispatch('scan 198.51.100.47')
    expect(output).toEqual({ type: 'output', lines: [
      'Scanning 198.51.100.47...', '', 'RELATIONSHIPS FOUND: 0',
      '', 'SERVICES FOUND: 2', '', 'SSH', labeledTarget('Endpoint: ', '198.51.100.47:22'), 'Protocol: TCP', '', 'HTTP', labeledTarget('Endpoint: ', '198.51.100.47:80'), 'Protocol: TCP',
    ] })
    expect(JSON.stringify(output)).not.toMatch(/service-ssh-001|host-lan-001/)
    if (output.type === 'output') {
      expect(output.lines.flatMap((line) => typeof line === 'string' ? [] : line).filter(({ type }) => type === 'target'))
        .toEqual([target('198.51.100.47:22'), target('198.51.100.47:80')])
    }
  })

  it('scans real network names without exposing stable IDs', () => {
    const output = dispatch('scan home-net')
    expect(output).toEqual({ type: 'output', lines: ['Scanning home-net...', '', 'DEVICES FOUND: 2', '', [target('198.51.100.23', 'local')], [target('198.51.100.47')]] })
    expect(JSON.stringify(output)).not.toMatch(/network-local-001|device-local-v0|host-lan-001|host-phone-001/)
  })

})

describe('individual commands', () => {
  it('builds help output from the supplied registry names', () => {
    const help = createHelpCommand(() => [{ heading: 'TEST TOOLS', commands: [['help', commands.help], ['local-command', commands.scan]] }])
    expect(help.run(context, [])).toEqual({
      type: 'output',
      lines: ['AVAILABLE COMMANDS', '', 'TEST TOOLS', '', 'help — List available commands', 'local-command — Discover devices, relationships, and exposed services'],
    })
  })

  it('returns a structured clear result', () => {
    expect(clearCommand.run(context, [])).toEqual({ type: 'clear' })
  })

  it('reads the player address for ip output', () => {
    const narrowContext = { ...context, localDevice: { ip: '203.0.113.7', installedSoftware: context.localDevice.installedSoftware } }
    expect(ipCommand.run(narrowContext, [])).toEqual({ type: 'output', lines: [labeledTarget('Local address: ', '203.0.113.7', 'local')] })
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
      lines: ['DEVICE', labeledTarget('Address: ', '192.0.2.44', 'local'), 'Scope:   SELF', 'Status:  ONLINE', 'CPU:     Changed CPU', 'RAM:     12 GB'],
    })
    expect(inspectTarget).toHaveBeenCalledExactlyOnceWith('192.0.2.44')
  })

  it('presents NodeScan 1.1 Experimental enhanced evidence through the same inspect command', () => {
    const inspectTarget = vi.fn(() => ({
      status: 'device' as const, targetId: 'host-lan-001', address: '198.51.100.47', scope: 'lan' as const, networkStatus: 'ONLINE' as const,
      deviceKind: 'server' as const, enhanced: { firmware: { name: 'RACK-OS', version: '1.0' }, computeClass: 'HIGH' as const },
    }))
    expect(inspectCommand.run({ ...context, operations: { ...context.operations, inspectTarget } }, ['198.51.100.47'])).toEqual({
      type: 'output',
      lines: ['SERVER', labeledTarget('Address: ', '198.51.100.47'), 'Scope:   LAN', 'Status:  ONLINE', 'Firmware: RACK-OS 1.0', 'Compute:  HIGH'],
    })
  })

  it('reports the shared capability failure compactly for NodeScan 1.0 Standard', () => {
    const inspectTarget = vi.fn(() => ({ status: 'capability_unavailable' as const }))
    expect(inspectCommand.run({ ...context, operations: { ...context.operations, inspectTarget } }, ['198.51.100.47'])).toEqual({
      type: 'output', lines: ['INSPECT UNAVAILABLE', '', 'Installed NodeScan does not support Inspect.'],
    })
  })
})

describe('node-miner command', () => {
  it('is unavailable before installation, regardless of subcommand', () => {
    const unavailable = { ...context, nodeMiner: { available: false } }
    for (const input of ['node-miner', 'node-miner help', 'node-miner status', 'node-miner run --payout addr', 'node-miner stop']) {
      expect(dispatchCommand(parseCommand(input), unavailable)).toEqual({ type: 'output', lines: ['Command not found: node-miner. Type "help" for available commands.'] })
    }
  })

  it('omits NODE Miner from help before installation and includes it once available', () => {
    expect(JSON.stringify(dispatch('help'))).not.toContain('NODE MINER')

    const available = {
      ...context,
      nodeMiner: { available: true },
      localDevice: { ...context.localDevice, installedSoftware: [...context.localDevice.installedSoftware, { id: 'node-miner' as const, releaseId: 'node-miner-1.0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' }] },
    }
    const helpOutput = JSON.stringify(dispatchCommand(parseCommand('help'), available))
    expect(helpOutput).toContain('NODE MINER 1.0')
    expect(helpOutput).toContain('node-miner — Control NODE Miner on this Device')
  })

  it('describes only the V1 subcommands', () => {
    const available = { ...context, nodeMiner: { available: true } }
    expect(dispatchCommand(parseCommand('node-miner help'), available)).toEqual({
      type: 'output',
      lines: ['NODE MINER', '', 'node-miner help', 'node-miner run --payout <address>', 'node-miner status', 'node-miner payout', 'node-miner config payout <address>', 'node-miner stop'],
    })
    expect(dispatchCommand(parseCommand('node-miner'), available)).toEqual(dispatchCommand(parseCommand('node-miner help'), available))
  })

  it('requires a non-empty --payout value for run and delegates through the canonical operation on success', () => {
    const available = { ...context, nodeMiner: { available: true } }
    expect(dispatchCommand(parseCommand('node-miner run'), available)).toEqual({ type: 'output', lines: ['Usage: node-miner run --payout <address>'] })
    expect(dispatchCommand(parseCommand('node-miner run --payout'), available)).toEqual({ type: 'output', lines: ['Usage: node-miner run --payout <address>'] })
    expect(dispatchCommand(parseCommand('node-miner run --payout   '), available)).toEqual({ type: 'output', lines: ['Usage: node-miner run --payout <address>'] })

    const runLocalNodeMiner = vi.fn(() => ({ status: 'started' as const, processId: 'process-0004', payoutAddress: 'addr-1' }))
    const result = dispatchCommand(parseCommand('node-miner run --payout addr-1'), { ...available, operations: { ...available.operations, nodeMiner: { ...available.operations.nodeMiner, run: runLocalNodeMiner } } })
    expect(runLocalNodeMiner).toHaveBeenCalledExactlyOnceWith('addr-1')
    expect(result).toEqual({ type: 'output', lines: ['NODE MINER STARTED', 'PROCESS  process-0004', 'PAYOUT   addr-1'] })
  })

  it('maps every canonical RUN admission result to concise output', () => {
    const available = { ...context, nodeMiner: { available: true } }
    const cases = [
      [{ status: 'already_running' as const }, ['ALREADY RUNNING']],
      [{ status: 'invalid_payout_address' as const }, ['INVALID PAYOUT ADDRESS']],
      [{ status: 'insufficient_memory' as const, requiredMiB: 512, availableMiB: 100.4 }, ['INSUFFICIENT MEMORY', '512 MiB required', '100 MiB available']],
    ] as const
    for (const [operationResult, lines] of cases) {
      const runLocalNodeMiner = vi.fn(() => operationResult)
      expect(dispatchCommand(parseCommand('node-miner run --payout addr'), { ...available, operations: { ...available.operations, nodeMiner: { ...available.operations.nodeMiner, run: runLocalNodeMiner } } })).toEqual({ type: 'output', lines })
    }
  })

  it('reads status through the narrow local operation rather than owning Terminal state', () => {
    const available = { ...context, nodeMiner: { available: true } }
    expect(dispatchCommand(parseCommand('node-miner status'), { ...available, operations: { ...available.operations, nodeMiner: { ...available.operations.nodeMiner, status: () => ({ status: 'idle' }) } } }))
      .toEqual({ type: 'output', lines: ['STATUS  IDLE'] })

    const localNodeMinerStatus = vi.fn(() => ({
      status: 'running' as const, processId: 'process-0004', cpuPercent: 82.4, ramMiB: 512,
      payoutAddress: 'addr-1', producedUnits: 4281, unpaidUnits: 281, ratePerSecondUnits: 82.3,
    }))
    const result = dispatchCommand(parseCommand('node-miner status'), { ...available, operations: { ...available.operations, nodeMiner: { ...available.operations.nodeMiner, status: localNodeMinerStatus } } })
    expect(localNodeMinerStatus).toHaveBeenCalledOnce()
    expect(result).toEqual({
      type: 'output',
      lines: ['STATUS   RUNNING', 'PROCESS  process-0004', 'CPU      82%', 'RAM      512 MiB', 'ADDRESS  addr-1', 'PRODUCED 4,281 units', 'UNPAID   281 units', 'RATE     82 units/s'],
    })
  })

  it('retargets payout through the same product command contract', () => {
    const configurePayout = vi.fn(() => ({ status: 'retargeted' as const, processId: 'process-0004', payoutAddress: 'addr-2' }))
    const available = { ...context, nodeMiner: { available: true }, operations: { ...context.operations, nodeMiner: { ...context.operations.nodeMiner, configurePayout } } }
    expect(dispatchCommand(parseCommand('node-miner config payout addr-2'), available)).toEqual({ type: 'output', lines: ['PAYOUT CONFIGURED', 'PROCESS  process-0004', 'PAYOUT   addr-2'] })
    expect(configurePayout).toHaveBeenCalledExactlyOnceWith('addr-2')
  })

  it('invokes the canonical STOP operation rather than removing the Process itself', () => {
    const available = { ...context, nodeMiner: { available: true } }
    const stopLocalNodeMiner = vi.fn(() => ({ status: 'stopped' as const, processId: 'process-0004', settledGrossUnits: 0, payoutUnits: 0 }))
    expect(dispatchCommand(parseCommand('node-miner stop'), { ...available, operations: { ...available.operations, nodeMiner: { ...available.operations.nodeMiner, stop: stopLocalNodeMiner } } })).toEqual({ type: 'output', lines: ['STOPPED', 'PROCESS  process-0004'] })
    expect(stopLocalNodeMiner).toHaveBeenCalledOnce()

    expect(dispatchCommand(parseCommand('node-miner stop'), { ...available, operations: { ...available.operations, nodeMiner: { ...available.operations.nodeMiner, stop: () => ({ status: 'not_running' }) } } })).toEqual({ type: 'output', lines: ['NOT RUNNING'] })
  })
})

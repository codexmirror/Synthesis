import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { DeviceAccessFileTransfer, GameState } from '../../core/game/types'
import { appEntries, appRegistry } from '../../shell/appRegistry'
import { Processes } from './Processes'
import processesCss from './processes.css?raw'
import monitorSource from './activityMonitor.ts?raw'
import processesSource from './Processes.tsx?raw'
import { startServiceAnalysis } from '../../core/game/serviceAnalysis'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS, startNodeMiner } from '../../core/game/nodeMiner'
import { installLocalSoftwarePackage } from '../../core/game/softwareInstallation'
import { removeInstalledSoftware } from '../../core/game/softwareRemoval'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

const withProcesses = (): GameState => ({ ...createInitialGameState(), process: { nextId: 3, processes: [
  { kind: 'generic', id: 'process-0001', label: 'Active analysis', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 100, workCompleted: 25, ramRequiredMiB: 512 },
  { kind: 'generic', id: 'process-0002', label: 'Finished analysis', executorDeviceId: 'device-local-v0', status: 'completed', workRequired: 100, workCompleted: 100, ramRequiredMiB: 512 },
] } })
const runningAnalysis = () => {
  const result = startServiceAnalysis(createInitialGameState(), 'host-lan-001', 'service-ssh-001')
  if (result.status !== 'started') throw Error(result.status)
  return advanceGameState(result.state, 3000)
}
const completedAnalysis = (serviceId = 'service-ssh-001') => {
  const result = startServiceAnalysis(createInitialGameState(), 'host-lan-001', serviceId)
  if (result.status !== 'started') throw Error(result.status)
  return advanceGameState(result.state, 20_000)
}
/**
 * Canonical DeviceAccess authority for the one currently represented
 * transfer. `withActiveSession` is false by default: presentation must not
 * require a RemoteSession, so most tests deliberately omit one.
 */
const withDownload = (base: GameState = createInitialGameState(), transfer: Partial<DeviceAccessFileTransfer> = {}, withActiveSession = false): GameState => ({
  ...base,
  deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
  remoteSession: withActiveSession ? { nextId: 2, active: { id: 'session-0001', accessId: 'access-0001', connectedAddress: '198.51.100.47' } } : { nextId: 1, active: null },
  fileTransfer: { nextId: 2, active: {
    id: 'transfer-0001', origin: 'device_access', accessId: 'access-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
    destinationDeviceId: base.player.localDevice.id, destinationPath: '/home/user/downloads/nodescan-exp-1.1.pkg',
    bytesTotal: 18_400_000, bytesTransferred: 4_600_000, ...transfer,
  } },
})
const withUpload = (base: GameState = createInitialGameState(), withActiveSession = false): GameState => {
  const source = base.player.localDevice.filesystem.files.find(({ path }) => path === '/home/user/downloads/node-miner-1.0.pkg')!
  return { ...base,
    deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
    remoteSession: withActiveSession ? { nextId: 2, active: { id: 'session-0001', accessId: 'access-0001', connectedAddress: '203.0.113.88' } } : { nextId: 2, active: null },
    fileTransfer: { nextId: 2, active: { id: 'transfer-upload', origin: 'device_access', accessId: 'access-0001', sourceDeviceId: base.player.localDevice.id, sourceFileId: source.id, destinationDeviceId: 'host-lan-001', destinationPath: '/home/user/node-miner-1.0.pkg', bytesTotal: 3_400_000, bytesTransferred: 1_400_000 } },
  }
}
const withLocalDownloadCapacity = (bytesPerSecond: number): GameState => {
  const base = createInitialGameState()
  return { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, network: { ...base.player.localDevice.network, transferCapacity: { ...base.player.localDevice.network.transferCapacity, downloadBytesPerSecond: bytesPerSecond } } } } }
}

const monitor = () => document.querySelector('.activity-monitor') as HTMLElement
const stat = (label: string) => within(document.querySelector('.am-summary') as HTMLElement).getByText(label).closest('.am-stat') as HTMLElement
const card = (kindLabel: string) => within(monitor()).getAllByText(kindLabel).map((node) => node.closest('.am-activity')).find(Boolean) as HTMLElement
const cards = () => Array.from(monitor().querySelectorAll('.am-activity')) as HTMLElement[]
const fact = (scope: HTMLElement, label: string) => within(scope).getByText(label).parentElement?.querySelector('dd')?.textContent

describe('Processes application integration', () => {
  it('is a canonical app while Network remains registered', () => { expect(appEntries).toHaveLength(10); expect(appRegistry).toHaveProperty('processes'); expect(appRegistry).toHaveProperty('network'); expect(appRegistry).toHaveProperty('networkManagement') })

  it('presents a truthful idle system summary and empty state', () => {
    render(<GameProvider><Processes /></GameProvider>)
    expect(within(stat('CPU')).getByText('18%')).toBeInTheDocument()
    expect(within(stat('CPU')).getByText('18% BASELINE')).toBeInTheDocument()
    expect(within(stat('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
    expect(within(stat('NET DOWN')).getByText('0 B/s')).toBeInTheDocument()
    expect(within(stat('NET DOWN')).getByText('2 MiB/s CAPACITY')).toBeInTheDocument()
    expect(within(stat('NET UP')).getByText('0 B/s')).toBeInTheDocument()
    expect(within(stat('NET UP')).getByText('1 MiB/s CAPACITY')).toBeInTheDocument()
    expect(within(stat('ACTIVE')).getByText('0')).toBeInTheDocument()
    expect(screen.getByText('SYSTEM IDLE')).toBeInTheDocument()
    expect(cards()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Clear recent activity' })).not.toBeInTheDocument()
  })

  it('does not observe or clear remote Process runtime from NODE-OS', () => {
    const base = createInitialGameState()
    const remote = { kind: 'generic' as const, id: 'process-remote', label: 'REMOTE WORK', executorDeviceId: 'host-lan-001', status: 'completed' as const, workRequired: 100, workCompleted: 100, ramRequiredMiB: 2048 }
    const initial = { ...base, process: { nextId: 2, processes: [remote] } }
    function Snapshot() { return <output>{JSON.stringify(useGameState().process.processes)}</output> }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    expect(screen.queryByText('REMOTE WORK')).not.toBeInTheDocument()
    expect(within(stat('CPU')).getByText('18%')).toBeInTheDocument()
    expect(within(stat('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear recent activity' })).not.toBeInTheDocument()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual([remote])
  })

  it('renders running Service Analysis target, progress, CPU allocation, and RAM requirement', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    const analysis = card('SERVICE ANALYSIS')
    expect(within(analysis).getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(within(analysis).getByText('RUNNING')).toBeInTheDocument()
    expect(fact(analysis, 'PROGRESS')).toBe('25%')
    expect(fact(analysis, 'CPU')).toBe('82%')
    expect(fact(analysis, 'RAM')).toBe('768 MiB')
    expect(within(stat('ACTIVE')).getByText('1')).toBeInTheDocument()
    expect(within(stat('RAM')).getByText('1710 / 4096 MiB')).toBeInTheDocument()
  })

  it('separates running allocation from quieter retained completion', () => {
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    const running = card('PROCESS')
    expect(within(running).getByText('Active analysis')).toBeInTheDocument()
    expect(fact(running, 'PROGRESS')).toBe('25%')
    expect(fact(running, 'CPU')).toBe('82%')
    expect(fact(running, 'RAM')).toBe('512 MiB')
    const finished = within(monitor()).getByText('Finished analysis').closest('.am-activity') as HTMLElement
    expect(finished.dataset.status).toBe('recent')
    expect(within(finished).queryByText(/COMPLETED|STOPPED|CANCELLED/)).not.toBeInTheDocument()
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
    expect(fact(finished, 'CPU')).toBe('0%')
    expect(fact(finished, 'RAM')).toBe('0 MiB')
    expect(within(stat('ACTIVE')).getByText('1')).toBeInTheDocument()
  })

  it('counts only active activity in badges while retaining completed operations in filtered history', () => {
    const completed = withProcesses()
    const completedOnly = { ...completed, process: { ...completed.process, processes: completed.process.processes.filter(({ status }) => status === 'completed') } }
    const { unmount } = render(<GameProvider initialState={completedOnly}><Processes /></GameProvider>)
    expect(within(document.querySelector('.am-filters') as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual(['ALL0', 'OPERATIONS0', 'TRANSFERS0'])
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getByText('Finished analysis')).toBeInTheDocument()
    unmount()

    render(<GameProvider initialState={withDownload(withProcesses())}><Processes /></GameProvider>)
    expect(within(document.querySelector('.am-filters') as HTMLElement).getAllByRole('button').map((button) => button.textContent)).toEqual(['ALL2', 'OPERATIONS1', 'TRANSFERS1'])
  })

  it('advances at the provider boundary even when the app is not mounted', () => {
    vi.useFakeTimers()
    function Snapshot() {
      const process = useGameState().process.processes[0]
      if (process.kind === 'node_miner') throw new Error('unexpected node_miner process')
      return <output>{process.workCompleted}</output>
    }
    render(<GameProvider initialState={withProcesses()}><Snapshot /></GameProvider>)
    expect(screen.getByText('25')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(500))
    expect(Number(screen.getByRole('status').textContent)).toBeGreaterThan(25)
  })

  it('renders every concrete completed Process result', () => {
    const weakness = render(<GameProvider initialState={completedAnalysis()}><Processes /></GameProvider>)
    expect(screen.getByText('WEAKNESS DETECTED')).toBeInTheDocument()
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    weakness.unmount()
    const none = render(<GameProvider initialState={completedAnalysis('service-http-001')}><Processes /></GameProvider>)
    expect(screen.getByText('NO WEAKNESS DETECTED')).toBeInTheDocument()
    none.unmount()
    const running = runningAnalysis(); const host = running.world.network.hosts[0]
    const unavailable = advanceGameState({ ...running, world: { network: { ...running.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, open: false } : service) }, ...running.world.network.hosts.slice(1)] } } }, 20_000)
    const offline = render(<GameProvider initialState={unavailable}><Processes /></GameProvider>)
    expect(screen.getByText('SERVICE UNAVAILABLE')).toBeInTheDocument()
    offline.unmount()

    const base = createInitialGameState()
    const credential: GameState = { ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      process: { nextId: 3, processes: [
        { kind: 'credential_access', id: 'process-0001', label: 'CREDENTIAL ACCESS', executorDeviceId: base.player.localDevice.id, status: 'completed', workRequired: 1200, workCompleted: 1200, ramRequiredMiB: 896, targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:22', vulnerabilityId: 'AUTH-017', toolId: 'flipper', moduleId: 'credential-access', result: { status: 'access_established', accessId: 'access-0001' } },
        { kind: 'credential_access', id: 'process-0002', label: 'CREDENTIAL ACCESS', executorDeviceId: base.player.localDevice.id, status: 'completed', workRequired: 1200, workCompleted: 1200, ramRequiredMiB: 896, targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002', startedEndpoint: '203.0.113.42:22', vulnerabilityId: 'AUTH-017', toolId: 'flipper', moduleId: 'credential-access', result: { status: 'attempt_failed', message: 'Authentication attempt failed.' } },
      ] } }
    render(<GameProvider initialState={credential}><Processes /></GameProvider>)
    expect(screen.getByText('ACCESS ESTABLISHED')).toBeInTheDocument()
    expect(screen.getByText('USER PRIVILEGE')).toBeInTheDocument()
    expect(screen.getByText('ATTEMPT FAILED')).toBeInTheDocument()
    expect(screen.getByText('Authentication attempt failed.')).toBeInTheDocument()
  })

  it('confirms before clearing completed cards while running work remains visible', () => {
    // The confirmation is asked inside the Firmware surface. A browser dialog
    // would be an operating-system sheet over NODE-OS, so reaching for one is
    // itself the regression.
    const confirm = vi.spyOn(window, 'confirm')
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear recent activity' }))
    const question = screen.getByRole('group', { name: 'Clear recent activity?' })
    expect(screen.getByText('Finished analysis')).toBeInTheDocument()

    // Declining keeps the list and puts the single CLEAR control back.
    fireEvent.click(within(question).getByRole('button', { name: 'KEEP' }))
    expect(screen.getByText('Finished analysis')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear recent activity' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear recent activity' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Clear recent activity?' })).getByRole('button', { name: 'CLEAR' }))
    expect(screen.queryByText('Finished analysis')).not.toBeInTheDocument()
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument()
    expect(screen.getByText('Active analysis')).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('discards a completed result without changing knowledge or world state', () => {
    const initial = completedAnalysis(); const world = initial.world; const knowledge = initial.knowledge
    function Snapshot() { const state = useGameState(); return <output>{JSON.stringify({ worldSame: state.world === world, knowledgeSame: state.knowledge === knowledge, knowledge: state.knowledge })}</output> }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear recent activity' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Clear recent activity?' })).getByRole('button', { name: 'CLEAR' }))
    expect(screen.queryByText('WEAKNESS DETECTED')).not.toBeInTheDocument()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toMatchObject({ worldSame: true, knowledgeSame: true, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-017' }] } })
  })

  it('removes one completed Process through GameActions without changing gameplay truth or other work', () => {
    const base = completedAnalysis()
    const first = base.process.processes[0]
    const initial: GameState = { ...base, process: { nextId: 3, processes: [first, { ...first, id: 'process-0002', label: 'SECOND COMPLETION' }] } }
    const truth = { world: initial.world, knowledge: initial.knowledge, deviceAccess: initial.deviceAccess, filesystem: initial.player.localDevice.filesystem }
    function Snapshot() {
      const state = useGameState()
      return <output>{JSON.stringify({ ids: state.process.processes.map(({ id }) => id), nextId: state.process.nextId, worldSame: state.world === truth.world, knowledgeSame: state.knowledge === truth.knowledge, accessSame: state.deviceAccess === truth.deviceAccess, filesystemSame: state.player.localDevice.filesystem === truth.filesystem })}</output>
    }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove recent SERVICE ANALYSIS activity' })[0])
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ ids: ['process-0002'], nextId: 3, worldSame: true, knowledgeSame: true, accessSame: true, filesystemSame: true })
    expect(screen.getByText('SECOND COMPLETION')).toBeInTheDocument()
  })

  it('does not rewrite the historical target when the current service port changes', () => {
    const completed = completedAnalysis(); const host = completed.world.network.hosts[0]
    const moved: GameState = { ...completed, world: { network: { ...completed.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) }, ...completed.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={moved}><Processes /></GameProvider>)
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(screen.queryByText('198.51.100.47:2222')).not.toBeInTheDocument()
  })
})

describe('Activity Monitor aggregation', () => {
  it('offers finite CANCEL while preserving NODE Miner STOP and transfer CANCEL semantics', () => {
    const finite = render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    const analysis = card('SERVICE ANALYSIS')
    expect(within(analysis).getByRole('button', { name: 'Cancel active SERVICE ANALYSIS' })).toHaveTextContent('CANCEL')
    expect(within(analysis).queryByText('STOP')).not.toBeInTheDocument()
    fireEvent.click(within(analysis).getByRole('button', { name: 'Cancel active SERVICE ANALYSIS' }))
    const historical = card('SERVICE ANALYSIS')
    expect(historical.dataset.status).toBe('recent')
    expect(within(historical).getByText('CANCELLED')).toBeInTheDocument()
    expect(within(historical).queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()
    expect(within(historical).queryByText('RAM')).not.toBeInTheDocument()
    expect(within(historical).queryByText('CPU')).not.toBeInTheDocument()
    finite.unmount()

    const base = createInitialGameState()
    const minerFile = { kind: 'executable' as const, id: 'file-fixture-matrix-miner', path: '/home/user/node-miner-1.0.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
    const withMinerFile: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, minerFile] } } } }
    const minerStarted = startNodeMiner(withMinerFile, minerFile.path, base.nodeWallet.address)
    if (minerStarted.status !== 'started') throw Error(minerStarted.status)
    const minerView = render(<GameProvider initialState={minerStarted.state}><Processes /></GameProvider>)
    expect(within(card('NODE MINER')).getByRole('button', { name: 'Stop NODE MINER' })).toHaveTextContent('STOP')
    expect(within(card('NODE MINER')).queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()
    minerView.unmount()

    render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    expect(within(card('DOWNLOAD')).getByRole('button', { name: 'Cancel active DOWNLOAD' })).toHaveTextContent('CANCEL')
    expect(within(card('DOWNLOAD')).queryByText('STOP')).not.toBeInTheDocument()
  })
  it('shows operations and the active transfer under ALL', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(card('SERVICE ANALYSIS')).toBeInTheDocument()
    const download = card('DOWNLOAD')
    expect(within(download).getByText('nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(within(download).queryByText(/srv-01|198\.51\.100\.47/)).not.toBeInTheDocument()
    expect(within(download).getByText('/opt/packages/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(within(download).getByText('/home/user/downloads/nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(cards()).toHaveLength(2)
  })

  it('derives the active count from running operations plus the active transfer', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(within(stat('ACTIVE')).getByText('2')).toBeInTheDocument()
    expect(within(stat('ACTIVE')).getByText('ACTIVITIES')).toBeInTheDocument()
  })

  it('excludes transfer activity from OPERATIONS and Process activity from TRANSFERS', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(cards()).toHaveLength(1)
    expect(within(monitor()).getByText('SERVICE ANALYSIS')).toBeInTheDocument()
    expect(within(monitor()).queryByText('DOWNLOAD')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }))
    expect(cards()).toHaveLength(1)
    expect(within(monitor()).getByText('DOWNLOAD')).toBeInTheDocument()
    expect(within(monitor()).queryByText('SERVICE ANALYSIS')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All activity' }))
    expect(cards()).toHaveLength(2)
  })

  it('derives Download progress and transferred bytes from the canonical transfer', () => {
    const { unmount } = render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    expect(fact(card('DOWNLOAD'), 'PROGRESS')).toBe('25%')
    expect(fact(card('DOWNLOAD'), 'TRANSFERRED')).toBe('4.6 / 18.4 MB')
    unmount()
    const { unmount: unmount2 } = render(<GameProvider initialState={withDownload(createInitialGameState(), { bytesTransferred: 13_800_000 })}><Processes /></GameProvider>)
    expect(fact(card('DOWNLOAD'), 'PROGRESS')).toBe('75%')
    expect(fact(card('DOWNLOAD'), 'TRANSFERRED')).toBe('13.8 / 18.4 MB')
    unmount2()
    render(<GameProvider initialState={withDownload(createInitialGameState(), { bytesTransferred: 400_000 })}><Processes /></GameProvider>)
    expect(fact(card('DOWNLOAD'), 'PROGRESS')).toBe('2%')
    expect(fact(card('DOWNLOAD'), 'TRANSFERRED')).toBe('400 KB / 18.4 MB')
  })

  it('derives current Download speed and network usage from current endpoint capacities', () => {
    const { unmount } = render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    // srv-01 uploads at 8 MiB/s, so the local 2 MiB/s download capacity is the limit.
    expect(fact(card('DOWNLOAD'), 'RATE')).toBe('2 MiB/s')
    expect(within(stat('NET DOWN')).getByText('2 MiB/s')).toBeInTheDocument()
    expect(within(stat('NET UP')).getByText('0 B/s')).toBeInTheDocument()
    unmount()
    render(<GameProvider initialState={withDownload(withLocalDownloadCapacity(524_288))}><Processes /></GameProvider>)
    expect(fact(card('DOWNLOAD'), 'RATE')).toBe('512 KiB/s')
    expect(within(stat('NET DOWN')).getByText('512 KiB/s')).toBeInTheDocument()
    expect(within(stat('NET DOWN')).getByText('512 KiB/s CAPACITY')).toBeInTheDocument()
  })

  it('never represents the FileTransfer as a GameProcess', () => {
    function Snapshot() { const state = useGameState(); return <output>{JSON.stringify({ processes: state.process.processes.length, transfer: Boolean(state.fileTransfer.active) })}</output> }
    render(<GameProvider initialState={withDownload()}><Processes /><Snapshot /></GameProvider>)
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ processes: 0, transfer: true })
    const download = card('DOWNLOAD')
    expect(within(download).queryByText('CPU')).not.toBeInTheDocument()
    expect(within(download).queryByText('RAM')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getByText('NO RUNNING OPERATIONS')).toBeInTheDocument()
    expect(cards()).toHaveLength(0)
  })

  it('keeps every empty state truthful for its own filter', () => {
    render(<GameProvider><Processes /></GameProvider>)
    expect(screen.getByText('SYSTEM IDLE')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }))
    expect(screen.getByText('NO ACTIVE TRANSFER')).toBeInTheDocument()
    expect(screen.getByText('No transfer is currently running.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getByText('NO RUNNING OPERATIONS')).toBeInTheDocument()
  })

  it('offers no completed transfer history, because none is represented', () => {
    render(<GameProvider initialState={withDownload(withProcesses())}><Processes /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }))
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear recent activity' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove recent/ })).not.toBeInTheDocument()
  })

  it('offers individual removal only on completed Process cards', () => {
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    expect(within(card('PROCESS')).queryByRole('button', { name: /Remove recent/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove recent PROCESS activity' })).toBeInTheDocument()
    const removeRule = processesCss.match(/\.am-remove\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(removeRule).toMatch(/min-height:\s*44px/)
  })

  it('displays the active Download and derives correct source/progress/rate with no active RemoteSession', () => {
    render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    const download = card('DOWNLOAD')
    expect(within(download).queryByText(/srv-01|198\.51\.100\.47/)).not.toBeInTheDocument()
    expect(fact(download, 'RATE')).toBe('2 MiB/s')
    expect(fact(download, 'TRANSFERRED')).toBe('4.6 / 18.4 MB')
  })

  it('uses only the matching Session retained address and omits a route after disconnect', () => {
    const { unmount } = render(<GameProvider initialState={withDownload(createInitialGameState(), {}, true)}><Processes /></GameProvider>)
    const withSession = card('DOWNLOAD').textContent
    unmount()
    render(<GameProvider initialState={withDownload(createInitialGameState(), {}, false)}><Processes /></GameProvider>)
    expect(withSession).toContain('198.51.100.47 → node-01')
    expect(card('DOWNLOAD').textContent).not.toContain('198.51.100.47')
    expect(card('DOWNLOAD').textContent).not.toContain('srv-01')
  })

  it('presents Upload orientation, canonical progress, upload network usage, and survives disconnect privately', () => {
    const { unmount } = render(<GameProvider initialState={withUpload(createInitialGameState(), true)}><Processes /></GameProvider>)
    const upload = card('UPLOAD')
    expect(within(upload).getByText('node-01 → 203.0.113.88')).toBeInTheDocument()
    expect(fact(upload, 'PROGRESS')).toBe('41%')
    expect(fact(upload, 'SOURCE')).toBe('/home/user/downloads/node-miner-1.0.pkg')
    expect(fact(upload, 'DESTINATION')).toBe('/home/user/node-miner-1.0.pkg')
    expect(within(stat('NET UP')).getByText('1 MiB/s')).toBeInTheDocument()
    expect(within(stat('NET DOWN')).getByText('0 B/s')).toBeInTheDocument()
    unmount()
    render(<GameProvider initialState={withUpload()}><Processes /></GameProvider>)
    expect(card('UPLOAD')).toBeInTheDocument()
    expect(card('UPLOAD').textContent).not.toMatch(/203\.0\.113\.88|srv-01/)
  })

  it('offers CANCEL, not REMOVE, on the running FileTransfer card, and invokes the canonical GameAction', () => {
    render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    const download = card('DOWNLOAD')
    expect(within(download).getByRole('button', { name: 'Cancel active DOWNLOAD' })).toBeInTheDocument()
    expect(within(download).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()

    fireEvent.click(within(download).getByRole('button', { name: 'Cancel active DOWNLOAD' }))
    expect(card('DOWNLOAD').dataset.status).toBe('recent')
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
  })

  it('CANCEL preserves DeviceAccess and does not create a GameProcess', () => {
    const initial = withDownload()
    function Snapshot() {
      const state = useGameState()
      return <output>{JSON.stringify({ accessCount: state.deviceAccess.established.length, processCount: state.process.processes.length, nextId: state.fileTransfer.nextId })}</output>
    }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' }))
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ accessCount: 1, processCount: 0, nextId: 2 })
  })

  it('keeps CANCEL touch-safe', () => {
    const cancelRule = processesCss.match(/\.am-cancel\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(cancelRule).toMatch(/min-height:\s*44px/)
  })

  it('represents only currently implemented activity types', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(within(document.querySelector('.am-filters') as HTMLElement).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['ALL2', 'OPERATIONS1', 'TRANSFERS1'])
    expect(monitor().textContent).not.toMatch(/UPLOAD|CRACK|MALWARE/i)
    expect(monitorSource + processesSource).not.toMatch(/cracking|malware/i)
  })

  it('keeps the filter row compact and touch-safe without horizontal overflow', () => {
    const filterRule = processesCss.match(/\.am-filter\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(filterRule).toMatch(/min-height:\s*44px/)
    expect(filterRule).toMatch(/flex:\s*1/)
    expect(filterRule).toMatch(/min-width:\s*0/)
    expect(processesCss).toMatch(/\.am-filters\s*\{[^}]*display:\s*flex/)
    expect(processesSource + monitorSource).not.toMatch(/scrollIntoView|window\.scrollTo|visualViewport/)
  })
})

describe('Activity Monitor: continuous NODE Miner runtime', () => {
  const minerState = (payoutAddress?: string): GameState => {
    const base = createInitialGameState()
    const minerFile = { kind: 'executable' as const, id: 'file-fixture-miner', path: '/home/user/node-miner-1.0.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
    const withFile: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { nextFileId: 50, files: [...base.player.localDevice.filesystem.files, minerFile] } } } }
    const started = startNodeMiner(withFile, minerFile.path, payoutAddress ?? withFile.nodeWallet.address)
    if (started.status !== 'started') throw new Error(started.status)
    return started.state
  }

  it('shows continuous runtime with real CPU/RAM/payout facts and no misleading completion bar', () => {
    render(<GameProvider initialState={minerState()}><Processes /></GameProvider>)
    const minerCard = card('NODE MINER')
    expect(within(minerCard).getByText('RUNNING')).toBeInTheDocument()
    expect(minerCard.querySelector('progress')).not.toBeInTheDocument()
    expect(fact(minerCard, 'CPU')).toBe('82%')
    expect(fact(minerCard, 'RAM')).toBe('512 MiB')
    expect(fact(minerCard, 'PRODUCED')).toBe('0 units')
    expect(fact(minerCard, 'UNPAID')).toBe('0 units')
    expect(within(minerCard).getByText('node-wallet-addr-0001')).toBeInTheDocument()
    expect(within(stat('ACTIVE')).getByText('1')).toBeInTheDocument()
  })

  it('derives gross produced and unpaid production from real deterministic elapsed compute', () => {
    const advanced = advanceGameState(minerState(), 3000)
    render(<GameProvider initialState={advanced}><Processes /></GameProvider>)
    const minerCard = card('NODE MINER')
    // node-01: computeCapacity 100, baseline 18% -> ~82 atomic NODE units/s allocated while running alone.
    expect(fact(minerCard, 'PRODUCED')).toBe('246 units')
    expect(fact(minerCard, 'UNPAID')).toBe('246 units')
  })

  it('presents the same unpaid production whether or not the address matches the represented Wallet', () => {
    const advanced = advanceGameState(minerState('an-unmatched-fictional-address'), 3000)
    render(<GameProvider initialState={advanced}><Processes /></GameProvider>)
    const minerCard = card('NODE MINER')
    expect(fact(minerCard, 'PRODUCED')).toBe('246 units')
    expect(fact(minerCard, 'UNPAID')).toBe('246 units')
    expect(within(minerCard).getByText('an-unmatched-fictional-address')).toBeInTheDocument()
  })

  it('never exposes the embedded developer destination of the running release', () => {
    const advanced = advanceGameState(minerState(), 3000)
    render(<GameProvider initialState={advanced}><Processes /></GameProvider>)
    expect(monitor().textContent).not.toContain(NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS)
    expect(monitor().textContent).not.toMatch(/DEVELOPER|FEE/i)
  })

  it('STOP invokes the canonical operation, removing the Process and releasing its resources', () => {
    render(<GameProvider initialState={minerState()}><Processes /></GameProvider>)
    const minerCard = card('NODE MINER')
    fireEvent.click(within(minerCard).getByRole('button', { name: 'Stop NODE MINER' }))
    expect(card('NODE MINER').dataset.status).toBe('recent')
    expect(within(card('NODE MINER')).queryByText(/STOPPED|COMPLETED|CANCELLED/)).not.toBeInTheDocument()
    expect(within(stat('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
  })

  it('STOP preserves Process ID progression, so a later RUN receives a new identity', () => {
    const state = minerState()
    const originalId = state.process.processes[0].id
    function Snapshot() { return <output>{JSON.stringify({ ids: useGameState().process.processes.map(({ id }) => id), nextId: useGameState().process.nextId })}</output> }
    render(<GameProvider initialState={state}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(within(card('NODE MINER')).getByRole('button', { name: 'Stop NODE MINER' }))
    const afterStop = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(afterStop).toEqual({ ids: [], nextId: state.process.nextId })

    const minerFile = { kind: 'executable' as const, id: 'file-fixture-miner-2', path: '/home/user/node-miner-again.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
    const withFile: GameState = { ...state, process: { nextId: state.process.nextId, processes: [] }, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 51, files: [...state.player.localDevice.filesystem.files, minerFile] } } } }
    const restarted = startNodeMiner(withFile, minerFile.path, withFile.nodeWallet.address)
    if (restarted.status !== 'started') throw new Error(restarted.status)
    expect(restarted.processId).not.toBe(originalId)
    expect(restarted.state.process.nextId).toBe(state.process.nextId + 1)
  })
})

describe('Activity Monitor: Software Installation', () => {
  const started = () => {
    const result = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (result.status !== 'started') throw Error(result.status)
    return result.state
  }

  it('shows a running installation Process with package, progress, CPU, and RAM', () => {
    render(<GameProvider initialState={started()}><Processes /></GameProvider>)
    const installing = card('SOFTWARE INSTALLATION')
    expect(within(installing).getByText('RUNNING')).toBeInTheDocument()
    expect(within(installing).getByText('PACKAGE')).toBeInTheDocument()
    expect(within(installing).getByText('NODE Miner 1.0')).toBeInTheDocument()
    expect(fact(installing, 'PROGRESS')).toBe('0%')
    expect(fact(installing, 'CPU')).toBe('82%')
    expect(fact(installing, 'RAM')).toBe('256 MiB')
  })

  it('appears in Recent Activity with a concrete INSTALLED outcome once the Process ends', () => {
    const done = advanceGameState(started(), 20_000)
    render(<GameProvider initialState={done}><Processes /></GameProvider>)
    const installing = card('SOFTWARE INSTALLATION')
    expect(installing.dataset.status).toBe('recent')
    expect(within(installing).getByText('INSTALLED')).toBeInTheDocument()
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
  })
})

describe('Activity Monitor: Software Removal', () => {
  const installedMiner = () => advanceGameState((() => {
    const result = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (result.status !== 'started') throw Error(result.status)
    return result.state
  })(), 20_000)

  const started = () => {
    const result = removeInstalledSoftware(installedMiner(), 'node-miner')
    if (result.status !== 'started') throw Error(result.status)
    return result.state
  }

  it('shows a running removal Process with package, progress, CPU, and RAM under RUNNING', () => {
    render(<GameProvider initialState={started()}><Processes /></GameProvider>)
    const removing = card('SOFTWARE REMOVAL')
    expect(within(removing).getByText('RUNNING')).toBeInTheDocument()
    expect(within(removing).getByText('SOFTWARE')).toBeInTheDocument()
    expect(within(removing).getByText('NODE Miner 1.0')).toBeInTheDocument()
    expect(fact(removing, 'PROGRESS')).toBe('0%')
    expect(fact(removing, 'RAM')).toBe('128 MiB')
  })

  it('appears in Recent Activity with a concrete REMOVED outcome once the Process ends', () => {
    const done = advanceGameState(started(), 20_000)
    render(<GameProvider initialState={done}><Processes /></GameProvider>)
    const removing = card('SOFTWARE REMOVAL')
    expect(removing.dataset.status).toBe('recent')
    expect(within(removing).getByText('REMOVED')).toBeInTheDocument()
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
  })

  it('contends for shared Device CPU/RAM with another running local Process', () => {
    const base = started()
    const state: GameState = { ...base, process: { ...base.process, processes: [...base.process.processes, { kind: 'generic', id: 'process-contention', label: 'Other work', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 100, workCompleted: 0, ramRequiredMiB: 100 }] } }
    render(<GameProvider initialState={state}><Processes /></GameProvider>)
    const removing = card('SOFTWARE REMOVAL')
    expect(fact(removing, 'CPU')).toBe('41%')
  })
})

describe('Activity Monitor: operation subjects', () => {
  /** Two concurrent investigations, exactly as one target SCAN starts them. */
  function twoAnalyses(discovered = true): GameState {
    const base = createInitialGameState()
    const targets = { localDevice: base.player.localDevice, network: base.world.network }
    const discovery = discovered
      ? rememberScan(base.discovery, scanNetworkTarget(targets, '198.51.100.47'), base.player.localDevice.id)
      : base.discovery
    const ssh = startServiceAnalysis({ ...base, discovery }, 'host-lan-001', 'service-ssh-001')
    if (ssh.status !== 'started') throw Error(ssh.status)
    const http = startServiceAnalysis(ssh.state, 'host-lan-001', 'service-http-001')
    if (http.status !== 'started') throw Error(http.status)
    return advanceGameState(http.state, 3000)
  }

  it('names the concrete Service each Analysis is working on while keeping one operation kind', () => {
    render(<GameProvider initialState={twoAnalyses()}><Processes /></GameProvider>)
    const analyses = cards().filter((activity) => within(activity).queryByText('SERVICE ANALYSIS'))
    expect(analyses).toHaveLength(2)

    // Same operation identity, different subjects — readable without comparing ports.
    expect(analyses.map((activity) => activity.querySelector('.am-title strong')?.textContent)).toEqual(['SSH', 'HTTP'])
    expect(analyses.map((activity) => activity.querySelector('.am-route')?.textContent)).toEqual(['198.51.100.47:22', '198.51.100.47:80'])
    for (const activity of analyses) expect(within(activity).getByText('SERVICE ANALYSIS')).toBeInTheDocument()
  })

  it('resolves each subject from remembered Discovery rather than current target truth', () => {
    const known = twoAnalyses()
    // The world's Service names change; the player has observed neither change.
    const renamed = { ...known, world: { network: { ...known.world.network, hosts: known.world.network.hosts.map((host) => host.id === 'host-lan-001'
      ? { ...host, services: host.services!.map((service) => ({ ...service, name: `${service.name}-RENAMED` })) }
      : host) } } }
    render(<GameProvider initialState={renamed}><Processes /></GameProvider>)

    expect(within(monitor()).getByText('SSH')).toBeInTheDocument()
    expect(within(monitor()).queryByText('SSH-RENAMED')).not.toBeInTheDocument()
  })

  it('falls back to the historical endpoint when no Service is remembered at that identity', () => {
    // Terminal `analyze` can legitimately start work against a never-scanned endpoint.
    render(<GameProvider initialState={twoAnalyses(false)}><Processes /></GameProvider>)
    const analyses = cards().filter((activity) => within(activity).queryByText('SERVICE ANALYSIS'))

    expect(analyses.map((activity) => activity.querySelector('.am-title strong')?.textContent)).toEqual(['198.51.100.47:22', '198.51.100.47:80'])
    expect(analyses.every((activity) => within(activity).queryByText('TARGET'))).toBe(true)
    expect(analyses.every((activity) => activity.querySelector('.am-route') === null)).toBe(true)
  })

  it('keeps each Analysis an independent Process with its own resources and cancellation', () => {
    function Snapshot() { return <output>{JSON.stringify(useGameState().process.processes.map(({ id, kind, ramRequiredMiB }) => ({ id, kind, ramRequiredMiB })))}</output> }
    render(<GameProvider initialState={twoAnalyses()}><Processes /><Snapshot /></GameProvider>)

    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual([
      { id: 'process-0001', kind: 'service_analysis', ramRequiredMiB: 768 },
      { id: 'process-0002', kind: 'service_analysis', ramRequiredMiB: 768 },
    ])
    expect(screen.getAllByRole('button', { name: 'Cancel active SERVICE ANALYSIS' })).toHaveLength(2)
    // Two real Processes share the executor's compute, exactly as before.
    const analyses = cards().filter((activity) => within(activity).queryByText('SERVICE ANALYSIS'))
    expect(analyses.map((activity) => fact(activity, 'CPU'))).toEqual(['41%', '41%'])
  })
})

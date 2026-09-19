import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { DeviceAccessFileTransfer, GameState } from '../../core/game/types'
import { appEntries, appRegistry } from '../../shell/appRegistry'
import { Processes } from './Processes'
import processesCss from './processes.css?raw'
import nodeUiCss from '../../styles/nodeui.css?raw'
import monitorSource from './activityMonitor.ts?raw'
import processesSource from './Processes.tsx?raw'
import detailSource from './ActivityDetail.tsx?raw'
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
const load = () => document.querySelector('.am-load') as HTMLElement
const meter = (label: string) => within(load()).getByText(label).closest('.am-meter') as HTMLElement
const rows = () => Array.from(monitor().querySelectorAll('.am-row')) as HTMLElement[]
const rowsOf = (kindLabel: string) => rows().filter((row) => within(row).queryByText(kindLabel))
const row = (kindLabel: string) => rowsOf(kindLabel)[0]
const openRow = (kindLabel: string) => fireEvent.click(row(kindLabel))
const detail = () => document.querySelector('.am-detail') as HTMLElement
const back = () => fireEvent.click(screen.getByRole('button', { name: 'Back to the runtime overview' }))
const fact = (scope: HTMLElement, label: string) => within(scope).getByText(label).parentElement?.querySelector('dd')?.textContent
const section = (heading: string) => within(detail()).getByText(heading).closest('.am-detail-section') as HTMLElement
const railWidths = (scope: HTMLElement) => Array.from(scope.querySelectorAll('.am-rail--stacked i')).map((bar) => (bar as HTMLElement).style.width)

describe('Processes application integration', () => {
  it('is a canonical app while NodeScan remains the one registered network surface', () => { expect(appEntries).toHaveLength(9); expect(appRegistry).toHaveProperty('processes'); expect(appRegistry).toHaveProperty('network'); expect(appRegistry).not.toHaveProperty('networkManagement') })

  it('presents a truthful idle Device load and an explicit idle state', () => {
    render(<GameProvider><Processes /></GameProvider>)
    expect(within(meter('CPU')).getByText('18%')).toBeInTheDocument()
    expect(within(meter('CPU')).getByText('18% BASELINE · NO PROCESS LOAD')).toBeInTheDocument()
    expect(within(meter('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
    expect(within(meter('RAM')).getByText('3154 MiB AVAILABLE')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('NO TRANSFER')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('0 B/s / 2 MiB/s')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('0 B/s / 1 MiB/s')).toBeInTheDocument()

    // An idle Device still has a baseline; it has no Process segments.
    expect(railWidths(meter('CPU'))).toEqual(['18%'])
    expect(screen.getByText('SYSTEM IDLE')).toBeInTheDocument()
    expect(rows()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Clear recent activity' })).not.toBeInTheDocument()
  })

  it('does not observe or clear remote Process runtime from NODE-OS', () => {
    const base = createInitialGameState()
    const remote = { kind: 'generic' as const, id: 'process-remote', label: 'REMOTE WORK', executorDeviceId: 'host-lan-001', status: 'completed' as const, workRequired: 100, workCompleted: 100, ramRequiredMiB: 2048 }
    const initial = { ...base, process: { nextId: 2, processes: [remote] } }
    function Snapshot() { return <output>{JSON.stringify(useGameState().process.processes)}</output> }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    expect(screen.queryByText('REMOTE WORK')).not.toBeInTheDocument()
    expect(within(meter('CPU')).getByText('18%')).toBeInTheDocument()
    expect(within(meter('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear recent activity' })).not.toBeInTheDocument()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual([remote])
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
})

describe('Runtime overview', () => {
  it('leads a running operation with its subject and the one number its runtime reports', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    const analysis = row('SERVICE ANALYSIS')
    expect(within(analysis).getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(analysis.querySelector('.am-row-metric')?.textContent).toBe('25%')
    expect(Array.from(analysis.querySelectorAll('.am-row-summary span')).map((part) => part.textContent)).toEqual(['82% CPU', '768 MiB'])
    expect(analysis.dataset.status).toBe('running')
    expect(within(document.querySelector('.node-section') as HTMLElement).getByText('RUNNING')).toBeInTheDocument()
  })

  it('ties Device load to the running work causing it rather than presenting a free-standing gauge', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    // Baseline first, then this Process's own canonical allocation/reservation.
    expect(railWidths(meter('CPU'))).toEqual(['18%', '82%'])
    expect(railWidths(meter('RAM'))).toEqual(['23%', '18.75%'])
    expect(within(meter('CPU')).getByText('100%')).toBeInTheDocument()
    expect(within(meter('CPU')).getByText('18% BASELINE · 1 PROCESS')).toBeInTheDocument()
    expect(within(meter('RAM')).getByText('1710 / 4096 MiB')).toBeInTheDocument()
    expect(within(meter('RAM')).getByText('2386 MiB AVAILABLE')).toBeInTheDocument()
  })

  it('carries one load segment per concurrently running Process and none for a transfer', () => {
    const base = withProcesses()
    const concurrent: GameState = { ...base, process: { ...base.process, processes: [
      base.process.processes[0],
      { kind: 'generic', id: 'process-0003', label: 'Second work', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 100, workCompleted: 0, ramRequiredMiB: 256 },
    ] } }
    render(<GameProvider initialState={withDownload(concurrent)}><Processes /></GameProvider>)
    expect(within(meter('CPU')).getByText('18% BASELINE · 2 PROCESSES')).toBeInTheDocument()
    expect(railWidths(meter('CPU'))).toEqual(['18%', '41%', '41%'])
    // The transfer runs at the same time and adds nothing to either rail.
    expect(railWidths(meter('RAM'))).toEqual(['23%', '12.5%', '6.25%'])
    expect(rows()).toHaveLength(3)
  })

  it('keeps running work loud and ended work quiet in separate sections', () => {
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    const running = rows().find((candidate) => candidate.dataset.status === 'running') as HTMLElement
    expect(within(running).getByText('Active analysis')).toBeInTheDocument()
    const finished = within(monitor()).getByText('Finished analysis').closest('.am-row') as HTMLElement
    expect(finished.dataset.status).toBe('recent')
    // Ended work is told by placement and concrete outcome, not by a generic lifecycle label.
    expect(within(finished).queryByText(/COMPLETED|STOPPED|CANCELLED/)).not.toBeInTheDocument()
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
    // Only running work reports what it is currently holding.
    expect(finished.querySelector('.am-row-summary')).toBeNull()
    expect(running.querySelector('.am-row-summary')?.textContent).toContain('512 MiB')
  })

  it('counts only running activity in the filter badges while retaining ended work in filtered history', () => {
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

  it('excludes transfer activity from OPERATIONS and Process activity from TRANSFERS', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(rows()).toHaveLength(1)
    expect(within(monitor()).getByText('SERVICE ANALYSIS')).toBeInTheDocument()
    expect(within(monitor()).queryByText('DOWNLOAD')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }))
    expect(rows()).toHaveLength(1)
    expect(within(monitor()).getByText('DOWNLOAD')).toBeInTheDocument()
    expect(within(monitor()).queryByText('SERVICE ANALYSIS')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All activity' }))
    expect(rows()).toHaveLength(2)
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

  it('shows operations and the active transfer together under ALL', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(row('SERVICE ANALYSIS')).toBeInTheDocument()
    expect(within(row('DOWNLOAD')).getByText('nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(rows()).toHaveLength(2)
  })

  it('carries no lifecycle control in the overview, so a busy list stays scannable', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    for (const candidate of rows()) expect(within(candidate).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Cancel|^Stop|^Payout|^Remove/ })).not.toBeInTheDocument()
  })
})

describe('Activity detail navigation', () => {
  it('opens one activity, presents what its runtime supports, and returns to the overview', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    openRow('SERVICE ANALYSIS')
    expect(load()).toBeNull()
    expect(within(detail()).getByText('SERVICE ANALYSIS')).toBeInTheDocument()
    expect(within(detail()).getByText('RUNNING')).toBeInTheDocument()
    expect(within(detail()).getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(within(detail()).getByText('LOCAL · node-01')).toBeInTheDocument()
    expect(fact(section('WORK'), 'COMPLETION')).toBe('FINITE')
    expect(fact(section('WORK'), 'COMPUTE')).toBe('246 / 1,000')
    expect(fact(section('RESOURCES'), 'CPU')).toBe('82%')
    expect(fact(section('RESOURCES'), 'RAM')).toBe('768 MiB')

    back()
    expect(load()).toBeInTheDocument()
    expect(row('SERVICE ANALYSIS')).toBeInTheDocument()
  })

  it('keeps the player on the activity they are inspecting when it ends beneath them', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    openRow('SERVICE ANALYSIS')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel active SERVICE ANALYSIS' }))
    // Still the same activity's surface, now stating its own end.
    expect(detail().dataset.status).toBe('recent')
    expect(within(detail()).getByText('CANCELLED')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel active SERVICE ANALYSIS' })).not.toBeInTheDocument()
  })

  it('returns to the overview when the inspected activity no longer exists', () => {
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    fireEvent.click(within(monitor()).getByText('Finished analysis').closest('.am-row') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Remove recent PROCESS activity' }))
    expect(detail()).toBeNull()
    expect(load()).toBeInTheDocument()
    expect(screen.queryByText('Finished analysis')).not.toBeInTheDocument()
    expect(screen.getByText('Active analysis')).toBeInTheDocument()
  })
})

describe('Activity detail: finite operations', () => {
  it('renders every concrete completed Process result', () => {
    // Endpoint Analysis completes identically regardless of Service: it remembers implementation
    // evidence only and never creates or reveals Vulnerability Knowledge.
    const ssh = render(<GameProvider initialState={completedAnalysis()}><Processes /></GameProvider>)
    expect(within(row('SERVICE ANALYSIS')).getByText('ENDPOINT ANALYZED')).toBeInTheDocument()
    ssh.unmount()

    const none = render(<GameProvider initialState={completedAnalysis('service-http-001')}><Processes /></GameProvider>)
    expect(screen.getByText('ENDPOINT ANALYZED')).toBeInTheDocument()
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
    expect(screen.getByText('ATTEMPT FAILED')).toBeInTheDocument()
    fireEvent.click(rowsOf('CREDENTIAL ACCESS')[0])
    expect(within(detail()).getByText('USER PRIVILEGE')).toBeInTheDocument()
    expect(within(detail()).getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(fact(section('SURFACE'), 'WEAKNESS')).toBe('AUTH-017')
  })

  it('CANCEL reaches the canonical operation, preserves partial progress, and claims no resources afterwards', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    openRow('SERVICE ANALYSIS')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel active SERVICE ANALYSIS' }))
    expect(within(detail()).getByText('CANCELLED')).toBeInTheDocument()
    // Cancellation preserves the partial progress it reached, and claims nothing.
    expect(detail().querySelector('.am-detail-progress-value')?.textContent).toBe('25%')
    expect(fact(section('WORK'), 'COMPUTE')).toBe('246 / 1,000')
    expect(within(detail()).queryByText('RESOURCES')).not.toBeInTheDocument()
    back()
    expect(row('SERVICE ANALYSIS').dataset.status).toBe('recent')
    expect(within(meter('CPU')).getByText('18%')).toBeInTheDocument()
    expect(within(meter('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
  })

  it('claims no resource ownership for work that has ended', () => {
    render(<GameProvider initialState={completedAnalysis()}><Processes /></GameProvider>)
    openRow('SERVICE ANALYSIS')
    // Ended work released its allocation; it states no resource block at all
    // rather than a block of zeroes.
    expect(within(detail()).queryByText('RESOURCES')).not.toBeInTheDocument()
    expect(within(detail()).queryByText('CPU')).not.toBeInTheDocument()
    expect(within(detail()).queryByText('RAM')).not.toBeInTheDocument()
    expect(fact(section('WORK'), 'COMPUTE')).toBe('1,000 / 1,000')
  })

  it('does not rewrite the historical target when the current service port changes', () => {
    const completed = completedAnalysis(); const host = completed.world.network.hosts[0]
    const moved: GameState = { ...completed, world: { network: { ...completed.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) }, ...completed.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={moved}><Processes /></GameProvider>)
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(screen.queryByText('198.51.100.47:2222')).not.toBeInTheDocument()
  })
})

describe('Activity Monitor: Recent Activity', () => {
  it('confirms before clearing history while running work remains visible', () => {
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
    expect(screen.getByText('Active analysis')).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('discards a completed result without changing knowledge or world state', () => {
    const initial = completedAnalysis(); const world = initial.world; const knowledge = initial.knowledge
    function Snapshot() { const state = useGameState(); return <output>{JSON.stringify({ worldSame: state.world === world, knowledgeSame: state.knowledge === knowledge, knowledge: state.knowledge })}</output> }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear recent activity' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Clear recent activity?' })).getByRole('button', { name: 'CLEAR' }))
    expect(screen.queryByText('ENDPOINT ANALYZED')).not.toBeInTheDocument()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toMatchObject({ worldSame: true, knowledgeSame: true, knowledge: { bookstoreMarket: { nextReportId: 1, reports: [] }, discoveredVulnerabilities: [] } })
  })

  it('removes one ended activity through GameActions without changing gameplay truth or other work', () => {
    const base = completedAnalysis()
    const first = base.process.processes[0]
    const initial: GameState = { ...base, process: { nextId: 3, processes: [first, { ...first, id: 'process-0002', label: 'SECOND COMPLETION' }] } }
    const truth = { world: initial.world, knowledge: initial.knowledge, deviceAccess: initial.deviceAccess, filesystem: initial.player.localDevice.filesystem }
    function Snapshot() {
      const state = useGameState()
      return <output>{JSON.stringify({ ids: state.process.processes.map(({ id }) => id), nextId: state.process.nextId, worldSame: state.world === truth.world, knowledgeSame: state.knowledge === truth.knowledge, accessSame: state.deviceAccess === truth.deviceAccess, filesystemSame: state.player.localDevice.filesystem === truth.filesystem })}</output>
    }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(rowsOf('SERVICE ANALYSIS')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Remove recent SERVICE ANALYSIS activity' }))
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ ids: ['process-0002'], nextId: 3, worldSame: true, knowledgeSame: true, accessSame: true, filesystemSame: true })
    expect(screen.getByText('SECOND COMPLETION')).toBeInTheDocument()
  })

  it('offers no history controls where no history is represented', () => {
    render(<GameProvider initialState={withDownload(withProcesses())}><Processes /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }))
    expect(screen.queryByText('RECENT ACTIVITY')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear recent activity' })).not.toBeInTheDocument()
  })
})

describe('Activity Monitor: FileTransfer', () => {
  it('derives Download progress and transferred bytes from the canonical transfer', () => {
    const { unmount } = render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    expect(row('DOWNLOAD').querySelector('.am-row-metric')?.textContent).toBe('25%')
    expect(row('DOWNLOAD').querySelector('.am-row-summary')?.textContent).toContain('4.6 / 18.4 MB')
    unmount()
    const { unmount: unmount2 } = render(<GameProvider initialState={withDownload(createInitialGameState(), { bytesTransferred: 13_800_000 })}><Processes /></GameProvider>)
    expect(row('DOWNLOAD').querySelector('.am-row-metric')?.textContent).toBe('75%')
    unmount2()
    render(<GameProvider initialState={withDownload(createInitialGameState(), { bytesTransferred: 400_000 })}><Processes /></GameProvider>)
    expect(row('DOWNLOAD').querySelector('.am-row-metric')?.textContent).toBe('2%')
    openRow('DOWNLOAD')
    expect(fact(section('TRANSFER'), 'TRANSFERRED')).toBe('400 KB / 18.4 MB')
    // The subject line already leads with progress; the block must not repeat it.
    expect(detail().querySelector('.am-detail-progress-value')?.textContent).toBe('2%')
    expect(within(section('TRANSFER')).queryByText('PROGRESS')).not.toBeInTheDocument()
  })

  it('presents the transfer route and artifact relationship in detail, not in the overview row', () => {
    render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    expect(row('DOWNLOAD').textContent).not.toContain('/opt/packages/nodescan-exp-1.1.pkg')
    openRow('DOWNLOAD')
    expect(within(detail()).getByText('nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(fact(section('ROUTE'), 'SOURCE')).toBe('/opt/packages/nodescan-exp-1.1.pkg')
    expect(fact(section('ROUTE'), 'DESTINATION')).toBe('/home/user/downloads/nodescan-exp-1.1.pkg')
  })

  it('derives current Download speed and network usage from current endpoint capacities', () => {
    const { unmount } = render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    // srv-01 uploads at 8 MiB/s, so the local 2 MiB/s download capacity is the limit.
    expect(within(meter('NETWORK')).getByText('2 MiB/s DOWNLOAD')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('2 MiB/s / 2 MiB/s')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('0 B/s / 1 MiB/s')).toBeInTheDocument()
    openRow('DOWNLOAD')
    expect(fact(section('TRANSFER'), 'RATE')).toBe('2 MiB/s')
    expect(fact(section('TRANSFER'), 'LINK CAPACITY')).toBe('2 MiB/s')
    unmount()

    render(<GameProvider initialState={withDownload(withLocalDownloadCapacity(524_288))}><Processes /></GameProvider>)
    expect(within(meter('NETWORK')).getByText('512 KiB/s DOWNLOAD')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('512 KiB/s / 512 KiB/s')).toBeInTheDocument()
  })

  it('never represents the FileTransfer as a GameProcess or gives it Process CPU or RAM', () => {
    function Snapshot() { const state = useGameState(); return <output>{JSON.stringify({ processes: state.process.processes.length, transfer: Boolean(state.fileTransfer.active) })}</output> }
    render(<GameProvider initialState={withDownload()}><Processes /><Snapshot /></GameProvider>)
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ processes: 0, transfer: true })
    // A transfer contributes no segment to either Process rail.
    expect(railWidths(meter('CPU'))).toEqual(['18%'])
    expect(railWidths(meter('RAM'))).toEqual(['23%'])
    expect(within(meter('CPU')).getByText('18% BASELINE · NO PROCESS LOAD')).toBeInTheDocument()
    openRow('DOWNLOAD')
    expect(within(detail()).queryByText('RESOURCES')).not.toBeInTheDocument()
    expect(within(detail()).queryByText('CPU')).not.toBeInTheDocument()
    expect(within(detail()).queryByText('RAM')).not.toBeInTheDocument()
    back()
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getByText('NO RUNNING OPERATIONS')).toBeInTheDocument()
    expect(rows()).toHaveLength(0)
  })

  it('displays the active Download with no active RemoteSession and leaks no remote identity', () => {
    render(<GameProvider initialState={withDownload()}><Processes /></GameProvider>)
    expect(row('DOWNLOAD').textContent).not.toMatch(/srv-01|198\.51\.100\.47/)
    openRow('DOWNLOAD')
    expect(detail().textContent).not.toMatch(/srv-01|198\.51\.100\.47/)
    expect(fact(section('TRANSFER'), 'RATE')).toBe('2 MiB/s')
  })

  it('uses only the matching Session retained address and omits a route after disconnect', () => {
    const { unmount } = render(<GameProvider initialState={withDownload(createInitialGameState(), {}, true)}><Processes /></GameProvider>)
    const withSession = row('DOWNLOAD').textContent
    unmount()
    render(<GameProvider initialState={withDownload(createInitialGameState(), {}, false)}><Processes /></GameProvider>)
    expect(withSession).toContain('198.51.100.47 → node-01')
    expect(row('DOWNLOAD').textContent).not.toContain('198.51.100.47')
    expect(row('DOWNLOAD').textContent).not.toContain('srv-01')
  })

  it('presents Upload orientation, canonical progress, upload network usage, and survives disconnect privately', () => {
    const { unmount } = render(<GameProvider initialState={withUpload(createInitialGameState(), true)}><Processes /></GameProvider>)
    const upload = row('UPLOAD')
    expect(within(upload).getByText('node-01 → 203.0.113.88')).toBeInTheDocument()
    expect(upload.querySelector('.am-row-metric')?.textContent).toBe('41%')
    expect(within(meter('NETWORK')).getByText('1 MiB/s UPLOAD')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('1 MiB/s / 1 MiB/s')).toBeInTheDocument()
    expect(within(meter('NETWORK')).getByText('0 B/s / 2 MiB/s')).toBeInTheDocument()
    openRow('UPLOAD')
    expect(fact(section('ROUTE'), 'SOURCE')).toBe('/home/user/downloads/node-miner-1.0.pkg')
    expect(fact(section('ROUTE'), 'DESTINATION')).toBe('/home/user/node-miner-1.0.pkg')
    unmount()

    render(<GameProvider initialState={withUpload()}><Processes /></GameProvider>)
    expect(row('UPLOAD')).toBeInTheDocument()
    expect(row('UPLOAD').textContent).not.toMatch(/203\.0\.113\.88|srv-01/)
  })

  it('offers CANCEL, not REMOVE, on the running transfer, and invokes the canonical GameAction', () => {
    const initial = withDownload()
    function Snapshot() {
      const state = useGameState()
      return <output>{JSON.stringify({ accessCount: state.deviceAccess.established.length, processCount: state.process.processes.length, nextId: state.fileTransfer.nextId })}</output>
    }
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    openRow('DOWNLOAD')
    expect(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Stop/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel active DOWNLOAD' }))
    expect(detail().dataset.status).toBe('recent')
    expect(screen.queryByRole('button', { name: 'Cancel active DOWNLOAD' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove recent DOWNLOAD activity' })).toBeInTheDocument()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ accessCount: 1, processCount: 0, nextId: 2 })
    back()
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
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

  it('marks continuous runtime as continuous instead of giving it a completion bar', () => {
    render(<GameProvider initialState={minerState()}><Processes /></GameProvider>)
    const miner = row('NODE MINER')
    expect(miner.querySelector('progress')).not.toBeInTheDocument()
    expect(within(miner).getByText('CONTINUOUS')).toBeInTheDocument()
    expect(miner.querySelector('.am-row-metric')?.textContent).toBe('82 units/s')
    expect(Array.from(miner.querySelectorAll('.am-row-summary span')).map((part) => part.textContent)).toEqual(['82% CPU', '512 MiB', '0 units unpaid'])

    openRow('NODE MINER')
    expect(detail().querySelector('progress')).not.toBeInTheDocument()
    expect(within(detail()).getByText(/CONTINUOUS RUNTIME/)).toBeInTheDocument()
    expect(fact(section('PRODUCTION'), 'COMPLETION')).toBe('CONTINUOUS')
    expect(fact(section('RESOURCES'), 'CPU')).toBe('82%')
    expect(fact(section('RESOURCES'), 'RAM')).toBe('512 MiB')
    expect(fact(section('CONFIGURATION'), 'PAYOUT ADDRESS')).toBe('node-wallet-addr-0001')
  })

  it('derives gross produced and unpaid production from real deterministic elapsed compute', () => {
    const advanced = advanceGameState(minerState(), 3000)
    render(<GameProvider initialState={advanced}><Processes /></GameProvider>)
    // node-01: computeCapacity 100, baseline 18% -> ~82 atomic NODE units/s allocated while running alone.
    openRow('NODE MINER')
    expect(fact(section('PRODUCTION'), 'PRODUCED')).toBe('246 units')
    expect(fact(section('PRODUCTION'), 'UNPAID')).toBe('246 units')
    expect(fact(section('PRODUCTION'), 'RATE')).toBe('82 units/s')
  })

  it('presents the same unpaid production whether or not the address matches the represented Wallet', () => {
    const advanced = advanceGameState(minerState('an-unmatched-fictional-address'), 3000)
    render(<GameProvider initialState={advanced}><Processes /></GameProvider>)
    openRow('NODE MINER')
    expect(fact(section('PRODUCTION'), 'PRODUCED')).toBe('246 units')
    expect(fact(section('PRODUCTION'), 'UNPAID')).toBe('246 units')
    expect(fact(section('CONFIGURATION'), 'PAYOUT ADDRESS')).toBe('an-unmatched-fictional-address')
  })

  it('never exposes the embedded developer destination of the running release', () => {
    const advanced = advanceGameState(minerState(), 3000)
    render(<GameProvider initialState={advanced}><Processes /></GameProvider>)
    openRow('NODE MINER')
    expect(document.body.textContent).not.toContain(NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS)
    expect(document.body.textContent).not.toMatch(/DEVELOPER|FEE/i)
  })

  it('offers PAYOUT and STOP rather than CANCEL, and STOP releases the reserved resources', () => {
    render(<GameProvider initialState={advanceGameState(minerState(), 3000)}><Processes /></GameProvider>)
    openRow('NODE MINER')
    expect(screen.getByRole('button', { name: 'Payout NODE MINER' })).toHaveTextContent('PAYOUT')
    expect(screen.getByRole('button', { name: 'Stop NODE MINER' })).toHaveTextContent('STOP')
    expect(screen.queryByRole('button', { name: /Cancel/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Stop NODE MINER' }))
    expect(detail().dataset.status).toBe('recent')
    expect(within(detail()).queryByText(/STOPPED|COMPLETED|CANCELLED/)).not.toBeInTheDocument()
    back()
    expect(within(meter('RAM')).getByText('942 / 4096 MiB')).toBeInTheDocument()
    expect(within(meter('CPU')).getByText('18%')).toBeInTheDocument()
    expect(row('NODE MINER').dataset.status).toBe('recent')
    expect(row('NODE MINER').querySelector('.am-row-metric')?.textContent).toBe('246 units')
  })

  it('STOP preserves Process ID progression, so a later RUN receives a new identity', () => {
    const state = minerState()
    const originalId = state.process.processes[0].id
    function Snapshot() { return <output>{JSON.stringify({ ids: useGameState().process.processes.map(({ id }) => id), nextId: useGameState().process.nextId })}</output> }
    render(<GameProvider initialState={state}><Processes /><Snapshot /></GameProvider>)
    openRow('NODE MINER')
    fireEvent.click(screen.getByRole('button', { name: 'Stop NODE MINER' }))
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual({ ids: [], nextId: state.process.nextId })

    const minerFile = { kind: 'executable' as const, id: 'file-fixture-miner-2', path: '/home/user/node-miner-again.bin', programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
    const withFile: GameState = { ...state, process: { nextId: state.process.nextId, processes: [] }, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { nextFileId: 51, files: [...state.player.localDevice.filesystem.files, minerFile] } } } }
    const restarted = startNodeMiner(withFile, minerFile.path, withFile.nodeWallet.address)
    if (restarted.status !== 'started') throw new Error(restarted.status)
    expect(restarted.processId).not.toBe(originalId)
    expect(restarted.state.process.nextId).toBe(state.process.nextId + 1)
  })
})

describe('Activity Monitor: Software Installation and Removal', () => {
  const installing = () => {
    const result = installLocalSoftwarePackage(createInitialGameState(), '/home/user/downloads/node-miner-1.0.pkg')
    if (result.status !== 'started') throw Error(result.status)
    return result.state
  }
  const removing = () => {
    const result = removeInstalledSoftware(advanceGameState(installing(), 20_000), 'node-miner')
    if (result.status !== 'started') throw Error(result.status)
    return result.state
  }

  it('shows a running installation with its package, progress, and reserved resources', () => {
    render(<GameProvider initialState={installing()}><Processes /></GameProvider>)
    const install = row('SOFTWARE INSTALLATION')
    expect(within(install).getByText('PACKAGE')).toBeInTheDocument()
    expect(within(install).getByText('NODE Miner 1.0')).toBeInTheDocument()
    expect(install.querySelector('.am-row-metric')?.textContent).toBe('0%')
    openRow('SOFTWARE INSTALLATION')
    expect(fact(section('RESOURCES'), 'CPU')).toBe('82%')
    expect(fact(section('RESOURCES'), 'RAM')).toBe('256 MiB')
    expect(fact(section('SUBJECT'), 'RELEASE')).toBe('node-miner-1.0')
  })

  it('appears in Recent Activity with a concrete INSTALLED outcome once the Process ends', () => {
    render(<GameProvider initialState={advanceGameState(installing(), 20_000)}><Processes /></GameProvider>)
    const install = row('SOFTWARE INSTALLATION')
    expect(install.dataset.status).toBe('recent')
    expect(within(install).getByText('INSTALLED')).toBeInTheDocument()
    expect(screen.getByText('RECENT ACTIVITY')).toBeInTheDocument()
  })

  it('shows a running removal and its concrete REMOVED outcome once the Process ends', () => {
    const { unmount } = render(<GameProvider initialState={removing()}><Processes /></GameProvider>)
    const removal = row('SOFTWARE REMOVAL')
    expect(within(removal).getByText('SOFTWARE')).toBeInTheDocument()
    expect(within(removal).getByText('NODE Miner 1.0')).toBeInTheDocument()
    openRow('SOFTWARE REMOVAL')
    expect(fact(section('RESOURCES'), 'RAM')).toBe('128 MiB')
    unmount()

    render(<GameProvider initialState={advanceGameState(removing(), 20_000)}><Processes /></GameProvider>)
    expect(row('SOFTWARE REMOVAL').dataset.status).toBe('recent')
    expect(within(row('SOFTWARE REMOVAL')).getByText('REMOVED')).toBeInTheDocument()
  })

  it('contends for shared Device CPU/RAM with another running local Process', () => {
    const base = removing()
    const state: GameState = { ...base, process: { ...base.process, processes: [...base.process.processes, { kind: 'generic', id: 'process-contention', label: 'Other work', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 100, workCompleted: 0, ramRequiredMiB: 100 }] } }
    render(<GameProvider initialState={state}><Processes /></GameProvider>)
    openRow('SOFTWARE REMOVAL')
    expect(fact(section('RESOURCES'), 'CPU')).toBe('41%')
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
    const analyses = rowsOf('SERVICE ANALYSIS')
    expect(analyses).toHaveLength(2)

    // Same operation identity, different subjects — readable without comparing ports.
    expect(analyses.map((activity) => activity.querySelector('.am-row-title')?.textContent)).toEqual(['SSH', 'HTTP'])
    expect(analyses.map((activity) => activity.querySelector('.am-row-route')?.textContent)).toEqual(['198.51.100.47:22', '198.51.100.47:80'])
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
    const analyses = rowsOf('SERVICE ANALYSIS')

    expect(analyses.map((activity) => activity.querySelector('.am-row-title')?.textContent)).toEqual(['198.51.100.47:22', '198.51.100.47:80'])
    expect(analyses.every((activity) => within(activity).queryByText('TARGET'))).toBe(true)
    expect(analyses.every((activity) => activity.querySelector('.am-row-route') === null)).toBe(true)
  })

  it('keeps each Analysis an independent Process with its own resources and cancellation', () => {
    function Snapshot() { return <output>{JSON.stringify(useGameState().process.processes.map(({ id, kind, ramRequiredMiB }) => ({ id, kind, ramRequiredMiB })))}</output> }
    render(<GameProvider initialState={twoAnalyses()}><Processes /><Snapshot /></GameProvider>)

    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toEqual([
      { id: 'process-0001', kind: 'service_analysis', ramRequiredMiB: 768 },
      { id: 'process-0002', kind: 'service_analysis', ramRequiredMiB: 768 },
    ])
    // Two real Processes share the executor's compute, exactly as before.
    expect(rowsOf('SERVICE ANALYSIS').map((activity) => Array.from(activity.querySelectorAll('.am-row-summary span')).map((part) => part.textContent)))
      .toEqual([['41% CPU', '768 MiB'], ['41% CPU', '768 MiB']])

    fireEvent.click(rowsOf('SERVICE ANALYSIS')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Cancel active SERVICE ANALYSIS' }))
    back()
    expect(rowsOf('SERVICE ANALYSIS').filter((activity) => activity.dataset.status === 'running')).toHaveLength(1)
    expect(within(meter('CPU')).getByText('18% BASELINE · 1 PROCESS')).toBeInTheDocument()
  })
})

describe('Activity Monitor presentation contract', () => {
  it('represents only currently implemented activity types', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(within(document.querySelector('.am-filters') as HTMLElement).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['ALL2', 'OPERATIONS1', 'TRANSFERS1'])
    expect(monitor().textContent).not.toMatch(/UPLOAD|CRACK|MALWARE/i)
    expect(monitorSource + processesSource + detailSource).not.toMatch(/cracking|malware/i)
  })

  it('keeps every interactive surface touch-safe and introduces no viewport system of its own', () => {
    const filterRule = processesCss.match(/\.am-filter\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(filterRule).toMatch(/min-height:\s*44px/)
    expect(filterRule).toMatch(/flex:\s*1/)
    expect(filterRule).toMatch(/min-width:\s*0/)
    expect(processesCss).toMatch(/\.am-filters\s*\{[^}]*display:\s*flex/)
    expect(processesCss.match(/\.am-clear\s*\{([^}]+)\}/)?.[1] ?? '').toMatch(/min-height:\s*44px/)
    // Rows and lifecycle actions are the two tap targets the redesign added.
    expect(processesCss.match(/\.am-row\s*\{([^}]+)\}/)?.[1] ?? '').toMatch(/min-height:\s*64px/)
    expect(nodeUiCss.match(/\.node-action\s*\{([^}]+)\}/)?.[1] ?? '').toMatch(/min-height:\s*44px/)
    expect(nodeUiCss.match(/\.node-back\s*\{([^}]+)\}/)?.[1] ?? '').toMatch(/min-height:\s*44px/)
    expect(processesSource + monitorSource + detailSource).not.toMatch(/scrollIntoView|window\.scrollTo|visualViewport/)
  })

  it('reaches canonical operations rather than mutating presentation-owned state', () => {
    // Every lifecycle control on the detail surface is a GameActions call.
    expect(detailSource).not.toMatch(/useGameState|useGameActions/)
    expect(processesSource).toMatch(/actions\.cancelLocalProcess/)
    expect(processesSource).toMatch(/actions\.cancelFileTransfer/)
    expect(processesSource).toMatch(/actions\.stopNodeMiner/)
    expect(processesSource).toMatch(/actions\.payoutLocalNodeMiner/)
    expect(processesSource).toMatch(/actions\.removeRecentActivity/)
    expect(processesSource).toMatch(/actions\.clearRecentActivity/)
  })
})

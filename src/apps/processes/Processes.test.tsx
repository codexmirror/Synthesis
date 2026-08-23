import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { FileTransfer, GameState } from '../../core/game/types'
import { appEntries, appRegistry } from '../../shell/appRegistry'
import { Processes } from './Processes'
import processesCss from './processes.css?raw'
import monitorSource from './activityMonitor.ts?raw'
import processesSource from './Processes.tsx?raw'
import { startServiceAnalysis } from '../../core/game/serviceAnalysis'
import { advanceGameState } from '../../core/game/gameAdvancement'

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
/** Canonical remote-authority chain for the one currently represented transfer. */
const withDownload = (base: GameState = createInitialGameState(), transfer: Partial<FileTransfer> = {}): GameState => ({
  ...base,
  deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
  remoteSession: { nextId: 2, active: { id: 'session-0001', accessId: 'access-0001', connectedAddress: '198.51.100.47' } },
  fileTransfer: { nextId: 2, active: {
    id: 'transfer-0001', sessionId: 'session-0001', sourceDeviceId: 'host-lan-001', sourceFileId: 'file-0002',
    destinationDeviceId: base.player.localDevice.id, destinationPath: '/home/user/downloads/nodescan-exp-1.1.pkg',
    bytesTotal: 18_400_000, bytesTransferred: 4_600_000, ...transfer,
  } },
})
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
  it('is the seventh canonical app while Network remains registered', () => { expect(appEntries).toHaveLength(7); expect(appRegistry).toHaveProperty('processes'); expect(appRegistry).toHaveProperty('network') })

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
    expect(screen.queryByRole('button', { name: 'Clear completed processes' })).not.toBeInTheDocument()
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
    expect(finished.dataset.status).toBe('completed')
    expect(within(finished).getByText('COMPLETED')).toBeInTheDocument()
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
    function Snapshot() { const value = useGameState().process.processes[0].workCompleted; return <output>{value}</output> }
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
        { kind: 'credential_access', id: 'process-0001', label: 'CREDENTIAL ACCESS', executorDeviceId: base.player.localDevice.id, status: 'completed', workRequired: 1200, workCompleted: 1200, ramRequiredMiB: 896, targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:22', vulnerabilityId: 'vulnerability-ssh-001', toolId: 'basic-credential-toolkit', result: { status: 'access_established', accessId: 'access-0001' } },
        { kind: 'credential_access', id: 'process-0002', label: 'CREDENTIAL ACCESS', executorDeviceId: base.player.localDevice.id, status: 'completed', workRequired: 1200, workCompleted: 1200, ramRequiredMiB: 896, targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002', startedEndpoint: '198.51.100.53:22', vulnerabilityId: 'vulnerability-ssh-002', toolId: 'basic-credential-toolkit', result: { status: 'attempt_failed', message: 'Target no longer responds as expected.' } },
      ] } }
    render(<GameProvider initialState={credential}><Processes /></GameProvider>)
    expect(screen.getByText('ACCESS ESTABLISHED')).toBeInTheDocument()
    expect(screen.getByText('USER PRIVILEGE')).toBeInTheDocument()
    expect(screen.getByText('ATTEMPT FAILED')).toBeInTheDocument()
    expect(screen.getByText('Target no longer responds as expected.')).toBeInTheDocument()
  })

  it('confirms before clearing completed cards while running work remains visible', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    const clear = screen.getByRole('button', { name: 'Clear completed processes' })
    fireEvent.click(clear)
    expect(confirm).toHaveBeenLastCalledWith('Clear completed process history?')
    expect(screen.getByText('Finished analysis')).toBeInTheDocument()
    fireEvent.click(clear)
    expect(screen.queryByText('Finished analysis')).not.toBeInTheDocument()
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument()
    expect(screen.getByText('Active analysis')).toBeInTheDocument()
  })

  it('discards a completed result without changing knowledge or world state', () => {
    const initial = completedAnalysis(); const world = initial.world; const knowledge = initial.knowledge
    function Snapshot() { const state = useGameState(); return <output>{JSON.stringify({ worldSame: state.world === world, knowledgeSame: state.knowledge === knowledge, knowledge: state.knowledge })}</output> }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<GameProvider initialState={initial}><Processes /><Snapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Clear completed processes' }))
    expect(screen.queryByText('WEAKNESS DETECTED')).not.toBeInTheDocument()
    expect(JSON.parse(screen.getByRole('status').textContent ?? '')).toMatchObject({ worldSame: true, knowledgeSame: true, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'vulnerability-ssh-001' }] } })
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
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove completed SERVICE ANALYSIS process' })[0])
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
  it('shows operations and the active transfer under ALL', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(card('SERVICE ANALYSIS')).toBeInTheDocument()
    const download = card('DOWNLOAD')
    expect(within(download).getByText('nodescan-exp-1.1.pkg')).toBeInTheDocument()
    expect(within(download).getByText('srv-01 → node-01')).toBeInTheDocument()
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
    expect(screen.getByText('Completed transfers are not recorded.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Operations' }))
    expect(screen.getByText('NO RUNNING OPERATIONS')).toBeInTheDocument()
  })

  it('offers no completed transfer history, because none is represented', () => {
    render(<GameProvider initialState={withDownload(withProcesses())}><Processes /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Transfers' }))
    expect(screen.queryByText('COMPLETED')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear completed processes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove completed/ })).not.toBeInTheDocument()
  })

  it('offers individual removal only on completed Process cards', () => {
    render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>)
    expect(within(card('PROCESS')).queryByRole('button', { name: /Remove completed/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove completed PROCESS process' })).toBeInTheDocument()
    const removeRule = processesCss.match(/\.am-remove\s*\{([^}]+)\}/)?.[1] ?? ''
    expect(removeRule).toMatch(/min-height:\s*44px/)
  })

  it('represents only currently implemented activity types', () => {
    render(<GameProvider initialState={withDownload(runningAnalysis())}><Processes /></GameProvider>)
    expect(within(document.querySelector('.am-filters') as HTMLElement).getAllByRole('button').map((button) => button.textContent))
      .toEqual(['ALL2', 'OPERATIONS1', 'TRANSFERS1'])
    expect(monitor().textContent).not.toMatch(/UPLOAD|MINER|MINING|CRACK|MALWARE/i)
    expect(monitorSource + processesSource).not.toMatch(/miner|cracking|malware/i)
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

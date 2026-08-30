import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as GameContext from '../../app/GameContext'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { appRegistry } from '../../shell/appRegistry'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { scanNetworkTarget } from '../../core/game/scan'
import { rememberInspect, rememberPing, rememberScan } from '../../core/game/discovery'
import { inspectKnownTarget } from '../../core/game/inspect'
import { pingNetworkTarget } from '../../core/game/ping'
import type { CredentialAccessProcess, GameState, ServiceAnalysisProcess } from '../../core/game/types'
import { Network } from './Network'
import { selectKnownSpace, selectTarget, selectTargets } from './targetProjection'
import { FLIPPER_1_0_CANONICAL_INSTALLATION, ROLLBACK_MODULE_1_0 } from '../../core/game/flipper'
import { FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID } from '../../core/game/softwareReleaseContent'

const scanTargetSpy = vi.hoisted(() => vi.fn())
vi.mock('../../core/game/scan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/game/scan')>()
  return { ...actual, scanNetworkTarget: (...args: Parameters<typeof actual.scanNetworkTarget>) => { scanTargetSpy(...args); return actual.scanNetworkTarget(...args) } }
})

const SRV_01 = 'host-lan-001'
const SRV_01_ADDRESS = '198.51.100.47'
const PHONE_ADDRESS = '198.51.100.61'

/* ---------------------------------------------------------------- fixtures */

function withNodeScan11(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software) } } }
}

function withoutSoftware(state: GameState, productId: string): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== productId) } } }
}

/** Discovery after looking around: home-net and its members are remembered. */
function foundTargets(state: GameState = createInitialGameState()): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  return { ...state, discovery }
}

/** Discovery after an explicit Device Scan: srv-01's Services are remembered. */
function scannedTarget(state: GameState = createInitialGameState()): GameState {
  const known = foundTargets(state)
  const targets = { localDevice: known.player.localDevice, network: known.world.network }
  let discovery = rememberScan(known.discovery, scanNetworkTarget(targets, SRV_01_ADDRESS), known.player.localDevice.id)
  if (known.player.localDevice.installedSoftware.some(({ releaseId }) => releaseId === 'nodescan-1.1-experimental')) {
    discovery = rememberInspect(discovery, inspectKnownTarget(targets, discovery, SRV_01_ADDRESS, 'enhanced'), known.player.localDevice.id)
  }
  return { ...known, discovery }
}

/** Earned AUTH-017 Knowledge, produced by resolving a real Service Analysis. */
function knownWeakness(state: GameState = scannedTarget()): GameState {
  return {
    ...state,
    knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-017', observedLabel: 'Weak authentication configuration', targetDeviceId: SRV_01, serviceId: 'service-ssh-001' }] },
  }
}

function analysisProcess(id: string, serviceId: string, workCompleted: number): ServiceAnalysisProcess {
  return { kind: 'service_analysis', id, label: 'SERVICE ANALYSIS', executorDeviceId: 'device-local-v0', status: 'running', ramRequiredMiB: 768, workRequired: 1000, workCompleted, targetDeviceId: SRV_01, serviceId, startedEndpoint: `${SRV_01_ADDRESS}:${serviceId === 'service-ssh-001' ? 22 : 80}` }
}

function credentialProcess(workCompleted: number): CredentialAccessProcess {
  return { kind: 'credential_access', id: 'process-0009', label: 'CREDENTIAL ACCESS', executorDeviceId: 'device-local-v0', status: 'running', ramRequiredMiB: 896, workRequired: 1200, workCompleted, targetDeviceId: SRV_01, serviceId: 'service-ssh-001', startedEndpoint: `${SRV_01_ADDRESS}:22`, vulnerabilityId: 'AUTH-017', toolId: 'flipper', moduleId: 'credential-access' }
}

function withProcesses(state: GameState, processes: GameState['process']['processes']): GameState {
  return { ...state, process: { nextId: processes.length + 1, processes } }
}

function withAccess(state: GameState = knownWeakness()): GameState {
  return { ...state, deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: 'device-local-v0', targetDeviceId: SRV_01, viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

function actionStubs(): GameContext.GameActions {
  return {
    pingTarget: vi.fn(), scanTarget: vi.fn(), inspectTarget: vi.fn(), findTargets: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(),
    startServiceAnalysisFromObservation: vi.fn(), startObservedServiceAnalyses: vi.fn(), startCredentialAccessAttemptFromObservation: vi.fn(),
    startRackUpdateExploitAttemptFromObservation: vi.fn(), startRackUpdatePackageSubmission: vi.fn(), cancelRackUpdatePackageSubmission: vi.fn(),
    connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), startRemoteFileUpload: vi.fn(),
    installLocalSoftwarePackage: vi.fn(), installRemoteSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), startFlipperModuleIntegration: vi.fn(), openMailThread: vi.fn(), sendMailReply: vi.fn(), clearRecentActivity: vi.fn(),
    removeRecentActivity: vi.fn(), authenticateDollarAccount: vi.fn(), authenticateDollarAccountWithSavedSignIn: vi.fn(), logoutDollarAccount: vi.fn(), transferDollars: vi.fn(), transferRemoteDollars: vi.fn(), cancelFileTransfer: vi.fn(), purchaseMarketOffer: vi.fn(), startMarketPackageDownload: vi.fn(), cancelLocalProcess: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn(), runRemoteNodeMiner: vi.fn(), stopRemoteNodeMiner: vi.fn(), retargetLocalNodeMinerPayout: vi.fn(), payoutLocalNodeMiner: vi.fn(), payoutNodeMiner: vi.fn(), retargetNodeMinerPayout: vi.fn(),
  }
}

function StateSnapshot() { return <span data-testid="game-state">{JSON.stringify(useGameState())}</span> }
function currentState(): GameState { return JSON.parse(screen.getByTestId('game-state').textContent!) as GameState }

async function openTarget(state: GameState) {
  const user = userEvent.setup()
  render(<GameProvider initialState={state}><Network /><StateSnapshot /></GameProvider>)
  await user.click(await screen.findByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
  return user
}

async function openDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('RECON INTELLIGENCE'))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

/* ------------------------------------------------------------- the loop */

describe('NodeScan first hack', () => {
  it('walks explicit SCAN and guided ANALYZE before BYPASS and CONNECT', async () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)

    // SELF is intrinsic; Scan SELF reveals its represented Network relationship.
    expect(screen.getByRole('region', { name: 'Self' })).toHaveTextContent('NOT SCANNED')
    const directAddress = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    fireEvent.click(screen.getByRole('button', { name: 'SCAN SELF' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    fireEvent.click(screen.getByRole('button', { name: 'SCAN AGAIN' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    fireEvent.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    expect(screen.getByLabelText('Target status')).toHaveTextContent('NOT SCANNED')

    fireEvent.click(screen.getByRole('button', { name: 'SCAN' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(screen.getByLabelText('Target status')).toHaveTextContent('SERVICES FOUND')
    expect(screen.queryByText('NO WAY IN FOUND')).not.toBeInTheDocument()
    expect(currentState().process.processes).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'ANALYZE' }))
    expect(currentState().process.processes).toHaveLength(2)
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })
    expect(screen.getByLabelText('Target status')).toHaveTextContent('1 WAY IN FOUND')

    fireEvent.click(screen.getByRole('button', { name: 'BYPASS' }))
    expect(screen.getByLabelText('Target status')).toHaveTextContent('HACKING')
    expect(screen.getByRole('group', { name: 'Hack progress' })).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(25_000) })
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ACCESS GRANTED')

    fireEvent.click(screen.getByRole('button', { name: 'CONNECT' }))
    expect(screen.getByLabelText('Target status')).toHaveTextContent('CONNECTED')


  })

  it('produces canonical DeviceAccess and a canonical Remote Session, never a hacked flag', async () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={knownWeakness()}><Network /><StateSnapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    fireEvent.click(screen.getByRole('button', { name: 'BYPASS' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(25_000) })

    const afterHack = currentState()
    expect(afterHack.deviceAccess.established).toEqual([expect.objectContaining({ sourceDeviceId: 'device-local-v0', targetDeviceId: SRV_01, viaServiceId: 'service-ssh-001', privilege: 'USER' })])
    expect(afterHack.remoteSession.active).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'CONNECT' }))
    const connected = currentState()
    expect(connected.remoteSession.active).toEqual(expect.objectContaining({ accessId: afterHack.deviceAccess.established[0].id, connectedAddress: SRV_01_ADDRESS }))
    expect(connected.deviceAccess.established).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    const disconnected = currentState()
    expect(disconnected.remoteSession.active).toBeNull()
    // Access is a relationship and outlives the Session.
    expect(disconnected.deviceAccess.established).toHaveLength(1)
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ACCESS GRANTED')
  })

  it('promotes newly available Inspect over passive Access, preserves Access on completion, and never displaces an active Session', async () => {
    const accessUnder10 = withAccess(scannedTarget())
    expect(selectTarget(accessUnder10, SRV_01)?.stage).toBe('access')

    const upgraded = withNodeScan11(accessUnder10)
    expect(selectTarget(upgraded, SRV_01)?.stage).toBe('inspect')
    const user = await openTarget(upgraded)
    await user.click(screen.getByRole('button', { name: 'INSPECT' }))
    expect(currentState().deviceAccess).toEqual(accessUnder10.deviceAccess)
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ACCESS GRANTED')

    const connected = { ...upgraded, remoteSession: { nextId: 2, active: { id: 'session-0001', accessId: 'access-0001', connectedAddress: SRV_01_ADDRESS } } }
    expect(selectTarget(connected, SRV_01)?.stage).toBe('connected')
  })

  it('keeps Scan surface-only and starts Analyze only from an explicit Service action', async () => {
    const user = await openTarget(foundTargets())
    await user.click(screen.getByRole('button', { name: 'SCAN' }))

    expect(currentState().process.processes).toEqual([])
    expect(currentState().discovery.devices.find(({ id }) => id === SRV_01)?.inspect).toBeUndefined()
    await openDetails(user)
    await user.click(screen.getByRole('button', { name: 'Analyze SSH' }))
    expect(currentState().process.processes).toEqual([expect.objectContaining({ kind: 'service_analysis', serviceId: 'service-ssh-001' })])
  })

  it('offers the hack without asking the player to read a weakness identity or pick a tool', async () => {
    const user = await openTarget(knownWeakness())
    const status = screen.getByLabelText('Target status')
    expect(status).toHaveTextContent('1 WAY IN FOUND')
    expect(status.textContent).not.toContain('AUTH-017')
    expect(status.textContent).not.toContain('Flipper')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'BYPASS' }))
    // The tool and the technique are still real: the started attempt carries both.
    expect(currentState().process.processes).toEqual([expect.objectContaining({
      kind: 'credential_access', serviceId: 'service-ssh-001', vulnerabilityId: 'AUTH-017', toolId: 'flipper', moduleId: 'credential-access', status: 'running',
    })])
  })
})

/* -------------------------------------------------- information boundary */

describe('NodeScan information boundary', () => {
  it('builds every target view from player information alone', () => {
    const known = withNodeScan11(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState()))))
    const information = Object.defineProperty({ ...known }, 'world', { get: () => { throw new Error('hidden World read') } }) as GameState

    expect(selectTargets(information).map(({ address, stage }) => [address, stage])).toEqual([[SRV_01_ADDRESS, 'route']])
    const target = selectTarget(information, SRV_01)!
    expect(target.routes).toEqual([expect.objectContaining({ serviceName: 'SSH', vulnerabilityId: 'AUTH-017', toolName: 'Flipper', moduleName: 'Credential Access Module' })])
  })

  it('offers no way in from hidden World Truth alone', async () => {
    // srv-01 really is vulnerable, and its Services are remembered. Without
    // earned Knowledge the interface must not know that.
    await openTarget(scannedTarget())
    expect(screen.getByLabelText('Target status')).toHaveTextContent('SERVICES FOUND')
    expect(screen.queryByRole('button', { name: 'BYPASS' })).not.toBeInTheDocument()
  })

  it('reports no way in only after every observed Service has a completed negative analysis', () => {
    const completed = ['service-ssh-001', 'service-http-001'].map((serviceId, index) => ({
      ...analysisProcess(`process-000${index + 1}`, serviceId, 1000),
      status: 'completed' as const,
      result: { status: 'no_weakness_detected' as const },
    }))
    const target = selectTarget(withProcesses(scannedTarget(), completed), SRV_01)!
    expect(target.stage).toBe('no_route')
  })

  it('treats a completed analysis as current only for its remembered implementation snapshot', () => {
    const observed = scannedTarget(withNodeScan11(createInitialGameState()))
    const ssh = observed.discovery.devices.find(({ id }) => id === SRV_01)!.services.find(({ id }) => id === 'service-ssh-001')!
    const oldNegative = {
      ...analysisProcess('process-old', ssh.id, 1000), status: 'completed' as const,
      analyzedImplementation: { name: 'GateSSH', version: '1.3.3' },
      result: { status: 'no_weakness_detected' as const },
    }
    const stale = withProcesses(observed, [oldNegative])
    expect(ssh.inspect?.implementation.version).toBe('1.3.2')
    expect(selectTarget(stale, SRV_01)?.services.find(({ id }) => id === ssh.id)).toMatchObject({ analysisRequired: true })

    const noAssociation = { ...oldNegative, analyzedImplementation: undefined }
    expect(selectTarget(withProcesses(observed, [noAssociation]), SRV_01)?.services.find(({ id }) => id === ssh.id)).toMatchObject({ analysisRequired: true })

    const fresh = { ...oldNegative, id: 'process-new', analyzedImplementation: ssh.inspect!.implementation }
    expect(selectTarget(withProcesses(observed, [oldNegative, fresh]), SRV_01)?.services.find(({ id }) => id === ssh.id)).toMatchObject({ analysisRequired: false, analysisOutcome: 'no_weakness_detected' })
  })

  it('prioritizes newly available Inspect over a route learned under NodeScan 1.0, then restores BYPASS', async () => {
    const learnedUnder10 = knownWeakness(scannedTarget())
    expect(selectTarget(learnedUnder10, SRV_01)?.stage).toBe('route')

    const upgraded = withNodeScan11(learnedUnder10)
    expect(upgraded.discovery.devices.find(({ id }) => id === SRV_01)?.inspect?.enhanced).toBeUndefined()
    expect(selectTarget(upgraded, SRV_01)?.stage).toBe('inspect')

    const user = await openTarget(upgraded)
    const primaryInspect = within(screen.getByLabelText('Target status')).getByRole('button', { name: 'INSPECT' })
    expect(primaryInspect).toBeInTheDocument()
    await user.click(primaryInspect)
    expect(selectTarget(currentState(), SRV_01)?.stage).toBe('route')
    expect(screen.getByRole('button', { name: 'BYPASS' })).toBeInTheDocument()
  })

  it('treats service-unavailable analysis as inconclusive and offers a canonical retry', async () => {
    const outcomes = [
      { ...analysisProcess('process-0001', 'service-ssh-001', 1000), status: 'completed' as const, result: { status: 'service_unavailable' as const } },
      { ...analysisProcess('process-0002', 'service-http-001', 1000), status: 'completed' as const, result: { status: 'no_weakness_detected' as const } },
    ]
    const inconclusive = withProcesses(scannedTarget(), outcomes)
    expect(selectTarget(inconclusive, SRV_01)?.stage).toBe('analysis_ready')

    await openTarget(inconclusive)
    expect(screen.queryByText('NO WAY IN FOUND')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'ANALYZE' }))
    expect(currentState().process.processes.filter(({ status }) => status === 'running')).toEqual([
      expect.objectContaining({ kind: 'service_analysis', serviceId: 'service-ssh-001' }),
    ])
  })

  it('offers no way in without the represented tool, on identical Knowledge', () => {
    const withTool = selectTarget(knownWeakness(), SRV_01)!
    const withoutTool = selectTarget(withoutSoftware(knownWeakness(), 'flipper'), SRV_01)!

    expect(withTool.stage).toBe('route')
    expect(withoutTool.stage).toBe('analysis_ready')
    expect(withoutTool.routes).toEqual([])
    // The Knowledge itself is untouched; only the capability is gone.
    expect(withoutTool.services.find(({ id }) => id === 'service-ssh-001')!.weaknesses).toEqual([{ id: 'AUTH-017', label: 'Weak authentication configuration' }])
  })

  it('withdraws the hack from the interface when the represented tool is gone', async () => {
    await openTarget(knownWeakness())
    expect(screen.getByRole('button', { name: 'BYPASS' })).toBeInTheDocument()
    cleanup()

    await openTarget(withoutSoftware(knownWeakness(), 'flipper'))
    expect(screen.queryByRole('button', { name: 'BYPASS' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Target status')).toHaveTextContent('SERVICES FOUND')
  })

  it('keeps stale remembered information stale after the world changes for a reason the player never observed', async () => {
    // Some other cause changed the represented GateSSH release on a second
    // target (not the player's own submission). Remembered evidence must not
    // silently refresh from hidden World Truth.
    const observed = withNodeScan11(createInitialGameState())
    const targets = { localDevice: observed.player.localDevice, network: observed.world.network }
    let discovery = rememberScan(observed.discovery, scanNetworkTarget(targets, '203.0.113.42'), observed.player.localDevice.id)
    discovery = rememberInspect(discovery, inspectKnownTarget(targets, discovery, '203.0.113.42', 'enhanced'), observed.player.localDevice.id)
    const changedWorld = {
      ...observed, discovery,
      world: { network: { ...observed.world.network, hosts: observed.world.network.hosts.map((host) => host.id !== 'host-lan-002' ? host : { ...host, services: host.services!.map((service) => service.id !== 'service-ssh-002' ? service : { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.3.2' } }) }) } },
    }

    const user = userEvent.setup()
    render(<GameProvider initialState={changedWorld}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open target 203.0.113.42' }))
    // The world now runs GateSSH 1.3.2, which is vulnerable. Player memory says 1.3.3.
    expect(screen.getByLabelText('Target status')).toHaveTextContent('SERVICES FOUND')
    await openDetails(user)
    expect(screen.getByText('GateSSH 1.3.3')).toBeInTheDocument()
    expect(screen.queryByText('GateSSH 1.3.2')).not.toBeInTheDocument()
  })

  it('never observes or changes anything by opening technical details', async () => {
    const user = await openTarget(knownWeakness())
    const before = screen.getByTestId('game-state').textContent
    scanTargetSpy.mockClear()

    await openDetails(user)
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('game-state').textContent).toBe(before)
  })

  it('never observes by browsing Known Space', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={scannedTarget()}><Network /><StateSnapshot /></GameProvider>)
    const before = screen.getByTestId('game-state').textContent
    scanTargetSpy.mockClear()

    await user.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('game-state').textContent).toBe(before)
  })
})

/* ----------------------------------------------------- canonical progress */

describe('NodeScan progress', () => {
  it('takes scan progress from canonical Process state', async () => {
    await openTarget(withProcesses(scannedTarget(), [analysisProcess('process-0001', 'service-ssh-001', 250), analysisProcess('process-0002', 'service-http-001', 750)]))
    expect(screen.getByRole('group', { name: 'Analysis progress' })).toHaveTextContent('50%')
  })

  it('takes hack progress from canonical Process state', async () => {
    await openTarget(withProcesses(knownWeakness(), [credentialProcess(300)]))
    const status = screen.getByLabelText('Target status')
    expect(status).toHaveTextContent('HACKING')
    expect(screen.getByRole('group', { name: 'Hack progress' })).toHaveTextContent('25%')
  })

  it('reports a failed attempt coarsely while the same route stays available', async () => {
    const failed = withProcesses(knownWeakness(), [{ ...credentialProcess(1200), status: 'completed', result: { status: 'attempt_failed', message: 'Authentication attempt failed.' } }])
    await openTarget(failed)
    const status = screen.getByLabelText('Target status')
    expect(status).toHaveTextContent('1 WAY IN FOUND')
    expect(status).toHaveTextContent('The last attempt failed.')
    expect(screen.getByRole('button', { name: 'BYPASS AGAIN' })).toBeInTheDocument()
  })
})

/* ------------------------------------------------------- technical depth */

describe('NodeScan technical details', () => {
  it('offers no Inspect under 1.0 and performs no hidden Inspect or Analyze when 1.1 scans', async () => {
    let user = await openTarget(scannedTarget())
    await openDetails(user)
    expect(screen.queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()
    cleanup()

    user = await openTarget(foundTargets(withNodeScan11(createInitialGameState())))
    await user.click(screen.getByRole('button', { name: 'SCAN' }))
    expect(currentState().discovery.devices.find(({ id }) => id === SRV_01)?.inspect).toBeUndefined()
    expect(currentState().process.processes).toEqual([])
    await openDetails(user)
    expect(screen.getAllByRole('button', { name: 'INSPECT' })).not.toHaveLength(0)
  })

  it('stores deeper evidence only after explicit Inspect under 1.1', async () => {
    const user = await openTarget(scannedTarget(withNodeScan11(createInitialGameState())))
    // The fixture's scan is intentionally surface-only for this assertion.
    const before = currentState()
    const withoutInspect = { ...before, discovery: { ...before.discovery, devices: before.discovery.devices.map((device) => ({ ...device, inspect: undefined, services: device.services.map((service) => ({ ...service, inspect: undefined })) })) } }
    cleanup()
    const explicit = await openTarget(withoutInspect)
    await openDetails(explicit)
    await explicit.click(screen.getAllByRole('button', { name: 'INSPECT' })[0])
    const observed = currentState().discovery.devices.find(({ id }) => id === SRV_01)
    expect(observed?.inspect?.enhanced?.firmware).toEqual({ name: 'RACK-OS', version: '1.0' })
    expect(observed?.services.find(({ id }) => id === 'service-ssh-001')?.inspect?.implementation).toEqual({ name: 'GateSSH', version: '1.3.2' })
  })

  it('explains the route from player information and represented software', async () => {
    const user = await openTarget(withNodeScan11(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState())))))
    await openDetails(user)

    const details = screen.getByText('WAYS IN').closest('.ns-detail-panel')!
    expect(details).toHaveTextContent('Credential attack')
    expect(details).toHaveTextContent('Flipper · Credential Access Module')
    expect(details).toHaveTextContent('GateSSH 1.3.2')
    expect(details).toHaveTextContent('Weak authentication configuration · AUTH-017')
  })

  it('keeps single-Service investigation available as advanced depth', async () => {
    const user = await openTarget(scannedTarget())
    await openDetails(user)
    await user.click(screen.getByRole('button', { name: 'Analyze HTTP' }))

    expect(currentState().process.processes).toEqual([expect.objectContaining({ kind: 'service_analysis', serviceId: 'service-http-001', status: 'running' })])
  })

  it('states what the last Analyze found before the control that would run it again', async () => {
    /*
     * A Service states everything known about it, then offers the action. The
     * outcome note used to render underneath ANALYZE, where the same sentence
     * reads as a description of what the button is about to do — and where it
     * sat on the opposite side of the control from the weakness note that
     * answers the same question for a Service that has one.
     */
    const analysed = withProcesses(knownWeakness(), [{
      ...analysisProcess('process-0001', 'service-http-001', 1000),
      status: 'completed', result: { status: 'no_weakness_detected' },
    }])
    const user = await openTarget(analysed)
    await openDetails(user)

    const serviceOf = (name: string) => screen.getByRole('button', { name: `Analyze ${name}` }).closest('.ns-service') as HTMLElement
    const precedesItsAction = (article: HTMLElement, statement: HTMLElement) =>
      statement.compareDocumentPosition(within(article).getByRole('button', { name: /^Analyze / })) & Node.DOCUMENT_POSITION_FOLLOWING

    const http = serviceOf('HTTP')
    expect(precedesItsAction(http, within(http).getByText('Last analysis found no weakness.'))).toBeTruthy()

    // The same ordering a Service with a weakness already had.
    const ssh = serviceOf('SSH')
    expect(precedesItsAction(ssh, within(ssh).getByText('Weak authentication configuration'))).toBeTruthy()
  })

  it('states remembered evidence with its capability note under a release that cannot Inspect', async () => {
    const remembered = { ...scannedTarget(withNodeScan11(createInitialGameState())), player: createInitialGameState().player }
    const user = await openTarget(remembered)
    await openDetails(user)

    expect(screen.getByText('RACK-OS 1.0')).toBeInTheDocument()
    expect(screen.getByText(/does not supply Inspect/)).toBeInTheDocument()
  })

  it('states unobserved depth explicitly rather than as an observed empty result', async () => {
    const user = await openTarget(foundTargets())
    await openDetails(user)
    expect(screen.getByText('SERVICES NOT OBSERVED')).toBeInTheDocument()
    expect(screen.getByText('NOT OBSERVED')).toBeInTheDocument()
  })

  it('shows the provenance of established access', async () => {
    const user = await openTarget(withAccess())
    await openDetails(user)
    const facts = screen.getByText('ACCESS').closest('.ns-detail-panel')!
    expect(facts).toHaveTextContent('USER')
    expect(facts).toHaveTextContent('SSH')
  })
})

/* ------------------------------------------------ RackUpdate as depth only */

describe('RackUpdate exploit and package submission', () => {
  // The Rollback Module is not integrated by default (the Market is its represented acquisition path), so this fixture states the concrete Flipper build that has it.
  function srv02(): GameState {
    const observed = withNodeScan11(createInitialGameState())
    const targets = { localDevice: observed.player.localDevice, network: observed.world.network }
    let discovery = rememberScan(observed.discovery, scanNetworkTarget(targets, '203.0.113.42'), observed.player.localDevice.id)
    discovery = rememberInspect(discovery, inspectKnownTarget(targets, discovery, '203.0.113.42', 'enhanced'), observed.player.localDevice.id)
    const gatePackage = observed.world.network.hosts.find(({ id }) => id === SRV_01)!.filesystem!.files.find(({ id }) => id === 'file-0003')!
    return {
      ...observed,
      discovery,
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'UPD-001', observedLabel: 'Rollback protection not enforced', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' }] },
      player: {
        ...observed.player,
        localDevice: {
          ...observed.player.localDevice,
          installedSoftware: observed.player.localDevice.installedSoftware.map((software) => software.id === 'flipper'
            ? { ...FLIPPER_1_0_CANONICAL_INSTALLATION, buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID, integratedModules: ['credential-access', 'rollback'] as const, sizeBytes: FLIPPER_1_0_CANONICAL_INSTALLATION.sizeBytes + ROLLBACK_MODULE_1_0.sizeBytes }
            : software),
          filesystem: { ...observed.player.localDevice.filesystem, files: [...observed.player.localDevice.filesystem.files, { ...gatePackage, id: 'file-local-gate', path: '/home/user/downloads/gatessh-1.3.2.pkg' }] },
        },
      },
    }
  }

  it('presents the attack path as primary guidance without calling it Device access', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv02()}><Network /><StateSnapshot /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open target 203.0.113.42' }))

    const view = screen.getByLabelText('NodeScan')
    const details = view.querySelector('details')!
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ATTACK PATH FOUND')
    expect(screen.getByLabelText('Target status')).not.toHaveTextContent('ACCESS')
    expect(view.textContent!.replace(details.textContent!, '')).toContain('RackUpdate')
    await user.click(screen.getByText('RECON INTELLIGENCE'))
    expect(screen.getByRole('button', { name: 'ATTACK' }).closest('details')).toBeNull()
  })

  it('does not offer the avenue before UPD-001 is earned', async () => {
    const unknown = { ...srv02(), knowledge: { discoveredVulnerabilities: [] } }
    const user = userEvent.setup()
    render(<GameProvider initialState={unknown}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open target 203.0.113.42' }))
    await openDetails(user)

    expect(screen.queryByText('PACKAGE SUBMISSION')).not.toBeInTheDocument()
  })

  it('offers no ATTACK opportunity without the represented tool, on identical Knowledge', async () => {
    // The same Device, with the default Flipper build that does not integrate the Rollback Module.
    const withoutTool = { ...srv02(), player: { ...srv02().player, localDevice: { ...srv02().player.localDevice, installedSoftware: srv02().player.localDevice.installedSoftware.map((software) => software.id === 'flipper' ? FLIPPER_1_0_CANONICAL_INSTALLATION : software) } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={withoutTool}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open target 203.0.113.42' }))
    await openDetails(user)

    expect(screen.getByText(/does not enforce rollback protection/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ATTACK' })).not.toBeInTheDocument()
    expect(screen.getByText('No installed tool currently supports this weakness.')).toBeInTheDocument()
  })

  it('requires a finite ATTACK before the package-submission interface is usable, then applies the submitted release only once the upload completes', async () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={srv02()}><Network /><StateSnapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: `Open target 203.0.113.42` }))
    fireEvent.click(screen.getByText('RECON INTELLIGENCE'))

    // ATTACK grants only the narrow submission capability: finite work, no immediate consequence.
    fireEvent.click(screen.getByRole('button', { name: 'ATTACK' }))
    expect(screen.getByRole('group', { name: 'Attack progress' })).toBeInTheDocument()
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ATTACKING RACKUPDATE')
    expect(currentState().rackUpdate.access.established).toEqual([])
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000) })

    expect(currentState().rackUpdate.access.established).toHaveLength(1)
    expect(currentState().deviceAccess.established).toEqual([])
    expect(currentState().remoteSession.active).toBeNull()
    expect(screen.getByLabelText('Target status')).toHaveTextContent('PACKAGE SUBMISSION READY')
    expect(screen.getByRole('combobox', { name: 'Rollback package' })).toBeInTheDocument()

    // Package submission is represented upload work, not an instant mutation.
    fireEvent.change(screen.getByRole('combobox', { name: 'Rollback package' }), { target: { value: 'file-local-gate' } })
    fireEvent.click(screen.getByRole('button', { name: 'SUBMIT PACKAGE' }))
    expect(screen.getByRole('group', { name: 'Submission progress' })).toBeInTheDocument()
    let managed = currentState().world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation.releaseId).toBe('gate-ssh-1.3.3')

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000) })
    managed = currentState().world.network.hosts.find(({ id }) => id === 'host-lan-002')!.services!.find(({ id }) => id === 'service-ssh-002')!
    expect(managed.implementation.releaseId).toBe('gate-ssh-1.3.2')
    expect(currentState().deviceAccess.established).toEqual([])
    expect(currentState().remoteSession.active).toBeNull()
  })

  it('offers both older and newer compatible GateSSH candidates once submission is enabled, from Player Information alone', () => {
    const base = srv02()
    const newerPackage = { ...base.player.localDevice.filesystem.files.find(({ id }) => id === 'file-local-gate')!, id: 'file-local-newer', path: '/home/user/downloads/gatessh-1.4.0.pkg', releaseId: 'gate-ssh-1.4.0', version: '1.4.0' }
    const withCandidates: GameState = {
      ...base,
      rackUpdate: { access: { nextId: 2, established: [{ id: 'rack-update-access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-rack-update-002' }] }, submission: { nextId: 1, active: null } },
      player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, newerPackage] } } },
    }
    const target = selectTarget(withCandidates, 'host-lan-002')!
    expect(target.packageSubmission?.enabled).toBe(true)
    expect(target.packageSubmission?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'file-local-gate', label: 'GateSSH 1.3.2' }),
      expect.objectContaining({ id: 'file-local-newer', label: 'GateSSH 1.4.0' }),
    ]))
  })
})

/* ------------------------------------------------- software and lifecycle */

describe('NodeScan software and request lifecycle', () => {
  it('reports an absent NodeScan installation instead of a target space', () => {
    render(<GameProvider initialState={withoutSoftware(scannedTarget(), 'nodescan')}><Network /></GameProvider>)
    expect(screen.getByText('NO RECONNAISSANCE SOFTWARE')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).not.toBeInTheDocument()
  })

  it('derives product identity from canonical installed software', () => {
    render(<GameProvider initialState={withNodeScan11(scannedTarget())}><Network /></GameProvider>)
    expect(screen.getByText('NODESCAN')).toBeInTheDocument()
    expect(screen.getByText('1.1 EXPERIMENTAL')).toBeInTheDocument()
  })

  it('registers NodeScan under its own application identity', () => {
    expect(appRegistry.network.label).toBe('NodeScan')
  })

  it('deduplicates rapid requests for the same subject', async () => {
    const pending = deferred<Awaited<ReturnType<GameContext.GameActions['scanTarget']>>>()
    const actions = { ...actionStubs(), scanTarget: vi.fn(() => pending.promise) }
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue(actions)
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(foundTargets())

    const user = userEvent.setup()
    render(<Network />)
    await user.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: 'SCAN' }))
    await user.click(screen.getByRole('button', { name: 'SCAN' }))

    expect(actions.scanTarget).toHaveBeenCalledTimes(1)
    await act(async () => { pending.resolve({ status: 'device', targetId: SRV_01, address: SRV_01_ADDRESS, scope: 'lan', networks: [], services: [] }) })
  })

  it('ignores a result that arrives after the player has moved on', async () => {
    const pending = deferred<Awaited<ReturnType<GameContext.GameActions['scanTarget']>>>()
    const actions = { ...actionStubs(), scanTarget: vi.fn(() => pending.promise) }
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue(actions)
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(foundTargets())

    const user = userEvent.setup()
    render(<Network />)
    await user.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: 'SCAN' }))
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    await act(async () => { pending.resolve({ status: 'no_response', address: SRV_01_ADDRESS }) })

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })


  it('reports a coarse connection failure without leaking current target state', async () => {
    const offline = withAccess()
    const user = await openTarget({ ...offline, world: { network: { ...offline.world.network, hosts: offline.world.network.hosts.map((host) => host.id === SRV_01 ? { ...host, online: false } : host) } } })
    await user.click(screen.getByRole('button', { name: 'CONNECT' }))

    expect(screen.getByText('TARGET NOT AVAILABLE')).toBeInTheDocument()
    expect(currentState().remoteSession.active).toBeNull()
  })
})

/* -------------------------------------------------------- known space */

describe('Known Space topology', () => {
  it('starts with an empty neutral direct-address field and no broad topology shortcut', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })

    expect(input).toHaveValue('')
    expect(input).toHaveAttribute('placeholder', 'IPv4 address')
    expect(screen.queryByText(PHONE_ADDRESS)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'SCAN AGAIN' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Ping target address' }))

    expect(screen.getByRole('status')).toHaveTextContent('INVALID ADDRESS')
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(currentState().discovery).toEqual(createInitialGameState().discovery)
  })

  it('PINGs a player-supplied IPv4 without leaking its hidden Network membership', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    const form = input.closest('form')!
    const before = currentState()

    await user.type(input, PHONE_ADDRESS)

    const entered = currentState()
    expect(entered.discovery).toEqual(before.discovery)
    expect(entered.knowledge).toEqual(before.knowledge)
    expect(entered.deviceAccess).toEqual(before.deviceAccess)
    expect(entered.remoteSession).toEqual(before.remoteSession)
    expect(screen.queryByRole('button', { name: `Open target ${PHONE_ADDRESS}` })).not.toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()

    await user.click(within(form).getByRole('button', { name: 'Ping target address' }))

    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(currentState().discovery.devices).toContainEqual(expect.objectContaining({ id: 'host-phone-001', address: PHONE_ADDRESS, scope: 'unknown' }))
    expect(currentState().discovery.networkDeviceRelations).toEqual([])
    expect(screen.getByRole('region', { name: 'Elsewhere' })).toHaveTextContent('Membership not observed')
    expect(screen.getByRole('button', { name: `Open target ${PHONE_ADDRESS}` })).toBeInTheDocument()
  })

  it('regroups the foreign phone only after Inspect remembers its Network, then discovers peers only through Network Scan', () => {
    const state = withNodeScan11(createInitialGameState())
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const pinged = rememberPing(state.discovery, pingNetworkTarget(targets, PHONE_ADDRESS), state.player.localDevice.id)
    const before = { ...state, discovery: pinged }
    expect(selectKnownSpace(before).elsewhere.map(({ id }) => id)).toContain('host-phone-001')

    const inspectedDiscovery = rememberInspect(pinged, inspectKnownTarget(targets, pinged, PHONE_ADDRESS, 'enhanced'), state.player.localDevice.id)
    const inspected = { ...state, discovery: inspectedDiscovery }
    const foreign = selectKnownSpace(inspected).networks.find(({ id }) => id === 'network-foreign-001')!
    expect(foreign.name).toBe('remote-segment-01')
    expect(foreign.targets.map(({ id }) => id)).toEqual(['host-phone-001'])
    expect(inspectedDiscovery.devices.some(({ id }) => id === 'host-lan-002')).toBe(false)

    const scanned = rememberScan(inspectedDiscovery, scanNetworkTarget(targets, 'remote-segment-01'), state.player.localDevice.id)
    expect(scanned.devices.some(({ id }) => id === 'host-lan-002')).toBe(true)
  })

  it('rejects malformed direct input locally without observing or mutating canonical state', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    const before = screen.getByTestId('game-state').textContent

    await user.type(input, '198.51.100.999')
    await user.click(within(input.closest('form')!).getByRole('button', { name: 'Ping target address' }))

    expect(screen.getByRole('status')).toHaveTextContent('INVALID ADDRESS')
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('game-state').textContent).toBe(before)
  })

  it('reports no response without false Discovery and permits a legitimate SELF observation', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    const scan = within(input.closest('form')!).getByRole('button', { name: 'Ping target address' })

    await user.type(input, '192.0.2.250')
    await user.click(scan)
    expect(screen.getByRole('status')).toHaveTextContent('NO RESPONSE')
    expect(currentState().discovery.devices).toEqual([])

    await user.clear(input)
    await user.type(input, createInitialGameState().player.localDevice.network.ip)
    await user.click(scan)

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(currentState().discovery.networks).toEqual([])
    expect(screen.getByRole('region', { name: 'Self' })).toHaveTextContent('SELF')
  })

  it('derives the relationship shape from remembered Discovery alone', () => {
    const known = withAccess()
    const information = Object.defineProperty({ ...known }, 'world', { get: () => { throw new Error('hidden World read') } }) as GameState
    const space = selectKnownSpace(information)

    expect(space.self.address).toBe('198.51.100.23')
    expect(space.networks.map(({ name, includesSelf, membersObserved }) => [name, includesSelf, membersObserved])).toEqual([['home-net', true, true]])
    expect(space.networks[0].targets.map(({ address }) => address)).toEqual([SRV_01_ADDRESS])
    expect(space.elsewhere).toEqual([])
    // srv-02 exists in the world and has never been observed, so it is nowhere.
    expect(space.networks[0].targets.some(({ id }) => id === 'host-lan-002')).toBe(false)
  })

  it('presents a related Device inside its Network, with its stage', () => {
    render(<GameProvider initialState={withAccess()}><Network /></GameProvider>)
    const network = screen.getByRole('region', { name: 'Network home-net' })
    const row = within(network).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })

    expect(network).toHaveTextContent('home-net')
    expect(row).toHaveTextContent('ACCESS')
    // The relationship is the group, not a repeated subtitle on the row.
    expect(row).not.toHaveTextContent('home-net')
  })

  it('presents SELF as position rather than as a step the player can take', () => {
    render(<GameProvider initialState={withAccess()}><Network /></GameProvider>)
    const network = screen.getByRole('region', { name: 'Network home-net' })

    expect(network).toHaveTextContent('SELF')
    expect(network).toHaveTextContent('198.51.100.23')
    expect(within(network).queryByRole('button', { name: 'Open target 198.51.100.23' })).not.toBeInTheDocument()
    // SELF is not a target and adds no control of its own: the only controls
    // on this Network are its remembered targets.
    expect(within(network).getAllByRole('button').map((control) => control.getAttribute('aria-label')))
      .toEqual([`Open target ${SRV_01_ADDRESS}`])
  })

  it('keeps a Device with no remembered Network relationship visibly separate', () => {
    const observed = createInitialGameState()
    const targets = { localDevice: observed.player.localDevice, network: observed.world.network }
    // A directly scanned remote Device: remembered, but on no known Network.
    const discovery = rememberScan(foundTargets().discovery, scanNetworkTarget(targets, '203.0.113.42'), observed.player.localDevice.id)
    render(<GameProvider initialState={{ ...observed, discovery }}><Network /></GameProvider>)

    const home = screen.getByRole('region', { name: 'Network home-net' })
    expect(within(home).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toBeInTheDocument()
    expect(within(home).queryByRole('button', { name: 'Open target 203.0.113.42' })).not.toBeInTheDocument()

    const elsewhere = screen.getByRole('region', { name: 'Elsewhere' })
    expect(within(elsewhere).getByRole('button', { name: 'Open target 203.0.113.42' })).toHaveTextContent('Remote')
  })

  it('opens the same simple target card straight from the topology', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={knownWeakness()}><Network /></GameProvider>)
    await user.click(within(screen.getByRole('region', { name: 'Network home-net' })).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))

    // One tap, straight to the decision: no Network page and no Device page between.
    expect(screen.getByLabelText('Target status')).toHaveTextContent('1 WAY IN FOUND')
    expect(screen.getByRole('button', { name: 'BYPASS' })).toBeInTheDocument()
  })

  it('observes nothing by presenting topology', async () => {
    const known = withAccess()
    scanTargetSpy.mockClear()
    render(<GameProvider initialState={known}><Network /><StateSnapshot /></GameProvider>)
    const before = screen.getByTestId('game-state').textContent

    expect(screen.getByRole('region', { name: 'Network home-net' })).toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('game-state').textContent).toBe(before)
  })

  it('states unobserved membership rather than reporting an empty Network', () => {
    const observed = createInitialGameState()
    const targets = { localDevice: observed.player.localDevice, network: observed.world.network }
    // SELF scanned, home-net learned, its members never observed.
    const discovery = rememberScan(observed.discovery, scanNetworkTarget(targets, observed.player.localDevice.network.ip), observed.player.localDevice.id)
    render(<GameProvider initialState={{ ...observed, discovery }}><Network /></GameProvider>)

    const network = screen.getByRole('region', { name: 'Network home-net' })
    expect(network).toHaveTextContent('Members not observed')
    expect(network).toHaveTextContent('SELF')
    expect(within(network).queryAllByRole('button')).toHaveLength(0)
  })

  it('derives each row from canonical state rather than a stored label', () => {
    const scanning = withProcesses(scannedTarget(), [analysisProcess('process-0001', 'service-ssh-001', 400)])
    render(<GameProvider initialState={scanning}><Network /></GameProvider>)
    expect(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toHaveTextContent('ANALYZING')
  })

  it('advances real canonical work while the player is on the list', async () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={withProcesses(scannedTarget(), [analysisProcess('process-0001', 'service-ssh-001', 0)])}><Network /><StateSnapshot /></GameProvider>)
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })

    expect(currentState().knowledge.discoveredVulnerabilities).toEqual([expect.objectContaining({ vulnerabilityId: 'AUTH-017', targetDeviceId: SRV_01 })])
    expect(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toHaveTextContent('WAY IN FOUND')
  })
})

/* -------------------------------------------------- simulation compatibility */

describe('simulation physics after the reset', () => {
  it('resolves an identical hack the same way whichever interface started it', () => {
    // The GUI path and a directly started attempt are the same canonical
    // operation resolved by the same advancement boundary.
    let state = withProcesses(knownWeakness(), [credentialProcess(0)])
    for (let tick = 0; tick < 40; tick++) state = advanceGameState(state, 1000)

    expect(state.deviceAccess.established).toEqual([expect.objectContaining({ targetDeviceId: SRV_01, viaServiceId: 'service-ssh-001', privilege: 'USER' })])
    expect(state.world.network.hosts.find(({ id }) => id === SRV_01)!.authenticationHistory!.records).toEqual([
      expect.objectContaining({ serviceName: 'SSH', sourceAddress: '198.51.100.23', result: 'SUCCESS' }),
    ])
  })
})

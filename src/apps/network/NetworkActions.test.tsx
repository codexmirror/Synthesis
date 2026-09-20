import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as GameContext from '../../app/GameContext'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { appRegistry } from '../../shell/appRegistry'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { scanFromDevice, scanNetworkTarget } from '../../core/game/scan'
import { rememberPing, rememberScan } from '../../core/game/discovery'
import { startServiceAnalysis, startServiceAnalysisFromObservation } from '../../core/game/serviceAnalysis'
import { pingNetworkTarget } from '../../core/game/ping'
import type { CredentialAccessProcess, GameState, ServiceAnalysisProcess } from '../../core/game/types'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import { Network } from './Network'
import { selectKnownSpace, selectTarget, selectTargets } from './targetProjection'
import { FLIPPER_1_0_CANONICAL_INSTALLATION, ROLLBACK_MODULE_1_0 } from '../../core/game/flipper'
import { FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID } from '../../core/game/softwareReleaseContent'
import { GATE_SSH_1_3_2_BUILD_ID } from '../../core/game/serviceImplementations'
import { AUTH_GUARD_1_0_INSTALLATION } from '../../core/game/authGuard'

const scanTargetSpy = vi.hoisted(() => vi.fn())
vi.mock('../../core/game/scan', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/game/scan')>()
  return { ...actual, scanNetworkTarget: (...args: Parameters<typeof actual.scanNetworkTarget>) => { scanTargetSpy(...args); return actual.scanNetworkTarget(...args) } }
})

const SRV_01 = 'host-lan-001'
const SRV_01_ADDRESS = '198.51.100.47'
const PHONE_ADDRESS = '10.42.0.61'
const SRV_02 = 'host-lan-002'
// srv-02 sits behind Bookstore's private segment: every legitimate observation of it is reached (and
// therefore addressed) through its Gateway's own public edge, never its own private World Truth address.
const GATEWAY_ADDRESS = '203.0.113.42'
const SRV_02_ADDRESS = GATEWAY_ADDRESS
const SRV_02_GATEWAY_EDGE = `${GATEWAY_ADDRESS}:22`

/** srv-02's GateSSH, reached the only way it is reachable: Bookstore's public Gateway edge. Creates srv-02's own Discovery identity as a side effect, exactly like a Scan would. */
function analyzedSrv02Ssh(state: GameState = createInitialGameState()): GameState {
  const started = startServiceAnalysisFromObservation(state, { endpoint: SRV_02_GATEWAY_EDGE, targetDeviceId: SRV_02, serviceId: 'service-ssh-002' })
  if (started.status !== 'started') throw new Error(started.status)
  return advanceGameState(started.state, 20_000)
}

/**
 * Installs NodeScan on srv-02 as a pure test-local fixture for this file's own Known Space / target
 * topology rendering coverage — never a default game assumption or an accepted V1 route to Bookstore's
 * private segment. It only lets these tests construct a specific remembered Discovery shape (as if some
 * operated Device had run the same explicit-source Scan RackOS Terminal's own `scan` command already
 * supports) so the projection/rendering behavior under test has a concrete fixture to render.
 */
function withSrv02NodeScan(state: GameState): GameState {
  return { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === SRV_02
    ? { ...host, installedSoftware: [...(host.installedSoftware ?? []), { id: 'nodescan', releaseId: 'nodescan-1.0-standard', buildId: 'build-nodescan-1.0-standard-v0', name: 'NodeScan', version: '1.0', channel: 'standard' }] }
    : host) } } }
}

/* ---------------------------------------------------------------- fixtures */

function withNodeScan11(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.1-experimental', version: '1.1', channel: 'experimental' } : software) } } }
}

function withNodeScan12(state: GameState): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan' ? { ...software, releaseId: 'nodescan-1.2-standard', buildId: 'build-nodescan-1.2-standard-v0', version: '1.2', channel: 'standard' } : software) } } }
}

function withoutSoftware(state: GameState, productId: string): GameState {
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
    installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== productId && !(productId === 'flipper' && id === 'keyprobe')),
    filesystem: productId === 'flipper' ? { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module' || file.moduleId !== 'credential-access') } : state.player.localDevice.filesystem,
  } } }
}

/** Discovery after looking around: home-net and its members are remembered. */
function foundTargets(state: GameState = createInitialGameState()): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  return { ...state, discovery }
}

/**
 * Endpoint Analysis of every currently remembered open Service on one Device
 * — the current route to remembered implementation/interface evidence,
 * replacing the retired generic Inspect operation earlier fixtures used.
 * `base` supplies the rest of canonical state (Process, Knowledge, ...);
 * `targets` supplies exactly the localDevice/network the analysis resolves
 * against, mirroring the old `inspectKnownTarget(targets, ...)` shape.
 */
function analyzedDiscovery(base: GameState, targets: { localDevice: GameState['player']['localDevice']; network: GameState['world']['network'] }, discovery: GameState['discovery'], address: string): GameState['discovery'] {
  const device = discovery.devices.find((candidate) => candidate.address === address)
  if (!device) return discovery
  let current: GameState = { ...base, player: { ...base.player, localDevice: targets.localDevice }, world: { network: targets.network }, discovery }
  for (const service of device.services) {
    const started = startServiceAnalysis(current, device.id, service.id)
    if (started.status !== 'started') continue
    current = advanceGameState(started.state, 20_000)
  }
  return current.discovery
}

/** Discovery after an explicit Device Scan: srv-01's Services are remembered. */
function scannedTarget(state: GameState = createInitialGameState()): GameState {
  const known = foundTargets(state)
  const targets = { localDevice: known.player.localDevice, network: known.world.network }
  let discovery = rememberScan(known.discovery, scanNetworkTarget(targets, SRV_01_ADDRESS), known.player.localDevice.id)
  if (known.player.localDevice.installedSoftware.some(({ releaseId }) => releaseId === 'nodescan-1.1-experimental')) {
    discovery = analyzedDiscovery(known, targets, discovery, SRV_01_ADDRESS)
  }
  return { ...known, discovery }
}

/**
 * Discovery after one legitimate portless Scan of Bookstore's public Gateway edge: the Gateway's own
 * Service plus every exposure it currently forwards, each remembered only as that forward.
 */
function gatewayScanned(state: GameState = createInitialGameState()): GameState {
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  return { ...state, discovery: rememberScan(state.discovery, scanNetworkTarget(targets, GATEWAY_ADDRESS), state.player.localDevice.id) }
}

/** GateSSH 1.3.2 analyzed through the canonical operation, plus historical AUTH-017 Knowledge. */
function knownWeakness(state: GameState = scannedTarget()): GameState {
  const started = startServiceAnalysis(state, SRV_01, 'service-ssh-001')
  if (started.status !== 'started') throw Error(started.status)
  const analyzed = advanceGameState(started.state, 20_000)
  return {
    ...analyzed,
    knowledge: { bookstoreMarket: { nextReportId: 1, reports: [] }, discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-017', observedLabel: 'Weak authentication configuration', targetDeviceId: SRV_01, serviceId: 'service-ssh-001' }] },
  }
}

function analysisProcess(id: string, serviceId: string, workCompleted: number): ServiceAnalysisProcess {
  return { kind: 'service_analysis', id, label: 'SERVICE ANALYSIS', executorDeviceId: 'device-local-v0', status: 'running', ramRequiredMiB: 768, workRequired: 1000, workCompleted, targetDeviceId: SRV_01, serviceId, startedEndpoint: `${SRV_01_ADDRESS}:${serviceId === 'service-ssh-001' ? 22 : 80}` }
}

function completedGateSshAnalysis(version: '1.3.2' | '1.3.3', vulnerabilityId: 'AUTH-017' | 'AUTH-031'): ServiceAnalysisProcess {
  return {
    ...analysisProcess(`analysis-${vulnerabilityId}`, 'service-ssh-001', 1000),
    status: 'completed',
    analyzedImplementation: { name: 'GateSSH', version },
    result: { status: 'analysis_complete' },
  }
}

function credentialProcess(workCompleted: number): CredentialAccessProcess {
  return { kind: 'credential_access', id: 'process-0009', label: 'CREDENTIAL ACCESS', executorDeviceId: 'device-local-v0', status: 'running', ramRequiredMiB: 896, workRequired: 1200, workCompleted, targetDeviceId: SRV_01, serviceId: 'service-ssh-001', startedEndpoint: `${SRV_01_ADDRESS}:22`, vulnerabilityId: 'AUTH-017', toolId: 'flipper', moduleId: 'credential-access', serviceImplementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: 'build-gate-ssh-1.3.2-v0' } }
}

function withProcesses(state: GameState, processes: GameState['process']['processes']): GameState {
  return { ...state, process: { nextId: processes.length + 1, processes } }
}

function withAccess(state: GameState = knownWeakness()): GameState {
  return { ...state, deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: 'device-local-v0', targetDeviceId: SRV_01, viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

function actionStubs(): GameContext.GameActions {
  return {
    pingTarget: vi.fn(), scanTarget: vi.fn(), findTargets: vi.fn(), refreshNetwork: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(),
    startServiceAnalysisFromObservation: vi.fn(), startObservedServiceAnalyses: vi.fn(), startCredentialAccessAttemptFromObservation: vi.fn(), startDeauthAttempt: vi.fn(),
    startRackUpdateExploitAttemptFromObservation: vi.fn(), startRackUpdatePackageSubmission: vi.fn(), cancelRackUpdatePackageSubmission: vi.fn(),
    connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), startRemoteFileUpload: vi.fn(),
    installLocalSoftwarePackage: vi.fn(), installRemoteSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), startFlipperModuleIntegration: vi.fn(), openMailThread: vi.fn(), sendMailReply: vi.fn(), composeMail: vi.fn(), deleteMailThreads: vi.fn(), clearRecentActivity: vi.fn(),
    removeRecentActivity: vi.fn(), authenticateDollarAccount: vi.fn(), authenticateDollarAccountWithSavedSignIn: vi.fn(), logoutDollarAccount: vi.fn(), transferDollars: vi.fn(), transferRemoteDollars: vi.fn(), cancelFileTransfer: vi.fn(), purchaseMarketOffer: vi.fn(), startMarketPackageDownload: vi.fn(), cancelLocalProcess: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn(), runRemoteNodeMiner: vi.fn(), stopRemoteNodeMiner: vi.fn(), retargetLocalNodeMinerPayout: vi.fn(), payoutLocalNodeMiner: vi.fn(), payoutNodeMiner: vi.fn(), retargetNodeMinerPayout: vi.fn(), changeWalletProtectionForOperatedRemoteDevice: vi.fn(), startVeyraFirmwareUpdateForOperatedRemoteDevice: vi.fn(), startRackOsFirmwareUpdateForOperatedRemoteDevice: vi.fn(), verifyDevicePinForOperatedRemoteDevice: vi.fn(), placeBookstoreRestockOrderFromOperatedRemoteDevice: vi.fn(), requestBookstoreMarketReportFromOperatedRemoteDevice: vi.fn(), purchaseBookstoreCoffeeMachineFromOperatedRemoteDevice: vi.fn(), createRattlerPayload: vi.fn(),
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
  await user.click(screen.getByText('TECHNICAL INTELLIGENCE'))
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => { resolve = complete })
  return { promise, resolve }
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

/* ------------------------------------------------------------- the loop */

describe('NodeScan first hack', () => {
  it('walks explicit SCAN and ANALYZE before choosing Credential Access and CONNECT', async () => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)

    // SELF is intrinsic; Scan SELF reveals its represented Network relationship.
    expect(screen.getByRole('region', { name: 'Self' })).toHaveTextContent('NOT SCANNED')
    const directAddress = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    fireEvent.click(screen.getByRole('button', { name: 'SCAN SELF' }))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    fireEvent.click(screen.getByRole('button', { name: 'Scan network home-net' }))
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
    expect(screen.getByLabelText('Target status')).toHaveTextContent('TARGET OBSERVED')

    fireEvent.click(screen.getByRole('button', { name: 'Execute Credential Access with KeyProbe' }))
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ATTEMPT IN PROGRESS')
    expect(screen.getByRole('group', { name: 'Attempt progress' })).toBeInTheDocument()

    await act(async () => { await vi.advanceTimersByTimeAsync(25_000) })
    expect(screen.getByLabelText('Target status')).toHaveTextContent('ACCESS GRANTED')

    fireEvent.click(screen.getByRole('button', { name: 'CONNECT' }))
    expect(screen.getByLabelText('Target status')).toHaveTextContent('CONNECTED')


  })

  it('produces canonical DeviceAccess and a canonical Remote Session, never a hacked flag', async () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={knownWeakness()}><Network /><StateSnapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' }))
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

  it('never lets newly available Inspect displace the relationship the player already holds', async () => {
    const accessUnder10 = withAccess(scannedTarget())
    expect(selectTarget(accessUnder10, SRV_01)?.stage).toBe('access')

    // Installing a release that supplies Inspect adds optional depth; it does
    // not insert a step into this target's line of action.
    const upgraded = withNodeScan11(accessUnder10)
    expect(selectTarget(upgraded, SRV_01)?.stage).toBe('access')
    const user = await openTarget(upgraded)
    const status = screen.getByLabelText('Target status')
    expect(status).toHaveTextContent('ACCESS GRANTED')
    expect(within(status).queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()

    await openDetails(user)
    expect(screen.queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: `Analyze SSH at ${SRV_01_ADDRESS}:22` }))
    expect(currentState().process.processes).toEqual([expect.objectContaining({ kind: 'service_analysis', serviceId: 'service-ssh-001' })])
  })

  it('names the Technique before its concrete provider and delegates execution', async () => {
    const user = await openTarget(knownWeakness())
    const status = screen.getByLabelText('Target status')
    expect(status).toHaveTextContent('TARGET OBSERVED')
    expect(status.textContent).not.toContain('AUTH-017')
    expect(status.textContent).not.toContain('Flipper')
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()

    const actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('Credential Access')
    expect(actions).toHaveTextContent('GHOSTKEY')
    await user.click(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' }))
    // The tool and the technique are still real: the started attempt carries both.
    expect(currentState().process.processes).toContainEqual(expect.objectContaining({
      kind: 'credential_access', serviceId: 'service-ssh-001', vulnerabilityId: 'AUTH-017', toolId: 'credential-access-module', moduleId: 'credential-access', status: 'running',
    }))
  })
})

/* -------------------------------------------------- information boundary */

describe('NodeScan information boundary', () => {
  it('shows an intentional empty ACTIONS state when no supported provider is owned', async () => {
    await openTarget(withoutSoftware(scannedTarget(), 'flipper'))
    const actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('NO OFFENSIVE TECHNIQUES AVAILABLE')
    expect(within(actions).queryByRole('button')).not.toBeInTheDocument()
  })

  it('builds every target view from player information alone', () => {
    const known = withNodeScan11(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState()))))
    const information = Object.defineProperty({ ...known }, 'world', { get: () => { throw new Error('hidden World read') } }) as GameState

    expect(selectTargets(information).map(({ address, stage }) => [address, stage])).toEqual([['198.51.100.1', 'unscanned'], [SRV_01_ADDRESS, 'route']])
    const target = selectTarget(information, SRV_01)!
    expect(target.offensiveActions).toContainEqual(expect.objectContaining({ provider: 'GhostKey 1.0', route: expect.objectContaining({ serviceName: 'SSH', implementation: 'GateSSH 1.3.2' }) }))
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
      result: { status: 'analysis_complete' as const },
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
      result: { status: 'analysis_complete' as const },
    }
    const stale = withProcesses(observed, [oldNegative])
    expect(ssh.inspect?.implementation.version).toBe('1.3.2')
    expect(selectTarget(stale, SRV_01)?.services.find(({ id }) => id === ssh.id)).toMatchObject({ analysisRequired: false })

    const noAssociation = { ...oldNegative, analyzedImplementation: undefined }
    expect(selectTarget(withProcesses(observed, [noAssociation]), SRV_01)?.services.find(({ id }) => id === ssh.id)).toMatchObject({ analysisRequired: false })

    const fresh = { ...oldNegative, id: 'process-new', analyzedImplementation: ssh.inspect!.implementation }
    expect(selectTarget(withProcesses(observed, [oldNegative, fresh]), SRV_01)?.services.find(({ id }) => id === ssh.id)).toMatchObject({ analysisRequired: false, analysisOutcome: 'analysis_complete' })
  })

  it('keeps a learned route as the primary decision while offering Inspect only as technical depth', async () => {
    const learnedUnder10 = knownWeakness(scannedTarget())
    expect(selectTarget(learnedUnder10, SRV_01)?.stage).toBe('route')

    const upgraded = withNodeScan11(learnedUnder10)
    expect(upgraded.discovery.devices.find(({ id }) => id === SRV_01)?.inspect?.enhanced).toBeUndefined()
    expect(selectTarget(upgraded, SRV_01)?.stage).toBe('route')

    const user = await openTarget(upgraded)
    const status = screen.getByLabelText('Target status')
    expect(within(status).queryByRole('button', { name: 'BYPASS' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).toBeInTheDocument()
    expect(within(status).queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()

    await openDetails(user)
    expect(screen.queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()
    expect(selectTarget(currentState(), SRV_01)?.stage).toBe('route')
    expect(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).toBeInTheDocument()
  })

  it('treats service-unavailable analysis as inconclusive and offers a canonical retry', async () => {
    const outcomes = [
      { ...analysisProcess('process-0001', 'service-ssh-001', 1000), status: 'completed' as const, result: { status: 'service_unavailable' as const } },
      { ...analysisProcess('process-0002', 'service-http-001', 1000), status: 'completed' as const, result: { status: 'analysis_complete' as const } },
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

  it('keeps KeyProbe independent when GhostKey is removed, on identical information', () => {
    const withTool = selectTarget(knownWeakness(), SRV_01)!
    const withoutTool = selectTarget(withoutSoftware(knownWeakness(), 'flipper'), SRV_01)!

    expect(withTool.stage).toBe('route')
    expect(withoutTool.stage).toBe('route')
    expect(withoutTool.routes).toEqual([])
    // The Knowledge itself is untouched; only the capability is gone.
    expect(withoutTool.services.find(({ id }) => id === 'service-ssh-001')!.weaknesses).toEqual([{ id: 'AUTH-017', label: 'Weak authentication configuration' }])
  })

  it('withdraws the hack from the interface when the represented tool is gone', async () => {
    await openTarget(knownWeakness())
    expect(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).toBeInTheDocument()
    cleanup()

    await openTarget(withoutSoftware(knownWeakness(), 'flipper'))
    expect(screen.queryByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Target status')).toHaveTextContent('TARGET OBSERVED')
  })

  it('keeps stale remembered information stale after the world changes for a reason the player never observed', async () => {
    // Some other cause changed the represented GateSSH release on a second
    // target (not the player's own submission). Remembered evidence must not
    // silently refresh from hidden World Truth.
    const analyzed = analyzedSrv02Ssh(withNodeScan11(createInitialGameState()))
    const changedWorld = {
      ...analyzed,
      world: { network: { ...analyzed.world.network, hosts: analyzed.world.network.hosts.map((host) => host.id !== 'host-lan-002' ? host : { ...host, services: host.services!.map((service) => service.id !== 'service-ssh-002' ? service : { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.3.2' } }) }) } },
    }

    const user = userEvent.setup()
    render(<GameProvider initialState={changedWorld}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: `Open target ${SRV_02_ADDRESS}` }))
    // The world now runs GateSSH 1.3.2, which is vulnerable. Player memory says 1.3.3: KeyProbe's own
    // surface is legitimately known from that stale memory alone, so its route and estimate already form.
    expect(screen.getByLabelText('Target status')).toHaveTextContent('TARGET OBSERVED')
    const actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('GateSSH 1.3.3')
    expect(actions).not.toHaveTextContent('GateSSH 1.3.2')
    // No current operation observes AuthGuard evidence, so the compute-100 estimate stays the unprotected baseline.
    expect(actions).toHaveTextContent('30%')
    await openDetails(user)
    const details = screen.getByText('SERVICES').closest('.ns-detail-panel') as HTMLElement
    expect(within(details).getByText('GateSSH 1.3.3')).toBeInTheDocument()
    expect(within(details).queryByText('GateSSH 1.3.2')).not.toBeInTheDocument()
  })

  it('never reveals AuthGuard, since no current operation observes it', async () => {
    const analyzed = analyzedSrv02Ssh()
    const user = userEvent.setup()
    render(<GameProvider initialState={analyzed}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: `Open target ${SRV_02_ADDRESS}` }))
    await openDetails(user)

    const ssh = screen.getByText('SSH').closest('.ns-service') as HTMLElement
    expect(ssh).not.toHaveTextContent('AuthGuard')
    expect(screen.queryByText('SECURITY SOFTWARE')).not.toBeInTheDocument()
  })

  it('never observes or changes anything by opening technical details', async () => {
    const user = await openTarget(knownWeakness())
    const before = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)
    scanTargetSpy.mockClear()

    await openDetails(user)
    expect(screen.getByText('Analysis found relevant information.')).toBeInTheDocument()
    // Credential Access's own ACTIONS surface legitimately names its surface (see the dedicated
    // action-semantics tests below); the ordinary Service card under technical depth still does not.
    const details = screen.getByText('SERVICES').closest('.ns-detail-panel') as HTMLElement
    expect(within(details).queryByText('AUTH-017')).not.toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)).toEqual(before)
  })

  it('never observes by browsing Known Space', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={scannedTarget()}><Network /><StateSnapshot /></GameProvider>)
    const before = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)
    scanTargetSpy.mockClear()

    await user.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)).toEqual(before)
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
    expect(status).toHaveTextContent('ATTEMPT IN PROGRESS')
    expect(screen.getByRole('group', { name: 'Attempt progress' })).toHaveTextContent('25%')
  })

  it('reports a failed attempt coarsely while the same route stays available', async () => {
    const failed = withProcesses(knownWeakness(), [{ ...credentialProcess(1200), status: 'completed', result: { status: 'attempt_failed', message: 'Authentication attempt failed.' } }])
    await openTarget(failed)
    const status = screen.getByLabelText('Target status')
    expect(status).toHaveTextContent('TARGET OBSERVED')
    expect(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).toBeInTheDocument()
  })

  it('states the running attempt from its own canonical facts, and never from World Truth', async () => {
    const running = withProcesses(knownWeakness(), [{ ...credentialProcess(300), toolId: 'credential-access-module' as const }])
    // The execution surface is built from the same information-only slice as the rest of NodeScan.
    const information = Object.defineProperty({ ...running }, 'world', { get: () => { throw new Error('hidden World read') } }) as GameState
    expect(selectTarget(information, SRV_01)?.operation).toEqual({
      kind: 'credential_access',
      title: 'CREDENTIAL ACCESS',
      percent: 25,
      facts: [
        { label: 'PROVIDER', value: 'GhostKey' },
        { label: 'ENDPOINT', value: `${SRV_01_ADDRESS}:22` },
        { label: 'WEAKNESS', value: 'AUTH-017 · Weak authentication configuration' },
      ],
    })

    await openTarget(running)
    const status = screen.getByLabelText('Target status')
    // The operation names itself; the stage keeps the word Known Space marks this target with.
    expect(status).toHaveTextContent('CREDENTIAL ACCESS')
    expect(status).toHaveTextContent('ATTEMPT IN PROGRESS')
    expect(status).toHaveTextContent(`${SRV_01_ADDRESS}:22`)
    expect(screen.getByRole('group', { name: 'Attempt progress' })).toHaveTextContent('25%')
  })

  it('names the provider the attempt actually ran through, not whatever is currently owned', () => {
    const throughFlipper = withProcesses(knownWeakness(), [credentialProcess(600)])
    expect(selectTarget(throughFlipper, SRV_01)?.operation?.facts[0]).toEqual({ label: 'PROVIDER', value: 'Flipper · GhostKey' })
  })

  it('says a Technique is running where its EXECUTE was, rather than offering an attempt that can only report ALREADY RUNNING', async () => {
    await openTarget(withProcesses(knownWeakness(), [credentialProcess(300)]))
    const actions = screen.getByRole('region', { name: 'ACTIONS' })

    expect(within(actions).queryByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).not.toBeInTheDocument()
    expect(within(actions).getByLabelText('Credential Access with GhostKey 1.0 running')).toHaveTextContent('RUNNING')
  })

  it('describes running analyses per Service, at the endpoints they were started against', async () => {
    await openTarget(withProcesses(scannedTarget(), [analysisProcess('process-0001', 'service-ssh-001', 250), analysisProcess('process-0002', 'service-http-001', 750)]))
    const status = screen.getByLabelText('Target status')

    expect(status).toHaveTextContent('SERVICE ANALYSIS')
    expect(status).toHaveTextContent(`SSH${SRV_01_ADDRESS}:22`)
    expect(status).toHaveTextContent(`HTTP${SRV_01_ADDRESS}:80`)
  })

  it('draws one progress rail for a running analysis, not one per surface it appears on', async () => {
    const user = await openTarget(withProcesses(scannedTarget(), [analysisProcess('process-0001', 'service-ssh-001', 250)]))
    await openDetails(user)

    // The execution surface carries the progress; the Service states that it is running.
    expect(screen.getAllByRole('group', { name: /progress/ })).toHaveLength(1)
    const details = screen.getByText('SERVICES').closest('.ns-detail-panel') as HTMLElement
    expect(within(details).getByText('ANALYZING')).toBeInTheDocument()

    // Where the headline is something else (an active Session), the Service row stays the only place its progress is shown.
    cleanup()
    const access = withAccess()
    const connected = { ...access, remoteSession: { nextId: 2, active: { id: 'session-0001', accessId: access.deviceAccess.established[0].id, connectedAddress: SRV_01_ADDRESS } } }
    const alongside = await openTarget(withProcesses(connected, [analysisProcess('process-0001', 'service-http-001', 500)]))
    await openDetails(alongside)
    expect(screen.getByLabelText('Target status')).toHaveTextContent('CONNECTED')
    expect(screen.getByRole('group', { name: `HTTP at ${SRV_01_ADDRESS}:80 analysis progress` })).toHaveTextContent('50%')
  })
})

/* -------------------------------------------- Credential Access semantics */

describe('Credential Access domain presentation', () => {
  function withCompute(state: GameState, computeCapacity: number): GameState {
    return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, cpu: { ...state.player.localDevice.hardware.cpu, computeCapacity } } } } }
  }

  function withoutWorldRead(state: GameState): GameState {
    return Object.defineProperty({ ...state }, 'world', { get: () => { throw new Error('hidden World read') } }) as GameState
  }

  /**
   * Known AUTH-031 against srv-02, optionally Analyzed through Bookstore's
   * public Gateway edge — the sole reachable route into its private
   * segment — with AuthGuard stripped from the represented current World
   * Truth. No current operation ever legitimately observes AuthGuard, so
   * every fixture here represents the only reachable case.
   */
  function knownAuth031({ inspect = false }: { inspect?: boolean } = {}): GameState {
    const base = withNodeScan11(createInitialGameState())
    const network = { ...base.world.network, hosts: base.world.network.hosts.map((host) => host.id === SRV_02 ? { ...host, installedSoftware: host.installedSoftware?.filter(({ id }) => id !== 'auth-guard') } : host) }
    const stripped = { ...base, world: { network } }
    const analyzed = inspect ? analyzedSrv02Ssh(stripped) : stripped
    return {
      ...analyzed,
      knowledge: { bookstoreMarket: { nextReportId: 1, reports: [] }, discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-031', observedLabel: 'Pre-authentication challenge state reuse', targetDeviceId: SRV_02, serviceId: 'service-ssh-002' }] },
    }
  }

  function keyProbeAction(state: GameState, deviceId: string) {
    return selectTarget(state, deviceId)?.offensiveActions.find((action) => action.providerId === 'keyprobe')
  }

  it('forms KeyProbe from the legitimately known GateSSH 1.3.3 surface alone and estimates the canonical 30% chance at compute 100 with no known AuthGuard, without needing AUTH-031 Knowledge', () => {
    const state = knownAuth031({ inspect: true })
    // No named Vulnerability is consulted to form this route: it forms identically with Knowledge erased.
    const withoutKnowledge = { ...state, knowledge: { bookstoreMarket: { nextReportId: 1, reports: [] }, discoveredVulnerabilities: [] } }
    const action = keyProbeAction(withoutWorldRead(withoutKnowledge), SRV_02)
    expect(action?.route).toMatchObject({ implementation: 'GateSSH 1.3.3', serviceImplementation: { releaseId: 'gate-ssh-1.3.3' } })
    expect(action?.route).not.toHaveProperty('vulnerabilityId')
    expect(action?.assessment).toEqual({ kind: 'estimate', percent: 30 })
  })

  it('raises the estimate with stronger current compute, never the Device Model ceiling', () => {
    const state = withCompute(knownAuth031({ inspect: true }), 160)
    expect(state.player.localDevice.deviceModel.maximumComputeCapacity).toBe(100)
    expect(keyProbeAction(withoutWorldRead(state), SRV_02)?.assessment).toEqual({ kind: 'estimate', percent: 45 })
  })

  it('never lets a hidden, unobserved AuthGuard installation affect the estimate', () => {
    // The player Inspected before AuthGuard was ever installed, so its surface is legitimately known;
    // AuthGuard is added to World Truth afterward, unobserved.
    const inspectedFirst = knownAuth031({ inspect: true })
    const hiddenAuthGuardAdded = { ...inspectedFirst, world: { network: { ...inspectedFirst.world.network, hosts: inspectedFirst.world.network.hosts.map((host) => host.id === SRV_02 ? { ...host, installedSoftware: [...(host.installedSoftware ?? []), AUTH_GUARD_1_0_INSTALLATION] } : host) } } }
    expect(keyProbeAction(withoutWorldRead(hiddenAuthGuardAdded), SRV_02)?.assessment).toEqual({ kind: 'estimate', percent: 30 })
  })

  it('does not let a hidden current GateSSH change move the estimate while remembered evidence stays stale', () => {
    const observed = knownAuth031({ inspect: true })
    const changed = { ...observed, world: { network: { ...observed.world.network, hosts: observed.world.network.hosts.map((host) => host.id === SRV_02 ? { ...host, services: host.services!.map((service) => service.id === 'service-ssh-002' ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } } : service) } : host) } } }
    const action = keyProbeAction(withoutWorldRead(changed), SRV_02)
    expect(action?.route).toMatchObject({ implementation: 'GateSSH 1.3.3' })
    expect(action?.assessment).toEqual({ kind: 'estimate', percent: 30 })
  })

  it('keeps a running KeyProbe operation showing the implementation its own Process snapshotted, even after Discovery is refreshed to a different one', () => {
    const state = knownAuth031({ inspect: true })
    const runningProcess: CredentialAccessProcess = {
      kind: 'credential_access', id: 'process-0001', label: 'CREDENTIAL ACCESS', executorDeviceId: state.player.localDevice.id,
      status: 'running', ramRequiredMiB: 896, workRequired: 1800, workCompleted: 300,
      targetDeviceId: SRV_02, serviceId: 'service-ssh-002', startedEndpoint: `${SRV_02_ADDRESS}:22`,
      serviceImplementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-gate-ssh-1.3.3-v0' }, toolId: 'keyprobe',
    }
    const running = withProcesses(state, [runningProcess])
    expect(selectTarget(running, SRV_02)?.operation?.facts).toContainEqual({ label: 'TARGET', value: 'GateSSH 1.3.3' })

    // The player legitimately re-Analyzes the endpoint mid-attempt; Discovery now remembers a different implementation.
    // Elapsed time is longer than `analyzedDiscovery`'s usual 20s: this re-analysis now shares the executor's
    // compute with the still-running KeyProbe attempt above, so it needs enough of a shared segment to finish
    // while comfortably leaving that longer KeyProbe attempt still running once it gets the freed-up full rate.
    const alteredWorld = { ...running.world, network: { ...running.world.network, hosts: running.world.network.hosts.map((host) => host.id === SRV_02 ? { ...host, services: host.services!.map((service) => service.id === 'service-ssh-002' ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID, name: 'GateSSH', version: '1.3.2' } } : service) } : host) } }
    const reanalyzing = startServiceAnalysis({ ...running, world: alteredWorld }, SRV_02, 'service-ssh-002')
    if (reanalyzing.status !== 'started') throw new Error(reanalyzing.status)
    const refreshed = advanceGameState(reanalyzing.state, 27_000)
    const afterTarget = selectTarget(refreshed, SRV_02)!
    expect(afterTarget.services.find(({ id }) => id === 'service-ssh-002')?.observed?.implementation).toBe('GateSSH 1.3.2')
    // The running operation still describes what this Process actually started against, not the fresher observation.
    expect(afterTarget.operation?.facts).toContainEqual({ label: 'TARGET', value: 'GateSSH 1.3.3' })
  })

  it('presents the specialized module as MATCHED compatibility, never a fabricated percentage', async () => {
    const state = withNodeScan11(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState()))))
    const inspected = { ...state, discovery: analyzedDiscovery(state, { localDevice: state.player.localDevice, network: state.world.network }, state.discovery, SRV_01_ADDRESS) }
    const action = selectTarget(inspected, SRV_01)?.offensiveActions.find((entry) => entry.providerId === 'credential-access-module')
    expect(action?.assessment).toEqual({ kind: 'compatibility', status: 'MATCHED' })

    await openTarget(inspected)
    const moduleAction = screen.getByText('GHOSTKEY').closest('.ns-action') as HTMLElement
    expect(moduleAction).toHaveTextContent('COMPATIBILITY')
    expect(moduleAction).toHaveTextContent('MATCHED')
    expect(moduleAction).not.toHaveTextContent(/\d+%/)
  })

  it('keeps owned GhostKey visible but unavailable without current fingerprint observation', () => {
    const action = selectTarget(scannedTarget(), SRV_01)?.offensiveActions.find((entry) => entry.providerId === 'credential-access-module')
    expect(action?.assessment).toBeUndefined()
    expect(action?.route).toBeUndefined()
  })

  it('keeps GhostKey owned but unmatched once a later legitimate observation names a different implementation', () => {
    const state = withNodeScan11(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState()))))
    const patchedNetwork = { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === SRV_01 ? { ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-gate-ssh-1.3.3-v0', name: 'GateSSH', version: '1.3.3' } } : service) } : host) }
    const targets = { localDevice: state.player.localDevice, network: patchedNetwork }
    const discovery = analyzedDiscovery(state, targets, state.discovery, SRV_01_ADDRESS)
    // Historical AUTH-017 Knowledge is untouched; the newer observation only informs compatibility.
    const action = selectTarget({ ...state, discovery }, SRV_01)?.offensiveActions.find((entry) => entry.providerId === 'credential-access-module')
    expect(action?.assessment).toBeUndefined()
    expect(action?.route).toBeUndefined()
    expect(selectTarget({ ...state, discovery }, SRV_01)?.services.find(({ id }) => id === 'service-ssh-001')?.weaknesses).toEqual([{ id: 'AUTH-017', label: 'Weak authentication configuration' }])
  })

  it('classifies a stale-surface failure, a probabilistic rejection, and an observed-protection failure distinctly in ACTIONS', async () => {
    const surfaceMismatch = { ...credentialProcess(1200), toolId: 'credential-access-module' as const, status: 'completed' as const, result: { status: 'attempt_failed' as const, message: 'Authentication attempt failed.' as const, reason: 'surface_mismatch' as const } }
    await openTarget(withProcesses(knownWeakness(), [surfaceMismatch]))
    let actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('ATTEMPT FAILED')
    expect(actions).toHaveTextContent('Your information may be outdated')
    cleanup()

    const rejected = { ...credentialProcess(1200), toolId: 'keyprobe' as const, status: 'completed' as const, result: { status: 'attempt_failed' as const, message: 'Authentication attempt failed.' as const, reason: 'authentication_rejected' as const } }
    await openTarget(withProcesses(knownWeakness(), [rejected]))
    actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('Authentication attempt rejected')
    expect(actions).not.toHaveTextContent('Surface mismatch')
    cleanup()

    const protectedFailure = { ...credentialProcess(1200), toolId: 'keyprobe' as const, status: 'completed' as const, result: { status: 'attempt_failed' as const, message: 'Authentication attempt failed.' as const, reason: 'protection_observed' as const } }
    await openTarget(withProcesses(knownWeakness(), [protectedFailure]))
    actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('Protection response detected')
  })

  it('preserves historical AUTH-017 Knowledge while stale canonical Discovery withdraws the route', () => {
    const before = knownWeakness()
    const service = before.discovery.devices.find(({ id }) => id === SRV_01)!.services.find(({ id }) => id === 'service-ssh-001')!
    const discovery = { ...before.discovery, devices: before.discovery.devices.map((device) => device.id === SRV_01 ? { ...device, services: device.services.map((candidate) => candidate.id === service.id ? { ...candidate, implementationAnalysisStale: true as const } : candidate) } : device) }
    const mismatched = withProcesses({ ...before, discovery }, [{ ...credentialProcess(1200), toolId: 'credential-access-module' as const, status: 'completed' as const, result: { status: 'attempt_failed' as const, message: 'Authentication attempt failed.' as const, reason: 'surface_mismatch' as const } }])
    const target = selectTarget(mismatched, SRV_01)!
    expect(target.services.find(({ id }) => id === 'service-ssh-001')?.weaknesses).toEqual([{ id: 'AUTH-017', label: 'Weak authentication configuration' }])
    const action = target.offensiveActions.find((entry) => entry.providerId === 'credential-access-module')!
    expect(action.route).toBeUndefined()
    expect(action.assessment).toEqual({ kind: 'compatibility', status: 'STALE' })
    expect(action.reanalysisServiceId).toBe('service-ssh-001')
    expect(action.lastFailureReason).toBe('surface_mismatch')
  })

  it('scopes stale reanalysis to its own exact Service, so unrelated stale evidence on one Service cannot replace a fresh route/action formed on another', () => {
    const before = knownWeakness()
    const staleServiceId = 'service-ssh-001'
    // A second, unrelated Service on the same Device: a freshly analyzed KeyProbe-supported GateSSH 1.3.3
    // surface, entirely independent of the stale GhostKey surface on service-ssh-001.
    const freshKeyProbeService = { id: 'service-ssh-alt', name: 'SSH-ALT', port: 2222, protocol: 'TCP' as const, endpoint: `${SRV_01_ADDRESS}:2222`, inspect: { implementation: { name: 'GateSSH', version: '1.3.3' } } }
    const discovery = {
      ...before.discovery,
      devices: before.discovery.devices.map((device) => device.id === SRV_01
        ? { ...device, services: [
            ...device.services.map((candidate) => candidate.id === staleServiceId ? { ...candidate, implementationAnalysisStale: true as const } : candidate),
            freshKeyProbeService,
          ] }
        : device),
    }
    const staleFailure = { ...credentialProcess(1200), toolId: 'credential-access-module' as const, status: 'completed' as const, result: { status: 'attempt_failed' as const, message: 'Authentication attempt failed.' as const, reason: 'surface_mismatch' as const } }
    const target = selectTarget(withProcesses({ ...before, discovery }, [staleFailure]), SRV_01)!

    // KeyProbe's own fresh route on the unrelated Service is untouched: no reanalysis hint and no bled-over failure.
    const keyProbe = target.offensiveActions.find((action) => action.providerId === 'keyprobe')!
    expect(keyProbe.route).toMatchObject({ serviceId: 'service-ssh-alt', implementation: 'GateSSH 1.3.3' })
    expect(keyProbe.reanalysisServiceId).toBeUndefined()
    expect(keyProbe.lastFailureReason).toBeUndefined()

    // GhostKey's own action still correctly points reanalysis at the exact Service whose analysis it was.
    const ghostKey = target.offensiveActions.find((action) => action.providerId === 'credential-access-module')!
    expect(ghostKey.route).toBeUndefined()
    expect(ghostKey.assessment).toEqual({ kind: 'compatibility', status: 'STALE' })
    expect(ghostKey.reanalysisServiceId).toBe(staleServiceId)
    expect(ghostKey.lastFailureReason).toBe('surface_mismatch')
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
    expect(screen.queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()
  })

  it('offers endpoint Analysis rather than the retired generic Inspect depth', async () => {
    const user = await openTarget(scannedTarget(withNodeScan11(createInitialGameState())))
    await openDetails(user)
    expect(screen.queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: `Analyze SSH at ${SRV_01_ADDRESS}:22` })).toBeInTheDocument()
  })

  it('keeps technical intelligence separate from the action provenance', async () => {
    const user = await openTarget(withNodeScan11(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState())))))
    await openDetails(user)

    const details = screen.getByText('SERVICES').closest('.ns-detail-panel')!
    expect(details).not.toHaveTextContent('Standalone Module')
    expect(details).toHaveTextContent('GateSSH 1.3.2')
    expect(details).toHaveTextContent('Analysis found relevant information.')
    expect(details).not.toHaveTextContent('Weak authentication configuration')
    expect(details).not.toHaveTextContent('AUTH-017')
    expect(details).not.toHaveTextContent('AUTHENTICATION')
    expect(details).not.toHaveTextContent('Credential')
  })

  it('keeps single-Service investigation available as advanced depth', async () => {
    const user = await openTarget(scannedTarget())
    await openDetails(user)
    await user.click(screen.getByRole('button', { name: `Analyze HTTP at ${SRV_01_ADDRESS}:80` }))

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
      status: 'completed', result: { status: 'analysis_complete' },
    }])
    const user = await openTarget(analysed)
    await openDetails(user)

    const serviceOf = (name: string) => screen.getByRole('button', { name: new RegExp(`^Analyze ${name} at `) }).closest('.ns-service') as HTMLElement
    const precedesItsAction = (article: HTMLElement, statement: HTMLElement) =>
      statement.compareDocumentPosition(within(article).getByRole('button', { name: /^Analyze / })) & Node.DOCUMENT_POSITION_FOLLOWING

    const http = serviceOf('HTTP')
    expect(precedesItsAction(http, within(http).getByText('Endpoint analysis complete.'))).toBeTruthy()

    // The same ordering a Service with learned relevant information already had.
    const ssh = serviceOf('SSH')
    expect(precedesItsAction(ssh, within(ssh).getByText('Analysis found relevant information.'))).toBeTruthy()
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

/* ------------------------------------------------------- target topology */

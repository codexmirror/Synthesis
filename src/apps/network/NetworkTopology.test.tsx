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

describe('NodeScan target topology', () => {
  /**
   * srv-02 itself (established through Bookstore's public Gateway edge, its own Discovery identity),
   * plus its private LAN peers as remembered from a hypothetical Scan sourced from srv-02 — a test
   * fixture for this file's own topology-rendering coverage only, not a default game assumption or a
   * route the shipped V1 game actually offers.
   */
  function knownRemote(state: GameState = createInitialGameState()): GameState {
    const withFlipper = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [...state.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION] } } }
    const analyzed = analyzedSrv02Ssh(withFlipper)
    const discovery = rememberScan(analyzed.discovery, scanFromDevice(withSrv02NodeScan(analyzed), SRV_02, 'remote-segment-01'), SRV_02)
    return { ...analyzed, discovery }
  }

  it('presents a compact Network -> Device -> Service hierarchy above ACTIONS, from observed identity alone', async () => {
    await openTarget(scannedTarget(withNodeScan11(createInitialGameState())))
    const topology = screen.getByRole('region', { name: 'Target topology' })
    const actions = screen.getByRole('region', { name: 'ACTIONS' })

    // The topology sits above ACTIONS in document order.
    expect(topology.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    expect(topology).toHaveTextContent('home-net')
    // No current operation observes a display name, so the address leads.
    expect(topology).toHaveTextContent(SRV_01_ADDRESS)
    expect(topology).toHaveTextContent('SSH')
    expect(topology).toHaveTextContent('22/TCP')
    expect(topology).toHaveTextContent('GateSSH 1.3.2')
    expect(topology).toHaveTextContent('HTTP')
    expect(topology).toHaveTextContent('80/TCP')
    expect(topology).toHaveTextContent('Basic HTTP 1.0')
  })

  it('never claims a live ONLINE state from historical observation alone, on the Device or on a Service', async () => {
    // servicesObserved only proves a past Scan succeeded, not that the Device
    // is online now: the Device line states the weaker OBSERVED fact, and
    // every remembered Service carries the same neutral mark in its own slot.
    await openTarget(scannedTarget(withNodeScan11(createInitialGameState())))
    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(topology).not.toHaveTextContent('ONLINE')

    // No current operation observes a display name, so the Device row states the bare address.
    const deviceRow = topology.querySelector('.ns-topo-row--device')!
    expect(within(deviceRow as HTMLElement).getByText('OBSERVED')).toBeInTheDocument()

    const sshRow = within(topology).getByText('SSH · 22/TCP').closest('.ns-topo-row') as HTMLElement
    expect(within(sshRow).getByText('OBSERVED')).toBeInTheDocument()
    const httpRow = within(topology).getByText('HTTP · 80/TCP').closest('.ns-topo-row') as HTMLElement
    expect(within(httpRow).getByText('OBSERVED')).toBeInTheDocument()
  })

  it('projects NodeScan 1.2 Device lifecycle and Service availability live, and withdraws it immediately on downgrade', () => {
    const monitored = withNodeScan12(scannedTarget())
    expect(selectTarget(monitored, SRV_01, monitored)).toMatchObject({
      liveStatus: { label: 'ONLINE' },
      services: [{ liveStatus: { label: 'ONLINE' } }, { liveStatus: { label: 'ONLINE' } }],
    })
    for (const [lifecycle, connectivity, label] of [
      ['SHUTTING_DOWN', 'DISCONNECTED', 'SHUTTING DOWN'],
      ['BOOTING', 'DISCONNECTED', 'BOOTING'],
      ['RUNNING', 'RECONNECTING', 'RECONNECTING'],
      ['RUNNING', 'DISCONNECTED', 'OFFLINE'],
    ] as const) {
      const changed = { ...monitored, world: { network: { ...monitored.world.network, hosts: monitored.world.network.hosts.map((host) => host.id === SRV_01 ? { ...host, operational: { lifecycle, connectivity } } : host) } } }
      expect(selectTarget(changed, SRV_01, changed)?.liveStatus?.label).toBe(label)
      expect(selectTarget(changed, SRV_01, changed)?.services.every(({ liveStatus }) => liveStatus?.label === 'OFFLINE')).toBe(true)
    }
    const downgraded = withNodeScan11(monitored)
    expect(selectTarget(downgraded, SRV_01, downgraded)?.liveStatus).toBeUndefined()
  })

  it('uses currently usable access as a narrow live path and never leaks it to another Service', () => {
    const accessed = withAccess(scannedTarget())
    const live = selectTarget(accessed, SRV_01, accessed)!
    expect(live.liveStatus?.label).toBe('ONLINE')
    expect(live.services.find(({ id }) => id === 'service-ssh-001')?.liveStatus?.label).toBe('ONLINE')
    expect(live.services.find(({ id }) => id === 'service-http-001')?.liveStatus).toBeUndefined()

    const unreachable = { ...accessed, world: { network: { ...accessed.world.network, hosts: accessed.world.network.hosts.map((host) => host.id === SRV_01 ? { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } } : host) } } }
    const historical = selectTarget(unreachable, SRV_01, unreachable)!
    expect(historical.access).toBeDefined()
    expect(historical.liveStatus).toBeUndefined()
    expect(historical.services.every(({ liveStatus }) => liveStatus === undefined)).toBe(true)
  })

  it('opens only learned integrated intelligence without changing GameState', async () => {
    const state = withProcesses(withNodeScan12(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState())))), [completedGateSshAnalysis('1.3.2', 'AUTH-017')])
    const user = await openTarget(state)
    const before = currentState()
    await user.click(screen.getByText('GateSSH 1.3.2', { selector: 'summary span' }))
    expect(screen.queryByText(/^KNOWN INFO$/)).not.toBeInTheDocument()
    expect(screen.getByText('KNOWN INFORMATION')).toBeInTheDocument()
    expect(screen.getByText(/AUTH-017 · Weak authentication configuration/)).toBeInTheDocument()
    expect(screen.queryByText(/AUTH-031/)).not.toBeInTheDocument()
    expect(currentState()).toEqual(before)
  })

  it('keeps GateSSH intelligence release-aware and scopes provider success to the exploited weakness', () => {
    const observed132 = scannedTarget(withNodeScan11(createInitialGameState()))
    const learned132 = withProcesses(withNodeScan12(knownWeakness(observed132)), [
      completedGateSshAnalysis('1.3.2', 'AUTH-017'),
      { ...credentialProcess(1200), status: 'completed', toolId: 'credential-access-module', result: { status: 'access_established', accessId: 'access-0001' } },
    ])
    expect(selectTarget(learned132, SRV_01)?.services[0].intelligence).toEqual([expect.objectContaining({
      software: 'GateSSH 1.3.2',
      details: expect.arrayContaining(['AUTH-017 · Weak authentication configuration', 'GhostKey successfully exploited AUTH-017.']),
    })])

    const device = learned132.discovery.devices.find(({ id }) => id === SRV_01)!
    const discovery = { ...learned132.discovery, devices: learned132.discovery.devices.map((candidate) => candidate.id !== SRV_01 ? candidate : { ...device, services: device.services.map((service) => service.id !== 'service-ssh-001' ? service : { ...service, inspect: { ...service.inspect!, implementation: { ...service.inspect!.implementation!, version: '1.3.3' } } }) }) }
    const observed133 = { ...learned132, discovery }
    const history = selectTarget(observed133, SRV_01)!.services[0].intelligence[0]
    expect(history.details).toContain('AUTH-017 · Weak authentication configuration')
    expect(history.details).not.toContain(expect.stringMatching(/successfully exploited/))
    expect(history.details).not.toContain(expect.stringMatching(/AUTH-031/))

    const analyzed133 = withProcesses(observed133, [...observed133.process.processes, completedGateSshAnalysis('1.3.3', 'AUTH-031')])
    expect(selectTarget(analyzed133, SRV_01)!.services[0].intelligence[0].details).not.toContain(expect.stringMatching(/AUTH-031/))
  })

  it('draws no provider conclusion from a failed Credential Access attempt', () => {
    const state = withProcesses(withNodeScan12(knownWeakness(scannedTarget(withNodeScan11(createInitialGameState())))), [
      completedGateSshAnalysis('1.3.2', 'AUTH-017'),
      { ...credentialProcess(1200), status: 'completed', toolId: 'keyprobe', result: { status: 'attempt_failed', message: 'Authentication attempt failed.' } },
    ])
    expect(selectTarget(state, SRV_01)!.services[0].intelligence[0].details).toEqual(['AUTH-017 · Weak authentication configuration'])
  })

  it('never presents AuthGuard intelligence, since no current operation observes it', () => {
    let state = analyzedSrv02Ssh(withNodeScan12(createInitialGameState()))
    const failed: CredentialAccessProcess = {
      ...credentialProcess(1200), id: 'protected-attempt', status: 'completed', targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002',
      startedEndpoint: '203.0.113.42:22', vulnerabilityId: 'AUTH-031', toolId: 'keyprobe', moduleId: undefined,
      authGuardProtectionObserved: true,
      result: { status: 'attempt_failed', message: 'Authentication attempt failed.' },
    }
    state = { ...state, process: { nextId: 2, processes: [failed] } }
    const intelligence = selectTarget(state, 'host-lan-002')!.services[0].intelligence
    expect(intelligence.find(({ software }) => software === 'AuthGuard 1.0')).toBeUndefined()
    expect(intelligence.find(({ software }) => software === 'GateSSH 1.3.3')).toBeUndefined()
  })

  it('does not expose hidden weakness intelligence without learned Knowledge', async () => {
    await openTarget(withNodeScan12(scannedTarget(withNodeScan11(createInitialGameState()))))
    expect(screen.queryByText('KNOWN INFO')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Toggle known information/)).not.toBeInTheDocument()
  })

  it('projects only contextual remembered members, including legitimately remembered SELF', () => {
    const home = withNodeScan12(scannedTarget())
    const homeTarget = selectTarget(home, SRV_01, home)!

    expect(homeTarget.networks[0].members).toEqual([expect.objectContaining({
      id: home.player.localDevice.id,
      address: home.player.localDevice.network.ip,
      isSelf: true,
      liveStatus: { label: 'ONLINE', tone: 'available' },
    }), expect.objectContaining({ id: 'router-home-001', address: '198.51.100.1' })])
    expect(homeTarget.networks[0].members.some(({ id }) => id === SRV_01)).toBe(false)

    const withoutRememberedSelf = {
      ...home,
      discovery: {
        ...home.discovery,
        networkDeviceRelations: home.discovery.networkDeviceRelations.filter(({ deviceId }) => deviceId !== home.player.localDevice.id),
      },
    }
    expect(selectTarget(withoutRememberedSelf, SRV_01, withoutRememberedSelf)?.networks[0].members).toEqual([expect.objectContaining({ id: 'router-home-001' })])
  })

  it('summarizes other remembered foreign members by address, since no operation observes a display name, without leaking the selected or hidden Devices', async () => {
    const scanned = knownRemote(withNodeScan12(createInitialGameState()))
    const members = selectTarget(scanned, 'host-lan-002', scanned)!.networks[0].members
    expect(members).toEqual([
      expect.objectContaining({ id: 'host-lan-003', address: '10.42.0.43', liveStatus: { label: 'ONLINE', tone: 'available' } }),
      expect.objectContaining({ id: 'host-phone-001', address: PHONE_ADDRESS, liveStatus: { label: 'ONLINE', tone: 'available' } }),
      expect.objectContaining({ id: 'router-foreign-001', address: '10.42.0.1', liveStatus: { label: 'ONLINE', tone: 'available' } }),
    ])
    expect(members[0].displayName).toBeUndefined()
    expect(members[1].displayName).toBeUndefined()
    expect(selectTarget(withNodeScan11(scanned), 'host-lan-002', withNodeScan11(scanned))!.networks[0].members[0].liveStatus).toBeUndefined()

    const user = userEvent.setup()
    render(<GameProvider initialState={scanned}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: `Open target ${SRV_02_ADDRESS}` }))
    const rendered = screen.getByRole('region', { name: 'Target topology' })
    expect(rendered).toHaveTextContent('remote-segment-01')
    expect(rendered).not.toHaveTextContent(PHONE_ADDRESS)
    expect(rendered).not.toHaveTextContent('10.42.0.43')
    // srv-02's own legitimately observed address is its Gateway's public edge — the same one this check
    // once verified was never leaked as an unrelated peer's, back when srv-02 was shown at a different address.
    expect(rendered).toHaveTextContent(SRV_02_ADDRESS)

  })

  it('renders only the selected home Device and compact Network affiliation', async () => {
    const scanned = withNodeScan12(scannedTarget())
    await openTarget(scanned)

    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(within(topology).queryByLabelText('Known members of home-net')).not.toBeInTheDocument()
    expect(topology).toHaveTextContent('home-net')
    expect(topology).not.toHaveTextContent('SELF')
    expect(topology).not.toHaveTextContent('198.51.100.1')
    expect(within(topology).getAllByText(SRV_01_ADDRESS)).toHaveLength(1)
  })

  it('renders only the selected phone and compact Network affiliation', async () => {
    const scanned = knownRemote(withNodeScan12(createInitialGameState()))
    const user = userEvent.setup()
    render(<GameProvider initialState={scanned}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: `Open target ${PHONE_ADDRESS}` }))

    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(within(topology).queryByLabelText('Known members of remote-segment-01')).not.toBeInTheDocument()
    expect(topology).toHaveTextContent('remote-segment-01')
    expect(topology).not.toHaveTextContent(SRV_02_ADDRESS)
    expect(topology).not.toHaveTextContent('203.0.113.42')
    expect(within(topology).getAllByText(PHONE_ADDRESS)).toHaveLength(1)
  })

  it('never states Service software identity beyond what was legitimately observed', async () => {
    // No NodeScan 1.1 Experimental installed: Scan alone remembers open Services, never their software.
    await openTarget(scannedTarget())
    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(topology).toHaveTextContent('SSH')
    expect(topology).not.toHaveTextContent('GateSSH')
  })

  it('states unobserved topology explicitly rather than fabricating Services', async () => {
    await openTarget(foundTargets())
    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(topology).toHaveTextContent('Services not observed')
    expect(topology).not.toHaveTextContent('OBSERVED')
    expect(topology).not.toHaveTextContent('NO RESPONSE')
  })

  it('reflects a real unreachable Scan result truthfully, without inventing a stronger runtime claim', async () => {
    const known = foundTargets()
    const offline: GameState = { ...known, world: { ...known.world, network: { ...known.world.network, hosts: known.world.network.hosts.map((host) => host.id === SRV_01 ? { ...host, operational: { ...host.operational, connectivity: 'DISCONNECTED' } } : host) } } }
    const user = await openTarget(offline)
    expect(screen.getByLabelText('Target status')).toHaveTextContent('NOT SCANNED')

    await user.click(screen.getByRole('button', { name: 'SCAN' }))
    expect(screen.getByRole('status')).toHaveTextContent('NO RESPONSE')

    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(topology).toHaveTextContent('NO RESPONSE')
    // Never REBOOTING or RECONNECTING: NodeScan has no legitimate route to that fact.
    expect(topology).not.toHaveTextContent('REBOOTING')
    expect(topology).not.toHaveTextContent('RECONNECTING')

    // Transient: leaving and reopening the target starts a fresh read, not a remembered outage.
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    await user.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    expect(screen.getByRole('region', { name: 'Target topology' })).not.toHaveTextContent('NO RESPONSE')
  })

  it('marks a running DEAUTH as Network-scoped on the topology, never Device- or Service-scoped', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={knownRemote()}><Network /><StateSnapshot /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: `Open target ${SRV_02_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: 'Execute DEAUTH' }))

    expect(screen.getByLabelText('Target status')).toHaveTextContent('DEAUTH NETWORK')
    const topology = screen.getByRole('region', { name: 'Target topology' })
    expect(topology).toHaveTextContent('DISRUPTING')
    // Exactly one mark, scoped to the Network row - never repeated per Device or Service.
    expect(screen.getAllByText('DISRUPTING')).toHaveLength(1)
    expect(within(topology).getByText('DISRUPTING').closest('.ns-topo-row--network')).toBeTruthy()

    // Device and Service rows carry no DEAUTH-scoped mark of their own.
    // Only Scan was remembered here, no Inspect, so the Device row states the bare address.
    const deviceRow = topology.querySelector('.ns-topo-row--device') as HTMLElement
    expect(within(deviceRow).queryByText('DISRUPTING')).not.toBeInTheDocument()
  })
})

/* ------------------------------------------------ RackUpdate as depth only */

describe('RackUpdate exploit and package submission', () => {
  // The Rollback Module is not integrated by default (the Market is its represented acquisition path), so this fixture states the concrete Flipper build that has it.
  // Both srv-02's GateSSH and RackUpdate surfaces are reached through Bookstore's own public Gateway edge,
  // which forwards each to its own external port.
  function srv02(): GameState {
    const analyzed = analyzedSrv02Ssh(withNodeScan11(createInitialGameState()))
    const rackUpdateAnalysis = startServiceAnalysisFromObservation(analyzed, { endpoint: '203.0.113.42:8443', targetDeviceId: SRV_02, serviceId: 'service-rack-update-002' })
    if (rackUpdateAnalysis.status !== 'started') throw new Error(rackUpdateAnalysis.status)
    const observed = advanceGameState(rackUpdateAnalysis.state, 20_000)
    const gatePackage = observed.world.network.hosts.find(({ id }) => id === SRV_01)!.filesystem!.files.find(({ id }) => id === 'file-0003')!
    return {
      ...observed,
      knowledge: { bookstoreMarket: { nextReportId: 1, reports: [] }, discoveredVulnerabilities: [{ vulnerabilityId: 'UPD-001', observedLabel: 'Rollback protection not enforced', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' }] },
      player: {
        ...observed.player,
        localDevice: {
          ...observed.player.localDevice,
          installedSoftware: [...observed.player.localDevice.installedSoftware, { ...FLIPPER_1_0_CANONICAL_INSTALLATION, buildId: FLIPPER_1_0_ROLLBACK_INTEGRATED_BUILD_ID, integratedModules: ['credential-access', 'rollback'] as const, sizeBytes: FLIPPER_1_0_CANONICAL_INSTALLATION.sizeBytes + 1_600_000 + ROLLBACK_MODULE_1_0.sizeBytes } as import('../../core/game/types').FlipperInstallation],
          filesystem: { ...observed.player.localDevice.filesystem, files: [...observed.player.localDevice.filesystem.files, { ...gatePackage, id: 'file-local-gate', path: '/home/user/downloads/gatessh-1.3.2.pkg' }] },
        },
      },
    }
  }

  it('shows Rollback alone when that is the only exact supported provider owned', async () => {
    const state = srv02()
    const rollbackOnly = {
      ...state,
      player: { ...state.player, localDevice: {
        ...state.player.localDevice,
        installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'flipper' && id !== 'keyprobe'),
        filesystem: { ...state.player.localDevice.filesystem, files: [
          ...state.player.localDevice.filesystem.files.filter((file) => file.kind !== 'software_module'),
          { kind: 'software_module' as const, id: 'rollback-only', path: '/home/user/modules/rollback_1.0.mod', ...ROLLBACK_MODULE_1_0 },
        ] },
      } },
    }
    render(<GameProvider initialState={rollbackOnly}><Network /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Open target 203.0.113.42' }))
    const actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('ROLLBACK')
    expect(actions).toHaveTextContent('/home/user/modules/rollback_1.0.mod')
    expect(actions).not.toHaveTextContent('Credential Access')
  })

  it('presents owned Techniques without recommending one or calling Rollback Device access', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={srv02()}><Network /><StateSnapshot /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open target 203.0.113.42' }))

    const view = screen.getByLabelText('NodeScan')
    const details = view.querySelector('details')!
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByLabelText('Target status')).toHaveTextContent('TARGET OBSERVED')
    expect(screen.getByLabelText('Target status')).not.toHaveTextContent('ACCESS')
    const actions = screen.getByRole('region', { name: 'ACTIONS' })
    expect(actions).toHaveTextContent('Credential Access')
    expect(actions).toHaveTextContent('ROLLBACK')
    expect(actions).not.toHaveTextContent(/RECOMMENDED|BEST OPTION/)
    // The specialized module has no currently formed execution context (AUTH-017
    // is not yet Knowledge here), so it stays visible with its provider but
    // presents a quiet unavailable mark instead of a disabled EXECUTE control.
    expect(within(actions).queryByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).not.toBeInTheDocument()
    expect(within(actions).getAllByLabelText(/Credential Access with .* unavailable/)).toHaveLength(1)
    // KeyProbe's own authentication surface is legitimately known from Inspect alone, with no Vulnerability
    // Knowledge required, so it stays a real EXECUTE control here.
    expect(within(actions).getByRole('button', { name: 'Execute Credential Access with KeyProbe' })).toBeInTheDocument()
    // Rollback's context is formed, so it stays a real EXECUTE control.
    expect(within(actions).getByRole('button', { name: 'Execute Rollback' })).toBeInTheDocument()
    await user.click(screen.getByText('TECHNICAL INTELLIGENCE'))
    expect(screen.getByRole('button', { name: 'Execute Rollback' }).closest('details')).toBeNull()
  })

  it('does not offer the avenue before UPD-001 is earned', async () => {
    const unknown = { ...srv02(), knowledge: { bookstoreMarket: { nextReportId: 1, reports: [] }, discoveredVulnerabilities: [] } }
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
    expect(screen.queryByRole('button', { name: 'Execute Rollback' })).not.toBeInTheDocument()
    expect(screen.getByText('No installed tool currently supports this weakness.')).toBeInTheDocument()
  })

  it('requires finite work, then presents accepted/reboot-required while active GateSSH stays unchanged', async () => {
    vi.useFakeTimers()
    render(<GameProvider initialState={srv02()}><Network /><StateSnapshot /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: `Open target 203.0.113.42` }))
    // Rollback grants only the narrow submission capability: finite work, no immediate consequence.
    fireEvent.click(screen.getByRole('button', { name: 'Execute Rollback' }))
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
    expect(managed.implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(currentState().world.network.hosts.find(({ id }) => id === 'host-lan-002')!.installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.3')
    expect(currentState().world.network.hosts.find(({ id }) => id === 'host-lan-002')!.pendingGateSshActivation).toMatchObject({ releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID })
    // The accepted package and its reboot requirement are RackUpdate's own
    // technical-context truth, not the whole target's headline: the target
    // status area never claims PACKAGE ACCEPTED / REBOOT REQUIRED itself.
    expect(screen.getByLabelText('Target status')).not.toHaveTextContent('PACKAGE ACCEPTED')
    expect(screen.getByLabelText('Target status')).not.toHaveTextContent('REBOOT REQUIRED')
    fireEvent.click(screen.getByText('TECHNICAL INTELLIGENCE'))
    expect(screen.getByText('PACKAGE SUBMISSION')).toBeInTheDocument()
    expect(screen.getByText('ACCEPTED')).toBeInTheDocument()
    expect(screen.getByText('REBOOT REQUIRED')).toBeInTheDocument()
    expect(currentState().deviceAccess.established).toEqual([])
    expect(currentState().remoteSession.active).toBeNull()
  })

  it('offers both older and newer compatible GateSSH candidates once submission is enabled, from Player Information alone', () => {
    const base = srv02()
    const newerPackage = { ...base.player.localDevice.filesystem.files.find(({ id }) => id === 'file-local-gate')!, id: 'file-local-newer', path: '/home/user/downloads/gatessh-1.4.0.pkg', releaseId: 'gate-ssh-1.4.0', version: '1.4.0' }
    const withCandidates: GameState = {
      ...base,
      rackUpdate: { access: { nextId: 2, established: [{ id: 'rack-update-access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-rack-update-002' }] }, submission: { nextId: 1, active: null, outcome: null } },
      player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { ...base.player.localDevice.filesystem, files: [...base.player.localDevice.filesystem.files, newerPackage] } } },
    }
    const target = selectTarget(withCandidates, 'host-lan-002')!
    expect(target.packageSubmission?.enabled).toBe(true)
    expect(target.packageSubmission?.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'file-local-gate', label: 'GateSSH 1.3.2' }),
      expect.objectContaining({ id: 'file-local-newer', label: 'GateSSH 1.4.0' }),
    ]))
  })

  it('describes a running submission from the canonical upload itself, never a stale one-shot notice', async () => {
    const base = srv02()
    const submitting: GameState = {
      ...base,
      rackUpdate: {
        access: { nextId: 2, established: [{ id: 'rack-update-access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-rack-update-002' }] },
        submission: { nextId: 2, outcome: null, active: {
          id: 'submission-0001', accessId: 'rack-update-access-0001', sourceDeviceId: base.player.localDevice.id, sourceFileId: 'file-local-gate',
          targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', bytesTotal: 6_400_000, bytesTransferred: 1_600_000,
        } },
      },
    }

    expect(selectTarget(submitting, 'host-lan-002')?.operation).toEqual({
      kind: 'package_submission',
      title: 'PACKAGE SUBMISSION',
      percent: 25,
      facts: [
        { label: 'PACKAGE', value: 'GateSSH 1.3.2' },
        { label: 'ENDPOINT', value: '203.0.113.42:8443' },
        { label: 'UPLOADED', value: '1.6 / 6.4 MB' },
      ],
    })

    // The running submission's own surface states that it is underway; the
    // one-shot notice from starting it must not linger once that surface owns it.
    const withCandidates: GameState = {
      ...base,
      rackUpdate: { access: { nextId: 2, established: [{ id: 'rack-update-access-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-002', viaServiceId: 'service-rack-update-002' }] }, submission: { nextId: 1, active: null, outcome: null } },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={withCandidates}><Network /></GameProvider>)
    await user.click(await screen.findByRole('button', { name: 'Open target 203.0.113.42' }))
    await user.click(screen.getByText('TECHNICAL INTELLIGENCE'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Rollback package' }), { target: { value: 'file-local-gate' } })
    fireEvent.click(screen.getByRole('button', { name: 'SUBMIT PACKAGE' }))

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Target status')).toHaveTextContent('PACKAGE SUBMISSION')
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

  it('opens the installed Flipper arsenal from NodeScan without moving execution out of target ACTIONS', async () => {
    const state = createInitialGameState()
    const withFlipper = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice,
      installedSoftware: [...state.player.localDevice.installedSoftware, FLIPPER_1_0_CANONICAL_INSTALLATION],
    } } }
    const openApp = vi.fn()
    render(<GameProvider initialState={withFlipper}><Network openApp={openApp} /></GameProvider>)
    await userEvent.setup().click(screen.getByRole('button', { name: 'FLIPPER ARSENAL' }))
    expect(openApp).toHaveBeenCalledWith('flipper')
  })

  it('issues an immediate observation with no presentation timer in front of it', async () => {
    // Real timers deliberately: a presentation timer in front of the canonical
    // operation would leave this assertion waiting on it, since nothing here
    // advances any clock.
    const actions = { ...actionStubs(), scanTarget: vi.fn(async () => ({ status: 'device' as const, targetId: SRV_01, address: SRV_01_ADDRESS, scope: 'lan' as const, networks: [], services: [] })) }
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue(actions)
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(foundTargets())

    const user = userEvent.setup()
    render(<Network />)
    await user.click(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: 'SCAN' }))

    expect(actions.scanTarget).toHaveBeenCalledTimes(1)
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
    const user = await openTarget({ ...offline, world: { network: { ...offline.world.network, hosts: offline.world.network.hosts.map((host) => host.id === SRV_01 ? { ...host, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } } : host) } } })
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

    // A Gateway's own public edge is portlessly reachable directly; the private backends behind it are not.
    await user.type(input, GATEWAY_ADDRESS)

    const entered = currentState()
    expect(entered.discovery).toEqual(before.discovery)
    expect(entered.knowledge).toEqual(before.knowledge)
    expect(entered.deviceAccess).toEqual(before.deviceAccess)
    expect(entered.remoteSession).toEqual(before.remoteSession)
    expect(screen.queryByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` })).not.toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()

    await user.click(within(form).getByRole('button', { name: 'Ping target address' }))

    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(currentState().discovery.devices).toContainEqual(expect.objectContaining({ id: 'router-foreign-001', address: GATEWAY_ADDRESS, scope: 'unknown' }))
    expect(currentState().discovery.networkDeviceRelations).toEqual([])
    expect(screen.getByRole('region', { name: 'Elsewhere' })).toHaveTextContent('Membership not observed')
    expect(screen.getByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` })).toBeInTheDocument()
  })

  it('does not present a Gateway\'s currently forwarded exposures as separate discovered Devices merely from its own portless Scan', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    await user.type(input, GATEWAY_ADDRESS)
    await user.click(screen.getByRole('button', { name: 'Ping target address' }))
    await user.click(await screen.findByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` }))
    await user.click(screen.getByRole('button', { name: 'SCAN' }))

    // The Scan legitimately remembers all four currently forwarded backends by stable identity, keyed
    // for later causal endpoint resolution, but every one of them is gateway-only tainted.
    const atGatewayAddress = currentState().discovery.devices.filter(({ address }) => address === GATEWAY_ADDRESS)
    expect(atGatewayAddress).toHaveLength(4)
    expect(atGatewayAddress.filter((device) => device.observedOnlyAsGatewayExposure)).toHaveLength(3)

    // Known Space still presents exactly one Device at this public address: the Gateway itself. No
    // "Open target 203.0.113.42" duplicate appears for any forwarded backend, and Elsewhere never grows
    // beyond the one Gateway entry the player actually observed.
    await user.click(screen.getByRole('button', { name: '← Known Space' }))
    expect(screen.getAllByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` })).toHaveLength(1)
    const elsewhere = screen.getByRole('region', { name: 'Elsewhere' })
    expect(within(elsewhere).getAllByRole('button', { name: /^Open target /i })).toHaveLength(1)
  })

  it('presents the same public Service surface the canonical Scan observed, whichever surface the player used', async () => {
    const scanned = { ...createInitialGameState(), discovery: gatewayScanned().discovery }
    const target = selectTarget(scanned, 'router-foreign-001')!

    // Exactly the five public endpoints the Terminal prints for this same observation.
    expect(target.services.map(({ name, endpoint, protocol }) => `${name} ${endpoint}/${protocol}`)).toEqual([
      `HTTP ${GATEWAY_ADDRESS}:80/TCP`,
      `SSH ${GATEWAY_ADDRESS}:22/TCP`,
      `RackUpdate ${GATEWAY_ADDRESS}:8443/TCP`,
      `SSH ${GATEWAY_ADDRESS}:2222/TCP`,
      `SSH ${GATEWAY_ADDRESS}:2223/TCP`,
    ])
    // Each row resolves against the Device that really answers that endpoint, so a later operation stays
    // causally correct — while nothing about those Devices is stated as observed evidence.
    expect(target.services.map(({ deviceId }) => deviceId)).toEqual(['router-foreign-001', SRV_02, SRV_02, 'host-phone-001', 'host-lan-003'])
    expect(target.services.every(({ observed, liveStatus, accessPrivilege }) => !observed && !liveStatus && !accessPrivilege)).toBe(true)
    expect(target.networks).toEqual([])
  })

  it('never states a forwarded backend Device, its private address, or its topology on the public edge card', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={gatewayScanned()}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` }))
    await openDetails(user)

    const card = screen.getByRole('region', { name: 'NodeScan' })
    for (const endpoint of [':80', ':22', ':8443', ':2222', ':2223']) {
      expect(within(card).getByText(`${GATEWAY_ADDRESS}${endpoint}`)).toBeInTheDocument()
    }
    const rendered = card.textContent ?? ''
    expect(rendered).not.toMatch(/10\.42\.0\.42|10\.42\.0\.43|10\.42\.0\.61|10\.42\.0\.1\b|10\.42\.0\.0\/24/)
    expect(rendered).not.toMatch(/srv-02|ops-01|Petra|Bookstore Backend/i)
    expect(rendered).not.toMatch(/8090|host-lan-002|host-lan-003|host-phone-001/)
    // The forwarded backends stay entirely absent from Known Space as Devices of their own: only the one
    // public edge the player actually observed is a Device here.
    expect(selectKnownSpace(gatewayScanned()).elsewhere.map(({ id }) => id)).toEqual(['router-foreign-001'])
  })

  it('resolves an ANALYZE taken on a forwarded public endpoint against the backend that actually answers it', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={gatewayScanned()}><Network /><StateSnapshot /></GameProvider>)
    await user.click(screen.getByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` }))
    await openDetails(user)
    await user.click(screen.getByRole('button', { name: `Analyze SSH at ${GATEWAY_ADDRESS}:2222` }))

    // The phone's own stable identity, reached through the represented exposure, at the endpoint the
    // player actually dialed — never the Gateway's identity and never the phone's private address.
    expect(currentState().process.processes).toEqual([expect.objectContaining({
      kind: 'service_analysis', targetDeviceId: 'host-phone-001', serviceId: 'service-ssh-003', startedEndpoint: `${GATEWAY_ADDRESS}:2222`,
    })])
  })

  it('moves a forwarded endpoint onto its own target once a directed Analysis legitimately discovers that Device', () => {
    const analysis = startServiceAnalysis(gatewayScanned(), 'host-phone-001', 'service-ssh-003', `${GATEWAY_ADDRESS}:2222`)
    if (analysis.status !== 'started') throw new Error(analysis.status)
    const analyzed = advanceGameState(analysis.state, 20_000)

    // The public edge keeps forwarding what it forwards, but this endpoint is no longer known *only*
    // as its forward: it now belongs to the Device the player legitimately investigated.
    expect(selectTarget(analyzed, 'router-foreign-001')!.services.map(({ endpoint }) => endpoint))
      .toEqual([`${GATEWAY_ADDRESS}:80`, `${GATEWAY_ADDRESS}:22`, `${GATEWAY_ADDRESS}:8443`, `${GATEWAY_ADDRESS}:2223`])
    const phone = selectTarget(analyzed, 'host-phone-001')!
    expect(phone.address).toBe(GATEWAY_ADDRESS)
    expect(phone.services.map(({ endpoint, deviceId }) => [endpoint, deviceId])).toEqual([[`${GATEWAY_ADDRESS}:2222`, 'host-phone-001']])
  })

  it('refreshes the Gateway target card on rescan once a forwarded exposure disappears, dropping only what World Truth no longer forwards', () => {
    const scanned = gatewayScanned()
    expect(selectTarget(scanned, 'router-foreign-001')!.services.map(({ endpoint }) => endpoint))
      .toEqual([`${GATEWAY_ADDRESS}:80`, `${GATEWAY_ADDRESS}:22`, `${GATEWAY_ADDRESS}:8443`, `${GATEWAY_ADDRESS}:2222`, `${GATEWAY_ADDRESS}:2223`])

    // srv-02's RackUpdate exposure is withdrawn in World Truth; a second legitimate Scan observes that.
    const rackUpdateGone = { ...scanned, world: { ...scanned.world, network: { ...scanned.world.network, hosts: scanned.world.network.hosts.map((host) => host.id === 'router-foreign-001'
      ? { ...host, exposures: host.exposures!.filter((exposure) => exposure.targetServiceId !== 'service-rack-update-002') }
      : host) } } }
    const rescanned = gatewayScanned(rackUpdateGone)

    // The vanished exposure drops; srv-02's own still-current GateSSH exposure remains right where it was.
    expect(selectTarget(rescanned, 'router-foreign-001')!.services.map(({ endpoint }) => endpoint))
      .toEqual([`${GATEWAY_ADDRESS}:80`, `${GATEWAY_ADDRESS}:22`, `${GATEWAY_ADDRESS}:2222`, `${GATEWAY_ADDRESS}:2223`])
    // No stale RackUpdate identity leaks anywhere in the rendered result.
    expect(JSON.stringify(selectTarget(rescanned, 'router-foreign-001'))).not.toContain('rack-update')
  })

  it('removes a gateway-exposure-only Device from Known Space entirely once its one exposure disappears and the Gateway is rescanned', () => {
    const scanned = gatewayScanned()
    expect(scanned.discovery.devices.some(({ id }) => id === 'host-phone-001')).toBe(true)

    const phoneGone = { ...scanned, world: { ...scanned.world, network: { ...scanned.world.network, hosts: scanned.world.network.hosts.map((host) => host.id === 'router-foreign-001'
      ? { ...host, exposures: host.exposures!.filter((exposure) => exposure.targetServiceId !== 'service-ssh-003') }
      : host) } } }
    const rescanned = gatewayScanned(phoneGone)

    expect(rescanned.discovery.devices.some(({ id }) => id === 'host-phone-001')).toBe(false)
    expect(selectTarget(rescanned, 'host-phone-001')).toBeUndefined()
    expect(selectKnownSpace(rescanned).elsewhere.map(({ id }) => id)).toEqual(['router-foreign-001'])
    expect(selectTarget(rescanned, 'router-foreign-001')!.services.map(({ endpoint }) => endpoint))
      .toEqual([`${GATEWAY_ADDRESS}:80`, `${GATEWAY_ADDRESS}:22`, `${GATEWAY_ADDRESS}:8443`, `${GATEWAY_ADDRESS}:2223`])
  })

  it('marks only the Device just observed as arriving, deriving nothing new and remembering nothing extra', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={foundTargets()}><Network /></GameProvider>)
    // Already remembered when Known Space first rendered: no arrival treatment.
    expect(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).not.toHaveClass('ns-node--arrived')

    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    await user.type(input, GATEWAY_ADDRESS)
    await user.click(screen.getByRole('button', { name: 'Ping target address' }))

    expect(await screen.findByRole('button', { name: `Open target ${GATEWAY_ADDRESS}` })).toHaveClass('ns-node--arrived')
    expect(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).not.toHaveClass('ns-node--arrived')
  })

  it('keeps a Pinged foreign Gateway ungrouped, and regroups it plus its peers only through Network Scan', () => {
    const state = createInitialGameState()
    const targets = { localDevice: state.player.localDevice, network: state.world.network }
    // The Gateway's own public edge is the one foreign Device directly PINGable from home; a Network
    // Scan of its private segment (here a test fixture, not a route the shipped game offers) is what
    // regroups its peers.
    const pinged = rememberPing(state.discovery, pingNetworkTarget(targets, GATEWAY_ADDRESS), state.player.localDevice.id)
    const before = { ...state, discovery: pinged }
    expect(selectKnownSpace(before).elsewhere.map(({ id }) => id)).toContain('router-foreign-001')
    // Ping is optional reachability evidence only: it never remembers Network membership.
    expect(pinged.networks).toEqual([])
    expect(pinged.devices.some(({ id }) => id === 'host-phone-001')).toBe(false)

    const scanned = rememberScan(pinged, scanFromDevice(withSrv02NodeScan(state), SRV_02, 'remote-segment-01'), SRV_02)
    const after = { ...state, discovery: scanned }
    const foreign = selectKnownSpace(after).networks.find(({ id }) => id === 'network-foreign-001')!
    expect(foreign.name).toBe('remote-segment-01')
    expect(foreign.targets.map(({ id }) => id)).toContain('router-foreign-001')
    expect(selectKnownSpace(after).elsewhere.some(({ id }) => id === 'router-foreign-001')).toBe(false)
    expect(scanned.devices.some(({ id }) => id === 'host-phone-001')).toBe(true)
  })

  it('rejects malformed direct input locally without observing or mutating canonical state', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const input = screen.getByRole('textbox', { name: 'TARGET ADDRESS' })
    const before = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)

    await user.type(input, '198.51.100.999')
    await user.click(within(input.closest('form')!).getByRole('button', { name: 'Ping target address' }))

    expect(screen.getByRole('status')).toHaveTextContent('INVALID ADDRESS')
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)).toEqual(before)
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
    expect(space.networks[0].gateway?.address).toBe('198.51.100.1')
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
    // on this Network are the branch itself, its administration route, and
    // its remembered targets — each a single leaf button, not an expandable
    // level of its own.
    expect(within(network).getAllByRole('button').map((control) => control.getAttribute('aria-label')))
      .toEqual(['Collapse network home-net', 'Manage network home-net', 'Scan network home-net', `Open target ${SRV_01_ADDRESS}`, 'Open target 198.51.100.1', 'Scan gateway 198.51.100.1'])
  })

  it('regroups a scanned remote Device out of Elsewhere into its owned Network, shown without a name it has not separately earned', () => {
    const observed = createInitialGameState()
    // A Device Scan sourced from an operated srv-02 (a test fixture here, not a route the shipped game
    // offers) reveals a peer's own Network context, exactly like a Scan from home would for an ordinary
    // reachable Device.
    const discovery = rememberScan(foundTargets(observed).discovery, scanFromDevice(withSrv02NodeScan(observed), SRV_02, PHONE_ADDRESS), SRV_02)
    render(<GameProvider initialState={{ ...observed, discovery }}><Network /></GameProvider>)

    const home = screen.getByRole('region', { name: 'Network home-net' })
    expect(within(home).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toBeInTheDocument()
    expect(within(home).queryByRole('button', { name: `Open target ${PHONE_ADDRESS}` })).not.toBeInTheDocument()

    expect(screen.queryByRole('region', { name: 'Elsewhere' })).not.toBeInTheDocument()
    const foreign = screen.getByRole('region', { name: 'Network UNKNOWN NETWORK 10.42.0.0/24' })
    expect(within(foreign).getByRole('button', { name: `Open target ${PHONE_ADDRESS}` })).toBeInTheDocument()
    // Host Scan does not enumerate peers; it exposes only the Gateway clue.
    expect(within(foreign).queryByRole('button', { name: 'Open target 10.42.0.43' })).not.toBeInTheDocument()
    expect(within(foreign).getByRole('button', { name: `Scan gateway 10.42.0.1` })).toBeInTheDocument()
  })

  it('keeps Gateway in the same sibling branch, and neither browsing nor a Scan sourced from home can earn this private Network a name', async () => {
    const base = createInitialGameState()
    const discovery = rememberScan(base.discovery, scanFromDevice(withSrv02NodeScan(base), SRV_02, PHONE_ADDRESS), SRV_02)
    const user = userEvent.setup()
    render(<GameProvider initialState={{ ...base, discovery }}><Network /><StateSnapshot /></GameProvider>)
    const root = screen.getByRole('region', { name: 'Network UNKNOWN NETWORK 10.42.0.0/24' })
    const host = within(root).getByRole('button', { name: `Open target ${PHONE_ADDRESS}` })
    const gateway = within(root).getByRole('button', { name: `Open target 10.42.0.1` })
    expect(gateway.closest('.ns-limb')?.parentElement).toBe(host.closest('.ns-limb')?.parentElement)
    expect(gateway).toHaveTextContent('UNKNOWN DEVICE')
    expect(gateway).toHaveTextContent('GATEWAY')
    expect(gateway).not.toHaveTextContent('NETWORK DEVICE')
    const before = currentState().discovery
    await user.click(within(root).getByRole('button', { name: 'Browse network UNKNOWN NETWORK 10.42.0.0/24' }))
    await user.click(within(root).getByRole('button', { name: 'Browse network UNKNOWN NETWORK 10.42.0.0/24' }))
    expect(currentState().discovery).toEqual(before)
    expect(root).not.toHaveTextContent('remote-segment-01')
    await user.click(within(root).getByRole('button', { name: 'Scan network UNKNOWN NETWORK 10.42.0.0/24' }))
    // Home holds no membership in this private segment: even a remembered CIDR never admits a Scan that reaches it.
    expect(root).not.toHaveTextContent('remote-segment-01')
  })

  it('reveals the Gateway\'s own internal LAN position as its clue, never its public edge, and a plain Known Space Scan of it (always SELF-sourced) gets no response', async () => {
    const base = createInitialGameState()
    // Sourced from an operated srv-02 (a test fixture, not a route the shipped game offers), on the same
    // private LAN as the phone: the represented Gateway clue this reveals is the internal position srv-02
    // itself sees, `10.42.0.1` — never the externally reconnaissable public edge, a distinct, independent
    // fact this Scan never observes.
    const discovery = rememberScan(base.discovery, scanFromDevice(withSrv02NodeScan(base), SRV_02, PHONE_ADDRESS), SRV_02)
    const gatewayInternalAddress = '10.42.0.1'
    const user = userEvent.setup()
    render(<GameProvider initialState={{ ...base, discovery }}><Network /><StateSnapshot /></GameProvider>)

    // Known Space's own Scan action always sources from SELF; SELF has no represented route to the
    // Gateway's internal LAN address at all, so this correctly gets no response.
    await user.click(screen.getByRole('button', { name: `Scan gateway ${gatewayInternalAddress}` }))

    expect(currentState().discovery.devices.find(({ id }) => id === 'router-foreign-001')).toMatchObject({
      address: gatewayInternalAddress, servicesObserved: false,
    })
    expect(currentState().discovery.networks.find(({ id }) => id === 'network-foreign-001')?.membersObserved).toBe(false)
    expect(currentState().discovery.devices.some(({ id }) => id === 'host-lan-003')).toBe(false)
  })

  it('never reaches a Device with genuinely no represented Network membership, and reveals nothing about it', () => {
    const base = createInitialGameState()
    const unrelatedHost = { id: 'host-unrelated', ip: '192.0.2.77', operational: { lifecycle: 'RUNNING' as const, connectivity: 'CONNECTED' as const } }
    const observed = { ...base, world: { network: { ...base.world.network, hosts: [...base.world.network.hosts, unrelatedHost] } } }
    const targets = { localDevice: observed.player.localDevice, network: observed.world.network }
    // A Device with no represented Network placement at all is never globally reachable merely because
    // placement truth is absent: it fails closed exactly like any other missing membership, so Scan
    // observes nothing and it never enters Discovery or Known Space at all.
    expect(scanNetworkTarget(targets, '192.0.2.77')).toEqual({ status: 'no_response', address: '192.0.2.77' })
    const discovery = rememberScan(foundTargets(observed).discovery, scanNetworkTarget(targets, '192.0.2.77'), observed.player.localDevice.id)
    render(<GameProvider initialState={{ ...observed, discovery }}><Network /></GameProvider>)

    const home = screen.getByRole('region', { name: 'Network home-net' })
    expect(within(home).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toBeInTheDocument()
    expect(within(home).queryByRole('button', { name: 'Open target 192.0.2.77' })).not.toBeInTheDocument()

    expect(screen.queryByRole('region', { name: 'Elsewhere' })).not.toBeInTheDocument()
  })

  it('opens the same simple target card straight from the topology', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={knownWeakness()}><Network /></GameProvider>)
    await user.click(within(screen.getByRole('region', { name: 'Network home-net' })).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` }))

    // One tap, straight to the decision: no Network page and no Device page between.
    expect(screen.getByRole('region', { name: 'ACTIONS' })).toHaveTextContent('Credential Access')
    expect(screen.getByRole('button', { name: 'Execute Credential Access with GhostKey 1.0' })).toBeInTheDocument()
  })

  it('observes nothing by presenting topology', async () => {
    const known = withAccess()
    scanTargetSpy.mockClear()
    render(<GameProvider initialState={known}><Network /><StateSnapshot /></GameProvider>)
    const before = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)

    expect(screen.getByRole('region', { name: 'Network home-net' })).toBeInTheDocument()
    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)).toEqual(before)
  })

  it('expands home-net from a SELF Scan with a Gateway clue but no peer enumeration', () => {
    const observed = createInitialGameState()
    const targets = { localDevice: observed.player.localDevice, network: observed.world.network }
    // SELF scanned: SELF's own Network relationship, and its one other member, are both legitimately revealed —
    // using the same Host Scan semantics as any other Host, never a SELF-only Recon path.
    const discovery = rememberScan(observed.discovery, scanNetworkTarget(targets, observed.player.localDevice.network.ip), observed.player.localDevice.id)
    render(<GameProvider initialState={{ ...observed, discovery }}><Network /></GameProvider>)

    const network = screen.getByRole('region', { name: 'Network home-net' })
    expect(network).toHaveTextContent('Members not observed')
    expect(network).toHaveTextContent('SELF')
    expect(within(network).queryByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).not.toBeInTheDocument()
    expect(within(network).getAllByRole('button').map((control) => control.getAttribute('aria-label')))
      .toEqual(['Collapse network home-net', 'Manage network home-net', 'Scan network home-net', 'Open target 198.51.100.1', 'Scan gateway 198.51.100.1'])
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

    expect(currentState().knowledge.discoveredVulnerabilities).toEqual([])
    expect(screen.getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toHaveTextContent('ACTIONS AVAILABLE')
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

/* ---------------------------------------------- known space as one tree */

describe('Known Space hierarchy', () => {
  it('presents Network → Device, with the Device as a leaf that routes directly into its target card', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={scannedTarget()}><Network /></GameProvider>)
    const network = screen.getByRole('region', { name: 'Network home-net' })

    // The Network root is open; the Device beneath it is a leaf, not another
    // expandable level. Its remembered Services live on the target card, not
    // in the tree.
    expect(within(network).getByRole('button', { name: 'Collapse network home-net' })).toHaveAttribute('aria-expanded', 'true')
    const device = within(network).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })
    expect(device).not.toHaveAttribute('aria-expanded')
    expect(network).toHaveTextContent(SRV_01_ADDRESS)
    expect(within(network).queryByText('SSH')).not.toBeInTheDocument()
    expect(screen.queryByLabelText(`Remembered services for ${SRV_01_ADDRESS}`)).not.toBeInTheDocument()

    await user.click(within(network).getByRole('button', { name: 'Collapse network home-net' }))
    expect(screen.queryByText(SRV_01_ADDRESS)).not.toBeInTheDocument()
  })

  it('never offers a Device-level expand control, whether or not Services were ever observed', () => {
    render(<GameProvider initialState={foundTargets()}><Network /></GameProvider>)
    const network = screen.getByRole('region', { name: 'Network home-net' })
    expect(within(network).getByRole('button', { name: `Open target ${SRV_01_ADDRESS}` })).toHaveTextContent('NOT SCANNED')
    expect(within(network).queryByRole('button', { name: `Expand device ${SRV_01_ADDRESS}` })).not.toBeInTheDocument()

    cleanup()
    render(<GameProvider initialState={scannedTarget()}><Network /></GameProvider>)
    const scanned = screen.getByRole('region', { name: 'Network home-net' })
    expect(within(scanned).queryByRole('button', { name: `Expand device ${SRV_01_ADDRESS}` })).not.toBeInTheDocument()
  })

  it('observes nothing and remembers nothing by expanding or collapsing a Network', async () => {
    const user = userEvent.setup()
    const known = scannedTarget()
    scanTargetSpy.mockClear()
    render(<GameProvider initialState={known}><Network /><StateSnapshot /></GameProvider>)
    const before = withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)

    await user.click(screen.getByRole('button', { name: 'Collapse network home-net' }))
    await user.click(screen.getByRole('button', { name: 'Expand network home-net' }))

    expect(scanTargetSpy).not.toHaveBeenCalled()
    expect(withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState)).toEqual(before)
  })
})

/* --------------------------------------- managed networks inside NodeScan */

describe('Network administration inside NodeScan', () => {
  it('roots the managed home-net in Known Space from authority alone, before reconnaissance remembers anything', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /><StateSnapshot /></GameProvider>)
    const network = screen.getByRole('region', { name: 'Network home-net' })

    // Authority states the Network exists and what it is; it observes nothing
    // on it, so membership is honestly unobserved and SELF still needs a Scan.
    expect(network).toHaveTextContent('Members not observed')
    expect(screen.getByRole('button', { name: 'SCAN SELF' })).toBeInTheDocument()
    expect(screen.queryByText('srv-01')).not.toBeInTheDocument()
    expect(screen.queryByText(SRV_01_ADDRESS)).not.toBeInTheDocument()

    await user.click(within(network).getByRole('button', { name: 'Manage network home-net' }))
    expect(screen.getByText('MANAGED NETWORK')).toBeInTheDocument()
    expect(screen.getByText('MEMBERS').parentElement).toHaveTextContent('3')
    expect(screen.getAllByText('16 MiB/s')).toHaveLength(2)
    expect(screen.getByText('NO ACTIVITY')).toBeInTheDocument()
    // Opening administration is not observation.
    expect(currentState().discovery).toEqual(createInitialGameState().discovery)
  })

  it('never enumerates member Device identity from management authority', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={createInitialGameState()}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Manage network home-net' }))

    const detail = screen.getByLabelText('NodeScan')
    for (const hidden of ['srv-01', SRV_01_ADDRESS, 'host-lan-001', 'RACK-OS', 'SSH']) {
      expect(detail.textContent, `${hidden} must not reach managed-Network administration`).not.toContain(hidden)
    }
  })

  it('gives a discovered foreign Network no administration route, because Discovery is not authority', () => {
    const base = createInitialGameState()
    // The phone's foreign Network becomes remembered only through a legitimate Network Scan, here sourced
    // from an operated srv-02 test fixture (not a route the shipped game offers).
    const discovery = rememberScan(base.discovery, scanFromDevice(withSrv02NodeScan(base), SRV_02, 'remote-segment-01'), SRV_02)
    render(<GameProvider initialState={{ ...base, discovery }}><Network /></GameProvider>)

    const foreign = screen.getByRole('region', { name: 'Network remote-segment-01' })
    expect(within(foreign).getByRole('button', { name: 'Browse network remote-segment-01' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(foreign).queryByRole('button', { name: 'Manage network remote-segment-01' })).not.toBeInTheDocument()
    // The one Network the local Device actually administers still has its route.
    expect(screen.getByRole('button', { name: 'Manage network home-net' })).toBeInTheDocument()
  })

  it('offers no administration route at all once the authority relationship is removed', () => {
    const base = foundTargets()
    render(<GameProvider initialState={{ ...base, networkManagement: { ...base.networkManagement, established: [] } }}><Network /></GameProvider>)
    const network = screen.getByRole('region', { name: 'Network home-net' })

    // home-net is still remembered by reconnaissance and SELF still belongs to
    // it; neither is authority over it.
    expect(network).toHaveTextContent('home-net')
    expect(within(network).queryByRole('button', { name: 'Manage network home-net' })).not.toBeInTheDocument()
    expect(within(network).getByRole('button', { name: 'Browse network home-net' })).toHaveAttribute('aria-expanded', 'true')
  })
})

/* ------------------------------------------ progressive target identity */

describe('observed Device display identity', () => {
  it('presents a scanned but uninspected Device as an unknown Device at its address', async () => {
    const user = await openTarget(scannedTarget())

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(SRV_01_ADDRESS)
    expect(screen.getByText('UNKNOWN DEVICE')).toBeInTheDocument()
    expect(screen.queryByText('srv-01')).not.toBeInTheDocument()

    await openDetails(user)
    expect(screen.queryByText('NAME')).not.toBeInTheDocument()
  })

  it('never remembers a display name from Scan or PING alone', () => {
    const scanned = scannedTarget()
    expect(scanned.discovery.devices.find(({ id }) => id === SRV_01)?.inspect).toBeUndefined()
    expect(selectTarget(scanned, SRV_01)?.displayName).toBeUndefined()
    expect(JSON.stringify(selectKnownSpace(scanned))).not.toContain('srv-01')
  })

  it('does not expose the retired generic Inspect affordance under any NodeScan release', async () => {
    await openTarget(withNodeScan11(scannedTarget()))
    expect(screen.queryByRole('button', { name: 'INSPECT' })).not.toBeInTheDocument()
    expect(screen.queryByText('INSPECT AVAILABLE')).not.toBeInTheDocument()
  })})

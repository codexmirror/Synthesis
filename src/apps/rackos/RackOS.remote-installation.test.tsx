import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { connectRemoteFromObservation } from '../../core/game/remoteSession'
import { installRemoteSoftwarePackage } from '../../core/game/softwareInstallation'
import { createInitialGameState } from '../../core/game/initialState'
import { RACK_OS_1_1_BUSINESS_FIRMWARE_ID, RACK_OS_FIRMWARE_ID } from '../../core/game/firmwareIdentity'
import { RACK_OS_1_1_BUSINESS_RELEASE, RACK_OS_FIRMWARE_UPDATE_DURATION_MS } from '../../core/game/rackOsFirmwareUpdate'
import { Shell } from '../../shell/Shell'
import type { ExecutableFile, GameProcess, GameState, NetworkHost, NodeMinerProcess } from '../../core/game/types'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import { Terminal } from '../terminal/Terminal'
import { withoutBookstoreBackgroundTiming } from '../../test/canonicalSnapshot'
import rackSource from './RackOS.tsx?raw'
import rackUpdateSource from './RackFirmwareUpdate.tsx?raw'
import rackCss from './rackos.css?raw'
import { executeBookstoreSale } from '../../core/game/bookstoreSale'
import { BOOKSTORE_BRANCH_ID } from '../../core/game/business'
import { BOOKSTORE_ATLAS_MIXED_SHELF_REFILL_OFFER_ID, placeBookstoreRestockOrder, proposeBookstoreRestockOrder } from '../../core/game/bookstoreRestock'

function StateSnapshot() { return <output data-testid="game-state">{JSON.stringify(useGameState())}</output> }

function discoveredAccessState(): GameState {
  const state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, state.player.localDevice.network.ip), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, 'home-net'), state.player.localDevice.id)
  discovery = rememberScan(discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  return { ...state, discovery, deviceAccess: { nextId: 2, established: [{ id: 'access-roundtrip', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

function connectedState(): GameState {
  const base = createInitialGameState()
  const host = base.world.network.hosts[0]
  const altered = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, displayName: 'live-server', ip: '192.0.2.99', firmware: { id: RACK_OS_FIRMWARE_ID, name: 'STATE-OS', version: '7.4' }, filesystem: { nextFileId: 50, files: [{ kind: 'text' as const, id: 'file-fixture-text', path: '/srv/proof.txt', content: 'Foreign canonical proof.' }] } }, ...base.world.network.hosts.slice(1)] } }, deviceAccess: { nextId: 2, established: [{ id: 'access-test', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-http-001', privilege: 'USER' as const }] } }
  const connected = connectRemoteFromObservation(altered, { targetDeviceId: host.id, address: '192.0.2.99' }).state
  return { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '198.51.100.47' } } }
}

/** `connectedState` plus a represented remote `/home/user` directory, so the
 *  remote-first Upload workflow can start from a non-root remote directory. */
function connectedStateWithRemoteHome(): GameState {
  const base = connectedState()
  const host = base.world.network.hosts[0]
  const files = [...host.filesystem!.files, { kind: 'text' as const, id: 'file-fixture-remote-home', path: '/home/user/notes.txt', content: 'Remote workspace notes.' }]
  return { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, filesystem: { nextFileId: 60, files } }, ...base.world.network.hosts.slice(1)] } } }
}

async function enterRemote(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /^ENTER .+ →$/ }))
}

afterEach(() => vi.useRealTimers())

describe('RACK-OS remote software installation', () => {
  const REMOTE_PACKAGE = '/opt/packages/packet-viewer-1.0.pkg'

  const ordinaryPackage = { kind: 'software_package' as const, id: 'file-remote-ordinary', path: REMOTE_PACKAGE, productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard', publisher: 'test-publisher', sizeBytes: 2_048 }

  function withOrdinaryOnSrv01(state: GameState): GameState {
    return { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, ordinaryPackage] } } : host) } } }
  }

  /** srv-01 exactly as the world represents it, with an authorized Session already open. */
  function operatingState(alterHost?: (host: NetworkHost) => NetworkHost): GameState {
    const base = withOrdinaryOnSrv01(createInitialGameState())
    const host = alterHost ? alterHost(base.world.network.hosts[0]) : base.world.network.hosts[0]
    const authorized: GameState = {
      ...base,
      deviceAccess: { nextId: 2, established: [{ id: 'access-remote-install', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
      world: { ...base.world, network: { ...base.world.network, hosts: [host, ...base.world.network.hosts.slice(1)] } },
    }
    return connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address: host.ip }).state
  }

  async function openRemotePackage(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE packet-viewer-1.0.pkg' }))
  }

  function snapshot(): GameState { return withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState) }

  it('presents the concrete package and its state on this Device, with local transfer kept secondary', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('SOFTWARE PACKAGE')
    expect(screen.getByRole('heading', { name: 'Packet Viewer' })).toBeInTheDocument()
    expect(rackOs).toHaveTextContent('1.0 Standard')
    // Truthful represented artifact size, from the same canonical filesystem semantics local Files uses.
    expect(rackOs).toHaveTextContent('2 KB')
    expect(rackOs).toHaveTextContent('packet-viewer-1.0')
    expect(rackOs).toHaveTextContent('INSTALLABLE')
    expect(rackOs).toHaveTextContent('NOT INSTALLED')
    // Download still works, but the artifact's relationship to node-01 now follows the Device's own software state.
    expect(rackOs).toHaveTextContent('TRANSFER')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeEnabled()
    const order = rackOs.textContent ?? ''
    expect(order.indexOf('INSTALLABLE')).toBeLessThan(order.indexOf('TRANSFER'))
  })

  it('keeps NodeScan visibly NODE-OS-only with no INSTALL action', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE nodescan-exp-1.1.pkg' }))
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('STATUSNOT COMPATIBLE')
    expect(rackOs).toHaveTextContent('REQUIRESNODE-OS')
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
    expect(installRemoteSoftwarePackage(snapshot(), '/opt/packages/nodescan-exp-1.1.pkg')).toMatchObject({ status: 'incompatible_firmware' })
  })

  it('shows seeded GateSSH as installed and another GateSSH release as installable with real CURRENT state', async () => {
    const newer = { kind: 'software_package' as const, id: 'gate-ui-new', path: '/opt/packages/gatessh-1.3.3.pkg', productId: 'gate-ssh', releaseId: 'gate-ssh-1.3.3', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.3.3', sizeBytes: 6_400_000 }
    const user = userEvent.setup()
    const { unmount } = render(<GameProvider initialState={operatingState()}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR opt' })); await user.click(screen.getByRole('button', { name: 'DIR packages' })); await user.click(screen.getByRole('button', { name: 'FILE gatessh-1.3.2.pkg' }))
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('CURRENTGateSSH 1.3.2 Stable')
    unmount()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, filesystem: { ...host.filesystem!, files: [...host.filesystem!.files, newer] } }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' })); await user.click(screen.getByRole('button', { name: 'DIR opt' })); await user.click(screen.getByRole('button', { name: 'DIR packages' })); await user.click(screen.getByRole('button', { name: 'FILE gatessh-1.3.3.pkg' }))
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('STATUSINSTALLABLE')
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('CURRENTGateSSH 1.3.2 Stable')
  })

  it('states the publisher a package actually claims', async () => {
    const publisherPackage = { kind: 'software_package' as const, id: 'file-remote-publisher', path: '/opt/packages/node-miner-1.0.pkg', productId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev', sizeBytes: 3_400_000 }
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, filesystem: { nextFileId: 90, files: [...host.filesystem!.files, publisherPackage] } }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE node-miner-1.0.pkg' }))
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('PUBLISHERnm-dev')
  })

  it('derives installed state from the target Device, not from the local inventory', async () => {
    const user = userEvent.setup()
    // node-01 runs NodeScan 1.0 Standard; srv-01 runs the very release this package represents.
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: [...host.installedSoftware!, { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard' }] }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('states another installed release of the same product as CURRENT while the package stays installable', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: [...host.installedSoftware!, { id: 'packet-viewer', releaseId: 'packet-viewer-0.9', buildId: 'build-packet-viewer-0.9', name: 'Packet Viewer', version: '0.9' }] }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('CURRENTPacket Viewer 0.9')
    expect(rackOs).toHaveTextContent('INSTALLABLE')
    expect(screen.getByRole('button', { name: 'INSTALL' })).toBeEnabled()
  })

  it('does not claim INSTALLABLE on a target that represents no software inventory', async () => {
    const user = userEvent.setup()
    // Otherwise fully operable: `installedSoftware: undefined` means this Device
    // represents no installable software state, which is not the same truth as an
    // inventory that happens to be empty.
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: undefined }))}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('STATUSNOT INSTALLABLE')
    expect(rackOs).toHaveTextContent('TARGET CANNOT INSTALL SOFTWARE')
    // No installed release exists to state, so no CURRENT row is invented.
    expect(rackOs).not.toHaveTextContent('CURRENT')
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
    // The canonical operation agrees, so the surface never disagreed with admission.
    expect(installRemoteSoftwarePackage(snapshot(), REMOTE_PACKAGE)).toMatchObject({ status: 'target_not_installable' })
    // The artifact's own facts and its transfer relationship remain truthful.
    expect(rackOs).toHaveTextContent('2 KB')
    expect(screen.getByRole('button', { name: 'DOWNLOAD' })).toBeEnabled()
  })

  it('offers no installation from an unrecognized package path', async () => {
    const unrecognized = { kind: 'software_package' as const, id: 'file-remote-unrecognized', path: '/opt/packages/packet-viewer-1.0.pkd', productId: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard', sizeBytes: 2_048 }
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, filesystem: { nextFileId: 90, files: [...host.filesystem!.files, unrecognized] } }))}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR opt' }))
    await user.click(screen.getByRole('button', { name: 'DIR packages' }))
    await user.click(screen.getByRole('button', { name: 'FILE packet-viewer-1.0.pkd' }))
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('UNRECOGNIZED')
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
  })

  it('opens and cancels the inline confirmation without touching GameState', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    const before = snapshot()

    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    // The confirmation names the Device being operated and the exact remote package path.
    expect(rackOs).toHaveTextContent('INSTALL ON THIS DEVICE')
    expect(rackOs).toHaveTextContent('TARGETsrv-01')
    expect(rackOs).toHaveTextContent(`PACKAGE${REMOTE_PACKAGE}`)
    expect(rackOs).toHaveTextContent('CURRENTNOT INSTALLED')
    // It is presentation state only: no Process, no installed software, nothing.
    expect(snapshot()).toEqual(before)

    await user.click(screen.getByRole('button', { name: 'CANCEL' }))
    expect(rackOs).not.toHaveTextContent('INSTALL ON THIS DEVICE')
    expect(screen.getByRole('button', { name: 'INSTALL' })).toBeEnabled()
    expect(snapshot()).toEqual(before)
  })

  it('admits Device-owned work through the canonical operation and derives INSTALLING without remote telemetry', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemotePackage(user)
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))

    const admitted = snapshot()
    expect(admitted.process.processes).toEqual([expect.objectContaining({
      kind: 'software_installation', status: 'running', executorDeviceId: 'host-lan-001',
      productId: 'packet-viewer', releaseId: 'packet-viewer-1.0',
    })])
    // The Device that will own the software has not received it yet.
    expect(admitted.world.network.hosts[0].installedSoftware).toEqual([expect.objectContaining({ id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2' })])
    expect(admitted.player.localDevice.installedSoftware.find(({ id }) => id === 'nodescan')?.releaseId).toBe('nodescan-1.0-standard')

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(screen.getByRole('button', { name: 'INSTALLING…' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'INSTALL' })).not.toBeInTheDocument()
    expect(rackOs).not.toHaveTextContent('INSTALL ON THIS DEVICE')
    // No remote progress, resource or cancellation surface: this slice observes existence of the work only.
    expect(rackOs.querySelector('progress')).toBeNull()
    expect(rackOs.textContent).not.toMatch(/%|MiB|CPU|RAM/)
    expect(screen.queryByRole('button', { name: 'CANCEL' })).not.toBeInTheDocument()

    // srv-01 owns 160 compute at 12% baseline: 600 work completes in about 4.3 s of its own runtime.
    await act(async () => { vi.advanceTimersByTime(6_000) })
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    const done = snapshot()
    expect(done.world.network.hosts[0].installedSoftware).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'packet-viewer', releaseId: 'packet-viewer-1.0' })]))
    expect(done.player.localDevice.installedSoftware.find(({ id }) => id === 'nodescan')?.releaseId).toBe('nodescan-1.0-standard')
    expect(done.world.network.hosts[0].filesystem!.files.some((file) => file.kind === 'executable')).toBe(false)
    expect(done.recentActivity.entries).toEqual([])
    expect(done.process.processes).toEqual([])
  })

  it('keeps installation running through DISCONNECT and derives current truth on a later Session', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<GameProvider initialState={withOrdinaryOnSrv01(discoveredAccessState())}><Shell /><StateSnapshot /></GameProvider>)

    /* DISCONNECT restores the preserved NodeScan Device context, so the second
       Session is established from the page the player was already on. */
    async function connectAndEnter() {
      const launcher = screen.queryByRole('button', { name: 'Open NodeScan' })
      if (launcher) {
        await user.click(launcher)
        await user.click(screen.getByRole('button', { name: 'Open target 198.51.100.47' }))
      }
      await user.click(screen.getByRole('button', { name: /CONNECT/ }))
      await enterRemote(user)
    }

    await connectAndEnter()
    await openRemotePackage(user)
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    await user.click(screen.getByRole('button', { name: 'INSTALL' }))
    expect(screen.getByRole('button', { name: 'INSTALLING…' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'DISCONNECT' }))
    expect(screen.queryByLabelText('RACK-OS remote operating environment')).not.toBeInTheDocument()
    const disconnected = snapshot()
    expect(disconnected.remoteSession.active).toBeNull()
    // Observation ended; the Device's own work did not.
    expect(disconnected.process.processes).toEqual([expect.objectContaining({ status: 'running', executorDeviceId: 'host-lan-001' })])
    expect(disconnected.deviceAccess.established).toHaveLength(1)

    await act(async () => { vi.advanceTimersByTime(6_000) })
    expect(snapshot().world.network.hosts[0].installedSoftware).toHaveLength(2)

    await connectAndEnter()
    await openRemotePackage(user)
    expect(screen.getByRole('button', { name: 'INSTALLED ✓' })).toBeDisabled()
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('CURRENTPacket Viewer 1.0 Standard')
  })

  it('adds no software management to RACK-OS System and no package commands to RACK-OS Terminal', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState((host) => ({ ...host, installedSoftware: [...host.installedSoftware!, { id: 'packet-viewer', releaseId: 'packet-viewer-1.0', buildId: 'build-fixture-v0', name: 'Packet Viewer', version: '1.0', channel: 'standard' }] }))}><Shell /></GameProvider>)
    await enterRemote(user)

    await user.click(screen.getByRole('button', { name: 'SYSTEM' }))
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('AUTHENTICATION HISTORY')
    expect(rackOs).not.toHaveTextContent('INSTALLED SOFTWARE')
    expect(screen.queryByRole('button', { name: /UNINSTALL|RESTORE/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'TERMINAL' }))
    const input = screen.getByLabelText('Remote command')
    await user.type(input, 'help{enter}')
    expect(rackOs).toHaveTextContent('help clear ip scan ls cat download upload disconnect')
    expect(rackOs).not.toHaveTextContent('node-miner')
    await user.type(input, `install ${REMOTE_PACKAGE}{enter}`)
    expect(rackOs).toHaveTextContent('COMMAND NOT FOUND')
  })
})

/**
 * Remote execution on the Device the player is currently operating. Every
 * state below is read out of canonical truth: srv-01's own filesystem and the
 * NODE Miner Process its own executor identity is running.
 */

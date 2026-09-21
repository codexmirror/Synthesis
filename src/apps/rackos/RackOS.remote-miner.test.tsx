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

describe('RACK-OS remote NODE Miner execution', () => {
  const REMOTE_EXECUTABLE = '/usr/local/bin/node-miner'

  function minerExecutable(path = REMOTE_EXECUTABLE): ExecutableFile {
    return { kind: 'executable', id: 'file-remote-miner', path, programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', sizeBytes: 2_100_000 }
  }

  function runningMiner(executorDeviceId: string, overrides: Partial<NodeMinerProcess> = {}): NodeMinerProcess {
    return {
      kind: 'node_miner', id: 'process-0007', label: 'NODE MINER', executorDeviceId, status: 'running', ramRequiredMiB: 512,
      programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', payoutAddress: 'node-addr-canonical-remote', payoutSegment: 1,
      producedNodeUnits: 2_500_000, payoutNodeUnits: 1_340, developerFeeNodeUnits: 660,
      segmentPayoutNodeUnits: 1_340, segmentDeveloperFeeNodeUnits: 660, workRemainder: 0, ...overrides,
    }
  }

  /** An authorized Session over one represented host that already owns a supported NODE Miner executable. */
  function operatingState(hostIndex = 0, processes: readonly GameProcess[] = []): GameState {
    const base = createInitialGameState()
    const hosts = base.world.network.hosts
    const host = {
      ...hosts[hostIndex],
      filesystem: { nextFileId: 90, files: [...hosts[hostIndex].filesystem!.files, minerExecutable()] },
      installedSoftware: [{ id: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' }],
    }
    const authorized: GameState = {
      ...base,
      process: { nextId: 20, processes },
      deviceAccess: { nextId: 2, established: [{ id: 'access-remote-run', sourceDeviceId: base.player.localDevice.id, targetDeviceId: host.id, viaServiceId: `service-ssh-00${hostIndex + 1}`, privilege: 'USER' }] },
      world: { ...base.world, network: { ...base.world.network, hosts: hosts.map((candidate, index) => index === hostIndex ? host : candidate) } },
    }
    // srv-02 sits behind Bookstore's private segment; only its Gateway's own public edge reaches it.
    const address = host.id === 'host-lan-002' ? '203.0.113.42' : host.ip
    return connectRemoteFromObservation(authorized, { targetDeviceId: host.id, address }).state
  }

  async function openRemoteExecutable(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR usr' }))
    await user.click(screen.getByRole('button', { name: 'DIR local' }))
    await user.click(screen.getByRole('button', { name: 'DIR bin' }))
    await user.click(screen.getByRole('button', { name: 'FILE node-miner' }))
  }

  function snapshot(): GameState { return withoutBookstoreBackgroundTiming(JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState) }

  it('admits the Miner onto the Device actually being operated, with the exact payout address entered', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('EXECUTABLE')
    expect(rackOs).toHaveTextContent('node-miner-1.0')
    // Execution on this Device comes first; the artifact's relationship to node-01 stays secondary.
    const order = rackOs.textContent ?? ''
    expect(order.indexOf('RUN')).toBeLessThan(order.indexOf('TRANSFER'))
    expect(order.indexOf('TRANSFER')).toBeLessThan(order.indexOf('DOWNLOAD'))
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    // The confirmation names the Device that will own the runtime and the exact artifact.
    expect(rackOs).toHaveTextContent('RUN ON THIS DEVICE')
    expect(rackOs).toHaveTextContent('EXECUTORsrv-01')
    expect(rackOs).toHaveTextContent(`PROGRAM${REMOTE_EXECUTABLE}`)

    const address = screen.getByLabelText('NODE payout address')
    await user.clear(address)
    await user.type(address, 'node-addr-operator-01')
    await user.click(screen.getByRole('button', { name: 'RUN' }))

    const admitted = snapshot()
    expect(admitted.process.processes).toEqual([expect.objectContaining({
      kind: 'node_miner', status: 'running', executorDeviceId: 'host-lan-001',
      programId: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', payoutAddress: 'node-addr-operator-01',
    })])
    expect(rackOs).toHaveTextContent('RUNNING ON srv-01')
    expect(rackOs).toHaveTextContent('PROCESSprocess-0020')
    expect(rackOs).toHaveTextContent('PAYOUTnode-addr-operator-01')
    // Live payout retargeting is deliberately not a graphical convenience.
    expect(screen.queryByLabelText('NODE payout address')).not.toBeInTheDocument()
  })

  it('derives RUNNING, its Process and its payout address from canonical state alone', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState(0, [runningMiner('host-lan-001', { id: 'process-0042', payoutAddress: 'node-addr-altered-truth', producedNodeUnits: 3_450_000 })])}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('RUNNING ON srv-01')
    expect(rackOs).toHaveTextContent('PROCESSprocess-0042')
    expect(rackOs).toHaveTextContent('PAYOUTnode-addr-altered-truth')
    // Gross production keeps accumulating from srv-01's own runtime while this renders, so the assertion pins the altered canonical value it started from.
    expect(rackOs).toHaveTextContent('PRODUCED3.45')
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
  })

  it('never presents the local Device Miner as this Device running one', async () => {
    const user = userEvent.setup()
    // node-01 is mining; srv-01 is not. The pane belongs to srv-01.
    render(<GameProvider initialState={operatingState(0, [runningMiner('device-local-v0', { id: 'process-0031' })])}><Shell /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).not.toHaveTextContent('RUNNING ON')
    expect(rackOs).not.toHaveTextContent('process-0031')
    expect(screen.getByRole('button', { name: 'RUN' })).toBeEnabled()
  })

  it('operates the second represented server through its own stable identity', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState(1)}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)
    await user.click(screen.getByRole('button', { name: 'RUN' }))
    await user.click(screen.getByRole('button', { name: 'RUN' }))

    expect(snapshot().process.processes).toEqual([expect.objectContaining({ kind: 'node_miner', executorDeviceId: 'host-lan-002' })])
    expect(screen.getByLabelText('RACK-OS remote operating environment')).toHaveTextContent('RUNNING ON srv-02')
  })

  it('offers no execution for an executable that is not the supported program', async () => {
    const user = userEvent.setup()
    const base = operatingState()
    const host = base.world.network.hosts[0]
    const unsupported = { ...minerExecutable('/usr/local/bin/other'), id: 'file-other', programId: 'other-program', releaseId: 'other-1.0', buildId: 'build-fixture-v0', name: 'Other' }
    const state: GameState = { ...base, world: { ...base.world, network: { ...base.world.network, hosts: [{ ...host, filesystem: { nextFileId: 91, files: [...host.filesystem!.files, unsupported] } }, ...base.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={state}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.click(screen.getByRole('button', { name: 'FILES' }))
    await user.click(screen.getByRole('button', { name: 'DIR usr' }))
    await user.click(screen.getByRole('button', { name: 'DIR local' }))
    await user.click(screen.getByRole('button', { name: 'DIR bin' }))
    await user.click(screen.getByRole('button', { name: 'FILE other' }))

    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('UNSUPPORTED')
    expect(screen.queryByRole('button', { name: 'RUN' })).not.toBeInTheDocument()
  })

  it('stops only the operated Device Miner, leaving the local one running', async () => {
    const user = userEvent.setup()
    const processes = [runningMiner('host-lan-001', { id: 'process-0050' }), runningMiner('device-local-v0', { id: 'process-0051' })]
    render(<GameProvider initialState={operatingState(0, processes)}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    await openRemoteExecutable(user)
    await user.click(screen.getByRole('button', { name: 'STOP' }))

    const stopped = snapshot()
    expect(stopped.process.processes).toEqual([expect.objectContaining({ id: 'process-0051', executorDeviceId: 'device-local-v0' })])
    expect(stopped.recentActivity.entries).toEqual([])
    expect(screen.getByRole('button', { name: 'RUN' })).toBeEnabled()
  })

  it('retargets payout live from the Terminal through the canonical operation, with no lifecycle change', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState(0, [runningMiner('host-lan-001', { id: 'process-0060' })])}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const before = snapshot()

    await user.type(screen.getByLabelText('Remote command'), 'node-miner config payout node-addr-relay-77{enter}')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')
    expect(rackOs).toHaveTextContent('PAYOUT CONFIGURED')
    // The shared node-miner CLI never exposes the internal global GameProcess ID as a Device-local process number.
    expect(rackOs).not.toHaveTextContent('PROCESS')

    const after = snapshot()
    const miner = after.process.processes[0] as NodeMinerProcess
    expect(after.process.processes).toHaveLength(1)
    expect(after.process.nextId).toBe(before.process.nextId)
    expect(miner.id).toBe('process-0060')
    expect(miner.payoutAddress).toBe('node-addr-relay-77')
    // Real elapsed runtime may advance while the command is typed; retargeting
    // preserves rather than resets every accumulated economic counter.
    expect(miner.producedNodeUnits).toBeGreaterThanOrEqual((before.process.processes[0] as NodeMinerProcess).producedNodeUnits)
    expect(miner.payoutNodeUnits).toBeGreaterThanOrEqual((before.process.processes[0] as NodeMinerProcess).payoutNodeUnits)
    expect(miner.developerFeeNodeUnits).toBeGreaterThanOrEqual((before.process.processes[0] as NodeMinerProcess).developerFeeNodeUnits)
    expect(after.recentActivity.entries).toEqual([])
    expect(after.nodeWallet).toEqual(before.nodeWallet)

    // The executable surface observes the same running Process and now states its current address.
    await openRemoteExecutable(user)
    expect(rackOs).toHaveTextContent('PAYOUTnode-addr-relay-77')
    expect(rackOs).toHaveTextContent('PROCESSprocess-0060')
  })

  it('reports canonical retarget failures compactly without inventing a Miner', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'node-miner config payout node-addr-relay-77{enter}')
    expect(rackOs).toHaveTextContent('NOT RUNNING')
    await user.type(input, 'node-miner config payout{enter}')
    expect(rackOs).toHaveTextContent('Usage: node-miner config payout <address>')
    await user.type(input, 'node-miner status{enter}')
    expect(rackOs).toHaveTextContent('STATUS IDLE')
    expect(snapshot().process.processes).toEqual([])
  })

  it('derives the registered CLI from the operated Device installation and executable only', async () => {
    const user = userEvent.setup()
    const installed = operatingState()
    const remote = installed.world.network.hosts[0]
    const withoutRemoteInstallation: GameState = {
      ...installed,
      player: { ...installed.player, localDevice: { ...installed.player.localDevice, installedSoftware: [{ id: 'node-miner', releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0' }] } },
      world: { ...installed.world, network: { ...installed.world.network, hosts: [{ ...remote, installedSoftware: [] }, ...installed.world.network.hosts.slice(1)] } },
    }
    render(<GameProvider initialState={withoutRemoteInstallation}><Shell /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'help{enter}')
    expect(rackOs).not.toHaveTextContent('node-miner')
    await user.type(input, 'miner payout node-addr-relay-77{enter}')
    await user.type(input, 'node-miner config payout node-addr-relay-77{enter}')
    expect(rackOs).toHaveTextContent('COMMAND NOT FOUND')

    // The copied supported artifact remains directly runnable through Files;
    // lacking InstalledSoftware removes only its registered Terminal CLI.
    await openRemoteExecutable(user)
    expect(screen.getByRole('button', { name: 'RUN' })).toBeEnabled()
  })

  it('advertises coherent node-miner help only with both remote software and artifact', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'help{enter}')
    expect(rackOs).toHaveTextContent('help clear ip scan ls cat download upload disconnect')
    expect(rackOs).toHaveTextContent('NODE MINER 1.0')
    expect(rackOs).toHaveTextContent('node-miner — Control NODE Miner on this Device')
    expect(rackOs).not.toHaveTextContent(' upload miner ')
    await user.type(input, 'node-miner{enter}')
    await user.type(input, 'node-miner help{enter}')
    expect(rackOs).toHaveTextContent('node-miner run --payout <address>')
    expect(rackOs).toHaveTextContent('node-miner status')
    expect(rackOs).toHaveTextContent('node-miner stop')
    expect(rackOs).toHaveTextContent('node-miner config payout <address>')
  })

  it('derives the Firmware Help heading from the operated target', async () => {
    const state = operatingState()
    const target = state.world.network.hosts[0]
    const altered: GameState = { ...state, world: { ...state.world, network: { ...state.world.network, hosts: [{ ...target, firmware: { id: RACK_OS_FIRMWARE_ID, name: 'VAULT-OS', version: '9.2' } }, ...state.world.network.hosts.slice(1)] } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={altered}><Shell /></GameProvider>)
    await enterRemote(user)
    await user.type(screen.getByLabelText('Remote command'), 'help{enter}')
    expect(screen.getByLabelText('VAULT-OS remote operating environment')).toHaveTextContent('VAULT-OS 9.2')
  })

  it('runs, reports, retargets, and stops the operated Device through the shared CLI', async () => {
    const user = userEvent.setup()
    render(<GameProvider initialState={operatingState()}><Shell /><StateSnapshot /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'node-miner run --payout node-addr-remote-cli{enter}')
    expect(rackOs).toHaveTextContent('NODE MINER STARTED')
    const started = snapshot().process.processes.find((process) => process.kind === 'node_miner') as NodeMinerProcess
    expect(started.executorDeviceId).toBe('host-lan-001')

    await user.type(input, 'node-miner status{enter}')
    expect(rackOs).toHaveTextContent('RAM 512 MiB')
    expect(rackOs).toHaveTextContent('ADDRESS node-addr-remote-cli')
    // The shared node-miner CLI never exposes the internal global GameProcess ID as a Device-local process number, even though the running Process's identity is stable and available internally (asserted above via `started.id`).
    expect(rackOs).not.toHaveTextContent('PROCESS')

    await user.type(input, 'node-miner config payout node-addr-retargeted{enter}')
    expect((snapshot().process.processes.find(({ id }) => id === started.id) as NodeMinerProcess).payoutAddress).toBe('node-addr-retargeted')
    await user.type(input, 'node-miner stop{enter}')
    expect(snapshot().process.processes).toHaveLength(0)
    expect(snapshot().recentActivity.entries).toHaveLength(0)
  })

  it('does not conjure the CLI from installed metadata after the remote executable is absent', async () => {
    const user = userEvent.setup()
    const installed = operatingState()
    const remote = installed.world.network.hosts[0]
    const withoutExecutable: GameState = {
      ...installed,
      world: { ...installed.world, network: { ...installed.world.network, hosts: [{
        ...remote,
        filesystem: { ...remote.filesystem!, files: remote.filesystem!.files.filter((file) => file.kind !== 'executable') },
      }, ...installed.world.network.hosts.slice(1)] } },
    }
    render(<GameProvider initialState={withoutExecutable}><Shell /></GameProvider>)
    await enterRemote(user)
    const input = screen.getByLabelText('Remote command')
    const rackOs = screen.getByLabelText('RACK-OS remote operating environment')

    await user.type(input, 'help{enter}')
    expect(rackOs).not.toHaveTextContent('node-miner')
    await user.type(input, 'node-miner config payout node-addr-relay-77{enter}')
    expect(rackOs).toHaveTextContent('COMMAND NOT FOUND')
  })
})

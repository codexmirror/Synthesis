import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as GameContext from '../../app/GameContext'
import type { GameActions } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { ScanResult } from '../../core/game/scan'
import { Terminal } from './Terminal'
import { rememberScan } from '../../core/game/discovery'
import { scanNetworkTarget } from '../../core/game/scan'
import type { GameState } from '../../core/game/types'
import { GameProvider, useGameState } from '../../app/GameContext'
import { useGameActions } from '../../app/GameContext'
import { deriveResourceUsage } from '../../core/game/processes'
import { installLocalSoftwarePackage } from '../../core/game/softwareInstallation'
import { advanceGameState } from '../../core/game/gameAdvancement'
import { Processes } from '../processes/Processes'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((onResolve, onReject) => { resolve = onResolve; reject = onReject })
  return { promise, resolve, reject }
}

function renderTerminal(scanTarget: GameActions['scanTarget']) {
  const state = createInitialGameState()
  const unavailable = { status: 'unavailable' as const, state }
  const actions: GameActions = {
    pingTarget: vi.fn(),
    scanTarget,
    inspectTarget: vi.fn(),
    findTargets: vi.fn(),
    startServiceAnalysis: () => unavailable,
    startServiceAnalysisAtEndpoint: () => unavailable,
    startServiceAnalysisFromObservation: () => unavailable,
    startObservedServiceAnalyses: () => ({ started: 0 }),
    startDeauthAttempt: vi.fn(),
    startCredentialAccessAttemptFromObservation: () => ({ status: 'not_available', state }),
    startRackUpdateExploitAttemptFromObservation: () => ({ status: 'not_available', state }),
    startRackUpdatePackageSubmission: () => ({ status: 'observation_required', state }),
    cancelRackUpdatePackageSubmission: () => ({ status: 'not_found', state }),
    connectRemoteFromObservation: () => ({ status: 'access_required', state }),
    disconnectRemoteSession: () => ({ status: 'not_connected', state }),
    startRemoteFileDownload: vi.fn(), startRemoteFileUpload: vi.fn(),
    installLocalSoftwarePackage: vi.fn(), installRemoteSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), startFlipperModuleIntegration: vi.fn(),
    openMailThread: () => {}, sendMailReply: () => ({ status: 'thread_unavailable', state }),
    clearRecentActivity: () => {}, removeRecentActivity: () => {}, authenticateDollarAccount: () => ({ status: 'invalid_credentials', state }), authenticateDollarAccountWithSavedSignIn: () => ({ status: 'no_saved_sign_in', state }), logoutDollarAccount: () => ({ status: 'not_signed_in', state }), transferDollars: () => ({ status: 'not_signed_in', state }), transferRemoteDollars: () => ({ status: 'session_unavailable', state }), cancelFileTransfer: () => ({ status: 'not_found', state }), purchaseMarketOffer: () => ({ status: 'unknown_offer' as const, state }), startMarketPackageDownload: () => ({ status: 'unknown_offer' as const, state }), cancelLocalProcess: () => ({ status: 'not_cancellable', state }),
    runNodeMiner: () => ({ status: 'source_not_found', state }), stopNodeMiner: () => ({ status: 'not_found', state }),
    runRemoteNodeMiner: () => ({ status: 'session_unavailable', state }), stopRemoteNodeMiner: () => ({ status: 'session_unavailable', state }), retargetLocalNodeMinerPayout: vi.fn(), payoutLocalNodeMiner: vi.fn(), payoutNodeMiner: vi.fn(), retargetNodeMinerPayout: () => ({ status: 'session_unavailable', state }), changeWalletProtectionForOperatedRemoteDevice: () => ({ status: 'session_unavailable', state }), verifyDevicePinForOperatedRemoteDevice: () => ({ status: 'session_unavailable', state }), createRattlerPayload: vi.fn(),
  }
  vi.spyOn(GameContext, 'useGameState').mockReturnValue(state)
  vi.spyOn(GameContext, 'useGameActions').mockReturnValue(actions)
  render(<Terminal />)
  return screen.getByLabelText('Command input')
}

afterEach(() => vi.restoreAllMocks())

describe('Terminal interaction controller', () => {
  it('uses only the native input caret in the command form', () => {
    const input = renderTerminal(vi.fn())
    const form = input.closest('.terminal-input')

    expect(form).toBeInTheDocument()
    expect(form?.querySelector('.terminal-cursor')).not.toBeInTheDocument()
  })

  it('does not autofocus, prevents composed Enter submission, and restores the live history draft', async () => {
    const scanTarget = vi.fn()
    const input = renderTerminal(scanTarget)
    const user = userEvent.setup()
    expect(input).not.toHaveFocus()

    input.focus()
    await user.type(input, 'scan home-net')
    fireEvent.compositionStart(input)
    expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true })).toBe(false)
    fireEvent.keyDown(input, { key: 'ArrowUp', isComposing: true })
    fireEvent.compositionEnd(input)
    expect(fireEvent.keyDown(input, { key: 'Enter', isComposing: true })).toBe(false)
    expect(fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 })).toBe(false)
    await act(async () => {})
    expect(scanTarget).not.toHaveBeenCalled()
    expect(document.querySelectorAll('.terminal-entry')).toHaveLength(0)

    await user.clear(input)
    await user.type(input, 'ip{enter}analy')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ip')
    await user.keyboard('{ArrowDown}')
    expect(input).toHaveValue('analy')
  })

  it('keeps history after clear and isolates history between Terminal instances', async () => {
    const input = renderTerminal(vi.fn())
    const user = userEvent.setup()
    await user.type(input, 'ip{enter}clear{enter}')
    expect(screen.queryByText('Local address:')).not.toBeInTheDocument()
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('clear')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ip')

    render(<Terminal />)
    const secondInput = screen.getAllByLabelText('Command input')[1]
    secondInput.focus()
    await user.keyboard('{ArrowUp}')
    expect(secondInput).toHaveValue('')
    expect(input).toHaveValue('ip')
  })

  it('follows real async output changes only when intended and uses newly rendered geometry', async () => {
    const first = deferred<ScanResult>()
    const second = deferred<ScanResult>()
    const scanTarget = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const input = renderTerminal(scanTarget)
    const output = document.querySelector<HTMLElement>('.terminal-output')!
    let scrollHeight = 200
    const scrollWrites: number[] = []
    Object.defineProperties(output, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
      scrollTop: {
        configurable: true,
        get: () => scrollWrites.at(-1) ?? 0,
        set: (value: number) => { scrollWrites.push(value) },
      },
    })
    const user = userEvent.setup()

    await user.type(input, 'scan home-net{enter}')
    output.scrollTop = 20
    fireEvent.scroll(output)
    scrollHeight = 320
    await act(async () => first.resolve({ status: 'network', networkId: 'network-local-001', networkName: 'home-net', devices: [] }))
    expect(output.scrollTop).toBe(20)

    await user.type(input, 'scan home-net{enter}')
    output.scrollTop = 210
    fireEvent.scroll(output)
    scrollHeight = 440
    await act(async () => second.resolve({ status: 'network', networkId: 'network-local-001', networkName: 'home-net', devices: [] }))
    expect(output.scrollTop).toBe(440)

    output.scrollTop = 0
    fireEvent.scroll(output)
    scrollWrites.length = 0
    scrollHeight = 440
    await user.type(input, 'ip')
    expect(scrollWrites).toEqual([])
    scrollHeight = 560
    await user.type(input, '{enter}')
    expect(scrollWrites).toEqual([560])
    expect(output).toHaveAttribute('data-editing-scroll-owner')
    expect(output).not.toHaveAttribute('aria-live')
  })
})

describe('Terminal asynchronous Scan submission', () => {
  it('clears immediately, stays editable, deduplicates submission, preserves later input and history, and renders one structured result', async () => {
    const pending = deferred<ScanResult>()
    const scanTarget = vi.fn(() => pending.promise)
    const input = renderTerminal(scanTarget)
    const user = userEvent.setup()

    await user.type(input, 'scan home-net{enter}')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(input).toBeEnabled()
    expect(scanTarget).toHaveBeenCalledExactlyOnceWith('home-net')

    const pendingView = screen.getByRole('status', {
      name: 'Scanning home-net',
    })
    expect(pendingView).toHaveTextContent('SCANNING')
    expect(pendingView).toHaveTextContent('home-net')

    await user.type(input, 'inspect home-net{enter}')
    expect(input).toHaveValue('inspect home-net')
    expect(scanTarget).toHaveBeenCalledOnce()

        await act(async () => {
      pending.resolve({
        status: 'network',
        networkId: 'network-local-001',
        networkName: 'home-net',
        devices: [
          {
            targetId: 'device-local-v0',
            address: '198.51.100.23',
            scope: 'self',
          },
        ],
      })
    })

    expect(input).toHaveValue('inspect home-net')

    await waitFor(() =>
      expect(screen.getAllByText('Scanning home-net...')).toHaveLength(1),
    )

    expect(
      screen.queryByRole('status', { name: 'Scanning home-net' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.23' })).toHaveTextContent('198.51.100.23')

    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('scan home-net')
  })

  it('renders one safe failure, retains typed text and history, releases the guard, and accepts the next command', async () => {
    const pending = deferred<ScanResult>()
    const scanTarget = vi.fn(() => pending.promise)
    const input = renderTerminal(scanTarget)
    const user = userEvent.setup()

    await user.type(input, 'scan home-net{enter}draft')
    expect(input).toHaveValue('draft')
    await act(async () => pending.reject(new Error('network failure')))
    expect(screen.getAllByText('COMMAND FAILED')).toHaveLength(1)
    expect(input).toHaveValue('draft')
    expect(input).toHaveFocus()

    await user.clear(input)
    await user.type(input, 'ip{enter}')
    await waitFor(() => expect(screen.getByText('Local address:')).toBeInTheDocument())
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('ip')
    await user.keyboard('{ArrowUp}')
    expect(input).toHaveValue('scan home-net')
  })
})

function knownCredentialState(): GameState {
  const state = createInitialGameState()
  const discovery = rememberScan(state.discovery, scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, '198.51.100.47'), state.player.localDevice.id)
  return { ...state, discovery, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-017', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Weak authentication configuration' }] } }
}

function StateControls() {
  const state = useGameState()
  const actions = useGameActions()
  return <><button onClick={actions.clearRecentActivity}>Clear process history</button><output data-testid="game-state">{JSON.stringify(state)}</output></>
}

describe('Terminal credential access', () => {
  it('resolves remembered identities and invokes the same application action used by Scan', async () => {
    const state = knownCredentialState()
    const startCredentialAccessAttemptFromObservation = vi.fn(() => ({ status: 'started' as const, processId: 'process-test', state }))
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(state)
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({
      pingTarget: vi.fn(), scanTarget: vi.fn(), inspectTarget: vi.fn(), findTargets: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: vi.fn(), startObservedServiceAnalyses: vi.fn(),
      startCredentialAccessAttemptFromObservation, startDeauthAttempt: vi.fn(), startRackUpdateExploitAttemptFromObservation: vi.fn(), startRackUpdatePackageSubmission: vi.fn(), cancelRackUpdatePackageSubmission: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), startRemoteFileUpload: vi.fn(), installLocalSoftwarePackage: vi.fn(), installRemoteSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), startFlipperModuleIntegration: vi.fn(), openMailThread: vi.fn(), sendMailReply: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), authenticateDollarAccount: vi.fn(), authenticateDollarAccountWithSavedSignIn: vi.fn(), logoutDollarAccount: vi.fn(), transferDollars: vi.fn(), transferRemoteDollars: vi.fn(), cancelFileTransfer: vi.fn(), purchaseMarketOffer: vi.fn(), startMarketPackageDownload: vi.fn(), cancelLocalProcess: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn(), runRemoteNodeMiner: vi.fn(), stopRemoteNodeMiner: vi.fn(), retargetLocalNodeMinerPayout: vi.fn(), payoutLocalNodeMiner: vi.fn(), payoutNodeMiner: vi.fn(), retargetNodeMinerPayout: vi.fn(), changeWalletProtectionForOperatedRemoteDevice: vi.fn(), verifyDevicePinForOperatedRemoteDevice: vi.fn(), createRattlerPayload: vi.fn(),
    })
    render(<Terminal />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Command input'), 'attack 198.51.100.47:22{enter}')
    expect(startCredentialAccessAttemptFromObservation).toHaveBeenCalledExactlyOnceWith({
      endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001',
      vulnerabilityId: 'AUTH-017', providerId: 'credential-access-module',
    })
    expect(screen.getByText('PROCESS UNAVAILABLE')).toBeInTheDocument()
  })

  it('dispatches a UPD-001 endpoint to the RackUpdate exploit rather than Credential Access', async () => {
    const base = createInitialGameState()
    const discovery = rememberScan(base.discovery, scanNetworkTarget({ localDevice: base.player.localDevice, network: base.world.network }, '203.0.113.42'), base.player.localDevice.id)
    const state = { ...base, discovery, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'UPD-001', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002', observedLabel: 'Rollback protection not enforced' }] } }
    const startCredentialAccessAttemptFromObservation = vi.fn()
    const startRackUpdateExploitAttemptFromObservation = vi.fn(() => ({ status: 'started' as const, processId: 'process-test', state }))
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(state)
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({
      pingTarget: vi.fn(), scanTarget: vi.fn(), inspectTarget: vi.fn(), findTargets: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: vi.fn(), startObservedServiceAnalyses: vi.fn(),
      startCredentialAccessAttemptFromObservation, startDeauthAttempt: vi.fn(), startRackUpdateExploitAttemptFromObservation, startRackUpdatePackageSubmission: vi.fn(), cancelRackUpdatePackageSubmission: vi.fn(), connectRemoteFromObservation: vi.fn(), disconnectRemoteSession: vi.fn(), startRemoteFileDownload: vi.fn(), startRemoteFileUpload: vi.fn(), installLocalSoftwarePackage: vi.fn(), installRemoteSoftwarePackage: vi.fn(), removeInstalledSoftware: vi.fn(), startFlipperModuleIntegration: vi.fn(), openMailThread: vi.fn(), sendMailReply: vi.fn(), clearRecentActivity: vi.fn(), removeRecentActivity: vi.fn(), authenticateDollarAccount: vi.fn(), authenticateDollarAccountWithSavedSignIn: vi.fn(), logoutDollarAccount: vi.fn(), transferDollars: vi.fn(), transferRemoteDollars: vi.fn(), cancelFileTransfer: vi.fn(), purchaseMarketOffer: vi.fn(), startMarketPackageDownload: vi.fn(), cancelLocalProcess: vi.fn(), runNodeMiner: vi.fn(), stopNodeMiner: vi.fn(), runRemoteNodeMiner: vi.fn(), stopRemoteNodeMiner: vi.fn(), retargetLocalNodeMinerPayout: vi.fn(), payoutLocalNodeMiner: vi.fn(), payoutNodeMiner: vi.fn(), retargetNodeMinerPayout: vi.fn(), changeWalletProtectionForOperatedRemoteDevice: vi.fn(), verifyDevicePinForOperatedRemoteDevice: vi.fn(), createRattlerPayload: vi.fn(),
    })
    render(<Terminal />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Command input'), 'attack 203.0.113.42:8443{enter}')
    expect(startRackUpdateExploitAttemptFromObservation).toHaveBeenCalledExactlyOnceWith({
      endpoint: '203.0.113.42:8443', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002',
      vulnerabilityId: 'UPD-001',
    })
    expect(startCredentialAccessAttemptFromObservation).not.toHaveBeenCalled()
  })

  it('starts from stale Knowledge and later fails against patched current World truth', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const known = knownCredentialState(); const host = known.world.network.hosts[0]
    const patched = { ...known, world: { network: { ...known.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } } : service) }, ...known.world.network.hosts.slice(1)] } } }
    function Snapshot() { return <output data-testid="attack-state">{JSON.stringify(useGameState())}</output> }
    render(<GameProvider initialState={patched}><Terminal /><Snapshot /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByLabelText('Command input'), 'attack 198.51.100.47:22{enter}')
    expect(screen.getByRole('region', { name: 'CREDENTIAL ACCESS running' })).toBeInTheDocument()
    expect(screen.getByText('Credential Access Module')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(20_000) })
    expect(screen.getByRole('region', { name: 'CREDENTIAL ACCESS completed' })).toHaveTextContent('ATTEMPT FAILED')
    expect(screen.getByText('Authentication attempt failed.')).toBeInTheDocument()
    const state = JSON.parse(screen.getByTestId('attack-state').textContent ?? '') as GameState
    expect(state.process.processes.at(-1)).toMatchObject({ kind: 'credential_access', status: 'completed', result: { status: 'attempt_failed', message: 'Authentication attempt failed.' } })
    expect(state.deviceAccess.established).toEqual([])
    expect(state.knowledge).toEqual(patched.knowledge)
  })
})

describe('Terminal remote session', () => {
  it('resolves connect through Discovery, preserves local commands, and disconnects', async () => {
    const known = knownCredentialState()
    const state = { ...known, deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: known.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' as const }] } }
    render(<GameProvider initialState={state}><Terminal /><StateControls /></GameProvider>)
    const user = userEvent.setup(); const input = screen.getByLabelText('Command input')
    await user.type(input, 'connect 198.51.100.47{enter}')
    expect(await screen.findByText('REMOTE SESSION ESTABLISHED')).toBeInTheDocument()
    await user.type(input, 'ip{enter}ls /home/user{enter}')
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('welcome.txt')).toBeInTheDocument()
    await user.type(input, 'disconnect{enter}')
    expect(screen.getByText('REMOTE SESSION ENDED')).toBeInTheDocument()
    const snapshot = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(snapshot.remoteSession.active).toBeNull(); expect(snapshot.deviceAccess.established).toHaveLength(1)
  })

  it('does not resolve an address that exists only in hidden World', async () => {
    render(<GameProvider><Terminal /></GameProvider>)
    await userEvent.setup().type(screen.getByLabelText('Command input'), 'connect 198.51.100.47{enter}')
    expect(await screen.findByText('TARGET NOT KNOWN')).toBeInTheDocument()
  })
})

describe('Terminal local installation', () => {
  it('starts a running installation Process through GameActions, completes with the represented release, and updates Help with baseline Inspect', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const base = createInitialGameState()
    const packageFile = { kind: 'software_package' as const, id: 'file-fixture-package', path: '/home/user/downloads/nodescan-exp-1.1.pkg', releaseId: 'nodescan-1.1-experimental', buildId: 'build-fixture-v0', productId: 'nodescan', name: 'NodeScan', version: '1.1', channel: 'experimental', sizeBytes: 1_000 }
    const state = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, filesystem: { nextFileId: 50, files: [...base.player.localDevice.filesystem.files, packageFile] } } } }
    render(<GameProvider initialState={state}><Terminal /><StateControls /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime }); const input = screen.getByLabelText('Command input')
    await user.type(input, `install ${packageFile.path}{enter}`)
    expect(screen.getByText('INSTALLING')).toBeInTheDocument()
    expect(screen.getByText('NodeScan 1.1 Experimental')).toBeInTheDocument()

    // Admission starts work, not installation truth: NodeScan stays at its previous release until the Process completes.
    const runningSoftware = (JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState).player.localDevice.installedSoftware
    expect(runningSoftware.find(({ id }) => id === 'nodescan')?.releaseId).toBe('nodescan-1.0-standard')

    await act(async () => { vi.advanceTimersByTime(20_000) })

    await user.type(input, 'help{enter}')
    expect(screen.getByText('NODESCAN 1.1 EXPERIMENTAL')).toBeInTheDocument()
    expect(screen.getByText('install — <local-absolute-file-path> Install a local software package')).toBeInTheDocument()
    expect(screen.getByText(/inspect —/i)).toBeInTheDocument()
    await user.type(input, `install ${packageFile.path}{enter}`)
    expect(screen.getByText('ALREADY INSTALLED')).toBeInTheDocument()
    const installed = (JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState).player.localDevice.installedSoftware
    expect(installed).toContainEqual(expect.objectContaining({ id: 'nodescan', releaseId: 'nodescan-1.1-experimental' }))
    expect(installed).toContainEqual(expect.objectContaining({ id: 'keyprobe', releaseId: 'keyprobe-1.0' }))
    vi.useRealTimers()
  })
})

describe('Terminal NODE Miner CLI', () => {
  /** A local Device with NODE Miner already installed (skipping typed `install`, which its own test covers) so RUN/STATUS/STOP scenarios stay well under the test timeout. */
  function installedState(): GameState {
    const base = createInitialGameState()
    const started = installLocalSoftwarePackage(base, '/home/user/downloads/node-miner-1.0.pkg')
    if (started.status !== 'started') throw new Error(started.status)
    const installed = advanceGameState(started.state, 20_000)
    // Reset the installation Process's own history/ID progression so RUN scenarios below keep asserting the well-known process-0001 identity.
    return { ...installed, process: { nextId: 1, processes: [] }, recentActivity: { entries: [] } }
  }

  it('is unavailable before installation and absent from help, then appears after install with IDLE status', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const state = createInitialGameState()
    render(<GameProvider initialState={state}><Terminal /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime }); const input = screen.getByLabelText('Command input')

    await user.type(input, 'node-miner status{enter}')
    expect(screen.getByText('Command not found: node-miner. Type "help" for available commands.')).toBeInTheDocument()
    await user.type(input, 'help{enter}')
    expect(screen.queryByText('NODE MINER 1.0')).not.toBeInTheDocument()

    await user.type(input, 'install /home/user/downloads/node-miner-1.0.pkg{enter}')
    expect(screen.getByText('INSTALLING')).toBeInTheDocument()

    await act(async () => { vi.advanceTimersByTime(20_000) })

    await user.type(input, 'help{enter}')
    expect(screen.getByText('NODE MINER 1.0')).toBeInTheDocument()

    await user.type(input, 'node-miner status{enter}')
    expect(screen.getByText('STATUS IDLE')).toBeInTheDocument()
    vi.useRealTimers()
  }, 15_000)

  it('RUN invokes the canonical operation, is immediately visible through Processes, and rejects a duplicate', async () => {
    const state = installedState()
    render(<GameProvider initialState={state}><Terminal /><Processes /></GameProvider>)
    const user = userEvent.setup(); const input = screen.getByLabelText('Command input')

    await user.type(input, `node-miner run --payout ${state.nodeWallet.address}{enter}`)
    expect(screen.getByText('NODE MINER STARTED')).toBeInTheDocument()
    expect(screen.getByText(`PAYOUT ${state.nodeWallet.address}`)).toBeInTheDocument()
    // The shared node-miner CLI never exposes the internal global GameProcess ID as a Device-local process number.
    expect(screen.queryByText(/PROCESS/)).not.toBeInTheDocument()
    expect(screen.queryByText(/process-0001/)).not.toBeInTheDocument()

    // The very same Process is immediately visible through Processes.
    const minerCard = screen.getByText('NODE MINER').closest('.am-activity') as HTMLElement
    expect(within(minerCard).getByText('RUNNING')).toBeInTheDocument()

    await user.type(input, 'node-miner run --payout other{enter}')
    expect(screen.getByText('ALREADY RUNNING')).toBeInTheDocument()
  }, 15_000)

  it('configures payout for a local run in place without restarting it', async () => {
    const state = installedState()
    render(<GameProvider initialState={state}><Terminal /></GameProvider>)
    const user = userEvent.setup(); const input = screen.getByLabelText('Command input')

    await user.type(input, `node-miner run --payout ${state.nodeWallet.address}{enter}`)
    await user.type(input, 'node-miner config payout node-addr-local-retarget{enter}')
    expect(screen.getByText('PAYOUT CONFIGURED')).toBeInTheDocument()

    await user.type(input, 'node-miner status{enter}')
    expect(screen.getByText('STATUS RUNNING')).toBeInTheDocument()
    expect(screen.getByText('ADDRESS node-addr-local-retarget')).toBeInTheDocument()
    expect(screen.queryByText(/PROCESS/)).not.toBeInTheDocument()
  }, 15_000)

  it('STATUS reflects RUNNING with real resource facts, and STOP invokes canonical STOP visible in Processes and later STATUS', async () => {
    const state = installedState()
    render(<GameProvider initialState={state}><Terminal /><Processes /></GameProvider>)
    const user = userEvent.setup(); const input = screen.getByLabelText('Command input')

    await user.type(input, `node-miner run --payout ${state.nodeWallet.address}{enter}`)
    await user.type(input, 'node-miner status{enter}')
    expect(screen.getByText('STATUS RUNNING')).toBeInTheDocument()
    expect(screen.queryByText(/PROCESS/)).not.toBeInTheDocument()

    await user.type(input, 'node-miner stop{enter}')
    expect(screen.getByText('STOPPED')).toBeInTheDocument()
    expect((screen.getByText('NODE MINER').closest('.am-activity') as HTMLElement).dataset.status).toBe('recent')

    await user.type(input, 'node-miner status{enter}')
    expect(screen.getByText('STATUS IDLE')).toBeInTheDocument()

    await user.type(input, 'node-miner stop{enter}')
    expect(screen.getByText('NOT RUNNING')).toBeInTheDocument()
  }, 15_000)

  it('becomes unavailable again once the installed executable is deleted, even though an already-running Process continues independently', async () => {
    const state = createInitialGameState()
    const minerProcess = {
      kind: 'node_miner' as const, id: 'process-0001', label: 'NODE MINER', executorDeviceId: state.player.localDevice.id, status: 'running' as const,
      ramRequiredMiB: 512, programId: 'node-miner' as const, releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', payoutAddress: state.nodeWallet.address, payoutSegment: 1, producedNodeUnits: 10, payoutNodeUnits: 9, developerFeeNodeUnits: 1, segmentPayoutNodeUnits: 9, segmentDeveloperFeeNodeUnits: 1, workRemainder: 0,
    }
    const runningWithoutExecutable: GameState = {
      ...state,
      player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [...state.player.localDevice.installedSoftware, { id: 'node-miner' as const, releaseId: 'node-miner-1.0', buildId: 'build-fixture-v0', name: 'NODE Miner', version: '1.0', channel: 'unofficial', publisher: 'nm-dev' }] } },
      process: { nextId: 2, processes: [minerProcess] },
    }
    render(<GameProvider initialState={runningWithoutExecutable}><Terminal /><Processes /></GameProvider>)

    // The already-running Process is independent of its source executable and still shows in Processes.
    const minerCard = screen.getByText('NODE MINER').closest('.am-activity') as HTMLElement
    expect(within(minerCard).getByText('RUNNING')).toBeInTheDocument()

    // But installed metadata alone cannot conjure the missing executable back into CLI availability.
    await userEvent.setup().type(screen.getByLabelText('Command input'), 'node-miner status{enter}')
    expect(screen.getByText('Command not found: node-miner. Type "help" for available commands.')).toBeInTheDocument()
  })
})

describe('Terminal live Process projection', () => {
  it('binds Analyze to canonical Process state, updates in place, and preserves input focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const initial = knownCredentialState()
    render(<GameProvider initialState={{ ...initial, knowledge: { discoveredVulnerabilities: [] } }}><Terminal /><StateControls /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const input = screen.getByLabelText('Command input')

    await user.type(input, 'analyze 198.51.100.47:22{enter}')
    const running = screen.getByRole('region', { name: 'SERVICE ANALYSIS running' })
    expect(running).toHaveTextContent('CPU 82% RAM 768 MiB')
    expect(running).toHaveTextContent('0%')
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.47:22' })).toHaveClass('target-token-external')
    expect(input).toBeEnabled()
    expect(input).toHaveFocus()

    await act(async () => { vi.advanceTimersByTime(2_000) })
    expect(screen.getByRole('region', { name: 'SERVICE ANALYSIS running' })).not.toHaveTextContent('0% complete')
    expect(document.querySelectorAll('.terminal-entry')).toHaveLength(1)

    input.blur()
    await act(async () => { vi.advanceTimersByTime(20_000) })
    const completed = screen.getByRole('region', { name: 'SERVICE ANALYSIS completed' })
    expect(completed).toHaveTextContent('WEAKNESS DETECTED')
    expect(completed).toHaveTextContent('Weak authentication configuration')
    expect(completed).toHaveTextContent('Known interaction')
    expect(input).not.toHaveFocus()
    expect(document.querySelectorAll('.terminal-entry')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Clear process history' }))
    expect(screen.getByRole('region', { name: 'SERVICE ANALYSIS completed' })).toHaveTextContent('Weak authentication configuration')
    const afterCleanup = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(afterCleanup.process.processes).toEqual([])
    expect(afterCleanup.knowledge.discoveredVulnerabilities).toHaveLength(1)

    await user.type(input, 'clear{enter}')
    expect(screen.queryByRole('region', { name: 'SERVICE ANALYSIS completed' })).not.toBeInTheDocument()
    const afterTerminalClear = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(afterTerminalClear.knowledge).toEqual(afterCleanup.knowledge)
    vi.useRealTimers()
  })

  it('preserves successful Attack presentation after Process cleanup without owning DeviceAccess', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<GameProvider initialState={knownCredentialState()}><Terminal /><StateControls /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByLabelText('Command input'), 'attack 198.51.100.47:22{enter}')
    await act(async () => { vi.advanceTimersByTime(20_000) })
    const completed = screen.getByRole('region', { name: 'CREDENTIAL ACCESS completed' })
    expect(completed).toHaveTextContent('ACCESS ESTABLISHED')
    expect(completed).toHaveTextContent('USER')

    await user.click(screen.getByRole('button', { name: 'Clear process history' }))
    expect(screen.getByRole('region', { name: 'CREDENTIAL ACCESS completed' })).toHaveTextContent('ACCESS ESTABLISHEDUSER')
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.process.processes).toEqual([])
    expect(state.deviceAccess.established).toMatchObject([{ privilege: 'USER', viaServiceId: 'service-ssh-001' }])
    vi.useRealTimers()
  })

  it('keeps concurrent entries independently bound and reflects canonical CPU sharing', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const initial = { ...knownCredentialState(), knowledge: { discoveredVulnerabilities: [] } }
    render(<GameProvider initialState={initial}><Terminal /><StateControls /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    const input = screen.getByLabelText('Command input')

    await user.type(input, 'analyze 198.51.100.47:22{enter}')
    const singleState = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const singleUsage = deriveResourceUsage(singleState.player.localDevice, singleState.process)
    expect(screen.getByRole('region', { name: 'SERVICE ANALYSIS running' })).toHaveTextContent(`CPU ${Math.round(singleUsage.cpuAllocationByProcess[singleState.process.processes[0].id])}%`)

    await user.type(input, 'analyze 198.51.100.47:80{enter}')
    const sharedState = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    const sharedUsage = deriveResourceUsage(sharedState.player.localDevice, sharedState.process)
    expect(new Set(sharedState.process.processes.map(({ id }) => id)).size).toBe(2)
    const projections = screen.getAllByRole('region', { name: 'SERVICE ANALYSIS running' })
    expect(projections).toHaveLength(2)
    for (const process of sharedState.process.processes) {
      const projection = screen.getByRole('button', { name: `Copy target ${process.kind === 'service_analysis' ? process.startedEndpoint : ''}` }).closest('.process-projection')
      expect(projection).toHaveTextContent(`CPU ${Math.round(sharedUsage.cpuAllocationByProcess[process.id])}%`)
    }

    await act(async () => { vi.advanceTimersByTime(2_000) })
    for (const projection of screen.getAllByRole('region', { name: 'SERVICE ANALYSIS running' })) expect(projection).not.toHaveTextContent('0%')
    expect(document.querySelectorAll('.terminal-entry')).toHaveLength(2)
    vi.useRealTimers()
  })

  it('keeps Target Tokens copyable and exposes restrained semantic reference classes', async () => {
    renderTerminal(vi.fn())
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Command input'), 'ip{enter}')
    const token = screen.getByRole('button', { name: 'Copy target 198.51.100.23' })
    expect(token).toHaveClass('target-token-local')
    expect(token).toHaveAttribute('title', expect.stringContaining('Local reference'))
    const writeText = vi.spyOn(navigator.clipboard, 'writeText')
    await user.click(token)
    expect(writeText).toHaveBeenCalledExactlyOnceWith('198.51.100.23')
  })
})

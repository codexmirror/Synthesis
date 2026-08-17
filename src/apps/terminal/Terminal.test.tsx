import { act, render, screen, waitFor } from '@testing-library/react'
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
    scanTarget,
    startServiceAnalysis: () => unavailable,
    startServiceAnalysisAtEndpoint: () => unavailable,
    startServiceAnalysisFromObservation: () => unavailable,
    startCredentialAccessAttemptFromObservation: () => ({ status: 'not_available', state }),
    clearCompletedProcesses: () => {},
  }
  vi.spyOn(GameContext, 'useGameState').mockReturnValue(state)
  vi.spyOn(GameContext, 'useGameActions').mockReturnValue(actions)
  render(<Terminal />)
  return screen.getByLabelText('Command input')
}

afterEach(() => vi.restoreAllMocks())

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

    await user.type(input, 'inspect home-net{enter}')
    expect(input).toHaveValue('inspect home-net')
    expect(scanTarget).toHaveBeenCalledOnce()

    await act(async () => pending.resolve({ status: 'network', networkId: 'network-local-001', networkName: 'home-net', devices: [{ targetId: 'device-local-v0', address: '198.51.100.23', scope: 'self' }] }))
    expect(input).toHaveValue('inspect home-net')
    expect(screen.getAllByText('Scanning home-net...')).toHaveLength(1)
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
  return { ...state, discovery, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'vulnerability-ssh-001', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Weak authentication configuration' }] } }
}

describe('Terminal credential access', () => {
  it('resolves remembered identities and invokes the same application action used by Scan', async () => {
    const state = knownCredentialState()
    const startCredentialAccessAttemptFromObservation = vi.fn(() => ({ status: 'started' as const, processId: 'process-test', state }))
    vi.spyOn(GameContext, 'useGameState').mockReturnValue(state)
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({
      scanTarget: vi.fn(), startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: vi.fn(),
      startCredentialAccessAttemptFromObservation, clearCompletedProcesses: vi.fn(),
    })
    render(<Terminal />)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText('Command input'), 'attack 198.51.100.47:22{enter}')
    expect(startCredentialAccessAttemptFromObservation).toHaveBeenCalledExactlyOnceWith({
      endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001',
      vulnerabilityId: 'vulnerability-ssh-001', toolId: 'basic-credential-toolkit',
    })
    expect(screen.getAllByText('CREDENTIAL ACCESS ATTEMPT STARTED')).toHaveLength(1)
    expect(screen.getByText('Method: Basic Credential Toolkit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy target 198.51.100.47:22' })).toBeInTheDocument()
  })

  it('starts from stale Knowledge and later fails against patched current World truth', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const known = knownCredentialState(); const host = known.world.network.hosts[0]
    const patched = { ...known, world: { network: { ...known.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, vulnerabilities: [] } : service) }, ...known.world.network.hosts.slice(1)] } } }
    function Snapshot() { return <output data-testid="attack-state">{JSON.stringify(useGameState())}</output> }
    render(<GameProvider initialState={patched}><Terminal /><Snapshot /></GameProvider>)
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.type(screen.getByLabelText('Command input'), 'attack 198.51.100.47:22{enter}')
    expect(screen.getByText('CREDENTIAL ACCESS ATTEMPT STARTED')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(20_000) })
    const state = JSON.parse(screen.getByTestId('attack-state').textContent ?? '') as GameState
    expect(state.process.processes.at(-1)).toMatchObject({ kind: 'credential_access', status: 'completed', result: { status: 'attempt_failed', message: 'Target no longer responds as expected.' } })
    expect(state.deviceAccess.established).toEqual([])
    expect(state.knowledge).toEqual(patched.knowledge)
  })
})

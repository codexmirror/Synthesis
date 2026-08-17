import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as GameContext from '../../app/GameContext'
import { GameProvider, useGameActions, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import { appRegistry } from '../../shell/appRegistry'
import { advanceGameState, startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation } from '../../core/game/serviceAnalysis'
import type { GameState } from '../../core/game/types'
import { Network } from './Network'

async function openLanDevice() {
  const user = userEvent.setup()
  render(<GameProvider><Network /></GameProvider>)
  await user.click(screen.getByRole('button', { name: 'Scan network' }))
  await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
  return user
}

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

function StateSnapshot() { return <output data-testid="game-state">{JSON.stringify(useGameState())}</output> }
function ClearCompleted() { const actions = useGameActions(); return <button onClick={actions.clearCompletedProcesses}>Clear test history</button> }

async function navigateToServices(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Scan network' }))
  await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
}

describe('Scan workspace', () => {
  it('preserves the network registry identity while exposing Scan', () => {
    expect(appRegistry.network.label).toBe('Scan')
    expect(Object.keys(appRegistry)).toHaveLength(7)
  })

  it('discovers the local hierarchy from shared observations', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Network /></GameProvider>)
    expect(screen.getByText('home-net')).toBeInTheDocument()
    expect(screen.queryByText(/unavailable/i)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Scan network' }))
    expect(screen.getByText('2 responding')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.23')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    expect(screen.getByText('1 discovered')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'SSH' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'HTTP' })).toBeInTheDocument()
    expect(screen.getByText('22 / TCP')).toBeInTheDocument()
    expect(screen.getByText('80 / TCP')).toBeInTheDocument()
    expect(screen.getAllByText('ENDPOINT')).toHaveLength(2)
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/service-ssh-001|host-lan-001|vulnerability-ssh-001/)
  })

  it('copies device addresses and complete endpoints', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    const user = await openLanDevice()
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    await user.click(screen.getByRole('button', { name: 'Copy 198.51.100.47' }))
    await user.click(screen.getByRole('button', { name: 'Copy 198.51.100.47:22' }))
    expect(writeText).toHaveBeenNthCalledWith(1, '198.51.100.47')
    expect(writeText).toHaveBeenNthCalledWith(2, '198.51.100.47:22')
  })

  it('starts concrete analyses and presents canonical running state', async () => {
    const user = await openLanDevice()
    const analyze = screen.getAllByRole('button', { name: 'Analyze' })[0]
    await user.click(analyze)
    expect(screen.getByText('ANALYSIS RUNNING')).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Analyze' })).toHaveLength(1)
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
    await waitFor(() => expect(Number(screen.getByRole('progressbar').getAttribute('value'))).toBeGreaterThan(0), { timeout: 1500 })
  })

  it('binds Analyze to the observed endpoint and never silently retargets a stale card', async () => {
    let canonical = createInitialGameState()
    const endpointAction = vi.fn((observed: { endpoint: string; targetDeviceId: string; serviceId: string }) => {
      const result = startServiceAnalysisFromObservation(canonical, observed)
      if (result.status === 'started') canonical = result.state
      return result
    })
    vi.spyOn(GameContext, 'useGameState').mockImplementation(() => canonical)
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({
      startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: endpointAction, clearCompletedProcesses: vi.fn(),
    })
    const user = userEvent.setup(); const view = render(<Network />)
    await navigateToServices(user)
    const host = canonical.world.network.hosts[0]
    const movedServices = host.services?.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) ?? []
    canonical = {
      ...canonical,
      world: { network: { ...canonical.world.network, hosts: [{ ...host, services: [...movedServices, { id: 'service-replacement', name: 'REPLACEMENT', port: 22, protocol: 'TCP', open: true }] }, ...canonical.world.network.hosts.slice(1)] } },
      process: { nextId: 3, processes: [
        { kind: 'service_analysis', id: 'process-0001', label: 'SERVICE ANALYSIS', executorDeviceId: 'device-local-v0', status: 'running', workRequired: 1000, workCompleted: 400, ramRequiredMiB: 768, targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:2222' },
        { kind: 'service_analysis', id: 'process-0002', label: 'SERVICE ANALYSIS', executorDeviceId: 'device-local-v0', status: 'completed', workRequired: 1000, workCompleted: 1000, ramRequiredMiB: 768, targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:2222', result: { status: 'weaknesses_detected', vulnerabilities: [] } },
      ] },
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'known-ssh', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Historical SSH weakness' }] },
    }
    view.rerender(<Network />)
    expect(screen.queryByText('ANALYSIS RUNNING')).not.toBeInTheDocument()
    expect(screen.queryByText('LAST ANALYSIS')).not.toBeInTheDocument()
    expect(screen.getByText('Historical SSH weakness')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Analyze' })[0])
    expect(endpointAction).toHaveBeenCalledWith({ endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001' })
    expect(canonical.process.processes).toHaveLength(2)
    expect(screen.getByText('ENDPOINT NOT AVAILABLE')).toBeInTheDocument()
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(screen.queryByText('198.51.100.47:2222')).not.toBeInTheDocument()
  })

  it('runs SSH and HTTP concurrently through canonical Process state', async () => {
    const user = userEvent.setup()
    render(<GameProvider><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    const buttons = screen.getAllByRole('button', { name: 'Analyze' })
    await user.click(buttons[0]); await user.click(screen.getByRole('button', { name: 'Analyze' }))
    expect(screen.getAllByText('ANALYSIS RUNNING')).toHaveLength(2)
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.process.processes).toMatchObject([{ status: 'running', serviceId: 'service-ssh-001' }, { status: 'running', serviceId: 'service-http-001' }])
  })

  it('presents positive SSH Knowledge and precise historical HTTP completion', async () => {
    const base = createInitialGameState()
    const ssh = startServiceAnalysisAtEndpoint(base, '198.51.100.47:22'); if (ssh.status !== 'started') throw Error(ssh.status)
    const http = startServiceAnalysisAtEndpoint(ssh.state, '198.51.100.47:80'); if (http.status !== 'started') throw Error(http.status)
    const completed = advanceGameState(http.state, 30_000)
    const user = userEvent.setup()
    render(<GameProvider initialState={completed}><Network /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    expect(screen.getByText('No weakness detected')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\bSAFE\b|\bSECURE\b/)
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.knowledge.discoveredVulnerabilities.filter(({ serviceId }) => serviceId === 'service-http-001')).toEqual([])
    expect(screen.getAllByRole('button', { name: 'Analyze again' })).toHaveLength(2)
  })

  it('clears completed history without clearing Knowledge and permits monotonic re-analysis', async () => {
    const started = startServiceAnalysisAtEndpoint(createInitialGameState(), '198.51.100.47:22'); if (started.status !== 'started') throw Error(started.status)
    const completed = advanceGameState(started.state, 20_000)
    const user = userEvent.setup()
    render(<GameProvider initialState={completed}><Network /><ClearCompleted /><StateSnapshot /></GameProvider>)
    await navigateToServices(user)
    expect(screen.getByText('Weakness detected')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Clear test history' }))
    expect(screen.queryByText('Weakness detected')).not.toBeInTheDocument()
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Analyze' })[0])
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '') as GameState
    expect(state.process.processes[0]).toMatchObject({ id: 'process-0002', status: 'running', serviceId: 'service-ssh-001' })
  })

  it('uses retained Knowledge even if current vulnerability truth has changed', async () => {
    const base = createInitialGameState()
    const host = base.world.network.hosts.find((candidate) => candidate.ip === '198.51.100.47')!
    const ssh = host.services![0]
    const state = {
      ...base,
      world: { network: { ...base.world.network, hosts: base.world.network.hosts.map((candidate) => candidate.id === host.id ? { ...candidate, services: candidate.services?.map((service) => service.id === ssh.id ? { ...service, vulnerabilities: [] } : service) } : candidate) } },
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'historical', targetDeviceId: host.id, serviceId: ssh.id, observedLabel: 'Weak authentication configuration' }] },
    }
    const user = userEvent.setup()
    render(<GameProvider initialState={state}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Scan network' }))
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument()
  })

  it('reports canonical memory contention locally', async () => {
    const state = createInitialGameState()
    const constrained = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, ram: { ...state.player.localDevice.hardware.ram, capacityMiB: 700 } } } } }
    const user = userEvent.setup()
    render(<GameProvider initialState={constrained}><Network /></GameProvider>)
    await user.click(screen.getByRole('button', { name: 'Scan network' }))
    await user.click(screen.getByRole('button', { name: 'Scan device 198.51.100.47' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Analyze' })[0])
    expect(screen.getByText(/INSUFFICIENT MEMORY/)).toBeInTheDocument()
  })

  it('does not display stale start feedback beside canonical running state', async () => {
    const base = createInitialGameState()
    let canonical: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, hardware: { ...base.player.localDevice.hardware, ram: { ...base.player.localDevice.hardware.ram, capacityMiB: 700 } } } } }
    const endpointAction = vi.fn((observed: { endpoint: string; targetDeviceId: string; serviceId: string }) => startServiceAnalysisFromObservation(canonical, observed))
    vi.spyOn(GameContext, 'useGameState').mockImplementation(() => canonical)
    vi.spyOn(GameContext, 'useGameActions').mockReturnValue({ startServiceAnalysis: vi.fn(), startServiceAnalysisAtEndpoint: vi.fn(), startServiceAnalysisFromObservation: endpointAction, clearCompletedProcesses: vi.fn() })
    const user = userEvent.setup(); const view = render(<Network />)
    await navigateToServices(user)
    await user.click(screen.getAllByRole('button', { name: 'Analyze' })[0])
    expect(screen.getByText(/INSUFFICIENT MEMORY/)).toBeInTheDocument()
    const running = startServiceAnalysisAtEndpoint(base, '198.51.100.47:22'); if (running.status !== 'started') throw Error(running.status)
    canonical = running.state; view.rerender(<Network />)
    expect(screen.getByText('ANALYSIS RUNNING')).toBeInTheDocument()
    expect(screen.queryByText(/INSUFFICIENT MEMORY/)).not.toBeInTheDocument()
  })
})

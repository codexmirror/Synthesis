import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameState } from '../../app/GameContext'
import { createInitialGameState } from '../../core/game/initialState'
import type { GameState } from '../../core/game/types'
import { appEntries, appRegistry } from '../../shell/appRegistry'
import { Processes } from './Processes'
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

describe('Processes application integration', () => {
  it('is the seventh canonical app while Network remains registered', () => { expect(appEntries).toHaveLength(7); expect(appRegistry).toHaveProperty('processes'); expect(appRegistry).toHaveProperty('network') })
  it('renders a clear idle state without a history action', () => { render(<GameProvider><Processes /></GameProvider>); expect(screen.getByText('No active processes')).toBeInTheDocument(); expect(screen.getByText('18%')).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Clear completed processes' })).not.toBeInTheDocument() })
  it('separates active progress/allocation/RAM from retained completion', () => { render(<GameProvider initialState={withProcesses()}><Processes /></GameProvider>); expect(screen.getByText('25% complete')).toBeInTheDocument(); expect(screen.getByText('CPU 82%')).toBeInTheDocument(); expect(screen.getByText('RAM 512 MiB')).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Active' })).toBeInTheDocument(); expect(screen.getByRole('heading', { name: 'Completed' })).toBeInTheDocument(); expect(screen.getByText('Finished analysis')).toBeInTheDocument(); expect(screen.getByText('completed')).toBeInTheDocument() })
  it('advances at the provider boundary even when the app is not mounted', () => { vi.useFakeTimers(); const state = withProcesses(); function Snapshot() { const value = useGameState().process.processes[0].workCompleted; return <output>{value}</output> } render(<GameProvider initialState={state}><Snapshot /></GameProvider>); expect(screen.getByText('25')).toBeInTheDocument(); act(() => vi.advanceTimersByTime(500)); expect(Number(screen.getByRole('status').textContent)).toBeGreaterThan(25) })
  it('renders running Service Analysis historical target, progress, CPU, and RAM', () => {
    render(<GameProvider initialState={runningAnalysis()}><Processes /></GameProvider>)
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument()
    expect(screen.getByText('25% complete')).toBeInTheDocument()
    expect(screen.getByText('CPU 82%')).toBeInTheDocument()
    expect(screen.getByText('RAM 768 MiB')).toBeInTheDocument()
  })
  it('renders every concrete completed result', () => {
    const weakness = render(<GameProvider initialState={completedAnalysis()}><Processes /></GameProvider>)
    expect(screen.getByText('WEAKNESS DETECTED')).toBeInTheDocument(); expect(screen.getByText('Weak authentication configuration')).toBeInTheDocument(); weakness.unmount()
    const none = render(<GameProvider initialState={completedAnalysis('service-http-001')}><Processes /></GameProvider>)
    expect(screen.getByText('NO WEAKNESS DETECTED')).toBeInTheDocument(); none.unmount()
    const running = runningAnalysis(); const host = running.world.network.hosts[0]
    const unavailable = advanceGameState({ ...running, world: { network: { ...running.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, open: false } : service) }, ...running.world.network.hosts.slice(1)] } } }, 20_000)
    render(<GameProvider initialState={unavailable}><Processes /></GameProvider>); expect(screen.getByText('SERVICE UNAVAILABLE')).toBeInTheDocument()
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
    expect(screen.queryByRole('heading', { name: 'Completed' })).not.toBeInTheDocument()
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
  it('does not rewrite the historical target when the current service port changes', () => {
    const completed = completedAnalysis(); const host = completed.world.network.hosts[0]
    const moved: GameState = { ...completed, world: { network: { ...completed.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) }, ...completed.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={moved}><Processes /></GameProvider>)
    expect(screen.getByText('198.51.100.47:22')).toBeInTheDocument(); expect(screen.queryByText('198.51.100.47:2222')).not.toBeInTheDocument()
  })
})

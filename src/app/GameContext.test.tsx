import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GameProvider, useGameActions, useGameState } from './GameContext'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState } from '../core/game/types'

afterEach(() => vi.useRealTimers())

function ActionHarness({ onRender }: { onRender?: () => void }) {
  const actions = useGameActions(); const state = useGameState()
  onRender?.()
  return <><button onClick={() => {
    const results = [actions.startServiceAnalysis('host-lan-001', 'service-ssh-001'), actions.startServiceAnalysis('host-lan-001', 'service-http-001')]
    document.body.dataset.results = results.map(({ status }) => status).join(',')
  }}>start</button><output>{JSON.stringify(state.process)}</output></>
}

function ClearHarness({ onRender }: { onRender?: () => void }) {
  const actions = useGameActions(); const state = useGameState()
  onRender?.()
  return <><button onClick={actions.clearCompletedProcesses}>clear</button><output>{JSON.stringify(state)}</output></>
}

function RemoveHarness({ processId }: { processId: string }) {
  const actions = useGameActions(); const state = useGameState()
  return <><button onClick={() => actions.removeCompletedProcess(processId)}>remove</button><output>{JSON.stringify(state)}</output></>
}

function EndpointHarness() {
  const actions = useGameActions(); const state = useGameState()
  return <><button onClick={() => { document.body.dataset.endpointResult = actions.startServiceAnalysisAtEndpoint('198.51.100.47:22').status }}>old</button><button onClick={() => { document.body.dataset.endpointResult = actions.startServiceAnalysisAtEndpoint('198.51.100.47:2222').status }}>current</button><button onClick={() => { document.body.dataset.endpointResult = actions.startServiceAnalysisAtEndpoint('invalid').status }}>invalid</button><button onClick={() => { document.body.dataset.endpointResult = actions.startServiceAnalysisFromObservation({ endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001' }).status }}>observed old SSH</button><output>{JSON.stringify(state.process)}</output></>
}

describe('GameProvider service-analysis actions', () => {
  it('does not create analysis Processes when NodeScan is absent', () => {
    const base = createInitialGameState()
    const withoutNodeScan: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, installedSoftware: base.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    render(<GameProvider initialState={withoutNodeScan}><ActionHarness /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(document.body.dataset.results).toBe('software_unavailable,software_unavailable')
    expect(JSON.parse(screen.getByRole('status').textContent ?? '').processes).toEqual([])
  })

  it('preserves target unavailability when NodeScan is installed', () => {
    const base = createInitialGameState()
    const host = base.world.network.hosts[0]
    const offline: GameState = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, online: false }, ...base.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={offline}><ActionHarness /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    expect(document.body.dataset.results).toBe('unavailable,unavailable')
    expect(JSON.parse(screen.getByRole('status').textContent ?? '').processes).toEqual([])
  })
  it('keeps the asynchronous Scan operation identity stable across state updates', () => {
    const operations: unknown[] = []
    function ScanIdentityHarness() {
      const actions = useGameActions()
      operations.push(actions.scanTarget)
      return <button onClick={() => actions.startServiceAnalysis('host-lan-001', 'service-ssh-001')}>update</button>
    }
    render(<GameProvider><ScanIdentityHarness /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'update' }))
    expect(operations).toHaveLength(2)
    expect(operations[1]).toBe(operations[0])
  })

  it('atomically resolves player-visible endpoints against the latest world state', () => {
    const base = createInitialGameState(); const host = base.world.network.hosts[0]
    const services = host.services?.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) ?? []
    const moved: GameState = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, services: [...services, { id: 'replacement', name: 'OTHER', port: 22, protocol: 'TCP', open: true }] }, ...base.world.network.hosts.slice(1)] } } }
    render(<GameProvider initialState={moved}><EndpointHarness /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'observed old SSH' }))
    expect(document.body.dataset.endpointResult).toBe('endpoint_not_found')
    expect(JSON.parse(screen.getByRole('status').textContent ?? '').processes).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'invalid' }))
    expect(document.body.dataset.endpointResult).toBe('invalid_endpoint')
    fireEvent.click(screen.getByRole('button', { name: 'current' }))
    expect(document.body.dataset.endpointResult).toBe('started')
    expect(JSON.parse(screen.getByRole('status').textContent ?? '').processes[0]).toMatchObject({ targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:2222' })
  })
  it('atomically retains two concrete back-to-back starts', () => {
    let renders = 0
    render(<GameProvider><ActionHarness onRender={() => { renders += 1 }} /></GameProvider>); fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(process.processes.map(({ serviceId }: { serviceId: string }) => serviceId)).toEqual(['service-ssh-001', 'service-http-001'])
    expect(process.processes.map(({ id }: { id: string }) => id)).toEqual(['process-0001', 'process-0002'])
    expect(process.processes.map(({ ramRequiredMiB }: { ramRequiredMiB: number }) => ramRequiredMiB)).toEqual([768, 768])
    expect(process.processes.every(({ executorDeviceId }: { executorDeviceId: string }) => executorDeviceId === 'device-local-v0')).toBe(true)
    expect(process.nextId).toBe(3)
    expect(document.body.dataset.results).toBe('started,started')
    expect(renders).toBe(2)
  })
  it('applies the first reservation before rejecting an immediate second start without consuming an ID', () => {
    const base = createInitialGameState()
    const constrained: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, hardware: { ...base.player.localDevice.hardware, ram: { ...base.player.localDevice.hardware.ram, capacityMiB: 1800 } } } } }
    let renders = 0
    render(<GameProvider initialState={constrained}><ActionHarness onRender={() => { renders += 1 }} /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'start' }))
    const process = JSON.parse(screen.getByRole('status').textContent ?? '')
    expect(document.body.dataset.results).toBe('started,insufficient_memory')
    expect(process).toMatchObject({ nextId: 2, processes: [{ id: 'process-0001', serviceId: 'service-ssh-001', executorDeviceId: 'device-local-v0', ramRequiredMiB: 768 }] })
    expect(process.processes).toHaveLength(1)
    expect(renders).toBe(2)
  })
  it('does not rerender consumers during repeated idle scheduler ticks', () => {
    vi.useFakeTimers(); let renders = 0
    function Counter() { useGameState(); renders += 1; return null }
    render(<GameProvider><Counter /></GameProvider>); expect(renders).toBe(1); act(() => vi.advanceTimersByTime(2000)); expect(renders).toBe(1)
  })
  it('clears only completed history and preserves canonical consequences and next ID', () => {
    const base = createInitialGameState()
    const completed = { kind: 'generic' as const, id: 'process-0012', label: 'Done', executorDeviceId: 'device-local-v0', status: 'completed' as const, workRequired: 1, workCompleted: 1, ramRequiredMiB: 10 }
    const running = { ...completed, id: 'process-0013', label: 'Running', status: 'running' as const, workCompleted: 0 }
    const initial: GameState = { ...base, process: { nextId: 14, processes: [completed, running] }, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'vulnerability-ssh-001', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Weak authentication configuration' }] } }
    render(<GameProvider initialState={initial}><ClearHarness /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    const state = JSON.parse(screen.getByRole('status').textContent ?? '') as GameState
    expect(state.process).toMatchObject({ nextId: 14, processes: [{ id: 'process-0013', status: 'running' }] })
    expect(state.knowledge).toEqual(initial.knowledge)
    expect(state.world).toEqual(initial.world)
    expect(state.player).toEqual(initial.player)
    expect(state.wallet).toEqual(initial.wallet)
  })
  it('keeps completed remote history when NODE-OS clears local history', () => {
    const base = createInitialGameState()
    const local = { kind: 'generic' as const, id: 'process-local', label: 'Local', executorDeviceId: base.player.localDevice.id, status: 'completed' as const, workRequired: 1, workCompleted: 1, ramRequiredMiB: 1 }
    const remote = { ...local, id: 'process-remote', label: 'Remote', executorDeviceId: 'host-lan-001' }
    render(<GameProvider initialState={{ ...base, process: { nextId: 3, processes: [local, remote] } }}><ClearHarness /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    expect((JSON.parse(screen.getByRole('status').textContent ?? '') as GameState).process.processes).toEqual([remote])
  })
  it('refuses to remove completed history owned by a remote executor', () => {
    const base = createInitialGameState()
    const remote = { kind: 'generic' as const, id: 'process-remote', label: 'Remote', executorDeviceId: 'host-lan-001', status: 'completed' as const, workRequired: 1, workCompleted: 1, ramRequiredMiB: 1 }
    render(<GameProvider initialState={{ ...base, process: { nextId: 2, processes: [remote] } }}><RemoveHarness processId={remote.id} /></GameProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'remove' }))
    expect((JSON.parse(screen.getByRole('status').textContent ?? '') as GameState).process.processes).toEqual([remote])
  })
  it('does not rerender consumers when there is no completed history', () => {
    let renders = 0
    render(<GameProvider><ClearHarness onRender={() => { renders += 1 }} /></GameProvider>)
    expect(renders).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'clear' }))
    expect(renders).toBe(1)
  })
})

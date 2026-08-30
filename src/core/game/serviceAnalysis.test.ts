import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { SERVICE_ANALYSIS_RAM_REQUIRED_MIB, startServiceAnalysis, startServiceAnalysisAtEndpoint, startServiceAnalysisFromObservation } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { cancelLocalProcess, clearCompletedProcesses, deriveResourceUsage } from './processes'
import type { GameProcess, ServiceAnalysisProcess } from './types'
import { scanNetworkTarget } from './scan'
import { inspectKnownTarget } from './inspect'
import { rememberInspect, rememberScan } from './discovery'

// @ts-expect-error Service Analysis cannot omit its stable target identity or historical display target.
const invalidAnalysisProcess: ServiceAnalysisProcess = { kind: 'service_analysis' }
void invalidAnalysisProcess

const start = (state = createInitialGameState(), serviceId = 'service-ssh-001') => startServiceAnalysis(state, 'host-lan-001', serviceId)
const started = (serviceId = 'service-ssh-001') => { const result = start(createInitialGameState(), serviceId); if (result.status !== 'started') throw Error(result.status); return result.state }
const analysis = (process: GameProcess): ServiceAnalysisProcess => { if (process.kind !== 'service_analysis') throw Error('expected service analysis'); return process }

function withRememberedSshImplementation(version: string) {
  const base = createInitialGameState()
  const host = base.world.network.hosts[0]
  const services = host.services!.map((service) => service.id === 'service-ssh-001'
    ? { ...service, implementation: { ...service.implementation, releaseId: `gate-ssh-${version}`, version } }
    : service)
  const state = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, services }, ...base.world.network.hosts.slice(1)] } } }
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  let discovery = rememberScan(state.discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  discovery = rememberInspect(discovery, inspectKnownTarget(targets, discovery, '198.51.100.47', 'enhanced'), state.player.localDevice.id)
  return { ...state, discovery }
}

describe('Service Analysis', () => {
  it('cancels partial analysis without completion consequences and permits a fresh admission', () => {
    const partial = advanceGameState(started(), 3000)
    const process = analysis(partial.process.processes[0])
    const result = cancelLocalProcess(partial, process.id)
    expect(result.status).toBe('cancelled')
    const muchLater = advanceGameState(result.state, 60_000)
    expect(muchLater.process.processes).toEqual([])
    expect(muchLater.knowledge.discoveredVulnerabilities).toEqual([])
    expect(muchLater.recentActivity.entries[0]).toMatchObject({ termination: 'cancelled', process: { id: process.id, workCompleted: process.workCompleted } })
    const restarted = start(muchLater)
    expect(restarted).toMatchObject({ status: 'started', processId: 'process-0002' })
  })
  it('resolves endpoint syntax to stable process identity and rejects duplicates', () => {
    const first = startServiceAnalysisAtEndpoint(createInitialGameState(), '198.51.100.47:22'); expect(first.status).toBe('started')
    if (first.status !== 'started') return
    expect(first.state.process.processes[0]).toMatchObject({ kind: 'service_analysis', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:22', executorDeviceId: 'device-local-v0' })
    expect(start(first.state).status).toBe('already_running'); expect(start(first.state, 'service-http-001').status).toBe('started')
    expect(startServiceAnalysisAtEndpoint(first.state, '198.51.100.47')).toMatchObject({ status: 'invalid_endpoint' })
    expect(startServiceAnalysisAtEndpoint(first.state, '198.51.100.47:81')).toMatchObject({ status: 'endpoint_not_found' })
  })
  it('rejects an observed endpoint when another service reuses it', () => {
    const base = createInitialGameState(); const host = base.world.network.hosts[0]
    const services = host.services?.map((service) => service.id === 'service-ssh-001' ? { ...service, port: 2222 } : service) ?? []
    const changed = { ...base, world: { network: { ...base.world.network, hosts: [{ ...host, services: [...services, { id: 'replacement', name: 'OTHER', port: 22, protocol: 'TCP' as const, open: true, implementation: { productId: 'other', releaseId: 'other-1.0', buildId: 'build-fixture-v0', name: 'Other', version: '1.0' } }] }, ...base.world.network.hosts.slice(1)] } } }
    const result = startServiceAnalysisFromObservation(changed, { endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001' })
    expect(result.status).toBe('endpoint_not_found')
    expect(result.state).toBe(changed)
    expect(result.state.process.processes).toEqual([])
  })
  it('uses real shared CPU and cumulative RAM', () => {
    const one = started(); const second = start(one, 'service-http-001'); if (second.status !== 'started') throw Error(second.status)
    const oneUsage = deriveResourceUsage(one.player.localDevice, one.process)
    const twoUsage = deriveResourceUsage(second.state.player.localDevice, second.state.process)
    expect(oneUsage.cpuAllocationByProcess['process-0001']).toBe(82); expect(twoUsage.cpuAllocationByProcess['process-0001']).toBe(41)
    expect(twoUsage.processRamMiB).toBe(SERVICE_ANALYSIS_RAM_REQUIRED_MIB * 2)
    const first = advanceGameState(one, 1000).process.processes[0]
    const secondProcess = advanceGameState(second.state, 1000).process.processes[0]
    if (first.kind === 'node_miner' || secondProcess.kind === 'node_miner') throw new Error('unexpected node_miner process')
    expect(first.workCompleted).toBeGreaterThan(secondProcess.workCompleted)
    const constrained = { ...createInitialGameState(), player: { ...createInitialGameState().player, localDevice: { ...createInitialGameState().player.localDevice, hardware: { ...createInitialGameState().player.localDevice.hardware, ram: { ...createInitialGameState().player.localDevice.hardware.ram, capacityMiB: 990 } } } } }
    expect(startServiceAnalysis(constrained, 'host-lan-001', 'service-ssh-001')).toMatchObject({ status: 'insufficient_memory' })
  })
  it('resolves exactly once, adds positive knowledge once, and allows re-analysis', () => {
    const done = advanceGameState(started(), 20_000); const process = done.process.processes[0]
    expect(process).toMatchObject({ status: 'completed', workCompleted: 1000, result: { status: 'weaknesses_detected' } })
    expect(done.knowledge.discoveredVulnerabilities).toEqual([{ vulnerabilityId: 'AUTH-017', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Weak authentication configuration' }])
    expect(advanceGameState(done, 20_000)).toBe(done)
    const again = start(done); expect(again.status).toBe('started'); if (again.status !== 'started') return
    const twice = advanceGameState(again.state, 20_000); expect(twice.knowledge.discoveredVulnerabilities).toHaveLength(1)
    expect(analysis(twice.process.processes[0]).result).toBe(analysis(process).result)
  })
  it('allows re-analysis after history is cleared while retained knowledge does not bypass the running duplicate guard', () => {
    const done = advanceGameState(started(), 20_000)
    const cleared = { ...done, process: clearCompletedProcesses(done.process, done.player.localDevice.id) }
    expect(cleared.process.processes).toEqual([])
    expect(cleared.knowledge).toBe(done.knowledge)
    const again = start(cleared); expect(again.status).toBe('started')
    if (again.status !== 'started') return
    expect(again.processId).toBe('process-0002')
    expect(start(again.state).status).toBe('already_running')
  })
  it('reads current vulnerability truth only at completion and retains historical knowledge', () => {
    const running = started(); const host = running.world.network.hosts[0]; const service = host.services![0]
    const changed = { ...running, world: { network: { ...running.world.network, hosts: [{ ...host, services: [{ ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } }, ...host.services!.slice(1)] }, ...running.world.network.hosts.slice(1)] } } }
    const done = advanceGameState(changed, 20_000); expect(analysis(done.process.processes[0]).result).toEqual({ status: 'no_weakness_detected' }); expect(done.knowledge.discoveredVulnerabilities).toEqual([])
    const discovered = advanceGameState(started(), 20_000)
    const removed = { ...discovered, world: changed.world }; expect(removed.knowledge).toEqual(discovered.knowledge)
  })
  it('associates results at completion only when remembered evidence matches the implementation actually resolved', () => {
    const observed133 = withRememberedSshImplementation('1.3.3')
    const admitted = start(observed133)
    expect(admitted.status).toBe('started'); if (admitted.status !== 'started') return
    expect(analysis(admitted.state.process.processes[0]).analyzedImplementation).toBeUndefined()

    const host = admitted.state.world.network.hosts[0]
    const services = host.services!.map((service) => service.id === 'service-ssh-001'
      ? { ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.3.2', version: '1.3.2' } }
      : service)
    const changedWhileRunning = { ...admitted.state, world: { network: { ...admitted.state.world.network, hosts: [{ ...host, services }, ...admitted.state.world.network.hosts.slice(1)] } } }
    const completed = advanceGameState(changedWhileRunning, 20_000)

    expect(analysis(completed.process.processes[0])).toMatchObject({ result: { status: 'weaknesses_detected' } })
    expect(analysis(completed.process.processes[0]).analyzedImplementation).toBeUndefined()
    expect(completed.knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ vulnerabilityId: 'AUTH-017' }))

    const fresh132 = withRememberedSshImplementation('1.3.2')
    const freshStarted = start(fresh132); expect(freshStarted.status).toBe('started'); if (freshStarted.status !== 'started') return
    const freshCompleted = advanceGameState(freshStarted.state, 20_000)
    expect(analysis(freshCompleted.process.processes[0]).analyzedImplementation).toEqual({ name: 'GateSSH', version: '1.3.2' })
  })
  it('reports unavailable from current truth, while stable identity survives a port change', () => {
    const running = started(); const host = running.world.network.hosts[0]; const service = host.services![0]
    const closed = { ...running, world: { network: { ...running.world.network, hosts: [{ ...host, services: [{ ...service, open: false }, ...host.services!.slice(1)] }, ...running.world.network.hosts.slice(1)] } } }
    expect(analysis(advanceGameState(closed, 20_000).process.processes[0]).result).toEqual({ status: 'service_unavailable' })
    const moved = { ...running, world: { network: { ...running.world.network, hosts: [{ ...host, services: [{ ...service, port: 2222 }, ...host.services!.slice(1)] }, ...running.world.network.hosts.slice(1)] } } }
    expect(advanceGameState(moved, 20_000).process.processes[0]).toMatchObject({ serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:22', result: { status: 'weaknesses_detected' } })
    expect(scanNetworkTarget({ localDevice: moved.player.localDevice, network: moved.world.network }, '198.51.100.47')).toMatchObject({ services: expect.arrayContaining([expect.objectContaining({ id: 'service-ssh-001', port: 2222 })]) })
  })
  it('HTTP detects zero weaknesses without negative knowledge', () => {
    const done = advanceGameState(started('service-http-001'), 20_000); expect(analysis(done.process.processes[0]).result).toEqual({ status: 'no_weakness_detected' }); expect(done.knowledge.discoveredVulnerabilities).toEqual([])
  })
})

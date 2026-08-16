import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { advanceGameState, SERVICE_ANALYSIS_RAM_REQUIRED_MIB, startServiceAnalysis, startServiceAnalysisAtEndpoint } from './serviceAnalysis'
import { deriveResourceUsage } from './processes'
import type { GameProcess, ServiceAnalysisProcess } from './types'
import { scanNetworkTarget } from './scan'

// @ts-expect-error Service Analysis cannot omit its stable target identity or historical display target.
const invalidAnalysisProcess: ServiceAnalysisProcess = { kind: 'service_analysis' }
void invalidAnalysisProcess

const start = (state = createInitialGameState(), serviceId = 'service-ssh-001') => startServiceAnalysis(state, 'host-lan-001', serviceId)
const started = (serviceId = 'service-ssh-001') => { const result = start(createInitialGameState(), serviceId); if (result.status !== 'started') throw Error(result.status); return result.state }
const analysis = (process: GameProcess): ServiceAnalysisProcess => { if (process.kind !== 'service_analysis') throw Error('expected service analysis'); return process }

describe('Service Analysis', () => {
  it('resolves endpoint syntax to stable process identity and rejects duplicates', () => {
    const first = startServiceAnalysisAtEndpoint(createInitialGameState(), '198.51.100.47:22'); expect(first.status).toBe('started')
    if (first.status !== 'started') return
    expect(first.state.process.processes[0]).toMatchObject({ kind: 'service_analysis', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', startedEndpoint: '198.51.100.47:22', executorDeviceId: 'device-local-v0' })
    expect(start(first.state).status).toBe('already_running'); expect(start(first.state, 'service-http-001').status).toBe('started')
    expect(startServiceAnalysisAtEndpoint(first.state, '198.51.100.47')).toMatchObject({ status: 'invalid_endpoint' })
    expect(startServiceAnalysisAtEndpoint(first.state, '198.51.100.47:81')).toMatchObject({ status: 'endpoint_not_found' })
  })
  it('uses real shared CPU and cumulative RAM', () => {
    const one = started(); const second = start(one, 'service-http-001'); if (second.status !== 'started') throw Error(second.status)
    const oneUsage = deriveResourceUsage(one.player.localDevice.hardware, one.player.localDevice.runtime, one.process)
    const twoUsage = deriveResourceUsage(second.state.player.localDevice.hardware, second.state.player.localDevice.runtime, second.state.process)
    expect(oneUsage.cpuAllocationByProcess['process-0001']).toBe(82); expect(twoUsage.cpuAllocationByProcess['process-0001']).toBe(41)
    expect(twoUsage.processRamMiB).toBe(SERVICE_ANALYSIS_RAM_REQUIRED_MIB * 2)
    expect(advanceGameState(one, 1000).process.processes[0].workCompleted).toBeGreaterThan(advanceGameState(second.state, 1000).process.processes[0].workCompleted)
    const constrained = { ...createInitialGameState(), player: { ...createInitialGameState().player, localDevice: { ...createInitialGameState().player.localDevice, hardware: { ...createInitialGameState().player.localDevice.hardware, ram: { ...createInitialGameState().player.localDevice.hardware.ram, capacityMiB: 990 } } } } }
    expect(startServiceAnalysis(constrained, 'host-lan-001', 'service-ssh-001')).toMatchObject({ status: 'insufficient_memory' })
  })
  it('resolves exactly once, adds positive knowledge once, and allows re-analysis', () => {
    const done = advanceGameState(started(), 20_000); const process = done.process.processes[0]
    expect(process).toMatchObject({ status: 'completed', workCompleted: 1000, result: { status: 'weaknesses_detected' } })
    expect(done.knowledge.discoveredVulnerabilities).toEqual([{ vulnerabilityId: 'vulnerability-ssh-001', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Weak authentication configuration' }])
    expect(advanceGameState(done, 20_000)).toBe(done)
    const again = start(done); expect(again.status).toBe('started'); if (again.status !== 'started') return
    const twice = advanceGameState(again.state, 20_000); expect(twice.knowledge.discoveredVulnerabilities).toHaveLength(1)
    expect(analysis(twice.process.processes[0]).result).toBe(analysis(process).result)
  })
  it('reads current vulnerability truth only at completion and retains historical knowledge', () => {
    const running = started(); const host = running.world.network.hosts[0]; const service = host.services![0]
    const changed = { ...running, world: { network: { ...running.world.network, hosts: [{ ...host, services: [{ ...service, vulnerabilities: [] }, ...host.services!.slice(1)] }, ...running.world.network.hosts.slice(1)] } } }
    const done = advanceGameState(changed, 20_000); expect(analysis(done.process.processes[0]).result).toEqual({ status: 'no_weakness_detected' }); expect(done.knowledge.discoveredVulnerabilities).toEqual([])
    const discovered = advanceGameState(started(), 20_000)
    const removed = { ...discovered, world: changed.world }; expect(removed.knowledge).toEqual(discovered.knowledge)
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

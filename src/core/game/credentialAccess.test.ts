import { describe, expect, it } from 'vitest'
import { rememberScan } from './discovery'
import { createInitialGameState } from './initialState'
import { cancelLocalProcess, clearCompletedProcesses, deriveResourceUsage, removeCompletedProcess } from './processes'
import { scanNetworkTarget } from './scan'
import { startServiceAnalysis } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { canFormCredentialAccessAttempt, CREDENTIAL_ACCESS_RAM_REQUIRED_MIB, CREDENTIAL_ACCESS_WORK_REQUIRED, resolveCompletedCredentialAccess, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import { connectRemoteFromObservation, disconnectRemoteSession } from './remoteSession'
import type { CredentialAccessProcess, GameState } from './types'

const observation = { endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', vulnerabilityId: 'AUTH-017' } as const

function prepared(): GameState {
  let state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  const discovery = rememberScan(state.discovery, scanNetworkTarget(targets, '198.51.100.47'), state.player.localDevice.id)
  const analysis = startServiceAnalysis({ ...state, discovery }, observation.targetDeviceId, observation.serviceId)
  if (analysis.status !== 'started') throw Error(analysis.status)
  return advanceGameState(analysis.state, 20_000)
}

function start(state = prepared()) {
  const result = startCredentialAccessAttemptFromObservation(state, observation)
  if (result.status !== 'started') throw Error(result.status)
  return result.state
}

function changeService(state: GameState, change: (service: NonNullable<GameState['world']['network']['hosts'][number]['services']>[number]) => NonNullable<GameState['world']['network']['hosts'][number]['services']>[number]): GameState {
  const host = state.world.network.hosts[0]
  return { ...state, world: { network: { ...state.world.network, hosts: [{ ...host, services: host.services!.map((service) => service.id === observation.serviceId ? change(service) : service) }, ...state.world.network.hosts.slice(1)] } } }
}

describe('Initial credential access', () => {
  it.each([
    [0.749999, 'access_established', 'SUCCESS'],
    [0.75, 'attempt_failed', 'FAILURE'],
  ] as const)('gives KeyProbe its one canonical 75%% boundary decision (%s)', (roll, status, evidence) => {
    const started = startCredentialAccessAttemptFromObservation(prepared(), { ...observation, providerId: 'keyprobe' })
    if (started.status !== 'started') throw Error(started.status)
    let rolls = 0
    const done = advanceGameState(started.state, 30_000, () => { rolls += 1; return roll })
    expect(rolls).toBe(1)
    expect(done.process.processes.find((process): process is CredentialAccessProcess => process.kind === 'credential_access')?.result?.status).toBe(status)
    expect(done.deviceAccess.established).toHaveLength(status === 'access_established' ? 1 : 0)
    expect(done.world.network.hosts[0].authenticationHistory?.records.at(-1)?.result).toBe(evidence)
    expect(advanceGameState(done, 30_000, () => { throw Error('must not reroll') })).toBe(done)
  })

  it('does not roll KeyProbe when current World Truth no longer supplies a reachable valid surface', () => {
    const started = startCredentialAccessAttemptFromObservation(prepared(), { ...observation, providerId: 'keyprobe' })
    if (started.status !== 'started') throw Error(started.status)
    const closed = changeService(started.state, (service) => ({ ...service, open: false }))
    const done = advanceGameState(closed, 30_000, () => { throw Error('must validate reachability before probability') })
    expect(done.process.processes.find((process): process is CredentialAccessProcess => process.kind === 'credential_access')?.result?.status).toBe('attempt_failed')
    expect(done.deviceAccess.established).toEqual([])
    expect(done.world.network.hosts[0].authenticationHistory?.records).toEqual([])
  })
  it('cancels a partial attempt without access, authentication trace, or later resolution', () => {
    const partial = advanceGameState(start(), 3000)
    const process = partial.process.processes.find(({ kind }) => kind === 'credential_access')!
    const accessNextId = partial.deviceAccess.nextId
    const targetHistory = partial.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory
    const result = cancelLocalProcess(partial, process.id)
    expect(result.status).toBe('cancelled')
    const muchLater = advanceGameState(result.state, 60_000)
    expect(muchLater.deviceAccess).toEqual({ nextId: accessNextId, established: [] })
    expect(muchLater.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory).toEqual(targetHistory)
    expect(muchLater.process.processes.filter(({ kind }) => kind === 'credential_access')).toEqual([])
    expect(muchLater.recentActivity.entries.at(-1)).toMatchObject({ termination: 'cancelled', process: { id: process.id } })
  })
  it('forms only from remembered service, known weakness, and SELF-owned concrete tooling', () => {
    const state = prepared()
    expect(canFormCredentialAccessAttempt(state, observation)).toBe(true)
    expect(canFormCredentialAccessAttempt({ ...state, knowledge: { discoveredVulnerabilities: [] } }, observation)).toBe(false)
    expect(startCredentialAccessAttemptFromObservation({ ...state, knowledge: { discoveredVulnerabilities: [] } }, observation).status).toBe('not_available')
    const noTool = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [], filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.filter(({ kind }) => kind !== 'software_module') } } } }
    expect(canFormCredentialAccessAttempt(noTool, observation)).toBe(false)
    expect(startCredentialAccessAttemptFromObservation(noTool, observation).status).toBe('not_available')
    const unrelated = { ...observation, vulnerabilityId: 'UNRELATED-001' }
    const unrelatedKnown = { ...state, knowledge: { discoveredVulnerabilities: [{ ...state.knowledge.discoveredVulnerabilities[0], vulnerabilityId: unrelated.vulnerabilityId }] } }
    expect(canFormCredentialAccessAttempt(unrelatedKnown, unrelated)).toBe(false)

    const standardOnly = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: { ...state.player.localDevice.filesystem, files: state.player.localDevice.filesystem.files.filter(({ kind }) => kind !== 'software_module') } } } }
    expect(canFormCredentialAccessAttempt(standardOnly, { ...observation, providerId: 'keyprobe' })).toBe(true)
    expect(canFormCredentialAccessAttempt(standardOnly, observation)).toBe(false)
  })

  it('does not consult secretly changed weakness truth for known feasibility or start admission', () => {
    const patched = changeService(prepared(), (service) => ({ ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } }))
    expect(canFormCredentialAccessAttempt(patched, observation)).toBe(true)
    expect(startCredentialAccessAttemptFromObservation(patched, observation).status).toBe('started')
  })

  it('starts one distinguishable local Process with stable target facts and real resources', () => {
    const running = start(); const process = running.process.processes.at(-1)!
    expect(process).toMatchObject({ kind: 'credential_access', executorDeviceId: running.player.localDevice.id, targetDeviceId: observation.targetDeviceId, serviceId: observation.serviceId, startedEndpoint: observation.endpoint, workRequired: CREDENTIAL_ACCESS_WORK_REQUIRED, workCompleted: 0, ramRequiredMiB: CREDENTIAL_ACCESS_RAM_REQUIRED_MIB })
    expect(running.deviceAccess.established).toEqual([])
    expect(deriveResourceUsage(running.player.localDevice, running.process).processRamMiB).toBe(CREDENTIAL_ACCESS_RAM_REQUIRED_MIB)
    expect(startCredentialAccessAttemptFromObservation(running, observation).status).toBe('already_running')
  })

  it('uses RAM admission and shares scheduler CPU with Service Analysis', () => {
    const state = prepared()
    const constrained = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, hardware: { ...state.player.localDevice.hardware, ram: { ...state.player.localDevice.hardware.ram, capacityMiB: 1000 } } } } }
    expect(startCredentialAccessAttemptFromObservation(constrained, observation).status).toBe('insufficient_memory')
    expect(constrained.process.processes.filter(({ status }) => status === 'running')).toHaveLength(0)
    const credential = start(state)
    const analysis = startServiceAnalysis(credential, observation.targetDeviceId, observation.serviceId)
    if (analysis.status !== 'started') throw Error(analysis.status)
    const usage = deriveResourceUsage(analysis.state.player.localDevice, analysis.state.process)
    expect(Object.values(usage.cpuAllocationByProcess)).toEqual([41, 41])
    const advanced = advanceGameState(analysis.state, 1000)
    expect(advanced.process.processes.find((process): process is CredentialAccessProcess => process.kind === 'credential_access')?.workCompleted).toBe(41)
  })

  it('resolves success once, derives USER from current auth context, and prevents duplicate access', () => {
    const before = start(); const discovery = before.discovery; const knowledge = before.knowledge
    const done = advanceGameState(before, 30_000)
    expect(done.deviceAccess.established).toEqual([{ id: 'access-0001', sourceDeviceId: 'device-local-v0', targetDeviceId: observation.targetDeviceId, viaServiceId: observation.serviceId, viaServiceBuildId: 'build-gate-ssh-1.3.2-v0', viaVulnerabilityId: 'AUTH-017', privilege: 'USER' }])
    expect(done.process.processes.at(-1)).toMatchObject({ status: 'completed', result: { status: 'access_established', accessId: 'access-0001' } })
    expect(done.discovery).toBe(discovery); expect(done.knowledge).toBe(knowledge)

    const target = done.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records).toEqual([{ id: 'auth-0001', serviceId: observation.serviceId, serviceName: 'SSH', sourceAddress: done.player.localDevice.network.ip, result: 'SUCCESS' }])

    // Repeated advancement resolves the completed Process at most once and must never duplicate the history entry.
    const advancedAgain = advanceGameState(done, 30_000)
    expect(advancedAgain).toBe(done)
    expect(advancedAgain.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory?.records).toHaveLength(1)

    expect(startCredentialAccessAttemptFromObservation(done, observation).status).toBe('access_established')
    expect(canFormCredentialAccessAttempt(done, observation)).toBe(false)
  })

  it('appends a FAILURE record, and creates no DeviceAccess, when the Service is reached but its weakness is gone', () => {
    const started = startCredentialAccessAttemptFromObservation(prepared(), { ...observation, providerId: 'keyprobe' })
    if (started.status !== 'started') throw Error(started.status)
    const running = started.state; const discovery = running.discovery; const knowledge = running.knowledge
    const done = advanceGameState(changeService(running, (service) => ({ ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } })), 30_000, () => { throw Error('must validate the weakness before probability') })
    expect(done.deviceAccess.established).toEqual([])
    expect(done.process.processes.at(-1)).toMatchObject({ result: { status: 'attempt_failed', message: 'Authentication attempt failed.' }, startedEndpoint: observation.endpoint })
    expect(done.discovery).toBe(discovery); expect(done.knowledge).toBe(knowledge)
    const target = done.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records).toEqual([{ id: 'auth-0001', serviceId: observation.serviceId, serviceName: 'SSH', sourceAddress: done.player.localDevice.network.ip, result: 'FAILURE' }])
    expect(done.world.network.localNetworks.find(({ id }) => id === 'network-local-001')?.activityHistory.records).toContainEqual(expect.objectContaining({ kind: 'connection_attempt', serviceId: observation.serviceId, result: 'FAILURE' }))
  })

  it.each([
    ['closed service', (state: GameState) => changeService(state, (service) => ({ ...service, open: false }))],
    ['reused endpoint', (state: GameState) => changeService(state, (service) => ({ ...service, port: 2222 }))],
  ])('creates no authentication history when the target was never reached (%s)', (_name, mutate) => {
    const running = start(); const discovery = running.discovery; const knowledge = running.knowledge
    const done = advanceGameState(mutate(running), 30_000)
    expect(done.deviceAccess.established).toEqual([])
    expect(done.process.processes.at(-1)).toMatchObject({ result: { status: 'attempt_failed', message: 'Authentication attempt failed.' }, startedEndpoint: observation.endpoint })
    expect(done.discovery).toBe(discovery); expect(done.knowledge).toBe(knowledge)
    const target = done.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records ?? []).toEqual([])
  })

  describe('Network connection-attempt evidence', () => {
    // host-lan-001 (the target) and device-local-v0 (the executor) both belong to home-net.
    it('appends one internal Network record alongside the existing SUCCESS Device history for a same-Network attempt', () => {
      const done = advanceGameState(start(), 30_000)
      const homeNet = done.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
      expect(homeNet?.activityHistory.records).toEqual([{
        id: 'net-activity-0001', kind: 'connection_attempt', perspective: 'internal',
        sourceDeviceId: 'device-local-v0', targetDeviceId: observation.targetDeviceId,
        sourceAddress: done.player.localDevice.network.ip, targetAddress: '198.51.100.47',
        serviceId: observation.serviceId, serviceName: 'SSH', result: 'SUCCESS',
      }])
      const otherNet = done.world.network.localNetworks.find(({ id }) => id === 'network-foreign-001')
      expect(otherNet?.activityHistory.records).toEqual([])
    })

    it('appends one internal Network record with FAILURE for a reached, failed attempt', () => {
      const running = start()
      const done = advanceGameState(changeService(running, (service) => ({ ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } })), 30_000)
      const homeNet = done.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
      expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ kind: 'connection_attempt', result: 'FAILURE' })])
    })

    it.each([
      ['closed service', (state: GameState) => changeService(state, (service) => ({ ...service, open: false }))],
      ['reused endpoint', (state: GameState) => changeService(state, (service) => ({ ...service, port: 2222 }))],
    ])('creates no Network evidence when the target was never reached (%s)', (_name, mutate) => {
      const running = start()
      const done = advanceGameState(mutate(running), 30_000)
      for (const network of done.world.network.localNetworks) expect(network.activityHistory.records).toEqual([])
    })

    it('never stores Player, toolkit, or vulnerability identity on the Network record', () => {
      const done = advanceGameState(start(), 30_000)
      const record = done.world.network.localNetworks.find(({ id }) => id === 'network-local-001')?.activityHistory.records[0]
      expect(record).not.toHaveProperty('toolId')
      expect(record).not.toHaveProperty('vulnerabilityId')
      expect(record).not.toHaveProperty('playerId')
    })

    it('appends distinct source-side (home-net) and destination-side (remote-segment-01) Network records for a cross-Network attempt reaching srv-02', () => {
      const running = start()
      const runningProcess = running.process.processes.at(-1) as CredentialAccessProcess
      // srv-02 is patched for AUTH-017, so this reaches the represented target/service and legitimately resolves FAILURE.
      const crossProcess: CredentialAccessProcess = { ...runningProcess, status: 'completed', targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002', startedEndpoint: '203.0.113.42:22' }
      const resolved = resolveCompletedCredentialAccess(running, crossProcess)
      expect(resolved.process.result).toEqual({ status: 'attempt_failed', message: 'Authentication attempt failed.' })
      const homeNet = resolved.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
      const foreignNet = resolved.world.network.localNetworks.find(({ id }) => id === 'network-foreign-001')
      expect(homeNet?.activityHistory.records).toEqual([expect.objectContaining({ perspective: 'outbound', targetDeviceId: 'host-lan-002', sourceDeviceId: running.player.localDevice.id, result: 'FAILURE' })])
      expect(foreignNet?.activityHistory.records).toEqual([expect.objectContaining({ perspective: 'inbound', targetDeviceId: 'host-lan-002', result: 'FAILURE' })])
    })
  })

  it('keeps DeviceAccess, Discovery, Knowledge, and authentication history when completed Process history is cleared', () => {
    const done = advanceGameState(start(), 30_000)
    const cleared = { ...done, process: clearCompletedProcesses(done.process, done.player.localDevice.id) }
    expect(cleared.process.processes).toEqual([])
    expect(cleared.deviceAccess).toBe(done.deviceAccess)
    expect(cleared.discovery).toBe(done.discovery)
    expect(cleared.knowledge).toBe(done.knowledge)
    expect(cleared.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory?.records).toHaveLength(1)
  })

  it("does not rewrite an existing record's fictional source-address snapshot when the executor Device's address later changes", () => {
    const done = advanceGameState(start(), 30_000)
    const movedSource = { ...done, player: { ...done.player, localDevice: { ...done.player.localDevice, network: { ...done.player.localDevice.network, ip: '203.0.113.9' } } } }
    const target = movedSource.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records[0]?.sourceAddress).toBe('198.51.100.23')
  })

  it('never fabricates another Device\'s address as source provenance when the Process executor identity is unresolvable', () => {
    const running = start()
    const runningProcess = running.process.processes.at(-1) as CredentialAccessProcess
    const staleProcess: CredentialAccessProcess = { ...runningProcess, status: 'completed', executorDeviceId: 'device-ghost-executor' }
    const resolved = resolveCompletedCredentialAccess(running, staleProcess)

    // The impossible/stale executor identity does not stop the represented authentication outcome itself from resolving...
    expect(resolved.process.result).toEqual({ status: 'access_established', accessId: 'access-0001' })
    // ...but it must not fabricate a source address, so no history record is appended at all.
    const target = resolved.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records ?? []).toEqual([])
  })

  it("keeps an existing Authentication History record's serviceName and sourceAddress snapshots unchanged across disconnect, Process cleanup, DeviceAccess changes, and later mutable presentation/Service-name changes", () => {
    const done = advanceGameState(start(), 30_000)
    const originalRecord = done.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory?.records[0]
    expect(originalRecord).toEqual({ id: 'auth-0001', serviceId: observation.serviceId, serviceName: 'SSH', sourceAddress: '198.51.100.23', result: 'SUCCESS' })
    const recordAfter = (state: GameState) => state.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory?.records[0]

    // RemoteSession connect, then disconnect.
    const connected = connectRemoteFromObservation(done, { targetDeviceId: observation.targetDeviceId, address: '198.51.100.47' })
    if (connected.status !== 'connected') throw new Error(connected.status)
    const disconnected = disconnectRemoteSession(connected.state).state
    expect(recordAfter(disconnected)).toEqual(originalRecord)

    // Removing the one completed credential_access Process that produced the record.
    const completedProcessId = done.process.processes.at(-1)!.id
    const processRemoved = { ...done, process: removeCompletedProcess(done.process, completedProcessId, done.player.localDevice.id) }
    expect(processRemoved.process.processes.some(({ id }) => id === completedProcessId)).toBe(false)
    expect(recordAfter(processRemoved)).toEqual(originalRecord)

    // Clearing completed Process history.
    const cleared = { ...done, process: clearCompletedProcesses(done.process, done.player.localDevice.id) }
    expect(recordAfter(cleared)).toEqual(originalRecord)

    // DeviceAccess later removed.
    const accessRemoved = { ...done, deviceAccess: { nextId: 1, established: [] } }
    expect(recordAfter(accessRemoved)).toEqual(originalRecord)

    // Target Device's mutable presentation (display name, address) changes.
    const renamedTarget: GameState = { ...done, world: { network: { ...done.world.network, hosts: done.world.network.hosts.map((host) => host.id === observation.targetDeviceId ? { ...host, displayName: 'renamed-server', ip: '192.0.2.77' } : host) } } }
    expect(recordAfter(renamedTarget)).toEqual(originalRecord)

    // The represented Service's own name changes after the event.
    const renamedService = changeService(done, (service) => ({ ...service, name: 'SSH-RENAMED' }))
    expect(recordAfter(renamedService)).toEqual(originalRecord)
  })
})

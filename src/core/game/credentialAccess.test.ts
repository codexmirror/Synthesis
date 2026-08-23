import { describe, expect, it } from 'vitest'
import { rememberScan } from './discovery'
import { createInitialGameState } from './initialState'
import { clearCompletedProcesses, deriveResourceUsage } from './processes'
import { scanNetworkTarget } from './scan'
import { startServiceAnalysis } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { BASIC_CREDENTIAL_TOOLKIT_ID, canFormCredentialAccessAttempt, CREDENTIAL_ACCESS_RAM_REQUIRED_MIB, CREDENTIAL_ACCESS_WORK_REQUIRED, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import type { GameState } from './types'

const observation = { endpoint: '198.51.100.47:22', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', vulnerabilityId: 'vulnerability-ssh-001', toolId: BASIC_CREDENTIAL_TOOLKIT_ID }

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
  it('forms only from remembered service, known weakness, and SELF-owned concrete tooling', () => {
    const state = prepared()
    expect(canFormCredentialAccessAttempt(state, observation)).toBe(true)
    expect(canFormCredentialAccessAttempt({ ...state, knowledge: { discoveredVulnerabilities: [] } }, observation)).toBe(false)
    expect(startCredentialAccessAttemptFromObservation({ ...state, knowledge: { discoveredVulnerabilities: [] } }, observation).status).toBe('not_available')
    const noTool = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [] } } }
    expect(canFormCredentialAccessAttempt(noTool, observation)).toBe(false)
    expect(startCredentialAccessAttemptFromObservation(noTool, observation).status).toBe('not_available')
  })

  it('does not consult secretly changed weakness truth for known feasibility or start admission', () => {
    const patched = changeService(prepared(), (service) => ({ ...service, vulnerabilities: [] }))
    expect(canFormCredentialAccessAttempt(patched, observation)).toBe(true)
    expect(startCredentialAccessAttemptFromObservation(patched, observation).status).toBe('started')
  })

  it('starts one distinguishable local Process with stable target facts and real resources', () => {
    const running = start(); const process = running.process.processes.at(-1)!
    expect(process).toMatchObject({ kind: 'credential_access', executorDeviceId: running.player.localDevice.id, targetDeviceId: observation.targetDeviceId, serviceId: observation.serviceId, startedEndpoint: observation.endpoint, workRequired: CREDENTIAL_ACCESS_WORK_REQUIRED, workCompleted: 0, ramRequiredMiB: CREDENTIAL_ACCESS_RAM_REQUIRED_MIB })
    expect(running.deviceAccess.established).toEqual([])
    expect(deriveResourceUsage(running.player.localDevice.hardware, running.player.localDevice.runtime, running.process).processRamMiB).toBe(CREDENTIAL_ACCESS_RAM_REQUIRED_MIB)
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
    const usage = deriveResourceUsage(analysis.state.player.localDevice.hardware, analysis.state.player.localDevice.runtime, analysis.state.process)
    expect(Object.values(usage.cpuAllocationByProcess)).toEqual([41, 41])
    const advanced = advanceGameState(analysis.state, 1000)
    expect(advanced.process.processes.find(({ kind }) => kind === 'credential_access')?.workCompleted).toBe(41)
  })

  it('resolves success once, derives USER from current auth context, and prevents duplicate access', () => {
    const before = start(); const discovery = before.discovery; const knowledge = before.knowledge
    const done = advanceGameState(before, 30_000)
    expect(done.deviceAccess.established).toEqual([{ id: 'access-0001', sourceDeviceId: 'device-local-v0', targetDeviceId: observation.targetDeviceId, viaServiceId: observation.serviceId, privilege: 'USER' }])
    expect(done.process.processes.at(-1)).toMatchObject({ status: 'completed', result: { status: 'access_established', accessId: 'access-0001' } })
    expect(done.discovery).toBe(discovery); expect(done.knowledge).toBe(knowledge)
    expect(advanceGameState(done, 30_000)).toBe(done)
    expect(startCredentialAccessAttemptFromObservation(done, observation).status).toBe('access_established')
    expect(canFormCredentialAccessAttempt(done, observation)).toBe(false)
  })

  it.each([
    ['removed weakness', (state: GameState) => changeService(state, (service) => ({ ...service, vulnerabilities: [] }))],
    ['closed service', (state: GameState) => changeService(state, (service) => ({ ...service, open: false }))],
    ['reused endpoint', (state: GameState) => changeService(state, (service) => ({ ...service, port: 2222 }))],
  ])('fails non-omnisciently against current truth when %s while retaining history', (_name, mutate) => {
    const running = start(); const discovery = running.discovery; const knowledge = running.knowledge
    const done = advanceGameState(mutate(running), 30_000)
    expect(done.deviceAccess.established).toEqual([])
    expect(done.process.processes.at(-1)).toMatchObject({ result: { status: 'attempt_failed', message: 'Target no longer responds as expected.' }, startedEndpoint: observation.endpoint })
    expect(done.discovery).toBe(discovery); expect(done.knowledge).toBe(knowledge)
  })

  it('keeps DeviceAccess, Discovery, and Knowledge when completed Process history is cleared', () => {
    const done = advanceGameState(start(), 30_000)
    const cleared = { ...done, process: clearCompletedProcesses(done.process) }
    expect(cleared.process.processes).toEqual([])
    expect(cleared.deviceAccess).toBe(done.deviceAccess)
    expect(cleared.discovery).toBe(done.discovery)
    expect(cleared.knowledge).toBe(done.knowledge)
  })
})

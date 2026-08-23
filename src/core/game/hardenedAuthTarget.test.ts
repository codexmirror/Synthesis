import { describe, expect, it } from 'vitest'
import { rememberScan } from './discovery'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget } from './scan'
import { startServiceAnalysis } from './serviceAnalysis'
import { advanceGameState } from './gameAdvancement'
import { BASIC_CREDENTIAL_TOOLKIT_ID, canFormCredentialAccessAttempt, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import type { CredentialAccessProcess, GameState } from './types'

/**
 * Hardened target proof: srv-02's SSH service (`service-ssh-002`) owns the
 * same real Weak Authentication vulnerability as srv-01, but its
 * `credentialAccess` also carries `secondFactorRequired: true` -- a concrete
 * authentication condition the Basic Credential Toolkit's exploit cannot
 * satisfy. "The weakness is known" must not mean "access follows".
 */
const observation = { endpoint: '198.51.100.53:22', targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002', vulnerabilityId: 'vulnerability-ssh-002', toolId: BASIC_CREDENTIAL_TOOLKIT_ID }

function prepared(): GameState {
  let state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  const discovery = rememberScan(state.discovery, scanNetworkTarget(targets, '198.51.100.53'), state.player.localDevice.id)
  const analysis = startServiceAnalysis({ ...state, discovery }, observation.targetDeviceId, observation.serviceId)
  if (analysis.status !== 'started') throw Error(analysis.status)
  return advanceGameState(analysis.state, 20_000)
}

function start(state = prepared()) {
  const result = startCredentialAccessAttemptFromObservation(state, observation)
  if (result.status !== 'started') throw Error(result.status)
  return result.state
}

/** Removes the represented second factor from srv-02's SSH service in a test fixture, leaving the same vulnerability and credential-access context otherwise intact. */
function withoutSecondFactor(state: GameState): GameState {
  const host = state.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)!
  return {
    ...state,
    world: {
      network: {
        ...state.world.network,
        hosts: state.world.network.hosts.map((candidate) => candidate.id !== host.id ? candidate : {
          ...host,
          services: host.services!.map((service) => service.id !== observation.serviceId ? service : { ...service, credentialAccess: { privilege: 'USER' as const } }),
        }),
      },
    },
  }
}

describe('Hardened Authentication Target (srv-02 / host-lan-002)', () => {
  it('still exposes and discovers the real weak-authentication vulnerability via Service Analysis', () => {
    const state = prepared()
    const analyzed = state.process.processes.at(-1)
    expect(analyzed).toMatchObject({ kind: 'service_analysis', status: 'completed', result: { status: 'weaknesses_detected', vulnerabilities: [{ vulnerabilityId: 'vulnerability-ssh-002', observedLabel: 'Weak authentication configuration' }] } })
    expect(state.knowledge.discoveredVulnerabilities).toEqual([
      { vulnerabilityId: 'vulnerability-ssh-002', observedLabel: 'Weak authentication configuration', targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002' },
    ])
  })

  it('lets the Basic Credential Toolkit attempt start normally once the weakness is known -- second factor is not checked at start', () => {
    const state = prepared()
    expect(canFormCredentialAccessAttempt(state, observation)).toBe(true)
    const result = startCredentialAccessAttemptFromObservation(state, observation)
    expect(result.status).toBe('started')
  })

  it('consumes normal Process work and CPU/RAM while running, and resolves only once completed', () => {
    const running = start()
    const process = running.process.processes.at(-1) as CredentialAccessProcess
    expect(process).toMatchObject({ kind: 'credential_access', status: 'running', workCompleted: 0, targetDeviceId: observation.targetDeviceId, serviceId: observation.serviceId })
    expect(running.deviceAccess.established).toEqual([])

    // Part-way through: real work has accumulated, but nothing has resolved yet.
    const midway = advanceGameState(running, 1000)
    const midwayProcess = midway.process.processes.at(-1) as CredentialAccessProcess
    expect(midwayProcess.status).toBe('running')
    expect(midwayProcess.workCompleted).toBeGreaterThan(0)
    expect(midwayProcess.result).toBeUndefined()
    expect(midway.deviceAccess.established).toEqual([])
    const midwayTarget = midway.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(midwayTarget?.authenticationHistory?.records ?? []).toEqual([])

    // Only completion resolves the attempt against current World Truth.
    const done = advanceGameState(midway, 30_000)
    expect(done.process.processes.at(-1)).toMatchObject({ status: 'completed', result: { status: 'attempt_failed' } })
  })

  it('produces no DeviceAccess, because the second factor still blocks the technique after the weakness is known', () => {
    const done = advanceGameState(start(), 30_000)
    expect(done.deviceAccess.established).toEqual([])
  })

  it('appends exactly one FAILURE Authentication History record with the real executor source address, never duplicated by repeated advancement', () => {
    const running = start()
    const done = advanceGameState(running, 30_000)
    const target = done.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records).toEqual([
      { id: 'auth-0001', serviceId: observation.serviceId, serviceName: 'SSH', sourceAddress: done.player.localDevice.network.ip, result: 'FAILURE' },
    ])

    const advancedAgain = advanceGameState(done, 30_000)
    expect(advancedAgain).toBe(done)
    expect(advancedAgain.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)?.authenticationHistory?.records).toHaveLength(1)
  })

  it('does not reveal the hidden second-factor condition in the player-facing failure result', () => {
    const done = advanceGameState(start(), 30_000)
    const result = (done.process.processes.at(-1) as CredentialAccessProcess).result
    expect(result).toEqual({ status: 'attempt_failed', message: 'Authentication attempt failed.' })
    const presented = JSON.stringify(result).toLowerCase()
    expect(presented).not.toContain('mfa')
    expect(presented).not.toContain('second factor')
    expect(presented).not.toContain('2fa')
    expect(presented).not.toContain('multi-factor')
    expect(presented).not.toContain('multifactor')
  })

  it('lets the same otherwise-valid technique succeed once the represented second factor is removed from World Truth', () => {
    const state = withoutSecondFactor(prepared())
    const started = startCredentialAccessAttemptFromObservation(state, observation)
    if (started.status !== 'started') throw new Error(started.status)
    const done = advanceGameState(started.state, 30_000)

    expect(done.process.processes.at(-1)).toMatchObject({ status: 'completed', result: { status: 'access_established' } })
    expect(done.deviceAccess.established).toEqual([
      { id: 'access-0001', sourceDeviceId: done.player.localDevice.id, targetDeviceId: observation.targetDeviceId, viaServiceId: observation.serviceId, privilege: 'USER' },
    ])
    const target = done.world.network.hosts.find(({ id }) => id === observation.targetDeviceId)
    expect(target?.authenticationHistory?.records).toEqual([
      { id: 'auth-0001', serviceId: observation.serviceId, serviceName: 'SSH', sourceAddress: done.player.localDevice.network.ip, result: 'SUCCESS' },
    ])
  })
})

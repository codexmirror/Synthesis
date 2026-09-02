import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { vulnerabilitiesForService } from './serviceImplementations'
import { rememberInspect, rememberScan } from './discovery'
import { scanNetworkTarget } from './scan'
import { inspectKnownTarget } from './inspect'
import { advanceGameState } from './gameAdvancement'
import { startServiceAnalysis } from './serviceAnalysis'
import { ownedCredentialAccessProviders, startCredentialAccessAttemptFromObservation } from './credentialAccess'
import type { CredentialAccessProcess, GameState } from './types'
import { AUTH_GUARD_PRODUCT_ID } from './authGuard'
import { deriveSoftwarePackageEligibility } from './softwareInstallation'

const observation = { endpoint: '203.0.113.42:22', targetDeviceId: 'host-lan-002', serviceId: 'service-ssh-002', vulnerabilityId: 'AUTH-031', providerId: 'keyprobe' } as const

function learned(): GameState {
  let state = createInitialGameState()
  const targets = { localDevice: state.player.localDevice, network: state.world.network }
  const discovery = rememberScan(state.discovery, scanNetworkTarget(targets, '203.0.113.42'), state.player.localDevice.id)
  const analysis = startServiceAnalysis({ ...state, discovery }, observation.targetDeviceId, observation.serviceId)
  if (analysis.status !== 'started') throw Error(analysis.status)
  return advanceGameState(analysis.state, 20_000)
}

function resolve(state: GameState, roll: number) {
  const started = startCredentialAccessAttemptFromObservation(state, observation)
  if (started.status !== 'started') throw Error(started.status)
  let draws = 0
  const done = advanceGameState(started.state, 30_000, () => { draws++; return roll })
  return { draws, result: (done.process.processes.at(-1) as CredentialAccessProcess).result?.status }
}

describe('AuthGuard 1.0 concrete credential composition', () => {
  it('derives release-owned weaknesses and keeps AuthGuard separate', () => {
    const state = createInitialGameState()
    const one = state.world.network.hosts[0].services![0]
    const two = state.world.network.hosts[1].services![0]
    expect(vulnerabilitiesForService(one).map(({ id }) => id)).toEqual(['AUTH-017'])
    expect(vulnerabilitiesForService(two).map(({ id }) => id)).toEqual(['AUTH-031'])
    expect(state.world.network.hosts[1].installedSoftware?.some(({ id }) => id === AUTH_GUARD_PRODUCT_ID)).toBe(true)
    expect(state.world.network.hosts[1].filesystem?.files).toContainEqual(expect.objectContaining({ kind: 'software_package', productId: AUTH_GUARD_PRODUCT_ID }))
    expect(learned().knowledge.discoveredVulnerabilities).toContainEqual(expect.objectContaining({ vulnerabilityId: 'AUTH-031' }))
  })

  it('forms AUTH-031 only through KeyProbe and resolves protected 5% with one draw', () => {
    const state = learned()
    expect(ownedCredentialAccessProviders(state, 'AUTH-031')).toEqual([{ id: 'keyprobe', name: 'KeyProbe' }])
    expect(resolve(state, 0.049999)).toEqual({ draws: 1, result: 'access_established' })
    expect(resolve(state, 0.05)).toEqual({ draws: 1, result: 'attempt_failed' })
  })

  it('resolves the unprotected exact composition at 50%', () => {
    const state = learned()
    const hosts = state.world.network.hosts.map((host) => host.id === observation.targetDeviceId ? { ...host, installedSoftware: host.installedSoftware?.filter(({ id }) => id !== AUTH_GUARD_PRODUCT_ID) } : host)
    const unprotected = { ...state, world: { network: { ...state.world.network, hosts } } }
    expect(resolve(unprotected, 0.499999).result).toBe('access_established')
    expect(resolve(unprotected, 0.5).result).toBe('attempt_failed')
  })

  it('stores Inspect evidence as a stale snapshot and refreshes compatibility', () => {
    const state = learned(); const targets = { localDevice: state.player.localDevice, network: state.world.network }
    const observed = rememberInspect(state.discovery, inspectKnownTarget(targets, state.discovery, '203.0.113.42', 'enhanced'), state.player.localDevice.id)
    expect(observed.devices.find(({ id }) => id === observation.targetDeviceId)?.inspect?.enhanced?.authGuard?.compatibility).toBe('SUPPORTED')
    const hosts = state.world.network.hosts.map((host) => host.id !== observation.targetDeviceId ? host : { ...host, services: host.services!.map((service) => service.id !== observation.serviceId ? service : { ...service, implementation: { ...service.implementation, releaseId: 'gate-ssh-1.3.2', buildId: 'build-gate-ssh-1.3.2-v0', version: '1.3.2' } }) })
    expect(observed.devices.find(({ id }) => id === observation.targetDeviceId)?.inspect?.enhanced?.authGuard?.compatibility).toBe('SUPPORTED')
    const changedTargets = { ...targets, network: { ...targets.network, hosts } }
    const refreshed = rememberInspect(observed, inspectKnownTarget(changedTargets, observed, '203.0.113.42', 'enhanced'), state.player.localDevice.id)
    expect(refreshed.devices.find(({ id }) => id === observation.targetDeviceId)?.inspect?.enhanced?.authGuard).toMatchObject({ protectedImplementation: 'GateSSH 1.3.2', compatibility: 'UNSUPPORTED' })
  })

  it('admits the package only for RACK-OS', () => {
    const state = createInitialGameState(); const host = state.world.network.hosts[1]
    const file = host.filesystem!.files.find((candidate) => candidate.kind === 'software_package' && candidate.productId === AUTH_GUARD_PRODUCT_ID)!
    expect(deriveSoftwarePackageEligibility(file as never, { ...host, installedSoftware: [] } as never, state.process).status).toBe('installable')
    expect(deriveSoftwarePackageEligibility(file as never, state.player.localDevice, state.process)).toEqual({ status: 'incompatible', requiredFirmware: 'RACK-OS' })
  })
})

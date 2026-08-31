import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation, disconnectRemoteSession, resolveActiveRemoteTarget } from './remoteSession'
import { interruptLocalNetworkConnectivity } from './networkConnectivity'
import { advanceGameState } from './gameAdvancement'
import type { GameState } from './types'

const observation = { targetDeviceId: 'host-lan-001', address: '198.51.100.47' }
function accessed(): GameState {
  const state = createInitialGameState()
  return { ...state, discovery: { ...state.discovery, devices: [{ id: observation.targetDeviceId, address: observation.address, scope: 'lan', servicesObserved: true, services: [] }] }, deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: state.player.localDevice.id, targetDeviceId: observation.targetDeviceId, viaServiceId: 'service-ssh-001', privilege: 'USER' }] } }
}

describe('remote session lifecycle', () => {
  it('resolves the active target through stable access identity rather than the connected address', () => {
    const connected = connectRemoteFromObservation(accessed(), observation).state
    const altered = { ...connected, remoteSession: { ...connected.remoteSession, active: { ...connected.remoteSession.active!, connectedAddress: '192.0.2.10' } }, world: { network: { ...connected.world.network, hosts: connected.world.network.hosts.map((host) => host.id === observation.targetDeviceId ? { ...host, ip: '192.0.2.99', displayName: 'altered-server' } : host) } } }
    expect(resolveActiveRemoteTarget(altered)).toMatchObject({ target: { id: observation.targetDeviceId, ip: '192.0.2.99', displayName: 'altered-server' }, access: { id: 'access-0001' } })
    expect(resolveActiveRemoteTarget({ ...altered, remoteSession: { ...altered.remoteSession, active: null } })).toBeUndefined()
  })
  it('creates a minimal session through established DeviceAccess without mutating access', () => {
    const state = accessed(); const result = connectRemoteFromObservation(state, observation)
    expect(result.status).toBe('connected')
    expect(result.state.remoteSession).toEqual({ nextId: 2, active: { id: 'session-0001', accessId: 'access-0001', connectedAddress: observation.address } })
    expect(Object.keys(result.state.remoteSession.active!)).toEqual(['id', 'accessId', 'connectedAddress'])
    expect(result.state.deviceAccess).toBe(state.deviceAccess)
  })

  it('requires access even when knowledge and tools exist', () => {
    const state = createInitialGameState()
    expect(connectRemoteFromObservation({ ...state, knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-017', targetDeviceId: observation.targetDeviceId, serviceId: 'service-ssh-001', observedLabel: 'known' }] } }, observation).status).toBe('access_required')
  })

  it('does not rerun the original exploit after access is established', () => {
    const state = accessed(); const host = state.world.network.hosts[0]
    const withoutVulnerability = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: [] } }, knowledge: { discoveredVulnerabilities: [] }, world: { network: { ...state.world.network, hosts: [{ ...host, services: host.services?.map((service) => ({ ...service, implementation: { productId: 'gate-ssh', releaseId: 'gate-ssh-1.4.0', buildId: 'build-fixture-v0', name: 'GateSSH', version: '1.4.0' } })) }, ...state.world.network.hosts.slice(1)] } } }
    expect(connectRemoteFromObservation(withoutVulnerability, observation).status).toBe('connected')
  })

  it.each([
    [(state: GameState) => ({ ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } } } }), observation],
    [(state: GameState) => ({ ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === observation.targetDeviceId ? { ...host, operational: { lifecycle: 'RUNNING' as const, connectivity: 'DISCONNECTED' as const } } : host) } } }), observation],
    [(state: GameState) => state, { ...observation, address: '192.0.2.80' }],
    [(state: GameState) => ({ ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === observation.targetDeviceId ? { ...host, services: host.services?.map((service) => ({ ...service, open: false })) } : host) } } }), observation],
  ] as const)('returns the same coarse result for unavailable current paths', (alter, requested) => {
    expect(connectRemoteFromObservation(alter(accessed()), requested).status).toBe('target_not_available')
  })

  it('is idempotent for the same target and conflicts without replacing another session', () => {
    const connected = connectRemoteFromObservation(accessed(), observation).state
    expect(connectRemoteFromObservation(connected, observation)).toEqual({ status: 'already_connected', state: connected })
    expect(connectRemoteFromObservation(connected, { targetDeviceId: 'other', address: '203.0.113.1' })).toEqual({ status: 'session_active', state: connected })
  })

  it('disconnects only the session and reconnects with the next identity', () => {
    const base = accessed(); const connected = connectRemoteFromObservation(base, observation).state
    const disconnected = disconnectRemoteSession(connected)
    expect(disconnected.status).toBe('disconnected'); expect(disconnected.state.remoteSession).toEqual({ nextId: 2, active: null })
    expect({ ...disconnected.state, remoteSession: base.remoteSession }).toEqual(base)
    expect(connectRemoteFromObservation(disconnected.state, observation).state.remoteSession.active?.id).toBe('session-0002')
    expect(disconnectRemoteSession(base)).toEqual({ status: 'not_connected', state: base })
  })

  it('ends the Session once its target alone is no longer network-usable, without touching the DeviceAccess it was built on', () => {
    const connected = connectRemoteFromObservation(accessed(), observation).state
    const disconnectedTarget: GameState = { ...connected, world: { ...connected.world, network: { ...connected.world.network, hosts: connected.world.network.hosts.map((host) => host.id === observation.targetDeviceId ? { ...host, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } } : host) } } }
    const advanced = advanceGameState(disconnectedTarget, 100)
    expect(advanced.remoteSession.active).toBeNull()
    expect(advanced.deviceAccess).toEqual(connected.deviceAccess)
  })

  it('ends the Session once its local source alone is no longer network-usable, without touching the DeviceAccess it was built on', () => {
    const connected = connectRemoteFromObservation(accessed(), observation).state
    const disconnectedSource: GameState = { ...connected, player: { ...connected.player, localDevice: { ...connected.player.localDevice, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } } } }
    const advanced = advanceGameState(disconnectedSource, 100)
    expect(advanced.remoteSession.active).toBeNull()
    expect(advanced.deviceAccess).toEqual(connected.deviceAccess)
  })

  it('leaves an active Session alone while both endpoints remain network-usable', () => {
    const connected = connectRemoteFromObservation(accessed(), observation).state
    const advanced = advanceGameState(connected, 100)
    expect(advanced.remoteSession.active).toEqual(connected.remoteSession.active)
  })

  it('does not let a Session outlive an interruption that fully recovers within one large advancement step', () => {
    const base = createInitialGameState()
    const withPhoneAccess: GameState = {
      ...base,
      discovery: { ...base.discovery, devices: [{ id: 'host-phone-001', address: '198.51.100.61', scope: 'remote', servicesObserved: true, services: [] }] },
      deviceAccess: { nextId: 2, established: [{ id: 'access-phone-0001', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-phone-001', viaServiceId: 'service-ssh-003', privilege: 'USER' }] },
    }
    const connected = connectRemoteFromObservation(withPhoneAccess, { targetDeviceId: 'host-phone-001', address: '198.51.100.61' }).state
    expect(connected.remoteSession.active).not.toBeNull()

    const interrupted = interruptLocalNetworkConnectivity(connected, 'network-foreign-001')
    // One large step, comfortably covering Petra's full RECONNECT cycle in a single advanceGameState call.
    const advanced = advanceGameState(interrupted, 30_000)

    expect(advanced.world.network.hosts.find(({ id }) => id === 'host-phone-001')?.operational).toEqual({ lifecycle: 'RUNNING', connectivity: 'CONNECTED' })
    expect(advanced.remoteSession.active).toBeNull()
    expect(advanced.deviceAccess).toEqual(connected.deviceAccess)
  })
})

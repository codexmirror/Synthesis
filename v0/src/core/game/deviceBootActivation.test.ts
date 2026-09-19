import { describe, expect, it } from 'vitest'
import { activatePendingGateSshAtDeviceBoot } from './deviceBootActivation'
import { createInitialGameState } from './initialState'
import { GATE_SSH_1_3_2_BUILD_ID, vulnerabilitiesForService } from './serviceImplementations'
import type { GameState, NetworkHost } from './types'

const DEVICE_ID = 'host-lan-002'
const PENDING = {
  id: 'gate-ssh', releaseId: 'gate-ssh-1.3.2', buildId: GATE_SSH_1_3_2_BUILD_ID,
  name: 'GateSSH', version: '1.3.2', channel: 'stable', publisher: 'rack-systems',
} as const

function withPending(state = createInitialGameState()): GameState {
  return {
    ...state,
    world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === DEVICE_ID ? { ...host, pendingGateSshActivation: PENDING } : host) } },
    rackUpdate: { ...state.rackUpdate, submission: { ...state.rackUpdate.submission, outcome: { targetDeviceId: DEVICE_ID, serviceId: 'service-rack-update-002', result: 'package_accepted_reboot_required' } } },
  }
}

function target(state: GameState): NetworkHost {
  return state.world.network.hosts.find(({ id }) => id === DEVICE_ID)!
}

describe('Device boot pending GateSSH activation', () => {
  it('atomically activates exact pending installation and Service provenance, clears pending and retires the stale outcome', () => {
    const before = withPending()
    const beforeTarget = target(before)
    const after = activatePendingGateSshAtDeviceBoot(before, DEVICE_ID)
    const afterTarget = target(after)
    const installed = afterTarget.installedSoftware!.find(({ id }) => id === 'gate-ssh')!
    const ssh = afterTarget.services!.find(({ id }) => id === 'service-ssh-002')!

    expect(beforeTarget.installedSoftware!.find(({ id }) => id === 'gate-ssh')!.releaseId).toBe('gate-ssh-1.3.3')
    expect(beforeTarget.services!.find(({ id }) => id === 'service-ssh-002')!.implementation.releaseId).toBe('gate-ssh-1.3.3')
    expect(installed).toEqual(PENDING)
    expect(ssh.implementation).toEqual({ productId: PENDING.id, releaseId: PENDING.releaseId, buildId: PENDING.buildId, name: PENDING.name, version: PENDING.version })
    expect(afterTarget.pendingGateSshActivation).toBeUndefined()
    expect(after.rackUpdate.submission.outcome).toBeNull()
    expect(vulnerabilitiesForService(ssh)).toEqual([{ id: 'AUTH-017', label: 'Weak authentication configuration' }])
  })

  it('does not refresh player information or mutate unrelated canonical state', () => {
    const before = withPending()
    const after = activatePendingGateSshAtDeviceBoot(before, DEVICE_ID)
    expect(after.discovery).toBe(before.discovery)
    expect(after.knowledge).toBe(before.knowledge)
    expect(after.deviceAccess).toBe(before.deviceAccess)
    expect(after.remoteSession).toBe(before.remoteSession)
    expect(after.networkManagement).toBe(before.networkManagement)
    expect(after.player).toBe(before.player)
    expect(target(after).filesystem).toBe(target(before).filesystem)
    expect(after.world.network.localNetworks).toBe(before.world.network.localNetworks)
  })

  it('is a software-state no-op without pending GateSSH', () => {
    const state = createInitialGameState()
    expect(activatePendingGateSshAtDeviceBoot(state, DEVICE_ID)).toBe(state)
    expect(activatePendingGateSshAtDeviceBoot(state, 'missing-device')).toBe(state)
  })

  it.each([
    ['InstalledSoftware', (host: NetworkHost) => ({ ...host, installedSoftware: host.installedSoftware!.filter(({ id }) => id !== 'gate-ssh') })],
    ['managed Service', (host: NetworkHost) => ({ ...host, services: host.services!.filter(({ id }) => id !== 'service-ssh-002') })],
  ])('preserves pending and both active owners when coherent %s activation is impossible', (_name, alter) => {
    const pending = withPending()
    const state = { ...pending, world: { ...pending.world, network: { ...pending.world.network, hosts: pending.world.network.hosts.map((host) => host.id === DEVICE_ID ? alter(host) : host) } } }
    expect(activatePendingGateSshAtDeviceBoot(state, DEVICE_ID)).toBe(state)
    expect(target(state).pendingGateSshActivation).toEqual(PENDING)
    expect(state.rackUpdate.submission.outcome).not.toBeNull()
  })
})

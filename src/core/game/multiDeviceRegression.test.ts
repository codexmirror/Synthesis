import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { resolveServiceEndpoint, startServiceAnalysisFromObservation } from './serviceAnalysis'
import { getFilesystemFile } from './filesystem'
import type { GameState } from './types'

describe('multi-Device stable identity regressions', () => {
  it('keeps Knowledge and DeviceAccess scoped to their stable target and Service identities', () => {
    const state = createInitialGameState()
    const isolated: GameState = {
      ...state,
      knowledge: { discoveredVulnerabilities: [{ vulnerabilityId: 'AUTH-017', targetDeviceId: 'host-lan-001', serviceId: 'service-ssh-001', observedLabel: 'Weak authentication configuration' }] },
      deviceAccess: { nextId: 2, established: [{ id: 'access-0001', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] },
    }
    expect(isolated.knowledge.discoveredVulnerabilities.some(({ targetDeviceId }) => targetDeviceId === 'host-lan-002')).toBe(false)
    expect(isolated.deviceAccess.established.some(({ targetDeviceId }) => targetDeviceId === 'host-lan-002')).toBe(false)
  })

  it('resolves targets by stable identity regardless of hosts array order', () => {
    const state = createInitialGameState()
    const reordered = { ...state, world: { network: { ...state.world.network, hosts: [...state.world.network.hosts].reverse() } } }
    expect(resolveServiceEndpoint(reordered, '203.0.113.42:8443')).toEqual({ targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' })
    expect(startServiceAnalysisFromObservation(reordered, { endpoint: '203.0.113.42:8443', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' }).status).toBe('started')
  })

  it('does not let mutable IP or display name substitute for Device identity', () => {
    const state = createInitialGameState()
    const moved = { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, ip: '192.0.2.88', displayName: 'renamed-rack' } : host) } } }
    expect(startServiceAnalysisFromObservation(moved, { endpoint: '203.0.113.42:8443', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' }).status).toBe('endpoint_not_found')
    expect(startServiceAnalysisFromObservation(moved, { endpoint: '192.0.2.88:8443', targetDeviceId: 'host-lan-001', serviceId: 'service-rack-update-002' }).status).toBe('endpoint_not_found')
    expect(startServiceAnalysisFromObservation(moved, { endpoint: '192.0.2.88:8443', targetDeviceId: 'host-lan-002', serviceId: 'service-rack-update-002' }).status).toBe('started')
  })

  it('keeps represented RACK-OS Devices and their filesystems independent', () => {
    const state = createInitialGameState()
    const first = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!
    const second = state.world.network.hosts.find(({ id }) => id === 'host-lan-002')!
    expect(first.firmware).toEqual(second.firmware)
    expect(first.filesystem).not.toBe(second.filesystem)
    expect(getFilesystemFile(first.filesystem!, '/srv/readme.txt').status).toBe('ok')
    expect(getFilesystemFile(second.filesystem!, '/srv/readme.txt').status).toBe('not_found')
    expect(getFilesystemFile(second.filesystem!, '/srv/backup-manifest.txt').status).toBe('ok')
    expect(getFilesystemFile(first.filesystem!, '/srv/backup-manifest.txt').status).toBe('not_found')
  })
})

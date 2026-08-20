import { describe, expect, it } from 'vitest'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'

describe('createInitialGameState', () => {
  it('creates an independent local-device and world graph for every session', () => {
    const first = createInitialGameState()
    const second = createInitialGameState()

    expect(first).not.toBe(second)
    expect(first.player).not.toBe(second.player)
    expect(first.player.localDevice).not.toBe(second.player.localDevice)
    expect(first.player.localDevice.firmware).not.toBe(second.player.localDevice.firmware)
    expect(first.player.localDevice.filesystem).not.toBe(second.player.localDevice.filesystem)
    expect(first.player.localDevice.filesystem.files).not.toBe(second.player.localDevice.filesystem.files)
    expect(first.player.localDevice.network).not.toBe(second.player.localDevice.network)
    expect(first.player.localDevice.hardware).not.toBe(second.player.localDevice.hardware)
    expect(first.player.localDevice.runtime).not.toBe(second.player.localDevice.runtime)
    expect(first.wallet).not.toBe(second.wallet)
    expect(first.world).not.toBe(second.world)
    expect(first.world.network).not.toBe(second.world.network)
    expect(first.world.network.localNetworks).not.toBe(second.world.network.localNetworks)
    expect(first.world.network.localNetworks[0]).not.toBe(second.world.network.localNetworks[0])
    expect(first.world.network.localNetworks[0].memberDeviceIds).not.toBe(second.world.network.localNetworks[0].memberDeviceIds)
    expect(first.world.network.hosts).not.toBe(second.world.network.hosts)
    expect(first.world.network.hosts[0]).not.toBe(second.world.network.hosts[0])
    expect(first.world.network.hosts[0].services).not.toBe(second.world.network.hosts[0].services)
    expect(first.world.network.hosts[0].services?.[0]).not.toBe(second.world.network.hosts[0].services?.[0])
    expect(first).toEqual(second)
  })

  it('separates identities and seeds canonical local-device state in schema version 11', () => {
    const state = createInitialGameState()
    expect(GAME_STATE_VERSION).toBe(11)
    expect(state.version).toBe(11)
    expect(state.player.id).toBe('player-local-v0')
    expect(state.player.localDevice.id).toBe('device-local-v0')
    expect(state.player.id).not.toBe(state.player.localDevice.id)
    expect(state.player.localDevice).toMatchObject({
      displayName: 'node-01',
      firmware: { id: 'firmware-node-os-v1', name: 'NODE-OS', version: '1.0' },
      network: { ip: '198.51.100.23' },
      hardware: { cpu: { name: 'Basic CPU', computeCapacity: 100 }, ram: { name: '4 GB', capacityMiB: 4096 } },
      runtime: { baselineCpuLoad: 18, baselineRamUsage: 23, networkStatus: 'ONLINE' },
    })
    expect(state.player.localDevice.filesystem).toEqual({
      files: [{ path: '/home/user/welcome.txt', content: 'Welcome to your local filesystem.' }],
    })
    expect(state.process).toEqual({ nextId: 1, processes: [] })
    expect(state.knowledge).toEqual({ discoveredVulnerabilities: [] })
    expect(state.world.network.hosts).toEqual([
      {
        id: 'host-lan-001', ip: '198.51.100.47', online: true, role: 'server',
        services: [
          { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-001', label: 'Weak authentication configuration' }] },
          { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, vulnerabilities: [] },
        ],
      },
      { id: 'host-training-001', ip: '203.0.113.42', online: true },
      { id: 'host-training-002', ip: '203.0.113.99', online: false },
    ])
    expect(state.world.network.hosts).not.toContainEqual(expect.objectContaining({ id: state.player.localDevice.id }))
    expect(state.world.network.localNetworks).toEqual([
      { id: 'network-local-001', name: 'home-net', memberDeviceIds: [state.player.localDevice.id, 'host-lan-001'] },
    ])
    expect(state.world.network.localNetworks[0].id).not.toBe(state.world.network.localNetworks[0].name)
    expect(state.player.localDevice).not.toHaveProperty('networkId')
  })

  it('preserves the existing LAN host as the canonical server and gives it two owned services and vulnerability truth', () => {
    const state = createInitialGameState()
    const server = state.world.network.hosts.find(({ id }) => id === 'host-lan-001')

    expect(server).toMatchObject({ id: 'host-lan-001', ip: '198.51.100.47', role: 'server' })
    expect(state.world.network.localNetworks[0].memberDeviceIds).toContain(server?.id)
    expect(server?.services).toEqual([
      { id: 'service-ssh-001', name: 'SSH', port: 22, protocol: 'TCP', open: true, credentialAccess: { privilege: 'USER' }, vulnerabilities: [{ id: 'vulnerability-ssh-001', label: 'Weak authentication configuration' }] },
      { id: 'service-http-001', name: 'HTTP', port: 80, protocol: 'TCP', open: true, vulnerabilities: [] },
    ])
  })
})

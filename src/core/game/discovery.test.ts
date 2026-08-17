import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { createEmptyDiscovery, rememberScan } from './discovery'
import { scanNetworkTarget, type ScanResult } from './scan'

const state = createInitialGameState()
const targets = { localDevice: state.player.localDevice, network: state.world.network }
const observe = (input: string) => scanNetworkTarget(targets, input)

describe('Discovery memory', () => {
  it('starts empty because SELF is intrinsic rather than duplicated World truth', () => {
    expect(state.discovery).toEqual(createEmptyDiscovery())
    expect(state.discovery.devices).toHaveLength(0)
  })
  it('remembers a SELF relationship without claiming members were observed', () => {
    const discovery = rememberScan(state.discovery, observe('198.51.100.23'), state.player.localDevice.id)
    expect(discovery.networks).toEqual([{ id: 'network-local-001', name: 'home-net', membersObserved: false }])
    expect(discovery.devices).toHaveLength(0)
    expect(discovery.networkDeviceRelations).toContainEqual({ networkId: 'network-local-001', deviceId: state.player.localDevice.id })
  })
  it('distinguishes successful empty depth observations from never observed', () => {
    const network = rememberScan(createEmptyDiscovery(), { status: 'network', networkId: 'empty', networkName: 'empty-net', devices: [] }, state.player.localDevice.id)
    const device = rememberScan(network, { status: 'device', targetId: 'empty-device', address: '192.0.2.1', scope: 'remote', networks: [], services: [] }, state.player.localDevice.id)
    expect(network.networks[0].membersObserved).toBe(true)
    expect(device.devices[0]).toMatchObject({ servicesObserved: true, services: [] })
  })
  it('does not mark failed observations complete', () => {
    const discovery = createEmptyDiscovery()
    expect(rememberScan(discovery, { status: 'no_response', address: '192.0.2.1' }, state.player.localDevice.id)).toBe(discovery)
  })
  it('adds network devices shallowly, then services at device depth', () => {
    let discovery = rememberScan(createEmptyDiscovery(), observe('home-net'), state.player.localDevice.id)
    expect(discovery.devices[0]).toMatchObject({ id: 'host-lan-001', servicesObserved: false, services: [] })
    discovery = rememberScan(discovery, observe('198.51.100.47'), state.player.localDevice.id)
    expect(discovery.devices[0].services.map((service) => service.name)).toEqual(['SSH', 'HTTP'])
  })
  it('deduplicates stable identities, updates positive snapshots, and never deletes absent services', () => {
    let discovery = rememberScan(createEmptyDiscovery(), observe('198.51.100.47'), state.player.localDevice.id)
    const update: ScanResult = { status: 'device', targetId: 'host-lan-001', address: '198.51.100.83', scope: 'lan', networks: [], services: [{ id: 'service-http-001', name: 'WEB', port: 8080, protocol: 'TCP' }] }
    discovery = rememberScan(discovery, update, state.player.localDevice.id)
    expect(discovery.devices).toHaveLength(1)
    expect(discovery.devices[0].address).toBe('198.51.100.83')
    expect(discovery.devices[0].services).toHaveLength(2)
    expect(discovery.devices[0].services.find((service) => service.id === 'service-ssh-001')?.endpoint).toBe('198.51.100.47:22')
    expect(discovery.devices[0].services.find((service) => service.id === 'service-http-001')?.endpoint).toBe('198.51.100.83:8080')
  })
  it('keeps deeper and unrelated memory during shallow observations', () => {
    let discovery = rememberScan(createEmptyDiscovery(), observe('198.51.100.47'), state.player.localDevice.id)
    discovery = rememberScan(discovery, { status: 'device', targetId: 'other', address: '203.0.113.5', scope: 'remote', networks: [], services: [] }, state.player.localDevice.id)
    discovery = rememberScan(discovery, observe('home-net'), state.player.localDevice.id)
    expect(discovery.devices.find((device) => device.id === 'host-lan-001')?.services).toHaveLength(2)
    expect(discovery.devices.some((device) => device.id === 'other')).toBe(true)
  })
})

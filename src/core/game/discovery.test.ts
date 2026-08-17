import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { applyScanObservation } from './discovery'
import { scanNetworkTarget, type ScanResult } from './scan'

const game = createInitialGameState(); const targets = { localDevice: game.player.localDevice, network: game.world.network }
const observe = (discovery = game.discovery, input = '198.51.100.23') => applyScanObservation(discovery, scanNetworkTarget(targets, input))

describe('Discovery V1 observation merge', () => {
  it('starts empty and records SELF relationships without duplicating SELF', () => {
    expect(game.discovery).toEqual({ networks: [], devices: [], networkDeviceRelationships: [], services: [] })
    const next = observe()
    expect(next.devices).toEqual([]); expect(next.networks).toEqual([{ id: 'network-local-001', name: 'home-net', hasObservedMembers: false }])
    expect(next.networkDeviceRelationships).toContainEqual({ networkId: 'network-local-001', deviceId: game.player.localDevice.id })
  })
  it('is identity-idempotent', () => { const once = observe(); expect(applyScanObservation(once, scanNetworkTarget(targets, '198.51.100.23'))).toBe(once) })
  it('network scope completes and discovers devices but no services', () => {
    const next = observe(observe(), 'home-net'); expect(next.networks[0].hasObservedMembers).toBe(true); expect(next.devices[0]).toMatchObject({ id: 'host-lan-001', hasObservedServices: false }); expect(next.services).toEqual([])
  })
  it('device scope completes and stores observed endpoint snapshots', () => {
    const next = observe(observe(observe(), 'home-net'), '198.51.100.47'); expect(next.devices[0].hasObservedServices).toBe(true); expect(next.services).toHaveLength(2); expect(next.services[0]).toMatchObject({ name: 'SSH', observedEndpoint: '198.51.100.47:22' })
  })
  it('preserves deeper services through shallow address changes', () => {
    const known = observe(observe(observe(), 'home-net'), '198.51.100.47')
    const moved: ScanResult = { status: 'network', networkId: 'network-local-001', networkName: 'home-net', devices: [{ targetId: game.player.localDevice.id, address: '198.51.100.23', scope: 'self' }, { targetId: 'host-lan-001', address: '198.51.100.83', scope: 'lan' }] }
    const next = applyScanObservation(known, moved); expect(next.devices[0].address).toBe('198.51.100.83'); expect(next.services[0].observedEndpoint).toBe('198.51.100.47:22')
  })
  it('updates a positive service snapshot and never deletes an absent service', () => {
    const known = observe(observe(observe(), 'home-net'), '198.51.100.47')
    const result: ScanResult = { status: 'device', targetId: 'host-lan-001', address: '198.51.100.83', scope: 'lan', networks: [], services: [{ id: 'service-http-001', name: 'WEB', port: 8080, protocol: 'TCP' }] }
    const next = applyScanObservation(known, result); expect(next.services).toHaveLength(2); expect(next.services.find((s) => s.serviceId === 'service-http-001')).toMatchObject({ name: 'WEB', observedEndpoint: '198.51.100.83:8080' }); expect(next.services.some((s) => s.serviceId === 'service-ssh-001')).toBe(true)
  })
  it('does not mutate for unsuccessful results', () => {
    const known = observe(); expect(applyScanObservation(known, { status: 'no_response', address: '1.1.1.1' })).toBe(known); expect(applyScanObservation(known, { status: 'unknown_target', input: 'x' })).toBe(known)
  })
  it('counts successful empty scopes as observed', () => {
    const network = applyScanObservation(game.discovery, { status: 'network', networkId: 'empty', networkName: 'empty', devices: [] }); expect(network.networks[0].hasObservedMembers).toBe(true)
    const device = applyScanObservation(network, { status: 'device', targetId: 'empty-device', address: '192.0.2.2', scope: 'remote', networks: [], services: [] }); expect(device.devices[0].hasObservedServices).toBe(true)
  })
  it('preserves unrelated Discovery', () => {
    const seeded = { ...game.discovery, networks: [{ id: 'other', name: 'other', hasObservedMembers: false }] }; expect(observe(seeded).networks).toHaveLength(2)
  })
})

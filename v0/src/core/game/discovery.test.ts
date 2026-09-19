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
  it('remembers a SELF relationship using the same Host Scan semantics as any other Host, without a name it has not separately earned', () => {
    const discovery = rememberScan(state.discovery, observe('198.51.100.23'), state.player.localDevice.id)
    expect(discovery.networks).toEqual([{ id: 'network-local-001', cidr: '198.51.100.0/24', gateway: { deviceId: 'router-home-001', address: '198.51.100.1' }, membersObserved: false }])
    expect(discovery.networkDeviceRelations).toContainEqual({ networkId: 'network-local-001', deviceId: state.player.localDevice.id })
    expect(discovery.devices).toEqual([{ id: 'router-home-001', address: '198.51.100.1', scope: 'lan', servicesObserved: false, services: [] }])
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
    expect(discovery.devices.find(({ id }) => id === 'host-lan-001')).toMatchObject({ servicesObserved: false, services: [] })
    discovery = rememberScan(discovery, observe('198.51.100.47'), state.player.localDevice.id)
    expect(discovery.devices.find(({ id }) => id === 'host-lan-001')?.services.map((service) => service.name)).toEqual(['SSH', 'HTTP'])
  })
  it('refreshes the exposed-Service snapshot while preserving stale memory until rescan', () => {
    let discovery = rememberScan(createEmptyDiscovery(), observe('198.51.100.47'), state.player.localDevice.id)
    const update: ScanResult = { status: 'device', targetId: 'host-lan-001', address: '198.51.100.83', scope: 'lan', networks: [], services: [{ id: 'service-http-001', name: 'WEB', port: 8080, protocol: 'TCP' }] }
    discovery = rememberScan(discovery, update, state.player.localDevice.id)
    const host = discovery.devices.find(({ id }) => id === 'host-lan-001')!
    expect(host.address).toBe('198.51.100.83')
    expect(host.services).toHaveLength(1)
    expect(host.services.find((service) => service.id === 'service-ssh-001')).toBeUndefined()
    expect(host.services.find((service) => service.id === 'service-http-001')?.endpoint).toBe('198.51.100.83:8080')
  })
  it('keeps deeper and unrelated memory during shallow observations', () => {
    let discovery = rememberScan(createEmptyDiscovery(), observe('198.51.100.47'), state.player.localDevice.id)
    discovery = rememberScan(discovery, { status: 'device', targetId: 'other', address: '203.0.113.5', scope: 'remote', networks: [], services: [] }, state.player.localDevice.id)
    discovery = rememberScan(discovery, observe('home-net'), state.player.localDevice.id)
    expect(discovery.devices.find((device) => device.id === 'host-lan-001')?.services).toHaveLength(2)
    expect(discovery.devices.some((device) => device.id === 'other')).toBe(true)
  })
})

describe('Gateway exposure refresh', () => {
  const GATEWAY_ADDRESS = '203.0.113.42'
  const scanGateway = (world: typeof state.world = state.world) => scanNetworkTarget({ localDevice: state.player.localDevice, network: world.network }, GATEWAY_ADDRESS)
  const withoutExposure = (targetServiceId: string) => ({
    ...state,
    world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'router-foreign-001'
      ? { ...host, exposures: host.exposures!.filter((exposure) => exposure.targetServiceId !== targetServiceId) }
      : host) } },
  })

  it('remembers every currently forwarded backend by stable identity, keyed as this Gateway\'s own exposure', () => {
    const discovery = rememberScan(createEmptyDiscovery(), scanGateway(), state.player.localDevice.id)
    const srv02 = discovery.devices.find(({ id }) => id === 'host-lan-002')
    const phone = discovery.devices.find(({ id }) => id === 'host-phone-001')
    expect(srv02).toMatchObject({ observedOnlyAsGatewayExposure: { gatewayDeviceId: 'router-foreign-001' } })
    expect(srv02?.services.map(({ id }) => id).sort()).toEqual(['service-rack-update-002', 'service-ssh-002'])
    expect(phone).toMatchObject({ observedOnlyAsGatewayExposure: { gatewayDeviceId: 'router-foreign-001' } })
    expect(phone?.services.map(({ id }) => id)).toEqual(['service-ssh-003'])
  })

  it('stays remembered as stale until a rescan, matching the established Discovery model for a direct Device Scan', () => {
    const scanned = rememberScan(createEmptyDiscovery(), scanGateway(), state.player.localDevice.id)
    // World Truth changes underneath what was remembered; merely holding it never refreshes anything.
    const removed = withoutExposure('service-rack-update-002')
    const rescan = scanGateway(removed.world)
    expect(rescan.status === 'device' ? rescan.exposedBackends?.some(({ service }) => service.id === 'service-rack-update-002') : undefined).toBe(false)
    expect(scanned.devices.find(({ id }) => id === 'host-lan-002')?.services.map(({ id }) => id).sort()).toEqual(['service-rack-update-002', 'service-ssh-002'])
  })

  it('drops one disappeared exposure on rescan while preserving the same backend\'s other still-observed exposure', () => {
    let discovery = rememberScan(createEmptyDiscovery(), scanGateway(), state.player.localDevice.id)
    const removed = withoutExposure('service-rack-update-002')
    discovery = rememberScan(discovery, scanGateway(removed.world), state.player.localDevice.id)
    const srv02 = discovery.devices.find(({ id }) => id === 'host-lan-002')
    expect(srv02?.services.map(({ id }) => id)).toEqual(['service-ssh-002'])
    expect(srv02?.observedOnlyAsGatewayExposure).toEqual({ gatewayDeviceId: 'router-foreign-001' })
  })

  it('removes a gateway-exposure-only backend outright once its one and only exposure disappears on rescan', () => {
    let discovery = rememberScan(createEmptyDiscovery(), scanGateway(), state.player.localDevice.id)
    expect(discovery.devices.some(({ id }) => id === 'host-phone-001')).toBe(true)
    const removed = withoutExposure('service-ssh-003')
    discovery = rememberScan(discovery, scanGateway(removed.world), state.player.localDevice.id)
    expect(discovery.devices.some(({ id }) => id === 'host-phone-001')).toBe(false)
    // Every other backend the Gateway still forwards is untouched by this refresh.
    expect(discovery.devices.find(({ id }) => id === 'host-lan-002')?.services).toHaveLength(2)
    expect(discovery.devices.some(({ id }) => id === 'host-lan-003')).toBe(true)
  })

  it('never erases a backend\'s own directly observed evidence merely because its Gateway exposure later disappears', () => {
    // A direct Device Scan sourced from within the segment (a test fixture; never default game content)
    // legitimately discovers srv-02 itself, remembering its private-facing Service surface for real.
    const direct: ScanResult = { status: 'device', targetId: 'host-lan-002', address: '10.42.0.42', scope: 'remote', networks: [], services: [{ id: 'service-bookstore-backend-002', name: 'Bookstore Backend', port: 8090, protocol: 'TCP' }] }
    let discovery = rememberScan(createEmptyDiscovery(), direct, state.player.localDevice.id)
    discovery = rememberScan(discovery, scanGateway(), state.player.localDevice.id)
    expect(discovery.devices.find(({ id }) => id === 'host-lan-002')?.observedOnlyAsGatewayExposure).toBeUndefined()

    const removed = withoutExposure('service-ssh-002')
    discovery = rememberScan(discovery, scanGateway(removed.world), state.player.localDevice.id)
    const srv02 = discovery.devices.find(({ id }) => id === 'host-lan-002')!
    // Still a real, directly observed Device: never removed, and its own non-forwarded evidence survives.
    expect(srv02.observedOnlyAsGatewayExposure).toBeUndefined()
    expect(srv02.services.find(({ id }) => id === 'service-bookstore-backend-002')).toBeDefined()
    expect(srv02.services.find(({ id }) => id === 'service-rack-update-002')).toBeDefined()
  })
})

describe('remembered Device display identity', () => {
  const selfId = state.player.localDevice.id
  const scanned = () => rememberScan(state.discovery, observe('198.51.100.47'), selfId)

  // The retired generic Inspect operation used to be the only route to a
  // remembered Device display name. Recon V2 retires it without a
  // replacement observation for that evidence in this slice: a Scan never
  // records one, and no current operation does either.
  it('records no display name from a Scan, however much World Truth owns one', () => {
    expect(state.world.network.hosts.find(({ id }) => id === 'host-lan-001')?.displayName).toBe('srv-01')
    expect(scanned().devices[0].inspect).toBeUndefined()
    expect(JSON.stringify(scanned())).not.toContain('srv-01')
  })
})

import { describe, expect, it } from 'vitest'
import { createInitialGameState } from '../core/game/initialState'
import { scanNetworkTarget } from '../core/game/scan'
import type { GameState } from '../core/game/types'
import { createLocalScanTarget } from './localScanOperation'

describe('local Scan application operation', () => {
  it('keeps a stale Service snapshot until a later successful Scan refreshes the exposed surface', async () => {
    let state = createInitialGameState()
    state = { ...state, discovery: { networks: [], networkDeviceRelations: [], devices: [{ id: 'host-lan-001', address: '198.51.100.47', scope: 'unknown', servicesObserved: false, services: [] }] } }
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })

    await scanTarget('198.51.100.47')
    expect(state.discovery.devices[0].services.map(({ name }) => name)).toEqual(['SSH', 'HTTP'])
    state = { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-001' ? { ...host, services: host.services?.map((service) => service.name === 'SSH' ? { ...service, open: false } : service) } : host) } } }

    // World Truth changed, but browsing remembered Discovery does not refresh it.
    expect(state.discovery.devices[0].services.map(({ name }) => name)).toEqual(['SSH', 'HTTP'])
    await scanTarget('198.51.100.47')
    expect(state.discovery.devices[0].services.map(({ name }) => name)).toEqual(['HTTP'])
  })

  it('returns the existing structured domain observation', async () => {
    let state = createInitialGameState()
    state = { ...state, discovery: { ...state.discovery, networks: [{ id: 'network-local-001', name: 'home-net', membersObserved: false }] } }
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })

    expect(await scanTarget('home-net')).toEqual(scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, 'home-net'))
    expect(await scanTarget('198.51.100.47')).toEqual(scanNetworkTarget({
      localDevice: state.player.localDevice,
      network: state.world.network,
    }, '198.51.100.47'))
  })

  it('reads current canonical state for every request instead of capturing initial World', async () => {
    let state: GameState = createInitialGameState()
    state = { ...state, discovery: { networks: [{ id: 'network-local-001', name: 'home-net', membersObserved: false }], devices: [{ id: 'host-lan-001', address: '198.51.100.47', scope: 'lan', servicesObserved: false, services: [] }], networkDeviceRelations: [] } }
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })
    const host = state.world.network.hosts[0]
    state = {
      ...state,
      world: {
        network: {
          ...state.world.network,
          hosts: [{ ...host, operational: { lifecycle: 'RUNNING', connectivity: 'DISCONNECTED' } }, ...state.world.network.hosts.slice(1)],
        },
      },
    }

    expect(await scanTarget(host.ip)).toEqual({ status: 'no_response', address: host.ip })
    expect(await scanTarget('home-net')).toMatchObject({
      status: 'network',
      // srv-01 is offline, so only SELF responds.
      devices: [{ targetId: state.player.localDevice.id }],
    })
  })

  it('does not observe or mutate Discovery without NodeScan installed', async () => {
    let state = createInitialGameState()
    state = { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: state.player.localDevice.installedSoftware.filter(({ id }) => id !== 'nodescan') } } }
    const before = state.discovery
    const scanTarget = createLocalScanTarget(() => state, (next) => { state = next })
    expect(await scanTarget('home-net')).toEqual({ status: 'software_unavailable' })
    expect(state.discovery).toBe(before)
  })
})

it('merges back-to-back observations against the latest canonical Discovery', async () => {
  let state = createInitialGameState()
  const scan = createLocalScanTarget(() => state, (next) => { state = next })
  await scan(state.player.localDevice.network.ip)
  await scan('home-net')
  expect(state.discovery.networks).toMatchObject([{ name: 'home-net', membersObserved: true }])
  expect(state.discovery.networkDeviceRelations).toEqual([
    { networkId: 'network-local-001', deviceId: state.player.localDevice.id },
    { networkId: 'network-local-001', deviceId: 'host-lan-001' },
  ])
  expect(state.discovery.devices).toMatchObject([{ id: 'host-lan-001', servicesObserved: false }])
})

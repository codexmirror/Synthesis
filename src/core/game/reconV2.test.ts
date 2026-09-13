import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { scanNetworkTarget } from './scan'
import { rememberScan } from './discovery'
import { advanceGameState } from './gameAdvancement'
import { startServiceAnalysisFromObservation } from './serviceAnalysis'
import { localNetworkConfiguration } from '../../apps/terminal/nodeCommandAdapter'

const targets = (state: ReturnType<typeof createInitialGameState>) => ({ localDevice: state.player.localDevice, network: state.world.network })

describe('Recon V2 canonical operations', () => {
  it('represents the default gateway as a real Router Device relationship', () => {
    const state = createInitialGameState()
    const network = state.world.network.localNetworks.find(({ memberDeviceIds }) => memberDeviceIds.includes(state.player.localDevice.id))!
    expect(network).toMatchObject({ cidr: '198.51.100.0/24', gatewayDeviceId: 'router-home-001' })
    expect(state.world.network.hosts.find(({ id }) => id === network.gatewayDeviceId)).toMatchObject({ ip: '198.51.100.1', deviceType: 'ROUTER' })
  })

  it('discovers a network, scans a chosen host, then analyzes only remembered endpoint evidence without creating vulnerability Knowledge', () => {
    let state = createInitialGameState()
    const network = scanNetworkTarget(targets(state), 'home-net')
    state = { ...state, discovery: rememberScan(state.discovery, network, state.player.localDevice.id) }
    const host = scanNetworkTarget(targets(state), '198.51.100.47')
    state = { ...state, discovery: rememberScan(state.discovery, host, state.player.localDevice.id) }
    const observed = state.discovery.devices[0].services[0]
    const started = startServiceAnalysisFromObservation(state, { endpoint: observed.endpoint, targetDeviceId: state.discovery.devices[0].id, serviceId: observed.id })
    expect(started.status).toBe('started')
    if (started.status !== 'started') return
    state = advanceGameState(started.state, 20_000, () => 0)
    expect(state.discovery.devices[0].services[0].inspect?.implementation).toEqual({ name: 'GateSSH', version: '1.3.2' })
    expect(state.knowledge.discoveredVulnerabilities).toEqual([])
  })

  it('uses the same host-surface rule for SELF rather than a special no-services branch', () => {
    const state = createInitialGameState()
    const result = scanNetworkTarget(targets(state), state.player.localDevice.network.ip)
    expect(result).toMatchObject({ status: 'device', scope: 'self', services: [] })
  })

  it('scans and analyzes the foreign Router through the ordinary Host/Endpoint operations', () => {
    let state = createInitialGameState()
    const scanned = scanNetworkTarget(targets(state), '203.0.113.42')
    state = { ...state, discovery: rememberScan(state.discovery, scanned, state.player.localDevice.id) }
    const router = state.discovery.devices.find(({ id }) => id === 'router-foreign-001')!
    const service = router.services[0]
    const started = startServiceAnalysisFromObservation(state, { endpoint: service.endpoint, targetDeviceId: router.id, serviceId: service.id })
    expect(started.status).toBe('started')
    if (started.status !== 'started') return
    state = advanceGameState(started.state, 20_000)
    expect(state.discovery.devices.find(({ id }) => id === router.id)?.services[0].inspect?.implementation).toEqual({ name: 'Basic HTTP', version: '1.0' })
  })

  it('fails closed when SELF has more than one applicable routing configuration', () => {
    const state = createInitialGameState()
    const ambiguous = { ...state, world: { network: { ...state.world.network, localNetworks: [
      ...state.world.network.localNetworks,
      { ...state.world.network.localNetworks[0], id: 'network-second', name: 'second-net', cidr: '192.0.2.0/24' },
    ] } } }
    expect(localNetworkConfiguration(ambiguous)).toEqual({})
  })
})

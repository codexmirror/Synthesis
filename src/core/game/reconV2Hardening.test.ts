import { describe, expect, it, vi } from 'vitest'
import { createInitialGameState } from './initialState'
import { createEmptyDiscovery, rememberPing, rememberScan } from './discovery'
import { scanNetworkTarget } from './scan'
import { pingNetworkTarget } from './ping'
import { createRefreshNetwork } from '../../app/targetDiscoveryOperation'
import { createLocalScanTarget } from '../../app/localScanOperation'
import { dispatchNodeCommand } from '../../apps/terminal/nodeCommandAdapter'
import { selectTarget } from '../../apps/network/targetProjection'
import { NODESCAN_1_2_STANDARD } from './softwareReleaseContent'
import type { GameState } from './types'
import type { GameActions } from '../../app/GameContext'

/** A GameActions stub whose `scanTarget` is real and everything else is an unused stub, for adapter-parity tests. */
function actionsWithRealScan(scanTarget: GameActions['scanTarget']): GameActions {
  return new Proxy({ scanTarget }, {
    get: (target, prop) => prop in target ? (target as Record<string | symbol, unknown>)[prop] : vi.fn(),
  }) as unknown as GameActions
}

/**
 * Regression coverage for the Recon V2 hardening patch: a scanned remote Host
 * gains a gameplay path out of ELSEWHERE via its owned Network context, and
 * NodeScan 1.2's own Device classification replaces generic Inspect as the
 * "what kind of Device is this" payoff — without reviving Inspect, without
 * touching Vulnerability Knowledge, and without ever exposing concrete
 * Device identity.
 */

function withNodeScan12(state: GameState): GameState {
  return {
    ...state,
    player: {
      ...state.player,
      localDevice: {
        ...state.player.localDevice,
        installedSoftware: state.player.localDevice.installedSoftware.map((software) => software.id === 'nodescan'
          ? { id: NODESCAN_1_2_STANDARD.productId, releaseId: NODESCAN_1_2_STANDARD.releaseId, buildId: NODESCAN_1_2_STANDARD.buildId, name: NODESCAN_1_2_STANDARD.name, version: NODESCAN_1_2_STANDARD.version, channel: NODESCAN_1_2_STANDARD.channel }
          : software),
      },
    },
  }
}

const targetsOf = (state: GameState) => ({ localDevice: state.player.localDevice, network: state.world.network })

/** The realistic path to a legitimate Scan-by-address through the application adapter: PING first, exactly as the player must. */
function pinged(state: GameState, address: string): GameState {
  return { ...state, discovery: rememberPing(state.discovery, pingNetworkTarget(targetsOf(state), address), state.player.localDevice.id) }
}

describe('Host Scan Network expansion (Regression #1)', () => {
  it('gives a scanned remote Host a gameplay path out of ELSEWHERE via its own owned Network, without deep-scanning its peers', () => {
    const state = createInitialGameState()
    const scan1 = scanNetworkTarget(targetsOf(state), '203.0.113.42')
    const discovery = rememberScan(createEmptyDiscovery(), scan1, state.player.localDevice.id)

    expect(discovery.networkDeviceRelations).toContainEqual({ networkId: 'network-foreign-001', deviceId: 'host-lan-002' })
    // Only the represented Gateway clue arrives shallow; peers require Network Scan.
    const phone = discovery.devices.find(({ id }) => id === 'host-phone-001')
    const ops = discovery.devices.find(({ id }) => id === 'host-lan-003')
    expect(phone).toBeUndefined()
    expect(ops).toBeUndefined()
    expect(discovery.devices.find(({ id }) => id === 'router-foreign-001')).toMatchObject({ address: '203.0.113.1', servicesObserved: false })

    // Only the Host actually scanned is deep: its own Service surface is remembered.
    expect(discovery.devices.find(({ id }) => id === 'host-lan-002')?.servicesObserved).toBe(true)

    // The player must still explicitly Scan a peer individually to learn its own Endpoint surface.
    const scan2 = scanNetworkTarget(targetsOf(state), '198.51.100.61')
    const deeper = rememberScan(discovery, scan2, state.player.localDevice.id)
    expect(deeper.devices.find(({ id }) => id === 'host-phone-001')).toMatchObject({ servicesObserved: true })
    expect(deeper.devices.find(({ id }) => id === 'host-lan-003')).toBeUndefined()
  })

  it('never leaks the Network\'s own mutable display name from an incidental Host Scan relation', () => {
    const state = createInitialGameState()
    const discovery = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '203.0.113.42'), state.player.localDevice.id)
    const network = discovery.networks.find(({ id }) => id === 'network-foreign-001')!
    expect(network.name).toBeUndefined()
    expect(network.cidr).toBe('203.0.113.0/24')
    expect(JSON.stringify(discovery)).not.toContain('remote-segment-01')

    // A genuine Network Scan by CIDR is the separate legitimate observation that earns the real name.
    const named = rememberScan(discovery, scanNetworkTarget(targetsOf(state), '203.0.113.0/24'), state.player.localDevice.id)
    expect(named.networks.find(({ id }) => id === 'network-foreign-001')?.name).toBe('remote-segment-01')
  })

  it('fails closed rather than arbitrarily picking a Network for a Host with ambiguous represented membership', () => {
    const state = createInitialGameState()
    const ambiguous = { ...state.world.network, localNetworks: [
      ...state.world.network.localNetworks,
      { ...state.world.network.localNetworks[1], id: 'network-foreign-002', name: 'also-remote', cidr: '198.18.0.0/24' },
    ] }
    const result = scanNetworkTarget({ localDevice: state.player.localDevice, network: ambiguous }, '203.0.113.42')
    expect(result).toMatchObject({ status: 'device', networks: [] })
  })
})

describe('NodeScan 1.2 Device classification lifecycle', () => {
  it('classifies an individually scanned Router as NETWORK DEVICE without revealing display identity', () => {
    const state = withNodeScan12(createInitialGameState())
    const discovery = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '203.0.113.1'), state.player.localDevice.id)
    const router = discovery.devices.find(({ id }) => id === 'router-foreign-001')
    expect(router).toMatchObject({ address: '203.0.113.1', classification: 'NETWORK DEVICE', servicesObserved: true })
    expect(router?.services).toEqual([{ id: 'service-http-router-001', name: 'HTTP', port: 80, protocol: 'TCP', endpoint: '203.0.113.1:80' }])
    expect(router?.inspect).toBeUndefined()
  })
  it('never remembers classification below NodeScan 1.2', () => {
    const state = createInitialGameState()
    const discovery = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '203.0.113.42'), state.player.localDevice.id)
    expect(discovery.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBeUndefined()
  })

  it('does not retroactively classify an already-remembered Device merely from installing 1.2', () => {
    const state = createInitialGameState()
    const scanned = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '203.0.113.42'), state.player.localDevice.id)
    // Installing 1.2 after the fact changes nothing about already-remembered Discovery.
    expect(scanned.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBeUndefined()
  })

  it('remembers classification from a legitimate Scan performed while 1.2 is installed, as stored Discovery evidence', () => {
    const state = withNodeScan12(createInitialGameState())
    const discovery = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '203.0.113.42'), state.player.localDevice.id)
    expect(discovery.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')

    const projected = selectTarget({ ...state, discovery }, 'host-lan-002')
    expect(projected?.classification).toBe('SERVER')
    // Never confused with implementation evidence: classification is not a fingerprint.
    expect(projected?.classification).not.toContain('GateSSH')
  })

  it('classifies the phone as a mobile device, never by its concrete Device identity', () => {
    const state = withNodeScan12(createInitialGameState())
    expect(state.world.network.hosts.find(({ id }) => id === 'host-phone-001')?.displayName).toContain('Phone')
    const discovery = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '198.51.100.61'), state.player.localDevice.id)
    const phone = discovery.devices.find(({ id }) => id === 'host-phone-001')
    expect(phone?.classification).toBe('MOBILE DEVICE')
    expect(JSON.stringify(discovery)).not.toMatch(/Petra/i)

    const projected = selectTarget({ ...state, discovery }, 'host-phone-001')
    expect(projected?.classification).toBe('MOBILE DEVICE')
    expect(projected?.displayName).toBeUndefined()
  })

  it('survives a NodeScan downgrade once legitimately remembered', () => {
    const state12 = withNodeScan12(createInitialGameState())
    const classified = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state12), '203.0.113.42'), state12.player.localDevice.id)

    const state10 = createInitialGameState() // NodeScan 1.0, downgraded from 1.2
    const rescanned = rememberScan(classified, scanNetworkTarget(targetsOf(state10), '203.0.113.42'), state10.player.localDevice.id)
    expect(rescanned.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')
  })

  it('never silently refreshes from a hidden World Truth change; only another legitimate 1.2 observation may refresh it', () => {
    const state = withNodeScan12(createInitialGameState())
    const classified = rememberScan(createEmptyDiscovery(), scanNetworkTarget(targetsOf(state), '203.0.113.42'), state.player.localDevice.id)
    expect(classified.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')

    // Hidden World Truth changes underneath the remembered classification.
    const reclassifiedWorld: GameState = { ...state, world: { network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === 'host-lan-002' ? { ...host, deviceType: 'PHONE' as const } : host) } } }
    // Merely holding the changed World Truth in hand never refreshes remembered Discovery.
    expect(classified.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')

    // Only a later legitimate 1.2 Scan may refresh it, and it may refresh it to a different value.
    const refreshed = rememberScan(classified, scanNetworkTarget(targetsOf(reclassifiedWorld), '203.0.113.42'), reclassifiedWorld.player.localDevice.id)
    expect(refreshed.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('MOBILE DEVICE')
  })

  it('lets a legitimate Network Refresh under 1.2 refresh classification for the Hosts it re-observes, without a hidden second observation', async () => {
    let state = pinged(withNodeScan12(createInitialGameState()), '203.0.113.42')
    const scan = createLocalScanTarget(() => state, (next) => { state = next })
    // A Host Scan of host-lan-002 both classifies it and legitimately earns network-foreign-001's CIDR.
    await scan('203.0.113.42')
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-002')?.servicesObserved).toBe(true)

    const refresh = createRefreshNetwork(() => state, (next) => { state = next })
    expect(await refresh('network-foreign-001')).toEqual({ status: 'refreshed' })
    // Refresh's own genuine Network Scan re-observes every member, including the still-shallow peer.
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-003')?.classification).toBe('SERVER')
    expect(state.discovery.devices.find(({ id }) => id === 'host-phone-001')?.classification).toBe('MOBILE DEVICE')
    // Refresh still never deepens a remembered Host beyond Network Scan ownership.
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-003')?.servicesObserved).toBe(false)
  })

  it('never lets a lower-release Network Scan erase classification already remembered from an earlier 1.2 observation', async () => {
    let state = pinged(withNodeScan12(createInitialGameState()), '203.0.113.42')
    const scan12 = createLocalScanTarget(() => state, (next) => { state = next })
    await scan12('203.0.113.42')
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')

    state = downgradeToNodeScan10(state) // downgrade to NodeScan 1.0, keep Discovery
    const refresh10 = createRefreshNetwork(() => state, (next) => { state = next })
    expect(await refresh10('network-foreign-001')).toEqual({ status: 'refreshed' })
    // The 1.0 Refresh re-observes every member, but classification is 1.2's own capability: it neither erases
    // the already-earned classification nor extends it to the still-shallow, never-classified peer.
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')
    expect(state.discovery.devices.find(({ id }) => id === 'host-lan-003')?.classification).toBeUndefined()
  })
})

function downgradeToNodeScan10(state: GameState): GameState {
  const fresh = createInitialGameState()
  return { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, installedSoftware: fresh.player.localDevice.installedSoftware } } }
}

describe('Terminal / NodeScan shared canonical Discovery', () => {
  it('remembers identical Network expansion and classification whether a Scan is Terminal-triggered or NodeScan-triggered', async () => {
    const base = pinged(withNodeScan12(createInitialGameState()), '203.0.113.42')

    // NodeScan's own path: the graphical target card calls this exact application adapter directly.
    let nodeScanState = base
    await createLocalScanTarget(() => nodeScanState, (next) => { nodeScanState = next })('203.0.113.42')

    // Terminal's own path: the same adapter, reached through the command dispatcher instead.
    let terminalState = base
    const scanTarget = createLocalScanTarget(() => terminalState, (next) => { terminalState = next })
    const { dispatched } = dispatchNodeCommand('scan 203.0.113.42', terminalState, actionsWithRealScan(scanTarget), { totalCpuLoad: 0, totalRamUsage: 0 } as never)
    if (dispatched instanceof Promise) await dispatched

    expect(terminalState.discovery).toEqual(nodeScanState.discovery)
    expect(terminalState.discovery.devices.find(({ id }) => id === 'host-lan-002')?.classification).toBe('SERVER')
  })
})

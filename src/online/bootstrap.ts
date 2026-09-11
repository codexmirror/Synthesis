import { randomUUID } from 'node:crypto'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState, NetworkHost } from '../core/game/types'
import type { PlayerPrivateState, PlayerRecord } from './model'

const PERSONAL_IDS = ['player-local-v0', 'device-local-v0', 'network-local-001', 'router-home-001', 'host-lan-001', 'dollar-account-local-v0', 'dollar-credential-local-v0', 'dollar-session-0001', 'device-saved-dollar-sign-in-v0', 'wallet-node-local-v0', 'node-wallet-addr-0001'] as const

function replaceExact(value: unknown, replacements: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return replacements.get(value) ?? value
  if (Array.isArray(value)) return value.map((entry) => replaceExact(entry, replacements))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceExact(entry, replacements)]))
  return value
}

export function bootstrapPlayer(sharedState: GameState, subnet: number): { player: PlayerRecord; sharedState: GameState } {
  if (!Number.isInteger(subnet) || subnet < 1 || subnet > 254) throw new Error('Home Network allocator exhausted.')
  const suffix = randomUUID()
  const replacements = new Map<string, string>(PERSONAL_IDS.map((id) => [id, `${id.replace(/-v0$/, '')}-${suffix}`]))
  const cidr = `10.64.${subnet}.0/24`
  replacements.set('198.51.100.0/24', cidr)
  replacements.set('198.51.100.23', `10.64.${subnet}.23`)
  replacements.set('198.51.100.47', `10.64.${subnet}.47`)
  replacements.set('198.51.100.1', `10.64.${subnet}.1`)
  const seeded = replaceExact(createInitialGameState(), replacements) as GameState
  const home = seeded.world.network.localNetworks.find(({ id }) => id === replacements.get('network-local-001'))!
  const personalHostIds = new Set(home.memberDeviceIds.filter((id) => id !== seeded.player.localDevice.id))
  if (!home.gatewayDeviceId) throw new Error('Starter Home Network has no represented Gateway.')
  const personalHosts = seeded.world.network.hosts.filter(({ id }) => personalHostIds.has(id))
  const existingIds = new Set(sharedState.world.network.localNetworks.flatMap((network) => network.memberDeviceIds))
  if (home.memberDeviceIds.some((id) => existingIds.has(id)) || sharedState.world.network.localNetworks.some((network) => network.cidr === cidr)) throw new Error('Allocated Home Network collides with World Truth.')
  const privateState: PlayerPrivateState = {
    player: seeded.player, nodeWallet: seeded.nodeWallet, market: seeded.market,
    knowledge: seeded.knowledge, discovery: seeded.discovery, deviceAccess: seeded.deviceAccess,
    networkManagement: seeded.networkManagement, remoteSession: seeded.remoteSession,
    fileTransfer: seeded.fileTransfer, rackUpdate: seeded.rackUpdate, mail: seeded.mail,
    process: seeded.process, recentActivity: seeded.recentActivity, dollarFinance: seeded.dollarFinance,
  }
  const player: PlayerRecord = {
    id: seeded.player.id, homeNetworkId: home.id, gatewayDeviceId: home.gatewayDeviceId,
    starterServerDeviceId: [...personalHostIds].find((id) => id !== home.gatewayDeviceId)!, privateState,
  }
  return {
    player,
    sharedState: { ...sharedState, world: { network: {
      localNetworks: [...sharedState.world.network.localNetworks, home],
      hosts: [...sharedState.world.network.hosts, ...personalHosts as NetworkHost[]],
    } } },
  }
}

export function composePlayerSnapshot(shared: GameState, player: PlayerRecord): GameState {
  return { ...shared, ...player.privateState }
}

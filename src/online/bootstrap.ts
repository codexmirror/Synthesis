import { randomUUID } from 'node:crypto'
import { createInitialGameState } from '../core/game/initialState'
import type { GameState, LocalDeviceState, NetworkHost } from '../core/game/types'
import type { PlayerPrivateState, PlayerRecord, SharedOnlineState } from './model'

const PERSONAL_IDS = ['player-local-v0', 'device-local-v0', 'network-local-001', 'router-home-001', 'host-lan-001', 'dollar-account-local-v0', 'dollar-credential-local-v0', 'dollar-session-0001', 'device-saved-dollar-sign-in-v0', 'wallet-node-local-v0', 'node-wallet-addr-0001', 'mail-account-player-v0', 'user@node.mail'] as const
function replaceExact(value: unknown, replacements: ReadonlyMap<string, string>): unknown { if (typeof value === 'string') return replacements.get(value) ?? value; if (Array.isArray(value)) return value.map((entry) => replaceExact(entry, replacements)); if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceExact(entry, replacements)])); return value }

export function asNetworkHost(device: LocalDeviceState): NetworkHost { return { ...device, ip: device.network.ip, transferCapacity: device.network.transferCapacity } }

export function bootstrapPlayer(shared: SharedOnlineState, subnet: number): { player: PlayerRecord; shared: SharedOnlineState } {
  if (!Number.isInteger(subnet) || subnet < 1 || subnet > 254) throw new Error('Home Network allocator exhausted.')
  const suffix = randomUUID(); const replacements = new Map<string, string>(PERSONAL_IDS.map((id) => [id, `${id.replace(/-v0$/, '')}-${suffix}`])); const cidr = `10.64.${subnet}.0/24`
  replacements.set('198.51.100.0/24', cidr); replacements.set('198.51.100.23', `10.64.${subnet}.23`); replacements.set('198.51.100.47', `10.64.${subnet}.47`); replacements.set('198.51.100.1', `10.64.${subnet}.1`)
  const seeded = replaceExact(createInitialGameState(), replacements) as GameState
  const home = seeded.world.network.localNetworks.find(({ id }) => id === replacements.get('network-local-001'))!; if (!home.gatewayDeviceId) throw new Error('Starter Home Network has no represented Gateway.')
  const personalHostIds = new Set(home.memberDeviceIds.filter((id) => id !== seeded.player.localDevice.id)); const personalHosts = seeded.world.network.hosts.filter(({ id }) => personalHostIds.has(id))
  const existingIds = new Set([...shared.playerDevices.map(({ id }) => id), ...shared.state.world.network.hosts.map(({ id }) => id)])
  if (home.memberDeviceIds.some((id) => existingIds.has(id)) || shared.state.world.network.localNetworks.some((network) => network.cidr === cidr)) throw new Error('Allocated Home Network collides with World Truth.')
  const personalAccount = seeded.dollarFinance.accounts.find(({ id }) => id === replacements.get('dollar-account-local-v0'))!; const personalCredential = seeded.dollarFinance.credentials.find(({ id }) => id === replacements.get('dollar-credential-local-v0'))!
  const privateState: PlayerPrivateState = { nodeWallet: seeded.nodeWallet, marketPurchases: seeded.market.purchases, knowledge: seeded.knowledge, discovery: seeded.discovery, deviceAccess: seeded.deviceAccess, networkManagement: seeded.networkManagement, remoteSession: seeded.remoteSession, fileTransfer: seeded.fileTransfer, rackUpdate: seeded.rackUpdate, mail: seeded.mail, process: seeded.process, recentActivity: seeded.recentActivity, dollarAccount: personalAccount, dollarCredential: personalCredential, dollarSessions: { nextId: seeded.dollarFinance.sessions.nextId, active: seeded.dollarFinance.sessions.active.filter(({ accountId }) => accountId === personalAccount.id) } }
  const player: PlayerRecord = { id: seeded.player.id, ownedDeviceIds: [seeded.player.localDevice.id], primaryDeviceId: seeded.player.localDevice.id, homeNetworkId: home.id, gatewayDeviceId: home.gatewayDeviceId, starterServerDeviceId: [...personalHostIds].find((id) => id !== home.gatewayDeviceId)!, privateState }
  return { player, shared: { state: { ...shared.state, world: { network: { localNetworks: [...shared.state.world.network.localNetworks, home], hosts: [...shared.state.world.network.hosts, ...personalHosts] } } }, playerDevices: [...shared.playerDevices, seeded.player.localDevice] } }
}

export function resolveCanonicalPrimaryDevice(shared: SharedOnlineState, player: PlayerRecord): LocalDeviceState {
  if (new Set(player.ownedDeviceIds).size !== player.ownedDeviceIds.length || !player.ownedDeviceIds.includes(player.primaryDeviceId)) throw new Error('Authenticated Primary Device ownership is invalid.')
  const matches = shared.playerDevices.filter(({ id }) => id === player.primaryDeviceId); if (matches.length !== 1) throw new Error('Authenticated Primary Device truth is dangling or ambiguous.')
  return matches[0]
}

export function composePlayerSnapshot(shared: SharedOnlineState, player: PlayerRecord): GameState {
  const localDevice = resolveCanonicalPrimaryDevice(shared, player)
  const personalHosts = shared.playerDevices.filter(({ id }) => id !== localDevice.id).map(asNetworkHost)
  const base = shared.state; const personal = player.privateState
  const accounts = [...base.dollarFinance.accounts, personal.dollarAccount]
  const activeSessions = [...base.dollarFinance.sessions.active, ...personal.dollarSessions.active]
  if (new Set(accounts.map(({ id }) => id)).size !== accounts.length
    || new Set(activeSessions.map(({ id }) => id)).size !== activeSessions.length
    || new Set(activeSessions.map(({ clientDeviceId }) => clientDeviceId)).size !== activeSessions.length
    || activeSessions.some(({ accountId }) => accounts.filter(({ id }) => id === accountId).length !== 1)) throw new Error('Civic Dollar Account or Session truth is ambiguous.')
  return { ...base, player: { id: player.id, ownedDeviceIds: player.ownedDeviceIds, primaryDeviceId: player.primaryDeviceId, localDevice }, world: { network: { ...base.world.network, hosts: [...base.world.network.hosts, ...personalHosts] } }, market: { ...base.market, purchases: personal.marketPurchases }, dollarFinance: { ...base.dollarFinance, accounts, credentials: [personal.dollarCredential], sessions: { nextId: Math.max(base.dollarFinance.sessions.nextId, personal.dollarSessions.nextId), active: activeSessions } }, nodeWallet: personal.nodeWallet, knowledge: personal.knowledge, discovery: personal.discovery, deviceAccess: personal.deviceAccess, networkManagement: personal.networkManagement, remoteSession: personal.remoteSession, fileTransfer: personal.fileTransfer, rackUpdate: personal.rackUpdate, mail: personal.mail, process: personal.process, recentActivity: personal.recentActivity }
}

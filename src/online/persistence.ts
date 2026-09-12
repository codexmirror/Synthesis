import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import type { OnlineWorldDocument } from './model'
import { ONLINE_PERSISTENCE_VERSION } from './model'

export interface WorldPersistence {
  loadOrCreate(): Promise<OnlineWorldDocument>
  save(document: OnlineWorldDocument): Promise<void>
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function uniqueStrings(values: readonly unknown[]): boolean {
  return values.every((value) => typeof value === 'string' && value.length > 0)
    && new Set(values).size === values.length
}

function exactlyOne(items: readonly Record<string, unknown>[], key: string, value: unknown): boolean {
  return items.filter((item) => item[key] === value).length === 1
}

const PLAYER_PRIVATE_OWNER_KEYS = [
  'nodeWallet', 'marketPurchases', 'knowledge', 'discovery', 'deviceAccess',
  'networkManagement', 'remoteSession', 'fileTransfer', 'rackUpdate', 'mail',
  'process', 'recentActivity', 'dollarAccount', 'dollarCredential', 'dollarSessions',
] as const

const SHARED_RUNTIME_OWNER_KEYS = [
  'dollarFinance', 'business', 'bookstoreCommerce', 'bookstoreMarket',
  'bookstoreTrend', 'bookstoreOperations', 'bookstoreRestock', 'bookstoreBackend',
  'bookstoreSalesCadence', 'nodeWallet', 'nodeEconomy', 'market', 'process',
  'knowledge', 'discovery', 'deviceAccess', 'networkManagement', 'remoteSession',
  'fileTransfer', 'rackUpdate', 'mail', 'petraCompanyChat', 'technicianReaction',
  'recentActivity',
] as const

function hasRecordOwners(owner: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => record(owner[key]))
}

function hasRequiredPlayerPrivateShape(value: unknown): boolean {
  const privateState = record(value)
  if (!privateState || !hasRecordOwners(privateState, PLAYER_PRIVATE_OWNER_KEYS)) return false
  const dollarSessions = record(privateState.dollarSessions)
  return Number.isInteger(dollarSessions?.nextId) && Array.isArray(dollarSessions?.active)
    && Array.isArray(record(privateState.marketPurchases)?.entitlements)
    && Array.isArray(record(privateState.discovery)?.devices)
    && Array.isArray(record(privateState.discovery)?.networks)
    && Array.isArray(record(privateState.discovery)?.networkDeviceRelations)
    && Array.isArray(record(privateState.process)?.processes)
    && Array.isArray(record(privateState.mail)?.threads)
    && Array.isArray(record(privateState.deviceAccess)?.established)
    && Array.isArray(record(privateState.networkManagement)?.established)
    && Array.isArray(record(privateState.recentActivity)?.entries)
    && typeof record(privateState.nodeWallet)?.id === 'string'
    && typeof record(privateState.dollarAccount)?.id === 'string'
    && typeof record(privateState.dollarCredential)?.id === 'string'
}

/** Minimum admission boundary for the current persisted online document. */
export function validateOnlineWorldDocument(value: unknown): OnlineWorldDocument {
  const root = record(value)
  if (!root || root.persistenceVersion !== ONLINE_PERSISTENCE_VERSION) throw new Error('Unsupported online persistence version. Refusing to reset canonical world.')
  if (!Number.isInteger(root.nextHomeSubnet) || (root.nextHomeSubnet as number) < 1 || (root.nextHomeSubnet as number) > 255) throw new Error('Invalid online persistence allocator state.')
  const shared = record(root.shared)
  const state = record(shared?.state)
  const world = record(state?.world)
  const network = record(world?.network)
  const cadence = record(state?.bookstoreSalesCadence)
  if (!shared || !state || state.version !== GAME_STATE_VERSION || !record(state.player)
    || !hasRecordOwners(state, SHARED_RUNTIME_OWNER_KEYS)
    || !cadence || !Array.isArray(cadence.records)
    || !network || !Array.isArray(network.localNetworks) || !Array.isArray(network.hosts)
    || !Array.isArray(shared.playerDevices) || !Array.isArray(root.accounts)
    || !Array.isArray(root.sessions) || !Array.isArray(root.players)) {
    throw new Error('Invalid online persistence structure.')
  }
  const accounts = root.accounts.map(record)
  const sessions = root.sessions.map(record)
  const players = root.players.map(record)
  const devices = shared.playerDevices.map(record)
  const networks = network.localNetworks.map(record)
  const hosts = network.hosts.map(record)
  if ([...accounts, ...sessions, ...players, ...devices, ...networks, ...hosts].some((item) => !item)) throw new Error('Invalid online persistence entity structure.')
  const a = accounts as Record<string, unknown>[]
  const s = sessions as Record<string, unknown>[]
  const p = players as Record<string, unknown>[]
  const d = devices as Record<string, unknown>[]
  const n = networks as Record<string, unknown>[]
  const h = hosts as Record<string, unknown>[]
  if (!uniqueStrings(a.map(({ id }) => id)) || !uniqueStrings(a.map(({ normalizedName }) => normalizedName))
    || !uniqueStrings(p.map(({ id }) => id)) || !uniqueStrings(d.map(({ id }) => id))
    || !uniqueStrings(h.map(({ id }) => id)) || !uniqueStrings(n.map(({ id }) => id))
    || !uniqueStrings(s.map(({ id }) => id)) || !uniqueStrings(s.map(({ tokenHash }) => tokenHash))) {
    throw new Error('Duplicate or invalid online persistence identity.')
  }
  const hostDeviceIds = new Set(h.map(({ id }) => id))
  if (d.some(({ id }) => hostDeviceIds.has(id))) throw new Error('Canonical Device identity collides across online Device registries.')
  const dollarFinance = record(state.dollarFinance)
  const sharedDollarSessions = record(dollarFinance?.sessions)
  if (!Array.isArray(dollarFinance?.accounts) || !Array.isArray(dollarFinance?.credentials)
    || !Number.isInteger(sharedDollarSessions?.nextId) || !Array.isArray(sharedDollarSessions?.active)
    || !Array.isArray(record(state.market)?.offers)
    || !Array.isArray(record(state.process)?.processes)) throw new Error('Invalid shared online runtime owner structure.')
  if (d.some((device) => !record(device.network) || typeof record(device.network)?.ip !== 'string'
    || !Array.isArray(device.installedSoftware))) throw new Error('Invalid canonical Player Device structure.')
  if (a.some(({ playerId }) => !exactlyOne(p, 'id', playerId)) || s.some(({ accountId }) => !exactlyOne(a, 'id', accountId))) throw new Error('Dangling online authentication relationship.')
  const claimedOwnedDeviceIds = p.flatMap(({ ownedDeviceIds }) => Array.isArray(ownedDeviceIds) ? ownedDeviceIds : [])
  if (!uniqueStrings(p.map(({ primaryDeviceId }) => primaryDeviceId))
    || !uniqueStrings(p.map(({ homeNetworkId }) => homeNetworkId))
    || !uniqueStrings(p.map(({ gatewayDeviceId }) => gatewayDeviceId))
    || !uniqueStrings(p.map(({ starterServerDeviceId }) => starterServerDeviceId))
    || !uniqueStrings(claimedOwnedDeviceIds)) throw new Error('Conflicting cross-Player ownership or generated topology identity.')
  for (const player of p) {
    if (new Set([player.primaryDeviceId, player.gatewayDeviceId, player.starterServerDeviceId]).size !== 3) throw new Error('Persisted Player generated Device roles are not distinct.')
    if (!hasRequiredPlayerPrivateShape(player.privateState) || !Array.isArray(player.ownedDeviceIds)
      || !uniqueStrings(player.ownedDeviceIds) || !player.ownedDeviceIds.includes(player.primaryDeviceId)
      || player.ownedDeviceIds.some((deviceId) => !exactlyOne(d, 'id', deviceId))) throw new Error('Invalid persisted Player Device ownership or private runtime state.')
    const homes = n.filter(({ id }) => id === player.homeNetworkId)
    if (homes.length !== 1) throw new Error('Invalid persisted Player Home Network.')
    const home = homes[0]
    if (home.gatewayDeviceId !== player.gatewayDeviceId || !Array.isArray(home.memberDeviceIds)
      || !uniqueStrings(home.memberDeviceIds) || !home.memberDeviceIds.includes(player.primaryDeviceId)
      || !home.memberDeviceIds.includes(player.gatewayDeviceId)
      || !home.memberDeviceIds.includes(player.starterServerDeviceId)) throw new Error('Invalid persisted Player topology relationship.')
    if (!exactlyOne(h, 'id', player.gatewayDeviceId) || !exactlyOne(h, 'id', player.starterServerDeviceId)) throw new Error('Dangling persisted Player topology Device.')
  }
  return value as OnlineWorldDocument
}

export class JsonWorldPersistence {
  constructor(readonly path: string) {}

  async loadOrCreate(): Promise<OnlineWorldDocument> {
    try {
      return validateOnlineWorldDocument(JSON.parse(await readFile(this.path, 'utf8')))
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      const initial = createInitialGameState()
      const home = initial.world.network.localNetworks.find(({ id }) => id === 'network-local-001')
      const personalIds = new Set(home?.memberDeviceIds ?? [])
      const personalAccountId = 'dollar-account-local-v0'
      const document: OnlineWorldDocument = {
        persistenceVersion: ONLINE_PERSISTENCE_VERSION, nextHomeSubnet: 1,
        shared: { playerDevices: [], state: { ...initial, market: { ...initial.market, purchases: { nextId: 1, entitlements: [] } }, dollarFinance: {
          ...initial.dollarFinance,
          accounts: initial.dollarFinance.accounts.filter(({ id }) => id !== personalAccountId),
          credentials: [],
          sessions: { nextId: 1, active: initial.dollarFinance.sessions.active.filter(({ accountId }) => accountId !== personalAccountId) },
        }, world: { network: {
          localNetworks: initial.world.network.localNetworks.filter(({ id }) => id !== 'network-local-001'),
          hosts: initial.world.network.hosts.filter(({ id }) => !personalIds.has(id)),
        } } } },
        accounts: [], sessions: [], players: [],
      }
      await this.save(document)
      return document
    }
  }

  async save(document: OnlineWorldDocument): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const temporary = `${this.path}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify(document)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, this.path)
  }
}

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createInitialGameState, GAME_STATE_VERSION } from '../core/game/initialState'
import type { OnlineWorldDocument } from './model'
import { ONLINE_PERSISTENCE_VERSION } from './model'
import { normalizeAccountName } from './password'

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

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

function hasDollarAccountShape(value: unknown): value is Record<string, unknown> {
  const account = record(value)
  return Boolean(account && nonEmptyString(account.id) && nonEmptyString(account.accountReference)
    && Number.isInteger(account.balanceCents))
}

function hasDollarSessionShape(value: unknown): value is Record<string, unknown> {
  const session = record(value)
  return Boolean(session && nonEmptyString(session.id) && nonEmptyString(session.accountId)
    && nonEmptyString(session.clientDeviceId))
}

function hasCanonicalPlayerDeviceShape(device: Record<string, unknown>): boolean {
  const network = record(device.network)
  const operational = record(device.operational)
  const lifecycleValues = new Set(['RUNNING', 'SHUTTING_DOWN', 'BOOTING'])
  const connectivityValues = new Set(['CONNECTED', 'DISCONNECTED', 'RECONNECTING'])
  return Boolean(network && typeof network.ip === 'string' && operational
    && lifecycleValues.has(operational.lifecycle as string)
    && connectivityValues.has(operational.connectivity as string)
    && Array.isArray(device.installedSoftware))
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
  const dollarAccount = record(privateState.dollarAccount)
  const dollarCredential = record(privateState.dollarCredential)
  return Number.isInteger(dollarSessions?.nextId) && Array.isArray(dollarSessions?.active)
    && dollarSessions.active.every(hasDollarSessionShape)
    && Array.isArray(record(privateState.marketPurchases)?.entitlements)
    && Array.isArray(record(privateState.discovery)?.devices)
    && Array.isArray(record(privateState.discovery)?.networks)
    && Array.isArray(record(privateState.discovery)?.networkDeviceRelations)
    && Array.isArray(record(privateState.process)?.processes)
    && Array.isArray(record(privateState.mail)?.threads)
    && Array.isArray(record(privateState.deviceAccess)?.established)
    && Array.isArray(record(privateState.networkManagement)?.established)
    && Array.isArray(record(privateState.recentActivity)?.entries)
    && nonEmptyString(record(privateState.nodeWallet)?.id)
    && hasDollarAccountShape(dollarAccount)
    && Boolean(dollarCredential && nonEmptyString(dollarCredential.id)
      && nonEmptyString(dollarCredential.accountId) && nonEmptyString(dollarCredential.loginIdentifier)
      && typeof dollarCredential.password === 'string' && dollarCredential.accountId === dollarAccount?.id)
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
  if (a.some((account) => !nonEmptyString(account.passwordHash) || !nonEmptyString(account.playerId)
    || normalizeAccountName(account.normalizedName as string) !== account.normalizedName)) throw new Error('Invalid persisted Account authentication structure.')
  if (s.some((session) => !nonEmptyString(session.accountId) || !nonEmptyString(session.createdAt))) throw new Error('Invalid persisted authentication Session structure.')
  const hostDeviceIds = new Set(h.map(({ id }) => id))
  if (d.some(({ id }) => hostDeviceIds.has(id))) throw new Error('Canonical Device identity collides across online Device registries.')
  const dollarFinance = record(state.dollarFinance)
  const sharedDollarSessions = record(dollarFinance?.sessions)
  if (!Array.isArray(dollarFinance?.accounts) || !Array.isArray(dollarFinance?.credentials)
    || !Number.isInteger(sharedDollarSessions?.nextId) || !Array.isArray(sharedDollarSessions?.active)
    || !Array.isArray(record(state.market)?.offers)
    || !Array.isArray(record(state.process)?.processes)) throw new Error('Invalid shared online runtime owner structure.')
  const sharedDollarAccounts = dollarFinance.accounts as unknown[]
  const sharedSessions = sharedDollarSessions.active as unknown[]
  if (!sharedDollarAccounts.every(hasDollarAccountShape) || !sharedSessions.every(hasDollarSessionShape)
    || !uniqueStrings(sharedDollarAccounts.map((account) => (account as Record<string, unknown>).id))
    || !uniqueStrings(sharedSessions.map((session) => (session as Record<string, unknown>).id))
    || !uniqueStrings(sharedSessions.map((session) => (session as Record<string, unknown>).clientDeviceId))
    || sharedSessions.some((session) => !exactlyOne(sharedDollarAccounts as Record<string, unknown>[], 'id', (session as Record<string, unknown>).accountId))) throw new Error('Invalid shared Civic Dollar runtime structure.')
  if (d.some((device) => !hasCanonicalPlayerDeviceShape(device))) throw new Error('Invalid canonical Player Device structure.')
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
    const privateState = player.privateState as Record<string, unknown>
    const personalAccount = privateState.dollarAccount as Record<string, unknown>
    const personalSessions = (privateState.dollarSessions as Record<string, unknown>).active as Record<string, unknown>[]
    if (sharedDollarAccounts.some((account) => (account as Record<string, unknown>).id === personalAccount.id)
      || !uniqueStrings(personalSessions.map(({ id }) => id))
      || !uniqueStrings(personalSessions.map(({ clientDeviceId }) => clientDeviceId))
      || personalSessions.some((session) => session.accountId !== personalAccount.id
        || !(player.ownedDeviceIds as unknown[]).includes(session.clientDeviceId)
        || sharedSessions.some((sharedSession) => (sharedSession as Record<string, unknown>).id === session.id
          || (sharedSession as Record<string, unknown>).clientDeviceId === session.clientDeviceId))) throw new Error('Invalid persisted Player Civic Dollar relationship.')
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

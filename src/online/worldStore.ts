import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { advanceGameState, advancePlayerOwnedGameState } from '../core/game/gameAdvancement'
import { findInstalledNodeScan } from '../core/game/software'
import { pingNetworkTarget } from '../core/game/ping'
import { scanNetworkTarget } from '../core/game/scan'
import { rememberPing, rememberScan } from '../core/game/discovery'
import { bootstrapPlayer, composePlayerSnapshot, resolveCanonicalPrimaryDevice } from './bootstrap'
import type { AuthenticatedSnapshot, OnlineWorldDocument, PlayerPrivateState } from './model'
import { hashPassword, normalizeAccountName, validateAuthenticationInput, verifyPassword } from './password'
import { JsonWorldPersistence } from './persistence'

const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url')

export class OnlineWorldStore {
  private document!: OnlineWorldDocument
  private transaction = Promise.resolve()
  private timer?: ReturnType<typeof setInterval>
  private lastTick = performance.now()
  constructor(private readonly persistence: JsonWorldPersistence) {}

  async open(): Promise<this> { this.document = await this.persistence.loadOrCreate(); return this }
  inspectForTests(): OnlineWorldDocument { return structuredClone(this.document) }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transaction.then(operation)
    this.transaction = result.then(() => undefined, () => undefined)
    return result
  }

  async enter(name: string, password: string): Promise<{ token: string; snapshot: AuthenticatedSnapshot; created: boolean }> {
    return this.run(async () => {
      const inputError = validateAuthenticationInput(name, password)
      if (inputError) throw new Error(inputError)
      const normalizedName = normalizeAccountName(name)
      const existing = this.document.accounts.find((account) => account.normalizedName === normalizedName)
      if (existing && !verifyPassword(password, existing.passwordHash)) throw new Error('Name or password is incorrect.')
      let account = existing
      let created = false
      if (!account) {
        const bootstrapped = bootstrapPlayer(this.document.shared, this.document.nextHomeSubnet)
        account = { id: randomUUID(), normalizedName, passwordHash: hashPassword(password), playerId: bootstrapped.player.id }
        this.document = { ...this.document, nextHomeSubnet: this.document.nextHomeSubnet + 1,
          shared: bootstrapped.shared, accounts: [...this.document.accounts, account], players: [...this.document.players, bootstrapped.player] }
        created = true
      }
      const token = randomBytes(32).toString('base64url')
      const session = { id: randomUUID(), accountId: account.id, tokenHash: tokenHash(token), createdAt: new Date().toISOString() }
      this.document = { ...this.document, sessions: [...this.document.sessions, session] }
      await this.persistence.save(this.document)
      return { token, snapshot: this.snapshotForAccount(account.id), created }
    })
  }

  private accountForToken(token: string) {
    const digest = tokenHash(token)
    const session = this.document.sessions.find((candidate) => candidate.tokenHash === digest)
    return session && this.document.accounts.find(({ id }) => id === session.accountId)
  }

  private snapshotForAccount(accountId: string): AuthenticatedSnapshot {
    const account = this.document.accounts.find(({ id }) => id === accountId)
    const player = account && this.document.players.find(({ id }) => id === account.playerId)
    if (!player) throw new Error('Authenticated Player truth is invalid.')
    resolveCanonicalPrimaryDevice(this.document.shared, player)
    return { playerId: player.id, state: composePlayerSnapshot(this.document.shared, player), homeNetworkId: player.homeNetworkId, gatewayDeviceId: player.gatewayDeviceId }
  }

  restore(token: string): AuthenticatedSnapshot | null {
    const account = this.accountForToken(token)
    return account ? this.snapshotForAccount(account.id) : null
  }

  async logout(token: string): Promise<void> { await this.run(async () => { const digest = tokenHash(token); this.document = { ...this.document, sessions: this.document.sessions.filter(({ tokenHash: hash }) => hash !== digest) }; await this.persistence.save(this.document) }) }

  async observe(token: string, kind: 'ping' | 'scan', input: string): Promise<unknown> {
    return this.run(async () => {
      const account = this.accountForToken(token); if (!account) throw new Error('Authentication required.')
      const index = this.document.players.findIndex(({ id }) => id === account.playerId); if (index < 0) throw new Error('Player not found.')
      const player = this.document.players[index]; const state = composePlayerSnapshot(this.document.shared, player)
      if (!findInstalledNodeScan(state.player.localDevice)) return { status: 'software_unavailable' }
      const result = kind === 'ping'
        ? pingNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, input)
        : scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, input)
      const discovery = kind === 'ping' ? rememberPing(state.discovery, result as ReturnType<typeof pingNetworkTarget>, state.player.primaryDeviceId) : rememberScan(state.discovery, result as ReturnType<typeof scanNetworkTarget>, state.player.primaryDeviceId)
      if (discovery !== state.discovery) {
        const privateState: PlayerPrivateState = { ...player.privateState, discovery }
        const players = [...this.document.players]; players[index] = { ...player, privateState }; this.document = { ...this.document, players }
        await this.persistence.save(this.document)
      }
      return { result, snapshot: this.snapshotForAccount(account.id) }
    })
  }

  startAdvancement(intervalMs = 250): void {
    if (this.timer) return
    this.lastTick = performance.now()
    this.timer = setInterval(() => { void this.advanceOnce() }, intervalMs)
  }
  async advanceOnce(elapsedOverride?: number): Promise<void> { await this.run(async () => {
    const now = performance.now(); const elapsed = elapsedOverride ?? now - this.lastTick; this.lastTick = now
    let shared = { ...this.document.shared, state: advanceGameState(this.document.shared.state, elapsed) }
    const players = this.document.players.map((player) => {
      const current = composePlayerSnapshot(shared, player); const next = advancePlayerOwnedGameState(current, elapsed)
      shared = { ...shared, playerDevices: shared.playerDevices.map((device) => device.id === player.primaryDeviceId ? next.player.localDevice : device) }
      return { ...player, privateState: { ...player.privateState, nodeWallet: next.nodeWallet, marketPurchases: next.market.purchases, knowledge: next.knowledge, discovery: next.discovery, deviceAccess: next.deviceAccess, networkManagement: next.networkManagement, remoteSession: next.remoteSession, fileTransfer: next.fileTransfer, rackUpdate: next.rackUpdate, mail: next.mail, process: next.process, recentActivity: next.recentActivity, dollarAccount: next.dollarFinance.accounts.find(({ id }) => id === player.privateState.dollarAccount.id) ?? player.privateState.dollarAccount, dollarCredential: next.dollarFinance.credentials.find(({ id }) => id === player.privateState.dollarCredential.id) ?? player.privateState.dollarCredential, dollarSessions: next.dollarFinance.sessions } }
    })
    this.document = { ...this.document, shared, players }; await this.persistence.save(this.document)
  }) }
  async stopAdvancement(): Promise<void> { if (this.timer) clearInterval(this.timer); this.timer = undefined; await this.transaction }
}

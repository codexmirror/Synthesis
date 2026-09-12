import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { advanceGameState } from '../core/game/gameAdvancement'
import { findInstalledNodeScan } from '../core/game/software'
import { pingNetworkTarget } from '../core/game/ping'
import { scanNetworkTarget } from '../core/game/scan'
import { rememberPing, rememberScan } from '../core/game/discovery'
import { bootstrapPlayer, composeCanonicalOperationState, projectAuthenticatedPlayerState, resolveCanonicalPrimaryDevice } from './bootstrap'
import type { AuthenticatedSnapshot, OnlineWorldDocument, PlayerPrivateState } from './model'
import { hashPassword, normalizeAccountName, validateAuthenticationInput, verifyPassword } from './password'
import type { WorldPersistence } from './persistence'

const tokenHash = (token: string) => createHash('sha256').update(token).digest('base64url')
export const ONLINE_CHECKPOINT_INTERVAL_MS = 7_500

export class OnlineWorldStore {
  private document!: OnlineWorldDocument
  private transaction = Promise.resolve()
  private advancementTimer?: ReturnType<typeof setInterval>
  private checkpointTimer?: ReturnType<typeof setInterval>
  private dirty = false
  private lastTick = performance.now()
  constructor(private readonly persistence: WorldPersistence) {}

  async open(): Promise<this> { this.document = await this.persistence.loadOrCreate(); return this }
  inspectForTests(): OnlineWorldDocument { return structuredClone(this.document) }
  isDirtyForTests(): boolean { return this.dirty }

  private run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.transaction.then(operation)
    this.transaction = result.then(() => undefined, () => undefined)
    return result
  }

  /** Persist a semantic candidate before it becomes canonical in memory. */
  private async commit(candidate: OnlineWorldDocument): Promise<void> {
    await this.persistence.save(candidate)
    this.document = candidate
    this.dirty = false
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
      let candidate = this.document
      if (!account) {
        const bootstrapped = bootstrapPlayer(candidate.shared, candidate.nextHomeSubnet)
        account = { id: randomUUID(), normalizedName, passwordHash: hashPassword(password), playerId: bootstrapped.player.id }
        candidate = { ...candidate, nextHomeSubnet: candidate.nextHomeSubnet + 1,
          shared: bootstrapped.shared, accounts: [...candidate.accounts, account], players: [...candidate.players, bootstrapped.player] }
        created = true
      }
      const token = randomBytes(32).toString('base64url')
      const session = { id: randomUUID(), accountId: account.id, tokenHash: tokenHash(token), createdAt: new Date().toISOString() }
      candidate = { ...candidate, sessions: [...candidate.sessions, session] }
      await this.commit(candidate)
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
    return { playerId: player.id, state: projectAuthenticatedPlayerState(this.document.shared, player, this.document.players), homeNetworkId: player.homeNetworkId, gatewayDeviceId: player.gatewayDeviceId }
  }

  restore(token: string): AuthenticatedSnapshot | null {
    const account = this.accountForToken(token)
    return account ? this.snapshotForAccount(account.id) : null
  }

  async logout(token: string): Promise<void> { await this.run(async () => { const digest = tokenHash(token); await this.commit({ ...this.document, sessions: this.document.sessions.filter(({ tokenHash: hash }) => hash !== digest) }) }) }

  async observe(token: string, kind: 'ping' | 'scan', input: string): Promise<unknown> {
    return this.run(async () => {
      const account = this.accountForToken(token); if (!account) throw new Error('Authentication required.')
      const index = this.document.players.findIndex(({ id }) => id === account.playerId); if (index < 0) throw new Error('Player not found.')
      const player = this.document.players[index]; const state = composeCanonicalOperationState(this.document.shared, player)
      if (!findInstalledNodeScan(state.player.localDevice)) return { result: { status: 'software_unavailable' }, snapshot: this.snapshotForAccount(account.id) }
      const result = kind === 'ping'
        ? pingNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, input)
        : scanNetworkTarget({ localDevice: state.player.localDevice, network: state.world.network }, input)
      const discovery = kind === 'ping' ? rememberPing(state.discovery, result as ReturnType<typeof pingNetworkTarget>, state.player.primaryDeviceId) : rememberScan(state.discovery, result as ReturnType<typeof scanNetworkTarget>, state.player.primaryDeviceId)
      if (discovery !== state.discovery) {
        const privateState: PlayerPrivateState = { ...player.privateState, discovery }
        const players = [...this.document.players]; players[index] = { ...player, privateState }
        await this.commit({ ...this.document, players })
      }
      return { result, snapshot: this.snapshotForAccount(account.id) }
    })
  }

  startAdvancement(intervalMs = 250, checkpointIntervalMs = ONLINE_CHECKPOINT_INTERVAL_MS): void {
    if (this.advancementTimer) return
    this.lastTick = performance.now()
    this.advancementTimer = setInterval(() => { void this.advanceOnce().catch((error) => console.error('Online simulation advancement failed.', error)) }, intervalMs)
    this.checkpointTimer = setInterval(() => { void this.checkpoint().catch((error) => console.error('Online persistence checkpoint failed; canonical state remains dirty.', error)) }, checkpointIntervalMs)
  }
  async advanceOnce(elapsedOverride?: number): Promise<void> { await this.run(async () => {
    const now = performance.now(); const elapsed = elapsedOverride ?? now - this.lastTick; this.lastTick = now
    const shared = { ...this.document.shared, state: advanceGameState(this.document.shared.state, elapsed) }
    this.document = { ...this.document, shared }; this.dirty = true
  }) }
  async checkpoint(): Promise<void> { await this.run(async () => {
    if (!this.dirty) return
    const candidate = this.document
    await this.persistence.save(candidate)
    if (this.document === candidate) this.dirty = false
  }) }
  stopAdvancementScheduling(): void {
    if (this.advancementTimer) clearInterval(this.advancementTimer)
    if (this.checkpointTimer) clearInterval(this.checkpointTimer)
    this.advancementTimer = undefined; this.checkpointTimer = undefined
  }
  async drainAndFlush(): Promise<void> { await this.checkpoint() }
  async stopAdvancement(): Promise<void> {
    this.stopAdvancementScheduling()
    await this.checkpoint()
  }
}

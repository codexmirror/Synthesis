import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonWorldPersistence } from './persistence'
import type { WorldPersistence } from './persistence'
import type { OnlineWorldDocument } from './model'
import { OnlineWorldStore } from './worldStore'
import { resolveDollarAccountForDevice } from '../core/game/dollarFinance'

const directories: string[] = []
async function fixture() { const directory = await mkdtemp(join(tmpdir(), 'synthesis-online-')); directories.push(directory); const path = join(directory, 'world.json'); return { path, store: await new OnlineWorldStore(new JsonWorldPersistence(path)).open() } }
class ControlledPersistence implements WorldPersistence {
  saves: OnlineWorldDocument[] = []
  failures = 0
  constructor(private persisted: OnlineWorldDocument) {}
  async loadOrCreate() { return structuredClone(this.persisted) }
  async save(document: OnlineWorldDocument) {
    if (this.failures > 0) { this.failures -= 1; throw new Error('injected persistence failure') }
    this.persisted = structuredClone(document); this.saves.push(structuredClone(document))
  }
  durable() { return structuredClone(this.persisted) }
}
async function controlledFixture() {
  const base = await fixture()
  const persistence = new ControlledPersistence(base.store.inspectForTests())
  return { persistence, store: await new OnlineWorldStore(persistence).open() }
}
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('OnlineWorldStore', () => {
  it('applies the local Scan eligibility boundary before resolving hidden canonical World truth', async () => {
    const { store, persistence } = await controlledFixture()
    const alice = await store.enter('alice', 'correct-horse-1')
    const bob = await store.enter('bob', 'correct-horse-2')
    const canonical = store.inspectForTests()
    const bobRecord = canonical.players.find(({ id }) => id === bob.snapshot.playerId)!
    const bobDevice = canonical.shared.playerDevices.find(({ id }) => id === bobRecord.primaryDeviceId)!
    const bobNetwork = canonical.shared.state.world.network.localNetworks.find(({ id }) => id === bobRecord.homeNetworkId)!
    const aliceNetwork = canonical.shared.state.world.network.localNetworks.find(({ id }) => id === alice.snapshot.homeNetworkId)!
    expect(aliceNetwork.name).toBe('home-net')
    expect(bobNetwork.name).toBe('home-net')
    const discoveryBefore = store.restore(alice.token)!.state.discovery
    const savesBefore = persistence.saves.length

    const hiddenHost = await store.observe(alice.token, 'scan', '203.0.113.42') as { result: { status: string; input?: string } }
    const hiddenNetwork = await store.observe(alice.token, 'scan', bobNetwork.cidr!) as { result: { status: string; input?: string }; snapshot: typeof alice.snapshot }
    expect(hiddenHost.result).toEqual({ status: 'unknown_target', input: '203.0.113.42' })
    expect(hiddenNetwork.result).toEqual({ status: 'unknown_target', input: bobNetwork.cidr })
    expect(hiddenNetwork.snapshot.state.discovery).toEqual(discoveryBefore)
    expect(hiddenNetwork.snapshot.state.world.network.localNetworks.some(({ id }) => id === bobRecord.homeNetworkId)).toBe(false)
    expect(persistence.saves).toHaveLength(savesBefore)

    const aliceHomeScan = await store.observe(alice.token, 'scan', 'home-net') as { result: { status: string; networkId?: string } }
    const bobHomeScan = await store.observe(bob.token, 'scan', 'home-net') as { result: { status: string; networkId?: string } }
    expect(aliceHomeScan.result).toMatchObject({ status: 'network', networkId: aliceNetwork.id })
    expect(bobHomeScan.result).toMatchObject({ status: 'network', networkId: bobNetwork.id })
    const bobDiscoveryAfterOwnScan = store.restore(bob.token)!.state.discovery
    const aliceDiscoveryAfterOwnScan = store.restore(alice.token)!.state.discovery

    // Bob's own home Network is a distinct LocalNetwork alice does not belong to, and his Gateway
    // represents no public exposure at all: different LocalNetworks are never automatically reachable,
    // so his own primary Device and Network stay unreachable to her.
    const ping = await store.observe(alice.token, 'ping', bobDevice.network.ip) as { result: { status: string } }
    expect(ping.result.status).toBe('no_response')
    const hostScan = await store.observe(alice.token, 'scan', bobDevice.network.ip) as { result: { status: string }; snapshot: typeof alice.snapshot }
    expect(hostScan.result.status).toBe('unknown_target')
    expect(hostScan.snapshot.state.discovery).toEqual(aliceDiscoveryAfterOwnScan)
    const networkScan = await store.observe(alice.token, 'scan', bobNetwork.cidr!) as { result: { status: string; input?: string } }
    expect(networkScan.result).toEqual({ status: 'unknown_target', input: bobNetwork.cidr })
    expect(store.restore(bob.token)!.state.discovery).toEqual(bobDiscoveryAfterOwnScan)
  })

  it('creates or authenticates without collapsing Account, Player, and Device identity', async () => {
    const { store, path } = await fixture()
    const alice = await store.enter(' Alice ', 'correct-horse-1')
    const restored = await store.enter('ALICE', 'correct-horse-1')
    expect(alice.created).toBe(true); expect(restored.created).toBe(false)
    expect(restored.snapshot.playerId).toBe(alice.snapshot.playerId)
    expect(alice.snapshot.state.player.id).not.toBe(alice.snapshot.state.player.primaryDeviceId)
    expect(alice.snapshot.state.player.ownedDeviceIds).toEqual([alice.snapshot.state.player.primaryDeviceId])
    expect(restored.snapshot.state.player.localDevice.network.ip).toBe(alice.snapshot.state.player.localDevice.network.ip)
    const persisted = await readFile(path, 'utf8'); expect(persisted).not.toContain('correct-horse-1'); expect(persisted).toContain('scrypt$')
    const before = store.inspectForTests()
    await expect(store.enter('alice', 'wrong-password-1')).rejects.toThrow('incorrect')
    const after = store.inspectForTests(); expect(after.accounts).toEqual(before.accounts); expect(after.players).toEqual(before.players); expect(after.nextHomeSubnet).toBe(before.nextHomeSubnet)
  })

  it('allocates isolated private state and one shared Bookstore world', async () => {
    const { store } = await fixture(); const alice = await store.enter('alice', 'correct-horse-1'); const bob = await store.enter('bob', 'correct-horse-2')
    expect(bob.snapshot.playerId).not.toBe(alice.snapshot.playerId)
    expect(bob.snapshot.state.player.primaryDeviceId).not.toBe(alice.snapshot.state.player.primaryDeviceId)
    expect(bob.snapshot.homeNetworkId).not.toBe(alice.snapshot.homeNetworkId)
    expect(bob.snapshot.state.player.localDevice.network.ip).not.toBe(alice.snapshot.state.player.localDevice.network.ip)
    expect(bob.snapshot.state.business.companies[0].id).toBe(alice.snapshot.state.business.companies[0].id)
    const persisted = store.inspectForTests()
    const currentAlice = store.restore(alice.token)!
    const currentBob = store.restore(bob.token)!
    const alicePayload = JSON.stringify(currentAlice)
    const bobPayload = JSON.stringify(currentBob)
    const aliceHomeTruth = persisted.shared.state.world.network.localNetworks.find(({ id }) => id === alice.snapshot.homeNetworkId)!
    const bobHomeTruth = persisted.shared.state.world.network.localNetworks.find(({ id }) => id === bob.snapshot.homeNetworkId)!
    const bobDeviceTruth = persisted.shared.playerDevices.find(({ id }) => id === bob.snapshot.state.player.primaryDeviceId)!
    const aliceDeviceTruth = persisted.shared.playerDevices.find(({ id }) => id === alice.snapshot.state.player.primaryDeviceId)!
    const bobRecord = persisted.players.find(({ id }) => id === bob.snapshot.playerId)!
    const aliceRecord = persisted.players.find(({ id }) => id === alice.snapshot.playerId)!
    for (const hidden of [bobRecord.primaryDeviceId, bobDeviceTruth.network.ip, bobRecord.homeNetworkId, bobHomeTruth.cidr!, bobRecord.gatewayDeviceId, bobRecord.starterServerDeviceId, bobDeviceTruth.savedDollarSignIn!.id, bobDeviceTruth.savedDollarSignIn!.password]) expect(alicePayload).not.toContain(hidden)
    for (const hidden of [aliceRecord.primaryDeviceId, aliceDeviceTruth.network.ip, aliceRecord.homeNetworkId, aliceHomeTruth.cidr!, aliceRecord.gatewayDeviceId, aliceRecord.starterServerDeviceId, aliceDeviceTruth.savedDollarSignIn!.id, aliceDeviceTruth.savedDollarSignIn!.password]) expect(bobPayload).not.toContain(hidden)
    expect(persisted.shared.playerDevices.map(({ id }) => id)).toEqual(expect.arrayContaining([alice.snapshot.state.player.primaryDeviceId, bob.snapshot.state.player.primaryDeviceId]))
    expect(persisted.players.every((player) => !('market' in player.privateState) && !('dollarFinance' in player.privateState))).toBe(true)
    expect(alice.snapshot.state.market.operator).toEqual(bob.snapshot.state.market.operator)
    expect(alice.snapshot.state.market.offers).toEqual(bob.snapshot.state.market.offers)
    expect(alice.snapshot.state.dollarFinance.provider).toEqual(bob.snapshot.state.dollarFinance.provider)
    expect(persisted.shared.state.dollarFinance.accounts.some(({ id }) => id === 'dollar-account-bookstore-treasury-v0')).toBe(true)
    expect(alice.snapshot.state.dollarFinance.accounts.at(-1)?.id).not.toBe(bob.snapshot.state.dollarFinance.accounts.at(-1)?.id)
    expect(resolveDollarAccountForDevice(alice.snapshot.state, 'host-phone-001')?.id).toBe('dollar-account-veyra-phone-v0')
    expect(resolveDollarAccountForDevice(bob.snapshot.state, 'host-phone-001')?.id).toBe('dollar-account-veyra-phone-v0')
    expect(alice.snapshot.state.dollarFinance.sessions.active).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'dollar-session-0002', clientDeviceId: 'host-phone-001' }), expect.objectContaining({ clientDeviceId: alice.snapshot.state.player.primaryDeviceId })]))
    expect(alice.snapshot.state.dollarFinance.sessions.active).not.toEqual(expect.arrayContaining([expect.objectContaining({ clientDeviceId: bob.snapshot.state.player.primaryDeviceId })]))
    expect(bob.snapshot.state.dollarFinance.sessions.active).not.toEqual(expect.arrayContaining([expect.objectContaining({ clientDeviceId: alice.snapshot.state.player.primaryDeviceId })]))
    expect(persisted.shared.state.dollarFinance.sessions.active).toEqual([expect.objectContaining({ id: 'dollar-session-0002', clientDeviceId: 'host-phone-001' })])
    expect(alice.snapshot.state.mail.account.id).not.toBe(bob.snapshot.state.mail.account.id)
    const aliceHome = alice.snapshot.state.world.network.localNetworks.find(({ id }) => id === alice.snapshot.homeNetworkId)!
    expect(aliceHome.memberDeviceIds).toContain(alice.snapshot.state.player.primaryDeviceId)
    // Bob's own home Network is a distinct LocalNetwork alice does not belong to, and his Gateway
    // represents no public exposure at all: his own primary Device stays unreachable to her.
    const bobPing = await store.observe(alice.token, 'ping', bobDeviceTruth.network.ip) as { result: { status: string; targetId?: string }; snapshot: typeof alice.snapshot }
    expect(bobPing.result).toEqual({ status: 'no_response', address: bobDeviceTruth.network.ip })
    expect(bobPing.snapshot.state.discovery.devices).not.toContainEqual(expect.objectContaining({ id: bobRecord.primaryDeviceId }))
    expect(JSON.stringify(bobPing.snapshot.state.player.localDevice)).not.toContain(bobDeviceTruth.savedDollarSignIn!.password)
    const bobScan = await store.observe(alice.token, 'scan', bobDeviceTruth.network.ip) as { result: { status: string; input?: string } }
    expect(bobScan.result).toEqual({ status: 'unknown_target', input: bobDeviceTruth.network.ip })
    await store.observe(alice.token, 'ping', '203.0.113.42')
    expect(store.restore(alice.token)?.state.discovery.devices).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'router-foreign-001' })]))
    expect(store.restore(alice.token)?.state.discovery.devices).not.toContainEqual(expect.objectContaining({ id: bobRecord.primaryDeviceId }))
    expect(store.restore(bob.token)?.state.discovery.devices).toHaveLength(0)
    expect(store.restore(bob.token)?.state.mail).not.toBe(store.restore(alice.token)?.state.mail)
    expect(store.restore(bob.token)?.state.nodeWallet.id).not.toBe(store.restore(alice.token)?.state.nodeWallet.id)
  })

  it('restores sessions and progression from versioned persistence and logs out', async () => {
    const { store, path } = await fixture(); const alice = await store.enter('alice', 'correct-horse-1'); await store.observe(alice.token, 'ping', '203.0.113.42')
    const restarted = await new OnlineWorldStore(new JsonWorldPersistence(path)).open()
    expect(restarted.restore(alice.token)?.state.discovery.devices[0].id).toBe('router-foreign-001')
    expect(restarted.restore(alice.token)?.state.player.primaryDeviceId).toBe(alice.snapshot.state.player.primaryDeviceId)
    await restarted.logout(alice.token); expect(restarted.restore(alice.token)).toBeNull()
  })

  it('returns the authoritative response contract when NodeScan is unavailable', async () => {
    const { store, path } = await fixture(); const alice = await store.enter('alice', 'correct-horse-1')
    const document = store.inspectForTests()
    await writeFile(path, JSON.stringify({ ...document, shared: { ...document.shared, playerDevices: document.shared.playerDevices.map((device) => device.id === alice.snapshot.state.player.primaryDeviceId ? { ...device, installedSoftware: [] } : device) } }))
    const restarted = await new OnlineWorldStore(new JsonWorldPersistence(path)).open()
    const response = await restarted.observe(alice.token, 'ping', '203.0.113.42') as { result: { status: string }; snapshot?: typeof alice.snapshot }
    expect(response.result).toEqual({ status: 'software_unavailable' })
    expect(response.snapshot?.playerId).toBe(alice.snapshot.playerId)
  })

  it('fails closed for corrupt or incompatible persistence', async () => {
    const { path } = await fixture(); await writeFile(path, '{bad json')
    await expect(new OnlineWorldStore(new JsonWorldPersistence(path)).open()).rejects.toThrow()
    await writeFile(path, JSON.stringify({ persistenceVersion: 999 }))
    await expect(new OnlineWorldStore(new JsonWorldPersistence(path)).open()).rejects.toThrow('Refusing to reset')
  })

  it('owns one advancement timer regardless of connected sessions', async () => {
    const { store } = await fixture(); await store.enter('alice', 'correct-horse-1'); await store.enter('bob', 'correct-horse-2')
    const before = store.inspectForTests().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs
    await store.advanceOnce(1_000)
    const after = store.inspectForTests().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs
    expect(before - after).toBe(1_000)
    store.startAdvancement(10); store.startAdvancement(10); await new Promise((resolve) => setTimeout(resolve, 35)); await store.stopAdvancement()
    expect(store.inspectForTests().accounts).toHaveLength(2)
  })

  it('publishes account, session, observation, and logout mutations only after persistence', async () => {
    const { store, persistence } = await controlledFixture()
    const empty = store.inspectForTests()
    persistence.failures = 1
    await expect(store.enter('rejected', 'correct-horse-1')).rejects.toThrow('injected')
    expect(store.inspectForTests()).toEqual(empty)
    const alice = await store.enter('alice', 'correct-horse-1')
    expect(store.inspectForTests().accounts.map(({ normalizedName }) => normalizedName)).toEqual(['alice'])
    const beforeSession = store.inspectForTests()
    persistence.failures = 1
    await expect(store.enter('alice', 'correct-horse-1')).rejects.toThrow('injected')
    expect(store.inspectForTests()).toEqual(beforeSession)
    await store.advanceOnce(250)
    const dirtyBeforeObservation = store.inspectForTests()
    persistence.failures = 1
    await expect(store.observe(alice.token, 'ping', '203.0.113.42')).rejects.toThrow('injected')
    expect(store.inspectForTests()).toEqual(dirtyBeforeObservation)
    expect(store.isDirtyForTests()).toBe(true)
    await store.checkpoint()
    expect(persistence.durable().players[0].privateState.discovery.devices).toHaveLength(0)
    const beforeLogout = store.inspectForTests()
    persistence.failures = 1
    await expect(store.logout(alice.token)).rejects.toThrow('injected')
    expect(store.inspectForTests()).toEqual(beforeLogout)
    expect(store.restore(alice.token)).not.toBeNull()
  })

  it('checkpoints passive advancement separately from 250 ms simulation ticks', async () => {
    const { store, persistence } = await controlledFixture()
    const before = store.inspectForTests().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs
    await store.advanceOnce(250); await store.advanceOnce(250); await store.advanceOnce(250)
    expect(persistence.saves).toHaveLength(0)
    expect(before - store.inspectForTests().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs).toBe(750)
    expect(store.isDirtyForTests()).toBe(true)
    persistence.failures = 1
    await expect(store.checkpoint()).rejects.toThrow('injected')
    expect(store.isDirtyForTests()).toBe(true)
    await store.checkpoint()
    expect(store.isDirtyForTests()).toBe(false)
    expect(persistence.saves).toHaveLength(1)
    expect(persistence.durable().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs).toBe(before - 750)
  })

  it('includes dirty advancement in semantic commits and flushes it on clean stop', async () => {
    const first = await controlledFixture()
    const before = first.store.inspectForTests().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs
    await first.store.advanceOnce(500)
    const alice = await first.store.enter('alice', 'correct-horse-1')
    expect(first.store.isDirtyForTests()).toBe(false)
    expect(first.persistence.durable().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs).toBe(before - 500)
    expect(first.persistence.durable().accounts).toHaveLength(1)
    expect(alice.created).toBe(true)
    await first.store.advanceOnce(250)
    await first.store.stopAdvancement()
    expect(first.store.isDirtyForTests()).toBe(false)
    expect(first.persistence.durable().shared.state.bookstoreSalesCadence.records[0].remainingUntilOpportunityMs).toBe(before - 750)
  })

  it('shared advancement never mutates canonical Player-private state', async () => {
    const { store } = await controlledFixture()
    await store.enter('alice', 'correct-horse-1')
    const privateBefore = store.inspectForTests().players[0].privateState
    await store.advanceOnce(1_000)
    expect(store.inspectForTests().players[0].privateState).toEqual(privateBefore)
  })

})

describe('online persistence admission', () => {
  async function expectInvalid(mutate: (document: OnlineWorldDocument) => unknown, message?: string) {
    const { path, store } = await fixture()
    const alice = await store.enter('alice', 'correct-horse-1')
    const value = mutate(store.inspectForTests())
    const malformed = JSON.stringify(value)
    await writeFile(path, malformed)
    await expect(new OnlineWorldStore(new JsonWorldPersistence(path)).open()).rejects.toThrow(message)
    expect(await readFile(path, 'utf8')).toBe(malformed)
    expect(alice.created).toBe(true)
  }

  async function expectInvalidTwoPlayers(mutate: (document: OnlineWorldDocument) => unknown, message?: string) {
    const { path, store } = await fixture()
    await store.enter('alice', 'correct-horse-1')
    await store.enter('bob', 'correct-horse-2')
    const malformed = JSON.stringify(mutate(store.inspectForTests()))
    await writeFile(path, malformed)
    await expect(new OnlineWorldStore(new JsonWorldPersistence(path)).open()).rejects.toThrow(message)
    expect(await readFile(path, 'utf8')).toBe(malformed)
  }

  it('rejects missing structure and invalid allocator values, while admitting exhausted 255', async () => {
    await expectInvalid((document) => { const { accounts: _accounts, ...missingAccounts } = document; return missingAccounts }, 'structure')
    await expectInvalid((document) => ({ ...document, nextHomeSubnet: 0 }), 'allocator')
    await expectInvalid((document) => ({ ...document, nextHomeSubnet: 256 }), 'allocator')
    const { path, store } = await fixture(); await store.enter('alice', 'correct-horse-1')
    await writeFile(path, JSON.stringify({ ...store.inspectForTests(), nextHomeSubnet: 255 }))
    await expect(new OnlineWorldStore(new JsonWorldPersistence(path)).open()).resolves.toBeInstanceOf(OnlineWorldStore)
  })

  it('rejects duplicate authentication and simulation identities', async () => {
    await expectInvalid((d) => ({ ...d, accounts: [...d.accounts, d.accounts[0]] }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, accounts: [...d.accounts, { ...d.accounts[0], id: 'account-other' }] }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, players: [...d.players, d.players[0]] }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, shared: { ...d.shared, playerDevices: [...d.shared.playerDevices, d.shared.playerDevices[0]] } }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, sessions: [...d.sessions, d.sessions[0]] }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, sessions: [...d.sessions, { ...d.sessions[0], id: 'session-other' }] }), 'Duplicate')
  })

  it('rejects dangling authentication, ownership, and generated topology relationships', async () => {
    await expectInvalid((d) => ({ ...d, accounts: d.accounts.map((a) => ({ ...a, playerId: 'missing' })) }), 'authentication')
    await expectInvalid((d) => ({ ...d, sessions: d.sessions.map((s) => ({ ...s, accountId: 'missing' })) }), 'authentication')
    await expectInvalid((d) => ({ ...d, players: d.players.map((p) => ({ ...p, ownedDeviceIds: [p.primaryDeviceId, p.primaryDeviceId] })) }), 'ownership')
    await expectInvalid((d) => ({ ...d, players: d.players.map((p) => ({ ...p, ownedDeviceIds: ['other'] })) }), 'ownership')
    await expectInvalid((d) => ({ ...d, shared: { ...d.shared, playerDevices: [] } }), 'ownership')
    await expectInvalid((d) => ({ ...d, players: d.players.map((p) => ({ ...p, homeNetworkId: 'missing' })) }), 'Home Network')
    await expectInvalid((d) => ({ ...d, players: d.players.map((p) => ({ ...p, gatewayDeviceId: 'missing' })) }), 'topology')
    await expectInvalid((d) => ({ ...d, players: d.players.map((p) => ({ ...p, starterServerDeviceId: 'missing' })) }), 'topology')
  })

  it('rejects missing Player-private and shared runtime owners', async () => {
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {} })) }), 'private runtime')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => {
      const { discovery: _discovery, ...privateState } = player.privateState
      return { ...player, privateState }
    }) }), 'private runtime')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: { ...player.privateState, dollarSessions: { ...player.privateState.dollarSessions, active: {} } } })) }), 'private runtime')
    await expectInvalid((d) => {
      const { market: _market, ...state } = d.shared.state
      return { ...d, shared: { ...d.shared, state } }
    }, 'structure')
  })

  it('rejects cross-Player ownership and generated-topology conflicts', async () => {
    await expectInvalidTwoPlayers((d) => ({ ...d, players: d.players.map((player, index) => index === 1
      ? { ...player, primaryDeviceId: d.players[0].primaryDeviceId, ownedDeviceIds: [d.players[0].primaryDeviceId] }
      : player) }), 'cross-Player')
    await expectInvalidTwoPlayers((d) => ({ ...d, players: d.players.map((player, index) => index === 1
      ? { ...player, ownedDeviceIds: [player.primaryDeviceId, d.players[0].primaryDeviceId] }
      : player) }), 'cross-Player')
    for (const key of ['homeNetworkId', 'gatewayDeviceId', 'starterServerDeviceId'] as const) {
      await expectInvalidTwoPlayers((d) => ({ ...d, players: d.players.map((player, index) => index === 1
        ? { ...player, [key]: d.players[0][key] }
        : player) }), 'cross-Player')
    }
  })

  it('rejects ambiguous canonical Device and Network stable identities', async () => {
    await expectInvalid((d) => ({ ...d, shared: { ...d.shared, state: { ...d.shared.state, world: { network: {
      ...d.shared.state.world.network,
      hosts: [...d.shared.state.world.network.hosts, d.shared.state.world.network.hosts[0]],
    } } } } }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, shared: { ...d.shared, state: { ...d.shared.state, world: { network: {
      ...d.shared.state.world.network,
      localNetworks: [...d.shared.state.world.network.localNetworks, d.shared.state.world.network.localNetworks[0]],
    } } } } }), 'Duplicate')
    await expectInvalid((d) => ({ ...d, shared: { ...d.shared, state: { ...d.shared.state, world: { network: {
      ...d.shared.state.world.network,
      hosts: [...d.shared.state.world.network.hosts, d.shared.playerDevices[0]],
    } } } } }), 'collides')
  })

  it('rejects collapsed Primary, Gateway, and starter-server Device roles', async () => {
    for (const [target, source] of [
      ['gatewayDeviceId', 'primaryDeviceId'],
      ['starterServerDeviceId', 'primaryDeviceId'],
      ['starterServerDeviceId', 'gatewayDeviceId'],
    ] as const) {
      await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, [target]: player[source] })) }), 'not distinct')
    }
  })

  it('rejects malformed Account and authentication Session scalars', async () => {
    await expectInvalid((d) => ({ ...d, accounts: d.accounts.map((account) => {
      const { passwordHash: _passwordHash, ...malformed } = account
      return malformed
    }) }), 'Account authentication')
    await expectInvalid((d) => ({ ...d, accounts: d.accounts.map((account) => ({ ...account, passwordHash: 42 })) }), 'Account authentication')
    await expectInvalid((d) => ({ ...d, accounts: d.accounts.map((account) => ({ ...account, normalizedName: 'Alice' })) }), 'Account authentication')
    await expectInvalid((d) => ({ ...d, sessions: d.sessions.map((session) => {
      const { createdAt: _createdAt, ...malformed } = session
      return malformed
    }) }), 'Session structure')
    await expectInvalid((d) => ({ ...d, sessions: d.sessions.map((session) => ({ ...session, createdAt: 42 })) }), 'Session structure')
  })

  it('rejects malformed Player-private Civic Dollar relationships', async () => {
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {
      ...player.privateState, dollarAccount: { id: player.privateState.dollarAccount.id },
    } })) }), 'private runtime')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {
      ...player.privateState, dollarCredential: { ...player.privateState.dollarCredential, accountId: undefined },
    } })) }), 'private runtime')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {
      ...player.privateState, dollarCredential: { ...player.privateState.dollarCredential, accountId: 'missing-account' },
    } })) }), 'private runtime')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {
      ...player.privateState, dollarSessions: { ...player.privateState.dollarSessions, active: [{ id: 'session-bad', clientDeviceId: player.primaryDeviceId }] },
    } })) }), 'private runtime')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {
      ...player.privateState, dollarSessions: { ...player.privateState.dollarSessions, active: [{ id: 'session-bad', accountId: 'missing-account', clientDeviceId: player.primaryDeviceId }] },
    } })) }), 'Civic Dollar relationship')
    await expectInvalid((d) => ({ ...d, players: d.players.map((player) => ({ ...player, privateState: {
      ...player.privateState, dollarSessions: { ...player.privateState.dollarSessions, active: [{ id: 'session-bad', accountId: player.privateState.dollarAccount.id, clientDeviceId: 'not-owned' }] },
    } })) }), 'Civic Dollar relationship')
  })

  it('rejects canonical Player Devices without usable operational truth', async () => {
    await expectInvalid((d) => ({ ...d, shared: { ...d.shared, playerDevices: d.shared.playerDevices.map((device) => {
      const { operational: _operational, ...malformed } = device
      return malformed
    }) } }), 'Player Device structure')
    for (const operational of [
      { lifecycle: 'INVALID', connectivity: 'CONNECTED' },
      { lifecycle: 'RUNNING', connectivity: 'INVALID' },
    ]) {
      await expectInvalid((d) => ({ ...d, shared: { ...d.shared, playerDevices: d.shared.playerDevices.map((device) => ({ ...device, operational })) } }), 'Player Device structure')
    }
  })
})

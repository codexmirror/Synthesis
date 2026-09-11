import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { JsonWorldPersistence } from './persistence'
import { OnlineWorldStore } from './worldStore'
import { resolveDollarAccountForDevice } from '../core/game/dollarFinance'

const directories: string[] = []
async function fixture() { const directory = await mkdtemp(join(tmpdir(), 'synthesis-online-')); directories.push(directory); const path = join(directory, 'world.json'); return { path, store: await new OnlineWorldStore(new JsonWorldPersistence(path)).open() } }
afterEach(async () => { await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))) })

describe('OnlineWorldStore', () => {
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
    const bobPing = await store.observe(alice.token, 'ping', bob.snapshot.state.player.localDevice.network.ip) as { result: { status: string; targetId?: string } }
    expect(bobPing.result).toMatchObject({ status: 'device', targetId: bob.snapshot.state.player.primaryDeviceId })
    await store.observe(alice.token, 'ping', '203.0.113.42')
    expect(store.restore(alice.token)?.state.discovery.devices).toHaveLength(2)
    expect(store.restore(bob.token)?.state.discovery.devices).toHaveLength(0)
    expect(store.restore(bob.token)?.state.mail).not.toBe(store.restore(alice.token)?.state.mail)
    expect(store.restore(bob.token)?.state.nodeWallet.id).not.toBe(store.restore(alice.token)?.state.nodeWallet.id)
  })

  it('restores sessions and progression from versioned persistence and logs out', async () => {
    const { store, path } = await fixture(); const alice = await store.enter('alice', 'correct-horse-1'); await store.observe(alice.token, 'ping', '203.0.113.42')
    const restarted = await new OnlineWorldStore(new JsonWorldPersistence(path)).open()
    expect(restarted.restore(alice.token)?.state.discovery.devices[0].id).toBe('host-lan-002')
    expect(restarted.restore(alice.token)?.state.player.primaryDeviceId).toBe(alice.snapshot.state.player.primaryDeviceId)
    await restarted.logout(alice.token); expect(restarted.restore(alice.token)).toBeNull()
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

})

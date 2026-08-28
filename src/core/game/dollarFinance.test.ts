import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { authenticateDollarAccount, logoutDollarAccount, resolveDollarAccountForDevice } from './dollarFinance'
import type { GameState, NetworkHost } from './types'

const signedOut = (state = createInitialGameState()): GameState => ({ ...state, dollarFinance: { ...state.dollarFinance, sessions: { ...state.dollarFinance.sessions, active: [] } } })
const secondDevice = (state: GameState): NetworkHost => state.world.network.hosts.find(({ id }) => id === 'host-lan-001')!

describe('Dollar Financial Provider', () => {
  it('seeds separate Provider, Account, Credential and local Device-bound Session identities with preserved wealth and unique references', () => {
    const state = createInitialGameState(); const account = state.dollarFinance.accounts[0]; const credential = state.dollarFinance.credentials[0]
    expect(state.dollarFinance.accounts).toHaveLength(1); expect(account.balanceCents).toBe(125_000)
    expect(new Set(state.dollarFinance.accounts.map(({ accountReference }) => accountReference)).size).toBe(state.dollarFinance.accounts.length)
    expect(new Set(state.dollarFinance.credentials.map(({ loginIdentifier }) => loginIdentifier)).size).toBe(state.dollarFinance.credentials.length)
    expect(account.id).not.toBe(account.accountReference); expect(account.id).not.toBe(credential.loginIdentifier)
    expect(account.id).not.toBe(state.player.id); expect(account.id).not.toBe(state.player.localDevice.id)
    expect(account.accountReference).not.toBe(credential.loginIdentifier)
    expect(resolveDollarAccountForDevice(state, state.player.localDevice.id)).toBe(account)
  })

  it('authenticates exact credentials on represented Devices without copying secrets or mutating economic/Credential truth', () => {
    const before = signedOut(); const credential = before.dollarFinance.credentials[0]; const account = before.dollarFinance.accounts[0]
    const result = authenticateDollarAccount(before, before.player.localDevice.id, credential.loginIdentifier, credential.password)
    expect(result.status).toBe('authenticated'); if (result.status !== 'authenticated') return
    expect(result.state.dollarFinance.accounts).toEqual(before.dollarFinance.accounts)
    expect(result.state.dollarFinance.credentials).toEqual(before.dollarFinance.credentials)
    expect(resolveDollarAccountForDevice(result.state, before.player.localDevice.id)).toEqual(account)
    expect(result.state.dollarFinance.sessions.active).toEqual([{ id: 'dollar-session-0002', accountId: account.id, clientDeviceId: before.player.localDevice.id }])
    expect(result.state.dollarFinance.sessions.active[0]).not.toHaveProperty('password')
    expect(JSON.stringify(result.state.dollarFinance.sessions.active)).not.toContain(credential.password)
  })

  it.each([['wrong password', 'local.civic', 'wrong'], ['unknown login', 'nobody', 'violet-orbit-7']])('%s creates no authority', (_label, login, password) => {
    const before = signedOut(); const result = authenticateDollarAccount(before, before.player.localDevice.id, login, password)
    expect(result.status).toBe('invalid_credentials'); expect(result.state).toBe(before); expect(result.state.dollarFinance.sessions.active).toHaveLength(0)
  })

  it('fails closed when duplicate login identifiers make Credential resolution ambiguous', () => {
    const before = createInitialGameState()
    const credential = before.dollarFinance.credentials[0]
    const malformed: GameState = {
      ...before,
      dollarFinance: {
        ...before.dollarFinance,
        credentials: [...before.dollarFinance.credentials, { ...credential, id: 'dollar-credential-duplicate', password: 'different-secret' }],
      },
    }
    const result = authenticateDollarAccount(malformed, before.player.localDevice.id, credential.loginIdentifier, credential.password)
    expect(result).toEqual({ status: 'invalid_credentials', state: malformed })
    expect(result.state.dollarFinance.sessions).toBe(malformed.dollarFinance.sessions)
    expect(result.state.nodeWallet).toBe(malformed.nodeWallet)
    expect(result.state.nodeEconomy).toBe(malformed.nodeEconomy)
  })

  it('failed authentication preserves an existing valid Session', () => {
    const before = createInitialGameState(); const result = authenticateDollarAccount(before, before.player.localDevice.id, 'local.civic', 'wrong')
    expect(result.state).toBe(before); expect(resolveDollarAccountForDevice(result.state, before.player.localDevice.id)).toEqual(before.dollarFinance.accounts[0])
  })

  it('replaces one Device Session with a newly allocated identity for another Account while preserving other Devices and all Account/Credential truth', () => {
    const base = createInitialGameState(); const remote = secondDevice(base)
    const accountB = { id: 'dollar-account-b', accountReference: 'CD-2000-0002', balanceCents: 9_876 }
    const credentialB = { id: 'dollar-credential-b', accountId: accountB.id, loginIdentifier: 'second.civic', password: 'second-secret' }
    const withFixtures: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: [...base.dollarFinance.accounts, accountB], credentials: [...base.dollarFinance.credentials, credentialB] } }
    const first = authenticateDollarAccount(withFixtures, remote.id, 'local.civic', 'violet-orbit-7'); expect(first.status).toBe('authenticated'); if (first.status !== 'authenticated') return
    const replaced = authenticateDollarAccount(first.state, base.player.localDevice.id, credentialB.loginIdentifier, credentialB.password); expect(replaced.status).toBe('authenticated'); if (replaced.status !== 'authenticated') return
    expect(replaced.state.dollarFinance.sessions.active.filter(({ clientDeviceId }) => clientDeviceId === base.player.localDevice.id)).toHaveLength(1)
    expect(resolveDollarAccountForDevice(replaced.state, base.player.localDevice.id)?.id).toBe(accountB.id)
    expect(resolveDollarAccountForDevice(replaced.state, remote.id)?.id).toBe(base.dollarFinance.accounts[0].id)
    expect(replaced.state.dollarFinance.accounts).toEqual(withFixtures.dollarFinance.accounts); expect(replaced.state.dollarFinance.credentials).toEqual(withFixtures.dollarFinance.credentials)
  })

  it('logout affects only the acting Device and leaves NODE, balances, Credentials and another Device Session untouched', () => {
    const base = createInitialGameState(); const remote = secondDevice(base); const auth = authenticateDollarAccount(base, remote.id, 'local.civic', 'violet-orbit-7'); if (auth.status !== 'authenticated') throw new Error(auth.status)
    const result = logoutDollarAccount(auth.state, base.player.localDevice.id); expect(result.status).toBe('logged_out')
    expect(resolveDollarAccountForDevice(result.state, base.player.localDevice.id)).toBeUndefined(); expect(resolveDollarAccountForDevice(result.state, remote.id)?.id).toBe(base.dollarFinance.accounts[0].id)
    expect(result.state.dollarFinance.accounts).toEqual(base.dollarFinance.accounts); expect(result.state.dollarFinance.credentials).toEqual(base.dollarFinance.credentials)
    expect(result.state.nodeWallet).toBe(base.nodeWallet); expect(result.state.nodeEconomy).toBe(base.nodeEconomy)
    expect(logoutDollarAccount(result.state, base.player.localDevice.id)).toEqual({ status: 'not_signed_in', state: result.state })
  })

  it('fails closed without a Session and rejects invented Devices regardless of Player, DeviceAccess or RemoteSession state', () => {
    const base = signedOut(); const misleading: GameState = { ...base, deviceAccess: { nextId: 2, established: [{ id: 'access-x', sourceDeviceId: base.player.localDevice.id, targetDeviceId: 'host-lan-001', viaServiceId: 'service-ssh-001', privilege: 'USER' }] }, remoteSession: { nextId: 2, active: { id: 'remote-x', accessId: 'access-x', connectedAddress: '198.51.100.47' } } }
    expect(resolveDollarAccountForDevice(misleading, base.player.localDevice.id)).toBeUndefined()
    expect(resolveDollarAccountForDevice(misleading, base.player.id)).toBeUndefined()
    expect(authenticateDollarAccount(misleading, 'ghost-device', 'local.civic', 'violet-orbit-7')).toEqual({ status: 'device_not_found', state: misleading })
    const dangling: GameState = { ...misleading, dollarFinance: { ...misleading.dollarFinance, sessions: { ...misleading.dollarFinance.sessions, active: [{ id: 'dangling', accountId: 'missing', clientDeviceId: base.player.localDevice.id }] } } }
    expect(resolveDollarAccountForDevice(dangling, base.player.localDevice.id)).toBeUndefined()
  })

  it('rejects a shallow NetworkHost as a Financial Session client', () => {
    const before = signedOut()
    const shallowHost = before.world.network.hosts.find(({ id }) => id === 'host-training-002')!
    const result = authenticateDollarAccount(before, shallowHost.id, 'local.civic', 'violet-orbit-7')
    expect(result).toEqual({ status: 'device_not_found', state: before })
    expect(result.state.dollarFinance.sessions.active).toHaveLength(0)
  })
})

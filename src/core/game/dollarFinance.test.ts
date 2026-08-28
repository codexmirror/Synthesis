import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { authenticateDollarAccount, authenticateDollarAccountWithSavedSignIn, findDeviceSavedDollarSignIn, logoutDollarAccount, projectDollarAccountActivity, resolveDollarAccountForDevice, transferDollars } from './dollarFinance'
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

/**
 * Two Accounts and a matching Credential exist only as a test fixture: the
 * production world still contains exactly the player's own Account, and a
 * foreign Account arrives when concrete gameplay introduces whoever holds it.
 */
const RECIPIENT = { id: 'dollar-account-fixture-b', accountReference: 'CD-2000-0002', balanceCents: 4_000 }
const RECIPIENT_CREDENTIAL = { id: 'dollar-credential-fixture-b', accountId: RECIPIENT.id, loginIdentifier: 'second.civic', password: 'second-secret' }

function withRecipient(state = createInitialGameState()): GameState {
  return { ...state, dollarFinance: { ...state.dollarFinance, accounts: [...state.dollarFinance.accounts, RECIPIENT], credentials: [...state.dollarFinance.credentials, RECIPIENT_CREDENTIAL] } }
}

const balanceOf = (state: GameState, accountId: string): number => state.dollarFinance.accounts.find(({ id }) => id === accountId)!.balanceCents

describe('Dollar transfers', () => {
  it('denies a transfer from a Device with no Financial Session and mutates nothing', () => {
    const before = signedOut(withRecipient())
    const result = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 500)
    expect(result).toEqual({ status: 'not_signed_in', state: before })
    expect(result.state.dollarFinance.transactions.records).toHaveLength(0)
  })

  it('denies a transfer authorized only by a dangling Session', () => {
    const base = withRecipient()
    const dangling: GameState = { ...base, dollarFinance: { ...base.dollarFinance, sessions: { ...base.dollarFinance.sessions, active: [{ id: 'dangling', accountId: 'missing-account', clientDeviceId: base.player.localDevice.id }] } } }
    expect(transferDollars(dangling, base.player.localDevice.id, RECIPIENT.accountReference, 500)).toEqual({ status: 'not_signed_in', state: dangling })
  })

  it('derives the source Account from the acting Device Session, so presentation cannot choose whose money moves', () => {
    const base = withRecipient()
    const local = base.dollarFinance.accounts[0]
    // The local Device's Session authorizes the local Account; another Device is signed in to the recipient Account.
    const remote = base.world.network.hosts.find(({ id }) => id === 'host-lan-001')!
    const authenticated = authenticateDollarAccount(base, remote.id, RECIPIENT_CREDENTIAL.loginIdentifier, RECIPIENT_CREDENTIAL.password)
    if (authenticated.status !== 'authenticated') throw new Error(authenticated.status)

    const fromLocal = transferDollars(authenticated.state, base.player.localDevice.id, RECIPIENT.accountReference, 1_000)
    expect(fromLocal.status).toBe('transferred')
    if (fromLocal.status !== 'transferred') return
    expect(fromLocal.state.dollarFinance.transactions.records[0].sourceAccountId).toBe(local.id)

    // The same Provider-scoped reference from the other Device debits that Device's Account instead.
    const fromRemote = transferDollars(authenticated.state, remote.id, local.accountReference, 1_000)
    expect(fromRemote.status).toBe('transferred')
    if (fromRemote.status !== 'transferred') return
    expect(fromRemote.state.dollarFinance.transactions.records[0].sourceAccountId).toBe(RECIPIENT.id)

    // There is no argument through which a caller could have named a source Account.
    expect(transferDollars.length).toBe(4)
  })

  it.each([
    ['an unknown recipient reference', 'CD-0000-0000', 500, 'recipient_not_found'],
    ['the acting Account itself', 'CD-1042-7781', 500, 'recipient_is_source'],
    ['a zero amount', 'CD-2000-0002', 0, 'invalid_amount'],
    ['a negative amount', 'CD-2000-0002', -500, 'invalid_amount'],
    ['a fractional cent amount', 'CD-2000-0002', 12.5, 'invalid_amount'],
    ['an amount beyond exact integer representation', 'CD-2000-0002', Number.MAX_SAFE_INTEGER + 2, 'invalid_amount'],
    ['more money than the source holds', 'CD-2000-0002', 125_001, 'insufficient_funds'],
  ])('refuses %s without mutating any balance or appending a Transaction', (_label, reference, amountCents, status) => {
    const before = withRecipient()
    const result = transferDollars(before, before.player.localDevice.id, reference, amountCents)
    expect(result).toEqual({ status, state: before })
    expect(result.state.dollarFinance.accounts).toEqual(before.dollarFinance.accounts)
    expect(result.state.dollarFinance.transactions).toEqual({ nextId: 1, records: [] })
  })

  it('fails closed when the recipient reference matches more than one Account', () => {
    const base = withRecipient()
    const ambiguous: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: [...base.dollarFinance.accounts, { ...RECIPIENT, id: 'dollar-account-fixture-c', balanceCents: 1 }] } }
    const result = transferDollars(ambiguous, base.player.localDevice.id, RECIPIENT.accountReference, 500)
    expect(result).toEqual({ status: 'recipient_ambiguous', state: ambiguous })
    expect(result.state.dollarFinance.accounts).toEqual(ambiguous.dollarFinance.accounts)
    expect(result.state.dollarFinance.transactions.records).toHaveLength(0)
  })

  it('debits the source exactly, credits the recipient exactly, and conserves represented Dollars', () => {
    const before = withRecipient()
    const total = before.dollarFinance.accounts.reduce((sum, { balanceCents }) => sum + balanceCents, 0)
    const result = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 37_512)
    expect(result.status).toBe('transferred')
    expect(balanceOf(result.state, 'dollar-account-local-v0')).toBe(125_000 - 37_512)
    expect(balanceOf(result.state, RECIPIENT.id)).toBe(4_000 + 37_512)
    expect(result.state.dollarFinance.accounts.reduce((sum, { balanceCents }) => sum + balanceCents, 0)).toBe(total)
  })

  it('permits a transfer of the entire balance and leaves the source at exactly zero', () => {
    const before = withRecipient()
    const result = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 125_000)
    expect(result.status).toBe('transferred')
    expect(balanceOf(result.state, 'dollar-account-local-v0')).toBe(0)
  })

  it('appends exactly one Transaction with stable identity and both historical Account references', () => {
    const before = withRecipient()
    const first = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 2_500)
    if (first.status !== 'transferred') throw new Error(first.status)
    expect(first.state.dollarFinance.transactions.records).toEqual([{
      id: 'dollar-transaction-0001',
      sourceAccountId: 'dollar-account-local-v0',
      destinationAccountId: RECIPIENT.id,
      amountCents: 2_500,
      sourceAccountReference: 'CD-1042-7781',
      destinationAccountReference: RECIPIENT.accountReference,
    }])
    expect(first.transactionId).toBe('dollar-transaction-0001')

    const second = transferDollars(first.state, before.player.localDevice.id, RECIPIENT.accountReference, 100)
    if (second.status !== 'transferred') throw new Error(second.status)
    expect(second.state.dollarFinance.transactions.records.map(({ id }) => id)).toEqual(['dollar-transaction-0001', 'dollar-transaction-0002'])
    // Transaction identity is not the Account, the reference, the Session or the Device.
    expect(new Set(second.state.dollarFinance.transactions.records.map(({ id }) => id)).size).toBe(2)
  })

  it('keeps historical counterparty references when an Account reference later changes', () => {
    const before = withRecipient()
    const sent = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 2_500)
    if (sent.status !== 'transferred') throw new Error(sent.status)
    const renamed: GameState = { ...sent.state, dollarFinance: { ...sent.state.dollarFinance, accounts: sent.state.dollarFinance.accounts.map((account) => account.id === RECIPIENT.id ? { ...account, accountReference: 'CD-9999-9999' } : account) } }

    expect(renamed.dollarFinance.transactions.records[0].destinationAccountReference).toBe('CD-2000-0002')
    expect(projectDollarAccountActivity(renamed, 'dollar-account-local-v0')[0].counterpartyReference).toBe('CD-2000-0002')
    // Renaming is not a re-parenting: the Transaction still concerns the same stable Account.
    expect(renamed.dollarFinance.transactions.records[0].destinationAccountId).toBe(RECIPIENT.id)
  })

  it('leaves unrelated Accounts, Credentials, Sessions and NODE untouched by a successful transfer', () => {
    const base = withRecipient()
    const unrelated = { id: 'dollar-account-unrelated', accountReference: 'CD-3000-0003', balanceCents: 777 }
    const before: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: [...base.dollarFinance.accounts, unrelated] } }
    const result = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 1_234)
    expect(result.status).toBe('transferred')
    expect(result.state.dollarFinance.accounts.find(({ id }) => id === unrelated.id)).toEqual(unrelated)
    expect(result.state.dollarFinance.credentials).toBe(before.dollarFinance.credentials)
    expect(result.state.dollarFinance.sessions).toBe(before.dollarFinance.sessions)
    expect(result.state.nodeWallet).toBe(before.nodeWallet)
    expect(result.state.nodeEconomy).toBe(before.nodeEconomy)
    expect(result.state.process).toBe(before.process)
  })

  it('records nothing that could reveal Credentials, Sessions or Devices', () => {
    const before = withRecipient()
    const result = transferDollars(before, before.player.localDevice.id, RECIPIENT.accountReference, 1_000)
    if (result.status !== 'transferred') throw new Error(result.status)
    const serialized = JSON.stringify(result.state.dollarFinance.transactions)
    expect(serialized).not.toContain('violet-orbit-7')
    expect(serialized).not.toContain('second-secret')
    expect(serialized).not.toContain(before.player.localDevice.id)
    expect(serialized).not.toContain('dollar-session-0001')
  })
})

describe('Dollar Account activity', () => {
  it('has no activity at all when no Transaction exists', () => {
    const state = createInitialGameState()
    expect(state.dollarFinance.transactions.records).toEqual([])
    expect(projectDollarAccountActivity(state, 'dollar-account-local-v0')).toEqual([])
  })

  it('presents outgoing as negative and incoming as positive, newest first, from each Account own point of view', () => {
    const base = withRecipient()
    const sent = transferDollars(base, base.player.localDevice.id, RECIPIENT.accountReference, 2_500)
    if (sent.status !== 'transferred') throw new Error(sent.status)
    const remote = base.world.network.hosts.find(({ id }) => id === 'host-lan-001')!
    const authenticated = authenticateDollarAccount(sent.state, remote.id, RECIPIENT_CREDENTIAL.loginIdentifier, RECIPIENT_CREDENTIAL.password)
    if (authenticated.status !== 'authenticated') throw new Error(authenticated.status)
    const returned = transferDollars(authenticated.state, remote.id, 'CD-1042-7781', 400)
    if (returned.status !== 'transferred') throw new Error(returned.status)

    expect(projectDollarAccountActivity(returned.state, 'dollar-account-local-v0')).toEqual([
      { id: 'dollar-transaction-0002', direction: 'incoming', amountCents: 400, counterpartyReference: 'CD-2000-0002' },
      { id: 'dollar-transaction-0001', direction: 'outgoing', amountCents: -2_500, counterpartyReference: 'CD-2000-0002' },
    ])
    expect(projectDollarAccountActivity(returned.state, RECIPIENT.id)).toEqual([
      { id: 'dollar-transaction-0002', direction: 'outgoing', amountCents: -400, counterpartyReference: 'CD-1042-7781' },
      { id: 'dollar-transaction-0001', direction: 'incoming', amountCents: 2_500, counterpartyReference: 'CD-1042-7781' },
    ])
  })

  it('excludes Transactions between other Accounts entirely', () => {
    const base = withRecipient()
    const third = { id: 'dollar-account-third', accountReference: 'CD-4000-0004', balanceCents: 900 }
    const withThird: GameState = { ...base, dollarFinance: { ...base.dollarFinance, accounts: [...base.dollarFinance.accounts, third], credentials: [...base.dollarFinance.credentials, { id: 'dollar-credential-third', accountId: third.id, loginIdentifier: 'third.civic', password: 'third-secret' }] } }
    const remote = base.world.network.hosts.find(({ id }) => id === 'host-lan-001')!
    const authenticated = authenticateDollarAccount(withThird, remote.id, 'third.civic', 'third-secret')
    if (authenticated.status !== 'authenticated') throw new Error(authenticated.status)
    const between = transferDollars(authenticated.state, remote.id, RECIPIENT.accountReference, 100)
    if (between.status !== 'transferred') throw new Error(between.status)
    expect(projectDollarAccountActivity(between.state, 'dollar-account-local-v0')).toEqual([])
  })
})

describe('Device saved Dollar sign-in', () => {
  it('represents saved sign-in material on the local Device, distinct from the Provider Credential', () => {
    const state = createInitialGameState()
    const saved = state.player.localDevice.savedDollarSignIn!
    const credential = state.dollarFinance.credentials[0]
    expect(saved).toBeDefined()
    expect(state.dollarFinance.credentials).not.toContain(saved)
    expect(saved.id).not.toBe(credential.id)
    expect(findDeviceSavedDollarSignIn(state, state.player.localDevice.id)).toBe(saved)
  })

  it('names the stable Financial Account it is for, and nothing else', () => {
    const state = createInitialGameState()
    const saved = state.player.localDevice.savedDollarSignIn!
    const account = state.dollarFinance.accounts[0]
    const credential = state.dollarFinance.credentials[0]
    expect(saved.accountId).toBe(account.id)
    // Intent, not identity of anything else: not the Credential, Device, Player, Session or account reference.
    expect(saved.accountId).not.toBe(saved.id)
    expect(saved.accountId).not.toBe(credential.id)
    expect(saved.accountId).not.toBe(saved.loginIdentifier)
    expect(saved.accountId).not.toBe(account.accountReference)
    expect(saved.accountId).not.toBe(state.player.localDevice.id)
    expect(saved.accountId).not.toBe(state.player.id)
    expect(saved.accountId).not.toBe(state.dollarFinance.sessions.active[0].id)
    // And it carries no presentation alias of its own.
    expect(saved).not.toHaveProperty('label')
  })

  it('submits only the saved login and password, never the Account ID, to the Provider', () => {
    const before = signedOut()
    const saved = before.player.localDevice.savedDollarSignIn!
    // Same Account, but the Provider's credential for it no longer matches the saved login identifier.
    const relogged: GameState = { ...before, dollarFinance: { ...before.dollarFinance, credentials: before.dollarFinance.credentials.map((credential) => ({ ...credential, loginIdentifier: 'moved.civic' })) } }
    expect(relogged.dollarFinance.credentials[0].accountId).toBe(saved.accountId)
    // Naming the right Account is not authentication: the saved login no longer resolves a Credential.
    expect(authenticateDollarAccountWithSavedSignIn(relogged, before.player.localDevice.id)).toEqual({ status: 'invalid_credentials', state: relogged })
  })

  it('fails closed when the saved login material would now authenticate to a different Account', () => {
    const base = createInitialGameState()
    const saved = base.player.localDevice.savedDollarSignIn!
    const otherAccount = { id: 'dollar-account-other', accountReference: 'CD-8000-0008', balanceCents: 50_000 }
    // The Provider re-associated exactly this login material with another Account.
    const redirected: GameState = {
      ...base,
      dollarFinance: {
        ...base.dollarFinance,
        accounts: [...base.dollarFinance.accounts, otherAccount],
        credentials: base.dollarFinance.credentials.map((credential) => ({ ...credential, accountId: otherAccount.id })),
      },
    }
    // The credentials themselves are valid, so plain authentication would succeed and reach the other Account.
    const wouldSucceed = authenticateDollarAccount(redirected, base.player.localDevice.id, saved.loginIdentifier, saved.password)
    expect(wouldSucceed.status).toBe('authenticated')

    const result = authenticateDollarAccountWithSavedSignIn(redirected, base.player.localDevice.id)
    expect(result).toEqual({ status: 'invalid_credentials', state: redirected })
    // Nothing was created, replaced or disclosed: the Device keeps the Session it already had.
    expect(result.state.dollarFinance.sessions).toBe(redirected.dollarFinance.sessions)
    expect(resolveDollarAccountForDevice(result.state, base.player.localDevice.id)?.id).toBe('dollar-account-local-v0')
    expect(result.state.dollarFinance.accounts).toBe(redirected.dollarFinance.accounts)
    expect(result.state.dollarFinance.credentials).toBe(redirected.dollarFinance.credentials)
    expect(result.state.dollarFinance.transactions).toBe(redirected.dollarFinance.transactions)
    expect(result.state.nodeWallet).toBe(redirected.nodeWallet)
    expect(result.state.nodeEconomy).toBe(redirected.nodeEconomy)
    // The refusal itself discloses nothing: the same non-revealing status a wrong
    // password gives, carrying no session and no hint of what did match.
    expect(Object.keys(result).sort()).toEqual(['state', 'status'])
    expect(result.state).toBe(redirected)
    expect(result.status).toBe(authenticateDollarAccount(redirected, base.player.localDevice.id, 'local.civic', 'wrong').status)
  })

  it('fails closed the same way from a signed-out Device, creating no Session at all', () => {
    const base = signedOut()
    const otherAccount = { id: 'dollar-account-other', accountReference: 'CD-8000-0008', balanceCents: 50_000 }
    const redirected: GameState = {
      ...base,
      dollarFinance: {
        ...base.dollarFinance,
        accounts: [...base.dollarFinance.accounts, otherAccount],
        credentials: base.dollarFinance.credentials.map((credential) => ({ ...credential, accountId: otherAccount.id })),
      },
    }
    const result = authenticateDollarAccountWithSavedSignIn(redirected, base.player.localDevice.id)
    expect(result).toEqual({ status: 'invalid_credentials', state: redirected })
    expect(result.state.dollarFinance.sessions.active).toHaveLength(0)
  })

  it('authenticates through the same canonical operation and produces an ordinary Session', () => {
    const before = signedOut()
    const manual = authenticateDollarAccount(before, before.player.localDevice.id, 'local.civic', 'violet-orbit-7')
    const saved = authenticateDollarAccountWithSavedSignIn(before, before.player.localDevice.id)
    expect(saved.status).toBe('authenticated')
    if (saved.status !== 'authenticated' || manual.status !== 'authenticated') return
    expect(saved.state.dollarFinance.sessions).toEqual(manual.state.dollarFinance.sessions)
    expect(saved.state.dollarFinance.accounts).toEqual(before.dollarFinance.accounts)
    expect(saved.state.dollarFinance.credentials).toEqual(before.dollarFinance.credentials)
    expect(JSON.stringify(saved.state.dollarFinance.sessions)).not.toContain('violet-orbit-7')
  })

  it('gives no one-tap path to a Device that saved nothing, even one holding a valid Session', () => {
    const base = createInitialGameState()
    const withoutSaved: GameState = { ...base, player: { ...base.player, localDevice: { ...base.player.localDevice, savedDollarSignIn: undefined } } }
    expect(findDeviceSavedDollarSignIn(withoutSaved, base.player.localDevice.id)).toBeUndefined()
    // A valid Session exists for this Device and still implies no saved material.
    expect(resolveDollarAccountForDevice(withoutSaved, base.player.localDevice.id)).toBeDefined()
    expect(authenticateDollarAccountWithSavedSignIn(withoutSaved, base.player.localDevice.id)).toEqual({ status: 'no_saved_sign_in', state: withoutSaved })

    // And the represented saved sign-in belongs only to the Device that holds it.
    const remote = base.world.network.hosts.find(({ id }) => id === 'host-lan-001')!
    expect(findDeviceSavedDollarSignIn(base, remote.id)).toBeUndefined()
    expect(authenticateDollarAccountWithSavedSignIn(base, remote.id)).toEqual({ status: 'no_saved_sign_in', state: base })
  })

  it('goes stale when Provider Credential truth changes independently, without reading the current password', () => {
    const base = signedOut()
    const rotated: GameState = { ...base, dollarFinance: { ...base.dollarFinance, credentials: base.dollarFinance.credentials.map((credential) => ({ ...credential, password: 'rotated-secret' })) } }
    expect(rotated.player.localDevice.savedDollarSignIn?.password).toBe('violet-orbit-7')
    expect(authenticateDollarAccountWithSavedSignIn(rotated, base.player.localDevice.id)).toEqual({ status: 'invalid_credentials', state: rotated })
    // The Account and its Credential are untouched by the failed attempt.
    expect(authenticateDollarAccount(rotated, base.player.localDevice.id, 'local.civic', 'rotated-secret').status).toBe('authenticated')
  })

  it('switches Accounts by replacing the Device Session, and switches back through the saved sign-in', () => {
    const base = withRecipient()
    const localAccount = base.dollarFinance.accounts[0]
    const switched = authenticateDollarAccount(base, base.player.localDevice.id, RECIPIENT_CREDENTIAL.loginIdentifier, RECIPIENT_CREDENTIAL.password)
    if (switched.status !== 'authenticated') throw new Error(switched.status)
    expect(resolveDollarAccountForDevice(switched.state, base.player.localDevice.id)?.id).toBe(RECIPIENT.id)
    expect(switched.state.dollarFinance.sessions.active.filter(({ clientDeviceId }) => clientDeviceId === base.player.localDevice.id)).toHaveLength(1)
    // Switching changes no ownership and no Account: the personal Account is exactly as it was.
    expect(switched.state.dollarFinance.accounts.find(({ id }) => id === localAccount.id)).toEqual(localAccount)
    expect(switched.state.player.localDevice.savedDollarSignIn).toEqual(base.player.localDevice.savedDollarSignIn)

    const back = authenticateDollarAccountWithSavedSignIn(switched.state, base.player.localDevice.id)
    if (back.status !== 'authenticated') throw new Error(back.status)
    // An ordinary Session, indistinguishable from one the manual form would produce.
    const manual = authenticateDollarAccount(switched.state, base.player.localDevice.id, 'local.civic', 'violet-orbit-7')
    if (manual.status !== 'authenticated') throw new Error(manual.status)
    expect(back.state.dollarFinance.sessions).toEqual(manual.state.dollarFinance.sessions)
    expect(resolveDollarAccountForDevice(back.state, base.player.localDevice.id)?.id).toBe(localAccount.id)
    expect(back.state.dollarFinance.sessions.active[0].accountId).toBe(base.player.localDevice.savedDollarSignIn!.accountId)
    expect(back.state.dollarFinance.sessions.active.filter(({ clientDeviceId }) => clientDeviceId === base.player.localDevice.id)).toHaveLength(1)
    expect(back.state.dollarFinance.accounts).toEqual(switched.state.dollarFinance.accounts)
  })
})

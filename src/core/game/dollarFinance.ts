import type { DeviceSavedDollarSignIn, DollarFinancialAccount, DollarTransaction, GameState } from './types'

export type AuthenticateDollarAccountResult =
  | { readonly status: 'authenticated'; readonly state: GameState; readonly sessionId: string }
  | { readonly status: 'invalid_credentials' | 'device_not_found' | 'account_unavailable'; readonly state: GameState }

export type LogoutDollarAccountResult =
  | { readonly status: 'logged_out'; readonly state: GameState }
  | { readonly status: 'not_signed_in'; readonly state: GameState }

function representedDeviceExists(state: GameState, deviceId: string): boolean {
  if (state.player.localDevice.id === deviceId) return true
  const host = state.world.network.hosts.find(({ id }) => id === deviceId)
  return host !== undefined
    && host.firmware !== undefined
    && host.filesystem !== undefined
    && host.hardware !== undefined
    && host.runtime !== undefined
    && host.installedSoftware !== undefined
}

/** Exact represented authentication. A Credential can establish authority but is never authority itself. */
export function authenticateDollarAccount(state: GameState, clientDeviceId: string, loginIdentifier: string, password: string): AuthenticateDollarAccountResult {
  if (!representedDeviceExists(state, clientDeviceId)) return { status: 'device_not_found', state }
  const credentials = state.dollarFinance.credentials.filter((candidate) => candidate.loginIdentifier === loginIdentifier)
  if (credentials.length !== 1 || credentials[0].password !== password) return { status: 'invalid_credentials', state }
  const credential = credentials[0]
  const account = state.dollarFinance.accounts.find(({ id }) => id === credential.accountId)
  if (!account) return { status: 'account_unavailable', state }

  const sessionId = `dollar-session-${String(state.dollarFinance.sessions.nextId).padStart(4, '0')}`
  const active = state.dollarFinance.sessions.active.filter((session) => session.clientDeviceId !== clientDeviceId)
  return {
    status: 'authenticated', sessionId,
    state: { ...state, dollarFinance: { ...state.dollarFinance, sessions: { nextId: state.dollarFinance.sessions.nextId + 1, active: [...active, { id: sessionId, accountId: account.id, clientDeviceId }] } } },
  }
}

/** Resolves presentation/operation authority only through Device -> Session -> Account. */
export function resolveDollarAccountForDevice(state: GameState, clientDeviceId: string): DollarFinancialAccount | undefined {
  if (!representedDeviceExists(state, clientDeviceId)) return undefined
  const sessions = state.dollarFinance.sessions.active.filter((session) => session.clientDeviceId === clientDeviceId)
  if (sessions.length !== 1) return undefined
  return state.dollarFinance.accounts.find(({ id }) => id === sessions[0].accountId)
}

export function logoutDollarAccount(state: GameState, clientDeviceId: string): LogoutDollarAccountResult {
  const active = state.dollarFinance.sessions.active.filter((session) => session.clientDeviceId !== clientDeviceId)
  if (active.length === state.dollarFinance.sessions.active.length) return { status: 'not_signed_in', state }
  return { status: 'logged_out', state: { ...state, dollarFinance: { ...state.dollarFinance, sessions: { ...state.dollarFinance.sessions, active } } } }
}

export type TransferDollarsResult =
  | { readonly status: 'transferred'; readonly state: GameState; readonly transactionId: string }
  | {
      readonly status:
        | 'not_signed_in'
        | 'invalid_amount'
        | 'recipient_not_found'
        | 'recipient_ambiguous'
        | 'recipient_is_source'
        | 'insufficient_funds'
      readonly state: GameState
    }

/**
 * The one concrete Dollar money movement. Its source Account is derived from
 * the acting Device's Financial Session and can never be supplied by a caller,
 * so an interface cannot choose whose money moves; the recipient is resolved by
 * exact Provider-scoped Account reference, and an ambiguous reference fails
 * closed rather than picking a candidate (A18).
 *
 * The transfer is immediate and atomic: either both balances change and exactly
 * one Transaction is appended, or nothing changes at all. There is no Process,
 * no settlement phase, no pending state, no fee and no overdraft.
 */
export function transferDollars(state: GameState, clientDeviceId: string, recipientAccountReference: string, amountCents: number): TransferDollarsResult {
  const source = resolveDollarAccountForDevice(state, clientDeviceId)
  if (!source) return { status: 'not_signed_in', state }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return { status: 'invalid_amount', state }

  const recipients = state.dollarFinance.accounts.filter((account) => account.accountReference === recipientAccountReference)
  if (recipients.length === 0) return { status: 'recipient_not_found', state }
  if (recipients.length > 1) return { status: 'recipient_ambiguous', state }
  const recipient = recipients[0]
  if (recipient.id === source.id) return { status: 'recipient_is_source', state }
  if (amountCents > source.balanceCents) return { status: 'insufficient_funds', state }
  // Canonical money stays an exact integer: a credit that could not be represented exactly is refused rather than rounded.
  if (!Number.isSafeInteger(recipient.balanceCents + amountCents)) return { status: 'invalid_amount', state }

  const transactions = state.dollarFinance.transactions
  const transaction: DollarTransaction = {
    id: `dollar-transaction-${String(transactions.nextId).padStart(4, '0')}`,
    sourceAccountId: source.id,
    destinationAccountId: recipient.id,
    amountCents,
    sourceAccountReference: source.accountReference,
    destinationAccountReference: recipient.accountReference,
  }
  const accounts = state.dollarFinance.accounts.map((account) => {
    if (account.id === source.id) return { ...account, balanceCents: account.balanceCents - amountCents }
    if (account.id === recipient.id) return { ...account, balanceCents: account.balanceCents + amountCents }
    return account
  })

  return {
    status: 'transferred',
    transactionId: transaction.id,
    state: { ...state, dollarFinance: { ...state.dollarFinance, accounts, transactions: { nextId: transactions.nextId + 1, records: [...transactions.records, transaction] } } },
  }
}

/** One Transaction as it concerns one Account, with nothing about the counterparty beyond the reference it used at the time. */
export interface DollarAccountActivityEntry {
  readonly id: string
  readonly direction: 'outgoing' | 'incoming'
  /** Signed canonical integer cents from this Account's point of view. */
  readonly amountCents: number
  /** Historical snapshot from the Transaction, never the counterparty's current reference. */
  readonly counterpartyReference: string
}

/**
 * Account activity derived from canonical Transactions, newest first. It
 * exposes no other Account's balance, no Credential, no Device, no Session and
 * no internal Account ID, and it invents nothing: an Account with no
 * Transactions has no activity.
 */
export function projectDollarAccountActivity(state: GameState, accountId: string): readonly DollarAccountActivityEntry[] {
  return state.dollarFinance.transactions.records
    .filter((record) => record.sourceAccountId === accountId || record.destinationAccountId === accountId)
    .map((record) => record.sourceAccountId === accountId
      ? { id: record.id, direction: 'outgoing' as const, amountCents: -record.amountCents, counterpartyReference: record.destinationAccountReference }
      : { id: record.id, direction: 'incoming' as const, amountCents: record.amountCents, counterpartyReference: record.sourceAccountReference })
    .reverse()
}

/** The saved sign-in a Device actually stored, if any. Saved material exists only where it is represented. */
export function findDeviceSavedDollarSignIn(state: GameState, clientDeviceId: string): DeviceSavedDollarSignIn | undefined {
  if (state.player.localDevice.id === clientDeviceId) return state.player.localDevice.savedDollarSignIn
  return undefined
}

export type AuthenticateWithSavedDollarSignInResult =
  | AuthenticateDollarAccountResult
  | { readonly status: 'no_saved_sign_in'; readonly state: GameState }

/**
 * Signs in using only what this Device saved, through the ordinary
 * authentication operation. It never reads the Provider's current Credential,
 * so a saved copy that no longer matches the Provider simply fails
 * authentication like any other wrong password.
 */
export function authenticateDollarAccountWithSavedSignIn(state: GameState, clientDeviceId: string): AuthenticateWithSavedDollarSignInResult {
  const saved = findDeviceSavedDollarSignIn(state, clientDeviceId)
  if (!saved) return { status: 'no_saved_sign_in', state }
  return authenticateDollarAccount(state, clientDeviceId, saved.loginIdentifier, saved.password)
}

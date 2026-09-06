import { resolveActiveRemoteTarget } from './remoteSession'
import { resolvePetraTransactionReaction } from './petraCompanyChat'
import type { DeviceSavedDollarSignIn, DollarFinancialAccount, DollarTransaction, DollarTransactionStatementContext, GameState } from './types'

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

export type CivicDollarMovementResult =
  | { readonly status: 'moved'; readonly state: GameState; readonly transaction: DollarTransaction }
  | {
      readonly status:
        | 'source_not_found'
        | 'destination_not_found'
        | 'same_account'
        | 'invalid_amount'
        | 'insufficient_funds'
      readonly state: GameState
    }

/**
 * The canonical Civic Dollar Account-to-Account movement invariant: the
 * Provider-owned money-movement half of a transfer (source/destination exist
 * and differ, the amount is a positive safe integer, funds suffice, the
 * resulting balances stay exactly representable, exactly one Transaction is
 * allocated and appended, and debit/credit happen together) with no opinion
 * about *who is allowed to move whose money* — that authority question stays
 * with each caller.
 *
 * `transferDollars` below is the one caller that derives its source Account
 * from Device -> Financial Session authority and is the only path a player
 * interface can reach; this primitive takes both Accounts by stable ID
 * because a narrow internal domain caller (a Bookstore sale, for example)
 * legitimately identifies both sides by already-resolved canonical identity
 * rather than through any Device or Session. Exposing this primitive is not
 * a new player-facing transfer path: nothing routes an arbitrary interface
 * caller to it directly.
 *
 * It refuses, changing nothing, when either Account cannot be found, when
 * they are the same Account, when the amount is not a positive safe integer,
 * or when the source lacks sufficient funds — including when either
 * resulting balance could not be represented as an exact integer. Both sides
 * of the movement are protected symmetrically: a resulting source balance
 * that could not be represented exactly refuses in exactly the same way as
 * an unrepresentable resulting destination balance, never only one side.
 *
 * This performs no reaction of its own (Petra's transaction reaction stays
 * owned by `transferDollars`, at its existing semantic layer) and does not
 * decide whose money is allowed to move.
 *
 * `statementContext` is an optional narrow historical statement-context
 * snapshot (`DollarTransactionStatementContext`) the calling domain operation
 * may supply for the Transaction this movement creates — this primitive only
 * stores whatever it is given, verbatim, once, at creation; it never
 * constructs, infers, or re-resolves one itself, and understands nothing
 * about what a Bookstore or a Business Branch is. `transferDollars` never
 * supplies one.
 */
export function executeCivicDollarMovement(state: GameState, sourceAccountId: string, destinationAccountId: string, amountCents: number, statementContext?: DollarTransactionStatementContext): CivicDollarMovementResult {
  const source = state.dollarFinance.accounts.find(({ id }) => id === sourceAccountId)
  if (!source) return { status: 'source_not_found', state }
  const destination = state.dollarFinance.accounts.find(({ id }) => id === destinationAccountId)
  if (!destination) return { status: 'destination_not_found', state }
  if (destination.id === source.id) return { status: 'same_account', state }
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) return { status: 'invalid_amount', state }
  if (amountCents > source.balanceCents) return { status: 'insufficient_funds', state }
  const resultingSourceBalance = source.balanceCents - amountCents
  const resultingDestinationBalance = destination.balanceCents + amountCents
  // Canonical money stays an exact integer on both sides: a resulting balance that could not be represented exactly is refused rather than rounded, for either the debit or the credit.
  if (!Number.isSafeInteger(resultingSourceBalance) || !Number.isSafeInteger(resultingDestinationBalance)) return { status: 'invalid_amount', state }

  const transactions = state.dollarFinance.transactions
  const transaction: DollarTransaction = {
    id: `dollar-transaction-${String(transactions.nextId).padStart(4, '0')}`,
    sourceAccountId: source.id,
    destinationAccountId: destination.id,
    amountCents,
    sourceAccountReference: source.accountReference,
    destinationAccountReference: destination.accountReference,
    ...(statementContext ? { statementContext } : {}),
  }
  const accounts = state.dollarFinance.accounts.map((account) => {
    if (account.id === source.id) return { ...account, balanceCents: resultingSourceBalance }
    if (account.id === destination.id) return { ...account, balanceCents: resultingDestinationBalance }
    return account
  })

  return {
    status: 'moved',
    transaction,
    state: { ...state, dollarFinance: { ...state.dollarFinance, accounts, transactions: { nextId: transactions.nextId + 1, records: [...transactions.records, transaction] } } },
  }
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

  const movement = executeCivicDollarMovement(state, source.id, recipient.id, amountCents)
  if (movement.status === 'insufficient_funds') return { status: 'insufficient_funds', state }
  if (movement.status !== 'moved') {
    // source and recipient are already resolved, existing, distinct Accounts and amountCents is already a
    // positive safe integer at this point, so only the balance-overflow branch of `invalid_amount` remains reachable.
    return { status: 'invalid_amount', state }
  }
  return {
    status: 'transferred',
    transactionId: movement.transaction.id,
    // The Transaction exists in movement.state before the separate concrete reaction resolves.
    state: resolvePetraTransactionReaction(movement.state, movement.transaction),
  }
}

/**
 * The Account authorized on the Device the player is currently operating
 * through a Remote Session, resolved the only way any Account is resolved:
 *
 * ```text
 * operated Device -> its Financial Session -> Account
 * ```
 *
 * The operated Device identity comes from the active Session's own
 * `accessId` -> target relationship, never from a caller, so a foreign
 * financial client cannot name the Account it would like to see. With no
 * Session, no resolvable target, or no Financial Session on that Device this
 * resolves nothing.
 */
export function resolveDollarAccountForOperatedRemoteDevice(state: GameState): DollarFinancialAccount | undefined {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return undefined
  return resolveDollarAccountForDevice(state, remote.target.id)
}

export type TransferRemoteDollarsResult =
  | TransferDollarsResult
  | { readonly status: 'session_unavailable'; readonly state: GameState }

/**
 * The same canonical transfer, performed by the Device the player is currently
 * operating remotely rather than by the local Device.
 *
 * This adds no transfer rule and no authority of its own: it resolves *who is
 * acting* from the active Remote Session and then calls `transferDollars`,
 * which still derives the source Account from that Device's Financial Session.
 * A caller therefore cannot choose whose money moves here either, and a client
 * running on a Device with no Financial Session is refused exactly as the local
 * client would be.
 *
 * A Remote Session is the operating context that decides which Device is
 * commanded — the same admission role it already plays for remote installation,
 * execution and transfer — and it is deliberately not financial authority: it
 * grants no Account, and holding one changes no Provider state.
 */
export function transferDollarsFromOperatedRemoteDevice(state: GameState, recipientAccountReference: string, amountCents: number): TransferRemoteDollarsResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  return transferDollars(state, remote.target.id, recipientAccountReference, amountCents)
}

/** One Transaction as it concerns one Account, with nothing about the counterparty beyond the reference it used at the time. */
export interface DollarAccountActivityEntry {
  readonly id: string
  readonly direction: 'outgoing' | 'incoming'
  /** Signed canonical integer cents from this Account's point of view. */
  readonly amountCents: number
  /** Historical snapshot from the Transaction, never the counterparty's current reference. */
  readonly counterpartyReference: string
  /** The Transaction's own optional historical statement-context snapshot, carried through verbatim. Absent for an ordinary transfer. */
  readonly statementContext?: DollarTransactionStatementContext
}

/**
 * Account activity derived from canonical Transactions, newest first. It
 * exposes no other Account's balance, no Credential, no Device, no Session and
 * no internal Account ID, and it invents nothing: an Account with no
 * Transactions has no activity. Where a Transaction carries an optional
 * statement-context snapshot, it is carried through unchanged; this
 * projection never resolves Business or any other domain state to construct
 * or supplement one.
 */
export function projectDollarAccountActivity(state: GameState, accountId: string): readonly DollarAccountActivityEntry[] {
  return state.dollarFinance.transactions.records
    .filter((record) => record.sourceAccountId === accountId || record.destinationAccountId === accountId)
    .map((record) => record.sourceAccountId === accountId
      ? { id: record.id, direction: 'outgoing' as const, amountCents: -record.amountCents, counterpartyReference: record.destinationAccountReference, ...(record.statementContext ? { statementContext: record.statementContext } : {}) }
      : { id: record.id, direction: 'incoming' as const, amountCents: record.amountCents, counterpartyReference: record.sourceAccountReference, ...(record.statementContext ? { statementContext: record.statementContext } : {}) })
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
 * authentication operation. The saved login identifier and password are the
 * only material submitted: it never reads the Provider's current Credential, so
 * a saved copy that no longer matches simply fails like any other wrong
 * password.
 *
 * A credential match is accepted only when the Session it produced resolves
 * exactly the Account the saved sign-in was saved for. A login identifier is a
 * mutable attribute (A01), so the Provider could later associate this saved
 * material with a different Account; that must not silently redirect the saved
 * personal sign-in. It fails closed to the same non-revealing
 * `invalid_credentials` and the original pre-attempt state, so no Session is
 * created or replaced and nothing discloses which other Account matched.
 */
export function authenticateDollarAccountWithSavedSignIn(state: GameState, clientDeviceId: string): AuthenticateWithSavedDollarSignInResult {
  const saved = findDeviceSavedDollarSignIn(state, clientDeviceId)
  if (!saved) return { status: 'no_saved_sign_in', state }
  const result = authenticateDollarAccount(state, clientDeviceId, saved.loginIdentifier, saved.password)
  if (result.status !== 'authenticated') return result
  const reached = resolveDollarAccountForDevice(result.state, clientDeviceId)
  if (reached?.id !== saved.accountId) return { status: 'invalid_credentials', state }
  return result
}

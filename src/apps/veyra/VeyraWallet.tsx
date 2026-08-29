import { type FormEvent, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import {
  projectDollarAccountActivity,
  resolveDollarAccountForOperatedRemoteDevice,
  type DollarAccountActivityEntry,
  type TransferRemoteDollarsResult,
} from '../../core/game/dollarFinance'
import type { DollarFinancialAccount } from '../../core/game/types'
import { formatDollarCents, formatSignedDollarCents, parseDollarAmountToCents } from '../dollarFormat'
import { VeyraCopyControl } from './veyraControls'
import { VeyraIcon } from './VeyraIcon'

/** Which Wallet surface is open. Presentation only; it never reaches `GameState`. */
export type VeyraWalletDetail = 'send' | 'receive' | 'account'

/**
 * VEYRA's consumer client for a real Civic Dollar Account.
 *
 * It owns no financial truth whatsoever. The Account is resolved the only way
 * an Account is ever resolved — the operated Device, that Device's Financial
 * Session, and the Account that Session authorizes — so this surface can only
 * ever show the money the phone it is running on is actually signed in to.
 * Player identity, the player's own Account and the player's Remote Session
 * grant it nothing.
 *
 * Balance and Activity are read from canonical state on every render, and SEND
 * calls the shared canonical transfer, which derives the source Account from
 * that same Device. Nothing here can name whose money moves.
 */
export function VeyraWallet({ detail, onDetail }: {
  detail?: VeyraWalletDetail
  onDetail: (detail?: VeyraWalletDetail) => void
}) {
  const state = useGameState()
  const { transferRemoteDollars } = useGameActions()
  const account = resolveDollarAccountForOperatedRemoteDevice(state)
  const providerName = state.dollarFinance.provider.displayName
  const [notice, setNotice] = useState<string>()

  if (!account) {
    // Truthful, not decorative: with no Financial Session on this Device there
    // is no Account to present, and the Wallet says exactly that.
    return <section className="veyra-screen" aria-label="Wallet">
      <h1 className="veyra-title">Wallet</h1>
      <p className="veyra-empty">This phone is not signed in to an account.</p>
    </section>
  }

  function returnToRoot(message?: string) {
    setNotice(message)
    onDetail(undefined)
  }

  if (detail === 'send') {
    return <VeyraSend
      account={account}
      providerName={providerName}
      transfer={transferRemoteDollars}
      onSent={(amountCents, recipient) => returnToRoot(`Sent ${formatDollarCents(amountCents)} to ${recipient}.`)}
    />
  }

  if (detail === 'receive') return <VeyraReceive account={account} providerName={providerName} />
  if (detail === 'account') return <VeyraAccount account={account} providerName={providerName} />

  return <VeyraWalletRoot
    account={account}
    providerName={providerName}
    activity={projectDollarAccountActivity(state, account.id)}
    notice={notice}
    onDetail={(next) => { setNotice(undefined); onDetail(next) }}
  />
}

/**
 * The Wallet root, in the selected consumer hierarchy: the balance first, the
 * Provider under it, the two things a person does with money, the Account, and
 * then what has actually happened.
 */
function VeyraWalletRoot({ account, providerName, activity, notice, onDetail }: {
  account: DollarFinancialAccount
  providerName: string
  activity: readonly DollarAccountActivityEntry[]
  notice?: string
  onDetail: (detail: VeyraWalletDetail) => void
}) {
  return <section className="veyra-screen" aria-label="Wallet">
    <h1 className="veyra-title">Wallet</h1>

    <div className="veyra-card veyra-balance">
      <p className="veyra-figure">{formatDollarCents(account.balanceCents)}</p>
      <p className="veyra-figure-note">{providerName}</p>
    </div>

    {notice && <p className="veyra-notice" role="status">{notice}</p>}

    <div className="veyra-pair">
      <button className="veyra-action veyra-action--primary" type="button" onClick={() => onDetail('send')}>
        <VeyraIcon name="send" /><span>Send</span>
      </button>
      <button className="veyra-action" type="button" onClick={() => onDetail('receive')}>
        <VeyraIcon name="receive" /><span>Receive</span>
      </button>
    </div>

    <div className="veyra-card veyra-card--rows">
      <button className="veyra-row" type="button" onClick={() => onDetail('account')}>
        <span className="veyra-row__label">Account</span>
        <VeyraIcon name="chevron" />
      </button>
    </div>

    <h2 className="veyra-section">Activity</h2>
    <VeyraActivity activity={activity} />
  </section>
}

/**
 * Activity is exactly the canonical Transactions this Account is part of,
 * newest first. Each row carries only what the projection actually holds: the
 * direction, the counterparty reference as it was recorded, and the signed
 * amount. No timestamp, merchant, category, status, fee or grouping is added,
 * because the world represents none of them, and an Account with no
 * Transactions truthfully has nothing here.
 */
function VeyraActivity({ activity }: { activity: readonly DollarAccountActivityEntry[] }) {
  if (activity.length === 0) return <p className="veyra-empty">Money you send or receive will appear here.</p>

  return <div className="veyra-card veyra-card--rows">
    {activity.map((entry) => <div className="veyra-row veyra-row--static" key={entry.id}>
      <span className="veyra-row__copy">
        <strong>{entry.direction === 'outgoing' ? 'Sent' : 'Received'}</strong>
        <small>{entry.counterpartyReference}</small>
      </span>
      <span className={`veyra-amount veyra-amount--${entry.direction}`}>{formatSignedDollarCents(entry.amountCents)}</span>
    </div>)}
  </div>
}

/**
 * SEND: an amount, a destination, and a plain review before anything moves.
 *
 * The amount is converted to exact canonical cents at this boundary, so no
 * typed string and no floating-point Dollar reaches the domain. Every refusal
 * comes from the canonical operation and is restated in ordinary product
 * language; nothing here decides whether a transfer is allowed, and there is no
 * fee, arrival estimate, settlement or processing state, because none is
 * represented.
 */
function VeyraSend({ account, providerName, transfer, onSent }: {
  account: DollarFinancialAccount
  providerName: string
  transfer: (recipientAccountReference: string, amountCents: number) => TransferRemoteDollarsResult
  onSent: (amountCents: number, recipientAccountReference: string) => void
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [review, setReview] = useState<{ recipient: string; amountCents: number }>()
  const [refusal, setRefusal] = useState<string>()

  function openReview(event: FormEvent) {
    event.preventDefault()
    const trimmed = recipient.trim()
    if (!trimmed) return setRefusal('Enter the account number you are sending to.')
    const amountCents = parseDollarAmountToCents(amount)
    if (amountCents === undefined) return setRefusal('Enter an amount like 25.00.')
    setRefusal(undefined)
    setReview({ recipient: trimmed, amountCents })
  }

  function send() {
    if (!review) return
    const result = transfer(review.recipient, review.amountCents)
    if (result.status === 'transferred') return onSent(review.amountCents, review.recipient)
    setReview(undefined)
    setRefusal(transferRefusal(result.status))
  }

  if (review) {
    return <section className="veyra-screen" aria-label="Review transfer">
      <h1 className="veyra-title">Review</h1>
      <div className="veyra-card veyra-balance">
        <p className="veyra-figure">{formatDollarCents(review.amountCents)}</p>
        <p className="veyra-figure-note">{providerName}</p>
      </div>
      <dl className="veyra-card veyra-card--rows veyra-terms">
        <div className="veyra-row veyra-row--static"><dt>To</dt><dd>{review.recipient}</dd></div>
        <div className="veyra-row veyra-row--static"><dt>From</dt><dd>{account.accountReference}</dd></div>
      </dl>
      <button className="veyra-submit" type="button" onClick={send}>Send {formatDollarCents(review.amountCents)}</button>
      <button className="veyra-quiet" type="button" onClick={() => setReview(undefined)}>Edit</button>
    </section>
  }

  return <section className="veyra-screen" aria-label="Send money">
    <h1 className="veyra-title">Send</h1>
    <form className="veyra-form" onSubmit={openReview} aria-label="Send money">
      <label className="veyra-field">
        <span>Amount</span>
        <input className="veyra-input veyra-input--amount" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" placeholder="0.00" />
      </label>
      <label className="veyra-field">
        <span>To account number</span>
        <input className="veyra-input" name="recipientAccountReference" value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <dl className="veyra-card veyra-card--rows veyra-terms">
        <div className="veyra-row veyra-row--static"><dt>From</dt><dd>{account.accountReference}</dd></div>
        <div className="veyra-row veyra-row--static"><dt>Available</dt><dd>{formatDollarCents(account.balanceCents)}</dd></div>
      </dl>
      {refusal && <p className="veyra-refusal" role="alert">{refusal}</p>}
      <button className="veyra-submit" type="submit">Review</button>
    </form>
  </section>
}

/**
 * RECEIVE presents the Account reference a sender would send to, and nothing
 * else. It creates no payment request, no invoice, no amount request and no QR
 * identity, and opening or leaving it changes nothing the world represents.
 */
function VeyraReceive({ account, providerName }: { account: DollarFinancialAccount; providerName: string }) {
  return <section className="veyra-screen" aria-label="Receive money">
    <h1 className="veyra-title">Receive</h1>
    <div className="veyra-card veyra-reference">
      <p className="veyra-reference__value">{account.accountReference}</p>
      <p className="veyra-figure-note">{providerName}</p>
      <VeyraCopyControl value={account.accountReference} label={`Copy account number ${account.accountReference}`}>Copy number</VeyraCopyControl>
    </div>
    <p className="veyra-note">Share this account number with whoever is sending you money.</p>
  </section>
}

/**
 * ACCOUNT presents the consumer-facing facts about the Account itself. Internal
 * Account, Credential and Financial Session identity, and any credential
 * material, are deliberately absent: they are authority data, not information
 * an owner needs.
 */
function VeyraAccount({ account, providerName }: { account: DollarFinancialAccount; providerName: string }) {
  return <section className="veyra-screen" aria-label="Account">
    <h1 className="veyra-title">Account</h1>
    <dl className="veyra-card veyra-card--rows veyra-terms">
      <div className="veyra-row veyra-row--static"><dt>Provider</dt><dd>{providerName}</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Account number</dt><dd>{account.accountReference}</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Balance</dt><dd>{formatDollarCents(account.balanceCents)}</dd></div>
    </dl>
  </section>
}

/** Ordinary product wording for a refused transfer; the operation's statuses stay internal. */
function transferRefusal(status: Exclude<TransferRemoteDollarsResult['status'], 'transferred'>): string {
  switch (status) {
    case 'recipient_not_found': return 'No account matches that number.'
    case 'recipient_ambiguous': return 'That number does not identify a single account.'
    case 'recipient_is_source': return 'You cannot send to this account.'
    case 'insufficient_funds': return 'Not enough money in this account.'
    case 'invalid_amount': return 'Enter an amount like 25.00.'
    case 'not_signed_in':
    case 'session_unavailable': return 'This account is no longer signed in.'
  }
}

import { type FormEvent, useState } from 'react'
import type { DollarFinancialAccount } from '../../core/game/types'
import type { TransferDollarsResult } from '../../core/game/dollarFinance'
import { formatDollarCents, parseDollarAmountToCents } from '../dollarFormat'
import { FocusedHeading } from './walletControls'

/**
 * SEND: entering a transfer, and reviewing it before it is real.
 *
 * Presentation only. The amount is parsed into exact canonical cents at this
 * boundary and every refusal comes from the shared domain operation, so no
 * typed string and no floating-point Dollar reaches the finance domain, and
 * nothing here decides whether a transfer is allowed.
 *
 * The surface states exactly what a transfer is: an amount, a destination and
 * a source. There is no fee, total, estimated arrival, settlement, transfer
 * speed, processing state or security claim, because the world represents
 * none of them and a reassuring line about any of them would be an invention.
 */
export function Send({ account, providerName, transfer, onSent, onCancel }: {
  account: DollarFinancialAccount
  providerName: string
  transfer: (recipientAccountReference: string, amountCents: number) => TransferDollarsResult
  onSent: (amountCents: number, recipientAccountReference: string) => void
  onCancel: () => void
}) {
  const [recipient, setRecipient] = useState('')
  const [amount, setAmount] = useState('')
  const [review, setReview] = useState<{ recipient: string; amountCents: number }>()
  const [refusal, setRefusal] = useState<string>()

  function openReview(event: FormEvent) {
    event.preventDefault()
    const trimmed = recipient.trim()
    if (!trimmed) return setRefusal('Enter the account you are sending to.')
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
    // Review is the whole surface: the amount is the subject, and both accounts
    // are stated plainly, so a mistyped transfer is visible before it is real.
    return <section className="dollar-client" aria-label="Review transfer">
      <FocusedHeading title="SEND / REVIEW" onBack={() => setReview(undefined)} />
      <div className="dollar-hero dollar-hero--review">
        <p className="eyebrow dollar-provider">AMOUNT</p>
        <p className="dollar-balance dollar-balance--review">{formatDollarCents(review.amountCents)}</p>
      </div>
      <dl className="wallet-module dollar-terms">
        <div><dt>TO</dt><dd>{review.recipient}</dd></div>
        <div><dt>FROM</dt><dd>{account.accountReference}<span>{providerName}</span></dd></div>
      </dl>
      <button className="dollar-primary" type="button" onClick={send}>CONFIRM &amp; SEND</button>
    </section>
  }

  return <section className="dollar-client" aria-label="Send money">
    <FocusedHeading title="SEND" onBack={onCancel} />
    <form className="dollar-form" onSubmit={openReview} aria-label="Send Dollars">
      {/*
        * The amount is the subject of the surface, so it is entered at the
        * amount's own scale on a recessed plate rather than in an ordinary
        * field. The currency mark is drawn by the surface, so an empty entry
        * still reads as a money field rather than as a placeholder string.
        */}
      <label className="node-field dollar-entry dollar-entry--amount">
        <span>AMOUNT</span>
        <input className="dollar-entry-input" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" placeholder="0.00" />
      </label>
      <label className="node-field dollar-entry">
        <span>TO ACCOUNT</span>
        <input className="dollar-entry-input dollar-entry-input--reference" name="recipientAccountReference" value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <dl className="wallet-module dollar-terms">
        <div><dt>FROM</dt><dd>{account.accountReference}<span>{providerName}</span></dd></div>
        <div><dt>AVAILABLE</dt><dd className="dollar-terms-amount">{formatDollarCents(account.balanceCents)}</dd></div>
      </dl>
      {refusal && <p className="node-note node-note--caution" role="alert">{refusal}</p>}
      <button className="dollar-submit" type="submit">REVIEW</button>
    </form>
  </section>
}

/** Product wording for a refused transfer; the domain's operation statuses stay internal. */
function transferRefusal(status: Exclude<TransferDollarsResult['status'], 'transferred'>): string {
  switch (status) {
    case 'recipient_not_found': return 'No account matches that number.'
    case 'recipient_ambiguous': return 'That number does not identify a single account.'
    case 'recipient_is_source': return 'You cannot send to this account.'
    case 'insufficient_funds': return 'Not enough money in this account.'
    case 'invalid_amount': return 'Enter an amount like 25.00.'
    case 'not_signed_in': return 'This account is no longer signed in.'
  }
}

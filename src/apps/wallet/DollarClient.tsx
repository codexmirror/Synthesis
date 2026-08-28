import { type FormEvent, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import {
  findDeviceSavedDollarSignIn,
  projectDollarAccountActivity,
  resolveDollarAccountForDevice,
  type DollarAccountActivityEntry,
  type TransferDollarsResult,
} from '../../core/game/dollarFinance'
import type { DeviceSavedDollarSignIn, DollarFinancialAccount } from '../../core/game/types'
import { formatDollarCents, formatSignedDollarCents, parseDollarAmountToCents } from '../dollarFormat'

/**
 * Which Dollar surface is open. SEND and ACCOUNT are focused tasks, so the
 * containing application can put everything unrelated away while one is open.
 */
export type DollarSurface = 'dashboard' | 'send' | 'account'

/**
 * The Dollar financial client: the whole Civic Dollar experience for the local
 * Device, from balance through SEND and ACCOUNT. It owns no economic truth —
 * balance, activity and which Account is current are all resolved from
 * canonical state through the Device's Financial Session, and every money
 * movement or sign-in goes through the shared domain operation.
 *
 * It is deliberately a component of the Wallet rather than a Firmware framework:
 * NODE-OS is the only Firmware that presents it today. It is kept separate from
 * the NODE section only because the two are separate economic domains.
 */
export function DollarClient({ surface, onSurface }: { surface: DollarSurface; onSurface: (surface: DollarSurface) => void }) {
  const state = useGameState()
  const actions = useGameActions()
  const deviceId = state.player.localDevice.id
  const account = resolveDollarAccountForDevice(state, deviceId)
  const savedSignIn = findDeviceSavedDollarSignIn(state, deviceId)
  const providerName = state.dollarFinance.provider.displayName
  const [notice, setNotice] = useState<string>()

  function returnToDashboard(message?: string) {
    setNotice(message)
    onSurface('dashboard')
  }

  if (!account) {
    return <SignedOut providerName={providerName} savedSignIn={savedSignIn} onSignedIn={() => returnToDashboard()} />
  }

  if (surface === 'send') {
    return <Send
      account={account}
      transfer={actions.transferDollars}
      onSent={(amountCents, recipient) => returnToDashboard(`Sent ${formatDollarCents(amountCents)} to ${recipient}.`)}
      onCancel={() => returnToDashboard()}
    />
  }

  if (surface === 'account') {
    return <Account
      account={account}
      providerName={providerName}
      savedSignIn={savedSignIn}
      onSwitched={(message) => returnToDashboard(message)}
      onSignedOut={() => returnToDashboard()}
      onCancel={() => returnToDashboard()}
    />
  }

  return <Dashboard
    account={account}
    providerName={providerName}
    activity={projectDollarAccountActivity(state, account.id)}
    notice={notice}
    onSend={() => { setNotice(undefined); onSurface('send') }}
    onAccount={() => { setNotice(undefined); onSurface('account') }}
  />
}

function Dashboard({ account, providerName, activity, notice, onSend, onAccount }: {
  account: DollarFinancialAccount
  providerName: string
  activity: readonly DollarAccountActivityEntry[]
  notice?: string
  onSend: () => void
  onAccount: () => void
}) {
  return <section className="dollar-client" aria-label="Dollar account">
    <p className="eyebrow dollar-provider">{providerName}</p>
    <p className="balance">{formatDollarCents(account.balanceCents)}</p>
    <p className="dollar-account-reference">{account.accountReference}</p>
    {notice && <p className="node-note" role="status">{notice}</p>}

    <div className="dollar-actions">
      <button className="node-action" type="button" onClick={onSend}>SEND</button>
      <button className="node-action" type="button" onClick={onAccount}>ACCOUNT</button>
    </div>

    <div className="node-section"><span>ACTIVITY</span></div>
    {activity.length > 0
      ? <div className="node-list">{activity.map((entry) => <div className="node-row dollar-activity" key={entry.id}>
          <span className="node-row-copy">
            <strong>{entry.counterpartyReference}</strong>
            <small>{entry.direction === 'outgoing' ? 'SENT' : 'RECEIVED'}</small>
          </span>
          <span className={`dollar-amount dollar-amount--${entry.direction}`}>{formatSignedDollarCents(entry.amountCents)}</span>
        </div>)}</div>
      : <div className="node-empty"><strong>NO ACTIVITY YET</strong><span>Money you send or receive appears here.</span></div>}
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

function Send({ account, transfer, onSent, onCancel }: {
  account: DollarFinancialAccount
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
    return <section className="dollar-client" aria-label="Review transfer">
      <button className="node-back" type="button" onClick={() => setReview(undefined)}>← BACK</button>
      <div className="node-section"><span>REVIEW</span></div>
      <p className="dollar-review-amount">{formatDollarCents(review.amountCents)}</p>
      <p className="dollar-review-recipient">to {review.recipient}</p>
      <p className="dollar-review-source">from {account.accountReference}</p>
      <div className="dollar-actions">
        <button className="node-action" type="button" onClick={send}>SEND</button>
      </div>
    </section>
  }

  return <section className="dollar-client" aria-label="Send money">
    <button className="node-back" type="button" onClick={onCancel}>← BACK</button>
    <div className="node-section"><span>SEND</span><span>{formatDollarCents(account.balanceCents)} available</span></div>
    <form className="dollar-form" onSubmit={openReview} aria-label="Send Dollars">
      <label className="node-field"><span>TO ACCOUNT</span><input className="node-input" name="recipientAccountReference" value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" spellCheck={false} /></label>
      <label className="node-field"><span>AMOUNT</span><input className="node-input" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" placeholder="0.00" /></label>
      {refusal && <p className="node-note node-note--caution" role="alert">{refusal}</p>}
      <button className="node-action" type="submit">REVIEW</button>
    </form>
  </section>
}

function Account({ account, providerName, savedSignIn, onSwitched, onSignedOut, onCancel }: {
  account: DollarFinancialAccount
  providerName: string
  savedSignIn?: DeviceSavedDollarSignIn
  onSwitched: (message: string) => void
  onSignedOut: () => void
  onCancel: () => void
}) {
  const actions = useGameActions()
  // Derived from stable Account identity and Session truth, never a stored flag:
  // returning to an Account this Device is already using is not an action.
  const alreadyPersonal = savedSignIn !== undefined && savedSignIn.accountId === account.id

  return <section className="dollar-client" aria-label="Account management">
    <button className="node-back" type="button" onClick={onCancel}>← BACK</button>

    <div className="node-section"><span>CURRENT</span></div>
    <p className="dollar-current-reference">{account.accountReference}</p>
    <p className="dollar-current-context">{providerName} · {formatDollarCents(account.balanceCents)}{alreadyPersonal ? ' · Personal account' : ''}</p>

    {savedSignIn && !alreadyPersonal && <SavedSignIn saved={savedSignIn} onContinue={() => onSwitched('Signed in to your personal account.')} />}
    <ManualSignIn onSignedIn={() => onSwitched('Signed in to the other account.')} />

    <div className="dollar-sign-out">
      <button className="node-action" type="button" onClick={() => { actions.logoutDollarAccount(); onSignedOut() }}>SIGN OUT</button>
    </div>
  </section>
}

function SignedOut({ providerName, savedSignIn, onSignedIn }: {
  providerName: string
  savedSignIn?: DeviceSavedDollarSignIn
  onSignedIn: () => void
}) {
  return <section className="dollar-client" aria-label="Dollar account signed out">
    <p className="eyebrow dollar-provider">{providerName}</p>
    <p className="dollar-signed-out">Signed out</p>
    {savedSignIn && <SavedSignIn saved={savedSignIn} onContinue={onSignedIn} />}
    <ManualSignIn onSignedIn={onSignedIn} />
  </section>
}

/**
 * The saved sign-in path back to the personal Account. CONTINUE submits only
 * what this Device stored, through the same authentication operation the manual
 * form uses; nothing here reads the Provider's current password, and the saved
 * password is never rendered. It is offered only where it is actually a way
 * somewhere — signed out, or signed in to some other Account.
 */
function SavedSignIn({ saved, onContinue }: { saved: DeviceSavedDollarSignIn; onContinue: () => void }) {
  const actions = useGameActions()
  const [stale, setStale] = useState(false)

  return <>
    <div className="node-section"><span>PERSONAL ACCOUNT</span></div>
    <div className="dollar-saved">
      <p className="dollar-saved-login">{saved.loginIdentifier}</p>
      <p className="dollar-saved-note">Saved sign-in on this device</p>
      {stale && <p className="node-note node-note--caution" role="alert">This device's saved sign-in no longer works. Sign in below.</p>}
      <button className="node-action" type="button" onClick={() => {
        const result = actions.authenticateDollarAccountWithSavedSignIn()
        if (result.status === 'authenticated') return onContinue()
        setStale(true)
      }}>CONTINUE</button>
    </div>
  </>
}

/** Manual sign-in stays available beside the saved path, and is the only way into an account this Device has not saved. */
function ManualSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const actions = useGameActions()
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [failed, setFailed] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    const result = actions.authenticateDollarAccount(loginIdentifier, password)
    if (result.status === 'authenticated') return onSignedIn()
    setFailed(true)
  }

  return <>
    <div className="node-section"><span>OTHER ACCOUNT</span></div>
    <form className="dollar-form" onSubmit={submit} aria-label="Dollar account sign in">
      <label className="node-field"><span>LOGIN ID</span><input className="node-input" name="loginIdentifier" value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} autoComplete="username" spellCheck={false} /></label>
      <label className="node-field"><span>PASSWORD</span><input className="node-input" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {failed && <p className="node-note node-note--caution" role="alert">Invalid login ID or password.</p>}
      <button className="node-action" type="submit">SIGN IN</button>
    </form>
  </>
}

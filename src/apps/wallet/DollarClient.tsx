import { type FormEvent, type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react'
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
import { deriveDollarBalanceTrajectory, dollarTrajectoryPolylinePoints } from './balanceTrajectory'
import { WalletIcon } from './WalletIcon'

/**
 * Which Dollar surface is open. SEND, RECEIVE and ACCOUNT are focused tasks, so
 * the containing application can put everything unrelated away while one is
 * open.
 */
export type DollarSurface = 'dashboard' | 'send' | 'receive' | 'account'

/**
 * The Dollar financial client: the whole Civic Dollar experience for the local
 * Device, from balance through SEND, RECEIVE and ACCOUNT. It owns no economic
 * truth — balance, activity and which Account is current are all resolved from
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
      providerName={providerName}
      transfer={actions.transferDollars}
      onSent={(amountCents, recipient) => returnToDashboard(`Sent ${formatDollarCents(amountCents)} to ${recipient}.`)}
      onCancel={() => returnToDashboard()}
    />
  }

  if (surface === 'receive') {
    return <Receive account={account} providerName={providerName} onCancel={() => returnToDashboard()} />
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
    personal={savedSignIn?.accountId === account.id}
    activity={projectDollarAccountActivity(state, account.id)}
    notice={notice}
    onSurface={(next) => { setNotice(undefined); onSurface(next) }}
  />
}

function Dashboard({ account, providerName, personal, activity, notice, onSurface }: {
  account: DollarFinancialAccount
  providerName: string
  personal: boolean
  activity: readonly DollarAccountActivityEntry[]
  notice?: string
  onSurface: (surface: DollarSurface) => void
}) {
  return <section className="dollar-client" aria-label="Dollar account">
    <div className="dollar-hero">
      <p className="eyebrow dollar-provider">{providerName}</p>
      <p className="balance dollar-balance">{formatDollarCents(account.balanceCents)}</p>
      <div className="dollar-identity">
        <AccountReference reference={account.accountReference} />
        {/* Stated only where it derives from this Device's saved sign-in; there is no personal flag. */}
        {personal && <span className="dollar-identity-note">Personal account</span>}
      </div>
      <BalanceTrajectory balanceCents={account.balanceCents} activity={activity} />
    </div>

    {notice && <p className="node-note dollar-notice" role="status">{notice}</p>}

    <div className="dollar-actions">
      <ActionTile icon="send" label="SEND" onClick={() => onSurface('send')} />
      <ActionTile icon="receive" label="RECEIVE" onClick={() => onSurface('receive')} />
      <ActionTile icon="account" label="ACCOUNT" onClick={() => onSurface('account')} />
    </div>

    <div className="node-section"><span>ACTIVITY</span></div>
    {activity.length > 0
      ? <div className="node-list">{activity.map((entry) => <div className="node-row dollar-activity" key={entry.id}>
          <span className={`dollar-activity-mark dollar-activity-mark--${entry.direction}`} aria-hidden="true">
            <WalletIcon name={entry.direction === 'outgoing' ? 'send' : 'receive'} />
          </span>
          <span className="node-row-copy">
            <strong>{entry.counterpartyReference}</strong>
            <small>{entry.direction === 'outgoing' ? 'SENT' : 'RECEIVED'}</small>
          </span>
          <span className={`dollar-amount dollar-amount--${entry.direction}`}>{formatSignedDollarCents(entry.amountCents)}</span>
        </div>)}</div>
      : <div className="node-empty"><strong>NO ACTIVITY YET</strong><span>Money you send or receive appears here.</span></div>}
  </section>
}

function ActionTile({ icon, label, onClick }: { icon: 'send' | 'receive' | 'account'; label: string; onClick: () => void }) {
  return <button className="dollar-action" type="button" onClick={onClick}>
    <WalletIcon name={icon} />
    <span>{label}</span>
  </button>
}

/**
 * The Dollar hero's trajectory: one stroke through the balance states this
 * Account is represented as having held, oldest to current.
 *
 * It is drawn only where there is real movement to draw. With no Transactions
 * there is exactly one represented balance state, so there is no line and the
 * hero simply ends after the account identity — an invented fluctuating history
 * would be the only way to fill that space. It carries no axis, no label, no
 * time and no percentage claim, and the numbers behind it are already on the
 * screen as the balance and the activity list, so it is presented as the
 * decoration of those facts rather than as a separate reading.
 */
function BalanceTrajectory({ balanceCents, activity }: { balanceCents: number; activity: readonly DollarAccountActivityEntry[] }) {
  const points = dollarTrajectoryPolylinePoints(deriveDollarBalanceTrajectory(balanceCents, activity), 100, 34)
  if (!points) return null
  // The box is two units taller than the plotted range at each edge, so the
  // highest and lowest represented states keep a whole stroke rather than being
  // clipped flat against the frame.
  return <svg className="dollar-trajectory" viewBox="0 0 100 38" preserveAspectRatio="none" aria-hidden="true">
    <g transform="translate(0 2)">
      <polygon className="dollar-trajectory-area" points={`${points} 100,34 0,34`} />
      <polyline className="dollar-trajectory-line" points={points} vectorEffect="non-scaling-stroke" />
    </g>
  </svg>
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

function Send({ account, providerName, transfer, onSent, onCancel }: {
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
        <p className="eyebrow">AMOUNT</p>
        <p className="balance dollar-balance">{formatDollarCents(review.amountCents)}</p>
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
      <label className="node-field dollar-amount-field"><span>AMOUNT</span><input className="node-input" name="amount" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoComplete="off" placeholder="0.00" /></label>
      <label className="node-field"><span>TO ACCOUNT</span><input className="node-input" name="recipientAccountReference" value={recipient} onChange={(event) => setRecipient(event.target.value)} autoComplete="off" spellCheck={false} /></label>
      <dl className="wallet-module dollar-terms">
        <div><dt>FROM</dt><dd>{account.accountReference}<span>{providerName}</span></dd></div>
        <div><dt>AVAILABLE</dt><dd className="dollar-terms-amount">{formatDollarCents(account.balanceCents)}</dd></div>
      </dl>
      {refusal && <p className="node-note node-note--caution" role="alert">{refusal}</p>}
      <button className="dollar-submit" type="submit">REVIEW</button>
    </form>
  </section>
}

/**
 * RECEIVE presents the Account reference another represented Civic Dollar
 * sender would send to, and nothing else.
 *
 * It is purely presentation over Account truth the client already resolves: it
 * creates no payment request, no invoice, no amount request, no QR identity, no
 * receiving Session and no Transaction, and opening or leaving it changes no
 * canonical state at all. There is no represented Dollar mechanic beyond a
 * sender typing this reference into their own SEND.
 */
function Receive({ account, providerName, onCancel }: { account: DollarFinancialAccount; providerName: string; onCancel: () => void }) {
  return <section className="dollar-client" aria-label="Receive money">
    <FocusedHeading title="RECEIVE" onBack={onCancel} />
    <div className="wallet-module dollar-receive">
      <p className="eyebrow">{providerName}</p>
      <p className="dollar-receive-reference">{account.accountReference}</p>
      <CopyControl value={account.accountReference} label={`Copy account number ${account.accountReference}`}>COPY NUMBER</CopyControl>
    </div>
    <p className="node-note">Give this account number to someone sending you Dollars. It is the same number your own transfers are sent from.</p>
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
    <FocusedHeading title="ACCOUNT" onBack={onCancel} />

    <div className="node-section"><span>CURRENT ACCOUNT</span></div>
    <div className="wallet-module dollar-identity-card">
      <div className="dollar-identity-head">
        <span className="dollar-monogram" aria-hidden="true">{providerMonogram(providerName)}</span>
        <span className="dollar-identity-name">
          <strong>{account.accountReference}</strong>
          <small>{providerName}</small>
        </span>
        {/* Truthful: this Device holds an active Financial Session over this Account. */}
        <span className="node-chip">ACTIVE</span>
      </div>
      <dl className="dollar-terms dollar-terms--inset">
        <div><dt>BALANCE</dt><dd className="dollar-terms-amount">{formatDollarCents(account.balanceCents)}</dd></div>
        {alreadyPersonal && <div><dt>TYPE</dt><dd>Personal account</dd></div>}
      </dl>
    </div>

    {savedSignIn && !alreadyPersonal && <SavedSignIn saved={savedSignIn} onContinue={() => onSwitched('Signed in to your personal account.')} />}
    <ManualSignIn onSignedIn={() => onSwitched('Signed in to the other account.')} />

    <div className="node-section"><span>ACCOUNT ACTIONS</span></div>
    <button className="node-action node-action--destructive dollar-sign-out" type="button" onClick={() => { actions.logoutDollarAccount(); onSignedOut() }}>SIGN OUT</button>
  </section>
}

/** Provider initials, projected from the represented display name. It states nothing the name does not. */
function providerMonogram(providerName: string): string {
  return providerName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0].toUpperCase()).join('')
}

function SignedOut({ providerName, savedSignIn, onSignedIn }: {
  providerName: string
  savedSignIn?: DeviceSavedDollarSignIn
  onSignedIn: () => void
}) {
  return <section className="dollar-client" aria-label="Dollar account signed out">
    {/* Still the Wallet's financial hero, holding the provider without an Account:
        no balance, reference or activity exists without a Financial Session. */}
    <div className="dollar-hero dollar-hero--locked">
      <p className="eyebrow dollar-provider">{providerName}</p>
      <p className="dollar-signed-out">Signed out</p>
      <p className="dollar-signed-out-note">Sign in to reach this device's Civic Dollar account.</p>
    </div>
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
    <div className="wallet-module dollar-saved">
      <div className="dollar-saved-head">
        <span className="dollar-saved-mark" aria-hidden="true"><WalletIcon name="account" /></span>
        <span className="dollar-identity-name">
          <strong className="dollar-saved-login">{saved.loginIdentifier}</strong>
          <small>Saved sign-in on this device</small>
        </span>
      </div>
      {stale && <p className="node-note node-note--caution" role="alert">This device's saved sign-in no longer works. Sign in below.</p>}
      <button className="dollar-primary" type="button" onClick={() => {
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
    <form className="dollar-form dollar-form--secondary" onSubmit={submit} aria-label="Dollar account sign in">
      <label className="node-field"><span>LOGIN ID</span><input className="node-input" name="loginIdentifier" value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} autoComplete="username" spellCheck={false} /></label>
      <label className="node-field"><span>PASSWORD</span><input className="node-input" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {failed && <p className="node-note node-note--caution" role="alert">Invalid login ID or password.</p>}
      <button className="node-action" type="submit">SIGN IN</button>
    </form>
  </>
}

/** The focused-task heading: one BACK to the dashboard and the name of the task. */
function FocusedHeading({ title, onBack }: { title: string; onBack: () => void }) {
  return <div className="dollar-focused-head">
    <button className="node-back" type="button" onClick={onBack}>← BACK</button>
    <p className="eyebrow">{title}</p>
  </div>
}

/** The Account reference as it appears in the hero: readable, secondary to the balance, and copyable. */
function AccountReference({ reference }: { reference: string }) {
  return <span className="dollar-account-reference">
    <span>{reference}</span>
    <CopyControl value={reference} label={`Copy account number ${reference}`} />
  </span>
}

/**
 * Copies a represented reference exactly as it is. It is a copy affordance
 * only: it resolves nothing, requests nothing and moves no money.
 */
function CopyControl({ value, label, children }: { value: string; label: string; children?: ReactNode }) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  function preserveEditing(event: PointerEvent<HTMLButtonElement>) {
    // Copying must not open the software keyboard or move Shell-owned editing.
    event.preventDefault()
  }

  async function copy() {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setCopyState('idle'), 1600)
  }

  return <button
    className={children ? 'dollar-copy dollar-copy--labeled' : 'dollar-copy'}
    type="button"
    aria-label={label}
    data-copy-state={copyState}
    onPointerDown={preserveEditing}
    onClick={copy}
  >
    <WalletIcon name="copy" />
    {children && <span>{children}</span>}
    <span className="sr-only" aria-live="polite">{copyState === 'copied' ? 'Copied' : copyState === 'failed' ? 'Copy failed' : ''}</span>
  </button>
}

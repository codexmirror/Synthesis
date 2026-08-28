import { useGameActions, useGameState } from '../../app/GameContext'
import {
  findDeviceSavedDollarSignIn,
  projectDollarAccountActivity,
  resolveDollarAccountForDevice,
  type DollarAccountActivityEntry,
} from '../../core/game/dollarFinance'
import type { DollarFinancialAccount } from '../../core/game/types'
import { formatDollarCents, formatSignedDollarCents } from '../dollarFormat'
import { deriveDollarBalanceTrajectory, dollarTrajectoryPolylinePoints } from './balanceTrajectory'
import { Account, SignedOut } from './DollarAccess'
import { Send } from './DollarSend'
import { WalletIcon, type WalletIconName } from './WalletIcon'
import { AccountReference, CopyControl, FocusedHeading } from './walletControls'
import { useState } from 'react'

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
      <p className="dollar-balance">{formatDollarCents(account.balanceCents)}</p>
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

    <div className="node-section"><span>ACTIVITY</span>{activity.length > 0 && <span>{activity.length}</span>}</div>
    <DollarActivity activity={activity} />
  </section>
}

/**
 * One action, as an icon and a label sharing a small deliberate surface.
 *
 * The icon is set above its label at the tile's leading edge rather than
 * centred in it, so the three tiles read as one aligned system rather than as
 * three separately centred buttons. The icon never carries the control: every
 * tile keeps its text label, and the label is the control's whole accessible
 * name.
 */
function ActionTile({ icon, label, onClick }: { icon: WalletIconName; label: string; onClick: () => void }) {
  return <button className="dollar-action" type="button" onClick={onClick}>
    <WalletIcon name={icon} />
    <span>{label}</span>
  </button>
}

/**
 * Dollar activity as one financial list rather than a stack of separate cards.
 *
 * Each row states exactly what the canonical projection carries: the direction,
 * the historical counterparty reference, `SENT` or `RECEIVED`, and the signed
 * amount aligned down the right edge so two rows can be compared at a glance.
 * Direction survives without colour — the mark points the way the money went,
 * the wording says it, and the amount is explicitly signed.
 *
 * No timestamp, category, avatar, merchant, recipient name, status, fee or memo
 * is added, because the world represents none of them.
 */
function DollarActivity({ activity }: { activity: readonly DollarAccountActivityEntry[] }) {
  if (activity.length === 0) {
    return <div className="wallet-module dollar-activity-module dollar-activity-empty">
      <strong>NO ACTIVITY YET</strong>
      <span>Money you send or receive appears here.</span>
    </div>
  }

  return <div className="wallet-module dollar-activity-module">
    {activity.map((entry) => <div className="dollar-activity" key={entry.id}>
      <span className={`dollar-activity-mark dollar-activity-mark--${entry.direction}`} aria-hidden="true">
        <WalletIcon name={entry.direction === 'outgoing' ? 'send' : 'receive'} />
      </span>
      <span className="dollar-activity-copy">
        <strong>{entry.counterpartyReference}</strong>
        <small>{entry.direction === 'outgoing' ? 'SENT' : 'RECEIVED'}</small>
      </span>
      <span className={`dollar-amount dollar-amount--${entry.direction}`}>{formatSignedDollarCents(entry.amountCents)}</span>
    </div>)}
  </div>
}

/**
 * The Dollar hero's trajectory: one stroke through the balance states this
 * Account is represented as having held, oldest to current.
 *
 * It belongs to the hero rather than sitting under it: the stroke runs the full
 * width of the module and rests on its lower edge, so the balance above it and
 * the movement behind that balance read as one composition.
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
  // The box is taller than the plotted range at each edge, so the highest and
  // lowest represented states keep a whole stroke and a little air rather than
  // being clipped flat against the module's edges.
  return <svg className="dollar-trajectory" viewBox="0 0 100 44" preserveAspectRatio="none" aria-hidden="true">
    <defs>
      {/* The fill fades out downwards so the stroke sits on the module rather
          than on a block of colour with an edge of its own. */}
      <linearGradient id="dollarTrajectoryFade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgb(140 255 178)" stopOpacity=".17" />
        <stop offset="100%" stopColor="rgb(140 255 178)" stopOpacity="0" />
      </linearGradient>
    </defs>
    <g transform="translate(0 5)">
      <polygon className="dollar-trajectory-area" points={`${points} 100,39 0,39`} />
      <polyline className="dollar-trajectory-line" points={points} vectorEffect="non-scaling-stroke" />
    </g>
  </svg>
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
      <p className="eyebrow dollar-provider">{providerName}</p>
      <p className="dollar-receive-reference">{account.accountReference}</p>
      <CopyControl variant="plate" value={account.accountReference} label={`Copy account number ${account.accountReference}`}>COPY NUMBER</CopyControl>
    </div>
    {/* Scoped to the Account, not to the operator: a Session over a foreign
        Account does not make that Account the player's. */}
    <p className="node-note dollar-receive-note">Share this account number with someone sending Dollars to this account. Transfers from this account use the same reference.</p>
  </section>
}

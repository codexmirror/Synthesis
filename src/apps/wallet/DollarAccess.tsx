import { type FormEvent, useState } from 'react'
import { useGameActions } from '../../app/GameContext'
import type { DeviceSavedDollarSignIn, DollarFinancialAccount } from '../../core/game/types'
import { formatDollarCents } from '../dollarFormat'
import { WalletIcon } from './WalletIcon'
import { FocusedHeading } from './walletControls'

/**
 * Who this Device is currently signed in as, and the two ways into a different
 * Account: the saved personal path and manual sign-in.
 *
 * The Account is the Provider's. This Device holds saved material and at most
 * one Financial Session over one Account, and a Session may be over an Account
 * the Device never saved — so nothing here attributes an Account to the Device
 * or to the player, and nothing states an Account status, because the Provider
 * represents none.
 */
export function Account({ account, providerName, savedSignIn, onSwitched, onSignedOut, onCancel }: {
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
      </div>
      <dl className="dollar-terms dollar-terms--inset">
        <div><dt>BALANCE</dt><dd className="dollar-terms-amount dollar-terms-amount--lead">{formatDollarCents(account.balanceCents)}</dd></div>
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

export function SignedOut({ providerName, savedSignIn, onSignedIn }: {
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
      {/* The Device holds saved material and at most one Financial Session; the
          Account is the Provider's. Manual sign-in may reach any Account, so
          the copy must not imply this Device owns one. */}
      <p className="dollar-signed-out-note">Sign in to access a Civic Dollar account on this device.</p>
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
      <button className="dollar-primary dollar-primary--footer" type="button" onClick={() => {
        const result = actions.authenticateDollarAccountWithSavedSignIn()
        if (result.status === 'authenticated') return onContinue()
        setStale(true)
      }}>CONTINUE</button>
    </div>
  </>
}

/**
 * Manual sign-in stays available beside the saved path, and is the only way
 * into an account this Device has not saved. It is deliberately the quieter of
 * the two: recessed fields and a small outlined action, so the saved path reads
 * as the intended way in without this one becoming hard to find or to use.
 */
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
    <div className="node-section dollar-section--quiet"><span>OTHER ACCOUNT</span></div>
    <form className="dollar-form dollar-form--secondary" onSubmit={submit} aria-label="Dollar account sign in">
      <label className="node-field"><span>LOGIN ID</span><input className="node-input" name="loginIdentifier" value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} autoComplete="username" spellCheck={false} /></label>
      <label className="node-field"><span>PASSWORD</span><input className="node-input" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {failed && <p className="node-note node-note--caution" role="alert">Invalid login ID or password.</p>}
      <button className="node-action" type="submit">SIGN IN</button>
    </form>
  </>
}

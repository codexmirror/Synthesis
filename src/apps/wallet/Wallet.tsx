import { type FormEvent, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { formatDollarCents, resolveDollarAccountForDevice } from '../../core/game/dollarFinance'
import { formatNodeUnitsAsNode } from '../nodeFormat'

export function Wallet() {
  const state = useGameState()
  const actions = useGameActions()
  const { dollarFinance, nodeWallet } = state
  const account = resolveDollarAccountForDevice(state, state.player.localDevice.id)
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loginFailed, setLoginFailed] = useState(false)
  const activity = [...nodeWallet.activity.records].reverse()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = actions.authenticateDollarAccount(loginIdentifier, password)
    setLoginFailed(result.status !== 'authenticated')
  }

  return <section className="app-content wallet-app">
    <div className="node-section"><span>DOLLARS</span></div>
    {account ? <>
      <p className="balance">{formatDollarCents(account.balanceCents)}</p>
      <dl className="node-facts">
        <div><dt>PROVIDER</dt><dd>{dollarFinance.provider.displayName}</dd></div>
        <div><dt>ACCOUNT</dt><dd>{account.accountReference}</dd></div>
        <div><dt>STATUS</dt><dd>SIGNED IN</dd></div>
      </dl>
    </> : <form onSubmit={submit} aria-label="Dollar account sign in">
      <label className="node-field"><span>LOGIN ID</span><input className="node-input" name="loginIdentifier" value={loginIdentifier} onChange={(event) => setLoginIdentifier(event.target.value)} autoComplete="username" /></label>
      <label className="node-field"><span>PASSWORD</span><input className="node-input" name="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
      {loginFailed && <p className="node-note" role="alert">Invalid login ID or password.</p>}
      <button className="node-action" type="submit">SIGN IN</button>
    </form>}

    <div className="node-section"><span>NODE</span></div>
    <p className="balance balance--node">{formatNodeUnitsAsNode(nodeWallet.balanceNodeUnits)} NODE</p>
    <dl className="node-facts"><div><dt>PAYOUT ADDRESS</dt><dd>{nodeWallet.address}</dd></div></dl>
    <div className="node-section"><span>NODE ACTIVITY</span></div>
    {activity.length > 0
      ? <div className="node-list">{activity.map((record) => <div className="node-row" key={record.id}><span className="node-row-copy"><strong>+{record.amountNodeUnits.toLocaleString('en-US')} units</strong><small>MINING PAYOUT</small></span></div>)}</div>
      : <div className="node-empty"><strong>NO NODE ACTIVITY</strong><span>This Wallet has not received NODE.</span></div>}
  </section>
}

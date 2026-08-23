import { useGameState } from '../../app/GameContext'
import { formatNodeUnitsAsNode } from '../nodeFormat'

/**
 * Wallet presents only this Wallet's own economic truth: its canonical
 * balances and the NODE it actually received. It deliberately says nothing
 * about what a payer produced or where a payer routed the rest, because the
 * Wallet does not observe that.
 */
export function Wallet() {
  const { wallet, nodeWallet } = useGameState()
  const activity = [...nodeWallet.activity.records].reverse()
  return <section className="app-content wallet-app">
    <div className="node-section"><span>DOLLARS</span></div>
    <p className="balance">${wallet.balance.toLocaleString('en-US')}</p>
    <p className="node-note">Virtual account · No transactions yet</p>

    <div className="node-section"><span>NODE</span></div>
    <p className="balance balance--node">{formatNodeUnitsAsNode(nodeWallet.balanceNodeUnits)} NODE</p>
    <dl className="node-facts">
      <div><dt>PAYOUT ADDRESS</dt><dd>{nodeWallet.address}</dd></div>
    </dl>

    <div className="node-section"><span>NODE ACTIVITY</span></div>
    {activity.length > 0
      ? <div className="node-list">{activity.map((record) => <div className="node-row" key={record.id}>
          <span className="node-row-copy">
            <strong>+{record.amountNodeUnits.toLocaleString('en-US')} units</strong>
            <small>MINING PAYOUT</small>
          </span>
        </div>)}</div>
      : <div className="node-empty"><strong>NO NODE ACTIVITY</strong><span>This Wallet has not received NODE.</span></div>}
  </section>
}

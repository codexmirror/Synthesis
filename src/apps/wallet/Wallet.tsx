import './wallet.css'
import { useState } from 'react'
import { useGameState } from '../../app/GameContext'
import { formatNodeUnitsAsNode } from '../nodeFormat'
import { DollarClient, type DollarSurface } from './DollarClient'
import { WalletIcon } from './WalletIcon'

/**
 * Wallet presents two independent economic domains on one Device. The Civic
 * Dollar client is the conventional financial account and leads; NODE is a
 * separate, more technical system presented beneath it. Presentation is the
 * only place they meet: there is no shared account, no combined balance and no
 * authority bridge between them (A18).
 *
 * NODE is deliberately the smaller module. It is not a Dollar sub-account, not
 * a second card in one portfolio and not a total: its own colour, its own
 * balance format and its own address treatment keep it recognizably a different
 * economic system, and it offers no action, because none is represented.
 */
export function Wallet() {
  const { nodeWallet } = useGameState()
  const activity = [...nodeWallet.activity.records].reverse()
  // SEND, RECEIVE and ACCOUNT are focused Dollar tasks. NODE is not part of
  // them, so it stays off the surface until the client is back on its overview.
  const [dollarSurface, setDollarSurface] = useState<DollarSurface>('dashboard')

  return <section className="app-content wallet-app">
    <DollarClient surface={dollarSurface} onSurface={setDollarSurface} />

    {dollarSurface === 'dashboard' && <section className="wallet-node" aria-label="NODE wallet">
      <div className="node-section"><span>NODE</span></div>
      <div className="wallet-module wallet-node-module">
        <span className="wallet-node-mark" aria-hidden="true"><WalletIcon name="node" /></span>
        <p className="balance balance--node">{formatNodeUnitsAsNode(nodeWallet.balanceNodeUnits)} NODE</p>
        <p className="wallet-node-address">{nodeWallet.address}</p>
      </div>

      <div className="node-section"><span>NODE ACTIVITY</span></div>
      {activity.length > 0
        ? <div className="node-list">{activity.map((record) => <div className="node-row wallet-node-row" key={record.id}><span className="node-row-copy"><strong>+{record.amountNodeUnits.toLocaleString('en-US')} units</strong><small>MINING PAYOUT</small></span></div>)}</div>
        : <div className="node-empty"><strong>NO NODE ACTIVITY</strong><span>This Wallet has not received NODE.</span></div>}
    </section>}
  </section>
}

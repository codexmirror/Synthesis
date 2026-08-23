import { useGameState } from '../../app/GameContext'

export function Wallet() {
  const { wallet, nodeWallet } = useGameState()
  return <section className="app-content wallet-app">
    <div className="node-section"><span>DOLLARS</span></div>
    <p className="balance">${wallet.balance.toLocaleString('en-US')}</p>
    <p className="node-note">Virtual account · No transactions yet</p>

    <div className="node-section"><span>NODE</span></div>
    <p className="balance balance--node">{nodeWallet.balanceNode.toLocaleString('en-US')} NODE</p>
    <dl className="node-facts">
      <div><dt>PAYOUT ADDRESS</dt><dd>{nodeWallet.address}</dd></div>
    </dl>
  </section>
}

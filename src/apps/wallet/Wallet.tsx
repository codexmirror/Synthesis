import { useGameState } from '../../app/GameContext'

export function Wallet() {
  const { wallet } = useGameState()
  return <section className="app-content wallet-app">
    <div className="node-section"><span>AVAILABLE BALANCE</span></div>
    <p className="balance">${wallet.balance.toLocaleString('en-US')}</p>
    <p className="node-note">Virtual account · No transactions yet</p>
  </section>
}

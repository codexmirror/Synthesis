import { useGameState } from '../../core/game/GameContext'

export function Wallet() {
  const { wallet } = useGameState()
  return <section className="app-content"><p className="eyebrow">AVAILABLE BALANCE</p><div className="balance">${wallet.balance.toLocaleString('en-US')}</div><p className="muted">Virtual account · No transactions yet</p></section>
}

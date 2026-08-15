import { useGame } from '../core/game/GameContext'

export function Wallet() {
  const { player } = useGame()
  return <section className="app-content"><p className="eyebrow">AVAILABLE BALANCE</p><div className="balance">${player.money.toLocaleString('en-US')}</div><p className="muted">Virtual account · No transactions yet</p></section>
}

import { useEffect, useState } from 'react'
import { OS_NAME } from '../core/branding'
import { useGameState } from '../core/game/GameContext'

export function StatusBar() {
  const { player, wallet } = useGameState()
  const [time, setTime] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer) }, [])
  return <header className="status-bar"><strong className="brand"><span className="brand-mark">N</span> {OS_NAME}</strong><div className="top-stats"><span>{player.ip}</span><strong>${wallet.balance.toLocaleString('en-US')}</strong><time>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></header>
}

import { useEffect, useState } from 'react'
import { useGame } from '../core/game/GameContext'

export function StatusBar() {
  const { player } = useGame()
  const [time, setTime] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer) }, [])
  return <header className="status-bar"><strong className="brand"><span className="brand-mark">N</span> NODE-OS</strong><div className="top-stats"><span>{player.ip}</span><strong>${player.money.toLocaleString('en-US')}</strong><time>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div></header>
}

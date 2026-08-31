import { useEffect, useState } from 'react'
import { useGameState } from '../app/GameContext'
import { deriveNetworkStatusLabel } from '../core/game/deviceOperationalState'

export function StatusBar() {
  const { player } = useGameState()
  const device = player.localDevice
  const [time, setTime] = useState(() => new Date())
  useEffect(() => { const timer = window.setInterval(() => setTime(new Date()), 1000); return () => clearInterval(timer) }, [])
  const networkStatus = deriveNetworkStatusLabel(device.operational)
  return <header className="status-bar"><strong className="brand">{device.firmware.name} <span>/</span> {device.displayName}</strong><div className="top-stats"><span>{device.network.ip}</span><time>{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time><span className="connection" data-network-status={networkStatus} aria-label={`Network ${networkStatus}`}><i />{networkStatus}</span></div></header>
}

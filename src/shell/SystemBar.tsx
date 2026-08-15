import { useGame } from '../core/game/GameContext'

export function SystemBar() {
  const { player } = useGame()
  return <footer className="system-bar"><div><span>CPU <strong>{player.hardware.cpu}%</strong></span><span>RAM <strong>{player.hardware.ram}%</strong></span></div><span className="online"><i />{player.status}</span></footer>
}

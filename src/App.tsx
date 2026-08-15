import { GameProvider } from './core/game/GameContext'
import { Shell } from './shell/Shell'

export default function App() {
  return <GameProvider><Shell /></GameProvider>
}

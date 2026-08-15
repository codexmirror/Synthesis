import { GameProvider } from './app/GameContext'
import { Shell } from './shell/Shell'

export default function App() {
  return <GameProvider><Shell /></GameProvider>
}

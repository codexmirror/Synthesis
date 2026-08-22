import { GameProvider } from './app/GameContext'
import { Shell } from './shell/Shell'
import { EditingPlaneDebug } from './shell/EditingPlaneDebug'

export default function App() {
  return (
    <GameProvider>
      <Shell />
      <EditingPlaneDebug />
    </GameProvider>
  )
}

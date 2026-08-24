import { type AppId, appEntries } from './appRegistry'
import { useGameState } from '../app/GameContext'
import { AppIcon } from './AppIcon'
import { deriveActivityMonitor } from '../apps/processes/activityMonitor'

export function Home({ openApp }: { openApp: (app: AppId) => void }) {
  const state = useGameState()
  const device = state.player.localDevice
  const activeActivities = deriveActivityMonitor(state).summary.activeCount
  const secondary: Partial<Record<AppId, string>> = {
    terminal: 'LOCAL SHELL',
    network: 'KNOWN SPACE',
    processes: `${activeActivities} RUNNING`,
    files: 'LOCAL',
    system: `${device.firmware.name} ${device.firmware.version}`,
  }

  return (
    <main className="home">
      <div className="home-heading">
        <h1>HOME</h1>
        <p>LOCAL DEVICE <span>·</span> {device.displayName}</p>
      </div>
      <div className="app-grid">
        {appEntries.map(([id, app]) => (
          <button
            className="app-launcher"
            key={id}
            onClick={() => openApp(id)}
            aria-label={`Open ${app.label}`}
          >
            <span className="app-icon"><AppIcon app={id} /></span>
            <span className="launcher-copy">
              <strong>{app.label}</strong>
              {secondary[id] && <small>{secondary[id]}</small>}
            </span>
          </button>
        ))}
      </div>
      <section className="device-observation" aria-labelledby="this-device-title">
        <h2 id="this-device-title">THIS DEVICE</h2>
        <dl>
          <div><dt>DEVICE</dt><dd>{device.displayName}</dd></div>
          <div><dt>ADDRESS</dt><dd>{device.network.ip}</dd></div>
          <div><dt>FIRMWARE</dt><dd>{device.firmware.name} {device.firmware.version}</dd></div>
          <div><dt>NETWORK</dt><dd>{device.runtime.networkStatus}</dd></div>
        </dl>
      </section>
    </main>
  )
}

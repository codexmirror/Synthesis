import { type AppId, appEntries } from './appRegistry'
import { useGameState } from '../app/GameContext'
import { AppIcon } from './AppIcon'
import { deriveActivityMonitor } from '../apps/processes/activityMonitor'
import { deriveUnreadMailCount } from '../core/game/mail'
import { deriveNetworkStatusLabel } from '../core/game/deviceOperationalState'

export function Home({ openApp }: { openApp: (app: AppId) => void }) {
  const state = useGameState()
  const device = state.player.localDevice
  const activeActivities = deriveActivityMonitor(state).summary.activeCount
  const unreadMail = deriveUnreadMailCount(state.mail)
  const secondary: Partial<Record<AppId, string>> = {
    terminal: 'LOCAL SHELL',
    network: 'KNOWN SPACE',
    mail: `${unreadMail} UNREAD`,
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
      {state.fieldwork && <section className="home-fieldwork"><span className="ns-eyebrow">YOUR MACHINE. THEIR NETWORKS.</span><h2>Something worth breaking into.</h2><p>{state.fieldwork.requests.filter(r => !r.delivered).length} recovery requests · {state.fieldwork.receipts.length} delivered · {(state.nodeWallet.balanceNodeUnits / 1_000_000).toFixed(3)} NODE</p><button className="node-action" onClick={() => openApp('network')}>EXPLORE NETWORKS</button><button className="node-action" onClick={() => openApp('software')}>YOUR SOFTWARE</button></section>}
      <div className="app-grid" role="group" aria-label="Primary applications">
        {appEntries.filter(([id]) => state.fieldwork ? ['network', 'software', 'files', 'market', 'processes', 'mail'].includes(id) : id !== 'software').map(([id, app]) => (
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
      {state.fieldwork && <details className="home-utilities"><summary>MACHINE UTILITIES</summary>{appEntries.filter(([id]) => ['terminal', 'wallet', 'notes', 'system'].includes(id)).map(([id, app]) => <button className="node-action" key={id} aria-label={`Open ${app.label}`} onClick={() => openApp(id)}>{app.label}</button>)}</details>}
      <section className="device-observation" aria-labelledby="this-device-title">
        <h2 id="this-device-title">THIS DEVICE</h2>
        <dl>
          <div><dt>DEVICE</dt><dd>{device.displayName}</dd></div>
          <div><dt>ADDRESS</dt><dd>{device.network.ip}</dd></div>
          <div><dt>FIRMWARE</dt><dd>{device.firmware.name} {device.firmware.version}</dd></div>
          <div><dt>NETWORK</dt><dd>{deriveNetworkStatusLabel(device.operational)}</dd></div>
        </dl>
      </section>
    </main>
  )
}

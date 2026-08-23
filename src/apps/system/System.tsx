import { useGameState } from '../../app/GameContext'
import { deriveResourceUsage } from '../../core/game/processes'

/**
 * System is the local Device's machine-level sheet: identity, Firmware,
 * hardware capability and the Device-owned installed-software inventory.
 *
 * Current runtime work belongs to the Activity Monitor; System presents only
 * the machine's own summary load, which is Device state rather than a second
 * activity list.
 */
export function System() {
  const state = useGameState()
  const { localDevice } = state.player
  const { firmware, hardware, network, runtime, installedSoftware } = localDevice
  const usage = deriveResourceUsage(localDevice, state.process)

  return <section className="app-content system-app">
    <header className="node-masthead">
      <span className="node-masthead-subject">{localDevice.displayName}</span>
      <span className="node-masthead-meta">LOCAL DEVICE</span>
    </header>

    <div className="node-section"><span>IDENTITY</span></div>
    <dl className="node-facts">
      <div><dt>DEVICE</dt><dd>{localDevice.displayName}</dd></div>
      <div><dt>FIRMWARE</dt><dd>{firmware.name}</dd></div>
      <div><dt>VERSION</dt><dd>{firmware.version}</dd></div>
    </dl>

    <div className="node-section"><span>HARDWARE</span></div>
    <dl className="node-facts">
      <div><dt>CPU</dt><dd>{hardware.cpu.name}</dd></div>
      <div><dt>CPU LOAD</dt><dd>{Math.round(usage.totalCpuLoad)}%</dd></div>
      <div><dt>RAM</dt><dd>{hardware.ram.name} · {hardware.ram.capacityMiB} MiB</dd></div>
      <div><dt>RAM USED</dt><dd>{Math.round(usage.totalRamUsage)}%</dd></div>
    </dl>

    <div className="node-section"><span>NETWORK</span></div>
    <dl className="node-facts">
      <div><dt>ADDRESS</dt><dd>{network.ip}</dd></div>
      <div><dt>STATUS</dt><dd>{runtime.networkStatus}</dd></div>
    </dl>

    <div className="node-section"><span>INSTALLED SOFTWARE</span><span>{installedSoftware.length}</span></div>
    {installedSoftware.length > 0
      ? <div className="node-list">{installedSoftware.map((software) => <div className="node-row" key={software.id}>
          <span className="node-row-copy">
            <strong>{software.name}</strong>
            <small>{software.version}{'channel' in software ? ` · ${software.channel.toUpperCase()}` : ''} · {software.releaseId}</small>
          </span>
        </div>)}</div>
      : <div className="node-empty"><strong>NO INSTALLED SOFTWARE</strong><span>This Device carries no installed software.</span></div>}
  </section>
}

import { useEffect, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { deriveResourceUsage } from '../../core/game/processes'
import { NODE_MINER_PROGRAM_ID } from '../../core/game/nodeMiner'
import { NODESCAN_1_0_STANDARD_RELEASE_ID } from '../../core/game/software'
import type { InstalledSoftware, SoftwareRemovalProcess } from '../../core/game/types'
import { SoftwareReleaseDocumentation } from '../SoftwareReleaseDocumentation'

export function System() {
  const state = useGameState()
  const actions = useGameActions()
  const { localDevice } = state.player
  const { firmware, hardware, network, runtime, installedSoftware } = localDevice
  const usage = deriveResourceUsage(localDevice, state.process)
  const [selectedProductId, setSelectedProductId] = useState<string>()
  const selected = installedSoftware.find(({ id }) => id === selectedProductId)
  const removals = state.process.processes.filter((process): process is SoftwareRemovalProcess => process.kind === 'software_removal' && process.status === 'running' && process.executorDeviceId === localDevice.id)
  useEffect(() => { if (selectedProductId && !selected) setSelectedProductId(undefined) }, [selectedProductId, selected])

  if (selected) return <section className="app-content system-app">
    <button className="node-back" type="button" onClick={() => setSelectedProductId(undefined)}><span aria-hidden="true">←</span> INSTALLED SOFTWARE</button>
    <SoftwareDetail software={selected} firmwareName={firmware.name} firmwareVersion={firmware.version} removing={removals.some(({ productId }) => productId === selected.id)} remove={() => actions.removeInstalledSoftware(selected.id)} />
  </section>

  return <section className="app-content system-app">
    <header className="node-masthead"><span className="node-masthead-subject">{localDevice.displayName}</span><span className="node-masthead-meta">LOCAL DEVICE</span></header>
    <div className="node-section"><span>IDENTITY</span></div>
    <dl className="node-facts"><div><dt>DEVICE</dt><dd>{localDevice.displayName}</dd></div><div><dt>FIRMWARE</dt><dd>{firmware.name}</dd></div><div><dt>VERSION</dt><dd>{firmware.version}</dd></div></dl>
    <div className="node-section"><span>HARDWARE</span></div>
    <dl className="node-facts"><div><dt>CPU</dt><dd>{hardware.cpu.name}</dd></div><div><dt>CPU LOAD</dt><dd>{Math.round(usage.totalCpuLoad)}%</dd></div><div><dt>RAM</dt><dd>{hardware.ram.name} · {hardware.ram.capacityMiB} MiB</dd></div><div><dt>RAM USED</dt><dd>{Math.round(usage.totalRamUsage)}%</dd></div></dl>
    <div className="node-section"><span>NETWORK</span></div>
    <dl className="node-facts"><div><dt>ADDRESS</dt><dd>{network.ip}</dd></div><div><dt>STATUS</dt><dd>{runtime.networkStatus}</dd></div></dl>
    <div className="node-section"><span>INSTALLED SOFTWARE</span><span>{installedSoftware.length}</span></div>
    {installedSoftware.length ? <div className="node-list">{installedSoftware.map((software) => {
      const removing = removals.some(({ productId }) => productId === software.id)
      const removable = !removing && (software.id === NODE_MINER_PROGRAM_ID || software.id === 'nodescan' && software.releaseId !== NODESCAN_1_0_STANDARD_RELEASE_ID)
      return <div className="software-row" key={software.id}>
        <button className="node-row" type="button" onClick={() => setSelectedProductId(software.id)}><span className="node-row-copy"><strong>{software.name}</strong><small>{describeRelease(software)}{removing ? ` · ${software.id === 'nodescan' ? 'RESTORING' : 'REMOVING'}` : ''}</small></span><span className="node-row-arrow" aria-hidden="true">→</span></button>
        {removable && <button className="software-remove" type="button" aria-label={software.id === 'nodescan' ? 'Restore NodeScan 1.0 Standard' : `Remove ${software.name}`} onClick={() => actions.removeInstalledSoftware(software.id)}><span aria-hidden="true">⌫</span></button>}
      </div>
    })}</div> : <div className="node-empty"><strong>NO INSTALLED SOFTWARE</strong><span>This Device carries no installed software.</span></div>}
  </section>
}

function SoftwareDetail({ software, firmwareName, firmwareVersion, removing, remove }: { software: InstalledSoftware; firmwareName: string; firmwareVersion: string; removing: boolean; remove: () => unknown }) {
  const baseline = software.id === 'nodescan' && software.releaseId === NODESCAN_1_0_STANDARD_RELEASE_ID
  const canRemove = software.id === NODE_MINER_PROGRAM_ID || software.id === 'nodescan' && !baseline
  return <div className="software-details">
    <header className="node-masthead"><span className="node-masthead-subject">{software.name}</span><span className="node-masthead-meta">{describeRelease(software)}</span></header>
    <SoftwareReleaseDocumentation releaseId={software.releaseId} />
    <div className="node-section"><span>SOFTWARE</span></div>
    <dl className="node-facts"><div><dt>VERSION</dt><dd>{software.version}</dd></div>{'channel' in software && <div><dt>CHANNEL</dt><dd>{software.channel.toUpperCase()}</dd></div>}{'publisher' in software && software.publisher && <div><dt>PUBLISHER</dt><dd>{software.publisher}</dd></div>}<div><dt>RELEASE</dt><dd>{software.releaseId}</dd></div></dl>
    <div className="node-section"><span>SYSTEM</span></div>
    <dl className="node-facts">{baseline ? <><div><dt>STATE</dt><dd>SYSTEM BASELINE</dd></div><div><dt>PROVIDED BY</dt><dd>{firmwareName} {firmwareVersion}</dd></div></> : software.id === 'nodescan' ? <><div><dt>{removing ? 'STATE' : 'ACTIVE'}</dt><dd>{removing ? 'RESTORING' : '1.1 EXPERIMENTAL'}</dd></div><div><dt>BASELINE</dt><dd>1.0 STANDARD</dd></div></> : <div><dt>STATE</dt><dd>{removing ? 'REMOVING' : 'INSTALLED'}</dd></div>}</dl>
    {canRemove && !removing && <><div className="node-section"><span>ACTIONS</span></div><button className="node-action node-action--destructive" type="button" onClick={remove}>{software.id === 'nodescan' ? 'RESTORE 1.0 STANDARD' : 'REMOVE SOFTWARE'}</button></>}
  </div>
}

function describeRelease(software: InstalledSoftware) { return `${software.version}${'channel' in software ? ` · ${software.channel.toUpperCase()}` : ''}${'publisher' in software && software.publisher ? ` · ${software.publisher}` : ''}` }

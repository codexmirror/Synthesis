import { useState } from 'react'
import { useGameActions, useGameState } from '../app/GameContext'
import { deriveSoftwarePackageEligibility } from '../core/game/softwareInstallation'
import { readServiceKey, SENTRY_RELEASE } from '../core/game/fieldwork'
import type { FilesystemFile } from '../core/game/types'
import type { ExecutableAppId } from '../shell/appRegistry'
import { softwarePurpose } from './softwarePurpose'

export function Software({ openApp }: { openApp?: (app: ExecutableAppId) => void }) {
  const state = useGameState(), actions = useGameActions(), device = state.player.localDevice
  const [feedback, setFeedback] = useState('')
  const packages = device.filesystem.files.filter(f => f.kind === 'software_package' || f.kind === 'software_module' || f.kind === 'deauth_extension')
  const installedRoute: Record<string, ExecutableAppId> = { nodescan: 'network', flipper: 'flipper', 'product-rattler-v0': 'rattler' }
  const keys = device.filesystem.files.filter(file => readServiceKey(file))
  function install(file: FilesystemFile) { const result = actions.installLocalSoftwarePackage(file.path); setFeedback(result.status === 'started' ? `Installing ${'name' in file ? file.name : file.path} on ${device.displayName}.` : result.status.replaceAll('_', ' ')) }
  return <section className="app-content software-workbench">
    <header className="node-masthead"><span className="node-masthead-subject">Software on {device.displayName}</span><span className="node-masthead-meta">PACKAGES · INSTALLATIONS · TOOLS</span></header>
    <p className="node-note">Recovered files and purchased downloads meet here. Installing changes this machine; a module works from its file.</p>
    <div className="node-section"><span>INSTALLED</span><button className="node-action" onClick={() => openApp?.('market')}>FIND SOFTWARE</button></div>
    {device.installedSoftware.map(s => <div className="software-row" key={s.id}><div><strong>{s.name} {s.version}</strong><p>{softwarePurpose(s.id)}</p></div>{installedRoute[s.id] && <button className="node-action" onClick={() => openApp?.(installedRoute[s.id])}>OPEN</button>}{s.id === SENTRY_RELEASE.productId && <button className="node-action" onClick={() => { actions.runSentrySweep(); setFeedback('Sentry removed recognized RATTLER payloads and NODE Miner executables and stopped their running work on this machine. Packages remain available.') }}>CLEAN KNOWN PAYLOADS</button>}</div>)}
    <div className="node-section"><span>ACQUIRED ARTIFACTS</span><span>{packages.length}</span></div>
    {packages.map(file => {
      const eligibility = file.kind === 'software_package' ? deriveSoftwarePackageEligibility(file, device, state.process) : undefined
      const running = state.process.processes.find(p => p.kind === 'software_installation' && p.status === 'running' && p.executorDeviceId === device.id && file.kind === 'software_package' && p.productId === file.productId)
      return <article className="software-row" key={file.id}><div><strong>{file.name} {'version' in file ? file.version : ''}</strong><p>{softwarePurpose(file.kind === 'software_package' ? file.productId : file.kind === 'software_module' ? file.moduleId : 'deauth')}</p><small>{file.path}</small></div><div>{file.kind === 'software_package' ? <><button className="node-action" disabled={eligibility?.status !== 'installable'} onClick={() => install(file)}>{running?.kind === 'software_installation' ? `INSTALLING ${Math.floor(running.workCompleted / running.workRequired * 100)}%` : eligibility?.status === 'installed' ? 'INSTALLED' : eligibility?.status === 'installable' ? 'INSTALL ON NODE-OS' : eligibility?.status.replaceAll('_', ' ').toUpperCase()}</button></> : <span className="node-chip">{file.kind === 'software_module' ? 'READY FROM FILE' : 'REQUIRES FLIPPER'}</span>}</div></article>
    })}
    {keys.length > 0 && <><div className="node-section">MAINTENANCE KEYS</div>{keys.map(file => <div className="software-row" key={file.id}><span>{file.path.split('/').pop()}<small>{readServiceKey(file)!.address}</small></span><button className="node-action" onClick={() => { const result = actions.authenticateServiceKey(file.id); setFeedback(result.status === 'access_established' ? 'Access established. Open NodeScan to connect.' : 'Key rejected. Recover a fresh copy; credentials rotate.') }}>USE KEY</button></div>)}</>}
    {feedback && <output role="status">{feedback}</output>}
  </section>
}

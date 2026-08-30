import './flipper.css'
import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import {
  FLIPPER_MODULE_IDS,
  FLIPPER_MODULE_NAME,
  FLIPPER_MODULE_TECHNIQUE,
  findInstalledFlipper,
  findLocalFlipperModuleArtifacts,
  findRunningFlipperModuleIntegration,
  type StartFlipperModuleIntegrationResult,
} from '../../core/game/flipper'
import type { FlipperInstallation, FlipperModuleIntegrationProcess, SoftwareModuleFile } from '../../core/game/types'
import { formatBytes } from '../byteFormat'
import { SoftwareReleaseCapabilities, SoftwareReleaseDisclosure } from '../SoftwareReleaseDocumentation'

/**
 * The NODE-OS Flipper client.
 *
 * Flipper is one installed software product, and this surface states exactly
 * what the Device currently holds: the release, the concrete build, that
 * build's represented size, and which concrete modules it integrates. None of
 * it is stored here — every value is read from canonical installed software,
 * the local filesystem, and running Process state on every render.
 *
 * Integration is admitted through the canonical operation alone. This surface
 * owns only which artifact is selected and one transient feedback string.
 */
export function Flipper() {
  const state = useGameState()
  const actions = useGameActions()
  const device = state.player.localDevice
  const flipper = findInstalledFlipper(device)
  const integrating = findRunningFlipperModuleIntegration(state)
  const artifacts = findLocalFlipperModuleArtifacts(device)
  const [feedback, setFeedback] = useState<string>()

  if (!flipper) {
    return <section className="app-content flipper-app">
      <div className="node-empty"><strong>FLIPPER NOT INSTALLED</strong><span>This Device carries no installed Flipper.</span></div>
    </section>
  }

  function integrate(file: SoftwareModuleFile) {
    const result = actions.startFlipperModuleIntegration(file.id)
    setFeedback(result.status === 'started' ? undefined : describeIntegrationFailure(result))
  }

  return <section className="app-content flipper-app">
    <header className="node-masthead">
      <span className="node-masthead-subject">{flipper.name}</span>
      <span className="node-masthead-meta">{flipper.publisher ? `${flipper.publisher} · ` : ''}{device.displayName}</span>
    </header>
    <div className="node-section"><span>IDENTITY</span><span>{flipper.integratedModules.length} {flipper.integratedModules.length === 1 ? 'MODULE' : 'MODULES'}</span></div>
    <dl className="node-facts">
      <div><dt>RELEASE</dt><dd>{flipper.version}{flipper.channel ? ` · ${flipper.channel.toUpperCase()}` : ''}</dd></div>
      <div><dt>BUILD</dt><dd className="flipper-build">{flipper.buildId}</dd></div>
      <div><dt>SIZE</dt><dd>{formatBytes(flipper.sizeBytes)}</dd></div>
    </dl>

    <Modules flipper={flipper} integrating={integrating} />
    <Integration
      flipper={flipper}
      artifacts={artifacts}
      integrating={integrating}
      feedback={feedback}
      integrate={integrate}
    />
    <SoftwareReleaseCapabilities releaseId={flipper.releaseId} />
    <SoftwareReleaseDisclosure releaseId={flipper.releaseId} facts={<dl className="node-facts">
      <div><dt>RELEASE ID</dt><dd>{flipper.releaseId}</dd></div>
    </dl>} />
  </section>
}

/** Every module Flipper represents, and whether this concrete build integrates it. */
function Modules({ flipper, integrating }: { flipper: FlipperInstallation; integrating: FlipperModuleIntegrationProcess | undefined }) {
  return <>
    <div className="node-section"><span>MODULES</span><span>{flipper.integratedModules.length} / {FLIPPER_MODULE_IDS.length}</span></div>
    <div className="node-list">
      {FLIPPER_MODULE_IDS.map((moduleId) => {
        const present = flipper.integratedModules.includes(moduleId)
        const working = !present && integrating?.moduleId === moduleId
        return <div className="node-row" key={moduleId}>
          <span className="node-row-glyph" aria-hidden="true">{present ? '▰' : '▱'}</span>
          <span className="node-row-copy">
            <strong>{FLIPPER_MODULE_NAME[moduleId]}</strong>
            <small>{FLIPPER_MODULE_TECHNIQUE[moduleId]}</small>
          </span>
          <span className={present ? 'node-chip' : 'node-chip node-chip--quiet'}>
            {present ? 'INTEGRATED' : working ? 'INTEGRATING' : 'NOT INTEGRATED'}
          </span>
        </div>
      })}
    </div>
  </>
}

/**
 * The integration path: the module artifacts this Device actually possesses,
 * and the one running integration where there is one. A module already in the
 * build offers no action, and the artifact stays an ordinary file either way.
 */
function Integration({ flipper, artifacts, integrating, feedback, integrate }: {
  flipper: FlipperInstallation
  artifacts: readonly SoftwareModuleFile[]
  integrating: FlipperModuleIntegrationProcess | undefined
  feedback: string | undefined
  integrate: (file: SoftwareModuleFile) => void
}) {
  const percent = integrating ? Math.floor(integrating.workCompleted / integrating.workRequired * 100) : 0
  return <>
    <div className="node-section"><span>INTEGRATION</span><span>{artifacts.length} {artifacts.length === 1 ? 'ARTIFACT' : 'ARTIFACTS'}</span></div>
    {integrating && <div className="node-row node-row--incoming">
      <span className="node-row-glyph" aria-hidden="true">↻</span>
      <span className="node-row-copy">
        <strong>{integrating.moduleName}</strong>
        <small>INTEGRATING · {percent}%</small>
        <progress className="node-progress" max={100} value={percent} aria-label={`Integrating ${integrating.moduleName}, ${percent}% complete`} />
      </span>
    </div>}
    {artifacts.length ? <div className="node-list">
      {artifacts.map((file) => {
        const present = flipper.integratedModules.includes(file.moduleId)
        const working = integrating?.moduleId === file.moduleId
        return <div className="node-row flipper-artifact" key={file.id}>
          <span className="node-row-glyph" aria-hidden="true">▱</span>
          <span className="node-row-copy">
            <strong>{file.name} {file.version}</strong>
            <small>{file.path} · {formatBytes(file.sizeBytes)}</small>
          </span>
          {present
            ? <span className="node-chip">INTEGRATED</span>
            : working
              ? <button className="node-action" type="button" disabled>INTEGRATING…</button>
              : <button className="node-action" type="button" onClick={() => integrate(file)}>INTEGRATE</button>}
        </div>
      })}
    </div> : <div className="node-empty">
      <strong>NO MODULE ARTIFACTS</strong>
      <span>This Device holds no Flipper module to integrate.</span>
    </div>}
    {feedback && <p className="node-note node-note--caution">{feedback}</p>}
    <p className="node-note">Integration produces a new build of this same release. The source artifact is not consumed.</p>
  </>
}

function describeIntegrationFailure(result: Exclude<StartFlipperModuleIntegrationResult, { status: 'started' }>): string {
  if (result.status === 'insufficient_memory') return `NOT ENOUGH MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available`
  return result.status.toUpperCase().replaceAll('_', ' ')
}

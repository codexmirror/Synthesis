import './flipper.css'
import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import {
  deriveFlipperModuleDisclosure,
  findInstalledFlipper,
  findRunningFlipperModuleIntegration,
  type FlipperModuleDisclosureRow,
  type StartFlipperModuleIntegrationResult,
} from '../../core/game/flipper'
import type { FlipperModuleIntegrationProcess } from '../../core/game/types'
import { formatBytes } from '../byteFormat'
import { SoftwareReleaseCapabilities, SoftwareReleaseDisclosure } from '../SoftwareReleaseDocumentation'
import { deriveFlipperArsenal, type FlipperArsenalBranch } from './arsenalProjection'

/**
 * The NODE-OS Flipper client.
 *
 * Flipper is one installed software product, and this surface states exactly
 * what the Device currently holds: the release, the concrete build, that
 * build's represented size, and which concrete modules it integrates. None of
 * it is stored here — every value is read from canonical installed software,
 * the local filesystem, and running Process state on every render.
 *
 * MODULES is the complete module workflow: `deriveFlipperModuleDisclosure`
 * decides which modules player-owned truth justifies showing at all, so this
 * surface never enumerates the authored module catalog. Integration is
 * admitted through the canonical operation alone; this surface owns only
 * one transient feedback string.
 */
export function Flipper() {
  const state = useGameState()
  const actions = useGameActions()
  const device = state.player.localDevice
  const flipper = findInstalledFlipper(device)
  const integrating = findRunningFlipperModuleIntegration(state)
  const [feedback, setFeedback] = useState<string>()

  if (!flipper) {
    return <section className="app-content flipper-app">
      <div className="node-empty"><strong>FLIPPER NOT INSTALLED</strong><span>This Device carries no installed Flipper.</span></div>
    </section>
  }

  const rows = deriveFlipperModuleDisclosure(flipper, device, integrating)
  const arsenal = deriveFlipperArsenal(device)

  function integrate(fileId: string) {
    const result = actions.startFlipperModuleIntegration(fileId)
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

    <Arsenal branches={arsenal} />
    <Modules rows={rows} integrating={integrating} integrate={integrate} />
    {feedback && <p className="node-note node-note--caution">{feedback}</p>}
    <SoftwareReleaseCapabilities releaseId={flipper.releaseId} />
    <SoftwareReleaseDisclosure releaseId={flipper.releaseId} facts={<dl className="node-facts">
      <div><dt>RELEASE ID</dt><dd>{flipper.releaseId}</dd></div>
    </dl>} />
  </section>
}

/** Collection and orientation only. Contextual execution remains in NodeScan ACTIONS. */
function Arsenal({ branches }: { branches: readonly FlipperArsenalBranch[] }) {
  const providerCount = branches.reduce((count, branch) => count + branch.providers.length, 0)
  return <>
    <div className="node-section"><span>ARSENAL</span><span>{providerCount} {providerCount === 1 ? 'PROVIDER' : 'PROVIDERS'}</span></div>
    {branches.length ? <div className="flipper-tree" role="region" aria-label="Offensive arsenal">
      {branches.map((branch) => <section className="flipper-branch" key={branch.area}>
        <div className="flipper-branch-area"><span aria-hidden="true">◆</span><strong>{branch.area}</strong></div>
        <div className="flipper-family">
          <div className="flipper-family-label"><span aria-hidden="true">◇</span><strong>{branch.family}</strong></div>
          <div className="flipper-providers">{branch.providers.map((provider) => <article className="flipper-provider" key={provider.id}>
            <span className="flipper-provider-node" aria-hidden="true" />
            <div><strong>{provider.name} {provider.version}</strong><small>{provider.form} · {provider.integration}</small></div>
          </article>)}</div>
        </div>
      </section>)}
    </div> : <div className="node-empty"><strong>ARSENAL EMPTY</strong><span>No compatible offensive provider is represented on this Device.</span></div>}
    <p className="node-note">Collected providers are organized here. Execute their Techniques against a selected target in NodeScan ACTIONS.</p>
  </>
}

/**
 * The complete current module workflow in one surface: a module already
 * integrated states INTEGRATED, a possessed exact-compatible module not yet
 * integrated offers INTEGRATE, and one currently integrating shows its
 * running progress — all in that same module's row, so no module is ever
 * rendered twice and no separate INTEGRATION section exists. A module
 * neither integrated nor backed by a possessed compatible artifact is
 * already absent from `rows` and is never listed here.
 */
function Modules({ rows, integrating, integrate }: {
  rows: readonly FlipperModuleDisclosureRow[]
  integrating: FlipperModuleIntegrationProcess | undefined
  integrate: (fileId: string) => void
}) {
  const percent = integrating ? Math.floor(integrating.workCompleted / integrating.workRequired * 100) : 0
  return <>
    <div className="node-section"><span>MODULES</span><span>{rows.length}</span></div>
    {rows.length ? <div className="node-list">
      {rows.map((row) => <div className={row.status === 'integrating' ? 'node-row node-row--incoming flipper-artifact' : 'node-row flipper-artifact'} key={row.moduleId}>
        <span className="node-row-glyph" aria-hidden="true">{row.status === 'integrated' ? '▰' : row.status === 'integrating' ? '↻' : '▱'}</span>
        <span className="node-row-copy">
          <strong>{row.name}</strong>
          {row.status === 'integrating'
            ? <>
                <small>INTEGRATING · {percent}%</small>
                <progress className="node-progress" max={100} value={percent} aria-label={`Integrating ${row.name}, ${percent}% complete`} />
              </>
            : <small>{row.technique}{row.status === 'available' && row.artifact ? ` · ${row.artifact.path} · ${formatBytes(row.artifact.sizeBytes)}` : ''}</small>}
        </span>
        {row.status === 'integrated'
          ? <span className="node-chip">INTEGRATED</span>
          : row.status === 'integrating'
            ? <button className="node-action" type="button" disabled>INTEGRATING…</button>
            : <button className="node-action" type="button" onClick={() => integrate(row.artifact!.id)}>INTEGRATE</button>}
      </div>)}
    </div> : <div className="node-empty">
      <strong>NO MODULES</strong>
      <span>This Flipper integrates no modules, and this Device holds no compatible module artifact.</span>
    </div>}
    <p className="node-note">Integration produces a new build of this same release. The source artifact is not consumed, and is not required afterward.</p>
  </>
}

function describeIntegrationFailure(result: Exclude<StartFlipperModuleIntegrationResult, { status: 'started' }>): string {
  if (result.status === 'insufficient_memory') return `NOT ENOUGH MEMORY · ${result.requiredMiB} MiB required · ${Math.floor(result.availableMiB)} MiB available`
  return result.status.toUpperCase().replaceAll('_', ' ')
}

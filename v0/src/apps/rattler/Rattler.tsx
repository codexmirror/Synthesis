import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { deriveRattlerProcesses, RATTLER_ATTEMPTS_PER_MINUTE, RATTLER_CANDIDATE_BUDGET } from '../../core/game/rattler'
import { resolveActiveRemoteTarget } from '../../core/game/remoteSession'
import { RATTLER_1_0 } from '../../core/game/softwareReleaseContent'

export function Rattler() {
  const state = useGameState()
  const { createRattlerPayload, deployRattler } = useGameActions()
  const [target, setTarget] = useState('')
  const [feedback, setFeedback] = useState<string>()
  const [selectedProcessId, setSelectedProcessId] = useState<string>()
  const remote = resolveActiveRemoteTarget(state)
  const processes = deriveRattlerProcesses(state)
  const process = processes.find(({ id }) => id === selectedProcessId) ?? processes.at(-1)
  const remotePayload = remote?.target.filesystem?.files.find((file) => file.kind === 'rattler_payload'
    && file.targetDeviceId === remote.target.id && file.rattlerReleaseId === RATTLER_1_0.releaseId
    && file.rattlerBuildId === RATTLER_1_0.buildId)

  function create() {
    const result = createRattlerPayload(target.trim())
    setFeedback(result.status === 'created' ? `CREATED · ${result.file.path}` : result.status.toUpperCase().replaceAll('_', ' '))
  }

  function deploy() {
    const result = deployRattler!()
    setFeedback(result.status === 'started' ? 'DEPLOYED' : result.status.toUpperCase().replaceAll('_', ' '))
  }

  return <section className="app-content">
    <header className="node-masthead"><h1 className="node-masthead-subject">RATTLER</h1></header>
    <label className="node-field">
      <span>TARGET</span>
      <input className="node-input" aria-label="IP address" placeholder="IP ADDRESS" value={target} onChange={(event) => setTarget(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} />
    </label>
    <div className="file-kind-actions"><button className="node-action" type="button" onClick={create}>CREATE PAYLOAD</button></div>
    {remotePayload && <div className="file-kind-actions"><button className="node-action" type="button" onClick={deploy}>DEPLOY ON {remote!.target.id}</button></div>}
    {processes.length > 0 && <nav aria-label="RATTLER deployments">
      {processes.map((deployment) => <button className="node-action" type="button" key={deployment.id}
        aria-pressed={deployment.id === process?.id} onClick={() => setSelectedProcessId(deployment.id)}>
        {deployment.targetDeviceId} · {deployment.status === 'running' ? 'RUNNING' : deployment.result?.status === 'pin_found' ? 'SUCCESS' : deployment.result?.status === 'search_exhausted' ? 'SEARCH EXHAUSTED' : 'INTERRUPTED'}
      </button>)}
    </nav>}
    {process && <dl aria-label="RATTLER deployment status">
      <dt>TARGET</dt><dd>{process.targetDeviceId}</dd>
      <dt>PAYLOAD</dt><dd>{process.payloadPathSnapshot}</dd>
      <dt>STATUS</dt><dd>{process.status === 'running' ? 'RUNNING' : process.result?.status === 'pin_found' ? 'SUCCESS / PIN FOUND' : process.result?.status === 'search_exhausted' ? 'SEARCH EXHAUSTED' : 'INTERRUPTED / PAYLOAD LOST'}</dd>
      <dt>ATTEMPTS</dt><dd>{process.attemptsCompleted} / {RATTLER_CANDIDATE_BUDGET}</dd>
      <dt>RATE</dt><dd>{RATTLER_ATTEMPTS_PER_MINUTE} / MIN</dd>
      <dt>CURRENT</dt><dd>{process.currentCandidate ?? '—'}</dd>
      <dt>ELAPSED</dt><dd>{Math.floor(process.elapsedMs / 1000)} S</dd>
    </dl>}
    {feedback && <p className={feedback.startsWith('CREATED') ? 'node-note' : 'node-note node-note--caution'}>{feedback}</p>}
  </section>
}

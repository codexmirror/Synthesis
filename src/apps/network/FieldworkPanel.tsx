import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { recoveryDigest, readServiceKey } from '../../core/game/fieldwork'
import { formatNodeUnitsAsNode } from '../nodeFormat'

export function FieldworkPanel({ inspect }: { inspect(address: string): void }) {
  const state = useGameState(), actions = useGameActions()
  const [selected, setSelected] = useState<string>(), [feedback, setFeedback] = useState('')
  if (!state.fieldwork) return null
  const files = state.player.localDevice.filesystem.files
  const keys = files.flatMap(file => { const key = readServiceKey(file); return key ? [{ file, key }] : [] })
  const active = state.fieldwork.requests.filter(r => !r.delivered)
  return <section className="fieldwork" aria-label="Switchboard dispatches">
    <header><div><span className="ns-eyebrow">SWITCHBOARD · RECOVERY EXCHANGE</span><h2>Follow the files.</h2><p>Recover company documents. Keep the tools. Decide what to pursue next.</p></div><span className="fieldwork-balance">{formatNodeUnitsAsNode(state.nodeWallet.balanceNodeUnits)} NODE<small>{state.fieldwork.receipts.length} deliveries</small></span></header>
    {state.fieldwork.lastNotice && <p className="node-note node-note--caution" role="status">{state.fieldwork.lastNotice}</p>}
    <p className="fieldwork-caption">Client reports, not verified reconnaissance. New dispatches arrive as companies produce documents.</p>
    <div className="dispatch-list">{active.map(request => {
      const copy = files.find(f => f.kind === 'text' && recoveryDigest(f.content) === request.digest)
      return <article key={request.id} className={selected === request.id ? 'dispatch selected' : 'dispatch'}>
        <button className="dispatch-summary" onClick={() => setSelected(selected === request.id ? undefined : request.id)} aria-expanded={selected === request.id}><span><strong>{request.company}</strong><small>{request.title}</small></span><span>{formatNodeUnitsAsNode(request.reward)} NODE<small>{copy ? 'READY TO DELIVER' : request.address}</small></span></button>
        {selected === request.id && <div className="dispatch-detail"><p>{request.brief}</p><p>Requested file <code>{request.filename}</code></p><div className="fieldwork-actions"><button className="node-action" onClick={() => inspect(request.address)}>INVESTIGATE {request.company.toUpperCase()}</button>{copy && <button className="node-action" onClick={() => { const result = actions.deliverRecovery(request.id, copy.id); setFeedback(result.status === 'paid' ? `Delivered ${request.filename} · +${formatNodeUnitsAsNode(request.reward)} NODE. The document remains in your Files.` : result.status) }}>DELIVER COPY</button>}</div></div>}
      </article>
    })}</div>
    {!active.length && <p>All current requests fulfilled. Explore software and remote machines while new dispatches arrive.</p>}
    {keys.length > 0 && <details className="fieldwork-keys"><summary>RECOVERED KEYS · {keys.length}</summary>{keys.map(({ file, key }) => <div className="fieldwork-key" key={file.id}><span>{file.path.split('/').pop()}<small>{key.address} · credentials can expire</small></span><button className="node-action" onClick={() => { const result = actions.authenticateServiceKey(file.id); setFeedback(result.status === 'access_established' ? `Key accepted at ${key.address}. Access established; connect from Known Space.` : 'Key rejected. The endpoint or credential may have changed; recover a fresh copy.'); if (result.status === 'access_established') inspect(key.address) }}>USE KEY</button></div>)}</details>}
    {feedback && <output role="status">{feedback}</output>}
  </section>
}

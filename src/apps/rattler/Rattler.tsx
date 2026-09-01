import { useState } from 'react'
import { useGameActions } from '../../app/GameContext'

export function Rattler() {
  const { createRattlerPayload } = useGameActions()
  const [target, setTarget] = useState('')
  const [feedback, setFeedback] = useState<string>()

  function create() {
    const result = createRattlerPayload(target.trim())
    setFeedback(result.status === 'created' ? `CREATED · ${result.file.path}` : result.status.toUpperCase().replaceAll('_', ' '))
  }

  return <section className="app-content">
    <header className="node-masthead"><h1 className="node-masthead-subject">RATTLER</h1></header>
    <label className="node-field">
      <span>TARGET</span>
      <input className="node-input" aria-label="IP address" placeholder="IP ADDRESS" value={target} onChange={(event) => setTarget(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} />
    </label>
    <div className="file-kind-actions"><button className="node-action" type="button" onClick={create}>CREATE PAYLOAD</button></div>
    {feedback && <p className={feedback.startsWith('CREATED') ? 'node-note' : 'node-note node-note--caution'}>{feedback}</p>}
  </section>
}

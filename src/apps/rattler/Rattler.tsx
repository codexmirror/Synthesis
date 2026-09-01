import { useState } from 'react'
import { useGameActions } from '../../app/GameContext'

export function Rattler() {
  const { createRattlerPayload } = useGameActions()
  const [address, setAddress] = useState('')
  const [feedback, setFeedback] = useState<string>()
  function create() {
    if (!createRattlerPayload) return
    const result = createRattlerPayload(address)
    setFeedback(result.status === 'created' ? `CREATED · ${result.file.path}` : result.status === 'unknown_target' ? 'TARGET ADDRESS IS NOT KNOWN' : result.status === 'destination_exists' ? 'PAYLOAD DESTINATION ALREADY EXISTS' : 'RATTLER 1.0 IS NOT AVAILABLE')
  }
  return <section className="app-content">
    <header className="node-masthead"><h2 className="node-masthead-subject">RATTLER</h2></header>
    <label className="node-field"><span>TARGET</span><input className="node-input" aria-label="IP address" placeholder="IP ADDRESS" value={address} onChange={(event) => setAddress(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} /></label>
    <div className="file-kind-actions"><button className="node-action" type="button" onClick={create}>CREATE PAYLOAD</button></div>
    {feedback && <p className="node-note">{feedback}</p>}
  </section>
}

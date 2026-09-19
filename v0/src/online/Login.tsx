import { FormEvent, useState } from 'react'
import './login.css'

export function Login({ onEnter }: { onEnter(name: string, password: string): Promise<void> }) {
  const [name, setName] = useState(''); const [password, setPassword] = useState('')
  const [error, setError] = useState(''); const [pending, setPending] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setPending(true); setError(''); try { await onEnter(name, password) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to enter Synthesis.') } finally { setPending(false) } }
  return <main className="online-entry"><form className="online-entry__panel" onSubmit={submit}>
    <div className="online-entry__mark">SYNTHESIS</div>
    <label>NAME<input autoComplete="username" value={name} onChange={(event) => setName(event.target.value)} disabled={pending} /></label>
    <label>PASSWORD<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} /></label>
    {error && <p role="alert">{error}</p>}
    <button disabled={pending}>{pending ? 'ENTERING…' : 'ENTER SYNTHESIS'}</button>
  </form></main>
}

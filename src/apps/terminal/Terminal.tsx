import './terminal.css'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { OS_NAME } from '../../core/branding'
import { useGameState } from '../../app/GameContext'
import { dispatchCommand } from './commands'
import { parseCommand } from './parser'

interface Entry { command: string; output: string[] }

export function Terminal() {
  const gameState = useGameState()
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const output = outputRef.current; if (output) output.scrollTop = output.scrollHeight }, [entries])

  function submit(event: FormEvent) {
    event.preventDefault()
    const command = input.trim()
    if (!command) return
    const result = dispatchCommand(parseCommand(command), {
      player: { ip: gameState.player.ip },
      runtime: { ...gameState.system.runtime },
    })
    if (result.type === 'clear') setEntries([])
    else setEntries((current) => [...current, { command, output: result.lines }])
    const nextHistory = [...history, command]
    setHistory(nextHistory)
    setHistoryIndex(nextHistory.length)
    setInput('')
    inputRef.current?.focus({ preventScroll: true })
  }

  function navigateHistory(direction: -1 | 1) {
    const next = Math.max(0, Math.min(history.length, historyIndex + direction))
    setHistoryIndex(next)
    setInput(next === history.length ? '' : history[next])
  }

  return (
    <section className="terminal" aria-label="Terminal">
      <div
        className="terminal-output"
        aria-live="polite"
        data-editing-scroll-owner
        ref={outputRef}
      >
        <p className="muted">{OS_NAME} terminal · Type <strong>help</strong> to begin.</p>
        {entries.map((entry, index) => (
          <div className="terminal-entry" key={`${entry.command}-${index}`}>
            <div><span className="prompt">user@node:~$</span> {entry.command}</div>
            {entry.output.map((line, lineIndex) => <div key={lineIndex}>{line || '\u00a0'}</div>)}
          </div>
        ))}
      </div>
      <form className="terminal-input" onSubmit={submit}>
        <label className="prompt" htmlFor="command-input">user@node:~$</label>
        <input
          id="command-input"
          ref={inputRef}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') { event.preventDefault(); navigateHistory(-1) }
            if (event.key === 'ArrowDown') { event.preventDefault(); navigateHistory(1) }
          }}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          aria-label="Command input"
        />
      </form>
    </section>
  )
}

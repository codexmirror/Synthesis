import './terminal.css'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { OS_NAME } from '../../core/branding'
import { useGameActions, useGameState } from '../../app/GameContext'
import { dispatchCommand } from './registry'
import { parseCommand } from './parser'
import { inspectNetworkTarget } from '../../core/game/inspect'
import type { TerminalLine } from './commandTypes'
import { TargetToken } from './TargetToken'
import { deriveResourceUsage } from '../../core/game/processes'
import { resolveServiceEndpoint } from '../../core/game/serviceAnalysis'

interface Entry { command: string; output: TerminalLine[] }

function TerminalOutputLine({ line }: { line: TerminalLine }) {
  if (typeof line === 'string') return <>{line || '\u00a0'}</>
  return <>{line.map((fragment, index) => fragment.type === 'target'
    ? <TargetToken key={index} value={fragment.value} />
    : <span key={index}>{fragment.value}</span>)}</>
}

export function Terminal() {
  const gameState = useGameState()
  const actions = useGameActions()
  const usage = deriveResourceUsage(gameState.player.localDevice.hardware, gameState.player.localDevice.runtime, gameState.process)
  const [entries, setEntries] = useState<Entry[]>([])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const submitting = useRef(false)

  useEffect(() => { const output = outputRef.current; if (output) output.scrollTop = output.scrollHeight }, [entries])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    const command = input.trim()
    if (!command) return
    submitting.current = true
    setInput('')
    setHistory((current) => {
      const next = [...current, command]
      setHistoryIndex(next.length)
      return next
    })
    inputRef.current?.focus({ preventScroll: true })
    try {
    const result = await dispatchCommand(parseCommand(command), {
      localDevice: { ip: gameState.player.localDevice.network.ip },
      runtime: { cpuLoad: Math.round(usage.totalCpuLoad), ramUsage: Math.round(usage.totalRamUsage), networkStatus: gameState.player.localDevice.runtime.networkStatus },
      operations: {
        scanTarget: actions.scanTarget,
        inspectTarget: (target) => inspectNetworkTarget({
          localDevice: gameState.player.localDevice,
          network: gameState.world.network,
        }, target),
        analyzeEndpoint: (endpoint) => {
          const resolved = resolveServiceEndpoint(gameState, endpoint)
          if (resolved === 'invalid') return 'invalid_endpoint'
          if (!resolved) return 'endpoint_not_found'
          return actions.startServiceAnalysis(resolved.targetDeviceId, resolved.serviceId).status
        },
        knownWeaknesses: (targetDeviceId, serviceId) => gameState.knowledge.discoveredVulnerabilities
          .filter((known) => known.targetDeviceId === targetDeviceId && known.serviceId === serviceId)
          .map((known) => known.observedLabel),
      },
    })
    if (result.type === 'clear') setEntries([])
    else setEntries((current) => [...current, { command, output: result.lines }])
    } catch {
      setEntries((current) => [...current, { command, output: ['COMMAND FAILED'] }])
    } finally {
      submitting.current = false
    }
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
            {entry.output.map((line, lineIndex) => <div key={lineIndex}><TerminalOutputLine line={line} /></div>)}
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

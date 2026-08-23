import './terminal.css'
import { useEffect, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { useTerminalInteraction } from './useTerminalInteraction'
import { dispatchNodeCommand } from './nodeCommandAdapter'
import type { TerminalLine } from './commandTypes'
import type { GameProcess } from '../../core/game/types'
import { TargetToken } from './TargetToken'
import { deriveResourceUsage } from '../../core/game/processes'

type CompletedProjection =
  | { kind: 'service_analysis'; label: string; endpoint: string; result: 'weaknesses_detected'; vulnerabilityLabels: readonly string[] }
  | { kind: 'service_analysis'; label: string; endpoint: string; result: 'no_weakness_detected' | 'service_unavailable' }
  | { kind: 'credential_access'; label: string; endpoint: string; result: 'access_established'; privilege?: 'USER' }
  | { kind: 'credential_access'; label: string; endpoint: string; result: 'attempt_failed'; message: string }

type Entry =
  | { command: string; output: TerminalLine[] }
  | { command: string; processId: string; completed?: CompletedProjection }
  | { command: string; pendingScanTarget: string }

function TerminalOutputLine({ line }: { line: TerminalLine }) {
  if (typeof line === 'string') return <>{line || '\u00a0'}</>
  return <>{line.map((fragment, index) => fragment.type === 'target'
    ? <TargetToken key={index} value={fragment.value} scope={fragment.scope} />
    : <span key={index}>{fragment.value}</span>)}</>
}

function PendingScanProjection({ target }: { target: string }) {
  return (
    <div
      className="scan-pending"
      role="status"
      aria-label={`Scanning ${target}`}
    >
      <strong>SCANNING</strong>
      <div>
        {target}
        <span className="scan-pending-cursor" aria-hidden="true">▌</span>
      </div>
    </div>
  )
}

function CompletedProcessProjection({ completed }: { completed: CompletedProjection }) {
  return <section className="process-projection" aria-label={`${completed.label} completed`}>
    <strong>{completed.label}</strong>
    <div><TargetToken value={completed.endpoint} scope="external" /></div>
    <div className="process-state">COMPLETED</div>
    {completed.kind === 'service_analysis' ? <>
      {completed.result === 'weaknesses_detected' && <><strong>WEAKNESS DETECTED</strong>{completed.vulnerabilityLabels.map((label, index) => <div key={index}>{label}</div>)}<div className="known-interaction">Known interaction<br />attack <TargetToken value={completed.endpoint} scope="external" /></div></>}
      {completed.result === 'no_weakness_detected' && <strong>NO WEAKNESS DETECTED</strong>}
      {completed.result === 'service_unavailable' && <strong>SERVICE UNAVAILABLE</strong>}
    </> : <>
      {completed.result === 'access_established' && <><strong>ACCESS ESTABLISHED</strong>{completed.privilege && <div>{completed.privilege}</div>}</>}
      {completed.result === 'attempt_failed' && <><strong>ATTEMPT FAILED</strong><div>{completed.message}</div></>}
    </>}
  </section>
}

function ProcessProjection({ process, gameState, cpu }: { process?: GameProcess; gameState: ReturnType<typeof useGameState>; cpu: number }) {
  if (!process || process.kind === 'generic') return <div className="process-projection"><strong>PROCESS UNAVAILABLE</strong></div>
  const progress = Math.min(100, Math.floor(process.workCompleted / process.workRequired * 100))
  const filled = Math.round(progress / 10)
  const accessId = process.kind === 'credential_access' && process.result?.status === 'access_established' ? process.result.accessId : undefined
  const access = accessId ? gameState.deviceAccess.established.find(({ id }) => id === accessId) : undefined
  return <section className="process-projection" aria-label={`${process.label} ${process.status}`}>
    <strong>{process.label}</strong>
    <div><TargetToken value={process.startedEndpoint} scope="external" /></div>
    {process.kind === 'credential_access' && process.status === 'running' && <div className="muted">Basic Credential Toolkit</div>}
    <div className="process-state">{process.status.toUpperCase()}</div>
    {process.status === 'running' ? <>
      <div aria-label={`${progress}% complete`}><span aria-hidden="true">{'█'.repeat(filled)}{'░'.repeat(10 - filled)}</span> {progress}%</div>
      <div className="process-resources">CPU {Math.round(cpu)}% <span>RAM {process.ramRequiredMiB} MiB</span></div>
    </> : process.kind === 'service_analysis' ? <>
      {process.result?.status === 'weaknesses_detected' && <><strong>WEAKNESS DETECTED</strong>{process.result.vulnerabilities.map((item) => <div key={item.vulnerabilityId}>{item.observedLabel}</div>)}<div className="known-interaction">Known interaction<br />attack <TargetToken value={process.startedEndpoint} scope="external" /></div></>}
      {process.result?.status === 'no_weakness_detected' && <strong>NO WEAKNESS DETECTED</strong>}
      {process.result?.status === 'service_unavailable' && <strong>SERVICE UNAVAILABLE</strong>}
    </> : <>
      {process.result?.status === 'access_established' && <><strong>ACCESS ESTABLISHED</strong>{access && <div>{access.privilege}</div>}</>}
      {process.result?.status === 'attempt_failed' && <><strong>ATTEMPT FAILED</strong><div>{process.result.message}</div></>}
    </>}
  </section>
}

export function Terminal() {
  const gameState = useGameState()
  const actions = useGameActions()
  const usage = deriveResourceUsage(gameState.player.localDevice, gameState.process)
  const [entries, setEntries] = useState<Entry[]>([])

  useEffect(() => {
    setEntries((current) => {
      let changed = false
      const next = current.map((entry): Entry => {
        if (!('processId' in entry) || entry.completed) return entry
        const process = gameState.process.processes.find(({ id }) => id === entry.processId)
        if (!process || process.kind === 'generic' || process.status !== 'completed' || !process.result) return entry
        let completed: CompletedProjection
        if (process.kind === 'service_analysis') {
          completed = process.result.status === 'weaknesses_detected'
            ? { kind: process.kind, label: process.label, endpoint: process.startedEndpoint, result: process.result.status, vulnerabilityLabels: process.result.vulnerabilities.map(({ observedLabel }) => observedLabel) }
            : { kind: process.kind, label: process.label, endpoint: process.startedEndpoint, result: process.result.status }
        } else if (process.result.status === 'access_established') {
          const accessId = process.result.accessId
          const privilege = gameState.deviceAccess.established.find(({ id }) => id === accessId)?.privilege
          completed = { kind: process.kind, label: process.label, endpoint: process.startedEndpoint, result: process.result.status, privilege }
        } else {
          completed = { kind: process.kind, label: process.label, endpoint: process.startedEndpoint, result: process.result.status, message: process.result.message }
        }
        changed = true
        return { ...entry, completed }
      })
      return changed ? next : current
    })
  }, [gameState.process.processes, gameState.deviceAccess.established])

  async function dispatchTerminalCommand(command: string) {
    try {
      const { parsedCommand, dispatched } = dispatchNodeCommand(command, gameState, actions, usage)

      const pendingScan =
        parsedCommand.name === 'scan' && dispatched instanceof Promise

      const pendingScanTarget = pendingScan
        ? parsedCommand.args[0] ?? ''
        : ''

      if (pendingScan) {
        setEntries((current) => [
          ...current,
          { command, pendingScanTarget },
        ])
      }

      const result = await dispatched

      const commitEntry = (nextEntry: Entry) => {
        setEntries((current) => {
          if (!pendingScan) return [...current, nextEntry]

          return current.map((entry) =>
            'pendingScanTarget' in entry && entry.command === command
              ? nextEntry
              : entry,
          )
        })
      }

      if (result.type === 'clear') {
        setEntries([])
      } else if (result.type === 'process') {
        commitEntry({ command, processId: result.processId })
      } else {
        commitEntry({ command, output: result.lines })
      }
    } catch {
      const failure: Entry = {
        command,
        output: ['COMMAND FAILED'],
      }

      setEntries((current) => {
        const pendingIndex = current.findIndex(
          (entry) =>
            'pendingScanTarget' in entry &&
            entry.command === command,
        )

        if (pendingIndex === -1) {
          return [...current, failure]
        }

        return current.map((entry, index) =>
          index === pendingIndex ? failure : entry,
        )
      })
    }
  }

  const interaction = useTerminalInteraction(
    dispatchTerminalCommand,
    entries,
    gameState.process.processes,
  )

  return (
    <section className="terminal" aria-label="Terminal">
      <header className="node-masthead terminal-masthead">
        <span className="node-masthead-subject">{gameState.player.localDevice.displayName} · {gameState.player.localDevice.network.ip}</span>
        <span className="node-masthead-meta">LOCAL SHELL</span>
      </header>
      <div
        className="terminal-output"
        data-editing-scroll-owner
        ref={interaction.outputRef}
        onScroll={interaction.onOutputScroll}
      >
        <p className="muted">Type <strong>help</strong> to begin.</p>
        {entries.map((entry, index) => (
          <div className="terminal-entry" key={`${entry.command}-${index}`}>
            <div><span className="prompt">user@node:~$</span> {entry.command}</div>
           {'pendingScanTarget' in entry
  ? <PendingScanProjection target={entry.pendingScanTarget} />
  : 'processId' in entry
    ? entry.completed
      ? <CompletedProcessProjection completed={entry.completed} />
      : <ProcessProjection
          process={gameState.process.processes.find(
            ({ id }) => id === entry.processId,
          )}
          gameState={gameState}
          cpu={usage.cpuAllocationByProcess[entry.processId] ?? 0}
        />
    : entry.output.map((line, lineIndex) => (
        <div key={lineIndex}>
          <TerminalOutputLine line={line} />
        </div>
      ))}
          </div>
        ))}
      </div>
<form className="terminal-input" onSubmit={interaction.submit}>
  <label className="prompt" htmlFor="command-input">user@node:~$</label>
  <input
          id="command-input"
          ref={interaction.inputRef}
          value={interaction.input}
          onChange={(event) => interaction.setInput(event.target.value)}
          onKeyDown={interaction.onKeyDown}
          onCompositionStart={interaction.onCompositionStart}
          onCompositionEnd={interaction.onCompositionEnd}
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

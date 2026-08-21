import './rackos.css'
import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import { getFilesystemFile, listDirectory, sameFilesystemArtifactIgnoringPath } from '../../core/game/filesystem'
import { deriveDownloadDestinationPath } from '../../core/game/remoteDownload'
import { runRemoteCommand } from './remoteCommands'
import { useTerminalInteraction } from '../terminalInteraction/useTerminalInteraction'
import { TerminalInteractionFrame } from '../terminalInteraction/TerminalInteractionFrame'

type Section = 'terminal' | 'files' | 'system'

export function RackOS({ context }: { context: ActiveRemoteTarget }) {
  const { disconnectRemoteSession, downloadRemoteFile } = useGameActions()
  const [section, setSection] = useState<Section>('terminal')
  const { target, access, service } = context
  return <section className="rack-os" aria-label={`${target.firmware!.name} remote operating environment`}>
    <header className="rack-header">
      <div><strong>{target.firmware!.name} {target.firmware!.version}</strong><span>REMOTE</span></div>
      <div><span>{target.displayName} · {target.ip}</span><span>{access.privilege}</span></div>
      <button type="button" onClick={() => disconnectRemoteSession()}>DISCONNECT</button>
    </header>
    <nav className="rack-nav" aria-label={`${target.firmware!.name} sections`}>
      {(['terminal', 'files', 'system'] as const).map((item) => <button key={item} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}>{item.toUpperCase()}</button>)}
    </nav>
    <main className="rack-body">
      {section === 'terminal' && <RemoteTerminal context={context} onDisconnect={() => disconnectRemoteSession()} downloadRemoteFile={downloadRemoteFile} />}
      {section === 'files' && <RemoteFiles filesystem={target.filesystem!} downloadRemoteFile={downloadRemoteFile} />}
      {section === 'system' && <dl className="rack-system">
        <div><dt>DEVICE</dt><dd>{target.displayName}</dd></div><div><dt>ADDRESS</dt><dd>{target.ip}</dd></div>
        <div><dt>FIRMWARE</dt><dd>{target.firmware!.name} {target.firmware!.version}</dd></div>{target.role && <div><dt>ROLE</dt><dd>{target.role.toUpperCase()}</dd></div>}
        <div><dt>SESSION AUTHORITY</dt><dd>{access.privilege}</dd></div><div><dt>ACCESS PATH</dt><dd>{service.name}</dd></div>
      </dl>}
    </main>
  </section>
}

function RemoteTerminal({ context, onDisconnect, downloadRemoteFile }: { context: ActiveRemoteTarget; onDisconnect(): void; downloadRemoteFile: ReturnType<typeof useGameActions>['downloadRemoteFile'] }) {
  const [lines, setLines] = useState<readonly { command: string; output: readonly string[] }[]>([])
  const interaction = useTerminalInteraction({
    outputVersion: lines,
    onDispatchFailure: (command) => setLines((current) => [...current, { command, output: ['COMMAND FAILED'] }]),
    dispatch: (command) => {
      const result = runRemoteCommand(context, command, downloadRemoteFile)
      if (result.clear) setLines([]); else setLines((current) => [...current, { command, output: result.output }])
      if (result.disconnect) onDisconnect()
    },
  })
  return <TerminalInteractionFrame interaction={interaction} className="rack-terminal" outputClassName="rack-output" formClassName="rack-terminal-form" promptClassName="rack-terminal-prompt" ariaLabel="Remote Terminal" inputAriaLabel="Remote command" prompt={<span>{context.target.displayName} [{context.access.privilege}] &gt;</span>}>{lines.map((line, index) => <div key={index}><div className="rack-command">{context.target.displayName} [{context.access.privilege}] &gt; {line.command}</div>{line.output.map((value, outputIndex) => <div key={outputIndex}>{value}</div>)}</div>)}</TerminalInteractionFrame>
}

function RemoteFiles({ filesystem, downloadRemoteFile }: { filesystem: ActiveRemoteTarget['target']['filesystem']; downloadRemoteFile: ReturnType<typeof useGameActions>['downloadRemoteFile'] }) {
  const localFilesystem = useGameState().player.localDevice.filesystem
  const [path, setPath] = useState('/'); const [selected, setSelected] = useState<string>()
  const [feedback, setFeedback] = useState<string>()
  const listing = listDirectory(filesystem!, path); const result = selected ? getFilesystemFile(filesystem!, selected) : undefined
  const destinationPath = result?.status === 'ok' ? deriveDownloadDestinationPath(result.file.path) : undefined
  const localResult = destinationPath ? getFilesystemFile(localFilesystem, destinationPath) : undefined
  const downloadState = result?.status !== 'ok' || !localResult
    ? undefined
    : localResult.status === 'not_found'
      ? 'available'
      : localResult.status === 'ok' && sameFilesystemArtifactIgnoringPath(result.file, localResult.file)
        ? 'downloaded'
        : 'occupied'
  function download() {
    if (!selected) return
    const downloadResult = downloadRemoteFile(selected)
    setFeedback(downloadResult.status === 'downloaded' ? undefined : downloadResult.status === 'destination_exists' ? 'DESTINATION ALREADY EXISTS' : downloadResult.status.toUpperCase().replaceAll('_', ' '))
  }
  if (selected) return <section className="rack-files">
    <p>FILES</p>
    <code>{selected}</code>
    <button onClick={() => { setSelected(undefined); setFeedback(undefined) }}>← {path}</button>
    {result?.status === 'ok' && <>
      {result.file.kind === 'text'
        ? <pre>{result.file.content}</pre>
        : <div><p>SOFTWARE PACKAGE</p><h2>{result.file.name}</h2><p>{result.file.version} {titleCase(result.file.channel)}</p><dl><dt>RELEASE</dt><dd>{result.file.releaseId}</dd><dt>PATH</dt><dd>{result.file.path}</dd></dl></div>}
      {downloadState === 'available' && <button onClick={download}>DOWNLOAD</button>}
      {downloadState === 'downloaded' && <div className="rack-download-state" role="status">
        <button disabled>DOWNLOADED ✓</button>
        <dl><dt>LOCAL COPY</dt><dd>{destinationPath}</dd></dl>
      </div>}
      {downloadState === 'occupied' && <div className="rack-download-state" role="status">
        <strong>LOCAL DESTINATION OCCUPIED</strong>
        <code>{destinationPath}</code>
      </div>}
      {feedback && <output role="status">{feedback}</output>}
    </>}
  </section>
  return <section className="rack-files"><p>FILES</p><code>{path}</code>{path !== '/' && <button onClick={() => setPath('/')}>../</button>}{listing.status === 'ok' && listing.entries.map((entry) => <button key={entry.name} onClick={() => entry.type === 'directory' ? setPath(`${path === '/' ? '' : path}/${entry.name}`) : setSelected(`${path === '/' ? '' : path}/${entry.name}`)}>{entry.type === 'directory' ? 'DIR ' : 'FILE '}{entry.name}</button>)}</section>
}

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }

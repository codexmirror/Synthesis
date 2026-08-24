import './rackos.css'
import { type FormEvent, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import { getFilesystemFile, listDirectory, sameFilesystemArtifactIgnoringPath } from '../../core/game/filesystem'
import { deriveDownloadDestinationPath } from '../../core/game/fileTransfer'
import type { AuthenticationHistoryRecord } from '../../core/game/types'
import { runRemoteCommand } from './remoteCommands'

type Section = 'terminal' | 'files' | 'system'

export function RackOS({ context, hidden, onReturnLocal }: { context: ActiveRemoteTarget; hidden: boolean; onReturnLocal(): void }) {
  const { disconnectRemoteSession, startRemoteFileDownload, startRemoteFileUpload } = useGameActions()
  const [section, setSection] = useState<Section>('terminal')
  const { target, access, service } = context
  return <section className="rack-os" hidden={hidden} aria-label={`${target.firmware!.name} remote operating environment`}>
    <header className="rack-header">
      <div><strong>{target.firmware!.name} {target.firmware!.version}</strong><span>REMOTE</span></div>
      <div><span>{target.displayName} · {target.ip}</span><span>{access.privilege}</span></div>
      <div className="rack-header__actions"><button type="button" onClick={onReturnLocal}>LOCAL · NODE-OS</button><button type="button" onClick={() => disconnectRemoteSession()}>DISCONNECT</button></div>
    </header>
    <nav className="rack-nav" aria-label={`${target.firmware!.name} sections`}>
      {(['terminal', 'files', 'system'] as const).map((item) => <button key={item} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}>{item.toUpperCase()}</button>)}
    </nav>
    <main className="rack-body">
      {section === 'terminal' && <RemoteTerminal context={context} onDisconnect={() => disconnectRemoteSession()} startRemoteFileDownload={startRemoteFileDownload} startRemoteFileUpload={startRemoteFileUpload} />}
      {section === 'files' && <RemoteFiles targetDeviceId={target.id} filesystem={target.filesystem!} startRemoteFileDownload={startRemoteFileDownload} />}
      {section === 'system' && <section className="rack-panel">
        <dl className="rack-facts">
          <div><dt>DEVICE</dt><dd>{target.displayName}</dd></div><div><dt>ADDRESS</dt><dd>{target.ip}</dd></div>
          <div><dt>FIRMWARE</dt><dd>{target.firmware!.name} {target.firmware!.version}</dd></div>{target.role && <div><dt>ROLE</dt><dd>{target.role.toUpperCase()}</dd></div>}
          <div><dt>SESSION AUTHORITY</dt><dd>{access.privilege}</dd></div><div><dt>ACCESS PATH</dt><dd>{service.name}</dd></div>
        </dl>
        <AuthenticationHistory records={target.authenticationHistory?.records ?? []} />
      </section>}
    </main>
  </section>
}

function RemoteTerminal({ context, onDisconnect, startRemoteFileDownload, startRemoteFileUpload }: { context: ActiveRemoteTarget; onDisconnect(): void; startRemoteFileDownload: ReturnType<typeof useGameActions>['startRemoteFileDownload']; startRemoteFileUpload: ReturnType<typeof useGameActions>['startRemoteFileUpload'] }) {
  const [input, setInput] = useState('')
  const [lines, setLines] = useState<readonly { command: string; output: readonly string[] }[]>([])
  function submit(event: FormEvent) {
    event.preventDefault(); const command = input.trim(); if (!command) return
    const result = runRemoteCommand(context, command, startRemoteFileDownload, startRemoteFileUpload); setInput('')
    if (result.clear) setLines([]); else setLines((current) => [...current, { command, output: result.output }])
    if (result.disconnect) onDisconnect()
  }
  return <div className="rack-terminal"><div className="rack-output" aria-live="polite" data-editing-scroll-owner>{lines.map((line, index) => <div key={index}><div className="rack-command">{context.target.displayName} [{context.access.privilege}] &gt; {line.command}</div>{line.output.map((value, outputIndex) => <div key={outputIndex}>{value}</div>)}</div>)}</div><form onSubmit={submit}><label><span>{context.target.displayName} [{context.access.privilege}] &gt;</span><input aria-label="Remote command" autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="send" value={input} onChange={(event) => setInput(event.target.value)} /></label></form></div>
}

function RemoteFiles({ targetDeviceId, filesystem, startRemoteFileDownload }: { targetDeviceId: string; filesystem: ActiveRemoteTarget['target']['filesystem']; startRemoteFileDownload: ReturnType<typeof useGameActions>['startRemoteFileDownload'] }) {
  const state = useGameState()
  const localFilesystem = state.player.localDevice.filesystem
  const [path, setPath] = useState('/'); const [selected, setSelected] = useState<string>()
  const [feedback, setFeedback] = useState<string>()
  const listing = listDirectory(filesystem!, path); const result = selected ? getFilesystemFile(filesystem!, selected) : undefined
  const destinationPath = result?.status === 'ok' ? deriveDownloadDestinationPath(result.file.path) : undefined
  const localResult = destinationPath ? getFilesystemFile(localFilesystem, destinationPath) : undefined
  const activeTransfer = state.fileTransfer.active
  const transferMatchesSelected = result?.status === 'ok' && activeTransfer?.sourceDeviceId === targetDeviceId && activeTransfer?.sourceFileId === result.file.id
  const downloadState = result?.status !== 'ok' || !localResult
    ? undefined
    : transferMatchesSelected
      ? 'in_progress'
      : localResult.status === 'not_found'
        ? 'available'
        : localResult.status === 'ok' && sameFilesystemArtifactIgnoringPath(result.file, localResult.file)
          ? 'downloaded'
          : 'occupied'
  function download() {
    if (!selected) return
    const startResult = startRemoteFileDownload(selected)
    setFeedback(startResult.status === 'started' ? undefined : startResult.status === 'destination_exists' ? 'DESTINATION ALREADY EXISTS' : startResult.status.toUpperCase().replaceAll('_', ' '))
  }
  if (selected) return <section className="rack-panel rack-files">
    <div className="rack-path"><span>PATH</span><code>{selected}</code></div>
    <button className="rack-back" onClick={() => { setSelected(undefined); setFeedback(undefined) }}>← {path}</button>
    {result?.status === 'ok' ? <>
      {result.file.kind === 'text'
        ? <pre className="rack-file-content">{result.file.content}</pre>
        : result.file.kind === 'software_package'
          ? <div className="rack-artifact"><p className="rack-artifact-kind">SOFTWARE PACKAGE</p><h2>{result.file.name}</h2><p className="rack-artifact-release">{result.file.version} {titleCase(result.file.channel)}</p><dl className="rack-facts"><div><dt>RELEASE</dt><dd>{result.file.releaseId}</dd></div></dl></div>
          : <div className="rack-artifact"><p className="rack-artifact-kind">EXECUTABLE</p><h2>{result.file.name}</h2><p className="rack-artifact-release">{result.file.version}</p><dl className="rack-facts"><div><dt>RELEASE</dt><dd>{result.file.releaseId}</dd></div></dl></div>}
      {downloadState === 'available' && <button className="rack-primary" onClick={download}>DOWNLOAD</button>}
      {downloadState === 'in_progress' && <div className="rack-download-state" role="status">
        <button className="rack-primary" disabled>DOWNLOAD STARTED</button>
      </div>}
      {downloadState === 'downloaded' && <div className="rack-download-state" role="status">
        <button className="rack-primary" disabled>DOWNLOADED ✓</button>
        <dl className="rack-facts"><div><dt>LOCAL COPY</dt><dd>{destinationPath}</dd></div></dl>
      </div>}
      {downloadState === 'occupied' && <div className="rack-download-state" role="status">
        <strong>LOCAL DESTINATION OCCUPIED</strong>
        <code>{destinationPath}</code>
      </div>}
      {feedback && <output role="status">{feedback}</output>}
    </> : <p className="rack-empty">FILE NOT FOUND</p>}
  </section>

  return <section className="rack-panel rack-files">
    <div className="rack-path"><span>PATH</span><code>{path}</code></div>
    {listing.status === 'ok' ? <div className="rack-file-list">
      {path !== '/' && <button className="rack-file-row" onClick={() => setPath(parentPath(path))}>
        <span className="rack-file-tag">DIR</span>{' '}<span className="rack-file-name">../</span>
      </button>}
      {listing.entries.map((entry) => <button className="rack-file-row" key={entry.name} onClick={() => entry.type === 'directory' ? setPath(joinPath(path, entry.name)) : setSelected(joinPath(path, entry.name))}>
        <span className="rack-file-tag">{entry.type === 'directory' ? 'DIR' : 'FILE'}</span>{' '}<span className="rack-file-name">{entry.name}</span>
      </button>)}
      {listing.entries.length === 0 && <p className="rack-empty">EMPTY DIRECTORY</p>}
    </div> : <p className="rack-empty">DIRECTORY NOT FOUND</p>}
  </section>
}

/** Compact read-only projection of the target Device's own authentication history; never exposes internal Device/Service IDs. */
function AuthenticationHistory({ records }: { records: readonly AuthenticationHistoryRecord[] }) {
  return <div className="rack-history">
    <span className="rack-history-label">AUTHENTICATION HISTORY</span>
    {records.length > 0
      ? <div className="rack-history-list">{records.map((record) => <div className="rack-history-row" key={record.id}>
          <strong>{record.serviceName}</strong>
          <span>SOURCE {record.sourceAddress}</span>
          <span>{record.result}</span>
        </div>)}</div>
      : <p className="rack-empty">NO AUTHENTICATION HISTORY</p>}
  </div>
}

function joinPath(path: string, name: string) { return `${path === '/' ? '' : path}/${name}` }
function parentPath(path: string) { return path.slice(0, path.lastIndexOf('/')) || '/' }

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }

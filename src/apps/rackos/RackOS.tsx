import './rackos.css'
import { type FormEvent, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import { getFilesystemFile, getFilesystemFileSizeBytes, listDirectory, sameFilesystemArtifactIgnoringPath } from '../../core/game/filesystem'
import { deriveDownloadDestinationPath } from '../../core/game/fileTransfer'
import { isRecognizedSoftwarePackagePath, representsInstallableSoftwareState } from '../../core/game/softwareInstallation'
import type { AuthenticationHistoryRecord, FilesystemFile, FilesystemState, InstalledSoftware, SoftwareInstallationProcess, SoftwarePackageFile } from '../../core/game/types'
import { formatBytes } from '../byteFormat'
import { describeInstallFailure } from '../installFailure'
import { describeUploadFailure } from '../uploadFailure'
import { runRemoteCommand } from './remoteCommands'

type Section = 'terminal' | 'files' | 'system'

/** Where the local source picker opens; the player's own working directory. */
const LOCAL_SOURCE_ROOT = '/home/user'

export function RackOS({ context, hidden, onReturnLocal }: { context: ActiveRemoteTarget; hidden: boolean; onReturnLocal(): void }) {
  const { disconnectRemoteSession, startRemoteFileDownload, startRemoteFileUpload, installRemoteSoftwarePackage } = useGameActions()
  const [section, setSection] = useState<Section>('terminal')
  const { target, access, service } = context
  return <section className="rack-os" hidden={hidden} aria-label={`${target.firmware!.name} remote operating environment`}>
    <header className="rack-header">
      <div><strong>{target.firmware!.name} {target.firmware!.version}</strong><span>REMOTE</span></div>
      <div><span>{target.displayName} · {target.ip}</span><span>{access.privilege}</span></div>
      {/* Two deliberately different actions: the first only changes which
          operating environment is presented, the second ends the Session. */}
      <div className="rack-header__actions">
        <button type="button" className="rack-header__return" onClick={onReturnLocal} aria-label="Return to NODE-OS without disconnecting"><span aria-hidden="true">←</span> NODE-OS</button>
        <button type="button" className="rack-header__disconnect" onClick={() => disconnectRemoteSession()}>DISCONNECT</button>
      </div>
    </header>
    <nav className="rack-nav" aria-label={`${target.firmware!.name} sections`}>
      {(['terminal', 'files', 'system'] as const).map((item) => <button key={item} aria-current={section === item ? 'page' : undefined} onClick={() => setSection(item)}>{item.toUpperCase()}</button>)}
    </nav>
    <main className="rack-body">
      {section === 'terminal' && <RemoteTerminal context={context} onDisconnect={() => disconnectRemoteSession()} startRemoteFileDownload={startRemoteFileDownload} startRemoteFileUpload={startRemoteFileUpload} />}
      {section === 'files' && <RemoteFiles context={context} startRemoteFileDownload={startRemoteFileDownload} startRemoteFileUpload={startRemoteFileUpload} installRemoteSoftwarePackage={installRemoteSoftwarePackage} />}
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

function RemoteFiles({ context, startRemoteFileDownload, startRemoteFileUpload, installRemoteSoftwarePackage }: { context: ActiveRemoteTarget; startRemoteFileDownload: ReturnType<typeof useGameActions>['startRemoteFileDownload']; startRemoteFileUpload: ReturnType<typeof useGameActions>['startRemoteFileUpload']; installRemoteSoftwarePackage: ReturnType<typeof useGameActions>['installRemoteSoftwarePackage'] }) {
  const state = useGameState()
  const { id: targetDeviceId, ip: targetAddress, filesystem, displayName: targetDisplayName } = context.target
  const localFilesystem = state.player.localDevice.filesystem
  const [path, setPath] = useState('/'); const [selected, setSelected] = useState<string>()
  const [uploadDirectory, setUploadDirectory] = useState<string>()
  const [acknowledgement, setAcknowledgement] = useState<string>()
  const [feedback, setFeedback] = useState<string>()
  const listing = listDirectory(filesystem!, path); const result = selected ? getFilesystemFile(filesystem!, selected) : undefined
  const destinationPath = result?.status === 'ok' ? deriveDownloadDestinationPath(result.file.path) : undefined
  const localResult = destinationPath ? getFilesystemFile(localFilesystem, destinationPath) : undefined
  /* Installation state on the operated Device is derived from that Device's own
     canonical truth: its installed-software inventory plus the installation
     Processes its own executor identity is currently running. An absent
     inventory is never replaced with an empty one — whether this Device
     represents installable software state at all is the canonical operation's
     rule, so RACK-OS asks that same rule rather than restating it. */
  const targetInstallable = representsInstallableSoftwareState(context.target)
  const targetInstallingProductIds = new Set(state.process.processes
    .filter((process): process is SoftwareInstallationProcess => process.kind === 'software_installation')
    .filter((process) => process.status === 'running' && process.executorDeviceId === targetDeviceId)
    .map((process) => process.productId))
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

  /* The remote directory the player is standing in establishes the Upload
     destination context; the workflow never leaves RACK-OS to reach NODE-OS. */
  if (uploadDirectory !== undefined) return <RemoteUpload
    remoteDirectory={uploadDirectory}
    targetAddress={targetAddress}
    localFilesystem={localFilesystem}
    startRemoteFileUpload={startRemoteFileUpload}
    onCancel={() => setUploadDirectory(undefined)}
    onStarted={() => { setUploadDirectory(undefined); setAcknowledgement('UPLOAD STARTED') }}
  />

  if (selected) return <section className="rack-panel rack-files">
    <div className="rack-path"><span>PATH</span><code>{selected}</code></div>
    <button className="rack-back" onClick={() => { setSelected(undefined); setFeedback(undefined) }}>← {path}</button>
    {result?.status === 'ok' ? <>
      {result.file.kind === 'text'
        ? <pre className="rack-file-content">{result.file.content}</pre>
        : result.file.kind === 'software_package'
          ? <RemotePackage key={selected} file={result.file} targetDisplayName={targetDisplayName!} installedSoftware={context.target.installedSoftware} installable={targetInstallable} installingProductIds={targetInstallingProductIds} install={installRemoteSoftwarePackage} />
          : <div className="rack-artifact"><p className="rack-artifact-kind">EXECUTABLE</p><h2>{result.file.name}</h2><p className="rack-artifact-release">{result.file.version}</p><dl className="rack-facts"><div><dt>RELEASE</dt><dd>{result.file.releaseId}</dd></div></dl></div>}
      {/* Transfer is the artifact's relationship to node-01, so on a Device the
          player is operating it stays secondary to that Device's own software state. */}
      {result.file.kind === 'software_package' && <p className="rack-artifact-kind rack-transfer-label">TRANSFER</p>}
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
    <div className="rack-path">
      <span>PATH</span><code>{path}</code>
      <button className="rack-upload-entry" type="button" onClick={() => { setAcknowledgement(undefined); setUploadDirectory(path) }}>UPLOAD</button>
    </div>
    {acknowledgement && <output className="rack-upload-ack" role="status">{acknowledgement}</output>}
    {listing.status === 'ok' ? <div className="rack-file-list">
      {path !== '/' && <button className="rack-file-row" onClick={() => { setAcknowledgement(undefined); setPath(parentPath(path)) }}>
        <span className="rack-file-tag">DIR</span>{' '}<span className="rack-file-name">../</span>
      </button>}
      {listing.entries.map((entry) => <button className="rack-file-row" key={entry.name} onClick={() => { setAcknowledgement(undefined); if (entry.type === 'directory') setPath(joinPath(path, entry.name)); else setSelected(joinPath(path, entry.name)) }}>
        <span className="rack-file-tag">{entry.type === 'directory' ? 'DIR' : 'FILE'}</span>{' '}<span className="rack-file-name">{entry.name}</span>
      </button>)}
      {listing.entries.length === 0 && <p className="rack-empty">EMPTY DIRECTORY</p>}
    </div> : <p className="rack-empty">DIRECTORY NOT FOUND</p>}
  </section>
}

type RemotePackageState = 'INSTALLABLE' | 'INSTALLING' | 'INSTALLED' | 'UNRECOGNIZED' | 'NOT INSTALLABLE'

/**
 * The software-package surface of the Device the player is currently
 * operating. Its questions are what this package is, what its state is *on
 * this Device*, and what can be done here — so the package's relationship to
 * node-01 is no longer the pane's subject.
 *
 * It owns exactly one piece of transient presentation state: whether the
 * inline confirmation is open. Opening it changes no GameState, CANCEL
 * changes no GameState, and confirming forwards the exact selected remote
 * package path to the canonical `installRemoteSoftwarePackage` operation,
 * which remains the sole authority over whether installation may start. No
 * admission rule is duplicated here, and no installed/installing lifecycle
 * flag is kept: every state below is derived from canonical truth.
 */
function RemotePackage({ file, targetDisplayName, installedSoftware, installable, installingProductIds, install }: {
  file: SoftwarePackageFile
  targetDisplayName: string
  installedSoftware: readonly InstalledSoftware[] | undefined
  installable: boolean
  installingProductIds: ReadonlySet<string>
  install: ReturnType<typeof useGameActions>['installRemoteSoftwarePackage']
}) {
  const [confirming, setConfirming] = useState(false)
  const [feedback, setFeedback] = useState<string>()
  const current = installedSoftware?.find(({ id }) => id === file.productId)
  /* Absent, not empty: a Device representing no inventory has no installed
     release to state, so the row is omitted rather than claiming NOT INSTALLED. */
  const currentLabel = installedSoftware === undefined ? undefined : current ? describeInstalledRelease(current) : 'NOT INSTALLED'
  const packageState = deriveRemotePackageState(file, installedSoftware, installable, installingProductIds)

  function confirm() {
    const result = install(file.path)
    if (result.status === 'started') { setConfirming(false); setFeedback(undefined); return }
    setFeedback(describeInstallFailure(result))
  }

  /* Identity, this Device's state, and the one action come first so the action
     stays reachable inside the narrowest represented viewport; the artifact's
     own descriptive facts follow it, and its relationship to node-01 follows
     those. */
  return <div className="rack-artifact">
    <p className="rack-artifact-kind">SOFTWARE PACKAGE</p>
    <h2>{file.name}</h2>
    <p className="rack-artifact-release">{file.version} {titleCase(file.channel)}</p>
    {confirming
      ? <div className="rack-install-confirm">
          <p className="rack-artifact-kind">INSTALL ON THIS DEVICE</p>
          <dl className="rack-facts rack-facts--dense">
            <div><dt>TARGET</dt><dd>{targetDisplayName}</dd></div>
            <div><dt>PACKAGE</dt><dd>{file.path}</dd></div>
            <div><dt>CURRENT</dt><dd>{currentLabel}</dd></div>
          </dl>
          <div className="rack-install-actions">
            <button className="rack-secondary" type="button" onClick={() => { setConfirming(false); setFeedback(undefined) }}>CANCEL</button>
            <button className="rack-primary" type="button" onClick={confirm}>INSTALL</button>
          </div>
        </div>
      : <>
          <dl className="rack-facts rack-facts--dense">
            <div><dt>STATUS</dt><dd>{packageState}</dd></div>
            {currentLabel && <div><dt>CURRENT</dt><dd>{currentLabel}</dd></div>}
          </dl>
          {packageState === 'INSTALLABLE' && <button className="rack-primary" type="button" onClick={() => { setFeedback(undefined); setConfirming(true) }}>INSTALL</button>}
          {packageState === 'INSTALLING' && <button className="rack-primary" type="button" disabled>INSTALLING…</button>}
          {packageState === 'INSTALLED' && <button className="rack-primary" type="button" disabled>INSTALLED ✓</button>}
          {packageState === 'UNRECOGNIZED' && <p className="rack-install-note">UNRECOGNIZED PACKAGE EXTENSION</p>}
          {/* Same words the canonical admission failure uses, so the surface and the operation agree. */}
          {packageState === 'NOT INSTALLABLE' && <p className="rack-install-note">TARGET CANNOT INSTALL SOFTWARE</p>}
        </>}
    {feedback && <p className="rack-install-note rack-install-note--caution">{feedback}</p>}
    {/* The confirmation is one focused decision: it keeps the package's identity
        and drops the descriptive facts, so both controls stay reachable on the
        narrowest represented viewport. */}
    {!confirming && <dl className="rack-facts rack-facts--dense">
      <div><dt>SIZE</dt><dd>{formatBytes(getFilesystemFileSizeBytes(file))}</dd></div>
      {file.publisher && <div><dt>PUBLISHER</dt><dd>{file.publisher}</dd></div>}
      <div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div>
    </dl>}
  </div>
}

/**
 * Package state on the operated Device, derived from canonical truth alone:
 * whether that Device represents installable software state at all, normal
 * package recognition of the artifact's current path, that Device's own
 * installed software, and that Device's own running installation Processes.
 *
 * The checks run in the order the canonical operation resolves them, so the
 * surface can never claim INSTALLABLE for something admission would reject: a
 * Device that represents no software inventory states that plainly rather than
 * being handed an empty one to stand in for it.
 *
 * Another release of the same product being installed here does not make this
 * package uninstallable — it stays INSTALLABLE as a replacement while CURRENT
 * states the concrete release that is installed now. Recognition never
 * rewrites the artifact: an unrecognized path only means normal installation
 * is unavailable from it, exactly as the canonical operation decides.
 */
function deriveRemotePackageState(file: SoftwarePackageFile, installedSoftware: readonly InstalledSoftware[] | undefined, installable: boolean, installingProductIds: ReadonlySet<string>): RemotePackageState {
  if (!installable || !installedSoftware) return 'NOT INSTALLABLE'
  if (!isRecognizedSoftwarePackagePath(file.path)) return 'UNRECOGNIZED'
  if (installedSoftware.find(({ id }) => id === file.productId)?.releaseId === file.releaseId) return 'INSTALLED'
  return installingProductIds.has(file.productId) ? 'INSTALLING' : 'INSTALLABLE'
}

function describeInstalledRelease(software: InstalledSoftware): string {
  return software.channel ? `${software.name} ${software.version} ${titleCase(software.channel)}` : `${software.name} ${software.version}`
}

/**
 * Remote-first Upload: pick a concrete file from the canonical local
 * filesystem, confirm one explicit absolute remote destination path, and hand
 * both to the shared `startRemoteFileUpload` operation exactly as shown. This
 * screen owns transient picker/destination/feedback presentation only; it
 * never copies files, never writes to a filesystem, and keeps no progress of
 * its own.
 */
function RemoteUpload({ remoteDirectory, targetAddress, localFilesystem, startRemoteFileUpload, onCancel, onStarted }: {
  remoteDirectory: string
  targetAddress: string
  localFilesystem: FilesystemState
  startRemoteFileUpload: ReturnType<typeof useGameActions>['startRemoteFileUpload']
  onCancel(): void
  onStarted(): void
}) {
  const [localPath, setLocalPath] = useState(LOCAL_SOURCE_ROOT)
  const [sourcePath, setSourcePath] = useState<string>()
  const [destination, setDestination] = useState('')
  const [feedback, setFeedback] = useState<string>()
  const source = sourcePath ? getFilesystemFile(localFilesystem, sourcePath) : undefined
  const listing = listDirectory(localFilesystem, localPath)

  function selectSource(path: string) {
    setSourcePath(path)
    setDestination(joinPath(remoteDirectory, basename(path)))
    setFeedback(undefined)
  }

  function confirm() {
    if (source?.status !== 'ok') return
    const result = startRemoteFileUpload(source.file.path, destination)
    if (result.status === 'started') { onStarted(); return }
    setFeedback(describeUploadFailure(result.status))
  }

  if (source?.status === 'ok') return <section className="rack-panel rack-upload" aria-label="Upload to remote" data-editing-scroll-owner>
    <div className="rack-path"><span>UPLOAD TO</span><code>{targetAddress}</code></div>
    <button className="rack-back" type="button" onClick={() => { setSourcePath(undefined); setFeedback(undefined) }}>← LOCAL FILES</button>
    <dl className="rack-facts">
      <div><dt>LOCAL SOURCE</dt><dd>{basename(source.file.path)}</dd></div>
      <div><dt>SOURCE PATH</dt><dd>{source.file.path}</dd></div>
      <div><dt>SIZE</dt><dd>{formatBytes(getFilesystemFileSizeBytes(source.file))}</dd></div>
    </dl>
    <label className="rack-field">
      <span>DESTINATION</span>
      <input className="rack-input" aria-label="Remote destination path" value={destination} onChange={(event) => setDestination(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done" />
    </label>
    <div className="rack-upload-actions">
      <button className="rack-secondary" type="button" onClick={onCancel}>CANCEL</button>
      <button className="rack-primary" type="button" onClick={confirm}>UPLOAD</button>
    </div>
    {feedback && <output role="status">{feedback}</output>}
  </section>

  return <section className="rack-panel rack-upload" aria-label="Upload to remote">
    <div className="rack-path"><span>UPLOAD TO</span><code>{remoteDirectory}</code></div>
    <button className="rack-back" type="button" onClick={onCancel}>← CANCEL UPLOAD</button>
    <div className="rack-path"><span>LOCAL</span><code>{localPath}</code></div>
    {listing.status === 'ok' ? <div className="rack-file-list">
      {localPath !== '/' && <button className="rack-file-row" type="button" aria-label="Open parent local directory" onClick={() => setLocalPath(parentPath(localPath))}>
        <span className="rack-file-tag">DIR</span>{' '}<span className="rack-file-copy"><span className="rack-file-name">../</span></span>
      </button>}
      {listing.entries.map((entry) => {
        const entryPath = joinPath(localPath, entry.name)
        const entryFile = entry.type === 'file' ? getFilesystemFile(localFilesystem, entryPath) : undefined
        return <button className="rack-file-row" type="button" key={entry.name}
          aria-label={`${entry.type === 'directory' ? 'Open local directory' : 'Select local file'} ${entry.name}`}
          onClick={() => entry.type === 'directory' ? setLocalPath(entryPath) : selectSource(entryPath)}>
          <span className="rack-file-tag">{entry.type === 'directory' ? 'DIR' : 'FILE'}</span>{' '}
          <span className="rack-file-copy">
            <span className="rack-file-name">{entry.name}</span>
            {entryFile?.status === 'ok' && <span className="rack-file-meta">{typeLabel(entryFile.file)} · {formatBytes(getFilesystemFileSizeBytes(entryFile.file))}</span>}
          </span>
        </button>
      })}
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
function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }
function typeLabel(file: FilesystemFile) { return file.kind === 'text' ? 'TEXT' : file.kind === 'software_package' ? 'SOFTWARE PACKAGE' : 'EXECUTABLE' }

function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }

import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { getFilesystemFile, getFilesystemFileSizeBytes, listDirectory } from '../../core/game/filesystem'
import { findRunningLocalNodeMiner, NODE_MINER_PROGRAM_ID, NODE_MINER_RELEASE_ID, type StartNodeMinerResult } from '../../core/game/nodeMiner'
import { NODESCAN_1_0_STANDARD_RELEASE_ID } from '../../core/game/software'
import { isRecognizedSoftwarePackagePath, type InstallLocalSoftwarePackageResult } from '../../core/game/softwareInstallation'
import { formatByteProgress, formatBytes } from '../byteFormat'
import { formatNodeUnitsAsNode } from '../nodeFormat'
import { SoftwareReleaseCapabilities, SoftwareReleaseChanges, SoftwareReleaseDisclosure } from '../SoftwareReleaseDocumentation'
import { deriveFileTransferDirection, type StartRemoteFileUploadResult } from '../../core/game/fileTransfer'
import { describeUploadFailure } from '../uploadFailure'
import { describeInstallFailure } from '../installFailure'
import { resolveActiveRemoteTarget } from '../../core/game/remoteSession'
import type { ExecutableFile, FileTransfer, FilesystemFile, InstalledSoftware, LocalDeviceState, NodeMinerProcess, SoftwareInstallationProcess, SoftwareRemovalProcess, SoftwarePackageFile } from '../../core/game/types'

const INITIAL_PATH = '/home/user'

type PackageState = 'INSTALLED' | 'INSTALLABLE' | 'INSTALLING' | 'REMOVING' | 'PROTECTED' | 'UNRECOGNIZED'

export function Files() {
  const state = useGameState()
  const localDevice = state.player.localDevice
  const filesystem = localDevice.filesystem
  const actions = useGameActions()
  const [path, setPath] = useState(INITIAL_PATH)
  const [selectedFile, setSelectedFile] = useState<string>()
  /** Install Review is a temporary presentation substate of the selected package, never GameState. */
  const [reviewingInstall, setReviewingInstall] = useState(false)
  const listing = listDirectory(filesystem, path)
  const selected = selectedFile ? getFilesystemFile(filesystem, selectedFile) : undefined
  const remote = resolveActiveRemoteTarget(state)
  const activeUploadForSelectedFile = selected?.status === 'ok' && state.fileTransfer.active
    && deriveFileTransferDirection(localDevice.id, state.fileTransfer.active) === 'upload'
    && state.fileTransfer.active.sourceDeviceId === localDevice.id
    && state.fileTransfer.active.sourceFileId === selected.file.id
    ? state.fileTransfer.active
    : undefined
  const connectedAddress = activeUploadForSelectedFile
    ? state.remoteSession.active?.accessId === activeUploadForSelectedFile.accessId ? state.remoteSession.active.connectedAddress : undefined
    : remote ? state.remoteSession.active!.connectedAddress : undefined
  const incoming = deriveIncomingArtifact(state.fileTransfer.active, localDevice.id, path)
  const localNodeMinerProcess = findRunningLocalNodeMiner(state)
  const installingProductIds = new Set(state.process.processes
    .filter((process): process is SoftwareInstallationProcess => process.kind === 'software_installation')
    .filter((process) => process.status === 'running' && process.executorDeviceId === localDevice.id)
    .map((process) => process.productId))
  const removingProductIds = new Set(state.process.processes
    .filter((process): process is SoftwareRemovalProcess => process.kind === 'software_removal')
    .filter((process) => process.status === 'running' && process.executorDeviceId === localDevice.id)
    .map((process) => process.productId))

  function openFile(filePath: string) { setSelectedFile(filePath); setReviewingInstall(false) }
  function closeFile() { setSelectedFile(undefined); setReviewingInstall(false) }

  if (selectedFile) {
    const packageUnderReview = reviewingInstall && selected?.status === 'ok' && selected.file.kind === 'software_package' ? selected.file : undefined
    return <section className="app-content files-app">
      {packageUnderReview
        ? <InstallReview file={packageUnderReview} device={localDevice} install={actions.installLocalSoftwarePackage} close={() => setReviewingInstall(false)} />
        : <>
          <button className="node-back" type="button" onClick={closeFile} aria-label={`Back to ${path}`}>
            <span aria-hidden="true">←</span> {path}
          </button>
          {selected?.status === 'ok'
            ? <FileDetails file={selected.file} installedSoftware={localDevice.installedSoftware} installingProductIds={installingProductIds} removingProductIds={removingProductIds} reviewInstall={() => setReviewingInstall(true)} nodeWalletAddress={state.nodeWallet.address} runNodeMiner={actions.runNodeMiner} runningProcess={localNodeMinerProcess} upload={actions.startRemoteFileUpload} connectedAddress={connectedAddress} activeUpload={activeUploadForSelectedFile} />
            : <div className="node-empty"><strong>FILE NOT FOUND</strong><span>This path no longer resolves on the local filesystem.</span></div>}
        </>}
    </section>
  }

  return <section className="app-content files-app">
    <header className="node-masthead">
      <span className="node-masthead-subject">{path}</span>
      <span className="node-masthead-meta">LOCAL · {localDevice.displayName}</span>
    </header>

    <div className="node-section">
      <span>DIRECTORY</span>
      <span>{listing.status === 'ok' ? `${listing.entries.length} ${listing.entries.length === 1 ? 'ENTRY' : 'ENTRIES'}` : 'UNRESOLVED'}</span>
    </div>

    {listing.status === 'ok' ? <>
      <div className="node-list">
        {path !== '/' && <button className="node-row" type="button" onClick={() => setPath(parentPath(path))}>
          <span className="node-row-glyph" aria-hidden="true">▲</span>
          <span className="node-row-copy"><strong>../</strong><small>DIRECTORY</small></span>
        </button>}
        {listing.entries.map((entry) => {
          const entryPath = joinPath(path, entry.name)
          const result = entry.type === 'file' ? getFilesystemFile(filesystem, entryPath) : undefined
          const file = result?.status === 'ok' ? result.file : undefined
          const packageState = file?.kind === 'software_package' ? derivePackageState(file, localDevice.installedSoftware, installingProductIds, removingProductIds) : undefined
          return <button className="node-row" type="button" key={entry.name} onClick={() => entry.type === 'directory' ? setPath(entryPath) : openFile(entryPath)}>
            <span className="node-row-glyph" aria-hidden="true">{entry.type === 'directory' ? '▰' : '▱'}</span>
            <span className="node-row-copy">
              <strong>{entry.name}</strong>
              <small>{entry.type === 'directory' ? 'DIRECTORY' : file ? `${typeLabel(file)} · ${formatBytes(getFilesystemFileSizeBytes(file))}` : 'FILE'}</small>
            </span>
            {packageState && <span className={packageState === 'INSTALLED' ? 'node-chip' : 'node-chip node-chip--quiet'}>{packageState}</span>}
            {/* Both kinds open a further surface with a back control, so both
                carry the arrow. `../` keeps its own upward glyph instead. */}
            <span className="node-row-arrow" aria-hidden="true">→</span>
          </button>
        })}
        {incoming && <div className="node-row node-row--incoming">
          <span className="node-row-glyph" aria-hidden="true">↓</span>
          <span className="node-row-copy">
            <strong>{incoming.relativePath}</strong>
            <small>INCOMING · {incoming.progressLabel} · {incoming.percent}%</small>
            <progress className="node-progress" max={100} value={incoming.percent} aria-label={`Incoming transfer ${incoming.percent}% complete`} />
          </span>
        </div>}
      </div>
      {incoming && <p className="node-note">An incoming transfer is not written to this filesystem until it completes.</p>}
    </> : <div className="node-empty"><strong>DIRECTORY NOT FOUND</strong><span>This path does not resolve on the local filesystem.</span></div>}
  </section>
}

interface IncomingArtifact {
  readonly relativePath: string
  readonly percent: number
  readonly progressLabel: string
}

/**
 * Present the single canonical active `FileTransfer` when it is inbound to
 * this Device and lands inside the directory currently being browsed.
 *
 * This is deliberately not a filesystem entry: no destination artifact exists
 * until the transfer completes, so it is never navigable, never counted as a
 * directory entry, and never given a size or a type.
 */
function deriveIncomingArtifact(transfer: FileTransfer | null, deviceId: string, path: string): IncomingArtifact | undefined {
  if (!transfer || transfer.destinationDeviceId !== deviceId) return undefined
  const prefix = path === '/' ? '/' : `${path}/`
  if (!transfer.destinationPath.startsWith(prefix)) return undefined
  return {
    relativePath: transfer.destinationPath.slice(prefix.length),
    percent: transfer.bytesTotal > 0 ? Math.floor(transfer.bytesTransferred / transfer.bytesTotal * 100) : 0,
    progressLabel: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal),
  }
}

function FileDetails({ file, installedSoftware, installingProductIds, removingProductIds, reviewInstall, nodeWalletAddress, runNodeMiner, runningProcess, upload, connectedAddress, activeUpload }: {
  file: FilesystemFile
  installedSoftware: readonly InstalledSoftware[]
  installingProductIds: ReadonlySet<string>
  removingProductIds: ReadonlySet<string>
  reviewInstall: () => void
  nodeWalletAddress: string
  runNodeMiner: (sourceFilePath: string, payoutAddress: string) => StartNodeMinerResult
  runningProcess: NodeMinerProcess | undefined
  upload: (sourcePath: string, destinationPath: string) => StartRemoteFileUploadResult
  connectedAddress: string | undefined
  activeUpload: FileTransfer | undefined
}) {
  return <div className="file-details">
    <header className="node-masthead">
      <span className="node-masthead-subject">{basename(file.path)}</span>
      <span className="node-masthead-meta">{typeLabel(file)}</span>
    </header>
    <dl className="node-facts">
      <div><dt>PATH</dt><dd>{file.path}</dd></div>
      <div><dt>SIZE</dt><dd>{formatBytes(getFilesystemFileSizeBytes(file))}</dd></div>
    </dl>
    {file.kind === 'text' ? <section>
      <div className="node-section"><span>CONTENT</span></div>
      <pre className="file-content">{file.content}</pre>
    </section>
      : file.kind === 'software_package' ? <PackageDetails file={file} installedSoftware={installedSoftware} installingProductIds={installingProductIds} removingProductIds={removingProductIds} reviewInstall={reviewInstall} />
        : <ExecutableDetails file={file} nodeWalletAddress={nodeWalletAddress} runNodeMiner={runNodeMiner} runningProcess={runningProcess} />}
    {(activeUpload || connectedAddress) && <RemoteTransfer file={file} connectedAddress={connectedAddress} upload={upload} activeUpload={activeUpload} />}
  </div>
}

function RemoteTransfer({ file, connectedAddress, upload, activeUpload }: { file: FilesystemFile; connectedAddress: string | undefined; upload: (sourcePath: string, destinationPath: string) => StartRemoteFileUploadResult; activeUpload: FileTransfer | undefined }) {
  const [destination, setDestination] = useState(`/home/user/${basename(file.path)}`)
  const [feedback, setFeedback] = useState<string>()
  function start() {
    const result = upload(file.path, destination)
    setFeedback(result.status === 'started' ? undefined : describeUploadFailure(result.status))
  }
  return <section className="file-kind-details">
    <div className="node-section"><span>REMOTE TRANSFER</span></div>
    {connectedAddress && <dl className="node-facts"><div><dt>SESSION</dt><dd>{connectedAddress}</dd></div></dl>}
    {activeUpload ? <>
      <dl className="node-facts"><div><dt>DESTINATION</dt><dd>{activeUpload.destinationPath}</dd></div></dl>
      <div className="file-kind-actions"><button className="node-action" type="button" disabled>UPLOAD IN PROGRESS</button></div>
    </> : <>
      <label className="node-field"><span>DESTINATION</span><input className="node-input" aria-label="Remote destination" value={destination} onChange={(event) => setDestination(event.target.value)} autoCapitalize="none" autoComplete="off" autoCorrect="off" spellCheck={false} /></label>
      <div className="file-kind-actions"><button className="node-action" type="button" onClick={start}>UPLOAD</button></div>
      {feedback && <p className="node-note node-note--caution">{feedback}</p>}
    </>}
  </section>
}

/**
 * The compact package surface: what this software is, whether it is installed,
 * and the one action available. Verbose release documentation and the release
 * facts stay behind RELEASE INFORMATION rather than standing between the
 * player and INSTALL.
 */
function PackageDetails({ file, installedSoftware, installingProductIds, removingProductIds, reviewInstall }: {
  file: SoftwarePackageFile
  installedSoftware: readonly InstalledSoftware[]
  installingProductIds: ReadonlySet<string>
  removingProductIds: ReadonlySet<string>
  reviewInstall: () => void
}) {
  const current = installedSoftware.find(({ id }) => id === file.productId)
  const packageState = derivePackageState(file, installedSoftware, installingProductIds, removingProductIds)
  return <section className="file-kind-details">
    <header className="node-masthead"><h2 className="node-masthead-subject">{file.name}</h2><span className="node-masthead-meta">{describePackageRelease(file)}</span></header>
    <div className="node-section"><span>STATUS</span><span>{packageState}</span></div>
    <dl className="node-facts"><div><dt>CURRENT</dt><dd>{current ? describeInstalledSoftware(current) : 'NOT INSTALLED'}</dd></div></dl>
    {packageState === 'INSTALLABLE' ? <div className="file-kind-actions"><button className="node-action" type="button" onClick={reviewInstall}>INSTALL</button></div>
      : packageState === 'INSTALLING' ? <div className="file-kind-actions"><button className="node-action" type="button" disabled>INSTALLING…</button></div>
      : packageState === 'REMOVING' ? <div className="file-kind-actions"><button className="node-action" type="button" disabled>REMOVING…</button></div>
      : packageState === 'UNRECOGNIZED' ? <div className="file-kind-actions"><p className="node-note node-note--caution">UNRECOGNIZED PACKAGE EXTENSION · NOT INSTALLABLE</p></div>
      : <div className="file-kind-actions"><p className="node-note">{packageState === 'PROTECTED' ? 'PROTECTED · SYSTEM BASELINE' : packageState}</p></div>}
    <SoftwareReleaseDisclosure releaseId={file.releaseId} summary facts={<dl className="node-facts">
      {file.publisher && <div><dt>PUBLISHER</dt><dd>{file.publisher}</dd></div>}
      <div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div>
    </dl>} />
  </section>
}

/**
 * Explicit review of one concrete installation before any Process exists.
 *
 * This surface owns temporary React state only: opening it changes nothing,
 * CANCEL changes nothing, and CONFIRM forwards the exact package path to the
 * canonical `installLocalSoftwarePackage` admission, which remains the sole
 * authority over whether installation may start. Nothing here revalidates
 * installation or predicts effects the game does not represent.
 */
function InstallReview({ file, device, install, close }: {
  file: SoftwarePackageFile
  device: LocalDeviceState
  install: (path: string) => InstallLocalSoftwarePackageResult
  close: () => void
}) {
  const [feedback, setFeedback] = useState<string>()
  const current = device.installedSoftware.find(({ id }) => id === file.productId)

  function confirm() {
    const result = install(file.path)
    if (result.status === 'started') { close(); return }
    setFeedback(describeInstallFailure(result))
  }

  return <div className="install-review">
    <header className="node-masthead">
      <span className="node-masthead-subject">INSTALL SOFTWARE</span>
      <span className="node-masthead-meta">LOCAL · {device.displayName}</span>
    </header>
    <h2 className="install-review-subject">{file.name}</h2>
    <p className="package-release">{describePackageRelease(file)}</p>
    <dl className="node-facts">
      <div><dt>TARGET</dt><dd>{device.displayName}</dd></div>
      <div><dt>PACKAGE</dt><dd>{file.path}</dd></div>
      <div><dt>CURRENT</dt><dd>{current ? describeInstalledSoftware(current) : 'NOT INSTALLED'}</dd></div>
    </dl>
    <SoftwareReleaseCapabilities releaseId={file.releaseId} heading="THIS RELEASE PROVIDES" />
    <SoftwareReleaseChanges releaseId={file.releaseId} />
    <div className="install-review-actions">
      <button className="node-action" type="button" onClick={close}>CANCEL</button>
      <button className="node-action" type="button" onClick={confirm}>INSTALL</button>
    </div>
    {feedback && <p className="node-note node-note--caution">{feedback}</p>}
  </div>
}

function ExecutableDetails({ file, nodeWalletAddress, runNodeMiner, runningProcess }: {
  file: ExecutableFile
  nodeWalletAddress: string
  runNodeMiner: (sourceFilePath: string, payoutAddress: string) => StartNodeMinerResult
  runningProcess: NodeMinerProcess | undefined
}) {
  const supported = file.programId === NODE_MINER_PROGRAM_ID && file.releaseId === NODE_MINER_RELEASE_ID
  const [payoutAddress, setPayoutAddress] = useState(nodeWalletAddress)
  const [feedback, setFeedback] = useState<string>()

  function run() {
    const result = runNodeMiner(file.path, payoutAddress)
    setFeedback(result.status === 'started' ? undefined : describeRunFailure(result))
  }

  return <section className="file-kind-details">
    <div className="node-section"><span>PROGRAM</span>{!supported && <span className="node-chip node-chip--quiet">UNSUPPORTED</span>}</div>
    <dl className="node-facts">
      <div><dt>PROGRAM</dt><dd>{file.name} ({file.programId})</dd></div>
      <div><dt>VERSION</dt><dd>{file.version}</dd></div>
      <div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div>
    </dl>
    {supported && (runningProcess
      ? <div className="file-kind-actions">
          <p className="node-note"><strong>RUNNING</strong><br />PROCESS {runningProcess.id}</p>
          <dl className="node-facts">
            <div><dt>PAYOUT</dt><dd>{runningProcess.payoutAddress}</dd></div>
            <div><dt>PRODUCED</dt><dd>{formatNodeUnitsAsNode(runningProcess.producedNodeUnits)} NODE</dd></div>
          </dl>
        </div>
      : <div className="file-kind-actions">
          <label className="node-field">
            <span>PAYOUT ADDRESS</span>
            <input
              className="node-input"
              value={payoutAddress}
              onChange={(event) => setPayoutAddress(event.target.value)}
              aria-label="NODE payout address"
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <button className="node-action" type="button" onClick={run}>RUN</button>
          {feedback && <p className="node-note node-note--caution">{feedback}</p>}
        </div>)}
  </section>
}

function describeInstalledSoftware(software: InstalledSoftware): string {
  return software.channel ? `${software.name} ${software.version} ${titleCase(software.channel)}` : `${software.name} ${software.version}`
}

function describePackageRelease(file: SoftwarePackageFile): string {
  return `${file.version} · ${file.channel.toUpperCase()}`
}

function describeRunFailure(result: Exclude<StartNodeMinerResult, { status: 'started' }>): string {
  if (result.status === 'insufficient_memory') return `INSUFFICIENT MEMORY · REQUIRES ${result.requiredMiB} MiB`
  return result.status.toUpperCase().replaceAll('_', ' ')
}

/**
 * Package state derived from canonical truth alone: normal NODE-OS package
 * recognition of the artifact's current path, Device-owned installed
 * software, and running local Process state. An
 * unrecognized path never rewrites the artifact — it only means normal
 * installation is unavailable from it, exactly as the core operation decides.
 */
function derivePackageState(file: SoftwarePackageFile, installedSoftware: readonly InstalledSoftware[], installingProductIds: ReadonlySet<string>, removingProductIds: ReadonlySet<string>): PackageState {
  if (!isRecognizedSoftwarePackagePath(file.path)) return 'UNRECOGNIZED'
  if (installedSoftware.find(({ id }) => id === file.productId)?.releaseId === file.releaseId) {
    if (file.productId === 'nodescan' && file.releaseId === NODESCAN_1_0_STANDARD_RELEASE_ID) return 'PROTECTED'
    return removingProductIds.has(file.productId) ? 'REMOVING' : 'INSTALLED'
  }
  return installingProductIds.has(file.productId) ? 'INSTALLING' : 'INSTALLABLE'
}

function joinPath(path: string, name: string) { return `${path === '/' ? '' : path}/${name}` }
function parentPath(path: string) { return path.slice(0, path.lastIndexOf('/')) || '/' }
function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }
function typeLabel(file: FilesystemFile) { return file.kind === 'text' ? 'TEXT' : file.kind === 'software_package' ? 'SOFTWARE PACKAGE' : 'EXECUTABLE' }
function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }

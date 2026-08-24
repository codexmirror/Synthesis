import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { getFilesystemFile, getFilesystemFileSizeBytes, listDirectory } from '../../core/game/filesystem'
import { findRunningLocalNodeMiner, NODE_MINER_PROGRAM_ID, NODE_MINER_RELEASE_ID, type StartNodeMinerResult } from '../../core/game/nodeMiner'
import { NODESCAN_1_0_STANDARD_RELEASE_ID } from '../../core/game/software'
import { formatByteProgress, formatBytes } from '../byteFormat'
import { formatNodeUnitsAsNode } from '../nodeFormat'
import { SoftwareReleaseDocumentation } from '../SoftwareReleaseDocumentation'
import type { ExecutableFile, FileTransfer, FilesystemFile, InstalledSoftware, NodeMinerProcess, SoftwareInstallationProcess, SoftwareRemovalProcess, SoftwarePackageFile } from '../../core/game/types'

const INITIAL_PATH = '/home/user'

type PackageState = 'INSTALLED' | 'INSTALLABLE' | 'INSTALLING' | 'REMOVING' | 'PROTECTED' | 'UNSUPPORTED'

export function Files() {
  const state = useGameState()
  const localDevice = state.player.localDevice
  const filesystem = localDevice.filesystem
  const actions = useGameActions()
  const [path, setPath] = useState(INITIAL_PATH)
  const [selectedFile, setSelectedFile] = useState<string>()
  const listing = listDirectory(filesystem, path)
  const selected = selectedFile ? getFilesystemFile(filesystem, selectedFile) : undefined
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

  if (selectedFile) return <section className="app-content files-app">
    <button className="node-back" type="button" onClick={() => setSelectedFile(undefined)} aria-label={`Back to ${path}`}>
      <span aria-hidden="true">←</span> {path}
    </button>
    {selected?.status === 'ok'
      ? <FileDetails file={selected.file} installedSoftware={localDevice.installedSoftware} installingProductIds={installingProductIds} removingProductIds={removingProductIds} install={actions.installLocalSoftwarePackage} nodeWalletAddress={state.nodeWallet.address} runNodeMiner={actions.runNodeMiner} runningProcess={localNodeMinerProcess} />
      : <div className="node-empty"><strong>FILE NOT FOUND</strong><span>This path no longer resolves on the local filesystem.</span></div>}
  </section>

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
          return <button className="node-row" type="button" key={entry.name} onClick={() => entry.type === 'directory' ? setPath(entryPath) : setSelectedFile(entryPath)}>
            <span className="node-row-glyph" aria-hidden="true">{entry.type === 'directory' ? '▰' : '▱'}</span>
            <span className="node-row-copy">
              <strong>{entry.name}</strong>
              <small>{entry.type === 'directory' ? 'DIRECTORY' : file ? `${typeLabel(file)} · ${formatBytes(getFilesystemFileSizeBytes(file))}` : 'FILE'}</small>
            </span>
            {packageState && <span className={packageState === 'INSTALLED' ? 'node-chip' : 'node-chip node-chip--quiet'}>{packageState}</span>}
            {entry.type === 'directory' && <span className="node-row-arrow" aria-hidden="true">→</span>}
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

function FileDetails({ file, installedSoftware, installingProductIds, removingProductIds, install, nodeWalletAddress, runNodeMiner, runningProcess }: {
  file: FilesystemFile
  installedSoftware: readonly InstalledSoftware[]
  installingProductIds: ReadonlySet<string>
  removingProductIds: ReadonlySet<string>
  install: (path: string) => unknown
  nodeWalletAddress: string
  runNodeMiner: (sourceFilePath: string, payoutAddress: string) => StartNodeMinerResult
  runningProcess: NodeMinerProcess | undefined
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
      : file.kind === 'software_package' ? <PackageDetails file={file} installedSoftware={installedSoftware} installingProductIds={installingProductIds} removingProductIds={removingProductIds} install={install} />
        : <ExecutableDetails file={file} nodeWalletAddress={nodeWalletAddress} runNodeMiner={runNodeMiner} runningProcess={runningProcess} />}
  </div>
}

function PackageDetails({ file, installedSoftware, installingProductIds, removingProductIds, install }: {
  file: SoftwarePackageFile
  installedSoftware: readonly InstalledSoftware[]
  installingProductIds: ReadonlySet<string>
  removingProductIds: ReadonlySet<string>
  install: (path: string) => unknown
}) {
  const current = installedSoftware.find(({ id }) => id === file.productId)
  const packageState = derivePackageState(file, installedSoftware, installingProductIds, removingProductIds)
  return <section className="file-kind-details">
    <header className="node-masthead"><h2 className="node-masthead-subject">{file.name}</h2><span className="node-masthead-meta">{file.version} {titleCase(file.channel)}</span></header>
    <SoftwareReleaseDocumentation releaseId={file.releaseId} />
    <div className="node-section"><span>SOFTWARE</span><span>{packageState}</span></div>
    <dl className="node-facts"><div><dt>VERSION</dt><dd>{file.version}</dd></div><div><dt>CHANNEL</dt><dd>{file.channel.toUpperCase()}</dd></div>{file.publisher && <div><dt>PUBLISHER</dt><dd>{file.publisher}</dd></div>}<div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div><div><dt>CURRENT</dt><dd>{current ? describeInstalledSoftware(current) : 'NOT INSTALLED'}</dd></div></dl>
    {packageState === 'UNSUPPORTED' ? <p className="node-note node-note--caution">UNSUPPORTED PACKAGE</p>
      : packageState === 'INSTALLABLE' ? <div className="file-kind-actions"><button className="node-action" type="button" onClick={() => install(file.path)}>INSTALL</button></div>
      : packageState === 'INSTALLING' ? <div className="file-kind-actions"><button className="node-action" type="button" disabled>INSTALLING…</button></div>
      : packageState === 'REMOVING' ? <div className="file-kind-actions"><button className="node-action" type="button" disabled>REMOVING…</button></div>
      : <div className="file-kind-actions"><p className="node-note">{packageState === 'PROTECTED' ? 'PROTECTED · SYSTEM BASELINE' : packageState}</p></div>}
  </section>
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
  return 'channel' in software ? `${software.name} ${software.version} ${titleCase(software.channel)}` : `${software.name} ${software.version}`
}

function describeRunFailure(result: Exclude<StartNodeMinerResult, { status: 'started' }>): string {
  if (result.status === 'insufficient_memory') return `INSUFFICIENT MEMORY · REQUIRES ${result.requiredMiB} MiB`
  return result.status.toUpperCase().replaceAll('_', ' ')
}

function derivePackageState(file: SoftwarePackageFile, installedSoftware: readonly InstalledSoftware[], installingProductIds: ReadonlySet<string>, removingProductIds: ReadonlySet<string>): PackageState {
  if (file.productId !== 'nodescan' && file.productId !== NODE_MINER_PROGRAM_ID) return 'UNSUPPORTED'
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

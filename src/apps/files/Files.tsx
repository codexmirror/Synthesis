import { useState, type ReactNode } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import { getFilesystemFile, getFilesystemFileSizeBytes, listDirectory } from '../../core/game/filesystem'
import { findRunningLocalNodeMiner, NODE_MINER_PROGRAM_ID, NODE_MINER_RELEASE_ID, type StartNodeMinerResult } from '../../core/game/nodeMiner'
import { NODESCAN_1_0_STANDARD_RELEASE_ID } from '../../core/game/software'
import { FLIPPER_MODULE_TECHNIQUE, findInstalledFlipper } from '../../core/game/flipper'
import { findCompatibleDeauthExtension, isSupportedDeauthExtensionArtifact } from '../../core/game/deauth'
import { deriveSoftwarePackageEligibility, type InstallLocalSoftwarePackageResult } from '../../core/game/softwareInstallation'
import { formatByteProgress, formatBytes } from '../byteFormat'
import { formatNodeUnitsAsNode } from '../nodeFormat'
import { SoftwareReleaseCapabilities, SoftwareReleaseChanges, SoftwareReleaseDisclosure } from '../SoftwareReleaseDocumentation'
import { deriveFileTransferDirection, type StartRemoteFileUploadResult } from '../../core/game/fileTransfer'
import { describeUploadFailure } from '../uploadFailure'
import { describeInstallFailure } from '../installFailure'
import { resolveActiveRemoteTarget } from '../../core/game/remoteSession'
import type { DeauthExtensionFile, DeviceAccessFileTransfer, GameState, ExecutableFile, FileTransfer, FilesystemFile, FirmwarePackageFile, InstalledSoftware, LocalDeviceState, NodeMinerProcess, SoftwareInstallationProcess, SoftwareRemovalProcess, SoftwarePackageFile, SoftwareModuleFile, FlipperInstallation, RattlerPayloadFile, TextFile } from '../../core/game/types'
import { isRackOsFirmwareArtifact } from '../../core/game/rackOsFirmwareUpdate'
import { RATTLER_1_0 } from '../../core/game/softwareReleaseContent'
import { RATTLER_PROGRAM_ID } from '../../core/game/rattler'
import type { ExecutableAppId } from '../../shell/appRegistry'

const INITIAL_PATH = '/home/user'

type PackageState = 'INSTALLED' | 'INSTALLABLE' | 'INSTALLING' | 'REMOVING' | 'PROTECTED' | 'UNRECOGNIZED' | 'NOT COMPATIBLE'

export function Files({ openApp }: { openApp?: (app: ExecutableAppId) => void } = {}) {
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
  const activeDeviceTransfer = state.fileTransfer.active?.origin === 'device_access' ? state.fileTransfer.active : undefined
  const activeUploadForSelectedFile = selected?.status === 'ok' && activeDeviceTransfer
    && deriveFileTransferDirection(localDevice.id, activeDeviceTransfer) === 'upload'
    && activeDeviceTransfer.sourceDeviceId === localDevice.id
    && activeDeviceTransfer.sourceFileId === selected.file.id
    ? activeDeviceTransfer
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
            ? <FileDetails file={selected.file} device={localDevice} process={state.process} installedSoftware={localDevice.installedSoftware} installingProductIds={installingProductIds} removingProductIds={removingProductIds} reviewInstall={() => setReviewingInstall(true)} nodeWalletAddress={state.nodeWallet.address} runNodeMiner={actions.runNodeMiner} runningProcess={localNodeMinerProcess} upload={actions.startRemoteFileUpload} connectedAddress={connectedAddress} activeUpload={activeUploadForSelectedFile} openExecutableApp={openApp} />
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
          const packageState = file?.kind === 'software_package' ? derivePackageState(file, localDevice, state.process, removingProductIds) : undefined
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

/**
 * The human-readable identity a kind actually carries, distinct from the
 * concrete filename. Kinds with no represented name of their own (text,
 * RATTLER payload) have no separate identity to state — the filename already
 * is the identity, and a second, invented line would only repeat it.
 */
function identityName(file: FilesystemFile): string | undefined {
  switch (file.kind) {
    case 'software_package':
    case 'software_module':
    case 'deauth_extension':
    case 'executable':
      return file.name
    case 'firmware_package':
      return `${file.name} ${file.version}`
    default:
      return undefined
  }
}

/**
 * The shared opened-file subject: the strongest represented human-readable
 * name, the concrete filename beneath it when that differs, then the compact
 * TYPE · SIZE and LOCAL · Device context lines every kind carries. Path and
 * internal identifiers are deliberately not here — they belong to the FILE
 * INFORMATION disclosure below, not the identity a player reads first.
 */
function FileIdentity({ file, device }: { file: FilesystemFile; device: LocalDeviceState }) {
  const filename = basename(file.path)
  const name = identityName(file)
  return <header className="file-identity">
    <h1 className="file-identity-name">{name ?? filename}</h1>
    {name && name !== filename && <p className="file-identity-filename">{filename}</p>}
    <p className="file-identity-meta">{typeLabel(file)} · {formatBytes(getFilesystemFileSizeBytes(file))}</p>
    <p className="file-identity-device">LOCAL · {device.displayName}</p>
  </header>
}

/** One collapsed technical-detail panel, closed by default and reopenable. */
function Disclosure({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return <section className="release-disclosure">
    <button className="node-disclosure" type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
      <span>{label}</span>
      <span className="node-disclosure-mark" aria-hidden="true">{open ? '−' : '+'}</span>
    </button>
    {open && <div className="release-disclosure-panel">{children}</div>}
  </section>
}

/**
 * The one shared home for file-level technical truth every kind carries:
 * canonical path, plus whatever further genuinely file-level facts a kind
 * supplies through `children`. Size and type are already stated in the
 * identity area, so they are deliberately not repeated here.
 */
function FileInformation({ file, children }: { file: FilesystemFile; children?: ReactNode }) {
  return <Disclosure label="FILE INFORMATION">
    <dl className="node-facts">
      <div><dt>PATH</dt><dd>{file.path}</dd></div>
      {children}
    </dl>
  </Disclosure>
}

function FileDetails({ file, device, process, installedSoftware, installingProductIds, removingProductIds, reviewInstall, nodeWalletAddress, runNodeMiner, runningProcess, upload, connectedAddress, activeUpload, openExecutableApp }: {
  file: FilesystemFile
  device: LocalDeviceState
  process: GameState['process']
  installedSoftware: readonly InstalledSoftware[]
  installingProductIds: ReadonlySet<string>
  removingProductIds: ReadonlySet<string>
  reviewInstall: () => void
  nodeWalletAddress: string
  runNodeMiner: (sourceFilePath: string, payoutAddress: string) => StartNodeMinerResult
  runningProcess: NodeMinerProcess | undefined
  upload: (sourcePath: string, destinationPath: string) => StartRemoteFileUploadResult
  connectedAddress: string | undefined
  activeUpload: DeviceAccessFileTransfer | undefined
  openExecutableApp?: (app: ExecutableAppId) => void
}) {
  return <div className="file-details">
    <FileIdentity file={file} device={device} />
    {file.kind === 'text' ? <TextDetails file={file} />
        : file.kind === 'software_package' ? <PackageDetails file={file} device={device} process={process} installedSoftware={installedSoftware} installingProductIds={installingProductIds} removingProductIds={removingProductIds} reviewInstall={reviewInstall} />
        : file.kind === 'software_module' ? <ModuleDetails file={file} installedSoftware={installedSoftware} />
        : file.kind === 'deauth_extension' ? <DeauthExtensionDetails file={file} device={device} />
        : file.kind === 'rattler_payload' ? <RattlerPayloadDetails file={file} />
        : file.kind === 'firmware_package' ? <FirmwarePackageDetails file={file} device={device} />
          : <ExecutableDetails file={file} nodeWalletAddress={nodeWalletAddress} runNodeMiner={runNodeMiner} runningProcess={runningProcess} openExecutableApp={openExecutableApp} />}
    {(activeUpload || connectedAddress) && <RemoteTransfer file={file} connectedAddress={connectedAddress} upload={upload} activeUpload={activeUpload} />}
  </div>
}

function RemoteTransfer({ file, connectedAddress, upload, activeUpload }: { file: FilesystemFile; connectedAddress: string | undefined; upload: (sourcePath: string, destinationPath: string) => StartRemoteFileUploadResult; activeUpload: DeviceAccessFileTransfer | undefined }) {
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

/** Text stays the simplest kind: identity, content, and file-level facts. No status or action is invented for uniformity. */
function TextDetails({ file }: { file: TextFile }) {
  return <section className="file-kind-details">
    <div className="node-section"><span>CONTENT</span></div>
    <pre className="file-content">{file.content}</pre>
    <FileInformation file={file} />
  </section>
}

/**
 * The compact package surface: what this software is, whether it is installed,
 * and the one action available. Verbose release documentation and the release
 * facts stay behind RELEASE INFORMATION rather than standing between the
 * player and INSTALL.
 */
function PackageDetails({ file, device, process, installedSoftware, installingProductIds, removingProductIds, reviewInstall }: {
  file: SoftwarePackageFile
  device: LocalDeviceState
  process: GameState['process']
  installedSoftware: readonly InstalledSoftware[]
  installingProductIds: ReadonlySet<string>
  removingProductIds: ReadonlySet<string>
  reviewInstall: () => void
}) {
  const current = installedSoftware.find(({ id }) => id === file.productId)
  const eligibility = deriveSoftwarePackageEligibility(file, device, process)
  const packageState = derivePackageState(file, device, process, removingProductIds)
  return <section className="file-kind-details">
    <div className="node-section"><span>STATUS</span><span>{packageState}</span></div>
    <dl className="node-facts">
      <div><dt>VERSION</dt><dd>{describePackageRelease(file)}</dd></div>
      <div><dt>CURRENT</dt><dd>{current ? describeInstalledSoftware(current) : 'NOT INSTALLED'}</dd></div>
      {eligibility.status === 'incompatible' && <div><dt>REQUIRES</dt><dd>{eligibility.requiredFirmware}</dd></div>}
    </dl>
    {packageState === 'INSTALLABLE' ? <div className="file-kind-actions"><button className="node-action" type="button" onClick={reviewInstall}>INSTALL</button></div>
      : packageState === 'INSTALLING' ? <div className="file-kind-actions"><button className="node-action" type="button" disabled>INSTALLING…</button></div>
      : packageState === 'REMOVING' ? <div className="file-kind-actions"><button className="node-action" type="button" disabled>REMOVING…</button></div>
      : packageState === 'UNRECOGNIZED' ? <div className="file-kind-actions"><p className="node-note node-note--caution">UNRECOGNIZED PACKAGE EXTENSION · NOT INSTALLABLE</p></div>
      : <div className="file-kind-actions"><p className="node-note">{packageState === 'PROTECTED' ? 'PROTECTED · SYSTEM BASELINE' : packageState}</p></div>}
    <FileInformation file={file} />
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

/** An application executable: identity, then OPEN. The application explains itself after that. */
function ApplicationLaunch({ label, appId, openExecutableApp }: { label: string; appId: ExecutableAppId; openExecutableApp?: (app: ExecutableAppId) => void }) {
  return <>
    <div className="node-section"><span>APPLICATION</span></div>
    <p className="node-note">Opens the {label} application. Files inspects this executable only.</p>
    {openExecutableApp && <div className="file-kind-actions"><button className="node-action" type="button" onClick={() => openExecutableApp(appId)}>OPEN</button></div>}
  </>
}

/** NODE Miner: not an application, so Files remains its launcher/runner rather than a dashboard of its own. */
function NodeMinerRunner({ file, nodeWalletAddress, runNodeMiner, runningProcess }: {
  file: ExecutableFile
  nodeWalletAddress: string
  runNodeMiner: (sourceFilePath: string, payoutAddress: string) => StartNodeMinerResult
  runningProcess: NodeMinerProcess | undefined
}) {
  const [payoutAddress, setPayoutAddress] = useState(nodeWalletAddress)
  const [feedback, setFeedback] = useState<string>()

  function run() {
    const result = runNodeMiner(file.path, payoutAddress)
    setFeedback(result.status === 'started' ? undefined : describeRunFailure(result))
  }

  return <>
    <div className="node-section"><span>RUN</span></div>
    {runningProcess
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
        </div>}
  </>
}

function UnsupportedExecutable() {
  return <>
    <div className="node-section"><span>PROGRAM</span><span className="node-chip node-chip--quiet">UNSUPPORTED</span></div>
    <p className="node-note">Files does not currently support opening or running this executable.</p>
  </>
}

/**
 * Files is a launcher plus file inspector for application executables (Flipper,
 * RATTLER): OPEN hands off to the application, which explains itself from
 * there. NODE Miner is not an application — it keeps its current RUN-style
 * launcher/runner presentation. Anything else stays explicitly unsupported.
 */
function ExecutableDetails({ file, nodeWalletAddress, runNodeMiner, runningProcess, openExecutableApp }: {
  file: ExecutableFile
  nodeWalletAddress: string
  runNodeMiner: (sourceFilePath: string, payoutAddress: string) => StartNodeMinerResult
  runningProcess: NodeMinerProcess | undefined
  openExecutableApp?: (app: ExecutableAppId) => void
}) {
  const flipper = file.programId === 'flipper' && file.releaseId === 'flipper-1.0'
  const rattler = file.programId === RATTLER_PROGRAM_ID && file.releaseId === RATTLER_1_0.releaseId && file.buildId === RATTLER_1_0.buildId
  const supported = file.programId === NODE_MINER_PROGRAM_ID && file.releaseId === NODE_MINER_RELEASE_ID

  return <section className="file-kind-details">
    {flipper ? <ApplicationLaunch label="Flipper" appId="flipper" openExecutableApp={openExecutableApp} />
      : rattler ? <ApplicationLaunch label="RATTLER" appId="rattler" openExecutableApp={openExecutableApp} />
      : supported ? <NodeMinerRunner file={file} nodeWalletAddress={nodeWalletAddress} runNodeMiner={runNodeMiner} runningProcess={runningProcess} />
      : <UnsupportedExecutable />}
    <FileInformation file={file}>
      <div><dt>PROGRAM ID</dt><dd>{file.programId}</dd></div>
      <div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div>
      <div><dt>BUILD</dt><dd>{file.buildId}</dd></div>
    </FileInformation>
  </section>
}

function describeInstalledSoftware(software: InstalledSoftware): string {
  return software.channel ? `${software.name} ${software.version} ${titleCase(software.channel)}` : `${software.name} ${software.version}`
}

function describePackageRelease(file: SoftwarePackageFile): string {
  return file.channel ? `${file.version} · ${file.channel.toUpperCase()}` : file.version
}

function describeRunFailure(result: Exclude<StartNodeMinerResult, { status: 'started' }>): string {
  if (result.status === 'insufficient_memory') return `INSUFFICIENT MEMORY · REQUIRES ${result.requiredMiB} MiB`
  return result.status.toUpperCase().replaceAll('_', ' ')
}

/**
 * A module artifact is a directly usable technique source and an optional
 * input Flipper can integrate. It is never installable software, so Files
 * deliberately offers no INSTALL; Flipper owns only the optional integration.
 * Deeper release/build identity and the technique/host facts stay behind
 * MODULE INFORMATION rather than dominating the primary surface merely
 * because `hostProductId` exists.
 */
function ModuleDetails({ file, installedSoftware }: { file: SoftwareModuleFile; installedSoftware: readonly InstalledSoftware[] }) {
  const host = installedSoftware.find((software): software is FlipperInstallation => software.id === file.hostProductId)
  const integrated = host?.integratedModules.includes(file.moduleId)
  const technique = FLIPPER_MODULE_TECHNIQUE[file.moduleId]
  return <section className="file-kind-details">
    <div className="node-section"><span>INTEGRATION</span><span>{!host ? 'HOST NOT INSTALLED' : integrated ? 'INTEGRATED' : 'NOT INTEGRATED'}</span></div>
    <p className="node-note">Supplies {technique} standalone. {integrated
      ? 'It is also integrated into the installed Flipper build; the artifact remains an ordinary file.'
      : 'Flipper is an optional integration host, and integration is performed from that application.'}</p>
    <FileInformation file={file} />
    <Disclosure label="MODULE INFORMATION">
      <dl className="node-facts">
        <div><dt>STANDALONE USE</dt><dd>AVAILABLE</dd></div>
        <div><dt>OPTIONAL HOST</dt><dd>{host ? `${host.name} ${host.version}` : file.hostProductId}</dd></div>
        <div><dt>TECHNIQUE</dt><dd>{technique}</dd></div>
        <div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div>
        <div><dt>BUILD</dt><dd>{file.buildId}</dd></div>
      </dl>
    </Disclosure>
  </section>
}

/**
 * `deauth.ext` is the concrete Flipper Extension, not standalone software and
 * not a Software Module: it has no integration mechanic of its own, only a
 * co-presence condition with a compatible installed Flipper. Only that
 * genuinely represented availability is stated on the primary surface;
 * detailed host/release/build compatibility stays behind EXTENSION
 * INFORMATION.
 */
function DeauthExtensionDetails({ file, device }: { file: DeauthExtensionFile; device: LocalDeviceState }) {
  const flipper = findInstalledFlipper(device)
  // The viewed artifact's own availability, not whichever compatible copy
  // `findCompatibleDeauthExtension` happens to find first: this exact file
  // must be the recognized build, and a compatible Flipper must exist at all
  // (that existence check is what a non-undefined find result proves here,
  // regardless of which copy it actually returns).
  const available = isSupportedDeauthExtensionArtifact(file) && findCompatibleDeauthExtension(device) !== undefined
  return <section className="file-kind-details">
    <div className="node-section"><span>AVAILABILITY</span><span>{available ? 'AVAILABLE' : 'NOT AVAILABLE'}</span></div>
    <p className="node-note">{available
      ? 'DEAUTH is available from Flipper NETWORK while this extension and a compatible Flipper remain on this Device.'
      : flipper
        ? 'The installed Flipper build does not support this extension.'
        : 'Requires Flipper to be installed.'}</p>
    <FileInformation file={file} />
    <Disclosure label="EXTENSION INFORMATION">
      <dl className="node-facts">
        <div><dt>HOST</dt><dd>{flipper ? `${flipper.name} ${flipper.version}` : 'NOT INSTALLED'}</dd></div>
        <div><dt>COMPATIBILITY</dt><dd>Flipper {file.compatibleHostReleaseId.replace('flipper-', '')}</dd></div>
        <div><dt>RELEASE</dt><dd>{file.releaseId}</dd></div>
        <div><dt>BUILD</dt><dd>{file.buildId}</dd></div>
      </dl>
    </Disclosure>
  </section>
}

/**
 * A RATTLER payload stays an artifact, not RATTLER's own application UI:
 * Files states the target/payload facts it legitimately reads from the
 * artifact, with opaque release/build identity moved into FILE INFORMATION
 * since it is not what identifies this payload to a player.
 */
function RattlerPayloadDetails({ file }: { file: RattlerPayloadFile }) {
  return <section className="file-kind-details">
    <div className="node-section"><span>TARGET</span><span>TARGET BOUND</span></div>
    <dl className="node-facts">
      <div><dt>ADDRESS</dt><dd>{file.targetAddressSnapshot}</dd></div>
      <div><dt>DEVICE</dt><dd>{file.targetDeviceId}</dd></div>
    </dl>
    <FileInformation file={file}>
      <div><dt>RELEASE</dt><dd>{file.rattlerReleaseId}</dd></div>
      <div><dt>BUILD</dt><dd>{file.rattlerBuildId}</dd></div>
    </FileInformation>
  </section>
}

/**
 * A firmware installer artifact on the local Device.
 *
 * NODE-OS states what the artifact is and refuses to do anything with it, and
 * that refusal is the truth rather than a missing feature: node-01 runs
 * NODE-OS, this installer installs a RACK-OS release, and firmware is
 * installed by the Device that runs it — from that Device's own copy, through
 * that Device's own operating environment. So there is no INSTALL action here,
 * and none is implied. Transfer remains available through the shared REMOTE
 * TRANSFER section below, which is how the artifact reaches a Device that can
 * actually use it.
 */
function FirmwarePackageDetails({ file, device }: { file: FirmwarePackageFile; device: LocalDeviceState }) {
  const recognized = isRackOsFirmwareArtifact(file)
  return <section className="file-kind-details">
    <div className="node-section"><span>INSTALLATION</span><span>NOT ON THIS DEVICE</span></div>
    <dl className="node-facts">
      <div><dt>INSTALLS</dt><dd>{file.name} {file.version}</dd></div>
      <div><dt>THIS DEVICE</dt><dd>{device.firmware.name} {device.firmware.version}</dd></div>
    </dl>
    <p className="node-note">{recognized
      ? `Device firmware is installed by the Device that runs it. Transfer this installer to a compatible ${file.name} server and open it there.`
      : `This installer carries a firmware build ${device.displayName} does not recognize.`}</p>
    <FileInformation file={file}>
      {file.publisher && <div><dt>PUBLISHER</dt><dd>{file.publisher}</dd></div>}
      <div><dt>BUILD</dt><dd>{file.buildId}</dd></div>
    </FileInformation>
  </section>
}

/**
 * Package state derived from canonical truth alone: normal NODE-OS package
 * recognition of the artifact's current path, Device-owned installed
 * software, and running local Process state. An
 * unrecognized path never rewrites the artifact — it only means normal
 * installation is unavailable from it, exactly as the core operation decides.
 */
function derivePackageState(file: SoftwarePackageFile, device: LocalDeviceState, process: GameState['process'], removingProductIds: ReadonlySet<string>): PackageState {
  const eligibility = deriveSoftwarePackageEligibility(file, device, process)
  if (eligibility.status === 'unrecognized') return 'UNRECOGNIZED'
  if (eligibility.status === 'incompatible') return 'NOT COMPATIBLE'
  if (eligibility.status === 'installed') {
    if (file.productId === 'nodescan' && file.releaseId === NODESCAN_1_0_STANDARD_RELEASE_ID) return 'PROTECTED'
    return removingProductIds.has(file.productId) ? 'REMOVING' : 'INSTALLED'
  }
  return eligibility.status === 'installing' ? 'INSTALLING' : 'INSTALLABLE'
}

function joinPath(path: string, name: string) { return `${path === '/' ? '' : path}/${name}` }
function parentPath(path: string) { return path.slice(0, path.lastIndexOf('/')) || '/' }
function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }
function typeLabel(file: FilesystemFile): string {
  switch (file.kind) {
    case 'text': return 'TEXT'
    case 'software_package': return 'SOFTWARE PACKAGE'
    case 'software_module': return 'SOFTWARE MODULE'
    case 'deauth_extension': return 'FLIPPER EXTENSION'
    case 'rattler_payload': return 'RATTLER PAYLOAD'
    case 'firmware_package': return 'FIRMWARE INSTALLER'
    case 'executable': return 'EXECUTABLE'
  }
}
function titleCase(value: string) { return value.charAt(0).toUpperCase() + value.slice(1) }

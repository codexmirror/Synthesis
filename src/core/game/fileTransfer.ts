import { checkDestinationPlacement, copyFilesystemFileToPath, getFilesystemFile, getFilesystemFileSizeBytes } from './filesystem'
import { findMarketOffer, isMarketOfferPurchased } from './market'
import { deriveCrossNetworkTransferRateBytesPerSecond, deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from './networkTransferCapacity'
import { appendNetworkFileTransferEvidence, resolveDeviceLocalNetworkMembership } from './networkActivityHistory'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { DeviceAccessFileTransfer, FileTransfer, FilesystemFile, FilesystemState, GameState, MarketDistributionFileTransfer, MarketOffer, NetworkHost } from './types'
import { archiveFileTransfer } from './recentActivity'

export function deriveDownloadDestinationPath(sourcePath: string): string {
  const basename = sourcePath.slice(sourcePath.lastIndexOf('/') + 1)
  return `/home/user/downloads/${basename}`
}

type StartTransferFailure =
  | 'session_unavailable' | 'invalid_path' | 'source_not_found' | 'source_not_file'
  | 'local_offline' | 'source_offline' | 'destination_offline' | 'capacity_unavailable'
  | 'transfer_in_progress' | 'destination_exists' | 'destination_conflict'

export type StartRemoteFileDownloadResult =
  | { readonly status: 'started'; readonly state: GameState; readonly transferId: string; readonly sourcePath: string; readonly destinationPath: string }
  | { readonly status: Exclude<StartTransferFailure, 'destination_offline'>; readonly state: GameState }

export type StartRemoteFileUploadResult =
  | { readonly status: 'started'; readonly state: GameState; readonly transferId: string; readonly sourcePath: string; readonly destinationPath: string }
  | { readonly status: Exclude<StartTransferFailure, 'source_offline'>; readonly state: GameState }

type AdmittedTransfer =
  | Omit<DeviceAccessFileTransfer, 'id' | 'bytesTransferred'>
  | Omit<MarketDistributionFileTransfer, 'id' | 'bytesTransferred'>

/** Place one admitted transfer as the single active canonical FileTransfer. */
function admitTransfer(state: GameState, transfer: AdmittedTransfer) {
  const transferId = `transfer-${String(state.fileTransfer.nextId).padStart(4, '0')}`
  const active: FileTransfer = { id: transferId, ...transfer, bytesTransferred: 0 }
  return {
    state: { ...state, fileTransfer: { nextId: state.fileTransfer.nextId + 1, active } },
    transferId,
    destinationPath: transfer.destinationPath,
  }
}

/** Admit a remote-to-local transfer through the current RemoteSession. */
export function startRemoteFileDownload(state: GameState, sourcePath: string): StartRemoteFileDownloadResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  const source = getFilesystemFile(remote.target.filesystem!, sourcePath)
  if (source.status === 'invalid_path') return { status: 'invalid_path', state }
  if (source.status === 'not_found') return { status: 'source_not_found', state }
  if (source.status === 'not_file') return { status: 'source_not_file', state }
  const local = state.player.localDevice
  if (local.runtime.networkStatus !== 'ONLINE') return { status: 'local_offline', state }
  if (!remote.target.online) return { status: 'source_offline', state }
  if (!remote.target.transferCapacity || !isValidNetworkTransferCapacity(remote.target.transferCapacity) || !isValidNetworkTransferCapacity(local.network.transferCapacity)) return { status: 'capacity_unavailable', state }
  if (state.fileTransfer.active) return { status: 'transfer_in_progress', state }
  const destinationPath = deriveDownloadDestinationPath(source.file.path)
  const placement = checkDestinationPlacement(local.filesystem, destinationPath)
  if (placement !== 'ok') return { status: placement, state }
  const admitted = admitTransfer(state, {
    origin: 'device_access',
    accessId: remote.access.id, sourceDeviceId: remote.target.id, sourceFileId: source.file.id,
    destinationDeviceId: local.id, destinationPath, bytesTotal: getFilesystemFileSizeBytes(source.file),
  })
  return { status: 'started', ...admitted, sourcePath: source.file.path }
}

/** Admit a local-to-remote transfer; no destination artifact is created yet. */
export function startRemoteFileUpload(state: GameState, sourcePath: string, destinationPath: string): StartRemoteFileUploadResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  if (destinationPath.endsWith('/')) return { status: 'invalid_path', state }
  const source = getFilesystemFile(state.player.localDevice.filesystem, sourcePath)
  if (source.status === 'invalid_path') return { status: 'invalid_path', state }
  if (source.status === 'not_found') return { status: 'source_not_found', state }
  if (source.status === 'not_file') return { status: 'source_not_file', state }
  const local = state.player.localDevice
  if (local.runtime.networkStatus !== 'ONLINE') return { status: 'local_offline', state }
  if (!remote.target.online) return { status: 'destination_offline', state }
  if (!remote.target.filesystem) return { status: 'destination_conflict', state }
  if (!remote.target.transferCapacity || !isValidNetworkTransferCapacity(local.network.transferCapacity) || !isValidNetworkTransferCapacity(remote.target.transferCapacity)) return { status: 'capacity_unavailable', state }
  if (state.fileTransfer.active) return { status: 'transfer_in_progress', state }
  const placement = checkDestinationPlacement(remote.target.filesystem, destinationPath)
  if (placement !== 'ok') return { status: placement, state }
  const admitted = admitTransfer(state, {
    origin: 'device_access',
    accessId: remote.access.id, sourceDeviceId: local.id, sourceFileId: source.file.id,
    destinationDeviceId: remote.target.id, destinationPath, bytesTotal: getFilesystemFileSizeBytes(source.file),
  })
  return { status: 'started', ...admitted, sourcePath: source.file.path }
}

export type FileTransferDirection = 'download' | 'upload'

/**
 * Which way an active transfer moves relative to the local Device. A Market
 * distribution transfer is always a download: its source is the represented
 * Market distribution endpoint, which is not a Device at all.
 */
export function deriveFileTransferDirection(localDeviceId: string, transfer: FileTransfer): FileTransferDirection | undefined {
  if (transfer.origin === 'market_distribution') return transfer.destinationDeviceId === localDeviceId ? 'download' : undefined
  const sourceIsLocal = transfer.sourceDeviceId === localDeviceId
  const destinationIsLocal = transfer.destinationDeviceId === localDeviceId
  if (sourceIsLocal === destinationIsLocal) return undefined
  return sourceIsLocal ? 'upload' : 'download'
}

/** The V1 local destination a Market offering's package is downloaded to. */
export function deriveMarketDownloadDestinationPath(offer: MarketOffer): string {
  return deriveDownloadDestinationPath(offer.distribution.filename)
}

/**
 * The represented byte size of a Market offering's distribution, validated
 * exactly as a represented artifact size is. A distribution is offer and
 * source truth, not a file: it has no filesystem identity, path or size
 * derivation of its own.
 */
function marketDistributionSizeBytes(offer: MarketOffer): number {
  const { sizeBytes } = offer.distribution
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new RangeError('A represented Market distribution size must be a positive safe integer')
  }
  return sizeBytes
}

/**
 * Build the one ordinary artifact a completed Market download writes, **at the
 * completion moment only** — a `software_package` or a `software_module`,
 * whichever the offering actually distributes.
 *
 * There is deliberately no artifact for a Market offering before this point: a
 * file lives on a Device-owned filesystem, and until the transfer completes
 * there is no artifact, no allocated file ID and no path anywhere. The `id`
 * and `path` below exist only because the shared copy operation allocates the
 * real ones from the destination filesystem and replaces both immediately;
 * neither is ever observable. A module artifact is written exactly as it is
 * distributed: completion installs nothing and creates no InstalledSoftware.
 */
function createCompletedMarketArtifact(offer: MarketOffer): FilesystemFile {
  const pending = { id: 'pending-market-download', path: `/${offer.distribution.filename}` }
  if (offer.distribution.artifact === 'software_module') {
    const { artifact, filename, ...distributed } = offer.distribution
    return { kind: 'software_module', ...pending, ...distributed }
  }
  const { artifact, filename, ...distributed } = offer.distribution
  return { kind: 'software_package', ...pending, ...distributed }
}

export type StartMarketPackageDownloadResult =
  | { readonly status: 'started'; readonly state: GameState; readonly transferId: string; readonly destinationPath: string }
  | { readonly status: 'unknown_offer' | 'not_purchased' | 'local_offline' | 'capacity_unavailable' | 'transfer_in_progress' | 'invalid_path' | 'destination_exists' | 'destination_conflict'; readonly state: GameState }

/**
 * Admit a Market distribution download of one purchased offering.
 *
 * Its authority is the canonical purchase entitlement alone: no DeviceAccess
 * is resolved, no RemoteSession is required or fabricated, and no represented
 * Device is claimed to have been reached. Everything else is the existing
 * canonical FileTransfer admission — one active transfer at a time, the same
 * `/home/user/downloads/<basename>` destination convention, the same
 * no-overwrite placement check, no destination artifact, no allocated
 * destination file ID, and no Process.
 */
export function startMarketPackageDownload(state: GameState, offerId: string): StartMarketPackageDownloadResult {
  const offer = findMarketOffer(state.market, offerId)
  if (!offer) return { status: 'unknown_offer', state }
  if (!isMarketOfferPurchased(state.market, offerId)) return { status: 'not_purchased', state }
  const local = state.player.localDevice
  if (local.runtime.networkStatus !== 'ONLINE') return { status: 'local_offline', state }
  if (!isValidNetworkTransferCapacity(state.market.distributionCapacity) || !isValidNetworkTransferCapacity(local.network.transferCapacity)) return { status: 'capacity_unavailable', state }
  if (state.fileTransfer.active) return { status: 'transfer_in_progress', state }
  const destinationPath = deriveMarketDownloadDestinationPath(offer)
  const placement = checkDestinationPlacement(local.filesystem, destinationPath)
  if (placement !== 'ok') return { status: placement, state }
  const admitted = admitTransfer(state, {
    origin: 'market_distribution', offerId: offer.id,
    destinationDeviceId: local.id, destinationPath,
    bytesTotal: marketDistributionSizeBytes(offer),
  })
  return { status: 'started', ...admitted }
}

/**
 * Everything a running transfer needs resolved fresh from canonical state on
 * every advancement step: the exact source artifact, the destination
 * filesystem, and the current effective rate. Losing any of it aborts the
 * transfer rather than inventing a substitute.
 */
type ResolvedTransfer =
  | {
    readonly origin: 'device_access'
    readonly direction: FileTransferDirection
    readonly remoteHost: NetworkHost
    readonly sourceFile: FilesystemFile
    readonly destinationFilesystem: FilesystemState
    readonly rateBytesPerSecond: number
  }
  | {
    readonly origin: 'market_distribution'
    /** The represented offering the bytes are coming from; no source file exists yet. */
    readonly offer: MarketOffer
    readonly destinationFilesystem: FilesystemState
    readonly rateBytesPerSecond: number
  }

/**
 * Resolve a Market distribution transfer against current canonical truth: the
 * offering must still be represented, the purchase entitlement must still
 * exist, the local Device must still be online, and both the Market
 * distribution endpoint's and the local Device's represented capacities must
 * still be valid. The endpoint belongs to no represented LocalNetwork, so its
 * rate is decided by those two endpoint capacities alone, exactly as a
 * same-Network Device transfer is.
 */
function resolveMarketTransfer(state: GameState, transfer: MarketDistributionFileTransfer): ResolvedTransfer | undefined {
  const local = state.player.localDevice
  if (transfer.destinationDeviceId !== local.id || local.runtime.networkStatus !== 'ONLINE') return undefined
  const offer = findMarketOffer(state.market, transfer.offerId)
  if (!offer || !isMarketOfferPurchased(state.market, transfer.offerId)) return undefined
  const distributionCapacity = state.market.distributionCapacity
  if (!isValidNetworkTransferCapacity(distributionCapacity) || !isValidNetworkTransferCapacity(local.network.transferCapacity)) return undefined
  return {
    origin: 'market_distribution',
    offer,
    destinationFilesystem: local.filesystem,
    rateBytesPerSecond: deriveEffectiveTransferRateBytesPerSecond(distributionCapacity, local.network.transferCapacity),
  }
}

function resolveDeviceAccessTransfer(state: GameState, transfer: DeviceAccessFileTransfer): ResolvedTransfer | undefined {
  const local = state.player.localDevice
  const direction = deriveFileTransferDirection(local.id, transfer)
  if (!direction || local.runtime.networkStatus !== 'ONLINE') return undefined
  const access = state.deviceAccess.established.find(({ id }) => id === transfer.accessId)
  if (!access || access.sourceDeviceId !== local.id) return undefined
  const remoteDeviceId = direction === 'download' ? transfer.sourceDeviceId : transfer.destinationDeviceId
  if (access.targetDeviceId !== remoteDeviceId) return undefined
  const remoteHost = state.world.network.hosts.find(({ id }) => id === remoteDeviceId)
  if (!remoteHost?.online || !remoteHost.filesystem || !remoteHost.transferCapacity) return undefined
  const sourceFilesystem = direction === 'download' ? remoteHost.filesystem : local.filesystem
  const destinationFilesystem = direction === 'download' ? local.filesystem : remoteHost.filesystem
  const sourceDeviceCapacity = direction === 'download' ? remoteHost.transferCapacity : local.network.transferCapacity
  const destinationDeviceCapacity = direction === 'download' ? local.network.transferCapacity : remoteHost.transferCapacity
  if (!isValidNetworkTransferCapacity(sourceDeviceCapacity) || !isValidNetworkTransferCapacity(destinationDeviceCapacity)) return undefined
  const sourceFile = sourceFilesystem.files.find(({ id }) => id === transfer.sourceFileId)
  if (!sourceFile) return undefined

  const sourceDeviceId = direction === 'download' ? remoteHost.id : local.id
  const destinationDeviceId = direction === 'download' ? local.id : remoteHost.id
  const sourceMembership = resolveDeviceLocalNetworkMembership(state.world.network, sourceDeviceId)
  const destinationMembership = resolveDeviceLocalNetworkMembership(state.world.network, destinationDeviceId)
  // Ambiguous membership is not "no Network": represented topology exists
  // but the route cannot be resolved without picking a Network by array
  // order, which is not implemented. Treat the transfer as unable to
  // presently advance, the same as any other unresolved endpoint below.
  if (sourceMembership.kind === 'ambiguous' || destinationMembership.kind === 'ambiguous') return undefined
  const sourceNetwork = sourceMembership.kind === 'unique' ? sourceMembership.network : undefined
  const destinationNetwork = destinationMembership.kind === 'unique' ? destinationMembership.network : undefined
  // Same-Network transfer uses endpoint capacity only: LocalNetwork transfer
  // capacity represents external connectivity, not internal LAN fabric. A
  // Device with zero represented LocalNetwork membership contributes no
  // extra bottleneck rather than blocking an otherwise legitimate transfer —
  // the existing V1 compatibility fallback for no represented Network.
  const isCrossNetwork = !!sourceNetwork && !!destinationNetwork && sourceNetwork.id !== destinationNetwork.id
  let rateBytesPerSecond: number
  if (isCrossNetwork) {
    if (!isValidNetworkTransferCapacity(sourceNetwork.transferCapacity) || !isValidNetworkTransferCapacity(destinationNetwork.transferCapacity)) return undefined
    rateBytesPerSecond = deriveCrossNetworkTransferRateBytesPerSecond(
      sourceDeviceCapacity, sourceNetwork.transferCapacity, destinationNetwork.transferCapacity, destinationDeviceCapacity,
    )
  } else {
    rateBytesPerSecond = deriveEffectiveTransferRateBytesPerSecond(sourceDeviceCapacity, destinationDeviceCapacity)
  }

  return { origin: 'device_access', direction, remoteHost, sourceFile, destinationFilesystem, rateBytesPerSecond }
}

function resolveTransferEndpoints(state: GameState, transfer: FileTransfer): ResolvedTransfer | undefined {
  return transfer.origin === 'market_distribution' ? resolveMarketTransfer(state, transfer) : resolveDeviceAccessTransfer(state, transfer)
}

/** Current effective throughput for the active FileTransfer, derived fresh rather than stored. Zero when it cannot presently advance. */
export function deriveActiveFileTransferRateBytesPerSecond(state: GameState, transfer: FileTransfer): number {
  return resolveTransferEndpoints(state, transfer)?.rateBytesPerSecond ?? 0
}

/** Retained as the narrow Download-facing resolver used by existing presentation. */
export function resolveFileTransferSource(state: GameState, transfer: FileTransfer): NetworkHost | undefined {
  const endpoints = resolveTransferEndpoints(state, transfer)
  return endpoints?.origin === 'device_access' && endpoints.direction === 'download' ? endpoints.remoteHost : undefined
}

/**
 * Current network address of the Device referenced by `deviceId`, for a
 * Network activity evidence address snapshot. Returns `undefined` when that
 * identity does not legitimately resolve to a represented Device; callers
 * must never substitute another Device's address in that case, as doing so
 * would fabricate provenance.
 */
function resolveDeviceNetworkAddress(state: GameState, deviceId: string): string | undefined {
  if (deviceId === state.player.localDevice.id) return state.player.localDevice.network.ip
  return state.world.network.hosts.find(({ id }) => id === deviceId)?.ip
}

/**
 * Append terminal Network-owned FileTransfer evidence for the participating
 * LocalNetwork(s), using the transfer's own stable source/destination
 * identity rather than any transient endpoint resolution. An unresolvable
 * address never fabricates provenance and simply appends no evidence.
 *
 * A Market distribution transfer appends none at all: its source is not a
 * represented Device on a represented Network, and Network-owned World Truth
 * must not claim a Device-to-Device transfer that never happened.
 */
function appendFileTransferNetworkEvidence(state: GameState, transfer: FileTransfer, result: 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED', bytesTransferred: number): GameState {
  if (transfer.origin === 'market_distribution') return state
  const sourceAddress = resolveDeviceNetworkAddress(state, transfer.sourceDeviceId)
  const destinationAddress = resolveDeviceNetworkAddress(state, transfer.destinationDeviceId)
  if (!sourceAddress || !destinationAddress) return state
  const world = appendNetworkFileTransferEvidence(state.world, {
    sourceDeviceId: transfer.sourceDeviceId, destinationDeviceId: transfer.destinationDeviceId,
    sourceAddress, destinationAddress, bytesTransferred, result,
  })
  return world === state.world ? state : { ...state, world }
}

export function advanceFileTransfer(state: GameState, elapsedMs: number): GameState {
  const transfer = state.fileTransfer.active
  if (!transfer) return state
  const endpoints = resolveTransferEndpoints(state, transfer)
  if (!endpoints) {
    const interrupted = appendFileTransferNetworkEvidence(state, transfer, 'INTERRUPTED', transfer.bytesTransferred)
    return archiveFileTransfer({ ...interrupted, fileTransfer: { ...interrupted.fileTransfer, active: null } }, transfer)
  }
  const bytesTransferred = Math.min(transfer.bytesTotal, transfer.bytesTransferred + endpoints.rateBytesPerSecond * (Math.max(0, elapsedMs) / 1000))
  if (bytesTransferred < transfer.bytesTotal) return { ...state, fileTransfer: { ...state.fileTransfer, active: { ...transfer, bytesTransferred } } }

  const finalTransfer = { ...transfer, bytesTransferred }
  /* The destination artifact is created here and only here: for a Device route
     it is a copy of the still-present source file, and for a Market
     distribution it is the ordinary package this completion brings into
     existence on the destination filesystem for the first time. */
  const completedArtifact = endpoints.origin === 'market_distribution' ? createCompletedMarketArtifact(endpoints.offer) : endpoints.sourceFile
  const copied = copyFilesystemFileToPath(completedArtifact, endpoints.destinationFilesystem, transfer.destinationPath)
  if (copied.status !== 'copied') {
    const interrupted = appendFileTransferNetworkEvidence(state, finalTransfer, 'INTERRUPTED', bytesTransferred)
    return archiveFileTransfer({ ...interrupted, fileTransfer: { ...interrupted.fileTransfer, active: null } }, finalTransfer)
  }

  const completedBase = endpoints.origin === 'device_access' && endpoints.direction === 'upload'
    ? { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === endpoints.remoteHost.id ? { ...host, filesystem: copied.filesystem } : host) } }, fileTransfer: { ...state.fileTransfer, active: null } }
    : { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: copied.filesystem } }, fileTransfer: { ...state.fileTransfer, active: null } }
  const completed = appendFileTransferNetworkEvidence(completedBase, finalTransfer, 'COMPLETED', bytesTransferred)
  return archiveFileTransfer(completed, finalTransfer)
}

export type CancelFileTransferResult = { readonly status: 'cancelled' | 'not_found'; readonly state: GameState }

export function cancelFileTransfer(state: GameState, transferId: string): CancelFileTransferResult {
  if (state.fileTransfer.active?.id !== transferId) return { status: 'not_found', state }
  const transfer = state.fileTransfer.active
  const cancelled = appendFileTransferNetworkEvidence(state, transfer, 'CANCELLED', transfer.bytesTransferred)
  return { status: 'cancelled', state: archiveFileTransfer({ ...cancelled, fileTransfer: { ...cancelled.fileTransfer, active: null } }, transfer) }
}

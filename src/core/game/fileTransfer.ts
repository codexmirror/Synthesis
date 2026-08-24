import { checkDestinationPlacement, copyFilesystemFileToPath, getFilesystemFile, getFilesystemFileSizeBytes } from './filesystem'
import { deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from './networkTransferCapacity'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { FileTransfer, FilesystemState, GameState, NetworkHost, NetworkTransferCapacity } from './types'
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

function admitTransfer(state: GameState, transfer: Omit<FileTransfer, 'id' | 'bytesTransferred'>, sourcePath: string) {
  const transferId = `transfer-${String(state.fileTransfer.nextId).padStart(4, '0')}`
  const active: FileTransfer = { id: transferId, ...transfer, bytesTransferred: 0 }
  return {
    status: 'started' as const,
    state: { ...state, fileTransfer: { nextId: state.fileTransfer.nextId + 1, active } },
    transferId,
    sourcePath,
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
  return admitTransfer(state, {
    accessId: remote.access.id, sourceDeviceId: remote.target.id, sourceFileId: source.file.id,
    destinationDeviceId: local.id, destinationPath, bytesTotal: getFilesystemFileSizeBytes(source.file),
  }, source.file.path)
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
  return admitTransfer(state, {
    accessId: remote.access.id, sourceDeviceId: local.id, sourceFileId: source.file.id,
    destinationDeviceId: remote.target.id, destinationPath, bytesTotal: getFilesystemFileSizeBytes(source.file),
  }, source.file.path)
}

export type FileTransferDirection = 'download' | 'upload'

export function deriveFileTransferDirection(localDeviceId: string, transfer: FileTransfer): FileTransferDirection | undefined {
  const sourceIsLocal = transfer.sourceDeviceId === localDeviceId
  const destinationIsLocal = transfer.destinationDeviceId === localDeviceId
  if (sourceIsLocal === destinationIsLocal) return undefined
  return sourceIsLocal ? 'upload' : 'download'
}

interface TransferEndpoints {
  readonly direction: FileTransferDirection
  readonly remoteHost: NetworkHost
  readonly sourceFilesystem: FilesystemState
  readonly destinationFilesystem: FilesystemState
  readonly sourceCapacity: NetworkTransferCapacity
  readonly destinationCapacity: NetworkTransferCapacity
}

function resolveTransferEndpoints(state: GameState, transfer: FileTransfer): TransferEndpoints | undefined {
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
  const sourceCapacity = direction === 'download' ? remoteHost.transferCapacity : local.network.transferCapacity
  const destinationCapacity = direction === 'download' ? local.network.transferCapacity : remoteHost.transferCapacity
  if (!isValidNetworkTransferCapacity(sourceCapacity) || !isValidNetworkTransferCapacity(destinationCapacity)) return undefined
  if (!sourceFilesystem.files.some(({ id }) => id === transfer.sourceFileId)) return undefined
  return { direction, remoteHost, sourceFilesystem, destinationFilesystem, sourceCapacity, destinationCapacity }
}

/** Retained as the narrow Download-facing resolver used by existing presentation. */
export function resolveFileTransferSource(state: GameState, transfer: FileTransfer): NetworkHost | undefined {
  const endpoints = resolveTransferEndpoints(state, transfer)
  return endpoints?.direction === 'download' ? endpoints.remoteHost : undefined
}

export function advanceFileTransfer(state: GameState, elapsedMs: number): GameState {
  const transfer = state.fileTransfer.active
  if (!transfer) return state
  const endpoints = resolveTransferEndpoints(state, transfer)
  if (!endpoints) return archiveFileTransfer({ ...state, fileTransfer: { ...state.fileTransfer, active: null } }, transfer)
  const rate = deriveEffectiveTransferRateBytesPerSecond(endpoints.sourceCapacity, endpoints.destinationCapacity)
  const bytesTransferred = Math.min(transfer.bytesTotal, transfer.bytesTransferred + rate * (Math.max(0, elapsedMs) / 1000))
  if (bytesTransferred < transfer.bytesTotal) return { ...state, fileTransfer: { ...state.fileTransfer, active: { ...transfer, bytesTransferred } } }

  const finalTransfer = { ...transfer, bytesTransferred }
  const sourceFile = endpoints.sourceFilesystem.files.find(({ id }) => id === transfer.sourceFileId)!
  const copied = copyFilesystemFileToPath(sourceFile, endpoints.destinationFilesystem, transfer.destinationPath)
  if (copied.status !== 'copied') return archiveFileTransfer({ ...state, fileTransfer: { ...state.fileTransfer, active: null } }, finalTransfer)

  const completed = endpoints.direction === 'download'
    ? { ...state, player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: copied.filesystem } }, fileTransfer: { ...state.fileTransfer, active: null } }
    : { ...state, world: { ...state.world, network: { ...state.world.network, hosts: state.world.network.hosts.map((host) => host.id === endpoints.remoteHost.id ? { ...host, filesystem: copied.filesystem } : host) } }, fileTransfer: { ...state.fileTransfer, active: null } }
  return archiveFileTransfer(completed, finalTransfer)
}

export type CancelFileTransferResult = { readonly status: 'cancelled' | 'not_found'; readonly state: GameState }

export function cancelFileTransfer(state: GameState, transferId: string): CancelFileTransferResult {
  if (state.fileTransfer.active?.id !== transferId) return { status: 'not_found', state }
  return { status: 'cancelled', state: archiveFileTransfer({ ...state, fileTransfer: { ...state.fileTransfer, active: null } }, state.fileTransfer.active) }
}

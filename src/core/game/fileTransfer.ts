import { checkDestinationPlacement, copyFilesystemFileToPath, getFilesystemFile, getFilesystemFileSizeBytes } from './filesystem'
import { deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from './networkTransferCapacity'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { FileTransfer, GameState, NetworkHost, NetworkTransferCapacity } from './types'

export function deriveDownloadDestinationPath(sourcePath: string): string {
  const basename = sourcePath.slice(sourcePath.lastIndexOf('/') + 1)
  return `/home/user/downloads/${basename}`
}

export type StartRemoteFileDownloadResult =
  | { readonly status: 'started'; readonly state: GameState; readonly transferId: string; readonly sourcePath: string; readonly destinationPath: string }
  | {
      readonly status:
        | 'session_unavailable'
        | 'invalid_path'
        | 'source_not_found'
        | 'source_not_file'
        | 'local_offline'
        | 'source_offline'
        | 'capacity_unavailable'
        | 'transfer_in_progress'
        | 'destination_exists'
        | 'destination_conflict'
      readonly state: GameState
    }

/**
 * Start a canonical FileTransfer through the current Remote Session's exact
 * source file. A RemoteSession is required only for this admission step:
 * admitting the transfer snapshots the concrete DeviceAccess relationship
 * that authorized it (`accessId`), and the resulting FileTransfer then runs
 * as its own network runtime, independent of the interactive RemoteSession
 * that started it. This only admits the transfer: it does not copy the
 * destination artifact, allocate a destination file ID, or create a
 * GameProcess. See `advanceFileTransfer` for elapsed-time progress and
 * completion.
 */
export function startRemoteFileDownload(state: GameState, sourcePath: string): StartRemoteFileDownloadResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }

  const source = getFilesystemFile(remote.target.filesystem!, sourcePath)
  if (source.status === 'invalid_path') return { status: 'invalid_path', state }
  if (source.status === 'not_found') return { status: 'source_not_found', state }
  if (source.status === 'not_file') return { status: 'source_not_file', state }

  const localDevice = state.player.localDevice
  if (localDevice.runtime.networkStatus !== 'ONLINE') return { status: 'local_offline', state }
  if (!remote.target.online) return { status: 'source_offline', state }

  const sourceCapacity = remote.target.transferCapacity
  const destinationCapacity = localDevice.network.transferCapacity
  if (!sourceCapacity || !isValidNetworkTransferCapacity(sourceCapacity) || !isValidNetworkTransferCapacity(destinationCapacity)) {
    return { status: 'capacity_unavailable', state }
  }

  if (state.fileTransfer.active) return { status: 'transfer_in_progress', state }

  const destinationPath = deriveDownloadDestinationPath(source.file.path)
  const placement = checkDestinationPlacement(localDevice.filesystem, destinationPath)
  if (placement !== 'ok') return { status: placement, state }

  const transferId = `transfer-${String(state.fileTransfer.nextId).padStart(4, '0')}`
  const transfer: FileTransfer = {
    id: transferId,
    accessId: remote.access.id,
    sourceDeviceId: remote.target.id,
    sourceFileId: source.file.id,
    destinationDeviceId: localDevice.id,
    destinationPath,
    bytesTotal: getFilesystemFileSizeBytes(source.file),
    bytesTransferred: 0,
  }

  return {
    status: 'started',
    state: { ...state, fileTransfer: { nextId: state.fileTransfer.nextId + 1, active: transfer } },
    transferId,
    sourcePath: source.file.path,
    destinationPath,
  }
}

/**
 * Resolve a FileTransfer's current source Device through its snapshotted
 * DeviceAccess authority, re-validated against current canonical state,
 * rather than through any RemoteSession. Shared by runtime advancement and
 * by Activity Monitor presentation so both derive the same canonical
 * source/authority truth instead of maintaining two implementations.
 */
export function resolveFileTransferSource(state: GameState, transfer: FileTransfer): NetworkHost | undefined {
  const access = state.deviceAccess.established.find(({ id }) => id === transfer.accessId)
  if (!access) return undefined
  if (access.sourceDeviceId !== transfer.destinationDeviceId || access.targetDeviceId !== transfer.sourceDeviceId) return undefined
  return state.world.network.hosts.find(({ id }) => id === access.targetDeviceId)
}

function resolveTransferEndpoints(state: GameState, transfer: FileTransfer): { readonly sourceHost: NetworkHost; readonly sourceCapacity: NetworkTransferCapacity } | undefined {
  if (state.player.localDevice.id !== transfer.destinationDeviceId) return undefined
  if (state.player.localDevice.runtime.networkStatus !== 'ONLINE') return undefined

  const sourceHost = resolveFileTransferSource(state, transfer)
  if (!sourceHost?.online || !sourceHost.filesystem) return undefined
  if (!sourceHost.filesystem.files.some((file) => file.id === transfer.sourceFileId)) return undefined

  const sourceCapacity = sourceHost.transferCapacity
  const destinationCapacity = state.player.localDevice.network.transferCapacity
  if (!sourceCapacity || !isValidNetworkTransferCapacity(sourceCapacity) || !isValidNetworkTransferCapacity(destinationCapacity)) return undefined

  return { sourceHost, sourceCapacity }
}

/**
 * Pure elapsed-time advancement for the single active FileTransfer. This is
 * a distinct runtime from ProcessState: it never consumes CPU compute
 * capacity or RAM, and completion never creates a GameProcess. Effective
 * rate is derived fresh on every call rather than stored. Advancement never
 * depends on any RemoteSession: ongoing validity derives solely from the
 * transfer's snapshotted DeviceAccess authority and current canonical
 * Device/filesystem state, so the transfer survives disconnect, local/remote
 * context switches, and even a later unrelated RemoteSession.
 */
export function advanceFileTransfer(state: GameState, elapsedMs: number): GameState {
  const transfer = state.fileTransfer.active
  if (!transfer) return state

  const endpoints = resolveTransferEndpoints(state, transfer)
  if (!endpoints) return { ...state, fileTransfer: { ...state.fileTransfer, active: null } }

  const rate = deriveEffectiveTransferRateBytesPerSecond(endpoints.sourceCapacity, state.player.localDevice.network.transferCapacity)
  const elapsedSeconds = Math.max(0, elapsedMs) / 1000
  const bytesTransferred = Math.min(transfer.bytesTotal, transfer.bytesTransferred + rate * elapsedSeconds)

  if (bytesTransferred < transfer.bytesTotal) {
    return { ...state, fileTransfer: { ...state.fileTransfer, active: { ...transfer, bytesTransferred } } }
  }

  const sourceFile = endpoints.sourceHost.filesystem!.files.find((file) => file.id === transfer.sourceFileId)!
  const copied = copyFilesystemFileToPath(sourceFile, state.player.localDevice.filesystem, transfer.destinationPath)
  if (copied.status !== 'copied') return { ...state, fileTransfer: { ...state.fileTransfer, active: null } }

  return {
    ...state,
    player: { ...state.player, localDevice: { ...state.player.localDevice, filesystem: copied.filesystem } },
    fileTransfer: { ...state.fileTransfer, active: null },
  }
}

export type CancelFileTransferResult = { readonly status: 'cancelled' | 'not_found'; readonly state: GameState }

/**
 * Narrow user-initiated cancellation of the current active FileTransfer.
 * Only ever clears `fileTransfer.active`: it must never create a
 * destination artifact, consume a filesystem ID, or touch DeviceAccess,
 * RemoteSession, or GameProcess state.
 */
export function cancelFileTransfer(state: GameState, transferId: string): CancelFileTransferResult {
  if (state.fileTransfer.active?.id !== transferId) return { status: 'not_found', state }
  return { status: 'cancelled', state: { ...state, fileTransfer: { ...state.fileTransfer, active: null } } }
}

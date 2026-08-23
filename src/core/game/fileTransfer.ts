import { checkDestinationPlacement, copyFilesystemFileToPath, getFilesystemFile, getFilesystemFileSizeBytes } from './filesystem'
import { deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from './networkTransferCapacity'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { FileTransfer, GameState, NetworkHost, NetworkTransferCapacity } from './types'

/**
 * Resolve the current remote source through the same canonical authority
 * chain as every other remote operation (RemoteSession -> DeviceAccess ->
 * target Device), then confirm that authority still matches this transfer's
 * recorded stable identities rather than trusting them on their own.
 */
function resolveAuthorizedTransferSource(state: GameState, transfer: FileTransfer): NetworkHost | undefined {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote || remote.session.id !== transfer.sessionId || remote.target.id !== transfer.sourceDeviceId) return undefined
  return remote.target
}

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
 * Start a canonical FileTransfer for the current Remote Session's exact
 * source file. This only admits the transfer: it does not copy the
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
    sessionId: remote.session.id,
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

function resolveTransferEndpoints(state: GameState, transfer: FileTransfer): { readonly sourceHost: NetworkHost; readonly sourceCapacity: NetworkTransferCapacity } | undefined {
  if (state.player.localDevice.id !== transfer.destinationDeviceId) return undefined
  if (state.player.localDevice.runtime.networkStatus !== 'ONLINE') return undefined

  const sourceHost = resolveAuthorizedTransferSource(state, transfer)
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
 * rate is derived fresh on every call rather than stored.
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

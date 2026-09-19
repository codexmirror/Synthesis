import { cancelFileTransfer, startRemoteFileDownload, startRemoteFileUpload, type CancelFileTransferResult, type StartRemoteFileDownloadResult, type StartRemoteFileUploadResult } from '../core/game/fileTransfer'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createFileTransferActions(accessor: GameStateAccessor) {
  return {
    startRemoteFileDownload(sourcePath: string): StartRemoteFileDownloadResult {
      return commitResult(accessor, startRemoteFileDownload(accessor.read(), sourcePath))
    },
    startRemoteFileUpload(sourcePath: string, destinationPath: string): StartRemoteFileUploadResult {
      return commitResult(accessor, startRemoteFileUpload(accessor.read(), sourcePath, destinationPath))
    },
    cancelFileTransfer(transferId: string): CancelFileTransferResult {
      return commitResult(accessor, cancelFileTransfer(accessor.read(), transferId))
    },
  }
}

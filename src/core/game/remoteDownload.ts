import { copyFilesystemFileToPath, getFilesystemFile } from './filesystem'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { GameState } from './types'

export type DownloadRemoteFileResult =
  | { readonly status: 'downloaded'; readonly state: GameState; readonly sourcePath: string; readonly destinationPath: string }
  | { readonly status: 'session_unavailable' | 'invalid_path' | 'source_not_found' | 'source_not_file' | 'destination_exists' | 'destination_conflict'; readonly state: GameState }

export function deriveDownloadDestinationPath(sourcePath: string): string {
  const basename = sourcePath.slice(sourcePath.lastIndexOf('/') + 1)
  return `/home/user/downloads/${basename}`
}

export function downloadRemoteFile(state: GameState, sourcePath: string): DownloadRemoteFileResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }

  const source = getFilesystemFile(remote.target.filesystem!, sourcePath)
  if (source.status === 'invalid_path') return { status: 'invalid_path', state }
  if (source.status === 'not_found') return { status: 'source_not_found', state }
  if (source.status === 'not_file') return { status: 'source_not_file', state }

  const destinationPath = deriveDownloadDestinationPath(source.file.path)
  const copied = copyFilesystemFileToPath(source.file, state.player.localDevice.filesystem, destinationPath)
  if (copied.status !== 'copied') return { status: copied.status, state }

  const nextState: GameState = {
    ...state,
    player: {
      ...state.player,
      localDevice: { ...state.player.localDevice, filesystem: copied.filesystem },
    },
  }
  return { status: 'downloaded', state: nextState, sourcePath: source.file.path, destinationPath }
}

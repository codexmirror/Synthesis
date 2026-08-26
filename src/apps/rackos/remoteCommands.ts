import { listDirectory, readTextFile } from '../../core/game/filesystem'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import type { StartRemoteFileDownloadResult, StartRemoteFileUploadResult } from '../../core/game/fileTransfer'
import { isNodeMinerAvailable } from '../../core/game/nodeMiner'
import { NODE_MINER_TERMINAL_DESCRIPTION, runNodeMinerTerminal, type NodeMinerTerminalOperations } from '../nodeMinerTerminal'
import { describeUploadFailure } from '../uploadFailure'

export type RemoteCommandResult = { readonly output: readonly string[]; readonly clear?: boolean; readonly disconnect?: boolean }

/**
 * The canonical gameplay operations this command surface delegates to. The
 * Terminal owns none of them: it parses a compact line, calls the operation
 * that owns the behavior, and prints what that operation reported.
 */
export interface RemoteCommandOperations {
  readonly startRemoteFileDownload: (path: string) => StartRemoteFileDownloadResult
  readonly startRemoteFileUpload: (sourcePath: string, destinationPath: string) => StartRemoteFileUploadResult
  readonly nodeMiner: NodeMinerTerminalOperations
}

export function runRemoteCommand(context: ActiveRemoteTarget, source: string, operations: RemoteCommandOperations): RemoteCommandResult {
  const { startRemoteFileDownload, startRemoteFileUpload } = operations
  const [name = '', ...args] = source.trim().split(/\s+/)
  const nodeMinerAvailable = isNodeMinerAvailable(context.target)
  const nodeMinerSoftware = context.target.installedSoftware?.find(({ id }) => id === 'node-miner')
  if (name === 'help') return { output: [`${context.target.firmware!.name.toUpperCase()} ${context.target.firmware!.version}`, 'help  clear  ip  ls  cat  download  upload  disconnect', ...(nodeMinerAvailable && nodeMinerSoftware ? ['', `${nodeMinerSoftware.name.toUpperCase()} ${nodeMinerSoftware.version}`, `node-miner — ${NODE_MINER_TERMINAL_DESCRIPTION}`] : [])] }
  if (name === 'clear') return { output: [], clear: true }
  if (name === 'ip') return { output: [context.target.ip] }
  if (name === 'disconnect') return { output: [], disconnect: true }
  if (name === 'ls') {
    const path = args[0] ?? '/'
    const result = listDirectory(context.target.filesystem!, path)
    return { output: result.status === 'ok' ? result.entries.map(({ name: entry, type }) => type === 'directory' ? `${entry}/` : entry) : [result.status.toUpperCase().replaceAll('_', ' ')] }
  }
  if (name === 'cat') {
    if (!args[0]) return { output: ['USAGE: cat /absolute/path'] }
    const result = readTextFile(context.target.filesystem!, args[0])
    if (result.status === 'not_text_file') return { output: ['NOT A TEXT FILE'] }
    return { output: result.status === 'ok' ? [result.content] : [result.status.toUpperCase().replaceAll('_', ' ')] }
  }
  if (name === 'download') {
    if (!args[0] || args.length !== 1) return { output: ['USAGE: download /absolute/file/path'] }
    const result = startRemoteFileDownload(args[0])
    if (result.status === 'started') return { output: ['DOWNLOAD STARTED', result.sourcePath, `→ ${result.destinationPath}`] }
    const failures: Record<Exclude<StartRemoteFileDownloadResult['status'], 'started'>, string> = {
      session_unavailable: 'SESSION UNAVAILABLE', invalid_path: 'INVALID PATH', source_not_found: 'FILE NOT FOUND', source_not_file: 'NOT A FILE',
      local_offline: 'LOCAL DEVICE OFFLINE', source_offline: 'SOURCE UNAVAILABLE', capacity_unavailable: 'TRANSFER CAPACITY UNAVAILABLE',
      transfer_in_progress: 'TRANSFER IN PROGRESS', destination_exists: 'DESTINATION ALREADY EXISTS', destination_conflict: 'DESTINATION CONFLICT',
    }
    return { output: [failures[result.status]] }
  }
  if (name === 'upload') {
    if (args.length !== 2) return { output: ['USAGE: upload /absolute/local/file /absolute/remote/file'] }
    const result = startRemoteFileUpload(args[0], args[1])
    if (result.status === 'started') return { output: ['UPLOAD STARTED', result.sourcePath, `→ ${result.destinationPath}`] }
    return { output: [describeUploadFailure(result.status)] }
  }
  if (name === 'node-miner' && nodeMinerAvailable) return { output: runNodeMinerTerminal(args, operations.nodeMiner) }
  return { output: ['COMMAND NOT FOUND'] }
}

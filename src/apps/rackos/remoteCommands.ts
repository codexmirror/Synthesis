import { listDirectory, readTextFile } from '../../core/game/filesystem'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'
import type { StartRemoteFileDownloadResult, StartRemoteFileUploadResult } from '../../core/game/fileTransfer'

export type RemoteCommandResult = { readonly output: readonly string[]; readonly clear?: boolean; readonly disconnect?: boolean }

export function runRemoteCommand(context: ActiveRemoteTarget, source: string, startRemoteFileDownload: (path: string) => StartRemoteFileDownloadResult, startRemoteFileUpload: (sourcePath: string, destinationPath: string) => StartRemoteFileUploadResult): RemoteCommandResult {
  const [name = '', ...args] = source.trim().split(/\s+/)
  if (name === 'help') return { output: ['help  clear  ip  ls  cat  download  upload  disconnect'] }
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
    const failures: Record<Exclude<StartRemoteFileUploadResult['status'], 'started'>, string> = {
      session_unavailable: 'SESSION UNAVAILABLE', invalid_path: 'INVALID PATH', source_not_found: 'FILE NOT FOUND', source_not_file: 'NOT A FILE',
      local_offline: 'LOCAL DEVICE OFFLINE', destination_offline: 'DESTINATION UNAVAILABLE', capacity_unavailable: 'TRANSFER CAPACITY UNAVAILABLE',
      transfer_in_progress: 'TRANSFER IN PROGRESS', destination_exists: 'DESTINATION ALREADY EXISTS', destination_conflict: 'DESTINATION CONFLICT',
    }
    return { output: [failures[result.status]] }
  }
  return { output: ['COMMAND NOT FOUND'] }
}

import { listDirectory, readTextFile } from '../../core/game/filesystem'
import type { ActiveRemoteTarget } from '../../core/game/remoteSession'

export type RemoteCommandResult = { readonly output: readonly string[]; readonly clear?: boolean; readonly disconnect?: boolean }

export function runRemoteCommand(context: ActiveRemoteTarget, source: string): RemoteCommandResult {
  const [name = '', ...args] = source.trim().split(/\s+/)
  if (name === 'help') return { output: ['help  clear  ip  ls  cat  disconnect'] }
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
    return { output: result.status === 'ok' ? [result.content] : [result.status.toUpperCase().replaceAll('_', ' ')] }
  }
  return { output: ['COMMAND NOT FOUND'] }
}

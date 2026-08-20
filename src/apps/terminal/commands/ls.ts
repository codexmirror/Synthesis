import type { TerminalCommand } from '../commandTypes'

export const lsCommand: TerminalCommand = {
  description: 'List a local absolute directory path',
  run: ({ filesystem }, args) => {
    if (args.length > 1) return { type: 'output', lines: ['Usage: ls [absolute-path]'] }
    const result = filesystem.list(args[0] ?? '/')
    if (result.status === 'invalid_path') return { type: 'output', lines: ['INVALID PATH'] }
    if (result.status === 'not_directory') return { type: 'output', lines: ['NOT A DIRECTORY'] }
    if (result.status === 'not_found') return { type: 'output', lines: ['DIRECTORY NOT FOUND'] }
    return { type: 'output', lines: result.entries.map((entry) => entry.type === 'directory' ? `${entry.name}/` : entry.name) }
  },
}

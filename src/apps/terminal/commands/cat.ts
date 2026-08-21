import type { TerminalCommand } from '../commandTypes'

export const catCommand: TerminalCommand = {
  description: 'Read a local text file by absolute path',
  run: ({ filesystem }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: cat <absolute-file-path>'] }
    const result = filesystem.readText(args[0])
    if (result.status === 'invalid_path') return { type: 'output', lines: ['INVALID PATH'] }
    if (result.status === 'not_file') return { type: 'output', lines: ['NOT A FILE'] }
    if (result.status === 'not_text_file') return { type: 'output', lines: ['NOT A TEXT FILE'] }
    if (result.status === 'not_found') return { type: 'output', lines: ['FILE NOT FOUND'] }
    return { type: 'output', lines: result.content.split('\n') }
  },
}

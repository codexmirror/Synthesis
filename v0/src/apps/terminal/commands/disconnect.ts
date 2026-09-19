import type { TerminalCommand } from '../commandTypes'

export const disconnectCommand: TerminalCommand = {
  description: 'Close the active remote session',
  run: ({ operations }, args) => {
    if (args.length) return { type: 'output', lines: ['USAGE: disconnect'] }
    return { type: 'output', lines: [operations.disconnectRemote().status === 'disconnected' ? 'REMOTE SESSION ENDED' : 'NO ACTIVE REMOTE SESSION'] }
  },
}

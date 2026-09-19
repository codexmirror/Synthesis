import type { TerminalCommand } from '../commandTypes'

export const connectCommand: TerminalCommand = {
  description: '<ipv4>  Open a remote session using established access',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['USAGE: connect <ipv4>'] }
    const result = operations.connectAddress(args[0])
    const lines = result.status === 'connected' ? ['REMOTE SESSION ESTABLISHED', args[0], 'USER']
      : result.status === 'already_connected' ? ['REMOTE SESSION ALREADY ACTIVE']
      : result.status === 'session_active' ? ['ANOTHER REMOTE SESSION IS ACTIVE']
      : result.status === 'access_required' ? ['ACCESS REQUIRED']
      : result.status === 'target_not_available' ? ['TARGET NOT AVAILABLE']
      : ['TARGET NOT KNOWN']
    return { type: 'output', lines }
  },
}

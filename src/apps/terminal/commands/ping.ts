import type { TerminalCommand } from '../commandTypes'

export const pingCommand: TerminalCommand = {
  description: 'Check whether a Device responds at an IPv4 address',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: ping <ipv4>'] }
    const result = operations.pingTarget?.(args[0])
    if (!result || result.status === 'invalid_address') return { type: 'output', lines: ['Usage: ping <ipv4>'] }
    if (result.status === 'software_unavailable') return { type: 'output', lines: ['NODESCAN NOT INSTALLED'] }
    if (result.status === 'no_response') return { type: 'output', lines: [`Pinging ${result.address}...`, '', 'NO RESPONSE'] }
    return { type: 'output', lines: [`Pinging ${result.address}...`, '', 'RESPONSE'] }
  },
}

import type { TerminalCommand } from '../commandTypes'

export const pingCommand: TerminalCommand = {
  description: 'Check whether a Device responds at an IPv4 address',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: ping <ipv4>'] }
    const observed = operations.pingTarget?.(args[0])
    const format = (result: Awaited<NonNullable<typeof observed>>) => {
      if (result.status === 'invalid_address') return { type: 'output' as const, lines: ['Usage: ping <ipv4>'] }
      if (result.status === 'software_unavailable') return { type: 'output' as const, lines: ['NODESCAN NOT INSTALLED'] }
      if (result.status === 'no_response') return { type: 'output' as const, lines: [`Pinging ${result.address}...`, '', 'NO RESPONSE'] }
      return { type: 'output' as const, lines: [`Pinging ${result.address}...`, '', 'RESPONSE'] }
    }
    if (!observed) return { type: 'output', lines: ['Usage: ping <ipv4>'] }
    return observed instanceof Promise ? observed.then(format) : format(observed)
  },
}

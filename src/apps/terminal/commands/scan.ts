import type { TerminalCommand } from '../commandTypes'

export const scanCommand: TerminalCommand = {
  description: 'Scan one IPv4 target',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: scan <ipv4>'] }

    const [target] = args
    const result = operations.scanTarget(target)
    if (result.status === 'invalid_target') {
      return { type: 'output', lines: [`Invalid target: ${result.input}`] }
    }

    const lines = [`Scanning ${result.address}...`, '']
    if (result.status === 'no_response') return { type: 'output', lines: [...lines, 'NO RESPONSE'] }
    return { type: 'output', lines: [...lines, 'HOST ONLINE', `Address: ${result.address}`] }
  },
}

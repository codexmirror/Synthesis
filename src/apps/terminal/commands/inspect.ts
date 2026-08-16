import type { TerminalCommand } from '../commandTypes'

export const inspectCommand: TerminalCommand = {
  description: 'Inspect one responding IPv4 target',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: inspect <ipv4>'] }

    const result = operations.inspectTarget(args[0])
    if (result.status === 'invalid_target') {
      return { type: 'output', lines: [`Invalid target: ${result.input}`] }
    }
    if (result.status === 'no_response') return { type: 'output', lines: ['NO RESPONSE'] }

    const lines = ['TARGET', `Address: ${result.address}`, `Scope:   ${result.scope.toUpperCase()}`, `Status:  ${result.networkStatus}`]
    if (result.scope === 'self') {
      lines.push(`CPU:     ${result.hardware.cpu}`, `RAM:     ${result.hardware.ram}`)
      if (result.network) lines.push(`Network: ${result.network.name}`)
    }
    return { type: 'output', lines }
  },
}

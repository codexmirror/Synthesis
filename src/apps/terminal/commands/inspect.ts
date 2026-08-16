import type { TerminalCommand } from '../commandTypes'

export const inspectCommand: TerminalCommand = {
  description: 'Show properties of one target',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: inspect <ipv4|network-name>'] }

    const result = operations.inspectTarget(args[0])
    if (result.status === 'unknown_target') {
      return { type: 'output', lines: [`Unknown inspect target: ${result.input}`] }
    }
    if (result.status === 'no_response') return { type: 'output', lines: ['NO RESPONSE'] }
    if (result.status === 'network') {
      return { type: 'output', lines: ['NETWORK', `Name: ${result.networkName}`, `Connected: ${result.connected ? 'YES' : 'NO'}`] }
    }

    const lines = ['DEVICE', `Address: ${result.address}`, `Scope:   ${result.scope.toUpperCase()}`, `Status:  ${result.networkStatus}`]
    if (result.scope === 'self') {
      lines.push(`CPU:     ${result.hardware.cpu}`, `RAM:     ${result.hardware.ram}`)
    }
    return { type: 'output', lines }
  },
}

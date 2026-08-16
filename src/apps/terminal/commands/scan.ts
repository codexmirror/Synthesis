import type { TerminalCommand } from '../commandTypes'

export const scanCommand: TerminalCommand = {
  description: 'Discover relationships and connected targets',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: scan <ipv4|network-name>'] }

    const [target] = args
    const result = operations.scanTarget(target)
    if (result.status === 'unknown_target') {
      return { type: 'output', lines: [`Unknown scan target: ${result.input}`] }
    }
    if (result.status === 'network') {
      return { type: 'output', lines: [`Scanning ${result.networkName}...`, '', `DEVICES FOUND: ${result.devices.length}`, '', ...result.devices.map(({ address }) => address)] }
    }
    const lines = [`Scanning ${result.address}...`, '']
    if (result.status === 'no_response') return { type: 'output', lines: [...lines, 'NO RESPONSE'] }
    if (result.networks.length === 0) return { type: 'output', lines: [...lines, 'NO RELATIONSHIPS FOUND'] }
    return { type: 'output', lines: [...lines, `RELATIONSHIPS FOUND: ${result.networks.length}`, '', ...result.networks.map(({ name }) => `Network: ${name}`)] }
  },
}

import { target as targetFragment, text, type TerminalCommand, type TerminalLine } from '../commandTypes'

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
      return { type: 'output', lines: [`Scanning ${result.networkName}...`, '', `DEVICES FOUND: ${result.devices.length}`, '', ...result.devices.map(({ address }) => [targetFragment(address)])] }
    }
    const lines: TerminalLine[] = [`Scanning ${result.address}...`, '']
    if (result.status === 'no_response') return { type: 'output', lines: [...lines, 'NO RESPONSE'] }
    if (result.networks.length === 0 && result.services.length === 0) {
      return { type: 'output', lines: [...lines, 'NO RELATIONSHIPS OR SERVICES FOUND'] }
    }
    lines.push(`RELATIONSHIPS FOUND: ${result.networks.length}`)
    if (result.networks.length > 0) lines.push('', ...result.networks.map(({ name }) => [text('Network: '), targetFragment(name)]))
    lines.push('', `SERVICES FOUND: ${result.services.length}`)
    for (const service of result.services) {
      lines.push('', service.name, `Port: ${service.port}`, `Protocol: ${service.protocol}`)
    }
    return { type: 'output', lines }
  },
}

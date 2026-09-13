import { target as targetFragment, text, type CommandResult, type TerminalCommand, type TerminalLine } from '../commandTypes'
import { isIpv4EndpointSyntax } from '../../../core/game/networkTarget'

export const scanCommand: TerminalCommand = {
  description: 'Discover devices, relationships, and exposed services',
  run: ({ operations, localDevice }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: scan <ipv4|cidr|network-name>'] }

    const [target] = args
    if (isIpv4EndpointSyntax(target)) return { type: 'output', lines: ['INVALID TARGET TYPE', '', `${target} is a service endpoint.`, '', 'scan accepts IPv4 devices and network names.', 'Service endpoints can be investigated with analyze.'] }
    const observed = operations.scanTarget(target)
    const format = (result: Awaited<typeof observed>): CommandResult => {
    if (result.status === 'software_unavailable') return { type: 'output', lines: ['NODESCAN NOT INSTALLED'] }
    if (result.status === 'unknown_target') {
      return { type: 'output', lines: [`Unknown scan target: ${result.input}`] }
    }
    if (result.status === 'network') {
      return { type: 'output', lines: [`Scanning ${result.networkName}...`, '', `DEVICES FOUND: ${result.devices.length}`, '', ...result.devices.map(({ address, scope }) => [targetFragment(address, scope === 'self' ? 'local' : 'external')])] }
    }
    const targetScope = result.address === localDevice.ip ? 'local' : 'external'
    const lines: TerminalLine[] = [`Scanning ${result.address}...`, '']
    if (result.status === 'no_response') return { type: 'output', lines: [...lines, 'NO RESPONSE'] }
    // A Gateway's own currently forwarded exposures are reachable right here, at this same public
    // address: real observed public services, exactly like the Gateway's own hosted Service, just never
    // naming which private backend Device answers behind any one of them.
    const observedServices = [
      ...result.services.map((service) => ({ service, targetId: result.targetId })),
      ...(result.exposedBackends ?? []).map(({ targetDeviceId, service }) => ({ service, targetId: targetDeviceId })),
    ]
    if (result.networks.length === 0 && observedServices.length === 0) {
      return { type: 'output', lines: [...lines, 'NO RELATIONSHIPS OR SERVICES FOUND'] }
    }
    lines.push(`RELATIONSHIPS FOUND: ${result.networks.length}`)
    // A Host Scan never earns the Network's own display name — only stable routing identity — so it presents a
    // neutral form here, with its actionable routing and default-gateway values.
    if (result.networks.length > 0) lines.push('', ...result.networks.flatMap((network) => [
      network.cidr ? [text('Network: '), targetFragment(network.cidr)] : [text('Network: UNKNOWN NETWORK')],
      ...(network.gateway ? [[text('Gateway: '), targetFragment(network.gateway.address, network.gateway.scope === 'lan' ? 'local' : 'external')] as TerminalLine] : []),
    ]))
    lines.push('', `SERVICES FOUND: ${observedServices.length}`)
    for (const { service, targetId } of observedServices) {
      lines.push('', service.name, [text('Endpoint: '), targetFragment(`${result.address}:${service.port}`, targetScope)], `Protocol: ${service.protocol}`)
      for (const label of operations.knownWeaknesses(targetId, service.id)) lines.push(`Known weakness: ${label}`)
    }
    return { type: 'output' as const, lines }
    }
    return observed instanceof Promise ? observed.then(format) : format(observed)
  },
}

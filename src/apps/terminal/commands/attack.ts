import { isValidIpv4 } from '../../../core/game/networkTarget'
import { type TerminalCommand } from '../commandTypes'

function isServiceEndpoint(value: string): boolean {
  const separator = value.lastIndexOf(':')
  if (separator < 1 || value.indexOf(':') !== separator) return false
  const port = value.slice(separator + 1)
  return isValidIpv4(value.slice(0, separator)) && /^\d+$/.test(port) && Number(port) >= 1 && Number(port) <= 65535
}

export const attackCommand: TerminalCommand = {
  description: 'Attempt a known attack method against an observed service',
  run: ({ operations }, args) => {
    if (args.length !== 1 || !isServiceEndpoint(args[0])) return { type: 'output', lines: ['Usage: attack <ipv4:port>', 'Attack requires an observed service endpoint.'] }
    const endpoint = args[0]
    const result = operations.attackEndpoint(endpoint)
    if (result.status === 'already_running') return { type: 'output', lines: ['ATTEMPT ALREADY RUNNING'] }
    if (result.status === 'access_established') return { type: 'output', lines: ['ACCESS ALREADY ESTABLISHED'] }
    if (result.status === 'submission_enabled') return { type: 'output', lines: ['SUBMISSION ALREADY ENABLED'] }
    if (result.status === 'insufficient_memory') return { type: 'output', lines: ['INSUFFICIENT MEMORY', `${result.requiredMiB} MiB required`, `${Math.floor(result.availableMiB)} MiB available`] }
    if (result.status === 'endpoint_not_found') return { type: 'output', lines: ['ENDPOINT NOT AVAILABLE'] }
    if (result.status === 'not_available') return { type: 'output', lines: ['NO KNOWN ATTACK METHOD'] }
    if (result.status === 'started') return { type: 'process', processId: result.processId }
    return { type: 'output', lines: ['ATTEMPT FAILED'] }
  },
}

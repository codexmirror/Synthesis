import { target, text, type TerminalCommand } from '../commandTypes'

export const analyzeCommand: TerminalCommand = {
  description: 'Investigate a service endpoint',
  run: ({ operations }, args) => {
    if (args.length !== 1) return { type: 'output', lines: ['Usage: analyze <ipv4:port>'] }
    const endpoint = args[0]
    const result = operations.analyzeEndpoint(endpoint)
    const status = result.status
    if (status === 'invalid_endpoint') return { type: 'output', lines: ['Usage: analyze <ipv4:port>'] }
    if (status === 'endpoint_not_found') return { type: 'output', lines: [`Endpoint not represented: ${endpoint}`] }
    if (status === 'unavailable') return { type: 'output', lines: ['NODESCAN NOT INSTALLED'] }
    if (status === 'already_running') return { type: 'output', lines: ['ANALYSIS ALREADY RUNNING'] }
    if (status === 'insufficient_memory') return { type: 'output', lines: ['INSUFFICIENT MEMORY'] }
    if (status === 'started') return { type: 'process', processId: result.processId }
    return { type: 'output', lines: ['ANALYSIS FAILED'] }
  },
}

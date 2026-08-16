import type { TerminalCommand } from '../commandTypes'

export const statusCommand: TerminalCommand = {
  description: 'Show system status',
  run: ({ runtime }) => ({ type: 'output', lines: [
    `CPU: ${runtime.cpuLoad}%`,
    `RAM: ${runtime.ramUsage}%`,
    `Network: ${runtime.networkStatus}`,
  ] }),
}

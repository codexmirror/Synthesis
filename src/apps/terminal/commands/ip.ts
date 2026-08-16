import type { TerminalCommand } from '../commandTypes'

export const ipCommand: TerminalCommand = {
  description: 'Show local address',
  run: ({ localDevice }) => ({ type: 'output', lines: [`Local address: ${localDevice.ip}`] }),
}

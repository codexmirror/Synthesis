import type { TerminalCommand } from '../commandTypes'

export const ipCommand: TerminalCommand = {
  description: 'Show local address',
  run: ({ player }) => ({ type: 'output', lines: [`Local address: ${player.ip}`] }),
}

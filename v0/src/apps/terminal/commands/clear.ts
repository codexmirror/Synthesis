import type { TerminalCommand } from '../commandTypes'

export const clearCommand: TerminalCommand = {
  description: 'Clear terminal output',
  run: () => ({ type: 'clear' }),
}

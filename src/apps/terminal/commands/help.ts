import type { TerminalCommand } from '../commandTypes'

export function createHelpCommand(commandNames: () => string[]): TerminalCommand {
  return {
    description: 'List available commands',
    run: () => ({ type: 'output', lines: ['Available commands:', '', ...commandNames()] }),
  }
}

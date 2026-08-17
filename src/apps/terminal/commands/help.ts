import type { TerminalCommand } from '../commandTypes'

export function createHelpCommand(commands: () => readonly [string, TerminalCommand][]): TerminalCommand {
  return {
    description: 'List available commands',
    run: () => ({ type: 'output', lines: ['Available commands:', '', ...commands().map(([name, command]) => `${name} — ${command.description}`)] }),
  }
}

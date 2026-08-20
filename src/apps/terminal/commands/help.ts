import type { TerminalCommand } from '../commandTypes'

export interface HelpGroup {
  readonly heading: string
  readonly commands: readonly [string, TerminalCommand][]
}

export function createHelpCommand(groups: () => readonly HelpGroup[]): TerminalCommand {
  return {
    description: 'List available commands',
    run: () => ({
      type: 'output',
      lines: ['AVAILABLE COMMANDS', ...groups().flatMap(({ heading, commands }) => [
        '', heading, '', ...commands.map(([name, command]) => `${name} — ${command.description}`),
      ])],
    }),
  }
}

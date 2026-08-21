import type { CommandContext, TerminalCommand } from '../commandTypes'

export interface HelpGroup {
  readonly heading: string
  readonly commands: readonly [string, TerminalCommand][]
}

export function createHelpCommand(groups: (context: CommandContext) => readonly HelpGroup[]): TerminalCommand {
  return {
    description: 'List available commands',
    run: (context) => ({
      type: 'output',
      lines: ['AVAILABLE COMMANDS', ...groups(context).flatMap(({ heading, commands }) => [
        '', heading, '', ...commands.map(([name, command]) => `${name} — ${command.description}`),
      ])],
    }),
  }
}

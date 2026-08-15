import type { RuntimeState } from '../../core/game/types'
import type { ParsedCommand } from './parser'

export interface CommandContext {
  readonly player: {
    readonly ip: string
  }
  readonly runtime: Readonly<RuntimeState>
}

export type CommandResult =
  | { type: 'output'; lines: string[] }
  | { type: 'clear' }

export interface TerminalCommand {
  description: string
  run: (context: CommandContext, args: string[]) => CommandResult
}

export const commands: Record<string, TerminalCommand> = {
  help: {
    description: 'List available commands',
    run: () => ({ type: 'output', lines: ['Available commands:', '', ...Object.keys(commands)] }),
  },
  clear: {
    description: 'Clear terminal output',
    run: () => ({ type: 'clear' }),
  },
  ip: {
    description: 'Show local address',
    run: ({ player }) => ({ type: 'output', lines: [`Local address: ${player.ip}`] }),
  },
  status: {
    description: 'Show system status',
    run: ({ runtime }) => ({ type: 'output', lines: [
      `CPU: ${runtime.cpuLoad}%`,
      `RAM: ${runtime.ramUsage}%`,
      `Network: ${runtime.networkStatus}`,
    ] }),
  },
}

export function dispatchCommand(command: ParsedCommand, context: CommandContext): CommandResult {
  if (!command.name) return { type: 'output', lines: [] }
  const registeredCommand = commands[command.name]
  return registeredCommand
    ? registeredCommand.run(context, command.args)
    : { type: 'output', lines: [`Command not found: ${command.name}. Type "help" for available commands.`] }
}

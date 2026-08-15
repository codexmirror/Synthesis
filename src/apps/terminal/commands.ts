import type { GameState } from '../../core/game/types'
import type { ParsedCommand } from './parser'

export interface CommandContext {
  state: Readonly<GameState>
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
    run: () => ({ type: 'output', lines: ['Available commands:', '', 'help', 'clear', 'ip', 'status'] }),
  },
  clear: {
    description: 'Clear terminal output',
    run: () => ({ type: 'clear' }),
  },
  ip: {
    description: 'Show local address',
    run: ({ state }) => ({ type: 'output', lines: [`Local address: ${state.player.ip}`] }),
  },
  status: {
    description: 'Show system status',
    run: ({ state }) => ({ type: 'output', lines: [
      `CPU: ${state.system.runtime.cpuLoad}%`,
      `RAM: ${state.system.runtime.ramUsage}%`,
      `Network: ${state.system.runtime.networkStatus}`,
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

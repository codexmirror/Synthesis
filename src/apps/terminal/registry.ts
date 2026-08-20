import type { ParsedCommand } from './parser'
import type { CommandContext, CommandResult, TerminalCommand } from './commandTypes'
import { clearCommand } from './commands/clear'
import { createHelpCommand } from './commands/help'
import { ipCommand } from './commands/ip'
import { statusCommand } from './commands/status'
import { scanCommand } from './commands/scan'
import { inspectCommand } from './commands/inspect'
import { analyzeCommand } from './commands/analyze'
import { attackCommand } from './commands/attack'
import { lsCommand } from './commands/ls'
import { catCommand } from './commands/cat'

export const commands: Record<string, TerminalCommand> = {
  help: createHelpCommand(() => Object.entries(commands)),
  clear: clearCommand,
  ip: ipCommand,
  status: statusCommand,
  scan: scanCommand,
  inspect: inspectCommand,
  analyze: analyzeCommand,
  attack: attackCommand,
  ls: lsCommand,
  cat: catCommand,
}

export function dispatchCommand(command: ParsedCommand, context: CommandContext): CommandResult | Promise<CommandResult> {
  if (!command.name) return { type: 'output', lines: [] }
  const registeredCommand = commands[command.name]
  return registeredCommand
    ? registeredCommand.run(context, command.args)
    : { type: 'output', lines: [`Command not found: ${command.name}. Type "help" for available commands.`] }
}

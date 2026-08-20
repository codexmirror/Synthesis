import type { ParsedCommand } from './parser'
import type { CommandContext, CommandResult, TerminalCommand } from './commandTypes'
import { clearCommand } from './commands/clear'
import { createHelpCommand } from './commands/help'
import { ipCommand } from './commands/ip'
import { statusCommand } from './commands/status'
import { scanCommand } from './commands/scan'
import { analyzeCommand } from './commands/analyze'
import { attackCommand } from './commands/attack'
import { lsCommand } from './commands/ls'
import { catCommand } from './commands/cat'
import { connectCommand } from './commands/connect'
import { disconnectCommand } from './commands/disconnect'

function commandEntries(names: readonly string[]): [string, TerminalCommand][] {
  return names.map((name) => [name, commands[name]])
}

export const commands: Record<string, TerminalCommand> = {
  help: createHelpCommand(() => [
    { heading: 'NODE-OS', commands: commandEntries(['help', 'clear', 'ip', 'status', 'ls', 'cat', 'connect', 'disconnect']) },
    { heading: 'NODESCAN', commands: commandEntries(['scan', 'analyze']) },
    { heading: 'BASIC CREDENTIAL TOOLKIT', commands: [['attack', commands.attack]] },
  ]),
  clear: clearCommand,
  ip: ipCommand,
  status: statusCommand,
  scan: scanCommand,
  analyze: analyzeCommand,
  attack: attackCommand,
  ls: lsCommand,
  cat: catCommand,
  connect: connectCommand,
  disconnect: disconnectCommand,
}

export function dispatchCommand(command: ParsedCommand, context: CommandContext): CommandResult | Promise<CommandResult> {
  if (!command.name) return { type: 'output', lines: [] }
  const registeredCommand = commands[command.name]
  return registeredCommand
    ? registeredCommand.run(context, command.args)
    : { type: 'output', lines: [`Command not found: ${command.name}. Type "help" for available commands.`] }
}

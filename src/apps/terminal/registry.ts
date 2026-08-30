import type { ParsedCommand } from './parser'
import type { CommandContext, CommandResult, TerminalCommand } from './commandTypes'
import { clearCommand } from './commands/clear'
import { createHelpCommand } from './commands/help'
import { ipCommand } from './commands/ip'
import { statusCommand } from './commands/status'
import { scanCommand } from './commands/scan'
import { pingCommand } from './commands/ping'
import { analyzeCommand } from './commands/analyze'
import { attackCommand } from './commands/attack'
import { lsCommand } from './commands/ls'
import { catCommand } from './commands/cat'
import { connectCommand } from './commands/connect'
import { disconnectCommand } from './commands/disconnect'
import { installCommand } from './commands/install'
import { inspectCommand } from './commands/inspect'
import { nodeMinerCommand } from './commands/nodeMiner'
import { nodeScanSupportsInspect } from '../../core/game/software'
import { findInstalledFlipper } from '../../core/game/flipper'
import type { NodeScanInstallation } from '../../core/game/types'

function commandEntries(names: readonly string[]): [string, TerminalCommand][] {
  return names.map((name) => [name, commands[name]])
}

export const commands: Record<string, TerminalCommand> = {
  help: createHelpCommand(({ localDevice, nodeMiner }) => {
    const nodeScan = localDevice.installedSoftware.find((software): software is NodeScanInstallation => software.id === 'nodescan')
    const flipper = findInstalledFlipper(localDevice)
    const nodeMinerSoftware = localDevice.installedSoftware.find(({ id }) => id === 'node-miner')
    return [
      { heading: 'NODE-OS', commands: commandEntries(['help', 'clear', 'ip', 'status', 'ls', 'cat', 'install', 'connect', 'disconnect']) },
      ...(nodeScan?.id === 'nodescan' ? [{ heading: `${nodeScan.name.toUpperCase()} ${nodeScan.version}${nodeScan.channel ? ` ${nodeScan.channel.toUpperCase()}` : ''}`, commands: commandEntries(nodeScanSupportsInspect(nodeScan) ? ['ping', 'scan', 'inspect', 'analyze'] : ['ping', 'scan', 'analyze']) }] : []),
      // One offensive product now supplies `attack`. Which techniques it can
      // actually execute is the installed build's integrated module state,
      // resolved by the canonical operation rather than by this listing.
      ...(flipper?.integratedModules.length ? [{ heading: `${flipper.name.toUpperCase()} ${flipper.version}`, commands: [['attack', commands.attack] as [string, TerminalCommand]] }] : []),
      ...(nodeMiner.available && nodeMinerSoftware ? [{ heading: `${nodeMinerSoftware.name.toUpperCase()} ${nodeMinerSoftware.version}`, commands: [['node-miner', commands['node-miner']] as [string, TerminalCommand]] }] : []),
    ]
  }),
  clear: clearCommand,
  ip: ipCommand,
  status: statusCommand,
  ping: pingCommand,
  scan: scanCommand,
  inspect: inspectCommand,
  analyze: analyzeCommand,
  attack: attackCommand,
  ls: lsCommand,
  cat: catCommand,
  install: installCommand,
  connect: connectCommand,
  disconnect: disconnectCommand,
  'node-miner': nodeMinerCommand,
}

export function dispatchCommand(command: ParsedCommand, context: CommandContext): CommandResult | Promise<CommandResult> {
  if (!command.name) return { type: 'output', lines: [] }
  const registeredCommand = commands[command.name]
  return registeredCommand
    ? registeredCommand.run(context, command.args)
    : { type: 'output', lines: [`Command not found: ${command.name}. Type "help" for available commands.`] }
}

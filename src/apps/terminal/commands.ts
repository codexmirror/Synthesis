import type { PlayerState } from '../../core/game/GameContext'

export interface TerminalCommand {
  description: string
  run: (player: PlayerState) => string[]
}

export const commands: Record<string, TerminalCommand> = {
  help: {
    description: 'List available commands',
    run: () => ['Available commands:', '', 'help', 'clear', 'ip', 'status'],
  },
  clear: {
    description: 'Clear terminal output',
    run: () => [],
  },
  ip: {
    description: 'Show local address',
    run: (player) => [`Local address: ${player.ip}`],
  },
  status: {
    description: 'Show system status',
    run: (player) => [
      `CPU: ${player.hardware.cpu}%`,
      `RAM: ${player.hardware.ram}%`,
      `Network: ${player.status}`,
    ],
  },
}

export function dispatchCommand(input: string, player: PlayerState) {
  const name = input.trim().toLowerCase()
  if (!name) return []
  const command = commands[name]
  return command ? command.run(player) : [`Command not found: ${name}. Type "help" for available commands.`]
}

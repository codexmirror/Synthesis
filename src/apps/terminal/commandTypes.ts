import type { RuntimeState } from '../../core/game/types'

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

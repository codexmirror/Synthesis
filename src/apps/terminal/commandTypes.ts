import type { RuntimeState } from '../../core/game/types'
import type { ScanResult } from '../../core/game/scan'

export interface CommandContext {
  readonly player: {
    readonly ip: string
  }
  readonly runtime: Readonly<RuntimeState>
  readonly operations: {
    readonly scanTarget: (target: string) => ScanResult
  }
}

export type CommandResult =
  | { type: 'output'; lines: string[] }
  | { type: 'clear' }

export interface TerminalCommand {
  description: string
  run: (context: CommandContext, args: string[]) => CommandResult
}

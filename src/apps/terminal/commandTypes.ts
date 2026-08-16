import type { RuntimeState } from '../../core/game/types'
import type { ScanResult } from '../../core/game/scan'
import type { InspectResult } from '../../core/game/inspect'

export interface CommandContext {
  readonly localDevice: {
    readonly ip: string
  }
  readonly runtime: Readonly<RuntimeState>
  readonly operations: {
    readonly scanTarget: (target: string) => ScanResult
    readonly inspectTarget: (target: string) => InspectResult
  }
}

export type CommandResult =
  | { type: 'output'; lines: string[] }
  | { type: 'clear' }

export interface TerminalCommand {
  description: string
  run: (context: CommandContext, args: string[]) => CommandResult
}

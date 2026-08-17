import type { ScanResult } from '../../core/game/scan'
import type { InspectResult } from '../../core/game/inspect'
import type { EndpointAnalysisResult } from '../../core/game/serviceAnalysis'

export interface CommandContext {
  readonly localDevice: {
    readonly ip: string
  }
  readonly runtime: { readonly cpuLoad: number; readonly ramUsage: number; readonly networkStatus: 'ONLINE' | 'OFFLINE' }
  readonly operations: {
    readonly scanTarget: (target: string) => ScanResult | Promise<ScanResult>
    readonly inspectTarget: (target: string) => InspectResult
    readonly analyzeEndpoint: (endpoint: string) => EndpointAnalysisResult['status']
    readonly knownWeaknesses: (targetDeviceId: string, serviceId: string) => readonly string[]
  }
}

export type TerminalLine = string | readonly TerminalFragment[]

export type TerminalFragment =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'target'; readonly value: string }

export const text = (value: string): TerminalFragment => ({ type: 'text', value })
export const target = (value: string): TerminalFragment => ({ type: 'target', value })

export type CommandResult =
  | { type: 'output'; lines: TerminalLine[] }
  | { type: 'clear' }

export interface TerminalCommand {
  description: string
  run: (context: CommandContext, args: string[]) => CommandResult | Promise<CommandResult>
}

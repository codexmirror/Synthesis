import type { ScanResult } from '../../core/game/scan'
import type { InspectResult } from '../../core/game/inspect'
import type { StartCredentialAccessResult } from '../../core/game/credentialAccess'
import type { ListDirectoryResult, ReadTextFileResult } from '../../core/game/filesystem'
import type { ConnectRemoteResult, DisconnectRemoteResult } from '../../core/game/remoteSession'
import type { InstalledSoftware } from '../../core/game/types'
import type { InstallLocalSoftwarePackageResult } from '../../core/game/softwareInstallation'

type WithoutState<T> = T extends { state: unknown } ? Omit<T, 'state'> : T
export type TerminalAttackResult = WithoutState<StartCredentialAccessResult>
export type TerminalAnalyzeResult =
  | { status: 'started'; processId: string }
  | { status: 'invalid_endpoint' | 'endpoint_not_found' | 'software_unavailable' | 'unavailable' | 'already_running' }
  | { status: 'insufficient_memory'; requiredMiB: number; availableMiB: number }

export interface CommandContext {
  readonly localDevice: {
    readonly ip: string
    readonly installedSoftware: readonly InstalledSoftware[]
  }
  readonly runtime: { readonly cpuLoad: number; readonly ramUsage: number; readonly networkStatus: 'ONLINE' | 'OFFLINE' }
  readonly filesystem: {
    readonly list: (path: string) => ListDirectoryResult
    readonly readText: (path: string) => ReadTextFileResult
  }
  readonly operations: {
    readonly scanTarget: (target: string) => ScanResult | { status: 'software_unavailable' } | Promise<ScanResult | { status: 'software_unavailable' }>
    readonly inspectTarget: (target: string) => InspectResult
    readonly analyzeEndpoint: (endpoint: string) => TerminalAnalyzeResult
    readonly knownWeaknesses: (targetDeviceId: string, serviceId: string) => readonly string[]
    readonly attackEndpoint: (endpoint: string) => TerminalAttackResult
    readonly connectAddress: (address: string) => Omit<ConnectRemoteResult, 'state'> | { status: 'target_not_known' }
    readonly disconnectRemote: () => Omit<DisconnectRemoteResult, 'state'>
    readonly installLocalSoftwarePackage: (path: string) => WithoutState<InstallLocalSoftwarePackageResult>
  }
}

export type TerminalLine = string | readonly TerminalFragment[]

export type TerminalFragment =
  | { readonly type: 'text'; readonly value: string }
  | { readonly type: 'target'; readonly value: string; readonly scope?: 'local' | 'external' }

export const text = (value: string): TerminalFragment => ({ type: 'text', value })
export const target = (value: string, scope: 'local' | 'external' = 'external'): TerminalFragment => ({ type: 'target', value, scope })

export type CommandResult =
  | { type: 'output'; lines: TerminalLine[] }
  | { type: 'process'; processId: string }
  | { type: 'clear' }

export interface TerminalCommand {
  description: string
  run: (context: CommandContext, args: string[]) => CommandResult | Promise<CommandResult>
}

export type NodeMinerTerminalRunResult =
  | { readonly status: 'started'; readonly processId: string; readonly payoutAddress: string }
  | { readonly status: 'invalid_payout_address' | 'already_running' | 'unavailable' | 'session_unavailable' | 'target_offline' }
  | { readonly status: 'insufficient_memory'; readonly requiredMiB: number; readonly availableMiB: number }

export type NodeMinerTerminalStatus =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly processId: string; readonly cpuPercent: number; readonly ramMiB: number; readonly payoutAddress: string; readonly producedUnits: number; readonly pendingUnits: number; readonly payoutBatchGrossUnits: number; readonly ratePerSecondUnits: number }

export type NodeMinerTerminalStopResult =
  | { readonly status: 'stopped'; readonly processId: string }
  | { readonly status: 'not_running' | 'session_unavailable' | 'target_offline' }

export type NodeMinerTerminalPayoutResult =
  | { readonly status: 'retargeted'; readonly processId: string; readonly payoutAddress: string }
  | { readonly status: 'not_running' | 'invalid_payout_address' | 'session_unavailable' | 'target_offline' }

/** The narrow operated-Device boundary consumed by the one NODE Miner CLI. */
export interface NodeMinerTerminalOperations {
  readonly run: (payoutAddress: string) => NodeMinerTerminalRunResult
  readonly status: () => NodeMinerTerminalStatus
  readonly stop: () => NodeMinerTerminalStopResult
  readonly payout: (payoutAddress: string) => NodeMinerTerminalPayoutResult
}

export const NODE_MINER_TERMINAL_DESCRIPTION = 'Control NODE Miner on this Device'
export const NODE_MINER_TERMINAL_HELP = [
  'NODE MINER', '', 'node-miner help', 'node-miner run --payout <address>',
  'node-miner status', 'node-miner stop', 'node-miner payout <address>',
] as const

/** Product syntax and presentation shared by NODE-OS and RACK-OS. */
export function runNodeMinerTerminal(args: readonly string[], operations: NodeMinerTerminalOperations): readonly string[] {
  const [subcommand, ...rest] = args
  if (subcommand === undefined || subcommand === 'help') return NODE_MINER_TERMINAL_HELP
  if (subcommand === 'run') {
    if (rest.length !== 2 || rest[0] !== '--payout' || !rest[1]?.trim()) return ['Usage: node-miner run --payout <address>']
    const result = operations.run(rest[1])
    if (result.status === 'started') return ['NODE MINER STARTED', `PROCESS  ${result.processId}`, `PAYOUT   ${result.payoutAddress}`]
    if (result.status === 'already_running') return ['ALREADY RUNNING']
    if (result.status === 'insufficient_memory') return ['INSUFFICIENT MEMORY', `${result.requiredMiB} MiB required`, `${Math.floor(result.availableMiB)} MiB available`]
    return [failureText(result.status)]
  }
  if (subcommand === 'status' && rest.length === 0) {
    const status = operations.status()
    if (status.status === 'idle') return ['STATUS  IDLE']
    return ['STATUS   RUNNING', `PROCESS  ${status.processId}`, `CPU      ${Math.round(status.cpuPercent)}%`, `RAM      ${status.ramMiB} MiB`, `ADDRESS  ${status.payoutAddress}`, `PRODUCED ${status.producedUnits.toLocaleString('en-US')} units`, `PENDING  ${status.pendingUnits.toLocaleString('en-US')} / ${status.payoutBatchGrossUnits.toLocaleString('en-US')} units`, `RATE     ${Math.round(status.ratePerSecondUnits).toLocaleString('en-US')} units/s`]
  }
  if (subcommand === 'stop' && rest.length === 0) {
    const result = operations.stop()
    return result.status === 'stopped' ? ['STOPPED', `PROCESS  ${result.processId}`] : [failureText(result.status)]
  }
  if (subcommand === 'payout') {
    if (rest.length !== 1 || !rest[0]?.trim()) return ['Usage: node-miner payout <address>']
    const result = operations.payout(rest[0])
    return result.status === 'retargeted' ? ['PAYOUT RETARGETED', `PROCESS  ${result.processId}`, `PAYOUT   ${result.payoutAddress}`] : [failureText(result.status)]
  }
  return NODE_MINER_TERMINAL_HELP
}

function failureText(status: 'invalid_payout_address' | 'unavailable' | 'not_running' | 'session_unavailable' | 'target_offline'): string {
  return ({ invalid_payout_address: 'INVALID PAYOUT ADDRESS', unavailable: 'COMMAND UNAVAILABLE', not_running: 'NOT RUNNING', session_unavailable: 'SESSION UNAVAILABLE', target_offline: 'TARGET OFFLINE' })[status]
}

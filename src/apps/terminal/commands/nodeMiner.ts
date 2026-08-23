import type { CommandContext, CommandResult, TerminalCommand } from '../commandTypes'

const HELP_LINES = [
  'NODE MINER',
  '',
  'node-miner help',
  'node-miner run --payout <address>',
  'node-miner status',
  'node-miner stop',
]

const UNAVAILABLE_LINES = ['Command not found: node-miner. Type "help" for available commands.']

export const nodeMinerCommand: TerminalCommand = {
  description: 'Control the locally installed NODE Miner',
  run(context, args) {
    if (!context.nodeMiner.available) return { type: 'output', lines: UNAVAILABLE_LINES }
    const [subcommand, ...rest] = args
    if (subcommand === 'run') return runSubcommand(context, rest)
    if (subcommand === 'status') return statusSubcommand(context)
    if (subcommand === 'stop') return stopSubcommand(context)
    return { type: 'output', lines: HELP_LINES }
  },
}

function runSubcommand(context: CommandContext, args: string[]): CommandResult {
  const flagIndex = args.indexOf('--payout')
  const payoutAddress = flagIndex === -1 ? undefined : args[flagIndex + 1]
  if (payoutAddress === undefined || !payoutAddress.trim()) return { type: 'output', lines: ['Usage: node-miner run --payout <address>'] }

  const result = context.operations.runLocalNodeMiner(payoutAddress)
  if (result.status === 'started') return { type: 'output', lines: ['NODE MINER STARTED', `PROCESS  ${result.processId}`, `PAYOUT   ${result.payoutAddress}`] }
  if (result.status === 'already_running') return { type: 'output', lines: ['ALREADY RUNNING'] }
  if (result.status === 'insufficient_memory') return { type: 'output', lines: ['INSUFFICIENT MEMORY', `${result.requiredMiB} MiB required`, `${Math.floor(result.availableMiB)} MiB available`] }
  if (result.status === 'invalid_payout_address') return { type: 'output', lines: ['INVALID PAYOUT ADDRESS'] }
  return { type: 'output', lines: UNAVAILABLE_LINES }
}

function statusSubcommand(context: CommandContext): CommandResult {
  const status = context.operations.localNodeMinerStatus()
  if (status.status === 'idle') return { type: 'output', lines: ['STATUS  IDLE'] }
  return {
    type: 'output',
    lines: [
      'STATUS   RUNNING',
      `PROCESS  ${status.processId}`,
      `CPU      ${Math.round(status.cpuPercent)}%`,
      `RAM      ${status.ramMiB} MiB`,
      `ADDRESS  ${status.payoutAddress}`,
      `PRODUCED ${status.producedUnits.toLocaleString('en-US')} units`,
      `PAYOUT   ${status.payoutUnits.toLocaleString('en-US')} units`,
      `RATE     ${Math.round(status.ratePerSecondUnits).toLocaleString('en-US')} units/s`,
    ],
  }
}

function stopSubcommand(context: CommandContext): CommandResult {
  const result = context.operations.stopLocalNodeMiner()
  if (result.status === 'stopped') return { type: 'output', lines: ['STOPPED', `PROCESS  ${result.processId}`] }
  return { type: 'output', lines: ['NOT RUNNING'] }
}

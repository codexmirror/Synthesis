import { checkDestinationPlacement } from './filesystem'
import type { FilesystemState, TextFile } from './types'

/**
 * One concrete artifact owned by one concrete software product: the local
 * data/log area of the installed NODE Miner. It exists only because that
 * Miner actually performed payouts, and it records what it actually routed
 * (ARCHITECTURE.md A13). It is not a generic event log, trace registry, or
 * evidence store, and nothing else writes to it.
 */
export const NODE_MINER_PAYOUT_LOG_PATH = '/var/log/node-miner/payout.log'
export const NODE_MINER_PAYOUT_LOG_HEADER = 'NODE MINER PAYOUT LOG'
/** Bounded retention: one running total line per Miner run, oldest run evicted first. Continuous mining rewrites a line rather than appending. */
export const NODE_MINER_PAYOUT_LOG_CAPACITY = 8

export interface NodeMinerPayoutRecord {
  /** The Miner run that produced these totals; also this line's stable identity inside the artifact. */
  readonly processId: string
  readonly grossNodeUnits: number
  readonly payoutAddress: string
  readonly payoutNodeUnits: number
  /** Present only for a release that actually embeds a developer payout address. */
  readonly developerAddress?: string
  readonly developerFeeNodeUnits?: number
}

function formatLine(record: NodeMinerPayoutRecord): string {
  const routed = `${record.processId} gross=${record.grossNodeUnits} payout=${record.payoutNodeUnits} payout-address=${record.payoutAddress}`
  return record.developerAddress === undefined ? routed : `${routed} fee=${record.developerFeeNodeUnits ?? 0} fee-address=${record.developerAddress}`
}

/**
 * Writes this Miner run's current cumulative payout truth into the Miner's
 * own Device-owned artifact, creating it on the first real payout. The
 * run's line is rewritten in place, so the artifact stays bounded however
 * long mining continues, and a completed run's line survives that Process
 * being stopped and removed.
 *
 * An unrelated artifact already occupying the path is never overwritten:
 * the payout simply goes unrecorded there rather than destroying Device
 * state the Miner does not own.
 */
export function recordNodeMinerPayout(filesystem: FilesystemState, record: NodeMinerPayoutRecord): FilesystemState {
  const line = formatLine(record)
  const existing = filesystem.files.find(({ path }) => path === NODE_MINER_PAYOUT_LOG_PATH)

  if (!existing) {
    if (checkDestinationPlacement(filesystem, NODE_MINER_PAYOUT_LOG_PATH) !== 'ok') return filesystem
    const file: TextFile = {
      kind: 'text',
      id: `file-${String(filesystem.nextFileId).padStart(4, '0')}`,
      path: NODE_MINER_PAYOUT_LOG_PATH,
      content: [NODE_MINER_PAYOUT_LOG_HEADER, line].join('\n'),
    }
    return { nextFileId: filesystem.nextFileId + 1, files: [...filesystem.files, file] }
  }

  if (existing.kind !== 'text' || existing.content.split('\n')[0] !== NODE_MINER_PAYOUT_LOG_HEADER) return filesystem
  const previous = existing.content.split('\n').filter((entry) => entry && entry !== NODE_MINER_PAYOUT_LOG_HEADER)
  const runPrefix = `${record.processId} `
  const withoutRun = previous.filter((entry) => !entry.startsWith(runPrefix))
  const content = [NODE_MINER_PAYOUT_LOG_HEADER, ...[...withoutRun, line].slice(-NODE_MINER_PAYOUT_LOG_CAPACITY)].join('\n')
  if (content === existing.content) return filesystem
  return { ...filesystem, files: filesystem.files.map((file) => file.path === NODE_MINER_PAYOUT_LOG_PATH ? { ...existing, content } : file) }
}

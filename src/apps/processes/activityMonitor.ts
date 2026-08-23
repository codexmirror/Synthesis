import { resolveFileTransferSource } from '../../core/game/fileTransfer'
import { deriveEffectiveTransferRateBytesPerSecond, isValidNetworkTransferCapacity } from '../../core/game/networkTransferCapacity'
import { deriveResourceUsage, type ResourceUsage } from '../../core/game/processes'
import { NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS, NODE_MINER_COMPUTE_SECONDS_PER_UNIT } from '../../core/game/nodeMiner'
import type { DeviceAccess, FileTransfer, GameProcess, GameState, NetworkTransferCapacity, NodeMinerProcess, RecentActivityEntry } from '../../core/game/types'
import { formatByteProgress, formatTransferRate } from '../byteFormat'

/**
 * Pure presentation adapter for the Activity Monitor.
 *
 * It aggregates the runtime domains that currently exist — canonical
 * `ProcessState` (compute/RAM work) and the canonical `FileTransfer` network
 * runtime — into one player-facing activity list. It owns no gameplay state,
 * stores nothing, and never merges those domains: a transfer stays a transfer
 * and is never represented as a `GameProcess`.
 */

export type ActivityCategory = 'operation' | 'transfer'
export type ActivityFilterId = 'all' | 'operations' | 'transfers'

export const ACTIVITY_FILTERS = [
  { id: 'all', label: 'ALL', accessibleName: 'All activity' },
  { id: 'operations', label: 'OPERATIONS', accessibleName: 'Operations' },
  { id: 'transfers', label: 'TRANSFERS', accessibleName: 'Transfers' },
] as const satisfies readonly { readonly id: ActivityFilterId; readonly label: string; readonly accessibleName: string }[]

export interface ActivityFact { readonly label: string; readonly value: string }

export interface ActivityOutcome {
  readonly tone: 'positive' | 'neutral' | 'negative'
  readonly headline: string
  readonly details: readonly string[]
}

export interface MonitorActivity {
  readonly id: string
  readonly category: ActivityCategory
  /** Runtime type of this activity, e.g. SERVICE ANALYSIS or DOWNLOAD. */
  readonly kindLabel: string
  readonly titleLabel?: string
  readonly title: string
  /** Endpoint relationship, currently only meaningful for a transfer. */
  readonly route?: string
  readonly status: 'running' | 'recent'
  /** Absent for continuous runtime with no finite completion threshold (e.g. NODE Miner): never rendered as a fake 0-100% bar. */
  readonly progressPercent?: number
  /** Compact metrics meaningful to this runtime type; never padded out. */
  readonly facts: readonly ActivityFact[]
  /** Wide rows for long values such as filesystem paths. */
  readonly details: readonly ActivityFact[]
  readonly outcome?: ActivityOutcome
  /** True only for runtime that STOP (rather than CANCEL/REMOVE) can terminate, e.g. NODE Miner. */
  readonly stoppable?: boolean
}

export interface MonitorNetworkUsage {
  /** Current derived transfer usage; not stored canonical state. */
  readonly downloadBytesPerSecond: number
  readonly uploadBytesPerSecond: number
  readonly capacity: NetworkTransferCapacity
}

export interface MonitorSummary {
  readonly cpuPercent: number
  readonly baselineCpuPercent: number
  readonly ramUsedMiB: number
  readonly ramAvailableMiB: number
  readonly ramCapacityMiB: number
  readonly ramPercent: number
  readonly activeCount: number
  readonly network: MonitorNetworkUsage
}

export interface ActivityMonitor {
  readonly summary: MonitorSummary
  readonly activities: readonly MonitorActivity[]
}

export function deriveActivityMonitor(state: GameState): ActivityMonitor {
  const device = state.player.localDevice
  const usage = deriveResourceUsage(device, state.process)
  const archivedProcessIds = new Set(state.recentActivity.entries.filter((entry) => entry.kind === 'process').map(({ id }) => id))
  const operations = state.process.processes
    .filter((process) => process.executorDeviceId === device.id && (process.status === 'running' || !archivedProcessIds.has(process.id)))
    .map((process) => toOperationActivity(process, usage, state.deviceAccess.established, device.hardware.cpu.computeCapacity, process.status === 'completed'))
  const transfer = deriveTransferPresentation(state)
  const recent = state.recentActivity.entries
    .filter((entry) => entry.kind === 'file_transfer' || entry.process.executorDeviceId === device.id)
    .map((entry) => toRecentActivity(entry, state, usage))
    .reverse()
  const activities = [...(transfer ? [...operations, transfer.activity] : operations), ...recent]
  return {
    summary: {
      cpuPercent: usage.totalCpuLoad,
      baselineCpuPercent: usage.baselineCpuLoad,
      ramUsedMiB: usage.baselineRamMiB + usage.processRamMiB,
      ramAvailableMiB: usage.availableRamMiB,
      ramCapacityMiB: usage.ramCapacityMiB,
      ramPercent: usage.totalRamUsage,
      activeCount: activities.filter((activity) => activity.status === 'running').length,
      network: {
        downloadBytesPerSecond: transfer?.rateBytesPerSecond ?? 0,
        uploadBytesPerSecond: 0,
        capacity: device.network.transferCapacity,
      },
    },
    activities,
  }
}

export function filterActivities(activities: readonly MonitorActivity[], filter: ActivityFilterId): readonly MonitorActivity[] {
  if (filter === 'operations') return activities.filter((activity) => activity.category === 'operation')
  if (filter === 'transfers') return activities.filter((activity) => activity.category === 'transfer')
  return activities
}

function toOperationActivity(process: GameProcess, usage: ResourceUsage, access: readonly DeviceAccess[], executorComputeCapacity: number, recent: boolean): MonitorActivity {
  if (process.kind === 'node_miner') return toNodeMinerActivity(process, usage, executorComputeCapacity, recent)
  const running = process.status === 'running'
  const progressPercent = Math.round(process.workCompleted / process.workRequired * 100)
  return {
    id: process.id,
    category: 'operation',
    kindLabel: process.kind === 'generic' ? 'PROCESS' : process.label,
    titleLabel: process.kind === 'generic' ? undefined : 'TARGET',
    title: process.kind === 'generic' ? process.label : process.startedEndpoint,
    status: recent ? 'recent' : 'running',
    progressPercent,
    facts: [
      { label: 'PROGRESS', value: `${progressPercent}%` },
      { label: 'CPU', value: `${Math.round(usage.cpuAllocationByProcess[process.id] ?? 0)}%` },
      { label: 'RAM', value: `${running ? process.ramRequiredMiB : 0} MiB` },
    ],
    details: [],
    outcome: toOperationOutcome(process, access),
  }
}

/**
 * Continuous NODE Miner runtime has no finite completion threshold, so it
 * deliberately carries no `progressPercent`: rendering a 0-100% bar for
 * indefinite work would misrepresent it as approaching completion.
 *
 * It presents this Process's own gross production and what it routes to its
 * configured payout address. Whatever else the running release does with
 * the difference is not runtime the Activity Monitor observes, so it is not
 * presented here.
 */
function toNodeMinerActivity(process: NodeMinerProcess, usage: ResourceUsage, executorComputeCapacity: number, recent: boolean): MonitorActivity {
  const cpuPercent = recent ? 0 : usage.cpuAllocationByProcess[process.id] ?? 0
  const allocatedCompute = executorComputeCapacity * cpuPercent / 100
  const unitsPerSecond = allocatedCompute / NODE_MINER_COMPUTE_SECONDS_PER_UNIT
  return {
    id: process.id,
    category: 'operation',
    kindLabel: process.label,
    titleLabel: 'RELEASE',
    title: process.releaseId,
    status: recent ? 'recent' : 'running',
    facts: [
      ...(!recent ? [{ label: 'CPU', value: `${Math.round(cpuPercent)}%` }, { label: 'RAM', value: `${process.ramRequiredMiB} MiB` }] : []),
      { label: 'PRODUCED', value: `${process.producedNodeUnits.toLocaleString('en-US')} units` },
      { label: 'PENDING', value: `${(process.producedNodeUnits % NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS).toLocaleString('en-US')} / ${NODE_MINER_1_0_PAYOUT_BATCH_GROSS_UNITS.toLocaleString('en-US')} units` },
    ],
    details: [
      { label: 'ADDRESS', value: process.payoutAddress },
      ...(unitsPerSecond > 0 ? [{ label: 'RATE', value: `${Math.round(unitsPerSecond).toLocaleString('en-US')} units/s` }] : []),
    ],
    stoppable: !recent,
  }
}

function toOperationOutcome(process: GameProcess, access: readonly DeviceAccess[]): ActivityOutcome | undefined {
  if (process.kind === 'service_analysis') {
    if (process.result?.status === 'weaknesses_detected') {
      return { tone: 'positive', headline: 'WEAKNESS DETECTED', details: process.result.vulnerabilities.map(({ observedLabel }) => observedLabel) }
    }
    if (process.result?.status === 'no_weakness_detected') return { tone: 'neutral', headline: 'NO WEAKNESS DETECTED', details: [] }
    if (process.result?.status === 'service_unavailable') return { tone: 'negative', headline: 'SERVICE UNAVAILABLE', details: [] }
    return undefined
  }
  if (process.kind === 'credential_access') {
    if (process.result?.status === 'access_established') {
      const { accessId } = process.result
      const established = access.find(({ id }) => id === accessId)
      return { tone: 'positive', headline: 'ACCESS ESTABLISHED', details: established ? [`${established.privilege} PRIVILEGE`] : [] }
    }
    if (process.result?.status === 'attempt_failed') return { tone: 'negative', headline: 'ATTEMPT FAILED', details: [process.result.message] }
  }
  return undefined
}

interface TransferPresentation {
  readonly activity: MonitorActivity
  readonly rateBytesPerSecond: number
}

/**
 * Present the single active `FileTransfer`. Source identity, the source
 * artifact, and the current effective rate are resolved only through the
 * transfer's own snapshotted DeviceAccess authority (the same
 * `resolveFileTransferSource` helper runtime advancement uses), never
 * through any RemoteSession, so a transfer keeps presenting correctly after
 * disconnect and nothing here reveals more than the transfer's own runtime
 * does.
 */
function deriveTransferPresentation(state: GameState): TransferPresentation | undefined {
  const transfer = state.fileTransfer.active
  if (!transfer) return undefined
  const device = state.player.localDevice
  const source = resolveFileTransferSource(state, transfer)
  const sourceFile = source?.filesystem?.files.find(({ id }) => id === transfer.sourceFileId)
  const sourceCapacity = source?.transferCapacity
  const online = device.runtime.networkStatus === 'ONLINE' && source?.online === true
  const rateBytesPerSecond = online && sourceCapacity && isValidNetworkTransferCapacity(sourceCapacity) && isValidNetworkTransferCapacity(device.network.transferCapacity)
    ? deriveEffectiveTransferRateBytesPerSecond(sourceCapacity, device.network.transferCapacity)
    : 0
  // Floor rather than round: running work must never read as 100% complete.
  const progressPercent = transfer.bytesTotal > 0 ? Math.floor(transfer.bytesTransferred / transfer.bytesTotal * 100) : 0
  return {
    rateBytesPerSecond,
    activity: {
      id: transfer.id,
      category: 'transfer',
      kindLabel: 'DOWNLOAD',
      titleLabel: 'ARTIFACT',
      title: basename(transfer.destinationPath),
      route: source ? `${source.displayName ?? source.ip} → ${device.displayName}` : undefined,
      status: 'running',
      progressPercent,
      facts: [
        { label: 'PROGRESS', value: `${progressPercent}%` },
        { label: 'TRANSFERRED', value: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal) },
        ...(rateBytesPerSecond > 0 ? [{ label: 'RATE', value: formatTransferRate(rateBytesPerSecond) }] : []),
      ],
      details: [
        ...(sourceFile ? [{ label: 'SOURCE', value: sourceFile.path }] : []),
        { label: 'DESTINATION', value: transfer.destinationPath },
      ],
    },
  }
}

function toRecentActivity(entry: RecentActivityEntry, state: GameState, usage: ResourceUsage): MonitorActivity {
  if (entry.kind === 'process') return toOperationActivity(entry.process, usage, state.deviceAccess.established, state.player.localDevice.hardware.cpu.computeCapacity, true)
  return toTransferActivity(entry.transfer, entry.sourcePath, entry.route)
}

function toTransferActivity(transfer: FileTransfer, sourcePath?: string, route?: string): MonitorActivity {
  const progressPercent = transfer.bytesTotal > 0 ? Math.floor(transfer.bytesTransferred / transfer.bytesTotal * 100) : 0
  return {
    id: transfer.id, category: 'transfer', kindLabel: 'DOWNLOAD', titleLabel: 'ARTIFACT', title: basename(transfer.destinationPath), route,
    status: 'recent', progressPercent,
    facts: [{ label: 'PROGRESS', value: `${progressPercent}%` }, { label: 'TRANSFERRED', value: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal) }],
    details: [...(sourcePath ? [{ label: 'SOURCE', value: sourcePath }] : []), { label: 'DESTINATION', value: transfer.destinationPath }],
  }
}

function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }

import { deriveActiveFileTransferRateBytesPerSecond, deriveFileTransferDirection } from '../../core/game/fileTransfer'
import { deriveResourceUsage, type ResourceUsage } from '../../core/game/processes'
import { NODE_MINER_COMPUTE_SECONDS_PER_UNIT } from '../../core/game/nodeMiner'
import type { DeviceAccess, DeviceAccessFileTransfer, DiscoveryState, FileTransfer, GameProcess, GameState, NetworkTransferCapacity, NodeMinerProcess, RecentActivityEntry } from '../../core/game/types'
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
  /** Secondary relationship line: an operation's endpoint, or a transfer's route. */
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
  /** True only for running finite GameProcess work controlled by finite CANCEL. */
  readonly cancellable?: boolean
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
    .map((process) => toOperationActivity(process, usage, state.deviceAccess.established, state.discovery, device.hardware.cpu.computeCapacity, process.status === 'completed'))
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
        downloadBytesPerSecond: transfer?.direction === 'download' ? transfer.rateBytesPerSecond : 0,
        uploadBytesPerSecond: transfer?.direction === 'upload' ? transfer.rateBytesPerSecond : 0,
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

/**
 * What a finite operation is working on, stated as its own concrete subject.
 *
 * Service-scoped work names the Service the player legitimately remembers at
 * that stable identity, so several simultaneous Service Analysis Processes are
 * told apart by what they are analysing rather than only by their endpoints.
 * The name is remembered Discovery, never current target truth: where the
 * player has no remembered Service at that identity — a Terminal `analyze`
 * against a never-scanned endpoint, for instance — the operation truthfully
 * falls back to naming its historical endpoint alone.
 */
function toOperationSubject(process: Exclude<GameProcess, NodeMinerProcess>, discovery: DiscoveryState): Pick<MonitorActivity, 'titleLabel' | 'title' | 'route'> {
  if (process.kind === 'generic') return { title: process.label }
  if (process.kind === 'software_installation') return { titleLabel: 'PACKAGE', title: `${process.name} ${process.version}` }
  if (process.kind === 'software_removal') return { titleLabel: 'SOFTWARE', title: `${process.name} ${process.version}` }
  // Module integration transforms an installed host product rather than reaching a target,
  // so its subject is the module being integrated and its relationship line states the host
  // product this work is snapshotted against, from the Process's own recorded identity.
  if (process.kind === 'flipper_module_integration') return { titleLabel: 'MODULE', title: `${process.moduleName} ${process.moduleVersion}`, route: process.hostProductId.toUpperCase() }
  const remembered = discovery.devices
    .find(({ id }) => id === process.targetDeviceId)?.services
    .find(({ id }) => id === process.serviceId)?.name
  // The operation kind already says what is being done, so the Service name
  // stands on its own line as the subject, with its endpoint beneath it.
  return remembered
    ? { title: remembered, route: process.startedEndpoint }
    : { titleLabel: 'TARGET', title: process.startedEndpoint }
}

function toOperationActivity(process: GameProcess, usage: ResourceUsage, access: readonly DeviceAccess[], discovery: DiscoveryState, executorComputeCapacity: number, recent: boolean, cancelled = false): MonitorActivity {
  if (process.kind === 'node_miner') return toNodeMinerActivity(process, usage, executorComputeCapacity, recent)
  const running = process.status === 'running'
  const progressPercent = Math.round(process.workCompleted / process.workRequired * 100)
  return {
    id: process.id,
    category: 'operation',
    kindLabel: process.kind === 'generic' ? 'PROCESS' : process.label,
    ...toOperationSubject(process, discovery),
    status: recent ? 'recent' : 'running',
    progressPercent,
    facts: [
      { label: 'PROGRESS', value: `${progressPercent}%` },
      ...(!cancelled ? [
        { label: 'CPU', value: `${Math.round(usage.cpuAllocationByProcess[process.id] ?? 0)}%` },
        { label: 'RAM', value: `${running ? process.ramRequiredMiB : 0} MiB` },
      ] : []),
    ],
    details: [],
    outcome: cancelled ? { tone: 'neutral', headline: 'CANCELLED', details: [] } : toOperationOutcome(process, access),
    cancellable: running,
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
      { label: 'UNPAID', value: `${(process.producedNodeUnits - process.payoutNodeUnits - process.developerFeeNodeUnits).toLocaleString('en-US')} units` },
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
  if (process.kind === 'rack_update_exploit') {
    if (process.result?.status === 'submission_enabled') return { tone: 'positive', headline: 'SUBMISSION ENABLED', details: [] }
    if (process.result?.status === 'attempt_failed') return { tone: 'negative', headline: 'ATTEMPT FAILED', details: [process.result.message] }
  }
  if (process.kind === 'software_installation') {
    if (process.result?.status === 'installed') return { tone: 'positive', headline: 'INSTALLED', details: [] }
    if (process.result?.status === 'install_path_occupied') return { tone: 'negative', headline: 'INSTALLATION PATH OCCUPIED', details: [] }
    if (process.result?.status === 'target_unavailable') return { tone: 'negative', headline: 'TARGET UNAVAILABLE', details: [] }
  }
  if (process.kind === 'flipper_module_integration') {
    if (process.result?.status === 'integrated') return { tone: 'positive', headline: 'MODULE INTEGRATED', details: [process.result.buildId] }
    if (process.result?.status === 'already_integrated') return { tone: 'neutral', headline: 'ALREADY INTEGRATED', details: [] }
    if (process.result?.status === 'host_unavailable') return { tone: 'negative', headline: 'HOST UNAVAILABLE', details: [] }
    if (process.result?.status === 'host_changed') return { tone: 'negative', headline: 'HOST CHANGED', details: [] }
  }
  if (process.kind === 'software_removal') {
    if (process.result?.status === 'baseline_restored') return { tone: 'positive', headline: 'BASELINE RESTORED', details: [] }
    if (process.result?.status === 'removed') return { tone: 'positive', headline: 'REMOVED', details: [] }
    if (process.result?.status === 'not_installed') return { tone: 'negative', headline: 'NOT INSTALLED', details: [] }
  }
  return undefined
}

interface TransferPresentation {
  readonly activity: MonitorActivity
  readonly rateBytesPerSecond: number
  readonly direction: 'download' | 'upload'
}

/**
 * Present the single active `FileTransfer`, whichever origin admitted it. The
 * Activity Monitor observes the one canonical transfer runtime and keeps no
 * progress of its own, so a Market download is the same real Download here as
 * a Device-route one — only its route and stated source differ.
 */
function deriveTransferPresentation(state: GameState): TransferPresentation | undefined {
  const transfer = state.fileTransfer.active
  if (!transfer) return undefined
  const device = state.player.localDevice
  const direction = deriveFileTransferDirection(device.id, transfer)
  if (!direction) return undefined
  const rateBytesPerSecond = deriveActiveFileTransferRateBytesPerSecond(state, transfer)
  // Floor rather than round: running work must never read as 100% complete.
  const progressPercent = transfer.bytesTotal > 0 ? Math.floor(transfer.bytesTransferred / transfer.bytesTotal * 100) : 0
  const endpoints = transfer.origin === 'market_distribution'
    ? { route: `${state.market.operator.name} → ${device.displayName}`, source: state.market.operator.name }
    : deriveDeviceTransferEndpoints(state, transfer, direction)
  if (!endpoints) return undefined
  return {
    rateBytesPerSecond, direction,
    activity: {
      id: transfer.id,
      category: 'transfer',
      kindLabel: direction.toUpperCase(),
      titleLabel: 'ARTIFACT',
      title: basename(transfer.destinationPath),
      route: endpoints.route,
      status: 'running',
      progressPercent,
      facts: [
        { label: 'PROGRESS', value: `${progressPercent}%` },
        { label: 'TRANSFERRED', value: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal) },
        ...(rateBytesPerSecond > 0 ? [{ label: 'RATE', value: formatTransferRate(rateBytesPerSecond) }] : []),
      ],
      details: [
        ...(endpoints.source ? [{ label: 'SOURCE', value: endpoints.source }] : []),
        { label: 'DESTINATION', value: transfer.destinationPath },
      ],
    },
  }
}

/**
 * Source identity, the source artifact and the presented route of a
 * Device-route transfer are resolved through the transfer's retained
 * DeviceAccess authority. RemoteSession contributes only its retained address
 * when it still matches; World identity is never used as a presentation label.
 */
function deriveDeviceTransferEndpoints(state: GameState, transfer: DeviceAccessFileTransfer, direction: 'download' | 'upload'): { route?: string; source?: string } | undefined {
  const device = state.player.localDevice
  const access = state.deviceAccess.established.find(({ id }) => id === transfer.accessId)
  const remoteDeviceId = direction === 'download' ? transfer.sourceDeviceId : transfer.destinationDeviceId
  if (!access || access.sourceDeviceId !== device.id || access.targetDeviceId !== remoteDeviceId) return undefined
  const remote = state.world.network.hosts.find(({ id }) => id === remoteDeviceId)
  const sourceFile = (direction === 'upload' ? device.filesystem : remote?.filesystem)?.files.find(({ id }) => id === transfer.sourceFileId)
  const connectedAddress = state.remoteSession.active?.accessId === transfer.accessId ? state.remoteSession.active.connectedAddress : undefined
  return {
    route: connectedAddress ? direction === 'upload' ? `${device.displayName} → ${connectedAddress}` : `${connectedAddress} → ${device.displayName}` : undefined,
    source: sourceFile?.path,
  }
}

function toRecentActivity(entry: RecentActivityEntry, state: GameState, usage: ResourceUsage): MonitorActivity {
  if (entry.kind === 'process') return toOperationActivity(entry.process, usage, state.deviceAccess.established, state.discovery, state.player.localDevice.hardware.cpu.computeCapacity, true, entry.termination === 'cancelled')
  return toTransferActivity(entry.transfer, state.player.localDevice.id, entry.sourcePath, entry.route)
}

function toTransferActivity(transfer: FileTransfer, localDeviceId: string, sourcePath?: string, route?: string): MonitorActivity {
  const progressPercent = transfer.bytesTotal > 0 ? Math.floor(transfer.bytesTransferred / transfer.bytesTotal * 100) : 0
  const direction = deriveFileTransferDirection(localDeviceId, transfer) ?? 'download'
  return {
    id: transfer.id, category: 'transfer', kindLabel: direction.toUpperCase(), titleLabel: 'ARTIFACT', title: basename(transfer.destinationPath), route,
    status: 'recent', progressPercent,
    facts: [{ label: 'PROGRESS', value: `${progressPercent}%` }, { label: 'TRANSFERRED', value: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal) }],
    details: [...(sourcePath ? [{ label: 'SOURCE', value: sourcePath }] : []), { label: 'DESTINATION', value: transfer.destinationPath }],
  }
}

function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }

import { deriveActiveFileTransferRateBytesPerSecond, deriveFileTransferDirection } from '../../core/game/fileTransfer'
import { deriveResourceUsage, type ResourceUsage } from '../../core/game/processes'
import { NODE_MINER_COMPUTE_SECONDS_PER_UNIT } from '../../core/game/nodeMiner'
import type { DeviceAccess, DeviceAccessFileTransfer, DiscoveryState, FileTransfer, GameProcess, GameState, NetworkTransferCapacity, NodeMinerProcess, RecentActivityEntry } from '../../core/game/types'
import { formatByteProgress, formatBytes, formatTransferRate } from '../byteFormat'

/**
 * Pure presentation adapter for the Activity Monitor.
 *
 * It aggregates the runtime domains that currently exist — canonical
 * `ProcessState` (compute/RAM work) and the canonical `FileTransfer` network
 * runtime — into one player-facing activity list. It owns no gameplay state,
 * stores nothing, and never merges those domains: a transfer stays a transfer
 * and is never represented as a `GameProcess`.
 *
 * Each activity is derived at two densities, because the application presents
 * it at two: a `row` the runtime overview can scan (what it is, what it is
 * working on, its one headline number, and the resources it is holding), and
 * `sections` the activity's own detail surface presents. The two are not the
 * same information at different sizes — the overview deliberately carries
 * less, and detail carries what only that runtime supports. Nothing is padded
 * out so that the runtime types look alike.
 */

export type ActivityCategory = 'operation' | 'transfer'
export type ActivityFilterId = 'all' | 'operations' | 'transfers'

export const ACTIVITY_FILTERS = [
  { id: 'all', label: 'ALL', accessibleName: 'All activity' },
  { id: 'operations', label: 'OPERATIONS', accessibleName: 'Operations' },
  { id: 'transfers', label: 'TRANSFERS', accessibleName: 'Transfers' },
] as const satisfies readonly { readonly id: ActivityFilterId; readonly label: string; readonly accessibleName: string }[]

export interface ActivityFact { readonly label: string; readonly value: string }

/** One titled block of an activity's detail surface. Only blocks its runtime supports are produced. */
export interface ActivitySection { readonly heading: string; readonly facts: readonly ActivityFact[] }

export interface ActivityOutcome {
  readonly tone: 'positive' | 'neutral' | 'negative'
  readonly headline: string
  readonly details: readonly string[]
}

export interface MonitorActivity {
  readonly id: string
  /** Stable selection key across the two independent runtime domains. */
  readonly key: string
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
  /** True only for runtime that never completes from elapsed work. Marks it as such instead of implying a completion threshold. */
  readonly continuous?: boolean
  /** The one number this runtime type leads with in the overview. */
  readonly metric?: ActivityFact
  /** Pre-formatted overview meta, e.g. what the activity is currently holding. Never padded to a fixed length. */
  readonly summary: readonly string[]
  /** Detail-surface blocks. Empty for a runtime whose state supports nothing beyond its overview row. */
  readonly sections: readonly ActivitySection[]
  readonly outcome?: ActivityOutcome
  /** True only for runtime that STOP (rather than CANCEL/REMOVE) can terminate, e.g. NODE Miner. */
  readonly stoppable?: boolean
  /** True only for running finite GameProcess work controlled by finite CANCEL. */
  readonly cancellable?: boolean
}

/**
 * One contributor to a Device load rail. Segments exist so resource pressure
 * reads as the work causing it rather than as a free-standing gauge: every
 * segment is one running Process's own canonical allocation or reservation.
 */
export interface LoadSegment { readonly id: string; readonly label: string; readonly percent: number }

export interface MonitorCpuLoad {
  readonly totalPercent: number
  readonly baselinePercent: number
  readonly segments: readonly LoadSegment[]
}

export interface MonitorRamLoad {
  readonly usedMiB: number
  readonly availableMiB: number
  readonly capacityMiB: number
  readonly totalPercent: number
  readonly baselinePercent: number
  readonly segments: readonly LoadSegment[]
}

export interface MonitorNetworkUsage {
  /** Current derived transfer usage; not stored canonical state. */
  readonly downloadBytesPerSecond: number
  readonly uploadBytesPerSecond: number
  readonly capacity: NetworkTransferCapacity
  /** The direction the one active transfer is using, if any. */
  readonly activeDirection?: 'download' | 'upload'
}

export interface MonitorSummary {
  readonly cpu: MonitorCpuLoad
  readonly ram: MonitorRamLoad
  readonly network: MonitorNetworkUsage
  readonly activeCount: number
}

export interface ActivityMonitor {
  readonly summary: MonitorSummary
  readonly activities: readonly MonitorActivity[]
}

/** How a Process names its own runtime type. `generic` has no authored label of its own. */
function processKindLabel(process: GameProcess): string {
  return process.kind === 'generic' ? 'PROCESS' : process.label
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

  // Load segments come from the executor's own running Processes. A
  // FileTransfer contributes to neither rail: it holds no Process CPU or RAM.
  const runningProcesses = state.process.processes.filter((process) => process.status === 'running' && process.executorDeviceId === device.id)
  const cpuSegments = runningProcesses
    .map((process) => ({ id: process.id, label: processKindLabel(process), percent: usage.cpuAllocationByProcess[process.id] ?? 0 }))
    .filter(({ percent }) => percent > 0)
  const ramSegments = runningProcesses
    .map((process) => ({ id: process.id, label: processKindLabel(process), percent: usage.ramCapacityMiB > 0 ? process.ramRequiredMiB / usage.ramCapacityMiB * 100 : 0 }))
    .filter(({ percent }) => percent > 0)

  return {
    summary: {
      cpu: { totalPercent: usage.totalCpuLoad, baselinePercent: usage.baselineCpuLoad, segments: cpuSegments },
      ram: {
        usedMiB: usage.baselineRamMiB + usage.processRamMiB,
        availableMiB: usage.availableRamMiB,
        capacityMiB: usage.ramCapacityMiB,
        totalPercent: usage.totalRamUsage,
        baselinePercent: usage.ramCapacityMiB > 0 ? usage.baselineRamMiB / usage.ramCapacityMiB * 100 : 0,
        segments: ramSegments,
      },
      activeCount: activities.filter((activity) => activity.status === 'running').length,
      network: {
        downloadBytesPerSecond: transfer?.direction === 'download' ? transfer.rateBytesPerSecond : 0,
        uploadBytesPerSecond: transfer?.direction === 'upload' ? transfer.rateBytesPerSecond : 0,
        capacity: device.network.transferCapacity,
        ...(transfer ? { activeDirection: transfer.direction } : {}),
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

/** Count of running activity under one filter. Used by the filter badges, which count live work only. */
export function countRunning(activities: readonly MonitorActivity[], filter: ActivityFilterId): number {
  return filterActivities(activities, filter).filter((activity) => activity.status === 'running').length
}

export function findActivity(activities: readonly MonitorActivity[], key: string | undefined): MonitorActivity | undefined {
  return key === undefined ? undefined : activities.find((activity) => activity.key === key)
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
  if (process.kind === 'rattler_pin_search') return { titleLabel: 'TARGET', title: process.targetDeviceId, route: 'VEYRA WALLET PIN' }
  if (process.kind === 'deauth') return { titleLabel: 'NETWORK', title: process.targetNetworkName, route: process.targetNetworkId }
  const remembered = discovery.devices
    .find(({ id }) => id === process.targetDeviceId)?.services
    .find(({ id }) => id === process.serviceId)?.name
  // The operation kind already says what is being done, so the Service name
  // stands on its own line as the subject, with its endpoint beneath it.
  return remembered
    ? { title: remembered, route: process.startedEndpoint }
    : { titleLabel: 'TARGET', title: process.startedEndpoint }
}

/**
 * The detail blocks a finite operation's own snapshotted state supports.
 *
 * Only what the Process actually recorded is stated. Nothing is inferred from
 * current World Truth, and a kind that recorded nothing beyond its subject
 * contributes no block rather than an empty one.
 */
function toOperationSubjectSection(process: Exclude<GameProcess, NodeMinerProcess>): ActivitySection | undefined {
  // Service-scoped work already states its endpoint as the subject line above;
  // repeating it here would make detail a copy of the row rather than more of
  // the runtime. What it adds is the concrete surface the attempt was aimed at,
  // which the Process snapshotted at admission.
  if (process.kind === 'credential_access' || process.kind === 'rack_update_exploit') {
    return process.vulnerabilityId ? { heading: 'SURFACE', facts: [{ label: 'WEAKNESS', value: process.vulnerabilityId }] } : undefined
  }
  if (process.kind === 'software_installation') {
    return { heading: 'SUBJECT', facts: [
      { label: 'RELEASE', value: process.releaseId },
      ...(process.channel ? [{ label: 'CHANNEL', value: process.channel }] : []),
      ...(process.publisher ? [{ label: 'PUBLISHER', value: process.publisher }] : []),
    ] }
  }
  if (process.kind === 'software_removal') {
    return { heading: 'SUBJECT', facts: [{ label: 'RELEASE', value: process.releaseId }] }
  }
  if (process.kind === 'flipper_module_integration') {
    return { heading: 'SUBJECT', facts: [
      { label: 'MODULE', value: process.moduleReleaseId },
      { label: 'SIZE', value: formatBytes(process.moduleSizeBytes) },
      { label: 'HOST', value: process.hostReleaseId },
    ] }
  }
  return undefined
}

function toOperationActivity(process: GameProcess, usage: ResourceUsage, access: readonly DeviceAccess[], discovery: DiscoveryState, executorComputeCapacity: number, recent: boolean, cancelled = false): MonitorActivity {
  if (process.kind === 'node_miner') return toNodeMinerActivity(process, usage, executorComputeCapacity, recent)
  const running = process.status === 'running'
  const progressPercent = Math.round(process.workCompleted / process.workRequired * 100)
  const cpuPercent = Math.round(usage.cpuAllocationByProcess[process.id] ?? 0)
  const holding = running && !cancelled
  const subject = toOperationSubjectSection(process)
  return {
    id: process.id,
    key: `operation:${process.id}`,
    category: 'operation',
    kindLabel: processKindLabel(process),
    ...toOperationSubject(process, discovery),
    status: recent ? 'recent' : 'running',
    progressPercent,
    metric: { label: 'PROGRESS', value: `${progressPercent}%` },
    summary: holding ? [`${cpuPercent}% CPU`, `${process.ramRequiredMiB} MiB`] : [],
    sections: [
      // The subject line above already leads with this activity's progress, so
      // the block states the Process's own canonical elapsed and required
      // compute, which the rounded percentage does not carry.
      { heading: 'WORK', facts: [
        { label: 'COMPUTE', value: `${Math.round(process.workCompleted).toLocaleString('en-US')} / ${process.workRequired.toLocaleString('en-US')}` },
        { label: 'COMPLETION', value: 'FINITE' },
      ] },
      // Only running work owns an allocation. Ended work — completed or
      // cancelled — released it, so it states no resource block at all rather
      // than a block of zeroes.
      ...(holding ? [{ heading: 'RESOURCES', facts: [
        { label: 'CPU', value: `${cpuPercent}%` },
        { label: 'RAM', value: `${process.ramRequiredMiB} MiB` },
      ] }] : []),
      ...(subject ? [subject] : []),
    ],
    outcome: cancelled ? { tone: 'neutral', headline: 'CANCELLED', details: [] } : toOperationOutcome(process, access),
    cancellable: running,
  }
}

/**
 * Continuous NODE Miner runtime has no finite completion threshold, so it
 * deliberately carries no `progressPercent`: rendering a 0-100% bar for
 * indefinite work would misrepresent it as approaching completion. It is
 * marked `continuous` instead, which is what its runtime actually is.
 *
 * It presents this Process's own gross production and what it routes to its
 * configured payout address. Whatever else the running release does with
 * the difference is not runtime the Activity Monitor observes, so it is not
 * presented here.
 */
function toNodeMinerActivity(process: NodeMinerProcess, usage: ResourceUsage, executorComputeCapacity: number, recent: boolean): MonitorActivity {
  const cpuPercent = recent ? 0 : usage.cpuAllocationByProcess[process.id] ?? 0
  const allocatedCompute = executorComputeCapacity * cpuPercent / 100
  const unitsPerSecond = Math.round(allocatedCompute / NODE_MINER_COMPUTE_SECONDS_PER_UNIT)
  const produced = process.producedNodeUnits
  const unpaid = produced - process.payoutNodeUnits - process.developerFeeNodeUnits
  return {
    id: process.id,
    key: `operation:${process.id}`,
    category: 'operation',
    kindLabel: process.label,
    titleLabel: 'RELEASE',
    title: process.releaseId,
    status: recent ? 'recent' : 'running',
    continuous: true,
    metric: recent
      ? { label: 'PRODUCED', value: `${produced.toLocaleString('en-US')} units` }
      : { label: 'RATE', value: `${unitsPerSecond.toLocaleString('en-US')} units/s` },
    summary: recent
      ? [`${produced.toLocaleString('en-US')} units produced`]
      : [`${Math.round(cpuPercent)}% CPU`, `${process.ramRequiredMiB} MiB`, `${unpaid.toLocaleString('en-US')} units unpaid`],
    sections: [
      { heading: 'PRODUCTION', facts: [
        { label: 'PRODUCED', value: `${produced.toLocaleString('en-US')} units` },
        { label: 'UNPAID', value: `${unpaid.toLocaleString('en-US')} units` },
        ...(unitsPerSecond > 0 ? [{ label: 'RATE', value: `${unitsPerSecond.toLocaleString('en-US')} units/s` }] : []),
        { label: 'COMPLETION', value: 'CONTINUOUS' },
      ] },
      ...(!recent ? [{ heading: 'RESOURCES', facts: [
        { label: 'CPU', value: `${Math.round(cpuPercent)}%` },
        { label: 'RAM', value: `${process.ramRequiredMiB} MiB` },
      ] }] : []),
      { heading: 'CONFIGURATION', facts: [{ label: 'PAYOUT ADDRESS', value: process.payoutAddress }, { label: 'BUILD', value: process.buildId }] },
    ],
    stoppable: !recent,
  }
}

function toOperationOutcome(process: GameProcess, access: readonly DeviceAccess[]): ActivityOutcome | undefined {
  if (process.kind === 'service_analysis') {
    if (process.result?.status === 'analysis_complete') return { tone: 'positive', headline: 'ENDPOINT ANALYZED', details: [] }
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
  const capacity = direction === 'download'
    ? device.network.transferCapacity.downloadBytesPerSecond
    : device.network.transferCapacity.uploadBytesPerSecond
  return {
    rateBytesPerSecond, direction,
    activity: {
      id: transfer.id,
      key: `transfer:${transfer.id}`,
      category: 'transfer',
      kindLabel: direction.toUpperCase(),
      titleLabel: 'ARTIFACT',
      title: basename(transfer.destinationPath),
      route: endpoints.route,
      status: 'running',
      progressPercent,
      metric: { label: 'PROGRESS', value: `${progressPercent}%` },
      summary: [
        formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal),
        ...(rateBytesPerSecond > 0 ? [formatTransferRate(rateBytesPerSecond)] : []),
      ],
      // A transfer claims no Process CPU or RAM. Its resource block is the
      // network capacity it is actually running against, and nothing else.
      sections: [
        { heading: 'TRANSFER', facts: [
          { label: 'TRANSFERRED', value: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal) },
          ...(rateBytesPerSecond > 0 ? [{ label: 'RATE', value: formatTransferRate(rateBytesPerSecond) }] : []),
          { label: 'LINK CAPACITY', value: formatTransferRate(capacity) },
        ] },
        { heading: 'ROUTE', facts: [
          ...(endpoints.source ? [{ label: 'SOURCE', value: endpoints.source }] : []),
          { label: 'DESTINATION', value: transfer.destinationPath },
        ] },
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
    id: transfer.id,
    key: `transfer:${transfer.id}`,
    category: 'transfer',
    kindLabel: direction.toUpperCase(),
    titleLabel: 'ARTIFACT',
    title: basename(transfer.destinationPath),
    route,
    status: 'recent',
    progressPercent,
    metric: { label: 'PROGRESS', value: `${progressPercent}%` },
    summary: [formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal)],
    sections: [
      { heading: 'TRANSFER', facts: [
        { label: 'TRANSFERRED', value: formatByteProgress(transfer.bytesTransferred, transfer.bytesTotal) },
      ] },
      { heading: 'ROUTE', facts: [
        ...(sourcePath ? [{ label: 'SOURCE', value: sourcePath }] : []),
        { label: 'DESTINATION', value: transfer.destinationPath },
      ] },
    ],
  }
}

function basename(path: string) { return path.slice(path.lastIndexOf('/') + 1) }

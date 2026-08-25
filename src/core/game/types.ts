export interface PlayerState {
  /** Stable player identity, separate from every device the player owns. */
  readonly id: string
  readonly localDevice: LocalDeviceState
}

export interface HardwareState {
  readonly cpu: { readonly name: string; readonly computeCapacity: number }
  readonly ram: { readonly name: string; readonly capacityMiB: number }
}

export interface RuntimeState {
  readonly baselineCpuLoad: number
  readonly baselineRamUsage: number
  readonly networkStatus: 'ONLINE' | 'OFFLINE'
}

export interface Vulnerability {
  readonly id: string
  readonly label: string
}

export type ServiceAnalysisResult =
  | { readonly status: 'weaknesses_detected'; readonly vulnerabilities: readonly { readonly vulnerabilityId: string; readonly observedLabel: string }[] }
  | { readonly status: 'no_weakness_detected' }
  | { readonly status: 'service_unavailable' }

export type CredentialAccessResult =
  | { readonly status: 'access_established'; readonly accessId: string }
  | { readonly status: 'attempt_failed'; readonly message: 'Authentication attempt failed.' }

interface ProcessCommon {
  readonly id: string
  readonly label: string
  readonly executorDeviceId: string
  readonly ramRequiredMiB: number
}

interface ProcessBase extends ProcessCommon {
  readonly status: 'running' | 'completed'
  readonly workRequired: number
  readonly workCompleted: number
}

export interface GenericProcess extends ProcessBase { readonly kind: 'generic' }

export interface ServiceAnalysisProcess extends ProcessBase {
  readonly kind: 'service_analysis'
  readonly targetDeviceId: string
  readonly serviceId: string
  /** Historical presentation only; gameplay resolution and identity use stable IDs. */
  readonly startedEndpoint: string
  readonly result?: ServiceAnalysisResult
}

export interface CredentialAccessProcess extends ProcessBase {
  readonly kind: 'credential_access'
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly startedEndpoint: string
  readonly vulnerabilityId: string
  readonly toolId: 'basic-credential-toolkit'
  readonly result?: CredentialAccessResult
}

/**
 * Continuous Device-owned executable runtime. Unlike the finite GameProcess
 * kinds above, it never reaches `completed` from elapsed work: STOP removes
 * it directly rather than transitioning it through a finished state.
 * `workRemainder` is fractional allocated compute-seconds not yet converted
 * to whole NODE; that conversion and the routing of produced NODE to
 * represented economic recipients are a distinct concern (see
 * `resolveNodeMinerProduction` in `nodeMiner.ts`) so production and payout
 * remain observably separate events.
 */
export interface NodeMinerProcess extends ProcessCommon {
  readonly kind: 'node_miner'
  readonly status: 'running'
  readonly programId: 'node-miner'
  readonly releaseId: string
  /** Configured explicitly at RUN. Not Player, Device, or Wallet identity. */
  readonly payoutAddress: string
  /**
   * Canonical integer atomic NODE units; see `NODE_UNITS_PER_NODE` in
   * nodeMiner.ts. `producedNodeUnits` is gross production from this
   * Process's own allocated compute and is never redefined downward by the
   * running release's payout behavior; the two allocation totals below
   * describe completed payout batches, while their difference from gross is
   * production still pending the next batch.
   */
  readonly producedNodeUnits: number
  /** Cumulative gross production routed to this Process's configured `payoutAddress`. */
  readonly payoutNodeUnits: number
  /** Cumulative gross production diverted by the running release to its own embedded developer address. */
  readonly developerFeeNodeUnits: number
  readonly workRemainder: number
}

export type SoftwareInstallationResult =
  | { readonly status: 'installed' }
  | { readonly status: 'install_path_occupied' }

/**
 * Finite compute/RAM-driven work admitted by INSTALL. It snapshots only the
 * package facts completion actually needs; the source package artifact and
 * Device-owned InstalledSoftware are deliberately untouched until this
 * Process completes (see `resolveCompletedSoftwareInstallations` in
 * `softwareInstallation.ts`), so a package, an installation Process,
 * InstalledSoftware, and a running program remain four distinct things.
 */
export interface SoftwareInstallationProcess extends ProcessBase {
  readonly kind: 'software_installation'
  readonly productId: string
  readonly releaseId: string
  readonly name: string
  readonly version: string
  readonly channel: string
  /** Provenance stated by the source package at admission; present only when that package claimed one. */
  readonly publisher?: string
  readonly result?: SoftwareInstallationResult
}

export type SoftwareRemovalResult =
  | { readonly status: 'removed' }
  | { readonly status: 'baseline_restored' }
  /** Safe-removal failure: the currently installed release no longer matches what admission snapshotted. */
  | { readonly status: 'not_installed' }

/**
 * Finite compute/RAM-driven work admitted by REMOVE. It snapshots only the
 * installed-release facts completion actually needs; Device-owned
 * InstalledSoftware and the filesystem are deliberately untouched until this
 * Process completes (see `resolveCompletedSoftwareRemovals` in
 * `softwareRemoval.ts`), so InstalledSoftware, a removal Process, and any
 * already-running program the software started remain distinct things — a
 * running `NodeMinerProcess` in particular is never touched by this kind.
 */
export interface SoftwareRemovalProcess extends ProcessBase {
  readonly kind: 'software_removal'
  readonly productId: 'nodescan' | 'node-miner'
  /** Release being removed, snapshotted at admission. */
  readonly releaseId: string
  readonly name: string
  readonly version: string
  readonly channel: string
  readonly publisher?: string
  readonly result?: SoftwareRemovalResult
}

export type GameProcess = GenericProcess | ServiceAnalysisProcess | CredentialAccessProcess | NodeMinerProcess | SoftwareInstallationProcess | SoftwareRemovalProcess

export interface ProcessState {
  readonly nextId: number
  readonly processes: readonly GameProcess[]
}

/**
 * Maximum endpoint transfer capability. This is a pure capability value: it
 * carries no availability, usage, or runtime state.
 */
export interface NetworkTransferCapacity {
  /** Maximum bytes this endpoint can upload (send) per second. */
  readonly uploadBytesPerSecond: number
  /** Maximum bytes this endpoint can download (receive) per second. */
  readonly downloadBytesPerSecond: number
}

export interface DeviceNetworkState {
  readonly ip: string
  readonly transferCapacity: NetworkTransferCapacity
}

export interface FirmwareState {
  readonly id: string
  readonly name: string
  readonly version: string
}

export interface TextFile {
  readonly kind: 'text'
  readonly id: string
  readonly path: string
  readonly content: string
}

export interface SoftwarePackageFile {
  readonly kind: 'software_package'
  readonly id: string
  readonly path: string
  readonly releaseId: string
  readonly productId: string
  readonly name: string
  readonly version: string
  readonly channel: string
  /** Provenance stated by the package itself; present only where the represented package claims one. */
  readonly publisher?: string
  readonly sizeBytes: number
}

export interface ExecutableFile {
  readonly kind: 'executable'
  readonly id: string
  readonly path: string
  readonly programId: string
  readonly releaseId: string
  readonly name: string
  readonly version: string
  readonly sizeBytes: number
}

export type FilesystemFile = TextFile | SoftwarePackageFile | ExecutableFile

export interface FilesystemState {
  /** Next filesystem-local concrete copy identity. Cross-device references also require the Device ID. */
  readonly nextFileId: number
  readonly files: readonly FilesystemFile[]
}

export interface InstalledSoftware {
  readonly id: string
  readonly releaseId: string
  readonly name: string
  readonly version: string
  readonly channel?: string
  readonly publisher?: string
}

export interface NodeScanInstallation extends InstalledSoftware {
  readonly id: 'nodescan'
  readonly channel: string
}

export interface BasicCredentialToolkitInstallation extends InstalledSoftware {
  readonly id: 'basic-credential-toolkit'
  readonly name: 'Basic Credential Toolkit'
}

export interface NodeMinerInstallation extends InstalledSoftware {
  readonly id: 'node-miner'
  readonly channel: string
}

export interface LocalDeviceState {
  /** Stable device identity; unlike its simulated IP, this value does not change. */
  readonly id: string
  /** Mutable presentation name; never canonical device identity. */
  readonly displayName: string
  readonly firmware: FirmwareState
  readonly filesystem: FilesystemState
  readonly network: DeviceNetworkState
  readonly hardware: HardwareState
  readonly runtime: RuntimeState
  readonly installedSoftware: readonly InstalledSoftware[]
}

export interface WalletState {
  readonly balance: number
}

/**
 * One record of NODE that actually reached the local Wallet. It is the
 * Wallet's own truth about what it received, not a transaction ledger, a
 * transfer network record, or a view of the payer's behavior: it never
 * describes where the rest of a payer's production went.
 */
export interface NodeWalletActivityRecord {
  /** Deterministic per-Wallet record identity and ordering. */
  readonly id: string
  readonly kind: 'mining_payout'
  /** Canonical integer atomic NODE units actually received by this Wallet. */
  readonly amountNodeUnits: number
}

export interface NodeWalletActivityState {
  /** Per-Wallet monotonic record identity; never rewinds even as old records are evicted. */
  readonly nextId: number
  readonly records: readonly NodeWalletActivityRecord[]
}

/**
 * Represented local NODE economic entity. Deliberately separate from
 * `WalletState`: NODE and Dollar are independent canonical economic
 * concerns (see ARCHITECTURE.md A18). `address` is a mutable-shaped
 * addressing attribute, not stable Wallet identity.
 */
export interface NodeWalletState {
  readonly id: string
  readonly address: string
  /** Canonical integer atomic NODE units; see `NODE_UNITS_PER_NODE` in nodeMiner.ts. */
  readonly balanceNodeUnits: number
  /** Bounded history of NODE this Wallet actually received. */
  readonly activity: NodeWalletActivityState
}

/**
 * A represented NODE economic recipient other than the player's local
 * Wallet, so that NODE routed away from that Wallet reaches somewhere real
 * instead of disappearing. Stable `id` is its identity; `address` is a
 * mutable addressing attribute (ARCHITECTURE.md A18).
 */
export interface NodeAccount {
  readonly id: string
  readonly address: string
  /** Canonical integer atomic NODE units; see `NODE_UNITS_PER_NODE` in nodeMiner.ts. */
  readonly balanceNodeUnits: number
}

/**
 * The represented NODE economic recipients that exist besides the local
 * Wallet. It is deliberately only a small collection of concrete accounts:
 * not a ledger, blockchain, transaction network, address registry, or
 * economy framework.
 */
export interface NodeEconomyState {
  readonly accounts: readonly NodeAccount[]
}

export interface NetworkHost {
  /** Stable entity identity; the simulated IP remains a separate attribute. */
  readonly id: string
  readonly ip: string
  readonly online: boolean
  /** Optional mutable presentation identity for a concretely operable host. */
  readonly displayName?: string
  /** Device-owned operating environment and filesystem, when represented. */
  readonly firmware?: FirmwareState
  readonly filesystem?: FilesystemState
  /** Device-owned compute resources, present only for concretely represented resource-capable hosts. */
  readonly hardware?: HardwareState
  readonly runtime?: Pick<RuntimeState, 'baselineCpuLoad' | 'baselineRamUsage'>
  /** Present only when the represented device has a concrete server role. */
  readonly role?: 'server'
  /** Network services owned by this device, not a global service registry. */
  readonly services?: readonly NetworkService[]
  /** Present only for endpoints whose transfer capability is concretely represented. */
  readonly transferCapacity?: NetworkTransferCapacity
  /** Device-owned authentication history, present only for concretely represented resource-capable hosts. */
  readonly authenticationHistory?: AuthenticationHistoryState
}

/**
 * One historical authentication-attempt record, owned by the target Device
 * that actually received the attempt. Persists independently of the
 * Process, DeviceAccess, and RemoteSession that produced it.
 */
export interface AuthenticationHistoryRecord {
  /** Deterministic per-Device record identity and ordering. */
  readonly id: string
  /** Canonical internal service provenance; not player-facing. */
  readonly serviceId: string
  /** Player-presentable snapshot of the represented service name at resolution time. */
  readonly serviceName: string
  /** Fictional source address observed by the target at resolution time; a historical snapshot, not live state. */
  readonly sourceAddress: string
  readonly result: 'SUCCESS' | 'FAILURE'
}

export interface AuthenticationHistoryState {
  /** Per-Device monotonic record identity; never rewinds even as old records are evicted. */
  readonly nextId: number
  readonly records: readonly AuthenticationHistoryRecord[]
}

export interface NetworkService {
  /** Stable service identity; name and port are mutable service attributes. */
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly open: boolean
  /** Device-owned implementation World Truth. This is not InstalledSoftware. */
  readonly implementation: {
    readonly productId: string
    readonly releaseId: string
    readonly name: string
    readonly version: string
  }
  /**
   * Present only when this Service concretely grants credential-based
   * access. `secondFactorRequired` is a real authentication condition on
   * the Service, independent of any represented vulnerability: it is not
   * discovered by Service Analysis and must not be revealed by ordinary
   * Credential Access presentation, but it still gates whether a
   * completing Credential Access attempt establishes access.
   */
  readonly credentialAccess?: { readonly privilege: 'USER'; readonly secondFactorRequired?: boolean }
}

export interface DiscoveredVulnerability {
  readonly vulnerabilityId: string
  readonly targetDeviceId: string
  readonly serviceId: string
  /** Historical presentation snapshot only; identity and gameplay use stable IDs. */
  readonly observedLabel: string
}

export interface KnowledgeState { readonly discoveredVulnerabilities: readonly DiscoveredVulnerability[] }

export interface DiscoveredNetworkSnapshot {
  readonly id: string
  readonly name: string
  readonly membersObserved: boolean
  readonly inspect?: { readonly connected: boolean }
}

export interface DiscoveredServiceSnapshot {
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  /** Endpoint captured by the service-depth observation, not reconstructed later. */
  readonly endpoint: string
  /** Historical Service facts observed by Enhanced Inspect, never live World Truth. */
  readonly inspect?: ServiceInspectSnapshot
}

/** Small, concrete Enhanced Inspect snapshot for one already-discovered Service. */
export interface ServiceInspectSnapshot {
  readonly implementation: { readonly name: string; readonly version: string }
  readonly authentication?: 'Credential' | 'Credential + Additional Verification'
}

/**
 * Reconnaissance-friendly fingerprint available only through a NodeScan
 * release capable of enhanced Inspect (currently 1.1 Experimental). Compute
 * class is a derived reconnaissance classification stored as positive player
 * information in Discovery. It is neither raw World Truth nor a universal
 * hardware-tier entity.
 */
export interface EnhancedInspectEvidence {
  readonly firmware: { readonly name: string; readonly version: string }
  readonly computeClass: 'LOW' | 'STANDARD' | 'HIGH'
}

export interface DiscoveredDeviceSnapshot {
  readonly id: string
  readonly address: string
  readonly scope: 'lan' | 'remote'
  readonly servicesObserved: boolean
  readonly services: readonly DiscoveredServiceSnapshot[]
  readonly inspect?: { readonly networkStatus: 'ONLINE'; readonly deviceKind: 'device' | 'server'; readonly enhanced?: EnhancedInspectEvidence }
}

export interface DiscoveryState {
  readonly networks: readonly DiscoveredNetworkSnapshot[]
  /** SELF is intrinsic and is intentionally absent from this collection. */
  readonly devices: readonly DiscoveredDeviceSnapshot[]
  readonly networkDeviceRelations: readonly { readonly networkId: string; readonly deviceId: string }[]
}

export interface LocalNetwork {
  /** Stable entity identity, separate from the player-visible network name. */
  readonly id: string
  readonly name: string
  /** Canonical membership relation for devices represented on this network. */
  readonly memberDeviceIds: readonly string[]
}

export interface NetworkState {
  readonly hosts: readonly NetworkHost[]
  readonly localNetworks: readonly LocalNetwork[]
}

export interface WorldState {
  readonly network: NetworkState
}

export interface DeviceAccess {
  readonly id: string
  readonly sourceDeviceId: string
  readonly targetDeviceId: string
  readonly viaServiceId: string
  readonly privilege: 'USER'
}

export interface DeviceAccessState { readonly nextId: number; readonly established: readonly DeviceAccess[] }

export interface RemoteSession {
  readonly id: string
  readonly accessId: string
  /** Address used for this connection; stable Device identity remains on DeviceAccess. */
  readonly connectedAddress: string
}

export interface RemoteSessionState { readonly nextId: number; readonly active: RemoteSession | null }

/**
 * Canonical network file-transfer runtime. Distinct from GameProcess: it is
 * not compute/RAM-driven work and must never be represented as one.
 */
export interface FileTransfer {
  readonly id: string
  /** The DeviceAccess that admitted this transfer; it runs as its own network runtime independent of any RemoteSession once admitted. */
  readonly accessId: string
  readonly sourceDeviceId: string
  readonly sourceFileId: string
  readonly destinationDeviceId: string
  readonly destinationPath: string
  readonly bytesTotal: number
  readonly bytesTransferred: number
}

export interface FileTransferState { readonly nextId: number; readonly active: FileTransfer | null }

export type RecentActivityEntry =
  | { readonly kind: 'process'; readonly id: string; readonly process: GameProcess; readonly termination?: 'cancelled' }
  | {
      readonly kind: 'file_transfer'
      readonly id: string
      readonly transfer: FileTransfer
      /** Presentation facts captured while the transfer still had resolvable endpoints. */
      readonly sourcePath?: string
      readonly route?: string
    }

export interface RecentActivityState { readonly entries: readonly RecentActivityEntry[] }

export interface GameState {
  readonly version: number
  readonly player: PlayerState
  readonly wallet: WalletState
  readonly nodeWallet: NodeWalletState
  readonly nodeEconomy: NodeEconomyState
  readonly world: WorldState
  readonly process: ProcessState
  readonly knowledge: KnowledgeState
  readonly discovery: DiscoveryState
  readonly deviceAccess: DeviceAccessState
  readonly remoteSession: RemoteSessionState
  readonly fileTransfer: FileTransferState
  /** Bounded Device-runtime observations; not a world event history. */
  readonly recentActivity: RecentActivityState
}

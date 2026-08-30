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

export type RackUpdateExploitResult =
  | { readonly status: 'submission_enabled'; readonly accessId: string }
  | { readonly status: 'attempt_failed'; readonly message: 'Exploit attempt failed.' }

/**
 * Finite represented work attacking RackUpdate's public package-submission
 * protocol through its `UPD-001` rollback-protection weakness. Unlike
 * `CredentialAccessProcess`, success never creates `DeviceAccess`: it grants
 * only the narrow `RackUpdateSubmissionAccess` relationship that enables the
 * one RackUpdate Service's own package-submission interaction (see
 * `rackUpdate.ts`). ATTACK stays distinct from ACCESS.
 */
export interface RackUpdateExploitProcess extends ProcessBase {
  readonly kind: 'rack_update_exploit'
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly startedEndpoint: string
  readonly vulnerabilityId: string
  readonly toolId: 'rollback-exploit-toolkit'
  readonly result?: RackUpdateExploitResult
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
  /**
   * The payout address currently configured on this Miner. Set explicitly at
   * RUN and changeable in place by a live payout retarget, which never ends
   * or replaces the Process. It is not Player, Device, or Wallet identity.
   */
  readonly payoutAddress: string
  /**
   * 1-based index of the payout routing segment currently in effect: the
   * period during which `payoutAddress` has held its present value. A live
   * retarget starts the next segment rather than rewriting what the previous
   * address was actually paid, which is what keeps the Miner's Device-owned
   * payout artifact historically truthful across more than one address in a
   * single run. It is an accounting boundary, not a lifecycle state: no
   * Process ends, starts, or loses accumulated work at a segment boundary.
   */
  readonly payoutSegment: number
  /**
   * Canonical integer atomic NODE units; see `NODE_UNITS_PER_NODE` in
   * nodeMiner.ts. `producedNodeUnits` is gross production from this
   * Process's own allocated compute and is never redefined downward by the
   * running release's payout behavior; the two allocation totals below
   * describe settled gross allocation, while their difference from gross is
   * accrued unpaid production.
   */
  readonly producedNodeUnits: number
  /** Cumulative gross production routed to this Process's configured `payoutAddress`. */
  readonly payoutNodeUnits: number
  /** Cumulative gross production diverted by the running release to its own embedded developer address. */
  readonly developerFeeNodeUnits: number
  /**
   * The two totals above, restricted to the current `payoutSegment`. They
   * start at zero for each new segment while the cumulative totals are never
   * rewound, so what a single configured address actually received stays
   * recoverable after a live retarget.
   */
  readonly segmentPayoutNodeUnits: number
  readonly segmentDeveloperFeeNodeUnits: number
  readonly workRemainder: number
}

export type SoftwareInstallationResult =
  | { readonly status: 'installed' }
  | { readonly status: 'install_path_occupied' }
  /** The executor Device no longer represents an installable software inventory and filesystem. */
  | { readonly status: 'target_unavailable' }

/**
 * Finite compute/RAM-driven work admitted by INSTALL. It snapshots only the
 * package facts completion actually needs; the source package artifact and
 * Device-owned InstalledSoftware are deliberately untouched until this
 * Process completes (see `resolveCompletedSoftwareInstallations` in
 * `softwareInstallation.ts`), so a package, an installation Process,
 * InstalledSoftware, and a running program remain four distinct things.
 *
 * `executorDeviceId` is the Device being installed onto, not merely the
 * Device that scheduled the work: completion applies its consequence there.
 * A remote installation deliberately retains no `accessId` or `sessionId` —
 * unlike `FileTransfer`, its runtime spans no cross-Device route, so once
 * admitted it consumes only that executor Device's own CPU, RAM, filesystem
 * and installed-software inventory and does not revalidate a relationship.
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
  readonly channel?: string
  readonly publisher?: string
  readonly result?: SoftwareRemovalResult
}

export type GameProcess = GenericProcess | ServiceAnalysisProcess | CredentialAccessProcess | RackUpdateExploitProcess | NodeMinerProcess | SoftwareInstallationProcess | SoftwareRemovalProcess

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
}

export interface BasicCredentialToolkitInstallation extends InstalledSoftware {
  readonly id: 'basic-credential-toolkit'
}

/** The concrete represented offensive tool supporting `UPD-001`; its role stays narrow, exactly like Basic Credential Toolkit's `AUTH-017` role. */
export interface RollbackExploitToolkitInstallation extends InstalledSoftware {
  readonly id: 'rollback-exploit-toolkit'
}

export interface NodeMinerInstallation extends InstalledSoftware {
  readonly id: 'node-miner'
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
  /** Client-side Dollar sign-in this Device has stored; absent on a Device that saved none. */
  readonly savedDollarSignIn?: DeviceSavedDollarSignIn
}

/**
 * Authentication material a Device has saved locally so its operator does not
 * retype it. It is Device-owned client state, deliberately not the Provider's
 * `DollarCredential`: the Provider's password can change without this copy
 * changing, which is exactly how a saved sign-in becomes stale. Holding it is
 * not authority, and it is not implied by (nor implies) a Financial Session.
 */
export interface DeviceSavedDollarSignIn {
  /** Stable identity of the saved sign-in itself; never Credential or Account identity. */
  readonly id: string
  /**
   * The stable Financial Account this saved sign-in is intended to
   * authenticate. It records intent, not authority: it is not ownership, not a
   * Session, not Credential identity, not Player identity, and it is never
   * submitted to the Provider or used to bypass authentication. It exists so
   * that a mutable login identifier cannot silently redirect the saved sign-in
   * to a different Account, and so the client can tell whether the Account it
   * is currently using already is the saved one.
   */
  readonly accountId: string
  readonly loginIdentifier: string
  /** Locally stored copy of a password, exact at the moment it was saved. */
  readonly password: string
}

export interface DollarFinancialAccount {
  /** Stable Provider-internal identity; never an account reference or login. */
  readonly id: string
  readonly accountReference: string
  /** Canonical integer cents. */
  readonly balanceCents: number
}

export interface DollarCredential {
  /** Stable Credential identity; authentication material is not authority. */
  readonly id: string
  readonly accountId: string
  readonly loginIdentifier: string
  readonly password: string
}

export interface DollarFinancialSession {
  /** Stable Session identity, newly allocated on every successful authentication. */
  readonly id: string
  readonly accountId: string
  readonly clientDeviceId: string
}

/**
 * Represented truth that one transfer between two Financial Accounts actually
 * happened. It is Provider-owned, not Device, interface or Player state, and
 * it is deliberately not a ledger: there is no pending or settled state, no
 * fee, no reversal and no double entry.
 *
 * `sourceAccountReference` and `destinationAccountReference` are historical
 * snapshots of a mutable Account attribute (A01), captured because activity
 * must keep saying what the counterparty was called when the money moved; a
 * later reference change must never rewrite history.
 */
export interface DollarTransaction {
  /** Stable Transaction identity, monotonic in canonical insertion order. */
  readonly id: string
  readonly sourceAccountId: string
  readonly destinationAccountId: string
  /** Canonical integer cents actually moved; always positive. */
  readonly amountCents: number
  readonly sourceAccountReference: string
  readonly destinationAccountReference: string
}

/** The one concrete represented Dollar Financial Provider. */
export interface DollarFinanceState {
  readonly provider: { readonly id: string; readonly displayName: string }
  readonly accounts: readonly DollarFinancialAccount[]
  readonly credentials: readonly DollarCredential[]
  readonly sessions: { readonly nextId: number; readonly active: readonly DollarFinancialSession[] }
  /** Provider-owned Transactions in canonical insertion order, oldest first. */
  readonly transactions: { readonly nextId: number; readonly records: readonly DollarTransaction[] }
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
 * `DollarFinanceState`: NODE and Dollar are independent canonical economic
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

/**
 * The concrete represented party that operates the software Market the local
 * Device can currently reach, lists its offerings, and receives the NODE a
 * purchase actually costs. It is deliberately not NODE, not NODE-OS, and not
 * the publisher of anything it distributes: NODE-OS supplies only the client
 * that presents this Market. `settlementAddress` is a mutable-shaped
 * addressing attribute pointing at a represented `NodeAccount`, never the
 * operator's identity (ARCHITECTURE.md A01, A18).
 */
export interface MarketOperator {
  readonly id: string
  readonly name: string
  readonly settlementAddress: string
}

/**
 * The concrete package artifact one Market offering distributes, held as the
 * represented facts a completed download writes to the destination
 * filesystem. `filename` is the basename the V1 download destination is
 * derived from — a distribution attribute, never artifact identity.
 */
export interface MarketPackageDistribution {
  readonly filename: string
  readonly releaseId: string
  readonly productId: string
  readonly name: string
  readonly version: string
  readonly channel: string
  /** Provenance stated by the represented release; present only where one is actually represented. */
  readonly publisher?: string
  readonly sizeBytes: number
}

/**
 * One represented Market offering: stable offer identity, the canonical
 * integer atomic NODE price the operator charges for it, and the package
 * artifact it distributes. Offer identity is what a purchase entitlement
 * refers to — never a filename, path, display name, or version string.
 */
export interface MarketOffer {
  readonly id: string
  /** Canonical integer atomic NODE units; see `NODE_UNITS_PER_NODE` in nodeMiner.ts. */
  readonly priceNodeUnits: number
  readonly distribution: MarketPackageDistribution
}

/**
 * One canonical purchase entitlement: the right to download the offering it
 * names, established exactly once by a real economic settlement. It is
 * deliberately not possession of a package — a downloaded copy may be lost
 * without losing this, and possessing a copy never creates one.
 */
export interface MarketPurchase {
  readonly id: string
  readonly offerId: string
  /** Canonical integer atomic NODE units actually paid, snapshotted at purchase. */
  readonly priceNodeUnits: number
}

export interface MarketPurchaseState {
  /** Monotonic entitlement identity; never rewinds. */
  readonly nextId: number
  readonly entitlements: readonly MarketPurchase[]
}

/**
 * The one represented broad/open software Market currently reachable from the
 * local Device. Deliberately one concrete Market rather than a market, source,
 * storefront or catalog framework: there is no source selection, no seller
 * accounts, and no trust, signing or certification state.
 */
export interface MarketState {
  readonly operator: MarketOperator
  /**
   * The Market distribution endpoint's own represented transfer capability.
   * It is the source-side capacity a Market download's rate is derived from.
   * The endpoint is not a represented Device and belongs to no represented
   * LocalNetwork, so no Network capacity or Network-owned evidence applies
   * to it.
   */
  readonly distributionCapacity: NetworkTransferCapacity
  readonly offers: readonly MarketOffer[]
  readonly purchases: MarketPurchaseState
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
  /**
   * Device-owned installed software, present only for concretely represented
   * hosts that actually own a software inventory. It is the same semantic
   * concern as `LocalDeviceState.installedSoftware` and stays entirely
   * independent of it: the same product may exist at different releases on
   * different Devices. Shallow training hosts deliberately have none rather
   * than a fabricated empty inventory.
   */
  readonly installedSoftware?: readonly InstalledSoftware[]
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
  /** Present only when this Service concretely grants credential-based access. */
  readonly credentialAccess?: { readonly privilege: 'USER' }
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
  readonly authentication?: 'Credential'
  /** A concrete observation of RackUpdate's public protocol, not live capability truth. */
  readonly interface?: 'Package submission'
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

/** A Device-to-Network relationship observed at Inspect depth. */
export interface InspectedNetworkRelationship {
  readonly id: string
  readonly name: string
}

export interface DiscoveredDeviceSnapshot {
  readonly id: string
  readonly address: string
  /** Coarse remembered location; PING deliberately records no topology classification. */
  readonly scope: 'unknown' | 'lan' | 'remote'
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
  /**
   * The Network's own represented external connectivity capability — its
   * uplink/downlink to the rest of the world, not internal LAN/switch
   * fabric between its members. Distinct from any member Device's own
   * endpoint `NetworkTransferCapacity` and from current usage, which V1
   * does not represent.
   */
  readonly transferCapacity: NetworkTransferCapacity
  /**
   * The Network's own bounded historical evidence of activity that actually
   * passed through it: canonical World Truth, entirely independent of any
   * Device's own AuthenticationHistory, of Recent Activity, and of Player
   * Knowledge/Discovery. Never exposed through Scan, Inspect, or Discovery.
   */
  readonly activityHistory: NetworkActivityHistoryState
}

/**
 * Which side of one real activity this Network's own record represents.
 * `internal` means both endpoint Devices resolved to this same Network;
 * `outbound` means this Network is the source-side Network of a
 * cross-Network (or otherwise not-both-sides-resolved) activity; `inbound`
 * means this Network is the destination-side Network.
 */
export type NetworkActivityPerspective = 'internal' | 'outbound' | 'inbound'

/**
 * One historical Network-owned connection-attempt record: a Credential
 * Access attempt that actually reached the represented target Device/service,
 * observed from this Network's own local perspective. Deliberately excludes
 * Player identity, toolkit identity, vulnerability identity, and attack
 * labels, none of which are network-observable/topology-relevant truth.
 */
export interface NetworkConnectionAttemptRecord {
  /** Deterministic per-Network record identity and ordering. */
  readonly id: string
  readonly kind: 'connection_attempt'
  readonly perspective: NetworkActivityPerspective
  readonly sourceDeviceId: string
  readonly targetDeviceId: string
  /** Fictional source address observed at resolution time; a historical snapshot, not live state. */
  readonly sourceAddress: string
  /** Fictional target address observed at resolution time; a historical snapshot, not live state. */
  readonly targetAddress: string
  /** Canonical internal service provenance; not player-facing. */
  readonly serviceId: string
  /** Player-presentable snapshot of the represented service name at resolution time. */
  readonly serviceName: string
  readonly result: 'SUCCESS' | 'FAILURE'
}

/**
 * One historical Network-owned FileTransfer record, appended only once an
 * admitted FileTransfer reaches a terminal outcome, observed from this
 * Network's own local perspective. Deliberately excludes filesystem path,
 * filename, file contents, and software/vulnerability/Dollar semantics.
 */
export interface NetworkTransferRecord {
  /** Deterministic per-Network record identity and ordering. */
  readonly id: string
  readonly kind: 'file_transfer'
  readonly perspective: NetworkActivityPerspective
  readonly sourceDeviceId: string
  readonly destinationDeviceId: string
  /** Fictional source address observed at the terminal moment; a historical snapshot, not live state. */
  readonly sourceAddress: string
  /** Fictional destination address observed at the terminal moment; a historical snapshot, not live state. */
  readonly destinationAddress: string
  /** Bytes actually transferred at the terminal moment, not necessarily `bytesTotal`. */
  readonly bytesTransferred: number
  readonly result: 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED'
}

/**
 * One historical Network-owned RackUpdate package-submission record, appended
 * only once an admitted submission reaches a terminal outcome, observed from
 * this Network's own local perspective. Deliberately its own concrete record
 * kind rather than `NetworkTransferRecord`: a RackUpdate submission is not a
 * FileTransfer, and canonical Network World Truth must not claim one
 * occurred when the represented cause was a Service package submission.
 * Shares `NetworkTransferRecord`'s exact retention, membership/perspective,
 * and terminal-result semantics, and equally excludes filesystem path,
 * filename, file contents, and software/vulnerability/Dollar semantics.
 */
export interface NetworkPackageSubmissionRecord {
  /** Deterministic per-Network record identity and ordering. */
  readonly id: string
  readonly kind: 'package_submission'
  readonly perspective: NetworkActivityPerspective
  readonly sourceDeviceId: string
  readonly destinationDeviceId: string
  /** Fictional source address observed at the terminal moment; a historical snapshot, not live state. */
  readonly sourceAddress: string
  /** Fictional destination address observed at the terminal moment; a historical snapshot, not live state. */
  readonly destinationAddress: string
  /** Bytes actually transferred at the terminal moment, not necessarily `bytesTotal`. */
  readonly bytesTransferred: number
  readonly result: 'COMPLETED' | 'CANCELLED' | 'INTERRUPTED'
}

export type NetworkActivityRecord = NetworkConnectionAttemptRecord | NetworkTransferRecord | NetworkPackageSubmissionRecord

export interface NetworkActivityHistoryState {
  /** Per-Network monotonic record identity; never rewinds even as old records are evicted. */
  readonly nextId: number
  readonly records: readonly NetworkActivityRecord[]
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
 * What every canonical FileTransfer records regardless of where its bytes
 * come from: the destination it was admitted against and its elapsed
 * progress. Distinct from GameProcess: a transfer is not compute/RAM-driven
 * work and must never be represented as one.
 */
interface FileTransferCommon {
  readonly id: string
  readonly destinationDeviceId: string
  readonly destinationPath: string
  readonly bytesTotal: number
  readonly bytesTransferred: number
}

/**
 * A transfer between two represented Devices. Its authority is the
 * `DeviceAccess` relationship that admitted it, revalidated on every
 * advancement; it runs as its own network runtime independent of any
 * RemoteSession once admitted.
 */
export interface DeviceAccessFileTransfer extends FileTransferCommon {
  readonly origin: 'device_access'
  readonly accessId: string
  readonly sourceDeviceId: string
  readonly sourceFileId: string
}

/**
 * A transfer from the represented Market's own distribution endpoint to the
 * local Device. Its authority is the player's purchase entitlement for
 * `offerId`, and its source is that offer's represented package
 * distribution — not a Device filesystem, not a DeviceAccess, and not a
 * RemoteSession. Nothing about it implies the player reached a Device.
 */
export interface MarketDistributionFileTransfer extends FileTransferCommon {
  readonly origin: 'market_distribution'
  readonly offerId: string
}

/** Canonical network file-transfer runtime; exactly one may be active. */
export type FileTransfer = DeviceAccessFileTransfer | MarketDistributionFileTransfer

export interface FileTransferState { readonly nextId: number; readonly active: FileTransfer | null }

/**
 * The narrow relationship a successful RackUpdate exploit grants: the right
 * to use exactly one RackUpdate Service's own package-submission interface.
 * Deliberately not `DeviceAccess`: it carries no privilege, authorizes no
 * filesystem, RemoteSession, or credential authority, and enables nothing
 * beyond that one Service's own submission protocol.
 */
export interface RackUpdateSubmissionAccess {
  readonly id: string
  readonly sourceDeviceId: string
  readonly targetDeviceId: string
  readonly viaServiceId: string
}

export interface RackUpdateAccessState { readonly nextId: number; readonly established: readonly RackUpdateSubmissionAccess[] }

/**
 * Represented finite network upload work carrying one local GateSSH package's
 * bytes to a RackUpdate Service's own package-submission interface. Distinct
 * from `FileTransfer`: the destination is a Service interaction, not a
 * foreign filesystem path, so completion never creates a destination
 * filesystem artifact — it applies the submitted release to the target's
 * canonical Service implementation instead (see `rackUpdate.ts`).
 */
export interface RackUpdatePackageSubmission {
  readonly id: string
  /** The `RackUpdateSubmissionAccess` that authorized this submission. */
  readonly accessId: string
  readonly sourceDeviceId: string
  readonly sourceFileId: string
  readonly targetDeviceId: string
  readonly serviceId: string
  readonly bytesTotal: number
  readonly bytesTransferred: number
}

export interface RackUpdateSubmissionState { readonly nextId: number; readonly active: RackUpdatePackageSubmission | null }

export interface RackUpdateState {
  readonly access: RackUpdateAccessState
  readonly submission: RackUpdateSubmissionState
}

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
  readonly dollarFinance: DollarFinanceState
  readonly nodeWallet: NodeWalletState
  readonly nodeEconomy: NodeEconomyState
  /** The represented software Market and the player's purchase entitlements in it. */
  readonly market: MarketState
  readonly world: WorldState
  readonly process: ProcessState
  readonly knowledge: KnowledgeState
  readonly discovery: DiscoveryState
  readonly deviceAccess: DeviceAccessState
  readonly remoteSession: RemoteSessionState
  readonly fileTransfer: FileTransferState
  readonly rackUpdate: RackUpdateState
  /** The player's represented in-world mailbox; communication, not Discovery or Knowledge. */
  readonly mail: MailState
  /** Bounded Device-runtime observations; not a world event history. */
  readonly recentActivity: RecentActivityState
}

/**
 * The player's represented in-world mail account: the identity that owns the
 * mailbox. It is deliberately not a Device, not NODE-OS, and not a product or
 * browser login — NODE-OS is only the client currently presenting this
 * mailbox. `address` is a communicated addressing attribute, never identity
 * (ARCHITECTURE.md A01).
 */
export interface MailAccount {
  readonly id: string
  readonly address: string
}

/**
 * A represented identity the player corresponds with. It is a concrete
 * correspondent only: not an NPC, Actor, Organization, or trust-bearing
 * entity, and it owns no mood, stage, or relationship state.
 */
export interface MailCorrespondent {
  readonly id: string
  /** Mutable presentation identity; never correspondent identity. */
  readonly name: string
  readonly address: string
}

interface MailMessageBase {
  /** Deterministic mailbox-monotonic message identity and ordering. */
  readonly id: string
  readonly threadId: string
  /**
   * Exactly what was communicated. Authored correspondence and player text are
   * both snapshotted here when the message is created, so a message never
   * live-projects mutable World Truth and never changes when the World does.
   */
  readonly body: string
}

/** A message the represented correspondent sent to the player's account. */
export interface IncomingMailMessage extends MailMessageBase {
  readonly sender: 'correspondent'
  readonly correspondentId: string
  /**
   * Canonical read state. Only incoming correspondence carries one, so a
   * player-sent message cannot contribute to an unread count by construction.
   */
  readonly read: boolean
}

/** A message the player sent from their own account. */
export interface OutgoingMailMessage extends MailMessageBase {
  readonly sender: 'account'
}

export type MailMessage = IncomingMailMessage | OutgoingMailMessage

/**
 * One correspondence with one represented correspondent. V1 threads are
 * authored; nothing creates a thread at runtime, so the mailbox needs no
 * thread identity allocation.
 */
export interface MailThread {
  readonly id: string
  readonly correspondentId: string
  readonly subject: string
}

/**
 * The player's canonical mailbox: who they are in mail, who has written to
 * them, and everything that was actually said. Derived presentation values
 * (unread counts, previews, latest sender, ordering) are never stored here —
 * they are derived from this state. Thread order is authored order: V1
 * represents no time, so nothing is re-sorted by an invented chronology.
 */
export interface MailState {
  readonly account: MailAccount
  readonly correspondents: readonly MailCorrespondent[]
  readonly threads: readonly MailThread[]
  /** Mailbox-monotonic message identity; never rewinds. */
  readonly nextMessageId: number
  readonly messages: readonly MailMessage[]
}

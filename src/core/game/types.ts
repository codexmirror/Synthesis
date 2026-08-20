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
  | { readonly status: 'attempt_failed'; readonly message: 'Target no longer responds as expected.' }

interface ProcessBase {
  readonly id: string
  readonly label: string
  readonly executorDeviceId: string
  readonly status: 'running' | 'completed'
  readonly workRequired: number
  readonly workCompleted: number
  readonly ramRequiredMiB: number
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

export type GameProcess = GenericProcess | ServiceAnalysisProcess | CredentialAccessProcess

export interface ProcessState {
  readonly nextId: number
  readonly processes: readonly GameProcess[]
}

export interface DeviceNetworkState {
  readonly ip: string
}

export interface FirmwareState {
  readonly id: string
  readonly name: string
  readonly version: string
}

export interface TextFile {
  readonly path: string
  readonly content: string
}

export interface FilesystemState {
  readonly files: readonly TextFile[]
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
  readonly tools: readonly { readonly id: 'basic-credential-toolkit'; readonly name: 'Basic Credential Toolkit' }[]
}

export interface WalletState {
  readonly balance: number
}

export interface NetworkHost {
  /** Stable entity identity; the simulated IP remains a separate attribute. */
  readonly id: string
  readonly ip: string
  readonly online: boolean
  /** Present only when the represented device has a concrete server role. */
  readonly role?: 'server'
  /** Network services owned by this device, not a global service registry. */
  readonly services?: readonly NetworkService[]
}

export interface NetworkService {
  /** Stable service identity; name and port are mutable service attributes. */
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly open: boolean
  readonly vulnerabilities?: readonly Vulnerability[]
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
}

export interface DiscoveredServiceSnapshot {
  readonly id: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  /** Endpoint captured by the service-depth observation, not reconstructed later. */
  readonly endpoint: string
}

export interface DiscoveredDeviceSnapshot {
  readonly id: string
  readonly address: string
  readonly scope: 'lan' | 'remote'
  readonly servicesObserved: boolean
  readonly services: readonly DiscoveredServiceSnapshot[]
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

export interface GameState {
  readonly version: number
  readonly player: PlayerState
  readonly wallet: WalletState
  readonly world: WorldState
  readonly process: ProcessState
  readonly knowledge: KnowledgeState
  readonly discovery: DiscoveryState
  readonly deviceAccess: DeviceAccessState
  readonly remoteSession: RemoteSessionState
}

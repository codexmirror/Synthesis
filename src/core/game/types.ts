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

export type GameProcess = GenericProcess | ServiceAnalysisProcess

export interface ProcessState {
  readonly nextId: number
  readonly processes: readonly GameProcess[]
}

export interface DeviceNetworkState {
  readonly ip: string
}

export interface LocalDeviceState {
  /** Stable device identity; unlike its simulated IP, this value does not change. */
  readonly id: string
  readonly network: DeviceNetworkState
  readonly hardware: HardwareState
  readonly runtime: RuntimeState
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
}

export interface DiscoveredVulnerability {
  readonly vulnerabilityId: string
  readonly targetDeviceId: string
  readonly serviceId: string
  /** Historical presentation snapshot only; identity and gameplay use stable IDs. */
  readonly observedLabel: string
}

export interface KnowledgeState { readonly discoveredVulnerabilities: readonly DiscoveredVulnerability[] }

export interface DiscoveredNetworkMemory {
  readonly id: string
  readonly name: string
  readonly hasObservedMembers: boolean
}

export interface DiscoveredDeviceMemory {
  readonly id: string
  readonly address: string
  readonly scope: 'lan' | 'remote'
  readonly hasObservedServices: boolean
}

export interface NetworkDeviceRelationship {
  readonly networkId: string
  readonly deviceId: string
}

/** A historical service observation, including the endpoint that was observed. */
export interface DiscoveredServiceMemory {
  readonly deviceId: string
  readonly serviceId: string
  readonly name: string
  readonly port: number
  readonly protocol: 'TCP' | 'UDP'
  readonly observedEndpoint: string
}

export interface DiscoveryState {
  readonly networks: readonly DiscoveredNetworkMemory[]
  readonly devices: readonly DiscoveredDeviceMemory[]
  readonly networkDeviceRelationships: readonly NetworkDeviceRelationship[]
  readonly services: readonly DiscoveredServiceMemory[]
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

export interface GameState {
  readonly version: number
  readonly player: PlayerState
  readonly wallet: WalletState
  readonly world: WorldState
  readonly process: ProcessState
  readonly discovery: DiscoveryState
  readonly knowledge: KnowledgeState
}

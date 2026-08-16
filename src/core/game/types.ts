export interface PlayerState {
  /** Stable player identity, separate from every device the player owns. */
  readonly id: string
  readonly localDevice: LocalDeviceState
}

export interface HardwareState {
  readonly cpu: string
  readonly ram: string
}

export interface RuntimeState {
  readonly cpuLoad: number
  readonly ramUsage: number
  readonly networkStatus: 'ONLINE' | 'OFFLINE'
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
}

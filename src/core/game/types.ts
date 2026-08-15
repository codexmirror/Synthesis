export interface PlayerState {
  /** Stable entity identity; unlike the simulated IP, this value does not change. */
  readonly id: string
  readonly ip: string
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

export interface SystemState {
  readonly hardware: HardwareState
  readonly runtime: RuntimeState
}

export interface WalletState {
  readonly balance: number
}

export interface GameState {
  readonly version: number
  readonly player: PlayerState
  readonly system: SystemState
  readonly wallet: WalletState
}

export interface PlayerState {
  /** Stable entity identity; unlike the simulated IP, this value does not change. */
  id: string
  ip: string
}

export interface HardwareState {
  cpu: string
  ram: string
}

export interface RuntimeState {
  cpuLoad: number
  ramUsage: number
  networkStatus: 'ONLINE' | 'OFFLINE'
}

export interface SystemState {
  hardware: HardwareState
  runtime: RuntimeState
}

export interface WalletState {
  balance: number
}

export interface GameState {
  version: number
  player: PlayerState
  system: SystemState
  wallet: WalletState
}

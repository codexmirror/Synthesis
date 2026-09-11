import type { GameState } from '../core/game/types'

export const ONLINE_PERSISTENCE_VERSION = 1

export interface AccountRecord {
  readonly id: string
  readonly normalizedName: string
  readonly passwordHash: string
  readonly playerId: string
}

export interface AuthenticationSessionRecord {
  readonly id: string
  readonly accountId: string
  readonly tokenHash: string
  readonly createdAt: string
}

/** State whose meaning belongs to one Player, not to the shared authored world. */
export type PlayerPrivateState = Pick<GameState,
  'player' | 'nodeWallet' | 'market' | 'knowledge' | 'discovery' |
  'deviceAccess' | 'networkManagement' | 'remoteSession' | 'fileTransfer' |
  'rackUpdate' | 'mail' | 'process' | 'recentActivity'> & {
    /** V0 keeps the starter Civic identity and session private as one slice. */
    readonly dollarFinance: GameState['dollarFinance']
  }

export interface PlayerRecord {
  readonly id: string
  readonly homeNetworkId: string
  readonly gatewayDeviceId: string
  readonly starterServerDeviceId: string
  readonly privateState: PlayerPrivateState
}

export interface OnlineWorldDocument {
  readonly persistenceVersion: typeof ONLINE_PERSISTENCE_VERSION
  readonly nextHomeSubnet: number
  readonly sharedState: GameState
  readonly accounts: readonly AccountRecord[]
  readonly sessions: readonly AuthenticationSessionRecord[]
  readonly players: readonly PlayerRecord[]
}

export interface AuthenticatedSnapshot {
  readonly playerId: string
  readonly state: GameState
  readonly homeNetworkId: string
  readonly gatewayDeviceId: string
}

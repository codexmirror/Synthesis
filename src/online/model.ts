import type { DollarCredential, DollarFinancialAccount, DollarFinancialSession, GameState, LocalDeviceState, MailState, MarketPurchaseState } from '../core/game/types'

export const ONLINE_PERSISTENCE_VERSION = 2

export interface AccountRecord { readonly id: string; readonly normalizedName: string; readonly passwordHash: string; readonly playerId: string }
export interface AuthenticationSessionRecord { readonly id: string; readonly accountId: string; readonly tokenHash: string; readonly createdAt: string }

/** Shared owners are stored once, never copied into Player records. */
export interface SharedOnlineState {
  readonly state: GameState
  /** Canonical Player-owned Devices. `player.localDevice` is composed from here. */
  readonly playerDevices: readonly LocalDeviceState[]
}

export type PlayerPrivateState = Pick<GameState,
  'nodeWallet' | 'knowledge' | 'discovery' | 'deviceAccess' | 'networkManagement' |
  'remoteSession' | 'fileTransfer' | 'rackUpdate' | 'mail' | 'process' | 'recentActivity'> & {
    readonly marketPurchases: MarketPurchaseState
    readonly dollarAccount: DollarFinancialAccount
    readonly dollarCredential: DollarCredential
    readonly dollarSessions: { readonly nextId: number; readonly active: readonly DollarFinancialSession[] }
  }

export interface PlayerRecord {
  readonly id: string
  readonly ownedDeviceIds: readonly string[]
  readonly primaryDeviceId: string
  readonly homeNetworkId: string
  readonly gatewayDeviceId: string
  readonly starterServerDeviceId: string
  readonly privateState: PlayerPrivateState
}

export interface OnlineWorldDocument {
  readonly persistenceVersion: typeof ONLINE_PERSISTENCE_VERSION
  readonly nextHomeSubnet: number
  readonly shared: SharedOnlineState
  readonly accounts: readonly AccountRecord[]
  readonly sessions: readonly AuthenticationSessionRecord[]
  readonly players: readonly PlayerRecord[]
}

export interface AuthenticatedSnapshot { readonly playerId: string; readonly state: GameState; readonly homeNetworkId: string; readonly gatewayDeviceId: string }

export type OnlineObservationResponse<TResult = unknown> = { readonly result: TResult; readonly snapshot: AuthenticatedSnapshot }

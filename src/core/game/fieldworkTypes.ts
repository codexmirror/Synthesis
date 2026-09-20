/** Sandbox fieldwork: broker-owned requests and Device-owned maintenance. */
export interface RecoveryRequest {
  readonly id: string
  readonly company: string
  readonly address: string
  readonly title: string
  readonly brief: string
  readonly filename: string
  readonly reward: number
  readonly digest: string
  readonly delivered?: boolean
}
export interface FieldworkState {
  readonly edition: 1
  readonly lastNotice?: string
  readonly requests: readonly RecoveryRequest[]
  readonly nextDispatch: number
  readonly elapsedMs: number
  readonly dispatchRemainingMs: number
  readonly receipts: readonly { readonly requestId: string; readonly title: string; readonly reward: number }[]
}
export interface ServiceKey {
  readonly serviceId: string
  readonly secret: string
}
export interface SecurityMaintenance {
  readonly intervalMs: number
  readonly remainingMs: number
  readonly observedAuthCounter: number
  readonly rotations: number
}

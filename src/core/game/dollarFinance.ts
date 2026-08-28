import type { DollarFinancialAccount, GameState } from './types'

export type AuthenticateDollarAccountResult =
  | { readonly status: 'authenticated'; readonly state: GameState; readonly sessionId: string }
  | { readonly status: 'invalid_credentials' | 'device_not_found' | 'account_unavailable'; readonly state: GameState }

export type LogoutDollarAccountResult =
  | { readonly status: 'logged_out'; readonly state: GameState }
  | { readonly status: 'not_signed_in'; readonly state: GameState }

function representedDeviceExists(state: GameState, deviceId: string): boolean {
  return state.player.localDevice.id === deviceId || state.world.network.hosts.some(({ id }) => id === deviceId)
}

/** Exact represented authentication. A Credential can establish authority but is never authority itself. */
export function authenticateDollarAccount(state: GameState, clientDeviceId: string, loginIdentifier: string, password: string): AuthenticateDollarAccountResult {
  if (!representedDeviceExists(state, clientDeviceId)) return { status: 'device_not_found', state }
  const credential = state.dollarFinance.credentials.find((candidate) => candidate.loginIdentifier === loginIdentifier)
  if (!credential || credential.password !== password) return { status: 'invalid_credentials', state }
  const account = state.dollarFinance.accounts.find(({ id }) => id === credential.accountId)
  if (!account) return { status: 'account_unavailable', state }

  const sessionId = `dollar-session-${String(state.dollarFinance.sessions.nextId).padStart(4, '0')}`
  const active = state.dollarFinance.sessions.active.filter((session) => session.clientDeviceId !== clientDeviceId)
  return {
    status: 'authenticated', sessionId,
    state: { ...state, dollarFinance: { ...state.dollarFinance, sessions: { nextId: state.dollarFinance.sessions.nextId + 1, active: [...active, { id: sessionId, accountId: account.id, clientDeviceId }] } } },
  }
}

/** Resolves presentation/operation authority only through Device -> Session -> Account. */
export function resolveDollarAccountForDevice(state: GameState, clientDeviceId: string): DollarFinancialAccount | undefined {
  if (!representedDeviceExists(state, clientDeviceId)) return undefined
  const sessions = state.dollarFinance.sessions.active.filter((session) => session.clientDeviceId === clientDeviceId)
  if (sessions.length !== 1) return undefined
  return state.dollarFinance.accounts.find(({ id }) => id === sessions[0].accountId)
}

export function logoutDollarAccount(state: GameState, clientDeviceId: string): LogoutDollarAccountResult {
  const active = state.dollarFinance.sessions.active.filter((session) => session.clientDeviceId !== clientDeviceId)
  if (active.length === state.dollarFinance.sessions.active.length) return { status: 'not_signed_in', state }
  return { status: 'logged_out', state: { ...state, dollarFinance: { ...state.dollarFinance, sessions: { ...state.dollarFinance.sessions, active } } } }
}

export function formatDollarCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

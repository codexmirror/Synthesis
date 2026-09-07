import { placeBookstoreRestockOrder, type PlaceBookstoreRestockOrderResult } from './bookstoreRestock'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { CompanyAdministrationSession, CompanyState, GameState } from './types'

/**
 * Resolve explicit Device-bound authority for one Company from represented
 * Business truth. Device and Company identity must each resolve uniquely, and
 * the pair must have exactly one active Session; every malformed or ambiguous
 * relationship fails closed.
 */
export function resolveCompanyAdministrationSession(
  state: GameState,
  clientDeviceId: string,
  companyId: string,
): CompanyAdministrationSession | undefined {
  const devices = [state.player.localDevice, ...state.world.network.hosts]
    .filter(({ id }) => id === clientDeviceId)
  if (devices.length !== 1) return undefined
  if (state.business.companies.filter(({ id }) => id === companyId).length !== 1) return undefined
  const sessions = state.business.administrationSessions
    .filter((session) => session.clientDeviceId === clientDeviceId && session.companyId === companyId)
  if (sessions.length !== 1) return undefined
  return state.business.administrationSessions.filter(({ id }) => id === sessions[0].id).length === 1
    ? sessions[0]
    : undefined
}

/**
 * What exactly one Device may currently administer, for a management client
 * that supports a single unambiguous Company context.
 *
 * `ambiguous` is deliberately distinct from `unavailable`: a Device that holds
 * administration authority for several Companies genuinely has authority, and
 * silently managing whichever one happened to be listed first would be an
 * invented choice. Selecting between them is unimplemented, not resolved.
 */
export type SoleCompanyAdministrationContext =
  | { readonly status: 'administered'; readonly session: CompanyAdministrationSession; readonly company: CompanyState }
  | { readonly status: 'unavailable' }
  | { readonly status: 'ambiguous' }

/**
 * Resolve the one Company this Device may administer, or state honestly that
 * there is none or more than one. Every individual relationship still goes
 * through `resolveCompanyAdministrationSession`, so duplicate, dangling and
 * otherwise malformed represented truth continues to fail closed rather than
 * being resolved here a second, weaker way.
 */
export function resolveSoleCompanyAdministrationContextForDevice(state: GameState, clientDeviceId: string): SoleCompanyAdministrationContext {
  const companyIds = [...new Set(state.business.administrationSessions
    .filter((session) => session.clientDeviceId === clientDeviceId)
    .map(({ companyId }) => companyId))]
  if (companyIds.length === 0) return { status: 'unavailable' }
  if (companyIds.length > 1) return { status: 'ambiguous' }
  const session = resolveCompanyAdministrationSession(state, clientDeviceId, companyIds[0])
  if (!session) return { status: 'unavailable' }
  const companies = state.business.companies.filter(({ id }) => id === session.companyId)
  return companies.length === 1 ? { status: 'administered', session, company: companies[0] } : { status: 'unavailable' }
}

/** The same resolution for whichever Device the player currently operates; RemoteSession supplies only that identity. */
export function resolveSoleCompanyAdministrationContextForOperatedRemoteDevice(state: GameState): SoleCompanyAdministrationContext {
  const remote = resolveActiveRemoteTarget(state)
  return remote ? resolveSoleCompanyAdministrationContextForDevice(state, remote.target.id) : { status: 'unavailable' }
}

export type PlaceAuthorizedBookstoreRestockOrderResult =
  | PlaceBookstoreRestockOrderResult
  | { readonly status: 'administration_unavailable'; readonly state: GameState }

/**
 * Device-level authority boundary for the existing Bookstore-owned action.
 * Branch identity determines the Company; all commercial validation and
 * settlement remain inside `placeBookstoreRestockOrder`.
 */
export function placeBookstoreRestockOrderForDevice(
  state: GameState,
  actingDeviceId: string,
  branchId: string,
  offerId: string,
): PlaceAuthorizedBookstoreRestockOrderResult {
  const branches = state.business.branches.filter(({ id }) => id === branchId)
  if (branches.length !== 1) return { status: 'branch_unavailable', state }
  if (!resolveCompanyAdministrationSession(state, actingDeviceId, branches[0].companyId)) {
    return { status: 'administration_unavailable', state }
  }
  return placeBookstoreRestockOrder(state, branchId, offerId)
}

export type PlaceOperatedBookstoreRestockOrderResult =
  | PlaceAuthorizedBookstoreRestockOrderResult
  | { readonly status: 'session_unavailable'; readonly state: GameState }

/** RemoteSession supplies only the currently operated Device identity. */
export function placeBookstoreRestockOrderFromOperatedRemoteDevice(
  state: GameState,
  branchId: string,
  offerId: string,
): PlaceOperatedBookstoreRestockOrderResult {
  const remote = resolveActiveRemoteTarget(state)
  if (!remote) return { status: 'session_unavailable', state }
  return placeBookstoreRestockOrderForDevice(state, remote.target.id, branchId, offerId)
}

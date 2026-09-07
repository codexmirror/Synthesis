import { placeBookstoreRestockOrder, type PlaceBookstoreRestockOrderResult } from './bookstoreRestock'
import { resolveActiveRemoteTarget } from './remoteSession'
import type { CompanyAdministrationSession, GameState } from './types'

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

import {
  authenticateDollarAccount,
  authenticateDollarAccountWithSavedSignIn,
  logoutDollarAccount,
  transferDollars,
  transferDollarsFromOperatedRemoteDevice,
  type AuthenticateDollarAccountResult,
  type AuthenticateWithSavedDollarSignInResult,
  type LogoutDollarAccountResult,
  type TransferDollarsResult,
  type TransferRemoteDollarsResult,
} from '../core/game/dollarFinance'
import { commitResult, type GameStateAccessor } from './gameStateAccess'

export function createDollarFinanceActions(accessor: GameStateAccessor) {
  return {
    authenticateDollarAccount(loginIdentifier: string, password: string): AuthenticateDollarAccountResult {
      const state = accessor.read()
      return commitResult(accessor, authenticateDollarAccount(state, state.player.localDevice.id, loginIdentifier, password))
    },
    authenticateDollarAccountWithSavedSignIn(): AuthenticateWithSavedDollarSignInResult {
      const state = accessor.read()
      return commitResult(accessor, authenticateDollarAccountWithSavedSignIn(state, state.player.localDevice.id))
    },
    logoutDollarAccount(): LogoutDollarAccountResult {
      const state = accessor.read()
      return commitResult(accessor, logoutDollarAccount(state, state.player.localDevice.id))
    },
    transferDollars(recipientAccountReference: string, amountCents: number): TransferDollarsResult {
      const state = accessor.read()
      return commitResult(accessor, transferDollars(state, state.player.localDevice.id, recipientAccountReference, amountCents))
    },
    /** Deliberately no Device argument: the acting Device is resolved from the active Remote Session inside the domain operation. */
    transferRemoteDollars(recipientAccountReference: string, amountCents: number): TransferRemoteDollarsResult {
      return commitResult(accessor, transferDollarsFromOperatedRemoteDevice(accessor.read(), recipientAccountReference, amountCents))
    },
  }
}

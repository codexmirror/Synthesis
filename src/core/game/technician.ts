import { enablePetraPhoneWalletProtectionForTechnicianResponse } from './deviceSecurity'
import type { GameState } from './types'

export const PETRA_TECHNICIAN_RESPONSE_DELAY_MS = 5_000
export const PETRA_PHONE_DEVICE_ID = 'host-phone-001'
export const TECHNICIAN_CORRESPONDENT_ID = 'correspondent-technician-v0'
export const TECHNICIAN_NAME = 'Technician'
export const PETRA_TECHNICIAN_MESSAGE_ID = 'petra-company-message-0002'
export const PETRA_TECHNICIAN_MESSAGE =
  'Maybe someone had access to your phone? I changed your Wallet security settings.'
const PETRA_COMPLAINT_MESSAGE_ID = 'petra-company-message-0001'

/** Starts the Technician's one concrete current case after Petra has actually complained. */
export function scheduleTechnicianPetraWalletReaction(state: GameState, transactionId: string): GameState {
  if (state.technicianReaction.pending
    || state.petraCompanyChat.messages.some(({ id }) => id === PETRA_TECHNICIAN_MESSAGE_ID)) return state
  return {
    ...state,
    technicianReaction: { pending: { transactionId, remainingMs: PETRA_TECHNICIAN_RESPONSE_DELAY_MS } },
  }
}

/**
 * Advances the Technician's Petra Wallet incident response: observe the complaint and
 * its retained Transaction, assess only the phone's current Wallet setting,
 * perform narrow defensive maintenance when applicable, then report the real
 * change. Clearing a due response first makes every terminal branch final.
 */
export function advanceTechnicianReaction(state: GameState, elapsedMs: number): GameState {
  const pending = state.technicianReaction.pending
  if (!pending || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return state
  if (elapsedMs < pending.remainingMs) return {
    ...state,
    technicianReaction: { pending: { ...pending, remainingMs: pending.remainingMs - elapsedMs } },
  }

  let resolved: GameState = { ...state, technicianReaction: { pending: null } }
  const complaint = resolved.petraCompanyChat.messages.find(({ id, causedByTransactionId }) =>
    id === PETRA_COMPLAINT_MESSAGE_ID && causedByTransactionId === pending.transactionId)
  const transaction = resolved.dollarFinance.transactions.records.find(({ id }) => id === pending.transactionId)
  if (!complaint || !transaction
    || transaction.sourceAccountId !== 'dollar-account-veyra-phone-v0'
    || transaction.destinationAccountId !== 'dollar-account-local-v0') return resolved

  const maintenance = enablePetraPhoneWalletProtectionForTechnicianResponse(resolved)
  if (maintenance.status !== 'changed') return resolved
  resolved = maintenance.state
  return {
    ...resolved,
    petraCompanyChat: {
      ...resolved.petraCompanyChat,
      messages: [...resolved.petraCompanyChat.messages, {
        id: PETRA_TECHNICIAN_MESSAGE_ID,
        authorId: TECHNICIAN_CORRESPONDENT_ID,
        authorName: TECHNICIAN_NAME,
        body: PETRA_TECHNICIAN_MESSAGE,
        causedByTransactionId: pending.transactionId,
      }],
    },
  }
}

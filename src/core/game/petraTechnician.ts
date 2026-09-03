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

/** Starts the one concrete delayed response after Petra has actually complained. */
export function schedulePetraTechnicianReaction(state: GameState, transactionId: string): GameState {
  if (state.petraTechnicianReaction.pending
    || state.petraCompanyChat.messages.some(({ id }) => id === PETRA_TECHNICIAN_MESSAGE_ID)) return state
  return {
    ...state,
    petraTechnicianReaction: { pending: { transactionId, remainingMs: PETRA_TECHNICIAN_RESPONSE_DELAY_MS } },
  }
}

/**
 * Advances Petra's one authored incident response: observe the complaint and
 * its retained Transaction, assess only the phone's current Wallet setting,
 * perform narrow defensive maintenance when applicable, then report the real
 * change. Clearing a due response first makes every terminal branch final.
 */
export function advancePetraTechnicianReaction(state: GameState, elapsedMs: number): GameState {
  const pending = state.petraTechnicianReaction.pending
  if (!pending || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return state
  if (elapsedMs < pending.remainingMs) return {
    ...state,
    petraTechnicianReaction: { pending: { ...pending, remainingMs: pending.remainingMs - elapsedMs } },
  }

  let resolved: GameState = { ...state, petraTechnicianReaction: { pending: null } }
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

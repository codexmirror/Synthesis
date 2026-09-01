import type { DollarTransaction, GameState, PetraCompanyChatState } from './types'

export const PETRA_PHONE_ACCOUNT_ID = 'dollar-account-veyra-phone-v0'
export const PLAYER_DOLLAR_ACCOUNT_ID = 'dollar-account-local-v0'
export const PETRA_COMPANY_CHAT_ID = 'petra-company-chat-v0'
export const PETRA_COMPANY_CHAT_NAME = 'Company Chat'
export const PETRA_CORRESPONDENT_ID = 'correspondent-petra-v0'
export const PETRA_NAME = 'Petra'
export const PETRA_UNUSUAL_TRANSACTION_MESSAGE =
  'There’s a transaction from the work phone that I don’t recognize. Can someone take a look?'

export function createInitialPetraCompanyChatState(): PetraCompanyChatState {
  return { id: PETRA_COMPANY_CHAT_ID, name: PETRA_COMPANY_CHAT_NAME, messages: [] }
}

/**
 * Resolves Petra's one immediate reaction only after the successful transfer's
 * canonical Transaction has been appended. The message history itself makes
 * this authored V1 reaction idempotent; no reaction stage or event registry is
 * represented beside it.
 */
export function resolvePetraTransactionReaction(state: GameState, transaction: DollarTransaction): GameState {
  if (transaction.sourceAccountId !== PETRA_PHONE_ACCOUNT_ID
    || transaction.destinationAccountId !== PLAYER_DOLLAR_ACCOUNT_ID
    || !state.dollarFinance.transactions.records.some(({ id }) => id === transaction.id)
    || state.petraCompanyChat.messages.length > 0) return state

  return {
    ...state,
    petraCompanyChat: {
      ...state.petraCompanyChat,
      messages: [{
        id: 'petra-company-message-0001',
        authorId: PETRA_CORRESPONDENT_ID,
        authorName: PETRA_NAME,
        body: PETRA_UNUSUAL_TRANSACTION_MESSAGE,
        causedByTransactionId: transaction.id,
      }],
    },
  }
}

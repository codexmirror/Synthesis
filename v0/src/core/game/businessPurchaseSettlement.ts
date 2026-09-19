import { resolveCompanyTreasuryAccount } from './business'
import { executeCivicDollarMovement } from './dollarFinance'
import type { DollarTransactionStatementContext, GameState } from './types'

export type CompanyPurchaseSettlementResult =
  | { readonly status: 'settled'; readonly state: GameState; readonly transactionId: string }
  | { readonly status: 'buyer_treasury_unavailable' | 'seller_treasury_unavailable' | 'payment_refused'; readonly state: GameState }

/**
 * Monetary half of an already-validated represented Company purchase. The
 * commercial caller owns the action and exact amount; this boundary owns only
 * current buyer/seller Treasury resolution and one canonical Dollar movement.
 * It is intentionally not exposed through an application or interface API.
 */
export function settleValidatedCompanyPurchase(
  state: GameState,
  buyerCompanyId: string,
  sellerCompanyId: string,
  exactAmountCents: number,
  statementContext?: DollarTransactionStatementContext,
): CompanyPurchaseSettlementResult {
  const buyerTreasury = resolveCompanyTreasuryAccount(state, buyerCompanyId)
  if (!buyerTreasury) return { status: 'buyer_treasury_unavailable', state }
  const sellerTreasury = resolveCompanyTreasuryAccount(state, sellerCompanyId)
  if (!sellerTreasury) return { status: 'seller_treasury_unavailable', state }
  const movement = executeCivicDollarMovement(state, buyerTreasury.id, sellerTreasury.id, exactAmountCents, statementContext)
  return movement.status === 'moved'
    ? { status: 'settled', state: movement.state, transactionId: movement.transaction.id }
    : { status: 'payment_refused', state }
}

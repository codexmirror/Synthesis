import type { NodeAccount, NodeEconomyState, NodeWalletActivityRecord, NodeWalletActivityState, NodeWalletMarketPurchaseActivityRecord, NodeWalletState } from './types'

/** Modest fixed V1 retention for local Wallet activity: oldest record is evicted first once exceeded. */
export const NODE_WALLET_ACTIVITY_CAPACITY = 20

/**
 * The represented NODE economic recipients that currently exist: the
 * player's own local Wallet and the small set of other represented
 * accounts. More than one real recipient now exists, so crediting resolves
 * an address against all of them — but this deliberately remains a lookup
 * over concrete represented accounts rather than a ledger, transaction
 * network, or address registry.
 */
export interface NodeRecipients {
  readonly nodeWallet: NodeWalletState
  readonly nodeEconomy: NodeEconomyState
}

/** Appends one balance-changing record with identity shared across all kinds. */
function appendNodeWalletActivity(activity: NodeWalletActivityState, record: Omit<NodeWalletActivityRecord, 'id'>): NodeWalletActivityState {
  const identifiedRecord = { ...record, id: `node-activity-${String(activity.nextId).padStart(4, '0')}` } as NodeWalletActivityRecord
  return { nextId: activity.nextId + 1, records: [...activity.records, identifiedRecord].slice(-NODE_WALLET_ACTIVITY_CAPACITY) }
}

/** Credits the local Wallet and records the mining payout it received. */
export function creditNodeWalletMiningPayout(nodeWallet: NodeWalletState, amountNodeUnits: number): NodeWalletState {
  if (amountNodeUnits <= 0) return nodeWallet
  return {
    ...nodeWallet,
    balanceNodeUnits: nodeWallet.balanceNodeUnits + amountNodeUnits,
    activity: appendNodeWalletActivity(nodeWallet.activity, { kind: 'mining_payout', amountNodeUnits }),
  }
}

/** Debits a settled Market price and appends its historical display/identity evidence. */
export function debitNodeWalletMarketPurchase(
  nodeWallet: NodeWalletState,
  purchase: Omit<NodeWalletMarketPurchaseActivityRecord, 'id' | 'kind'>,
): NodeWalletState {
  return {
    ...nodeWallet,
    balanceNodeUnits: nodeWallet.balanceNodeUnits - purchase.amountNodeUnits,
    activity: appendNodeWalletActivity(nodeWallet.activity, { kind: 'market_purchase', ...purchase }),
  }
}

function creditNodeAccounts(accounts: readonly NodeAccount[], address: string, amountNodeUnits: number): readonly NodeAccount[] | undefined {
  if (accounts.filter((account) => account.address === address).length !== 1) return undefined
  return accounts.map((account) => account.address === address ? { ...account, balanceNodeUnits: account.balanceNodeUnits + amountNodeUnits } : account)
}

/**
 * Credits atomic NODE units to whichever represented economic recipient
 * currently holds `address` by exact string match: the local Wallet, or one
 * represented NODE account. The match must be unique across all represented
 * recipients; zero or multiple matches credit nobody. There is no fallback recipient
 * and, in particular, the local Wallet is never credited for an address it
 * does not hold.
 */
export function creditNodeAddress(recipients: NodeRecipients, address: string, amountNodeUnits: number): NodeRecipients {
  if (amountNodeUnits <= 0) return recipients
  const walletMatches = recipients.nodeWallet.address === address ? 1 : 0
  const accountMatches = recipients.nodeEconomy.accounts.filter((account) => account.address === address).length
  if (walletMatches + accountMatches !== 1) return recipients
  if (walletMatches === 1) return { ...recipients, nodeWallet: creditNodeWalletMiningPayout(recipients.nodeWallet, amountNodeUnits) }
  const accounts = creditNodeAccounts(recipients.nodeEconomy.accounts, address, amountNodeUnits)
  return accounts ? { ...recipients, nodeEconomy: { ...recipients.nodeEconomy, accounts } } : recipients
}

/** The represented account currently holding `address`, if one exists. */
export function findNodeAccountByAddress(nodeEconomy: NodeEconomyState, address: string): NodeAccount | undefined {
  return nodeEconomy.accounts.find((account) => account.address === address)
}

import type { NodeAccount, NodeEconomyState, NodeWalletActivityRecord, NodeWalletActivityState, NodeWalletState } from './types'

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

/**
 * Appends one record of NODE the local Wallet actually received. Record
 * identity is a per-Wallet monotonic counter that never rewinds, even when
 * capacity eviction removes the oldest retained record.
 */
function appendNodeWalletActivity(activity: NodeWalletActivityState, amountNodeUnits: number): NodeWalletActivityState {
  const record: NodeWalletActivityRecord = { id: `node-activity-${String(activity.nextId).padStart(4, '0')}`, kind: 'mining_payout', amountNodeUnits }
  return { nextId: activity.nextId + 1, records: [...activity.records, record].slice(-NODE_WALLET_ACTIVITY_CAPACITY) }
}

/** Credits the local Wallet and records what it received. Wallet activity only ever describes real received amounts. */
export function creditNodeWalletMiningPayout(nodeWallet: NodeWalletState, amountNodeUnits: number): NodeWalletState {
  if (amountNodeUnits <= 0) return nodeWallet
  return {
    ...nodeWallet,
    balanceNodeUnits: nodeWallet.balanceNodeUnits + amountNodeUnits,
    activity: appendNodeWalletActivity(nodeWallet.activity, amountNodeUnits),
  }
}

function creditNodeAccounts(accounts: readonly NodeAccount[], address: string, amountNodeUnits: number): readonly NodeAccount[] | undefined {
  if (!accounts.some((account) => account.address === address)) return undefined
  return accounts.map((account) => account.address === address ? { ...account, balanceNodeUnits: account.balanceNodeUnits + amountNodeUnits } : account)
}

/**
 * Credits atomic NODE units to whichever represented economic recipient
 * currently holds `address` by exact string match: the local Wallet, or one
 * represented NODE account. When no represented recipient holds that
 * address nothing is credited — there is deliberately no fallback recipient
 * and, in particular, the local Wallet is never credited for an address it
 * does not hold.
 */
export function creditNodeAddress(recipients: NodeRecipients, address: string, amountNodeUnits: number): NodeRecipients {
  if (amountNodeUnits <= 0) return recipients
  if (recipients.nodeWallet.address === address) return { ...recipients, nodeWallet: creditNodeWalletMiningPayout(recipients.nodeWallet, amountNodeUnits) }
  const accounts = creditNodeAccounts(recipients.nodeEconomy.accounts, address, amountNodeUnits)
  return accounts ? { ...recipients, nodeEconomy: { ...recipients.nodeEconomy, accounts } } : recipients
}

/** The represented account currently holding `address`, if one exists. */
export function findNodeAccountByAddress(nodeEconomy: NodeEconomyState, address: string): NodeAccount | undefined {
  return nodeEconomy.accounts.find((account) => account.address === address)
}

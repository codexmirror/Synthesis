import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { creditNodeAddress, creditNodeWalletMiningPayout, findNodeAccountByAddress, NODE_WALLET_ACTIVITY_CAPACITY, type NodeRecipients } from './nodeEconomy'

function recipients(): NodeRecipients {
  const state = createInitialGameState()
  return { nodeWallet: state.nodeWallet, nodeEconomy: state.nodeEconomy }
}

describe('local NODE Wallet activity', () => {
  it('records each received amount with a deterministic monotonic ID', () => {
    const wallet = creditNodeWalletMiningPayout(creditNodeWalletMiningPayout(recipients().nodeWallet, 90), 45)
    expect(wallet.balanceNodeUnits).toBe(135)
    expect(wallet.activity).toEqual({
      nextId: 3,
      records: [
        { id: 'node-activity-0001', kind: 'mining_payout', amountNodeUnits: 90 },
        { id: 'node-activity-0002', kind: 'mining_payout', amountNodeUnits: 45 },
      ],
    })
  })

  it('keeps bounded retention, evicting the oldest record without rewinding record identity', () => {
    let wallet = recipients().nodeWallet
    for (let index = 1; index <= NODE_WALLET_ACTIVITY_CAPACITY + 3; index += 1) wallet = creditNodeWalletMiningPayout(wallet, index)

    expect(wallet.activity.records).toHaveLength(NODE_WALLET_ACTIVITY_CAPACITY)
    expect(wallet.activity.nextId).toBe(NODE_WALLET_ACTIVITY_CAPACITY + 4)
    expect(wallet.activity.records[0]).toEqual({ id: 'node-activity-0004', kind: 'mining_payout', amountNodeUnits: 4 })
    expect(wallet.activity.records.at(-1)?.id).toBe(`node-activity-${String(NODE_WALLET_ACTIVITY_CAPACITY + 3).padStart(4, '0')}`)
    // The retained records still describe only real received amounts; the balance keeps every credit.
    expect(wallet.balanceNodeUnits).toBe((NODE_WALLET_ACTIVITY_CAPACITY + 3) * (NODE_WALLET_ACTIVITY_CAPACITY + 4) / 2)
  })

  it('records nothing for a zero or negative amount', () => {
    const wallet = creditNodeWalletMiningPayout(recipients().nodeWallet, 0)
    expect(wallet.activity.records).toHaveLength(0)
    expect(wallet.balanceNodeUnits).toBe(0)
  })
})

describe('crediting a represented NODE address', () => {
  it('credits the local Wallet only for the exact address it currently holds', () => {
    const base = recipients()
    const credited = creditNodeAddress(base, base.nodeWallet.address, 90)
    expect(credited.nodeWallet.balanceNodeUnits).toBe(90)
    expect(credited.nodeWallet.activity.records).toHaveLength(1)

    const padded = creditNodeAddress(base, ` ${base.nodeWallet.address} `, 90)
    expect(padded.nodeWallet.balanceNodeUnits).toBe(0)
  })

  it('credits another represented account by address, leaving the Wallet untouched', () => {
    const base = recipients()
    const developerAddress = base.nodeEconomy.accounts[0].address
    const credited = creditNodeAddress(base, developerAddress, 10)
    expect(findNodeAccountByAddress(credited.nodeEconomy, developerAddress)?.balanceNodeUnits).toBe(10)
    expect(credited.nodeWallet).toBe(base.nodeWallet)
  })

  it('credits nobody when no represented recipient holds the address', () => {
    const base = recipients()
    const credited = creditNodeAddress(base, 'address-nobody-holds', 900)
    expect(credited.nodeWallet).toBe(base.nodeWallet)
    expect(credited.nodeEconomy).toBe(base.nodeEconomy)
  })
})

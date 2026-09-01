import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { transferDollars } from './dollarFinance'
import {
  PETRA_PHONE_ACCOUNT_ID,
  PETRA_UNUSUAL_TRANSACTION_MESSAGE,
  PLAYER_DOLLAR_ACCOUNT_ID,
  resolvePetraTransactionReaction,
} from './petraCompanyChat'
import type { DollarTransaction, GameState } from './types'

const PHONE_DEVICE_ID = 'host-phone-001'
const PLAYER_REFERENCE = 'CD-1042-7781'

function communicationProjection(state: GameState) {
  return {
    chat: state.petraCompanyChat,
    discovery: state.discovery,
    knowledge: state.knowledge,
    deviceAccess: state.deviceAccess,
    phoneSecurity: state.world.network.hosts.find(({ id }) => id === PHONE_DEVICE_ID)?.security,
  }
}

describe('Petra Company Chat transaction reaction', () => {
  it('reacts to the canonical Petra-phone-to-player Transaction after it exists', () => {
    const before = createInitialGameState()
    const result = transferDollars(before, PHONE_DEVICE_ID, PLAYER_REFERENCE, 2_000)
    expect(result.status).toBe('transferred')
    if (result.status !== 'transferred') return

    const transaction = result.state.dollarFinance.transactions.records[0]
    expect(transaction).toMatchObject({
      id: result.transactionId,
      sourceAccountId: PETRA_PHONE_ACCOUNT_ID,
      destinationAccountId: PLAYER_DOLLAR_ACCOUNT_ID,
    })
    expect(result.state.petraCompanyChat.messages).toEqual([expect.objectContaining({
      authorName: 'Petra',
      body: PETRA_UNUSUAL_TRANSACTION_MESSAGE,
      causedByTransactionId: transaction.id,
    })])
    expect(result.state.discovery).toBe(before.discovery)
    expect(result.state.knowledge).toBe(before.knowledge)
    expect(result.state.deviceAccess).toBe(before.deviceAccess)
    expect(result.state.world).toBe(before.world)
    expect(result.state.mail).toBe(before.mail)
  })

  it('cannot react to a supplied Transaction that does not yet exist canonically', () => {
    const before = createInitialGameState()
    const transaction: DollarTransaction = {
      id: 'dollar-transaction-0001', sourceAccountId: PETRA_PHONE_ACCOUNT_ID,
      destinationAccountId: PLAYER_DOLLAR_ACCOUNT_ID, amountCents: 100,
      sourceAccountReference: 'CD-3318-2204', destinationAccountReference: PLAYER_REFERENCE,
    }
    expect(resolvePetraTransactionReaction(before, transaction)).toBe(before)
  })

  it('does not react to a refused transfer', () => {
    const before = createInitialGameState()
    const result = transferDollars(before, PHONE_DEVICE_ID, PLAYER_REFERENCE, 100_000)
    expect(result.status).toBe('insufficient_funds')
    expect(result.state).toBe(before)
    expect(result.state.petraCompanyChat.messages).toEqual([])
  })

  it('does not react when the source Account is not Petra’s phone Account', () => {
    const before = createInitialGameState()
    const result = transferDollars(before, before.player.localDevice.id, 'CD-3318-2204', 100)
    expect(result.status).toBe('transferred')
    expect(result.state.petraCompanyChat.messages).toEqual([])
  })

  it('does not react when the destination Account is not the player’s Account', () => {
    const before = createInitialGameState()
    const third = { id: 'dollar-account-third', accountReference: 'CD-9000-0001', balanceCents: 0 }
    const state: GameState = { ...before, dollarFinance: { ...before.dollarFinance, accounts: [...before.dollarFinance.accounts, third] } }
    const result = transferDollars(state, PHONE_DEVICE_ID, third.accountReference, 100)
    expect(result.status).toBe('transferred')
    expect(result.state.petraCompanyChat.messages).toEqual([])
  })

  it('records the first reaction once across later qualifying and unrelated operations', () => {
    const before = createInitialGameState()
    const first = transferDollars(before, PHONE_DEVICE_ID, PLAYER_REFERENCE, 100)
    if (first.status !== 'transferred') throw new Error(first.status)
    const snapshot = communicationProjection(first.state)
    const second = transferDollars(first.state, PHONE_DEVICE_ID, PLAYER_REFERENCE, 100)
    if (second.status !== 'transferred') throw new Error(second.status)

    expect(second.state.dollarFinance.transactions.records).toHaveLength(2)
    expect(second.state.petraCompanyChat.messages).toEqual(first.state.petraCompanyChat.messages)
    expect(communicationProjection(second.state)).toEqual(snapshot)
  })
})

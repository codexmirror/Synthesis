import { describe, expect, it } from 'vitest'
import { changeDeviceWalletProtection } from './deviceSecurity'
import { transferDollars } from './dollarFinance'
import { advanceGameState } from './gameAdvancement'
import { createInitialGameState } from './initialState'
import {
  PETRA_TECHNICIAN_MESSAGE,
  PETRA_TECHNICIAN_MESSAGE_ID,
  PETRA_TECHNICIAN_RESPONSE_DELAY_MS,
  TECHNICIAN_CORRESPONDENT_ID,
} from './technician'
import type { GameState } from './types'

const PHONE_ID = 'host-phone-001'
const PLAYER_REFERENCE = 'CD-1042-7781'
const walletProtection = (state: GameState) => state.world.network.hosts.find(({ id }) => id === PHONE_ID)?.security?.walletProtectionEnabled

function qualifyingTransfer(state = createInitialGameState()): GameState {
  const result = transferDollars(state, PHONE_ID, PLAYER_REFERENCE, 100)
  if (result.status !== 'transferred') throw new Error(result.status)
  return result.state
}

describe('Petra Technician response', () => {
  it('schedules from Petra’s one complaint without responding or hardening immediately', () => {
    const state = qualifyingTransfer()
    expect(state.petraCompanyChat.messages).toHaveLength(1)
    expect(state.petraCompanyChat.messages[0]).toMatchObject({ authorName: 'Petra', causedByTransactionId: 'dollar-transaction-0001' })
    expect(state.technicianReaction.pending).toEqual({
      transactionId: 'dollar-transaction-0001', remainingMs: PETRA_TECHNICIAN_RESPONSE_DELAY_MS,
    })
    expect(walletProtection(state)).toBe(false)
    expect(state.petraCompanyChat.messages.some(({ authorId }) => authorId === TECHNICIAN_CORRESPONDENT_ID)).toBe(false)

    const second = qualifyingTransfer(state)
    expect(second.petraCompanyChat.messages).toHaveLength(1)
    expect(second.technicianReaction).toEqual(state.technicianReaction)
  })

  it('waits for represented elapsed time, then hardens and truthfully reports exactly once', () => {
    const pending = qualifyingTransfer()
    const early = advanceGameState(pending, PETRA_TECHNICIAN_RESPONSE_DELAY_MS - 1)
    expect(walletProtection(early)).toBe(false)
    expect(early.petraCompanyChat.messages).toHaveLength(1)
    expect(early.technicianReaction.pending?.remainingMs).toBe(1)

    const resolved = advanceGameState(early, 1)
    expect(walletProtection(resolved)).toBe(true)
    expect(resolved.technicianReaction.pending).toBeNull()
    expect(resolved.petraCompanyChat.messages[1]).toEqual({
      id: PETRA_TECHNICIAN_MESSAGE_ID,
      authorId: TECHNICIAN_CORRESPONDENT_ID,
      authorName: 'Technician',
      body: PETRA_TECHNICIAN_MESSAGE,
      causedByTransactionId: 'dollar-transaction-0001',
    })

    const later = advanceGameState(resolved, 60_000)
    expect(later.petraCompanyChat.messages).toEqual(resolved.petraCompanyChat.messages)
    expect(walletProtection(later)).toBe(true)
  })

  it('is elapsed-time chunk equivalent', () => {
    const pending = qualifyingTransfer()
    const once = advanceGameState(pending, PETRA_TECHNICIAN_RESPONSE_DELAY_MS)
    let chunked = pending
    for (let index = 0; index < 5; index += 1) chunked = advanceGameState(chunked, 1_000)
    expect(chunked).toEqual(once)
  })

  it('resolves as a truthful no-op when protection is already ON at response time', () => {
    const pending = qualifyingTransfer()
    const hardened = changeDeviceWalletProtection(pending, PHONE_ID, '7042', true)
    if (hardened.status !== 'changed') throw new Error(hardened.status)
    const resolved = advanceGameState(hardened.state, PETRA_TECHNICIAN_RESPONSE_DELAY_MS)
    expect(walletProtection(resolved)).toBe(true)
    expect(resolved.technicianReaction.pending).toBeNull()
    expect(resolved.petraCompanyChat.messages).toHaveLength(1)
    expect(advanceGameState(resolved, 60_000).petraCompanyChat.messages).toHaveLength(1)
  })

  it('requires both Petra’s complaint and retained Dollar evidence, and resolves missing evidence without retrying', () => {
    const pending = qualifyingTransfer()
    const withoutComplaint: GameState = {
      ...pending, petraCompanyChat: { ...pending.petraCompanyChat, messages: [] },
    }
    const resolved = advanceGameState(withoutComplaint, PETRA_TECHNICIAN_RESPONSE_DELAY_MS)
    expect(resolved.technicianReaction.pending).toBeNull()
    expect(walletProtection(resolved)).toBe(false)
    expect(resolved.petraCompanyChat.messages).toEqual([])
  })
})

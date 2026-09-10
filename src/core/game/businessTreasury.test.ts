import { describe, expect, it } from 'vitest'
import { ATLAS_DISTRIBUTION_COMPANY_ID, ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID, BOOKSTORE_BRANCH_ID, BOOKSTORE_COMPANY_ID, BOOKSTORE_TREASURY_ACCOUNT_ID, NORTHLINE_BOOK_SUPPLY_COMPANY_ID, NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID, resolveCompanyTreasuryAccount } from './business'
import { BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID } from './bookstoreCommerce'
import { executeBookstoreSale } from './bookstoreSale'
import { createInitialGameState, GAME_STATE_VERSION } from './initialState'
import type { GameState } from './types'

const oneBook = () => {
  const samples = [0, 0]
  return () => samples.shift() ?? 0
}

describe('Company Treasury designation', () => {
  it('seeds every Company-linked stable Account designation and resolves current Civic Dollar truth', () => {
    const state = createInitialGameState()
    expect(GAME_STATE_VERSION).toBe(89)
    expect(state.version).toBe(89)
    expect(state.business.treasuryDesignations).toEqual([
      { companyId: BOOKSTORE_COMPANY_ID, accountId: BOOKSTORE_TREASURY_ACCOUNT_ID },
      { companyId: ATLAS_DISTRIBUTION_COMPANY_ID, accountId: ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID },
      { companyId: NORTHLINE_BOOK_SUPPLY_COMPANY_ID, accountId: NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID },
    ])
    expect(resolveCompanyTreasuryAccount(state, BOOKSTORE_COMPANY_ID)).toBe(
      state.dollarFinance.accounts.find(({ id }) => id === BOOKSTORE_TREASURY_ACCOUNT_ID),
    )
    expect(resolveCompanyTreasuryAccount(state, BOOKSTORE_COMPANY_ID)?.accountReference).toBe('CD-4827-6109')
    expect(resolveCompanyTreasuryAccount(state, BOOKSTORE_COMPANY_ID)?.balanceCents).toBe(0)
    expect(resolveCompanyTreasuryAccount(state, ATLAS_DISTRIBUTION_COMPANY_ID)).toMatchObject({ accountReference: 'CD-5721-6408', balanceCents: 0 })
    expect(resolveCompanyTreasuryAccount(state, NORTHLINE_BOOK_SUPPLY_COMPANY_ID)).toMatchObject({ accountReference: 'CD-6843-1906', balanceCents: 0 })
    expect(state.dollarFinance.credentials.some(({ accountId }) => accountId === NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(false)
    expect(state.dollarFinance.sessions.active.some(({ accountId }) => accountId === NORTHLINE_BOOK_SUPPLY_TREASURY_ACCOUNT_ID)).toBe(false)
    expect(state.dollarFinance.credentials.some(({ accountId }) => accountId === ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(false)
    expect(state.dollarFinance.sessions.active.some(({ accountId }) => accountId === ATLAS_DISTRIBUTION_TREASURY_ACCOUNT_ID)).toBe(false)
    expect(resolveCompanyTreasuryAccount(state, BOOKSTORE_COMPANY_ID)?.id).not.toBe('dollar-account-veyra-phone-v0')
    expect(state.dollarFinance.credentials.some(({ accountId }) => accountId === BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(false)
    expect(state.dollarFinance.sessions.active.some(({ accountId }) => accountId === BOOKSTORE_TREASURY_ACCOUNT_ID)).toBe(false)
    expect(state.dollarFinance.sessions.active).toContainEqual({ id: 'dollar-session-0002', accountId: 'dollar-account-veyra-phone-v0', clientDeviceId: 'host-phone-001' })
    expect(state.dollarFinance.accounts.find(({ id }) => id === 'dollar-account-veyra-phone-v0')?.balanceCents).toBe(34_250)
    expect(state.business.treasuryDesignations[0]).not.toHaveProperty('balanceCents')
    expect(state.business.companies[0]).toEqual({ id: BOOKSTORE_COMPANY_ID, displayName: 'Bookstore' })
  })

  it('fails closed for missing, dangling, or ambiguous designations without fabricating Account truth', () => {
    const initial = createInitialGameState()
    expect(resolveCompanyTreasuryAccount(initial, 'company-missing')).toBeUndefined()
    const dangling: GameState = { ...initial, business: { ...initial.business, treasuryDesignations: [{ companyId: BOOKSTORE_COMPANY_ID, accountId: 'account-missing' }] } }
    expect(resolveCompanyTreasuryAccount(dangling, BOOKSTORE_COMPANY_ID)).toBeUndefined()
    const ambiguous: GameState = { ...initial, business: { ...initial.business, treasuryDesignations: [...initial.business.treasuryDesignations, { companyId: BOOKSTORE_COMPANY_ID, accountId: 'dollar-account-local-v0' }] } }
    expect(resolveCompanyTreasuryAccount(ambiguous, BOOKSTORE_COMPANY_ID)).toBeUndefined()
  })

  it('creates no finance or access authority and has no Player Financial Session dependency', () => {
    const initial = createInitialGameState()
    const noAuthority: GameState = {
      ...initial,
      dollarFinance: { ...initial.dollarFinance, credentials: [], sessions: { ...initial.dollarFinance.sessions, active: [] } },
      deviceAccess: { ...initial.deviceAccess, established: [] },
      remoteSession: { ...initial.remoteSession, active: null },
      player: { ...initial.player, localDevice: { ...initial.player.localDevice, savedDollarSignIn: undefined } },
    }
    expect(resolveCompanyTreasuryAccount(noAuthority, BOOKSTORE_COMPANY_ID)?.id).toBe(BOOKSTORE_TREASURY_ACCOUNT_ID)
    expect(noAuthority.dollarFinance.credentials).toEqual([])
    expect(noAuthority.dollarFinance.sessions.active).toEqual([])
    expect(noAuthority.player.localDevice.savedDollarSignIn).toBeUndefined()
  })

  it('keeps Company Treasury and Branch settlement independent in both directions', () => {
    const initial = createInitialGameState()
    expect(initial.business.treasuryDesignations[0].accountId).toBe(BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)

    const changedTreasury: GameState = { ...initial, business: { ...initial.business, treasuryDesignations: [{ companyId: BOOKSTORE_COMPANY_ID, accountId: 'dollar-account-local-v0' }] } }
    const treasurySale = executeBookstoreSale(changedTreasury, BOOKSTORE_BRANCH_ID, oneBook(), () => 0.5)
    expect(treasurySale.status).toBe('sold')
    if (treasurySale.status !== 'sold') throw new Error('expected completed sale')
    const treasuryCompletedSale = treasurySale.state.bookstoreCommerce.records[0].completedSales.at(-1)!
    expect(treasurySale.state.dollarFinance.transactions.records.find(({ id }) => id === treasuryCompletedSale.dollarTransactionId)?.destinationAccountId).toBe(BOOKSTORE_BRANCH_SETTLEMENT_ACCOUNT_ID)

    const changedSettlement: GameState = { ...initial, bookstoreCommerce: { ...initial.bookstoreCommerce, records: initial.bookstoreCommerce.records.map((record) => ({ ...record, settlementAccountId: 'dollar-account-local-v0' })) } }
    expect(resolveCompanyTreasuryAccount(changedSettlement, BOOKSTORE_COMPANY_ID)?.id).toBe(BOOKSTORE_TREASURY_ACCOUNT_ID)
    const settlementSale = executeBookstoreSale(changedSettlement, BOOKSTORE_BRANCH_ID, oneBook(), () => 0.5)
    expect(settlementSale.status).toBe('sold')
    if (settlementSale.status !== 'sold') throw new Error('expected completed sale')
    const settlementCompletedSale = settlementSale.state.bookstoreCommerce.records[0].completedSales.at(-1)!
    expect(settlementSale.state.dollarFinance.transactions.records.find(({ id }) => id === settlementCompletedSale.dollarTransactionId)?.destinationAccountId).toBe('dollar-account-local-v0')
    expect(settlementSale.state.business.treasuryDesignations).toEqual(initial.business.treasuryDesignations)
  })
})

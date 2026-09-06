import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { createBookstoreBranchOperationsRecord, resolveBookstoreOperationsForBranch } from './bookstoreOperations'

describe('bookstore operations initial truth', () => {
  it('seeds one concrete branch-linked operations record referencing the generic Branch by stable ID', () => {
    const state = createInitialGameState()
    expect(state.bookstoreOperations.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      shelfCapacity: 480,
      checkoutCapacity: 2,
      open: true,
      currentInventory: 360,
    }])
  })

  it('seeds current inventory strictly within shelf capacity', () => {
    const state = createInitialGameState()
    const record = state.bookstoreOperations.records[0]
    expect(record.currentInventory).toBeLessThanOrEqual(record.shelfCapacity)
  })
})

describe('createBookstoreBranchOperationsRecord', () => {
  it('never represents current inventory above shelf capacity, even when constructed with an over-capacity value', () => {
    const record = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-overstocked',
      shelfCapacity: 100,
      checkoutCapacity: 1,
      open: true,
      currentInventory: 250,
    })
    expect(record.currentInventory).toBe(100)
  })

  it('leaves current inventory unchanged when it is already within shelf capacity', () => {
    const record = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-normal',
      shelfCapacity: 100,
      checkoutCapacity: 1,
      open: false,
      currentInventory: 40,
    })
    expect(record.currentInventory).toBe(40)
    expect(record.open).toBe(false)
  })

  it('supports two differently configured Bookstore Branches through the same implementation, with no shared identity or dispatch', () => {
    const small = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-small', shelfCapacity: 60, checkoutCapacity: 1, open: false, currentInventory: 12,
    })
    const large = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-large', shelfCapacity: 900, checkoutCapacity: 4, open: true, currentInventory: 900,
    })
    expect(small).toEqual({ branchId: 'branch-fixture-small', shelfCapacity: 60, checkoutCapacity: 1, open: false, currentInventory: 12 })
    expect(large).toEqual({ branchId: 'branch-fixture-large', shelfCapacity: 900, checkoutCapacity: 4, open: true, currentInventory: 900 })
    expect(small.branchId).not.toBe(large.branchId)
  })
})

describe('resolveBookstoreOperationsForBranch', () => {
  it('resolves the seeded Branch operations record', () => {
    const state = createInitialGameState()
    const operations = resolveBookstoreOperationsForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(operations).toEqual({ branchId: BOOKSTORE_BRANCH_ID, shelfCapacity: 480, checkoutCapacity: 2, open: true, currentInventory: 360 })
  })

  it('resolves undefined for a Branch with no represented operations record — a legitimate structural state, not a defect', () => {
    const state = createInitialGameState()
    expect(resolveBookstoreOperationsForBranch(state, 'branch-with-no-operations')).toBeUndefined()
  })

  it('resolves independently of any commerce record: a Branch may have operations without commerce', () => {
    const initial = createInitialGameState()
    const operationsOnlyRecord = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-operations-only', shelfCapacity: 200, checkoutCapacity: 1, open: true, currentInventory: 50,
    })
    const state = {
      ...initial,
      bookstoreOperations: { records: [...initial.bookstoreOperations.records, operationsOnlyRecord] },
    }
    expect(resolveBookstoreOperationsForBranch(state, 'branch-fixture-operations-only')).toEqual(operationsOnlyRecord)
    // No commerce record exists for this Branch, and resolving operations does not require one.
    expect(state.bookstoreCommerce.records.some((record) => record.branchId === 'branch-fixture-operations-only')).toBe(false)
  })
})

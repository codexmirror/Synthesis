import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BRANCH_ID } from './business'
import { BOOKSTORE_MERCHANDISE_CATALOG } from './bookstoreCommerce'
import { createBookstoreBranchOperationsRecord, decrementBookstoreStock, deriveBookstoreTotalStock, findBookstoreStockQuantity, resolveBookstoreOperationsForBranch } from './bookstoreOperations'

const SEEDED_STOCK = BOOKSTORE_MERCHANDISE_CATALOG.map((item) => ({ merchandiseId: item.id, quantity: 45 }))

describe('bookstore operations initial truth', () => {
  it('seeds one concrete branch-linked operations record with 45 units of each of the eight authored merchandise identities', () => {
    const state = createInitialGameState()
    expect(state.bookstoreOperations.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      shelfCapacity: 480,
      checkoutCapacity: 2,
      open: true,
      stock: SEEDED_STOCK,
    }])
  })

  it('derives an initial total stock of exactly 360, strictly within shelf capacity', () => {
    const state = createInitialGameState()
    const record = state.bookstoreOperations.records[0]
    expect(deriveBookstoreTotalStock(record)).toBe(360)
    expect(deriveBookstoreTotalStock(record)).toBeLessThanOrEqual(record.shelfCapacity)
  })

  it('does not represent a second mutable aggregate inventory field alongside item-level stock', () => {
    const state = createInitialGameState()
    expect(state.bookstoreOperations.records[0]).not.toHaveProperty('currentInventory')
  })
})

describe('createBookstoreBranchOperationsRecord', () => {
  it('rejects total stock above shelf capacity rather than silently clamping or accepting it', () => {
    expect(() => createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-overstocked',
      shelfCapacity: 100,
      checkoutCapacity: 1,
      open: true,
      stock: [{ merchandiseId: 'merch-a', quantity: 250 }],
    })).toThrow(RangeError)
  })

  it('rejects a negative stock quantity', () => {
    expect(() => createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-negative-stock', shelfCapacity: 100, checkoutCapacity: 1, open: true, stock: [{ merchandiseId: 'merch-a', quantity: -1 }],
    })).toThrow(RangeError)
  })

  it('rejects a non-integer stock quantity', () => {
    expect(() => createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-fractional-stock', shelfCapacity: 100, checkoutCapacity: 1, open: true, stock: [{ merchandiseId: 'merch-a', quantity: 12.5 }],
    })).toThrow(RangeError)
  })

  it('rejects the same merchandise identity represented more than once in stock', () => {
    expect(() => createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-duplicate-stock', shelfCapacity: 100, checkoutCapacity: 1, open: true, stock: [{ merchandiseId: 'merch-a', quantity: 5 }, { merchandiseId: 'merch-a', quantity: 5 }],
    })).toThrow(RangeError)
  })

  it('rejects negative shelf capacity', () => {
    expect(() => createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-negative-shelf', shelfCapacity: -10, checkoutCapacity: 1, open: true, stock: [],
    })).toThrow(RangeError)
  })

  it('rejects negative checkout capacity', () => {
    expect(() => createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-negative-checkout', shelfCapacity: 100, checkoutCapacity: -1, open: true, stock: [],
    })).toThrow(RangeError)
  })

  it('rejects non-finite shelf capacity and checkout capacity', () => {
    const base = { branchId: 'branch-fixture-non-finite', open: true, stock: [] } as const
    expect(() => createBookstoreBranchOperationsRecord({ ...base, shelfCapacity: Infinity, checkoutCapacity: 1 })).toThrow(RangeError)
    expect(() => createBookstoreBranchOperationsRecord({ ...base, shelfCapacity: NaN, checkoutCapacity: 1 })).toThrow(RangeError)
    expect(() => createBookstoreBranchOperationsRecord({ ...base, shelfCapacity: 100, checkoutCapacity: NaN })).toThrow(RangeError)
  })

  it('accepts a zero shelf capacity, checkout capacity, and empty stock — the boundary is >= 0, not > 0', () => {
    const record = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-zeroed', shelfCapacity: 0, checkoutCapacity: 0, open: false, stock: [],
    })
    expect(record).toEqual({ branchId: 'branch-fixture-zeroed', shelfCapacity: 0, checkoutCapacity: 0, open: false, stock: [] })
  })

  it('leaves stock unchanged when its total is already within shelf capacity', () => {
    const record = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-normal',
      shelfCapacity: 100,
      checkoutCapacity: 1,
      open: false,
      stock: [{ merchandiseId: 'merch-a', quantity: 40 }],
    })
    expect(deriveBookstoreTotalStock(record)).toBe(40)
    expect(record.open).toBe(false)
  })

  it('supports two differently configured Bookstore Branches through the same implementation, with no shared identity or dispatch', () => {
    const small = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-small', shelfCapacity: 60, checkoutCapacity: 1, open: false, stock: [{ merchandiseId: 'merch-a', quantity: 12 }],
    })
    const large = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-large', shelfCapacity: 900, checkoutCapacity: 4, open: true, stock: [{ merchandiseId: 'merch-a', quantity: 900 }],
    })
    expect(small.branchId).not.toBe(large.branchId)
    expect(deriveBookstoreTotalStock(small)).toBe(12)
    expect(deriveBookstoreTotalStock(large)).toBe(900)
  })
})

describe('deriveBookstoreTotalStock', () => {
  it('sums quantities across every represented merchandise identity', () => {
    const record = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-sum', shelfCapacity: 500, checkoutCapacity: 1, open: true,
      stock: [{ merchandiseId: 'a', quantity: 10 }, { merchandiseId: 'b', quantity: 0 }, { merchandiseId: 'c', quantity: 25 }],
    })
    expect(deriveBookstoreTotalStock(record)).toBe(35)
  })

  it('sums to zero for an empty stock list', () => {
    const record = createBookstoreBranchOperationsRecord({ branchId: 'branch-fixture-empty', shelfCapacity: 10, checkoutCapacity: 1, open: true, stock: [] })
    expect(deriveBookstoreTotalStock(record)).toBe(0)
  })
})

describe('findBookstoreStockQuantity', () => {
  it('returns the represented quantity for a known merchandise identity', () => {
    const state = createInitialGameState()
    const operations = state.bookstoreOperations.records[0]
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-001')).toBe(45)
  })

  it('returns 0 for a merchandise identity with no represented stock entry at all', () => {
    const state = createInitialGameState()
    const operations = state.bookstoreOperations.records[0]
    expect(findBookstoreStockQuantity(operations, 'merchandise-not-represented')).toBe(0)
  })
})

describe('decrementBookstoreStock', () => {
  it('decrements exactly the given per-merchandise quantities and leaves every other merchandise untouched', () => {
    const state = createInitialGameState()
    const decremented = decrementBookstoreStock(state, BOOKSTORE_BRANCH_ID, [
      { merchandiseId: 'bookstore-merch-001', quantity: 2 },
      { merchandiseId: 'bookstore-merch-008', quantity: 1 },
    ])
    const operations = decremented.bookstoreOperations.records[0]
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-001')).toBe(43)
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-008')).toBe(44)
    expect(findBookstoreStockQuantity(operations, 'bookstore-merch-002')).toBe(45)
    expect(deriveBookstoreTotalStock(operations)).toBe(360 - 3)
  })

  it('leaves operations records for other Branches untouched', () => {
    const initial = createInitialGameState()
    const otherRecord = createBookstoreBranchOperationsRecord({ branchId: 'branch-fixture-other', shelfCapacity: 10, checkoutCapacity: 1, open: true, stock: [{ merchandiseId: 'merch-a', quantity: 5 }] })
    const state = { ...initial, bookstoreOperations: { records: [...initial.bookstoreOperations.records, otherRecord] } }
    const decremented = decrementBookstoreStock(state, BOOKSTORE_BRANCH_ID, [{ merchandiseId: 'bookstore-merch-001', quantity: 1 }])
    expect(decremented.bookstoreOperations.records.find((record) => record.branchId === 'branch-fixture-other')).toEqual(otherRecord)
  })
})

describe('resolveBookstoreOperationsForBranch', () => {
  it('resolves the seeded Branch operations record', () => {
    const state = createInitialGameState()
    const operations = resolveBookstoreOperationsForBranch(state, BOOKSTORE_BRANCH_ID)
    expect(operations).toEqual({ branchId: BOOKSTORE_BRANCH_ID, shelfCapacity: 480, checkoutCapacity: 2, open: true, stock: SEEDED_STOCK })
  })

  it('resolves undefined for a Branch with no represented operations record — a legitimate structural state, not a defect', () => {
    const state = createInitialGameState()
    expect(resolveBookstoreOperationsForBranch(state, 'branch-with-no-operations')).toBeUndefined()
  })

  it('resolves independently of any commerce record: a Branch may have operations without commerce', () => {
    const initial = createInitialGameState()
    const operationsOnlyRecord = createBookstoreBranchOperationsRecord({
      branchId: 'branch-fixture-operations-only', shelfCapacity: 200, checkoutCapacity: 1, open: true, stock: [{ merchandiseId: 'merch-a', quantity: 50 }],
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

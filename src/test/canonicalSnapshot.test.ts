import { describe, expect, it } from 'vitest'
import { withoutBookstoreBackgroundTiming } from './canonicalSnapshot'
import { createInitialGameState } from '../core/game/initialState'
import { BOOKSTORE_BRANCH_ID } from '../core/game/business'
import type { GameState } from '../core/game/types'

describe('withoutBookstoreBackgroundTiming', () => {
  it('normalizes only both independent countdowns, preserving cadence and Trend meaning', () => {
    const state = createInitialGameState()
    const normalized = withoutBookstoreBackgroundTiming(state)
    expect(normalized.bookstoreSalesCadence.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      locationOpportunityRatePerHour: 10,
      attractivenessMultiplier: 1.0,
      remainingUntilOpportunityMs: 0,
    }])
    expect(normalized.bookstoreTrend.active).toEqual({ ...state.bookstoreTrend.active!, remainingDurationMs: 0 })
  })

  it('treats two snapshots differing only in remainingUntilOpportunityMs as equal', () => {
    const base = createInitialGameState()
    const ticked: GameState = { ...base, bookstoreSalesCadence: { records: base.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 17_342.5 })) } }
    expect(withoutBookstoreBackgroundTiming(ticked)).toEqual(withoutBookstoreBackgroundTiming(base))
  })

  it('treats two snapshots differing only in active Trend remainingDurationMs as equal', () => {
    const base = createInitialGameState()
    const ticked: GameState = { ...base, bookstoreTrend: { active: { ...base.bookstoreTrend.active!, remainingDurationMs: 17_342.5 } } }
    expect(withoutBookstoreBackgroundTiming(ticked)).toEqual(withoutBookstoreBackgroundTiming(base))
  })

  it('still distinguishes a real change in active Trend meaning', () => {
    const base = createInitialGameState()
    const changed: GameState = { ...base, bookstoreTrend: { active: { ...base.bookstoreTrend.active!, activePressure: 119 } } }
    expect(withoutBookstoreBackgroundTiming(changed)).not.toEqual(withoutBookstoreBackgroundTiming(base))
  })

  it('still distinguishes a real change in cadence record count', () => {
    const base = createInitialGameState()
    const withoutRecord: GameState = { ...base, bookstoreSalesCadence: { records: [] } }
    expect(withoutBookstoreBackgroundTiming(withoutRecord)).not.toEqual(withoutBookstoreBackgroundTiming(base))
  })

  it('still distinguishes a real change in branchId', () => {
    const base = createInitialGameState()
    const renamed: GameState = { ...base, bookstoreSalesCadence: { records: base.bookstoreSalesCadence.records.map((record) => ({ ...record, branchId: 'some-other-branch' })) } }
    expect(withoutBookstoreBackgroundTiming(renamed)).not.toEqual(withoutBookstoreBackgroundTiming(base))
  })

  it('still distinguishes a real change in attractivenessMultiplier', () => {
    const base = createInitialGameState()
    const reconfigured: GameState = { ...base, bookstoreSalesCadence: { records: base.bookstoreSalesCadence.records.map((record) => ({ ...record, attractivenessMultiplier: 2.0 })) } }
    expect(withoutBookstoreBackgroundTiming(reconfigured)).not.toEqual(withoutBookstoreBackgroundTiming(base))
  })
})

import { describe, expect, it } from 'vitest'
import { withoutBookstoreCadenceTiming } from './canonicalSnapshot'
import { createInitialGameState } from '../core/game/initialState'
import { BOOKSTORE_BRANCH_ID } from '../core/game/business'
import type { GameState } from '../core/game/types'

describe('withoutBookstoreCadenceTiming', () => {
  it('normalizes only remainingUntilOpportunityMs, preserving branchId, demand configuration, and record count', () => {
    const state = createInitialGameState()
    const normalized = withoutBookstoreCadenceTiming(state)
    expect(normalized.bookstoreSalesCadence.records).toEqual([{
      branchId: BOOKSTORE_BRANCH_ID,
      locationOpportunityRatePerHour: 10,
      attractivenessMultiplier: 1.0,
      remainingUntilOpportunityMs: 0,
    }])
  })

  it('treats two snapshots differing only in remainingUntilOpportunityMs as equal', () => {
    const base = createInitialGameState()
    const ticked: GameState = { ...base, bookstoreSalesCadence: { records: base.bookstoreSalesCadence.records.map((record) => ({ ...record, remainingUntilOpportunityMs: 17_342.5 })) } }
    expect(withoutBookstoreCadenceTiming(ticked)).toEqual(withoutBookstoreCadenceTiming(base))
  })

  it('still distinguishes a real change in cadence record count', () => {
    const base = createInitialGameState()
    const withoutRecord: GameState = { ...base, bookstoreSalesCadence: { records: [] } }
    expect(withoutBookstoreCadenceTiming(withoutRecord)).not.toEqual(withoutBookstoreCadenceTiming(base))
  })

  it('still distinguishes a real change in branchId', () => {
    const base = createInitialGameState()
    const renamed: GameState = { ...base, bookstoreSalesCadence: { records: base.bookstoreSalesCadence.records.map((record) => ({ ...record, branchId: 'some-other-branch' })) } }
    expect(withoutBookstoreCadenceTiming(renamed)).not.toEqual(withoutBookstoreCadenceTiming(base))
  })

  it('still distinguishes a real change in attractivenessMultiplier', () => {
    const base = createInitialGameState()
    const reconfigured: GameState = { ...base, bookstoreSalesCadence: { records: base.bookstoreSalesCadence.records.map((record) => ({ ...record, attractivenessMultiplier: 2.0 })) } }
    expect(withoutBookstoreCadenceTiming(reconfigured)).not.toEqual(withoutBookstoreCadenceTiming(base))
  })
})

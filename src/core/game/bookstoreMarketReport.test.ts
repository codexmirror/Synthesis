import { describe, expect, it } from 'vitest'
import { BOOKSTORE_BRANCH_ID } from './business'
import { requestBookstoreMarketReportFromOperatedRemoteDevice } from './companyAdministration'
import { createInitialGameState } from './initialState'
import { connectRemoteFromObservation } from './remoteSession'
import { advanceGameState } from './gameAdvancement'
import { deriveBookstoreMarketCondition, isBookstoreDemandMateriallyHigher } from './bookstoreMarketReport'
import type { GameState } from './types'

function operated(state = createInitialGameState()): GameState {
  const withAccess: GameState = { ...state, deviceAccess: { nextId: 2, established: [{
    id: 'access-phone', sourceDeviceId: state.player.localDevice.id, targetDeviceId: 'host-phone-001', viaServiceId: 'service-ssh-003', privilege: 'USER',
  }] } }
  return connectRemoteFromObservation(withAccess, { targetDeviceId: 'host-phone-001', address: '10.42.0.61' }).state
}

describe('Bookstore Market Analyst observation', () => {
  it('maps exact qualitative pressure boundaries', () => {
    expect([99, 100, 101, 119, 120].map(deriveBookstoreMarketCondition)).toEqual(['SOFT', 'STABLE', 'ELEVATED', 'ELEVATED', 'HIGH'])
  })

  it('compares the 30% standout boundary exactly near the safe-integer limit', () => {
    const second = 6_900_000_000_000_000
    expect(Number.isSafeInteger(second)).toBe(true)
    expect(isBookstoreDemandMateriallyHigher(8_970_000_000_000_000, second)).toBe(true)
    expect(isBookstoreDemandMateriallyHigher(8_969_999_999_999_999, second)).toBe(false)
  })

  it('appends immutable reports from current truth, including only a real active Trend and a thresholded carried standout', () => {
    const initial = operated()
    const first = requestBookstoreMarketReportFromOperatedRemoteDevice(initial, BOOKSTORE_BRANCH_ID)
    expect(first.status).toBe('generated')
    if (first.status !== 'generated') return
    const reportA = first.state.knowledge.bookstoreMarket!.reports[0]
    expect(reportA.genres.find(x => x.genre === 'SCIENCE_FICTION')).toEqual({ genre: 'SCIENCE_FICTION', condition: 'HIGH', trend: { id: 'bookstore-trend-science-fiction-buy-pressure-v0', phase: 'EMERGING' } })
    expect(reportA.genres.find(x => x.genre === 'MYSTERY')).toEqual({ genre: 'MYSTERY', condition: 'SOFT' })
    expect(reportA.standout).toEqual({ merchandiseId: 'bookstore-merch-002', capturedName: 'Static Bloom' })
    expect(reportA).not.toHaveProperty('pressure')
    expect(reportA).not.toHaveProperty('generatedAt')

    const established = advanceGameState(first.state, 360_000)
    const second = requestBookstoreMarketReportFromOperatedRemoteDevice(established, BOOKSTORE_BRANCH_ID)
    expect(second.status).toBe('generated')
    if (second.status !== 'generated') return
    expect(second.state.knowledge.bookstoreMarket!.reports[0]).toEqual(reportA)
    expect(second.state.knowledge.bookstoreMarket!.reports[1].genres.find(x => x.genre === 'SCIENCE_FICTION')?.trend?.phase).toBe('ESTABLISHED')

    const complete = advanceGameState(second.state, 2_880_001)
    const third = requestBookstoreMarketReportFromOperatedRemoteDevice(complete, BOOKSTORE_BRANCH_ID)
    expect(third.status).toBe('generated')
    if (third.status !== 'generated') return
    expect(third.state.knowledge.bookstoreMarket!.reports.map(x => x.id)).toEqual(['bookstore-market-report-0001', 'bookstore-market-report-0002', 'bookstore-market-report-0003'])
    expect(third.state.knowledge.bookstoreMarket!.reports[0]).toEqual(reportA)
    expect(third.state.knowledge.bookstoreMarket!.reports[2].genres.find(x => x.genre === 'SCIENCE_FICTION')).toEqual({ genre: 'SCIENCE_FICTION', condition: 'STABLE' })
    expect(third.state.knowledge.bookstoreMarket!.reports[2].standout).toBeUndefined()
  })

  it('fails closed without Session, authority, Branch relation, or valid market truth', () => {
    const initial = createInitialGameState()
    expect(requestBookstoreMarketReportFromOperatedRemoteDevice(initial, BOOKSTORE_BRANCH_ID).state).toBe(initial)
    const connected = operated()
    const noAuthority = { ...connected, business: { ...connected.business, administrationSessions: [] } }
    expect(requestBookstoreMarketReportFromOperatedRemoteDevice(noAuthority, BOOKSTORE_BRANCH_ID).state).toBe(noAuthority)
    const malformed = { ...connected, bookstoreMarket: { genrePressures: [] } }
    expect(requestBookstoreMarketReportFromOperatedRemoteDevice(malformed, BOOKSTORE_BRANCH_ID).state).toBe(malformed)
  })
})

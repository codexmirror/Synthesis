import { describe, expect, it } from 'vitest'
import { presentVeyraMarketReport, presentVeyraMarketReports } from './veyraMarketReport'
import type { BookstoreMarketReport } from '../../core/game/types'

const report = (overrides: Partial<BookstoreMarketReport> = {}): BookstoreMarketReport => ({
  id: 'bookstore-market-report-0001',
  branchId: 'business-branch-bookstore-01',
  genres: [
    { genre: 'SCIENCE_FICTION', condition: 'HIGH', trend: { id: 'trend-01', phase: 'EMERGING' } },
    { genre: 'THRILLER', condition: 'STABLE' },
    { genre: 'MYSTERY', condition: 'SOFT' },
    { genre: 'LITERARY_FICTION', condition: 'STABLE' },
  ],
  ...overrides,
})

/**
 * The Analyst's wording is a deterministic transformation of one captured
 * report and nothing else. These are the semantics that wording carries.
 */
describe('VEYRA market report presentation', () => {
  it('leads with the genres that share the strongest captured condition', () => {
    expect(presentVeyraMarketReport(report(), 1).headline).toBe('Buy pressure is high in Science Fiction.')
  })

  it('names every genre sharing the strongest condition rather than picking one', () => {
    const shared = report({ genres: [
      { genre: 'SCIENCE_FICTION', condition: 'ELEVATED' },
      { genre: 'THRILLER', condition: 'ELEVATED' },
      { genre: 'MYSTERY', condition: 'SOFT' },
      { genre: 'LITERARY_FICTION', condition: 'ELEVATED' },
    ] })
    expect(presentVeyraMarketReport(shared, 1).headline)
      .toBe('Buy pressure is elevated in Science Fiction, Thriller and Literary Fiction.')
  })

  it('claims no leading genre where every captured condition is the same', () => {
    const flat = report({ genres: [
      { genre: 'SCIENCE_FICTION', condition: 'STABLE' },
      { genre: 'THRILLER', condition: 'STABLE' },
      { genre: 'MYSTERY', condition: 'STABLE' },
      { genre: 'LITERARY_FICTION', condition: 'STABLE' },
    ] })
    expect(presentVeyraMarketReport(flat, 1).headline).toBe('Buy pressure is steady across every genre this branch carries.')
  })

  it('keeps every captured observation individually visible, in its captured order', () => {
    const presented = presentVeyraMarketReport(report(), 1)
    expect(presented.conditions.map(({ genreLabel, conditionLabel }) => `${genreLabel} ${conditionLabel}`)).toEqual([
      'Science Fiction High', 'Thriller Steady', 'Mystery Soft', 'Literary Fiction Steady',
    ])
    expect(presented.conditions.filter(({ carriesTrend }) => carriesTrend).map(({ genreLabel }) => genreLabel)).toEqual(['Science Fiction'])
  })

  it('states the captured trend phase and distinguishes all three', () => {
    const phases = (['EMERGING', 'ESTABLISHED', 'LATE'] as const).map((phase) => presentVeyraMarketReport(
      report({ genres: [{ genre: 'THRILLER', condition: 'HIGH', trend: { id: 'trend-01', phase } }] }), 1,
    ).trend?.sentence)
    expect(phases).toEqual([
      'A trend is running in Thriller, and it has only recently emerged.',
      'A trend is running in Thriller, and it has been active for a while.',
      'A trend is running in Thriller, and it appears to be in a late phase.',
    ])
    expect(presentVeyraMarketReport(report({ genres: [{ genre: 'THRILLER', condition: 'HIGH' }] }), 1).trend).toBeUndefined()
  })

  it('uses the captured standout name and says nothing where none was captured', () => {
    expect(presentVeyraMarketReport(report({ standout: { merchandiseId: 'bookstore-merch-001', capturedName: 'Static Bloom' } }), 1).standout)
      .toBe('Static Bloom stands out among the books this branch carries.')
    expect(presentVeyraMarketReport(report(), 1).standout).toBeUndefined()
  })

  it('invents no cause, forecast, duration or figure anywhere in the wording', () => {
    const presented = presentVeyraMarketReport(report({ standout: { merchandiseId: 'bookstore-merch-001', capturedName: 'Static Bloom' } }), 1)
    const wording = [presented.headline, presented.trend?.sentence, presented.standout, ...presented.conditions.map(({ conditionLabel }) => conditionLabel)].join(' ')
    expect(wording).not.toMatch(/because|caused|due to|will|expect|forecast|predict|minute|hour|day|ends|remaining|\d/i)
  })

  it('presents history newest first, each carrying its represented position', () => {
    const reports = [report({ id: 'r1' }), report({ id: 'r2' }), report({ id: 'r3' })]
    expect(presentVeyraMarketReports(reports).map(({ id, ordinal }) => [id, ordinal])).toEqual([['r3', 3], ['r2', 2], ['r1', 1]])
    expect(presentVeyraMarketReports([])).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { createInitialGameState } from './initialState'
import { BOOKSTORE_BOOK_GENRES, BOOKSTORE_GENRE_MARKET_PRESSURES, resolveValidBookstoreGenreMarketPressures } from './bookstoreMarket'
import { deriveValidBookstoreEffectiveDemand } from './bookstoreSale'
import type { BookstoreGenreMarketPressureRecord } from './types'

describe('Bookstore Genre Market Pressure', () => {
  it('seeds exactly one authored current pressure for every represented Genre', () => {
    const state = createInitialGameState()
    expect(state.bookstoreMarket.genrePressures).toEqual([
      { genre: 'SCIENCE_FICTION', pressure: 120 },
      { genre: 'THRILLER', pressure: 100 },
      { genre: 'MYSTERY', pressure: 90 },
      { genre: 'LITERARY_FICTION', pressure: 100 },
    ])
    expect(state.bookstoreMarket.genrePressures).toEqual(BOOKSTORE_GENRE_MARKET_PRESSURES)
    expect(new Set(state.bookstoreMarket.genrePressures.map(record => record.genre))).toEqual(new Set(BOOKSTORE_BOOK_GENRES))
    expect(state.bookstoreMarket).not.toHaveProperty('effectiveDemand')
  })

  it.each([
    ['missing', BOOKSTORE_GENRE_MARKET_PRESSURES.slice(1)],
    ['duplicate', [...BOOKSTORE_GENRE_MARKET_PRESSURES.slice(0, -1), BOOKSTORE_GENRE_MARKET_PRESSURES[0]]],
    ['unsupported', [...BOOKSTORE_GENRE_MARKET_PRESSURES.slice(0, -1), { genre: 'ROMANCE', pressure: 100 }]],
    ['zero', BOOKSTORE_GENRE_MARKET_PRESSURES.map(record => record.genre === 'THRILLER' ? { ...record, pressure: 0 } : record)],
    ['negative', BOOKSTORE_GENRE_MARKET_PRESSURES.map(record => record.genre === 'THRILLER' ? { ...record, pressure: -1 } : record)],
    ['fractional', BOOKSTORE_GENRE_MARKET_PRESSURES.map(record => record.genre === 'THRILLER' ? { ...record, pressure: 1.5 } : record)],
    ['non-finite', BOOKSTORE_GENRE_MARKET_PRESSURES.map(record => record.genre === 'THRILLER' ? { ...record, pressure: Infinity } : record)],
    ['unsafe', BOOKSTORE_GENRE_MARKET_PRESSURES.map(record => record.genre === 'THRILLER' ? { ...record, pressure: Number.MAX_SAFE_INTEGER + 1 } : record)],
  ])('fails closed for %s pressure truth', (_label, records) => {
    expect(resolveValidBookstoreGenreMarketPressures(records as readonly BookstoreGenreMarketPressureRecord[])).toBeUndefined()
  })

  it('derives Baseline Popularity times current Genre Pressure without flattening same-Genre ratios', () => {
    const state = createInitialGameState()
    const pressures = resolveValidBookstoreGenreMarketPressures(state.bookstoreMarket.genrePressures)!
    const demand = deriveValidBookstoreEffectiveDemand(state.bookstoreCommerce.bookCatalog, pressures)!
    expect(demand.get('bookstore-book-010')).toBe(180 * 120)
    expect(demand.get('bookstore-book-014')).toBe(100 * 120)
    expect(demand.get('bookstore-book-010')! / demand.get('bookstore-book-014')!).toBe(180 / 100)
  })
})

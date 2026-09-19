import type { BookstoreBookGenre, BookstoreGenreMarketPressureRecord, BookstoreMarketState } from './types'
export const BOOKSTORE_SCIENCE_FICTION_ACTIVE_TREND_PRESSURE = 120

/** The complete represented Bookstore Genre identity set. Genre identity itself keys market pressure. */
export const BOOKSTORE_BOOK_GENRES: readonly BookstoreBookGenre[] = [
  'SCIENCE_FICTION',
  'THRILLER',
  'MYSTERY',
  'LITERARY_FICTION',
]

/** Authored, temporally inert V1 hidden market truth. 100 is a neutral relative index, not a percentage or cap. */
export const BOOKSTORE_NON_TREND_GENRE_MARKET_PRESSURES: readonly BookstoreGenreMarketPressureRecord[] = [
  { genre: 'THRILLER', pressure: 100 },
  { genre: 'MYSTERY', pressure: 90 },
  { genre: 'LITERARY_FICTION', pressure: 100 },
]
/** Complete authored initial consequence, retained as the public fixture used by focused tests. */
export const BOOKSTORE_GENRE_MARKET_PRESSURES: readonly BookstoreGenreMarketPressureRecord[] = [
  { genre: 'SCIENCE_FICTION', pressure: BOOKSTORE_SCIENCE_FICTION_ACTIVE_TREND_PRESSURE }, ...BOOKSTORE_NON_TREND_GENRE_MARKET_PRESSURES,
]

export function createInitialBookstoreMarketState(): BookstoreMarketState {
  return { genrePressures: BOOKSTORE_GENRE_MARKET_PRESSURES.map(record => ({ ...record })) }
}

/** Resolve complete one-to-one current pressure truth. Missing, duplicate, dangling, or invalid truth has no neutral fallback. */
export function resolveValidBookstoreGenreMarketPressures(
  records: readonly BookstoreGenreMarketPressureRecord[],
): ReadonlyMap<BookstoreBookGenre, number> | undefined {
  if (records.length !== BOOKSTORE_BOOK_GENRES.length) return undefined
  const genres = new Set<BookstoreBookGenre>(BOOKSTORE_BOOK_GENRES)
  const resolved = new Map<BookstoreBookGenre, number>()
  for (const record of records) {
    if (!genres.has(record.genre) || resolved.has(record.genre)) return undefined
    if (!Number.isSafeInteger(record.pressure) || record.pressure <= 0) return undefined
    resolved.set(record.genre, record.pressure)
  }
  if (BOOKSTORE_BOOK_GENRES.some(genre => !resolved.has(genre))) return undefined
  return resolved
}

import { findBookstoreCommerceRecord } from './bookstoreCommerce'
import { BOOKSTORE_BOOK_GENRES, resolveValidBookstoreGenreMarketPressures } from './bookstoreMarket'
import { deriveValidBookstoreEffectiveDemand } from './bookstoreSale'
import { deriveBookstoreTrendPhase, isValidActiveBookstoreTrend } from './bookstoreTrend'
import type { BookstoreMarketCondition, BookstoreMarketReport, GameState } from './types'

export function deriveBookstoreMarketCondition(pressure: number): BookstoreMarketCondition | undefined {
  if (!Number.isSafeInteger(pressure) || pressure <= 0) return undefined
  if (pressure < 100) return 'SOFT'
  if (pressure === 100) return 'STABLE'
  if (pressure < 120) return 'ELEVATED'
  return 'HIGH'
}

function formatReportId(nextId: number): string {
  return `bookstore-market-report-${String(nextId).padStart(4, '0')}`
}

/** Exact 1.30 comparison for already-validated safe-integer demand weights. */
export function isBookstoreDemandMateriallyHigher(topDemand: number, secondDemand: number): boolean {
  if (!Number.isSafeInteger(topDemand) || !Number.isSafeInteger(secondDemand) || topDemand <= 0 || secondDemand <= 0) return false
  return BigInt(topDemand) * 10n >= BigInt(secondDemand) * 13n
}

/** Capture only the qualitative market semantics and carried-Book conclusion learned now. */
export function generateBookstoreMarketReport(state: GameState, branchId: string): GameState | undefined {
  const branches = state.business.branches.filter(branch => branch.id === branchId)
  if (branches.length !== 1 || state.bookstoreCommerce.records.filter(record => record.branchId === branchId).length !== 1
    || state.bookstoreOperations.records.filter(record => record.branchId === branchId).length !== 1) return undefined
  const pressures = resolveValidBookstoreGenreMarketPressures(state.bookstoreMarket.genrePressures)
  if (!pressures) return undefined
  const trend = state.bookstoreTrend.active
  const phase = trend ? deriveBookstoreTrendPhase(trend) : undefined
  if (trend && (!isValidActiveBookstoreTrend(trend) || !phase || pressures.get(trend.genre) !== trend.activePressure)) return undefined

  const genres = BOOKSTORE_BOOK_GENRES.map(genre => {
    const condition = deriveBookstoreMarketCondition(pressures.get(genre)!)!
    return { genre, condition, ...(trend?.genre === genre ? { trend: { id: trend.id, phase: phase! } } : {}) }
  })
  const commerce = findBookstoreCommerceRecord(state, branchId)!
  if (new Set(commerce.assortment).size !== commerce.assortment.length) return undefined
  const carried = commerce.assortment.flatMap(id => {
    const matches = state.bookstoreCommerce.bookCatalog.filter(book => book.id === id)
    return matches.length === 1 ? [matches[0]] : []
  })
  if (carried.length !== commerce.assortment.length) return undefined
  const demand = deriveValidBookstoreEffectiveDemand(carried, pressures)
  if (!demand) return undefined
  const ranked = carried.map(book => ({ book, demand: demand.get(book.id)! })).sort((a, b) => b.demand - a.demand)
  const standout = ranked.length >= 2
    && ranked[0].demand !== ranked[1].demand
    && isBookstoreDemandMateriallyHigher(ranked[0].demand, ranked[1].demand)
    ? { merchandiseId: ranked[0].book.id, capturedName: ranked[0].book.name }
    : undefined
  const knowledge = state.knowledge.bookstoreMarket
  if (!knowledge) return undefined
  const nextId = knowledge.nextReportId
  if (!Number.isSafeInteger(nextId) || nextId <= 0) return undefined
  const id = formatReportId(nextId)
  if (knowledge.reports.some(report => report.id === id)) return undefined
  const report: BookstoreMarketReport = { id, branchId, genres, ...(standout ? { standout } : {}) }
  return { ...state, knowledge: { ...state.knowledge, bookstoreMarket: {
    nextReportId: nextId + 1,
    reports: [...knowledge.reports, report],
  } } }
}

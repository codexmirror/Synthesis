import type {
  BookstoreMarketCondition,
  BookstoreMarketReport,
  BookstoreMarketReportGenreObservation,
  BookstoreTrendPhase,
} from '../../core/game/types'

/**
 * How the Business client says out loud what one captured Market Report
 * already contains.
 *
 * Every value here is a deterministic transformation of that report's own
 * captured semantics — the qualitative condition captured per Genre, the
 * captured Trend phase where the report captured a Trend, the captured Book
 * name where it captured a standout, and the report's own position in this
 * Branch's represented history. Nothing reads current hidden market truth,
 * current Pressure, current Effective Demand, the live Trend, the Catalog or
 * the clock, so an old report keeps saying exactly what was learned when it
 * was taken.
 *
 * It states no cause, no forecast, no duration, no number and no
 * recommendation, because the report captures none of those.
 */
export interface VeyraMarketReportPresentation {
  readonly id: string
  /** This report's 1-based position in the Branch's represented report order. */
  readonly ordinal: number
  /** The report's own strongest captured buy-pressure statement, as one sentence. */
  readonly headline: string
  /** Every captured Genre observation, in the report's own captured order. */
  readonly conditions: readonly VeyraMarketConditionEntry[]
  readonly trend?: VeyraMarketTrendNote
  /** The captured standout Book name, exactly as it was captured. */
  readonly standout?: string
}

export interface VeyraMarketConditionEntry {
  readonly genreLabel: string
  readonly condition: BookstoreMarketCondition
  readonly conditionLabel: string
  readonly carriesTrend: boolean
}

export interface VeyraMarketTrendNote {
  readonly genreLabel: string
  readonly phase: BookstoreTrendPhase
  readonly sentence: string
}

/** Strongest first. This is the qualitative order the captured conditions already have. */
const CONDITION_ORDER: readonly BookstoreMarketCondition[] = ['HIGH', 'ELEVATED', 'STABLE', 'SOFT']

const CONDITION_WORD: Readonly<Record<BookstoreMarketCondition, string>> = {
  HIGH: 'high',
  ELEVATED: 'elevated',
  STABLE: 'steady',
  SOFT: 'soft',
}

const CONDITION_LABEL: Readonly<Record<BookstoreMarketCondition, string>> = {
  HIGH: 'High',
  ELEVATED: 'Elevated',
  STABLE: 'Steady',
  SOFT: 'Soft',
}

const PHASE_CLAUSE: Readonly<Record<BookstoreTrendPhase, string>> = {
  EMERGING: 'it has only recently emerged',
  ESTABLISHED: 'it has been active for a while',
  LATE: 'it appears to be in a late phase',
}

/**
 * Present this Branch's captured reports newest first, each carrying its own
 * represented position so the player can always tell which report they are
 * reading and in what order they were taken.
 */
export function presentVeyraMarketReports(reports: readonly BookstoreMarketReport[]): readonly VeyraMarketReportPresentation[] {
  return reports
    .map((report, index) => presentVeyraMarketReport(report, index + 1))
    .reverse()
}

export function presentVeyraMarketReport(report: BookstoreMarketReport, ordinal: number): VeyraMarketReportPresentation {
  const conditions = report.genres.map((observation) => ({
    genreLabel: formatBookstoreGenre(observation.genre),
    condition: observation.condition,
    conditionLabel: CONDITION_LABEL[observation.condition],
    carriesTrend: Boolean(observation.trend),
  }))
  const carrying = report.genres.find((observation) => observation.trend)
  return {
    id: report.id,
    ordinal,
    headline: composeHeadline(report.genres),
    conditions,
    ...(carrying?.trend ? { trend: trendNote(carrying, carrying.trend.phase) } : {}),
    ...(report.standout ? { standout: `${report.standout.capturedName} stands out among the books this branch carries.` } : {}),
  }
}

/**
 * One sentence for the report's strongest captured signal, rather than one
 * sentence per Genre: the same captured facts stay individually visible as the
 * condition entries above, so the wording groups instead of repeating.
 *
 * The sentence names only the Genres that actually share the strongest
 * captured condition, and states that condition and nothing else. Where every
 * reported Genre shares it, that is what it says — a market with no
 * differentiated signal must not be presented as though one Genre led it.
 *
 * This is the global captured Genre-condition set, not the Branch's carried
 * assortment: a Market Report captures one condition per every represented
 * Genre, carried by this Branch or not. Only the standout below is scoped to
 * carried Books, so the wording here must never say "this branch carries".
 */
function composeHeadline(observations: readonly BookstoreMarketReportGenreObservation[]): string {
  if (observations.length === 0) return 'This report captured no genre observations.'
  const strongest = CONDITION_ORDER.find((condition) => observations.some((observation) => observation.condition === condition))!
  const named = observations.filter((observation) => observation.condition === strongest)
  const word = CONDITION_WORD[strongest]
  if (named.length === observations.length) return `Buy pressure is ${word} across the market.`
  return `Buy pressure is ${word} in ${joinGenres(named.map(({ genre }) => formatBookstoreGenre(genre)))}.`
}

function trendNote(observation: BookstoreMarketReportGenreObservation, phase: BookstoreTrendPhase): VeyraMarketTrendNote {
  const genreLabel = formatBookstoreGenre(observation.genre)
  return { genreLabel, phase, sentence: `A trend is running in ${genreLabel}, and ${PHASE_CLAUSE[phase]}.` }
}

function joinGenres(labels: readonly string[]): string {
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`
}

/** The represented Genre identity in ordinary human wording. */
export function formatBookstoreGenre(genre: string): string {
  return genre.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
}

import { useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { PlaceOperatedBookstoreRestockOrderResult } from '../../core/game/companyAdministration'
import { formatBookstoreGenre, presentVeyraMarketReports, type VeyraMarketConditionEntry } from './veyraMarketReport'
import { proposeBookstoreRestockOrder, type BookstoreOrderDecisions, type BookstoreOrderProposal } from '../../core/game/bookstoreRestock'
import { formatDollarCents } from '../dollarFormat'
import { projectVeyraBusiness, type VeyraBusinessBranchView, type VeyraBusinessCompanyView, type VeyraBusinessOfferView, type VeyraBusinessProductView } from './veyraBusiness'
import { VeyraIcon } from './VeyraIcon'

/** Which Business surface is open. Presentation only; it never reaches `GameState`. */
export type VeyraBusinessDetail = { readonly offerId: string } | { readonly inventory: true } | { readonly productId: string } | { readonly marketAnalyst: true }

/**
 * The Business surface directly above this one, or `undefined` where the
 * Business root is.
 *
 * Business details are not a flat set: a Product is something the player
 * reached *through* Inventory, so Inventory is where leaving it goes — from
 * this surface's own back control and from VEYRA's navigation band alike
 * (`veyraNavigation.ts`). Supply review and the Analyst are reached from the
 * root and return to it.
 */
export function parentVeyraBusinessDetail(detail: VeyraBusinessDetail): VeyraBusinessDetail | undefined {
  return 'productId' in detail ? { inventory: true } : undefined
}

/**
 * Business: the phone's client for the Company this Device may actually
 * administer.
 *
 * It owns no Business truth at all. Which Company it manages comes from the
 * operated Device's own Company Administration authority, Company Funds from
 * that Company's current Treasury designation and its Civic Dollar Account,
 * inventory from Bookstore Operations, and offers and orders from Bookstore
 * Restock — every one of them re-read on every render, so a sale, an advancing
 * delivery or a revoked authority is reflected without this surface holding a
 * timer, a cache or a copy of anything.
 *
 * Being installed is not authority. Opening this client with no Company to
 * administer states exactly that and exposes no Company truth and no action.
 */
export function VeyraBusiness({ detail, onDetail }: {
  detail?: VeyraBusinessDetail
  onDetail: (detail?: VeyraBusinessDetail) => void
}) {
  const state = useGameState()
  const { placeBookstoreRestockOrderFromOperatedRemoteDevice, requestBookstoreMarketReportFromOperatedRemoteDevice } = useGameActions()
  const projection = projectVeyraBusiness(state)
  const [notice, setNotice] = useState<string>()

  if (projection.status === 'no_company_access') {
    return <section className="veyra-screen" aria-label="Business">
      <h1 className="veyra-title">Business</h1>
      <p className="veyra-empty">No company access available.</p>
    </section>
  }

  if (projection.status === 'company_selection_unsupported') {
    return <section className="veyra-screen" aria-label="Business">
      <h1 className="veyra-title">Business</h1>
      <p className="veyra-empty">This phone manages more than one company. Choosing between them is not supported yet.</p>
    </section>
  }

  const { company, branch } = projection
  // The review is presentation-local and reads the offer fresh: an offer that
  // is no longer represented simply has no review to show.
  const reviewed = detail && 'offerId' in detail && branch?.offers.find(({ id }) => id === detail.offerId)

  if (detail && 'productId' in detail && branch) {
    const product = branch.inventory.items.find(item => item.merchandiseId === detail.productId)
    if (product) return <VeyraBusinessProductDetail branch={branch} product={product} onBack={() => onDetail({ inventory: true })} />
  }
  if (detail && 'inventory' in detail && branch) {
    return <VeyraBusinessInventory branch={branch} onBack={() => onDetail(undefined)} onProduct={(productId) => onDetail({ productId })} />
  }
  if (detail && 'marketAnalyst' in detail && branch) {
    return <VeyraMarketAnalyst branch={branch} request={() => requestBookstoreMarketReportFromOperatedRemoteDevice(branch.branchId)} onBack={() => onDetail(undefined)} />
  }

  if (detail && reviewed && branch) {
    return <VeyraBusinessReview
      company={company}
      offer={reviewed}
      state={state}
      branchId={branch.branchId}
      place={(decisions, proposal) => placeBookstoreRestockOrderFromOperatedRemoteDevice(branch.branchId, decisions, proposal)}
      onPlaced={() => { setNotice(`Order placed with ${reviewed.sellerDisplayName}.`); onDetail(undefined) }}
      onCancel={() => onDetail(undefined)}
    />
  }

  return <VeyraBusinessRoot
    company={company}
    branch={branch}
    notice={notice}
    onOffer={(offerId) => { setNotice(undefined); onDetail({ offerId }) }}
    onInventory={() => onDetail({ inventory: true })}
    onMarketAnalyst={() => onDetail({ marketAnalyst: true })}
  />
}

/**
 * The Business root: the Company being managed, the Branch it is managed
 * through, its current money, what is on and coming to its shelves, what can
 * be bought, and what has been ordered. Every value is represented truth; no
 * score, projection, forecast or other invented metric is derived from it.
 */
function VeyraBusinessRoot({ company, branch, notice, onOffer, onInventory, onMarketAnalyst }: {
  company: VeyraBusinessCompanyView
  branch?: VeyraBusinessBranchView
  notice?: string
  onOffer: (offerId: string) => void
  onInventory: () => void
  onMarketAnalyst: () => void
}) {
  return <section className="veyra-screen" aria-label="Business">
    <p className="veyra-eyebrow">Company</p>
    <h1 className="veyra-title">{company.displayName}</h1>

    {notice && <p className="veyra-notice" role="status">{notice}</p>}

    <div className="veyra-card veyra-balance">
      <p className="veyra-figure">{company.fundsCents === undefined ? 'Unavailable' : formatDollarCents(company.fundsCents)}</p>
      <p className="veyra-figure-note">Company funds</p>
    </div>

    {!branch
      ? <p className="veyra-empty">No branch is available to manage.</p>
      : <>
        <h2 className="veyra-section">Branch</h2>
        <dl className="veyra-card veyra-card--rows veyra-terms">
          <div className="veyra-row veyra-row--static"><dt>Branch</dt><dd>{branch.displayName}</dd></div>
          {branch.location && <div className="veyra-row veyra-row--static"><dt>Location</dt><dd>{branch.location}</dd></div>}
        </dl>

        <h2 className="veyra-section">Inventory</h2>
        <dl className="veyra-card veyra-card--rows veyra-terms">
          <div className="veyra-row veyra-row--static"><dt>In stock</dt><dd>{branch.inventory.totalStock} of {branch.inventory.shelfCapacity}</dd></div>
          <div className="veyra-row veyra-row--static"><dt>Incoming</dt><dd>{branch.inventory.incomingStock}</dd></div>
          <div className="veyra-row veyra-row--static"><dt>Titles</dt><dd>{branch.inventory.titleCount}</dd></div>
          <button className="veyra-row" type="button" onClick={onInventory}><span>View inventory</span><VeyraIcon name="chevron" /></button>
        </dl>

        <h2 className="veyra-section">Market</h2>
        <div className="veyra-card veyra-card--rows">
          <button className="veyra-row" type="button" onClick={onMarketAnalyst}>
            <span className="veyra-row__copy"><strong>Market Analyst</strong><small>Market research and business intelligence</small></span>
            <VeyraIcon name="chevron" />
          </button>
        </div>

        <h2 className="veyra-section">Supply</h2>
        {branch.offers.length === 0
          ? <p className="veyra-empty">No supply offers are available.</p>
          : <div className="veyra-card veyra-card--rows">
            {branch.offers.map((offer) => <button className="veyra-row" type="button" key={offer.id} onClick={() => onOffer(offer.id)}>
              <span className="veyra-row__copy">
                <strong>{offer.displayName}</strong>
                <small>{offer.sellerDisplayName}</small>
                <small>{offer.caseSize} units / case · {formatDeliveryDuration(offer.deliveryDurationMs)}</small>
              </span>
              <span className="veyra-row__trail">
                <span className="veyra-amount">From {formatDollarCents(offer.casePriceCents)}</span>
                <VeyraIcon name="chevron" />
              </span>
            </button>)}
          </div>}

        <h2 className="veyra-section">Restock orders</h2>
        {branch.orders.length === 0
          ? <p className="veyra-empty">Orders you place will appear here.</p>
          : <div className="veyra-card veyra-card--rows">
            {branch.orders.map((order) => <div className="veyra-row veyra-row--static" key={order.id}>
              <span className="veyra-row__copy">
                <strong>{order.offerDisplayName}</strong>
                <small>{order.sellerDisplayName} · {order.totalUnits} units</small>
              </span>
              <span className="veyra-row__copy veyra-business-status">
                <strong>{order.status === 'IN_TRANSIT' ? 'In transit' : 'Delivered'}</strong>
                {order.remainingDeliveryMs !== undefined && <small>{formatDeliveryDuration(order.remainingDeliveryMs)} left</small>}
              </span>
            </div>)}
          </div>}
      </>}
  </section>
}

/**
 * The Market Analyst: the phone's one deliberate business-intelligence surface
 * over this Branch's captured Market Reports.
 *
 * It is explicitly button-driven and nothing else. There is no text input, no
 * free-form question, no assistant state, no typing delay, no LLM and no
 * conversation model — the only Market observation is the one request control
 * below, and opening, leaving, reopening or re-rendering this surface observes
 * nothing at all.
 *
 * The reports it presents are Player Knowledge, immutable once taken. The
 * latest reading is given the weight it deserves; every earlier one stays
 * individually recoverable behind one disclosure, in its represented order,
 * still saying exactly what it captured (`veyraMarketReport.ts`).
 */
function VeyraMarketAnalyst({ branch, request, onBack }: {
  branch: VeyraBusinessBranchView
  request: () => { readonly status: string }
  onBack: () => void
}) {
  const [refusal, setRefusal] = useState<string>()
  const [historyOpen, setHistoryOpen] = useState(false)
  const [openedReportId, setOpenedReportId] = useState<string>()
  // Newest first: the report the player most likely wants is the one they just
  // asked for, and everything older is history rather than a feed.
  const [latest, ...earlier] = presentVeyraMarketReports(branch.marketReports)

  function requestReport() {
    const result = request()
    setRefusal(result.status === 'generated' ? undefined : 'Market research is unavailable.')
  }

  return <section className="veyra-screen" aria-label="Market Analyst">
    <VeyraBusinessBack parent="Business" onBack={onBack} />
    <p className="veyra-eyebrow">VEYRA Analyst</p>
    <h1 className="veyra-title">Market Analyst</h1>

    {/*
      * With nothing captured yet, the Analyst says what a report actually
      * contains rather than presenting an empty form. Every clause below
      * corresponds to something a captured report really carries: a
      * qualitative buy-pressure reading per reported Genre across the whole
      * market — not scoped to this Branch's assortment — whether one of them
      * carries a Trend, and a standout title among the Books this Branch
      * carries (carried, not necessarily in current physical stock). It
      * promises no cause, forecast, figure or recommendation.
      */}
    {!latest && <div className="veyra-card veyra-analyst-intro">
      <p>Ask for a report and I will read how buy pressure sits across the market, whether one genre is running on a trend, and whether any title this branch carries stands out.</p>
      <p className="veyra-analyst-intro__note">Each report is kept exactly as it was taken, so a later one never rewrites an earlier one.</p>
    </div>}

    {/*
      * The one Market observation, presented as the Analyst's suggested next
      * move rather than as a form's submit button: same explicitness, without
      * the oversized primary block that made repeated readings feel like
      * posting the same message again.
      */}
    <button className="veyra-analyst-request" type="button" onClick={requestReport}>
      <span className="veyra-analyst-request__mark"><VeyraIcon name="analyst" /></span>
      <span className="veyra-analyst-request__copy">
        <strong>{latest ? 'Refresh market report' : 'Request market report'}</strong>
        <small>{latest ? 'Take a new reading and keep this one' : 'Read the market as it stands now'}</small>
      </span>
    </button>

    {refusal && <p className="veyra-refusal" role="alert">{refusal}</p>}

    {latest && <article className="veyra-card veyra-report" aria-label={`Report ${latest.ordinal}`}>
      <p className="veyra-report__label">Latest reading · Report {latest.ordinal}</p>
      <p className="veyra-report__headline">{latest.headline}</p>
      {latest.trend && <p className="veyra-report__trend">{latest.trend.sentence}</p>}
      <VeyraMarketConditions entries={latest.conditions} />
      {latest.standout && <p className="veyra-report__standout">{latest.standout}</p>}
    </article>}

    {earlier.length > 0 && <>
      <h2 className="veyra-section">Earlier reports</h2>
      <div className="veyra-card veyra-card--rows">
        <button className="veyra-row" type="button" aria-expanded={historyOpen} onClick={() => setHistoryOpen(!historyOpen)}>
          <span className="veyra-row__copy">
            <strong>{earlier.length === 1 ? '1 earlier report' : `${earlier.length} earlier reports`}</strong>
            <small>{historyOpen ? 'Newest first' : 'Kept as they were taken'}</small>
          </span>
          <span className="veyra-row__trail" data-expanded={historyOpen || undefined}><VeyraIcon name="chevron" /></span>
        </button>
        {historyOpen && earlier.map((report) => <div className="veyra-history" key={report.id}>
          <button
            className="veyra-row"
            type="button"
            aria-expanded={openedReportId === report.id}
            onClick={() => setOpenedReportId(openedReportId === report.id ? undefined : report.id)}
          >
            <span className="veyra-row__copy">
              <strong>Report {report.ordinal}</strong>
              <small>{report.headline}</small>
            </span>
            <span className="veyra-row__trail" data-expanded={openedReportId === report.id || undefined}><VeyraIcon name="chevron" /></span>
          </button>
          {openedReportId === report.id && <div className="veyra-history__report" aria-label={`Report ${report.ordinal}`}>
            {report.trend && <p className="veyra-report__trend">{report.trend.sentence}</p>}
            <VeyraMarketConditions entries={report.conditions} />
            {report.standout && <p className="veyra-report__standout">{report.standout}</p>}
          </div>}
        </div>)}
      </div>
    </>}
  </section>
}

/**
 * Every captured Genre observation of one report, each on its own line with
 * its captured qualitative condition — the same facts the old surface wrote as
 * one sentence per Genre, without the repetition. The trend marker restates
 * only that this report captured a Trend on that Genre.
 */
function VeyraMarketConditions({ entries }: { entries: readonly VeyraMarketConditionEntry[] }) {
  return <dl className="veyra-report__conditions">
    {entries.map((entry) => <div className="veyra-report__condition" key={entry.genreLabel}>
      <dt>{entry.genreLabel}{entry.carriesTrend && <span className="veyra-report__trend-mark">Trend</span>}</dt>
      <dd data-condition={entry.condition}>{entry.conditionLabel}</dd>
    </div>)}
  </dl>
}

/**
 * A Business detail's own way back, naming the surface it returns to.
 *
 * Naming the parent is the point: the player can see that leaving a Product
 * goes to Inventory rather than to the Business root, and VEYRA's navigation
 * band resolves the same parent from the same hierarchy, so the two controls
 * can never disagree.
 */
function VeyraBusinessBack({ parent, onBack }: { parent: string; onBack: () => void }) {
  return <button className="veyra-back" type="button" onClick={onBack} aria-label={`Back to ${parent}`}>
    <VeyraIcon name="back" /><span>{parent}</span>
  </button>
}

function VeyraBusinessInventory({ branch, onBack, onProduct }: { branch: VeyraBusinessBranchView; onBack: () => void; onProduct: (id: string) => void }) {
  return <section className="veyra-screen" aria-label="Inventory">
    <VeyraBusinessBack parent="Business" onBack={onBack} />
    <p className="veyra-eyebrow">{branch.displayName}</p>
    <h1 className="veyra-title">Inventory</h1>
    <div className="veyra-card veyra-card--rows">
      {branch.inventory.items.map((item) => <button className="veyra-row" type="button" key={item.merchandiseId} onClick={() => onProduct(item.merchandiseId)}>
        <span>{item.name}</span><span className="veyra-row__trail"><span>{item.quantity > 0 ? item.quantity : 'Out of stock'}</span><VeyraIcon name="chevron" /></span>
      </button>)}
    </div>
  </section>
}

function VeyraBusinessProductDetail({ branch, product, onBack }: { branch: VeyraBusinessBranchView; product: VeyraBusinessProductView; onBack: () => void }) {
  return <section className="veyra-screen" aria-label="Product detail">
    <VeyraBusinessBack parent="Inventory" onBack={onBack} />
    <p className="veyra-eyebrow">{branch.displayName}</p>
    <h1 className="veyra-title">{product.name}</h1>
    <p className="veyra-figure-note">{formatBookstoreGenre(product.genre)}</p>
    <h2 className="veyra-section">Pricing</h2>
    <dl className="veyra-card veyra-card--rows veyra-terms">
      <div className="veyra-row veyra-row--static"><dt>Retail price</dt><dd>{formatDollarCents(product.retailPriceCents)}</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Last acquisition cost</dt><dd>{product.lastAcquisitionCostCents === undefined ? 'Not recorded' : formatDollarCents(product.lastAcquisitionCostCents)}</dd></div>
    </dl>
    <h2 className="veyra-section">Inventory</h2>
    <dl className="veyra-card veyra-card--rows veyra-terms">
      <div className="veyra-row veyra-row--static"><dt>In stock</dt><dd>{product.quantity}</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Incoming</dt><dd>{product.incomingQuantity}</dd></div>
    </dl>
    <h2 className="veyra-section">Market</h2>
    <dl className="veyra-card veyra-card--rows veyra-terms"><div className="veyra-row veyra-row--static"><dt>Popularity</dt><dd>{product.baselinePopularity}</dd></div></dl>
  </section>
}

/**
 * The review before Company money moves: who is selling, what the bundle
 * actually contains, the exact price, how long delivery takes, and what the
 * Company currently has. Opening and leaving it changes nothing canonical —
 * there is no cart, reservation, draft or pending order anywhere.
 *
 * PLACE ORDER calls the existing authorized operated-Device restock path and
 * nothing else: it names only this Branch and this offer, so buyer Company,
 * both Treasuries and the amount all stay where they are owned. One rendered
 * review can commit at most one canonical order.
 */
function VeyraBusinessReview({ company, offer, state, branchId, place, onPlaced, onCancel }: {
  company: VeyraBusinessCompanyView
  offer: VeyraBusinessOfferView
  state: ReturnType<typeof useGameState>
  branchId: string
  place: (decisions: BookstoreOrderDecisions, proposal: BookstoreOrderProposal) => PlaceOperatedBookstoreRestockOrderResult
  onPlaced: () => void
  onCancel: () => void
}) {
  const [refusal, setRefusal] = useState<string>()
  const committed = useRef(false)
  const [selectedBookId, setSelectedBookId] = useState(offer.sourceableBooks[0]?.merchandiseId)
  const [caseCount, setCaseCount] = useState(1)
  const derive = (count: number, bookId = selectedBookId) => proposeBookstoreRestockOrder(state, branchId, offer.id, { caseCount: count, selectedMerchandiseId: bookId })
  const [reviewedProposal, setReviewedProposal] = useState<BookstoreOrderProposal | undefined>(() => { const result = derive(1); return result.status === 'proposed' ? result.proposal : undefined })

  function changeProposal(count: number, bookId = selectedBookId) {
    setCaseCount(count); setSelectedBookId(bookId); setRefusal(undefined)
    const result = derive(count, bookId); setReviewedProposal(result.status === 'proposed' ? result.proposal : undefined)
  }

  function placeOrder() {
    if (committed.current) return
    committed.current = true
    if (!reviewedProposal) { committed.current = false; return setRefusal('Choose an order that fits the available shelf space.') }
    const result = place({ caseCount, selectedMerchandiseId: selectedBookId }, reviewedProposal)
    if (result.status === 'ordered') return onPlaced()
    committed.current = false
    if (result.status === 'proposal_changed') {
      const updated = derive(caseCount)
      setReviewedProposal(updated.status === 'proposed' ? updated.proposal : undefined)
    }
    setRefusal(orderRefusal(result.status))
  }

  return <section className="veyra-screen" aria-label="Review order">
    <p className="veyra-eyebrow">{offer.sellerDisplayName}</p>
    <h1 className="veyra-title">{offer.displayName}</h1>

    <div className="veyra-card veyra-balance">
      <p className="veyra-figure">{reviewedProposal ? formatDollarCents(reviewedProposal.totalPriceCents) : 'Unavailable'}</p>
      <p className="veyra-figure-note">{reviewedProposal?.totalUnits ?? 0} units · {formatDeliveryDuration(offer.deliveryDurationMs)} to deliver</p>
    </div>

    <dl className="veyra-card veyra-card--rows veyra-terms">
      <div className="veyra-row veyra-row--static"><dt>Supplier</dt><dd>{offer.sellerDisplayName}</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Case</dt><dd>{offer.caseSize} units · {formatDollarCents(offer.casePriceCents)}</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Average cost</dt><dd>{formatDollarCents(offer.averageUnitCostCents)} / unit</dd></div>
      <div className="veyra-row veyra-row--static"><dt>Company funds</dt><dd>{company.fundsCents === undefined ? 'Unavailable' : formatDollarCents(company.fundsCents)}</dd></div>
    </dl>

    {offer.kind === 'TITLE_CASE' && <label className="veyra-field"><span>Book</span><select className="veyra-input" value={selectedBookId} onChange={(event) => changeProposal(caseCount, event.target.value)}>{offer.sourceableBooks.map(book => <option key={book.merchandiseId} value={book.merchandiseId}>{book.name}</option>)}</select></label>}
    <label className="veyra-field"><span>Cases (maximum {offer.maxOrderableCases})</span><input className="veyra-input" aria-label="Cases" type="number" inputMode="numeric" min="1" max={offer.maxOrderableCases} value={caseCount} onChange={(event) => changeProposal(Number(event.target.value))} /></label>

    <h2 className="veyra-section">Order contents</h2>
    <dl className="veyra-card veyra-card--rows veyra-terms">
      {reviewedProposal?.lines.map((line) => <div className="veyra-row veyra-row--static" key={line.merchandiseId}>
        <dt>{line.capturedMerchandiseDisplayName}</dt><dd>+{line.quantity}</dd>
      </div>)}
    </dl>

    {refusal && <p className="veyra-refusal" role="alert">{refusal}</p>}
    <button className="veyra-submit" type="button" onClick={placeOrder}>Place order</button>
    <button className="veyra-quiet" type="button" onClick={onCancel}>Cancel</button>
  </section>
}

/**
 * Represented delivery time in whole represented minutes, rounded up so a
 * partly elapsed minute is never presented as already finished. No wall-clock
 * arrival, tracking identity or logistics event is stated, because none is
 * represented.
 */
function formatDeliveryDuration(ms: number): string {
  const minutes = Math.ceil(ms / 60_000)
  return minutes === 1 ? '1 minute' : `${minutes} minutes`
}

/**
 * Ordinary product wording for a refused order. Each refusal says only what
 * the canonical result actually proves — the collapsed `payment_refused` in
 * particular covers every monetary cause, so it never claims insufficient
 * funds specifically.
 */
function orderRefusal(status: Exclude<PlaceOperatedBookstoreRestockOrderResult['status'], 'ordered'>): string {
  switch (status) {
    case 'capacity_exceeded': return 'There is not enough shelf space for this order.'
    case 'invalid_decisions': return 'Choose a valid number of cases and book.'
    case 'proposal_changed': return 'Order details changed. Review the updated order and confirm again.'
    case 'payment_refused': return 'The payment for this order was refused.'
    case 'offer_unavailable':
    case 'invalid_offer':
    case 'seller_unavailable': return 'This offer is no longer available.'
    case 'branch_unavailable':
    case 'commerce_unavailable':
    case 'operations_unavailable': return 'This branch is no longer available.'
    case 'administration_unavailable':
    case 'session_unavailable': return 'This phone can no longer manage this company.'
  }
}

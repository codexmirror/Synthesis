import { useRef, useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { PlaceOperatedBookstoreRestockOrderResult } from '../../core/game/companyAdministration'
import { proposeBookstoreRestockOrder, type BookstoreOrderDecisions, type BookstoreOrderProposal } from '../../core/game/bookstoreRestock'
import { formatDollarCents } from '../dollarFormat'
import { projectVeyraBusiness, type VeyraBusinessBranchView, type VeyraBusinessCompanyView, type VeyraBusinessOfferView, type VeyraBusinessProductView } from './veyraBusiness'
import { VeyraIcon } from './VeyraIcon'

/** Which Business surface is open. Presentation only; it never reaches `GameState`. */
export type VeyraBusinessDetail = { readonly offerId: string } | { readonly inventory: true } | { readonly productId: string }

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
  const { placeBookstoreRestockOrderFromOperatedRemoteDevice } = useGameActions()
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
  />
}

/**
 * The Business root: the Company being managed, the Branch it is managed
 * through, its current money, what is on and coming to its shelves, what can
 * be bought, and what has been ordered. Every value is represented truth; no
 * score, projection, forecast or other invented metric is derived from it.
 */
function VeyraBusinessRoot({ company, branch, notice, onOffer, onInventory }: {
  company: VeyraBusinessCompanyView
  branch?: VeyraBusinessBranchView
  notice?: string
  onOffer: (offerId: string) => void
  onInventory: () => void
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

function VeyraBusinessInventory({ branch, onBack, onProduct }: { branch: VeyraBusinessBranchView; onBack: () => void; onProduct: (id: string) => void }) {
  return <section className="veyra-screen" aria-label="Inventory">
    <button className="veyra-quiet" type="button" onClick={onBack}>Back</button>
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
    <button className="veyra-quiet" type="button" onClick={onBack}>Back</button>
    <p className="veyra-eyebrow">{branch.displayName}</p>
    <h1 className="veyra-title">{product.name}</h1>
    <p className="veyra-figure-note">{formatGenre(product.genre)}</p>
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

function formatGenre(genre: string): string { return genre.toLowerCase().split('_').map(word => word[0].toUpperCase() + word.slice(1)).join(' ') }

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

import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { StartMarketPackageDownloadResult } from '../../core/game/fileTransfer'
import type { PurchaseMarketOfferResult } from '../../core/game/market'
import { formatByteProgress, formatBytes } from '../byteFormat'
import { formatNodeUnitsAsNode } from '../nodeFormat'
import { SoftwareReleaseDisclosure } from '../SoftwareReleaseDocumentation'
import { deriveMarketView, type MarketOfferView, type MarketView } from './marketProjection'

/**
 * The NODE-OS Market client.
 *
 * NODE-OS supplies this client only. The offerings, their prices and the NODE
 * a purchase actually costs belong to the represented Market operator, and
 * each release's publisher — where one is represented at all — is that
 * release's own separate provenance. The application states those three
 * identities separately rather than presenting one NODE-branded catalog.
 *
 * It owns nothing but the selected offering and one transient feedback
 * string: acquisition state, price, balance, entitlement, local possession
 * and transfer progress are all derived from canonical state on every render.
 */
export function Market() {
  const state = useGameState()
  const actions = useGameActions()
  const [selectedOfferId, setSelectedOfferId] = useState<string>()
  const [feedback, setFeedback] = useState<string>()
  const view = deriveMarketView(state)
  const selected = view.offers.find(({ offerId }) => offerId === selectedOfferId)

  function open(offerId: string) { setSelectedOfferId(offerId); setFeedback(undefined) }
  function close() { setSelectedOfferId(undefined); setFeedback(undefined) }

  if (selectedOfferId) {
    return <section className="app-content market-app">
      <button className="node-back" type="button" onClick={close} aria-label="Back to the Market catalog">
        <span aria-hidden="true">←</span> CATALOG
      </button>
      {selected
        ? <OfferDetails
          offer={selected}
          operatorName={view.operatorName}
          feedback={feedback}
          buy={() => {
            const result = actions.purchaseMarketOffer(selected.offerId)
            setFeedback(result.status === 'purchased' ? undefined : describePurchaseFailure(result))
          }}
          download={() => {
            const result = actions.startMarketPackageDownload(selected.offerId)
            setFeedback(result.status === 'started' ? undefined : describeDownloadFailure(result))
          }}
        />
        : <div className="node-empty"><strong>OFFERING NOT FOUND</strong><span>This offering is no longer listed by this Market.</span></div>}
    </section>
  }

  return <section className="app-content market-app">
    <Masthead view={view} />
    <div className="node-section"><span>CATALOG</span><span>{view.offers.length} {view.offers.length === 1 ? 'OFFERING' : 'OFFERINGS'}</span></div>
    {view.offers.length > 0
      ? <div className="node-list">
        {view.offers.map((offer) => <button className="node-row" type="button" key={offer.offerId} onClick={() => open(offer.offerId)}>
          <span className="node-row-glyph" aria-hidden="true">▱</span>
          <span className="node-row-copy">
            <strong>{offer.name}</strong>
            <small>{describeRelease(offer)} · {formatBytes(offer.sizeBytes)} · {describePrice(offer.priceNodeUnits)}</small>
          </span>
          <span className={offer.state === 'ON DEVICE' ? 'node-chip' : 'node-chip node-chip--quiet'}>{offer.state}</span>
          <span className="node-row-arrow" aria-hidden="true">→</span>
        </button>)}
      </div>
      : <div className="node-empty"><strong>NO OFFERINGS</strong><span>This Market currently lists nothing.</span></div>}
    <p className="node-note">
      NODE-OS provides this client. {view.operatorName} lists and sells these offerings and receives what they cost.
      Each release states its own publisher where one is represented.
    </p>
  </section>
}

function Masthead({ view }: { view: MarketView }) {
  return <>
    <header className="node-masthead">
      <span className="node-masthead-subject">{view.operatorName}</span>
      <span className="node-masthead-meta">MARKET · {view.clientDeviceName}</span>
    </header>
    <dl className="node-facts">
      <div><dt>BALANCE</dt><dd>{formatNodeUnitsAsNode(view.balanceNodeUnits)} NODE</dd></div>
    </dl>
  </>
}

/**
 * One offering: what release it is, where it came from, what it costs, and
 * exactly where it currently stands between AVAILABLE and ON DEVICE.
 * Entitlement and local possession are stated as the two separate truths they
 * are, and the release's own documentation stays behind the shared RELEASE
 * INFORMATION disclosure rather than in front of the decision.
 */
function OfferDetails({ offer, operatorName, feedback, buy, download }: {
  offer: MarketOfferView
  operatorName: string
  feedback: string | undefined
  buy: () => void
  download: () => void
}) {
  return <div className="market-detail">
    <header className="node-masthead">
      <h2 className="node-masthead-subject">{offer.name}</h2>
      <span className="node-masthead-meta">{describeRelease(offer)}</span>
    </header>
    <div className="node-section"><span>STATE</span><span>{offer.state}</span></div>
    <dl className="node-facts">
      <div><dt>PUBLISHER</dt><dd>{offer.publisher ?? 'NOT STATED'}</dd></div>
      <div><dt>SELLER</dt><dd>{operatorName}</dd></div>
      <div><dt>PACKAGE</dt><dd>{offer.packageFilename}</dd></div>
      <div><dt>SIZE</dt><dd>{formatBytes(offer.sizeBytes)}</dd></div>
      <div><dt>PRICE</dt><dd>{describePrice(offer.priceNodeUnits)}</dd></div>
      <div><dt>PURCHASE</dt><dd>{offer.purchased ? 'PURCHASED' : 'NOT PURCHASED'}</dd></div>
      <div><dt>LOCAL COPY</dt><dd>{offer.localCopyPath ?? 'NONE'}</dd></div>
    </dl>

    {offer.transfer && <div className="market-transfer">
      <progress className="node-progress" max={100} value={offer.transfer.percent} aria-label={`Download ${offer.transfer.percent}% complete`} />
      <p className="node-note">
        <strong>DOWNLOADING</strong><br />
        {formatByteProgress(offer.transfer.bytesTransferred, offer.transfer.bytesTotal)} · {offer.transfer.percent}%<br />
        Nothing is written to this Device until the transfer completes.
      </p>
    </div>}

    <div className="market-actions">
      {offer.action === 'BUY' && <button className="node-action" type="button" onClick={buy}>BUY · {describePrice(offer.priceNodeUnits)}</button>}
      {offer.action === 'DOWNLOAD' && <button className="node-action" type="button" onClick={download}>DOWNLOAD</button>}
      {offer.action === 'NONE' && offer.destinationOccupied && offer.purchased && <p className="node-note node-note--caution">DESTINATION OCCUPIED · {offer.destinationPath}</p>}
      {offer.localCopyPath && <p className="node-note">The Market ends at acquisition. Install this package from Files.</p>}
      {feedback && <p className="node-note node-note--caution">{feedback}</p>}
    </div>

    <SoftwareReleaseDisclosure releaseId={offer.releaseId} summary facts={<dl className="node-facts">
      <div><dt>RELEASE</dt><dd>{offer.releaseId}</dd></div>
      <div><dt>DESTINATION</dt><dd>{offer.destinationPath}</dd></div>
    </dl>} />
  </div>
}

function describeRelease(offer: MarketOfferView) { return `${offer.version} · ${offer.channel.toUpperCase()}` }

/** Canonical integer atomic NODE units as the price the operator actually charges. */
function describePrice(priceNodeUnits: number) { return `${formatNodeUnitsAsNode(priceNodeUnits)} NODE` }

function describePurchaseFailure(result: Exclude<PurchaseMarketOfferResult, { status: 'purchased' }>) {
  if (result.status === 'insufficient_funds') return 'INSUFFICIENT NODE'
  if (result.status === 'recipient_unavailable') return 'MARKET SELLER UNAVAILABLE'
  return result.status.toUpperCase().replaceAll('_', ' ')
}

function describeDownloadFailure(result: Exclude<StartMarketPackageDownloadResult, { status: 'started' }>) {
  if (result.status === 'destination_exists') return 'DESTINATION ALREADY EXISTS'
  return result.status.toUpperCase().replaceAll('_', ' ')
}

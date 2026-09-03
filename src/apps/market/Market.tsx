import { useState } from 'react'
import { useGameActions, useGameState } from '../../app/GameContext'
import type { StartMarketPackageDownloadResult } from '../../core/game/fileTransfer'
import type { PurchaseMarketOfferResult } from '../../core/game/market'
import { formatByteProgress, formatBytes } from '../byteFormat'
import { formatNodeUnitsAsNode } from '../nodeFormat'
import { SoftwareReleaseDisclosure } from '../SoftwareReleaseDocumentation'
import './market.css'
import { deriveMarketView, type MarketCatalogEntry, type MarketReleaseView, type MarketSourceView, type MarketView } from './marketProjection'

/**
 * The NODE-OS Market client.
 *
 * NODE-OS supplies this client only. The offerings, their prices and the NODE
 * a purchase actually costs belong to the represented Market operator, and
 * each release's publisher — where one is represented at all — is that
 * release's own separate provenance. The application states those three
 * identities separately rather than presenting one NODE-branded catalog.
 *
 * V2 is product-first. The catalog lists the software products this Market
 * distributes, and one product surface then presents the concrete releases it
 * actually offers of that product, so a second release of one product is a
 * release of it rather than an unrelated row. Only represented `MarketOffer`s
 * ever become selectable releases: an authored release, a package on the
 * Device or installed software is never promoted into an offering.
 *
 * It owns nothing but presentation state — the selected destination, product,
 * release and one transient feedback string. Acquisition state, price,
 * balance, entitlement, local possession and transfer progress are all derived
 * from canonical state on every render.
 */
export function Market() {
  const state = useGameState()
  const actions = useGameActions()
  const [sourceId, setSourceId] = useState<string>()
  const [entryKey, setEntryKey] = useState<string>()
  const [selectedOfferId, setSelectedOfferId] = useState<string>()
  const [feedback, setFeedback] = useState<string>()

  const view = deriveMarketView(state)
  const source = view.sources.find((candidate) => candidate.id === sourceId) ?? view.sources[0]
  const entry = view.entries.find((candidate) => candidate.key === entryKey)

  function openEntry(next: MarketCatalogEntry) {
    setEntryKey(next.key)
    // The release the operator lists first. No version ordering is invented here.
    setSelectedOfferId(next.releases[0]?.offerId)
    setFeedback(undefined)
  }

  function closeEntry() { setEntryKey(undefined); setSelectedOfferId(undefined); setFeedback(undefined) }

  function selectSource(id: string) { setSourceId(id); closeEntry() }

  if (entryKey) {
    return <section className="app-content market-app">
      <button className="node-back" type="button" onClick={closeEntry} aria-label="Back to the Market catalog">
        <span aria-hidden="true">←</span> CATALOG
      </button>
      {entry
        ? <EntrySurface
          entry={entry}
          view={view}
          selected={entry.releases.find((release) => release.offerId === selectedOfferId) ?? entry.releases[0]}
          feedback={feedback}
          selectRelease={(offerId) => { setSelectedOfferId(offerId); setFeedback(undefined) }}
          openEntry={openEntry}
          buy={(offerId) => {
            const result = actions.purchaseMarketOffer(offerId)
            setFeedback(result.status === 'purchased' ? undefined : describePurchaseFailure(result))
          }}
          download={(offerId) => {
            const result = actions.startMarketPackageDownload(offerId)
            setFeedback(result.status === 'started' ? undefined : describeDownloadFailure(result))
          }}
        />
        : <div className="node-empty"><strong>NOT LISTED</strong><span>This Market no longer lists that software.</span></div>}
    </section>
  }

  return <section className="app-content market-app">
    <header className="node-masthead">
      <span className="node-masthead-subject">{source.operatorName ?? 'No represented operator'}</span>
      <span className="node-masthead-meta">MARKET · {view.clientDeviceName}</span>
    </header>
    <SourceStrip sources={view.sources} activeId={source.id} select={selectSource} />
    {source.kind === 'represented'
      ? <Catalog view={view} open={openEntry} />
      : <UnrepresentedDestination view={view} open={() => selectSource(view.sources[0].id)} />}
  </section>
}

/**
 * The top-level destinations this client can present.
 *
 * There is exactly one represented Market, and the second destination states
 * that no publisher-operated distribution exists rather than implying the open
 * exchange is all software distribution can be. Nothing transactional is bound
 * to a destination with no represented operator.
 */
function SourceStrip({ sources, activeId, select }: { sources: readonly MarketSourceView[]; activeId: string; select: (id: string) => void }) {
  return <>
    <div className="node-section"><span>DISTRIBUTION</span><span>{sources.filter(({ kind }) => kind === 'represented').length} REPRESENTED</span></div>
    <div className="mk-sources" role="group" aria-label="Distribution destinations">
      {sources.map((candidate) => <button
        key={candidate.id}
        type="button"
        className={candidate.kind === 'represented' ? 'mk-source' : 'mk-source mk-source--unrepresented'}
        aria-pressed={candidate.id === activeId}
        onClick={() => select(candidate.id)}
      >
        <span className="mk-source-title">{candidate.title}</span>
        <span className="mk-source-meta">{candidate.kind === 'represented' ? `${candidate.offeringCount} ${candidate.offeringCount === 1 ? 'OFFERING' : 'OFFERINGS'}` : 'NONE REPRESENTED'}</span>
      </button>)}
    </div>
  </>
}

/** The represented Market's own catalog: its products, then its module offerings. */
function Catalog({ view, open }: { view: MarketView; open: (entry: MarketCatalogEntry) => void }) {
  const products = view.entries.filter(({ kind }) => kind === 'product')
  const modules = view.entries.filter(({ kind }) => kind === 'module')
  return <div className="mk-catalog">
    <dl className="mk-balance">
      <dt>NODE BALANCE</dt>
      <dd>{formatNodeUnitsAsNode(view.balanceNodeUnits)} NODE</dd>
    </dl>
    {view.entries.length > 0
      ? <>
        {products.length > 0 && <>
          <div className="node-section"><span>SOFTWARE</span><span>{products.length} {products.length === 1 ? 'PRODUCT' : 'PRODUCTS'}</span></div>
          <div className="mk-list">{products.map((entry) => <CatalogEntry key={entry.key} entry={entry} open={open} />)}</div>
        </>}
        {modules.length > 0 && <>
          <div className="node-section"><span>MODULES</span><span>{modules.length} {modules.length === 1 ? 'OFFERING' : 'OFFERINGS'}</span></div>
          <div className="mk-list">{modules.map((entry) => <CatalogEntry key={entry.key} entry={entry} open={open} />)}</div>
        </>}
      </>
      : <div className="node-empty"><strong>NO OFFERINGS</strong><span>This Market currently lists nothing.</span></div>}
    <p className="node-note">
      NODE-OS provides this client. {view.operatorName} lists and sells these offerings and receives what they cost.
      Each release states its own publisher where one is represented.
    </p>
  </div>
}

/**
 * One product, or one module offering. The product's own identity leads; the
 * releases behind it are summarized rather than listed as separate objects, so
 * a product with two releases reads as one product.
 */
function CatalogEntry({ entry, open }: { entry: MarketCatalogEntry; open: (entry: MarketCatalogEntry) => void }) {
  const { summary } = entry
  return <button className="mk-entry" type="button" onClick={() => open(entry)}>
    <strong className="mk-entry-name">{entry.name}</strong>
    <span className="mk-entry-state">
      {/* A chip is spent on state the player has actually reached. Nothing acquired
          is the resting state of a catalog, and a column of identical AVAILABLE
          boxes is what made the previous list read as repeated objects. */}
      {summary.state === 'AVAILABLE'
        ? <span className="mk-entry-available">AVAILABLE</span>
        : <span className="node-chip">{describeSummary(entry)}</span>}
    </span>
    <small className="mk-entry-meta">{describeEntryMeta(entry)}</small>
    <span className="mk-entry-price">{describePriceRange(entry)}</span>
    <span className="mk-entry-arrow" aria-hidden="true">→</span>
  </button>
}

/**
 * One product's whole Market surface: which releases of it this Market
 * actually offers, the exact state of the selected one, and the single action
 * available on that exact offering.
 *
 * Nothing is merged across releases. Channel, publisher, size, price,
 * entitlement, possession and action all belong to the selected offering
 * alone, and an absent channel or publisher stays absent rather than
 * inheriting a sibling release's value.
 */
function EntrySurface({ entry, view, selected, feedback, selectRelease, openEntry, buy, download }: {
  entry: MarketCatalogEntry
  view: MarketView
  selected: MarketReleaseView | undefined
  feedback: string | undefined
  selectRelease: (offerId: string) => void
  openEntry: (entry: MarketCatalogEntry) => void
  buy: (offerId: string) => void
  download: (offerId: string) => void
}) {
  const modules = view.entries.filter((candidate) => entry.moduleKeys.includes(candidate.key))
  return <div className="mk-product">
    <div className="mk-subject">
      <h2 className="mk-subject-name">{entry.name}</h2>
      <p className="mk-subject-meta">{entry.kind === 'module'
        ? `MODULE FOR ${(entry.hostName ?? entry.hostProductId ?? '').toUpperCase()}`
        : 'SOFTWARE PRODUCT'} · {entry.releases.length} {entry.releases.length === 1 ? 'RELEASE' : 'RELEASES'} OFFERED</p>
    </div>

    {entry.releases.length > 1 && <>
      <div className="node-section"><span>RELEASE</span></div>
      <div className="mk-releases" role="group" aria-label={`Releases of ${entry.name} offered by this Market`}>
        {entry.releases.map((release) => <ReleaseOption
          key={release.offerId}
          release={release}
          selected={release.offerId === selected?.offerId}
          select={() => selectRelease(release.offerId)}
        />)}
      </div>
    </>}

    {selected
      ? <ReleaseDetail key={selected.offerId} release={selected} entry={entry} view={view} feedback={feedback} buy={buy} download={download} />
      : <div className="node-empty"><strong>NO RELEASE OFFERED</strong><span>This Market lists no release of this software.</span></div>}

    {entry.local && <>
      <div className="node-section"><span>ON THIS DEVICE</span></div>
      <dl className="node-facts">
        {entry.local.installed && <div><dt>INSTALLED</dt><dd>{describeVersion(entry.local.installed)}</dd></div>}
        {entry.local.packages.map((local) => <div key={local.path}><dt>LOCAL PACKAGE</dt><dd>{describeVersion(local)} · {local.path}</dd></div>)}
      </dl>
      <p className="node-note">
        What {view.clientDeviceName} already holds of this software is not an offering.
        This Market distributes only the {entry.releases.length === 1 ? 'release' : 'releases'} above.
      </p>
    </>}

    {modules.length > 0 && <>
      <div className="node-section"><span>MODULES</span><span>{modules.length} {modules.length === 1 ? 'OFFERING' : 'OFFERINGS'}</span></div>
      <div className="mk-list">{modules.map((module) => <CatalogEntry key={module.key} entry={module} open={openEntry} />)}</div>
      <p className="node-note">A module extends {entry.name}. It is not a release of it, is acquired separately, and never installs as one.</p>
    </>}
  </div>
}

/**
 * One version of a product, as an option in the release selector.
 *
 * State outranks channel on the second line: which releases the player already
 * holds is what a selector with several versions is for, and the channel is
 * restated in full beside the selected release. A release representing no
 * channel carries no second line rather than an empty one.
 */
function ReleaseOption({ release, selected, select }: { release: MarketReleaseView; selected: boolean; select: () => void }) {
  const note = release.state === 'AVAILABLE' ? release.channel?.toUpperCase() : release.state
  return <button type="button" className="mk-release-option" aria-pressed={selected} onClick={select}>
    <strong>{release.version}</strong>
    {note && <small>{note}</small>}
  </button>
}

/**
 * The selected offering: what state it is in, what it costs against the
 * canonical balance, the one action available on it, and its represented facts
 * — with release documentation left behind the shared disclosure rather than
 * in front of the decision.
 */
function ReleaseDetail({ release, entry, view, feedback, buy, download }: {
  release: MarketReleaseView
  entry: MarketCatalogEntry
  view: MarketView
  feedback: string | undefined
  buy: (offerId: string) => void
  download: (offerId: string) => void
}) {
  return <div className="mk-release">
    <div className="mk-release-head">
      <span className="mk-release-version">{release.version}</span>
      {/* Omitted entirely for a release that represents no channel. */}
      {release.channel && <span className="mk-release-channel">{release.channel.toUpperCase()}</span>}
      <span className={release.state === 'AVAILABLE' ? 'node-chip node-chip--quiet mk-release-state' : 'node-chip mk-release-state'}>{release.state}</span>
    </div>

    <div className="mk-acquire">
      <dl className="mk-terms">
        <div><dt>PRICE</dt><dd>{describePrice(release.priceNodeUnits)}</dd></div>
        <div><dt>BALANCE</dt><dd>{formatNodeUnitsAsNode(view.balanceNodeUnits)} NODE</dd></div>
      </dl>
      {release.action === 'BUY' && <button className="mk-act mk-act--buy" type="button" onClick={() => buy(release.offerId)}>BUY · {describePrice(release.priceNodeUnits)}</button>}
      {release.action === 'DOWNLOAD' && <button className="mk-act mk-act--download" type="button" onClick={() => download(release.offerId)}>DOWNLOAD</button>}
      {release.transfer && <div className="mk-transfer">
        <progress className="node-progress" max={100} value={release.transfer.percent} aria-label={`Download ${release.transfer.percent}% complete`} />
        <p className="node-note">
          <strong>DOWNLOADING</strong><br />
          {formatByteProgress(release.transfer.bytesTransferred, release.transfer.bytesTotal)} · {release.transfer.percent}%<br />
          Nothing is written to this Device until the transfer completes.
        </p>
      </div>}
      {release.action === 'NONE' && release.destinationOccupied && release.purchased && <p className="node-note node-note--caution">DESTINATION OCCUPIED · {release.destinationPath}</p>}
      {release.localCopyPath && <p className="node-note">{release.artifact === 'software_module'
        ? 'The Market ends at acquisition. Open Flipper to integrate this module.'
        : 'The Market ends at acquisition. Install this package from Files.'}</p>}
      {feedback && <p className="node-note node-note--caution">{feedback}</p>}
    </div>

    <div className="node-section"><span>OFFERING</span></div>
    <dl className="node-facts">
      <div><dt>PUBLISHER</dt><dd>{release.publisher ?? 'NOT STATED'}</dd></div>
      <div><dt>SELLER</dt><dd>{view.operatorName}</dd></div>
      <div><dt>{release.artifact === 'software_module' ? 'MODULE' : 'PACKAGE'}</dt><dd>{release.filename}</dd></div>
      <div><dt>SIZE</dt><dd>{formatBytes(release.sizeBytes)}</dd></div>
      <div><dt>PURCHASE</dt><dd>{release.purchased ? 'PURCHASED' : 'NOT PURCHASED'}</dd></div>
      <div><dt>LOCAL COPY</dt><dd>{release.localCopyPath ?? 'NONE'}</dd></div>
    </dl>

    {entry.kind === 'module' && <p className="node-note">
      A module offering is not an installable release. Acquiring it places one module artifact on {view.clientDeviceName}; it never becomes installed software.
    </p>}

    <SoftwareReleaseDisclosure releaseId={release.releaseId} summary facts={<dl className="node-facts">
      <div><dt>RELEASE</dt><dd>{release.releaseId}</dd></div>
      <div><dt>DESTINATION</dt><dd>{release.destinationPath}</dd></div>
    </dl>} />
  </div>
}

/**
 * The destination this client names and does not have. It states an absence;
 * it is not a second Market, and nothing here can be bought, downloaded or
 * settled.
 */
function UnrepresentedDestination({ view, open }: { view: MarketView; open: () => void }) {
  return <div className="mk-void">
    <p className="mk-void-title">NO PUBLISHER-OPERATED DISTRIBUTION IS REPRESENTED</p>
    <p className="mk-void-copy">
      NODE-OS supplies this Market client and operates no store of its own. Where a release states a publisher,
      that is the release's own provenance — not a source {view.clientDeviceName} can buy from.
    </p>
    <p className="mk-void-copy">
      Everything this Device can currently acquire is listed and sold by {view.operatorName}, an independent
      operator that applies no curation, certification or support of its own.
    </p>
    <button className="node-action" type="button" onClick={open}>VIEW OPEN EXCHANGE</button>
  </div>
}

/** The product's state, honest about how many of its releases it actually covers. */
function describeSummary({ summary }: MarketCatalogEntry) {
  return summary.total > 1 && summary.count < summary.total ? `${summary.state} ${summary.count}/${summary.total}` : summary.state
}

/**
 * The catalog line under a product name. One release states itself in full; a
 * product with several states how many, then the versions themselves.
 */
function describeEntryMeta(entry: MarketCatalogEntry) {
  const host = entry.kind === 'module' ? [`MODULE FOR ${(entry.hostName ?? entry.hostProductId ?? '').toUpperCase()}`] : []
  if (entry.releases.length === 1) {
    const [release] = entry.releases
    return [...host, ...(release.channel ? [`${release.version} · ${release.channel.toUpperCase()}`] : [release.version]), formatBytes(release.sizeBytes)].join(' · ')
  }
  const shown = entry.releases.slice(0, 3).map(({ version }) => version)
  const remaining = entry.releases.length - shown.length
  return [...host, `${entry.releases.length} RELEASES`, shown.join(', ') + (remaining > 0 ? ` +${remaining}` : '')].join(' · ')
}

/** Every release keeps its own price, so a product states the range it actually spans. */
function describePriceRange(entry: MarketCatalogEntry) {
  return entry.lowestPriceNodeUnits === entry.highestPriceNodeUnits
    ? describePrice(entry.lowestPriceNodeUnits)
    : `${formatNodeUnitsAsNode(entry.lowestPriceNodeUnits)}–${describePrice(entry.highestPriceNodeUnits)}`
}

function describeVersion({ version, channel }: { version: string; channel?: string }) {
  return channel ? `${version} · ${channel.toUpperCase()}` : version
}

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

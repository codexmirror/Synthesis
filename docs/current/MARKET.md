# Software Market — current truth

Status: Accepted
Scope: The one represented software Market, its operator/seller identity, its
offerings and prices, canonical purchase entitlement, Market package
distribution and its FileTransfer route, and the NODE-OS Market application, as
currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/ECONOMY_AND_WALLETS.md` (A18) and
`docs/architecture/DEVICES_AND_ACCESS.md` (A17). The canonical FileTransfer
runtime this slice extends is owned by `docs/current/FILES_SOFTWARE.md`; what a
purchase costs and where the NODE goes is bounded by
`docs/current/NODE_ECONOMY.md`; authoring rules for the releases it distributes
belong to `docs/design/SOFTWARE_AUTHORING.md`.


## Three separate identities

Market V1 keeps three identities distinct, and no current truth merges any two
of them:

```text
NODE / NODE-OS          supplies the Market client application
MARKET OPERATOR         lists and sells the offerings, and receives the NODE
SOFTWARE PUBLISHER      provenance of the release itself, where represented
```

The presence of a Market application in NODE-OS therefore states nothing about
who published, sold, endorsed, curated, signed or supports any offering. NODE
is not represented as the operator, the seller, the publisher, or the recipient
of Market revenue.

The one represented operator is `market-operator-opx-v0`, "Open Package
Exchange". It is a broad/open software market: it applies no represented
curation, trust, signing, certification, compatibility or support state, and
none of those concepts exist in this slice. It is explicitly **not** an
official NODE distribution channel, and nothing in this slice models one, a
source/channel selection, or a grey/black market.


## Represented Market state

`GameState.market` holds exactly four things:

- the `MarketOperator` — stable identity, display name, and the NODE
  `settlementAddress` it is paid at (an addressing attribute, never identity);
- `distributionCapacity` — the Market distribution endpoint's own represented
  `NetworkTransferCapacity`;
- `offers` — the represented offerings;
- `purchases` — the canonical purchase entitlements the player holds.

Each `MarketOffer` carries stable offer identity, `priceNodeUnits` in canonical
integer atomic NODE units, and the `MarketDistribution` it distributes. That
distribution identifies one exact concrete build with `buildId`; offer identity
remains purchase-entitlement identity and is not build identity.

A distribution states which concrete artifact kind it sends. A
`MarketPackageDistribution` (`artifact: 'software_package'`) sends an ordinary
installable package and carries the product identity, channel and publisher
that release represents. A `MarketModuleDistribution`
(`artifact: 'software_module'`) sends one concrete Flipper module artifact and
carries the host product it belongs to plus its stable module identity — and
deliberately no `productId`, `channel` or `publisher`, because a module is not
a software product of its own. Buying a module offering therefore cannot
produce InstalledSoftware; what it can produce is one module artifact the
player then integrates into Flipper (`docs/current/FILES_SOFTWARE.md`).

A distribution is represented offer and source truth: the release/build facts and
byte size the operator states it will send, plus the `filename` the V1
destination path is derived from. It is deliberately **not** an artifact. A
filesystem artifact is a file on a Device-owned filesystem
(`docs/design/SOFTWARE_AUTHORING.md`), and no artifact, file ID or path exists
for an offering until its download actually completes:

```text
MARKET OFFER / DISTRIBUTION TRUTH
  -> purchase entitlement
  -> authorized elapsed FileTransfer
  -> completion
  -> one ordinary artifact of the offering's own kind on the local Device
     filesystem (software_package, or software_module)
```

The V1 catalog lists seven offerings, each represented once at exactly
`0.01 NODE` — `10,000` canonical atomic units, authored as an integer like
every other NODE amount: NodeScan 1.1 Experimental, NODE Miner 1.0 Unofficial,
GateSSH 1.3.2 Stable, GateSSH 1.3.3, Flipper 1.0, RATTLER 1.0, and the Flipper Rollback Module 1.0 — the
one module offering. That
price is a current tuning of what this operator charges, not a rule of the
economy; every operation reads the offering's own `priceNodeUnits` rather than
a constant.

RATTLER is one independently authored unofficial software-package offering,
published by `NULL//WORKS`; it is not represented as a cracked derivative.
Its exact distribution is `rattler-1.0.pkg`, product
`product-rattler-v0`, release `release-rattler-1.0-v0`, and build
`build-rattler-1.0-v0`. Purchase and download use the same entitlement,
economy, destination-placement, and elapsed FileTransfer mechanics as every
other package offer.

`channel` is release presentation metadata and is genuinely optional on a
distribution, on the `software_package` a completed download creates, and on
every step of the ordinary installation path between them (the installation
Process, and the resulting InstalledSoftware). A release that represents no
channel keeps that absence as a missing field the whole way through
Market distribution → completed package → Files → INSTALL → InstalledSoftware,
never an empty string or an inherited value.

Provenance and channel are stated exactly as each release represents them and
are deliberately mixed. NODE Miner states the `nm-dev` publisher and GateSSH
1.3.2 states `stable`/`rack-systems`, because those are what their own
represented package artifacts claim. NodeScan 1.1 states no publisher.
GateSSH 1.3.3 states neither a channel nor a publisher: no accepted current
truth represents either for it (not even the Service implementation it patches
— only the *distinct* 1.3.2 package artifact states `stable`/`rack-systems`).
The Rollback Module carries neither field at all, because a module distribution
does not represent them. None of it is inferred from a sibling release or
invented to fill a field; the application presents each absence as `NOT STATED`
(publisher) or by omitting the channel segment entirely.

GateSSH 1.3.3 had no distributable package artifact anywhere in the world, and
the Rollback Module has no other represented source; this Market is the first
concrete distribution of either, and their distribution facts are authored in
`market.ts` alongside the other offerings. It is currently the only represented
acquisition path for the Rollback Module. Distributing a module changes nothing
about who operates this Market: Open Package Exchange remains the seller and
operator of its own broad/open market, and Flipper being a NODE-published
product makes neither NODE the operator nor this Market an official NODE
store. NodeScan 1.1's, NODE Miner 1.0's and GateSSH 1.3.2's distributions
deliberately repeat the represented artifacts that already exist on srv-01 and
node-01 rather than deriving one from the other — each concrete artifact stays
self-contained — and a focused test pins them to each other so the two
authoring sites cannot silently diverge.

Filesystem possession of an offering is exact to its distributed `productId`,
`releaseId`, and `buildId`. A package from another build of the same release is
not possession of the offered build; copying the offered package preserves that
build identity while allocating a new filesystem copy identity.

Market offerings deliberately carry no ABOUT/CAPABILITY/CHANGE copy of their
own: the application projects the same authored release documentation every
other software surface reads, and simply omits it for a release that has none.
No documentation is authored for the GateSSH releases, because the represented
difference between 1.3.2 and 1.3.3 is a target weakness that Service Analysis
and Knowledge own (see `docs/current/NETWORK_ACCESS.md`); a store listing must
not hand the player observation results. The Rollback Module likewise carries
no release documentation of its own: what integrating it changes is Flipper's
concrete build, which the Flipper application states from installed truth.


## Purchase

`purchaseMarketOffer` is the one canonical purchase operation. It is a real
economic mutation, applied atomically:

- the local NODE Wallet is debited exactly the offering's own represented
  `priceNodeUnits`;
- the represented Market operator's own NODE account
  (`node-account-opx-v0`, see `docs/current/NODE_ECONOMY.md`) is credited
  exactly that amount;
- exactly one `MarketPurchase` entitlement is appended, identified by stable
  offer identity rather than filename, path, display name or version;
- exactly one local NODE Wallet `market_purchase` activity record is appended,
  carrying the actual debit and stable purchase/offer/release identities plus
  the release name/version snapshot needed for truthful historical display.

Every rejection leaves all four untouched and returns the state unchanged:
an unknown offering (`unknown_offer`), an entitlement already held
(`already_purchased`, which never charges again), insufficient NODE
(`insufficient_funds`), or no unique represented recipient holding the
operator's settlement address (`recipient_unavailable`). A represented price
that is not a positive safe integer throws rather than settling fractional
NODE.

Purchase creates no filesystem artifact, no InstalledSoftware, no Process and
no FileTransfer. The `MarketPurchase` remains the entitlement owner; Wallet
activity is economic history and grants no ownership or download authority.

Entitlement and physical possession are separate truths in both directions.
The initially seeded NODE Miner 1.0 package on node-01 gives the player a copy
of that release and no entitlement whatsoever; the Market presents it as
`ON DEVICE` and `NOT PURCHASED`, and still offers BUY. Conversely, deleting or
losing a downloaded copy never removes the entitlement, which keeps admitting
the download again.


## Market distribution download

A Market download is a real canonical `FileTransfer`, not a second transfer
runtime, a GameProcess, or an immediate copy. `FileTransfer` gained exactly one
new `origin`:

```text
origin: 'device_access'        accessId + sourceDeviceId + sourceFileId
origin: 'market_distribution'  offerId
```

`startMarketPackageDownload` admits the second kind. Its authority is the
purchase entitlement alone: it resolves no DeviceAccess, requires and creates
no RemoteSession, and never claims the player reached a represented Device.
Everything else is the existing admission: one active transfer at a time
(`transfer_in_progress`, shared with remote Download and Upload in both
directions), the existing `/home/user/downloads/<package-basename>`
destination convention, the existing no-overwrite placement check, and no
destination artifact, allocated destination file ID or Process at admission.
It is refused for an unknown offering, without an entitlement
(`not_purchased`), while the local Device is offline, and when either
represented capacity is unusable.

Advancement runs at the same canonical `advanceGameState` boundary as every
other transfer. On each step it re-resolves the represented truth it depends
on — the offering still exists, the entitlement still exists, the local Device
is still online, and both the Market `distributionCapacity` and the local
Device's own capacity are still valid — and losing any of them aborts the
transfer with no artifact and no partial file. The rate is
`deriveEffectiveTransferRateBytesPerSecond` over the Market distribution
capacity and the local Device's capacity, derived fresh rather than stored. No
LocalNetwork capacity participates: the Market distribution endpoint is not a
represented Device and holds no represented LocalNetwork membership.

For the same reason it appends **no** Network-owned activity evidence.
Network transfer evidence records activity between represented Devices, and
canonical World Truth must not claim a Device-to-Device transfer that never
happened.

Completion is ordinary: exactly one `software_package` artifact is created on
the local Device at the moment the transferred bytes reach the total — the
first moment such an artifact exists at all — carrying the offering's
represented release identity, name, version and size unchanged, plus channel
and publisher exactly where the offering actually represents them and omitted
otherwise, and taking its file ID and path from the destination filesystem
like any other created artifact. Downloading installs nothing. From that point the existing
Files / INSTALL lifecycle takes over with no Market-specific installation
logic. Cancellation uses the existing `cancelFileTransfer` semantics, creates
no partial artifact, allocates no file ID, and leaves the entitlement intact.

Recent Activity archives a finished Market transfer like any other, stating the
route as `<operator name> → <local device>` and carrying no source path,
because a Market distribution has neither a source Device nor a source
filesystem artifact. The Activity Monitor presents it as the same real
`DOWNLOAD` runtime it presents a remote Download as, with the same progress,
rate, network usage and `CANCEL` control, and states `SOURCE` as the
represented operator.


## The Market application

`Market` is an ordinary NODE-OS application, registered between Files and
Wallet. It composes the shared NODE-OS presentation language rather than a
second UI system, and it owns no gameplay truth: the selected offering and one
transient feedback string are its only local state. Balance, price,
entitlement, local possession, transfer progress and installation state are all
derived from their canonical owners on every render, so none of them can
diverge.

The catalog states the operator it is presenting and the client Device, the
canonical NODE balance, and one row per offering: product name, then
`version · CHANNEL · size · price` — with the `· CHANNEL` segment omitted
entirely for a release that represents none, rather than shown empty or
inherited — then the derived acquisition state, then the arrow that opens the
offering. One quiet note states that NODE-OS provides the client while the
operator lists, sells and is paid, and that each release states its own
publisher where one is represented.

An offering states its acquisition state — `AVAILABLE`, `PURCHASED`,
`DOWNLOADING` or `ON DEVICE` — then publisher, seller, package filename, size,
price, purchase state and local copy as separate facts, then the one primary
action available, then release documentation behind the existing
RELEASE INFORMATION disclosure. `DOWNLOADING` derives its progress from the
canonical transfer and states that nothing is written until it completes.

The acquisition state is derived, in this order: a Market transfer active for
this offering is `DOWNLOADING`; a local copy of the release is `ON DEVICE`; an
entitlement is `PURCHASED`; otherwise `AVAILABLE`. The primary action is BUY
while unpurchased (possession never suppresses it), DOWNLOAD once entitled with
no local copy and a free destination, and nothing while downloading, while a
copy is present, or while an unrelated artifact occupies the destination —
which is stated rather than hidden. A canonical admission failure is reported
as-is; the operation remains the only authority.

The Market ends at acquisition. It offers no INSTALL, no execution and no
remote-Device installation, and says so where a local copy exists:

```text
Market -> BUY -> DOWNLOAD -> package in Files -> Files INSTALL -> InstalledSoftware
```


## Gotchas

- A Market client in NODE-OS is not NODE selling software. Client identity,
  operator/seller identity and publisher provenance are three separate truths,
  and only represented truth may ever merge them.
- Entitlement is not possession, in either direction. A seeded or copied
  package never creates an entitlement, and losing a copy never destroys one.
- Entitlement identity is offer identity. Never a filename, path, display
  name, or version string.
- A Market download is not a hacked download. It fabricates no DeviceAccess,
  no RemoteSession and no compromised Device, and it must never be made to
  reuse remote-host semantics for convenience.
- The Market distribution endpoint is not a Device. It has no filesystem, no
  IP, no LocalNetwork membership, is not scannable or reachable, and appends
  no Network-owned evidence.
- Nothing is written to the local filesystem until a Market transfer
  completes, and a cancelled or interrupted one writes nothing at all.
- Buying is not downloading, downloading is not installing, and installing is
  not running. Four separate moments, exactly as elsewhere.
- The catalog is a projection of represented offerings, not a filesystem
  listing: it lists releases, never local copies, and never text files or
  executables.
- A distribution is not a package. Nothing represents a `software_package`
  outside a Device-owned filesystem, and no code may construct one for an
  offering before its transfer completes.
- The price is the offering's own represented `priceNodeUnits`. Do not
  hardcode commerce to the current V1 value, and never express canonical NODE
  as a fractional number.
- Channel is optional release presentation metadata, not a required field a
  package or offering must always carry. A release with no represented channel
  (GateSSH 1.3.3) must keep that absence through distribution, completed
  package, installation and InstalledSoftware — never an invented value, an
  empty string, or a value inherited from a sibling release of the same
  product.
- A module offering is not a package offering. It distributes a module artifact
  under module identity, carries no `productId`, and can never produce
  InstalledSoftware; installing it is not an available operation at all. Do not
  give a module distribution a fabricated product, channel or publisher to
  reuse package code.

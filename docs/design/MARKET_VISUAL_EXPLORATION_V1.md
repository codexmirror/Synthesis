# NODE-OS Market — Visual Exploration V1

Status: Draft — Exploration. **NOT Accepted.** No direction is selected and
nothing here is implementation authority.
Scope: Bounded visual and product-surface exploration of the already-implemented
NODE-OS Market application: information hierarchy, catalog/detail relationship,
acquisition-state presentation, operator-context placement, provenance
handling, density and mobile composition. Presentation only.
Normative owner of current implemented Market truth:
[`../current/MARKET.md`](../current/MARKET.md).

This document changes no Market mechanic, no represented offering, no price, no
entitlement rule and no transfer semantics. It creates no canonical state and
selects no winning composition. Production `src/` is untouched by this pass.

Prototypes: [`prototypes/market-visual-exploration-v1/`](prototypes/market-visual-exploration-v1/)
Rendered reference images: [`../assets/market-visual-exploration-v1/`](../assets/market-visual-exploration-v1/)


## 1. What this document is and is not

It is exploration material for one human visual review. Its purpose is to make
three materially different Market product shapes comparable side by side so a
direction — or a combination of qualities from several — can be chosen before
any formal design contract or implementation task is written.

It is **not** a product-structure authority, not current truth, and not a
substitute for the accepted owners it sits under:

- current implemented Market truth → [`../current/MARKET.md`](../current/MARKET.md)
- the shared NODE-OS presentation language →
  [`../current/INTERFACE_SHELL.md`](../current/INTERFACE_SHELL.md) and
  [`NODE_OS_HOME_V1.md`](NODE_OS_HOME_V1.md)
- the accepted mature-surface execution rules this pass draws on →
  [`NODE_OS_WALLET_PRODUCT_POLISH_V1.md`](NODE_OS_WALLET_PRODUCT_POLISH_V1.md)
  section 11
- the economic separation behind a purchase →
  [`../architecture/ECONOMY_AND_WALLETS.md`](../architecture/ECONOMY_AND_WALLETS.md) (A18)
- filesystem ownership of a downloaded package →
  [`../architecture/DEVICES_AND_ACCESS.md`](../architecture/DEVICES_AND_ACCESS.md) (A17)

Where anything here appears to disagree with an accepted owner, the accepted
owner wins and this document is wrong.


## 2. Repository truth this pass started from

Inspected current `main` at `9ac7c61`.

### Content used, and used verbatim

Every release identity, version, channel, publisher, package filename, byte
size, price, destination path and documentation string in the prototypes is
current repository truth, taken from `src/core/game/market.ts`,
`src/core/game/softwareReleaseContent.ts`, `src/core/game/initialState.ts` and
`src/apps/market/marketProjection.ts`:

```text
NodeScan 1.1               experimental   no publisher   18.4 MB   0.01 NODE
NODE Miner 1.0             unofficial     nm-dev          3.4 MB   0.01 NODE
GateSSH 1.3.2              stable         rack-systems    6.4 MB   0.01 NODE
GateSSH 1.3.3              no channel     no publisher    6.6 MB   0.01 NODE
Rollback Exploit Toolkit 1.0  no channel  no publisher    2.1 MB   0.01 NODE
```

Release documentation is shown only where a release actually authors it.
NodeScan 1.1, NODE Miner 1.0 and the Rollback Exploit Toolkit carry ABOUT,
CAPABILITIES and CHANGES; neither GateSSH release carries any, and the
prototypes state that absence rather than filling it. Nothing about the
represented difference between GateSSH 1.3.2 and 1.3.3 appears anywhere: that
difference is a target weakness owned by Service Analysis and Knowledge
([`../current/NETWORK_ACCESS.md`](../current/NETWORK_ACCESS.md)), and a store
listing must not hand the player observation results.

### Mock state, declared

Two things in the images are visual state snapshots rather than initial
`GameState`. Both are lifecycle states the current product already derives and
can already reach; neither invents a new kind of fact:

- **NODE balance.** Initial `nodeWallet.balanceNodeUnits` is `0`, at which every
  BUY would be refused `insufficient_funds`. The prototypes show `0.0845 NODE`
  (84,500 atomic units) before purchases and `0.0645 NODE` after two, so price,
  balance and action hierarchy can be judged at all. No mining, payout or
  balance history is implied.
- **Mixed acquisition states.** Screens that show `PURCHASED`, `DOWNLOADING` or
  a second `ON DEVICE` release are arranged snapshots: two entitlements held and
  one canonical transfer running at 40%. Initial state has no entitlements and
  no transfer. Every value inside them is derived the way the current projection
  derives it — including the transfer rate, `2 MiB/s`, which is exactly
  `min(Market distribution upload 4 MiB/s, local Device download 2 MiB/s)`
  under the existing derivation.

One thing in the images is *not* mock and is deliberately kept: the seeded
`node-miner-1.0.pkg` on the local Device makes NODE Miner `ON DEVICE` and
`NOT PURCHASED` at the same time, with BUY still offered. That is initial truth,
and it is the single hardest case any Market composition has to carry.

### Not invented, because nothing represents it

Ratings, reviews, screenshots, download counts, popularity, rankings,
recommendations, categories, tags, search, wishlists, discounts, release or
update timestamps, analytics, compatibility certification, support level, trust
or security scores, official endorsement, signatures, hashes, signing
authorities, package verification, invented publishers or channels,
notifications, network telemetry, and any hidden target weakness information.


## 3. Diagnosis — what is actually weak today

The mechanic is sound and the current application is honest. What it is not yet
is a designed acquisition product. Concretely, on current `main`:

1. **Price is the last item of a metadata run.** A catalog row states
   `version · CHANNEL · size · price` in one undifferentiated tier, so the one
   economic fact of the screen sits at the same weight as a byte count, with no
   column two rows can be compared down.
2. **The available action never appears in the catalog.** Acquisition state is a
   chip, but what the user may *do* is only discoverable by opening an offering.
   A five-row catalog therefore answers "where is this" and not "what now".
3. **The offering surface is an inspector, not a decision surface.** Seven equal
   `node-facts` rows — PUBLISHER, SELLER, PACKAGE, SIZE, PRICE, PURCHASE, LOCAL
   COPY — flatten provenance, commerce and lifecycle into one uniform key/value
   tier with PRICE between SIZE and PURCHASE. This is precisely the failure the
   Wallet pass already named and corrected for financial surfaces.
4. **The lifecycle is stated three times and composed once.** A `STATE` section
   row, a `PURCHASE` fact and a `LOCAL COPY` fact all restate the same derived
   position without ever making it legible as a position.
5. **The operator is the masthead subject.** The strongest identity line on the
   Market root is `Open Package Exchange`, which makes the application read as
   the operator's storefront rather than as NODE-OS's client onto it — the exact
   conflation the three-identity rule exists to prevent, and the line a second
   distribution source would force a redesign around.
6. **Balance is a one-entry definition list.** It states a number and gives it no
   relationship to what anything costs.
7. **Evaluation material is invisible at decision time.** The only thing a
   release says about itself sits behind a closed disclosure *below* the action,
   so the surface that should answer "what am I willing to run" shows a filename
   and a byte count above the fold.
8. **The strongest boundary in the mechanic has the weakest presentation.**
   "Market ends at acquisition; Files owns INSTALL" is one sentence in a note
   that only appears once a local copy exists.
9. **Absence is honest but not composed.** `NOT STATED` for a publisher, a
   silently omitted channel segment, and nothing at all for missing
   documentation are three different treatments of the same idea, so a missing
   fact reads as an oversight rather than as a deliberate silence.
10. **The row glyph is the Files package glyph.** A catalog of purchasable
    releases is marked exactly like a directory listing of local files.

None of these is a truth defect. All of them are hierarchy defects, which is why
this pass explores composition rather than mechanics.


## 4. The product principle all three directions were built on

> NODE does not decide what software you are allowed to run. It gives you enough
> truthful information to decide what you are willing to run.

Concretely, that made three rules binding on every direction:

- **Fact first, decision second.** Nothing persuades. There is no promotional
  surface, no curation, no ranking and no encouragement to buy; there is
  identity, provenance, price, position and one available action.
- **Silence is composed, never filled.** A release that states no publisher and
  no channel keeps that absence as a first-class, deliberately styled state.
  Padding it with an inferred sibling value, an empty string, or a plausible
  guess is the one thing none of these directions may do.
- **The client is not the seller and neither is the publisher.** Three identities
  stay separated by structure, not by a disclaimer: NODE-OS supplies the client,
  Open Package Exchange lists and sells and is paid, and provenance is whatever
  each release states for itself.


## 5. Direction A — “Exchange Counter”

Prototype: [`prototypes/market-visual-exploration-v1/direction-a.html`](prototypes/market-visual-exploration-v1/direction-a.html)

- **Core product idea.** The catalog *is* the product, and acquisition happens in
  it. Every row is a complete decision unit — release identity, acquisition
  state, one comparable price column and the primary action itself — and opening
  a release expands it in place rather than navigating away.
- **Dominant visual subject.** One dense, hairline-separated list of five
  offerings with prices aligned down a single trailing column.
- **Key strength.** The lowest possible cost to act, and the only direction where
  the whole lifecycle is visible at once: `A3` shows DOWNLOADING, ON DEVICE,
  PURCHASED and AVAILABLE in one view, with a running transfer's rail resting on
  its own row. Prices are genuinely comparable. Nothing is hidden behind a
  navigation step.
- **Principal tradeoff.** Evaluation is the weakest of the three. A release with
  real authored documentation gets a cramped panel rather than a reading
  surface, and every provenance question costs an expand. On a phone the row
  needs three lines, so five offerings do not fit one screen, and several
  expanded rows make the list unwieldy.


## 6. Direction B — “Release Dossier”

Prototype: [`prototypes/market-visual-exploration-v1/direction-b.html`](prototypes/market-visual-exploration-v1/direction-b.html)

- **Core product idea.** A release is a document you read before you decide. The
  catalog is a deliberately thin index whose only job is to help you choose what
  to read; the release surface is a dossier whose dominant subject is what the
  release itself states, with exactly one acquisition band as the single
  decision moment.
- **Dominant visual subject.** The release's own words — about, capabilities,
  changes — beside a narrow decision rail.
- **Key strength.** By far the best answer to "what am I willing to run", and the
  best handling of missing metadata: `B2` deliberately uses the Rollback Exploit
  Toolkit, which has full documentation and states neither publisher nor
  channel, so the composition is proved on the hardest real case. Provenance is
  a labelled block rather than three rows in a fact list, absence is a styled
  tier, and the Market→Files boundary gets a permanent, properly composed
  statement instead of a conditional note.
- **Principal tradeoff.** The slowest shape, and the one that browses worst. The
  index carries no price and no action at all, so affordability is invisible
  while browsing and every purchase costs a navigation step in and back. Five
  near-identical index rows give a returning user very little to scan, and the
  dossier's length means the acquisition band can be scrolled off on a phone
  unless it is ordered first — which is what B does, at the cost of putting the
  decision above the evidence.


## 7. Direction C — “Acquisition Ledger”

Prototype: [`prototypes/market-visual-exploration-v1/direction-c.html`](prototypes/market-visual-exploration-v1/direction-c.html)

- **Core product idea.** Acquisition position leads. The root is grouped by the
  state each offering is derived to be in — IN PROGRESS, READY TO DOWNLOAD, ON
  THIS DEVICE, AVAILABLE — so the next possible action is visible before
  anything is opened, and the offering surface is a focused panel built on the
  four represented states and where each state's truth actually lives.
- **Dominant visual subject.** The user's own position across the catalog: a
  source context block, a small derived ledger (balance, entitlements held,
  offerings listed), then four short grouped modules.
- **Key strength.** The lifecycle and the Market/Files boundary become
  unmissable, and the entitlement/possession split is carried structurally
  rather than in prose. `C3` is the proof: NODE Miner reached ON DEVICE without
  ever being PURCHASED, so PURCHASED is marked *absent* while ON DEVICE is
  marked current and BUY is still offered — a shape a progress bar could not
  express. It is also the direction that scales best as a catalog grows, and its
  short groups read best on a phone.
- **Principal tradeoff.** With five offerings and mostly one state, the grouping
  is lopsided and the root becomes tall — it is the only direction whose root
  reliably scrolls in the desktop Shell. Reordering by state destroys the stable
  catalog order a returning user could otherwise learn, and it subordinates
  discovering new software to managing what you already have. Evaluation is
  deliberately secondary, behind disclosure.


## 8. How the three differ, structurally

They are intended to remain distinct with every colour, icon and border removed.

| Question | A | B | C |
| — | — | — | — |
| First thing seen | Five priced rows | Five release names | Your acquisition position |
| Catalog → detail | Expansion in place, no navigation | Thin index → long document | Grouped list → focused panel |
| Where the decision is made | On the row | In one band on the dossier | In the panel, after the position |
| Acquisition state | A column | A word in the hero | The organizing principle |
| Provenance | Behind an expand | A composed block, most prominent | Compact facts, secondary |
| Evaluation material | Cramped | Dominant | Behind disclosure |
| Balance | A supporting strip above the list | Only at the decision point | A derived ledger cell |
| Operator context | One quiet line above the catalog | A masthead meta line + per-release SELLER | A labelled SOURCE row in a context block |
| Phone behaviour | Row becomes three lines | Decision rail reorders above the prose | Groups stay short; actions take their own line |


## 9. Operator identity and future distribution sources

All three keep `Open Package Exchange` as a labelled *context*, never as the
application's brand: no masthead subject, no logo, no palette, no
operator-owned navigation. `NODE-OS Market` remains the application; the
operator is a value in a slot.

C makes that slot most explicit — a `SOURCE` row in a context block, stating
that this is a broad open market and not an official NODE distribution channel,
which is current represented truth. A states it as a single `LISTED BY` line. B
carries it in the index masthead meta and repeats it per release as `SELLER`,
which is arguably the most accurate, since selling is a per-offering fact.

**Deferred direction, not current truth.** No source switching, official store,
third-party tab, badge, verification, signing or trust concept is drawn
anywhere, and none exists. The only future-aware requirement this pass tried to
satisfy is separability: in every direction the operator occupies one replaceable
region, and a later different distribution context could take that region
without the catalog, the release surface or the acquisition grammar below it
changing shape. Whether NODE ever operates an official channel, and how a
future Internet-layer grey or black market would present itself, are
deliberately not designed here. If that ever happens, the observation worth
carrying forward is that the *operator*, the *seller* and the *publisher* are
already three separate values in these compositions, so adding a fourth
distinction later is a labelling change rather than a restructure — and B's
per-release SELLER treatment is the one that survives a multi-source world with
the least change, because it never claims the whole screen belongs to one
operator.


## 10. Shared NODE-OS primitive limitations this exposed

Three, stated as observations. None was changed in production; each was worked
around inside prototype space only.

1. **There is no shared list-on-one-surface primitive.** `.node-row` draws a
   complete bordered rectangle per item, which is exactly what the Wallet pass
   rejected for transfer history and what makes five offerings read as five
   repeated objects rather than as one catalog. Every direction here needed a
   hairline-separated list inside one module, and each had to build it. The
   Wallet already owns one (`.dollar-activity` on `.wallet-module`). A second
   application needing the same thing is the first real evidence that the
   layered module and the hairline row belong to the shared set rather than to
   the Wallet — but that is a suite-level decision, not this pass's to take.
2. **`.node-facts` is the only grouping primitive for stated facts, and it is
   flat by construction.** It gives every fact one weight, which is right for an
   inspector and wrong for a surface where price, provenance and lifecycle are
   different kinds of claim. All three directions had to stop using it for the
   facts that carry the decision.
3. **There is no shared treatment for an honestly absent value.** `NOT STATED`,
   an omitted segment and a missing documentation block are currently three
   unrelated behaviours. Absence is common enough across Market, Files and System
   that a single quiet tier for "this is not stated, and nothing is inferred"
   would be worth having.

A smaller note: `.node-progress` is a real `<progress>` element in production
and is styled through vendor pseudo-elements; the prototypes draw the same rail
with a plain element, which is a prototype convenience and not a suggestion.


## 11. Responsive review

Checked at 320, 390, 430 and 834 CSS px, with ~390 as the primary phone review
width, inside a container-query reproduction of the current Shell viewport and
its own breakpoints. The Shell is not a task target and gains nothing in any
direction: no application top bar, no application runtime strip, no
application-owned mobile chrome, no viewport or keyboard behaviour.

Verified mechanically at all four widths in all three directions: no element
extends past the frame, no scrolling application region overflows horizontally,
and no control on a phone screen is under 40px high.

Two real defects were found and corrected during the pass rather than shipped:
Direction B's index broke release names mid-word from 320 to 430, because one
cell was left to grid auto-placement and created an implicit fourth column; and
Direction A's rows carried the package filename at widths where it could only
wrap, so it is now dropped below 540px, where it is context rather than
identity.

Physical iPhone/Safari validation has **not** been performed. This is
prototype-only material with no production interaction change, so it does not
require it; any direction taken forward into implementation will.


## 12. Self-review against the pass's own tests

| Test | Result |
| — | — |
| NODE family | All three use the current tokens, type tiers, line work, mint accent and the accepted mature-surface execution (tonal depth, lit top edge, mono identifiers, application face for quantities). They sit beside Wallet and Files without looking foreign. |
| Cyber-theater | No scanlines, glow panels, fake console text, telemetry, graphs, HUD ornament or package artwork. The only added complexity is C's spine, which is the four represented states rather than decoration — the element closest to the line, kept because the lifecycle is the product's central legibility requirement and it is stated as a marked list, not drawn as a diagram. |
| Truth | Every fact is either current repository truth or a declared snapshot of an already-supported lifecycle state (section 2). No invented provenance, no gameplay leakage. |
| Market | All three read as software acquisition: identity, provenance, price, position, one action. None reads as Files, Wallet, a dashboard or a store. |
| Future source | The operator is a value in a replaceable slot in all three, never the application's identity. |
| Mobile | Each direction makes a real 390px decision rather than compressing its desktop layout (section 8, last row). |
| Distinctness | The differences in section 8 are structural and survive greyscale: a priced table, a document, and a state-grouped work list. |


## 13. Intentionally deferred

Selecting a winner or a hybrid; a formal Market design contract; any production
implementation; a Market icon or glyph family; interaction, transition and
press-state detail beyond what a static prototype shows; cancelling a transfer
from Market rather than the Activity Monitor; any Market-side presentation of
installed software; empty-catalog, offline-Device, insufficient-funds and
destination-occupied surfaces beyond the one destination note already
represented; and every out-of-scope item in section 12 of the Wallet contract
that touches distribution, verification or trust.

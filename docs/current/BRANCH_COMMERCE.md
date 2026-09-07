# Branch commerce

Status: Accepted
Scope: Current Company and Business Branch structural identity, the Branch's
explicit Network relationship, the concrete bookstore-commerce record attached
to the seeded Branch, completed-sale meaning, settlement configuration, the
separate concrete bookstore-operations record (OPEN/CLOSED, current
inventory, shelf capacity, checkout capacity), and the separate concrete
bookstore-backend record referencing the real represented Device/Service
that technically implements the Branch's backend, and the separate concrete
bookstore-sales-cadence record that determines when a sale opportunity for
the Branch becomes due.

## Generic Company / Branch / Network structural truth

V1 represents one persistent Company World Entity, `Bookstore`, and one
concrete Business Branch it owns, `Bookstore Branch 01`
(`GameState.business`, `src/core/game/business.ts`). Both have their own
stable identity, independent from each other and from any LocalNetwork,
Device, Firmware, InstalledSoftware, Civic Dollar Account, and the Player. The
Company has no represented owner, employees, hierarchy, or valuation; the
future ability to acquire a Company is accepted direction (`docs/FUTURE.md`),
not implemented truth. Neither the Company nor the Branch is a generic
Organization/Entity framework: `GameState.business` is a narrow
`{ companies, branches }` collection specific to this domain.

`BusinessBranchState` is deliberately generic structural identity, plus the
smallest current human-readable location this slice adds:

```text
BusinessBranchState
├── id             — stable Branch identity
├── displayName
├── location       — current mutable human-readable address, optional
├── companyId      — the owning Company, by stable identity
└── networkId      — the LocalNetwork this Branch explicitly operates through
```

It carries no settlement configuration, sale history, or any other concrete
commerce/operational field. The seeded Branch's `networkId` names the
existing foreign LocalNetwork (`network-foreign-001`, presented as
`remote-segment-01`) that also contains Petra's phone and `srv-02`.

`location` is optional current mutable Branch truth — a structurally valid
Branch (a future distribution or hosting Branch, for example) need not
represent one — and is narrowly a human-readable address string, not a
geography system, Location entity, postal-address framework, map model, or
coordinate abstraction. The seeded Branch represents `18 Mercer Street`
(`BOOKSTORE_BRANCH_LOCATION`). Like `displayName`, it is *current* truth: a
Civic Dollar Transaction's own historical statement-context snapshot (below)
captures whatever this value was at the moment a sale happened and never
re-reads it, so renaming or relocating the Branch afterwards never rewrites
an already-created Transaction.

The Branch → Network relationship is explicit Business-owned World Truth, not
derived from any Device's Network membership and not stored on `LocalNetwork`
itself. A Network may have zero, one, or multiple associated Branches, and a
Company may own multiple Branches; V1 seeds exactly one Company and one
Branch, but the domain shape does not assume a single result. There is no
`operationsDeviceId` relationship, and no InstalledSoftware requirement gates
whether the Branch exists or where its business context lives — BranchOps 1.0
and its Device-bound resolver are retired (`docs/current/NETWORK_ACCESS.md`,
`docs/current/DEVICE_SYSTEM.md`).

`resolveBusinessOperatingContext` (`src/core/game/business.ts`) answers only
this structural question — operated Device → represented Network membership →
Business Branches explicitly associated with those Networks → the Companies
that own them — and reads nothing else: not Civic Dollar, not any concrete
commerce or operational subsystem. A Business Branch is never dropped from
this result merely because it has no concrete commerce record; a structurally
valid Branch with no represented subsystem (a future distribution, hosting, or
storage Branch, for example) resolves exactly the same way. This is also why
it grants no `NetworkManagementAuthority`, `DeviceAccess`, Discovery, or
Knowledge: it reads only Network membership (World Truth) and the Branch's own
explicit `networkId` reference (Business-owned World Truth).

## Represented commerce, not randomized revenue

**Revenue is a consequence of represented commerce, not a primitive that is
randomized.** A successful Bookstore sale amount is always explainable by
concrete World Truth — the represented merchandise actually purchased, at
its represented unit price — never by a directly configured, generated, or
randomly banded monetary outcome. The full causal chain a successful sale
must always be explainable by is:

```text
represented merchandise + represented stock
  -> provisional purchase composition (randomness chooses this)
  -> deterministic basket total (Σ quantity × current unitPriceCents)
  -> real Civic Dollar Transaction for exactly that total
  -> exact per-merchandise stock decrement
  -> immutable CompletedSale explanation
```

Randomness (`bookstorePurchaseRandom`, below) may choose which represented
merchandise ends up in a basket and how many units; it never chooses an
amount in cents, a monetary band, or any other direct revenue primitive.

## The current concrete bookstore-commerce record

The one currently represented commerce mechanic — a bookstore's represented
merchandise catalog, settlement configuration, and sale history — is owned by
a separate, narrow, branch-linked record rather than being embedded on
generic Branch identity: `GameState.bookstoreCommerce`
(`src/core/game/bookstoreCommerce.ts`):

```text
BookstoreBranchCommerceRecord
├── branchId              — the Business Branch this record belongs to, by stable ID
├── settlementAccountId   — mutable current settlement-destination configuration
├── merchandise           — the current represented merchandise catalog
└── completedSales        — completed book_sale history, each with its own captured purchase lines

BookstoreMerchandiseRecord
├── id             — stable merchandise identity
├── name           — current human-readable name
└── unitPriceCents — current canonical unit price, in integer cents
```

`merchandise` is Bookstore Commerce's own current catalog configuration,
exactly like `settlementAccountId`: a small concrete fixture, not a generic
Product/SKU/catalogue framework. Each entry carries only stable identity, a
current name, and a current unit price — no ISBN, author, genre, publisher,
tax, cost basis, supplier, margin, popularity, quality tier, or dynamic
pricing. V1 seeds exactly eight authored titles
(`BOOKSTORE_MERCHANDISE_CATALOG`), `bookstore-merch-001` through
`bookstore-merch-008`, priced from $8.99 to $20.00: `Night Transit` ($8.99),
`Static Bloom` ($10.99), `Glass District` ($12.99), `The Quiet Archive`
($13.99), `After the Relay` ($14.99), `Northbound` ($15.99), `A Map of Empty
Rooms` ($17.99), and `Systems of Dust` ($20.00). These current values are read
fresh, by stable merchandise ID, at the moment purchase composition selects
that merchandise (below) — never inferred from a historical Transaction or
CompletedSale, and a sale's actual amount is always the deterministic sum of
whatever merchandise a purchase composition actually selected, never this
catalog's price read as a standalone primitive. `BookstoreCommerceState` also
carries its own monotonic `nextSaleId` allocator for runtime CompletedSale
identity, following the existing Transaction/Session allocation pattern
(`bookstore-sale-0002`, `-0003`, ...) — never derived from array length,
time, or randomness.

V1 seeds exactly one such commerce record, keyed to `bookstore-branch-01`:
the eight-title catalog above, `dollar-account-veyra-phone-v0` as current
settlement configuration, and one completed historical `book_sale`
referencing `dollar-transaction-0001` (its own captured purchase composition
is described below, under "Historical versus current merchandise truth").
`resolveBookstoreCommerceForBranch(state, branchId)` resolves this record for
one Branch, joined against current Civic-Dollar-owned Account and Transaction
truth, and returns `undefined` where a Branch has no such record at all — a
legitimate structural state, never an error.

This record is deliberately narrow and concrete, not a generic Business-commerce
framework: a different concrete subsystem owns its own separate branch-linked
record, keyed the same way by stable Branch ID, rather than extending this one
or being embedded on `BusinessBranchState`. The one currently represented
sibling is bookstore *operations*, below; a still-later concrete subsystem
(distribution, cameras, payments, storage, ...) would follow the same
pattern rather than extending either existing record.

## The current concrete bookstore-operations record

A second, separate branch-linked record represents the currently implemented
Bookstore *operations* mechanic — how a Bookstore Branch is configured to
sell, whether it is presently open, and its current item-level stock — owned
by `GameState.bookstoreOperations` (`src/core/game/bookstoreOperations.ts`):

```text
BookstoreBranchOperationsRecord
├── branchId          — the Business Branch this record belongs to, by stable ID
├── shelfCapacity      — configuration-like: maximum sellable inventory this Branch can shelve
├── checkoutCapacity   — configuration-like: represented physical checkout positions
├── open               — mutable runtime: OPEN or CLOSED
└── stock              — mutable runtime: current per-merchandise stock quantities

BookstoreMerchandiseStockRecord
├── merchandiseId — the represented merchandise this quantity is for, by stable ID
└── quantity      — current non-negative integer stock quantity
```

`shelfCapacity` and `checkoutCapacity` are configuration-like — how this
Branch is set up — while `open` and `stock` are mutable runtime truth; the
shape keeps the two distinguishable rather than blending them.
`checkoutCapacity` represents only a count of physical/operational checkout
positions: it carries no customer-throughput, sales-per-hour, demand, timing,
or autonomous-sale meaning.

`stock` is item-level canonical inventory truth, keyed by stable merchandise
ID. There is no second mutable aggregate inventory total stored alongside
it: any "current total stock" a caller needs — including RACK-OS BUSINESS's
own STOCK line — is always derived fresh by summing `stock`
(`deriveBookstoreTotalStock`), never stored redundantly, so the two can never
drift apart. `findBookstoreStockQuantity` looks up one merchandise
identity's current quantity, defaulting to `0` where none is represented.

`createBookstoreBranchOperationsRecord` is the one sanctioned constructor for
this record and enforces, at construction, that every stock quantity is a
non-negative integer, that no merchandise identity repeats within `stock`,
and that the *sum* of every stock quantity can never be represented above
`shelfCapacity`. V1 seeds exactly one such record for `bookstore-branch-01`:
shelf capacity 480, checkout capacity 2, OPEN, and 45 units of each of the
eight authored catalog entries — 8 × 45 = 360 total units, exactly the same
initial total this Branch represented before item-level stock existed.
These are conservative authored fixture values, not a generation range,
minimum/maximum, or economic tier. A different Bookstore Branch varies
purely through this same record's configuration/runtime values (different
capacities, stock, or OPEN/CLOSED) — never through branch-specific code, and
never by branching on `bookstore-branch-01`'s literal ID or display name.

`resolveBookstoreOperationsForBranch(state, branchId)` resolves this record
for one Branch and returns `undefined` where a Branch has no such record at
all — a legitimate structural state, never an error. It is a wholly separate,
independent join from `resolveBookstoreCommerceForBranch`: a Branch may have
operations without commerce, commerce without operations, both, or neither,
and none of those combinations is invalid.

This slice implements no Economic Tier, valuation, Bookstore staffing,
Bookstore security generation, advertising effects, upgrades, ownership,
demand, or autonomous/scheduled sales. It does not touch the existing Petra
Technician incident-response mechanic, which remains separately implemented
current truth (`docs/current/NETWORK_ACCESS.md`).

## The current concrete bookstore-backend record

A third, separate branch-linked record represents which real, concretely
represented technical Device and Service implement a Bookstore Branch's
backend — the technical infrastructure later Bookstore mechanics, VEYRA
Business, and hacking consequences can legitimately depend on — owned by
`GameState.bookstoreBackend` (`src/core/game/bookstoreBackend.ts`):

```text
BookstoreBranchBackendRecord
├── branchId    — the Business Branch this record belongs to, by stable ID
├── deviceId    — the real represented NetworkHost hosting the backend, by stable ID
└── serviceId   — the real represented NetworkService on that Device implementing the backend, by stable ID
```

This record carries no settlement, sale, OPEN/CLOSED, inventory, or shadow
`online` status of its own. It is exactly a stable reference into existing
Device/Service World Truth, following the same "real technical ownership,
never a parallel model" precedent the rest of this repository's Device/
Service/Software architecture already establishes
(`docs/current/DEVICE_SYSTEM.md`). `srv-02` (`host-lan-002`) owns the seeded
backend's concrete technical presence as an ordinary open `NetworkService`,
`Bookstore Backend 1.0` (`service-bookstore-backend-002`, TCP/8090) —
represented exactly like its neighboring GateSSH and RackUpdate Services,
with no credential-based access and no derived vulnerability. It is never
inferred from the Branch's display name, from `srv-02`'s display name or IP,
or from RACK-OS presentation.

`resolveBookstoreBackendForBranch(state, branchId)` resolves this record for
one Branch and returns `undefined` where a Branch has no such record at all,
or where its referenced Device or Service no longer resolves at all — all
legitimate structural states, never an error. Where the reference does
resolve, availability is derived fresh from that Device's own
`isDeviceNetworkUsable` operational truth together with the Service's own
`open` truth — never a stored status flag on the record itself, so backend
availability can never drift from the real technical state it describes.
This is a wholly separate, independent join from
`resolveBookstoreCommerceForBranch`, `resolveBookstoreOperationsForBranch`,
and `resolveBookstoreSalesCadenceForBranch`: a Branch may have any
combination of these concrete subsystems, or none.

This slice implements no writable backend administration, no Business
authentication/permission model, no vulnerability or exploit on the backend
Service, no settlement redirection, and no sale consequence of backend
availability. `srv-02` grants no DeviceAccess, NetworkManagementAuthority,
Discovery, Knowledge, or Business authority merely by being referenced here;
the reference is read-only World Truth, and reaching the Service still
follows the same generic Scan/Inspect/credential-access rules any other
represented Service does (`docs/current/NETWORK_ACCESS.md`).

### No universal Business archetype framework

Bookstore is the first concrete Business archetype; commerce, operations,
backend, and sales cadence are its own four narrow branch-linked records, not
instances of a generic Business-operations/archetype engine, registry, or
rules system — none exists. A future archetype (Laundry, Bank, ...) is
expected to introduce its own concrete branch-linked model(s) the same way,
varying through its own configuration/runtime data rather than
seeded-identity dispatch. Generalizing into a shared abstraction is deferred
until multiple concrete archetype implementations actually justify it; it is
not implemented now and is not implied by this pattern repeating.

## Sale and finance ownership

The completed sale owns the business meaning "book sale" — including the
immutable historical purchase-line truth that explains it — while Civic
Dollar exclusively owns the corresponding cents movement. Neither the Branch
nor its commerce record keeps a balance or shadow ledger; the record's
Account and Transaction IDs are stable references into Provider-owned
finance truth, and a CompletedSale never separately duplicates the total its
referenced Transaction already carries.

The authored historical Transaction moves 2,000 cents from the neutral
retail-clearing Account (`CD-9000-2000`) to the Account initially configured
at that historical moment (`CD-3318-2204`). Its destination reference
snapshot remains the sale's historical settlement truth even if the commerce
record's current `settlementAccountId` later changes. There is exactly one
authored initial sale; every other CompletedSale is the runtime consequence
of an explicit sale execution below, never rewritten or re-priced.

That authored Transaction also carries a historical statement-context
snapshot (`docs/current/DOLLAR_FINANCE.md`) authored literally to match the
seeded Branch's initial `displayName`/`location` — `Bookstore Branch 01`,
`Retail sale`, `18 Mercer Street` — rather than derived dynamically from
current Business state, so the initial represented Wallet/business history
stays coherent with every later runtime sale's own snapshot.

### Historical versus current merchandise truth

Every `BusinessBranchSale` carries its own immutable `lines`: for each
purchased merchandise identity, that stable ID plus a *captured* snapshot of
its name and unit price at the exact moment the sale completed —
`BusinessBranchSaleLine`. This is deliberately not a live reference to
current catalog state: renaming or repricing a `BookstoreMerchandiseRecord`
afterwards, or removing it from the catalog entirely, never rewrites or
invalidates an already-completed sale's captured lines. The invariant this
record always satisfies is:

```text
Σ(historicalLine.quantity × historicalLine.capturedUnitPriceCents)
  = referenced DollarTransaction.amountCents
```

The authored historical sale (`bookstore-sale-0001` / `dollar-transaction-0001`,
$20.00) predates represented purchase composition; it is reconciled with this
model rather than re-priced, deleted, or reconstructed: its `lines` are
authored directly as 1 × `bookstore-merch-008` captured as `Systems of Dust`
at 2,000 cents, summing to exactly its existing $20.00 Transaction. The
360-unit initial stock this Branch represents is authored current truth in
its own right (above); it is not reconstructed or mutated to explain how
stock reached that level before this history existed.

### Provisional purchase composition

When a due sale opportunity (`docs/current/BRANCH_COMMERCE.md`'s Sales
Cadence section, below) reaches the point where a purchase can legitimately
be attempted, sale execution composes exactly one *provisional* purchase — a
basket of represented merchandise, not yet any form of persisted or
historical World Truth — before deciding whether the sale actually
completes. `composeBookstorePurchase` (`src/core/game/bookstoreSale.ts`)
does this in two steps, both driven by a dedicated Bookstore-local random
channel, `bookstorePurchaseRandom`:

1. **Basket size.** One of 1, 2, or 3 units, drawn from the authored
   `BOOKSTORE_PURCHASE_BASKET_SIZE_WEIGHTS` mix — weights 70/25/5 — restricted
   to sizes actually feasible given current total available stock (a basket
   is never sized larger than represented stock on hand: at 1 unit of total
   stock only size 1 is feasible; at 2, only sizes 1–2). Exactly one random
   sample is drawn for this regardless of how many sizes are feasible, so the
   number of purchase-random draws a basket consumes never varies with
   current stock levels. This mix is a concrete, Bookstore-local
   approximation of currently unsimulated purchasing behavior — not a generic
   Customer rule, a Customer class, or a represented preference model, and it
   is never generalized beyond this one mechanic.
2. **Merchandise selection**, once per unit in the basket. Each draw selects
   uniformly at random among whichever merchandise identities still have
   positive *provisional* remaining stock at that point in the basket's own
   construction, so one basket can never provisionally select more units of
   one merchandise than currently exist; an identity that reaches zero
   provisional remaining stock mid-basket is no longer selectable for the
   rest of that basket. This is a simple neutral selection — never a
   Customer preference, bestseller weight, popularity score, or marketing
   affinity. Repeated selections of the same merchandise aggregate into one
   resulting basket line with `quantity > 1`.

`bookstorePurchaseRandom` may choose composition — basket size and which
currently available merchandise is selected — and never chooses an amount in
cents, a LOW/STANDARD/HIGH band, a percentage markup, or any other direct
monetary outcome. The basket's deterministic total,
`deriveBookstoreBasketTotalCents` — exact integer
`Σ(quantity × current unitPriceCents)` — is the only value ever supplied to
the generic Civic Dollar movement primitive; no random adjustment ever
follows it.

`bookstorePurchaseRandom` is a third semantically independent random channel,
alongside `bookstoreDemandRandom` and `credentialAccessRandom`
(`advanceGameState` in `src/core/game/gameAdvancement.ts`): none of the three
shares or advances another's sequence merely because more than one occurs
within the same call, and each defaults independently to `Math.random` in
production. `advanceBookstoreSalesCadence` threads it straight through to
`executeBookstoreSale` for that one due opportunity's own attempt — never
sampled on an ordinary tick that leaves no opportunity due.

A provisional basket is not itself canonical World Truth: it is local
transition data inside one `executeBookstoreSale` call, never persisted as a
`PendingBasket`, `PurchaseAttempt`, or any other intermediate GameState
before the sale actually succeeds. If a downstream condition (insufficient
funds, an unrepresentable resulting balance) refuses the sale after this
point, the composed basket is simply discarded — sale execution never
re-rolls a cheaper or different basket to try to make a refused sale
succeed; the originally composed basket was the one concrete attempted
purchase.

### Sale execution

`executeBookstoreSale(state, branchId, bookstorePurchaseRandom?)`
(`src/core/game/bookstoreSale.ts`) is the one canonical explicit state
transition that turns current Business Branch, Bookstore Operations,
Bookstore Commerce, Bookstore Backend and Civic Dollar truth into one
completed sale. It accepts only the Branch's stable ID and the optional
purchase-random channel — never a price, a basket, an Account, a Device, a
Service, or a capacity — and resolves every other fact fresh from canonical
state. One sale means exact stock decrements for every purchased merchandise
line, exactly one Civic Dollar Transaction moving exactly the composed
basket's deterministic total from Retail Clearing to the current settlement
Account, and exactly one appended CompletedSale (carrying its own captured
purchase lines) referencing that Transaction by stable ID.

Every prerequisite that makes a sale impossible independently of what gets
purchased is preflighted, and conclusively refusing on any of them consumes
no `bookstorePurchaseRandom` at all: the Branch exists in canonical Business
state; Bookstore Operations exists for it, is `open`, has positive total
stock (`deriveBookstoreTotalStock > 0`) and `checkoutCapacity > 0`; Bookstore
Commerce exists for it with a structurally sufficient merchandise catalog
(at least one entry, every entry a positive safe-integer price) and a
settlement Account that resolves; Bookstore Backend exists for it and its
Device/Service resolve as currently available through the existing backend
resolver; and `dollar-account-retail-clearing-v0` resolves and is distinct
from the settlement Account. Only once every one of these resolves does sale
execution compose exactly one provisional purchase (above) — the one point
purchase randomness is consumed. That basket's deterministic total is then
the only further reason a sale might still refuse: insufficient Retail
Clearing funds, or a resulting balance that could not stay exactly
representable. Every one of these is checked before anything is committed,
so a failed attempt always returns the original pre-attempt `GameState`
unchanged — there is no partially applied sale, no persisted provisional
basket, no stock decrement without its Transaction, and no Transaction
without a CompletedSale. Backend unavailability (from either the Device's
operational truth or a closed Service) refuses the sale the same way a
CLOSED store or an empty shelf does, without mutating Business, Operations,
Commerce, or Civic Dollar state.

On success, `executeBookstoreSale` supplies the Civic Dollar movement
(`executeCivicDollarMovement` in `docs/current/DOLLAR_FINANCE.md`) with a
historical statement-context snapshot of the Branch's *current*
`displayName` and `location`, plus the fixed deterministic purpose
`Retail sale` (`BOOKSTORE_SALE_STATEMENT_PURPOSE`) — captured once, at this
exact moment, and never re-read afterwards. Civic Dollar itself understands
nothing about what a Bookstore or a Business Branch is: it only stores
whatever snapshot it is given, verbatim, on the Transaction it creates. A
Branch's `location` is optional, so a Branch with none simply omits
`location` from the snapshot rather than inventing one. A refused sale
creates no Transaction and therefore no statement context, exactly like
every other atomic failure path above.

This is one explicit domain transition, not a cadence: nothing here decides
*when* a sale is attempted, there is no timer, countdown, or autonomous
demand, and calling it twice is two independent explicit attempts. Sales
Cadence (below) decides when this operation is attempted; this remains the
sole definition of what one attempt means.

### Sales cadence and demand

A fourth, separate branch-linked record represents the currently implemented
Bookstore *sales cadence* mechanic — when a sale opportunity for a Bookstore
Branch becomes due — owned by `GameState.bookstoreSalesCadence`
(`src/core/game/bookstoreSalesCadence.ts`):

```text
BookstoreBranchSalesCadenceRecord
├── branchId                      — the Business Branch this record belongs to, by stable ID
├── locationOpportunityRatePerHour — configuration-like: authored location/context demand potential, opportunities/hour
├── attractivenessMultiplier      — configuration-like: current Store attractiveness effect on that rate
└── remainingUntilOpportunityMs   — mutable runtime: represented elapsed ms left until the next opportunity
```

This record owns timing and demand configuration only; it never reads or
duplicates any of `executeBookstoreSale`'s prerequisites, and it never writes
inventory, Accounts, Transactions, CompletedSales, Backend, or Business state
directly. `createBookstoreBranchSalesCadenceRecord` is the one sanctioned
constructor and enforces, at construction, that all three fields are positive
finite numbers.

**Demand model.** Sale-opportunity timing is derived from a compact
rate-driven demand model rather than authored as a fixed interval:

```text
locationOpportunityRatePerHour × attractivenessMultiplier = effectiveOpportunityRatePerHour
```

`locationOpportunityRatePerHour` represents the Branch's authored
location/context demand potential; `attractivenessMultiplier` represents the
current Store's own customer-attraction effect on that rate (1.0 is
neutral). `deriveEffectiveBookstoreOpportunityRatePerHour` derives their
product fresh wherever needed — it is never stored redundantly on the record,
so it can never drift from the inputs it describes. These two inputs mean
only "how frequently the unsimulated surrounding world is expected to produce
a sale opportunity for this concrete Bookstore": V1 represents no Customer,
visit, queue, foot-traffic record, popularity, or reputation system, and nothing
here reads Business money, organization quality, or fulfillment state —
those remain owned by Bookstore Operations/Backend/Commerce and Civic Dollar,
exactly as before. The accepted future causal chain from money to demand runs
through a represented Upgrade changing these inputs or Store capability,
never a direct "balance -> more customers" shortcut; Upgrades are accepted
future direction and are not implemented in this slice.

V1 seeds exactly one such record for `bookstore-branch-01`:
`locationOpportunityRatePerHour = 10` and `attractivenessMultiplier = 1.0` —
authored V1 fixture values, not a universal law for every Bookstore or
Business — giving an initial effective rate of 10 opportunities/hour and a
mean inter-opportunity interval of 3,600,000 / 10 = 360,000 ms. There is no
free sale at game start, initial-state construction, or a zero-elapsed
advancement: initial-state construction seeds `remainingUntilOpportunityMs`
deterministically to that mean interval (360,000 ms) and never samples
randomness; the first opportunity exists only after 360,000 ms of actual
canonical elapsed advancement.
`resolveBookstoreSalesCadenceForBranch(state, branchId)` resolves this record
for one Branch and returns `undefined` where a Branch has no such record at
all, exactly like the three sibling resolvers above.

**Irregular sampled arrivals.** Every opportunity after the first is
scheduled by one exponential inter-arrival sample — `sampledIntervalMs =
-meanIntervalMs * ln(1 - u)` for one uniform `u` drawn from a dedicated
Bookstore-demand random source (`bookstoreDemandRandom`, defaulting to
`Math.random` in production) — so a represented rate of N/hour means
approximately N opportunities per represented hour over time while
individual gaps naturally vary, rather than a mechanically fixed interval.

Deriving that `meanIntervalMs` is itself validated, not just the sampler's
RNG input: `deriveValidatedMeanBookstoreOpportunityIntervalMs` requires both
the derived effective rate (`locationOpportunityRatePerHour ×
attractivenessMultiplier`) and the derived mean interval
(`3,600,000 / effectiveRate`) to themselves be positive finite numbers. Two
individually valid positive finite factors are not enough on their own — their
product can still overflow to `Infinity` or underflow to `0`, and even a
validly finite positive effective rate can still divide out to an invalid
mean interval — so this check runs identically wherever a mean interval is
derived, at construction (`createBookstoreBranchSalesCadenceRecord`) and at
scheduling (`scheduleNextBookstoreOpportunity`), and rejects an impossible
configuration with a `RangeError` rather than silently clamping or
reinterpreting it into some arbitrary "realistic" range. Given that
already-validated mean interval, the sampler itself only has to defend
against a degenerate `u` (including exactly `0`, which `Math.random` can
legitimately return) by falling back to the mean interval itself. Together,
this means the whole scheduling path — not the sampler alone — can never
turn a valid or broken `Math.random`-style source, together with any demand
configuration actually accepted as canonical state, into a zero-time or
infinite countdown.

`bookstoreDemandRandom` is threaded through `advanceGameState` as its own
parameter, entirely independent from `credentialAccessRandom`: the two
mechanics never share or advance each other's random sequence merely because
both happen to occur within one `advanceGameState` call. This is a separate
semantic channel and test-injection point, not a separate PRNG
implementation: production leaves both parameters at their default, and both
defaults are the same `Math.random`. Neither channel is a deterministic
production random stream — only test code substitutes a controlled function
for either one.

`advanceBookstoreSalesCadence` (called from `advanceGameState` in
`gameAdvancement.ts`, ahead of the rest of canonical advancement) is the
canonical advancement for every represented cadence record. On each call it
chronologically partitions the given `elapsedMs` at each Branch's own
opportunity boundary: it advances the remainder of canonical state
(`advanceGameStateCore`, the same composition `advanceGameState` used before
this mechanic existed) up to exactly the next due instant, calls the existing
canonical `executeBookstoreSale(state, branchId, bookstorePurchaseRandom)`
exactly once for that Branch — which itself draws from `bookstorePurchaseRandom`
only if it reaches provisional purchase composition (above) — draws exactly
one `bookstoreDemandRandom` sample to schedule the next interval from the
Branch's *current* effective opportunity rate, and only then continues with
whatever elapsed time is left — so a due opportunity
always observes the World/Business truth that exists at its own due time,
never truth from the start or the end of a larger `elapsedMs` alone, and a
large elapsed step correctly contains multiple chronological opportunities
rather than at most one. Randomness is sampled only at that one moment —
never on an ordinary tick that leaves no opportunity due, and never merely
because `advanceGameState` was called — so browser tick frequency cannot
change how many random samples are consumed. A due opportunity is always
consumed — whether `executeBookstoreSale` sells or refuses — and the next
interval is always freshly sampled either way: cadence stores no missed
opportunity, backlog, waiting customer, retry, or lost-revenue state, and a
prerequisite that becomes valid again after a missed opportunity never
triggers an immediate retry or recovery burst.

Changing `locationOpportunityRatePerHour` or `attractivenessMultiplier` never
retroactively rescales an already-scheduled `remainingUntilOpportunityMs`: the
current countdown represents an opportunity already scheduled in canonical
time, and new demand configuration is read only when the *next* interval is
scheduled after the current due opportunity is consumed. This gives a future
Upgrade mechanic (not implemented in this slice) a narrow, causally clean
integration point without magically rewriting already-scheduled time.

This is a narrow concrete Bookstore record, not a generic Business
scheduler, demand system, or universal recurrence framework — exactly like
its three siblings above.

### Retail Clearing

`dollar-account-retail-clearing-v0` is the neutral aggregate Civic Dollar
payment source for retail customers who are not individually simulated. It
remains an ordinary Civic Dollar Account with a real finite balance: no
Credential, Financial Session, Device, or represented Customer identity is
introduced to authorize a sale. It is never magically replenished and never
exempt from ordinary balance rules — a sale that would overdraw it simply
fails, leaving state unchanged, and sustainable external retail funding or
automatic replenishment is a later product decision, not implemented here.

## RACK-OS presentation

RACK-OS 1.1 Business always lists a built-in `BUSINESS` application on its
Applications home, alongside Terminal, Files and System — regardless of
whether any Business Branch exists. Opening it resolves the operated Device's
structural Business context (`resolveBusinessOperatingContext`) and, for each
resolved Branch, separately composes that Branch's concrete commerce
(`resolveBookstoreCommerceForBranch`), concrete operations
(`resolveBookstoreOperationsForBranch`), concrete backend
(`resolveBookstoreBackendForBranch`), and concrete sales-cadence demand
(`resolveBookstoreSalesCadenceForBranch`) where any exists. RACK-OS only
composes and presents these four owners; it is not itself the canonical owner
of any of them.

Where no Branch resolves at all, BUSINESS truthfully states the resolved
Network context and that no Business is configured; this is legitimate
represented World Truth, not an error, a missing installation, or a hidden
Company. Where one or more Branches resolve, BUSINESS presents each Branch's
Company identity, Branch identity, current `location` (where represented),
and associated Network unconditionally, and additionally presents:

- OPEN/CLOSED, current total stock (derived fresh from that Branch's
  operations record via `deriveBookstoreTotalStock` — never a stored
  aggregate) relative to shelf capacity, and checkout capacity, only where
  that Branch has a represented operations record;
- `DEMAND OPPORTUNITIES` (opportunities/hour) and `ATTRACTIVENESS`, derived
  fresh from that Branch's sales-cadence record via the existing
  `deriveEffectiveBookstoreOpportunityRatePerHour`, only where that Branch has
  a represented sales-cadence record. Worded as opportunities rather than
  guaranteed sales, because OPEN/CLOSED, stock, checkout, backend,
  settlement, and finance truth can still refuse any given opportunity.
  `remainingUntilOpportunityMs` is internal simulation timing, not
  player-facing Business information, and is never presented;
- current settlement Account reference and completed sale history, only
  where that Branch has a represented commerce record. Each recent sale is
  presented through its own captured purchase lines — name, quantity, and
  captured unit price — and its real Transaction total, never a generic
  "book sale" label and never a LOW/STANDARD/HIGH classification;
- a compact current merchandise catalog — name, current unit price, and
  (where that Branch also has a represented operations record) current
  stock, looked up by stable merchandise ID via `findBookstoreStockQuantity`
  — only where that Branch has a represented commerce record with at least
  one merchandise entry; and
- the backend Service's own name/version and its derived ONLINE/OFFLINE
  availability, only where that Branch has a represented backend record.

Operations, commerce, backend, and sales cadence are presented fully
independently of each other: a structurally valid Branch with none of the
four presents only its identity, with one presents only that one's facts, and
with any combination presents exactly that combination — nothing invented in
place of a subsystem that is not represented. It exposes no internal Account
IDs, Credentials, Financial Sessions, balances, Device IDs, Service IDs,
Player identity, or unrelated World Truth.

RACK-OS 1.0 is the old technical section environment and provides no
application shell at all, so it presents no BUSINESS surface even where a
Branch's associated Network reaches the operated Device. Installing RACK-OS
1.1 Business creates no Company, Branch, commerce record, operations record,
backend record, financial state, or Network association of its own — it only
makes the built-in BUSINESS read surface available; whether that surface
finds any Business Branch, commerce record, operations record, or backend
record is unrelated to the Firmware.

Browsing changes no GameState, Discovery, Knowledge, finance, access, or
business state. Settlement editing/redirection and future sales are not
implemented.

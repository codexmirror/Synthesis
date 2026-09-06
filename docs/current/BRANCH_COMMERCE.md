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

## The current concrete bookstore-commerce record

The one currently represented commerce mechanic — a bookstore's settlement
configuration and sale history — is owned by a separate, narrow, branch-linked
record rather than being embedded on generic Branch identity:
`GameState.bookstoreCommerce` (`src/core/game/bookstoreCommerce.ts`):

```text
BookstoreBranchCommerceRecord
├── branchId              — the Business Branch this record belongs to, by stable ID
├── settlementAccountId   — mutable current settlement-destination configuration
├── saleValueMix          — mutable current canonical aggregate sale-value distribution
└── completedSales        — completed book_sale history
```

`saleValueMix` is Bookstore Commerce's own current sale/settlement
configuration, exactly like `settlementAccountId`: V1 has no product
catalogue, SKU, category, basket size, discount, tax, fee, or per-item
pricing, so this is the one distribution a sale draws its attempted value
from. It replaces V1's earlier single fixed `unitPriceCents`: there is
exactly one current Bookstore Commerce sale-value truth, never two competing
ones.

```text
BookstoreSaleValueMix
├── LOW
│   ├── amountCents — exact attempted Dollar value in integer cents when selected
│   └── weight      — relative selection weight against the other two bands
├── STANDARD
│   ├── amountCents
│   └── weight
└── HIGH
    ├── amountCents
    └── weight
```

`LOW`, `STANDARD`, and `HIGH` are aggregate represented sale-value *outcome*
bands for one attempted Bookstore sale — not a Product, SKU, book category,
merchandise-quality tier, or customer class. A `LOW` sale never means a cheap
book was represented, and a `HIGH` sale never means a premium product was
represented; the world represents only that this one aggregate attempted
sale carried a lower or higher economic value. There is still no product
catalogue, basket, or per-item price of any kind.

The seeded Branch configures `BOOKSTORE_BRANCH_SALE_VALUE_MIX`:
LOW = 1,200 cents at weight 30, STANDARD = 2,000 cents at weight 50, HIGH =
3,200 cents at weight 20. Weights are relative, not required percentages —
`selectBookstoreSaleValueBand` always normalizes against the current sum of
all three — but this seeded configuration uses whole percentage points
(30/50/20) for legibility, giving this configured *attempted*-sale
distribution an expected value of exactly $20.00:

```text
0.30 × $12.00 + 0.50 × $20.00 + 0.20 × $32.00 = $20.00
```

That statement describes only the configured distribution of attempted sale
values, before any downstream value-dependent refusal (below). It does not
mean realized completed-sale revenue must itself average $20.00, that a
represented hour's sales must average $20 each, or that the simulation
compensates after a run of LOW or HIGH outcomes. A selected HIGH attempt that
Retail Clearing cannot fund simply refuses — atomically, exactly like every
other refusal `executeBookstoreSale` already recognized — and is never
re-drawn, downgraded to a cheaper band, or compensated by a later draw.

`isValidBookstoreSaleValueMix` requires every band's `amountCents` to be a
positive safe integer and every band's `weight` to be a positive finite
number whose total is itself a positive finite number — the minimum a
well-defined weighted selection needs. An impossible configuration (a
non-finite/non-positive weight, a non-integer/non-positive amount, or a total
weight that overflows or collapses to zero) is never silently normalized,
clamped, or reinterpreted into something selectable, and never silently
falls back to `STANDARD`; sale execution refuses outright instead
(`invalid_sale_value_mix`, below), exactly the value-independent way the
retired `invalid_price` check used to.

`selectBookstoreSaleValueBand(mix, u)` selects exactly one band for one
normalized uniform value `u` in `[0, 1)`, walking cumulative weight
boundaries in fixed `LOW -> STANDARD -> HIGH` order — derived fresh from the
given mix's own weights, never hardcoded to the seeded 30/50/20. For the
seeded configuration this resolves exactly:

```text
u ∈ [0.00, 0.30) -> LOW
u ∈ [0.30, 0.80) -> STANDARD
u ∈ [0.80, 1.00) -> HIGH
```

`BookstoreCommerceState` also carries its own monotonic `nextSaleId`
allocator for runtime CompletedSale identity, following the existing
Transaction/Session allocation pattern (`bookstore-sale-0002`, `-0003`, ...)
— never derived from array length, time, or randomness.

V1 seeds exactly one such record, keyed to `bookstore-branch-01`:
`dollar-account-veyra-phone-v0` as current settlement configuration, and one
completed `book_sale` referencing `dollar-transaction-0001`, historically
authored as the `STANDARD` band.
`resolveBookstoreCommerceForBranch(state, branchId)` resolves this record for
one Branch, joined against current Civic-Dollar-owned Account and Transaction
truth, and returns `undefined` where a Branch has no such record at all — a
legitimate structural state, never an error. The resolved projection also
carries the record's current `saleValueMix` verbatim (no Civic Dollar join
needed for it) so presentation can show it without a second lookup.

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
sell and whether it is presently open — owned by
`GameState.bookstoreOperations` (`src/core/game/bookstoreOperations.ts`):

```text
BookstoreBranchOperationsRecord
├── branchId          — the Business Branch this record belongs to, by stable ID
├── shelfCapacity      — configuration-like: maximum sellable inventory this Branch can shelve
├── checkoutCapacity   — configuration-like: represented physical checkout positions
├── open               — mutable runtime: OPEN or CLOSED
└── currentInventory   — mutable runtime: current sellable inventory quantity
```

`shelfCapacity` and `checkoutCapacity` are configuration-like — how this
Branch is set up — while `open` and `currentInventory` are mutable runtime
truth; the shape keeps the two distinguishable rather than blending them.
`checkoutCapacity` represents only a count of physical/operational checkout
positions: it carries no customer-throughput, sales-per-hour, demand, timing,
or autonomous-sale meaning.

`createBookstoreBranchOperationsRecord` is the one sanctioned constructor for
this record and enforces, at construction, that `currentInventory` can never
be represented above `shelfCapacity`. V1 seeds exactly one such record for
`bookstore-branch-01`: shelf capacity 480, checkout capacity 2, OPEN, and 360
units of current inventory — conservative authored fixture values, not a
generation range, minimum/maximum, or economic tier. A different Bookstore
Branch varies purely through this same record's configuration/runtime values
(different capacities, inventory, or OPEN/CLOSED) — never through
branch-specific code, and never by branching on `bookstore-branch-01`'s
literal ID or display name.

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

The completed sale owns the business meaning "book sale," while Civic Dollar
exclusively owns the corresponding cents movement. Neither the Branch nor its
commerce record keeps a balance or shadow ledger; the record's Account and
Transaction IDs are stable references into Provider-owned finance truth.

The authored historical Transaction moves 2,000 cents — the `STANDARD` band
— from the neutral retail-clearing Account (`CD-9000-2000`) to the Account
initially configured at that historical moment (`CD-3318-2204`). Its
destination reference snapshot remains the sale's historical settlement
truth even if the commerce record's current `settlementAccountId` later
changes, and its authored `STANDARD` band remains that CompletedSale's
historical identity even if the current `saleValueMix` configuration later
changes: CompletedSale retains which band a sale represented, but never
duplicates the amount that band moved, and a later configuration change can
never rewrite an already-completed sale's band or Transaction. There is
exactly one authored initial sale; every other CompletedSale is the runtime
consequence of an explicit sale execution below, never rewritten or
re-priced.

That authored Transaction also carries a historical statement-context
snapshot (`docs/current/DOLLAR_FINANCE.md`) authored literally to match the
seeded Branch's initial `displayName`/`location` — `Bookstore Branch 01`,
`Retail sale`, `18 Mercer Street` — rather than derived dynamically from
current Business state, so the initial represented Wallet/business history
stays coherent with every later runtime sale's own snapshot.

### Sale execution

`executeBookstoreSale(state, branchId, bookstoreSaleValueRandom?)`
(`src/core/game/bookstoreSale.ts`) is the one canonical explicit state
transition that turns current Business Branch, Bookstore Operations,
Bookstore Commerce, Bookstore Backend and Civic Dollar truth into one
completed sale. It accepts only the Branch's stable ID and an optional
sale-value random source (defaulting to `Math.random` in production) —
never a value, an Account, a Device, a Service, or a capacity — and resolves
every other fact fresh from canonical state. One sale means exactly one
inventory unit, exactly one Civic Dollar Transaction moving exactly the
selected band's amount from Retail Clearing to the current settlement
Account, and exactly one appended CompletedSale retaining that band and
referencing the Transaction by stable ID.

Every value-independent prerequisite is checked first, before any sale-value
random sample is drawn: the Branch exists in canonical Business state;
Bookstore Operations exists for it, is `open`, and has `currentInventory > 0`
and `checkoutCapacity > 0`; Bookstore Commerce exists for it with a valid
`saleValueMix` (`isValidBookstoreSaleValueMix`, `invalid_sale_value_mix`
otherwise) and a settlement Account that resolves; Bookstore Backend exists
for it and its Device/Service resolve as currently available through the
existing backend resolver; and `dollar-account-retail-clearing-v0` resolves
and is distinct from the settlement Account. Only once every one of those
resolves does `executeBookstoreSale` draw exactly one sample from
`bookstoreSaleValueRandom` and select exactly one `LOW`/`STANDARD`/`HIGH`
band (`selectBookstoreSaleValueBand`) for this attempt. That selected band's
exact integer-cent amount is then used for the remaining amount-dependent
checks — Retail Clearing holds sufficient funds, and the resulting balances
stay exactly representable — and a refusal at this stage never re-draws,
never falls back to a cheaper band, and never compensates a later draw: a
selected `HIGH` attempt may refuse for insufficient funds where a `LOW`
attempt on the same balance would have succeeded. Every one of these checks
is preflighted before anything is committed, so a failed attempt always
returns the original pre-attempt `GameState` unchanged — there is no
partially applied sale, no inventory decrement without its Transaction, and
no Transaction without a CompletedSale. Backend unavailability (from either
the Device's operational truth or a closed Service) refuses the sale the
same way a CLOSED store or empty shelf does, without mutating Business,
Operations, Commerce, or Civic Dollar state, and without ever reaching
sale-value selection.

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
parameter, entirely independent from `credentialAccessRandom` and from the
sale-value channel below: none of the three mechanics ever share or advance
each other's random sequence merely because more than one happens to occur
within one `advanceGameState` call. This is a separate semantic channel and
test-injection point per mechanic, not a separate PRNG implementation:
production leaves every parameter at its default, and every default is the
same `Math.random`. No channel is a deterministic production random stream
— only test code substitutes a controlled function for any one of them.

`advanceBookstoreSalesCadence` (called from `advanceGameState` in
`gameAdvancement.ts`, ahead of the rest of canonical advancement) is the
canonical advancement for every represented cadence record. On each call it
chronologically partitions the given `elapsedMs` at each Branch's own
opportunity boundary: it advances the remainder of canonical state
(`advanceGameStateCore`, the same composition `advanceGameState` used before
this mechanic existed) up to exactly the next due instant, calls the existing
canonical `executeBookstoreSale(state, branchId, bookstoreSaleValueRandom)`
exactly once for that Branch, draws exactly one `bookstoreDemandRandom`
sample to schedule the next interval from the Branch's *current* effective
opportunity rate, and only then continues with whatever elapsed time is
left — so a due opportunity always observes the World/Business truth that
exists at its own due time, never truth from the start or the end of a
larger `elapsedMs` alone, and a large elapsed step correctly contains
multiple chronological opportunities rather than at most one. Demand
randomness is sampled only at that one moment, once per consumed
opportunity — never on an ordinary tick that leaves no opportunity due, and
never merely because `advanceGameState` was called — so browser tick
frequency cannot change how many random samples are consumed. The
`bookstoreSaleValueRandom` sample this same attempt may consume happens
inside `executeBookstoreSale` itself (above), a third, semantically
independent channel: it draws exactly once per attempt that reaches value
resolution, never here, and never for an attempt refused before value
resolution. A due opportunity is always consumed — whether
`executeBookstoreSale` sells or refuses — and the next interval is always
freshly sampled either way: cadence stores no missed opportunity, backlog,
waiting customer, retry, or lost-revenue state, and a prerequisite that
becomes valid again after a missed opportunity never triggers an immediate
retry or recovery burst.

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

- OPEN/CLOSED, current inventory relative to shelf capacity, and checkout
  capacity, only where that Branch has a represented operations record;
- `DEMAND OPPORTUNITIES` (opportunities/hour) and `ATTRACTIVENESS`, derived
  fresh from that Branch's sales-cadence record via the existing
  `deriveEffectiveBookstoreOpportunityRatePerHour`, only where that Branch has
  a represented sales-cadence record. Worded as opportunities rather than
  guaranteed sales, because OPEN/CLOSED, inventory, checkout, backend,
  settlement, and finance truth can still refuse any given opportunity.
  `remainingUntilOpportunityMs` is internal simulation timing, not
  player-facing Business information, and is never presented;
- current settlement Account reference and completed sale history, only
  where that Branch has a represented commerce record. Each recent sale
  presents its historical `LOW`/`STANDARD`/`HIGH` band alongside its real
  amount, read from the referenced Transaction's own `amountCents` — never
  re-derived from current configuration. This is the primary visible result
  of this mechanic: real completed sales now carry genuinely different real
  Dollar amounts, and every amount shown exists because that exact canonical
  money movement actually happened;
- a compact, subordinate `VALUE MODEL` summary of the current configured
  `saleValueMix` (each band's amount and its weight as a percentage of the
  current total), only where that Branch has a represented commerce record.
  This is deliberately minor technical/operator information — never a
  player-facing probability dashboard, chart, slider, or tuning control, and
  never more prominent than the real recent-sale amounts above; and
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

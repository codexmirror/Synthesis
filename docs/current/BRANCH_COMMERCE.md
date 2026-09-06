# Branch commerce

Status: Accepted
Scope: Current Company and Business Branch structural identity, the Branch's
explicit Network relationship, the concrete bookstore-commerce record attached
to the seeded Branch, completed-sale meaning, settlement configuration, and
the separate concrete bookstore-operations record (OPEN/CLOSED, current
inventory, shelf capacity, checkout capacity).

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

`BusinessBranchState` is deliberately generic structural identity only:

```text
BusinessBranchState
├── id             — stable Branch identity
├── displayName
├── companyId      — the owning Company, by stable identity
└── networkId      — the LocalNetwork this Branch explicitly operates through
```

It carries no settlement configuration, sale history, or any other concrete
commerce/operational field. The seeded Branch's `networkId` names the
existing foreign LocalNetwork (`network-foreign-001`, presented as
`remote-segment-01`) that also contains Petra's phone and `srv-02`.

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
└── completedSales        — completed book_sale history
```

V1 seeds exactly one such record, keyed to `bookstore-branch-01`:
`dollar-account-veyra-phone-v0` as current settlement configuration, and one
completed `book_sale` referencing `dollar-transaction-0001`.
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

### No universal Business archetype framework

Bookstore is the first concrete Business archetype; commerce and operations
are its own two narrow branch-linked records, not instances of a generic
Business-operations/archetype engine, registry, or rules system — none
exists. A future archetype (Laundry, Bank, ...) is expected to introduce its
own concrete branch-linked model(s) the same way, varying through its own
configuration/runtime data rather than seeded-identity dispatch. Generalizing
into a shared abstraction is deferred until multiple concrete
archetype implementations actually justify it; it is not implemented now and
is not implied by this pattern repeating twice.

## Sale and finance ownership

The completed sale owns the business meaning "book sale," while Civic Dollar
exclusively owns the corresponding 2,000-cent movement. Neither the Branch nor
its commerce record keeps a balance or shadow ledger; the record's Account and
Transaction IDs are stable references into Provider-owned finance truth.

The authored Transaction moves 2,000 cents from the neutral retail-clearing
Account (`CD-9000-2000`) to the Account initially configured at that historical
moment (`CD-3318-2204`). Its destination reference snapshot remains the sale's
historical settlement truth even if the commerce record's current
`settlementAccountId` later changes. The clearing Account has no Credential,
Financial Session, Device, or represented customer. There is exactly one
initial sale and no live, scheduled, recurring, or autonomous sale mechanic.

## RACK-OS presentation

RACK-OS 1.1 Business always lists a built-in `BUSINESS` application on its
Applications home, alongside Terminal, Files and System — regardless of
whether any Business Branch exists. Opening it resolves the operated Device's
structural Business context (`resolveBusinessOperatingContext`) and, for each
resolved Branch, separately composes that Branch's concrete commerce
(`resolveBookstoreCommerceForBranch`) and concrete operations
(`resolveBookstoreOperationsForBranch`) where either exists. RACK-OS only
composes and presents these three owners; it is not itself the canonical
owner of any of them.

Where no Branch resolves at all, BUSINESS truthfully states the resolved
Network context and that no Business is configured; this is legitimate
represented World Truth, not an error, a missing installation, or a hidden
Company. Where one or more Branches resolve, BUSINESS presents each Branch's
Company identity, Branch identity, and associated Network unconditionally,
and additionally presents:

- OPEN/CLOSED, current inventory relative to shelf capacity, and checkout
  capacity, only where that Branch has a represented operations record; and
- current settlement Account reference and completed sale history, only
  where that Branch has a represented commerce record.

Operations and commerce are presented fully independently of each other: a
structurally valid Branch with neither presents only its identity, with one
presents only that one's facts, and with both presents both — nothing invented
in place of a subsystem that is not represented. It exposes no internal
Account IDs, Credentials, Financial Sessions, balances, Player identity, or
unrelated World Truth.

RACK-OS 1.0 is the old technical section environment and provides no
application shell at all, so it presents no BUSINESS surface even where a
Branch's associated Network reaches the operated Device. Installing RACK-OS
1.1 Business creates no Company, Branch, commerce record, operations record,
financial state, or Network association of its own — it only makes the
built-in BUSINESS read surface available; whether that surface finds any
Business Branch, commerce record, or operations record is unrelated to the
Firmware.

Browsing changes no GameState, Discovery, Knowledge, finance, access, or
business state. Settlement editing/redirection and future sales are not
implemented.

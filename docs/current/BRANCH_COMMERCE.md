# Branch commerce

Status: Accepted
Scope: Current Company and Business Branch structural identity, the Branch's
explicit Network relationship, the concrete bookstore-commerce record attached
to the seeded Branch, completed-sale meaning, and settlement configuration.

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
framework: a different future concrete subsystem (distribution, inventory,
cameras, payments, storage, ...) would own its own separate branch-linked
record, keyed the same way by stable Branch ID, rather than extending this one
or being embedded on `BusinessBranchState`. None of those future systems are
implemented.

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
(`resolveBookstoreCommerceForBranch`) where one exists. RACK-OS only composes
and presents these two owners; it is not itself the canonical owner of
either.

Where no Branch resolves at all, BUSINESS truthfully states the resolved
Network context and that no Business is configured; this is legitimate
represented World Truth, not an error, a missing installation, or a hidden
Company. Where one or more Branches resolve, BUSINESS presents each Branch's
Company identity, Branch identity, and associated Network unconditionally, and
additionally presents current settlement Account reference and completed sale
history only where that Branch actually has a represented commerce record — a
structurally valid Branch with none presents its identity and nothing invented
in place of settlement or sales. It exposes no internal Account IDs,
Credentials, Financial Sessions, balances, Player identity, or unrelated World
Truth.

RACK-OS 1.0 is the old technical section environment and provides no
application shell at all, so it presents no BUSINESS surface even where a
Branch's associated Network reaches the operated Device. Installing RACK-OS
1.1 Business creates no Company, Branch, commerce record, financial state, or
Network association of its own — it only makes the built-in BUSINESS read
surface available; whether that surface finds any Business Branch or commerce
record is unrelated to the Firmware.

Browsing changes no GameState, Discovery, Knowledge, finance, access, or
business state. Settlement editing/redirection and future sales are not
implemented.

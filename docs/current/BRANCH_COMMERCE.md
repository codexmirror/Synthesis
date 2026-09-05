# Branch commerce

Status: Accepted
Scope: Current Company and Business Branch identity, the Branch's explicit
Network relationship, completed-sale meaning, and settlement configuration.

## Current world truth

V1 represents one persistent Company World Entity, `Bookstore`, and one
concrete Business Branch it owns, `Bookstore Branch 01`. Both have their own
stable identity, independent from each other and from any LocalNetwork,
Device, Firmware, InstalledSoftware, Civic Dollar Account, and the Player. The
Company has no represented owner, employees, hierarchy, or valuation; the
future ability to acquire a Company is accepted direction (`docs/FUTURE.md`),
not implemented truth. Neither the Company nor the Branch is a generic
Organization/Entity framework: `GameState.business` is a narrow
`{ companies, branches }` collection specific to this domain.

The Branch records `companyId` (its owning Company, by stable identity),
`networkId` (the LocalNetwork it explicitly operates through, by stable
identity), `dollar-account-veyra-phone-v0` as mutable settlement-destination
configuration, and one completed `book_sale` referencing
`dollar-transaction-0001`. The seeded Branch's `networkId` names the existing
foreign LocalNetwork (`network-foreign-001`, presented as `remote-segment-01`)
that also contains Petra's phone and `srv-02`.

The Branch → Network relationship is explicit Business-owned World Truth, not
derived from any Device's Network membership and not stored on `LocalNetwork`
itself. A Network may have zero, one, or multiple associated Branches, and a
Company may own multiple Branches; V1 seeds exactly one Company and one
Branch, but the domain shape does not assume a single result. There is no
`operationsDeviceId` relationship, and no InstalledSoftware requirement gates
whether the Branch exists or where its business context lives — BranchOps 1.0
and its Device-bound resolver are retired (`docs/current/NETWORK_ACCESS.md`,
`docs/current/DEVICE_SYSTEM.md`).

## Sale and finance ownership

The completed sale owns the business meaning "book sale," while Civic Dollar
exclusively owns the corresponding 2,000-cent movement. The Branch keeps no
balance or shadow ledger. Its Account and Transaction IDs are stable references
into Provider-owned finance truth.

The authored Transaction moves 2,000 cents from the neutral retail-clearing
Account (`CD-9000-2000`) to the Account initially configured at that historical
moment (`CD-3318-2204`). Its destination reference snapshot remains the sale's
historical settlement truth even if the Branch's current `settlementAccountId`
later changes. The clearing Account has no Credential, Financial Session,
Device, or represented
customer. There is exactly one initial sale and no live, scheduled, recurring,
or autonomous sale mechanic.

## RACK-OS presentation

RACK-OS 1.1 Business always lists a built-in `BUSINESS` application on its
Applications home, alongside Terminal, Files and System — regardless of
whether any Business Branch exists. Opening it resolves the operated Device's
actual represented LocalNetwork membership
(`resolveBusinessOperatingContext`, `src/core/game/business.ts`), then the
Business Branch(es) explicitly associated with those Networks by their own
`networkId` reference. This read never grants `NetworkManagementAuthority`,
DeviceAccess, Discovery, or Knowledge, and it never requires the operated
Device to be any Branch's "operations host" — that relationship no longer
exists.

Where no associated Branch resolves, BUSINESS truthfully states the resolved
Network context and that no Business is configured; this is legitimate
represented World Truth, not an error, a missing installation, or a hidden
Company. Where one or more Branches resolve, BUSINESS presents each Branch's
Company identity, Branch identity, associated Network, current settlement
Account's Provider-scoped reference, and existing completed sale history with
its historical settled-to reference. It exposes no internal Account IDs,
Credentials, Financial Sessions, balances, Player identity, or unrelated World
Truth.

RACK-OS 1.0 is the old technical section environment and provides no
application shell at all, so it presents no BUSINESS surface even where a
Branch's associated Network reaches the operated Device. Installing RACK-OS
1.1 Business creates no Company, Branch, sale, financial state, or Network
association of its own — it only makes the built-in BUSINESS read surface
available; whether that surface finds any Business Branch is unrelated to the
Firmware.

Browsing changes no GameState, Discovery, Knowledge, finance, access, or
business state. Settlement editing/redirection and future sales are not
implemented.

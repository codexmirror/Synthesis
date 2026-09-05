# Branch commerce

Status: Accepted
Scope: Current bookstore-branch identity, branch operations, completed-sale meaning, and settlement configuration.

## Current world truth

V1 represents exactly one concrete business, `Bookstore Branch 01`, with its
own stable identity. The branch is not a generic Company or Organization and
has no represented owner, employees, hierarchy, valuation, or autonomous
routine. Its identity is independent from its Device, Network, Civic Dollar
Account, Petra, and the Player.

The branch records `srv-02` by stable Device ID as its operations server,
`dollar-account-veyra-phone-v0` as mutable settlement-destination configuration,
and one completed `book_sale` referencing `dollar-transaction-0001`.

`srv-02` separately owns an ordinary InstalledSoftware snapshot for BranchOps
1.0. BranchOps is neither RACK-OS Firmware, Device identity, a filesystem
artifact, nor branch state. No package, installation route, Service, Process,
license, or update release is represented for it.

## Sale and finance ownership

The completed sale owns the business meaning “book sale,” while Civic Dollar
exclusively owns the corresponding 2,000-cent movement. The branch keeps no
balance or shadow ledger. Its Account and Transaction IDs are stable references
into Provider-owned finance truth.

The authored Transaction moves 2,000 cents from the neutral retail-clearing
Account (`CD-9000-2000`) to the Account initially configured at that historical
moment (`CD-3318-2204`). Its destination reference snapshot remains the sale's
historical settlement truth even if the branch's current `settlementAccountId`
later changes. The clearing Account has no Credential, Financial Session,
Device, or represented
customer. There is exactly one initial sale and no live, scheduled, recurring,
or autonomous sale mechanic.

## RACK-OS presentation

An authorized RACK-OS Session operating the actual BranchOps host exposes a
read-only `OPERATIONS` section. It presents the branch name, BranchOps release,
recent book sale amount, and settlement Account's Provider-scoped reference.
It exposes no internal Account IDs, Credentials, Financial Sessions, balances,
Player identity, or unrelated World Truth. A Device that is not the configured
operations host, or no longer hosts the represented BranchOps build, gets no
business surface.

Browsing changes no GameState, Discovery, Knowledge, finance, access, or
business state. Settlement editing/redirection and future sales are not
implemented.

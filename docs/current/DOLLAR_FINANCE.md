# Dollar Finance — current truth

Status: Accepted
Scope: The implemented Dollar Financial Provider, its Accounts, Credentials, authentication, Financial Sessions, transfers, Transactions and activity, the Device's saved sign-in, and the Dollar client presented in Wallet.

This document is the normative owner of current implemented Dollar finance truth. Durable separation rules belong to A18; the selected identity and authority model belongs to `docs/design/DOLLAR_FINANCIAL_PROVIDER_V1.md`, and the selected transfer, Transaction, activity and client model to `docs/design/DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md`.

## Canonical state

`GameState.dollarFinance` represents exactly one concrete Provider, Civic Dollar. It directly owns Provider identity and display name, Financial Accounts, Credentials, active Financial Sessions, and Transactions; there is no provider registry or generic financial-access layer.

A Financial Account has a stable internal ID, a distinct Provider-scoped account reference, and an integer `balanceCents`. Initial state contains exactly one Account with 125000 cents ($1,250.00) and no Transaction, because no transfer has happened in the represented world. The Account ID is distinct from Player, Device, Credential, login, Session, Transaction, and account-reference identity.

One Credential has its own stable ID, references the Account by stable Account ID, and carries an exact login identifier and password as Provider World Truth. Credential material is not authority and is not player knowledge.

The player's local Device separately owns `savedDollarSignIn`: its own stored label, login identifier and password copy. It is Device state, not Provider state — the two begin with the same literal values and diverge independently. Holding it is not authority, it is not implied by a Session, and no Session is implied by it. A Device that represents none has no saved path at all.

## Authentication and authority

`authenticateDollarAccount` accepts a represented client Device ID and exact login identifier/password. Unknown logins and wrong passwords both return `invalid_credentials`; invented Devices return `device_not_found`, and a Credential whose Account cannot resolve returns `account_unavailable`. Failures preserve all existing state, including an existing valid Session.

Success allocates a fresh deterministic Session ID, removes only a prior Session for the same Device, and creates one Device-bound Session authorizing exactly the Credential's Account. Other Devices' Sessions remain. Thus one Device has at most one Session for this Provider while multiple Devices may independently authorize the same Account.

`authenticateDollarAccountWithSavedSignIn` submits only what the acting Device stored, through that same operation, and returns its result — or `no_saved_sign_in` where the Device saved nothing. It never reads the Provider's current Credential, so a saved copy that no longer matches simply returns `invalid_credentials` like any other wrong password.

`logoutDollarAccount` removes only the acting Device's Session and otherwise returns `not_signed_in` without changing state. Authentication and logout are immediate transitions: neither creates a Process or modifies Accounts, balances, Credentials, Transactions, saved sign-in, DeviceAccess, RemoteSession, NODE Wallet, or NODE Economy.

Account resolution fails closed and follows only:

```text
represented Device -> exactly one active Financial Session -> stable Account ID -> Financial Account
```

Player identity, DeviceAccess, RemoteSession, saved sign-in, the first Account, and NODE state provide no fallback authority.

Switching Accounts is exactly this authentication, nothing more: a successful sign-in to another Account replaces the acting Device's Session, so that Device now resolves the other Account. No Account is created, deleted or re-owned, and the previous Account's balance, Credential and Transactions are unchanged.

## Transfers and Transactions

`transferDollars` accepts a client Device ID, a recipient account reference and integer `amountCents`. The source Account is derived from that Device's Financial Session and is not a parameter, so no caller can name whose money moves.

It refuses, changing nothing at all, with `not_signed_in` (no Session, an invented Device, or a dangling Session), `invalid_amount` (non-integer, zero, negative, or an amount whose credit would leave exact integer range), `recipient_not_found`, `recipient_ambiguous` (more than one Account carries the reference), `recipient_is_source`, or `insufficient_funds`. Checks run in that order and every refusal returns the original state object.

On `transferred` it debits the source and credits the recipient by exactly `amountCents` in one state transition and appends exactly one Transaction. Unrelated Accounts, Credentials, Sessions, saved sign-in, Processes, NODE Wallet and NODE Economy are untouched. There is no Process, delay, settlement, pending state, fee, overdraft or reversal.

A Transaction carries a stable monotonic ID (`dollar-transaction-0001`, following the Authentication History pattern), the source and destination stable Account IDs, the integer `amountCents`, and a snapshot of each side's account reference as it was at the moment of the transfer. The snapshots exist because an account reference is a mutable attribute: renaming an Account afterwards changes nothing about historical activity. Transactions carry no timestamp, no Device, no Session and no Credential material; ordering is canonical insertion order, and records are retained without eviction.

`projectDollarAccountActivity` derives one Account's activity from those Transactions, newest first: outgoing amounts negative with the destination reference snapshot as counterparty, incoming amounts positive with the source reference snapshot. It exposes no other Account's balance, no Credential, no Device, no Session and no internal Account ID, and an Account with no Transactions has no activity.

## Wallet presentation

The combined NODE-OS Wallet remains presentation over two independent domains. `Wallet` composes the Dollar client (`src/apps/wallet/DollarClient.tsx`) above a separate NODE section, and `src/apps/wallet/wallet.css` owns the Wallet's application-specific layout inside the shared NODE-OS language. Which Dollar surface is open is presentation state held by `Wallet`; it never reaches `GameState`.

Signed in, the client's dashboard leads with the provider display name, the cents-formatted balance as the visual subject, and the account reference, then SEND and ACCOUNT, then activity or an explicit empty state. There is no separate status row: a visible account is what signed in means.

SEND enters a recipient reference and a human-readable amount, then reviews the exact formatted amount, destination and source before anything moves; confirming calls `transferDollars` and returns to the dashboard, where the new balance and the new activity row both derive from canonical state. Refusals are stated in product wording rather than operation statuses and leave money untouched. `parseDollarAmountToCents` converts input at the boundary — whole dollars and one or two fractional digits, optionally `$`-prefixed and space-padded — and refuses anything else, so no floating-point Dollar reaches the domain and no typed string enters `GameState`.

ACCOUNT states the current account reference, provider and balance, offers the Device's saved sign-in by its represented label and login identifier, keeps manual login available as the secondary path into any other Account, and exposes SIGN OUT. A stale saved sign-in reports that it no longer works rather than signing in. Signed out, the same saved and manual paths remain and no Account balance or reference is presented. Passwords, Credentials and Session identity are never projected into any of these surfaces, and SEND and ACCOUNT put the NODE section away while they are open.

NODE balance, payout address, activity, mining, recipients, formatting, and authority remain independently owned by `NODE_ECONOMY.md` and are unchanged by Dollar authentication, logout or transfers.

# Dollar Finance — current truth

Status: Accepted
Scope: The implemented Dollar Financial Provider, its Accounts, Credentials, authentication, Financial Sessions, transfers, Transactions and activity, the Device's saved sign-in, and the Dollar client presented in Wallet.

This document is the normative owner of current implemented Dollar finance truth. Durable separation rules belong to A18; the selected identity and authority model belongs to `docs/design/DOLLAR_FINANCIAL_PROVIDER_V1.md`, the selected transfer, Transaction, activity and client model to `docs/design/DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md`, and the selected Wallet presentation direction to `docs/design/NODE_OS_WALLET_PRODUCT_POLISH_V1.md`.

## Canonical state

`GameState.dollarFinance` represents exactly one concrete Provider, Civic Dollar. It directly owns Provider identity and display name, Financial Accounts, Credentials, active Financial Sessions, and Transactions; there is no provider registry or generic financial-access layer.

A Financial Account has a stable internal ID, a distinct Provider-scoped account reference, and an integer `balanceCents`. Initial state contains exactly four ordinary Accounts: the player's `dollar-account-local-v0` / `CD-1042-7781` with 125000 cents ($1,250.00); the separately phone-accessible `dollar-account-veyra-phone-v0` / `CD-3318-2204` with 34250 cents ($342.50), which the represented VEYRA phone's Session authorizes; the neutral retail-clearing `dollar-account-retail-clearing-v0` / `CD-9000-2000` with 80000 cents ($800.00); and the dedicated `dollar-account-bookstore-treasury-v0` / `CD-4827-6109`, which begins with 0 cents and is currently referenced independently by the Bookstore Company's Treasury designation and the Branch's settlement configuration. The dedicated Treasury Account has no Credential, Financial Session, saved sign-in, Device, or Player relationship. All are ordinary Provider Accounts; none is owned by a Device, by NODE-OS, by VEYRA, by a Company, or by a branch. An Account ID is distinct from Player, Device, Credential, login, Session, Transaction, and account-reference identity.

Initial state also contains one authored 2,000-cent Transaction, `dollar-transaction-0001`, from the retail-clearing Account into the phone-authorized Account. Allocation continues at `dollar-transaction-0002`. Finance owns this generic historical movement; the branch domain alone owns its book-sale meaning. This authored Transaction also carries a historical statement-context snapshot (below), authored literally to match the seeded Bookstore Branch's initial identity rather than derived dynamically from current Business state.

One Credential has its own stable ID, references the player's Account by stable Account ID, and carries an exact login identifier and password as Provider World Truth. Credential material is not authority and is not player knowledge. The phone's Account has no represented Credential and the phone stores no saved sign-in: nothing implemented requires either, and neither is implied by the Account or by the Session. Authentication is consequently not currently possible into that Account, which is a statement about what is represented rather than a rule.

Initial state contains two active Financial Sessions, one per Device: `dollar-session-0001` binds the local Device to the player's Account, and `dollar-session-0002` binds `host-phone-001` to the phone's Account. A Device having a Session is what makes an Account resolvable on it, and it is why the phone's Wallet can be opened at all.

The player's local Device separately owns `savedDollarSignIn`: its own stored login identifier and password copy, plus the stable `accountId` of the Financial Account that material was saved for. It is Device state, not Provider state — the login and password begin with the same literal values as the Credential and diverge independently. The `accountId` records intent, not authority: it is not ownership, not a Session, not Credential or Player identity, and it is never submitted to the Provider. Holding a saved sign-in is not authority, it is not implied by a Session, and no Session is implied by it. A Device that represents none has no saved path at all.

## Authentication and authority

`authenticateDollarAccount` accepts a represented client Device ID and exact login identifier/password. Unknown logins and wrong passwords both return `invalid_credentials`; invented Devices return `device_not_found`, and a Credential whose Account cannot resolve returns `account_unavailable`. Failures preserve all existing state, including an existing valid Session.

Success allocates a fresh deterministic Session ID, removes only a prior Session for the same Device, and creates one Device-bound Session authorizing exactly the Credential's Account. Other Devices' Sessions remain. Thus one Device has at most one Session for this Provider while multiple Devices may independently authorize the same Account.

`authenticateDollarAccountWithSavedSignIn` submits only the login identifier and password the acting Device stored, through that same operation, and returns `no_saved_sign_in` where the Device saved nothing. It never reads the Provider's current Credential, so a saved copy that no longer matches simply returns `invalid_credentials` like any other wrong password.

A credential match is accepted only when the Session it produced resolves exactly the saved `accountId`. Because a login identifier is a mutable attribute, the Provider could later associate the saved material with a different Account; that must not silently redirect the saved personal sign-in. It then fails closed to the same `invalid_credentials` and the original pre-attempt state — no Session is created or replaced, the refusal carries nothing beyond that status, and no Account, Credential, Transaction or NODE state changes.

`logoutDollarAccount` removes only the acting Device's Session and otherwise returns `not_signed_in` without changing state. Authentication and logout are immediate transitions: neither creates a Process or modifies Accounts, balances, Credentials, Transactions, saved sign-in, DeviceAccess, RemoteSession, NODE Wallet, or NODE Economy.

Account resolution fails closed and follows only:

```text
represented Device -> exactly one active Financial Session -> stable Account ID -> Financial Account
```

Player identity, DeviceAccess, RemoteSession, saved sign-in, the first Account, and NODE state provide no fallback authority.

Switching Accounts is exactly this authentication, nothing more: a successful sign-in to another Account replaces the acting Device's Session, so that Device now resolves the other Account. No Account is created, deleted or re-owned, and the previous Account's balance, Credential and Transactions are unchanged.

## Transfers and Transactions

The canonical Account-to-Account movement itself — source/destination exist and differ, the amount is a positive safe integer, funds suffice, the resulting balances stay exactly representable, exactly one Transaction is allocated and appended, and debit/credit happen together — is owned by `executeCivicDollarMovement(state, sourceAccountId, destinationAccountId, amountCents)`. It carries no opinion about who is allowed to move whose money and performs no reaction of its own; it is not a new player-facing transfer path, since nothing routes an arbitrary interface caller to it directly. A narrow internal domain caller that already holds both Accounts' stable identity (the Bookstore sale, `docs/current/BRANCH_COMMERCE.md`, is the current example) may call it directly with both Account IDs.

`transferDollars` accepts a client Device ID, a recipient account reference and integer `amountCents`. The source Account is derived from that Device's Financial Session and is not a parameter, so no caller can name whose money moves. It resolves the recipient Account by exact reference, then calls `executeCivicDollarMovement` for the movement itself; the Device → Financial Session → Account authority chain and the recipient-reference resolution stay entirely at this layer, never moved into the lower-level primitive.

It refuses, changing nothing at all, with `not_signed_in` (no Session, an invented Device, or a dangling Session), `invalid_amount` (non-integer, zero, negative, or an amount whose credit would leave exact integer range), `recipient_not_found`, `recipient_ambiguous` (more than one Account carries the reference), `recipient_is_source`, or `insufficient_funds`. Checks run in that order and every refusal returns the original state object.

On `transferred` it debits the source and credits the recipient by exactly `amountCents` in one state transition and appends exactly one Transaction. Unrelated Accounts, Credentials, Sessions, saved sign-in, Processes, NODE Wallet and NODE Economy are untouched. There is no Process, delay, settlement, pending state, fee, overdraft or reversal.

Once that Transaction exists, the concrete transfer from Petra's phone Account
to the player's Account immediately causes the separate Petra Company Chat
reaction owned by the communication domain. Finance does not own the message,
and a refusal creates neither a Transaction nor a reaction. The qualifying
rule uses the Transaction's stable source and destination Account IDs; see
`docs/current/COMMUNICATION.md` for the authored and idempotent communication.
That complaint also starts the separate delayed Technician response; the
Transaction remains finance-owned evidence and neither the response timing nor
its Device-security consequence belongs to finance. This reaction is resolved
only by `transferDollars` itself, at its existing semantic layer — the lower
`executeCivicDollarMovement` primitive never calls it, so a Bookstore sale
built on the same movement invariant acquires no unrelated Petra reaction
semantics merely by using it.

A Transaction carries a stable monotonic ID (`dollar-transaction-0001`, following the Authentication History pattern), the source and destination stable Account IDs, the integer `amountCents`, and a snapshot of each side's account reference as it was at the moment of the transfer. The snapshots exist because an account reference is a mutable attribute: renaming an Account afterwards changes nothing about historical activity. Transactions carry no timestamp, no Device, no Session and no Credential material; ordering is canonical insertion order, and records are retained without eviction.

A Transaction may additionally carry one small optional `statementContext` snapshot — `{ description?, purpose?, location? }`, every field a fixed human-readable string — supplied only by the domain operation that creates the movement, never invented by Civic Dollar itself. `executeCivicDollarMovement(state, sourceAccountId, destinationAccountId, amountCents, statementContext?)` accepts this as its one additional optional parameter and stores it on the Transaction verbatim, exactly once, at creation; it never constructs, infers, re-derives, or live-resolves one, and understands nothing about what a Bookstore or a Business Branch is. `transferDollars` never supplies one, so an ordinary transfer's Transaction has no `statementContext` at all, exactly as before this shape existed. The Bookstore sale (`docs/current/BRANCH_COMMERCE.md`) is the current caller that supplies one, snapshotting the Branch's current `displayName`/`location` plus a fixed `Retail sale` purpose at the moment of the sale. This is a narrow financial-history shape, not a generic `metadata: Record<string, string>` bag or an event framework, and it never replaces or duplicates the actual financial counterparty reference: `sourceAccountReference`/`destinationAccountReference` remain the sole real financial-counterparty truth, and `statementContext.description` is a separate historical fact about what the movement represented, not who the counterparty was.

`transferDollarsFromOperatedRemoteDevice` is the same operation acted by a Device the player is currently operating through a Remote Session. It adds no financial rule and no authority: it resolves the acting Device from the active Session's own `accessId` → target relationship, then calls `transferDollars`, which still derives the source Account from that Device's Financial Session. A caller therefore still cannot name whose money moves; with no Session it returns `session_unavailable`, and with a Session over a Device that has no Financial Session it returns the ordinary `not_signed_in`. A Remote Session is operating context, not financial authority: it decides which Device acts and grants no Account. `resolveDollarAccountForOperatedRemoteDevice` is the read-only counterpart used by a client running on that Device.

`projectDollarAccountActivity` derives one Account's activity from those Transactions, newest first: outgoing amounts negative with the destination reference snapshot as counterparty, incoming amounts positive with the source reference snapshot. It exposes no other Account's balance, no Credential, no Device, no Session and no internal Account ID, and an Account with no Transactions has no activity. Where the underlying Transaction carries a `statementContext`, the entry carries that same context through unchanged; where it does not, the entry has no `statementContext` at all. The projection never resolves Business or any other domain state to construct or supplement one — it only ever repeats what the Transaction itself already stored.

## Initial branch-sale finance truth

The Business domain may refer to an Account's stable identity to designate a
Company treasury (`docs/current/BRANCH_COMMERCE.md`). That role is not Account
ownership or financial authority. Civic Dollar remains the sole owner of the
actual Account identity, current account reference, balance, Transactions,
Credentials, and Financial Sessions; Business duplicates none of them. A
treasury resolver joins the stable designation to current Account truth and
fails closed when that Account does not exist. It does not consult or create a
Player or Device Financial Session.

The Provider's neutral retail-clearing Account has no
Credential, Session, Device, or customer identity. One authored historical
Transaction (`dollar-transaction-0001`) moves 2,000 cents from its
`CD-9000-2000` reference into `dollar-account-veyra-phone-v0` at
`CD-3318-2204`. The destination retains its intended current 34,250-cent
balance; the clearing source's current balance is 80,000 cents. Transaction
allocation therefore begins at `dollar-transaction-0002`.

This authored Transaction also carries a `statementContext` snapshot of
`{ description: 'Bookstore Branch 01', purpose: 'Retail sale', location: '18 Mercer Street' }`
— literal values authored to match the seeded Bookstore Branch's initial
identity (`docs/current/BRANCH_COMMERCE.md`), never derived dynamically from
current Business state at construction time. This keeps the initial
represented Wallet/business history coherent with every later runtime
Bookstore sale's own snapshot.

Finance owns only this generic movement. The bookstore sale meaning and
settlement configuration are owned by
[`BRANCH_COMMERCE.md`](BRANCH_COMMERCE.md). Because the VEYRA phone's existing
Financial Session authorizes the destination Account, ordinary Account activity
naturally projects the incoming $20.00 without special Wallet metadata.

This same retail-clearing Account is now also the neutral aggregate Civic
Dollar payment source a Bookstore sale execution moves from
(`docs/current/BRANCH_COMMERCE.md`): a finite, ordinary Account with a real
balance, never magically replenished and never exempt from ordinary balance
rules. A sale that would overdraw it simply fails, leaving finance state
unchanged, exactly like any other insufficient-funds refusal.

## Wallet presentation

The combined NODE-OS Wallet remains presentation over two independent domains. `Wallet` composes the Dollar client above a separate NODE section, and `src/apps/wallet/wallet.css` owns the Wallet's application-specific layout inside the shared NODE-OS language. The client is split by surface ownership: `src/apps/wallet/DollarClient.tsx` resolves the Account and owns the dashboard, `src/apps/wallet/DollarSend.tsx` owns SEND and its review, `src/apps/wallet/DollarAccess.tsx` owns ACCOUNT, the signed-out surface and both sign-in paths, and `src/apps/wallet/walletControls.tsx` holds the controls all of them compose. Which surface is open is still held by one component and the split is presentational only: no surface owns finance truth, and every money movement and sign-in still goes through the same shared domain operation. Which Dollar surface is open — dashboard, SEND, RECEIVE or ACCOUNT — is presentation state held by `Wallet`; it never reaches `GameState`. The selected presentation direction is owned by `docs/design/NODE_OS_WALLET_PRODUCT_POLISH_V1.md`.

Signed in, the dashboard leads with a Dollar hero module carrying the provider display name, the cents-formatted balance as the visual subject, the account reference with a copy affordance, and — only where the current Account is this Device's saved `accountId` — that it is the personal account. Beneath it a compact action strip presents SEND, RECEIVE and ACCOUNT as icon-and-label tiles aligned as one system, then activity or an explicit empty state. There is no separate status row: a visible account is what signed in means. There is no SCAN control, because no Civic QR payment request, financial QR identity, finance scanner or Scan-authorized transfer is represented.

The hero also presents a balance trajectory derived on render by `src/apps/wallet/balanceTrajectory.ts` from the current authorized balance and the canonical Transactions that Account is part of, by undoing each Transaction backwards from the current balance. It represents balance across represented Transaction sequence, never balance over clock time: Transactions carry no timestamp, so it carries no time axis, no range selector, no sampling and no percentage-change claim. An Account with N Transactions has exactly N+1 represented balance states; with one state there is nothing to draw and no line is rendered. Nothing derived is persisted and no trajectory state exists in `GameState`.

Activity rows present the direction mark, the historical counterparty reference, `SENT` or `RECEIVED`, and the signed amount. Where the underlying Transaction carries an optional `statementContext` snapshot (the Bookstore sale is the current example), the row additionally presents that context: `description` becomes the row's human subject, and `purpose`/`location` sit beneath it as secondary detail — the counterparty reference and direction word remain visible on their own line rather than being replaced, because they are the actual financial facts. A Transaction with no `statementContext` keeps exactly the prior compact two-line row. No timestamp, category, avatar, status, fee or invented memo is ever added, and no context is ever fabricated for a Transaction that does not carry one — the row presents only what the canonical projection actually holds. The rows share one module and are separated by a hairline rather than each being a bordered list row of its own, and direction is carried by the mark, the wording and the explicit sign together, so it survives without colour. With no Transactions the same module states the empty case as a recessed panel instead of a bordered box.

The VEYRA phone's own consumer Wallet (`docs/current/VEYRA_OS.md`) presents the same optional statement context in its own consumer visual language: `description` as the row's lead, `purpose`/`location` beneath it, and the direction word plus counterparty reference on their own line. It surfaces the authored historical Bookstore sale because that Transaction actually settled to the phone-accessible Account. New runtime sales instead follow the Branch's current settlement configuration into the dedicated Treasury Account, so they do not appear in the phone Wallet. The phone continues to resolve only `dollar-account-veyra-phone-v0` through its independent Device-bound Financial Session and gains no Treasury access.

SEND leads with the amount, then the recipient reference, then a module stating the source account reference, provider and available balance. The amount is entered at the amount's own scale on a recessed plate whose currency mark is drawn by the surface rather than typed into it, so an empty entry presents as a money field rather than as placeholder text; the entry itself is an ordinary controlled `input`. It reviews the exact formatted amount, destination and source before anything moves; confirming calls `transferDollars` and returns to the dashboard, where the new balance, the new activity row and the extended trajectory all derive from canonical state. The filled treatment marks the primary consequential action of a focused surface — CONFIRM & SEND here, and the saved-sign-in CONTINUE on the Account and signed-out surfaces — while opening a decision rather than making one stays secondary, so REVIEW is an outlined action. Refusals are stated in product wording rather than operation statuses and leave money untouched. `parseDollarAmountToCents` converts input at the boundary — whole dollars and one or two fractional digits, optionally `$`-prefixed and space-padded — and refuses anything else, so no floating-point Dollar reaches the domain and no typed string enters `GameState`. No fee, total, settlement, estimated arrival, transfer speed, security guarantee or asynchronous processing is presented, because none is represented.

RECEIVE presents the currently authorized Account reference, the provider name, a copy affordance and concise explanatory copy, and nothing else. The reference is the module's subject and the copy affordance is that module's footer control; copying reports its own success for about a second and a half as local Presentation state, which states nothing about the Account, the Provider or anything the world represents. It is presentation over Account truth the client already resolves: it creates no payment request, invoice, QR code, amount request, receiving Session, Transaction or incoming money, calls no domain operation, and changes no canonical state by being opened or left.

ACCOUNT presents the current Account as one identity module — a provider monogram projected from the represented display name, the account reference, the provider, and the balance — plus `Personal account` where the current Account is the saved one. It carries no Account status marker: a visible authorized Account is already what signed in means, and the Provider represents no Account status for one to state. It keeps manual login available as the secondary path into any other Account — presented as a recessed group beneath the raised identity module, so it stays discoverable and fully usable without competing with the current Account — and exposes SIGN OUT as a secondary destructive control rather than a finance action. The saved personal path is offered only where it actually leads somewhere: when the current Account is already the saved `accountId` the surface says so and shows no CONTINUE, and when another Account is current — or the Device is signed out — it presents PERSONAL ACCOUNT with the saved login identifier and CONTINUE. That distinction derives from stable Account identity and Session truth; there is no stored personal, current or signed-in flag. A stale saved sign-in reports that it no longer works rather than signing in. Signed out, the client keeps a composed hero stating the provider and that it is signed out, the same saved and manual paths remain, and no Account balance, reference or activity is presented. Passwords, Credentials and Session identity are never projected into any of these surfaces, and SEND, RECEIVE and ACCOUNT each put the NODE section away while they are open.

Iconography is inline `currentColor` line art owned by `src/apps/wallet/WalletIcon.tsx`, drawn the same way the Shell draws application icons: one 24-unit grid, one stroke weight, one cap and joint, so the three action marks read as a single family. No icon dependency was added, every icon is `aria-hidden` beside a real text label, and none marks a capability the world does not represent. The Wallet consumes the Shell-owned Editing presentation and adds no viewport reading, keyboard-height logic, focus management or scroll manipulation of its own.

There are now two clients over this one domain, and neither owns any of it. The NODE-OS Wallet above is bound to the local Device. The VEYRA phone's Wallet is bound to the Device the player is currently operating and resolves its Account through that Device's Financial Session; its presentation belongs to `docs/current/VEYRA_OS.md`. Operating a foreign phone changes nothing about the local Wallet, and a transfer made from either client is the same canonical `transferDollars`, producing exactly one Transaction that both clients then observe as ordinary Account activity.

NODE balance, payout address, activity, mining, recipients, formatting, and authority remain independently owned by `NODE_ECONOMY.md` and are unchanged by Dollar authentication, logout or transfers.

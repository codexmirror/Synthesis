# DOLLAR TRANSFERS AND FINANCE CLIENT V1

Status: Accepted
Scope: Design authority for the first Dollar money movement — the transfer
operation, canonical Transaction truth and Account activity — and for the
Device-side Finance client that performs it: saved sign-in, Account switching,
and the Dollar client surfaces. It is a design contract, not a description of
what is currently implemented.
Normative owner of current implemented behavior: `../current/DOLLAR_FINANCE.md`.

## Status and purpose

[`DOLLAR_FINANCIAL_PROVIDER_V1.md`](DOLLAR_FINANCIAL_PROVIDER_V1.md) is the
accepted foundation contract and remains the authority for Financial Account,
Credential and Financial Session identity and authority semantics. It
deliberately excluded transfers, Transactions, activity, saved sign-in and
client behavior (its sections 12 and 13). This document selects those, and only
those.

It references the foundation rather than restating it. Where the two appear to
disagree, the foundation wins on identity and authority; this document wins on
transfer, Transaction, activity and client semantics.

Durable economic invariants stay in
[`../architecture/ECONOMY_AND_WALLETS.md`](../architecture/ECONOMY_AND_WALLETS.md)
(A18).


## 1. What this slice adds

```text
CLIENT DEVICE
  → its one Financial Session          (foundation, unchanged)
  → source Financial Account
  → recipient Account reference
  → integer amountCents
  → TRANSFER
       ├── atomic debit and credit
       └── exactly one canonical Transaction

FINANCIAL ACCOUNT
  → ACTIVITY, derived from Transactions

CLIENT DEVICE
  → saved sign-in material            (Device-owned, new)
  → CONTINUE / manual sign-in / sign out
  → Account switching by ordinary authentication
```

Nothing here adds a second authority concept. The Financial Session remains the
only thing that authorizes a Dollar Account operation.


## 2. The transfer operation

One immediate operation moves Dollars between two Financial Accounts of the one
concrete Provider.

Its inputs are, conceptually:

- the acting client Device;
- a recipient Account reference;
- a positive integer amount in cents.

> The source Account is derived from the acting Device's Financial Session. It
> is never an input.

This is the load-bearing rule of the slice. A caller that could name the source
Account would be a second authority path, which the foundation forbids
(section 5 there). Presentation therefore cannot choose whose money moves, and a
foreign Device holding a Session over a foreign Account operates that Account —
and only that Account — through exactly the same operation.

The transfer requires all of:

- a concretely represented client Device;
- exactly one valid Financial Session for that Device;
- a source Account that Session resolves;
- exactly one Account matching the supplied Provider-scoped reference;
- a positive, exactly representable integer cent amount;
- sufficient source balance;
- distinct source and recipient Accounts.

It fails closed on anything else: no Session, a dangling Session, an unresolvable
recipient, an **ambiguous** recipient, a self-transfer, a zero, negative or
unrepresentable amount, or insufficient funds. Ambiguity is refused, never
resolved by picking a candidate (A18, and foundation section 3).

On success, and only on success:

- exactly `amountCents` leaves the source;
- exactly `amountCents` reaches the recipient;
- exactly one Transaction is appended;
- every unrelated Account, every Credential, every Session, and all NODE state
  are untouched.

Either the whole mutation happens or none of it does. There is no partial
mutation on any refusal.

Out of scope, and not to be added by implementation: a Process, an artificial
delay, settlement, pending state, fees, overdraft, reversal, merchant routing,
scheduled or recurring transfers, and any external network or API.


## 3. Transactions

A Transaction is represented truth that one transfer actually happened. It is
owned by the Provider, not by a Device, an interface or the Player (foundation
section 12).

It carries the minimum that correct activity needs:

- stable Transaction identity;
- the source Account's stable ID;
- the destination Account's stable ID;
- the integer `amountCents` moved;
- a historical snapshot of the user-facing account reference on **each** side.

The snapshot exists because an Account reference is a mutable attribute, not
identity (A01). Historical activity must keep saying what the counterparty was
called when the money moved, so later reference changes must not rewrite it. The
same discipline already exists in the NODE Miner's payout log, which keeps each
payout attributed to the address that actually received it; this is the second
implemented case, which is why A18 now states the rule.

Ordering is canonical insertion order, carried by monotonic Transaction
identity. V1 represents no financial time source and invents none: there are no
timestamps, and none may be manufactured for atmosphere (A03).

Explicitly not designed here: double-entry bookkeeping, a ledger architecture,
pending/settled states, reconciliation, chargebacks, refunds, reversals, fees,
statements, retention or eviction policy, an audit framework, and generic event
sourcing.


## 4. Account activity

Activity is a projection over canonical Transactions for one Account. It is
derived, never stored, and it never invents rows: an Account with no
Transactions has no activity, and the interface says so plainly.

From the acting Account's point of view:

| The Account is | Amount | Counterparty shown |
| — | — | — |
| the source | negative | the Transaction's destination reference snapshot |
| the destination | positive | the Transaction's source reference snapshot |

Activity must not expose the counterparty's balance, any Credential, any Device
identity, any Financial Session, or any internal Account ID. Newest first.


## 5. Device saved sign-in

A Device may store its own copy of sign-in material for this Provider.

```text
PROVIDER CREDENTIAL          DEVICE SAVED SIGN-IN
= current provider-side      = one Device's locally stored
  login secret                 authentication material

owned by the Provider        owned by the Device
```

These are distinct represented state with distinct owners. They may begin with
the same literal values, and they diverge the moment either changes — which is
precisely how a Device's saved sign-in becomes stale, and the reason it is
represented now rather than inferred later.

Binding rules:

- saved sign-in is **not** authority; it only permits an authentication attempt,
  exactly like any other credential material (foundation section 5);
- signing in with it goes through the ordinary authentication operation and
  produces an ordinary Financial Session;
- it must never be derived from the Provider's current Credential at sign-in or
  render time — a stale copy must actually fail;
- it must never be inferred from the existence of a Financial Session, and a
  Session must never be inferred from it;
- it exists only where it is represented. A Device that saved nothing has no
  one-tap path, whatever Sessions it holds.

A future Device may independently have a Session, saved material, both, or
neither, and each combination must behave correctly. That independence is the
point of representing this now.

This is one concrete saved sign-in requirement. Out of scope: a password
manager, a credential vault, a keychain abstraction, biometrics, a simulated
Face ID, and any generic saved-secret system.


## 6. Account switching and sign-out

The foundation's cardinality is unchanged: a Device holds at most one active
Financial Session for this Provider.

Switching Accounts is therefore nothing more than authenticating again:

```text
successful authentication to Account B
  → replaces the acting Device's Session for Account A
  → that Device now resolves Account B
```

No Account is created, deleted, re-parented or re-owned; no Player relationship
changes; the previous Account's balance, Credential and Transactions are exactly
as they were. Returning to the personal Account uses the Device's saved sign-in
through the same authentication operation, never a bypass.

Sign-out is the existing logout operation. Because a represented saved sign-in
now gives the local Device a legitimate way back in, exposing it in the client
is a product choice rather than a trap. Signed out is derived from the absence of
a Session; there is no stored `signedOut` flag.

Manual sign-in stays available alongside the saved path, and is the only way into
an Account this Device has not saved. It is deliberately the secondary path in
the interface, not the player's default burden, and it carries no hacking or
"victim" language: later gameplay reaching an Account with a stolen login and
password uses this ordinary surface, unchanged.


## 7. The Finance client

The Dollar client is a believable financial product, not a state inspector. The
player should not need the words Financial Session, Credential, provider
authority, `GameState` or Transaction internals to use it.

Information hierarchy:

1. which provider and account this is;
2. the current balance, as the visual subject of the screen;
3. two primary actions — SEND and ACCOUNT;
4. recent activity, or an honest empty state;
5. NODE, clearly separate and secondary.

SEND is a two-step flow: enter recipient and amount, review the exact formatted
amount and destination, then confirm. The review step exists because the
mutation is immediate and consequential, and a mistyped recipient or amount must
not become canonical money in one tap. Browser dialogs and `window.confirm` are
not the confirmation surface; no asynchronous processing is faked.

Refusals are stated in product language, not as operation statuses. Signed-in
presentation never renders a password, and the client never presents a fact it
cannot resolve from canonical state.

Human-readable Dollar amounts are input state, parsed to exact cents at the
input boundary. V1 accepts whole dollars and one or two fractional digits, and
refuses anything else — more precision than a cent, non-numeric text, zero,
negative, and amounts that cannot be represented exactly. No floating-point
Dollar value ever reaches the domain (A18, foundation section 9), and the typed
string never enters `GameState`. This is not a general currency parser.

NODE is presented on the same Wallet and stays a separate economic system with
its own visual treatment. Presentation may show both; canonical truth never
combines them, and no authority crosses between them (A18, foundation
section 10).


## 8. Explicitly out of scope for this slice

The Ordinary Phone / NPC Device and its Firmware; a foreign production Account
added only so SEND can succeed; password reset, account recovery, recovery
authority, credential rotation and forced Session revocation; Session expiry;
merchant gameplay, purchases and shops; fraud detection, suspicion, alerts,
cooldowns and daily limits; multi-provider support or any provider abstraction;
a generic banking framework; NODE transfers or any NODE authentication change;
and any stealing-specific finance operation, `accountHacked` flag, or
`FinancialAccess` abstraction.

A future recovery mechanic has a natural home in the Account surface. That is an
observation about where it would sit, not a selected design: it needs its own
authority decision, because a stolen Financial Session must not become permanent
Account takeover.


## 9. Contract self-test

| # | Question | Answer |
| — | — | — |
| 1 | Can presentation choose the source Account? | No — it is derived from the Session (2) |
| 2 | Does a failed transfer ever move part of the money? | No (2) |
| 3 | Is an ambiguous recipient resolved by picking one? | No — it fails closed (2) |
| 4 | Does a later Account-reference change rewrite old activity? | No — both sides are snapshotted (3) |
| 5 | Does a Transaction carry a represented time? | No — ordering is insertion order (3) |
| 6 | Can activity reveal the counterparty's balance? | No (4) |
| 7 | Is saved sign-in the Provider Credential? | No — distinct state, distinct owner (5) |
| 8 | Can a Session imply saved sign-in, or the reverse? | No, in either direction (5) |
| 9 | Can a Provider password change make a saved sign-in fail? | Yes — that is why it is represented (5) |
| 10 | Does switching Accounts change ownership? | No — only the Device's Session (6) |
| 11 | Is there a second Dollar authority object? | No (1, 6) |
| 12 | Does the player need domain vocabulary to use the client? | No (7) |
| 13 | Can a floating-point Dollar reach canonical state? | No — parsing is an input boundary (7) |
| 14 | Does production content need a foreign Account for this to be correct? | No — fixtures prove it (8) |

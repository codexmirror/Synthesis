# NODE-OS WALLET PRODUCT POLISH V1

Status: Accepted
Scope: Design authority for how the NODE-OS Wallet **presents** the Civic
Dollar client and the NODE Wallet — hierarchy, module composition, action
hierarchy, balance-trajectory semantics, the Dollar/NODE visual relationship,
focused sub-surface behavior, mobile priorities, and how the visual reference
is to be read. Presentation only.
Normative owner of current implemented behavior: `../current/DOLLAR_FINANCE.md`
(Dollars) and `../current/NODE_ECONOMY.md` (NODE).

## Status and purpose

The Dollar finance foundation is accepted and functionally complete.
[`DOLLAR_FINANCIAL_PROVIDER_V1.md`](DOLLAR_FINANCIAL_PROVIDER_V1.md) owns
Financial Account, Credential and Financial Session identity and authority.
[`DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md`](DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md)
owns transfers, Transactions, Account activity, Device saved sign-in and
Account switching.

This document adds nothing to either. It selects **only how NODE-OS presents
what they already define**, because the remaining problem was product quality
rather than mechanics: the Wallet read as a state inspector — large generic
outlined controls, divider-heavy composition, a form-first Account surface,
weak grouping.

Where this document and the two contracts above appear to disagree, they win on
what the truth *is*; this document wins on how NODE-OS shows it. It supersedes
the client information hierarchy previously sketched in section 7 of
[`DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md`](DOLLAR_TRANSFERS_FINANCE_CLIENT_V1.md);
every other statement there stands.

Durable economic separation stays in
[`../architecture/ECONOMY_AND_WALLETS.md`](../architecture/ECONOMY_AND_WALLETS.md)
(A18). The shared NODE-OS presentation language stays in
[`../current/INTERFACE_SHELL.md`](../current/INTERFACE_SHELL.md).


## 1. The product rule

```text
FINANCIAL PROVIDER   owns canonical financial truth
FIRMWARE             owns its client presentation

NODE-OS Wallet
├── Civic Dollar client presentation
└── NODE Wallet presentation
```

Presentation aggregates the two domains. Canonical truth stays independent: no
shared account, no combined balance, no authority bridge.

The Wallet must read as a deliberate financial product **and** unmistakably as
NODE-OS: dark, technical, restrained, mint for the conventional Dollar account,
amber for NODE, precise. It is not an independent consumer banking site hosted
inside NODE-OS, and it is not a generic bank app embedded unchanged.

A future Ordinary Phone will present the same Dollar domain with a completely
different consumer UI. That is not designed here, and nothing in this document
may be generalized into a Firmware presentation framework to anticipate it.


## 2. Reading the visual reference

The direction board is [`../assets/node-os-wallet-v1-reference.png`](../assets/node-os-wallet-v1-reference.png).

It is a **direction board, not a specification and not gameplay truth**. It
establishes desired qualities: balance-first hierarchy, a deliberate hero rather
than loose text, grouping through layered modules, compact icon+label action
shortcuts, subtle financial movement, compact activity rows, a smaller secondary
NODE module, a stronger SEND composition, a stronger Account identity, and
enough depth to feel like a product without becoming glossy consumer fintech.

The interpretation rule is absolute:

> **Repository truth wins over the reference. A fact does not become
> representable because it appears in the image.**

The reference contains illustrative content that is explicitly **not**
authority and must not be implemented: invented Transactions, activity
timestamps, fees, network fees, estimated arrival, totals, settlement, balance
history, security guarantees, recipient names, Account types, payment networks
beyond Civic Dollar, QR or payment scanning, receive mechanics beyond presenting
the existing Account reference, and account lists the world does not represent.

Where the reference shows something unrepresented, the Wallet takes the
*composition* and drops the *claim*.


## 3. Information hierarchy

Signed in, the Wallet dashboard reads in exactly this order:

```text
CIVIC DOLLAR HERO
  provider · balance · account reference · personal context · trajectory
ACTION STRIP
  SEND · RECEIVE · ACCOUNT
ACTIVITY
  real Transactions, or an honest empty state
NODE
  clearly separate, clearly secondary
```

The balance is the strongest visual subject of the screen. The Account
reference stays readable and useful but visually secondary, and carries a copy
affordance because it is the one string a sender needs.

Personal-account context is stated only where it is truthfully derivable from
this Device's saved sign-in. There is no personal flag.

Developer-style `PROVIDER / ACCOUNT / STATUS` fact rows are not the composition.
A visible authorized Account is what signed-in means, and no status row restates
it.


## 4. Module composition

Grouping is carried by a layered module — a raised surface and one hairline —
rather than by stacked section dividers. Depth comes from surface and rule, not
from shadow, gloss, rounding or a consumer card.

The Wallet owns the primitives the shared NODE-OS set cannot carry: the module,
the balance hero and its trajectory, the icon action tile, the consequential
filled action, the labeled financial terms list, and the compact activity row.
It keeps composing the shared primitives — section heading, list row, field,
input, chip, note, empty state, back control and outlined action — wherever
those are still the better control. It reuses the shared palette and the
technical typography DNA, and it redeclares nothing the Shell or `.app-content`
owns.


## 5. Action hierarchy

The dashboard offers exactly three actions, as compact icon+label tiles sharing
one row at every width:

| Action | Opens |
| — | — |
| SEND | the existing transfer flow, unchanged |
| RECEIVE | a presentation surface over the existing Account reference |
| ACCOUNT | Account management, unchanged |

**SCAN is deliberately absent.** The reference shows it, but the world
represents no Civic QR payment request, financial QR identity, finance scanner,
payment-request object or Scan-authorized transfer. A control implying one would
be a fake capability, so it is not implemented and no placeholder stands in for
it.

Filled is reserved for the consequential act: confirming a transfer, and
continuing into the saved personal Account. Opening a decision is not making
one, so REVIEW is a full-width outlined action. Signing out is secondary and
destructive, never equal to a finance action. An icon never carries a control
alone: every action keeps its text label.


## 6. Balance trajectory

A balance visualization is wanted, and it must be truthful.

Dollar Transactions carry canonical ordering and **no represented timestamp**.
The trajectory therefore represents:

```text
BALANCE ACROSS REPRESENTED TRANSACTION SEQUENCE
```

and never balance over clock time. It carries no time axis, no range selector
(`7D / 30D / 1Y`), no sampling, no interpolated points, and no percentage-change
claim.

It is derived on render from the current authorized Account balance and the
canonical Transactions that Account is part of, by undoing each Transaction
backwards from the current balance and drawing the result oldest to current. An
Account with N Transactions has exactly N+1 represented balance states.

The derivation is a Wallet presentation helper. It is not persisted, does not
enter `GameState`, and does not move into the finance domain without a domain
reason.

With one represented balance state there is no movement to draw, so **no line is
drawn at all** and the hero simply ends after the account identity. An invented
fluctuating history is the only other way to fill that space, so it is refused.


## 7. Activity

Activity rows present exactly what the canonical projection carries: a direction
mark, the historical counterparty reference, concise `SENT` / `RECEIVED`
wording, and the signed amount aligned for comparison. Newest first.

Nothing else is added: no timestamp, category, avatar, merchant, recipient name,
status, fee or memo. The reference's populated activity list is composition
guidance only. With no Transactions the honest empty state stands.


## 8. Dollar and NODE

NODE stays on the Wallet and stays visually secondary: a smaller module, its own
amber colour, its canonical balance, its canonical address, and its canonical
activity or empty state.

NODE is not a Dollar sub-account and not a second card in one portfolio. No
balance is combined, no NODE action is offered because none is represented, and
no decorative crypto capability is invented. Real mining activity continues to
come from canonical NODE Wallet truth.


## 9. Focused sub-surfaces

SEND, RECEIVE and ACCOUNT are focused tasks. While one is open it occupies the
Wallet surface and the unrelated NODE dashboard content steps away; BACK returns
to the dashboard and brings it back.

Which sub-surface is open is local Presentation state. It never reaches
`GameState`, and it never becomes Shell navigation truth. Browser-native dialogs
are not a confirmation surface.

RECEIVE V1 means exactly one thing:

> This is the Civic Dollar Account reference another represented sender would
> use to send Dollars to this Account.

It may present the provider name, the current Account reference, a copy
affordance and concise explanatory copy. It must not create payment requests,
invoices, QR codes, amount requests, receiving Sessions, Transactions or
incoming money, and it requires no new domain operation. If a RECEIVE behavior
would need new canonical truth, that behavior is out of scope rather than faked.


## 10. Mobile priorities

iPhone is the primary acceptance target, inside the permanent Shell chrome
rather than in an isolated mockup.

Priorities: useful content above the fold; compact but touch-safe targets rather
than oversized generic controls; no horizontal overflow at any width; long
Account references that wrap and copy safely; a readable amount hierarchy;
compact activity rows; clearly focused sub-surfaces.

The Wallet consumes the Shell-owned Editing presentation and adds none of its
own: no VisualViewport reads, keyboard-height logic, body transforms,
`window.scrollTo`, `scrollIntoView`, focus polling, focus timeouts or fake
keyboard offsets. A copy affordance must not open the software keyboard or
disturb an interaction already in progress.


## 11. Explicitly out of scope

The Ordinary Phone, NPC Devices and any consumer Civic app; new Firmware;
password reset, recovery authority, password rotation and Session revocation;
merchants, purchases, payment requests, invoices, QR payment semantics and
finance SCAN; fees, settlement, transfer timestamps, transaction categories,
merchant or recipient names, fabricated Transactions and fabricated balance
history; market price charts and investment analytics; multiple Providers; NODE
transfers and any change to NODE mining; canonical Wallet styling state; a
general chart framework; and a general design-system rewrite.


## 12. Contract self-test

| # | Question | Answer |
| — | — | — |
| 1 | Does the image make anything gameplay truth? | No — repository truth wins (2) |
| 2 | Is SCAN implemented because the reference shows it? | No — nothing represents it (5) |
| 3 | Does RECEIVE create a payment request? | No — it presents an existing reference (9) |
| 4 | Does the trajectory claim elapsed time? | No — it is Transaction sequence (6) |
| 5 | What is drawn for an Account with no Transactions? | Nothing — there is one state (6) |
| 6 | Is any derived trajectory stored? | No — it is rebuilt per render (6) |
| 7 | Can activity gain a timestamp or a name? | No (7) |
| 8 | Is NODE a Dollar sub-account or part of a total? | No (8) |
| 9 | Does an open sub-surface reach `GameState`? | No (9) |
| 10 | Is any control filled other than the consequential act? | No (5) |
| 11 | Does the Wallet manage viewport or keyboard geometry? | No — the Shell owns it (10) |
| 12 | Does this document define any Dollar or NODE semantics? | No (Status and purpose) |

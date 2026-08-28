# NODE-OS WALLET PRODUCT POLISH V1

Status: Accepted
Scope: Design authority for how the NODE-OS Wallet **presents** the Civic
Dollar client and the NODE Wallet — hierarchy, module composition, action
hierarchy, balance-trajectory semantics, the Dollar/NODE visual relationship,
focused sub-surface behavior, mobile priorities, how the visual reference is to
be read, and the surface, typography and interaction execution that composition
is drawn with (section 11). Presentation only.
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
A visible authorized Account is what signed-in means, and nothing restates it —
not a fact row and not a status chip. `ACTIVE`, `ONLINE`, `AUTHORIZED` and
`SIGNED IN` markers are all refused for the same reason: besides being
redundant, they read as Provider-side Account status, and the Provider
represents no status on an Account.

Client copy names the current Account, never an owner. A Financial Account is
Provider truth; this Device holds saved material and at most one Financial
Session over one, and a Session may be over an Account the Device never saved.
So Wallet wording says *this account*, not *this device's account* and not
*your account*, on every surface — signed out, where manual sign-in may reach
any Account, as much as on RECEIVE.


## 4. Module composition

Grouping is carried by a layered module — a raised surface and one hairline —
rather than by stacked section dividers. Depth comes from surface and rule, not
from shadow, gloss, rounding or a consumer card; section 11 states precisely
which depth cues that excludes and which restrained inset ones it allows.

The Wallet owns the primitives the shared NODE-OS set cannot carry: the module,
the balance hero and its trajectory, the icon action tile, the consequential
filled action, the labeled financial terms list, the amount entry, the compact
activity row and its quiet empty state. It keeps composing the shared
primitives — section heading, field, input, note, back control and outlined
action — wherever those are still the better control. It reuses the shared
palette and the technical typography DNA, and it redeclares nothing the Shell or
`.app-content` owns.

The shared bordered list row and the shared empty state are deliberately *not*
among them any more: both draw a complete rectangle per item, which is exactly
what turned a transfer history into a stack of repeated objects. Section 11
states what replaced them.


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


## 11. V2 visual execution

V1 selected the composition and it is accepted. What V1 did not reach was
execution: the screen was structurally right and visually shallow — near-equal
surfaces, a complete border around almost every group, repeated section rules,
and one uniform typographic weight for facts of very different importance. The
rules below are that gap closed. They change no Dollar or NODE semantics and add
no represented fact; every one of them is about how an already-selected truth is
drawn.

**Depth is tonal.** The Wallet distinguishes five levels — the Shell's black,
the module raised off it, an interactive surface raised again, a recessed inset
below both, and a hairline that only separates rows inside one surface. A module
is lifted by a small step in value plus a one-pixel highlight along its top
edge, so light reads as coming from above. Outer borders are quieter than V1's,
because the highlight and the value step carry the edge and the border only
finishes it. The palette stays near-black, dark green-black, mint, muted
grey-green and amber, plus the caution and danger hues already in use, and no
saturated fintech gradient enters it.

What that rule excludes is elevation language and consumer-card styling, not
depth cues as such. Refusing: an outer or drop shadow used to float a surface
above the page, rounded card corners, and any glossy, glassmorphic or
translucent-panel treatment. Allowed, and used: restrained *inset* depth — the
one-pixel top highlight that lights a module, and the soft inner shadow that
sinks a recessed plate or well; a small glow on the trajectory stroke, which
draws attention along a line rather than lifting a surface; and a deliberately
circular small mark where the shape itself carries meaning, as the activity
direction marks do. The distinction is the test: a treatment that says *this
surface floats* is out, a treatment that says *this surface is lit, or sunk, or
this mark is a movement* is in, and depth stays primarily tonal either way.
Section 4's shorthand — depth from surface and rule rather than shadow, gloss
or a consumer card — means exactly this.

**Not every group takes a border.** Grouping is carried by a shared parent
surface, spacing, alignment, typography and a subordinate hairline, in that
order; a complete rectangle is the last resort rather than the default. Two
consecutive horizontal rules are a composition error.

**Typography carries hierarchy so borders do not have to.** The split is by what
a value *is*, not by where it sits. Every identifier, label, technical
metadata line and piece of prose stays in the mono face NODE-OS speaks in —
account references included, wherever they appear. The cleaner application face
already used across NODE-OS carries quantities and the one strong non-identifier
value of a surface: the balance, an amount, a NODE figure, `Signed out`. No font
is added for this, and no third face exists.

**The hero is the strongest area of the screen and is finished in both states.**
It is lit from one corner, the currency motif sits behind the balance line as
surface rather than beside it as content, and the trajectory runs the full width
of the module and rests on its lower edge so that movement belongs to the
balance instead of being appended under it. The zero-Transaction hero is a
first-class composition, not the populated hero with a hole in it: it simply
ends after the account identity, and nothing is invented to fill the space.

**The action strip is one system.** The three tiles align their marks and labels
down a common leading edge, share a narrow gutter, and sit tight against the
hero. Icons are one family — one grid, one stroke weight, one cap and joint —
and an icon never carries a control alone.

**Activity is a list, not a stack of cards.** Rows share one module and are
separated by a hairline. Direction survives with no colour at all: the mark
points the way the money went, the wording says it, and the amount is explicitly
signed. Amounts return to a common trailing edge in tabular figures so two rows
can be compared. A credit stays quieter than the hero balance, so the balance
remains the brightest figure on the screen.

**NODE is one smaller instrument.** Its balance, payout address and activity
live on a single warmer surface under a single heading, rather than in two
modules under two headings. It stays clearly separate, clearly secondary,
clearly not Civic Dollar, and still offers no action.

**Entering money is not filling in a field.** The amount is engraved into a
recessed plate at the amount's own scale, and the currency mark is drawn by the
surface rather than typed into it, so an empty entry reads as a money field
rather than as the string `0.00` in a box.

**An action that belongs to one module may sit on that module's own lower
edge.** Continuing from a saved sign-in, and copying the reference RECEIVE
exists to show, are both acts of the module above them rather than of the page,
so both are drawn as its footer instead of as a control floating inside it or
stranded below it.

**Feedback is fast and small.** Press, focus-visible, hover where it exists, and
a copy result that lasts about a second and a half. Transitions are of the order
the Shell already uses. Nothing shimmers, bounces, pulses, fakes progress or
animates for its own sake, and `prefers-reduced-motion` removes what remains.

**A Wallet modifier of a shared primitive is written as `.node-x.dollar-y`.**
The application stylesheet is emitted before `nodeui.css`, so an equally
specific Wallet rule loses the tie silently; the doubled selector wins
regardless of order and states that the Wallet is tuning a shared control rather
than owning one.

**No Wallet rule shrinks an editable below the Shell's mobile floor.** The Shell
holds every editable at 16px at the mobile/coarse breakpoint, because Mobile
Safari auto-zooms a focused field set below that and the resulting viewport
scale change lands in the Shell-owned editing system — the one thing this pass
must not disturb. That floor is held at `.os-shell input` specificity, so any
two-class Wallet rule outranks it silently: the Wallet therefore states surface,
spacing, border and label treatment on an editable and leaves its size to the
shared and Shell rules that own it. A larger size is still the Wallet's to set,
as the SEND amount is; only going under the floor is refused, and the Wallet
never reaches for a viewport, scale or zoom-prevention workaround instead. The
same protection is required of Terminal by section 9 of
[`TERMINAL_INTERACTION_V1.md`](TERMINAL_INTERACTION_V1.md).

Fidelity is subordinate to truth and to the real device. Where a treatment taken
from the reference fails a long account reference, a zero-Transaction Account,
320px, the software keyboard or the permanent Shell chrome, the real interface
wins and the treatment adapts.


## 12. Explicitly out of scope

The Ordinary Phone, NPC Devices and any consumer Civic app; new Firmware;
password reset, recovery authority, password rotation and Session revocation;
merchants, purchases, payment requests, invoices, QR payment semantics and
finance SCAN; fees, settlement, transfer timestamps, transaction categories,
merchant or recipient names, fabricated Transactions and fabricated balance
history; market price charts and investment analytics; multiple Providers; NODE
transfers and any change to NODE mining; canonical Wallet styling state; a
general chart framework; and a general design-system rewrite.


## 13. Contract self-test

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
| 10b | Does any surface state an Account status? | No — none is represented (3) |
| 10c | Does any copy attribute an Account to the Device or player? | No (3) |
| 11 | Does the Wallet manage viewport or keyboard geometry? | No — the Shell owns it (10) |
| 12 | Does this document define any Dollar or NODE semantics? | No (Status and purpose) |
| 13 | Did V2 change what any surface states? | No — only how it is drawn (11) |
| 14 | Is an account reference ever set in the application face? | No — identifiers stay mono (11) |
| 15 | Does every information group get its own border? | No — a rectangle is the last resort (11) |
| 16 | Is the zero-Transaction hero a degraded populated hero? | No — it is its own finished state (11) |
| 17 | Does NODE still get two headings and two modules? | No — one heading, one module (11) |
| 18 | Can colour alone carry a transfer's direction? | No — mark, wording and sign do (11) |
| 19 | May a Wallet rule set an editable below 16px on mobile? | No — the Shell's floor stands (11) |
| 20 | Is an inset highlight or a circular mark a banned depth cue? | No — only elevation and card styling are (11) |

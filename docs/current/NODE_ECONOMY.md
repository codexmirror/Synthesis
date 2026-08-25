# NODE Economy and Wallet — current truth

Status: Accepted
Scope: Canonical NODE units, NODE Miner production and payout behavior,
represented economic recipients, the payout-log artifact, the `node-miner` CLI,
and the Wallet application, as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/ECONOMY_AND_WALLETS.md` (A18).


## NODE production

A running NODE Miner Process (admitted and scheduled as described in
`docs/current/FILES_SOFTWARE.md` and `docs/current/PROCESSES_ACTIVITY.md`)
produces NODE from real runtime work.

Its actual allocated compute (never a fixed reward-per-second, and never
derived from NodeScan `computeClass` or other Discovery/player information)
accumulates into a fractional compute-seconds remainder that is never rounded
per tick and is carried forward across advancement calls, so tick size never
changes the outcome. Canonical NODE economic truth is an integer atomic unit:
`1 NODE = 1,000,000 atomic NODE units` (`NODE_UNITS_PER_NODE`). V1 tuning
converts 1 compute-second of actual allocated compute directly into 1 atomic
NODE unit, so node-01's own 100 compute-capacity Device, running the Miner
alone at its 18% baseline load, produces roughly 82 atomic NODE units/s
(0.000082 NODE/s) — visibly productive while leaving clear room for a stronger
remote Device to out-produce it later. That conversion accumulates into
cumulative whole gross `producedNodeUnits` on the Process.


## Payout behavior of NODE Miner 1.0

Payout is a separate, same-step concern owned by the release that is
actually running. NODE Miner 1.0 is a concrete unofficial third-party
release: its package and installed-software provenance state the
`unofficial` channel and the `nm-dev` publisher, and its real hidden
behavior batches gross production in completed 1,000-unit increments, routing
670 units from each batch to the configured payout address and diverting 330
units (33%) to one NODE address embedded in the build
(`NODE_MINER_1_0_DEVELOPER_PAYOUT_ADDRESS`). This is a property of that one
release, not a rule of NODE mining or a configurable fee/payout framework: a
future release may divert nothing. Gross production is never redefined
downward — the Process carries `producedNodeUnits` (gross),
`payoutNodeUnits`, and `developerFeeNodeUnits`. The latter two describe only
completed payout batches; their difference from gross is pending production.
Each batch is one economic event, so the same total gross production produces
identical 670/330 payout events however advancement is chunked.

Each allocation then reaches a represented economic recipient only when one
currently holds that exact address by exact string match (accepted address
text is retained without normalization): the local NODE Wallet, or a
represented `NodeEconomy` account. Exactly one represented recipient must
match; ambiguous duplicate addresses credit nobody. There is no fallback
recipient — a Miner configured with a foreign address credits the local Wallet
nothing while still diverting the developer share, and NODE routed to an
address no represented recipient holds simply never arrives. Unrouted
allocation is never retried or retroactively credited if the Wallet address
later happens to match.


## Payout-log artifact

Those same real payouts maintain one concrete Miner-owned artifact on the
executing Device's canonical filesystem: the text file
`/var/log/node-miner/payout.log`. It is created by the first completed payout
batch rather than seeded, and each Miner run keeps exactly one running-total
line (`<processId> gross=<n> payout=<n> payout-address=<address> fee=<n>
fee-address=<address>`), rewritten in place as mining continues, so its
gross/configured/developer allocation stays recoverable while continuous
mining never grows `GameState` without limit. Retention is bounded to the
most recent 8 runs, oldest evicted first. An unrelated artifact already
occupying that path, including a text file without the NODE Miner payout-log
header, is never overwritten. The artifact belongs to the Device, not to the
Process: stopping or removing the Miner leaves it (and already-received Wallet
activity) intact, and Files and Terminal observe it like any other file.


## `node-miner` CLI

NODE-OS Terminal exposes the same installed NODE Miner as a `node-miner`
CLI command with exactly four V1 subcommands: `node-miner help`,
`node-miner run --payout <address>`, `node-miner status`, and `node-miner
stop`. Its availability is Device-local and derived, never a global
capability: `node-miner` (and its Help section) exists only while NODE
Miner is installed on the local Device *and* a supported executable
artifact currently exists there, so it is unavailable before installation
and becomes unavailable again — even with installed metadata intact — the
moment that executable is deleted. `run` and `stop` invoke the exact same
`runNodeMiner`/`startNodeMiner` and `stopNodeMiner` canonical operations
Files and Processes use, and `status` reads the same canonical
`ProcessState` (IDLE when installed but not running; otherwise the Process
ID, real CPU/RAM allocation, payout address, gross produced, pending batch
progress, and derived rate). Terminal owns no separate Miner or runtime state:
running from Files is immediately visible through `node-miner status`,
running from Terminal is immediately visible in Processes, and STOP from
either Terminal or Processes is immediately reflected everywhere else.


## Wallet

Wallet is a separate current domain slice presenting two independent
canonical economic concerns side by side: the existing Dollar balance and
the newly represented NODE balance and payout address. `GameState.wallet`
(Dollars) and `GameState.nodeWallet` (NODE) remain distinct canonical
state; mining never mutates the Dollar balance, and the represented local
NODE Wallet stores a stable identity, a payout address (an addressing
attribute, not Wallet identity), and a canonical integer `balanceNodeUnits`
(atomic NODE units), which the Wallet application formats as human-readable
NODE (e.g. `4,281` units presents as `0.004281 NODE`) via integer
division/decimal-string composition rather than floating-point canonical
truth.

The local NODE Wallet also owns a bounded activity history of NODE it
actually received: each record carries a deterministic monotonic per-Wallet
ID (`node-activity-0001`, following the Authentication History pattern), the
received `amountNodeUnits`, and its `mining_payout` kind, with retention
bounded to the most recent 20 records. No timestamps or world clock are
represented. The Wallet application presents both canonical balances, the
NODE address, and that received activity (newest first, e.g. `+900 units ·
MINING PAYOUT`), visually distinguished, and owns no production or payout
logic of its own. Wallet truth is only what this Wallet received: it never
presents a payer's gross production, the unofficial Miner's developer fee,
or that address. Dollars keep no transaction history.

`GameState.nodeEconomy` holds the represented NODE recipients that exist
besides that Wallet — currently exactly one, the account
(`node-account-nm-dev-v0`) that the unofficial NODE Miner 1.0 build pays
itself into, so its diverted 33% reaches real economic state rather than
disappearing or existing only as log text. Each account has stable identity
separate from its mutable address attribute. It is deliberately only a small
collection of concrete accounts: no ledger, blockchain, transaction network,
address registry, or economy framework is implemented.

Wallet state is separate from player and Device identity.


## Gotchas

- Canonical NODE truth is an integer atomic unit. Human-readable NODE is
  formatting; never store or compute canonical balances as floating point.
- Payout routing is a property of the concrete running release, not a rule of
  the economy. Do not generalize the 670/330 split into a fee engine or
  payout-policy framework.
- Address matching is exact and unnormalized, exactly one recipient may match,
  and there is no fallback recipient. Unrouted NODE simply never arrives and is
  never retroactively credited.
- A Wallet's activity history is only what that Wallet received. It must never
  reveal a payer's gross production, fee, or other destinations.
- The payout log belongs to the Device, not the Process. Stopping or removing
  the Miner never deletes it, and an unrelated artifact at that path is never
  overwritten.
- `node-miner` availability is derived from installed software *and* a present
  supported executable. It is never a stored global capability flag.

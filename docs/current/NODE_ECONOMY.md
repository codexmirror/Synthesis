# NODE Economy and Wallet — current truth

Status: Accepted
Scope: Canonical NODE units, NODE Miner production and payout behavior,
represented economic recipients, live payout retargeting, the payout-log
artifact, the `node-miner` CLI, and the Wallet application, as currently
implemented on `main`.

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

Where the Miner is executing changes none of this. A Miner admitted onto a
Device operated through RACK-OS produces from *that* Device's actual allocated
compute and routes what it produces through these same exact-address rules, so
a foreign machine can pay the player's own Wallet, some other represented
account, or nobody at all on exactly the same terms node-01's Miner does.


## Live payout retarget

The payout address of an already-running Miner can be changed without stopping
it. `retargetNodeMinerPayout` is the one canonical operation for this: it
resolves the Device currently operated through RACK-OS the same way remote RUN
and STOP do, finds the Miner running on that Device, requires a new explicit
non-empty address, and changes `payoutAddress` in place.

It is a configuration change, not a lifecycle event. The Process ID,
`executorDeviceId`, `programId`/`releaseId`, RAM ownership, `producedNodeUnits`,
`payoutNodeUnits`, `developerFeeNodeUnits` and the fractional `workRemainder`
all survive untouched; it consumes zero simulation time, performs no final
payout, creates no second Process, and fabricates no STOP or RUN. Pending
production is deliberately *not* reset merely because configuration changed, so
the next batch completes from work partly produced under the previous address
and routes wholly to the new one — future completed payout batches follow the
new address and nothing else does. Everything already routed stays exactly
where it went; past economic consequences are immutable. Setting the address
the Miner already has is a no-op that changes nothing. The running release's
payout behavior is unaffected: NODE Miner 1.0 keeps diverting its embedded 33%
from every batch, before and after.

It is lower-noise than STOP followed by RUN, not invisible. The Process never
ends, so no stopped Miner appears in Recent Activity and Process identity stays
stable — but anything legitimately observing that running Process reports its
new current address immediately, and the payout artifact below stays truthful
about what each address was actually paid. No surface hides or rewrites
canonical truth to make the change stealthy, and no detection, forensic, or
alert state exists to hide it from.

Both NODE-OS and RACK-OS expose it through the shared `node-miner payout
<address>` product command; that registered software command owns no state of its own and
reports exactly what the canonical
operation returned (`PAYOUT RETARGETED` with the unchanged Process ID and the
new address, or `NOT RUNNING`, `INVALID PAYOUT ADDRESS`, `SESSION UNAVAILABLE`,
`TARGET OFFLINE`). It remains absent from RACK-OS Files: this is the software
Terminal integration's deeper control path, not a graphical convenience.


## Payout-log artifact

Those same real payouts maintain one concrete Miner-owned artifact on the
executing Device's canonical filesystem: the text file
`/var/log/node-miner/payout.log`. "Executing Device" is literal — a Miner
running on `srv-01` maintains `srv-01`'s artifact and never node-01's, and a
local Miner still maintains node-01's; two Miners mining at once each record
only their own run, on their own Device.

It is created by the first completed payout batch rather than seeded, and keeps
one running-total line per **payout routing segment** — the period during which
one configured payout address has been in effect. A line is
`<processId>#<segment> gross=<n> payout=<n> payout-address=<address> fee=<n>
fee-address=<address>`, and its totals are that segment's own, not the whole
run's. It is rewritten in place as mining continues, so continuous mining never
grows `GameState` without limit, and a run that never retargets keeps exactly
one line (`#1`) for its whole lifetime, as before.

The segment is what keeps the artifact historically truthful when one Process
pays more than one address. A live retarget starts the next segment, so the
previous address's line is frozen with what that address was actually paid and
the new address's payouts append a new line: no line can ever present an earlier
payout as having gone to an address configured later. Segments are an accounting
boundary only — no Process ends, starts, or loses accumulated work at one — and
nothing is written for a segment that never completed a payout batch, because
the artifact still records only real payouts.

Retention is bounded to the most recent 8 segments, oldest evicted first,
whether those come from many runs or from one heavily retargeted run. An
unrelated artifact already occupying that path, including a text file without
the NODE Miner payout-log header, is never overwritten. The artifact belongs to the Device, not to the
Process: stopping or removing the Miner leaves it (and already-received Wallet
activity) intact, and Files and Terminal observe it like any other file.


## `node-miner` CLI

NODE-OS and RACK-OS Terminal expose one shared application/presentation-level
NODE Miner integration under the same `node-miner` product command. Its product
syntax and result presentation are implemented once: `help`, `run --payout
<address>`, `status`, `stop`, and `payout <address>`. Firmware continues to own
each distinct Terminal surface and its built-ins; command metadata is not
release-authored and no plugin or compatibility system exists.

Each Firmware supplies a narrow explicit operated-Device adapter. NODE-OS binds
to `player.localDevice`; RACK-OS resolves authority through `RemoteSession ->
DeviceAccess -> target Device`. Availability is independently derived for that
Device from matching InstalledSoftware plus a currently present supported
executable. A running Process alone never registers the CLI, and a copied
executable without InstalledSoftware remains directly runnable through Files
without registering it.

RUN resolves the executable from the bound Device and delegates to the existing
local or Session-authorized remote operation. STATUS uses one NODE Miner-specific
derived runtime view for Process ID, actual CPU allocation, RAM, payout address,
gross and pending production, and current production rate. STOP preserves its
context-specific consequence: local STOP enters local Recent Activity, while
remote STOP creates no node-01 history. PAYOUT changes only the bound Device's
running Miner through separate local and remote public authority boundaries;
the shared internal mutation preserves Process identity, counters, pending work,
and truthful payout routing segments. Local and remote Miners therefore remain
fully independent even while both run simultaneously. NodeScan remote execution
or source-Device-aware observation is not part of this integration.

## Wallet

Wallet is a separate current domain slice presenting two independent
canonical economic concerns: the Dollar client leads, and NODE follows beneath it as a distinct economic system, shown only while the Dollar client is on its own overview rather than inside a focused SEND, RECEIVE or ACCOUNT task, and presented as a deliberately smaller and visually distinct module than the Dollar hero above it. `GameState.dollarFinance` and `GameState.nodeWallet` remain distinct canonical state; mining never mutates Dollar finance, Dollar transfers never mutate NODE, and the represented local
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
or that address. Dollar presentation, authority, transfers and Transaction history are owned by `DOLLAR_FINANCE.md`; NODE has no transfer operation and gains none from it.

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
- A live payout retarget never moves, re-routes, or re-labels NODE that already
  arrived. It changes only where later completed batches go.
- The payout artifact belongs to the Device that executed the work, resolved
  through `executorDeviceId`. Writing a remote Miner's payouts to node-01, or a
  local Miner's to a server, is a bug.
- A payout-log line is a routing segment, not a run. One cumulative line per run
  would silently claim earlier payouts went to the address configured now.
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

# Processes and Activity — current truth

Status: Accepted
Scope: The canonical `GameProcess` runtime, executor-owned scheduling,
finite and continuous Processes, cancellation, and the Processes / Activity
Monitor application, as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/RUNTIME_AND_CONSEQUENCES.md` (A10).


## Process runtime

Processes represent current or completed elapsed work.

Current production Process consumers are:

- Service Analysis
- Credential Access
- Software Installation and Software Removal
- NODE Miner, the one continuous Process kind: it never reaches `completed`
  from elapsed work

Processes have stable identity and remain in one global canonical
`ProcessState`. Their `executorDeviceId` identifies the Device that exclusively
owns their CPU throughput, RAM admission/reservation, resource usage, and
advancement. The local Device and the two concrete servers therefore have
independent resource pools; unresolved and shallow executors do not advance.
Current Service Analysis and Credential Access operations still execute on the
player's local Device.

Software Installation and NODE Miner execution both also execute on a
represented remote Device. When the player installs a package that exists on
the Device they are operating through RACK-OS, the resulting
`software_installation` Process carries that target's `executorDeviceId` and
consumes that Device's own CPU and RAM through this same scheduler — there is
no second scheduler, no remote-specific Process kind, and no copy of remote
hardware into the Process. Its completion consequence is applied to that same
Device (see `docs/current/FILES_SOFTWARE.md`). Because it consumes only the
executor's own resources after admission, it retains no reference to the
RemoteSession or DeviceAccess that admitted it, and disconnecting neither
cancels it nor stops its advancement.

A NODE Miner run on that same operated Device works identically and is
admitted the same way (see `docs/current/FILES_SOFTWARE.md`): its
`executorDeviceId` is the target, that Device supplies its CPU and reserved
RAM, it contends with that Device's own other running Processes, and it
likewise retains no Session or access reference. Because it is continuous, the
difference is only in lifetime: leaving RACK-OS, returning to NODE-OS, and
`DISCONNECT` all leave it running indefinitely, and a later Session over the
same still-valid DeviceAccess observes the same Process. The one-Miner-per-
executor rule is per Device, so node-01 and `srv-01` may each run one at the
same time as independent runtimes.

CPU compute capacity controls throughput.

Running jobs share available CPU headroom.

RAM capacity controls admission and remains reserved while work is running.

The application boundary advances canonical Process state from elapsed time,
using each resource-capable executor's own hardware and baseline runtime.

Browser timers trigger advancement but are not themselves simulation truth.


## Continuous Processes

NODE Miner is the first continuous `GameProcess` kind: it never reaches
`completed` from elapsed work; only explicit STOP removes it. It executes
under the same executor-owned CPU/RAM model as finite Processes: RUN applies
the existing executor resource-usage semantics directly to admit and reserve
its RAM, and shared executor advancement allocates it the same equal split of
CPU headroom as any other running Process on that executor, re-segmented the
instant a finite Process completes mid-interval. There is one advancement loop,
not a second scheduler for continuous work.

STOP consumes zero simulation time, performs no final work, and immediately
removes the Process (releasing its RAM/CPU) without a generic stopped/history
state; global Process ID progression is unaffected, so a later RUN receives a
new identity. Local STOP and the remote STOP offered on the operated Device are
separate operations scoped to their own executor: neither can end the other
Device's Miner.

A Miner's configured payout address may also change while it keeps running.
That live retarget is a configuration change to one running Process, not a
lifecycle event: Process identity, executor, RAM ownership, accumulated
economic counters and pending fractional work all survive it, it consumes no
simulation time, and it creates no second Process, no STOP and no RUN. Its
economic and payout-artifact consequences are owned by
`docs/current/NODE_ECONOMY.md`.

What that Miner produces and where it routes production is owned by
`docs/current/NODE_ECONOMY.md`; its admission requirements are owned by
`docs/current/FILES_SOFTWARE.md`.


## Cancellation

Running finite local Process cards offer CANCEL through canonical
`cancelLocalProcess`; cancellation immediately removes unfinished work from the
scheduler, releases its CPU/RAM allocation, and prevents its completion
consequence. The running FileTransfer card keeps its distinct CANCEL control
for either direction through canonical `cancelFileTransfer`, the running NODE
Miner card offers STOP through canonical `stopNodeMiner`, and Recent Activity cards offer REMOVE
instead.


## Processes / Activity Monitor

The Processes application is presented as the NODE-OS Activity Monitor. It
observes only the local Device's canonical Process and resource state and,
alongside it, the single canonical active `FileTransfer`. Work executing on
another Device — a remote installation, and equally a NODE Miner running on an
operated Device — is absent from it: it is that Device's runtime, not
node-01's, and no cross-Device process-observation surface is currently
represented. What RACK-OS legitimately shows about that Device's own Miner is
owned by `docs/current/FILES_SOFTWARE.md` and is not this application's
observation. The two runtime
domains remain separate canonical state; a pure presentation adapter aggregates
them for display only and never represents a transfer as a `GameProcess`. That
adapter resolves a FileTransfer's direction-aware source, destination,
artifact, and current rate through the same `accessId`-based FileTransfer
authority that runtime advancement uses
rather than through any RemoteSession, so the active transfer keeps
presenting correctly with no RemoteSession present, including immediately
after disconnect. Activity is filtered as ALL, OPERATIONS (Service Analysis,
Credential Access, Software Installation, Software Removal, and NODE Miner),
and TRANSFERS (the current active FileTransfer, regardless of direction). No
other activity type is represented. Filter badges count running activity only,
while Recent Activity cards for ended Processes and FileTransfers remain visible
in the matching filtered history.

Its system summary derives CPU load, RAM use, the running-activity count, and
current network transfer usage from current state alone. NET DOWN is the active
transfer's derived effective rate only for Download, while NET UP is that rate
only for Upload; the opposite direction is zero. Both are presented
against the local Device's represented `NetworkTransferCapacity`. None of this
usage is stored as canonical state. Represented artifact byte sizes keep their
existing decimal units, while transfer rates keep the binary units of that
capacity.

Running activity is the visual focus and carries only the information its own
runtime supports: a finite operation (Service Analysis, Credential Access,
Software Installation, Software Removal) shows its own concrete subject,
percentage progress, CPU allocation, RAM requirement, and concrete completed
result. Service-scoped work — Service Analysis and Credential Access — names
the Service the player legitimately remembers at that stable target and
Service identity, with its historical endpoint beneath it, so several
simultaneous Service Analysis Processes are told apart by what each one is
analysing rather than only by their ports. That name is remembered Discovery
and never current target truth: where the player remembers no Service at that
identity, the operation truthfully falls back to naming its historical
endpoint alone. Software operations name their package or software release.
The continuous NODE Miner operation shows CPU, RAM, configured payout
address, cumulative gross produced, pending batch progress, and a derived
units/s rate, deliberately without a percentage progress bar. A
FileTransfer is labelled DOWNLOAD or UPLOAD and shows its artifact,
direction-aware source-to-destination relationship, transferred and total
bytes, progress, and current effective rate, and never claims Process
CPU or RAM. It presents no payout split or developer address, because that is
not runtime the Activity Monitor observes.

Recent Activity preserves bounded snapshots of the 20 most recently ended local
activities, including completed or cancelled finite Processes, stopped NODE
Miners, and completed or cancelled Upload or Download FileTransfers. A cancelled finite Process preserves its partial progress and is explicitly
labelled CANCELLED without presenting active CPU or RAM ownership. Completed outcomes remain distinct from
cancellation, while other ended activity continues to rely on placement and
concrete outcomes rather than a generic lifecycle state. History is presented
more quietly than running work and stays clearable either individually or all
at once.

Recent Activity may be cleared without:

- stopping running work
- removing Discovery
- removing Knowledge
- changing World Truth
- removing established DeviceAccess
- resetting Process identity progression

NODE-OS REMOVE and CLEAR controls affect only Recent Activity observed for the
local Device and cannot remove retained Process history owned by another
executor Device.

Remote Software Installation, the one operation that currently finishes on an
executor other than the local Device, owns its own end-of-life rule. A
completed `software_installation` Process whose executor is not the local
Device has already applied its concrete consequence to that Device at the same
advancement boundary, and no interface presents or clears it, so retaining it
would be canonical history nothing could reach — and it would silently consume
one of the bounded local Recent Activity slots. It is therefore neither
archived nor retained: it leaves the scheduler at that same boundary. A running
remote installation stays canonical for exactly as long as it is actually
running.

This rule is deliberately scoped to that one Process kind rather than being a
general policy for non-local work. Every other Process kind keeps exactly the
lifecycle it already had; what a future remote Service Analysis, Credential
Access, or other non-local operation should do when it ends is that mechanic's
decision to make, not this one's.

Remote NODE Miner STOP reaches the same conclusion from the same reasoning, and
owns it for itself: stopping a Miner on the operated Device removes it from the
scheduler and archives nothing, because Recent Activity is the local Device's
own runtime observation and a foreign Miner archived there could be neither
presented nor cleared while still consuming one of the bounded local slots.
Local STOP is unchanged and still archives its own Device's Miner.


## Gotchas

- A Process is elapsed work, not an event, action, job, or causality framework.
  The mechanic that created the Process owns what its completion means.
- `FileTransfer` is a separate canonical runtime domain. The Activity Monitor
  derives one view over both; it never merges them or creates a second
  canonical activity list.
- An operation's presented subject is derived from remembered Player
  Information, never from current target truth. Concurrent Processes are told
  apart by their own subjects only; there is no batch identity, no parent
  Process, and no grouped canonical state behind several operations started
  together.
- Cancellation of a finite Process must prevent its completion consequence, not
  merely hide the card: unfinished work leaves the scheduler and its CPU/RAM
  allocation is released.
- Continuous Processes never complete from elapsed work. Do not give NODE Miner
  a percentage completion bar or a generic stopped state.
- Recent Activity is the local Device's own runtime observation. A completed
  remote `software_installation` Process is neither archived into it nor
  retained in `ProcessState`, and a remote NODE Miner STOP archives nothing,
  because nothing could present or clear either. Each is that mechanic's own
  rule; do not generalize them to other Process kinds without a concrete
  mechanic that decides so.
- A live payout retarget is not a Process lifecycle event. It must never
  fabricate a STOP or RUN, replace the Process, or reset accumulated work.
- Retained completed-Process history is disposable operator presentation, not
  an audit log. Clearing it must never undo consequences stored in other
  canonical state, and it cannot touch another executor's history.
- Browser timers trigger advancement; they are not simulation truth.

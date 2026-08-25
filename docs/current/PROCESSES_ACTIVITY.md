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
new identity.

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
alongside it, the single canonical active `FileTransfer`. The two runtime
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
Software Installation, Software Removal) shows its historical target or
package, percentage progress, CPU allocation, RAM requirement, and concrete
completed result; the continuous NODE Miner operation shows CPU, RAM,
configured payout address, cumulative gross produced, pending batch progress,
and a derived units/s rate, deliberately without a percentage progress bar; a
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


## Gotchas

- A Process is elapsed work, not an event, action, job, or causality framework.
  The mechanic that created the Process owns what its completion means.
- `FileTransfer` is a separate canonical runtime domain. The Activity Monitor
  derives one view over both; it never merges them or creates a second
  canonical activity list.
- Cancellation of a finite Process must prevent its completion consequence, not
  merely hide the card: unfinished work leaves the scheduler and its CPU/RAM
  allocation is released.
- Continuous Processes never complete from elapsed work. Do not give NODE Miner
  a percentage completion bar or a generic stopped state.
- Retained completed-Process history is disposable operator presentation, not
  an audit log. Clearing it must never undo consequences stored in other
  canonical state, and it cannot touch another executor's history.
- Browser timers trigger advancement; they are not simulation truth.

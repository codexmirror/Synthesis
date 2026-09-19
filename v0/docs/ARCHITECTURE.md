# Architecture

Status: Accepted
Scope: Index and precedence entry point for the durable architecture boundaries
of Synthesis. Repository boundaries, the canonical ownership reference, the
design test, and the architecture change rule are owned here; each numbered
invariant is owned by the module named in the register below.

This document is not a description of every currently implemented feature and
it is not a future roadmap.

Use:

- `docs/README.md` to resolve the smallest sufficient Read Set for a task
- `docs/current/...` for current implemented product truth
- `docs/V0.md` for a non-exhaustive current product snapshot
- `docs/FUTURE.md` for confirmed future direction
- `docs/design/...` for feature-specific design contracts
- `docs/work-orders/...` for explicitly selected implementation deltas

Current code may evolve. The invariants referenced here should change only
when the underlying architectural decision intentionally changes.


## Architecture invariants

The identifiers below exist so work orders and reviews can reference durable
rules without restating them. Each ID is unique and is defined in exactly one
module. Read only the modules a task actually needs.

| ID | Invariant | Owning module |
| — | — | — |
| A01 | Stable identity | [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md) |
| A02 | Entity-owned simulation truth | [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md) |
| A03 | Separate world truth from player information | [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md) |
| A04 | Player-visible belief is not hidden truth | [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md) |
| A05 | Interfaces do not own gameplay operations | [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md) |
| A06 | Command is not capability | [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md) |
| A07 | Device, Firmware, Software, and Session are separate | [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md) |
| A08 | Access is a relationship, not a hacked flag | [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md) |
| A09 | Observation operations have distinct epistemic roles | [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md) |
| A10 | Processes represent work, not universal causality | [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md) |
| A11 | Mutate causes; derive consequences | [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md) |
| A12 | Actions are defined by state transitions | [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md) |
| A13 | Artifacts come from represented events | [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md) |
| A14 | Shared-world authority remains explicit | [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md) |
| A15 | Community or external actors do not receive privileged world mutation | [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md) |
| A16 | Concrete mechanics before generic frameworks | [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md) |
| A17 | Filesystem truth belongs to the Device | [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md) |
| A18 | Wallet, currency, Device, and wallet software are separate | [`architecture/ECONOMY_AND_WALLETS.md`](architecture/ECONOMY_AND_WALLETS.md) |

Each module also carries the closely coupled prose that belongs with its
invariants:

- [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md)
  — Discovery and remembered observations; operations and stale input
- [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md)
  — presentation truth; interface and mobile boundaries
- [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md)
  — Device state and operating contexts
- [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md)
- [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md)
- [`architecture/ECONOMY_AND_WALLETS.md`](architecture/ECONOMY_AND_WALLETS.md)


## Repository boundaries

### `src/core/game/`

Owns pure simulation state and rules.

It must not depend on:

- React
- DOM APIs
- browser storage
- shell navigation
- CSS
- viewport behavior
- presentation-specific state

Core rules should be executable independently of the current interface or
deployment adapter.


### `src/app/`

Owns the application boundary between React and the game domain.

Responsibilities may include:

- hosting current canonical state in the local prototype
- invoking pure game rules
- exposing narrow operations to interfaces
- coordinating browser-side simulation advancement where currently required
- adapting future transport without moving transport into `core/game`


### `src/apps/<feature>/`

Owns feature-specific interface code and local presentation state.

Apps may consume shared application/domain operations.

They must not:

- own competing gameplay truth
- import another feature’s private UI implementation as a gameplay dependency
- communicate gameplay through app-to-app events when canonical state already
  provides the shared truth


### `src/shell/`

Owns application registration, hosting, navigation, and shared NODE-OS
presentation.

Shell navigation is presentation state.

The Shell must not own gameplay rules.


### `src/styles/`

Owns reusable presentation primitives and visual tokens.

Styles must not encode gameplay rules.


## Canonical ownership reference

The table below describes semantic ownership. It does not require these concerns
to be physically nested in one object.

| State / concern | Canonical owner | Must not become |
| — | — | — |
| Entity identity | represented entity | IP/name/label identity |
| World configuration | World / represented entities | UI-owned truth |
| Discovery | player Discovery state | current World Truth |
| Knowledge | player Knowledge state | capability or unlock flags |
| Hardware | Device | Firmware state |
| Runtime resources | Device-associated runtime state | UI telemetry invented for presentation |
| Firmware | Device-installed Firmware state | compute/resource authority |
| Software / Tools | Device-owned installed functionality | Firmware or player skill flags |
| DeviceAccess | relationship state | hacked flag or active Session |
| Session | operating-context state | replacement for Device identity |
| Filesystem | represented Device | Files/Terminal private data |
| GameProcess runtime | canonical simulation state with executor identity | universal activity/job framework |
| Processes / Activity Monitor | derived presentation over canonical Device runtime domains | second canonical activity list |
| Device Model | represented product/platform definition | concrete Device runtime truth |
| Device audit history | represented Device/event-owned audit state | completed Process presentation history |
| Forensic trace / evidence | represented consequence of concrete events | automatic synonym for one visible log entry |
| Shell navigation | Shell presentation state | gameplay state |
| Terminal output | Terminal presentation state | canonical game history |
| Target highlighting | presentation metadata | entity type or gameplay state |


## Design test for significant mechanics

Before implementing a significant gameplay mechanic, answer:

1. What concrete state or relationship does the mechanic observe?
2. What concrete state or relationship does it change?
3. Which consequences should be derived instead of directly written?
4. Can another independent system influence the same underlying state?
5. Can other systems react to the result without knowing the named action that
   caused it?
6. Does this create another meaningful approach or merely another mandatory
   pipeline step?
7. Is the interface using player-visible information rather than hidden truth?
8. Is stable identity separate from mutable presentation attributes?
9. Is gameplay implemented once behind a shared operation boundary?
10. Are we modelling only what the current mechanic requires?


## Architecture change rule

Do not add a future idea to this document merely because it is interesting.

`docs/FUTURE.md` may think far ahead.

This document should anticipate the future only where a durable boundary is
needed to prevent current code from creating unnecessary coupling or duplicate
truth.

When an architectural invariant intentionally changes:

1. update the module that owns that invariant, and this index when the register
   itself changes
2. update affected current-scope documentation
3. update architecture/source-of-truth tests where appropriate
4. re-check planned work orders against the new contract

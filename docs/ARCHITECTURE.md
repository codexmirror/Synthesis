# Architecture

This document defines the durable architecture boundaries of Synthesis.

It is not a description of every currently implemented feature and it is not a
future roadmap.

Use:

- `docs/V0.md` for current implemented product truth
- `docs/FUTURE.md` for confirmed future direction
- `docs/design/...` for feature-specific design contracts
- `docs/work-orders/...` for explicitly selected implementation deltas

Current code may evolve. The invariants in this document should change only
when the underlying architectural decision intentionally changes.


## Architecture invariants

The identifiers below exist so work orders and reviews can reference durable
rules without restating them.


### A01 — Stable identity

Stable internal IDs are canonical entity identity.

Mutable or player-visible attributes must not become identity, including:

- IP addresses
- ports
- network names
- display names
- hostnames
- labels
- wallet addresses

A represented object’s address, name, presentation, ownership, reachability, or
other mutable state may change without changing which entity it is.


### A02 — Entity-owned simulation truth

Represented simulation state belongs to the entity or relationship whose state
it describes.

Interfaces must not create competing gameplay truth merely because a local copy
would be convenient.

Prefer:

```text
CANONICAL STATE
      ↓
MULTIPLE INTERFACES
```

over:

```text
TERMINAL STATE
FILES APP STATE
SCAN APP STATE
OTHER UI STATE
```

Semantic ownership does not require every property to be physically nested
inside one TypeScript object. It means there is one authoritative represented
truth.


### A03 — Separate world truth from player information

These concerns are distinct:

| Concern | Meaning |
| — | — |
| World Truth | What currently exists and is true in the simulation |
| Discovery | Positive remembered observations about known space |
| Knowledge | Deeper learned or interpreted information |
| Capabilities | Ways the player can currently attempt to interact |
| Relationships | Access, sessions, ownership, trust, or similar represented connections |
| Reachability / position | What can currently be interacted with from a given position |

Do not collapse them into a single generic state or unlock model.

Changing World Truth does not automatically rewrite historical Discovery or
Knowledge.

Learning something does not automatically create access, capability, or
reachability.


### A04 — Player-visible belief is not hidden truth

Interfaces may reason from information the player legitimately possesses.

They must not silently use hidden current World Truth to reveal whether a
player’s stale belief is correct.

A player may reasonably believe an action is possible while current World Truth
causes the attempt to fail.

Therefore:

```text
PLAYER-KNOWN FEASIBILITY
        ≠
ACTUAL FEASIBILITY
```

A disabled button, missing action, warning, or other presentation must not leak
hidden truth unless the player has information that justifies that conclusion.


### A05 — Interfaces do not own gameplay operations

Terminal commands and graphical controls are interfaces over gameplay
operations.

A gameplay rule should be implemented once behind a domain/application
boundary and exposed through whichever interfaces need it.

```text
TERMINAL ─────┐
              ├── GAMEPLAY OPERATION ── DOMAIN STATE
GRAPHICAL UI ─┘
```

A graphical interface must not construct or execute a Terminal command string
to perform gameplay.

Terminal must not become the game domain.

Commands should receive narrow state or operations rather than unrestricted
`GameState` when a smaller boundary is sufficient.


### A06 — Command is not capability

The existence of an interface verb does not prove that the player currently has
the software, hardware, information, access, position, resources, or other
conditions required to perform it successfully.

Likewise, a named Tool or software product must not become permanently
synonymous with one command.

Long-term, multiple concrete software products may provide overlapping
capabilities, and one product may support multiple interface verbs.

Capabilities should arise from represented conditions rather than permanent
command-unlock flags where practical.


### A07 — Device, Firmware, Software, and Session are separate

Preserve these concepts:

| Concern | Responsibility |
| — | — |
| Device | Machine identity and represented machine state |
| Hardware | Compute and memory capacity |
| Runtime | Current resource use and execution state |
| Firmware | Operating-system identity, interaction model, and presentation |
| Software / Tools | Installed functionality |
| DeviceAccess | Established access relationship |
| Session / operating context | Which Device is currently being operated and under which authority |

Firmware must not duplicate or grant Device-owned hardware, runtime, networking,
filesystem, or other simulation truth.

Installed software is not Firmware.

Established access is not an active Session.

The concrete V1 `RemoteSession` is canonical active-connection state created
from an existing `DeviceAccess`. It references that access for source, target,
service path, and authority rather than duplicating those facts. Its connected
address is an observation attribute, not Device identity.

An active Remote Session does not replace `player.localDevice`, retarget
NODE-OS, or require a global `currentDeviceId`. A distinct foreign operating
surface may consume the Session while the local NODE-OS environment remains
present. It resolves the target by stable Session → DeviceAccess → target
identity and may expose authorized current canonical target state rather than
remembered Discovery.

Operating another Device must not redefine the player’s personal Device.

NODE-OS is the Firmware environment of the player’s personal Device, not the
universal presentation layer for every machine in Synthesis.

Foreign Firmware may expose the same underlying kinds of simulation state
through substantially different interfaces.


### A08 — Access is a relationship, not a hacked flag

`DeviceAccess` represents established access between stable entities.

It is not:

- a generic `hacked` boolean
- an active connection
- an active Session
- automatic remote execution
- automatic filesystem access
- automatic privilege escalation
- automatic interface switching

If active Sessions or remote operating contexts exist, they must build on
established access without replacing it.

Disconnecting a Session must not implicitly erase persistent access unless a
future concrete mechanic explicitly changes that relationship.


### A09 — Observation operations have distinct epistemic roles

Observation must remain separate from browsing remembered information.

Opening or navigating remembered data is not itself a new observation.

The durable conceptual roles are:

```text
SCAN
explore outward / discover adjacent objects or relationships

INSPECT
observe the current intrinsic state of a specific known object

ANALYZE
perform deeper, potentially resource-consuming investigation
```

Exact observation depth belongs to the currently implemented mechanic and is
documented in `docs/V0.md`.

These verbs must not become a mandatory universal pipeline.

Knowledge obtained through one path does not imply that every target must be
processed through the same sequence.


### A10 — Processes represent work, not universal causality

A Process represents elapsed work and resource consumption.

Processes may have:

- stable identity
- an executor Device
- resource requirements
- progress
- completion
- a concrete result

The mechanic that creates the Process owns what completion means.

A Process is not a universal:

- action system
- event bus
- job framework
- causality layer
- effect system

Browser timers or schedulers may trigger advancement, but they are not
canonical simulation truth.

Clearing disposable Process presentation or completed history must not undo
consequences already stored in other canonical state.


### A11 — Mutate causes; derive consequences

Synthesis should grow as interacting stateful systems rather than collections of
scripted event chains.

Prefer:

```text
ACTION / AUTONOMOUS CHANGE
        ↓
CONCRETE STATE MUTATION
        ↓
OTHER SYSTEMS OBSERVE THE NEW STATE
        ↓
CONSEQUENCES
```

over:

```text
NAMED ACTION
        ↓
HAND-WRITTEN LIST OF ALL DOWNSTREAM EFFECTS
```

Persist independent causes and derive downstream conditions when practical.

The same resulting state may have multiple causes.

For example, future CPU pressure might result from legitimate workloads,
player Processes, malware, security software, or other represented execution.
Systems observing CPU pressure should not need to know which named mechanic
caused it.

Likewise, future connectivity may depend on concrete interfaces, routes,
connections, firewall state, availability, and current position rather than a
single `reachable` unlock flag.


### A12 — Actions are defined by state transitions

A successful action means its requested concrete transition occurred.

It does not imply that a generic „hack“ succeeded.

In particular:

```text
ATTACK ≠ ACCESS
```

Different actions may eventually affect:

- Knowledge
- relationships
- service state
- filesystem state
- software state
- runtime resources
- Process state
- reachability
- infrastructure
- other represented simulation state

Do not require every action to fit a universal attack taxonomy.


### A13 — Artifacts come from represented events

When artifact-producing mechanics exist, artifacts should exist because a
represented event actually occurred.

Examples may eventually include:

- connection records
- authentication records
- filesystem changes
- Process execution
- network activity
- service events

Do not manufacture fake logs or evidence solely for atmosphere.

Artifacts can later become observable information and influence player
decisions through normal simulation boundaries.


### A14 — Shared-world authority remains explicit

The current browser implementation may execute canonical simulation locally,
but client-side authority is not a permanent multiplayer requirement.

A future authoritative deployment may move hidden canonical World Truth,
simulation time, Process advancement, autonomous actors, economy, and other
persistent simulation state to a server.

The durable flow is:

```text
INTERFACE
    ↓
APPLICATION / SESSION OPERATION
    ↓
AUTHORITATIVE DOMAIN RULE
    ↓
PLAYER-VISIBLE RESULT
```

A future online client should not require complete hidden World Truth merely to
request gameplay operations.

Clients request operations; they do not assert that hidden conditions are
valid.

Account identity, transport identity, simulated entity identity, player
identity, Device identity, and Session identity must remain conceptually
separate.

This rule does not require a server, RPC framework, command bus, or networking
architecture today.


### A15 — Community or external actors do not receive privileged world mutation

If Synthesis later supports community-authored software, Firmware,
organizations, services, markets, scenarios, or other extensions, they should
interact through explicit supported simulation boundaries where practical.

Prefer:

```text
ACTOR / ORGANIZATION / PRODUCT
        ↓
AUTHORIZED OPERATION
        ↓
CANONICAL STATE TRANSITION
        ↓
NORMAL SYSTEMIC CONSEQUENCES
```

over:

```text
SPECIAL NAMED ACTOR
        ↓
ARBITRARY GAMESTATE MUTATION
        ↓
SCRIPTED WORLD OUTCOME
```

An important product, company, Firmware, Tool, or community group may be unique
content without requiring unique laws of simulation.

This invariant does not define a mod API, plugin interface, scripting system,
permission framework, organization model, or extension schema.


### A16 — Concrete mechanics before generic frameworks

Do not generalize a hypothetical future system before concrete implementations
demonstrate the shared requirement.

Avoid introducing speculative:

- universal entity models
- generic capability engines
- generic action/effect engines
- generic relationship engines
- generic reachability engines
- generic causality frameworks
- generic persistence frameworks
- generic Firmware frameworks
- generic Session frameworks
- generic software inventory frameworks
- plugin systems
- event buses
- ECS
- dependency-injection frameworks

A small amount of concrete duplication is preferable to a premature universal
abstraction.

Extract shared abstractions after multiple implemented systems reveal the same
real requirement.


### A17 — Filesystem truth belongs to the Device

Filesystem state is owned by the simulated Device and remains separate from
Firmware and interface presentation state. Files, Terminal, and any other
observation surfaces must derive their views from the same canonical
filesystem rather than creating application-local file models.

The current filesystem implementation is deliberately read-only. Directories
are derived from file paths. Local and foreign interfaces remain bound to their
respective Device-owned filesystem; this boundary does not imply a generic
virtual-filesystem framework or remote filesystem authority.


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
| Processes | canonical simulation state with executor identity | UI timers or app-local jobs |
| Shell navigation | Shell presentation state | gameplay state |
| Terminal output | Terminal presentation state | canonical game history |
| Target highlighting | presentation metadata | entity type or gameplay state |


## Discovery and remembered observations

Discovery represents positive remembered observation, not omniscient World
Truth.

Browse is not Observe.

A UI may project remembered relationships as a tree, hierarchy, atlas, graph
projection, or other understandable presentation without making that
presentation structure canonical ownership.

A relationship displayed as parent/child in an interface is not automatically a
parent/child domain relationship.

Re-observation may update legitimately observed positive information.

Failure or absence must not silently erase historical knowledge unless a
concrete mechanic explicitly establishes that the player learned the earlier
information was no longer valid.

Historical observations that identify a mutable endpoint must retain the
identity and attributes actually observed rather than silently retargeting to a
different current entity.


## Operations and stale input

Operations initiated from player-visible observations must validate the
identities and player-visible references required by that operation against
authoritative current state.

Stable identity prevents accidental identity drift.

It must not become permission to silently retarget stale player input.

A stale endpoint, address, relationship, or observation may cause an operation
to fail even when the stable entity still exists.

The exact validation required belongs to the concrete mechanic.


## Device state and operating contexts

A Device is the simulated machine.

A Firmware is the environment through which that Device is presented and
operated.

Software provides functionality on a Device.

Access records an established relationship.

A Remote Session records active use of established DeviceAccess. Disconnecting
it preserves the access relationship and local operating context.

These concerns may interact but must remain independently meaningful.

Conceptually:

```text
DEVICE
├── identity
├── machine state
├── hardware
├── runtime
├── networking
├── filesystem
└── installed software  when represented

DEVICE
└── FIRMWARE
      ↓
presentation / interaction model

DEVICE ACCESS
      ↓
may authorize

REMOTE SESSION
      ↓
operating context over a Device
```

NODE-OS remains one Firmware implementation, not the global definition of what
a computer interface in Synthesis must look like.


## Interface and mobile boundaries

Mobile Safari/iPhone is a first-class presentation target.

Viewport and Editing-presentation coordination belongs to the Shell boundary,
not to gameplay or Terminal domain logic.

Individual scrollable application regions own their scrolling.

Do not move browser viewport state into `core/game`.

Do not reintroduce Terminal-owned or feature-owned global keyboard hacks merely
to solve local presentation issues.

Presentation behavior may evolve, but viewport mechanics must remain separate
from canonical simulation truth.


## Presentation truth

Player-facing technical values should come from represented canonical state
when that state exists.

Do not invent fake:

- telemetry
- logs
- traffic
- uptime
- security state
- process state
- filesystem content
- alerts

solely to make an interface appear more technical.

Silence or unavailable information is valid presentation state.


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

1. update this document
2. update affected current-scope documentation
3. update architecture/source-of-truth tests where appropriate
4. re-check planned work orders against the new contract

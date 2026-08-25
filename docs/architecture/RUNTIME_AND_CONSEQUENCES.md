# Runtime, Causality, and Artifacts

Status: Accepted
Scope: Processes as elapsed work, mutating causes rather than scripting consequences,
actions as concrete state transitions, and artifacts produced by represented
events.

Normative owner for architecture invariants A10, A11, A12 and A13. `docs/ARCHITECTURE.md` is the
index and precedence entry point; it summarizes these invariants and must not
redefine them.


## A10 — Processes represent work, not universal causality

A Process represents elapsed work and resource consumption.

The canonical `GameProcess` runtime is only one possible kind of Device runtime
activity.

A player-facing Processes / Activity Monitor interface may derive one coherent
Device-runtime view from multiple canonical runtime domains, such as
`GameProcess` and `FileTransfer`, without merging those domains or creating a
second canonical activity list.

Therefore:

```text
GameProcess ────┐
                ├── derived Processes / Activity Monitor presentation
FileTransfer ───┘
does not imply:
FileTransfer = GameProcess
```

The Processes interface is a Device runtime command center, not a universal
job framework.

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

Retained completed Process entries are disposable runtime history for the
operator. They are not an audit log, forensic record, or source of gameplay
truth.

Removing completed Process history must not erase independently represented
logs, evidence, access relationships, knowledge, filesystem state, economic
effects, or other consequences.


## A11 — Mutate causes; derive consequences

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

Attack surface, weakness, technique, and resulting authority must remain
separate concepts.

Conceptually:

```text
REACHABILITY
      +
ATTACK SURFACE
      +
WEAKNESS / CREDENTIAL / TRUST CONDITION
      +
ACTOR KNOWLEDGE
      +
ACTOR CAPABILITY
      ↓
ATTEMPT
      ↓
CONCRETE STATE EFFECTS
```

A discovered vulnerability does not itself grant DeviceAccess.

A successful technique may result in access, execution, filesystem mutation,
network activity, knowledge, or another represented effect depending on the
concrete mechanic.

Player-owned Devices should participate in the same security ontology as other
represented Devices where practical. Player ownership must not require a
separate generic playerHack mechanic.


## A12 — Actions are defined by state transitions

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


## A13 — Artifacts come from represented events

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

When concrete logging exists, audit history should be canonical, Device-owned,
and produced by the gameplay operation or represented event that actually
occurred.

Audit history must be bounded by a concrete retention rule rather than growing
without limit. Architecture does not prescribe a specific capacity today.

A Device audit log and a forensic trace are not necessarily the same artifact.

Conceptually:

```text
REPRESENTED EVENT
      │
      ├── runtime effect
      ├── Device audit record
      └── other forensic trace / evidence
```
      
One event may therefore produce several independently represented observable
consequences.

Removing one visible log entry must not automatically erase every other trace
of the event unless a concrete mechanic explicitly causes those other state
changes as well.

Likewise, clearing completed Process history is not log deletion.

Logs, traces, evidence, and their retention or manipulation must not be
fabricated by presentation code merely to create atmosphere.

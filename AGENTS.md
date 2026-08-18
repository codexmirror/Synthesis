# Synthesis Agent Guide

Use this file as the repository-wide working contract and navigation map.

It does not replace the project documentation it references.

Before significant work, inspect the current repository state rather than
assuming that an older prompt, branch, screenshot, or previous implementation
still describes `main` accurately.


## Project intent

Synthesis is a browser/mobile hacking simulation presented through fictional
operating environments such as NODE-OS.

The project favors:

- explicit simulation state
- stable identities
- shared gameplay operations
- interfaces over the same underlying truth
- incremental architecture based on demonstrated requirements
- small, reviewable implementation slices

Prefer concrete mechanics over speculative frameworks.


## Sources of truth

Use the repository documentation according to its ownership:

- `README.md`
  - project entry point
  - setup
  - basic current description

- `docs/V0.md`
  - current implemented product truth

- `docs/ARCHITECTURE.md`
  - durable architecture boundaries and invariants

- `docs/FUTURE.md`
  - confirmed future direction
  - not an implementation contract

- `docs/HANDBOOK.md`
  - development workflow
  - tool roles
  - review and acceptance discipline

- `docs/design/...`
  - feature-specific design contracts and visual references when relevant
   
- `docs/work-orders/...`
  - planned implementation work orders
  - not current implementation truth
  - execute only when explicitly selected by the human operator
  - a selected work order defines the requested task delta but does not
    override `AGENTS.md` or `docs/ARCHITECTURE.md` 

Current accepted code and current documentation matter more than stale planning
text.

Do not implement items from `FUTURE.md` merely because they are documented
there.

When a task intentionally changes current truth, update the owning documentation
as part of the same milestone when necessary.

If current code, documentation, and the task appear to contradict one another,
inspect the relevant implementation and report the conflict rather than
silently choosing an interpretation.


## Repository map

### `src/core/game/`

Pure simulation and game-domain logic.

Must remain independent of:

- React
- DOM APIs
- browser storage
- Shell navigation
- CSS
- viewport behavior
- presentation-specific state

### `src/app/`

Application boundary between React and the pure game domain.

Owns integration such as:

- current GameState hosting
- application/session operations
- invoking pure game rules
- browser-side simulation advancement in the current local prototype

### `src/apps/`

Feature interfaces such as:

- Terminal
- Scan
- Processes
- Files
- Wallet
- Notes
- System

Apps present or invoke shared functionality.

They must not create private competing versions of gameplay truth.

### `src/shell/`

NODE-OS Shell presentation and local navigation.

Shell navigation is presentation state, not gameplay state.

### `src/styles/`

Shared styling primitives and visual tokens.

### `docs/`

Accepted product, architecture, workflow, future-direction, and design
documentation.


## Core architecture invariants

### Identity

Stable internal IDs are canonical entity identity.

Do not use mutable or player-visible attributes as identity, including:

- IP addresses
- display names
- hostnames
- ports
- labels
- wallet addresses

Presentation attributes may change without changing entity identity.


### World truth and player information

Keep these concepts distinct:

- World truth
- Discovery
- Knowledge
- Capabilities
- Relationships
- Reachability / position

Do not collapse them into one generic state model.

Do not let UI convenience reveal hidden World truth that the player has not
legitimately observed.


### Entity-owned state

Simulation objects own their actual state.

Interfaces observe or modify that state through established boundaries.

Do not create parallel app-owned gameplay truth merely to make a UI easier to
implement.

Prefer:

    canonical state
        ↓
    multiple interfaces

over:

    app A state
    app B state
    terminal state


### Shared gameplay operations

Implement a gameplay operation once.

Terminal and graphical applications must call the same shared domain/application
operation.

A GUI must never construct or execute a Terminal command string in order to
perform gameplay.

Terminal commands are interfaces, not gameplay capabilities.


### Terminal

Terminal is a first-class power-user operational interface.

Terminal is not the game domain.

Keep Terminal command dependencies narrow.

Do not give commands unrestricted GameState access when a smaller read-only
context or operation is sufficient.


### Device, Firmware, Software, and operating context

Preserve the durable separation:

- Device
  - machine
  - identity
  - hardware
  - runtime resources
  - networking
  - Device-owned simulation state

- Firmware
  - operating-system identity
  - interaction model
  - presentation environment

- Software / Tools
  - installed functionality

- Session / operating context
  - which Device is currently being operated
  - under which authority

Do not move Device resources into Firmware.

Do not turn Firmware into a capability container.

Do not treat installed Tools as Firmware.


### DeviceAccess

`DeviceAccess` is a canonical relationship.

It is not:

- a `hacked` boolean
- an active Session
- the currently operated Device
- automatic remote execution
- automatic filesystem access

Do not infer those states from established access unless a future concrete
mechanic explicitly introduces them.


### Processes

Processes represent elapsed work and resource consumption.

They are not a generic action, event, job, or causality framework.

Concrete gameplay mechanics own what Process completion means.


### Systemic consequences

Prefer changing the concrete state that an action actually affects.

Other systems should react to resulting canonical state rather than to the name
of the original action.

Prefer:

    action
      ↓
    state mutation
      ↓
    independent systems observe consequences

over:

    action
      ↓
    manually script every downstream UI/game effect

Do not duplicate derived consequences when they can safely be calculated from
their underlying causes.


## Implementation discipline

Build the smallest concrete implementation required by the current task.

Do not introduce speculative abstractions merely because future systems may
eventually need them.

Avoid unless multiple implemented systems demonstrate a real shared need:

- generic engines
- event buses
- ECS
- dependency-injection frameworks
- plugin systems
- generic registries
- generic factories
- universal entity models
- generic capability frameworks
- generic action/effect frameworks
- generic causality frameworks
- generic persistence frameworks
- generic Session frameworks
- generic Firmware frameworks

A small amount of duplication is preferable to a premature universal framework
when the correct abstraction is not yet demonstrated.

Extract shared abstractions after concrete implementations reveal the common
requirement.


## State-shape changes

When canonical `GameState` shape changes:

- update the schema version according to current repository convention
- update focused tests
- update current-scope documentation where required

Do not introduce migrations or persistence compatibility unless the task
explicitly requires them.


## Presentation truth

Player-facing technical information must come from real represented state when
that state exists.

Do not manufacture fake:

- telemetry
- logs
- activity
- security state
- uptime
- traffic
- process state
- filesystem content
- alerts

purely for atmosphere.

Visual restraint is preferred over fake technical detail.

Silence is valid UI state.


## NODE-OS

NODE-OS is the Firmware environment of the player’s personal Device.

It is not the universal Synthesis interface.

Future foreign Firmware may expose the same simulation truth through radically
different navigation, presentation, convenience, or interaction models.

Do not generalize NODE-OS-specific presentation into a universal Firmware
framework without a concrete second implementation requiring it.


## Mobile and editing presentation

Mobile Safari/iPhone is a first-class target.

Preserve the established Shell-owned Editing presentation.

Do not reintroduce:

- Terminal-owned VisualViewport coordination
- `window.scrollTo` keyboard fixes
- `scrollIntoView` keyboard fixes
- fake keyboard heights
- polling-based viewport management
- arbitrary global scroll manipulation
- disabled browser zoom
- body transform hacks
- prompt relocation into Terminal output scrolling

Scrollable application regions must explicitly own their scrolling.

The Shell itself should not become an arbitrary whole-page scroll surface.

Keep existing safe-area behavior and mobile interaction contracts intact unless
the task explicitly changes them for a demonstrated reason.

Meaningful mobile interaction changes require physical iPhone/Safari review
after automated validation.


## Tests and validation

For normal code changes run:

    npm test
    npm run build

A required failing test or build blocks acceptance.

Do not:

- weaken tests merely to obtain green output
- delete architecture-contract tests because implementation conflicts with them
- replace meaningful behavioral assertions with weaker literal assertions
- hide regressions behind updated snapshots or changed expectations

Prefer tests that prove the source of truth.

For example, when UI should derive a value from GameState, use altered test
state where practical so the test would fail if the value were hardcoded.


## Documentation impact

Every significant:

- feature change
- architecture change
- gameplay change
- workflow change
- major presentation change

requires a documentation impact check.

Use document ownership:

- current implementation → `docs/V0.md`
- durable boundary → `docs/ARCHITECTURE.md`
- confirmed future direction → `docs/FUTURE.md`
- workflow/process → `docs/HANDBOOK.md`
- feature-specific design → `docs/design/...`

Do not update documentation merely to create churn.

Update it when accepted repository truth changed.


## Dependencies

Do not add external dependencies when the current stack can reasonably solve
the task.

Any new dependency must have a concrete current requirement.

Do not add libraries only to avoid implementing a small local component or
utility.


## Git lifecycle

The human operator controls:

- branch decisions
- commits
- pushes
- pull requests
- merges
- final acceptance

Unless the task explicitly delegates a specific Git action, do not:

- commit
- push
- merge
- create or close pull requests
- rewrite branch history
- reset repository state

Implementation agents should modify the working tree, validate the result, and
report completion.


## Task execution

For significant tasks:

1. inspect current repository state
2. read the relevant sources of truth
3. identify the smallest affected boundaries
4. implement only the requested slice
5. add or update focused tests
6. run required validation
7. perform a documentation impact check
8. inspect the resulting diff for unrelated changes
9. report completion and remaining concerns

Do not silently expand scope because a nearby future feature appears useful.


## Completion report

Finish implementation tasks with a concise report containing:

- files changed
- important implementation or architecture decisions
- tests run and exact results
- production build result
- documentation impact
- deviations from the requested scope, if any
- concrete remaining concerns requiring human review

For meaningful mobile UI work, explicitly state that physical iPhone/Safari
validation remains required when it has not yet been performed.
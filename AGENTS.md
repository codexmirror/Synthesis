# Synthesis Agent Guide

This file is the repository-wide contract for implementation agents. It is the
bootloader, the global constitution, and the execution contract.

It is agent-neutral: Codex, Claude Code, or any other implementation agent
follows the same rules. Harness-specific files (`CLAUDE.md`, `.claude/...`) may
route or load this knowledge; they never own it.

It does not restate the documentation it routes to.


## Before editing

1. Inspect current `main`. Accepted code is canonical repository truth — not an
   older prompt, branch, screenshot, or prior conversation.
2. Read this file.
3. Classify the task domain.
4. Open [`docs/README.md`](docs/README.md), the documentation portal.
5. Resolve the **smallest sufficient Read Set** from the matching route.
6. Read the normative current owner for that domain (`docs/current/...`).
7. Read only the Architecture invariants and Design contracts the task depends
   on.
8. Inspect the relevant implementation and its focused tests.
9. Implement the smallest requested delta.

Normal implementation agents **must not** read the entire documentation tree by
default.

Repository or knowledge audits are an explicit exception and may require broad
inspection; say so when you take it.


## Source-of-truth authority

```text
CURRENT IMPLEMENTED BASELINE
= current accepted code/tests + normative docs/current domain owner

DURABLE CONSTRAINTS
= AGENTS.md + docs/ARCHITECTURE.md + owning architecture module

REQUESTED DELTA
= explicitly selected Work Order

ACTIVE DESIGN AUTHORITY
= relevant Accepted design contract when the task depends on it

SUMMARY / INDEX
= docs/V0.md

FUTURE DIRECTION
= docs/FUTURE.md
```

Every accepted fact has one normative owner. Summaries, indexes and routing
descriptions are allowed; competing normative definitions are not.

A selected work order under `docs/work-orders/...` defines the requested delta.
It is not current truth and does not override this file or the architecture
invariants. Archived work orders are historical only.

These are distinct authority axes, not a linear hierarchy in which current code
silently overrides a durable Architecture invariant. An apparent violation of
such an invariant is a conflict or bug requiring inspection.

Do not implement something merely because `docs/FUTURE.md` describes it.


## Repository conflicts

If current code, owning documentation, and the task appear to contradict one
another:

1. verify against current `main` where the conflict concerns implemented
   behavior;
2. treat a source as stale only where accepted evidence clearly shows it is;
3. otherwise **surface the conflict** — in your completion report and, where
   the conflict is durable, in the owning document — rather than silently
   choosing an interpretation.

A work order asking current code to change is not a contradiction.


## Global architecture rules

These are the durable rules every implementation must respect. Each is stated
in full by the module named in `docs/ARCHITECTURE.md`; read only the ones the
task needs.

- **Stable identity (A01).** Stable internal IDs are entity identity. IP
  addresses, ports, network names, display names, hostnames, labels and wallet
  addresses are mutable attributes and must never become identity.
- **Entity-owned state (A02).** Simulation truth belongs to the entity or
  relationship it describes. Interfaces observe or modify it; they never keep a
  competing copy because a local one is convenient.
- **World Truth vs Player Information (A03, A04).** World Truth, Discovery,
  Knowledge, capabilities, relationships and reachability stay distinct. A UI
  must not leak hidden current truth or silently correct a stale player belief.
- **Shared gameplay operations (A05).** Implement a gameplay operation once
  behind a domain/application boundary. Terminal and graphical interfaces call
  the same operation, and a GUI never performs gameplay by building a Terminal
  command string. Terminal is an interface, not the game domain, and receives
  narrow context rather than unrestricted `GameState`.
- **Command is not capability (A06).** An interface verb does not prove the
  player currently has the software, information, access, position or resources
  to succeed.
- **Device / Firmware / Software / Session (A07).** These stay separate.
  Firmware never owns hardware, runtime, networking, filesystem or installed
  software, and installed software is not Firmware.
- **Access is a relationship (A08).** `DeviceAccess` is not a hacked flag, an
  active connection, a Session, or automatic remote execution or filesystem
  access.
- **Observation roles (A09).** Scan, Inspect and Analyze have distinct
  epistemic roles and must not become a mandatory universal pipeline. Browsing
  remembered information is never a new observation.
- **Processes are work (A10).** A Process is elapsed work and resource
  consumption, not an event bus, job framework, or causality layer. The
  mechanic that creates it owns what completion means.
- **Mutate causes, derive consequences (A11, A12).** Change the concrete state
  an action actually affects and let other systems react to that state.
- **Filesystem truth belongs to the Device (A17).** Files, Terminal and every
  other surface read the same Device-owned filesystem. Artifact identity is not
  path recognition.
- **Wallets and currency (A18).** Economic truth is canonical represented
  state, never an interface-local counter, and Wallet identity is not its
  address.


Repository boundaries (`src/core/game/`, `src/app/`, `src/apps/`, `src/shell/`,
`src/styles/`) and the canonical ownership reference are owned by
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Pure simulation logic in
`src/core/game/` must stay independent of React, DOM APIs, browser storage,
Shell navigation, CSS, and viewport behavior.


## Implementation discipline

Build the smallest concrete implementation the current task requires.

Do not silently expand scope because a nearby feature looks useful.

Avoid speculative frameworks unless multiple implemented systems demonstrate a
real shared need: generic engines, event buses, ECS, dependency injection,
plugin systems, generic registries/factories, universal entity models, and
generic capability, action/effect, causality, persistence, Session or Firmware
frameworks. A small amount of concrete duplication is preferable to a premature
universal abstraction.

When canonical `GameState` shape changes, update the schema version according
to current repository convention and update focused tests. Do not introduce
migrations or persistence compatibility unless the task explicitly requires
them.

Player-facing technical information must come from real represented state.
Never manufacture fake telemetry, logs, activity, security state, uptime,
traffic, process state, filesystem content or alerts for atmosphere. Silence is
a valid UI state.

NODE-OS is the Firmware environment of the player's personal Device, not the
universal Synthesis interface. Do not generalize NODE-OS presentation into a
universal Firmware framework without a concrete second implementation requiring
it.


## Mobile and editing presentation

Mobile Safari/iPhone is a first-class target. Preserve the established
Shell-owned Editing presentation.

Do not reintroduce: Terminal-owned VisualViewport coordination,
`window.scrollTo` or `scrollIntoView` keyboard fixes, fake keyboard heights,
polling-based viewport management, arbitrary global scroll manipulation,
disabled browser zoom, body transform hacks, or prompt relocation into Terminal
output scrolling.

Scrollable application regions explicitly own their scrolling; the Shell is not
an arbitrary whole-page scroll surface.

Meaningful mobile interaction changes require physical iPhone/Safari review
after automated validation. Agent interactive validation does not replace it.


## Dependencies

Do not add an external dependency when the current stack can reasonably solve
the task. Any new dependency needs a concrete current requirement. Do not add a
library merely to avoid implementing a small local utility.


## Validation

For normal code changes run:

```bash
npm test
npm run build
```

For documentation changes also run:

```bash
npm run docs:check
```

A required failing test, build, or check blocks acceptance.

Do not weaken tests to obtain green output, delete architecture-contract tests
because the implementation conflicts with them, replace behavioral assertions
with weaker literal ones, or hide regressions behind updated snapshots.

Prefer tests that prove the source of truth: when a UI value must derive from
`GameState`, use altered test state so the test would fail if the value were
hardcoded.


## Documentation impact

Documentation impact planned before implementation is **expected and
provisional**. **No draft is complete until final documentation impact is
reconciled from the actual completed diff.**

Before Draft delivery, inspect the final changed-file set and semantic delta,
classify every affected truth domain (not only the task's primary domain), and
distinguish:

- **Owner impact:** normative truth changed, so its owner must change.
- **Reference impact:** a non-normative summary, index, routing description, or
  cross-reference became stale or misleading. Correct it or remove the
  unnecessary duplicate without making it a competing owner.

For every task, state the final impact on each of:

- Current truth → `docs/current/<domain>.md` (and `docs/V0.md` only when the
  product-level snapshot itself became wrong)
- Architecture → the owning module under `docs/architecture/`
- Design → the owning contract under `docs/design/`
- Workflow → `docs/HANDBOOK.md` or `AGENTS.md`
- Future → `docs/FUTURE.md`

Each is either a concrete owner that must be updated in the same branch, or
`None` with a concrete reason.

Update only the document that owns the changed truth. Do not create churn
because a code file changed, and do not copy one fact into several documents.


## Git and delivery

The human operator owns final acceptance and merge authority.

Unless the selected task explicitly delegates it, do not: commit, push, merge,
create or close pull requests, rewrite branch history, or reset repository
state.

Where a task explicitly delegates delivery, the delegated actions are normally:
create or use the task branch, commit the implementation, push, and open or
update a **Draft** PR. Merge, force-push, destructive history rewrite, and
final acceptance are never delegated by default.


## Completion report

Finish implementation tasks with a concise report containing:

- files changed
- important implementation or architecture decisions
- tests added or changed and their exact results
- exact production build result
- documentation impact, resolved per the section above
- deviations from the requested scope, if any
- unresolved conflicts or concrete concerns requiring human review

For meaningful mobile UI work, state explicitly whether physical iPhone/Safari
validation has been performed.

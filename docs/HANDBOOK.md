# Synthesis Development Handbook

This handbook defines the current tool roles, development loop, and review discipline.

Repository documentation and accepted code describe project reality; experiments and plans become canonical only through explicit review and integration.


## 1. Development principles

Prefer:

- small, explicit boundaries
- shared gameplay logic behind every interface
- simple TypeScript over speculative frameworks
- incremental architecture based on demonstrated requirements
- reproducible tests and builds
- focused, reviewable changes

Avoid:

- hidden cross-feature coupling
- duplicated gameplay logic
- accidental promotion of experiments
- large unreviewed rewrites
- mutable visible identifiers as entity identity
- UI components directly mutating unrelated gameplay state

**Prototype aggressively. Integrate conservatively.**


## 2. Sources of truth

The `codexmirror/Synthesis` repository is canonical, and accepted `main` is the canonical product state.

Work output, screenshots, notes, generated artifacts, planning documents, and local branches are not accepted merely because they exist. A tested implementation may nevertheless become the exact source integrated into the repository after review.

For repository-dependent decisions, inspect the actual repository rather than inferring its state from an older prompt, screenshot, branch, conversation, or work order.

Documentation has explicit ownership:

- `README.md`
  - project entry point
  - setup
  - basic current description

- `AGENTS.md`
  - repository-wide working contract for implementation agents
  - source navigation
  - implementation discipline
  - validation and Git boundaries

- `docs/V0.md`
  - current implemented product truth

- `docs/ARCHITECTURE.md`
  - durable architecture boundaries and invariants

- `docs/FUTURE.md`
  - confirmed future product and simulation direction
  - not an implementation contract

- `docs/HANDBOOK.md`
  - development workflow
  - tool roles
  - review and acceptance discipline

- `docs/design/...`
  - feature-specific design contracts and visual references where relevant

- `docs/work-orders/...`
  - planned implementation deltas
  - not current implementation truth
  - executable only when explicitly selected by the human operator

Current accepted code and current owning documentation matter more than stale planning text.

A selected work order defines the requested implementation delta from current `main`, but it does not override `AGENTS.md` or `docs/ARCHITECTURE.md`.

Do not implement items from `docs/FUTURE.md` merely because they are documented there.

When a task intentionally changes current truth, update the owning documentation as part of the same milestone when necessary.

If current code, documentation, and the selected task appear to contradict one another, inspect the relevant implementation and report the conflict rather than silently choosing an interpretation.

Repository documentation must be written in English. Discussion and planning may use another language.


## 3. Tool roles

### ChatGPT and Work

ChatGPT is the coordination and review layer.

It supports:

- scope decisions
- architecture and product decisions
- repository and diff review
- interpretation of physical-device evidence
- milestone selection
- task preparation
- development discipline

Work is the primary planning, UX, interaction, and implementation-experiment workspace.

It may:

- analyze architecture and product direction
- explore UX and compare alternatives
- build and test reference implementations
- produce exact source files or canonical implementation exports and patches
- prepare implementation handoffs
- review browser and physical-device evidence

Work may move quickly, but its output crosses an explicit approval and integration boundary.

It is not restricted to disposable mockups, and an approved tested implementation need not be recreated from prose.


### Codex

Codex is the repository execution and implementation agent.

Depending on the selected task, it may:

- inspect repository state
- implement repository changes
- mechanically apply an exact approved handoff
- integrate files or patches
- refactor or harden implementation
- add or update focused tests
- run tests and production builds
- inspect the resulting diff
- investigate repository inconsistencies

For ordinary gameplay, domain, and repository work, Codex may be the primary implementer.

Codex should preserve an approved exact handoff rather than reinterpret it unnecessarily and must report meaningful deviations.

Codex does not own the Git lifecycle unless a specific Git action is explicitly delegated.


### Human operator

The human operator controls:

- branch decisions
- commits
- pushes
- pull requests
- merges
- final acceptance

unless explicitly delegating a specific action.

Routine Codex tasks should not instruct Codex to perform those Git lifecycle actions.

Manual edits remain appropriate for small, known, low-risk corrections.

The same review, testing, and documentation discipline applies regardless of who makes an edit.


## 4. Current development loop

```text
Idea / problem
    ↓
Work / ChatGPT analysis
    ↓
selected implementation or implementation handoff
    ↓
current main inspected
    ↓
repository implementation
    ↓
tests / production build
    ↓
local Vite server when useful
    ↓
physical iPhone / browser validation when relevant
    ↓
diff and behavior review
    ↓
Git lifecycle controlled by operator
    ↓
main
    ↓
GitHub Pages canonical deployment
```

The local Vite server supports rapid iteration and physical-device testing.

An experimental mobile adjustment does not require a Pages deployment before it can be tested.

GitHub Pages is the canonical deployed representation of accepted `main`; its workflow installs dependencies, runs tests, builds, and then deploys.

Review the actual diff and evidence, not just whether a change appears plausible.

A failed required test or build blocks acceptance.

Do not weaken checks merely to obtain a deployment.


## 5. Work implementation handoffs

Work can provide either of two handoff types.


### A. Behavior / design handoff

Include:

- observed problem and evidence
- confirmed root cause and clearly labeled hypotheses
- alternatives considered
- selected behavior
- acceptance criteria
- shared, feature-specific, browser, or implementation constraints


### B. Canonical implementation export

When Work has implemented and tested the solution, include:

- exact source files or a unified patch against a known base
- a file manifest
- validation results
- base and traceability information

Integration should normally be mechanical:

```text
tested Work implementation
    ↓
exact patch / files
    ↓
apply and integrate
    ↓
tests
    ↓
production build
    ↓
device validation when relevant
```

Review still determines whether the export is accepted.

Codex should not recreate an exact approved implementation from a prose summary.


## 6. Architecture and interface discipline

Durable architectural constraints belong to `docs/ARCHITECTURE.md`.

This handbook summarizes only the implementation discipline required by the development workflow.

Pure game-domain code must not depend on:

- React
- shell navigation
- app components
- DOM APIs
- browser storage
- viewport behavior
- presentation-specific state

Shell navigation is presentation state, not gameplay state.

Stable internal IDs — not IP addresses, hostnames, display names, ports, or wallet addresses — identify simulation entities.

Gameplay operations should be implemented once and exposed to each interface that needs them:

```text
                 GAME DOMAIN
                      │
          shared gameplay operations
                      │
              ┌───────┴───────┐
              │               │
           Terminal         GUI apps
```

Terminal is intended to be a first-class power-user operational interface, but Terminal is not the domain.

A GUI must not generate or execute a Terminal command string in order to perform gameplay.

Current implemented gameplay includes:

- Scan
- Inspect
- Service Analysis
- Credential Access
- persistent `DeviceAccess`

Current implementation does **not** include:

- CONNECT
- active Remote Sessions
- remote operating contexts
- remote filesystem access
- privilege escalation
- broader hacking systems

`DeviceAccess` is an established canonical relationship. It is not an active connection or remote Session.

Build concrete state mutations before extracting abstractions.

Do not introduce plugin systems, event buses, dependency-injection frameworks, generic game engines, ECS, generic persistence frameworks, or similar universal abstractions without a demonstrated requirement.

Use `docs/ARCHITECTURE.md` rather than duplicating its full invariant set here.


## 7. Mobile and interaction validation

Mobile is a first-class target.

Meaningful interaction changes should be checked for:

- viewport stability
- safe areas
- software-keyboard behavior
- touch targets
- overflow
- navigation
- scrolling ownership
- focus
- readable density

The current shell uses a dedicated Editing presentation for editable controls on mobile-style layouts.

The shell should not become an arbitrary whole-page scroll surface.

Scrolling regions explicitly own their scrolling.

Validate meaningful mobile interaction work on a real iPhone/Safari.

Desktop screenshots and automated viewport tests are useful but not sufficient evidence for physical mobile behavior.

The opt-in viewport overlay retained in the repository is internal diagnostic tooling.

It is not gameplay or a promised public feature and should only be documented further if that materially helps investigation.


## 8. Review and acceptance

Keep changes focused.

Review:

- requested scope
- explicit exclusions
- architecture boundaries
- source-of-truth ownership
- focused tests
- unintended coupling
- mobile impact where relevant
- documentation accuracy
- the complete resulting diff

Planned systems justify clean seams but not placeholder implementation.

Before accepting a significant change, confirm:

1. the exact problem and explicit exclusions
2. whether the work is experimentation or an implementation intended for integration
3. the current repository base and affected boundaries
4. that logic is not duplicated
5. that speculative architecture was not introduced
6. the required automated, browser, and physical-device evidence
7. that owning documentation remains accurate
8. who is authorized to perform each Git lifecycle action


## 9. Documentation ownership and anti-drift

Use the repository documentation according to its role:

- `README.md`
  - entry point
  - technology and setup
  - short current product description

- `AGENTS.md`
  - repository-wide implementation-agent contract
  - navigation and execution discipline

- `docs/V0.md`
  - current implemented product truth

- `docs/ARCHITECTURE.md`
  - durable architecture boundaries and invariants

- `docs/FUTURE.md`
  - confirmed future direction
  - not implementation authority

- `docs/HANDBOOK.md`
  - development process
  - tool roles
  - review discipline

- `docs/design/...`
  - feature-specific design authority and references where applicable

- `docs/work-orders/...`
  - planned implementation deltas
  - executable only after explicit human selection

Every significant feature, architecture, gameplay, workflow, or major presentation change requires a documentation impact check.

This does not require Markdown changes every time.

The implementer and reviewer must explicitly decide whether any owning document became inaccurate.

If accepted current product truth changed, update `docs/V0.md`.

If a durable architectural decision changed, update `docs/ARCHITECTURE.md`.

If confirmed long-term direction changed, update `docs/FUTURE.md`.

If workflow or review discipline changed, update this handbook.

If a feature-specific design contract changed, update the appropriate file under `docs/design/`.

If a planned implementation delta changed, update the appropriate work order without treating that work order as current implementation truth.

The goal is simple:

**Repository documentation must describe accepted reality at the level each document owns.**
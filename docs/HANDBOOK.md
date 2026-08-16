# Synthesis Development Handbook

This handbook defines the current tool roles, development loop, and review discipline. Repository documentation and accepted code describe project reality; experiments and plans become canonical only through explicit review and integration.

## 1. Development principles

Prefer small, explicit boundaries; shared gameplay logic behind every interface; simple TypeScript over speculative frameworks; incremental architecture based on demonstrated requirements; reproducible tests and builds; and focused, reviewable changes.

Avoid hidden cross-feature coupling, duplicated gameplay logic, accidental promotion of experiments, large unreviewed rewrites, mutable visible identifiers as entity identity, and UI components directly mutating unrelated state.

**Prototype aggressively. Integrate conservatively.**

## 2. Sources of truth

The `codexmirror/Synthesis` repository is canonical, and accepted `main` is the canonical product state. Work output, screenshots, notes, generated artifacts, and local branches are not accepted merely because they exist. A tested Work implementation may nevertheless become the exact source integrated into the repository after review.

For repository-dependent decisions, inspect the actual repository rather than inferring its state. Documentation must distinguish current implementation from future direction and must be written in English; discussion and planning may use another language.

## 3. Tool roles

### ChatGPT and Work

ChatGPT is the coordination and review layer. It supports scope, architecture and product decisions, repository and diff review, interpretation of physical-device evidence, milestone selection, task preparation, and development discipline.

Work is the primary planning, UX, interaction, and implementation-experiment workspace. It may:

- analyze architecture and product direction;
- explore UX and compare alternatives;
- build and test reference implementations;
- produce exact source files or canonical implementation exports and patches;
- prepare implementation handoffs; and
- review browser and physical-device evidence.

Work may move quickly, but its output crosses an explicit approval and integration boundary. It is not restricted to disposable mockups, and an approved tested implementation need not be recreated from prose.

### Codex

Codex is the repository execution and implementation agent. Depending on the task, it may implement repository changes, mechanically apply an exact Work handoff, integrate files or patches, refactor, harden, run tests and builds, inspect diffs, and investigate repository state. For ordinary gameplay, domain, and repository work, Codex may be the primary implementer.

Codex should preserve an approved exact handoff rather than reinterpret it unnecessarily and must report deviations. It does not own the Git lifecycle.

### Human operator

The human operator controls branch decisions, commits, pushes, pull requests, merges, and final acceptance unless explicitly delegating a specific action. Routine Codex tasks should not instruct Codex to perform those Git lifecycle actions.

Manual edits remain appropriate for small, known, low-risk corrections. The same review, testing, and documentation discipline applies regardless of who makes an edit.

## 4. Current development loop

```text
Idea / problem
    ↓
Work / ChatGPT analysis
    ↓
implementation or implementation handoff
    ↓
local repository execution
    ↓
tests / production build
    ↓
local Vite server when useful
    ↓
physical iPhone / browser validation when relevant
    ↓
review
    ↓
Git lifecycle controlled by operator
    ↓
main
    ↓
GitHub Pages canonical deployment
```

The local Vite server supports rapid iteration and physical-device testing. An experimental mobile adjustment does not require a Pages deployment before it can be tested. GitHub Pages is the canonical deployed representation of accepted `main`; its workflow installs dependencies, runs tests, builds, and then deploys.

Review the actual diff and evidence, not just whether a change appears plausible. A failed required test or build blocks acceptance; do not weaken checks merely to obtain a deployment.

## 5. Work implementation handoffs

Work can provide either of two handoff types.

### A. Behavior / design handoff

Include:

- observed problem and evidence;
- confirmed root cause and clearly labeled hypotheses;
- alternatives considered;
- selected behavior;
- acceptance criteria; and
- shared, feature-specific, browser, or implementation constraints.

### B. Canonical implementation export

When Work has implemented and tested the solution, include:

- exact source files or a unified patch against a known base;
- a file manifest;
- validation results; and
- base and traceability information.

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

Review still determines whether the export is accepted. Codex should not recreate an exact approved implementation from a prose summary.

## 6. Architecture and interface discipline

Pure game-domain code must not depend on React, shell navigation, app components, DOM APIs, or browser storage. Shell navigation is presentation state, not gameplay state. Stable internal IDs—not IP addresses, hostnames, display names, or wallet addresses—identify entities. State should grow by domain slice, and external services remain behind application boundaries.

A gameplay operation must be implemented once and exposed to every interface that needs it:

```text
                 GAME DOMAIN
                      │
          shared gameplay operations
                      │
              ┌───────┴───────┐
              │               │
           Terminal         GUI apps
```

Terminal is intended to be the primary power-user operational interface, but Terminal is not the domain. A GUI must not generate a Terminal command string to perform gameplay. Scan, Inspect, and Service Analysis exist; connect, exploit, and access do not.

Build concrete state mutations before extracting abstractions. Do not introduce plugin systems, event buses, dependency-injection frameworks, generic game engines, ECS, or generic persistence frameworks without a demonstrated requirement.

## 7. Mobile and interaction validation

Mobile is a first-class target. Meaningful interaction changes should be checked for viewport stability, safe areas, software-keyboard behavior, touch targets, overflow, navigation, scrolling ownership, focus, and readable density.

The current shell uses a dedicated Editing presentation for editable controls on mobile-style layouts. The shell should not become an arbitrary whole-page scroll surface: scrolling regions explicitly own their scrolling. Validate mobile interaction work on a real iPhone/Safari; desktop screenshots and automated viewport tests are useful but not sufficient evidence.

The opt-in viewport overlay retained in the repository is internal diagnostic tooling. It is not gameplay or a promised public feature and should only be documented further if that materially helps investigation.

## 8. Review and acceptance

Keep changes focused. Review scope, architectural boundaries, tests, unintended coupling, mobile impact where relevant, and documentation accuracy. Planned systems—including scanning, traces, malware, progression, organizations, multiplayer, and external integrations—justify clean seams but not placeholder implementation.

Before accepting a significant change, confirm:

1. the exact problem and explicit exclusions;
2. whether the work is experimentation or an implementation intended for integration;
3. the repository base and affected boundaries;
4. that logic is not duplicated and speculative architecture was not introduced;
5. the required automated, browser, and physical-device evidence; and
6. who is authorized to perform each Git lifecycle action.

## 9. Documentation ownership and anti-drift

- `README.md`: project entry point, technology, setup, and basic current description.
- `V0.md`: current implemented scope.
- `FUTURE.md`: confirmed directions that are not implementation contracts.
- `ARCHITECTURE.md`: durable boundaries established by the codebase.
- `HANDBOOK.md`: current process, tool roles, workflow, and review discipline.

Every significant feature, architecture, or workflow change requires a documentation impact check. This does not require Markdown changes every time; the author and reviewer must explicitly decide whether any of the five documents above became inaccurate. If so, update the owning document in the same milestone or immediately afterward.

The goal is simple: repository documentation describes accepted reality.

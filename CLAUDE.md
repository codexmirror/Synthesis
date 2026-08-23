# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Start here: `AGENTS.md`

This repository already has a detailed, actively maintained agent contract at
[`AGENTS.md`](AGENTS.md) plus an ownership-scoped documentation set under
`docs/`. **Read `AGENTS.md` and `docs/ARCHITECTURE.md` before non-trivial
work.** This file is a quick-reference layer on top of them, not a
replacement — if anything here conflicts with `AGENTS.md` or `docs/`, those
files win.

Documentation ownership (do not duplicate facts across these — reference the
owner instead):

| Source | Owns |
| --- | --- |
| `README.md` | Project entry point, setup, tech stack |
| `AGENTS.md` | Repository-wide agent working contract |
| `docs/V0.md` | Current implemented product truth (what exists today) |
| `docs/ARCHITECTURE.md` | Durable architecture invariants (A01–A18) |
| `docs/FUTURE.md` | Long-term direction — not an implementation contract |
| `docs/HANDBOOK.md` | Workflow, roles, review/acceptance process |
| `docs/design/...` | Feature-specific design contracts |
| `docs/work-orders/...` | Planned deltas — executable only when explicitly selected |

Before implementing a feature, check `docs/V0.md` for current behavior and
`docs/ARCHITECTURE.md` for the invariants it must respect; don't rely on
memory of an earlier session or a stale branch.

## Commands

```bash
npm install       # setup (Node.js 18+)
npm run dev        # start Vite dev server
npm run build       # tsc -b && vite build (type-check + production build)
npm test          # vitest run (single run, not watch mode)
```

There is no separate lint script; `npm run build`'s `tsc -b` is the
type-checking gate. There is no lint/format config in the repo.

Run a single test file or a subset:

```bash
npx vitest run src/core/game/scan.test.ts
npx vitest run -t "test name substring"
npx vitest        # watch mode, useful while iterating locally
```

Required validation for any code change is `npm test` and `npm run build`
(this is also what CI in `.github/workflows/pages.yml` runs before deploying
to GitHub Pages on `main`). A failing test or build blocks acceptance — don't
weaken a test or delete architecture-contract coverage to get green output.

## Architecture

Synthesis is a browser/mobile hacking-simulation prototype (React 18 +
TypeScript + Vite, tested with Vitest/Testing Library/jsdom) presented
through a fictional OS shell, NODE-OS. The layering is strict and enforced
by convention, not by a lint rule — respect it when adding code:

```
src/core/game/   pure simulation domain — no React, DOM, storage, CSS, or
                 presentation state. Owns GameState shape and all gameplay
                 rules (scan, inspect, processes, credential access, remote
                 sessions, filesystem, software installation, wallet, ...).

src/app/         boundary between React and src/core/game. GameContext.tsx
                 hosts the current GameState in a React context, calls pure
                 core/game operations, and advances Process state on a timer.
                 Actions here are the ONLY way UI code mutates GameState.

src/apps/<name>/ feature interfaces (terminal, network/NodeScan, processes,
                 files, wallet, notes, system, rackos). Each app renders UI
                 and calls shared src/app operations — apps must not invent
                 their own competing copy of gameplay truth.

src/shell/       NODE-OS shell chrome, app registration/navigation
                 (appRegistry.tsx), and the mobile Editing-presentation
                 pipeline (editingViewportGeometry / editingScrollOwnership /
                 editingPresentationPlane). Shell navigation is presentation
                 state, not gameplay state.

src/styles/      shared CSS tokens/primitives — no gameplay logic.
```

Data flow is one-directional: `interface → src/app operation → src/core/game
domain rule → new GameState → React re-render`. Core operations are pure
functions that take `GameState` (or a narrow slice of it) and return either a
new `GameState` or a typed result object (commonly `{ status: '...' , state
}}`); see `src/core/game/serviceAnalysis.ts`, `credentialAccess.ts`,
`remoteSession.ts`, `remoteDownload.ts`, `softwareInstallation.ts` for the
pattern, and `GameContext.tsx` for how `src/app` wires results back into
React state.

**Shared operations, not duplicated logic.** A gameplay capability (scan,
analyze, attack, connect, download, install, ...) is implemented once in
`src/core/game`/`src/app` and invoked from every interface that exposes it.
For example, Terminal's `scan` command and the graphical NodeScan app both
call the same scan operation — a GUI must never build and execute a Terminal
command string to perform gameplay, and Terminal must not become the game
domain itself. Terminal commands live in `src/apps/terminal/commands/*` and
are registered in `src/apps/terminal/registry.ts`; give each command the
narrowest context it needs rather than unrestricted `GameState`.

**GameState is a single versioned, in-memory blob**, freshly created per
session (`createInitialGameState` in `src/core/game/initialState.ts`). There
is no save/load or migration system. `GAME_STATE_VERSION` in that file is the
schema version (currently 17) — bump it when the canonical `GameState` shape
changes, and update the corresponding note in `docs/V0.md`.

### Key domain distinctions to preserve

These recur throughout `docs/ARCHITECTURE.md` and are easy to accidentally
collapse when adding a feature:

- **Identity vs. presentation** — stable internal IDs are entity identity;
  IPs, hostnames, display names, wallet addresses, ports are mutable
  presentation attributes and must never be used as identity.
- **World Truth vs. Discovery vs. Knowledge** — what currently exists, vs.
  what the player has positively observed and remembered, vs. deeper learned
  information. Don't let a UI reveal hidden World Truth the player hasn't
  legitimately observed, and don't let Discovery silently rewrite itself when
  World Truth changes.
- **Device vs. Firmware vs. Software vs. DeviceAccess vs. Session** — a
  Device owns hardware/runtime/filesystem/networking; Firmware (e.g.
  NODE-OS, RACK-OS) is only the OS identity/presentation layer over a
  Device; installed Software is not Firmware; `DeviceAccess` is an
  established relationship (not a `hacked` boolean, not a session, not
  automatic remote execution or filesystem access); a `RemoteSession` is
  active operating context built from existing `DeviceAccess`, not a
  replacement for the local Device.
- **Scan / Inspect / Analyze** are distinct epistemic operations (explore
  outward / observe a known target's own state / do deeper resource-costing
  investigation) — don't force them into one mandatory pipeline.
- **Processes** represent elapsed work + resource consumption for a specific
  mechanic (Service Analysis, Credential Access); they are not a generic
  event/action/job bus.

When in doubt about any of the above, `docs/ARCHITECTURE.md` invariants
A01–A18 are the authoritative, numbered reference — cite the ID (e.g. "A05")
when explaining a design decision.

### Mobile

Mobile Safari/iPhone is a first-class target. The Shell owns a specific
viewport/editing-presentation contract (`src/shell/editing*.ts`) built around
a measure → validate → classify → accept-or-hold → publish pipeline for
software-keyboard handling. Do not reintroduce ad hoc fixes it deliberately
avoids: `window.scrollTo`/`scrollIntoView` keyboard hacks, polling-based
viewport management, fake keyboard heights, or disabling browser zoom.
Automated tests and desktop emulation don't substitute for physical
iPhone/Safari validation on meaningful interaction changes.

## Conventions

- Prefer the smallest concrete implementation the task requires. Generic
  engines/event-buses/ECS/plugin systems/DI frameworks are explicitly out of
  scope until multiple concrete implementations demonstrate the shared need
  (see AGENTS.md "Implementation discipline").
- Don't add new dependencies unless the current stack genuinely can't solve
  the task.
- Tests live alongside implementation as `*.test.ts`/`*.test.tsx`. Prefer
  tests that prove state is derived from canonical `GameState` (e.g. assert
  against altered test state) over tests that only check a default literal.
- Git lifecycle (branching, commits, pushes, PRs, merges) is controlled by
  the human operator/task instructions — don't take those actions unless the
  task explicitly asks for them.
- Every significant change gets a documentation-impact check: update only
  the doc that owns the changed truth (see the ownership table above), and
  don't copy the same fact into multiple docs.

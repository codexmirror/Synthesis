# Migration notes — Repository Knowledge Architecture V1

Status: Historical
Scope: One-time record of the V1 knowledge migration: where accepted truth
moved, what was deliberately left intact, which contradictions were discovered,
and how the PR #104 hardening review resolved them.

This document is a historical record. It is not current truth, not a Read Set
entry for implementation work, and it does not override any owner it describes.


## Where accepted truth moved

| Previous location | New normative owner |
| — | — |
| `docs/V0.md` → product foundation, presentation language, Terminal, Notes, mobile/editing presentation | [`current/INTERFACE_SHELL.md`](current/INTERFACE_SHELL.md) |
| `docs/V0.md` → GameState areas, represented World, transfer capacity, System | [`current/DEVICE_SYSTEM.md`](current/DEVICE_SYSTEM.md) |
| `docs/V0.md` → NodeScan/Scan, Inspect, Discovery, Service Analysis, Knowledge, Credential Access, DeviceAccess, Remote Session, Authentication History | [`current/NETWORK_ACCESS.md`](current/NETWORK_ACCESS.md) |
| `docs/V0.md` → Files, FileTransfer, packages, installation, removal, executables, software management | [`current/FILES_SOFTWARE.md`](current/FILES_SOFTWARE.md) |
| `docs/V0.md` → Processes and Activity Monitor | [`current/PROCESSES_ACTIVITY.md`](current/PROCESSES_ACTIVITY.md) |
| `docs/V0.md` → NODE mining economics, payout log, `node-miner` CLI, Wallet | [`current/NODE_ECONOMY.md`](current/NODE_ECONOMY.md) |
| `docs/ARCHITECTURE.md` → A01–A04, A09, Discovery/observation prose, stale-input rules | [`architecture/IDENTITY_AND_INFORMATION.md`](architecture/IDENTITY_AND_INFORMATION.md) |
| `docs/ARCHITECTURE.md` → A05–A06, presentation truth, interface/mobile boundaries | [`architecture/INTERFACES_AND_PRESENTATION.md`](architecture/INTERFACES_AND_PRESENTATION.md) |
| `docs/ARCHITECTURE.md` → A07–A08, A17, device/operating-context prose | [`architecture/DEVICES_AND_ACCESS.md`](architecture/DEVICES_AND_ACCESS.md) |
| `docs/ARCHITECTURE.md` → A10–A13 | [`architecture/RUNTIME_AND_CONSEQUENCES.md`](architecture/RUNTIME_AND_CONSEQUENCES.md) |
| `docs/ARCHITECTURE.md` → A14–A16 | [`architecture/SIMULATION_EVOLUTION.md`](architecture/SIMULATION_EVOLUTION.md) |
| `docs/ARCHITECTURE.md` → A18 | [`architecture/ECONOMY_AND_WALLETS.md`](architecture/ECONOMY_AND_WALLETS.md) |
| `AGENTS.md` → repository map (`src/*` boundaries) | [`ARCHITECTURE.md`](ARCHITECTURE.md) (repository boundaries), which already owned the fuller version |
| `AGENTS.md` → long feature-specific explanations | the domain owner under [`current/`](current/) |

`docs/ARCHITECTURE.md` retains, as the index: the invariant register, the
repository boundaries, the canonical ownership reference, the design test, and
the architecture change rule.

Invariant text was moved verbatim. Architecture IDs A01–A18 are unchanged,
unique, and each defined in exactly one module.


## Deliberately left intact

- **`docs/FUTURE.md`** — not modularized. It is read rarely and as a whole when
  it is read at all; splitting it would add navigation cost without reducing
  default agent context, since it is not default implementation context.
- **`docs/design/*`** — content unchanged apart from added status headers.
  These are accepted contracts; rewriting them would have changed accepted
  design meaning.
- **`docs/work-orders/archived/*`** — untouched historical records.
- **Gameplay code and tests** — unchanged. This migration adds only
  `scripts/docs-check.mjs` and its `package.json` script entry.


## Corrections made under existing accepted evidence

1. **`docs/V0.md` "Not currently implemented" list.** It listed *remote
   filesystem access*, *foreign Remote Session operating surface*, and *foreign
   operable Firmware* as unimplemented, while the same document's Remote
   Session section — and `src/apps/rackos/` with its tests — describe exactly
   those as implemented. Current `main` disproves the list entries, so they
   were removed. Remote execution, remote Processes and remote compute remain
   unimplemented and are still listed.

2. **`docs/V0.md` software-installation section** ended with a bare "Inspect
   remains unavailable.", which contradicted the same document's Inspect
   section and `nodeScanSupportsInspect` in `src/core/game/software.ts`. The
   migrated text now states the release-derived rule explicitly and points at
   the owning document.

3. **Broken Markdown code fences** in the migrated architecture invariants
   (A06, A10, A11, A13) were closed where the diagram clearly ended, and one
   stray ```` ```md ```` fence in A10 was removed. Only fence characters
   changed; no invariant text was altered.


## Conflicts discovered during the original inventory

The original migration surfaced three conflicts without silently resolving them:

1. The accepted hacking design said NodeScan 1.0 retained Inspect, while current
   implemented behavior made player-facing Inspect available only in NodeScan
   1.1 Experimental.
2. The Files and Transfer design called Upload and active transfer presentation
   future work although current behavior already represented them.
3. `docs/FUTURE.md` contained accidental German editing instructions, intended
   English prose in the wrong location, and unbalanced Markdown fences around
   the Device-model and multiple-approaches sections.


## Conflicts resolved during PR #104 hardening

An explicit human decision during review reconciled the stale NodeScan design
text to accepted release behavior: NodeScan 1.0 Standard provides Scan and
Service Analysis without player-facing Inspect; NodeScan 1.1 Experimental
provides Inspect. Previously remembered Inspect evidence survives downgrade,
remains browsable, and does not restore the unavailable action.

The same review confirmed that Upload presentation is implemented. The Files
and Transfer contract now records the remote-first RACK-OS Upload workflow,
local Files Upload entry, RACK-OS command, direction-aware Activity Monitor
presentation and network usage, and cancellation as represented behavior. Only
genuinely unimplemented transfer capabilities remain future scope.

The `FUTURE.md` copy/paste failure was repaired editorially: the Device-model
examples and diagrams now use balanced fences, German placement and
monetization instructions were removed rather than converted into policy, and
the intended attack-surface mental model and explanatory English prose were
integrated under "Multiple approaches instead of one hacking pipeline."

The hardening review also corrected the current Processes/Activity and Device
owners for bidirectional transfer presentation, `recentActivity`, and
Device-owned foreign filesystems; aligned the Handbook lifecycle; clarified the
multi-axis authority model; and wired `npm run docs:check` into the existing
pull-request/main build workflow before tests and build.


## Actual unresolved conflicts after hardening

None of the three inventory conflicts above remains unresolved. No additional
conflict was identified by this hardening pass.

# Migration notes — Repository Knowledge Architecture V1

Status: Historical
Scope: One-time record of the V1 knowledge migration: where accepted truth
moved, what was deliberately left intact, and which contradictions were
surfaced rather than resolved.

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


## Surfaced conflicts — not resolved

1. **NodeScan 1.0 and Inspect.**
   `docs/design/HACKING_AND_OBSERVATION_V1.md` §8.2 states: "Do not make
   NodeScan 1.0 incapable of Inspect merely to create an upgrade gate," and its
   §2 gives "NodeScan 1.0 → INSPECT exists → shallow observation" as the
   selected rule. Current accepted `main` makes player-facing Inspect available
   only under NodeScan 1.1 Experimental (`nodeScanSupportsInspect`), and
   `docs/current/NETWORK_ACCESS.md` records that as current truth. An accepted
   design contract and accepted implemented behavior therefore disagree about a
   product decision. Both statements are preserved and cross-referenced. A human
   product decision is required; an implementation agent must not resolve it.

2. **`docs/design/FILES_AND_TRANSFER_V1.md` closing scope statement.** It says
   "Upload presentation, transfer queues, bandwidth sharing between simultaneous
   transfers, and rich progress/percentage/ETA presentation remain future work."
   Current `main` implements Upload surfaces and transfer progress presentation;
   transfer queues and bandwidth sharing between simultaneous transfers do
   remain unimplemented. The stale half is flagged in the document's header
   rather than rewritten, because editing an accepted design contract's scope is
   a product decision.

3. **`docs/FUTURE.md` contains unapplied editorial material.** Around the
   "Device models and Firmware families" and "Multiple approaches instead of one
   hacking pipeline" sections, the document contains German editorial
   instructions ("Ich würde …", "### Unter `## …`", "Nach dem bestehenden Teil …
   ergänzen:") together with unbalanced code fences, i.e. a review comment and a
   patch instruction that were pasted in but never applied. Applying or deleting
   them would be a product decision about confirmed future direction, so the
   content was left exactly as accepted and is surfaced here instead.

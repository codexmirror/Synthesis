# Synthesis V1 — delivery evidence

## Boundary and implementation

Repository: `/home/benutzer/repos/Synthesis`. Branch: `v1-playable-loop`.
V0 base and annotated `v0-final` target: `eab81314e621835bb1b14338bd772a88450f0e41`.
Local `main` remained at that base. No pull, rebase, reset, merge or force operation was used.

The authoritative 18-entry inventory was `.env.online`, `.github`, `.gitignore`, `AGENTS.md`, `CLAUDE.md`, `README.md`, `docs`, `index.html`, `package-lock.json`, `package.json`, `scripts`, `server`, `src`, `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json`, `tsconfig.server.json`, `vite.config.ts`. All were classified as V0 material and moved with `git mv`. No tracked repository metadata required root retention. `.git` and `node_modules` stayed in place. V1 replaced root infrastructure after the separate freeze commit. The root ignore file was created before staging.

Byte comparison against the base checked 411 frozen files with zero differences; the original README is the sole intentional replacement, as requested. Ignored generated V0 Vite/TypeScript files discovered locally were also preserved under `v0/`; scripts explicitly select V1's TypeScript Vite config to avoid accidental legacy config loading.

V0 concepts reused: earned-information projection, Device-owned files, possess versus install, and Access versus Session. Implementation was rewritten for the actual loop. V0's app taxonomy, online runtime, migrations, economy, knowledge architecture and generic process infrastructure were not ported. No V0 code is runtime-imported.

## Concrete V1 decisions

- Eight reachable file-service signals appear immediately; identity and contents start unknown.
- Masking affects scan results only. A masked weak machine can still be entered.
- KeyProbe tests a concrete authentication challenge; Tunnel passes a separately represented packet filter. Neither masking nor rewards participate in protection resolution.
- A 900 ms credential job has represented work and snapshots the installed tool. Completion resolves protection and grants a source-to-target Access relationship. CONNECT creates a separate Session.
- Remote firmware/model and filesystem are displayed only through that Session. RACK-OS, SPOOL/OS, ARCHIVE/OS, MESH/OS, FORGE/OS and NODE-OS have authored identities and storage layouts. They share a deliberately small file-operation interface, not six unrelated applications.
- Transfer records bind a source file and Device to an active Session and local destination. Bytes accumulate before a local file appears. Installation separately changes the installed software set; capability is derived from it.
- Upgrade feedback records actual before/after capabilities. Next-target hints use earned observations and owned tools only. Failures reveal only the observed rejection/challenge.
- One browser-local JSON save stores progress, sessions and unfinished work. Immutable device content comes from V1 source. No V0 migrations, server or login.

## Real product exercise — proof level 1

All browser actions were performed through the Codex in-app browser against the running application. This is browser playtesting, not a claim to prove human fun.

1. Blank V1 booted before gameplay implementation.
2. Exactly one target was implemented first. Cinder: SCAN → HACK → CONNECT → TAKE KeyProbe 2 → INSTALL → reload. The new capability and session survived. Only then was broader content authored.
3. Fresh expanded game: Cinder → KeyProbe 2; Morrow → KeyProbe 3; Foundry → NodeScan 3. Three consecutive useful cycles completed, followed by reload. Burst was also transferred and installed.
4. At a 390 × 844 viewport: Veil → Tunnel; Glass vault → KeyProbe 4; Night observatory → NodeScan 4; Quiet mirror → Burst 2. The mirror transfer was followed immediately by reload and completed successfully. Carbon was entered last and its now-outclassed NodeScan 2 package collected. All eight devices were accessed, seven useful reward cycles completed, with nine packages acquired.
5. After the design follow-up, replayed the production build from a fresh save: Cinder/RACK-OS → Morrow/ARCHIVE-OS → Foundry/FORGE-OS, including mobile transfer/installation and reload. Observed real authentication progress, access success, explicit ACCESS 1 → 2 and 2 → 3 rewards, RECON 1 → 3, distinct firmware surfaces and actual remote directory paths.

Observed friction and repairs:

- Removed duplicate install actions and redundant CONNECT while connected.
- Reload originally selected Cinder while a Foundry session remained active; it now restores the operating target (or in-progress attempt).
- Target selection brings the selected context into view on mobile.
- Added a dominant next action and honest useful-loot/ready indicators.
- Corrected obsolete-package feedback; acquiring an older package no longer promises an upgrade.
- Scoped target notices so a failure on one machine is not presented as evidence about another.
- Deferred the next-target prompt until connected useful loot has been installed.
- Added distinct represented firmware surfaces and stronger, state-derived intrusion/upgrade payoffs after the user's design follow-up.

Visual inspection covered desktop and 390 × 844 layouts. Phone-width document geometry had no page-wide horizontal overflow; the signal strip deliberately scrolls horizontally. Physical iPhone/Safari was **not** tested.

## Product judgment

The short chain gives a legible reason to choose another target: the package is visible, becomes a real local file, and produces an explicit tool change which opens the next challenge. The revised access reveal and firmware transition strengthen the sense of entering another machine. This appears to create anticipation and short-session momentum; human fun and daily return have not been proven.

Concrete weaknesses remain: eight static machines are finite; once all are understood, there is little uncertainty or replay value. Free deterministic attempts can make blind hacking optimal on masked targets. Some early side-route loot becomes obsolete when bypassed; the final transfer-speed reward has little remaining content on which to matter. Firmware currently differentiates identity, storage layout and visual operation, not a large OS-specific mechanic set. These are honest limits of this small game, not hidden content promises.

## Validation

- `npm ci`: passed (187 packages installed).
- `npm install`: passed.
- `npm test`: 17 tests across four V1 files passed, including plain-Node simulation and three actual-component cycles with user-event.
- `npm run build`: passed TypeScript and Vite production build (29 transformed modules).
- `npm run dev -- --port 5173`: started and was exercised in the real browser.
- `npm exec vite -- preview --host 127.0.0.1 --port 4173`: production artifact started and was browser-played.
- `git diff --check`: passed.
- Base-to-`v0/` byte comparison: 411 files unchanged, excluding the deliberately replaced README.
- `git rev-parse main` and `git rev-parse 'v0-final^{}'`: both matched the recorded base.
- HTTP request for `/v0/src/core/game/initialState.ts` on the dev server: 403.
- `src/isolation.test.ts`: asserts V1-only TypeScript/test paths, no V0 imports, dev-server denial and V1-only CI commands.

`npm audit` reports two moderate development-tool findings in Vitest / @vitest/mocker (GHSA-82fw-gwwq-j7x9). An attempted major upgrade hit npm's optional-peer resolver error. The working toolchain was retained; no forced upgrade or weakened validation was used. This remains a tooling follow-up.

## Acceptance

| # | Status | Concrete evidence |
|---|---|---|
| 1 | MET | Separate freeze commit, exact tag/base, 411-file byte comparison, `src/isolation.test.ts`. |
| 2 | MET | New root package/config/entry point; independent `src/game` and `src/ui`. |
| 3 | MET | Successful install, running dev and preview servers, passing production build. |
| 4 | MET | Fresh browser displayed eight signals and SCAN immediately. |
| 5 | MET | Browser inspection found the highlighted SCAN/HACK/CONNECT and in-context TAKE/INSTALL route clear; human first-use testing remains necessary. |
| 6 | MET | `App.tsx`: SCAN, HACK, CONNECT, TAKE, INSTALL; optional disconnect. |
| 7 | MET | First Cinder browser cycle used five ordinary actions, no commands or architecture vocabulary. |
| 8 | MET | Masked Veil can be hacked; separate mask/auth/filter state and regression test. |
| 9 | MET | `resolveCredentials` checks packet filter and authentication against installed tooling only. |
| 10 | MET | Access records carry source, target, service and method; repeated attempts cannot duplicate them. |
| 11 | MET | `connect` creates Session referencing Access; `remote` resolves Device through it. |
| 12 | MET | CONNECT immediately exposed a concrete KeyProbe package in browser play. |
| 13 | MET | Transfer → `/downloads` file → install → capability delta asserted and browser-observed. |
| 14 | MET | Eight authored targets; observed LOW/MODERATE/HIGH bands; distinct masking, filtering, firmware and packages. |
| 15 | MET | Cinder's KeyProbe 2 enabled Morrow; Morrow's KeyProbe 3 enabled Foundry. |
| 16 | MET | Consecutive cycles and reload in browser; partial transfer and partial credential job persistence tests. |
| 17 | MET | `targets` excludes world input; masked/hidden-name UI tests; firmware exposed only over Session. |
| 18 | MET | One signal strip, target context and loadout cover Device/observation/job/Access/Session/transfer/install state. |
| 19 | MET | No terminal needed or implemented. |
| 20 | MET | Level-1 browser routes above, plus actual UI and plain-Node tests. |

## Cuts and follow-up

No required Cut Ladder feature was cut. Audio, endless generation, broad OS applications and terminal breadth were omitted. Physical iPhone/Safari and human first-minute/repeat-session playtesting remain follow-ups. Test whether blind attempts undermine scan choice and whether players want to continue after the third reward before expanding the world.

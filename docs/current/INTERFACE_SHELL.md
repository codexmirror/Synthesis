# Interface and Shell — current truth

Status: Accepted
Scope: NODE-OS Shell presentation, Home, the shared presentation language,
Terminal as an interface, Notes, and the mobile/editing presentation contract
as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/INTERFACES_AND_PRESENTATION.md`.


## Product foundation

Synthesis currently runs as a responsive browser-based NODE-OS prototype.

The application uses a freshly created, versioned, sliced in-memory `GameState`
for each client session. The current schema version is 34 (`GAME_STATE_VERSION`
in `src/core/game/initialState.ts`).

No save or migration system is implemented.

NODE-OS Home is a compact two-column technical control surface exposing these
player-facing applications in order:

- Terminal
- NodeScan
- Processes
- Files
- Wallet
- Notes
- System

These applications describe the current interface and are not a permanent
product taxonomy.

Shell navigation is presentation state rather than gameplay state.

Home and the shared mature NODE-OS chrome project the local Device's canonical
display name, Firmware identity, address, network state, and derived runtime
resource use. A compact `THIS DEVICE` surface presents the Device name,
address, Firmware, and network status. The presentation does not use numbered
module-selection language.

Wallet balance is intentionally absent from permanent Shell chrome and remains
available inside the Wallet application.


## Shared presentation language

The NODE-OS applications share one presentation language rather than each
owning a private one. `src/styles/tokens.css` owns the palette and label type
scale, and `src/styles/nodeui.css` owns the NODE-OS primitives the
applications compose: the application masthead, section heading, key/value
facts list, list row, state chip, action, back control, empty state, note and
progress rail. Every scrolling application surface shares one gutter, owned by
`.app-content`. Terminal is the one deliberate exception: it is a full-bleed
grid rather than a scrolling document, its padding must be safe-area aware
because the prompt sits at the bottom edge under the software keyboard, and it
is switched at the established editing breakpoint rather than at the density
breakpoint. Applications otherwise share the same uppercase technical labels,
and each still keeps whatever layout is specific to it. This primitive set is
NODE-OS Firmware presentation and is not a universal Firmware framework:
RACK-OS remains deliberately foreign and owns its own palette and structure.

The primitives are composed where they apply rather than imposed on every
application. The shared masthead states an application's current subject
directly under the Shell application title, so it is carried by the
applications whose subject varies or whose operating context needs stating:
Files shows the current path, System and Terminal show the local Device, and
the Activity Monitor names itself and its local-device scope. Those
local-device applications say so, which is how the suite distinguishes the
local operating context from RACK-OS. Wallet and Notes have no varying subject
and keep their own presentation, and NodeScan keeps its established breadcrumb
and object heading, which already identify the object being browsed. A
masthead is not added to an application merely for uniformity.


## Terminal

Terminal is an interface over shared gameplay operations. It does not own
gameplay truth, and it does not receive unrestricted `GameState`.

NODE-OS Terminal currently supports:

```text
help
clear
ip
status
scan <ipv4|network-name>
analyze <ipv4:port>
attack <ipv4:port>
inspect <ipv4|network-name>
ls [path]
cat <path>
install <local-absolute-file-path>
connect <ipv4>
disconnect
node-miner help
node-miner run --payout <address>
node-miner status
node-miner stop
```

Terminal supports:

- command parsing
- command history
- compact live Process-bound entries for Analyze and Attack
- copy-only Target Tokens for actionable player-visible references

Terminal help groups current direct commands by their represented provider:
NODE-OS, NodeScan (`scan` and `analyze`, plus `inspect` when the installed
release supports it), the Basic Credential Toolkit (`attack`), and NODE Miner
(`node-miner`). Software provider groups and their represented versions derive
from the local Device's installations. NodeScan Scan and Analyze are
unavailable when NodeScan is absent. Inspect is additionally unavailable under
NodeScan 1.0 Standard and is supplied by NodeScan 1.1 Experimental; Credential
Access remains unavailable when the Basic Credential Toolkit is absent;
`node-miner` (and its Help section) is unavailable before NODE Miner is
installed and its supported executable exists on the local Device.

`clear` clears Terminal presentation without changing canonical gameplay state
or stopping running Processes.

Which command means what belongs to its owning domain document:

- `scan`, `analyze`, `attack`, `inspect`, `connect`, `disconnect`
  → `docs/current/NETWORK_ACCESS.md`
- `ls`, `cat`, `install`
  → `docs/current/FILES_SOFTWARE.md`
- `node-miner`
  → `docs/current/NODE_ECONOMY.md`
- `ip`, `status`
  → `docs/current/DEVICE_SYSTEM.md`

The durable interaction contract for terminal surfaces (scrolling, focus,
history, submit, copy targets, keyboard behavior) is owned by
`docs/design/TERMINAL_INTERACTION_V1.md`.


## Notes

Notes are feature-owned local browser data rather than canonical gameplay
state.

They persist locally through the Notes feature's browser storage adapter.

The Notes textarea owns its own scrolling behavior.


## Mobile and editing presentation

Mobile is a current first-class presentation target.

On narrow or coarse-pointer layouts, editable controls use the established
Shell-owned Editing presentation.

The shell changes its presentation for software-keyboard use rather than
becoming an arbitrary whole-page scroll surface.

The Shell treats browser viewport readings as non-atomic sensor observations.
Its editing lifecycle validates and classifies a complete sensor snapshot,
then either accepts it or holds the last accepted normal/editing geometry.
Bounded animation-frame resampling can confirm a weak coherent candidate;
invalid and contradictory observations never move the published edit plane.

Shell-owned editable focus is independent presentation truth. It activates
EDITING / DONE immediately and keeps normal Shell chrome hidden through
opening and recovery, even while accepted geometry remains on HOLD or has
recovered before rendered Shell displacement. Browser-tab
presentation maps the same mounted NODE application or RACK surface into
document space from the unchanged Shell's rendered displacement and transient
available height. This mapping keeps the focused grid reflowed into visible
space without reparenting it and never supplies accepted viewport geometry.
Browser movement events write this transient mapping directly to Shell-owned
CSS variables before the separately scheduled geometry classification, avoiding
an intermediate painted frame with stale document-space placement.
Home-Screen standalone retains its accepted fixed editing geometry rather than
combining fixed positioning with browser-tab displacement compensation.

Visibility and page lifecycle suspension preserve the focused editing
presentation and last accepted geometry while canceling stale sensor work. On
foreground resume, a still-focused Shell editable starts a fresh viewport
acquisition without blur, refocus, or DOM replacement. Transient full-height
resume readings therefore do not temporarily collapse NODE or RACK back to
normal layout, including Home-Screen standalone fixed editing presentation.

Explicit application regions own their own scrolling.

Terminal output scrolls independently while the prompt remains outside the
output scrolling region. It follows newly rendered output only while the player
is near the tail (or after the player submits a command), preserves the live
draft during per-instance history navigation, and does not submit while an IME
composition is active. The Shell-provided editing plane supplies mobile
geometry; Terminal adds no browser-keyboard bottom compensation.

The optional:

```text
?viewportDebug=1
```

diagnostic remains internal mobile investigation tooling and is not gameplay.
When enabled, it keeps a bounded high-resolution timeline that records native
browser viewport/input events synchronously and React editing-viewport commits
as distinct entries, alongside NODE/RACK layout rects. No diagnostic listeners
or recording are installed without the query flag.


## Gotchas

- Shell navigation is presentation state. Never promote "which application is
  open" or "which row is expanded" into `GameState`.
- Terminal is an interface, not a domain. A graphical control must never
  perform gameplay by constructing a Terminal command string, and a Terminal
  command must call the same shared operation the GUI calls.
- Rendered Shell displacement is presentation input only. It must never become
  accepted `editTop`/`editHeight` or any other accepted geometry.
- A transient normal-looking viewport reading on resume is not focus-exit
  recovery. Do not collapse editing presentation from one raw sensor snapshot.
- Do not reintroduce Terminal-owned or feature-owned global keyboard/scroll
  hacks (`window.scrollTo`, `scrollIntoView`, fake keyboard heights, polling
  viewport management, body transform hacks) to fix a local layout problem.
- Silence is a valid UI state. Do not invent telemetry, logs, uptime, traffic
  or alerts for atmosphere.

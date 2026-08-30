# Interface and Shell — current truth

Status: Accepted
Scope: NODE-OS Shell presentation, Home, the shared presentation language,
Terminal as an interface, Notes, NodeMail presentation, and the mobile/editing
presentation contract as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/INTERFACES_AND_PRESENTATION.md`.


## Product foundation

Synthesis currently runs as a responsive browser-based NODE-OS prototype.

The application uses a freshly created, versioned, sliced in-memory `GameState`
for each client session.

No save or migration system is implemented.

NODE-OS Home is a compact two-column technical control surface exposing these
player-facing applications in order:

- Terminal
- NodeScan
- Network
- NodeMail
- Processes
- Files
- Market
- Wallet
- Notes
- System

Flipper is deliberately absent from Home; after ordinary installation its concrete executable in Files opens its application surface.

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

The NodeMail launcher derives its secondary value from canonical mail state:
the number of unread incoming messages in the player's mailbox. It is a
projection, not stored state, and a message the player sent never contributes
to it. What that count means belongs to `docs/current/COMMUNICATION.md`.


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
and each still keeps whatever layout is specific to it: Wallet owns its own
`src/apps/wallet/wallet.css` because a financial product needs a stronger
hierarchy than the shared facts list gives it, and it owns the primitives that
set carries no equivalent of — the layered module, the balance hero and its
trajectory, the icon action tile, the consequential filled action, the labeled
financial terms list, the amount entry, and the compact activity row with its
quiet empty state — while composing the shared section heading, field, input,
note, back control and outlined action for everything else. It deliberately
stopped composing the shared bordered list row and empty state for activity,
because a complete rectangle per item is what made a transfer history read as a
stack of repeated objects; a Wallet modifier of a shared primitive is written as
`.node-x.dollar-y`, since an application stylesheet is emitted before
`nodeui.css` and an equally specific rule would lose the tie. What that Wallet
presentation is meant to achieve is owned by
`docs/design/NODE_OS_WALLET_PRODUCT_POLISH_V1.md`. This primitive set is
NODE-OS Firmware presentation and is not a universal Firmware framework:
RACK-OS and VEYRA OS each remain deliberately foreign and own their own palette
and structure (`docs/current/VEYRA_OS.md`).

A row or control states what it does by the mark it ends with, and the two
marks mean different things. The arrow means the control opens a further
surface — another directory, a file, a mail thread — and means only that. The
disclosure mark means the control reveals more where it already is, and states
whether it is currently open; NodeScan's technical details, an installed
software row and release information all use it. A row that presents a fact
and is not a control carries neither, and Files' explicit parent row keeps its
own upward glyph, because it moves up rather than opening something new.

The primitives are composed where they apply rather than imposed on every
application. The shared masthead states an application's current subject
directly under the Shell application title, so it is carried by the
applications whose subject varies or whose operating context needs stating:
Files shows the current path, System and Terminal show the local Device, the
Activity Monitor names itself and its local-device scope, NodeMail names
the mailbox account it is presenting, Network names the authorized Network it
is currently administering (see `docs/current/DEVICE_SYSTEM.md`), and Market
names the represented Market it is a client of, which is likewise not owned
by this Device or by NODE-OS (see `docs/current/MARKET.md`). Those
local-device applications say so, which is how the suite distinguishes the
local operating context from RACK-OS; NodeMail and Network each state a
different owning identity instead, because a mailbox and a Network are each
not owned by that Device. Wallet and Notes have no varying subject and keep
their own presentation, and NodeScan keeps its own breadcrumb and target
heading, which already identify the target being browsed. A masthead is not
added to an application merely for uniformity.


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
node-miner payout
node-miner config payout <address>
```

Terminal supports:

- command parsing
- command history
- compact live Process-bound entries for Analyze and Attack
- copy-only Target Tokens for actionable player-visible references

Terminal help groups current direct commands by their represented provider:
NODE-OS, NodeScan (`scan` and `analyze`, plus `inspect` when the installed
release supports it), Flipper (`attack`), and NODE Miner (`node-miner`). Software provider groups and their represented versions derive
from the local Device's installations. NodeScan Scan and Analyze are
unavailable when NodeScan is absent. Inspect is additionally unavailable under
NodeScan 1.0 Standard and is supplied by NodeScan 1.1 Experimental; `attack`
and its Help group are unavailable when Flipper is absent or its installed
build integrates no module, and which techniques it can actually execute stays
the canonical operation's decision rather than the listing's;
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


## NodeMail

NodeMail is the NODE-OS client onto the player's represented in-world mailbox.
It presents canonical mail state and calls the shared mail operations; it owns
no communication truth (`docs/current/COMMUNICATION.md`).

Navigation is one stacked path — inbox, thread, reply — at every width. There
is no desktop split view. Which thread is open is application presentation
state and never reaches `GameState`.

The application carries the shared masthead, whose subject is the mailbox
account being presented: a different identity from the local Device that Shell
chrome names. Inbox rows state correspondent, subject, and a preview projected
from the latest canonical message, and mark unread threads with a filled
marker, a brighter correspondent name, and an `UNREAD` chip. A thread states
its subject, both parties, and its messages in order, each labeled `YOU` or
with the correspondent's name.

A thread that represents no authored interaction presents no composer and says
that the address does not accept replies.

An address-shaped run of text inside a message body is rendered as a copy
control over that literal communicated string. It is a copy affordance only: it
offers no scan, connect or inspect action and resolves nothing.

The reply composer is an ordinary multiline `textarea` plus an explicit `SEND`.
Enter inserts a newline and never submits, because the draft is a textarea
rather than a single-line input intercepted by a key handler. The composer is
never autofocused, so opening a thread does not open the software keyboard, and
`SEND` stays unavailable until the player has written something. NodeMail
consumes the Shell-owned Editing presentation exactly as Notes and Terminal do
and adds no VisualViewport reading, keyboard height, focus management, body
transform, or scroll manipulation of its own.

An open thread declares two scrolling regions: the thread surface and the
composer draft. Both are things a finger can move while the software keyboard
is up — re-reading the correspondence while writing back, and moving through a
long draft — and the Shell resolves the nearest one.

The presentation design behind these choices is owned by
`docs/design/NODEMAIL_V1.md`.


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
While the controller and presentation are fully normal and no Shell editable is
focused, that same bounded confirmation can accept a stable weak candidate as
the new normal baseline. Active editing transitions cannot use this idle rebase
path.

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

Leaving editing is a Shell-owned intent rather than a browser side effect.
DONE, an operating-context switch, and a RACK-OS section change all express the
same explicit end-of-editing intent: the Shell releases whatever editable still
holds focus and hands the intent to the editing controller, which has one entry
into recovery. DONE therefore works identically when Mobile Safari's focus
bookkeeping is already stale, lost, or was never reported, and repeated exits,
blurs, focusouts and viewport events are idempotent — a stale editing epoch
cannot reopen a recovered presentation.

Held editing intent is reconciled against the browser's own focus. Focus is
directly readable and authoritative, so when the Shell holds editing intent and
the browser no longer reports a Shell-owned editable focus — most reliably when
the focused control is unmounted underneath the software keyboard — the
interaction is treated as ended. This corrects intent only. It never accepts
geometry: recovery still requires valid recovered viewport evidence and, in
browser-tab presentation, recovered rendered Shell displacement. Editing
presentation is never permanently preserved over a recovered physical viewport
with no editable interaction behind it, whether or not DONE was used.

A recovery reading with no corroborating position or layout movement stays a
candidate, except when the interaction has already ended and every sensor reads
exactly the state accepted as normal before editing began; that is the normal
baseline itself rather than a partial close still panned away from it. An
invalidated measurement epoch releases its pending animation frame rather than
holding it.

A RACK-OS section change uses the same recovery boundary the local/remote
operating-context switch already uses: editing intent ends, the focused
editable is released, and the destination section is presented once the Shell
reports recovered editing geometry, so a destination never mounts into the
keyboard geometry the outgoing editable is being unmounted out of. With nothing
being edited that is already true and the section changes immediately. RACK-OS
reads no viewport, keeps no keyboard state, and owns none of this timing; it
consumes the Shell's recovery contract. Moving between VEYRA surfaces consumes
exactly the same contract in exactly the same way.

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
When enabled, it continuously keeps a bounded, session-long high-resolution
timeline that distinguishes native browser events, editing-controller decisions
and React editing-viewport commits. Only a small `DBG` trigger remains visible
during normal use. Activating it freezes the preceding evidence before opening
a diagnosis-first panel; the immutable capture can be copied as privacy-safe
plain text or dismissed with `RESUME` for another capture. Structural focus
evidence never includes editable values or other player-entered text. No
diagnostic listeners, recording or UI are installed without the query flag.


## Gotchas

- Shell navigation is presentation state. Never promote "which application is
  open", "which row is expanded", or "which mail thread is open" into
  `GameState`.
- Terminal is an interface, not a domain. A graphical control must never
  perform gameplay by constructing a Terminal command string, and a Terminal
  command must call the same shared operation the GUI calls.
- Rendered Shell displacement is presentation input only. It must never become
  accepted `editTop`/`editHeight` or any other accepted geometry.
- A transient normal-looking viewport reading on resume is not focus-exit
  recovery. Do not collapse editing presentation from one raw sensor snapshot.
- Editing intent is Shell-owned but focus belongs to the browser. Do not make
  leaving editing depend on one exact focusout sequence, and do not keep a
  second editing or keyboard flag in Terminal, RACK-OS or another application.
- Do not reintroduce Terminal-owned or feature-owned global keyboard/scroll
  hacks (`window.scrollTo`, `scrollIntoView`, fake keyboard heights, polling
  viewport management, body transform hacks) to fix a local layout problem.
- Silence is a valid UI state. Do not invent telemetry, logs, uptime, traffic
  or alerts for atmosphere.

## Device-scoped software command integration

The Shell mounts a foreign operating surface by the entered target's own
represented Firmware identity rather than by a single hard-coded remote
environment, and mounts none at all for Firmware it has no implementation for.
That selection, and the VEYRA OS surface it can now select, belong to
`docs/current/VEYRA_OS.md`; the Shell's own remote handoff, operating-context
switch and editing contract are unchanged by it.

NODE-OS and RACK-OS remain distinct Firmware-owned Terminal surfaces with their
own built-ins, prompts, rendering, and interaction. When NODE Miner is available
on the Device each surface operates, both compose the same application-level
NODE Miner product command and present its represented installed name/version
as a separate software provider. NODE-OS binds the adapter to
`player.localDevice`; RACK-OS binds through the active Session and DeviceAccess.
There is no global current Device and no universal Terminal or software plugin
registry.

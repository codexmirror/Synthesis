# NODE-OS Home V1

Status: Accepted
Scope: Product and visual contract for NODE-OS Home and the normal Shell
presentation, including the reference image.
Normative owner of current implemented behavior: `docs/current/INTERFACE_SHELL.md`.

## Status
Implemented design contract for the first mature NODE-OS Home and normal Shell
presentation.
This document is the authoritative product and visual implementation reference
for NODE-OS Home V1.
Reference image:
`docs/design/node-os-home-v1-reference.png`
The reference image defines visual direction only:
- overall maturity
- technical character
- density
- typography
- line treatment
- restrained color use
- icon language
- hierarchy
It is not authoritative for gameplay state, exact layout, application count,
telemetry, or functionality.
Where the image and this document differ, this document wins.
Canonical implemented state and `docs/ARCHITECTURE.md` remain authoritative
over both.
## Product intent
NODE-OS is the Firmware environment of the player’s personal Device.
It is not the universal Synthesis interface.
NODE-OS should feel like the operating surface of a specialized personal
networking and systems computer:
- serious
- compact
- precise
- restrained
- highly usable
- technically mature
- recognizable as an operating system
- purpose-built rather than consumer-oriented
The player should become familiar with NODE-OS and eventually feel the
difference when operating Devices that use other Firmware.
NODE-OS should not feel like:
- a smartphone launcher
- a game HUD
- a mission-selection screen
- a cyberpunk prop
- a generic dashboard
- a collection of web cards
## Visual language
The visual identity should use:
- matte near-black surfaces
- subtle low-contrast separators
- thin technical line work
- neutral white and gray primary information
- restrained mint-green emphasis
- compact monospace typography
- small technical glyphs
- deliberate whitespace
- minimal visual noise
- very restrained motion
Avoid:
- neon bloom
- excessive glow
- glossy panels
- glass effects
- holograms
- Matrix-style decoration
- scanline effects
- random code
- fake terminal noise
- decorative alerts
- animated radar
- atmospheric blinking
- large consumer-style application icons
- rounded smartphone-style cards
Silence is valid UI state.
If represented state is not changing, NODE-OS should remain visually still.
## Permanent top status bar
The normal NODE-OS top bar should communicate only useful local Device context.
It should derive:
- Firmware identity from `localDevice.firmware.name`
- Device display name from `localDevice.displayName`
- local address from `localDevice.network.ip`
- connectivity from canonical local runtime state
- current clock time from the presentation clock
Conceptual presentation:

NODE-OS / node-01      198.51.100.23      15:53:14      

Exact responsive composition may differ.

The clock should include seconds.

Connectivity should remain restrained. A small indicator is sufficient when
space is constrained.

Do not show permanent Wallet balance in shared OS chrome.

Wallet information belongs to the Wallet application.

Do not show:

* user/operator identity
* uptime
* security state
* traffic throughput
* storage
* temperature
* session controls
* lock controls

unless those concepts later exist as canonical simulation state and a future
design explicitly brings them into scope.

Home identity

Home should use a compact hierarchy equivalent to:

HOME
LOCAL DEVICE · node-01

HOME is an operating-system section identity, not a large game title.

The Device display name must come from canonical Device state.

Do not display mockup-only user or session identity.

Application control surface

Home uses a two-column technical control surface.

Applications should feel like professional soft keys or system modules rather
than consumer mobile applications.

Conceptually:

┌─────────────────────┐  ┌─────────────────────┐
│ >_  TERMINAL        │  │ ◎   SCAN            │
│     LOCAL SHELL     │  │     KNOWN SPACE     │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│ ≣   PROCESSES       │  │ ▱   FILES           │
│     0 RUNNING       │  │     LOCAL           │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐  ┌─────────────────────┐
│ ◇   WALLET          │  │ ≡   NOTES           │
│                     │  │                     │
└─────────────────────┘  └─────────────────────┘
┌─────────────────────┐
│ ◫   SYSTEM          │
│     NODE-OS 1.0     │
└─────────────────────┘

The exact icon artwork may differ.

Important characteristics:

* two columns
* compact controls
* wide horizontal interaction surfaces
* small technical icon/glyph areas
* clear application name
* optional restrained secondary information
* large accessible touch target
* thin framing
* little unused internal space
* no / OPEN
* no application index
* no giant centered icon

The final unused position is intentional.

Do not create an application merely to fill it.

Current applications

The Home application order is:

1. Terminal
2. Scan
3. Processes
4. Files
5. Wallet
6. Notes
7. System

There is no Tools application in NODE-OS Home V1.

Installed Tools remain simulation/software state and must not become a Home
application merely because the visual reference contains a Tools icon.

NODE-OS icon language

Current launcher glyphs should evolve into a consistent local technical icon
family.

Icons should be maintainable local SVG/React assets using shared presentation
color where practical.

They should remain small relative to the entire control.

Directional identities:

Terminal

Shell / command prompt.

Scan

Observation, network structure, nodes, or concentric technical geometry.

Processes

Execution lanes, work units, or process activity.

Files

Filesystem or directory structure.

Wallet

Technical wallet identity rather than a large currency symbol.

Notes

Text buffer or document.

System

Device core, processor, or firmware identity.

The icon family should share:

* line weight
* geometry
* visual density
* restrained use of green

Do not use external icon libraries solely for this design.

Do not crop artwork from the reference image.

Secondary application information

Secondary launcher information is allowed only when it represents either:

* stable application meaning, or
* real canonical state

V1 direction:

TERMINAL
LOCAL SHELL
SCAN
KNOWN SPACE
PROCESSES
<n> RUNNING
FILES
LOCAL
WALLET
NOTES
SYSTEM
<Firmware name> <Firmware version>

<n> RUNNING must derive from canonical Process state.

Firmware information must derive from canonical Device Firmware state.

Do not manufacture launcher states such as:

* READY
* SYNCED
* SECURE
* SCANNING
* ALERT
* CONNECTED TO CLOUD

unless corresponding represented state actually exists.

THIS DEVICE

Home includes a compact THIS DEVICE observation surface beneath the
application controls.

This surface presents canonical information about the player’s local Device.

NODE-OS Home V1 should show only:

THIS DEVICE
DEVICE      node-01
ADDRESS     198.51.100.23
FIRMWARE    NODE-OS 1.0
NETWORK     ONLINE

Every displayed value must derive from canonical current state.

THIS DEVICE is intended to become more useful as real Device simulation grows,
but the UI must not anticipate unavailable state.

Do not currently show:

* USER
* UPTIME
* SECURITY
* TEMPERATURE
* STORAGE
* TRAFFIC
* SESSION
* ALERTS

Do not add empty placeholder rows for future values.

File Monitor and logs

NODE-OS Home V1 does not contain a SYS.LOG or File Monitor panel.

The visual reference contains such a panel as visual inspiration only.

Do not create pseudo-log messages such as:

SYSTEM READY
NETWORK ONLINE
WALLET SYNCED
NO ACTIVE ALERTS
WELCOME OPERATOR

Those would manufacture simulation evidence that does not exist.

A future File Monitor may become a NODE-OS observation surface only after a
canonical Device-owned filesystem and real artifact-producing mechanics exist.

When that happens:

* Files
* Terminal
* Home observation

must read the same canonical Device-owned filesystem truth.

Logs should exist because represented events produced them, not because the UI
needs atmospheric hacker text.

Permanent bottom runtime strip

Preserve a compact permanent local Device runtime strip.

V1 presents:

CPU 18%      RAM 23%      NET ONLINE

CPU and RAM must derive from existing canonical resource/process calculation.

Network state must derive from canonical local Device runtime state.

Do not add:

* sparklines
* CPU history
* RAM history
* traffic graphs
* KB/s values
* packet counters

until corresponding simulation/history state exists.

Wallet

Wallet remains a normal NODE-OS application.

Its canonical balance belongs inside that application.

Removing balance from permanent OS chrome must not duplicate or relocate Wallet
state elsewhere on Home.

Normal application chrome

Opened applications should no longer appear as numbered game modules.

Remove normal-state presentation such as:

* MODULE
* 01 / 07
* / OPEN
* module-count language

Normal application chrome should communicate:

* Home/back navigation
* application identity

Conceptually:

← HOME                         TERMINAL

Exact layout may adapt responsively.

Editing presentation

Editing mode remains a distinct established presentation.

Where currently applicable it continues to expose:

EDITING
<Application>
DONE

Removing normal MODULE presentation must not remove the established Editing
contract.

NODE-OS Home redesign must not redefine mobile keyboard or viewport ownership.

Mobile behavior

Mobile portrait is the primary target.

At widths of approximately 320px and above:

* application controls remain two columns
* controls retain useful touch targets
* labels remain readable
* no horizontal page scrolling occurs
* permanent top/bottom chrome remains stable
* safe-area behavior remains intact

If Home content does not fit vertically, the Home content area may scroll
internally.

The entire Shell/body should not become an arbitrary page-scrolling surface.

NODE-OS Home must preserve existing mobile Editing and Terminal viewport
contracts.

Desktop and tablet

Desktop and tablet should preserve the same NODE-OS identity.

Do not transform Home back into a three-column consumer launcher simply because
more width is available.

Wider layouts may gain breathing room while preserving:

* technical control surfaces
* compact icon scale
* consistent hierarchy
* shared visual language

Navigation

NODE-OS local application navigation should feel immediate.

Application control:

tap
↓
application opens

Home/back:

tap
↓
Home returns

Do not add:

* artificial loading screens
* boot sequences between local applications
* navigation state machines
* routing frameworks
* GameState navigation state

A brief restrained existing transition is acceptable for spatial continuity.

State truth

Presentation must not manufacture gameplay or Device state.

Current UI should derive represented information from canonical sources
where those sources exist.

Do not hardcode mockup-only:

* node-01
* Firmware identity
* Wallet balance
* Process count
* network status
* IP address

as presentation truth.

Values shown in documentation or the visual reference are examples of expected
initial presentation, not independent state authorities.

Relationship to other Firmware

This design is NODE-OS-specific.

NODE-OS must not become the universal Synthesis shell.

Foreign Firmware may use completely different:

* chrome
* navigation
* home structure
* application organization
* filesystem presentation
* terminal presentation
* interaction conventions
* levels of interpretation and convenience

A future raw server environment should be allowed to look and behave
structurally different rather than simply recoloring NODE-OS.

Underlying simulated Device and World truth remains canonical regardless of
Firmware presentation.

Current non-goals

NODE-OS Home V1 does not introduce:

* Tools application
* user/operator model
* user profile control
* Session state
* lock screen
* uptime state
* filesystem
* File Monitor
* SYS.LOG widget
* log generation
* traffic model
* storage simulation
* temperature
* security score
* foreign Firmware
* remote Device UI
* CONNECT
* Firmware switching
* Firmware upgrades
* new gameplay actions
* generic Home widget framework
* generic application-status framework

Implementation authority

For the NODE-OS Control Surface milestone, authority is:

1. canonical implemented state and docs/ARCHITECTURE.md
2. the explicitly selected implementation work order
3. this design contract
4. docs/design/node-os-home-v1-reference.png

The PNG is visual direction.

It must never be used to justify new gameplay or simulation state.

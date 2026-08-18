# NODE-OS Home V1

## Status

Planned NODE-OS home-screen design.

This document is the authoritative implementation reference.
The accompanying mockup is a visual reference for composition, spacing,
icon direction, typography, restraint, and overall feel. Where the image and
this document differ, this document wins.

Reference image:

`docs/design/node-os-home-v1.png`

## Product intent

NODE-OS is the Firmware of the player’s personal Device, not the universal
Synthesis interface.

The Home screen should feel like the launcher of a compact personal operating
system rather than a game dashboard or module-selection screen.

The player should experience NODE-OS as familiar, fast, quiet, polished, and
purpose-built for networking and systems work.

## Home structure

Permanent top bar:

- NODE-OS Firmware identity
- local Device IP
- Wallet balance
- current local time

Home identity:

- `HOME`
- `LOCAL DEVICE`
- future Device display name when that state is actually modeled
- compact future user/session control when real operating-context state exists

Launcher:

- three-column mobile layout
- icon plus application label
- large invisible touch targets
- no visible card backgrounds around applications
- no `OPEN` labels
- no application index such as `01 / 07`
- deliberate whitespace is part of the design

Current launcher applications:

1. Terminal
2. Scan
3. Processes
4. Files
5. Wallet
6. Notes
7. System

Do not introduce a Tools application solely to fill the layout. Empty launcher
positions are acceptable until a real application exists.

Permanent bottom system strip:

- CPU utilization
- RAM utilization
- network status

These values must continue to derive from canonical Device/runtime state.

## Visual language

NODE-OS should be restrained rather than theatrical.

- matte near-black background
- subtle separators
- neutral white/gray primary icon structure
- restrained mint-green accents
- minimal glow
- no cyberpunk holograms
- no decorative telemetry
- no dashboard widgets
- no unnecessary cards
- no fake activity
- no animation unless real state justifies it

Application icons should develop distinct identities while remaining part of
one NODE-OS icon family.

The mockup icons are directional references, not final immutable assets.

## State truth

Do not hardcode presentation-only facts merely because they appear in the
mockup.

In particular:

- a Device display name such as `node-01` should be shown only after Device
  display-name state exists
- user/session information should be shown only after corresponding canonical
  operating-context state exists
- Firmware identity should come from Device Firmware state once implemented
- CPU, RAM, IP, Wallet, and network status must continue to use their canonical
  sources
- no fake uptime, security state, or other decorative system information

## Navigation

NODE-OS local navigation should prioritize immediacy.

- tapping an application opens it directly
- Home returns reliably to the launcher
- application state should remain intact where appropriate
- no artificial loading screen between local applications
- any transition should be brief and primarily provide spatial continuity

## Relationship to other Firmware

This layout is NODE-OS-specific.

Foreign Firmware may use completely different:

- chrome
- navigation
- home or launcher structure
- application presentation
- terminal environment
- interpretation and convenience layers

Do not turn this design into a global Synthesis shell.

See `docs/ARCHITECTURE.md` for the Device / Firmware / Software / operating
context boundaries.
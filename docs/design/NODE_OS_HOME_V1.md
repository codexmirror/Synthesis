# NODE-OS Home V1

## Status

Planned implementation design for the first mature NODE-OS Home and normal
Shell presentation.

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

```text
NODE-OS / node-01      198.51.100.23      15:53:14      ●
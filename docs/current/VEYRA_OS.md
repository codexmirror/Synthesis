# VEYRA OS — current truth

Status: Accepted
Scope: The implemented VEYRA OS operating surface — Firmware-driven selection
of it, its Home launcher, its Wallet and Settings surfaces, its internal
navigation, and its presentation ownership — as currently implemented on
`main`.

This document is the normative owner of current implemented truth for that
scope. It owns what VEYRA *presents* and how it is reached; it owns none of the
facts it presents. The represented phone Device belongs to
`docs/current/DEVICE_SYSTEM.md`, the access loop that reaches it and the
Remote Session it is operated through to `docs/current/NETWORK_ACCESS.md`, and
every Civic Dollar Account, Session, transfer and Transaction to
`docs/current/DOLLAR_FINANCE.md`. The selected product direction behind it
belongs to `docs/design/VEYRA_FIRST_ORDINARY_PHONE_V1.md` and its parent
`docs/design/VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md`; where this document and
those contracts differ, this document describes what is built.


## Firmware-driven operating-surface selection

An entered Remote Session presents the operating environment the target Device
actually runs. `selectRemoteOperatingSurface` in
`src/shell/remoteOperatingSurface.ts` resolves that from the target's own
Firmware **identity**, not its display name, because name and version are
mutable attributes (A01): a renamed RACK-OS release still mounts RACK-OS, and a
Firmware merely *named* `VEYRA OS` mounts nothing.

```text
firmware-rack-os-v1   -> RACK-OS
firmware-veyra-os-v4-1 -> VEYRA OS
anything else          -> no operating surface
```

The three represented Firmware release identities are named once, in
`src/core/game/firmwareIdentity.ts`. This is a two-branch concrete dispatch, not
a Firmware plugin system, foreign-OS registry, capability negotiation or
generic operating-surface framework (A16); a third represented Firmware adds a
constant and a branch.

Firmware the Shell cannot present fails visibly rather than silently receiving
somebody else's surface. The Remote Session handoff still states the
established Session exactly as before, adds `NO OPERATING SURFACE FOR THIS
FIRMWARE`, offers no ENTER action, and keeps DISCONNECT — the Session is real
and canonical, only its presentation is missing.


## The phone this is presented for

VEYRA OS is currently presented for exactly one represented Device, the
personal phone owned by `docs/current/DEVICE_SYSTEM.md`. It is reached only
through the ordinary access loop — Scan, Service Analysis, Credential Access,
CONNECT, handoff — with no phone-specific mechanic or operation, as owned by
`docs/current/NETWORK_ACCESS.md`.


## Home

VEYRA Home is a conventional consumer-smartphone launcher: a four-column grid
of touch-sized rounded application tiles, each an icon above its own text
label, on the phone's own warm ground. Empty cells stay empty, so later
truthful applications fill the next cells without the screen being redesigned.

Which entries exist is derived on every render by `deriveVeyraHomeEntries` in
`src/apps/veyra/veyraHome.ts` from represented facts:

```text
Wallet   <- this Device -> its Civic Dollar Financial Session -> Account
Settings <- this Device's represented VEYRA OS Firmware
```

There is no `homeApps[]`, launcher inventory, app registry, `LauncherState`,
`HomeLayoutState` or per-application presentation flag anywhere in
`GameState` or in presentation. Removing the phone's Financial Session removes
Wallet from Home; the player's own Financial Session is not a basis for it.

Communication is **absent**, not disabled, empty or "coming soon", because no
foreign communication truth is represented for any Device. No placeholder,
greyed or advertised application appears for Communication, Messages, Mail,
Photos, Notes, Camera or Browser.

A Home entry opens an application root and never jumps into deeper content. An
icon grants nothing: opening Wallet still resolves the Account through the
Session, and every action still calls the canonical operation that owns it.


## Wallet

VEYRA Wallet is a second client over the one canonical Civic Dollar domain. It
owns no financial truth. It resolves its Account through
`resolveDollarAccountForOperatedRemoteDevice`, which resolves the operated
Device from the active Remote Session and then the Account from that Device's
own Financial Session — never through Player identity, the player's Account, or
the Remote Session itself. With no Financial Session on that Device the Wallet
states that the phone is not signed in to an account and shows nothing else.

The consumer hierarchy is balance, Provider, SEND / RECEIVE, ACCOUNT, ACTIVITY:

- **Balance** is the canonical Account balance with the Provider display name
  beneath it.
- **SEND** takes an amount and a destination account number, converts the
  amount to exact canonical cents at the input boundary, and states the amount,
  destination and source on a review step before anything moves. Confirming
  calls `transferDollarsFromOperatedRemoteDevice`, which performs the canonical
  `transferDollars` acted by the operated Device; the source Account is still
  derived by the domain from that Device's Session, so this surface cannot name
  whose money moves. One rendered successful confirmation is locally latched
  immediately and can create at most one canonical Transaction, even while the
  Wallet root is waiting to be presented; a refusal releases that guard and
  returns to the editable form. Refusals are restated in ordinary product
  wording and move nothing. No fee, total, arrival estimate, settlement,
  processing state or security claim is shown, because none is represented.
- **RECEIVE** presents the Account reference, the Provider and a copy control.
  It creates no payment request, invoice, amount request or QR identity, and
  opening or leaving it changes no canonical state.
- **ACCOUNT** presents the Provider, the account number and the balance.
  Internal Account, Credential and Financial Session identity and all
  credential material are absent.
- **ACTIVITY** is `projectDollarAccountActivity` and nothing else: direction,
  the historical counterparty reference snapshot, and the signed amount. There
  is no timestamp, merchant, category, status, fee, pending state or graph, and
  an Account with no Transactions shows a truthful empty state.

Which Wallet surface is open is presentation state held by the component; it
never reaches `GameState`.


## Settings

Settings is a Firmware-owned system surface. Its root currently has exactly one
entry, **This Device**, which presents the Device display name and the
represented Firmware name and version as large, calmly spaced labelled rows.

Nothing else is presented. There is no Connection entry, because this phone
represents no owner-facing connection state worth showing — and the player's
Remote Session is emphatically not it. There is no battery, storage, update,
security, permission, network or telemetry state, no internal Device ID, no
CPU, RAM, port, address, privilege, DeviceAccess, Session or exploit state:
none of it is either represented as owner-facing truth or appropriate to it.

```text
VEYRA CONNECTION != PLAYER REMOTE SESSION
```


## Navigation, and the operating-context frame

VEYRA's internal grammar is two levels:

```text
HOME -> application / system-surface root -> optional detail
```

A persistent VEYRA navigation band carries **Back**, which moves exactly one
level upward, and **Home**, which returns to the launcher from any depth.
Neither ever leaves the phone. Location is presentation state and never reaches
`GameState`.

Leaving the foreign environment remains the Shell's, and stays visibly
separate: a slim technical band above the phone carries the Session context and
two deliberately different actions — `← NODE-OS` returns to the preserved local
workspace without touching the Session, and `DISCONNECT` ends it through the
canonical operation. The band is drawn in the technical language of NODE-OS,
not of VEYRA, so hacker context is framing around the phone rather than
something the phone presents about itself. Nothing inside the owner-facing
surface states the Session, the access route, the address or the privilege.


## Presentation ownership

VEYRA owns its whole presentation in `src/apps/veyra/veyra.css` and consumes no
NODE-OS token or shared primitive, exactly as RACK-OS owns its own. Its
language is a warm light ground, deep graphite ink, proportional system-safe
typography, soft depth, controlled rounding, hairline structure and one
restrained clay accent — no monospace as product typography, no neon, no
hacker styling, no glassmorphism.

Icons are local inline `currentColor` line art in
`src/apps/veyra/VeyraIcon.tsx`, on one 24-unit grid with one stroke weight and
round caps and joints — deliberately unlike NODE-OS's square caps and mitred
joints. No icon dependency was added, every icon is `aria-hidden` beside a real
text label, and none marks a capability the world does not represent. Familiar
smartphone grammar is used; no other platform's geometry, icon set, dock,
status bar or gestures are copied.

The surface is mobile-first at a 390px reference and usable at 320, 430 and
834; content is capped and centred rather than stretched at tablet width.
VEYRA's scrolling region owns its own scrolling, and VEYRA reads no viewport
and keeps no keyboard state: moving between surfaces ends editing and waits for
the Shell's recovered editing geometry, the same contract RACK-OS consumes
(`docs/current/INTERFACE_SHELL.md`). This includes SEND's editable form moving
to its Review presentation: the form remains mounted after requesting the
Shell-owned end-editing intent and is replaced only after recovery is ready.


## Gotchas

- A Home icon is not authority. Presence is derived from represented truth on
  every render; there is no stored launcher state to disagree with the world.
- Absence and emptiness are different. Wallet with no Transactions is a
  truthful empty Activity; Communication with no represented truth is not on
  the phone at all.
- A Remote Session is operating context, not financial authority. It decides
  which Device is acting and grants no Account: a phone with no Financial
  Session refuses a transfer even while the player operates it.
- VEYRA Wallet and NODE-OS Wallet are two clients over the same canonical
  Dollar domain. Neither owns balance, activity or authority, and the local
  Wallet stays bound to the local Device while a foreign phone is operated.
- Unsupported Firmware is refused at the handoff. It never falls back to
  RACK-OS, and the Session it refuses to present is still real and still
  disconnectable.

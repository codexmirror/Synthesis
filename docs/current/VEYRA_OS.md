# VEYRA OS — current truth

Status: Accepted
Scope: The implemented VEYRA OS operating surface — Firmware-driven selection
of it, its Home launcher, its Communication, Wallet, Settings and System Update
surfaces, its firmware-installation surface, its internal navigation, and its
release-specific presentation ownership — as currently implemented on `main`.

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
firmware-rack-os-v1             -> RACK-OS
firmware-rack-os-v1-1-business  -> RACK-OS
firmware-veyra-os-v4-1          -> VEYRA OS
firmware-veyra-os-v4-2          -> VEYRA OS
anything else                   -> no operating surface
```

The five represented Firmware release identities are named once, in
`src/core/game/firmwareIdentity.ts`, alongside `isRackOsFirmwareId` — the one
place that answers "is this a RACK-OS Device", from stable identity rather than
a display name. This is a two-branch concrete dispatch, not
a Firmware plugin system, foreign-OS registry, capability negotiation or
generic operating-surface framework (A16); a further represented Firmware adds a
constant and, where it needs one, a branch.

VEYRA OS 4.1 and VEYRA OS 4.2 are two distinct Firmware release identities and
both mount VEYRA, because both really are that operating system; RACK-OS 1.0 and
RACK-OS 1.1 Business are the same relationship for the server operating system.
Which release a Device runs is never collapsed into one mutable version
attribute: installing the newer release replaces which release the Device owns,
and the older identity is never rewritten into pretending it was always the
newer one. What differs within each pair is that operating system's own
presentation, not which surface is selected — see below for VEYRA's, and
`docs/current/NETWORK_ACCESS.md` for the two RACK-OS releases'.

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
`src/apps/veyra/veyraHome.ts` from this concrete Firmware presentation and the
represented bases it observes:

```text
Communication <- this VEYRA OS Firmware's client -> Petra's Company Chat
Wallet        <- this Device -> its Civic Dollar Financial Session -> Account
Settings      <- this Device's represented VEYRA OS Firmware
```

There is no `homeApps[]`, launcher inventory, app registry, `LauncherState`,
`HomeLayoutState` or per-application presentation flag anywhere in
`GameState` or in presentation. Removing the phone's Financial Session removes
Wallet from Home; the player's own Financial Session is not a basis for it.

Communication is a built-in VEYRA OS client and appears first. It presents the
one concrete Company Chat owned by `GameState.petraCompanyChat`, including
Petra's authored unusual-transaction message after the qualifying canonical
Civic Dollar Transaction. The client owns no communication history, and merely
opening or navigating it changes no canonical state. It adds no private chats,
contacts, presence, timestamps, typing state, reactions, attachments or
notifications. Detailed communication and reaction truth belongs to
`docs/current/COMMUNICATION.md`.

Wallet remains conditional on the operated Device's Financial Session, while
Settings remains a Firmware-owned system surface. Messages, Mail, Photos,
Notes, Camera and Browser remain absent.

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

### Wallet-open enforcement

Opening Wallet from Home reads the operated Device's own canonical
`walletProtectionEnabled` (`docs/current/DEVICE_SYSTEM.md`) fresh, every time.
With protection OFF, Wallet opens exactly as before. With protection ON,
`VeyraOS` (`src/apps/veyra/VeyraOS.tsx`) sends the player to the same
`VeyraPinChallenge` Settings uses, instead of Wallet: no balance, Account,
Activity or Send/Receive control ever mounts before a correct PIN. Verification
goes through `verifyDevicePinForOperatedRemoteDevice`
(`src/core/game/deviceSecurity.ts`), the same "Session decides *which* Device
acts, and grants no authority of its own" precedent as the Settings mutation,
except it commits nothing — there is no canonical fact for a single Wallet
opening to change.

Successful verification authorizes only that one opening. It exists purely as
the phone's `location` presentation state becoming `wallet`; VEYRA holds no
`walletUnlocked`, trusted-session, or timer state anywhere, in `GameState` or
otherwise. Leaving Wallet to Home or any other VEYRA surface always moves
`location` away from `wallet`, so the next Wallet opening is challenged again
exactly like the first, and losing the VEYRA operating surface (Return to
NODE-OS, DISCONNECT) discards it the same way by unmounting `VeyraOS`
entirely. Enabling or disabling protection in Settings is read at the moment
Wallet is next opened, with no reload, reconnect, or delay: it is Device state
read fresh, not cached.

While that protected Wallet challenge is actually mounted, a running matching
RATTLER 1.0 Process is projected through the same PIN surface: the ordinary
masked indicators fill while the existing numeric keypad visibly presses each
digit of a sampled canonical candidate. The candidate itself is never exposed
in the indicator row or accessibility output, and this remains presentation
over canonical state rather than a second attempt mechanism.

The canonical search (625 candidates/minute, exhausting the full `0000`..`9999`
space in 16 minutes) runs far faster than a readable four-key reveal, so the
presentation does not attempt to play every canonical attempt. Instead it
periodically takes one read-only snapshot of whatever candidate and attempt
number canonical Process state currently holds, plays that snapshot's four
digits at a readable cadence, then samples again. Canonical ATTEMPT/CURRENT
routinely advance past what is currently on screen between samples — that gap
is the intended projection of the real, faster search, not a discrepancy. The
keypad presentation never generates, increments, or independently verifies a
candidate, and it maintains no attempt counter of its own.
The manual keypad is inert for the duration of an observed sample so keypad
presses can never become a second, player-driven cracking mechanism. Terminal
or interrupted Process state — and any other loss of the observed Process —
cancels pending presentation timers immediately rather than fabricating a
successor sample. If the observed Process reaches the real PIN while this
particular challenge is open, that one Wallet opening receives the same
presentation-local authorization as a successful manual entry. Success while
Wallet is not being viewed opens nothing, and opening the challenge after a
completed attack does not replay authorization. Settings continues to use the
ordinary manual challenge and never projects RATTLER activity.

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

Settings is a Firmware-owned system surface. Its root currently has three
entries: **This Device**, which presents the Device display name and the
represented Firmware name and version as large, calmly spaced labelled rows;
**System Update**, the Firmware capability described below; and **Security**.

Nothing else is presented. There is no Connection entry, because this phone
represents no owner-facing connection state worth showing — and the player's
Remote Session is emphatically not it. There is no battery, storage,
permission, network or telemetry state, no internal Device ID, no CPU, RAM,
port, address, privilege, DeviceAccess, Session or exploit state: none of it
is either represented as owner-facing truth or appropriate to it. System Update
is not an exception to that rule but an application of it: every fact it states
is the Device's own Firmware truth or the represented release VEYRA offers it.

```text
VEYRA CONNECTION != PLAYER REMOTE SESSION
```

### System Update

System Update is a Firmware capability presented as a system surface. It is not
an application, a package, a download, a Market item, a filesystem artifact or
`InstalledSoftware`, and nothing about it is acquired by the player: the
release comes from VEYRA's own update path, and the only thing this surface can
do is ask the Device to install it.

It presents, from represented truth alone:

- the release the Device currently owns;
- the one concrete official newer release VEYRA offers it, when there is one,
  with that release's own headline and release notes;
- that installing requires this Device's PIN, and that the phone stays on its
  current release until the update finishes;
- an **Install** action.

Availability is `resolveAvailableVeyraFirmwareUpdate`
(`src/core/game/veyraFirmwareUpdate.ts`), read on every render from the
Device's own stable Firmware identity — a phone on 4.1 is offered VEYRA OS 4.2,
a phone already on 4.2 truthfully states that it is up to date, and a renamed
4.1 release is still offered 4.2 because identity, not the display version,
decides. Nothing about availability is stored, and no update server, firmware
catalogue, channel model or release registry is represented. The Settings root
additionally states the same derived availability twice, deliberately: once as
an update card while it is true, and once as the steady-state System Update row.

Opening, reading, leaving or re-entering System Update changes no canonical
state at all. **Install** opens the same `VeyraPinChallenge` Security and
Wallet-open use, which submits the entered PIN to
`startVeyraFirmwareUpdateForOperatedRemoteDevice`. That operation accepts no
Device argument — the phone being updated is the one the active Remote Session
already operates — and verifies against that Device's own PIN through the same
`verifyDevicePinForOperatedRemoteDevice` the rest of VEYRA uses. A wrong PIN is
stated as `Incorrect PIN.` and changes nothing whatever; Cancel changes nothing
whatever. A Remote Session and DeviceAccess make this screen reachable and
grant no firmware authority of their own.

### The installation

A successful start creates the Device's own canonical update progress, and from
that moment the phone presents the installation and nothing else:
`VeyraFirmwareInstall` (`src/apps/veyra/VeyraFirmwareInstall.tsx`) replaces
Home, every application, Settings and VEYRA's own navigation band for the
duration. The Shell's operating-context frame stays, because it was never part
of the phone.

The surface states the release being installed, the represented stage
(`Downloading update`, `Preparing update`, `Installing update`, `Finishing
update`) and a real progress percentage derived from canonical phase and
elapsed time by `deriveVeyraFirmwareUpdateProgress`. It runs no timer of its
own, animates no invented progress, and can neither advance, pause, cancel nor
complete the installation: the canonical transition owned by
`docs/current/DEVICE_SYSTEM.md` is the only thing that moves. Leaving the phone
and coming back shows exactly how far the real installation has got, and the
installation does not depend on Settings — or any VEYRA surface — staying open.

`FINALIZING`, the last represented installation stage, presents the update
settling into place without fabricating boot logs or hardware output. When it
completes, the canonical Device activates the release and enters its real
`SHUTTING_DOWN` / `DISCONNECTED` lifecycle. Ordinary Remote Session
reachability therefore removes this operating surface; VEYRA does not manually
disconnect it or present a local reboot simulation. The Device continues through
`BOOTING` and returns `RUNNING` / `CONNECTED` through the shared lifecycle.

Because the Session has ended and the obsolete GateSSH-derived Access has been
invalidated, the former in-session `VeyraFirmwareWelcome` is no longer reachable
for this flow. Reaching the updated phone again requires new legitimate Access
to its current GateSSH surface.

### Security

Security presents exactly one concrete setting, **Wallet protection** —
"Require Device PIN to open Wallet" — as a labelled row with a switch stating
the Device's own canonical `walletProtectionEnabled` truthfully (`docs/current/DEVICE_SYSTEM.md`).
It starts OFF.

Tapping the switch never mutates the setting by itself. It opens
`VeyraPinChallenge` (`src/apps/veyra/VeyraPinChallenge.tsx`) — the same
Device-PIN keypad Wallet-open uses — still inside Security, which verifies
against `changeWalletProtectionForOperatedRemoteDevice`
(`src/core/game/deviceSecurity.ts`) automatically on the fourth digit. A
correct PIN commits the requested state and returns to Security with an
ordinary confirmation notice; an incorrect PIN states "Incorrect PIN.",
clears the entered digits for another attempt, and leaves the setting exactly
as it was, without ever restating or otherwise implying the correct value;
Cancel leaves the setting exactly as it was and returns to Security. The PIN
itself never reaches this surface's own state beyond the digits currently
being entered, is never shown as visible text, and is cleared after every
attempt.

A Remote Session and DeviceAccess make this screen reachable; they grant no
authority to change what it shows. The only successful path is verification
against the operated Device's own PIN, resolved the same way Wallet resolves
its Account — through the active Remote Session's own target, never a
caller-supplied identity.

`walletProtectionEnabled` gates Wallet opening from Home, read fresh on every
attempt; see Wallet's own Wallet-open enforcement section above.


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

### Release-specific presentation

VEYRA OS 4.2 is the same product one release on, not a redesign into a
different one. `selectVeyraReleasePresentation` (`src/apps/veyra/veyraRelease.ts`)
resolves which release's presentation a phone gets from its own stable Firmware
identity on every render — never from stored presentation state and never from
the display version — and `VeyraOS` expresses it as one `data-release`
attribute the stylesheet refines under. A phone looks like the release it
really runs the moment it runs it, and losing or changing that Firmware changes
the look with it.

4.2 refines only presentation: a cooler, cleaner palette, larger radii and
lighter shadows, tighter heading tracking, captioned Settings groups with
inset row dividers, a quiet Home header naming the Device, launcher labels that
fit on one line, a settled Home pill instead of a ruled navigation band, and
one restrained arrival transition (disabled under `prefers-reduced-motion`).
It adds no application, changes no derived Home entry, and changes nothing any
screen states or any control does. The Home header is the Device's own
represented display name and nothing else: no greeting, time, weather, or
status.

The surface is mobile-first at a 390px reference and usable at 320, 430 and
834; content is capped and centred rather than stretched at tablet width.
VEYRA's scrolling region owns its own scrolling, and VEYRA reads no viewport
and keeps no keyboard state: moving between surfaces ends editing and waits for
the Shell's recovered editing geometry, the same contract RACK-OS consumes
(`docs/current/INTERFACE_SHELL.md`). This includes SEND's editable form moving
to its Review presentation: the form remains mounted after requesting the
Shell-owned end-editing intent and is replaced only after recovery is ready.


## Gotchas

- A firmware update is not software. VEYRA OS is closed Device-owned Firmware:
  the release is never downloaded to a filesystem, purchased, installed as a
  package or represented as `InstalledSoftware`, and the GateSSH implementation
  it ships stays the Device's own Service implementation for the same reason.
- Update progress is canonical, not animation. The install surface reads the
  Device's own update state and states real progress; it owns no timer and
  cannot finish the installation. Closing Settings, going Home, returning to
  NODE-OS, or never looking at the phone again changes nothing about it.
- A newer release is offered, never pre-applied. Petra's phone starts on 4.1
  with nothing installing, and only a correct Device PIN starts anything.
- Finishing an installation activates the release and begins a real Device
  reboot. Session loss follows from shared reachability, obsolete Access follows
  from the replaced credential surface, and VEYRA owns neither consequence.
- A Home icon is not authority. Presence is derived from represented truth on
  every render; there is no stored launcher state to disagree with the world.
- Client presence, represented data and emptiness are different. Communication
  is a Firmware-bundled client over represented Company Chat history, not the
  owner of that history. Wallet with no Transactions has a represented Account
  basis and may show a truthful empty Activity.
- A Remote Session is operating context, not financial authority. It decides
  which Device is acting and grants no Account: a phone with no Financial
  Session refuses a transfer even while the player operates it.
- VEYRA Wallet and NODE-OS Wallet are two clients over the same canonical
  Dollar domain. Neither owns balance, activity or authority, and the local
  Wallet stays bound to the local Device while a foreign phone is operated.
- Unsupported Firmware is refused at the handoff. It never falls back to
  RACK-OS, and the Session it refuses to present is still real and still
  disconnectable.
- A Remote Session is operating context, not Device-owner security authority
  either. Reaching Security and tapping its switch changes nothing by
  themselves; only a correct Device PIN commits the requested Wallet
  protection state, and the PIN is never Player Knowledge or ordinary
  presentation.
- Wallet-open authorization is presentation-local and single-use, never a
  canonical unlock. A correct PIN opens Wallet exactly once; it is never
  stored as `walletUnlocked`, a trusted session, or a timer, and leaving
  Wallet or losing the VEYRA operating surface discards it without any
  explicit reset code — the location that granted it is simply gone.

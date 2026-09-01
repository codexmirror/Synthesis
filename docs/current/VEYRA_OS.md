# VEYRA OS — current truth

Status: Accepted
Scope: The implemented VEYRA OS operating surface — Firmware-driven selection
of it, its Home launcher, its Communication, Wallet and Settings surfaces, its internal
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
`src/apps/veyra/veyraHome.ts` from this concrete Firmware presentation and the
represented bases it observes:

```text
Communication <- this VEYRA OS Firmware's presentation-only built-in client
Wallet        <- this Device -> its Civic Dollar Financial Session -> Account
Settings      <- this Device's represented VEYRA OS Firmware
```

There is no `homeApps[]`, launcher inventory, app registry, `LauncherState`,
`HomeLayoutState` or per-application presentation flag anywhere in
`GameState` or in presentation. Removing the phone's Financial Session removes
Wallet from Home; the player's own Financial Session is not a basis for it.

Communication is a built-in VEYRA OS placeholder client and appears first. Its
presence is Firmware presentation/product truth only: it is not installed
Software and establishes no communication capability or canonical state. The
root states only that Communication is unavailable. It presents no people,
messages, conversations, contacts, accounts, history, activity, notifications
or other communication data, and it does not infer an empty inbox or history
from the absence of represented foreign communication truth.

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

Settings is a Firmware-owned system surface. Its root currently has two
entries: **This Device**, which presents the Device display name and the
represented Firmware name and version as large, calmly spaced labelled rows;
and **Security**.

Nothing else is presented. There is no Connection entry, because this phone
represents no owner-facing connection state worth showing — and the player's
Remote Session is emphatically not it. There is no battery, storage, update,
permission, network or telemetry state, no internal Device ID, no CPU, RAM,
port, address, privilege, DeviceAccess, Session or exploit state: none of it
is either represented as owner-facing truth or appropriate to it.

```text
VEYRA CONNECTION != PLAYER REMOTE SESSION
```

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
- Client presence, represented data and emptiness are different. Communication
  is a Firmware-bundled placeholder with no represented communication data; it
  therefore states only that the client is unavailable and makes no claim about
  the person's history. Wallet with no Transactions has a represented Account
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

# VEYRA First Ordinary Phone V1

Status: Accepted
Scope: Design authority for the first ordinary VEYRA personal-phone product
structure, Home and application navigation grammar, and the representative
Communication, financial, and Settings product areas.

This document defines selected future product and presentation behavior. It
does not define current implemented behavior, create simulation state, select a
concrete NPC, or authorize implementation beyond represented truth and the
architecture boundaries owned elsewhere.

Parent design authority:
[`VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md`](VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md).

Normative owners of implemented truth remain the relevant `docs/current/`
documents and accepted code/tests.

---

## 1. Product target

The first ordinary VEYRA phone exists to prove:

> I am operating somebody else's ordinary personal smartphone.

The player reaches it from a technical NODE context after gaining access to a
foreign Device and establishing the represented connection required by the
game. The transition is from a machine-oriented environment to a quiet,
human-oriented personal environment.

The phone should invite exploration. It must not automatically summarize
secrets, expose the player's technical context, or read like another server.
Its primary product test is simple:

> This feels like a real ordinary person's phone.

The user should think in recognizable applications and human outcomes rather
than in system mechanisms.

---

## 2. Selected Home model

VEYRA Home is a conventional consumer-smartphone Home and application launcher.
It should immediately read as the familiar Home surface of an ordinary personal
phone.

Home presents recognizable application entries and Firmware-owned system
surface entries that represent human tasks. Conceptual product areas include:

* Communication;
* Wallet;
* Notes;
* Photos;
* Mail;
* Settings.

These are product-direction examples, not a mandatory V1 inventory. They do not
promise that any named application exists on every phone, or on the first
implemented phone.

Home should not read as:

* a technical dashboard;
* a Personal Domain index;
* a widget board;
* a NODE-style launcher;
* an abstract information-architecture demonstration.

The former **Personal Index / Personal Domains** model is rejected. Personal
Domains, Home projections, and projection-led navigation are not part of the
accepted first-phone structure.

---

## 3. Familiar without imitation

A conventional smartphone Home grammar permits app icons, app labels, consumer
spacing, visual personality, and a personal visual ground or wallpaper when
later truth and visual design permit them.

It does not select:

* an iOS or Android layout;
* Apple icon geometry;
* a copied dock or status bar;
* copied system gestures;
* any other brand's visual identity.

Familiar interaction grammar is allowed; brand imitation is not. VEYRA still
needs its own quiet, premium, human-facing identity as defined by the parent
contract. Exact iconography, grid geometry, wallpaper, dock, status area,
motion, typography, palette, and visual styling remain visual-design decisions.

---

## 4. Home presence is truth-derived

A normal launcher does not authorize fake applications. A concrete phone may
show an application or system-surface entry only when represented Device,
Firmware, Software, or domain truth provides a real basis for it.

Possible bases include concrete represented content, an installed software
product, a Provider or Account relationship, Device functionality, a
Firmware-owned system surface, or another canonical fact that makes the entry
truthful. Presence is derived from those facts.

Do not add presentation flags or inventories merely to populate Home, including:

```text
showNotes
showWallet
homeApps[]
personalDomains[]
hasCommunication
```

or equivalents.

Absence and emptiness remain different. An application with a represented basis
may truthfully open to an empty state. An application without a represented
basis is absent; Home must not reserve a fake slot, advertise an unrepresented
capability, or show "coming soon" merely to look complete.

---

## 5. An app entry is not a state owner

Freeze these boundaries:

```text
HOME APP ENTRY != GAMESTATE OWNER
APP ICON       != DOMAIN AUTHORITY
APP LABEL      != CAPABILITY
```

VEYRA Home is presentation and navigation. Underlying canonical truth remains
owned by the relevant systems:

```text
Wallet presentation
    -> Civic Dollar Provider / Account / Financial Session / Transaction truth

Communication presentation
    -> concrete future foreign-communication truth

Settings presentation
    -> Device- and Firmware-owned facts
```

The presence of an icon does not grant an Account, Session, authority, content,
access, or ability to perform an operation. Actions must use the canonical
domain/application boundary and succeed only when represented conditions allow
them.

No generic `AppRegistry`, `LauncherState`, `PersonalDomainState`,
`HomeLayoutState`, or equivalent is selected or justified by this contract.

---

## 6. Firmware and Software boundary

Not every Home entry must be installed `SoftwareState`. Some entries may be
Firmware-owned system surfaces; Settings is a likely example. Other entries may
be presentations of installed software or of a concrete domain relationship.

The exact boundary for each entry on the first implemented phone must be decided
concretely from its represented basis. This contract does not create a generic
App model or collapse Firmware and Software.

The durable separation remains:

```text
DEVICE != FIRMWARE != SOFTWARE != APP ENTRY != ACCOUNT != SESSION != PLAYER
```

Firmware owns its interaction and presentation model. It does not duplicate or
grant Device hardware, runtime, networking, filesystem, installed software,
Accounts, Sessions, or other canonical truth.

---

## 7. Navigation grammar

The simple V1 grammar is:

```text
HOME
    -> APPLICATION / SYSTEM SURFACE ROOT
        -> optional detail
```

Examples:

```text
HOME -> COMMUNICATION -> CONVERSATION
HOME -> WALLET
HOME -> SETTINGS -> THIS DEVICE
```

Selecting an application icon on Home opens that application's root. A Home
icon must not jump directly into arbitrary deep content unless a future concrete
product mechanic explicitly selects that behavior.

Within an application or system surface, **Back** moves one level upward. The
OS-level **Home** action returns to VEYRA Home regardless of current depth. Home
never means return to NODE; leaving the foreign operating context belongs to
the surrounding Shell/session boundary.

V1 does not require recents, an app switcher, global history, tabs between
applications, or gesture-only navigation. Their absence is a scope decision,
not a claim that Home is something other than an app launcher.

---

## 8. Human-purpose product areas

Application-oriented Home organization does not require provider machinery or
technical structure to dominate the user experience. VEYRA continues to
interpret represented truth through ordinary human purposes.

### 8.1 Communication

Communication remains a valid human-purpose product area. Its root should
foreground represented people, conversations, and content rather than provider
or protocol machinery.

The first VEYRA phone requires concrete foreign-communication truth before this
surface may appear. Current player mail must not be retargeted or relabelled as
somebody else's communication. The canonical ownership model for foreign
communication remains a later concrete decision.

### 8.2 Wallet and financial meaning

A consumer-facing financial application may use a human-facing label such as
**Wallet** if a later product/visual pass selects it. This contract does not
rename the canonical Dollar domain.

The Provider remains **Civic Dollar**. Do not create VEYRA Pay or another
Provider. Balance, Accounts, Financial Sessions, Transactions, and transfers
remain owned by canonical Dollar systems; VEYRA may present their meaning but
must not duplicate them.

### 8.3 Settings

Settings remains a likely Firmware-owned system surface. It interprets
represented Device, Firmware, Software, and related facts through understandable
human topics. It must not invent battery, storage, security, network, update, or
other plausible consumer state merely to look complete.

Settings does not own the facts it presents. **This Device**, if represented,
is a detail beneath the Settings root rather than a competing Device model.

---

## 9. Presentation truth and restraint

VEYRA presents meaning rather than raw mechanism, but abstraction never permits
fabrication. Player-facing content and values must come from represented
canonical state.

Do not invent messages, contacts, photos, notes, mail, financial activity,
balances, Accounts, timestamps, notifications, badges, connectivity, telemetry,
security state, battery state, storage, or other plausible facts for atmosphere.
Silence, absence, and truthful empty states are valid.

Home also must not leak the hacker's Remote Session, access method, privileges,
NODE tooling, or technical route into ordinary owner-facing phone presentation.
A Remote Session can make the foreign surface operable without becoming its
owner-facing connection state.

---

## 10. Representative surfaces and implementation prerequisites

This product contract illustrates its grammar with Home, Communication, Wallet,
and Settings. That set is not a mandatory implementation inventory. A concrete
first phone includes only the entries whose represented basis has actually been
selected and implemented.

Before implementation, concrete work must resolve only what its chosen slice
needs, including as applicable:

* a Device instance and installed VEYRA Firmware release;
* a truthful basis for each visible Home entry;
* the Firmware-versus-Software ownership of each entry;
* foreign communication ownership and content, if Communication is included;
* a concrete Civic Dollar relationship, if Wallet is included;
* Firmware-driven foreign-surface selection at the Shell/presentation boundary.

Those decisions must not be pre-solved with generic app, launcher, registry,
layout, Person, communication, Session, or Firmware frameworks.

---

## 11. Explicit non-goals and unresolved visual decisions

This contract does not select or implement:

* VEYRA Home or VEYRA OS;
* a phone model, Firmware release, owner, Person/NPC model, or authored content;
* Communication, Notes, Photos, Mail, Wallet, or Settings inventory;
* foreign communication truth;
* new GameState, Software/App state, or launcher infrastructure;
* wallpaper, icons, grid geometry, dock, status area, gestures, or final Home;
* App Store, notifications, multitasking, recents, permissions, sandboxing,
  signing, updates, battery, or storage mechanics;
* Shell or Remote Session changes;
* a generic App, Personal Domain, capability, registry, or Firmware framework.

Visual design must make the selected conventional Home grammar recognizably
VEYRA without reopening truth ownership or inventing content.

---

## 12. Visual exploration status

[`VEYRA_FIRST_ORDINARY_PHONE_VISUAL_EXPLORATION_V1.md`](VEYRA_FIRST_ORDINARY_PHONE_VISUAL_EXPLORATION_V1.md)
is historical, non-authoritative exploration. Its Personal Index Home candidate
was rejected and must be revised before it can inform a future accepted visual
direction. Its Communication, Money, and Settings screen work may still inform
the next pass where consistent with this contract.

No visual direction is accepted by this product correction.

---

## 13. Frozen decisions

```text
VEYRA HOME
= conventional consumer-smartphone Home / app launcher

HOME ENTRY PRESENCE
= derived from represented truth

HOME
-> application or system-surface root
-> optional detail

HOME APP ENTRY != GAMESTATE OWNER
APP ICON       != DOMAIN AUTHORITY
APP LABEL      != CAPABILITY

WALLET PRESENTATION != DOLLAR AUTHORITY
COMMUNICATION PRESENTATION != COMMUNICATION AUTHORITY
SETTINGS PRESENTATION != DEVICE OR FIRMWARE TRUTH OWNER

FAMILIAR GRAMMAR != BRAND IMITATION
VEYRA HOME      != RETURN TO NODE
UNREPRESENTED TRUTH = ABSENT, NOT FABRICATED
```

---

## 14. Design review test

Future first-phone work should be rejected or reconsidered if it fails these
questions:

1. Does Home immediately read as an ordinary personal smartphone app Home?
2. Does every visible entry have a concrete represented basis?
3. Is entry presence derived rather than stored as redundant presentation
   state?
4. Does selecting a Home icon open its root rather than arbitrary deep content?
5. Are app entry, Firmware, Software, capability, and state ownership still
   distinct?
6. Does Wallet preserve Civic Dollar Provider, Account, Session, Transaction,
   and transfer authority?
7. Does Communication rely on truthful foreign-communication state?
8. Does Settings expose only represented Device/Firmware/Software truth?
9. Has any plausible consumer content or state been fabricated?
10. Are Back, Home, and return-to-NODE still distinct operations?
11. Does the design use familiar smartphone grammar without copying another
    brand?
12. Has the work avoided a generic App or launcher framework?

The accepted visual target remains open. The next visual pass should revise Home
around this conventional launcher decision while preserving any useful internal
screen work that remains truthful.

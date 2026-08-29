# VEYRA First Ordinary Phone — Visual Exploration V1

Status: Draft — Exploration / Candidate. **NOT Accepted.** No visual direction is
selected. Human selection comes next.
Scope: A visual and product-language exploration of the already-frozen first
ordinary VEYRA phone structure. It compares three candidate directions, renders
each as a six-screen set, and recommends one for human selection. It selects no
structure, no world truth, and no implementation.

Structural design authority (unchanged and authoritative over this document):
[`VEYRA_FIRST_ORDINARY_PHONE_V1.md`](VEYRA_FIRST_ORDINARY_PHONE_V1.md).
Parent identity authority:
[`VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md`](VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md).

---

## 1. What this document is and is not

This is the visual exploration pass that
[`VEYRA_FIRST_ORDINARY_PHONE_V1.md`](VEYRA_FIRST_ORDINARY_PHONE_V1.md) §35 asks
for. It interprets the accepted structure; it does not redefine it.

It is **not** a product-structure authority. Where anything here appears to
disagree with the accepted first-phone contract, the accepted contract wins and
this document is wrong. It creates no simulation state, selects no NPC, no Device
model, no VEYRA OS release, no authored content, and authorizes no
implementation.

VEYRA remains unimplemented. `docs/current/` is untouched by this pass.

### Placeholder content

Every person, message, device name, system version and account reference in the
reference images is **VISUAL MOCKUP CONTENT — NOT SELECTED CANONICAL WORLD
TRUTH**. It exists only to make hierarchy judgeable. Nothing in it selects a
correspondent, an owner, a conversation, a Device display name, a Firmware
release, or a Transaction.

Two things in the images are deliberately shape-truthful rather than invented,
because their represented shape is already known and designing against a fake
shape would have wasted the pass:

- the balance `$1,250.00` and the provider name `Civic Dollar` are the
  represented initial Dollar Account balance and Provider display name
  (`docs/current/DOLLAR_FINANCE.md`);
- activity rows carry only what a represented Transaction actually projects — a
  counterparty account-reference snapshot, direction, and a signed amount, with
  no timestamp, merchant, category, fee or status.

The account references themselves, and the fact that any Transaction exists at
all, are mockup. Initial represented state has **no** Transactions, so a truthful
first render of Money would show the empty case; activity is drawn here only so
the three directions' activity presentation can be compared.

---

## 2. Repository truth this pass started from

Inspected `main` at `7eac2d756178bd18883b336817716324387c73e3`.

### Inherited from the accepted Company identity

- Meaning over mechanism; complexity is a product defect.
- Premium-mainstream and socially ordinary, not exotic, elite or hacker-specific.
- Quiet, soft depth, proportional type, larger visual subjects, content-first
  composition, less visible structural chrome, controlled rounding, restrained
  motion, human language.
- Hiding represented truth is permitted; inventing truth is prohibited.
- Must not become an iOS clone, NODE-OS with rounded corners, cyberpunk, neon, or
  a generic colourful app launcher.
- Recognizably VEYRA without a logo.

### Frozen by the First Ordinary Phone contract

Home is a personal index, not a launcher. Personal Domains are presentation over
represented truth. The hierarchy is Communication → Money → Settings, with
Communication intentionally dominant and Settings deliberately quiet. Home
projections are not deep links. Communication is people → conversations →
content. Money is balance → provider (secondary) → send/receive → activity →
account. Settings is This Device / Connection / Apps & Software. Back moves one
level up inside the current Domain and a Domain root therefore needs none. Home
returns to the personal index and never means return-to-NODE. Normal operation is
quiet; unrepresented truth is absent rather than fabricated.

### Intentionally unresolved, and therefore open to this pass

Home geometry and vertical composition, the visual weight of Communication versus
Money, whether Home visibly says "Home", how Domain projections look, whitespace
and separation, the Back and Home affordances, header geometry, typography,
palette, iconography, depth, rounding, spacing, motion, brand presence, empty-state
wording, provider/account typographic treatment, and responsive composition.

### Must not be invented, because the simulation does not represent it

Battery, storage, signal, clock time, notifications, badges, unread counts,
recency, presence ("online", "last seen", "typing"), message timestamps,
transaction timestamps, merchants, categories, fees, pending or settlement state,
QR payments, transfer speed, security or update status, permissions, app usage,
CPU/RAM/ports/PIDs/routing, and the player's own Remote Session, DeviceAccess,
target address or privilege.

One boundary is worth restating because it is easy to get wrong visually:
**Settings → Connection is the owner-facing connectivity of the foreign Device.
It is not the player's Remote Session.** A VEYRA screen must never say
"Connected" because the player is currently connected to it.

### Current NODE-OS, inspected as the contrast reference

NODE-OS Home is a two-column launcher of eight application tiles plus a
`THIS DEVICE` facts block, inside a Shell whose permanent top bar carries Firmware
identity, Device name, address, clock and connectivity. Its language
(`src/styles/tokens.css`, `src/styles/nodeui.css`) is matte near-black on a
green-black ground, restrained mint accents, monospace throughout, uppercase
letterspaced micro-labels at 0.52–0.58rem, hairline rules as the primary
structural device, and dense key/value facts lists. The Shell is `1120 × 780`
maximum on desktop and fills the viewport below 700px. RACK-OS shows how a
foreign Firmware surface already mounts: full-bleed across the whole Shell
(`grid-row: 1 / -1`), replacing NODE chrome including the status bar, and owning
its own palette rather than consuming NODE tokens. A VEYRA surface would occupy
that same position.

---

## 3. Method

- **Pass 0** — read the accepted VEYRA contracts, the owning current-truth
  documents for Interface/Shell, Communication, Dollar finance and Network access,
  the relevant architecture modules, and the real NODE-OS and RACK-OS
  implementation and Shell geometry.
- **Pass 1** — chose three genuinely different answers to "what is Home
  spatially, and what carries hierarchy", rather than three palettes.
- **Pass 2** — built a standalone static prototype and rendered all eighteen
  screens at 390 × 800.
- **Pass 3** — inspected the renders and rejected what did not survive looking at
  it: a Home whose content stopped at 45% of the frame in all three directions, a
  Home control that was invisible against two of Direction C's grounds, per-message
  speaker labels that made Direction B's conversation noisy, a duplicated device
  name on Direction A's settings detail, and a serif stack that silently fell back
  to a Times face.
- **Pass 4** — refined each direction to the same level.
- **Pass 5** — the side-by-side critique in §8 and the recommendation in §9.

### Reference artifacts

The prototype is
[`prototypes/veyra-first-ordinary-phone-v1/`](prototypes/veyra-first-ordinary-phone-v1/index.html).
It is plain static HTML and CSS. It imports nothing from `src/`, is not built by
Vite, is not typechecked or tested, is never mounted by the Shell, and touches no
`GameState`, Remote Session or gameplay routing. It is preserved rather than
discarded because the next pass — and the human selection this pass exists to
support — needs to open these screens in a real browser at a real width, which a
PNG cannot provide. Each direction page reduces to a single screen at a chosen
width with `?only=home&w=320`, so a direction can be opened on an actual phone.

Rendered references are under
[`../assets/veyra-first-ordinary-phone-v1/`](../assets/veyra-first-ordinary-phone-v1/).
Every screen is rendered directly with no device frame, because the design has to
be judged as a surface that will later sit inside the Synthesis Shell.

`capture.mjs` regenerates the images using whatever Playwright the machine
provides. It is deliberately not wired into `package.json`: the repository's
dependencies should not grow for a design pass.

**Rendering caveat, stated rather than glossed:** the capture environment has no
Charter, Iowan Old Style, Georgia, or any Apple/Microsoft UI face. Direction A's
serif therefore renders as DejaVu Serif and the sans of all three renders as
Liberation Sans. On the platforms Synthesis actually targets these stacks resolve
to different faces, and Direction A in particular will look materially warmer and
sturdier on iOS/macOS than these images show. No remote font is used or proposed.

---

## 4. The three directions

They share the same structure, the same screens and the same content. They differ
in what carries hierarchy, what Home is spatially, how much chrome exists, how
depth works, how strong Domain boundaries are, and how navigation is expressed.

| | **A — “Index”** | **B — “Held”** | **C — “Frame”** |
| — | — | — | — |
| Hierarchy carried by | type and whitespace | surface size and elevation | region proportion and ground |
| Home is | a title page: one centred typographic index | unequal objects composed on a ground | a fixed frame of three unequal full-bleed regions |
| Home scrolls | yes, if it grows | yes, if it grows | **never** |
| Structural device | a hairline | a rounded elevated surface | a change of ground |
| Depth | none | soft shadow, two elevations | none |
| Domain boundary strength | weak (one continuous column) | medium (objects on one ground) | strong (each Domain is its own ground) |
| Typography | two families; **subjects are serif**, non-subjects small sans | one family; hierarchy from **weight** 300–700 | one family, **one weight**; hierarchy from size and ground |
| Micro-labels | sentence case | uppercase, tracked | uppercase, tracked |
| Icons | none | a small inline line family (5 marks) | none |
| Chrome | a top control line, absent on Home | a floating control capsule, absent on Home | a permanent 60px edge band, absent on Home |
| Accent | one deep teal mark | one clay fill | the grounds themselves |
| Ground | light warm paper | warm graphite | sand / deep ink-green / cool grey per Domain |

Naming was done last and is a convenience for discussion only.

---

## 5. Screen by screen

### Home

![Direction A Home](../assets/veyra-first-ordinary-phone-v1/direction-a-home.png)
![Direction B Home](../assets/veyra-first-ordinary-phone-v1/direction-b-home.png)
![Direction C Home](../assets/veyra-first-ordinary-phone-v1/direction-c-home.png)

**A** centres the whole index vertically as a title page. Each Domain is a group
of type — a quiet sentence-case label with the Domain's most human content set
large beneath it — separated by hairlines. The person is the largest thing on the
screen; the Domain name is the smallest. The entire group is one tap target, so
tapping "Ana" enters Communication root rather than the conversation, as the
contract requires.

**B** composes two unequal objects and one non-object. Communication is the
largest surface and carries three represented people as monogram-and-name; Money
is a smaller, more elevated surface carrying the balance with the provider as a
caption. Settings is deliberately the only Home element with no surface at all —
it lies flat on the base ground as a single row. Quietness is structural, not
just chromatic.

**C** gives the frame to the Domains in proportion: Communication 54%, Money 27%,
Settings 19%, edge to edge, no gaps, never scrolling. The hierarchy is the
geometry. Home also previews each Domain's world, because the ground the user sees
on Home is the ground they will be standing in after they tap.

None of the three shows a badge, an unread count, a timestamp, a recency claim, a
notification, a battery, a clock, a signal indicator, or a VEYRA masthead.

### Communication root and conversation

![Direction A Communication](../assets/veyra-first-ordinary-phone-v1/direction-a-communication.png)
![Direction B Communication](../assets/veyra-first-ordinary-phone-v1/direction-b-communication.png)
![Direction C Communication](../assets/veyra-first-ordinary-phone-v1/direction-c-communication.png)

Every direction leads with the person's name and gives the represented preview a
quieter second line. No provider, address, protocol, mailbox or message
identifier appears anywhere. **A** sets names in the serif on hairline-separated
rows; **B** puts monogram-and-name rows inside one surface; **C** uses full-bleed
rows on the Communication ground.

![Direction A conversation](../assets/veyra-first-ordinary-phone-v1/direction-a-conversation.png)
![Direction B conversation](../assets/veyra-first-ordinary-phone-v1/direction-b-conversation.png)
![Direction C conversation](../assets/veyra-first-ordinary-phone-v1/direction-c-conversation.png)

**A** renders the conversation as a reading transcript: each message is body type
with a small name above it, and the owner's own messages are indented behind a
hairline. **B** uses soft bubbles with the owner's side raised, and names the two
parties once in the header rather than labelling every message. **C** makes the
conversation a place: each message is a full-bleed band, and the owner's messages
sit on a slightly deeper tone of the same ground.

Three deliberate choices are shared:

- **The owner is named, not "You".** The outgoing party on this Device is the
  Device's owner, and the player is a visitor. Naming them is the cheapest way to
  make the screen say "this is somebody else's phone".
- **No composer.** §10.3 of the accepted contract permits a reply affordance only
  where the represented mechanics support replying, and foreign-phone
  communication truth is explicitly unresolved (§11, §33.A). Adding a composer
  here would have been an implementation promise this pass has no right to make.
  Where a reply affordance would sit, if a later mechanic represents one, is noted
  per direction in §7.
- **No timestamps, presence, read markers or delivery state.**

### Money

![Direction A Money](../assets/veyra-first-ordinary-phone-v1/direction-a-money.png)
![Direction B Money](../assets/veyra-first-ordinary-phone-v1/direction-b-money.png)
![Direction C Money](../assets/veyra-first-ordinary-phone-v1/direction-c-money.png)

All three lead with the amount and demote `Civic Dollar` to a caption — the
inversion of the NODE Wallet's provider-first framing, and the inversion of a bank
app's account-first framing. None of them reskins the NODE Wallet: there is no
balance trajectory, no monogram identity module, no uppercase financial terms
list, no state chip, and no NODE section.

**A** treats Send, Receive and Account as three rows in the same grammar as every
other list in the OS. **B** is the only direction with a real action hierarchy: a
filled clay Send, an outlined Receive, and Account demoted to a row. **C** puts
the balance in the plane's headspace and the actions in the same full-bleed rows
the whole OS uses, on a ground that makes Money feel like a different room of the
same house.

Activity carries direction, counterparty reference and a signed amount, and
nothing else. Direction survives without colour in all three, because the word and
the explicit sign both carry it.

### Settings

![Direction A Settings](../assets/veyra-first-ordinary-phone-v1/direction-a-settings.png)
![Direction B Settings](../assets/veyra-first-ordinary-phone-v1/direction-b-settings.png)
![Direction C Settings](../assets/veyra-first-ordinary-phone-v1/direction-c-settings.png)

Three topics, no more: This Device, Connection, Apps & Software. Connection states
`Connected` as owner-facing Device connectivity; it is not the player's session.
Each direction expresses "quieter" differently — **A** drops the whole surface to
a softer ink, **B** removes the surface entirely, **C** uses its most neutral
ground.

![Direction A This Device](../assets/veyra-first-ordinary-phone-v1/direction-a-settings-device.png)
![Direction B This Device](../assets/veyra-first-ordinary-phone-v1/direction-b-settings-device.png)
![Direction C This Device](../assets/veyra-first-ordinary-phone-v1/direction-c-settings-device.png)

This Device shows two facts and then stops. That emptiness is the point, and it is
the single best test in the set of whether a visual language survives having
almost nothing to say. It is also where NODE and VEYRA diverge most sharply: NODE's
`THIS DEVICE` block states name, address, Firmware and network status as a facts
list, and NODE's System application goes considerably further. VEYRA states a name
and a system, and offers no battery, storage, security, diagnostics or telemetry —
because none is represented, and because a VEYRA owner would have no reason to
look.

### Boards

Full six-screen sets:
[A](../assets/veyra-first-ordinary-phone-v1/direction-a-board.png) ·
[B](../assets/veyra-first-ordinary-phone-v1/direction-b-board.png) ·
[C](../assets/veyra-first-ordinary-phone-v1/direction-c-board.png)

---

## 6. Back and Home

![Width plausibility](../assets/veyra-first-ordinary-phone-v1/width-plausibility.png)

All three implement exactly the frozen grammar and nothing else: Back moves one
level up inside the current Domain, a Domain root carries no Back, and Home
returns to the personal index regardless of depth. No app switcher, recents,
tabs, cross-Domain history or gesture-only navigation appears in any direction.

- **A** — a control line at the top of the column. Back names its destination
  (`↑ Communication`), which is the clearest of the three; Home is a small marked
  word at the right. Both are quiet, small and at the top of a tall screen: least
  reachable, and easiest to miss.
- **B** — a floating capsule at the bottom centre, always the same shape in the
  same place, gaining a Back half only at depth. Most discoverable, best placed
  for a thumb, and the clearest statement that Back and Home are OS operations
  rather than content. Costs roughly 110px of reserved vertical space on every
  screen below Home.
- **C** — a 60px edge band that belongs to the plane rather than floating over it,
  with Home centred and Back appearing at the left only at depth. Same thumb-zone
  advantage as B, no floating object, but its Back is a bare `‹ BACK` that does
  not name where it goes.

All three drop the control entirely on Home, because Home has nowhere upward to go
and no other index to return to. That is a shared position worth stating: the OS
shows a navigation control only where it leads somewhere.

Nothing in any direction offers a return to NODE. Leaving the foreign operating
surface belongs to the Synthesis Shell, which already owns that transition for
RACK-OS.

---

## 7. Motion, conceptually only

No motion system was built, and none should be. Each direction implies one
transition principle, offered as direction rather than specification:

- **A** — no spatial movement at all. Home → Domain is a cross-fade of type at a
  fixed position, because A has no surfaces to move.
- **B** — the tapped surface expands into the screen and contracts back on Home;
  the control capsule never moves, which is what makes it read as an object rather
  than a bar.
- **C** — the tapped region grows to fill the frame and the other two collapse
  into its edges; Home reverses it. The ground is continuous through the
  transition, which is the whole idea: you were already looking at where you are
  going.

None of these should be used to compensate for information architecture, and none
is required for a first implementation.

### Where a reply would go, if one is ever represented

Recorded so a later pass does not have to re-derive it: **A** would add a single
text control at the foot of the transcript column; **B** would add a second
surface below the thread, above the capsule; **C** would add a band in the
owner's ground directly above the edge band. None of these is proposed now.

---

## 8. Side-by-side critique

Against the evaluation matrix. "Yes" means the rendered screens actually show it.

| | A | B | C |
| — | — | — | — |
| 1 Home is a personal index | Yes — strongest as a literal index | Mostly; the people row edges toward a favourites widget | Yes — the only one where hierarchy is geometric |
| 2 Avoids app-launcher reading | Yes | Yes, but closest to a widget board | Yes |
| 3 Communication feels personal | Yes | Yes | Yes — most distinctive treatment |
| 4 Money consumer, no invented finance | Yes, but no action hierarchy | Yes — best action hierarchy | Yes, but no action hierarchy |
| 5 Settings interprets, not exposes | Yes | Yes | Yes |
| 6 Back / Home understandable | Clearest wording, worst placement | Most discoverable | Well placed, weakest wording |
| 7 Unmistakably not NODE | Yes — maximal contrast | Yes | Yes — structural, not only chromatic |
| 8 Not a generic iOS/Android clone | Yes | **Weakest** | Yes — strongest |
| 9 Grammar survives all six screens | Yes | Yes | Yes |
| 10 Implementable in the real viewport | Yes — simplest | Yes | Yes — maps onto how RACK-OS already mounts |
| 11 No fake telemetry or content | Yes | Yes | Yes |
| 12 Still VEYRA without a logo | Yes | Partly | Yes — strongest |

### Where each one is genuinely weak

**A.** Almost nothing looks tappable; the whole product relies on the user
trying. It has no action hierarchy, so Send carries exactly the visual weight of
Apps & Software. Most seriously, it reads *editorial* — a beautiful reading
product — where the accepted Company identity asks for dominant, premium-
**mainstream**, socially ordinary consumer technology. A phone that looks like a
literary journal is a different company from the one in
`VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md` §4. Its serif-first identity is also the
most platform-fragile: the first choices in that stack exist on Apple platforms
and degrade elsewhere, changing the product's character rather than just its
texture.

**B.** Monogram avatars, rounded elevated cards, chat bubbles, a filled pill
primary action and a floating capsule are all mainstream consumer vocabulary.
It is the most immediately likeable of the three and the most likely to be
described as "a nice dark phone" rather than as VEYRA. It is the only direction
with a real generic-smartphone risk, and it is a real one. It also spends the
most vertical space on chrome.

**C.** Send, Receive and Account are three identical rows, so Money has no action
hierarchy — the same weakness as A. Back does not name its destination. The
non-scrolling Home is a strong commitment: it needs a stated rule for what happens
on a short viewport (the Shell already has a `max-height: 650px` case) and for what
happens if a fourth Domain ever earns a represented basis. Ground-per-Domain is
also a commitment — a dark Money plane inside an otherwise light OS reads as
arbitrary until the user has entered it once.

### Width behaviour

All three were checked at 320, 390, 430 and 834 CSS px. No label overflows, no
row clips and nothing overlaps at 320. At 834 each direction constrains its
measure rather than stretching it: A and B centre a 520px column, C keeps its
grounds full-bleed and grows the inset to a 560px measure. C's Home is the only
composition that is proportional to the frame at every width rather than
top-anchored, which is exactly why it is also the one that needs a short-viewport
rule.

---

## 9. Recommendation

**Direction C, “Frame”.**

Not because it is the prettiest — B is the most immediately likeable — but
because it is the only one of the three in which the frozen product structure is
expressed by the product itself rather than styled on top of a neutral layout.

- The accepted hierarchy Communication → Money → Settings is the geometry. It is
  not a stacking order that a future change could quietly flatten; it is 54 / 27 /
  19 percent of the frame.
- It passes the accepted contract's own hardest test — §34 question 14, "could the
  interface still be structurally distinguished from a normal app grid if all
  colours, icons, branding and styling were removed" — most strongly. Strip C to
  wireframe and it is still three unequal regions of a fixed frame carrying
  different kinds of content. Strip A and it is a text column; strip B and it is
  two boxes and a row, which is nearer to a widget board.
- It is simultaneously the furthest from NODE and the furthest from a generic
  iOS/Android launcher. It has no cards, no elevation, no rounding, no icons, no
  tab bar, no bubbles, no mono, no uppercase technical facts list and no launcher
  grid. A non-scrolling Home is genuinely unusual on a phone, which is worth
  something for a Device that must read as a different company's product.
- "Somebody else's ordinary environment" lands hardest in C's conversation, where
  the correspondence is the place rather than an object inside a chat client.
- It maps onto the real Synthesis Shell most naturally. RACK-OS already mounts a
  foreign Firmware surface full-bleed across the whole Shell with its own palette;
  a ground-owned, edge-to-edge VEYRA plane is exactly that shape, and C needs no
  shadow system, no icon set and no font beyond the system stack.

### Risks to accept with it

1. **No action hierarchy in Money.** Must be fixed before implementation.
2. **Back does not name its destination.**
3. **The non-scrolling Home needs an explicit rule** for short viewports and for a
   fourth Domain. Until that rule exists, C's best idea is also its most brittle.
4. **Ground-per-Domain is a commitment.** Adding Domains later means adding
   grounds, and the palette has to stay muted and legible in both text directions.
5. Its uppercase tracked micro-labels are the one place C brushes against NODE's
   voice.

### What to carry over from the directions not chosen

- **From B: the action hierarchy.** A filled primary action for the one
  consequential thing on a surface, an outlined secondary, and navigation demoted
  to a row. This is the single clearest improvement available to C, and it is
  already an accepted idea in the repository — the NODE Wallet reserves its filled
  treatment for exactly the same purpose.
- **From B: naming the two parties once in the conversation header** rather than
  labelling every message. C should adopt this and drop its per-message labels,
  keeping the ground change as the speaker signal.
- **From A: Back naming its destination.** `‹ Communication` costs nothing and is
  strictly clearer than `‹ Back`.
- **From A: sentence-case micro-labels.** This removes C's only NODE-adjacent
  trait at no cost.
- **From A: the serif for personal subjects**, if a later pass wants more warmth —
  but confined to the Communication ground, and only with a stack that degrades
  acceptably off Apple platforms. This is optional and it is the one carry-over
  that could muddy C's identity, because C's discipline is one family at one
  weight. Try it; discard it quickly if it dilutes.

This recommendation is a recommendation. It is not accepted, and the human
selection is the next step.

---

## 10. What this pass did not do

No production code, `GameState`, Shell routing, Remote Session, NODE application,
style token or test was changed. No gameplay or domain implementation occurred. No
VEYRA OS, operating surface, Firmware dispatch, Personal Domain framework,
communication truth, financial provider, Device model, NPC, or app was
implemented. `docs/current/` and `docs/architecture/` are unchanged, and neither accepted
VEYRA contract was edited — the routing entry for this document lives in the
documentation portal, where routing belongs.

Implementation remains blocked on the prerequisites the accepted contract already
names in its §33: foreign communication truth, Firmware-driven foreign-surface
selection at the Shell boundary, the concrete first-phone representation, the
Money adapter boundary, and a represented basis for each Domain. A selected visual
direction does not unblock any of them.

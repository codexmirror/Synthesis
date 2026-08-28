# VEYRA Company + Product Identity V1

Status: Accepted
Scope: Design authority for VEYRA's company identity, consumer-product
philosophy, and the future VEYRA OS Firmware-family direction. This contract
defines product decisions, not current implemented behavior or simulation
state.
Normative owner of current implemented Device and Firmware behavior:
[`../current/DEVICE_SYSTEM.md`](../current/DEVICE_SYSTEM.md).


## 1. Status, scope, and authority

This document is the single design owner for the first selected VEYRA identity.
It exists before any VEYRA product is represented so later ordinary-phone work
has a durable product test without treating corporate worldbuilding as
simulation truth.

VEYRA and VEYRA OS are **not currently implemented**. This contract does not
create a Company entity, Device, Firmware release, application, mechanic, or
`GameState` owner. Canonical simulation state, implemented current-truth
documents, and the architecture invariants remain authoritative over anything
shown by a future VEYRA interface.


## 2. Why VEYRA exists

VEYRA provides the consumer-technology counterpoint that lets a foreign
personal Device feel designed for somebody other than the NODE-OS user. It
prevents a future ordinary phone from becoming NODE-OS with different styling.

The intended proof is not corporate lore. It is a materially different product
philosophy operating over the same simulation architecture.


## 3. Core belief

**Complexity is a product defect.**

VEYRA believes people should interact with human goals and outcomes rather than
machine structure. Its product philosophy is **meaning over mechanism**.

The concise contrast is:

> NODE asks, “What is the machine doing?” VEYRA asks, “Why should the user need
> to know?”


## 4. Target customer and market role

VEYRA is a dominant premium-mainstream consumer technology company. It designs
for ordinary people rather than technical specialists: private users, workers,
students, merchants, creatives, and small businesses.

Its products are high-quality mainstream consumer technology. Encountering a
VEYRA phone should feel socially ordinary, not exotic, elite-only, or
hacker-specific. No exact market share, price, history, or product tier is
selected.


## 5. Relationship to NODE

NODE and VEYRA embody competing legitimate philosophies, not good and bad.

NODE values visibility, inspectability, control, precision, technical
competence, and exposing machine structure where useful. VEYRA values
abstraction, simplicity, consistency, protection, a controlled experience, and
meaning over mechanism.

NODE may regard VEYRA as an elegant black box. VEYRA may regard NODE as
needlessly complicated specialist equipment. Neither judgment is normative.


## 6. Product philosophy

VEYRA builds integrated personal technology as finished products rather than
as visible collections of components. Hardware and Firmware are designed
together from a product perspective, but this integration is a design approach,
not an ownership rule.

A VEYRA Device may still represent hardware, runtime, Processes, filesystem,
networking, software, services, credentials, accounts, and other Device truth.
Ordinary VEYRA presentation may deliberately hide or abstract those facts; it
does not move them into Firmware.


## 7. VEYRA OS identity

**VEYRA OS** is the selected working identity for a consumer personal-device
Firmware family. It should eventually make an ordinary personal Device feel
radically different from NODE-OS while operating over the same underlying
simulation architecture.

The family identity is not a release. No version, release history,
compatibility matrix, represented installation, or concrete behavior is
selected here.


## 8. Information exposure philosophy

VEYRA presents meaning rather than raw mechanism. Where NODE might expose
runtime structure, Processes, technical identifiers, filesystem paths,
networking or Firmware detail, tools, or Terminal, VEYRA may instead present
people, content, accounts, apps, understandable connection state, consumer
settings, and human-readable organization.

That distinction is conditional on represented truth:

```text
HIDING TRUTH    = permitted Presentation behavior
INVENTING TRUTH = prohibited
```

Abstraction must preserve underlying canonical state. A rich-looking consumer
surface may not manufacture content, telemetry, accounts, activity, storage,
security claims, or other plausible facts.


## 9. Navigation and app philosophy

VEYRA presentation prioritizes a clear Home, direct applications, shallow
navigation, few simultaneous decisions, strong content hierarchy, and ordinary
human concepts. An ordinary task should rarely require understanding system
structure.

Possible activity-oriented labels include Messages, Photos, Finance or Wallet,
Contacts, Mail, Browser, Camera, Notes, and Settings, **where and when the
corresponding capabilities and facts are represented**. These are direction
examples, not an application inventory or implementation requirement.


## 10. Visual and interaction language

The high-level contrast is frozen; a final visual system is not.

NODE is matte black, technical, restrained, precise, relatively static, dense,
machine-legible, and emphasizes monospace typography and thin rules.

VEYRA is quiet and premium, with soft depth, proportional typography, larger
visual subjects, content-first composition, less visible structural chrome,
controlled rounding, restrained motion, human language, and clear hierarchy.
Its interaction feel may later use quiet navigation, restrained transitions,
soft confirmation, and stronger but controlled feedback for important states —
never game-like vibration spectacle.

VEYRA must not become an iOS clone, NODE-OS with rounded corners, cyberpunk,
neon, a generic colorful app launcher, or a fake smartphone skin disconnected
from simulation truth. Exact palette, icon language, motion grammar, haptics,
and Home composition remain unresolved. Browser haptics are not current truth.


## 11. Privacy and security philosophy

VEYRA genuinely values consumer privacy and security and is not secretly a
surveillance company by default. Its stance is protective and restrictive:

> We protect the user from others, and sometimes from complexity or dangerous
> choices.

Application isolation, understandable permissions, restrictive defaults,
curated software, controlled platform access, and aggressive security
maintenance are possible product directions only. Company philosophy does not
create sandbox, permission, signing, update, vulnerability, patch, or automatic
update state.


## 12. Third-party software philosophy

VEYRA is compatible in principle with third-party applications but prefers a
controlled ecosystem. Signing, review, sandboxing, curated distribution, or
restricted APIs may later express that preference only when concrete mechanics
require and represent them. This contract creates none of those systems.


## 13. Update philosophy

VEYRA conceptually maintains its ecosystem aggressively and prioritizes closing
security defects. A future mechanic could therefore make an old concrete VEYRA
Firmware release interesting to attackers while a newer release closes a
represented weakness.

This direction does not assert any release, defect, exploit, patch, cadence, or
updater. Simulation should express it only through future concrete mechanics.


## 14. Terminology

Ordinary legitimate-user presentation should prefer truthful human language
such as **Apps**, **Account**, **Privacy**, **Storage**, **Network**,
**Devices**, and **Background Activity**.

It should not normally foreground PID, daemon, service implementation, mount,
raw internal IDs, kernel internals, absolute system paths, or raw logs when the
product philosophy makes them irrelevant to the task. This is presentation
language; represented underlying concepts continue to exist.


## 15. Architecture boundaries

VEYRA preserves entity-owned truth (A02), shared gameplay operations behind
domain/application boundaries (A05), command distinct from capability (A06),
the Device/Firmware/Software/Session separation (A07), concrete mechanics before
generic frameworks (A16), Device-owned filesystem truth (A17), and the
Wallet/currency/Device/wallet-software separation (A18).

In particular:

```text
COMPANY IDENTITY  != GAMESTATE OWNER
BRAND             != DEVICE
COMPANY           != FIRMWARE
FIRMWARE FAMILY   != FIRMWARE RELEASE
FIRMWARE          != SOFTWARE
FIRMWARE          != HARDWARE
FIRMWARE          != RUNTIME
FIRMWARE          != FILESYSTEM
FIRMWARE          != ACCOUNT
COMPANY           != FINANCIAL PROVIDER
COMPANY           != CURRENCY
```

A Company identity may explain product decisions. It does not automatically own
any Device, account, Wallet, Process, file, Session, software product, or other
ecosystem state. A VEYRA interface observes or requests operations through the
same canonical boundaries as any other interface; its controls neither prove
capability nor own gameplay operations.

No generic Company, Firmware, Device-model, privilege, or consumer-interface
framework follows from this first concrete identity.


## 16. Civic Dollar boundary

A future VEYRA Finance application may present Civic Dollar. Civic Dollar still
owns its Provider, Accounts, Credentials, Financial Sessions, and Transactions.
VEYRA OS would own only its client presentation over shared operations that the
represented authority permits.

```text
NODE-OS CIVIC PRESENTATION != FUTURE VEYRA CIVIC PRESENTATION
UNDERLYING FINANCIAL TRUTH  = THE SAME CANONICAL DOMAIN
```

Do not duplicate Dollar state for VEYRA. No new provider or “VEYRA Pay” product
is selected.


## 17. First ordinary phone implications

The first ordinary NPC phone should prove:

> I am operating somebody else's personal digital environment.

It should feel recognizably like a real personal phone, not another technical
machine console, and should immediately contrast with the player's NODE-OS
environment.

Conceptually:

```text
PLAYER NODE-OS (personal technical environment)
        ↓
DEVICE ACCESS
        ↓
REMOTE SESSION
        ↓
FOREIGN VEYRA DEVICE (ordinary personal consumer environment)
```

The active foreign surface must not replace `player.localDevice`. This target
does not select a concrete NPC, owner model, Device model, Firmware release,
wallpaper, content, apps, or screen design.


## 18. Future privilege direction

Ordinary VEYRA presentation may eventually expose less Device truth than some
concrete elevated authority could access. Any difference in observation or
control must derive from represented authority and mechanics.

Do not encode this idea as `ROOT MODE`, `isRoot`, `adminMode`, `secretApps`,
`developerMode`, or an equivalent shortcut. No privilege behavior is current or
selected by this contract.


## 19. Explicitly unresolved decisions

The following remain unresolved until concrete future work needs them:

- any One, Air, or Pro model lineup, Device model, or physical specification;
- any VEYRA OS version, release history, or compatibility;
- battery values or mechanics, active-app counts, storage values, capacity, or
  admission mechanics;
- update cadence or behavior, privilege escalation, vulnerabilities, patches,
  or exploits;
- App Store mechanics, signing, review, permissions, sandboxing, or restricted
  APIs;
- exact palette, icons, Home composition, motion, haptic patterns, and visual
  assets;
- exact market share, corporate history, pricing, or product ownership
  relationships;
- the first phone's apps, content, owner, wallpaper, and NPC identity.


## 20. Design review test

1. Does the product reduce visible mechanism in favor of human meaning?
2. Could the screen be mistaken for NODE-OS with different styling? If yes,
   reject it.
3. Is hidden machine truth still preserved in the underlying simulation?
4. Is the UI showing only represented facts?
5. Has VEYRA presentation accidentally become gameplay authority?
6. Is an ordinary user being asked to understand something VEYRA would
   abstract?
7. Does a security or product restriction come from represented mechanics
   rather than company lore?
8. Are Provider, Account, Device, Firmware, and Software boundaries intact?
9. Does the product feel like a finished consumer object rather than a
   technical toolkit?
10. Would the interface still be recognizably VEYRA without the logo?

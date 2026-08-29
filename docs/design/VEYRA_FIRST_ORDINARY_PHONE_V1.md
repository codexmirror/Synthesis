# VEYRA First Ordinary Phone V1

Status: Accepted
Scope: Design authority for the first ordinary VEYRA personal-phone product structure, Personal Domains, Home behavior, navigation grammar, and the representative Communication, Money, and Settings surfaces.

This document defines selected future product and presentation behavior. It does not define current implemented behavior, create simulation state, select a concrete NPC, or authorize implementation beyond the represented truth and architecture boundaries already owned elsewhere.

Parent design authority:

[`VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md`](VEYRA_COMPANY_PRODUCT_IDENTITY_V1.md)

Normative owners of implemented truth remain the relevant docs/current/ documents and accepted code/tests.

---

## 1. Status, scope, and authority

This document is the design owner for the first ordinary VEYRA phone experience.

It translates the accepted VEYRA company and product philosophy into a concrete first-phone product structure without yet selecting:

* a concrete Device model;
* a VEYRA OS release;
* a specific NPC owner;
* authored personal content;
* visual styling;
* exact screen geometry;
* implementation architecture.

The parent VEYRA identity contract remains authoritative for:

* company identity;
* ecosystem philosophy;
* VEYRA OS family direction;
* the NODE ↔ VEYRA philosophical contrast;
* high-level visual and interaction language.

This contract owns the narrower first-phone decisions around:

* Personal Domains;
* Home organization;
* Domain projection;
* navigation;
* Communication structure;
* Money structure;
* Settings structure;
* cross-domain interaction grammar;
* absence and unavailable-state behavior;
* the first-entry product experience.

If this document conflicts with Architecture or represented current truth, Architecture and current truth remain authoritative.

---

## 2. Product target

The first ordinary VEYRA phone exists to prove:

I am operating somebody else’s personal digital environment.

The player reaches it from a technical NODE context after gaining access to a foreign Device and establishing the represented connection required by the game.

The experiential transition is:

PLAYER NODE-OS
technical, explicit, machine-oriented
        ↓
represented access
        ↓
foreign operating surface
        ↓
VEYRA personal environment
human, quiet, meaning-oriented

The player should immediately understand:

* this is not another server;
* this is not another hacker interface;
* this is an ordinary personal Device;
* somebody uses it;
* VEYRA organizes technology differently from NODE.

The player’s instinctive question should become:

What is in this person’s phone?

not:

Where are the system tools?

The first VEYRA phone should reward access with exploration, not with an automatic list of discovered secrets.

ACCESS
    ↓
PERSONAL ENVIRONMENT BECOMES AVAILABLE
    ↓
PLAYER EXPLORES

Not:

ACCESS
    ↓
SYSTEM SUMMARIZES IMPORTANT INFORMATION

---

## 3. Core product model

VEYRA organizes the first phone around Personal Domains.

The user’s mental model is:

PERSON
  ↓
PERSONAL DOMAINS
  ↓
CONTENT / ACTIONS
  ↓
underlying products, providers and canonical truth

VEYRA therefore does not primarily organize Home around:

* hardware;
* Processes;
* Services;
* Filesystems;
* installed software inventory;
* provider boundaries;
* technical system structure.

Nor does V1 organize Home primarily around dynamically selected recent activity.

Instead, VEYRA presents stable human-purpose areas such as:

* Communication;
* Money;
* Settings.

Documents remains a valid broader VEYRA product direction but is not required by this first representative phone slice.

---

## 4. Personal Domains are presentation, not simulation ownership

A Personal Domain is:

a VEYRA-owned presentation taxonomy and interaction projection over already represented truth.

A Personal Domain is not a canonical simulation entity.

VEYRA Firmware may own the presentation concept:

Communication
Money
Settings

It does not thereby own the underlying truth represented within them.

For example:

COMMUNICATION DOMAIN
    ≠ communication-account owner
    ≠ message owner
    ≠ provider
    ≠ Device
MONEY DOMAIN
    ≠ financial Provider
    ≠ Account
    ≠ Credential
    ≠ Financial Session
    ≠ Transaction owner
SETTINGS DOMAIN
    ≠ Device
    ≠ Firmware
    ≠ Software
    ≠ Network
    ≠ Runtime

The architecture remains:

CANONICAL REPRESENTED TRUTH
            ↓
    VEYRA PRESENTATION
            ↓
     HUMAN INTERPRETATION

Not:

VEYRA DOMAIN
     ↓
owns duplicate domain state

This contract does not justify introducing generic state such as:

personalDomains[]
hasMoneyDomain
showCommunication
domainState

merely to represent presentation structure.

Concrete mechanics and canonical owners remain authoritative.

---

## 5. Domain presence is derived

A Domain appears only when the concrete Device has a represented basis for that Domain.

Possible bases include:

* represented content;
* installed represented software;
* a represented provider or Account relationship;
* represented capability;
* represented Device functionality;
* another concrete canonical fact that makes the Domain meaningful.

Domain presence should normally be derived from those facts.

Do not store redundant presentation truth solely to say:

SHOW MONEY = true
SHOW COMMUNICATION = true

when those facts can be derived from canonical state.

Domain exists but is empty

A Domain may legitimately exist while containing no content.

Example:

represented communication capability/account
+
zero represented conversations
=
Communication exists, but is empty

Domain has no represented basis

If there is no represented reason for a Domain to exist, the Domain is absent.

Do not create reserved empty Home slots such as:

Communication
No app installed
Money
No account
Photos
Coming soon

merely because VEYRA conceptually supports those categories.

Absence and emptiness are different states.

---

## 6. Home

VEYRA Home is a personal index.

It is not:

* a desktop;
* an app drawer;
* a generic smartphone launcher;
* a dashboard;
* a widget board;
* a notification center;
* a recent-activity feed;
* a system monitor.

Home answers:

Which meaningful parts of this person’s digital life are available here?

6.1 Home information hierarchy

The first ordinary phone uses this conceptual priority:

HUMAN RELATIONSHIP
        >
PERSONAL SERVICE / VALUE
        >
DEVICE MANAGEMENT

Therefore the representative first-phone Home hierarchy is:

Communication
    ↓
Money
    ↓
Settings

Communication is intentionally dominant because the first phone must first read as somebody’s personal Device, not merely a consumer utility appliance.

Money is secondary.

Settings is available but deliberately quiet.

The Device should normally function without demanding that the user manage the Device itself.

---

## 7. Domain projections on Home

Home may contain small deterministic Domain projections.

These are windows into represented Domain truth.

They are not:

* recommendations;
* algorithmic relevance;
* automatic summaries;
* notification systems;
* activity ranking;
* inferred importance;
* invented recency.

A Domain projection may expose a small amount of represented root-level context where doing so strengthens the human meaning of Home.

For example, Communication may expose a small number of actually represented correspondents.

Conceptually:

COMMUNICATION
Person A
Person B

The projection must not invent unsupported metadata such as:

18:42
last active
recent
2 new
priority
recommended

unless the underlying simulation actually represents that truth.

V1 projection navigation

Home projections are not Deep Links in V1.

A Home Communication projection still enters:

HOME
    ↓
COMMUNICATION ROOT
    ↓
CONVERSATION

not:

HOME
    ↓
CONVERSATION DETAIL

This preserves one predictable grammar for the first phone.

---

## 8. What Home does not show

Home does not foreground:

* CPU;
* RAM;
* Process counts;
* runtime telemetry;
* IP addresses;
* ports;
* Services;
* transfer capacity;
* Firmware version;
* stable Device IDs;
* technical network values;
* Remote Session state;
* access authority;
* exploit state;
* privilege;
* target identity;
* technical security state;
* storage meters;
* update state;
* Battery state;
* notifications;
* global activity;
* weather;
* recommendations.

These are not universally prohibited future concepts.

They are simply not selected by this contract and must not be invented because they are familiar smartphone conventions.

Home also does not require:

* a large VEYRA logo;
* a permanent VEYRA OS label;
* corporate branding as dominant content.

VEYRA should be identifiable through product behavior and hierarchy rather than persistent branding.

---

## 9. Domain-root grammar

Domains do not share one universal screen template.

They do share one information grammar:

DOMAIN IDENTITY
      ↓
PRIMARY HUMAN-MEANINGFUL SUBJECT
      ↓
CURRENT MEANINGFUL STATE / CONTENT
      ↓
RELEVANT ACTIONS
      ↓
SUPPORTING CONTEXT
      ↓
TECHNICAL MECHANISM WHEN ACTUALLY NEEDED

This grammar means different things in different Domains.

Communication

Communication
    ↓
people / conversations
    ↓
messages
    ↓
reply where represented

Money

Money
    ↓
balance / financial relationship
    ↓
activity
    ↓
send / receive
    ↓
account detail

Settings

Settings
    ↓
human Device topics
    ↓
selected canonical Device / Firmware / Software truth
    ↓
represented controls

The screens should therefore feel related without becoming identical containers populated with different data.

---

## 10. Communication

Communication is the strongest first-phone proof that the Device belongs to a person.

Its root prioritizes:

PEOPLE
    ↓
CONVERSATIONS
    ↓
CONTENT

not:

PROVIDER
    ↓
MAILBOX
    ↓
TECHNICAL MESSAGE STRUCTURE

and not:

Communication
    ↓
App A
App B
App C

10.1 Communication root

Conceptually:

COMMUNICATION
Person A
conversation subject/context
Person B
conversation subject/context
Person C
conversation subject/context

The primary identity of an entry is the represented correspondent or human subject.

Secondary information may include represented facts such as:

* thread subject;
* truthful preview content;
* read/unread state when represented.

Do not automatically expose:

* provider;
* Account identifiers;
* internal addresses;
* protocol;
* internal message IDs;
* transport;
* timestamps when communication time is not represented.

10.2 Conversation detail

Navigation:

Communication
    ↓
Conversation

The conversation detail prioritizes:

PERSON / CONVERSATION SUBJECT
            ↓
represented message history
            ↓
represented action

Do not label content as:

* secret;
* private target information;
* hacking reward;
* discovered intelligence.

The player should infer the significance of what they are seeing.

10.3 Reply

A reply affordance exists only when the underlying represented mechanics actually support replying from that context.

Do not add a decorative composer merely because messaging products normally contain one.

REPLY CAPABILITY EXISTS
        ↓
SHOW REPLY ACTION

Not:

COMMUNICATION SCREEN EXISTS
        ↓
ASSUME REPLY

10.4 Provider identity

Provider or software identity may appear where it becomes meaningful to orientation or action.

Possible future locations include:

* communication settings;
* source/account details;
* situations where multiple represented communication products must be distinguished.

Provider identity does not dominate normal conversation presentation.

---

## 11. Foreign communication truth boundary

Current player mail truth must not be silently reused as foreign-NPC communication truth.

The first VEYRA phone requires represented communication truth appropriate to the foreign Device / owner relationship before the Communication surface can present it.

Do not implement the first phone by simply retargeting the player’s existing mail state or NodeMail presentation.

PLAYER MAIL TRUTH
    ≠
FOREIGN PHONE COMMUNICATION TRUTH

The exact future canonical owner and representation of foreign personal communication is intentionally unresolved by this design contract.

It must be selected through concrete architecture/product work before implementation depends on it.

---

## 12. Money

The selected working Domain label is:

Money

This is preferred over Finance for the first product structure because it expresses the ordinary user’s purpose rather than a software/product category.

The exact visible wording may still be reviewed during later language and visual design.

12.1 Money root

The first thing the user should understand is:

What value is available here, and what has happened to it?

The root hierarchy is conceptually:

MONEY
Balance
Provider identity — secondary
Send
Receive
Activity
Account

The provider remains real and visible where meaningful.

It does not become the primary hierarchy.

For example:

$1,250.00
Civic Dollar

is more VEYRA-consistent than:

CIVIC DOLLAR PROVIDER
ACCOUNT
AUTHORIZED SESSION
BALANCE

12.2 Balance

Balance is the primary meaningful financial state when the represented financial relationship allows it to be observed.

VEYRA does not create its own balance.

It derives presentation from canonical financial truth.

12.3 Provider

Provider identity is secondary but not hidden when meaningful.

VEYRA does not own Civic Dollar.

VEYRA MONEY
    =
presentation of represented financial relationships

not:

VEYRA MONEY
    =
new VEYRA financial provider

12.4 Activity

Activity contains only represented canonical Transactions or equivalent financial history.

VEYRA may change human-facing wording and composition.

It may not invent:

* timestamps;
* merchants;
* fees;
* pending state;
* settlement phases;
* transfer speed;
* memo fields;
* categories;
* status values;

unless those concepts become represented truth.

12.5 Send

Conceptually:

Send
    ↓
amount
    ↓
recipient
    ↓
review
    ↓
confirm

Only represented financial mechanics may back these actions.

12.6 Receive

Receive exposes the real information required for another represented sender to send value to this Account.

This may include:

* Account reference;
* copy action;
* Provider identity.

Do not invent QR codes, payment requests, aliases, contact lookup, or equivalent conveniences unless supported by represented mechanics.

12.7 Account detail

Technical or identification information that is useful but not primary may live under Account.

Possible represented examples:

* Provider;
* Account reference;
* supported Account-facing controls.

Do not expose ordinary-user UI for:

* internal stable Account ID;
* Credential ID;
* Financial Session ID;
* Credential material;
* internal authority implementation.

The normal availability of an Account through the interface is sufficient consumer-level evidence that the represented authority permits the interaction.

---

## 13. Settings

Settings proves how VEYRA interprets the Device itself.

NODE may foreground machine structure.

VEYRA should foreground only Device concepts that are meaningful to an ordinary owner.

The first Settings root uses these working categories:

SETTINGS
This Device
Connection
Apps & Software

The exact labels remain subject to later product-language refinement.

---

## 14. This Device

This Device may expose selected represented identity information such as:

* Device display name;
* VEYRA OS identity;
* represented Firmware version where useful.

The Device’s canonical stable identity remains hidden from ordinary presentation unless a future concrete mechanic gives the user a meaningful reason to see it.

Firmware identity is therefore accessible without becoming persistent Home or system chrome.

---

## 15. Connection

Connection presents represented Device/network state from the ordinary owner-facing Device perspective.

Examples may include human-readable states such as:

Connected

or:

Unavailable

only where those statements are truthfully derivable from canonical state.

Connection does not normally foreground:

* IP address;
* ports;
* interface implementation;
* transfer capacity;
* routing;
* Remote Session identifiers;
* hacker access state.

Critical boundary: Connection ≠ Remote Session

The player’s external access path to the foreign Device is separate from the Device’s owner-facing connectivity.

NODE
    ↓
RemoteSession
    ↓
foreign Device

is not the same thing as:

foreign Device
    ↓
its represented network/connectivity state

VEYRA must not display Connected merely because the player currently has a Remote Session to the Device.

Likewise, VEYRA Home or Settings must not expose the hacker’s:

* Remote Session;
* target IP;
* DeviceAccess;
* privilege;
* exploit path;

as ordinary owner-facing VEYRA state.

---

## 16. Apps & Software

Personal Domains do not deny the existence of software.

Settings is the natural first-phone place where software may be presented explicitly as software.

Conceptually:

Apps & Software
Product A
Product B
Product C

A represented product detail may expose facts such as:

* product name;
* version where meaningful;
* publisher where represented and meaningful;
* actual available management actions.

Do not invent:

* software categories;
* usage statistics;
* permissions;
* update status;
* storage use;
* trust scores;

unless represented truth exists.

This preserves the distinction:

HOME
    = human-purpose organization
SETTINGS / APPS & SOFTWARE
    = explicit software inventory where useful

---

## 17. Settings does not manufacture consumer telemetry

The first Settings contract does not select:

* Battery Health;
* Battery percentage;
* storage graphs;
* privacy dashboards;
* security scores;
* diagnostics;
* temperature;
* performance metrics;
* account sync;
* cloud backup;
* permissions;
* update status;
* automatic maintenance state.

These concepts may only appear later if the simulation actually represents them and a future product decision selects their presentation.

Familiarity from real consumer devices is not sufficient justification.

---

## 18. Error and technical-problem presentation

VEYRA should communicate problems from the human task perspective.

Where NODE may expose detailed machine cause, VEYRA normally begins with meaningful impact.

Example:

Can’t continue.

If the interface legitimately knows a represented cause that is useful to the user:

Not enough memory to continue.

may be valid.

If the interface does not know the cause:

do not infer one.

VEYRA may simplify represented truth.

It may not invent explanatory truth.

---

## 19. Back

Back means:

move one level upward inside the current Domain hierarchy.

Examples:

Communication
    ↓
Conversation
Back
    ↓
Communication
Money
    ↓
Account
Back
    ↓
Money
Settings
    ↓
Connection
Back
    ↓
Settings

Back is not:

* global browser history;
* cross-Domain history;
* return to NODE;
* leave Remote Session;
* operating-context switching.

A Domain root has no internal Back destination.

Therefore no Back control is required there.

---

## 20. Home action

VEYRA has one consistent OS-level Home action.

Home means:

return to the VEYRA personal index.

Examples:

Conversation
    ↓ HOME
VEYRA Home
Account
    ↓ HOME
VEYRA Home
Settings detail
    ↓ HOME
VEYRA Home

Home ignores current Domain depth.

The exact visual form of the Home affordance remains unresolved.

Its behavior does not.

---

## 21. Home is not return-to-NODE

The surrounding Synthesis Shell may provide a separate way for the player to leave the foreign operating surface and return to their local NODE environment.

That operation belongs outside VEYRA’s ordinary owner-facing navigation semantics.

VEYRA HOME
    ≠
RETURN TO NODE

The VEYRA Home control must never unexpectedly mean:

leave the hacked Device.

These are different product and architecture layers.

Conceptually:

SYNTHESIS OPERATING CONTEXT
├── local NODE
└── foreign VEYRA
       ├── VEYRA Home
       ├── Communication
       ├── Money
       └── Settings

VEYRA owns only its internal presentation and navigation.

The Shell owns the broader operating-context transition.

---

## 22. V1 system navigation

The selected first-phone navigation grammar contains only two VEYRA-internal navigation operations:

BACK
= one level upward inside current Domain
HOME
= return to VEYRA personal index

V1 does not require:

* multitasking;
* recent applications;
* app switcher;
* global navigation history;
* tabs between Personal Domains;
* gesture-only navigation;
* cross-Domain Back behavior.

The design goal is immediate predictability.

---

## 23. Domain versus application

This distinction is normative.

A Personal Domain is not an application with a different label.

Application-oriented model

HOME
    ↓
installed product
    ↓
product-defined hierarchy

VEYRA Personal Domain model

HOME
    ↓
human-purpose Domain
    ↓
meaningful content / state / action
    ↓
products and Providers appear where relevant

The differences are:

Application-oriented organization	VEYRA Personal Domain organization
Home foregrounds installed products	Home foregrounds human-purpose areas
Tap launches a product	Tap enters an OS-owned semantic Domain
Product defines the primary hierarchy	Human meaning defines the primary hierarchy
Product/provider identity is primary	Person/content/state is usually primary
One product commonly maps to one Home destination	Multiple represented products may eventually contribute to one Domain
Product changes may change Home taxonomy	Domain meaning can remain stable across provider/product changes
Content is understood as living inside an app	Content is interpreted through the relevant human Domain

Examples:

Civic Dollar
    ≠
Money

Civic Dollar is a represented financial Provider/product relationship.

Money is VEYRA’s human-facing interpretation of represented financial truth.

Likewise:

communication software
    ≠
Communication

Communication is the human-purpose Domain.

No generic aggregation framework follows

The model is semantically capable of supporting multiple products or providers in a Domain.

V1 does not require implementing such aggregation.

A valid first version may simply be:

Money
    ↓
one represented Civic Dollar relationship

Do not create a generalized Personal Domain framework merely because future aggregation is conceptually possible.

Concrete mechanics come first.

---

## 24. Cross-domain consistency

The first phone uses a small number of strong consistency rules.

Rule 1 — Root names the human Domain

Examples:

Communication
Money
Settings

not provider/product/version identities.

Rule 2 — Detail names the meaningful subject

Examples:

Communication detail
→ Person / Conversation
Money detail
→ Send / Receive / Account
Settings detail
→ This Device / Connection / Software product

Rule 3 — Meaning precedes mechanism

Examples:

Person
before communication address
Balance
before Account reference
Connection state
before IP
Product name
before implementation identity

Rule 4 — Actions live near their subject

Examples:

Reply
belongs to Conversation
Send
belongs to Money
Software management
belongs to selected software

VEYRA does not require a global toolbar containing every theoretical capability.

Rule 5 — Provider identity is contextual

Provider/product identity should not be hidden when meaningful.

It should also not dominate every surface.

Rule 6 — Back and Home never change meaning

Back always moves upward within the current Domain.

Home always returns to the VEYRA personal index.

Rule 7 — normal operation is quiet

Do not add reassuring but unsupported status decoration such as:

* ONLINE;
* SECURE;
* SYNCED;
* READY;
* AUTHORIZED;
* HEALTHY.

Rule 8 — absence is preferable to filler

VEYRA may contain whitespace and genuinely empty areas.

Do not manufacture content to make screens feel populated.

---

## 25. Empty, missing, and unavailable states

VEYRA must distinguish different forms of absence.

A. Domain exists, content is empty

Example:

A represented communication relationship exists but contains no conversations.

Valid presentation:

Communication
No conversations yet.

No fake examples are added.

B. Domain has no represented basis

The Domain is absent from Home.

No disabled placeholder is required.

C. Financial relationship exists but currently requires represented authentication

Money may exist if a concrete represented path to the relationship exists.

A truthful surface might present:

Civic Dollar
Sign in

only if the underlying financial model actually supports that state and operation.

Do not show balance or activity before represented authority permits it.

D. No financial product / Account / usable represented path exists

Money is absent.

E. Connectivity unavailable

The affected operation should present the meaningful effect:

No connection.

Settings → Connection may present the same underlying canonical state in owner-facing form.

Do not invent a deeper cause such as:

Router unavailable.

unless that cause is represented and observable.

F. Content inaccessible

Valid generic presentation:

Unavailable.

A more specific explanation appears only when represented truth supports it.

G. Action temporarily impossible

If capability is absent, the action may be omitted.

If the operation can only determine failure when attempted, VEYRA may present the resulting failure.

Do not introduce UI flags that become gameplay authority.

---

## 26. First-entry structural walkthrough

The first VEYRA encounter should teach itself through normal interaction.

0–5 seconds — context break

The player arrives from NODE.

The previous context may have involved concepts such as:

SCAN
HACK
CONNECT

The VEYRA surface itself does not foreground:

* target IP;
* DeviceAccess;
* Remote Session;
* privilege;
* CPU;
* RAM;
* Terminal;
* exploit state.

Instead the player sees a small personal index.

Communication is the strongest area.

Learned rule:

This is a different kind of computer.

5–12 seconds — personal evidence

Where represented, Communication projects a small number of real human identities onto Home.

Messages themselves do not need to appear there.

Money and Settings remain secondary.

Learned rule:

This Device is organized around somebody’s life, not machine structure.

12–20 seconds — enter Communication

Tap:

Home
    ↓
Communication

Home disappears.

Communication becomes the current workspace.

The player sees represented people/conversations.

Learned rule:

Selecting a Domain enters a full human-purpose space.

20–35 seconds — open conversation

Tap:

Communication
    ↓
Conversation

The human subject and represented messages become primary.

No tutorial or secret marker is required.

Learned rule:

This environment contains somebody’s actual represented personal context.

35–42 seconds — Back

Back returns:

Conversation
    ↓
Communication

not Home.

Learned rule:

Back moves within the current Domain.

42–48 seconds — Home

Home returns:

Communication
    ↓
VEYRA Home

Learned rule:

Home leaves the current Domain and returns to the personal index.

48–60 seconds — Money

Tap:

Home
    ↓
Money

The root prioritizes:

balance
provider
actions
activity

rather than financial implementation structure.

Learned rule:

VEYRA consistently interprets represented truth through human meaning.

Within the first minute, Communication and Money prove that very different canonical Domains can share one coherent VEYRA product grammar.

---

## 27. First-phone structural tree

This tree describes navigation only.

It is not a visual layout specification.

VEYRA HOME
│
├── Communication
│   ├── Conversation A
│   ├── Conversation B
│   └── ...
│
├── Money
│   ├── Send
│   ├── Receive
│   ├── Account
│   └── Activity lives on root
│
└── Settings
    ├── This Device
    │   └── VEYRA OS / represented software identity
    ├── Connection
    └── Apps & Software
        └── Product detail

The deeper semantic model is:

                    HOME
                      │
          ┌───────────┼───────────┐
          │           │           │
 COMMUNICATION      MONEY      SETTINGS
          │           │           │
        PEOPLE      VALUE       DEVICE
          │        ACTIVITY      TOPICS
    CONVERSATIONS   ACTIONS        │
          │           │        CANONICAL
       CONTENT     ACCOUNT      DEVICE TRUTH
          │           │           │
          └───────────┴───────────┘
                      │
               MEANING OVER
                 MECHANISM

---

## 28. Representative V1 surface set

The smallest product set selected by this contract is:

1. Home
2. Communication
3. Money
4. Settings

Each exists for a different reason.

Home

Proves:

* Personal Domains;
* Domain projection;
* information restraint;
* non-app-launcher organization;
* personal-first hierarchy.

Communication

Proves:

* people-first hierarchy;
* personal ownership;
* content-first navigation;
* foreign personal context.

Money

Proves:

* shared canonical truth can support radically different Firmware presentation;
* Provider identity can remain real without dominating hierarchy;
* actions can be presented through human purpose rather than implementation.

Settings

Proves:

* VEYRA can interpret the same Device truth differently from NODE;
* technical truth can remain accessible selectively without becoming Home structure;
* software remains real even though apps do not define Home.

No additional placeholder surfaces are required for V1.

---

## 29. Explicit non-goals

This contract does not select:

* concrete VEYRA phone model;
* hardware specifications;
* VEYRA OS version;
* concrete Firmware release;
* concrete NPC owner;
* owner identity model;
* personal biography;
* authored messages;
* authored financial history;
* wallpaper;
* lock screen;
* Photos;
* Camera;
* Browser;
* Contacts;
* Notes;
* App Store;
* notification system;
* multitasking;
* recents;
* recommendations;
* dynamic Home activity ranking;
* permissions;
* sandboxing;
* signing;
* software review;
* update mechanics;
* privilege presentation;
* root/elevated mode;
* Battery mechanics;
* storage mechanics;
* exact Shell integration;
* implementation types;
* generic Personal Domain framework.

---

## 30. Visual-design decisions intentionally unresolved

The product structure is selected.

The following remain for the visual exploration pass:

* exact Home geometry;
* vertical composition;
* exact visual weight of Communication versus Money;
* whether Home visibly says Home;
* visual representation of Domain projections;
* whitespace and section separation;
* final visible Domain labels;
* exact Back affordance;
* exact Home affordance;
* header geometry;
* typography;
* palette;
* iconography;
* depth;
* rounding;
* spacing;
* motion;
* Home → Domain transition;
* VEYRA brand presence outside normal use;
* exact empty-state wording;
* provider/account typographic treatment;
* exact number of visible Communication identities;
* responsive composition in the Synthesis viewport.

These decisions may change how the selected structure looks.

They must not silently reopen the structural product decisions frozen here.

---

## 31. Frozen structural decisions

The following are selected by this contract:

HOME
= personal index
PERSONAL DOMAINS
= VEYRA presentation taxonomy over represented truth
DOMAIN PRESENCE
= derived from represented basis, not redundant presentation flags
DOMAINS
≠ applications
COMMUNICATION
= people / conversations before provider and mechanism
MONEY
= balance / activity / actions before financial implementation structure
SETTINGS
= human Device topics before technical machine structure
BACK
= one level upward within current Domain
HOME ACTION
= return to VEYRA personal index
VEYRA HOME
≠ return to NODE
PROVIDER / PRODUCT IDENTITY
= secondary or contextual where meaningful
NORMAL OPERATION
= quiet
UNREPRESENTED TRUTH
= absent, not fabricated
FIRMWARE
= presentation and interaction layer, not owner of duplicated canonical truth

---

## 32. Architecture boundaries

This contract preserves the established Synthesis boundaries.

In particular:

DEVICE
≠ FIRMWARE
≠ SOFTWARE
≠ FILESYSTEM
≠ ACCOUNT
≠ SESSION
≠ PLAYER
PERSONAL DOMAIN
≠ GAMESTATE OWNER
COMMUNICATION DOMAIN
≠ MAIL / MESSAGE AUTHORITY
MONEY DOMAIN
≠ PROVIDER
≠ ACCOUNT
≠ CREDENTIAL
≠ FINANCIAL SESSION
SETTINGS
≠ DEVICE TRUTH OWNER
REMOTE SESSION
≠ VEYRA CONNECTION STATE
VEYRA HOME
≠ SYNTHESIS OPERATING-CONTEXT SWITCH

A VEYRA surface observes represented truth and requests represented operations through existing canonical boundaries.

Presentation neither proves capability nor creates authority.

---

## 33. Implementation readiness

```text
PRODUCT STRUCTURE
= accepted

VISUAL LANGUAGE / CONCRETE SCREEN COMPOSITION
= intentionally unresolved; owned by the next visual exploration pass

FULL FIRST-PHONE IMPLEMENTATION
= not ready until the concrete prerequisites below are resolved
```

These prerequisites are boundaries for later concrete work, not decisions made
by this contract:

### A. Foreign communication truth

Current `GameState.mail` is the player's mailbox. The first VEYRA phone must
not reuse or retarget it as foreign-NPC truth. Before Communication
implementation depends on foreign-phone communication, concrete work must
select its canonical representation and ownership model. This contract does
not choose that model.

### B. Foreign Firmware operating-surface selection

Current Remote Session architecture already resolves the target Device and
Firmware, and `RemoteSessionHandoff` is Firmware-aware in presentation.
`Shell.tsx`, however, mounts RACK-OS as the only entered remote operating
surface. The first VEYRA implementation therefore requires concrete
Firmware-driven foreign-surface selection at the Shell/presentation boundary.
This contract neither designs nor implements that routing, and it does not
imply a generic plugin or framework system.

### C. Concrete first-phone representation

Concrete work has not yet selected a Device instance, an installed VEYRA OS
release, owner or personal content, a represented communication basis, or a
represented financial relationship. A later implementation slice must select
only the concrete state the first phone needs; this contract creates none of
it.

### D. Money boundary

The existing Dollar core is already Device-scoped: Account authority resolves
through a Financial Session and its client Device. VEYRA must reuse those
canonical Dollar operations and must not create VEYRA-owned balance, Account,
Provider, Session, Transaction, or transfer state. A later application boundary
may require a foreign-Device adapter; this contract does not implement one.

### E. Representative Domain basis

The accepted representative V1 surface set is Home, Communication, Money, and
Settings. For one concrete reference phone to realize all four, represented
world state must provide a truthful basis for Communication, Money, and
Settings. Presence must derive from those concrete facts, never from
`showCommunication`, `showMoney`, `personalDomains[]`, or equivalent
presentation flags.

---

## 34. Design review test

Future VEYRA first-phone work should be rejected or reconsidered if it fails these questions:

1. Is Home still a personal index rather than a disguised app launcher?
2. Does each visible Domain have a represented basis?
3. Is Domain presence derived rather than redundantly stored?
4. Is a Personal Domain being mistaken for a canonical gameplay entity?
5. Does Communication foreground people/content rather than provider machinery?
6. Does Money preserve Provider/Account/Session authority boundaries?
7. Does Settings expose only represented Device/Firmware/Software truth?
8. Has the UI invented Battery, storage, security, activity, time, connectivity, or other plausible consumer state?
9. Is the player’s Remote Session accidentally leaking into ordinary VEYRA owner-facing presentation?
10. Does Back mean only upward navigation inside the current Domain?
11. Does Home mean only return to the VEYRA personal index?
12. Is return-to-NODE kept outside normal VEYRA Home semantics?
13. Are actions backed by actual represented capability rather than UI assumptions?
14. Could the interface still be structurally distinguished from a normal app grid if all colors, icons, branding, and styling were removed?
15. Does the result still satisfy the parent VEYRA principle:

Meaning over mechanism.

If the answer to question 14 is no, the product structure has regressed.

---

## 35. Next design step

With this contract accepted, the next VEYRA design task is visual exploration.

The visual pass should interpret the frozen structure rather than redefine it.

Its purpose is to discover a visual language and concrete screen composition that makes:

Home
Communication
Money
Settings

feel like one mature VEYRA product while remaining clearly distinct from both NODE and a generic contemporary smartphone launcher.

A selected visual direction may later become its own reference or presentation authority before implementation begins.

# Confirmed future directions

Status: Accepted
Scope: Confirmed long-term product and simulation direction. Direction only —
never current truth and never implementation authority.

This document records long-term product and simulation directions for Synthesis.

It is intentionally allowed to think far beyond the current implementation.

It is not:

- current product truth
- an implementation contract
- a roadmap with guaranteed ordering
- a promise that every example will exist
- authority to implement a feature merely because it is described here

Use:

- `docs/README.md` to route a task to its smallest sufficient Read Set
- `docs/current/...` for detailed current implemented truth
- `docs/V0.md` for the non-exhaustive current product snapshot
- `docs/ARCHITECTURE.md` for durable architecture constraints
- `docs/work-orders/...` for explicitly selected implementation work

Examples and working product names in this document are exploratory unless
explicitly stated otherwise.


## North star

Synthesis should grow into a systemic simulated digital world rather than a
fixed sequence of hacking puzzles.

Hacking is the player’s language for observing, understanding, navigating, and
changing that world.

The long-term direction is:

```text
WORLD TRUTH
    ↓
PLAYER OR AUTONOMOUS ACTION
    ↓
STATE MUTATION
    ↓
CROSS-SYSTEM CONSEQUENCES
    ↓
OBSERVATION
    ↓
INFORMATION
    ↓
PLAYER DECISION
    ↓
FURTHER STATE MUTATION
```

Interesting outcomes should increasingly emerge from interactions among
independently useful systems rather than bespoke scripted event chains.

The goal is not simply more:

- commands
- missions
- targets
- exploits
- applications
- content

The goal is a world in which existing systems combine to create new situations.


## Multiple approaches instead of one hacking pipeline

No universal sequence such as:

```text
SCAN
→ ANALYZE
→ ATTACK
→ ACCESS
```

should become the required solution to every target.

Different situations may eventually be approached through combinations of:

- observation
- service weaknesses
- credentials
- keys
- trusted relationships
- existing access
- filesystem discoveries
- configuration
- software
- malware
- reachability
- another controlled Device
- routing or network position
- social or intelligence information
- future concrete mechanics

A successful first access should create a foothold, not complete the target.

A foothold becomes interesting when it changes:

- where the player can operate
- what the player can observe
- what is reachable
- which tools are useful
- which information becomes meaningful
- which further decisions become possible


## Observation, Discovery, and Knowledge

Observation should increasingly reduce uncertainty rather than operate as a
permission ladder.

The long-term conceptual vocabulary is:

```text
SCAN
What is around this object?
Expand known space and discover relationships.

INSPECT
What is this object?
Obtain targeted current observable evidence.

ANALYZE
What deeper information can be derived from specific evidence?
Potentially consume time and resources.
```

These roles are directional rather than a commitment to today’s exact
observation depth.

SELF and directly available local context should increasingly feel intrinsic
rather than requiring repetitive discovery of facts the player obviously
already owns.

Opening remembered information should remain browsing, not observation.

Known Space may eventually grow from several concrete sources, including:

- intrinsic local context
- Scan
- Inspect
- files
- configuration
- credentials
- active remote operating contexts
- other represented systems

Do not assume every piece of player information must originate from Scan.


### Better observation tools

Tool progression may reduce repetitive probing by increasing the quantity,
quality, speed, or efficiency of observation.

A stronger reconnaissance product might, for example:

- discover more useful relationships
- return shallow fingerprints during a broader Scan
- expose richer current evidence during Inspect
- work faster
- consume different resources
- operate from different positions
- produce different observable consequences

Better observation should improve decision quality rather than arbitrarily
unlock objects that otherwise physically exist.


### Stale and imperfect information

Player information may eventually be:

- incomplete
- historical
- stale
- uncertain
- misleading because the world changed

A player may know an old weakness while the target has already changed.

That uncertainty is gameplay.

Interfaces should represent what the player reasonably knows, not silently
correct stale information using hidden World Truth.


## NODE-OS Home observation

A concrete local Device-owned read-only filesystem now exists, and Files and
Terminal read it as shared canonical state. NODE-OS Home may become a richer
observation surface as real local Device state grows. A future File Monitor
should read selected text files from that same filesystem rather than
maintaining presentation-only copies.

Filesystem mutation, remote filesystems and operating contexts, foreign
Firmware filesystem presentation, credentials and keys discovered in files,
configuration gameplay, logs and other artifacts, and trace removal remain
future mechanics requiring concrete authority and state boundaries.

System and network logs should arise as concrete artifacts of represented
events, not atmospheric UI text. User or Session identity, uptime, traffic,
storage, temperature, and similar information should appear only after the
corresponding simulation state exists.


## Devices and Firmware

Devices and Firmware should become a major part of the identity of the world.

A Device is the simulated machine.

Firmware is the operating environment through which that machine is presented
and controlled.

NODE-OS is intended to become the polished personal Firmware of the player’s
own Device rather than the universal Synthesis interface.

Its identity may grow through:

- consistent interaction
- strong networking workflows
- useful interpretation of represented state
- polished system tools
- efficient navigation
- a recognizable technical visual language

Foreign Devices may run substantially different Firmware.

Examples might include:

- raw legacy server environments
- terminal-oriented systems
- other graphical operating environments
- specialized embedded systems
- community-developed Firmware

Different Firmware should be allowed to differ structurally rather than merely
recolor NODE-OS.

Returning to NODE-OS after operating unfamiliar environments should feel like
returning to the player’s own machine.

### Device models and Firmware families

Long-term, concrete Device instances may belong to represented Device models.

A model can give a machine a recognizable product identity and may eventually
influence:

- default hardware
- supported hardware ranges or upgrade limits
- network capability ranges
- physical or product constraints
- compatible Firmware families
- other concrete represented properties

For example, working product concepts might eventually include:

```text
NODE Standard
NODE Premium
as different Device models while both remain capable of running releases from the NODE-OS Firmware family.
Firmware itself may grow into families and releases:
NODE-OS
├── NODE-OS 1.x
├── experimental releases
├── NODE-OS 2.x
└── later releases
Other Firmware families may target substantially different operating roles, such as specialized financial, cryptocurrency, infrastructure, investigative, or other environments.
These are product directions, not locked models, names, schemas, tiers, or monetization rules.
The important direction is that:
WHO / WHAT DEVICE IS THIS?
        ≠
WHICH FIRMWARE IS INSTALLED?
        ≠
WHAT HARDWARE IS CURRENTLY PRESENT?
A player’s capabilities should continue to emerge from represented Devices, hardware, Firmware, software, information, access, and position rather than a permanent character-class flag.
Ich würde **Monetarisierung hier bewusst noch nicht reinschreiben**. Alternative Starts/Devices können später Monetarisierung berühren, aber das ist noch keine bestätigte Architekturregel.

—

### Unter `## Multiple approaches instead of one hacking pipeline`

Nach dem bestehenden Teil über verschiedene Wege ergänzen:

```md
A useful long-term mental model is:

```text
REACHABILITY
      +
ATTACK SURFACE
      +
CURRENT WEAKNESS
      +
PLAYER INFORMATION
      +
AVAILABLE CAPABILITY
      ↓
ATTEMPT
      ↓
SYSTEMIC EFFECTS
An attack surface might eventually arise from concrete services, Firmware, installed software, configuration, files, trust relationships, credentials, network position, or other represented state.
The weakness and the technique used against it should not be permanently identical.
Different techniques may exploit the same weakness, and one technique may have different consequences depending on the target and current world state.

## Remote operating contexts

Established access and active operation remain distinct. The first concrete,
single active Remote Session lifecycle and compact RACK-OS foreign operating
environment now exist.

Long-term progression may include:

```text
DEVICE ACCESS
      ↓ (implemented CONNECT / Remote Session lifecycle)
FOREIGN OPERATING ENVIRONMENT (first RACK-OS surface implemented)
      ↓
FILES / SYSTEM / TERMINAL / OTHER SURFACES
```

A connected foreign Device should become a real place from which the player can
operate rather than only another detail card.

NODE-OS should remain the player’s local environment while a remote Session
opens a second operating context.

Richer foreign Firmware and operating surfaces, remote Process execution,
multiple simultaneous Sessions, firewall/reachability and pivoting, and
connection artifacts/logging remain future mechanics.

Different form factors may present this differently:

- a contained second surface on larger screens
- a focused full-screen or stacked context on mobile

The presentation may evolve without collapsing local Device identity and remote
operating context.


## Networks, Firewall, and strategic position

Reachability should become a major source of strategic depth.

The same target may be:

- known
- supported by the player’s software
- accessible with valid credentials

and still be unreachable from the player’s current network position.

Conceptually:

```text
KNOWLEDGE      ✓
TOOL           ✓
CREDENTIAL     ✓
REACHABILITY   ✗
```

A foothold on another Device may change that situation.

Example:

```text
INTERNET
    │
    ▼
PUBLIC SERVER
    │
    ▼
INTERNAL DATABASE
```

From the player’s local Device:

```text
DATABASE
UNREACHABLE
```

After gaining and using access to the public server:

```text
PUBLIC SERVER
      ↓
new network position
      ↓
DATABASE
REACHABLE
```

The database did not become unlocked.

The player’s position changed.


### Firewall

Firewall state may become one concrete contributor to reachability.

Keep conceptually separate:

```text
AUTHENTICATION
Who may use this service?

FIREWALL
Which traffic is allowed between represented positions?

REACHABILITY
Can this target currently be communicated with from this position?

FIRMWARE
How is this Device operated and presented?
```

Firewall should not become a generic „security level“.

Initial implementations should prove one concrete network-position interaction
before broader routing or reachability abstractions are considered.


## Software as a progression axis

Player software should become a major progression system rather than a cosmetic
inventory of command unlocks.

The long-term relationship is:

```text
COMMAND / UI VERB
        ↓
GAMEPLAY OPERATION
        ↓
INSTALLED SOFTWARE + OTHER CONDITIONS
        ↓
CAPABILITY
        ↓
WORLD INTERACTION
```

A command is not permanently identical to one software product.

Different products may provide overlapping capabilities with different:

- strengths
- limitations
- resource costs
- speed
- reliability
- exposure
- supported environments
- observation depth
- dependencies

One product may support multiple gameplay verbs.


### Example: reconnaissance software

A possible first recognizable reconnaissance product is:

```text
NodeScan
├── network discovery
├── targeted inspection
└── possible future modules
    ├── service fingerprinting
    ├── banner probing
    ├── broader sweeps
    ├── topology assistance
    ├── passive observation
    └── deeper evidence
```

`NodeScan` is a working product direction, not a permanent rule that `scan` or
`inspect` must always require that specific product.

Other software may later offer overlapping reconnaissance functionality with
different trade-offs.


### Example: offensive software

Analyze and offensive transformations may eventually be supported by distinctive
software products.

A thematic working example is a „Dolphin“-style loader or offensive suite:

```text
OFFENSIVE SOFTWARE
├── analysis capabilities
├── attack / transformation capabilities
└── optional modules
    ├── credential techniques
    ├── service-specific techniques
    ├── payload functionality
    ├── persistence
    ├── privilege-related functionality
    ├── stealth
    └── cleanup
```

The product name and module list are examples, not locked schemas.


## Software modules, versions, and licensing

Device-owned installed software is distinct from filesystem artifacts and
Process state: files describe which artifacts exist, installed software
describes which functionality is installed, and Processes describe work that is
running or retained as completed history. A future software manager may expose
install, update, uninstall, open, or run operations, but remains an interface
over Device-owned truth. A software source, store, or repository is a separate
concern. Future filesystem and software design should not inherently exclude
represented player-created executable or interactive content; no scripting
language or sandbox is selected yet.

Software may eventually have:

- versions
- modules
- optional feature packs
- official licenses
- license keys
- recovered or stolen licenses
- key generators
- cracked releases
- repacks
- modified releases
- different distribution sources
- different provenance

The same capability should not necessarily have one acquisition route.

A player might eventually:

- buy a legitimate license
- discover a usable license key
- obtain a key generator
- install a cracked build
- buy a modified release
- use a competing product

That allows software progression to interact with:

- money
- information
- filesystem discoveries
- Device state
- access
- markets
- trust
- risk


## Underground software and provenance

A future black market may distribute:

- software
- modules
- licenses
- cracks
- key generators
- repacks
- modified packages

Underground software should not merely be:

```text
CHEAPER VERSION
+ RANDOM BAD EFFECT
```

Its provenance becomes interesting when actual simulation systems can express
real consequences.

A modified package might eventually interact with represented:

- files
- Processes
- CPU or RAM use
- network activity
- configuration
- credentials
- Wallet-related state
- access relationships

The player should ideally discover suspicious behavior through the same systems
used elsewhere in Synthesis.

Example:

```text
UNTRUSTED SOFTWARE
        ↓
REAL DEVICE STATE CHANGE
        ↓
FILES / PROCESSES / NETWORK / OTHER STATE
        ↓
OBSERVATION
        ↓
PLAYER REALIZES SOMETHING IS WRONG
```

This is more interesting than an arbitrary „malware detected“ popup.


## Malware and defensive software

Malware may eventually become concrete software operating inside the same
simulation as legitimate software.

Its consequences may include represented:

- execution
- resource consumption
- filesystem changes
- network behavior
- persistence
- credential interaction
- other concrete effects

Security or forensic software may observe or counter those same underlying
conditions.

This creates the possibility of an ecosystem in which offensive, malicious,
defensive, and diagnostic software interact through shared Device and World
state rather than bespoke counters.

## Processes, audit logs, and forensic investigation
Processes should grow into the runtime command center of a Device.
Its central question is:
```text
WHAT IS HAPPENING ON THIS DEVICE RIGHT NOW?

It may eventually present several kinds of real Device activity, including:

* compute work
* file transfers
* software execution
* cracking work
* miners
* services
* malware
* other represented runtime activity

The player-facing Processes application does not require all of those mechanics
to share one canonical runtime type.

Active work should remain distinct from retained completed runtime history.

Completed Process history is primarily operator convenience and may be removed.
It is not intended to become the permanent forensic record of a Device.

Audit logs

A future Device-owned audit/logging system should answer a different question:

WHAT HAPPENED ON THIS DEVICE?

Concrete gameplay operations may eventually create records for events such as:

SESSION OPENED
AUTHENTICATION ATTEMPT
FILE READ
FILE TRANSFER
PROCESS STARTED
PROCESS COMPLETED
SOFTWARE INSTALLED
FILE MODIFIED
SESSION CLOSED

This is illustrative rather than a locked event taxonomy.

Audit history should be bounded rather than infinite.

Different Devices, Firmware, software, or future configuration may eventually
influence retention, but no exact capacity model is selected yet.

Logs should arise from represented gameplay operations and state changes rather
than being fabricated by an interface merely for atmosphere.

Runtime activity and logs may coexist

A single action may legitimately appear in more than one system.

For example, if another actor transfers data from a Device:

WHILE ACTIVE
→ network/runtime activity may be observable through Processes or related
  system telemetry
EVENT HISTORY
→ represented audit records may remain after the transfer ends

This is not duplicated truth when each representation describes a distinct
consequence of the same represented event.

Processes answers what is happening now.

Logs answer what happened.

The same represented action may therefore produce both runtime effects and
audit evidence without making either system the owner of the other.

Logs and forensic traces

A visible Device log is not necessarily the complete forensic footprint of an
action.

An operation may eventually leave evidence across several represented systems,
for example:

* local Device logs
* remote Device logs
* network infrastructure
* filesystem artifacts
* Process activity
* configuration changes
* credentials or authentication artifacts
* software state
* other concrete traces

Deleting or modifying one log must therefore not automatically erase unrelated
evidence.

Conceptually:

REPRESENTED ACTION
        ↓
MULTIPLE SYSTEM EFFECTS
        │
        ├── runtime activity
        ├── Device audit records
        ├── filesystem changes
        ├── network evidence
        └── other forensic traces

Removing one visible record only changes the represented artifact that was
actually removed unless a concrete mechanic also changes the other evidence.

This creates the long-term possibility of forensic gameplay based on the same
systems used by offensive gameplay:

ACTION
  ↓
TRACES / LOGS / STATE CHANGES
  ↓
CLEANUP ATTEMPT
  ↓
REMAINING EVIDENCE
  ↓
INVESTIGATION

A player may successfully remove one obvious log while leaving evidence
elsewhere.

Likewise, a defender or investigator may reconstruct activity from several
independent pieces of evidence instead of relying on one universal detection
meter.

Malware and visibility

Malware should interact with the same Device runtime, logging, filesystem,
network, and resource systems as legitimate software where practical.

For example, represented malware might eventually:

* execute on a Device
* consume CPU or RAM
* access or modify files
* create network traffic
* establish persistence
* interact with credentials
* start other runtime work
* create audit records
* attempt to remove or alter audit records
* leave other forensic evidence

Malware must not require a separate arbitrary consequence system when existing
Device mechanics can express its behavior.

Conceptually:

MALWARE
   ↓
REAL DEVICE ACTIVITY
   │
   ├── CPU / RAM use
   ├── Processes / runtime activity
   ├── filesystem effects
   ├── network activity
   ├── access or credential effects
   ├── logs
   └── forensic traces

Whether malicious activity is visible in Processes should eventually depend on
the represented mechanism rather than on a permanent rule that all malware is
always visible or always hidden.

Future stealth or defensive mechanics may affect how easily runtime activity,
logs, or traces can be observed without changing the underlying canonical
activity itself.

Remote actors and Device activity

Actions performed by another actor against or through a Device should use the
same systemic boundaries.

For example, if another player has access to a Device and downloads one of its
files:

REMOTE ACTOR
    ↓
AUTHORIZED OR EXPLOITED ACCESS
    ↓
FILE TRANSFER
    │
    ├── active network/resource effect on the Device
    ├── possible runtime observability
    ├── Device audit records
    └── possible forensic traces

The active physical effect and its historical evidence are separate concerns.

A remote transfer may therefore affect Device telemetry while active and leave
audit or forensic evidence afterward.

This should not require a special playerAttackLog, playerTransfer, or other
parallel ontology merely because the actor is another player.

Bounded history

Persistent or online worlds must not require unbounded Device history.

Audit/log retention should therefore be bounded by represented policy or
capacity.

A simple future implementation may retain only a finite number of recent
records and discard the oldest retained entries when capacity is exceeded.

The exact retention mechanism is intentionally not selected yet.

Possible future contributors could include:

* Device model
* Firmware
* logging software
* storage configuration
* administrative policy
* other represented systems

These possibilities must not be implemented merely because they are listed
here.

The durable direction is only:

DEVICE AUDIT HISTORY
= REPRESENTED
+ CANONICAL
+ BOUNDED

rather than an infinite global event list.

Completed Processes are not audit history

Completed Process entries shown in the Processes application remain disposable
operator-facing runtime history.

They may be cleared or individually removed without undoing consequences that
already exist elsewhere.

For example, removing a completed Credential Access entry must not remove:

* established DeviceAccess
* discovered Knowledge
* filesystem changes
* Wallet or economic effects
* Device logs
* forensic evidence
* other canonical consequences

Likewise, clearing Processes must never become a shortcut for clearing forensic
evidence.

Long-term forensic direction

The long-term goal is not a separate scripted “forensics minigame”.

Forensic gameplay should increasingly emerge from normal represented systems.

Conceptually:

ATTACK / OPERATION
        ↓
REAL STATE CHANGES
        ↓
LOGS + TRACES + RUNTIME EFFECTS
        ↓
ATTACKER CLEANUP
        ↓
WHAT REMAINS?
        ↓
DEFENDER / INVESTIGATOR OBSERVATION
        ↓
INFORMATION
        ↓
RECONSTRUCTION / RESPONSE

This allows offensive, defensive, malware, cleanup, investigation, and
multiplayer mechanics to interact with one shared simulated world instead of
maintaining separate scripted versions of the same events.

## Economy and markets

Economy should become meaningful when represented products, services, resources,
and relationships give money something systemic to interact with.

Possible future markets include:

- software
- licenses
- services
- infrastructure
- information
- hardware
- currencies
- other represented products

Prices and value should increasingly emerge from represented market conditions
when concrete economic systems exist rather than from arbitrary story labels.


## Organizations

Organizations may eventually become persistent actors in the world.

They might operate:

- software projects
- Firmware projects
- services
- infrastructure
- marketplaces
- treasuries
- currencies
- other products

Examples could include companies, informal developer groups, security teams, or
other organizations.

Named organizations may have strong fictional identities without requiring
special laws of simulation.


## Fictional currencies

Synthesis may eventually contain fictional digital currencies.

A currency might interact with:

- player balances
- organization treasuries
- markets
- product payments
- exchange
- services
- speculation

The interesting direction is not a scripted price chart.

It is the possibility that represented actions produce economic history.

For example:

```text
ORGANIZATION
      ↓
ISSUES CURRENCY
      ↓
PLAYERS BUY / SELL / USE IT
      ↓
MARKET STATE CHANGES
      ↓
ORGANIZATION OR PLAYERS CHANGE THEIR POSITIONS
      ↓
SUPPLY / DEMAND CHANGES
      ↓
PRICE CHANGES
```

If an organization later dumps a large represented treasury and players react,
the resulting collapse may socially be described as a „rug pull“.

The durable simulation event should be the underlying market actions and state
changes, not:

```text
rugPullOccurred = true
```

The same principle applies to other economic events.


## Community-shaped persistent world

A long-term possibility is that Synthesis becomes a persistent world influenced
not only by the core development team but also by its players and trusted
community contributors.

This is broader than conventional modding.

The idea is that real contributors might eventually operate fictional entities
inside the world.

Conceptually:

```text
REAL COMMUNITY CONTRIBUTORS
        ↓
IN-WORLD ORGANIZATION
        ↓
PRODUCTS / SERVICES / INFRASTRUCTURE
        ↓
REAL SIMULATION STATE
        ↓
PLAYER USE AND REACTION
        ↓
TECHNICAL / ECONOMIC / SOCIAL CONSEQUENCES
        ↓
SHARED WORLD HISTORY
```

A real community development team could, for example, eventually represent the
fictional organization responsible for a Firmware or software product.


### Example: a community-operated Firmware project

A team could eventually maintain an in-world organization responsible for
NODE-OS or another Firmware family.

It might publish actual in-world:

- Firmware releases
- product updates
- related software
- licenses
- services

A release could become part of the simulation because players actually use it.

A defective release might create real represented consequences.

A competing Firmware team might gain users because players prefer its product.

The history would emerge from the interaction between real contributors,
products, players, and simulation state rather than from a scripted
„corporate war“ storyline.


### Community-created software

Community developers might eventually create products such as:

```text
NodeTrace
Network Sniffer
GhostProbe
BlackFin
Manta
other reconnaissance, defensive, offensive, or utility software
```

These products could develop their own:

- identity
- interface
- version history
- supported capabilities
- reputation
- distribution
- user base

Players might meaningfully compare them rather than treat them as cosmetic
skins.

For example, one reconnaissance product might prioritize topology mapping while
another focuses on passive observation.

A cracked version might offer different provenance or consequences.

Software could therefore acquire actual history inside the world.


### Community developers as world participants

A contributor would not merely be a mod author outside the game.

Depending on future product decisions, contributors might also become
participants representing:

- software companies
- Firmware teams
- infrastructure providers
- security groups
- marketplaces
- other organizations

Their authorized actions could create normal simulation consequences.

A Firmware team publishing an update should not therefore gain arbitrary
authority over unrelated player state.

Community participation should mean:

```text
AUTHORIZED WORLD ACTION
        ↓
NORMAL SIMULATION RULES
```

not:

```text
ARBITRARY GAMESTATE CONTROL
```


### Community-created history

The long-term possibility is a world in which players can remember events that
actually emerged.

Examples might eventually include:

- a popular software release failing
- a competing Firmware gaining adoption
- a currency collapsing
- a cracked Tool spreading widely
- malicious software being discovered
- a security product becoming popular
- an organization losing trust
- infrastructure becoming strategically important

These examples are not promised scripted events.

Their value comes from the possibility that they emerge from represented
systems and real participant decisions.


## External community

People may coordinate outside Synthesis through:

- chat groups
- forums
- repositories
- social platforms
- other communities

Those discussions may influence what participants choose to build or do inside
the world.

External discussion is not automatically simulation truth.

Any future technical bridge between an external service and Synthesis requires
an explicit authority and product boundary.


## Community extensibility and modding

Synthesis may eventually support community-authored content without requiring
every contributor to modify the core repository.

Possible extension layers include:

- world or scenario definitions
- Devices
- networks
- software
- Firmware presentation
- services
- other content
- eventually sandboxed behavior where a real requirement exists

The safest and simplest extension layer may eventually be declarative content
rather than unrestricted code execution.

More powerful scripting would require explicit authority and sandbox
boundaries.

Do not assume a future public extension system must expose mutable canonical
`GameState`.

The exact modding architecture should be extracted only after several real
first-party systems reveal stable extension points.


## Autonomous world change

A deeper simulation may eventually contain autonomous actors and systems that
change the world without direct player action.

Examples might include:

- normal workloads
- infrastructure behavior
- service changes
- defensive systems
- security responses
- autonomous organizations
- software behavior
- economic activity
- other actors

Autonomous systems should operate through the same represented state as player
mechanics.

The player should be able to encounter a world that changed because something
actually happened rather than because a mission script advanced.


## Simulation time

Simulation time may eventually become important when concrete mechanics require
persistent change.

Possible consumers include:

- Processes
- autonomous actors
- markets
- software behavior
- infrastructure
- security responses
- stale information
- scheduled world changes

Time should not be introduced as a universal framework before those mechanics
need it.


## Artifacts, traces, attention, and information

Actions should increasingly leave artifacts when the represented environment
would actually produce them.

The information loop is:

```text
ACTION
    ↓
REAL WORLD EVENT
    ↓
ARTIFACT
    ↓
OBSERVATION
    ↓
INFORMATION / KNOWLEDGE
    ↓
PLAYER DECISION
```

Possible future artifacts include:

- authentication records
- connection records
- filesystem changes
- process evidence
- network activity
- service logs
- configuration changes

Those artifacts may later support:

- forensic investigation
- trace discovery
- attention
- detection
- cleanup
- security response

Evidence should arise from real represented events rather than decorative fake
logs.


## Risk and consequences

Risk should become explainable through represented causes.

An action may become risky because of:

- its resource use
- network activity
- generated artifacts
- target security configuration
- timing
- repeated attempts
- current infrastructure
- other represented conditions

Avoid a universal hidden „risk score“ when the actual causes can be represented.

Different systems may respond independently to the same evidence.


## Hardware and execution

Hardware should increasingly matter because actual work consumes represented
resources.

Potential long-term interactions include:

- faster compute
- RAM capacity
- concurrent Processes
- software requirements
- local versus remote execution
- malware workloads
- defensive workloads
- other Device activity

Firmware must not become the source of compute power.

A powerful machine with inconvenient Firmware may still outperform a weaker
machine running a polished environment.

Software, Firmware, Device, and execution position should remain independently
meaningful progression axes.


## Remote compute

Future controlled Devices may eventually execute work.

That may enable:

- moving computation to another Device
- using more powerful remote hardware
- distributing workloads
- running software where network position is advantageous

Remote compute should build from concrete Device resources and active operating
relationships rather than a generic „remote power“ stat.


## Multiplayer and authoritative simulation

A persistent shared world eventually requires stronger authority boundaries than
the current local prototype.

A future server-authoritative deployment may own:

- hidden World Truth
- canonical simulation time
- Process advancement
- autonomous actors
- persistent economy
- shared infrastructure
- organization state
- other persistent world systems

Clients should receive only information they are legitimately allowed to
observe.

Conceptually:

```text
PLAYER CLIENT
      ↓
REQUESTED OPERATION
      ↓
AUTHORITATIVE SIMULATION
      ↓
PLAYER-VISIBLE RESULT / PROJECTION
```

The client should not require the entire hidden world merely to perform
gameplay.

Multiplayer identity, account identity, Device identity, organization identity,
and active connection identity should remain separate concepts.


## Replayability

Replayability should increasingly emerge from combinations among systems rather
than a huge catalog of isolated authored surprises.

The same tool may be strategically different depending on:

- infrastructure layout
- network position
- security posture
- existing access
- available hardware
- software
- current organizations
- economic conditions
- autonomous actors
- world history

Ideally:

```text
OLD SYSTEMS
    +
NEW CAPABILITY
    +
DIFFERENT WORLD STATE
    =
NEW STRATEGY
```

A familiar target can therefore become interesting again because the surrounding
world or the player’s available possibilities changed.


## Product directions, not frameworks

Nothing in this document requires current implementation of:

- mod support
- plugin systems
- community governance
- organizations
- currencies
- marketplaces
- generic software inventories
- capability engines
- universal reachability systems
- scripting runtimes
- autonomous actors
- multiplayer
- server infrastructure

Future ideas should influence current architecture only when a durable boundary
is needed to avoid unnecessary coupling.

Concrete mechanics remain the source from which future abstractions are
discovered.

The purpose of this document is to preserve important possibilities without
turning possibilities into premature implementation.

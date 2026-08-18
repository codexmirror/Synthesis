# Confirmed future directions

Future iterations may add:

- Authoritative server-owned simulation and multiplayer clients limited to player-visible observations, projections, and operation results

- Network Analysis upgrades that deepen observations derived from existing simulation truth
- Richer simulated networks, NPC hosts, and eventually exposed real players
- Simulation time and autonomous world change when concrete mechanics require them
- Imperfect, stale, and deeper player knowledge
- Explainable traces, attention, risk, logs, and trace removal
- Exploit attempts, credentials, access, and filesystems as concrete mechanics
- Player-owned tools, software, derived capabilities, hardware, malware, economy, organizations, reachability, and multiplayer progression
- Device-owned Firmware and multiple operating environments over the same simulated systems
- External integrations where they serve an established product need

## Devices and firmware

Long-term Device identity and Firmware identity are separate. A Device defines the simulated machine and its concrete capabilities and runtime state; Firmware defines the operating environment through which that machine is presented and operated.

NODE-OS is intended to be the polished personal operating system of the player’s own Device rather than the universal Synthesis shell. Its identity should come from consistency, speed, clear interpretation of system state, strong networking and systems conveniences, and a stable interaction model.

Foreign Devices may use substantially different Firmware. An older server environment may expose more raw process, socket, user, filesystem, or network information through a terminal-oriented interface, while another modern Firmware may provide its own graphical applications and conventions. These environments should be allowed to differ structurally rather than merely recoloring NODE-OS.

The same underlying simulated condition may therefore be presented differently depending on Firmware without changing canonical World truth. NODE-OS may provide interpreted labels, known-target affordances, compact Process feedback, or other conveniences while a foreign system exposes lower-level state more directly.

The goal is not to make foreign Firmware artificially frustrating. Different operating environments should have meaningful identities, strengths, limitations, and levels of convenience. Returning to NODE-OS after operating an unfamiliar system should feel like returning to the player’s own Device.

A future remote operating context should build on established `DeviceAccess` rather than treating successful access as an automatic interface switch. Device state, Firmware identity, installed software, access relationships, and active operating context remain separate concerns.

## Systemic gameplay north star

The long-term goal is not merely to accumulate targets, commands, applications, exploits, or isolated mechanics. Synthesis should grow as a network of interacting world states and relationships in which independently useful mechanics observe or transform shared state and create situations that were not authored as explicit event chains. Hacking is the player’s language for investigating and manipulating that simulated world, not a fixed sequence of prescribed exploit steps.

```text
WORLD TRUTH
    ↓
ACTIONS AND AUTONOMOUS CHANGE
    ↓
STATE MUTATION
    ↓
CROSS-SYSTEM CONSEQUENCES
    ↓
OBSERVATION
    ↓
PLAYER DECISIONS
    ↓
FURTHER STATE MUTATION
```

These are directions, not specifications. The current slice has a graphical Scan workspace, Service Analysis, and minimal positive vulnerability Knowledge, but no exploit, access, filesystem gameplay, autonomous actors, attention system, or simulation clock. Concrete mechanics should establish requirements before generic frameworks are considered.

### Player tools, capabilities, and strategic position

Long-term progression should expand the player's ways of interacting with existing systems rather than merely unlock a fixed sequence of stronger commands. Tools and software should increasingly be concrete things in the simulation. Depending on mechanics that are actually implemented, they might be found, copied, stolen, purchased, traded, modified, deleted, outdated, corrupted, detected, or otherwise affected by world systems. These are examples of systemic possibilities, not promises that every listed mechanic will exist or that every tool must use one inventory model.

Capabilities should increasingly be derived from concrete state rather than made ultimate canonical truth as permanent player flags. Conceptually, installed software, hardware, runtime state, relationships or access, credentials, and position or reachability could together determine currently usable capabilities. A tool might be installed while required hardware is absent; a target might be unreachable from the current position; or a tool might work only from another controlled device. In each case, possession alone is insufficient. This is a future design direction, not a capability resolver or schema.

Knowledge reveals potential ways of interacting with the world. It does not automatically unlock success, prove current validity or reachability, provide required software or credentials, or create access. One player might know a weakness and have compatible tooling; another might know it but lack tooling; another might not know it but own valid credentials; and another might already have an internal session. The same world object can therefore offer meaningfully different options in different player situations.

Observation tools should primarily reduce uncertainty and improve decision quality rather than act as artificial permission gates. A player may be allowed to attempt a transformation without knowing whether current World truth makes it effective. Better Scan, Inspect, fingerprinting, forensics, or analysis capabilities can reveal more useful information before the player commits time or resources, but lack of perfect information should not automatically remove an otherwise meaningful attempt. **I can attempt this** and **I know whether this is a good idea** are deliberately different statements.

Reachability should become a major source of strategic depth while remaining conceptually separate from Knowledge, tool possession, and World identity. A player may know that a database exists and own a useful technique while the database is unreachable from the Internet. A later foothold on a web server could make the database reachable from that position without changing either the database or the tool: the player's relationship and position changed the useful action space. This direction does not define routing or network simulation.

The UI should express what the player reasonably believes they can attempt, not expose omniscient World truth. A player may know an old weakness, possess a suitable tool, see an attempt as plausible, begin it, spend time or resources, and learn only from its result that the world has changed. Visible feasibility is not actual feasibility, and this principle does not define a generic available-actions API.

Future attacks should not all produce the same outcome. An action is valuable because of its concrete state transition, and success means that the requested transition occurred—not that a “generic hack” succeeded or that access necessarily followed. Service disruption, credential use, exploitation, malware or software manipulation, traffic or reachability manipulation, filesystem actions, and resource abuse are possible examples, not a required taxonomy or a future `AttackType` contract.

The current Scan → Analyze → weakness path is one concrete route, not the universal hacking pipeline. Future access or influence over a device may come from service weaknesses, credentials, keys, trusted sessions, another controlled machine, firmware or configuration changes, filesystem discoveries, malware, routing or reachability changes, social or intelligence routes, or other concrete mechanics that later prove useful. No target should require every player to progress through the same ordered chain, and no player should be expected to eventually possess every possible approach.

Replayability should increasingly arise from combinations among existing systems rather than a huge catalog of isolated content. Infrastructure layout, redundancy, security posture, dependencies, current actors, existing access, and world state may make the same capability produce very different situations. Ideally, a tool discovered late in a playthrough can make a familiar world configuration strategically meaningful in a new way: old systems plus a new capability plus a different situation produce a new player strategy, rather than relying on a numbered scripted surprise.

Ja. Und ich würde es jetzt festhalten, aber bewusst nicht als Work Order — es ist noch keine konkrete nächste Implementierung, sondern eine bestätigte Produkt-/Gameplay-Richtung.

Der beste Ort ist docs/FUTURE.md. Dort steht bereits, dass Tools/Software konkrete Dinge werden sollen, die gefunden, gekauft, kopiert, gestohlen, verändert oder kompromittiert werden können, und dass Capabilities aus konkretem Zustand entstehen sollen.  ARCHITECTURE.md enthält außerdem schon die wichtigen dauerhaften Grenzen: Software/Tools ≠ Firmware, Command ≠ Capability, und ähnliche Fähigkeiten dürfen später von unterschiedlichen Tools mit unterschiedlichen Trade-offs kommen.

Deshalb würde ich Architecture nicht aufblasen. In FUTURE.md, direkt innerhalb von ### Player tools, capabilities, and strategic position, würde ich diesen neuen Unterabschnitt ergänzen:

#### Software products, modules, licensing, and provenance
Player software should become a major progression axis rather than a cosmetic
inventory of command unlocks.
Terminal and graphical verbs remain interfaces. The ability and quality behind
an operation should increasingly come from concrete software installed on the
Device.
Conceptually:

COMMAND / UI VERB
        ↓
GAMEPLAY OPERATION
        ↓
AVAILABLE INSTALLED SOFTWARE
        ↓
SOFTWARE CAPABILITY / MODULES / CURRENT CONDITIONS
        ↓
WORLD INTERACTION

A command therefore must not become permanently identical to one named Tool.

Different software products may eventually provide overlapping ways to perform
similar operations with different strengths, limitations, resource costs,
reliability, exposure, supported environments, or observation depth.

A first concrete reconnaissance product could, for example, combine the current
Scan and Inspect interaction family.

Working product direction:

NodeScan
├── network discovery
├── object inspection
└── optional future modules
    ├── service fingerprinting
    ├── banner probing
    ├── broader sweeps
    ├── topology assistance
    ├── passive observation
    └── deeper device/service evidence

This does not mean scan or inspect are permanently owned by NodeScan.
Another product could later provide overlapping reconnaissance capabilities
with different trade-offs.

Likewise, deeper analysis and offensive transformations may eventually be
provided by one or more concrete offensive software products.

A working thematic direction could be a distinctive underground tool such as a
“Dolphin”-style loader or analysis/payload suite:

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

These names and module lists are design examples, not current schemas or locked
content.

Software progression may eventually include:

* product versions
* optional modules or feature packs
* official licenses
* license keys
* recovered or stolen licenses
* key generators
* cracked releases
* modified or repacked releases
* software obtained from legitimate and underground markets
* different software provenance or trustworthiness

The same desired capability should not always require the same acquisition
route. A player might buy a legitimate license, recover a usable key from
another system, obtain a key generator, install a cracked build, purchase a
repack from another actor, or use another software product that provides a
similar capability.

This creates interaction between:

* money
* information
* filesystem discoveries
* software ownership
* Device state
* player trust and risk
* existing access
* market relationships

A future black market may sell software, modules, licenses, cracks, key
generators, or modified packages.

Underground software must not be represented only as a cheaper shop item with a
random penalty. Software provenance can become meaningful when concrete
simulation systems exist.

For example, a modified package could contain additional software or malware
that later interacts with real represented state such as:

* Device-owned files
* running Processes
* CPU or RAM usage
* network activity
* configuration
* credentials
* Wallet-related state
* access relationships

The player should ideally be able to discover such consequences through the
same simulation and observation surfaces used elsewhere in the game rather than
through an arbitrary “malware detected” event.

Conceptually:

UNTRUSTED SOFTWARE
        ↓
REAL DEVICE STATE CHANGE
        ↓
FILES / PROCESSES / NETWORK / OTHER STATE
        ↓
OBSERVATION
        ↓
PLAYER REALIZES SOMETHING IS WRONG

This is especially important for systemic gameplay: software should participate
in the same World state as other mechanics rather than live in an isolated
upgrade menu.

Official, cracked, stolen, modified, or malicious software therefore need not
be intrinsically represented by universal quality or danger scores. Concrete
future mechanics should model only the properties that actually matter.

Do not introduce a universal SoftwareFramework, CapabilityResolver,
LicenseEngine, MarketplaceEngine, generic module system, or package-risk
system in anticipation of these directions.

The first concrete software products should establish the real shared
requirements before common abstractions are extracted.

### Action artifacts and information

Actions should increasingly leave concrete artifacts when the represented environment would produce them.

The durable information loop is:


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

Concrete mechanics come first. None of these directions requires or justifies a CapabilityEngine, ActionEngine, AttackFramework, AvailableActionsEngine, RuleEngine, ReachabilityEngine, ToolRegistry, SoftwareInventoryFramework, generic affordance system, ECS, event bus, or plugin framework. Concrete mechanics should establish actual requirements before abstractions are extracted. The current slice includes the concrete Basic Credential Toolkit and established `DeviceAccess`, but no generalized software inventory, capability resolver, reachability system, active remote Session, broader exploit model, or filesystem gameplay exists today.

Architectural constraints for future work are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).

# Architecture

Synthesis keeps a few practical dependency boundaries so that the current foundation can grow without introducing a framework prematurely.

## Module direction

- `core/game` contains only pure domain state and rules. It must not depend on React, browser APIs, the shell, or app UI.
- `app` contains the thin React adapter that creates a fresh game state for each client session and exposes it to the UI.
- `apps/<feature>` owns each feature's UI and local helpers. Features may consume game-domain APIs, but must not import another feature's internal UI implementation.
- `shell` registers, hosts, and navigates apps. Navigation is presentation state and the shell must not own gameplay rules.
- Shared styles contain reusable presentation concerns only; they must not contain game rules.

New game systems should normally become separate domain slices instead of expanding player state into the whole game. Browser-specific persistence stays at the feature/application boundary; for example, Notes owns its small storage adapter.

## Identity and state

Game state carries a schema version, but V0 does not implement saves or migrations. Stable internal IDs identify game entities. Mutable presentation or gameplay attributes—including IP addresses, network names, display names, hostnames, and wallet addresses—must not serve as entity identity. The player owns an explicit local device with its own stable identity. `player.id`, the local device ID, local network IDs, and world network host IDs are distinct identities, while IPs and network names are mutable simulated attributes. The local device is the single source of truth for the player's current IP, hardware, and runtime state; wallet remains a separate domain slice and remote hosts remain world state.

Hardware specification is distinct from runtime utilization. Wallet state is likewise separate from player identity so each concern can evolve at its own boundary.

Long-running gameplay actions are represented as domain-owned Processes with stable identity and an explicit executor device. CPU compute capacity determines throughput, while numeric RAM capacity determines admission and parallel capacity; RAM is not a second speed multiplier. Current resource utilization is derived once from explicit system baselines plus running Process allocation and reservation.

Process scheduling derives completed work from elapsed time and hardware/resource state. A Service Analysis Process retains the endpoint originally selected solely for historical presentation; stable device and service IDs remain its gameplay identity, so later address changes do not rewrite the Process card. Browser timers are scheduling triggers rather than simulation truth, and the application adapter owns the single scheduler. The Processes app only observes canonical Process state. V1 Processes execute only on the player's local device; remote and distributed compute are deferred.

Completed Process records are disposable execution history. Clearing them preserves running work and ID progression and does not reverse consequences stored in other canonical slices. Process history, player Knowledge, and World truth remain distinct concerns.

## Entity-owned simulation state

Simulated objects own their actual state. Gameplay operations observe or modify that state; interfaces must not invent parallel representations of it.

The world currently owns one concrete local-network entity with a stable ID and player-visible name. Its member device IDs are the single canonical membership relation; devices do not duplicate a network ID. A device is not its IP: the stable device ID remains identity while its IP is a mutable network address. The existing LAN device is represented as a server and owns exposed SSH and HTTP services. SSH owns one fictional represented vulnerability; vulnerabilities are current, entity-owned world truth. A service has stable identity distinct from mutable attributes such as its name and port; services remain owned device state rather than entries in a global registry. Network scanning resolves the real network by its exact player-visible name and derives responding represented members from that canonical relation. Network Scan and Inspect results retain stable identities for domain consumers even though Terminal does not display them. Network Inspect reports only the network’s own represented properties and never enumerates members.

World truth exists independently of what the player can currently observe. Scan explores outward from a simulation object and may reveal adjacent real objects or relationships. Inspect observes the current intrinsic state of one specific simulation object; when gameplay changes canonical object state, a later Inspect derives its observation from that changed current state. Inspect need not expose every internal property, and its observation depth should grow only when concrete gameplay requires it. Scan observations reveal real simulation objects; they do not create those objects. Neither operation derives its result from the other or from formatted output. An observation is not automatically an entity. Terminal output is not game state. Current world truth, current Scan observation, and historical player Knowledge are distinct. Knowledge records only positive discovered vulnerability relations; its observed label is historical presentation and never identity or gameplay logic.

A computing device may own represented exposed services when gameplay requires them. Scan may reveal open services from current world truth. Inspect describes the device itself and does not enumerate its attack surface. Other properties should be added only when they are needed by implemented gameplay rather than as placeholders.

Entity-owned state is the canonical source of truth. Terminal commands and graphical apps are interfaces over that same state. For example, when filesystems are introduced, a device’s files must belong to the simulated device rather than to the Files app. Terminal filesystem commands and the Files app must observe and modify the same underlying filesystem state.

The same principle applies to future gameplay mutations. Tools, malware, exploits, or other mechanics should change actual simulated state, and later observations should derive from the resulting state rather than from scripted UI effects.

Not every game entity must have every kind of state. A filesystem, services, software, network interfaces, or similar structures belong only to entity types and mechanics that actually require them. Synthesis should grow these models from concrete gameplay needs rather than introducing a universal entity or component framework prematurely.

## Systemic simulation and causality

Synthesis should favor causal state changes over scripted event chains. A gameplay mechanic changes concrete canonical simulation state; other systems should react to the resulting state when their own rules make it relevant rather than depending on hidden knowledge of which original action caused the change.

### Knowledge, capabilities, relationships, and reachability

World truth, player Knowledge, player capabilities, player-to-world relationships, and current position or reachability are related but distinct concerns. World truth describes what currently exists and how simulated objects are configured. Knowledge describes what the player has learned or currently believes. Relationships describe established access, sessions, ownership, trust, or similar connections between actors and world entities. Position and reachability describe what can currently be interacted with from the player's present place in the simulated world.

Capabilities describe ways of interacting with systems, not one-to-one permissions for named vulnerabilities. They should increasingly emerge from concrete owned state—such as installed software, available hardware, existing access, runtime conditions, credentials, or other implemented resources—rather than become permanent boolean unlocks on the player. Knowledge must not become a disguised unlock tree: discovering a weakness neither grants the ability to exploit it nor guarantees success. Knowledge may make an interaction recognizable; owned tools and other capabilities determine which attempts the player can formulate; relationships, reachability, resources, and current world truth determine what actually happens.

This direction must not become a permanent key-and-lock mapping in which each weakness requires its named tool. Prefer world conditions with multiple possible approaches, capabilities useful in multiple situations, and similar capabilities supplied by different concrete tools with different trade-offs. Those tools may eventually vary in resource cost, speed, noise or exposure, hardware requirements, supported environments, dependencies, reliability, or other represented properties. These are future directions, not current implementation requirements.

Player-known feasibility and actual feasibility must remain distinct. If a weakness has been patched in World truth while the player's Knowledge still records it and the player owns an otherwise applicable method, an interface may continue to present the attempt as reasonable; the attempt may fail only when it meets current World truth. Disappearing actions, disabled buttons, hidden commands, or labels such as “no longer exploitable” must not silently disclose that stale Knowledge is false unless the player has learned information that justifies that presentation. This protects stale and imperfect Knowledge as gameplay without prescribing an available-actions implementation.

Commands are interfaces rather than capabilities: Terminal and graphical verbs express operations the player may request, but do not prove that required software, position, access, or other conditions exist.

### Actions and environmental consequences

Actions are valuable because of the concrete state transitions they cause, not because they belong to an abstract attack category. Different actions may change Knowledge, relationships, service availability, resource usage, software state, Process state, filesystem state, reachability, or other represented simulation state. A successful action therefore does not inherently imply access: **attack is not access**. One future action might establish access, while another might disrupt availability, alter resource or software state, operate through credentials or trust, or change reachability. These examples neither define implementations nor require a fixed taxonomy.

The same transition may have different consequences in different surroundings. Conceptually, disruption of a gateway might remove availability where it is the only gateway; activate a backup and make another host observable in redundant infrastructure; contribute to an incident response in a security-sensitive organization; or cause secondary failures among fragile dependents. These are possibilities, not promised features or scripted chains. The durable rule is that other systems react to changed state according to their own represented rules, rather than an attack explicitly scripting every consequence.

The same resulting state may eventually be caused by player actions, autonomous actors, malware, automated services, security systems, time, or other simulated systems. Observations and interfaces should continue to derive from the current world truth regardless of what caused it.

Processes are one execution mechanism for long-running work, not a universal action or event layer. A Process represents elapsed work and resource consumption. The concrete gameplay mechanic that uses the Process owns what completion means and which simulation state changes as a consequence. Service Analysis completion resolves exactly once in the canonical full-game advancement transition and evaluates current world truth, never React presentation.

Future simulation time, autonomous actors, security responses, deeper player knowledge, economy, malware, and similar systems should be introduced as concrete gameplay mechanics when they are actually needed. Concrete mechanics come first. These directions do not justify a CapabilityEngine, ActionEngine, AttackFramework, AvailableActionsEngine, RuleEngine, ReachabilityEngine, ToolRegistry, SoftwareInventoryFramework, generic affordance system, ECS, event bus, plugin framework, generic causality framework, or universal simulation object. The first concrete attack and tool mechanics should establish actual requirements before shared abstractions are extracted.

Shared abstractions should be extracted only after multiple implemented systems demonstrate the same concrete requirement. The long-term goal is for increasingly interesting situations to emerge from interactions between stateful systems rather than from bespoke scripted event chains.

## Shared operations and integrations

A gameplay operation is implemented once behind an explicit game-level API and is callable from different interfaces. Network Analysis contains separate `scan` and `inspect` verbs that both narrowly accept a represented Device by valid IPv4 address or a LocalNetwork by exact player-visible name. `SELF` is the player-owned device, `LAN` is another device sharing a represented local network with SELF, and `REMOTE` is a represented device without that shared membership. Device Scan returns real network relationships and currently open owned services; network Scan returns responding represented members. Device Inspect returns only properties owned by that device, including its server identity where represented, but does not enumerate services; network Inspect returns its name and whether canonical membership connects SELF, without member enumeration. Stable device, network, and service IDs remain internal. Both pure operations independently derive closed structured results from current world truth. The graphical Scan UI calls these same operations directly rather than constructing Terminal commands and retains each structured observation only as local presentation state. No generic entity, observation, resolver, or action framework is needed.

Commands are interface verbs, not installed tool objects or capabilities, and their presence does not prove that the player possesses the software, capability, position, access, or other conditions an operation requires. Future graphical applications and Terminal commands must call the same domain operations. Player-owned software or tools should influence those shared domain rules rather than create Terminal-only gameplay. Future Network Analysis upgrades may deepen observations derived from the same entities, but no general software inventory, capability framework, scanner-level, or upgrade system exists today.

External services must enter through explicit adapters or interfaces at the application boundary and must not become direct dependencies of core game-domain logic.

Terminal commands receive narrow, read-only values required by their behavior rather than unrestricted game state.

## Interface and mobile presentation

Terminal is intended to become the primary power-user operational interface, but it is not the game domain. Terminal and graphical apps must call the same domain operations directly; a GUI must not route gameplay through a Terminal command string. The current Terminal includes local informational and presentation commands plus the observational `scan <ipv4|network-name>` and `inspect <ipv4|network-name>` gameplay commands. It receives no unrestricted game state, and Network Analysis presentation remains separate from domain observation rules. Actionable player-visible world references may be marked by Terminal commands as Target Tokens. Target Tokens communicate possibility rather than target category, and are presentation metadata: they do not represent game state, entity identity, or persistent player knowledge. Their only V1 interaction copies the exact visible value; they never expose stable IDs, insert prompt text, or execute commands. A complete service endpoint is a Target Token because Analyze accepts it; service names, raw ports, protocols, and internal IDs are not. Analyze targets stable IDs after endpoint resolution. Stable identity does not promise permanent reachability semantics: V1 permits an open, retained service to resolve after a port change, while future operations may require current endpoint reachability. Inspect is contextual observation rather than a mandatory gate before Scan, Analyze, or future actions. Analyze performs deeper resource-driven investigation of a selected exposed surface and is one information-gathering route, not a mandatory pipeline for every future access path. Connect, exploit, access, and filesystem gameplay are not implemented.

Terminal and graphical applications are interchangeable interfaces over the same gameplay operations. A GUI may compose several existing operations into a simpler workflow for convenience, but it must not reimplement gameplay rules and must not construct or execute Terminal command strings internally.

The graphical Scan application calls the same `scan` domain operation that Terminal exposes and invokes Service Analysis through the same game action boundary. A convenience action such as a quick analysis may sequence multiple domain operations, but the underlying mechanics, validation, target resolution, and state changes must remain shared.

This keeps gameplay independent from the current UI. Terminal may remain available as a precise power-user interface while graphical applications can provide more beginner-friendly access to the same capabilities without creating a parallel game implementation.

Mobile is a first-class presentation target. The shell owns viewport and Editing-presentation coordination, while individual scrollable regions explicitly own their scrolling. In the established text-entry layout, Terminal output scrolls independently of its prompt and the Notes textarea owns its own scrolling. These are presentation boundaries and must not leak browser or viewport concerns into `core/game`.

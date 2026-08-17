# Architecture

## Discovery memory

World Truth, Discovery, and Knowledge are deliberately separate. World Truth is the current simulation; Discovery is the player's canonical memory of positive Scan observations; Knowledge is the deeper result of Analyze. SELF and its current address are intrinsic player knowledge, so SELF is not duplicated in Discovery even though remembered network relationships may reference its stable device identity.

Browse is not Observe. The Scan application projects remembered network/device relationships in a compact tree-like atlas, but opening an object reads Discovery only. Explicit network and device Scan actions use the shared application Scan operation, which observes current World Truth and additively merges the result into Discovery. The relationship records are independent pairs rather than parent/child ownership, so the presentation does not make the domain a tree.

Discovery V1 records whether network members and device services have ever been successfully observed. Failures do not mark those depths complete, while successful empty observations do. Positive re-observation can update snapshots, but absence never deletes memory and a shallow network observation cannot erase deeper service memory. Each service snapshot stores its actually observed endpoint; it is not rebuilt from a later device address. Analyze therefore remains bound to the remembered endpoint and stable device/service identities, and stale endpoint validation remains authoritative.

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

Initial Access adds one concrete relationship-changing Process without introducing a generic attack model. SELF owns the installed **Basic Credential Toolkit** as concrete local-device tooling, not as a Player Skill. A remembered SSH service, historical Weak Authentication Knowledge, and ownership of that Tool make a credential attempt player-known feasible; the Tool permits the attempt but never guarantees success. Hidden changes to current vulnerability truth do not remove that known affordance.

Credential Access runs on SELF with the existing CPU-sharing and RAM-admission rules. Its completion is resolved exactly once against current World truth: the stable target and service must still safely own the remembered endpoint, be available, retain the applicable Weak Authentication condition, and expose a current credential authentication context. Success derives privilege from that represented service authentication context and creates one deduplicated `DeviceAccess` relationship. Failure reports only that the target no longer responded as expected and does not rewrite historical Discovery or Knowledge.

`DeviceAccess` is canonical state distinct from World, Discovery, Knowledge, Processes, and UI context. It records source device, target device, service path, and privilege; it is not a `hacked` flag and is not a current connection or future CONNECT context. Clearing completed Process history cannot remove established access (or Discovery or Knowledge). CONNECT, remote device context, and access-session lifecycle remain unimplemented.

## Entity-owned simulation state

Simulated objects own their actual state. Gameplay operations observe or modify that state; interfaces must not invent parallel representations of it.

The world currently owns one concrete local-network entity with a stable ID and player-visible name. Its member device IDs are the single canonical membership relation; devices do not duplicate a network ID. A device is not its IP: the stable device ID remains identity while its IP is a mutable network address. The existing LAN device is represented as a server and owns exposed SSH and HTTP services. SSH owns one fictional represented vulnerability; vulnerabilities are current, entity-owned world truth. A service has stable identity distinct from mutable attributes such as its name and port; services remain owned device state rather than entries in a global registry. Network scanning resolves the real network by its exact player-visible name and derives responding represented members from that canonical relation. Network Scan and Inspect results retain stable identities for domain consumers even though Terminal does not display them. Network Inspect reports only the network’s own represented properties and never enumerates members.

World truth exists independently of what the player can currently observe. Scan explores outward from a simulation object and may reveal adjacent real objects or relationships. Inspect observes the current intrinsic state of one specific simulation object; when gameplay changes canonical object state, a later Inspect derives its observation from that changed current state. Inspect need not expose every internal property, and its observation depth should grow only when concrete gameplay requires it. Scan observations reveal real simulation objects; they do not create those objects. Neither operation derives its result from the other or from formatted output. A `ScanResult` is an observation result rather than an entity, while its legitimately observed positive facts grow canonical Discovery. Terminal output is not game state. World truth, remembered Discovery, and historical player Knowledge are distinct. Knowledge records only positive discovered vulnerability relations; its observed label is historical presentation and never identity or gameplay logic.

A computing device may own represented exposed services when gameplay requires them. Scan may reveal open services from current world truth. Inspect describes the device itself and does not enumerate its attack surface. Other properties should be added only when they are needed by implemented gameplay rather than as placeholders.

Entity-owned state is the canonical source of truth. Terminal commands and graphical apps are interfaces over that same state. For example, when filesystems are introduced, a device’s files must belong to the simulated device rather than to the Files app. Terminal filesystem commands and the Files app must observe and modify the same underlying filesystem state.

The same principle applies to future gameplay mutations. Tools, malware, exploits, or other mechanics should change actual simulated state, and later observations should derive from the resulting state rather than from scripted UI effects.

Not every game entity must have every kind of state. A filesystem, services, software, network interfaces, or similar structures belong only to entity types and mechanics that actually require them. Synthesis should grow these models from concrete gameplay needs rather than introducing a universal entity or component framework prematurely.

## Scan atlas and observation boundaries

Scan is the player's atlas of known or observed space, not a browser over omniscient World truth. Its current observations come from the shared Scan domain operation, and opening a focus must not reveal objects beyond what that operation observed. An observation records what the player could learn at that interaction; it is not synonymous with eternal current World truth. Future freshness metadata may describe how current an observation is, but no generalized freshness system exists today.

Known-world relationships may form a graph rather than a canonical ownership tree. The Scan interface may make that graph understandable through rooted views, collapsible or tree-like projections, and focused paths, but a presentation path must not impose canonical parent/child ownership on domain entities. No graph or clustering framework is implied by this rule.

Scan scales through progressive disclosure: the broad view shows observed areas or networks, network focus shows devices, device focus keeps services compact, and service focus presents detailed observation, Knowledge, Process context, and implemented interactions. Only the current focus expands deeply; atlas growth is discovery, not checklist completion.

Scan, Inspect, and Analyze have separate epistemic roles. Scan interprets known or observed space for navigation and decisions. A future richer Inspect may provide a precise current observation of one concrete object, constrained by what the player can actually observe, but must never expose raw GameState omnisciently. Analyze remains deeper, resource-consuming investigation that may create Knowledge. These boundaries describe durable responsibilities rather than unimplemented clustering, freshness, path, access, or session features.

## Systemic simulation and causality

Synthesis should grow as a network of interacting world states and relationships. Mechanics should primarily observe or transform those shared states; downstream consequences should emerge because other systems react to the resulting state rather than because an action directly scripts its complete outcome. Player-owned tools and discovered information determine which transformations a player can meaningfully attempt, but no single interaction path should become the mandatory solution for a target.

Persist independent causes and derive consequences where practical. A mechanic should normally change the concrete state it actually affects rather than duplicating every downstream consequence as additional flags. Resource usage, reachability, availability, risk, or similar derived conditions should be calculated from their represented causes when practical so independently developed systems can interact without maintaining contradictory copies of the same truth.

The same resulting state may have multiple causes. CPU or RAM pressure may eventually come from normal workloads, player Processes, malware, security software, mining, background services, or other represented work. Connectivity may depend on interfaces, active connections, routes, firewall state, and current position. Systems consuming those states should not need to know which named mechanic originally caused them.

Relationships may themselves become concrete simulation state when gameplay gives them an independent lifecycle or properties—for example an authenticated session or an active network connection. Other relationships may remain simple canonical references or be derived from lower-level state. Do not turn this principle into a universal relationship graph: model a relationship explicitly only when current gameplay needs to observe, modify, persist, or reason about it.

Do not prematurely build a universal simulation, entity, relationship, capability, action, or effect framework. Add concrete state and concrete interactions only when current gameplay requires them, while preserving these systemic principles.

### Design test for new mechanics

Before introducing a significant gameplay mechanic, check:

1. What concrete World state or relationship does this mechanic observe?
2. What concrete state or relationship does it actually change?
3. Which consequences should be derived rather than directly written?
4. Can other independent systems influence the same underlying state?
5. Can existing or future systems react to the resulting state without knowing which named action caused it?
6. Does this add another meaningful approach to a goal, or merely another mandatory pipeline step?
7. Are we modelling only what current gameplay requires rather than anticipating a universal framework?

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

When concrete artifact-producing systems exist, actions should leave artifacts because represented events actually occurred, not because a feature manufactures flavor evidence. Connections, authentication attempts, filesystem changes, Process execution, network activity, and similar events may later produce logs or other artifacts according to the configuration of the systems involved. Those artifacts can then become player-observable information without requiring downstream systems to know which higher-level action originally caused them.

Processes are one execution mechanism for long-running work, not a universal action or event layer. A Process represents elapsed work and resource consumption. The concrete gameplay mechanic that uses the Process owns what completion means and which simulation state changes as a consequence. Service Analysis completion resolves exactly once in the canonical full-game advancement transition and evaluates current world truth, never React presentation.

Future simulation time, autonomous actors, security responses, deeper player knowledge, economy, malware, and similar systems should be introduced as concrete gameplay mechanics when they are actually needed. Concrete mechanics come first. These directions do not justify a CapabilityEngine, ActionEngine, AttackFramework, AvailableActionsEngine, RuleEngine, ReachabilityEngine, ToolRegistry, SoftwareInventoryFramework, generic affordance system, ECS, event bus, plugin framework, generic causality framework, or universal simulation object. The first concrete attack and tool mechanics should establish actual requirements before shared abstractions are extracted.

Shared abstractions should be extracted only after multiple implemented systems demonstrate the same concrete requirement. The long-term goal is for increasingly interesting situations to emerge from interactions between stateful systems rather than from bespoke scripted event chains.

## Authoritative deployment and online readiness

V0/V1 browser mode is locally authoritative: `GameProvider` owns the current complete `GameState`, its application adapter executes gameplay operations in-process, and the browser scheduler triggers `advanceGameState`. That is the current offline deployment implementation, not a permanent requirement that a gameplay client possess canonical simulation truth. No server, networking, account system, or multiplayer system exists today.

In a future authoritative online deployment, the server owns hidden canonical World truth, canonical simulation time, and Process advancement. The client may animate or project progress, but it must not decide that canonical work completed. The same authority rule applies as autonomous actors, security responses, world changes, economy changes, and other persistent simulation systems are introduced. `core/game` remains pure and independent of React, browser scheduling, and transport in either deployment.

Gameplay that depends on hidden truth follows **UI → application/session operation → domain rules**, not **UI → inspect hidden World → decide gameplay**. Application/session operations must not assume synchronous in-process execution. Locally, an operation may read the latest canonical state and resolve after invoking the pure rule in-process. Online, an adapter may send the conceptual request to the server, where current authoritative state accepts, rejects, or resolves it and returns a player-visible result. The exact provider and transport contracts remain future work; this rule does not imply a command bus or runtime framework. The graphical Scan app establishes the concrete seam with `scanTarget(input)`: it consumes the closed `ScanResult`, while the local adapter alone constructs the domain's narrow Scan targets from `GameState`.

An online client must neither require nor receive the complete hidden World merely to execute gameplay. It receives only legitimately player-visible state: observations, Knowledge, Process/status projections, operation results, and concrete public or player-owned information. Exact projections remain future work. React may still read local/canonical state that is legitimately presentation-relevant in the offline prototype—such as player runtime state, Processes, Knowledge, and wallet data. This is not a rule that UI can never read `GameState`; it is an authority rule against gameplay decisions that require hidden World truth.

Online clients request operations rather than asserting validity. The authoritative simulation evaluates current truth and then accepts, rejects, or resolves the request. Observation-bound Service Analysis is the precedent for stale input: a player-visible endpoint plus expected stable identities is checked against current authoritative truth at execution, so stale or reused endpoints cannot silently retarget work.

Simulation identity remains distinct from account, authentication, connection, WebSocket/session, and transport identity. A canonical device ID identifies a simulated device independently of the lifetime or kind of actor controlling it. The current separation between `PlayerState.localDevice` and `WorldState.network.hosts` is useful for current gameplay but is not a permanent multiplayer invariant. A future player-controlled device may be a canonical World entity related to a player/actor (for example, a player could reference a controlled device ID); no actor, ownership, or unified-device model is implemented now.

Consequently, a future player-controlled device needs no special multiplayer Scan object. If it is represented in World state and legitimately observable, the same device observation semantics can surface it. Human control is separate actor/control state and must not automatically leak through Scan.

Terminal already receives narrow operations rather than unrestricted `GameState`. Terminal Scan and graphical Scan both invoke the same application/session `scanTarget` operation; only that adapter reads current World truth, applies the pure Scan rule, remembers its result in Discovery, and returns the `ScanResult`. No Terminal transport or generic RPC layer is warranted now.

## Shared operations and integrations

Gameplay verbs should normally be established through a shared domain/application operation and exposed first through Terminal; specialized apps may then add graphical affordances over that same operation. Terminal-first does not make Terminal the owner of gameplay logic: Terminal and GUI both call the shared boundary, the GUI never constructs a Terminal command string, and neither interface duplicates the domain rule.

A gameplay operation is implemented once behind an explicit game-level API and is callable from different interfaces. Network Analysis contains separate `scan` and `inspect` verbs that both narrowly accept a represented Device by valid IPv4 address or a LocalNetwork by exact player-visible name. `SELF` is the player-owned device, `LAN` is another device sharing a represented local network with SELF, and `REMOTE` is a represented device without that shared membership. Device Scan returns real network relationships and currently open owned services; network Scan returns responding represented members. Device Inspect returns only properties owned by that device, including its server identity where represented, but does not enumerate services; network Inspect returns its name and whether canonical membership connects SELF, without member enumeration. Stable device, network, and service IDs remain internal. Both pure operations independently derive closed structured results from current world truth. The graphical Scan UI browses canonical Discovery and invokes explicit observations through the narrow application operation rather than reading hidden World or constructing Terminal commands. Focus and Back navigation remain local presentation state. No generic entity, observation, resolver, or action framework is needed.

Commands are interface verbs, not installed tool objects or capabilities, and their presence does not prove that the player possesses the software, capability, position, access, or other conditions an operation requires. Future graphical applications and Terminal commands must call the same domain operations. Player-owned software or tools should influence those shared domain rules rather than create Terminal-only gameplay. Future Network Analysis upgrades may deepen observations derived from the same entities, but no general software inventory, capability framework, scanner-level, or upgrade system exists today.

External services must enter through explicit adapters or interfaces at the application boundary and must not become direct dependencies of core game-domain logic.

Terminal commands receive narrow, read-only values required by their behavior rather than unrestricted game state. Terminal presentation may retain a UI-local Process ID for a live command entry; progress, resource allocation, completion results, Knowledge, and DeviceAccess continue to come from canonical `GameState`. Terminal, Scan, and Processes synchronize by rendering that shared state, never through app-to-app events. Target Token local/external visual semantics describe reference context only and do not create gameplay target categories.

## Interface and mobile presentation

Terminal is intended to become the primary power-user operational interface, but it is not the game domain. Terminal and graphical apps must call the same domain operations directly; a GUI must not route gameplay through a Terminal command string. The current Terminal includes local informational and presentation commands plus the observational `scan <ipv4|network-name>` and `inspect <ipv4|network-name>` gameplay commands. It receives no unrestricted game state, and Network Analysis presentation remains separate from domain observation rules. Actionable player-visible world references may be marked by Terminal commands as Target Tokens. Target Tokens communicate possibility rather than target category, and are presentation metadata: they do not represent game state, entity identity, or persistent player knowledge. Their only V1 interaction copies the exact visible value; they never expose stable IDs, insert prompt text, or execute commands. A complete service endpoint is a Target Token because Analyze accepts it; service names, raw ports, protocols, and internal IDs are not. Analyze targets stable IDs after endpoint resolution. Stable identity does not promise permanent reachability semantics: V1 permits an open, retained service to resolve after a port change, while future operations may require current endpoint reachability. Inspect is contextual observation rather than a mandatory gate before Scan, Analyze, or future actions. Analyze performs deeper resource-driven investigation of a selected exposed surface and is one information-gathering route, not a mandatory pipeline for every future access path. Connect, exploit, access, and filesystem gameplay are not implemented.

Terminal and graphical applications are interchangeable interfaces over the same gameplay operations. A GUI may compose several existing operations into a simpler workflow for convenience, but it must not reimplement gameplay rules and must not construct or execute Terminal command strings internally.

The graphical Scan application reaches the same `scan` domain operation that Terminal exposes through its application/session boundary and invokes Service Analysis through an observation-bound game action. An action initiated from a Scan observation validates its player-visible endpoint and expected stable target and service IDs together: stable IDs do not authorize silently retargeting a stale or reused endpoint. A convenience action such as a quick analysis may sequence multiple domain operations, but the underlying mechanics, validation, target resolution, and state changes must remain shared.

This keeps gameplay independent from the current UI. Terminal may remain available as a precise power-user interface while graphical applications can provide more beginner-friendly access to the same capabilities without creating a parallel game implementation.

Mobile is a first-class presentation target. The shell owns viewport and Editing-presentation coordination, while individual scrollable regions explicitly own their scrolling. In the established text-entry layout, Terminal output scrolls independently of its prompt and the Notes textarea owns its own scrolling. These are presentation boundaries and must not leak browser or viewport concerns into `core/game`.

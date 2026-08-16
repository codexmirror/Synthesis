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

## Entity-owned simulation state

Simulated objects own their actual state. Gameplay operations observe or modify that state; interfaces must not invent parallel representations of it.

The world currently owns one concrete local-network entity with a stable ID and player-visible name. Its member device IDs are the single canonical membership relation; devices do not duplicate a network ID. A device is not its IP: the stable device ID remains identity while its IP is a mutable network address. Network scanning resolves the real network by its exact player-visible name and derives responding represented members from that canonical relation. Network inspection remains unsupported.

World truth exists independently of what the player can currently observe. Scan expands what is observable by producing structured observations from simulation truth; those observations may reveal real entities, relationships, or facts. An observation is not automatically an entity. Inspect explains a specific represented device and operates on that simulation object, never on an arbitrary scan-output record. Terminal output is not game state, and V0 does not permanently remember observations; persistent knowledge is deferred until gameplay requires it.

A computing entity may own domain state such as network identity, hardware, runtime, and—when a real gameplay mechanic requires it—a filesystem, software, services, or other device-specific state. These properties should be added only when they are needed by implemented gameplay rather than as placeholders.

Entity-owned state is the canonical source of truth. Terminal commands and graphical apps are interfaces over that same state. For example, when filesystems are introduced, a device’s files must belong to the simulated device rather than to the Files app. Terminal filesystem commands and the Files app must observe and modify the same underlying filesystem state.

The same principle applies to future gameplay mutations. Tools, malware, exploits, or other mechanics should change actual simulated state, and later observations should derive from the resulting state rather than from scripted UI effects.

Not every game entity must have every kind of state. A filesystem, services, software, network interfaces, or similar structures belong only to entity types and mechanics that actually require them. Synthesis should grow these models from concrete gameplay needs rather than introducing a universal entity or component framework prematurely.

## Shared operations and integrations

A gameplay operation is implemented once behind an explicit game-level API and is callable from different interfaces. Network Analysis currently contains the separate `scan` and `inspect` verbs. The application binds the current local device and world network to those pure operations and gives Terminal only narrow callable dependencies. IPv4 resolution is shared, while Scan separately resolves its one additional target kind: an exact local-network name. Scan returns a closed device-recon or network-discovery result; Inspect returns device detail. Both derive their distinct observations from current state without exposing entities directly to commands. Inspect can therefore report real self-device hardware while correctly limiting LAN and remote output to facts the remote host model owns. A future Network UI can call the same operations directly; it must not construct a Terminal command. Cross-feature effects should similarly flow through explicit domain actions or services rather than one feature mutating another feature's UI. No generic entity, observation, resolver, or action framework is needed.

Commands are interfaces, not installed tool objects or capabilities. Future Network Analysis upgrades may deepen observations derived from the same entities, but no scanner-level or upgrade system exists today.

External services must enter through explicit adapters or interfaces at the application boundary and must not become direct dependencies of core game-domain logic.

Terminal commands receive narrow, read-only values required by their behavior rather than unrestricted game state.

## Interface and mobile presentation

Terminal is intended to become the primary power-user operational interface, but it is not the game domain. Terminal and graphical apps must call the same domain operations directly; a GUI must not route gameplay through a Terminal command string. The current Terminal includes local informational and presentation commands plus the observational `scan <ipv4|network-name>` and device-only `inspect <ipv4>` gameplay commands. It receives no unrestricted game state, and Network Analysis presentation remains separate from domain observation rules. Connect and exploit operations are not implemented.

Terminal and graphical applications are interchangeable interfaces over the same gameplay operations. A GUI may compose several existing operations into a simpler workflow for convenience, but it must not reimplement gameplay rules and must not construct or execute Terminal command strings internally.

For example, a future graphical Network or Scan application may call the same `scan` and `inspect` domain operations that Terminal exposes. A convenience action such as a quick analysis may sequence multiple domain operations, but the underlying mechanics, validation, target resolution, and state changes must remain shared.

This keeps gameplay independent from the current UI. Terminal may remain available as a precise power-user interface while graphical applications can provide more beginner-friendly access to the same capabilities without creating a parallel game implementation.

Mobile is a first-class presentation target. The shell owns viewport and Editing-presentation coordination, while individual scrollable regions explicitly own their scrolling. In the established text-entry layout, Terminal output scrolls independently of its prompt and the Notes textarea owns its own scrolling. These are presentation boundaries and must not leak browser or viewport concerns into `core/game`.

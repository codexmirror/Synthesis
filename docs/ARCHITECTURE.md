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

Game state carries a schema version, but V0 does not implement saves or migrations. Stable internal IDs identify game entities. Mutable presentation or gameplay attributes—including IP addresses, display names, hostnames, and wallet addresses—must not serve as entity identity. In particular, `player.id` and network host IDs are stable identity, while their IPs are simulated network attributes.

Hardware specification is distinct from runtime utilization. Wallet state is likewise separate from player identity so each concern can evolve at its own boundary.

## Shared operations and integrations

A gameplay operation is implemented once behind an explicit game-level API and is callable from different interfaces. Basic Scan V1 establishes this path: the application binds the current network state to the pure scan operation and gives Terminal only that narrow callable dependency. A future Network UI can call the same operation directly; it must not construct a Terminal command. Cross-feature effects should similarly flow through explicit domain actions or services rather than one feature mutating another feature's UI. No generic action framework is needed.

External services must enter through explicit adapters or interfaces at the application boundary and must not become direct dependencies of core game-domain logic.

Terminal commands receive narrow, read-only values required by their behavior rather than unrestricted game state.

## Interface and mobile presentation

Terminal is intended to become the primary power-user operational interface, but it is not the game domain. Terminal and graphical apps must call the same domain operation directly; a GUI must not route gameplay through a Terminal command string. The current Terminal includes local informational and presentation commands plus the observational `scan <ipv4>` gameplay command. It receives no unrestricted game state, and scan presentation remains separate from the domain observation rule. Connect and exploit operations are not implemented.

Mobile is a first-class presentation target. The shell owns viewport and Editing-presentation coordination, while individual scrollable regions explicitly own their scrolling. In the established text-entry layout, Terminal output scrolls independently of its prompt and the Notes textarea owns its own scrolling. These are presentation boundaries and must not leak browser or viewport concerns into `core/game`.

# Architecture

Synthesis keeps a few practical dependency boundaries so that V0 can grow without introducing a framework prematurely.

## Module direction

- `core/game` contains only pure domain state and rules. It must not depend on React, browser APIs, the shell, or app UI.
- `app` contains the thin React adapter that creates a fresh game state for each client session and exposes it to the UI.
- `apps/<feature>` owns each feature's UI and local helpers. Features may consume game-domain APIs, but must not import another feature's internal UI implementation.
- `shell` registers, hosts, and navigates apps. Navigation is presentation state and the shell must not own gameplay rules.
- Shared styles contain reusable presentation concerns only; they must not contain game rules.

New game systems should normally become separate domain slices instead of expanding player state into the whole game. Browser-specific persistence stays at the feature/application boundary; for example, Notes owns its small storage adapter.

## Identity and state

Game state carries a schema version, but V0 does not implement saves or migrations. Stable internal IDs identify game entities. Mutable presentation or gameplay attributes—including IP addresses, display names, hostnames, and wallet addresses—must not serve as entity identity. In particular, `player.id` is stable identity while `player.ip` is a simulated network attribute. The same rule applies to future hosts and organizations without defining those models now.

Hardware specification is distinct from runtime utilization. Wallet state is likewise separate from player identity so each concern can evolve at its own boundary.

## Shared operations and integrations

A gameplay operation should eventually be implemented once behind an explicit game-level API and be callable from different interfaces. For example, a future terminal scan command and Network scan button should invoke the same domain operation; the Terminal must not reimplement the game. Cross-feature effects should similarly flow through explicit domain actions or services rather than one feature mutating another feature's UI. No generic action framework is needed in V0.

External services must enter through explicit adapters or interfaces at the application boundary and must not become direct dependencies of core game-domain logic.

Terminal commands receive narrow, read-only values required by their behavior rather than unrestricted game state.

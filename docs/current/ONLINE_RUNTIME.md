# Online identity and persistent shared world — current truth

Status: Accepted
Scope: Account authentication, Player/Device ownership, the online persistence boundary, shared-versus-private state ownership, and canonical server advancement.

This document is the normative owner for the first online runtime. Domain rules still belong to their existing current-truth owners: the runtime invokes those rules rather than defining online alternatives.

## Identity and authentication

An Account is authentication identity outside simulation truth. Its normalized name, salted `scrypt` password hash, and persistent HttpOnly session own no Device address and reveal no in-world identity. First valid use of a normalized name atomically creates an Account and a separately randomized Player; later use authenticates that same Player. A wrong password commits nothing.

A Player has stable identity, an explicit set of owned Device IDs, and `primaryDeviceId`. V0 creates exactly one owned NODE Device in the shared canonical Device registry. Primary Device resolution joins ownership to exactly that Device and fails closed for missing, duplicate, dangling, ambiguous, or non-owned identity. `player.localDevice` is composed from that Device only as a compatibility view; it is not separately persisted. Remote Session remains operating context and never changes Primary Device. Multiple Devices and Primary Device switching are deferred.

## Canonical ownership split

The server persists one versioned online document. It contains one canonical shared state for the authored Bookstore Company, Branch, backend, operations, cadence, foreign Network and Devices, Player-owned canonical Devices, the Market operator/catalog/offers, and Civic Dollar Provider/NPC/Company Accounts/Transactions. Separate Player records own Discovery, Knowledge, NodeMail and its stable personal Mail Account, NODE Wallet, Market purchase entitlements, personal Civic Dollar Account/Credential/Device-bound Sessions, processes, recent observations, and access/session operating state. Shared Market and Dollar owners are therefore never copied into Player records. Authenticated snapshots compose those shared owners with only the requesting Player's private owners. Account records, hashes, session hashes, ownership metadata for other Players, and every other Player's private record are never serialized in that snapshot.

The current snapshot remains a compatibility projection containing represented World Truth needed by the legacy interface. It is not an adversarial/public-production disclosure boundary; reducing all hidden NPC World bytes is deferred. It does not include another Player's private information.

## Player bootstrap and allocation

The server-owned monotonic allocator assigns each Player a distinct `10.64.N.0/24` Home Network. Random stable IDs independently identify the Player, NODE, Network, represented Router/default Gateway, and the Player-local `srv-01` tutorial server. Address attributes (`.23`, `.1`, and `.47`) are allocated from that persisted subnet and never determine identity. Account name and password participate in none of those values. Bootstrap adds those generated entities to the one World while retaining one copy of the authored remote Bookstore segment.

## Persistence and authority

V0 uses an atomic, mode-0600 JSON document behind a server persistence adapter; simulation objects are intentionally not normalized into arbitrary tables. `persistenceVersion` is 2 after the ownership correction. Corrupt or incompatible existing data aborts startup and is never silently replaced. Accounts, hashed sessions, allocator position, shared truth, Player truth, IDs, addresses, and accepted observation progress are committed before an operation reports success. Server stop/start resumes the committed state; stopped time is not caught up.

The real Terminal and NodeScan paths send authenticated `ping` and `scan` intent, never a replacement `GameState` or canonical patch. HTTP handlers resolve the session, Player and canonical Primary Device, then delegate to existing ping/scan/Discovery domain owners before committing. The response carries both the operation result and the newly committed Player snapshot; the mounted provider replaces its read projection with that authoritative snapshot and never performs an optimistic Discovery write. Other mutating actions fail explicitly in online mode until moved behind an intent rather than pretending to persist.

The server owns one idempotently started 250 ms clock, independent of connected-client count. Each step advances shared Bookstore/World truth exactly once through `advanceGameState`. Authenticated V0 admits only immediate PING and SCAN mutations; all Process-creating and other timed Player mutations are explicitly unavailable online. Player Process advancement is deferred until its full cross-domain consequences can be retained without discarding remote Device-owned World writes. Stopped time is not caught up.

Production server hosting is deferred. Vite development selects online mode, and a server-hosted production build can opt in with `VITE_SYNTHESIS_ONLINE=1`. The ordinary GitHub Pages production artifact deliberately remains the existing offline/local prototype so it never presents a login backed by a nonexistent `/api`.

Authentication uses validated normalized names, slow salted password hashing, cryptographically random bearer material, SHA-256 session-token storage, timing-safe password verification, and a same-origin HttpOnly/SameSite cookie. Account recovery, OAuth, MFA, profiles, administration, public deployment hardening, and cross-origin credential support are deferred.

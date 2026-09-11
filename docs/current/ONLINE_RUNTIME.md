# Online identity and persistent shared world — current truth

Status: Accepted
Scope: Account authentication, Player/Device ownership, the online persistence boundary, shared-versus-private state ownership, and canonical server advancement.

This document is the normative owner for the first online runtime. Domain rules still belong to their existing current-truth owners: the runtime invokes those rules rather than defining online alternatives.

## Identity and authentication

An Account is authentication identity outside simulation truth. Its normalized name, salted `scrypt` password hash, and persistent HttpOnly session own no Device address and reveal no in-world identity. First valid use of a normalized name atomically creates an Account and a separately randomized Player; later use authenticates that same Player. A wrong password commits nothing.

A Player has stable identity, an explicit set of owned Device IDs, and `primaryDeviceId`. V0 creates exactly one owned NODE Device. Primary Device resolution fails closed for missing, duplicate, dangling, or non-owned identity. Remote Session remains operating context and never changes Primary Device. Multiple Devices and Primary Device switching are deferred.

## Canonical ownership split

The server persists one versioned online document. It contains one canonical shared state for the authored Bookstore Company, Branch, backend, operations, cadence, foreign Network and Devices, and separate Player-private records. Player-private records own Discovery, Knowledge, NodeMail, NODE Wallet, Market entitlements, starter Civic Dollar identity/session, processes, recent observations, access/session operating state, and the Primary Device projection used by current gameplay adapters. Authenticated snapshots compose the one shared state with only the requesting Player's private record. Account records, hashes, session hashes, and every other Player's private record are never serialized in that snapshot.

The current snapshot remains a compatibility projection containing represented World Truth needed by the legacy interface. It is not an adversarial/public-production disclosure boundary; reducing all hidden NPC World bytes is deferred. It does not include another Player's private information.

## Player bootstrap and allocation

The server-owned monotonic allocator assigns each Player a distinct `10.64.N.0/24` Home Network. Random stable IDs independently identify the Player, NODE, Network, represented Router/default Gateway, and the Player-local `srv-01` tutorial server. Address attributes (`.23`, `.1`, and `.47`) are allocated from that persisted subnet and never determine identity. Account name and password participate in none of those values. Bootstrap adds those generated entities to the one World while retaining one copy of the authored remote Bookstore segment.

## Persistence and authority

V0 uses an atomic, mode-0600 JSON document behind a server persistence adapter; simulation objects are intentionally not normalized into arbitrary tables. `persistenceVersion` starts at 1. Corrupt or incompatible existing data aborts startup and is never silently replaced. Accounts, hashed sessions, allocator position, shared truth, Player truth, IDs, addresses, and accepted observation progress are committed before an operation reports success. Server stop/start resumes the committed state; stopped time is not caught up.

The browser sends authenticated intent, currently `ping` or `scan`, never a replacement `GameState` or canonical patch. HTTP handlers resolve the session and delegate to existing ping/scan/Discovery domain owners before committing. The server owns one idempotently started 250 ms advancement loop for the shared canonical world, independent of connected-client count. Expanding the intent catalog to every existing UI mutation without duplicating domain rules is required before adversarial public-alpha use.

Authentication uses validated normalized names, slow salted password hashing, cryptographically random bearer material, SHA-256 session-token storage, timing-safe password verification, and a same-origin HttpOnly/SameSite cookie. Account recovery, OAuth, MFA, profiles, administration, public deployment hardening, and cross-origin credential support are deferred.

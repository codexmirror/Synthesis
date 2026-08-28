# DOLLAR FINANCIAL PROVIDER V1

Status: Accepted
Scope: Design authority for the first concrete Dollar Financial Provider
composition — Financial Provider, Financial Account, Credential,
authentication, and Device-bound Financial Session — and for the canonical
Dollar monetary representation that composition assumes. It is a design
contract, not a description of what is currently implemented.
Normative owner of current implemented behavior: `../current/DOLLAR_FINANCE.md` (Dollar state, operations, and Wallet presentation) and `../current/DEVICE_SYSTEM.md` (Devices and `GameState` areas).

## Status and purpose

This document freezes the semantic boundaries of the first concrete Dollar
Financial Provider so that the next implementation slice is deterministic and
does not have to reopen the identity and authority model.

It does not replace:

- [`../current/NODE_ECONOMY.md`](../current/NODE_ECONOMY.md) as current
  implemented economic truth;
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) and
  [`../architecture/ECONOMY_AND_WALLETS.md`](../architecture/ECONOMY_AND_WALLETS.md)
  (A18) as durable architecture authority;
- [`../FUTURE.md`](../FUTURE.md) as broader long-term direction;
- an explicitly selected work order as implementation scope.

Durable economic invariants stay in A18. This document selects one concrete
composition that must respect them; where A18 already states a rule, this
document references it instead of restating it.

The V1 foundation described here is implemented. `../current/DOLLAR_FINANCE.md` owns the exact current composition and operation behavior.


## 1. Pre-implementation baseline

Historical baseline verified when this contract was accepted:

- Dollars are canonical state (`GameState.wallet`), but only as a single
  balance number. There is no represented provider, account, credential,
  authentication or session behind it, and Dollars keep no activity history.
- The Wallet application presents that Dollar balance directly, formatted with
  a `$` prefix and thousands separators.
- NODE is separately canonical (`GameState.nodeWallet`, `GameState.nodeEconomy`)
  with its own stable Wallet identity, mutable address attribute, integer
  atomic-unit balance and received-activity history.
- One Wallet application presents both, and that presentation composition
  already owns no economic truth of its own.
- `DeviceAccess` and `RemoteSession` exist for Devices (A07, A08). Neither has
  any economic meaning today.

Two consequences follow for the implementation slice, and both are deltas, not
current truth:

1. The canonical Dollar value becomes an exact integer minor unit (cents,
   section 8). Today's `1250` is a whole-dollar number presented as `$1,250`;
   the same represented wealth is `125000` cents afterwards. Choosing that
   conversion is the implementation slice's job.
2. A Financial Account, not the Wallet slice, becomes the canonical owner of
   the Dollar balance the interface resolves.

The implemented current truth now belongs to `../current/DOLLAR_FINANCE.md`; this baseline remains design history.


## 2. V1 is one concrete provider

V1 represents exactly one concrete Dollar Financial Provider. It is a named
represented financial service in the world, not a plugin, not an entry in a
provider registry, and not an instance of a provider abstraction.

Per A16, a second provider is what would justify a shared abstraction — not
the anticipation of one. Until a second concrete provider is actually
implemented and demonstrates the same requirement, "provider" is a concrete
represented thing, not a framework seam.

Composition:

```text
ONE CONCRETE DOLLAR FINANCIAL PROVIDER
        │
        ├── FINANCIAL ACCOUNTS
        │     ├── stable Financial Account identity
        │     ├── provider/account addressing or reference attributes
        │     └── canonical integer-cent Dollar balance
        │
        ├── CREDENTIALS
        │     ├── login identifier
        │     └── password
        │
        └── FINANCIAL SESSIONS
              ├── authority for exactly one Financial Account
              └── bound to exactly one client Device
```

Concrete type names are an implementation decision, except where this document
names a distinction that must survive (Financial Account identity, Credential,
Financial Session).


## 3. Financial Account identity

A Financial Account is a represented economic entity held at the Provider. Its
identity is a stable internal ID (A01, A18).

None of the following changes which Account it is:

- a password change;
- credential replacement or rotation;
- a login-identifier change;
- authentication;
- Financial Session creation;
- Financial Session replacement or refresh;
- logout;
- loss of a Device;
- a change in which Device currently holds authority for the Account.

Four concerns stay distinct and must never collapse into one another:

| Concern | What it is | What it is not |
| — | — | — |
| Financial Account ID | stable financial domain identity | a user-facing value, a login, an address |
| Account number / provider reference | addressing or user-facing attribute of the Account | Account identity |
| Login identifier | authentication material — how a credential names the Account it authenticates against | Account identity |
| Password | authentication secret | Account identity, and not authority |

A username, login identifier, account number, Device ID or Player ID must never
become the implicit primary key of a Financial Account. Resolving an Account
from an addressing attribute is a lookup, and a lookup that finds nothing finds
nothing — it never invents an Account.

For that lookup to be deterministic, V1 requires uniqueness **within the one
concrete Provider**:

- the login identifier is unique within this Provider, so a credential resolves
  to at most one Account and an authentication attempt is never ambiguous;
- any account number or provider reference used as an Account-addressing lookup
  is unique within this Provider, so addressing resolves to at most one Account;
- both remain mutable attributes of the Account, never its stable identity, and
  changing either changes nothing about which Account it is.

Uniqueness is a property this one Provider's represented Accounts satisfy, not
a mechanism: V1 introduces no uniqueness framework, identifier registry, index
abstraction or provider namespace system. Ambiguity is a modelling error to
prevent, never something an operation resolves by picking one candidate.


## 4. Credentials

A Credential is authentication material for this Provider.

- One Account initially has one concrete login credential.
- A Credential carries a login identifier and a password.
- A Credential authenticates against a Financial Account; it is not the
  Account, and it does not contain the Account's economic state.
- A Credential is not a Financial Session.
- A Credential grants nothing merely by existing, and nothing merely by being
  known.
- Discovering literal credential values never mutates Account ownership,
  Account identity, or any balance.

Credentials are deliberately narrow. V1 does not introduce a global
`KnownCredentials` registry, a generic secret inventory, a password-manager
framework, a reusable IAM credential hierarchy, or a generic authentication
framework. This is also unrelated to the existing Credential Access mechanic
against Device services, which stays where it is
(`../current/NETWORK_ACCESS.md`) and gains no financial meaning.

Future gameplay may expose literal credential material through represented
systems such as Files, Notes or Mail. Those acquisition mechanics are out of
scope. This contract only needs to define what happens when authentication is
attempted with concrete credential material.


## 5. Authentication is not authority

Freeze the rule:

> Successful authentication may create or refresh Financial Authority.
> Authentication itself is not Financial Authority.

```text
CREDENTIAL
      +
AUTHENTICATION
      ↓
FINANCIAL SESSION
      ↓
AUTHORIZED FINANCIAL OPERATIONS
FOR ONE CONCRETE ACCOUNT
FROM ONE CONCRETE DEVICE
```

Therefore, none of the following is Financial Authority:

- knowing a login identifier;
- knowing a password;
- knowing both — that permits an authentication attempt, not persistent
  authority;
- Financial Account identity;
- `DeviceAccess`;
- `RemoteSession`;
- Player identity;
- possession or operation of a Device.

Only a represented Financial Authority mechanism may authorize provider or
account operations. In V1 that mechanism is the Financial Session, and there is
no second one. An operation that cannot name the Session authorizing it is not
authorized.

Authentication is an operation with an outcome, not stored authority. It never
writes a "logged in", "authenticated", "account hacked" or equivalent verdict
flag anywhere.

> The only V1 authority consequence of successful authentication is a Financial
> Session.

Concretely: successful authentication creates, replaces or refreshes the acting
Device's Financial Session for this Provider (section 6). Failed authentication
creates no Financial Session and no authority of any kind.

That statement is about **authority**, not a claim that authentication may never
have other represented consequences. Future represented consequences —
provider-side audit records, Device or Provider logs, security signals — are
simply not part of V1. Each would be its own concrete represented mechanic with
its own owner and its own authority, and none of them may become a second path
to authorizing an account operation. None of them is designed here.


## 6. The Financial Session contract

A Financial Session:

- authorizes operations for exactly one Financial Account;
- belongs to exactly one Financial Provider context;
- is bound to exactly one client Device;
- must not silently transfer to another Device;
- may be invalidated by logout;
- may be replaced or refreshed by successful authentication, without changing
  Account identity;
- is authority, not ownership;
- is not a Credential;
- does not imply that the Device knows or stores the password;
- does not imply that the Player knows the password;
- never reveals the password merely because it exists.

Loss or invalidation of a Session:

- does not change Financial Account identity;
- does not change the Account's balance;
- does not delete or alter Credentials;
- does not imply that Credentials were forgotten, rotated or revoked.

> A Financial Session is revocable authority bound to one Device and one
> Financial Account.

Two Devices may each hold their own Session for the same Account, each created
by its own successful authentication. There is no global "the session" for an
Account, and one Device's logout never invalidates another Device's Session.

V1 also fixes the other direction of that cardinality, because the Finance
client must be able to answer "signed in as which Account?" from Session truth
alone:

> A Device holds at most one active Financial Session for the one concrete
> Dollar Financial Provider.

Therefore, on one Device:

- successful authentication where that Device has no Provider Session creates
  one;
- successful authentication where that Device already has a Provider Session
  replaces or refreshes that Session rather than adding a second
  simultaneously active one;
- authenticating to a *different* Account changes that Device's current
  Provider Session; it does not create parallel per-Account Sessions;
- logout invalidates that Device's active Provider Session only.

Sessions on other Devices are untouched by any of it, and no global Session
exists. A Device therefore resolves at most one current Provider Account, and
SIGNED IN / SIGNED OUT (section 7) has exactly one candidate to derive from.

Whether replacement or refresh preserves the Session's own ID is deliberately
not selected here; that is implementation-owned, since no V1 rule depends on it.
Out of scope, and a future design change rather than an implementation
liberty: multi-account client sessions, account-switching history, session
stacks, and any session-manager framework.

V1 selects **no** time-based expiry model. A Financial Session ends because
something represented ends it, not because time passed. Out of scope
accordingly: expiry timers, token lifetimes, refresh-token protocols, session
TTL, OAuth semantics, MFA, and device trust scores. Do not describe V1
Financial Sessions as necessarily time-limited.

A Financial Session is also not a `RemoteSession`. `RemoteSession` is an
operating context over a Device (A07); a Financial Session is authority over an
Account at a Provider. They are separate state with separate lifecycles, and
neither creates, extends or invalidates the other.


## 7. Player, Device and Account are separate namespaces

Player, Device and Financial Account are three distinct identity namespaces.

Even where V1 seeds one Player with one legitimate Dollar Financial Account,
none of the following is true:

- Player == Financial Account owner identity;
- Player ID == Financial Account ID;
- Device ID == Financial Account ID;
- Account ownership == the current Financial Session.

A Player may legitimately be associated with an Account, but gameplay identity
and Provider Account identity remain separate. The next implementation slice
must not introduce an Account `ownerId` whose meaning silently overlaps Player
ID, Device ID and Account ID; where a relationship is needed, it is a
represented relationship, not a re-labelled identity.

A compromised Device does not compromise the Accounts associated with its user.
What a Device can legitimately expose is a concrete Financial client that is:

```text
FINANCE — SIGNED IN
→ a valid Financial Session for this Device exists

FINANCE — SIGNED OUT
→ no valid Financial Session for this Device exists
```

That state is derived from represented Session truth, per A11 (mutate causes,
derive consequences), and the Account a signed-in client presents is the one
its Device's single Provider Session authorizes (section 6). It is not a stored
`signedIn` flag, and it is never special-cased from account ownership. This is
the design authority a future ordinary NPC Device would rely on; neither that
Device nor its Firmware is in scope here.


## 8. Device access is not financial authority

```text
DEVICE ACCESS
      ≠
FINANCIAL AUTHORITY
```

Holding `DeviceAccess` to a Device, or operating it through a `RemoteSession`,
never creates a Financial Session and never authorizes an Account operation.
A08 already forbids access from implying downstream capability; this contract
states the economic case of it.

The legitimate future path is the opposite direction: whoever operates a Device
may be able to *use a Financial Session that already exists on that Device*,
through represented software, exactly as its rightful operator would — with the
same Session, the same single Account, and the same absence of the password.
That is use of represented authority, not acquisition of ownership.

It must therefore never be expressed as `accountHacked`,
`financialAccessBecauseDeviceHacked`, `ownerChanged`, or `playerOwnsAccount`.
None of that behavior is implemented by this design; only the boundary that
keeps it possible later without ownership magic.


## 9. Canonical Dollar money is integer cents

Canonical Dollar monetary state is an exact integer number of cents (A18).

```text
$12.34   → presentation / input
1234     → canonical domain value
```

Floating-point or decimal Dollar values must never become canonical Financial
Account balance truth. Formatting and parsing are presentation and input
concerns and belong to the interface, exactly as human-readable NODE formatting
already does.

V1 is Dollars only. No arbitrary precision, foreign currencies, exchange rates,
taxes or accounting rules.


## 10. Dollar and NODE are separate authority domains

```text
DOLLAR
FINANCIAL PROVIDER
→ Financial Account
→ Credentials
→ authentication
→ Device-bound Financial Session
→ Financial Authority

NODE
NODE Wallet
→ wallet-specific address and economic state
→ future wallet/key/secret/passphrase authority semantics
```

The existing NODE system is current truth and is not redesigned, renamed or
re-parented by this contract.

Freeze the negative invariant:

- No Dollar Credential, Financial Session, Financial Account, Player
  relationship or Device relationship grants NODE authority.
- No NODE Wallet, NODE address, NODE key, NODE secret or future NODE authority
  grants Dollar Financial Authority.
- There is no implicit authority bridge between Dollar and NODE.

A Finance/Wallet application may present both in one interface:

```text
FINANCE
├── DOLLAR
│   └── provider / account / session semantics
└── NODE
    └── wallet / key semantics
```

Presentation may aggregate them. Canonical truth never does: no shared
`FinanceAccount`, no universal money owner, no combined authority object
(A18).


## 11. Identity and authority matrix

| Concept | Identity domain | Grants Dollar Financial Authority alone? | Device-bound? |
| — | — | — | — |
| Player | gameplay identity | No | No |
| Device | machine / runtime identity | No | It *is* the machine identity a Session binds to |
| `DeviceAccess` | relationship between a source and a target Device | No | Relationship, not an attribute of either Device |
| `RemoteSession` | operating context over a Device | No | Bound to its `DeviceAccess`, not to any Account |
| Financial Provider | represented financial service | No | No |
| Financial Account | financial domain identity | No — identity is not authority | No |
| Account number / login identifier | addressing / authentication material | No | No |
| Credential (login identifier + password) | authentication material | No — it permits an authentication attempt | No |
| Financial Session | Dollar financial authority | **Yes** — the only V1 mechanism | **Yes** — exactly one Device, and at most one per Device for this Provider |
| NODE Wallet / future NODE secret authority | separate crypto domain | No Dollar authority; separate NODE semantics | separate NODE semantics |

Note on `DeviceAccess`: it is an established relationship between stable
entities (A08), not something a Device identity owns and not a property that
travels with a Device. Its row above describes that relationship, and nothing
in this contract changes it.


## 12. Transactions are positioned, not designed

Transactions conceptually belong to the Financial Provider / Financial Account
domain rather than to a Device, an interface, or the Player.

That is the entire V1 statement about them. Their persistence model, transfer
semantics, transaction identity, ordering, settlement, reconciliation,
reversal, pending states, fees, merchant routing, statements and retention are
out of scope.

Do not add a ledger architecture because transactions will exist later, and do
not manufacture transaction history in current truth (A03: represented truth is
what actually happened). Dollars keep no history until a concrete mechanic
produces one.


## 13. Explicitly out of scope for V1

Generic IAM; OAuth; MFA; refresh tokens; token rotation protocols; any Session
expiry model; a provider framework or registry; generic multi-provider support;
banks as interchangeable plugins; a generic Credential Knowledge registry; a
password-manager framework; a banking simulator; a transaction ledger;
settlement; reconciliation; a fraud, detection or risk engine; taxes; exchange
rates; currencies other than Dollar; merchant payment routing; money transfers;
purchase mechanics; an ordinary NPC Device; Ordinary Phone Firmware; merchant
gameplay; credential stealing; password cracking; any NODE authentication
redesign; NODE passphrase or key implementation; a universal Finance account;
an `accountHacked` flag; and a generic `FinancialAccess` abstraction unless a
later slice proves a distinct concrete concept is actually required.

The Financial Session is the only authority concept V1 introduces. Adding a
second one is a design change, not an implementation detail.


## 14. What the next implementation slice inherits

Frozen here, and not to be reopened by the implementation:

- one concrete Provider, no provider abstraction;
- stable Financial Account identity, separate from every addressing and
  authentication attribute;
- Credential as authentication material only;
- authentication as an operation whose only V1 authority consequence is a
  Session, and which never stores a verdict flag;
- the Financial Session as the single, revocable, one-Account,
  one-Device authority mechanism, with no expiry model and at most one active
  Session per Device for this Provider;
- integer-cent canonical Dollar money;
- Dollar and NODE as separate authority domains that presentation may show
  together;
- Player, Device and Account as separate identity namespaces.

Left to the implementation slice, because they are concrete choices rather than
semantic boundaries: type and field names; where the represented Provider,
Accounts, Credentials and Sessions live in `GameState`; the seeded Provider
name, Account, credential values and starting cent balance (including how
today's `1250` converts); the shape of the authentication and logout
operations and their result statuses; whether replacing or refreshing a Device's
Session preserves that Session's ID; and how the Wallet/Finance interface
resolves the Account through a legitimate Session, including what it shows when
no Session exists.


## 15. Contract self-test

The frozen contract must answer each of these unambiguously; each is answered
by the section named.

| # | Question | Answer |
| — | — | — |
| 1 | Can an Account survive password/login changes without changing identity? | Yes (3) |
| 2 | Can someone know correct credentials without holding a Session? | Yes — knowledge permits an attempt only (4, 5) |
| 3 | Can a Device hold a valid Session without knowing the password? | Yes (6) |
| 4 | Can logout remove authority without changing Account or Credential truth? | Yes (6) |
| 5 | Can two Devices authenticate independently to one Account? | Yes, one Session each; no global Session (6) |
| 6 | Can `DeviceAccess` exist without Financial Authority? | Yes (8) |
| 7 | Can Financial Authority exist without Device ownership? | Yes — authority binds to a Device, ownership is not represented by it (6, 8) |
| 8 | Does a Session authorize exactly one Account from exactly one Device? | Yes (6) |
| 9 | Does Player identity stay separate from Account identity? | Yes, even with one seeded legitimate Account (7) |
| 10 | Is canonical Dollar money integer cents only? | Yes (9) |
| 11 | Is NODE authority independent of Dollar authority? | Yes, in both directions (10) |
| 12 | Can a future Device present FINANCE — SIGNED IN / SIGNED OUT from Session truth alone? | Yes, derived, no ownership special case (7) |
| 13 | Can the implementation avoid an Account `ownerId` overlapping Player/Device/Account ID? | Yes — required (7) |
| 14 | Does this avoid turning one provider into a provider framework? | Yes (2, 13) |
| 15 | Can one Device resolve exactly one current Account from Session truth? | Yes — at most one Provider Session per Device (6) |
| 16 | Can duplicate login identifiers make authentication ambiguous? | No — provider-scoped uniqueness (3) |
| 17 | Does V1 forbid future audit or log consequences of authentication? | No — they are out of scope, not prohibited (5) |

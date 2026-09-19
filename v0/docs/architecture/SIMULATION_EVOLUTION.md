# Shared-world Authority, External Actors, and Abstraction Discipline

Status: Accepted
Scope: Where authoritative simulation may live in future deployments, how external or
community actors may interact with the world, and the rule that concrete
mechanics precede generic frameworks.

Normative owner for architecture invariants A14, A15 and A16. `docs/ARCHITECTURE.md` is the
index and precedence entry point; it summarizes these invariants and must not
redefine them.


## A14 — Shared-world authority remains explicit

The current browser implementation may execute canonical simulation locally,
but client-side authority is not a permanent multiplayer requirement.

A future authoritative deployment may move hidden canonical World Truth,
simulation time, Process advancement, autonomous actors, economy, and other
persistent simulation state to a server.

The durable flow is:

```text
INTERFACE
    ↓
APPLICATION / SESSION OPERATION
    ↓
AUTHORITATIVE DOMAIN RULE
    ↓
PLAYER-VISIBLE RESULT
```

A future online client should not require complete hidden World Truth merely to
request gameplay operations.

Clients request operations; they do not assert that hidden conditions are
valid.

Account identity, transport identity, simulated entity identity, player
identity, Device identity, and Session identity must remain conceptually
separate.

This rule does not require a server, RPC framework, command bus, or networking
architecture today.


## A15 — Community or external actors do not receive privileged world mutation

If Synthesis later supports community-authored software, Firmware,
organizations, services, markets, scenarios, or other extensions, they should
interact through explicit supported simulation boundaries where practical.

Prefer:

```text
ACTOR / ORGANIZATION / PRODUCT
        ↓
AUTHORIZED OPERATION
        ↓
CANONICAL STATE TRANSITION
        ↓
NORMAL SYSTEMIC CONSEQUENCES
```

over:

```text
SPECIAL NAMED ACTOR
        ↓
ARBITRARY GAMESTATE MUTATION
        ↓
SCRIPTED WORLD OUTCOME
```

An important product, company, Firmware, Tool, or community group may be unique
content without requiring unique laws of simulation.

This invariant does not define a mod API, plugin interface, scripting system,
permission framework, organization model, or extension schema.


## A16 — Concrete mechanics before generic frameworks

Do not generalize a hypothetical future system before concrete implementations
demonstrate the shared requirement.

Avoid introducing speculative:

- universal entity models
- generic capability engines
- generic action/effect engines
- generic relationship engines
- generic reachability engines
- generic causality frameworks
- generic persistence frameworks
- generic Firmware frameworks
- generic Session frameworks
- generic software inventory frameworks
- plugin systems
- event buses
- ECS
- dependency-injection frameworks

A small amount of concrete duplication is preferable to a premature universal
abstraction.

Extract shared abstractions after multiple implemented systems reveal the same
real requirement.

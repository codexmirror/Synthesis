# Identity, Entity-owned Truth, and Player Information

Status: Accepted
Scope: Stable identity, entity-owned simulation truth, the World Truth / Discovery /
Knowledge separation, epistemic observation roles, remembered observations, and
validation of stale player input.

Normative owner for architecture invariants A01, A02, A03, A04 and A09. `docs/ARCHITECTURE.md` is the
index and precedence entry point; it summarizes these invariants and must not
redefine them.


## A01 — Stable identity

Stable internal IDs are canonical entity identity.

Mutable or player-visible attributes must not become identity, including:

- IP addresses
- ports
- network names
- display names
- hostnames
- labels
- wallet addresses

A represented object’s address, name, presentation, ownership, reachability, or
other mutable state may change without changing which entity it is.


## A02 — Entity-owned simulation truth

Represented simulation state belongs to the entity or relationship whose state
it describes.

Interfaces must not create competing gameplay truth merely because a local copy
would be convenient.

Prefer:

```text
CANONICAL STATE
      ↓
MULTIPLE INTERFACES
```

over:

```text
TERMINAL STATE
FILES APP STATE
SCAN APP STATE
OTHER UI STATE
```

Semantic ownership does not require every property to be physically nested
inside one TypeScript object. It means there is one authoritative represented
truth.


## A03 — Separate world truth from player information

These concerns are distinct:

| Concern | Meaning |
| — | — |
| World Truth | What currently exists and is true in the simulation |
| Discovery | Positive remembered observations about known space |
| Knowledge | Deeper learned or interpreted information |
| Capabilities | Ways the player can currently attempt to interact |
| Relationships | Access, sessions, ownership, trust, or similar represented connections |
| Reachability / position | What can currently be interacted with from a given position |

Do not collapse them into a single generic state or unlock model.

Changing World Truth does not automatically rewrite historical Discovery or
Knowledge.

Learning something does not automatically create access, capability, or
reachability.


## A04 — Player-visible belief is not hidden truth

Interfaces may reason from information the player legitimately possesses.

They must not silently use hidden current World Truth to reveal whether a
player’s stale belief is correct.

A player may reasonably believe an action is possible while current World Truth
causes the attempt to fail.

Therefore:

```text
PLAYER-KNOWN FEASIBILITY
        ≠
ACTUAL FEASIBILITY
```

A disabled button, missing action, warning, or other presentation must not leak
hidden truth unless the player has information that justifies that conclusion.


## A09 — Observation operations have distinct epistemic roles

Observation must remain separate from browsing remembered information.

Opening or navigating remembered data is not itself a new observation.

The durable conceptual roles are:

```text
SCAN
explore outward / discover adjacent objects or relationships

INSPECT
observe the current intrinsic state of a specific known object

ANALYZE
perform deeper, potentially resource-consuming investigation
```

Exact observation depth belongs to the currently implemented mechanic and is
documented in `docs/V0.md`.

These verbs must not become a mandatory universal pipeline.

Knowledge obtained through one path does not imply that every target must be
processed through the same sequence.


## Discovery and remembered observations

Discovery represents positive remembered observation, not omniscient World
Truth.

Browse is not Observe.

A UI may project remembered relationships as a tree, hierarchy, atlas, graph
projection, or other understandable presentation without making that
presentation structure canonical ownership.

A relationship displayed as parent/child in an interface is not automatically a
parent/child domain relationship.

Re-observation may update legitimately observed positive information.

Failure or absence must not silently erase historical knowledge unless a
concrete mechanic explicitly establishes that the player learned the earlier
information was no longer valid.

Historical observations that identify a mutable endpoint must retain the
identity and attributes actually observed rather than silently retargeting to a
different current entity.


## Operations and stale input

Operations initiated from player-visible observations must validate the
identities and player-visible references required by that operation against
authoritative current state.

Stable identity prevents accidental identity drift.

It must not become permission to silently retarget stale player input.

A stale endpoint, address, relationship, or observation may cause an operation
to fail even when the stable entity still exists.

The exact validation required belongs to the concrete mechanic.

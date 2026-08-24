# SOFTWARE AUTHORING

Status: Accepted
Scope: Agent-neutral design contract for adding or changing a represented
software product, release, package, installation, executable, or its
player-facing release documentation and presentation.
Normative owner of current implemented behavior: `docs/current/FILES_SOFTWARE.md`
(artifacts, installation, removal, execution) and `docs/current/NODE_ECONOMY.md`
(represented economic behavior of a release).

This contract defines vocabulary, boundaries, and authoring rules. It does not
authorize a SoftwareRegistry, a software framework, or a UI refactor.


## The six distinct concepts

Software in Synthesis is not one object. Six concerns stay separate, and each
exists at a different moment.

```text
SOFTWARE PRODUCT
      ↓ has releases
SOFTWARE RELEASE
      ↓ distributed as
SOFTWARE PACKAGE          artifact on a Device filesystem
      ↓ installation Process completes
INSTALLED SOFTWARE        Device-owned installed state
      ↓ where represented
EXECUTABLE                concrete runnable artifact
      ↓ RUN admission
GAME PROCESS              runtime work
```

Preserve, always:

```text
PACKAGE ≠ INSTALLED SOFTWARE ≠ EXECUTABLE ≠ PROCESS
```

### Software product

- Stable product identity (`productId`), never derived from a name, filename,
  path, or version.
- Represents a gameplay purpose: what this product is for in the world.
- One product may supply several interface verbs, and several products may
  overlap in capability (A06).

### Software release

- Stable, opaque release identity (`releaseId`), distinct from the product ID
  and from any display string.
- Version, and channel where represented (for example `standard`,
  `experimental`, `unofficial`).
- Publisher / provenance where represented.
- Display name, version and channel are release presentation metadata, not
  identity.
- Concrete represented behavior belongs to the release, not to the product: two
  releases of one product may legitimately behave differently.

### Software package

- The artifact *before* installation: a file on a Device-owned filesystem.
- Carries the release identity it represents, plus its represented size.
- Its path is its current location, never its identity. Copying it anywhere
  preserves kind, product, release, name, version, publisher and size.
- Whether an operation is willing to admit it from a given path is recognition
  owned by that operation — never a property of the artifact, and never a
  reason to rewrite or reclassify it.

### Installed software

- Device-owned installed state, listed on the Device that owns it.
- Created only when an installation Process completes, never at admission.
- Not Firmware, not a filesystem artifact, not a Process.

### Executable

- The concrete runnable artifact, where a product represents one.
- Carries its own program and release identity, so a stale or replaced artifact
  can be recognized as not the release something was admitted against.
- Installed-software metadata alone never conjures a missing executable into
  existence.

### Game process

- Runtime work admitted from an executable (or from another gameplay
  operation), owned by an executor Device.
- Never `InstalledSoftware` itself. Removing installed software does not stop a
  running Process unless a concrete mechanic says so.


## Player-facing release information

Represented releases may carry static player-facing documentation. It is
descriptive presentation. It is never gameplay authority, and it must never
disclose hidden target or runtime truth.

**ABOUT** — a concise answer to "what is this software?". Ideally one short
statement. Not marketing copy, not a feature list.

**CAPABILITY** — a concrete, currently represented, player-facing capability:
a concise label plus a precise description. Never claim gameplay behavior the
game does not actually represent.

**CHANGE** — a release-specific change or history entry. Not marketing, not a
roadmap, not a promise about future releases.

```text
RELEASE DOCUMENTATION ≠ GAMEPLAY AUTHORITY
```

If a capability description and the implemented operation disagree, the
implemented operation is the truth and the description is a bug.


## Software presentation hierarchy

Any surface that presents software follows the same three levels. Level 1 is
always visible; level 2 depends on the surface; level 3 is progressive
disclosure and closed by default.

**LEVEL 1 — always / primary**

- product identity
- version and channel where relevant
- current state
- the primary action

**LEVEL 2 — contextual**

- Files: filename, path, size as appropriate
- Install review: target Device, the concrete package, current installed state
- System: installed / removing / restoring state

**LEVEL 3 — progressive disclosure**

- About detail
- capability descriptions
- changes
- publisher / provenance detail
- release ID

Level 3 is available, not permanently expanded. It can be opened and closed
again.

This hierarchy guides future UX and agent work. It does not authorize a
redesign of the current React surfaces on its own.


## Authoring checklist

Before adding or changing a represented product or release:

1. Does the product have a stable `productId` independent of its name and path?
2. Does the release have its own opaque `releaseId`, distinct from the product
   ID and from any display string?
3. Are version, channel and publisher represented as release presentation
   metadata rather than identity?
4. Is every concrete behavior attached to the release that actually has it,
   rather than to the product as a whole?
5. Does a package artifact exist somewhere the player can legitimately obtain
   it, and does it survive copying to any path unchanged?
6. Which operation admits it, and what does that operation recognize? Is
   recognition clearly separated from artifact identity?
7. What exists at admission versus at completion? Is every consequence applied
   exactly once, at completion, at the canonical advancement boundary?
8. If the release is executable, what identifies a runnable artifact, and what
   happens when that artifact is moved, replaced or deleted?
9. If the release has economic behavior, which represented recipients exist,
   and what happens when no recipient holds the address?
10. Is removal represented? What does removal restore, and what does it
    deliberately not touch?
11. Does the release's About / capability / change text describe only behavior
    the game actually represents, without leaking hidden truth?
12. Which surfaces present it, and does each follow the level 1/2/3 hierarchy?
13. Which current-truth owner must be updated in the same branch?

Do not build a SoftwareRegistry, capability engine, payout-policy framework, or
generic software-inventory framework to support this contract (A16). Concrete
products and releases come first.

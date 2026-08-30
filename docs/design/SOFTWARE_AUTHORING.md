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


## The seven distinct concepts

Software in Synthesis is not one object. Seven concepts stay separate, and each
exists at a different moment.

```text
SOFTWARE PRODUCT
      ↓ has releases
SOFTWARE RELEASE
      ↓ has concrete builds
SOFTWARE BUILD
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
RELEASE ≠ BUILD ≠ PACKAGE ≠ INSTALLED SOFTWARE ≠ EXECUTABLE ≠ PROCESS
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
- The release defines the authored baseline behavior, not the product: two
  releases of one product may legitimately behave differently. A concrete build
  normally preserves that release behavior, but a separately represented build
  may differ where a concrete mechanic explicitly created or authored that
  difference. Distinct `buildId` alone never implies different behavior.

### Authored release content

- One immutable authored content module owns the coherent release identity,
  product identity, ordinary descriptive metadata, and static ABOUT,
  CAPABILITY and CHANGE copy for each currently authored release.
- Authored content may explicitly construct initial concrete Package and
  InstalledSoftware snapshots, and presentation may project its documentation.
  The resulting concrete state stays self-contained; runtime installation never
  looks back to authored content to normalize or complete a Package snapshot.
- Documentation remains prose only. Its presence never supplies gameplay
  behavior, commands, executable admission, Processes or installation effects.
  Concrete release-specific mechanics may import a narrow release-ID constant,
  but must not infer behavior from documentation.
- Within canonical authored content, the same `releaseId` identifies one
  coherent authored release definition. Contradictory authored facts under one
  ID are an authoring bug, not something runtime reconciliation should repair.
- Canonical release content and a Package's concrete build remain separate
  represented concepts. Runtime must not rewrite a Package build from authored
  release content.

```text
AUTHORED RELEASE CONTENT
        ↓ constructs / describes
CONCRETE PACKAGE OR INSTALLED SOFTWARE SNAPSHOT

CONCRETE STATE + EXPLICIT RELEASE MECHANICS
        ↓
GAMEPLAY BEHAVIOR
```

### Software build

- Stable opaque build identity (`buildId`), distinct from product, release,
  filesystem-copy, executable, Process, and Market entitlement identity.
- A release may have more than one concrete build. Current authored releases
  presently carry one canonical represented build; a future altered build may
  retain the same `releaseId` while receiving a distinct `buildId`.
- Copying a Package creates a new file identity, not a new build. Runtime
  installation snapshots the Package's exact build and must never consult
  authored release content to normalize it back to the canonical build.
  - Build identity is provenance, not a generic behavior or capability switch.
  Different behavior requires an explicitly represented build-specific fact or
  concrete transformation mechanic; runtime must never infer changed behavior
  merely because two artifacts have different `buildId` values.

### Software package

- The artifact *before* installation: a file on a Device-owned filesystem.
- Carries the release and concrete build identities it represents, plus its represented size.
- Its path is its current location, never its identity. Copying it anywhere
  preserves kind, product, release, build, name, version, publisher and size.
- Whether an operation is willing to admit it from a given path is recognition
  owned by that operation — never a property of the artifact, and never a
  reason to rewrite or reclassify it.

### Installed software

- Device-owned installed state, listed on the Device that owns it.
- Created only when an installation Process completes, never at admission.
- Not Firmware, not a filesystem artifact, not a Process.
- Per Device and independent. This lifecycle is Device-targeted rather than
  permanently local: the package is resolved from the target Device's
  filesystem, the installation Process's executor *is* that Device, and
  completion updates that Device's own inventory. The same product may
  legitimately sit at different releases on different Devices.

### Ordinary installation boundary

- A normally recognized concrete software package follows one reusable default
  path from package artifact to finite installation Process to InstalledSoftware.
- Admission snapshots the package's actual product/release/build identity and ordinary
  metadata; completion creates or updates the InstalledSoftware entry for that
  exact product. Adding an ordinary product does not require adding its ID to a
  global support whitelist.
- The default consequence is InstalledSoftware only. InstalledSoftware does not
  itself imply an executable, Process, Terminal command, gameplay capability,
  or removal policy.
- Additional installation consequences remain explicit concrete mechanics. For
  example, current NODE Miner installation additionally creates its one managed
  executable — in the filesystem of the Device being installed onto; this does
  not justify install hooks, effect arrays, a product registry, or a generic
  package-manager framework.
- Static ABOUT, CAPABILITY, and CHANGE copy remains descriptive presentation;
  this default path does not make release documentation a gameplay dependency.

### Executable

- The concrete runnable artifact, where a product represents one.
- Carries its own program, release, and build identity, so a stale or replaced artifact
  can be recognized as not the concrete build something was admitted against.
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
3. Does every concrete build have a stable `buildId`, distinct from release
   identity and from filesystem-copy identity, without treating build identity
   alone as evidence of changed behavior? 
4. Are version, channel and publisher represented as release presentation
   metadata rather than identity?
5. Is every concrete behavior attached to the release that actually has it,
   rather than to the product as a whole?
6. Does a package artifact exist somewhere the player can legitimately obtain
   it, and does it survive copying to any path unchanged?
7. Which operation admits it, and what does that operation recognize? Is
   recognition clearly separated from artifact identity?
8. What exists at admission versus at completion? Is every consequence applied
   exactly once, at completion, at the canonical advancement boundary?
9. If the release is executable, what identifies a runnable artifact, and what
   happens when that artifact is moved, replaced or deleted?
10. If the release has economic behavior, which represented recipients exist,
   and what happens when no recipient holds the address?
11. Is removal represented? What does removal restore, and what does it
    deliberately not touch?
12. Does the release's About / capability / change text describe only behavior
    the game actually represents, without leaking hidden truth?
13. Which surfaces present it, and does each follow the level 1/2/3 hierarchy?
14. Which current-truth owner must be updated in the same branch?

Do not build a SoftwareRegistry, capability engine, payout-policy framework, or
generic software-inventory framework to support this contract (A16). Concrete
products and releases come first.

## Terminal integration precedent

NODE Miner 1.0 has one concrete application/presentation Terminal integration
reused by NODE-OS and RACK-OS. Firmware owns its Terminal surface and built-ins;
software integration owns product syntax and result presentation; canonical
operations own gameplay. Commands are not authored release metadata, and this
precedent does not add a plugin, capability, dependency, compatibility, or
Firmware-support system. Each Firmware adapter binds invocation to the Device
it canonically operates. NodeScan remote execution and source-Device-aware
observation remain outside this slice.

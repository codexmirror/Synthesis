# HACKING AND OBSERVATION V1
## Status and purpose
This document defines the selected product and design direction for the next
evolution of hacking, reconnaissance, observation, and access in Synthesis.
It does not replace:
- `docs/V0.md` as current implemented truth
- `docs/ARCHITECTURE.md` as durable architecture authority
- `docs/FUTURE.md` as broader long-term direction
- explicit work orders as implementation scope
This document exists to turn the already established architecture and future
direction into a concrete design contract for the next hacking and observation
work.
The central product rule is:
> Hacking in Synthesis is not a sequence of verbs. It is the use of
> information, position, and available techniques to interact with concrete
> surfaces and conditions in a mutable world. Attempts change concrete state;
> downstream consequences emerge from systems reacting to that state.
Synthesis must not converge on a universal flow such as:

SCAN
→ ANALYZE
→ ATTACK
→ ACCESS

Different situations should be able to arise from different combinations of
represented state.

A vulnerability may matter.

A credential may matter.

Existing access may matter.

A trusted relationship may matter.

A file may contain the information that creates another route.

A Device may be known but unreachable from the actor’s current position.

An offensive technique may change state without granting DeviceAccess at all.

The goal is not to build a hacking minigame.

The goal is to build a simulated digital world in which hacking can emerge from
the interaction of concrete systems.

⸻

1. Observation

Synthesis uses three distinct observation roles.

They are not stages in a mandatory pipeline.

SCAN

What is around this object?

Scan observes structure and relationships.

Examples may include:

* Devices associated with a known network
* networks related to a known Device
* exposed Services associated with a Device
* other concrete adjacent relationships represented by future mechanics

Scan primarily expands Known Space.

Opening or browsing information that was already remembered is not another
Scan.

⸻

INSPECT

What is this concrete object right now?

Inspect performs targeted observation of one known object and collects current
observable evidence about that object.

Inspect is conceptually distinct from Scan:

SCAN
→ outward / relational observation
INSPECT
→ inward / intrinsic observation

Inspect must not become:

return every property currently present in World Truth

The world may contain information that the current observer, software, method,
or operating position cannot determine.

For example:

WORLD TRUTH
Firmware = RACK-OS 3.2

does not imply:

INSPECT
Firmware = RACK-OS 3.2

A shallow observation might only determine:

SERVER
ONLINE
RACK-OS FAMILY

while a stronger reconnaissance implementation might obtain a more precise
fingerprint.

The exact evidence available belongs to the concrete mechanic.

⸻

ANALYZE

What deeper information can be derived from available evidence?

Analyze performs deeper investigation or inference.

It may require:

* represented evidence
* software
* time
* CPU
* RAM
* another concrete resource or condition

The existing Service Analysis mechanic is the first concrete example.

Observed Service state can be investigated and may produce deeper vulnerability
Knowledge.

Analyze is not synonymous with vulnerability scanning and does not have to
produce a weakness.

Future analysis may derive other information when concrete mechanics require
it.

⸻

None of these operations grants omniscience

This is a hard design rule.

WORLD TRUTH EXISTS
≠
PLAYER CAN OBSERVE IT

Likewise:

INSPECT FOUND NO EVIDENCE
≠
THE CONDITION DOES NOT EXIST

and:

ANALYZE FOUND NOTHING
≠
THE TARGET HAS NO POSSIBLE ROUTE

Observation reduces uncertainty.

It does not automatically eliminate uncertainty.

⸻

2. Software and observation depth

An operation does not need to belong permanently to one software product or
release.

Software may affect:

* observation depth
* evidence quality
* precision
* speed
* efficiency
* supported target conditions
* resource requirements
* observable consequences

without inventing another verb.

The selected rule is:

Software releases may change observation depth, quality, efficiency, or
evidence available to an operation; they do not need to invent a new verb.

For example:

NodeScan 1.0
→ INSPECT exists
→ shallow observation

and:

NodeScan 1.1 Experimental
→ same INSPECT operation
→ richer observation

This is intentionally different from:

NodeScan 1.0
→ no Inspect
NodeScan 1.1
→ unlock Inspect

The operation and the product providing useful capability remain distinct
concepts.

NodeScan is the current concrete reconnaissance product, not the permanent
definition of Scan or Inspect.

Future software may provide overlapping reconnaissance functionality with
different trade-offs.

⸻

3. Epistemic and interaction state

Several concerns must remain conceptually separate.

World Truth

What actually exists and is currently true in the simulation.

Examples:

Service exists
Firmware version is X
credential is currently valid
configuration contains condition Y
Device is currently online

World Truth is authoritative simulation state.

It is not automatically player-visible.

⸻

Discovery

Positive remembered observation of Known Space and observable relationships.

Examples:

SSH observed at 22/TCP
srv-01 observed on home-net
HTTP observed on a known Device

Discovery represents what was observed.

It is not guaranteed to remain synchronized with current World Truth.

⸻

Knowledge

Deeper learned, interpreted, inferred, or otherwise acquired information.

Example:

Weak authentication configuration discovered

Knowledge may remain historically true from the player’s perspective even if
the underlying world later changes.

Knowledge is not capability.

Knowledge is not access.

⸻

Capability

Capability is a reasoning concept:

What can this actor currently attempt?

It may emerge from concrete represented conditions such as:

* installed software
* available tools
* hardware
* information
* access
* credentials
* current position
* supported environment
* other concrete mechanics

For V1:

Capability is a reasoning concept, not a canonical universal entity.

Do not introduce speculative constructs such as:

Capability[]
CapabilityRegistry
TechniqueRegistry
ActionDefinition
canPerform(action)

The current implementation should remain concrete.

For example:

Basic Credential Toolkit installed
+
required remembered information
+
usable target context
→ Credential Access attempt may be started

Only multiple implemented mechanics should justify a future shared abstraction.

⸻

Relationship

A persistent represented relationship currently exists.

Examples include:

DeviceAccess
RemoteSession
future trust relationship
future ownership relationship

Relationships must remain distinct from observation and capability.

⸻

Reachability

Reachability describes whether a concrete interaction path currently exists
from the actor’s operating position.

Conceptually:

TARGET KNOWN        ✓
INFORMATION         ✓
TOOL                ✓
REACHABILITY        ✗

must remain possible.

Knowing an object does not imply that it can currently be interacted with.

A future foothold or network position may change reachability without changing
the target itself.

No generic reachability engine is required by this design contract.

⸻

4. Interaction dimensions

A useful mental model for concrete interactions is:

POSITION / REACHABILITY
INFORMATION
SURFACE
CONDITION
CAPABILITY / TECHNIQUE
ATTEMPT
EFFECT

These are independent dimensions.

They are not:

STEP 1
STEP 2
STEP 3
STEP 4
...

A concrete mechanic may read some of these dimensions and mutate others.

There is no universal attempt pipeline.

For example:

reachable SSH
+
known valid credential
+
ability to authenticate
↓
authentication attempt
↓
DeviceAccess

requires no vulnerability-analysis ritual.

Likewise:

existing authorized filesystem access
↓
read represented credential file
↓
new information

may require no offensive technique at all.

⸻

Surface

A Surface is the concrete represented thing being interacted with.

The first existing useful example is a Network Service.

Future concrete surfaces may arise from:

* Services
* installed software
* Firmware
* configuration
* files
* authentication interfaces
* trust relationships
* network position
* other represented systems

For V1:

Surface is a reasoning concept, not a universal canonical AttackSurface type.

Do not create a generic AttackSurface framework until multiple concrete
mechanics demonstrate a real shared requirement.

⸻

Condition

A Condition is represented state relevant to a particular interaction.

Examples may include:

* a weakness
* a valid credential
* vulnerable software state
* configuration state
* trust
* current availability
* another concrete prerequisite

A Surface and a Condition are not the same thing.

SSH SERVICE
≠
WEAK AUTHENTICATION

The same Surface may have different relevant conditions over time.

⸻

Technique

A Technique describes the concrete method being attempted.

A technique may currently be represented directly by a particular piece of
software and its gameplay operation.

The weakness and the technique must not be permanently identical.

Different techniques may eventually interact with the same condition.

One technique may have different consequences depending on current represented
state.

No generic Technique registry is required by V1.

⸻

Attempt

An Attempt is a concrete gameplay operation evaluated against current
authoritative state.

Player information may justify making an attempt without guaranteeing success.

Therefore:

PLAYER-KNOWN FEASIBILITY
≠
ACTUAL FEASIBILITY

A stale belief may lead to a legitimate failed attempt.

Interfaces must not silently inspect hidden current World Truth merely to
prevent that attempt.

⸻

Effect

An Effect is the concrete state transition produced by the attempt.

Possible future effects may include:

* DeviceAccess
* Knowledge
* Process execution
* remote execution
* filesystem mutation
* software mutation
* service state changes
* network activity
* reachability changes
* credential acquisition
* other represented state transitions

For V1:

Effect is a reasoning concept, not a universal Action/Effect framework.

Concrete mechanics own their concrete results.

⸻

5. Critical separations

The following distinctions are fundamental.

Attack is not Access

ATTACK
≠
DEVICE ACCESS

A successful offensive operation does not automatically mean the player owns,
controls, or can log into the target.

⸻

DeviceAccess is not RemoteExecution

DeviceAccess
≠
RemoteExecution

A future exploit may permit execution on a target without creating a persistent
DeviceAccess relationship.

⸻

RemoteExecution is not RemoteSession

RemoteExecution
≠
RemoteSession

Being able to cause code to execute on a Device does not automatically create
an interactive foreign operating environment.

⸻

Surface is not Weakness

SERVICE
≠
VULNERABILITY

A represented surface may exist with no known weakness.

A weakness may change while the surface remains the same object.

⸻

Command is not Capability

COMMAND
≠
SOFTWARE PRODUCT
≠
CAPABILITY

Interface syntax must not become the permanent owner of gameplay ability.

⸻

Observation is not Omniscience

OBSERVE OBJECT
≠
READ ALL WORLD TRUTH

Observation depth depends on the concrete operation and represented conditions.

⸻

Discovery is not Knowledge

SSH OBSERVED
≠
WEAKNESS UNDERSTOOD

Direct observation and deeper learned information remain different concerns.

⸻

Knowledge is not World Truth

Historical player information may become stale.

Interfaces must present legitimate player belief rather than silently correcting
it from hidden current state.

⸻

Information is not authority

Knowing:

credential X exists

does not automatically mean the actor has usable authority through it.

The concrete credential and authentication mechanics must decide that.

⸻

6. Concrete proofs

This design direction should be validated through concrete mechanics rather than
through a speculative universal hacking framework.

Proof A — current Credential Access

The existing Credential Access mechanic remains the first concrete offensive
technique.

Conceptually:

remembered SSH Service
+
positive Weak Authentication Knowledge
+
Basic Credential Toolkit installed
+
current represented conditions
↓
Credential Access Process
↓
successful result
↓
USER DeviceAccess

This implementation should not be refactored merely to make it fit a more
abstract vocabulary.

It already provides one valid concrete route.

A second mechanic should be allowed to reveal what is genuinely shared.

⸻

Proof B — Enhanced Inspect

The first selected observation proof is progressive observation depth using the
same operation.

Conceptually:

SAME TARGET
SAME WORLD TRUTH
SAME INSPECT VERB

with different software capability:

NodeScan 1.0
→ shallow current observable evidence

versus:

NodeScan 1.1 Experimental
→ richer or more precise observable evidence

The exact additional evidence should be selected according to represented
current state and gameplay value.

Potential future evidence may include legitimate fingerprints of:

* Device identity
* Firmware family or release
* Service details
* hardware class
* memory class
* network capability
* current load

but only when the corresponding underlying state exists and the concrete
observation mechanic can legitimately expose it.

The design does not require exact World Truth values to be exposed.

A stronger reconnaissance product may provide useful classifications or
fingerprints rather than omniscient telemetry.

This allows observation progression to answer meaningful questions such as:

Which machine is worth further investigation?

or later:

Which machine is suitable for a particular remote workload?

without making hidden Device state universally visible.

⸻

Proof C — future offensive effect without DeviceAccess

A future second offensive mechanic should ideally prove:

ATTACK ≠ ACCESS

One illustrative direction is:

represented HTTP / software surface
+
represented vulnerable software state
+
relevant observed fingerprint or Knowledge
+
specific offensive technique
↓
attempt
↓
REMOTE EXECUTION

The result may initially permit only a limited concrete action such as executing
one workload on the target.

It does not automatically grant:

* DeviceAccess
* RemoteSession
* RACK-OS
* unrestricted Files access
* persistent authority

That creates space for later systemic progression such as:

temporary execution
↓
filesystem or configuration change
↓
persistence
↓
credential acquisition
↓
stronger authority

This is an architectural proof direction, not an implementation commitment for
the immediate next slice.

⸻

Proof D — information creates a route

Another important future proof requires no vulnerability exploit.

Example:

accessible filesystem
↓
represented credential or configuration discovered
↓
information / credential possession
↓
another reachable authentication surface
↓
authentication attempt
↓
DeviceAccess

This demonstrates that information itself can create new routes through the
world.

The route does not require:

SCAN
→ ANALYZE
→ EXPLOIT

and should remain possible without inventing a fake vulnerability merely to fit
a hacking pipeline.

⸻

7. NodeScan / Known Space interface boundary

NodeScan remains primarily a reconnaissance and Known Space interface.

It may present:

* observed object identity
* observed facts
* known relationships
* relevant findings
* relevant access/session state
* reconnaissance actions

It must not become the universal interface for every represented subsystem.

Deep interaction with:

* filesystem state
* Processes
* runtime
* installed software
* Firmware-specific controls
* logs
* Wallets
* other specialized systems

should remain with the appropriate specialized interface when that system
exists.

A new gameplay mechanic does not automatically require a new permanent NodeScan
section.

Known Space is a useful projection of player information.

It is not canonical World ownership.

⸻

8. Near-term selected direction

Only the following work is selected strongly enough to plan immediately.

1. Player-facing Inspect V1

Expose the already existing Inspect concept as a legitimate player-facing
observation operation.

The first version should remain shallow.

It must preserve:

* World Truth vs player information
* Scan vs Inspect distinction
* browsing vs observation
* positive remembered-observation semantics
* no hidden truth leakage

The implementation must determine explicitly which observed evidence becomes
remembered and how re-observation merges with existing player information.

⸻

2. NodeScan 1.1 Experimental enhanced observation

Use the existing Experimental NodeScan release as the first proof that software
can improve the depth or quality of the same Inspect operation.

Do not create another verb solely for the Experimental release.

Do not make NodeScan 1.0 incapable of Inspect merely to create an upgrade gate.

⸻

3. Evaluate before selecting the next hacking mechanic

After basic Inspect and enhanced observation exist, review actual gameplay before
committing to the next large mechanic.

Possible next directions include:

* extending credential-based routes
* a second offensive technique
* credential discovery through files/configuration
* reachability and network position
* remote execution

Do not pre-commit a long implementation sequence before the first observation
changes have been played and reviewed.

⸻

9. Non-goals

This design contract does not authorize implementation of:

* a universal hacking pipeline
* a generic Capability engine
* a Capability registry
* a generic AttackSurface model
* a generic Technique registry
* a universal Action system
* a universal Effect system
* a generic Reachability engine
* a generic condition/prerequisite framework
* automatic privilege escalation
* universal attack-to-access conversion
* omniscient Inspect
* a replacement for current Discovery or Knowledge state merely for naming
    consistency
* a refactor of working Credential Access solely to match conceptual vocabulary
* speculative UI for mechanics that do not yet exist

Concrete mechanics should continue to precede generic abstractions.

A small amount of concrete duplication is preferable to inventing shared
architecture before multiple real mechanics demonstrate the same requirement.

⸻

10. Design test

Future hacking and observation mechanics should be checked against two questions.

Observation

Does the player learn this because a represented observation or information
route legitimately provides it, or because the interface happened to have
access to hidden World Truth?

Interaction

Does this action change concrete represented state because the current world,
information, position, and technique allow it, or because the target has been
pushed through a predefined hacking pipeline?

The desired direction is:

WORLD
+
INFORMATION
+
POSITION
+
CONCRETE MECHANICS
↓
PLAYER DECISIONS
↓
STATE CHANGES
↓
SYSTEMIC CONSEQUENCES

not:

TARGET
↓
HACK STAGE 1
↓
HACK STAGE 2
↓
HACK COMPLETE

If this distinction remains intact, Synthesis can support fundamentally
different approaches to the same digital world without requiring a separate
scripted solution path for each target.

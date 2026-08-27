# HACKING AND OBSERVATION V1

Status: Accepted
Scope: Product and design direction for hacking, reconnaissance, observation,
and access. Design authority for the epistemic model, the interaction model,
and the Target Workspace decision surface; not a description of what is
currently implemented.
Normative owner of current implemented behavior: `docs/current/NETWORK_ACCESS.md`.

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

Sections 1-6 define the epistemic model: what the player may learn, and what a
concrete mechanic may do with it. Sections 7-9 define the interaction model:
how the player expresses a decision without being required to reproduce the
simulation's internal structure by hand. Both are normative here; neither
restates the architecture invariants in `docs/ARCHITECTURE.md`.
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

For the current concrete releases:

NodeScan 1.0 Standard
→ Scan
→ Service Analysis
→ no player-facing Inspect

and:

NodeScan 1.1 Experimental
→ Scan
→ Service Analysis
→ provides Inspect

Remembered evidence collected by Inspect survives a later downgrade to 1.0. It
remains browsable Player Information, but does not restore the Inspect action.
The operation and the product providing current capability remain distinct
concepts: Scan, Inspect, and Analyze retain separate epistemic roles, and release
capability does not turn them into a mandatory universal pipeline.

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

with different software capability; when Inspect is provided, it remains the
same distinct operation rather than a release-specific verb:

NodeScan 1.0 Standard
→ no current player-facing Inspect capability
→ previously remembered Inspect evidence remains browsable

versus:

NodeScan 1.1 Experimental
→ provides Inspect and its current observable evidence

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

Proof E — implemented: represented state mutation creates a route

The srv-02 RackUpdate interaction is the first implemented proof that
interaction is not access: an attempt may change a target meaningfully while
granting no access at all.

Conceptually:

observed public package-submission interface
+
learned rollback weakness
+
a legitimately possessed older compatible package
↓
submission
↓
the target's managed GateSSH release actually changes
↓
no access, no session, no Process
↓
an existing technique that did not previously apply now applies

This is the concrete counter-example to a hacking pipeline: the player did not
advance through stages, they changed the world and the world's own rules
produced a new avenue. Current implemented behavior is owned by
`docs/current/NETWORK_ACCESS.md`.

⸻

7. Interaction model — deep simulation, shallow interaction

Physical playtesting of the implemented mechanics exposed a product problem
that is not a simulation problem.

The simulation has become genuinely deep. The interaction required to use it
has not stayed shallow. Pursuing one line of action against one target
currently requires the player to reproduce the internal domain structure by
hand:

Device
→ Service
→ Analyze
→ Process
→ back
→ Finding
→ another Service
→ Files
→ package
→ back
→ attack
→ back
→ Connect

That is difficulty of the wrong kind. It measures how well the player
remembers internal structure and click sequences, not how well they reason
about the world.

The selected direction is:

DEEP SIMULATION
+
SHALLOW INTERACTION
+
MEANINGFUL DECISIONS
+
SYSTEMIC CONSEQUENCES

The player should understand the decision, not every internal subsystem
required to execute it.

The following principles are design authority for hacking and observation
surfaces generally, not only for the workspace defined in section 8.

1. Navigation is never intended difficulty.

2. The simulation owns complexity. The interface owns clarity.

3. Players choose intent; concrete systems resolve mechanics.

4. Difficulty comes from trade-offs and reasoning, not from remembering click
   sequences or internal architecture vocabulary.

5. Terminal offers depth of information and control, not different physical
   laws.

6. Information may explain possibilities, but the interface must not prescribe
   solutions.

7. Consequences should create more depth than prerequisites.

8. Easy to operate. Increasingly difficult to reason about.

Principle 6 is what keeps principle 2 honest. Removing navigation friction
must not become removing the player's reasoning.

An interface that answers:

WHAT CAN I DO?

is clear.

An interface that automatically answers:

WHAT SHOULD I DO NEXT?

has taken the game away.

⸻

8. Target Workspace V1

The Target Workspace is the first concrete presentation proof of section 7.

It is the primary decision surface for one known target Device.

Once a player is pursuing one line of action against one target, they should
normally not need to leave that workspace merely to continue the same line of
action.

The Workspace is a surface, not necessarily a new application. The natural
home for V1 is the existing Device-level NodeScan surface (section 9); this
contract does not require a new application, a new navigation root, or a new
canonical target concept.

This section is design authority. It is not an implementation slice, and it
does not describe anything currently implemented.

⸻

8.1 What the Workspace is, and what it is not

The Target Workspace is a projection.

It owns no canonical gameplay truth.

It reads legitimate current Player Information, the player's own represented
resources and relationships, and the state of concrete mechanics, and it
arranges them so that one target's decision line is comprehensible in one
place.

Every separation in section 3 survives unchanged: World Truth, Discovery,
Knowledge, capability, reachability, DeviceAccess, RemoteSession, Process
state, and concrete mechanic ownership each keep their existing owner.

The Workspace may present these concerns together for player comprehension. It
must not merge their canonical ownership.

Concretely, this contract does not authorize state such as:

gameState.targetWorkspace
gameState.availableOperations
gameState.currentTarget

or a persisted generic:

Operation { available, ready }

Availability and readiness are derived presentation, computed from legitimate
current Player Information, represented capabilities and relationships, and
the concrete mechanic itself.

Concrete projection helpers are acceptable implementation direction where a
real need appears — conceptually something like:

projectCredentialAccessOperation(...)
projectRackUpdateOperation(...)
projectConnectOperation(...)

This contract deliberately does not prescribe their code shape, and one
concrete helper per mechanic is the expected starting point. A shared
abstraction over them requires the usual justification: multiple implemented
mechanics demonstrating the same real requirement.

⸻

8.2 Semantic hierarchy

A useful conceptual hierarchy for one target is:

TARGET
ACCESS
INVESTIGATION
FINDINGS
AVAILABLE OPERATIONS
ACTIVE ACTIVITY
DETAILS / SERVICES

This is a semantic model. It is not a requirement that every section always be
visible, always be rendered literally, or always appear in this order.

An empty concern is normally absent rather than rendered as an empty panel.
Where absence is itself information — depth that has never been observed —
existing observation semantics already require that to be stated explicitly
rather than reported as an observed empty result.

⸻

8.3 Progressive disclosure

Use progressive disclosure aggressively.

Primary surface:

* What target is this?
* What access do I currently have?
* What have I learned?
* What meaningful things can I legitimately investigate or attempt?
* What relevant work is currently running?

Secondary detail:

* why an operation is available
* Service identity and endpoint
* weakness IDs
* software versions
* concrete evidence
* technical prerequisites

The normal player should see the decision first.

A curious player should be able to reach why that decision exists.

The secondary layer is an explanation of the player's own information. It is
never an additional channel for hidden World Truth.

⸻

8.4 Semantic separation

Contextual projection may bring these onto one surface. It must not collapse
them into a generic HACK state or a single opaque target card.

FINDING
what the player knows or has learned

AVAILABLE OPERATION
what the player may legitimately attempt

ACTIVE ACTIVITY
relevant canonical work currently happening

ACCESS
represented authority relationship currently held

OBSERVED STATE
what the player currently remembers about the target

These remain visibly distinct because they fail differently. A Finding can be
stale. An Available Operation can be attempted and fail. Access persists
whether or not a Session is active. Observed State is memory, not current
truth.

A presentation that merges them re-creates exactly the omniscient
"hack progress" model this document rejects.

⸻

8.5 Readiness

READY means:

The player-visible and admissible prerequisites are sufficient to legitimately
start this attempt.

READY must never mean:

Hidden current World Truth has already confirmed that the attempt will
succeed.

Section 4 already states the governing rule:

PLAYER-KNOWN FEASIBILITY
≠
ACTUAL FEASIBILITY

Resolution belongs to the concrete gameplay operation, evaluated against
current authoritative state at the moment it resolves.

Therefore:

* stale Player Information must remain capable of producing a legitimate
  failed attempt;
* the Workspace must never query hidden truth merely to hide, disable, or
  discourage an attempt the player's legitimate information justifies;
* readiness presentation must not become a success oracle, a probability, or a
  hidden-condition hint.

An operation presented as available is a statement about the player's
information and resources. It is never a promise about the world.

⸻

8.6 Requirements without quest markers

The Workspace may explain what an operation requires only where the
requirement is legitimately derivable from Player Information or from
represented player-owned resources.

Valid, after the player has learned that the update mechanism accepts older
releases:

ROLLBACK GATESSH

Requires:
Older compatible GateSSH package

Available:
None

That statement is built from what the player learned plus what the player owns.

The interface must not reveal hidden prerequisite instances or solutions
merely because the simulation knows they exist. It must never become:

Required:
GateSSH 1.3.2.pkg

Location:
srv-01 /opt/packages

unless the player has legitimately acquired that information through a
represented route.

The distinction is the same one section 7 principle 6 states: naming the kind
of thing that is missing is information; naming where to get it is a quest
marker.

⸻

8.7 When leaving the Workspace is legitimate

Leaving is appropriate when there is a real world or gameplay reason, for
example:

* acquiring a missing artifact;
* obtaining new external information;
* operating another Device;
* using a specialized subsystem for genuinely deeper management.

Leaving merely to inspect a Process, rediscover a Finding, locate Connect, or
invoke the next step of the same target interaction is navigation friction,
not intended gameplay.

The test is whether the trip is part of the fiction or part of the filing
system.

⸻

8.8 GUI and Terminal

Both interfaces ultimately invoke the same canonical gameplay operations. That
is an existing architecture invariant (A05) and is not restated here.

What this contract adds is the player-facing philosophy:

GUI
→ clarity, decision, orientation, progressive disclosure

TERMINAL
→ depth of information, precision, finer control, faster repetition

Terminal may legitimately expose finer technical detail — exact endpoints,
exact release identities, precise operation parameters — because that detail
is still the player's own legitimate information presented at a different
grain.

Terminal must not receive privileged simulation physics. Different depth of
information and control, never different rules.

The two interfaces do not need, and this contract does not authorize:

* one shared presentation model
* one universal command/action definition
* commands generated from GUI definitions
* GUI generated from Terminal commands

Presentation remains interface-specific.

⸻

8.9 First proofs — srv-01 and srv-02

The existing srv-01 and srv-02 mechanics are the first design proofs. No third
hacking mechanic is introduced or implied.

These are two concrete decision lines, not a template. Neither is a required
shape for a future target, and neither authorizes a generic route model
derived from them. The point of showing both is that they differ: srv-01 is
short because its world state makes it short, and srv-02 is long because its
world state makes it long.

srv-01 should become understandable as approximately:

TARGET
→ weak authentication Finding
→ Credential Access operation available
→ attempt
→ USER Access
→ Connect

The player should not need to understand Knowledge records,
vulnerability-to-technique plumbing, Process ownership, DeviceAccess storage,
or RemoteSession implementation to follow that line.

srv-02 remains more demanding through reasoning, not navigation:

GateSSH 1.3.3
→ no known credential avenue

RackUpdate 1.0
→ learned rollback weakness

Rollback operation
→ requires an older compatible GateSSH package

Where no such package is available, the player understands what kind of thing
is missing and receives no prescribed location or solution.

After the player independently obtains a legitimate package:

rollback becomes attemptable
→ the concrete GateSSH release actually changes
→ existing remembered evidence may remain stale
→ legitimate re-observation or analysis can reveal the new condition
→ Credential Access becomes a legitimate next avenue
→ Access
→ Connect

Note what the Workspace must not do at the stale-evidence step. It must not
silently refresh the player's memory from current truth, and it must not
annotate the target with a hint to look again. Remembered evidence stays
remembered until the player observes again; that re-observation is the
player's decision, and it is one of the reasoning steps srv-02 exists to
create.

The underlying concrete mechanics remain authoritative throughout. The
Workspace only makes the decision line comprehensible.

⸻

8.10 Playtest contract

The later implementation slice is validated against human comprehension, not
against a feature list.

Without knowing internal architecture, a player should be able to understand:

srv-01

* there is a possible credential attack
* after success, they have access
* they can connect

srv-02

* the ordinary credential route is not currently available
* investigation reveals that the update mechanism permits rollback
* without a package, an older compatible package is what they need
* once they possess one, they can alter the target state
* the altered state may create a new attack avenue

If understanding this requires the player to know internal terms such as
DeviceAccess, KnowledgeFinding, SoftwareReleaseId, ProcessProjection, or
service IDs, the interaction design has failed regardless of how correct the
underlying model is.

⸻

9. NodeScan / Known Space interface boundary

NodeScan remains a reconnaissance and Known Space interface, and Known Space
remains a projection of player information rather than canonical World
ownership. That is unchanged.

The previously accepted phrasing — that NodeScan is primarily a
reconnaissance interface — is reconciled here, because read strictly it
preserves the exact navigation problem section 7 exists to remove. A surface
that can show a Finding but cannot offer the operation that Finding justifies
sends the player back out to hunt for it.

The reconciled boundary is:

CONTEXTUAL PROJECTION      allowed
DOMAIN OWNERSHIP           unchanged

NodeScan may contextually project target-relevant canonical state and
target-relevant operations from other domains where that is necessary to keep
one decision line coherent.

Legitimate examples include:

* relevant analysis progress
* a Credential Access attempt
* RackUpdate package application
* current DeviceAccess
* Connect where Access already exists

The canonical owner is unchanged in every one of those cases:

Processes remains the detailed Process manager.
Files remains the detailed filesystem interface.
RACK-OS remains the foreign Device operating environment.
Other specialized applications keep their domain-specific depth.

Contextual projection is not domain ownership.

Two questions separate them:

Does this let the player continue the same line of action against this target?
→ contextual projection may be appropriate.

Is this where the player manages that subsystem in general?
→ it belongs to the specialized interface.

A new gameplay mechanic still does not automatically earn a new permanent
NodeScan section, and NodeScan must not drift into a universal interface for
every represented subsystem.

The semantic grammar of NodeScan object pages remains owned by
`docs/design/SCAN_INFORMATION_ARCHITECTURE_V1.md`; where that contract limits
Scan to a Known Space / object browser, this section is the reconciliation.

⸻

10. Implemented baseline and selected direction

1. Implemented — Player-facing Inspect V1

Player-facing Inspect V1 exposes Inspect as a legitimate observation operation.
Its first implementation remains shallow and preserves:

* World Truth vs player information
* Scan vs Inspect distinction
* browsing vs observation
* positive remembered-observation semantics
* no hidden truth leakage
* explicit evidence-memory and re-observation semantics

⸻

2. Implemented — NodeScan 1.1 Experimental Inspect capability

The Experimental NodeScan release is the first proof that a software release
can provide the distinct Inspect operation. NodeScan 1.0 Standard provides Scan
and Service Analysis but no player-facing Inspect; NodeScan 1.1 Experimental
provides Inspect.

Do not create another verb solely for the Experimental release. Previously
remembered Inspect evidence survives downgrade to 1.0 and remains browsable,
but it does not restore the Inspect action.

⸻

3. Implemented — srv-02 RackUpdate rollback

The compositional route described in Proof E is implemented. It is the current
proof that interaction is not access and that represented state mutation, not
a pipeline stage, is what creates a new avenue.

⸻

4. Resolved — the next-mechanic decision gate is closed

The previously active gate asked that actual gameplay be reviewed before
committing to the next large hacking mechanic. That review has happened, and
this document records its outcome.

The finding was not that the simulation needs another mechanic. It was that
the existing mechanics are hard to use for reasons that have nothing to do
with the world.

The selected sequence is therefore:

Target Workspace V1
→ playtest and remove navigation friction
→ Consequences V1
→ Execution Style V1 driven by those consequences
→ next economic / merchant target

The directions the closed gate listed — extended credential routes, a second
offensive technique, credential discovery through files, reachability and
network position, remote execution — remain valid long-term direction under
`docs/FUTURE.md`. None of them is selected now, and the interaction work does
not need one. No third hacking mechanic should be introduced to justify the
Target Workspace.

⸻

11. Consequences and execution styles

Hacks should eventually create real represented consequences and traces. That
long-term direction is retained and is owned by `docs/FUTURE.md`.

This contract does not authorize Execution Style V1 as part of Target
Workspace V1.

Specifically, do not introduce a universal:

executionProfile = aggressive | controlled | quiet

Execution styles are meaningful only once concrete consequence state exists to
make them differ. Until then they are UI flavour, and flavour that pretends to
be simulation is exactly the failure mode this document rejects.

The recorded future direction is conceptual: one concrete operation may later
expose causal execution choices — faster and noisier versus slower and quieter
— when represented mechanics make those differences real.

For example, once authentication traces actually exist:

* aggressive execution may create more authentication evidence faster
* controlled execution may balance time and exposure
* quiet execution may reduce evidence at a meaningful cost

Each of those must be a real difference in represented state produced by the
concrete operation. None of them may be a label attached to an otherwise
identical attempt.

This is also where principle 7 is meant to pay off: depth should come from
what an action leaves behind, not from lengthening the list of things the
player must assemble before acting.

⸻

12. Non-goals

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
* a universal OpportunityEngine or OperationRegistry
* a generic attack-surface or universal interaction schema
* canonical Target Workspace, available-operation, or current-target GameState
* a persisted generic Operation entity carrying availability or readiness
* a shared GUI/Terminal presentation model, or either interface generated from
  the other
* execution profiles or any execution-style presentation before concrete
  consequence state exists
* automatic privilege escalation
* universal attack-to-access conversion
* omniscient Inspect
* readiness derived from hidden World Truth
* prerequisite presentation that names hidden instances or locations
* a replacement for current Discovery or Knowledge state merely for naming
    consistency
* a refactor of working Credential Access solely to match conceptual vocabulary
* speculative UI for mechanics that do not yet exist

Concrete mechanics should continue to precede generic abstractions.

A small amount of concrete duplication is preferable to inventing shared
architecture before multiple real mechanics demonstrate the same requirement.

⸻

13. Design test

Future hacking and observation work should be checked against three questions.

Observation

Does the player learn this because a represented observation or information
route legitimately provides it, or because the interface happened to have
access to hidden World Truth?

Interaction

Does this action change concrete represented state because the current world,
information, position, and technique allow it, or because the target has been
pushed through a predefined hacking pipeline?

Comprehension

Is the difficulty here reasoning about the world, or remembering where the
interface keeps things?

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

and the interaction the player performs to express those decisions should stay
as shallow as the simulation behind it is deep.

If those distinctions remain intact, Synthesis can support fundamentally
different approaches to the same digital world without requiring a separate
scripted solution path for each target, and without requiring the player to
learn its internal architecture to use them.

# HACKING AND OBSERVATION V1

Status: Accepted
Scope: Product and design direction for hacking, reconnaissance, observation,
and access. Design authority for the epistemic model and for the player-facing
interaction model, including the casual SCAN / HACK / CONNECT interaction and
the progressive technical depth beneath it; not a description of what is
currently implemented. Also design authority for the long-term
capability-collection progression model and the composition principle
(sections 14-16). Concrete precedents built on that principle are owned by
their own focused contracts, for example `RACKUPDATE_PENDING_ACTIVATION_V1.md`
and `DEAUTH_NETWORK_DISRUPTION_V1.md`; this document does not duplicate their
normative detail.
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

The epistemic model in sections 1-6 has survived two rounds of physical
playtesting unchanged. The interaction model in sections 7-9 has not: the
Target Workspace hypothesis it first produced was implemented, merged and then
rejected by physical playtesting, and section 8 now carries the interaction
that replaced it. Section 8.1 records what failed and why, because that is the
part most easily reinvented.
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

Synthesis uses four distinct observation roles.

They are not stages in a mandatory pipeline.

PING

Does something respond at this address? PING observes only immediate reachability and may retain minimal target identity/address information. It does not observe topology, Services, Firmware, or weaknesses.

⸻

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
→ Ping
→ Scan
→ Service Analysis
→ no player-facing Inspect

and:

NodeScan 1.1 Experimental
→ Ping
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

Flipper installed, with the Credential Access Module integrated
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
Flipper installed, with the Credential Access Module integrated
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
a supporting installed tool
↓
ATTACK: finite represented work
↓
narrow package-submission capability (not access, not a session)
+
a legitimately possessed compatible package
↓
submission: finite represented upload work
↓
the target's managed GateSSH release actually changes
↓
no access, no session, no DeviceAccess or RemoteSession at any step
↓
an existing technique that did not previously apply now applies

The proof no longer rests on the interaction being instantaneous or
Process-free: both ATTACK and submission are real elapsed represented work.
What the proof demonstrates is untouched by that — the player never advances
through stages toward access, they change the world and the world's own
rules produce a new avenue, without ever creating DeviceAccess or a
RemoteSession. Current implemented behavior is owned by
`docs/current/NETWORK_ACCESS.md`.

⸻

7. Interaction model — deep simulation, shallow interaction

Physical playtesting of the implemented mechanics exposed a product problem
that is not a simulation problem.

The simulation has become genuinely deep. The interaction required to use it
did not stay shallow. The first attempt to fix that — the Target Workspace,
section 8 — reduced navigation without reducing what the player has to
understand, and failed its own playtest for that reason. Both failures have
the same shape: the interface asked the player to reproduce the simulation's
internal structure, first by walking it and then by reading it.

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
surfaces generally.

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

Principle 6 is what keeps principle 2 honest, and it is the one most easily
misread. It is reconciled here, because the failed workspace read it as a
licence to make the player assemble the attempt by hand.

Naming what the player may legitimately attempt, from what they have learned
and what they own, is information about themselves. It is allowed, and it is
what an intent-level interface is for.

Naming a hidden prerequisite instance, a location, an expected outcome, or a
condition the player has not observed is a solution. It is not allowed.

An interface that answers:

WHAT CAN I DO?

is clear.

An interface that answers:

WHERE IS IT, AND WILL IT WORK?

has taken the game away.

⸻

7.1 Software may perform represented technical work

NodeScan is represented software, not a control panel the player is required
to operate one step at a time.

Where a NodeScan release legitimately supplies an operation, NodeScan may
perform or schedule several of those operations from one player intention.
This is abstraction value, and it is the main thing the player is buying by
owning better reconnaissance software.

Automation is bounded by the same rules as manual use:

* every automated step is an existing canonical operation;
* each keeps its own capability gate, resource cost and elapsed work;
* each keeps its own identity validation and its own failure;
* nothing is scanned, inspected or analysed that the player does not already
  legitimately know about;
* hidden World Truth is never consulted to decide what to do.

A domain distinction is not automatically a player verb. Scan, Inspect and
Analyze keep their distinct epistemic roles (section 1, and A09); that says
what those operations mean, not how many buttons the player must press.

⸻

7.2 The interaction budget

Interaction complexity must not scale one-for-one with simulation complexity.

Synthesis expects to grow many more mechanics: devices, services, files,
processes, credentials, position, weaknesses, tools, accounts, money, logs,
traces, defender reactions, remote execution, economic manipulation. If each
one earns a primary verb, a submenu or a mandatory workflow, the interface
becomes a technical vocabulary quiz long before the simulation becomes
interesting.

The required shape is:

MANY UNDERLYING MECHANICS
↓
FEW STABLE PLAYER INTENTIONS

A new mechanic should normally create a new situation, trade-off, consequence
or opportunity inside the existing interaction language. It should not create
a new control scheme.

Reject any design whose player-facing complexity grows roughly one-for-one
with the number of simulated mechanics.

⸻

7.3 Depths, not different games

Casual accessibility and expert depth are presentation depths over one
simulation, not two products.

CASUAL
→ clear intentions

INTERESTED
→ explanations and meaningful choices

ADVANCED
→ technical detail and system relationships

EXPERT
→ Terminal, precise direct control

All four operate the same canonical simulation, under the same physics, with
the same information rules. A casual player is not playing a simplified game;
an expert is not playing a privileged one.

⸻

8. Casual interaction — SCAN / HACK / CONNECT

This section is the current design authority for the player-facing hacking
interaction. It supersedes the Target Workspace interaction hypothesis.

⸻

8.1 What the Target Workspace hypothesis got right, and what it got wrong

The Target Workspace was the first concrete presentation proof of section 7.
It put one target's whole line of action on one surface, so the player no
longer had to walk Device → Service → Process → Files → back to continue one
decision.

That part is retained and remains design authority: once a player is pursuing
one line of action against one target, they should normally not need to leave
that surface merely to continue it.

The hypothesis failed on everything else. Its surface presented TARGET,
ACCESS, INVESTIGATION, FINDINGS, AVAILABLE OPERATIONS, ACTIVE ACTIVITY and
DETAILS / SERVICES as parallel primary categories, each populated with real
domain vocabulary. Physical playtesting found that a developer who knows the
architecture still could not feel a gameplay thread: the player had removed
walking and gained reading. Understanding SSH, HTTP, Scan, Inspect, Analyze,
Findings, AUTH-017, RackUpdate, UPD-001, Basic Credential Toolkit, packages,
rollback, Access and several action categories was still required before the
first hack could be attempted.

The lesson is recorded here rather than deleted: a decision surface is not
automatically an intent surface. Presenting every relevant concern at once is
a different failure from making the player fetch each concern in turn, and it
is not obviously the smaller one.

Superseded, and not to be reinstated by renaming: a primary surface built from
parallel technical sections; INVESTIGATION, FINDINGS and AVAILABLE OPERATIONS
as primary player-facing categories; per-Service primary actions; mandatory
tool selection; weakness identities on the decision surface.

⸻

8.2 The player verbs

The casual core uses a very small, stable set of intent-level interactions:

SCAN
find out about what I am looking at

HACK
use what has been found to get in

CONNECT
operate what I now have access to

These are subjects-and-intent, not mechanics. SCAN means the same thing on a
list of targets as it does on one target; only the subject differs. HACK does
not name a technique, a tool or a service. CONNECT does not name a Session.

New mechanics are expected to arrive as new situations these verbs already
express — a different kind of way in, a different consequence, a different
cost — not as new verbs.

Adding a fourth primary verb is a design decision requiring its own
justification, not a routine consequence of adding a mechanic.

⸻

8.3 Known Space and the target card

Known Space is where the player sees the world they have observed: remembered
Networks, SELF's own place in them, and the targets that belong to each, with
targets they know outside any known Network kept visibly separate. It is
relationship context under the rule in section 9 — legible topology, not a
hierarchy to walk. SELF is an anchor there and never a target.

A target is presented as one card carrying one stage and, normally, one
visually obvious primary action.

UNKNOWN TARGET
NOT SCANNED
[ SCAN ]

SCANNING
████████ 64%

SERVER
1 WAY IN FOUND
[ HACK ]

HACKING
████████ 78%

ACCESS GRANTED
[ CONNECT ]

The stage is derived presentation over independent canonical concerns —
Discovery, Knowledge, Process, DeviceAccess, RemoteSession — ordered so that a
live relationship outranks work in flight, which outranks what the player
could start.

It is never canonical state. Specifically, this contract does not authorize a
`hacked` flag, a stored target stage, a canonical target progress value, or a
generic domain `HackOperation` that concrete mechanics are flattened into.
Every separation in section 3 survives unchanged.

The stages fail differently and must keep saying so: remembered observation
can be stale, a way in can be attempted and fail, Access persists whether or
not a Session is active. Compressing them into one opaque progress bar
re-creates exactly the omniscient "hack progress" model this document rejects.

⸻

8.4 What a way in claims

A way in is a statement about the player, not about the target.

It exists when the player's own legitimate Knowledge names a weakness on an
observed surface, and represented software the player actually has installed
supports acting on it.

It must never mean that hidden current World Truth has confirmed the attempt
will succeed. Section 4 already states the governing rule:

PLAYER-KNOWN FEASIBILITY
≠
ACTUAL FEASIBILITY

Therefore:

* stale Player Information must remain capable of producing a legitimate
  failed attempt;
* the interface must never query hidden truth to hide, disable, or discourage
  an attempt the player's legitimate information justifies;
* removing the required capability removes the offer, without removing the
  Knowledge that produced it;
* a way in is never a probability, a hint, or a success oracle.

Where exactly one installed tool satisfies a known avenue, the software may
select it. Forcing a choice that has only one option is ceremony, not
gameplay. Where several tools later create a real strategic difference, the
choice is exposed at the point it actually matters.

The same principle governs Services and implementation details: they are real,
they are reachable, and they are not a toll the player pays on every attempt.

⸻

8.5 Progressive technical depth

Technical depth is not removed. It is moved behind one disclosure and stays
one interaction away.

Primary surface:

* what this target is
* what stage its line of action is in
* the one action that continues it
* real progress while work is running

Technical depth:

* why a way in exists — method, tool, service, observed software, weakness
* observed target properties and their provenance
* Services, endpoints and remembered fingerprints
* single-Service investigation
* advanced compositional avenues such as package rollback
* the relationship Access was established through

The depth layer is an explanation of the player's own information and their
own represented resources. It is never an additional channel for hidden World
Truth, and opening it is browsing: it performs no observation and starts no
gameplay.

⸻

8.6 Requirements without quest markers

The interface may explain what an operation requires only where the
requirement is legitimately derivable from Player Information or from
represented player-owned resources.

Valid, after the player has learned that the update mechanism accepts older
releases:

ROLLBACK GATESSH

Requires:
Older compatible GateSSH package

Available:
None

That statement is built from what the player learned plus what the player
owns.

The interface must not reveal hidden prerequisite instances or solutions
merely because the simulation knows they exist. It must never become:

Required:
GateSSH 1.3.2.pkg

Location:
srv-01 /opt/packages

unless the player has legitimately acquired that information through a
represented route.

Naming the kind of thing that is missing is information; naming where to get
it is a quest marker.

⸻

8.7 When leaving the target is legitimate

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

Terminal keeps the individual operations the graphical surface composes, and
that is its value: a knowledgeable player may scan, inspect and analyze
exactly what they choose, in the order they choose, and read finer technical
detail while doing it.

Terminal must not receive privileged simulation physics, and the graphical
player must not be penalised for using the accessible surface. Different depth
of information and control, never different rules, never different outcomes.

The two interfaces do not need, and this contract does not authorize:

* one shared presentation model
* one universal command/action definition
* commands generated from GUI definitions
* GUI generated from Terminal commands

Presentation remains interface-specific.

⸻

8.9 First proofs — srv-01 and srv-02

srv-01 is the beginner proof. Its whole line of action is:

TARGET
→ SCAN
→ 1 WAY IN FOUND
→ HACK
→ ACCESS GRANTED
→ CONNECT

A new player should follow that without knowing what SSH, HTTP, a service
implementation, a vulnerability identity, a credential toolkit, a Process, a
DeviceAccess or a Remote Session is. Those all still exist underneath, and the
interested player can read every one of them under technical depth.

srv-02 is not the second beginner encounter. Its compositional route —
learning that the update mechanism permits rollback, obtaining an older
compatible package, changing the target's represented software, re-observing,
and only then finding a credential avenue — is retained in full as systemic
depth, and is reached through technical depth rather than through the casual
surface.

An advanced compositional mechanic is not a beginner mechanic merely because
it exists. Ordering content by when it was implemented, rather than by what it
demands of the player, is how the second encounter became more expensive than
the first.

Where a target offers the player nothing they can currently use, the casual
surface says so plainly and offers the observation that could change it. It
does not annotate the target with what to go and find.

⸻

8.10 Playtest contract

The interaction is validated against human comprehension, not against a
feature list.

The five-second rule:

A player who knows none of Synthesis' internal architecture and no
cybersecurity terminology should be able to look at a normal target and
understand their meaningful next action within roughly five seconds.

At the first target, without explanation, a player should be able to answer:

1. What can I do?
2. What should I press first?
3. Did the game clearly tell me what changed?
4. Can I continue without hunting through another menu?

If understanding the basic loop requires knowing terms such as AUTH-017,
UPD-001, DeviceAccess, RemoteSession, Knowledge, service implementation,
GateSSH, RackUpdate, package submission, release identity or represented
authority relationship, the interaction design has failed regardless of how
correct the underlying model is.

Mobile is first-class. The primary action is visually obvious and touch-sized,
progress and success appear where the decision was made, and the player never
scrolls past technical material to reach the thing they came to do.

⸻

9. NodeScan interface boundary

NodeScan remains a reconnaissance and Known Space interface over player
information rather than canonical World ownership. That is unchanged.

What is reconciled is its shape and its job.

NodeScan is the player's practical hacking tool, not an architecture
inspector. Its purpose is to translate a complex represented digital world
into useful player decisions. Its primary vocabulary is target, scan, way in,
hack, access, connect — not the internal names of the domains it reads.

Its navigation is deliberately shallow: known space, and one target. That is
the whole stack.

Network topology may be presented as lightweight relationship context, but it
is not a navigation hierarchy the player must traverse. Remembered Networks,
the player's own position among them, and which targets belong where are
useful world information and should be legible at a glance; what was harmful
was requiring Network → Device → Service to be walked as gameplay. So the
relationship scaffold is drawn, and nothing in it is a level: a Network is not
openable and carries no action, nothing expands, Services are not children of
the list, and a target opens its own card in one tap. Removing interaction
complexity is not the same as erasing world structure, and neither is an
excuse for the other.

The projection boundary is unchanged:

CONTEXTUAL PROJECTION      allowed
DOMAIN OWNERSHIP           unchanged

NodeScan may contextually project target-relevant canonical state and
target-relevant operations from other domains where that is necessary to keep
one decision line coherent. The canonical owner is unchanged in every case:

Processes remains the detailed Process manager.
Files remains the detailed filesystem interface.
RACK-OS remains the foreign Device operating environment.
Other specialized applications keep their domain-specific depth.

Two questions separate them:

Does this let the player continue the same line of action against this target?
→ contextual projection may be appropriate.

Is this where the player manages that subsystem in general?
→ it belongs to the specialized interface.

A new gameplay mechanic still does not automatically earn a new permanent
NodeScan section, and NodeScan must not drift into a universal interface for
every represented subsystem.

The semantic grammar of NodeScan object presentation remains owned by
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
a pipeline stage, is what creates a new avenue. After the interaction reset it
is advanced depth rather than beginner content.

⸻

4. Superseded — Target Workspace V1

Implemented, merged, and rejected by physical playtesting as a gameplay model.
Its surviving contribution is one-surface continuity (section 8.1); its
category-based primary interaction is superseded by section 8 and must not be
reinstated.

⸻

5. Implemented — the SCAN / HACK / CONNECT interaction reset

NodeScan presents Known Space and a target card, and performs the routine
technical work of a sweep — Scan, then Inspect where the installed release
supplies it, then Service Analysis of every remembered Service — from one
player SCAN. Each step is the same canonical operation Terminal exposes
individually.

Physical playtesting of that reset confirmed the casual loop and returned two
presentation corrections, both applied without changing the interaction:

* Known Space draws the remembered relationship scaffold again — Network,
  SELF's position, the targets that belong there — under the rule in section
  9. Legibility was restored; the navigation was not.
* A sweep starts one real Service Analysis Process per remembered Service, so
  each names the Service it is analysing rather than differing only by port.
  They remain independent Processes with their own resources, progress and
  cancellation; no batch, parent or grouped state was introduced.

⸻

6. Resolved — the next-mechanic decision gate is closed

The previously active gate asked that actual gameplay be reviewed before
committing to the next large hacking mechanic. That review has happened, and
this document records its outcome.

The finding was not that the simulation needs another mechanic. It was that
the existing mechanics are hard to use for reasons that have nothing to do
with the world.

The selected sequence is therefore:

interaction reset
→ playtest the first loop as a game
→ Consequences V1
→ Execution Style V1 driven by those consequences
→ next economic / merchant target

The directions the closed gate listed — extended credential routes, a second
offensive technique, credential discovery through files, reachability and
network position, remote execution — remain valid long-term direction under
`docs/FUTURE.md`. None of them is selected now. No third hacking mechanic
should be introduced to justify an interaction surface, and no tutorial should
be introduced to explain one.

⸻

7. Accepted — capability-collection progression and the DEAUTH composition
   precedent

Sections 14-16 freeze long-term hacking progression as an expanding
collection of concrete technical capabilities rather than a skill tree, freeze
capability rarity/value as something that may emerge from world distribution
rather than RPG tiers, and freeze composition — one mutation creating the
conditions for another technique — as the general shape of advanced hacking.

DEAUTH / network disruption is frozen as the first planned precedent for that
composition, narrowed to represented connectivity disruption only. Its own
design authority is `docs/design/DEAUTH_NETWORK_DISRUPTION_V1.md`. Nothing in
this entry is current implemented truth: no capability collection, rarity
system, or DEAUTH mechanic exists yet.

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
* a canonical `hacked` flag, stored target stage, or canonical target progress
* a generic domain `HackOperation` that concrete mechanics are flattened into
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
* a return of the superseded workspace under new section names
* a Network page, Network or Device expansion, Service children on Known
  Space, or any other navigation level reintroduced under topology
* a fourth primary player verb adopted as a routine consequence of adding a
  mechanic
* tutorial or story content introduced to explain a complicated interface
* a hacking skill tree, capability level, or stat that makes existing
  techniques more likely to succeed
* RPG rarity tiers or a loot taxonomy
* a rule that a new weakness or technique requires a new Flipper module
* a universal consequence/event bus that lets one mechanic directly invoke
  another mechanic's effect

Concrete mechanics should continue to precede generic abstractions.

A small amount of concrete duplication is preferable to inventing shared
architecture before multiple real mechanics demonstrate the same requirement.

⸻

13. Design test

Future hacking and observation work should be checked against four questions.

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

Scale

If twenty more mechanics arrived on the same shape, would the player be
choosing between more interesting situations, or reading a longer list of
technical verbs?

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

⸻

14. Technical capabilities as player progression

Long-term hacking progression is an expanding collection of concrete
technical capabilities, not a generic skill tree.

```text
SKILL TREE
level up an abstract stat
        ↓
existing situations become statistically easier

CAPABILITY COLLECTION
acquire a new concrete technical means
        ↓
new situations become possible
```

A newly acquired technique should give the player a new technical verb, state
mutation, or method of interacting with represented systems — not a
percentage, a stat increase, or an unlocked tier of an existing action.
Section 3 already frames Capability as a reasoning concept rather than a
canonical registry; this section freezes what that reasoning concept is for:
it is what the player's progression grows.

Mastery should increasingly come from understanding and combining an
expanding set of capabilities (section 16), not from advancing a level that
makes existing techniques more statistically likely to succeed.

The player's growing collection expands the solution space. It does not
raise a hacking level.

⸻

Technique, capability, tool, and effect remain distinct

Sections 3 and 4 already separate Capability, Surface, Condition, Technique,
and Effect. This freeze adds one boundary those sections leave implicit: a
technique is not permanently owned by one tool.

Keep distinct:

```text
WEAKNESS / CONDITION
what is technically exploitable or relevant on the target

TECHNIQUE
the concrete method an actor can attempt

CAPABILITY
whether the actor currently has the represented means to attempt it

TOOL / MODULE / SOFTWARE
one possible concrete provider of that capability

EFFECT
the concrete state transition the attempt causes
```

A new weakness does not require a new Flipper module. A new technique may be
supplied by an existing module, a new module, other installed software, a
represented condition, or another concrete capability source entirely. Which
one currently provides it is a fact about the represented world, not a rule
this design imposes.

The existing Flipper modules — Credential Access and Rollback — remain valid
concrete mechanics under this freeze. Nothing here redesigns or invalidates
them, and nothing here requires giving a future technique a Flipper module
merely so it has somewhere to live.

⸻

Capability is derived, not unlocked

A technique is currently available because concrete represented state gives
the actor the means to attempt it, not because an abstract progression system
declared it unlocked.

```text
CAPABILITY
= derived from represented causes and current conditions
```

not:

```text
abstract progression unlock
        ↓
capability becomes true
```

Depending on the concrete mechanic, that represented cause may be installed
software, a tool/module, an acquired artifact or file, learned Knowledge,
equipment/hardware, position/reachability, an authority relationship, or
another represented condition. Section 3 already lists these as the concrete
sources Capability may emerge from; this freeze commits that they remain the
only legitimate sources — collection progression does not add a parallel one.

Do not introduce a canonical `CapabilityCollection`, `unlockedTechniques[]`,
`TechniqueRegistry`, card inventory, or similar domain model that would let a
technique become available independent of its represented cause.

A future Arsenal, Technique Library, or similar collection presentation may
project the technical possibilities the player legitimately has, exactly as
NodeScan projects reconnaissance state (section 9). That presentation must
never become the canonical owner of capability truth: removing or losing the
represented cause removes the capability, whether or not any collection
surface is rebuilt to notice.

This freeze does not decide how future exploit artifacts, copying, trading,
or distribution work. It only fixes that whatever mechanism eventually
provides a capability, the capability remains true only while its represented
cause remains true.

⸻

Collection growth does not grow the primary interaction grammar

Section 7.2 already requires that interaction complexity not scale
one-for-one with simulation complexity. This freeze states the same rule for
the specific case of a growing capability collection:

```text
Collection progression may expand technical verbs without expanding the
primary interaction grammar at the same rate.
```

A new technical capability may add a new technical verb semantically — a new
kind of state mutation or interaction the player can reason about — without
that verb automatically earning another top-level primary button or a
permanent primary interaction verb. The existing rule that a fourth primary
player verb requires its own justification (section 8.2, section 12) is the
concrete form this takes today; a growing capability collection is exactly
the kind of pressure that rule exists to resist.

The intended direction is a small, comprehensible primary interaction grammar
— SCAN / HACK / CONNECT today — with a growing set of contextually available
techniques beneath it, reached through the same progressive technical depth
already described in section 8.5. This document does not freeze exact future
labels such as HACK, BREACH, MANIPULATE, ARSENAL, or TECHNIQUE LIBRARY; that
remains presentation work for whichever design contract eventually owns it.

⸻

15. World-emergent availability and rarity

Some technical capabilities may eventually be common; others may be
difficult or rare to acquire. This freeze commits to that outcome, not to a
mechanism that produces it.

Do not define RPG rarity tiers or a loot taxonomy. Synthesis has no
`common / rare / epic` field, and this document does not introduce one.

Rarity and value should be able to emerge from the same kinds of concrete
systems `docs/FUTURE.md` already describes for software — world distribution,
provenance, software releases, locations, access requirements, information
requirements, and other concrete mechanics — rather than from a label
attached to a capability at authoring time.

This document does not design the acquisition or distribution system that
would produce that emergence. It commits only that when such a system exists,
a capability's value comes from where it actually sits in the represented
world, not from a tier the design assigns to it.

⸻

16. Composition creates advanced hacking

Proof E already demonstrated that one represented state mutation can create
the conditions for a technique that did not previously apply. This section
freezes that as the general shape of advanced hacking, not a one-off proof.

The intended player reasoning is:

```text
I need state X.
Capability A can change Y.
System B will react to Y by producing X.
That makes technique C possible.
```

not:

```text
I need the next hacking level / module.
```

This document does not prescribe a universal attack pipeline. Which
capability changes which state, and which system reacts to it, remains a
concrete fact about the mechanics involved — the same rule section 4 already
states for any single attempt.

⸻

Mechanics keep their causal meaning

A technique must never receive an unrelated downstream effect merely to
complete a desired gameplay combination. The represented systems determine
which combinations are possible, not the designer wiring a shortcut into the
initiating technique.

```text
A technique owns its concrete technical effect.
Affected systems own their reactions to that effect.
A designed combo emerges from those represented reactions.
```

not:

```text
A technique gains extra semantics because a combo needs them.
```

This is the rule that keeps DEAUTH itself connectivity disruption rather than
"reboot target": the srv-02 puzzle needing a reboot is not a reason for
DEAUTH to own one. The affected Device's own behavior owns whether, and how,
it reacts to lost connectivity; see
`docs/design/DEAUTH_NETWORK_DISRUPTION_V1.md`.

⸻

The first planned proof of multi-step composition beyond Proof E is DEAUTH /
network disruption, owned by `docs/design/DEAUTH_NETWORK_DISRUPTION_V1.md`.
Its intended srv-02 chain composes three independently owned causal
boundaries — RackUpdate's pending GateSSH state, DEAUTH's connectivity
disruption, and the existing boot-activation boundary in
`RACKUPDATE_PENDING_ACTIVATION_V1.md` — without any one of them directly
causing the others' effect. That separation is the point: composition works
because each mutation stays owned by the system that owns it, and
consequences emerge from those systems reacting to each other's state rather
than from a scripted chain.

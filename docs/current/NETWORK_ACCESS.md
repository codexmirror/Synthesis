# Network, Reconnaissance, and Access — current truth

Status: Accepted
Scope: Scan, the NodeScan application, Inspect, Discovery, Service Analysis,
Knowledge, Credential Access, DeviceAccess, Remote Session / RACK-OS, and
Authentication History, as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/IDENTITY_AND_INFORMATION.md` and
`docs/architecture/DEVICES_AND_ACCESS.md`.


## NodeScan and Scan

The graphical reconnaissance application is presented as NodeScan, first-party
reconnaissance software shipped with NODE-OS. Its current direct Terminal commands are `ping <ipv4>`, `scan
<ipv4|network-name>`, `inspect <ipv4|network-name>`, and `analyze
<ipv4:port>`; no product namespace is required.

NodeScan is the single player-facing home for network space. There is no
separate Network application: the Networks the local Device legitimately
administers and the Networks reconnaissance remembers are presented in one
map, and a managed Network's administration detail is reached from its own
root inside NodeScan.

That product unification does not merge the semantic owners. Reconnaissance
Discovery and `NetworkManagementAuthority` remain distinct
(`docs/current/DEVICE_SYSTEM.md`): the managed-Network projection
(`src/apps/networkManagement/networkProjection.ts`) reads authority, NodeScan's
target projection reads player information, and NodeScan composes the two side
by side rather than deriving one from the other. Discovery of a Network never
implies authority to administer it, authority never enumerates member Device
identity, and browsing either never mutates Discovery. The internal `network`
app identity and `src/apps/network/` remain NodeScan's own wiring — a
historical naming detail, not a product relationship.

Scan is available through both Terminal and the graphical NodeScan application.
Both interfaces invoke the same shared Scan gameplay/application operation.

Known Space accepts a player-supplied IPv4 address for immediate PING. Typing, pasting, or locally validating it is presentation state only. A positive PING remembers only stable Device identity and the observed address; it observes no name, Firmware, Services, vulnerabilities, Network membership, or topology. Invalid input is rejected before observation, no response creates no Discovery, and PING creates no Process. A foreign Device learned this way appears under ELSEWHERE as NOT SCANNED.

NodeScan is presented as KNOWN SPACE plus two routes off it. KNOWN SPACE
presents the shape of the player's network space; a target card owns selected
Target context; a managed Network's administration detail is the other route.
SCAN observes Services, ANALYZE may start independent analyses for the
observed Services, the target's ACTIONS surface executes concrete owned
Techniques, and CONNECT operates established Access. Manual INSPECT is
deliberately not one of those stages; it is optional depth (see below). Known
Space and the target card are built from a view model derived from remembered
Discovery, Knowledge, the player's own Processes, the player's own installed
software, DeviceAccess and RemoteSession. World truth is deliberately outside
the slice that view model is built from; the managed-Network route is the one
deliberate, separately owned exception, and it supplies only the Network's own
canonical facts.

Known Space is one compact expandable relationship tree — Network → Device —
carried by indentation, type weight and thin connectors rather than nested
cards. Its Network roots are the Networks the local Device manages plus the
Networks reconnaissance remembers; everything below a root comes from
remembered Discovery alone. A managed Network therefore appears as a root on a
fresh game, before anything has been observed on it, and honestly states that
its members are unobserved. A Device is a leaf: it carries no remembered
Service children in the tree, and its whole row is the route straight into
the existing target card, where Service identity, fingerprints and every
other technical fact already live under TECHNICAL INTELLIGENCE.

SELF and its current address appear intrinsically on fresh Known Space without
a synthetic Discovery record or a claimed Network relationship. Before its
Network relationship is known, SELF offers Scan and reports NOT SCANNED. Once
its membership is legitimately observed, SELF appears as the topology anchor
inside that Network. A Device appears under every Network it is remembered in,
and a remembered Device with no remembered relationship to any known Network
stays visibly separate under ELSEWHERE with its own scope stated. Unobserved
membership is stated explicitly rather than reported as an observed empty
result, and an observed Network with no responding members says so.

Expansion is local presentation state only, and only the Network level
expands. A Network root reads open; a Device never expands and carries no
twisty of its own — its row is always the single leaf control that opens the
target card. Opening, expanding, collapsing or browsing Known Space performs
no observation and mutates no Discovery.

Two routes hang off the tree, and they are deliberately different kinds of
thing. A target row opens its card directly — there is no Device page or
Service page between. A Network root offers an administration route only where
the local Device actually holds `NetworkManagementAuthority` over it
(`docs/current/DEVICE_SYSTEM.md`); a Network merely observed is marked
OBSERVED and offers none, because observing a Network is not authority over
it. That administration detail states the Network's represented name,
connectivity, coarse member count and its own Network Activity, and never
member Device identity, address, Firmware or Services. `SCAN AGAIN` is offered
only once reconnaissance actually remembers a Network: a managed root is
authority, not memory.

A target's identity on the card and in the tree is exactly what the player has
legitimately learned. A remembered Device is presented as an UNKNOWN DEVICE at
its observed address until an Inspect actually observed the represented display
name; from then on the remembered name leads and the address supports it.
Scan and PING never observe a name, and no presentation code resolves one from
World Truth.

The target card retains concise reconnaissance, running-work, established
Access, package-submission and connection states, but no longer converts known
weaknesses into a prescribed WAY IN / BYPASS / ATTACK button. Its ACTIONS
surface separately lists the offensive Techniques for which SELF owns a
supported provider. The Technique name is primary and the concrete provider
path or integrated provider name is visible provenance. Credential Access and
Rollback are the two concrete entries; there is no module dropdown, ranking,
recommendation, compatibility score, or hidden target-truth filtering. If
neither provider is owned, ACTIONS states that no offensive Techniques are
available.

An owned Technique with no currently formed execution context (no remembered
Knowledge/route yet, or Rollback already spent on this target) stays listed —
its name and provider provenance remain legible — rather than being hidden.
It is presented with a restrained unavailable mark rather than a large
disabled EXECUTE control paired with repeated explanatory copy, so an
unavailable Technique reads as quietly unavailable rather than as a broken
configuration form. A Technique whose own attempt is currently running against
this target states itself as running in the same place, in place of EXECUTE,
rather than continuing to offer a control that can only answer ALREADY
RUNNING; this never hides an owned Technique that is not the one running.

A running stage — Service Analysis, Credential Access, Rollback's attack, or
package submission — presents that work as an execution surface rather than a
bare headline and percentage. It states the operation's own name, the facts
the running work itself already carries (the endpoint it was actually started
against, the provider the canonical resolver actually selected, the remembered
weakness or package it concerns) and canonical progress, plus a restrained
live indicator. Every stated fact is either the running Process's or
submission's own canonical field or Player Information the player already
holds; nothing is invented for atmosphere, and no new canonical state, phase,
or duration is introduced. Where this surface already draws a Service's
analysis progress, that Service states under TECHNICAL INTELLIGENCE that it is
analyzing instead of repeating the same progress a second time on the same
screen; where the headline belongs to something else (an active Session, for
example), the Service row remains the only place that progress is shown. A
completed running operation may settle with a brief presentation-only
transition, and a Device newly observed in Known Space may likewise arrive
rather than simply appear; neither creates canonical state, and both respect
reduced motion.

Manual Inspect is deliberately absent from that progression: it is optional
depth under TECHNICAL INTELLIGENCE, not a step the ordinary SCAN → HACK →
CONNECT line passes through, so installing NodeScan 1.1 Experimental never
displaces a route the player has learned or a relationship they already hold.
`service_unavailable` analysis remains inconclusive and retryable. An absence
of Knowledge immediately after Scan is not a negative conclusion. A live
Remote Session remains the highest-priority truth, and represented running work
remains visible.


A concrete attempt context is derived from the player's own Knowledge of a
weakness on a remembered Service together with a concrete owned provider, and
not from any current target truth. The initial standalone
Credential Access Module supports `AUTH-017` directly; a later installed
Flipper build supports it after integrating that same module. Without either
concrete source no action is formed, the Knowledge that produced it is
untouched, and the started attempt still carries its `toolId`, `moduleId` and
`vulnerabilityId`. The canonical resolver selects the actual local source —
preferring an integrated Flipper build when it supports the technique and
otherwise using the exact standalone module — and NodeScan names that source
and module without moving capability selection into presentation. Availability never predicts success; stale Player Information can
still produce a legitimately failed attempt, which is reported coarsely while
the same route stays available.

TECHNICAL INTELLIGENCE is one disclosure on the target card carrying the
copyable address, remembered Inspect evidence (including the observed display
NAME where one was observed) and its capability note, the manual INSPECT
action, the provenance of established Access, and the remembered Services with
their endpoints, fingerprints, weaknesses and per-Service
Analyze action, and RackUpdate's package-submission lifecycle. Opening it
browses remembered information: it performs no observation and starts no
gameplay. Unobserved depth is stated explicitly there and never rendered as an
observed empty result.

Manual INSPECT is offered inside that disclosure wherever the installed
NodeScan release supplies Inspect, with concise contextual copy stating what
Inspect adds over Scan rather than a tutorial. Its availability is announced on
the collapsed disclosure itself (INSPECT AVAILABLE) while the target has no
remembered Inspect evidence, so optional depth stays discoverable without
occupying the target's primary decision.

RackUpdate's package-submission lifecycle is projected when remembered
Enhanced Inspect evidence includes its package-submission interface and earned
`UPD-001` Knowledge explains it. Its technical facts remain in TECHNICAL
INTELLIGENCE, while Rollback is a separately named ACTION when its exact
standalone provider is owned or the current installed Flipper build integrates
it. EXECUTE starts the existing real
finite `rack_update_exploit` Process (see Service Analysis / Credential Access
above for the shared Process model) and shows its own progress while running.
Once that Process completes successfully, RackUpdate grants the player's local
Device a narrow `RackUpdateSubmissionAccess` relationship scoped to exactly
that Service — never `DeviceAccess`, never a `RemoteSession`, and never
filesystem or credential authority. Only then does the interface describe the
need for a compatible GateSSH package and list only candidate package
artifacts in SELF's canonical filesystem, identified by stable local file ID:
any remembered GateSSH release differing from the remembered current one,
older or newer alike, since RackUpdate's submission protocol is a general
package-submission mechanism rather than an older-package-only one; `UPD-001`
("Rollback protection not enforced") remains the specific explanation for why
a rollback to an *older* release in particular is accepted. With no candidate
it reports `None`. It does not reveal a hidden package, path, source Device,
or prescribed next observation. A completed submission's own `PACKAGE
ACCEPTED` / `REBOOT REQUIRED` outcome is stated inside this same
package-submission technical context, never as the target's own high-level
status: that headline area stays reserved for state that genuinely describes
the whole target, and a subsystem-specific outcome like this one stays
visually owned by the subsystem — RackUpdate — that produced it.

This projection reads no hidden target World Truth to label the opportunity,
predict success or refresh a fingerprint: Rollback execution context,
progress, and the narrow submission capability are all derived from the
player's own Knowledge, installed software, Process, and `RackUpdateSubmissionAccess`
state alone.

At completion, Service Analysis Process history associates the result with a
remembered implementation fingerprint only when that evidence matches the
current Service implementation the Process actually resolves. Where a current
remembered fingerprint exists, a completed result is current only when its
association matches; after a later legitimate observation refreshes the
remembered fingerprint, an older result remains historical and the newly remembered
implementation requires fresh analysis. RackUpdate submission completion itself
does not refresh that evidence because its accepted release is not yet active.
This comparison uses Discovery and
Process history; World Truth is consulted only by the gameplay completion that
already owns result resolution, never by NodeScan. Completed analyses without
an implementation association remain supported for the NodeScan 1.0 flow but
do not suppress fresh analysis once a concrete fingerprint is remembered.

Because there is no canonical "analyzed" state, a Service that has not
produced Knowledge claims no analysis state at all. A completed no-weakness or
service-unavailable analysis result is stated beside its repeatable Analyze
action as disposable Process history and is never promoted into permanent
memory.

Known Space's Network and Device expansion is progressive disclosure over
remembered relationships, not a navigation hierarchy: there is still no Device
page and no Service page, and a Service row on the tree carries no action of
its own. The one openable Network route is a managed Network's own
administration detail, which is management authority rather than
reconnaissance. Network Inspect remains available through Terminal
`inspect <network-name>`, and remembered Network Inspect evidence is
unaffected.


The four reconnaissance roles are distinct observations, not mandatory progression stages or stored flags:

```text
PING address
→ observe response; retain only identity and address

SCAN known Device
→ observe currently open represented Services

SCAN SELF
→ may also observe SELF's represented Network relationship

SCAN known Network
→ observe currently responding represented member Devices

INSPECT known target
→ observe deeper represented target evidence within release capability

ANALYZE known Service
→ canonical elapsed Service Analysis Process; may earn weakness Knowledge
```

A foreign Device Scan does not reveal Network membership. NodeScan 1.0 Standard supplies PING, SCAN, and Service Analysis but no target Inspect. NodeScan 1.1 Experimental supplies the same roles plus Enhanced Inspect through concrete release capability logic.

The opening Scan sequence is therefore:

```text
ip
↓
scan SELF address
↓
discover home-net
↓
scan home-net
↓
discover LAN server
↓
scan LAN server
↓
discover represented SSH and HTTP services
```

IPv4 Scan results currently distinguish:

- `SELF`
- `LAN`
- `REMOTE`

according to represented world relationships.

Successful positive Scan observations are remembered in canonical Discovery. A later successful Device Scan replaces the prior exposed-Service snapshot while preserving unrelated Knowledge and applicable deeper evidence. Observations are retained snapshots, not live references to World Truth: later address, Service, Firmware, or implementation changes do not rewrite or erase remembered information. Only a later legitimate observation refreshes its own information boundary. Analyze Knowledge has the same historical boundary.

Opening or navigating remembered information in the graphical Scan application
does not itself perform a new observation.


## Target discovery and explicit target actions

NodeScan keeps target SCAN, explicit INSPECT, and per-Service ANALYZE as separate player decisions over the same canonical operations exposed by Terminal. Known-Space Network refresh composes only Scan observations and introduces no canonical state of its own.

`findTargets` (SCAN AGAIN on Known Space) is offered only after at least one
Network is remembered. It refreshes SELF's Network relationships, then observes
the responding members of every Network the player legitimately remembers.
Nothing outside remembered Discovery is
scanned, and zero-knowledge Known Space does not expose this shortcut: the
player must first Scan intrinsic SELF to remember its Network relationship. Without an installed NodeScan release it reports
`software_unavailable`; where SELF is offline it reports `no_response` and
remembers nothing.

Target SCAN invokes only the canonical Device Scan and refreshes the currently exposed Service snapshot. It never invokes Inspect or starts Service Analysis. NodeScan 1.1 Experimental presents INSPECT as an explicit target action; NodeScan 1.0 Standard does not. Each Service retains its own explicit ANALYZE action. The guided ANALYZE action may also start one independent canonical Service Analysis Process for each observed Service still requiring investigation; normal per-Process RAM admission applies and partial admission is reported.

## Inspect

Inspect currently observes one selected target's own represented properties.

Current Device Inspect may report:

- address
- scope
- online state
- SELF hardware where owned by the local Device
- represented server identity where present
- the target's represented Device display name, where the Device has one

Current Device Inspect does not enumerate services. Enhanced Device Inspect also observes the target Device’s represented LocalNetwork relationships, remembering only the inspected Device relationship and not enumerating other members.

Current LocalNetwork Inspect reports the represented network's own information,
including whether canonical membership connects SELF, without enumerating
members.

Inspect is exposed directly as `inspect <ipv4|network-name>` and as an explicit
action under TECHNICAL INTELLIGENCE on remembered Device targets in NodeScan.
Both interfaces use the same synchronous application operation.

Device display identity is observation, not automatic World Truth exposure.
World Truth owns `NetworkHost.displayName`; a non-SELF Inspect that actually
reached the target observes it and merges it into that Device's remembered
Discovery `inspect` snapshot (`DiscoveredDeviceSnapshot.inspect.displayName`),
alongside `networkStatus` and `deviceKind`, under the same re-observation and
stale-selector rules. It follows the ordinary Discovery boundary: a later
legitimate Inspect refreshes it, an Inspect that observed no name never deletes
one already remembered, no name is invented for a Device that has none, and a
rename in World Truth the player never observed changes nothing. Scan and PING
observe no name at all, which is why a Scanned-but-uninspected target is
presented as an UNKNOWN DEVICE at its address. This is a
capability of Inspect itself rather than of Enhanced depth, though only a
release that supplies Inspect can reach it at all.

Inspect and Scan are separate architectural/domain operations. Player-facing
Inspect is limited to SELF and targets justified by intrinsic or remembered
Discovery information, so an arbitrary hidden address cannot be used as an
existence oracle. Successful positive non-SELF evidence is merged into Discovery
by stable entity ID. Re-inspection refreshes shallow evidence only when the
remembered selector still resolves to that same stable identity; stale addresses
and names do not retarget to hidden current World Truth. No-response and failure
preserve earlier positive memory and do not create Knowledge. Opening an already
remembered result in NodeScan performs no observation.

The installed NodeScan release determines whether player-facing Inspect is
available. NodeScan 1.0 Standard does not supply Inspect. NodeScan 1.1
Experimental (`nodescan-1.1-experimental`) supplies Inspect with enhanced
evidence for a represented non-SELF Device
whose Firmware and hardware are concretely represented: a Firmware fingerprint
(name and version) and a derived `computeClass` (`LOW` / `STANDARD` / `HIGH`)
classifying the Device's represented CPU compute capacity. `computeClass` is a
derived reconnaissance/observation classification stored as positive player
information in Discovery. It is not raw World Truth, a universal hardware-tier
entity, or merely ephemeral presentation state; raw compute capacity is never
exposed to the player. Enhanced
evidence is merged into the same remembered Discovery `inspect` snapshot as the
shallow fields and follows the same re-observation and stale-selector rules;
downgrading to NodeScan 1.0 — by removing the installed NodeScan 1.1
Experimental override (see `docs/current/FILES_SOFTWARE.md`) — prevents later
Inspect without erasing previously remembered enhanced evidence. A
later legitimate enhanced Inspect may refresh that enhanced snapshot. Terminal
and the graphical NodeScan application present this evidence through the same
underlying `inspectTarget` application operation.

Enhanced Inspect also fingerprints only the Services already present in that
Device's Discovery snapshot. Each corresponding discovered Service stores a
historical implementation name/version observation; SSH additionally stores
the observed authentication configuration as `Credential`. These Service snapshots are separate from Device
Firmware/compute evidence, survive failed Inspect attempts and loss of the
current Inspect capability, and refresh only on another successful Enhanced
Inspect. They do not discover Services or reveal weaknesses, exploit
applicability, tools, or attack outcomes.


## Discovery

Discovery is canonical player memory of positive Scan and Inspect observations.

Current Discovery includes remembered:

- networks
- Devices
- network-to-Device relationships
- service observations
- shallow Inspect evidence for known Devices and LocalNetworks, including an
  observed Device display name where Inspect observed one

SELF is intrinsic player context and is not duplicated as a remembered
Discovery Device entry.

Successful empty observations may record that the relevant depth was observed.

Failures do not mark that observation depth complete.

Positive re-observation may update remembered snapshots.

Absence does not automatically delete previously remembered positive
information.

Remembered service observations retain the endpoint actually observed rather
than rebuilding it from a later Device address.


## Service Analysis

`analyze <ipv4:port>` and the corresponding graphical action invoke the same
Service Analysis gameplay operation.

Service Analysis creates a real Process rather than resolving immediately.

The Process:

- executes on the player's local Device
- consumes represented CPU work
- requires RAM admission
- retains stable target Device and service identity
- retains the originally selected endpoint for historical presentation

Completion resolves exactly once against current World Truth.

Successful analysis of the represented SSH weakness records positive
vulnerability Knowledge.

HTTP analysis currently records no negative Knowledge entry when no weakness is
detected.

The Process runtime itself is owned by `docs/current/PROCESSES_ACTIVITY.md`.


## Knowledge

Current Knowledge stores positive discovered vulnerability relationships.

Knowledge uses stable target and service identity.

Historical observed labels are presentation snapshots rather than gameplay
identity.

Knowledge is not automatically rewritten merely because current World Truth
later changes.


## Credential Access

The current concrete access mechanic is Credential Access.

After the player has remembered:

- the represented SSH service
- positive Weak Authentication Knowledge

and SELF owns a concrete Credential Access provider, the
player may initiate a credential attempt through:

```text
attack <ipv4:port>
```

or through NodeScan's Credential Access ACTION, which uses the concrete context
derived from the player's own Knowledge and selected owned provider. The initial
local Device owns both the specialized standalone Credential Access Module and
the ordinary installed KeyProbe 1.0 provider. NodeScan lists both as separate
Credential Access choices, without ranking or preselecting either one.

Starting the attempt creates a Credential Access Process.

It does not establish access immediately.

Completion resolves against current World Truth and validates the represented
target, current Device network usability, selected endpoint relationship, open
Service, current weakness, concrete Service implementation, and represented
credential-access context before any probability decision. Against the current
`AUTH-017` / GateSSH 1.3.2 case, the specialized module succeeds
deterministically while KeyProbe makes exactly one canonical 75% decision per
attempt. A completed result is terminal and is never rerolled. Success creates
persistent USER `DeviceAccess`; a reached probabilistic failure creates FAILURE
authentication and Network evidence but no access. An unreachable or invalid
surface creates neither reached-attempt evidence nor a probability decision.
Neither outcome rewrites historical Discovery or Knowledge.

Services remain concrete Device-owned network surfaces with no arbitrary
canonical count cap: a Device may expose zero, one, or many. Device availability
and Service availability are distinct; a running, connected Device does not
make every Service open, and one unavailable Service does not make its Device
offline. A Service is not automatically vulnerable or an offensive target.

RackUpdate 1.0 is a distinct public interaction, observed by Enhanced Inspect as `INTERFACE: Package submission`. Analysis derives `UPD-001` ("Rollback protection not enforced") from RackUpdate's current release. Knowledge alone is informative rather than submission authority: exploiting it requires the exact standalone Rollback Module or a Flipper build integrating that module. Credential Access follows the same rule for its own module and `AUTH-017`; each module's role stays equally narrow. The distributable canonical Flipper build integrates no modules, so a fresh Device supports no `UPD-001` until the Rollback Module is acquired, but integrating it into Flipper is optional. The represented software Market is currently the only concrete acquisition path for that module artifact (`docs/current/MARKET.md`), and Flipper integration is finite represented work owned by `docs/current/FILES_SOFTWARE.md`.

`AUTH-017` and `UPD-001` remain weakness identifiers owned by this document and by the service systems. The current artifacts are concrete providers of Credential Access and Rollback respectively, and compatible integration lets Flipper expose those same Techniques; the artifacts are not themselves weaknesses, Knowledge, or a universal category for Techniques. Possessing or integrating one discovers nothing, changes no remembered evidence, and creates no `discoveredVulnerabilities` entry. Reconnaissance stays entirely with NodeScan.

ATTACK against RackUpdate starts a real finite `rack_update_exploit` Process (see Service Analysis above for the shared Process model). Completion resolves against current World Truth exactly once and, on success, grants the attacking Device a narrow `RackUpdateSubmissionAccess` relationship scoped to that one RackUpdate Service (`GameState.rackUpdate.access`) — never `DeviceAccess`, never a `RemoteSession`, and no filesystem or credential authority. Failure creates no such relationship and does not rewrite historical Discovery or Knowledge, mirroring Credential Access's failure semantics.

Only a Device holding that narrow capability may submit a compatible local GateSSH package. Submission is represented finite upload work (`GameState.rackUpdate.submission`), a distinct network runtime from `GameProcess` and from `FileTransfer` — it is not a filesystem Upload and requires neither `RemoteSession` nor `DeviceAccess`. It resolves the observed stable Device and Service identities and endpoint plus a stable local file ID, admits one active submission at a time, and its effective byte rate is derived through the same Device/LocalNetwork transfer-capacity model `docs/current/DEVICE_SYSTEM.md` and `docs/current/FILES_SOFTWARE.md` describe for `FileTransfer`. Admission requires both the target's managed GateSSH Service and its represented InstalledSoftware inventory; losing either while the submission runs interrupts it. Cancelling or losing the route (an offline endpoint, a changed RackUpdate Service, missing required GateSSH state, ambiguous or invalid transfer capacity) ends the submission with no part of the package applied; a terminal outcome (COMPLETED, CANCELLED, or INTERRUPTED) appends its own Network-owned `NetworkPackageSubmissionRecord` (`kind: 'package_submission'`, never `'file_transfer'`, since a RackUpdate submission is not a FileTransfer), reusing the same membership-resolution model and the exact record shape and terminal-result semantics `FileTransfer` evidence uses rather than a parallel model, and never once per advancement tick.

Only when the upload actually completes does a valid represented GateSSH package become the target Device's one exact pending GateSSH activation, preserving product, release, build, and ordinary release metadata. Active GateSSH InstalledSoftware and the managed SSH Service remain unchanged and coherent; for `srv-02`, both therefore remain 1.3.3 and `AUTH-017` is not yet current World Truth. Completion clears the active upload and retains a separate player-interaction outcome so NodeScan can state `PACKAGE ACCEPTED` / `REBOOT REQUIRED` without reading hidden pending software. It does not refresh remembered Inspect evidence to the pending release. A target with pending GateSSH rejects another submission rather than replacing it. Cancellation, interruption, or failure creates no pending activation. The implemented real boot boundary consumes pending GateSSH coherently; for 1.3.2, `AUTH-017` then derives naturally from the changed Service World Truth while Discovery, Inspect evidence, and Knowledge remain untouched, and the now-stale `REBOOT REQUIRED` interaction outcome clears. The neutral connectivity interruption, Device recovery behavior, and `srv-02` reboot-on-disconnect cause that crosses that boundary are implemented and owned by `docs/current/DEVICE_SYSTEM.md`; DEAUTH, including its concrete provider and UI wiring, remains unimplemented.

## Reaching the represented personal phone

The represented VEYRA phone (`docs/current/DEVICE_SYSTEM.md`) is reached through
exactly the ordinary access loop above and nothing else. It is not a member of
SELF's temporary `home-net`, so Network Scan does not reveal it. Directly
scanning its communicated address discovers it as a remote Device and observes
its one open SSH Service; Service
Analysis of that Service records the same `AUTH-017` Knowledge, because its
implementation is the same represented GateSSH 1.3.2 release; the same standalone or Flipper-integrated
Credential Access Module forms the same way in; the attempt creates the same
Credential Access Process and, on success, the same USER `DeviceAccess`; and
CONNECT opens the same kind of Session.

No phone-specific weakness, tool, operation, mechanic or developer shortcut
exists. Removing every credential tool — the standalone artifact and any installed Flipper build that integrates it — removes the offer without touching the
Knowledge, exactly as for any other target. The only thing that differs after
entry is which operating surface the Shell presents.


## DeviceAccess

`DeviceAccess` is current canonical gameplay state.

A successful Credential Access attempt may establish one deduplicated
relationship containing:

- source Device identity
- target Device identity
- service path identity
- USER privilege

The current graphical NodeScan surface presents established access and active
Remote Session state as one target stage: ACCESS GRANTED offers CONNECT, and an
active Session presents CONNECTED and DISCONNECT in the same place without
deleting the underlying `DeviceAccess`. The Service the relationship was
established through is stated under TECHNICAL INTELLIGENCE as provenance; it offers
no navigation of its own and never connects automatically. Persistent Service
findings take priority over redundant successful analysis history, while useful
no-finding results remain visible as secondary information.

`DeviceAccess` is not:

- a generic hacked flag
- an active connection
- an active Remote Session
- automatic remote filesystem access
- automatic remote execution


## Remote Session

V1 represents at most one active Remote Session. `CONNECT` uses an existing
`DeviceAccess` relationship and validates only the current connection path;
Credential Attack does not connect automatically and CONNECT does not repeat
the exploit. `DISCONNECT` clears the active Session while preserving access.

Terminal `connect <ipv4>` resolves the address through remembered Discovery,
and NodeScan exposes the same shared operation as the target card's CONNECT. The Session stores
only its stable ID, the authorizing access ID, and the address used to connect;
source, target, service, and privilege remain owned by `DeviceAccess`.

An active resolvable Session first presents a Shell-owned Remote Session handoff.
The successful connect has already established canonical Session truth; the
handoff is not simulated connection progress. It ends local editing and waits
for the existing Shell editing state to recover before enabling explicit entry
to the remote environment. Accepting that presentation gate mounts the operating
environment the target Device actually runs, without changing GameState. Each
stable Session identity receives its own handoff, while disconnecting from the
handoff uses the canonical Session operation and restores the preserved NODE-OS
presentation.

Which environment that is, is selected from the target's own represented
Firmware identity rather than its mutable display name: `firmware-rack-os-v1`
mounts RACK-OS and `firmware-veyra-os-v4-1` mounts VEYRA OS. Firmware the Shell
has no implementation for mounts nothing — the handoff states that there is no
operating surface for it and offers no entry, while the Session itself remains
real, stated, and disconnectable. There is no fallback to RACK-OS and no generic
foreign-OS framework. The selection and the VEYRA surface belong to
`docs/current/VEYRA_OS.md`; everything below in this section describes RACK-OS.

After explicit entry, the Session presents the distinct RACK-OS operating
surface. Its target is resolved by stable `RemoteSession.accessId` through
`DeviceAccess.targetDeviceId`, never by the connected address. RACK-OS is an
authorized live view of current canonical target state, not a Discovery
projection, and exposes only Terminal, Files, and System. Its Terminal supports
`help`, `clear`, `ip`, `ls`, `cat`, and `disconnect`; Terminal and Files read the
same foreign Device-owned filesystem. RACK-OS Terminal also supports
`download <remote-absolute-file-path>`,
`upload <local-absolute-file-path> <remote-absolute-file-path>` and
the dynamically available shared `node-miner` product CLI (`help`, `run`, `status`, `stop`, and `payout`), RACK-OS Files
exposes `DOWNLOAD` for a selected file, and its remote directory view exposes
`UPLOAD` for the directory currently being browsed. System derives the displayed
Device, address, Firmware, role, access authority, and service path from the
target and referenced access relationship. The transfer runtime those commands
admit is owned by `docs/current/FILES_SOFTWARE.md`.

RACK-OS Files additionally exposes `INSTALL` for a software package that
already exists on the target's own filesystem, and `RUN` / `STOP` for a
supported NODE Miner executable that already exists there. The active Session is what
admits that command — it is the operating context that decides *which* Device
the player is commanding, resolved through `accessId` → target identity, never
supplied by presentation — and the DeviceAccess relationship's currently
represented `USER` privilege is the only authority V1 represents. The Session
owns admission only, not the lifetime of the work it admits: the resulting
installation Process is owned by the target Device, so `DISCONNECT` closes
RACK-OS and ends the player's observation while that Device keeps working, and
a later Session over the same still-valid access simply shows whatever is true
by then. Remote executable / `RUN` admission and artifact/control semantics are
owned by `docs/current/FILES_SOFTWARE.md`; executor-owned Process runtime and
lifetime are owned by `docs/current/PROCESSES_ACTIVITY.md`; and NODE production,
payout routing, payout artifacts, and live payout-retarget economics are owned
by `docs/current/NODE_ECONOMY.md`. RACK-OS System gains no software
management, the RACK-OS Terminal gains no package commands, and no RACK-OS
Processes application exists: the selected executable and NODE Miner software command expose only the concrete NODE Miner state they need.

Execution is the same admission-versus-lifetime distinction, taken to its
continuous case. A NODE Miner admitted this way runs on the target Device
indefinitely: returning to NODE-OS, `DISCONNECT`, and a later unrelated Session
all leave it producing and routing NODE, and reconnecting over the same
DeviceAccess observes the same still-running Process. RACK-OS Terminal reuses the same Device-scoped NODE Miner CLI as NODE-OS; its `payout` subcommand remains the deeper control path not offered by RACK-OS Files, and it changes the payout address of that already-running Miner in
place, through the shared canonical operation, and is deliberately not offered
graphically. What it does economically is owned by
`docs/current/NODE_ECONOMY.md`.

No per-application permission model exists. Terminal, Files and System are all
reached under the one `USER` DeviceAccess authority; that a future authority
might expose these surfaces independently is not represented today.

An entered RACK-OS Session can return to the preserved local NODE-OS workspace
without disconnecting. RACK-OS presents that as an explicit navigation action
(`← NODE-OS`), drawn as an action rather than as context text and kept visually
and semantically apart from `DISCONNECT`; it changes only which operating
environment is presented and never ends or pauses the Session. While local, the
Shell presents a compact control naming the retained connected address
(`RETURN REMOTE · <connectedAddress>`) that returns directly to that same
Session without another connect or handoff.
This context selection is Shell presentation state: the canonical Remote
Session, DeviceAccess, and any active FileTransfer remain intact.
Context switches release focused editing and wait for the existing Shell
viewport recovery readiness before mounting the destination environment.

NODE-OS, its Terminal, and its Files application remain bound to the local
Device even while a remote Session exists. Reading foreign files does not
mutate Discovery or Knowledge. Graphical and Terminal disconnect use the same
Session operation; disconnect preserves DeviceAccess and both Devices' state,
closes RACK-OS, and reveals the preserved local NODE-OS navigation context.
Firewall, Reachability, and pivoting remain unimplemented, and remote execution
remains narrow: one represented program, admitted from a concrete executable
artifact on the operated Device, with no generic remote-execution or shell
mechanism. Software installation admitted through RACK-OS is still remote
*work* rather than execution — it creates an artifact, never a running program,
and RUN remains a separate later admission step.


## Authentication History

Each represented resource-capable server Device also owns a bounded
Authentication History: one record per Credential Access completion that
actually reached that Device's currently online, currently open Service at
the originally selected endpoint, recording SUCCESS or FAILURE together with
a snapshot of the represented service name and the executor Device's network
address observed at that moment. It is independent of Process history,
DeviceAccess, and RemoteSession, survives their disconnection or removal, and
is not rewritten by later presentation or access changes. RACK-OS System
presents the current target's own history read-only, oldest first, without
exposing internal Device or Service IDs; an empty history shows a compact
empty state.

A Credential Access attempt that actually reaches the represented target
also appends separate Network-owned connection evidence to the participating
represented LocalNetwork(s), independent of this Device-owned history. That
model — retention, record shape, and membership/perspective placement — is
owned by `docs/current/DEVICE_SYSTEM.md`.


## Gotchas

- `DeviceAccess` ≠ RemoteSession. Established access is a persistent
  relationship; a Session is active operation of it. Disconnecting never
  removes access.
- A known or open Service is not established access, and vulnerability
  Knowledge is not access either.
- Discovery is remembered observation, not current hidden World Truth. Browsing
  remembered data is never a new observation, and a UI must not silently
  correct a stale player belief from hidden state.
- Historical observations keep the endpoint actually observed. Do not rebuild
  an endpoint from a Device's later address, and do not retarget a stale
  selector to a different current entity.
- Failure and absence never delete previously remembered positive information.
- A represented negative condition the player cannot observe (for example
  hidden current-truth conditions must never be named in failure presentation.
- RACK-OS is a live authorized view of target truth, resolved through
  `accessId` → target identity, never through the connected address.
- A Session is not the operating surface. Which environment is mounted comes
  from the target's represented Firmware identity, and unsupported Firmware is
  refused rather than shown as RACK-OS.
- A Session admits a command; it does not own the lifetime of the work that
  command started. Disconnecting never cancels admitted Device-owned work,
  never stops a Miner running on the target, and never removes DeviceAccess.
- A remote operation resolves its target only through `accessId` → target
  identity. Presentation never supplies an executor Device ID.
- A NodeScan target stage is derived presentation, not canonical state. There
  is no stored stage, no `hacked` flag, and no canonical target progress; each
  stage is recomputed from Discovery, Knowledge, Process, DeviceAccess and
  RemoteSession on every render.
- A running stage's execution surface, the RUNNING mark in place of EXECUTE,
  the brief settle transition on completion and a Device's arrival in Known
  Space are presentation over already-produced canonical state. None of them
  delays, gates, or is a precondition for the canonical operation it presents;
  Scan, Ping, Inspect and Known-Space sweep remain issued immediately, with no
  presentation timer in front of them.
- A way in is a statement about the player's Knowledge and installed software,
  never a prediction. Removing the supporting tool removes the offer without
  touching the Knowledge, and a stale endpoint can still produce a legitimate
  failed attempt.
- NodeScan target Scan, Inspect, and Analyze remain separate explicit operations.
  None relaxes the admission or information boundary of another.
- `RackUpdateSubmissionAccess` is not `DeviceAccess`. It is a narrower grant
  scoped to exactly one RackUpdate Service's own package-submission interface,
  never a privilege, filesystem, credential, or session authority.
- RackUpdate package submission is finite network runtime, not a `GameProcess`
  and not a filesystem `FileTransfer`. It never partially applies its package:
  the release swap happens exactly once, only at real upload completion.
- The internal `network` app identity (`src/apps/network/`) is NodeScan's own
  wiring, not the managed-Network administration domain — a historical naming
  detail. Do not conflate the two or derive Network management authority from
  NodeScan Discovery. NodeScan presenting both is a product composition; the
  two projections stay separately owned.
- A Device display name is remembered Player Information observed by Inspect,
  never a value presentation may resolve from World Truth. A target with no
  such evidence is an UNKNOWN DEVICE at its observed address.
- Known Space expansion is presentation state. Only the Network level
  expands; a Device is a leaf that opens its target card directly rather than
  a further expansion of the tree. Expanding a Network, or opening the
  managed-Network administration route, observes nothing and writes nothing
  to Discovery.
- Manual Inspect is optional technical depth, not a target stage. A NodeScan
  release that supplies Inspect must never insert a step into the target's
  primary decision.
- The target's high-level status area is reserved for truth that genuinely
  describes the whole target (a live stage such as ANALYZING, ATTACKING, or a
  granted Access relationship). A Service- or submission-specific outcome —
  RackUpdate's `PACKAGE ACCEPTED` / `REBOOT REQUIRED` chief among them — stays
  presented inside the subsystem that owns it and never becomes that headline.

# Network, Reconnaissance, and Access — current truth

Status: Accepted
Scope: `ip`, Scan, the NodeScan application, Discovery, Endpoint (Service)
Analysis, Knowledge, Credential Access, DeviceAccess, Remote Session / RACK-OS,
and Authentication History, as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/IDENTITY_AND_INFORMATION.md` and
`docs/architecture/DEVICES_AND_ACCESS.md`.


## Reconnaissance model (Recon V2)

Reconnaissance is a compressed, real-network-causal, evidence-driven
progression rather than a stored mandatory stage machine:

```text
ip
→ scan network
→ choose host
→ scan host
→ choose endpoint
→ analyze endpoint
→ available technique / attempt
```

`ip` reads SELF's own represented network configuration; it is not a remote
observation. `ping <ipv4>` is optional reachability evidence and is never a
prerequisite for Scan or Analysis. Network Scan (`scan <network>`) discovers
Hosts on a Network; Host Scan (`scan <ipv4>`) discovers one Host's own open
endpoints and, regardless of whether the Host is SELF, LAN, or remote, the
Host's own represented Network relationship, its routing identity, and its
represented default-Gateway clue. It does not enumerate peer Hosts; a separate
Network Scan owns membership observation. Endpoint (Service) Analysis
(`analyze <ipv4:port>`) deepens one
observed Endpoint into remembered implementation/interface evidence. Knowledge
obtained through one path does not imply every target must be processed
through the same sequence.

The former generic Recon `INSPECT` operation is retired. There is no ordinary
ongoing Recon path from Scan into ordinary generic Device identity, Firmware,
compute class, or into an implementation/version-derived named Vulnerability;
none of that is bundled into any current operation, and none of it is
represented by this slice. Endpoint Analysis is the one operation that deepens
an observed Endpoint, and it produces implementation/interface evidence only —
never a named Vulnerability. A remembered implementation fingerprint is
Discovery evidence, never automatically Knowledge.


## `ip` and local network configuration

`ip` reads current SELF `LocalNetwork` and Device World Truth directly and
presents `ADDRESS`, `NETWORK` (CIDR) and `GATEWAY`; it creates no Discovery or
Knowledge and requires no prior Ping or Scan. The local Device owns its
address; a represented `LocalNetwork` owns its `cidr` and a stable
`gatewayDeviceId` relationship to one member Router Device. The visible gateway
address resolves from that Device relationship rather than duplicated Network
address state. Missing, non-member, or ambiguous gateway truth fails closed.
Where
SELF's applicable local Network configuration cannot be resolved to exactly
one represented Network, `ip` and CIDR-target resolution fail closed
(`UNAVAILABLE` / target not accepted) rather than arbitrarily selecting one by
ordering or a mutable display name.

The initial local configuration is address `198.51.100.23` on Network
`198.51.100.0/24`, gateway `198.51.100.1`. Both authored Networks have concrete
Router Devices at their gateway addresses. The foreign Router owns an ordinary
HTTP Service backed by Basic HTTP 1.0, so Host Scan and Endpoint Analysis apply
to it exactly as to any other Device. Router state never belongs to the Network.

The freshly represented local CIDR (`198.51.100.0/24`) is accepted directly as
a Network Scan target, resolved to the same stable `home-net` Network identity
and the same canonical Network Scan operation that a Network name reaches —
never a second scan path. `resolveLocalNetwork` (`src/core/game/networkTarget.ts`)
resolves a player-visible Network name or CIDR only when it identifies exactly
one represented Network; an ambiguous match fails closed rather than
selecting arbitrarily, and CIDR resolution never leaks an unrelated hidden
Network.


## NodeScan and Scan

The graphical reconnaissance application is presented as NodeScan, first-party
reconnaissance software shipped with NODE-OS. Its current direct Terminal
commands are `ip`, `ping <ipv4>`, `scan <ipv4|network-name|cidr>`, and
`analyze <ipv4:port>`; no product namespace is required. The generic `inspect`
verb is retired and is no longer a recognized command in either interface.

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
That operation admits SELF, a uniquely resolved Network the acting Device
belongs to, or a Host/Network selector already present in Player Discovery.
Represented but undiscovered remote Hosts and Networks remain `unknown_target`;
only after admission may canonical World Truth resolve the Scan observation.
An admitted Network presentation label is converted to that Network's unique
CIDR before World resolution, so separate Networks may legitimately share a
display name without making the Player-context operation globally ambiguous.

Known Space accepts a player-supplied IPv4 address for immediate PING. Typing, pasting, or locally validating it is presentation state only. A positive PING remembers only stable Device identity and the observed address; it observes no name, Firmware, Services, vulnerabilities, Network membership, or topology. Invalid input is rejected before observation, no response creates no Discovery, and PING creates no Process. A foreign Device learned this way appears under ELSEWHERE as NOT SCANNED.

NodeScan is presented as KNOWN SPACE plus two routes off it. KNOWN SPACE
presents the shape of the player's network space; a target card owns selected
Target context; a managed Network's administration detail is the other route.
SCAN observes Services, ANALYZE may start independent Endpoint Analyses for the
observed Services, the target's ACTIONS surface executes concrete owned
Techniques, and CONNECT operates established Access. Endpoint Analysis is
deliberately not a mandatory stage; it is optional depth (see below). Known
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
(`docs/current/DEVICE_SYSTEM.md`). The managed Network name opens that route;
MANAGED is quiet secondary context. An observed Network name toggles its
remembered branch, with no administration route. Both kinds of root also have
a separate compact expand/collapse control. Browsing neither observes nor
upgrades the Network name. That administration detail states the Network's represented name,
connectivity, coarse member count and its own Network Activity, and never
member Device identity, address, Firmware or Services. Every Network root has
an explicit `SCAN NETWORK` control invoking exactly one canonical Network Scan.
A remembered Gateway clue is an ordinary sibling Device row in the same
continuous branch as SELF and other known members. It links to its focused
Device view and explicit Host Scan; neither action chains a peer Scan or
Endpoint Analysis. Its quiet GATEWAY cue describes the relationship, while its
icon and classification derive only from remembered Device classification.
Root CIDR comes from management authority for managed Networks or remembered
Discovery for observed Networks; an unknown name and a later learned name
occupy the same root.

A target's identity on the card and in the tree is exactly what the player has
legitimately learned. A remembered Device is presented at its observed
address, labeled UNKNOWN DEVICE unless NodeScan 1.2's own remembered
classification (SERVER / WORKSTATION / MOBILE DEVICE / NETWORK DEVICE — see "Generic Inspect
(retired)" above) applies instead; no current Recon V2 operation observes a
represented display name, so a remote Device stays an address regardless of
classification. Scan and PING never observe a name, and no presentation code
resolves one from World Truth.

The target card retains concise reconnaissance, running-work, established
Access, package-submission and connection states, but no longer converts known
weaknesses into a prescribed WAY IN / BYPASS / ATTACK button. Its ACTIONS
surface separately lists the offensive Techniques for which SELF owns a
supported provider. The Technique name is primary and the concrete provider
path or integrated provider name is visible provenance. Credential Access and
Rollback are the two concrete entries; there is no module dropdown, ranking,
recommendation between providers, or hidden target-truth filtering. If
neither provider is owned, ACTIONS states that no offensive Techniques are
available.

Credential Access presents two concrete tools, with the tool name primary and
`Credential Access` as secondary technique context. KeyProbe 1.0 is the broad
GateSSH provider: a fresh remembered Endpoint Analysis fingerprint selects one
of its authored profiles and supplies its compute-dependent probabilistic
`EST. SUCCESS`. GhostKey 1.0 is the specialized provider for exactly the
GateSSH 1.3.2 authentication surface: a fresh remembered GateSSH 1.3.2
fingerprint shows `TARGET · GateSSH 1.3.2` and green `COMPATIBILITY · MATCHED`.
GhostKey has no percentage because it resolves deterministically when that
exact surface is still current. Neither tool is ranked or selected
implicitly.

Both routes form from the exact Service's legitimate Discovery evidence and
owned concrete provider, not hidden World Truth. GhostKey does not consult or
require `knowledge.discoveredVulnerabilities`; its GateSSH 1.3.2 compatibility
is authored by the tool. Endpoint Analysis therefore continues to create zero
named Vulnerability Knowledge, and possession, compatibility, execution, or
Flipper integration never reveals the `AUTH-017` name. A Host Scan or an
unanalyzed Service cannot form either implementation-dependent route.

A reached attempt whose current implementation differs from the concrete
surface captured at admission resolves with canonical `surface_mismatch`
evidence and marks that exact Device + Service's remembered implementation
analysis stale. Discovery preserves the old fingerprint as historical Player
Information but no longer treats it as current: KeyProbe suppresses the old
percentage, GhostKey suppresses green `MATCHED`, both routes become
non-executable, and NodeScan says the information may be outdated and offers
`ANALYZE AGAIN` through the ordinary Service Analysis operation. Clearing
completed Process history, browsing, Host Scan, and failed analysis do not
clear this durable contradiction. Only a successful fresh Endpoint Analysis
(or another operation that genuinely observes the exact implementation) stores
the current fingerprint and clears it. A mismatch reveals no replacement
implementation and creates no Vulnerability Knowledge.

Noise, stealth, detection, trace, and security-response consequences are not
CURRENT mechanics. KeyProbe remains probabilistic and GhostKey remains
deterministic on its exact unchanged surface.

When Flipper is installed, NodeScan's Known Space masthead provides a route to
Flipper ARSENAL for collection and orientation. That route does not change the
operation boundary: ARSENAL has no execute controls, does not select or rank
targets, and does not inspect Discovery, Knowledge, or hidden World Truth.
Concrete Credential Access attempts continue to begin here in target-contextual
ACTIONS through the same provider selection and canonical operation below.

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
bare headline and percentage. A running Credential Access attempt states
itself as `ATTEMPT IN PROGRESS` (Known Space and the target card previously
read `HACKING`; that generic word remains retired only for Credential
Access — Rollback's `ATTACKING RACKUPDATE` and DEAUTH's own network-scoped
wording are unaffected). It states the operation's own name, the facts
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

Endpoint Analysis is deliberately absent from that progression: it is optional
depth under TECHNICAL INTELLIGENCE, not a step the ordinary SCAN → HACK →
CONNECT line passes through, so it never displaces a route the player has
learned or a relationship they already hold.
`service_unavailable` analysis remains inconclusive and retryable. An absence
of Knowledge immediately after Scan is not a negative conclusion. A live
Remote Session remains the highest-priority truth, and represented running work
remains visible.


A concrete Credential Access attempt context is derived only from the
player's legitimate remembered Service implementation and a concrete owned
provider. KeyProbe 1.0 has authored GateSSH 1.3.2 and 1.3.3 profiles and retains
its existing compute scaling and AuthGuard behavior. GhostKey 1.0 has one
authored compatibility, GateSSH 1.3.2, and works either from the possessed
standalone artifact or the equivalent optional Flipper integration. A started
attempt snapshots exact product, release, and build identity so resolution can
detect later surface drift without retargeting.

GateSSH releases may still own real `AUTH-017` or `AUTH-031` World Truth and
separately earned Knowledge may still describe it, but those concepts do not
form GhostKey. Under Recon V2 no ordinary Recon operation produces named
Vulnerability Knowledge; that producer remains intentionally unresolved for
systems which genuinely require it. Endpoint Analysis observes implementation
and interface evidence only.

The focused Device view starts with compact Network affiliation and a single
Device identity root, followed by its own Service → implementation evidence
tree. Thin CSS rails and elbows continue Known Space's relationship language.
It never repeats peer addresses or Network membership. The Device root states
its observed address and legitimately remembered classification; each Service
states its name, port and protocol, with deeper software identity only where
Endpoint Analysis observed it. An unscanned Device explicitly states that
Services were not observed. Status and canonical actions use compact controls;
repeated Host observation is consistently labeled SCAN. Network Scan remains
on the Network root in Known Space. TECHNICAL INTELLIGENCE precedes ACTIONS,
keeping explicit per-Service ANALYZE, endpoint references and detailed evidence
available before offensive Techniques. Navigation to a different object starts
at the top of that object's scroll region.

Every status mark this view draws is deliberately weak, because
`servicesObserved` proves only that a past Host Scan found the Device
and its Services — a historical fact, never a live guarantee. The Device row
therefore states `OBSERVED` in a neutral tone once Services have ever been
legitimately observed, `NO RESPONSE` where the current visit's own most
recent Scan against this exact target failed to reach it, and no
mark at all where neither applies; that mark is derived from the concrete
request's own outcome, never from hidden current connectivity truth, and it
is not remembered — leaving and reopening the target starts the read over.
NodeScan has no legitimate route to a narrower runtime state such as
RECONNECTING or REBOOTING, or to live per-Service availability, so this view
never claims either: every remembered Service row carries the same neutral
`OBSERVED` mark in the same compact status slot, established now so a later
mechanic that legitimately knows a Service's own ONLINE / OFFLINE / STARTING
/ DISABLED / NO RESPONSE state can occupy that slot without reshaping the
hierarchy around it. A DEAUTH attempt currently running against this
Device's Network marks the Network row itself, never the Device or a Service
row, keeping DEAUTH visibly Network-scoped. Only that Network-row mark uses
the shared animated live indicator, because it is the one mark here that
describes a genuinely running canonical Process; every other mark is a
static fact. The former separate STATUS field under TECHNICAL
INTELLIGENCE's OBSERVED facts is retired as redundant with the Device row's
own mark. The type/NAME/FIRMWARE/COMPUTE `observed` slot the Device row and
TECHNICAL INTELLIGENCE both still carry in their data model is populated only
by the retired generic Inspect operation, which has no current writer, so it
currently stays absent for every target.

TECHNICAL INTELLIGENCE is one disclosure on the target card carrying the
copyable address, the provenance of established Access, and the remembered
Services with their endpoints, remembered software and per-Service Analyze
action, and RackUpdate's package-submission lifecycle. A Service's SOFTWARE
list leads with its remembered implementation fingerprint. The ordinary
Service card does not repeat the generic credential-access condition or expose
canonical vulnerability IDs and weakness labels; where analysis has produced
Knowledge, it gives only a restrained acknowledgement while ACTIONS continues
to derive executable Techniques from that unchanged Knowledge. Opening it
browses remembered information: it performs no observation and starts no
gameplay. Unobserved depth is stated explicitly there and never rendered as an
observed empty result.

The generic Inspect action this disclosure previously offered is retired.
There is no `INSPECT` button in NodeScan, no `inspect` Terminal command, and
no `GameActions.inspectTarget` application operation, under any installed
NodeScan release. Endpoint Analysis (ANALYZE, per Service) is the only
ordinary Recon operation that deepens an observed Endpoint.

RackUpdate's package-submission lifecycle is projected when remembered
Endpoint Analysis evidence includes its package-submission interface and earned
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

At completion, Endpoint Analysis Process history associates the result with a
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

Endpoint Analysis never produces `discoveredVulnerabilities` Knowledge, so a
Service's completed analysis state is entirely decoupled from Knowledge: a
Service can be legitimately analyzed (`analysisOutcome: 'analysis_complete'`)
with zero Knowledge to show for it, exactly like one whose analysis reported
`service_unavailable`. Both outcomes are stated beside the Service's
repeatable Analyze action as disposable Process history and are never
promoted into permanent memory; a Service the player has not analyzed at all
states no analysis outcome.

Known Space's Network and Device expansion is progressive disclosure over
remembered relationships, not a navigation hierarchy: there is still no Device
page and no Service page, and a Service row on the tree carries no action of
its own. The one openable Network route is a managed Network's own
administration detail, which is management authority rather than
reconnaissance. The retired generic Inspect operation is gone from every
interface: there is no `inspect <network-name>` (or any other) Terminal
command.


The canonical reconnaissance operations are distinct observations, not mandatory progression stages or stored flags:

```text
ip
→ read current SELF address, Network CIDR, and gateway; no observation

PING address
→ observe response; retain only identity and address

SCAN known Network / CIDR
→ observe currently responding represented member Devices (Network Scan)

SCAN known Device
→ observe currently open represented Services (Host Scan); also observe the
  Host's own owned represented Network relationship (stable identity and
  routing identity, never the Network's own mutable display name) and the
  Network's other represented Hosts as shallow peers

SCAN SELF
→ Host Scan follows exactly the same rule as any other Host — no SELF-only
  Recon path

ANALYZE known Endpoint
→ canonical elapsed Endpoint (Service) Analysis Process; remembers
  implementation/interface evidence, never Vulnerability Knowledge
```

A Host Scan never deep-scans a peer it incidentally reveals: the peer is
remembered only as a shallow UNKNOWN DEVICE observation (identity, address,
and Network relationship), and the player must Scan it individually to learn
its own Endpoint surface. A Host Scan's Network relation is resolved from
represented membership alone (`resolveDeviceNetwork`,
`src/core/game/networkTarget.ts`) and fails closed — revealing no relation at
all — where represented membership cannot be resolved to exactly one Network,
rather than arbitrarily selecting one. Where only a Host-Scan-owned relation
is remembered, Known Space and the target card present the Network under a
neutral `UNKNOWN NETWORK <cidr>` identity (or bare `UNKNOWN NETWORK` where no
CIDR is represented either); only a separate, genuine Network Scan — by name
or by CIDR — earns the Network's own mutable display name, and once earned it
is never overwritten or erased by a later Host-Scan-only observation of that
same Network.

Every installed NodeScan release — 1.0 Standard, 1.1 Experimental, and 1.2
Standard (`nodescan-1.2-standard`, canonical build
`build-nodescan-1.2-standard-v0`) — supplies the same core `ip`, PING, Network
Scan, Host Scan, and Endpoint Analysis operations; no release restores the
retired generic Inspect path. NodeScan 1.2 Standard additionally supplies
Network Refresh, Live Topology Monitoring, Integrated Intelligence, and Device
classification (see "Generic Inspect (retired)" below). Network Refresh
repeats the canonical Network Scan for one remembered Network; it composes no
further observation of its own — in particular it never Analyzes or deepens
remembered member Devices — so a Network Refresh only ever refreshes evidence
Network Scan itself owns, classification included where 1.2 is installed at
refresh time. All release behavior is selected through concrete release
identity capability logic, never presentation version parsing.

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

NodeScan keeps PING, target SCAN, Network SCAN NETWORK, and per-Service ANALYZE
as separate player decisions over the same canonical operations exposed by
Terminal. No player-facing control scans SELF and several Networks in a batch.
The legacy `findTargets` adapter is narrowed to one SELF Host Scan and is not
exposed by NodeScan. A target Network refresh introduces no canonical state of
its own and repeats only that one Network Scan.

Target SCAN invokes only the canonical Device (Host) Scan and refreshes the currently exposed Service snapshot. It never invokes Endpoint Analysis. Every installed NodeScan release presents the same target SCAN; the retired generic Inspect target action is present under no release. Each Service retains its own explicit ANALYZE action. The guided ANALYZE action may also start one independent canonical Endpoint Analysis Process for each observed Service still requiring investigation; normal per-Process RAM admission applies and partial admission is reported.

## Live topology monitoring and integrated intelligence

Known Space owns Network membership and peer Devices. The focused Device view
shows only compact Network affiliation and the selected Device's own Services
and implementation evidence; it does not render the contextual member summary
available in the underlying projection.

NodeScan 1.2's topology status is an ephemeral projection, never Discovery or Knowledge. Its represented monitoring capability may read only the current target Device operational state and the current open state of that Device's already-observed Services. Device status maps canonical `RUNNING` + `CONNECTED` to `ONLINE`, `SHUTTING_DOWN` to `SHUTTING DOWN`, `BOOTING` to `BOOTING`, `RECONNECTING` to `RECONNECTING`, and other unavailable combinations to `OFFLINE`. Service V1 status is only `ONLINE`, `OFFLINE`, or `CLOSED`, derived from Device usability and the Service's represented `open` field; there is no independent Service lifecycle, recovery phase, or timer.

A currently usable `DeviceAccess` is a separate, narrower live-observation cause. It authorizes Device status and only the exact `viaServiceId` status while SELF and the target are network-usable and that Service remains open. The historical relationship remains when those conditions disappear, but its telemetry authority disappears immediately and presentation falls back to neutral `OBSERVED` unless NodeScan 1.2 independently monitors the target. Access through SSH never exposes an unrelated Service. DEAUTH still authors only Network connectivity interruption; Device-owned lifecycle changes are what the live projection subsequently reports.

Integrated Intelligence makes a remembered software row interactive only when NodeScan 1.2 is installed and existing evidence supplies details. GateSSH weakness explanations are release-aware and are sourced entirely from existing `knowledge.discoveredVulnerabilities` for that exact Service, scoped to the legitimately observed implementation the row names — never from Endpoint Analysis itself, which creates no Knowledge. Historical `AUTH-017` Knowledge scoped to GateSSH 1.3.2 therefore does not read as a current vulnerability when the same Service is later observed as GateSSH 1.3.3, and `AUTH-031` remains an entirely independent Knowledge entry. A completed successful Credential Access Process may enrich only its exact Service, weakness, release evidence and concrete provider; a probabilistic failure proves neither incompatibility nor ineffectiveness. AuthGuard compatibility and its supported SSH protection role are AuthGuard-owned intelligence, gated by a remembered Discovery observation of it; no current operation produces that observation, so this row is never currently populated even though AuthGuard's own protection still applies at Credential Access resolution (see the Credential Access section above). There is no separate `KNOWN INFO` affordance: the concrete software row toggles the detail when information exists, while a row without details does not signal interactivity. Known Information remains a read-only projection of legitimate Player Knowledge and represented historical evidence: opening the local disclosure performs no observation, starts no Analyze, and mutates no state. Internal weakness IDs are not its player-facing title. SCAN establishes observations; ANALYZE remains the action that deepens an Endpoint, but genuine weakness Knowledge is earned only by the separately owned Knowledge mechanic, never by Analyze itself.

## Generic Inspect (retired)

The former generic Recon `INSPECT` operation — a single observation that could
report Device identity, Firmware, compute class, LocalNetwork relationships,
and Service implementation/interface fingerprints all at once, gated by
installed NodeScan release tier — is retired. There is no `inspect` Terminal
command, no NodeScan INSPECT action or button, no `GameActions.inspectTarget`
application operation, and no `nodeScanSupportsInspect` release-capability
check anywhere in the current implementation. `src/core/game/inspect.ts` and
`src/app/localInspectOperation.ts` no longer exist.

Device-level evidence that operation used to remember — a represented Device
display name, `deviceKind`, Firmware fingerprint, and derived `computeClass`
— has no current successor operation, with one narrow exception: NodeScan 1.2
Standard's own passive Device **classification** capability
(`nodeScanSupportsDeviceClassification`, `src/core/game/software.ts`), which
is not a restoration of Inspect. It is attached to an ordinary legitimate
Scan or Refresh observation rather than a separate operation, button, or
Terminal command, and it observes strictly less than Inspect did: only which
of the smallest currently represented `DeviceType` categories
(`src/core/game/deviceClassification.ts`) a Host maps to — `SERVER`,
`WORKSTATION` (World Truth `NODE`), `MOBILE DEVICE` (World Truth
`PHONE`), or `NETWORK DEVICE` (World Truth `ROUTER`) — never a display name,
Firmware, compute class, or AuthGuard
evidence. Classification is a distinct information class from identity: it
states what *kind* of Device this is, never its concrete name (a
classification of `SERVER` never implies, and is never accompanied by, a
concrete identity like `srv-02`). Under NodeScan 1.2, Host Scan classifies the
Host it directly observes, while Network Scan/Refresh may classify each member
Device it genuinely observes without Host Scanning it or learning its Services
or endpoint implementations. A Device with no represented `DeviceType` mapping
earns no classification and presents as `UNKNOWN DEVICE`; below NodeScan 1.2,
neither observation fabricates new classification. Classification is ordinary Discovery evidence, not a live
projection: only a Scan or Refresh actually performed while NodeScan 1.2 is
installed writes or refreshes it; installing 1.2 alone never retroactively
classifies an already-remembered Device; downgrading or removing 1.2 never
erases an already-remembered classification; and a hidden World Truth change
never silently refreshes it — only another legitimate 1.2 observation may.

Beyond classification, the `DiscoveredDeviceSnapshot.inspect` shape
(`displayName`, `deviceKind`, `networkStatus`, `enhanced.firmware`,
`enhanced.computeClass`, `enhanced.authGuard`) remains part of the Discovery
data model, since Credential Access's AuthGuard-aware estimate math still
reads `enhanced.authGuard` when present, but nothing currently writes it: a
remembered Device's display name, Firmware, compute class, and AuthGuard
protection remain unobserved, and AuthGuard is never currently presented as
remembered intelligence even though its protection still genuinely applies at
Credential Access resolution (`docs/current/NETWORK_ACCESS.md` Credential
Access section). This is an accepted, current gap in this slice's information
depth — not a defect to be worked around by inventing a new observation route
for it, and not one classification is intended to close.

The replacement for what generic Inspect did at the *Endpoint* level —
implementation name/version, and narrow authentication/package-submission
interface evidence — is Endpoint (Service) Analysis; see below.


## Discovery

Discovery is canonical player memory of positive Scan, PING, and Endpoint
Analysis observations.

Current Discovery includes remembered:

- networks — stable identity always; `cidr` and/or `name` once legitimately
  earned (a Host Scan's incidental relation earns only `cidr`; only a genuine
  Network Scan, by name or CIDR, earns `name`); `membersObserved`
- Devices — including shallow peer observations a Host Scan's Network
  expansion remembers (identity, address, and Network relationship only,
  `servicesObserved: false`) until the player Scans that peer individually
- network-to-Device relationships
- service observations
- per-Service Endpoint Analysis evidence (`DiscoveredServiceSnapshot.inspect`:
  implementation name/version, and narrow `authentication` /
  `interface` evidence) for known Devices, keyed by stable Service identity
- NodeScan 1.2's own remembered Device classification
  (`DiscoveredDeviceSnapshot.classification`), where a legitimate Scan or
  Refresh performed while 1.2 was installed supplied one (see "Generic
  Inspect (retired)" above)

SELF is intrinsic player context and is not duplicated as a remembered
Discovery Device entry.

Successful empty observations may record that the relevant depth was observed.

Failures do not mark that observation depth complete.

Positive re-observation may update remembered snapshots.

Absence does not automatically delete previously remembered positive
information.

Remembered service observations retain the endpoint actually observed rather
than rebuilding it from a later Device address.


## Endpoint (Service) Analysis

`analyze <ipv4:port>` and the corresponding graphical ANALYZE action invoke
the same canonical Endpoint Analysis gameplay operation. It is the one
ordinary Recon operation that deepens an observed Endpoint past Network/Host
Scan's surface facts, and it begins only from an Endpoint the player has
legitimately remembered through prior Scan.

Endpoint Analysis creates a real Process rather than resolving immediately.

The Process:

- executes on the player's local Device
- consumes represented CPU work
- requires RAM admission
- retains stable target Device and service identity
- retains the originally selected endpoint for historical presentation

Completion resolves exactly once against current World Truth, validating the
current canonical Device and Service. A successful completion (`status:
'analysis_complete'`) remembers the endpoint's represented implementation
name/version in Discovery, plus narrow `authentication` evidence (`Credential`,
where the current Service carries a credential-access condition) and narrow
`interface` evidence (`Package submission`, where the current Service is
RackUpdate 1.0). An unavailable or stale endpoint produces only the Process's
`service_unavailable` result.

Endpoint Analysis never creates, updates, or reads
`knowledge.discoveredVulnerabilities`. It is not a vulnerability scanner: it
remembers implementation/interface evidence only, and never a named
Vulnerability, an attack-eligibility flag, or any other derived weakness
conclusion. This holds regardless of which Service or implementation is
analyzed — there is no case in current code where analyzing GateSSH 1.3.2,
GateSSH 1.3.3, or RackUpdate 1.0 alone creates `AUTH-017`, `AUTH-031`, or
`UPD-001` Knowledge. It is acceptable, and intentional, that the fresh current
game therefore has no ordinary Recon path that earns any of that Knowledge; a
future represented artifact-interpretation mechanic is the accepted, not-yet-
implemented, future owner of that gap (see `docs/FUTURE.md`) and must not be
approximated by inferring Knowledge from a fingerprint anywhere in Recon,
route formation, or presentation.

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

GhostKey 1.0 forms once SELF possesses its exact supported standalone
artifact (or its exact capability is integrated into Flipper), the target
Service is remembered, and a fresh Endpoint Analysis remembers that exact
Service as GateSSH 1.3.2. It does not require Flipper or named `AUTH-017`
Knowledge. KeyProbe 1.0 likewise forms from a fresh remembered implementation
supported by its own authored profiles. NodeScan lists both owned tools even
without a current route, but offers `START ATTEMPT` only when the selected
Service has fresh compatible implementation evidence and access is not already
established. The contextual operation derives the attacked implementation from
Discovery rather than accepting caller-supplied surface identity.

Starting the attempt creates a Credential Access Process.

It does not establish access immediately.

Completion resolves against current World Truth and validates the represented
target, current Device network usability, selected endpoint relationship, open
Service, and represented credential-access context before any probability
decision — both tools validate that the Service's current implementation identity still
exactly matches the concrete surface captured at admission. Against GateSSH
1.3.2, GhostKey succeeds deterministically while KeyProbe makes exactly one
canonical, current-executor compute-dependent decision per attempt using the
concrete profile matching its remembered implementation. A completed result is
terminal and is never rerolled. Success creates persistent USER `DeviceAccess`;
a reached probabilistic failure creates FAILURE authentication and Network
evidence but no access. If the endpoint no longer reaches the intended current
Device and open Service, completion creates no reached-attempt evidence and
makes no probability decision. If the attempt reaches that Service but its
attacked surface — GhostKey's or KeyProbe's remembered GateSSH implementation — or its Credential Access condition is no
longer valid, completion records the reached FAILURE through the existing
evidence owners but still makes no probability decision. A reached surface mismatch preserves the historical fingerprint while marking that exact Service analysis stale; it never rewrites Knowledge or reveals the replacement implementation.

Services remain concrete Device-owned network surfaces with no arbitrary
canonical count cap: a Device may expose zero, one, or many. Device availability
and Service availability are distinct; a running, connected Device does not
make every Service open, and one unavailable Service does not make its Device
offline. A Service is not automatically vulnerable or an offensive target.

RackUpdate 1.0 is a distinct public interaction, observed by Endpoint Analysis as `INTERFACE: Package submission`. `UPD-001` ("Rollback protection not enforced") is a release-owned fact `vulnerabilitiesForService` derives from RackUpdate's current release; Endpoint Analysis itself never creates or reads that Knowledge, so earning it currently requires the separately owned Knowledge mechanic, not Analysis. Knowledge alone is informative rather than submission authority: exploiting it requires the exact standalone Rollback Module or a Flipper build integrating that module. GhostKey differs deliberately: its exact GateSSH 1.3.2 compatibility forms from fresh implementation evidence without named Vulnerability Knowledge. The distributable canonical Flipper build integrates no modules, so a fresh Device supports no `UPD-001` until the Rollback Module is acquired, but integrating it into Flipper is optional. The represented software Market is currently the only concrete acquisition path for that module artifact (`docs/current/MARKET.md`), and Flipper integration is finite represented work owned by `docs/current/FILES_SOFTWARE.md`.

`AUTH-017` and `UPD-001` remain weakness identifiers owned by this document and by the service systems. The current artifacts are concrete providers of Credential Access and Rollback respectively, and compatible integration lets Flipper expose those same Techniques; the artifacts are not themselves weaknesses, Knowledge, or a universal category for Techniques. Possessing or integrating one discovers nothing, changes no remembered evidence, and creates no `discoveredVulnerabilities` entry. Reconnaissance stays entirely with NodeScan.

ATTACK against RackUpdate starts a real finite `rack_update_exploit` Process (see Service Analysis above for the shared Process model). Completion resolves against current World Truth exactly once and, on success, grants the attacking Device a narrow `RackUpdateSubmissionAccess` relationship scoped to that one RackUpdate Service (`GameState.rackUpdate.access`) — never `DeviceAccess`, never a `RemoteSession`, and no filesystem or credential authority. Failure creates no such relationship and does not rewrite historical Discovery or Knowledge, mirroring Credential Access's failure semantics.

Only a Device holding that narrow capability may submit a compatible local GateSSH package. Submission is represented finite upload work (`GameState.rackUpdate.submission`), a distinct network runtime from `GameProcess` and from `FileTransfer` — it is not a filesystem Upload and requires neither `RemoteSession` nor `DeviceAccess`. It resolves the observed stable Device and Service identities and endpoint plus a stable local file ID, admits one active submission at a time, and its effective byte rate is derived through the same Device/LocalNetwork transfer-capacity model `docs/current/DEVICE_SYSTEM.md` and `docs/current/FILES_SOFTWARE.md` describe for `FileTransfer`. Admission requires both the target's managed GateSSH Service and its represented InstalledSoftware inventory; losing either while the submission runs interrupts it. Cancelling or losing the route (an offline endpoint, a changed RackUpdate Service, missing required GateSSH state, ambiguous or invalid transfer capacity) ends the submission with no part of the package applied; a terminal outcome (COMPLETED, CANCELLED, or INTERRUPTED) appends its own Network-owned `NetworkPackageSubmissionRecord` (`kind: 'package_submission'`, never `'file_transfer'`, since a RackUpdate submission is not a FileTransfer), reusing the same membership-resolution model and the exact record shape and terminal-result semantics `FileTransfer` evidence uses rather than a parallel model, and never once per advancement tick.

Only when the upload actually completes does a valid represented GateSSH package become the target Device's one exact pending GateSSH activation, preserving product, release, build, and ordinary release metadata. Active GateSSH InstalledSoftware and the managed SSH Service remain unchanged and coherent; for `srv-02`, both therefore remain 1.3.3 and `AUTH-017` is not yet current World Truth. Completion clears the active upload and retains a separate player-interaction outcome so NodeScan can state `PACKAGE ACCEPTED` / `REBOOT REQUIRED` without reading hidden pending software. It does not refresh remembered Endpoint Analysis evidence to the pending release. A target with pending GateSSH rejects another submission rather than replacing it. Cancellation, interruption, or failure creates no pending activation. The implemented real boot boundary consumes pending GateSSH coherently; for 1.3.2, `AUTH-017` then derives naturally from the changed Service World Truth while Discovery, remembered Endpoint Analysis evidence, and Knowledge remain untouched, and the now-stale `REBOOT REQUIRED` interaction outcome clears. The neutral connectivity interruption, Device recovery behavior, and `srv-02` reboot-on-disconnect cause that crosses that boundary are implemented and owned by `docs/current/DEVICE_SYSTEM.md`; DEAUTH, including its concrete provider and UI wiring, remains unimplemented.

## Reaching the represented personal phone

The represented VEYRA phone (`docs/current/DEVICE_SYSTEM.md`) is reached through
exactly the ordinary access loop above and nothing else. It is not a member of
SELF's temporary `home-net`, so a Network Scan of `home-net` does not reveal
it. Directly scanning its communicated address discovers it as a remote
Device and observes its one open SSH Service — and, like any Host Scan,
incidentally reveals its own represented foreign Network relationship and
that Network's other represented Hosts as shallow peers, never their Services
or identity. Service Analysis of that Service remembers GateSSH 1.3.2
implementation evidence and creates no named Vulnerability Knowledge; the same
standalone or Flipper-integrated GhostKey forms from that fresh evidence; the attempt creates the same
Credential Access Process and, on success, the same USER `DeviceAccess`; and
CONNECT opens the same kind of Session.

No phone-specific weakness, tool, operation, mechanic or developer shortcut
exists. Removing every credential tool removes the offer without touching
Discovery or Knowledge, exactly as for any other target. The only thing that differs after
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
and `firmware-rack-os-v1-1-business` both mount RACK-OS (`isRackOsFirmwareId`),
and `firmware-veyra-os-v4-1` / `firmware-veyra-os-v4-2` both mount VEYRA OS.
Each pair really is one operating system; which release a Device runs stays its
own distinct Firmware identity, and the environment's own presentation — not
this dispatch — is what differs between its releases. Firmware the Shell
has no implementation for mounts nothing — the handoff states that there is no
operating surface for it and offers no entry, while the Session itself remains
real, stated, and disconnectable. There is no fallback to RACK-OS and no generic
foreign-OS framework. The selection and the VEYRA surface belong to
`docs/current/VEYRA_OS.md`; everything below in this section describes RACK-OS.

After explicit entry, the Session presents the distinct RACK-OS operating
surface. Its target is resolved by stable `RemoteSession.accessId` through
`DeviceAccess.targetDeviceId`, never by the connected address. RACK-OS is an
authorized live view of current canonical target state, not a Discovery
projection, and exposes exactly three operating surfaces — Terminal, Files, and
System.

Two represented RACK-OS releases present those three surfaces very differently,
and which one a Device presents is read from its own stable Firmware identity:

```text
RACK-OS 1.0            technical era
                       one section bar: TERMINAL / FILES / SYSTEM
                       no home, no launcher, no application

RACK-OS 1.1 Business   primitive application-shell era
                       opens on an APPLICATIONS home
                       TERMINAL / FILES / SYSTEM / BUSINESS as built-in applications
                       an open application returns to APPLICATIONS
```

RACK-OS 1.0 has no `OPERATIONS` section and no business surface of any kind:
1.0 simply provides no application shell to present one in. Removing that
section changes no Business Branch, Company, sale, settlement configuration,
filesystem or finance.

RACK-OS 1.1 Business always lists a built-in `BUSINESS` application —
unconditionally, exactly like Terminal, Files and System, and never as
InstalledSoftware. Opening it resolves the operated Device's actual
represented LocalNetwork membership and the Business Branch(es) explicitly
associated with those Networks (`resolveBusinessOperatingContext`,
[`BRANCH_COMMERCE.md`](BRANCH_COMMERCE.md)). A Device whose Network has no
associated Branch (an upgraded srv-01, for instance) still lists BUSINESS and
truthfully states that no Business is configured — that is legitimate
represented World Truth, not a missing application. There is deliberately no
generic installed-application framework, application discovery, or
per-application permission model.

Both releases reach the same canonical mechanics through the same components:
the shell is presentation, never capability. Its Terminal supports
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

### The RACK-OS firmware update utility

RACK-OS Files additionally recognizes a firmware installer artifact
(`docs/current/FILES_SOFTWARE.md`) sitting on the operated Device's own
filesystem. The interaction is deliberately two-stage, because possessing a
firmware image and replacing a running server's operating system are different
decisions:

```text
firmware installer artifact in RACK-OS Files
  -> OPEN INSTALLER                 (presentation only; starts nothing)
  -> dedicated update utility       (Device, current release, target release,
                                     compatibility, and that it will restart)
  -> explicit INSTALL               (the canonical operation)
  -> Device-owned firmware update
```

The artifact pane and the utility both state installability from the same
canonical derivation the admission enforces, so neither can offer an
installation the operation would refuse; an incompatible Device, an already
updated Device, an unrecognized build or an update already running each state
the real reason and offer no action.

That invariant covers the target's own current *reachability* too, not only
its Firmware/build compatibility: the operated Device is a Remote Session away,
and a Session that has not yet been cleared by canonical reachability
advancement can still resolve identity against a target that has already gone
offline. Both surfaces read `deriveRackOsFirmwarePresentationStatus`
(`docs/current/DEVICE_SYSTEM.md`), which checks that separate current-operability
condition first and states `target_offline` — offering neither `OPEN
INSTALLER` nor `INSTALL` — before it ever asks whether the artifact is the
right release for this Device. Opening the utility and cancelling it change no
canonical state whatever. Internal Device, Service and Firmware IDs
are never exposed as product UI. The canonical operation, its Session-resolved
target, its authority and everything installation then does are owned by
`docs/current/DEVICE_SYSTEM.md`.

While the operated Device is genuinely installing firmware, RACK-OS stops
presenting its normal environment entirely — no section bar, no applications, no
Terminal, Files or System — and presents a dedicated full-environment
maintenance console instead: the Device, the release it is coming from, the
release it is going to, the three represented stages, canonical progress, and
that it will restart. Every claim there is read from the Device's own canonical
update state on each render. It runs no timer, animates no invented progress,
and cannot cancel, pause, accelerate or complete the installation; leaving
RACK-OS and returning shows wherever the real installation has got to. It
deliberately fabricates no boot log, kernel output, hardware check, signature
verification or disk/network telemetry. The Shell's own `← NODE-OS` and
`DISCONNECT` context actions remain, because leaving the Device is not something
an installation may take away.

When the installation completes, the Device really reboots, and the Remote
Session ends the ordinary way — canonical reachability observes an unreachable
Device — rather than the installer deleting it. Because the RACK-OS release
replaces no Service build, established DeviceAccess survives, and after the boot
the player connects again over that same access and is presented with whichever
release the Device now runs.

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
  Scan, Ping, Endpoint Analysis and Known-Space sweep remain issued
  immediately, with no presentation timer in front of them.
- A way in is a statement about the player's own legitimate information and
  installed software, never a prediction: Knowledge for the specialized
  module, a remembered implementation identity for KeyProbe. Removing the
  supporting tool removes the offer without touching that information, and a
  stale endpoint or stale remembered surface can still produce a legitimate
  failed attempt.
- KeyProbe's identity is a concrete Service implementation, never a named
  Vulnerability. Its authored attack profiles are keyed by that
  implementation; forming or estimating a KeyProbe attempt never reads
  `discoveredVulnerabilities`, and a future GateSSH release needs no invented
  Vulnerability to become a valid KeyProbe target.
- NodeScan target Scan and Analyze (Endpoint Analysis) remain separate explicit
  operations. Neither relaxes the admission or information boundary of the
  other, and there is no generic Inspect operation between them.
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
- A Device display name would be remembered Player Information, never a value
  presentation may resolve from World Truth. No current operation observes
  one, so every target's identity stays its observed address regardless of
  classification. Absent a legitimate NodeScan 1.2 classification observation,
  a target is presented as an UNKNOWN DEVICE.
- Known Space expansion is presentation state. Only the Network level
  expands; a Device is a leaf that opens its target card directly rather than
  a further expansion of the tree. Expanding a Network, or opening the
  managed-Network administration route, observes nothing and writes nothing
  to Discovery.
- Endpoint Analysis is optional technical depth, not a target stage; it must
  never insert a step into the target's primary decision. The generic Recon
  `INSPECT` operation is retired: it must never be reintroduced as a Terminal
  command, a NodeScan action, or a `GameActions` operation, and it must never
  reappear as a hidden composition inside Network Refresh or any other
  operation.
- The target's high-level status area is reserved for truth that genuinely
  describes the whole target (a live stage such as ANALYZING, ATTACKING, or a
  granted Access relationship). A Service- or submission-specific outcome —
  RackUpdate's `PACKAGE ACCEPTED` / `REBOOT REQUIRED` chief among them — stays
  presented inside the subsystem that owns it and never becomes that headline.

## DEAUTH Network disruption

DEAUTH is implemented as a deterministic finite offensive `GameProcess` whose
canonical target is a stable Network identity. NodeScan forms its contextual
offer from remembered Device→Network Discovery only: the selected Device is
formation context, while the action explicitly states `NETWORK`, the remembered
Network name, and `deauth.ext`. Completion revalidates the represented provider,
compatible Flipper host, Network, and contextual membership; stale or removed
causes fail without mutation.

A successful completion invokes the neutral Network connectivity interruption
once and owns no other consequence. Petra's Phone reconnects and srv-02 reboots
through their existing Device-owned recovery behavior. The ordinary srv-02 boot
boundary, independently, applies an already-pending GateSSH activation. DEAUTH
creates no pending activation, Access, Session, or Network management authority.
Network Activity has no suitable connectivity-event record in the current
model, so V1 deliberately adds none.

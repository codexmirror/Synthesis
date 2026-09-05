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
recommendation between providers, or hidden target-truth filtering. If
neither provider is owned, ACTIONS states that no offensive Techniques are
available.

Credential Access forms two structurally distinct kinds of route, and ACTIONS
presents each in its own vocabulary rather than forcing one shape onto both.
KeyProbe is a broad, noisy tool that attacks a supported GateSSH
authentication surface directly: its route and its authored attack profile
are both keyed by the concrete Service implementation identity alone, never
by a named Vulnerability, so a future GateSSH release needs no invented
Vulnerability merely to become a valid KeyProbe target. The specialized
Credential Access Module, by contrast, is a Vulnerability-specific technique
scoped to exactly `AUTH-017`; its route still names that Vulnerability.

A KeyProbe entry with a currently formed route states the known `TARGET`
implementation Inspect legitimately remembers (e.g. `GateSSH 1.3.3`) and an
`EST. SUCCESS` percentage: the player's own best estimate, reusing the exact
canonical `keyProbeSuccessChance` profile/chance calculation from Credential
Access — looked up by that same Service implementation identity — over only
the local Device's current executor CPU compute and, where the exact
compatible AuthGuard release has itself been legitimately observed protecting
that same remembered implementation, that protection — never Device Model
ceiling compute, never a hidden AuthGuard installation the player has not
observed, and never a silently refreshed hidden Service implementation. The
specialized module entry instead states the known `SURFACE` (`AUTH-017`) and,
where Inspect legitimately remembers one, the same `TARGET` implementation
field; being deterministic rather than probabilistic, it never earns a
percentage of its own. It states `COMPATIBILITY` as `MATCHED` (the currently
remembered implementation still names the module's one authored surface,
GateSSH 1.3.2), `UNCONFIRMED` (a later legitimate observation named a
different one instead, which a still-justified stale route may still be
attempted against), or `EXPECTED` (its ordinary default, where nothing
observed contradicts it either way). Neither read is an inter-provider
ranking or recommendation, which the previous paragraph still rules out.
START ATTEMPT begins the same canonical Credential Access operation EXECUTE
always has; the wording is specific to this Technique and RackUpdate and
DEAUTH keep their own EXECUTE control and language unchanged.

Because KeyProbe's route needs only a legitimately remembered Service
implementation, it forms and estimates independently of whether the player
has ever earned Vulnerability Knowledge on that Service at all: a target
whose only Player Information is a remembered GateSSH fingerprint (from
Enhanced Inspect) still offers a real KeyProbe attempt with a real estimate,
with no `discoveredVulnerabilities` entry required or consulted.

Credential Access's own most recent completed attempt against a route is
projected beside it once running work clears: a reached attempt whose
attacked surface — KeyProbe's remembered GateSSH implementation, or the
module's required Vulnerability — was no longer current states `ATTEMPT
FAILED · Surface mismatch detected · previous route may be outdated`; a
reached, current KeyProbe attempt whose one canonical decision came back
negative states `Authentication attempt rejected`; and one whose canonical
resolution recorded the exact compatible AuthGuard release blunting it states
`Protection response detected`. These three categories come from
`CredentialAccessProcess.result`'s own narrow `reason` field
(`surface_mismatch` / `authentication_rejected` / `protection_observed`),
set once by Credential Access resolution itself; NodeScan only projects it
and never infers a reason from hidden World Truth. An attempt that never
reached the target at all (the endpoint stopped resolving to the same
network-usable Device and open Service) carries no such reason and is stated
as a bare `ATTEMPT FAILED`. None of this rewrites the historical Knowledge or
route that produced the attempt: a stale specialized-module route remains
attemptable exactly as before, and Credential Access completion remains the
only owner that resolves it against current World Truth.

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

Manual Inspect is deliberately absent from that progression: it is optional
depth under TECHNICAL INTELLIGENCE, not a step the ordinary SCAN → HACK →
CONNECT line passes through, so installing NodeScan 1.1 Experimental never
displaces a route the player has learned or a relationship they already hold.
`service_unavailable` analysis remains inconclusive and retryable. An absence
of Knowledge immediately after Scan is not a negative conclusion. A live
Remote Session remains the highest-priority truth, and represented running work
remains visible.


A concrete attempt context is derived from the player's own legitimate
information about a remembered Service together with a concrete owned
provider, and not from any current target truth — but the two providers draw
on structurally different information. The specialized Credential Access
Module still forms from the player's own Knowledge of `AUTH-017` on a
remembered Service; the initial standalone Credential Access Module supports
`AUTH-017` directly, and a later installed Flipper build supports it after
integrating that same module. Without either concrete source no module action
is formed, the Knowledge that produced it is untouched, and the started
module attempt still carries its `toolId`, `moduleId` and `vulnerabilityId`.

KeyProbe instead forms from the player's own legitimately remembered Service
implementation identity alone — Discovery's Enhanced Inspect fingerprint,
never Knowledge, never a named Vulnerability, and never current target truth.
KeyProbe 1.0's authored attack profiles are keyed by that same concrete
GateSSH implementation identity. A started KeyProbe attempt carries its
`toolId` and a `serviceImplementation` snapshot instead of a `vulnerabilityId`.
GateSSH 1.3.2's profile requires 1,200 work at a 48% threshold at compute
capacity 100; GateSSH 1.3.3's requires 1,800 work at a 30% threshold, so the
latter takes longer on equal Hardware while both continue to advance through
the ordinary CPU scheduler. Each point of current executor CPU compute above
or below 100 changes the applicable threshold by 0.25 percentage points
before the profile-specific bounds are applied (15–78% for GateSSH 1.3.2,
8–65% for GateSSH 1.3.3). Where AuthGuard 1.0 is installed on the target and
supports the current GateSSH release the attempt actually reaches, its
protection reduces the bounded threshold to one sixth — producing 5% at
compute 100 against GateSSH 1.3.3 — independently of any named Vulnerability,
including one that does not exist at all: a future GateSSH release with no
authored Vulnerability can still be a valid, AuthGuard-protectable KeyProbe
target purely by carrying its own KeyProbe profile. These are authored
combinations, not additive difficulty modifiers, and never derived by parsing
a semantic version number. GateSSH 1.3.2 separately derives the real
Vulnerability `AUTH-017`, and GateSSH 1.3.3 separately derives `AUTH-031`
(pre-authentication challenge state reuse); both remain real, Knowledge- and
intelligence-relevant weaknesses, but neither is KeyProbe's own identity. The
specialized Credential Access Module remains deterministic for `AUTH-017` and
does not support `AUTH-031`, or any surface reachable only through KeyProbe's
broader profile set. AuthGuard is the product; its represented 1.0 release
explicitly supports the GateSSH 1.3.3 and 1.4.0 authentication pipelines,
while 1.3.2 is unsupported. Compatibility alone does not create a Vulnerability
or a module attack route: GateSSH 1.4.0 currently derives neither `AUTH-017`
nor `AUTH-031`, though it remains a currently unauthored KeyProbe surface (no
profile exists for it in V1). A Service's implementation is Device-owned
World Truth and may change under the player: Petra's phone runs firmware-owned
GateSSH, so a completed VEYRA firmware update moves `service-ssh-003` from
1.3.2 to 1.3.3 and the Vulnerability, KeyProbe profile and
remembered-intelligence behavior above then follow that real implementation
with no update-specific rule (owned by `docs/current/DEVICE_SYSTEM.md` and
`docs/current/VEYRA_OS.md`). Resolution validates the current causal surface —
KeyProbe's remembered implementation identity against the Service's current
one, or the module's required Vulnerability against `vulnerabilitiesForService`
— before KeyProbe consumes exactly one random decision. AuthGuard does not
remove `AUTH-031`; Service Analysis still discovers it. Enhanced Inspect may
remember AuthGuard, the protected GateSSH release, and supported or
unsupported compatibility. NodeScan presents the product as AuthGuard from
only that historical Discovery, which a later release change does not
silently refresh.

The canonical resolver selects the actual local source —
preferring an integrated Flipper build when it supports the technique and
otherwise using the exact standalone module — and NodeScan names that source
and module without moving capability selection into presentation. Availability never predicts success; stale Player Information can
still produce a legitimately failed attempt, which is projected through the
narrow failure `reason` above (or, absent one, a bare failed attempt) while
the same route stays available.

Above ACTIONS, the target card also draws a compact Network → Device →
Service topology: a restrained connector tree carried by CSS rail-and-elbow
lines rather than literal glyph characters, read as a deeper continuation of
Known Space's own tree (the same technique that tree already uses for
Network → Device, generalized one level deeper) rather than another stack of
cards. The Network row states the remembered Network name (or that
membership was not observed, exactly as Known Space's own `ELSEWHERE`
grouping states it); the Device row states the target's identity exactly as
the rest of the card does — its observed display name where Inspect
legitimately remembered one, its address otherwise; each remembered Service
row states its name, port and protocol, with a further row for its
remembered software identity only where Scan or Inspect actually observed
one. An unscanned target states that Services were not observed rather than
presenting an empty result, and this view fabricates no Service or software
identity beyond what TECHNICAL INTELLIGENCE already carries: every fact it
draws is the same `Target` projection, read a second time for compact
legibility.

Every status mark this view draws is deliberately weak, because
`servicesObserved` proves only that a past Scan or Inspect found the Device
and its Services — a historical fact, never a live guarantee. The Device row
therefore states `OBSERVED` in a neutral tone once Services have ever been
legitimately observed, `NO RESPONSE` where the current visit's own most
recent Scan or Inspect against this exact target failed to reach it, and no
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
own mark; NAME, TYPE, FIRMWARE and COMPUTE remain there unchanged.

TECHNICAL INTELLIGENCE is one disclosure on the target card carrying the
copyable address, remembered Inspect evidence (including the observed display
NAME where one was observed) and its capability note, the manual INSPECT
action, the provenance of established Access, and the remembered Services with
their endpoints, relevant observed software and per-Service Analyze action,
and RackUpdate's package-submission lifecycle. A Service's SOFTWARE list leads
with its remembered implementation fingerprint and may include remembered
software materially affecting that exact implementation: enhanced Inspect's
historical AuthGuard evidence therefore appears with the GateSSH Service it
names, rather than in a Device-level security-software category. The ordinary
Service card does not repeat the generic credential-access condition or expose
canonical vulnerability IDs and weakness labels; where analysis has produced
Knowledge, it gives only a restrained acknowledgement while ACTIONS continues
to derive executable Techniques from that unchanged Knowledge. Opening it
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

A foreign Device Scan does not reveal Network membership. NodeScan 1.0 Standard supplies PING, SCAN, and Service Analysis but no target Inspect. NodeScan 1.1 Experimental remains represented and supplies the same roles plus Enhanced Inspect. NodeScan 1.2 Standard (`nodescan-1.2-standard`, canonical build `build-nodescan-1.2-standard-v0`) preserves those capabilities and adds Network Refresh, Live Topology Monitoring and Integrated Intelligence. Network Refresh invokes the canonical Scan for one remembered Network and, after that observation settles, invokes canonical Inspect independently for each Device Player Information then associates with that Network. It never runs Analyze or starts Service Analysis work. NodeScan 1.0 and 1.1 may repeat the Network Scan through the same interaction, but do not receive the 1.2-authored automatic Inspect composition. All release behavior is selected through concrete release identity capability logic, never presentation version parsing.

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

NodeScan keeps target SCAN, explicit INSPECT, and per-Service ANALYZE as separate player decisions over the same canonical operations exposed by Terminal. Known-Space SCAN AGAIN composes only Scan observations. A target Network REFRESH likewise introduces no canonical state of its own; NodeScan 1.2 uniquely follows its canonical Network Scan with canonical Inspect of legitimately remembered members.

`findTargets` (SCAN AGAIN on Known Space) is offered only after at least one
Network is remembered. It refreshes SELF's Network relationships, then observes
the responding members of every Network the player legitimately remembers.
Nothing outside remembered Discovery is
scanned, and zero-knowledge Known Space does not expose this shortcut: the
player must first Scan intrinsic SELF to remember its Network relationship. Without an installed NodeScan release it reports
`software_unavailable`; where SELF is offline it reports `no_response` and
remembers nothing.

Target SCAN invokes only the canonical Device Scan and refreshes the currently exposed Service snapshot. It never invokes Inspect or starts Service Analysis. NodeScan 1.1 Experimental and 1.2 Standard present INSPECT as an explicit target action; NodeScan 1.0 Standard does not. Each Service retains its own explicit ANALYZE action. The guided ANALYZE action may also start one independent canonical Service Analysis Process for each observed Service still requiring investigation; normal per-Process RAM admission applies and partial admission is reported.

## Live topology monitoring and integrated intelligence

The target Network row includes a compact contextual member summary derived exclusively from remembered `networkDeviceRelations`. It excludes the selected target, which is represented once in the detailed topology below. A remembered relationship for the local Device appears as the player-relative identity `SELF`, without requiring Inspect or exposing its canonical display name; other remembered Device display names appear only after legitimate Inspect observation. It does not enumerate current World membership. Releases without legitimate live authority leave member status unstated.

NodeScan 1.2's topology status is an ephemeral projection, never Discovery or Knowledge. Its represented monitoring capability may read only the current target Device operational state and the current open state of that Device's already-observed Services. Device status maps canonical `RUNNING` + `CONNECTED` to `ONLINE`, `SHUTTING_DOWN` to `SHUTTING DOWN`, `BOOTING` to `BOOTING`, `RECONNECTING` to `RECONNECTING`, and other unavailable combinations to `OFFLINE`. Service V1 status is only `ONLINE`, `OFFLINE`, or `CLOSED`, derived from Device usability and the Service's represented `open` field; there is no independent Service lifecycle, recovery phase, or timer.

A currently usable `DeviceAccess` is a separate, narrower live-observation cause. It authorizes Device status and only the exact `viaServiceId` status while SELF and the target are network-usable and that Service remains open. The historical relationship remains when those conditions disappear, but its telemetry authority disappears immediately and presentation falls back to neutral `OBSERVED` unless NodeScan 1.2 independently monitors the target. Access through SSH never exposes an unrelated Service. DEAUTH still authors only Network connectivity interruption; Device-owned lifecycle changes are what the live projection subsequently reports.

Integrated Intelligence makes a remembered software row interactive only when NodeScan 1.2 is installed and existing evidence supplies details. GateSSH weakness explanations are release-aware: they come only from target- and Service-scoped completed analysis evidence associated with the legitimately observed implementation. Historical AUTH-017 analysis of GateSSH 1.3.2 therefore does not become a current vulnerability when the same Service is later observed as GateSSH 1.3.3; the concrete authored 1.3.3 relationship may instead identify AUTH-017 as patched history, while AUTH-031 remains independently analysis-gated. A completed successful Credential Access Process may enrich only its exact Service, weakness, release evidence and concrete provider; a probabilistic failure proves neither incompatibility nor ineffectiveness. AuthGuard compatibility and its supported SSH protection role remain AuthGuard-owned intelligence, gated by remembered Enhanced Inspect evidence and a relevant represented interaction, and are never folded into GateSSH. There is no separate `KNOWN INFO` affordance: the concrete software row toggles the detail when information exists, while a row without details does not signal interactivity. Known Information remains a read-only projection of legitimate Player Knowledge and represented historical evidence: opening the local disclosure performs no observation, starts no Analyze, and mutates no state. Internal weakness IDs are not its player-facing title. SCAN / INSPECT still establish observations and ANALYZE remains the action that earns weakness Knowledge.

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

The specialized Credential Access Module forms once the player has remembered:

- the represented SSH service
- positive Weak Authentication (`AUTH-017`) Knowledge

KeyProbe instead forms once the player has remembered:

- the represented SSH service
- its concrete implementation identity, from a legitimate Enhanced Inspect
  fingerprint — no Vulnerability Knowledge required or consulted

and in either case SELF owns the concrete provider in question. The initial
local Device owns both the specialized standalone Credential Access Module and
the ordinary installed KeyProbe 1.0 provider. NodeScan lists both as separate
Credential Access choices, without ranking or preselecting either one. The
player may initiate a Knowledge-driven credential attempt (always through the
specialized module) through:

```text
attack <ipv4:port>
```

or initiate either provider through NodeScan's Credential Access ACTION, which
uses the concrete context derived from the player's own legitimate information
(Knowledge for the module, remembered implementation identity for KeyProbe)
and selected owned provider. KeyProbe's attacked implementation identity is
never accepted as caller-supplied data: Credential Access derives it itself,
canonically, from this exact Service's own remembered Enhanced Inspect
fingerprint in Discovery, so presentation can request KeyProbe against a
Service but can never assert which implementation it attacks.

Starting the attempt creates a Credential Access Process.

It does not establish access immediately.

Completion resolves against current World Truth and validates the represented
target, current Device network usability, selected endpoint relationship, open
Service, and represented credential-access context before any probability
decision — the module additionally validates its current Vulnerability, and
KeyProbe additionally validates that the Service's current implementation
identity still exactly matches the one the attempt actually remembered
attacking. Against the current `AUTH-017` / GateSSH 1.3.2 case, the
specialized module succeeds deterministically while KeyProbe makes exactly one
canonical, current-executor compute-dependent decision per attempt using the
concrete profile matching its remembered implementation. A completed result is
terminal and is never rerolled. Success creates persistent USER `DeviceAccess`;
a reached probabilistic failure creates FAILURE authentication and Network
evidence but no access. If the endpoint no longer reaches the intended current
Device and open Service, completion creates no reached-attempt evidence and
makes no probability decision. If the attempt reaches that Service but its
attacked surface — the module's `AUTH-017` Vulnerability, or KeyProbe's
remembered GateSSH implementation — or its Credential Access condition is no
longer valid, completion records the reached FAILURE through the existing
evidence owners but still makes no probability decision. Neither outcome
rewrites historical Discovery or Knowledge.

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
                       TERMINAL / FILES / SYSTEM as built-in applications
                       plus a compatible installed business application
                       an open application returns to APPLICATIONS
```

RACK-OS 1.0 has no `OPERATIONS` section and no business surface of any kind:
srv-02 really does host BranchOps, and 1.0 simply provides no application shell
to present it in. Removing that section changes no BranchOps InstalledSoftware,
branch state, sale, settlement configuration, filesystem or finance.

RACK-OS 1.1 Business lists a BranchOps application only where the exact
represented relationship actually exists — the Device is the branch's configured
operations host *and* really hosts the represented BranchOps 1.0 build — which
is the same `resolveBookstoreBranchOperations` condition
[`BRANCH_COMMERCE.md`](BRANCH_COMMERCE.md) owns. A 1.1 Business Device without
that relationship (an upgraded srv-01, for instance) has the application shell
and only the three built-ins; no application is fabricated to fill the launcher,
and an installed product with no represented application here does not become
one. There is deliberately no generic installed-application framework,
application discovery, or per-application permission model.

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
  Scan, Ping, Inspect and Known-Space sweep remain issued immediately, with no
  presentation timer in front of them.
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

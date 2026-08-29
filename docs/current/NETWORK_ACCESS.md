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

Scan is available through both Terminal and the graphical NodeScan application.
Both interfaces invoke the same shared Scan gameplay/application operation.

Known Space accepts a player-supplied IPv4 address for immediate PING. Typing, pasting, or locally validating it is presentation state only. A positive PING remembers only stable Device identity and the observed address; it observes no name, Firmware, Services, vulnerabilities, Network membership, or topology. Invalid input is rejected before observation, no response creates no Discovery, and PING creates no Process. A foreign Device learned this way appears under ELSEWHERE as NOT SCANNED.

NodeScan is presented as two screens with one guided next action at a time. KNOWN SPACE
presents the remembered relationship shape around the player; a target card is
one target's whole line of action. The guided actions preserve the separate canonical operations: SCAN observes Services, NodeScan 1.1 may next offer INSPECT, ANALYZE may start independent analyses for the observed Services, BYPASS uses a supported remembered route, and CONNECT operates established Access. Both screens are built from a view model derived from
remembered Discovery, Knowledge, the player's own Processes, the player's own
installed software, DeviceAccess and RemoteSession. World truth is deliberately
outside the slice that view model is built from.

Known Space groups remembered targets under the remembered Networks they
belong to, drawn as a one-level relationship scaffold. SELF and its current address appear intrinsically on fresh Known Space without a
synthetic Discovery record or a claimed Network relationship. Before its
Network relationship is known, SELF offers Scan and reports NOT SCANNED. Once
its membership is legitimately observed, SELF appears as the topology anchor
inside that Network. A Device appears under every Network it is
remembered in, and a remembered Device with no remembered relationship to any
known Network stays visibly separate under ELSEWHERE with its own scope
stated. Unobserved membership is stated explicitly rather than reported as an
observed empty result, and an observed Network with no responding members says
so.

That scaffold is presentation only and is not a navigation hierarchy. A
Network is not openable, carries no action of its own, and nothing expands:
tapping a target opens its card directly, and there is no Network level,
Device level or Service level between. Presenting topology performs no
observation.

The target card states one stage at a time and normally offers one primary
action for it. Its derived progression distinguishes NOT SCANNED, SERVICES
FOUND / INSPECT available, SERVICES FOUND / ANALYZE available, ANALYZING,
NO WAY IN FOUND, `n` WAY(S) IN FOUND, BYPASS work in progress, ACCESS GRANTED,
and CONNECTED. NO WAY IN FOUND is shown only after every currently observed
Service has either weakness Knowledge or a completed `no_weakness_detected`
result; `service_unavailable` is inconclusive and remains retryable. An absence of
Knowledge immediately after Scan is not a negative conclusion. A live Remote
Session, established DeviceAccess, and a running credential attempt still outrank
reconnaissance work. Pending NodeScan 1.1 Inspect depth outranks a merely known
route, including when the release was installed after that route was learned.


A way in is derived from the player's own Knowledge of a weakness on a
remembered Service together with an installed tool that supports that
weakness, and not from any current target truth. Basic Credential Toolkit
remains a real requirement: without the installation no way in is formed, the
Knowledge that produced it is untouched, and the started attempt still carries
its `toolId` and `vulnerabilityId`. Because exactly one represented credential
tool currently exists, NodeScan selects it rather than presenting a choice
with one option. A way in never predicts success; stale Player Information can
still produce a legitimately failed attempt, which is reported coarsely while
the same route stays available.

RECON INTELLIGENCE is one disclosure on the target card carrying the copyable
address, remembered Inspect evidence and its capability note, the provenance
of established Access, the explanation of each way in (method, tool, service,
remembered software fingerprint, weakness label and identity), the remembered
Services with their endpoints, fingerprints, weaknesses and per-Service
Analyze action, and RackUpdate's package-submission lifecycle. Opening it
browses remembered information: it performs no observation and starts no
gameplay. Unobserved depth is stated explicitly there and never rendered as an
observed empty result.

RackUpdate's package-submission lifecycle is projected only when remembered
Enhanced Inspect evidence includes its package-submission interface and earned
`UPD-001` Knowledge explains it, and only inside RECON INTELLIGENCE — never on
the primary decision surface. Before the narrow submission capability exists,
it states an ATTACK opportunity exactly like a credential way in: it names the
weakness, the supporting installed tool, and offers ATTACK only where the
Rollback Exploit Toolkit is actually installed; without that tool it states
that no installed tool currently supports the weakness. ATTACK starts a real
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
or prescribed next observation.

This projection reads no hidden target World Truth to label the opportunity,
predict success, refresh a fingerprint, or expose a way in: ATTACK opportunity,
progress, and the narrow submission capability are all derived from the
player's own Knowledge, installed software, Process, and `RackUpdateSubmissionAccess`
state alone.

Because there is no canonical "analyzed" state, a Service that has not
produced Knowledge claims no analysis state at all. A completed no-weakness or
service-unavailable analysis result is stated beside its repeatable Analyze
action as disposable Process history and is never promoted into permanent
memory.

Known Networks are relationship context rather than a level of navigation:
there is no Network page, no Network or Device expansion, no Service children
on Known Space, and no separate Service page. Network Inspect remains
available through Terminal `inspect <network-name>`, and remembered Network
Inspect evidence is unaffected.


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

Current Device Inspect does not enumerate services. Enhanced Device Inspect also observes the target Device’s represented LocalNetwork relationships, remembering only the inspected Device relationship and not enumerating other members.

Current LocalNetwork Inspect reports the represented network's own information,
including whether canonical membership connects SELF, without enumerating
members.

Inspect is exposed directly as `inspect <ipv4|network-name>` and as an explicit action on remembered Device targets in NodeScan. Both interfaces use the
same synchronous application operation.

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
- shallow Inspect evidence for known Devices and LocalNetworks

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

and SELF owns the Basic Credential Toolkit, the player may initiate a credential
attempt through:

```text
attack <ipv4:port>
```

or through NodeScan's HACK action, which uses the way in derived from the
player's own Knowledge and installed tool.

Starting the attempt creates a Credential Access Process.

It does not establish access immediately.

Completion resolves against current World Truth and validates the represented target, service, endpoint relationship, service availability, current weakness, and represented credential-access context. Success creates persistent USER `DeviceAccess`; failure creates no access and does not rewrite historical Discovery or Knowledge.

RackUpdate 1.0 is a distinct public interaction, observed by Enhanced Inspect as `INTERFACE: Package submission`. Analysis derives `UPD-001` ("Rollback protection not enforced") from RackUpdate's current release. Knowledge alone is informative rather than submission authority: exploiting it requires an installed tool that actually supports `UPD-001` — the Rollback Exploit Toolkit — exactly as Credential Access requires the Basic Credential Toolkit for `AUTH-017`, and this tool's role stays equally narrow. Unlike Basic Credential Toolkit, the Rollback Exploit Toolkit is deliberately not preinstalled: V1 has no represented acquisition path for it yet, so a fresh Device carries no installed tool supporting `UPD-001` until one is installed by some other means.

ATTACK against RackUpdate starts a real finite `rack_update_exploit` Process (see Service Analysis above for the shared Process model). Completion resolves against current World Truth exactly once and, on success, grants the attacking Device a narrow `RackUpdateSubmissionAccess` relationship scoped to that one RackUpdate Service (`GameState.rackUpdate.access`) — never `DeviceAccess`, never a `RemoteSession`, and no filesystem or credential authority. Failure creates no such relationship and does not rewrite historical Discovery or Knowledge, mirroring Credential Access's failure semantics.

Only a Device holding that narrow capability may submit a compatible local GateSSH package. Submission is represented finite upload work (`GameState.rackUpdate.submission`), a distinct network runtime from `GameProcess` and from `FileTransfer` — it is not a filesystem Upload and requires neither `RemoteSession` nor `DeviceAccess`. It resolves the observed stable Device and Service identities and endpoint plus a stable local file ID, admits one active submission at a time, and its effective byte rate is derived through the same Device/LocalNetwork transfer-capacity model `docs/current/DEVICE_SYSTEM.md` and `docs/current/FILES_SOFTWARE.md` describe for `FileTransfer`. Cancelling or losing the route (an offline endpoint, a changed RackUpdate Service, ambiguous or invalid transfer capacity) ends the submission with no part of the package applied; a terminal outcome (COMPLETED, CANCELLED, or INTERRUPTED) appends its own Network-owned `NetworkPackageSubmissionRecord` (`kind: 'package_submission'`, never `'file_transfer'`, since a RackUpdate submission is not a FileTransfer), reusing the same membership-resolution model and the exact record shape and terminal-result semantics `FileTransfer` evidence uses rather than a parallel model, and never once per advancement tick.

Only when the upload actually completes does a valid represented GateSSH 1.3.2 package change a managed GateSSH 1.3.3 Service implementation to 1.3.2; cancellation, interruption, or failure changes nothing. Existing Analysis and Credential Access subsequently react to the newly applicable `AUTH-017`. This successful submission is also the player's own legitimate observation of what they just applied: it refreshes only that Service's own already-remembered Enhanced Inspect implementation fingerprint, and touches no other remembered evidence and no hidden World Truth. This remains the current concrete proof that interaction is not access: represented state mutation, reached only through represented elapsed work, changes which existing technique applies.

## Reaching the represented personal phone

The represented VEYRA phone (`docs/current/DEVICE_SYSTEM.md`) is reached through
exactly the ordinary access loop above and nothing else. It is not a member of
SELF's temporary `home-net`, so Network Scan does not reveal it. Directly
scanning its communicated address discovers it as a remote Device and observes
its one open SSH Service; Service
Analysis of that Service records the same `AUTH-017` Knowledge, because its
implementation is the same represented GateSSH 1.3.2 release; the same Basic
Credential Toolkit forms the same way in; the attempt creates the same
Credential Access Process and, on success, the same USER `DeviceAccess`; and
CONNECT opens the same kind of Session.

No phone-specific weakness, tool, operation, mechanic or developer shortcut
exists. Removing the credential tool removes the offer without touching the
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
established through is stated under RECON INTELLIGENCE as provenance; it offers
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

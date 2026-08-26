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
reconnaissance software shipped with NODE-OS. Its current direct Terminal
commands remain `scan <ipv4|network-name>` and `analyze <ipv4:port>`; no product
namespace is required.

Scan is available through both Terminal and the graphical NodeScan application.
Both interfaces invoke the same shared Scan gameplay/application operation.

The graphical application is one investigation workspace over four levels of
the same subject — Known Space, Network, Device, Service — reached by a single
navigation stack with a breadcrumb back to the parent object. Every level is
presented from player information only: a view model derived from remembered
Discovery, Knowledge, the player's own Processes, DeviceAccess and
RemoteSession. World truth is deliberately outside the slice that view model
is built from.

Each level uses the same semantic grouping: the object's identity, what has
actually been OBSERVED about it, its known relationships, deeper KNOWLEDGE
where that exists, current ACCESS, and the legitimate ACTIONS available now.
Unobserved depth is stated explicitly and never rendered as an observed empty
result: a Network whose membership has never been observed says so rather than
reporting zero Devices, and the same distinction is made for a Device's
Services and for Device and Service properties.

Known Space presents known Networks as independent top-level branches of a
relationship tree, and is the primary workspace rather than an index of pages:
hierarchy is carried by indentation, type weight and thin connectors, and a
branch's rail terminates at its own last child. Expanding a Network locally
reveals its legitimately known member Devices, including SELF, together with
the Network's own remembered Inspect evidence and, at the foot of that branch,
the Network's Scan action and, when supported by the installed release, its
Inspect action. Those operations belong visually to the Network they act on
rather than to a separate global actions section. Network expansion is only
presentation state and performs no observation. Several Networks may be open
at once.

A fresh session, where nothing is known, presents SCAN SELF as the single
bootstrap action that discovers Network relationships. Once a Network is
known, that bootstrap control is absent; the concrete Network branch retains
its repeatable Scan action.

Each Network is the parent presentation for Devices observed through that
relationship; NodeScan does not duplicate them in a global Device index. A
known non-SELF Device offers a branch only where expanding it would reveal
remembered Service children — a Device whose Services have never been observed,
or whose last Scan observed none, states that instead of offering an empty
branch. Expansion browses remembered children only and performs no
observation; one Device branch is expanded at a time. A Device whose Services
have not been observed offers its Scan directly in the branch, so the normal
investigation loop does not have to leave the workspace, and every Device
retains an explicit, touch-sized path to its full detail page. Remembered
Inspect evidence a Device already carries is stated compactly on its branch
row. Service children open their existing detail pages. A Device page retains
its Network navigation context and presents observed Device facts, known
Network relationships, known Services, Access, and Device actions. A Service row
stacks Service identity, endpoint metadata and observed fingerprint on
separate lines so that a long observation such as `Credential + Additional
Verification` wraps rather than compressing the Service's own identity, and
carries short state marks for running work, established Access and known
weaknesses. A Service page integrates endpoint, observed implementation
fingerprint, observed authentication, vulnerability Knowledge, the provenance
of Access established through that Service, currently running Service Analysis
or Credential Access, and its own actions.

Because there is no canonical "analyzed" state, a Service that has not
produced Knowledge claims no analysis state at all. Retained completed-Process
results remain available as disposable history on the Service page and are
never promoted into permanent memory.

The installed NodeScan release supplies the Inspect action, so Inspect is
absent under NodeScan 1.0 Standard. Remembered Inspect evidence is unaffected
by that capability: where evidence exists but the installed release cannot
Inspect, the object states that the evidence is remembered from an earlier
observation instead of offering the action.

Current Scan behavior is:

```text
scan Device/IP
→ observe represented network relationships
→ observe currently open represented services

scan LocalNetwork/name
→ observe responding represented member Devices
```

The existing discovery loop can therefore proceed conceptually as:

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

Successful positive Scan observations are remembered in canonical Discovery.

Opening or navigating remembered information in the graphical Scan application
does not itself perform a new observation.


## Inspect

Inspect currently observes one selected target's own represented properties.

Current Device Inspect may report:

- address
- scope
- online state
- SELF hardware where owned by the local Device
- represented server identity where present

Current Device Inspect does not enumerate services.

Current LocalNetwork Inspect reports the represented network's own information,
including whether canonical membership connects SELF, without enumerating
members.

Inspect is exposed directly as `inspect <ipv4|network-name>` and from
remembered Device and LocalNetwork pages in NodeScan. Both interfaces use the
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
the observed authentication configuration as `Credential` or `Credential +
Additional Verification`. These Service snapshots are separate from Device
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

or through the corresponding remembered graphical service action.

Starting the attempt creates a Credential Access Process.

It does not establish access immediately.

Completion resolves against current World Truth and validates the represented
target, service, endpoint relationship, service availability, current weakness,
and represented credential-access context, including that context's optional
`secondFactorRequired` condition when present (see `srv-02` in
`docs/current/DEVICE_SYSTEM.md`). This condition is resolved at completion like
every other current-truth check here, never snapshotted at attempt start.

Success creates persistent USER `DeviceAccess`.

Failure creates no access and does not rewrite historical Discovery or
Knowledge. A represented second factor produces the same generic
attempt-failed result as any other Credential Access failure; the player has
no reconnaissance mechanic that reveals it, so ordinary failure presentation
must not name it.


## DeviceAccess

`DeviceAccess` is current canonical gameplay state.

A successful Credential Access attempt may establish one deduplicated
relationship containing:

- source Device identity
- target Device identity
- service path identity
- USER privilege

The current graphical Scan surface presents established access and active Remote
Session state in one Device-level state slot. A Service that established access
presents that relationship as an access path and offers navigation back to its
containing Device; that navigation does not connect automatically. Persistent
Service findings take priority over redundant successful analysis history, while
useful no-finding results remain visible as secondary information.

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
and Scan exposes the same shared operation at Device level. The Session stores
only its stable ID, the authorizing access ID, and the address used to connect;
source, target, service, and privilege remain owned by `DeviceAccess`.

An active resolvable Session first presents a Shell-owned Remote Session handoff.
The successful connect has already established canonical Session truth; the
handoff is not simulated connection progress. It ends local editing and waits
for the existing Shell editing state to recover before enabling explicit entry
to the remote environment. Accepting that presentation gate mounts RACK-OS
without changing GameState. Each stable Session identity receives its own
handoff, while disconnecting from the handoff uses the canonical Session
operation and restores the preserved NODE-OS presentation.

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
  `secondFactorRequired`) must never be named in failure presentation.
- RACK-OS is a live authorized view of target truth, resolved through
  `accessId` → target identity, never through the connected address.
- A Session admits a command; it does not own the lifetime of the work that
  command started. Disconnecting never cancels admitted Device-owned work,
  never stops a Miner running on the target, and never removes DeviceAccess.
- A remote operation resolves its target only through `accessId` → target
  identity. Presentation never supplies an executor Device ID.

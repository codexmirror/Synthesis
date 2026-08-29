# Devices, World, and System — current truth

Status: Accepted
Scope: The canonical `GameState` areas, the player's local Device, the
represented World (network, servers, services, hardware, transfer capacity),
and the System application, as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/DEVICES_AND_ACCESS.md`.


## Current GameState areas

Current canonical game state includes:

```text
GameState
├── player
│   └── localDevice
│       ├── stable Device identity
│       ├── mutable display name
│       ├── installed Firmware identity
│       ├── network address
│       ├── hardware
│       ├── runtime state
│       ├── installed software
│       │   ├── NodeScan (`nodescan`, release `nodescan-1.0-standard`) 1.0 Standard
│       │   └── Basic Credential Toolkit (`basic-credential-toolkit`, release `basic-credential-toolkit-1.0`) 1.0
│       └── saved Dollar sign-in
├── dollarFinance
├── nodeWallet
├── nodeEconomy
├── world
│   └── network
│       ├── two independent foreign servers
│       │   ├── display identity and Firmware
│       │   ├── canonical Device-owned filesystem
│       │   └── canonical Device-owned installed software
│       └── one foreign personal phone
│           ├── display identity and VEYRA OS Firmware
│           ├── canonical Device-owned filesystem (represented and empty)
│           └── canonical Device-owned installed software (represented and empty)
├── process
├── knowledge
├── discovery
├── deviceAccess
├── remoteSession
├── fileTransfer
├── mail
│   └── the player's represented in-world mailbox
└── recentActivity
```

The `mail` slice is the player's mailbox, owned by their represented in-world
mail account rather than by the local Device or NODE-OS. Its detailed semantics
belong to `docs/current/COMMUNICATION.md`.

The concretely represented foreign filesystems are normal Device-owned state.
A successful Upload may create its normal destination artifact in the remote
Device filesystem; this does not imply a generic filesystem-write mechanic.

Both concretely represented servers also own their own installed-software
inventory (`NetworkHost.installedSoftware`), the same semantic concern the
local Device owns and entirely independent of it: the same product may exist at
different releases on different Devices, and installing or replacing software on
one never mutates another's inventory. Both start empty — nothing is installed
on them until a real installation Process completes there — and each is a
distinct collection rather than a shared one. The field is optional precisely so
the shallow training hosts keep no fabricated inventory; a host that represents
none simply cannot install software (see
`docs/current/FILES_SOFTWARE.md`). Installed software remains separate from a
Service's concrete implementation: GateSSH is Device-owned Service
implementation World Truth and never appears in any Device's
`installedSoftware`.

The player's local Device has stable identity separate from its mutable display
name and network address. It owns concrete NODE-OS Firmware identity (including
its stable Firmware ID, visible name, and version), and local OS presentation
derives that identity from Device state rather than a universal Shell constant.
The Device also owns the sole canonical installed-software inventory. Installed
software is separate from Firmware, filesystem artifacts, and running or
completed Processes. NODE-OS remains Firmware rather than an installed-software
entry. Each installation has a stable product `id` and a distinct opaque
`releaseId`; display name, version, and channel are release presentation
metadata rather than identity.

The local Device additionally owns `savedDollarSignIn`, the sign-in material
this Device itself stored for the Dollar Provider, together with the stable
Financial Account ID that material was saved for. It is Device state and
deliberately not the Provider's Credential, it grants no authority, and a Device
that represents none simply has none. Its semantics belong to
`docs/current/DOLLAR_FINANCE.md`.


## Represented World

The current World contains `home-net` with node-01 and `srv-01`, plus the neutral foreign LocalNetwork `remote-segment-01` with the personal phone `host-phone-001` and `srv-02` (`host-lan-002`). `srv-02` remains the fully represented remote Device at `203.0.113.42`. The old shallow host at that address and the former `srv-02` address are absent. Myra's authored first-target mail communicates the phone address as historical text and creates no Discovery.

`srv-01` owns RACK-OS 1.0, GateSSH 1.3.2 on its stable SSH Service, Basic HTTP, and its independent filesystem. GateSSH 1.3.2 derives `AUTH-017`; this weakness is never stored separately.

`srv-02` (`host-lan-002`) owns RACK-OS 1.0, GateSSH 1.3.3 on `service-ssh-002`, and RackUpdate 1.0 on the separate open TCP/8443 `service-rack-update-002`. GateSSH 1.3.3 is patched for `AUTH-017`. RackUpdate 1.0 derives `UPD-001` (rollback protection not enforced) and exposes its concrete public package-submission protocol. These are Device-owned Service implementations, independent of InstalledSoftware.

RackUpdate can replace the managed GateSSH implementation release while preserving Device and Service identity and all unrelated state. The resulting vulnerability set is derived from the new release truth rather than synchronized by a vulnerability flag.

### The represented personal phone

`host-phone-001` is the one represented ordinary personal Device: display name `Petra’s Phone`, address `198.51.100.61`, online, and a member of `remote-segment-01` with `host-lan-002`. It owns VEYRA OS 4.1 Firmware (`firmware-veyra-os-v4-1`), concrete Mobile CPU / 6 GB hardware and CPU/RAM runtime baselines, its own filesystem, and its own installed-software inventory. It carries no `role`, because it is not a server, and owns its own `NetworkTransferCapacity` (2 MiB/s upload, 4 MiB/s download) like the other concretely represented Devices, so an existing transfer involving it is decided on real grounds rather than for want of a represented capability.

Its filesystem and installed-software inventory are both represented and empty. That is the truthful minimum for this slice: a Device that owns those concerns but currently holds nothing, rather than one filled with invented personal content. It owns an empty Authentication History like the other resource-capable Devices.

It exposes one open Service, `service-ssh-003`, whose implementation is the same GateSSH 1.3.2 the world already represents, with `credentialAccess` at `USER`. It therefore derives the same `AUTH-017` and is reached by the same Credential Access loop as `srv-01`; no phone-specific weakness, tool, operation or shortcut exists. What that loop is belongs to `docs/current/NETWORK_ACCESS.md`.

The three represented Firmware release identities — NODE-OS, RACK-OS and VEYRA OS — are named once in `src/core/game/firmwareIdentity.ts` so that code deciding *which* environment a Device runs resolves stable identity rather than a mutable display name. The Firmware a Device owns is still ordinary Device state; the constants are identity, not a Firmware registry or family model.

The phone is signed in to its own Civic Dollar Account through its own Device-bound Financial Session (`docs/current/DOLLAR_FINANCE.md`), and the operating surface it presents belongs to `docs/current/VEYRA_OS.md`.

## Network transfer capacity

Three distinct concerns make up represented transfer throughput, and V1
represents only the first two:

```text
DEVICE TRANSFER CAPACITY = the maximum transfer capability of that Device endpoint
NETWORK TRANSFER CAPACITY = the represented external connectivity capacity of that LocalNetwork
CURRENT USAGE / CONGESTION = not represented yet
```

The local Device (`node-01`) and both concretely represented servers
(`srv-01`, `srv-02`) each own a canonical `NetworkTransferCapacity`
(`uploadBytesPerSecond`, `downloadBytesPerSecond`) on their network state:
node-01 is 1 MiB/s upload and 2 MiB/s download; srv-01 is a symmetric 8 MiB/s;
srv-02 is a symmetric 1 MiB/s, deliberately slower than srv-01; the personal
phone is 2 MiB/s upload and 4 MiB/s download. The shallow training hosts are
deliberately given none. Upload and
download are always interpreted from the perspective of the Device that owns
the capacity. This capacity is a pure maximum-capability value, not runtime
usage, and remains distinct from existing availability state
(`runtime.networkStatus` on the local Device, `online` on a `NetworkHost`):
an offline endpoint still carries its normal capacity rather than a zeroed
one. The shallow training hosts are not given an invented capacity.

Each `LocalNetwork` also owns its own canonical `NetworkTransferCapacity`,
representing that Network's own external uplink/downlink rather than any
member Device's endpoint capability and rather than internal LAN/switch
fabric between its members. `home-net` is a symmetric 16 MiB/s and
`remote-segment-01` is a symmetric 8 MiB/s; both are deliberately authored
above every member Device's own endpoint capacity so neither is the
bottleneck for the currently represented default routes. A Network's
capacity is independent state from any member Device's capacity: changing
one never mutates the other.

A pure `deriveEffectiveTransferRateBytesPerSecond` helper derives the
narrower of a source's upload capacity and a destination's download
capacity for two endpoint capacities alone. A separate
`deriveCrossNetworkTransferRateBytesPerSecond` helper composes all four
represented bottlenecks for a transfer whose source and destination Devices
belong to two different LocalNetworks: the source Device's own upload
capacity, the source Network's upload capacity, the destination Network's
download capacity, and the destination Device's own download capacity.

```text
cross-Network effective throughput =
  min(source Device upload, source Network upload, destination Network download, destination Device download)

same-Network effective throughput =
  min(source Device upload, destination Device download)
```

The FileTransfer runtime resolves each endpoint Device's current
LocalNetwork membership from canonical World Truth (`memberDeviceIds`) on
every advancement step, never by a redundant `sourceNetworkId` /
`destinationNetworkId` stored on the `FileTransfer` itself. When both
endpoints resolve to the same LocalNetwork, the transfer is decided by
endpoint capacity alone — LocalNetwork capacity represents external
connectivity, not internal LAN fabric, so it deliberately does not apply
inside `home-net` (`node-01` ↔ `srv-01`). When the endpoints resolve to two
different LocalNetworks — the represented route to `srv-02` or to the
personal phone, both on `remote-segment-01` — every represented bottleneck
participates. Membership resolution distinguishes three states rather than
collapsing to a binary "has a Network or not": a Device with **zero**
represented LocalNetwork memberships contributes no extra bottleneck on
that side — the existing V1 compatibility fallback for a Device with no
represented Network — and a transfer still proceeds; a Device with
**exactly one** membership uses that Network normally; a Device with **two
or more** memberships is **ambiguous** — represented topology exists but the
route cannot be resolved without picking a Network by `localNetworks` array
order, which is not implemented. Ambiguous membership is never treated as
"no Network": the FileTransfer runtime resolves it the same as any other
unavailable endpoint (a removed DeviceAccess, an offline Device), hard-
aborting the transfer through the existing interruption/archive path rather
than silently falling back to endpoint-only throughput or advancing at an
arbitrarily chosen Network's capacity. The currently represented fixtures
give every resource-capable Device at most one applicable LocalNetwork
membership, so this resolution is unambiguous today; generic multi-Network
route selection remains unimplemented.

The effective rate is derived fresh on every advancement step rather than
stored, and none of it — Device capacity or LocalNetwork capacity — is
exposed through Scan, Discovery, Inspect, or any other player-facing
surface. Both are canonical World Truth, not Player Knowledge.

Both represented servers and the represented personal phone also own concrete
CPU, RAM, and baseline CPU/RAM runtime state. This resource truth is not exposed through Scan, Discovery, or
Inspect. The shallow training hosts remain non-resource-capable, and
`NetworkHost.online` remains the sole server availability truth.


## Network activity evidence

Each represented `LocalNetwork` also owns its own canonical, bounded
`NetworkActivityHistoryState` (`src/core/game/networkActivityHistory.ts`):
concrete historical evidence of activity that actually passed through that
Network, for two event families only — Credential Access connection attempts
and terminal FileTransfer outcomes. It is canonical World Truth owned by the
Network itself, deliberately distinct from Device-owned Authentication
History, from Recent Activity, and from Player Knowledge/Discovery: the same
represented action legitimately produces separate concrete artifacts from
each owner's own perspective (for example a reached credential attempt
appends both the target Device's `AuthenticationHistoryRecord` and the
participating Network's own `NetworkConnectionAttemptRecord`). It is not a
generic event bus, application log, or universal evidence framework; the two
record shapes are concrete and closed, matching only this V1's two event
families.

Retention follows the same bounded/monotonic convention `authenticationHistory.ts`
already established: a fixed V1 capacity of 20 records
(`NETWORK_ACTIVITY_HISTORY_CAPACITY`), oldest record evicted first, with a
per-Network `nextId` counter that never rewinds even as records are evicted.

`NetworkConnectionAttemptRecord` is appended only when a Credential Access
attempt actually reaches the represented target Device/service (the same
`reached` condition that gates Device Authentication History), carrying
source/target Device identity, source/target address snapshots, service
identity and service-name snapshot, and the SUCCESS/FAILURE result. It
deliberately excludes Player identity, toolkit identity, vulnerability
identity, and attack labels — none of those are network-observable/topology
truth.

`NetworkTransferRecord` is appended only once an admitted FileTransfer
reaches a terminal outcome — COMPLETED, CANCELLED, or INTERRUPTED — never
once per advancement tick, carrying source/destination Device identity,
source/destination address snapshots, the bytes actually transferred at that
terminal moment (not necessarily `bytesTotal`), and the terminal result. It
deliberately excludes filesystem path, filename, file contents, and
software/vulnerability/Dollar semantics.

Which Network(s) receive a record is resolved from the same canonical
membership model `deriveCrossNetworkTransferRateBytesPerSecond` already
established, reused rather than duplicated
(`resolveDeviceLocalNetworkMembership` in `networkActivityHistory.ts`, shared
by `fileTransfer.ts`): when both endpoint Devices resolve to the same unique
LocalNetwork, that Network gets exactly one record carrying an `internal`
perspective; when they resolve to two distinct unique LocalNetworks, each
Network gets its own record — `outbound` on the source-side Network,
`inbound` on the destination-side Network — representing each Network's own
view of the one real activity rather than a duplicated global event. When
only one endpoint uniquely resolves, only that Network's legitimate side is
recorded and the other side is never fabricated. Ambiguous membership (two or
more represented LocalNetworks with no represented basis to choose between
them) is never resolved by array order and contributes no record for that
side — this is not the same as zero membership. For FileTransfer throughput,
zero membership is the existing compatibility fallback that contributes no
extra bottleneck while the transfer still proceeds, whereas ambiguous
membership is an unresolved-route condition that hard-aborts the transfer
through the existing interruption/archive path. Network activity evidence
follows that same distinction rather than treating the two alike: an
ambiguous side simply omits its own record, and the opposite endpoint's
otherwise-legitimate unique Network still retains its own inbound/outbound
record for the same activity.

Network activity evidence is canonical World Truth only. It is not exposed
through Scan, Inspect, Discovery, Known Space, or any current Network UI:
`NETWORK HAS EVIDENCE` does not imply `PLAYER CAN READ EVIDENCE`. Presenting
it to the player is explicitly out of scope for this slice.


## System application

System is the local Device's machine-level sheet. It presents represented
Device state grouped as IDENTITY, HARDWARE, NETWORK and INSTALLED SOFTWARE:

- Device display name
- Firmware name
- Firmware version
- CPU and RAM hardware, including represented RAM capacity
- derived CPU load and RAM usage
- local address
- network status
- the Device-owned installed-software inventory, each row showing its
  represented name, version, channel and publisher where present, plus its
  current removal runtime when one is running

The installed-software inventory is the same canonical Device-owned state that
Terminal help groups by provider and that local installation replaces in
place; System observes it rather than owning it. An absent inventory is stated
explicitly rather than implied.

Installed software is managed inline rather than through a separate detail
screen. The whole row is the tap target: it carries no navigation arrow and no
standalone destructive control, and tapping it expands that software's
management surface directly underneath it. Tapping the open row collapses it,
and opening another row closes the previous one, so exactly one software row is
ever expanded. Which row is open is presentation state owned by System; it is
never GameState.

Expanded content states what the software is and what its release provides
(about and capabilities, from the same represented release information Files
uses), its system context, its stable release ID behind the same RELEASE
INFORMATION disclosure Files uses, and a destructive action only where the
canonical removal runtime supports one: UNINSTALL for NODE Miner, RESTORE 1.0
STANDARD for a NodeScan override, none for the protected NodeScan 1.0 Standard
baseline, and none for the Basic Credential Toolkit, which is presented as
ordinary installed software rather than as a system baseline. While a Software
Removal Process is running for that product the expanded content shows REMOVING
(or RESTORING for NodeScan) and offers no second action; cancelling that finite
Process remains the Activity Monitor's. Software categories or grouping are not
represented: the inventory remains one INSTALLED SOFTWARE section.

Current runtime work stays with the Activity Monitor. System presents only the
Device's own summary CPU load and RAM usage and does not repeat the activity
list.

The installation and removal runtime System starts is owned by
`docs/current/FILES_SOFTWARE.md`. System presents only the local Device's own
inventory: software installed on a represented server is that Device's truth and
is observed through RACK-OS, never listed here.


## Gotchas

- A Device instance, its Firmware, its installed software, and an operating
  Session are four different things. Firmware never owns hardware, runtime,
  networking, filesystem, or installed software.
- Installed-software inventories are per Device and independent. Reading or
  mutating one Device's inventory on behalf of another is a bug, and the local
  Device's inventory is not a proxy for any server's.
- A Service's concrete implementation (for example GateSSH 1.3.2) is
  Device-owned World Truth, not `InstalledSoftware` and not a package.
- Two Devices may share one Firmware product identity without sharing Device
  identity.
- `NetworkTransferCapacity` is capability, not usage, and not availability. An
  offline endpoint still carries its normal capacity.
- Device transfer capacity and LocalNetwork transfer capacity are two
  distinct capacities. Do not conflate them, and do not let a same-Network
  transfer apply LocalNetwork capacity — that field represents external
  connectivity, not internal LAN fabric.
- Server CPU/RAM truth, Device transfer capacity, and LocalNetwork transfer
  capacity are all World Truth. Do not expose them through Scan, Inspect, or
  Discovery.
- Shallow training hosts are deliberately shallow. Do not invent hardware,
  capacity, filesystems, or installed-software inventories for them to make a
  view or a type uniform.
- Network activity evidence ≠ Device Authentication History ≠ Recent Activity
  ≠ Player Knowledge. One real action may legitimately create several
  concrete artifacts, one per owner's own perspective; that is not
  duplication.
- Never select a LocalNetwork for activity evidence by `localNetworks` array
  order under ambiguous membership. Reuse the shared membership resolver
  rather than reimplementing a routing rule that could disagree with it.
- Network activity evidence is canonical World Truth, never exposed through
  Scan, Inspect, Discovery, or any current UI.

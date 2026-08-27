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
│       └── installed software
│           ├── NodeScan (`nodescan`, release `nodescan-1.0-standard`) 1.0 Standard
│           └── Basic Credential Toolkit (`basic-credential-toolkit`, release `basic-credential-toolkit-1.0`) 1.0
├── wallet
├── nodeWallet
├── nodeEconomy
├── world
│   └── network
│       └── two independent foreign servers
│           ├── display identity and Firmware
│           ├── canonical Device-owned filesystem
│           └── canonical Device-owned installed software
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


## Represented World

The current World contains the represented `home-net` LocalNetwork with node-01 and `srv-01`, while `srv-02` is the fully represented remote Device at `203.0.113.42`. The old shallow host at that address and the former `srv-02` address are absent. Mira's authored mail remains historical text and creates no Discovery.

`srv-01` owns RACK-OS 1.0, GateSSH 1.3.2 on its stable SSH Service, Basic HTTP, and its independent filesystem. GateSSH 1.3.2 derives `AUTH-017`; this weakness is never stored separately.

`srv-02` (`host-lan-002`) owns RACK-OS 1.0, GateSSH 1.3.3 on `service-ssh-002`, and RackUpdate 1.0 on the separate open TCP/8443 `service-rack-update-002`. GateSSH 1.3.3 is patched for `AUTH-017`. RackUpdate 1.0 derives `UPD-001` (rollback protection not enforced) and exposes its concrete public package-submission protocol. These are Device-owned Service implementations, independent of InstalledSoftware.

RackUpdate can replace the managed GateSSH implementation release while preserving Device and Service identity and all unrelated state. The resulting vulnerability set is derived from the new release truth rather than synchronized by a vulnerability flag.

## Network transfer capacity

The local Device (`node-01`) and both concretely represented servers
(`srv-01`, `srv-02`) each own a canonical `NetworkTransferCapacity`
(`uploadBytesPerSecond`, `downloadBytesPerSecond`) on their network state:
node-01 is 1 MiB/s upload and 2 MiB/s download; srv-01 is a symmetric 8 MiB/s;
srv-02 is a symmetric 1 MiB/s, deliberately slower than srv-01. Upload and
download are always interpreted from the perspective of the Device that owns
the capacity. This capacity is a pure maximum-capability value, not runtime
usage, and remains distinct from existing availability state
(`runtime.networkStatus` on the local Device, `online` on a `NetworkHost`):
an offline endpoint still carries its normal capacity rather than a zeroed
one. The shallow training hosts are not given an invented capacity. A pure
`deriveEffectiveTransferRateBytesPerSecond` helper derives the narrower of a
source's upload capacity and a destination's download capacity; the
FileTransfer runtime derives the current effective rate from it on every
advancement step rather than storing it, and it is not exposed through Scan,
Discovery, or any other player-facing surface. This capacity is canonical
World Truth, not Player Knowledge.

Both represented servers also own concrete CPU, RAM, and baseline CPU/RAM
runtime state. This resource truth is not exposed through Scan, Discovery, or
Inspect. The shallow training hosts remain non-resource-capable, and
`NetworkHost.online` remains the sole server availability truth.


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
- Server CPU/RAM truth and transfer capacity are World Truth. Do not expose
  them through Scan, Inspect, or Discovery.
- Shallow training hosts are deliberately shallow. Do not invent hardware,
  capacity, filesystems, or installed-software inventories for them to make a
  view or a type uniform.

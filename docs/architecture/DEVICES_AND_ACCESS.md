# Devices, Access, Sessions, and Filesystems

Status: Accepted
Scope: The separation of Device, Firmware, Software and Session, the DeviceAccess
relationship, operating contexts, and Device-owned filesystem truth.

Normative owner for architecture invariants A07, A08 and A17. `docs/ARCHITECTURE.md` is the
index and precedence entry point; it summarizes these invariants and must not
redefine them.


## A07 — Device, Firmware, Software, and Session are separate

Preserve these concepts:

| Concern | Responsibility |
| — | — |
| Device | Machine identity and represented machine state |
| Hardware | Compute and memory capacity |
| Runtime | Current resource use and execution state |
| Firmware | Operating-system identity, interaction model, and presentation |
| Software / Tools | Installed functionality |
| DeviceAccess | Established access relationship |
| Session / operating context | Which Device is currently being operated and under which authority |

Firmware must not duplicate or grant Device-owned hardware, runtime, networking,
filesystem, or other simulation truth.

Installed software is not Firmware.

A network Service's concrete implementation is Device-owned World Truth and is
not `InstalledSoftware`. Where a vulnerability belongs to a concrete product
release, its presence is derived from the Service's current implementation;
target-specific player Knowledge remains historical information and must not
rewrite itself when that hidden World Truth changes.

Established access is not an active Session.

The concrete V1 `RemoteSession` is canonical active-connection state created
from an existing `DeviceAccess`. It references that access for source, target,
service path, and authority rather than duplicating those facts. Its connected
address is an observation attribute, not Device identity.

An active Remote Session does not replace `player.localDevice`, retarget
NODE-OS, or require a global `currentDeviceId`. A distinct foreign operating
surface may consume the Session while the local NODE-OS environment remains
present. It resolves the target by stable Session → DeviceAccess → target
identity and may expose authorized current canonical target state rather than
remembered Discovery.

Operating another Device must not redefine the player’s personal Device.

NODE-OS is the Firmware environment of the player’s personal Device, not the
universal presentation layer for every machine in Synthesis.

Foreign Firmware may expose the same underlying kinds of simulation state
through substantially different interfaces.


## A08 — Access is a relationship, not a hacked flag

`DeviceAccess` represents established access between stable entities.

It is not:

- a generic `hacked` boolean
- an active connection
- an active Session
- automatic remote execution
- automatic filesystem access
- automatic privilege escalation
- automatic interface switching

If active Sessions or remote operating contexts exist, they must build on
established access without replacing it.

Disconnecting a Session must not implicitly erase persistent access unless a
future concrete mechanic explicitly changes that relationship.


## A17 — Filesystem truth belongs to the Device

Filesystem state is owned by the simulated Device and remains separate from
Firmware and interface presentation state. Files, Terminal, and any other
observation surfaces must derive their views from the same canonical
filesystem rather than creating application-local file models.

Directories are derived from file paths. Every concrete file copy has an ID
that is unique and stable within its owning filesystem, while its path is its
current location. Raw file IDs may coincide across Devices, so a cross-Device
reference requires `(deviceId, fileId)`; files do not duplicate their owning
Device identity. Copying allocates only from the destination filesystem. It
creates a new concrete copy identity even when its raw destination file ID is
equal to the source file ID on another Device, while preserving the represented
artifact semantics. Local and foreign interfaces remain bound
to their respective Device-owned filesystem; this boundary does not imply a
global file registry, generic virtual-filesystem framework, or remote
filesystem authority.

The concrete represented artifact kinds are text, software package, and
executable. Text size is derived from UTF-8 content, while package and
executable sizes are explicit positive byte counts because their payload bytes
are not represented. Size does not imply storage-capacity simulation: disk
capacity, usage, and admission remain intentionally unrepresented.

Intrinsic artifact semantics are not the same thing as what a tool recognizes.
A file's kind and kind-specific facts belong to the artifact and never change
because its path changed; copying to any chosen destination name preserves
them exactly. A concrete operation may nevertheless require a recognized path
before it admits that artifact — recognition is admission behaviour owned by
that operation, not artifact identity, and it must never rewrite, downgrade,
or reclassify the artifact it declines.


## Device state and operating contexts

A Device is the simulated machine.

A Firmware is the environment through which that Device is presented and
operated.

Software provides functionality on a Device.

Access records an established relationship.

A Remote Session records active use of established DeviceAccess. Disconnecting
it preserves the access relationship and local operating context.

These concerns may interact but must remain independently meaningful.

Conceptually:

```text
DEVICE
├── identity
├── machine state
├── hardware
├── runtime
├── networking
├── filesystem
└── installed software  when represented

DEVICE
└── FIRMWARE
      ↓
presentation / interaction model

DEVICE ACCESS
      ↓
may authorize

REMOTE SESSION
      ↓
operating context over a Device
```

NODE-OS remains one Firmware implementation, not the global definition of what
a computer interface in Synthesis must look like.

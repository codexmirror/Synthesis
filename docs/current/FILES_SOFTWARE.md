# Files, Transfer, and Software — current truth

Status: Accepted
Scope: The Device-owned filesystem, the Files application, the FileTransfer
runtime (Download and Upload), software packages and recognition, Software
Installation on the local Device and on a represented remote Device, Software
Removal, executables and RUN admission, Flipper module artifacts and the
concrete module-integration mechanic that transforms an installed Flipper into
a different build of the same release, and the local software
information/management lifecycle, as currently implemented on `main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. Durable rules behind this behavior belong to
`docs/architecture/DEVICES_AND_ACCESS.md` (A17). The accepted design contract is
`docs/design/FILES_AND_TRANSFER_V1.md`, and authoring rules for software
products, releases, and their player-facing documentation belong to
`docs/design/SOFTWARE_AUTHORING.md`.


## Filesystem and the Files application

The player's local Device owns a canonical filesystem. It represents exactly
five explicit filesystem file kinds: text files, software-package files,
software-module files, executable files, and the narrow RATTLER payload file.
Each concrete copy has an `id` that is unique and stable
within its filesystem; `path` is its current location rather than identity. A
filesystem-owned monotonic counter allocates deterministic IDs using destination
state alone. Raw IDs may coincide across Devices, so cross-Device references
require both Device ID and file ID. The local Device's initial contents consist
of the text file `/home/user/welcome.txt`, the NODE Miner 1.0 package, and the
standalone Credential Access Module artifact under `/home/user/modules`.

The Files application begins at `/home/user`, states the current path and the
local Device in its masthead, shows an explicit parent row, derives its
directory listing from that filesystem, and presents type and byte size plus
coherent text, software-package, software-module, executable, or RATTLER payload details
according to the file's explicit kind. A software-package row also carries its derived state —
INSTALLED, INSTALLABLE, INSTALLING, REMOVING, PROTECTED or UNRECOGNIZED — from the same
canonical installed software, running local software-installation Process
state, and normal package recognition of the artifact's current path. INSTALLING
disables duplicate admission for that same product until the running
installation Process ends.

Software-package details are compact and action-oriented. By default they state
the software name, the release as `version · CHANNEL`, the package's current
status, the currently installed release for that product (or NOT INSTALLED),
and the one action available — alongside the path and size every file detail
already carries. Verbose release documentation (about, capabilities, changes)
and the opaque release ID stay behind a RELEASE INFORMATION disclosure that is
closed by default and can be reopened and closed again: information is
available without being permanently expanded.
A path that does not resolve is stated explicitly rather than rendered as
nothing. A software-module row and detail state what the artifact is, the
technique it can supply standalone, its optional Flipper host, and the separate
current integration state — and deliberately offer no INSTALL, because a
module is not installable software. Optional integration is admitted from
Flipper, the application that owns that operation. Text byte size is derived from
its UTF-8 content. Package, module and executable byte sizes are explicit
represented artifact data because their actual payloads are not modeled. Storage capacity,
usage, and disk-full behavior are intentionally not represented. Terminal
provides local `ls` and type-aware `cat` commands over the same filesystem
truth; `cat` rejects software packages rather than fabricating text.


## FileTransfer runtime

Bidirectional remote FileTransfer supports remote-to-local Download and the
core local-to-remote Upload mechanic as real elapsed
network-transfer runtime rather than an immediate copy. With a current,
resolvable Remote Session, `startRemoteFileDownload` admits and starts at most
one canonical `FileTransfer` (`GameState.fileTransfer`); any second transfer
attempted while one is active fails deterministically with
`transfer_in_progress`.

A `FileTransfer` now records which of exactly two represented origins admitted
it. `origin: 'device_access'` is everything described in this document: a
transfer between two represented Devices, authorized by a `DeviceAccess`
relationship and bound to a stable `sourceDeviceId` + `sourceFileId`.
`origin: 'market_distribution'` is a download from the represented software
Market's own distribution endpoint, authorized by a purchase entitlement and
bound to a stable `offerId`; it has no source Device, no source filesystem
artifact, no `accessId`, and no LocalNetwork participation, so it appends no
Network-owned transfer evidence. That origin is owned by
`docs/current/MARKET.md`; nothing about it changes the Device-route behavior
below, and both origins share one runtime: the same single-active-transfer
constraint, the same advancement boundary, the same destination convention and
no-overwrite rules, the same cancellation, and the same Activity Monitor and
Recent Activity presentation. A RemoteSession is required only to admit a transfer:
admission resolves the current Session's canonical DeviceAccess and stores
that relationship's stable `accessId`, replacing the earlier
`sessionId` authority model. Starting a transfer records the exact
`sourceDeviceId` + `sourceFileId` and exact `destinationDeviceId` +
`destinationPath`: one endpoint is the local Device and the other is the
DeviceAccess-authorized remote Device. `bytesTotal` is derived from the
existing represented file-size semantics. Admission creates no destination
artifact, allocates no destination file ID, and creates no Process.
`FileTransfer` is a distinct runtime domain from `GameProcess`: it never
consumes CPU compute capacity or RAM, and completion never creates a Process.

Once admitted, a FileTransfer runs as its own network runtime and no longer
depends on the interactive RemoteSession that started it: a REMOTE ↔ LOCAL
context switch, disconnecting that Session, and even a later unrelated
RemoteSession all leave it running. `disconnectRemoteSession` therefore ends
only the interactive Session; it no longer clears an active FileTransfer, and
DeviceAccess remains untouched as before. The canonical `gameAdvancement`
boundary independently advances the FileTransfer runtime alongside Process
runtime on every elapsed-time step, so a transfer progresses even while no
Process is running or changing and while no RemoteSession exists. Elapsed
work derives the current effective transfer rate fresh on every advancement
step rather than storing it, and accumulates `bytesTransferred` accordingly,
clamped to `bytesTotal`. Which derivation applies depends on whether the two
endpoint Devices currently resolve, from canonical World Truth
(`LocalNetwork.memberDeviceIds`), to the same LocalNetwork: when they share
one, `deriveEffectiveTransferRateBytesPerSecond` alone decides the rate from
endpoint capacity (same-Network transfer does not use LocalNetwork
capacity, which represents external connectivity rather than internal LAN
fabric); when they resolve to two different LocalNetworks,
`deriveCrossNetworkTransferRateBytesPerSecond` additionally floors the rate
by both Networks' own external upload/download capacity. Neither derivation
nor any resolved Network ID is stored on the `FileTransfer` itself; both are
resolved fresh, and this domain's owning transfer-capacity model belongs to
`docs/current/DEVICE_SYSTEM.md`. The destination artifact is copied, and its
destination-local file ID allocated, exactly once, at the moment
`bytesTransferred` reaches `bytesTotal`; there is
still no partial-file representation, so no destination artifact exists before
that point.

Ongoing validity is derived fresh from represented canonical state through
the transfer's own `accessId`: the referenced DeviceAccess must still exist
and still authorize the one represented remote endpoint while the other
endpoint is the explicit local Device. Both Devices must remain online, both
filesystems must remain available, the source file's stable ID must still be
present on its recorded source Device, and source/destination Device
capacities — and, for a cross-Network transfer, both participating
LocalNetworks' capacities — must remain valid. Losing any of these
hard-aborts the transfer without creating a
destination artifact or allocating a destination file ID. Mutable
presentation attributes never retarget or kill a transfer: the source Device's
IP, display name, and the source file's path may all change while the
transfer keeps running against its stable IDs and its already-snapshotted
`destinationPath`. Completion collision keeps the existing no-overwrite
behavior.

While a transfer is inbound to a location inside the directory being browsed,
Files presents it as pending runtime beside the entries: its destination path
relative to the current directory, transferred and total bytes, and progress,
all derived from the canonical `FileTransfer`. It is deliberately not a
filesystem entry — it is not navigable, is excluded from the directory entry
count, carries no type or size, and is accompanied by an explicit statement
that nothing is written until the transfer completes — because no destination
artifact exists before that point.

The player may also cancel the current transfer directly through the narrow
`cancelFileTransfer` domain operation (exposed as
`GameActions.cancelFileTransfer`): given the correct active transfer ID it
clears the active transfer with no destination artifact, partial file,
allocated filesystem ID, or GameProcess; an unknown or stale ID is a no-op. The
Processes / Activity Monitor exposes this as a compact CANCEL control on the
running Download card, distinct from the REMOVE control offered only on Recent
Activity cards. Cancellation archives the transfer's final represented progress
and route before removing it from active network runtime; completed transfers
are archived the same way.

Reaching a terminal outcome — COMPLETED, CANCELLED, or INTERRUPTED — also
appends separate Network-owned evidence to the participating represented
LocalNetwork(s), preserving the exact bytes transferred at that terminal
moment; a still-running transfer never appends one, so this happens once per
transfer rather than once per advancement tick. That model — retention,
record shape, and membership/perspective placement — is owned by
`docs/current/DEVICE_SYSTEM.md`.


## Download and Upload surfaces

RACK-OS Terminal syntax is `download <remote-absolute-file-path>`, and RACK-OS
Files provides the same `DOWNLOAD` operation for a selected represented file.
RACK-OS Files presents its path, typed entry rows, artifact detail and download
state in RACK-OS's own foreign presentation rather than NODE-OS's, and its
parent row navigates to the actual parent directory.
Both interfaces use one canonical application operation and report a minimal
"download started" state; the resulting artifact appears in local Files and
local Terminal filesystem reads only once the transfer actually completes.
Download and core Upload copy rather than move, never silently overwrite
(re-checked at both start and completion), and preserve the explicit file kind
and all kind-specific artifact metadata (including package `releaseId` and
represented size). Upload requires an explicit absolute remote destination path.
Three player surfaces reach it, all through the same shared GameContext action
and canonical FileTransfer runtime: the remote-first RACK-OS Files workflow, a
selected local Files artifact, and the RACK-OS `upload` command.

The remote-first workflow is the primary Upload entry. `UPLOAD` on a RACK-OS
Files directory row establishes that remote directory as the destination
context and opens a focused Upload screen inside RACK-OS without returning the
player to NODE-OS. That screen browses the canonical local Device filesystem
as a picker over existing filesystem operations — it is not a second
filesystem, and it selects any represented file kind generically. Choosing a
local file prefills a visible editable destination from the remote directory
plus the selected file's basename (remote `/home/user` plus
`node-miner-1.0.pkg` suggests `/home/user/node-miner-1.0.pkg`), and confirming
submits exactly the visible string with the selected local source path to
`startRemoteFileUpload`, never rewritten by presentation. The screen owns only
transient picker, destination, and feedback state: canonical admission
failures are reported compactly, a rejected Upload changes nothing, and a
started Upload returns the player to the remote directory it began from with a
compact `UPLOAD STARTED` acknowledgement. It creates no remote artifact, no
partial file, no InstalledSoftware, no GameProcess, and no progress of its
own; Processes / Activity Monitor remains the transfer-progress surface.
Completion creates an ordinary remote filesystem artifact without installing or
executing it. RACK-OS Files derives its selected artifact's graphical state from
current canonical truth: it offers Download when the destination is absent and
no transfer for that artifact is active, shows a minimal in-progress state while
its transfer is active, identifies an equal artifact (ignoring only path) as
downloaded and shows its local copy, or reports an occupied destination when the
represented artifact differs.

RACK-OS provides authorized access to each foreign server's own separate
canonical filesystem. `srv-01` owns the
text file `/srv/readme.txt` and the package artifact
`/opt/packages/nodescan-exp-1.1.pkg`, which represents an 18,400,000-byte
NodeScan 1.1 artifact on the Experimental channel. It also owns `/opt/packages/gatessh-1.3.2.pkg`, a concrete 6,400,000-byte GateSSH 1.3.2 stable package published by `rack-systems`. After authorized Download, its local copy remains an ordinary artifact identified by its concrete local file ID and release metadata. `srv-02` owns its own
distinct text file, `/srv/backup-manifest.txt`, on its own independent
filesystem; downloading it copies that file, never `srv-01`'s. Both RACK-OS
Files and Terminal observe those canonical file kinds. Its `releaseId`,
`nodescan-1.1-experimental`, identifies the represented software release
independently of the artifact's filesystem path; copies at different paths
retain that same release identity.


RackUpdate public package submission is not FileTransfer Upload. It takes one concrete local software-package artifact by stable file ID as request input under RackUpdate 1.0 protocol authority; it requires neither RemoteSession nor DeviceAccess, but does require the narrow `RackUpdateSubmissionAccess` relationship a successful RackUpdate exploit granted (see `docs/current/NETWORK_ACCESS.md`). It is represented finite upload work carrying package bytes to a Service interaction rather than an instant mutation: a distinct canonical runtime domain (`GameState.rackUpdate.submission`), advanced at the same canonical `advanceGameState` boundary as `FileTransfer` and governed by the same Device/LocalNetwork transfer-capacity model, but never itself a `FileTransfer` or a `GameProcess`. Success stores the exact submitted GateSSH product, release, build, and ordinary release metadata as the target Device's one pending GateSSH activation. It does not change active InstalledSoftware or the running managed Service, creates no remote filesystem artifact, and consumes or changes no local file. A second submission cannot replace pending GateSSH. Cancelling, interrupting, or losing the route creates no pending activation. At an independently established real Device boot boundary, `activatePendingGateSshAtDeviceBoot` atomically replaces the active GateSSH InstalledSoftware and managed Service implementation from that preserved exact identity, clears pending, and retires the consumed submission's stale `REBOOT REQUIRED` outcome. If either active owner is unavailable, it changes nothing. It does not cause or model a boot and does not refresh Discovery or Knowledge. Authorized Upload retains its existing RemoteSession → DeviceAccess admission and arbitrary destination-path semantics.


## Packages, recognition, and Software Installation

AuthGuard 1.0 is ordinary installed software and a separate lootable package on
srv-02. Its narrow installation compatibility is RACK-OS; NODE-OS rejects it.
Installation alone changes no Service, Knowledge, or authority. AuthGuard is the
product identity; its concrete represented 1.0 release explicitly supports the
GateSSH 1.3.3 and 1.4.0 authentication pipelines, while GateSSH 1.3.2 is
unsupported. Compatibility is independent of weakness presence: GateSSH 1.4.0
currently exposes neither authored Credential Access weakness. A GateSSH release
change changes the underlying vulnerable implementation and weakness while
preserving the AuthGuard installation; a mitigation instead leaves the underlying
weakness in place while changing how a concrete exploit exercises it.

A software-package file is an artifact on a Device-owned filesystem, not an
installation or a running Process. Downloading the experimental package alone
leaves the local Device's NodeScan at 1.0 Standard. A concrete package that
physically exists on the current local filesystem and is normally recognized
at its current path can be installed through local Files (`INSTALL`) or NODE-OS
Terminal (`install <local-absolute-file-path>`), both of which use the same
application operation over current canonical state. Ordinary installation has
no closed product whitelist: the package artifact's stable `productId`, opaque
`releaseId`, stable concrete `buildId`, name, version, and stated channel and publisher where the package
actually represents either, are the authoritative ordinary installation facts.
Channel and publisher are both release presentation metadata rather than
required fields; a release that represents neither (for example GateSSH 1.3.3)
keeps that absence through the package, the installation Process, and the
resulting InstalledSoftware, rather than settling for an invented or inherited
value.

A `software_module` artifact is never admitted here at all. Installation reads
only `software_package` artifacts and rejects any other kind as
`not_software_package` before recognition or product support is considered, so
no module can become InstalledSoftware through any path.

Normal NODE-OS package installation does, however, require the artifact's
current concrete path to end in exactly `.pkg`, case-sensitively
(`isRecognizedSoftwarePackagePath`). This is recognition, not identity: a
`software_package` transferred to `node-miner-1.0.pk`, `node-miner-1.0.pkd`,
`node-miner-1.0.123` or `node-miner-1.0.PKG` keeps its kind, `productId`,
`releaseId`, `buildId`, name, version, publisher and size unchanged, and FileTransfer
still preserves both intrinsic source semantics and the exact destination path
the player chose. Only normal installation from that path is unavailable:
`installLocalSoftwarePackage` rejects it at admission with
`unrecognized_package_extension` before product support is considered, Files
presents the package as UNRECOGNIZED with an explicit UNRECOGNIZED PACKAGE
EXTENSION · NOT INSTALLABLE state and no INSTALL action, and Terminal `install`
reports UNRECOGNIZED PACKAGE EXTENSION. Distinguishing artifact truth from what
a tool can recognize more richly (file inspection, forensic recognition) is not
represented in V1.

In local Files, INSTALL opens an explicit Install Review before anything is
admitted. The first INSTALL tap creates no GameProcess and changes no
GameState: the review is presentation state owned by Files alone. It states the
software and release, the local target Device, the exact package path, the
currently installed release for that product, and the represented capabilities
and changes of the release being installed — it never claims consequences the
game does not represent. CANCEL returns to the package detail having changed
nothing; confirming INSTALL forwards that exact package path to the canonical
`installLocalSoftwarePackage` admission, which remains the sole authority over
whether installation may start, and a canonical admission failure is reported
in the review as-is rather than as fabricated installation state. Terminal
`install` remains a direct single-step admission.

Installation admits one real finite `software_installation` GameProcess on the
target Device's own Process scheduler rather than applying its consequences
immediately. One shared admission path serves both the local Device and a
represented remote Device: it validates the represented package once, at
admission, against that target Device alone, snapshots only the release facts
completion needs (`productId`, `releaseId`, `buildId`, `name`, `version`, `channel`, and
`publisher` when stated), and requires a small explicit V1 work and RAM
requirement — the same shared CPU/RAM contention Service Analysis, Credential
Access, and NODE Miner already use, with no package-size formula. Rejecting a
second concurrent installation of the same product *on that same executor* and
the same `buildId` already installed *on that same Device* are both resolved
at this same admission instant. Device-owned installed software and the package
artifact are both untouched until the Process completes.
`installLocalSoftwarePackage` resolves everything from
`player.localDevice`; remote installation is owned by
`installRemoteSoftwarePackage` (see below).

Only when that Process completes does `resolveCompletedSoftwareInstallations`
— resolved at the same canonical `advanceGameState` boundary that resolves
Service Analysis and Credential Access, and guarded the same way so repeated
advancement after completion never re-applies it — project the snapshotted
release metadata onto installed software owned by the Device named by
`executorDeviceId`, under the exact snapshotted `productId`. Stable Device
identity is the only authority at completion: the package path, the address
that was connected, the Session, and the current interface are all irrelevant
by then. A Process whose executor Device no longer represents an installable
filesystem and inventory resolves as a truthful `target_unavailable` failure
rather than remaining unresolvable. A different concrete build of a matching product replaces
that product in place, while an absent product is appended and unrelated
installed software is preserved; there is no version comparison or separate
Update operation. The package remains unchanged throughout. Ordinary
completion creates no executable, command, capability, or other runtime merely
because software is installed. Product-specific additional consequences remain
explicit concrete mechanics: current NODE Miner installation additionally
re-checks its managed destination and creates its one represented executable,
while NodeScan uses the ordinary installed-release replacement path and keeps
its capability and removal rules elsewhere. Installing the represented experimental package
therefore makes the NodeScan GUI and Help derive NodeScan 1.1 Experimental
from installed software, only once installation completes. Which player-facing
operations that release supplies is owned by `docs/current/NETWORK_ACCESS.md`:
Scan and Analyze exist under every current NodeScan release, and Inspect is
supplied by NodeScan 1.1 Experimental and absent under 1.0 Standard
(`nodeScanSupportsInspect`).


## Remote software installation

A software package that physically exists on the Device the player is currently
operating through RACK-OS can be installed **on that Device**.
`installRemoteSoftwarePackage` never receives a target from presentation: it
resolves one only through the canonical operating context — RemoteSession →
DeviceAccess → target Device — and then narrows that host to a Device that
actually represents an installable filesystem, installed-software inventory and
hardware/runtime. A host representing no software inventory is reported as
`target_not_installable` rather than being given a fabricated one, an absent or
unresolvable operating context is `session_unavailable`, and a target that went
offline while the Session was live is `target_offline`. The currently
represented `USER` privilege of that DeviceAccess is sufficient authority in V1
because no finer permission state exists; this is the absence of a permission
model, not a claim that every future `USER` authority installs software.

From that point the operation is the same shared admission path local
installation uses, resolved entirely against the target: the package is read
from the *target's* filesystem, normal `.pkg` recognition applies to the
target artifact's own current path, already-installed and already-installing
checks read that Device's own inventory and its own running Processes, RAM
admission uses that Device's own hardware, and NODE Miner's installation-path
occupancy is checked against the target filesystem. Local and remote inventories are fully independent, but installation compatibility is concrete Device truth. NodeScan and Flipper both currently require the stable NODE-OS Firmware identity: NodeScan 1.1 Experimental and a Flipper 1.0 package both remain normally installable on node-01 and are rejected as `incompatible_firmware` on RACK-OS, with Files presenting NOT COMPATIBLE / REQUIRES NODE-OS from the same installation-domain eligibility rule. This is a small named list of concrete products, not a general requirements framework. Firmware incompatibility rejects installation before any `software_installation` Process is admitted; it never touches the package artifact itself, which remains a real transferable artifact on the target's own filesystem. NODE Miner 1.0 remains normally installable on RACK-OS, as do unrelated ordinary packages; neither Device's inventory or filesystem is touched by the other's installation.

The resulting Process's `executorDeviceId` is the target Device, so the target
supplies the CPU throughput and the reserved RAM through the existing
executor-owned scheduler — there is no second scheduler and no remote-specific
Process kind. It deliberately retains no `accessId` or `sessionId`: unlike
`FileTransfer`, whose runtime continuously spans a cross-Device route and
revalidates that represented relationship, an admitted installation consumes
only the target Device's own resources and has no continuing cross-Device
relationship to revalidate. `DISCONNECT` therefore ends the interactive
Session and the player's observation of the work, never the work itself: the
Process keeps advancing on the target's own runtime with no Session present,
and completion applies its consequence normally. Reconnecting later through
the still-valid DeviceAccess derives whatever is true by then — still
INSTALLING, or INSTALLED.

Completion ordinarily makes the target Device's `installedSoftware` gain or replace that exact product release, and product-specific consequences occur on that same Device. The authored RACK-OS servers concretely carry GateSSH InstalledSoftware matching their managed Service (srv-01 at 1.3.2 and srv-02 at 1.3.3). Installing another GateSSH release through Files atomically replaces both that installed release and the existing Service whose implementation has stable `gate-ssh` product identity; it creates no Service and changes no unrelated Service. If that managed Service is absent at completion, neither half is applied. Older and newer represented releases use the same lifecycle with no version ordering. Remote NODE Miner installation therefore creates its one
managed executable at `/usr/local/bin/node-miner` **in the target
filesystem**, leaving the local Device's filesystem and inventory untouched.
Installation is still not execution: completion creates the artifact, and RUN
remains a separate later admission step (see **Remote executable RUN and
control** below). `startNodeMiner` continues to resolve its artifact from, and
admit onto, the player's local Device alone; remote RUN is owned by
`startRemoteNodeMiner`.

RACK-OS Files is the only interface for package installation in V1. Once a software package is
selected on the operated Device, its detail states the package identity
(name, `version` + channel, size, publisher where the package claims one, and
release ID), then that Device's own `STATUS` and `CURRENT` installed release for
that product, then the one action available — with the artifact's relationship
to node-01 kept as a secondary `TRANSFER` block so existing Download behaviour
and its destination/conflict semantics are unchanged. `STATUS` distinguishes
five implemented states:

- `INSTALLABLE` — this release is not installed on this Device and normal
  installation may be admitted from this artifact's current path.
- `INSTALLING` — this Device's own executor identity is currently running an
  installation Process for this product.
- `INSTALLED` — this Device's inventory currently holds this exact release.
- `UNRECOGNIZED` — normal installation does not recognize this artifact's
  current path (see the `.pkg` recognition rule above). The artifact itself is
  unchanged.
- `NOT INSTALLABLE` — this Device does not currently represent the software
  state installation requires at all, so no package can be installed here. It
  is **not** the same condition as an empty `installedSoftware` inventory: an
  empty inventory is a Device that represents installed software and currently
  has none, and a package on it is normally `INSTALLABLE`. Presentation must
  never substitute one for the other, and the pane states no `CURRENT` release
  in this state because the Device has no inventory to report one from.

Another installed release of the same product is stated as `CURRENT` while the
selected package remains `INSTALLABLE` as a replacement. `INSTALL` opens a
compact inline confirmation in the same pane rather than a second screen or a
modal: it names the target Device, the exact remote package path, and the
current installed release.
Opening it and cancelling both change no GameState; confirming forwards that
exact path to the canonical operation, which remains the sole admission
authority, and a canonical admission failure is reported in the pane as-is.
`INSTALLING` is derived from the target executor's own running Process, and
`INSTALLED` from the target Device's inventory — never from an interface-local
lifecycle flag. In this V1 the presented state is the existence of the work and
nothing further: RACK-OS shows no remote progress percentage, CPU, RAM, work
units, estimate, or cancellation control. That is the current scope of this
slice's presentation, not a standing rule about what an authorized remote
runtime observation could legitimately expose later; adding any of it would
need its own concrete mechanic and its own decision.
RACK-OS System remains the compact read-only machine sheet with no software
management, and the RACK-OS Terminal gains no package commands.

## Executables and RUN admission

Executable files carry concrete program and release identity. V1 supports
execution for exactly one represented program, NODE Miner (`node-miner`,
release `node-miner-1.0`). The player's local Device starts owning a real
NODE Miner 1.0 `software_package` artifact at
`/home/user/downloads/node-miner-1.0.pkg` — an unofficial third-party
release: the package states the `unofficial` channel and the `nm-dev`
publisher, and local Files and the install output present that provenance.
It is not yet installed, has no executable, and is not running. Installing it
through local Files (`INSTALL`) or NODE-OS Terminal
(`install <local-absolute-file-path>`) uses
the same `installLocalSoftwarePackage` application operation NodeScan
installation uses, extended to support the `node-miner` product: a
successful admission starts one running `software_installation` Process and
reports it (Files transitions the package row through INSTALLABLE →
INSTALLING → INSTALLED; Terminal reports INSTALLING with the represented
release and Process ID rather than claiming installation completed
immediately). Neither installed software nor an executable exist yet at this
point — package, installation Process, InstalledSoftware, and a running
program remain four distinct things. Only once that Process completes does
it record NODE Miner 1.0 — with the package's own stated channel and
publisher — as installed software on that Device and create exactly one
concrete NODE Miner `ExecutableFile` at the deterministic path
`/usr/local/bin/node-miner`, leaving the package artifact in place and
starting no Process of its own (RUN remains a distinct, later admission
step). Reinstalling the same already-installed concrete build is a no-op that
creates no duplicate executable, and an unrelated artifact already occupying
the installation path blocks installation rather than being overwritten —
this is re-validated both at admission and, safely and idempotently, at
completion, so an artifact that occupies the destination only after
admission still cannot be overwritten and instead leaves the Process with a
truthful failed result.

RUN admits a real, currently present local executable copy into a continuous
Device-owned `GameProcess`. Local Files exposes RUN only for a currently
present executable whose `programId` and `releaseId` identify the supported
NODE Miner 1.0 release; other executables (including future releases of
NODE Miner) show no RUN action. Executable possession and InstalledSoftware
are distinct: direct Files RUN is artifact-authoritative and does **not**
require matching InstalledSoftware, so a supported concrete executable that
was copied or downloaded can be run directly. InstalledSoftware may still gate
registered software integration or commands. In particular, the current
`node-miner` CLI is a stricter registered interface: as described in
`docs/current/NODE_ECONOMY.md`, its availability requires both matching
InstalledSoftware and a present supported executable on the Device whose
Terminal is being operated. This applies independently to NODE-OS on node-01
and RACK-OS on its canonical remote target; neither Device's inventory or
artifact can supply the other's command. Both Firmware Terminals reuse the
registered NODE Miner product CLI (`help`, `run`, `status`, `stop`, and
`payout`), and RACK-OS has no standalone `miner` alias.
Installed-software
metadata alone can never conjure a missing executable back into RUN
eligibility. Files resolves
the selected executable through the same canonical filesystem Files and
Terminal already share, and requires an explicit non-empty NODE payout address
(Files prefills the represented local NODE Wallet address as a convenience, but
the canonical `runNodeMiner`/`startNodeMiner` operation always receives the
address explicitly and never falls back to it). The artifact is required only at
this admission step: once the Process exists it retains its own stable
`programId`/`releaseId` provenance and exact, unnormalized configured
`payoutAddress`, and no longer depends on that source file, so moving or
deleting it afterward never affects the running Miner. A missing, wrong-kind, or
unsupported artifact, an empty address, or a duplicate attempt (same `programId`
already `running` on the same `executorDeviceId`) is rejected with no Process
created and no economic mutation. Successful RUN gives immediate visible
feedback: Files derives a RUNNING presentation (with the current Process ID)
directly from canonical `ProcessState` rather than temporary local success
state, and stops offering a normal RUN action for as long as that Miner keeps
running.

`srv-01` no longer distributes a NODE Miner executable; only its NodeScan
Experimental package remains.

A software package remains, exactly as this document and
`docs/design/SOFTWARE_AUTHORING.md` define it, a file on a Device-owned
filesystem. The represented software Market adds no exception: what it offers
before a download is a *distribution* — represented offer and source truth
about a release and its byte size — not an artifact. No artifact, file ID or
path exists for a Market offering until its transfer completes, at which point
completion creates one ordinary local artifact of exactly the kind that
offering distributes, to which every rule in this document then applies
unchanged. GateSSH 1.3.3 is distributable that way for the first time, keeping
exactly the channel and publisher its own authored release actually represents
— which is none. The Flipper Rollback Module is distributed the same way as a
`software_module` artifact rather than a package: its completion creates a
module artifact and no InstalledSoftware, and installation never admits it. See
`docs/current/MARKET.md`.

The continuous Miner runtime is owned by
`docs/current/PROCESSES_ACTIVITY.md`; what it produces, routes, and records
economically is owned by `docs/current/NODE_ECONOMY.md`.


## Remote executable RUN and control

A supported NODE Miner executable that exists on the Device the player is
currently operating through RACK-OS can be RUN **on that Device**. One shared
admission path serves local and remote RUN: the artifact is read from the
executor's own filesystem, the one-Miner-per-executor duplicate rule is scoped
to that Device's own running Processes, and RAM admission uses that Device's
own hardware. Remote RUN stays artifact-authoritative exactly as local RUN is —
matching InstalledSoftware is never consulted, so an uploaded or copied
supported executable is a valid execution source even on a Device that
represents no software inventory at all.

`startRemoteNodeMiner` never receives an executor from presentation. It
resolves one only through the canonical operating context — RemoteSession →
DeviceAccess → target Device — and then narrows that host to one that actually
represents the filesystem and hardware/runtime execution needs. An absent or
unresolvable operating context is `session_unavailable`, a target that went
offline while the Session was live is `target_offline`, and a host representing
no executable runtime is `target_not_executable` rather than being given
fabricated resources. The DeviceAccess relationship's currently represented
`USER` privilege is the only authority V1 represents.

The resulting `NodeMinerProcess` carries the target's `executorDeviceId`, so
that Device supplies its CPU throughput and reserved RAM through the existing
executor-owned scheduler, and its production contends with that Device's own
other work. Like remote installation it retains no `accessId` or `sessionId`:
returning to NODE-OS, `DISCONNECT`, and a later unrelated Session all leave it
running, and reconnecting through the still-valid DeviceAccess simply observes
whatever is true by then. Local and remote Miners are fully independent
runtimes — node-01 and `srv-01` may each run one at the same time, each
reserving RAM only on its own executor.

`stopRemoteNodeMiner` is the matching control: it resolves the operated Device
the same way and removes only *that* Device's Miner, with the same zero elapsed
time, no final mining work, no hidden reward, and immediate CPU/RAM release
local STOP has. Local STOP cannot stop a remote Miner and remote STOP cannot
stop the local one. Unlike local STOP it archives nothing, for the reason
`docs/current/PROCESSES_ACTIVITY.md` owns.

RACK-OS Files is the interface for both. A selected executable states its
program identity, then — when it is the supported release — either the one
action available (`RUN`) or the Miner this Device is currently running, with
the artifact's relationship to node-01 kept as the same secondary `TRANSFER`
block package details use. `RUN` opens a compact inline confirmation in the
same pane naming the executor Device and the exact remote program path, with an
explicit payout-address field prefilled from the represented local NODE Wallet
as a convenience; confirming forwards the exact visible address to the
canonical operation, which remains the sole admission authority, and a
canonical admission failure is reported in the pane as-is. A running Miner is
presented as `RUNNING ON <device>` with its Process ID, current payout address,
cumulative gross production, and a `STOP` control — all derived from that
Device's own canonical Process, never from an interface-local flag, so the
local Device's Miner can never be presented as this Device's. An executable
that is not the supported program is stated as `UNSUPPORTED` and offers no
execution.

Live payout retargeting is deliberately **not** offered in RACK-OS Files; it is
the shared NODE Miner Terminal integration's deeper control path on both
NODE-OS and RACK-OS, owned by `docs/current/NODE_ECONOMY.md`.


## RATTLER 1.0 and target-bound artifacts

RATTLER 1.0 is the first concrete standalone underground offensive software
product. Its ordinary package installation follows the shared finite
`software_installation` Process and, only at successful completion, atomically
creates InstalledSoftware plus the one executable at
`/opt/rattler/rattler.exe`. Admission and completion both refuse an occupied
managed destination; neither half of installation is applied in that case.
RATTLER requires NODE-OS through the same narrow concrete-product eligibility
rule used by NodeScan and Flipper, not through a generic requirements system.

Files opens the dedicated RATTLER surface only from the exact current
executable. `createRattlerPayload` separately revalidates both the exact
InstalledSoftware release/build and the concrete executable's program,
release, and build at its managed path. Missing, deleted, replaced, stale, or
mismatched executable truth refuses creation without mutation; installed
metadata alone grants no authority and never recreates the file.

The player supplies an address. Resolution reads only remembered
`Discovery.devices`, requires exactly one matching observation, and never
searches hidden World hosts. Success writes one `rattler_payload` artifact at
`/opt/rattler/payload-<stable-device-id>.rpl`. The artifact owns its
filesystem-local copy ID, represented size, RATTLER release/build provenance,
stable target Device ID, and creation-time address snapshot. Stable Device ID
is target binding; the address is presentation/provenance only. Existing
destination-placement rules reject duplicates without overwrite.

The payload is an ordinary selectable Files artifact and the existing
authorized Device FileTransfer Upload path can copy it to a represented remote
filesystem. Copying allocates a destination-filesystem ID and destination path
while preserving all RATTLER and target metadata. Completion places only the
file: it installs or executes nothing, starts no Process, attempts or reveals
no PIN, and mutates no security, Discovery, Knowledge, or DeviceAccess state.
Upload completion remains strictly distinct from execution: it starts no
Process and performs no PIN attempt. Once an exact target-bound payload copy is
present on the Device currently resolved through an active Remote Session and
DeviceAccess, RATTLER offers a separate explicit **DEPLOY** action. Admission
starts exactly one target-Device-owned `rattler_pin_search` Process for VEYRA
Wallet's Device-PIN challenge; a Session authorizes admission only and is not a
continuing dependency. A second running deployment for that Device and surface
is refused. RATTLER's program remains an authoring surface after admission and
derives a selectable monitor for every retained RATTLER Process, so deployments
on different target Devices remain independently inspectable. Only the active
Remote Session's exact target-bound payload can surface the current **DEPLOY**
action; the monitor does not inspect arbitrary remote filesystems.

The Process remains bound to the admitted payload's target Device, filesystem
copy ID, release, and build. Removing or replacing that exact copy interrupts
the Process before further candidates are tested. RATTLER 1.0 tests the full
deterministic ascending four-digit space `0000` through `9999` at 625
attempts per minute: 10,000 real candidates in exactly 16 minutes, never a
probability roll and never a previously-tested or skipped candidate. Each
candidate is compared with the Device-owned secret; success or exhaustion is
terminal and idempotent. Because the search is exhaustive over every possible
four-digit PIN, an ordinary Device PIN is always eventually reached — a real
PIN succeeds only when the canonical sequence reaches it, never sooner.
Success records the matching PIN as narrow Player Knowledge associated with
stable Device identity. It changes no PIN, Wallet protection, access,
Session, or financial truth. This concrete release attacks only VEYRA Wallet
authentication; Settings remains an ordinary manual consumer of the same
Device-owned PIN, not another RATTLER surface.


## Flipper acquisition and module integration

A fresh game has no installed Flipper. It instead starts with one concrete
Credential Access Module 1.0 `software_module` artifact under
`/home/user/modules`; that standalone artifact directly supplies the existing
`AUTH-017` technique. Module possession is filesystem truth, not
InstalledSoftware, and does not depend on Flipper.

The authored local Device also starts with KeyProbe 1.0 as ordinary installed
software. KeyProbe is a second concrete provider of the same Credential Access
Technique, not a Flipper module and not an ownership flag. Its provider identity
is retained by the Credential Access Process; its narrow AUTH-017 behavior is
owned by `docs/current/NETWORK_ACCESS.md`.

The current code and state schema name both represented artifacts
`SoftwareModuleFile` and associate them with the Flipper host. In current
behavior, however, each exact supported artifact is also a standalone provider
of its one Technique: possession can make Credential Access or Rollback
executable without Flipper. "Module" here is therefore current Flipper product
and implementation terminology, not the universal Synthesis category for an
offensive capability or Technique. The accepted broader semantics are owned by
`docs/design/HACKING_AND_OBSERVATION_V1.md`; this documentation pass does not
rename the current types, artifact names, or UI.

This entire section records the **current standalone Flipper implementation**.
Current Flipper is its own `InstalledSoftware`, managed executable, separately
opened application surface, build lineage, and integration owner. The selected
future product direction intentionally differs: Flipper becomes an
independently identifiable NodeScan extension/modification, while NodeScan
remains the host application and owns Target / Network context. That migration's
extension identity, compatibility, installation, transformed NodeScan state,
and embedded presentation are not implemented or specified here; their design
boundaries belong to `docs/design/HACKING_AND_OBSERVATION_V1.md` and
`docs/design/SOFTWARE_AUTHORING.md`. Until a concrete migration changes code,
the standalone facts below remain Current Truth.

Open Package Exchange lists the ordinary Flipper 1.0 software package for
0.01 NODE. Buying establishes entitlement, downloading creates the package
artifact, and ordinary Software Installation creates both a module-free
`FlipperInstallation` and its concrete executable at
`/home/user/apps/flipper`. Flipper is not a Home launcher: selecting that
installed executable in Files and choosing OPEN enters the Flipper surface.

The installed canonical host is `build-flipper-1.0-base`, contains no modules,
and is 4,000,000 represented bytes. It supplies no offensive technique merely
because the product is installed. `integratedModules` remains the sole
capability authority; `buildId` records concrete build identity and never
implies capability.

Exactly two standalone module builds are represented: Credential Access
(`AUTH-017`, initially owned) and Rollback (`UPD-001`, acquired from the
Market). Flipper admits either exact authored artifact by stable local file ID
as a 900-work, 512-MiB `flipper_module_integration` Process. Admission requires
the installed host, retains the artifact, changes no capability immediately,
and rejects foreign builds, duplicate integration, and concurrent integration
of the same module.

Completion transforms only the installed host, exactly once. It retains the
Flipper 1.0 release, adds the module in canonical order, increases represented
size by that artifact's size, and selects an explicit authored build identity:
`build-flipper-1.0-credential-access`, `build-flipper-1.0-rollback`, or the
strongest `build-flipper-1.0-credential-access-rollback`. Integrating the two
modules in either order converges on that same strongest build. Source module
artifacts remain ordinary owned files after integration: integration neither
deletes, moves, consumes, nor mutates them, and continued possession of a
source artifact is never required for, or consulted by, the capability
`integratedModules` already grants.

Admission also binds the Process to the exact supported source Flipper release
and build and to the matching managed executable Files presents. Completion
atomically updates InstalledSoftware and that same executable to the explicit
result build and represented size. If either admitted host representation is
missing, replaced, or changed before completion, the Process resolves without
transforming the replacement. Neither host representation changes while work
is still running.

MODULES is Flipper's one module surface; no separate INTEGRATION section
exists. `deriveFlipperModuleDisclosure` (`src/core/game/flipper.ts`) is the one
authority for what it may state: a module already in `integratedModules`, or
one this Device currently possesses an exact compatible artifact for —
recognized by the same exact release/build/version/size match
`startFlipperModuleIntegration` admits on
(`isSupportedFlipperModuleArtifact`), never a looser match on `moduleId`
alone. A module the player has neither integrated nor found a compatible
artifact for is never listed, named, or counted: MODULES never states the
authored module catalog or its total size. Each visible module renders as
exactly one row, showing INTEGRATED, an INTEGRATE action for a possessed
compatible artifact, or that module's own running integration progress — so a
module already integrated whose source artifact still exists is never shown
twice, and an unowned or foreign-build artifact never appears as a candidate.

The Flipper application derives the installed release, concrete build, size,
integrated module set, compatible local artifacts, and running integration
work from canonical Device and Process truth. It performs no reconnaissance,
discovers nothing, and reads no hidden World Truth.

Flipper now also presents an **ARSENAL** collection above its existing module
workflow. NodeScan links to that surface when Flipper is installed, while
target execution remains exclusively contextual under NodeScan ACTIONS. The
first implemented hierarchy is `ACCESS → CREDENTIAL ACCESS`: it shows the
exact supported Credential Access Module 1.0 when its artifact is locally
possessed or its module is integrated, and the exact installed KeyProbe 1.0
release/build as a second compatible provider. KeyProbe remains ordinary
InstalledSoftware and the module remains a standalone filesystem provider;
the collection neither owns nor changes their Credential Access Technique or
resolution behavior.

`deriveFlipperArsenal` is a presentation projection over the local Device's
represented filesystem, InstalledSoftware, and concrete Flipper build. The
Flipper domain owns the narrow exact KeyProbe 1.0 release/build compatibility
rule consumed by that projection; presentation does not establish technical
compatibility. The projection stores no unlock or collection state, reads no
target/World Truth, and omits a provider as soon as its represented cause is
absent (except where completed
Flipper integration is itself the represented cause). It deliberately names
only this concrete compatibility precedent rather than introducing Technique,
provider, capability, or plugin registries. No speculative empty branch is
rendered. In particular, NETWORK and DEAUTH remain unimplemented and absent.
Rollback remains available through its unchanged standalone and optional
integration mechanics, but is deliberately deferred from ARSENAL V1 because
current semantics do not yet justify a durable collection category for it.

## Software Removal

REMOVE admits removal of the currently installed release of one product into
a real finite `software_removal` `GameProcess`, sharing the same Device
CPU/RAM scheduler and contention that Service Analysis, Credential
Access, Software Installation, and NODE Miner already use — a small explicit
V1 work and RAM requirement, no package-size formula. `removeInstalledSoftware`
targets whatever is currently installed for a product rather than accepting a
`releaseId`: it is not always the player's choice which concrete release
removal restores. It validates current world truth once, at admission,
snapshots the exact release and concrete build facts completion needs, and applies none of
removal's consequences immediately — Device-owned InstalledSoftware and the
filesystem stay untouched until the Process completes. Rejecting a second
concurrent removal of the same product and insufficient RAM are both resolved
at this same admission instant, the same way Software Installation resolves
its own admission failures.

Not all installed software has the same represented removal semantics. NodeScan 1.0 Standard
(`nodescan-1.0-standard`) canonical build is the protected baseline bundled with the
current NODE-OS 1.0 environment: REMOVE never starts a Process against it,
and local Files represents it truthfully as protected/system baseline rather
than offering a normal destructive uninstall action. NodeScan 1.1 Experimental
is a removable override of that baseline: REMOVE may target it, and
completion restores the concrete protected NodeScan 1.0 Standard baseline
(`releaseId: nodescan-1.0-standard`, `version: 1.0`, `channel: standard`)
rather than leaving NodeScan absent. This is the concrete downgrade mechanic
referenced by Inspect capability in `docs/current/NETWORK_ACCESS.md`. Changing
installed NodeScan capability never touches Discovery or Knowledge: previously
stored Enhanced Inspect snapshots remain exactly as observed, while a *new*
Inspect cannot be performed after restoration. NODE Miner is ordinary
removable software: completion removes its InstalledSoftware entry and, only
when the artifact at the deterministic installed path
(`/usr/local/bin/node-miner`) still represents the exact release and build removal was
admitted against, deletes that executable — an unrelated or already-replaced
artifact occupying that path is left untouched, and the downloaded package
artifact is never touched either way. Flipper is ordinary Market-acquired
software, not protected NODE-OS baseline software. Its removal/reset semantics
are not represented in V1, so REMOVE rejects an installed Flipper as
unsupported rather than silently treating it as a system app; this limitation
does not alter its represented Market acquisition path.

An already-running `NodeMinerProcess` is a distinct, independent runtime from
NODE Miner's InstalledSoftware and executable, and REMOVE never touches it:
removing NODE Miner while its Miner keeps running leaves that Miner producing
and routing NODE exactly as before, and only explicit STOP still ends it.
Resolution happens once, at the same canonical `advanceGameState` boundary
Software Installation resolves at, guarded the same way so repeated
advancement after completion never re-applies a consequence. The currently
installed release and build are re-checked against what admission snapshotted, so a
Process resolves as a truthful `not_installed` failure rather than mutating
unrelated installed software if that release changed before completion.

Local Files observes that runtime on the package artifact — transitioning a
supported installed package through INSTALLED → REMOVING → back to INSTALLABLE
(NodeScan) or absent from installed software (NODE Miner) — while removal is
started from System's inline installed-software management (see
`docs/current/DEVICE_SYSTEM.md`), where the same operation is labelled
UNINSTALL for ordinary removable software and RESTORE 1.0 STANDARD where
removal restores the NodeScan baseline. Duplicate admission stays blocked while
REMOVING. The Activity Monitor observes Software Removal like any other
finite local-Device Process, presenting it under RUNNING while active and
archiving it to Recent Activity with a concrete `BASELINE RESTORED`,
`REMOVED`, or safe-removal-failure outcome once it ends.


## Local software information and management

Immutable authored software-release content lives in the pure game domain but
outside mutable `GameState`. It is the single authoring owner for the current
represented releases' stable release, canonical build, and product identities, ordinary display
metadata (name, version, channel and publisher), and static player-facing ABOUT,
CAPABILITY and CHANGE documentation. Initial Package and InstalledSoftware
state may explicitly copy the destination-appropriate fields from that content.

Once created, each concrete `SoftwarePackageFile` and `InstalledSoftware` is a
self-contained canonical snapshot of represented Device state. Installation
continues to snapshot the concrete Package presented at admission and never
looks up, normalizes, reconciles or repairs it against authored content. An
ordinary package without authored documentation therefore remains installable.
Authored documentation describes a release but never grants a command,
capability, executable, Process or other gameplay behavior; concrete mechanics
remain the only gameplay authority.

One local software lifecycle runs across both applications:

```text
Files: Software Package
  -> INSTALL
  -> Install Review
  -> Software Installation Process
  -> InstalledSoftware
System: InstalledSoftware
  -> expand
  -> inspect / manage
  -> UNINSTALL or RESTORE where the canonical runtime supports it
  -> Software Removal Process
```

System's Installed Software inventory is the canonical local software-management
surface. Its inline expanded rows combine the Device-owned current installation
with static, player-facing release documentation (about, capabilities, and
changes). That documentation is descriptive presentation only: concrete game
operations and release-specific rules remain gameplay authority, and release
copy never discloses hidden target or runtime truth. System starts the existing
finite removal operation, presenting removal of NodeScan 1.1 Experimental as
restoration of the protected NodeScan 1.0 Standard NODE-OS baseline. Flipper
remains ordinary Market-acquired software whose removal/reset semantics are unsupported in V1,
while NODE Miner remains ordinary removable software. Flipper is also the one
installed product whose expanded row states more than a release: its concrete
build, that build's represented size, and the modules it integrates, all read
from the installation itself.

Files remains the filesystem/package surface. Software package details reuse the
same release documentation and expose installation and observed package state,
but no longer initiate installed-software removal. Unknown release IDs retain
represented package or installation metadata and simply omit unavailable
release documentation. Neither application owns software truth of its own:
both read the same Device-owned filesystem, installed software, and Process
state.


## Gotchas

- Artifact identity is not filename or path recognition. A package keeps its
  kind, `productId`, `releaseId`, `buildId`, name, version, publisher and size no matter
  where it is copied to; only what an operation is willing to *admit* depends
  on the path. An operation that declines an artifact must never rewrite,
  downgrade, or reclassify it.
- Release ≠ Build ≠ Package ≠ InstalledSoftware ≠ Executable ≠ Process.
  Concrete build identity survives the latter lifecycle without becoming file-copy identity.
- A module is not software. A `software_module` artifact never becomes
  InstalledSoftware and never installs; it is integrated into an
  already-installed host product, and that host is the installed product.
  Both exact supported V1 artifacts nevertheless supply their Techniques
  standalone through the concrete Credential Access and RackUpdate attempt
  mechanics. That is provider behavior, not software installation and not a
  generic file-execution path.
- A module is not a Vulnerability and not Knowledge. Possessing or integrating
  one discovers nothing and creates no remembered evidence.
- Flipper's capability is `integratedModules`, never `buildId`. A different
  build identity is provenance; it must never be read as evidence that a
  technique is supported, and a technique must never be inferred from a build
  ID's shape.
- Integration never consumes the source artifact, and repeating it cannot
  duplicate a module, grow the represented size again, or fabricate a further
  build.
- Installation is Device-targeted, not permanently local. `executorDeviceId` is
  the Device being installed onto, and completion applies its consequence
  there. Never infer the target from a package path, an address, a Session, or
  the current interface.
- Local and remote installed-software inventories are independent. The same
  product may sit at different releases on different Devices, and a duplicate
  or already-installed check that is not scoped to one Device is a bug.
- A remote installation Process retains no `accessId` or `sessionId`.
  Disconnecting ends observation, never admitted Device-owned work — and
  losing DeviceAccess does not abort it either, because no cross-Device
  resource is in use after admission.
- Remote installation is still not remote execution: installation completing on
  a foreign Device creates its managed executable there and nothing more. RUN
  remains a distinct, later admission step, and it is admitted from the
  artifact, never from installed metadata.
- Execution is Device-targeted, not permanently local. `executorDeviceId` is the
  Device the program runs on; never infer it from a path, an address, a
  Session, or the current interface.
- Ordinary package installation preserves package product/release identity and
  creates or updates InstalledSoftware without a product whitelist. Being
  installable does not itself make software removable, executable, runnable,
  command-providing, or capability-providing.
- `FileTransfer` is not a `GameProcess`. It consumes no CPU or RAM, creates no
  Process on completion, and must never be presented as one.
- A Device-route transfer's authority is its `accessId`, not the Session that
  admitted it. Disconnecting never cancels a running transfer. A Market
  distribution transfer's authority is the purchase entitlement instead, and
  it must never be given a fabricated DeviceAccess, Session or remote host to
  reuse Device-route code.
- A package acquired from the Market is an ordinary package. Installation,
  removal, execution and recognition treat it exactly like any other artifact,
  and no installation path may consult where an artifact came from.
- Nothing is written at the destination until the transfer completes. There is
  no partial file, no allocated destination file ID, and no navigable entry.
- Transfers survive mutable attribute changes (IP, display name, source path)
  because they are bound to stable IDs and a snapshotted destination path.
- Release information (about, capabilities, changes) is descriptive
  presentation. It is never gameplay authority and must not disclose hidden
  target or runtime truth.
- Installation and removal consequences apply exactly once, at completion, at
  the canonical advancement boundary — never at admission.
- Never overwrite an occupying artifact: destination collisions are re-checked
  at both admission and completion and resolve as a truthful failure.

## Device-scoped NODE Miner Terminal integration

A supported NODE Miner executable remains directly runnable through Files on a
Device without InstalledSoftware. Registered `node-miner` Terminal availability
is stronger and independently requires both matching InstalledSoftware and the
present supported executable on the Device being operated. NODE-OS and RACK-OS
reuse one product command integration, but their explicit local and
Session-authorized remote adapters keep filesystem, installation, Process, and
resource consequences Device-owned. This adds no release dependency,
compatibility, capability, or plugin metadata.

## deauth.ext Flipper Extension

`deauth.ext` 1.0 is one concrete Device-filesystem artifact with stable file,
extension, release, and build identity, represented size, and exact Flipper 1.0
compatibility. The V1 proof seeds the artifact at
`/home/user/extensions/deauth.ext`; Flipper itself retains its existing Market
acquisition and ordinary installation route. The extension is neither
InstalledSoftware nor a Software Module and has no standalone execution path.
DEAUTH exists only while the exact artifact and a compatible installed Flipper
coexist on the local Device.

Flipper ARSENAL derives `NETWORK → DEAUTH → deauth.ext` from those local causes.
It stores no unlock and owns neither the Technique nor its Network effect. V1
deliberately introduces no generic extension framework, integration catalog, or
broader distribution system.

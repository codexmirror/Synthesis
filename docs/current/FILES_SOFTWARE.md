# Files, Transfer, and Software — current truth

Status: Accepted
Scope: The Device-owned filesystem, the Files application, the FileTransfer
runtime (Download and Upload), software packages and recognition, Software
Installation on the local Device and on a represented remote Device, Software
Removal, executables and RUN admission, and the local software
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
three explicit filesystem file kinds: text files, software-package files, and
executable files. Each concrete copy has an `id` that is unique and stable
within its filesystem; `path` is its current location rather than identity. A
filesystem-owned monotonic counter allocates deterministic IDs using destination
state alone. Raw IDs may coincide across Devices, so cross-Device references
require both Device ID and file ID. The local Device's initial contents consist
of the text file `/home/user/welcome.txt` and the NODE Miner 1.0
software-package artifact `/home/user/downloads/node-miner-1.0.pkg`.

The Files application begins at `/home/user`, states the current path and the
local Device in its masthead, shows an explicit parent row, derives its
directory listing from that filesystem, and presents type and byte size plus
coherent text, software-package, or executable details according to the file's
explicit kind. A software-package row also carries its derived state —
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
nothing. Text byte size is derived from
its UTF-8 content. Package and executable byte sizes are explicit represented
artifact data because their actual payloads are not modeled. Storage capacity,
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
`transfer_in_progress`. A RemoteSession is required only to admit a transfer:
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
work derives the current effective transfer rate fresh via
`deriveEffectiveTransferRateBytesPerSecond` rather than storing it, and
accumulates `bytesTransferred` accordingly, clamped to `bytesTotal`. The
destination artifact is copied, and its destination-local file ID allocated,
exactly once, at the moment `bytesTransferred` reaches `bytesTotal`; there is
still no partial-file representation, so no destination artifact exists before
that point.

Ongoing validity is derived fresh from represented canonical state through
the transfer's own `accessId`: the referenced DeviceAccess must still exist
and still authorize the one represented remote endpoint while the other
endpoint is the explicit local Device. Both Devices must remain online, both
filesystems must remain available, the source file's stable ID must still be
present on its recorded source Device, and source/destination capacities must
remain valid. Losing any of these hard-aborts the transfer without creating a
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
NodeScan 1.1 artifact on the Experimental channel. `srv-02` owns its own
distinct text file, `/srv/backup-manifest.txt`, on its own independent
filesystem; downloading it copies that file, never `srv-01`'s. Both RACK-OS
Files and Terminal observe those canonical file kinds. Its `releaseId`,
`nodescan-1.1-experimental`, identifies the represented software release
independently of the artifact's filesystem path; copies at different paths
retain that same release identity.


## Packages, recognition, and Software Installation

A software-package file is an artifact on a Device-owned filesystem, not an
installation or a running Process. Downloading the experimental package alone
leaves the local Device's NodeScan at 1.0 Standard. A concrete package that
physically exists on the current local filesystem and is normally recognized
at its current path can be installed through local Files (`INSTALL`) or NODE-OS
Terminal (`install <local-absolute-file-path>`), both of which use the same
application operation over current canonical state. Ordinary installation has
no closed product whitelist: the package artifact's stable `productId`, opaque
`releaseId`, name, version, channel, and stated publisher are the authoritative
ordinary installation facts.

Normal NODE-OS package installation does, however, require the artifact's
current concrete path to end in exactly `.pkg`, case-sensitively
(`isRecognizedSoftwarePackagePath`). This is recognition, not identity: a
`software_package` transferred to `node-miner-1.0.pk`, `node-miner-1.0.pkd`,
`node-miner-1.0.123` or `node-miner-1.0.PKG` keeps its kind, `productId`,
`releaseId`, name, version, publisher and size unchanged, and FileTransfer
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
completion needs (`productId`, `releaseId`, `name`, `version`, `channel`, and
`publisher` when stated), and requires a small explicit V1 work and RAM
requirement — the same shared CPU/RAM contention Service Analysis, Credential
Access, and NODE Miner already use, with no package-size formula. Rejecting a
second concurrent installation of the same product *on that same executor* and
the same `releaseId` already installed *on that same Device* are both resolved
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
rather than remaining unresolvable. A different release of a matching product replaces
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
occupancy is checked against the target filesystem. Local and remote
inventories are fully independent: node-01 running NodeScan 1.0 Standard while
`srv-01` runs NodeScan 1.1 Experimental is normal, a local installation of the
same product running concurrently never blocks the remote one, and neither
Device's inventory or filesystem is touched by the other's installation.

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

Completion is ordinary: the target Device's `installedSoftware` gains or
replaces that exact product release, and product-specific consequences occur
on that same Device. Remote NODE Miner installation therefore creates its one
managed executable at `/usr/local/bin/node-miner` **in the target
filesystem**, leaving the local Device's filesystem and inventory untouched.
Installation is still not execution: no remote RUN, remote program launch, or
remote `NodeMinerProcess` exists, and `startNodeMiner` continues to resolve
its artifact from, and admit onto, the player's local Device alone.

RACK-OS Files is the only interface for this in V1. Once a software package is
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
step). Reinstalling the same already-installed release is a no-op that
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
NODE Miner) show no RUN action, and installed-software metadata alone can
never conjure a missing executable back into RUN eligibility. Files resolves
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
created and no economic mutation; V1 always admits onto the player's local
Device. Successful RUN gives immediate visible feedback: Files derives a RUNNING
presentation (with the current Process ID) directly from canonical
`ProcessState` rather than temporary local success state, and stops offering a
normal RUN action for as long as that Miner keeps running.

`srv-01` no longer distributes a NODE Miner executable; only its NodeScan
Experimental package remains.

The continuous Miner runtime is owned by
`docs/current/PROCESSES_ACTIVITY.md`; what it produces, routes, and records
economically is owned by `docs/current/NODE_ECONOMY.md`.


## Software Removal

REMOVE admits removal of the currently installed release of one product into
a real finite `software_removal` `GameProcess`, sharing the same Device
CPU/RAM scheduler and contention that Service Analysis, Credential
Access, Software Installation, and NODE Miner already use — a small explicit
V1 work and RAM requirement, no package-size formula. `removeInstalledSoftware`
targets whatever is currently installed for a product rather than accepting a
`releaseId`: it is not always the player's choice which concrete release
removal restores. It validates current world truth once, at admission,
snapshots only the release facts completion needs, and applies none of
removal's consequences immediately — Device-owned InstalledSoftware and the
filesystem stay untouched until the Process completes. Rejecting a second
concurrent removal of the same product and insufficient RAM are both resolved
at this same admission instant, the same way Software Installation resolves
its own admission failures.

Not all preinstalled software is the same. NodeScan 1.0 Standard
(`nodescan-1.0-standard`) is the protected baseline release bundled with the
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
(`/usr/local/bin/node-miner`) still represents the exact release removal was
admitted against, deletes that executable — an unrelated or already-replaced
artifact occupying that path is left untouched, and the downloaded package
artifact is never touched either way. The Basic Credential Toolkit is
conceptually ordinary preinstalled software, not protected NODE-OS baseline
software, but V1 has no represented acquisition/reinstallation path for it:
REMOVE rejects it as unsupported for removal in this V1 rather than silently
treating it as a system app.

An already-running `NodeMinerProcess` is a distinct, independent runtime from
NODE Miner's InstalledSoftware and executable, and REMOVE never touches it:
removing NODE Miner while its Miner keeps running leaves that Miner producing
and routing NODE exactly as before, and only explicit STOP still ends it.
Resolution happens once, at the same canonical `advanceGameState` boundary
Software Installation resolves at, guarded the same way so repeated
advancement after completion never re-applies a consequence. The currently
installed release is re-checked against what admission snapshotted, so a
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
represented releases' stable release and product identities, ordinary display
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
restoration of the protected NodeScan 1.0 Standard NODE-OS baseline. Basic
Credential Toolkit remains ordinary preinstalled software whose removal is
unsupported in V1, while NODE Miner remains ordinary removable software.

Files remains the filesystem/package surface. Software package details reuse the
same release documentation and expose installation and observed package state,
but no longer initiate installed-software removal. Unknown release IDs retain
represented package or installation metadata and simply omit unavailable
release documentation. Neither application owns software truth of its own:
both read the same Device-owned filesystem, installed software, and Process
state.


## Gotchas

- Artifact identity is not filename or path recognition. A package keeps its
  kind, `productId`, `releaseId`, name, version, publisher and size no matter
  where it is copied to; only what an operation is willing to *admit* depends
  on the path. An operation that declines an artifact must never rewrite,
  downgrade, or reclassify it.
- Package ≠ InstalledSoftware ≠ Executable ≠ Process. Four distinct things,
  created at four distinct moments.
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
- Remote installation is not remote execution. InstalledSoftware, and even a
  managed executable, existing on a foreign Device grants no RUN, command, or
  Process there.
- Ordinary package installation preserves package product/release identity and
  creates or updates InstalledSoftware without a product whitelist. Being
  installable does not itself make software removable, executable, runnable,
  command-providing, or capability-providing.
- `FileTransfer` is not a `GameProcess`. It consumes no CPU or RAM, creates no
  Process on completion, and must never be presented as one.
- A transfer's authority is its `accessId`, not the Session that admitted it.
  Disconnecting never cancels a running transfer.
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

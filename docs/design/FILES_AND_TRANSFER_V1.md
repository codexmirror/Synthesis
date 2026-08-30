# Files and Transfer V1

Status: Accepted
Scope: Design contract for Device-owned filesystem artifacts and the remote
FileTransfer runtime (Download and core Upload).
Normative owner of current implemented behavior: `docs/current/FILES_SOFTWARE.md`.


FILE
≠ INSTALLED SOFTWARE
≠ RUNNING SOFTWARE
≠ PROCESS

Filesystem belongs to Device

DOWNLOAD V1:
active RemoteSession
→ exact represented remote file
→ `/home/user/downloads/<source-basename>` on the local Device

Download copies, never moves. The remote source remains unchanged. The local
copy preserves the explicit file kind and every kind-specific field; package
`releaseId` therefore survives a change in filesystem path. Filename
extensions do not determine semantics.

UPLOAD CORE V1 reverses the same canonical runtime: an active RemoteSession
admits an exact local artifact and explicit absolute remote destination path.
The resulting FileTransfer remains bound to its `accessId`, local source file
ID, and remote destination Device; completion creates one remote copy and
leaves the local source unchanged. Local Files and the RACK-OS terminal expose
the shared Upload action with an explicit remote file destination.

Download never silently overwrites and does not expose an arbitrary destination
path. A represented destination, a destination that is already a derived
directory, or a file blocking a required destination ancestor causes a
deterministic failure without mutation.

Remote authority:
RemoteSession
→ DeviceAccess
→ target Device

That is the authority for a transfer between two represented Devices, and the
only authority this contract covers. One canonical `FileTransfer` may also be
admitted from a second represented origin — the software Market's own package
distribution, authorized by a purchase entitlement rather than by any Device
relationship — which shares this runtime, its single-active constraint, its
destination and no-overwrite rules, and its cancellation, while resolving no
DeviceAccess and no Session. Its semantics are owned by
`docs/current/MARKET.md`. A new origin is a concrete mechanic each time, never
a transport, source or transfer framework.

The current Session must remain resolvable when the operation executes. Its
stable access and target identities authorize and select the source; an address
does not identify or retarget the Device.

Terminal + GUI
→ same gameplay operation

File size is represented (derived for text, explicit for package and
executable artifacts), and represented transfer-capable Devices own canonical
Upload/Download network transfer capacity (`NetworkTransferCapacity`,
interpreted from the owning Device's own perspective) plus a pure
`deriveEffectiveTransferRateBytesPerSecond` helper.

DOWNLOAD is now real elapsed network-transfer runtime rather than an
immediate/atomic copy:

```text
validate
→ start canonical FileTransfer
→ advance transferred bytes over elapsed simulation time
→ create the local destination artifact exactly once, at successful completion
```

`startRemoteFileDownload` admits and starts at most one canonical
`FileTransfer` (`GameState.fileTransfer`); a second attempt while one is
active fails deterministically with `transfer_in_progress`. Starting a
transfer records stable `sourceDeviceId` + `sourceFileId`, stable
`destinationDeviceId` + `destinationPath`, and `bytesTotal` derived from the
existing filesystem-size semantics; it does not create the destination
artifact, does not allocate a destination file ID, and does not create a
Process. A narrow, pure `advanceFileTransfer` operation — coordinated
alongside Process advancement by the canonical `gameAdvancement` boundary —
derives the current effective rate fresh on every call from
`deriveEffectiveTransferRateBytesPerSecond` rather than storing it, and
advances `bytesTransferred` by `rate * elapsedSeconds`, clamped to
`bytesTotal`. The destination artifact is created, and its destination-local
file ID allocated, exactly once, at the moment accumulated work reaches
`bytesTotal`; V1 has no partial-file representation.

RemoteSession is admission authority only. Once admitted, the transfer runs
independently of that interactive Session while its stored `accessId` remains
a stable reference to a DeviceAccess that is revalidated on every advancement.
If that access disappears or no longer authorizes the recorded remote endpoint,
if either Device goes offline, or if the exact source artifact, capacities, or
destination location can no longer be safely resolved, the transfer aborts:
`FileTransferState.active`
clears and no destination artifact is created. FileTransfer is a distinct
runtime domain from `GameProcess` — it does not consume CPU compute capacity
or RAM and is never represented as a Process.

All currently represented `FilesystemFile` kinds are downloadable. Download
does not install software or change installed capabilities.

The remote-first RACK-OS Upload workflow, local Files Upload entry, RACK-OS
upload command, direction-aware Activity Monitor presentation and network
usage, and cancellation are represented. Transfer queues, bandwidth sharing
between simultaneous transfers, genuinely richer ETA, and additional transfer
presentation remain future work.

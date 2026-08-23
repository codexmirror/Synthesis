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

Download never silently overwrites and does not expose an arbitrary destination
path. A represented destination, a destination that is already a derived
directory, or a file blocking a required destination ancestor causes a
deterministic failure without mutation.

Remote authority:
RemoteSession
→ DeviceAccess
→ target Device

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

The transfer remains bound to the RemoteSession that started it and to the
local Device's and remote source's live availability. If the authorizing
Session stops being the current active Session (including on disconnect), if
the local Device leaves `ONLINE`, if the remote source `NetworkHost` goes
offline, or if the source artifact or the destination location can no longer
be safely resolved, the active transfer aborts: `FileTransferState.active`
clears and no destination artifact is created. FileTransfer is a distinct
runtime domain from `GameProcess` — it does not consume CPU compute capacity
or RAM and is never represented as a Process.

All currently represented `FilesystemFile` kinds are downloadable. Download
does not install software or change installed capabilities.

UPLOAD, transfer queues, bandwidth sharing between simultaneous transfers,
and rich progress/percentage/ETA presentation remain future work and are not
implemented.

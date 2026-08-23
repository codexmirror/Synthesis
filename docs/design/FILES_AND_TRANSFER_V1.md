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
executable artifacts), and represented transfer-capable Devices now own
canonical Upload/Download network transfer capacity (`NetworkTransferCapacity`,
interpreted from the owning Device's own perspective) plus a pure
`deriveEffectiveTransferRateBytesPerSecond` helper. Download remains
immediate/atomic in V1 only because FileTransfer runtime — duration,
progress, and a completion lifecycle built from those causes — has not yet
been introduced. Download still creates no Process.

All currently represented `FilesystemFile` kinds are downloadable. Download
does not install software, change installed capabilities, or create a Process.

UPLOAD remains future work and is not implemented.

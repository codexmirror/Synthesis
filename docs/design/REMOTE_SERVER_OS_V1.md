# REMOTE SERVER OS V1

Status: Accepted
Scope: Presentation and interaction contract for RACK-OS, the first operable
foreign server Firmware.
Normative owner of current implemented behavior: `docs/current/NETWORK_ACCESS.md`
(session and RACK-OS surface) and `docs/current/FILES_SOFTWARE.md` (remote
filesystem and transfers).

## Status

Approved design contract for the first operable foreign server Firmware.

This document is the authoritative product and presentation contract for the
first foreign operating surface introduced by Work Order 05.

Canonical simulation state and `docs/ARCHITECTURE.md` remain authoritative over
this document.

This contract defines presentation and interaction structure.

It does not redefine Device, Firmware, DeviceAccess, RemoteSession, filesystem,
Discovery, Knowledge, or other canonical ownership.


## Product identity

The first foreign server Firmware is:

RACK-OS
Version 1.0

Canonical Firmware identity should use the existing `FirmwareState` shape.

Conceptually:

id: firmware-rack-os-v1
name: RACK-OS
version: 1.0

RACK-OS is a fictional server-oriented Firmware environment.

It is deliberately different from NODE-OS.

NODE-OS is the polished personal operating environment of the player’s local
Device.

RACK-OS is a compact operating console exposed by a foreign server while an
active RemoteSession exists.


### V1 terminology note

RACK-OS is represented through the current canonical `FirmwareState` because
that is the implemented operating-environment model for this slice.

This does not establish the permanent architectural rule that every future
Operating System and low-level Firmware must be the same domain concept.

Do not introduce a second OS domain model in Work Order 05 merely to anticipate
that future distinction.

V1 should use the existing represented concept until a concrete later mechanic
requires the distinction.


## Product intent

The player should immediately understand:

I AM OPERATING ANOTHER MACHINE

without needing explanatory tutorial text.

RACK-OS should feel:

- server-oriented
- utilitarian
- dense
- restrained
- technical
- direct
- less personalized than NODE-OS
- believable as an administrative operating surface

It should not feel:

- hostile for the sake of difficulty
- deliberately archaic
- like a cyberpunk prop
- like NODE-OS with another color
- like another smartphone launcher
- like a game reward screen
- like a fake Linux desktop
- like a generic dashboard


## Structural distinction from NODE-OS

RACK-OS must not reuse the NODE-OS Home or application launcher structure.

NODE-OS:

HOME
→ application control surface
→ Terminal / Scan / Processes / Files / Wallet / Notes / System

RACK-OS:

ACTIVE REMOTE CONTEXT
→ Terminal
→ Files
→ System

There is no RACK-OS Home V1.

There is no two-column launcher.

There is no Wallet.

There are no Notes.

There is no Scan application.

There is no Processes application.

There are no Home widgets.

There is no copied NODE-OS CPU / RAM / NET bottom strip.

RACK-OS should open directly into an operative server surface.


## Entry into RACK-OS

RACK-OS exists as an active presentation only while a valid canonical
RemoteSession is active for the first operable foreign server.

Conceptually:

DeviceAccess
    ↓
CONNECT
    ↓
RemoteSession
    ↓
RACK-OS

Successful CONNECT should make the remote operating context visible directly.

Do not require an additional:

OPEN SERVER
OPEN REMOTE OS
ENTER SESSION

step after CONNECT.

This presentation transition must not replace or mutate:

player.localDevice

NODE-OS remains the Firmware of the player’s personal Device.

RACK-OS consumes the active RemoteSession.


## Remote target identity

The RACK-OS operating target must resolve through:

RemoteSession.accessId
    ↓
DeviceAccess
    ↓
targetDeviceId
    ↓
canonical foreign server

Do not use `RemoteSession.connectedAddress` as Device identity.

The connected address remains connection / presentation information.

Stable target identity remains authoritative.


## Live remote state

RACK-OS is an authorized live operating view of the canonical target Device
while its referenced RemoteSession remains active.

It is not a projection of Discovery snapshots.

This creates an intentional epistemic distinction:

SCAN
→ remembered observation
→ may be stale

RACK-OS
→ authorized live operating view
→ current represented target state exposed through the active Session

Where RACK-OS presents Device identity, Firmware, current address, filesystem,
services, or other represented remote state, those values must derive from the
current canonical target state legitimately exposed by this operating context.

Do not use remembered Scan / Discovery snapshots merely because they are
convenient to access from the interface.

This does not grant omniscience.

An active Session permits only the state that the concrete RACK-OS surface
legitimately represents.

Do not infer or reveal unrelated hidden World Truth.


## First server presentation identity

The first concrete operable server uses the presentation name:

srv-01

This name must be represented as mutable canonical presentation state of the
foreign Device / host.

It must not exist only as hardcoded RACK-OS UI copy.

Stable internal identity remains authoritative and separate from this name.

The primary remote header may conceptually communicate:

RACK-OS 1.0
srv-01
198.51.100.47
USER

All mutable values must derive from canonical represented state rather than
hardcoded UI strings.

The first current server already has a represented canonical server role.

RACK-OS SYSTEM may therefore present:

ROLE
SERVER

A Device role or kind may be shown only when the current canonical target state
actually represents it.

Do not introduce decorative role strings solely for presentation.

The same rule applies to future Device labels and classifications.


## Overall layout

RACK-OS uses one compact full operating surface.

Conceptually:

┌──────────────────────────────────────────┐
│ RACK-OS 1.0                    REMOTE    │
│ srv-01 · 198.51.100.47         USER     │
│                               DISCONNECT │
├──────────────────────────────────────────┤
│ TERMINAL     FILES     SYSTEM            │
├──────────────────────────────────────────┤
│                                          │
│ active surface                           │
│                                          │
└──────────────────────────────────────────┘

Exact responsive geometry may differ.

Important characteristics:

- one operating context
- no Home screen
- no launcher grid
- compact fixed context header
- three shallow operating sections
- obvious but restrained DISCONNECT
- active section occupies the main body
- no decorative dashboard areas
- no invented technical telemetry


## Remote context header

The header exists to make local vs remote context unmistakable.

It may present only represented information:

- Firmware name
- Firmware version
- server display name
- current represented server address
- active Session authority derived from DeviceAccess
- explicit REMOTE context
- DISCONNECT

It must not invent:

- CPU usage
- RAM usage
- storage usage
- temperature
- uptime
- kernel version
- package count
- security state
- traffic throughput
- user account identity

`USER` is current DeviceAccess privilege.

It is not evidence of a full user-account model.


## Navigation

RACK-OS V1 exposes exactly three primary surfaces:

TERMINAL
FILES
SYSTEM

Navigation should be flat.

Do not create:

HOME
→ APPS
→ TERMINAL

or nested launcher navigation.

The currently selected remote section is presentation state only.

Default section when a RemoteSession first opens:

TERMINAL


## TERMINAL

The foreign Terminal is a RACK-OS Terminal.

It is not the existing NODE-OS Terminal retargeted to another Device.

The local NODE-OS Terminal must remain local even while a RemoteSession exists.

The RACK-OS Terminal receives a narrow remote operating context derived from the
active Session and its canonical target.


### Terminal presentation

The Terminal should feel rawer and less application-like than NODE-OS.

A restrained prompt may conceptually resemble:

srv-01 [USER] >

The prompt is presentation only.

It must not create:

- current working directory state
- user-account state
- shell-history state

unless those concepts are separately represented later.


### Terminal commands

RACK-OS supports only:

help
clear
ip
ls
cat
download
upload
miner
disconnect

`download` and `upload` were added with the transfer mechanics that own them;
`miner` was added with remote NODE Miner control (below). Each exists because a
concrete mechanic needed a command, not because RACK-OS is growing a shell.

`miner` has exactly one subcommand, `miner payout <address>`. It is narrow and
concrete to the one represented program: it is not a process-control verb, not
a way to launch or signal arbitrary executables, and it must not grow generic
process arguments.

Do not include `status` in V1.

SYSTEM already provides represented machine information, and the current foreign
server does not own enough runtime state to justify a meaningful general
`status` command.

Do not include:

scan
inspect
analyze
attack
connect
arbitrary process control
arbitrary software execution
cd
pwd
write/edit commands

merely because NODE-OS has or may later have equivalent commands.


### Remote `ip`

`ip` reports the current represented address of the canonical remote target.

It must not report the local NODE-OS Device address.

It must not use `RemoteSession.connectedAddress` as target identity.


### Remote filesystem commands

`ls` and `cat` use the same existing neutral filesystem domain operations used
for Device-owned filesystem state.

V1 retains absolute-path semantics.

Do not add CWD state merely for server flavor.


### Remote `disconnect`

`disconnect` invokes the same canonical Session-disconnect operation used by the
graphical interface.

It must not implement Terminal-owned Session state.


## Terminal and gameplay capability

The Terminal component does not own gameplay capability.

RACK-OS may define its own command surface as part of its Firmware interaction
model.

That determines which interface verbs are offered in the RACK-OS Terminal.

However, a Terminal command must delegate to the canonical domain or
application operation that owns the underlying behavior.

A command must not create parallel semantics for:

- Device state
- filesystem state
- DeviceAccess
- RemoteSession
- authority
- Processes
- Discovery
- Knowledge
- other gameplay state

Conceptually:

RACK-OS INTERFACE
      ↓
COMMAND
      ↓
CANONICAL OPERATION
      ↓
CANONICAL STATE

The existence of a command in RACK-OS does not itself create a new gameplay
capability model.


## FILES

RACK-OS Files presents the canonical filesystem owned by the foreign server.

It must read the same `FilesystemState` as the RACK-OS Terminal.

Conceptually:

foreign server filesystem
        │
        ├── RACK-OS Files
        └── RACK-OS Terminal

Do not create:

- React-owned filesystem truth
- remote-only file models
- copied file arrays
- Session-owned files
- DeviceAccess-owned files


## Files presentation

RACK-OS Files should use a compact server-oriented browser rather than copying
the NODE-OS Files application.

Suggested structure:

FILES
/

directory / file rows
─────────────────────

selected file
path
content

Exact implementation may adapt for mobile.

Presentation state such as selected path or selected file may remain UI-local.

Filesystem truth may not.


## Software package installation

RACK-OS Files may install a software package that already exists on the
operated Device's own filesystem, onto that Device.

This is the one place where RACK-OS admits work rather than only reading state,
and it stays inside the same boundary as everything else here: the interface
never owns the operation, never supplies the target, and never keeps lifecycle
state of its own.

Once a package is selected, the pane's subject is the Device being operated,
not node-01:

SOFTWARE PACKAGE
NODE Miner
1.0 Unofficial

STATUS
INSTALLABLE

CURRENT
NOT INSTALLED

[ INSTALL ]

SIZE
3.4 MB

PUBLISHER
nm-dev

RELEASE
node-miner-1.0

TRANSFER
[ DOWNLOAD ]

Identity, this Device's state and the one action come first, then the
artifact's own descriptive facts, then its relationship to node-01. Download
behavior is unchanged; it simply stops being the pane's headline.

INSTALL opens a compact confirmation in the same pane. There is no second
screen, no modal, and no wizard:

INSTALL ON THIS DEVICE

TARGET
srv-01

PACKAGE
/opt/packages/node-miner-1.0.pkg

CURRENT
NOT INSTALLED

[ CANCEL ]  [ INSTALL ]

The confirmation drops the descriptive facts while it is open so both controls
stay reachable on the narrowest represented viewport. Opening it changes no
GameState. CANCEL changes no GameState. Confirming forwards the exact selected
remote package path to the canonical installation operation, which stays the
sole admission authority; a canonical admission failure is reported compactly
and truthfully in the pane rather than as fabricated installation state.

Every state is derived from canonical truth — whether the target Device
represents installable software state at all, its own installed software, its
own running installation Processes, and the concrete selected Package:

INSTALLABLE
INSTALLING
INSTALLED
UNRECOGNIZED
NOT INSTALLABLE

UNRECOGNIZED is about the artifact: normal installation does not recognize its
current path.

NOT INSTALLABLE is about the Device: it does not currently represent the
software state installation requires, so nothing can be installed on it.

These two are distinct conditions and must read as such.

NOT INSTALLABLE is also not an empty inventory. A Device representing an
inventory that currently holds nothing can install software normally; a Device
representing no inventory at all cannot. Presentation must never stand one in
for the other, and must not invent an inventory, a permission, or any other
explanation for the Device's condition.

Another installed release of the same product is stated as CURRENT while the
selected package stays INSTALLABLE as a replacement. A Device in the
NOT INSTALLABLE condition states no CURRENT release, because it has no
inventory to report one from.

While the work runs, RACK-OS presents INSTALLING and nothing more.

Remote Software Installation V1 does not present:

- percentage progress
- CPU
- RAM
- work units
- estimated time
- remote cancellation / Process observation

This is a scope and presentation boundary for this slice, not a permanent
epistemic rule. Nothing here settles whether a future, explicitly represented
authorized RACK-OS runtime observation may expose remote runtime state — that
would be its own concrete mechanic, with its own decision about what an
authorized Session legitimately reveals. What this slice settles is only that
the mechanic it introduces does not open that surface, and that presentation
never invents values the simulation does not represent (see **No fake server
telemetry** and **Explicit non-goals**).

Installation is not execution. A successful installation leaves InstalledSoftware
and a managed executable artifact on the target Device; running that executable
is a separate, later admission, contracted below.


## Remote NODE Miner execution

RACK-OS Files may also RUN one supported concrete executable — the NODE Miner
release the simulation represents — on the operated Device, and may stop a Miner
already running there.

This is the same boundary software package installation established, applied to
a continuous Process: the interface never owns the operation, never supplies the
executor, and never keeps lifecycle state of its own. It is deliberately not a
general remote-execution surface. Only a supported executable is operational;
any other executable states UNSUPPORTED and offers no action.

The selected executable's subject is the Device being operated:

EXECUTABLE
NODE Miner
1.0

[ RUN ]

PROGRAM
node-miner

SIZE
2.1 MB

RELEASE
node-miner-1.0

TRANSFER
[ DOWNLOAD ]

RUN opens a compact inline confirmation in the same pane, in the same shape
INSTALL uses — it names the executor Device and the exact remote program path,
and carries the one input execution actually requires:

RUN ON THIS DEVICE

EXECUTOR
srv-01

PROGRAM
/usr/local/bin/node-miner

PAYOUT ADDRESS
[ ................ ]

[ CANCEL ]  [ RUN ]

The address field may be prefilled from the represented local NODE Wallet as a
convenience, but exactly the visible string is submitted. Opening the
confirmation and cancelling both change no GameState.

A Miner running on this Device replaces the action with its own concrete state
and the one lifecycle control appropriate here:

STATUS
RUNNING ON srv-01

PROCESS
process-0004

PAYOUT
node-wallet-addr-0001

PRODUCED
0.001407 NODE

[ STOP ]

Every value there is derived from that Device's own canonical Process. The pane
must never present the local Device's Miner as this Device's, and must never
keep a running/stopped flag of its own.

This is deliberately the concrete NODE Miner state that surface legitimately
needs, not a remote Processes application and not remote runtime telemetry: no
CPU, RAM, percentage, estimate, or foreign Process list appears, exactly as the
installation boundary above establishes.

Live payout retargeting is **not** offered here. It exists only as the Terminal
`miner payout <address>` command, so the Terminal keeps a real control advantage
without the graphical surface being made artificially poor. That command must
delegate to the same canonical operation like every other RACK-OS command, and
must never be reachable by a graphical surface building a command string.

## Initial foreign filesystem

V1 filesystem content must remain intentionally neutral.

Initial canonical content:

/srv/readme.txt

Content:

Service workspace.

This file exists only to prove:

- the remote server owns its own filesystem
- the remote filesystem differs from node-01
- RACK-OS Files can read it
- RACK-OS Terminal can read it

Do not add progression clues in Work Order 05.

Do not add:

- passwords
- credentials
- SSH keys
- hidden IP addresses
- exploit hints
- logs
- traces
- malware
- auth history
- configuration secrets
- progression targets

A later gameplay slice may add meaningful informational artifacts once the
remote operating context itself is proven.


## Filesystem observation

Reading the foreign filesystem through RACK-OS observes current canonical
filesystem state belonging to the remote target.

In Work Order 05, reading a file does not automatically mutate:

- Discovery
- Knowledge
- DeviceAccess
- capabilities
- reachability
- other canonical intelligence state

`ls` and `cat` are read operations over the represented foreign filesystem.

They are not automatic intelligence-extraction operations.

Future concrete mechanics may establish persistent information from file
contents where appropriate.

For example, a later represented rule might allow a configuration file,
credential artifact, network reference, or other meaningful content to produce
new persistent player information.

Do not implement that behavior in Work Order 05.


## V1 authority boundary

`USER` represents the privilege of the canonical DeviceAccess referenced by the
active RemoteSession.

It does not imply that RACK-OS V1 represents:

- POSIX users
- file ownership
- groups
- ACLs
- per-file permissions
- `/root` access rules
- sudo
- privilege-dependent filesystem visibility

RACK-OS V1 must not fabricate filesystem restrictions solely from the `USER`
label.

Filesystem authorization may become concrete gameplay only when the simulation
represents the required permission state and operations canonically.


## SYSTEM

SYSTEM is a compact read-only machine-information surface.

It is not a dashboard.

It may display only canonical represented values.

Conceptually:

SYSTEM

DEVICE
srv-01

ADDRESS
198.51.100.47

FIRMWARE
RACK-OS 1.0

ROLE
SERVER

SESSION AUTHORITY
USER

ACCESS PATH
SSH

Values must derive from canonical state.

`ACCESS PATH` resolves through `DeviceAccess.viaServiceId` and the represented
Service.

Do not duplicate authority or service provenance into Firmware state.

ROLE may be displayed only because the current canonical target represents a
concrete server role.

Do not invent a Device role merely to fill this surface.


## No fake server telemetry

RACK-OS must not invent realism by displaying values that do not exist.

Do not display:

CPU
RAM
LOAD
UPTIME
STORAGE
TEMPERATURE
KERNEL
PACKAGES
PROCESSES
USERS
SECURITY SCORE

unless a future concrete mechanic introduces those values as canonical state.

Believable absence is preferable to fake technical detail.


## Session authority presentation

Any authority displayed by RACK-OS must derive through:

RemoteSession
    ↓
DeviceAccess
    ↓
privilege

Do not duplicate privilege into:

- Firmware
- remote Device presentation state
- RACK-OS UI state
- Terminal state

For V1, the current represented authority is:

USER

This is DeviceAccess authority.

It is not a modeled operating-system user account.


## Session validity

RACK-OS may remain presented only while its referenced canonical RemoteSession
remains active and resolves to the foreign target under which the operating
surface was opened.

The UI must not maintain private Session-validity truth.

If the canonical RemoteSession ceases to be active for any reason, RACK-OS must
close rather than continuing as a stale or zombie operating context.

Work Order 05 does not introduce additional Session-loss mechanics.

Do not add:

- timeouts
- heartbeat
- network-loss cleanup
- revocation
- reboot handling
- automatic Session termination

This rule defines presentation ownership only.

Future mechanics may create additional reasons for a Session to cease being
active.


## DISCONNECT

DISCONNECT must remain persistently understandable from the foreign operating
surface.

It should be available from the shared RACK-OS context header.

The Terminal may additionally expose the canonical `disconnect` command.

Both invoke the same shared Session operation.

Do not create:

- RACK-OS-owned connection state
- Terminal-owned connection state
- separate graphical and command disconnect mechanics


## Disconnect result

After DISCONNECT:

RemoteSession.active
→ null

RACK-OS active presentation
→ closes

NODE-OS presentation
→ becomes visible again

Preserve:

- player.localDevice
- local NODE-OS Firmware
- local filesystem
- DeviceAccess
- remote Firmware
- remote filesystem
- Discovery
- Knowledge
- unrelated Process state

Another Attack must not be required merely to reconnect while DeviceAccess still
exists and the normal CONNECT conditions remain satisfied.


## Preserve local presentation context

Entering RACK-OS should not unnecessarily destroy NODE-OS navigation
presentation state.

Where practical, the local NODE-OS application context that existed immediately
before the remote surface opened should remain presentation-local and become
visible again after DISCONNECT.

Example:

NODE-OS Scan / target Device
    ↓ CONNECT
RACK-OS
    ↓ DISCONNECT
NODE-OS Scan / target Device

Do not persist this as canonical gameplay state.

Do not introduce a global:

currentDeviceId

or:

activeDeviceId

to achieve this behavior.

The local NODE-OS workspace remains the player’s personal operating environment
while the foreign Session temporarily occupies the active presentation.


## Local presentation restoration acceptance

Test the concrete current graphical flow:

NODE-OS
→ Scan
→ Device Detail for the foreign server
→ CONNECT
→ RACK-OS
→ DISCONNECT
→ NODE-OS
→ same Scan Device Detail

When CONNECT originates from the current Scan Device page, DISCONNECT should
restore that same local presentation context where practical.

It must not unnecessarily return the player to:

- NODE-OS Home
- Scan root
- Known Space root
- another application

This preserved local navigation is presentation state only.

Do not move it into GameState.

Do not introduce `currentDeviceId`, `activeDeviceId`, remote navigation state,
or another canonical operating-context pointer to achieve this.


## Mobile behavior

iPhone / Safari remains a first-class target.

RACK-OS may occupy the full available application surface while the Session is
active.

It must use the accepted Shell-owned viewport / Editing architecture.

Do not create a second mobile viewport controller.

Do not reintroduce:

- Terminal-owned VisualViewport logic
- `window.scrollTo` keyboard hacks
- `scrollIntoView` keyboard fixes
- fake keyboard heights
- polling
- body transforms
- disabled zoom
- global whole-page scrolling

The remote Terminal input must coexist with the accepted Editing behavior.

The RACK-OS surface may use its own visual chrome while remaining hosted by the
existing Shell-owned responsive / Editing infrastructure.

Do not copy NODE-OS chrome merely to obtain mobile behavior.


## Visual language

RACK-OS should remain visually related to the wider Synthesis product without
looking like NODE-OS.

Use:

- matte dark surfaces
- restrained neutral typography
- thin separators
- compact monospace information
- slightly colder / more neutral emphasis than NODE-OS
- dense single-column server-console structure
- minimal animation
- almost no decoration

Avoid:

- neon
- glow
- holograms
- Matrix effects
- cyberpunk ornaments
- giant icons
- rounded mobile-app cards
- decorative system telemetry
- copied NODE-OS launcher controls
- copied NODE-OS status chrome

Structural difference matters more than color difference.


## Canonical ownership

RACK-OS is presentation and interaction.

It must not own competing simulation truth.

Preserve:

Device
≠ Firmware

Device
≠ Session

DeviceAccess
≠ RemoteSession

Firmware
≠ filesystem

Firmware
≠ authority

Files UI
≠ filesystem truth

RACK-OS
≠ player.localDevice

The Terminal component does not own gameplay capability.

RACK-OS may expose interface-specific commands, but the underlying gameplay
meaning remains owned by canonical domain and application operations.


## Epistemic boundary

The following concerns must remain distinct:

WORLD TRUTH
→ what currently exists in the simulation

DISCOVERY / SCAN
→ remembered player observations
→ may be stale

KNOWLEDGE
→ persistent deeper information learned by the player

RACK-OS
→ authorized live operating view of represented target state while the
  RemoteSession is active

RACK-OS must not silently rewrite Discovery or Knowledge simply because it can
currently observe remote state.

Likewise, Discovery snapshots must not become the source of truth for RACK-OS.

Persistent information transitions should be introduced only through concrete
gameplay mechanics.


## Scope boundary

RACK-OS V1 proves only:

ACTIVE REMOTE SESSION
        ↓
DISTINCT FOREIGN OPERATING CONTEXT
        ↓
READ REMOTE DEVICE STATE
        ↓
READ REMOTE FILESYSTEM
        ↓
INSTALL A PACKAGE ALREADY ON THAT DEVICE, ONTO THAT DEVICE
        ↓
DISCONNECT

Installation is admitted through the active Session but owned by the target
Device: DISCONNECT ends the operating context and the player's observation of
it, never the work itself.

Remote NODE Miner execution extends that same chain by one step — RUN one
supported executable already on that Device, observe and stop that one Miner,
and retarget its payout from the Terminal — under the same ownership rules.

It does not yet prove:

- general remote software execution or arbitrary program launch
- remote Process observation, progress, or cancellation surfaces
- remote software management (uninstall, restore, inventory)
- remote reconnaissance position
- Firewall
- Reachability
- pivoting
- internal networks
- privilege escalation
- filesystem writes
- filesystem permissions
- POSIX users
- logs / artifacts
- malware
- software progression
- multiple Sessions
- persistent intelligence extraction from files


## Explicit non-goals

Do not implement as part of this design:

- RACK-OS Home
- application launcher
- Wallet
- Notes
- Scan
- Processes
- NODE-OS launcher reuse
- NODE-OS status-bar reuse
- NODE-OS CPU / RAM / NET strip
- fake technical telemetry
- generic Device abstraction
- generic Firmware renderer
- generic operating-system framework
- generic Session framework
- global current Device state
- multiple Sessions
- Session tabs
- Session manager
- remote Process observation, progress or cancellation surfaces
- remote CPU / RAM telemetry
- general remote software execution, arbitrary program launch, or a remote shell
- a generic remote-execution or process-permission framework
- Firewall
- Reachability
- routes
- tunnels
- pivoting
- remote Scan capability
- new Analyze / Attack mechanics
- privilege escalation
- user-account model
- filesystem ownership model
- ACLs
- filesystem writes
- text editor
- logs
- shell-history artifacts
- malware
- credentials
- progression clues
- automatic Knowledge extraction
- automatic Discovery extraction
- Session timeout / heartbeat / lifecycle simulation


## Acceptance intent

The design succeeds when a player can:

1. establish DeviceAccess
2. CONNECT
3. immediately recognize that they are now operating a different machine
4. use the RACK-OS Terminal
5. run remote `ip` and observe the foreign Device context
6. use remote `ls` / `cat`
7. inspect the same foreign filesystem through RACK-OS Files
8. inspect represented server information through SYSTEM
9. DISCONNECT
10. return to the intact NODE-OS local context

The concrete current graphical flow should support:

NODE-OS
→ Scan
→ foreign Device Detail
→ CONNECT
→ RACK-OS
→ DISCONNECT
→ same NODE-OS Scan Device Detail

The player should experience:

ACCESS
≠
ACTIVE SESSION
≠
LOCAL DEVICE

and:

SCAN
≠
LIVE REMOTE OPERATING VIEW

without requiring tutorial text.


## V1 design summary

NODE-OS is the player’s persistent personal workstation.

RACK-OS is the first foreign operating context.

NODE-OS remembers where the player was working.

RACK-OS exists only because a canonical RemoteSession is active.

Scan presents remembered observation.

RACK-OS presents authorized current remote state.

DeviceAccess provides authority.

RemoteSession provides active operating context.

The remote Device owns its Firmware and filesystem truth.

RACK-OS presents that truth without becoming its owner.

The first RACK-OS should remain deliberately small:

RACK-OS
├── TERMINAL
├── FILES
└── SYSTEM

FILES is where the operated Device is acted on as a machine rather than only
read: a package already present there can be installed there. SYSTEM stays a
compact read-only machine sheet, and TERMINAL gains no package commands.

That is enough for V1.
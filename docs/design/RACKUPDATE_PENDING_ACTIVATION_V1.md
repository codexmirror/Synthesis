# RACKUPDATE PENDING ACTIVATION V1

Status: Accepted
Scope: Feature-specific design authority for the first `srv-02` GateSSH
submission-to-activation precedent. It defines what successful RackUpdate
submission completion changes and the later Device boot boundary that activates
that change. The pending-submission slice is implemented; boot activation is
not current implemented truth. This contract does not design a general updater
or Device lifecycle.
Normative owners of current implemented behavior:
`docs/current/NETWORK_ACCESS.md`, `docs/current/FILES_SOFTWARE.md`, and
`docs/current/DEVICE_SYSTEM.md`.


## Purpose and authority

This contract narrows the already Accepted hacking and causality direction in
`HACKING_AND_OBSERVATION_V1.md` and architecture invariants A11/A12 to one
concrete software consequence. It does not restate or redesign that broader
direction.

The selected causal chain is:

```text
RACKUPDATE PACKAGE SUBMISSION
        ↓
TARGET DEVICE ACCEPTS ONE PENDING GATESSH ACTIVATION
        ↓
LATER REPRESENTED DEVICE BOOT
        ↓
PENDING RELEASE BECOMES ACTIVE
```

The submission-completion slice is now Current Truth in the normative owners:
pending activation exists, while a represented reboot lifecycle and boot
activation do not.


## Submission completion

RackUpdate package submission remains a Service interaction. Admission and
completion remain authorized by the existing narrow
`RackUpdateSubmissionAccess` capability scoped to that RackUpdate Service.
This contract creates no new Access semantics.

Completing a valid submission does **not** replace the running GateSSH release.
For the first concrete `srv-02` rollback:

| Moment | Active InstalledSoftware | Active SSH Service implementation | Pending activation |
| — | — | — | — |
| Before submission | GateSSH 1.3.3 | GateSSH 1.3.3 | none |
| After successful submission | GateSSH 1.3.3 | GateSSH 1.3.3 | exact submitted GateSSH 1.3.2 release/build |

The successful completion result may therefore truthfully state:

```text
PACKAGE ACCEPTED
REBOOT REQUIRED
```

Cancellation, interruption, or failure continues to apply none of the package.
The immediately following implementation slice changes successful submission
completion only: it persists the pending activation while leaving both active
truths unchanged.


## Ownership and identity

Pending activation is canonical software state owned by the target Device.
RackUpdate causes the Device to accept that state; RackUpdate does not remain
its canonical owner merely because its Service was the submission surface.

Pending activation is not:

- Player Knowledge or Discovery;
- `RackUpdateSubmissionAccess`;
- a `GameProcess`;
- a `RemoteSession`;
- the active Service implementation;
- active `InstalledSoftware`; or
- a software-package artifact copied onto the target filesystem.

The pending state preserves the submitted software provenance needed to apply
the same concrete software later, including its exact product, release, and
build identity and the release metadata required to form the corresponding
installation and Service implementation. Activation must use those preserved
facts. It must not infer ordering or behavior from a display version, and it
must not normalize the pending release to a canonical default.

V1 represents at most one pending GateSSH activation per target Device. A
second submission must not silently replace one already pending; the concrete
implementation may reject it with the smallest explicit result needed for this
mechanic. This is not a queue and does not justify a generic updater framework.


## Observation boundary

Successful submission completion does not refresh remembered NodeScan or
Inspect evidence to the pending release. The active Service implementation has
not changed, so the submission has not established an observation that it has.

```text
WORLD TRUTH
pending GateSSH = 1.3.2

DOES NOT IMPLY

PLAYER OBSERVATION
active GateSSH = 1.3.2
```

Existing remembered evidence may remain historically useful or stale according
to the existing observation model. This contract adds no acute-status
presentation and gives NodeScan no access to hidden pending state.


## Boot activation boundary

A real represented boot or reboot of the target Device is the activation
boundary:

```text
PENDING GATESSH 1.3.2
        +
REAL DEVICE BOOT
        ↓
active InstalledSoftware GateSSH becomes 1.3.2
active SSH Service implementation becomes 1.3.2
pending activation clears
```

Those three changes are one coherent Device/software state transition. No
intermediate state may expose mismatched active InstalledSoftware and managed
Service releases, or clear the pending identity without applying it.

This semantic boundary does not select reboot timing, lifecycle phases,
power-management state, or a generic boot-hook mechanism. Those concerns
remain unimplemented and outside this contract.


## Separation from a future reboot trigger

The future cause of a reboot is deliberately separate from activation at the
ordinary boot boundary. In particular, a future connectivity effect such as
DEAUTH must never directly apply GateSSH, clear pending software, or invoke a
special `srv-02` progression consequence. Its responsibility is only its
concrete network or connectivity mutation.

If represented RACK-OS behavior later reacts to that mutation by rebooting the
Device, the ordinary boot boundary then activates the pending software:

```text
OFFENSIVE EFFECT
        ↓
connectivity state changes
        ↓
Device / Firmware behavior reacts
        ↓
represented reboot occurs
        ↓
boot activation applies pending software
```

DEAUTH, network disruption, reconnect behavior, reboot lifecycle timing,
Device-local power management, generic boot hooks, NodeScan acute-status
presentation, new offensive modules, and new Access semantics all remain
deferred.

DEAUTH's own narrow effect definition and the intended `srv-02` composition
precedent — RackUpdate pending state, DEAUTH connectivity disruption, Device
reaction, and this boundary's activation — are frozen as design authority in
`docs/design/DEAUTH_NETWORK_DISRUPTION_V1.md`. That contract does not change
anything stated above; it only completes the DEAUTH side of the separation
this section already requires.


## Deterministic next implementation slice

The next slice is limited to RackUpdate submission completion:

1. stop immediate GateSSH activation;
2. persist one exact pending GateSSH activation on the target Device;
3. keep active GateSSH InstalledSoftware and the active SSH Service at 1.3.3;
4. stop refreshing observation as though 1.3.2 were active; and
5. expose `REBOOT REQUIRED` where the existing completion surface reports the
   accepted package.

No reboot mechanic is required by that slice.

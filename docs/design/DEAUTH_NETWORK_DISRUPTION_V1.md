# DEAUTH / NETWORK DISRUPTION V1

Status: Accepted
Scope: Design authority for the first planned offensive network-disruption
effect ("DEAUTH") and the srv-02 multi-step composition it is intended to
prove. Defines DEAUTH's own effect narrowly, and how it relates to the
already Accepted `RACKUPDATE_PENDING_ACTIVATION_V1.md` boot-activation
boundary. DEAUTH itself — the player-facing offensive Technique, its concrete
provider, acquisition/progression, requirements, cost, UI wiring, and success
model — remains unimplemented direction only. The neutral Network
connectivity-interruption primitive, the Device lifecycle/connectivity
model, and the concrete Petra's Phone / srv-02 recovery precedent this
contract names are now implemented and are Current Truth in
`docs/current/DEVICE_SYSTEM.md`; boot activation is likewise implemented.
This contract does not design a firewall/reachability system or
NetworkManagement acquisition.
Normative owners of current implemented behavior: `docs/current/NETWORK_ACCESS.md`
and `docs/current/DEVICE_SYSTEM.md`; neither implements DEAUTH itself.


## Purpose and authority

This contract narrows the Accepted hacking direction in
`HACKING_AND_OBSERVATION_V1.md` — specifically its capability-collection and
composition principles (sections 14-16) — to one concrete offensive effect:
represented network connectivity disruption. It also completes the
separation already stated in `RACKUPDATE_PENDING_ACTIVATION_V1.md`'s
"Separation from a future reboot trigger" section by giving that future
connectivity effect an explicit, narrow definition, rather than duplicating
that section's existing normative language.

It does not redesign RackUpdate submission or boot activation. Those remain
owned by `RACKUPDATE_PENDING_ACTIVATION_V1.md`, unchanged.


## What DEAUTH is responsible for

DEAUTH / network disruption is a concrete offensive effect with exactly one
represented consequence:

```text
DEAUTH / NETWORK DISRUPTION
        ↓
represented connectivity of affected Devices is interrupted
```

That is the entire semantic content this contract assigns to DEAUTH. It is
narrow by design, in keeping with `HACKING_AND_OBSERVATION_V1.md` section 5:
an offensive effect is a concrete state transition, not a magic downstream
consequence.

DEAUTH does **not** semantically mean, and must not be implemented to mean:

- reboot all Devices;
- apply pending GateSSH, or any other pending software state;
- grant `DeviceAccess`;
- grant `NetworkManagementAuthority`;
- complete the srv-02 progression step directly;
- a specific reconnect timeline, reconnect phase, or its UI copy; or
- which concrete tool or software supplies the effect.

Anything else that appears to happen after DEAUTH belongs to the systems that
react to the changed connectivity state, not to DEAUTH itself. This mirrors
the existing rule in `RACKUPDATE_PENDING_ACTIVATION_V1.md`: RackUpdate causes
the target to accept pending state, but does not itself apply it; DEAUTH
causes connectivity to change, but does not itself decide what that change
causes.


## Why a Network-scoped effect

The intended target of DEAUTH is a Network, not a single Device. That is the
deliberate source of its intended gameplay consequence: the player may act
against a Network for one reason while visibly affecting other Devices that
share it, producing the first meaningful "my action changed more of the
world than just my target" moment
(`HACKING_AND_OBSERVATION_V1.md` section 16).

This contract does not select which represented Network-scoped state DEAUTH
mutates, how many Devices observe it, or the provider, acquisition,
requirements, resource cost, elapsed work, success model, and contextual HACK
UI wiring of the attempt. Those remain concrete implementation decisions for
a later slice. The missing provider does not make DEAUTH a special "Network
module" and does not imply that Flipper must own it.


## The srv-02 precedent

The intended first proof of composition beyond Proof E chains three
independently owned causal boundaries:

```text
RackUpdate pending GateSSH        (owned by RACKUPDATE_PENDING_ACTIVATION_V1)
        +
DEAUTH connectivity disruption    (owned by this contract)
        ↓
Device / RACK-OS behavior reacts to the changed connectivity
        ↓
a represented reboot occurs       (owned by Device/Firmware behavior, not
                                    this contract)
        ↓
the ordinary boot-activation boundary applies the pending GateSSH release
                                   (owned by RACKUPDATE_PENDING_ACTIVATION_V1)
```

Concretely, for the intended `srv-02` precedent:

```text
network connectivity disruption
        ↓
Petra's Phone may reconnect according to its own represented behavior
        ↓
srv-02 reacts according to its own represented RACK-OS / Device behavior
        ↓
that behavior causes a real Device reboot
        ↓
the existing ordinary boot-activation boundary applies the pending GateSSH
release
```

Petra's Phone (`docs/V0.md`, `docs/current/VEYRA_OS.md`) already exists on
the neutral foreign `remote-segment-01`, alongside `srv-02` — not the
player's own `home-net`. It is named here only as the concrete illustration
of an independent reaction on a Device the player was not attacking. This
contract does not select or change Petra's Phone's represented reconnect
behavior; it only names the kind of independent reaction a Network-scoped
effect should be able to produce.

At no point in this chain does DEAUTH itself decide that `srv-02` reboots, or
that the pending GateSSH release becomes active. Each arrow is owned by the
system on its right: connectivity by DEAUTH, reboot-or-not by Device/RACK-OS
behavior, activation by the existing boot boundary in
`RACKUPDATE_PENDING_ACTIVATION_V1.md`. Neither RackUpdate nor DEAUTH grants
`DeviceAccess` merely because each is an offensive action; the eventual
credential or access opportunity this chain is intended to reopen belongs to
whichever concrete mechanic legitimately establishes it, exactly as Proof E
already requires.


## Same effect, different system reactions

The srv-02 precedent above is one concrete instance of a broader rule this
contract also freezes. Be precise about ownership. This contract does not
define:

```text
DEAUTH → reboot srv-02
```

It defines:

```text
DEAUTH → connectivity mutation
        +
represented srv-02 RACK-OS / Device behavior → reacts to that mutation with
                                                 reboot
```

DEAUTH owns neither outcome shown above the line. It does not own `srv-02`'s
reboot, and by the same rule it does not own Petra's Phone's reconnect
either — both belong to the Device/Firmware/Runtime behavior of the system
that reacts, not to the effect that changed their connectivity.

More generally, the same DEAUTH connectivity mutation may legitimately
produce different consequences on different Devices, because each affected
system owns its own reaction to that mutation rather than DEAUTH selecting a
per-Device outcome.

```text
DEAUTH / NETWORK DISRUPTION
        ↓
connectivity loss on every affected Device
```

is the entire effect DEAUTH owns, regardless of which Devices are affected.
What a given Device does next is that Device's own represented behavior —
for the two Devices this precedent names:

```text
VEYRA OS Device (Petra's Phone)
        connectivity loss
                ↓
        its own represented reconnect behavior
                ↓
        connectivity restored

srv-02 (represented RACK-OS Device)
        connectivity loss
                ↓
        its own represented Device / Firmware / Runtime reaction
                ↓
        a real reboot occurs
                ↓
        ordinary boot-activation boundary runs
        (RACKUPDATE_PENDING_ACTIVATION_V1)
```

This rule is expected to outlive the selected precedent. A future VEYRA OS
release, a different Device model, or a different represented configuration
may legitimately react to the same connectivity loss differently — by
reconnecting on a different schedule, by not reconnecting automatically, or
through some other represented behavior — without this contract or DEAUTH
itself changing. Likewise, a future RACK-OS Device or Firmware release is not
required to reboot on connectivity loss merely because `srv-02` does in this
precedent. This contract freezes the selected `srv-02` and Petra's Phone
precedent; it does not freeze a universal rule that every VEYRA OS Device
always reconnects, or that every RACK-OS Device always reboots, on
connectivity loss.


## Authority for the concrete precedent

The concrete reconnect behavior of Petra's Phone and the concrete reboot
reaction of `srv-02` are now implemented and are Current Truth, owned by
`docs/current/DEVICE_SYSTEM.md` (`NetworkHost.connectivityRecoveryBehavior`,
`RECONNECT` for the phone and `REBOOT_ON_DISCONNECT` for `srv-02`), closing
the authority gap this section previously named. `docs/current/VEYRA_OS.md`
still presents no reconnect *presentation* for the phone — this precedent is
represented Device/RACK-OS behavior, not a VEYRA OS product surface — and
`docs/design/REMOTE_SERVER_OS_V1.md` still excludes general "reboot
handling" from its own scope, which remains accurate: this contract's
precedent is one concrete Device's own configured reaction, not a general
RACK-OS reboot-handling model. This design document does not itself own that
implemented behavior and is not turned into its owner by this note; it
records only that the gap it once named is closed elsewhere.

Exact reconnect/reboot phase timing remains this implementation's own
concrete decision, deliberately left unselected by this contract and by
`RACKUPDATE_PENDING_ACTIVATION_V1.md` alike.


## Non-goals

This contract does not authorize:

- an exact reconnect timeline, reconnect phases, or their UI copy;
- a RACK-OS watchdog or reboot-trigger implementation;
- selecting the concrete provider that supplies DEAUTH, unless a future
  concrete mechanic requires one;
- a third Flipper module created merely to give DEAUTH somewhere to live
  (`HACKING_AND_OBSERVATION_V1.md` section 14);
- a reboot lifecycle or generic Device lifecycle framework;
- a firewall/reachability implementation;
- `NetworkManagementAuthority` acquisition through an offensive technique;
- evidence or log deletion;
- a universal Exploit, Capability, Technique, or Effect registry;
- a generic consequence/event bus that would let DEAUTH itself invoke reboot
  or activation.

These may be revisited only when a concrete implementation slice actually
requires them.


## Deferred

Everything needed to actually implement DEAUTH itself — its concrete provider
and acquisition, requirements, resource cost, elapsed work, success model,
contextual HACK UI wiring, and the exact represented cause that performs the
Network-scoped connectivity mutation — remains unimplemented and outside this
contract. The neutral connectivity-mutation
operation it would call
(`interruptLocalNetworkConnectivity`, `docs/current/DEVICE_SYSTEM.md`) and
the concrete Device/RACK-OS reaction it would trigger (Petra's Phone
reconnect, `srv-02` reboot through the real boot boundary) are already
implemented, independently of DEAUTH, so a future DEAUTH implementation
composes with existing Current Truth rather than designing it anew.

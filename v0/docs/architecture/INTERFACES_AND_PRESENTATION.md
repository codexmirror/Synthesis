# Interfaces, Capability, and Presentation

Status: Accepted
Scope: The boundary between interfaces and gameplay operations, the separation of
command from capability and product identity, presentation truth, and the
interface/mobile boundary.

Normative owner for architecture invariants A05 and A06. `docs/ARCHITECTURE.md` is the
index and precedence entry point; it summarizes these invariants and must not
redefine them.


## A05 — Interfaces do not own gameplay operations

Terminal commands and graphical controls are interfaces over gameplay
operations.

A gameplay rule should be implemented once behind a domain/application
boundary and exposed through whichever interfaces need it.

```text
TERMINAL ─────┐
              ├── GAMEPLAY OPERATION ── DOMAIN STATE
GRAPHICAL UI ─┘
```

A graphical interface must not construct or execute a Terminal command string
to perform gameplay.

Terminal must not become the game domain.

Commands should receive narrow state or operations rather than unrestricted
`GameState` when a smaller boundary is sufficient.


## A06 — Command is not capability

The existence of an interface verb does not prove that the player currently has
the software, hardware, information, access, position, resources, or other
conditions required to perform it successfully.

Likewise, a named Tool or software product must not become permanently
synonymous with one command.

Long-term, multiple concrete software products may provide overlapping
capabilities, and one product may support multiple interface verbs.

Capabilities should arise from represented conditions rather than permanent
command-unlock flags where practical.

A concrete Device instance, a Device Model, a Firmware family, and a Firmware
release are separate identities.

A Device Model may eventually describe defaults, compatibility, physical or
product constraints, and supported upgrade limits for Devices of that model.
It must not become the canonical owner of the concrete Device’s current
hardware, network capacity, runtime state, filesystem, or installed software.

Likewise, a Firmware family may have multiple releases without becoming Device
identity.

Conceptually:

```text
DEVICE MODEL
    ↓ constrains / defaults
DEVICE INSTANCE
    ├── concrete Hardware
    ├── concrete Network state
    ├── concrete Runtime
    ├── Filesystem
    └── installed Firmware release
                ↓
         FIRMWARE FAMILY
```

This separation must allow multiple Device models to use one Firmware family
and must not require every Device in Synthesis to run NODE-OS. 


## Presentation truth

Player-facing technical values should come from represented canonical state
when that state exists.

Do not invent fake:

- telemetry
- logs
- traffic
- uptime
- security state
- process state
- filesystem content
- alerts

solely to make an interface appear more technical.

Silence or unavailable information is valid presentation state.


## Interface and mobile boundaries

Mobile Safari/iPhone is a first-class presentation target.

Viewport and Editing-presentation coordination belongs to the Shell boundary,
not to gameplay or Terminal domain logic.

Raw browser viewport values are sensor observations, not Shell geometry. The
mobile editing controller follows this acceptance path:

```text
MEASURE
→ VALIDATE
→ CLASSIFY
→ ACCEPT OR HOLD
→ PUBLISH
```

Only controller-accepted geometry may be published to the Shell. Invalid,
contradictory, or otherwise transitional observations preserve the last
accepted geometry.

Editing presentation is separate from accepted editing geometry. Shell-owned
editable focus activates the Editing presentation immediately and recovery
keeps it active until coherent normal geometry is accepted and browser-tab
Shell displacement has returned to its captured visual baseline. A HOLD may
therefore preserve the last accepted numeric geometry while the Shell already
presents editing intent.

In browser tabs, the Shell may map its existing NODE or foreign-Firmware
surface into document space using the rendered displacement of the unchanged
Shell. This transient mapping keeps the focused surface in visible browser
space and may constrain its presentation height during a sensor HOLD. Rendered
Shell displacement is presentation input only: it must never become accepted
`editTop`, `editHeight`, recovery geometry, or gameplay truth.
The editing presentation controller may synchronously write its Shell-owned
transient CSS mapping on browser movement events; React retains diagnostic
state but must not compete for ownership of those presentation variables.
Accepted geometry continues through the scheduled validation pipeline.

Browser suspension invalidates the current sensor-acquisition epoch without
invalidating Shell-owned focus intent, accepted geometry, or the mounted
editing surface. On a real foreground resume, the Shell reconciles the actual
active element and begins a fresh acquisition when the same Shell editable is
still focused. A transient normal-looking resume snapshot is not focus-exit
recovery; accepted editing geometry remains latched until fresh editing
geometry is accepted or actual focus loss proceeds through normal recovery.

Individual scrollable application regions own their scrolling.

Do not move browser viewport state into `core/game`.

Do not reintroduce Terminal-owned or feature-owned global keyboard hacks merely
to solve local presentation issues.

Presentation behavior may evolve, but viewport mechanics must remain separate
from canonical simulation truth.

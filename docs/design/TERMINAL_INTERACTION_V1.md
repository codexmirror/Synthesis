# TERMINAL INTERACTION V1

Status: DESIGN / IMPLEMENTATION CONTRACT

This document defines the durable interaction contract for terminal-like
interfaces in Synthesis.

It is not a command specification.

It is not a gameplay-operation specification.

It defines how a terminal surface behaves.

Initial concrete consumers:

- NODE-OS Terminal
- RACK-OS Terminal

Future terminal-like operating environments may reuse the same interaction
contract without inheriting NODE-OS or RACK-OS command semantics.


—

## NORTH STAR

A Synthesis terminal must behave like a stable terminal surface rather than a
web form styled to look like one.

The player should be able to:

- enter commands fluidly
- keep the keyboard open while working
- scroll old output without the interface fighting them
- copy represented targets without viewport or keyboard jumps
- use command history naturally
- rotate the device without losing the usable terminal surface
- use the terminal in browser and Home-Screen presentation
- interact without accidental browser zoom, page scroll, or scroll chaining

The terminal surface must remain truthful to represented application state.

It must not create artificial delays, fake progress, or fake asynchronous work
merely for presentation.


—

# 1. ARCHITECTURE BOUNDARY

Terminal Interaction owns only interaction and presentation behavior.

It may own:

- current input value
- per-instance command history
- current history position
- preserved draft while navigating history
- input element reference
- output-scroller reference
- follow-tail state
- submit/dispatch guard
- focus-preservation behavior
- scroll ownership
- common terminal input attributes
- interaction accessibility behavior

It must NOT own:

- GameState
- GameActions
- command registries
- command parsing semantics
- NODE-OS functionality
- RACK-OS functionality
- RemoteSession
- Filesystem truth
- Process truth
- NodeScan
- installed software
- gameplay capability

Conceptually:

Terminal Interaction Foundation
        |
        +— NODE-OS Terminal adapter
        |     +— NODE-OS command semantics
        |
        +— RACK-OS Terminal adapter
              +— RACK-OS command semantics


The shared layer must not become a universal operating-system abstraction.


—

# 2. NODE-OS IS THE FIRST REFERENCE IMPLEMENTATION

The NODE-OS Terminal is the first concrete reference implementation of this
interaction contract. Its interaction controller remains NODE-local until a
second accepted implementation demonstrates the correct shared boundary.

Useful existing behavior may be retained.

Incorrect, incomplete, or overly aggressive existing behavior may be replaced.

RACK-OS must not merely copy the NODE-OS component.

Both terminals must converge on the accepted Terminal Interaction contract.


—

# 3. SHELL OWNS EDITING / VIEWPORT GEOMETRY

The Shell remains the single owner of mobile editing geometry.

The existing Shell editing system owns concerns such as:

- VisualViewport observation
- virtual-keyboard geometry
- browser presentation vs Home-Screen presentation
- orientation recovery
- editing-surface geometry
- global touch containment

Terminal components must NOT introduce a second viewport authority.

Do not add terminal-specific:

- VisualViewport resize listeners
- window-height controllers
- keyboard-height state
- browser-chrome compensation
- competing editing geometry

The relationship is:

SHELL
owns external viewport/editing geometry

TERMINAL
owns interaction inside the provided surface


—

# 4. OPENING A TERMINAL MUST NOT AUTO-OPEN THE KEYBOARD

Opening NODE-OS Terminal or RACK-OS Terminal does not automatically focus the
command input on mobile.

Opening terminal:
→ keyboard remains closed

Explicitly activating the command input:
→ editing begins
→ keyboard may open


The terminal must not unexpectedly steal focus from navigation.


—

# 5. EXACTLY ONE TERMINAL VERTICAL SCROLL OWNER

A terminal has one canonical vertical terminal-output scroller.

Expected structure:

TERMINAL SURFACE
├── OUTPUT   ← vertical scroll owner
└── INPUT    ← anchored interaction row


The following must not simultaneously become competing terminal scroll owners:

- browser page
- Shell
- app surface
- terminal container
- output container

The output element itself owns terminal history scrolling.

While the Terminal occupies an active editing surface, terminal-history vertical scrolling has exactly one owner: the output scroller.


—

# 6. EDITING SCROLL OWNERSHIP BELONGS ON THE REAL SCROLLER

`data-editing-scroll-owner` must be attached to the element that actually owns:

`overflow-y`

It must NOT be placed on an ancestor merely for convenience.

The real scroll element must support geometry equivalent to:

- min-height: 0
- overflow-y: auto
- overflow-x: hidden

This is required for Grid/Flex layouts where a nominal `overflow:auto` child
would otherwise refuse to shrink and never become scrollable.


—

# 7. NO SCROLL CHAINING

Vertical terminal-output scrolling must not escape into Shell/Page scrolling
when the output reaches its top or bottom boundary.

The contract is:

TERMINAL OUTPUT SCROLL
must not chain to
SHELL / DOCUMENT


Preferred CSS behavior is:

`overscroll-behavior-y: contain`

Use `none` only if tested platform behavior requires stronger containment.

The contract defines behavior, not one mandatory CSS value.


—

# 8. TOUCH BEHAVIOR

The output must permit natural vertical touch scrolling.

It must not globally disable browser accessibility gestures.

The intended interaction is:

vertical pan
→ terminal output scroll

pinch zoom
→ remains available where the browser supports it

horizontal browser drift
→ should not be necessary for normal terminal interaction


Do not introduce broad:

`touch-action: none`

for the terminal surface.


—

# 9. NO ACCIDENTAL MOBILE INPUT AUTO-ZOOM

Terminal inputs must remain large enough on touch devices to avoid browser
focus-autozoom behavior.

The existing mobile input-size protection may be reused.

Do not solve terminal zoom by globally disabling user scaling.

User-controlled accessibility zoom must remain available.


—

# 10. INPUT GEOMETRY IS STABLE

The command input stays anchored inside the terminal interaction surface.

Growing output must not move the entire application page.

Expected layout principle:

minmax(0, 1fr)
+
input row

Output history scrolls internally.

The prompt/input row remains usable while output grows.


—

# 11. COMMON TERMINAL INPUT ATTRIBUTES

NODE-OS and RACK-OS command inputs use terminal-appropriate input behavior.

At minimum:

- `autoCapitalize=„none“`
- `autoComplete=„off“`
- `autoCorrect=„off“`
- `spellCheck={false}`
- `enterKeyHint=„send“`

The browser must not attempt to linguistically correct:

- commands
- paths
- addresses
- service endpoints
- software identifiers


—

# 12. SUBMIT PRESERVES AN ACTIVE EDITING SESSION

If the command input was focused when the player submits:

Enter
→ submit command
→ clear command input
→ input remains focused
→ keyboard remains open


Programmatic focus restoration must avoid scroll jumps.

Use browser behavior equivalent to:

`focus({ preventScroll: true })`

where restoration is required.


—

# 13. NO UNCONDITIONAL FOCUS STEALING

Focus restoration is conditional.

If the input was not focused before a terminal action, the action must not
unexpectedly focus it.

Example:

keyboard closed
→ player activates a Copy Target action
→ copy succeeds
→ keyboard remains closed


Never implement:

after any terminal interaction
→ always focus input


—

# 14. PENDING COMMAND DISPATCH MUST NOT DISABLE THE INPUT

An asynchronous command dispatch must NOT disable the currently focused input.

Do not use:

`disabled={dispatching}`

as duplicate-submit protection.

On mobile browsers, disabling a focused input may cause:

- focus loss
- keyboard dismissal
- editing-viewport changes


Instead:

focused input remains enabled

duplicate submit
→ rejected by interaction guard/ref


`aria-busy` or restrained presentation feedback may communicate pending
interaction without changing focusability.


—

# 15. DISPATCH CLEANUP ALWAYS RUNS

Async submit lifecycle must always clean up through `finally`.

Conceptually:

dispatching = true

try:
  execute adapter command
  render controlled result

catch:
  render controlled terminal failure

finally:
  dispatching = false
  preserve/restore focus only if appropriate


A rejected adapter command must never leave:

`dispatching = true`

permanently.

Adapter failures must not produce unhandled Promise rejections.

# ASYNC COMPLETION MUST NOT STEAL FOCUS

Focus preservation/restoration is valid only while the same Terminal surface is still active and the player has not intentionally moved focus elsewhere.

An asynchronous command completion must not refocus the Terminal after:

* navigating to another application/section
* disconnecting
* unmounting the Terminal
* explicitly blurring/dismissing the keyboard
* focusing another control

finally always clears dispatch state, but focus restoration remains conditional.
—

# 16. SHARED INTERACTION SUPPORTS ASYNC ADAPTERS

The shared interaction layer must not assume that command dispatch is
synchronous.

NODE-OS and RACK-OS command adapters may return synchronous or asynchronous
results.

The interaction layer coordinates:

- submit lifecycle
- focus
- duplicate-submit protection
- history
- terminal output-follow behavior

It does not own the meaning of the command or gameplay result.

Terminal Interaction V1 does not implement a command queue or concurrent command
dispatch.

While one guarded asynchronous command dispatch is pending:

new submit
→ guarded / ignored

Do not queue commands for later execution.

Do not execute multiple terminal commands concurrently merely because adapters
support asynchronous results.

A future concrete shell/job mechanic may introduce concurrent execution when
gameplay actually requires it.

Submission captures the current command string as that submitted interaction.

The live input is then cleared for the next draft.

Later resolve/reject handling for the submitted command must never overwrite or clear text entered after submission.
—

# 17. IME / TEXT COMPOSITION MUST NOT ACCIDENTALLY SUBMIT

Enter must not submit a command while the input is in an active composition /
IME session.

Composition events must be respected.

Equivalent behavior:

if event.isComposing
→ Enter does not submit


This protects language/input methods that use Enter during composition.


—

# 18. COMMAND HISTORY IS PER TERMINAL INSTANCE

History is terminal interaction state.

NODE-OS history and RACK-OS history are separate.

The shared interaction primitive supplies history semantics but does not create
one global history store.


History is not GameState.

Do not add:

TerminalHistoryState

to canonical simulation state.


When a terminal instance unmounts, V1 history may disappear.


—

# 19. HISTORY NAVIGATION

Hardware-keyboard / compatible keyboard behavior:

ArrowUp
→ previous command

ArrowDown
→ next command


History navigation must not submit commands automatically.


—

# 20. HISTORY PRESERVES THE CURRENT DRAFT

When the player enters history navigation while a partial command exists, the
live draft is preserved.

Example:

current input:
`analy`

ArrowUp:
→ previous command

ArrowDown back to live position:
→ `analy`


The current draft must not silently disappear.


—

# 21. HISTORY RESTORATION PLACES CARET AT END

When a history command or preserved draft is restored into the input, the caret
should end at the end of the restored value.

History navigation must not:

- select the entire input unexpectedly
- leave caret at an arbitrary old location
- trigger browser viewport scrolling


—

# 22. CLEAR SEMANTICS ARE FIXED

`clear` clears visible terminal output only.

It does NOT clear:

- command history
- current interaction session
- installed software
- gameplay state


If the input was focused:

clear
→ focus remains
→ keyboard remains open


The terminal does not remount merely to clear output.


—

# 23. FOLLOW-TAIL REPLACES AGGRESSIVE AUTO-SCROLL

New output must not always force the output viewport to the bottom.

The terminal tracks whether the user is currently following the newest output.


Rules:

User is near bottom
→ followingTail = true

User manually scrolls away from bottom
→ followingTail = false

User manually returns near bottom
→ followingTail = true

User submits a new command
→ followingTail = true


Async output alone must NEVER change:

followingTail = false
→ true


If the player intentionally scrolled upward to read old output, a late process
completion or asynchronous command result must not yank the terminal back to
the bottom.


—

# 24. NEAR-BOTTOM TOLERANCE

Follow-tail must not depend on exact pixel equality.

Use a small tolerance suitable for browser layout/subpixel rounding.

Conceptually:

distanceToBottom <= approximately 24–32 CSS px
→ near bottom


The exact implementation value is presentation detail.

Following-tail is local interaction state, not GameState.


—

# 25. OWN SUBMIT MAY RETURN TO TAIL

When the player explicitly submits a new command, the terminal may re-enter
follow-tail mode and bring that new command/result into view.

This is a deliberate player action and differs from unsolicited asynchronous
output.

Re-entering follow-tail does not mean scrolling against stale pre-render
geometry.

If a submit creates new terminal output:

submit
→ followingTail = true
→ relevant output renders
→ scroll to newest rendered content

The implementation must perform any scroll-to-tail behavior only after the
relevant rendered output geometry exists.

Do not rely on scrolling to the old `scrollHeight` before the new output has
been committed to the DOM.

—

# 26. OUTPUT ORDER MUST REMAIN CONTROLLED

The shared interaction layer must not assume command results arrive in the same
tick as submission.

Adapter results and controlled failures must appear as the result of their
submitted terminal entry.

Rejected asynchronous commands must become controlled terminal output rather
than uncaught application errors.


The shared terminal interaction layer does not invent command semantics to
achieve ordering.


—

# 27. COPY TARGETS PRESERVE EXISTING EDITING FOCUS

If the input was focused immediately before activating a copy target:

Tap target
→ clipboard write
→ input remains focused
→ editing remains active
→ keyboard remains open
→ viewport remains stable


Pointer-specific focus preservation is acceptable.

If platform testing proves additional restoration is required, implement that
behavior in the shared terminal interaction layer rather than adding
platform-specific hacks independently to every token.


—

# 28. COPY TARGETS REMAIN REAL ACCESSIBLE CONTROLS

Copy targets remain real semantic controls.

Pointer focus preservation must NOT break:

- normal click activation
- keyboard activation
- accessible naming
- screen-reader discovery
- visible focus behavior for keyboard users


Do not replace accessible controls with non-semantic spans merely to work around
mobile focus behavior.


—

# 29. CLIPBOARD ACTION REMAINS USER-ACTIVATED

Clipboard writes remain directly connected to the player’s activation.

Do not separate clipboard write from the user gesture through:

- artificial delay
- unrelated effect
- background timer


Copy success/failure is presentation state only.


—

# 30. NORMAL OUTPUT REMAINS TEXT

Normal terminal output remains normal selectable/readable text where browser
behavior permits.

Do not make the entire output area one giant touch-capture control.

Target-copy actions are explicit special controls inside otherwise ordinary
terminal output.


—

# 31. ACCESSIBILITY ANNOUNCEMENTS ARE RESTRAINED

Do NOT mark the entire continuously changing terminal-output region as an
aggressive live region.

Large terminal histories must not repeatedly flood screen readers.


Use targeted polite announcements only where interaction benefits from them,
for example:

- copy succeeded
- copy failed
- compact command-status feedback where appropriate


Normal terminal history remains readable without requiring every line to be
announced live.


—

# 32. NO FAKE PRESENTATION DELAYS

Terminal Interaction must not intentionally delay command results merely to make
the interface feel busy.

Do not implement arbitrary minimum-display timers.

If an operation has no represented duration:

command
→ result


If a future operation has real represented work:

canonical operation/process state
→ real pending/progress presentation


Presentation must follow causes, not invent them.


—

# 33. DOUBLE SUBMIT PROTECTION IS INTERACTION STATE

While one guarded command dispatch is still pending:

additional submit activation
→ ignored/rejected by interaction guard


The input remains enabled.

The guard is interaction state only.

It does not create a GameState lock.


—

# 34. TERMINAL PROMPT IDENTITY IS ADAPTER-OWNED

The shared interaction layer does not define one universal prompt.

Examples may remain distinct:

NODE-OS:
`user@node:~$`

RACK-OS:
`srv-01 [USER] >`


Future environments may supply different prompts.

Prompt appearance and identity belong to the terminal adapter / OS
presentation.


—

# 35. COMMAND SEMANTICS REMAIN ADAPTER-OWNED

NODE-OS retains its command registry and gameplay operations.

RACK-OS retains its remote command semantics.

The shared terminal surface must NOT introduce:

- one universal command registry
- command-provider abstraction for all OSes
- universal remote/local command namespace
- generic gameplay dispatcher


Terminal Interaction is about how commands are entered and displayed, not what
they mean.


—

# 36. RACK-OS MUST BECOME A FIRST-CLASS CONSUMER

RACK-OS Terminal must use the same accepted interaction foundation.

It must no longer remain a reduced independent terminal implementation that
misses interaction contracts such as:

- editing scroll ownership
- history
- focus retention
- mobile input hardening
- follow-tail
- shared scroll geometry


Its command semantics and visual identity remain RACK-OS-specific.


—

# 37. NO GAMESTATE CHANGE

Terminal Interaction V1 changes no canonical simulation state.

Expected:

GAME_STATE_VERSION remains unchanged.


At the current accepted baseline:

GAME_STATE_VERSION = 16


Do not bump schema for interaction/presentation changes.


—

# 38. AUTOMATED TESTING CONTRACT

Automated tests should cover deterministic interaction semantics such as:

- RACK-OS output is the actual editing scroll owner
- common input attributes
- per-instance history
- history draft preservation
- caret restoration where testable
- clear preserves history
- duplicate-submit guard
- input remains enabled while async dispatch is pending
- dispatch guard always resets after resolve
- dispatch guard always resets after reject
- rejected async command produces controlled terminal failure
- Enter does not submit while composing
- follow-tail disables after deliberate manual scroll away
- asynchronous output does not re-enable follow-tail
- manual return near bottom re-enables follow-tail
- own submit re-enables follow-tail
- copy target preserves active input focus
- copy target remains keyboard-accessible
- NODE-OS and RACK-OS histories are independent


Automated tests must avoid brittle assumptions about real browser layout
geometry where the DOM test environment does not provide reliable:

- scrollHeight
- clientHeight
- VisualViewport
- virtual keyboard
- browser chrome


Pure helper tests may model scroll geometry numerically where useful.


—

# 39. PHYSICAL MOBILE ACCEPTANCE IS REQUIRED

Automated tests alone do not prove Terminal Interaction V1.

Physical/mobile-browser acceptance remains required.


At minimum test:

## iPhone Safari — browser presentation

1. Open NODE-OS Terminal.
   Keyboard remains closed.

2. Tap input.
   Keyboard opens without focus autozoom.

3. Submit multiple commands.
   Input remains focused and keyboard remains open.

4. Generate enough output to scroll.
   Only terminal output scrolls.

5. Scroll upward.
   Later output does not yank viewport to bottom.

6. Return near bottom.
   Follow-tail resumes.

7. Type a partial command.
   ArrowUp / ArrowDown restores the draft.

8. Activate a copy target while keyboard is open.
   Clipboard succeeds.
   Keyboard remains open.
   Viewport does not jump.

9. Close keyboard.
   Terminal returns to stable normal geometry.

10. Rotate with keyboard open.
    Input remains usable and visible.


## iPhone Safari — Home-Screen presentation

Repeat the same sequence.

Special attention:

- keyboard geometry
- editing-surface position
- orientation recovery
- copy/focus interaction
- terminal scroll ownership


## RACK-OS

Repeat the relevant terminal interaction sequence in RACK-OS.

Especially verify:

- keyboard-open output scrolling
- history
- focus after submit
- no page/shell scrolling
- stable disconnect / section navigation after editing


—

# 40. DESKTOP / HARDWARE KEYBOARD ACCEPTANCE

Desktop/browser testing must verify:

- ArrowUp / ArrowDown history
- keyboard focus visibility
- copy-target keyboard activation
- text selection
- output scrolling
- follow-tail behavior
- clear semantics
- async command rejection recovery


—

# 41. NON-GOALS

Terminal Interaction V1 does NOT implement:

- new gameplay commands
- Inspect
- new hacking mechanics
- new Process kinds
- transfer progress
- install progress
- fake timers
- terminal persistence across sessions
- persistent command history
- filesystem history
- terminal tabs
- multiple shells
- autocomplete
- shell scripting
- pipes
- redirects
- aliases
- terminal resize protocol
- VT100/xterm emulation
- universal command registry
- generic OS framework
- new viewport controller
- GameState changes






# DURABLE SUMMARY

SHELL
owns viewport/editing geometry

TERMINAL INTERACTION
owns input/focus/history/internal scrolling

OS TERMINAL ADAPTER
owns prompt/output presentation

COMMAND ADAPTER
owns command/game semantics


The terminal output is the only terminal vertical scroll owner.

The input remains enabled while commands are pending.

Pending dispatch is guarded, not disabled.

Async cleanup always completes through `finally`.

IME composition never accidentally submits.

History is per terminal instance.

`clear` clears output only.

Manual scroll-away disables follow-tail.

Async output cannot re-enable follow-tail.

Own submit or manual return to bottom may re-enable follow-tail.

Copy targets preserve existing editing focus without sacrificing accessibility.

The entire terminal history is not an aggressive live region.

No fake duration exists without represented simulation causes.

GAME_STATE_VERSION remains 16.

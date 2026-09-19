# NodeMail V1 — design contract

Status: Accepted
Scope: The presentation and interaction design of the NodeMail application:
application composition and hierarchy, the inbox index, the correspondence
reading experience, the compose workspace, attachment selection and
presentation, correspondence removal, and the deliberate non-goals.

It does not define canonical communication semantics. Mailbox ownership,
threads, messages, read state, runtime thread identity, recipient resolution,
attachment snapshots and mailbox deletion belong to
[`../current/COMMUNICATION.md`](../current/COMMUNICATION.md); NODE-OS Shell
integration and the editing presentation belong to
[`../current/INTERFACE_SHELL.md`](../current/INTERFACE_SHELL.md).


## What NodeMail is

An in-world mail application, not a quest log and not a themed HTML form.

It presents the player's represented mailbox in the restrained technical
register of NODE-OS — industrial, dark, dense, tactile — and is expected to
carry a large amount of important in-world correspondence over time. "Clean"
is not the same as "empty": the surface earns its space with represented
facts and real tools rather than with rules and dark gaps.

The application carries the shared masthead because it states a subject the
Shell does not: the mailbox account being presented, which is a different
identity from the local Device named in Shell chrome.


## Four presentation decisions

**Type states what kind of text it is.** Everything the operating system says —
labels, counts, addresses, chips, filenames, provenance — stays in the NODE-OS
monospace inherited from the Shell. Everything a person wrote — correspondent
names, subjects, previews, message bodies and the player's own draft — is set
in the prose family, larger and looser. That one distinction is what makes a
mailbox read as writing inside a technical operating system rather than as more
terminal output.

**Separation is ruled, not boxed.** The inbox, the local-file list and the
correspondent directory are each one hairline-ruled column rather than a stack
of bordered cards, because a card per entry is what stops a list scaling past a
handful of them.

**What is lifted is what is being worked on.** Exactly three things sit on a
raised surface: the correspondence header, the player's own messages, and the
composer. Everything else stands on the page.

**The tools stay reachable.** Sending is a compact filled control on the same
row as the attach control, never a full-width slab under an empty field. The
surfaces that hold a long draft or a long list dock their action bar to the
bottom edge of their own scroll container, so the software keyboard cannot push
the essential action out of reach.

Green is spent on three things only: waiting correspondence, the selected
choice, and the control that actually sends.


## Navigation

```text
INBOX ──▸ THREAD ──▸ ATTACH
   │
   └────▸ COMPOSE ──▸ ATTACH
```

One stacked, focused path at every width. There is no mandatory desktop split
view, no multi-pane reading layout, and no persistent sidebar. Attachment
selection is a sub-surface of whichever composer opened it, with a back control
naming where it returns to.

Which surface is open, which correspondences are selected, what has been typed
but not sent, and which artifacts are staged are all application presentation
state and never reach `GameState`.


## Inbox

Three parts, in this order.

**A summary strip** of three derived facts — unread, correspondences, messages
— as a hairline grid. Unread takes an accent rail and accent value when it is
non-zero, because that is the reason the application was opened. Nothing here
is stored; all three are projected from canonical mail state.

**One action bar** carrying the two things a mailbox does: `COMPOSE`, and
`SELECT` for removal. It is a real tool area with its own ground rather than
two buttons floating in the gutter.

**One ruled index.** Each entry reads correspondent, then subject, then the
last thing actually said, clamped to two rendered lines. `YOU` marks a preview
whose latest contribution was the player's own. An attachment count appears as
a quiet chip when the correspondence carries sent attachments; it is a stated
fact, not a control.

Unread is stated three independent ways so it survives both fast scanning and
colour blindness: an accent rail and wash on the entry, brighter correspondent
and subject type, and the explicit `UNREAD` chip.

Removal is not a control on every row. `SELECT` turns the index into an
explicit selection mode — the trailing mark becomes a checkbox, the bar states
how many are selected, and one `DELETE` acts on the selection — so an ordinary
row stays clean at fifty entries.


## Thread

The correspondence is the surface.

One lifted header states everything about it at once: subject, both parties
with their addresses, how many messages and attachments it holds, and the one
action that belongs to it (`DELETE`). Metadata does not spread down the page as
chrome above the reading.

Direction is *stated*, not implied: every message is labeled `YOU` or with the
correspondent's name, and reinforced structurally — what was said to the player
stands on the page behind an accent rule, and what the player said is a lifted
inset block. There are no chat bubbles, avatars, alignment games, delivery
ticks, or timestamps.

A thread that accepts nothing says so plainly where the composer would be, and
describes the announcement rather than making a claim about the address.


## Composers

The reply composer is a tool block: one draft, the artifacts staged for this
message, and one explicit `SEND` on the same row as the attach control. The
draft lives above the composer component so opening the attachment picker
cannot discard it.

Compose is a workspace, not four stacked fields: the sending account is stated
once at the top, the recipient section carries a typed address plus the
represented correspondents the mailbox actually knows as real choices, and a
resolution line says what the typed address currently resolves to — or that it
resolves to nothing — before `SEND` is ever pressed. Subject, message and
attachments follow as their own sections, and the send controls dock to the
bottom edge.

Both composers share these rules:

- Enter inserts a newline. Enter never sends: the draft is a textarea inside a
  form, so this follows from the platform rather than from a key handler.
- Neither is ever autofocused. Opening a thread or Compose must not open the
  software keyboard.
- `SEND` is unavailable until the player has actually written a message.
- A refusal is stated in the application's own words, in place, and says what
  did *not* happen — no correspondent invented, nothing sent.
- On a successful reply the composer clears and the new exchange fades in once.
  That animation is the only post-send behaviour; nothing scrolls the page, and
  no delivery state is invented.
- Both consume the Shell-owned editing presentation exactly as Notes and
  Terminal do. NodeMail adds no VisualViewport reading, keyboard height, focus
  management, body transform, or scroll manipulation of its own. The docked
  action bar is ordinary sticky positioning inside the application's own scroll
  container.
- Each open composer surface declares two scrolling regions — the surface and
  the draft — because writing must not trap the player away from what they are
  answering.

Unsent compose state is presentation only. There are no Drafts.


## Attachment selection

A flat list of every artifact on the local Device filesystem, selected by
stable File identity and never by filename or path.

Each row states what the filesystem actually represents: filename, kind, size,
the provenance the artifact itself carries (release and version, channel,
publisher, host product, target address snapshot), and where the copy currently
lives. It is related to Files without pretending to be Files: nothing here
navigates a directory tree, opens, installs, transfers, or changes anything.
Selection is a choice; `DONE` returns to the composer with the staging visible
beside the attach control, where any of it can still be removed.

A *sent* attachment is presented from its own snapshot: filename, kind, size
and provenance, with no path, no location, and nothing to open, install,
re-download or transfer. Text sent as an attachment can be read exactly as it
was sent, behind a collapsed disclosure, because that content is the
attachment.


## Removal

Deliberate but not cumbersome, and never a browser-native `confirm()` sheet.

`DELETE` — in the thread header, or on the inbox selection bar — opens an
in-application confirmation that names what is going and states plainly what is
*not* going with it: anything the correspondence already caused, and any file
that was attached to it. `KEEP` and `REMOVE` are the two answers.

There is no Trash surface, no folders, no archive, and no restore UI.


## Communicated address affordance

An address-shaped run of text inside a message body is rendered as a copy
control over the literal communicated string.

It is presentation only. It resolves nothing, and it offers no scan, connect,
inspect, or open action — verifying a claim is the player's job, through the
existing observation applications. Copying does not steal focus from a reply
being written.


## Not represented

NodeMail shows no control for a mechanic it does not have: no folders, archive,
spam, starred, labels, CC/BCC, search, forwarding, drafts, notifications,
contacts management, or delivery receipts. No timestamps, dates, relative
times, delivery time, read receipts or typing state appear anywhere, because
the mailbox represents no communication time.

Receiving an attachment into a Device filesystem is not represented, and mail
sending deliberately routes through no `FileTransfer`, delivery Process,
network activity or progress presentation.

NodeMail is a NODE-OS Shell application. It is not represented installable
software, and it has no RACK-OS counterpart.

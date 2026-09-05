# NodeMail V1 — design contract

Status: Accepted
Scope: The presentation and interaction design of the NodeMail application:
information hierarchy, thread and message composition, the reply composer
contract, the communicated-address affordance, and the deliberate V1 non-goals.

It does not define canonical communication semantics. Mailbox ownership,
threads, messages, read state and the reply operation belong to
[`../current/COMMUNICATION.md`](../current/COMMUNICATION.md); NODE-OS Shell
integration and the editing presentation belong to
[`../current/INTERFACE_SHELL.md`](../current/INTERFACE_SHELL.md).


## What NodeMail is

An in-world mail client, not a quest log.

It presents the player's represented mailbox in the restrained technical
register of NODE-OS — clear, compact, believable — without turning
correspondence into Terminal output, and without imitating a consumer mail or
chat product.

The application carries the shared masthead because it states a subject the
Shell does not: the mailbox account being presented, which is a different
identity from the local Device named in Shell chrome.


## Two decisions carry the surface

**Type states what kind of text it is.** Everything the operating system says —
labels, counts, addresses, chips, section headings — stays in the NODE-OS
monospace inherited from the Shell. Everything a person wrote — correspondent
names, subjects, previews, message bodies and the player's own draft — is set
in the prose family the shared row primitive already uses for authored names,
larger and looser than the technical labels around it. That one distinction is
what makes a mailbox read as writing inside a technical operating system rather
than as more output, and it is why NodeMail does not read as a second NodeScan.

**Separation is ruled, not boxed.** The inbox is one hairline-ruled column of
entries rather than a stack of bordered cards, for the reason Wallet's activity
and Market's catalog already abandoned the shared bordered row: a complete
rectangle per item makes a list read as a pile of repeated objects and stops
scaling past a handful. Only the player's own messages are a filled block, and
only because that is what states direction without alignment games.


## Navigation

```text
INBOX → THREAD → REPLY
```

One stacked, focused path at every width. V1 deliberately has no mandatory
desktop split view, no multi-pane reading layout, and no persistent sidebar.

Which thread is open is application presentation state and never reaches
`GameState`.


## Inbox

An index of correspondences, not a list of cards. Every entry is one ruled row
in a single column and the whole row is the control, so the mailbox still reads
as one object at fifty threads.

Entries read correspondent first, subject second, and the last thing actually
said third, because a mailbox is browsed by who wrote and what it was about.
All three are set as reading text: the subject in particular is what the
correspondence is about, so it is never rendered as a tracked technical label
under the name.

The preview is projected from the latest canonical message — collapsed to a
single line and clamped to two rendered lines — and is never stored. When that
latest message is the player's own, the preview opens with a `YOU` mark, so the
inbox states whose turn the correspondence is on without inventing a status.

Unread is stated three independent ways so it survives both fast scanning and
colour blindness: an accent rail and wash on the entry itself, brighter
correspondent and subject type, and the explicit `UNREAD` chip. None of the
three is load-bearing alone. Player-sent messages never make a thread unread.

The mailbox summary states the derived unread count, and takes the accent only
while something is actually waiting.

Presented order is represented order. Nothing is re-sorted by unread state or
by an invented chronology.


## Thread

The subject leads as the object of the screen. Under it, the two identities the
correspondence is between are stated once as facts — the correspondent's name
and address, and the account it was delivered to — rather than as a run-on
line, because both addresses have to survive being long. Then the messages
themselves are the surface.

Direction is *stated*, not implied: every message is labeled `YOU` or with the
correspondent's name. It is then reinforced structurally rather than by
alignment — what was said to the player stands on the page behind an accent
rule, and what the player said is a quieter inset block. There are no chat
bubbles, avatars, alignment games, or delivery ticks, and no message is
horizontally offset to imply a side.

Message bodies are the largest, loosest, most readable text on the surface, and
they wrap rather than overflow however long a line or an address is.

A thread with no authored interaction says so where the composer would be: it
presents no composer and states that the address does not accept replies.


## Reply composer

The reply continues the correspondence instead of being a form bolted to the
end of it: it opens with the same section rule the transcript did and states
who it is going to, rather than labelling its own input. It stays in flow after
the last message, which is also what keeps the exchange a send produces visible
directly above the composer the player is already looking at — NodeMail moves
no scroll position of its own.

- A real multiline `textarea`, and an explicit `SEND`.
- Enter inserts a newline. Enter never sends: the draft is a textarea inside a
  form, so this follows from the platform rather than from a key handler.
- The composer is never autofocused. Opening a thread must not open the
  software keyboard.
- `SEND` is unavailable until the player has actually written something.
- On success the composer clears, and the new exchange fades in once. That
  animation is the only post-send behaviour; nothing scrolls the page, and no
  delivery state is invented. Nothing anywhere in the application shows a
  clock, a date, or a relative age: the slice represents no communication time.
- The composer reuses the Shell-owned Editing presentation exactly as Notes and
  Terminal do. NodeMail adds no VisualViewport reading, keyboard height, focus
  management, body transform, or scroll manipulation of its own.
- An open thread declares both the thread surface and the draft as scrolling
  regions, because writing a reply must not trap the player away from the
  message they are answering.


## Communicated address affordance

An address-shaped run of text inside a message body is rendered as a copy
control over the literal communicated string.

It is presentation only. It resolves nothing, and it offers no scan, connect,
inspect, or open action — verifying a claim is the player's job, through the
existing observation applications. Copying does not steal focus from a reply
being written.


## Not in V1

Compose, arbitrary recipients, dynamic threads, attachments, mail artifacts on
a filesystem, delivery routing, timestamps or delayed delivery, notification
infrastructure, search, filtering, folders, or archive/delete.

NodeMail is a NODE-OS Shell application. It is not represented installable
software, and it has no RACK-OS counterpart.

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
correspondence into Terminal output. Message prose is the primary object on the
surface and is set larger and looser than the technical labels around it.

The application carries the shared masthead because it states a subject the
Shell does not: the mailbox account being presented, which is a different
identity from the local Device named in Shell chrome.


## Navigation

```text
INBOX → THREAD → REPLY
```

One stacked, focused path at every width. V1 deliberately has no mandatory
desktop split view, no multi-pane reading layout, and no persistent sidebar.

Which thread is open is application presentation state and never reaches
`GameState`.


## Inbox

Rows read correspondent first, subject second, and the last thing actually said
third, because a mailbox is browsed by who wrote and what it was about.

The preview is projected from the latest canonical message — collapsed to a
single line and clamped to two rendered lines — and is never stored.

Unread is stated three ways so it survives both scanning and colour blindness:
a filled marker instead of a hollow one, a brighter correspondent name, and an
explicit `UNREAD` chip. Player-sent messages never make a thread unread.


## Thread

The thread states its subject, the correspondent's name and address, and the
account it was delivered to, then lists the messages in the order they were
said.

Direction is *stated*, not implied: every message is labeled `YOU` or with the
correspondent's name. Sent messages additionally take a quieter rule and a
modest indent. There are no chat bubbles, avatars, alignment games, or delivery
ticks.

A thread with no authored interaction says so plainly — it presents no composer
and states that the address does not accept replies.


## Reply composer

- A real multiline `textarea`, and an explicit `SEND`.
- Enter inserts a newline. Enter never sends: the draft is a textarea inside a
  form, so this follows from the platform rather than from a key handler.
- The composer is never autofocused. Opening a thread must not open the
  software keyboard.
- `SEND` is unavailable until the player has actually written something.
- On success the composer clears, and the new exchange fades in once. That
  animation is the only post-send behaviour; nothing scrolls the page, and no
  delivery state is invented.
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

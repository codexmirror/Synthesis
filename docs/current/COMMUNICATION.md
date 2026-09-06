# Communication and mail — current truth

Status: Accepted
Scope: The player's represented in-world mail account and Petra's represented
Company Chat, their authored and runtime-created correspondence, canonical mail
read state, the mailbox operations the player has over their own mailbox —
reading, replying, composing, attaching represented local artifacts, and
removing correspondence from the active mailbox — and the boundary between
communicated information and Discovery/Knowledge, as currently implemented on
`main`.

This document is the normative owner of current implemented truth for that
scope. `docs/V0.md` may summarize it; where a detailed statement differs, this
document wins. NodeMail's presentation inside NODE-OS belongs to
`docs/current/INTERFACE_SHELL.md`, and the durable rules behind the information
boundary belong to
`docs/architecture/IDENTITY_AND_INFORMATION.md`.


## What communication is

Communication is what one represented identity told another.

It is a distinct source of player information from observation. Scan, Inspect
and Analyze produce observed facts; mail produces *claims*. A correspondent can
be truthful, mistaken, or out of date, and nothing in the mail domain checks.

Mail therefore never creates Discovery or Knowledge, never establishes access,
and never resolves anything against World Truth.

The same boundary applies to Company Chat. A chat message is historical
communication — what its author said — rather than an observation or a live
projection of World Truth.


## Petra's Company Chat

`GameState.petraCompanyChat` owns the one concrete foreign Company Chat now
represented. It is separate from `GameState.mail`: Petra's work communication
does not belong to the player's NodeMail account merely because the player can
operate Petra's phone. VEYRA Communication is the client that presents this
chat and owns none of its history.

The chat initially has no messages. After a successful canonical Civic Dollar
Transaction from `dollar-account-veyra-phone-v0` (Petra's represented phone
Account) to `dollar-account-local-v0` (the player's represented Account) has
been appended, Petra immediately posts: “There’s a transaction from the work
phone that I don’t recognize. Can someone take a look?” The qualifying rule
uses stable Account IDs, never displayed account references or UI state.

The message stores Petra's authored words and the concrete Transaction ID that
caused them. The existing message history makes this first reaction
idempotent: later qualifying transfers do not add another alert. Refused
transfers, and transfers with any other source or destination Account, add
nothing. Opening or navigating Communication is read-only and never causes the
reaction.

Petra's complaint is immediate and changes no security truth itself. It also
starts one concrete pending Technician response with 5,000 ms remaining. That
delay advances only through the canonical game-advancement boundary; it is not
a Process, browser timer, scheduler, calendar, routine, or generic actor/reaction
system.

The Technician owns this reaction; Petra is the subject of his first concrete
implemented case, not the owner of a Petra-specific Technician abstraction.
When due, the response owned by `src/core/game/technician.ts` requires
Petra's complaint and its retained canonical Dollar Transaction, then reads
only Petra's represented phone and that Device's current Wallet Protection
setting. If protection is OFF, the Technician makes the limited local
assessment that someone may have had access to the phone, enables protection
through a narrow defensive-maintenance operation, and only after that real
change posts: “Maybe someone had access to your phone? I changed your Wallet
security settings.” If protection is already ON, or the complaint/evidence no
longer resolves, the pending response ends without changing or reporting
anything and never retries.

The Technician is a distinct Company Chat correspondent (`Technician`), not a
Device, IP address, Account, DeviceAccess, RemoteSession, or generic NPC entity.
No Technician hardware, network presence, awareness state, beliefs, goals, or
general incident-response framework is represented. The current case does not
inspect attacker identity, RATTLER, Authentication History, GateSSH, Firmware,
or any server; broader investigation and Firmware response remain unimplemented.


## The mailbox

`GameState.mail` is the player's canonical mailbox:

```text
mail
├── account            the player's represented in-world mail identity
├── correspondents     the represented identities the mailbox knows
├── threads            correspondences, in mailbox order
├── nextThreadId       mailbox-monotonic runtime thread identity
├── nextMessageId      mailbox-monotonic message identity
├── nextAttachmentId   mailbox-monotonic attachment identity
├── messages           every message actually said, in order
└── deletedThreadIds   correspondences removed from the active mailbox
```

The mailbox belongs to the mail **account** (`user@node.mail`).

It is not owned by the local Device (`node-01`), not by NODE-OS, and not by any
product or browser login. NODE-OS is only the client that currently presents
it: the account, the Device, and the player are three separate identities with
three separate stable IDs.

`account.address` and `correspondent.address` are communicated addressing
attributes, never identity (`A01`). A correspondent is a concrete represented
identity only: it is not an NPC, Actor or Organization, and it carries no
mood, stage, trust or relationship state.

A thread is either **authored** — its identity is a stable authored constant —
or **created at runtime** by Compose, in which case the mailbox allocates the
identity itself.

Runtime thread identity is deterministic and mailbox-local:
`mail-thread-0001`, `mail-thread-0002`, … allocated from `nextThreadId`, which
never rewinds and is never reused, including after a correspondence is removed
from the mailbox. Identity never comes from the subject, the recipient address,
a display name, randomness, or wall-clock time — two correspondences may share
every one of those and still be two different correspondences (`A01`). The
authored `mail-thread-welcome` and `mail-thread-mira-staging` identities are
unchanged by this and stay exactly as they were.

Thread order is mailbox order: authored threads first, then runtime-created
ones in the order they were created. That is insertion order, not chronology —
the mailbox still represents no time, so nothing is sorted by an invented one.


## Messages

A message states who sent it, in which thread, and exactly what was said:

- an **incoming** message carries `sender: 'correspondent'`, the
  `correspondentId`, and canonical `read` state;
- an **outgoing** message carries `sender: 'account'` and nothing else.

Only incoming correspondence has read state, so a player's own message cannot
contribute to an unread count by construction.

Message identity is deterministic and mailbox-monotonic (`message-0001`,
`message-0002`, …), allocated from `nextMessageId`. No message identity, order
or content comes from wall-clock time, randomness, or the browser.

### Attachments

A message may carry attachments: what was actually sent with it.

An attachment is Mail-owned communication history, not a file. It is
snapshotted from a concrete local `FilesystemFile` at the moment of sending and
carries no source File identity, Device reference or path afterwards, so
nothing can re-derive it from current filesystem truth. The two are different
canonical things:

```text
Device filesystem owns Files      →   Mail owns what was sent
(mutable, movable, deletable)         (fixed once communicated)
```

Every currently represented local artifact kind has its own attachment shape,
because the facts genuinely differ: a text file's content; a software package's
product, release, build, channel and publisher; a module's host product and
module identity; the `deauth.ext` extension's host and compatible host release;
an executable's program and release; a RATTLER payload's release, target Device
and the address snapshot it already carried; a firmware installer's firmware
release and build. Each also carries the filename it was sent as and the size
it was, both read from the source File at send time. Flattening them into one
generic blob would communicate less than the artifact actually stated.

Consequences, all of which are load-bearing:

- editing, moving or deleting the source File does not change or remove the
  sent attachment;
- removing the correspondence does not touch the source File;
- a sent attachment is not a `FilesystemFile` residing on any Device, is never
  rendered by resolving one, and offers nothing to open, install or transfer.

Sending an attachment does not mutate or consume the source File, install
software, grant ownership anywhere, or create Discovery or Knowledge. It is not
a transfer: mail attachments deliberately do not use `FileTransfer`, and the
mailbox represents no SMTP, mail server Device, bandwidth, transfer progress,
delivery Process, NetworkActivity or delivery timer. Sending is immediate at
the existing mail communication boundary.

Receiving an attachment *into* a Device filesystem is not represented.


### Communicated facts are snapshots

A message body is a snapshot of what was communicated, written when the message
is created. It never live-projects mutable World Truth.

Myra's first target address is authored correspondence content: the literal
`198.51.100.61` is stored in the message she sent. It is not a stored Device
reference resolved to `target.ip` at render time. If that Device's address later
changes, or the Device stops being represented at all, the old message still
says exactly what Myra said.


## Read state

Read/unread is canonical message state, not a presentation flag.

- The mailbox unread count is **derived** from unread incoming messages.
- Opening a thread is the canonical mail operation that marks that thread's
  unread incoming messages read. It touches no other thread.
- The unread count is derived over the **active** mailbox: a correspondence the
  player removed no longer contributes, even though its messages and their
  canonical read state are deliberately still there.
- A reply produced while the player is replying in that thread is created read:
  the conversation the player is looking at is never reported back to them as
  containing something new and unread.

No derived value (unread count, preview, latest sender, ordering) is stored in
`GameState`.


## Sending into an existing correspondence

Sending is one deterministic canonical transition:

```text
append the player's message exactly as written, with exactly what they attached
↓
resolve the thread's concrete authored answer from the real message history
↓
append that answer, if the thread has one
```

Only Myra's authored first-contact correspondence has an answer. A
correspondence the player started themselves accepts their further messages and
stays outgoing-only: accepting a message is not a promise that anything answers
it, and nothing generalizes the one authored interaction into a dialogue engine
(`A16`).

Whether a thread accepts anything at all is concrete cases rather than a
canonical per-thread flag that could disagree with the correspondence itself:
the authored NodeMail announcement is a statement and accepts nothing, a
correspondence removed from the mailbox is not there to write into, and every
other represented thread accepts the player's own messages.

There is no delivery time, delay, typing simulation, scheduled work, or
Process. The slice represents no communication time.

`sendMailReply` refuses an empty or whitespace-only message, an unknown thread,
the announcement thread, and a selection naming a File that no longer resolves
on the local Device — in each case leaving the mailbox unchanged.


## Composing a new correspondence

`composeMail` is the one operation that creates a correspondence at runtime:

```text
resolve the typed address against represented correspondent truth
↓
allocate the mailbox's next thread identity
↓
append exactly one outgoing message, with exactly the attachments selected
```

**Resolution is closed.** A typed address is an addressing attribute, never
identity (`A01`). It resolves only against an address a represented
`MailCorrespondent` already carries, ignoring surrounding whitespace and case,
which is addressing convention rather than identity. An address no represented
correspondent carries resolves to nothing: the send is refused, no
correspondent is invented, no thread and no message are created, and canonical
state is unchanged. The account's own address is not a correspondent and does
not resolve either.

Compose also refuses an empty recipient, an empty or whitespace-only subject,
an empty or whitespace-only message, and a selection naming a File that no
longer resolves — each leaving the mailbox unchanged.

**Nothing answers it.** A represented correspondent replying is a concrete
authored interaction, and starting a correspondence is not one, so a new thread
is outgoing-only unless and until something represented actually writes back.
Compose fabricates no incoming message, no unread state, and no correspondent.

Unsent compose input is presentation state in the client. The mailbox
represents no Drafts.


## Removing correspondence from the active mailbox

`deleteMailThreads` records thread identities in `deletedThreadIds`. That is
mailbox **presence**, not history.

The thread and every message in it are deliberately retained, because what was
actually communicated is the truth prior consequences were caused by. Removal:

- takes the correspondence out of the active mailbox;
- takes its incoming messages out of the derived unread summary;
- leaves the source File of every sent attachment untouched;
- leaves Discovery, Knowledge, DeviceAccess and every already-caused World
  consequence untouched;
- rewrites nothing Myra, or anyone else, actually said.

It is deliberately not a Trash, folder, archive or restore system: there is one
active/removed distinction and no second location for mail to live in. Removing
an unknown or already-removed thread changes nothing, and mailbox identity
allocation never rewinds because a correspondence was removed.


## Represented correspondence

Two threads currently exist.

**NodeMail · Welcome to NodeMail** (`system@node.mail`). One incoming message
confirming the account is active. It is an announcement rather than a
correspondence: the mailbox accepts nothing into that thread.

**Myra Keller · something for you** (`mira@vector-node.net`). One unread
incoming message tentatively offering the unfamiliar player a possible target,
without exposing its address. It is the one interactive correspondence.

The player writes the whole reply themselves. There are no offered response
options.

Both are ordinary correspondences in every other respect: either can be
removed from the active mailbox, and the player can attach represented local
artifacts to a reply into Myra's thread.

What Myra says is a concrete thread-specific authored rule
(`resolveMyraFirstContactReply`), deliberately not a dialogue engine, intent
resolver, or entity extractor (`A16`). It matches a deliberately small
vocabulary against the player's own words, case-insensitively:

| Player wording | Myra's answer |
| — | — |
| clear interest (`yes`, `interested`, `send it`, `what do you have`, `let me see`, `tell me`, or an address request) | the first target address `198.51.100.61` and limited context |
| credentials (`password`, `passwd`, `credential(s)`, `login`) | says she has no credentials for the player and does not reveal the address |
| anything else | leaves the choice with the player and invites clear interest |

Unrecognized wording is still a real message: it is preserved verbatim in the
history and answered naturally. Nothing emits parser or intent-failure
language.

Whether Myra has already given the address is read from the messages she
actually sent, not from a stored conversation stage. The slice deliberately
holds no `conversationStage`, `lastIntent`, `hostInfoAlreadyGiven`, `npcMood`
or trust value: the represented history is the conversation truth.


## The boundary with observation

After Myra communicates the address:

- the mail history contains that literal string;
- Discovery, Knowledge and DeviceAccess are unchanged — receiving mail is not
  an observation (`A03`, `A09`);
- the player may copy the address out of the message;
- Scan already accepts a valid IPv4 directly, without prior Discovery, so the
  player can verify the claim through the existing observation path
  (`docs/current/NETWORK_ACCESS.md`);
- only that actual observation updates Discovery.

Reading, copying, or believing a communicated address grants nothing.


## Gotchas

- Communication is not observation. Never let a message create Discovery,
  Knowledge, or access, and never let mail resolve a live World lookup.
- A communicated fact is history. Never re-derive a message body from current
  state at render time.
- The message history is the conversation state. Do not add a stage, intent,
  mood or "already told them" flag beside it.
- Unread is derived from canonical read state. Never store a count, preview, or
  latest-sender field.
- The one represented communication delay is Petra's concrete pending
  Technician response. Do not infer timestamps, general delivery timing,
  polling, or a scheduler from that authored case.
- A sent attachment is not a file. Never render one by resolving a source File,
  and never let the filesystem and the mailbox share one object.
- Sending is not transfer. Do not route mail attachments through `FileTransfer`
  or invent a delivery runtime for them.
- Removing correspondence is presence, not erasure. Never delete messages to
  implement it, and never let it reach the filesystem or the World.
- A typed address is not a correspondent. An unresolved address must fail
  closed rather than bring a new identity into existence.

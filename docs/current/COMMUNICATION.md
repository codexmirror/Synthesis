# Communication and mail — current truth

Status: Accepted
Scope: The player's represented in-world mail account, correspondents, threads
and messages, canonical read state, the deterministic reply operation, and the
boundary between communicated information and Discovery/Knowledge, as currently
implemented on `main`.

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


## The mailbox

`GameState.mail` is the player's canonical mailbox:

```text
mail
├── account          the player's represented in-world mail identity
├── correspondents   the represented identities who have written
├── threads          authored correspondences, in authored order
├── nextMessageId    mailbox-monotonic message identity
└── messages         every message actually said, in order
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

Threads are authored. Nothing creates a thread at runtime, so the mailbox
allocates no thread identity. Thread order is authored order — the slice
represents no time, so nothing is sorted by an invented chronology.


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

### Communicated facts are snapshots

A message body is a snapshot of what was communicated, written when the message
is created. It never live-projects mutable World Truth.

Mira's staging address is authored correspondence content: the literal
`203.0.113.42` is stored in the message she sent. It is not a stored Device
reference resolved to `target.ip` at render time. If that Device's address later
changes, or the Device stops being represented at all, the old message still
says exactly what Mira said.


## Read state

Read/unread is canonical message state, not a presentation flag.

- The mailbox unread count is **derived** from unread incoming messages.
- Opening a thread is the canonical mail operation that marks that thread's
  unread incoming messages read. It touches no other thread.
- A reply produced while the player is replying in that thread is created read:
  the conversation the player is looking at is never reported back to them as
  containing something new and unread.

No derived value (unread count, preview, latest sender, ordering) is stored in
`GameState`.


## Sending a reply

Sending is one deterministic canonical transition:

```text
append the player's message exactly as written
↓
resolve the thread's concrete authored reply from the real message history
↓
append that reply
```

There is no delivery time, delay, typing simulation, scheduled work, or
Process. The slice represents no communication time.

`sendMailReply` refuses an empty or whitespace-only message, an unknown thread,
and a thread with no authored interaction, in each case leaving the mailbox
unchanged.


## Represented correspondence

Two threads currently exist.

**NodeMail · Welcome to NodeMail** (`system@node.mail`). One incoming message
confirming the account is active. It is read-only: the mailbox accepts no reply
into it.

**Mira Keller · staging endpoint** (`mira@vector-node.net`). One incoming
message offering an address the player has to ask for. It is the one
interactive correspondence.

The player writes the whole reply themselves. There are no offered response
options.

What Mira says is a concrete thread-specific authored rule
(`resolveMiraStagingReply`), deliberately not a dialogue engine, intent
resolver, or entity extractor (`A16`). It matches a deliberately small
vocabulary against the player's own words, case-insensitively:

| Player wording | Mira's answer |
| — | — |
| host information (`ip`, `address`, `host`, `server`, `endpoint`) | the staging address `203.0.113.42` |
| credentials (`password`, `passwd`, `credential(s)`, `login`) | refuses to send credentials over mail |
| both in one message | gives the address and refuses the credentials |
| anything else | says what she means and invites the question again |

Unrecognized wording is still a real message: it is preserved verbatim in the
history and answered naturally. Nothing emits parser or intent-failure
language.

Whether Mira has already given the address is read from the messages she
actually sent, not from a stored conversation stage. The slice deliberately
holds no `conversationStage`, `lastIntent`, `hostInfoAlreadyGiven`, `npcMood`
or trust value: the represented history is the conversation truth.


## The boundary with observation

After Mira communicates the address:

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
- There is no represented time here. Do not add timestamps, delivery delays,
  polling, or `Date.now()`-derived anything.

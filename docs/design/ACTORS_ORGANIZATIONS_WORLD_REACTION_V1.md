# Actors, Organizations, and World Reaction V1

Status: Accepted
Scope: Future design authority for represented people, organizations, actor
information and observation, represented communication, systemic world
reaction, and eventual player/NPC infrastructure symmetry. This contract
freezes semantic direction and boundaries, not schemas.

This is an **Accepted future design contract**. It is not Current Truth and is
not implementation authority by itself. Current implemented truth remains with
the relevant [`../current/`](../current/) owners; durable constraints remain
with [`../ARCHITECTURE.md`](../ARCHITECTURE.md) and its owning modules. Concrete
implementation requires separately selected work.

No Person entity, Organization entity, or Worker system is selected or
implemented by this contract. It selects no generic ownership graph,
autonomous NPC runtime, event bus or generic reaction engine, generic knowledge
system, messaging-generation system, scheduling model, security-response
system, or player business/tycoon system. It freezes semantic direction and
boundaries, not Types, state shape, mechanics, or runtime architecture.


## 1. Core separations and ownership

The future model must preserve these separations:

```text
PERSON              != DEVICE
ROLE                != PERSON
ORGANIZATION        != NETWORK
PLAYER              != ORGANIZATION
MESSAGE             != PERSON KNOWLEDGE
WORLD TRUTH         != PERSON KNOWLEDGE
OBSERVABLE EVIDENCE != AUTOMATIC OBSERVATION
OBSERVATION         != INTERPRETATION
INTERPRETATION      != ACTION
```

A future Person may use, own, be assigned, or have access to Devices. The exact
relationship schemas are unresolved. A future Organization may relate to
people, roles, Networks, Devices, Accounts, and other represented operational
resources. Those relationships must not turn Organization into a giant state
owner that duplicates the truth belonging to each entity or relationship.

```text
ORGANIZATION
provides social / operational context

DEVICE
still owns Device truth

ACCOUNT / PROVIDER
still own financial truth

NETWORK
still owns or represents its technical relationships when such a model exists
```

Stable identity remains separate from names, addresses, roles, ownership, and
other mutable attributes (A01). State remains with the entity or relationship
it describes (A02). Device, Firmware, Software, Session, access, filesystem,
and financial boundaries remain intact (A07, A08, A17, A18).


## 2. Small conceptual example

```text
BOOKSHOP ORGANIZATION
|
|-- Owner
|-- Technician
`-- Sales Worker

NETWORK / INFRASTRUCTURE
|-- shop server
|-- owner phone
|-- technician workstation
`-- sales terminal
```

This deliberately small example is explanatory only. It does not select the
bookshop name, roles, people, Devices, relationships, or topology for
implementation. It demonstrates that a Person is not a Device, a role is not a
Person, and an Organization is not a Network. The Owner, Technician, and Sales
Worker may eventually have different represented access, responsibilities, and
observations even while participating in the same Organization.


## 3. World-reaction design grammar

The preferred conceptual grammar is:

```text
REPRESENTED EVENT / ACTION
        |
        v
CONCRETE WORLD MUTATION
        |
        v
REPRESENTED EVIDENCE / OBSERVABLE STATE
        |
        v
ELIGIBLE OBSERVER MAY OBSERVE
        |
        v
PERSON INFORMATION CHANGES
        |
        v
ROLE / GOAL / RELATIONSHIP MAY MAKE IT RELEVANT
        |
        v
PERSON MAY TAKE ACTION
        |
        v
CONCRETE WORLD MUTATION
```

This is design grammar, not a mandatory pipeline or a universal engine. Some
events produce no observable evidence; some evidence is never observed; some
observations are not interpreted as important; and some people choose or are
able to take no action.

The grammar preserves A11 and A12: mutate causes and derive consequences from
concrete state transitions. The default systemic architecture must not be:

```text
playerPerformedHack
        |
        v
spawnTechnicianWarningMessage
```

A named player action must not directly summon a bespoke reaction merely
because the authored story expects one. This direction also does not justify a
global event bus, causality framework, generic reaction engine, universal
action/effect framework, or Process-based event system. Processes remain
represented elapsed work and resource consumption (A10); concrete mechanics
must precede generic frameworks (A16).


## 4. Evidence before knowledge

A represented event does not automatically become a person's information.

```text
EVENT HAPPENED != PERSON KNOWS EVENT HAPPENED
EVIDENCE EXISTS != PERSON HAS OBSERVED EVIDENCE
```

A remote access may create or alter represented authentication history or a
future concrete log artifact. A financial transfer creates canonical
Transaction and balance truth. A file change changes Device-owned filesystem
truth. Those mutations may later provide observable evidence; none directly
grants every actor the hidden causal account of what occurred.

This extends the World Truth versus Player Information philosophy of A03 and
A04 without asserting that future Person information must use the player's
current Discovery or Knowledge implementation. No universal `KnowledgeState`
or generic knowledge schema is selected here. Where artifacts exist, they must
arise from represented events rather than atmospheric fabrication (A13).


## 5. Constrained observation and differentiated information

A future Person may react only to information available through represented
relationships and capabilities. For example:

```text
Technician
    |
    v
has represented access / responsibility
    |
    v
can inspect relevant infrastructure evidence
```

Organization membership is not omniscience. A Sales Worker does not
automatically receive the Technician's technical facts merely because both
participate in the same Organization. Two people in the same Organization may
legitimately know different things.

An Owner may initially learn only that an unfamiliar financial transfer
occurred. That observation does not silently become knowledge that a hacker
accessed a phone from a particular address. Information must remain no more
specific than the represented observation justifies, and hidden causal truth
must not be inferred merely to make a reaction convenient.


## 6. Interpretation and role relevance

Observation and reaction remain separate. A Person may observe something and
take no action. Roles, responsibilities, goals, and relationships may
eventually influence relevance, but this contract selects neither a generic
Role schema nor an AI behavior tree.

Explanatory directions include:

- a **Technician** may care about infrastructure anomalies, software
  maintenance, and represented access evidence;
- an **Owner** may care about financial state, business operations, and
  important organizational problems;
- a **Sales Worker** may care about the tools and systems needed for their work.

These examples do not select numeric traits, security levels, personality
scores, universal priorities, or automatic responses.


## 7. Communication and retained Messages

The long-term direction is:

```text
MESSAGE
= represented communication content or a retained communication artifact
  between represented participants

not merely

MESSAGE
= text authored so the player has something interesting to read
```

Initial authored Messages remain valid initial World Truth. Future generated or
evolving Messages should follow represented knowledge and an actual
communication action:

```text
Technician observes unusual access evidence
        |
        v
Technician decides to inform Owner
        |
        v
represented communication occurs
        |
        v
Message is created
```

Represented communication may create a Message, but the communication action or
occurrence and its retained Message do not have to be the same simulation
concept. Nothing in this distinction requires every communication occurrence to
create a retained Message. Where later systemic Messages do exist, they should
arise from represented communication rather than decorative reaction text.

The Message is a consequence of communication. Its existence is not the
mechanism that causes the Technician to know about the access. Circular logic
in which a Message exists and therefore its sender magically knew an event is
not valid. A Message and a Person's information remain distinct, as do
communication presentation and communication authority. This design-level
distinction selects no communication-event Type or schema, event bus, messaging
engine, communication framework, `GameState`, or runtime behavior.


## 8. Epistemic precision in communication

Consider a player transferring money from a compromised context:

```text
TRANSFER
    |
    v
Transaction / balance change
```

The Owner may later observe a transaction they did not expect. That alone does
not justify the conclusions that a hacker accessed the Owner's phone, who the
attacker was, or which technique was used. The Owner may communicate the
unexpected transaction to a Technician. The Technician may then inspect
represented evidence, and only that later observation may justify stronger
conclusions.

Communication must preserve the precision and uncertainty of what participants
could actually know. It must not smuggle hidden causal truth into either a
sender's knowledge or a recipient's message.


## 9. Actor action changes the same world

NPC reactions should eventually be capable of concrete effects such as sending
represented communication, changing represented configuration or credentials,
installing a represented Software or Firmware update, taking a Device offline,
or changing access or service state through actual supported mechanics. These
are directions and examples, not currently available mechanics frozen by this
contract.

Actor actions should use the same represented systems, shared gameplay
operations, and ownership boundaries used elsewhere in Synthesis (A05). An
abstract reaction counter such as `securityResponseLevel++` is not a substitute
for concrete consequences.


## 10. Return visits and a changing world

A target should eventually be capable of changing after the player leaves:

```text
DAY / MOMENT A
player exploits represented weakness
        |
        v
evidence remains

later
        |
        v
Technician observes evidence
        |
        v
represented maintenance action
        |
        v
Firmware / Software / configuration changes

RETURN VISIT
old technique no longer works
```

The exact timing, scheduling, observation cadence, weakness model, and update
mechanic remain unresolved. The frozen direction is only that represented
actors may eventually change World Truth and that a later visit may encounter
the result.


## 11. Stealth and risk as consequences

Player risk should increasingly emerge from these questions:

```text
WHAT DID THE PLAYER CHANGE?
WHAT EVIDENCE EXISTS?
WHO CAN OBSERVE IT?
WHAT CAN THEY INFER?
WHAT WILL THEY DO?
```

A universal abstract stealth, detection, attention, or security meter is not
the default representation of this design. This does not ban a future explicit
detection mechanic when a concrete represented system justifies one.


## 12. Conservative Organization boundary

An Organization is conceptually a social or operational grouping that may
eventually establish relationships among represented people and infrastructure.
It is not automatically a Network, Device container, Account owner for every
Account, Person, player identity, security boundary, or `GameState` subtree
containing duplicated copies of related truth.

```text
ORGANIZATION
    |-- people participate through represented relationships
    |-- roles / responsibilities may exist
    |-- Networks may be operated / owned / used
    |-- Devices may be operated / owned / assigned
    `-- Accounts / services may have represented organizational relationships
```

Relationships must connect distinct identities rather than collapse them.
Exact ownership, legal, participation, and employment semantics remain
unresolved.


## 13. Organization and Network boundary

```text
ORGANIZATION != NETWORK
```

A company may eventually operate one Network, multiple Networks, or no
represented Network in a limited scenario. A Network may contain or connect
Devices without itself representing an Organization.

The player's first Home Network is one concrete network context, not the
universal type for all networks or future organizational networking. This
contract neither replaces Home Network nor selects a universal topology
framework, multiple player Networks, or Network switching.


## 14. Person and Worker boundary

```text
WORKER != DEVICE
```

A worker is conceptually a represented Person participating in a role or
relationship. A Person may eventually use or be assigned a Device, access
multiple Devices, hold organizational credentials, operate software, perform
work, and communicate with other people.

Employment, salary, skills, schedules, AI, task assignment, and workforce
mechanics remain future work. “Worker” does not select a special entity schema
or allow a Device to stand in for a Person.


## 15. Player and NPC structural symmetry

Player-owned structures should eventually be capable of using the same
underlying world model as foreign or NPC-owned structures:

```text
FOREIGN ORGANIZATION          PLAYER-RELATED ORGANIZATION
    -> people                     -> people
    -> Networks                   -> Networks
    -> Devices                    -> Devices
    -> software                   -> software
    -> Processes                  -> Processes
    -> Accounts                   -> Accounts
```

The player's relationships to those entities differ. The underlying systems
should not become unrelated parallel abstractions without a concrete reason,
and the player does not need a fake parallel tycoon simulation when represented
systems can express the operation.

> Everything the player eventually owns should be made from the same world
> they first learned to hack.

This is long-term product and system direction, not current implementation
authority and not a declaration that player Organization ownership exists.


## 16. Business gameplay direction

Long-term business gameplay should orchestrate represented systems rather than
replace them with disconnected management counters. A future mining business,
for example, should ideally derive from concrete Devices, hardware, runtime,
Processes, software, Networks, Accounts, and people or workers where those are
represented.

Mining is not selected as a required business type. This contract adds no
`businessIncomePerHour`, abstract worker production, security statistic,
company level, generic business upgrades, or other business mechanic.


## 17. Boundary with the first ordinary VEYRA phone

The first ordinary VEYRA phone remains a concrete Device and Firmware product
experience under
[`VEYRA_FIRST_ORDINARY_PHONE_V1.md`](VEYRA_FIRST_ORDINARY_PHONE_V1.md) and its
parent identity contract.

```text
PERSON                 != PHONE DEVICE
PHONE DEVICE            != VEYRA FIRMWARE
PERSONAL COMMUNICATION != DEVICE IDENTITY
```

VEYRA is neither a Person nor an Organization state owner. A future represented
phone may be used or owned by a represented Person, but that relationship is
outside the first-phone presentation contract until concrete implementation
work selects it. Current VEYRA work must not wait for the entire actor and
organization model. This contract exists partly so current product work does
not accidentally prevent those later separations.


## 18. Authored beginnings and evolving history

```text
INITIAL AUTHORED WORLD
        +
SIMULATED CONSEQUENCES
        |
        v
EVOLVING WORLD HISTORY
```

Authored starting messages, files, people, relationships, Devices, and state
remain valid. Procedural generation is not the goal by itself. After simulation
begins, future state should increasingly be capable of emerging from
represented actions and consequences instead of only static authored content.


## 19. Explicitly unresolved and not selected

This contract deliberately does not select or resolve:

- an exact Person schema or NPC identity model;
- an Organization, ownership-relationship, employment, or Role schema;
- Worker mechanics, wages, worker skills, salaries, or schedules;
- autonomous action scheduling or a generic goal system;
- personality, LLM integration, procedural dialogue, or a generic AI framework;
- an event bus, causality engine, universal action framework, generic reaction
  rules engine, or generic knowledge engine;
- NPC memory implementation;
- communication-provider architecture, message generation, or notification
  mechanics;
- log mechanics beyond existing accepted direction;
- attack detection, trace mechanics, a stealth meter, forensic systems,
  security teams, or a generic security-response system;
- Firmware-update mechanics, credential rotation, or incident response;
- Organization ownership by the player, businesses, or business economics;
- multiple player Networks or Home Network replacement/switching;
- multiplayer Organization ownership; or
- persistence and server architecture.

No generic ownership graph, autonomous NPC runtime, scheduling model, or
player business/tycoon system follows from this direction. Concrete future work
must select its own smallest mechanic without treating this document as schema
or implementation authority.


## 20. Design review tests

Before accepting future work in this domain, ask:

1. Does an NPC know something only because the player caused it, or because the
   NPC could actually observe represented evidence?
2. Has Organization accidentally become a duplicate owner of Device, Account,
   or Network truth?
3. Has Person been collapsed into Device?
4. Has role been collapsed into Person identity?
5. Has Organization been collapsed into Network?
6. Does communication represent an actual communication action, or is it
   decorative reaction text?
7. Are NPC actions mutating concrete represented systems rather than abstract
   reaction counters?
8. Is hidden causal truth being leaked into NPC information?
9. Could two people in the same Organization legitimately know different
   things?
10. Does the model allow no reaction when nobody observes the evidence?
11. Is a generic engine or framework being introduced before a concrete
    mechanic requires it?
12. Could the same world structure eventually support player-owned
    infrastructure without creating a parallel fake management simulation?

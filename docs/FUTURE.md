# Confirmed future directions

Future iterations may add:

- Network Analysis upgrades that deepen observations derived from existing simulation truth
- Richer simulated networks, NPC hosts, and eventually exposed real players
- Simulation time and autonomous world change when concrete mechanics require them
- Imperfect, stale, and deeper player knowledge
- Explainable traces, attention, risk, logs, and trace removal
- Exploit attempts, credentials, access, and filesystems as concrete mechanics
- Player-owned tools, software, derived capabilities, hardware, malware, economy, organizations, reachability, and multiplayer progression
- Multiple in-game device interfaces over the same game systems
- External integrations where they serve an established product need

## Systemic gameplay north star

The long-term goal is not merely to accumulate targets, commands, applications, or isolated mechanics. Synthesis should grow into a systemic simulation in which independently useful mechanics interact with shared world state and produce situations that were not authored as explicit event chains.

```text
WORLD TRUTH
    ↓
ACTIONS AND AUTONOMOUS CHANGE
    ↓
STATE MUTATION
    ↓
CROSS-SYSTEM CONSEQUENCES
    ↓
OBSERVATION
    ↓
PLAYER DECISIONS
    ↓
FURTHER STATE MUTATION
```

These are directions, not specifications. The current slice has Service Analysis and minimal positive vulnerability Knowledge, but no exploit, access, filesystem gameplay, autonomous actors, attention system, simulation clock, or active graphical Network app. Concrete mechanics should establish requirements before generic frameworks are considered.

### Player tools, capabilities, and strategic position

Long-term progression should expand the player's ways of interacting with existing systems rather than merely unlock a fixed sequence of stronger commands. Tools and software should increasingly be concrete things in the simulation. Depending on mechanics that are actually implemented, they might be found, copied, stolen, purchased, traded, modified, deleted, outdated, corrupted, detected, or otherwise affected by world systems. These are examples of systemic possibilities, not promises that every listed mechanic will exist or that every tool must use one inventory model.

Capabilities should increasingly be derived from concrete state rather than made ultimate canonical truth as permanent player flags. Conceptually, installed software, hardware, runtime state, relationships or access, credentials, and position or reachability could together determine currently usable capabilities. A tool might be installed while required hardware is absent; a target might be unreachable from the current position; or a tool might work only from another controlled device. In each case, possession alone is insufficient. This is a future design direction, not a capability resolver or schema.

Knowledge reveals potential ways of interacting with the world. It does not automatically unlock success, prove current validity or reachability, provide required software or credentials, or create access. One player might know a weakness and have compatible tooling; another might know it but lack tooling; another might not know it but own valid credentials; and another might already have an internal session. The same world object can therefore offer meaningfully different options in different player situations.

Reachability should become a major source of strategic depth while remaining conceptually separate from Knowledge, tool possession, and World identity. A player may know that a database exists and own a useful technique while the database is unreachable from the Internet. A later foothold on a web server could make the database reachable from that position without changing either the database or the tool: the player's relationship and position changed the useful action space. This direction does not define routing or network simulation.

The UI should express what the player reasonably believes they can attempt, not expose omniscient World truth. A player may know an old weakness, possess a suitable tool, see an attempt as plausible, begin it, spend time or resources, and learn only from its result that the world has changed. Visible feasibility is not actual feasibility, and this principle does not define a generic available-actions API.

Future attacks should not all produce the same outcome. An action is valuable because of its concrete state transition, and success means that the requested transition occurred—not that a “generic hack” succeeded or that access necessarily followed. Service disruption, credential use, exploitation, malware or software manipulation, traffic or reachability manipulation, filesystem actions, and resource abuse are possible examples, not a required taxonomy or a future `AttackType` contract.

Replayability should increasingly arise from combinations among existing systems rather than a huge catalog of isolated content. Infrastructure layout, redundancy, security posture, dependencies, current actors, existing access, and world state may make the same capability produce very different situations. Ideally, a tool discovered late in a playthrough can make a familiar world configuration strategically meaningful in a new way: old systems plus a new capability plus a different situation produce a new player strategy, rather than relying on a numbered scripted surprise.

Concrete mechanics come first. None of these directions requires or justifies a CapabilityEngine, ActionEngine, AttackFramework, AvailableActionsEngine, RuleEngine, ReachabilityEngine, ToolRegistry, SoftwareInventoryFramework, generic affordance system, ECS, event bus, or plugin framework. The first concrete attack and tool milestone should establish actual requirements before abstractions are extracted. No software or tool inventory, attack capability, reachability, session, exploit, access, or filesystem gameplay system exists today.

Architectural constraints for future work are documented in [`ARCHITECTURE.md`](ARCHITECTURE.md).

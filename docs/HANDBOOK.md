Synthesis Development Handbook

This document defines the working rules for developing Synthesis.

Its purpose is to keep the project consistent as the game grows, prevent tool-role drift, preserve architectural boundaries, and make future work easier to review.

GitHub is the canonical source of truth. Experimental work is useful only after it is reviewed and intentionally transferred into the canonical repository.

────────

1. Core Development Principle

Synthesis should remain easy to extend even if future systems become large, unusual, or deeply interconnected.

The project should prefer:

• small, explicit module boundaries
• clear ownership of state and behavior
• shared gameplay logic behind multiple interfaces
• simple TypeScript over speculative frameworks
• incremental architecture based on real requirements
• reproducible tests and builds
• narrow pull requests with clear intent

The project should avoid:

• speculative framework architecture
• hidden cross-feature coupling
• duplicating gameplay logic in multiple UIs
• letting prototypes become production code by accident
• large unreviewed rewrites
• treating visible identifiers such as IP addresses as entity identity
• letting UI components directly mutate unrelated game state

The goal is not to predict every future feature.

The goal is to make future features attach cleanly.

────────

2. Source of Truth

The canonical project lives in GitHub.

Repository:

codexmirror/Synthesis

Canonical branch:

main

Rules:

1. main represents the current accepted version of Synthesis.
2. Production implementation decisions must ultimately exist in GitHub.
3. Work prototypes, screenshots, HTML experiments, notes, and generated mockups are non-canonical until explicitly approved and implemented.
4. Documentation in the repository should describe the actual canonical implementation, not an experiment or future assumption.
5. Repository documentation, code, comments, commit messages, PR titles, PR descriptions, and Codex prompts are written in English.

Our discussion and planning may remain in German.

────────

3. Tool Roles

ChatGPT

ChatGPT acts as the coordination, review, planning, and architecture layer.

Use ChatGPT for:

• deciding scope
• architecture review
• reviewing GitHub diffs and pull requests
• converting experimental findings into implementation plans
• writing Codex tasks
• identifying risks and missing boundaries
• deciding whether a change should be manual, Codex-driven, or experimental
• maintaining project-level reasoning and development discipline

ChatGPT should not invent repository state when GitHub can be inspected directly.

For repository-dependent decisions, inspect the current canonical repository first.

ChatGPT Work

ChatGPT Work is the non-canonical UX and interaction laboratory.

Use Work for:

• visual experiments
• interaction experiments
• mobile UX exploration
• responsive behavior
• alternative layouts
• shell behavior
• keyboard behavior
• app navigation experiments
• information hierarchy
• UI depth and polish
• visual prototypes
• experimental Sites
• comparing multiple UX approaches
• investigating live GitHub Pages behavior

Work may deliberately move faster and be more experimental than the production codebase.

Work must not define canonical game architecture.

Work output should be treated as evidence and design exploration, not as production source code.

Preferred Work flow:

```text
Canonical Synthesis
        ↓
Inspect / reproduce
        ↓
Experiment
        ↓
Compare alternatives
        ↓
Choose recommendation
        ↓
Implementation Handoff
        ↓
Human review
```

Do not copy a large Work-generated HTML/CSS prototype wholesale into Synthesis.

Extract the approved behavior and implement it cleanly in the existing architecture.

Codex

Codex owns canonical implementation.

Use Codex for:

• production code
• game architecture
• domain models
• game state
• gameplay systems
• refactors
• multi-file changes
• tests
• dependency changes
• CI changes
• repository structure
• implementation hardening
• branches and pull requests

Codex tasks should normally:

1. identify the exact existing branch or requested new branch
2. define the objective
3. define architectural constraints
4. define explicit exclusions
5. define required tests
6. define completion criteria
7. request a final implementation report

Codex should not be asked to improvise broad UX direction when Work can first explore the problem more cheaply.

Working Copy / Manual Edits

Manual edits are appropriate for genuinely trivial, low-risk changes.

Examples:

• a single CSS value
• one metadata line
• a typo
• a small configuration correction
• a one-line test fix
• a known dependency version adjustment

Prefer Codex when a change affects:

• multiple files
• state
• architecture
• shared responsive behavior
• component structure
• new logic
• test design
• game rules
• persistence
• multiple features

The purpose of manual editing is speed, not bypassing review discipline.

────────

4. Standard Feature Workflow

For gameplay or architecture work:

```text
Idea
  ↓
ChatGPT scope / architecture review
  ↓
Codex task
  ↓
Draft PR
  ↓
ChatGPT diff review
  ↓
Hardening if required
  ↓
Tests / build
  ↓
Merge
  ↓
GitHub Pages
  ↓
Real-device validation
```

Do not merge because the implementation merely looks plausible.

Review the actual diff.

────────

5. Standard UX Workflow

For visual, interaction, or mobile problems:

```text
Observed UX problem
        ↓
ChatGPT defines experiment scope
        ↓
Work UX Lab
        ↓
Interactive prototype
        ↓
Implementation Handoff
        ↓
ChatGPT reviews recommendation
        ↓
Decision
   ┌────┴────┐
   │         │
Manual     Codex
small       non-trivial
change      implementation
   │         │
   └────┬────┘
        ↓
GitHub
        ↓
Pages deployment
        ↓
Real-device validation
```

Work should solve the experience.

Codex should solve the production implementation.

────────

6. Work Implementation Handoff Contract

A useful Work experiment should finish with an implementation handoff containing:

Observed problem

What is wrong in the current canonical build?

Root cause

What is confirmed, and what remains a hypothesis?

Experiments

What alternatives were tested?

Recommended behavior

What should the user experience actually do?

Shared changes

Which changes belong to the generic shell or shared UI?

Feature-specific changes

Which changes belong only to the feature being tested?

Concrete implementation delta

Reference current files, components, selectors, or interfaces where possible.

Acceptance criteria

Define observable pass/fail behavior.

Limitations

Document browser, platform, or implementation constraints that should not be fought unnecessarily.

Experimental artifact

Leave the best prototype inspectable when possible.

The handoff should describe behavior and implementation intent.

It should not require copying the prototype wholesale.

────────

7. Architectural Rules

Domain is not UI

Pure game-domain code must not depend on:

• React
• shell navigation
• app components
• DOM APIs
• browser storage

Shell is not Game State

Opening Terminal, Wallet, Network, or another app is UI navigation.

It should not mutate canonical game-domain state.

UI is not Gameplay Logic

Two interfaces performing the same gameplay operation must eventually call the same underlying game logic.

Example:

```text
Terminal command ─┐
                  ├──> Network scan action
Network UI ───────┘
```

Do not implement duplicate scan behavior in Terminal and Network.

Entity identity is stable

Visible or mutable identifiers are not canonical identity.

Examples:

• IP address
• hostname
• display name
• wallet address

Future entities should use stable internal IDs.

State should grow by domain

Prefer new state slices/modules over continuously expanding one giant player object.

External systems stay at the boundary

Future external services such as:

• authentication
• multiplayer services
• analytics
• cloud saves
• external economy systems
• blockchain integrations

must not become direct dependencies of pure game-domain logic.

Avoid architecture without a current requirement

Do not add:

• plugin frameworks
• event buses
• dependency injection frameworks
• generic game engines
• ECS
• generic persistence frameworks

unless an actual implemented system creates a demonstrated need.

────────

8. Current Interface Architecture Direction

Synthesis currently presents a fictional in-game operating system.

Project:

Synthesis

Current in-game OS working name:

NODE-OS

These identities must remain separate.

The current core app set is:

• Terminal
• Network
• Wallet
• Notes
• Files
• System

Adding a new UI app should not require changing the pure game-domain model merely because the app exists.

────────

9. Mobile-First Rule

Mobile is a first-class target.

Every meaningful UI change should eventually be validated on a real phone.

Important mobile concerns include:

• viewport stability
• safe areas
• software keyboard behavior
• touch targets
• horizontal overflow
• app navigation
• scrolling ownership
• input focus
• Safari behavior
• readable but dense typography

Passing desktop screenshots is not sufficient evidence of good mobile UX.

GitHub Pages is the canonical live validation environment.

────────

10. CI and Deployment Rule

The canonical pipeline should remain:

```text
main
 ↓
Install dependencies
 ↓
Tests
 ↓
Production build
 ↓
GitHub Pages deployment
 ↓
Live validation
```

A failed test or build blocks deployment.

Do not weaken tests merely to make Pages green.

Fix the underlying problem.

When a lockfile is available and trusted, prefer deterministic dependency installation such as npm ci.

────────

11. Pull Request Discipline

Prefer focused PRs.

A PR should answer one clear question.

Examples:

Good:

• mobile keyboard behavior
• first Network scan mechanic
• Wallet state transition
• persistence layer for savegames
• CI hardening

Avoid combining:

• gameplay feature
• visual redesign
• unrelated dependency upgrades
• architecture rewrite
• documentation overhaul

unless they are genuinely inseparable.

Every significant PR should be reviewed against:

• scope
• architecture
• tests
• unintended coupling
• documentation accuracy
• mobile impact where relevant

────────

12. Future-System Rule

Synthesis may eventually contain systems that are currently unknown.

Possible directions may include:

• simulated networks
• player discovery
• causal traces
• malware
• mining
• hardware progression
• missions
• organizations
• multiplayer
• multiple forms of in-game value
• external integrations

These possibilities justify clean boundaries.

They do not justify implementing placeholder systems today.

Build for the next real requirement while preserving obvious seams for growth.

────────

13. Decision Rule: Manual vs Work vs Codex

Use this quick decision model:

```text
Is this primarily a UX/design question?
        │
       yes
        ↓
      Work
        │
        ↓
Review recommendation
        │
        ├── tiny implementation → Manual
        │
        └── non-trivial implementation → Codex


Is this primarily architecture/game logic/repository work?
        │
       yes
        ↓
      Codex


Is it a tiny known correction with no meaningful architecture impact?
        │
       yes
        ↓
     Manual
```

If uncertain, prefer reviewing the problem with ChatGPT before implementation.

────────

14. Anti-Drift Checklist

Before starting a significant task, ask:

1. What exact problem are we solving?
2. Is this canonical implementation or experimentation?
3. Which tool owns this kind of work?
4. Does the current repository already provide a boundary for it?
5. Are we duplicating existing logic?
6. Are we introducing architecture only for hypothetical future use?
7. What is explicitly out of scope?
8. How will the result be tested?
9. Does this affect mobile behavior?
10. What evidence is required before merge?

If these questions are unclear, define the task more narrowly before coding.

────────

15. Documentation Ownership

Use repository documentation for stable project knowledge.

Recommended responsibilities:

```text
README.md
→ project entry point and setup

docs/V0.md
→ current implemented game scope

docs/FUTURE.md
→ confirmed future directions

docs/ARCHITECTURE.md
→ canonical architectural boundaries

docs/HANDBOOK.md
→ development process, tool roles, review discipline
```

Do not turn HANDBOOK.md into a gameplay specification.

Do not turn FUTURE.md into an implementation contract.

Keep each document responsible for one kind of truth.

────────

16. Final Rule

Prototype aggressively. Integrate conservatively.

Work may explore freely.

Codex may implement deeply.

GitHub remains canonical.

Every experimental idea must cross an explicit review boundary before becoming part of Synthesis.
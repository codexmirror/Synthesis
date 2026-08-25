# Synthesis Development Handbook

Status: Accepted
Scope: Development workflow, participant and tool roles, agent selection,
review, validation, delivery, integration, and parallel-work discipline.

It does not define:

- current gameplay implementation
- durable game architecture
- future product scope
- feature-specific design
- a requested implementation delta

Those concerns belong to their owning documents.


## 1. Documentation ownership

Use repository documentation according to its responsibility.

| Source | Owns |
| — | — |
| `README.md` | Project entry point, setup, and documentation navigation |
| `AGENTS.md` | Repository-wide implementation-agent contract |
| `docs/README.md` | Documentation portal: task classification and Read Set routing |
| `docs/current/...` | Detailed current implemented truth, per domain |
| `docs/V0.md` | Non-exhaustive current product snapshot and index |
| `docs/ARCHITECTURE.md` | Architecture index, invariant register, repository boundaries |
| `docs/architecture/...` | The durable invariants themselves (A01–A18) |
| `docs/FUTURE.md` | Long-term product and simulation direction |
| `docs/HANDBOOK.md` | Development workflow, roles, review, and integration discipline |
| `docs/design/...` | Feature-specific design contracts and references |
| `docs/work-orders/...` | Planned implementation deltas selected by the human operator |

Every accepted fact has one normative owner. Other documents may summarize,
index or route to that fact; they must not become competing normative
definitions.

Where a detailed statement in `docs/V0.md` differs from a `docs/current/...`
owner, the domain owner wins for that detail.

Examples:

```text
„What gameplay exists today, in detail?“
→ docs/current/<domain>.md

„What does Synthesis contain, at product level?“
→ docs/V0.md

„What architecture must remain true?“
→ docs/ARCHITECTURE.md → the owning module

„What should the implementation agent do in this task?“
→ selected work order

„How do we review and integrate the result?“
→ docs/HANDBOOK.md
```

Do not duplicate current feature-completeness lists in this handbook.

Do not duplicate the complete architecture invariant set in this handbook.

Do not implement future ideas merely because they are documented in
`docs/FUTURE.md`.


## 2. Repository truth and precedence

The `codexmirror/Synthesis` repository is canonical.

Accepted `main` is the canonical repository state.

Before repository-dependent work, inspect current `main` rather than relying on:

- an older prompt
- a previous branch
- a screenshot
- an old conversation
- a local experiment
- a stale work order assumption

For implementation work:

```text
CURRENT ACCEPTED CODE
        +
docs/current/<domain>.md
        ↓
CURRENT BASELINE

AGENTS.md
        +
docs/ARCHITECTURE.md (and the module owning the invariant)
        ↓
DURABLE CONSTRAINTS

EXPLICITLY SELECTED WORK ORDER
        ↓
REQUESTED DELTA
```

`docs/FUTURE.md` supplies direction and context only unless a selected work
order explicitly implements part of it.

Relevant files under `docs/design/` provide design authority when the selected
task depends on them.

If current code, owning documentation, and the selected work order appear to
contradict one another, inspect the repository and report the conflict rather
than silently choosing an interpretation.

A work order asking current code to change is not itself a contradiction.


## 3. Context discipline

The default is the **smallest sufficient Read Set**, resolved through
`docs/README.md`. An implementation agent reads the normative current owner for
its domain plus only the architecture and design contracts the task depends on.

Read Sets are not a fixed size. Read what the task needs; do not read the whole
documentation tree by default, and do not read `docs/FUTURE.md` as
implementation context.

**Broad-audit exception.** A repository or knowledge audit — restructuring
documentation, auditing ownership, reconciling drift — legitimately requires
broad inspection of the accepted knowledge landscape. Such a task should say so
explicitly, and the resulting report should state what was inspected.


## 4. Human operator

The human operator owns final repository and product acceptance.

Unless explicitly delegating a specific action, the human operator controls:

- milestone selection
- work-order selection
- branch decisions
- commits
- pushes
- pull requests
- merges
- final acceptance

The operator may use manual edits for small, known, low-risk corrections.

Manual edits are held to the same documentation and review standards as
agent-generated changes.


## 5. Planning and review layer

ChatGPT is primarily the coordination, planning, and review layer.

Typical responsibilities include:

- product reasoning
- architecture discussion
- task decomposition
- repository review
- diff review
- design review
- physical-device evidence interpretation
- work-order preparation and hardening
- acceptance recommendations

Prototyping and exploration tools may be used for:

- UX exploration
- interaction experiments
- visual and implementation prototypes
- reference implementations
- exact implementation exports or patches
- design handoffs

Experimental output is not canonical merely because it exists.

A tested implementation may become canonical after review and integration.


## 6. Implementation agents

Codex and Claude Code may be used as repository implementation agents.

Typical responsibilities include:

- inspecting current repository state
- reading the selected sources of truth
- implementing the requested delta
- adapting the work order to current repository reality
- adding or updating focused tests
- running required validation
- resolving documentation impact
- inspecting the final diff
- reporting completion and remaining concerns

For exact implementation-agent rules, prohibitions, repository boundaries, and
validation expectations, `AGENTS.md` is authoritative. `CLAUDE.md` is a thin
Claude-Code-specific adapter onto that same contract and does not restate it.

Neither implementation agent gains Git lifecycle authority merely by being
asked to implement a task. Delivery is delegated per task, in the work order's
DELIVERY section.


## 7. Agent selection

Two things must stay separate: the **stable selection principle**, which
depends on the character of the problem, and the **current tooling profile**,
which depends on what today's agents happen to do well. Tool capabilities
change; the principle should not become wrong when they do.

### Stable selection principle

```text
KNOWN TARGET / DETERMINISTIC EXECUTION
→ Codex

BOUNDED JUDGMENT
→ Sonnet-class model where appropriate

SUBSTANTIAL PRODUCT / UX / ARCHITECTURAL JUDGMENT
→ Opus-class model
```

The question is how much open judgment the task requires, not how large the
diff is.

### Current tooling profile

This section describes current Synthesis practice and is expected to change as
agent harnesses improve.

**Codex is currently preferred for:**

- deterministic repository implementation
- concrete `GameState` mechanics
- narrow hardening
- tests
- straightforward refactors
- known-pattern presentation work

Codex tasks are not currently planned around live browser / Web-App
verification.

**Claude Code is currently preferred for:**

- substantial product / UX judgment
- information architecture
- larger React / CSS interaction work
- browser-interactive validation where useful

For meaningful Claude UX work, the current preferred sequence is:

```text
IMPLEMENT
→ launch the actual Web App
→ exercise the changed flow interactively
→ inspect rendered behavior
→ fix discovered issues
→ Draft PR
```

### Two kinds of validation

```text
AGENT INTERACTIVE VALIDATION
≠
PHYSICAL PRODUCTION VALIDATION
```

Agent interactive validation happens before the Draft PR and catches rendered
behavior problems automated tests miss. Physical iPhone/Safari validation is
distinct, final, and happens against the deployed result (see §12).


## 8. Work-order execution

Work orders are planned implementation deltas. They are not current
implementation truth. A work order becomes executable only when the human
operator explicitly selects it.

Before implementation:

1. inspect current `main`
2. read `AGENTS.md`
3. classify the task domain in `docs/README.md`
4. resolve the smallest sufficient Read Set
5. read the normative current owner for that domain
6. read only the relevant architecture invariants and design contracts
7. read the selected work order
8. inspect the relevant implementation and focused tests

A selected work order must be re-checked against the current repository before
execution.

Its structure and required sections belong to
`docs/work-orders/TEMPLATE.md`; its lifecycle belongs to
`docs/work-orders/README.md`.


## 9. Implementation handoffs

A handoff may describe either behavior/design or an exact implementation.

### Behavior or design handoff

Include when relevant:

- observed problem
- evidence
- selected behavior
- alternatives considered
- acceptance criteria
- affected boundaries
- mobile/browser constraints
- explicit exclusions

### Exact implementation handoff

When a tested implementation already exists, include:

- exact files or patch
- known base
- changed-file manifest
- validation results
- deviations or unresolved concerns

Integration should preserve the tested implementation unless current repository
reality requires a justified adaptation.

Do not recreate an approved exact implementation from a loose prose summary
without reason.


## 10. Validation

Normal code changes use the repository's required validation commands:

```bash
npm test
npm run build
```

Documentation changes additionally run:

```bash
npm run docs:check
```

A required failing test, build, or check blocks acceptance.

Do not:

- weaken a meaningful test merely to make it pass
- remove architecture-contract coverage because new code conflicts with it
- replace behavioral tests with weaker literal assertions
- hide regressions behind changed snapshots or expectations

Prefer tests that prove source-of-truth behavior.

For example, if a UI value must derive from canonical state, an altered-state
test is stronger than a test that only asserts the default literal value.

A pull request targeting `main` automatically runs `npm run docs:check`,
`npm test`, and `npm run build` via GitHub Actions before human merge. This
automated check
does not deploy GitHub Pages and does not replace diff review, behavior
review, or human acceptance.

`docs:check` is mechanical only. It verifies structure — link resolution,
ownership registration, unique architecture IDs, required status headers — and
deliberately makes no judgment about whether documentation impact was resolved
correctly. That remains an agent and reviewer responsibility.


## 11. Mobile validation

Mobile is a first-class product target.

Meaningful mobile interaction changes should be reviewed for:

- viewport stability
- safe areas
- software-keyboard behavior
- touch targets
- overflow
- scrolling ownership
- navigation
- focus behavior
- readable density

Automated tests, desktop emulation, and agent interactive validation are useful
but do not replace physical iPhone/Safari validation for meaningful interaction
changes.

The established Shell-owned Editing presentation should be preserved unless a
selected task intentionally changes that contract.

Detailed implementation-agent mobile constraints belong to `AGENTS.md` and the
relevant source/tests rather than being duplicated here.


## 12. Standard implementation flow

This is the actual current flow, including the fact that deployment happens
from `main`:

```text
IDEA / PROBLEM
↓
human + planning/review layer reason from CURRENT MAIN
↓
classify domain
↓
resolve smallest sufficient Read Set
↓
define smallest coherent slice
↓
select implementation agent
↓
implement
↓
tests / build
↓
documentation impact resolved in the same branch
↓
agent final-diff self-review
↓
Draft PR
↓
actual diff review
↓
CI
↓
human merge
↓
main deploy
↓
physical iPhone/Safari live test when relevant
↓
PASS
or
small follow-up hardening PR
```

Physical production validation therefore happens **after** merge, because the
deployed environment is produced from `main`. Do not claim otherwise in a work
order or completion report. When physical validation fails, the correction is a
small follow-up hardening PR, not an unreviewed direct fix.


## 13. Review

Review the actual result, not merely the implementation report.

For a meaningful change, review:

1. requested scope
2. explicit non-goals
3. complete changed-file set
4. relevant code paths
5. source-of-truth ownership
6. architecture compatibility
7. test coverage
8. exact validation results
9. mobile behavior where relevant
10. documentation impact
11. accidental scope expansion
12. speculative abstractions
13. dead or compatibility-only code
14. remaining human-review concerns

Green tests are necessary but do not by themselves prove that a task was
implemented correctly.


## 14. Documentation impact

**No draft is complete until documentation impact is explicitly resolved.**

This does not mean every change requires editing every document. Update only
the document that owns the changed truth.

Resolve each line explicitly — a concrete owner, or `None` with a concrete
reason:

```text
current implementation changed
→ docs/current/<domain>.md
  (and docs/V0.md only when the product-level snapshot itself became wrong)

durable architecture changed
→ docs/architecture/<module>.md
  (and docs/ARCHITECTURE.md when the invariant register changed)

future direction changed
→ docs/FUTURE.md

workflow or review process changed
→ docs/HANDBOOK.md

implementation-agent contract changed
→ AGENTS.md

feature-specific design changed
→ docs/design/...

planned requested delta changed
→ docs/work-orders/...
```

`README.md` should change only when project entry information, setup,
technology, or documentation navigation changes.

`docs/README.md` changes when a new domain owner appears or a route's Read Set
changes — never to record a fact.

Do not copy a new fact into several documents merely because multiple readers
might find it useful. Link to or reference the owning source instead.


## 15. Parallel work

The default shape is independent branches from accepted `main`:

```text
ACCEPTED CURRENT MAIN
├── Task A
└── Task B
```

Each parallel task should declare, in its work order:

- expected domain and files
- tasks it must not run in parallel with
- dependency assumptions (which accepted `main` it was written against)

Avoid accidental stacked PRs unless stacking is explicitly intended.

If Task A merges first:

```text
TASK A MERGED
↓
update / rebase Task B onto the new accepted main
↓
validate again
↓
review
↓
merge
```

Do not execute multiple dependent work orders in parallel when later work
depends on acceptance of earlier work. Prefer:

```text
WORK ORDER A
    ↓
IMPLEMENT
    ↓
VALIDATE
    ↓
REVIEW
    ↓
ACCEPT / MERGE
    ↓
RE-READ NEW MAIN
    ↓
WORK ORDER B
```

over stacking several planned architecture slices onto an unaccepted base.

Documentation-structure migrations are a special case: do not run two of them
in parallel. Feature work may proceed elsewhere, but its documentation delta
must be reconciled against the new structure after the migration lands.


## 16. Acceptance and integration

After implementation:

```text
IMPLEMENTATION
      ↓
AUTOMATED + AGENT / BROWSER INTERACTIVE VALIDATION
      ↓
DIFF REVIEW
      ↓
DOCUMENTATION CHECK
      ↓
DRAFT PR / CI / HUMAN ACCEPTANCE
      ↓
HUMAN MERGE
      ↓
MAIN DEPLOY
      ↓
PHYSICAL PRODUCTION IPHONE / SAFARI VALIDATION WHEN RELEVANT
```

Agent or browser interactive validation may happen before the Draft PR and
merge. It is not physical production-device validation, which follows merge and
deployment from `main` in the current workflow.

After a merge, dependent future work must treat the new `main` as the baseline.

Do not assume that a previously prepared work order still matches the repository
without re-checking it.


## 17. Completion reporting

Implementation work should finish with a concise report containing:

- files changed
- important implementation decisions
- tests added or changed
- exact test result
- exact production build result
- documentation impact
- deviations from requested scope
- unresolved conflicts and concerns requiring human review

For meaningful mobile work, state whether physical iPhone/Safari validation has
or has not been completed.


## 18. Anti-drift rule

The repository should not require routine updates to many Markdown files for one
ordinary feature change.

The intended model is:

```text
ONE KIND OF TRUTH
      ↓
ONE PRIMARY OWNER
      ↓
OTHER DOCUMENTS REFERENCE IT
```

If a normal gameplay feature requires editing README, AGENTS, V0, Architecture,
Future, Handbook, multiple design documents, and several work orders merely to
keep identical statements synchronized, documentation ownership has probably
become unclear.

Fix the ownership problem instead of normalizing the duplication.

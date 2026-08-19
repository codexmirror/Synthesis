# Synthesis Development Handbook

This handbook defines the development workflow, participant roles, review
process, and integration discipline for Synthesis.

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
| `docs/V0.md` | Current implemented product truth |
| `docs/ARCHITECTURE.md` | Durable architectural boundaries and invariants |
| `docs/FUTURE.md` | Long-term product and simulation direction |
| `docs/HANDBOOK.md` | Development workflow, roles, review, and integration discipline |
| `docs/design/...` | Feature-specific design contracts and references |
| `docs/work-orders/...` | Planned implementation deltas selected by the human operator |

A volatile fact should have one owning document.

Other documents may reference that fact, but they should not maintain competing
copies when a link or ownership statement is sufficient.

Examples:

```text
„What gameplay exists today?“
→ docs/V0.md

„What architecture must remain true?“
→ docs/ARCHITECTURE.md

„What should Codex implement in this task?“
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
docs/V0.md
        ↓
CURRENT BASELINE

AGENTS.md
        +
docs/ARCHITECTURE.md
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


## 3. Human operator

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


## 4. ChatGPT and Work

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

Work may be used for:

- UX exploration
- interaction experiments
- visual and implementation prototypes
- reference implementations
- exact implementation exports or patches
- design handoffs

Experimental output is not canonical merely because it exists.

A tested implementation may become canonical after review and integration.


## 5. Codex

Codex is the repository implementation agent.

Typical responsibilities include:

- inspecting current repository state
- reading the selected sources of truth
- implementing the requested delta
- adapting the work order to current repository reality
- adding or updating focused tests
- running required validation
- checking documentation impact
- inspecting the final diff
- reporting completion and remaining concerns

For exact implementation-agent rules, prohibitions, repository boundaries, and
validation expectations, `AGENTS.md` is authoritative.

Codex does not gain Git lifecycle authority merely by being asked to implement a
task.


## 6. Work-order execution

Work orders are planned implementation deltas.

They are not current implementation truth.

A work order becomes executable only when the human operator explicitly selects
it.

Before implementation:

1. inspect current `main`
2. read `AGENTS.md`
3. read `docs/ARCHITECTURE.md`
4. read `docs/V0.md`
5. read the selected work order
6. read any design or additional files named by that work order
7. inspect the relevant implementation and tests

A selected work order must be re-checked against the current repository before
execution.

Do not execute multiple dependent work orders in parallel when later work
depends on acceptance of earlier work.

Prefer:

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


## 7. Implementation handoffs

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


## 8. Validation

Normal code changes use the repository’s required validation commands:

```bash
npm test
npm run build
```

A required failing test or build blocks acceptance.

Do not:

- weaken a meaningful test merely to make it pass
- remove architecture-contract coverage because new code conflicts with it
- replace behavioral tests with weaker literal assertions
- hide regressions behind changed snapshots or expectations

Prefer tests that prove source-of-truth behavior.

For example, if a UI value must derive from canonical state, an altered-state
test is stronger than a test that only asserts the default literal value.


## 9. Mobile validation

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

Automated tests and desktop emulation are useful but do not replace physical
iPhone/Safari validation for meaningful interaction changes.

The established Shell-owned Editing presentation should be preserved unless a
selected task intentionally changes that contract.

Detailed implementation-agent mobile constraints belong to `AGENTS.md` and the
relevant source/tests rather than being duplicated here.


## 10. Review

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


## 11. Documentation impact

Every significant change requires a documentation impact check.

This does not mean every change requires editing every document.

Update only the document that owns the changed truth.

Use:

```text
current implementation changed
→ docs/V0.md

durable architecture changed
→ docs/ARCHITECTURE.md

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

Do not copy a new fact into several documents merely because multiple readers
might find it useful.

Link to or reference the owning source instead.


## 12. Acceptance and integration

After implementation:

```text
IMPLEMENTATION
      ↓
VALIDATION
      ↓
DIFF REVIEW
      ↓
BEHAVIOR / DEVICE REVIEW WHEN NEEDED
      ↓
DOCUMENTATION CHECK
      ↓
HUMAN ACCEPTANCE
      ↓
GIT LIFECYCLE
      ↓
NEW MAIN
```

After a merge, dependent future work must treat the new `main` as the baseline.

Do not assume that a previously prepared work order still matches the repository
without re-checking it.


## 13. Completion reporting

Implementation work should finish with a concise report containing:

- files changed
- important implementation decisions
- tests added or changed
- exact test result
- exact production build result
- documentation impact
- deviations from requested scope
- unresolved concerns requiring human review

For meaningful mobile work, state whether physical iPhone/Safari validation has
or has not been completed.


## 14. Anti-drift rule

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
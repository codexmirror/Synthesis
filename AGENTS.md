Synthesis Agent Guide

This file is the repository-wide bootloader and execution contract for
implementation agents.

It routes agents to repository truth instead of restating that truth.
docs/README.md is the documentation portal. docs/HANDBOOK.md owns the
development workflow. docs/ARCHITECTURE.md routes to durable architecture
invariants.

Start here

Before editing:

1. Inspect current main.
2. Read this file.
3. Classify the task through docs/README.md.
4. Resolve the smallest sufficient Read Set.
5. Read the normative docs/current/... owner for the affected domain.
6. Read only the architecture modules and accepted design contracts the task
    actually depends on.
7. Read the selected work order when the task is backed by one.
8. Inspect the relevant implementation and focused tests.

Do not read the entire documentation tree by default.

Do not read docs/FUTURE.md, unrelated domains, or historical work orders as
implementation context unless the task specifically requires them.

Repository and knowledge audits are explicit exceptions.

Authority

CURRENT BASELINE
= accepted current code/tests + owning docs/current domain document
DURABLE CONSTRAINTS
= this file + docs/ARCHITECTURE.md + applicable architecture module
REQUESTED DELTA
= explicitly selected work order or direct implementation task
ACTIVE DESIGN AUTHORITY
= applicable Accepted design contract
FUTURE DIRECTION
= docs/FUTURE.md

Future direction is not current implementation authority.

A requested change differing from current code is not itself a conflict.

If current code, owning documentation, architecture, and the requested task
materially contradict one another, inspect the repository and surface the
conflict rather than silently inventing a workaround.

Architecture

Preserve the applicable invariants routed through docs/ARCHITECTURE.md.

In particular, do not casually collapse established boundaries around stable
identity, canonical state ownership, World Truth versus Player Information,
Device / Firmware / Software / Access / Session, shared gameplay operations,
Processes, Device-owned filesystem truth, or canonical economy state.

Read the owning architecture module when the task touches one of those
boundaries. Do not rely on this summary as a substitute for it.

Pure simulation logic in src/core/game/ remains independent of React, DOM
APIs, browser storage, Shell navigation, CSS, and viewport behavior.

Player-facing technical information must derive from represented state. Do not
invent fake telemetry, logs, security state, activity, uptime, filesystem
content, or similar gameplay truth for atmosphere.

Implementation discipline

Implement the smallest coherent delta that satisfies the task.

Do not expand scope because adjacent work looks useful.

Prefer existing owners and abstractions before introducing new ones.

Avoid speculative generic frameworks, registries, engines, event buses,
dependency-injection systems, universal entity models, or other abstractions
without a concrete current need.

When canonical GameState shape changes, follow the repository’s current
schema-version convention and update the affected focused tests.

Do not add an external dependency when the current stack can reasonably solve
the task.

For meaningful mobile interaction work, read the applicable interface /
presentation architecture and preserve the established Shell-owned mobile
editing model unless the task explicitly changes it.

Validation

Validation is incremental and proportional.

During implementation:

1. run the focused tests covering the changed behavior;
2. run closely related regression tests where the dependency surface requires
    them;
3. fix failures with the smallest relevant test set; and
4. broaden validation only when a concrete dependency surface justifies it.

Pull-request CI owns repository-wide full-suite validation by default.

Do not use npm test as an iterative debugging or routine local-validation
command.

A local full-suite run is exceptional. Run it only after focused and related
validation is green and only when concrete repository-wide regression risk
makes it materially useful. Do not repeatedly rerun the full suite after
individual fixes; validate those fixes with the affected suites and let PR CI
perform the final repository-wide run.

Run:

npm run build

when the change can affect TypeScript compilation, application wiring,
bundling, or production output. Normally run it once after the implementation
is structurally stable.

npm run build already performs TypeScript project validation. Do not add a
separate tsc -b merely for redundancy.

When documentation changes, run:

npm run docs:check

Documentation-only changes do not require unrelated runtime tests or a
production build.

Once a relevant suite, build, or check has passed, rerun it only when subsequent
changes could materially invalidate that result.

Do not weaken meaningful tests, remove architecture-contract coverage to obtain
green output, or hide regressions behind weaker expectations or snapshots.

A failing required focused test, build, or documentation check blocks delivery.
A failing repository-wide CI check blocks acceptance.

Documentation impact

Before delivery, inspect the actual final diff and reconcile documentation from
the semantic change that was implemented.

Distinguish:

* Owner impact — normative truth changed.
* Reference impact — a summary, route, index, or cross-reference became
    stale or misleading.

Update only the documents whose owned truth or references actually changed.

Report Owner impact and Reference impact separately. Do not create documentation
churn merely because code files changed.

Git and delivery

The human operator owns final acceptance and merge authority.

When delivery is explicitly delegated, the normal implementation-agent
delivery is:

* create or use the task branch;
* commit the implementation;
* push the branch; and
* create or update a Draft Pull Request.

Merge, force-push, destructive history rewrite, and final acceptance are not
delegated by default.

Completion report

Finish with a concise report containing:

* files changed;
* important implementation or architecture decisions;
* exact validation performed and results;
* documentation Owner impact and Reference impact;
* deviations from requested scope, if any; and
* unresolved conflicts or concrete concerns.

Do not perform additional work or validation solely to make the completion
report larger.

For meaningful mobile UI work, state whether physical iPhone/Safari validation
has been performed.
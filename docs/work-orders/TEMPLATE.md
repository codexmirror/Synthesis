# WORK ORDER TEMPLATE

Status: Accepted
Scope: Structure and scope discipline for Synthesis implementation work orders.

A work order describes one requested delta. It does not restate repository
architecture, workflow, or general agent rules already owned elsewhere.

Keep it short and high-information-density.

Before writing the work order, apply the scope gate in `docs/HANDBOOK.md`:

- one primary outcome;
- one main reviewer question;
- one coherent dependency radius; and
- no independently reviewable prerequisite or follow-up bundled into the same
  implementation session.

If the task fails that gate, split it before writing the work order.

Large file counts, several independently substantial domains, or well beyond a
few hundred expected changed lines are warning signs rather than automatic
failure. Preserve a larger slice only when its parts genuinely need to become
true together.

Do not keep work monolithic merely because every change belongs to the same
feature name.

---

## TITLE

`<SHORT NAME> V<n>`

Status: Planned | Selected | Completed | Superseded

## TASK

One short paragraph describing the concrete outcome.

State what this task is not when the title could imply a broader redesign.

## WHY

Only the product, architectural, or regression reason needed to understand why
this delta exists.

## INSPECT FIRST

Reference the smallest sufficient Read Set through `docs/README.md`.

Name specific repository owners, code paths, or focused tests only when doing so
materially improves execution.

Do not paste repository documentation into the work order.

Repository truth overrides assumptions in this work order. Surface a material
conflict instead of silently inventing a workaround.

## REQUIRED BEHAVIOR

State the observable behavior and semantic requirements that must become true.

Prefer outcomes and invariants over prescribed implementation structure.

## CONSTRAINTS

Include only task-specific guardrails whose violation would materially damage
this slice.

Keep explicit non-goals short. Do not repeat the repository constitution.

## ACCEPTANCE

List the concrete conditions a reviewer must be able to verify from the result.

Acceptance should answer one main question: did this work order’s requested
delta become true without violating its boundaries?

## VALIDATION

Name the focused tests and closely related regressions when known.

Use focused validation during implementation.

Run `npm run build` when compilation, application wiring, bundling, or production
output can be affected.

Run `npm run docs:check` when documentation changes.

Do not require `npm test` as routine agent-local validation. Repository-wide
full-suite validation is owned by PR CI by default.

If a local full-suite run is exceptionally justified, perform it only after
focused validation is green and do not turn failures into repeated full-suite
reruns.

Do not duplicate `tsc -b` when `npm run build` already supplies the required
TypeScript validation.

## DOCUMENTATION IMPACT

Record expected impact compactly:

- Owner impact: `<document(s)>` or `None`
- Reference impact: `<document(s)>` or `None`

This is provisional. Final documentation impact must be reconciled from the
actual completed diff before delivery.

## DELIVERY

Unless this task explicitly says otherwise:

- implement the selected delta;
- verify it proportionally;
- inspect the final diff;
- reconcile documentation impact;
- commit and push the task branch; and
- create or update a Draft Pull Request.

The Draft PR report should be concise: what changed, important decisions,
validation performed, final Owner/Reference documentation impact, and any
material concern or intentional deferral.

Merge, force-push, destructive history rewrite, and final acceptance remain with
the human operator.

Add a `PARALLEL WORK CONSTRAINTS` section only when this task has a real
dependency or conflict with concurrent work.
# WORK ORDER TEMPLATE

Status: Accepted
Scope: The required structure of a Synthesis work order.

Copy the structure below into a new work order. Delete sections that genuinely
do not apply; do not leave empty headings.

A work order names the delta. It does not restate the repository constitution:
`AGENTS.md` and `docs/ARCHITECTURE.md` already bind every implementation agent.
Repeat a rule only where violating it would destroy this specific slice.

---

## TITLE

`<SHORT NAME> V<n>`

Status: Planned | Selected | Completed | Superseded

## TASK

One paragraph: the concrete change requested. State what this is *not* if the
title could be read as a larger redesign.

## WHY

The observed problem or product reason. Evidence where it exists.

## INSPECT FIRST / READ SET

The smallest sufficient Read Set for this task, resolved from
`docs/README.md`:

- CURRENT TRUTH → `docs/current/<domain>.md`
- ARCHITECTURE → only the invariant IDs / modules this task depends on
- DESIGN → only the accepted contracts this task depends on
- CODE → the primary implementation paths
- TESTS → the focused suites that will change

Do not list the whole documentation tree. Do not paste architecture prose here.

## SOURCE OF TRUTH

Which document or code is authoritative where this task touches contested
ground, and what wins if they disagree.

## REQUIRED BEHAVIOR

The concrete behavior the implementation must produce, in terms of represented
state and player-visible result.

## CONSTRAINTS

Task-specific guardrails, including any high-risk rule whose violation would
destroy this slice (for example: "a transfer must not become a GameProcess").
Explicit non-goals belong here.

## ACCEPTANCE

Observable conditions that make this slice done. Written so a reviewer can
check them against the diff and the running app.

## VALIDATION

```bash
npm test
npm run build
```

Plus `npm run docs:check` when documentation changed, and any focused suite or
interactive check this task requires.

## DOCUMENTATION IMPACT

Resolve every line — either a concrete owner to update in this branch, or
`None` with a concrete reason:

- Current truth:
- Architecture:
- Design:
- Workflow:
- Future:

## PARALLEL WORK CONSTRAINTS

- Expected domain and files this task touches
- Tasks it must not run in parallel with
- Dependency assumptions (what accepted `main` this is written against)

## DELIVERY

State exactly what is delegated for this task. For a selected implementation
work order the normal delegation is:

- create or use the task branch the environment requires
- commit the task implementation
- push the branch
- create or update a **Draft** pull request

Never delegated by default:

- merge
- force-push or destructive history rewrite
- final acceptance

The human operator remains the final merge and acceptance authority.

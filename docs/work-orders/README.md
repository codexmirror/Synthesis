# Work Orders

Status: Accepted
Scope: The work-order lifecycle, execution authority, and where work orders sit
relative to repository truth.

This directory contains planned implementation work orders for Synthesis.

Work orders describe intended future changes. They are not current
implementation truth.

Use [`TEMPLATE.md`](TEMPLATE.md) when writing a new one.


## Lifecycle

```text
PLANNED      written, not selected — forward-looking context only
   ↓
SELECTED     the human operator explicitly selected it for execution
   ↓
COMPLETED    implemented, reviewed, accepted, merged
   ↓
ARCHIVED     moved to archived/ — historical only
```

A work order states its own status in its header (`Status: Planned |
Selected | Completed | Superseded`). Only a work order the human operator has
explicitly selected is executable.

Archived work orders live in [`archived/`](archived/). They are historical
records of what was asked for at the time.

Archived work orders:

- are never current truth;
- are never part of a default Read Set;
- never override current code, current-truth documents, or architecture;
- may be read for the history of a decision, and anything they claim must be
  verified against current `main`.


## Execution authority

`AGENTS.md` and `docs/ARCHITECTURE.md` define durable repository constraints.

Current accepted code and `docs/current/...` define the baseline before a task
begins; `docs/V0.md` gives the product-level snapshot.

When the human operator explicitly selects a work order, that work order defines
the requested delta from the current baseline. It is expected to change current
code and, where appropriate, current documentation.

`docs/FUTURE.md` provides direction and context only. Its contents are not in
scope unless the selected work order explicitly implements them.

If a selected work order conflicts with `AGENTS.md` or
`docs/ARCHITECTURE.md`, stop and report the conflict rather than silently
overriding the durable contract.

If a work order merely differs from current code because it explicitly asks
for that code to change, that is not a conflict.

A work order must be re-checked against current `main` before execution.

Do not implement a work order merely because it exists in this directory.
Only execute one when the human operator explicitly selects it.

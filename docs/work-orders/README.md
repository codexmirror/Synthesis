# Work Orders

This directory contains planned implementation work orders for Synthesis.

Work orders describe intended future changes. They are not current
implementation truth.

## Execution authority

`AGENTS.md` and `docs/ARCHITECTURE.md` define durable repository constraints.

Current accepted code and `docs/V0.md` define the baseline before a task begins.

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

A work order must be re-checked against current main before execution.

Do not implement a work order merely because it exists in this directory.
Only execute one when the human operator explicitly selects it.
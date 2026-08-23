# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Claude Code is one of this repository's implementation agents. This file is a
thin adapter onto the repository's existing agent contract — it does not
redefine or duplicate product, architecture, or workflow truth owned
elsewhere.

## Authority

- `AGENTS.md` is the repository-wide implementation-agent contract and is
  authoritative for implementation-agent behavior, prohibitions, and
  repository boundaries.
- Current accepted `main` is canonical repository truth.
- `docs/V0.md` owns current implementation truth.
- `docs/ARCHITECTURE.md` owns durable architecture invariants.
- `docs/HANDBOOK.md` owns development workflow and participant/tool roles.
- `docs/FUTURE.md` supplies direction only; it is not an implementation
  contract.
- A selected `docs/work-orders/...` file defines only the explicitly
  selected task delta, and does not override `AGENTS.md` or
  `docs/ARCHITECTURE.md`.
- Relevant `docs/design/...` material provides design authority when the
  task depends on it.

## Before implementation

- Inspect current repository state rather than trusting an older prompt,
  branch, or prior conversation.
- Read `AGENTS.md`.
- Read the relevant parts of `docs/V0.md`, `docs/ARCHITECTURE.md`, any
  selected work order, and any referenced design material.
- Inspect the relevant existing implementation and tests.
- If current code, documentation, and the task appear to contradict one
  another, report the conflict rather than silently resolving it.

## Execution

- Implement the smallest requested concrete slice.
- Preserve the source-of-truth boundaries described in `AGENTS.md` and
  `docs/ARCHITECTURE.md`.
- Do not invent speculative frameworks or abstractions the task doesn't
  require.
- Do not silently expand scope beyond what was requested.
- Add or update focused tests for the change.
- Perform a documentation-impact check and update only the document that
  owns the changed truth.

## Validation

- Follow `AGENTS.md` and the repository's own scripts for validation.
- For normal code changes, run `npm test` and `npm run build`; inspect
  `package.json` for other current scripts.
- Inspect the final diff for unrelated changes before reporting completion.

## Completion

Finish with a concise report containing:

- files changed
- important implementation or architecture decisions
- tests added/changed and their exact results
- exact build result
- documentation impact
- deviations from the requested scope, if any
- unresolved concerns requiring human review

## Human control

- The human operator owns final acceptance and the Git lifecycle (branch
  decisions, commits, pushes, PRs, merges) unless a specific Git action is
  explicitly delegated for this task.
- Meaningful mobile interaction changes still require physical iPhone/Safari
  validation before acceptance.

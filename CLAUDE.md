# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

Claude Code is one of this repository's implementation agents. This file is a
thin adapter onto the repository's agent contract. It routes; it never owns
Synthesis product, architecture, gameplay, design, or workflow truth.


## Routing

1. Inspect current `main`.
2. Read [`AGENTS.md`](AGENTS.md) — the repository-wide implementation-agent
   contract, authoritative for agent behavior, prohibitions, and boundaries.
3. Open [`docs/README.md`](docs/README.md) — the documentation portal — and
   resolve the smallest sufficient Read Set for the task's domain.
4. Read the normative current owner (`docs/current/...`) plus only the
   architecture invariants and design contracts the task depends on.
5. Inspect the relevant implementation and focused tests before editing.

Do not read the entire documentation tree by default. Repository or knowledge
audits are an explicit exception.


## Execution

Follow `AGENTS.md`. In particular: implement the smallest requested slice, add
or update focused tests, run the validation `AGENTS.md` requires, and resolve
documentation impact explicitly in the same branch.

If current code, documentation, and the task appear to contradict one another,
report the conflict rather than silently resolving it.


## Human control

The human operator owns final acceptance and the Git lifecycle unless a
specific Git action is explicitly delegated for the task. Meaningful mobile
interaction changes still require physical iPhone/Safari validation before
acceptance.

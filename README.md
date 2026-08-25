# Synthesis

Synthesis is a browser/mobile hacking simulation presented through fictional
operating environments such as NODE-OS.

The project is currently an in-development prototype. For a product-level
overview of what currently exists, see [`docs/V0.md`](docs/V0.md); for detailed
current truth and the documentation portal, start at
[`docs/README.md`](docs/README.md).


## Technology

- React 18
- TypeScript
- Vite
- Vitest
- Testing Library


## Setup

Requires Node.js 18 or newer.

```bash
npm install
```


## Development

```bash
npm run dev
```


## Production build

```bash
npm run build
```


## Tests

```bash
npm test
```


## Documentation checks

```bash
npm run docs:check
```


## Documentation

Start at the documentation portal:

- [`docs/README.md`](docs/README.md)
  - "I am working on X — what should I read?"
  - routes each domain to its normative owner, relevant architecture and design
    contracts, and code/test entry points

Humans: `README.md` → [`docs/README.md`](docs/README.md).

Implementation agents: [`AGENTS.md`](AGENTS.md) → [`docs/README.md`](docs/README.md)
→ the task-specific Read Set.

Ownership at a glance:

- [`AGENTS.md`](AGENTS.md)
  - repository-wide implementation-agent contract
- [`docs/README.md`](docs/README.md)
  - documentation portal and routing
- [`docs/current/`](docs/current/)
  - detailed current implemented truth, per domain
- [`docs/V0.md`](docs/V0.md)
  - non-exhaustive current product snapshot and index
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/architecture/`](docs/architecture/)
  - durable architecture boundaries and invariants
- [`docs/FUTURE.md`](docs/FUTURE.md)
  - long-term direction; not implementation authority
- [`docs/HANDBOOK.md`](docs/HANDBOOK.md)
  - development workflow, tool roles, review, and integration discipline
- [`docs/design/`](docs/design/)
  - feature-specific design contracts and references
- [`docs/work-orders/`](docs/work-orders/)
  - planned implementation deltas
  - executable only after explicit human selection

Do not use this README as a substitute for current implementation,
architecture, or work-order documentation.

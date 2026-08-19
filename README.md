# Synthesis

Synthesis is a browser/mobile hacking simulation presented through fictional
operating environments such as NODE-OS.

The project is currently an in-development prototype. For the exact implemented
product state, see [`docs/V0.md`](docs/V0.md).


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


## Documentation

Repository documentation has explicit ownership:

- [`AGENTS.md`](AGENTS.md)
  - repository-wide working contract for implementation agents
  - source navigation and execution discipline

- [`docs/V0.md`](docs/V0.md)
  - current implemented product truth

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
  - durable architecture boundaries and invariants

- [`docs/FUTURE.md`](docs/FUTURE.md)
  - long-term product and simulation direction
  - not implementation authority

- [`docs/HANDBOOK.md`](docs/HANDBOOK.md)
  - development workflow, tool roles, review, and integration discipline

- [`docs/design/`](docs/design/)
  - feature-specific design contracts and references

- [`docs/work-orders/`](docs/work-orders/)
  - planned implementation deltas
  - executable only after explicit human selection

Do not use this README as a substitute for current implementation,
architecture, or work-order documentation.
# Synthesis

Synthesis is a browser-based hacker simulation project. **NODE-OS** is the working name of its responsive, terminal-inspired in-game operating-system foundation.

The current gameplay foundation includes a first discovery and access loop:

```text
ip
↓
scan the player’s address
↓
discover home-net
↓
scan the network
↓
discover represented devices
↓
scan a Device
↓
discover represented service endpoints
↓
analyze a selected endpoint
↓
learn positive vulnerability Knowledge
↓
attempt concrete credential access
↓
establish persistent DeviceAccess on success
```

Scan explores outward from a Device/IP or LocalNetwork/name target and may reveal represented relationships and services. Inspect looks inward and reports the selected target’s own observable properties without enumerating its attack surface.

Service Analysis and Credential Access are concrete Process consumers. They use elapsed-time CPU work and RAM admission, and their completion resolves against current World Truth.

Successful Credential Access may establish persistent `DeviceAccess`. That relationship is not an active remote connection or operating context.

CONNECT, active Remote Sessions, remote operating contexts, remote filesystem access, privilege escalation, broader hacking systems, persistence, authoritative multiplayer, and the wider systemic world remain unimplemented.

## Technology

- React 18
- TypeScript
- Vite
- Vitest and Testing Library

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

- [`docs/V0.md`](docs/V0.md) — current implemented product truth
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — durable architecture boundaries and invariants
- [`docs/FUTURE.md`](docs/FUTURE.md) — confirmed future directions, not implementation authority
- [`docs/HANDBOOK.md`](docs/HANDBOOK.md) — development workflow and review discipline
- [`AGENTS.md`](AGENTS.md) — repository-wide working contract for implementation agents
- [`docs/design/`](docs/design/) — feature-specific design contracts and references
- [`docs/work-orders/`](docs/work-orders/) — planned implementation deltas; execute only when explicitly selected and 
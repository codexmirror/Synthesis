# Synthesis

Synthesis is a browser-based hacker simulation project. **NODE-OS** is the working name of its responsive, terminal-inspired in-game operating-system foundation. Its first discovery loop is `ip` → scan the player's address to reveal `home-net` → scan that network to find its represented devices → inspect the LAN server → scan it to reveal SSH and HTTP endpoints → analyze a chosen endpoint as a resource-consuming Process → revisit Scan to see positively discovered weakness knowledge. Scan explores outward from a Device/IP or LocalNetwork/name target and may reveal represented services; Inspect looks inward and reports that target’s own properties without enumerating its attack surface. Service Analysis is the first production Process consumer and uses elapsed-time CPU work and RAM admission. Exploit and access and wider hacking systems are not implemented.

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

- [`docs/V0.md`](docs/V0.md) — current implemented scope
- [`docs/FUTURE.md`](docs/FUTURE.md) — confirmed, unimplemented directions
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — durable architectural boundaries
- [`docs/HANDBOOK.md`](docs/HANDBOOK.md) — development and review workflow

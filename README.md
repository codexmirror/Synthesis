# Synthesis V1

A small, browser-local hacking game inside NODE-OS. Find a signal, scan its protection, hack, connect to its device, transfer a software package, install it, and use the upgrade against another machine.

```sh
npm install
npm run dev
```

Validate with `npm test` (the complete V1 suite) and `npm run build`. Node 22 is the CI baseline. There is no account, server or real network intrusion. Progress is saved per browser origin; keep using the same URL to resume.

Eight authored devices combine independent identity masking, authentication challenges and packet filters. Six represented firmware families give connected devices their own operating identity and storage layout. KeyProbe, NodeScan, Tunnel and Burst change access, observation, routing and transfer speed respectively. No terminal is required.

Simulation: `src/game/game.ts`. Interface: `src/ui/`. The persistence adapter stores player progress and reconstructs immutable device content from source. A damaged save is preserved with a visible warning, not silently overwritten.

V0 was frozen at **`eab81314e621835bb1b14338bd772a88450f0e41`**, tagged **`v0-final`**. All 18 former tracked root entries were V0 material and moved under `v0/`; its README was replaced by a reference notice. Original V0 remains runnable from the tag or unchanged local `main`. V1 never imports V0. TypeScript and tests explicitly select V1; the dev server denies `v0/`. Root CI installs, tests and builds V1 only; the old Pages/Online workflow is inert under `v0/.github/`.

See [PLAYTEST.md](PLAYTEST.md) for the actual browser route, acceptance evidence and honest product limitations.

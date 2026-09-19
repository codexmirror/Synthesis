# Synthesis V1

A small single-player hacking game. Core loop: find → scan → hack → access → connect → transfer software → install → stronger target.

Simulation lives in `src/game/` and must remain independent of React and browser APIs. Presentation lives in `src/ui/`; browser persistence in `src/persistence.ts`.

Run: `npm install`, `npm run dev`. Validate: `npm test`, `npm run build`. Keep tests focused on causal state transitions and the actual player route.

`v0/` is frozen reference. V1 MUST NOT import from it. V1 TypeScript/test include paths and dev-server access exclude it.

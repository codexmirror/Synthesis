#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const [mode, ...args] = process.argv.slice(2)
const vitest = resolve(repoRoot, 'node_modules/vitest/vitest.mjs')

function fail(message) {
  console.error(message)
  process.exit(1)
}

if (mode === 'focused') {
  const firstOption = args.findIndex((argument) => argument.startsWith('-'))
  const selectors = args.slice(0, firstOption === -1 ? args.length : firstOption)
  const isTestSelector = (selector) => /(?:^|[/\\*?])[^/\\]*\.(?:test|spec)(?:\.[^/\\]+)?$/.test(selector)

  if (selectors.length === 0 || selectors.some((selector) => !isTestSelector(selector))) {
    fail(
      'Focused test selection required. Run: npm test -- <file.test.ts> [more.test.ts] [vitest options]\n' +
        'Repository-wide validation is owned by pull-request CI.',
    )
  }
} else if (mode === 'ci') {
  const admittedByGitHub = process.env.GITHUB_ACTIONS === 'true'
  const explicitlyAuthorized = process.env.SYNTHESIS_ALLOW_FULL_TEST_SUITE === '1'

  if (!admittedByGitHub && !explicitlyAuthorized) {
    fail(
      'Repository-wide validation is CI-owned by default. After broad failures, rerun only failing or materially affected suites; do not rerun the full suite after each patch.\n' +
        'For an exceptionally justified local run: SYNTHESIS_ALLOW_FULL_TEST_SUITE=1 npm run test:ci',
    )
  }
} else {
  fail('Unknown test-runner mode.')
}

const result = spawnSync(process.execPath, [vitest, 'run', ...args], {
  cwd: repoRoot,
  env: process.env,
  stdio: 'inherit',
})

if (result.error) throw result.error
if (result.signal) process.kill(process.pid, result.signal)
process.exit(result.status ?? 1)

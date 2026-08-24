#!/usr/bin/env node
/**
 * Mechanical documentation checks for the Synthesis knowledge architecture.
 *
 * These checks are structural only. They deliberately make no judgment about
 * whether documentation impact was resolved correctly — that stays an agent and
 * reviewer responsibility (see docs/HANDBOOK.md).
 *
 * Run: npm run docs:check
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, dirname, resolve, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const problems = []
const checks = []

function fail(check, message) {
  problems.push(`${check}: ${message}`)
}

function rel(absolutePath) {
  return relative(repoRoot, absolutePath).split(sep).join('/')
}

function walk(directory, predicate) {
  const found = []
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue
    const full = join(directory, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full, predicate))
    else if (predicate(full)) found.push(full)
  }
  return found
}

const markdownFiles = walk(repoRoot, (path) => path.endsWith('.md'))
const read = (path) => readFileSync(path, 'utf8')

/* 1. Internal Markdown links resolve. */
checks.push('internal links resolve')
const linkPattern = /\[[^\]]*\]\(([^)\s]+)\)/g
for (const file of markdownFiles) {
  const body = read(file)
  for (const match of body.matchAll(linkPattern)) {
    const target = match[1]
    if (/^(https?:|mailto:|#)/.test(target)) continue
    const [path] = target.split('#')
    if (!path) continue
    const resolved = resolve(dirname(file), path)
    if (!existsSync(resolved)) fail('internal links resolve', `${rel(file)} → ${target} does not exist`)
  }
}

/* 2. Every docs/current owner is registered in the portal and in V0. */
checks.push('current owners registered')
const portalPath = join(repoRoot, 'docs/README.md')
const portal = read(portalPath)
const v0 = read(join(repoRoot, 'docs/V0.md'))
const currentOwners = readdirSync(join(repoRoot, 'docs/current')).filter((name) => name.endsWith('.md'))
if (currentOwners.length === 0) fail('current owners registered', 'docs/current contains no owner documents')
for (const owner of currentOwners) {
  if (!portal.includes(`current/${owner}`)) fail('current owners registered', `docs/current/${owner} is not routed from docs/README.md`)
  if (!v0.includes(`current/${owner}`)) fail('current owners registered', `docs/current/${owner} is not indexed from docs/V0.md`)
}

/* 3. Portal Read Set targets exist (code and test paths, not just links). */
checks.push('portal read-set targets exist')
for (const match of portal.matchAll(/`(src\/[^`]+)`/g)) {
  const target = join(repoRoot, match[1])
  if (!existsSync(target)) fail('portal read-set targets exist', `docs/README.md references missing path ${match[1]}`)
}

/* 4. Architecture IDs are unique and registered in the index. */
checks.push('architecture IDs unique and registered')
const architectureIndex = read(join(repoRoot, 'docs/ARCHITECTURE.md'))
const definitions = new Map()
for (const file of walk(join(repoRoot, 'docs/architecture'), (path) => path.endsWith('.md'))) {
  for (const match of read(file).matchAll(/^## (A\d{2}) — /gm)) {
    const id = match[1]
    if (definitions.has(id)) fail('architecture IDs unique and registered', `${id} is defined in both ${definitions.get(id)} and ${rel(file)}`)
    else definitions.set(id, rel(file))
  }
}
if (definitions.size === 0) fail('architecture IDs unique and registered', 'no architecture invariants found under docs/architecture')
for (const [id, file] of definitions) {
  const row = architectureIndex.split('\n').find((line) => line.startsWith(`| ${id} |`))
  if (!row) fail('architecture IDs unique and registered', `${id} (${file}) is not listed in the docs/ARCHITECTURE.md register`)
  else if (!row.includes(file.replace('docs/', ''))) fail('architecture IDs unique and registered', `${id} register row does not point at its owning module ${file}`)
}
for (const match of architectureIndex.matchAll(/^\| (A\d{2}) \|/gm)) {
  if (!definitions.has(match[1])) fail('architecture IDs unique and registered', `${match[1]} is registered in docs/ARCHITECTURE.md but defined nowhere under docs/architecture`)
}

/* 5. Required status metadata exists for the document classes that require it. */
checks.push('required status headers present')
const statusRequired = [
  ...walk(join(repoRoot, 'docs/current'), (path) => path.endsWith('.md')),
  ...walk(join(repoRoot, 'docs/architecture'), (path) => path.endsWith('.md')),
  ...walk(join(repoRoot, 'docs/design'), (path) => path.endsWith('.md')),
  join(repoRoot, 'docs/ARCHITECTURE.md'),
  join(repoRoot, 'docs/V0.md'),
  join(repoRoot, 'docs/HANDBOOK.md'),
  join(repoRoot, 'docs/FUTURE.md'),
  join(repoRoot, 'docs/README.md'),
  join(repoRoot, 'docs/MIGRATION_NOTES_KNOWLEDGE_V1.md'),
  ...readdirSync(join(repoRoot, 'docs/work-orders'))
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(repoRoot, 'docs/work-orders', name)),
]
const allowedStatus = ['Accepted', 'Draft', 'Superseded', 'Historical', 'Planned', 'Selected', 'Completed']
for (const file of statusRequired) {
  const head = read(file).split('\n').slice(0, 12).join('\n')
  const status = head.match(/^Status:\s*(.+)$/m)
  if (!status) {
    fail('required status headers present', `${rel(file)} has no "Status:" header in its first 12 lines`)
    continue
  }
  const value = status[1].trim()
  if (!allowedStatus.some((allowed) => value.startsWith(allowed))) {
    fail('required status headers present', `${rel(file)} has unrecognized status "${value}"`)
  }
  if (!/^Scope:/m.test(head)) fail('required status headers present', `${rel(file)} has no "Scope:" header in its first 12 lines`)
}

/* 6. Default routing never points into archived work orders. */
checks.push('no default read set points into archived work orders')
const routingDocuments = [
  join(repoRoot, 'docs/README.md'),
  join(repoRoot, 'docs/V0.md'),
  join(repoRoot, 'AGENTS.md'),
  join(repoRoot, 'CLAUDE.md'),
  join(repoRoot, 'README.md'),
  ...walk(join(repoRoot, 'docs/current'), (path) => path.endsWith('.md')),
  ...walk(join(repoRoot, 'docs/architecture'), (path) => path.endsWith('.md')),
]
for (const file of routingDocuments) {
  const body = read(file)
  for (const [index, line] of body.split('\n').entries()) {
    if (!line.includes('work-orders/archived')) continue
    // A statement that archived work orders are historical is allowed; a route into them is not.
    const isDisclaimer = /historical|never|not a default|archived work orders are/i.test(line) || /archived work orders/i.test(body.split('\n').slice(Math.max(0, index - 4), index + 1).join(' '))
    if (!isDisclaimer) fail('no default read set points into archived work orders', `${rel(file)}:${index + 1} routes into archived work orders`)
  }
}

/* 7. No orphan documentation: every docs/**\/*.md is reachable from a router. */
checks.push('no orphan documents')
const routers = [
  read(join(repoRoot, 'README.md')),
  read(join(repoRoot, 'AGENTS.md')),
  read(join(repoRoot, 'CLAUDE.md')),
  portal,
  v0,
  architectureIndex,
  read(join(repoRoot, 'docs/HANDBOOK.md')),
  read(join(repoRoot, 'docs/work-orders/README.md')),
  read(join(repoRoot, 'docs/MIGRATION_NOTES_KNOWLEDGE_V1.md')),
].join('\n')
for (const file of walk(join(repoRoot, 'docs'), (path) => path.endsWith('.md'))) {
  const relative_ = rel(file)
  if (relative_ === 'docs/README.md') continue
  const name = relative_.replace(/^docs\//, '')
  if (!routers.includes(name)) fail('no orphan documents', `${relative_} is not referenced from any routing document`)
}

/* Report. */
const width = Math.max(...checks.map((check) => check.length))
for (const check of checks) {
  const failures = problems.filter((problem) => problem.startsWith(`${check}:`))
  console.log(`${failures.length === 0 ? 'PASS' : 'FAIL'}  ${check.padEnd(width)}  ${failures.length === 0 ? '' : `(${failures.length})`}`)
}
if (problems.length > 0) {
  console.log('')
  for (const problem of problems) console.log(`  - ${problem}`)
  console.log(`\ndocs:check failed with ${problems.length} problem(s).`)
  process.exit(1)
}
console.log(`\ndocs:check passed (${checks.length} checks, ${markdownFiles.length} Markdown files).`)

#!/usr/bin/env node
/**
 * LMC Platform — Route Validator
 * 
 * Checks that every <Route element={<Component />} /> in App.jsx
 * has a corresponding const Component = lazy(() => import(...)) declaration.
 * 
 * Runs automatically before every build via "prebuild" in package.json.
 * Run manually: node scripts/validate-routes.mjs
 * Exits 1 (fails build) if any route component is missing a lazy import.
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const repoRoot = existsSync(join(process.cwd(), 'src', 'App.jsx'))
  ? process.cwd()
  : join(__dirname, '..')

const appJsxPath = join(repoRoot, 'src', 'App.jsx')

if (!existsSync(appJsxPath)) {
  console.error(`ERROR: Cannot find src/App.jsx at ${appJsxPath}`)
  process.exit(1)
}

const appJsx = readFileSync(appJsxPath, 'utf8')

// 1. Collect all lazy-declared component names
const lazyDeclared = new Set()
const lazyRe = /const\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*lazy\s*\(/g
let m
while ((m = lazyRe.exec(appJsx)) !== null) {
  lazyDeclared.add(m[1])
}

// Non-lazy components that are valid in routes
const BUILTINS = new Set(['Navigate', 'Route', 'Routes'])

// 2. Collect all component names used in <Route element={<Foo ...}>
const routeRe = /element=\{<([A-Za-z][A-Za-z0-9_]*)/g
const routeComponents = new Set()
while ((m = routeRe.exec(appJsx)) !== null) {
  routeComponents.add(m[1])
}

// 3. Find mismatches
const missing = []
for (const comp of routeComponents) {
  if (!lazyDeclared.has(comp) && !BUILTINS.has(comp)) {
    missing.push(comp)
  }
}

if (missing.length === 0) {
  console.log(`\n✓  Route validator passed — all ${routeComponents.size} route components have lazy imports.\n`)
  process.exit(0)
} else {
  console.error(`\n✗  Route validator FAILED — ${missing.length} component(s) in routes without lazy import:\n`)
  missing.forEach(c => {
    console.error(`   MISSING:  const ${c} = lazy(() => import('./pages/${c}'))`)
  })
  console.error(`\n   Add the missing lazy() import(s) to src/App.jsx before pushing.\n`)
  process.exit(1)
}

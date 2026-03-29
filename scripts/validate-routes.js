#!/usr/bin/env node
/**
 * LMC Platform — Route Validator
 * 
 * Checks that every <Route element={<Component />} /> in App.jsx
 * has a corresponding const Component = lazy(() => import(...)) declaration.
 * 
 * Run from repo root:  node scripts/validate-routes.js
 * Exits 1 (fails) if any route component is missing a lazy import.
 */

const fs   = require('fs')
const path = require('path')

// Works whether run from repo root or scripts/ subdirectory
const repoRoot = fs.existsSync(path.join(process.cwd(), 'src', 'App.jsx'))
  ? process.cwd()
  : path.join(__dirname, '..')

const appJsxPath = path.join(repoRoot, 'src', 'App.jsx')

if (!fs.existsSync(appJsxPath)) {
  console.error(`ERROR: Cannot find src/App.jsx at ${appJsxPath}`)
  process.exit(1)
}

const appJsx = fs.readFileSync(appJsxPath, 'utf8')

// 1. Collect all lazy-declared component names
const lazyDeclared = new Set()
const lazyRe = /const\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*lazy\s*\(/g
let m
while ((m = lazyRe.exec(appJsx)) !== null) {
  lazyDeclared.add(m[1])
}

// Non-lazy components that are valid in routes
const BUILTINS = new Set(['Navigate', 'Route', 'Routes'])

// 2. Collect all component names used inside <Route element={<Foo ...>}
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
  console.error(`\n✗  Route validator FAILED — ${missing.length} component(s) used in <Route> but missing lazy import:\n`)
  missing.forEach(c => {
    console.error(`   MISSING:  const ${c} = lazy(() => import('./pages/${c}'))`)
  })
  console.error(`\n   Add the missing lazy() import(s) to src/App.jsx before pushing.\n`)
  process.exit(1)
}

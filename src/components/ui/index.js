/**
 * LMC UI Component Library
 * Unified shared UI kit for Field Ops, Mission Control, and Warehouse IQ.
 *
 * Import from here in all three apps:
 *   import { Button, Card, RowItem, StatusBadge } from '../components/ui'
 *
 * Never import directly from individual files — use this index.
 */

// ─── Foundations ──────────────────────────────────────────────────────────────
export { Surface } from './foundations/index.js'

// ─── Primitives ──────────────────────────────────────────────────────────────
export { Button, IconButton, Input, Select, Textarea, Badge, Divider, Spinner } from './primitives/index.js'

// ─── Navigation / Shell ──────────────────────────────────────────────────────
export { AppShell, Sidebar, MobileHeader, BottomNav, PageHeader, PageSubNav } from './navigation/index.js'

// ─── Data Display ────────────────────────────────────────────────────────────
export { Card, StatCard, StatusBadge, RowItem, SearchInput, EmptyState } from './data-display/index.js'

// ─── Workflows ───────────────────────────────────────────────────────────────
export { ActionButton, FilterPills } from './workflows/index.js'

# LMC / Bolt Lightning — Unified Design System
### Field Ops · Mission Control · Warehouse IQ

**Version:** 2.0 — March 2026  
**Applies to:** All three apps in the LMC platform  
**Purpose:** Single source of truth for visual design, component patterns, BEM class naming, and development protocols. Read this before building any new page or component.

---

## 1. The Three Apps

| App | Repo | URL | Audience |
|---|---|---|---|
| **Field Ops** | `KkarmLMC/field-ops` | `field-ops-psi.vercel.app` | Field crew, installers, supervisors |
| **Mission Control** | `KkarmLMC/bolt-mission-control` | `bolt-mission-control.vercel.app` | Management, COO, office staff |
| **Warehouse IQ** | `KkarmLMC/warehouse-iq` | `warehouse-iq.vercel.app` | Warehouse managers |

**Shared backend:** All three apps use Supabase project `jnbdlhyjnzdsvscpgkqi`. One database, three front-end surfaces.

---

## 2. Stack

Every app uses the same stack. Do not introduce alternatives without discussion.

```
React 19              — UI framework
Vite 8                — Build tool
React Router 7        — Client-side routing
Supabase JS 2         — Database + auth client
Phosphor Icons        — Icon library (ONLY icon library)
DM Mono               — Monospace font (shared across all apps)
CSS custom properties — Design tokens (no Tailwind, no CSS-in-JS)
Vercel                — Deployment (vercel.json required for each app)
```

**Field Ops only:** Dexie.js (offline), jsPDF (PDF generation)

---

## 3. CSS Architecture & BEM Convention

### 3.1 The Rule

**Every component gets its own BEM block.** No shared class names across unrelated components. No inline styles for structural layout — inline styles are only allowed for dynamic values driven by runtime data (e.g. a color value that comes from a database record).

### 3.2 BEM Syntax

```
block                    — The component root
block__element           — A part of the block
block--modifier          — A variation of the block
block__element--modifier — A variation of an element
```

### 3.3 Naming Rules

| Rule | Example |
|---|---|
| Block names are kebab-case | `.stat-card`, `.ops-board`, `.job-panel` |
| Elements use double underscore | `.stat-card__label`, `.stat-card__value` |
| Modifiers use double dash | `.stat-card--amber`, `.sidebar-item--active` |
| State classes use `is-` prefix | `.is-loading`, `.is-active`, `.is-empty` |
| Page-scoped classes use page prefix | `.login-page`, `.ops-board-page` |
| Utility classes are single-purpose | `.fade-in`, `.font-mono`, `.text-muted` |

### 3.4 Scoping Rule — Critical

**CSS variables and classes for a specific context must be scoped to that context's block.** Never modify global variables to achieve a local visual change. Define local variables inside the block's scope instead.

```css
/* ✅ Correct — variables scoped to the login block only */
.login-page {
  --login-bg:      #F4F5F7;
  --login-card-bg: #FFFFFF;
  background: var(--login-bg);
}

/* ❌ Wrong — modifies global token, bleeds into entire app */
:root {
  --bg: #F4F5F7;
}
```

### 3.5 Where Classes Live

All classes live in `src/styles/globals.css`. No CSS modules, no component-level CSS files. Each component's BEM block is grouped with a comment header:

```css
/* ─── ComponentName ────────────────────────────────────────────── */
.component-name { ... }
.component-name__element { ... }
.component-name--modifier { ... }
```

---

## 4. Component Class Registry

The authoritative list of all defined BEM blocks. Check here before creating a new class to avoid duplication. When you add a new component, add it here and in `globals.css`.

### 4.1 Shell & Layout

| Block | Description |
|---|---|
| `.app-shell` | Root app wrapper (flex row: sidebar + main) |
| `.main-area` | Content area to the right of sidebar |
| `.page-content` | Scrollable page body with standard padding |
| `.page-stack` | Vertical stack layout within a page |

### 4.2 Sidebar

| Class | Description |
|---|---|
| `.sidebar` | Root nav sidebar (navy background, 240px) |
| `.sidebar--collapsed` | Collapsed state modifier |
| `.sidebar__overlay` | Mobile dim overlay when sidebar is open |
| `.sidebar__brand` | Logo + app name area at top |
| `.sidebar__nav` | Nav list container |
| `.sidebar-item` | Individual nav link row |
| `.sidebar-item--active` | Active/current page nav item |
| `.sidebar-item__label` | Text label inside nav item |
| `.sidebar-sub-item` | Indented child nav item |
| `.sidebar-section-label` | Group label (uppercase, muted) |
| `.sidebar-footer-nav` | Bottom area (user info + sign out) |

### 4.3 Mobile Header

| Class | Description |
|---|---|
| `.mobile-header` | Fixed top bar on mobile |
| `.mobile-header__btn` | Back/menu button |
| `.mobile-header__title` | Page title text |

### 4.4 Bottom Tab Bar

| Class | Description |
|---|---|
| `.bottom-nav` | Fixed bottom navigation container |
| `.bottom-nav__track` | Horizontally scrollable tab track |
| `.bottom-nav__tab` | Individual tab button |
| `.bottom-nav__tab--active` | Active tab state modifier |
| `.bottom-nav__icon` | Icon inside tab |
| `.bottom-nav__label` | Label inside tab |
| `.bottom-nav__indicator` | Active indicator dot under icon |
| `.bottom-nav__fade` | Scroll edge fade gradient |
| `.bottom-nav__fade--left` | Left fade modifier |
| `.bottom-nav__fade--right` | Right fade modifier |
| `.tab-badge` | Notification count badge on tab |

### 4.5 Page Sub-Navigation

| Class | Description |
|---|---|
| `.page-sub-nav` | Horizontal scrollable pill tabs |
| `.page-sub-nav__item` | Individual pill tab |
| `.page-sub-nav__item--active` | Currently selected tab |

### 4.6 Cards

| Class | Description |
|---|---|
| `.card` | Standard card container |
| `.card__header` | BEM card header (navy bg, white text) |
| `.card-header` | Legacy alias — same visual as `__header` |
| `.card-title` | White title text inside card header |
| `.card-dot` | Colored square accent dot in card header |
| `.card-body` | Card content area |

### 4.7 Stat Cards

| Class | Description |
|---|---|
| `.stat-grid` | CSS grid wrapper for a stat card row |
| `.stat-card` | Flat stat card (no border, no icon) |
| `.stat-card__label` | Uppercase label at top |
| `.stat-card__value` | Large number or value |
| `.stat-card__delta` | Change indicator below value |
| `.stat-card--blue` | Blue value color modifier |
| `.stat-card--amber` | Amber value color modifier |
| `.stat-card--green` | Green value color modifier |
| `.stat-card--red` | Red value color modifier |

### 4.8 Status Badges

| Class | Description |
|---|---|
| `.badge` | Base pill badge (colored bg + text) |
| `.badge--awarded` | Blue tint |
| `.badge--scheduled` | Amber tint |
| `.badge--inprogress` | Orange tint |
| `.badge--review` | Red tint |

### 4.9 Forms

| Class | Description |
|---|---|
| `.form-group` | Label + input + hint wrapper |
| `.form-label` | Field label text |
| `.form-label.required` | Adds red asterisk via `::after` |
| `.form-hint` | Subtext below input |
| `.form-textarea` | Textarea with `resize: vertical` |
| `.form-catalog-grid` | Grid layout for catalog forms |

### 4.10 Empty States

| Class | Description |
|---|---|
| `.empty` | Centered flex container for empty state |
| `.empty-title` | Bold heading |
| `.empty-desc` | Muted description text |

### 4.11 Project List Items

| Class | Description |
|---|---|
| `.project-item` | Tappable row in project list |
| `.project-stage-dot` | Colored dot indicating job stage |
| `.project-name` | Job name text |
| `.project-meta` | Secondary info (city, date) |

### 4.12 Login (scoped — no app interior bleed)

| Class | Scoped Variables | Description |
|---|---|---|
| `.login-page` | `--login-bg: #F4F5F7` | Full-screen gray outer wrapper |
| `.login-card` | `--login-card-bg: #FFFFFF` | White floating card |

### 4.13 Daily Field Log (prefix: `dfl-`)

| Class | Description |
|---|---|
| `.dfl-card-icon` | Icon block on left of DFL card |
| `.dfl-card-title` | Primary title text |
| `.dfl-card-sub` | Subtitle/site text |
| `.dfl-card-head-right` | Right section of card header |
| `.dfl-card-hours` | Hours badge |
| `.dfl-status-pill` | Status pill |
| `.dfl-dot` | Small status dot indicator |
| `.dfl-card-chips` | Chip row container |
| `.dfl-work-chip` | Work type chip |
| `.dfl-safety-row` | Safety checklist row |
| `.dfl-safety-label` | Label text in safety row |
| `.dfl-safety-badges` | Badge cluster |
| `.dfl-detail-grid` | Detail section grid |
| `.dfl-detail-item` | Individual label + value pair |
| `.dfl-detail-full` | Full-width detail item |
| `.dfl-detail-value` | Value text |
| `.dfl-gps` | GPS/location row |
| `.dfl-signoff-row` | Signoff row at bottom |
| `.dfl-unsigned-badge` | Badge when not yet signed |
| `.dfl-summary-strip` | Summary stats strip |
| `.dfl-summary-card` | Individual summary card |
| `.dfl-summary-icon` | Icon in summary card |
| `.dfl-summary-value` | Value in summary card |
| `.dfl-summary-label` | Label in summary card |

### 4.14 Form Report Builder (prefix: `fr-`)

| Class | Description |
|---|---|
| `.fr-ok-notok` | OK / Not OK toggle button |
| `.fr-ok-na` | N/A toggle button |
| `.fr-ok-explanation` | Explanation textarea when Not OK |
| `.fr-cg-grid` | Checkbox grid layout |
| `.fr-cg-item` | Individual checkbox item |
| `.fr-cg-box` | Visual checkbox square |
| `.fr-cg-text` | Checkbox label text |
| `.fr-act-row` | Action/observation row |
| `.fr-act-cell` | Individual cell in action row |
| `.fr-person-row` | Signatory person row |
| `.fr-person-fields` | Input fields group |
| `.fr-person-name` | Name input |
| `.fr-person-fn` | Function/title input |
| `.fr-person-sign` | Signature trigger button |

### 4.15 Ops Board (prefix: `ops-board`)

| Class | Description |
|---|---|
| `.ops-board-page` | Page root |
| `.ops-board__header` | Controls bar |
| `.ops-board__content` | Scrollable board area |
| `.ops-board__gantt` | Gantt view container |
| `.ops-board__crew` | Crew board container |
| `.ops-board__month` | Month grid container |
| `.ops-board__job-bar` | Horizontal job bar |
| `.ops-board__job-bar--in-progress` | In Progress modifier |
| `.ops-board__job-bar--scheduled` | Scheduled modifier |
| `.ops-board__job-bar--awarded` | Awarded modifier |
| `.ops-board__job-bar--inspection` | Inspection modifier |
| `.ops-board__job-bar--complete` | Complete modifier |
| `.ops-board__cell` | Day cell |
| `.ops-board__cell--today` | Today column modifier |
| `.ops-board__cell--weekend` | Weekend column modifier |
| `.ops-board__cell--conflict` | Double-booking modifier |
| `.ops-board__crew-chip` | Job chip in crew cell |
| `.ops-board__month-cell` | Month grid day cell |
| `.ops-board__month-chip` | Job chip in month cell |

### 4.16 Job Detail Panel (prefix: `job-panel`)

| Class | Description |
|---|---|
| `.job-panel` | Slide-in detail panel |
| `.job-panel__header` | Navy header area |
| `.job-panel__body` | Scrollable content |
| `.job-panel__footer` | Action buttons area |
| `.job-panel__field` | Label + value field row |
| `.job-panel__field-label` | Uppercase label |
| `.job-panel__field-value` | Value text |
| `.job-panel__crew-row` | Crew member row |
| `.job-panel__crew-avatar` | Initials avatar circle |

### 4.17 Warehouse Grid

| Class | Description |
|---|---|
| `.warehouse-grid` | Responsive grid for warehouse cards |

### 4.18 Utilities

| Class | Description |
|---|---|
| `.fade-in` | 0.2s opacity fade-in animation |
| `.font-mono` | Apply monospace font |
| `.text-red` | Red text |
| `.text-green` | Green text |
| `.text-amber` | Amber text |
| `.text-blue` | Blue text |
| `.text-muted` | Tertiary/muted text |
| `.divider` | 1px horizontal rule |
| `.label` | Standard section label style |
| `.is-loading` | Loading state |
| `.is-active` | Generic active state |

---

## 5. Adding a New Component — Protocol

Follow this checklist in order every time:

**1. Check the registry (Section 4)**
Does a class already exist? Extend with a modifier instead of creating a new block.

**2. Name the BEM block**
Match the component name. Page-specific components get the page name as prefix: `.qb-import__`, `.change-order__`, `.stock-view__`.

**3. Define scoped variables if needed**
```css
.my-component {
  --my-component-accent: #somecolor;
  --my-component-height: 48px;
  /* Never redefine --bg, --surface-raised, or other global tokens */
}
```

**4. Write the CSS block in globals.css**
```css
/* ─── MyComponent ──────────────────────────────────────────────── */
.my-component { ... }
.my-component__header { ... }
.my-component__body { ... }
.my-component--active { ... }
```

**5. Update Section 4 of this document**

**6. Use className in JSX — not inline styles for structure**
```jsx
/* ✅ Correct */
<div className="my-component">
  <div className="my-component__header">...</div>
</div>

/* ❌ Wrong */
<div style={{ display: 'flex', background: 'var(--navy)', padding: '1rem' }}>

/* ✅ Inline styles allowed only for runtime data values */
<div className="ops-board__job-bar" style={{ background: stageColor }} />
```

---

## 6. Design Tokens

### 6.1 Colors
```css
--navy: #04245C;  --navy-dark: #031a45;
--red: #F5333F;   --red-dark: #D42430;   --red-soft: #FEF0F1;
--text-1: #000000; --text-2: #374151; --text-3: #9CA3AF; --text-4: #D1D5DB;
--bg: #FFFFFF;  --surface: #FFFFFF;  --surface-raised: #F7F8FA;
--hover: #F3F4F6;  --border-l: #EFEFEF;
--success: #10B981; --success-soft: #ECFDF5; --success-text: #15803D;
--error: #EF4444;   --error-soft: #FEF2F2;   --error-alt: #DC2626;
--warning: #F59E0B; --warning-soft: #FFFBEB; --warning-text: #92400E;
--amber: #D97706;   --blue: #1D4ED8;  --blue-soft: #EFF6FF;
--purple: #7C3AED;  --purple-soft: #F5F3FF;
--teal: #0D9488;    --teal-soft: #F0FDFA;
```

### 6.2 Typography
```css
--font: 'Plus Jakarta Sans', sans-serif;
--mono: 'DM Mono', monospace;
--fs-2xs: 0.5625rem;  --fs-xs: 0.75rem;   --fs-sm: 0.8125rem;
--fs-base: 0.875rem;  --fs-md: 1rem;      --fs-lg: 1.125rem;
--fs-xl: 1.25rem;     --fs-2xl: 1.5rem;
```

### 6.3 Spacing
```css
--sp-1: 0.25rem;  --sp-2: 0.5rem;   --sp-3: 0.75rem;  --sp-4: 1rem;
--sp-5: 1.25rem;  --sp-6: 1.5rem;   --sp-8: 2rem;     --sp-10: 2.5rem;
--content-pad: 1.25rem;
```

### 6.4 Radii
```css
--r-xs: 4px;  --r-sm: 6px;  --r-md: 8px;   --r-lg: 10px;
--r-xl: 14px; --r-2xl: 18px; --r-full: 9999px;
```

### 6.5 Shadows
```css
--shadow:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
--shadow-md: 0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04);
--shadow-lg: 0 20px 50px rgba(0,0,0,0.12), 0 8px 20px rgba(0,0,0,0.06);
```

---

## 7. Icons

Phosphor Icons only. No emoji. No other libraries.

```jsx
// Sizes: 12 (badge) · 14 (inline) · 16 (toolbar) · 18–20 (button) · 22–28 (header/FAB)
// Weights: regular (default) · bold (active) · fill (status indicators)
```

---

## 8. Authentication

```
Supabase Auth + email/password + 6-digit PIN
7-day session persistence
storageKey: fieldops-auth | missioncontrol-auth | warehouse-iq-auth
useAuth() → user, profile, role, isManagement, isField, isWarehouse, isAdmin
```

---

## 9. Code Conventions

```
Pages/Components: PascalCase.jsx
Hooks:            camelCase.jsx
Routes:           kebab-case
All pages lazy-loaded in App.jsx
vercel.json required in every app repo
```

---

## 10. What NOT To Do

| ❌ Don't | ✅ Do instead |
|---|---|
| Modify `--bg` / `--surface-raised` for a local change | Scope new vars inside your BEM block |
| Use inline styles for layout structure | BEM class in globals.css |
| Share CSS class names across unrelated components | New BEM block with unique prefix |
| Use emoji as icons | Phosphor Icons |
| Hardcode pixel spacing | `var(--sp-N)` tokens |
| Use red for active filter pills | `var(--navy)` |
| Use `inline-flex` buttons without `min-width: 0` | Add `min-width: 0; box-sizing: border-box` |
| Create a component without updating Section 4 | Add to registry first |
| Deploy without `vercel.json` | Always include with SPA rewrites |

---

*Version 2.0 — March 2026. Always update Section 4 when adding a new component.*

# Warehouse IQ — Project Standards & Design System

> This document is the single source of truth for design, code, and architecture decisions in the Warehouse IQ app. Every new page, component, or feature must adhere to these standards. When in doubt, refer here first.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Design System](#4-design-system)
5. [CSS Standards](#5-css-standards)
6. [Component Patterns](#6-component-patterns)
7. [Data & State](#7-data--state)
8. [Database Schema](#8-database-schema)
9. [PDF Generation](#9-pdf-generation)
10. [Routing & Navigation](#10-routing--navigation)
11. [Compliance Standards](#11-compliance-standards)
12. [Branch System](#12-branch-system)
13. [Git & Deployment](#13-git--deployment)
14. [Do's and Don'ts](#14-dos-and-donts)

---

## 1. Project Overview

**Field Ops** is a proprietary field service workflow tool for Lightning Master Controls (LMC) and its subsidiaries. It covers the full job lifecycle for lightning protection system (LPS) work — from prospect site assessment through installation, inspection, certification, and ongoing testing.

**Branches in the system:**
| Key | Name | Sectors |
|---|---|---|
| `lm` | Lightning Master | Oilfield, Chemical, Industrial |
| `bolt` | Bolt Florida | Commercial, Municipal, Hotels |
| `bolt-dallas` | Bolt Dallas | Commercial, Industrial, Energy |

**Deployed at:** https://warehouse-iq.vercel.app  
**Repo:** https://github.com/KkarmLMC/warehouse-iq  
**Database:** Supabase project `jnbdlhyjnzdsvscpgkqi`

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| UI Framework | React | 19 |
| Routing | React Router DOM | 7 |
| Build Tool | Vite | 8 |
| Backend / DB | Supabase (Postgres + Storage) | 2 |
| Offline Storage | Dexie (IndexedDB) | 4 |
| PDF Generation | jsPDF | 4 |
| Icons | Phosphor Icons | 2 |
| Forms | React Hook Form | 7 |
| Deployment | Vercel | — |
| Styling | Plain CSS + CSS Custom Properties | — |

**No CSS frameworks (no Tailwind, no Bootstrap).** All styles live in `src/styles/globals.css` and inline styles using the token system.

---

## 3. Project Structure

```
src/
├── App.jsx                  # Root — routing, layout shell, page transitions
├── main.jsx                 # Entry point
├── index.css                # Dark-theme overrides (legacy; prefer globals.css)
├── components/
│   ├── BranchTabs.jsx       # Branch selector cards used on multi-branch pages
│   ├── Layout.jsx / .css    # App shell layout
│   ├── Sidebar.jsx          # Desktop sidebar navigation
│   ├── SyncBadge.jsx        # Online/offline/pending sync indicator
│   └── TabBar.jsx           # Mobile bottom tab bar
├── config/
│   └── branches.js          # Branch color config (BRANCH_COLORS)
├── data/
│   └── mockData.js          # Mock jobs, technicians, form templates
├── hooks/
│   ├── useProjects.js       # Projects data hook
│   └── useSync.js           # Offline sync hook
├── lib/
│   ├── generateDFLPdf.js    # Daily Field Log PDF generator
│   ├── offline.js           # Dexie IndexedDB setup
│   ├── stages.js            # Job stage definitions and badge helpers
│   └── supabase.js          # Supabase client (exported as `db`)
├── pages/
│   ├── CompletionForms.jsx  # 4 completion form types + PDF + Supabase
│   ├── DailyFieldLog.jsx    # End-of-day close-out report
│   ├── Dashboard.jsx        # Field overview with branch cards
│   ├── FormRunner.jsx       # Dynamic NFPA form renderer
│   ├── Forms.jsx            # Forms hub page
│   ├── Inspections.jsx      # Inspections list
│   ├── Installs.jsx         # Installations list
│   ├── JobDetail.jsx        # Job detail with NFPA form checklist
│   ├── JSA.jsx              # Standalone JSA with signature + PDF
│   ├── Reports.jsx          # Reports list
│   ├── RiskAssessment.jsx   # NFPA 780 Annex L calculator
│   ├── Technicians.jsx      # Technician management
│   └── [legacy pages]       # Jobs.jsx, Projects.jsx, etc. — being migrated
└── styles/
    └── globals.css          # ← Primary stylesheet. All tokens live here.
```

---

## 4. Design System

### 4.1 Color Tokens

All colors are defined in `src/styles/globals.css` as CSS custom properties. **Never hardcode hex values in component files.**

```css
/* Primary palette */
--red:       #F5333F   /* Primary action, LPS Required, danger */
--red-dark:  #D42430   /* Hover/active state for red */
--red-soft:  #FEF0F1   /* Red background tint */
--blue:      #0047BA   /* Links, info, secondary actions */
--blue-soft: #EEF3FC   /* Blue background tint */
--navy:      #04245C   /* Header backgrounds, primary brand */
--green:     #10B981   /* Success, signed, complete */
--green-s:   #ECFDF5   /* Green background tint */
--amber:     #F59E0B   /* Warnings, scheduled */
--orange:    #F97316   /* In progress, active */

/* Neutrals */
--bg:              #FFFFFF   /* Page background */
--surface:         #FFFFFF   /* Component surface */
--surface-raised:  #F7F8FA   /* Card background — barely off-white, lifts cards from page */
--card-header-bg:  #EEF2F9   /* Card/row header tint — light navy, defines headers without borders */
--border:          transparent /* Flat design — no borders */
--border-l:        #EFEFEF   /* Internal row dividers only — subtle separation inside cards */
--hover:           #F3F4F6   /* Hover state */
--text-1:          #000000   /* Primary text — default for all body copy */
--text-2:          #374151   /* Secondary text — subtitles, descriptions, back buttons */
--text-3:          #9CA3AF   /* Muted text — timestamps, IDs, labels, meta only */
--text-4:          #D1D5DB   /* Disabled text */
```

### Flat Design Rules

This app uses a **flat, borderless, shadowless** design. Cards are defined by a subtle background tint — not borders or shadows.

| Token | Value | Use |
|---|---|---|
| `--surface-raised` | `#F7F8FA` | Card/panel background — barely off-white, lifts elements off the page |
| `--card-header-bg` | `#EEF2F9` | Card headers and row headers — light navy tint replaces border lines |
| `--border` | `transparent` | Never use for visual borders — kept only for structural spacing |
| `--border-l` | `#EFEFEF` | Row dividers only — subtle internal separation between list items inside a card |

**Rules:**
- No `border` on cards or panels — flat design
- No `box-shadow` anywhere
- **Inputs, selects, and textareas are the exception** — they MUST have a visible border (`1px solid var(--border-l)`) and white (`var(--surface)`) background for UX clarity. Text must be `var(--text-1)` (black). Focus state uses `border-color: var(--navy)`. This is handled globally in `globals.css` — do not override with `border: none` on inputs.
- Cards sit on `--surface-raised` background
- **Card/section headers default to `--navy`** with white text
- **Branch-aware card headers inherit the branch primary color** via `bc.bgActive` — always override the header background when a branch is in context
- Row dividers inside cards use `--border-l` only

```jsx
// ✅ Non-branch card header — uses navy default via .card-header class
<div className="card-header">
  <span className="card-title">All Submissions</span>
</div>

// ✅ Branch-aware card header — overrides with branch color
const bc = BRANCH_COLORS[branch]
<div className="card-header" style={{ background: bc.bgActive }}>
  <span className="card-title">Daily Field Reports</span>
</div>
```

### 4.1.1 Text Color Usage Rules

**This is a light-themed app. All normal text must be black (`--text-1`) unless there is a specific reason to use a lighter value.**

| Token | Value | Use — when to apply |
|---|---|---|
| `--text-1` | `#000000` | **Default for everything** — headings, body copy, card titles, row names, form values, button labels, nav items |
| `--text-2` | `#374151` | Secondary content — descriptions under a title, back button text, subheadings, result explanations |
| `--text-3` | `#9CA3AF` | Truly secondary metadata only — timestamps, job IDs, technician meta lines, form reference codes, field labels (uppercase mono), placeholder text, icon-only buttons |
| `--text-4` | `#D1D5DB` | Disabled states only |
| `#fff` | white | Text on colored/dark backgrounds (navy headers, red buttons, branch cards) |
| accent colors | various | Status badges, stat values, result indicators only |

**Quick rule:** If someone needs to read it to understand the UI — it should be `--text-1`. If it provides context but isn't the main point — `--text-2`. If it's a timestamp, ID, code, or label prefix — `--text-3`.

```jsx
// ✅ Correct
<div style={{ fontWeight:600, color:'var(--text-1)' }}>Site Name</div>         // primary content
<div style={{ color:'var(--text-2)' }}>Post-inspection findings</div>           // description
<div style={{ fontFamily:'var(--mono)', color:'var(--text-3)' }}>JOB-001</div>  // meta ID
<div style={{ fontFamily:'var(--mono)', color:'var(--text-3)' }}>NFPA 780</div> // label

// ❌ Wrong
<div style={{ color:'var(--text-3)' }}>LPS Required — system should be installed</div> // readable content
<button style={{ color:'var(--text-3)' }}>← Back</button>                              // back button
<div style={{ color:'var(--text-3)' }}>No records yet</div>                           // empty state message
```

### 4.2 Typography

| Token | Value | Use |
|---|---|---|
| `--font` | Plus Jakarta Sans | All body copy, UI labels |
| `--mono` | DM Mono | IDs, codes, timestamps, form refs |

**Type scale** (fluid via `clamp()`):
```css
--fs-2xs:  clamp(0.5rem,   0.6vw, 0.5625rem)   /* 8–9px  — micro labels */
--fs-xs:   clamp(0.5625rem, 0.7vw, 0.625rem)   /* 9–10px — mono labels, badges */
--fs-sm:   clamp(0.625rem,  0.8vw, 0.6875rem)  /* 10–11px — secondary text */
--fs-base: clamp(0.75rem,   0.9vw, 0.8125rem)  /* 12–13px — body small */
--fs-md:   clamp(0.8125rem, 1vw,   0.875rem)   /* 13–14px — body default */
--fs-lg:   clamp(0.875rem,  1.1vw, 0.9375rem)  /* 14–15px — slightly larger body */
--fs-xl:   clamp(1rem,      1.3vw, 1.125rem)   /* 16–18px — subheadings */
--fs-stat: clamp(1rem,      1.6vw, 1.375rem)   /* 16–22px — stat values */
```

**Rule:** Always use `var(--fs-*)` tokens. Never write `fontSize: 13` or `font-size: 13px`.

### 4.3 Spacing

4px base grid. Use `--sp-*` tokens for padding and margin, `--gap-*` for flex/grid gaps.

```css
--sp-1: 0.25rem   /* 4px  */
--sp-2: 0.5rem    /* 8px  */
--sp-3: 0.75rem   /* 12px */
--sp-4: 1rem      /* 16px */
--sp-5: 1.25rem   /* 20px */
--sp-6: 1.5rem    /* 24px */
--sp-8: 2rem      /* 32px */
--sp-10: 2.5rem   /* 40px */

/* Fluid gaps */
--gap-sm:  clamp(0.375rem, 1vw,   0.5rem)
--gap-md:  clamp(0.5rem,   1.5vw, 0.75rem)
--gap-lg:  clamp(0.625rem, 2vw,   1rem)
```

### 4.4 Border Radius

```css
--r-xs:   0.25rem   /* 4px  — small chips, tight elements */
--r-sm:   0.375rem  /* 6px  — buttons, inputs */
--r-md:   0.625rem  /* 10px — cards, panels */
--r-lg:   0.875rem  /* 14px — larger cards */
--r-xl:   1rem      /* 16px — feature cards, modals */
--r-full: 624.9375rem /* full pill */
```

### 4.5 Shadows

```css
--shadow:    0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
--shadow-md: 0 4px 16px rgba(0,0,0,0.08)
--shadow-lg: 0 20px 50px rgba(0,0,0,0.12)
```

### 4.6 Transitions

```css
--ease-fast:    0.12s ease         /* hover states */
--ease-base:    0.18s ease         /* standard transitions */
--ease-slow:    0.3s  ease         /* expanding panels */
--ease-sidebar: 0.22s cubic-bezier(0.4, 0, 0.2, 1)
```

---

## 5. CSS Standards

### Rules

1. **All values in `rem` or CSS tokens** — never raw `px` in component inline styles or CSS classes, except for 1px borders and sub-pixel rendering cases.
2. **Use fluid `clamp()` for typography and layout** — already defined in tokens; just use the token.
3. **`globals.css` is the single stylesheet** — don't create new `.css` files per component. Add new reusable classes to `globals.css`.
4. **Inline styles are acceptable for one-off layout** — but must use CSS tokens, not hardcoded values:
   ```jsx
   // ✅ Correct
   style={{ fontSize: 'var(--fs-md)', gap: 'var(--sp-3)', borderRadius: 'var(--r-md)' }}

   // ❌ Wrong
   style={{ fontSize: 13, gap: 12, borderRadius: 6 }}
   ```
5. **Responsive layout via CSS Grid `auto-fit`** — use `grid-template-columns: repeat(auto-fit, minmax(min(100%, Xpx), 1fr))` for responsive grids without breakpoints where possible.
6. **iOS zoom prevention** — form inputs must have `font-size: 1rem` minimum (or `font-size: var(--fs-md)`) to prevent iOS auto-zoom on focus.

### Reusable Classes (from globals.css)

Use these classes instead of reimplementing:

```
.page-content        — scrollable page wrapper with content-pad
.card                — standard white card with border and radius
.card-header         — card top bar
.card-title          — card title text
.stat-grid           — 2-col (mobile) / 4-col (desktop) stats grid
.stat-card           — individual stat card
.stat-value          — large number display
.stat-label          — stat label text
.badge               — base badge
.badge-{stage}       — stage-specific badge colors
.btn                 — base button
.btn-primary         — red filled button
.btn-secondary       — bordered button
.btn-sm              — small button variant
.empty               — empty state wrapper
.empty-title         — empty state heading
.empty-desc          — empty state description
.loading             — loading spinner container
.spinner             — CSS spinner animation
.fade-in             — page entry animation
.form-group          — field wrapper
.form-label          — field label
.form-input          — styled input
```

---

## 6. Component Patterns

### 6.1 Page Structure

Every page follows this pattern:

```jsx
export default function PageName() {
  // 1. State
  const [loading, setLoading] = useState(true)
  const [data, setData]       = useState([])

  // 2. Data fetching — always from Supabase, never mock in production
  useEffect(() => {
    db.from('table_name')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setData(data)
        setLoading(false)
      })
  }, [])

  // 3. Sub-views (form, detail, success) — use view state, not separate routes where practical
  if (view === 'form') return <SubForm onSave={handleSave} onCancel={() => setView('list')} />

  // 4. Render
  return (
    <div className="page-content fade-in">
      {/* Stats strip */}
      {/* Main content card */}
      {/* Footer note if compliance-relevant */}
    </div>
  )
}
```

### 6.2 Card Layout

```jsx
// Standard card
<div className="card">
  <div className="card-header">
    <span className="card-title">Title</span>
    <button className="btn btn-primary btn-sm">Action</button>
  </div>
  {/* content */}
</div>

// Inline style card (when branch color or dynamic styling needed)
<div style={{
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  overflow: 'hidden',
  marginBottom: 'var(--sp-3)',
}}>
```

### 6.3 Branch-Aware Headers

Pages that show data per branch must use `BranchTabs` and respect `BRANCH_COLORS`:

```jsx
import BranchTabs from '../components/BranchTabs'
import { BRANCH_COLORS } from '../config/branches.js'

const [branch, setBranch] = useState('lm')
const bc = BRANCH_COLORS[branch]

// Card header that takes branch color
<div style={{ background: bc.bgActive, color: bc.textActive }}>
```

### 6.4 Signature Pad

Used in JSA and Completion Forms. Always:
- Show pad only after a name is entered (`value?.name && <SigPad />`)
- Store as `data:image/png` base64 string
- Embed directly into jsPDF via `doc.addImage(sig, 'PNG', x, y, w, h)`
- Include a Clear button

### 6.5 Loading & Empty States

```jsx
// Always show loading spinner while fetching
{loading
  ? <div className="loading"><div className="spinner" /></div>
  : data.length === 0
    ? <div className="empty">
        <div className="empty-title">No records yet</div>
        <div className="empty-desc">Descriptive message here.</div>
      </div>
    : data.map(item => <Row key={item.id} item={item} />)
}
```

### 6.6 Form Fields

All form field labels use the mono font in uppercase, and inputs use token sizing:

```jsx
// Field label pattern
<div style={{
  fontFamily: 'var(--mono)',
  fontSize: 'var(--fs-xs)',
  color: 'var(--text-3)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: 'var(--sp-1)',
}}>
  {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
</div>
<input style={{ width: '100%', fontSize: 'var(--fs-md)' }} />
```

### 6.7 Submit Buttons

```jsx
<button
  onClick={handleSubmit}
  disabled={submitting}
  style={{
    width: '100%',
    padding: 'var(--sp-3)',
    borderRadius: 'var(--r-md)',
    background: submitting ? 'var(--hover)' : 'var(--red)',
    color: submitting ? 'var(--text-3)' : '#fff',
    fontFamily: 'var(--mono)',
    fontSize: 'var(--fs-xs)',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    border: `1px solid ${submitting ? 'var(--border)' : 'var(--red)'}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 'var(--sp-2)',
    transition: 'all var(--ease-fast)',
  }}
>
  {submitting
    ? <><SpinnerGap size={14} style={{ animation: 'spin 1s linear infinite' }} /> Saving…</>
    : <><CheckCircle size={14} /> Submit</>
  }
</button>
```

### 6.8 Icons

Use **Phosphor Icons** exclusively (`@phosphor-icons/react`). Standard sizes:
- `size={11}` — inside badges
- `size={14}` — inline with text, small buttons
- `size={16}` — list row icons
- `size={18}` — card section icons
- `size={24}` — empty state icons

---

## 7. Data & State

### 7.1 Supabase Client

Always import from `../lib/supabase.js`:

```js
import { db } from '../lib/supabase.js'
```

### 7.2 Data Fetching Pattern

```js
useEffect(() => {
  db.from('table_name')
    .select('*')
    .order('created_at', { ascending: false })
    .then(({ data, error }) => {
      if (!error && data) setRecords(data)
      setLoading(false)
    })
}, [])
```

### 7.3 Insert Pattern

```js
const { data, error } = await db
  .from('table_name')
  .insert({ ...fields })
  .select()
  .single()
```

### 7.4 Mock Data

`src/data/mockData.js` contains `JOBS`, `TECHNICIANS`, `FORM_TEMPLATES`, and `MOCK_SUBMISSIONS`. Mock data is for **UI development and demo only**. All new features must persist to Supabase.

### 7.5 Offline Support

Dexie (IndexedDB) is set up in `src/lib/offline.js` for offline-first sync. Tables:
- `pendingReports` — unsynced daily field logs
- `pendingForms` — unsynced form submissions
- `pendingPhotos` — unsynced photos
- `projectsCache` — cached project list

New offline-capable features should queue writes here and sync via `useSync.js`.

### 7.6 State Architecture

- **Page-level state only** — no global state management (no Redux, no Zustand). Use `useState` and `useEffect` per page.
- **View switching** — use a `view` string state (`'list' | 'form' | 'detail' | 'success'`) rather than nested routes for sub-views within a page.
- **Query params** — only read `useSearchParams` inside `useEffect` (not for initial `useState` values) to avoid refresh bugs.

---

## 8. Database Schema

### Tables

| Table | Purpose |
|---|---|
| `projects` | LPS project records |
| `daily_field_logs` | End-of-day field log submissions |
| `jsa_submissions` | Job Safety Analysis forms |
| `completion_forms` | Installation/Inspection/Survey/Test completions |
| `risk_assessments` | NFPA 780 Annex L site assessments |
| `form_submissions` | Generic form submissions (legacy) |
| `form_templates` | Dynamic form template definitions |
| `submission_photos` | Photos attached to submissions |
| `crew` | Crew members |
| `tasks` | Job tasks |
| `leads` | Sales leads / prospects |
| `sync_queue` | Offline sync queue |
| `relationships` | Entity relationships |

### Naming Conventions

- Table names: `snake_case`, plural
- Column names: `snake_case`
- UUIDs: always `gen_random_uuid()` as default
- Timestamps: `timestamptz DEFAULT now()`
- All new tables: include `id uuid`, `created_at timestamptz`, and a `branch text` column

### Storage Buckets

All PDFs are stored in the `field-log-pdfs` bucket on Supabase Storage:
- `reports/` — Daily Field Log PDFs
- `jsa-pdfs/` — JSA PDFs
- `completion-forms/` — Completion form PDFs

File naming: `{type}_{date}_{site-slug}_{timestamp36}.pdf`

---

## 9. PDF Generation

All forms that require a PDF follow the same generator pattern using jsPDF.

### Standard PDF Structure

1. **Header** — Navy bar with LMC wordmark, form title, SIGNED/SUBMITTED badge, date
2. **Summary strip** — 4-column info bar (site, job #, date, tech)
3. **Sections** — Navy accent bar + section title, alternating row shading
4. **Sign-off** — Signature image embedded from canvas data URL
5. **Footer** — Page number, doc reference, date on every page

### PDF Color Palette (hardcoded in generators — do not change)

```js
const NAVY    = [26,  35,  95]
const NAVY2   = [42,  55, 120]
const NAVY_LT = [235, 240, 255]
const WHITE   = [255, 255, 255]
const BG      = [248, 249, 252]
const BORDER  = [218, 222, 232]
const LABEL   = [107, 114, 128]
const TEXT    = [17,  24,  39]
const GREEN   = [22,  163, 74]
const GREEN_BG = [240, 253, 244]
const GREEN_BD = [134, 239, 172]
const RED     = [220, 38,  38]
```

### Upload Pattern

After generating, always upload to Supabase Storage and return the public URL:

```js
const pdfBlob  = doc.output('blob')
const filePath = `{folder}/{type}_{date}_{slug}_{Date.now().toString(36)}.pdf`
const { error } = await db.storage
  .from('field-log-pdfs')
  .upload(filePath, pdfBlob, { contentType: 'application/pdf', upsert: true })
const { data: urlData } = db.storage.from('field-log-pdfs').getPublicUrl(filePath)
return urlData.publicUrl
```

---

## 10. Routing & Navigation

### Route Map

| Path | Page | Notes |
|---|---|---|
| `/dashboard` | Dashboard | Field overview, branch cards |
| `/installations` | Installs | Installation projects list |
| `/installations/installs/:jobId` | JobDetail | Job detail with NFPA forms |
| `/installations/installs/:jobId/form/:formId` | FormRunner | Dynamic form |
| `/inspections` | Inspections | Inspections list |
| `/daily-field-log` | DailyFieldLog | DFL close-out form |
| `/jsa` | JSA | Standalone JSA list + form |
| `/risk-assessment` | RiskAssessment | NFPA 780 Annex L calculator |
| `/forms` | Forms | Forms hub |
| `/forms/completion` | CompletionForms | Completion forms list + forms |
| `/reports` | Reports | Reports list |
| `/technicians` | Technicians | Technician management |

### Sidebar Navigation Order

```
Field Overview → Installations → Inspections → Daily Field Log →
JSA → Risk Assessment → Reports → Forms → Technicians
```

### Page Transitions

Page transitions are animated in `App.jsx`. Top-level tab navigation uses slide-left/right. Drill-down navigation uses slide-right in / slide-left out.

### Back Navigation

All sub-views and drill-down pages must include a Back button that navigates to the parent. Use the `ArrowLeft` icon from Phosphor at `size={14}`.

---

## 11. Compliance Standards

### Lightning Protection System Standards

| Standard | Scope | Used In |
|---|---|---|
| NFPA 780 | Primary national LPS design guide | All forms, Risk Assessment |
| NFPA 780 Annex L | Simplified risk assessment | Risk Assessment page |
| UL 96 | Component manufacturing standard | Completion forms |
| UL 96A | Installation standard (Master Label) | Installation Completion |
| LPI-175 | Field reference / installer checklist | FormRunner templates |
| LPI-177 | Pictorial inspection guide | Inspection Completion |

### Worker Safety Standards

| Standard | Scope | Used In |
|---|---|---|
| OSHA 29 CFR §5(a)(1) | General Duty Clause — lightning hazard | JSA |
| OSHA 1926.35 / 1910.38 | Emergency Action Plan | JSA |
| OSHA 1926.451(f)(12) | Scaffold safety in storms | JSA |
| OSHA 1926.453 | Manlift/aerial lift operations | DFL Manlift form |
| OSHA 1926.502 | Fall protection | DFL Fall Protection form |

### Form Reference Numbers

| Form | Reference |
|---|---|
| Job Safety Analysis | LMC-Form-000-008 |
| Manlift Pre-Shift Inspection | OSHA 1926.453 |
| Fall Protection Inspection | OSHA 1926.502 |

---

## 12. Branch System

### Branch Colors

Defined in `src/config/branches.js`. Always use `BRANCH_COLORS[branch]` — never hardcode branch hex values in components.

```js
BRANCH_COLORS['lm']           // Navy — Lightning Master
BRANCH_COLORS['bolt']         // Red — Bolt Florida
BRANCH_COLORS['bolt-dallas']  // Charcoal — Bolt Dallas

// Each branch has:
bc.bgActive      // Active/selected card background
bc.bgInactive    // Inactive card background
bc.textActive    // Text color when active
bc.textInactive  // Text color when inactive
```

### Job Stages

Defined in `src/lib/stages.js`. Use `stageBadgeClass(stage)` for badge class names, `stageColor(stage)` for hex colors.

```
Awarded → Scheduled → In Progress → Pending Review →
Pending Customer → Customer Signed → Complete
                                   → On Hold
                                   → Cancelled
```

---

## 13. Git & Deployment

### Workflow

- All code changes are committed directly to `main` via Claude with the GitHub token
- Vercel auto-deploys on every push to `main` (takes ~30–45 seconds)
- Production URL: https://warehouse-iq.vercel.app

### Commit Message Format

```
{scope}: {what changed}

Examples:
JSA: canvas signature pad, PDF generation, Supabase storage
RiskAssessment: wire to Supabase, fix refresh bug, rem tokens
CompletionForms: add 4 form types with PDF gen and Supabase
```

### Environment Variables

Stored in Vercel and locally in `.env` (gitignored):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

---

## 14. Do's and Don'ts

### ✅ Do

- Use `var(--text-1)` (black) as the default for all body copy, card titles, row names, and readable content
- Use `var(--text-2)` for secondary descriptions, back buttons, and subheadings
- Use `var(--text-3)` only for timestamps, IDs, mono labels, field label prefixes, and icon-only buttons
- Use white (`#fff`) for text on colored backgrounds (navy, red, branch cards)

- Use `var(--fs-*)` tokens for all font sizes
- Use `var(--sp-*)` tokens for padding and margin
- Use `var(--r-*)` tokens for border radius
- Use `var(--gap-*)` for fluid responsive gaps
- Use `clamp()` for any layout measurement that should scale
- Use `BRANCH_COLORS[branch]` for branch-specific styling
- Use `.page-content.fade-in` as the root wrapper of every page
- Load data from Supabase in `useEffect` with a `loading` state
- Handle loading, empty, and error states on every data-fetching page
- Generate PDFs with jsPDF and upload to Supabase Storage
- Use the `SyncBadge` component to reflect online/offline state
- Include compliance standard references (NFPA, OSHA, LPI) in form labels and PDF footers
- Wrap `useSearchParams` reads in `useEffect` — never use them to initialize `useState`
- Use `ArrowLeft` icon + back button on all drill-down / sub-views

### ❌ Don't

- **Never** use `--text-3` for primary readable content — headings, descriptions, empty state messages, back buttons
- **Never** hardcode hex colors in component files
- **Never** use raw `px` values — use `rem` or CSS tokens
- **Never** create new `.css` files for components — use `globals.css` or inline tokens
- **Never** use global state management libraries — keep state local to pages
- **Never** leave data as mock-only — all user-facing features must persist to Supabase
- **Never** store sensitive data (tokens, keys) in component code or Git
- **Never** use `localStorage` or `sessionStorage` — use Supabase or Dexie
- **Never** skip loading and empty states on data-fetching pages
- **Never** use a different icon library — Phosphor Icons only
- **Never** introduce new fonts — Plus Jakarta Sans and DM Mono only
- **Never** add a CSS framework (Tailwind, Bootstrap, etc.)
- **Never** read `useSearchParams` synchronously as `useState` initial value — causes refresh bugs

---

*Last updated: March 2026 — Field Ops v0.1*

# LMC Platform — Development Protocol
> Applies to: Field Ops · Warehouse IQ · Mission Control  
> Stack: React 19 · Vite 8 · React Router 7 · Supabase JS 2 · Phosphor Icons  
> Last updated: March 29, 2026

---

## 1. Before Writing Any Code

### 1.1 Read First, Write Second
- **Always read the full target file** before editing, copying, or patching it
- If adding a feature to an existing page, read every import, every state variable, and every data fetch — understand what already exists
- If copying a component from one app to another, treat it as a **rewrite**, not a copy — remove all references to the source app's routes, imports, and data contracts before saving

### 1.2 Check the Data Contract
Before seeding data or writing queries, read the actual filter/enum values the app uses:
```js
// BAD — assumed "Submitted" without checking
status: 'submitted'

// CORRECT — read the app code first, then match exactly
status: 'Submitted'   // app filters: r.status === 'Submitted'
branch: 'bolt'        // app filters: r.branch === 'bolt'
```
- For Supabase seeds: read the relevant page's `filter()` / `eq()` / `select()` calls first
- Check `CHECK` constraints before inserting: `SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'table_column_check'`

### 1.3 Verify Icon Names Before Using
Phosphor Icons has a specific set of valid names. Non-existent icons cause **immediate runtime crashes** (white screen).
- Always verify at https://phosphoricons.com before using a new icon name
- Known invalid examples: `Rocket` — does not exist in Phosphor
- When in doubt, use `MagnifyingGlass` not `Search`, `CaretRight` not `ChevronRight`

---

## 2. The Change Checklist (run before every commit)

```
[ ] Read the full file(s) being changed
[ ] Verified all new imports exist (icons, components, utils)
[ ] No duplicate imports introduced
[ ] No WH IQ / FO / MC-specific paths left in copied code
[ ] CSS classes used in JSX actually exist in globals.css
[ ] CSS variables used exist in :root (check --var-name)
[ ] Data values match app's enum/filter expectations
[ ] Component is placed in the correct scope (not inside another component)
[ ] Run local build check (see §3)
```

---

## 3. Build Check Before Every Push

**Never push without a local build check.** This catches parse errors, missing imports, and duplicate declarations before they reach Vercel.

```bash
# Run from the app directory
cd /home/claude/field-ops-git    && npm run build 2>&1 | tail -20
cd /home/claude/warehouse-iq     && npm run build 2>&1 | tail -20
cd /home/claude/mission-control-git && npm run build 2>&1 | tail -20
```

If a build fails:
1. Read the **exact error line** — Vite output is precise
2. Fix the root cause, not a symptom
3. Re-run build to confirm clean before pushing

**Common build failures and their causes:**

| Error | Cause | Fix |
|-------|-------|-----|
| `Identifier X has already been declared` | Duplicate import | Remove the second import line |
| `Cannot find module './X'` | Wrong import path | Check actual file name and path |
| `X is not defined` | Used in wrong scope | Check component boundaries |
| `Build failed with 1 error: [PARSE_ERROR]` | Invalid JSX syntax | Read the indicated line number |

---

## 4. Commit Discipline

### 4.1 One Concern Per Commit
- **Good:** `fix: remove duplicate useAuth import in PartRequest.jsx`
- **Bad:** `feat: complete activity logging across all apps` (touches 20+ files)

Small commits mean:
- Easier to identify what broke
- Easier to roll back a single change
- Cleaner git history

### 4.2 Commit Message Format
```
type: short description (50 chars max)

Longer explanation if needed. What changed and WHY.
Not what files changed — git diff shows that.
```

Types: `feat` · `fix` · `design` · `refactor` · `data` · `chore`

### 4.3 Never Push Broken Code
If a fix introduces a new error, fix that too before pushing. The production URL should always be working.

---

## 5. Cross-App Changes

When a change touches all 3 apps (design system, font scale, etc.):

1. Make the change in **one app first** and verify it looks correct
2. Confirm with a screenshot or description before applying to the other two
3. Run build on all three before pushing any of them
4. Push in order: **WH IQ → FO → MC** (least critical → most visible to COO)

### 5.1 Shared Code Rules
The three apps share the same Supabase project but are **separate repos** with separate CSS. Changes to one app's globals.css do not affect the others — they must be applied to all three explicitly.

**Design system tokens are identical across all three apps:**
```css
--fs-*, --sp-*, --r-*, --text-*, --navy, --red, --font
```
If a token changes, it must change in all three.

---

## 6. Global Search & Replace Rules

When running bulk text replacements (sed, Python, regex):

1. **Always preview first** — print what would change before writing
2. **Never match inside badge/pill/chip patterns** — `padding` + `borderRadius` together = a badge, leave it alone
3. **Never match inside `<label>` elements with form context** — form labels have different rules
4. **Run build immediately after** any bulk replacement
5. **Cap scope** — target specific files, not `src/**/*.jsx` blindly

```python
# CORRECT pattern — preview before write
matches = re.findall(pattern, content)
print(f"Would change {len(matches)} instances in {filename}")
# Only write if matches look right
```

---

## 7. Supabase Patterns

### 7.1 Schema Changes
- Always use `apply_migration` for DDL (CREATE TABLE, ALTER TABLE)
- Use `execute_sql` only for data operations (INSERT, UPDATE, SELECT)
- Before inserting data, check constraints: column types, CHECK constraints, NOT NULL

### 7.2 Reliable Query Patterns
```js
// Nullable boolean — use .neq() not .eq(..., false)
.neq('archived', true)

// Always destructure error
const { data, error } = await db.from('table').select('*')
if (error) console.error('Query failed:', error)

// Parallel reads — never chain awaits sequentially for independent queries
const [{ data: a }, { data: b }] = await Promise.all([
  db.from('table_a').select('*'),
  db.from('table_b').select('*'),
])
```

### 7.3 Performance — Parallelize Writes
When performing multiple DB writes in sequence (e.g., inventory deductions), use `Promise.all` — sequential awaits on 20+ rows can take 30+ seconds on mobile and appear as a hang.

```js
// BAD — sequential, hangs on large datasets
for (const item of items) {
  await db.from('table').insert(item)
}

// GOOD — parallel
await Promise.all(items.map(item => db.from('table').insert(item)))
```

### 7.4 Error Handling on User Actions
Every user-triggered DB operation must have a `try/catch` that:
- Resets the loading/disabled state (`setPushing(false)`)
- Shows a visible error message (not just `console.error`)
- Never leaves the UI in a permanently stuck loading state

```js
const handleSubmit = async () => {
  setLoading(true)
  try {
    await db.from('table').insert(payload)
    setDone(true)
    navigate('/next-page')
  } catch (err) {
    console.error('Submit failed:', err)
    alert(`Something went wrong: ${err.message}`)
    setLoading(false)  // reset so user can retry
  }
}
```

---

## 8. CSS & Design System Rules

### 8.1 No Hardcoded Pixel Sizes
All font sizes must use CSS tokens, never raw pixel values:
```js
// BAD
fontSize: 11
fontSize: '10px'

// GOOD
fontSize: 'var(--fs-xs)'
fontSize: 'var(--fs-sm)'
```

Token reference:
| Token | Size | Use |
|-------|------|-----|
| `--fs-2xs` | 10–11px | Timestamps, meta, section labels |
| `--fs-xs` | 12–13px | Subtitles, badges, secondary text |
| `--fs-sm` | 14–15px | Row primary text, body copy |
| `--fs-base` | 15–16px | Default body, inputs |
| `--fs-md` | 16–17px | Subheadings, action labels |
| `--fs-lg` | 17–18px | Section headings |
| `--fs-xl` | 18–20px | Page titles |
| `--fs-stat` | 22–24px | Dashboard stat values |
| `--fs-2xl` | 16px | PIN pad (fixed, do not change) |

### 8.2 Row Typography Standard
All list rows across all three apps follow this pattern:
- **Primary text** (name, title, SO number): `--fs-sm` + weight 600–700
- **Secondary text** (location, date, subtitle): `--fs-xs` + `text-2` or `text-3`
- **Status badges** (have padding + borderRadius): `--fs-xs` + bold — intentionally smaller

### 8.3 Labels — No Uppercase on Data
- Section labels (`ACCOUNT`, `MENU`): uppercase ✓ (navigational, intentional)
- Badges / pills / chips (have `padding` + `borderRadius`): uppercase ✓
- Data labels, stat card labels, form labels, row headers: **no uppercase**, Title Case, `text-2`, weight 600

### 8.4 New CSS Classes
Before adding a new CSS class in JSX, confirm it exists in `globals.css`. If it doesn't exist, either:
1. Add it to globals.css in the correct section, or
2. Use an inline style instead

---

## 9. Component Placement Rules

### 9.1 Helper Functions and Sub-Components
Never define a sub-component inside another component's function body. Always define at module level:

```jsx
// BAD — defined inside the parent
export default function ParentPage() {
  function HelperCard() { ... }  // ❌ recreated on every render
  return <HelperCard />
}

// GOOD — defined at module level
function HelperCard() { ... }    // ✓ stable reference

export default function ParentPage() {
  return <HelperCard />
}
```

### 9.2 Scope Awareness When Pasting
When inserting code blocks (especially action buttons or JSX sections), always check:
- Are you inside the correct function?
- Are all referenced variables (`po`, `navigate`, `user`) in scope?
- Does the closing brace structure still match after insertion?

---

## 10. Deployment Verification

After every push, verify the deployment:

1. **Check Vercel build state** — must be `READY`, not `ERROR`
2. **Check the specific URL** that was changed — not just the homepage
3. **Check on mobile** if the change touched layout, fonts, or navigation
4. **For data changes** — open the page and confirm data actually shows

**Deploy IDs:**
| App | Vercel Project ID |
|-----|------------------|
| Field Ops | `prj_wYzXjlpDCGRA4hw5jRIIgerrETyI` |
| Warehouse IQ | `prj_lGLV1gTkyhfZAbmwhJ7dNhCLUqA5` |
| Mission Control | `prj_kyJdIOiaPtmeVWd2ePWiTeowbHvg` |

If a deploy is `ERROR`, check build logs **before** making another commit.  
If a deploy is `READY` but page is white/broken, it's a **runtime error** — check the browser console and the specific component that changed.

---

## 11. Known Platform Constraints

| Constraint | Detail |
|-----------|--------|
| iOS Safari `100vh` | Use `height: 100%` on `.app`, not `100vh` — Safari's toolbar inflates `100vh` |
| Supabase RLS recursion | Use `SECURITY DEFINER` functions for role checks — never self-referential subqueries in policies |
| Vite `VERCEL_FORCE_NO_BUILD_CACHE=1` | Remove from all 3 Vercel projects before launch — slows every build |
| `.env.local` is gitignored | Supabase env vars must be in `.env` (committed) or set in Vercel dashboard — never hardcoded |
| Phosphor Icons | Import from `@phosphor-icons/react` — verify names at phosphoricons.com before use |
| React 19 + Vite 8 | Use `function` declarations for components, not arrow functions at module level — avoids hoisting issues |

---

## 12. When Something Breaks in Production

1. **Don't panic-push a fix** — read the error first
2. Check Vercel build logs (build error) vs browser console (runtime error)
3. Identify the **exact commit** that introduced the break using deployment history
4. Fix the root cause — not a workaround
5. Run local build before pushing the fix
6. Verify the fix on the actual URL after deploy

**Rollback option:** Any Vercel deployment marked `isRollbackCandidate: true` can be promoted to production instantly from the Vercel dashboard — use this if a fix is taking too long.

---

## 13. Pre-Launch Checklist

Before this platform goes to production users:

```
[ ] Remove VERCEL_FORCE_NO_BUILD_CACHE=1 from all 3 Vercel projects
[ ] All 3 apps build clean with zero errors
[ ] Supabase RLS policies tested for all 3 roles (admin, manager, field)
[ ] PIN auth required on all 3 apps — no bypass paths
[ ] All mock/seed data is clearly labelled or removed
[ ] Error boundaries added to main routes (prevent full white screens)
[ ] Mobile layout tested on actual iOS Safari (not just desktop responsive view)
[ ] All hardcoded test UUIDs replaced with dynamic references
[ ] QB Desktop credentials stored as Vercel env vars (not in code)
[ ] VERCEL_FORCE_NO_BUILD_CACHE removed (deploy time improvement)
```

---

*This document should be updated whenever a new class of bug is discovered or a new pattern is established.*

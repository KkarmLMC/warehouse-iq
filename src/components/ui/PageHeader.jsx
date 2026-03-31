/**
 * PageHeader
 * Standard page title block used at the top of every page.
 *
 * Props:
 *   eyebrow  — small uppercase label above title e.g. "MISSION CONTROL"
 *   title    — main page title (required)
 *   subtitle — optional muted line below title
 *   action   — optional JSX rendered top-right (e.g. a button)
 */
export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div style={{ marginBottom: 'var(--space-l)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-m)' }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-muted)', letterSpacing: 'var(--ls-2xs)', textTransform: 'uppercase', marginBottom: 'var(--space-xs)' }}>
            {eyebrow}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', lineHeight: 'var(--lh-xxl)', color: 'var(--text-primary)' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>
            {subtitle}
          </div>
        )}
      </div>
      {action && (
        <div style={{ flexShrink: 0 }}>{action}</div>
      )}
    </div>
  )
}

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
    <div style={{ marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-3)' }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            {eyebrow}
          </div>
        )}
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, lineHeight: 1.15, color: 'var(--black)' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', marginTop: 4 }}>
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

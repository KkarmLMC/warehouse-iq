/**
 * FilterPills
 * Horizontal scrollable pill filter tabs.
 * Used on list pages to filter by status, stage, category etc.
 *
 * Props:
 *   options  — array of { key, label, count? } OR array of strings
 *   active   — currently active key
 *   onChange — (key) => void
 */
export default function FilterPills({ options, active, onChange }) {
  const items = options.map(o =>
    typeof o === 'string' ? { key: o, label: o } : o
  )

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--gap-s)',
      overflowX: 'auto',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
      paddingBottom: 2,
    }}>
      {items.map(({ key, label, count }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--r-full)',
              border: '1px solid var(--border)',
              background: isActive ? 'var(--navy)' : 'var(--white)',
              color: isActive ? '#fff' : 'var(--black)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all var(--ease-fast)',
              flexShrink: 0,
            }}
          >
            {label}{count != null ? ` (${count})` : ''}
          </button>
        )
      })}
    </div>
  )
}

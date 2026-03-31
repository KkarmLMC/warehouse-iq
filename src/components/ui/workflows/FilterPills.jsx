/**
 * FilterPills
 * Horizontal scrollable pill filter tabs — token-driven, BEM, flat UI.
 * Replaces all inline styles with CSS classes.
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
    <div className="filter-pills">
      {items.map(({ key, label, count }) => {
        const isActive = active === key
        return (
          <button
            key={key}
            className={`filter-pills__item ${isActive ? 'filter-pills__item--active' : ''}`}
            onClick={() => onChange(key)}
          >
            {label}{count != null ? ` (${count})` : ''}
          </button>
        )
      })}
    </div>
  )
}

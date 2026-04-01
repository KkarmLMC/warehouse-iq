/**
 * FilterPills
 * Horizontal scrollable pill filter tabs.
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
            onClick={() => onChange(key)}
            className={`filter-pills__item${isActive ? ' filter-pills__item--active' : ''}`}
          >
            {label}{count != null ? ` (${count})` : ''}
          </button>
        )
      })}
    </div>
  )
}

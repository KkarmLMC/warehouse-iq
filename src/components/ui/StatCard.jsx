/**
 * StatCard
 * Dashboard metric card. Used in grids of 2–4 across all apps.
 *
 * Props:
 *   label     — metric label e.g. "Open Sales Orders"
 *   value     — metric value e.g. "87" or "$1,175,491"
 *   color     — optional CSS color for the value (defaults to --black)
 *   onClick   — optional click handler
 *   sub       — optional small line below value e.g. "Across 87 leads"
 */
export default function StatCard({ label, value, color, onClick, sub }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 'var(--mar-xs)' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

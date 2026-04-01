/**
 * StatCard
 * Dashboard metric card. Used in grids of 2–4 across all apps.
 *
 * Props:
 *   label     — metric label e.g. "Open Sales Orders"
 *   value     — metric value e.g. "87" or "$1,175,491"
 *   color     — optional CSS color for the value (data-driven)
 *   onClick   — optional click handler
 *   sub       — optional small line below value
 */
export default function StatCard({ label, value, color, onClick, sub }) {
  return (
    <div
      className="stat-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="stat-card__label">{label}</div>
      <div className="stat-card__value" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-meta">{sub}</div>}
    </div>
  )
}

/**
 * StatCard
 * Dashboard metric card — upgraded to token-only, zero inline styles.
 *
 * Props:
 *   label   — metric label e.g. "Open Sales Orders"
 *   value   — metric value e.g. "87" or "$1,175,491"
 *   tone    — optional color tone: 'red' | 'blue' | 'green' | 'amber' | 'orange'
 *   delta   — optional delta text e.g. "+12%"
 *   meta    — optional small line below value
 *   onClick — optional click handler
 */
const TONE_MAP = {
  red:    'stat-value--red',
  blue:   'stat-value--blue',
  green:  'stat-value--green',
  amber:  'stat-value--amber',
  orange: 'stat-value--orange',
}

export default function StatCard({ label, value, tone, delta, meta, onClick }) {
  const valueCls = ['stat-value', TONE_MAP[tone] || ''].filter(Boolean).join(' ')

  return (
    <div
      className="stat-card"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="stat-label">{label}</div>
      <div className={valueCls}>
        {value}
        {delta && <span className="stat-delta">{delta}</span>}
      </div>
      {meta && <div className="stat-meta">{meta}</div>}
    </div>
  )
}

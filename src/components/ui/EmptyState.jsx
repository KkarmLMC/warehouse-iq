/**
 * EmptyState
 * Zero-data placeholder used on 11+ pages across the platform.
 *
 * Props:
 *   icon     — Phosphor icon component
 *   title    — main empty message e.g. "No sales orders found"
 *   desc     — optional secondary line
 *   action   — optional JSX (e.g. a button to create the first item)
 */
export default function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="empty">
      {Icon && (
        <Icon size={36} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
      )}
      {title && <div className="empty-title">{title}</div>}
      {desc  && <div className="empty-desc">{desc}</div>}
      {action && <div style={{ marginTop: 'var(--mar-m)' }}>{action}</div>}
    </div>
  )
}

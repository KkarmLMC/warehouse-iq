/**
 * EmptyState
 * Zero-data placeholder — token-driven, BEM, flat UI.
 *
 * Props:
 *   icon    — Phosphor icon component
 *   title   — main empty message e.g. "No sales orders found"
 *   desc    — optional secondary line
 *   action  — optional JSX (e.g. a button to create the first item)
 */
export default function EmptyState({ icon: Icon, title, desc, action }) {
  return (
    <div className="empty">
      {Icon && <Icon size="2.25rem" className="empty-icon" />}
      {title && <div className="empty-title">{title}</div>}
      {desc  && <div className="empty-desc">{desc}</div>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  )
}

/**
 * Card
 * Standard content card with optional navy header.
 * Replaces the repeated .card + .card-header + .card-title pattern.
 *
 * Props:
 *   title      — header title text
 *   icon       — Phosphor icon component for header
 *   action     — JSX rendered right side of header (e.g. "View all →" link)
 *   onAction   — click handler for the header (makes it navigable)
 *   children   — card body content
 *   noPad      — skip default body padding
 *   style      — additional style overrides for the card container
 */
export default function Card({ title, icon: Icon, action, onAction, children, noPad, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div
          className="card-header"
          onClick={onAction}
          style={{ cursor: onAction ? 'pointer' : 'default' }}
        >
          <span className="card-title">
            {Icon && <Icon size={15} style={{ marginRight: 6 }} />}
            {title}
          </span>
          {action && (
            <span style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.55)', display: 'flex', alignItems: 'center', gap: 4 }}>
              {action}
            </span>
          )}
        </div>
      )}
      <div style={noPad ? undefined : undefined}>
        {children}
      </div>
    </div>
  )
}

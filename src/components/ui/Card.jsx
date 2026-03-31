/**
 * Card
 * Standard content card with optional navy header.
 *
 * Props:
 *   title      — header title text (--text-base, 700, white)
 *   icon       — Phosphor icon component — size 16, white (no color override)
 *   meta       — right-side meta text (--text-sm, 55% white) e.g. counts, "3 items"
 *   action     — right-side action text/JSX (--text-sm, full white, 600) e.g. "View all →"
 *   onAction   — click handler for the whole header row
 *   children   — card body content
 *   style      — additional style for the card container
 */
export default function Card({ title, icon: Icon, meta, action, onAction, children, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div
          className="list-card__header"
          onClick={onAction}
          style={{ cursor: onAction ? 'pointer' : 'default' }}
        >
          <span className="list-card__title">
            {Icon && <Icon size="1rem" />}
            {title}
          </span>
          {meta   && <span className="list-card__meta">{meta}</span>}
          {action && <span className="list-card__action">{action}</span>}
        </div>
      )}
      {children}
    </div>
  )
}

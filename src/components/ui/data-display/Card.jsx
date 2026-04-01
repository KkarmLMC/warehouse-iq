/**
 * Card
 * Standard content card with optional navy header.
 *
 * Props:
 *   title      — header title text
 *   icon       — Phosphor icon component
 *   meta       — right-side meta text e.g. "3 items"
 *   action     — right-side action text/JSX
 *   onAction   — click handler for the whole header row
 *   children   — card body content
 *   style      — additional style for the card container (data-driven)
 */
export default function Card({ title, icon: Icon, meta, action, onAction, children, style }) {
  return (
    <div className="card" style={style}>
      {title && (
        <div
          className="list-card__header"
          onClick={onAction}
          role={onAction ? 'button' : undefined}
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

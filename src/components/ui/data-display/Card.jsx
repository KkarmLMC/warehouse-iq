/**
 * Card
 * Standard content card with optional navy header — upgraded to BEM/token-only.
 * Replaces inline styles with CSS classes from globals.css.
 *
 * Props:
 *   title    — header title text
 *   icon     — Phosphor icon component for header
 *   meta     — right-side meta text e.g. "3 items"
 *   action   — right-side action JSX e.g. "View all →"
 *   onAction — click handler for the whole header row
 *   tone     — 'default' | 'subtle' — card background variant
 *   padding  — 'none' | 'sm' | 'md' | 'lg' — body padding
 *   children — card body content
 *   className — additional class names
 */
export default function Card({
  title,
  icon: Icon,
  meta,
  action,
  onAction,
  tone,
  padding,
  children,
  className = '',
}) {
  const cardCls = [
    'card',
    tone === 'subtle' && 'card--subtle',
    className,
  ].filter(Boolean).join(' ')

  const bodyCls = [
    'card-body',
    padding === 'sm' && 'card-body--pad-sm',
    padding === 'md' && 'card-body--pad-md',
    padding === 'lg' && 'card-body--pad-lg',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardCls}>
      {title && (
        <div
          className="list-card__header"
          onClick={onAction}
          role={onAction ? 'button' : undefined}
          tabIndex={onAction ? 0 : undefined}
        >
          <span className="list-card__title">
            {Icon && <Icon size="1rem" />}
            {title}
          </span>
          {meta   && <span className="list-card__meta">{meta}</span>}
          {action && <span className="list-card__action">{action}</span>}
        </div>
      )}
      {padding && padding !== 'none'
        ? <div className={bodyCls}>{children}</div>
        : children}
    </div>
  )
}

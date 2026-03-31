/**
 * RowItem
 * Standard list row — the single most repeated pattern across all three apps.
 * Upgraded: zero structural inline styles, fully BEM/token-driven.
 *
 * Props:
 *   icon      — Phosphor icon component
 *   title     — primary text
 *   subtitle  — secondary text
 *   right     — JSX for the right side (value, badge, etc.)
 *   onClick   — click handler; adds caret and hover
 *   last      — if true, removes bottom border
 *   noPad     — removes horizontal padding (for use i(
ide card)
 *   className — additional class names
 */
import { CaretRight } from '@phosphor-icons/react'

export default function RowItem({
  icon: Icon,
  title,
  subtitle,
  right,
  onClick,
  last,
  noPad,
  className = '',
}) {
  const cls = [
    'row-item',
    onClick && 'row-item--clickable',
    last && 'row-item--last',
    noPad && 'row-item--no-pad',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} onClick={onClick} role={onClick ? 'button' : undefined} tabIndex={onClick ? 0 : undefined}>
      {Icon && (
        <span className="row-item__icon">
          <Icon size="1.125rem" />
        </span>
      )}

      <div className="row-item__body">
        <div className="row-item__title">{title}</div>
        {subtitle && <div className="row-item__subtitle">{subtitle}</div>}
      </div>

      {right && <div className="row-item__right">{right}</div>}

      {onClick && (
        <span className="row-item__caret">
          <CaretRight size="0.875rem" />
        </span>
      )}
    </div>
  )
}

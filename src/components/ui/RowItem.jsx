/**
 * RowItem
 * Standard list row — the single most repeated pattern across all three apps.
 *
 * Props:
 *   icon       — Phosphor icon component e.g. Receipt
 *   iconColor  — icon color override (data-driven)
 *   title      — primary text
 *   subtitle   — secondary text
 *   right      — JSX for the right side (value, badge, etc.)
 *   onClick    — click handler; adds cursor pointer + hover
 *   last       — if true, removes bottom border
 *   noPad      — removes horizontal padding (for use inside card)
 */
import { CaretRight } from '@phosphor-icons/react'

export default function RowItem({ icon: Icon, iconColor, title, subtitle, right, onClick, last, noPad }) {
  const cls = ['row-item',
    last && 'row-item--last',
    noPad && 'row-item--no-pad',
    onClick && 'row-item--clickable',
  ].filter(Boolean).join(' ')

  return (
    <div className={cls} onClick={onClick}>
      {Icon && (
        <Icon size="1.125rem" className="row-item__icon" style={iconColor ? { color: iconColor } : undefined} />
      )}
      <div className="row-item__body">
        <div className="row-item__title">{title}</div>
        {subtitle && (
          <div className="row-item__subtitle">{subtitle}</div>
        )}
      </div>
      {right && (
        <div className="row-item__right">{right}</div>
      )}
      {onClick && (
        <CaretRight size="0.875rem" className="row-item__caret" />
      )}
    </div>
  )
}

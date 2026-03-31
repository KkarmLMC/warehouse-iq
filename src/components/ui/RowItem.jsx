/**
 * RowItem
 * Standard list row — the single most repeated pattern across all three apps.
 *
 * Props:
 *   icon       — Phosphor icon component e.g. Receipt
 *   iconColor  — icon color (defaults to --black)
 *   title      — primary text (--text-sm, weight 600)
 *   subtitle   — secondary text (--text-xs, text-3)
 *   right      — JSX for the right side (value, badge, etc.)
 *   onClick    — click handler; adds cursor pointer + hover
 *   last       — if true, removes bottom border
 *   noPad      — removes horizontal padding (for use inside card)
 */
import { CaretRight } from '@phosphor-icons/react'

export default function RowItem({ icon: Icon, iconColor, title, subtitle, right, onClick, last, noPad }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--gap-m)',
        padding: noPad ? 'var(--pad-m) 0' : 'var(--pad-m) var(--pad-l)',
        borderBottom: last ? 'none' : '1px solid var(--border-l)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--ease-fast)' }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {Icon && (
        <Icon size="1.125rem" style={{ color: iconColor || 'var(--black)', flexShrink: 0 }} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--text-sm)', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--black)' }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 'var(--text-xs)', color: 'var(--text-3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 1 }}>
            {subtitle}
          </div>
        )}
      </div>

      {right && (
        <div style={{ flexShrink: 0 }}>{right}</div>
      )}

      {onClick && (
        <CaretRight size="0.875rem" style={{ color: 'var(--black)', flexShrink: 0 }} />
      )}
    </div>
  )
}

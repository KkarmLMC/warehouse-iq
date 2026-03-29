/**
 * RowItem
 * Standard list row — the single most repeated pattern across all three apps.
 * Replaces the 36×36 icon container + flex row + caret pattern.
 *
 * Props:
 *   icon       — Phosphor icon component e.g. Receipt
 *   iconColor  — icon color (defaults to --navy)
 *   iconBg     — icon container background (defaults to --surface-raised)
 *   title      — primary text (--fs-sm, weight 600)
 *   subtitle   — secondary text (--fs-xs, text-3)
 *   right      — JSX for the right side (value, badge, etc.)
 *   onClick    — click handler; adds cursor pointer + hover
 *   last       — if true, removes bottom border
 *   noPad      — removes horizontal padding (for use inside card)
 */
import { CaretRight } from '@phosphor-icons/react'

export default function RowItem({ icon: Icon, iconColor, iconBg, title, subtitle, right, onClick, last, noPad }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--sp-3)',
        padding: noPad ? 'var(--sp-3) 0' : 'var(--sp-3) var(--sp-4)',
        borderBottom: last ? 'none' : '1px solid var(--border-l)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'background var(--ease-fast)',
      }}
      onMouseEnter={e => { if (onClick) e.currentTarget.style.background = 'var(--hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {Icon && (
        <div style={{
          width: 36, height: 36,
          borderRadius: 'var(--r-lg)',
          background: iconBg || 'var(--surface-raised)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={16} style={{ color: iconColor || 'var(--navy)' }} />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--fs-sm)', fontWeight: 600,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          color: 'var(--text-1)',
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: 'var(--fs-xs)', color: 'var(--text-3)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginTop: 1,
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {right && (
        <div style={{ flexShrink: 0 }}>{right}</div>
      )}

      {onClick && (
        <CaretRight size={14} style={{ color: 'var(--text-2)', flexShrink: 0 }} />
      )}
    </div>
  )
}

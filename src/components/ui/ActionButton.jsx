/**
 * ActionButton
 * Full-width contextual action button used at the bottom of detail pages.
 *
 * Props:
 *   label    — primary button text
 *   sub      — optional subtitle/description line
 *   onClick  — click handler
 *   color    — background color override (data-driven, rare)
 *   disabled — disables the button
 *   loading  — shows spinner instead of icon
 *   done     — shows checkmark, disables interaction
 *   icon     — optional Phosphor icon override (defaults to ArrowRight)
 */
import { ArrowRight, CheckCircle, SpinnerGap } from '@phosphor-icons/react'

export default function ActionButton({ label, sub, onClick, color, disabled, loading, done, icon: Icon }) {
  const isDisabled = disabled || loading || done
  const RightIcon = done ? CheckCircle : loading ? SpinnerGap : (Icon || ArrowRight)

  const cls = ['action-btn',
    done ? 'action-btn--done action-btn--success'
      : isDisabled ? 'action-btn--disabled action-btn--navy'
      : 'action-btn--navy',
  ].join(' ')

  return (
    <button
      className={cls}
      onClick={!isDisabled ? onClick : undefined}
      disabled={isDisabled}
      style={color && !isDisabled ? { background: color } : undefined}
    >
      <div className="action-btn__text">
        <span className="action-btn__label">{label}</span>
        {sub && <span className="action-btn__sub">{sub}</span>}
      </div>
      <RightIcon
        size="1.25rem"
        weight={done ? 'fill' : 'bold'}
        className={`action-btn__icon${loading ? ' anim-spin' : ''}`}
        className="action-btn__icon"
      />
    </button>
  )
}

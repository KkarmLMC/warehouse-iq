/**
 * ActionButton
 * Full-width contextual action button — token-driven, BEM, flat UI.
 * Used at the bottom of detail pages for primary workflow actions.
 *
 * Props:
 *   label    — primary button text
 *   sub      — optional subtitle/description line
 *   onClick  — click handler
 *   variant  — 'navy' | 'primary' | 'success'  (default: 'navy')
 *   disabled — disables the button
 *   loading  — shows spinner
 *   done     — shows checkmark, disables interaction
 *   icon     — optional Phosphor icon override (defaults to ArrowRight)
 */
import { ArrowRight, CheckCircle, SpinnerGap } from '@phosphor-icons/react'

const VARIANT_MAP = {
  navy:    'action-btn--navy',
  primary: 'action-btn--primary',
  success: 'action-btn--success',
}

export default function ActionButton({
  label,
  sub,
  onClick,
  variant = 'navy',
  disabled,
  loading,
  done,
  icon: Icon,
}) {
  const isDisabled = disabled || loading || done
  const RightIcon = done ? CheckCircle : loading ? SpinnerGap : (Icon || ArrowRight)

  const cls = [
    'action-btn',
    VARIANT_MAP[variant] || VARIANT_MAP.navy,
    isDisabled && 'action-btn--disabled',
    done && 'action-btn--done',
    loading && 'action-btn--loading',
  ].filter(Boolean).join(' ')

  return (
    <button
      className={cls}
      onClick={!isDisabled ? onClick : undefined}
      disabled={isDisabled}
    >
      <div className="action-btn__text">
        <span className="action-btn__label">{label}</span>
        {sub && <span className="action-btn__sub">{sub}</span>}
      </div>
      <RightIcon
        size="1.25rem"
        weight={done ? 'fill' : 'bold'}
        className={loading ? 'anim-spin' : ''}
      />
    </button>
  )
}

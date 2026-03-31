/**
 * Button
 * Base button primitive — token-driven, flat UI, BEM structure.
 *
 * Variants: primary | navy | secondary | ghost | black
 * Sizes:    default | sm
 *
 * Props:
 *   variant   — 'primary' | 'navy' | 'secondary' | 'ghost' | 'black'  (default: 'primary')
 *   size      — 'sm' | undefined
 *   full      — if true, renders full-width
 *   icon      — optional leading Phosphor icon component
 *   iconRight — optional trailing Phosphor icon component
 *   children  — button label
 *   disabled  — disables the button
 *   loading   — shows spinner, disables interaction
 *   type      — 'button' | 'submit' | 'reset'  (default: 'button')
 *   onClick   — click handler
 *   className — additional class names
 */
import { SpinnerGap } from '@phosphor-icons/react'

const VARIANT_MAP = {
  primary:   'btn--primary',
  navy:      'btn--navy',
  secondary: 'btn--secondary',
  ghost:     'btn--ghost',
  black:     'btn--black',
}

export default function Button({
  variant = 'primary',
  size,
  full,
  icon: Icon,
  iconRight: IconRight,
  children,
  disabled,
  loading,
  type = 'button',
  onClick,
  className = '',
}) {
  const cls = [
    'btn',
    VARIANT_MAP[variant] || VARIANT_MAP.primary,
    size === 'sm' && 'btn--sm',
    full && 'btn--full',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={cls}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading
        ? <SpinnerGap size="1em" className="anim-spin" />
        : Icon && <Icon size="1em" />}
      {children}
      {IconRight && !loading && <IconRight size="1em" />}
    </button>
  )
}

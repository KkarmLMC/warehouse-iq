/**
 * IconButton
 * Minimal button with just an icon — for header controls, row actions, nav.
 * Token-driven, flat UI, BEM structure.
 *
 * Props:
 *   icon      — Phosphor icon component (required)
 *   label     — accessible aria-label (required)
 *   variant   — 'ghost' | 'secondary' | 'primary'  (default: 'ghost')
 *   size      — 'sm' | 'md' | 'lg'  (default: 'md')
 *   onClick   — click handler
 *   disabled  — disables the button
 *   className — additional class names
 */
const SIZE_MAP = {
  sm: 'icon-btn--sm',
  md: '',
  lg: 'icon-btn--lg',
}

const VARIANT_MAP = {
  ghost:     'icon-btn--ghost',
  secondary: 'icon-btn--secondary',
  primary:   'icon-btn--primary',
}

const ICON_SIZE = {
  sm: '0.875rem',
  md: '1.125rem',
  lg: '1.25rem',
}

export default function IconButton({
  icon: Icon,
  label,
  variant = 'ghost',
  size = 'md',
  onClick,
  disabled,
  className = '',
}) {
  const cls = [
    'icon-btn',
    VARIANT_MAP[variant] || '',
    SIZE_MAP[size] || '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <button
      className={cls}
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      <Icon size={ICON_SIZE[size] || ICON_SIZE.md} />
    </button>
  )
}

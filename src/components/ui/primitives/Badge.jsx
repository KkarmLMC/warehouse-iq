/**
 * Badge
 * Inline label badge — token-driven, flat UI, BEM.
 *
 * Props:
 *   children  — badge content
 *   tone      — 'info' | 'success' | 'warning' | 'error' | 'neutral' | 'purple' | 'orange'
 *   size      — 'sm' | 'md' (default: 'md')
 *   className — additional class names
 */
const TONE_MAP = {
  info:    'badge--info',
  success: 'badge--complete',
  warning: 'badge--scheduled',
  error:   'badge--review',
  neutral: 'badge--neutral',
  purple:  'badge--customer',
  orange:  'badge--inprogress',
}

export default function Badge({
  children,
  tone = 'neutral',
  size,
  className = '',
}) {
  const cls = [
    'badge',
    TONE_MAP[tone] || '',
    size === 'sm' && 'badge--sm',
    className,
  ].filter(Boolean).join(' ')

  return (
    <span className={cls}>
      {children}
    </span>
  )
}

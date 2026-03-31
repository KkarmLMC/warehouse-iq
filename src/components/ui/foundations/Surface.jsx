/**
 * Surface
 * Generic flat container — the building block for cards, panels, sections.
 * Token-driven, flat UI, BEM.
 *
 * Props:
 *   tone      — 'base' | 'subtle' | 'raised' | 'page' | 'inverse'  (default: 'base')
 *   padding   — 'none' | 'sm' | 'md' | 'lg'  (default: 'md')
 *   radius    — 'none' | 'sm' | 'md' | 'lg'  (default: 'md')
 *   children  — content
 *   className — additional class names
 *   as        — HTML element to render as (default: 'div')
 */
const TONE_MAP = {
  base:    'surface--base',
  subtle:  'surface--subtle',
  raised:  'surface--raised',
  page:    'surface--page',
  inverse: 'surface--inverse',
}

const PAD_MAP = {
  none: 'surface--pad-none',
  sm:   'surface--pad-sm',
  md:   'surface--pad-md',
  lg:   'surface--pad-lg',
}

const RADIUS_MAP = {
  none: 'surface--radius-none',
  sm:   'surface--radius-sm',
  md:   'surface--radius-md',
  lg:   'surface--radius-lg',
}

export default function Surface({
  tone = 'base',
  padding = 'md',
  radius = 'md',
  children,
  className = '',
  as: Tag = 'div',
  ...rest
}) {
  const cls = [
    'surface',
    TONE_MAP[tone] || TONE_MAP.base,
    PAD_MAP[padding] || PAD_MAP.md,
    RADIUS_MAP[radius] || RADIUS_MAP.md,
    className,
  ].filter(Boolean).join(' ')

  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  )
}

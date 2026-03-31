/**
 * Spinner
 * Loading indicator — token-driven, flat UI, BEM.
 * Replaces the old inline-styled Spinner with CSS-class-driven rendering.
 *
 * Props:
 *   inline  — renders inline (no centering wrapper)
 *   size    — 'sm' | 'md' (default) | 'lg'
 *   label   — optional text next to spinner
 */
export default function Spinner({ inline, size, label }) {
  const sizeClass = size === 'sm' ? 'spinner--sm' : size === 'lg' ? 'spinner--lg' : ''

  const inner = (
    <div className="spinner__inner">
      <div className={`spinner ${sizeClass}`} />
      {label && <span className="spinner__label">{label}</span>}
    </div>
  )

  if (inline) return inner

  return (
    <div className="loading">
      {inner}
    </div>
  )
}

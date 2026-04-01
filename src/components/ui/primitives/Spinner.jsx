/**
 * Spinner
 * Loading state. Centered by default, inline variant available.
 *
 * Props:
 *   inline  — renders inline (no centering wrapper)
 *   size    — 'sm' | 'md' (default) | 'lg'
 *   label   — optional text next to spinner
 */
export default function Spinner({ inline, size, label }) {
  const s = size === 'sm' ? 'spinner--sm' : size === 'lg' ? 'spinner--lg' : ''

  const el = (
    <div className="spinner__inner">
      <div className={`spinner ${s}`} />
      {label && <span className="spinner__label">{label}</span>}
    </div>
  )

  if (inline) return el

  return (
    <div className="spinner-content">
      {el}
    </div>
  )
}

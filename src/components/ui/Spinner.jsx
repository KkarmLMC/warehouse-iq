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
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
      <div className={`spinner ${s}`} />
      {label && <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>{label}</span>}
    </div>
  )

  if (inline) return el

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 'var(--sp-10)',
    }}>
      {el}
    </div>
  )
}

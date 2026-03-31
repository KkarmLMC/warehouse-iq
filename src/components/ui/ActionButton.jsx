/**
 * ActionButton
 * Full-width contextual action button used at the bottom of detail pages.
 * (SO detail → Run Order, Fulfillment, Shipment, etc.)
 *
 * Props:
 *   label    — primary button text
 *   sub      — optional subtitle/description line
 *   onClick  — click handler
 *   color    — background color (defaults to --navy)
 *   disabled — disables the button
 *   loading  — shows spinner instead of icon
 *   done     — shows checkmark, disables interaction
 *   icon     — optional Phosphor icon override (defaults to ArrowRight)
 */
import { ArrowRight, CheckCircle, SpinnerGap } from '@phosphor-icons/react'

export default function ActionButton({ label, sub, onClick, color, disabled, loading, done, icon: Icon }) {
  const isDisabled = disabled || loading || done
  const RightIcon = done ? CheckCircle : loading ? SpinnerGap : (Icon || ArrowRight)

  return (
    <button
      onClick={!isDisabled ? onClick : undefined}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-l) var(--space-xl)',
        borderRadius: 'var(--radius-m)',
        background: isDisabled ? 'var(--text-muted)' : (color || 'var(--brand-primary)'),
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        marginBottom: 'var(--space-2xl)',
        opacity: isDisabled && !done ? 0.7 : 1,
        transition: 'opacity var(--ease-fast), background var(--ease-fast)' }}
    >
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#fff' }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <RightIcon
        size="1.25rem"
        weight={done ? 'fill' : 'bold'}
        style={{
          color: '#fff',
          flexShrink: 0,
          animation: loading ? 'anim-spin 0.8s linear infinite' : 'none' }}
      />
    </button>
  )
}

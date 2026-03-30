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
        padding: 'var(--sp-4) var(--sp-5)',
        borderRadius: 'var(--r-xl)',
        background: isDisabled ? 'var(--text-3)' : (color || 'var(--navy)'),
        border: 'none',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        marginBottom: 'var(--sp-6)',
        opacity: isDisabled && !done ? 0.7 : 1,
        transition: 'opacity var(--ease-fast), background var(--ease-fast)',
      }}
    >
      <div style={{ textAlign: 'left' }}>
        <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#fff' }}>
          {label}
        </div>
        {sub && (
          <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
            {sub}
          </div>
        )}
      </div>
      <RightIcon
        size={20}
        weight={done ? 'fill' : 'bold'}
        style={{
          color: '#fff',
          flexShrink: 0,
          animation: loading ? 'anim-spin 0.8s linear infinite' : 'none',
        }}
      />
    </button>
  )
}

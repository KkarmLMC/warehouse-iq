/**
 * StatusBadge
 * Inline badge for status/stage values.
 * Uses design system tokens from statusColors.js — no raw hex values.
 *
 * Props:
 *   status  — string e.g. "queued", "In Progress", "complete"
 *   custom  — { bg, color } override for non-standard statuses
 *   small   — reduces padding for dense tables/rows
 */
import { soStatus, projectStage, approvalStatus, stockStatus } from '../../lib/statusColors.js'

// Unified lookup — tries SO status, then project stage, then approval, then stock
function getTokens(status) {
  if (!status) return { color: 'var(--text-3)', bg: 'var(--hover)' }
  const key = status.toLowerCase().replace(/[\s_-]+/g, '-')

  // Try each map in order
  const SO_KEYS = ['draft','queued','running','submitted','fulfillment','published','shipment','back-ordered','back_ordered','complete','fulfilled','cancelled']
  const PROJ_KEYS = ['scheduled','in-progress','in progress','inspection','completion','customer-signoff','postponed','failed']
  const APPR_KEYS = ['approved','rejected','pending-review','under-review']
  const STOCK_KEYS = ['ok','low','out','on-order','on_order']

  const normalized = key.replace(/_/g, '-')

  if (SO_KEYS.some(k => k === normalized || k === key))   return soStatus(status)
  if (PROJ_KEYS.some(k => k === normalized || k === key)) return projectStage(status)
  if (APPR_KEYS.some(k => k === normalized || k === key)) return approvalStatus(status)
  if (STOCK_KEYS.some(k => k === normalized || k === key)) return stockStatus(status)

  // Extra aliases
  const ALIAS = {
    'active':    { color: 'var(--warning)',      bg: 'var(--warning-soft)' },
    'pending':   { color: 'var(--warning)',      bg: 'var(--warning-soft)' },
    'on hold':   { color: 'var(--error-dark)',   bg: 'var(--error-soft)' },
    'hold':      { color: 'var(--error-dark)',   bg: 'var(--error-soft)' },
    'reviewed':  { color: 'var(--success-text)', bg: 'var(--success-soft)' },
  }
  return ALIAS[key] || ALIAS[normalized] || { color: 'var(--text-3)', bg: 'var(--hover)' }
}

export default function StatusBadge({ status, custom, small }) {
  const style = custom || getTokens(status)
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 'var(--r-s)',
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      background: style.bg,
      color: style.color,
      whiteSpace: 'nowrap',
      textTransform: 'capitalize' }}>
      {style.label || status}
    </span>
  )
}

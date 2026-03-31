/**
 * StatusBadge
 * Inline badge for status/stage values — uses status token helpers.
 * No raw hex values — resolves entirely through the design system tokens.
 *
 * Props:
 *   status  — string e.g. "queued", "In Progress", "complete"
 *   custom  — { bg, color } override for non-standard statuses
 *   small   — reduces padding for dense tables/rows
 */
import { soStatus, projectStage, approvalStatus, stockStatus } from '../../../lib/statusColors.js'

// Unified lookup — tries SO status, then project stage, then approval, then stock
function getTokens(status) {
  if (!status) return { color: 'var(--text-muted)', bg: 'var(--surface-hover)' }
  const key = status.toLowerCase().replace(/[\s_-]+/g, '-')
  const normalized = key.replace(/_/g, '-')

  const SO_KEYS   = ['draft','queued','running','submitted','fulfillment','published','shipment','back-ordered','complete','fulfilled','cancelled']
  const PROJ_KEYS = ['scheduled','in-progress','inspection','customer-signoff','postponed','failed']
  const APPR_KEYS = ['approved','rejected','pending-review','under-review']
  const STOCK_KEYS = ['ok','low','out','on-order']

  if (SO_KEYS.some(k => k === normalized || k === key))    return soStatus(status)
  if (PROJ_KEYS.some(k => k === normalized || k === key))  return projectStage(status)
  if (APPR_KEYS.some(k => k === normalized || k === key))  return approvalStatus(status)
  if (STOCK_KEYS.some(k => k === normalized || k === key)) return stockStatus(status)

  // Alias fallbacks
  const ALIAS = {
    'active':   { color: 'var(--state-warning)',      bg: 'var(--state-warning-soft)' },
    'pending':  { color: 'var(--state-warning)',      bg: 'var(--state-warning-soft)' },
    'on-hold':  { color: 'var(--state-error-text)',   bg: 'var(--state-error-soft)' },
    'hold':     { color: 'var(--state-error-text)',   bg: 'var(--state-error-soft)' },
    'reviewed': { color: 'var(--state-success-text)', bg: 'var(--state-success-soft)' },
  }
  return ALIAS[key] || ALIAS[normalized] || { color: 'var(--text-muted)', bg: 'var(--surface-hover)' }
}

export default function StatusBadge({ status, custom, small }) {
  const tokens = custom || getTokens(status)

  return (
    <span
      className={`badge ${small ? 'badge--sm' : ''}`}
      style={{ background: tokens.bg, color: tokens.color }}
    >
      {tokens.label || status}
    </span>
  )
}

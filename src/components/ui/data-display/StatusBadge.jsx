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
import { soStatus, projectStage, approvalStatus, stockStatus } from '../../../lib/statusColors.js'

// Unified lookup — tries SO status, then project stage, then approval, then stock
function getTokens(status) {
  if (!status) return { color: 'var(--text-muted)', bg: 'var(--surface-hover)' }
  const key = status.toLowerCase().replace(/[\s_-]+/g, '-')

  const SO_KEYS = ['draft','queued','running','submitted','fulfillment','partial-fulfillment','published','shipment','partial-shipment','back-ordered','back_ordered','complete','fulfilled','cancelled']
  const PROJ_KEYS = ['scheduled','in-progress','in progress','inspection','customer-signoff','postponed','failed']
  const APPR_KEYS = ['approved','rejected','pending-review','under-review']
  const STOCK_KEYS = ['ok','low','out','on-order','on_order']

  const normalized = key.replace(/_/g, '-')

  if (SO_KEYS.some(k => k === normalized || k === key))   return soStatus(status)
  if (PROJ_KEYS.some(k => k === normalized || k === key)) return projectStage(status)
  if (APPR_KEYS.some(k => k === normalized || k === key)) return approvalStatus(status)
  if (STOCK_KEYS.some(k => k === normalized || k === key)) return stockStatus(status)

  const ALIAS = {
    'active':    { color: 'var(--state-warning)',      bg: 'var(--state-warning-soft)' },
    'pending':   { color: 'var(--state-warning)',      bg: 'var(--state-warning-soft)' },
    'on hold':   { color: 'var(--state-error-text)',   bg: 'var(--state-error-soft)' },
    'hold':      { color: 'var(--state-error-text)',   bg: 'var(--state-error-soft)' },
    'reviewed':  { color: 'var(--state-success-text)', bg: 'var(--state-success-soft)' },
  }
  return ALIAS[key] || ALIAS[normalized] || { color: 'var(--text-muted)', bg: 'var(--surface-hover)' }
}

export default function StatusBadge({ status, custom, small }) {
  const tokens = custom || getTokens(status)
  return (
    <span
      className={`badge${small ? ' badge--sm' : ''}`}
      style={{ background: tokens.bg, color: tokens.color, textTransform: 'capitalize' }}
    >
      {tokens.label || status}
    </span>
  )
}

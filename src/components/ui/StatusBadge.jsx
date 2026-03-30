/**
 * StatusBadge
 * Inline pill badge for status/stage values.
 * Replaces the 37+ repeated inline badge style objects.
 *
 * Props:
 *   status  — string value e.g. "queued", "In Progress", "complete"
 *   custom  — { bg, color } override for non-standard statuses
 *   small   — reduces padding slightly (for dense tables/rows)
 *
 * Built-in status map covers all statuses used across the platform.
 * Pass `custom` for anything not in the map.
 */

const STATUS_MAP = {
  // Sales Order statuses
  queued:       { bg: '#EEF2FF', color: 'var(--black)' },
  running:      { bg: '#FEF3C7', color: 'var(--black)' },
  fulfillment:  { bg: '#EFF6FF', color: 'var(--black)' },
  shipment:     { bg: '#ECFEFF', color: '#0891B2' },
  back_ordered: { bg: '#ECFEFF', color: '#0891B2' },
  complete:     { bg: '#F0FDF4', color: '#15803D' },
  cancelled:    { bg: '#F1F5F9', color: '#64748B' },
  draft:        { bg: '#F1F5F9', color: '#64748B' },
  // Project stages
  awarded:      { bg: '#EEF2FF', color: 'var(--black)' },
  scheduled:    { bg: '#E0F2FE', color: '#0284C7' },
  'in progress':{ bg: '#ECFDF5', color: '#059669' },
  inspection:   { bg: '#FEF3C7', color: 'var(--black)' },
  'on hold':    { bg: '#FEF2F2', color: 'var(--black)' },
  // Generic
  active:       { bg: '#FEF3C7', color: 'var(--black)' },
  pending:      { bg: '#FEF3C7', color: 'var(--black)' },
  submitted:    { bg: '#EFF6FF', color: '#1D4ED8' },
  reviewed:     { bg: '#F0FDF4', color: '#15803D' },
  approved:     { bg: '#F0FDF4', color: '#15803D' },
  rejected:     { bg: '#FEF2F2', color: '#B91C1C' },
  ok:           { bg: '#F0FDF4', color: '#15803D' },
  low:          { bg: '#FEF3C7', color: 'var(--black)' },
  out:          { bg: '#FEF2F2', color: '#B91C1C' } }

export default function StatusBadge({ status, custom, small }) {
  const key = (status || '').toLowerCase().replace(/\s+/g, ' ')
  const style = custom || STATUS_MAP[key] || { bg: '#F1F5F9', color: '#64748B' }

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: small ? '1px 6px' : '2px 8px',
      borderRadius: 4,
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      background: style.bg,
      color: style.color,
      whiteSpace: 'nowrap',
      textTransform: 'capitalize' }}>
      {status}
    </span>
  )
}

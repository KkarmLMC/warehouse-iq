/**
 * statusColors.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all data-driven color lookups across the LMC
 * Platform. Each function returns a { color, bg, label } object that maps
 * directly to CSS custom property tokens defined in globals.css :root.
 *
 * NEVER hardcode hex values or raw CSS color names in components.
 * NEVER duplicate these maps in individual page files.
 *
 * Usage:
 *   import { soStatus, projectStage, roleColor } from '../lib/statusColors.js'
 *
 *   const { color, bg, label } = soStatus('queued')
 *   // → { color: 'var(--status-queued)', bg: 'var(--status-queued-bg)', label: 'Queued' }
 *
 *   <span style={{ color, background: bg }}>{label}</span>
 *
 *   // Or just the tokens when you need them separately:
 *   style={{ color: soStatus('queued').color }}
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Sales Order statuses ──────────────────────────────────────────────────────
const SO_STATUS = {
  draft:        { color: 'var(--status-draft)',        bg: 'var(--status-draft-bg)',        label: 'Draft' },
  queued:       { color: 'var(--status-queued)',       bg: 'var(--status-queued-bg)',       label: 'Queued' },
  running:      { color: 'var(--status-running)',      bg: 'var(--status-running-bg)',      label: 'Running' },
  submitted:    { color: 'var(--status-submitted)',    bg: 'var(--status-submitted-bg)',    label: 'Submitted' },
  fulfillment:  { color: 'var(--status-fulfillment)',  bg: 'var(--status-fulfillment-bg)',  label: 'Fulfillment' },
  published:    { color: 'var(--status-published)',    bg: 'var(--status-published-bg)',    label: 'Published' },
  shipment:     { color: 'var(--status-shipment)',     bg: 'var(--status-shipment-bg)',     label: 'Shipment' },
  back_ordered: { color: 'var(--status-back-ordered)', bg: 'var(--status-back-ordered-bg)', label: 'Awaiting Stock' },
  complete:     { color: 'var(--status-complete)',     bg: 'var(--status-complete-bg)',     label: 'Complete' },
  fulfilled:    { color: 'var(--status-fulfilled)',    bg: 'var(--status-fulfilled-bg)',    label: 'Complete' },
  cancelled:    { color: 'var(--status-cancelled)',    bg: 'var(--status-cancelled-bg)',    label: 'Cancelled' },
}

/**
 * Returns color + bg tokens for a Sales Order status.
 * Falls back to draft styling for unknown statuses.
 */
export function soStatus(status) {
  return SO_STATUS[status] || SO_STATUS.draft
}

// ── Project / field job stages ────────────────────────────────────────────────
const PROJECT_STAGE = {
  'awarded':         { color: 'var(--stage-awarded)',          bg: 'var(--stage-awarded-bg)',          label: 'Awarded' },
  'site-survey':     { color: 'var(--stage-site-survey)',      bg: 'var(--stage-site-survey-bg)',      label: 'Site Survey' },
  'scheduled':       { color: 'var(--stage-scheduled)',        bg: 'var(--stage-scheduled-bg)',        label: 'Scheduled' },
  'in-progress':     { color: 'var(--stage-in-progress)',      bg: 'var(--stage-in-progress-bg)',      label: 'In Progress' },
  'inspection':      { color: 'var(--stage-inspection)',       bg: 'var(--stage-inspection-bg)',       label: 'Inspection' },
  'completion':      { color: 'var(--stage-completion)',       bg: 'var(--stage-completion-bg)',       label: 'Completion' },
  'customer-signoff':{ color: 'var(--stage-customer-signoff)', bg: 'var(--stage-customer-signoff-bg)', label: 'Customer Sign-Off' },
  'postponed':       { color: 'var(--stage-postponed)',        bg: 'var(--stage-postponed-bg)',        label: 'Postponed' },
  'failed':          { color: 'var(--status-failed)',          bg: 'var(--status-failed-bg)',          label: 'Failed' },
  // Aliases used in OpsBoard / MC
  'Awarded':         { color: 'var(--stage-awarded)',          bg: 'var(--stage-awarded-bg)',          label: 'Awarded' },
  'Scheduled':       { color: 'var(--stage-scheduled)',        bg: 'var(--stage-scheduled-bg)',        label: 'Scheduled' },
  'In Progress':     { color: 'var(--stage-in-progress)',      bg: 'var(--stage-in-progress-bg)',      label: 'In Progress' },
  'Inspection':      { color: 'var(--stage-inspection)',       bg: 'var(--stage-inspection-bg)',       label: 'Inspection' },
  'Completion':      { color: 'var(--stage-completion)',       bg: 'var(--stage-completion-bg)',       label: 'Completion' },
  'Cancelled':       { color: 'var(--status-cancelled)',       bg: 'var(--status-cancelled-bg)',       label: 'Cancelled' },
  'Hold':            { color: 'var(--status-rejected)',        bg: 'var(--status-rejected-bg)',        label: 'On Hold' },
  'Complete':        { color: 'var(--status-complete)',        bg: 'var(--status-complete-bg)',        label: 'Complete' },
}

/**
 * Returns color + bg tokens for a project/job stage.
 * Falls back to grey draft styling for unknown stages.
 */
export function projectStage(stage) {
  return PROJECT_STAGE[stage] || { color: 'var(--status-draft)', bg: 'var(--status-draft-bg)', label: stage }
}

// ── Approval / review statuses ────────────────────────────────────────────────
const APPROVAL_STATUS = {
  approved:        { color: 'var(--status-approved)',       bg: 'var(--status-approved-bg)',       label: 'Approved' },
  rejected:        { color: 'var(--status-rejected)',       bg: 'var(--status-rejected-bg)',       label: 'Rejected' },
  failed:          { color: 'var(--status-failed)',         bg: 'var(--status-failed-bg)',         label: 'Failed' },
  'pending-review':{ color: 'var(--status-pending-review)', bg: 'var(--status-pending-review-bg)', label: 'Pending Review' },
  'under-review':  { color: 'var(--status-under-review)',   bg: 'var(--status-under-review-bg)',   label: 'Under Review' },
  draft:           { color: 'var(--status-draft)',          bg: 'var(--status-draft-bg)',          label: 'Draft' },
  submitted:       { color: 'var(--status-submitted)',      bg: 'var(--status-submitted-bg)',      label: 'Submitted' },
}

/**
 * Returns color + bg tokens for approval/review workflows.
 */
export function approvalStatus(status) {
  return APPROVAL_STATUS[status] || APPROVAL_STATUS.draft
}

// ── Inventory stock status ────────────────────────────────────────────────────
const STOCK_STATUS = {
  ok:          { color: 'var(--success-text)', bg: 'var(--success-soft)', label: 'OK' },
  low:         { color: 'var(--warning)',      bg: 'var(--warning-soft)', label: 'Low' },
  out:         { color: 'var(--error-dark)',   bg: 'var(--error-soft)',   label: 'Out' },
  on_order:    { color: 'var(--blue)',         bg: 'var(--blue-soft)',    label: 'On Order' },
  back_ordered:{ color: 'var(--status-back-ordered)', bg: 'var(--status-back-ordered-bg)', label: 'Back Ordered' },
}

/**
 * Returns color + bg tokens for inventory stock status.
 * Pass a quantity_on_hand and min_level to auto-derive status,
 * or pass an explicit status string.
 */
export function stockStatus(status) {
  return STOCK_STATUS[status] || STOCK_STATUS.ok
}

/**
 * Derives stock status from quantity values.
 * @param {number} onHand
 * @param {number} minLevel
 * @returns {{ color, bg, label, status }}
 */
export function stockStatusFromQty(onHand, minLevel) {
  let key = 'ok'
  if (onHand <= 0)          key = 'out'
  else if (minLevel > 0 && onHand <= minLevel) key = 'low'
  return { ...STOCK_STATUS[key], status: key }
}

// ── User roles ────────────────────────────────────────────────────────────────
const ROLE_COLOR = {
  admin:             { color: 'var(--role-admin)',             bg: 'var(--role-admin-bg)',             label: 'Admin' },
  manager:           { color: 'var(--role-manager)',           bg: 'var(--role-manager-bg)',           label: 'Manager' },
  warehouse_manager: { color: 'var(--role-warehouse-manager)', bg: 'var(--role-warehouse-manager-bg)', label: 'Warehouse' },
  user:              { color: 'var(--role-user)',              bg: 'var(--role-user-bg)',              label: 'User' },
}

/**
 * Returns color + bg tokens for a user role badge.
 */
export function roleColor(role) {
  return ROLE_COLOR[role] || ROLE_COLOR.user
}

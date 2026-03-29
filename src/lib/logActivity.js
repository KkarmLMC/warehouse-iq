/**
 * logActivity — fire-and-forget user action logger
 *
 * Call this after any successful save/update/delete.
 * Never awaited in a way that blocks the user action — errors are swallowed silently.
 *
 * @param {object} db        - Supabase client
 * @param {string} userId    - auth user id
 * @param {string} app       - 'field_ops' | 'warehouse_iq' | 'mission_control'
 * @param {object} opts
 *   @param {string} category   - 'sales_order' | 'inventory' | 'fulfillment' | 'shipment' | 'import' | 'profile' | 'auth' | 'parts' | 'transfer'
 *   @param {string} action     - 'created' | 'updated' | 'completed' | 'signed_in' | 'signed_out' etc
 *   @param {string} label      - Human-readable summary e.g. "Created Sales Order SO-2025-0001"
 *   @param {string} [entity_type] - 'sales_order' | 'part' | 'fulfillment_sheet' etc
 *   @param {string} [entity_id]   - UUID or reference of the affected record
 *   @param {object} [meta]        - Any extra key/value data
 */
export async function logActivity(db, userId, app, { category, action, label, entity_type, entity_id, meta = {} }) {
  if (!userId) return
  try {
    await db.from('user_activity_logs').insert({
      user_id:     userId,
      app,
      category,
      action,
      label,
      entity_type: entity_type || null,
      entity_id:   entity_id   || null,
      meta,
    })
  } catch (_) {
    // Never block user action on log failure
  }
}

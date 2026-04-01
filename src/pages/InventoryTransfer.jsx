import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash, CheckCircle, SpinnerGap, MagnifyingGlass } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')

export default function InventoryTransfer() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [warehouses, setWarehouses] = useState([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([]) // [{ part_id, part_name, quantity }]
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    db.from('warehouses').select('*').eq('is_active', true).order('name').then(({ data }) => {
      setWarehouses(data || [])
      if (data?.length >= 1) setFromId(data[0].id)
      if (data?.length >= 2) setToId(data[1].id)
    })
  }, [])

  // Search parts
  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      const { data } = await db.from('parts').select('id, name, sku').ilike('name', `%${search}%`).eq('is_active', true).limit(8)
      setSearchResults(data || [])
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  const addItem = (part) => {
    if (items.some(i => i.part_id === part.id)) return
    setItems(prev => [...prev, { part_id: part.id, part_name: part.name, part_sku: part.sku, quantity: 1 }])
    setSearch('')
    setSearchResults([])
  }

  const updateQty = (idx, qty) => setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(1, qty) } : item))
  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx))

  const handleSubmit = async () => {
    const errs = {}
    if (!fromId) errs.from = 'Select source warehouse'
    if (!toId) errs.to = 'Select destination warehouse'
    if (fromId === toId) errs.to = 'Source and destination must be different'
    if (items.length === 0) errs.items = 'Add at least one part to transfer'
    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)

    // Create transfer header
    const { data: transfer } = await db.from('inventory_transfers').insert({
      from_warehouse_id: fromId,
      to_warehouse_id: toId,
      status: 'completed',
      reason: reason || null,
      notes: notes || null,
      completed_at: new Date().toISOString() }).select().single()

    // Create line items
    await db.from('inventory_transfer_items').insert(
      items.map(item => ({ transfer_id: transfer.id, part_id: item.part_id, quantity: item.quantity }))
    )

    // Adjust inventory for each item atomically
    for (const item of items) {
      await db.rpc('adjust_inventory', {
        p_part_id: item.part_id,
        p_warehouse_id: fromId,
        p_quantity_delta: -item.quantity,
        p_transaction_type: 'transfer_out',
        p_reason: reason || `Transfer to ${warehouses.find(w => w.id === toId)?.name}`,
        p_related_transfer_id: transfer.id })
      await db.rpc('adjust_inventory', {
        p_part_id: item.part_id,
        p_warehouse_id: toId,
        p_quantity_delta: item.quantity,
        p_transaction_type: 'transfer_in',
        p_reason: reason || `Transfer from ${warehouses.find(w => w.id === fromId)?.name}`,
        p_related_transfer_id: transfer.id })
    }

    const fromName = warehouses.find(w => w.id === fromId)?.name || fromId
    const toName   = warehouses.find(w => w.id === toId)?.name   || toId
    await logActivity(db, user?.id, APP_SOURCE, {
      category:    'transfer',
      action:      'completed',
      label:       `Transferred ${items.length} part${items.length !== 1 ? 's' : ''} from ${fromName} → ${toName}`,
      entity_type: 'inventory_transfer',
      entity_id:   transfer?.id,
      meta:        { from: fromName, to: toName, item_count: items.length, reason } })
    setSaving(false)
    navigate('/warehouse-hq')
  }

  return (
    <div className="page-content fade-in">
      <div className="inventory-transfer-154a">
        <div className="page-heading">Transfer Stock</div>
        <div className="meta-text--inverse">Move parts between warehouses</div>
      </div>

      {/* From / To */}
      <div className="card-section">
        <div className="mb-l">
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--space-xs)', color: errors.from ? 'var(--state-error)' : 'var(--text-primary)' }}>From Warehouse</label>
          <select value={fromId} onChange={e => setFromId(e.target.value)} style={{ borderColor: errors.from ? 'var(--state-error)' : undefined }}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {errors.from && <div className="validation-error">{errors.from}</div>}
        </div>

        <div className="mb-l">
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--space-xs)', color: errors.to ? 'var(--state-error)' : 'var(--text-primary)' }}>To Warehouse</label>
          <select value={toId} onChange={e => setToId(e.target.value)} style={{ borderColor: errors.to ? 'var(--state-error)' : undefined }}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {errors.to && <div className="validation-error">{errors.to}</div>}
        </div>

        <div className="mb-l">
          <label className="text-label">Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Resupply field crew" />
        </div>

        <div>
          <label className="text-label">Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}  />
        </div>
      </div>

      {/* Parts */}
      <div className="card-section">
        <div className="pad-row">
          <div className="text-sm-bold">Parts to Transfer</div>
          {errors.items && <div className="validation-error">{errors.items}</div>}
        </div>

        {/* Search */}
        <div className="inventory-transfer-f538">
          <div className="position-relative">
            <MagnifyingGlass size="0.9375rem" className="search-overlay-icon" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search and add parts…"
              className="inventory-transfer-2b4d"
            />
          </div>
          {searchResults.length > 0 && (
            <div className="inventory-transfer-90d3">
              {searchResults.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  className="inventory-transfer-a65c">
                  <div>
                    <div className="text-sm-semi">{p.name}</div>
                    {p.sku && <div className="inventory-transfer-21a0">{p.sku}</div>}
                  </div>
                  <Plus size="1rem" style={{ color: 'var(--brand-primary)' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line items */}
        {items.length === 0 ? (
          <div className="empty-message">
            Search for parts above to add them to the transfer
          </div>
        ) : items.map((item, idx) => (
          <div key={item.part_id} className="inventory-transfer-e298">
            <div className="content-body">
              <div className="text-sm-truncate">{item.part_name}</div>
              {item.part_sku && <div className="inventory-transfer-21a0">{item.part_sku}</div>}
            </div>
            <input
              type="number" min="1"
              value={item.quantity}
              onChange={e => updateQty(idx, parseInt(e.target.value) || 1)}
              className="inventory-transfer-ac86"
            />
            <button onClick={() => removeItem(idx)}
              className="inventory-transfer-9997">
              <Trash size="0.875rem" />
            </button>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div className="grid-2col margin-bottom-l">
        <button onClick={() => navigate(-1)} className="card-section text-sm-bold">
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: 'var(--space-m)', borderRadius: 'var(--radius-m)', background: saving ? 'var(--surface-hover)' : 'var(--state-error)', color: saving ? 'var(--text-muted)' : '#fff', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-s)' }}>
          {saving ? <><SpinnerGap size="0.875rem" className="anim-spin" /> Processing…</> : <><CheckCircle size="0.875rem" /> Complete Transfer</>}
        </button>
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash, CheckCircle, SpinnerGap, MagnifyingGlass } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'

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
      completed_at: new Date().toISOString(),
    }).select().single()

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
        p_related_transfer_id: transfer.id,
      })
      await db.rpc('adjust_inventory', {
        p_part_id: item.part_id,
        p_warehouse_id: toId,
        p_quantity_delta: item.quantity,
        p_transaction_type: 'transfer_in',
        p_reason: reason || `Transfer from ${warehouses.find(w => w.id === fromId)?.name}`,
        p_related_transfer_id: transfer.id,
      })
    }

    const fromName = warehouses.find(w => w.id === fromId)?.name || fromId
    const toName   = warehouses.find(w => w.id === toId)?.name   || toId
    await logActivity(db, user?.id, 'warehouse_iq', {
      category:    'transfer',
      action:      'completed',
      label:       `Transferred ${items.length} part${items.length !== 1 ? 's' : ''} from ${fromName} → ${toName}`,
      entity_type: 'inventory_transfer',
      entity_id:   transfer?.id,
      meta:        { from: fromName, to: toName, item_count: items.length, reason },
    })
    setSaving(false)
    navigate('/warehouse-hq')
  }

  return (
    <div className="page-content fade-in">
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-xl)', padding: 'var(--pad-xl)', marginBottom: 'var(--mar-l)', color: '#fff' }}>
        <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>Transfer Stock</div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>Move parts between warehouses</div>
      </div>

      {/* From / To */}
      <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', padding: 'var(--pad-xl)', marginBottom: 'var(--mar-l)' }}>
        <div style={{ marginBottom: 'var(--mar-l)' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--mar-xs)', color: errors.from ? 'var(--red)' : 'var(--black)' }}>From Warehouse</label>
          <select value={fromId} onChange={e => setFromId(e.target.value)} style={{ width: '100%', borderColor: errors.from ? 'var(--red)' : undefined }}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {errors.from && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 4 }}>{errors.from}</div>}
        </div>

        <div style={{ marginBottom: 'var(--mar-l)' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--mar-xs)', color: errors.to ? 'var(--red)' : 'var(--black)' }}>To Warehouse</label>
          <select value={toId} onChange={e => setToId(e.target.value)} style={{ width: '100%', borderColor: errors.to ? 'var(--red)' : undefined }}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          {errors.to && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 4 }}>{errors.to}</div>}
        </div>

        <div style={{ marginBottom: 'var(--mar-l)' }}>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--mar-xs)' }}>Reason (optional)</label>
          <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Resupply field crew" style={{ width: '100%' }} />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--mar-xs)' }}>Notes (optional)</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      </div>

      {/* Parts */}
      <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
        <div style={{ padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Parts to Transfer</div>
          {errors.items && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--red)', marginTop: 2 }}>{errors.items}</div>}
        </div>

        {/* Search */}
        <div style={{ padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <MagnifyingGlass size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search and add parts…"
              style={{ width: '100%', paddingLeft: 32 }}
            />
          </div>
          {searchResults.length > 0 && (
            <div style={{ position: 'absolute', left: 16, right: 16, top: '100%', zIndex: 50, background: 'var(--white)', border: '1px solid var(--border-l)', borderRadius: 'var(--r-l)', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              {searchResults.map(p => (
                <button key={p.id} onClick={() => addItem(p)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: 'var(--pad-m) var(--pad-l)', border: 'none', background: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-l)', textAlign: 'left' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{p.name}</div>
                    {p.sku && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{p.sku}</div>}
                  </div>
                  <Plus size={16} style={{ color: 'var(--navy)' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Line items */}
        {items.length === 0 ? (
          <div style={{ padding: 'var(--pad-xl)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
            Search for parts above to add them to the transfer
          </div>
        ) : items.map((item, idx) => (
          <div key={item.part_id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.part_name}</div>
              {item.part_sku && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>{item.part_sku}</div>}
            </div>
            <input
              type="number" min="1"
              value={item.quantity}
              onChange={e => updateQty(idx, parseInt(e.target.value) || 1)}
              style={{ width: '4rem', textAlign: 'center' }}
            />
            <button onClick={() => removeItem(idx)}
              style={{ width: '2rem', height: '2rem', borderRadius: 'var(--r-m)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <Trash size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Submit */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-xxl)' }}>
        <button onClick={() => navigate(-1)} style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', color: 'var(--black)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          Cancel
        </button>
        <button onClick={handleSubmit} disabled={saving}
          style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', border: 'none', background: saving ? 'var(--hover)' : 'var(--red)', color: saving ? 'var(--text-3)' : '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--gap-s)' }}>
          {saving ? <><SpinnerGap size={14} style={{ animation: 'spin 1s linear infinite' }} /> Processing…</> : <><CheckCircle size={14} /> Complete Transfer</>}
        </button>
      </div>
    </div>
  )
}

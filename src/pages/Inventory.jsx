import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Buildings, Package, WarningCircle, ArrowsLeftRight,
  Plus, TrendUp, CurrencyDollar, Truck, CaretRight, X, Check,
  DotsSixVertical, PencilSimple, Receipt, CaretRight as ChevRight,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

// ─── Shared label ─────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 'var(--sp-1)' }}>
      {children}
    </label>
  )
}

// ─── Add Warehouse Sheet ──────────────────────────────────────────────────────
function AddWarehouseSheet({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', address: '', city: '', state: '', zip: '', contact_name: '', contact_phone: '', contact_email: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Warehouse name is required.'); return }
    setSaving(true)
    setError('')
    const { data, error: err } = await db.from('warehouses')
      .insert({ ...form, is_active: true })
      .select()
      .single()
    setSaving(false)
    if (err) { setError('Save failed. Please try again.'); return }
    onSaved(data)
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.5)', animation: 'anim-fade-in 0.15s ease' }} />
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 300, background: 'var(--surface)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0', maxHeight: '92vh', display: 'flex', flexDirection: 'column', animation: 'anim-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)' }}>
        {/* Header */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5) 0', flexShrink: 0 }}>
          <div style={{ width: '2.5rem', height: '0.25rem', background: 'var(--border-l)', borderRadius: 'var(--r-full)', margin: '0 auto var(--sp-3)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Add Warehouse</div>
            <button onClick={onClose} style={{ border: 'none', background: 'var(--hover)', borderRadius: 'var(--r-full)', width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} style={{ color: 'var(--text-2)' }} />
            </button>
          </div>
        </div>

        {/* Fields */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--sp-5) var(--sp-2)' }}>
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Warehouse Name *</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Bolt Florida Warehouse" style={{ width: '100%' }} autoFocus />
          </div>

          <div style={{ borderTop: '1px solid var(--border-l)', margin: 'var(--sp-3) 0', paddingTop: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-3)' }}>Location</div>
          </div>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Street Address</Label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            <div><Label>City</Label><input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Clearwater" style={{ width: '100%' }} /></div>
            <div><Label>State</Label><input value={form.state} onChange={e => set('state', e.target.value)} placeholder="FL" style={{ width: '100%' }} /></div>
            <div><Label>ZIP</Label><input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="33755" style={{ width: '100%' }} /></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-l)', margin: 'var(--sp-3) 0', paddingTop: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-3)' }}>Contact</div>
          </div>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Contact Name</Label>
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            <div><Label>Phone</Label><input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="(555) 000-0000" style={{ width: '100%' }} /></div>
            <div><Label>Email</Label><input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="john@example.com" style={{ width: '100%' }} /></div>
          </div>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Notes</Label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any relevant notes…" rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </div>

          {error && <div style={{ color: '#B91C1C', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: '#FEF2F2', borderRadius: 'var(--r-md)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', paddingBottom: 'calc(var(--sp-4) + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-l)', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            style={{ width: '100%', padding: 'var(--sp-3)', borderRadius: 'var(--r-md)', border: 'none', background: !form.name.trim() ? 'var(--hover)' : 'var(--navy)', color: !form.name.trim() ? 'var(--text-3)' : '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: !form.name.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}>
            {saving ? 'Creating…' : <><Check size={15} /> Create Warehouse</>}
          </button>
        </div>
      </div>
    </>
  )
}

function StatTile({ label, value, color = 'var(--text-1)' }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-lg)', padding: 'var(--sp-3) var(--sp-4)' }}>
      <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 4, fontWeight: 600 }}>{label}</div>
    </div>
  )
}

function WarehouseCard({ warehouse, levels, onPress, onViewParts, onTransfer }) {
  const wLevels = levels.filter(l => l.warehouse_id === warehouse.id)
  const totalSkus     = wLevels.filter(l => l.quantity_on_hand > 0).length
  const totalUnits    = wLevels.reduce((s, l) => s + l.quantity_on_hand, 0)
  const totalOnOrder  = wLevels.reduce((s, l) => s + (l.quantity_on_order || 0), 0)
  const lowStockItems = wLevels.filter(l => l.min_level && l.quantity_on_hand > 0 && l.quantity_on_hand <= l.min_level).length
  const totalValue    = wLevels.reduce((s, l) => s + (l.quantity_on_hand * (l.parts?.unit_cost || 0)), 0)
  const hasAlerts     = lowStockItems > 0

  return (
    <div style={{
      background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden',
      border: hasAlerts ? '1px solid #FED7AA' : '1px solid var(--border-l)',
    }}>
      {/* Header — clickable, goes to warehouse detail */}
      <button onClick={onPress} style={{ background: 'var(--navy)', padding: 'var(--sp-4) var(--sp-5)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: 'var(--r-lg)', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Buildings size={20} style={{ color: '#fff' }} />
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#fff' }}>{warehouse.name}</div>
            {(warehouse.city || warehouse.state) && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {[warehouse.city, warehouse.state].filter(Boolean).join(', ')}
              </div>
            )}
          </div>
        </div>
        {hasAlerts ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FEF3C7', borderRadius: 'var(--r-full)', padding: '3px 10px' }}>
            <WarningCircle size={13} weight="fill" style={{ color: '#D97706' }} />
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#D97706' }}>{lowStockItems} low stock</span>
          </div>
        ) : (
          <CaretRight size={16} style={{ color: 'rgba(255,255,255,0.4)' }} />
        )}
      </button>

      {/* Stats 2x2 grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border-l)' }}>
        {[
          { label: 'SKUs In Stock', value: totalSkus.toLocaleString(), Icon: Package, color: 'var(--text-1)' },
          { label: 'Total Units', value: totalUnits.toLocaleString(), Icon: TrendUp, color: 'var(--text-1)' },
          { label: 'Low Stock', value: lowStockItems, Icon: WarningCircle, color: lowStockItems > 0 ? '#C2410C' : 'var(--text-3)' },
          { label: 'On Order', value: totalOnOrder.toLocaleString(), Icon: Truck, color: totalOnOrder > 0 ? '#1D4ED8' : 'var(--text-3)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface-raised)', padding: 'var(--sp-3) var(--sp-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: s.color, marginBottom: 4 }}>
              <s.Icon size={13} />
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Value row */}
      {totalValue > 0 && (
        <div style={{ padding: 'var(--sp-3) var(--sp-5)', borderTop: '1px solid var(--border-l)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)' }}>
            <CurrencyDollar size={14} />
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 600 }}>Est. Inventory Value</span>
          </div>
          <span style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#15803D' }}>
            ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Low stock list */}
      {lowStockItems > 0 && (
        <div style={{ padding: 'var(--sp-3) var(--sp-5)', borderTop: '1px solid #FED7AA', background: '#FFFBEB' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#92400E', marginBottom: 'var(--sp-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Stock</div>
          {wLevels
            .filter(l => l.min_level && l.quantity_on_hand > 0 && l.quantity_on_hand <= l.min_level)
            .slice(0, 3)
            .map(l => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: '#92400E', marginBottom: 2 }}>
                <span style={{ fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>{l.parts?.sku || '—'}</span>
                <span style={{ fontWeight: 700, flexShrink: 0 }}>{l.quantity_on_hand} / min {l.min_level}</span>
              </div>
            ))}
          {lowStockItems > 3 && <div style={{ fontSize: 'var(--fs-xs)', color: '#92400E', marginTop: 4 }}>+{lowStockItems - 3} more</div>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', padding: 'var(--sp-3) var(--sp-4)', borderTop: '1px solid var(--border-l)' }}>
        <button onClick={onViewParts}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--navy)', background: 'var(--navy)', color: '#fff', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer' }}>
          <Package size={13} /> View Parts
        </button>
        <button onClick={onTransfer}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-l)', background: 'transparent', color: 'var(--text-2)', fontSize: 'var(--fs-xs)', fontWeight: 700, cursor: 'pointer' }}>
          <ArrowsLeftRight size={13} /> Transfer
        </button>
      </div>
    </div>
  )
}

export default function Inventory() {
  const navigate = useNavigate()
  const [warehouses, setWarehouses] = useState([])
  const [levels, setLevels] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pos, setPOs] = useState([])
  const dragItem = useRef(null)
  const dragOverItem = useRef(null)

  useEffect(() => {
    Promise.all([
      db.from('warehouses').select('*').eq('is_active', true).order('sort_order'),
      db.from('inventory_levels').select('*, parts(sku, unit_cost)'),
      db.from('purchase_orders').select('id, po_number, customer_name, project_name, status, grand_total, division, po_date').in('status', ['draft','submitted','published']).order('created_at', { ascending: false }),
    ]).then(([{ data: wh }, { data: lvl }, { data: pos }]) => {
      setWarehouses(wh || [])
      setLevels(lvl || [])
      setPOs(pos || [])
      setLoading(false)
    })
  }, [])

  const handleDragStart = (idx) => { dragItem.current = idx }
  const handleDragEnter = (idx) => { dragOverItem.current = idx }

  const handleDragEnd = () => {
    if (dragItem.current === null || dragOverItem.current === null) return
    if (dragItem.current === dragOverItem.current) return
    const reordered = [...warehouses]
    const dragged = reordered.splice(dragItem.current, 1)[0]
    reordered.splice(dragOverItem.current, 0, dragged)
    dragItem.current = null
    dragOverItem.current = null
    setWarehouses(reordered)
  }

  const saveOrder = async () => {
    setSaving(true)
    await Promise.all(
      warehouses.map((wh, idx) =>
        db.from('warehouses').update({ sort_order: idx }).eq('id', wh.id)
      )
    )
    setSaving(false)
    setEditMode(false)
  }

  // Cross-warehouse rollup
  const totalSkus     = new Set(levels.filter(l => l.quantity_on_hand > 0).map(l => l.part_id)).size
  const totalUnits    = levels.reduce((s, l) => s + l.quantity_on_hand, 0)
  const totalOnOrder  = levels.reduce((s, l) => s + (l.quantity_on_order || 0), 0)
  const totalLowStock = (() => {
    const byPart = {}
    levels.forEach(l => {
      if (!byPart[l.part_id]) byPart[l.part_id] = { qty: 0, min: null }
      byPart[l.part_id].qty += l.quantity_on_hand
      if (l.min_level && (byPart[l.part_id].min === null || l.min_level < byPart[l.part_id].min))
        byPart[l.part_id].min = l.min_level
    })
    return Object.values(byPart).filter(p => p.min && p.qty > 0 && p.qty <= p.min).length
  })()

  return (
    <div className="page-content fade-in">

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>WAREHOUSE HQ</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, lineHeight: 1.1 }}>Warehouse HQ</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
          {editMode ? (
            <>
              <button onClick={() => setEditMode(false)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', color: 'var(--text-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <X size={14} /> Cancel
              </button>
              <button onClick={saveOrder} disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Check size={14} /> {saving ? 'Saving…' : 'Save Order'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditMode(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', color: 'var(--text-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <PencilSimple size={14} /> Edit
              </button>
              <button onClick={() => navigate('/warehouse-hq/transfer')}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', color: 'var(--text-2)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <ArrowsLeftRight size={14} /> Transfer
              </button>
              <button onClick={() => setShowAdd(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                <Plus size={14} /> Add Warehouse
              </button>
            </>
          )}
        </div>
      </div>

      {/* Edit mode hint */}
      {editMode && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3) var(--sp-4)', background: '#EFF6FF', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-4)', fontSize: 'var(--fs-sm)', color: '#1D4ED8' }}>
          <DotsSixVertical size={16} />
          Drag the handles to reorder warehouses, then tap Save Order.
        </div>
      )}

      {/* PO Activity Strip */}
      {!editMode && pos.length > 0 && (() => {
        const submitted = pos.filter(p => p.status === 'submitted')
        const published = pos.filter(p => p.status === 'published')
        const draft     = pos.filter(p => p.status === 'draft')
        const totalActive = submitted.length + published.length
        return (
          <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', marginBottom: 'var(--sp-5)', overflow: 'hidden' }}>
            {/* Strip header */}
            <button onClick={() => navigate('/sales-orders')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border-l)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Receipt size={15} style={{ color: 'var(--navy)' }} />
                <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Sales Orders</span>
                {submitted.length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)', background: '#FEF3C7', color: '#D97706' }}>
                    {submitted.length} need review
                  </span>
                )}
              </div>
              <CaretRight size={13} style={{ color: 'var(--text-3)' }} />
            </button>

            {/* Stat row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1px', background: 'var(--border-l)' }}>
              {[
                { label: 'Draft',     count: draft.length,     color: '#64748B', bg: 'var(--surface-raised)' },
                { label: 'Submitted', count: submitted.length, color: submitted.length > 0 ? '#D97706' : '#64748B', bg: submitted.length > 0 ? '#FFFBEB' : 'var(--surface-raised)' },
                { label: 'Published', count: published.length, color: published.length > 0 ? '#1D4ED8' : '#64748B', bg: published.length > 0 ? '#EFF6FF' : 'var(--surface-raised)' },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, padding: 'var(--sp-3) var(--sp-4)' }}>
                  <div style={{ fontSize: 'var(--fs-xl)', fontWeight: 800, color: s.color }}>{s.count}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent active PO rows */}
            {[...submitted, ...published].slice(0, 3).map(po => (
              <button key={po.id} onClick={() => navigate(`/sales-orders/${po.id}`)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-4)', border: 'none', background: 'none', cursor: 'pointer', borderTop: '1px solid var(--border-l)', textAlign: 'left' }}>
                <div style={{
                  fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, flexShrink: 0,
                  background: po.division === 'Bolt' ? '#FFF1F2' : '#EFF6FF',
                  color: po.division === 'Bolt' ? '#BE123C' : '#1D4ED8',
                }}>
                  {po.division === 'Bolt' ? 'BOLT' : 'LM'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{po.customer_name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{po.project_name || po.po_number}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)',
                    background: po.status === 'submitted' ? '#FEF3C7' : '#EFF6FF',
                    color: po.status === 'submitted' ? '#D97706' : '#1D4ED8',
                  }}>{po.status}</span>
                  {po.grand_total > 0 && (
                    <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)' }}>
                      ${po.grand_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )
      })()}

      {/* Network-wide summary */}
      {!editMode && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-6)' }}>
          <StatTile label="Unique SKUs" value={totalSkus.toLocaleString()} />
          <StatTile label="Total Units" value={totalUnits.toLocaleString()} />
          <StatTile label="Low Stock" value={totalLowStock} color={totalLowStock > 0 ? '#C2410C' : 'var(--text-1)'} />
          <StatTile label="On Order" value={totalOnOrder.toLocaleString()} color={totalOnOrder > 0 ? '#1D4ED8' : 'var(--text-1)'} />
        </div>
      )}

      {/* Warehouse cards / drag list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-10)' }}><div className="spinner" /></div>
      ) : editMode ? (
        /* Edit mode: vertical drag list */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          {warehouses.map((wh, idx) => (
            <div
              key={wh.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
                background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)',
                border: '1px solid var(--border-l)', padding: 'var(--sp-4)',
                cursor: 'grab', userSelect: 'none',
                transition: 'box-shadow 0.15s ease',
              }}
            >
              <DotsSixVertical size={22} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
              <div style={{
                width: '2.5rem', height: '2.5rem', borderRadius: 'var(--r-lg)',
                background: 'var(--navy)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0,
              }}>
                <Buildings size={18} style={{ color: '#fff' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700 }}>{wh.name}</div>
                {(wh.city || wh.state) && (
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                    {[wh.city, wh.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', background: 'var(--hover)', borderRadius: 'var(--r-full)', padding: '2px 10px' }}>
                #{idx + 1}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Normal mode: warehouse cards grid */
        <div className="warehouse-grid">
          {warehouses.map(wh => (
            <WarehouseCard
              key={wh.id}
              warehouse={wh}
              levels={levels}
              onPress={() => navigate(`/warehouse-hq/warehouse/${wh.id}`)}
              onViewParts={() => navigate(`/warehouse-hq?warehouse=${wh.id}`)}
              onTransfer={() => navigate(`/warehouse-hq/transfer?from=${wh.id}`)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <AddWarehouseSheet
          onClose={() => setShowAdd(false)}
          onSaved={newWarehouse => {
            setWarehouses(wh => [...wh, newWarehouse])
            setShowAdd(false)
          }}
        />
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Buildings, Package, WarningCircle, ArrowsLeftRight,
  Plus, TrendUp, CurrencyDollar, Truck, CaretRight,
  PencilSimple, MapPin, Phone, Envelope, ClipboardText,
  CaretDown, MagnifyingGlass, X, Check, Receipt,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'

// ─── Shared label component ───────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', display: 'block', marginBottom: 'var(--sp-1)' }}>
      {children}
    </label>
  )
}

// ─── Edit Warehouse Sheet ─────────────────────────────────────────────────────
function EditWarehouseSheet({ warehouse, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:          warehouse.name          || '',
    address:       warehouse.address       || '',
    city:          warehouse.city          || '',
    state:         warehouse.state         || '',
    zip:           warehouse.zip           || '',
    contact_name:  warehouse.contact_name  || '',
    contact_phone: warehouse.contact_phone || '',
    contact_email: warehouse.contact_email || '',
    notes:         warehouse.notes         || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Warehouse name is required.'); return }
    setSaving(true)
    setError('')
    const { error: err } = await db.from('warehouses')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', warehouse.id)
    setSaving(false)
    if (err) { setError('Save failed. Please try again.'); return }
    await logActivity(db, user?.id, 'warehouse_iq', {
      category:    'inventory',
      action:      'updated_warehouse',
      label:       `Updated warehouse: ${form.name || warehouse.name}`,
      entity_type: 'warehouse',
      entity_id:   warehouse.id,
    })
    onSaved({ ...warehouse, ...form })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.5)', animation: 'anim-fade-in 0.15s ease' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 300,
        background: 'var(--white)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'anim-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Sheet header */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5) 0', flexShrink: 0 }}>
          <div style={{ width: '2.5rem', height: '0.25rem', background: 'var(--border-l)', borderRadius: 'var(--r-full)', margin: '0 auto var(--sp-3)' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Edit Warehouse</div>
            <button onClick={onClose} style={{ border: 'none', background: 'var(--hover)', borderRadius: 'var(--r-full)', width: '2rem', height: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={14} style={{ color: 'var(--black)' }} />
            </button>
          </div>
        </div>

        {/* Scrollable fields */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--sp-5) var(--sp-2)' }}>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Warehouse Name *</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lightning Master Warehouse" style={{ width: '100%' }} />
          </div>

          <div style={{ borderTop: '1px solid var(--border-l)', margin: 'var(--sp-3) 0', paddingTop: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--sp-3)' }}>Location</div>
          </div>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Street Address</Label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            <div>
              <Label>City</Label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Clearwater" style={{ width: '100%' }} />
            </div>
            <div>
              <Label>State</Label>
              <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="FL" style={{ width: '100%' }} />
            </div>
            <div>
              <Label>ZIP</Label>
              <input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="33755" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-l)', margin: 'var(--sp-3) 0', paddingTop: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--sp-3)' }}>Contact</div>
          </div>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Contact Name</Label>
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" style={{ width: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            <div>
              <Label>Phone</Label>
              <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="(555) 000-0000" style={{ width: '100%' }} />
            </div>
            <div>
              <Label>Email</Label>
              <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="john@example.com" style={{ width: '100%' }} />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <Label>Notes</Label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any relevant notes about this warehouse…" rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </div>

          {error && <div style={{ color: '#B91C1C', fontSize: 'var(--text-sm)', marginBottom: 'var(--sp-3)', padding: 'var(--sp-2) var(--sp-3)', background: '#FEF2F2', borderRadius: 'var(--r-m)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--sp-4) var(--sp-5)', paddingBottom: 'calc(var(--sp-4) + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-l)', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            style={{ width: '100%', padding: 'var(--sp-3)', borderRadius: 'var(--r-m)', border: 'none', background: !form.name.trim() ? 'var(--hover)' : 'var(--navy)', color: !form.name.trim() ? 'var(--text-3)' : '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: !form.name.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}>
            {saving ? 'Saving…' : <><Check size={15} /> Save Changes</>}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, Icon, color = 'var(--black)', bg = 'var(--hover)' }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-l)', padding: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-2)' }}>
        <div style={{ width: '2rem', height: '2rem', borderRadius: 'var(--r-m)', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-3)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

// ─── Part row in the stock list ───────────────────────────────────────────────
function StockRow({ level, onPress }) {
  const isLow = level.min_level && level.quantity_on_hand <= level.min_level && level.quantity_on_hand > 0
  const isOut = level.quantity_on_hand === 0
  const color = isOut ? '#B91C1C' : isLow ? '#C2410C' : '#15803D'
  const bg    = isOut ? '#FEF2F2' : isLow ? '#FFF7ED' : '#F0FDF4'

  return (
    <button onClick={onPress} style={{
      display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      padding: 'var(--sp-3) var(--sp-4)',
      border: 'none', background: 'none', width: '100%', textAlign: 'left',
      borderBottom: '1px solid var(--border-l)', cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {level.parts?.name || '—'}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 'var(--sp-2)' }}>
          {level.parts?.sku && <span style={{ fontFamily: 'var(--mono)' }}>{level.parts.sku}</span>}
          {level.quantity_on_order > 0 && <span style={{ color: '#1D4ED8', fontWeight: 600 }}>+{level.quantity_on_order} on order</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
        <span style={{ padding: '3px 10px', borderRadius: 'var(--r-full)', fontSize: 'var(--text-sm)', fontWeight: 700, background: bg, color }}>
          {level.quantity_on_hand}
        </span>
        <CaretRight size={13} style={{ color: 'var(--black)' }} />
      </div>
    </button>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WarehouseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [warehouse, setWarehouse] = useState(null)
  const [levels, setLevels]       = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [stockFilter, setStockFilter] = useState('all')
  const [showTx, setShowTx]       = useState(false)
  const [transactions, setTransactions] = useState([])
  const [showEdit, setShowEdit]   = useState(false)
  const [warehousePOs, setWarehousePOs] = useState([])

  useEffect(() => {
    Promise.all([
      db.from('warehouses').select('*').eq('id', id).single(),
      db.from('inventory_levels')
        .select('*, parts(id, sku, name, unit_cost, category_id, part_categories(name))')
        .eq('warehouse_id', id)
        .order('quantity_on_hand', { ascending: true }),
      // Find all POs that have line items for this warehouse
      db.from('so_line_items')
        .select('so_id')
        .eq('warehouse_id', id),
    ]).then(async ([{ data: wh }, { data: lvl }, { data: poLineRefs }]) => {
      setWarehouse(wh)
      setLevels(lvl || [])
      // Fetch those POs
      const poIds = [...new Set((poLineRefs || []).map(r => r.so_id))]
      if (poIds.length > 0) {
        const { data: poData } = await db.from('sales_orders')
          .select('id, so_number, customer_name, project_name, status, grand_total, division, so_date')
          .in('id', poIds)
          .order('created_at', { ascending: false })
        setWarehousePOs(poData || [])
      }
      setLoading(false)
    })
  }, [id])

  const loadTransactions = async () => {
    if (transactions.length > 0) { setShowTx(t => !t); return }
    const { data } = await db.from('inventory_transactions')
      .select('*, parts(sku, name)')
      .eq('warehouse_id', id)
      .order('created_at', { ascending: false })
      .limit(30)
    setTransactions(data || [])
    setShowTx(true)
  }

  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-10)' }}><div className="spinner" /></div>
  if (!warehouse) return <div className="page-content fade-in"><div className="empty"><div className="empty-title">Warehouse not found</div></div></div>

  // Stats
  const totalSkus    = levels.filter(l => l.quantity_on_hand > 0).length
  const totalUnits   = levels.reduce((s, l) => s + l.quantity_on_hand, 0)
  const totalOnOrder = levels.reduce((s, l) => s + (l.quantity_on_order || 0), 0)
  const lowStock     = levels.filter(l => l.min_level && l.quantity_on_hand > 0 && l.quantity_on_hand <= l.min_level)
  const outOfStock   = levels.filter(l => l.quantity_on_hand === 0)
  const totalValue   = levels.reduce((s, l) => s + (l.quantity_on_hand * (l.parts?.unit_cost || 0)), 0)

  // Filter
  const filtered = levels.filter(l => {
    if (stockFilter === 'low' && !(l.min_level && l.quantity_on_hand > 0 && l.quantity_on_hand <= l.min_level)) return false
    if (stockFilter === 'out' && l.quantity_on_hand !== 0) return false
    if (stockFilter === 'in'  && l.quantity_on_hand === 0) return false
    if (search) {
      const q = search.toLowerCase()
      const name = (l.parts?.name || '').toLowerCase()
      const sku  = (l.parts?.sku  || '').toLowerCase()
      if (!name.includes(q) && !sku.includes(q)) return false
    }
    return true
  })

  const txTypeLabel = {
    adjustment: 'Adjustment', transfer_out: 'Transfer Out', transfer_in: 'Transfer In',
    job_checkout: 'Job Checkout', job_return: 'Job Return', receiving: 'Received',
    count_correction: 'Count Correction',
  }

  return (
    <div className="page-content fade-in">

      {/* Header */}
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-5)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
            <div style={{ width: '3rem', height: '3rem', borderRadius: 'var(--r-xl)', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Buildings size={22} style={{ color: '#fff' }} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, lineHeight: 1.1 }}>{warehouse.name}</div>
              {(warehouse.city || warehouse.state) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontSize: 'var(--text-xs)' }}>
                  <MapPin size={12} />
                  {[warehouse.city, warehouse.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)}
            style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--r-l)', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <PencilSimple size={15} />
          </button>
        </div>

        {/* Contact info */}
        {(warehouse.contact_name || warehouse.contact_phone || warehouse.contact_email || warehouse.address) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
            {warehouse.address && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)' }}>
                <MapPin size={12} />
                {warehouse.address}{warehouse.zip ? `, ${warehouse.zip}` : ''}
              </div>
            )}
            {warehouse.contact_name && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)' }}>Contact: {warehouse.contact_name}</div>
            )}
            {warehouse.contact_phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)' }}>
                <Phone size={12} /> {warehouse.contact_phone}
              </div>
            )}
            {warehouse.contact_email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)' }}>
                <Envelope size={12} /> {warehouse.contact_email}
              </div>
            )}
            {warehouse.notes && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.5)', fontStyle: 'italic', marginTop: 2 }}>{warehouse.notes}</div>
            )}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
        <StatCard label="SKUs In Stock" value={totalSkus.toLocaleString()} Icon={Package} color="var(--navy)" bg="#EFF6FF" />
        <StatCard label="Total Units" value={totalUnits.toLocaleString()} Icon={TrendUp} color="var(--black)" bg="var(--hover)" />
        <StatCard label="Low Stock" value={lowStock.length} Icon={WarningCircle} color={lowStock.length > 0 ? '#C2410C' : 'var(--text-3)'} bg={lowStock.length > 0 ? '#FFF7ED' : 'var(--hover)'} />
        <StatCard label="On Order" value={totalOnOrder.toLocaleString()} Icon={Truck} color={totalOnOrder > 0 ? '#1D4ED8' : 'var(--text-3)'} bg={totalOnOrder > 0 ? '#EFF6FF' : 'var(--hover)'} />
      </div>

      {/* Value */}
      {totalValue > 0 && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-l)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--text-3)' }}>
            <CurrencyDollar size={16} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Est. Inventory Value</span>
          </div>
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: '#15803D' }}>
            ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3)', marginBottom: 'var(--sp-5)' }}>
        <button onClick={() => navigate(`/warehouse-hq/transfer?from=${id}`)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)', borderRadius: 'var(--r-m)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', color: 'var(--black)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <ArrowsLeftRight size={15} /> Transfer
        </button>
        <button onClick={() => navigate('/warehouse-hq/add-part')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)', borderRadius: 'var(--r-m)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <Plus size={15} /> Add Part
        </button>
      </div>

      {/* Stock section */}
      <div style={{ marginBottom: 'var(--sp-2)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--sp-3)' }}>
          Stock ({levels.length} parts)
        </div>

        {/* Search + filters */}
        <div style={{ position: 'relative', marginBottom: 'var(--sp-3)' }}>
          <MagnifyingGlass size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: search ? 34 : 12 }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[['all', 'All'], ['in', 'In Stock'], ['low', `Low (${lowStock.length})`], ['out', `Out (${outOfStock.length})`]].map(([val, lbl]) => (
            <button key={val} onClick={() => setStockFilter(val)}
              style={{
                flexShrink: 0, padding: 'var(--sp-1) var(--sp-3)', borderRadius: 'var(--r-full)',
                border: `1px solid ${stockFilter === val ? 'var(--navy)' : 'var(--border-l)'}`,
                background: stockFilter === val ? 'var(--navy)' : 'transparent',
                color: stockFilter === val ? '#fff' : 'var(--black)',
                fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{lbl}</button>
          ))}
        </div>

        {/* Stock list */}
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
              No parts match filters
            </div>
          ) : filtered.map(level => (
            <StockRow
              key={level.id}
              level={level}
              onPress={() => navigate(`/warehouse-hq/part/${level.parts?.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Sales Orders for this warehouse */}
      {warehousePOs.length > 0 && (() => {
        const STATUS_COLORS = {
          draft:     { color: '#64748B', bg: '#F1F5F9' },
          submitted: { color: '#D97706', bg: '#FEF3C7' },
          published: { color: '#1D4ED8', bg: '#EFF6FF' },
          fulfilled: { color: '#15803D', bg: '#F0FDF4' },
          cancelled: { color: '#B91C1C', bg: '#FEF2F2' },
        }
        return (
          <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-4)', border: '1px solid var(--border-l)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border-l)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                <Receipt size={16} style={{ color: 'var(--navy)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Sales Orders</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', background: 'var(--hover)', padding: '2px 8px', borderRadius: 'var(--r-full)', fontWeight: 600 }}>
                  {warehousePOs.length}
                </span>
              </div>
              <button onClick={() => navigate('/sales-orders')}
                style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--navy)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                View all
              </button>
            </div>
            {warehousePOs.map((po, idx) => {
              const sc = STATUS_COLORS[po.status] || STATUS_COLORS.draft
              return (
                <button key={po.id} onClick={() => navigate(`/sales-orders/${po.id}`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: idx < warehousePOs.length - 1 ? '1px solid var(--border-l)' : 'none' }}>
                  <div style={{ fontSize: 'var(--blackxs)', fontWeight: 800, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: po.division === 'Bolt' ? '#FFF1F2' : '#EFF6FF', color: po.division === 'Bolt' ? '#BE123C' : '#1D4ED8' }}>
                    {po.division === 'Bolt' ? 'BOLT' : 'LM'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {po.customer_name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 1 }}>
                      {po.project_name || po.so_number}
                      {po.so_date ? ` · ${new Date(po.so_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-full)', background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                      {po.status}
                    </span>
                    {po.grand_total > 0 && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)' }}>
                        ${po.grand_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                    <CaretRight size={12} style={{ color: 'var(--black)' }} />
                  </div>
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Transaction history (collapsed by default) */}
      <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-4)' }}>
        <button onClick={loadTransactions}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', border: 'none', background: 'none', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <ClipboardText size={16} style={{ color: 'var(--black)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Transaction History</span>
          </div>
          <CaretDown size={14} style={{ color: 'var(--black)', transform: showTx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showTx && (
          <div style={{ borderTop: '1px solid var(--border-l)' }}>
            {transactions.length === 0 ? (
              <div style={{ padding: 'var(--sp-5)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>No transactions yet</div>
            ) : transactions.map(tx => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderBottom: '1px solid var(--border-l)' }}>
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: 'var(--r-full)', flexShrink: 0,
                  background: tx.quantity_delta > 0 ? '#F0FDF4' : '#FEF2F2',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 800, color: tx.quantity_delta > 0 ? '#15803D' : '#B91C1C' }}>
                    {tx.quantity_delta > 0 ? '+' : ''}{tx.quantity_delta}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.parts?.name || '—'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                    {txTypeLabel[tx.transaction_type] || tx.transaction_type} · {new Date(tx.created_at).toLocaleDateString()}
                    {tx.reason && ` · ${tx.reason}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit warehouse sheet */}
      {showEdit && (
        <EditWarehouseSheet
          warehouse={warehouse}
          onClose={() => setShowEdit(false)}
          onSaved={updated => { setWarehouse(updated); setShowEdit(false) }}
        />
      )}
    </div>
  )
}

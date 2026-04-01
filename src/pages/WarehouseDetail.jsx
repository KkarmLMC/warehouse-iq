import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Buildings, Package, WarningCircle, ArrowsLeftRight,
  Plus, TrendUp, CurrencyDollar, Truck, CaretRight,
  PencilSimple, MapPin, Phone, Envelope, ClipboardText,
  CaretDown, MagnifyingGlass, X, Check, Receipt } from '@phosphor-icons/react'
import { Card, StatCard, SearchInput, FilterPills, Button } from '../components/ui'
import { db } from '../lib/supabase.js'
import { soStatus } from '../lib/statusColors.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')

// ─── Shared label component ───────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 'var(--space-xs)' }}>
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
    notes:         warehouse.notes         || '' })
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
    await logActivity(db, user?.id, APP_SOURCE, {
      category:    'inventory',
      action:      'updated_warehouse',
      label:       `Updated warehouse: ${form.name || warehouse.name}`,
      entity_type: 'warehouse',
      entity_id:   warehouse.id })
    onSaved({ ...warehouse, ...form })
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.5)', animation: 'anim-fade-in 0.15s ease' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 300,
        background: 'var(--surface-base)', borderRadius: 'var(--radius-l) var(--radius-l) 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'anim-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)' }}>
        {/* Sheet header */}
        <div style={{ padding: 'var(--space-l) var(--space-xl) 0', flexShrink: 0 }}>
          <div style={{ width: '2.5rem', height: '0.25rem', background: 'var(--border-subtle)', borderRadius: 'var(--radius-l)', margin: '0 auto var(--space-m)' }} />
          <div className="flex-between" style={{ marginBottom: 'var(--space-l)' }}>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Edit Warehouse</div>
            <button onClick={onClose} className="flex-center" style={{ background: 'var(--surface-hover)', borderRadius: 'var(--radius-l)', width: '2rem', height: '2rem', cursor: 'pointer' }}>
              <X size="0.875rem" style={{ color: 'var(--text-primary)' }} />
            </button>
          </div>
        </div>

        {/* Scrollable fields */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--space-xl) var(--space-s)' }}>

          <div style={{ marginBottom: 'var(--space-m)' }}>
            <Label>Warehouse Name *</Label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Lightning Master Warehouse" className="u-w-full" />
          </div>

          <div style={{ margin: 'var(--space-m) 0', paddingTop: 'var(--space-m)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-m)' }}>Location</div>
          </div>

          <div style={{ marginBottom: 'var(--space-m)' }}>
            <Label>Street Address</Label>
            <input value={form.address} onChange={e => set('address', e.target.value)} placeholder="123 Main St" className="u-w-full" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px', gap: 'var(--space-s)', marginBottom: 'var(--space-m)' }}>
            <div>
              <Label>City</Label>
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Clearwater" className="u-w-full" />
            </div>
            <div>
              <Label>State</Label>
              <input value={form.state} onChange={e => set('state', e.target.value)} placeholder="FL" className="u-w-full" />
            </div>
            <div>
              <Label>ZIP</Label>
              <input value={form.zip} onChange={e => set('zip', e.target.value)} placeholder="33755" className="u-w-full" />
            </div>
          </div>

          <div style={{ margin: 'var(--space-m) 0', paddingTop: 'var(--space-m)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-m)' }}>Contact</div>
          </div>

          <div style={{ marginBottom: 'var(--space-m)' }}>
            <Label>Contact Name</Label>
            <input value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="John Smith" className="u-w-full" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-s)', marginBottom: 'var(--space-m)' }}>
            <div>
              <Label>Phone</Label>
              <input value={form.contact_phone} onChange={e => set('contact_phone', e.target.value)} placeholder="(555) 000-0000" className="u-w-full" />
            </div>
            <div>
              <Label>Email</Label>
              <input value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="john@example.com" className="u-w-full" />
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-m)' }}>
            <Label>Notes</Label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any relevant notes about this warehouse…" rows={3} className="u-w-full u-resize-vertical" />
          </div>

          {error && <div style={{ color: 'var(--state-error-text)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-m)', padding: 'var(--space-s) var(--space-m)', background: 'var(--state-error-soft)', borderRadius: 'var(--radius-m)' }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: 'var(--space-l) var(--space-xl)', paddingBottom: 'calc(var(--space-l) + env(safe-area-inset-bottom))', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            style={{ width: '100%', padding: 'var(--space-m)', borderRadius: 'var(--radius-m)', background: !form.name.trim() ? 'var(--surface-hover)' : 'var(--brand-primary)', color: !form.name.trim() ? 'var(--text-muted)' : '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: !form.name.trim() ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-s)' }}>
            {saving ? 'Saving…' : <><Check size="0.9375rem" /> Save Changes</>}
          </button>
        </div>
      </div>
    </>
  )
}



// ─── Part row in the stock list ───────────────────────────────────────────────
function StockRow({ level, onPress }) {
  const isLow = level.min_level && level.quantity_on_hand <= level.min_level && level.quantity_on_hand > 0
  const isOut = level.quantity_on_hand === 0
  const color = isOut ? 'var(--state-error-text)' : isLow ? 'var(--state-warning-text)' : 'var(--state-success-text)'
  const bg    = isOut ? 'var(--state-error-soft)' : isLow ? 'var(--state-warning-soft)' : 'var(--state-success-soft)'

  return (
    <button onClick={onPress} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: 'var(--space-m) var(--space-l)', background: 'none', width: '100%', textAlign: 'left',
      borderBottom: '1px solid var(--border-subtle)', cursor: 'pointer',
      WebkitTapHighlightColor: 'transparent' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {level.parts?.name || '—'}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 'var(--space-s)' }}>
          {level.parts?.sku && <span style={{ fontFamily: 'var(--mono)' }}>{level.parts.sku}</span>}
          {level.quantity_on_order > 0 && <span style={{ color: 'var(--state-info)', fontWeight: 600 }}>+{level.quantity_on_order} on order</span>}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)', flexShrink: 0 }}>
        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-s)', fontSize: 'var(--text-sm)', fontWeight: 700, background: bg, color }}>
          {level.quantity_on_hand}
        </span>
        <CaretRight size="0.8125rem" style={{ color: 'var(--text-primary)' }} />
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

  if (loading) return <div className="page-content fade-in flex-center" style={{ padding: 'var(--space-2xl)' }}><div className="spinner" /></div>
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
    count_correction: 'Count Correction' }

  return (
    <div className="page-content fade-in">

      {/* Header */}
      <div className="wh-header">
        <div className="wh-header__top">
          <div className="flex-gap-m">
            <div className="wh-header__icon">
              <Buildings size="1.375rem" style={{ color: '#fff' }} />
            </div>
            <div>
              <div className="wh-header__name">{warehouse.name}</div>
              {(warehouse.city || warehouse.state) && (
                <div className="wh-header__loc">
                  <MapPin size="0.75rem" />
                  {[warehouse.city, warehouse.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)}
            style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-l)', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
            <PencilSimple size="0.9375rem" />
          </button>
        </div>

        {/* Contact info */}
        {(warehouse.contact_name || warehouse.contact_phone || warehouse.contact_email || warehouse.address) && (
          <div className="wh-header__contact">
            {warehouse.address && (
              <div className="wh-header__contact-row">
                <MapPin size="0.75rem" />
                {warehouse.address}{warehouse.zip ? `, ${warehouse.zip}` : ''}
              </div>
            )}
            {warehouse.contact_name && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)' }}>Contact: {warehouse.contact_name}</div>
            )}
            {warehouse.contact_phone && (
              <div className="wh-header__contact-row">
                <Phone size="0.75rem" /> {warehouse.contact_phone}
              </div>
            )}
            {warehouse.contact_email && (
              <div className="wh-header__contact-row">
                <Envelope size="0.75rem" /> {warehouse.contact_email}
              </div>
            )}
            {warehouse.notes && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)', fontStyle: 'italic', marginTop: 2 }}>{warehouse.notes}</div>
            )}
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-m)', marginBottom: 'var(--space-l)' }}>
        <StatCard label="SKUs In Stock" value={totalSkus.toLocaleString()} />
        <StatCard label="Total Units" value={totalUnits.toLocaleString()} />
        <StatCard label="Low Stock" value={lowStock.length} />
        <StatCard label="On Order" value={totalOnOrder.toLocaleString()} />
      </div>

      {/* Value */}
      {totalValue > 0 && (
        <div className="value-card">
          <div className="value-card__label">
            <CurrencyDollar size="1rem" />
            <span>Est. Inventory Value</span>
          </div>
          <span className="value-card__amount">
            ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-m)', marginBottom: 'var(--space-xl)' }}>
        <button onClick={() => navigate(`/warehouse-hq/transfer?from=${id}`)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-s)', padding: 'var(--space-m)', borderRadius: 'var(--radius-m)', background: 'var(--surface-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <ArrowsLeftRight size="0.9375rem" /> Transfer
        </button>
        <button onClick={() => navigate('/warehouse-hq/add-part')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-s)', padding: 'var(--space-m)', borderRadius: 'var(--radius-m)', background: 'var(--brand-primary)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          <Plus size="0.9375rem" /> Add Part
        </button>
      </div>

      {/* Stock section */}
      <div style={{ marginBottom: 'var(--space-s)' }}>
        <div className="stock-section__title">
          Stock ({levels.length} parts)
        </div>

        {/* Search + filters */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-m)' }}>
          <MagnifyingGlass size="0.9375rem" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: search ? 34 : 12 }} />
          {search && (
            <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size="0.8125rem" />
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-s)', marginBottom: 'var(--space-m)', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {[['all', 'All'], ['in', 'In Stock'], ['low', `Low (${lowStock.length})`], ['out', `Out (${outOfStock.length})`]].map(([val, lbl]) => (
            <button key={val} onClick={() => setStockFilter(val)}
              style={{
                flexShrink: 0, padding: '0.25rem 0.75rem', borderRadius: 'var(--radius-l)',
                border: `1px solid ${stockFilter === val ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
                background: stockFilter === val ? 'var(--brand-primary)' : 'var(--surface-hover)',
                color: stockFilter === val ? '#fff' : 'var(--text-primary)',
                fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{lbl}</button>
          ))}
        </div>

        {/* Stock list */}
        <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', overflow: 'hidden', marginBottom: 'var(--space-xl)' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 'var(--space-2xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
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
        return (
          <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', overflow: 'hidden', marginBottom: 'var(--space-l)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-m) var(--space-l)', borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)' }}>
                <Receipt size="1rem" style={{ color: 'var(--brand-primary)' }} />
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>Sales Orders</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', background: 'var(--surface-hover)', padding: '2px 8px', borderRadius: 'var(--radius-s)', fontWeight: 600 }}>
                  {warehousePOs.length}
                </span>
              </div>
              <button onClick={() => navigate('/sales-orders')}
                style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--brand-primary)', background: 'none', cursor: 'pointer', padding: 0 }}>
                View all
              </button>
            </div>
            {warehousePOs.map((po, idx) => {
              const sc = soStatus(po.status)
              return (
                <button key={po.id} onClick={() => navigate(`/sales-orders/${po.id}`)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', background: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: idx < warehousePOs.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <div style={{ fontSize: 'var(--text-2xs)', fontWeight: 800, padding: '2px 6px', borderRadius: 4, flexShrink: 0, background: po.division === 'Bolt' ? '#FFF1F2' : 'var(--state-info-soft)', color: po.division === 'Bolt' ? 'var(--red-shade-40)' : 'var(--state-info)' }}>
                    {po.division === 'Bolt' ? 'BOLT' : 'LM'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {po.customer_name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 1 }}>
                      {po.project_name || po.so_number}
                      {po.so_date ? ` · ${new Date(po.so_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)', flexShrink: 0 }}>
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-s)', background: sc.bg, color: sc.color, textTransform: 'capitalize' }}>
                      {po.status}
                    </span>
                    {po.grand_total > 0 && (
                      <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${po.grand_total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    )}
                    <CaretRight size="0.75rem" style={{ color: 'var(--text-primary)' }} />
                  </div>
                </button>
              )
            })}
          </div>
        )
      })()}

      {/* Transaction history (collapsed by default) */}
      <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', overflow: 'hidden', marginBottom: 'var(--space-l)' }}>
        <button onClick={loadTransactions}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-m) var(--space-l)', background: 'none', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)' }}>
            <ClipboardText size="1rem" style={{ color: 'var(--text-primary)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Transaction History</span>
          </div>
          <CaretDown size="0.875rem" style={{ color: 'var(--text-primary)', transform: showTx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showTx && (
          <div >
            {transactions.length === 0 ? (
              <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No transactions yet</div>
            ) : transactions.map(tx => (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: 'var(--radius-l)', flexShrink: 0,
                  background: tx.quantity_delta > 0 ? 'var(--state-success-soft)' : 'var(--state-error-soft)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: tx.quantity_delta > 0 ? 'var(--state-success-text)' : 'var(--state-error-text)' }}>
                    {tx.quantity_delta > 0 ? '+' : ''}{tx.quantity_delta}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tx.parts?.name || '—'}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
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

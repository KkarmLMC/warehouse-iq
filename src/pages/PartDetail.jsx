import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  PencilSimple, ArrowsLeftRight, Plus, Minus,
  Package, Buildings, ClipboardText, CaretDown, Trash } from '@phosphor-icons/react'
import { Card, Button } from '../components/ui'
import { db } from '../lib/supabase.js'
import { logActivity } from '../lib/logActivity.js'
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')

function WarehouseRow({ level, warehouseName }) {
  const isLow = level.min_level && level.quantity_on_hand <= level.min_level
  const isOut = level.quantity_on_hand === 0
  const color = isOut ? 'var(--state-error-text)' : isLow ? 'var(--state-warning-text)' : 'var(--state-success-text)'
  const bg = isOut ? 'var(--state-error-soft)' : isLow ? 'var(--state-warning-soft)' : 'var(--state-success-soft)'

  return (
    <div className="warehouse-row">
      <div className="warehouse-row__icon">
        <Buildings size="1rem" style={{ color: 'var(--text-primary)' }} />
        <div>
          <div className="warehouse-row__name">{warehouseName}</div>
          <div className="warehouse-row__meta">
            {level.min_level > 0 && <span>Min: {level.min_level}</span>}
            {level.quantity_on_order > 0 && (
              <span className="warehouse-row__on-order">+{level.quantity_on_order} on order</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex-gap-s">
        <span style={{ padding: '3px 10px', borderRadius: 'var(--radius-s)', fontSize: 'var(--text-sm)', fontWeight: 700, background: bg, color }}>
          {level.quantity_on_hand}
        </span>
      </div>
    </div>
  )
}

function TransactionRow({ tx, warehouseName }) {
  const isPositive = tx.quantity_delta > 0
  const typeLabel = {
    adjustment: 'Adjustment',
    transfer_out: 'Transfer Out',
    transfer_in: 'Transfer In',
    job_checkout: 'Job Checkout',
    job_return: 'Job Return',
    receiving: 'Received',
    count_correction: 'Count Correction',
  }[tx.transaction_type] || tx.transaction_type

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: '1px solid var(--border-subtle)' }}>
      <div style={{
        width: '2rem', height: '2rem', borderRadius: 'var(--radius-l)',
        background: isPositive ? 'var(--state-success-soft)' : 'var(--state-error-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isPositive
          ? <Plus size="0.875rem" weight="bold" style={{ color: 'var(--state-success-text)' }} />
          : <Minus size="0.875rem" weight="bold" style={{ color: 'var(--state-error-text)' }} />
        }
      </div>
      <div className="content-body">
        <div className="text-sm-semi">{typeLabel}</div>
        <div className="meta-text">
          {warehouseName} · {new Date(tx.created_at).toLocaleDateString()}
        </div>
        {tx.reason && <div className="meta-text">{tx.reason}</div>}
      </div>
      <div style={{
        fontSize: 'var(--text-md)', fontWeight: 800,
        color: isPositive ? 'var(--state-success-text)' : 'var(--state-error-text)' }}>
        {isPositive ? '+' : ''}{tx.quantity_delta}
      </div>
    </div>
  )
}

// ─── Quick adjust sheet ───────────────────────────────────────────────────────
function AdjustSheet({ part, warehouses, levels, onClose, onDone }) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || '')
  const [delta, setDelta] = useState(0)
  const [type, setType] = useState('adjustment')
  const [reason, setReason] = useState('')
  const [onOrder, setOnOrder] = useState('')
  const [minLevel, setMinLevel] = useState('')
  const [saving, setSaving] = useState(false)

  // Pre-fill on_order and min_level from selected warehouse level
  const currentLevel = levels.find(l => l.warehouse_id === warehouseId)
  const handleWarehouseChange = (wid) => {
    setWarehouseId(wid)
    const lvl = levels.find(l => l.warehouse_id === wid)
    setOnOrder(lvl?.quantity_on_order > 0 ? String(lvl.quantity_on_order) : '')
    setMinLevel(lvl?.min_level > 0 ? String(lvl.min_level) : '')
  }

  const handleSave = async () => {
    if (!warehouseId) return
    setSaving(true)

    // Stock adjustment (if delta != 0)
    if (delta !== 0) {
      await db.rpc('adjust_inventory', {
        p_part_id: part.id,
        p_warehouse_id: warehouseId,
        p_quantity_delta: delta,
        p_transaction_type: type,
        p_reason: reason || null })
    }

    // Update on_order and/or min_level if changed
    const updates = {}
    if (onOrder !== '') updates.quantity_on_order = parseInt(onOrder) || 0
    if (minLevel !== '') updates.min_level = parseInt(minLevel) || null

    if (Object.keys(updates).length > 0) {
      // Upsert the level record with updated fields
      await db.from('inventory_levels')
        .upsert({
          part_id: part.id,
          warehouse_id: warehouseId,
          quantity_on_hand: currentLevel?.quantity_on_hand || 0,
          ...updates }, { onConflict: 'part_id,warehouse_id' })
    }

    await logActivity(db, userId, APP_SOURCE, {
      category:    'inventory',
      action:      'adjusted',
      label:       `Adjusted inventory for ${part?.name || part?.sku || 'part'}`,
      entity_type: 'part',
      entity_id:   part?.id,
      meta:        { updates } })
    setSaving(false)
    onDone()
  }

  const Label = ({ children }) => (
    <label className="form-field__label">
      {children}
    </label>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.5)', animation: 'anim-fade-in 0.15s ease' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 300,
        background: 'var(--surface-base)', borderRadius: 'var(--radius-l) var(--radius-l) 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'anim-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ padding: 'var(--space-l) var(--space-xl) 0', flexShrink: 0 }}>
          <div style={{ width: '2.5rem', height: '0.25rem', background: 'var(--border-subtle)', borderRadius: 'var(--radius-l)', margin: '0 auto var(--space-l)' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-l)' }}>Adjust Stock</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--space-xl)', paddingBottom: 'calc(var(--space-s))' }}>
          <div style={{ marginBottom: 'var(--space-m)' }}>
            <Label>Warehouse</Label>
            <select value={warehouseId} onChange={e => handleWarehouseChange(e.target.value)}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Divider */}
          <div className="section-gap">
            <div className="text-label mb-m">Stock Adjustment</div>
          </div>

          <div style={{ marginBottom: 'var(--space-m)' }}>
            <Label>Transaction Type</Label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="adjustment">Manual Adjustment</option>
              <option value="receiving">Receiving / New Stock</option>
              <option value="count_correction">Count Correction</option>
              <option value="job_checkout">Job Checkout</option>
              <option value="job_return">Job Return</option>
            </select>
          </div>

          <div className="grid-2col mb-m">
            <div>
              <Label>Qty Change</Label>
              <input type="number" value={delta} onChange={e => setDelta(parseInt(e.target.value) || 0)} placeholder="0" />
              <div className="meta-text meta-text--mt">Negative to reduce</div>
            </div>
            <div>
              <Label>Reason</Label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. SO-2026-0001" />
            </div>
          </div>

          {/* Divider */}
          <div className="section-gap">
            <div className="text-label mb-m">Thresholds</div>
          </div>

          <div className="grid-2col mb-l">
            <div>
              <Label>On Order</Label>
              <input type="number" min="0" value={onOrder} onChange={e => setOnOrder(e.target.value)} placeholder="0" />
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--state-info)', marginTop: 3 }}>Incoming stock</div>
            </div>
            <div>
              <Label>Min Level</Label>
              <input type="number" min="0" value={minLevel} onChange={e => setMinLevel(e.target.value)} placeholder="e.g. 10" />
              <div className="meta-text meta-text--mt">Low stock alert</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 'var(--space-l) var(--space-xl)', paddingBottom: 'calc(var(--space-l) + env(safe-area-inset-bottom))', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || (delta === 0 && onOrder === '' && minLevel === '')}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 'var(--radius-m)',
              background: (delta === 0 && onOrder === '' && minLevel === '') ? 'var(--surface-hover)' : 'var(--brand-primary)',
              color: (delta === 0 && onOrder === '' && minLevel === '') ? 'var(--text-muted)' : '#fff',
              fontWeight: 700, fontSize: 'var(--text-sm)',
              cursor: (delta === 0 && onOrder === '' && minLevel === '') ? 'default' : 'pointer' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PartDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [part, setPart] = useState(null)
  const [levels, setLevels] = useState([])
  const [transactions, setTransactions] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdjust, setShowAdjust] = useState(false)
  const [showTx, setShowTx] = useState(false)

  const load = async () => {
    const [{ data: p }, { data: lvls }, { data: txs }, { data: whs }] = await Promise.all([
      db.from('parts').select('*, part_categories(name)').eq('id', id).single(),
      db.from('inventory_levels').select('*, warehouses(name)').eq('part_id', id),
      db.from('inventory_transactions').select('*').eq('part_id', id).order('created_at', { ascending: false }).limit(20),
      db.from('warehouses').select('*').eq('is_active', true).order('name'),
    ])
    setPart(p)
    setLevels(lvls || [])
    setTransactions(txs || [])
    setWarehouses(whs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  if (loading) return <div className="page-content fade-in spinner-pad"><div className="spinner" /></div>
  if (!part) return <div className="page-content fade-in"><div className="empty"><div className="empty-title">Part not found</div></div></div>

  const totalQty = levels.reduce((s, l) => s + l.quantity_on_hand, 0)

  const whMap = {}
  for (const w of warehouses) whMap[w.id] = w.name

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div style={{ background: 'var(--brand-primary)', borderRadius: 'var(--radius-m)', padding: 'var(--space-xl)', marginBottom: 'var(--space-l)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-m)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)', marginBottom: 4 }}>
              {part.part_categories?.name || 'Uncategorized'}
            </div>
            <div className="page-heading">{part.name}</div>
            {part.sku && <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-xs)', color: 'var(--surface-base)', marginTop: 4 }}>{part.sku}</div>}
          </div>
          <button onClick={() => navigate(`/warehouse-hq/part/${id}/edit`)}
            style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--radius-l)', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <PencilSimple size="1rem" />
          </button>
        </div>

        {/* Total stock */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-s)' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{totalQty}</div>
          <div className="meta-text--inverse">{part.unit_of_measure} total</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid-2col mb-l">
        <button onClick={() => setShowAdjust(true)}
          style={{ padding: 'var(--space-m)', borderRadius: 'var(--radius-l)', background: 'var(--brand-primary)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          Adjust Stock
        </button>
        <button onClick={() => navigate('/warehouse-hq/transfer')}
          style={{ padding: 'var(--space-m)', borderRadius: 'var(--radius-l)', background: 'var(--surface-base)', color: 'var(--text-primary)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-s)' }}>
          <ArrowsLeftRight size="1rem" /> Transfer
        </button>
      </div>

      {/* Stock by warehouse */}
      <Card style={{ marginBottom: 'var(--space-l)' }}>
        <div className="pad-row">
          <div className="text-sm-bold">Stock by Warehouse</div>
        </div>
        {levels.length === 0 ? (
          <div className="empty-message">No stock recorded yet</div>
        ) : (
          levels.map(l => <WarehouseRow key={l.id} level={l} warehouseName={l.warehouses?.name || '—'} />)
        )}
      </Card>

      {/* Part details */}
      <Card style={{ marginBottom: 'var(--space-l)' }}>
        <div className="pad-row">
          <div className="text-sm-bold">Part Details</div>
        </div>
        {[
          ['Manufacturer', part.manufacturer],
          ['Mfr Part No.', part.manufacturer_part_no],
          ['Unit of Measure', part.unit_of_measure],
          ['Unit Cost', part.unit_cost ? `$${part.unit_cost}` : null],
          ['Barcode', part.barcode],
        ].filter(([, v]) => v).map(([label, value]) => (
          <div key={label} className="pad-row flex-gap-s">
            <span className="meta-text">{label}</span>
            <span className="text-sm-semi">{value}</span>
          </div>
        ))}
        {part.description && (
          <div className="pad-row">
            <div className="meta-text mb-s">Description</div>
            <div className="text-sm">{part.description}</div>
          </div>
        )}
      </Card>

      {/* Transaction history */}
      <Card style={{ marginBottom: 'var(--space-l)' }}>
        <button
          onClick={() => setShowTx(!showTx)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-m) var(--space-l)', background: 'none', cursor: 'pointer' }}>
          <div className="flex-gap-s">
            <ClipboardText size="1rem" style={{ color: 'var(--text-primary)' }} />
            <span className="text-sm-bold">Transaction History</span>
            <span style={{ padding: '1px 8px', borderRadius: 'var(--radius-s)', background: 'var(--surface-hover)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{transactions.length}</span>
          </div>
          <CaretDown size="0.875rem" style={{ color: 'var(--text-primary)', transform: showTx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showTx && transactions.map(tx => (
          <TransactionRow key={tx.id} tx={tx} warehouseName={whMap[tx.warehouse_id] || '—'} />
        ))}
        {showTx && transactions.length === 0 && (
          <div style={{ padding: 'var(--space-l)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No transactions yet</div>
        )}
      </Card>

      {showAdjust && (
        <AdjustSheet
          part={part}
          warehouses={warehouses}
          levels={levels}
          onClose={() => setShowAdjust(false)}
          onDone={() => { setShowAdjust(false); load() }}
        />
      )}
    </div>
  )
}

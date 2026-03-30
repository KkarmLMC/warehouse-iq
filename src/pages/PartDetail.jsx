import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  PencilSimple, ArrowsLeftRight, Plus, Minus,
  Package, Buildings, ClipboardText, CaretDown, Trash } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { logActivity } from '../lib/logActivity.js'

function WarehouseRow({ level, warehouseName }) {
  const isLow = level.min_level && level.quantity_on_hand <= level.min_level
  const isOut = level.quantity_on_hand === 0
  const color = isOut ? 'var(--error-dark)' : isLow ? 'var(--orange-shade-20)' : 'var(--success-text)'
  const bg = isOut ? 'var(--error-soft)' : isLow ? 'var(--orange-soft)' : 'var(--success-soft)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)' }}>
        <Buildings size={16} style={{ color: 'var(--black)' }} />
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{warehouseName}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', display: 'flex', gap: 'var(--gap-s)', marginTop: 2 }}>
            {level.min_level > 0 && <span>Min: {level.min_level}</span>}
            {level.quantity_on_order > 0 && (
              <span style={{ color: 'var(--blue)', fontWeight: 600 }}>+{level.quantity_on_order} on order</span>
            )}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)' }}>
        <span style={{ padding: '3px 10px', borderRadius: 'var(--r-s)', fontSize: 'var(--text-sm)', fontWeight: 700, background: bg, color }}>
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
      <div style={{
        width: '2rem', height: '2rem', borderRadius: 'var(--r-xxl)',
        background: isPositive ? 'var(--success-soft)' : 'var(--error-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isPositive
          ? <Plus size={14} weight="bold" style={{ color: 'var(--success-text)' }} />
          : <Minus size={14} weight="bold" style={{ color: 'var(--error-dark)' }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{typeLabel}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
          {warehouseName} · {new Date(tx.created_at).toLocaleDateString()}
        </div>
        {tx.reason && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>{tx.reason}</div>}
      </div>
      <div style={{
        fontSize: 'var(--text-md)', fontWeight: 800,
        color: isPositive ? 'var(--success-text)' : 'var(--error-dark)' }}>
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

    await logActivity(db, userId, 'warehouse_iq', {
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
    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>
      {children}
    </label>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 299, background: 'rgba(0,0,0,0.5)', animation: 'anim-fade-in 0.15s ease' }} />
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)', zIndex: 300,
        background: 'var(--white)', borderRadius: 'var(--r-xl) var(--r-xl) 0 0',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column',
        animation: 'anim-slide-up 0.22s cubic-bezier(0.32,0.72,0,1)' }}>
        <div style={{ padding: 'var(--pad-l) var(--pad-xl) 0', flexShrink: 0 }}>
          <div style={{ width: '2.5rem', height: '0.25rem', background: 'var(--border-l)', borderRadius: 'var(--r-xxl)', margin: '0 auto var(--mar-l)' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--mar-l)' }}>Adjust Stock</div>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '0 var(--pad-xl)', paddingBottom: 'calc(var(--pad-s))' }}>
          <div style={{ marginBottom: 'var(--mar-m)' }}>
            <Label>Warehouse</Label>
            <select value={warehouseId} onChange={e => handleWarehouseChange(e.target.value)} style={{ width: '100%' }}>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>

          {/* Divider */}
          <div style={{ margin: 'var(--mar-m) 0', paddingTop: 'var(--pad-m)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--mar-m)' }}>Stock Adjustment</div>
          </div>

          <div style={{ marginBottom: 'var(--mar-m)' }}>
            <Label>Transaction Type</Label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
              <option value="adjustment">Manual Adjustment</option>
              <option value="receiving">Receiving / New Stock</option>
              <option value="count_correction">Count Correction</option>
              <option value="job_checkout">Job Checkout</option>
              <option value="job_return">Job Return</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-m)' }}>
            <div>
              <Label>Qty Change</Label>
              <input type="number" value={delta} onChange={e => setDelta(parseInt(e.target.value) || 0)} placeholder="0" style={{ width: '100%' }} />
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-3)', marginTop: 3 }}>Negative to reduce</div>
            </div>
            <div>
              <Label>Reason</Label>
              <input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. SO-2026-0001" style={{ width: '100%' }} />
            </div>
          </div>

          {/* Divider */}
          <div style={{ margin: 'var(--mar-m) 0', paddingTop: 'var(--pad-m)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--mar-m)' }}>Thresholds</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-l)' }}>
            <div>
              <Label>On Order</Label>
              <input type="number" min="0" value={onOrder} onChange={e => setOnOrder(e.target.value)} placeholder="0" style={{ width: '100%' }} />
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--blue)', marginTop: 3 }}>Incoming stock</div>
            </div>
            <div>
              <Label>Min Level</Label>
              <input type="number" min="0" value={minLevel} onChange={e => setMinLevel(e.target.value)} placeholder="e.g. 10" style={{ width: '100%' }} />
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-3)', marginTop: 3 }}>Low stock alert</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 'var(--pad-l) var(--pad-xl)', paddingBottom: 'calc(var(--pad-l) + env(safe-area-inset-bottom))', flexShrink: 0 }}>
          <button onClick={handleSave} disabled={saving || (delta === 0 && onOrder === '' && minLevel === '')}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 'var(--r-m)',
              background: (delta === 0 && onOrder === '' && minLevel === '') ? 'var(--hover)' : 'var(--navy)',
              color: (delta === 0 && onOrder === '' && minLevel === '') ? 'var(--text-3)' : '#fff',
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

  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pad-xxl)' }}><div className="spinner" /></div>
  if (!part) return <div className="page-content fade-in"><div className="empty"><div className="empty-title">Part not found</div></div></div>

  const totalQty = levels.reduce((s, l) => s + l.quantity_on_hand, 0)

  const whMap = {}
  for (const w of warehouses) whMap[w.id] = w.name

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xl)', marginBottom: 'var(--mar-l)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--mar-m)' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>
              {part.part_categories?.name || 'Uncategorized'}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>{part.name}</div>
            {part.sku && <div style={{ fontFamily: 'var(--mono)', fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)', marginTop: 4 }}>{part.sku}</div>}
          </div>
          <button onClick={() => navigate(`/warehouse-hq/part/${id}/edit`)}
            style={{ width: '2.25rem', height: '2.25rem', borderRadius: 'var(--r-l)', background: 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <PencilSimple size={16} />
          </button>
        </div>

        {/* Total stock */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--gap-s)' }}>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1 }}>{totalQty}</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.7)' }}>{part.unit_of_measure} total</div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-l)' }}>
        <button onClick={() => setShowAdjust(true)}
          style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-l)', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          Adjust Stock
        </button>
        <button onClick={() => navigate('/warehouse-hq/transfer')}
          style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-l)', background: 'var(--white)', color: 'var(--black)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--gap-s)' }}>
          <ArrowsLeftRight size={16} /> Transfer
        </button>
      </div>

      {/* Stock by warehouse */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
        <div style={{ padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Stock by Warehouse</div>
        </div>
        {levels.length === 0 ? (
          <div style={{ padding: 'var(--pad-xl)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>No stock recorded yet</div>
        ) : (
          levels.map(l => <WarehouseRow key={l.id} level={l} warehouseName={l.warehouses?.name || '—'} />)
        )}
      </div>

      {/* Part details */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
        <div style={{ padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Part Details</div>
        </div>
        {[
          ['Manufacturer', part.manufacturer],
          ['Mfr Part No.', part.manufacturer_part_no],
          ['Unit of Measure', part.unit_of_measure],
          ['Unit Cost', part.unit_cost ? `$${part.unit_cost}` : null],
          ['Barcode', part.barcode],
        ].filter(([, v]) => v).map(([label, value]) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--pad-m) var(--pad-l)', borderBottom: '1px solid var(--border-l)' }}>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>{label}</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        {part.description && (
          <div style={{ padding: 'var(--pad-m) var(--pad-l)' }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 4 }}>Description</div>
            <div style={{ fontSize: 'var(--text-sm)' }}>{part.description}</div>
          </div>
        )}
      </div>

      {/* Transaction history */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
        <button
          onClick={() => setShowTx(!showTx)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--pad-m) var(--pad-l)', background: 'none', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)' }}>
            <ClipboardText size={16} style={{ color: 'var(--black)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Transaction History</span>
            <span style={{ padding: '1px 8px', borderRadius: 'var(--r-s)', background: 'var(--hover)', fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>{transactions.length}</span>
          </div>
          <CaretDown size={14} style={{ color: 'var(--black)', transform: showTx ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {showTx && transactions.map(tx => (
          <TransactionRow key={tx.id} tx={tx} warehouseName={whMap[tx.warehouse_id] || '—'} />
        ))}
        {showTx && transactions.length === 0 && (
          <div style={{ padding: 'var(--pad-l)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>No transactions yet</div>
        )}
      </div>

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

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowsClockwise, Lock, Buildings, Package,
  TrendUp, CurrencyDollar, Truck, WarningCircle,
  Receipt, CaretRight, ArrowDown, ArrowUp,
  MagnifyingGlass, X, Download } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Status chip ──────────────────────────────────────────────────────────────
function StockChip({ stock, min }) {
  if (stock === 0)            return <span style={chip('var(--state-error-soft)','var(--state-error-text)')}>Out</span>
  if (min && stock <= min)    return <span style={chip('var(--state-warning-soft)','var(--state-warning-text)')}>Low</span>
  return                             <span style={chip('var(--state-success-soft)','var(--state-success-text)')}>OK</span>
}
function chip(bg, color) {
  return { padding:'2px 8px', borderRadius:'var(--radius-s)', fontSize:'var(--text-xs)', fontWeight:700, background:bg, color, whiteSpace:'nowrap' }
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SumCard({ label, value, sub, color = 'var(--text-primary)', Icon }) {
  return (
    <div className="card-section">
      <div className="warehouse-i-q-1b6e">
        {Icon && <Icon size="0.875rem" style={{ color:'var(--text-muted)' }} />}
        <span className="text-label">{label}</span>
      </div>
      <div className="warehouse-i-q-8075">{value}</div>
      {sub && <div className="warehouse-i-q-f902">{sub}</div>}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function WarehouseIQ() {
  const navigate = useNavigate()
  const [warehouses, setWarehouses]     = useState([])
  const [activeWH, setActiveWH]         = useState(null)
  const [period, setPeriod]             = useState(null)
  const [rows, setRows]                 = useState([])
  const [pos, setPOs]                   = useState([])
  const [loading, setLoading]           = useState(true)
  const [closing, setClosing]           = useState(false)
  const [search, setSearch]             = useState('')
  const [filter, setFilter]             = useState('all') // all | low | out | active

  // Load warehouses once
  useEffect(() => {
    db.from('warehouses').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        setWarehouses(data || [])
        if (data?.length) setActiveWH(data[0].id)
      })
  }, [])

  // Load cycle data when warehouse changes
  const loadPeriod = useCallback(async () => {
    if (!activeWH) return
    setLoading(true)

    const now = new Date()
    const yr = now.getFullYear()
    const mo = now.getMonth() + 1

    // Get or create current period
    let { data: per } = await db.from('inventory_periods')
      .select('*').eq('warehouse_id', activeWH)
      .eq('period_year', yr).eq('period_month', mo).single()

    if (!per) {
      const { data: newPer } = await db.from('inventory_periods')
        .insert({ warehouse_id: activeWH, period_year: yr, period_month: mo })
        .select().single()
      per = newPer
    }
    setPeriod(per)

    // Load all parts with levels for this warehouse
    const [{ data: levels }, { data: snapshots }, { data: txns }, { data: poData }] = await Promise.all([
      db.from('inventory_levels')
        .select('*, parts(id, sku, name, unit_cost, category_id, part_categories(name))')
        .eq('warehouse_id', activeWH),
      db.from('inventory_period_snapshots')
        .select('*').eq('period_id', per.id).eq('warehouse_id', activeWH),
      // Transactions this period (from first of month)
      db.from('inventory_transactions')
        .select('part_id, transaction_type, quantity_delta')
        .eq('warehouse_id', activeWH)
        .gte('created_at', `${yr}-${String(mo).padStart(2,'0')}-01T00:00:00Z`),
      // Active POs referencing this warehouse
      db.from('so_line_items')
        .select('so_id, part_id, quantity, sales_orders(so_number, customer_name, status, grand_total, division)')
        .eq('warehouse_id', activeWH)
        .in('sales_orders.status', ['queued','running','fulfillment','shipment','back_ordered']),
    ])

    // Build snap map
    const snapMap = {}
    snapshots?.forEach(s => { snapMap[s.part_id] = s.start_quantity })

    // Build tx map: added = sum of positive deltas (receiving), used = sum of negatives (checkout)
    const addedMap = {}, usedMap = {}
    txns?.forEach(t => {
      if (t.quantity_delta > 0) addedMap[t.part_id] = (addedMap[t.part_id] || 0) + t.quantity_delta
      if (t.quantity_delta < 0) usedMap[t.part_id]  = (usedMap[t.part_id]  || 0) + Math.abs(t.quantity_delta)
    })

    // Build rows
    const built = (levels || []).map(l => {
      const p = l.parts
      if (!p) return null
      const startQty = snapMap[l.part_id] ?? l.quantity_on_hand
      const added    = addedMap[l.part_id] || 0
      const used     = usedMap[l.part_id]  || 0
      const stock    = l.quantity_on_hand
      const onOrder  = l.quantity_on_order || 0
      const cost     = p.unit_cost || 0
      const value    = stock * cost
      return { part: p, startQty, added, used, stock, onOrder, cost, value, min: l.min_level }
    }).filter(Boolean)

    built.sort((a,b) => a.part.name.localeCompare(b.part.name))
    setRows(built)

    // Unique active POs
    const poMap = {}
    poData?.forEach(li => {
      if (li.sales_orders) poMap[li.so_id] = li.sales_orders
    })
    setPOs(Object.values(poMap))
    setLoading(false)
  }, [activeWH])

  useEffect(() => { loadPeriod() }, [loadPeriod])

  const handleClosePeriod = async () => {
    if (!period || !window.confirm(`Close ${MONTH_NAMES[period.period_month-1]} ${period.period_year}? This will lock the period and snapshot current stock as the new month's start.`)) return
    setClosing(true)
    // 1. Close period
    await db.from('inventory_periods').update({ closed_at: new Date().toISOString() }).eq('id', period.id)
    // 2. Create next period
    const nextMo = period.period_month === 12 ? 1 : period.period_month + 1
    const nextYr = period.period_month === 12 ? period.period_year + 1 : period.period_year
    const { data: newPer } = await db.from('inventory_periods')
      .insert({ warehouse_id: activeWH, period_year: nextYr, period_month: nextMo })
      .select().single()
    // 3. Snapshot current stock as next period's start
    const levels = await db.from('inventory_levels').select('part_id, quantity_on_hand').eq('warehouse_id', activeWH)
    if (levels.data?.length && newPer) {
      await db.from('inventory_period_snapshots').insert(
        levels.data.map(l => ({ period_id: newPer.id, part_id: l.part_id, warehouse_id: activeWH, start_quantity: l.quantity_on_hand }))
      )
    }
    setClosing(false)
    loadPeriod()
  }

  // Filtered rows
  const filtered = rows.filter(r => {
    if (filter === 'low' && !(r.min && r.stock > 0 && r.stock <= r.min)) return false
    if (filter === 'out' && r.stock !== 0) return false
    if (filter === 'active' && r.used === 0 && r.added === 0) return false
    if (search) {
      const q = search.toLowerCase()
      return r.part.name.toLowerCase().includes(q) || (r.part.sku||'').toLowerCase().includes(q)
    }
    return true
  })

  // Summary totals
  const totalValue    = rows.reduce((s,r) => s + r.value, 0)
  const totalUsed     = rows.reduce((s,r) => s + r.used, 0)
  const totalAdded    = rows.reduce((s,r) => s + r.added, 0)
  const totalOnOrder  = rows.reduce((s,r) => s + r.onOrder, 0)
  const lowCount      = rows.filter(r => r.min && r.stock > 0 && r.stock <= r.min).length
  const outCount      = rows.filter(r => r.stock === 0).length

  const wh = warehouses.find(w => w.id === activeWH)
  const periodLabel = period ? `${MONTH_NAMES[period.period_month-1]} ${period.period_year}` : '—'
  const isClosed = !!period?.closed_at

  return (
    <div className="page-content fade-in">

      <div className="warehouse-i-q-535c">
        {!isClosed && period && (
          <button onClick={handleClosePeriod} disabled={closing}
            className="btn meta-text">
            <Lock size="0.8125rem" /> {closing ? 'Closing…' : `Close ${periodLabel}`}
          </button>
        )}
        <button onClick={loadPeriod}
          className="btn meta-text">
          <ArrowsClockwise size="0.8125rem" /> Refresh
        </button>
      </div>

      {/* Period + warehouse selector */}
      <div className="warehouse-i-q-4f2e">
        {/* Period badge */}
        <div className="flex-gap-s">
          <div style={{ padding: 'var(--space-s) var(--space-l)', borderRadius:'var(--radius-l)', background: isClosed ? 'var(--surface-light)' : 'var(--brand-primary)', color: isClosed ? 'var(--text-secondary)' : '#fff', fontWeight: 'var(--fw-bold)', fontSize:'var(--text-sm)' }}>
            {periodLabel}
          </div>
          {isClosed
            ? <span className="warehouse-i-q-aca5">Closed</span>
            : <span className="warehouse-i-q-7741">● Open</span>
          }
        </div>

        {/* Warehouse tabs */}
        <div className="warehouse-i-q-8a71">
          {warehouses.map(w => (
            <button key={w.id} onClick={() => setActiveWH(w.id)}
              style={{
                flexShrink:0, padding:'0.25rem 0.75rem', borderRadius:'var(--radius-l)',
                background: activeWH === w.id ? 'var(--brand-primary)' : 'var(--surface-hover)',
                color: activeWH === w.id ? '#fff' : 'var(--text-primary)',
                fontSize:'var(--text-xs)', fontWeight: 'var(--fw-bold)', cursor:'pointer', whiteSpace:'nowrap' }}>
              {w.name.replace(' Warehouse','')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'var(--space-m)', marginBottom: 'var(--space-xl)' }}>
        <SumCard label="Inventory Value"   value={`$${totalValue.toLocaleString('en-US',{maximumFractionDigits:0})}`} Icon={CurrencyDollar} color="var(--state-success-text)" />
        <SumCard label="Units Added"       value={totalAdded.toLocaleString()} sub="this period" Icon={ArrowDown} color="var(--state-info)" />
        <SumCard label="Units Used"        value={totalUsed.toLocaleString()}  sub="this period" Icon={ArrowUp}   color="var(--brand-primary)" />
        <SumCard label="On Order"          value={totalOnOrder.toLocaleString()} Icon={Truck} color={totalOnOrder > 0 ? 'var(--state-info)' : 'var(--text-muted)'} />
        <SumCard label="Low Stock"         value={lowCount} Icon={WarningCircle} color={lowCount > 0 ? 'var(--state-warning-text)' : 'var(--text-muted)'} />
        <SumCard label="Out of Stock"      value={outCount} Icon={Package} color={outCount > 0 ? 'var(--state-error-text)' : 'var(--text-muted)'} />
      </div>

      {/* Active POs section */}
      {pos.length > 0 && (
        <div className="warehouse-i-q-7cb6">
          <div className="warehouse-i-q-1b9f">
            <div className="flex-gap-s">
              <Receipt size="0.9375rem" style={{ color:'var(--brand-primary)' }} />
              <span className="text-sm-bold">Active Sales Orders</span>
              <span className="text-label">{pos.length}</span>
            </div>
            <button onClick={() => navigate('/sales-orders')}
              className="warehouse-i-q-4a48">
              View all
            </button>
          </div>
          {pos.map((po, idx) => (
            <button key={idx} onClick={() => navigate(`/sales-orders/${po.id || ''}`)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'var(--space-m)', padding: 'var(--space-s) var(--space-l)', background:'none', cursor:'pointer', textAlign:'left', borderBottom: idx < pos.length-1 ? 'var(--border-width-1) solid var(--border-subtle)' : 'none' }}>
              <div style={{ fontSize:'var(--text-2xs)', fontWeight: 'var(--fw-black)', padding: 'var(--space-3xs) var(--space-xs)', borderRadius: 'var(--radius-xs)', flexShrink:0, background: po.division==='Bolt'?'#FFF1F2':'var(--state-info-soft)', color: po.division==='Bolt'?'var(--red-shade-40)':'var(--state-info)' }}>
                {po.division==='Bolt'?'BOLT':'LM'}
              </div>
              <div className="content-body">
                <div className="text-sm-truncate">{po.customer_name}</div>
              </div>
              <span style={{ fontSize:'var(--text-xs)', fontWeight: 'var(--fw-bold)', padding: 'var(--space-3xs) var(--space-s)', borderRadius:'var(--radius-s)', background: po.status==='queued'?'var(--brand-soft)':po.status==='running'?'var(--state-warning-soft)':po.status==='fulfillment'?'var(--state-info-soft)':po.status==='shipment'?'var(--state-info-soft)':'var(--state-success-soft)', color: po.status==='queued'?'var(--brand-light)':po.status==='running'?'var(--state-warning)':po.status==='fulfillment'?'var(--state-info)':po.status==='shipment'?'var(--state-info)':'var(--state-success-text)', textTransform:'capitalize', flexShrink:0 }}>
                {po.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Cycle table */}
      <div className="warehouse-i-q-63aa">
        
        {/* Table toolbar */}
        <div className="warehouse-i-q-cc46">
          {/* Search */}
          <div className="warehouse-i-q-986b">
            <MagnifyingGlass size="0.8125rem" className="warehouse-i-q-8528" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…"
              style={{ paddingLeft: 'var(--search-input-offset)', paddingRight:search?28:8, fontSize:'var(--text-xs)' }} />
            {search && <button onClick={() => setSearch('')} className="warehouse-i-q-e287"><X size="0.75rem"/></button>}
          </div>
          {/* Filter pills */}
          <div className="flex-gap-s">
            {[['all','All'],['active','Active'],['low','Low'],['out','Out']].map(([val,lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                className="filter-pill-btn" style={{ background:filter===val?'var(--brand-primary)':'var(--surface-hover)', color:filter===val?'#fff':'var(--text-primary)', }}>
                {lbl}
              </button>
            ))}
          </div>
          <span className="warehouse-i-q-665b">{filtered.length} parts</span>
        </div>

        {/* Column headers */}
        <div className="warehouse-i-q-fca4">
          {['Part / SKU','Start','Added','Used','On Order','Stock','Value',''].map((h,i) => (
            <div key={i} style={{ fontSize:'var(--text-md)', fontWeight: 'var(--fw-bold)', color: 'var(--surface-base)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div className="warehouse-i-q-ddda"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="warehouse-i-q-a7d6">
            {rows.length === 0 ? 'No inventory data for this warehouse.' : 'No parts match filters.'}
          </div>
        ) : filtered.map((r, idx) => {
          const isLow = r.min && r.stock > 0 && r.stock <= r.min
          const isOut = r.stock === 0
          const rowBg = isOut ? '#FFF5F5' : isLow ? 'var(--state-warning-soft)' : 'transparent'
          const delta = r.stock - r.startQty

          return (
            <div key={r.part.id}
              onClick={() => navigate(`/warehouse-hq/part/${r.part.id}`)}
              style={{ display:'grid', gridTemplateColumns:'1fr 4.5rem 4.5rem 4.5rem 5rem 5.5rem 5.625rem 3rem', gap:'var(--space-s)', padding: 'var(--space-s) var(--space-l)', borderBottom:'var(--border-width-1) solid var(--border-subtle)', background:rowBg, cursor:'pointer', transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = isOut?'var(--state-error-soft)':isLow?'var(--state-warning-soft)':'var(--surface-hover)'}
              onMouseLeave={e => e.currentTarget.style.background = rowBg}
            >
              {/* Part name + SKU */}
              <div style={{ minWidth:0 }}>
                <div className="text-sm-truncate">{r.part.name}</div>
                {r.part.sku && <div className="warehouse-i-q-1b43">{r.part.sku}</div>}
              </div>
              {/* Start */}
              <div className="warehouse-i-q-636e">{r.startQty.toLocaleString()}</div>
              {/* Added */}
              <div style={{ textAlign:'right', fontSize:'var(--text-sm)', color: r.added > 0 ? 'var(--state-info)' : 'var(--text-muted)', fontWeight: r.added > 0 ? 700 : 400 }}>
                {r.added > 0 ? `+${r.added.toLocaleString()}` : '—'}
              </div>
              {/* Used */}
              <div style={{ textAlign:'right', fontSize:'var(--text-sm)', color: r.used > 0 ? 'var(--brand-primary)' : 'var(--text-muted)', fontWeight: r.used > 0 ? 700 : 400 }}>
                {r.used > 0 ? r.used.toLocaleString() : '—'}
              </div>
              {/* On Order */}
              <div style={{ textAlign:'right', fontSize:'var(--text-sm)', color: r.onOrder > 0 ? 'var(--state-info)' : 'var(--text-muted)', fontWeight: r.onOrder > 0 ? 700 : 400 }}>
                {r.onOrder > 0 ? r.onOrder.toLocaleString() : '—'}
              </div>
              {/* Stock + trend */}
              <div className="warehouse-i-q-8c02">
                <span style={{ fontSize:'var(--text-sm)', fontWeight: 'var(--fw-black)', color: isOut ? 'var(--state-error-text)' : isLow ? 'var(--state-warning-text)' : 'var(--text-primary)' }}>
                  {r.stock.toLocaleString()}
                </span>
                {delta !== 0 && (
                  <span style={{ fontSize:'var(--text-2xs)', fontWeight: 'var(--fw-bold)', color: delta > 0 ? 'var(--state-success-text)' : 'var(--state-error-text)' }}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              {/* Value */}
              <div className="text-sm-semi">
                {r.value > 0 ? `$${r.value.toLocaleString('en-US',{maximumFractionDigits:0})}` : '—'}
              </div>
              {/* Status chip */}
              <div className="warehouse-i-q-044c">
                <StockChip stock={r.stock} min={r.min} />
              </div>
            </div>
          )
        })}

        {/* Totals footer */}
        {filtered.length > 0 && (
          <div className="warehouse-i-q-e2a8">
            <div className="warehouse-i-q-9960">Period Totals</div>
            <div className="warehouse-i-q-d102">—</div>
            <div className="warehouse-i-q-7463">
              {filtered.reduce((s,r)=>s+r.added,0) > 0 ? `+${filtered.reduce((s,r)=>s+r.added,0).toLocaleString()}` : '—'}
            </div>
            <div className="warehouse-i-q-4f26">
              {filtered.reduce((s,r)=>s+r.used,0) > 0 ? filtered.reduce((s,r)=>s+r.used,0).toLocaleString() : '—'}
            </div>
            <div className="warehouse-i-q-d370">
              {filtered.reduce((s,r)=>s+r.onOrder,0) > 0 ? filtered.reduce((s,r)=>s+r.onOrder,0).toLocaleString() : '—'}
            </div>
            <div className="warehouse-i-q-5f47">
              {filtered.reduce((s,r)=>s+r.stock,0).toLocaleString()}
            </div>
            <div className="warehouse-i-q-552a">
              ${filtered.reduce((s,r)=>s+r.value,0).toLocaleString('en-US',{maximumFractionDigits:0})}
            </div>
            <div />
          </div>
        )}
      </div>
    </div>
  )
}

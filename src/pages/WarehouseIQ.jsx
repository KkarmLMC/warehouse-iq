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
  if (stock === 0)            return <span style={chip('var(--error-soft)','var(--error-dark)')}>Out</span>
  if (min && stock <= min)    return <span style={chip('var(--orange-soft)','var(--orange-shade-20)')}>Low</span>
  return                             <span style={chip('var(--success-soft)','var(--success-text)')}>OK</span>
}
function chip(bg, color) {
  return { padding:'2px 8px', borderRadius:'var(--r-s)', fontSize:'var(--text-xs)', fontWeight:700, background:bg, color, whiteSpace:'nowrap' }
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SumCard({ label, value, sub, color = 'var(--black)', Icon }) {
  return (
    <div style={{ background: 'var(--white)', borderRadius:'var(--r-xl)', padding:'var(--pad-l)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'var(--gap-s)', marginBottom: 'var(--mar-s)' }}>
        {Icon && <Icon size={14} style={{ color:'var(--text-3)' }} />}
        <span style={{ fontSize:'var(--text-xs)', fontWeight:700, color:'var(--black)' }}>{label}</span>
      </div>
      <div style={{ fontSize:'var(--text-base)', fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'var(--text-xs)', color:'var(--text-3)', marginTop:4 }}>{sub}</div>}
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

      {/* Page header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--gap-m)', marginBottom: 'var(--mar-l)', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:'var(--text-xs)', fontWeight:700, color:'var(--black)', marginBottom:4 }}>WAREHOUSE IQ</div>
          <div style={{ fontSize:'var(--text-base)', fontWeight:800, lineHeight:1.1 }}>Inventory Dashboard</div>
        </div>
        <div style={{ display:'flex', gap:'var(--gap-s)', alignItems:'center', flexWrap:'wrap' }}>
          {!isClosed && period && (
            <button onClick={handleClosePeriod} disabled={closing}
              style={{ display:'flex', alignItems:'center', gap:'var(--gap-s)', padding: 'var(--pad-s) var(--pad-m)', borderRadius:'var(--r-m)', background: 'var(--white)', color:'var(--black)', fontSize:'var(--text-xs)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              <Lock size={13} /> {closing ? 'Closing…' : `Close ${periodLabel}`}
            </button>
          )}
          <button onClick={loadPeriod}
            style={{ display:'flex', alignItems:'center', gap:'var(--gap-s)', padding: 'var(--pad-s) var(--pad-m)', borderRadius:'var(--r-m)', background: 'var(--white)', color:'var(--black)', fontSize:'var(--text-xs)', fontWeight:700, cursor:'pointer' }}>
            <ArrowsClockwise size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Period + warehouse selector */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--mar-l)', flexWrap:'wrap', gap:'var(--gap-m)' }}>
        {/* Period badge */}
        <div style={{ display:'flex', alignItems:'center', gap:'var(--gap-s)' }}>
          <div style={{ padding: 'var(--pad-s) var(--pad-l)', borderRadius:'var(--r-xxl)', background: isClosed ? 'var(--grey-tint-80)' : 'var(--navy)', color: isClosed ? 'var(--grey-base)' : '#fff', fontWeight:700, fontSize:'var(--text-sm)' }}>
            {periodLabel}
          </div>
          {isClosed
            ? <span style={{ fontSize:'var(--text-xs)', color:'var(--grey-base)', fontWeight:600 }}>Closed</span>
            : <span style={{ fontSize:'var(--text-xs)', color:'var(--success-text)', fontWeight:600 }}>● Open</span>
          }
        </div>

        {/* Warehouse tabs */}
        <div style={{ display:'flex', gap:'var(--gap-s)', overflowX:'auto', scrollbarWidth:'none' }}>
          {warehouses.map(w => (
            <button key={w.id} onClick={() => setActiveWH(w.id)}
              style={{
                flexShrink:0, padding:'0.25rem 0.75rem', borderRadius:'var(--r-xxl)',
                background: activeWH === w.id ? 'var(--navy)' : 'var(--hover)',
                color: activeWH === w.id ? '#fff' : 'var(--black)',
                fontSize:'var(--text-xs)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              {w.name.replace(' Warehouse','')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'var(--gap-m)', marginBottom: 'var(--mar-xl)' }}>
        <SumCard label="Inventory Value"   value={`$${totalValue.toLocaleString('en-US',{maximumFractionDigits:0})}`} Icon={CurrencyDollar} color="var(--success-text)" />
        <SumCard label="Units Added"       value={totalAdded.toLocaleString()} sub="this period" Icon={ArrowDown} color="var(--blue)" />
        <SumCard label="Units Used"        value={totalUsed.toLocaleString()}  sub="this period" Icon={ArrowUp}   color="var(--purple)" />
        <SumCard label="On Order"          value={totalOnOrder.toLocaleString()} Icon={Truck} color={totalOnOrder > 0 ? 'var(--blue)' : 'var(--text-3)'} />
        <SumCard label="Low Stock"         value={lowCount} Icon={WarningCircle} color={lowCount > 0 ? 'var(--orange-shade-20)' : 'var(--text-3)'} />
        <SumCard label="Out of Stock"      value={outCount} Icon={Package} color={outCount > 0 ? 'var(--error-dark)' : 'var(--text-3)'} />
      </div>

      {/* Active POs section */}
      {pos.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius:'var(--r-xl)', overflow:'hidden', marginBottom:'var(--mar-l)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'var(--pad-m) var(--pad-l)', borderBottom:'1px solid var(--border-l)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'var(--gap-s)' }}>
              <Receipt size={15} style={{ color:'var(--navy)' }} />
              <span style={{ fontSize:'var(--text-sm)', fontWeight:700 }}>Active Sales Orders</span>
              <span style={{ fontSize:'var(--text-xs)', fontWeight:700, padding:'2px 8px', borderRadius:'var(--r-s)', background:'var(--hover)', color:'var(--text-3)' }}>{pos.length}</span>
            </div>
            <button onClick={() => navigate('/sales-orders')}
              style={{ fontSize:'var(--text-xs)', fontWeight:600, color:'var(--navy)', background:'none', cursor:'pointer', padding:0 }}>
              View all
            </button>
          </div>
          {pos.map((po, idx) => (
            <button key={idx} onClick={() => navigate(`/sales-orders/${po.id || ''}`)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'var(--gap-m)', padding: 'var(--pad-s) var(--pad-l)', background:'none', cursor:'pointer', textAlign:'left', borderBottom: idx < pos.length-1 ? '1px solid var(--border-l)' : 'none' }}>
              <div style={{ fontSize:'var(--text-2xs)', fontWeight:800, padding:'2px 6px', borderRadius:4, flexShrink:0, background: po.division==='Bolt'?'#FFF1F2':'var(--blue-soft)', color: po.division==='Bolt'?'var(--red-shade-40)':'var(--blue)' }}>
                {po.division==='Bolt'?'BOLT':'LM'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--text-sm)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{po.customer_name}</div>
              </div>
              <span style={{ fontSize:'var(--text-xs)', fontWeight:700, padding:'2px 8px', borderRadius:'var(--r-s)', background: po.status==='queued'?'var(--purple-soft)':po.status==='running'?'var(--warning-soft)':po.status==='fulfillment'?'var(--blue-soft)':po.status==='shipment'?'var(--blue-tint-80)':'var(--success-soft)', color: po.status==='queued'?'var(--purple-tint-20)':po.status==='running'?'var(--warning)':po.status==='fulfillment'?'var(--blue)':po.status==='shipment'?'var(--blue-shade-20)':'var(--success-text)', textTransform:'capitalize', flexShrink:0 }}>
                {po.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Cycle table */}
      <div style={{ background: 'var(--white)', borderRadius:'var(--r-xl)', overflow:'hidden' }}>
        
        {/* Table toolbar */}
        <div style={{ padding: 'var(--pad-m) var(--pad-l)', borderBottom:'1px solid var(--border-l)', display:'flex', gap:'var(--gap-m)', alignItems:'center', flexWrap:'wrap' }}>
          {/* Search */}
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <MagnifyingGlass size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…"
              style={{ width:'100%', paddingLeft:28, paddingRight:search?28:8, fontSize:'var(--text-xs)' }} />
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', background:'none', cursor:'pointer', color:'var(--text-3)', padding:0 }}><X size={12}/></button>}
          </div>
          {/* Filter pills */}
          <div style={{ display:'flex', gap:'var(--gap-xs)' }}>
            {[['all','All'],['active','Active'],['low','Low'],['out','Out']].map(([val,lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding:'3px 10px', borderRadius:'var(--r-s)', background:filter===val?'var(--navy)':'var(--hover)', color:filter===val?'#fff':'var(--black)', fontSize:'var(--text-xs)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                {lbl}
              </button>
            ))}
          </div>
          <span style={{ fontSize:'var(--text-xs)', color:'var(--text-3)', whiteSpace:'nowrap' }}>{filtered.length} parts</span>
        </div>

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px 72px 80px 88px 90px 48px', gap:'var(--gap-s)', padding: 'var(--pad-s) var(--pad-l)', background:'var(--navy)', position:'sticky', top:0, zIndex:10 }}>
          {['Part / SKU','Start','Added','Used','On Order','Stock','Value',''].map((h,i) => (
            <div key={i} style={{ fontSize:'var(--text-xs)', fontWeight:700, color:'rgba(255,255,255,0.6)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'var(--pad-xxl)' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 'var(--pad-xxl)', textAlign:'center', color:'var(--text-3)', fontSize:'var(--text-sm)' }}>
            {rows.length === 0 ? 'No inventory data for this warehouse.' : 'No parts match filters.'}
          </div>
        ) : filtered.map((r, idx) => {
          const isLow = r.min && r.stock > 0 && r.stock <= r.min
          const isOut = r.stock === 0
          const rowBg = isOut ? '#FFF5F5' : isLow ? 'var(--warning-soft)' : 'transparent'
          const delta = r.stock - r.startQty

          return (
            <div key={r.part.id}
              onClick={() => navigate(`/warehouse-hq/part/${r.part.id}`)}
              style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px 72px 80px 88px 90px 48px', gap:'var(--gap-s)', padding: 'var(--pad-s) var(--pad-l)', borderBottom:'1px solid var(--border-l)', background:rowBg, cursor:'pointer', transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = isOut?'var(--error-tint-80)':isLow?'var(--warning-soft)':'var(--hover)'}
              onMouseLeave={e => e.currentTarget.style.background = rowBg}
            >
              {/* Part name + SKU */}
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:'var(--text-sm)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.part.name}</div>
                {r.part.sku && <div style={{ fontSize:'var(--text-xs)', fontFamily:'var(--mono)', color:'var(--text-3)' }}>{r.part.sku}</div>}
              </div>
              {/* Start */}
              <div style={{ textAlign:'right', fontSize:'var(--text-xs)', color:'var(--text-3)' }}>{r.startQty.toLocaleString()}</div>
              {/* Added */}
              <div style={{ textAlign:'right', fontSize:'var(--text-xs)', color: r.added > 0 ? 'var(--blue)' : 'var(--text-3)', fontWeight: r.added > 0 ? 700 : 400 }}>
                {r.added > 0 ? `+${r.added.toLocaleString()}` : '—'}
              </div>
              {/* Used */}
              <div style={{ textAlign:'right', fontSize:'var(--text-xs)', color: r.used > 0 ? 'var(--purple)' : 'var(--text-3)', fontWeight: r.used > 0 ? 700 : 400 }}>
                {r.used > 0 ? r.used.toLocaleString() : '—'}
              </div>
              {/* On Order */}
              <div style={{ textAlign:'right', fontSize:'var(--text-xs)', color: r.onOrder > 0 ? 'var(--blue-shade-40)' : 'var(--text-3)', fontWeight: r.onOrder > 0 ? 700 : 400 }}>
                {r.onOrder > 0 ? r.onOrder.toLocaleString() : '—'}
              </div>
              {/* Stock + trend */}
              <div style={{ textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                <span style={{ fontSize:'var(--text-xs)', fontWeight:800, color: isOut ? 'var(--error-dark)' : isLow ? 'var(--orange-shade-20)' : 'var(--black)' }}>
                  {r.stock.toLocaleString()}
                </span>
                {delta !== 0 && (
                  <span style={{ fontSize:'var(--text-2xs)', fontWeight:700, color: delta > 0 ? 'var(--success-text)' : 'var(--error-dark)' }}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              {/* Value */}
              <div style={{ textAlign:'right', fontSize:'var(--text-xs)', color:'var(--black)', fontWeight:600 }}>
                {r.value > 0 ? `$${r.value.toLocaleString('en-US',{maximumFractionDigits:0})}` : '—'}
              </div>
              {/* Status chip */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end' }}>
                <StockChip stock={r.stock} min={r.min} />
              </div>
            </div>
          )
        })}

        {/* Totals footer */}
        {filtered.length > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px 72px 80px 88px 90px 48px', gap:'var(--gap-s)', padding: 'var(--pad-m) var(--pad-l)', background:'var(--navy)', borderTop:'2px solid var(--border-l)' }}>
            <div style={{ fontSize:'var(--text-xs)', fontWeight:800, color:'#fff' }}>Period Totals</div>
            <div style={{ textAlign:'right', fontSize:'var(--text-xs)', color:'rgba(255,255,255,0.5)' }}>—</div>
            <div style={{ textAlign:'right', fontSize:'var(--text-xs)', fontWeight:800, color:'var(--blue-tint-60)' }}>
              {filtered.reduce((s,r)=>s+r.added,0) > 0 ? `+${filtered.reduce((s,r)=>s+r.added,0).toLocaleString()}` : '—'}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--text-xs)', fontWeight:800, color:'var(--purple-tint-40)' }}>
              {filtered.reduce((s,r)=>s+r.used,0) > 0 ? filtered.reduce((s,r)=>s+r.used,0).toLocaleString() : '—'}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--text-xs)', fontWeight:800, color:'var(--blue-tint-40)' }}>
              {filtered.reduce((s,r)=>s+r.onOrder,0) > 0 ? filtered.reduce((s,r)=>s+r.onOrder,0).toLocaleString() : '—'}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--text-xs)', fontWeight:800, color:'#fff' }}>
              {filtered.reduce((s,r)=>s+r.stock,0).toLocaleString()}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--text-xs)', fontWeight:800, color:'var(--success-tint-40)' }}>
              ${filtered.reduce((s,r)=>s+r.value,0).toLocaleString('en-US',{maximumFractionDigits:0})}
            </div>
            <div />
          </div>
        )}
      </div>
    </div>
  )
}

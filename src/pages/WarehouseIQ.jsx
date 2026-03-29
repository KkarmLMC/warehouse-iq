import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowsClockwise, Lock, Buildings, Package,
  TrendUp, CurrencyDollar, Truck, WarningCircle,
  Receipt, CaretRight, ArrowDown, ArrowUp,
  MagnifyingGlass, X, Download,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── Status chip ──────────────────────────────────────────────────────────────
function StockChip({ stock, min }) {
  if (stock === 0)            return <span style={chip('#FEF2F2','#B91C1C')}>Out</span>
  if (min && stock <= min)    return <span style={chip('#FFF7ED','#C2410C')}>Low</span>
  return                             <span style={chip('#F0FDF4','#15803D')}>OK</span>
}
function chip(bg, color) {
  return { padding:'2px 8px', borderRadius:'var(--r-full)', fontSize:'var(--fs-xs)', fontWeight:700, background:bg, color, whiteSpace:'nowrap' }
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SumCard({ label, value, sub, color = 'var(--text-1)', Icon }) {
  return (
    <div style={{ background:'var(--surface-raised)', borderRadius:'var(--r-xl)', padding:'var(--sp-4)', border:'1px solid var(--border-l)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-2)', marginBottom:'var(--sp-2)' }}>
        {Icon && <Icon size={14} style={{ color:'var(--text-3)' }} />}
        <span style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--text-2)' }}>{label}</span>
      </div>
      <div style={{ fontSize:'var(--fs-2xl)', fontWeight:800, color, lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:'var(--fs-xs)', color:'var(--text-3)', marginTop:4 }}>{sub}</div>}
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
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'var(--sp-3)', marginBottom:'var(--sp-4)', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'var(--text-2)', marginBottom:4 }}>WAREHOUSE IQ</div>
          <div style={{ fontSize:'var(--fs-2xl)', fontWeight:800, lineHeight:1.1 }}>Inventory Dashboard</div>
        </div>
        <div style={{ display:'flex', gap:'var(--sp-2)', alignItems:'center', flexWrap:'wrap' }}>
          {!isClosed && period && (
            <button onClick={handleClosePeriod} disabled={closing}
              style={{ display:'flex', alignItems:'center', gap:'var(--sp-2)', padding:'var(--sp-2) var(--sp-3)', borderRadius:'var(--r-md)', border:'1px solid var(--border-l)', background:'var(--surface-raised)', color:'var(--text-2)', fontSize:'var(--fs-xs)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              <Lock size={13} /> {closing ? 'Closing…' : `Close ${periodLabel}`}
            </button>
          )}
          <button onClick={loadPeriod}
            style={{ display:'flex', alignItems:'center', gap:'var(--sp-2)', padding:'var(--sp-2) var(--sp-3)', borderRadius:'var(--r-md)', border:'1px solid var(--border-l)', background:'var(--surface-raised)', color:'var(--text-2)', fontSize:'var(--fs-xs)', fontWeight:700, cursor:'pointer' }}>
            <ArrowsClockwise size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* Period + warehouse selector */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'var(--sp-4)', flexWrap:'wrap', gap:'var(--sp-3)' }}>
        {/* Period badge */}
        <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-2)' }}>
          <div style={{ padding:'var(--sp-2) var(--sp-4)', borderRadius:'var(--r-full)', background: isClosed ? '#F1F5F9' : 'var(--navy)', color: isClosed ? '#64748B' : '#fff', fontWeight:700, fontSize:'var(--fs-sm)' }}>
            {periodLabel}
          </div>
          {isClosed
            ? <span style={{ fontSize:'var(--fs-xs)', color:'#64748B', fontWeight:600 }}>Closed</span>
            : <span style={{ fontSize:'var(--fs-xs)', color:'#16A34A', fontWeight:600 }}>● Open</span>
          }
        </div>

        {/* Warehouse tabs */}
        <div style={{ display:'flex', gap:'var(--sp-2)', overflowX:'auto', scrollbarWidth:'none' }}>
          {warehouses.map(w => (
            <button key={w.id} onClick={() => setActiveWH(w.id)}
              style={{
                flexShrink:0, padding:'var(--sp-1) var(--sp-3)', borderRadius:'var(--r-full)',
                border:`1px solid ${activeWH === w.id ? 'var(--navy)' : 'var(--border-l)'}`,
                background: activeWH === w.id ? 'var(--navy)' : 'transparent',
                color: activeWH === w.id ? '#fff' : 'var(--text-2)',
                fontSize:'var(--fs-xs)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
              }}>
              {w.name.replace(' Warehouse','')}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'var(--sp-3)', marginBottom:'var(--sp-5)' }}>
        <SumCard label="Inventory Value"   value={`$${totalValue.toLocaleString('en-US',{maximumFractionDigits:0})}`} Icon={CurrencyDollar} color="#15803D" />
        <SumCard label="Units Added"       value={totalAdded.toLocaleString()} sub="this period" Icon={ArrowDown} color="#1D4ED8" />
        <SumCard label="Units Used"        value={totalUsed.toLocaleString()}  sub="this period" Icon={ArrowUp}   color="#7C3AED" />
        <SumCard label="On Order"          value={totalOnOrder.toLocaleString()} Icon={Truck} color={totalOnOrder > 0 ? '#1D4ED8' : 'var(--text-3)'} />
        <SumCard label="Low Stock"         value={lowCount} Icon={WarningCircle} color={lowCount > 0 ? '#C2410C' : 'var(--text-3)'} />
        <SumCard label="Out of Stock"      value={outCount} Icon={Package} color={outCount > 0 ? '#B91C1C' : 'var(--text-3)'} />
      </div>

      {/* Active POs section */}
      {pos.length > 0 && (
        <div style={{ background:'var(--surface-raised)', borderRadius:'var(--r-xl)', overflow:'hidden', border:'1px solid var(--border-l)', marginBottom:'var(--sp-4)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'var(--sp-3) var(--sp-4)', borderBottom:'1px solid var(--border-l)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'var(--sp-2)' }}>
              <Receipt size={15} style={{ color:'var(--navy)' }} />
              <span style={{ fontSize:'var(--fs-sm)', fontWeight:700 }}>Active Sales Orders</span>
              <span style={{ fontSize:'var(--fs-xs)', fontWeight:700, padding:'2px 8px', borderRadius:'var(--r-full)', background:'var(--hover)', color:'var(--text-3)' }}>{pos.length}</span>
            </div>
            <button onClick={() => navigate('/sales-orders')}
              style={{ fontSize:'var(--fs-xs)', fontWeight:600, color:'var(--navy)', background:'none', border:'none', cursor:'pointer', padding:0 }}>
              View all
            </button>
          </div>
          {pos.map((po, idx) => (
            <button key={idx} onClick={() => navigate(`/sales-orders/${po.id || ''}`)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:'var(--sp-3)', padding:'var(--sp-2) var(--sp-4)', border:'none', background:'none', cursor:'pointer', textAlign:'left', borderBottom: idx < pos.length-1 ? '1px solid var(--border-l)' : 'none' }}>
              <div style={{ fontSize:'var(--fs-2xs)', fontWeight:800, padding:'2px 6px', borderRadius:4, flexShrink:0, background: po.division==='Bolt'?'#FFF1F2':'#EFF6FF', color: po.division==='Bolt'?'#BE123C':'#1D4ED8' }}>
                {po.division==='Bolt'?'BOLT':'LM'}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{po.customer_name}</div>
              </div>
              <span style={{ fontSize:'var(--fs-xs)', fontWeight:700, padding:'2px 8px', borderRadius:'var(--r-full)', background: po.status==='queued'?'#EEF2FF':po.status==='running'?'#FEF3C7':po.status==='fulfillment'?'#EFF6FF':po.status==='shipment'?'#ECFEFF':'#F0FDF4', color: po.status==='queued'?'#6366F1':po.status==='running'?'#D97706':po.status==='fulfillment'?'#1D4ED8':po.status==='shipment'?'#0891B2':'#15803D', textTransform:'capitalize', flexShrink:0 }}>
                {po.status}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Cycle table */}
      <div style={{ background:'var(--surface-raised)', borderRadius:'var(--r-xl)', overflow:'hidden', border:'1px solid var(--border-l)' }}>
        
        {/* Table toolbar */}
        <div style={{ padding:'var(--sp-3) var(--sp-4)', borderBottom:'1px solid var(--border-l)', display:'flex', gap:'var(--sp-3)', alignItems:'center', flexWrap:'wrap' }}>
          {/* Search */}
          <div style={{ position:'relative', flex:1, minWidth:160 }}>
            <MagnifyingGlass size={13} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:'var(--text-3)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…"
              style={{ width:'100%', paddingLeft:28, paddingRight:search?28:8, fontSize:'var(--fs-xs)' }} />
            {search && <button onClick={() => setSearch('')} style={{ position:'absolute', right:6, top:'50%', transform:'translateY(-50%)', border:'none', background:'none', cursor:'pointer', color:'var(--text-3)', padding:0 }}><X size={12}/></button>}
          </div>
          {/* Filter pills */}
          <div style={{ display:'flex', gap:'var(--sp-1)' }}>
            {[['all','All'],['active','Active'],['low','Low'],['out','Out']].map(([val,lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                style={{ padding:'3px 10px', borderRadius:'var(--r-full)', border:`1px solid ${filter===val?'var(--navy)':'var(--border-l)'}`, background:filter===val?'var(--navy)':'transparent', color:filter===val?'#fff':'var(--text-2)', fontSize:'var(--fs-xs)', fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
                {lbl}
              </button>
            ))}
          </div>
          <span style={{ fontSize:'var(--fs-xs)', color:'var(--text-3)', whiteSpace:'nowrap' }}>{filtered.length} parts</span>
        </div>

        {/* Column headers */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px 72px 80px 88px 90px 48px', gap:'var(--sp-2)', padding:'var(--sp-2) var(--sp-4)', background:'var(--navy)', position:'sticky', top:0, zIndex:10 }}>
          {['Part / SKU','Start','Added','Used','On Order','Stock','Value',''].map((h,i) => (
            <div key={i} style={{ fontSize:'var(--fs-xs)', fontWeight:700, color:'rgba(255,255,255,0.6)', textAlign: i === 0 ? 'left' : 'right' }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ display:'flex', justifyContent:'center', padding:'var(--sp-10)' }}><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div style={{ padding:'var(--sp-8)', textAlign:'center', color:'var(--text-3)', fontSize:'var(--fs-sm)' }}>
            {rows.length === 0 ? 'No inventory data for this warehouse.' : 'No parts match filters.'}
          </div>
        ) : filtered.map((r, idx) => {
          const isLow = r.min && r.stock > 0 && r.stock <= r.min
          const isOut = r.stock === 0
          const rowBg = isOut ? '#FFF5F5' : isLow ? '#FFFBEB' : 'transparent'
          const delta = r.stock - r.startQty

          return (
            <div key={r.part.id}
              onClick={() => navigate(`/warehouse-hq/part/${r.part.id}`)}
              style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px 72px 80px 88px 90px 48px', gap:'var(--sp-2)', padding:'var(--sp-2) var(--sp-4)', borderBottom:'1px solid var(--border-l)', background:rowBg, cursor:'pointer', transition:'background 0.1s' }}
              onMouseEnter={e => e.currentTarget.style.background = isOut?'#FFE4E4':isLow?'#FEF3C7':'var(--hover)'}
              onMouseLeave={e => e.currentTarget.style.background = rowBg}
            >
              {/* Part name + SKU */}
              <div style={{ minWidth:0 }}>
                <div style={{ fontSize:'var(--fs-xs)', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.part.name}</div>
                {r.part.sku && <div style={{ fontSize:'var(--fs-xs)', fontFamily:'var(--mono)', color:'var(--text-3)' }}>{r.part.sku}</div>}
              </div>
              {/* Start */}
              <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', color:'var(--text-3)' }}>{r.startQty.toLocaleString()}</div>
              {/* Added */}
              <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', color: r.added > 0 ? '#1D4ED8' : 'var(--text-3)', fontWeight: r.added > 0 ? 700 : 400 }}>
                {r.added > 0 ? `+${r.added.toLocaleString()}` : '—'}
              </div>
              {/* Used */}
              <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', color: r.used > 0 ? '#7C3AED' : 'var(--text-3)', fontWeight: r.used > 0 ? 700 : 400 }}>
                {r.used > 0 ? r.used.toLocaleString() : '—'}
              </div>
              {/* On Order */}
              <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', color: r.onOrder > 0 ? '#0369A1' : 'var(--text-3)', fontWeight: r.onOrder > 0 ? 700 : 400 }}>
                {r.onOrder > 0 ? r.onOrder.toLocaleString() : '—'}
              </div>
              {/* Stock + trend */}
              <div style={{ textAlign:'right', display:'flex', alignItems:'center', justifyContent:'flex-end', gap:4 }}>
                <span style={{ fontSize:'var(--fs-xs)', fontWeight:800, color: isOut ? '#B91C1C' : isLow ? '#C2410C' : 'var(--text-1)' }}>
                  {r.stock.toLocaleString()}
                </span>
                {delta !== 0 && (
                  <span style={{ fontSize:'var(--fs-2xs)', fontWeight:700, color: delta > 0 ? '#15803D' : '#B91C1C' }}>
                    {delta > 0 ? `+${delta}` : delta}
                  </span>
                )}
              </div>
              {/* Value */}
              <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', color:'var(--text-2)', fontWeight:600 }}>
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
          <div style={{ display:'grid', gridTemplateColumns:'1fr 72px 72px 72px 80px 88px 90px 48px', gap:'var(--sp-2)', padding:'var(--sp-3) var(--sp-4)', background:'var(--navy)', borderTop:'2px solid var(--border-l)' }}>
            <div style={{ fontSize:'var(--fs-xs)', fontWeight:800, color:'#fff' }}>Period Totals</div>
            <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', color:'rgba(255,255,255,0.5)' }}>—</div>
            <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', fontWeight:800, color:'#93C5FD' }}>
              {filtered.reduce((s,r)=>s+r.added,0) > 0 ? `+${filtered.reduce((s,r)=>s+r.added,0).toLocaleString()}` : '—'}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', fontWeight:800, color:'#C4B5FD' }}>
              {filtered.reduce((s,r)=>s+r.used,0) > 0 ? filtered.reduce((s,r)=>s+r.used,0).toLocaleString() : '—'}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', fontWeight:800, color:'#7DD3FC' }}>
              {filtered.reduce((s,r)=>s+r.onOrder,0) > 0 ? filtered.reduce((s,r)=>s+r.onOrder,0).toLocaleString() : '—'}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', fontWeight:800, color:'#fff' }}>
              {filtered.reduce((s,r)=>s+r.stock,0).toLocaleString()}
            </div>
            <div style={{ textAlign:'right', fontSize:'var(--fs-xs)', fontWeight:800, color:'#6EE7B7' }}>
              ${filtered.reduce((s,r)=>s+r.value,0).toLocaleString('en-US',{maximumFractionDigits:0})}
            </div>
            <div />
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, CheckCircle, ArrowRight, Warning, ClockCountdown } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'

export default function FulfillmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order,   setOrder]   = useState(null)
  const [sheet,   setSheet]   = useState(null)
  const [lines,   setLines]   = useState([])
  const [checked, setChecked] = useState({}) // lineId → bool
  const [pushing, setPushing] = useState(false)
  const [done,    setDone]    = useState(false)
  const [flags,   setFlags]   = useState({}) // lineId → discrepancy note
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  const load = async () => {
    const [{ data: o }, { data: s }] = await Promise.all([
      db.from('sales_orders').select('*').eq('id', id).single(),
      db.from('fulfillment_sheets').select('*, fulfillment_lines(*, warehouses:warehouse_id(name), split_warehouse:split_warehouse_id(name))').eq('so_id', id).single(),
    ])
    setOrder(o)
    setSheet(s)
    const fl = s?.fulfillment_lines || []
    setLines(fl)
    // Pre-check non-shortage lines
    const init = {}
    fl.forEach(l => { if (!l.is_shortage) init[l.id] = true })
    setChecked(init)
    setLoading(false)
  }

  const toggleLine = (lineId) => {
    setChecked(p => ({ ...p, [lineId]: !p[lineId] }))
  }

  const flagLine = (e, lineId) => {
    e.stopPropagation()
    const note = window.prompt('Describe the discrepancy (e.g. "only 3 on shelf, need 5"):')
    if (note) setFlags(p => ({ ...p, [lineId]: note }))
  }

  const clearFlag = (e, lineId) => {
    e.stopPropagation()
    setFlags(p => { const n = {...p}; delete n[lineId]; return n })
  }

  // Back-ordered lines don't need to be checked — only non-BO lines block proceed
  const pullableLines = lines.filter(l => !l.is_back_ordered)
  const allChecked = pullableLines.length > 0 && pullableLines.every(l => checked[l.id])

  const pushToShipment = async () => {
    setPushing(true)
    try {
      // 1. Build deduction list
      const deductions = []
      for (const line of lines) {
        if (line.warehouse_id && line.qty_available > 0)
          deductions.push({ part_id: line.part_id, warehouse_id: line.warehouse_id, delta: -line.qty_available })
        if (line.split_warehouse_id && line.split_qty > 0)
          deductions.push({ part_id: line.part_id, warehouse_id: line.split_warehouse_id, delta: -line.split_qty })
      }

      // 2. Parallelize all inventory deductions
      await Promise.all(deductions.filter(d => d.part_id).map(async d => {
        await db.from('inventory_transactions').insert({
          part_id:          d.part_id,
          warehouse_id:     d.warehouse_id,
          transaction_type: 'fulfillment',
          quantity_delta:   d.delta,
          reason:           `Fulfillment — SO ${order?.so_number}`,
          related_job_id:   order?.project_id || null,
          performed_by:     'warehouse',
        })
        const { data: lvl } = await db.from('inventory_levels')
          .select('id, quantity_on_hand')
          .eq('part_id', d.part_id).eq('warehouse_id', d.warehouse_id).single()
        if (lvl) {
          await db.from('inventory_levels').update({
            quantity_on_hand: Math.max(0, lvl.quantity_on_hand + d.delta),
            updated_at: new Date().toISOString(),
          }).eq('id', lvl.id)
        }
      }))

      // 3. Confirm sheet + lines in parallel
      await Promise.all([
        db.from('fulfillment_sheets').update({
          confirmed_at: new Date().toISOString(),
          confirmed_by: 'fulfillment',
        }).eq('id', sheet.id),
        db.from('fulfillment_lines').update({ is_confirmed: true }).eq('sheet_id', sheet.id),
      ])

      // 4. Create shipment + update SO in parallel
      const hasBackOrders = lines.some(l => l.is_back_ordered)
      await Promise.all([
        db.from('shipments').insert({ so_id: id, sheet_id: sheet.id, status: 'pending' }),
        db.from('sales_orders').update({
          status:      hasBackOrders ? 'back_ordered' : 'shipment',
          shipment_at: new Date().toISOString(),
          ...(hasBackOrders ? { back_ordered_at: new Date().toISOString() } : {}),
        }).eq('id', id),
      ])

      logActivity(db, user?.id, 'warehouse_iq', {
        category:    'fulfillment',
        action:      'confirmed',
        label:       `Confirmed Fulfillment for ${order?.so_number || id}`,
        entity_type: 'fulfillment_sheet',
        entity_id:   sheet?.id || id,
        meta:        { so_id: id },
      })
      setDone(true)
      setTimeout(() => navigate('/warehouse-hq/fulfillment'), 1200)
    } catch (err) {
      console.error('Fulfillment push failed:', err)
      alert(`Something went wrong: ${err.message || 'Unknown error'}. Please retry.`)
      setPushing(false)
    }
  }

  const fmt = n => `$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}`

  if (loading) return (
    <div className="page-content fade-in" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  const shortageLines = lines.filter(l => l.is_shortage)

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/fulfillment')}
        style={{ display:'flex',alignItems:'center',gap:6,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back to Fulfillment
      </button>

      <div style={{ marginBottom:'var(--sp-4)' }}>
        <div style={{ fontSize:'var(--text-base)',fontWeight:800,marginBottom:4 }}>{order?.so_number}</div>
        <div style={{ fontSize:'var(--text-sm)',color:'var(--black)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {(order?.job_city || order?.customer_city) && (
          <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginTop:2 }}>
            Job: {order?.job_city||order?.customer_city}, {order?.job_state||order?.customer_state}
          </div>
        )}
      </div>

      {shortageLines.length > 0 && (
        <div style={{ background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:'var(--r-xl)',padding:'var(--sp-3) var(--sp-4)',marginBottom:'var(--sp-4)',display:'flex',alignItems:'center',gap:'var(--sp-3)' }}>
          <Warning size={16} weight="fill" style={{ color:'var(--error)',flexShrink:0 }} />
          <div style={{ fontSize:'var(--text-xs)',color:'#991B1B' }}>
            {shortageLines.length} part{shortageLines.length!==1?'s':''} had shortages — split fulfillment applied where possible. Review red items before confirming.
          </div>
        </div>
      )}

      {/* Pull list */}
      <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Package size={15} style={{ marginRight:6 }} />Pull List</span>
          <span style={{ fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.55)' }}>{lines.filter(l=>checked[l.id]).length}/{lines.length} pulled</span>
        </div>

        {/* Column headers */}
        <div style={{ display:'grid',gridTemplateColumns:'44px 1fr 60px',gap:8,padding:'var(--sp-2) var(--sp-4)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-l)' }}>
          {['','Part / Warehouse','Qty'].map(h => (
            <div key={h} style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)' }}>{h}</div>
          ))}
        </div>

        {lines.map((line, idx) => {
          const isOut = line.is_shortage
          const isBO  = line.is_back_ordered
          const isPulled = checked[line.id]
          return (
            <div key={line.id}>
            <div
              onClick={() => toggleLine(line.id)}
              style={{ display:'grid',gridTemplateColumns:'44px 1fr 60px',gap:8,alignItems:'center',
                padding:'var(--sp-4) var(--sp-4)',cursor:'pointer',minHeight:64,
                borderBottom: !flags[line.id] && idx < lines.length-1 ? '1px solid var(--border-l)' : 'none',
                background: isBO ? '#ECFEFF' : isOut ? '#FEF2F2' : isPulled ? '#F0FDF4' : 'transparent',
                opacity: isBO ? 0.7 : 1 }}>
              {/* Checkbox */}
              <div style={{ width:36,height:36,borderRadius:8,border:`2px solid ${isPulled ? 'var(--success-text)' : isOut ? 'var(--error)' : 'var(--border)'}`,flexShrink:0,
                background: isPulled ? 'var(--success-text)' : 'transparent',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                {isPulled && <CheckCircle size={14} weight="fill" color="#fff" />}
              </div>
              {/* Part info */}
              <div>
                <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                  <span style={{ fontSize:'var(--text-sm)',fontWeight:600,color: isBO ? '#0891B2' : isOut ? '#991B1B' : isPulled ? 'var(--text-3)' : 'var(--black)',
                    textDecoration: isPulled && !isBO ? 'line-through' : 'none' }}>
                    {line.description}
                  </span>
                  {isBO && <span style={{ fontSize:'var(--blackxs)',fontWeight:700,padding:'1px 4px',borderRadius:3,background:'#ECFEFF',color:'#0891B2',flexShrink:0 }}>BACK ORDER</span>}
                </div>
                {line.sku && <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
                <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginTop:1 }}>
                  {line.warehouses?.name || '—'}
                  {line.split_warehouse_id && line.split_qty > 0 && (
                    <span style={{ marginLeft:6,color:'#D97706' }}>
                      + {line.split_qty} from {line.split_warehouse?.name || 'split warehouse'}
                    </span>
                  )}
                </div>
              </div>
              {/* Qty */}
              <div>
                <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--text-md)',color: isOut ? '#DC2626' : 'var(--black)' }}>
                  {line.qty_available}
                  {line.split_qty > 0 && <span style={{ color:'#D97706',fontSize:'var(--text-xs)' }}>+{line.split_qty}</span>}
                </div>
                <button onClick={(e) => flags[line.id] ? clearFlag(e, line.id) : flagLine(e, line.id)}
                  style={{ fontSize:'var(--text-xs)',padding:'2px 6px',borderRadius:4,border:'none',cursor:'pointer',fontFamily:'var(--font)',marginTop:4,
                    background: flags[line.id] ? '#FEF2F2' : 'var(--surface-raised)',
                    color: flags[line.id] ? '#DC2626' : 'var(--text-3)' }}>
                  {flags[line.id] ? '⚑ flagged' : '⚑ flag'}
                </button>
              </div>
            </div>
            {flags[line.id] && (
              <div style={{ margin:'0 var(--sp-4) var(--sp-2)',padding:'var(--sp-2) var(--sp-3)',background:'#FEF2F2',borderRadius:6,fontSize:'var(--text-sm)',color:'#991B1B',borderLeft:'3px solid #DC2626',borderBottom: idx < lines.length-1 ? '1px solid var(--border-l)' : 'none' }}>
                <strong>Discrepancy:</strong> {flags[line.id]}
              </div>
            )}
          </div>
          )
        })}
      </div>

      {/* Inventory note */}
      <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginBottom:'var(--sp-4)',padding:'var(--sp-3)',background:'var(--surface-raised)',borderRadius:'var(--r-l)' }}>
        Inventory will be deducted from each warehouse when you push to shipment. Check off each part as you pull it from the shelves.
      </div>

      {/* Push to Shipment */}
      <button onClick={pushToShipment} disabled={!allChecked || pushing || done}
        style={{ width:'100%',padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',
          background: done ? 'var(--success-text)' : !allChecked ? 'var(--border)' : 'var(--navy)',
          color: !allChecked ? 'var(--text-3)' : '#fff',
          fontWeight:700,fontSize:'var(--text-sm)',cursor: allChecked && !pushing && !done ? 'pointer' : 'not-allowed',
          fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'var(--sp-2)' }}>
        {done ? <><CheckCircle size={16} weight="fill" /> Pushed to Shipment</>
          : pushing ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Processing…</>
          : !allChecked ? `Check off all ${lines.length - Object.values(checked).filter(Boolean).length} remaining parts first`
          : <>{pullableLines.length < lines.length ? 'Push Available Items — Back Order Rest' : 'Push to Shipment — Deduct Inventory'} <ArrowRight size={16} /></>}
      </button>
    </div>
  )
}

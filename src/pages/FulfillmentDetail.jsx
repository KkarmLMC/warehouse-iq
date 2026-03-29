import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Package, CheckCircle, ArrowRight, Warning, Buildings } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

export default function FulfillmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order,   setOrder]   = useState(null)
  const [sheet,   setSheet]   = useState(null)
  const [lines,   setLines]   = useState([])
  const [checked, setChecked] = useState({}) // lineId → bool
  const [pushing, setPushing] = useState(false)
  const [done,    setDone]    = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  const load = async () => {
    const [{ data: o }, { data: s }] = await Promise.all([
      db.from('purchase_orders').select('*').eq('id', id).single(),
      db.from('fulfillment_sheets').select('*, fulfillment_lines(*, warehouses:warehouse_id(name), split_warehouse:split_warehouse_id(name))').eq('po_id', id).single(),
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

  const allChecked = lines.length > 0 && lines.every(l => checked[l.id])

  const pushToShipment = async () => {
    setPushing(true)

    // 1. Deduct inventory — for each line, deduct qty_available from primary warehouse
    //    and split_qty from split_warehouse
    const deductions = []
    for (const line of lines) {
      if (line.warehouse_id && line.qty_available > 0) {
        deductions.push({ part_id: line.part_id, warehouse_id: line.warehouse_id, delta: -line.qty_available })
      }
      if (line.split_warehouse_id && line.split_qty > 0) {
        deductions.push({ part_id: line.part_id, warehouse_id: line.split_warehouse_id, delta: -line.split_qty })
      }
    }

    // Apply deductions via inventory_transactions + update inventory_levels
    for (const d of deductions) {
      if (!d.part_id) continue
      // Record transaction
      await db.from('inventory_transactions').insert({
        part_id:          d.part_id,
        warehouse_id:     d.warehouse_id,
        transaction_type: 'fulfillment',
        quantity_delta:   d.delta,
        reason:           `Fulfillment — SO ${order?.po_number}`,
        related_job_id:   order?.project_id || null,
        performed_by:     'warehouse',
      })
      // Update level
      const { data: lvl } = await db.from('inventory_levels')
        .select('id, quantity_on_hand')
        .eq('part_id', d.part_id)
        .eq('warehouse_id', d.warehouse_id)
        .single()
      if (lvl) {
        await db.from('inventory_levels').update({
          quantity_on_hand: Math.max(0, lvl.quantity_on_hand + d.delta),
          updated_at: new Date().toISOString(),
        }).eq('id', lvl.id)
      }
    }

    // 2. Mark fulfillment sheet confirmed
    await db.from('fulfillment_sheets').update({
      confirmed_at: new Date().toISOString(),
      confirmed_by: 'fulfillment',
    }).eq('id', sheet.id)

    // Mark all lines confirmed
    await db.from('fulfillment_lines').update({ is_confirmed: true }).eq('sheet_id', sheet.id)

    // 3. Create shipment record + update SO status
    await db.from('shipments').insert({
      po_id:    id,
      sheet_id: sheet.id,
      status:   'pending',
    })

    await db.from('purchase_orders').update({
      status:     'shipment',
      shipment_at: new Date().toISOString(),
    }).eq('id', id)

    setDone(true)
    setTimeout(() => navigate('/warehouse-hq/fulfillment'), 1400)
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
        style={{ display:'flex',alignItems:'center',gap:6,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--fs-xs)',cursor:'pointer',padding:0,marginBottom:'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back to Fulfillment
      </button>

      <div style={{ marginBottom:'var(--sp-4)' }}>
        <div style={{ fontSize:'var(--fs-2xl)',fontWeight:800,marginBottom:4 }}>{order?.po_number}</div>
        <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-2)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {(order?.job_city || order?.customer_city) && (
          <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>
            Job: {order?.job_city||order?.customer_city}, {order?.job_state||order?.customer_state}
          </div>
        )}
      </div>

      {shortageLines.length > 0 && (
        <div style={{ background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:'var(--r-xl)',padding:'var(--sp-3) var(--sp-4)',marginBottom:'var(--sp-4)',display:'flex',alignItems:'center',gap:'var(--sp-3)' }}>
          <Warning size={16} weight="fill" style={{ color:'var(--error)',flexShrink:0 }} />
          <div style={{ fontSize:'var(--fs-xs)',color:'#991B1B' }}>
            {shortageLines.length} part{shortageLines.length!==1?'s':''} had shortages — split fulfillment applied where possible. Review red items before confirming.
          </div>
        </div>
      )}

      {/* Pull list */}
      <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Package size={15} style={{ marginRight:6 }} />Pull List</span>
          <span style={{ fontSize:11,color:'rgba(255,255,255,0.55)' }}>{lines.filter(l=>checked[l.id]).length}/{lines.length} pulled</span>
        </div>

        {/* Column headers */}
        <div style={{ display:'grid',gridTemplateColumns:'32px 1fr 50px',gap:8,padding:'var(--sp-2) var(--sp-4)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-l)' }}>
          {['','Part / Warehouse','Qty'].map(h => (
            <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase' }}>{h}</div>
          ))}
        </div>

        {lines.map((line, idx) => {
          const isOut = line.is_shortage
          const isPulled = checked[line.id]
          return (
            <div key={line.id}
              onClick={() => toggleLine(line.id)}
              style={{ display:'grid',gridTemplateColumns:'32px 1fr 50px',gap:8,alignItems:'center',
                padding:'var(--sp-3) var(--sp-4)',cursor:'pointer',
                borderBottom: idx < lines.length-1 ? '1px solid var(--border-l)' : 'none',
                background: isOut ? '#FEF2F2' : isPulled ? '#F0FDF4' : 'transparent' }}>
              {/* Checkbox */}
              <div style={{ width:22,height:22,borderRadius:6,border:`2px solid ${isPulled ? 'var(--success-text)' : isOut ? 'var(--error)' : 'var(--border)'}`,
                background: isPulled ? 'var(--success-text)' : 'transparent',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                {isPulled && <CheckCircle size={14} weight="fill" color="#fff" />}
              </div>
              {/* Part info */}
              <div>
                <div style={{ fontSize:'var(--fs-xs)',fontWeight:600,color: isOut ? '#991B1B' : isPulled ? 'var(--text-3)' : 'var(--text-1)',
                  textDecoration: isPulled ? 'line-through' : 'none' }}>
                  {line.description}
                </div>
                {line.sku && <div style={{ fontSize:10,color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
                <div style={{ fontSize:10,color:'var(--text-3)',marginTop:1 }}>
                  {line.warehouses?.name || '—'}
                  {line.split_warehouse_id && line.split_qty > 0 && (
                    <span style={{ marginLeft:6,color:'#D97706' }}>
                      + {line.split_qty} from {line.split_warehouse?.name || 'split warehouse'}
                    </span>
                  )}
                </div>
              </div>
              {/* Qty */}
              <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--fs-sm)',color: isOut ? '#DC2626' : 'var(--text-1)' }}>
                {line.qty_available}
                {line.split_qty > 0 && <span style={{ color:'#D97706',fontSize:10 }}>+{line.split_qty}</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Inventory note */}
      <div style={{ fontSize:11,color:'var(--text-3)',marginBottom:'var(--sp-4)',padding:'var(--sp-3)',background:'var(--surface-raised)',borderRadius:'var(--r-lg)' }}>
        Inventory will be deducted from each warehouse when you push to shipment. Check off each part as you pull it from the shelves.
      </div>

      {/* Push to Shipment */}
      <button onClick={pushToShipment} disabled={!allChecked || pushing || done}
        style={{ width:'100%',padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',
          background: done ? 'var(--success-text)' : !allChecked ? 'var(--border)' : 'var(--navy)',
          color: !allChecked ? 'var(--text-3)' : '#fff',
          fontWeight:700,fontSize:'var(--fs-sm)',cursor: allChecked && !pushing && !done ? 'pointer' : 'not-allowed',
          fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'var(--sp-2)' }}>
        {done ? <><CheckCircle size={16} weight="fill" /> Pushed to Shipment</>
          : pushing ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Processing…</>
          : !allChecked ? `Check off all ${lines.length - Object.values(checked).filter(Boolean).length} remaining parts first`
          : <>Push to Shipment — Deduct Inventory <ArrowRight size={16} /></>}
      </button>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Truck, CheckCircle, Package, MapPin } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

export default function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order,    setOrder]    = useState(null)
  const [shipment, setShipment] = useState(null)
  const [lines,    setLines]    = useState([])
  const [carrier,  setCarrier]  = useState('')
  const [tracking, setTracking] = useState('')
  const [notes,    setNotes]    = useState('')
  const [shipping, setShipping] = useState(false)
  const [done,     setDone]     = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { load() }, [id])

  const load = async () => {
    const [{ data: o }, { data: sh }] = await Promise.all([
      db.from('purchase_orders').select('*').eq('id', id).single(),
      db.from('shipments').select('*').eq('po_id', id).order('created_at',{ascending:false}).limit(1).single(),
    ])
    setOrder(o)
    setShipment(sh)

    // Load fulfillment lines for the packing list
    if (sh?.sheet_id) {
      const { data: fl } = await db.from('fulfillment_lines')
        .select('*, warehouses:warehouse_id(name), split_warehouse:split_warehouse_id(name)')
        .eq('sheet_id', sh.sheet_id)
        .order('sort_order')
      setLines(fl || [])
    }
    setLoading(false)
  }

  const processShipment = async () => {
    if (!carrier.trim()) return
    setShipping(true)

    await db.from('shipments').update({
      carrier:         carrier.trim(),
      tracking_number: tracking.trim(),
      notes:           notes.trim(),
      shipped_by:      'shipping',
      shipped_at:      new Date().toISOString(),
      status:          'shipped',
      updated_at:      new Date().toISOString(),
    }).eq('id', shipment.id)

    await db.from('purchase_orders').update({
      status:      'complete',
      completed_at: new Date().toISOString(),
      fulfilled_at: new Date().toISOString(),
    }).eq('id', id)

    setDone(true)
    setTimeout(() => navigate('/warehouse-hq/shipment'), 1400)
  }

  if (loading) return (
    <div className="page-content fade-in" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  const shipTo = [order?.job_city||order?.customer_city, order?.job_state||order?.customer_state, order?.customer_zip].filter(Boolean).join(', ')

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/shipment')}
        style={{ display:'flex',alignItems:'center',gap:6,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--fs-xs)',cursor:'pointer',padding:0,marginBottom:'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back to Shipment Queue
      </button>

      <div style={{ marginBottom:'var(--sp-5)' }}>
        <div style={{ fontSize:'var(--fs-2xl)',fontWeight:800,marginBottom:4 }}>{order?.po_number}</div>
        <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-2)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {shipTo && (
          <div style={{ marginTop:8,padding:'var(--sp-2) var(--sp-3)',background:'var(--surface-raised)',borderRadius:'var(--r-lg)',display:'inline-flex',alignItems:'center',gap:6 }}>
            <MapPin size={14} style={{ color:'var(--navy)',flexShrink:0 }} />
            <div>
              <div style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.05em' }}>SHIP TO</div>
              <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,color:'var(--navy)' }}>
                {order?.customer_name}
              </div>
              <div style={{ fontSize:'var(--fs-xs)',color:'var(--text-2)' }}>
                {[order?.customer_address, shipTo].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Packing list */}
      <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Package size={15} style={{ marginRight:6 }} />Packing List</span>
          <span style={{ fontSize:11,color:'rgba(255,255,255,0.55)' }}>{lines.length} items</span>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 50px 50px',gap:8,padding:'var(--sp-2) var(--sp-4)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-l)' }}>
          {['Part','Qty','Source'].map(h => (
            <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase' }}>{h}</div>
          ))}
        </div>
        {lines.map((line, idx) => (
          <div key={line.id} style={{ display:'grid',gridTemplateColumns:'1fr 50px 50px',gap:8,alignItems:'start',
            padding:'var(--sp-3) var(--sp-4)',borderBottom: idx < lines.length-1 ? '1px solid var(--border-l)' : 'none' }}>
            <div>
              <div style={{ fontSize:'var(--fs-xs)',fontWeight:600 }}>{line.description}</div>
              {line.sku && <div style={{ fontSize:10,color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
              <div style={{ fontSize:10,color:'var(--text-3)',marginTop:1 }}>
                {line.warehouses?.name || '—'}
                {line.split_warehouse_id && line.split_qty > 0 && (
                  <span style={{ marginLeft:6,color:'#D97706' }}>+ {line.split_qty} {line.split_warehouse?.name}</span>
                )}
              </div>
            </div>
            <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--fs-sm)',color:'var(--text-1)' }}>
              {Number(line.qty_available) + Number(line.split_qty||0)}
            </div>
            <div>
              {line.is_shortage
                ? <span style={{ fontSize:10,fontWeight:700,color:'#D97706',background:'#FFF7ED',padding:'1px 5px',borderRadius:4 }}>Split</span>
                : <CheckCircle size={14} weight="fill" style={{ color:'var(--success-text)' }} />
              }
            </div>
          </div>
        ))}
      </div>

      {/* Shipment form */}
      <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Truck size={15} style={{ marginRight:6 }} />Process Shipment</span>
        </div>
        <div style={{ padding:'var(--sp-4)',display:'flex',flexDirection:'column',gap:'var(--sp-3)' }}>
          <div>
            <label style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--text-2)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em' }}>
              Carrier <span style={{ color:'var(--error)' }}>*</span>
            </label>
            <input value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="e.g. FedEx, UPS, USPS, LTL" />
          </div>
          <div>
            <label style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--text-2)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em' }}>
              Tracking Number
            </label>
            <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--text-2)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em' }}>
              Notes
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, partial shipment notes…"
              style={{ width:'100%',boxSizing:'border-box',resize:'vertical',minHeight:72 }} />
          </div>
        </div>
      </div>

      <button onClick={processShipment} disabled={!carrier.trim() || shipping || done}
        style={{ width:'100%',padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',
          background: done ? 'var(--success-text)' : !carrier.trim() ? 'var(--border)' : 'var(--navy)',
          color: !carrier.trim() ? 'var(--text-3)' : '#fff',
          fontWeight:700,fontSize:'var(--fs-sm)',cursor: carrier.trim() && !shipping && !done ? 'pointer' : 'not-allowed',
          fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'var(--sp-2)' }}>
        {done ? <><CheckCircle size={16} weight="fill" /> Shipment Complete</>
          : shipping ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Processing…</>
          : !carrier.trim() ? 'Enter carrier to continue'
          : <><Truck size={16} weight="fill" /> Mark as Shipped — Complete Order</>}
      </button>
    </div>
  )
}

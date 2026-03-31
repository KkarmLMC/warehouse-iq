import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Truck, CheckCircle, Package, MapPin, Warning } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')

export default function ShipmentDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

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
      db.from('sales_orders').select('*').eq('id', id).single(),
      db.from('shipments').select('*').eq('so_id', id).order('created_at',{ascending:false}).limit(1).single(),
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
      updated_at:      new Date().toISOString() }).eq('id', shipment.id)

    // If has_back_order, the SO returns to 'back_ordered' after this shipment
    // so warehouse can fulfil remaining items when stock arrives.
    // Otherwise the order is fully complete.
    const nextStatus = order?.has_back_order ? 'back_ordered' : 'complete'
    await db.from('sales_orders').update({
      status:       nextStatus,
      completed_at: order?.has_back_order ? null : new Date().toISOString(),
      fulfilled_at: new Date().toISOString() }).eq('id', id)

    logActivity(db, user?.id, APP_SOURCE, {
      category:    'shipment',
      action:      'shipped',
      label:       `Marked ${order?.so_number || id} Shipped — ${carrier.trim()}${order?.has_back_order ? ' (partial — back-order pending)' : ''}`,
      entity_type: 'shipment',
      entity_id:   shipment?.id || id,
      meta:        { so_id: id, carrier: carrier.trim(), tracking: tracking.trim() } })
    setDone(true)
    setTimeout(() => navigate('/warehouse-hq/shipment'), 1400)
  }

  if (loading) return (
    <div className="page-content fade-in" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  if (!order) return (
    <div className="page-content fade-in">
      <div className="empty" style={{ minHeight: '60vh' }}>
        <Warning size="2rem" style={{ color: 'var(--text-3)', marginBottom: 'var(--mar-s)' }} />
        <div className="empty-title">Order not found</div>
        <div className="empty-desc">This order may have been deleted or the link is invalid.</div>
        <button onClick={() => navigate('/warehouse-hq/shipment')}
          style={{ marginTop: 'var(--mar-l)', padding: 'var(--pad-s) var(--pad-l)', borderRadius: 'var(--r-m)', background: 'var(--navy)', color: 'var(--white)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          ← Back to Shipments
        </button>
      </div>
    </div>
  )

  const shipTo = [order?.job_city||order?.customer_city, order?.job_state||order?.customer_state, order?.customer_zip].filter(Boolean).join(', ')

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/shipment')}
        style={{ display:'flex',alignItems:'center',gap:6,background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--mar-m)' }}>
        <ArrowLeft size="0.875rem" /> Back to Shipment Queue
      </button>

      <div style={{ marginBottom: 'var(--mar-xl)' }}>
        <div style={{ fontSize:'var(--text-base)',fontWeight:800,marginBottom:4 }}>{order?.so_number}</div>
        <div style={{ fontSize:'var(--text-sm)',color:'var(--black)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {shipTo && (
          <div style={{ marginTop: 8,padding:'var(--mar-s) var(--pad-m)',background:'var(--white)',borderRadius:'var(--r-l)',display:'inline-flex',alignItems:'center',gap:6 }}>
            <MapPin size="0.875rem" style={{ color:'var(--navy)',flexShrink:0 }} />
            <div>
              <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)' }}>SHIP TO</div>
              <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--navy)' }}>
                {order?.customer_name}
              </div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--black)' }}>
                {[order?.customer_address, shipTo].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Partial shipment warning */}
      {order?.has_back_order && (
        <div style={{ background: 'var(--warning-soft)', borderRadius: 'var(--r-m)', padding: 'var(--pad-m) var(--pad-l)', marginBottom: 'var(--mar-l)', display: 'flex', gap: 'var(--gap-m)', alignItems: 'flex-start' }}>
          <Warning size="1rem" weight="fill" style={{ color: 'var(--warning)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Partial Shipment</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--black)', marginTop: 2, lineHeight: 1.5 }}>
              Some items were back-ordered and are not included in this shipment. After confirming this shipment, the SO will return to the Back-Order queue so the remaining items can be fulfilled once stock arrives.
            </div>
          </div>
        </div>
      )}

      {/* Packing list */}
      <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Package size="1rem"  />Packing List</span>
          <span className="list-card__meta">{lines.length} items</span>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 50px 50px',gap:8,padding:'var(--pad-s) var(--pad-l)',background:'var(--white)',borderBottom:'1px solid var(--border-l)' }}>
          {['Part','Qty','Source'].map(h => (
            <div key={h} style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--black)' }}>{h}</div>
          ))}
        </div>
        {lines.map((line, idx) => (
          <div key={line.id} style={{ display:'grid',gridTemplateColumns:'1fr 50px 50px',gap:8,alignItems:'start',
            padding: 'var(--pad-m) var(--pad-l)',borderBottom: idx < lines.length-1 ? '1px solid var(--border-l)' : 'none' }}>
            <div>
              <div style={{ fontSize:'var(--text-sm)',fontWeight:600 }}>{line.description}</div>
              {line.sku && <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
              <div style={{ fontSize:'var(--text-sm)',color:'var(--text-3)',marginTop:1 }}>
                {line.warehouses?.name || '—'}
                {line.split_warehouse_id && line.split_qty > 0 && (
                  <span style={{ marginLeft:6,color:'var(--warning)' }}>+ {line.split_qty} {line.split_warehouse?.name}</span>
                )}
              </div>
            </div>
            <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--black)' }}>
              {Number(line.qty_available) + Number(line.split_qty||0)}
            </div>
            <div>
              {line.is_shortage
                ? <span style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--warning)',background:'var(--orange-soft)',padding:'1px 5px',borderRadius:4 }}>Split</span>
                : <CheckCircle size="0.875rem" weight="fill" style={{ color:'var(--success-text)' }} />
              }
            </div>
          </div>
        ))}
      </div>

      {/* Shipment form */}
      <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Truck size="1rem"  />Process Shipment</span>
        </div>
        <div style={{ padding: 'var(--pad-l)',display:'flex',flexDirection:'column',gap:'var(--gap-m)' }}>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>
              Carrier <span style={{ color:'var(--error)' }}>*</span>
            </label>
            <input value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="e.g. FedEx, UPS, USPS, LTL" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>
              Tracking Number
            </label>
            <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',display:'block',marginBottom:6 }}>
              Notes
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, partial shipment notes…"
              style={{ width:'100%',boxSizing:'border-box',resize:'vertical',minHeight:72 }} />
          </div>
        </div>
      </div>

      <button onClick={processShipment} disabled={!carrier.trim() || shipping || done}
        style={{ width:'100%',padding:'var(--pad-m)',borderRadius:'var(--r-xl)',
          background: done ? 'var(--success-text)' : !carrier.trim() ? 'var(--border)' : 'var(--navy)',
          color: !carrier.trim() ? 'var(--text-3)' : '#fff',
          fontWeight:700,fontSize:'var(--text-sm)',cursor: carrier.trim() && !shipping && !done ? 'pointer' : 'not-allowed',
          fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem' }}>
        {done ? <><CheckCircle size="1rem" weight="fill" /> {order?.has_back_order ? 'Partial Shipment Confirmed' : 'Shipment Complete'}</>
          : shipping ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Processing…</>
          : !carrier.trim() ? 'Enter carrier to continue'
          : <><Truck size="1rem" weight="fill" /> {order?.has_back_order ? 'Ship Available Items — Back-Order Pending' : 'Mark as Shipped — Complete Order'}</>}
      </button>
    </div>
  )
}

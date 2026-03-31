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
      shipment_type:   'warehouse',
      updated_at:      new Date().toISOString() }).eq('id', shipment.id)

    // Determine next status based on parallel tracks
    const hasBackOrder       = order?.has_back_order && !order?.back_order_resolved_at
    const hasDropShipPending = order?.has_drop_ship  && !order?.drop_ship_resolved_at

    let nextStatus = 'complete'
    if (hasBackOrder && hasDropShipPending) {
      nextStatus = 'partial_shipment' // warehouse shipped, back order + drop ship still pending
    } else if (hasBackOrder) {
      nextStatus = 'back_ordered'     // warehouse shipped, back order still pending
    } else if (hasDropShipPending) {
      nextStatus = 'partial_shipment' // warehouse shipped, drop ship still pending
    }

    const isComplete = nextStatus === 'complete'
    await db.from('sales_orders').update({
      status:       nextStatus,
      shipment_at:  new Date().toISOString(),
      completed_at: isComplete ? new Date().toISOString() : null,
    }).eq('id', id)

    const pendingTracks = []
    if (hasBackOrder) pendingTracks.push('back-order')
    if (hasDropShipPending) pendingTracks.push('drop ship')
    const partialNote = pendingTracks.length > 0 ? ` (partial — ${pendingTracks.join(' + ')} pending)` : ''

    logActivity(db, user?.id, APP_SOURCE, {
      category:    'shipment',
      action:      'shipped',
      label:       `Marked ${order?.so_number || id} Shipped — ${carrier.trim()}${partialNote}`,
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
        <Warning size="2rem" style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-s)' }} />
        <div className="empty-title">Order not found</div>
        <div className="empty-desc">This order may have been deleted or the link is invalid.</div>
        <button onClick={() => navigate('/warehouse-hq/shipment')}
          style={{ marginTop: 'var(--space-l)', padding: 'var(--space-s) var(--space-l)', borderRadius: 'var(--radius-m)', background: 'var(--brand-primary)', color: 'var(--surface-base)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          ← Back to Shipments
        </button>
      </div>
    </div>
  )

  const shipTo = [order?.job_city||order?.customer_city, order?.job_state||order?.customer_state, order?.customer_zip].filter(Boolean).join(', ')

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/shipment')}
        style={{ display:'flex',alignItems:'center',gap:6,background:'none',color:'var(--text-muted)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--space-m)' }}>
        <ArrowLeft size="0.875rem" /> Back to Shipment Queue
      </button>

      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ fontSize:'var(--text-md)',fontWeight:800,marginBottom:4 }}>{order?.so_number}</div>
        <div style={{ fontSize:'var(--text-sm)',color:'var(--text-primary)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {shipTo && (
          <div style={{ marginTop: 8,padding:'var(--space-s) var(--space-m)',background:'var(--surface-base)',borderRadius:'var(--radius-l)',display:'inline-flex',alignItems:'center',gap:6 }}>
            <MapPin size="0.875rem" style={{ color:'var(--brand-primary)',flexShrink:0 }} />
            <div>
              <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)' }}>SHIP TO</div>
              <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--brand-primary)' }}>
                {order?.customer_name}
              </div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-primary)' }}>
                {[order?.customer_address, shipTo].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Partial shipment warning */}
      {(order?.has_back_order || order?.has_drop_ship) && (
        <div style={{ background: 'var(--state-warning-soft)', borderRadius: 'var(--radius-m)', padding: 'var(--space-m) var(--space-l)', marginBottom: 'var(--space-l)', display: 'flex', gap: 'var(--space-m)', alignItems: 'flex-start' }}>
          <Warning size="1rem" weight="fill" style={{ color: 'var(--state-warning)', flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Partial Shipment</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>
              {order?.has_back_order && order?.has_drop_ship
                ? 'Some items were back-ordered and others are being drop shipped from PLP. After confirming this shipment, the SO will remain open until all tracks are resolved.'
                : order?.has_back_order
                ? 'Some items were back-ordered and are not included in this shipment. After confirming, the SO will return to the Back-Order queue so remaining items can be fulfilled once stock arrives.'
                : 'Some items are being drop shipped from PLP. After confirming this warehouse shipment, the SO will remain open in the Drop Ship Queue until PLP ships.'}
            </div>
          </div>
        </div>
      )}

      {/* Packing list */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Package size="1rem"  />Packing List</span>
          <span className="list-card__meta">{lines.length} items</span>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 50px 50px',gap:8,padding:'var(--space-s) var(--space-l)',background:'var(--surface-base)',borderBottom:'1px solid var(--border-subtle)' }}>
          {['Part','Qty','Source'].map(h => (
            <div key={h} style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--text-primary)' }}>{h}</div>
          ))}
        </div>
        {lines.map((line, idx) => (
          <div key={line.id} style={{ display:'grid',gridTemplateColumns:'1fr 50px 50px',gap:8,alignItems:'start',
            padding: 'var(--space-m) var(--space-l)',borderBottom: idx < lines.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div>
              <div style={{ fontSize:'var(--text-sm)',fontWeight:600 }}>{line.description}</div>
              {line.sku && <div style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
              <div style={{ fontSize:'var(--text-sm)',color:'var(--text-muted)',marginTop:1 }}>
                {line.warehouses?.name || '—'}
                {line.split_warehouse_id && line.split_qty > 0 && (
                  <span style={{ marginLeft:6,color:'var(--state-warning)' }}>+ {line.split_qty} {line.split_warehouse?.name}</span>
                )}
              </div>
            </div>
            <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--text-primary)' }}>
              {Number(line.qty_available) + Number(line.split_qty||0)}
            </div>
            <div>
              {line.is_shortage
                ? <span style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--state-warning)',background:'var(--state-warning-soft)',padding:'1px 5px',borderRadius:4 }}>Split</span>
                : <CheckCircle size="0.875rem" weight="fill" style={{ color:'var(--state-success-text)' }} />
              }
            </div>
          </div>
        ))}
      </div>

      {/* Shipment form */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Truck size="1rem"  />Process Shipment</span>
        </div>
        <div style={{ padding: 'var(--space-l)',display:'flex',flexDirection:'column',gap:'var(--space-m)' }}>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              Carrier <span style={{ color:'var(--state-error)' }}>*</span>
            </label>
            <input value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="e.g. FedEx, UPS, USPS, LTL" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              Tracking Number
            </label>
            <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              Notes
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Special instructions, partial shipment notes…"
              style={{ width:'100%',boxSizing:'border-box',resize:'vertical',minHeight:72 }} />
          </div>
        </div>
      </div>

      <button onClick={processShipment} disabled={!carrier.trim() || shipping || done}
        style={{ width:'100%',padding:'var(--space-m)',borderRadius:'var(--radius-l)',
          background: done ? 'var(--state-success-text)' : !carrier.trim() ? 'var(--border-default)' : 'var(--brand-primary)',
          color: !carrier.trim() ? 'var(--text-muted)' : '#fff',
          fontWeight:700,fontSize:'var(--text-sm)',cursor: carrier.trim() && !shipping && !done ? 'pointer' : 'not-allowed',
          fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem' }}>
        {done ? <><CheckCircle size="1rem" weight="fill" /> {(order?.has_back_order || order?.has_drop_ship) ? 'Partial Shipment Confirmed' : 'Shipment Complete'}</>
          : shipping ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Processing…</>
          : !carrier.trim() ? 'Enter carrier to continue'
          : <><Truck size="1rem" weight="fill" /> {(order?.has_back_order || order?.has_drop_ship) ? 'Ship Available Items — Pending Tracks Remain' : 'Mark as Shipped — Complete Order'}</>}
      </button>
    </div>
  )
}

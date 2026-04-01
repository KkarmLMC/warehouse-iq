import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, AirplaneTilt, CheckCircle, Package, MapPin, Warning } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')

export default function DropShipDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [order,     setOrder]     = useState(null)
  const [lines,     setLines]     = useState([])
  const [carrier,   setCarrier]   = useState('')
  const [tracking,  setTracking]  = useState('')
  const [plpRef,    setPlpRef]    = useState('')
  const [notes,     setNotes]     = useState('')
  const [shipping,  setShipping]  = useState(false)
  const [done,      setDone]      = useState(false)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => { load() }, [id])

  const load = async () => {
    const { data: o } = await db.from('sales_orders').select('*').eq('id', id).maybeSingle()
    setOrder(o)

    if (o) {
      // Load the fulfillment sheet, then get drop ship lines
      const { data: sheets } = await db.from('fulfillment_sheets')
        .select('id')
        .eq('so_id', id)
        .order('created_at', { ascending: false })
        .limit(1)

      if (sheets?.length > 0) {
        const { data: fl } = await db.from('fulfillment_lines')
          .select('*')
          .eq('sheet_id', sheets[0].id)
          .eq('is_drop_ship', true)
          .order('sort_order')
        setLines(fl || [])
      }
    }
    setLoading(false)
  }

  const processDropShip = async () => {
    if (!carrier.trim() || !tracking.trim()) return
    setShipping(true)

    // 1. Create a dropship shipment record
    await db.from('shipments').insert({
      so_id:              id,
      carrier:            carrier.trim(),
      tracking_number:    tracking.trim(),
      supplier_reference: plpRef.trim() || null,
      notes:              notes.trim() || null,
      shipment_type:      'dropship',
      shipped_by:         user?.email || 'warehouse',
      shipped_at:         new Date().toISOString(),
      status:             'shipped',
    })

    // 2. Update all drop ship fulfillment lines to 'shipped'
    const lineIds = lines.map(l => l.id)
    if (lineIds.length > 0) {
      await db.from('fulfillment_lines')
        .update({
          drop_ship_status:    'shipped',
          drop_ship_supplier:  'PLP',
          drop_ship_reference: plpRef.trim() || null,
        })
        .in('id', lineIds)
    }

    // 3. Resolve drop ship on the SO
    await db.from('sales_orders').update({
      drop_ship_resolved_at: new Date().toISOString(),
    }).eq('id', id)

    // 4. Check if the SO is now fully complete
    //    (no pending backorder and warehouse shipment already done)
    const { data: updatedOrder } = await db.from('sales_orders')
      .select('has_back_order, back_order_resolved_at, status')
      .eq('id', id)
      .single()

    const backorderResolved = !updatedOrder?.has_back_order || updatedOrder?.back_order_resolved_at
    const warehouseDone = ['shipment', 'partial_shipment', 'complete'].includes(updatedOrder?.status)
      || updatedOrder?.status === 'partial_fulfillment'

    // If this was the last pending track, mark complete
    if (backorderResolved) {
      // Check if there's a pending warehouse shipment
      const { data: pendingShipments } = await db.from('shipments')
        .select('id')
        .eq('so_id', id)
        .eq('shipment_type', 'warehouse')
        .eq('status', 'pending')
        .limit(1)

      if (!pendingShipments?.length) {
        await db.from('sales_orders').update({
          status:       'complete',
          completed_at: new Date().toISOString(),
        }).eq('id', id)
      }
    }

    logActivity(db, user?.id, APP_SOURCE, {
      category:    'dropship',
      action:      'processed',
      label:       `Drop ship processed for ${order?.so_number || id} — ${carrier.trim()} ${tracking.trim()}`,
      entity_type: 'shipment',
      entity_id:   id,
      meta:        { so_id: id, carrier: carrier.trim(), tracking: tracking.trim(), plp_reference: plpRef.trim() },
    })

    setDone(true)
    setTimeout(() => navigate('/warehouse-hq/dropship'), 1400)
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
        <button onClick={() => navigate('/warehouse-hq/dropship')}
          style={{ marginTop: 'var(--space-l)', padding: 'var(--space-s) var(--space-l)', borderRadius: 'var(--radius-m)', background: 'var(--brand-primary)', color: 'var(--surface-base)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          ← Back to Drop Ship Queue
        </button>
      </div>
    </div>
  )

  const shipTo = [order?.job_city||order?.customer_city, order?.job_state||order?.customer_state, order?.customer_zip].filter(Boolean).join(', ')

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/dropship')}
        className="back-link">
        <ArrowLeft size="0.875rem" /> Back to Drop Ship Queue
      </button>

      {/* SO header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ fontSize:'var(--text-md)',fontWeight:800,marginBottom:4 }}>{order?.so_number}</div>
        <div style={{ fontSize:'var(--text-sm)',color:'var(--text-primary)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {shipTo && (
          <div style={{ marginTop: 8,padding:'var(--space-s) var(--space-m)',background:'var(--surface-base)',borderRadius:'var(--radius-l)',display:'inline-flex',alignItems:'center',gap:6 }}>
            <MapPin size="0.875rem" style={{ color:'var(--brand-primary)',flexShrink:0 }} />
            <div>
              <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)' }}>SHIP TO (PLP DIRECT)</div>
              <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--brand-primary)' }}>{order?.customer_name}</div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-primary)' }}>{[order?.customer_address, shipTo].filter(Boolean).join(' · ')}</div>
            </div>
          </div>
        )}
      </div>

      {/* Drop ship info banner */}
      <div style={{ background: 'var(--state-warning-soft)', borderRadius: 'var(--radius-m)', padding: 'var(--space-m) var(--space-l)', marginBottom: 'var(--space-l)', display: 'flex', gap: 'var(--space-m)', alignItems: 'flex-start' }}>
        <AirplaneTilt size="1rem" weight="fill" style={{ color: 'var(--state-warning)', flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Drop Ship from PLP</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>
            These {lines.length} item{lines.length !== 1 ? 's' : ''} will ship directly from PLP to the job site.
            Enter the tracking information provided by PLP to process this drop shipment.
          </div>
        </div>
      </div>

      {/* Drop ship line items */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Package size="1rem" />Drop Ship Items</span>
          <span className="list-card__meta">{lines.length} items</span>
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 70px',gap:8,padding:'var(--space-s) var(--space-l)',background:'var(--surface-base)',borderBottom:'1px solid var(--border-subtle)' }}>
          {['Part','Qty'].map(h => (
            <div key={h} style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--text-primary)' }}>{h}</div>
          ))}
        </div>
        {lines.length === 0 ? (
          <div style={{ padding:'var(--space-xl)',textAlign:'center',color:'var(--text-muted)',fontSize:'var(--text-sm)' }}>
            No drop ship lines found for this order.
          </div>
        ) : lines.map((line, idx) => (
          <div key={line.id} style={{ display:'grid',gridTemplateColumns:'1fr 70px',gap:8,alignItems:'start',
            padding: 'var(--space-m) var(--space-l)',borderBottom: idx < lines.length-1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <div>
              <div style={{ fontSize:'var(--text-sm)',fontWeight:600 }}>{line.description}</div>
              {line.sku && <div style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
            </div>
            <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--text-primary)' }}>
              {Number(line.drop_ship_qty || line.back_order_qty || line.qty_shortage || 0)}
            </div>
          </div>
        ))}
      </div>

      {/* PLP shipping info form */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><AirplaneTilt size="1rem" />PLP Shipping Info</span>
        </div>
        <div style={{ padding: 'var(--space-l)',display:'flex',flexDirection:'column',gap:'var(--space-m)' }}>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              Carrier <span style={{ color:'var(--state-error)' }}>*</span>
            </label>
            <input value={carrier} onChange={e=>setCarrier(e.target.value)} placeholder="e.g. FedEx, UPS, LTL Freight" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              Tracking Number <span style={{ color:'var(--state-error)' }}>*</span>
            </label>
            <input value={tracking} onChange={e=>setTracking(e.target.value)} placeholder="PLP tracking number" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              PLP PO / Reference #
            </label>
            <input value={plpRef} onChange={e=>setPlpRef(e.target.value)} placeholder="PLP purchase order or reference number" />
          </div>
          <div>
            <label style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--text-primary)',display:'block',marginBottom:6 }}>
              Notes
            </label>
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Delivery instructions, special notes…"
              style={{ width:'100%',boxSizing:'border-box',resize:'vertical',minHeight:72 }} />
          </div>
        </div>
      </div>

      {/* Process button */}
      <button onClick={processDropShip} disabled={!carrier.trim() || !tracking.trim() || shipping || done}
        style={{ width:'100%',padding:'var(--space-m)',borderRadius:'var(--radius-l)',
          background: done ? 'var(--state-success-text)' : (!carrier.trim() || !tracking.trim()) ? 'var(--border-default)' : 'var(--brand-primary)',
          color: (!carrier.trim() || !tracking.trim()) ? 'var(--text-muted)' : '#fff',
          fontWeight:700,fontSize:'var(--text-sm)',cursor: carrier.trim() && tracking.trim() && !shipping && !done ? 'pointer' : 'not-allowed',
          fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem' }}>
        {done ? <><CheckCircle size="1rem" weight="fill" /> Drop Ship Processed</>
          : shipping ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Processing…</>
          : (!carrier.trim() || !tracking.trim()) ? 'Enter carrier and tracking to continue'
          : <><AirplaneTilt size="1rem" weight="fill" /> Process Drop Ship — Mark as Shipped</>}
      </button>
    </div>
  )
}

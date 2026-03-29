import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

export default function ShipmentQueue() {
  const navigate = useNavigate()
  const [orders,  setOrders]  = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('purchase_orders')
      .select('id, po_number, customer_name, project_name, job_city, job_state, grand_total, shipment_at, status')
      .eq('status', 'shipment')
      .order('shipment_at', { ascending: true })
      .then(({ data }) => { setOrders(data || []); setLoading(false) })
  }, [])

  const visible = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (o.po_number||'').toLowerCase().includes(q) || (o.customer_name||'').toLowerCase().includes(q)
  })

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
  const fmt     = n => `$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}`

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom:'var(--sp-5)' }}>
        <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4 }}>WAREHOUSE IQ</div>
        <div style={{ fontSize:'var(--fs-2xl)',fontWeight:800 }}>Shipment Queue</div>
        <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-3)',marginTop:4 }}>Orders packed and ready to ship</div>
      </div>

      <div style={{ position:'relative',marginBottom:'var(--sp-4)' }}>
        <MagnifyingGlass size={15} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)' }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders…"
          style={{ paddingLeft:36,width:'100%',boxSizing:'border-box' }} />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding:'var(--sp-6)',textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : visible.length === 0 ? (
          <div className="empty" style={{ padding:'var(--sp-6)' }}>
            <Truck size={32} style={{ color:'var(--text-3)',marginBottom:8 }} />
            <div className="empty-title">No orders ready to ship</div>
            <div className="empty-desc">Orders confirmed by fulfillment will appear here.</div>
          </div>
        ) : visible.map((o, idx) => (
          <div key={o.id} onClick={() => navigate(`/warehouse-hq/shipment/${o.id}`)}
            style={{ display:'flex',alignItems:'center',gap:'var(--sp-3)',padding:'var(--sp-3) var(--sp-4)',
              borderBottom: idx < visible.length-1 ? '1px solid var(--border-l)' : 'none',cursor:'pointer' }}>
            <div style={{ width:36,height:36,borderRadius:'var(--r-lg)',background:'#ECFEFF',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
              <Truck size={16} style={{ color:'#0891B2' }} />
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:700,fontSize:'var(--fs-sm)',fontFamily:'var(--mono)',color:'var(--navy)' }}>{o.po_number}</div>
              <div style={{ fontSize:'var(--fs-xs)',color:'var(--text-2)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                {o.customer_name}{o.project_name ? ` — ${o.project_name}` : ''}
              </div>
              {(o.job_city||o.customer_city) && (
                <div style={{ fontSize:10,color:'var(--text-3)',marginTop:1 }}>
                  Ship to: {o.job_city||o.customer_city}, {o.job_state||o.customer_state}
                </div>
              )}
              <div style={{ fontSize:10,color:'var(--text-3)' }}>Ready {fmtDate(o.shipment_at)}</div>
            </div>
            <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--fs-sm)',color:'var(--text-2)',flexShrink:0 }}>{fmt(o.grand_total)}</div>
            <CaretRight size={14} style={{ color:'var(--text-3)',flexShrink:0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardText, CaretRight, CheckCircle, MagnifyingGlass } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

export default function FulfillmentQueue() {
  const navigate = useNavigate()
  const [orders, setOrders]   = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('sales_orders')
      .select('id, so_number, customer_name, project_name, job_city, job_state, grand_total, fulfillment_at, status')
      .eq('status', 'fulfillment')
      .order('fulfillment_at', { ascending: true })
      .then(({ data }) => { setOrders(data || []); setLoading(false) })
  }, [])

  const visible = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (o.so_number||'').toLowerCase().includes(q) || (o.customer_name||'').toLowerCase().includes(q)
  })

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
  const fmt     = n => `$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}`

  return (
    <div className="page-content fade-in">
      <div style={{ marginBottom: 'var(--mar-xl)' }}>
        <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',marginBottom:4 }}>WAREHOUSE IQ</div>
        <div style={{ fontSize:'var(--text-base)',fontWeight:800 }}>Fulfillment Queue</div>
        <div style={{ fontSize:'var(--text-sm)',color:'var(--text-3)',marginTop:4 }}>Orders ready to pick and pack</div>
      </div>

      <div style={{ position:'relative',marginBottom:'var(--mar-l)' }}>
        <MagnifyingGlass size={15} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders…"
          style={{ paddingLeft:36,width:'100%',boxSizing:'border-box' }} />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 'var(--pad-xxl)',textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : visible.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--pad-xxl)' }}>
            <ClipboardText size={32} style={{ color:'var(--text-3)',marginBottom:8 }} />
            <div className="empty-title">No orders in fulfillment</div>
            <div className="empty-desc">Orders pushed from the SO Queue will appear here.</div>
          </div>
        ) : visible.map((o, idx) => (
          <div key={o.id} onClick={() => navigate(`/warehouse-hq/fulfillment/${o.id}`)}
            style={{ display:'flex',alignItems:'center',gap:'var(--gap-m)',padding: 'var(--pad-m) var(--pad-l)',
              borderBottom: idx < visible.length-1 ? '1px solid var(--border-l)' : 'none',cursor:'pointer' }}>
            <ClipboardText size={16} style={{ color:'var(--blue)' }} />
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontWeight:700,fontSize:'var(--text-sm)',fontFamily:'var(--mono)',color:'var(--navy)' }}>{o.so_number}</div>
              <div style={{ fontSize:'var(--text-sm)',color:'var(--black)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                {o.customer_name}{o.project_name ? ` — ${o.project_name}` : ''}
              </div>
              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginTop:2 }}>Received {fmtDate(o.fulfillment_at)}</div>
            </div>
            <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--black)',flexShrink:0 }}>{fmt(o.grand_total)}</div>
            <CaretRight size={14} style={{ color:'var(--black)',flexShrink:0 }} />
          </div>
        ))}
      </div>
    </div>
  )
}

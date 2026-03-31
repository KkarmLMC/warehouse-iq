import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClockCountdown, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

export default function BackorderQueue() {
  const navigate = useNavigate()
  const [orders,  setOrders]  = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('sales_orders')
      .select('id, so_number, customer_name, project_name, job_city, job_state, grand_total, back_ordered_at, status')
      .eq('has_back_order', true)
      .is('back_order_resolved_at', null)
      .order('back_ordered_at', { ascending: true })
      .then(({ data }) => { setOrders(data || []); setLoading(false) })
  }, [])

  const visible = orders.filter(o => {
    if (!search) return true
    const q = search.toLowerCase()
    return (o.so_number||'').toLowerCase().includes(q) || (o.customer_name||'').toLowerCase().includes(q)
  })

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—'
  const fmt     = n => `$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}`

  const daysSince = d => {
    if (!d) return null
    const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
    return diff
  }

  return (
    <div className="page-content fade-in">

      <div style={{ position:'relative',marginBottom:'var(--space-l)' }}>
        <MagnifyingGlass size="0.9375rem" style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)' }} />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders…"
          style={{ paddingLeft:36,width:'100%',boxSizing:'border-box' }} />
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 'var(--space-2xl)',textAlign:'center' }}><div className="spinner" style={{ margin:'0 auto' }} /></div>
        ) : visible.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--space-2xl)' }}>
            <ClockCountdown size="2rem" style={{ color:'var(--text-muted)',marginBottom:8 }} />
            <div className="empty-title">No pending back orders</div>
            <div className="empty-desc">Orders with items waiting for restock will appear here.</div>
          </div>
        ) : visible.map((o, idx) => {
          const days = daysSince(o.back_ordered_at)
          return (
            <div key={o.id} onClick={() => navigate(`/warehouse-hq/queue/${o.id}`)}
              style={{ display:'flex',alignItems:'center',gap:'var(--space-m)',padding: 'var(--space-m) var(--space-l)',
                borderBottom: idx < visible.length-1 ? '1px solid var(--border-subtle)' : 'none',cursor:'pointer' }}>
              <ClockCountdown size="1rem" style={{ color:'var(--state-info)' }} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontWeight:700,fontSize:'var(--text-sm)',fontFamily:'var(--mono)',color:'var(--brand-primary)' }}>{o.so_number}</div>
                <div style={{ fontSize:'var(--text-sm)',color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                  {o.customer_name}{o.project_name ? ` — ${o.project_name}` : ''}
                </div>
                <div style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)' }}>Back ordered {fmtDate(o.back_ordered_at)}</div>
              </div>
              <div style={{ display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2,flexShrink:0 }}>
                <div style={{ fontWeight:700,fontFamily:'var(--mono)',fontSize:'var(--text-sm)',color:'var(--text-primary)' }}>{fmt(o.grand_total)}</div>
                <span style={{ fontSize:'var(--text-xs)',fontWeight:700,
                  color: days > 7 ? 'var(--state-error-text)' : 'var(--state-info)',
                  background: days > 7 ? 'var(--state-error-soft)' : 'var(--state-info-soft)',
                  padding:'1px 6px',borderRadius:'var(--radius-s)' }}>
                  {days != null ? (days === 0 ? 'Today' : `${days}d waiting`) : 'Pending'}
                </span>
              </div>
              <CaretRight size="0.875rem" style={{ color:'var(--text-primary)',flexShrink:0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

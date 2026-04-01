import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AirplaneTilt, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

export default function DropShipQueue() {
  const navigate = useNavigate()
  const [orders,  setOrders]  = useState([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('sales_orders')
      .select('id, so_number, customer_name, project_name, job_city, job_state, grand_total, drop_ship_at, status')
      .eq('has_drop_ship', true)
      .is('drop_ship_resolved_at', null)
      .order('drop_ship_at', { ascending: true })
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
      <div className="queue-search">
        <MagnifyingGlass size="0.9375rem" className="search-overlay-icon" />
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search orders…"
          style={{ paddingLeft: 'var(--search-input-offset)' }} />
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-pad"><div className="spinner spinner-center" /></div>
        ) : visible.length === 0 ? (
          <div className="empty">
            <AirplaneTilt size="2rem" className="empty-icon" />
            <div className="empty-title">No pending drop ships</div>
            <div className="empty-desc">Orders with items flagged for drop ship from PLP will appear here.</div>
          </div>
        ) : visible.map((o, idx) => (
          <div key={o.id} onClick={() => navigate(`/warehouse-hq/dropship/${o.id}`)}
            className="queue-row" style={{ borderBottom: idx < visible.length-1 ? 'var(--border-width-1) solid var(--border-subtle)' : 'none' }}>
            <AirplaneTilt size="1rem" style={{ color:'var(--state-warning)' }} />
            <div className="queue-row__body">
              <div className="so-number">{o.so_number}</div>
              <div className="queue-row__title">
                {o.customer_name}{o.project_name ? ` — ${o.project_name}` : ''}
              </div>
              {o.job_city && (
                <div className="queue-row__meta">Ship to: {o.job_city}, {o.job_state}</div>
              )}
              <div className="queue-row__meta">Drop ship flagged {fmtDate(o.drop_ship_at)}</div>
            </div>
            <div className="queue-row__right">
              <div className="amount-mono">{fmt(o.grand_total)}</div>
              <span className="badge drop-ship-queue-3182">Awaiting PLP</span>
            </div>
            <CaretRight size="0.875rem" className="row-item__caret" />
          </div>
        ))}
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, ClockCountdown, ArrowRight, MagnifyingGlass, CaretRight, CheckCircle, Truck } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STAGE = {
  queued:      { label: 'Queued',      color: '#6366F1', bg: '#EEF2FF' },
  running:     { label: 'Running',     color: '#D97706', bg: '#FFFBEB' },
  fulfillment: { label: 'Fulfillment', color: '#1D4ED8', bg: '#EFF6FF' },
  shipment:    { label: 'Shipment',    color: '#0891B2', bg: '#ECFEFF' },
  complete:    { label: 'Complete',    color: '#15803D', bg: '#F0FDF4' },
  // legacy
  draft:       { label: 'Draft',       color: '#64748B', bg: '#F1F5F9' },
  submitted:   { label: 'Submitted',   color: '#D97706', bg: '#FFFBEB' },
  published:   { label: 'In Progress', color: '#1D4ED8', bg: '#EFF6FF' },
  fulfilled:   { label: 'Complete',    color: '#15803D', bg: '#F0FDF4' },
}

const TABS = [
  { key: 'queued',      label: 'Queue' },
  { key: 'running',     label: 'Running' },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'shipment',    label: 'Shipment' },
  { key: 'complete',    label: 'Complete' },
]

export default function SOQueue() {
  const navigate = useNavigate()
  const [tab, setTab]       = useState('queued')
  const [orders, setOrders] = useState([])
  const [counts, setCounts] = useState({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    const { data } = await db
      .from('purchase_orders')
      .select('id, po_number, customer_name, project_name, job_city, job_state, status, grand_total, created_at, queued_at, run_at, division')
      .in('status', ['queued','running','fulfillment','shipment','complete','draft','submitted','published','fulfilled'])
      .order('created_at', { ascending: false })
    const all = data || []
    // Normalise legacy statuses for counting
    const c = {}
    TABS.forEach(t => { c[t.key] = 0 })
    all.forEach(o => {
      const s = o.status === 'fulfilled' ? 'complete'
              : o.status === 'published' ? 'fulfillment'
              : o.status === 'submitted' ? 'queued'
              : o.status === 'draft'     ? 'queued'
              : o.status
      if (c[s] !== undefined) c[s]++
    })
    setCounts(c)
    setOrders(all)
    setLoading(false)
  }

  const normaliseStatus = (s) =>
    s === 'fulfilled' ? 'complete'
    : s === 'published' ? 'fulfillment'
    : s === 'submitted' || s === 'draft' ? 'queued'
    : s

  const visible = orders.filter(o => {
    const ns = normaliseStatus(o.status)
    if (ns !== tab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (o.po_number||'').toLowerCase().includes(q)
        || (o.customer_name||'').toLowerCase().includes(q)
        || (o.project_name||'').toLowerCase().includes(q)
  })

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
  const fmt     = (n) => `$${Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>WAREHOUSE IQ</div>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Sales Order Pipeline</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--sp-4)', overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--r-xl)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-xs)', fontFamily: 'var(--font)',
              background: tab === t.key ? 'var(--navy)' : 'var(--surface-raised)',
              color: tab === t.key ? '#fff' : 'var(--text-2)' }}>
            {t.label}{counts[t.key] > 0 ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--sp-4)' }}>
        <MagnifyingGlass size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by SO number, customer, project…"
          style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} />
      </div>

      {/* Orders list */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 'var(--sp-6)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : visible.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--sp-6)' }}>
            <Receipt size={32} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
            <div className="empty-title">No orders in {TABS.find(t=>t.key===tab)?.label}</div>
            <div className="empty-desc">Orders will appear here as they move through the pipeline.</div>
          </div>
        ) : visible.map((o, idx) => {
          const stage = STAGE[o.status] || STAGE.queued
          return (
            <div key={o.id}
              onClick={() => {
                const ns = normaliseStatus(o.status)
                if (ns === 'queued' || ns === 'running') navigate(`/warehouse-hq/queue/${o.id}`)
                else if (ns === 'fulfillment') navigate(`/warehouse-hq/fulfillment/${o.id}`)
                else if (ns === 'shipment') navigate(`/warehouse-hq/shipment/${o.id}`)
                else navigate(`/warehouse-hq/queue/${o.id}`)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderBottom: idx < visible.length-1 ? '1px solid var(--border-l)' : 'none', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--fs-sm)', fontFamily: 'var(--mono)', color: 'var(--navy)' }}>{o.po_number}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: stage.bg, color: stage.color }}>{stage.label}</span>
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.customer_name}{o.project_name ? ` — ${o.project_name}` : ''}{o.job_city ? ` · ${o.job_city}, ${o.job_state}` : ''}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>Received {fmtDate(o.created_at)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 'var(--fs-sm)', color: 'var(--text-1)' }}>{fmt(o.grand_total)}</div>
              </div>
              <CaretRight size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

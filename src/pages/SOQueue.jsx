import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, ClockCountdown, ArrowRight, MagnifyingGlass, CaretRight, CheckCircle, Truck } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STAGE = {
  queued:      { label: 'Queued',      color: 'var(--purple-tint-20)', bg: 'var(--purple-soft)' },
  running:     { label: 'Running',     color: 'var(--warning)', bg: 'var(--warning-soft)' },
  fulfillment: { label: 'Fulfillment', color: 'var(--blue)', bg: 'var(--blue-soft)' },
  shipment:    { label: 'Shipment',    color: 'var(--blue-shade-20)', bg: 'var(--blue-tint-80)' },
  complete:    { label: 'Complete',    color: 'var(--success-text)', bg: 'var(--success-soft)' },
  back_ordered:{ label: 'Back Order',  color: 'var(--blue-shade-20)', bg: 'var(--blue-tint-80)' },
  // legacy
  draft:       { label: 'Draft',       color: 'var(--grey-base)', bg: 'var(--grey-tint-80)' },
  submitted:   { label: 'Submitted',   color: 'var(--warning)', bg: 'var(--warning-soft)' },
  published:   { label: 'In Progress', color: 'var(--blue)', bg: 'var(--blue-soft)' },
  fulfilled:   { label: 'Complete',    color: 'var(--success-text)', bg: 'var(--success-soft)' } }

const TABS = [
  { key: 'queued',      label: 'Queue' },
  { key: 'running',     label: 'Running' },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'shipment',    label: 'Shipment' },
  { key: 'back_ordered', label: 'Back Orders' },
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
      .from('sales_orders')
      .select('id, so_number, customer_name, project_name, job_city, job_state, status, grand_total, created_at, queued_at, run_at, division')
      .in('status', ['queued','running','fulfillment','shipment','back_ordered','complete','draft','submitted','published','fulfilled'])
      .order('created_at', { ascending: false })
    const all = data || []
    // Normalise legacy statuses for counting
    const c = {}
    TABS.forEach(t => { c[t.key] = 0 })
    c['back_ordered'] = 0
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
    : s === 'back_ordered' ? 'back_ordered'
    : s

  const visible = orders.filter(o => {
    const ns = normaliseStatus(o.status)
    if (ns !== tab) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (o.so_number||'').toLowerCase().includes(q)
        || (o.customer_name||'').toLowerCase().includes(q)
        || (o.project_name||'').toLowerCase().includes(q)
  })

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
  const fmt     = (n) => `$${Number(n||0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`

  return (
    <div className="page-content fade-in">
      {/* Header */}
      <div style={{ marginBottom: 'var(--mar-xl)' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 4 }}>WAREHOUSE IQ</div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 800 }}>Sales Order Pipeline</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 'var(--mar-l)', overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 'var(--r-m)', cursor: 'pointer', fontWeight: 700, fontSize: 'var(--text-xs)', fontFamily: 'var(--font)',
              background: tab === t.key ? 'var(--navy)' : 'var(--white)',
              color: tab === t.key ? '#fff' : 'var(--black)' }}>
            {t.label}{counts[t.key] > 0 ? ` (${counts[t.key]})` : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--mar-l)' }}>
        <MagnifyingGlass size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by SO number, customer, project…"
          style={{ paddingLeft: 36, width: '100%', boxSizing: 'border-box' }} />
      </div>

      {/* Orders list */}
      <div className="card">
        {loading ? (
          <div style={{ padding: 'var(--pad-xxl)', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : visible.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--pad-xxl)' }}>
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
                else if (ns === 'back_ordered') navigate(`/warehouse-hq/queue/${o.id}`)
                else navigate(`/warehouse-hq/queue/${o.id}`)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: idx < visible.length-1 ? '1px solid var(--border-l)' : 'none', cursor: 'pointer' }}>
              <Receipt size={16} style={{ color: 'var(--navy)' }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', fontFamily: 'var(--mono)', color: 'var(--navy)' }}>{o.so_number}</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: stage.bg, color: stage.color }}>{stage.label}</span>
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {o.customer_name}{o.project_name ? ` — ${o.project_name}` : ''}{o.job_city ? ` · ${o.job_city}, ${o.job_state}` : ''}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2 }}>Received {fmtDate(o.created_at)}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontFamily: 'var(--mono)', fontSize: 'var(--text-sm)', color: 'var(--black)' }}>{fmt(o.grand_total)}</div>
              </div>
              <CaretRight size={14} style={{ color: 'var(--black)', flexShrink: 0 }} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

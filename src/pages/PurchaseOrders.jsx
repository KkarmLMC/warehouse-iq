import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Receipt, Buildings, CalendarBlank, CaretRight,
  MagnifyingGlass, X, CheckCircle, Clock, PaperPlaneTilt,
  Package, Warning } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STATUS_META = {
  draft:        { label: 'Draft',        color: 'var(--text-secondary)', bg: 'var(--surface-light)', icon: Clock },
  queued:       { label: 'Queued',       color: 'var(--brand-light)', bg: 'var(--brand-soft)', icon: Clock },
  running:      { label: 'Running',      color: 'var(--state-warning)', bg: 'var(--state-warning-soft)', icon: PaperPlaneTilt },
  submitted:    { label: 'Submitted',    color: 'var(--state-warning)', bg: 'var(--state-warning-soft)', icon: PaperPlaneTilt },
  fulfillment:  { label: 'Fulfillment',  color: 'var(--state-info)', bg: 'var(--state-info-soft)', icon: Receipt },
  published:    { label: 'Published',    color: 'var(--state-info)', bg: 'var(--state-info-soft)', icon: Receipt },
  shipment:     { label: 'Shipment',     color: 'var(--state-info)', bg: 'var(--state-info-soft)', icon: Receipt },
  back_ordered: { label: 'Back Order',   color: 'var(--state-info)', bg: 'var(--state-info-soft)', icon: Clock },
  complete:     { label: 'Complete',     color: 'var(--state-success-text)', bg: 'var(--state-success-soft)', icon: CheckCircle },
  fulfilled:    { label: 'Fulfilled',    color: 'var(--state-success-text)', bg: 'var(--state-success-soft)', icon: CheckCircle },
  fulfilled: { label: 'Fulfilled', color: 'var(--state-success-text)', bg: 'var(--state-success-soft)', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'var(--state-error-text)', bg: 'var(--state-error-soft)', icon: X } }

const TABS = [
  { key: 'all',       label: 'All'       },
  { key: 'draft',     label: 'Drafts'    },
  { key: 'submitted', label: 'Submitted' },
  { key: 'published', label: 'Published' },
  { key: 'fulfilled', label: 'Fulfilled' },
]

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft
  const Icon = meta.icon
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2xs)',
      padding: 'var(--space-2xs) var(--space-m)', borderRadius: 'var(--radius-s)',
      fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)',
      background: meta.bg, color: meta.color }}>
      <Icon size="0.6875rem" weight="fill" />
      {meta.label}
    </span>
  )
}

function POCard({ po, totals, onPress }) {
  const matTotal = totals?.materials || 0
  const laborTotal = totals?.labor || 0
  const grandTotal = matTotal + laborTotal

  return (
    <button onClick={onPress} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: 'var(--space-l)', background: 'none',
      width: '100%', textAlign: 'left', borderBottom: '1px solid var(--border-subtle)',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      {/* Icon */}
      <div style={{
        width: '2.75rem', height: '2.75rem', borderRadius: 'var(--radius-l)',
        background: po.division === 'Bolt' ? 'var(--state-warning-soft)' : 'var(--state-info-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Receipt size="1.25rem" style={{ color: po.division === 'Bolt' ? 'var(--state-warning-text)' : 'var(--brand-primary)' }} />
      </div>

      {/* Info */}
      <div className="content-body">
        <div className="flex-gap-s">
          <span className="text-sm-bold">
            {po.so_number}
          </span>
          <StatusBadge status={po.status} />
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', padding: 'var(--space-3xs) var(--space-xs)',
            borderRadius: 'var(--radius-s)',
            background: po.division === 'Bolt' ? 'var(--state-warning-soft)' : 'var(--state-info-soft)',
            color: po.division === 'Bolt' ? 'var(--state-warning-text)' : 'var(--brand-primary)' }}>
            {po.division === 'Bolt' ? 'Bolt' : 'LM'}
          </span>
        </div>
        <div className="text-sm-truncate">
          {po.customer_name}
        </div>
        <div className="purchase-orders-aab0">
          {po.project_name && <span className="purchase-orders-5867">{po.project_name}</span>}
          {po.so_date && <span>· {new Date(po.so_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        </div>
      </div>

      {/* Total + chevron */}
      <div className="flex-gap-s shrink-0">
        {grandTotal > 0 && (
          <span className="text-sm-bold">
            ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        )}
        <CaretRight size="0.8125rem" style={{ color: 'var(--text-primary)' }} />
      </div>
    </button>
  )
}

export default function PurchaseOrders() {
  const navigate = useNavigate()
  const [pos, setPos] = useState([])
  const [totals, setTotals] = useState({}) // keyed by po id
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [divisionFilter, setDivisionFilter] = useState('all') // all | LM | Bolt

  useEffect(() => {
    Promise.all([
      db.from('sales_orders').select('*').order('created_at', { ascending: false }),
      db.from('so_line_items').select('so_id, line_type, quantity, unit_cost'),
    ]).then(([{ data: poData }, { data: lineData }]) => {
      setPos(poData || [])
      // Compute totals per SO
      const t = {}
      for (const li of lineData || []) {
        if (!t[li.so_id]) t[li.so_id] = { materials: 0, labor: 0 }
        const amt = (li.quantity || 0) * (li.unit_cost || 0)
        if (li.line_type === 'labor') t[li.so_id].labor += amt
        else t[li.so_id].materials += amt
      }
      setTotals(t)
      setLoading(false)
    })
  }, [])

  const filtered = pos.filter(po => {
    if (activeTab !== 'all' && po.status !== activeTab) return false
    if (divisionFilter !== 'all' && po.division !== divisionFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        po.so_number.toLowerCase().includes(q) ||
        (po.customer_name || '').toLowerCase().includes(q) ||
        (po.project_name || '').toLowerCase().includes(q) ||
        (po.job_reference || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  // Counts per tab
  const counts = {}
  for (const tab of TABS) {
    counts[tab.key] = tab.key === 'all' ? pos.length : pos.filter(p => p.status === tab.key).length
  }

  // Stats
  const queuedCount = pos.filter(p => ['queued','running'].includes(p.status)).length
  const totalPublishedValue = pos
    .filter(p => ['complete','fulfilled','shipment','fulfillment'].includes(p.status))
    .reduce((s, po) => {
      const t = totals[po.id]
      return s + (t ? t.materials + t.labor : 0)
    }, 0)

  return (
    <div className="page-content fade-in">

      <div className="purchase-orders-3bf5">
        <button onClick={() => navigate('/sales-orders/new')}
          className="btn btn-navy"
          className="flex-gap-s">
          <Plus size="0.9375rem" /> New Sales Order
        </button>
      </div>

      {/* Alert banner for submitted POs awaiting review */}
      {queuedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: 'var(--space-m) var(--space-l)', background: 'var(--state-warning-soft)',
          borderRadius: 'var(--radius-l)', marginBottom: '1rem', cursor: 'pointer' }} onClick={() => setActiveTab('queued')}>
          <Warning size="1.125rem" weight="fill" className="purchase-orders-e393" />
          <div className="content-body">
            <div className="text-sm-bold">
              {queuedCount} Sales Order{queuedCount !== 1 ? 's' : ''} in queue
            </div>
            <div className="purchase-orders-c677">
              Tap to review and publish
            </div>
          </div>
          <CaretRight size="0.875rem" style={{ color: 'var(--state-warning)' }} />
        </div>
      )}

      {/* Stats strip */}
      <div className="grid-3col mb-l">
        {[
          { label: 'Total Orders', value: pos.length },
          { label: 'In Queue', value: queuedCount, color: queuedCount > 0 ? 'var(--state-warning)' : undefined },
          { label: 'Published Value', value: '$' + (totalPublishedValue / 1000).toFixed(0) + 'k', color: 'var(--state-success-text)' },
        ].map(s => (
          <div key={s.label} className="purchase-orders-080f">
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', color: s.color || 'var(--text-primary)' }}>{s.value}</div>
            <div className="meta-text">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="purchase-orders-baa5">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0, padding: '0.5rem 0.75rem',
              background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--brand-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--brand-primary)' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap' }}>
            {tab.label}
            {counts[tab.key] > 0 && (
              <span style={{ marginLeft: 'var(--space-xs)', fontSize: 'var(--text-xs)', background: activeTab === tab.key ? 'var(--brand-primary)' : 'var(--surface-hover)', color: activeTab === tab.key ? '#fff' : 'var(--text-muted)', borderRadius: 'var(--radius-l)', padding: 'var(--space-3xs) var(--space-xs)', fontWeight: 'var(--fw-bold)' }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + division filter */}
      <div className="purchase-orders-293c">
        <div className="purchase-orders-f661">
          <MagnifyingGlass size="0.9375rem" className="search-overlay-icon" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search SO#, customer, project…"
            style={{ width: '100%', paddingLeft: 'var(--search-input-offset)', paddingRight: search ? 34 : 12 }} />
          {search && <button onClick={() => setSearch('')} className="search-overlay-clear"><X size="0.8125rem" /></button>}
        </div>
        {['all', 'LM', 'Bolt'].map(d => (
          <button key={d} onClick={() => setDivisionFilter(d)}
            style={{
              padding: 'var(--space-xs) var(--space-m)', borderRadius: 'var(--radius-l)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${divisionFilter === d ? 'var(--brand-primary)' : 'var(--border-subtle)'}`,
              background: divisionFilter === d ? 'var(--brand-primary)' : 'var(--surface-hover)',
              color: divisionFilter === d ? '#fff' : 'var(--text-primary)' }}>
            {d === 'all' ? 'All Divisions' : d === 'LM' ? 'Lightning Master' : 'Bolt Lightning'}
          </button>
        ))}
      </div>

      {/* PO list */}
      {loading ? (
        <div className="spinner-pad"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Receipt size="2.5rem" className="empty-icon" />
          <div className="empty-title">{pos.length === 0 ? 'No sales orders yet' : 'No SOs match filters'}</div>
          <div className="empty-desc">{pos.length === 0 ? 'Create your first Sales Order to get started.' : 'Try adjusting your filters.'}</div>
          {pos.length === 0 && (
            <button className="btn btn-primary mt-l" onClick={() => navigate('/sales-orders/new')}>
              Create First Sales Order
            </button>
          )}
        </div>
      ) : (
        <div className="card-section">
          {filtered.map(po => (
            <POCard key={po.id} po={po} totals={totals[po.id]} onPress={() => navigate(`/sales-orders/${po.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Receipt, Buildings, CalendarBlank, CaretRight,
  MagnifyingGlass, X, CheckCircle, Clock, PaperPlaneTilt,
  Package, Warning,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STATUS_META = {
  draft:        { label: 'Draft',        color: '#64748B', bg: '#F1F5F9', icon: Clock },
  queued:       { label: 'Queued',       color: '#6366F1', bg: '#EEF2FF', icon: Clock },
  running:      { label: 'Running',      color: '#D97706', bg: '#FEF3C7', icon: PaperPlaneTilt },
  submitted:    { label: 'Submitted',    color: '#D97706', bg: '#FEF3C7', icon: PaperPlaneTilt },
  fulfillment:  { label: 'Fulfillment',  color: '#0369A1', bg: '#EFF6FF', icon: Receipt },
  published:    { label: 'Published',    color: '#0369A1', bg: '#EFF6FF', icon: Receipt },
  shipment:     { label: 'Shipment',     color: '#0891B2', bg: '#ECFEFF', icon: Receipt },
  back_ordered: { label: 'Back Order',   color: '#0891B2', bg: '#ECFEFF', icon: Clock },
  complete:     { label: 'Complete',     color: '#15803D', bg: '#F0FDF4', icon: CheckCircle },
  fulfilled:    { label: 'Fulfilled',    color: '#15803D', bg: '#F0FDF4', icon: CheckCircle },
  fulfilled: { label: 'Fulfilled', color: '#15803D', bg: '#F0FDF4', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: '#B91C1C', bg: '#FEF2F2', icon: X },
}

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
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 'var(--r-full)',
      fontSize: 'var(--text-xs)', fontWeight: 700,
      background: meta.bg, color: meta.color,
    }}>
      <Icon size={11} weight="fill" />
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
      padding: 'var(--pad-l)', border: 'none', background: 'none',
      width: '100%', textAlign: 'left', borderBottom: '1px solid var(--border-l)',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    }}>
      {/* Icon */}
      <div style={{
        width: '2.75rem', height: '2.75rem', borderRadius: 'var(--r-l)',
        background: po.division === 'Bolt' ? '#FFF7ED' : '#EFF6FF',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Receipt size={20} style={{ color: po.division === 'Bolt' ? '#C2410C' : 'var(--navy)' }} />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>
            {po.so_number}
          </span>
          <StatusBadge status={po.status} />
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px',
            borderRadius: 'var(--r-full)',
            background: po.division === 'Bolt' ? '#FFF7ED' : '#EFF6FF',
            color: po.division === 'Bolt' ? '#C2410C' : 'var(--navy)',
          }}>
            {po.division === 'Bolt' ? 'Bolt' : 'LM'}
          </span>
        </div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {po.customer_name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2, display: 'flex', gap: 'var(--gap-s)' }}>
          {po.project_name && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{po.project_name}</span>}
          {po.so_date && <span>· {new Date(po.so_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
        </div>
      </div>

      {/* Total + chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', flexShrink: 0 }}>
        {grandTotal > 0 && (
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>
            ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
        )}
        <CaretRight size={13} style={{ color: 'var(--black)' }} />
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

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--gap-m)', marginBottom: 'var(--mar-xl)', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 4 }}>INVENTORY</div>
          <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, lineHeight: 1.1 }}>Sales Orders</div>
        </div>
        <button onClick={() => navigate('/sales-orders/new')}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-s) var(--pad-l)', borderRadius: 'var(--r-m)', border: 'none', background: 'var(--navy)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Plus size={15} /> New Sales Order
        </button>
      </div>

      {/* Alert banner for submitted POs awaiting review */}
      {queuedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: 'var(--pad-m) var(--pad-l)', background: '#FEF3C7',
          borderRadius: 'var(--r-l)', marginBottom: '1rem',
          border: '1px solid #FDE68A', cursor: 'pointer',
        }} onClick={() => setActiveTab('queued')}>
          <Warning size={18} weight="fill" style={{ color: '#D97706', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#92400E' }}>
              {queuedCount} Sales Order{queuedCount !== 1 ? 's' : ''} in queue
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: '#92400E' }}>
              Tap to review and publish
            </div>
          </div>
          <CaretRight size={14} style={{ color: '#D97706' }} />
        </div>
      )}

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-m)', marginBottom: 'var(--mar-l)' }}>
        {[
          { label: 'Total Orders', value: pos.length },
          { label: 'In Queue', value: queuedCount, color: queuedCount > 0 ? '#D97706' : undefined },
          { label: 'Published Value', value: '$' + (totalPublishedValue / 1000).toFixed(0) + 'k', color: '#15803D' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-l)', padding: 'var(--pad-m)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: s.color || 'var(--black)' }}>{s.value}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 'var(--mar-m)', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '2px solid var(--border-l)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              flexShrink: 0, padding: '0.5rem 0.75rem', border: 'none',
              background: 'none', cursor: 'pointer', fontSize: 'var(--text-sm)',
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? 'var(--navy)' : 'var(--text-3)',
              borderBottom: activeTab === tab.key ? '2px solid var(--navy)' : '2px solid transparent',
              marginBottom: -2, whiteSpace: 'nowrap',
            }}>
            {tab.label}
            {counts[tab.key] > 0 && (
              <span style={{ marginLeft: 6, fontSize: 'var(--text-xs)', background: activeTab === tab.key ? 'var(--navy)' : 'var(--hover)', color: activeTab === tab.key ? '#fff' : 'var(--text-3)', borderRadius: 'var(--r-full)', padding: '1px 6px', fontWeight: 700 }}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search + division filter */}
      <div style={{ display: 'flex', gap: 'var(--gap-s)', marginBottom: 'var(--mar-l)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <MagnifyingGlass size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search SO#, customer, project…"
            style={{ width: '100%', paddingLeft: 34, paddingRight: search ? 34 : 12 }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={13} /></button>}
        </div>
        {['all', 'LM', 'Bolt'].map(d => (
          <button key={d} onClick={() => setDivisionFilter(d)}
            style={{
              padding: 'var(--pad-xs) var(--pad-m)', borderRadius: 'var(--r-full)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              border: `1px solid ${divisionFilter === d ? 'var(--navy)' : 'var(--border-l)'}`,
              background: divisionFilter === d ? 'var(--navy)' : 'transparent',
              color: divisionFilter === d ? '#fff' : 'var(--black)',
            }}>
            {d === 'all' ? 'All Divisions' : d === 'LM' ? 'Lightning Master' : 'Bolt Lightning'}
          </button>
        ))}
      </div>

      {/* PO list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pad-xxl)' }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Receipt size={40} style={{ color: 'var(--text-3)', marginBottom: 'var(--mar-m)' }} />
          <div className="empty-title">{pos.length === 0 ? 'No sales orders yet' : 'No SOs match filters'}</div>
          <div className="empty-desc">{pos.length === 0 ? 'Create your first Sales Order to get started.' : 'Try adjusting your filters.'}</div>
          {pos.length === 0 && (
            <button className="btn btn-primary" style={{ marginTop: 'var(--mar-l)' }} onClick={() => navigate('/sales-orders/new')}>
              Create First Sales Order
            </button>
          )}
        </div>
      ) : (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden' }}>
          {filtered.map(po => (
            <POCard key={po.id} po={po} totals={totals[po.id]} onPress={() => navigate(`/sales-orders/${po.id}`)} />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Receipt, ClipboardText, Warning,
  Truck, ArrowRight, Buildings, CheckCircle,
  ArrowUp, CaretRight, Lightning, ClockCountdown } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { soStatus, stockStatusFromQty } from '../lib/statusColors.js'

// ─── Stage colors ─────────────────────────────────────────────────────────────
const STAGE_COLOR = {
  draft:        'var(--text-secondary)',
  queued:       'var(--brand-light)',
  running:      'var(--state-warning)',
  submitted:    'var(--state-warning)',
  fulfillment:  'var(--state-info)',
  published:    'var(--state-info)',
  shipment:     'var(--state-info)',
  back_ordered: 'var(--state-info)',
  fulfilled:    'var(--state-success)',
  complete:     'var(--state-success)',
  cancelled:    'var(--text-muted)' }

// ─── Warehouse health badge ───────────────────────────────────────────────────
function HealthBadge({ out, low }) {
  if (out > 0) return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--state-error-soft)', color: 'var(--state-error)' }}>
      {out} Out
    </span>
  )
  if (low > 0) return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--state-warning-soft)', color: 'var(--state-warning)' }}>
      {low} Low
    </span>
  )
  return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--state-success-soft)', color: 'var(--state-success-text)' }}>
      OK
    </span>
  )
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function Inventory() {
  const navigate = useNavigate()

  const [warehouses,  setWarehouses]  = useState([])
  const [stats,       setStats]       = useState(null)
  const [recentSOs,   setRecentSOs]   = useState([])
  const [pendingCOs,  setPendingCOs]  = useState([])
  const [lowStock,    setLowStock]    = useState([])
  const [recentShips, setRecentShips] = useState([])
  const [warehouseHealth, setWarehouseHealth] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [backOrders,  setBackOrders]  = useState([])

  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    // All queries in parallel
    const [
      { data: whs },
      { data: levels },
      { data: sos },
      { data: cos },
      { data: transfers },
      { data: bos },
    ] = await Promise.all([
      db.from('warehouses').select('*').eq('is_active', true).order('sort_order'),
      db.from('inventory_levels').select('*, parts(name, sku, unit_cost), warehouses(name)'),
      db.from('sales_orders').select('id, so_number, customer_name, project_name, status, grand_total, created_at, division')
        .in('status', ['draft', 'queued', 'running', 'submitted', 'published', 'fulfillment', 'shipment', 'back_ordered'])
        .order('created_at', { ascending: false }).limit(6),
      db.from('change_orders').select('id, co_number, submitted_by, justification, status, created_at, warehouses(name)')
        .eq('status', 'pending').order('created_at', { ascending: false }).limit(5),
      db.from('inventory_transfers').select('*, from_warehouse:warehouses!from_warehouse_id(name), to_warehouse:warehouses!to_warehouse_id(name)')
        .order('created_at', { ascending: false }).limit(5),
      db.from('sales_orders').select('id, so_number, customer_name, project_name, job_city, job_state, back_ordered_at')
        .eq('status', 'back_ordered')
        .order('back_ordered_at', { ascending: true }),
    ])

    setWarehouses(whs || [])
    setRecentSOs(sos || [])
    setPendingCOs(cos || [])
    setRecentShips(transfers || [])
    setBackOrders(bos || [])

    // Calculate stats from levels
    const allLevels = levels || []
    const totalValue = allLevels.reduce((s, l) => s + ((l.quantity_on_hand || 0) * (l.parts?.unit_cost || 0)), 0)
    const outItems   = allLevels.filter(l => l.quantity_on_hand === 0)
    const lowItems   = allLevels.filter(l => l.quantity_on_hand > 0 && l.min_level && l.quantity_on_hand <= l.min_level)

    setStats({
      totalValue,
      openSOs:    sos?.filter(s => !['fulfilled','complete','cancelled'].includes(s.status)).length || 0,
      pendingCOs: cos?.length || 0,
      lowStock:   lowItems.length,
      outStock:   outItems.length,
      shipments:    transfers?.length || 0,
      backOrders:   bos?.length || 0 })

    // Low stock list (top 8 most urgent)
    const urgent = [
      ...outItems.map(l => ({ ...l, urgency: 0 })),
      ...lowItems.map(l => ({ ...l, urgency: 1 })),
    ].slice(0, 8)
    setLowStock(urgent)

    // Per-warehouse health
    const health = {}
    for (const wh of whs || []) {
      const whLevels = allLevels.filter(l => l.warehouse_id === wh.id)
      health[wh.id] = {
        out:   whLevels.filter(l => l.quantity_on_hand === 0).length,
        low:   whLevels.filter(l => l.quantity_on_hand > 0 && l.min_level && l.quantity_on_hand <= l.min_level).length,
        total: whLevels.reduce((s, l) => s + ((l.quantity_on_hand || 0) * (l.parts?.unit_cost || 0)), 0),
        parts: whLevels.length }
    }
    setWarehouseHealth(health)
    setLoading(false)
  }

  const master = warehouses.find(w => w.is_master)
  const subs   = warehouses.filter(w => !w.is_master)

  const fmt = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

  if (loading) return (
    <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 'var(--space-m)' }}>
      <div className="spinner" />
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Loading Warehouse IQ…</span>
    </div>
  )

  return (
    <div className="page-content fade-in">


      {/* ── Pending CO alert ── */}
      {stats?.pendingCOs > 0 && (
        <div onClick={() => navigate('/warehouse-hq/change-orders')}
          style={{ background: 'var(--state-warning-soft)', borderRadius: 'var(--radius-m)', padding: 'var(--space-m) var(--space-l)', marginBottom: 'var(--space-l)', display: 'flex', alignItems: 'center', gap: 'var(--space-m)', cursor: 'pointer' }}>
          <Warning size="1.125rem" weight="fill" style={{ color: 'var(--state-warning)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--state-warning-text)' }}>
              {stats.pendingCOs} Change Order{stats.pendingCOs !== 1 ? 's' : ''} Pending Review
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--state-warning-text)' }}>Field crew part requests waiting for approval</div>
          </div>
          <CaretRight size="0.875rem" style={{ color: 'var(--state-warning-text)', flexShrink: 0 }} />
        </div>
      )}

      {/* ── Back order alert ── */}
      {backOrders.length > 0 && (
        <div onClick={() => navigate('/warehouse-hq/queue')}
          style={{ background: 'var(--state-info-soft)', borderRadius: 'var(--radius-m)', padding: 'var(--space-m) var(--space-l)', marginBottom: 'var(--space-l)', display: 'flex', alignItems: 'center', gap: 'var(--space-m)', cursor: 'pointer' }}>
          <ClockCountdown size="1.125rem" weight="fill" style={{ color: 'var(--state-info)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--state-info)' }}>
              {backOrders.length} Back Order{backOrders.length !== 1 ? 's' : ''} Awaiting Stock
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--state-info)' }}>
              {backOrders.slice(0, 2).map(o => o.so_number).join(', ')}
              {backOrders.length > 2 ? ` + ${backOrders.length - 2} more` : ''} — tap to view queue
            </div>
          </div>
          <CaretRight size="0.875rem" style={{ color: 'var(--state-info)', flexShrink: 0 }} />
        </div>
      )}

      {/* ── 5 Stat cards ── */}
      <div className="wiq-stat-grid mb-xl">
        {[
          { label: 'Total Inventory Value', value: fmt(stats?.totalValue), color: 'var(--brand-primary)', onClick: () => navigate('/warehouse-hq/inventory') },
          { label: 'Open Sales Orders',     value: stats?.openSOs ?? '—',  color: 'var(--state-info)', onClick: () => navigate('/sales-orders') },
          { label: 'Pending Change Orders', value: stats?.pendingCOs ?? '—', color: stats?.pendingCOs > 0 ? 'var(--state-warning)' : 'var(--text-primary)', onClick: () => navigate('/warehouse-hq/change-orders') },
          { label: 'Low / Out of Stock',    value: `${stats?.outStock ?? 0} / ${stats?.lowStock ?? 0}`, color: (stats?.outStock > 0 || stats?.lowStock > 0) ? 'var(--state-error)' : 'var(--state-success-text)', onClick: () => navigate('/warehouse-hq/inventory') },
          { label: 'Recent Shipments',      value: stats?.shipments ?? '—', color: 'var(--text-primary)', onClick: () => navigate('/warehouse-hq/transfer') },
        ].map(s => (
          <div key={s.label} className="stat-card" onClick={s.onClick}
            style={{ cursor: 'pointer' }}>
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__value" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Master Warehouse ── */}
      {master && (
        <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
          <div className="list-card__header" style={{ cursor: 'pointer' }} onClick={() => navigate(`/warehouse-hq/warehouse/${master.id}`)}>
            <span className="list-card__title">
              <Lightning size="1rem" />
              {master.name}
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px', marginLeft: 8 }}>MASTER</span>
            </span>
            <span className="list-card__meta">{master.city}, {master.state}</span>
          </div>
          <div style={{ padding: 'var(--space-l)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-m)' }}>
            {[
              { label: 'Inventory Value', value: fmt(warehouseHealth[master.id]?.total) },
              { label: 'Parts Tracked',  value: warehouseHealth[master.id]?.parts ?? '—' },
              { label: 'Health',         value: <HealthBadge out={warehouseHealth[master.id]?.out || 0} low={warehouseHealth[master.id]?.low || 0} /> },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-l)', padding: 'var(--space-m)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'var(--font)' }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 var(--space-l) var(--space-l)', display: 'flex', gap: 'var(--space-s)', flexWrap: 'wrap' }}>
            {[
              ['Sales Orders', '/sales-orders'],
              ['Inventory',    '/warehouse-hq/inventory'],
              ['Parts Catalog','/warehouse-hq/catalog'],
              ['Transfers',    '/warehouse-hq/transfer'],
              ['IQ Dashboard', '/warehouse-hq/iq'],
            ].map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ padding: '5px 12px', borderRadius: 'var(--radius-s)', background: 'transparent', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', color: 'var(--brand-primary)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sub-Warehouses ── */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header">
          <span className="list-card__title"><Buildings size="1rem"  />Additional Warehouses</span>
        </div>
        {subs.map((wh, idx) => {
          const h = warehouseHealth[wh.id] || {}
          return (
            <div key={wh.id}
              onClick={() => navigate(`/warehouse-hq/warehouse/${wh.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: idx < subs.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }}>
              {/* Icon */}
              <Package size="1rem" style={{ color: 'var(--brand-primary)' }} />
              {/* Info */}
              <div className="content-body">
                <div className="text-sm-truncate">{wh.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginTop: 1 }}>
                  {wh.city}, {wh.state} · {h.parts || 0} parts · {fmt(h.total)}
                </div>
              </div>
              {/* Health */}
              <HealthBadge out={h.out || 0} low={h.low || 0} />
              <CaretRight size="0.875rem" className="row-item__caret" />
            </div>
          )
        })}
      </div>

      {/* ── Active Sales Orders ── */}
      <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
        <div className="list-card__header" style={{ cursor: 'pointer' }} onClick={() => navigate('/sales-orders')}>
          <span className="list-card__title"><Receipt size="1rem"  />Active Sales Orders</span>
          <span className="list-card__meta">
            View all <ArrowRight size="0.75rem" />
          </span>
        </div>
        {recentSOs.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--space-xl)' }}>
            <Receipt size="1.75rem" className="empty-icon" />
            <div className="empty-title">No active sales orders</div>
          </div>
        ) : recentSOs.map((so, idx) => (
          <div key={so.id}
            onClick={() => navigate(`/sales-orders/${so.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: idx < recentSOs.length - 1 ? '1px solid var(--border-subtle)' : 'none', cursor: 'pointer' }}>
            <Receipt size="1rem" style={{ color: 'var(--brand-primary)' }} />
            <div className="content-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--brand-primary)' }}>{so.so_number}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--radius-xs)', background: STAGE_COLOR[so.status] + '20', color: STAGE_COLOR[so.status], textTransform: 'capitalize' }}>{so.status}</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {so.customer_name} — {so.project_name || 'No project name'}
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-primary)', flexShrink: 0 }}>
              {fmt(so.grand_total)}
            </div>
            <CaretRight size="0.8125rem" className="row-item__caret" />
          </div>
        ))}
      </div>

      {/* ── Low / Out of Stock ── */}
      {lowStock.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-l)' }}>
          <div className="list-card__header" style={{ cursor: 'pointer' }} onClick={() => navigate('/warehouse-hq/inventory')}>
            <span className="list-card__title"><Warning size="1rem" />Low & Out of Stock</span>
            <span className="list-card__meta">
              View inventory <ArrowRight size="0.75rem" />
            </span>
          </div>
          {lowStock.map((item, idx) => {
            const isOut = item.quantity_on_hand === 0
            return (
              <div key={item.id}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: idx < lowStock.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <Warning size="1rem" weight="fill" style={{ color: isOut ? 'var(--state-error)' : 'var(--state-warning)' }} />
                <div className="content-body">
                  <div className="text-sm-truncate">
                    {item.parts?.name || 'Unknown Part'}
                  </div>
                  <div className="meta-text">{item.warehouses?.name}</div>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: isOut ? 'var(--state-error)' : 'var(--state-warning)', whiteSpace: 'nowrap' }}>
                  {isOut ? 'Out of Stock' : `${item.quantity_on_hand} left`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recent Transfers / Shipments ── */}
      <div className="card" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="list-card__header" style={{ cursor: 'pointer' }} onClick={() => navigate('/warehouse-hq/transfer')}>
          <span className="list-card__title"><Truck size="1rem"  />Recent Transfers</span>
          <span className="list-card__meta">
            New transfer <ArrowRight size="0.75rem" />
          </span>
        </div>
        {recentShips.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--space-xl)' }}>
            <Truck size="1.75rem" className="empty-icon" />
            <div className="empty-title">No transfers yet</div>
            <div className="empty-desc">Transfers between warehouses will appear here.</div>
          </div>
        ) : recentShips.map((t, idx) => (
          <div key={t.id}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: idx < recentShips.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
            <CheckCircle size="1rem" weight="fill" style={{ color: 'var(--state-success-text)' }} />
            <div className="content-body">
              <div className="text-sm-semi">
                {t.from_warehouse?.name?.replace(' Warehouse', '')} → {t.to_warehouse?.name?.replace(' Warehouse', '')}
              </div>
              <div className="meta-text">
                {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {t.reason ? ` · ${t.reason}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--radius-xs)', background: 'var(--state-success-soft)', color: 'var(--state-success-text)', textTransform: 'capitalize' }}>
              {t.status}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}

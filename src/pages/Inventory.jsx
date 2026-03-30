import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, Receipt, ClipboardText, Warning,
  Truck, ArrowRight, Buildings, CheckCircle,
  ArrowUp, CaretRight, Lightning, ClockCountdown } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { soStatus, stockStatusFromQty } from '../lib/statusColors.js'
import PageHeader from '../components/ui/PageHeader'

// ─── Stage colors ─────────────────────────────────────────────────────────────
const STAGE_COLOR = {
  draft:        'var(--grey-base)',
  queued:       'var(--purple-tint-20)',
  running:      'var(--warning)',
  submitted:    'var(--warning)',
  fulfillment:  'var(--blue)',
  published:    'var(--blue)',
  shipment:     'var(--blue-shade-20)',
  back_ordered: 'var(--blue-shade-20)',
  fulfilled:    'var(--success)',
  complete:     'var(--success)',
  cancelled:    'var(--grey-tint-20)' }

// ─── Warehouse health badge ───────────────────────────────────────────────────
function HealthBadge({ out, low }) {
  if (out > 0) return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--error-soft)', color: 'var(--error-alt)' }}>
      {out} Out
    </span>
  )
  if (low > 0) return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--warning-soft)', color: 'var(--warning)' }}>
      {low} Low
    </span>
  )
  return (
    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: 'var(--success-soft)', color: 'var(--success-text)' }}>
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
    <div className="page-content fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 'var(--gap-m)' }}>
      <div className="spinner" />
      <span style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Loading Warehouse IQ…</span>
    </div>
  )

  return (
    <div className="page-content fade-in">

      <PageHeader eyebrow="WAREHOUSE IQ" title="Master Dashboard" subtitle="All Sales Orders, Change Orders, Inventory & Fulfillment" />

      {/* ── Pending CO alert ── */}
      {stats?.pendingCOs > 0 && (
        <div onClick={() => navigate('/warehouse-hq/change-orders')}
          style={{ background: 'var(--warning-soft)', borderRadius: 'var(--r-m)', padding: 'var(--pad-m) var(--pad-l)', marginBottom: 'var(--mar-l)', display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', cursor: 'pointer' }}>
          <Warning size={18} weight="fill" style={{ color: 'var(--warning)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--warning-text)' }}>
              {stats.pendingCOs} Change Order{stats.pendingCOs !== 1 ? 's' : ''} Pending Review
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--warning-text)' }}>Field crew part requests waiting for approval</div>
          </div>
          <CaretRight size={14} style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
        </div>
      )}

      {/* ── Back order alert ── */}
      {backOrders.length > 0 && (
        <div onClick={() => navigate('/warehouse-hq/queue')}
          style={{ background: 'var(--blue-tint-80)', borderRadius: 'var(--r-m)', padding: 'var(--pad-m) var(--pad-l)', marginBottom: 'var(--mar-l)', display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', cursor: 'pointer' }}>
          <ClockCountdown size={18} weight="fill" style={{ color: 'var(--blue-shade-20)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--blue-shade-40)' }}>
              {backOrders.length} Back Order{backOrders.length !== 1 ? 's' : ''} Awaiting Stock
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--blue-shade-20)' }}>
              {backOrders.slice(0, 2).map(o => o.so_number).join(', ')}
              {backOrders.length > 2 ? ` + ${backOrders.length - 2} more` : ''} — tap to view queue
            </div>
          </div>
          <CaretRight size={14} style={{ color: 'var(--blue-shade-20)', flexShrink: 0 }} />
        </div>
      )}

      {/* ── 5 Stat cards ── */}
      <div className="wiq-stat-grid" style={{ marginBottom: 'var(--mar-xl)' }}>
        {[
          { label: 'Total Inventory Value', value: fmt(stats?.totalValue), color: 'var(--navy)', onClick: () => navigate('/warehouse-hq/inventory') },
          { label: 'Open Sales Orders',     value: stats?.openSOs ?? '—',  color: 'var(--blue)', onClick: () => navigate('/sales-orders') },
          { label: 'Pending Change Orders', value: stats?.pendingCOs ?? '—', color: stats?.pendingCOs > 0 ? 'var(--warning)' : 'var(--black)', onClick: () => navigate('/warehouse-hq/change-orders') },
          { label: 'Low / Out of Stock',    value: `${stats?.outStock ?? 0} / ${stats?.lowStock ?? 0}`, color: (stats?.outStock > 0 || stats?.lowStock > 0) ? 'var(--error)' : 'var(--success-text)', onClick: () => navigate('/warehouse-hq/inventory') },
          { label: 'Recent Shipments',      value: stats?.shipments ?? '—', color: 'var(--black)', onClick: () => navigate('/warehouse-hq/transfer') },
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
        <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate(`/warehouse-hq/warehouse/${master.id}`)}>
            <span className="card-title">
              <Lightning size={16} />
              {master.name}
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px', marginLeft: 8 }}>MASTER</span>
            </span>
            <span className="card-header__meta">{master.city}, {master.state}</span>
          </div>
          <div style={{ padding: 'var(--pad-l)', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-m)' }}>
            {[
              { label: 'Inventory Value', value: fmt(warehouseHealth[master.id]?.total) },
              { label: 'Parts Tracked',  value: warehouseHealth[master.id]?.parts ?? '—' },
              { label: 'Health',         value: <HealthBadge out={warehouseHealth[master.id]?.out || 0} low={warehouseHealth[master.id]?.low || 0} /> },
            ].map(f => (
              <div key={f.label} style={{ background: 'var(--white)', borderRadius: 'var(--r-l)', padding: 'var(--pad-m)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--black)', marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, fontFamily: 'var(--font)' }}>{f.value}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 var(--pad-l) var(--pad-l)', display: 'flex', gap: 'var(--gap-s)', flexWrap: 'wrap' }}>
            {[
              ['Sales Orders', '/sales-orders'],
              ['Inventory',    '/warehouse-hq/inventory'],
              ['Parts Catalog','/warehouse-hq/catalog'],
              ['Transfers',    '/warehouse-hq/transfer'],
              ['IQ Dashboard', '/warehouse-hq/iq'],
            ].map(([label, path]) => (
              <button key={label} onClick={() => navigate(path)}
                style={{ padding: '5px 12px', borderRadius: 'var(--r-s)', background: 'transparent', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', color: 'var(--navy)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Sub-Warehouses ── */}
      <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
        <div className="card-header">
          <span className="card-title"><Buildings size={16}  />Additional Warehouses</span>
        </div>
        {subs.map((wh, idx) => {
          const h = warehouseHealth[wh.id] || {}
          return (
            <div key={wh.id}
              onClick={() => navigate(`/warehouse-hq/warehouse/${wh.id}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: idx < subs.length - 1 ? '1px solid var(--border-l)' : 'none', cursor: 'pointer' }}>
              {/* Icon */}
              <Package size={16} style={{ color: 'var(--navy)' }} />
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{wh.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', marginTop: 1 }}>
                  {wh.city}, {wh.state} · {h.parts || 0} parts · {fmt(h.total)}
                </div>
              </div>
              {/* Health */}
              <HealthBadge out={h.out || 0} low={h.low || 0} />
              <CaretRight size={14} style={{ color: 'var(--black)', flexShrink: 0 }} />
            </div>
          )
        })}
      </div>

      {/* ── Active Sales Orders ── */}
      <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/sales-orders')}>
          <span className="card-title"><Receipt size={16}  />Active Sales Orders</span>
          <span className="card-header__meta">
            View all <ArrowRight size={12} />
          </span>
        </div>
        {recentSOs.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--pad-xl)' }}>
            <Receipt size={28} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
            <div className="empty-title">No active sales orders</div>
          </div>
        ) : recentSOs.map((so, idx) => (
          <div key={so.id}
            onClick={() => navigate(`/sales-orders/${so.id}`)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: idx < recentSOs.length - 1 ? '1px solid var(--border-l)' : 'none', cursor: 'pointer' }}>
            <Receipt size={16} style={{ color: 'var(--navy)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--navy)' }}>{so.so_number}</span>
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 5px', borderRadius: 'var(--r-xs)', background: STAGE_COLOR[so.status] + '20', color: STAGE_COLOR[so.status], textTransform: 'capitalize' }}>{so.status}</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--black)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {so.customer_name} — {so.project_name || 'No project name'}
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--black)', flexShrink: 0 }}>
              {fmt(so.grand_total)}
            </div>
            <CaretRight size={13} style={{ color: 'var(--black)', flexShrink: 0 }} />
          </div>
        ))}
      </div>

      {/* ── Low / Out of Stock ── */}
      {lowStock.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/warehouse-hq/inventory')}>
            <span className="card-title"><Warning size={16} />Low & Out of Stock</span>
            <span className="card-header__meta">
              View inventory <ArrowRight size={12} />
            </span>
          </div>
          {lowStock.map((item, idx) => {
            const isOut = item.quantity_on_hand === 0
            return (
              <div key={item.id}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: idx < lowStock.length - 1 ? '1px solid var(--border-l)' : 'none' }}>
                <Warning size={16} weight="fill" style={{ color: isOut ? 'var(--error-alt)' : 'var(--warning)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.parts?.name || 'Unknown Part'}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>{item.warehouses?.name}</div>
                </div>
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: isOut ? 'var(--error-alt)' : 'var(--warning)', whiteSpace: 'nowrap' }}>
                  {isOut ? 'Out of Stock' : `${item.quantity_on_hand} left`}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Recent Transfers / Shipments ── */}
      <div className="card" style={{ marginBottom: 'var(--mar-xxl)' }}>
        <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => navigate('/warehouse-hq/transfer')}>
          <span className="card-title"><Truck size={16}  />Recent Transfers</span>
          <span className="card-header__meta">
            New transfer <ArrowRight size={12} />
          </span>
        </div>
        {recentShips.length === 0 ? (
          <div className="empty" style={{ padding: 'var(--pad-xl)' }}>
            <Truck size={28} style={{ color: 'var(--text-3)', marginBottom: 8 }} />
            <div className="empty-title">No transfers yet</div>
            <div className="empty-desc">Transfers between warehouses will appear here.</div>
          </div>
        ) : recentShips.map((t, idx) => (
          <div key={t.id}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: idx < recentShips.length - 1 ? '1px solid var(--border-l)' : 'none' }}>
            <CheckCircle size={16} weight="fill" style={{ color: 'var(--success-text)' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {t.from_warehouse?.name?.replace(' Warehouse', '')} → {t.to_warehouse?.name?.replace(' Warehouse', '')}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {t.reason ? ` · ${t.reason}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-xs)', background: 'var(--success-soft)', color: 'var(--success-text)', textTransform: 'capitalize' }}>
              {t.status}
            </span>
          </div>
        ))}
      </div>

    </div>
  )
}

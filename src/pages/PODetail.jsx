import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Receipt, Buildings, MapPin, Phone, Envelope,
  CalendarBlank, CheckCircle, PaperPlaneTilt,
  Clock, ArrowRight, Lightning, ClipboardText, Truck,
  Warning, X } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { soStatus } from '../lib/statusColors.js'

// Local icon map — color/bg come from soStatus() in statusColors.js
const SO_STATUS_ICON = {
  draft: Clock, queued: Clock, running: PaperPlaneTilt, submitted: PaperPlaneTilt,
  fulfillment: Receipt, published: Receipt, shipment: Truck,
  back_ordered: Warning, complete: CheckCircle, fulfilled: CheckCircle, cancelled: X }

// Action config — what the CTA button does per status
const ACTION_CFG = {
  queued:       { label: 'Run Order',             sub: 'Process parts & generate fulfillment sheet', color: 'var(--brand-primary)',   path: id => `/warehouse-hq/queue/${id}` },
  running:      { label: 'Continue Run Order',    sub: 'Order is being processed',                   color: 'var(--brand-primary)',   path: id => `/warehouse-hq/queue/${id}` },
  fulfillment:  { label: 'Process Fulfillment',   sub: 'Pick parts and confirm availability',        color: 'var(--state-info)',       path: id => `/warehouse-hq/fulfillment/${id}` },
  shipment:     { label: 'Process Shipment',      sub: 'Enter carrier details and mark shipped',     color: 'var(--state-info)',       path: id => `/warehouse-hq/shipment/${id}` },
  back_ordered:  { label: 'Re-enter Queue',        sub: 'Stock arrived — push back to fulfillment',  color: 'var(--state-warning)',  path: id => `/warehouse-hq/queue/${id}` } }

function SectionGroup({ label, items }) {
  const [open, setOpen] = useState(true)
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_cost), 0)

  return (
    <div style={{ marginBottom: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'grid', gridTemplateColumns: '1fr 4.5rem 5.5rem 7.5rem',
        gap: 'var(--space-s)', padding: 'var(--space-m) var(--space-l)', background: 'var(--brand-primary)', cursor: 'pointer', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--surface-base)', textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left' }}>{label}</span>
        <span />
        <span />
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--surface-base)', textAlign: 'right' }}>
          ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </button>
      {open && items.map((item, idx) => (
        <div key={item.id} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 4.5rem 5.5rem 7.5rem',
          gap: 'var(--space-s)',
          padding: 'var(--space-s) var(--space-l)',
          borderBottom: idx < items.length - 1 ? '1px solid var(--border-subtle)' : 'none',
          alignItems: 'center',
          background: 'var(--surface-base)' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            {item.sku && <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--mono)', color: 'var(--text-muted)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku}</div>}
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.4 }}>{item.description}</div>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>{item.quantity}</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>${item.unit_cost.toFixed(2)}</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>
            ${(item.quantity * item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      ))}

    </div>
  )
}

export default function PODetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [po, setPo] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const timeout = ms => new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))
    Promise.race([
      Promise.all([
        db.from('sales_orders').select('*').eq('id', id).maybeSingle(),
        db.from('so_line_items').select('*, parts(sku, name), warehouses(name)').eq('so_id', id).order('sort_order'),
      ]),
      timeout(5000),
    ]).then(([{ data: poData }, { data: lineData }]) => {
      if (cancelled) return
      setPo(poData)
      setLines(lineData || [])
    }).catch(() => {}).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-2xl)' }}><div className="spinner" /></div>
  if (!po) return <div className="page-content fade-in"><div className="empty"><div className="empty-title">Sales Order not found</div></div></div>

  const statusDisplay = soStatus(po.status)
  const materialLines = lines.filter(l => l.line_type === 'material')
  const laborLines = lines.filter(l => l.line_type === 'labor')

  const materialsTotal = materialLines.reduce((s, l) => s + (l.quantity * l.unit_cost), 0)
  const laborTotal = laborLines.reduce((s, l) => s + (l.quantity * l.unit_cost), 0)
  const grandTotal = materialsTotal + laborTotal

  // Group material lines by section
  const sections = []
  const seen = new Set()
  for (const line of materialLines) {
    const sec = line.section_label || 'General'
    if (!seen.has(sec)) { seen.add(sec); sections.push(sec) }
  }

  // Inventory impact summary
  const warehouseImpact = {}
  for (const line of materialLines.filter(l => l.warehouse_id)) {
    const wName = line.warehouses?.name || 'Unknown'
    if (!warehouseImpact[wName]) warehouseImpact[wName] = { parts: 0, qty: 0 }
    warehouseImpact[wName].parts += 1
    warehouseImpact[wName].qty += line.quantity
  }

  const StatusIcon = SO_STATUS_ICON[po.status] || SO_STATUS_ICON[order?.status] || CheckCircle

  return (
    <div className="page-content fade-in">

      {/* SO Header card */}
      <div style={{ background: 'var(--brand-primary)', borderRadius: 'var(--radius-m)', padding: 'var(--space-xl)', marginBottom: 'var(--space-l)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-m)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--surface-base)', marginBottom: 4 }}>
              {po.division === 'Bolt' ? 'Bolt Lightning' : 'Lightning Master'} · {po.so_number}
            </div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 800, lineHeight: 1.1 }}>{po.customer_name}</div>
            {po.project_name && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--surface-base)', marginTop: 4 }}>{po.project_name}</div>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 'var(--radius-s)',
            background: statusDisplay.bg,
            color: statusDisplay.color }}>
            <StatusIcon size="0.75rem" weight="fill" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'capitalize' }}>{po.status}</span>
          </div>
        </div>

        {/* Customer details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-l)',  paddingTop: 'var(--space-m)' }}>
          {(po.customer_city || po.customer_state) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--surface-base)' }}>
              <MapPin size="0.75rem" />
              {[po.customer_city, po.customer_state].filter(Boolean).join(', ')}
            </div>
          )}
          {po.customer_phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--surface-base)' }}>
              <Phone size="0.75rem" /> {po.customer_phone}
            </div>
          )}
          {po.customer_email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--surface-base)' }}>
              <Envelope size="0.75rem" /> {po.customer_email}
            </div>
          )}
          {po.so_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'var(--surface-base)' }}>
              <CalendarBlank size="0.75rem" />
              {new Date(po.so_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {po.job_reference && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)', fontFamily: 'var(--mono)' }}>
              Ref: {po.job_reference}
            </div>
          )}
        </div>
      </div>

      {/* Inventory impact (when not yet published) */}
      {!['complete','fulfilled','cancelled'].includes(po.status) && Object.keys(warehouseImpact).length > 0 && (
        <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', padding: 'var(--space-l)', marginBottom: 'var(--space-l)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-m)' }}>
            Inventory Impact {['fulfillment','shipment','complete','fulfilled'].includes(po.status) ? '(Applied)' : '(On Fulfillment)'}
          </div>
          {Object.entries(warehouseImpact).map(([wName, impact]) => (
            <div key={wName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-s)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)', fontSize: 'var(--text-sm)' }}>
                <Buildings size="0.875rem" style={{ color: 'var(--text-primary)' }} />
                {wName}
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--state-error-text)', background: 'var(--state-error-soft)', padding: '2px 8px', borderRadius: 'var(--radius-s)' }}>
                -{impact.qty} units ({impact.parts} SKUs)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Line items — materials by section */}
      {sections.length > 0 && (
        <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', overflow: 'hidden', marginBottom: 'var(--space-l)', maxWidth: '100%' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 4.5rem 5.5rem 7.5rem', gap: 'var(--space-s)', padding: 'var(--space-l)', background: 'var(--surface-base)', borderBottom: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-m) var(--radius-m) 0 0' }}>
            {['Item / Description', 'Quantity', 'Unit', 'Amount'].map(h => (
              <div key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', textAlign: h !== 'Item / Description' ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
            ))}
          </div>
          {sections.map(sec => (
            <SectionGroup
              key={sec}
              label={sec}
              items={materialLines.filter(l => (l.section_label || 'General') === sec)}
            />
          ))}
          {/* Materials subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-m) var(--space-l)', borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-hover)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Materials Subtotal</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
              ${materialsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Labor lines */}
      {laborLines.length > 0 && (
        <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', overflow: 'hidden', marginBottom: 'var(--space-l)', maxWidth: '100%' }}>
          <div style={{ padding: 'var(--space-m) var(--space-l)', background: 'var(--brand-primary)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff' }}>Installation / Labor</span>
          </div>
          {laborLines.map((line, idx) => (
            <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderBottom: idx < laborLines.length - 1 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', background: 'var(--surface-base)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{line.description}</div>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>{line.quantity}</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>${line.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text-primary)', textAlign: 'right' }}>${(line.quantity * line.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-m) var(--space-l)', borderTop: '2px solid var(--border-subtle)', background: 'var(--surface-hover)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>Labor Subtotal</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>${laborTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* Grand total */}
      {grandTotal > 0 && (
        <div style={{ background: 'var(--brand-primary)', borderRadius: 'var(--radius-m)', padding: 'var(--space-l) var(--space-xl)', marginBottom: 'var(--space-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#fff' }}>Total</span>
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 800, color: '#fff' }}>
            ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Notes */}
      {po.notes && (
        <div style={{ background: 'var(--surface-base)', borderRadius: 'var(--radius-m)', padding: 'var(--space-l)', marginBottom: 'var(--space-l)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-s)' }}>Notes</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', lineHeight: 1.6 }}>{po.notes}</div>
        </div>
      )}

      {/* ── Contextual Action Button ────────────────────────────────────────── */}
      {ACTION_CFG[po.status] && (() => {
        const cfg = ACTION_CFG[po.status]
        return (
          <button
            onClick={() => navigate(cfg.path(po.id))}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--space-l) var(--space-xl)', borderRadius: 'var(--radius-m)',
              background: cfg.color, cursor: 'pointer',
              marginBottom: 'var(--space-2xl)' }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#fff' }}>{cfg.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)', marginTop: 2 }}>{cfg.sub}</div>
            </div>
            <ArrowRight size="1.25rem" style={{ color: '#fff', flexShrink: 0 }} weight="bold" />
          </button>
        )
      })()}

    </div>
  )
}

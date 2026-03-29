import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Receipt, Buildings, MapPin, Phone, Envelope,
  CalendarBlank, CheckCircle, PaperPlaneTilt,
  Clock, CaretDown, ArrowRight, Lightning, ClipboardText, Truck, Rocket,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STATUS_DISPLAY = {
  draft:        { label: 'Draft',        icon: Clock,          color: '#64748B', bg: '#F1F5F9' },
  queued:       { label: 'Queued',       icon: Clock,          color: '#6366F1', bg: '#EEF2FF' },
  running:      { label: 'Running',      icon: PaperPlaneTilt, color: '#D97706', bg: '#FEF3C7' },
  submitted:    { label: 'Submitted',    icon: PaperPlaneTilt, color: '#D97706', bg: '#FEF3C7' },
  fulfillment:  { label: 'Fulfillment',  icon: Receipt,        color: '#0369A1', bg: '#EFF6FF' },
  published:    { label: 'Published',    icon: Receipt,        color: '#0369A1', bg: '#EFF6FF' },
  shipment:     { label: 'Shipment',     icon: Receipt,        color: '#0891B2', bg: '#ECFEFF' },
  back_ordered: { label: 'Back Order',   icon: Clock,          color: '#0891B2', bg: '#ECFEFF' },
  complete:     { label: 'Complete',     icon: CheckCircle,    color: '#15803D', bg: '#F0FDF4' },
  fulfilled:    { label: 'Complete',     icon: CheckCircle,    color: '#15803D', bg: '#F0FDF4' },
  cancelled:    { label: 'Cancelled',    icon: Clock,          color: '#9CA3AF', bg: '#F1F5F9' },
}


// Action config — what the CTA button does per status
const ACTION_CFG = {
  queued:       { label: 'Run Order',             sub: 'Process parts & generate fulfillment sheet', color: 'var(--navy)',   path: id => `/warehouse-hq/queue/${id}` },
  running:      { label: 'Continue Run Order',    sub: 'Order is being processed',                   color: 'var(--navy)',   path: id => `/warehouse-hq/queue/${id}` },
  fulfillment:  { label: 'Process Fulfillment',   sub: 'Pick parts and confirm availability',        color: '#0369A1',       path: id => `/warehouse-hq/fulfillment/${id}` },
  shipment:     { label: 'Process Shipment',      sub: 'Enter carrier details and mark shipped',     color: '#0891B2',       path: id => `/warehouse-hq/shipment/${id}` },
  back_ordered:  { label: 'Re-enter Queue',        sub: 'Stock arrived — push back to fulfillment',  color: 'var(--amber)',  path: id => `/warehouse-hq/queue/${id}` },
}

function SectionGroup({ label, items }) {
  const [open, setOpen] = useState(true)
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_cost), 0)

  return (
    <div style={{ marginBottom: 'var(--sp-3)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--sp-2) var(--sp-4)', background: 'var(--navy)', border: 'none', cursor: 'pointer',
      }}>
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <CaretDown size={13} style={{ color: 'rgba(255,255,255,0.5)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </div>
      </button>
      {open && items.map((item, idx) => (
        <div key={item.id} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 40px 56px 64px',
          gap: 6,
          padding: 'var(--sp-2) var(--sp-3)',
          borderBottom: idx < items.length - 1 ? '1px solid var(--border-l)' : 'none',
          alignItems: 'start',
          background: 'var(--surface-raised)',
        }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            {item.sku && <div style={{ fontSize: 'var(--fs-xs)', fontFamily: 'var(--mono)', color: 'var(--text-3)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku}</div>}
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.4 }}>{item.description}</div>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>{item.quantity}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>${item.unit_cost.toFixed(2)}</div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-1)', textAlign: 'right', paddingTop: 2 }}>
            ${(item.quantity * item.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      ))}

      {/* ── Contextual Action Button ────────────────────────────────────────── */}
      {ACTION_CFG[po.status] && (() => {
        const cfg = ACTION_CFG[po.status]
        return (
          <button
            onClick={() => navigate(cfg.path(po.id))}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 'var(--sp-4) var(--sp-5)', borderRadius: 'var(--r-xl)',
              background: cfg.color, border: 'none', cursor: 'pointer',
              marginBottom: 'var(--sp-6)',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#fff' }}>{cfg.label}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{cfg.sub}</div>
            </div>
            <ArrowRight size={20} style={{ color: '#fff', flexShrink: 0 }} weight="bold" />
          </button>
        )
      })()}

    </div>
  )
}

export default function PODetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [po, setPo] = useState(null)
  const [lines, setLines] = useState([])
  const [loading, setLoading] = useState(true)

  const load = () => Promise.all([
    db.from('sales_orders').select('*').eq('id', id).single(),
    db.from('so_line_items').select('*, parts(sku, name), warehouses(name)').eq('so_id', id).order('sort_order'),
  ]).then(([{ data: poData }, { data: lineData }]) => {
    setPo(poData)
    setLines(lineData || [])
    setLoading(false)
  })

  useEffect(() => { load() }, [id])



  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-10)' }}><div className="spinner" /></div>
  if (!po) return <div className="page-content fade-in"><div className="empty"><div className="empty-title">Sales Order not found</div></div></div>

  const statusDisplay = STATUS_DISPLAY[po.status] || STATUS_DISPLAY.draft
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

  const StatusIcon = statusDisplay.icon || CheckCircle

  return (
    <div className="page-content fade-in">

      {/* SO Header card */}
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              {po.division === 'Bolt' ? 'Bolt Lightning' : 'Lightning Master'} · {po.so_number}
            </div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, lineHeight: 1.1 }}>{po.customer_name}</div>
            {po.project_name && (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{po.project_name}</div>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 'var(--r-full)',
            background: statusDisplay.bg,
            color: statusDisplay.color,
          }}>
            <StatusIcon size={12} weight="fill" />
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'capitalize' }}>{po.status}</span>
          </div>
        </div>

        {/* Customer details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--sp-3)' }}>
          {(po.customer_city || po.customer_state) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <MapPin size={12} />
              {[po.customer_city, po.customer_state].filter(Boolean).join(', ')}
            </div>
          )}
          {po.customer_phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <Phone size={12} /> {po.customer_phone}
            </div>
          )}
          {po.customer_email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <Envelope size={12} /> {po.customer_email}
            </div>
          )}
          {po.so_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <CalendarBlank size={12} />
              {new Date(po.so_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {po.job_reference && (
            <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--mono)' }}>
              Ref: {po.job_reference}
            </div>
          )}
        </div>
      </div>

      {/* Inventory impact (when not yet published) */}
      {!['complete','fulfilled','cancelled'].includes(po.status) && Object.keys(warehouseImpact).length > 0 && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', border: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 'var(--sp-3)' }}>
            Inventory Impact {['fulfillment','shipment','complete','fulfilled'].includes(po.status) ? '(Applied)' : '(On Fulfillment)'}
          </div>
          {Object.entries(warehouseImpact).map(([wName, impact]) => (
            <div key={wName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
                <Buildings size={14} style={{ color: 'var(--text-2)' }} />
                {wName}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>
                -{impact.qty} units ({impact.parts} SKUs)
              </span>
            </div>
          ))}
        </div>
      )}



      {/* Line items — materials by section */}
      {sections.length > 0 && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-4)', maxWidth: '100%' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 56px 64px', gap: 6, padding: 'var(--sp-2) var(--sp-3)', background: 'var(--hover)', borderBottom: '1px solid var(--border-l)' }}>
            {['Item / Description', 'Qty', 'Unit', 'Amount'].map(h => (
              <div key={h} style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)', textAlign: h !== 'Item / Description' ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', borderTop: '2px solid var(--border-l)', background: 'var(--hover)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-2)' }}>Materials Subtotal</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-1)' }}>
              ${materialsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Labor lines */}
      {laborLines.length > 0 && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-4)', maxWidth: '100%' }}>
          <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--navy)' }}>
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff' }}>Installation / Labor</span>
          </div>
          {laborLines.map((line, idx) => (
            <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--sp-3)', padding: 'var(--sp-3) var(--sp-4)', borderBottom: idx < laborLines.length - 1 ? '1px solid var(--border-l)' : 'none', alignItems: 'center', background: 'var(--surface-raised)' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 500 }}>{line.description}</div>
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', textAlign: 'right' }}>{line.quantity}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', textAlign: 'right' }}>${line.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, textAlign: 'right' }}>${(line.quantity * line.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', borderTop: '2px solid var(--border-l)', background: 'var(--hover)' }}>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-2)' }}>Labor Subtotal</span>
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: 'var(--text-1)' }}>${laborTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* Grand total */}
      {grandTotal > 0 && (
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-4) var(--sp-5)', marginBottom: 'var(--sp-5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, color: '#fff' }}>Total</span>
          <span style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, color: '#fff' }}>
            ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Notes */}
      {po.notes && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', border: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)', marginBottom: 'var(--sp-2)' }}>Notes</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 1.6 }}>{po.notes}</div>
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
              padding: 'var(--sp-4) var(--sp-5)', borderRadius: 'var(--r-xl)',
              background: cfg.color, border: 'none', cursor: 'pointer',
              marginBottom: 'var(--sp-6)',
            }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, color: '#fff' }}>{cfg.label}</div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{cfg.sub}</div>
            </div>
            <ArrowRight size={20} style={{ color: '#fff', flexShrink: 0 }} weight="bold" />
          </button>
        )
      })()}

    </div>
  )
}

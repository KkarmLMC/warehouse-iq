import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Receipt, Buildings, MapPin, Phone, Envelope,
  CalendarBlank, CheckCircle, PaperPlaneTilt,
  Clock, CaretDown, ArrowRight, Lightning, ClipboardText, Truck } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STATUS_DISPLAY = {
  draft:        { label: 'Draft',        icon: Clock,          color: 'var(--grey-base)', bg: 'var(--grey-tint-80)' },
  queued:       { label: 'Queued',       icon: Clock,          color: 'var(--purple-tint-20)', bg: 'var(--purple-soft)' },
  running:      { label: 'Running',      icon: PaperPlaneTilt, color: 'var(--black)', bg: 'var(--warning-soft)' },
  submitted:    { label: 'Submitted',    icon: PaperPlaneTilt, color: 'var(--black)', bg: 'var(--warning-soft)' },
  fulfillment:  { label: 'Fulfillment',  icon: Receipt,        color: 'var(--black)', bg: 'var(--blue-soft)' },
  published:    { label: 'Published',    icon: Receipt,        color: 'var(--black)', bg: 'var(--blue-soft)' },
  shipment:     { label: 'Shipment',     icon: Receipt,        color: 'var(--black)', bg: 'var(--blue-tint-80)' },
  back_ordered: { label: 'Back Order',   icon: Clock,          color: 'var(--black)', bg: 'var(--blue-tint-80)' },
  complete:     { label: 'Complete',     icon: CheckCircle,    color: 'var(--black)', bg: 'var(--success-soft)' },
  fulfilled:    { label: 'Complete',     icon: CheckCircle,    color: 'var(--black)', bg: 'var(--success-soft)' },
  cancelled:    { label: 'Cancelled',    icon: Clock,          color: 'var(--grey-tint-20)', bg: 'var(--grey-tint-80)' } }


// Action config — what the CTA button does per status
const ACTION_CFG = {
  queued:       { label: 'Run Order',             sub: 'Process parts & generate fulfillment sheet', color: 'var(--navy)',   path: id => `/warehouse-hq/queue/${id}` },
  running:      { label: 'Continue Run Order',    sub: 'Order is being processed',                   color: 'var(--navy)',   path: id => `/warehouse-hq/queue/${id}` },
  fulfillment:  { label: 'Process Fulfillment',   sub: 'Pick parts and confirm availability',        color: 'var(--black)',       path: id => `/warehouse-hq/fulfillment/${id}` },
  shipment:     { label: 'Process Shipment',      sub: 'Enter carrier details and mark shipped',     color: 'var(--black)',       path: id => `/warehouse-hq/shipment/${id}` },
  back_ordered:  { label: 'Re-enter Queue',        sub: 'Stock arrived — push back to fulfillment',  color: 'var(--black)',  path: id => `/warehouse-hq/queue/${id}` } }

function SectionGroup({ label, items }) {
  const [open, setOpen] = useState(true)
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_cost), 0)

  return (
    <div style={{ marginBottom: 'var(--mar-m)' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'var(--pad-s) var(--pad-l)', background: 'var(--navy)', cursor: 'pointer' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-m)' }}>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
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
          padding: 'var(--pad-s) var(--pad-m)',
          borderBottom: idx < items.length - 1 ? '1px solid var(--border-l)' : 'none',
          alignItems: 'start',
          background: 'var(--white)' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            {item.sku && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--mono)', color: 'var(--text-3)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku}</div>}
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--black)', lineHeight: 1.4 }}>{item.description}</div>
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>{item.quantity}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>${item.unit_cost.toFixed(2)}</div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--black)', textAlign: 'right', paddingTop: 2 }}>
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

  const load = () => Promise.all([
    db.from('sales_orders').select('*').eq('id', id).single(),
    db.from('so_line_items').select('*, parts(sku, name), warehouses(name)').eq('so_id', id).order('sort_order'),
  ]).then(([{ data: poData }, { data: lineData }]) => {
    setPo(poData)
    setLines(lineData || [])
    setLoading(false)
  })

  useEffect(() => { load() }, [id])



  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pad-xxl)' }}><div className="spinner" /></div>
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
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xl)', marginBottom: 'var(--mar-l)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--mar-m)' }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
              {po.division === 'Bolt' ? 'Bolt Lightning' : 'Lightning Master'} · {po.so_number}
            </div>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, lineHeight: 1.1 }}>{po.customer_name}</div>
            {po.project_name && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.65)', marginTop: 4 }}>{po.project_name}</div>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 12px', borderRadius: 'var(--r-xxl)',
            background: statusDisplay.bg,
            color: statusDisplay.color }}>
            <StatusIcon size={12} weight="fill" />
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, textTransform: 'capitalize' }}>{po.status}</span>
          </div>
        </div>

        {/* Customer details */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-l)',  paddingTop: 'var(--pad-m)' }}>
          {(po.customer_city || po.customer_state) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <MapPin size={12} />
              {[po.customer_city, po.customer_state].filter(Boolean).join(', ')}
            </div>
          )}
          {po.customer_phone && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <Phone size={12} /> {po.customer_phone}
            </div>
          )}
          {po.customer_email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <Envelope size={12} /> {po.customer_email}
            </div>
          )}
          {po.so_date && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)' }}>
              <CalendarBlank size={12} />
              {new Date(po.so_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          )}
          {po.job_reference && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--mono)' }}>
              Ref: {po.job_reference}
            </div>
          )}
        </div>
      </div>

      {/* Inventory impact (when not yet published) */}
      {!['complete','fulfilled','cancelled'].includes(po.status) && Object.keys(warehouseImpact).length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l)', marginBottom: 'var(--mar-l)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--mar-m)' }}>
            Inventory Impact {['fulfillment','shipment','complete','fulfilled'].includes(po.status) ? '(Applied)' : '(On Fulfillment)'}
          </div>
          {Object.entries(warehouseImpact).map(([wName, impact]) => (
            <div key={wName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--mar-s)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', fontSize: 'var(--text-sm)' }}>
                <Buildings size={14} style={{ color: 'var(--black)' }} />
                {wName}
              </div>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', background: 'var(--bg)', padding: '2px 8px', borderRadius: 'var(--r-xxl)' }}>
                -{impact.qty} units ({impact.parts} SKUs)
              </span>
            </div>
          ))}
        </div>
      )}



      {/* Line items — materials by section */}
      {sections.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)', maxWidth: '100%' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 56px 64px', gap: 6, padding: 'var(--pad-s) var(--pad-m)', background: 'var(--hover)', borderBottom: '1px solid var(--border-l)' }}>
            {['Item / Description', 'Qty', 'Unit', 'Amount'].map(h => (
              <div key={h} style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', textAlign: h !== 'Item / Description' ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--pad-m) var(--pad-l)', borderTop: '2px solid var(--border-l)', background: 'var(--hover)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Materials Subtotal</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>
              ${materialsTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* Labor lines */}
      {laborLines.length > 0 && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)', maxWidth: '100%' }}>
          <div style={{ padding: 'var(--pad-m) var(--pad-l)', background: 'var(--navy)' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: '#fff' }}>Installation / Labor</span>
          </div>
          {laborLines.map((line, idx) => (
            <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 'var(--gap-m)', padding: 'var(--pad-m) var(--pad-l)', borderBottom: idx < laborLines.length - 1 ? '1px solid var(--border-l)' : 'none', alignItems: 'center', background: 'var(--white)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{line.description}</div>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', textAlign: 'right' }}>{line.quantity}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', textAlign: 'right' }}>${line.unit_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, textAlign: 'right' }}>${(line.quantity * line.unit_cost).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--pad-m) var(--pad-l)', borderTop: '2px solid var(--border-l)', background: 'var(--hover)' }}>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>Labor Subtotal</span>
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--black)' }}>${laborTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}

      {/* Grand total */}
      {grandTotal > 0 && (
        <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l) var(--pad-xl)', marginBottom: 'var(--mar-xl)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: '#fff' }}>Total</span>
          <span style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: '#fff' }}>
            ${grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {/* Notes */}
      {po.notes && (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l)', marginBottom: 'var(--mar-l)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 'var(--mar-s)' }}>Notes</div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--black)', lineHeight: 1.6 }}>{po.notes}</div>
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
              padding: 'var(--pad-l) var(--pad-xl)', borderRadius: 'var(--r-m)',
              background: cfg.color, cursor: 'pointer',
              marginBottom: 'var(--mar-xxl)' }}
          >
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 700, color: '#fff' }}>{cfg.label}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{cfg.sub}</div>
            </div>
            <ArrowRight size={20} style={{ color: '#fff', flexShrink: 0 }} weight="bold" />
          </button>
        )
      })()}

    </div>
  )
}

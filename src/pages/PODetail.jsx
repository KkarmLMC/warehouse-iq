import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Receipt, Buildings, MapPin, Phone, Envelope, Package,
  Wrench, CalendarBlank, CheckCircle, PaperPlaneTilt,
  Clock, Warning, ArrowRight, Printer, CaretDown, Plus,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

const STATUS_FLOW = {
  draft:     { next: 'submitted', nextLabel: 'Submit for Review', nextColor: '#D97706', nextBg: '#FEF3C7', icon: Clock,          color: '#64748B' },
  submitted: { next: 'published', nextLabel: 'Publish & Deduct Inventory', nextColor: '#fff',   nextBg: 'var(--navy)', icon: PaperPlaneTilt, color: '#D97706' },
  published: { next: 'fulfilled', nextLabel: 'Mark as Fulfilled', nextColor: '#fff',   nextBg: '#15803D', icon: Receipt,        color: '#0369A1' },
  fulfilled: { next: null,        nextLabel: null,                 nextColor: null,    nextBg: null,      icon: CheckCircle,    color: '#15803D' },
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
        <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
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
            {item.sku && <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text-3)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sku}</div>}
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 500, color: 'var(--text-1)', lineHeight: 1.4 }}>{item.description}</div>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>{item.quantity}</div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', textAlign: 'right', paddingTop: 2 }}>${item.unit_cost.toFixed(2)}</div>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 600, color: 'var(--text-1)', textAlign: 'right', paddingTop: 2 }}>
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
  const [advancing, setAdvancing] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)

  const load = () => Promise.all([
    db.from('sales_orders').select('*').eq('id', id).single(),
    db.from('so_line_items').select('*, parts(sku, name), warehouses(name)').eq('so_id', id).order('sort_order'),
  ]).then(([{ data: poData }, { data: lineData }]) => {
    setPo(poData)
    setLines(lineData || [])
    setLoading(false)
  })

  useEffect(() => { load() }, [id])

  const advanceStatus = async () => {
    const flow = STATUS_FLOW[po.status]
    if (!flow?.next) return
    if (po.status === 'submitted' && !confirmPublish) {
      setConfirmPublish(true)
      return
    }
    setAdvancing(true)
    setConfirmPublish(false)
    const updates = { status: flow.next, updated_at: new Date().toISOString() }
    if (flow.next === 'submitted') updates.submitted_at = new Date().toISOString()
    if (flow.next === 'published') updates.published_at = new Date().toISOString()
    if (flow.next === 'fulfilled') updates.fulfilled_at = new Date().toISOString()
    await db.from('sales_orders').update(updates).eq('id', id)

    // When publishing: deduct inventory
    if (flow.next === 'published') {
      for (const line of lines.filter(l => l.line_type === 'material' && l.part_id && l.warehouse_id)) {
        await db.rpc('adjust_inventory', {
          p_part_id: line.part_id,
          p_warehouse_id: line.warehouse_id,
          p_quantity_delta: -Math.abs(line.quantity),
          p_transaction_type: 'job_checkout',
          p_reason: `SO ${po.so_number} — ${po.customer_name}`,
        })
      }
    }

    await load()
    setAdvancing(false)
  }

  if (loading) return <div className="page-content fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-10)' }}><div className="spinner" /></div>
  if (!po) return <div className="page-content fade-in"><div className="empty"><div className="empty-title">Sales Order not found</div></div></div>

  const flow = STATUS_FLOW[po.status]
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

  const StatusIcon = flow?.icon || CheckCircle

  return (
    <div className="page-content fade-in">

      {/* SO Header card */}
      <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-5)', marginBottom: 'var(--sp-4)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--sp-3)' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
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
            background: po.status === 'submitted' ? '#FEF3C7' : po.status === 'published' ? '#EFF6FF' : po.status === 'fulfilled' ? '#F0FDF4' : 'rgba(255,255,255,0.12)',
            color: po.status === 'submitted' ? '#D97706' : po.status === 'published' ? '#0369A1' : po.status === 'fulfilled' ? '#15803D' : 'rgba(255,255,255,0.7)',
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
      {po.status !== 'fulfilled' && Object.keys(warehouseImpact).length > 0 && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', border: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-3)' }}>
            Inventory Impact {po.status === 'published' ? '(Applied)' : '(On Publish)'}
          </div>
          {Object.entries(warehouseImpact).map(([wName, impact]) => (
            <div key={wName} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--sp-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
                <Buildings size={14} style={{ color: 'var(--text-3)' }} />
                {wName}
              </div>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#B91C1C', background: '#FEF2F2', padding: '2px 8px', borderRadius: 'var(--r-full)' }}>
                -{impact.qty} units ({impact.parts} SKUs)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Confirm publish banner */}
      {confirmPublish && (
        <div style={{ background: '#FEF3C7', borderRadius: 'var(--r-xl)', padding: 'var(--sp-4)', marginBottom: 'var(--sp-4)', border: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-3)' }}>
            <Warning size={18} weight="fill" style={{ color: '#D97706' }} />
            <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 700, color: '#92400E' }}>Confirm Publish</span>
          </div>
          <div style={{ fontSize: 'var(--fs-sm)', color: '#92400E', marginBottom: 'var(--sp-3)' }}>
            Publishing this PO will deduct {materialLines.filter(l => l.warehouse_id).length} material line items from inventory across {Object.keys(warehouseImpact).length} warehouse(s). This cannot be undone.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2)' }}>
            <button onClick={() => setConfirmPublish(false)}
              style={{ padding: 'var(--sp-2)', borderRadius: 'var(--r-md)', border: '1px solid #FDE68A', background: 'transparent', color: '#92400E', fontWeight: 600, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
              Cancel
            </button>
            <button onClick={advanceStatus} disabled={advancing}
              style={{ padding: 'var(--sp-2)', borderRadius: 'var(--r-md)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
              {advancing ? 'Publishing…' : 'Confirm Publish'}
            </button>
          </div>
        </div>
      )}

      {/* Line items — materials by section */}
      {sections.length > 0 && (
        <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-4)', maxWidth: '100%' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 56px 64px', gap: 6, padding: 'var(--sp-2) var(--sp-3)', background: 'var(--hover)', borderBottom: '1px solid var(--border-l)' }}>
            {['Item / Description', 'Qty', 'Unit', 'Amount'].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textAlign: h !== 'Item / Description' ? 'right' : 'left', whiteSpace: 'nowrap', overflow: 'hidden' }}>{h}</div>
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
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Installation / Labor</span>
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
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 'var(--sp-2)' }}>Notes</div>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-2)', lineHeight: 1.6 }}>{po.notes}</div>
        </div>
      )}

      {/* Action button */}
      {flow?.next && !confirmPublish && (
        <button onClick={advanceStatus} disabled={advancing}
          style={{
            width: '100%', padding: 'var(--sp-4)', borderRadius: 'var(--r-xl)', border: 'none',
            background: flow.nextBg, color: flow.nextColor,
            fontWeight: 700, fontSize: 'var(--fs-md)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)',
            marginBottom: 'var(--sp-4)',
          }}>
          {advancing ? 'Processing…' : <><ArrowRight size={18} /> {flow.nextLabel}</>}
        </button>
      )}
    </div>
  )
}

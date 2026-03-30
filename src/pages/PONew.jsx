import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Trash, MagnifyingGlass, X, CaretDown, CaretRight,
  DotsSixVertical, Buildings, Package, Wrench, Check,
  ArrowRight, Warning } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'
import ProjectPicker from '../components/ProjectPicker.jsx'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>
      {children}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
    </label>
  )
}

function SectionDivider({ label }) {
  return (
    <div style={{ margin: 'var(--mar-l) 0', paddingTop: 'var(--pad-m)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)' }}>{label}</div>
    </div>
  )
}

// ─── Part search dropdown ─────────────────────────────────────────────────────
function PartSearch({ onSelect, warehouseId }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const q = query.toLowerCase()
      let req = db.from('parts').select('id, sku, name, unit_cost').eq('is_active', true)
        .or(`name.ilike.%${q}%,sku.ilike.%${q}%`)
        .limit(10)
      const { data } = await req
      // If warehouse selected, enrich with current stock
      if (warehouseId && data?.length) {
        const ids = data.map(p => p.id)
        const { data: levels } = await db.from('inventory_levels')
          .select('part_id, quantity_on_hand')
          .eq('warehouse_id', warehouseId)
          .in('part_id', ids)
        const stockMap = {}
        levels?.forEach(l => { stockMap[l.part_id] = l.quantity_on_hand })
        setResults(data.map(p => ({ ...p, stock: stockMap[p.id] ?? null })))
      } else {
        setResults(data?.map(p => ({ ...p, stock: null })) || [])
      }
      setLoading(false)
      setOpen(true)
    }, 250)
    return () => clearTimeout(t)
  }, [query, warehouseId])

  const handleSelect = (part) => {
    onSelect(part)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <MagnifyingGlass size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => query && setOpen(true)}
          placeholder="Search parts by name or SKU…"
          style={{ width: '100%', paddingLeft: 30, paddingRight: 30 }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
            style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
            <X size={13} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--white)', borderRadius: 'var(--r-l)', marginTop: 4,
          maxHeight: '16rem', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 'var(--pad-m)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Searching…</div>
          ) : results.map(part => (
            <button key={part.id} onMouseDown={() => handleSelect(part)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--pad-s) var(--pad-m)', background: 'none',
                cursor: 'pointer', textAlign: 'left', borderBottom: '1px solid var(--border-l)' }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{part.name}</div>
                <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>{part.sku}</div>
              </div>
              <div style={{ flexShrink: 0, textAlign: 'right', marginLeft: 'var(--mar-m)' }}>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)' }}>
                  ${part.unit_cost?.toFixed(2) || '—'}
                </div>
                {part.stock !== null && (
                  <div style={{ fontSize: 'var(--text-xs)', color: part.stock > 0 ? 'var(--success-text)' : 'var(--error-dark)', fontWeight: 600 }}>
                    {part.stock} in stock
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Single line item row ─────────────────────────────────────────────────────
function LineItemRow({ item, warehouses, onUpdate, onRemove }) {
  const lineTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 36px', gap: 'var(--gap-s)', alignItems: 'center', padding: 'var(--pad-s) 0', borderBottom: '1px solid var(--border-l)' }}>
      <div style={{ minWidth: 0 }}>
        {item.sku && <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--mono)', color: 'var(--text-3)', marginBottom: 2 }}>{item.sku}</div>}
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>
        {warehouses.length > 1 && (
          <select
            value={item.warehouse_id || ''}
            onChange={e => onUpdate({ ...item, warehouse_id: e.target.value })}
            style={{ fontSize: 'var(--text-xs)', marginTop: 4, padding: '2px 4px', borderRadius: 4, background: 'var(--white)', color: 'var(--text-3)', width: '100%' }}
          >
            <option value="">No warehouse</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name.replace(' Warehouse','')}</option>)}
          </select>
        )}
      </div>
      <input
        type="number" min="0" step="1"
        value={item.quantity}
        onChange={e => onUpdate({ ...item, quantity: e.target.value })}
        style={{ width: '100%', textAlign: 'right', fontSize: 'var(--text-xs)' }}
      />
      <input
        type="number" min="0" step="0.01"
        value={item.unit_cost}
        onChange={e => onUpdate({ ...item, unit_cost: e.target.value })}
        style={{ width: '100%', textAlign: 'right', fontSize: 'var(--text-xs)' }}
      />
      <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 700, color: lineTotal > 0 ? 'var(--black)' : 'var(--text-3)' }}>
        ${lineTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <button onClick={onRemove}
        style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hover)', borderRadius: 'var(--r-m)', cursor: 'pointer', color: 'var(--error-dark)' }}>
        <Trash size={13} />
      </button>
    </div>
  )
}

// ─── Scope section block ──────────────────────────────────────────────────────
function ScopeSection({ section, warehouses, defaultWarehouseId, onUpdate, onRemove }) {
  const [expanded, setExpanded] = useState(true)
  const subtotal = section.items.reduce((s, i) => s + ((parseFloat(i.quantity)||0) * (parseFloat(i.unit_cost)||0)), 0)

  const addPart = (part) => {
    const newItem = {
      _key: Date.now(),
      line_type: 'material',
      part_id: part.id,
      sku: part.sku,
      description: part.name,
      quantity: 1,
      unit_cost: part.unit_cost || 0,
      warehouse_id: defaultWarehouseId || '' }
    onUpdate({ ...section, items: [...section.items, newItem] })
  }

  const addManual = () => {
    onUpdate({ ...section, items: [...section.items, {
      _key: Date.now(), line_type: 'material', part_id: null,
      sku: '', description: '', quantity: 1, unit_cost: 0,
      warehouse_id: defaultWarehouseId || '',
    }]})
  }

  const updateItem = (key, updated) => {
    onUpdate({ ...section, items: section.items.map(i => i._key === key ? updated : i) })
  }

  const removeItem = (key) => {
    onUpdate({ ...section, items: section.items.filter(i => i._key !== key) })
  }

  return (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
      {/* Section header */}
      <div style={{ background: 'var(--navy)', padding: 'var(--pad-m) var(--pad-l)', display: 'flex', alignItems: 'center', gap: 'var(--gap-s)' }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <CaretDown size={14} style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
        </button>
        <input
          value={section.title}
          onChange={e => onUpdate({ ...section, title: e.target.value })}
          placeholder="Section name (e.g. Green House Ground Ring)"
          style={{ flex: 1, background: 'transparent', outline: 'none', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', fontFamily: 'var(--font)' }}
        />
        {subtotal > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
            ${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
        <button onClick={onRemove}
          style={{ background: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,0,0,0.5)', display: 'flex' }}>
          <Trash size={13} />
        </button>
      </div>

      {expanded && (
        <div style={{ padding: 'var(--pad-m) var(--pad-l)' }}>
          {/* Column headers */}
          {section.items.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 90px 80px 36px', gap: 'var(--gap-s)', marginBottom: 'var(--mar-s)' }}>
              {['Item / SKU', 'Qty', 'Unit Cost', 'Amount', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', textAlign: i > 0 && i < 4 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
          )}

          {/* Items */}
          {section.items.map(item => (
            <LineItemRow
              key={item._key}
              item={item}
              warehouses={warehouses}
              onUpdate={(updated) => updateItem(item._key, updated)}
              onRemove={() => removeItem(item._key)}
            />
          ))}

          {section.items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--pad-l)', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
              No items yet. Search for a part or add manually.
            </div>
          )}

          {/* Part search */}
          <div style={{ marginTop: 'var(--mar-m)' }}>
            <PartSearch onSelect={addPart} warehouseId={defaultWarehouseId} />
          </div>
          <button onClick={addManual}
            style={{ marginTop: 'var(--mar-s)', display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer', padding: 0 }}>
            <Plus size={12} /> Add custom line item
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Labor section ────────────────────────────────────────────────────────────
function LaborSection({ items, onUpdate }) {
  const [expanded, setExpanded] = useState(true)
  const total = items.reduce((s, i) => s + ((parseFloat(i.quantity)||0) * (parseFloat(i.unit_cost)||0)), 0)

  const addLine = () => onUpdate([...items, { _key: Date.now(), description: 'Installation', quantity: 1, unit_cost: 0 }])
  const updateItem = (key, updated) => onUpdate(items.map(i => i._key === key ? updated : i))
  const removeItem = (key) => onUpdate(items.filter(i => i._key !== key))

  return (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
      <div style={{ background: 'var(--navy)', padding: 'var(--pad-m) var(--pad-l)', display: 'flex', alignItems: 'center', gap: 'var(--gap-s)' }}>
        <button onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', cursor: 'pointer', padding: 0, color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
          <CaretDown size={14} style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
        </button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--gap-s)' }}>
          <Wrench size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
          <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: '#fff' }}>Installation / Labor</span>
        </div>
        {total > 0 && (
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>
            ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
      {expanded && (
        <div style={{ padding: 'var(--pad-m) var(--pad-l)' }}>
          {items.map(item => (
            <div key={item._key} style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 80px 36px', gap: 'var(--gap-s)', alignItems: 'center', marginBottom: 'var(--mar-s)' }}>
              <input value={item.description} onChange={e => updateItem(item._key, { ...item, description: e.target.value })}
                placeholder="Description (e.g. Bolt Install Crew)" style={{ width: '100%', fontSize: 'var(--text-xs)' }} />
              <input type="number" min="0" value={item.quantity} onChange={e => updateItem(item._key, { ...item, quantity: e.target.value })}
                style={{ width: '100%', textAlign: 'right', fontSize: 'var(--text-xs)' }} />
              <input type="number" min="0" step="0.01" value={item.unit_cost} onChange={e => updateItem(item._key, { ...item, unit_cost: e.target.value })}
                placeholder="0.00" style={{ width: '100%', textAlign: 'right', fontSize: 'var(--text-xs)' }} />
              <div style={{ textAlign: 'right', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                ${((parseFloat(item.quantity)||0)*(parseFloat(item.unit_cost)||0)).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}
              </div>
              <button onClick={() => removeItem(item._key)}
                style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--hover)', borderRadius: 'var(--r-m)', cursor: 'pointer', color: 'var(--error-dark)' }}>
                <Trash size={13} />
              </button>
            </div>
          ))}
          <button onClick={addLine}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-3)', background: 'none', cursor: 'pointer', padding: 0, marginTop: 'var(--mar-s)' }}>
            <Plus size={12} /> Add labor line
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Totals bar ───────────────────────────────────────────────────────────────
function TotalsBar({ sections, laborItems }) {
  const materialsTotal = sections.reduce((s, sec) =>
    s + sec.items.reduce((ss, i) => ss + ((parseFloat(i.quantity)||0)*(parseFloat(i.unit_cost)||0)), 0), 0)
  const laborTotal = laborItems.reduce((s, i) => s + ((parseFloat(i.quantity)||0)*(parseFloat(i.unit_cost)||0)), 0)
  const grandTotal = materialsTotal + laborTotal

  if (grandTotal === 0) return null

  return (
    <div style={{ background: 'var(--navy)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l) var(--pad-xl)', marginBottom: 'var(--mar-xl)', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--mar-s)' }}>
        <span style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)' }}>Materials</span>
        <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>${materialsTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
      {laborTotal > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--mar-s)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'rgba(255,255,255,0.6)' }}>Installation</span>
          <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>${laborTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between',  paddingTop: 'var(--pad-s)', marginTop: 'var(--mar-xs)' }}>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>Total</span>
        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 800 }}>${grandTotal.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PONew() {
  const navigate = useNavigate()
  const { user } = useAuth()

  // Header fields
  const [division, setDivision]       = useState('LM')
  const [customerName, setCustomerName] = useState('')
  const [customerAddress, setCustomerAddress] = useState('')
  const [customerCity, setCustomerCity] = useState('')
  const [customerState, setCustomerState] = useState('')
  const [customerZip, setCustomerZip] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [selectedProject, setSelectedProject] = useState(null)
  const [projectName, setProjectName]   = useState('')
  const [projectRef, setProjectRef]     = useState('')
  const [quoteNumber, setQuoteNumber]   = useState('')
  const [poDate, setPoDate]             = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes]               = useState('')
  const [defaultWarehouseId, setDefaultWarehouseId] = useState('')

  // Auto-populate from selected project
  const handleProjectSelect = (proj) => {
    setSelectedProject(proj)
    if (proj) {
      setProjectName(proj.name)
      setProjectRef(proj.job_number || '')
    } else {
      setProjectName('')
      setProjectRef('')
    }
  }

  // Line items
  const [sections, setSections]   = useState([{ _key: Date.now(), title: '', items: [] }])
  const [laborItems, setLaborItems] = useState([])

  // Meta
  const [warehouses, setWarehouses] = useState([])
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState('')

  useEffect(() => {
    db.from('warehouses').select('id, name').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        setWarehouses(data || [])
        if (data?.length) setDefaultWarehouseId(data[0].id)
      })
    // Generate next SO number
    db.from('sales_orders').select('so_number').order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]?.so_number) {
          const match = data[0].so_number.match(/(\d+)$/)
          if (match) {
            const next = parseInt(match[1]) + 1
            setQuoteNumber(`W-${new Date().getFullYear()}-${String(next).padStart(4,'0')}`)
          }
        } else {
          setQuoteNumber(`W-${new Date().getFullYear()}-0001`)
        }
      })
  }, [])

  const addSection = () => {
    setSections(s => [...s, { _key: Date.now(), title: '', items: [] }])
  }

  const updateSection = (key, updated) => {
    setSections(s => s.map(sec => sec._key === key ? updated : sec))
  }

  const removeSection = (key) => {
    setSections(s => s.filter(sec => sec._key !== key))
  }

  const handleSave = async (submitAfter = false) => {
    if (!customerName.trim()) { setError('Customer name is required.'); return }
    setError('')
    setSaving(true)

    const materialsTotal = sections.reduce((s, sec) =>
      s + sec.items.reduce((ss, i) => ss + ((parseFloat(i.quantity)||0)*(parseFloat(i.unit_cost)||0)), 0), 0)
    const installationTotal = laborItems.reduce((s, i) => s + ((parseFloat(i.quantity)||0)*(parseFloat(i.unit_cost)||0)), 0)

    // Generate SO number
    const year = new Date().getFullYear()
    const { count } = await db.from('sales_orders').select('*', { count: 'exact', head: true })
    const poNumber = `SO-${year}-${String((count || 0) + 1).padStart(4, '0')}`

    // Create SO
    const { data: newPO, error: poErr } = await db.from('sales_orders').insert({
      so_number: poNumber,
      quote_number: quoteNumber || null,
      division,
      status: 'queued',
      customer_name: customerName.trim(),
      customer_address: customerAddress || null,
      customer_city: customerCity || null,
      customer_state: customerState || null,
      customer_zip: customerZip || null,
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      project_name: projectName || null,
      project_ref: projectRef || null,
      so_date: poDate || null,
      notes: notes || null,
      materials_total: materialsTotal,
      installation_total: installationTotal,
      grand_total: materialsTotal + installationTotal,
      queued_at: new Date().toISOString() }).select().single()

    if (poErr || !newPO) { setError('Failed to save Sales Order. Please try again.'); setSaving(false); return }

    // Insert line items
    let sortOrder = 0
    for (const sec of sections) {
      for (const item of sec.items) {
        await db.from('so_line_items').insert({
          so_id: newPO.id,
          line_type: 'material',
          section_label: sec.title || null,
          part_id: item.part_id || null,
          warehouse_id: item.warehouse_id || defaultWarehouseId || null,
          sku: item.sku || null,
          description: item.description,
          quantity: parseFloat(item.quantity) || 1,
          unit_cost: parseFloat(item.unit_cost) || 0,
          sort_order: sortOrder++ })
      }
    }

    // Insert labor lines
    for (const item of laborItems) {
      await db.from('so_line_items').insert({
        so_id: newPO.id,
        line_type: 'labor',
        description: item.description,
        quantity: parseFloat(item.quantity) || 1,
        unit_cost: parseFloat(item.unit_cost) || 0,
        sort_order: sortOrder++ })
    }

    await logActivity(db, user?.id, 'warehouse_iq', {
      category:    'sales_order',
      action:      'created',
      label:       `Created Sales Order ${poNumber}`,
      entity_type: 'sales_order',
      entity_id:   newPO.id,
      meta:        { so_number: poNumber, customer: customerName, total: materialsTotal + installationTotal } })
    setSaving(false)
    navigate(`/sales-orders/${newPO.id}`)
  }

  return (
    <div className="page-content fade-in">

      {/* Page header */}
      <div style={{ marginBottom: 'var(--mar-xl)' }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 4 }}>SALES ORDERS</div>
        <div style={{ fontSize: 'var(--text-base)', fontWeight: 800 }}>New Sales Order</div>
      </div>

      {/* Division selector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-xl)' }}>
        {[['LM', 'Lightning Master'], ['Bolt', 'Bolt Lightning']].map(([val, lbl]) => (
          <button key={val} onClick={() => setDivision(val)}
            style={{
              padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', cursor: 'pointer',
              border: `2px solid ${division === val ? 'var(--navy)' : 'var(--border-l)'}`,
              background: division === val ? 'var(--navy)' : 'var(--white)',
              color: division === val ? '#fff' : 'var(--black)',
              fontWeight: 700, fontSize: 'var(--text-sm)',
              transition: 'all 0.15s' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Customer info */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l)', marginBottom: 'var(--mar-l)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--mar-m)' }}>Customer</div>

        <div style={{ marginBottom: 'var(--mar-m)' }}>
          <Label required>Customer Name</Label>
          <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="e.g. GNS Electric Inc" style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 'var(--mar-m)' }}>
          <Label>Street Address</Label>
          <input value={customerAddress} onChange={e => setCustomerAddress(e.target.value)} placeholder="123 Main St" style={{ width: '100%' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 64px 88px', gap: 'var(--gap-s)', marginBottom: 'var(--mar-m)' }}>
          <div><Label>City</Label><input value={customerCity} onChange={e => setCustomerCity(e.target.value)} placeholder="Dallas" style={{ width: '100%' }} /></div>
          <div><Label>State</Label><input value={customerState} onChange={e => setCustomerState(e.target.value)} placeholder="TX" style={{ width: '100%' }} /></div>
          <div><Label>ZIP</Label><input value={customerZip} onChange={e => setCustomerZip(e.target.value)} placeholder="75001" style={{ width: '100%' }} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-s)' }}>
          <div><Label>Phone</Label><input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="(555) 000-0000" style={{ width: '100%' }} /></div>
          <div><Label>Email</Label><input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="name@company.com" style={{ width: '100%' }} /></div>
        </div>
      </div>

      {/* Project info */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l)', marginBottom: 'var(--mar-l)' }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--mar-m)' }}>Project Details</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-s)', marginBottom: 'var(--mar-m)' }}>
          <div>
            <Label>Quote Number</Label>
            <input value={quoteNumber} onChange={e => setQuoteNumber(e.target.value)} placeholder="W9-10-16699" style={{ width: '100%' }} />
          </div>
          <div>
            <Label>Date</Label>
            <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ marginBottom: 'var(--mar-m)' }}>
          <ProjectPicker
            value={selectedProject}
            onChange={handleProjectSelect}
            label="Project / Job"
            required
          />
        </div>

        {selectedProject && (
          <div style={{ marginBottom: 'var(--mar-m)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)' }}>
            <div>
              <Label>Project Name</Label>
              <input value={projectName} onChange={e => setProjectName(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <Label>Job #</Label>
              <input value={projectRef} onChange={e => setProjectRef(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
        )}

        <div>
          <Label>Default Warehouse</Label>
          <select value={defaultWarehouseId} onChange={e => setDefaultWarehouseId(e.target.value)} style={{ width: '100%' }}>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 4 }}>New line items will default to this warehouse. You can change per line.</div>
        </div>
      </div>

      {/* Scope sections */}
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--mar-m)' }}>Line Items</div>

      {sections.map(sec => (
        <ScopeSection
          key={sec._key}
          section={sec}
          warehouses={warehouses}
          defaultWarehouseId={defaultWarehouseId}
          onUpdate={(updated) => updateSection(sec._key, updated)}
          onRemove={() => removeSection(sec._key)}
        />
      ))}

      <button onClick={addSection}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', width: '100%', padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', border: '2px dashed var(--border-l)', background: 'transparent', color: 'var(--text-3)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer', justifyContent: 'center', marginBottom: 'var(--mar-l)' }}>
        <Plus size={15} /> Add Scope Section
      </button>

      {/* Labor */}
      <LaborSection items={laborItems} onUpdate={setLaborItems} />

      {/* Notes */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', padding: 'var(--pad-l)', marginBottom: 'var(--mar-l)' }}>
        <Label>Notes</Label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes for this Sales Order…" rows={3} style={{ width: '100%', resize: 'vertical' }} />
      </div>

      {/* Running total */}
      <TotalsBar sections={sections} laborItems={laborItems} />

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-m)', background: 'var(--error-soft)', borderRadius: 'var(--r-l)', marginBottom: 'var(--mar-l)', color: 'var(--error-dark)', fontSize: 'var(--text-sm)' }}>
          <Warning size={15} />
          {error}
        </div>
      )}

      {/* Save actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--gap-m)', marginBottom: 'var(--mar-xxl)' }}>
        <button onClick={() => handleSave(false)} disabled={saving}
          style={{ padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', background: 'var(--white)', color: 'var(--black)', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
        <button onClick={() => handleSave(true)} disabled={saving}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-m)', borderRadius: 'var(--r-m)', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
          {saving ? 'Saving…' : <><ArrowRight size={15} /> Save & Submit</>}
        </button>
      </div>
    </div>
  )
}

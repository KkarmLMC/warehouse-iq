import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Lightning, Warning, CheckCircle, Buildings,
  Package, ArrowRight, CaretDown, CaretUp, Info
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

// State abbrev → region for proximity scoring
const STATE_REGION = {
  FL:'SE', GA:'SE', SC:'SE', NC:'SE', AL:'SE', MS:'SE', TN:'SE',
  TX:'SC', OK:'SC', LA:'SC', AR:'SC',
  CA:'W',  OR:'W',  WA:'W',  NV:'W',  AZ:'W',
  NY:'NE', NJ:'NE', CT:'NE', MA:'NE', PA:'NE',
  IL:'MW', IN:'MW', OH:'MW', MI:'MW', WI:'MW', MN:'MW',
}

function proximityScore(warehouseState, jobState) {
  if (!jobState) return 0
  if (warehouseState === jobState) return 3
  if (STATE_REGION[warehouseState] && STATE_REGION[warehouseState] === STATE_REGION[jobState]) return 2
  return 1
}

export default function RunOrder() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order,      setOrder]      = useState(null)
  const [lines,      setLines]      = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [levels,     setLevels]     = useState([]) // inventory_levels
  const [computed,   setComputed]   = useState([]) // enriched lines with stock info
  const [loading,    setLoading]    = useState(true)
  const [running,    setRunning]    = useState(false)
  const [pushed,     setPushed]     = useState(false)
  const [hasRun,     setHasRun]     = useState(false)
  const [expandedSplit, setExpandedSplit] = useState({})

  useEffect(() => { load() }, [id])

  const load = async () => {
    const [{ data: o }, { data: li }, { data: wh }, { data: lvl }] = await Promise.all([
      db.from('purchase_orders').select('*').eq('id', id).single(),
      db.from('po_line_items').select('*, parts(id,name,sku,unit_cost)').eq('po_id', id).eq('is_installation', false).order('sort_order'),
      db.from('warehouses').select('*').eq('is_active', true).order('sort_order'),
      db.from('inventory_levels').select('*').order('warehouse_id'),
    ])
    setOrder(o)
    setLines(li || [])
    setWarehouses(wh || [])
    setLevels(lvl || [])
    setHasRun(o?.status === 'running' || o?.status === 'fulfillment')
    // If already run, load existing fulfillment sheet
    if (o?.status === 'running' || o?.status === 'fulfillment') {
      const { data: sheet } = await db.from('fulfillment_sheets').select('*, fulfillment_lines(*)').eq('po_id', id).single()
      if (sheet?.fulfillment_lines) {
        setComputed(sheet.fulfillment_lines)
        setHasRun(true)
      }
    }
    setLoading(false)
  }

  const runOrder = async () => {
    if (running) return
    setRunning(true)

    const jobState = order?.job_state || order?.customer_state
    const jobCity  = order?.job_city  || order?.customer_city

    // Build fulfillment lines from SO line items
    const enriched = (lines || []).map(line => {
      const partId  = line.part_id || line.parts?.id
      const qtyReq  = Number(line.quantity || 0)

      // Find stock across all warehouses for this part
      const stockByWh = warehouses.map(wh => {
        const lvl = levels.find(l => l.part_id === partId && l.warehouse_id === wh.id)
        return { wh, qty: Number(lvl?.quantity_on_hand || 0), proximity: proximityScore(wh.state, jobState) }
      }).sort((a,b) => b.proximity - a.proximity || b.qty - a.qty) // prefer close + well-stocked

      const primaryWh  = stockByWh[0]
      const primaryQty = Math.min(primaryWh?.qty || 0, qtyReq)
      const shortage   = qtyReq - primaryQty

      let splitWh = null, splitQty = 0
      if (shortage > 0) {
        // Find next best warehouse that has stock
        const secondary = stockByWh.find(s => s.wh.id !== primaryWh?.wh.id && s.qty > 0)
        if (secondary) {
          splitWh  = secondary.wh
          splitQty = Math.min(secondary.qty, shortage)
        }
      }

      return {
        po_line_id:        line.id,
        part_id:           partId,
        sku:               line.sku || line.parts?.sku || '',
        description:       line.description || line.parts?.name || 'Unknown Part',
        qty_required:      qtyReq,
        qty_available:     primaryQty,
        qty_shortage:      shortage,
        warehouse_id:      primaryWh?.wh.id || null,
        split_warehouse_id: splitWh?.id || null,
        split_qty:         splitQty,
        is_shortage:       shortage > 0,
        is_confirmed:      false,
        sort_order:        line.sort_order || 0,
        // UI only
        _primaryWhName:   primaryWh?.wh.name || '—',
        _splitWhName:     splitWh?.name || null,
        _remainingShortage: shortage - splitQty,
      }
    })

    setComputed(enriched)

    // Persist: update SO status, create fulfillment sheet + lines
    await db.from('purchase_orders').update({
      status: 'running',
      run_at: new Date().toISOString(),
    }).eq('id', id)

    // Upsert fulfillment sheet
    const { data: sheet } = await db.from('fulfillment_sheets')
      .upsert({ po_id: id }, { onConflict: 'po_id' })
      .select().single()

    if (sheet) {
      // Delete old lines and reinsert
      await db.from('fulfillment_lines').delete().eq('sheet_id', sheet.id)
      const insertLines = enriched.map(({ _primaryWhName, _splitWhName, _remainingShortage, ...l }) => ({
        ...l, sheet_id: sheet.id
      }))
      await db.from('fulfillment_lines').insert(insertLines)
    }

    setHasRun(true)
    setRunning(false)
  }

  const pushToFulfillment = async () => {
    await db.from('purchase_orders').update({
      status: 'fulfillment',
      fulfillment_at: new Date().toISOString(),
    }).eq('id', id)
    setPushed(true)
    setTimeout(() => navigate('/warehouse-hq/queue'), 1200)
  }

  const totalShortages  = computed.filter(l => l.is_shortage).length
  const fullyFulfillable = computed.filter(l => !l.is_shortage).length
  const fmt = (n) => `$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}`

  if (loading) return (
    <div className="page-content fade-in" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-content fade-in">
      {/* Back */}
      <button onClick={() => navigate('/warehouse-hq/queue')}
        style={{ display:'flex',alignItems:'center',gap:6,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--fs-xs)',cursor:'pointer',padding:0,marginBottom:'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back to Queue
      </button>

      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',marginBottom:4 }}>
          <div style={{ fontSize:'var(--fs-2xl)',fontWeight:800 }}>{order?.po_number}</div>
          {order?.status === 'fulfillment' && (
            <span style={{ fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:6,background:'#EFF6FF',color:'#1D4ED8' }}>In Fulfillment</span>
          )}
        </div>
        <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-2)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {(order?.job_city || order?.customer_city) && (
          <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>
            Job location: {order?.job_city || order?.customer_city}, {order?.job_state || order?.customer_state}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--sp-3)',marginBottom:'var(--sp-4)' }}>
        {[
          { label:'ORDER VALUE',  value: fmt(order?.grand_total) },
          { label:'LINE ITEMS',   value: lines.length },
          { label:'DIVISION',     value: order?.division || '—' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__value" style={{ fontFamily:'var(--mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Run button or results */}
      {!hasRun ? (
        <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
          <div className="card-header">
            <span className="card-title"><Lightning size={15} style={{ marginRight:6 }} />Run Order</span>
          </div>
          <div style={{ padding:'var(--sp-5)', textAlign:'center' }}>
            <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-2)',marginBottom:'var(--sp-4)',maxWidth:400,margin:'0 auto var(--sp-4)' }}>
              Running the order will calculate all parts needed, check stock across warehouses, and generate the fulfillment sheet. No inventory is deducted at this stage.
            </div>
            <button onClick={runOrder} disabled={running}
              style={{ padding:'var(--sp-3) var(--sp-6)',borderRadius:'var(--r-xl)',border:'none',background:'var(--navy)',color:'#fff',fontWeight:700,fontSize:'var(--fs-sm)',cursor:'pointer',fontFamily:'var(--font)',display:'inline-flex',alignItems:'center',gap:'var(--sp-2)' }}>
              {running ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Calculating…</> : <><Lightning size={16} weight="fill" /> Run Order</>}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Stock summary banner */}
          {totalShortages > 0 ? (
            <div style={{ background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:'var(--r-xl)',padding:'var(--sp-3) var(--sp-4)',marginBottom:'var(--sp-4)',display:'flex',alignItems:'center',gap:'var(--sp-3)' }}>
              <Warning size={18} weight="fill" style={{ color:'var(--error)',flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,color:'#991B1B' }}>{totalShortages} part{totalShortages!==1?'s':''} with stock shortage</div>
                <div style={{ fontSize:11,color:'#B91C1C' }}>Review red-line items below. Split fulfillment suggestions have been applied where possible.</div>
              </div>
            </div>
          ) : (
            <div style={{ background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:'var(--r-xl)',padding:'var(--sp-3) var(--sp-4)',marginBottom:'var(--sp-4)',display:'flex',alignItems:'center',gap:'var(--sp-3)' }}>
              <CheckCircle size={18} weight="fill" style={{ color:'var(--success-text)',flexShrink:0 }} />
              <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,color:'#15803D' }}>All {computed.length} parts are fully in stock — ready to fulfill</div>
            </div>
          )}

          {/* Fulfillment sheet */}
          <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
            <div className="card-header">
              <span className="card-title"><Package size={15} style={{ marginRight:6 }} />Fulfillment Sheet</span>
              <span style={{ fontSize:11,color:'rgba(255,255,255,0.55)' }}>{computed.length} parts</span>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 60px 60px 60px',gap:8,padding:'var(--sp-2) var(--sp-4)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-l)' }}>
              {['Part','Req','Avail','Short'].map(h => (
                <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase' }}>{h}</div>
              ))}
            </div>

            {computed.map((line, idx) => {
              const isShortage = line.is_shortage
              const splitOpen  = expandedSplit[idx]
              return (
                <div key={idx} style={{ borderBottom: idx < computed.length-1 ? '1px solid var(--border-l)' : 'none',
                  background: isShortage ? '#FEF2F2' : 'transparent' }}>
                  {/* Main row */}
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 60px 60px 60px',gap:8,padding:'var(--sp-3) var(--sp-4)',alignItems:'start' }}>
                    <div>
                      <div style={{ fontSize:'var(--fs-xs)',fontWeight:600,color: isShortage ? '#991B1B' : 'var(--text-1)' }}>{line.description}</div>
                      {line.sku && <div style={{ fontSize:10,color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
                      <div style={{ fontSize:10,color: isShortage ? '#DC2626' : 'var(--text-3)',marginTop:2 }}>
                        {line._primaryWhName || line.warehouse_id}
                        {line.split_warehouse_id && <span style={{ marginLeft:4,color:'#D97706' }}>+ split</span>}
                      </div>
                      {/* Split info toggle */}
                      {isShortage && (
                        <button onClick={() => setExpandedSplit(p => ({ ...p, [idx]: !p[idx] }))}
                          style={{ fontSize:10,color:'#1D4ED8',border:'none',background:'none',cursor:'pointer',padding:'2px 0',display:'flex',alignItems:'center',gap:2,fontFamily:'var(--font)' }}>
                          {splitOpen ? <CaretUp size={10}/> : <CaretDown size={10}/>}
                          {line.split_warehouse_id ? 'Split details' : 'No split available'}
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--mono)',color:'var(--text-1)' }}>{line.qty_required}</div>
                    <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--mono)',color: isShortage ? '#DC2626' : 'var(--success-text)' }}>{line.qty_available}</div>
                    <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--mono)',color: isShortage ? '#DC2626' : 'var(--text-3)' }}>
                      {line.qty_shortage > 0 ? line.qty_shortage : '—'}
                    </div>
                  </div>
                  {/* Split detail panel */}
                  {splitOpen && isShortage && (
                    <div style={{ margin:'0 var(--sp-4) var(--sp-3)',padding:'var(--sp-3)',background:'#FFF7ED',borderRadius:'var(--r-lg)',border:'1px solid #FED7AA' }}>
                      <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'#92400E',marginBottom:8 }}>Split Fulfillment Plan</div>
                      <div style={{ fontSize:'var(--fs-xs)',color:'#78350F' }}>
                        <div style={{ marginBottom:4 }}>
                          Primary: <strong>{line._primaryWhName || '—'}</strong> → pull {line.qty_available} of {line.qty_required}
                        </div>
                        {line.split_warehouse_id ? (
                          <div style={{ marginBottom:4 }}>
                            Secondary: <strong>{line._splitWhName || line.split_warehouse_id}</strong> → pull {line.split_qty}
                          </div>
                        ) : (
                          <div style={{ color:'#DC2626' }}>No secondary warehouse has stock for this part.</div>
                        )}
                        {(line._remainingShortage || 0) > 0 && (
                          <div style={{ color:'#DC2626',marginTop:4 }}>
                            ⚠ Still {line._remainingShortage} units unaccounted for — manual action required.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Push to Fulfillment */}
          {order?.status !== 'fulfillment' && (
            <button onClick={pushToFulfillment} disabled={pushed}
              style={{ width:'100%',padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',
                background: pushed ? 'var(--success-text)' : 'var(--navy)',
                color:'#fff',fontWeight:700,fontSize:'var(--fs-sm)',cursor:'pointer',fontFamily:'var(--font)',
                display:'flex',alignItems:'center',justifyContent:'center',gap:'var(--sp-2)' }}>
              {pushed ? <><CheckCircle size={16} weight="fill" /> Sent to Fulfillment</> : <>Push to Fulfillment <ArrowRight size={16} /></>}
            </button>
          )}

          {order?.status === 'fulfillment' && (
            <div style={{ textAlign:'center',padding:'var(--sp-4)',color:'var(--text-3)',fontSize:'var(--fs-sm)' }}>
              ✓ This order is with the fulfillment team
            </div>
          )}
        </>
      )}
    </div>
  )
}

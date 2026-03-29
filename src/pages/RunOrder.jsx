import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Lightning, Warning, CheckCircle,
  Package, ArrowRight, CaretDown, CaretUp,
  ClockCountdown, SealWarning, Question,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

// State abbreviation → region for proximity scoring
const STATE_REGION = {
  FL:'SE', GA:'SE', SC:'SE', NC:'SE', AL:'SE', MS:'SE', TN:'SE',
  TX:'SC', OK:'SC', LA:'SC', AR:'SC',
  CA:'W',  OR:'W',  WA:'W',  NV:'W',  AZ:'W',
  NY:'NE', NJ:'NE', CT:'NE', MA:'NE', PA:'NE',
  IL:'MW', IN:'MW', OH:'MW', MI:'MW', WI:'MW', MN:'MW',
}
function proximityScore(whState, jobState) {
  if (!jobState) return 0
  if (whState === jobState) return 3
  if (STATE_REGION[whState] && STATE_REGION[whState] === STATE_REGION[jobState]) return 2
  return 1
}

// Normalise kit SKUs for matching (trim, uppercase, remove trailing spaces)
function normalise(s) { return (s||'').trim().toUpperCase() }

export default function RunOrder() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [order,       setOrder]       = useState(null)
  const [lines,       setLines]       = useState([])
  const [warehouses,  setWarehouses]  = useState([])
  const [levels,      setLevels]      = useState([])
  const [kits,        setKits]        = useState([]) // canonical kit definitions
  const [computed,    setComputed]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [running,     setRunning]     = useState(false)
  const [pushed,      setPushed]      = useState(false)
  const [hasRun,      setHasRun]      = useState(false)
  const [expandedSplit, setExpandedSplit] = useState({})
  const [backOrdered, setBackOrdered] = useState({}) // lineIdx → bool
  const [backNotes,   setBackNotes]   = useState({}) // lineIdx → note

  // Kit change confirmation state
  const [kitChanges,       setKitChanges]       = useState([]) // lines with changed descriptions
  const [kitConfirmations, setKitConfirmations] = useState({}) // lineIdx → 'accept'|'reject'|null
  const [showKitModal,     setShowKitModal]      = useState(false)
  const [kitModalIdx,      setKitModalIdx]       = useState(null)

  useEffect(() => { load() }, [id])

  const load = async () => {
    const [{ data: o }, { data: li }, { data: wh }, { data: lvl }, { data: kt }] = await Promise.all([
      db.from('sales_orders').select('*').eq('id', id).single(),
      db.from('so_line_items').select('*, parts(id,name,sku,unit_cost)').eq('so_id', id).eq('is_installation', false).order('sort_order'),
      db.from('warehouses').select('*').eq('is_active', true).order('sort_order'),
      db.from('inventory_levels').select('*'),
      db.from('kits').select('*').eq('is_active', true),
    ])
    setOrder(o)
    setLines(li || [])
    setWarehouses(wh || [])
    setLevels(lvl || [])
    setKits(kt || [])
    setHasRun(o?.status === 'running' || o?.status === 'fulfillment')
    if (o?.status === 'running' || o?.status === 'fulfillment') {
      const { data: sheet } = await db.from('fulfillment_sheets').select('*, fulfillment_lines(*)').eq('so_id', id).single()
      if (sheet?.fulfillment_lines) {
        setComputed(sheet.fulfillment_lines)
      }
    }
    setLoading(false)
  }

  // ── Step 1: Run — build enriched lines ────────────────────────────────────
  const runOrder = async () => {
    if (running) return
    setRunning(true)

    const jobState = order?.job_state || order?.customer_state
    const kitMap   = new Map(kits.map(k => [normalise(k.sku), k]))

    const enriched = (lines || []).map(line => {
      const partId = line.part_id || line.parts?.id
      const qtyReq = Number(line.quantity || 0)
      const sku    = (line.sku || line.parts?.sku || '').trim()

      // Kit detection: match SKU against canonical kits table
      const canonicalKit = kitMap.get(normalise(sku))
      const isKit = !!canonicalKit
      const soDesc = (line.description || '').trim()
      const canonicalDesc = canonicalKit?.canonical_description || ''
      const descChanged = isKit && normalise(soDesc) !== normalise(canonicalDesc)

      // Stock check across warehouses
      const stockByWh = warehouses.map(wh => {
        const lvl = levels.find(l => l.part_id === partId && l.warehouse_id === wh.id)
        return { wh, qty: Number(lvl?.quantity_on_hand || 0), proximity: proximityScore(wh.state, jobState) }
      }).sort((a,b) => b.proximity - a.proximity || b.qty - a.qty)

      const primaryWh  = stockByWh[0]
      const primaryQty = Math.min(primaryWh?.qty || 0, qtyReq)
      const shortage   = qtyReq - primaryQty

      let splitWh = null, splitQty = 0
      if (shortage > 0) {
        const secondary = stockByWh.find(s => s.wh.id !== primaryWh?.wh.id && s.qty > 0)
        if (secondary) {
          splitWh  = secondary.wh
          splitQty = Math.min(secondary.qty, shortage)
        }
      }

      const remainingAfterSplit = shortage - splitQty

      return {
        so_line_id:                 line.id,
        part_id:                    partId,
        sku,
        description:                soDesc || line.parts?.name || 'Unknown Part',
        qty_required:               qtyReq,
        qty_available:              primaryQty,
        qty_shortage:               shortage,
        warehouse_id:               primaryWh?.wh.id || null,
        split_warehouse_id:         splitWh?.id || null,
        split_qty:                  splitQty,
        is_shortage:                shortage > 0,
        is_back_ordered:            false,
        back_order_qty:             0,
        is_kit:                     isKit,
        kit_id:                     canonicalKit?.id || null,
        kit_description_changed:    descChanged,
        kit_original_description:   descChanged ? soDesc : null,
        kit_canonical_description:  descChanged ? canonicalDesc : null,
        kit_change_confirmed:       false,
        is_confirmed:               false,
        sort_order:                 line.sort_order || 0,
        // UI-only helpers
        _primaryWhName:             primaryWh?.wh.name || '—',
        _splitWhName:               splitWh?.name || null,
        _remainingShortage:         remainingAfterSplit,
        _kitName:                   canonicalKit?.name || null,
      }
    })

    setComputed(enriched)

    // Check if any kits have changed descriptions → require confirmation before proceeding
    const changed = enriched.map((l, idx) => ({ ...l, _idx: idx })).filter(l => l.kit_description_changed)
    setKitChanges(changed)

    // Initialise confirmations as null (unconfirmed)
    const initConf = {}
    changed.forEach(l => { initConf[l._idx] = null })
    setKitConfirmations(initConf)

    setRunning(false)
    setHasRun(true)
  }

  // All kit changes must be confirmed before we can save/push
  const allKitsConfirmed = kitChanges.length === 0 ||
    kitChanges.every(l => kitConfirmations[l._idx] !== null)

  const handleKitConfirm = (lineIdx, action) => {
    setKitConfirmations(p => ({ ...p, [lineIdx]: action }))
    // If reject, revert description to canonical
    if (action === 'reject') {
      setComputed(prev => prev.map((l, i) => {
        if (i !== lineIdx) return l
        return { ...l, description: l.kit_canonical_description, kit_change_confirmed: false }
      }))
    } else {
      setComputed(prev => prev.map((l, i) => {
        if (i !== lineIdx) return l
        return { ...l, kit_change_confirmed: true, kit_change_confirmed_by: 'manager' }
      }))
    }
    setShowKitModal(false)
  }

  // ── Toggle back order on a line ───────────────────────────────────────────
  const toggleBackOrder = (lineIdx) => {
    setBackOrdered(p => ({ ...p, [lineIdx]: !p[lineIdx] }))
    // Update computed line
    setComputed(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l
      const nowBO = !backOrdered[lineIdx]
      return {
        ...l,
        is_back_ordered: nowBO,
        back_order_qty:  nowBO ? l._remainingShortage : 0,
      }
    }))
  }

  // ── Save + push to fulfillment ─────────────────────────────────────────────
  const pushToFulfillment = async () => {
    if (!allKitsConfirmed) return
    setPushed(true)

    // Persist: update SO + create/update fulfillment sheet
    await db.from('sales_orders').update({
      status:       'running',
      run_at:       new Date().toISOString(),
    }).eq('id', id)

    const { data: sheet } = await db.from('fulfillment_sheets')
      .upsert({ so_id: id }, { onConflict: 'so_id' })
      .select().single()

    if (sheet) {
      await db.from('fulfillment_lines').delete().eq('sheet_id', sheet.id)
      const insertLines = computed.map(({
        _primaryWhName, _splitWhName, _remainingShortage, _kitName, _idx, ...l
      }) => ({ ...l, sheet_id: sheet.id }))
      await db.from('fulfillment_lines').insert(insertLines)
    }

    await db.from('sales_orders').update({
      status:          'fulfillment',
      fulfillment_at:  new Date().toISOString(),
    }).eq('id', id)

    setTimeout(() => navigate('/warehouse-hq/queue'), 1200)
  }

  // ── Derived counts ─────────────────────────────────────────────────────────
  const totalShortages = computed.filter(l => l.is_shortage).length
  const totalKitChanges = kitChanges.length
  const unconfirmedKits = kitChanges.filter(l => kitConfirmations[l._idx] === null).length
  const fmt = n => `$${Number(n||0).toLocaleString('en-US',{maximumFractionDigits:0})}`

  if (loading) return (
    <div className="page-content fade-in" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh' }}>
      <div className="spinner" />
    </div>
  )

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/queue')}
        style={{ display:'flex',alignItems:'center',gap:6,border:'none',background:'none',color:'var(--text-3)',fontSize:'var(--fs-xs)',cursor:'pointer',padding:0,marginBottom:'var(--sp-3)' }}>
        <ArrowLeft size={14} /> Back to Queue
      </button>

      {/* Order header */}
      <div style={{ marginBottom:'var(--sp-5)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',marginBottom:4 }}>
          <div style={{ fontSize:'var(--fs-2xl)',fontWeight:800 }}>{order?.so_number}</div>
          {order?.status === 'fulfillment' && (
            <span style={{ fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:6,background:'#EFF6FF',color:'#1D4ED8' }}>In Fulfillment</span>
          )}
        </div>
        <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-2)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {(order?.job_city || order?.customer_city) && (
          <div style={{ fontSize:11,color:'var(--text-3)',marginTop:2 }}>
            Job location: {order?.job_city||order?.customer_city}, {order?.job_state||order?.customer_state}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--sp-3)',marginBottom:'var(--sp-4)' }}>
        {[
          { label:'ORDER VALUE', value: fmt(order?.grand_total) },
          { label:'LINE ITEMS',  value: lines.length },
          { label:'DIVISION',    value: order?.division || '—' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-card__label">{s.label}</div>
            <div className="stat-card__value" style={{ fontFamily:'var(--mono)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Pre-run state ── */}
      {!hasRun && (
        <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
          <div className="card-header">
            <span className="card-title"><Lightning size={15} style={{ marginRight:6 }} />Run Order</span>
          </div>
          <div style={{ padding:'var(--sp-5)',textAlign:'center' }}>
            <div style={{ fontSize:'var(--fs-sm)',color:'var(--text-2)',marginBottom:'var(--sp-4)',maxWidth:420,margin:'0 auto var(--sp-4)' }}>
              Running calculates all parts needed, checks stock across warehouses, validates kit descriptions against canonical definitions, and generates the fulfillment sheet. No inventory is deducted at this stage.
            </div>
            <button onClick={runOrder} disabled={running}
              style={{ padding:'var(--sp-3) var(--sp-6)',borderRadius:'var(--r-xl)',border:'none',background:'var(--navy)',color:'#fff',fontWeight:700,fontSize:'var(--fs-sm)',cursor:'pointer',fontFamily:'var(--font)',display:'inline-flex',alignItems:'center',gap:'var(--sp-2)' }}>
              {running
                ? <><div className="spinner" style={{ width:16,height:16,borderWidth:2 }} /> Calculating…</>
                : <><Lightning size={16} weight="fill" /> Run Order</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Post-run state ── */}
      {hasRun && (
        <>
          {/* ── Kit change hard-stop banner ── */}
          {unconfirmedKits > 0 && (
            <div style={{ background:'#FFFBEB',border:'2px solid #F59E0B',borderRadius:'var(--r-xl)',padding:'var(--sp-4)',marginBottom:'var(--sp-4)' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-3)',marginBottom:'var(--sp-3)' }}>
                <SealWarning size={22} weight="fill" style={{ color:'#D97706',flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:'var(--fs-sm)',fontWeight:800,color:'#92400E' }}>
                    Kit Description Change Detected — Review Required
                  </div>
                  <div style={{ fontSize:11,color:'#B45309',marginTop:2 }}>
                    {unconfirmedKits} kit{unconfirmedKits!==1?'s':''} on this order have descriptions that differ from the canonical definition in the system. You must confirm or reject each change before pushing to fulfillment.
                  </div>
                </div>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:'var(--sp-2)' }}>
                {kitChanges.filter(l => kitConfirmations[l._idx] === null).map(line => (
                  <div key={line._idx} style={{ padding:'var(--sp-3)',background:'rgba(255,255,255,0.7)',borderRadius:'var(--r-lg)',border:'1px solid #FCD34D' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--sp-3)' }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'#92400E' }}>{line.description}</div>
                        <div style={{ fontSize:10,color:'#B45309',fontFamily:'var(--mono)',marginTop:2 }}>{line.sku}</div>
                      </div>
                      <button onClick={() => { setKitModalIdx(line._idx); setShowKitModal(true) }}
                        style={{ flexShrink:0,padding:'var(--sp-2) var(--sp-3)',borderRadius:'var(--r-lg)',border:'none',background:'var(--amber)',color:'#fff',fontWeight:700,fontSize:'var(--fs-xs)',cursor:'pointer',fontFamily:'var(--font)' }}>
                        Review
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Already-confirmed kit changes (informational) ── */}
          {kitChanges.filter(l => kitConfirmations[l._idx] !== null).map(line => (
            <div key={line._idx} style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',padding:'var(--sp-2) var(--sp-3)',background: kitConfirmations[line._idx]==='accept' ? '#F0FDF4' : '#F1F5F9',borderRadius:'var(--r-lg)',marginBottom:'var(--sp-2)',fontSize:11 }}>
              {kitConfirmations[line._idx]==='accept'
                ? <CheckCircle size={13} weight="fill" style={{ color:'var(--success-text)',flexShrink:0 }} />
                : <CheckCircle size={13} weight="fill" style={{ color:'var(--text-3)',flexShrink:0 }} />}
              <span style={{ color:'var(--text-2)' }}>
                <strong>{line.sku}</strong> — kit change {kitConfirmations[line._idx]==='accept' ? 'accepted (modified description will go to fulfillment)' : 'rejected (reverted to canonical description)'}
              </span>
            </div>
          ))}

          {/* ── Stock summary ── */}
          {totalShortages > 0 ? (
            <div style={{ background:'#FEF2F2',border:'1px solid #FCA5A5',borderRadius:'var(--r-xl)',padding:'var(--sp-3) var(--sp-4)',marginBottom:'var(--sp-4)',display:'flex',alignItems:'center',gap:'var(--sp-3)' }}>
              <Warning size={18} weight="fill" style={{ color:'var(--error)',flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,color:'#991B1B' }}>{totalShortages} part{totalShortages!==1?'s':''} with stock shortage</div>
                <div style={{ fontSize:11,color:'#B91C1C' }}>Review red lines. Use split fulfillment or mark as back order.</div>
              </div>
            </div>
          ) : (
            <div style={{ background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:'var(--r-xl)',padding:'var(--sp-3) var(--sp-4)',marginBottom:'var(--sp-4)',display:'flex',alignItems:'center',gap:'var(--sp-3)' }}>
              <CheckCircle size={18} weight="fill" style={{ color:'var(--success-text)',flexShrink:0 }} />
              <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,color:'#15803D' }}>All {computed.length} parts are in stock</div>
            </div>
          )}

          {/* ── Fulfillment sheet ── */}
          <div className="card" style={{ marginBottom:'var(--sp-4)' }}>
            <div className="card-header">
              <span className="card-title"><Package size={15} style={{ marginRight:6 }} />Fulfillment Sheet</span>
              <span style={{ fontSize:11,color:'rgba(255,255,255,0.55)' }}>{computed.length} parts</span>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 52px 52px 52px',gap:8,padding:'var(--sp-2) var(--sp-4)',background:'var(--surface-raised)',borderBottom:'1px solid var(--border-l)' }}>
              {['Part','Req','Avail','Short'].map(h => (
                <div key={h} style={{ fontSize:10,fontWeight:700,color:'var(--text-3)',textTransform:'uppercase' }}>{h}</div>
              ))}
            </div>

            {computed.map((line, idx) => {
              const isShortage = line.is_shortage
              const isBO       = backOrdered[idx] || line.is_back_ordered
              const splitOpen  = expandedSplit[idx]
              const kitChanged = line.kit_description_changed
              const conf       = kitConfirmations[line._idx ?? idx]

              return (
                <div key={idx} style={{ borderBottom: idx < computed.length-1 ? '1px solid var(--border-l)' : 'none',
                  background: isBO ? '#ECFEFF' : isShortage ? '#FEF2F2' : kitChanged ? '#FFFBEB' : 'transparent' }}>

                  {/* Kit change badge */}
                  {kitChanged && (
                    <div style={{ padding:'4px var(--sp-4)',background:'#FEF3C7',fontSize:10,fontWeight:700,color:'#92400E',display:'flex',alignItems:'center',gap:4 }}>
                      <SealWarning size={11} /> Kit description modified by sales
                      {conf === 'accept' && <span style={{ color:'#15803D',marginLeft:4 }}>✓ Accepted</span>}
                      {conf === 'reject' && <span style={{ color:'var(--text-3)',marginLeft:4 }}>✓ Reverted to canonical</span>}
                    </div>
                  )}

                  {/* Main row */}
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 52px 52px 52px',gap:8,padding:'var(--sp-3) var(--sp-4)',alignItems:'start' }}>
                    <div>
                      <div style={{ fontSize:'var(--fs-xs)',fontWeight:600,
                        color: isBO ? '#0891B2' : isShortage ? '#991B1B' : 'var(--text-1)' }}>
                        {line.description}
                        {line.is_kit && <span style={{ marginLeft:6,fontSize:9,fontWeight:700,padding:'1px 4px',borderRadius:3,background:'#EFF6FF',color:'#1D4ED8' }}>KIT</span>}
                        {isBO && <span style={{ marginLeft:6,fontSize:9,fontWeight:700,padding:'1px 4px',borderRadius:3,background:'#ECFEFF',color:'#0891B2' }}>B/O</span>}
                      </div>
                      {line.sku && <div style={{ fontSize:10,color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
                      <div style={{ fontSize:10,marginTop:2 }}>
                        <span style={{ fontWeight:600,color:'var(--navy)' }}>{line._primaryWhName || line.warehouse_id || '—'}</span>
                        {line.split_warehouse_id && !isBO && (
                          <span style={{ marginLeft:4,color:'#D97706',fontWeight:600 }}>+ split ({line._splitWhName || 'other'})</span>
                        )}
                      </div>

                      {/* Shortage actions */}
                      {isShortage && !isBO && (
                        <div style={{ display:'flex',gap:'var(--sp-2)',marginTop:6,flexWrap:'wrap' }}>
                          {line.split_warehouse_id && (
                            <button onClick={() => setExpandedSplit(p => ({ ...p, [idx]: !p[idx] }))}
                              style={{ fontSize:10,padding:'2px 8px',borderRadius:4,border:'1px solid #D97706',background:'transparent',cursor:'pointer',color:'#D97706',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:3 }}>
                              {splitOpen ? <CaretUp size={9}/> : <CaretDown size={9}/>} Split details
                            </button>
                          )}
                          <button onClick={() => toggleBackOrder(idx)}
                            style={{ fontSize:10,padding:'2px 8px',borderRadius:4,border:'1px solid #0891B2',background:'transparent',cursor:'pointer',color:'#0891B2',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:3 }}>
                            <ClockCountdown size={10} /> Mark back order
                          </button>
                        </div>
                      )}

                      {/* Back order cancel */}
                      {isBO && (
                        <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',marginTop:6 }}>
                          <span style={{ fontSize:10,color:'#0891B2' }}>Back ordering {line.back_order_qty || line._remainingShortage} units</span>
                          <button onClick={() => toggleBackOrder(idx)}
                            style={{ fontSize:10,padding:'1px 6px',borderRadius:4,border:'1px solid var(--border-l)',background:'transparent',cursor:'pointer',color:'var(--text-3)',fontFamily:'var(--font)' }}>
                            Cancel B/O
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--mono)',color:'var(--text-1)' }}>{line.qty_required}</div>
                    <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--mono)',
                      color: isBO ? '#0891B2' : isShortage ? '#DC2626' : 'var(--success-text)' }}>
                      {line.qty_available}
                    </div>
                    <div style={{ fontSize:'var(--fs-sm)',fontWeight:700,fontFamily:'var(--mono)',
                      color: isBO ? '#0891B2' : isShortage ? '#DC2626' : 'var(--text-3)' }}>
                      {line.qty_shortage > 0 ? line.qty_shortage : '—'}
                    </div>
                  </div>

                  {/* Split detail panel */}
                  {splitOpen && isShortage && !isBO && (
                    <div style={{ margin:'0 var(--sp-4) var(--sp-3)',padding:'var(--sp-3)',background:'#FFF7ED',borderRadius:'var(--r-lg)',border:'1px solid #FED7AA' }}>
                      <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'#92400E',marginBottom:8 }}>Split Fulfillment Plan</div>
                      <div style={{ fontSize:'var(--fs-xs)',color:'#78350F',lineHeight:1.6 }}>
                        <div>Primary: <strong>{line._primaryWhName||'—'}</strong> → pull {line.qty_available} of {line.qty_required}</div>
                        {line.split_warehouse_id
                          ? <div>Secondary: <strong>{line._splitWhName||line.split_warehouse_id}</strong> → pull {line.split_qty}</div>
                          : <div style={{ color:'#DC2626' }}>No secondary warehouse has stock.</div>
                        }
                        {(line._remainingShortage||0) > 0 && (
                          <div style={{ color:'#DC2626',marginTop:4 }}>
                            ⚠ Still {line._remainingShortage} units short — consider marking as back order.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Push to fulfillment */}
          {order?.status !== 'fulfillment' && (
            <>
              {unconfirmedKits > 0 && (
                <div style={{ fontSize:11,color:'#D97706',fontWeight:700,textAlign:'center',marginBottom:'var(--sp-3)',padding:'var(--sp-2)',background:'#FFFBEB',borderRadius:'var(--r-lg)',border:'1px solid #FCD34D' }}>
                  ⚠ Confirm all {unconfirmedKits} kit change{unconfirmedKits!==1?'s':''} above before pushing to fulfillment
                </div>
              )}
              <button onClick={pushToFulfillment} disabled={!allKitsConfirmed || pushed}
                style={{ width:'100%',padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',
                  background: pushed ? 'var(--success-text)' : !allKitsConfirmed ? 'var(--border)' : 'var(--navy)',
                  color: !allKitsConfirmed ? 'var(--text-3)' : '#fff',
                  fontWeight:700,fontSize:'var(--fs-sm)',
                  cursor: allKitsConfirmed && !pushed ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'var(--sp-2)' }}>
                {pushed
                  ? <><CheckCircle size={16} weight="fill" /> Sent to Fulfillment</>
                  : !allKitsConfirmed
                    ? 'Confirm kit changes first'
                    : <>Push to Fulfillment <ArrowRight size={16} /></>}
              </button>
            </>
          )}

          {order?.status === 'fulfillment' && (
            <div style={{ textAlign:'center',padding:'var(--sp-4)',color:'var(--text-3)',fontSize:'var(--fs-sm)' }}>
              ✓ This order is with the fulfillment team
            </div>
          )}
        </>
      )}

      {/* ── Kit change confirmation modal ── */}
      {showKitModal && kitModalIdx !== null && (() => {
        const line = computed[kitModalIdx]
        if (!line) return null
        return (
          <>
            <div onClick={() => setShowKitModal(false)}
              style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',zIndex:299 }} />
            <div style={{ position:'fixed',bottom:0,left:0,right:0,zIndex:300,background:'var(--bg)',
              borderRadius:'var(--r-2xl) var(--r-2xl) 0 0',padding:'var(--sp-5)',
              boxShadow:'0 -4px 24px rgba(0,0,0,0.2)',maxHeight:'80vh',overflowY:'auto' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'var(--sp-2)',marginBottom:'var(--sp-4)' }}>
                <SealWarning size={20} weight="fill" style={{ color:'#D97706' }} />
                <div style={{ fontSize:'var(--fs-lg)',fontWeight:800 }}>Kit Description Changed</div>
              </div>

              <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4 }}>
                {line.sku} — {line._kitName}
              </div>

              <div style={{ marginBottom:'var(--sp-4)' }}>
                <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'#D97706',marginBottom:6 }}>
                  Description on this Sales Order:
                </div>
                <div style={{ padding:'var(--sp-3)',background:'#FFFBEB',borderRadius:'var(--r-lg)',border:'1px solid #FCD34D',fontSize:'var(--fs-sm)',color:'#92400E',lineHeight:1.6 }}>
                  {line.kit_original_description || line.description}
                </div>
              </div>

              <div style={{ marginBottom:'var(--sp-5)' }}>
                <div style={{ fontSize:'var(--fs-xs)',fontWeight:700,color:'var(--navy)',marginBottom:6 }}>
                  Canonical description on file (QB default):
                </div>
                <div style={{ padding:'var(--sp-3)',background:'var(--surface-raised)',borderRadius:'var(--r-lg)',border:'1px solid var(--border-l)',fontSize:'var(--fs-sm)',color:'var(--text-2)',lineHeight:1.6 }}>
                  {line.kit_canonical_description}
                </div>
              </div>

              <div style={{ fontSize:11,color:'var(--text-3)',marginBottom:'var(--sp-4)',lineHeight:1.5 }}>
                Sales may have customised this kit for the customer. Accept to use the modified description for fulfillment, or reject to revert to the canonical definition.
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--sp-3)' }}>
                <button onClick={() => handleKitConfirm(kitModalIdx, 'reject')}
                  style={{ padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'1px solid var(--border-l)',background:'var(--surface-raised)',fontWeight:700,fontSize:'var(--fs-sm)',cursor:'pointer',fontFamily:'var(--font)',color:'var(--text-2)' }}>
                  Reject — Revert to canonical
                </button>
                <button onClick={() => handleKitConfirm(kitModalIdx, 'accept')}
                  style={{ padding:'var(--sp-3)',borderRadius:'var(--r-xl)',border:'none',background:'var(--amber)',color:'#fff',fontWeight:700,fontSize:'var(--fs-sm)',cursor:'pointer',fontFamily:'var(--font)' }}>
                  Accept — Use modified description
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

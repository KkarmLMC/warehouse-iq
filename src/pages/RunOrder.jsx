import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Lightning, Warning, CheckCircle,
  Package, ArrowRight, CaretDown, CaretUp,
  ClockCountdown, SealWarning, Question } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'

// State abbreviation → region for proximity scoring
const STATE_REGION = {
  FL:'SE', GA:'SE', SC:'SE', NC:'SE', AL:'SE', MS:'SE', TN:'SE',
  TX:'SC', OK:'SC', LA:'SC', AR:'SC',
  CA:'W',  OR:'W',  WA:'W',  NV:'W',  AZ:'W',
  NY:'NE', NJ:'NE', CT:'NE', MA:'NE', PA:'NE',
  IL:'MW', IN:'MW', OH:'MW', MI:'MW', WI:'MW', MN:'MW' }
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
  const { user } = useAuth()

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
    // For back_ordered: load existing sheet to show what was already fulfilled
    // Staff will re-run only the back-ordered lines
    if (o?.status === 'running' || o?.status === 'fulfillment' || o?.status === 'back_ordered') {
      const { data: sheet } = await db.from('fulfillment_sheets').select('*, fulfillment_lines(*)').eq('so_id', id).single()
      if (sheet?.fulfillment_lines) {
        setComputed(sheet.fulfillment_lines)
        // For back_ordered, only re-run the BO lines — filter SO lines to just those
        if (o?.status === 'back_ordered') {
          const boLineIds = new Set(sheet.fulfillment_lines.filter(l => l.is_back_ordered).map(l => l.so_line_id))
          setLines((li || []).filter(l => boLineIds.has(l.id)))
        }
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
        _kitName:                   canonicalKit?.name || null }
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
        back_order_qty:  nowBO ? l._remainingShortage : 0 }
    }))
  }

  // ── Save + push to fulfillment ─────────────────────────────────────────────
  const pushToFulfillment = async () => {
    if (!allKitsConfirmed) return
    setPushed(true)

    const isBackOrderRerun = order?.status === 'back_ordered'

    // Persist: update SO + create/update fulfillment sheet
    await db.from('sales_orders').update({
      status:       'running',
      run_at:       new Date().toISOString() }).eq('id', id)

    const { data: sheet } = await db.from('fulfillment_sheets')
      .upsert({ so_id: id }, { onConflict: 'so_id' })
      .select().single()

    if (sheet) {
      if (isBackOrderRerun) {
        // Only replace the back-ordered lines — leave previously confirmed lines intact
        await db.from('fulfillment_lines')
          .delete()
          .eq('sheet_id', sheet.id)
          .eq('is_back_ordered', true)
      } else {
        await db.from('fulfillment_lines').delete().eq('sheet_id', sheet.id)
      }
      const insertLines = computed.map(({
        _primaryWhName, _splitWhName, _remainingShortage, _kitName, _idx, ...l
      }) => ({ ...l, sheet_id: sheet.id }))
      await db.from('fulfillment_lines').insert(insertLines)
    }

    await db.from('sales_orders').update({
      status:         'fulfillment',
      fulfillment_at: new Date().toISOString() }).eq('id', id)

    logActivity(db, user?.id, 'warehouse_iq', {
      category:    'sales_order',
      action:      isBackOrderRerun ? 'back_order_rerun' : 'pushed_to_fulfillment',
      label:       `${isBackOrderRerun ? 'Re-ran back-order for' : 'Pushed'} ${order?.so_number || id} to Fulfillment`,
      entity_type: 'sales_order',
      entity_id:   id })
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
        style={{ display:'flex',alignItems:'center',gap:6,background:'none',color:'var(--text-3)',fontSize:'var(--text-xs)',cursor:'pointer',padding:0,marginBottom:'var(--mar-m)' }}>
        <ArrowLeft size={14} /> Back to Queue
      </button>

      {/* Order header */}
      <div style={{ marginBottom: 'var(--mar-xl)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:'var(--gap-s)',marginBottom:4 }}>
          <div style={{ fontSize:'var(--text-base)',fontWeight:800 }}>{order?.so_number}</div>
          {order?.status === 'fulfillment' && (
            <span style={{ fontSize:'var(--text-xs)',fontWeight:700,padding:'3px 8px',borderRadius:6,background:'var(--blue-soft)',color:'var(--blue)' }}>In Fulfillment</span>
          )}
          {order?.status === 'back_ordered' && (
            <span style={{ fontSize:'var(--text-xs)',fontWeight:700,padding:'3px 8px',borderRadius:6,background:'var(--warning-soft)',color:'var(--warning-text)' }}>Back-Order Re-Run</span>
          )}
        </div>
        <div style={{ fontSize:'var(--text-sm)',color:'var(--black)' }}>
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {(order?.job_city || order?.customer_city) && (
          <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginTop:2 }}>
            Job location: {order?.job_city||order?.customer_city}, {order?.job_state||order?.customer_state}
          </div>
        )}
      </div>

      {/* Back-order context banner */}
      {order?.status === 'back_ordered' && (
        <div style={{ background:'var(--warning-soft)',borderRadius:'var(--r-m)',padding:'var(--pad-m) var(--pad-l)',marginBottom:'var(--mar-l)',display:'flex',gap:'var(--gap-m)',alignItems:'flex-start' }}>
          <Warning size={16} weight="fill" style={{ color:'var(--warning)',flexShrink:0,marginTop:1 }} />
          <div>
            <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--black)' }}>Back-Order Fulfillment</div>
            <div style={{ fontSize:'var(--text-xs)',color:'var(--black)',marginTop:2,lineHeight:1.5 }}>
              The first shipment for this SO has already been sent. You are now re-running fulfillment for the <strong>back-ordered items only</strong>. Once stock is available, run the order to allocate from current inventory, then confirm in Fulfillment to create a second shipment.
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'var(--gap-m)',marginBottom: 'var(--mar-l)' }}>
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
        <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
          <div className="card-header">
            <span className="card-title"><Lightning size={15} style={{ marginRight:6 }} />Run Order</span>
          </div>
          <div style={{ padding: 'var(--pad-xl)',textAlign:'center' }}>
            <div style={{ fontSize:'var(--text-sm)',color:'var(--black)',marginBottom:'var(--mar-l)',maxWidth:420,margin:'0 auto var(--mar-l)' }}>
              Running calculates all parts needed, checks stock across warehouses, validates kit descriptions against canonical definitions, and generates the fulfillment sheet. No inventory is deducted at this stage.
            </div>
            <button onClick={runOrder} disabled={running}
              style={{ padding: 'var(--pad-m) var(--pad-xxl)',borderRadius:'var(--r-xl)',background:'var(--navy)',color:'#fff',fontWeight:700,fontSize:'var(--text-sm)',cursor:'pointer',fontFamily:'var(--font)',display:'inline-flex',alignItems:'center',gap:'var(--gap-s)' }}>
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
            <div style={{ background:'var(--warning-soft)',border:'2px solid #F59E0B',borderRadius:'var(--r-xl)',padding:'var(--pad-l)',marginBottom: 'var(--mar-l)' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'var(--gap-m)',marginBottom: 'var(--mar-m)' }}>
                <SealWarning size={22} weight="fill" style={{ color:'var(--warning)',flexShrink:0 }} />
                <div>
                  <div style={{ fontSize:'var(--text-sm)',fontWeight:800,color:'var(--warning-text)' }}>
                    Kit Description Change Detected — Review Required
                  </div>
                  <div style={{ fontSize:'var(--text-xs)',color:'var(--warning-text)',marginTop:2 }}>
                    {unconfirmedKits} kit{unconfirmedKits!==1?'s':''} on this order have descriptions that differ from the canonical definition in the system. You must confirm or reject each change before pushing to fulfillment.
                  </div>
                </div>
              </div>
              <div style={{ display:'flex',flexDirection:'column',gap:'var(--gap-s)' }}>
                {kitChanges.filter(l => kitConfirmations[l._idx] === null).map(line => (
                  <div key={line._idx} style={{ padding: 'var(--pad-m)',background:'rgba(255,255,255,0.7)',borderRadius:'var(--r-l)' }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:'var(--gap-m)' }}>
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--warning-text)' }}>{line.description}</div>
                        <div style={{ fontSize:'var(--text-xs)',color:'var(--warning-text)',fontFamily:'var(--mono)',marginTop:2 }}>{line.sku}</div>
                      </div>
                      <button onClick={() => { setKitModalIdx(line._idx); setShowKitModal(true) }}
                        style={{ flexShrink:0,padding:'var(--pad-s) var(--pad-m)',borderRadius:'var(--r-l)',background:'var(--warning)',color:'#fff',fontWeight:700,fontSize:'var(--text-xs)',cursor:'pointer',fontFamily:'var(--font)' }}>
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
            <div key={line._idx} style={{ display:'flex',alignItems:'center',gap:'var(--gap-s)',padding: 'var(--pad-s) var(--pad-m)',background: kitConfirmations[line._idx]==='accept' ? 'var(--success-soft)' : 'var(--grey-tint-80)',borderRadius:'var(--r-l)',marginBottom:'var(--mar-s)',fontSize:'var(--text-xs)' }}>
              {kitConfirmations[line._idx]==='accept'
                ? <CheckCircle size={13} weight="fill" style={{ color:'var(--success-text)',flexShrink:0 }} />
                : <CheckCircle size={13} weight="fill" style={{ color:'var(--text-3)',flexShrink:0 }} />}
              <span style={{ color:'var(--black)' }}>
                <strong>{line.sku}</strong> — kit change {kitConfirmations[line._idx]==='accept' ? 'accepted (modified description will go to fulfillment)' : 'rejected (reverted to canonical description)'}
              </span>
            </div>
          ))}

          {/* ── Stock summary ── */}
          {totalShortages > 0 ? (
            <div style={{ background:'var(--error-soft)',borderRadius:'var(--r-xl)',padding:'var(--pad-m) var(--pad-l)',marginBottom: 'var(--mar-l)',display:'flex',alignItems:'center',gap:'var(--gap-m)' }}>
              <Warning size={18} weight="fill" style={{ color:'var(--error)',flexShrink:0 }} />
              <div>
                <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--error-shade-40)' }}>{totalShortages} part{totalShortages!==1?'s':''} with stock shortage</div>
                <div style={{ fontSize:'var(--text-xs)',color:'var(--error-dark)' }}>Review red lines. Use split fulfillment or mark as back order.</div>
              </div>
            </div>
          ) : (
            <div style={{ background:'var(--success-soft)',borderRadius:'var(--r-xl)',padding:'var(--pad-m) var(--pad-l)',marginBottom: 'var(--mar-l)',display:'flex',alignItems:'center',gap:'var(--gap-m)' }}>
              <CheckCircle size={18} weight="fill" style={{ color:'var(--success-text)',flexShrink:0 }} />
              <div style={{ fontSize:'var(--text-sm)',fontWeight:700,color:'var(--success-text)' }}>All {computed.length} parts are in stock</div>
            </div>
          )}

          {/* ── Fulfillment sheet ── */}
          <div className="card" style={{ marginBottom: 'var(--mar-l)' }}>
            <div className="card-header">
              <span className="card-title"><Package size={15} style={{ marginRight:6 }} />Fulfillment Sheet</span>
              <span style={{ fontSize:'var(--text-xs)',color:'rgba(255,255,255,0.55)' }}>{computed.length} parts</span>
            </div>

            {/* Column headers */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 52px 52px 52px',gap:8,padding:'var(--pad-s) var(--pad-l)',background:'var(--white)',borderBottom:'1px solid var(--border-l)' }}>
              {['Part','Req','Avail','Short'].map(h => (
                <div key={h} style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)' }}>{h}</div>
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
                  background: isBO ? 'var(--blue-tint-80)' : isShortage ? 'var(--error-soft)' : kitChanged ? 'var(--warning-soft)' : 'transparent' }}>

                  {/* Kit change badge */}
                  {kitChanged && (
                    <div style={{ padding: '4px var(--pad-l)',background:'var(--warning-soft)',fontSize:'var(--text-xs)',fontWeight:700,color:'var(--warning-text)',display:'flex',alignItems:'center',gap:4 }}>
                      <SealWarning size={11} /> Kit description modified by sales
                      {conf === 'accept' && <span style={{ color:'var(--success-text)',marginLeft:4 }}>✓ Accepted</span>}
                      {conf === 'reject' && <span style={{ color:'var(--text-3)',marginLeft:4 }}>✓ Reverted to canonical</span>}
                    </div>
                  )}

                  {/* Main row */}
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 52px 52px 52px',gap:8,padding:'var(--pad-m) var(--pad-l)',alignItems:'start' }}>
                    <div>
                      <div style={{ fontSize:'var(--text-xs)',fontWeight:600,
                        color: isBO ? 'var(--blue-shade-20)' : isShortage ? 'var(--error-shade-40)' : 'var(--black)' }}>
                        {line.description}
                        {line.is_kit && <span style={{ marginLeft:6,fontSize:'var(--text-2xs)',fontWeight:700,padding:'1px 4px',borderRadius:3,background:'var(--blue-soft)',color:'var(--blue)' }}>KIT</span>}
                        {isBO && <span style={{ marginLeft:6,fontSize:'var(--text-2xs)',fontWeight:700,padding:'1px 4px',borderRadius:3,background:'var(--blue-tint-80)',color:'var(--blue-shade-20)' }}>B/O</span>}
                      </div>
                      {line.sku && <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',fontFamily:'var(--mono)' }}>{line.sku}</div>}
                      <div style={{ fontSize:'var(--text-xs)',marginTop:2 }}>
                        <span style={{ fontWeight:600,color:'var(--navy)' }}>{line._primaryWhName || line.warehouse_id || '—'}</span>
                        {line.split_warehouse_id && !isBO && (
                          <span style={{ marginLeft:4,color:'var(--warning)',fontWeight:600 }}>+ split ({line._splitWhName || 'other'})</span>
                        )}
                      </div>

                      {/* Shortage actions */}
                      {isShortage && !isBO && (
                        <div style={{ display:'flex',gap:'var(--gap-s)',marginTop:6,flexWrap:'wrap' }}>
                          {line.split_warehouse_id && (
                            <button onClick={() => setExpandedSplit(p => ({ ...p, [idx]: !p[idx] }))}
                              style={{ fontSize:'var(--text-xs)',padding:'2px 8px',borderRadius:4,background:'transparent',cursor:'pointer',color:'var(--warning)',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:3 }}>
                              {splitOpen ? <CaretUp size={9}/> : <CaretDown size={9}/>} Split details
                            </button>
                          )}
                          <button onClick={() => toggleBackOrder(idx)}
                            style={{ fontSize:'var(--text-xs)',padding:'2px 8px',borderRadius:4,background:'transparent',cursor:'pointer',color:'var(--blue-shade-20)',fontFamily:'var(--font)',display:'flex',alignItems:'center',gap:3 }}>
                            <ClockCountdown size={10} /> Mark back order
                          </button>
                        </div>
                      )}

                      {/* Back order cancel */}
                      {isBO && (
                        <div style={{ display:'flex',alignItems:'center',gap:'var(--gap-s)',marginTop:6 }}>
                          <span style={{ fontSize:'var(--text-xs)',color:'var(--blue-shade-20)' }}>Back ordering {line.back_order_qty || line._remainingShortage} units</span>
                          <button onClick={() => toggleBackOrder(idx)}
                            style={{ fontSize:'var(--text-xs)',padding:'1px 6px',borderRadius:4,background:'transparent',cursor:'pointer',color:'var(--text-3)',fontFamily:'var(--font)' }}>
                            Cancel B/O
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--mono)',color:'var(--black)' }}>{line.qty_required}</div>
                    <div style={{ fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--mono)',
                      color: isBO ? 'var(--blue-shade-20)' : isShortage ? 'var(--error-alt)' : 'var(--success-text)' }}>
                      {line.qty_available}
                    </div>
                    <div style={{ fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--mono)',
                      color: isBO ? 'var(--blue-shade-20)' : isShortage ? 'var(--error-alt)' : 'var(--text-3)' }}>
                      {line.qty_shortage > 0 ? line.qty_shortage : '—'}
                    </div>
                  </div>

                  {/* Split detail panel */}
                  {splitOpen && isShortage && !isBO && (
                    <div style={{ margin: '0 var(--mar-l) var(--mar-m)',padding: 'var(--pad-m)',background:'var(--orange-soft)',borderRadius:'var(--r-l)' }}>
                      <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--warning-text)',marginBottom:8 }}>Split Fulfillment Plan</div>
                      <div style={{ fontSize:'var(--text-xs)',color:'var(--orange-shade-60)',lineHeight:1.6 }}>
                        <div>Primary: <strong>{line._primaryWhName||'—'}</strong> → pull {line.qty_available} of {line.qty_required}</div>
                        {line.split_warehouse_id
                          ? <div>Secondary: <strong>{line._splitWhName||line.split_warehouse_id}</strong> → pull {line.split_qty}</div>
                          : <div style={{ color:'var(--error-alt)' }}>No secondary warehouse has stock.</div>
                        }
                        {(line._remainingShortage||0) > 0 && (
                          <div style={{ color:'var(--error-alt)',marginTop:4 }}>
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
                <div style={{ fontSize:'var(--text-xs)',color:'var(--warning)',fontWeight:700,textAlign:'center',marginBottom:'var(--mar-m)',padding: 'var(--pad-s)',background:'var(--warning-soft)',borderRadius:'var(--r-l)' }}>
                  ⚠ Confirm all {unconfirmedKits} kit change{unconfirmedKits!==1?'s':''} above before pushing to fulfillment
                </div>
              )}
              <button onClick={pushToFulfillment} disabled={!allKitsConfirmed || pushed}
                style={{ width:'100%',padding:'var(--pad-m)',borderRadius:'var(--r-xl)',
                  background: pushed ? 'var(--success-text)' : !allKitsConfirmed ? 'var(--border)' : 'var(--navy)',
                  color: !allKitsConfirmed ? 'var(--text-3)' : '#fff',
                  fontWeight:700,fontSize:'var(--text-sm)',
                  cursor: allKitsConfirmed && !pushed ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem' }}>
                {pushed
                  ? <><CheckCircle size={16} weight="fill" /> Sent to Fulfillment</>
                  : !allKitsConfirmed
                    ? 'Confirm kit changes first'
                    : <>Push to Fulfillment <ArrowRight size={16} /></>}
              </button>
            </>
          )}

          {order?.status === 'fulfillment' && (
            <div style={{ textAlign:'center',padding:'var(--pad-l)',color:'var(--text-3)',fontSize:'var(--text-sm)' }}>
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
              borderRadius:'var(--r-xl) var(--r-xl) 0 0',padding:'1.25rem',maxHeight:'80vh',overflowY:'auto' }}>
              <div style={{ display:'flex',alignItems:'center',gap:'var(--gap-s)',marginBottom: 'var(--mar-l)' }}>
                <SealWarning size={20} weight="fill" style={{ color:'var(--warning)' }} />
                <div style={{ fontSize:'var(--text-lg)',fontWeight:800 }}>Kit Description Changed</div>
              </div>

              <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--black)',marginBottom:4 }}>
                {line.sku} — {line._kitName}
              </div>

              <div style={{ marginBottom: 'var(--mar-l)' }}>
                <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--warning)',marginBottom:6 }}>
                  Description on this Sales Order:
                </div>
                <div style={{ padding: 'var(--pad-m)',background:'var(--warning-soft)',borderRadius:'var(--r-l)',fontSize:'var(--text-sm)',color:'var(--warning-text)',lineHeight:1.6 }}>
                  {line.kit_original_description || line.description}
                </div>
              </div>

              <div style={{ marginBottom: 'var(--mar-xl)' }}>
                <div style={{ fontSize:'var(--text-xs)',fontWeight:700,color:'var(--navy)',marginBottom:6 }}>
                  Canonical description on file (QB default):
                </div>
                <div style={{ padding: 'var(--pad-m)',background: 'var(--white)',borderRadius:'var(--r-l)',fontSize:'var(--text-sm)',color:'var(--black)',lineHeight:1.6 }}>
                  {line.kit_canonical_description}
                </div>
              </div>

              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-3)',marginBottom:'var(--mar-l)',lineHeight:1.5 }}>
                Sales may have customised this kit for the customer. Accept to use the modified description for fulfillment, or reject to revert to the canonical definition.
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'var(--gap-m)' }}>
                <button onClick={() => handleKitConfirm(kitModalIdx, 'reject')}
                  style={{ padding: 'var(--pad-m)',borderRadius:'var(--r-xl)',background: 'var(--white)',fontWeight:700,fontSize:'var(--text-sm)',cursor:'pointer',fontFamily:'var(--font)',color:'var(--black)' }}>
                  Reject — Revert to canonical
                </button>
                <button onClick={() => handleKitConfirm(kitModalIdx, 'accept')}
                  style={{ padding: 'var(--pad-m)',borderRadius:'var(--r-xl)',background:'var(--warning)',color:'#fff',fontWeight:700,fontSize:'var(--text-sm)',cursor:'pointer',fontFamily:'var(--font)' }}>
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

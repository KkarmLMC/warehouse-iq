import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Lightning, Warning, CheckCircle,
  Package, ArrowRight, CaretDown, CaretUp,
  ClockCountdown, SealWarning, Question, Truck } from '@phosphor-icons/react'
import { Card, StatCard, Button, Badge } from '../components/ui'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'
import { logActivity } from '../lib/logActivity.js'
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')

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

// ─── Drop Ship inline form ─────────────────────────────────────────────────
function DropShipForm({ qty, onConfirm, onCancel }) {
  const [notes, setNotes] = useState('')

  return (
    <div className="run-order-7e21">
      <div className="run-order-ef7e">
        <Truck size="0.75rem" /> Drop Ship {qty} unit{qty !== 1 ? 's' : ''} from PLP
      </div>
      <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
        These items will be sent to the Drop Ship Queue. Once PLP provides tracking info, the warehouse manager will process the shipment from the queue.
      </div>

      <label className="run-order-d43c">Notes (optional)</label>
      <input value={notes} onChange={e => setNotes(e.target.value)}
        placeholder="Any notes for this drop ship"
        className="run-order-1dbe" />

      <div className="run-order-1692">
        <button onClick={onCancel}
          className="run-order-2296">
          Cancel
        </button>
        <button onClick={() => onConfirm({ supplier: 'PLP', notes })}
          className="run-order-63e6">
          <Truck size="0.625rem" /> Confirm Drop Ship
        </button>
      </div>
    </div>
  )
}

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
  const [dropShip,    setDropShip]    = useState({}) // lineIdx → { active, supplier, reference, eta, cost, notes }
  const [showDropForm, setShowDropForm] = useState({}) // lineIdx → bool (expanded form)

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
        is_drop_ship:               false,
        drop_ship_qty:              0,
        drop_ship_supplier:         null,
        drop_ship_reference:        null,
        drop_ship_eta:              null,
        drop_ship_cost:             null,
        drop_ship_notes:            null,
        drop_ship_status:           'pending',
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
    const nowBO = !backOrdered[lineIdx]
    setBackOrdered(p => ({ ...p, [lineIdx]: nowBO }))
    // Clear drop ship if enabling back order (mutually exclusive)
    if (nowBO) {
      setDropShip(p => ({ ...p, [lineIdx]: undefined }))
      setShowDropForm(p => ({ ...p, [lineIdx]: false }))
    }
    setComputed(prev => prev.map((l, i) => {
      if (i !== lineIdx) return l
      return {
        ...l,
        is_back_ordered: nowBO,
        back_order_qty:  nowBO ? l._remainingShortage : 0,
        is_drop_ship:    nowBO ? false : l.is_drop_ship,
        drop_ship_qty:   nowBO ? 0 : l.drop_ship_qty }
    }))
  }

  // ── Toggle drop ship on a line ───────────────────────────────────────────
  const toggleDropShip = (lineIdx) => {
    const ds = dropShip[lineIdx]
    if (ds?.active) {
      // Cancel drop ship
      setDropShip(p => ({ ...p, [lineIdx]: undefined }))
      setShowDropForm(p => ({ ...p, [lineIdx]: false }))
      setComputed(prev => prev.map((l, i) => i !== lineIdx ? l : {
        ...l, is_drop_ship: false, drop_ship_qty: 0,
        drop_ship_supplier: null, drop_ship_reference: null,
        drop_ship_eta: null, drop_ship_cost: null, drop_ship_notes: null }))
    } else {
      // Open drop ship form
      setShowDropForm(p => ({ ...p, [lineIdx]: true }))
      // Clear back order if enabling drop ship (mutually exclusive)
      setBackOrdered(p => ({ ...p, [lineIdx]: false }))
      setComputed(prev => prev.map((l, i) => i !== lineIdx ? l : {
        ...l, is_back_ordered: false, back_order_qty: 0 }))
    }
  }

  const confirmDropShip = (lineIdx, details) => {
    const line = computed[lineIdx]
    setDropShip(p => ({ ...p, [lineIdx]: { active: true, ...details } }))
    setShowDropForm(p => ({ ...p, [lineIdx]: false }))
    setComputed(prev => prev.map((l, i) => i !== lineIdx ? l : {
      ...l,
      is_drop_ship:       true,
      drop_ship_qty:      l._remainingShortage,
      drop_ship_supplier: 'PLP',
      drop_ship_notes:    details.notes || null,
      drop_ship_status:   'pending' }))
  }

  // ── Save + push to fulfillment ─────────────────────────────────────────────
  const pushToFulfillment = async () => {
    if (!allKitsConfirmed) return
    setPushed(true)

    const isBackOrderRerun = order?.status === 'back_ordered'

    // Determine which parallel tracks exist
    const hasDropShipLines  = computed.some(l => l.is_drop_ship)
    const hasBackOrderLines = computed.some(l => l.is_back_ordered)
    const hasInStockLines   = computed.some(l => !l.is_drop_ship && !l.is_back_ordered)

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

    // Determine the correct compound status
    let nextStatus = 'fulfillment'
    if (hasDropShipLines || hasBackOrderLines) {
      if (hasInStockLines) {
        nextStatus = 'partial_fulfillment'
      } else if (hasDropShipLines && !hasBackOrderLines) {
        // All lines are drop ship, nothing to fulfill locally
        nextStatus = 'partial_fulfillment'
      } else {
        nextStatus = 'partial_fulfillment'
      }
    }

    // Set SO-level flags and status
    const soUpdate = {
      status:         nextStatus,
      fulfillment_at: new Date().toISOString(),
    }

    if (hasDropShipLines) {
      soUpdate.has_drop_ship = true
      soUpdate.drop_ship_at  = new Date().toISOString()
    }

    if (hasBackOrderLines) {
      soUpdate.has_back_order  = true
      soUpdate.back_ordered_at = new Date().toISOString()
    }

    await db.from('sales_orders').update(soUpdate).eq('id', id)

    // Build descriptive log label
    const tracks = []
    if (hasInStockLines) tracks.push('fulfillment')
    if (hasDropShipLines) tracks.push('drop ship (PLP)')
    if (hasBackOrderLines) tracks.push('back order')
    const trackDesc = tracks.length > 1 ? ` — split: ${tracks.join(' + ')}` : ''

    logActivity(db, user?.id, APP_SOURCE, {
      category:    'sales_order',
      action:      isBackOrderRerun ? 'back_order_rerun' : 'pushed_to_fulfillment',
      label:       `${isBackOrderRerun ? 'Re-ran back-order for' : 'Pushed'} ${order?.so_number || id} to Fulfillment${trackDesc}`,
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
    <div className="page-content fade-in spinner-pad">
      <div className="spinner" />
    </div>
  )

  if (!order) return (
    <div className="page-content fade-in">
      <div className="empty" style={{ minHeight: '60vh' }}>
        <Warning size="2rem" className="empty-icon" />
        <div className="empty-title">Order not found</div>
        <div className="empty-desc">This order may have been deleted or the link is invalid.</div>
        <button onClick={() => navigate('/warehouse-hq/queue')}
          className="run-order-326e">
          ← Back to Queue
        </button>
      </div>
    </div>
  )

  return (
    <div className="page-content fade-in">
      <button onClick={() => navigate('/warehouse-hq/queue')}
        className="back-link">
        <ArrowLeft size="0.875rem" /> Back to Queue
      </button>

      {/* Order header */}
      <div className="mb-xl">
        <div className="run-order-eaaa">
          <div className="run-order-a2aa">{order?.so_number}</div>
          {order?.status === 'fulfillment' && (
            <span className="run-order-b34c">In Fulfillment</span>
          )}
          {order?.status === 'back_ordered' && (
            <span className="run-order-f1f8">Back-Order Re-Run</span>
          )}
        </div>
        <div className="text-sm-bold">
          {order?.customer_name}{order?.project_name ? ` — ${order.project_name}` : ''}
        </div>
        {(order?.job_city || order?.customer_city) && (
          <div className="meta-text">
            Job location: {order?.job_city||order?.customer_city}, {order?.job_state||order?.customer_state}
          </div>
        )}
      </div>

      {/* Back-order context banner */}
      {order?.status === 'back_ordered' && (
        <div className="run-order-b526">
          <Warning size="1rem" weight="fill" className="run-order-74ad" />
          <div>
            <div className="text-sm-bold">Back-Order Fulfillment</div>
            <div style={{ fontSize:'var(--text-xs)',color:'var(--text-primary)',marginTop:2,lineHeight:1.5 }}>
              The first shipment for this SO has already been sent. You are now re-running fulfillment for the <strong>back-ordered items only</strong>. Once stock is available, run the order to allocate from current inventory, then confirm in Fulfillment to create a second shipment.
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      <div className="run-order-7091">
        {[
          { label:'ORDER VALUE', value: fmt(order?.grand_total) },
          { label:'LINE ITEMS',  value: lines.length },
          { label:'DIVISION',    value: order?.division || '—' },
        ].map(s => (
          <StatCard key={s.label} label={s.label} value={s.value} />
        ))}
      </div>

      {/* ── Pre-run state ── */}
      {!hasRun && (
        <Card className="card mb-l">
          <div className="list-card__header">
            <span className="list-card__title"><Lightning size="1rem"  />Run Order</span>
          </div>
          <div className="run-order-1f63">
            <div className="run-order-9c92">
              Running calculates all parts needed, checks stock across warehouses, validates kit descriptions against canonical definitions, and generates the fulfillment sheet. No inventory is deducted at this stage.
            </div>
            <button onClick={runOrder} disabled={running}
              className="run-order-48c6">
              {running
                ? <><div className="spinner spinner--xs" /> Calculating…</>
                : <><Lightning size="1rem" weight="fill" /> Run Order</>}
            </button>
          </div>
        </Card>
      )}

      {/* ── Post-run state ── */}
      {hasRun && (
        <>
          {/* ── Kit change hard-stop banner ── */}
          {unconfirmedKits > 0 && (
            <div className="run-order-c81e">
              <div className="run-order-acb6">
                <SealWarning size="1.375rem" weight="fill" className="run-order-9d5a" />
                <div>
                  <div className="run-order-9e83">
                    Kit Description Change Detected — Review Required
                  </div>
                  <div className="run-order-2e98">
                    {unconfirmedKits} kit{unconfirmedKits!==1?'s':''} on this order have descriptions that differ from the canonical definition in the system. You must confirm or reject each change before pushing to fulfillment.
                  </div>
                </div>
              </div>
              <div className="run-order-eafd">
                {kitChanges.filter(l => kitConfirmations[l._idx] === null).map(line => (
                  <div key={line._idx} className="run-order-0a38">
                    <div className="run-order-cce6">
                      <div style={{ minWidth:0 }}>
                        <div className="run-order-003e">{line.description}</div>
                        <div className="run-order-e8bd">{line.sku}</div>
                      </div>
                      <button onClick={() => { setKitModalIdx(line._idx); setShowKitModal(true) }}
                        className="run-order-12c4">
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
            <div key={line._idx} style={{ display:'flex',alignItems:'center',gap:'var(--space-s)',padding: 'var(--space-s) var(--space-m)',background: kitConfirmations[line._idx]==='accept' ? 'var(--state-success-soft)' : 'var(--surface-light)',borderRadius:'var(--radius-l)',marginBottom:'var(--space-s)',fontSize:'var(--text-xs)' }}>
              {kitConfirmations[line._idx]==='accept'
                ? <CheckCircle size="0.8125rem" weight="fill" className="run-order-0ecf" />
                : <CheckCircle size="0.8125rem" weight="fill" className="run-order-a650" />}
              <span style={{ color:'var(--text-primary)' }}>
                <strong>{line.sku}</strong> — kit change {kitConfirmations[line._idx]==='accept' ? 'accepted (modified description will go to fulfillment)' : 'rejected (reverted to canonical description)'}
              </span>
            </div>
          ))}

          {/* ── Stock summary ── */}
          {totalShortages > 0 ? (
            <div className="run-order-e503">
              <Warning size="1.125rem" weight="fill" className="run-order-7e14" />
              <div>
                <div className="run-order-7321">{totalShortages} part{totalShortages!==1?'s':''} with stock shortage</div>
                <div className="run-order-fbc7">Review red lines. Use split fulfillment or mark as back order.</div>
              </div>
            </div>
          ) : (
            <div className="run-order-da2d">
              <CheckCircle size="1.125rem" weight="fill" className="run-order-0ecf" />
              <div className="run-order-d9b4">All {computed.length} parts are in stock</div>
            </div>
          )}

          {/* ── Fulfillment sheet ── */}
          <Card className="card mb-l">
            <div className="list-card__header">
              <span className="list-card__title"><Package size="1rem"  />Fulfillment Sheet</span>
              <span className="list-card__meta">{computed.length} parts</span>
            </div>

            {/* Column headers */}
            <div className="run-order-5811">
              {['Part','Req','Avail','Short'].map(h => (
                <div key={h} className="text-sm-bold">{h}</div>
              ))}
            </div>

            {computed.map((line, idx) => {
              const isShortage = line.is_shortage
              const isBO       = backOrdered[idx] || line.is_back_ordered
              const isDS       = dropShip[idx]?.active || line.is_drop_ship
              const splitOpen  = expandedSplit[idx]
              const kitChanged = line.kit_description_changed
              const conf       = kitConfirmations[line._idx ?? idx]

              return (
                <div key={idx} style={{ borderBottom: idx < computed.length-1 ? '1px solid var(--border-subtle)' : 'none',
                  background: isDS ? '#f5f3ff' : isBO ? 'var(--state-info-soft)' : isShortage ? 'var(--state-error-soft)' : kitChanged ? 'var(--state-warning-soft)' : 'transparent' }}>

                  {/* Kit change badge */}
                  {kitChanged && (
                    <div className="run-order-c1b0">
                      <SealWarning size="0.6875rem" /> Kit description modified by sales
                      {conf === 'accept' && <span className="run-order-0b53">✓ Accepted</span>}
                      {conf === 'reject' && <span className="run-order-8c6c">✓ Reverted to canonical</span>}
                    </div>
                  )}

                  {/* Main row */}
                  <div className="run-order-d8e4">
                    <div>
                      <div style={{ fontSize:'var(--text-sm)',fontWeight:600,
                        color: isDS ? '#6d28d9' : isBO ? 'var(--state-info)' : isShortage ? 'var(--state-error-text)' : 'var(--text-primary)' }}>
                        {line.description}
                        {line.is_kit && <span className="run-order-5488">KIT</span>}
                        {isBO && <span className="run-order-5488">B/O</span>}
                        {isDS && <span className="run-order-1871">DROP SHIP</span>}
                      </div>
                      {line.sku && <div className="text-xs-mono">{line.sku}</div>}
                      <div className="run-order-ca4e">
                        <span className="run-order-47e6">{line._primaryWhName || line.warehouse_id || '—'}</span>
                        {line.split_warehouse_id && !isBO && !isDS && (
                          <span className="run-order-1e8c">+ split ({line._splitWhName || 'other'})</span>
                        )}
                      </div>

                      {/* Shortage actions — show when shortage exists and neither B/O nor D/S active */}
                      {isShortage && !isBO && !isDS && !showDropForm[idx] && (
                        <div className="run-order-ff1f">
                          {line.split_warehouse_id && (
                            <button onClick={() => setExpandedSplit(p => ({ ...p, [idx]: !p[idx] }))}
                              className="run-order-1332">
                              {splitOpen ? <CaretUp size="0.5625rem"/> : <CaretDown size="0.5625rem"/>} Split details
                            </button>
                          )}
                          <button onClick={() => toggleBackOrder(idx)}
                            className="run-order-9ecd">
                            <ClockCountdown size="0.625rem" /> Mark back order
                          </button>
                          <button onClick={() => toggleDropShip(idx)}
                            className="run-order-d1a3">
                            <Truck size="0.625rem" /> Drop ship
                          </button>
                        </div>
                      )}

                      {/* Drop ship inline form */}
                      {showDropForm[idx] && !isDS && (
                        <DropShipForm
                          qty={line._remainingShortage}
                          onConfirm={(details) => confirmDropShip(idx, details)}
                          onCancel={() => setShowDropForm(p => ({ ...p, [idx]: false }))}
                        />
                      )}

                      {/* Back order active state */}
                      {isBO && (
                        <div className="run-order-cb68">
                          <span className="run-order-3a06">Back ordering {line.back_order_qty || line._remainingShortage} units</span>
                          <button onClick={() => toggleBackOrder(idx)}
                            className="run-order-fad8">
                            Cancel B/O
                          </button>
                        </div>
                      )}

                      {/* Drop ship active state */}
                      {isDS && (
                        <div style={{ marginTop:6 }}>
                          <div className="run-order-afb3">
                            <Truck size="0.6875rem" style={{ color:'#6d28d9' }} />
                            <span className="run-order-88ed">
                              Drop shipping {line.drop_ship_qty || line._remainingShortage} units
                            </span>
                            <span className="meta-text">
                              via {line.drop_ship_supplier || dropShip[idx]?.supplier}
                            </span>
                            <button onClick={() => toggleDropShip(idx)}
                              className="run-order-fad8">
                              Cancel D/S
                            </button>
                          </div>
                          {(line.drop_ship_reference || dropShip[idx]?.reference) && (
                            <div className="run-order-5eb9">
                              Ref: {line.drop_ship_reference || dropShip[idx]?.reference}
                              {(line.drop_ship_eta || dropShip[idx]?.eta) && <span> · ETA: {line.drop_ship_eta || dropShip[idx]?.eta}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="run-order-4f6c">{line.qty_required}</div>
                    <div style={{ fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--mono)',
                      color: isDS ? '#6d28d9' : isBO ? 'var(--state-info)' : isShortage ? 'var(--state-error)' : 'var(--state-success-text)' }}>
                      {line.qty_available}
                    </div>
                    <div style={{ fontSize:'var(--text-sm)',fontWeight:700,fontFamily:'var(--mono)',
                      color: isDS ? '#6d28d9' : isBO ? 'var(--state-info)' : isShortage ? 'var(--state-error)' : 'var(--text-muted)' }}>
                      {line.qty_shortage > 0 ? line.qty_shortage : '—'}
                    </div>
                  </div>

                  {/* Split detail panel */}
                  {splitOpen && isShortage && !isBO && !isDS && (
                    <div className="run-order-fc0c">
                      <div className="run-order-2d80">Split Fulfillment Plan</div>
                      <div style={{ fontSize:'var(--text-xs)',color:'var(--state-warning-text)',lineHeight:1.6 }}>
                        <div>Primary: <strong>{line._primaryWhName||'—'}</strong> → pull {line.qty_available} of {line.qty_required}</div>
                        {line.split_warehouse_id
                          ? <div>Secondary: <strong>{line._splitWhName||line.split_warehouse_id}</strong> → pull {line.split_qty}</div>
                          : <div style={{ color:'var(--state-error)' }}>No secondary warehouse has stock.</div>
                        }
                        {(line._remainingShortage||0) > 0 && (
                          <div className="run-order-9407">
                            ⚠ Still {line._remainingShortage} units short — consider back order or drop ship.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </Card>

          {/* Push to fulfillment */}
          {order?.status !== 'fulfillment' && (
            <>
              {unconfirmedKits > 0 && (
                <div className="run-order-4f11">
                  ⚠ Confirm all {unconfirmedKits} kit change{unconfirmedKits!==1?'s':''} above before pushing to fulfillment
                </div>
              )}
              <button onClick={pushToFulfillment} disabled={!allKitsConfirmed || pushed}
                style={{ width:'100%',padding:'var(--space-m)',borderRadius:'var(--radius-l)',
                  background: pushed ? 'var(--state-success-text)' : !allKitsConfirmed ? 'var(--border-default)' : 'var(--brand-primary)',
                  color: !allKitsConfirmed ? 'var(--text-muted)' : '#fff',
                  fontWeight:700,fontSize:'var(--text-sm)',
                  cursor: allKitsConfirmed && !pushed ? 'pointer' : 'not-allowed',
                  fontFamily:'var(--font)',display:'flex',alignItems:'center',justifyContent:'center',gap:'0.5rem' }}>
                {pushed
                  ? <><CheckCircle size="1rem" weight="fill" /> Sent to Fulfillment{(computed.some(l => l.is_drop_ship) || computed.some(l => l.is_back_ordered)) ? ' (split order)' : ''}</>
                  : !allKitsConfirmed
                    ? 'Confirm kit changes first'
                    : computed.some(l => l.is_drop_ship)
                      ? <>Push to Fulfillment + Drop Ship Queue <ArrowRight size="1rem" /></>
                      : <>Push to Fulfillment <ArrowRight size="1rem" /></>}
              </button>
            </>
          )}

          {order?.status === 'fulfillment' && (
            <div className="run-order-0fdd">
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
              className="run-order-0f8f" />
            <div style={{ position:'fixed',bottom: 'env(safe-area-inset-bottom, 0px)',left:0,right:0,zIndex:300,background:'var(--bg)',
              borderRadius:'var(--radius-l) var(--radius-l) 0 0',padding:'1.25rem',maxHeight:'80vh',overflowY:'auto' }}>
              <div className="run-order-6678">
                <SealWarning size="1.25rem" weight="fill" style={{ color:'var(--state-warning)' }} />
                <div className="run-order-a7a2">Kit Description Changed</div>
              </div>

              <div className="run-order-e096">
                {line.sku} — {line._kitName}
              </div>

              <div className="mb-l">
                <div className="run-order-3078">
                  Description on this Sales Order:
                </div>
                <div style={{ padding: 'var(--space-m)',background:'var(--state-warning-soft)',borderRadius:'var(--radius-l)',fontSize:'var(--text-sm)',color:'var(--state-warning-text)',lineHeight:1.6 }}>
                  {line.kit_original_description || line.description}
                </div>
              </div>

              <div className="mb-xl">
                <div className="run-order-18cc">
                  Canonical description on file (QB default):
                </div>
                <div style={{ padding: 'var(--space-m)',background: 'var(--surface-base)',borderRadius:'var(--radius-l)',fontSize:'var(--text-sm)',color:'var(--text-primary)',lineHeight:1.6 }}>
                  {line.kit_canonical_description}
                </div>
              </div>

              <div style={{ fontSize:'var(--text-xs)',color:'var(--text-muted)',marginBottom:'var(--space-l)',lineHeight:1.5 }}>
                Sales may have customised this kit for the customer. Accept to use the modified description for fulfillment, or reject to revert to the canonical definition.
              </div>

              <div className="run-order-560b">
                <button onClick={() => handleKitConfirm(kitModalIdx, 'reject')}
                  className="run-order-e5b5">
                  Reject — Revert to canonical
                </button>
                <button onClick={() => handleKitConfirm(kitModalIdx, 'accept')}
                  className="run-order-7f7a">
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

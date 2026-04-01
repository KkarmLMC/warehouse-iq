import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass, Plus, Package, WarningCircle,
  X, CaretRight, ArrowsLeftRight } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

function StockBadge({ qty, minLevel, onOrder }) {
  if (qty === 0 && onOrder > 0) return (
    <span className="text-label">
      0 (+{onOrder} ordered)
    </span>
  )
  if (qty === 0) return (
    <span className="text-label">
      Out of stock
    </span>
  )
  if (minLevel && qty <= minLevel) return (
    <span className="text-label">
      Low: {qty}
    </span>
  )
  return (
    <span className="text-label">
      {qty}
    </span>
  )
}

function PartRow({ part, levels, onPress }) {
  const totalQty     = levels.reduce((sum, l) => sum + (l.quantity_on_hand || 0), 0)
  const totalOnOrder = levels.reduce((sum, l) => sum + (l.quantity_on_order || 0), 0)
  const minLevel     = levels.length ? Math.min(...levels.filter(l => l.min_level).map(l => l.min_level)) : null
  const isLow        = isFinite(minLevel) && totalQty <= minLevel && totalQty > 0

  return (
    <button onClick={onPress} className="row-btn">
      <div style={{
        width: 'var(--icon-size-lg)', height: 'var(--icon-size-lg)', borderRadius: 'var(--radius-l)',
        background: isLow ? 'var(--state-warning-soft)' : 'var(--surface-hover)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isLow
          ? <WarningCircle size="1.25rem" weight="fill" style={{ color: 'var(--state-warning-text)' }} />
          : <Package size="1.25rem" style={{ color: 'var(--text-primary)' }} />
        }
      </div>
      <div className="content-body">
        <div className="text-sm-truncate">
          {part.name}
        </div>
        <div className="meta-text">
          {part.sku && <span style={{ fontFamily: 'var(--mono)' }}>{part.sku} · </span>}
          {part.part_categories?.name || 'Uncategorized'}
        </div>
      </div>
      <div className="flex-gap-s shrink-0">
        <StockBadge qty={totalQty} minLevel={minLevel} onOrder={totalOnOrder} />
        <CaretRight size="0.875rem" style={{ color: 'var(--text-primary)' }} />
      </div>
    </button>
  )
}

export default function InventoryStock() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const warehouseParam = searchParams.get('warehouse')

  const [parts, setParts]         = useState([])
  const [levels, setLevels]       = useState({})
  const [warehouses, setWarehouses] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState(warehouseParam || null)
  const [stockFilter, setStockFilter] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: partsData }, { data: warehousesData }, { data: levelsData }] = await Promise.all([
      db.from('parts').select('*, part_categories(name)').eq('is_active', true).order('name'),
      db.from('warehouses').select('*').eq('is_active', true).order('name'),
      db.from('inventory_levels').select('*'),
    ])
    setParts(partsData || [])
    setWarehouses(warehousesData || [])
    const lvlMap = {}
    for (const l of levelsData || []) {
      if (!lvlMap[l.part_id]) lvlMap[l.part_id] = []
      lvlMap[l.part_id].push(l)
    }
    setLevels(lvlMap)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const selectedWarehouseName = warehouses.find(w => w.id === selectedWarehouse)?.name?.replace(' Warehouse', '') || 'All Warehouses'

  const filtered = parts.filter(p => {
    const lvls = levels[p.id] || []
    const qty  = lvls.reduce((s, l) => s + l.quantity_on_hand, 0)
    const min  = Math.min(...lvls.filter(l => l.min_level).map(l => l.min_level))
    if (search) {
      const q = search.toLowerCase()
      if (!p.name.toLowerCase().includes(q) && !(p.sku || '').toLowerCase().includes(q) && !(p.manufacturer || '').toLowerCase().includes(q)) return false
    }
    if (selectedWarehouse && !lvls.some(l => l.warehouse_id === selectedWarehouse)) return false
    if (stockFilter === 'low') { if (!isFinite(min) || qty > min || qty === 0) return false }
    if (stockFilter === 'out' && qty !== 0) return false
    return true
  })

  const totalParts  = parts.length
  const lowCount    = parts.filter(p => { const lvls = levels[p.id] || []; const qty = lvls.reduce((s, l) => s + l.quantity_on_hand, 0); const min = Math.min(...lvls.filter(l => l.min_level).map(l => l.min_level)); return isFinite(min) && qty <= min && qty > 0 }).length
  const outCount    = parts.filter(p => { const lvls = levels[p.id] || []; return lvls.reduce((s, l) => s + l.quantity_on_hand, 0) === 0 }).length

  return (
    <div className="page-content fade-in">

      {/* Header */}
      <div className="modal-header">
        <div>
          <div className="text-label">
            INVENTORY / {selectedWarehouseName.toUpperCase()}
          </div>
          <div className="page-heading">Inventory</div>
        </div>
        <div className="flex-gap-s">
          <button onClick={() => navigate('/warehouse-hq/transfer')}
            className="inventory-stock-ff05">
            <ArrowsLeftRight size="0.875rem" /> Transfer
          </button>
          <button onClick={() => navigate('/warehouse-hq/add-part')}
            className="inventory-stock-23e5">
            <Plus size="0.875rem" /> Add Part
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-3col mb-l">
        {[
          { label: 'Total Parts', value: totalParts, color: 'var(--brand-primary)' },
          { label: 'Low Stock', value: lowCount, color: 'var(--state-warning-text)' },
          { label: 'Out of Stock', value: outCount, color: 'var(--state-error-text)' },
        ].map(s => (
          <div key={s.label} className="inventory-stock-080f">
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-black)', color: s.color }}>{s.value}</div>
            <div className="meta-text">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="position-relative mb-m">
        <MagnifyingGlass size="1rem" className="search-overlay-icon" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts, SKU, manufacturer…"
          style={{ paddingLeft: 'var(--search-input-offset)', paddingRight: search ? 36 : 12 }} />
        {search && (
          <button onClick={() => setSearch('')} className="search-overlay-clear">
            <X size="0.875rem" />
          </button>
        )}
      </div>

      {/* Filters row */}
      <div className="inventory-stock-85c7">
        <button onClick={() => setSelectedWarehouse(null)}
          style={{ flexShrink: 0, padding: 'var(--space-xs) var(--space-m)', borderRadius: 'var(--radius-l)', border: `1px solid ${!selectedWarehouse ? 'var(--brand-primary)' : 'var(--border-subtle)'}`, background: !selectedWarehouse ? 'var(--brand-primary)' : 'transparent', color: !selectedWarehouse ? '#fff' : 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          All Warehouses
        </button>
        {warehouses.map(w => (
          <button key={w.id} onClick={() => setSelectedWarehouse(w.id)}
            style={{ flexShrink: 0, padding: 'var(--space-xs) var(--space-m)', borderRadius: 'var(--radius-l)', border: `1px solid ${selectedWarehouse === w.id ? 'var(--brand-primary)' : 'var(--border-subtle)'}`, background: selectedWarehouse === w.id ? 'var(--brand-primary)' : 'transparent', color: selectedWarehouse === w.id ? '#fff' : 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {w.name.replace(' Warehouse', '')}
          </button>
        ))}
        <div className="inventory-stock-e363" />
        {[['all', 'All'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([val, lbl]) => (
          <button key={val} onClick={() => setStockFilter(val)}
            style={{ flexShrink: 0, padding: 'var(--space-xs) var(--space-m)', borderRadius: 'var(--radius-l)', border: `1px solid ${stockFilter === val ? 'var(--state-error)' : 'var(--border-subtle)'}`, background: stockFilter === val ? 'var(--state-error)' : 'transparent', color: stockFilter === val ? '#fff' : 'var(--text-primary)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Parts list */}
      {loading ? (
        <div className="spinner-pad"><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Package size="2.5rem" className="empty-icon" />
          <div className="empty-title">{parts.length === 0 ? 'No parts yet' : 'No parts match filters'}</div>
          <div className="empty-desc">{parts.length === 0 ? 'Add your first part to get started.' : 'Try adjusting your filters.'}</div>
        </div>
      ) : (
        <div className="card-section">
          {filtered.map(part => (
            <PartRow
              key={part.id}
              part={part}
              levels={(levels[part.id] || []).filter(l => !selectedWarehouse || l.warehouse_id === selectedWarehouse)}
              onPress={() => navigate(`/warehouse-hq/part/${part.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

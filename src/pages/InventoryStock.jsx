import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  MagnifyingGlass, Plus, Package, WarningCircle,
  X, CaretRight, ArrowsLeftRight } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

function StockBadge({ qty, minLevel, onOrder }) {
  if (qty === 0 && onOrder > 0) return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-xxl)', fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--bg)', color: 'var(--black)' }}>
      0 (+{onOrder} ordered)
    </span>
  )
  if (qty === 0) return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-xxl)', fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--bg)', color: 'var(--black)' }}>
      Out of stock
    </span>
  )
  if (minLevel && qty <= minLevel) return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-xxl)', fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--bg)', color: 'var(--black)' }}>
      Low: {qty}
    </span>
  )
  return (
    <span style={{ padding: '2px 8px', borderRadius: 'var(--r-xxl)', fontSize: 'var(--text-xs)', fontWeight: 700, background: 'var(--bg)', color: 'var(--black)' }}>
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
    <button onClick={onPress} style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: 'var(--pad-m) var(--pad-l)', background: 'none',
      width: '100%', textAlign: 'left', borderBottom: '1px solid var(--border-l)',
      cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <div style={{
        width: '2.5rem', height: '2.5rem', borderRadius: 'var(--r-l)',
        background: isLow ? 'var(--orange-soft)' : 'var(--hover)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {isLow
          ? <WarningCircle size={20} weight="fill" style={{ color: 'var(--black)' }} />
          : <Package size={20} style={{ color: 'var(--black)' }} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {part.name}
        </div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2 }}>
          {part.sku && <span style={{ fontFamily: 'var(--mono)' }}>{part.sku} · </span>}
          {part.part_categories?.name || 'Uncategorized'}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', flexShrink: 0 }}>
        <StockBadge qty={totalQty} minLevel={minLevel} onOrder={totalOnOrder} />
        <CaretRight size={14} style={{ color: 'var(--black)' }} />
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--mar-l)', flexWrap: 'wrap', gap: 'var(--gap-m)' }}>
        <div>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', marginBottom: 4 }}>
            INVENTORY / {selectedWarehouseName.toUpperCase()}
          </div>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>Inventory</div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--gap-s)' }}>
          <button onClick={() => navigate('/warehouse-hq/transfer')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', padding: 'var(--pad-s) var(--pad-m)', borderRadius: 'var(--r-m)', background: 'var(--white)', color: 'var(--black)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer' }}>
            <ArrowsLeftRight size={14} /> Transfer
          </button>
          <button onClick={() => navigate('/warehouse-hq/add-part')}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', padding: 'var(--pad-s) var(--pad-m)', borderRadius: 'var(--r-m)', background: 'var(--navy)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700, cursor: 'pointer' }}>
            <Plus size={14} /> Add Part
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-m)', marginBottom: 'var(--mar-l)' }}>
        {[
          { label: 'Total Parts', value: totalParts, color: 'var(--navy)' },
          { label: 'Low Stock', value: lowCount, color: 'var(--black)' },
          { label: 'Out of Stock', value: outCount, color: 'var(--black)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--white)', borderRadius: 'var(--r-l)', padding: 'var(--pad-m)', textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--text-base)', fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 'var(--mar-m)' }}>
        <MagnifyingGlass size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts, SKU, manufacturer…"
          style={{ width: '100%', paddingLeft: 36, paddingRight: search ? 36 : 12 }} />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', cursor: 'pointer', color: 'var(--text-3)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 'var(--gap-s)', marginBottom: 'var(--mar-l)', overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none', flexWrap: 'wrap' }}>
        <button onClick={() => setSelectedWarehouse(null)}
          style={{ flexShrink: 0, padding: 'var(--pad-xs) var(--pad-m)', borderRadius: 'var(--r-xxl)', border: `1px solid ${!selectedWarehouse ? 'var(--navy)' : 'var(--border-l)'}`, background: !selectedWarehouse ? 'var(--navy)' : 'transparent', color: !selectedWarehouse ? '#fff' : 'var(--black)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          All Warehouses
        </button>
        {warehouses.map(w => (
          <button key={w.id} onClick={() => setSelectedWarehouse(w.id)}
            style={{ flexShrink: 0, padding: 'var(--pad-xs) var(--pad-m)', borderRadius: 'var(--r-xxl)', border: `1px solid ${selectedWarehouse === w.id ? 'var(--navy)' : 'var(--border-l)'}`, background: selectedWarehouse === w.id ? 'var(--navy)' : 'transparent', color: selectedWarehouse === w.id ? '#fff' : 'var(--black)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {w.name.replace(' Warehouse', '')}
          </button>
        ))}
        <div style={{ width: 1, background: 'var(--border-l)', margin: '0 var(--mar-xs)' }} />
        {[['all', 'All'], ['low', 'Low Stock'], ['out', 'Out of Stock']].map(([val, lbl]) => (
          <button key={val} onClick={() => setStockFilter(val)}
            style={{ flexShrink: 0, padding: 'var(--pad-xs) var(--pad-m)', borderRadius: 'var(--r-xxl)', border: `1px solid ${stockFilter === val ? 'var(--red)' : 'var(--border-l)'}`, background: stockFilter === val ? 'var(--red)' : 'transparent', color: stockFilter === val ? '#fff' : 'var(--black)', fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Parts list */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pad-xxl)' }}><div className="spinner" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <Package size={40} style={{ color: 'var(--text-3)', marginBottom: 'var(--mar-m)' }} />
          <div className="empty-title">{parts.length === 0 ? 'No parts yet' : 'No parts match filters'}</div>
          <div className="empty-desc">{parts.length === 0 ? 'Add your first part to get started.' : 'Try adjusting your filters.'}</div>
        </div>
      ) : (
        <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
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

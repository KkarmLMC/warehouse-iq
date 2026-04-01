import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Package, MagnifyingGlass, X, CaretRight, CaretDown,
  ArrowSquareOut, Lightning, Broadcast, GitFork,
  Wrench, Anchor, ShieldCheck, Cube, TreeStructure,
  Funnel, Nut, Stack, Pulse, HardHat, Hammer,
  Plugs, Rows, Scissors } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

// ─── Category icon map ────────────────────────────────────────────────────────
const CATEGORY_ICONS = {
  // LM
  'Air Terminals (SRAT)':         Lightning,
  'Candelabra Air Terminals':     Broadcast,
  'Lightning Rods':               Lightning,
  'Dissipators & Static Control': Pulse,
  'Conductors':                   GitFork,
  'Ground Electrodes':            Anchor,
  'Bonding Hardware':             Nut,
  'Mounting Hardware':            Wrench,
  'Surge Protection':             ShieldCheck,
  'MAGS Systems':                 TreeStructure,
  'Raw Materials':                Stack,
  'Consumables & Hardware':       Funnel,
  // Bolt
  'Air Terminals':                Lightning,
  'Conductors & Cable':           GitFork,
  'Grounding':                    Anchor,
  'Bonding & Splicing':           Nut,
  'Mounting Bases':               Wrench,
  'Surge Protection Devices':     ShieldCheck,
  'Consumables':                  Funnel,
  'Custom Fabrication':           Hammer }

// ─── Tab config ───────────────────────────────────────────────────────────────
const TABS = [
  { key: 'LM',   label: 'Lightning Master' },
  { key: 'Bolt', label: 'Bolt Lightning'   },
  { key: 'All',  label: 'All Parts'        },
]

// ─── Category section ─────────────────────────────────────────────────────────
function CategorySection({ category, parts, onPartPress }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = CATEGORY_ICONS[category.name] || Cube

  return (
    <div className="parts-catalog-2cba">
      <button
        onClick={() => setExpanded(e => !e)}
        className="parts-catalog-74d8"
      >
        <div className="parts-catalog-4f47">
          <Icon size="0.9375rem" style={{ color: 'var(--color-white)' }} />
        </div>
        <div className="content-body">
          <div className="text-sm-bold--inverse">{category.name}</div>
          <div className="parts-catalog-5e29">
            {parts.length} {parts.length === 1 ? 'part' : 'parts'}
            {category.catalog === 'All' && (
              <span className="parts-catalog-c67f">
                {category.originalCatalog}
              </span>
            )}
          </div>
        </div>
        <CaretDown size="0.9375rem" style={{
          color: 'var(--surface-base)', flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease' }} />
      </button>

      {expanded && (
        <div >
          {parts.map((part, idx) => (
            <button key={part.id} onClick={() => onPartPress(part.id)}
              className="row-btn">
              <div className="content-body">
                <div className="flex-gap-s">
                  <div className="text-sm-truncate">
                    {part.name}
                  </div>
                  {part.tags?.includes('shared') && (
                    <span className="text-label">
                      LM + Bolt
                    </span>
                  )}
                </div>
                <div className="parts-catalog-4c92">
                  {part.sku && <span className="text-xs-mono">{part.sku}</span>}
                  {part.unit_cost && <span className="meta-text">${part.unit_cost}</span>}
                </div>
              </div>
              <CaretRight size="0.8125rem" className="row-item__caret" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PartsCatalog() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('LM')
  const [categories, setCategories] = useState([])
  const [parts, setParts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    Promise.all([
      db.from('part_categories').select('*').order('name'),
      db.from('parts').select('id, sku, name, description, unit_cost, unit_of_measure, category_id, manufacturer, tags').eq('is_active', true).order('name'),
    ]).then(([{ data: cats }, { data: pts }]) => {
      setCategories(cats || [])
      setParts(pts || [])
      setLoading(false)
    })
  }, [])

  // Filter by search
  const filteredParts = search
    ? parts.filter(p => {
        const q = search.toLowerCase()
        return p.name.toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.manufacturer || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
      })
    : parts

  // Build grouped sections based on active tab
  const grouped = (() => {
    if (activeTab === 'All') {
      // All categories from both catalogs, each with their brand label
      return categories
        .map(cat => ({
          category: { ...cat, catalog: 'All', originalCatalog: cat.catalog },
          parts: filteredParts.filter(p => p.category_id === cat.id) }))
        .filter(g => g.parts.length > 0)
    }
    return categories
      .filter(cat => cat.catalog === activeTab)
      .map(cat => ({
        category: cat,
        parts: filteredParts.filter(p => p.category_id === cat.id) }))
      .filter(g => g.parts.length > 0)
  })()

  // Counts per tab
  const lmParts   = parts.filter(p => categories.find(c => c.id === p.category_id && c.catalog === 'LM')).length
  const boltParts = parts.filter(p => categories.find(c => c.id === p.category_id && c.catalog === 'Bolt')).length

  return (
    <div className="page-content fade-in">

      {/* Tabs */}
      <div className="parts-catalog-3d2c">
        {TABS.map(tab => {
          const count = tab.key === 'LM' ? lmParts : tab.key === 'Bolt' ? boltParts : parts.length
          const active = activeTab === tab.key
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-l)', cursor: 'pointer', transition: 'all 0.15s ease',
                background: active ? 'var(--brand-primary)' : 'transparent',
                color: active ? '#fff' : 'var(--text-muted)',
                fontWeight: active ? 700 : 500,
                fontSize: 'var(--text-xs)' }}>
              <div style={{ fontWeight: active ? 700 : 600 }}>{tab.label}</div>
              <div style={{ fontSize: 'var(--text-2xs)', opacity: active ? 0.7 : 0.6, marginTop: 1 }}>
                {count} parts
              </div>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="queue-search">
        <MagnifyingGlass size="1rem" className="search-overlay-icon" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${activeTab === 'All' ? 'all parts' : activeTab === 'LM' ? 'Lightning Master parts' : 'Bolt Lightning parts'}…`}
          style={{ paddingLeft: 'var(--search-input-offset)', paddingRight: search ? 36 : 12 }} />
        {search && (
          <button onClick={() => setSearch('')} className="search-overlay-clear">
            <X size="0.875rem" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="spinner-pad"><div className="spinner" /></div>
      ) : grouped.length === 0 ? (
        <div className="empty">
          <Package size="2.5rem" className="empty-icon" />
          <div className="empty-title">
            {search ? 'No parts found' : activeTab === 'Bolt' ? 'No Bolt parts yet' : 'No parts found'}
          </div>
          <div className="empty-desc">
            {search ? 'Try a different search term.' : activeTab === 'Bolt' ? 'Add parts to the Bolt Lightning catalog to see them here.' : 'No parts match your search.'}
          </div>
        </div>
      ) : (
        <>
          {search && (
            <div className="parts-catalog-30e7">
              {grouped.reduce((s, g) => s + g.parts.length, 0)} result{grouped.reduce((s, g) => s + g.parts.length, 0) !== 1 ? 's' : ''} for "{search}"
            </div>
          )}
          {grouped.map(({ category, parts: catParts }) => (
            <CategorySection
              key={category.id}
              category={category}
              parts={catParts}
              onPartPress={id => navigate(`/warehouse-hq/part/${id}`)}
            />
          ))}
        </>
      )}
    </div>
  )
}

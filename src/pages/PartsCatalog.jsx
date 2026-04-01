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
    <div style={{
      background: 'var(--surface-base)', borderRadius: 'var(--radius-m)',
      overflow: 'hidden',
      marginBottom: 'var(--space-m)' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', background: 'var(--brand-primary)', cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{
          width: '2rem', height: '2rem', borderRadius: 'var(--radius-m)',
          background: 'rgba(255,255,255,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size="0.9375rem" style={{ color: '#fff' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff' }}>{category.name}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--surface-base)', marginTop: 1 }}>
            {parts.length} {parts.length === 1 ? 'part' : 'parts'}
            {category.catalog === 'All' && (
              <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 4, padding: '1px 6px' }}>
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
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: 'var(--space-m) var(--space-l)', background: 'none', width: '100%', textAlign: 'left',
                borderBottom: idx < parts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-s)', flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {part.name}
                  </div>
                  {part.tags?.includes('shared') && (
                    <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-s)', background: 'var(--state-success-soft)', color: 'var(--state-success-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      LM + Bolt
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-m)', marginTop: 2, flexWrap: 'wrap' }}>
                  {part.sku && <span style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>{part.sku}</span>}
                  {part.unit_cost && <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>${part.unit_cost}</span>}
                </div>
              </div>
              <CaretRight size="0.8125rem" style={{ color: 'var(--text-primary)', flexShrink: 0 }} />
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
      <div style={{
        display: 'flex', background: 'var(--surface-base)', borderRadius: 'var(--radius-m)',
        padding: 4, gap: 4, marginBottom: 'var(--space-l)' }}>
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
      <div style={{ position: 'relative', marginBottom: 'var(--space-l)' }}>
        <MagnifyingGlass size="1rem" className="search-overlay-icon" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${activeTab === 'All' ? 'all parts' : activeTab === 'LM' ? 'Lightning Master parts' : 'Bolt Lightning parts'}…`}
          style={{ width: '100%', paddingLeft: 36, paddingRight: search ? 36 : 12 }} />
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
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-m)' }}>
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

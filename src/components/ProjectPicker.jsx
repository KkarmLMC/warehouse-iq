import { useState, useEffect, useRef } from 'react'
import { MagnifyingGlass, X, Briefcase } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'

/**
 * ProjectPicker — searchable dropdown that links to a real project in the DB.
 * 
 * Props:
 *   value        — selected project object { id, name, job_number, ... } or null
 *   onChange     — called with the selected project object (or null on clear)
 *   placeholder  — input placeholder text
 *   required     — shows red asterisk on label
 *   label        — field label string (default: "Project / Job")
 */
export default function ProjectPicker({ value, onChange, placeholder = 'Search by project name or job number…', required, label = 'Project / Job' }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef()

  // Close on outside click
  useEffect(() => {
    const handler = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Search projects
  useEffect(() => {
    if (!query.trim()) { setResults([]); setOpen(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      const q = query.toLowerCase()
      const { data } = await db
        .from('projects')
        .select('id, name, job_number, customer_account, stage, city, state')
        .or(`name.ilike.%${q}%,job_number.ilike.%${q}%,customer_account.ilike.%${q}%`)
        .eq('archived', false)
        .order('created_at', { ascending: false })
        .limit(10)
      setResults(data || [])
      setLoading(false)
      setOpen(true)
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  const handleSelect = project => {
    onChange(project)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  const handleClear = () => {
    onChange(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div>
      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
        {label}{required && <span style={{ color: 'var(--state-error)', marginLeft: 3 }}>*</span>}
      </label>

      {/* Selected project display */}
      {value ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-m)', padding: 'var(--space-m) var(--space-l)', borderRadius: 'var(--radius-l)', background: 'var(--surface-base)' }}>
          <Briefcase size="1rem" style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
          <div className="content-body">
            <div style={{ fontSize: "var(--text-sm)", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {value.name}
            </div>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
              {[value.job_number, value.city && `${value.city}, ${value.state}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={handleClear} style={{ background: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0, display: 'flex', flexShrink: 0 }}>
            <X size="0.9375rem" />
          </button>
        </div>
      ) : (
        <div ref={ref} className="position-relative">
          {/* Search input */}
          <div className="position-relative">
            <MagnifyingGlass size="0.875rem" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => query && setOpen(true)}
              placeholder={placeholder}
              style={{ paddingLeft: 30, width: '100%' }}
            />
            {loading && (
              <div className="spinner" style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14 }} />
            )}
          </div>

          {/* Dropdown results */}
          {open && results.length > 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', borderRadius: 'var(--radius-l)', marginTop: 2, overflow: 'hidden', maxHeight: 280, overflowY: 'auto' }}>
              {results.map(p => (
                <button key={p.id} onClick={() => handleSelect(p)}
                  style={{ width: '100%', background: 'none', padding: 'var(--space-m) var(--space-l)', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-m)', borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-base)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <Briefcase size="0.875rem" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="text-sm-truncate">
                      {p.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--mono)', color: 'var(--text-muted)' }}>
                      {[p.job_number, p.customer_account, p.city && `${p.city}, ${p.state}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', fontWeight: 600, padding: '1px 6px', borderRadius: 4, background: 'var(--surface-base)', color: 'var(--text-muted)', flexShrink: 0 }}>
                    {p.stage}
                  </span>
                </button>
              ))}
            </div>
          )}

          {open && !loading && query && results.length === 0 && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: '#fff', borderRadius: 'var(--radius-l)', marginTop: 2, padding: 'var(--space-l)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              No projects found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

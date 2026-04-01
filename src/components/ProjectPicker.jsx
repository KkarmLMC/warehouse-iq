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
      <label className="form-field__label">
        {label}{required && <span className="text-error-marker">*</span>}
      </label>

      {/* Selected project display */}
      {value ? (
        <div className="flex-gap-m">
          <Briefcase size="1rem" className="project-picker-3720" />
          <div className="content-body">
            <div className="project-picker-4988">
              {value.name}
            </div>
            <div className="text-xs-mono">
              {[value.job_number, value.city && `${value.city}, ${value.state}`].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button onClick={handleClear} className="project-picker-8f04">
            <X size="0.9375rem" />
          </button>
        </div>
      ) : (
        <div ref={ref} className="position-relative">
          {/* Search input */}
          <div className="position-relative">
            <MagnifyingGlass size="0.875rem" className="project-picker-bedf" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => query && setOpen(true)}
              placeholder={placeholder}
              
            />
            {loading && (
              <div className="spinner project-picker-c77f" />
            )}
          </div>

          {/* Dropdown results */}
          {open && results.length > 0 && (
            <div className="project-picker-5de7">
              {results.map(p => (
                <button key={p.id} onClick={() => handleSelect(p)}
                  className="project-picker-5889"
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-base)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                  <Briefcase size="0.875rem" className="row-item__caret" />
                  <div className="min-width-0">
                    <div className="text-sm-truncate">
                      {p.name}
                    </div>
                    <div className="text-xs-mono">
                      {[p.job_number, p.customer_account, p.city && `${p.city}, ${p.state}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className="project-picker-aee8">
                    {p.stage}
                  </span>
                </button>
              ))}
            </div>
          )}

          {open && !loading && query && results.length === 0 && (
            <div className="project-picker-f332">
              No projects found for "{query}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}

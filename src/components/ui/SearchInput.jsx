/**
 * SearchInput
 * Standard search field with magnifying glass icon and optional clear button.
 * Used on 30+ pages across all three apps.
 *
 * Props:
 *   value        — controlled input value
 *   onChange     — (value: string) => void
 *   placeholder  — input placeholder text
 *   autoFocus    — focus on mount
 */
import { MagnifyingGlass, X } from '@phosphor-icons/react'

export default function SearchInput({ value, onChange, placeholder = 'Search…', autoFocus }) {
  return (
    <div style={{ position: 'relative' }}>
      <MagnifyingGlass
        size={15}
        style={{
          position: 'absolute', left: 12, top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-3)', pointerEvents: 'none' }}
      />
      <input
        className="search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{ paddingLeft: 36, paddingRight: value ? 32 : 12 }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            position: 'absolute', right: 8, top: '50%',
            transform: 'translateY(-50%)',
            background: 'none', cursor: 'pointer',
            color: 'var(--text-3)', display: 'flex', alignItems: 'center',
            padding: 2 }}
        >
          <X size={13} />
        </button>
      )}
    </div>
  )
}

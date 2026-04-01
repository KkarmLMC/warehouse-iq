/**
 * SearchInput
 * Standard search field with magnifying glass icon and optional clear button.
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
    <div className="search-wrap">
      <MagnifyingGlass size="0.9375rem" className="search-wrap__icon" />
      <input
        className="search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {value && (
        <button className="search-wrap__clear" onClick={() => onChange('')}>
          <X size="0.8125rem" />
        </button>
      )}
    </div>
  )
}

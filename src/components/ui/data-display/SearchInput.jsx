/**
 * SearchInput
 * Standard search field with icon and clear button — token-driven, BEM.
 *
 * Props:
 *   value       — controlled input value
 *   onChange     — (value: string) => void
 *   placeholder  — input placeholder text
 *   autoFocus   — focus on mount
 *   isLoading   — shows spinner i(
 ead of search icon
 *   onClear     — optional explicit clear handler
 *   className   — additional class names
 */
import { MagnifyingGlass, X } from '@phosphor-icons/react'

export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search\u2026',
  autoFocus,
  isLoading,
  onClear,
  className = '',
}) {
  const handleClear = () => {
    if (onClear) onClear()
    else onChange('')
  }

  return (
    <div className={`search-wrap ${className}`}>
      <span className="search-wrap__icon">
        {isLoading
          ? <span className="spinner spinner--sm" />
          : <MagnifyingGlass size="0.9375rem" />}
      </span>
      <input
        className="search-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {value && (
        <button className="search-wrap__clear" onClick={handleClear} aria-label="Clear search">
          <X size="0.8125rem" />
        </button>
      )}
    </div>
  )
}

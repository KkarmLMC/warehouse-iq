/**
 * Textarea
 * Base textarea field — resolves from field component tokens.
 * Token-driven, flat UI, BEM structure.
 *
 * Props:
 *   value       — controlled value
 *   onChange     — (e) => void
 *   placeholder  — placeholder text
 *   rows        — number of visible rows (default: 4)
 *   disabled    — disables the textarea
 *   name        — form field name
 *   id          — element id
 *   className   — additional class names
 */
export default function Textarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled,
  name,
  id,
  className = '',
  ...rest
}) {
  return (
    <textarea
      className={`form-textarea ${className}`}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      name={name}
      id={id}
      {...rest}
    />
  )
}

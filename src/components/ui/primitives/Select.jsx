/**
 * Select
 * Base select field — resolves from field component tokens.
 * Token-driven, flat UI, BEM structure.
 *
 * Props:
 *   value      — controlled value
 *   onChange    — (e) => void
 *   children   — <option> elements
 *   disabled   — disables the select
 *   name       — form field name
 *   id         — element id
 *   className  — additional class names
 */
export default function Select({
  value,
  onChange,
  children,
  disabled,
  name,
  id,
  className = '',
  ...rest
}) {
  return (
    <select
      className={`form-select ${className}`}
      value={value}
      onChange={onChange}
      disabled={disabled}
      name={name}
      id={id}
      {...rest}
    >
      {children}
    </select>
  )
}

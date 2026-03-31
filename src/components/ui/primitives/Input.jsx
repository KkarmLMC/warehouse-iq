/**
 * Input
 * Base text input — resolves from field component tokens.
 * Token-driven, flat UI, BEM structure.
 *
 * Props:
 *   value       — controlled value
 *   onChange     — (e) => void
 *   placeholder  — placeholder text
 *   type        — input type (default: 'text')
 *   disabled    — disables the input
 *   autoFocus   — focus on mount
 *   name        — form field name
 *   id          — element id
 *   className   — additional class names
 *   inputRef    — ref forwarding
 */
export default function Input({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  autoFocus,
  name,
  id,
  className = '',
  inputRef,
  ...rest
}) {
  return (
    <input
      ref={inputRef}
      className={`form-input ${className}`}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      name={name}
      id={id}
      {...rest}
    />
  )
}

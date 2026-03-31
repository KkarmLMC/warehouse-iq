/**
 * Divider
 * Horizontal divider line — uses .divider class from globals.css.
 * Token-driven, flat UI.
 *
 * Props:
 *   className — additional class names
 */
export default function Divider({ className = '' }) {
  return <div className={`divider ${className}`} />
}

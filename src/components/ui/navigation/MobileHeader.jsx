/**
 * MobileHeader
 * Standardized mobile header bar — shown only on small screens via CSS.
 * Token-driven, flat UI, BEM.
 *
 * Props:
 *   title      — page/app title
 *   onMenuOpen — hamburger menu handler
 *   action     — optional right-side JSX (e.g. IconButton)
 *   icon       — optional left icon component (defaults to hamburger List)
 */
import { List } from '@phosphor-icons/react'

export default function MobileHeader({ title, onMenuOpen, action, icon: LeftIcon }) {
  const MenuIcon = LeftIcon || List

  return (
    <header className="mobile-header">
      <button
        className="mobile-header__btn"
        onClick={onMenuOpen}
        aria-label="Open menu"
      >
        <MenuIcon size="1.125rem" />
      </button>

      <h1 className="mobile-header__title">{title}</h1>

      {action && (
        <div className="mobile-header__actions">{action}</div>
      )}
    </header>
  )
}

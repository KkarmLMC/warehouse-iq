/**
 * BottomNav
 * Shared bottom navigation bar — shown only on mobile via CSS.
 * Token-driven, flat UI, BEM.
 *
 * Props:
 *   tabs        — [{ path, Icon, label, prefix? }]
 *   currentPath — current route path
 *   onNavigate  — (path) => void
 */
export default function BottomNav({ tabs = [], currentPath, onNavigate }) {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__track">
        {tabs.map(({ path, Icon, label, prefix }) => {
          const matchPrefix = prefix || path
          const active = currentPath === path ||
            (matchPrefix !== path && currentPath.startsWith(matchPrefix + '/'))

          return (
            <button
              key={path}
              className={`bottom-nav__tab ${active ? 'bottom-nav__tab--active' : ''}`}
              onClick={() => onNavigate(path)}
            >
              <span className="bottom-nav__icon">
                <Icon size="1.375rem" weight={active ? 'fill' : 'regular'} />
              </span>
              <span className="bottom-nav__label">{label}</span>
              <span className="bottom-nav__indicator" />
            </button>
          )
        })}
      </div>
    </nav>
  )
}

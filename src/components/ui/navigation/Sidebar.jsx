/**
 * Sidebar — Shared platform shell
 * Token-driven, BEM, flat UI. All three apps share this renderer.
 * App-specific config is passed via props.
 *
 * Props:
 *   collapsed      — boolean
 *   onToggle       — toggle handler
 *   items          — [{ path, Icon, label, count?, children? }]
 *   footerItems    — [{ path, Icon, label, onClick? }]
 *   brand          — { name, subtitle, icon, badge? }
 *   currentPath    — current route
 *   onNavigate     — (path) => void
 *   headerSlot     — JSX below brand
 *   afterNavSlot   — JSX between nav and footer (e.g. alerts)
 *   footerSlot     — JSX above footer items
 *   collapseIcons  — { expanded, collapsed } JSX icons
 */
function pathMatch(itemPath, currentPath, rootPath) {
  if (itemPath === rootPath)
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

function groupIsActive(item, currentPath, rootPath) {
  if (pathMatch(item.path, currentPath, rootPath)) return true
  return item.children?.some(c => pathMatch(c.path, currentPath, rootPath)) ?? false
}

function CountBadge({ count, active }) {
  if (!count || count <= 0) return null
  return (
    <span className={`sidebar-item__count ${active ? 'sidebar-item__count--active' : ''}`}>
      {count}
    </span>
  )
}

function SubNav({ children, collapsed, onNavigate, currentPath, rootPath }) {
  return (
    <div className="sidebar-sub-nav">
      <div className="sidebar-sub-nav__track">
        {children.map(child => {
          const active = pathMatch(child.path, currentPath, rootPath)
          return (
            <button
              key={child.path}
              className={`sidebar-item sidebar-sub-item ${active ? 'sidebar-item--active' : ''}`}
              onClick={() => onNavigate(child.path)}
              title={collapsed ? child.label : undefined}
            >
              <child.Icon size="0.875rem" weight={active ? 'fill' : 'regular'} />
              {!collapsed && (
                <span className="sidebar-item-label">
                  {child.label}
                  <CountBadge count={child.count} active={active} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NavGroup({ item, collapsed, onNavigate, currentPath, rootPath }) {
  const active      = groupIsActive(item, currentPath, rootPath)
  const hasChildren = item.children?.length > 0

  return (
    <>
      <button
        className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
        onClick={() => onNavigate(item.path)}
        title={collapsed ? item.label : undefined}
      >
        <item.Icon size="1.0625rem" weight={active ? 'fill' : 'regular'} />
        {!collapsed && (
          <span className="sidebar-item-label">
            {item.label}
            <CountBadge count={item.count} active={active} />
          </span>
        )}
      </button>

      {hasChildren && !collapsed && (
        <SubNav
          children={item.children}
          collapsed={collapsed}
          onNavigate={onNavigate}
          currentPath={currentPath}
          rootPath={rootPath}
        />
      )}
    </>
  )
}

export default function Sidebar({
  collapsed,
  onToggle,
  items = [],
  footerItems = [],
  brand = {},
  currentPath = '/',
  onNavigate,
  headerSlot,
  afterNavSlot,
  footerSlot,
  collapseIcons,
}) {
  const rootPath = items[0]?.path || '/'
  const { name, subtitle, icon: BrandIcon, badge } = brand

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar-brand-row">
        {collapsed && BrandIcon
          ? <BrandIcon size="1.375rem" weight="fill" />
          : (
            <div className="sidebar__brand-text">
              {name && (
                <div className="sidebar__brand-name">
                  {name}
                  {badge && <span className="sidebar__brand-badge">{badge}</span>}
                </div>
              )}
              {subtitle && <div className="sidebar__brand-sub">{subtitle}</div>}
            </div>
          )}
      </div>

      {/* Optional header slot */}
      {headerSlot}

      {/* Main nav */}
      <nav className="sidebar-nav">
        {!collapsed && <div className="sidebar-section-label">MENU</div>}
        {items.map(item => (
          <NavGroup
            key={item.path}
            item={item}
            collapsed={collapsed}
            onNavigate={onNavigate}
            currentPath={currentPath}
            rootPath={rootPath}
          />
        ))}
      </nav>

      {/* Optional after-nav slot (e.g. alerts) */}
      {afterNavSlot}

      {/* Footer */}
      <div className="sidebar-footer-nav">
        {!collapsed && footerSlot}
        {collapsed && <div className="sidebar-footer-nav__spacer" />}

        {footerItems.map(fi => {
          const active = currentPath === fi.path
          return (
            <button
              key={fi.path || fi.label}
              className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
              onClick={() => fi.onClick ? fi.onClick() : onNavigate(fi.path)}
              title={collapsed ? fi.label : undefined}
            >
              <fi.Icon size="1.0625rem" />
              {!collapsed && <span className="sidebar-item-label">{fi.label}</span>}
            </button>
          )
        })}

        {/* Collapse toggle */}
        {onToggle && (
          <button className="sidebar-item sidebar-collapse-btn" onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            {collapseIcons
              ? (collapsed ? collapseIcons.collapsed : collapseIcons.expanded)
              : <span className="sidebar-collapse-btn__icon">{collapsed ? '\u25B6' : '\u25C0'}</span>
            }
            {!collapsed && <span className="sidebar-item-label">Collapse</span>}
          </button>
        )}
      </div>
    </aside>
  )
}

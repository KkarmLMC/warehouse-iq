import { useNavigate, useLocation } from 'react-router-dom'
import {
  Warehouse, ChartBar, Package, BookOpen,
  ArrowsLeftRight, Receipt, SignOut,
  ArrowLineLeft, ArrowLineRight,
  ClipboardText, Truck, ListBullets, UserGear,
} from '@phosphor-icons/react'
import { useAuth } from '../lib/useAuth.jsx'

// Full nav for admins/managers
const NAV_ITEMS_FULL = [
  { path: '/warehouse-hq', Icon: Warehouse, label: 'Warehouse HQ',
    children: [
      { path: '/warehouse-hq/iq',        Icon: ChartBar,        label: 'Warehouse IQ'  },
      { path: '/warehouse-hq/inventory', Icon: Package,          label: 'Inventory'     },
      { path: '/warehouse-hq/catalog',   Icon: BookOpen,         label: 'Parts Catalog' },
      { path: '/warehouse-hq/transfer',  Icon: ArrowsLeftRight,  label: 'Transfer'      },
    ],
  },
  { path: '/sales-orders',      Icon: Receipt,      label: 'Sales Orders' },
  { path: '/warehouse-hq/queue', Icon: ListBullets, label: 'SO Pipeline',
    children: [
      { path: '/warehouse-hq/queue',       Icon: ListBullets,   label: 'SO Queue'    },
      { path: '/warehouse-hq/fulfillment', Icon: ClipboardText, label: 'Fulfillment' },
      { path: '/warehouse-hq/shipment',    Icon: Truck,         label: 'Shipment'    },
    ],
  },
]

// Admin-only nav item appended dynamically in getNavItems

// Warehouse manager: SO Queue + Run Order only
const NAV_ITEMS_MANAGER = [
  { path: '/warehouse-hq',      Icon: Warehouse,    label: 'Dashboard'   },
  { path: '/warehouse-hq/queue', Icon: ListBullets, label: 'SO Queue'    },
  { path: '/warehouse-hq/inventory', Icon: Package, label: 'Inventory'   },
]

// Fulfillment worker: their queue only
const NAV_ITEMS_FULFILLMENT = [
  { path: '/warehouse-hq/fulfillment', Icon: ClipboardText, label: 'Fulfillment Queue' },
]

// Shipping worker: their queue only
const NAV_ITEMS_SHIPPING = [
  { path: '/warehouse-hq/shipment', Icon: Truck, label: 'Shipment Queue' },
]

function getNavItems(profile) {
  const pr = profile?.pipeline_role
  if (pr === 'fulfillment')       return NAV_ITEMS_FULFILLMENT
  if (pr === 'shipping')          return NAV_ITEMS_SHIPPING
  if (pr === 'warehouse_manager') return NAV_ITEMS_MANAGER
  // Admin gets full nav + user management
  if (profile?.role === 'admin') {
    return [...NAV_ITEMS_FULL, { path: '/warehouse-hq/users', Icon: UserGear, label: 'Users' }]
  }
  return NAV_ITEMS_FULL
}

function pathMatch(itemPath, currentPath) {
  if (itemPath === '/warehouse-hq') return currentPath === itemPath || (currentPath.startsWith(itemPath + '/') && !currentPath.startsWith('/sales-orders'))
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const navItems = getNavItems(profile)

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>

        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">
            <Warehouse size={18} weight="fill" style={{ color: '#fff' }} />
          </div>
          {!collapsed && (
            <div>
              <div className="sidebar-logo-name">Warehouse IQ</div>
              <div className="sidebar-logo-sub">LMC · Bolt LP</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {navItems.map(item => {
            const active = pathMatch(item.path, location.pathname)
            const hasChildren = item.children?.length > 0
            return (
              <div key={item.path} className="sidebar-group">
                <button
                  className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
                  onClick={() => navigate(item.path)}
                  title={collapsed ? item.label : undefined}
                >
                  <item.Icon size={17} weight={active ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
                  {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
                </button>

                {hasChildren && active && !collapsed && (
                  <div className="sidebar-children">
                    {item.children.map(child => {
                      const childActive = location.pathname === child.path || location.pathname.startsWith(child.path + '/')
                      return (
                        <button key={child.path}
                          className={`sidebar-item sidebar-item--child ${childActive ? 'sidebar-item--active' : ''}`}
                          onClick={() => navigate(child.path)}
                        >
                          <child.Icon size={14} weight={childActive ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
                          <span className="sidebar-item-label">{child.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer-nav">
          {!collapsed && <div className="sidebar-section-label">ACCOUNT</div>}
          {profile && !collapsed && (
            <div onClick={() => navigate('/profile')}
              className="sidebar-item"
              style={{ padding: 'var(--sp-2) var(--sp-3)', marginBottom: 'var(--sp-1)', cursor: 'pointer', borderRadius: 'var(--r-lg)' }}>
              <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name || profile.email}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', textTransform: 'capitalize', marginTop: 1 }}>
                {profile.role} · Edit profile & PIN
              </div>
            </div>
          )}
          <button onClick={handleSignOut} className="sidebar-item" title={collapsed ? 'Sign Out' : undefined}
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <SignOut size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span className="sidebar-item-label">Sign Out</span>}
          </button>
          <button className="sidebar-item sidebar-collapse-btn" onClick={onToggle}
            title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? <ArrowLineRight size={17} style={{ flexShrink: 0 }} /> : <ArrowLineLeft size={17} style={{ flexShrink: 0 }} />}
            {!collapsed && <span className="sidebar-item-label">Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Warehouse, ChartBar, Package, BookOpen,
  ArrowsLeftRight, Receipt, SignOut,
  ArrowLineLeft, ArrowLineRight,
  ClipboardText, Truck, ListBullets, UserGear,
  DeviceMobileCamera, Desktop,
} from '@phosphor-icons/react'
import { useAuth } from '../lib/useAuth.jsx'

// ─── Nav item sets ────────────────────────────────────────────────────────────

const NAV_ITEMS_FULL = [
  { path: '/warehouse-hq', Icon: Warehouse, label: 'Warehouse HQ',
    children: [
      { path: '/warehouse-hq/iq',        Icon: ChartBar,        label: 'Warehouse IQ'  },
      { path: '/warehouse-hq/inventory', Icon: Package,          label: 'Inventory'     },
      { path: '/warehouse-hq/catalog',   Icon: BookOpen,         label: 'Parts Catalog' },
      { path: '/warehouse-hq/transfer',  Icon: ArrowsLeftRight,  label: 'Transfer'      },
    ],
  },
  { path: '/sales-orders',       Icon: Receipt,     label: 'Sales Orders' },
  { path: '/warehouse-hq/queue', Icon: ListBullets, label: 'SO Pipeline',
    children: [
      { path: '/warehouse-hq/queue',       Icon: ListBullets,   label: 'SO Queue'    },
      { path: '/warehouse-hq/fulfillment', Icon: ClipboardText, label: 'Fulfillment' },
      { path: '/warehouse-hq/shipment',    Icon: Truck,         label: 'Shipment'    },
    ],
  },
]

const NAV_ITEMS_MANAGER = [
  { path: '/warehouse-hq',           Icon: Warehouse,    label: 'Dashboard'  },
  { path: '/warehouse-hq/queue',     Icon: ListBullets,  label: 'SO Queue'   },
  { path: '/warehouse-hq/inventory', Icon: Package,      label: 'Inventory'  },
]

const NAV_ITEMS_FULFILLMENT = [
  { path: '/warehouse-hq/fulfillment', Icon: ClipboardText, label: 'Fulfillment Queue' },
]

const NAV_ITEMS_SHIPPING = [
  { path: '/warehouse-hq/shipment', Icon: Truck, label: 'Shipment Queue' },
]

function getFloorItems(profile) {
  const pr = profile?.pipeline_role
  if (pr === 'fulfillment')       return NAV_ITEMS_FULFILLMENT
  if (pr === 'shipping')          return NAV_ITEMS_SHIPPING
  if (pr === 'warehouse_manager') return NAV_ITEMS_MANAGER
  return null  // no floor role — toggle not shown
}

function getFullItems(profile) {
  if (profile?.role === 'admin') {
    return [...NAV_ITEMS_FULL, { path: '/warehouse-hq/users', Icon: UserGear, label: 'Users' }]
  }
  return NAV_ITEMS_FULL
}

// ─── Path matching ────────────────────────────────────────────────────────────

function pathMatch(itemPath, currentPath) {
  if (itemPath === '/warehouse-hq')
    return currentPath === itemPath ||
      (currentPath.startsWith(itemPath + '/') && !currentPath.startsWith('/sales-orders'))
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()

  // Floor mode: persisted per device via localStorage
  const storageKey = `wiq-floor-mode-${profile?.id || 'default'}`
  const [floorMode, setFloorMode] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' }
    catch { return false }
  })

  const floorItems = getFloorItems(profile)
  const fullItems  = getFullItems(profile)

  // Only show the toggle if this user HAS a pipeline role
  const canToggle = !!floorItems

  // Which nav to actually show
  const navItems = canToggle && floorMode ? floorItems : fullItems

  const toggleFloorMode = () => {
    const next = !floorMode
    setFloorMode(next)
    try { localStorage.setItem(storageKey, String(next)) } catch {}
    // Navigate to their home page for the mode
    if (next && floorItems?.length > 0) {
      navigate(floorItems[0].path)
    } else {
      navigate('/warehouse-hq')
    }
  }

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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="sidebar-logo-name">Warehouse IQ</div>
              <div className="sidebar-logo-sub">
                {floorMode ? (
                  <span style={{ color: '#93C5FD', fontWeight: 700 }}>Floor Mode</span>
                ) : 'LMC · Bolt LP'}
              </div>
            </div>
          )}
        </div>

        {/* Floor / App mode toggle — only shown for pipeline workers */}
        {canToggle && (
          <button
            onClick={toggleFloorMode}
            title={collapsed ? (floorMode ? 'Switch to App Mode' : 'Switch to Floor Mode') : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--sp-2)',
              margin: '0 var(--sp-2) var(--sp-2)',
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--r-lg)',
              border: `1px solid ${floorMode ? '#93C5FD' : 'rgba(255,255,255,0.15)'}`,
              background: floorMode ? 'rgba(147,197,253,0.1)' : 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
              color: floorMode ? '#93C5FD' : 'rgba(255,255,255,0.55)',
              fontSize: 'var(--fs-xs)',
              fontWeight: 700,
              fontFamily: 'var(--font)',
              transition: 'all 0.15s',
              width: collapsed ? 'auto' : undefined,
              justifyContent: collapsed ? 'center' : 'flex-start',
            }}
          >
            {floorMode
              ? <Desktop size={14} style={{ flexShrink: 0 }} />
              : <DeviceMobileCamera size={14} style={{ flexShrink: 0 }} />
            }
            {!collapsed && (
              <span>{floorMode ? 'App Mode' : 'Floor Mode'}</span>
            )}
          </button>
        )}

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
                      const childActive = location.pathname === child.path
                        || location.pathname.startsWith(child.path + '/')
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
                {profile.pipeline_role
                  ? `${profile.pipeline_role.replace('_', ' ')} · ${floorMode ? 'Floor Mode' : 'App Mode'}`
                  : `${profile.role} · Edit profile & PIN`}
              </div>
            </div>
          )}
          <button onClick={handleSignOut} className="sidebar-item"
            title={collapsed ? 'Sign Out' : undefined}
            style={{ color: 'rgba(255,255,255,0.5)' }}>
            <SignOut size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span className="sidebar-item-label">Sign Out</span>}
          </button>
          <button className="sidebar-item sidebar-collapse-btn" onClick={onToggle}
            title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed
              ? <ArrowLineRight size={17} style={{ flexShrink: 0 }} />
              : <ArrowLineLeft  size={17} style={{ flexShrink: 0 }} />}
            {!collapsed && <span className="sidebar-item-label">Collapse</span>}
          </button>
        </div>
      </aside>
    </>
  )
}

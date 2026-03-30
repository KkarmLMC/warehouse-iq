import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Warehouse, ChartBar, Package, BookOpen,
  ArrowsLeftRight, Receipt, SignOut,
  ArrowLineLeft, ArrowLineRight,
  ClipboardText, Truck, ListBullets,
  DeviceMobileCamera, Desktop, User } from '@phosphor-icons/react'
import { useAuth } from '../lib/useAuth.jsx'

// ─── Nav item sets ─────────────────────────────────────────────────────────────

const NAV_ITEMS_FULL = [
  { path: '/warehouse-hq', Icon: Warehouse, label: 'Warehouse HQ',
    children: [
      { path: '/warehouse-hq/iq',        Icon: ChartBar,       label: 'Warehouse IQ'  },
      { path: '/warehouse-hq/inventory', Icon: Package,        label: 'Inventory'     },
      { path: '/warehouse-hq/catalog',   Icon: BookOpen,       label: 'Parts Catalog' },
      { path: '/warehouse-hq/transfer',  Icon: ArrowsLeftRight,label: 'Transfer'      },
    ] },
  { path: '/sales-orders',       Icon: Receipt,     label: 'Sales Orders' },
  { path: '/warehouse-hq/queue', Icon: ListBullets, label: 'SO Pipeline',
    children: [
      { path: '/warehouse-hq/queue',       Icon: ListBullets,   label: 'SO Queue'    },
      { path: '/warehouse-hq/fulfillment', Icon: ClipboardText, label: 'Fulfillment' },
      { path: '/warehouse-hq/shipment',    Icon: Truck,         label: 'Shipment'    },
    ] },
]

const NAV_ITEMS_MANAGER = [
  { path: '/warehouse-hq',           Icon: Warehouse,   label: 'Dashboard'  },
  { path: '/warehouse-hq/queue',     Icon: ListBullets, label: 'SO Queue'   },
  { path: '/warehouse-hq/inventory', Icon: Package,     label: 'Inventory'  },
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
  return null
}

function getFullItems(profile) {
  if (profile?.role === 'admin') {
    return NAV_ITEMS_FULL
  }
  return NAV_ITEMS_FULL
}

// ── Live clock ────────────────────────────────────────────────────────────────
function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setT(new Date()), 1000)
    return () => clearInterval(i)
  }, [])
  return (
    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', fontFamily: 'var(--font)' }}>
      {t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
      {' · '}
      {t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
    </span>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pathMatch(itemPath, currentPath) {
  if (itemPath === '/warehouse-hq')
    return currentPath === itemPath ||
      (currentPath.startsWith(itemPath + '/') && !currentPath.startsWith('/sales-orders'))
  return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
}

function groupIsActive(item, currentPath) {
  if (pathMatch(item.path, currentPath)) return true
  return item.children?.some(c => pathMatch(c.path, currentPath)) ?? false
}

// ─── Sub-nav ──────────────────────────────────────────────────────────────────

function SubNav({ children, collapsed, goTo, currentPath }) {
  return (
    <div style={{ overflow: 'hidden', marginTop: 2 }}>
      <div style={{ position: 'relative', paddingLeft: 4 }}>
        <div style={{
          position: 'absolute', left: '1.375rem', top: 4, bottom: 4,
          width: 1, background: 'var(--border)', borderRadius: 1 }} />
        {children.map(child => {
          const active = pathMatch(child.path, currentPath)
          return (
            <button
              key={child.path}
              className={`sidebar-item sidebar-sub-item ${active ? 'sidebar-item--active' : ''}`}
              onClick={() => goTo(child.path)}
              title={collapsed ? child.label : undefined}
              style={{ marginBottom: 1 }}
            >
              <child.Icon size={14} weight={active ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
              {!collapsed && <span className="sidebar-item-label">{child.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Nav group ────────────────────────────────────────────────────────────────

function NavGroup({ item, collapsed, goTo, currentPath }) {
  const active      = groupIsActive(item, currentPath)
  const hasChildren = item.children?.length > 0

  return (
    <>
      <button
        className={`sidebar-item ${active ? 'sidebar-item--active' : ''}`}
        onClick={() => goTo(item.path)}
        title={collapsed ? item.label : undefined}
      >
        <item.Icon size={17} weight={active ? 'fill' : 'regular'} style={{ flexShrink: 0 }} />
        {!collapsed && <span className="sidebar-item-label">{item.label}</span>}
        {collapsed && active && (
          <div style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            width: '0.25rem', height: '0.25rem', borderRadius: '50%', background: 'var(--red)' }} />
        )}
      </button>

      {hasChildren && active && !collapsed && (
        <SubNav
          children={item.children}
          collapsed={collapsed}
          goTo={goTo}
          currentPath={currentPath}
        />
      )}
    </>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()
  const goTo = (path) => navigate(path)

  // Floor mode — persisted per device
  const storageKey = `wiq-floor-mode-${profile?.id || 'default'}`
  const [floorMode, setFloorMode] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' }
    catch { return false }
  })

  const floorItems = getFloorItems(profile)
  const fullItems  = getFullItems(profile)
  const canToggle  = !!floorItems
  const navItems   = canToggle && floorMode ? floorItems : fullItems

  const toggleFloorMode = () => {
    const next = !floorMode
    setFloorMode(next)
    try { localStorage.setItem(storageKey, String(next)) } catch {}
    navigate(next && floorItems?.length > 0 ? floorItems[0].path : '/warehouse-hq')
  }

  const handleSignOut = async () => { await signOut(); navigate('/login') }

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>

        {/* Logo */}
        <div className="sidebar-brand-row">
          {collapsed
            ? <Warehouse size={22} weight="fill" style={{ color: '#fff' }} />
            : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: '#fff', letterSpacing: '-0.01em' }}>
                  Warehouse IQ
                  {floorMode && (
                    <span style={{ marginLeft: 8, fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--blue-tint-60)' }}>
                      Floor Mode
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'rgba(255,255,255,0.4)' }}>
                  LMC · Bolt LP
                </div>
              </div>
            )
          }
        </div>

        {/* Floor / App mode toggle — only for pipeline workers */}
        {canToggle && (
          <button
            onClick={toggleFloorMode}
            title={collapsed ? (floorMode ? 'Switch to App Mode' : 'Switch to Floor Mode') : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              margin: '0 var(--mar-s) var(--mar-s)',
              padding: 'var(--pad-s) var(--pad-m)',
              borderRadius: 'var(--r-l)',
              border: `1px solid ${floorMode ? 'var(--blue-tint-60)' : 'rgba(255,255,255,0.15)'}`,
              background: floorMode ? 'rgba(147,197,253,0.1)' : 'rgba(255,255,255,0.05)',
              cursor: 'pointer',
              color: floorMode ? 'var(--blue-tint-60)' : 'rgba(255,255,255,0.55)',
              fontSize: 'var(--text-xs)', fontWeight: 700,
              fontFamily: 'var(--font)', transition: 'all 0.15s',
              justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            {floorMode
              ? <Desktop size={14} style={{ flexShrink: 0 }} />
              : <DeviceMobileCamera size={14} style={{ flexShrink: 0 }} />}
            {!collapsed && <span>{floorMode ? 'App Mode' : 'Floor Mode'}</span>}
          </button>
        )}

        {/* Main nav */}
        <nav className="sidebar-nav">
          {!collapsed && <div className="sidebar-section-label">MENU</div>}

          {navItems.map(item => (
            <NavGroup
              key={item.path}
              item={item}
              collapsed={collapsed}
              goTo={goTo}
              currentPath={location.pathname}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer-nav">
          {!collapsed && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--pad-s) 0.625rem var(--pad-xs)' }}>
              <span className="sidebar-section-label" style={{ padding: 0 }}>ACCOUNT</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--success)', animation: 'livepulse 2s infinite', flexShrink: 0 }} />
                <Clock />
              </div>
            </div>
          )}
          {collapsed && <div style={{ height: '0.25rem' }} />}

          {/* Profile */}
          <button onClick={() => navigate('/profile')} className={`sidebar-item ${location.pathname === '/profile' ? 'sidebar-item--active' : ''}`} title={collapsed ? 'View Profile' : undefined}>
            <User size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span className="sidebar-item-label">View Profile</span>}
          </button>

          <button onClick={handleSignOut} className="sidebar-item"
            title={collapsed ? 'Sign Out' : undefined}
            >
            <SignOut size={17} style={{ flexShrink: 0 }} />
            {!collapsed && <span className="sidebar-item-label">Sign Out</span>}
          </button>

          <button className="sidebar-item sidebar-collapse-btn" onClick={onToggle}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
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

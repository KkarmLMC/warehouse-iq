/**
 * WIQ Sidebar — Config wrapper
 * All rendering is delegated to the shared ui/navigation/Sidebar.
 * This file owns: nav items, floor mode, auth, clock.
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Warehouse, ChartBar, Package, BookOpen,
  ArrowsLeftRight, Receipt, SignOut,
  ArrowLineLeft, ArrowLineRight,
  ClipboardText, Truck, ListBullets, AirplaneTilt, ClockCountdown,
  DeviceMobileCamera, Desktop, User, UserGear } from '@phosphor-icons/react'
import { Sidebar as SharedSidebar } from './ui'
import { useAuth } from '../lib/useAuth.jsx'

// ─── Nav item config ─────────────────────────────────────────────────────────

const NAV_ITEMS_FULL = [
  { path: '/warehouse-hq', Icon: Warehouse, label: 'Warehouse HQ',
    children: [
      { path: '/warehouse-hq/iq',        Icon: ChartBar,        label: 'Warehouse IQ'  },
      { path: '/warehouse-hq/inventory',  Icon: Package,         label: 'Inventory'     },
      { path: '/warehouse-hq/catalog',    Icon: BookOpen,        label: 'Parts Catalog' },
      { path: '/warehouse-hq/transfer',   Icon: ArrowsLeftRight, label: 'Transfer'      },
    ] },
  { path: '/sales-orders',       Icon: Receipt,     label: 'Sales Orders' },
  { path: '/warehouse-hq/queue', Icon: ListBullets, label: 'SO Pipeline',
    children: [
      { path: '/warehouse-hq/queue',       Icon: ListBullets,    label: 'SO Queue'     },
      { path: '/warehouse-hq/fulfillment', Icon: ClipboardText,  label: 'Fulfillment'  },
      { path: '/warehouse-hq/shipment',    Icon: Truck,          label: 'Shipment'     },
      { path: '/warehouse-hq/dropship',    Icon: AirplaneTilt,   label: 'Drop Ship'    },
      { path: '/warehouse-hq/backorder',   Icon: ClockCountdown, label: 'Back Orders'  },
    ] },
]

const NAV_ITEMS_MANAGER     = [
  { path: '/warehouse-hq',           Icon: Warehouse,   label: 'Dashboard'  },
  { path: '/warehouse-hq/queue',     Icon: ListBullets, label: 'SO Queue'   },
  { path: '/warehouse-hq/inventory', Icon: Package,     label: 'Inventory'  },
]
const NAV_ITEMS_FULFILLMENT = [{ path: '/warehouse-hq/fulfillment', Icon: ClipboardText, label: 'Fulfillment Queue' }]
const NAV_ITEMS_SHIPPING    = [{ path: '/warehouse-hq/shipment',    Icon: Truck,         label: 'Shipment Queue' }]

function getFloorItems(profile) {
  const pr = profile?.pipeline_role
  if (pr === 'fulfillment')       return NAV_ITEMS_FULFILLMENT
  if (pr === 'shipping')          return NAV_ITEMS_SHIPPING
  if (pr === 'warehouse_manager') return NAV_ITEMS_MANAGER
  return null
}

function getFullItems(profile) {
  const items = [...NAV_ITEMS_FULL]
  if (profile?.role === 'admin') items.push({ path: '/warehouse-hq/users', Icon: UserGear, label: 'Users' })
  return items
}

// ─── Clock ───────────────────────────────────────────────────────────────────

function Clock() {
  const [t, setT] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setT(new Date()), 1000); return () => clearInterval(i) }, [])
  return (
    <span className="sidebar-clock__text">
      {t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
      {' · '}
      {t.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
    </span>
  )
}

// ─── Sidebar (config wrapper) ────────────────────────────────────────────────

export default function Sidebar({ collapsed, onToggle }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile, signOut } = useAuth()

  // Floor mode — persisted per device
  const storageKey = `wiq-floor-mode-${profile?.id || 'default'}`
  const [floorMode, setFloorMode] = useState(() => {
    try { return localStorage.getItem(storageKey) === 'true' } catch { return false }
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

  // ── Slots ──

  const headerSlot = canToggle ? (
    <button
      onClick={toggleFloorMode}
      className={`sidebar-mode-toggle ${floorMode ? 'sidebar-mode-toggle--active' : ''}`}
      title={collapsed ? (floorMode ? 'Switch to App Mode' : 'Switch to Floor Mode') : undefined}
    >
      {floorMode
        ? <Desktop size="0.875rem" />
        : <DeviceMobileCamera size="0.875rem" />}
      {!collapsed && <span>{floorMode ? 'App Mode' : 'Floor Mode'}</span>}
    </button>
  ) : null

  const footerSlot = (
    <div className="sidebar-account-row">
      <span className="sidebar-section-label">ACCOUNT</span>
      <div className="sidebar-clock">
        <div className="sidebar-clock__dot" />
        <Clock />
      </div>
    </div>
  )

  const footerItems = [
    { path: '/profile', Icon: User,    label: 'View Profile' },
    { path: null,       Icon: SignOut,  label: 'Sign Out', onClick: handleSignOut },
  ]

  const collapseIcons = {
    expanded:  <ArrowLineLeft  size="1.0625rem" />,
    collapsed: <ArrowLineRight size="1.0625rem" />,
  }

  return (
    <SharedSidebar
      collapsed={collapsed}
      onToggle={onToggle}
      items={navItems}
      footerItems={footerItems}
      brand={{
        name: 'Warehouse IQ',
        subtitle: 'LMC · Bolt LP',
        icon: Warehouse,
        badge: floorMode ? 'Floor Mode' : null,
      }}
      currentPath={location.pathname}
      onNavigate={navigate}
      headerSlot={headerSlot}
      footerSlot={footerSlot}
      collapseIcons={collapseIcons}
    />
  )
}

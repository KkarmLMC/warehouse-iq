import { useState, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import Sidebar    from './components/Sidebar'
import BottomNav  from './components/BottomNav'
import PageSubNav from './components/PageSubNav'
import { useAuth } from './lib/useAuth.jsx'

// ─── Lazy pages ───────────────────────────────────────────────────────────────
const Login          = lazy(() => import('./pages/Login'))
const Inventory      = lazy(() => import('./pages/Inventory'))
const WarehouseIQ    = lazy(() => import('./pages/WarehouseIQ'))
const InventoryStock = lazy(() => import('./pages/InventoryStock'))
const PartsCatalog   = lazy(() => import('./pages/PartsCatalog'))
const WarehouseDetail= lazy(() => import('./pages/WarehouseDetail'))
const AddEditPart    = lazy(() => import('./pages/AddEditPart'))
const InventoryTransfer = lazy(() => import('./pages/InventoryTransfer'))
const SOQueue           = lazy(() => import('./pages/SOQueue'))
const RunOrder          = lazy(() => import('./pages/RunOrder'))
const FulfillmentQueue  = lazy(() => import('./pages/FulfillmentQueue'))
const FulfillmentDetail = lazy(() => import('./pages/FulfillmentDetail'))
const ShipmentQueue     = lazy(() => import('./pages/ShipmentQueue'))
const ShipmentDetail    = lazy(() => import('./pages/ShipmentDetail'))
const UserManagement    = lazy(() => import('./pages/UserManagement'))
const PartDetail     = lazy(() => import('./pages/PartDetail'))
const PurchaseOrders = lazy(() => import('./pages/PurchaseOrders'))
const Profile       = lazy(() => import('./pages/Profile'))
const PODetail       = lazy(() => import('./pages/PODetail'))
const PONew          = lazy(() => import('./pages/PONew'))

// ─── Page metadata ────────────────────────────────────────────────────────────
const PAGE_META = {
  '/warehouse-hq':           { title: 'Warehouse HQ',   parent: null },
  '/warehouse-hq/iq':        { title: 'Warehouse IQ',   parent: '/warehouse-hq' },
  '/warehouse-hq/inventory': { title: 'Inventory',      parent: '/warehouse-hq' },
  '/warehouse-hq/catalog':   { title: 'Parts Catalog',  parent: '/warehouse-hq' },
  '/warehouse-hq/transfer':  { title: 'Transfer',       parent: '/warehouse-hq' },
  '/sales-orders':           { title: 'Sales Orders',   parent: null } }

function getPageMeta(pathname) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname === '/warehouse-hq/add-part')                    return { title: 'Add Part',     parent: '/warehouse-hq' }
  if (pathname === '/sales-orders/new')                         return { title: 'New SO',        parent: '/sales-orders' }
  if (/^\/sales-orders\/[^/]+$/.test(pathname))                return { title: 'Sales Order',   parent: '/sales-orders' }
  if (/^\/warehouse-hq\/warehouse\/[^/]+$/.test(pathname))     return { title: 'Warehouse',     parent: '/warehouse-hq' }
  if (/^\/warehouse-hq\/part\/[^/]+\/edit$/.test(pathname))   return { title: 'Edit Part',     parent: '/warehouse-hq' }
  if (/^\/warehouse-hq\/part\/[^/]+$/.test(pathname))          return { title: 'Part Detail',   parent: '/warehouse-hq' }
  return { title: 'Warehouse IQ', parent: null }
}

// ─── Mobile header ────────────────────────────────────────────────────────────
function MobileHeader() {
  const location = useLocation()
  const navigate  = useNavigate()
  const meta = getPageMeta(location.pathname)

  return (
    <div className="mobile-header">
      {meta.parent ? (
        <button className="mobile-header__back" onClick={() => navigate(meta.parent)}>
          <ArrowLeft size={18} />
        </button>
      ) : <div style={{ width: 32 }} />}
      <span className="mobile-header__title">{meta.title}</span>
      <div style={{ width: 32 }} />
    </div>
  )
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
    <div className="spinner" />
  </div>
)

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [collapsed, setCollapsed] = useState(false)
  const { session, loading, profile } = useAuth()

  if (loading) return <Spinner />

  if (!session) return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )

  // PIN guard — loading covers both session + profile loading
  // When we reach here, profile is fully loaded. If no pin_hash → force setup
  if (session && !profile?.pin_hash) return (
    <Suspense fallback={null}>
      <Routes>
        <Route path="/login" element={<Login forcePinSetup session={session} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  )

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className="main-area">
        <MobileHeader />

        <div className="page-content-area">
          <PageSubNav />
          <Suspense fallback={<div className="page-content" style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'60vh' }}><div className="spinner"/></div>}>
            <Routes>
              <Route path="/"                                element={<Navigate to="/warehouse-hq" replace />} />
              <Route path="/warehouse-hq"                    element={<Inventory />} />
              <Route path="/warehouse-hq/iq"                 element={<WarehouseIQ />} />
              <Route path="/warehouse-hq/inventory"          element={<InventoryStock />} />
              <Route path="/warehouse-hq/catalog"            element={<PartsCatalog />} />
              <Route path="/warehouse-hq/transfer"           element={<InventoryTransfer />} />
              <Route path="/warehouse-hq/warehouse/:id"      element={<WarehouseDetail />} />
              <Route path="/warehouse-hq/add-part"           element={<AddEditPart />} />
              <Route path="/warehouse-hq/part/:id"           element={<PartDetail />} />
              <Route path="/warehouse-hq/part/:id/edit"      element={<AddEditPart />} />
              <Route path="/sales-orders"                    element={<PurchaseOrders />} />
              <Route path="/sales-orders/new"                element={<PONew />} />
              <Route path="/sales-orders/:id"                element={<PODetail />} />
              <Route path="/warehouse-hq/queue"                 element={<SOQueue />} />
              <Route path="/warehouse-hq/queue/:id"             element={<RunOrder />} />
              <Route path="/warehouse-hq/fulfillment"           element={<FulfillmentQueue />} />
              <Route path="/warehouse-hq/fulfillment/:id"       element={<FulfillmentDetail />} />
              <Route path="/warehouse-hq/shipment"              element={<ShipmentQueue />} />
              <Route path="/warehouse-hq/shipment/:id"          element={<ShipmentDetail />} />
              <Route path="/warehouse-hq/users"             element={<UserManagement />} />
              <Route path="*"                                element={<Navigate to="/warehouse-hq" replace />} />
            </Routes>
          </Suspense>
          <BottomNav />
        </div>
      </div>
    </div>
  )
}

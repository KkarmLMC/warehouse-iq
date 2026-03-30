import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

const SUB_NAV_MAP = {
  '/warehouse-hq': [
    { path: '/warehouse-hq',           label: 'Overview'      },
    { path: '/warehouse-hq/iq',        label: 'Warehouse IQ'  },
    { path: '/warehouse-hq/inventory', label: 'Inventory'     },
    { path: '/warehouse-hq/catalog',   label: 'Parts Catalog' },
    { path: '/warehouse-hq/transfer',  label: 'Transfer'      },
  ] }

const SUPPRESS = ['/warehouse-hq/add-part']

function getSubNav(pathname) {
  if (SUPPRESS.includes(pathname)) return null
  if (/^\/warehouse-hq\/part\//.test(pathname)) return null
  if (/^\/warehouse-hq\/warehouse\//.test(pathname)) return null
  if (/^\/sales-orders\/.+/.test(pathname)) return null
  for (const [prefix, items] of Object.entries(SUB_NAV_MAP)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) return items
  }
  return null
}

export default function PageSubNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const items = getSubNav(location.pathname)

  useEffect(() => {
    items ? document.body.classList.add('has-sub-nav') : document.body.classList.remove('has-sub-nav')
    return () => document.body.classList.remove('has-sub-nav')
  }, [items])

  if (!items) return null

  return (
    <div className="page-sub-nav">
      {items.map(item => (
        <button key={item.path}
          className={`page-sub-nav__item ${location.pathname === item.path ? 'page-sub-nav__item--active' : ''}`}
          onClick={() => navigate(item.path)}>
          {item.label}
        </button>
      ))}
    </div>
  )
}

import { useNavigate, useLocation } from 'react-router-dom'
import { Warehouse, Receipt, ChartBar } from '@phosphor-icons/react'

const TABS = [
  { path: '/warehouse-hq', Icon: Warehouse, label: 'Warehouse',    prefix: '/warehouse-hq' },
  { path: '/warehouse-hq/iq', Icon: ChartBar, label: 'IQ Dashboard', prefix: '/warehouse-hq/iq' },
  { path: '/sales-orders', Icon: Receipt,   label: 'Sales Orders', prefix: '/sales-orders'  },
]

export default function BottomNav() {
  const navigate  = useNavigate()
  const location  = useLocation()

  return (
    <nav className="bottom-nav">
      {TABS.map(({ path, Icon, label, prefix }) => {
        const active = location.pathname === path || (prefix !== path && location.pathname.startsWith(prefix + '/'))
        return (
          <button key={path} className={`bottom-nav__tab ${active ? 'bottom-nav__tab--active' : ''}`}
            onClick={() => navigate(path)}>
            <Icon size={22} weight={active ? 'fill' : 'regular'}
              style={{ color: active ? 'var(--red)' : 'var(--text-3)' }} />
            <span className="bottom-nav__label">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}

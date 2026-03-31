/**
 * PageSubNav
 * Horizontal sub-navigation tabs — standardized across apps.
 * Token-driven, flat UI, BEM.
 *
 * Props:
 *   items       — [{ path, label }]
 *   currentPath — current route path
 *   onNavigate  — (path) => void
 */
import { useEffect } from 'react'

export default function PageSubNav({ items = [], currentPath, onNavigate }) {
  useEffect(() => {
    if (items.length > 0) {
      document.body.classList.add('has-sub-nav')
    } else {
      document.body.classList.remove('has-sub-nav')
    }
    return () => document.body.classList.remove('has-sub-nav')
  }, [items])

  if (!items.length) return null

  return (
    <div className="page-sub-nav">
      {items.map(item => (
        <button
          key={item.path}
          className={`page-sub-nav__item ${currentPath === item.path ? 'page-sub-nav__item--active' : ''}`}
          onClick={() => onNavigate(item.path)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

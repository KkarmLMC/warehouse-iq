/**
 * AppShell
 * Top-level layout wrapper for all three apps.
 * Provides the sidebar + main-area flex shell.
 *
 * Props:
 *   sidebar   — sidebar JSX (Sidebar component i(
 ance)
 *   header    — optional mobile header JSX
 *   bottomNav — optional bottom navigation JSX
 *   subNav    — optional PageSubNav JSX
 *   children  — page content
 */
export default function AppShell({ sidebar, header, bottomNav, subNav, children }) {
  return (
    <div className="app-shell">
      {sidebar}
      <div className="main-area">
        {header}
        {subNav}
        <main className="page-content">
          <div className="page-stack fade-in">
            {children}
          </div>
        </main>
        {bottomNav}
      </div>
    </div>
  )
}

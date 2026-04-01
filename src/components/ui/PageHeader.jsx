/**
 * PageHeader
 * Standard page title block used at the top of every page.
 *
 * Props:
 *   eyebrow  — small uppercase label above title e.g. "MISSION CONTROL"
 *   title    — main page title (required)
 *   subtitle — optional muted line below title
 *   action   — optional JSX rendered top-right (e.g. a button)
 */
export default function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-title">
      <div className="page-title__text">
        {eyebrow && (
          <div className="page-title__eyebrow">{eyebrow}</div>
        )}
        <div className="page-title__heading">{title}</div>
        {subtitle && (
          <div className="page-title__subtitle">{subtitle}</div>
        )}
      </div>
      {action && (
        <div className="page-title__actions">{action}</div>
      )}
    </div>
  )
}

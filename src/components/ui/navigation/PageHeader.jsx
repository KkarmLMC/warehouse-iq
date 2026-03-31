/**
 * PageHeader
 * Standard page title block — replaces the old inline-styled version.
 * Token-driven, flat UI, BEM.
 *
 * Props:
 *   eyebrow  — small uppercase label above title e.g. "MISSION CONTROL"
 *   title    — main page title (required)
 *   subtitle — optional muted line below title
 *   action   — optional JSX rendered top-right (e.g. a button)
 *   back     — optional back handler (renders a back arrow)
 */
import { ArrowLeft } from '@phosphor-icons/react'

export default function PageHeader({ eyebrow, title, subtitle, action, back }) {
  return (
    <div className="page-title">
      {back && (
        <button className="page-title__back" onClick={back} aria-label="Go back">
          <ArrowLeft size="1.125rem" />
        </button>
      )}
      <div className="page-title__text">
        {eyebrow && <div className="page-title__eyebrow">{eyebrow}</div>}
        <h1 className="page-title__heading">{title}</h1>
        {subtitle && <p className="page-title__subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-title__actions">{action}</div>}
    </div>
  )
}

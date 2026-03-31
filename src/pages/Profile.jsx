import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Lock, Eye, EyeSlash, CheckCircle, Shield,
  ArrowLeft, Warning, PencilSimple, SignOut,
  Buildings, AppWindow, Trash, IdentificationCard } from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { logActivity } from '../lib/logActivity.js'

// ─── App source for activity logging — derived from VITE_APP_NAME ─────────────
const APP_SOURCE = (import.meta.env.VITE_APP_NAME || 'lmc_platform').toLowerCase().replace(/ /g, '_')
import { useAuth } from '../lib/useAuth.jsx'

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── PIN pad ──────────────────────────────────────────────────────────────────
function PinPad({ onComplete }) {
  const [digits, setDigits] = useState([])
  const press = (d) => {
    const next = [...digits, d]
    setDigits(next)
    if (next.length === 6) { onComplete(next.join('')); setDigits([]) }
  }
  const del = () => setDigits(d => d.slice(0, -1))
  const btnStyle = {
    height: 60, borderRadius: 'var(--r-m)',
    background: 'var(--white)',
    fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)',
    cursor: 'pointer', fontFamily: 'var(--font)',
    transition: 'all 0.12s', WebkitTapHighlightColor: 'transparent' }
  const hoverOn  = e => { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.color = 'var(--white)'; e.currentTarget.style.borderColor = 'var(--navy)' }
  const hoverOff = e => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-l)' }
  const pressOn  = e => { e.currentTarget.style.background = 'var(--navy-dark)'; e.currentTarget.style.transform = 'scale(0.97)' }
  const pressOff = e => { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.transform = 'scale(1)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 'var(--mar-xl)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < digits.length ? 'var(--navy)' : 'var(--border-l)', transition: 'background 0.1s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-m)', maxWidth: 260, margin: '0 auto' }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} style={btnStyle}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff} onMouseDown={pressOn} onMouseUp={pressOff}
            onTouchStart={hoverOn} onTouchEnd={hoverOff}>{n}</button>
        ))}
        <div />
        <button onClick={() => press('0')} style={btnStyle}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff} onMouseDown={pressOn} onMouseUp={pressOff}
          onTouchStart={hoverOn} onTouchEnd={hoverOff}>0</button>
        <button onClick={del} style={{ ...btnStyle, fontSize: 'var(--text-lg)' }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff} onMouseDown={pressOn} onMouseUp={pressOff}
          onTouchStart={hoverOn} onTouchEnd={hoverOff}>⌫</button>
      </div>
    </div>
  )
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ label, color = 'var(--navy)', bg = 'rgba(4,36,92,0.08)' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: 'var(--pad-xs) var(--pad-m)', borderRadius: 'var(--r-s)', background: bg, color, fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {label}
    </span>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children, action }) {
  return (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--pad-m) var(--pad-l)', background: 'var(--navy)', borderRadius: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', color: 'var(--white)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)' }}>
          {Icon && <Icon size="0.9375rem" />} {title}
        </div>
        {action}
      </div>
      <div style={{ padding: 'var(--pad-l)' }}>{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--pad-m)', marginBottom: 'var(--mar-m)', borderBottom: '1px solid var(--border-l)' }}>
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)' }}>{label}</div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--black)', textAlign: 'right' }}>{children}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

// ─── Activity Log Component ───────────────────────────────────────────────────
function ActivityLog({ userId }) {
  const [logs, setLogs]       = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(0)
  const PER_PAGE = 10

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    db.from('user_activity_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(page * PER_PAGE, (page + 1) * PER_PAGE - 1)
      .then(({ data }) => {
        setLogs(data || [])
        setLoading(false)
      })
  }, [userId, page])

  const fmtTime = (ts) => {
    const d = new Date(ts)
    const now = new Date()
    const diffMs = now - d
    const diffMin = Math.floor(diffMs / 60000)
    const diffH   = Math.floor(diffMs / 3600000)
    const diffD   = Math.floor(diffMs / 86400000)
    if (diffMin < 1)  return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    if (diffH   < 24) return `${diffH}h ago`
    if (diffD   < 7)  return `${diffD}d ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const APP_LABELS = { field_ops: 'Field Ops', warehouse_iq: 'Warehouse IQ', mission_control: 'Mission Control' }

  const CATEGORY_COLOR = {
    sales_order: 'var(--blue)', fulfillment: 'var(--purple)', shipment: 'var(--blue-shade-20)',
    import: 'var(--warning-text)',      profile: 'var(--grey-shade-20)',     auth: 'var(--grey-base)',
    parts: 'var(--success-dark)',       inventory: 'var(--success-dark)',   transfer: 'var(--warning-text)' }

  return (
    <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-l)' }}>
      <div style={{ padding: 'var(--pad-m) var(--pad-l)', background: 'var(--navy)', color: 'var(--white)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)' }}>
        Activity Log
      </div>
      <div style={{ padding: 'var(--pad-s) 0' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--pad-xxl)' }}>
            <div className="spinner" />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 'var(--pad-xxl)', textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>
            No activity recorded yet
          </div>
        ) : (
          <>
            {logs.map((log, i) => (
              <div key={log.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                padding: 'var(--pad-m) var(--pad-l)',
                borderBottom: i < logs.length - 1 ? '1px solid var(--border-l)' : 'none' }}>
                {/* Category dot */}
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 'var(--mar-xs)',
                  background: CATEGORY_COLOR[log.category] || 'var(--text-3)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--black)', fontWeight: 'var(--fw-medium)', lineHeight: 1.4 }}>
                    {log.label}
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--gap-s)', marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>{fmtTime(log.created_at)}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>·</span>
                    <span style={{
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)',
                      color: CATEGORY_COLOR[log.category] || 'var(--text-3)' }}>{APP_LABELS[log.app] || log.app}</span>
                  </div>
                </div>
              </div>
            ))}
            {/* Pagination */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--pad-m) var(--pad-l)' }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: page === 0 ? 'var(--text-3)' : 'var(--navy)', background: 'none', cursor: page === 0 ? 'default' : 'pointer', padding: 0 }}>
                ← Previous
              </button>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>Page {page + 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={logs.length < PER_PAGE}
                style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', color: logs.length < PER_PAGE ? 'var(--text-3)' : 'var(--navy)', background: 'none', cursor: logs.length < PER_PAGE ? 'default' : 'pointer', padding: 0 }}>
                Next →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, signOut } = useAuth()

  // Identity editing
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal]         = useState(profile?.full_name || '')
  const [nameSaving, setNameSaving]   = useState(false)

  // Password
  const [showPwForm, setShowPwForm] = useState(false)
  const [newEmail, setNewEmail]     = useState('')
  const [newPw, setNewPw]           = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [pwSaving, setPwSaving]     = useState(false)

  // PIN
  const [pinSection, setPinSection] = useState('idle') // idle | verify-old | enter-new | confirm-new
  const [newPin, setNewPin]         = useState('')
  const [pinError, setPinError]     = useState('')
  const [removingPin, setRemovingPin] = useState(false)
  const hasPin = !!profile?.pin_hash

  // Flash
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')
  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  const saveName = async () => {
    if (!nameVal.trim()) return
    setNameSaving(true)
    const { error } = await db.from('profiles').update({ full_name: nameVal.trim() }).eq('id', user.id)
    setNameSaving(false)
    if (error) { flash('Could not save name.', true); return }
    setEditingName(false)
    flash('Name updated.')
    logActivity(db, user?.id, APP_SOURCE, { category: 'profile', action: 'updated_name', label: 'Updated display name' })
  }

  const savePassword = async () => {
    if (!newPw || newPw.length < 8) { flash('Password must be at least 8 characters.', true); return }
    setPwSaving(true)
    const { error } = await db.auth.updateUser({ password: newPw, ...(newEmail ? { email: newEmail } : {}) })
    setPwSaving(false)
    if (error) { flash(error.message, true); return }
    setShowPwForm(false); setNewPw(''); setNewEmail('')
    logActivity(db, user?.id, APP_SOURCE, { category: 'profile', action: 'updated_password', label: newEmail ? 'Updated email and password' : 'Changed password' })
    flash(newEmail ? 'Email + password updated. Check your inbox to confirm.' : 'Password updated.')
  }

  const handlePinStep = async (pin) => {
    setPinError('')
    if (pinSection === 'verify-old') {
      const hashed = await hashPin(pin)
      const { data } = await db.from('profiles').select('pin_hash').eq('id', user.id).single()
      if (data?.pin_hash !== hashed) { setPinError('Incorrect PIN. Try again.'); return }
      setPinSection('enter-new')
    } else if (pinSection === 'enter-new') {
      setNewPin(pin); setPinSection('confirm-new')
    } else if (pinSection === 'confirm-new') {
      if (pin !== newPin) { setPinError("PINs don't match. Try again."); setPinSection('enter-new'); setNewPin(''); return }
      const hashed = await hashPin(pin)
      const { error } = await db.from('profiles').update({ pin_hash: hashed, pin_set_at: new Date().toISOString() }).eq('id', user.id)
      if (error) { setPinError('Could not save PIN.'); return }
      setPinSection('idle'); setNewPin('')
      flash('PIN updated. You can now log in with your PIN.')
      logActivity(db, user?.id, APP_SOURCE, { category: 'profile', action: 'updated_pin', label: 'Changed login PIN' })
    }
  }

  const removePin = async () => {
    if (!confirm('Remove your PIN? You will need to use your password to log in.')) return
    setRemovingPin(true)
    await db.from('profiles').update({ pin_hash: null, pin_set_at: null }).eq('id', user.id)
    setRemovingPin(false)
    flash('PIN removed.')
  }

  const pinLabel = {
    'verify-old':  'Enter your current PIN to continue',
    'enter-new':   hasPin ? 'Enter your new PIN' : 'Choose a 6-digit PIN',
    'confirm-new': 'Confirm your PIN' }

  const roleColors = {
    admin:   { color: 'var(--error-shade-40)', bg: 'var(--error-soft)' },
    manager: { color: 'var(--blue)', bg: 'var(--blue-soft)' },
    user:    { color: 'var(--success-dark)', bg: 'var(--success-soft)' } }
  const roleStyle = roleColors[profile?.role] || roleColors.user

  const pipelineRoleColors = {
    warehouse_manager: { color: 'var(--purple-shade-20)', bg: 'var(--purple-soft)' },
    fulfillment:       { color: 'var(--blue-shade-40)', bg: 'var(--blue-soft)' },
    shipping:          { color: 'var(--blue-shade-20)', bg: 'var(--blue-tint-80)' } }
  const pipelineStyle = pipelineRoleColors[profile?.pipeline_role] || null

  const appLabels = {
    'field-ops':     'Field Ops',
    'warehouse-iq':  'Warehouse IQ',
    'mission-control': 'Mission Control' }

  // Avatar initials
  const initials = (profile?.full_name || profile?.email || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="page-content fade-in">

      {/* Header */}
      <div style={{ marginBottom: 'var(--mar-xxl)' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', background: 'none', color: 'var(--text-3)', fontSize: 'var(--text-xs)', cursor: 'pointer', padding: 0, marginBottom: 'var(--mar-m)' }}>
          <ArrowLeft size="0.875rem" /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-l)' }}>
          {/* Avatar */}
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--white)', fontSize: 'var(--text-xl)', fontWeight: 'var(--fw-black)', flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', marginBottom: 'var(--mar-xs)' }}>ACCOUNT</div>
            <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-black)', lineHeight: 1.1 }}>{profile?.full_name || 'My Profile'}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2 }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Flash messages */}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-m)', background: 'var(--success-soft)', borderRadius: 'var(--r-l)', color: 'var(--success-text)', fontSize: 'var(--text-sm)', marginBottom: 'var(--mar-l)' }}>
          <CheckCircle size="0.9375rem" weight="fill" style={{ flexShrink: 0 }} /> {success}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-m)', background: 'var(--error-soft)', borderRadius: 'var(--r-l)', color: 'var(--error-alt)', fontSize: 'var(--text-sm)', marginBottom: 'var(--mar-l)' }}>
          <Warning size="0.9375rem" style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {/* ── Identity ── */}
      <Section icon={User} title="Identity"
        action={!editingName && (
          <button onClick={() => setEditingName(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xs) var(--pad-m)', color: 'var(--white)', fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 'var(--fw-semibold)' }}>
            <PencilSimple size="0.75rem" /> Edit Name
          </button>
        )}>

        {editingName ? (
          <div style={{ marginBottom: 'var(--mar-m)' }}>
            <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>Full Name</label>
            <div style={{ display: 'flex', gap: 'var(--gap-s)' }}>
              <input value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && saveName()} />
              <button onClick={saveName} disabled={nameSaving}
                style={{ padding: 'var(--pad-s) var(--pad-l)', borderRadius: 'var(--r-l)', background: 'var(--navy)', color: 'var(--white)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingName(false); setNameVal(profile?.full_name || '') }}
                style={{ padding: 'var(--pad-s) var(--pad-m)', borderRadius: 'var(--r-l)', background: 'transparent', fontSize: 'var(--text-sm)', cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <Row label="Full Name">{profile?.full_name || '—'}</Row>
        )}

        <Row label="Email">{user?.email || '—'}</Row>

        {profile?.division && (
          <Row label="Division">
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)' }}>
              <Buildings size="0.8125rem" style={{ color: 'var(--black)' }} />
              {profile.division}
            </span>
          </Row>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--pad-m)', marginBottom: 'var(--mar-xs)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)' }}>Member Since</div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--black)' }}>
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          </div>
        </div>
      </Section>

      {/* ── Access & Roles ── */}
      <Section icon={Shield} title="Access & Roles">

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--pad-m)', marginBottom: 'var(--mar-m)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)' }}>App Role</div>
          <RoleBadge label={profile?.role || 'user'} color={roleStyle.color} bg={roleStyle.bg} />
        </div>

        {profile?.pipeline_role && pipelineStyle && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--pad-m)', marginBottom: 'var(--mar-m)', borderBottom: '1px solid var(--border-l)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)' }}>Pipeline Role</div>
            <RoleBadge label={profile.pipeline_role.replace('_', ' ')} color={pipelineStyle.color} bg={pipelineStyle.bg} />
          </div>
        )}

        {profile?.app_access?.length > 0 && (
          <div style={{ marginBottom: 'var(--mar-m)' }}>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', marginBottom: 8 }}>App Access</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-xs)' }}>
              {profile.app_access.map(app => (
                <span key={app} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--r-s)', background: 'var(--hover)', color: 'var(--black)', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)' }}>
                  <AppWindow size="0.75rem" />
                  {appLabels[app] || app}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: 'var(--pad-m)', background: 'var(--hover)', borderRadius: 'var(--r-l)', fontSize: 'var(--text-xs)', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Role assignments are managed by your administrator. Contact admin to request changes.
        </div>
      </Section>

      {/* ── PIN ── */}
      <Section icon={Lock} title={hasPin ? 'Login PIN' : 'Set Up PIN'}
        action={pinSection !== 'idle' && (
          <button onClick={() => { setPinSection('idle'); setPinError(''); setNewPin('') }}
            style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xs) var(--pad-s)', color: 'var(--white)', fontSize: 'var(--text-xs)', cursor: 'pointer' }}>
            Cancel
          </button>
        )}>

        {pinSection === 'idle' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--pad-m)', marginBottom: 'var(--mar-m)', borderBottom: '1px solid var(--border-l)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>{hasPin ? '6-digit PIN is set ✓' : 'No PIN set'}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                  {hasPin
                    ? `Last set: ${profile?.pin_set_at ? new Date(profile.pin_set_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown'}`
                    : 'Set a PIN to log in faster — no password needed'}
                </div>
              </div>
              <button onClick={() => setPinSection(hasPin ? 'verify-old' : 'enter-new')}
                style={{ padding: 'var(--pad-s) var(--pad-l)', borderRadius: 'var(--r-l)', background: 'var(--navy)', color: 'var(--white)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {hasPin ? 'Change PIN' : 'Set PIN'}
              </button>
            </div>

            {hasPin && (
              <button onClick={removePin} disabled={removingPin}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', background: 'none', color: 'var(--error-alt)', fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', padding: 0 }}>
                <Trash size="0.8125rem" /> {removingPin ? 'Removing…' : 'Remove PIN'}
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--mar-l)' }}>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-bold)', marginBottom: 4 }}>{pinLabel[pinSection]}</div>
              {pinError && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--gap-xs)', color: 'var(--error-alt)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
                  <Warning size="0.875rem" /> {pinError}
                </div>
              )}
            </div>
            <PinPad onComplete={handlePinStep} />
          </div>
        )}
      </Section>

      {/* ── Password & Email ── */}
      <Section icon={Lock} title="Password & Email"
        action={!showPwForm && (
          <button onClick={() => setShowPwForm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-xs)', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-m)', padding: 'var(--pad-xs) var(--pad-m)', color: 'var(--white)', fontSize: 'var(--text-xs)', cursor: 'pointer', fontWeight: 'var(--fw-semibold)' }}>
            <PencilSimple size="0.75rem" /> Change
          </button>
        )}>

        {showPwForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-m)' }}>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>New Email (optional)</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Leave blank to keep current" />
            </div>
            <div>
              <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 8 characters" style={{ paddingRight: 'var(--sp-10)' }} />
                <button onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}>
                  {showPw ? <EyeSlash size="1rem" /> : <Eye size="1rem" />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--gap-s)' }}>
              <button onClick={() => { setShowPwForm(false); setNewPw(''); setNewEmail('') }}
                style={{ flex: 1, padding: 'var(--pad-s)', borderRadius: 'var(--r-l)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)' }}>
                Cancel
              </button>
              <button onClick={savePassword} disabled={pwSaving}
                style={{ flex: 2, padding: 'var(--pad-s)', borderRadius: 'var(--r-l)', background: 'var(--navy)', color: 'var(--white)', cursor: 'pointer', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)' }}>
                {pwSaving ? 'Saving…' : 'Update Password'}
              </button>
            </div>
          </div>
        ) : (
          <Row label="Password">
            <span style={{ color: 'var(--text-3)' }}>••••••••</span>
          </Row>
        )}
      </Section>

      {/* ── Sign out ── */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 'var(--mar-xxl)' }}>
        <div style={{ padding: 'var(--pad-m) var(--pad-l)', background: 'var(--navy)', color: 'var(--white)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-bold)' }}>Session</div>
        <div style={{ padding: 'var(--pad-l)' }}>
          <button onClick={() => { signOut(); navigate('/login', { replace: true }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', background: 'none', color: 'var(--error-alt)', fontWeight: 'var(--fw-bold)', fontSize: 'var(--text-sm)', cursor: 'pointer', padding: 0 }}>
            <SignOut size="1rem" /> Sign Out of this app
          </button>
        </div>
      </div>

    </div>
  )
}

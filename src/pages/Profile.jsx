import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Lock, Eye, EyeSlash, CheckCircle, Shield,
  ArrowLeft, Warning, PencilSimple, SignOut,
  Buildings, AppWindow, Trash, IdentificationCard,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
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
    height: 60, borderRadius: 'var(--r-xl)',
    border: '1px solid var(--border-l)',
    background: 'var(--surface-raised)',
    fontSize: 'var(--fs-2xl)', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--font)',
    transition: 'all 0.12s', WebkitTapHighlightColor: 'transparent',
  }
  const hoverOn  = e => { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--navy)' }
  const hoverOff = e => { e.currentTarget.style.background = 'var(--surface-raised)'; e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-l)' }
  const pressOn  = e => { e.currentTarget.style.background = '#031a45'; e.currentTarget.style.transform = 'scale(0.97)' }
  const pressOff = e => { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.transform = 'scale(1)' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 'var(--sp-5)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{ width: 14, height: 14, borderRadius: '50%', background: i < digits.length ? 'var(--navy)' : 'var(--border-l)', transition: 'background 0.1s' }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', maxWidth: 260, margin: '0 auto' }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} style={btnStyle}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff} onMouseDown={pressOn} onMouseUp={pressOff}
            onTouchStart={hoverOn} onTouchEnd={hoverOff}>{n}</button>
        ))}
        <div />
        <button onClick={() => press('0')} style={btnStyle}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff} onMouseDown={pressOn} onMouseUp={pressOff}
          onTouchStart={hoverOn} onTouchEnd={hoverOff}>0</button>
        <button onClick={del} style={{ ...btnStyle, fontSize: 'var(--fs-lg)' }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff} onMouseDown={pressOn} onMouseUp={pressOff}
          onTouchStart={hoverOn} onTouchEnd={hoverOff}>⌫</button>
      </div>
    </div>
  )
}

// ─── Role badge ───────────────────────────────────────────────────────────────
function RoleBadge({ label, color = 'var(--navy)', bg = 'rgba(4,36,92,0.08)' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: 'var(--r-full)', background: bg, color, fontSize: 'var(--fs-xs)', fontWeight: 700, textTransform: 'capitalize', letterSpacing: '0.02em' }}>
      {label}
    </span>
  )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children, action }) {
  return (
    <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-4)', border: '1px solid var(--border-l)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--sp-3) var(--sp-4)', background: 'var(--navy)', borderRadius: '0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
          {Icon && <Icon size={15} />} {title}
        </div>
        {action}
      </div>
      <div style={{ padding: 'var(--sp-4)' }}>{children}</div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-3)', borderBottom: '1px solid var(--border-l)' }}>
      <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-1)', textAlign: 'right' }}>{children}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
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
  }

  const savePassword = async () => {
    if (!newPw || newPw.length < 8) { flash('Password must be at least 8 characters.', true); return }
    setPwSaving(true)
    const { error } = await db.auth.updateUser({ password: newPw, ...(newEmail ? { email: newEmail } : {}) })
    setPwSaving(false)
    if (error) { flash(error.message, true); return }
    setShowPwForm(false); setNewPw(''); setNewEmail('')
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
    'confirm-new': 'Confirm your PIN',
  }

  const roleColors = {
    admin:   { color: '#991B1B', bg: '#FEF2F2' },
    manager: { color: '#1D4ED8', bg: '#EFF6FF' },
    user:    { color: '#065F46', bg: '#ECFDF5' },
  }
  const roleStyle = roleColors[profile?.role] || roleColors.user

  const pipelineRoleColors = {
    warehouse_manager: { color: '#6D28D9', bg: '#F5F3FF' },
    fulfillment:       { color: '#0369A1', bg: '#EFF6FF' },
    shipping:          { color: '#0891B2', bg: '#ECFEFF' },
  }
  const pipelineStyle = pipelineRoleColors[profile?.pipeline_role] || null

  const appLabels = {
    'field-ops':     'Field Ops',
    'warehouse-iq':  'Warehouse IQ',
    'mission-control': 'Mission Control',
  }

  // Avatar initials
  const initials = (profile?.full_name || profile?.email || '??').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className="page fade-in">

      {/* Header */}
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: 0, marginBottom: 'var(--sp-3)' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
          {/* Avatar */}
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 'var(--fs-xl)', fontWeight: 800, flexShrink: 0 }}>
            {initials}
          </div>
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>ACCOUNT</div>
            <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, lineHeight: 1.1 }}>{profile?.full_name || 'My Profile'}</div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>{user?.email}</div>
          </div>
        </div>
      </div>

      {/* Flash messages */}
      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)', background: 'var(--success-soft)', borderRadius: 'var(--r-lg)', color: 'var(--success-text)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
          <CheckCircle size={15} weight="fill" style={{ flexShrink: 0 }} /> {success}
        </div>
      )}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)', background: 'var(--error-soft)', borderRadius: 'var(--r-lg)', color: 'var(--error-alt)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>
          <Warning size={15} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}

      {/* ── Identity ── */}
      <Section icon={User} title="Identity"
        action={!editingName && (
          <button onClick={() => setEditingName(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-md)', padding: '3px 10px', color: '#fff', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontWeight: 600 }}>
            <PencilSimple size={12} /> Edit Name
          </button>
        )}>

        {editingName ? (
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Full Name</label>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <input value={nameVal} onChange={e => setNameVal(e.target.value)} autoFocus style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && saveName()} />
              <button onClick={saveName} disabled={nameSaving}
                style={{ padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--r-lg)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                {nameSaving ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => { setEditingName(false); setNameVal(profile?.full_name || '') }}
                style={{ padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-l)', background: 'transparent', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
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
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Buildings size={13} style={{ color: 'var(--text-3)' }} />
              {profile.division}
            </span>
          </Row>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-1)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Member Since</div>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--text-1)' }}>
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '—'}
          </div>
        </div>
      </Section>

      {/* ── Access & Roles ── */}
      <Section icon={Shield} title="Access & Roles">

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-3)', borderBottom: '1px solid var(--border-l)' }}>
          <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>App Role</div>
          <RoleBadge label={profile?.role || 'user'} color={roleStyle.color} bg={roleStyle.bg} />
        </div>

        {profile?.pipeline_role && pipelineStyle && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-3)', borderBottom: '1px solid var(--border-l)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pipeline Role</div>
            <RoleBadge label={profile.pipeline_role.replace('_', ' ')} color={pipelineStyle.color} bg={pipelineStyle.bg} />
          </div>
        )}

        {profile?.app_access?.length > 0 && (
          <div style={{ marginBottom: 'var(--sp-3)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>App Access</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {profile.app_access.map(app => (
                <span key={app} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 'var(--r-full)', background: 'var(--hover)', color: 'var(--text-2)', fontSize: 'var(--fs-xs)', fontWeight: 600 }}>
                  <AppWindow size={12} />
                  {appLabels[app] || app}
                </span>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: 'var(--sp-3)', background: 'var(--hover)', borderRadius: 'var(--r-lg)', fontSize: 'var(--fs-xs)', color: 'var(--text-3)', lineHeight: 1.5 }}>
          Role assignments are managed by your administrator. Contact admin to request changes.
        </div>
      </Section>

      {/* ── PIN ── */}
      <Section icon={Lock} title={hasPin ? 'Login PIN' : 'Set Up PIN'}
        action={pinSection !== 'idle' && (
          <button onClick={() => { setPinSection('idle'); setPinError(''); setNewPin('') }}
            style={{ border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-md)', padding: '3px 8px', color: '#fff', fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>
            Cancel
          </button>
        )}>

        {pinSection === 'idle' ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 'var(--sp-3)', marginBottom: 'var(--sp-3)', borderBottom: '1px solid var(--border-l)' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>{hasPin ? '6-digit PIN is set ✓' : 'No PIN set'}</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                  {hasPin
                    ? `Last set: ${profile?.pin_set_at ? new Date(profile.pin_set_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'unknown'}`
                    : 'Set a PIN to log in faster — no password needed'}
                </div>
              </div>
              <button onClick={() => setPinSection(hasPin ? 'verify-old' : 'enter-new')}
                style={{ padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--r-lg)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {hasPin ? 'Change PIN' : 'Set PIN'}
              </button>
            </div>

            {hasPin && (
              <button onClick={removePin} disabled={removingPin}
                style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--error-alt)', fontSize: 'var(--fs-xs)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                <Trash size={13} /> {removingPin ? 'Removing…' : 'Remove PIN'}
              </button>
            )}
          </div>
        ) : (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
              <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, marginBottom: 4 }}>{pinLabel[pinSection]}</div>
              {pinError && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--error-alt)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>
                  <Warning size={14} /> {pinError}
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
            style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-md)', padding: '3px 10px', color: '#fff', fontSize: 'var(--fs-xs)', cursor: 'pointer', fontWeight: 600 }}>
            <PencilSimple size={12} /> Change
          </button>
        )}>

        {showPwForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>New Email (optional)</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Leave blank to keep current" />
            </div>
            <div>
              <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 8 characters" style={{ paddingRight: 40 }} />
                <button onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}>
                  {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
              <button onClick={() => { setShowPwForm(false); setNewPw(''); setNewEmail('') }}
                style={{ flex: 1, padding: 'var(--sp-2)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-l)', background: 'transparent', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={savePassword} disabled={pwSaving}
                style={{ flex: 2, padding: 'var(--sp-2)', borderRadius: 'var(--r-lg)', border: 'none', background: 'var(--navy)', color: '#fff', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>
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
      <div style={{ background: 'var(--surface-raised)', borderRadius: 'var(--r-xl)', overflow: 'hidden', marginBottom: 'var(--sp-8)', border: '1px solid var(--border-l)' }}>
        <div style={{ padding: 'var(--sp-3) var(--sp-4)', background: 'var(--navy)', color: '#fff', fontSize: 'var(--fs-sm)', fontWeight: 700 }}>Session</div>
        <div style={{ padding: 'var(--sp-4)' }}>
          <button onClick={() => { signOut(); navigate('/login', { replace: true }) }}
            style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', border: 'none', background: 'none', color: 'var(--error-alt)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', padding: 0 }}>
            <SignOut size={16} /> Sign Out of this app
          </button>
        </div>
      </div>

    </div>
  )
}

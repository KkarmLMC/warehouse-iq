import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  User, Lock, Eye, EyeSlash, CheckCircle,
  ArrowLeft, Warning, PencilSimple, SignOut,
} from '@phosphor-icons/react'
import { db } from '../lib/supabase.js'
import { useAuth } from '../lib/useAuth.jsx'

// ─── SHA-256 PIN hash (same as Login.jsx) ─────────────────────────────────────
async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── PIN pad ──────────────────────────────────────────────────────────────────
function PinPad({ onComplete, disabled }) {
  const [digits, setDigits] = useState([])

  const press = (d) => {
    if (disabled) return
    const next = [...digits, d]
    setDigits(next)
    if (next.length === 6) {
      onComplete(next.join(''))
      setDigits([])
    }
  }

  const del = () => setDigits(d => d.slice(0, -1))

  return (
    <div>
      {/* Dot indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 'var(--sp-5)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < digits.length ? 'var(--navy)' : 'var(--border-l)',
            transition: 'background 0.1s',
          }} />
        ))}
      </div>
      {/* Numpad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', maxWidth: 260, margin: '0 auto' }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))}
            style={{ height: 60, borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', fontSize: 'var(--fs-2xl)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
            {n}
          </button>
        ))}
        <div /> {/* spacer */}
        <button onClick={() => press('0')}
          style={{ height: 60, borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', fontSize: 'var(--fs-2xl)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          0
        </button>
        <button onClick={del}
          style={{ height: 60, borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', fontSize: 'var(--fs-lg)', cursor: 'pointer', color: 'var(--text-2)' }}>
          ⌫
        </button>
      </div>
    </div>
  )
}

// ─── Main Profile page ────────────────────────────────────────────────────────
export default function Profile() {
  const navigate   = useNavigate()
  const { user, profile, signOut } = useAuth()

  // Edit name
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal]         = useState(profile?.full_name || '')
  const [nameSaving, setNameSaving]   = useState(false)

  // Edit email/password
  const [showPwForm, setShowPwForm]   = useState(false)
  const [newEmail, setNewEmail]       = useState('')
  const [newPw, setNewPw]             = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [pwSaving, setPwSaving]       = useState(false)

  // PIN management
  const [pinSection, setPinSection]   = useState('idle') // idle | verify-old | enter-new | confirm-new
  const [newPin, setNewPin]           = useState('')
  const [pinError, setPinError]       = useState('')
  const [pinSuccess, setPinSuccess]   = useState(false)
  const hasPin = !!profile?.pin_hash

  // Messages
  const [success, setSuccess] = useState('')
  const [error, setError]     = useState('')

  const flash = (msg, isErr = false) => {
    if (isErr) { setError(msg); setSuccess('') }
    else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  // Save name
  const saveName = async () => {
    if (!nameVal.trim()) return
    setNameSaving(true)
    const { error } = await db.from('profiles').update({ full_name: nameVal.trim() }).eq('id', user.id)
    setNameSaving(false)
    if (error) { flash('Could not save name.', true); return }
    setEditingName(false)
    flash('Name updated.')
  }

  // Save password
  const savePassword = async () => {
    if (!newPw || newPw.length < 8) { flash('Password must be at least 8 characters.', true); return }
    setPwSaving(true)
    const { error } = await db.auth.updateUser({ password: newPw, ...(newEmail ? { email: newEmail } : {}) })
    setPwSaving(false)
    if (error) { flash(error.message, true); return }
    setShowPwForm(false)
    setNewPw(''); setNewEmail('')
    flash(newEmail ? 'Email + password updated. Check your inbox to confirm.' : 'Password updated.')
  }

  // PIN flow
  const handlePinStep = async (pin) => {
    setPinError('')
    if (pinSection === 'verify-old') {
      // Verify existing PIN before allowing change
      const hashed = await hashPin(pin)
      const { data } = await db.from('profiles').select('pin_hash').eq('id', user.id).single()
      if (data?.pin_hash !== hashed) {
        setPinError('Incorrect PIN. Try again.')
        return
      }
      setPinSection('enter-new')
    } else if (pinSection === 'enter-new') {
      setNewPin(pin)
      setPinSection('confirm-new')
    } else if (pinSection === 'confirm-new') {
      if (pin !== newPin) {
        setPinError("PINs don't match. Try again.")
        setPinSection('enter-new')
        setNewPin('')
        return
      }
      const hashed = await hashPin(pin)
      const { error } = await db.from('profiles')
        .update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
        .eq('id', user.id)
      if (error) { setPinError('Could not save PIN.'); return }
      setPinSection('idle')
      setNewPin('')
      setPinSuccess(true)
      setTimeout(() => setPinSuccess(false), 3000)
      flash('PIN updated. You can now log in with your PIN.')
    }
  }

  const startPinChange = () => {
    setPinError('')
    setPinSection(hasPin ? 'verify-old' : 'enter-new')
  }

  const cancelPin = () => { setPinSection('idle'); setPinError(''); setNewPin('') }

  const pinLabel = {
    'verify-old':  'Enter your current PIN to continue',
    'enter-new':   hasPin ? 'Enter your new PIN' : 'Choose a 6-digit PIN',
    'confirm-new': 'Confirm your PIN',
  }

  return (
    <div className="page fade-in">

      {/* Page header */}
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <button onClick={() => navigate(-1)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', cursor: 'pointer', padding: 0, marginBottom: 'var(--sp-3)' }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>ACCOUNT</div>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800 }}>Profile & Security</div>
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

      {/* ── Profile info ── */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><User size={15} style={{ marginRight: 6 }} />Profile</span>
        </div>
        <div style={{ padding: 'var(--sp-4)' }}>

          {/* Name */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Full Name</div>
            {editingName ? (
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                <input value={nameVal} onChange={e => setNameVal(e.target.value)}
                  autoFocus style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && saveName()} />
                <button onClick={saveName} disabled={nameSaving}
                  style={{ padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--r-lg)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                  {nameSaving ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => { setEditingName(false); setNameVal(profile?.full_name || '') }}
                  style={{ padding: 'var(--sp-2) var(--sp-3)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border-l)', background: 'transparent', fontSize: 'var(--fs-sm)', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{profile?.full_name || '—'}</div>
                <button onClick={() => setEditingName(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>
                  <PencilSimple size={13} /> Edit
                </button>
              </div>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Email</div>
            <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600 }}>{user?.email || '—'}</div>
          </div>

          {/* Role */}
          <div>
            <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Role</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600, textTransform: 'capitalize' }}>{profile?.role || '—'}</div>
          </div>
        </div>
      </div>

      {/* ── Password ── */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title"><Lock size={15} style={{ marginRight: 6 }} />Password & Email</span>
        </div>
        <div style={{ padding: 'var(--sp-4)' }}>
          {showPwForm ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>New Email (optional)</label>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="Leave blank to keep current" />
              </div>
              <div>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>New Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)}
                    placeholder="Minimum 8 characters" style={{ paddingRight: 40 }} />
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>Password</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)' }}>Last changed: unknown</div>
              </div>
              <button onClick={() => setShowPwForm(true)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>
                <PencilSimple size={13} /> Change
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── PIN management ── */}
      <div className="card" style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="card-header">
          <span className="card-title">
            {pinSuccess
              ? <><CheckCircle size={15} weight="fill" style={{ marginRight: 6, color: '#6EE7B7' }} />PIN Updated</>
              : <><Lock size={15} style={{ marginRight: 6 }} />{hasPin ? 'Change PIN' : 'Set Up PIN'}</>
            }
          </span>
          {pinSection !== 'idle' && (
            <button onClick={cancelPin}
              style={{ border: 'none', background: 'rgba(255,255,255,0.15)', borderRadius: 'var(--r-md)', padding: '3px 8px', color: '#fff', fontSize: 'var(--fs-xs)', cursor: 'pointer' }}>
              Cancel
            </button>
          )}
        </div>
        <div style={{ padding: 'var(--sp-4)' }}>
          {pinSection === 'idle' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 600 }}>
                  {hasPin ? '6-digit PIN is set' : 'No PIN set'}
                </div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-3)', marginTop: 2 }}>
                  {hasPin
                    ? 'Use your PIN for fast login instead of your password'
                    : 'Set a PIN to log in faster on this device'
                  }
                </div>
              </div>
              <button onClick={startPinChange}
                style={{ padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--r-lg)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {hasPin ? 'Change PIN' : 'Set PIN'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 'var(--sp-4)' }}>
                <div style={{ fontSize: 'var(--fs-md)', fontWeight: 700, marginBottom: 4 }}>
                  {pinLabel[pinSection]}
                </div>
                {pinError && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--error-alt)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>
                    <Warning size={14} /> {pinError}
                  </div>
                )}
              </div>
              <PinPad onComplete={handlePinStep} />
            </div>
          )}
        </div>
      </div>

      {/* ── Sign out ── */}
      <button onClick={() => { signOut(); navigate('/login', { replace: true }) }}
        style={{ width: '100%', padding: 'var(--sp-3)', borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', background: 'transparent', color: 'var(--error-alt)', fontWeight: 700, fontSize: 'var(--fs-sm)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--sp-2)' }}>
        <SignOut size={16} /> Sign Out
      </button>

    </div>
  )
}

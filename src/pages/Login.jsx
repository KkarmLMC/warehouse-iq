import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Lightning, Eye, EyeSlash, Warning, ArrowLeft } from '@phosphor-icons/react'
import { useAuth } from '../lib/useAuth.jsx'
import { db } from '../lib/supabase.js'

// Simple hash function for PIN (SHA-256 via Web Crypto)
async function hashPin(pin) {
  const msgBuffer = new TextEncoder().encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ─── PIN Pad ──────────────────────────────────────────────────────────────────
function PinPad({ onPin, loading, error, confirmPin = null, requireConfirm = false }) {
  const [digits, setDigits] = useState([])

  // For confirm step: compare entered digits against confirmPin in real time
  const getMatchState = (idx) => {
    if (!confirmPin || idx >= digits.length) return 'empty'
    return digits[idx] === confirmPin[idx] ? 'match' : 'mismatch'
  }

  const press = (d) => {
    if (loading || digits.length >= 6) return
    setDigits(prev => [...prev, d])
  }

  const del = () => {
    if (loading) return
    setDigits(prev => prev.slice(0, -1))
  }

  const submit = () => {
    if (digits.length === 6 && !loading) {
      onPin(digits.join(''))
      setDigits([])
    }
  }

  const isFull = digits.length === 6

  // Dot color: if confirmPin provided, show match/mismatch per digit position
  const dotColor = (i) => {
    if (i >= digits.length) return 'var(--border-l)'
    if (!confirmPin) return 'var(--navy)'
    return digits[i] === confirmPin[i] ? 'var(--success)' : 'var(--error)'
  }

  const btnBase = {
    height: 64, borderRadius: 'var(--r-m)',
    border: '1px solid var(--border-l)',
    background: 'var(--white)',
    fontSize: 'var(--text-base)', fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--font)',
    transition: 'all 0.12s',
    WebkitTapHighlightColor: 'transparent',
    opacity: loading ? 0.5 : 1,
  }
  const hoverOn  = e => { if (!loading) { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--navy)' } }
  const hoverOff = e => { e.currentTarget.style.background = 'var(--white)'; e.currentTarget.style.color = ''; e.currentTarget.style.borderColor = 'var(--border-l)' }
  const pressOn  = e => { if (!loading) { e.currentTarget.style.background = 'var(--navy-dark)'; e.currentTarget.style.transform = 'scale(0.97)' } }
  const pressOff = e => { e.currentTarget.style.background = 'var(--navy)'; e.currentTarget.style.transform = 'scale(1)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--gap-l)' }}>

      {/* Dots — green/red when confirming */}
      <div style={{ display: 'flex', gap: 'var(--gap-m)', height: 20, alignItems: 'center' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            width: i < digits.length ? 16 : 14,
            height: i < digits.length ? 16 : 14,
            borderRadius: '50%',
            background: dotColor(i),
            transition: 'all 0.12s',
            boxShadow: confirmPin && i < digits.length
              ? `0 0 0 3px ${digits[i] === confirmPin[i] ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`
              : 'none',
          }} />
        ))}
      </div>

      {/* Match hint when confirming */}
      {confirmPin && isFull && (
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 700, textAlign: 'center',
          color: digits.join('') === confirmPin ? 'var(--success)' : 'var(--error)',
        }}>
          {digits.join('') === confirmPin ? '✓ PINs match' : '✗ PINs do not match'}
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-s) var(--pad-m)', background: 'var(--error-soft)', borderRadius: 'var(--r-l)', color: 'var(--error-dark)', fontSize: 'var(--text-sm)' }}>
          <Warning size={14} />{error}
        </div>
      )}

      {/* Number grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-m)', width: '100%', maxWidth: 260 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} disabled={loading}
            style={btnBase}
            onMouseEnter={hoverOn} onMouseLeave={hoverOff}
            onMouseDown={pressOn} onMouseUp={pressOff}
            onTouchStart={hoverOn} onTouchEnd={hoverOff}>
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => press('0')} disabled={loading} style={btnBase}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onMouseDown={pressOn} onMouseUp={pressOff}
          onTouchStart={hoverOn} onTouchEnd={hoverOff}>
          0
        </button>
        <button onClick={del} disabled={loading}
          style={{ ...btnBase, fontSize: 'var(--text-lg)', color: 'var(--black)' }}
          onMouseEnter={hoverOn} onMouseLeave={hoverOff}
          onMouseDown={pressOn} onMouseUp={pressOff}
          onTouchStart={hoverOn} onTouchEnd={hoverOff}>
          ⌫
        </button>
      </div>

      {/* Manual confirm button — shown when requireConfirm=true and 6 digits entered */}
      {requireConfirm ? (
        <button
          onClick={submit}
          disabled={!isFull || loading || (confirmPin && digits.join('') !== confirmPin)}
          style={{
            width: '100%', maxWidth: 260,
            padding: 'var(--pad-m)',
            borderRadius: 'var(--r-m)',
            border: 'none',
            background: !isFull || loading
              ? 'var(--border-l)'
              : confirmPin && digits.join('') !== confirmPin
                ? 'var(--error-soft)'
                : 'var(--navy)',
            color: !isFull || loading
              ? 'var(--text-3)'
              : confirmPin && digits.join('') !== confirmPin
                ? 'var(--error-dark)'
                : '#fff',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            cursor: isFull && !loading && !(confirmPin && digits.join('') !== confirmPin) ? 'pointer' : 'not-allowed',
            fontFamily: 'var(--font)',
            transition: 'all 0.15s',
          }}>
          {loading ? 'Processing…'
            : !isFull ? 'Enter 6 digits'
            : confirmPin && digits.join('') !== confirmPin ? 'PINs do not match'
            : 'Confirm PIN ✓'}
        </button>
      ) : (
        // Normal mode — auto-submits but shows confirm button at 6 digits for PIN entry step
        isFull && (
          <button
            onClick={submit}
            disabled={loading}
            style={{
              width: '100%', maxWidth: 260,
              padding: 'var(--pad-m)',
              borderRadius: 'var(--r-m)',
              border: 'none',
              background: loading ? 'var(--border-l)' : 'var(--navy)',
              color: loading ? 'var(--text-3)' : '#fff',
              fontWeight: 700, fontSize: 'var(--text-md)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font)',
              transition: 'all 0.15s',
            }}>
            {loading ? 'Processing…' : 'Continue →'}
          </button>
        )
      )}
    </div>
  )
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function Login({ forcePinSetup = false, session: forcedSession = null }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, refreshProfile } = useAuth()
  const from = location.state?.from?.pathname || '/warehouse-hq'

  const [mode, setMode] = useState('pin') // pin | password | setup-pin
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pinStep, setPinStep] = useState('enter') // enter | confirm
  const [firstPin, setFirstPin] = useState('')
  const [pendingSession, setPendingSession] = useState(null)
  const [pinSaved, setPinSaved] = useState(false)

  // ── Force PIN setup when app-level guard redirects here ─────────────────
  useEffect(() => {
    if (forcePinSetup && forcedSession) {
      setPendingSession(forcedSession)
      setPinStep('enter')
      setFirstPin('')
      setMode('setup-pin')
    }
  }, [forcePinSetup])

  // ── Password sign in ──────────────────────────────────────────────────────
  const handlePasswordLogin = async (e) => {
    e.preventDefault()
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true); setError('')
    const { data, error: authError } = await signIn(email, password)
    if (authError) {
      setError(authError.message === 'Invalid login credentials' ? 'Incorrect email or password.' : authError.message)
      setLoading(false)
      return
    }
    // Check if user has a PIN set
    const { data: profile } = await db.from('profiles').select('pin_hash').eq('id', data.session.user.id).single()
    if (!profile?.pin_hash) {
      // No PIN — offer to set one
      setPendingSession(data.session)
      setMode('setup-pin')
      setLoading(false)
    } else {
      navigate(from, { replace: true })
    }
  }

  // ── PIN login ─────────────────────────────────────────────────────────────
  const handlePinLogin = async (pin) => {
    setLoading(true); setError('')
    const hashed = await hashPin(pin)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ pin_hash: hashed }),
      })
      const data = await res.json()
      if (!res.ok) { setError('Incorrect PIN. Try again.'); setLoading(false); return }
      // Set session manually
      await db.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
      navigate(from, { replace: true })
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  // ── PIN setup (after password login) ──────────────────────────────────────
  const handlePinSetup = async (pin) => {
    if (pinStep === 'enter') {
      setFirstPin(pin)
      setPinStep('confirm')
      return
    }
    // Confirm step
    if (pin !== firstPin) {
      setError('PINs don\'t match. Try again.')
      setPinStep('enter')
      setFirstPin('')
      return
    }
    setLoading(true); setError('')
    const hashed = await hashPin(pin)
    const { error: saveErr } = await db.from('profiles')
      .update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
      .eq('id', pendingSession.user.id)
    if (saveErr) {
      setError('Could not save PIN. Try again.')
      setLoading(false)
      return
    }
    // Show success state immediately so user gets feedback
    setPinSaved(true)
    setLoading(false)
    // Refresh profile then navigate — guard will now see pin_hash and let through
    await refreshProfile()
    navigate(from, { replace: true })
  }

  return (
    <div className="login-page">
      {/* Logo */}
      <div style={{ marginBottom: 'var(--mar-xxl)', textAlign: 'center', minHeight: 148 }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--r-m)', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--mar-l)' }}>
          <Lightning size={28} weight="fill" style={{ color: '#fff' }} />
        </div>
        <div style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', fontWeight: 800, lineHeight: 1.1 }}>
          {import.meta.env.VITE_APP_NAME || 'Field Ops'}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', marginTop: 6, maxWidth: 280, margin: '6px auto 0' }}>
          Inventory, fulfillment & sales order pipeline management
        </div>
      </div>

      <div className="login-card">

        {/* ── PIN setup mode ── */}
        {mode === 'setup-pin' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--mar-xl)' }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 4 }}>
                {pinStep === 'enter' ? 'Set Your PIN' : 'Confirm PIN'}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>
                {pinStep === 'enter'
                  ? (forcePinSetup ? 'Create a PIN to continue' : 'A PIN is required to access this app')
                  : 'Enter your PIN again to confirm'}
              </div>
            </div>
            <PinPad onPin={handlePinSetup} loading={loading} error={error} requireConfirm={true} confirmPin={pinStep === 'confirm' ? firstPin : null} />

          </>
        )}

        {/* ── PIN login mode ── */}
        {mode === 'pin' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--mar-xl)' }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 4 }}>Enter PIN</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Enter your 6-digit PIN</div>
            </div>
            <PinPad onPin={handlePinLogin} loading={loading} error={error} requireConfirm={true} />
            <button onClick={() => { setMode('password'); setError('') }}
              style={{ width: '100%', marginTop: 'var(--mar-l)', padding: 'var(--pad-s)', border: 'none', background: 'none', color: 'var(--navy)', fontSize: 'var(--text-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Sign in with email instead
            </button>
          </>
        )}

        {/* ── Password login mode ── */}
        {mode === 'password' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', marginBottom: 'var(--mar-xl)' }}>
              <button onClick={() => { setMode('pin'); setError('') }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700 }}>Sign in</div>
            </div>
            <form onSubmit={handlePasswordLogin}>
              <div style={{ marginBottom: 'var(--mar-m)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" style={{ width: '100%' }} autoFocus />
              </div>
              <div style={{ marginBottom: 'var(--mar-xl)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ width: '100%', paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                    {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', padding: 'var(--pad-m)', background: 'var(--error-soft)', borderRadius: 'var(--r-l)', marginBottom: 'var(--mar-l)', color: 'var(--error-dark)', fontSize: 'var(--text-sm)' }}>
                  <Warning size={14} style={{ flexShrink: 0 }} />{error}
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 'var(--pad-m)', borderRadius: 'var(--r-l)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--text-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'var(--font)' }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: 'var(--mar-xxl)', fontSize: 'var(--text-xs)', color: 'var(--text-3)', textAlign: 'center' }}>
        Contact your administrator to create an account.
      </div>
    </div>
  )
}

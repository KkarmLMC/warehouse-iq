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

  // Dot color: data-driven based on match state (only inline style remaining)
  const dotColor = (i) => {
    if (i >= digits.length) return 'var(--border-subtle)'
    if (!confirmPin) return 'var(--brand-primary)'
    return digits[i] === confirmPin[i] ? 'var(--state-success)' : 'var(--state-error)'
  }

  return (
    <div className="pin-pad">

      {/* Dots — green/red when confirming */}
      <div className="pin-pad__dots">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}
            className={`pin-pad__dot ${i < digits.length ? 'pin-pad__dot--filled' : 'pin-pad__dot--empty'}`}
            style={{ background: dotColor(i) }} />
        ))}
      </div>

      {/* Match hint when confirming */}
      {confirmPin && isFull && (
        <div className="pin-pad__hint"
          style={{ color: digits.join('') === confirmPin ? 'var(--state-success)' : 'var(--state-error)' }}>
          {digits.join('') === confirmPin ? '✓ PINs match' : '✗ PINs do not match'}
        </div>
      )}

      {error && (
        <div className="login-error">
          <Warning size="0.875rem" />{error}
        </div>
      )}

      {/* Number grid */}
      <div className="pin-pad__grid">
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} disabled={loading}
            className="pin-btn">
            {n}
          </button>
        ))}
        <div />
        <button onClick={() => press('0')} disabled={loading} className="pin-btn">
          0
        </button>
        <button onClick={del} disabled={loading}
          className="pin-btn">
          ⌫
        </button>
      </div>

      {/* Manual confirm button */}
      {requireConfirm ? (
        <button
          onClick={submit}
          disabled={!isFull || loading || (confirmPin && digits.join('') !== confirmPin)}
          className={`pin-submit${ (!isFull || loading) ? '' : confirmPin && digits.join('') !== confirmPin ? ' pin-submit--mismatch' : ''}`}>
          {loading ? 'Processing…'
            : !isFull ? 'Enter 6 digits'
            : confirmPin && digits.join('') !== confirmPin ? 'PINs do not match'
            : 'Confirm PIN ✓'}
        </button>
      ) : (
        isFull && (
          <button
            onClick={submit}
            disabled={loading}
            className={`pin-submit${ (!isFull || loading) ? '' : confirmPin && digits.join('') !== confirmPin ? ' pin-submit--mismatch' : ''}`}>
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
  const defaultRoute = import.meta.env.VITE_DEFAULT_ROUTE
    || ({ 'Mission Control': '/opportunities', 'Warehouse IQ': '/warehouse-hq', 'Field Ops': '/dashboard' }[import.meta.env.VITE_APP_NAME] || '/dashboard')
  const from = location.state?.from?.pathname || defaultRoute

  const [mode, setMode] = useState('pin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pinStep, setPinStep] = useState('enter')
  const [firstPin, setFirstPin] = useState('')
  const [pendingSession, setPendingSession] = useState(null)
  const [pinSaved, setPinSaved] = useState(false)

  useEffect(() => {
    if (forcePinSetup && forcedSession) {
      setPendingSession(forcedSession)
      setPinStep('enter')
      setFirstPin('')
      setMode('setup-pin')
    }
  }, [forcePinSetup])

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
    try {
      const { data: profile } = await db
        .from('profiles').select('pin_hash').eq('id', data.session.user.id).single()
      if (!profile?.pin_hash) {
        setPendingSession(data.session)
        setPinStep('enter')
        setFirstPin('')
        setMode('setup-pin')
        setLoading(false)
        return
      }
    } catch (_) {
      setPendingSession(data.session)
      setPinStep('enter')
      setFirstPin('')
      setMode('setup-pin')
      setLoading(false)
      return
    }
    navigate(from, { replace: true })
  }

  const handlePinLogin = async (pin) => {
    setLoading(true); setError('')
    const hashed = await hashPin(pin)
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pin-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ pin_hash: hashed }) })
      const data = await res.json()
      if (!res.ok) { setError('Incorrect PIN. Try again.'); setLoading(false); return }
      await db.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token })
      navigate(from, { replace: true })
    } catch {
      setError('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  const handlePinSetup = async (pin) => {
    if (pinStep === 'enter') {
      setFirstPin(pin)
      setPinStep('confirm')
      return
    }
    if (pin !== firstPin) {
      setError('PINs don\'t match. Try again.')
      setPinStep('enter')
      setFirstPin('')
      return
    }
    setLoading(true); setError('')
    const hashed = await hashPin(pin)

    const { data: { user: liveUser }, error: userErr } = await db.auth.getUser()
    if (userErr || !liveUser) {
      setError('Session expired. Please sign in again.')
      setLoading(false)
      return
    }

    const { error: saveErr } = await db.from('profiles')
      .update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
      .eq('id', liveUser.id)
    if (saveErr) {
      console.error('[PIN setup] Save error:', saveErr)
      setError(`Could not save PIN. ${saveErr.message || 'Try again.'}`)
      setLoading(false)
      return
    }
    setPinSaved(true)
    setLoading(false)
    await refreshProfile()
    navigate(from, { replace: true })
  }

  return (
    <div className="login-page">
      {/* Logo */}
      <div className="login-hero">
        <div className="login-hero__icon">
          <Lightning size="1.75rem" weight="fill" />
        </div>
        <div className="login-hero__title">
          {import.meta.env.VITE_APP_NAME || 'LMC Platform'}
        </div>
        <div className="login-hero__subtitle">
          {import.meta.env.VITE_APP_SUBTITLE || 'Lightning Master Controls · Bolt Lightning Protection'}
        </div>
      </div>

      <div className="login-card">

        {/* ── PIN setup mode ── */}
        {mode === 'setup-pin' && (
          <>
            <div className="login-header">
              <div className="login-header__title">
                {pinStep === 'enter' ? 'Set Your PIN' : 'Confirm PIN'}
              </div>
              <div className="login-header__subtitle">
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
            <div className="login-header">
              <div className="login-header__title">Enter PIN</div>
              <div className="login-header__subtitle">Enter your 6-digit PIN</div>
            </div>
            <PinPad onPin={handlePinLogin} loading={loading} error={error} requireConfirm={true} />
            <button onClick={() => { setMode('password'); setError('') }}
              className="login-link-btn login-link-btn--mt">
              Sign in with email instead
            </button>
          </>
        )}

        {/* ── Password login mode ── */}
        {mode === 'password' && (
          <>
            <div className="login-header--row">
              <button onClick={() => { setMode('pin'); setError('') }} className="login-back">
                <ArrowLeft size="1.125rem" />
              </button>
              <div className="login-header__title">Sign in</div>
            </div>
            <form onSubmit={handlePasswordLogin}>
              <div className="form-field">
                <label className="form-field__label">Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" autoFocus />
              </div>
              <div className="form-field--lg">
                <label className="form-field__label">Password</label>
                <div className="form-field__input-wrap">
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPw(s => !s)} className="form-field__eye">
                    {showPw ? <EyeSlash size="1rem" /> : <Eye size="1rem" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="login-error login-error--mb">
                  <Warning size="0.875rem" />{error}
                </div>
              )}
              <button type="submit" disabled={loading} className="login-submit">
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </>
        )}
      </div>

      <div className="login-footer">
        Contact your administrator to create an account.
      </div>
    </div>
  )
}

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
            transition: 'all 0.12s' }} />
        ))}
      </div>

      {/* Match hint when confirming */}
      {confirmPin && isFull && (
        <div style={{
          fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', textAlign: 'center',
          color: digits.join('') === confirmPin ? 'var(--success)' : 'var(--error)' }}>
          {digits.join('') === confirmPin ? '✓ PINs match' : '✗ PINs do not match'}
        </div>
      )}

      {error && (
        <div className="login-error">
          <Warning size="0.875rem" />{error}
        </div>
      )}

      {/* Number grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gap-m)', width: '100%', maxWidth: 260 }}>
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

      {/* Manual confirm button — shown when requireConfirm=true and 6 digits entered */}
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
        // Normal mode — auto-submits but shows confirm button at 6 digits for PIN entry step
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
  // Default route — explicit env var, or infer from app name
  const defaultRoute = import.meta.env.VITE_DEFAULT_ROUTE
    || ({ 'Mission Control': '/opportunities', 'Warehouse IQ': '/warehouse-hq', 'Field Ops': '/dashboard' }[import.meta.env.VITE_APP_NAME] || '/dashboard')
  const from = location.state?.from?.pathname || defaultRoute

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
    // Check if user has a PIN set — block navigation until PIN is confirmed
    try {
      const { data: profile } = await db
        .from('profiles').select('pin_hash').eq('id', data.session.user.id).single()
      if (!profile?.pin_hash) {
        // No PIN — mandatory setup before entering the app
        setPendingSession(data.session)
        setPinStep('enter')
        setFirstPin('')
        setMode('setup-pin')
        setLoading(false)
        return
      }
    } catch (_) {
      // Profile fetch failed — require PIN setup as a safe default
      setPendingSession(data.session)
      setPinStep('enter')
      setFirstPin('')
      setMode('setup-pin')
      setLoading(false)
      return
    }
    navigate(from, { replace: true })
  }

  // ── PIN login ─────────────────────────────────────────────────────────────
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

    // Always get the live authenticated user — don't rely on pendingSession
    // which can be stale when arriving via the App-level forcePinSetup guard
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
          <Lightning size="1.75rem" weight="fill" style={{ color: 'var(--white)' }} />
        </div>
        <div style={{ fontSize: 'var(--text-xxl)', fontWeight: 'var(--fw-black)', lineHeight: 'var(--lh-display)', letterSpacing: 'var(--ls-xxl)' }}>
          {import.meta.env.VITE_APP_NAME || 'LMC Platform'}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)', marginTop: 'var(--mar-xs)', maxWidth: 280, margin: 'var(--mar-xs) auto 0' }}>
          {import.meta.env.VITE_APP_SUBTITLE || 'Lightning Master Controls · Bolt Lightning Protection'}
        </div>
      </div>

      <div className="login-card">

        {/* ── PIN setup mode ── */}
        {mode === 'setup-pin' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--mar-xl)' }}>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--mar-xs)' }}>
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
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--mar-xs)' }}>Enter PIN</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-3)' }}>Enter your 6-digit PIN</div>
            </div>
            <PinPad onPin={handlePinLogin} loading={loading} error={error} requireConfirm={true} />
            <button onClick={() => { setMode('password'); setError('') }}
              className="login-link-btn" style={{ marginTop: 'var(--mar-l)' }}>
              Sign in with email instead
            </button>
          </>
        )}

        {/* ── Password login mode ── */}
        {mode === 'password' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-s)', marginBottom: 'var(--mar-xl)' }}>
              <button onClick={() => { setMode('pin'); setError('') }}
                style={{ color: 'var(--text-3)', display: 'flex' }}>
                <ArrowLeft size="1.125rem" />
              </button>
              <div style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)' }}>Sign in</div>
            </div>
            <form onSubmit={handlePasswordLogin}>
              <div style={{ marginBottom: 'var(--mar-m)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" style={{ width: '100%' }} autoFocus />
              </div>
              <div style={{ marginBottom: 'var(--mar-xl)' }}>
                <label style={{ fontSize: 'var(--text-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--black)', display: 'block', marginBottom: 'var(--mar-xs)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ width: '100%', paddingRight: 'var(--sp-10)' }} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                    {showPw ? <EyeSlash size="1rem" /> : <Eye size="1rem" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="login-error" style={{ marginBottom: 'var(--mar-l)' }}>
                  <Warning size="0.875rem" style={{ flexShrink: 0 }} />{error}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="login-submit">
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

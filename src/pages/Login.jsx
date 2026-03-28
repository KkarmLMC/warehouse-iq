import { useState } from 'react'
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
function PinPad({ onPin, loading, error }) {
  const [digits, setDigits] = useState([])

  const press = (d) => {
    if (digits.length >= 6) return
    const next = [...digits, d]
    setDigits(next)
    if (next.length === 6) {
      setTimeout(() => { onPin(next.join('')); setDigits([]) }, 120)
    }
  }

  const del = () => setDigits(d => d.slice(0, -1))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-5)' }}>
      {/* Dots */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < digits.length ? 'var(--navy)' : 'var(--border-l)',
            transition: 'background 0.1s',
          }} />
        ))}
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-2) var(--sp-3)', background: '#FEF2F2', borderRadius: 'var(--r-lg)', color: '#B91C1C', fontSize: 'var(--fs-sm)' }}>
          <Warning size={14} />{error}
        </div>
      )}

      {/* Number grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--sp-3)', width: '100%', maxWidth: 260 }}>
        {[1,2,3,4,5,6,7,8,9].map(n => (
          <button key={n} onClick={() => press(String(n))} disabled={loading}
            style={{
              height: 64, borderRadius: 'var(--r-xl)',
              border: '1px solid var(--border-l)',
              background: 'var(--surface-raised)',
              fontSize: 'var(--fs-2xl)', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'var(--font)',
              transition: 'background 0.1s',
            }}
            onMouseDown={e => e.currentTarget.style.background = 'var(--hover)'}
            onMouseUp={e => e.currentTarget.style.background = 'var(--surface-raised)'}
          >
            {n}
          </button>
        ))}
        <div /> {/* spacer */}
        <button onClick={() => press('0')} disabled={loading}
          style={{ height: 64, borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', fontSize: 'var(--fs-2xl)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)' }}>
          0
        </button>
        <button onClick={del} disabled={loading}
          style={{ height: 64, borderRadius: 'var(--r-xl)', border: '1px solid var(--border-l)', background: 'var(--surface-raised)', fontSize: 'var(--fs-lg)', cursor: 'pointer', color: 'var(--text-2)' }}>
          ⌫
        </button>
      </div>
    </div>
  )
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn } = useAuth()
  const from = location.state?.from?.pathname || '/'

  const [mode, setMode] = useState('pin') // pin | password | setup-pin
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pinStep, setPinStep] = useState('enter') // enter | confirm
  const [firstPin, setFirstPin] = useState('')
  const [pendingSession, setPendingSession] = useState(null) // user after password login, before PIN set

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
    await db.from('profiles').update({ pin_hash: hashed, pin_set_at: new Date().toISOString() })
      .eq('id', pendingSession.user.id)
    navigate(from, { replace: true })
  }

  // ── Skip PIN setup ─────────────────────────────────────────────────────────
  const skipPin = () => navigate(from, { replace: true })

  return (
    <div className="login-page">
      {/* Logo */}
      <div style={{ marginBottom: 'var(--sp-8)', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 'var(--r-xl)', background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--sp-4)' }}>
          <Lightning size={28} weight="fill" style={{ color: '#fff' }} />
        </div>
        <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 800, lineHeight: 1.1 }}>
          {import.meta.env.VITE_APP_NAME || 'Field Ops'}
        </div>
        <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)', marginTop: 4 }}>
          {import.meta.env.VITE_APP_SUBTITLE || 'Lightning Master · Bolt Lightning Protection'}
        </div>
      </div>

      <div className="login-card">

        {/* ── PIN setup mode ── */}
        {mode === 'setup-pin' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-5)' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 4 }}>
                {pinStep === 'enter' ? 'Set Your PIN' : 'Confirm PIN'}
              </div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>
                {pinStep === 'enter'
                  ? 'Choose a 6-digit PIN for quick access'
                  : 'Enter your PIN again to confirm'}
              </div>
            </div>
            <PinPad onPin={handlePinSetup} loading={loading} error={error} />
            <button onClick={skipPin}
              style={{ width: '100%', marginTop: 'var(--sp-4)', padding: 'var(--sp-2)', border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 'var(--fs-sm)', cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Skip for now
            </button>
          </>
        )}

        {/* ── PIN login mode ── */}
        {mode === 'pin' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 'var(--sp-5)' }}>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700, marginBottom: 4 }}>Enter PIN</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-3)' }}>Enter your 6-digit PIN</div>
            </div>
            <PinPad onPin={handlePinLogin} loading={loading} error={error} />
            <button onClick={() => { setMode('password'); setError('') }}
              style={{ width: '100%', marginTop: 'var(--sp-4)', padding: 'var(--sp-2)', border: 'none', background: 'none', color: 'var(--navy)', fontSize: 'var(--fs-sm)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
              Sign in with email instead
            </button>
          </>
        )}

        {/* ── Password login mode ── */}
        {mode === 'password' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginBottom: 'var(--sp-5)' }}>
              <button onClick={() => { setMode('pin'); setError('') }}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0, display: 'flex' }}>
                <ArrowLeft size={18} />
              </button>
              <div style={{ fontSize: 'var(--fs-lg)', fontWeight: 700 }}>Sign in</div>
            </div>
            <form onSubmit={handlePasswordLogin}>
              <div style={{ marginBottom: 'var(--sp-3)' }}>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 'var(--sp-1)' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" style={{ width: '100%' }} autoFocus />
              </div>
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 'var(--sp-1)' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" style={{ width: '100%', paddingRight: 40 }} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}>
                    {showPw ? <EyeSlash size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', padding: 'var(--sp-3)', background: '#FEF2F2', borderRadius: 'var(--r-lg)', marginBottom: 'var(--sp-4)', color: '#B91C1C', fontSize: 'var(--fs-sm)' }}>
                  <Warning size={14} style={{ flexShrink: 0 }} />{error}
                </div>
              )}
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: 'var(--sp-3)', borderRadius: 'var(--r-lg)', border: 'none', background: 'var(--navy)', color: '#fff', fontWeight: 700, fontSize: 'var(--fs-md)', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontFamily: 'var(--font)' }}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          </>
        )}
      </div>

      <div style={{ marginTop: 'var(--sp-6)', fontSize: 'var(--fs-xs)', color: 'var(--text-3)', textAlign: 'center' }}>
        Contact your administrator to create an account.
      </div>
    </div>
  )
}

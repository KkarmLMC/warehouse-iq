/**
 * useAuth — real Supabase Auth hook
 * Replaces hardcoded useRole with session-backed auth.
 * Provides: user, profile, role, isManagement, isField, isWarehouse, isAdmin
 */

import { useState, useEffect, createContext, useContext } from 'react'
import { db } from './supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession]     = useState(undefined) // undefined = loading
  const [profile, setProfile]     = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    // Get initial session
    db.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else setSession(null)
    })

    // Listen for auth changes
    const { data: { subscription } } = db.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) loadProfile(session.user.id)
      else { setProfile(null); setProfileLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    setProfileLoading(true)
    const { data } = await db.from('profiles').select('*').eq('id', userId).single()
    setProfile(data)
    setProfileLoading(false)
  }

  const signIn = async (email, password) => {
    const { data, error } = await db.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signOut = async () => {
    await db.auth.signOut()
  }

  const role = profile?.role || 'field'

  const value = {
    session,
    user: session?.user || null,
    profile,
    role,
    isAdmin:      role === 'admin',
    isManagement: role === 'management' || role === 'admin',
    isWarehouse:  role === 'warehouse'  || role === 'admin',
    isField:      role === 'field'      || role === 'admin',
    loading:      session === undefined || profileLoading,
    signIn,
    signOut,
    refreshProfile: () => session?.user ? loadProfile(session.user.id) : Promise.resolve() }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Drop-in replacement for old useRole hook
export default function useRole() {
  const { role, isManagement, isField, isWarehouse, isAdmin } = useAuth()
  return { role, isManagement, isField, isWarehouse, isAdmin }
}

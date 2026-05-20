import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const run = async () => {
      if (!session?.user) {
        setProfile(null)
        setLoading(false)
        return
      }
      setLoading(true)
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('profile fetch error', error)
      }
      setProfile(data || null)
      setLoading(false)
    }
    run()
    return () => { active = false }
  }, [session?.user?.id])

  const refreshProfile = async () => {
    if (!session?.user) return
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle()
    setProfile(data || null)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthCtx.Provider value={{ session, user: session?.user || null, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthCtx.Provider>
  )
}

export function useAuth() {
  return useContext(AuthCtx)
}

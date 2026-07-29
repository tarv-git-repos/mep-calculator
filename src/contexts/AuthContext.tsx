import { createContext, useContext, useEffect, useState } from 'react'
import { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type Profile = {
  id: string
  email: string
  role: 'ADMIN' | 'USER'
  subscription_status: string
  subscription_expires: string
  features: {
    voltageDrop: boolean
    loadSchedule: boolean
    cableSizing: boolean
    shortCircuit: boolean
  }
}

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextType>({ session: null, user: null, profile: null, loading: true })

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = async (userId: string, userEmail?: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    if (data) {
      if (userEmail === 'admin@tarv.ai') {
        data.role = 'ADMIN'
      } else {
        data.role = 'USER'
      }
      setProfile(data)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    }).catch(err => {
      console.error("Supabase getSession error:", err);
      setLoading(false);
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchProfile(session.user.id, session.user.email).finally(() => setLoading(false))
      } else {
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ session, user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  return useContext(AuthContext)
}

import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { logActivity } from '@/utils/logger'
import { Lock, Mail } from 'lucide-react'

export const Route = createFileRoute('/login')({
  component: Login,
})

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const navigate = useNavigate()
  const { session, profile } = useAuth()

  // Redirect if already logged in
  useEffect(() => {
    if (session && profile) {
      if (profile.role === 'ADMIN') {
        navigate({ to: '/admin' })
      } else {
        navigate({ to: '/' })
      }
    }
  }, [session, profile, navigate])
  
  if (session) {
    return null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    if (error) {
      if (error.message.includes('Email not confirmed')) {
        setError('Please check your inbox and click the confirmation link to activate your account.')
      } else {
        setError(error.message)
      }
    } else {
      if (data?.user?.id) {
        logActivity(data.user.id, 'LOGIN');
      }
      navigate({ to: '/' })
    }
    setLoading(false)
  }

  const handleSignUp = async () => {
    if (!email || !password) {
      setError("Please enter an email and password to sign up.")
      return
    }
    setLoading(true)
    setError(null)
    
    const { error } = await supabase.auth.signUp({ email, password })
    
    if (error) {
      if (error.message.includes('rate limit')) {
        setError('Too many attempts. Please try again in an hour, or use the Supabase Dashboard to create your admin account.')
      } else {
        setError(error.message)
      }
    } else {
      setError("Success! We've sent a confirmation link to your email. Please click it to activate your account.")
    }
    setLoading(false)
  }

  const handleResetPassword = async (e: React.MouseEvent) => {
    e.preventDefault()
    if (!email) {
      setError("Please enter your email address first.")
      return
    }
    setLoading(true)
    setError(null)
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset-password',
    })
    
    if (error) {
      setError(error.message)
    } else {
      setError("Success! Check your email for a password reset link.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 dark:text-white">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Or{' '}
          <a href="#" className="font-medium text-blue-600 hover:text-blue-500">
            start your 14-day free trial
          </a>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-slate-900 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-slate-200 dark:border-slate-800">
          <form className="space-y-6" onSubmit={handleLogin}>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 p-3 rounded text-sm">
                {error}
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-md p-2 border"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:text-white rounded-md p-2 border"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <button type="button" onClick={handleResetPassword} className="font-medium text-blue-600 hover:text-blue-500">
                  Forgot your password?
                </button>
              </div>
            </div>

            <div className="flex flex-col space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Sign in'}
              </button>
              
              <button
                type="button"
                onClick={handleSignUp}
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-slate-300 dark:border-slate-700 rounded-md shadow-sm text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Create new account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

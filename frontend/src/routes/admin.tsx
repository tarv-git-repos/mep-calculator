import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { SuperAdminDashboard } from '@/components/admin/SuperAdminDashboard'
import { OrgAdminDashboard } from '@/components/admin/OrgAdminDashboard'
import { Loader2 } from 'lucide-react'

export const Route = createFileRoute('/admin')({
  component: AdminRoutingComponent,
})

function AdminRoutingComponent() {
  const { session, profile, loading } = useAuth()
  const navigate = useNavigate()
  
  useEffect(() => {
    if (!loading && (!session || !profile)) {
      navigate({ to: '/login' })
    }
  }, [session, profile, loading, navigate])

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (profile.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboard />
  }

  if (profile.role === 'ORG_ADMIN') {
    return <OrgAdminDashboard />
  }

  // Fallback for regular users who somehow bypassed the root auth guard
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-white p-4 text-center">
      <h2 className="text-2xl font-bold text-red-500 mb-2">Access Denied</h2>
      <p className="text-slate-400">You do not have permission to view the admin panel.</p>
      <button 
        onClick={() => navigate({ to: '/' })}
        className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
      >
        Return to Home
      </button>
    </div>
  )
}

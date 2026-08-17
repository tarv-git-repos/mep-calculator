import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, Component, ReactNode } from 'react'
import { SuperAdminDashboard } from '@/components/admin/SuperAdminDashboard'
import { OrgAdminDashboard } from '@/components/admin/OrgAdminDashboard'
import { Loader2 } from 'lucide-react'

class AdminErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Admin Dashboard Error Caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-slate-950 text-white min-h-screen flex flex-col items-center justify-center text-center">
          <h2 className="text-xl font-bold text-red-400 mb-2">Admin Control Panel Error</h2>
          <p className="text-sm text-slate-400 max-w-md mb-4">{this.state.error?.message || "An unexpected rendering error occurred."}</p>
          <button 
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm cursor-pointer"
          >
            Reload Admin Panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    return (
      <AdminErrorBoundary>
        <SuperAdminDashboard />
      </AdminErrorBoundary>
    )
  }

  if (profile.role === 'ORG_ADMIN') {
    return (
      <AdminErrorBoundary>
        <OrgAdminDashboard />
      </AdminErrorBoundary>
    )
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

import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, ShieldAlert, Trash2, Settings, DownloadCloud, Users, HardDrive, Settings as SettingsIcon, LogOut, FolderOpen, Save, CheckCircle2, ArrowLeft, Activity, Megaphone } from "lucide-react"
import { NAV } from "@/config/navigation"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { open, confirm } from '@tauri-apps/plugin-dialog'

import { createClient } from '@supabase/supabase-js'

// Create a secondary client specifically for admin user creation without overwriting the current session
const adminAuthClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'admin-auth-temp-key'
    }
  }
)

export const Route = createFileRoute('/admin')({
  component: AdminDashboard,
})

type Profile = {
  id: string
  email: string
  role: 'ADMIN' | 'USER'
  subscription_status: string
  subscription_expires: string
  features?: any
}

type ActivityLog = {
  id: string
  user_id: string
  action_type: string
  details: any
  created_at: string
  profiles?: {
    email: string
  }
}

type Announcement = {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_active: boolean
  created_at: string
}

function AdminDashboard() {
  const { session, user } = useAuth()
  const navigate = useNavigate()
  
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'storage' | 'settings' | 'activity' | 'broadcasts'>('users')
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState('')
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'error'>('info')

  // State for Add User modal
  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isAddingUser, setIsAddingUser] = useState(false)

  // State for Permissions editing
  const [editingPermissionsFor, setEditingPermissionsFor] = useState<Profile | null>(null)

  // State for Expiry editing
  const [editingExpiryFor, setEditingExpiryFor] = useState<string | null>(null)
  const [newExpiryDate, setNewExpiryDate] = useState<string>('')
  
  const [localBackupPath, setLocalBackupPath] = useState(localStorage.getItem('localBackupPath') || '')
  const [serverBackupPath, setServerBackupPath] = useState(localStorage.getItem('serverBackupPath') || '')

  useEffect(() => {
    if (!session) {
      navigate({ to: '/login' })
      return
    }

    const checkAdminStatus = async () => {
      // Hardcoded Admin logic
      if (session.user.email === 'admin@tarv.ai') {
        setIsAdmin(true)
        fetchProfiles()
      } else {
        setIsAdmin(false)
      }
      setChecking(false)
    }

    checkAdminStatus()
  }, [session, navigate])

  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  useEffect(() => {
    if (!isAdmin && session) {
      // Fetch debug info
      supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({data, error}) => {
        setDebugInfo({ data, error, userId: session.user.id })
      })
    }
  }, [isAdmin, session])

  const fetchProfiles = async () => {
    setLoadingProfiles(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('email')
    
    if (data) setProfiles(data)
    setLoadingProfiles(false)
  }

  const fetchActivityLogs = async () => {
    setLoadingLogs(true)
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*, profiles(email)')
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) setActivityLogs(data)
    setLoadingLogs(false)
  }

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (data) setAnnouncements(data)
    setLoadingAnnouncements(false)
  }

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityLogs()
    if (activeTab === 'broadcasts') fetchAnnouncements()
  }, [activeTab])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAnnouncementMsg.trim()) return

    const { error } = await supabase
      .from('announcements')
      .insert([{ message: newAnnouncementMsg, type: newAnnouncementType }])
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Broadcast created successfully!")
      setNewAnnouncementMsg('')
      fetchAnnouncements()
    }
  }

  const toggleAnnouncement = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from('announcements')
      .update({ is_active: !currentStatus })
      .eq('id', id)
    
    if (error) toast.error(error.message)
    else fetchAnnouncements()
  }

  const deleteAnnouncement = async (id: string) => {
    const choice = await confirm("Delete this broadcast permanently?", { title: "Delete Broadcast", confirmText: "Delete", cancelText: "Cancel" })
    if (!choice) return

    const { error } = await supabase.from('announcements').delete().eq('id', id)
    if (error) toast.error(error.message)
    else fetchAnnouncements()
  }

  const toggleRole = async (profileId: string, currentRole: string) => {
    if (profileId === session?.user?.id) {
      toast.error("You cannot change your own role.")
      return
    }
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN'
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', profileId)
    
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Role updated successfully")
      fetchProfiles()
    }
  }

  const deleteUser = async (profileId: string, email: string) => {
    if (profileId === session?.user?.id) {
      toast.error("You cannot delete your own account.")
      return
    }
    const choice = await confirm(`Are you sure you want to delete ${email}?\n\nThey will permanently lose access to the application.`, { title: "Delete User", confirmText: "Delete", cancelText: "Cancel" })
    if (!choice) return

    const { error } = await supabase.from('profiles').delete().eq('id', profileId)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("User deleted successfully")
      fetchProfiles()
    }
  }

  const [signUpErrorDetails, setSignUpErrorDetails] = useState<string | null>(null)

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) return
    setSignUpErrorDetails(null)
    setIsAddingUser(true)
    
    try {
      const { data, error } = await adminAuthClient.auth.signUp({
        email: newEmail,
        password: newPassword
      })

      if (error) {
        if (error.message.includes('rate limit')) {
          toast.error('Supabase Rate Limit Reached!')
          setSignUpErrorDetails('Supabase free tier limits emails to 3 per hour. Wait an hour or add them in the Supabase Dashboard.')
        } else {
          toast.error(error.message)
          setSignUpErrorDetails(JSON.stringify(error, null, 2))
        }
      } else {
        if (data?.user) {
          // Explicitly create the profile record in case the database trigger is missing
          const { error: profileError } = await supabase.from('profiles').upsert({
            id: data.user.id,
            email: newEmail,
            role: 'USER',
            subscription_expires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'TRIAL',
            features: {}
          });
          
          if (profileError) {
            console.error("Profile creation error:", profileError);
            toast.error("User auth created, but profile failed!");
            setSignUpErrorDetails('Profile Database Error: ' + JSON.stringify(profileError, null, 2));
            setIsAddingUser(false)
            return;
          }
        }
        
        toast.success("User added successfully!")
        setShowAddUser(false)
        setNewEmail('')
        setNewPassword('')
        fetchProfiles()
      }
    } catch (err: any) {
      toast.error("Unexpected error occurred")
      setSignUpErrorDetails(err.message || JSON.stringify(err))
    }
    
    setIsAddingUser(false)
  }

  const saveExpiry = async (profileId: string) => {
    if (!newExpiryDate) return;
    
    const dateStr = new Date(newExpiryDate).toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ subscription_expires: dateStr })
      .eq('id', profileId);
      
    if (error) {
      toast.error("Failed to update expiry: " + error.message)
    } else {
      toast.success("Expiry date updated successfully!")
      setEditingExpiryFor(null)
      fetchProfiles()
    }
  }

  const toggleFeature = async (featureKey: string) => {
    if (!editingPermissionsFor) return;
    
    // Check if currently unlocked (true or undefined). If unlocked, new value is false.
    const isCurrentlyUnlocked = editingPermissionsFor.features?.[featureKey] !== false;
    
    const updatedFeatures = {
      ...editingPermissionsFor.features,
      [featureKey]: !isCurrentlyUnlocked
    };
    
    // Optimistic UI update
    setEditingPermissionsFor({ ...editingPermissionsFor, features: updatedFeatures });
    
    const { error } = await supabase
      .from('profiles')
      .update({ features: updatedFeatures })
      .eq('id', editingPermissionsFor.id);
      
    if (error) {
      toast.error("Failed to update permission: " + error.message);
    } else {
      fetchProfiles();
    }
  }

  const handlePickFolder = async (type: 'local' | 'server') => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })
      if (selected && typeof selected === 'string') {
        if (type === 'local') {
          setLocalBackupPath(selected)
          localStorage.setItem('localBackupPath', selected)
          toast.success("Local backup path updated!")
        } else {
          setServerBackupPath(selected)
          localStorage.setItem('serverBackupPath', selected)
          toast.success("Server backup path updated!")
        }
      }
    } catch (e) {
      toast.error("Failed to open directory picker. Ensure you are running the desktop app.")
    }
  }



  if (checking) return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have administrator privileges to view this page.</p>
        
        {debugInfo && (
          <div className="mt-8 p-4 bg-slate-200 dark:bg-slate-800 rounded-lg text-left max-w-md w-full overflow-auto">
            <h3 className="font-bold mb-2">Debug Info (Take a screenshot):</h3>
            <pre className="text-xs text-slate-700 dark:text-slate-300">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        <button 
          onClick={handleLogout}
          className="mt-6 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer mr-2"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </Link>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
              <ShieldAlert className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Admin Control Panel</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-500/10 rounded-lg hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        <div className="flex gap-6">
          {/* Sidebar Tabs */}
          <div className="w-64 shrink-0 flex flex-col gap-2">
            <button 
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Users size={18} />
              User Access
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'activity' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Activity size={18} />
              Activity Logs
            </button>
            <button 
              onClick={() => setActiveTab('broadcasts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'broadcasts' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Megaphone size={18} />
              Broadcasts
            </button>
            <button 
              onClick={() => setActiveTab('storage')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'storage' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <HardDrive size={18} />
              Server & Sync
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden min-h-[600px]">
            {activeTab === 'users' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Manage Users</h2>
                  <div className="flex items-center gap-3">
                    <button onClick={fetchProfiles} className="text-sm text-blue-600 hover:underline">Refresh</button>
                    <button 
                      onClick={() => setShowAddUser(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      + Add User
                    </button>
                  </div>
                </div>

                {showAddUser && (
                  <div className="mb-6 p-5 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl">
                    <h3 className="text-sm font-semibold mb-3">Create New Engineer</h3>
                    <form onSubmit={handleAddUser} className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                        <input 
                          type="email" 
                          required 
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
                        <input 
                          type="password" 
                          required 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isAddingUser}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isAddingUser ? 'Creating...' : 'Create'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowAddUser(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </form>
                    {signUpErrorDetails && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Failed to create user:</p>
                        <pre className="text-xs text-red-500 whitespace-pre-wrap font-mono overflow-auto max-h-40">{signUpErrorDetails}</pre>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Role</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Expires</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loadingProfiles ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500">Loading...</td></tr>
                      ) : profiles.length === 0 ? (
                        <tr><td colSpan={5} className="py-8 text-center text-slate-500">No users found.</td></tr>
                      ) : (
                        profiles.map((p) => (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-4 font-medium">{p.email}</td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.role === 'ADMIN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {p.role}
                              </span>
                            </td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.subscription_status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                {p.subscription_status}
                              </span>
                            </td>
                            <td className="py-4 text-slate-500">
                              {editingExpiryFor === p.id ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="date" 
                                    value={newExpiryDate.split('T')[0]} 
                                    onChange={(e) => setNewExpiryDate(e.target.value)}
                                    className="p-1 border rounded text-xs"
                                  />
                                  <button onClick={() => saveExpiry(p.id)} className="text-blue-600 font-medium text-xs hover:underline">Save</button>
                                  <button onClick={() => setEditingExpiryFor(null)} className="text-slate-500 font-medium text-xs hover:underline">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{new Date(p.subscription_expires).toLocaleDateString()}</span>
                                  <button 
                                    onClick={() => {
                                      setEditingExpiryFor(p.id);
                                      setNewExpiryDate(new Date(p.subscription_expires).toISOString().split('T')[0]);
                                    }}
                                    className="text-blue-600 text-[10px] uppercase font-bold tracking-wider hover:underline opacity-60 hover:opacity-100"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-4 text-right space-x-2 whitespace-nowrap">
                              <button 
                                onClick={() => setEditingPermissionsFor(p)}
                                className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded text-xs font-medium transition-colors"
                              >
                                Permissions
                              </button>
                              <button 
                                onClick={() => toggleRole(p.id, p.role)}
                                className="px-3 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-xs font-medium transition-colors"
                              >
                                Toggle Role
                              </button>
                              <button 
                                onClick={() => deleteUser(p.id, p.email)}
                                className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded text-xs font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Activity Logs</h2>
                  <button onClick={fetchActivityLogs} className="text-sm text-blue-600 hover:underline">Refresh</button>
                </div>
                
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500">
                        <tr>
                          <th className="px-6 py-4 font-medium">Timestamp</th>
                          <th className="px-6 py-4 font-medium">User</th>
                          <th className="px-6 py-4 font-medium">Action</th>
                          <th className="px-6 py-4 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {loadingLogs ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                              Loading logs...
                            </td>
                          </tr>
                        ) : activityLogs.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                              No activity logs found.
                            </td>
                          </tr>
                        ) : (
                          activityLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="px-6 py-4 text-slate-500">
                                {new Date(log.created_at).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 font-medium">
                                {log.profiles?.email || 'Unknown User'}
                              </td>
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  log.action_type === 'LOGIN' ? 'bg-green-100 text-green-800' :
                                  log.action_type === 'VIEW_CALCULATOR' ? 'bg-blue-100 text-blue-800' :
                                  'bg-slate-100 text-slate-800'
                                }`}>
                                  {log.action_type}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-slate-500">
                                {log.details?.path || JSON.stringify(log.details)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'broadcasts' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Global Broadcasts</h2>
                  <button onClick={fetchAnnouncements} className="text-sm text-blue-600 hover:underline">Refresh</button>
                </div>

                <div className="mb-8 p-5 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl">
                  <h3 className="text-sm font-semibold mb-3">Create New Broadcast</h3>
                  <form onSubmit={handleCreateAnnouncement} className="flex gap-3">
                    <div className="flex-1">
                      <input 
                        type="text"
                        placeholder="Type your message here (e.g., Update 2.0 is coming tomorrow)"
                        required
                        value={newAnnouncementMsg}
                        onChange={(e) => setNewAnnouncementMsg(e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <select
                      value={newAnnouncementType}
                      onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                      className="text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 w-32"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      Broadcast
                    </button>
                  </form>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Past Broadcasts</h3>
                  {loadingAnnouncements ? (
                    <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
                  ) : announcements.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">No broadcasts found.</div>
                  ) : (
                    announcements.map((ann) => (
                      <div key={ann.id} className={`p-4 rounded-xl border flex items-center justify-between ${
                        ann.is_active 
                          ? 'border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/20' 
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-75'
                      }`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                              ann.type === 'warning' ? 'bg-amber-100 text-amber-800' :
                              ann.type === 'error' ? 'bg-red-100 text-red-800' :
                              ann.type === 'success' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {ann.type}
                            </span>
                            <span className="text-xs text-slate-500">{new Date(ann.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm font-medium">{ann.message}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleAnnouncement(ann.id, ann.is_active)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${ann.is_active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${ann.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                          <button onClick={() => deleteAnnouncement(ann.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'storage' && (
              <div className="p-6">
                <h2 className="text-xl font-bold mb-6">Server & Sync Settings</h2>
                
                <div className="space-y-8 max-w-2xl">
                  {/* Local Backup */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                        <HardDrive className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">10-Minute Local Backup (AppData)</h3>
                        <p className="text-sm text-slate-500 mb-4">Automatically save project versions locally every 10 minutes to prevent data loss.</p>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={localBackupPath} 
                            onChange={(e) => setLocalBackupPath(e.target.value)}
                            placeholder="C:\Users\Admin\AppData\Local\MEPCalc\Backups"
                            className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                          />
                          <button 
                            onClick={() => handlePickFolder('local')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                          >
                            <FolderOpen className="w-4 h-4" />
                            Browse
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Server Backup */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                        <Save className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg">1-Hour Server Backup</h3>
                        <p className="text-sm text-slate-500 mb-4">Automatically sync a major version of the project to your local server drive or cloud sync folder every hour.</p>
                        
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            value={serverBackupPath} 
                            onChange={(e) => setServerBackupPath(e.target.value)}
                            placeholder="Z:/00 R&D Server/Backups"
                            className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                          />
                          <button 
                            onClick={() => handlePickFolder('server')}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
                          >
                            <FolderOpen className="w-4 h-4" />
                            Browse
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                    <button 
                      onClick={() => {
                        localStorage.setItem('localBackupPath', localBackupPath);
                        localStorage.setItem('serverBackupPath', serverBackupPath);
                        toast.success("Backup paths saved successfully!");
                      }}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Save Backup Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Permissions Modal */}
      {editingPermissionsFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">App Permissions</h3>
                <p className="text-sm text-slate-500">{editingPermissionsFor.email}</p>
              </div>
              <button onClick={() => setEditingPermissionsFor(null)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            
            <div className="p-0 max-h-[65vh] overflow-y-auto">
              {NAV.map((navItem, i) => {
                if (navItem.kind !== 'group') return null;
                const items = navItem.children.filter(c => !c.isHeader && c.to);
                if (items.length === 0) return null;
                
                return (
                  <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 p-6 space-y-4">
                    <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500 mb-2">{navItem.label}</h4>
                    {items.map((item, j) => {
                      const routeKey = item.to!.replace('/', '');
                      const isUnlocked = editingPermissionsFor.features?.[routeKey] !== false;
                      
                      return (
                        <div key={j} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <div>
                            <h4 className="font-medium text-sm">{item.label}</h4>
                            <p className="text-xs text-slate-500">Path: {item.to}</p>
                          </div>
                          <button 
                            onClick={() => toggleFeature(routeKey)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isUnlocked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isUnlocked ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 text-right">
              <button 
                onClick={() => setEditingPermissionsFor(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

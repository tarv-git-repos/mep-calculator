import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, ShieldAlert, Trash2, Settings, DownloadCloud, Users, HardDrive, Settings as SettingsIcon, LogOut, FolderOpen, Save, CheckCircle2, ArrowLeft, Activity, Megaphone, Key, Copy, Building, Crown, UserCheck } from "lucide-react"
import { NAV } from "@/config/navigation"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { api } from '@/services/api'
import { useConfirm } from '@/hooks/use-confirm'

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



type Profile = {
  id: string
  email: string
  role: string
  subscription_status: string
  subscription_expires: string
  features?: any
  organization_id?: string
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

export function SuperAdminDashboard() {
  const { session, profile, userData, user } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'organizations' | 'storage' | 'settings' | 'activity' | 'broadcasts' | 'licenses'>('users')
  
  // License management state
  const [licensesList, setLicensesList] = useState<any[]>([])
  const [trialsList, setTrialsList] = useState<any[]>([])
  const [loadingLicenses, setLoadingLicenses] = useState(false)
  const [genTier, setGenTier] = useState<'PRO' | 'ENTERPRISE'>('PRO')
  const [genDays, setGenDays] = useState<number>(365)
  const [genTargetEmail, setGenTargetEmail] = useState<string>('')
  const [generatedAdminKey, setGeneratedAdminKey] = useState<string>('')
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL')

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('ALL')
  const [logSearchQuery, setLogSearchQuery] = useState<string>('')
  const [logOrgFilter, setLogOrgFilter] = useState<string>('ALL')

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

  const [organizations, setOrganizations] = useState<any[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgPlan, setNewOrgPlan] = useState('PRO')
  const [newOrgUsers, setNewOrgUsers] = useState(5)
  const [isAddingOrg, setIsAddingOrg] = useState(false)

  const fetchOrganizations = async () => {
    setLoadingOrganizations(true)
    const res = await api.getOrganizations()
    setOrganizations(res)
    setLoadingOrganizations(false)
  }

  const handleAddOrg = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOrgName) return toast.error("Organization name is required")
    setIsAddingOrg(true)
    const res = await api.createOrganization({ name: newOrgName, subscription_plan: newOrgPlan, max_users: newOrgUsers })
    if (res.success) {
      toast.success("Organization created successfully!")
      setShowAddOrg(false)
      setNewOrgName('')
      fetchOrganizations()
    } else {
      toast.error(res.message || "Failed to create organization")
    }
    setIsAddingOrg(false)
  }

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
        fetchOrganizations()
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
      api.getUsers().then(users => {
        const myUser = users.find((u: any) => u.id === session.user.id)
        setDebugInfo({ data: myUser, error: null, userId: session.user.id })
      })
    }
  }, [isAdmin, session])

  const fetchProfiles = async () => {
    setLoadingProfiles(true)
    const users = await api.getUsers()
    
    // Map custom_users to the expected profiles shape
    const mappedProfiles = users.map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.role || 'USER',
      name: u.name,
      subscription_expires: u.subscription_expires || null,
      status: u.isAccountVerified ? 'ACTIVE' : 'TRIAL',
      features: u.features || {},
      organization_id: u.organization_id
    }))
    
    setProfiles(mappedProfiles)
    setLoadingProfiles(false)
  }

  const fetchActivityLogs = async () => {
    setLoadingLogs(true)
    const logs = await api.getAdminActivityLogs()
    
    // The previous format used 'profiles(email)' but our new API provides the email directly as 'email'
    // Let's ensure the UI gets the expected structure
    const mappedLogs = logs.map((log: any) => ({
      ...log,
      profiles: { email: log.email }
    }))
    
    setActivityLogs(mappedLogs)
    setLoadingLogs(false)
  }

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    const data = await api.getAnnouncements()
    if (data) setAnnouncements(data)
    setLoadingAnnouncements(false)
  }

  const fetchAdminLicenses = async () => {
    setLoadingLicenses(true)
    const res = await authService.adminListLicenses()
    if (res && res.success) {
      setLicensesList(res.licenses || [])
      setTrialsList(res.trials || [])
    }
    setLoadingLicenses(false)
  }

  const fetchOrgBackupSettings = async (orgId?: string) => {
    const targetId = orgId || (selectedOrgFilter !== 'ALL' && selectedOrgFilter !== 'UNASSIGNED' ? selectedOrgFilter : '');
    const res = await api.getOrgBackupSettings(targetId);
    if (res && res.success) {
      setLocalBackupPath(res.local_backup_path || '');
      setServerBackupPath(res.server_backup_path || '');
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityLogs()
    if (activeTab === 'broadcasts') fetchAnnouncements()
    if (activeTab === 'licenses') fetchAdminLicenses()
    if (activeTab === 'organizations') fetchOrganizations()
    if (activeTab === 'storage') fetchOrgBackupSettings()
  }, [activeTab])

  const handleAdminGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await authService.adminGenerateLicenseKey(genTier, genDays, genTargetEmail)
    if (res && res.success) {
      setGeneratedAdminKey(res.key)
      toast.success(res.message || "License Key Generated!")
      fetchAdminLicenses()
    } else {
      toast.error(res.message || "Failed to generate key")
    }
  }

  const handleAdminRevokeKey = async (key: string) => {
    const choice = await confirm(`Revoke license key ${key}? User will lose Pro access immediately.`, { title: "Revoke License Key", confirmText: "Revoke", cancelText: "Cancel" })
    if (!choice) return
    const res = await authService.adminRevokeLicenseKey(key)
    if (res && res.success) {
      toast.success(res.message || "License Key Revoked")
      fetchAdminLicenses()
    } else {
      toast.error(res.message || "Revocation failed")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAnnouncementMsg.trim()) return

    const res = await api.createAnnouncement(newAnnouncementMsg, true)
    
    if (!res.success) {
      toast.error(res.message)
    } else {
      toast.success("Broadcast created successfully!")
      setNewAnnouncementMsg('')
      fetchAnnouncements()
    }
  }

  const toggleAnnouncement = async (id: string, currentStatus: boolean) => {
    const res = await api.toggleAnnouncement(id, !currentStatus)
    
    if (!res.success) toast.error(res.message)
    else fetchAnnouncements()
  }

  const deleteAnnouncement = async (id: string) => {
    const choice = await confirm("Delete this broadcast permanently?", { title: "Delete Broadcast", confirmText: "Delete", cancelText: "Cancel" })
    if (!choice) return

    const res = await api.deleteAnnouncement(id)
    if (!res.success) toast.error(res.message)
    else fetchAnnouncements()
  }

  const toggleRole = async (profileId: string, currentRole: string) => {
    if (profileId === session?.user?.id) {
      toast.error("You cannot change your own role.")
      return
    }
    
    let newRole = 'USER'
    if (currentRole === 'USER') newRole = 'ORG_ADMIN'
    else if (currentRole === 'ORG_ADMIN') newRole = 'SUPER_ADMIN'
    else newRole = 'USER'
    
    const res = await api.adminToggleRole(profileId, newRole)
    
    if (!res.success) {
      toast.error(res.message)
    } else {
      toast.success("Role updated successfully")
      fetchProfiles()
    }
  }

  const deleteUser = async (profileId: string, email: string) => {
    const currentId = userData?.id || profile?.id;
    const currentEmail = userData?.email || profile?.email;
    if (profileId === currentId || email === currentEmail) {
      toast.error("You cannot delete your own account.");
      return;
    }
    const choice = await confirm(`Are you sure you want to delete ${email}?\n\nThey will permanently lose access to the application.`, { title: "Delete User", confirmText: "Delete", cancelText: "Cancel" });
    if (!choice) return;

    const res = await api.adminDeleteUser(profileId);
    
    if (!res.success) {
      toast.error(res.message);
    } else {
      toast.success("User deleted successfully");
      fetchProfiles();
    }
  };

  const [signUpErrorDetails, setSignUpErrorDetails] = useState<string | null>(null)

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) return
    setSignUpErrorDetails(null)
    setIsAddingUser(true)
    
    // Disabled during custom auth migration
    toast.error("User creation via Admin panel temporarily disabled during backend migration")
    
    setIsAddingUser(false)
  }

  const saveExpiry = async (profileId: string) => {
    if (!newExpiryDate) return;
    
    const dateStr = new Date(newExpiryDate).toISOString();
    const res = await api.adminUpdateProfile(profileId, { subscription_expires: dateStr });
      
    if (!res.success) {
      toast.error("Failed to update expiry: " + res.message)
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
    
    // Also update the main profiles list immediately to prevent stale data when re-opening
    setProfiles(prevProfiles => prevProfiles.map(p => 
      p.id === editingPermissionsFor.id ? { ...p, features: updatedFeatures } : p
    ));
    
    const res = await api.adminUpdateProfile(editingPermissionsFor.id, { features: updatedFeatures });
      
    if (!res.success) {
      toast.error("Failed to update permission: " + res.message);
      // Optional: Revert state here on failure
    }
  }

  const toggleSection = async (items: any[]) => {
    if (!editingPermissionsFor) return;

    // Check if ALL items in this section are currently unlocked. If so, new value is false. Else, true.
    const allUnlocked = items.every(item => editingPermissionsFor.features?.[item.to!.replace('/', '')] !== false);
    const newValue = !allUnlocked;

    const updatedFeatures = { ...editingPermissionsFor.features };
    items.forEach(item => {
      const routeKey = item.to!.replace('/', '');
      updatedFeatures[routeKey] = newValue;
    });

    setEditingPermissionsFor({ ...editingPermissionsFor, features: updatedFeatures });
    setProfiles(prevProfiles => prevProfiles.map(p => 
      p.id === editingPermissionsFor.id ? { ...p, features: updatedFeatures } : p
    ));

    const res = await api.adminUpdateProfile(editingPermissionsFor.id, { features: updatedFeatures });
    if (!res.success) {
      toast.error("Failed to update section permissions: " + res.message);
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

  const assignOrganization = async (profileId: string, orgId: string) => {
    const res = await api.adminUpdateProfile(profileId, { organization_id: orgId || null })
    if (res.success) {
      toast.success("Organization assigned successfully!")
      fetchProfiles()
    } else {
      toast.error("Failed to assign organization")
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
              onClick={() => setActiveTab('organizations')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'organizations' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Users size={18} />
              Organizations
            </button>
            <button 
              onClick={() => setActiveTab('broadcasts')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'broadcasts' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Megaphone size={18} />
              Broadcasts
            </button>
            <button 
              onClick={() => setActiveTab('licenses')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'licenses' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-bold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
            >
              <Key size={18} />
              Key Manager & Licensing
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Users by Organization</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Select an organization from the dropdown to view its members, organization admin representative, and seat usage.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={fetchProfiles} className="text-sm text-blue-600 hover:underline font-medium">Refresh</button>
                    <button 
                      onClick={() => setShowAddUser(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      + Add User
                    </button>
                  </div>
                </div>

                {/* Requirement: Organization Selector Dropdown */}
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3 flex-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
                      <Building size={16} className="text-blue-600" />
                      Select Organization:
                    </label>
                    <select
                      value={selectedOrgFilter}
                      onChange={(e) => setSelectedOrgFilter(e.target.value)}
                      className="text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 max-w-md w-full shadow-xs cursor-pointer"
                    >
                      <option value="ALL">🏢 All Organizations & Members ({profiles.length} total users)</option>
                      <option value="UNASSIGNED">👤 Unassigned Users (No Organization) ({profiles.filter(p => !p.organization_id && p.role !== 'SUPER_ADMIN').length})</option>
                      {organizations.map(org => {
                        const count = profiles.filter(p => p.organization_id === org.id).length;
                        const orgAdmin = profiles.find(p => p.organization_id === org.id && p.role === 'ORG_ADMIN');
                        const adminStr = orgAdmin ? ` — Admin: ${orgAdmin.email}` : '';
                        return (
                          <option key={org.id} value={org.id}>
                            🏢 {org.name} ({count} users{adminStr})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="text-xs font-semibold text-slate-500">
                    Showing {profiles.filter(p => {
                      if (selectedOrgFilter === 'ALL') return true;
                      if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                      return p.organization_id === selectedOrgFilter;
                    }).length} Users
                  </div>
                </div>

                {/* Requirement: Organization Admin Representative Card */}
                {selectedOrgFilter !== 'ALL' && selectedOrgFilter !== 'UNASSIGNED' && (() => {
                  const currentOrg = organizations.find(o => o.id === selectedOrgFilter);
                  if (!currentOrg) return null;
                  const currentOrgAdmin = profiles.find(p => p.organization_id === currentOrg.id && p.role === 'ORG_ADMIN');
                  const currentOrgUsers = profiles.filter(p => p.organization_id === currentOrg.id);

                  return (
                    <div className="mb-6 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/60 dark:bg-purple-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                          {currentOrg.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{currentOrg.name}</h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {currentOrg.subscription_plan || 'PRO PLAN'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span className="font-semibold text-purple-700 dark:text-purple-400">Organization Representative / Admin:</span>
                            {currentOrgAdmin ? (
                              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <Crown size={14} className="text-amber-500" /> {currentOrgAdmin.email}
                              </span>
                            ) : (
                              <span className="italic text-slate-400">No Org Admin assigned yet</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-900/40 font-medium">
                          <span className="text-slate-500">Seats Used: </span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">{currentOrgUsers.length}</span> / {currentOrg.max_users || 5} Max Seats
                        </div>
                      </div>
                    </div>
                  );
                })()}

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
                        <th className="pb-3 font-medium">Organization</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Expires</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loadingProfiles ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">Loading...</td></tr>
                      ) : profiles.filter(p => {
                        if (selectedOrgFilter === 'ALL') return true;
                        if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                        return p.organization_id === selectedOrgFilter;
                      }).length === 0 ? (
                        <tr><td colSpan={6} className="py-8 text-center text-slate-500">No users found for this organization selection.</td></tr>
                      ) : (
                        profiles
                          .filter(p => {
                            if (selectedOrgFilter === 'ALL') return true;
                            if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                            return p.organization_id === selectedOrgFilter;
                          })
                          .map((p) => (
                          <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-4 font-medium flex items-center gap-2">
                              {p.role === 'ORG_ADMIN' && <Crown size={15} className="text-amber-500 shrink-0" title="Organization Admin Representative" />}
                              <span>{p.email}</span>
                            </td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : p.role === 'ORG_ADMIN' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
                                {p.role === 'ORG_ADMIN' ? 'ORG ADMIN (Rep)' : p.role}
                              </span>
                            </td>
                            <td className="py-4">
                              {p.role === 'SUPER_ADMIN' ? (
                                <span className="text-slate-400 text-xs italic">N/A</span>
                              ) : (
                                <select 
                                  value={p.organization_id || ''}
                                  onChange={(e) => assignOrganization(p.id, e.target.value)}
                                  className="text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-[150px] truncate cursor-pointer font-medium"
                                >
                                  <option value="">No Organization</option>
                                  {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                  ))}
                                </select>
                              )}
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
                                  <span>{p.subscription_expires ? new Date(p.subscription_expires).toLocaleDateString() : 'Never'}</span>
                                  <button 
                                    onClick={() => {
                                      setEditingExpiryFor(p.id);
                                      setNewExpiryDate(p.subscription_expires ? new Date(p.subscription_expires).toISOString().split('T')[0] : '');
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

            {activeTab === 'organizations' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Manage Organizations</h2>
                  <div className="flex items-center gap-3">
                    <button onClick={fetchOrganizations} className="text-sm text-blue-600 hover:underline">Refresh</button>
                    <button 
                      onClick={() => setShowAddOrg(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      + Create Organization
                    </button>
                  </div>
                </div>

                {showAddOrg && (
                  <div className="mb-6 p-5 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl">
                    <h3 className="text-sm font-semibold mb-3">Create New Organization</h3>
                    <form onSubmit={handleAddOrg} className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Org Name</label>
                        <input 
                          type="text" 
                          required 
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="w-32">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Plan</label>
                        <select 
                          value={newOrgPlan}
                          onChange={(e) => setNewOrgPlan(e.target.value)}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        >
                          <option value="PRO">PRO</option>
                          <option value="ENTERPRISE">ENTERPRISE</option>
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Max Users</label>
                        <input 
                          type="number" 
                          min="1"
                          required 
                          value={newOrgUsers}
                          onChange={(e) => setNewOrgUsers(parseInt(e.target.value))}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isAddingOrg}
                        className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isAddingOrg ? 'Creating...' : 'Create'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowAddOrg(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </form>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                        <th className="pb-3 font-medium">Name</th>
                        <th className="pb-3 font-medium">Plan</th>
                        <th className="pb-3 font-medium">Licenses</th>
                        <th className="pb-3 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loadingOrganizations ? (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-500">Loading...</td></tr>
                      ) : organizations.length === 0 ? (
                        <tr><td colSpan={4} className="py-8 text-center text-slate-500">No organizations found.</td></tr>
                      ) : (
                        organizations.map((org) => (
                          <tr key={org.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                            <td className="py-4 font-medium">{org.name}</td>
                            <td className="py-4">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                {org.subscription_plan}
                              </span>
                            </td>
                            <td className="py-4">
                              {org.current_users || 0} / {org.max_users}
                            </td>
                            <td className="py-4">
                              <span className="text-slate-400 text-xs italic">Management via users tab</span>
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Organization & System Activity Audit Logs</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Monitor team actions across organizations (calculations run, reports generated, login history, and admin actions).
                    </p>
                  </div>
                  <button onClick={fetchActivityLogs} className="text-sm text-blue-600 hover:underline font-medium self-start md:self-auto">
                    Refresh Logs
                  </button>
                </div>
                
                {/* Controls Bar: Organization Selector & Action Categories */}
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
                      <Building size={16} className="text-blue-600" />
                      Filter Organization:
                    </label>
                    <select
                      value={logOrgFilter}
                      onChange={(e) => setLogOrgFilter(e.target.value)}
                      className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer max-w-xs text-slate-800 dark:text-slate-200 shadow-xs"
                    >
                      <option value="ALL">🏢 All Organizations & System Logs</option>
                      <option value="UNASSIGNED">👤 Unassigned Users</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>🏢 {org.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="relative flex-1 max-w-xs">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={e => setLogSearchQuery(e.target.value)}
                      placeholder="Search by user or action..."
                      className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                    />
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-2 flex-wrap mb-6">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                    <Activity size={14} className="text-blue-600" /> Category:
                  </span>
                  {[
                    { id: 'ALL', label: 'All Actions' },
                    { id: 'LOGIN', label: '🔑 Logins' },
                    { id: 'CALCULATION_RUN', label: '🧮 Calculations' },
                    { id: 'REPORT_GENERATED', label: '📄 Reports' },
                    { id: 'ADMIN_ACTION', label: '🛡️ Admin Actions' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setLogCategoryFilter(cat.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition ${
                        logCategoryFilter === cat.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs text-slate-500 uppercase">
                        <tr>
                          <th className="px-6 py-4 font-medium">Timestamp</th>
                          <th className="px-6 py-4 font-medium">User Email</th>
                          <th className="px-6 py-4 font-medium">Organization</th>
                          <th className="px-6 py-4 font-medium">Action</th>
                          <th className="px-6 py-4 font-medium">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                        {loadingLogs ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                              Loading audit logs...
                            </td>
                          </tr>
                        ) : activityLogs.filter(log => {
                          const userEmail = (log.profiles?.email || log.email || '').toLowerCase();
                          const userProfile = profiles.find(p => p.email.toLowerCase() === userEmail);
                          const userOrgId = userProfile?.organization_id;

                          // Org filter
                          if (logOrgFilter !== 'ALL') {
                            if (logOrgFilter === 'UNASSIGNED') {
                              if (userOrgId) return false;
                            } else if (userOrgId !== logOrgFilter) {
                              return false;
                            }
                          }

                          // Category filter
                          if (logCategoryFilter === 'LOGIN' && log.action_type !== 'LOGIN') return false;
                          if (logCategoryFilter === 'CALCULATION_RUN' && !log.action_type?.includes('CALCULATION')) return false;
                          if (logCategoryFilter === 'REPORT_GENERATED' && !log.action_type?.includes('REPORT')) return false;
                          if (logCategoryFilter === 'ADMIN_ACTION' && (log.action_type === 'LOGIN' || log.action_type?.includes('CALCULATION') || log.action_type?.includes('REPORT'))) return false;

                          // Search filter
                          if (logSearchQuery.trim()) {
                            const q = logSearchQuery.toLowerCase();
                            const action = (log.action_type || '').toLowerCase();
                            const detailsStr = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
                            return userEmail.includes(q) || action.includes(q) || detailsStr.includes(q);
                          }

                          return true;
                        }).length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">
                              No activity logs found for this organization and filter.
                            </td>
                          </tr>
                        ) : (
                          activityLogs
                            .filter(log => {
                              const userEmail = (log.profiles?.email || log.email || '').toLowerCase();
                              const userProfile = profiles.find(p => p.email.toLowerCase() === userEmail);
                              const userOrgId = userProfile?.organization_id;

                              if (logOrgFilter !== 'ALL') {
                                if (logOrgFilter === 'UNASSIGNED') {
                                  if (userOrgId) return false;
                                } else if (userOrgId !== logOrgFilter) {
                                  return false;
                                }
                              }

                              if (logCategoryFilter === 'LOGIN' && log.action_type !== 'LOGIN') return false;
                              if (logCategoryFilter === 'CALCULATION_RUN' && !log.action_type?.includes('CALCULATION')) return false;
                              if (logCategoryFilter === 'REPORT_GENERATED' && !log.action_type?.includes('REPORT')) return false;
                              if (logCategoryFilter === 'ADMIN_ACTION' && (log.action_type === 'LOGIN' || log.action_type?.includes('CALCULATION') || log.action_type?.includes('REPORT'))) return false;

                              if (logSearchQuery.trim()) {
                                const q = logSearchQuery.toLowerCase();
                                const action = (log.action_type || '').toLowerCase();
                                const detailsStr = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
                                return userEmail.includes(q) || action.includes(q) || detailsStr.includes(q);
                              }

                              return true;
                            })
                            .map((log) => {
                              const userEmail = log.profiles?.email || log.email || 'System User';
                              const userProfile = profiles.find(p => p.email.toLowerCase() === userEmail.toLowerCase());
                              const userOrg = userProfile?.organization_id ? organizations.find(o => o.id === userProfile.organization_id) : null;

                              const isLogin = log.action_type === 'LOGIN';
                              const isCalc = log.action_type?.includes('CALCULATION');
                              const isReport = log.action_type?.includes('REPORT');

                              return (
                                <tr key={log.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition">
                                  <td className="px-6 py-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                                    {new Date(log.created_at).toLocaleString()}
                                  </td>
                                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">
                                    {userEmail}
                                  </td>
                                  <td className="px-6 py-4">
                                    {userOrg ? (
                                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200">
                                        🏢 {userOrg.name}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 text-xs italic">Unassigned</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-extrabold tracking-wider uppercase ${
                                      isLogin ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' :
                                      isCalc ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' :
                                      isReport ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' :
                                      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                                    }`}>
                                      {log.action_type}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-xs text-slate-600 dark:text-slate-400 font-mono">
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details || {})}
                                  </td>
                                </tr>
                              );
                            })
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
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Server & Sync Settings</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure organization-specific backup directories saved on the backend server.</p>
                  </div>
                  
                  {/* Select Organization for Backup Settings */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 shrink-0">Organization:</label>
                    <select
                      value={selectedOrgFilter}
                      onChange={(e) => {
                        setSelectedOrgFilter(e.target.value);
                        fetchOrgBackupSettings(e.target.value);
                      }}
                      className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold cursor-pointer max-w-xs"
                    >
                      <option value="ALL">🏢 Global Default Settings</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>🏢 {org.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
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
                      onClick={async () => {
                        localStorage.setItem('localBackupPath', localBackupPath);
                        localStorage.setItem('serverBackupPath', serverBackupPath);
                        toast.info("Saving backup settings to backend server...");
                        const targetId = selectedOrgFilter !== 'ALL' && selectedOrgFilter !== 'UNASSIGNED' ? selectedOrgFilter : undefined;
                        const res = await api.saveOrgBackupSettings(localBackupPath, serverBackupPath, targetId);
                        if (res && res.success) {
                          toast.success("Organization backup settings saved to backend successfully!");
                        } else {
                          toast.error(res.message || "Failed to save backup settings to backend");
                        }
                      }}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
                    >
                      Save Backup Settings
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'licenses' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Key Manager & Licensing</h2>
                    <p className="text-xs text-slate-500">Generate unique non-repeatable license keys and manage hardware trials.</p>
                  </div>
                  <button onClick={fetchAdminLicenses} className="text-sm text-blue-600 hover:underline">Refresh List</button>
                </div>

                {/* Generator Form */}
                <div className="p-5 border border-amber-200 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/10 rounded-2xl space-y-4">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <Key className="size-4" />
                    Generate Unique Non-Repeatable License Key
                  </h3>

                  <form onSubmit={handleAdminGenerateKey} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">License Tier</label>
                      <select
                        value={genTier}
                        onChange={(e) => setGenTier(e.target.value as any)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="PRO">PRO Plan</option>
                        <option value="ENTERPRISE">ENTERPRISE Plan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Duration (Days)</label>
                      <input
                        type="number"
                        value={genDays}
                        onChange={(e) => setGenDays(parseInt(e.target.value) || 365)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target User Email (Optional)</label>
                      <input
                        type="email"
                        value={genTargetEmail}
                        onChange={(e) => setGenTargetEmail(e.target.value)}
                        placeholder="user@domain.com"
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Generate Key
                    </button>
                  </form>

                  {generatedAdminKey && (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Generated Key:</span>
                        <code className="text-sm font-mono font-bold text-amber-500 tracking-wider">{generatedAdminKey}</code>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedAdminKey);
                          toast.success("License key copied to clipboard!");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Copy className="size-3.5" />
                        Copy Key
                      </button>
                    </div>
                  )}
                </div>

                {/* Generated Keys Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active & Generated License Keys ({licensesList.length})</h3>
                  {loadingLicenses ? (
                    <div className="py-8 text-center text-slate-400"><Loader2 className="animate-spin size-6 mx-auto mb-2" />Loading keys...</div>
                  ) : licensesList.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic">No custom license keys generated yet.</div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-slate-500 text-[10px]">
                          <tr>
                            <th className="p-3">License Key</th>
                            <th className="p-3">Tier</th>
                            <th className="p-3">Bound Email</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Expires</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {licensesList.map((lic) => (
                            <tr key={lic.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-bold text-amber-600 dark:text-amber-400">{lic.key}</td>
                              <td className="p-3 font-semibold">{lic.tier}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{lic.boundEmail || 'Unbound'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  lic.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {lic.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{new Date(lic.expiresAt).toLocaleDateString()}</td>
                              <td className="p-3 text-right">
                                {lic.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleAdminRevokeKey(lic.key)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Hardware Fingerprint Trials Table */}
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hardware Fingerprinted Trials ({trialsList.length})</h3>
                  {trialsList.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs italic">No hardware device trials logged yet.</div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-slate-500 text-[10px]">
                          <tr>
                            <th className="p-3">Hardware ID (HWID)</th>
                            <th className="p-3">Bound Email</th>
                            <th className="p-3">First Claimed</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {trialsList.map((tr) => (
                            <tr key={tr.hwid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">{tr.hwid}</td>
                              <td className="p-3 text-slate-500">{tr.email}</td>
                              <td className="p-3 text-slate-500">{new Date(tr.firstSeenAt).toLocaleDateString()}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  Date.now() > tr.expiresAt ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {Date.now() > tr.expiresAt ? 'EXPIRED' : 'FREE_TRIAL'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
                const isSectionUnlocked = items.every(item => editingPermissionsFor.features?.[item.to!.replace('/', '')] !== false);
                
                return (
                  <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">{navItem.label}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toggle All</span>
                        <button 
                          onClick={() => toggleSection(items)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isSectionUnlocked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSectionUnlocked ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
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

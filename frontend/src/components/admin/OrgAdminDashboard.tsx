import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useMemo } from 'react'
import { Loader2, Plus, Users, HardDrive, LogOut, FolderOpen, Save, ArrowLeft, Megaphone, Trash2, Filter, Crown, ShieldCheck, Activity, Search, FileText, UserCheck, Eye, Edit3, Key, Clock, BarChart3, ChevronRight, Lock, Network, Sparkles } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useConfirm } from '@/hooks/use-confirm'

type Profile = {
  id: string
  email: string
  role: string
  name: string
  status: string
  organization_id?: string
}

type Announcement = {
  id: string
  message: string
  type: string
  is_active: boolean
  created_at: string
}

const PLATFORM_ROLES = [
  'Jr. Design Engineer',
  'Design Engineer',
  'Sr. Design Engineer',
  'Discipline Coordinator',
  'BIM Modeler',
  'BIM Coordinator',
  'Team Leader',
  '2D Draftsman',
  'Viewer',
  'Client'
]

export function OrgAdminDashboard() {
  const { session, profile: currentUserProfile, userData, logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'users' | 'activity' | 'storage' | 'broadcasts'>('users')

  // Users State
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('ALL')
  const [sortByRole, setSortByRole] = useState<boolean>(true)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('Design Engineer')
  const [isInviting, setIsInviting] = useState(false)

  // Activity Logs State
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('ALL')
  const [logSearchQuery, setLogSearchQuery] = useState<string>('')

  // Storage State
  const [localBackupPath, setLocalBackupPath] = useState(localStorage.getItem('localBackupPath') || '')
  const [serverBackupPath, setServerBackupPath] = useState(localStorage.getItem('serverBackupPath') || '')
  const [versionsPath, setVersionsPath] = useState(localStorage.getItem('versionsPath') || '')

  // Broadcasts State
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState('')
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'error'>('info')

  const fetchUsers = async () => {
    setLoading(true)
    let fetchedUsers = await api.getOrgUsers()
    
    if (fetchedUsers && fetchedUsers.length > 0) {
      fetchedUsers = fetchedUsers.filter((u: any) => u.role !== 'SUPER_ADMIN' && u.email !== 'admin@tarv.ai');
    }

    setUsers(fetchedUsers || [])
    setLoading(false)
  }

  const fetchOrgActivityLogs = async () => {
    setLoadingLogs(true)
    const logs = await api.getOrgActivityLogs()
    setActivityLogs(Array.isArray(logs) ? logs.filter(Boolean) : [])
    setLoadingLogs(false)
  }

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    const data = await api.getAnnouncements()
    if (data) setAnnouncements(data)
    setLoadingAnnouncements(false)
  }

  const fetchBackupSettings = async () => {
    const res = await api.getOrgBackupSettings()
    if (res && res.success) {
      if (res.local_backup_path) setLocalBackupPath(res.local_backup_path)
      if (res.server_backup_path) setServerBackupPath(res.server_backup_path)
      if (res.versions_path) {
        setVersionsPath(res.versions_path)
        localStorage.setItem('versionsPath', res.versions_path)
      }
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchOrgActivityLogs()
    if (activeTab === 'storage') fetchBackupSettings()
    if (activeTab === 'broadcasts') fetchAnnouncements()
  }, [activeTab])

  // Compute KPI Statistics for top metrics bar
  const stats = useMemo(() => {
    const totalMembers = users.length
    const activeMembers = users.filter(u => u && (u.status === 'active' || u.status === 'ACTIVE')).length
    const loginsCount = activityLogs.filter(l => l && l.action_type === 'LOGIN').length
    const viewsCount = activityLogs.filter(l => l && (l.action_type === 'VIEWED' || l.action_type === 'VIEW_CALCULATOR')).length
    const updatesCount = activityLogs.filter(l => l && (l.action_type === 'UPDATED' || l.action_type?.includes('UPDATE'))).length
    
    // Calculate unique active user count from logs today
    const todayStr = new Date().toISOString().split('T')[0]
    const activeTodaySet = new Set(
      activityLogs
        .filter(l => l && l.created_at && String(l.created_at).startsWith(todayStr))
        .map(l => l.name || l.email || l.user_id)
    )

    return {
      totalMembers,
      activeMembers,
      loginsCount,
      viewsCount,
      updatesCount,
      activeToday: activeTodaySet.size || Math.min(activeMembers, totalMembers)
    }
  }, [users, activityLogs])

  // --- Users Handlers ---
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail || !inviteName) return toast.error("Please fill all fields")
    setIsInviting(true)
    const res = await api.inviteOrgUser({ email: inviteEmail, name: inviteName, role: inviteRole })
    if (res.success) {
      toast.success("User invited successfully!")
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('Design Engineer')
      fetchUsers()
    } else {
      toast.error(res.message || "Failed to invite user")
    }
    setIsInviting(false)
  }

  const handleRemoveUser = async (user: Profile) => {
    const choice = await confirm(`Are you sure you want to remove ${user.email} from the organization?`, { title: 'Confirm Removal', kind: 'warning' })
    if (!choice) return
    
    toast.info("Removing user...")
    const res = await api.adminDeleteUser(user.id)
    if (res && res.success) {
      toast.success("User removed successfully")
      fetchUsers()
    } else {
      toast.error("Failed to remove user")
    }
  }

  const handleChangeRole = async (user: Profile, newRole: string) => {
    if (user.id === currentUserProfile?.id) {
      toast.error("You cannot change your own role.")
      return
    }
    toast.info(`Updating role for ${user.email} to ${newRole}...`)
    const res = await api.adminToggleRole(user.id, newRole)
    if (res && res.success) {
      toast.success(`Role for ${user.name || user.email} updated to ${newRole}`)
      fetchUsers()
    } else {
      toast.error(res.message || "Failed to update role")
    }
  }

  const ROLE_ORDER: Record<string, number> = {
    'ORG_ADMIN': 1,
    'jr. Design Engineer': 2,
    'Design Engineer': 3,
    'Sr. Design Engineer': 4,
    'Discipline Coordinator': 5,
    'BIM Modeler': 6,
    'BIM Coordinator': 7,
    'Team Leader': 8,
    '2D Draftsman': 9,
    'Viewer': 10,
    'Client': 11
  }

  // --- Storage Handlers ---
  const handlePickFolder = async (type: 'local' | 'server' | 'versions') => {
    const title = type === 'local' 
      ? 'Select Local Backup Folder' 
      : type === 'server' 
      ? 'Select Server Backup Folder' 
      : 'Select Organization Common Version Storage Directory';

    const updatePathState = (selectedPath: string) => {
      if (type === 'local') {
        setLocalBackupPath(selectedPath);
        localStorage.setItem('localBackupPath', selectedPath);
        toast.success("Local backup path updated!");
      } else if (type === 'server') {
        setServerBackupPath(selectedPath);
        localStorage.setItem('serverBackupPath', selectedPath);
        toast.success("Server backup path updated!");
      } else {
        setVersionsPath(selectedPath);
        localStorage.setItem('versionsPath', selectedPath);
        toast.success("Organization common versions path updated!");
      }
    };

    // 1. Try Desktop (Tauri) Native File Dialog
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const { open: openFileDialog } = await import('@tauri-apps/plugin-dialog');
        const selected = await openFileDialog({
          directory: true,
          multiple: false,
          title,
        });
        if (selected && typeof selected === 'string') {
          updatePathState(selected);
          return;
        }
      }
    } catch (e) {
      console.warn("Tauri dialog not available:", e);
    }

    // 2. Try HTML5 File System Access API (showDirectoryPicker) for Web Browsers (Chrome, Edge, etc.)
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          const currentVal = type === 'local' ? localBackupPath : type === 'server' ? serverBackupPath : versionsPath;
          const defaultSuggestion = currentVal 
            ? `${currentVal.replace(/[/\\]+$/, '')}\\${dirHandle.name}` 
            : `Z:\\${dirHandle.name}`;

          const userConfirmedPath = window.prompt(
            `Selected folder: "${dirHandle.name}"\n\nPlease confirm or enter the full shared network / local disk path for your organization:`,
            defaultSuggestion
          );

          if (userConfirmedPath && userConfirmedPath.trim()) {
            updatePathState(userConfirmedPath.trim());
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled directory dialog
        console.warn("showDirectoryPicker error:", err);
      }
    }

    // 3. Fallback: Direct Prompt Input
    const currentVal = type === 'local' ? localBackupPath : type === 'server' ? serverBackupPath : versionsPath;
    const inputPath = window.prompt(
      `Enter or paste the full directory path for ${title} (e.g., Z:\\Versions or \\\\server-m\\Versions):`,
      currentVal || ''
    );
    if (inputPath && inputPath.trim()) {
      updatePathState(inputPath.trim());
    }
  }

  // --- Broadcasts Handlers ---
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

  // Format log details cleanly into human readable sentences
  const formatLogDetail = (log: any) => {
    if (!log) return 'No details provided';
    const d = log.details || {}
    const isObj = typeof d === 'object' && d !== null

    if (log.action_type === 'LOGIN') {
      return 'User logged into platform'
    }

    if (log.action_type === 'VIEWED' || log.action_type === 'VIEW_CALCULATOR') {
      const calcName = isObj ? (d.calculator_name || d.calculator || d.path || 'Calculator') : d
      return `Viewed ${calcName}`
    }

    if (log.action_type === 'UPDATED') {
      const calcName = isObj ? (d.calculator_name || d.calculator || 'calculator') : 'calculator'
      const summary = isObj ? (d.summary || d.message || '') : String(d)
      return `Changes occurred / updated values in ${calcName}${summary ? ` (${summary})` : ''}`
    }

    if (isObj) {
      if (d.message) return d.message
      if (d.summary) return d.summary
      return Object.entries(d)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' | ')
    }

    return String(d || 'No details provided')
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800/80">
          <button 
            onClick={() => navigate({ to: '/' })}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
          
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" />
            Org Admin
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">Control Panel & Team Analytics</p>
        </div>

        <nav className="p-4 space-y-1.5 flex-1 overflow-y-auto">
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'users' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4" />
              Team Members
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'users' ? 'bg-white/20 dark:bg-slate-900/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
              {users.length}
            </span>
          </button>

          <button 
            onClick={() => setActiveTab('activity')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'activity' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4" />
              Activity Audit Logs
            </div>
            {activityLogs.length > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${activeTab === 'activity' ? 'bg-white/20 dark:bg-slate-900/20' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {activityLogs.length}
              </span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('storage')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'storage' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
          >
            <HardDrive className="w-4 h-4" />
            Server & Sync Settings
          </button>

          <button 
            onClick={() => setActiveTab('broadcasts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${activeTab === 'broadcasts' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
          >
            <Megaphone className="w-4 h-4" />
            Global Broadcasts
          </button>
        </nav>

        {/* Current User Card */}
        <div className="p-4 m-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center text-xs shrink-0 border border-slate-700">
              {(currentUserProfile?.name || currentUserProfile?.email || 'A')[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold truncate text-slate-900 dark:text-slate-100">{currentUserProfile?.name || 'Org Admin'}</div>
              <div className="text-[11px] text-slate-500 truncate">{currentUserProfile?.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className="w-full px-6 py-6 lg:px-8 space-y-6">
          
          {/* TOP METRICS & STATS BAR - Clean Executive Style */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Members</span>
                <Users className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.totalMembers}</div>
              <div className="text-[11px] text-slate-500 font-semibold mt-0.5">{stats.activeMembers} Active Users</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Active Today</span>
                <UserCheck className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.activeToday}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Logged in today</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Logins</span>
                <Key className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.loginsCount}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Login events logged</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Calculator Views</span>
                <Eye className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.viewsCount}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Page views recorded</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Updates / Changes</span>
                <Edit3 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">{stats.updatesCount}</div>
              <div className="text-[11px] text-slate-500 font-medium mt-0.5">Changes occurred</div>
            </div>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Organization Team Members</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Manage user access, role assignments, and organization company hierarchy.</p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    onClick={() => navigate({ to: '/company-hierarchy' })}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Network className="w-4 h-4" />
                    Build Company Hierarchy
                  </button>
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Invite Team Member
                  </button>
                </div>
              </div>

              {/* Role Counters Summary - Clean Slate Styling */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { key: 'Design Engineer', label: 'Design Engineers' },
                  { key: 'BIM Modeler', label: 'BIM Modelers' },
                  { key: 'Team Leader', label: 'Team Leaders' },
                  { key: 'Viewer', label: 'Viewers' },
                  { key: 'Client', label: 'Clients' }
                ].map(item => (
                  <div 
                    key={item.key}
                    onClick={() => setSelectedRoleFilter(item.key)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      selectedRoleFilter === item.key 
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">{item.label}</div>
                    <div className="text-xl font-extrabold mt-0.5">
                      {users.filter(u => u.role === item.key || (item.key === 'Design Engineer' && (u.role === 'ENGINEER' || u.role === 'USER'))).length}
                    </div>
                  </div>
                ))}
              </div>

              {/* Filter & Sort Controls */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 shrink-0">
                    <Filter size={14} className="text-slate-700 dark:text-slate-300" />
                    Filter by Role:
                  </label>
                  <select
                    value={selectedRoleFilter}
                    onChange={(e) => setSelectedRoleFilter(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer min-w-[220px]"
                  >
                    <option value="ALL">All Roles ({users.length})</option>
                    {PLATFORM_ROLES.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    <option value="ORG_ADMIN">Org Admin</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortByRole(!sortByRole)}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${sortByRole ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                  >
                    {sortByRole ? 'Sorted by Role Hierarchy' : 'Sorted Alphabetically'}
                  </button>
                </div>
              </div>

              {/* Members Table - Clean Corporate Style */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-600 dark:text-slate-400" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No team members found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-6 py-4 font-bold">Team Member</th>
                          <th className="px-6 py-4 font-bold">Assigned Platform Role</th>
                          <th className="px-6 py-4 font-bold">Account Status</th>
                          <th className="px-6 py-4 font-bold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {users
                          .filter(u => {
                            if (selectedRoleFilter === 'ALL') return true;
                            if (selectedRoleFilter === 'Design Engineer') return u.role === 'Design Engineer' || u.role === 'ENGINEER' || u.role === 'USER';
                            return u.role === selectedRoleFilter;
                          })
                          .sort((a, b) => {
                            if (sortByRole) {
                              const orderA = ROLE_ORDER[a.role] || 99;
                              const orderB = ROLE_ORDER[b.role] || 99;
                              if (orderA !== orderB) return orderA - orderB;
                            }
                            return (a.name || a.email).localeCompare(b.name || b.email);
                          })
                          .map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                                  {(u.name || u.email || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    {u.role === 'ORG_ADMIN' && <Crown size={14} className="text-amber-500 shrink-0" title="Org Admin" />}
                                    <span>{u.name || u.email}</span>
                                  </div>
                                  <div className="text-slate-500 text-xs mt-0.5">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {u.id === currentUserProfile?.id ? (
                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md text-xs font-bold border border-slate-300 dark:border-slate-700">
                                  Org Admin (You)
                                </span>
                              ) : (
                                <select
                                  value={u.role || 'Design Engineer'}
                                  onChange={(e) => handleChangeRole(u, e.target.value)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-slate-400 cursor-pointer shadow-2xs"
                                >
                                  {PLATFORM_ROLES.map(r => (
                                    <option key={r} value={r}>{r}</option>
                                  ))}
                                  <option value="ORG_ADMIN">Org Admin</option>
                                </select>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {u.status === 'invited' ? (
                                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-full text-[11px] font-bold">
                                  Pending Invite
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-[11px] font-bold">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {u.id !== currentUserProfile?.id && (
                                <button
                                  onClick={() => handleRemoveUser(u)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                                  title="Remove User"
                                >
                                  <Trash2 className="w-4 h-4" />
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
            </div>
          )}

          {/* Team Activity Audit Logs Tab */}
          {activeTab === 'activity' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    Team Activity Audit Logs
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">Real-time audit log tracking Logins, Calculator Views, and Parameter Updates ("Changes Occurred") across your team.</p>
                </div>
                <button
                  onClick={fetchOrgActivityLogs}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition self-start md:self-auto"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Refresh Activity Logs
                </button>
              </div>

              {/* Filter Controls Bar */}
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 mr-1 flex items-center gap-1">
                    <Filter size={14} className="text-slate-700 dark:text-slate-300" /> Filter:
                  </span>
                  {[
                    { id: 'ALL', label: 'All Actions' },
                    { id: 'LOGIN', label: '🔑 Logins' },
                    { id: 'VIEWED', label: '👁️ Views' },
                    { id: 'UPDATED', label: '✏️ Changes / Updates' },
                    { id: 'CALCULATION_RUN', label: '🧮 Calculations' },
                    { id: 'REPORT_GENERATED', label: '📄 Reports' },
                    { id: 'USER_MGMT', label: '👥 Team Mgmt' }
                  ].map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setLogCategoryFilter(cat.id)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition ${
                        logCategoryFilter === cat.id
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative min-w-[240px]">
                  <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={logSearchQuery}
                    onChange={e => setLogSearchQuery(e.target.value)}
                    placeholder="Search by user name, email, or action..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Logs Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-2xs">
                {loadingLogs ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-slate-600 dark:text-slate-400" />
                  </div>
                ) : activityLogs.filter(log => {
                  if (logCategoryFilter === 'LOGIN' && log.action_type !== 'LOGIN') return false;
                  if (logCategoryFilter === 'VIEWED' && log.action_type !== 'VIEWED' && log.action_type !== 'VIEW_CALCULATOR') return false;
                  if (logCategoryFilter === 'UPDATED' && log.action_type !== 'UPDATED' && !log.action_type?.includes('UPDATE')) return false;
                  if (logCategoryFilter === 'CALCULATION_RUN' && !log.action_type?.includes('CALCULATION')) return false;
                  if (logCategoryFilter === 'REPORT_GENERATED' && !log.action_type?.includes('REPORT') && log.action_type !== 'EXPORT') return false;
                  if (logCategoryFilter === 'USER_MGMT' && (log.action_type === 'LOGIN' || log.action_type === 'VIEWED' || log.action_type === 'UPDATED' || log.action_type?.includes('CALCULATION') || log.action_type?.includes('REPORT'))) return false;

                  if (logSearchQuery.trim()) {
                    const q = logSearchQuery.toLowerCase();
                    const name = (log.name || log.profiles?.name || '').toLowerCase();
                    const email = (log.profiles?.email || log.email || '').toLowerCase();
                    const action = (log.action_type || '').toLowerCase();
                    const detailsStr = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
                    return name.includes(q) || email.includes(q) || action.includes(q) || detailsStr.includes(q);
                  }
                  return true;
                }).length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-semibold text-sm">No activity logs found for this filter.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-6 py-4 font-bold">Timestamp</th>
                          <th className="px-6 py-4 font-bold">Team Member (Name & Email)</th>
                          <th className="px-6 py-4 font-bold">Action Type</th>
                          <th className="px-6 py-4 font-bold">Activity Summary & Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {activityLogs
                          .filter(log => {
                            if (logCategoryFilter === 'LOGIN' && log.action_type !== 'LOGIN') return false;
                            if (logCategoryFilter === 'VIEWED' && log.action_type !== 'VIEWED' && log.action_type !== 'VIEW_CALCULATOR') return false;
                            if (logCategoryFilter === 'UPDATED' && log.action_type !== 'UPDATED' && !log.action_type?.includes('UPDATE')) return false;
                            if (logCategoryFilter === 'CALCULATION_RUN' && !log.action_type?.includes('CALCULATION')) return false;
                            if (logCategoryFilter === 'REPORT_GENERATED' && !log.action_type?.includes('REPORT') && log.action_type !== 'EXPORT') return false;
                            if (logCategoryFilter === 'USER_MGMT' && (log.action_type === 'LOGIN' || log.action_type === 'VIEWED' || log.action_type === 'UPDATED' || log.action_type?.includes('CALCULATION') || log.action_type?.includes('REPORT'))) return false;

                            if (logSearchQuery.trim()) {
                              const q = logSearchQuery.toLowerCase();
                              const name = (log.name || log.profiles?.name || '').toLowerCase();
                              const email = (log.profiles?.email || log.email || '').toLowerCase();
                              const action = (log.action_type || '').toLowerCase();
                              const detailsStr = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
                              return name.includes(q) || email.includes(q) || action.includes(q) || detailsStr.includes(q);
                            }
                            return true;
                          })
                          .map((log) => {
                            const userName = log.name || log.profiles?.name || log.user_name || log.email || 'Team User';
                            const userEmail = log.profiles?.email || log.email || '';
                            const isLogin = log.action_type === 'LOGIN';
                            const isView = log.action_type === 'VIEWED' || log.action_type === 'VIEW_CALCULATOR';
                            const isUpdate = log.action_type === 'UPDATED' || log.action_type?.includes('UPDATE');
                            const isReport = log.action_type?.includes('REPORT') || log.action_type === 'EXPORT';

                            return (
                              <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                                <td className="px-6 py-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-extrabold flex items-center justify-center text-xs shrink-0 border border-slate-200 dark:border-slate-700">
                                      {(userName || 'U')[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs">
                                        {userName}
                                      </div>
                                      {userEmail && <div className="text-[11px] text-slate-500">{userEmail}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                                    {isLogin && <Key size={12} />}
                                    {isView && <Eye size={12} />}
                                    {isUpdate && <Edit3 size={12} />}
                                    {isReport && <FileText size={12} />}
                                    {isUpdate ? 'UPDATED / CHANGES' : log.action_type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {formatLogDetail(log)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Storage & Backup Tab */}
          {activeTab === 'storage' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <h2 className="text-xl font-bold">Server & Sync Settings</h2>
              
              <div className="space-y-8 max-w-3xl">
                {/* Organization Common Versions Directory (Admin Managed) */}
                <div className="bg-slate-50 dark:bg-slate-950/60 p-6 rounded-xl border border-primary/30 dark:border-primary/20 shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 text-primary rounded-lg">
                      <FolderOpen className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-lg text-foreground">Organization Common Version & Backup Storage Path</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Admin Configured
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                        Centralized network folder path (e.g. <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-xs font-mono text-foreground">Z:\Versions</code> or <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-xs font-mono text-foreground">\\server-m\Versions</code>). Only Organization Admins can set this shared path. All team members in your organization will automatically use this common directory to save and view project versions and backups.
                      </p>
                      
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={versionsPath} 
                          onChange={(e) => setVersionsPath(e.target.value)}
                          placeholder="e.g. Z:\Versions or \\server-m\Versions"
                          className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono"
                        />
                        <button 
                          onClick={() => handlePickFolder('versions')}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Browse
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/60 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
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
                          placeholder="e.g. C:\Users\Admin\AppData\Local\MEPCalc\Backups"
                          className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono"
                        />
                        <button 
                          onClick={() => handlePickFolder('local')}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <FolderOpen className="w-4 h-4" />
                          Browse
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/60 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg">
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
                          placeholder="e.g. Z:\Backups or \\server-m\Backups"
                          className="flex-1 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-mono"
                        />
                        <button 
                          onClick={() => handlePickFolder('server')}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
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
                      localStorage.setItem('versionsPath', versionsPath);
                      toast.info("Saving organization backup settings to server...");
                      const res = await api.saveOrgBackupSettings(localBackupPath, serverBackupPath, versionsPath);
                      if (res && res.success) {
                        toast.success("Organization common storage & version settings saved successfully!");
                      } else {
                        toast.error(res.message || "Failed to save backup settings");
                      }
                    }}
                    className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 text-white font-bold text-xs rounded-xl transition-colors shadow-2xs cursor-pointer"
                  >
                    Save Organization Storage Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Broadcasts Tab */}
          {activeTab === 'broadcasts' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-2xs space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Global Broadcasts</h2>
                <button onClick={fetchAnnouncements} className="text-xs font-bold text-slate-700 hover:underline dark:text-slate-300">Refresh</button>
              </div>

              <div className="p-5 border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 rounded-xl">
                <h3 className="text-sm font-semibold mb-3">Create New Broadcast</h3>
                <form onSubmit={handleCreateAnnouncement} className="flex gap-3">
                  <div className="flex-1">
                    <input 
                      type="text"
                      placeholder="Type your message here (e.g., Update 2.0 is coming tomorrow)"
                      required
                      value={newAnnouncementMsg}
                      onChange={(e) => setNewAnnouncementMsg(e.target.value)}
                      className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <select
                    value={newAnnouncementType}
                    onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                    className="text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 w-32 font-bold"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                  <button 
                    type="submit"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white font-bold rounded-lg text-xs transition-colors shadow-2xs"
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
                        ? 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/40' 
                        : 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/30'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                            {ann.type}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(ann.created_at).toLocaleString()}</span>
                        </div>
                        <p className={`text-sm ${ann.is_active ? 'text-slate-900 dark:text-slate-100 font-medium' : 'line-through text-slate-500'}`}>
                          {ann.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleAnnouncement(ann.id, ann.is_active)}
                          className="text-xs px-3 py-1.5 rounded-md font-bold transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
                        >
                          {ann.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold">✕</button>
            </div>
            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-semibold"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Platform Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200"
                >
                  {PLATFORM_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 shadow-2xs"
                >
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

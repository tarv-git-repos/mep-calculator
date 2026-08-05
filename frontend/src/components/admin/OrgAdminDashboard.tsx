import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Users, HardDrive, LogOut, FolderOpen, Save, ArrowLeft, Megaphone, Trash2 } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { open, confirm } from '@tauri-apps/plugin-dialog'
import { api } from '@/services/api'

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

export function OrgAdminDashboard() {
  const { session, profile } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'users' | 'storage' | 'broadcasts'>('users')

  // Users State
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('ENGINEER')
  const [isInviting, setIsInviting] = useState(false)

  // Storage State
  const [localBackupPath, setLocalBackupPath] = useState(localStorage.getItem('localBackupPath') || '')
  const [serverBackupPath, setServerBackupPath] = useState(localStorage.getItem('serverBackupPath') || '')

  // Broadcasts State
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState('')
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'error'>('info')

  const fetchUsers = async () => {
    setLoading(true)
    const fetchedUsers = await api.getOrgUsers()
    setUsers(fetchedUsers)
    setLoading(false)
  }

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    const data = await api.getAnnouncements()
    if (data) setAnnouncements(data)
    setLoadingAnnouncements(false)
  }

  useEffect(() => {
    if (activeTab === 'users') fetchUsers()
    if (activeTab === 'broadcasts') fetchAnnouncements()
  }, [activeTab])

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
      setInviteRole('ENGINEER')
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

  // --- Storage Handlers ---
  const handlePickFolder = async (type: 'local' | 'server') => {
    try {
      const selected = await open({
        directory: true,
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
      toast.error("Failed to pick folder")
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

  return (
    <div className="flex h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex flex-col">
        <div className="p-6">
          <button 
            onClick={() => navigate({ to: '/' })}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
          
          <h1 className="text-xl font-bold tracking-tight">Organization Admin</h1>
          <p className="text-xs text-slate-500 mt-1">Manage your team settings</p>
        </div>

        <nav className="p-4 space-y-1">
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'users' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Users className="w-5 h-5" />
            Users
          </button>
          <button 
            onClick={() => setActiveTab('storage')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'storage' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <HardDrive className="w-5 h-5" />
            Server & Sync Settings
          </button>
          <button 
            onClick={() => setActiveTab('broadcasts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${activeTab === 'broadcasts' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
          >
            <Megaphone className="w-5 h-5" />
            Global Broadcasts
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-950">
        <div className="max-w-6xl mx-auto">
          
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Team Members</h2>
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  <Plus className="w-4 h-4" />
                  Invite User
                </button>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
                {loading ? (
                  <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : users.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No team members found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-6 py-4 font-medium">Name / Email</th>
                          <th className="px-6 py-4 font-medium">Role</th>
                          <th className="px-6 py-4 font-medium">Status</th>
                          <th className="px-6 py-4 font-medium text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                            <td className="px-6 py-4">
                              <div className="font-medium">{u.name}</div>
                              <div className="text-slate-500 text-xs mt-0.5">{u.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[11px] font-bold">
                                {u.role}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              {u.status === 'invited' ? (
                                <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded text-[11px] font-medium">
                                  Pending Invite
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded text-[11px] font-medium">
                                  Active
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {u.id !== profile?.id && (
                                <button
                                  onClick={() => handleRemoveUser(u)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition"
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

          {/* Storage Tab */}
          {activeTab === 'storage' && (
            <div className="p-6">
              <h2 className="text-xl font-bold mb-6">Server & Sync Settings</h2>
              
              <div className="space-y-8 max-w-2xl">
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

          {/* Broadcasts Tab */}
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
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
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
                        : 'border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/30'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                            ann.type === 'info' ? 'bg-blue-100 text-blue-700' :
                            ann.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                            ann.type === 'error' ? 'bg-red-100 text-red-700' :
                            'bg-emerald-100 text-emerald-700'
                          }`}>
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
                          className={`text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                            ann.is_active 
                              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300' 
                              : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30'
                          }`}
                        >
                          {ann.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
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

      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm"
                >
                  <option value="PROJECT_MANAGER">Project Manager</option>
                  <option value="ENGINEER">Engineer</option>
                  <option value="VIEWER">Viewer</option>
                </select>
              </div>
              
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

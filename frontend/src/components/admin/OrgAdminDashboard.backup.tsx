import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/services/api'
import { Loader2, Users, Plus, ShieldAlert, Trash2 } from "lucide-react"
import { toast } from 'sonner'
import { confirm } from '@tauri-apps/plugin-dialog'

type Profile = {
  id: string
  email: string
  role: string
  name: string
  status: string
  organization_id?: string
}

export function OrgAdminDashboard() {
  const { session, profile } = useAuth()
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('ENGINEER')
  const [isInviting, setIsInviting] = useState(false)

  const fetchUsers = async () => {
    setLoading(true)
    const fetchedUsers = await api.getOrgUsers()
    setUsers(fetchedUsers)
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

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
    const confirmed = await confirm(`Are you sure you want to remove ${user.email} from the organization?`, { title: 'Confirm Removal', kind: 'warning' })
    if (!confirmed) return
    
    toast.info("Removing user...")
    const res = await api.adminDeleteUser(user.id)
    if (res && res.success) {
      toast.success("User removed successfully")
      fetchUsers()
    } else {
      toast.error("Failed to remove user")
    }
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950">
      <div className="border-b bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Organization Admin Panel</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your team and licenses</p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
        >
          <Plus className="w-4 h-4" />
          Invite User
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-500" />
              Team Members ({users.length})
            </h3>
          </div>
          
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

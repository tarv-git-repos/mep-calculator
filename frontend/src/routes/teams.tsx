import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Users, Plus, Shield, ShieldAlert, Mail, Trash2 } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — MEP Calc" },
    ],
  }),
  component: TeamsPage,
});

function TeamsPage() {
  const { profile } = useAuth();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");

  const loadData = async () => {
    if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN') {
       const u = await api.getUsers();
       setUsers(u);
       const t = await api.getTeams();
       setTeams(t);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile]);

  if (profile?.role !== 'SUPER_ADMIN' && profile?.role !== 'ORG_ADMIN') {
    return (
      <AppShell title="Teams" subtitle="Manage Organization Teams">
        <div className="flex h-[calc(100vh-80px)] items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-3">
            <ShieldAlert className="size-16 text-rose-500/80" />
            <h2 className="text-xl font-bold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">Only Administrators can manage teams.</p>
          </div>
        </div>
      </AppShell>
    );
  }

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const res = await api.createTeam(newTeamName);
    if (res.success) {
       setNewTeamName("");
       loadData();
    } else {
       alert(res.message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !selectedUser) return;
    const res = await api.addUserToTeam(selectedTeam, selectedUser);
    if (res.success) {
       setSelectedTeam("");
       setSelectedUser("");
       loadData();
    } else {
       alert(res.message);
    }
  };

  const handleRemoveUser = async (teamId: string, userId: string) => {
    if (!confirm("Are you sure you want to remove this user from the team?")) return;
    const res = await api.removeUserFromTeam(teamId, userId);
    if (res.success) {
       loadData();
    } else {
       alert(res.message);
    }
  };

  return (
    <AppShell title="Teams" subtitle="Manage Organization Teams">
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-50/50 dark:bg-zinc-950/20 p-6 md:p-8 custom-scrollbar">
         
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl mx-auto w-full">
            
            {/* Create Actions */}
            <div className="lg:col-span-1 flex flex-col gap-6">
               <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                     <Users className="size-4 text-primary" /> Create New Team
                  </h3>
                  <form onSubmit={handleCreateTeam} className="flex flex-col gap-3">
                     <input
                        type="text"
                        placeholder="e.g. HVAC Alpha"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary"
                     />
                     <button type="submit" className="w-full bg-primary text-primary-foreground font-bold text-xs py-2.5 rounded-xl hover:bg-primary/95 transition-all">
                        Create Team
                     </button>
                  </form>
               </div>

               <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                     <Plus className="size-4 text-emerald-500" /> Assign User to Team
                  </h3>
                  <form onSubmit={handleAddUser} className="flex flex-col gap-3">
                     <select 
                        value={selectedTeam} 
                        onChange={(e) => setSelectedTeam(e.target.value)}
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary"
                     >
                        <option value="">Select Team...</option>
                        {teams.map(t => (
                           <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                     </select>
                     
                     <select 
                        value={selectedUser} 
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary"
                     >
                        <option value="">Select User...</option>
                        {users.map(u => (
                           <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                     </select>

                     <button type="submit" className="w-full bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-emerald-600 transition-all">
                        Assign User
                     </button>
                  </form>
               </div>
            </div>

            {/* Teams List */}
            <div className="lg:col-span-2 flex flex-col gap-4">
               <h3 className="font-bold text-foreground text-lg mb-2">Organization Teams</h3>
               {teams.length === 0 && (
                 <div className="p-8 text-center bg-card border border-border border-dashed rounded-2xl text-muted-foreground text-sm">
                    No teams created yet.
                 </div>
               )}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teams.map(team => (
                     <div key={team.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                           <h4 className="font-bold text-foreground">{team.name}</h4>
                           <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                              {team.team_members?.length || 0} Members
                           </span>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-border/50 pt-3 mt-1">
                           {team.team_members?.map((tm: any) => {
                              const user = users.find(u => u.id === tm.user_id);
                              if (!user) return null;
                              return (
                                 <div key={user.id} className="flex items-center gap-2 text-xs group">
                                    <div className="size-6 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center shrink-0">
                                       {user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                       <span className="font-bold text-foreground leading-none">{user.name}</span>
                                       <span className="text-[9px] text-muted-foreground">{user.email}</span>
                                    </div>
                                    <button 
                                      onClick={() => handleRemoveUser(team.id, user.id)}
                                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all p-1"
                                      title="Remove User"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                 </div>
                              );
                           })}
                           {(!team.team_members || team.team_members.length === 0) && (
                              <span className="text-xs text-muted-foreground italic">No members assigned.</span>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      </div>
    </AppShell>
  );
}

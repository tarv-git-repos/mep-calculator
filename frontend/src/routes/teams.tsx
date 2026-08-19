import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
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
  const isAdmin = ["SUPER_ADMIN", "ORG_ADMIN"].includes(profile?.role || "");
  
  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);

  const assignableUsers = useMemo(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      return users;
    }
    const myOrgId = profile?.organization_id;
    return users.filter(u => 
      u.role !== 'SUPER_ADMIN' && 
      (!myOrgId || u.organization_id === myOrgId || !u.organization_id)
    );
  }, [users, profile?.role, profile?.organization_id]);

  const assignableTeams = useMemo(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      return teams;
    }
    const myOrgId = profile?.organization_id;
    return teams.filter(t => !myOrgId || t.organization_id === myOrgId || !t.organization_id);
  }, [teams, profile?.role, profile?.organization_id]);
  
  const [newTeamName, setNewTeamName] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Exclude users who are ALREADY members of the selected team
  const availableUsersToAssign = useMemo(() => {
    let baseList = assignableUsers;
    if (selectedTeam) {
      const targetTeam = teams.find(t => t.id === selectedTeam);
      if (targetTeam && Array.isArray(targetTeam.team_members)) {
        const existingMemberIds = new Set(targetTeam.team_members.map((tm: any) => tm.user_id));
        baseList = baseList.filter(u => !existingMemberIds.has(u.id));
      }
    }
    return baseList;
  }, [assignableUsers, selectedTeam, teams]);

  const loadData = async () => {
    if (profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN') {
       setIsLoading(true);
       try {
         const [u, t] = await Promise.all([
           api.getUsers(),
           api.getTeams()
         ]);
         setUsers(u);
         setTeams(t);
       } finally {
         setIsLoading(false);
       }
    } else {
       setIsLoading(false);
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

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to completely delete this team? This action cannot be undone.")) return;
    const res = await api.deleteTeam(teamId);
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
            
            {isAdmin && (<>
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
                        {assignableTeams.map(t => (
                           <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                     </select>
                     
                     <select 
                        value={selectedUser} 
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary"
                     >
                        <option value="">Select User...</option>
                        {availableUsersToAssign.map(u => (
                           <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                     </select>

                     <button type="submit" className="w-full bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-emerald-600 transition-all">
                        Assign User
                     </button>
                  </form>
               </div>
            </div>            </>)}

            {/* Teams List */}
            <div className="lg:col-span-2 flex flex-col gap-4">
               <h3 className="font-bold text-foreground text-lg mb-2">Organization Teams</h3>
               {isLoading ? (
                 <div className="p-8 flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
                   <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                   Loading teams...
                 </div>
               ) : assignableTeams.length === 0 ? (
                 <div className="p-8 text-center bg-card border border-border border-dashed rounded-2xl text-muted-foreground text-sm">
                    No teams created yet.
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {assignableTeams.map(team => (
                       <div key={team.id} className="bg-card border border-border p-5 rounded-2xl shadow-sm flex flex-col gap-4 group/team">
                          <div className="flex justify-between items-center">
                             <h4 className="font-bold text-foreground">{team.name}</h4>
                             <div className="flex items-center gap-2">
                               <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                                  {(team.team_members || []).filter((tm: any) => assignableUsers.some(u => u.id === tm.user_id && u.role !== 'SUPER_ADMIN')).length} Members
                               </span>
                               <button
                                 onClick={() => handleDeleteTeam(team.id)}
                                 className="opacity-0 group-hover/team:opacity-100 p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all"
                                 title="Delete Team"
                               >
                                 <Trash2 className="size-4" />
                               </button>
                             </div>
                          </div>
                        <div className="flex flex-col gap-2 border-t border-border/50 pt-3 mt-1">
                           {team.team_members?.map((tm: any) => {
                              const user = assignableUsers.find(u => u.id === tm.user_id);
                              if (!user || user.role === 'SUPER_ADMIN' || user.email === 'admin@tarv.ai') return null;
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
               )}
            </div>
         </div>
      </div>
    </AppShell>
  );
}

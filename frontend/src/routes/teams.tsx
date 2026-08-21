import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { Users, Plus, Shield, ShieldAlert, Mail, Trash2, Check, User, Search } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { toast } from "sonner";

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
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
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
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      baseList = baseList.filter(u => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q));
    }
    return baseList;
  }, [assignableUsers, selectedTeam, teams, userSearch]);

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
    setIsLoading(true);
    try {
      const res = await api.createTeam(newTeamName);
      if (res.success) {
        setNewTeamName("");
        toast.success("Team created successfully!");
        await loadData();
      } else {
        toast.error(res.message || "Failed to create team");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to create team");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUsers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam) {
      toast.error("Please select a target team first.");
      return;
    }
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one member to add.");
      return;
    }
    setIsAssigning(true);
    try {
       for (const uid of selectedUserIds) {
         await api.addUserToTeam(selectedTeam, uid);
       }
       toast.success(`${selectedUserIds.length} member(s) assigned to team!`);
       setSelectedUserIds([]);
       loadData();
    } catch (e: any) {
       toast.error(e.message || "Failed to assign members");
    } finally {
       setIsAssigning(false);
    }
  };

  const handleRemoveUser = async (teamId: string, userId: string) => {
    if (!confirm("Are you sure you want to remove this user from the team?")) return;
    const res = await api.removeUserFromTeam(teamId, userId);
    if (res.success) {
       toast.success("Member removed from team.");
       loadData();
    } else {
       toast.error(res.message || "Failed to remove user");
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm("Are you sure you want to completely delete this team? This action cannot be undone.")) return;
    const res = await api.deleteTeam(teamId);
    if (res.success) {
       toast.success("Team deleted successfully.");
       loadData();
    } else {
       toast.error(res.message || "Failed to delete team");
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
                     <button type="submit" className="w-full bg-primary text-primary-foreground font-bold text-xs py-2.5 rounded-xl hover:bg-primary/95 transition-all cursor-pointer">
                        Create Team
                     </button>
                  </form>
               </div>

               {/* Multi-Select Assign Members Box */}
               <div className="bg-card border border-border p-5 rounded-2xl shadow-sm">
                  <h3 className="font-bold text-foreground flex items-center gap-2 mb-4">
                     <Plus className="size-4 text-emerald-500" /> Assign Members to Team
                  </h3>
                  <form onSubmit={handleAddUsers} className="flex flex-col gap-3">
                     <div>
                       <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block mb-1.5">1. Target Team</label>
                       <select 
                          value={selectedTeam} 
                          onChange={(e) => {
                            setSelectedTeam(e.target.value);
                            setSelectedUserIds([]);
                          }}
                          className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-primary"
                       >
                          <option value="">Select Team...</option>
                          {assignableTeams.map(t => (
                             <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                       </select>
                     </div>
                     
                     {selectedTeam && (
                       <div className="flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                           <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">2. Select Members</label>
                           <div className="flex items-center gap-2">
                             <button
                               type="button"
                               onClick={() => setSelectedUserIds(availableUsersToAssign.map(u => u.id))}
                               className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                             >
                               + Select All
                             </button>
                             <span className="text-slate-600 text-[10px]">•</span>
                             <button
                               type="button"
                               onClick={() => setSelectedUserIds([])}
                               className="text-[10px] text-muted-foreground hover:underline font-medium cursor-pointer"
                             >
                               Clear
                             </button>
                           </div>
                         </div>

                         {/* Filter search */}
                         <div className="relative">
                           <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
                           <input
                             type="text"
                             placeholder="Search engineers..."
                             value={userSearch}
                             onChange={(e) => setUserSearch(e.target.value)}
                             className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl pl-8 pr-3 py-1.5 text-[11px] outline-none focus:border-primary"
                           />
                         </div>

                         {/* Multi-Select Scrollable Checklist */}
                         <div className="max-h-44 overflow-y-auto rounded-xl border border-border/70 bg-background/50 p-1.5 space-y-1 custom-scrollbar">
                           {availableUsersToAssign.length === 0 ? (
                             <p className="text-[11px] text-muted-foreground p-3 text-center italic">No available members to assign.</p>
                           ) : (
                             availableUsersToAssign.map(u => {
                               const isAssigned = selectedUserIds.includes(u.id);
                               return (
                                 <div
                                   key={u.id}
                                   onClick={() => {
                                     setSelectedUserIds(prev =>
                                       isAssigned ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                     );
                                   }}
                                   className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11.5px] cursor-pointer transition-all ${
                                     isAssigned 
                                       ? 'bg-emerald-500/10 border border-emerald-500/30 text-foreground font-semibold' 
                                       : 'hover:bg-surface-2 text-muted-foreground'
                                   }`}
                                 >
                                   <div className="flex items-center gap-2">
                                     <div className={`size-4 rounded border flex items-center justify-center transition-all ${
                                       isAssigned ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border/80 bg-background'
                                     }`}>
                                       {isAssigned && <Check className="size-3 stroke-[3]" />}
                                     </div>
                                     <User className="size-3 text-muted-foreground" />
                                     <span>{u.name}</span>
                                     <span className="text-[9.5px] opacity-60">({u.email || u.role})</span>
                                   </div>
                                 </div>
                               );
                             })
                           )}
                         </div>

                         <p className="text-[10px] text-muted-foreground">
                           {selectedUserIds.length} member(s) selected
                         </p>
                       </div>
                     )}

                     <button 
                       type="submit" 
                       disabled={!selectedTeam || selectedUserIds.length === 0 || isAssigning}
                       className="w-full bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl hover:bg-emerald-600 transition-all disabled:opacity-50 cursor-pointer"
                     >
                        {isAssigning ? "Assigning Members..." : `Assign ${selectedUserIds.length > 0 ? selectedUserIds.length : ''} Member(s) to Team`}
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
                                   {(team.team_members || []).length} Members
                                </span>
                                <button
                                  onClick={() => handleDeleteTeam(team.id)}
                                  className="opacity-0 group-hover/team:opacity-100 p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all cursor-pointer"
                                  title="Delete Team"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                             </div>
                          </div>
                        <div className="flex flex-col gap-2 border-t border-border/50 pt-3 mt-1">
                           {team.team_members?.map((tm: any) => {
                              const rawId = tm.user_id || tm.id;
                              const user = users.find(u => String(u.id).toLowerCase() === String(rawId).toLowerCase() || String(u.email).toLowerCase() === String(rawId).toLowerCase());
                              const displayName = user?.name || rawId;
                              const displayEmail = user?.email || user?.role || '';
                              return (
                                 <div key={rawId} className="flex items-center gap-2 text-xs group">
                                    <div className="size-6 bg-slate-200 dark:bg-zinc-800 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-foreground">
                                       {displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col flex-1">
                                       <span className="font-bold text-foreground leading-none">{displayName}</span>
                                       {displayEmail && <span className="text-[9px] text-muted-foreground">{displayEmail}</span>}
                                    </div>
                                    <button 
                                      onClick={() => handleRemoveUser(team.id, rawId)}
                                      className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all p-1 cursor-pointer"
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

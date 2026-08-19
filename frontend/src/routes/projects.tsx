import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  FolderKanban, Plus, Trash2, Copy, Play, Calendar, User, Users, FileCode,
  MapPin, CheckCircle2, X, Edit3, Save, AlertTriangle, Search, ShieldCheck,
  Building2, FileText, Wind, Boxes, LayoutDashboard, HelpCircle, ChevronRight, Pin
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace, type Project } from "@/lib/workspace-store";
import { api } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/hooks/use-confirm";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects — MEP Calc" },
      { name: "description", content: "Manage project workspaces and calculations schedules." },
    ],
  }),
  component: ProjectsPage,
});

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return 'Just now';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Just now';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return `${hrs} ${hrs === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(diffSec / 86400);
  return `${days} ${days === 1 ? 'day' : 'days'} ago`;
};

function ProjectsPage() {
  const confirm = useConfirm();
  const {
    project: activeProject,
    projects,
    activeProjectId,
    selectProject,
    createNewProject,
    duplicateProject,
    deleteProject,
    updateProject,
    refreshProjects
  } = useWorkspace();

  const [search, setSearch] = useState("");
  const [newProject, setNewProject] = useState({
    name: "",
    code: "",
    client: "",
    location: "",
    description: "",
    notes: "",
    assigned_users: [] as string[],
    assigned_teams: [] as string[],
  });

  const { profile } = useAuth();
  const isAdmin = ["SUPER_ADMIN", "ORG_ADMIN"].includes(profile?.role || "");
  const [allUsers, setAllUsers] = useState<any[]>(() => {
    const cached = localStorage.getItem('cachedAllUsers');
    return cached ? JSON.parse(cached) : [];
  });
  const [allTeams, setAllTeams] = useState<any[]>(() => {
    const cached = localStorage.getItem('cachedAllTeams');
    return cached ? JSON.parse(cached) : [];
  });

  const assignableUsers = useMemo(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      return allUsers;
    }
    const myOrgId = profile?.organization_id;
    return allUsers.filter(u => 
      u.role !== 'SUPER_ADMIN' && 
      (!myOrgId || u.organization_id === myOrgId || !u.organization_id)
    );
  }, [allUsers, profile?.role, profile?.organization_id]);

  const assignableTeams = useMemo(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      return allTeams;
    }
    const myOrgId = profile?.organization_id;
    return allTeams.filter(t => !myOrgId || t.organization_id === myOrgId || !t.organization_id);
  }, [allTeams, profile?.role, profile?.organization_id]);

  const [pinnedProjects, setPinnedProjects] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`pinned_projects_${profile?.id}`) || "[]");
    } catch {
      return [];
    }
  });

  const [workspaceHistory, setWorkspaceHistory] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`workspace_history_${profile?.id}`) || "{}");
    } catch {
      return {};
    }
  });

  const [globalActivity, setGlobalActivity] = useState<any[]>([]);

  const loadGlobalActivity = () => {
    try {
      const log = JSON.parse(localStorage.getItem(`global_activity_${profile?.id}`) || "[]");
      setGlobalActivity(log);
    } catch {}
  };

  const handleSelectProject = (id: string) => {
    setWorkspaceHistory(prev => {
      const next = { ...prev, [id]: Date.now() };
      localStorage.setItem(`workspace_history_${profile?.id}`, JSON.stringify(next));
      return next;
    });

    // Global Activity Log for opening workspace
    const globalKey = `global_activity_${profile?.id}`;
    try {
      const globalLog = JSON.parse(localStorage.getItem(globalKey) || "[]");
      const p = projects.find(proj => proj.id === id);
      const newActivity = {
        id: Date.now().toString(),
        action: "Opened Workspace",
        detail: p ? p.name : "A workspace",
        time: Date.now(),
        color: "bg-purple-500"
      };
      if (globalLog[0]?.detail !== newActivity.detail || (Date.now() - globalLog[0]?.time > 60000)) {
        globalLog.unshift(newActivity);
        localStorage.setItem(globalKey, JSON.stringify(globalLog.slice(0, 5)));
        loadGlobalActivity(); // update local state immediately
      }
    } catch {}
      
    selectProject(id);
  };

  const togglePin = (id: string) => {
    setPinnedProjects(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(`pinned_projects_${profile?.id}`, JSON.stringify(next));
      return next;
    });
  };
  
  const loadUsersAndTeams = async () => {
    const u = await api.getUsers();
    setAllUsers(u);
    try { localStorage.setItem('cachedAllUsers', JSON.stringify(u)); } catch {}
    const t = await api.getTeams();
    setAllTeams(t);
    try { localStorage.setItem('cachedAllTeams', JSON.stringify(t)); } catch {}
  };

  useEffect(() => {
    loadUsersAndTeams();
    refreshProjects();
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    
    // Function that uses the current profile.id correctly
    const refreshActivity = () => {
      try {
        const log = JSON.parse(localStorage.getItem(`global_activity_${profile.id}`) || "[]");
        setGlobalActivity(log);
      } catch {}
    };

    refreshActivity();
    const interval = setInterval(refreshActivity, 2000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  const openCreateModal = () => {
    loadUsersAndTeams();
    setIsCreateOpen(true);
  };

  const filteredProjects = useMemo(() => {
    let result = projects;
    const q = search.toLowerCase().trim();
    if (q) {
      result = projects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const aPinned = pinnedProjects.includes(a.id);
      const bPinned = pinnedProjects.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      const aTime = workspaceHistory[a.id] || new Date((a as any).updated_at || (a as any).created_at || 0).getTime();
      const bTime = workspaceHistory[b.id] || new Date((b as any).updated_at || (b as any).created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [projects, search, pinnedProjects, workspaceHistory]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) {
      toast.error("Project Name is required!");
      return;
    }
    if (!newProject.code.trim()) {
      toast.error("Project Code is required!");
      return;
    }

    try {
      const res = await createNewProject({
        name: newProject.name.trim(),
        code: newProject.code.trim().toUpperCase(),
        client: newProject.client.trim() || "N/A",
        location: newProject.location.trim(),
        description: newProject.description.trim(),
        notes: newProject.notes.trim(),
      }, newProject.assigned_users, newProject.assigned_teams);

      if (res && res.success) {
        toast.success("Project created successfully!");
        setNewProject({
          name: "",
          code: "",
          client: "",
          location: "",
          description: "",
          notes: "",
          assigned_users: [],
          assigned_teams: [],
        });
      } else {
        toast.error(res?.message || "Failed to create project");
      }
    } catch (err: any) {
      toast.error("Error creating project: " + err.message);
    }
  };

  const handleSaveEdit = () => {
    if (editingProj) {
      if (!editingProj.name.trim()) {
        toast.error("Project Name is required!");
        return;
      }
      updateProject(editingProj);
      setEditingProj(null);
      toast.success("Project updated successfully!");
    }
  };

  const handleRemoveUserFromProject = async (projectId: string, userId: string) => {
    const isConfirmed = await confirm("Are you sure you want to remove this user from the project?", {
      title: "Remove User",
      confirmText: "Remove",
      cancelText: "Cancel"
    });
    if (!isConfirmed) return;
    const res = await api.removeUserFromProject(projectId, userId);
    if (res.success) {
      const proj = projects.find(p => p.id === projectId);
      if (proj && (proj as any).project_users) {
        (proj as any).project_users = (proj as any).project_users.filter((u: any) => u.user_id !== userId);
        updateProject({...proj});
        if (editingProj?.id === projectId) setEditingProj({...proj} as any);
      }
      toast.success("User removed from project successfully.");
    } else {
      toast.error(res.message || "Failed to remove user");
    }
  };

  const handleAddUserToProject = async (projectId: string, userId: string) => {
    if (!userId) return;
    const res = await api.addUserToProject(projectId, userId);
    if (res.success) {
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
        if (!(proj as any).project_users) (proj as any).project_users = [];
        if (!(proj as any).project_users.find((u: any) => u.user_id === userId)) {
          (proj as any).project_users.push({ project_id: projectId, user_id: userId });
          updateProject({...proj});
          if (editingProj?.id === projectId) setEditingProj({...proj} as any);
        }
      }
      toast.success("User added to project successfully!");
    } else {
      toast.error(res.message || "Failed to add user");
    }
  };

  const handleRemoveTeamFromProject = async (projectId: string, teamId: string) => {
    const isConfirmed = await confirm("Are you sure you want to remove this team from the project?", {
      title: "Remove Team",
      confirmText: "Remove",
      cancelText: "Cancel"
    });
    if (!isConfirmed) return;
    const res = await api.removeTeamFromProject(projectId, teamId);
    if (res.success) {
      const proj = projects.find(p => p.id === projectId);
      if (proj && (proj as any).project_teams) {
        (proj as any).project_teams = (proj as any).project_teams.filter((t: any) => t.team_id !== teamId);
        updateProject({...proj});
        if (editingProj?.id === projectId) setEditingProj({...proj} as any);
      }
      toast.success("Team removed from project successfully.");
    } else {
      toast.error(res.message || "Failed to remove team");
    }
  };

  const handleAddTeamToProject = async (projectId: string, teamId: string) => {
    if (!teamId) return;
    const res = await api.addTeamToProject(projectId, teamId);
    if (res.success) {
      const proj = projects.find(p => p.id === projectId);
      if (proj) {
        if (!(proj as any).project_teams) (proj as any).project_teams = [];
        if (!(proj as any).project_teams.find((t: any) => t.team_id === teamId)) {
          (proj as any).project_teams.push({ project_id: projectId, team_id: teamId });
          updateProject({...proj});
          if (editingProj?.id === projectId) setEditingProj({...proj} as any);
        }
      }
      toast.success("Team added to project successfully!");
    } else {
      toast.error(res.message || "Failed to add team");
    }
  };

  const statsMap = useMemo(() => {
    const map: Record<string, { spaces: number; zones: number; equipment: number }> = {};
    projects.forEach((p) => {
      const wdata = (p as any).workspace_data;
      if (wdata) {
        map[p.id] = {
          spaces: Array.isArray(wdata.spaces) ? wdata.spaces.length : 0,
          zones: Array.isArray(wdata.zones) ? wdata.zones.length : 0,
          equipment: Array.isArray(wdata.equipment) ? wdata.equipment.length : 0,
        };
      } else {
        map[p.id] = { spaces: 0, zones: 0, equipment: 0 };
      }
    });
    return map;
  }, [projects]);

  const totalStats = useMemo(() => {
    let spaces = 0;
    let zones = 0;
    let equipment = 0;
    Object.values(statsMap).forEach((stat) => {
      spaces += stat.spaces;
      zones += stat.zones;
      equipment += stat.equipment;
    });
    return { spaces, zones, equipment };
  }, [statsMap]);

  return (
    <AppShell title="Projects" subtitle={`${projects.length} workspaces`}>
      <div className="flex flex-col lg:flex-row h-[calc(100vh-80px)] overflow-hidden bg-background">
        
        {/* Left Side: Projects List & Control Center Dashboard */}
        <div className="flex-1 flex flex-col min-h-0 p-6 md:p-8 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-zinc-950/20">
          
          <div className="flex flex-col gap-1 mb-6 select-none">
            <h1 className="text-[20px] font-black text-foreground tracking-tight">Project Control Center</h1>
            <p className="text-[12.5px] text-muted-foreground font-semibold">
              Manage your MEP calculation scopes, workspace metrics, and project environments
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 select-none">
            <div className="bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="p-2.5 bg-primary/10 text-primary rounded-xl shrink-0">
                <FolderKanban className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Workspaces</span>
                <span className="text-[18px] font-black text-foreground font-mono">{projects.length}</span>
              </div>
            </div>
            <div className="bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl shrink-0">
                <Boxes className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Spaces</span>
                <span className="text-[18px] font-black text-foreground font-mono">{totalStats.spaces}</span>
              </div>
            </div>
            <div className="bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-xl shrink-0">
                <LayoutDashboard className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Total Zones</span>
                <span className="text-[18px] font-black text-foreground font-mono">{totalStats.zones}</span>
              </div>
            </div>
            <div className="bg-card border border-border p-4.5 rounded-2xl flex items-center gap-3.5 shadow-sm">
              <div className="p-2.5 bg-pink-500/10 text-pink-500 rounded-xl shrink-0">
                <User className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Engineers</span>
                <span className="text-[18px] font-black text-foreground font-mono">{allUsers.length}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 mb-5 select-none">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-extrabold text-foreground/90 uppercase tracking-widest text-[11px]">Workspaces List</h2>
              <p className="text-[11.5px] text-muted-foreground font-medium">Select a project to load it into the active calculator</p>
            </div>
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-3 size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search workspaces..."
                className="h-10 w-60 pl-10 pr-4 bg-card border border-border/80 focus:border-primary/80 focus:ring-1 focus:ring-primary/20 rounded-2xl text-[12.5px] outline-none transition-all duration-150 font-sans shadow-xs text-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-7xl">
            {filteredProjects.map((p) => {
              const isActive = p.id === activeProjectId;
              const stats = statsMap[p.id] || { spaces: 0, zones: 0, equipment: 0 };
              return (
                <div
                  key={p.id}
                  className={`border rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 bg-card relative overflow-hidden group shadow-sm hover:shadow-md hover:-translate-y-0.5 ${
                    isActive
                      ? "border-primary ring-1 ring-primary/20 bg-primary/[0.01]"
                      : "border-border hover:border-border-strong"
                  }`}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
                  )}
                  
                  <div className="flex flex-col gap-3.5">
                    {/* Header */}
                    <div className="flex items-center justify-between gap-4 select-none">
                      <div className="flex items-center gap-2">
                        {pinnedProjects.includes(p.id) && <Pin className="size-3.5 fill-primary text-primary" />}
                        <span className="font-mono text-[9px] text-primary bg-primary/5 dark:bg-primary/10 border border-primary/25 px-2 py-0.5 rounded font-bold uppercase tracking-widest">
                          {p.code}
                        </span>
                      </div>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-primary">
                          <CheckCircle2 className="size-3.5" /> Active
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground font-medium">
                          Inactive
                        </span>
                      )}
                    </div>

                    {/* Name */}
                    <div>
                      <h3 className="text-[14.5px] font-bold tracking-tight leading-snug group-hover:text-primary transition-colors text-foreground">
                        {p.name}
                      </h3>
                      <div className="mt-2 flex flex-col gap-1.5 text-[11.5px] text-muted-foreground font-semibold">
                        {(() => {
                          const creatorUser = allUsers.find(u => u.id === p.created_by);
                          const creatorName = creatorUser?.name || (p as any).creator_name || (p.created_by === profile?.id ? (profile?.name || "You") : "Admin");
                          return (
                            <div className="flex items-center gap-2">
                              <User className="size-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                              <span>Created by: <strong className="text-foreground font-bold">{creatorName}</strong></span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center gap-2">
                          <User className="size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span>Client: <strong className="text-foreground/80 font-bold">{p.client}</strong></span>
                        </div>
                        {p.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                            <span>{p.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Calendar className="size-3.5 text-slate-400 dark:text-zinc-500 shrink-0" />
                          <span>Modified: <span className="text-foreground/75 font-mono">{formatRelativeTime((p as any).updated_at || (p as any).last_modified || p.lastModified || (p as any).created_at || p.createdDate)}</span></span>
                        </div>
                      </div>
                    </div>

                    {/* Description block */}
                    {p.description && (
                      <p className="text-[11.5px] text-muted-foreground leading-relaxed font-normal bg-slate-50/50 dark:bg-zinc-800/10 p-3.5 rounded-[18px] border border-border/40 line-clamp-2">
                        {p.description}
                      </p>
                    )}

                    {/* Metric Tiles */}
                    <div className="grid grid-cols-3 gap-2.5 pt-1 select-none">
                      <div className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-surface-2 border border-border/40 text-center gap-0.5">
                        <span className="text-[12px] font-bold text-foreground font-mono">{stats.spaces}</span>
                        <span className="text-[8.5px] text-muted-foreground font-bold uppercase tracking-wider">Spaces</span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-surface-2 border border-border/40 text-center gap-0.5">
                        <span className="text-[12px] font-bold text-foreground font-mono">{stats.zones}</span>
                        <span className="text-[8.5px] text-muted-foreground font-bold uppercase tracking-wider">Zones</span>
                      </div>
                      <div className="flex flex-col items-center justify-center py-2.5 px-2 rounded-xl bg-surface-2 border border-border/40 text-center gap-0.5">
                        <span className="text-[12px] font-bold text-foreground font-mono">{stats.equipment}</span>
                        <span className="text-[8.5px] text-muted-foreground font-bold uppercase tracking-wider">Equip</span>
                      </div>
                    </div>

                    {/* Assignments (Users/Teams) */}
                    {((p as any).project_users?.length > 0 || (p as any).project_teams?.length > 0) && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50">
                        {(p as any).project_teams?.map((pt: any) => {
                          const team = allTeams.find(t => String(t.id) === String(pt.team_id) || String(t.id) === String(pt.id));
                          const teamName = team?.name || pt.teams?.name || pt.team_name || pt.name || 'Team';
                          return (
                            <span key={`t-${pt.team_id || pt.id}`} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-semibold border border-primary/20">
                              <Users className="size-3" /> {teamName}
                              {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN' || p.created_by === profile?.id) && (
                                <button onClick={() => handleRemoveTeamFromProject(p.id, pt.team_id)} className="hover:bg-primary/20 rounded-full p-0.5 cursor-pointer ml-1">
                                  <X className="size-2.5" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                        {(p as any).project_users?.map((pu: any) => {
                          const user = allUsers.find(u => u.id === pu.user_id);
                          return (
                            <span key={`u-${pu.user_id}`} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 text-foreground px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border">
                              <User className="size-3 text-muted-foreground" /> {user?.name || 'User'}
                              {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN' || p.created_by === profile?.id) && (
                                <button onClick={() => handleRemoveUserFromProject(p.id, pu.user_id)} className="hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full p-0.5 cursor-pointer ml-1">
                                  <X className="size-2.5" />
                                </button>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 pt-3.5 border-t border-border/50 flex items-center justify-end gap-1.5">
                    {!isActive ? (
                      <button
                        onClick={() => handleSelectProject(p.id)}
                        className="flex-1 h-8.5 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/95 flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[11.5px] shadow-sm shadow-primary/5"
                        title="Open Project"
                      >
                        <Play className="size-3 fill-current" /> Open Workspace
                      </button>
                    ) : (
                      <span className="flex-1 text-[11px] text-muted-foreground font-bold italic select-none pl-1">
                        Currently editing
                      </span>
                    )}
                    <button
                      onClick={() => togglePin(p.id)}
                      className={`size-8.5 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${pinnedProjects.includes(p.id) ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20' : 'border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-2'}`}
                      title={pinnedProjects.includes(p.id) ? "Unpin Workspace" : "Pin Workspace"}
                    >
                      <Pin className="size-3.5" />
                    </button>
                    <button
                      onClick={() => duplicateProject(p.id)}
                      className="size-8.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-2 flex items-center justify-center transition-all cursor-pointer"
                      title="Duplicate"
                    >
                      <Copy className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingProj(p)}
                      className="size-8.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-surface-2 flex items-center justify-center transition-all cursor-pointer"
                      title="Edit Details"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                    {(p.created_by === profile?.id || profile?.role === 'SUPER_ADMIN') && (
                      <button
                        onClick={() => setDeleteConfirmId(p.id)}
                        className="size-8.5 rounded-lg border border-border bg-background text-muted-foreground hover:text-destructive hover:bg-destructive/5 flex items-center justify-center transition-all cursor-pointer"
                        title="Delete Workspace"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state if no projects match */}
          {filteredProjects.length === 0 && (
            <div className="text-center py-16 bg-card border border-dashed border-border rounded-[28px] p-8 max-w-md mx-auto mt-8 flex flex-col items-center gap-4">
              <FolderKanban className="size-12 text-muted-foreground" />
              <div>
                <p className="text-[14px] font-bold text-foreground">No workspaces found</p>
                <p className="text-[12px] text-muted-foreground mt-1">Try refining your search term or create a new workspace.</p>
              </div>
              <button
                onClick={openCreateModal}
                className="px-5 py-2.5 bg-primary text-primary-foreground font-bold rounded-2xl hover:bg-primary/95 text-[12.5px] transition-all cursor-pointer shadow-sm shadow-primary/10"
              >
                Create a workspace
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Productivity Control Center Panel */}
        <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-border flex flex-col min-h-0 bg-surface-1 p-6 overflow-y-auto custom-scrollbar select-none">
          <div className="flex flex-col gap-6">
            
            {/* Quick Actions */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Quick Actions</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={openCreateModal}
                  className="w-full bg-gradient-to-r from-primary to-accent hover:brightness-105 text-white font-bold h-10 rounded-xl transition-all shadow-md shadow-primary/10 flex items-center justify-center gap-1.5 cursor-pointer text-[12px]"
                >
                  <Plus className="size-4" /> Create New Workspace
                </button>
                <button
                  onClick={() => handleSelectProject(activeProject.id)}
                  className="w-full bg-card border border-border text-foreground hover:bg-surface-2 font-bold h-10 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer text-[12px]"
                >
                  <Play className="size-3.5 fill-current text-primary" /> Continue Active Work
                </button>
              </div>
            </div>

            {/* Recently Opened / Contributed */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Recently Opened</h3>
              <div className="flex flex-col gap-2.5">
                {[...projects].sort((a,b) => (workspaceHistory[b.id] || new Date((b as any).updated_at || (b as any).created_at || 0).getTime()) - (workspaceHistory[a.id] || new Date((a as any).updated_at || (a as any).created_at || 0).getTime())).slice(0, 3).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleSelectProject(p.id)}
                    className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:bg-surface-2 transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="p-2 bg-primary/5 text-primary rounded-lg shrink-0">
                        <Building2 className="size-4" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[12.5px] font-bold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{p.code}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity (Productivity Placeholders or Dynamic) */}
            <div className="flex flex-col gap-3">
              <h3 className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">Recent Workspace Activity</h3>
              <div className="flex flex-col gap-3">
                {globalActivity.length > 0 ? globalActivity.map(act => (
                  <div key={act.id} className="flex gap-2.5 text-[12px] leading-relaxed">
                    <div className={`size-2 rounded-full ${act.color || 'bg-blue-500'} mt-1.5 shrink-0`} />
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground">{act.action}</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-500">
                        {act.detail} · {Math.max(1, Math.floor((Date.now() - act.time) / 60000))}m ago
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="flex gap-2.5 text-[12px] leading-relaxed">
                    <div className="size-2 rounded-full bg-slate-300 dark:bg-zinc-700 mt-1.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-muted-foreground">No recent activity</span>
                      <span className="text-[10px] text-slate-400 dark:text-zinc-600">Open a workspace or calculator to track</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Tips */}
            <div className="flex flex-col gap-2.5 p-4 bg-primary/[0.03] border border-primary/10 rounded-2xl select-none">
              <div className="flex items-center gap-2 text-primary">
                <HelpCircle className="size-4" />
                <span className="font-bold text-[11px] uppercase tracking-wider font-sans">Quick Tip</span>
              </div>
              <p className="text-[11.5px] text-muted-foreground leading-relaxed font-sans">
                Right-click on any project card or the header project dropdown to Rename, Duplicate, or Delete immediately without navigating away.
              </p>
            </div>
            
          </div>
        </div>

      </div>

      {/* Create New Project Dialog */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scale-in text-xs">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Plus className="size-4.5" />
                </div>
                <h3 className="font-bold text-[16.5px] text-foreground tracking-tight font-sans">Create Workspace</h3>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150">
                <X className="size-4.5" />
              </button>
            </header>
            
            <form onSubmit={(e) => {
              handleCreate(e);
              setIsCreateOpen(false);
            }} className="flex-1 flex flex-col justify-between">
              <div className="p-6 flex flex-col gap-4 font-sans max-h-[60vh] overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Project Name *</label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <Building2 className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={newProject.name}
                      onChange={(e) => setNewProject({ ...newProject, name: e.target.value.replace(/[0-9]/g, '') })}
                      placeholder="e.g. Dubai Mall Expansion"
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none">Project Code *</label>
                    <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                      <FileCode className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                      <input
                        type="text"
                        required
                        value={newProject.code}
                        onChange={(e) => setNewProject({ ...newProject, code: e.target.value })}
                        placeholder="e.g. DMX-2026"
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-mono uppercase tracking-wider outline-none focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Client Name</label>
                    <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                      <User className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                      <input
                        type="text"
                        value={newProject.client}
                        onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                        placeholder="e.g. Emaar"
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Location</label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <MapPin className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                    <input
                      type="text"
                      value={newProject.location}
                      onChange={(e) => setNewProject({ ...newProject, location: e.target.value })}
                      placeholder="e.g. Dubai, UAE"
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Description</label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <FileText className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                    <input
                      type="text"
                      value={newProject.description}
                      onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                      placeholder="Brief scope summary..."
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Design Code & Notes</label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <HelpCircle className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                    <textarea
                      rows={4}
                      value={newProject.notes}
                      onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                      placeholder="e.g. ASHRAE 62.1 Standard, Title 24..."
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans resize-none outline-none focus:outline-none transition-all"
                    />
                  </div>
                </div>

                {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN') && (
                  <div className="flex flex-col gap-4 mt-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                     <div className="flex flex-col gap-1.5">
                        <label className="text-primary font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Assign Users to Project</label>
                        <select 
                           multiple 
                           value={newProject.assigned_users}
                           onChange={(e) => {
                             const vals = Array.from(e.target.selectedOptions, option => option.value);
                             setNewProject({ ...newProject, assigned_users: vals });
                           }}
                           className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-[12px] h-24 custom-scrollbar outline-none focus:border-primary"
                        >
                           {assignableUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.name}</option>
                           ))}
                        </select>
                        <span className="text-[9px] text-muted-foreground">Hold Ctrl/Cmd to select multiple</span>
                     </div>
                     
                     <div className="flex flex-col gap-1.5">
                        <label className="text-primary font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Assign Teams to Project</label>
                        <select 
                           multiple 
                           value={newProject.assigned_teams}
                           onChange={(e) => {
                             const vals = Array.from(e.target.selectedOptions, option => option.value);
                             setNewProject({ ...newProject, assigned_teams: vals });
                           }}
                           className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-[12px] h-24 custom-scrollbar outline-none focus:border-primary"
                        >
                           {assignableTeams.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                           ))}
                        </select>
                        <span className="text-[9px] text-muted-foreground">Hold Ctrl/Cmd to select multiple</span>
                     </div>
                  </div>
                )}

              </div>
              
              <footer className="px-6 py-5 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150 font-sans"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-primary text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
                >
                  Create Workspace
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Overlay */}
      {editingProj && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in text-xs">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
              <h3 className="font-bold text-[16px] text-foreground tracking-tight">Edit Project Details</h3>
              <button onClick={() => setEditingProj(null)} className="size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150">
                <X className="size-4.5" />
              </button>
            </header>
            <div className="p-6 flex flex-col gap-4 font-sans">
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans">Project Name</label>
                <input
                  type="text"
                  value={editingProj.name}
                  onChange={(e) => setEditingProj({ ...editingProj, name: e.target.value.replace(/[0-9]/g, '') })}
                  className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none">Project Code</label>
                <input
                  type="text"
                  value={editingProj.code}
                  onChange={(e) => setEditingProj({ ...editingProj, code: e.target.value.toUpperCase() })}
                  className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-mono uppercase tracking-wider transition-all duration-150"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans">Client Name</label>
                <input
                  type="text"
                  value={editingProj.client}
                  onChange={(e) => setEditingProj({ ...editingProj, client: e.target.value })}
                  className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans">Location</label>
                <input
                  type="text"
                  value={editingProj.location || ""}
                  onChange={(e) => setEditingProj({ ...editingProj, location: e.target.value })}
                  className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
                />
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans">Add Team</label>
                <select
                  onChange={(e) => {
                    handleAddTeamToProject(editingProj.id, e.target.value);
                    e.target.value = "";
                  }}
                  className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150"
                  defaultValue=""
                >
                  <option value="" disabled>Select Team to add...</option>
                  {allTeams.filter(t => !(editingProj as any).project_teams?.some((pt: any) => pt.team_id === t.id)).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans">Add Engineer/User</label>
                <select
                  onChange={(e) => {
                    handleAddUserToProject(editingProj.id, e.target.value);
                    e.target.value = "";
                  }}
                  className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150 mb-2"
                  defaultValue=""
                >
                  <option value="" disabled>Select User to add...</option>
                  {assignableUsers.filter(u => !(editingProj as any).project_users?.some((pu: any) => pu.user_id === u.id)).map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                {/* Active Assignments List in Edit Modal */}
                {((editingProj as any).project_users?.length > 0 || (editingProj as any).project_teams?.length > 0) && (
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border/50 mt-2">
                    {(editingProj as any).project_teams?.map((pt: any) => {
                      const team = allTeams.find(t => String(t.id) === String(pt.team_id) || String(t.id) === String(pt.id));
                      const teamName = team?.name || pt.teams?.name || pt.team_name || pt.name || 'Team';
                      return (
                        <span key={`t-${pt.team_id || pt.id}`} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-semibold border border-primary/20">
                          <Users className="size-3" /> {teamName}
                          <button onClick={() => handleRemoveTeamFromProject(editingProj.id, pt.team_id)} className="hover:bg-primary/20 rounded-full p-0.5 cursor-pointer ml-1">
                            <X className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                    {(editingProj as any).project_users?.map((pu: any) => {
                      const user = allUsers.find(u => u.id === pu.user_id);
                      return (
                        <span key={`u-${pu.user_id}`} className="inline-flex items-center gap-1 bg-slate-100 dark:bg-zinc-800 text-foreground px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border">
                          <User className="size-3 text-muted-foreground" /> {user?.name || 'User'}
                          <button onClick={() => handleRemoveUserFromProject(editingProj.id, pu.user_id)} className="hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full p-0.5 cursor-pointer ml-1">
                            <X className="size-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <footer className="px-6 py-5 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs">
              <button
                onClick={() => setEditingProj(null)}
                className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-primary text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                Save Details
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Delete Confirmation Overlay */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in text-xs">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-destructive/[0.03] backdrop-blur-xs">
              <h3 className="font-bold text-[16px] text-destructive tracking-tight font-sans">Delete Workspace?</h3>
              <button onClick={() => setDeleteConfirmId(null)} className="size-8.5 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive cursor-pointer transition-all duration-150">
                <X className="size-4.5" />
              </button>
            </header>
            <div className="p-6 flex gap-4 text-[12px] leading-relaxed font-sans">
              <div className="size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5.5" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-bold text-foreground text-[13px]">Are you sure you want to delete this workspace?</p>
                <p className="text-slate-500 dark:text-zinc-400 text-[11.5px] font-semibold leading-relaxed">
                  This will permanently clear all project metadata, spaces list, zones mapping, and equipment scheduling from local storage. This action cannot be undone.
                </p>
              </div>
            </div>
            <footer className="px-6 py-5 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all duration-150"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const targetId = deleteConfirmId;
                  setDeleteConfirmId(null);
                  if (targetId) {
                    const res = await deleteProject(targetId);
                    if (res && res.success === false) {
                      toast.error(res.message || "Failed to delete project");
                    } else {
                      toast.success("Workspace deleted successfully!");
                    }
                  }
                }}
                className="bg-destructive text-destructive-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-destructive/95 transition-all cursor-pointer shadow-md shadow-destructive/15"
              >
                Confirm Delete
              </button>
            </footer>
          </div>
        </div>
      )}
    </AppShell>
  );
}

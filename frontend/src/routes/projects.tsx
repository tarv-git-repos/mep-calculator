import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import {
  FolderKanban, Plus, Trash2, Copy, Play, Calendar, User, Users, UserPlus, FileCode,
  MapPin, CheckCircle2, X, Edit3, Save, AlertTriangle, Search, ShieldCheck,
  Building2, FileText, Wind, Boxes, LayoutDashboard, HelpCircle, ChevronRight, ChevronDown, ChevronUp, Pin, Check,
  ArrowUpDown, ArrowRight, Sparkles, Clock, Layers, Cpu, BarChart3,
  Home, GraduationCap, ShoppingBag, Landmark, HeartPulse, Briefcase, Lock, Unlock, SlidersHorizontal, CheckSquare, Square
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  useWorkspace,
  type Project,
  PROJECT_TYPES,
  PROJECT_STAGES,
  canEditProjectStages,
  type ProjectType,
  type ProjectStageName
} from "@/lib/workspace-store";

export const PROJECT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  "Villa": {
    label: "Villa",
    icon: Home,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
  "School Projects": {
    label: "School Projects",
    icon: GraduationCap,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
  "Mall & Mosque": {
    label: "Mall & Mosque",
    icon: ShoppingBag,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
  "Complex": {
    label: "Complex",
    icon: Landmark,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
  "Buildings / Apartment": {
    label: "Buildings / Apartment",
    icon: Building2,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
  "Hospitals": {
    label: "Hospitals",
    icon: HeartPulse,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
  "Offices / Residential": {
    label: "Offices / Residential",
    icon: Briefcase,
    color: "text-foreground/80",
    bg: "bg-surface-2/80 dark:bg-zinc-800/80",
    border: "border-border/70"
  },
};

export const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  "Preconcept Design": { label: "Preconcept Design", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
  "Concept Design": { label: "Concept Design", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
  "Schematic Design": { label: "Schematic Design", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
  "Detailed Design": { label: "Detailed Design", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
  "Tender Documentation": { label: "Tender Documentation", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
  "Issued For Construction": { label: "Issued For Construction", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
  "Completed": { label: "Completed", color: "text-foreground/90", bg: "bg-surface-2/80 dark:bg-zinc-800/80", border: "border-border/70" },
};
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

const getUserDisplayName = (userParam: any, usersList: any[]) => {
  if (!userParam) return 'User';

  // 1. Direct Object Resolution
  if (typeof userParam === 'object' && userParam !== null) {
    if (userParam.name && userParam.name.trim() !== '' && !userParam.name.startsWith('usr_') && !userParam.name.startsWith('User #')) {
      const handle = userParam.email ? ` (${userParam.email.split('@')[0]})` : '';
      return `${userParam.name}${handle}`;
    }
    if (userParam.user && userParam.user.name) {
      const handle = userParam.user.email ? ` (${userParam.user.email.split('@')[0]})` : '';
      return `${userParam.user.name}${handle}`;
    }
    if (userParam.user_name || userParam.userName) {
      return userParam.user_name || userParam.userName;
    }
  }

  const rawId = typeof userParam === 'object' ? (userParam.user_id || userParam.id || userParam.user?.id || userParam.email || '') : userParam;
  if (!rawId) return 'User';
  const cleanId = String(rawId).trim().toLowerCase();

  // 2. Lookup in usersList parameter
  const user = (usersList || []).find(u => 
    String(u.id || '').trim().toLowerCase() === cleanId || 
    String(u.email || '').trim().toLowerCase() === cleanId ||
    (u.email && String(u.email).trim().toLowerCase().split('@')[0] === cleanId) ||
    (u.user_id && String(u.user_id).trim().toLowerCase() === cleanId)
  );

  if (user?.name) {
    const handle = user.email ? ` (${user.email.split('@')[0]})` : '';
    return `${user.name}${handle}`;
  }

  // 3. Fallback LocalStorage users cache check
  if (typeof localStorage !== 'undefined') {
    try {
      const cached = localStorage.getItem('mep_local_users') || localStorage.getItem('cachedAllUsers');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          const match = parsed.find((u: any) => 
            String(u.id || '').trim().toLowerCase() === cleanId ||
            String(u.email || '').trim().toLowerCase() === cleanId ||
            (u.email && String(u.email).trim().toLowerCase().split('@')[0] === cleanId)
          );
          if (match?.name) {
            const handle = match.email ? ` (${match.email.split('@')[0]})` : '';
            return `${match.name}${handle}`;
          }
        }
      }
    } catch (e) {}
  }

  if (cleanId.includes('@')) return cleanId.split('@')[0];

  // 4. Formatted fallback if raw ID
  if (cleanId.startsWith('usr_')) {
    const parts = cleanId.split('_');
    const suffix = parts[parts.length - 1];
    return `User #${suffix}`;
  }

  return String(rawId);
};

const getInitials = (name?: string) => {
  if (!name) return 'U';
  const clean = name.replace(/\([^)]*\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

function MemberAssignmentPicker({
  assignableUsers,
  assignableTeams,
  selectedUsers,
  selectedTeams,
  onChangeUsers,
  onChangeTeams,
}: {
  assignableUsers: any[];
  assignableTeams: any[];
  selectedUsers: string[];
  selectedTeams: string[];
  onChangeUsers: (users: string[]) => void;
  onChangeTeams: (teams: string[]) => void;
}) {
  const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users');
  const [search, setSearch] = useState('');

  const filteredUsers = useMemo(() => {
    if (!search.trim()) return assignableUsers;
    const q = search.toLowerCase();
    return assignableUsers.filter(
      (u) =>
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.role && u.role.toLowerCase().includes(q))
    );
  }, [assignableUsers, search]);

  const filteredTeams = useMemo(() => {
    if (!search.trim()) return assignableTeams;
    const q = search.toLowerCase();
    return assignableTeams.filter(
      (t) => t.name && t.name.toLowerCase().includes(q)
    );
  }, [assignableTeams, search]);

  const toggleUser = (userObj: any) => {
    const userId = userObj.id || userObj.email;
    if (!userId) return;
    const isCurrentlySelected = selectedUsers.some(id => 
      String(id).toLowerCase() === String(userObj.id || '').toLowerCase() || 
      String(id).toLowerCase() === String(userObj.email || '').toLowerCase()
    );
    if (isCurrentlySelected) {
      onChangeUsers(selectedUsers.filter((id) => 
        String(id).toLowerCase() !== String(userObj.id || '').toLowerCase() &&
        String(id).toLowerCase() !== String(userObj.email || '').toLowerCase()
      ));
    } else {
      onChangeUsers([...selectedUsers, userId]);
    }
  };

  const toggleTeam = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      onChangeTeams(selectedTeams.filter((id) => id !== teamId));
    } else {
      onChangeTeams([...selectedTeams, teamId]);
    }
  };

  const selectAll = () => {
    if (activeTab === 'users') {
      const allIds = Array.from(new Set([...selectedUsers, ...filteredUsers.map((u) => u.id || u.email)]));
      onChangeUsers(allIds);
    } else {
      const allIds = Array.from(new Set([...selectedTeams, ...filteredTeams.map((t) => t.id)]));
      onChangeTeams(allIds);
    }
  };

  const clearAll = () => {
    if (activeTab === 'users') {
      onChangeUsers([]);
    } else {
      onChangeTeams([]);
    }
  };

  const selectedUserObjects = useMemo(() => {
    return assignableUsers.filter((u) => 
      selectedUsers.some(id => 
        String(id).toLowerCase() === String(u.id || '').toLowerCase() || 
        String(id).toLowerCase() === String(u.email || '').toLowerCase()
      )
    );
  }, [assignableUsers, selectedUsers]);

  const selectedTeamObjects = useMemo(() => {
    return assignableTeams.filter((t) => selectedTeams.includes(t.id));
  }, [assignableTeams, selectedTeams]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-slate-50/70 dark:bg-zinc-900/60 rounded-2xl border border-border/80 shadow-2xs">
      {/* Header & Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users'
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="size-3.5" />
            Users
            <span className="ml-1 px-1.5 py-0.2 text-[9.5px] rounded-full bg-primary/10 text-primary font-extrabold">
              {selectedUsers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'teams'
                ? 'bg-background text-primary shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Users className="size-3.5" />
            Teams
            <span className="ml-1 px-1.5 py-0.2 text-[9.5px] rounded-full bg-primary/10 text-primary font-extrabold">
              {selectedTeams.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-[10.5px] font-semibold text-primary hover:underline cursor-pointer"
          >
            Select All
          </button>
          <span className="text-muted-foreground/40 text-xs">•</span>
          <button
            type="button"
            onClick={clearAll}
            className="text-[10.5px] font-semibold text-muted-foreground hover:text-rose-500 hover:underline cursor-pointer"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Selected Members Badges Strip */}
      {(selectedUserObjects.length > 0 || selectedTeamObjects.length > 0) && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-background/80 rounded-xl border border-border/50 max-h-24 overflow-y-auto custom-scrollbar">
          {selectedUserObjects.map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary border border-primary/20 animate-fade-in"
            >
              <User className="size-3 text-primary" />
              <span>{u.name}</span>
              <button
                type="button"
                onClick={() => toggleUser(u)}
                className="hover:bg-primary/20 rounded-full p-0.5 text-primary cursor-pointer transition-colors"
                title="Remove"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}

          {selectedTeamObjects.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 animate-fade-in"
            >
              <Users className="size-3" />
              <span>{t.name}</span>
              <button
                type="button"
                onClick={() => toggleTeam(t.id)}
                className="hover:bg-emerald-500/20 rounded-full p-0.5 text-emerald-600 cursor-pointer transition-colors"
                title="Remove"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === 'users'
              ? 'Search users by name, email or role...'
              : 'Search teams by name...'
          }
          className="w-full bg-background border border-border/70 rounded-xl pl-9 pr-8 py-2 text-[11.5px] outline-none focus:border-primary transition-all"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Selection Grid */}
      {activeTab === 'users' ? (
        filteredUsers.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground italic">
            No users found matching "{search}"
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
            {filteredUsers.map((u) => {
              const isSelected = selectedUsers.some(id => 
                String(id).toLowerCase() === String(u.id || '').toLowerCase() || 
                String(id).toLowerCase() === String(u.email || '').toLowerCase()
              );
              return (
                <div
                  key={u.id || u.email}
                  onClick={() => toggleUser(u)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-150 select-none ${
                    isSelected
                      ? 'bg-primary/10 border-primary/40 text-foreground ring-1 ring-primary/20 shadow-2xs'
                      : 'bg-background border-border/70 hover:border-primary/40 hover:bg-accent/40 text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                      }`}
                    >
                      {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[12px] truncate text-foreground leading-snug">
                        {u.name}
                      </span>
                      {u.role && (
                        <span className="text-[9.5px] text-muted-foreground truncate">
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'border border-border/80 bg-background'
                    }`}
                  >
                    {isSelected && <Check className="size-3 stroke-3" />}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredTeams.length === 0 ? (
        <div className="p-4 text-center text-xs text-muted-foreground italic">
          No teams found matching "{search}"
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
          {filteredTeams.map((t) => {
            const isSelected = selectedTeams.includes(t.id);
            const memberCount = (t.team_members || []).length;
            return (
              <div
                key={t.id}
                onClick={() => toggleTeam(t.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border text-xs cursor-pointer transition-all duration-150 select-none ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/20 shadow-2xs'
                    : 'bg-background border-border/70 hover:border-emerald-500/40 hover:bg-accent/40 text-muted-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`size-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isSelected ? 'bg-emerald-500 text-white' : 'bg-muted text-foreground'
                    }`}
                  >
                    <Users className="size-3.5" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[12px] truncate text-foreground leading-snug">
                      {t.name}
                    </span>
                    <span className="text-[9.5px] text-muted-foreground">
                      {memberCount} member{memberCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div
                  className={`size-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? 'bg-emerald-500 text-white' : 'border border-border/80 bg-background'
                  }`}
                >
                  {isSelected && <Check className="size-3 stroke-3" />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    updateProjectStage,
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
    project_type: "Buildings / Apartment" as ProjectType,
    applicable_stages: [...PROJECT_STAGES] as ProjectStageName[],
    current_stage: "Concept Design" as ProjectStageName,
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
    const myCompany = profile?.company || (profile as any)?.organization;

    return allUsers.filter(u => {
      if (u.role === 'SUPER_ADMIN' || u.email === 'admin@tarv.ai') return false;
      if (!myOrgId && !myCompany) return false;
      const uOrgId = u.organization_id;
      const uCompany = u.company || u.organization;
      if (myOrgId && uOrgId && String(uOrgId) === String(myOrgId)) return true;
      if (myCompany && uCompany && uCompany === myCompany) return true;
      if (myOrgId && uCompany && uCompany === String(myOrgId)) return true;
      if (myCompany && uOrgId && String(uOrgId) === String(myCompany)) return true;
      return false;
    });
  }, [allUsers, profile?.role, profile?.organization_id, profile?.company, (profile as any)?.organization]);

  const assignableTeams = useMemo(() => {
    if (profile?.role === 'SUPER_ADMIN') {
      return allTeams;
    }
    const myOrgId = profile?.organization_id;
    const myCompany = profile?.company || (profile as any)?.organization;

    return allTeams.filter(t => {
      if (!myOrgId && !myCompany) return false;
      const tOrgId = t.organization_id;
      if (myOrgId && tOrgId && String(tOrgId) === String(myOrgId)) return true;
      if (myCompany && tOrgId && String(tOrgId) === String(myCompany)) return true;
      return false;
    });
  }, [allTeams, profile?.role, profile?.organization_id, profile?.company, (profile as any)?.organization]);

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

  const navigate = useNavigate();

  const handleOpenWorkspace = (id: string) => {
    handleSelectProject(id);
    let targetRoute = "";
    try {
      targetRoute =
        localStorage.getItem(`mep_last_route_${id}`) ||
        localStorage.getItem("mep_last_active_route") ||
        "";
    } catch {}

    if (!targetRoute || targetRoute === "/" || targetRoute === "/dashboard" || targetRoute === "/projects") {
      targetRoute = "/bim-viewer";
    }

    const p = projects.find(proj => proj.id === id);
    toast.info(`Opening ${p ? p.name : "workspace"}...`);
    navigate({ to: targetRoute as any });
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
  }, [profile?.id]);

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
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());

  const toggleExpandMembers = (projId: string) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      if (next.has(projId)) {
        next.delete(projId);
      } else {
        next.add(projId);
      }
      return next;
    });
  };
  
  const openCreateModal = async () => {
    await loadUsersAndTeams();
    const creatorId = profile?.id;
    setNewProject((prev) => ({
      ...prev,
      assigned_users: creatorId ? [creatorId] : [],
      assigned_teams: [],
    }));
    setIsCreateOpen(true);
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

  type ProjectFilterTab = 'ALL' | 'ACTIVE_PINNED' | 'MY_PROJECTS';
  type ProjectTypeFilter = 'ALL' | ProjectType;
  type ProjectSortOption = 'RECENT' | 'NAME_ASC' | 'NAME_DESC' | 'TYPE_ASC' | 'STAGE_ASC' | 'SPACES_DESC';

  const [filterTab, setFilterTab] = useState<ProjectFilterTab>('ALL');
  const [typeFilter, setTypeFilter] = useState<ProjectTypeFilter>('ALL');
  const [sortBy, setSortBy] = useState<ProjectSortOption>('RECENT');
  const [showTypologyStats, setShowTypologyStats] = useState(false);
  const canEditStages = canEditProjectStages(profile);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: projects.length };
    PROJECT_TYPES.forEach(t => { counts[t] = 0; });
    projects.forEach(p => {
      const t = (p.project_type || 'Buildings / Apartment') as ProjectType;
      if (counts[t] !== undefined) counts[t]++;
      else counts[t] = 1;
    });
    return counts;
  }, [projects]);

  const typologyStats = useMemo(() => {
    const max = Math.max(1, ...PROJECT_TYPES.map(t => typeCounts[t] || 0));
    const items = PROJECT_TYPES.map(t => ({
      type: t,
      count: typeCounts[t] || 0,
      pct: projects.length > 0 ? Math.round(((typeCounts[t] || 0) / projects.length) * 100) : 0,
      barPct: Math.round(((typeCounts[t] || 0) / max) * 100),
    }));
    const sorted = [...items].sort((a, b) => b.count - a.count);
    const highest = sorted[0] || { type: "Buildings / Apartment", count: 0, pct: 0, barPct: 0 };
    const lowest = sorted[sorted.length - 1] || { type: "Villa", count: 0, pct: 0, barPct: 0 };
    const zeroCount = items.filter(i => i.count === 0).length;
    return { items, highest, lowest, zeroCount };
  }, [typeCounts, projects.length]);

  const pinnedAndActiveCount = useMemo(() => {
    return projects.filter(p => p.id === activeProjectId || pinnedProjects.includes(p.id)).length;
  }, [projects, activeProjectId, pinnedProjects]);

  const myProjectsCount = useMemo(() => {
    return projects.filter(p => 
      p.created_by === profile?.id || 
      ((p as any).project_users || []).some((u: any) => String(u.user_id || u.id || u).toLowerCase() === String(profile?.id || '').toLowerCase())
    ).length;
  }, [projects, profile?.id]);

  const userAssignedProjects = projects;

  const filteredProjects = useMemo(() => {
    let result = userAssignedProjects;
    const q = search.toLowerCase().trim();
    if (q) {
      result = userAssignedProjects.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.client.toLowerCase().includes(q) ||
          (p.location && p.location.toLowerCase().includes(q))
      );
    }

    if (filterTab === 'ACTIVE_PINNED') {
      result = result.filter(p => p.id === activeProjectId || pinnedProjects.includes(p.id));
    } else if (filterTab === 'MY_PROJECTS') {
      result = result.filter(p => 
        p.created_by === profile?.id || 
        ((p as any).project_users || []).some((u: any) => String(u.user_id || u.id || u).toLowerCase() === String(profile?.id || '').toLowerCase())
      );
    }

    if (typeFilter !== 'ALL') {
      result = result.filter(p => (p.project_type || 'Buildings / Apartment') === typeFilter);
    }

    return [...result].sort((a, b) => {
      if (sortBy === 'NAME_ASC') {
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'NAME_DESC') {
        return b.name.localeCompare(a.name);
      }
      if (sortBy === 'TYPE_ASC') {
        const getIdx = (t?: string) => {
          const idx = PROJECT_TYPES.indexOf(t as any);
          return idx === -1 ? 99 : idx;
        };
        const idxA = getIdx(a.project_type);
        const idxB = getIdx(b.project_type);
        if (idxA !== idxB) return idxA - idxB;
        return a.name.localeCompare(b.name);
      }
      if (sortBy === 'STAGE_ASC') {
        const getIdx = (stg?: string) => {
          const idx = PROJECT_STAGES.indexOf(stg as any);
          return idx === -1 ? 99 : idx;
        };
        return getIdx(a.current_stage) - getIdx(b.current_stage);
      }
      if (sortBy === 'SPACES_DESC') {
        const aSpaces = statsMap[a.id]?.spaces || 0;
        const bSpaces = statsMap[b.id]?.spaces || 0;
        return bSpaces - aSpaces;
      }

      // Default: RECENT with pinned first
      const aPinned = pinnedProjects.includes(a.id);
      const bPinned = pinnedProjects.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      
      const aTime = workspaceHistory[a.id] || new Date((a as any).updated_at || (a as any).created_at || 0).getTime();
      const bTime = workspaceHistory[b.id] || new Date((b as any).updated_at || (b as any).created_at || 0).getTime();
      return bTime - aTime;
    });
  }, [userAssignedProjects, search, filterTab, typeFilter, sortBy, pinnedProjects, workspaceHistory, activeProjectId, profile?.id, statsMap]);

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
        project_type: newProject.project_type,
        applicable_stages: newProject.applicable_stages,
        current_stage: newProject.current_stage,
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
          project_type: "Buildings / Apartment",
          applicable_stages: [...PROJECT_STAGES],
          current_stage: "Concept Design",
          assigned_users: [],
          assigned_teams: [],
        });
        setIsCreateOpen(false);
        await refreshProjects();
      } else {
        toast.error(res?.message || "Failed to create project");
      }
    } catch (err: any) {
      toast.error("Error creating project: " + err.message);
    }
  };

  const handleSaveEdit = async () => {
    if (editingProj) {
      if (!editingProj.name.trim()) {
        toast.error("Project Name is required!");
        return;
      }
      const res = await api.updateProjectDetails(editingProj.id, {
        name: editingProj.name.trim(),
        code: editingProj.code.trim().toUpperCase(),
        client: editingProj.client,
        location: editingProj.location,
        description: editingProj.description,
        notes: editingProj.notes,
        project_type: editingProj.project_type,
        applicable_stages: editingProj.applicable_stages,
        current_stage: editingProj.current_stage,
        stage_status: editingProj.stage_status,
      });
      if (res && res.success) {
        updateProject(editingProj);
        setEditingProj(null);
        toast.success("Project updated successfully!");
        await refreshProjects();
      } else {
        toast.error(res?.message || "Failed to update project details");
      }
    }
  };

  const handleQuickStageChange = async (projectId: string, newStage: string) => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!canEditProjectStages(profile, targetProject)) {
      toast.error("Only System Admin, Organization Admin, or assigned Team Leader have permission to change project stages.");
      return;
    }
    try {
      const res = await updateProjectStage(projectId, newStage);
      if (res && res.success) {
        toast.success(`Stage updated to ${newStage}`);
        await refreshProjects();
      } else {
        toast.error(res?.message || "Failed to update stage");
      }
    } catch (err: any) {
      toast.error("Error updating stage: " + err.message);
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
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          const pu = ((p as any).project_users || []).filter((u: any) => 
            String(u.user_id).toLowerCase() !== String(userId).toLowerCase()
          );
          return { ...p, project_users: pu };
        }
        return p;
      });
      const targetProj = updatedProjects.find(p => p.id === projectId);
      if (targetProj) updateProject({ ...targetProj });
      if (editingProj?.id === projectId && targetProj) setEditingProj({ ...targetProj } as any);
      toast.success("User removed from project successfully.");
      await refreshProjects();
    } else {
      toast.error(res.message || "Failed to remove user");
    }
  };

  const handleAddUserToProject = async (projectId: string, userId: string) => {
    if (!userId) return;
    const res = await api.addUserToProject(projectId, userId);
    if (res.success) {
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          const pu = [...((p as any).project_users || [])];
          if (!pu.some((u: any) => String(u.user_id).toLowerCase() === String(userId).toLowerCase())) {
            pu.push({ project_id: projectId, user_id: userId });
          }
          return { ...p, project_users: pu };
        }
        return p;
      });
      const targetProj = updatedProjects.find(p => p.id === projectId);
      if (targetProj) updateProject({ ...targetProj });
      if (editingProj?.id === projectId && targetProj) setEditingProj({ ...targetProj } as any);
      toast.success("User added to project successfully!");
      await refreshProjects();
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
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          const pt = ((p as any).project_teams || []).filter((t: any) => String(t.team_id) !== String(teamId));
          return { ...p, project_teams: pt };
        }
        return p;
      });
      const targetProj = updatedProjects.find(p => p.id === projectId);
      if (targetProj) updateProject({ ...targetProj });
      if (editingProj?.id === projectId && targetProj) setEditingProj({ ...targetProj } as any);
      toast.success("Team removed from project successfully.");
      await refreshProjects();
    } else {
      toast.error(res.message || "Failed to remove team");
    }
  };

  const handleAddTeamToProject = async (projectId: string, teamId: string) => {
    if (!teamId) return;
    const res = await api.addTeamToProject(projectId, teamId);
    if (res.success) {
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          const pt = [...((p as any).project_teams || [])];
          if (!pt.some((t: any) => String(t.team_id) === String(teamId))) {
            pt.push({ project_id: projectId, team_id: teamId });
          }
          return { ...p, project_teams: pt };
        }
        return p;
      });
      const targetProj = updatedProjects.find(p => p.id === projectId);
      if (targetProj) updateProject({ ...targetProj });
      if (editingProj?.id === projectId && targetProj) setEditingProj({ ...targetProj } as any);
      toast.success("Team added to project successfully!");
      await refreshProjects();
    } else {
      toast.error(res.message || "Failed to add team");
    }
  };


  return (
    <AppShell title="Projects" hideSubHeader={true}>
      <div className="flex flex-col h-full min-h-0 w-full bg-transparent overflow-hidden">
        
        {/* Sticky Control Header: Full width till left sidebar, matches teams.tsx executive command deck */}
        <div className="shrink-0 sticky top-0 z-20 bg-background/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-border/70 py-3 px-4 md:px-6 flex flex-col gap-3 select-none shadow-2xs">
          
          {/* Row 1: Executive Command Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shadow-2xs shrink-0">
                <FolderKanban className="size-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Projects</h1>
                  <span className="text-[11px] font-mono font-semibold bg-muted/80 text-foreground/80 border border-border/70 px-2 py-0.5 rounded-md shadow-2xs">
                    {projects.length} Workspaces
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground font-medium truncate">
                  Manage your MEP calculation scopes, workspace metrics, and project environments.
                </p>
              </div>
            </div>

            {/* Action Buttons: Unified Hierarchy (Neutral Secondary + Brand Primary) */}
            <div className="flex items-center gap-2 shrink-0">
              {activeProject && (
                <button
                  type="button"
                  onClick={() => handleOpenWorkspace(activeProject.id)}
                  className="h-8.5 px-3.5 rounded-xl border border-border/80 bg-surface-2/80 hover:bg-surface-3 hover:border-border text-foreground text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={`Continue active workspace: ${activeProject.name}`}
                >
                  <Play className="size-3 fill-primary text-primary" />
                  <span>Continue Active</span>
                </button>
              )}

              <button
                onClick={openCreateModal}
                className="h-8.5 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs hover:shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="size-3.5 stroke-[2.5]" />
                <span>New Workspace</span>
              </button>
            </div>
          </div>


          {/* Row 3: Filter & Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 bg-surface-2/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-border/60 shadow-2xs shrink-0">
              <button
                onClick={() => setFilterTab("ALL")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterTab === "ALL"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                <span>All Workspaces</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  filterTab === "ALL" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {projects.length}
                </span>
              </button>
              <button
                onClick={() => setFilterTab("ACTIVE_PINNED")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterTab === "ACTIVE_PINNED"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                <span>Active & Pinned</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  filterTab === "ACTIVE_PINNED" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {pinnedAndActiveCount}
                </span>
              </button>
              <button
                onClick={() => setFilterTab("MY_PROJECTS")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  filterTab === "MY_PROJECTS"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                <span>My Projects</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  filterTab === "MY_PROJECTS" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {myProjectsCount}
                </span>
              </button>
            </div>

            {/* Search and Sort controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/70 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search workspaces or clients..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full h-8.5 bg-surface-2/60 hover:bg-surface-2 focus:bg-card border border-border/70 focus:border-primary/80 focus:ring-1 focus:ring-primary/20 rounded-xl pl-8.5 pr-7 text-xs outline-none transition-all text-foreground placeholder:text-muted-foreground/60 shadow-2xs"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Sort selector */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="h-8.5 bg-surface-2/60 hover:bg-surface-2 border border-border/70 text-foreground font-semibold text-xs pl-3 pr-8 rounded-xl outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/20 cursor-pointer appearance-none shadow-2xs transition-all"
                >
                  <option value="RECENT">Recently Updated</option>
                  <option value="NAME_ASC">Name (A → Z)</option>
                  <option value="NAME_DESC">Name (Z → A)</option>
                  <option value="TYPE_ASC">Project Typology</option>
                  <option value="STAGE_ASC">Design Stage Progression</option>
                  <option value="SPACES_DESC">Most Spaces</option>
                </select>
                <ArrowUpDown className="absolute right-2.5 top-2.5 size-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Row 4: Project Typology (Type) Filter Bar */}
          <div className="flex flex-col gap-1.5 pt-0.5 select-none">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <SlidersHorizontal className="size-3 text-primary" /> Filter By Typology
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowTypologyStats(!showTypologyStats)}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] rounded-lg border transition cursor-pointer font-semibold ${
                    showTypologyStats
                      ? "bg-primary text-primary-foreground border-primary shadow-xs"
                      : "bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground border-border/70"
                  }`}
                  title="Toggle Typology Volume Bar Graph"
                >
                  <BarChart3 className="size-3" />
                  <span>{showTypologyStats ? "Hide Volume Graph" : "Typology Bar Graph"}</span>
                </button>
                {typeFilter !== 'ALL' && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter('ALL')}
                    className="text-[10.5px] text-primary hover:underline font-bold cursor-pointer"
                  >
                    Show All Typologies
                  </button>
                )}
              </div>
            </div>

            {showTypologyStats && (
              <div className="p-3 bg-surface-1/60 dark:bg-zinc-900/60 border border-border/70 rounded-2xl flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between text-xs pb-1 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">Typology Volume Comparison</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      (Shows which types have more projects and which have less)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10.5px]">
                    <span className="text-[#3474c4] font-bold">
                      ⭐ More: {typologyStats.highest.type} ({typologyStats.highest.count})
                    </span>
                    <span className="text-muted-foreground">|</span>
                    <span className="text-muted-foreground">
                      {typologyStats.zeroCount > 0 ? `${typologyStats.zeroCount} types with 0` : `Less: ${typologyStats.lowest.type}`}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                  {typologyStats.items.map((item) => {
                    const cfg = PROJECT_TYPE_CONFIG[item.type];
                    const IconComponent = cfg?.icon || Building2;
                    const isSelected = typeFilter === item.type;
                    const isMax = item.count === typologyStats.highest.count && item.count > 0;
                    return (
                      <div
                        key={item.type}
                        onClick={() => setTypeFilter(isSelected ? "ALL" : (item.type as any))}
                        className={`p-2 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                          isSelected
                            ? "bg-primary/10 border-primary"
                            : "bg-surface-2/60 hover:bg-surface-3/60 border-border/60"
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                            <IconComponent className="size-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{item.type}</span>
                          </span>
                          <span className="font-mono font-bold text-[#3474c4] shrink-0">
                            {item.count} <span className="text-[9.5px] text-muted-foreground">({item.pct}%)</span>
                          </span>
                        </div>
                        {/* Horizontal Blue Bar */}
                        <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300 bg-[#3474c4]"
                            style={{ width: `${Math.max(item.count > 0 ? 8 : 0, item.barPct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
              <button
                type="button"
                onClick={() => setTypeFilter("ALL")}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 border ${
                  typeFilter === "ALL"
                    ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                    : "bg-surface-2/70 hover:bg-surface-2 text-muted-foreground hover:text-foreground border-border/70 font-medium"
                }`}
              >
                <span>All Typologies</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  typeFilter === "ALL" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {projects.length}
                </span>
              </button>

              {PROJECT_TYPES.map((t) => {
                const cfg = PROJECT_TYPE_CONFIG[t];
                const IconComponent = cfg?.icon || Building2;
                const isSelected = typeFilter === t;
                const count = typeCounts[t] || 0;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                        : "bg-surface-2/70 hover:bg-surface-2 text-muted-foreground hover:text-foreground border-border/70 font-medium"
                    }`}
                  >
                    <IconComponent className={`size-3.5 ${isSelected ? "text-inherit" : "text-muted-foreground/70"}`} />
                    <span>{t}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Workspace Body: Dual-Pane with Scrollable Grid & Productivity Panel */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-background">
          
          {/* Left Side: Workspaces Grid */}
          <div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto custom-scrollbar">
            {filteredProjects.length === 0 ? (
              <div className="text-center py-16 bg-card/60 border border-dashed border-border/80 rounded-3xl p-8 max-w-md mx-auto my-8 flex flex-col items-center justify-center gap-3 shadow-2xs">
                <div className="p-3 bg-muted/40 text-muted-foreground rounded-2xl">
                  <FolderKanban className="size-7" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-foreground">No workspaces found</h3>
                  <p className="text-xs text-muted-foreground">
                    {search ? `No project matched "${search}". Try adjusting your keywords.` : "Create a new project workspace or select another tab."}
                  </p>
                </div>
                <button
                  onClick={openCreateModal}
                  className="mt-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  Create a Workspace
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 min-[1650px]:grid-cols-3 gap-4.5">
                {filteredProjects.map((p) => {
                  const isActive = p.id === activeProjectId;
                  const stats = statsMap[p.id] || { spaces: 0, zones: 0, equipment: 0 };
                  const isPinned = pinnedProjects.includes(p.id);
                  const creatorUser = allUsers.find(u => u.id === p.created_by);
                  const creatorName = creatorUser?.name || (p as any).creator_name || (p.created_by === profile?.id ? (profile?.name || "You") : "Admin");

                  // Deduplicate and resolve users
                  const seenUserIds = new Set<string>();
                  const projectUsers: { id: string; name: string; initials: string; raw: any }[] = [];
                  ((p as any).project_users || []).forEach((pu: any) => {
                    if (!pu) return;
                    const rawId = (typeof pu === 'object' && pu !== null) ? (pu.user_id || pu.id || pu.user?.id || pu.email || '') : pu;
                    const puId = String(rawId || (typeof pu === 'string' ? pu : '')).toLowerCase();
                    if (!puId || seenUserIds.has(puId)) return;
                    seenUserIds.add(puId);
                    const name = getUserDisplayName(pu, allUsers);
                    projectUsers.push({
                      id: rawId || puId,
                      name,
                      initials: getInitials(name),
                      raw: pu,
                    });
                  });

                  // Resolve teams
                  const projectTeams: { id: string; name: string; raw: any }[] = ((p as any).project_teams || []).map((pt: any) => {
                    const team = allTeams.find(t => String(t.id) === String(pt.team_id) || String(t.id) === String(pt.id));
                    return {
                      id: pt.team_id || pt.id,
                      name: team?.name || pt.teams?.name || pt.team_name || pt.name || 'Team',
                      raw: pt,
                    };
                  });

                  const totalCollaborators = projectUsers.length + projectTeams.length;
                  const isExpanded = expandedMembers.has(p.id);

                  return (
                    <div
                      key={p.id}
                      className={`bg-card/85 dark:bg-[#0c0d11]/90 backdrop-blur-md border rounded-2xl p-5 shadow-2xs hover:shadow-xl hover:shadow-primary/5 transition-all duration-200 flex flex-col justify-between group relative overflow-hidden h-full ${
                        isActive
                          ? "border-primary/80 ring-1 ring-primary/30 bg-primary/[0.02]"
                          : "border-border/75 hover:border-primary/40"
                      }`}
                    >
                      {/* Ambient top highlight line */}
                      <div className={`absolute top-0 inset-x-0 ${isActive ? 'h-[2.5px] bg-gradient-to-r from-primary via-sky-400 to-primary' : 'h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/70'} transition-all duration-300`} />

                      <div className="flex flex-col gap-3.5">
                        {/* Card Header: Squircle + Title/Meta + Pin & Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {/* Project Monogram Squircle */}
                            <div className="size-11 rounded-xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 border border-primary/25 text-primary flex items-center justify-center font-black font-mono text-[12.5px] tracking-wider shrink-0 shadow-2xs ring-1 ring-primary/10">
                              {(p.code || p.name.slice(0, 3) || "PR").toUpperCase().slice(0, 4)}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <h3 className="font-bold text-[15.5px] text-foreground tracking-tight truncate group-hover:text-primary transition-colors" title={p.name}>
                                {p.name}
                              </h3>
                              <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground truncate mt-0.5">
                                <Building2 className="size-3 text-muted-foreground/70 shrink-0" />
                                <span className="truncate font-medium text-foreground/80 max-w-[130px]" title={p.client || 'Internal'}>
                                  {p.client || 'Internal'}
                                </span>
                                {p.location && (
                                  <>
                                    <span className="text-muted-foreground/40">•</span>
                                    <MapPin className="size-3 text-muted-foreground/70 shrink-0" />
                                    <span className="truncate max-w-[110px]" title={p.location}>{p.location}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Top Right Badges: Pin Toggle & Status */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePin(p.id);
                              }}
                              className={`size-7.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                                isPinned
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-2xs'
                                  : 'text-muted-foreground/50 hover:text-foreground hover:bg-surface-2'
                              }`}
                              title={isPinned ? "Unpin workspace" : "Pin workspace"}
                            >
                              <Pin className={`size-3.5 ${isPinned ? 'fill-amber-400 text-amber-400' : ''}`} />
                            </button>

                            {isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-2xs">
                                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-medium text-muted-foreground/70 bg-surface-2/70 border border-border/60">
                                Ready
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Project Typology & Stage Badges */}
                        {(() => {
                          const pType = p.project_type || "Buildings / Apartment";
                          const typeCfg = PROJECT_TYPE_CONFIG[pType] || PROJECT_TYPE_CONFIG["Buildings / Apartment"];
                          const TypeIcon = typeCfg.icon || Building2;
                          const currentStg = p.current_stage || "Concept Design";
                          const stageCfg = STAGE_CONFIG[currentStg] || STAGE_CONFIG["Concept Design"];
                          const appStages = (p.applicable_stages && p.applicable_stages.length > 0) ? p.applicable_stages : PROJECT_STAGES;
                          const currentIdx = appStages.indexOf(currentStg as any);
                          const completedCount = currentStg === 'Completed'
                            ? appStages.length
                            : (currentIdx === -1 ? 1 : currentIdx);
                          const progressPct = Math.round((completedCount / appStages.length) * 100);

                          return (
                            <div className="flex flex-col gap-2 pt-1 pb-0.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                {/* Typology Badge */}
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold bg-surface-2/80 dark:bg-zinc-800/80 text-foreground/80 border border-border/70">
                                  <TypeIcon className="size-3.5 text-muted-foreground shrink-0" />
                                  <span>{pType}</span>
                                </span>

                                {/* Current Stage Badge + Action */}
                                <div className="flex items-center gap-1.5">
                                  {canEditProjectStages(profile, p) ? (
                                    <div className="relative group/stage">
                                      <select
                                        value={currentStg}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          handleQuickStageChange(p.id, e.target.value);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        title="Click to update stage (System Admin, Org Admin, or assigned Team Leader)"
                                        className="text-[10.5px] font-semibold px-2.5 py-1 rounded-lg border border-border/70 bg-surface-2/80 dark:bg-zinc-800/80 text-foreground/90 outline-none cursor-pointer hover:bg-surface-3/80 dark:hover:bg-zinc-700/80 appearance-none pr-5.5 transition-all shadow-2xs"
                                      >
                                        {appStages.map((stg) => (
                                          <option key={stg} value={stg} className="bg-background text-foreground font-medium">
                                            {stg} {stg === currentStg ? '• (Current)' : ''}
                                          </option>
                                        ))}
                                        <option value="Completed" className="bg-background text-foreground font-semibold">
                                          ✓ Completed (All Done)
                                        </option>
                                      </select>
                                      <ChevronDown className="size-3 absolute right-1.5 top-2 pointer-events-none text-muted-foreground" />
                                    </div>
                                  ) : (
                                    <span
                                      title="Design Stage (Managed by System Admin, Org Admin, or assigned Team Leader)"
                                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10.5px] font-semibold border border-border/70 bg-surface-2/80 dark:bg-zinc-800/80 text-foreground/90"
                                    >
                                      <span className="size-1.5 rounded-full bg-slate-400 dark:bg-zinc-500" />
                                      <span>{currentStg}</span>
                                      <Lock className="size-2.5 text-muted-foreground ml-0.5" />
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Stage Stepper Progress Strip */}
                              <div className="flex flex-col gap-1 pt-0.5">
                                <div className="flex items-center justify-between text-[9.5px] text-muted-foreground font-semibold">
                                  <span className="flex items-center gap-1">
                                    <Clock className="size-2.5 text-muted-foreground" />
                                    <span>Stage {Math.min(completedCount + (currentStg === 'Completed' ? 0 : 1), appStages.length)} of {appStages.length}</span>
                                  </span>
                                  <span className="font-mono font-bold text-foreground">{progressPct}%</span>
                                </div>
                                <div className="grid gap-1 items-center" style={{ gridTemplateColumns: `repeat(${appStages.length}, minmax(0, 1fr))` }}>
                                  {appStages.map((stg, sIdx) => {
                                    const isDone = currentStg === 'Completed' || sIdx < currentIdx;
                                    const isCurrent = currentStg !== 'Completed' && sIdx === currentIdx;
                                    return (
                                      <div
                                        key={stg}
                                        title={`${stg}: ${isDone ? 'Completed' : (isCurrent ? 'In Progress (Current)' : 'Upcoming / Remaining')}`}
                                        className={`h-1.5 rounded-full transition-all ${
                                          isDone || isCurrent
                                            ? 'bg-primary'
                                            : 'bg-slate-200/80 dark:bg-zinc-800'
                                        }`}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Description: Clean natural typography (no ugly box) */}
                        {p.description ? (
                          <p className="text-[12px] text-muted-foreground/90 leading-relaxed font-normal line-clamp-2 px-0.5">
                            {p.description}
                          </p>
                        ) : (
                          <p className="text-[11.5px] text-muted-foreground/40 italic line-clamp-1 px-0.5">
                            No workspace scope description provided.
                          </p>
                        )}

                        {/* 3-Cell Metric Widgets */}
                        <div className="grid grid-cols-3 gap-2 py-0.5 select-none">
                          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-2/40 dark:bg-zinc-900/60 border border-border/60 hover:border-border transition-all">
                            <div className="p-1.5 rounded-lg bg-surface-2 text-muted-foreground border border-border/60 shrink-0">
                              <Layers className="size-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-black font-mono text-foreground leading-tight tracking-tight">{stats.spaces}</span>
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/75">Spaces</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-2/40 dark:bg-zinc-900/60 border border-border/60 hover:border-border transition-all">
                            <div className="p-1.5 rounded-lg bg-surface-2 text-muted-foreground border border-border/60 shrink-0">
                              <Boxes className="size-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-black font-mono text-foreground leading-tight tracking-tight">{stats.zones}</span>
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/75">Zones</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-surface-2/40 dark:bg-zinc-900/60 border border-border/60 hover:border-border transition-all">
                            <div className="p-1.5 rounded-lg bg-surface-2 text-muted-foreground border border-border/60 shrink-0">
                              <Cpu className="size-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[13px] font-black font-mono text-foreground leading-tight tracking-tight">{stats.equipment}</span>
                              <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground/75">Equip</span>
                            </div>
                          </div>
                        </div>

                        {/* Collaborator Row: Avatar Stack + Team Badges */}
                        <div className="flex flex-col gap-2 pt-1 border-t border-border/40">
                          <div className="flex items-center justify-between gap-2 min-h-[28px]">
                            {totalCollaborators > 0 ? (
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                {projectUsers.length > 0 && (
                                  <div className="flex items-center -space-x-1.5 overflow-hidden py-0.5 shrink-0">
                                    {projectUsers.slice(0, 3).map((u, i) => (
                                      <div
                                        key={u.id || i}
                                        title={u.name}
                                        className="size-6.5 rounded-full bg-slate-200 dark:bg-zinc-800 border-2 border-background ring-1 ring-border/50 text-[9.5px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0 uppercase shadow-2xs"
                                      >
                                        {u.initials}
                                      </div>
                                    ))}
                                    {projectUsers.length > 3 && (
                                      <div
                                        title={`${projectUsers.length - 3} more users`}
                                        className="size-6.5 rounded-full bg-surface-2 border-2 border-background ring-1 ring-border/50 text-[9px] font-bold text-muted-foreground flex items-center justify-center shrink-0 shadow-2xs"
                                      >
                                        +{projectUsers.length - 3}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {projectTeams.slice(0, 2).map((t, idx) => (
                                  <span
                                    key={t.id || idx}
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md truncate max-w-[110px] shrink-0"
                                    title={t.name}
                                  >
                                    <Users className="size-2.5 shrink-0" />
                                    <span className="truncate">{t.name}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  loadUsersAndTeams();
                                  setEditingProj(p);
                                }}
                                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground/80 hover:text-foreground border border-dashed border-border/80 hover:border-primary/50 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                              >
                                <UserPlus className="size-3 text-muted-foreground" />
                                <span>Assign Personnel</span>
                              </button>
                            )}

                            {totalCollaborators > 0 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpandMembers(p.id);
                                }}
                                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 transition-colors cursor-pointer py-1 px-1.5 rounded-md hover:bg-surface-2 select-none"
                              >
                                <span>{isExpanded ? "Hide" : `${totalCollaborators} Assigned`}</span>
                                <ChevronDown className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </button>
                            )}
                          </div>

                          {/* Expanded Member Roster with removal controls */}
                          {isExpanded && totalCollaborators > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1 w-full animate-in fade-in duration-150 border-t border-border/30">
                              {projectTeams.map((pt) => (
                                <span key={`t-${pt.id}`} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md text-[10px] font-semibold border border-primary/20">
                                  <Users className="size-3" /> {pt.name}
                                  {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN' || p.created_by === profile?.id) && (
                                    <button onClick={() => handleRemoveTeamFromProject(p.id, pt.id)} className="hover:bg-primary/20 rounded-full p-0.5 cursor-pointer ml-1">
                                      <X className="size-2.5" />
                                    </button>
                                  )}
                                </span>
                              ))}

                              {projectUsers.map((pu) => (
                                <span key={`u-${pu.id}`} className="inline-flex items-center gap-1 bg-surface-2 text-foreground px-2 py-0.5 rounded-md text-[10px] font-semibold border border-border/70">
                                  <User className="size-3 text-muted-foreground" /> {pu.name}
                                  {(profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN' || p.created_by === profile?.id) && (
                                    <button onClick={() => handleRemoveUserFromProject(p.id, String(pu.id))} className="hover:bg-surface-3 rounded-full p-0.5 cursor-pointer ml-1">
                                      <X className="size-2.5" />
                                    </button>
                                  )}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground/75 font-medium pt-0.5">
                          <div className="flex items-center gap-1.5 truncate">
                            <div className="size-4.5 rounded-full bg-surface-2 border border-border/60 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0 uppercase">
                              {creatorName.slice(0, 1)}
                            </div>
                            <span className="truncate">
                              By <strong className="text-foreground/85 font-semibold">{creatorName}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-[10.5px] shrink-0 text-muted-foreground/60">
                            <Clock className="size-3" />
                            <span>{formatRelativeTime((p as any).updated_at || (p as any).last_modified || p.lastModified || (p as any).created_at || p.createdDate)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Primary Action + Utility Toolbar */}
                      <div className="border-t border-border/60 pt-3.5 mt-3 flex items-center justify-between gap-2.5">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => handleOpenWorkspace(p.id)}
                            className="flex-1 h-9 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-primary/20 active:scale-[0.99] group/btn"
                            title="Open Workspace"
                          >
                            <Play className="size-3 fill-current" />
                            <span>Open Workspace</span>
                            <ArrowRight className="size-3.5 opacity-60 group-hover/btn:translate-x-0.5 group-hover/btn:opacity-100 transition-all" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenWorkspace(p.id)}
                            className="flex-1 h-9 px-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs group/btn"
                            title="Workspace is currently active - click to continue"
                          >
                            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Active Session</span>
                            <ArrowRight className="size-3.5 opacity-70 group-hover/btn:translate-x-0.5 transition-transform" />
                          </button>
                        )}

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => duplicateProject(p.id)}
                            className="size-8.5 rounded-xl border border-border/70 bg-surface-2/60 hover:bg-surface-2 text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Duplicate Workspace"
                          >
                            <Copy className="size-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              loadUsersAndTeams();
                              setEditingProj(p);
                            }}
                            className="size-8.5 rounded-xl border border-border/70 bg-surface-2/60 hover:bg-surface-2 text-muted-foreground hover:text-foreground hover:border-primary/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Manage Members & Edit Scope"
                          >
                            <UserPlus className="size-3.5" />
                          </button>

                          {(p.created_by === profile?.id || profile?.role === 'SUPER_ADMIN') && (
                            <button
                              onClick={() => setDeleteConfirmId(p.id)}
                              className="size-8.5 rounded-xl border border-border/70 bg-surface-2/60 text-muted-foreground/60 hover:text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/40 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                              title="Delete Workspace"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Side: Productivity Companion Panel */}
          <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-border/70 bg-card/30 dark:bg-zinc-950/40 backdrop-blur-md p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar select-none">
            


            {/* Recently Opened */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recently Opened</h3>
              <div className="flex flex-col gap-2">
                {[...projects].sort((a,b) => (workspaceHistory[b.id] || new Date((b as any).updated_at || (b as any).created_at || 0).getTime()) - (workspaceHistory[a.id] || new Date((a as any).updated_at || (a as any).created_at || 0).getTime())).slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleOpenWorkspace(p.id)}
                    className="flex items-center justify-between p-2.5 bg-card/70 border border-border/70 rounded-xl hover:bg-surface-2 hover:border-primary/40 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="size-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</span>
                        <span className="text-[9.5px] text-muted-foreground font-mono">{p.code}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Workspace Activity</h3>
              <div className="flex flex-col gap-2.5">
                {globalActivity.length > 0 ? globalActivity.slice(0, 4).map(act => (
                  <div key={act.id} className="flex gap-2 text-xs leading-relaxed">
                    <div className={`size-1.5 rounded-full ${act.color || 'bg-primary'} mt-1.5 shrink-0`} />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground text-[11.5px]">{act.action}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {act.detail} · {Math.max(1, Math.floor((Date.now() - act.time) / 60000))}m ago
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="flex gap-2 text-xs leading-relaxed">
                    <div className="size-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium text-muted-foreground text-[11.5px]">No recent activity</span>
                      <span className="text-[10px] text-muted-foreground/70">Open a calculator to record activity</span>
                    </div>
                  </div>
                )}
              </div>
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

                {/* Project Typology / Category Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">
                    Project Typology (Category) *
                  </label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <Building2 className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                    <select
                      value={newProject.project_type}
                      onChange={(e) => setNewProject({ ...newProject, project_type: e.target.value as any })}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans outline-none focus:outline-none transition-all cursor-pointer"
                    >
                      {PROJECT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Applicable Project Stages Selection */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans flex items-center gap-1.5">
                      <SlidersHorizontal className="size-3 text-primary" /> Applicable Project Stages
                    </label>
                    <button
                      type="button"
                      onClick={() => setNewProject({ ...newProject, applicable_stages: [...PROJECT_STAGES] })}
                      className="text-[10px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Select the stages that apply to this project (projects can work on all or selected stages):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {PROJECT_STAGES.map((stage) => {
                      const isChecked = newProject.applicable_stages.includes(stage);
                      return (
                        <label
                          key={stage}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-primary/10 border-primary/40 text-foreground font-semibold shadow-2xs'
                              : 'bg-surface-2/40 border-border/60 text-muted-foreground hover:bg-surface-2'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const current = newProject.applicable_stages;
                              const next = e.target.checked
                                ? [...current, stage]
                                : current.filter((s) => s !== stage);
                              const validCurrent = next.includes(newProject.current_stage)
                                ? newProject.current_stage
                                : (next[0] || stage);
                              setNewProject({
                                ...newProject,
                                applicable_stages: next,
                                current_stage: validCurrent as any
                              });
                            }}
                            className="rounded text-primary focus:ring-primary size-3.5"
                          />
                          <span className="text-[11.5px] truncate">{stage}</span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="flex flex-col gap-1.5 mt-2">
                    <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">
                      Initial Current Stage
                    </label>
                    <select
                      value={newProject.current_stage}
                      onChange={(e) => setNewProject({ ...newProject, current_stage: e.target.value as any })}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl px-4 py-2.5 text-[12px] text-foreground font-sans outline-none cursor-pointer"
                    >
                      {(newProject.applicable_stages.length > 0 ? newProject.applicable_stages : PROJECT_STAGES).map((stg) => (
                        <option key={stg} value={stg}>{stg} (In Progress)</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none font-sans">Design Code & Notes</label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <HelpCircle className="absolute left-3.5 top-3.5 size-4.5 text-muted-foreground/80 pointer-events-none" />
                    <textarea
                      rows={3}
                      value={newProject.notes}
                      onChange={(e) => setNewProject({ ...newProject, notes: e.target.value })}
                      placeholder="e.g. ASHRAE 62.1 Standard, Title 24..."
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-11 pr-4 py-3 text-[12.5px] text-foreground font-sans resize-none outline-none focus:outline-none transition-all"
                    />
                  </div>
                </div>

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
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden animate-scale-in text-xs">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
              <h3 className="font-bold text-[16px] text-foreground tracking-tight">Edit Project Details</h3>
              <button onClick={() => setEditingProj(null)} className="size-8.5 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all duration-150">
                <X className="size-4.5" />
              </button>
            </header>
            <div className="p-6 flex flex-col gap-5 font-sans">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <div className="sm:col-span-2">
                  <label className="block text-slate-500 dark:text-zinc-400 font-extrabold text-[9px] uppercase tracking-widest mb-1.5 select-none font-sans">
                    Project Typology (Category)
                  </label>
                  <select
                    value={editingProj.project_type || "Buildings / Apartment"}
                    onChange={(e) => setEditingProj({ ...editingProj, project_type: e.target.value as any })}
                    className="w-full bg-background border border-border/70 rounded-2xl px-3.5 py-2.5 outline-none focus:ring-1 focus:ring-primary focus:border-primary text-[12px] text-foreground font-sans transition-all duration-150 cursor-pointer"
                  >
                    {PROJECT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SECTION: PROJECT DESIGN STAGES */}
              <div className="flex flex-col gap-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground font-extrabold text-[9.5px] uppercase tracking-widest select-none font-sans flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5 text-primary" /> Project Stages & Progression
                  </label>
                  {canEditProjectStages(profile, editingProj) ? (
                    <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                      <Unlock className="size-3" /> System Admin / Org Admin / Assigned Team Leader Access
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                      <Lock className="size-3" /> Read-Only (Assigned Team Leader / Org Admin only)
                    </span>
                  )}
                </div>

                {canEditProjectStages(profile, editingProj) ? (
                  <div className="flex flex-col gap-3 bg-surface-2/30 p-3.5 rounded-2xl border border-border/60">
                    <div>
                      <span className="text-[11px] font-semibold text-foreground block mb-1.5">
                        Active Project Stages (Toggle stages relevant to this project):
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {PROJECT_STAGES.map((stage) => {
                          const appStages = (editingProj.applicable_stages && editingProj.applicable_stages.length > 0)
                            ? editingProj.applicable_stages
                            : PROJECT_STAGES;
                          const isChecked = appStages.includes(stage);
                          return (
                            <label
                              key={stage}
                              className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-primary/10 border-primary/40 text-foreground font-semibold'
                                  : 'bg-surface-2/40 border-border/60 text-muted-foreground hover:bg-surface-2'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...appStages, stage]
                                    : appStages.filter((s) => s !== stage);
                                  const validCurrent = next.includes(editingProj.current_stage || '')
                                    ? editingProj.current_stage
                                    : (next[0] || stage);
                                  setEditingProj({
                                    ...editingProj,
                                    applicable_stages: next,
                                    current_stage: validCurrent
                                  });
                                }}
                                className="rounded text-primary focus:ring-primary size-3.5"
                              />
                              <span className="truncate">{stage}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-foreground mb-1">
                        Current Stage (In Progress):
                      </label>
                      <select
                        value={editingProj.current_stage || "Concept Design"}
                        onChange={(e) => setEditingProj({ ...editingProj, current_stage: e.target.value as any })}
                        className="w-full bg-background border border-border/70 rounded-xl px-3 py-2 text-[12px] text-foreground font-sans outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                      >
                        {((editingProj.applicable_stages && editingProj.applicable_stages.length > 0)
                          ? editingProj.applicable_stages
                          : PROJECT_STAGES).map((stg) => (
                          <option key={stg} value={stg}>
                            {stg} (In Progress)
                          </option>
                        ))}
                        <option value="Completed">✓ Completed (All Stages Finished)</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-2xl bg-surface-2/50 border border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Lock className="size-4 text-muted-foreground/70" />
                      <span>Current Stage: <strong className="text-foreground">{editingProj.current_stage || "Concept Design"}</strong></span>
                    </div>
                    <span className="text-[10.5px] italic">Only System Admin and Team Leader can update project stages.</span>
                  </div>
                )}
              </div>

              {/* 2 SECTIONS CARD SELECTION IN EDIT WORKSPACE DETAILS (ORG ADMIN ONLY) */}
              {isAdmin ? (
                <>
                  {/* SECTION 1: TEAMS CARDS */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground font-extrabold text-[9.5px] uppercase tracking-widest select-none font-sans flex items-center gap-1.5">
                        <Users className="size-3.5 text-primary" /> Assign Teams
                      </label>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        {((editingProj as any).project_teams || []).length} assigned
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-32 overflow-y-auto p-1 custom-scrollbar">
                      {allTeams.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic col-span-full">No teams created yet.</p>
                      ) : (
                        allTeams.map(t => {
                          const isAssigned = (editingProj as any).project_teams?.some((pt: any) => String(pt.team_id || pt.id) === String(t.id));
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                if (isAssigned) {
                                  handleRemoveTeamFromProject(editingProj.id, t.id);
                                } else {
                                  handleAddTeamToProject(editingProj.id, t.id);
                                }
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer border ${
                                isAssigned 
                                  ? 'bg-primary/15 border-primary text-primary shadow-xs' 
                                  : 'bg-slate-100 dark:bg-zinc-900 border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/50'
                              }`}
                            >
                              {isAssigned ? <Check className="size-3.5 stroke-[3] shrink-0" /> : <Plus className="size-3.5 shrink-0" />}
                              <span className="truncate">{t.name}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* SECTION 2: ENGINEERS & USERS CARDS */}
                  <div className="flex flex-col gap-2 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground font-extrabold text-[9.5px] uppercase tracking-widest select-none font-sans flex items-center gap-1.5">
                        <User className="size-3.5 text-emerald-500" /> Assign Engineers & Users
                      </label>
                      <button
                        type="button"
                        onClick={async () => {
                          for (const u of assignableUsers) {
                            if (!(editingProj as any).project_users?.some((pu: any) => String(pu.user_id || pu.id).toLowerCase() === String(u.id).toLowerCase() || String(pu.user_id).toLowerCase() === String(u.email).toLowerCase())) {
                              await api.addUserToProject(editingProj.id, u.id);
                            }
                          }
                          await refreshProjects();
                          const updated = projects.find(p => p.id === editingProj.id);
                          if (updated) setEditingProj({...updated} as any);
                          toast.success("All team members assigned!");
                        }}
                        className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                      >
                        + Add All Members
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto p-1 custom-scrollbar">
                      {assignableUsers.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground italic col-span-full">No other engineers found.</p>
                      ) : (
                        assignableUsers.map(u => {
                          const isAssigned = (editingProj as any).project_users?.some(
                            (pu: any) => String(pu.user_id || pu.id).toLowerCase() === String(u.id).toLowerCase() || String(pu.user_id).toLowerCase() === String(u.email).toLowerCase()
                          );
                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                if (isAssigned) {
                                  handleRemoveUserFromProject(editingProj.id, u.id);
                                } else {
                                  handleAddUserToProject(editingProj.id, u.id);
                                }
                              }}
                              className={`inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-[11.5px] font-semibold transition-all cursor-pointer border min-w-0 ${
                                isAssigned 
                                  ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 shadow-xs' 
                                  : 'bg-slate-100 dark:bg-zinc-900 border-border/80 text-muted-foreground hover:text-foreground hover:border-emerald-500/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 truncate">
                                {isAssigned ? <Check className="size-3.5 stroke-[3] shrink-0 text-emerald-500" /> : <Plus className="size-3.5 shrink-0 opacity-60" />}
                                <span className="truncate">{u.name}</span>
                              </div>
                              <span className="text-[9.5px] opacity-60 font-normal truncate max-w-[120px]">({u.email ? u.email.split('@')[0] : u.role})</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[10.5px] text-muted-foreground">
                      {((editingProj as any).project_users || []).length} of {assignableUsers.length} engineer(s) assigned
                    </p>
                  </div>
                </>
              ) : (
                <div className="pt-3 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground italic">
                    Note: Only Organization Admins have permission to add or assign members to projects.
                  </p>
                </div>
              )}
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

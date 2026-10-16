import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import {
  Users, Plus, Shield, ShieldAlert, Mail, Trash2, Check, User, Search,
  UserPlus, UserCheck, Sparkles, Layers, ArrowUpDown, X, AlertTriangle,
  Building2, ChevronDown, CheckCircle2, UserMinus, Filter, Info, Briefcase, ArrowRight
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { toast } from "sonner";

export const Route = createFileRoute("/teams")({
  head: () => ({
    meta: [
      { title: "Teams — MEP Calc" },
      { name: "description", content: "Manage organizational teams, team allocations, and engineering personnel." },
    ],
  }),
  component: TeamsPage,
});

// Unified executive blue theme for team monograms (White and signature blue palette)
const TEAM_THEME = {
  bg: "bg-primary/10 text-primary border-primary/25",
  ring: "ring-primary/20",
};

const getTeamTheme = (_name?: string, _id?: string) => TEAM_THEME;

const getTeamDiscipline = (teamName: string): string => {
  const n = (teamName || "").toLowerCase();
  if (n.includes("hvac") || n.includes("vent") || n.includes("air") || n.includes("thermal")) return "HVAC & Mechanical";
  if (n.includes("elec") || n.includes("power") || n.includes("light") || n.includes("cable")) return "Electrical Systems";
  if (n.includes("plumb") || n.includes("drain") || n.includes("water") || n.includes("pipe") || n.includes("phe")) return "Plumbing & Drainage";
  if (n.includes("fire") || n.includes("sprinkler")) return "Fire Protection";
  if (n.includes("bim") || n.includes("revit") || n.includes("cad")) return "BIM & Modeling";
  if (n.includes("alpha") || n.includes("sigma") || n.includes("delta") || n.includes("beta")) return "Multi-Disciplinary Core";
  return "Engineering Discipline";
};

const formatRole = (role?: string): string => {
  if (!role) return "Engineer";
  const r = role.trim();
  const upper = r.toUpperCase();
  if (upper === "ORG_ADMIN") return "Org Admin";
  if (upper === "SUPER_ADMIN") return "Super Admin";
  if (upper === "SR_DESIGN_ENGINEER" || upper === "SR. DESIGN ENGINEER") return "Sr. Design Engineer";
  if (upper === "JR_DESIGN_ENGINEER" || upper === "JR. DESIGN ENGINEER") return "Jr. Design Engineer";
  if (upper === "BIM_COORDINATOR") return "BIM Coordinator";
  if (upper === "BIM_MODELER") return "BIM Modeler";
  if (upper === "TEAM_LEADER") return "Team Leader";
  if (upper === "PROJECT_MANAGER") return "Project Manager";
  if (r.includes("_") || r === upper) {
    return r
      .split(/[_\s]+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return r;
};

const getRoleBadgeStyle = (role?: string) => {
  const r = (role || "").toUpperCase();
  if (r.includes("SUPER_ADMIN") || r.includes("ADMIN") || r.includes("ORG_ADMIN")) {
    return "bg-primary/15 text-primary border-primary/30 font-semibold";
  }
  if (r.includes("LEADER") || r.includes("COORDINATOR") || r.includes("LEAD") || r.includes("DIRECTOR") || r.includes("SR") || r.includes("SENIOR") || r.includes("PRINCIPAL")) {
    return "bg-primary/10 text-primary border-primary/20 font-semibold";
  }
  return "bg-surface-2/80 text-foreground/75 border-border/70";
};

type FilterTab = "ALL" | "ACTIVE" | "EMPTY" | "MY_TEAMS";
type SortOption = "MEMBERS_DESC" | "MEMBERS_ASC" | "NAME_ASC" | "NAME_DESC";

function TeamsPage() {
  const { profile, userData } = useAuth();
  const currentRole = userData?.role || profile?.role || "";
  const currentUserId = userData?.id || profile?.id || "";
  const currentUserEmail = (userData?.email || profile?.email || "").toLowerCase();
  const isAdmin = ["SUPER_ADMIN", "ORG_ADMIN"].includes(currentRole);

  const [teams, setTeams] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("MEMBERS_DESC");

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [createInitialUserIds, setCreateInitialUserIds] = useState<string[]>([]);
  const [createSearch, setCreateSearch] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTargetTeamId, setAssignTargetTeamId] = useState("");
  const [assignSelectedUserIds, setAssignSelectedUserIds] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Roster modal state
  const [viewRosterTeam, setViewRosterTeam] = useState<any | null>(null);
  const [rosterSearch, setRosterSearch] = useState("");

  // Confirmation dialogs state
  const [deleteConfirmTeam, setDeleteConfirmTeam] = useState<{ id: string; name: string } | null>(null);
  const [removeConfirmMember, setRemoveConfirmMember] = useState<{ teamId: string; teamName: string; userId: string; userName: string } | null>(null);

  // Expanded member list for cards
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());

  const toggleExpandTeam = (teamId: string) => {
    setExpandedTeamIds(prev => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else next.add(teamId);
      return next;
    });
  };

  // Assignable users filter according to role/organization
  const assignableUsers = useMemo(() => {
    if (currentRole === "SUPER_ADMIN") {
      return users;
    }
    const myOrgId = profile?.organization_id || userData?.organization_id;
    return users.filter(u =>
      u.role !== "SUPER_ADMIN" &&
      (myOrgId ? u.organization_id === myOrgId : false)
    );
  }, [users, currentRole, profile?.organization_id, userData?.organization_id]);

  // Assignable teams filter according to role/organization
  const assignableTeams = useMemo(() => {
    if (currentRole === "SUPER_ADMIN") {
      return teams;
    }
    const myOrgId = profile?.organization_id || userData?.organization_id;
    return teams.filter(t => (myOrgId ? t.organization_id === myOrgId : false));
  }, [teams, currentRole, profile?.organization_id, userData?.organization_id]);

  // Quick Metrics Stats
  const metrics = useMemo(() => {
    const totalTeams = assignableTeams.length;
    const activeTeams = assignableTeams.filter(t => Array.isArray(t.team_members) && t.team_members.length > 0).length;
    const emptyTeams = totalTeams - activeTeams;

    // Distinct assigned users across all teams
    const assignedUserSet = new Set<string>();
    assignableTeams.forEach(t => {
      (t.team_members || []).forEach((m: any) => {
        const uid = m.user_id || m.id;
        if (uid) assignedUserSet.add(String(uid).toLowerCase());
      });
    });

    const totalEngineers = assignableUsers.length;
    return {
      totalTeams,
      activeTeams,
      emptyTeams,
      assignedEngineers: assignedUserSet.size,
      totalEngineers,
    };
  }, [assignableTeams, assignableUsers]);

  // Available users to assign for the selected assign target team
  const availableUsersForAssign = useMemo(() => {
    let baseList = assignableUsers;
    if (assignTargetTeamId) {
      const targetTeam = teams.find(t => t.id === assignTargetTeamId);
      if (targetTeam && Array.isArray(targetTeam.team_members)) {
        const existingMemberIds = new Set(
          targetTeam.team_members.map((tm: any) => String(tm.user_id || tm.id || "").toLowerCase())
        );
        baseList = baseList.filter(u => !existingMemberIds.has(String(u.id).toLowerCase()));
      }
    }
    if (assignSearch.trim()) {
      const q = assignSearch.toLowerCase().trim();
      baseList = baseList.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    }
    return baseList;
  }, [assignableUsers, assignTargetTeamId, teams, assignSearch]);

  // Filtered available users for Create Modal initial member selection
  const availableUsersForCreate = useMemo(() => {
    let list = assignableUsers;
    if (createSearch.trim()) {
      const q = createSearch.toLowerCase().trim();
      list = list.filter(u =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [assignableUsers, createSearch]);

  // Filtered & Sorted teams list
  const filteredTeams = useMemo(() => {
    let result = [...assignableTeams];

    // Filter by Tab
    if (activeTab === "ACTIVE") {
      result = result.filter(t => (t.team_members || []).length > 0);
    } else if (activeTab === "EMPTY") {
      result = result.filter(t => !t.team_members || t.team_members.length === 0);
    } else if (activeTab === "MY_TEAMS") {
      result = result.filter(t => {
        return (t.team_members || []).some((m: any) => {
          const mId = String(m.user_id || m.id || "").toLowerCase();
          return mId === String(currentUserId).toLowerCase() || (currentUserEmail && mId === currentUserEmail);
        });
      });
    }

    // Filter by Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(team => {
        const matchTeamName = team.name?.toLowerCase().includes(q);
        if (matchTeamName) return true;

        // Check if any member inside this team matches
        const matchMember = (team.team_members || []).some((tm: any) => {
          const rawId = tm.user_id || tm.id;
          const u = users.find(u => String(u.id).toLowerCase() === String(rawId).toLowerCase() || String(u.email).toLowerCase() === String(rawId).toLowerCase());
          return (
            u?.name?.toLowerCase().includes(q) ||
            u?.email?.toLowerCase().includes(q) ||
            u?.role?.toLowerCase().includes(q) ||
            String(rawId).toLowerCase().includes(q)
          );
        });
        return matchMember;
      });
    }

    // Sort
    result.sort((a, b) => {
      const countA = (a.team_members || []).length;
      const countB = (b.team_members || []).length;
      if (sortBy === "MEMBERS_DESC") return countB - countA;
      if (sortBy === "MEMBERS_ASC") return countA - countB;
      if (sortBy === "NAME_ASC") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "NAME_DESC") return (b.name || "").localeCompare(a.name || "");
      return 0;
    });

    return result;
  }, [assignableTeams, activeTab, searchQuery, sortBy, users, currentUserId, currentUserEmail]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [u, t] = await Promise.all([
        api.getUsers(),
        api.getTeams()
      ]);
      setUsers(u || []);
      setTeams(t || []);
    } catch (err) {
      console.error("Failed to load teams data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.id, userData?.id]);

  // Handle Team Creation (with optional initial members)
  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      toast.error("Please enter a team name.");
      return;
    }

    setIsCreating(true);
    try {
      const res = await api.createTeam(newTeamName.trim());
      if (res && res.success) {
        const createdTeamId = res.team?.id;
        // If initial members were picked, add them now
        if (createdTeamId && createInitialUserIds.length > 0) {
          for (const uid of createInitialUserIds) {
            try {
              await api.addUserToTeam(createdTeamId, uid);
            } catch (err) { }
          }
        }

        toast.success(`Team "${newTeamName.trim()}" created successfully!`);
        setNewTeamName("");
        setCreateInitialUserIds([]);
        setCreateSearch("");
        setIsCreateModalOpen(false);
        await loadData();
      } else {
        toast.error(res?.message || "Failed to create team.");
      }
    } catch (err: any) {
      toast.error(err?.message || "An error occurred while creating team.");
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Adding Members to Team
  const handleAssignMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignTargetTeamId) {
      toast.error("Please select a target team.");
      return;
    }
    if (assignSelectedUserIds.length === 0) {
      toast.error("Please select at least one member to assign.");
      return;
    }

    setIsAssigning(true);
    try {
      let addedCount = 0;
      for (const uid of assignSelectedUserIds) {
        const res = await api.addUserToTeam(assignTargetTeamId, uid);
        if (res && res.success !== false) addedCount++;
      }

      toast.success(`${addedCount} member(s) assigned successfully!`);
      setAssignSelectedUserIds([]);
      setAssignSearch("");
      setIsAssignModalOpen(false);
      await loadData();
    } catch (err: any) {
      toast.error(err?.message || "Failed to assign members.");
    } finally {
      setIsAssigning(false);
    }
  };

  // Open Assign Modal directly for a specific team
  const openAssignForTeam = (teamId: string) => {
    setAssignTargetTeamId(teamId);
    setAssignSelectedUserIds([]);
    setAssignSearch("");
    setIsAssignModalOpen(true);
  };

  // Handle Remove Member Confirmation
  const confirmRemoveUser = async () => {
    if (!removeConfirmMember) return;
    const { teamId, userId } = removeConfirmMember;
    setRemoveConfirmMember(null);

    try {
      const res = await api.removeUserFromTeam(teamId, userId);
      if (res && res.success) {
        toast.success("Member removed from team.");
        await loadData();
      } else {
        toast.error(res?.message || "Failed to remove member.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error removing member.");
    }
  };

  // Handle Delete Team Confirmation
  const confirmDeleteTeam = async () => {
    if (!deleteConfirmTeam) return;
    const { id } = deleteConfirmTeam;
    setDeleteConfirmTeam(null);

    try {
      const res = await api.deleteTeam(id);
      if (res && res.success) {
        toast.success("Team deleted successfully.");
        await loadData();
      } else {
        toast.error(res?.message || "Failed to delete team.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error deleting team.");
    }
  };

  return (
    <AppShell title="Teams" hideSubHeader={true}>
      <div className="flex flex-col h-full min-h-0 w-full bg-transparent overflow-hidden">
        {/* Sticky Control Header: Full width till left sidebar, industry-standard executive control center */}
        <div className="shrink-0 sticky top-0 z-20 bg-background/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-border/70 py-3 px-4 md:px-6 flex flex-col gap-3 select-none shadow-2xs">

          {/* Row 1: Executive Command Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shadow-2xs shrink-0">
                <Users className="size-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Teams</h1>
                  <span className="text-[11px] font-mono font-semibold bg-muted/80 text-foreground/80 border border-border/70 px-2 py-0.5 rounded-md shadow-2xs">
                    {assignableTeams.length} Teams
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground font-medium truncate">
                  Coordinate multidisciplinary engineering teams, allocate project personnel, and oversee organizational assignments.
                </p>
              </div>
            </div>

            {/* Action Buttons: Unified Hierarchy (Neutral Secondary + Brand Primary) */}
            <div className="flex items-center gap-2 shrink-0">
              {isAdmin && (
                <>
                  <button
                    onClick={() => {
                      setAssignTargetTeamId(assignableTeams[0]?.id || "");
                      setAssignSelectedUserIds([]);
                      setAssignSearch("");
                      setIsAssignModalOpen(true);
                    }}
                    disabled={assignableTeams.length === 0}
                    className="h-8.5 px-3.5 rounded-xl border border-border/80 bg-surface-2/80 hover:bg-surface-3 hover:border-border text-foreground text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Quickly assign personnel across teams"
                  >
                    <UserPlus className="size-3.5 text-muted-foreground" />
                    <span>Quick Assign</span>
                  </button>

                  <button
                    onClick={() => {
                      setNewTeamName("");
                      setCreateInitialUserIds([]);
                      setCreateSearch("");
                      setIsCreateModalOpen(true);
                    }}
                    className="h-8.5 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs hover:shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="size-3.5 stroke-[2.5]" />
                    <span>Create New Team</span>
                  </button>
                </>
              )}

              {!isAdmin && (
                <span className="text-[11px] font-semibold text-muted-foreground bg-muted/60 px-3 py-1.5 rounded-xl border border-border/60 flex items-center gap-1.5 shadow-2xs">
                  <Shield className="size-3.5 text-muted-foreground" /> View-Only Access
                </span>
              )}
            </div>
          </div>

          {/* Row 2: Unified Executive Telemetry Strip (Replaces fragmented floating cards) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 bg-card/60 dark:bg-zinc-900/60 backdrop-blur-md border border-border/70 rounded-2xl overflow-hidden shadow-2xs divide-y sm:divide-y-0 sm:divide-x divide-border/60">
            {/* KPI 1: Total Teams */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Teams</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black font-mono text-foreground tracking-tight leading-none">
                    {metrics.totalTeams}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium truncate">configured</span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/15 shrink-0">
                <Layers className="size-4" />
              </div>
            </div>

            {/* KPI 2: Active & Staffing Health */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Teams</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black font-mono text-foreground tracking-tight leading-none">
                    {metrics.activeTeams}
                  </span>
                  {metrics.emptyTeams > 0 ? (
                    <span className="text-[11px] font-medium text-muted-foreground">
                      ({metrics.emptyTeams} empty)
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-primary">
                      (100% active)
                    </span>
                  )}
                </div>
              </div>
              <div className="p-2 rounded-xl bg-muted/80 text-foreground/80 border border-border/70 shrink-0">
                <Sparkles className="size-4 text-primary" />
              </div>
            </div>

            {/* KPI 3: Engineer Allocation with Live Progress */}
            <div className="px-4 py-2.5 flex flex-col justify-center min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Allocation</span>
                <span className="text-[10px] font-mono font-bold text-foreground">
                  {metrics.totalEngineers > 0 ? `${Math.round((metrics.assignedEngineers / metrics.totalEngineers) * 100)}%` : "0%"}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-2 mt-0.5">
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-black font-mono text-foreground tracking-tight leading-none">
                    {metrics.assignedEngineers}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">/ {metrics.totalEngineers}</span>
                </div>
                <span className="text-[10.5px] text-muted-foreground font-medium truncate">engineers assigned</span>
              </div>
              {/* Sleek inline allocation bar */}
              <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden mt-1.5">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${metrics.totalEngineers > 0 ? Math.min(100, Math.round((metrics.assignedEngineers / metrics.totalEngineers) * 100)) : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* KPI 4: Total Org Pool */}
            <div className="px-4 py-2.5 flex items-center justify-between gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Org Engineers</span>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-xl font-black font-mono text-foreground tracking-tight leading-none">
                    {metrics.totalEngineers}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-medium truncate">total personnel</span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-muted/80 text-foreground/80 border border-border/70 shrink-0">
                <Users className="size-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Row 3: Filter & Search Toolbar (Integrated Command Strip) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-0.5">
            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 bg-surface-2/80 dark:bg-zinc-900/80 p-1 rounded-xl border border-border/60 shadow-2xs shrink-0">
              <button
                onClick={() => setActiveTab("ALL")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "ALL"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                <span>All Teams</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === "ALL" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {assignableTeams.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("ACTIVE")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "ACTIVE"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                <span>Active</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === "ACTIVE" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {metrics.activeTeams}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("EMPTY")}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "EMPTY"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                <span>Empty</span>
                {metrics.emptyTeams > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === "EMPTY" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  }`}>
                    {metrics.emptyTeams}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("MY_TEAMS")}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === "MY_TEAMS"
                    ? "bg-card text-foreground shadow-2xs border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-3/50"
                }`}
              >
                My Teams
              </button>
            </div>

            {/* Search and Sort controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/70 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search team or member..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-8.5 bg-surface-2/60 hover:bg-surface-2 focus:bg-card border border-border/70 focus:border-primary/80 focus:ring-1 focus:ring-primary/20 rounded-xl pl-8.5 pr-7 text-xs outline-none transition-all text-foreground placeholder:text-muted-foreground/60 shadow-2xs"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
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
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="h-8.5 bg-surface-2/60 hover:bg-surface-2 border border-border/70 text-foreground font-semibold text-xs pl-3 pr-8 rounded-xl outline-none focus:border-primary/80 focus:ring-1 focus:ring-primary/20 cursor-pointer appearance-none shadow-2xs transition-all"
                >
                  <option value="MEMBERS_DESC">Most Members</option>
                  <option value="MEMBERS_ASC">Fewest Members</option>
                  <option value="NAME_ASC">Name (A → Z)</option>
                  <option value="NAME_DESC">Name (Z → A)</option>
                </select>
                <ArrowUpDown className="absolute right-2.5 top-2.5 size-3 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Teams Grid */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 custom-scrollbar">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-muted-foreground text-sm gap-3">
              <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
              <p className="font-semibold text-xs tracking-wide">Loading organization teams...</p>
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="py-16 px-6 text-center bg-card border border-border/80 border-dashed rounded-3xl flex flex-col items-center justify-center gap-3">
              <div className="p-3 bg-muted/30 text-muted-foreground rounded-2xl">
                <Users className="size-7" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h3 className="font-bold text-foreground text-sm">
                  {searchQuery ? "No matching teams found" : "No teams available in this view"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {searchQuery
                    ? `No team or engineer matched "${searchQuery}". Try modifying your search criteria.`
                    : "Create a team or switch filter tabs to see organization teams."}
                </p>
              </div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold text-primary hover:underline mt-1 cursor-pointer"
                >
                  Clear search query
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 min-[1700px]:grid-cols-4 gap-4.5">
              {filteredTeams.map((team) => {
                const members = team.team_members || [];
                const memberCount = members.length;
                const theme = getTeamTheme(team.name, team.id);
                const isUserInTeam = members.some((m: any) => {
                  const mId = String(m.user_id || m.id || "").toLowerCase();
                  return mId === String(currentUserId).toLowerCase() || (currentUserEmail && mId === currentUserEmail);
                });
                const isExpanded = expandedTeamIds.has(team.id);
                const visibleMembers = isExpanded ? members : members.slice(0, 3);

                return (
                  <div
                    key={team.id}
                    className="bg-card/75 dark:bg-zinc-950/60 backdrop-blur-sm border border-border/75 hover:border-primary/40 rounded-2xl p-4.5 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col justify-between group relative overflow-hidden h-full"
                  >
                    {/* Ambient top highlight line */}
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary/20 to-transparent group-hover:via-primary/70 transition-all duration-300" />

                    <div className="flex flex-col gap-3.5">
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Monogram Squircle */}
                          <div className={`size-10 rounded-xl ${theme.bg} border flex items-center justify-center font-black text-sm shrink-0 shadow-2xs`}>
                            {(team.name || "T").charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-[15px] text-foreground tracking-tight truncate capitalize" title={team.name}>
                                {team.name}
                              </h3>
                              {isUserInTeam && (
                                <span className="size-2 rounded-full bg-primary shrink-0" title="You are in this team" />
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-medium truncate">
                              {getTeamDiscipline(team.name)}
                            </span>
                          </div>
                        </div>

                        {/* Top Right: Member Pill & Delete Action */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border bg-muted/70 text-foreground/80 border-border/70">
                            {memberCount} {memberCount === 1 ? "Member" : "Members"}
                          </span>

                          {isAdmin && (
                            <button
                              onClick={() => setDeleteConfirmTeam({ id: team.id, name: team.name })}
                              className="size-7 rounded-lg hover:bg-muted text-muted-foreground/40 hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
                              title="Delete Team"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Team Personnel Bar (Facepile + Add Action) */}
                      <div className="flex items-center justify-between py-2 border-y border-border/50">
                        <div className="flex items-center gap-2 min-w-0">
                          {memberCount > 0 ? (
                            <>
                              <div className="flex -space-x-1.5 overflow-hidden items-center py-0.5">
                                {members.slice(0, 5).map((tm: any, idx: number) => {
                                  const rawId = tm.user_id || tm.id;
                                  const u = users.find(u =>
                                    String(u.id).toLowerCase() === String(rawId).toLowerCase() ||
                                    String(u.email).toLowerCase() === String(rawId).toLowerCase()
                                  );
                                  const name = u?.name || rawId || "U";
                                  return (
                                    <div
                                      key={idx}
                                      title={`${name} (${formatRole(u?.designation || u?.role)})`}
                                      className="size-6.5 rounded-full ring-2 ring-card bg-surface-2 dark:bg-zinc-800 text-foreground text-[10px] font-bold flex items-center justify-center shadow-xs border border-border/60 shrink-0"
                                    >
                                      {name.charAt(0).toUpperCase()}
                                    </div>
                                  );
                                })}
                                {memberCount > 5 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewRosterTeam(team);
                                      setRosterSearch("");
                                    }}
                                    title={`View all ${memberCount} members`}
                                    className="size-6.5 rounded-full ring-2 ring-card bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-mono font-bold flex items-center justify-center border border-primary/20 shrink-0 cursor-pointer transition-all"
                                  >
                                    +{memberCount - 5}
                                  </button>
                                )}
                              </div>
                              <span className="text-[11px] font-medium text-muted-foreground truncate">
                                {memberCount} active personnel
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] font-medium text-muted-foreground/70 italic">
                              No personnel assigned
                            </span>
                          )}
                        </div>

                        {isAdmin && (
                          <button
                            onClick={() => openAssignForTeam(team.id)}
                            className="h-6.5 px-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border/60 text-[11px] font-semibold text-foreground/90 hover:text-primary transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="size-3 text-muted-foreground" />
                            <span>Add</span>
                          </button>
                        )}
                      </div>

                      {/* Members List Container */}
                      <div className="flex flex-col gap-2">
                        {memberCount === 0 ? (
                          <div className="py-6 px-4 rounded-xl border border-dashed border-border/70 bg-surface-2/20 flex flex-col items-center justify-center text-center gap-2">
                            <div className="size-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground/60 border border-border/40">
                              <UserPlus className="size-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-semibold text-foreground/80">No engineers assigned</span>
                              <span className="text-[11px] text-muted-foreground">Allocate personnel to activate this team</span>
                            </div>
                            {isAdmin && (
                              <button
                                onClick={() => openAssignForTeam(team.id)}
                                className="mt-1 h-7 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5"
                              >
                                <UserPlus className="size-3.5" />
                                <span>Assign Engineers</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className={`rounded-xl border border-border/60 bg-surface-2/30 dark:bg-zinc-900/30 divide-y divide-border/40 transition-all ${
                              isExpanded ? "max-h-52 overflow-y-auto custom-scrollbar" : "overflow-hidden"
                            }`}>
                              {visibleMembers.map((tm: any) => {
                                const rawId = tm.user_id || tm.id;
                                const user = users.find(u =>
                                  String(u.id).toLowerCase() === String(rawId).toLowerCase() ||
                                  String(u.email).toLowerCase() === String(rawId).toLowerCase()
                                );
                                const displayName = user?.name || rawId;
                                const rawRole = user?.designation || user?.role || "Engineer";
                                const displayRole = formatRole(rawRole);
                                const roleBadgeClass = getRoleBadgeStyle(rawRole);

                                return (
                                  <div
                                    key={rawId}
                                    className="flex items-center justify-between px-2.5 py-1.5 hover:bg-surface-2/80 transition-colors group/member"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <div className="size-6 rounded-full bg-muted text-foreground font-bold text-[10px] flex items-center justify-center shrink-0 border border-border/60">
                                        {displayName.charAt(0).toUpperCase()}
                                      </div>
                                      <span className="font-medium text-xs text-foreground truncate" title={displayName}>
                                        {displayName}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className={`text-[9.5px] font-medium px-2 py-0.5 rounded-md border ${roleBadgeClass}`}>
                                        {displayRole}
                                      </span>

                                      {isAdmin && (
                                        <button
                                          onClick={() => setRemoveConfirmMember({
                                            teamId: team.id,
                                            teamName: team.name,
                                            userId: rawId,
                                            userName: displayName
                                          })}
                                          className="size-5 rounded hover:bg-muted text-muted-foreground/40 hover:text-foreground flex items-center justify-center transition-all cursor-pointer opacity-0 group-hover/member:opacity-100"
                                          title="Remove from team"
                                        >
                                          <UserMinus className="size-3" />
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Expand / Collapse Button if > 3 members */}
                            {memberCount > 3 && (
                              <div className="flex items-center justify-between pt-0.5 px-0.5">
                                <button
                                  onClick={() => toggleExpandTeam(team.id)}
                                  className="py-1 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <span>{isExpanded ? "Show fewer members" : `+ View ${memberCount - 3} more`}</span>
                                  <ChevronDown className={`size-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                                </button>
                                <button
                                  onClick={() => {
                                    setViewRosterTeam(team);
                                    setRosterSearch("");
                                  }}
                                  className="py-1 text-[10.5px] font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                                  title="View all members in popup dialog"
                                >
                                  Full Roster ({memberCount})
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="border-t border-border/50 pt-3 mt-3 flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className={`size-2 rounded-full ${memberCount > 0 ? "bg-primary ring-2 ring-primary/20" : "bg-muted-foreground/40"}`} />
                        <span className="font-medium text-[11.5px] text-foreground/80">
                          {memberCount > 0 ? "Active Team" : "Unassigned"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setViewRosterTeam(team);
                            setRosterSearch("");
                          }}
                          className="font-semibold text-muted-foreground hover:text-foreground cursor-pointer text-[11.5px] transition-all px-1.5 py-0.5 rounded-md hover:bg-surface-2"
                          title="Open team roster"
                        >
                          Roster
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openAssignForTeam(team.id)}
                            className="font-semibold text-primary hover:text-primary/80 cursor-pointer flex items-center gap-1 text-[11.5px] group-hover:translate-x-0.5 transition-all"
                          >
                            <span>Manage Team</span>
                            <ArrowRight className="size-3" />
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
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: Create New Team Dialog                           */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scale-in text-xs font-sans">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <Users className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-foreground tracking-tight">Create New Team</h3>
                  <p className="text-[11px] text-muted-foreground">Setup an engineering discipline or project team.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="size-8 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <X className="size-4.5" />
              </button>
            </header>

            <form onSubmit={handleCreateTeam} className="flex-1 flex flex-col justify-between">
              <div className="p-6 flex flex-col gap-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Team Name Input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none">
                    Team Name *
                  </label>
                  <div className="relative focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary rounded-2xl transition-all">
                    <Building2 className="absolute left-3.5 top-3.5 size-4 text-muted-foreground/80 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. HVAC Alpha, Electrical Design, Firefighting..."
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl pl-10 pr-4 py-3 text-[12.5px] text-foreground outline-none transition-all"
                      autoFocus
                    />
                  </div>
                </div>

                {/* Optional Initial Members Selection */}
                <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none">
                      Initial Members (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCreateInitialUserIds(availableUsersForCreate.map(u => u.id))}
                        className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                      >
                        + Select All
                      </button>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <button
                        type="button"
                        onClick={() => setCreateInitialUserIds([])}
                        className="text-[10px] text-muted-foreground hover:underline font-medium cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Filter input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter engineers..."
                      value={createSearch}
                      onChange={(e) => setCreateSearch(e.target.value)}
                      className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl pl-8 pr-3 py-1.5 text-[11px] outline-none focus:border-primary text-foreground"
                    />
                  </div>

                  {/* Scrollable list */}
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-border/70 bg-background/50 p-1.5 space-y-1 custom-scrollbar">
                    {availableUsersForCreate.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground p-3 text-center italic">
                        No engineers found.
                      </p>
                    ) : (
                      availableUsersForCreate.map(u => {
                        const isSelected = createInitialUserIds.includes(u.id);
                        return (
                          <div
                            key={u.id}
                            onClick={() => {
                              setCreateInitialUserIds(prev =>
                                isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]
                              );
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11.5px] cursor-pointer transition-all ${
                              isSelected
                                ? "bg-primary/10 border border-primary/30 text-foreground font-semibold"
                                : "hover:bg-surface-2 text-muted-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                isSelected ? "bg-primary border-primary text-white" : "border-border/80 bg-background"
                              }`}>
                                {isSelected && <Check className="size-3 stroke-[3]" />}
                              </div>
                              <span className="truncate">{u.name}</span>
                              <span className="text-[10px] text-muted-foreground truncate">({u.email || u.role})</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <p className="text-[10.5px] text-muted-foreground">
                    {createInitialUserIds.length} engineer(s) will be added upon creation.
                  </p>
                </div>
              </div>

              <footer className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || !newTeamName.trim()}
                  className="bg-primary text-primary-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10 disabled:opacity-50"
                >
                  {isCreating ? "Creating Team..." : "Create Team"}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: Assign Members to Team Dialog                    */}
      {/* ========================================================= */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-scale-in text-xs font-sans">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 text-primary rounded-xl">
                  <UserPlus className="size-4.5" />
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-foreground tracking-tight">Assign Members to Team</h3>
                  <p className="text-[11px] text-muted-foreground">Add engineers to an existing organizational team.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="size-8 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all"
              >
                <X className="size-4.5" />
              </button>
            </header>

            <form onSubmit={handleAssignMembers} className="flex-1 flex flex-col justify-between">
              <div className="p-6 flex flex-col gap-4 max-h-[65vh] overflow-y-auto custom-scrollbar">
                {/* Target Team Dropdown */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none">
                    Target Team *
                  </label>
                  <select
                    value={assignTargetTeamId}
                    onChange={(e) => {
                      setAssignTargetTeamId(e.target.value);
                      setAssignSelectedUserIds([]);
                    }}
                    className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-2xl px-4 py-3 text-[12.5px] text-foreground outline-none focus:border-primary font-semibold cursor-pointer"
                  >
                    <option value="">Select Target Team...</option>
                    {assignableTeams.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({(t.team_members || []).length} current members)
                      </option>
                    ))}
                  </select>
                </div>

                {assignTargetTeamId && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground font-extrabold text-[9px] uppercase tracking-widest select-none">
                        Available Engineers
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setAssignSelectedUserIds(availableUsersForAssign.map(u => u.id))}
                          className="text-[10px] text-primary hover:underline font-bold cursor-pointer"
                        >
                          + Select All
                        </button>
                        <span className="text-muted-foreground text-[10px]">•</span>
                        <button
                          type="button"
                          onClick={() => setAssignSelectedUserIds([])}
                          className="text-[10px] text-muted-foreground hover:underline font-medium cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Search inside assign */}
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground/60 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Search by name, email, or role..."
                        value={assignSearch}
                        onChange={(e) => setAssignSearch(e.target.value)}
                        className="w-full bg-slate-50/50 dark:bg-zinc-950/20 border border-border/70 rounded-xl pl-8 pr-3 py-1.5 text-[11px] outline-none focus:border-primary text-foreground"
                      />
                    </div>

                    {/* Scrollable list */}
                    <div className="max-h-52 overflow-y-auto rounded-xl border border-border/70 bg-background/50 p-1.5 space-y-1.5 custom-scrollbar">
                      {availableUsersForAssign.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground p-4 text-center italic">
                          All available engineers are already assigned to this team.
                        </p>
                      ) : (
                        availableUsersForAssign.map(u => {
                          const isAssigned = assignSelectedUserIds.includes(u.id);
                          return (
                            <div
                              key={u.id}
                              onClick={() => {
                                setAssignSelectedUserIds(prev =>
                                  isAssigned ? prev.filter(id => id !== u.id) : [...prev, u.id]
                                );
                              }}
                              className={`flex items-center justify-between p-2 rounded-xl text-[11.5px] cursor-pointer transition-all ${
                                isAssigned
                                  ? "bg-primary/10 border border-primary/30 text-foreground font-semibold"
                                  : "hover:bg-surface-2 text-muted-foreground border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`size-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  isAssigned ? "bg-primary border-primary text-white" : "border-border/80 bg-background"
                                }`}>
                                  {isAssigned && <Check className="size-3 stroke-[3]" />}
                                </div>
                                <div className="size-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-foreground font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {u.name?.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[12px] text-foreground truncate">
                                      {u.name}
                                    </span>
                                    <span className="text-[9px] font-mono opacity-60">
                                      ({u.designation || u.role})
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {u.email}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <p className="text-[10.5px] text-muted-foreground">
                      {assignSelectedUserIds.length} engineer(s) selected to join team.
                    </p>
                  </div>
                )}
              </div>

              <footer className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!assignTargetTeamId || assignSelectedUserIds.length === 0 || isAssigning}
                  className="bg-primary text-primary-foreground font-bold text-xs px-6 py-2.5 rounded-2xl hover:bg-primary/95 transition-all cursor-pointer shadow-md shadow-primary/10 disabled:opacity-50"
                >
                  {isAssigning ? "Assigning Personnel..." : `Assign ${assignSelectedUserIds.length > 0 ? assignSelectedUserIds.length : ""} Engineer(s)`}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: Delete Team Confirmation Dialog                  */}
      {/* ========================================================= */}
      {deleteConfirmTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in text-xs">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-destructive/[0.03]">
              <h3 className="font-bold text-[16px] text-destructive tracking-tight">Delete Team?</h3>
              <button
                onClick={() => setDeleteConfirmTeam(null)}
                className="size-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive cursor-pointer transition-all"
              >
                <X className="size-4.5" />
              </button>
            </header>
            <div className="p-6 flex gap-4 text-[12px] leading-relaxed">
              <div className="size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <AlertTriangle className="size-5.5" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-bold text-foreground text-[13px]">
                  Are you sure you want to delete team "{deleteConfirmTeam.name}"?
                </p>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  This action will permanently disband the team and remove its project affiliations. Assigned engineers will remain in the organization. This cannot be undone.
                </p>
              </div>
            </div>
            <footer className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs">
              <button
                onClick={() => setDeleteConfirmTeam(null)}
                className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTeam}
                className="bg-destructive text-destructive-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-destructive/95 transition-all cursor-pointer shadow-md shadow-destructive/15"
              >
                Confirm Delete
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: Remove Member Confirmation Dialog                */}
      {/* ========================================================= */}
      {removeConfirmMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans">
          <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-scale-in text-xs">
            <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between bg-destructive/[0.03]">
              <h3 className="font-bold text-[16px] text-destructive tracking-tight">Remove Engineer?</h3>
              <button
                onClick={() => setRemoveConfirmMember(null)}
                className="size-8 rounded-full hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive cursor-pointer transition-all"
              >
                <X className="size-4.5" />
              </button>
            </header>
            <div className="p-6 flex gap-4 text-[12px] leading-relaxed">
              <div className="size-11 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
                <UserMinus className="size-5.5" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="font-bold text-foreground text-[13px]">
                  Remove {removeConfirmMember.userName} from team "{removeConfirmMember.teamName}"?
                </p>
                <p className="text-muted-foreground text-[11.5px] leading-relaxed">
                  The engineer will no longer have access to workspaces assigned strictly through this team. They can be re-assigned at any time.
                </p>
              </div>
            </div>
            <footer className="px-6 py-4 border-t border-border/50 flex items-center justify-end gap-3 bg-card/60 backdrop-blur-xs">
              <button
                onClick={() => setRemoveConfirmMember(null)}
                className="border border-border/80 text-xs px-5 py-2.5 rounded-2xl hover:bg-surface-2 text-muted-foreground hover:text-foreground font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmRemoveUser}
                className="bg-destructive text-destructive-foreground text-xs font-bold px-6 py-2.5 rounded-2xl hover:bg-destructive/95 transition-all cursor-pointer shadow-md shadow-destructive/15"
              >
                Remove from Team
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: Full Team Roster Modal                           */}
      {/* ========================================================= */}
      {viewRosterTeam && (() => {
        const currentTeam = teams.find(t => t.id === viewRosterTeam.id) || viewRosterTeam;
        const currentMembers = currentTeam.team_members || [];
        const q = rosterSearch.toLowerCase().trim();
        const filteredRoster = currentMembers.filter((tm: any) => {
          if (!q) return true;
          const rawId = tm.user_id || tm.id;
          const u = users.find(u =>
            String(u.id).toLowerCase() === String(rawId).toLowerCase() ||
            String(u.email).toLowerCase() === String(rawId).toLowerCase()
          );
          const name = u?.name || "";
          const email = u?.email || "";
          const role = u?.designation || u?.role || "";
          return (
            name.toLowerCase().includes(q) ||
            email.toLowerCase().includes(q) ||
            role.toLowerCase().includes(q) ||
            String(rawId).toLowerCase().includes(q)
          );
        });

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 font-sans">
            <div className="bg-background border border-border/80 rounded-[28px] shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-scale-in text-xs">
              <header className="px-6 py-5 border-b border-border/50 flex items-center justify-between shrink-0 select-none bg-card/60 backdrop-blur-xs">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-primary/10 text-primary border border-primary/25 flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                    {(currentTeam.name || "T").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-[16px] text-foreground tracking-tight capitalize">
                        {currentTeam.name}
                      </h3>
                      <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded-md border bg-muted/70 text-foreground/80 border-border/70">
                        {currentMembers.length} Members
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {getTeamDiscipline(currentTeam.name)} • Organizational Roster
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setViewRosterTeam(null)}
                  className="size-8 rounded-full hover:bg-surface-3 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-all"
                >
                  <X className="size-4.5" />
                </button>
              </header>

              {/* Search inside roster */}
              <div className="p-4 border-b border-border/50 bg-surface-2/30 flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    placeholder={`Search ${currentMembers.length} members by name, email, or role...`}
                    value={rosterSearch}
                    onChange={(e) => setRosterSearch(e.target.value)}
                    className="w-full h-8.5 bg-background border border-border/70 focus:border-primary/80 focus:ring-1 focus:ring-primary/20 rounded-xl pl-8.5 pr-7 text-xs outline-none text-foreground placeholder:text-muted-foreground/60 shadow-2xs transition-all"
                  />
                  {rosterSearch && (
                    <button
                      onClick={() => setRosterSearch("")}
                      className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={() => {
                      const targetId = currentTeam.id;
                      setViewRosterTeam(null);
                      openAssignForTeam(targetId);
                    }}
                    className="h-8.5 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0 transition-all"
                  >
                    <UserPlus className="size-3.5" />
                    <span>Add Member</span>
                  </button>
                )}
              </div>

              {/* Member list scrollable */}
              <div className="max-h-[50vh] overflow-y-auto p-4 space-y-1.5 custom-scrollbar">
                {filteredRoster.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground flex flex-col items-center gap-2">
                    <Users className="size-6 text-muted-foreground/50" />
                    <p className="text-xs">No members found matching "{rosterSearch}"</p>
                  </div>
                ) : (
                  filteredRoster.map((tm: any) => {
                    const rawId = tm.user_id || tm.id;
                    const user = users.find(u =>
                      String(u.id).toLowerCase() === String(rawId).toLowerCase() ||
                      String(u.email).toLowerCase() === String(rawId).toLowerCase()
                    );
                    const displayName = user?.name || rawId;
                    const rawRole = user?.designation || user?.role || "Engineer";
                    const displayRole = formatRole(rawRole);
                    const roleBadgeClass = getRoleBadgeStyle(rawRole);

                    return (
                      <div
                        key={rawId}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-border/60 bg-surface-2/30 hover:bg-surface-2/70 transition-colors group/roster"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 rounded-full bg-muted text-foreground font-bold text-xs flex items-center justify-center shrink-0 border border-border/70">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-xs text-foreground truncate" title={displayName}>
                              {displayName}
                            </span>
                            <span className="text-[10.5px] text-muted-foreground truncate">
                              {user?.email || "No email listed"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${roleBadgeClass}`}>
                            {displayRole}
                          </span>

                          {isAdmin && (
                            <button
                              onClick={() => setRemoveConfirmMember({
                                teamId: currentTeam.id,
                                teamName: currentTeam.name,
                                userId: rawId,
                                userName: displayName
                              })}
                              className="size-7 rounded-lg hover:bg-muted text-muted-foreground/40 hover:text-foreground flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100"
                              title="Remove member"
                            >
                              <UserMinus className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <footer className="px-6 py-3.5 border-t border-border/50 flex items-center justify-between bg-card/60 backdrop-blur-xs">
                <span className="text-[11px] text-muted-foreground">
                  Showing {filteredRoster.length} of {currentMembers.length} active personnel
                </span>
                <button
                  onClick={() => setViewRosterTeam(null)}
                  className="border border-border/80 text-xs px-4 py-1.5 rounded-xl hover:bg-surface-2 text-foreground font-semibold cursor-pointer transition-all"
                >
                  Close
                </button>
              </footer>
            </div>
          </div>
        );
      })()}

    </AppShell>
  );
}

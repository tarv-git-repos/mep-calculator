import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { 
  Network, Users, Plus, Shield, ShieldAlert, Mail, Trash2, Edit3, 
  ChevronDown, ChevronRight, Search, Sparkles, Save, RefreshCw, 
  Layers, Briefcase, Building2, UserCheck, UserPlus, GitFork, Crown,
  User, Check, ArrowRight, Wand2, CheckCircle2, AlertCircle, Loader2
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/services/api";

export const Route = createFileRoute("/company-hierarchy")({
  head: () => ({
    meta: [
      { title: "Company Hierarchy — MEP Calc" },
      { name: "description", content: "Organization Company Hierarchy & Role Management" }
    ],
  }),
  component: CompanyHierarchyPage,
});

export interface HierarchyUser {
  id: string;
  name: string;
  email: string;
  designation: string;
  department: "Management" | "HVAC" | "Electrical" | "Plumbing" | "Fire Fighting" | "BIM & IT";
  role: "SUPER_ADMIN" | "ORG_ADMIN" | "PROJECT_MANAGER" | "ENGINEER" | "USER" | "VIEWER";
  parentId: string | null; // ID of manager
  avatarColor?: string;
  status: "active" | "away" | "offline";
}

interface BuilderRow {
  userId: string;
  name: string;
  email: string;
  designation: string;
  department: HierarchyUser["department"];
  role: HierarchyUser["role"];
  parentId: string | null;
  selected: boolean;
}

const COLOR_PALETTE = [
  "bg-indigo-600", "bg-blue-600", "bg-purple-600", 
  "bg-emerald-600", "bg-amber-600", "bg-teal-600", 
  "bg-rose-600", "bg-cyan-600", "bg-sky-600", "bg-violet-600"
];

const DEFAULT_HIERARCHY: HierarchyUser[] = [
  {
    id: "usr-101",
    name: "Alex Mercer",
    email: "alex.mercer@mep-calc.com",
    designation: "Chief Executive Officer & Founder",
    department: "Management",
    role: "SUPER_ADMIN",
    parentId: null,
    avatarColor: "bg-indigo-600",
    status: "active"
  },
  {
    id: "usr-102",
    name: "David Vance",
    email: "david.vance@mep-calc.com",
    designation: "Director of MEP Engineering",
    department: "Management",
    role: "ORG_ADMIN",
    parentId: "usr-101",
    avatarColor: "bg-blue-600",
    status: "active"
  },
  {
    id: "usr-103",
    name: "Elena Rostova",
    email: "elena.rostova@mep-calc.com",
    designation: "Director of BIM & Technology",
    department: "BIM & IT",
    role: "ORG_ADMIN",
    parentId: "usr-101",
    avatarColor: "bg-purple-600",
    status: "active"
  },
  {
    id: "usr-104",
    name: "Vikram Kadam",
    email: "vikram.kadam@mep-calc.com",
    designation: "Lead HVAC Principal PM",
    department: "HVAC",
    role: "PROJECT_MANAGER",
    parentId: "usr-102",
    avatarColor: "bg-emerald-600",
    status: "active"
  },
  {
    id: "usr-105",
    name: "Sarah Jenkins",
    email: "sarah.jenkins@mep-calc.com",
    designation: "Lead Electrical PM",
    department: "Electrical",
    role: "PROJECT_MANAGER",
    parentId: "usr-102",
    avatarColor: "bg-amber-600",
    status: "active"
  },
  {
    id: "usr-106",
    name: "Marcus Brody",
    email: "marcus.brody@mep-calc.com",
    designation: "Lead Plumbing & Fire Protection PM",
    department: "Plumbing",
    role: "PROJECT_MANAGER",
    parentId: "usr-102",
    avatarColor: "bg-teal-600",
    status: "active"
  },
  {
    id: "usr-107",
    name: "Rahul Sharma",
    email: "rahul.sharma@mep-calc.com",
    designation: "Senior HVAC Mechanical Engineer",
    department: "HVAC",
    role: "ENGINEER",
    parentId: "usr-104",
    avatarColor: "bg-cyan-600",
    status: "active"
  },
  {
    id: "usr-108",
    name: "Priya Nair",
    email: "priya.nair@mep-calc.com",
    designation: "Senior Electrical Systems Engineer",
    department: "Electrical",
    role: "ENGINEER",
    parentId: "usr-105",
    avatarColor: "bg-rose-600",
    status: "active"
  },
  {
    id: "usr-109",
    name: "Tariq Al-Mansoor",
    email: "tariq.mansoor@mep-calc.com",
    designation: "Fire Suppression Systems Specialist",
    department: "Fire Fighting",
    role: "ENGINEER",
    parentId: "usr-106",
    avatarColor: "bg-orange-600",
    status: "active"
  },
  {
    id: "usr-110",
    name: "Daniel Kim",
    email: "daniel.kim@mep-calc.com",
    designation: "HVAC Design & Load Calculation Specialist",
    department: "HVAC",
    role: "ENGINEER",
    parentId: "usr-107",
    avatarColor: "bg-sky-600",
    status: "active"
  },
  {
    id: "usr-111",
    name: "Amina Zaidi",
    email: "amina.zaidi@mep-calc.com",
    designation: "Electrical BIM Specialist & Modeler",
    department: "BIM & IT",
    role: "ENGINEER",
    parentId: "usr-103",
    avatarColor: "bg-violet-600",
    status: "active"
  },
  {
    id: "usr-112",
    name: "Kevin Chen",
    email: "kevin.chen@mep-calc.com",
    designation: "Junior Plumbing & Hydraulics Engineer",
    department: "Plumbing",
    role: "USER",
    parentId: "usr-106",
    avatarColor: "bg-slate-600",
    status: "active"
  }
];

function CompanyHierarchyPage() {
  const { profile, userData } = useAuth();
  const currentRole = userData?.role || profile?.role || "SUPER_ADMIN";
  const orgId = userData?.organization_id || profile?.organization_id || "";
  const orgName = userData?.company || userData?.organization || profile?.company || profile?.organization || "Organization";
  
  // Access check: Visible only to SUPER_ADMIN and ORG_ADMIN
  const isAuthorized = ["SUPER_ADMIN", "ORG_ADMIN"].includes(currentRole);

  const [members, setMembers] = useState<HierarchyUser[]>([]);
  const [hasCustomHierarchy, setHasCustomHierarchy] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Organization users list
  const [orgUsers, setOrgUsers] = useState<any[]>([]);

  // Filtering and view state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Single Add / Edit Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HierarchyUser | null>(null);
  const [selectedExistingUser, setSelectedExistingUser] = useState<string>("");

  // Hierarchy Builder Modal (Create Hierarchy)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [builderRows, setBuilderRows] = useState<BuilderRow[]>([]);
  const [builderSearch, setBuilderSearch] = useState("");

  // Form State for Add / Edit Single
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formDepartment, setFormDepartment] = useState<HierarchyUser["department"]>("HVAC");
  const [formRole, setFormRole] = useState<HierarchyUser["role"]>("ENGINEER");
  const [formParentId, setFormParentId] = useState<string | null>(null);

  // Load Organization Users and Hierarchy on mount
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch organization users
        let fetchedUsers = await api.getOrgUsers();
        if (!fetchedUsers || fetchedUsers.length === 0) {
          const allUsers = await api.getUsers();
          fetchedUsers = allUsers.filter((u: any) => u.role !== 'SUPER_ADMIN' && u.email !== 'admin@tarv.ai');
        }
        setOrgUsers(fetchedUsers || []);

        // 2. Fetch saved hierarchy
        const saved = await api.getCompanyHierarchy(orgId);
        if (saved && Array.isArray(saved) && saved.length > 0) {
          setMembers(saved);
          setHasCustomHierarchy(true);
        } else {
          // Check local storage
          const localStr = localStorage.getItem(`mep_company_hierarchy_${orgId}`) || localStorage.getItem("mep_company_hierarchy");
          if (localStr) {
            try {
              const parsed = JSON.parse(localStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setMembers(parsed);
                setHasCustomHierarchy(true);
              } else {
                setMembers(DEFAULT_HIERARCHY);
                setHasCustomHierarchy(false);
              }
            } catch {
              setMembers(DEFAULT_HIERARCHY);
              setHasCustomHierarchy(false);
            }
          } else {
            setMembers(DEFAULT_HIERARCHY);
            setHasCustomHierarchy(false);
          }
        }
      } catch (err) {
        console.error("Error loading hierarchy data:", err);
        setMembers(DEFAULT_HIERARCHY);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [orgId]);

  // Save Hierarchy
  const saveHierarchy = async (newMembers: HierarchyUser[]) => {
    setMembers(newMembers);
    setHasCustomHierarchy(true);
    await api.saveCompanyHierarchy(newMembers, orgId);
  };

  const handleResetDefault = () => {
    saveHierarchy(DEFAULT_HIERARCHY);
    setHasCustomHierarchy(false);
    toast.success("Hierarchy reset to default template structure!");
  };

  // Toggle Collapse
  const toggleCollapse = (id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------
  // HIERARCHY BUILDER MODAL LOGIC (Create Hierarchy for Org Admin)
  // -------------------------------------------------------------
  const handleOpenBuilder = () => {
    let sourceUsers = orgUsers;
    if (!sourceUsers || sourceUsers.length === 0) {
      sourceUsers = members.map(m => ({ id: m.id, name: m.name, email: m.email, role: m.role }));
    }

    const existingMap = new Map<string, HierarchyUser>();
    members.forEach(m => {
      existingMap.set(m.email.toLowerCase(), m);
      existingMap.set(m.id, m);
    });

    const mapRoleTier = (r: string): HierarchyUser["role"] => {
      const u = String(r || '').toUpperCase();
      if (u.includes('SUPER_ADMIN')) return 'SUPER_ADMIN';
      if (u.includes('ORG_ADMIN') || u.includes('DIRECTOR') || u.includes('ADMIN')) return 'ORG_ADMIN';
      if (u.includes('LEADER') || u.includes('MANAGER') || u.includes('COORDINATOR') || u.includes('PM')) return 'PROJECT_MANAGER';
      if (u.includes('SR.') || u.includes('SENIOR')) return 'ENGINEER';
      if (u.includes('VIEWER') || u.includes('CLIENT')) return 'VIEWER';
      return 'USER';
    };

    const mapDept = (r: string, des: string): HierarchyUser["department"] => {
      const combined = `${r} ${des}`.toLowerCase();
      if (combined.includes('admin') || combined.includes('director') || combined.includes('management') || combined.includes('ceo')) return 'Management';
      if (combined.includes('elec') || combined.includes('power') || combined.includes('lighting')) return 'Electrical';
      if (combined.includes('plumb') || combined.includes('drain') || combined.includes('water')) return 'Plumbing';
      if (combined.includes('fire') || combined.includes('sprinkler') || combined.includes('suppression')) return 'Fire Fighting';
      if (combined.includes('bim') || combined.includes('model') || combined.includes('draft') || combined.includes('it')) return 'BIM & IT';
      return 'HVAC';
    };

    const rows: BuilderRow[] = sourceUsers.map((u, idx) => {
      const emailLower = (u.email || '').toLowerCase();
      const existing = existingMap.get(emailLower) || existingMap.get(u.id);

      const mappedRole = existing?.role || mapRoleTier(u.role);
      const mappedDept = existing?.department || mapDept(u.role, u.designation || '');
      const mappedDesignation = existing?.designation || u.designation || (
        mappedRole === 'ORG_ADMIN' ? 'Director of MEP Engineering' :
        mappedRole === 'PROJECT_MANAGER' ? `Lead ${mappedDept} Project Manager` :
        mappedRole === 'ENGINEER' ? `Senior ${mappedDept} Engineer` :
        mappedRole === 'VIEWER' ? 'Project Viewer' :
        `${mappedDept} Design Engineer`
      );

      return {
        userId: u.id || `usr-${idx}-${Date.now()}`,
        name: u.name || u.email?.split('@')[0] || `User ${idx + 1}`,
        email: u.email || `user${idx + 1}@company.com`,
        designation: mappedDesignation,
        department: mappedDept,
        role: mappedRole,
        parentId: existing?.parentId || null,
        selected: true
      };
    });

    const hasAnyParent = rows.some(r => r.parentId !== null);
    if (!hasAnyParent && rows.length > 1) {
      const adminRow = rows.find(r => r.role === 'ORG_ADMIN' || r.role === 'SUPER_ADMIN') || rows[0];
      const adminId = adminRow.userId;

      rows.forEach(r => {
        if (r.userId !== adminId) {
          if (r.role === 'PROJECT_MANAGER') {
            r.parentId = adminId;
          } else {
            const pmInDept = rows.find(p => p.role === 'PROJECT_MANAGER' && p.department === r.department && p.userId !== r.userId);
            r.parentId = pmInDept ? pmInDept.userId : adminId;
          }
        }
      });
    }

    setBuilderRows(rows);
    setBuilderSearch("");
    setIsBuilderOpen(true);
  };

  const handleAutoArrange = () => {
    if (builderRows.length === 0) return;

    const updated = [...builderRows];
    let rootAdmin = updated.find(r => r.selected && (r.role === 'ORG_ADMIN' || r.role === 'SUPER_ADMIN'));
    if (!rootAdmin) {
      rootAdmin = updated.find(r => r.selected);
      if (rootAdmin) rootAdmin.role = 'ORG_ADMIN';
    }

    if (!rootAdmin) return;

    const rootId = rootAdmin.userId;
    rootAdmin.parentId = null;
    rootAdmin.department = "Management";

    const pms = updated.filter(r => r.selected && r.userId !== rootId && r.role === 'PROJECT_MANAGER');
    
    if (pms.length === 0 && updated.filter(r => r.selected).length > 2) {
      const candidates = updated.filter(r => r.selected && r.userId !== rootId);
      if (candidates[0]) {
        candidates[0].role = 'PROJECT_MANAGER';
        candidates[0].parentId = rootId;
        pms.push(candidates[0]);
      }
      if (candidates[1]) {
        candidates[1].role = 'PROJECT_MANAGER';
        candidates[1].parentId = rootId;
        pms.push(candidates[1]);
      }
    }

    pms.forEach(pm => {
      pm.parentId = rootId;
    });

    updated.forEach(r => {
      if (!r.selected || r.userId === rootId) return;
      if (r.role === 'PROJECT_MANAGER') {
        r.parentId = rootId;
        return;
      }

      const matchingPm = pms.find(pm => pm.department === r.department);
      if (matchingPm) {
        r.parentId = matchingPm.userId;
      } else if (pms.length > 0) {
        r.parentId = pms[0].userId;
      } else {
        r.parentId = rootId;
      }
    });

    setBuilderRows(updated);
    toast.success("Auto-arranged hierarchy: Org Admin at top, Lead PMs in middle, Engineers & Staff reporting to PMs!");
  };

  const handleSaveBuilderHierarchy = async () => {
    const selectedRows = builderRows.filter(r => r.selected);
    if (selectedRows.length === 0) {
      toast.error("Please select at least 1 user to create the hierarchy.");
      return;
    }

    const hasTopLeader = selectedRows.some(r => r.parentId === null);
    if (!hasTopLeader) {
      const topRow = selectedRows.find(r => r.role === 'ORG_ADMIN' || r.role === 'SUPER_ADMIN') || selectedRows[0];
      topRow.parentId = null;
    }

    const selectedIds = new Set(selectedRows.map(r => r.userId));
    const rootUser = selectedRows.find(r => r.parentId === null) || selectedRows[0];

    const finalMembers: HierarchyUser[] = selectedRows.map((r, idx) => {
      const validParent = r.parentId && selectedIds.has(r.parentId) && r.parentId !== r.userId ? r.parentId : (r.userId === rootUser.userId ? null : rootUser.userId);
      return {
        id: r.userId,
        name: r.name.trim(),
        email: r.email.trim(),
        designation: r.designation.trim() || "MEP Specialist",
        department: r.department,
        role: r.role,
        parentId: validParent,
        avatarColor: COLOR_PALETTE[idx % COLOR_PALETTE.length],
        status: "active"
      };
    });

    await saveHierarchy(finalMembers);
    setIsBuilderOpen(false);
    toast.success(`🎉 Company hierarchy created with ${finalMembers.length} organization members!`);
  };

  // Open Add Modal
  const handleOpenAddModal = (presetParentId?: string | null) => {
    setFormName("");
    setFormEmail("");
    setFormDesignation("");
    setFormDepartment("HVAC");
    setFormRole("ENGINEER");
    setFormParentId(presetParentId !== undefined ? presetParentId : (members[0]?.id || null));
    setSelectedExistingUser("");
    setEditingMember(null);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (member: HierarchyUser) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormEmail(member.email);
    setFormDesignation(member.designation);
    setFormDepartment(member.department);
    setFormRole(member.role);
    setFormParentId(member.parentId);
    setSelectedExistingUser("");
    setIsAddModalOpen(true);
  };

  const handleSelectExistingUser = (userId: string) => {
    setSelectedExistingUser(userId);
    const found = orgUsers.find(u => u.id === userId);
    if (found) {
      setFormName(found.name || found.email?.split('@')[0] || "");
      setFormEmail(found.email || "");
      if (found.role === 'ORG_ADMIN') {
        setFormRole('ORG_ADMIN');
        setFormDesignation('Director of MEP Engineering');
      } else if (found.role?.includes('Leader') || found.role?.includes('Coordinator')) {
        setFormRole('PROJECT_MANAGER');
        setFormDesignation(found.role);
      } else if (found.role?.includes('Sr.')) {
        setFormRole('ENGINEER');
        setFormDesignation(found.role);
      } else {
        setFormRole('USER');
        setFormDesignation(found.role || 'Design Engineer');
      }
    }
  };

  // Handle Form Submit (Add or Edit)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Please provide both name and email.");
      return;
    }

    if (editingMember) {
      const updated = members.map((m) => {
        if (m.id === editingMember.id) {
          return {
            ...m,
            name: formName.trim(),
            email: formEmail.trim(),
            designation: formDesignation.trim() || "MEP Specialist",
            department: formDepartment,
            role: formRole,
            parentId: formParentId,
          };
        }
        return m;
      });
      await saveHierarchy(updated);
      toast.success(`Updated ${formName} in hierarchy!`);
    } else {
      const newMember: HierarchyUser = {
        id: selectedExistingUser || `usr-${Date.now()}`,
        name: formName.trim(),
        email: formEmail.trim(),
        designation: formDesignation.trim() || "MEP Engineer",
        department: formDepartment,
        role: formRole,
        parentId: formParentId,
        avatarColor: COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)],
        status: "active"
      };
      await saveHierarchy([...members, newMember]);
      toast.success(`Added ${newMember.name} to hierarchy!`);
    }

    setIsAddModalOpen(false);
  };

  // Delete Member
  const handleDeleteMember = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the hierarchy? Subordinates will be re-assigned to their manager.`)) {
      const target = members.find((m) => m.id === id);
      const parentOfTarget = target ? target.parentId : null;

      const updated = members
        .filter((m) => m.id !== id)
        .map((m) => {
          if (m.parentId === id) {
            return { ...m, parentId: parentOfTarget };
          }
          return m;
        });
      await saveHierarchy(updated);
      toast.success(`Removed ${name} from hierarchy.`);
    }
  };

  const visibleMembers = useMemo(() => {
    return members;
  }, [members]);

  // Filtered members for search & department
  const filteredMembers = useMemo(() => {
    return visibleMembers.filter((m) => {
      const matchQuery = 
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.designation.toLowerCase().includes(searchQuery.toLowerCase());
      const matchDept = selectedDept === "ALL" || m.department === selectedDept;
      return matchQuery && matchDept;
    });
  }, [visibleMembers, searchQuery, selectedDept]);

  // Root members (parentId is null or parent doesn't exist)
  const rootMembers = useMemo(() => {
    const ids = new Set(visibleMembers.map((m) => m.id));
    return visibleMembers.filter((m) => !m.parentId || !ids.has(m.parentId));
  }, [visibleMembers]);

  // Map of direct reports: managerId -> child members
  const reportsMap = useMemo(() => {
    const map = new Map<string, HierarchyUser[]>();
    visibleMembers.forEach((m) => {
      if (m.parentId) {
        if (!map.has(m.parentId)) map.set(m.parentId, []);
        map.get(m.parentId)!.push(m);
      }
    });
    return map;
  }, [visibleMembers]);

  if (!isAuthorized) {
    return (
      <AppShell title="Company Hierarchy" subtitle="Organization Role & Reporting Hierarchy">
        <div className="flex h-[calc(100vh-120px)] items-center justify-center bg-background p-6">
          <div className="flex flex-col items-center gap-4 text-center max-w-md bg-card border border-border p-8 rounded-3xl shadow-lg">
            <div className="size-16 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ShieldAlert className="size-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Company Hierarchy management is restricted to Super Admins and Organization Admins.
              </p>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell 
      title="Company Hierarchy" 
      subtitle="Organization Hierarchy & Platform Roles Builder"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenBuilder}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <Sparkles className="size-3.5" /> Create Hierarchy
          </button>
          <button
            onClick={() => handleOpenAddModal(null)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
          >
            <UserPlus className="size-3.5" /> Add Member
          </button>
          <button
            onClick={() => {
              saveHierarchy([...members]);
              toast.success("Company hierarchy configuration saved!");
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-surface-2 border border-border text-foreground hover:bg-surface-3 text-xs font-bold transition-all cursor-pointer"
          >
            <Save className="size-3.5 text-primary" /> Save Changes
          </button>
        </div>
      }
    >
      <div className="flex flex-col flex-1 h-full min-h-0 bg-slate-50/40 dark:bg-zinc-950/20 overflow-y-auto custom-scrollbar p-6 space-y-6">
        
        {/* FIRST-TIME HIERARCHY SETUP BANNER (If no custom hierarchy saved yet) */}
        {!hasCustomHierarchy && (
          <div className="bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-teal-500/10 border border-indigo-500/20 rounded-3xl p-5 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="size-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
                <Wand2 className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  Create Organization Hierarchy for {orgName}
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    Org Admin Builder
                  </span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Build and structure your company reporting tree from your registered team members. Assign leadership roles, departments, and reporting managers.
                </p>
              </div>
            </div>
            <button
              onClick={handleOpenBuilder}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition-all shrink-0 cursor-pointer flex items-center gap-2"
            >
              <Sparkles className="size-3.5" /> Open Hierarchy Builder
            </button>
          </div>
        )}

        {/* KPI Banner Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="size-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 font-bold">
              <Users className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground">Total Members</span>
              <div className="text-xl font-extrabold text-foreground">{members.length} Users</div>
            </div>
          </div>

          <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="size-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 font-bold">
              <Crown className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground">Admins & PMs</span>
              <div className="text-xl font-extrabold text-foreground">
                {members.filter((m) => ["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER"].includes(m.role)).length} Leaders
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
              <Briefcase className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground">Engineers & Staff</span>
              <div className="text-xl font-extrabold text-foreground">
                {members.filter((m) => ["ENGINEER", "USER", "VIEWER"].includes(m.role)).length} Staff
              </div>
            </div>
          </div>

          <div className="bg-card border border-border p-4.5 rounded-2xl shadow-xs flex items-center gap-4">
            <div className="size-11 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 font-bold">
              <Layers className="size-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-muted-foreground">Departments</span>
              <div className="text-xl font-extrabold text-foreground">6 Disciplines</div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filter Options */}
        <div className="bg-card border border-border p-3.5 rounded-2xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3 w-full md:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search member, email, title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-full pl-9 pr-4 py-2 text-xs outline-none transition-all"
              />
            </div>

            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-surface-2 border border-border/80 text-foreground font-semibold rounded-full px-3.5 py-2 text-xs outline-none focus:border-primary cursor-pointer shrink-0"
            >
              <option value="ALL">All Departments</option>
              <option value="Management">Management</option>
              <option value="HVAC">HVAC Engineering</option>
              <option value="Electrical">Electrical Engineering</option>
              <option value="Plumbing">Plumbing Engineering</option>
              <option value="Fire Fighting">Fire Protection</option>
              <option value="BIM & IT">BIM & Technology</option>
            </select>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleOpenBuilder}
              className="px-3.5 py-1.5 text-xs font-bold rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Wand2 className="size-3.5" /> Builder Wizard
            </button>

            <div className="flex bg-surface-2 p-1 rounded-full border border-border/80">
              <button
                onClick={() => setViewMode("tree")}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  viewMode === "tree"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitFork className="size-3.5 inline mr-1" /> Tree View
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="size-3.5 inline mr-1" /> List Grid
              </button>
            </div>

            <button
              onClick={handleResetDefault}
              className="px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border rounded-full hover:bg-surface-2 transition-all cursor-pointer"
              title="Reset to default mock hierarchy template"
            >
              <RefreshCw className="size-3.5 inline mr-1" /> Reset
            </button>
          </div>
        </div>

        {/* VIEW MODE 1: VISUAL TREE HIERARCHY */}
        {viewMode === "tree" && (
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm overflow-x-auto custom-scrollbar min-h-[500px]">
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-8 animate-spin text-primary" />
                <span className="text-xs font-medium">Loading organization hierarchy...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center min-w-[750px] space-y-6">
                {rootMembers.length === 0 ? (
                  <div className="p-12 text-center text-muted-foreground text-sm space-y-3">
                    <Network className="size-12 mx-auto text-muted-foreground/40" />
                    <div>No hierarchy structure defined yet.</div>
                    <button
                      onClick={handleOpenBuilder}
                      className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition shadow-xs cursor-pointer inline-flex items-center gap-2"
                    >
                      <Sparkles className="size-4" /> Create Hierarchy Now
                    </button>
                  </div>
                ) : (
                  rootMembers.map((root) => (
                    <TreeNode
                      key={root.id}
                      member={root}
                      reportsMap={reportsMap}
                      collapsedNodes={collapsedNodes}
                      onToggleCollapse={toggleCollapse}
                      onAddReport={handleOpenAddModal}
                      onEdit={handleOpenEditModal}
                      onDelete={handleDeleteMember}
                      allMembers={members}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW MODE 2: TABULAR GRID */}
        {viewMode === "table" && (
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-muted-foreground font-bold uppercase text-[10px] tracking-wider border-b border-border">
                  <tr>
                    <th className="py-3 px-4">Member Name & Email</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Role Tier</th>
                    <th className="py-3 px-4">Reporting Manager</th>
                    <th className="py-3 px-4 text-center">Direct Reports</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground italic">
                        No team members found matching search query.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((m) => {
                      const manager = members.find((p) => p.id === m.parentId);
                      const directReportsCount = (reportsMap.get(m.id) || []).length;
                      return (
                        <tr key={m.id} className="hover:bg-surface-2/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`size-8 rounded-full ${m.avatarColor || "bg-primary"} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}>
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-bold text-foreground">{m.name}</span>
                                <span className="text-[10px] text-muted-foreground">{m.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-medium text-foreground">{m.designation}</td>
                          <td className="py-3 px-4">
                            <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20">
                              {m.department}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <RoleBadge role={m.role} />
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {manager ? (
                              <div className="flex items-center gap-1.5 font-medium text-foreground">
                                <User className="size-3.5 text-muted-foreground" />
                                {manager.name}
                              </div>
                            ) : (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10.5px]">Top Leader</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2 py-0.5 bg-surface-2 rounded-full font-bold text-[11px] text-foreground">
                              {directReportsCount}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleOpenAddModal(m.id)}
                                className="p-1.5 hover:bg-primary/10 text-primary rounded-lg transition-all cursor-pointer"
                                title="Add Direct Report"
                              >
                                <UserPlus className="size-3.5" />
                              </button>
                              <button
                                onClick={() => handleOpenEditModal(m)}
                                className="p-1.5 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer"
                                title="Edit Role & Reporting"
                              >
                                <Edit3 className="size-3.5" />
                              </button>
                              {m.parentId && (
                                <button
                                  onClick={() => handleDeleteMember(m.id, m.name)}
                                  className="p-1.5 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all cursor-pointer"
                                  title="Remove Member"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================= */}
      {/* 🚀 ORGANIZATION HIERARCHY BUILDER MODAL (FULL INTERACTIVE)     */}
      {/* ============================================================= */}
      {isBuilderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-3xl max-w-5xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/60 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md">
                  <Wand2 className="size-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-extrabold text-foreground text-lg">
                      Organization Hierarchy Builder
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                      {orgName}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Configure your company structure: select users, assign platform roles, departments, and reporting managers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBuilderOpen(false)}
                className="size-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Wizard Quick Toolbar */}
            <div className="bg-surface-2/60 border border-border/70 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto flex-1 max-w-sm">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Filter users in builder..."
                  value={builderSearch}
                  onChange={(e) => setBuilderSearch(e.target.value)}
                  className="w-full bg-background border border-border/80 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-primary font-medium"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleAutoArrange}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Auto-assign reporting managers based on role hierarchy"
                >
                  <Sparkles className="size-3.5" /> Auto-Arrange Structure
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const allSelected = builderRows.every(r => r.selected);
                    setBuilderRows(builderRows.map(r => ({ ...r, selected: !allSelected })));
                  }}
                  className="px-3 py-1.5 bg-card hover:bg-surface-3 text-foreground text-xs font-semibold rounded-xl border border-border transition-all cursor-pointer"
                >
                  {builderRows.every(r => r.selected) ? "Deselect All" : "Select All"}
                </button>
              </div>
            </div>

            {/* Builder Table */}
            <div className="flex-1 overflow-y-auto border border-border rounded-2xl custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-2 text-muted-foreground font-bold uppercase text-[10px] tracking-wider border-b border-border sticky top-0 z-10 backdrop-blur-md">
                  <tr>
                    <th className="py-3 px-3.5 w-10 text-center">Include</th>
                    <th className="py-3 px-3.5">Organization Member</th>
                    <th className="py-3 px-3.5 w-44">Hierarchy Role</th>
                    <th className="py-3 px-3.5 w-40">Department</th>
                    <th className="py-3 px-3.5 w-52">Designation / Title</th>
                    <th className="py-3 px-3.5 w-52">Reports To (Manager)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {builderRows
                    .filter(r => 
                      r.name.toLowerCase().includes(builderSearch.toLowerCase()) || 
                      r.email.toLowerCase().includes(builderSearch.toLowerCase()) ||
                      r.designation.toLowerCase().includes(builderSearch.toLowerCase())
                    )
                    .map((row) => (
                      <tr key={row.userId} className={`transition-colors ${row.selected ? 'hover:bg-surface-2/60' : 'opacity-40 bg-surface-2/20'}`}>
                        {/* Include Checkbox */}
                        <td className="py-3 px-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setBuilderRows(builderRows.map(r => r.userId === row.userId ? { ...r, selected: checked } : r));
                            }}
                            className="size-4 rounded accent-primary cursor-pointer"
                          />
                        </td>

                        {/* User info */}
                        <td className="py-3 px-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="size-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {row.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-foreground truncate">{row.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{row.email}</div>
                            </div>
                          </div>
                        </td>

                        {/* Role Select */}
                        <td className="py-3 px-3.5">
                          <select
                            disabled={!row.selected}
                            value={row.role}
                            onChange={(e) => {
                              const newRole = e.target.value as HierarchyUser["role"];
                              setBuilderRows(builderRows.map(r => r.userId === row.userId ? { ...r, role: newRole } : r));
                            }}
                            className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-lg px-2 py-1.5 text-xs font-semibold outline-none cursor-pointer"
                          >
                            <option value="SUPER_ADMIN">👑 Super Admin</option>
                            <option value="ORG_ADMIN">🛡️ Org Admin (Director)</option>
                            <option value="PROJECT_MANAGER">💼 Lead PM</option>
                            <option value="ENGINEER">⚡ Senior Engineer</option>
                            <option value="USER">👤 Engineer / Staff</option>
                            <option value="VIEWER">👁️ Viewer / Guest</option>
                          </select>
                        </td>

                        {/* Department Select */}
                        <td className="py-3 px-3.5">
                          <select
                            disabled={!row.selected}
                            value={row.department}
                            onChange={(e) => {
                              const newDept = e.target.value as HierarchyUser["department"];
                              setBuilderRows(builderRows.map(r => r.userId === row.userId ? { ...r, department: newDept } : r));
                            }}
                            className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-lg px-2 py-1.5 text-xs font-medium outline-none cursor-pointer"
                          >
                            <option value="Management">Management</option>
                            <option value="HVAC">HVAC</option>
                            <option value="Electrical">Electrical</option>
                            <option value="Plumbing">Plumbing</option>
                            <option value="Fire Fighting">Fire Fighting</option>
                            <option value="BIM & IT">BIM & IT</option>
                          </select>
                        </td>

                        {/* Designation Input */}
                        <td className="py-3 px-3.5">
                          <input
                            type="text"
                            disabled={!row.selected}
                            value={row.designation}
                            onChange={(e) => {
                              const newDes = e.target.value;
                              setBuilderRows(builderRows.map(r => r.userId === row.userId ? { ...r, designation: newDes } : r));
                            }}
                            placeholder="e.g. Lead HVAC PM"
                            className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none"
                          />
                        </td>

                        {/* Reporting Manager Select */}
                        <td className="py-3 px-3.5">
                          <select
                            disabled={!row.selected}
                            value={row.parentId || ""}
                            onChange={(e) => {
                              const newParent = e.target.value ? e.target.value : null;
                              setBuilderRows(builderRows.map(r => r.userId === row.userId ? { ...r, parentId: newParent } : r));
                            }}
                            className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-lg px-2 py-1.5 text-xs font-medium outline-none cursor-pointer"
                          >
                            <option value="">Top Leader (No Manager)</option>
                            {builderRows
                              .filter(r => r.selected && r.userId !== row.userId)
                              .map(p => (
                                <option key={p.userId} value={p.userId}>
                                  {p.name} ({p.role.replace('_', ' ')})
                                </option>
                              ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border/60 shrink-0">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <span className="font-bold text-foreground">
                  {builderRows.filter(r => r.selected).length}
                </span> of {builderRows.length} members selected for hierarchy
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsBuilderOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-surface-2 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBuilderHierarchy}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <Check className="size-4" /> Save & Generate Hierarchy
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 👤 ADD / EDIT SINGLE MEMBER MODAL                             */}
      {/* ============================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border/60 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="size-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Network className="size-4" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-base">
                    {editingMember ? "Edit Team Member" : "Add Member to Hierarchy"}
                  </h3>
                  <p className="text-xs text-muted-foreground">Define user role and reporting hierarchy line.</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="size-8 rounded-full hover:bg-surface-2 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* If adding new: Option to select from Organization Users */}
            {!editingMember && orgUsers.length > 0 && (
              <div className="p-3 bg-surface-2/60 border border-border/70 rounded-2xl space-y-1.5">
                <label className="font-bold text-foreground block text-[11px]">
                  Select from Registered Organization Users:
                </label>
                <select
                  value={selectedExistingUser}
                  onChange={(e) => handleSelectExistingUser(e.target.value)}
                  className="w-full bg-background border border-border/80 focus:border-primary rounded-xl px-3 py-2 text-xs font-medium outline-none cursor-pointer"
                >
                  <option value="">-- Choose Organization Member or type manually --</option>
                  {orgUsers.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.name || u.email} ({u.email}) - {u.role}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Vikram Kadam"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="vikram@company.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Designation / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead HVAC Engineer"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Department</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value as any)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer"
                  >
                    <option value="Management">Management</option>
                    <option value="HVAC">HVAC Engineering</option>
                    <option value="Electrical">Electrical Engineering</option>
                    <option value="Plumbing">Plumbing Engineering</option>
                    <option value="Fire Fighting">Fire Protection</option>
                    <option value="BIM & IT">BIM & Technology</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">System Role Tier</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer"
                  >
                    <option value="SUPER_ADMIN">Super Admin (CEO)</option>
                    <option value="ORG_ADMIN">Org Admin (Director)</option>
                    <option value="PROJECT_MANAGER">Project Manager (PM)</option>
                    <option value="ENGINEER">Senior Engineer</option>
                    <option value="USER">Engineer / Staff</option>
                    <option value="VIEWER">Viewer / Guest</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Reporting Manager</label>
                  <select
                    value={formParentId || ""}
                    onChange={(e) => setFormParentId(e.target.value || null)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer"
                  >
                    <option value="">No Manager (Top Leader)</option>
                    {members
                      .filter((m) => !editingMember || m.id !== editingMember.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.designation})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-surface-2 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer"
                >
                  {editingMember ? "Save Changes" : "Add to Hierarchy"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// Sub-component: Tree Node Component (Recursive Tree Rendering)
function TreeNode({
  member,
  reportsMap,
  collapsedNodes,
  onToggleCollapse,
  onAddReport,
  onEdit,
  onDelete,
  allMembers
}: {
  member: HierarchyUser;
  reportsMap: Map<string, HierarchyUser[]>;
  collapsedNodes: Set<string>;
  onToggleCollapse: (id: string) => void;
  onAddReport: (parentId: string) => void;
  onEdit: (m: HierarchyUser) => void;
  onDelete: (id: string, name: string) => void;
  allMembers: HierarchyUser[];
}) {
  const children = reportsMap.get(member.id) || [];
  const isCollapsed = collapsedNodes.has(member.id);

  return (
    <div className="flex flex-col items-center relative">
      {/* Node Card */}
      <div className="group relative bg-card border border-border hover:border-primary/50 p-4 rounded-2xl shadow-xs hover:shadow-md transition-all w-72 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <RoleBadge role={member.role} />
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => onAddReport(member.id)}
              className="p-1 hover:bg-primary/10 text-primary rounded-md transition-all cursor-pointer"
              title="Add Subordinate"
            >
              <UserPlus className="size-3.5" />
            </button>
            <button
              onClick={() => onEdit(member)}
              className="p-1 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded-md transition-all cursor-pointer"
              title="Edit Member"
            >
              <Edit3 className="size-3.5" />
            </button>
            {member.parentId && (
              <button
                onClick={() => onDelete(member.id, member.name)}
                className="p-1 hover:bg-rose-500/10 text-rose-500 rounded-md transition-all cursor-pointer"
                title="Remove Member"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className={`size-10 rounded-2xl ${member.avatarColor || "bg-primary"} text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs`}>
            {member.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-extrabold text-foreground text-sm truncate">{member.name}</span>
            <span className="text-[11px] font-medium text-muted-foreground truncate">{member.designation}</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px]">
          <span className="px-2 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20 text-[10px]">
            {member.department}
          </span>
          <span className="text-muted-foreground text-[10px] truncate max-w-[130px]" title={member.email}>
            {member.email}
          </span>
        </div>

        {/* Collapse / Expand Toggle Button */}
        {children.length > 0 && (
          <button
            onClick={() => onToggleCollapse(member.id)}
            className="absolute -bottom-3 left-1/2 -translate-x-1/2 size-6 rounded-full bg-card border border-border shadow-xs flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary transition-all cursor-pointer z-10"
            title={isCollapsed ? "Expand Subordinates" : "Collapse Subordinates"}
          >
            {isCollapsed ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
        )}
      </div>

      {/* Children Nodes Branch */}
      {children.length > 0 && !isCollapsed && (
        <div className="flex flex-col items-center pt-6 relative w-full">
          {/* Vertical connecting stem down from parent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-border/80"></div>

          {/* Horizontal connecting bar across siblings */}
          {children.length > 1 && (
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-border/80 mx-auto" style={{ width: `calc(100% - 18rem)` }}></div>
          )}

          <div className="flex items-start justify-center gap-6 pt-2">
            {children.map((child) => (
              <div key={child.id} className="relative pt-4">
                {/* Vertical stem up to connector */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-4 bg-border/80"></div>
                <TreeNode
                  member={child}
                  reportsMap={reportsMap}
                  collapsedNodes={collapsedNodes}
                  onToggleCollapse={onToggleCollapse}
                  onAddReport={onAddReport}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  allMembers={allMembers}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component: Role Badge
function RoleBadge({ role }: { role: HierarchyUser["role"] }) {
  switch (role) {
    case "SUPER_ADMIN":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 uppercase tracking-wider flex items-center gap-1">
          <Crown className="size-3" /> Super Admin
        </span>
      );
    case "ORG_ADMIN":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1">
          <Shield className="size-3" /> Org Admin
        </span>
      );
    case "PROJECT_MANAGER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1">
          <Briefcase className="size-3" /> Lead PM
        </span>
      );
    case "ENGINEER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider flex items-center gap-1">
          <UserCheck className="size-3" /> Sr. Engineer
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 uppercase tracking-wider flex items-center gap-1">
          <User className="size-3" /> Staff
        </span>
      );
  }
}

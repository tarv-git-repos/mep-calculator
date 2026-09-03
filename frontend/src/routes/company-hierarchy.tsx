import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Network, Users, Plus, Shield, ShieldAlert, ShieldCheck, Mail, Trash2, Edit3, 
  ChevronDown, ChevronRight, Search, Sparkles, Save, RefreshCw, 
  Layers, Briefcase, Building2, UserCheck, UserPlus, GitFork, Crown,
  User, Check, ArrowRight, Eye, ZoomIn, ZoomOut, RotateCcw, Scan, Move, Maximize2
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/company-hierarchy")({
  head: () => ({
    meta: [
      { title: "Company Hierarchy — MEP Calc" },
      { name: "description", content: "Organization Company Hierarchy & Role Management" }
    ],
  }),
  component: CompanyHierarchyPage,
});

export type ApprovalAuthority = "REVIEW" | "APPROVE_REJECT" | "NONE";

export type HierarchyRole = 
  | "SUPER_ADMIN" 
  | "ORG_ADMIN" 
  | "PROJECT_MANAGER" 
  | "TEAM_LEADER"
  | "DISCIPLINE_COORDINATOR"
  | "SR_DESIGN_ENGINEER"
  | "DESIGN_ENGINEER"
  | "JR_DESIGN_ENGINEER"
  | "BIM_COORDINATOR"
  | "BIM_MODELER"
  | "DRAFTSMAN_2D"
  | "VIEWER"
  | "CLIENT"
  | "ENGINEER" 
  | "USER";

export interface HierarchyUser {
  id: string;
  name: string;
  email: string;
  designation: string;
  department: "Management" | "HVAC" | "Electrical" | "Plumbing" | "Fire Fighting" | "BIM & IT";
  role: HierarchyRole;
  approvalAuthority?: ApprovalAuthority;
  parentId: string | null; // ID of manager
  avatarColor?: string;
  status: "active" | "away" | "offline";
}

const DEFAULT_HIERARCHY: HierarchyUser[] = [
  {
    id: "usr-101",
    name: "Alex Mercer",
    email: "alex.mercer@mep-calc.com",
    designation: "Chief Executive Officer & Founder",
    department: "Management",
    role: "SUPER_ADMIN",
    approvalAuthority: "APPROVE_REJECT",
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
    approvalAuthority: "APPROVE_REJECT",
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
    approvalAuthority: "APPROVE_REJECT",
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
    approvalAuthority: "APPROVE_REJECT",
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
    approvalAuthority: "APPROVE_REJECT",
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
    approvalAuthority: "APPROVE_REJECT",
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
    approvalAuthority: "REVIEW",
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
    approvalAuthority: "REVIEW",
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
    approvalAuthority: "REVIEW",
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
    approvalAuthority: "REVIEW",
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
    approvalAuthority: "REVIEW",
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
    approvalAuthority: "NONE",
    parentId: "usr-106",
    avatarColor: "bg-slate-600",
    status: "active"
  }
];

const DEFAULT_ORG_ADMIN_HIERARCHY = (adminName?: string, adminEmail?: string): HierarchyUser[] => {
  const rootName = adminName || "David Vance";
  const rootEmail = adminEmail || "david.vance@mep-calc.com";
  const rootId = "usr-102";

  return [
    {
      id: rootId,
      name: rootName,
      email: rootEmail,
      designation: "Director of MEP Engineering",
      department: "Management",
      role: "ORG_ADMIN",
      approvalAuthority: "APPROVE_REJECT",
      parentId: null,
      avatarColor: "bg-blue-600",
      status: "active"
    },
    {
      id: "usr-104",
      name: "Vikram Kadam",
      email: "vikram.kadam@mep-calc.com",
      designation: "Lead HVAC Principal PM",
      department: "HVAC",
      role: "PROJECT_MANAGER",
      approvalAuthority: "APPROVE_REJECT",
      parentId: rootId,
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
      approvalAuthority: "APPROVE_REJECT",
      parentId: rootId,
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
      approvalAuthority: "APPROVE_REJECT",
      parentId: rootId,
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
      approvalAuthority: "REVIEW",
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
      approvalAuthority: "REVIEW",
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
      approvalAuthority: "REVIEW",
      parentId: "usr-106",
      avatarColor: "bg-orange-600",
      status: "active"
    },
    {
      id: "usr-112",
      name: "Kevin Chen",
      email: "kevin.chen@mep-calc.com",
      designation: "Junior Plumbing & Hydraulics Engineer",
      department: "Plumbing",
      role: "USER",
      approvalAuthority: "NONE",
      parentId: "usr-106",
      avatarColor: "bg-slate-600",
      status: "active"
    }
  ];
};

function CompanyHierarchyPage() {
  const { profile, userData } = useAuth();
  let effRole = userData?.role || profile?.role;
  if (!effRole && typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_user_data") || localStorage.getItem("mep_profile");
      if (raw) {
        const parsed = JSON.parse(raw);
        effRole = parsed?.role;
      }
    } catch (e) {}
  }
  const currentRole = effRole || "SUPER_ADMIN";
  const currentUserName = userData?.name || profile?.name || "David Vance";
  const currentUserEmail = userData?.email || profile?.email || "david.vance@mep-calc.com";
  
  // Access check: Visible only to SUPER_ADMIN and ORG_ADMIN
  const isAuthorized = ["SUPER_ADMIN", "ORG_ADMIN"].includes(currentRole);

  const [members, setMembers] = useState<HierarchyUser[]>(() => {
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_company_hierarchy");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return DEFAULT_HIERARCHY;
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // 3D-Viewer Style Canvas Pan & Zoom State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleZoomIn = () => setZoom((prev) => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  const handleZoomOut = () => setZoom((prev) => Math.max(0.15, +(prev - 0.15).toFixed(2)));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFitView = useCallback(() => {
    if (!canvasRef.current || !contentRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();

    const currentScale = zoom;
    const unscaledWidth = contentRect.width / currentScale;
    const unscaledHeight = contentRect.height / currentScale;

    if (unscaledWidth === 0 || unscaledHeight === 0) return;

    const padding = 60;
    const scaleX = (canvasRect.width - padding * 2) / unscaledWidth;
    const scaleY = (canvasRect.height - padding * 2) / unscaledHeight;
    const newZoom = Math.max(0.15, Math.min(1.2, Math.min(scaleX, scaleY)));

    setZoom(+newZoom.toFixed(2));
    setPan({ x: 0, y: 20 });
  }, [zoom]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.max(0.15, Math.min(2.5, +(prev * zoomFactor).toFixed(2))));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, input, select, a, textarea")) return;
    setIsPanning(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: dragStartRef.current.panX + dx,
      y: dragStartRef.current.panY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<HierarchyUser | null>(null);

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formDepartment, setFormDepartment] = useState<HierarchyUser["department"]>("HVAC");
  const [formRole, setFormRole] = useState<HierarchyUser["role"]>("ENGINEER");
  const [formApprovalAuthority, setFormApprovalAuthority] = useState<ApprovalAuthority>("NONE");
  const [formParentId, setFormParentId] = useState<string | null>(null);

  // Save to LocalStorage whenever members change
  const saveHierarchy = (newMembers: HierarchyUser[]) => {
    setMembers(newMembers);
    if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
      try {
        localStorage.setItem("mep_company_hierarchy", JSON.stringify(newMembers));
      } catch (e) {}
    }
  };

  const handleCreateOrgHierarchy = () => {
    const template = DEFAULT_ORG_ADMIN_HIERARCHY(currentUserName, currentUserEmail);
    if (currentRole === "ORG_ADMIN") {
      // For ORG_ADMIN, replace or set the hierarchy structure with the Org Admin at the top
      saveHierarchy(template);
      toast.success("Organization hierarchy created successfully!");
    } else {
      saveHierarchy(DEFAULT_HIERARCHY);
      toast.success("Company hierarchy created successfully!");
    }
  };

  const handleResetDefault = () => {
    if (currentRole === "ORG_ADMIN") {
      saveHierarchy(DEFAULT_ORG_ADMIN_HIERARCHY(currentUserName, currentUserEmail));
      toast.success("Hierarchy reset to default organization structure!");
    } else {
      saveHierarchy(DEFAULT_HIERARCHY);
      toast.success("Hierarchy reset to default company structure!");
    }
  };

  const handleClearAllHierarchy = () => {
    if (confirm("Are you sure you want to delete the entire hierarchy? You can create a new hierarchy anytime.")) {
      saveHierarchy([]);
      toast.success("All hierarchy data has been deleted.");
    }
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

  // Open Add Modal
  const handleOpenAddModal = (presetParentId?: string | null) => {
    setFormName("");
    setFormEmail("");
    setFormDesignation("");
    const defaultDept = currentRole === "ORG_ADMIN" && members.length === 0 ? "Management" : "HVAC";
    const defaultRole = currentRole === "ORG_ADMIN" && members.length === 0 ? "ORG_ADMIN" : "ENGINEER";
    setFormDepartment(defaultDept);
    setFormRole(defaultRole);
    setFormApprovalAuthority(
      ["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER"].includes(defaultRole) 
        ? "APPROVE_REJECT" 
        : defaultRole === "ENGINEER" 
        ? "REVIEW" 
        : "NONE"
    );
    setFormParentId(presetParentId !== undefined ? presetParentId : (visibleMembers[0]?.id || null));
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
    setFormApprovalAuthority(
      member.approvalAuthority ||
      (["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER"].includes(member.role)
        ? "APPROVE_REJECT"
        : member.role === "ENGINEER"
        ? "REVIEW"
        : "NONE")
    );
    setFormParentId(member.parentId);
    setIsAddModalOpen(true);
  };

  // Handle Form Submit (Add or Edit)
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.trim()) {
      toast.error("Please provide both name and email.");
      return;
    }

    const colorPalette = [
      "bg-indigo-600", "bg-blue-600", "bg-purple-600", 
      "bg-emerald-600", "bg-amber-600", "bg-teal-600", 
      "bg-rose-600", "bg-cyan-600", "bg-sky-600"
    ];

    if (editingMember) {
      // Update existing
      const updated = members.map((m) => {
        if (m.id === editingMember.id) {
          return {
            ...m,
            name: formName.trim(),
            email: formEmail.trim(),
            designation: formDesignation.trim() || "MEP Specialist",
            department: formDepartment,
            role: formRole,
            approvalAuthority: formApprovalAuthority,
            parentId: formParentId,
          };
        }
        return m;
      });
      saveHierarchy(updated);
      toast.success(`Updated ${formName} in hierarchy!`);
    } else {
      // Add new
      const newMember: HierarchyUser = {
        id: `usr-${Date.now()}`,
        name: formName.trim(),
        email: formEmail.trim(),
        designation: formDesignation.trim() || (formRole === "ORG_ADMIN" ? "Director of MEP Engineering" : "MEP Engineer"),
        department: formDepartment,
        role: formRole,
        approvalAuthority: formApprovalAuthority,
        parentId: formParentId,
        avatarColor: colorPalette[Math.floor(Math.random() * colorPalette.length)],
        status: "active"
      };
      saveHierarchy([...members, newMember]);
      toast.success(`Added ${newMember.name} to hierarchy!`);
    }

    setIsAddModalOpen(false);
  };

  // Delete Member
  const handleDeleteMember = (id: string, name: string) => {
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
      saveHierarchy(updated);
      toast.success(`Removed ${name} from hierarchy.`);
    }
  };

  const visibleMembers = useMemo(() => {
    if (members.length === 0) return [];
    if (currentRole === "SUPER_ADMIN") return members;

    // For ORG_ADMIN: Find their node based on email
    const emailToMatch = (userData?.email || profile?.email || "").toLowerCase().trim();
    let currentUserNode = members.find(m => m.email?.toLowerCase().trim() === emailToMatch);
    if (!currentUserNode) {
      // Fallback: look for ORG_ADMIN node
      currentUserNode = members.find(m => m.role === "ORG_ADMIN");
    }
    if (!currentUserNode) {
      // Fallback: look for top root node
      currentUserNode = members.find(m => m.parentId === null);
    }

    if (!currentUserNode) return [];

    const visibleIds = new Set<string>();
    const toProcess = [currentUserNode.id];

    while (toProcess.length > 0) {
      const currentId = toProcess.pop()!;
      if (!visibleIds.has(currentId)) {
        visibleIds.add(currentId);
        const children = members.filter(m => m.parentId === currentId).map(m => m.id);
        toProcess.push(...children);
      }
    }

    return members.filter(m => visibleIds.has(m.id));
  }, [members, currentRole, userData?.email, profile?.email]);

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

  // Root members (parentId is null or parent doesn't exist in visible set)
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
      subtitle={currentRole === "ORG_ADMIN" ? "Organization Admin & Team Hierarchy Builder" : "Super Admin & Organization Hierarchy Builder"}
      actions={
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Search Input */}
          <div className="relative w-48 sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search member, email, title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-full pl-8 pr-3 py-1.5 text-xs outline-none transition-all text-foreground"
            />
          </div>

          {/* Department Filter */}
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className="bg-surface-2 border border-border/80 text-foreground font-semibold rounded-full px-3 py-1.5 text-xs outline-none focus:border-primary cursor-pointer shrink-0"
          >
            <option value="ALL">All Departments</option>
            <option value="Management">Management</option>
            <option value="HVAC">HVAC Engineering</option>
            <option value="Electrical">Electrical Engineering</option>
            <option value="Plumbing">Plumbing Engineering</option>
            <option value="Fire Fighting">Fire Protection</option>
            <option value="BIM & IT">BIM & Technology</option>
          </select>

          {/* View Toggle */}
          <div className="flex bg-surface-2 p-0.5 rounded-full border border-border/80">
            <button
              onClick={() => setViewMode("tree")}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                viewMode === "tree"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <GitFork className="size-3.5 inline mr-1" /> Tree View
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="size-3.5 inline mr-1" /> List Grid
            </button>
          </div>

          {/* Add Member Button */}
          <button
            onClick={() => handleOpenAddModal(null)}
            className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-all shadow-xs cursor-pointer shrink-0"
            title="Add Team Member"
            aria-label="Add Team Member"
          >
            <UserPlus className="size-4" />
          </button>

          {/* Clear All Button */}
          {visibleMembers.length > 0 && (
            <button
              onClick={() => {
                setDeleteConfirmText("");
                setIsClearModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 border border-rose-500/20 hover:bg-rose-500/10 rounded-full transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Clear all hierarchy data"
            >
              <Trash2 className="size-3.5" /> Clear All
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col flex-1 h-full min-h-0 bg-slate-50/40 dark:bg-zinc-950/20 overflow-y-auto custom-scrollbar p-6 space-y-6">

        {/* EMPTY STATE COMPONENT WHEN NO HIERARCHY MEMBERS EXIST */}
        {visibleMembers.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-5 min-h-[460px]">
            <div className="size-20 rounded-3xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner border border-blue-500/20">
              <Network className="size-10" />
            </div>
            
            <div className="max-w-md space-y-2">
              <h3 className="text-xl font-extrabold text-foreground">No Hierarchy Configured</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {currentRole === "ORG_ADMIN" 
                  ? "As an Organization Admin, you can initialize a complete pre-built MEP engineering team structure or build your custom organization chart from scratch."
                  : "No hierarchy members are currently registered. You can initialize a default hierarchy or add members manually."
                }
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleCreateOrgHierarchy}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="size-4" /> Create Organization Hierarchy
              </button>
              
              <button
                onClick={() => handleOpenAddModal(null)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-surface-2 border border-border hover:bg-surface-3 text-foreground font-bold text-xs transition-all cursor-pointer"
              >
                <UserPlus className="size-4 text-primary" /> Add Root Member (Custom)
              </button>
            </div>

            <div className="pt-4 border-t border-border/60 text-[11px] text-muted-foreground flex items-center gap-2">
              <Shield className="size-3.5 text-blue-500" />
              <span>Standard template includes Lead PMs (HVAC, Electrical, Plumbing) & Senior Engineering Staff</span>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: VISUAL TREE HIERARCHY WITH 3D-VIEWER STYLE PAN & ZOOM CANVAS */}
            {viewMode === "tree" && (
              <div 
                ref={canvasRef}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className={`relative bg-card border border-border rounded-3xl shadow-sm overflow-hidden min-h-[580px] h-[calc(100vh-140px)] flex flex-col select-none ${
                  isPanning ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{
                  backgroundImage: "radial-gradient(circle, rgba(148, 163, 184, 0.22) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              >
                {/* Floating Canvas Navigation Controls (Bottom-Right) */}
                <div className="absolute bottom-5 right-5 z-30 flex items-center gap-1.5 bg-card/95 backdrop-blur-md border border-border p-1.5 rounded-2xl shadow-xl">
                  <button
                    onClick={handleZoomOut}
                    className="size-8 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground flex items-center justify-center transition-all cursor-pointer"
                    title="Zoom Out (Scroll Down)"
                  >
                    <ZoomOut className="size-4" />
                  </button>

                  <div 
                    onClick={handleResetZoom}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold text-foreground hover:text-primary cursor-pointer transition-colors select-none"
                    title="Click to reset zoom to 100%"
                  >
                    {Math.round(zoom * 100)}%
                  </div>

                  <button
                    onClick={handleZoomIn}
                    className="size-8 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground flex items-center justify-center transition-all cursor-pointer"
                    title="Zoom In (Scroll Up)"
                  >
                    <ZoomIn className="size-4" />
                  </button>

                  <div className="w-px h-5 bg-border/80 mx-0.5" />

                  <button
                    onClick={handleFitView}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Fit Entire Tree to Viewport"
                  >
                    <Scan className="size-3.5" /> Fit View
                  </button>

                  <button
                    onClick={handleResetZoom}
                    className="size-8 rounded-xl bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
                    title="Reset Position & Zoom"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                </div>

                {/* Floating Navigation Hint Pill (Top-Left) */}
                <div className="absolute top-4 left-4 z-20 pointer-events-none opacity-70 hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-xs border border-border/60 px-3 py-1.5 rounded-full text-[10.5px] font-semibold text-muted-foreground flex items-center gap-2 shadow-2xs">
                  <span>🖱️ Drag canvas to pan</span>
                  <span>•</span>
                  <span>🔍 Scroll wheel to zoom</span>
                  <span>•</span>
                  <span>⚡ Unlimited scale</span>
                </div>

                {/* Scalable Transform Canvas Content */}
                <div
                  ref={contentRef}
                  className="w-full h-full p-10 flex justify-center items-start transition-transform duration-75 ease-out origin-top"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
                    transformOrigin: "center top",
                  }}
                >
                  <div className="flex flex-col items-center min-w-max space-y-6 pb-36">
                    {rootMembers.length === 0 ? (
                      <div className="p-12 text-center text-muted-foreground text-sm space-y-3">
                        <p>No hierarchy members found matching query.</p>
                        {(searchQuery || selectedDept !== "ALL") && (
                          <button
                            onClick={() => {
                              setSearchQuery("");
                              setSelectedDept("ALL");
                            }}
                            className="px-4 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-full transition-all cursor-pointer"
                          >
                            Clear Search & Filters
                          </button>
                        )}
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
                </div>
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
                        <th className="py-3 px-4">Authority</th>
                        <th className="py-3 px-4">Reporting Manager</th>
                        <th className="py-3 px-4 text-center">Direct Reports</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredMembers.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-muted-foreground italic space-y-2">
                            <p>No team members found matching search query.</p>
                            {(searchQuery || selectedDept !== "ALL") && (
                              <button
                                onClick={() => {
                                  setSearchQuery("");
                                  setSelectedDept("ALL");
                                }}
                                className="px-3.5 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold rounded-full transition-all cursor-pointer mt-2 inline-block"
                              >
                                Clear Filters
                              </button>
                            )}
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
                                    {m.name.charAt(0)}
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
                              <td className="py-3 px-4">
                                <AuthorityBadge authority={m.approvalAuthority} />
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
          </>
        )}
      </div>

      {/* ADD / EDIT MEMBER MODAL */}
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
                    {editingMember ? "Edit Team Member" : "Add Team Member"}
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
                    onChange={(e) => {
                      const newRole = e.target.value as HierarchyUser["role"];
                      setFormRole(newRole);
                      if (["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER", "TEAM_LEADER", "DISCIPLINE_COORDINATOR"].includes(newRole)) {
                        setFormApprovalAuthority("APPROVE_REJECT");
                      } else if (["SR_DESIGN_ENGINEER", "ENGINEER", "BIM_COORDINATOR"].includes(newRole)) {
                        setFormApprovalAuthority("REVIEW");
                      } else {
                        setFormApprovalAuthority("NONE");
                      }
                    }}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer"
                  >
                    {currentRole === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Super Admin (CEO)</option>}
                    <option value="ORG_ADMIN">Org Admin (Director)</option>
                    <option value="PROJECT_MANAGER">Project Manager (PM)</option>
                    <option value="TEAM_LEADER">Team Leader</option>
                    <option value="DISCIPLINE_COORDINATOR">Discipline Coordinator</option>
                    <option value="SR_DESIGN_ENGINEER">Sr. Design Engineer</option>
                    <option value="DESIGN_ENGINEER">Design Engineer</option>
                    <option value="JR_DESIGN_ENGINEER">Jr. Design Engg</option>
                    <option value="BIM_COORDINATOR">BIM Coordinator</option>
                    <option value="BIM_MODELER">BIM Modeler</option>
                    <option value="DRAFTSMAN_2D">2D Draftsman</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="CLIENT">Client</option>
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
                    {(currentRole === "ORG_ADMIN" ? visibleMembers : members)
                      .filter((m) => !editingMember || m.id !== editingMember.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.designation})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">
                  Review & Approval Authority
                </label>
                <select
                  value={formApprovalAuthority}
                  onChange={(e) => setFormApprovalAuthority(e.target.value as ApprovalAuthority)}
                  className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer"
                >
                  <option value="NONE">None</option>
                  <option value="REVIEW">Review</option>
                  <option value="APPROVE_REJECT">Approve / Reject</option>
                </select>
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
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <RoleBadge role={member.role} />
            <AuthorityBadge authority={member.approvalAuthority} />
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
            {member.name.charAt(0)}
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
          <Briefcase className="size-3" /> Project Manager
        </span>
      );
    case "TEAM_LEADER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 uppercase tracking-wider flex items-center gap-1">
          <Users className="size-3" /> Team Leader
        </span>
      );
    case "DISCIPLINE_COORDINATOR":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider flex items-center gap-1">
          <Layers className="size-3" /> Discipline Coordinator
        </span>
      );
    case "SR_DESIGN_ENGINEER":
    case "ENGINEER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider flex items-center gap-1">
          <UserCheck className="size-3" /> Sr. Design Engineer
        </span>
      );
    case "DESIGN_ENGINEER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 uppercase tracking-wider flex items-center gap-1">
          <User className="size-3" /> Design Engineer
        </span>
      );
    case "JR_DESIGN_ENGINEER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 uppercase tracking-wider flex items-center gap-1">
          <User className="size-3" /> Jr. Design Engg
        </span>
      );
    case "BIM_COORDINATOR":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/20 uppercase tracking-wider flex items-center gap-1">
          <Building2 className="size-3" /> BIM Coordinator
        </span>
      );
    case "BIM_MODELER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1">
          <Network className="size-3" /> BIM Modeler
        </span>
      );
    case "DRAFTSMAN_2D":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20 uppercase tracking-wider flex items-center gap-1">
          <Edit3 className="size-3" /> 2D Draftsman
        </span>
      );
    case "VIEWER":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 uppercase tracking-wider flex items-center gap-1">
          <Eye className="size-3" /> Viewer
        </span>
      );
    case "CLIENT":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase tracking-wider flex items-center gap-1">
          <Briefcase className="size-3" /> Client
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

// Sub-component: Authority Badge
function AuthorityBadge({ authority }: { authority?: ApprovalAuthority }) {
  const auth = authority || "NONE";
  switch (auth) {
    case "APPROVE_REJECT":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider flex items-center gap-1" title="Can review, approve or reject calculation sheets">
          <ShieldCheck className="size-3" /> Approve / Reject
        </span>
      );
    case "REVIEW":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 uppercase tracking-wider flex items-center gap-1" title="Can review calculation sheets">
          <UserCheck className="size-3" /> Review
        </span>
      );
    case "NONE":
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-medium bg-slate-500/10 text-muted-foreground border border-slate-500/20 uppercase tracking-wider flex items-center gap-1" title="No review or approval authority">
          None
        </span>
      );
  }
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  Network, Users, Plus, Shield, ShieldAlert, ShieldCheck, Mail, Trash2, Edit3, 
  ChevronDown, ChevronRight, Search, Sparkles, Save, RefreshCw, 
  Layers, Briefcase, Building2, UserCheck, UserPlus, GitFork, Crown,
  User, Check, ArrowRight, Eye, ZoomIn, ZoomOut, RotateCcw, Scan, Move, Maximize2,
  AlertTriangle
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
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

export function normalizeHierarchyRole(role?: string | null): HierarchyRole {
  if (!role) return "USER";
  const r = String(role).toUpperCase().replace(/[\s.-]/g, "_").trim();
  if (r.includes("SUPER_ADMIN") || r.includes("CEO")) return "SUPER_ADMIN";
  if (r.includes("ORG_ADMIN") || r.includes("DIRECTOR")) return "ORG_ADMIN";
  if (r.includes("PROJECT_MANAGER") || r.includes("LEAD_PM") || r.includes("PM")) return "PROJECT_MANAGER";
  if (r.includes("TEAM_LEAD")) return "TEAM_LEADER";
  if (r.includes("DISCIPLINE_COORDINATOR")) return "DISCIPLINE_COORDINATOR";
  if (r.includes("SR_DESIGN") || r.includes("SENIOR_DESIGN") || r.includes("SENIOR_ENGINEER") || r.includes("SR_ENGINEER") || r === "SR") return "SR_DESIGN_ENGINEER";
  if (r.includes("JR_DESIGN") || r.includes("JUNIOR_DESIGN") || r.includes("JUNIOR_ENGINEER") || r.includes("JR_ENGINEER") || r === "JR") return "JR_DESIGN_ENGINEER";
  if (r.includes("DESIGN_ENGINEER") || r === "ENGINEER") return "DESIGN_ENGINEER";
  if (r.includes("BIM_COORD")) return "BIM_COORDINATOR";
  if (r.includes("BIM_MODEL")) return "BIM_MODELER";
  if (r.includes("DRAFTSMAN") || r.includes("2D")) return "DRAFTSMAN_2D";
  if (r.includes("VIEWER")) return "VIEWER";
  if (r.includes("CLIENT")) return "CLIENT";
  return "USER";
}

export const ROLE_TITLE_MAP: Record<string, string> = {
  SUPER_ADMIN: "Super Admin (CEO)",
  ORG_ADMIN: "Director of MEP Engineering",
  PROJECT_MANAGER: "Lead Project Manager",
  TEAM_LEADER: "Team Leader",
  DISCIPLINE_COORDINATOR: "Discipline Coordinator",
  SR_DESIGN_ENGINEER: "Sr. Design Engineer",
  DESIGN_ENGINEER: "Design Engineer",
  JR_DESIGN_ENGINEER: "Jr. Design Engineer",
  BIM_COORDINATOR: "BIM Coordinator",
  BIM_MODELER: "BIM Modeler",
  DRAFTSMAN_2D: "2D Draftsman",
  VIEWER: "Viewer",
  CLIENT: "Client",
  ENGINEER: "Design Engineer",
  USER: "Jr. Design Engineer"
};

export function getMemberDisplayDesignation(member: HierarchyUser): string {
  const normRole = normalizeHierarchyRole(member.role);
  const expectedTitle = ROLE_TITLE_MAP[normRole] || ROLE_TITLE_MAP[member.role] || member.role;
  if (!member.designation || member.designation === "USER" || member.designation === "ENGINEER") {
    return expectedTitle;
  }
  const normDesig = normalizeHierarchyRole(member.designation);
  if (normDesig !== "USER" && normDesig !== normRole) {
    return expectedTitle;
  }
  const allStandardTitles = Object.values(ROLE_TITLE_MAP);
  if (allStandardTitles.includes(member.designation) && member.designation !== expectedTitle) {
    return expectedTitle;
  }
  return member.designation;
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
  
  // Access check: Open to everyone in the organization
  const isAuthorized = true;

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
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Form State
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formDesignation, setFormDesignation] = useState("");
  const [formDepartment, setFormDepartment] = useState<HierarchyUser["department"]>("HVAC");
  const [formRole, setFormRole] = useState<HierarchyUser["role"]>("ENGINEER");
  const [formApprovalAuthority, setFormApprovalAuthority] = useState<ApprovalAuthority>("NONE");
  const [formParentId, setFormParentId] = useState<string | null>(null);

  // Organization Users Auto-Suggest State
  const [orgUsersList, setOrgUsersList] = useState<any[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadOrgUsers = async () => {
      try {
        let fetchedUsers = await api.getOrgUsers().catch(() => []);
        if (!fetchedUsers || fetchedUsers.length === 0) {
          fetchedUsers = await api.getUsers().catch(() => []);
        }
        
        const combined = new Map<string, any>();
        
        // Also merge local users cache if available
        try {
          const raw = localStorage.getItem("mep_local_users");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              parsed.forEach((u: any) => {
                if (u && u.email) combined.set(String(u.email).toLowerCase().trim(), u);
              });
            }
          }
        } catch (e) {}

        (fetchedUsers || []).forEach((u: any) => {
          if (u && u.email) {
            const existing = combined.get(String(u.email).toLowerCase().trim());
            combined.set(String(u.email).toLowerCase().trim(), { ...(existing || {}), ...u });
          }
        });

        let finalUsers = Array.from(combined.values());
        if (currentRole === "ORG_ADMIN") {
          finalUsers = finalUsers.filter((u: any) => u.role !== 'SUPER_ADMIN' && u.email !== 'admin@tarv.ai');
        }

        if (isMounted) {
          setOrgUsersList(finalUsers);
        }
      } catch (e) {
        console.error("Failed to load org users:", e);
      }
    };
    loadOrgUsers();

    const handleProfileUpdated = (e: any) => {
      loadOrgUsers();
      const targetId = String(e?.detail?.profileId || e?.detail?.updates?.email || e?.detail?.updates?.id || '').toLowerCase().trim();
      const rawNewRole = e?.detail?.updates?.role || e?.detail?.role;
      const newRole = rawNewRole ? normalizeHierarchyRole(rawNewRole) : undefined;
      const newDesignation = e?.detail?.updates?.designation || (newRole ? (ROLE_TITLE_MAP[newRole] || newRole) : undefined);
      const newName = e?.detail?.updates?.name;
      const newDept = e?.detail?.updates?.department;

      if (targetId) {
        setMembers(prev => {
          let changed = false;
          const next = prev.map(m => {
            const mEmail = String(m.email || '').toLowerCase().trim();
            const mId = String(m.id || '').toLowerCase().trim();
            if (mEmail === targetId || mId === targetId) {
              changed = true;
              const updatedRole = newRole || m.role;
              const updatedDesignation = newDesignation || (newRole ? (ROLE_TITLE_MAP[newRole] || newRole) : undefined) || m.designation;
              return {
                ...m,
                ...(newName ? { name: newName } : {}),
                ...(updatedRole ? { role: updatedRole } : {}),
                ...(updatedDesignation ? { designation: updatedDesignation } : {}),
                ...(newDept ? { department: newDept } : {})
              };
            }
            return m;
          });
          if (changed && typeof window !== 'undefined') {
            try { localStorage.setItem("mep_company_hierarchy", JSON.stringify(next)); } catch (err) {}
          }
          return changed ? next : prev;
        });
      }
    };

    window.addEventListener('mep_user_profile_updated', handleProfileUpdated);
    window.addEventListener('storage', loadOrgUsers);

    return () => { 
      isMounted = false;
      window.removeEventListener('mep_user_profile_updated', handleProfileUpdated);
      window.removeEventListener('storage', loadOrgUsers);
    };
  }, [currentRole]);

  // Suggestions for Email Address input
  const emailSuggestions = useMemo(() => {
    if (!formEmail.trim()) {
      return orgUsersList;
    }
    const q = formEmail.toLowerCase().trim();
    return orgUsersList.filter((u: any) => 
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q))
    );
  }, [orgUsersList, formEmail]);

  // Suggestions for Name input
  const nameSuggestions = useMemo(() => {
    if (!formName.trim()) {
      return orgUsersList;
    }
    const q = formName.toLowerCase().trim();
    return orgUsersList.filter((u: any) => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q))
    );
  }, [orgUsersList, formName]);

  const handleSelectOrgUser = (user: any) => {
    if (user.email) setFormEmail(user.email);
    if (user.name) setFormName(user.name);

    let mappedRole: HierarchyRole = "ENGINEER";
    if (user.role) {
      const rLower = String(user.role).toLowerCase();
      if (rLower.includes("super admin") || rLower === "super_admin") mappedRole = "SUPER_ADMIN";
      else if (rLower.includes("org admin") || rLower.includes("director") || rLower === "org_admin") mappedRole = "ORG_ADMIN";
      else if (rLower.includes("pm") || rLower.includes("manager") || rLower.includes("lead")) mappedRole = "PROJECT_MANAGER";
      else if (rLower.includes("team leader")) mappedRole = "TEAM_LEADER";
      else if (rLower.includes("coordinator") && rLower.includes("bim")) mappedRole = "BIM_COORDINATOR";
      else if (rLower.includes("discipline coordinator")) mappedRole = "DISCIPLINE_COORDINATOR";
      else if (rLower.includes("sr") || rLower.includes("senior")) mappedRole = "SR_DESIGN_ENGINEER";
      else if (rLower.includes("jr") || rLower.includes("junior")) mappedRole = "JR_DESIGN_ENGINEER";
      else if (rLower.includes("modeler")) mappedRole = "BIM_MODELER";
      else if (rLower.includes("draftsman") || rLower.includes("2d")) mappedRole = "DRAFTSMAN_2D";
      else if (rLower.includes("viewer")) mappedRole = "VIEWER";
      else if (rLower.includes("client")) mappedRole = "CLIENT";
      else mappedRole = "ENGINEER";
    }

    setFormRole(mappedRole);
    const cleanTitle = user.designation || ROLE_TITLE_MAP[mappedRole] || "Design Engineer";
    setFormDesignation(cleanTitle);

    if (["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER", "TEAM_LEADER", "DISCIPLINE_COORDINATOR"].includes(mappedRole)) {
      setFormApprovalAuthority("APPROVE_REJECT");
    } else if (["SR_DESIGN_ENGINEER", "ENGINEER", "BIM_COORDINATOR"].includes(mappedRole)) {
      setFormApprovalAuthority("REVIEW");
    } else {
      setFormApprovalAuthority("NONE");
    }

    if (user.department && ["Management", "HVAC", "Electrical", "Plumbing", "Fire Fighting", "BIM & IT"].includes(user.department)) {
      setFormDepartment(user.department);
    } else if (user.role) {
      const r = String(user.role).toLowerCase();
      if (r.includes("hvac") || r.includes("mechanical")) setFormDepartment("HVAC");
      else if (r.includes("elec")) setFormDepartment("Electrical");
      else if (r.includes("plumb") || r.includes("drain")) setFormDepartment("Plumbing");
      else if (r.includes("fire")) setFormDepartment("Fire Fighting");
      else if (r.includes("bim") || r.includes("model")) setFormDepartment("BIM & IT");
    }

    setShowEmailSuggestions(false);
    setShowNameSuggestions(false);
  };

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
    setIsResetModalOpen(false);
  };

  const handleClearAllHierarchy = () => {
    saveHierarchy([]);
    setIsClearModalOpen(false);
    setDeleteConfirmText("");
    toast.success("All hierarchy data has been deleted.");
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
    setShowEmailSuggestions(false);
    setShowNameSuggestions(false);
    const defaultDept = currentRole === "ORG_ADMIN" && members.length === 0 ? "Management" : "HVAC";
    const defaultRole: HierarchyRole = currentRole === "ORG_ADMIN" && members.length === 0 ? "ORG_ADMIN" : "DESIGN_ENGINEER";
    setFormDepartment(defaultDept);
    setFormRole(defaultRole);
    setFormDesignation(ROLE_TITLE_MAP[defaultRole] || "Design Engineer");
    setFormApprovalAuthority(
      ["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER", "TEAM_LEADER", "DISCIPLINE_COORDINATOR"].includes(defaultRole) 
        ? "APPROVE_REJECT" 
        : ["SR_DESIGN_ENGINEER", "ENGINEER", "BIM_COORDINATOR"].includes(defaultRole) 
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
    setFormRole(member.role);
    setFormDepartment(member.department);
    const defaultTitle = ROLE_TITLE_MAP[member.role] || member.role;
    setFormDesignation(member.designation || defaultTitle);
    setShowEmailSuggestions(false);
    setShowNameSuggestions(false);
    setFormApprovalAuthority(
      member.approvalAuthority ||
      (["SUPER_ADMIN", "ORG_ADMIN", "PROJECT_MANAGER", "TEAM_LEADER", "DISCIPLINE_COORDINATOR"].includes(member.role)
        ? "APPROVE_REJECT"
        : ["SR_DESIGN_ENGINEER", "ENGINEER", "BIM_COORDINATOR"].includes(member.role)
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

    const targetEmail = formEmail.trim();
    const targetName = formName.trim();
    const targetRole = normalizeHierarchyRole(formRole);
    const targetDesignation = formDesignation.trim() || ROLE_TITLE_MAP[targetRole] || "MEP Engineer";
    const targetDepartment = formDepartment;
    const targetAuthority = formApprovalAuthority;

    if (editingMember) {
      // Update existing
      const updated = members.map((m) => {
        if (m.id === editingMember.id || (m.email && m.email.toLowerCase().trim() === targetEmail.toLowerCase().trim())) {
          return {
            ...m,
            name: targetName,
            email: targetEmail,
            designation: targetDesignation,
            department: targetDepartment,
            role: targetRole,
            approvalAuthority: targetAuthority,
            parentId: formParentId,
          };
        }
        return m;
      });
      saveHierarchy(updated);
      toast.success(`Updated ${targetName} (${targetDesignation}) in hierarchy!`);
    } else {
      // Add new
      const newMember: HierarchyUser = {
        id: `usr-${Date.now()}`,
        name: targetName,
        email: targetEmail,
        designation: targetDesignation,
        department: targetDepartment,
        role: targetRole,
        approvalAuthority: targetAuthority,
        parentId: formParentId,
        avatarColor: colorPalette[Math.floor(Math.random() * colorPalette.length)],
        status: "active"
      };
      saveHierarchy([...members, newMember]);
      toast.success(`Added ${newMember.name} (${targetDesignation}) to hierarchy!`);
    }

    // Synchronize to backend profile & local stores
    const profileUpdates = {
      name: targetName,
      email: targetEmail,
      designation: targetDesignation,
      role: targetRole,
      department: targetDepartment
    };

    api.adminUpdateProfile(targetEmail, profileUpdates).catch(err => {
      console.warn("adminUpdateProfile background sync warning:", err);
    });

    api.adminToggleRole(targetEmail, targetRole).catch(err => {
      console.warn("adminToggleRole background sync warning:", err);
    });

    // Update local user registry & org user suggestions list directly
    try {
      const storedUsers = localStorage.getItem('mep_local_users');
      if (storedUsers) {
        const parsedUsers = JSON.parse(storedUsers);
        const updatedUsers = parsedUsers.map((u: any) => {
          const uEmail = String(u.email || '').toLowerCase().trim();
          const uId = String(u.id || '').toLowerCase().trim();
          if (uEmail === targetEmail.toLowerCase().trim() || uId === targetEmail.toLowerCase().trim()) {
            return {
              ...u,
              name: targetName,
              role: targetRole,
              designation: targetDesignation,
              features: {
                ...(u.features || {}),
                role: targetRole,
                designation: targetDesignation
              }
            };
          }
          return u;
        });
        localStorage.setItem('mep_local_users', JSON.stringify(updatedUsers));
        localStorage.setItem('cachedAllUsers', JSON.stringify(updatedUsers));
      }
      setOrgUsersList(prev => prev.map(u => {
        const uEmail = String(u.email || '').toLowerCase().trim();
        const uId = String(u.id || '').toLowerCase().trim();
        if (uEmail === targetEmail.toLowerCase().trim() || uId === targetEmail.toLowerCase().trim()) {
          return {
            ...u,
            name: targetName,
            role: targetRole,
            designation: targetDesignation
          };
        }
        return u;
      }));
    } catch (e) {}

    // If current user, update localStorage session cache immediately
    const isTargetCurrentUser = 
      (currentUserEmail && targetEmail.toLowerCase() === currentUserEmail.toLowerCase()) ||
      (currentUserName && targetName.toLowerCase() === currentUserName.toLowerCase()) ||
      (userData?.email && targetEmail.toLowerCase() === userData.email.toLowerCase()) ||
      (userData?.name && targetName.toLowerCase() === userData.name.toLowerCase()) ||
      (profile?.email && targetEmail.toLowerCase() === profile.email.toLowerCase()) ||
      (profile?.name && targetName.toLowerCase() === profile.name.toLowerCase());

    if (isTargetCurrentUser) {
      if (typeof window !== "undefined") {
        try {
          const rawUserData = localStorage.getItem("mep_user_data") || localStorage.getItem("mep_calculator_user_data") || localStorage.getItem("mep_profile");
          if (rawUserData) {
            const parsed = JSON.parse(rawUserData);
            const updatedUser = {
              ...parsed,
              name: targetName,
              designation: targetDesignation,
              role: targetRole,
              features: {
                ...(parsed.features || {}),
                designation: targetDesignation,
                role: targetRole
              }
            };
            const jsonStr = JSON.stringify(updatedUser);
            localStorage.setItem("mep_calculator_user_data", jsonStr);
            localStorage.setItem("mep_user_data", jsonStr);
            localStorage.setItem("mep_profile", jsonStr);
            if (parsed.id) {
              localStorage.setItem(`mep_user_designation_${parsed.id}`, targetDesignation);
            }
          }
        } catch (e) {}
      }
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep_user_profile_updated", {
        detail: {
          profileId: targetEmail,
          updates: profileUpdates
        }
      }));
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
      subtitle="Organization Role & Reporting Hierarchy Chart"
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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer shrink-0"
            title="Add Team Member"
            aria-label="Add Team Member"
          >
            <UserPlus className="size-3.5" /> <span>Add Member</span>
          </button>

          {/* Reset Default Template Button */}
          {visibleMembers.length > 0 && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground bg-surface-2 hover:bg-surface-3 border border-border/80 rounded-full transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Reset hierarchy to default MEP template"
            >
              <RefreshCw className="size-3.5 text-blue-500" /> Reset Default
            </button>
          )}

          {/* Clear All Button */}
          {visibleMembers.length > 0 && (
            <button
              onClick={() => {
                setDeleteConfirmText("");
                setIsClearModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-bold text-rose-500 hover:text-rose-600 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-full transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
              title="Clear all hierarchy data"
            >
              <Trash2 className="size-3.5" /> Clear All
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col flex-1 h-full min-h-0 w-full overflow-hidden p-2 sm:p-4">

        {/* EMPTY STATE COMPONENT WHEN NO HIERARCHY MEMBERS EXIST */}
        {visibleMembers.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-6 flex-1 h-full w-full min-h-0">
            <div className="size-24 rounded-3xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner border border-blue-500/20">
              <Network className="size-12" />
            </div>
            
            <div className="max-w-lg space-y-2.5">
              <h3 className="text-2xl font-extrabold text-foreground">No Hierarchy Configured</h3>
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
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                <Sparkles className="size-4" /> Create Organization Hierarchy
              </button>
              
              <button
                onClick={() => handleOpenAddModal(null)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-surface-2 border border-border hover:bg-surface-3 text-foreground font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <UserPlus className="size-4 text-primary" /> Add Root Member (Custom)
              </button>
            </div>

            <div className="pt-4 border-t border-border/60 text-xs text-muted-foreground flex items-center gap-2">
              <Shield className="size-4 text-blue-500" />
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
                className={`relative bg-card border border-border rounded-3xl shadow-sm overflow-hidden flex-1 h-full min-h-0 w-full flex flex-col select-none ${
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
              <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm flex-1 h-full min-h-0 flex flex-col">
                <div className="overflow-auto flex-1 h-full custom-scrollbar">
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
                              <td className="py-3 px-4 font-medium text-foreground">{getMemberDisplayDesignation(m)}</td>
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
              {/* Full Name input with auto-suggestions */}
              <div className="relative">
                <label className="font-bold text-foreground block mb-1">Full Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Kadam"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      setShowNameSuggestions(true);
                      setShowEmailSuggestions(false);
                    }}
                    onFocus={() => {
                      setShowNameSuggestions(true);
                      setShowEmailSuggestions(false);
                    }}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium text-foreground"
                  />
                  {formName && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormName("");
                        setShowNameSuggestions(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Name Auto-Suggest Dropdown */}
                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setShowNameSuggestions(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-card border border-border rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/50">
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-primary" /> Organization Members
                        </span>
                        <span>{nameSuggestions.length} found</span>
                      </div>
                      {nameSuggestions.map((u: any) => (
                        <button
                          key={u.id || u.email}
                          type="button"
                          onClick={() => handleSelectOrgUser(u)}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary/10 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {(u.name || u.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                                {u.name || u.email.split("@")[0]}
                              </span>
                              <span className="text-[10.5px] text-muted-foreground truncate">
                                {u.email}
                              </span>
                            </div>
                          </div>
                          {u.role && (
                            <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground shrink-0 border border-border/50 ml-2">
                              {u.role}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Email Address input with auto-suggestions */}
              <div className="relative">
                <label className="font-bold text-foreground block mb-1">Email Address *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="vikram@company.com"
                    value={formEmail}
                    onChange={(e) => {
                      setFormEmail(e.target.value);
                      setShowEmailSuggestions(true);
                      setShowNameSuggestions(false);
                    }}
                    onFocus={() => {
                      setShowEmailSuggestions(true);
                      setShowNameSuggestions(false);
                    }}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium text-foreground"
                  />
                  {formEmail && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormEmail("");
                        setShowEmailSuggestions(true);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs p-1"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Email Auto-Suggest Dropdown */}
                {showEmailSuggestions && emailSuggestions.length > 0 && (
                  <>
                    <div 
                      className="fixed inset-0 z-30" 
                      onClick={() => setShowEmailSuggestions(false)} 
                    />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-card border border-border rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center justify-between border-b border-border/50">
                        <span className="flex items-center gap-1">
                          <Users className="size-3 text-primary" /> Organization Members
                        </span>
                        <span>{emailSuggestions.length} found</span>
                      </div>
                      {emailSuggestions.map((u: any) => (
                        <button
                          key={u.id || u.email}
                          type="button"
                          onClick={() => handleSelectOrgUser(u)}
                          className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-primary/10 transition-colors text-left group cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="size-7 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                              {(u.name || u.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="font-bold text-foreground text-xs truncate group-hover:text-primary transition-colors">
                                {u.name || u.email.split("@")[0]}
                              </span>
                              <span className="text-[10.5px] text-muted-foreground truncate">
                                {u.email}
                              </span>
                            </div>
                          </div>
                          {u.role && (
                            <span className="text-[9.5px] font-semibold px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground shrink-0 border border-border/50 ml-2">
                              {u.role}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </>
                )}
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
                      const newTitle = ROLE_TITLE_MAP[newRole] || newRole;
                      setFormDesignation(newTitle);

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
                          {m.name} ({getMemberDisplayDesignation(m)})
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

      {/* CLEAR ALL HIERARCHY CONFIRMATION MODAL */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shrink-0">
                <Trash2 className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Clear Company Hierarchy?</h3>
                <p className="text-xs text-muted-foreground">This will remove all {visibleMembers.length} team members.</p>
              </div>
            </div>

            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 text-xs text-rose-600 dark:text-rose-400 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold">
                <AlertTriangle className="size-4 shrink-0" />
                <span>Warning: Irreversible Action</span>
              </div>
              <p className="text-[11px] leading-relaxed text-rose-600/90 dark:text-rose-400/90">
                All reporting lines, approvals, and member nodes will be cleared. You can start fresh or generate a default hierarchy template at any time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-surface-2 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearAllHierarchy}
                className="px-5 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Trash2 className="size-3.5" /> Clear All Members
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET DEFAULT TEMPLATE CONFIRMATION MODAL */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <RefreshCw className="size-5" />
              </div>
              <div>
                <h3 className="font-bold text-foreground text-base">Reset to Default Hierarchy?</h3>
                <p className="text-xs text-muted-foreground">Restore standard MEP engineering organization structure.</p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              This will replace the current structure with the standard MEP template (Lead Project Managers for HVAC, Electrical, and Plumbing & Fire Protection).
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:bg-surface-2 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="size-3.5" /> Reset to Template
              </button>
            </div>
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
            <span className="text-[11px] font-medium text-muted-foreground truncate">{getMemberDisplayDesignation(member)}</span>
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
function RoleBadge({ role }: { role?: HierarchyUser["role"] | string | null }) {
  const norm = normalizeHierarchyRole(role);
  switch (norm) {
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
      return (
        <span className="px-2 py-0.5 rounded-full text-[9.5px] font-extrabold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider flex items-center gap-1">
          <UserCheck className="size-3" /> Sr. Design Engineer
        </span>
      );
    case "DESIGN_ENGINEER":
    case "ENGINEER":
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

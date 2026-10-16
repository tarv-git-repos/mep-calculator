import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef, useCallback, useLayoutEffect } from "react";
import { 
  Network, Users, Plus, Shield, ShieldAlert, ShieldCheck, Mail, Trash2, Edit3, 
  ChevronDown, ChevronRight, Search, Sparkles, Save, RefreshCw, 
  Layers, Briefcase, Building2, UserCheck, UserPlus, GitFork, Crown,
  User, Check, ArrowRight, Eye, ZoomIn, ZoomOut, RotateCcw, Scan, Move, Maximize2,
  AlertTriangle, GripVertical
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { toast } from "sonner";
import { 
  getEffectiveOrgId,
  getOrgHierarchyStorageKey, 
  loadOrgHierarchyFromStorage, 
  saveOrgHierarchyToStorage,
  deduplicateHierarchyByEmail,
  getMemberParentIds,
  computeMemberLevels
} from "@/utils/hierarchy";

export const Route = createFileRoute("/company-hierarchy")({
  head: () => ({
    meta: [
      { title: "Company Hierarchy — MEP Calc" },
      { name: "description", content: "Organization Company Hierarchy & Multi-Manager Connectivity Chart" }
    ],
  }),
  component: CompanyHierarchyPage,
});

export type ApprovalAuthority = "REVIEW" | "APPROVE_REJECT" | "NONE" | "SUBMIT_TASK";

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
  parentId: string | null; // Primary manager ID
  parentIds?: string[];   // Multiple manager IDs
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

export function isDuplicateRoleBadge(member: HierarchyUser): boolean {
  const desig = (getMemberDisplayDesignation(member) || member.designation || "").toLowerCase().trim();
  const normRole = normalizeHierarchyRole(member.role);
  const roleTitle = (ROLE_TITLE_MAP[normRole] || ROLE_TITLE_MAP[member.role] || member.role || "").toLowerCase().trim();
  const rawRole = String(member.role || "").toLowerCase().trim();

  const cDesig = desig.replace(/[^a-z0-9]/g, "");
  const cRoleTitle = roleTitle.replace(/[^a-z0-9]/g, "");
  const cRawRole = rawRole.replace(/[^a-z0-9]/g, "");

  if (cDesig === cRoleTitle || cDesig === cRawRole) return true;
  if (cDesig.includes(cRoleTitle) || cRoleTitle.includes(cDesig)) return true;
  if (cDesig.includes(cRawRole) || cRawRole.includes(cDesig)) return true;

  const keywords = [
    "designengineer", "srdesignengineer", "jrdesignengineer",
    "seniordesignengineer", "juniordesignengineer", "srengineer", "jrengineer",
    "bimcoordinator", "bimmodeler", "disciplinecoordinator",
    "teamleader", "draftsman", "projectmanager", "leadprojectmanager",
    "directorofmepengineering", "superadmin"
  ];

  for (const kw of keywords) {
    if (cDesig.includes(kw) && (cRoleTitle.includes(kw) || cRawRole.includes(kw))) {
      return true;
    }
  }

  return false;
}

export interface NodePos {
  x: number;
  topY: number;
  bottomY: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

export function computeHierarchyPathD(
  line: { fromId: string; toId: string; x1: number; y1: number; x2: number; y2: number },
  coords: Map<string, NodePos>,
  levelMap: Map<string, number>,
  visibleMembers: HierarchyUser[]
): string {
  const fromLevel = levelMap.get(line.fromId);
  const toLevel = levelMap.get(line.toId);
  
  const { x1, y1, x2, y2 } = line;

  // Default curve for missing levels or adjacent level connection (fromLevel === toLevel + 1)
  if (fromLevel === undefined || toLevel === undefined || fromLevel <= toLevel + 1) {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2 + 6}`;
  }

  // Multi-level jump (fromLevel > toLevel + 1, e.g. Level 3 directly to Level 1)
  const interLevels: number[] = [];
  for (let l = fromLevel - 1; l > toLevel; l--) {
    interLevels.push(l);
  }

  // Group node positions by level
  const nodesByLevel = new Map<number, NodePos[]>();
  visibleMembers.forEach((m) => {
    const lvl = levelMap.get(m.id);
    if (lvl !== undefined && coords.has(m.id)) {
      if (!nodesByLevel.has(lvl)) nodesByLevel.set(lvl, []);
      nodesByLevel.get(lvl)!.push(coords.get(m.id)!);
    }
  });

  let currentX = x1;
  let currentY = y1;
  let pathString = `M ${x1} ${y1}`;

  for (let i = 0; i < interLevels.length; i++) {
    const lvl = interLevels[i];
    const lvlNodes = nodesByLevel.get(lvl) || [];

    if (lvlNodes.length === 0) continue;

    const minTopY = Math.min(...lvlNodes.map(n => n.topY));
    const maxBottomY = Math.max(...lvlNodes.map(n => n.bottomY));

    // Aisle below level lvl and aisle above level lvl
    const aisleBottomY = maxBottomY + 24;
    const aisleTopY = minTopY - 24;

    const margin = 16; // clearance margin around cards

    // Safe corridors through level lvl
    const sortedNodes = [...lvlNodes].sort((a, b) => a.left - b.left);
    const corridors: number[] = [];
    
    // Corridor left of leftmost card
    corridors.push(sortedNodes[0].left - 24);

    // Corridors between adjacent cards
    for (let j = 0; j < sortedNodes.length - 1; j++) {
      const gapLeft = sortedNodes[j].right;
      const gapRight = sortedNodes[j + 1].left;
      if (gapRight - gapLeft >= 8) {
        corridors.push((gapLeft + gapRight) / 2);
      }
    }

    // Corridor right of rightmost card
    corridors.push(sortedNodes[sortedNodes.length - 1].right + 24);

    // Check if currentX is already clear of all cards at level lvl
    const isCurrentXSafe = !lvlNodes.some(n => currentX >= (n.left - margin) && currentX <= (n.right + margin));
    
    let chosenX = currentX;
    if (!isCurrentXSafe) {
      // Pick corridor that minimizes total horizontal distance detour
      let bestDist = Infinity;
      corridors.forEach(cx => {
        const dist = Math.abs(cx - currentX) + Math.abs(cx - x2);
        if (dist < bestDist) {
          bestDist = dist;
          chosenX = cx;
        }
      });
    }

    // Curve 1: S-curve from (currentX, currentY) into aisleBottomY at chosenX
    const midY1 = (currentY + aisleBottomY) / 2;
    pathString += ` C ${currentX} ${midY1}, ${chosenX} ${midY1}, ${chosenX} ${aisleBottomY}`;
    
    // Straight vertical line through level lvl at chosenX (passing between or around cards)
    pathString += ` L ${chosenX} ${aisleTopY}`;

    currentX = chosenX;
    currentY = aisleTopY;
  }

  // Final curve into target manager bottom (x2, y2 + 6)
  const finalMidY = (currentY + y2) / 2;
  pathString += ` C ${currentX} ${finalMidY}, ${x2} ${finalMidY}, ${x2} ${y2 + 6}`;

  return pathString;
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
    parentIds: [],
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
    parentIds: ["usr-101"],
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
    parentIds: ["usr-101"],
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
    parentIds: ["usr-102"],
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
    parentIds: ["usr-102"],
    avatarColor: "bg-amber-600",
    status: "active"
  },
  {
    id: "usr-106",
    name: "Marcus Brody",
    email: "marcus.brody@mep-calc.com",
    designation: "Lead Plumbing & Fire PM",
    department: "Plumbing",
    role: "PROJECT_MANAGER",
    approvalAuthority: "APPROVE_REJECT",
    parentId: "usr-102",
    parentIds: ["usr-102"],
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
    parentIds: ["usr-104", "usr-102"], // Multi-manager: Lead HVAC PM + Director
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
    parentIds: ["usr-105", "usr-102"],
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
    parentIds: ["usr-106"],
    avatarColor: "bg-orange-600",
    status: "active"
  },
  {
    id: "usr-110",
    name: "Daniel Kim",
    email: "daniel.kim@mep-calc.com",
    designation: "HVAC Design Specialist",
    department: "HVAC",
    role: "ENGINEER",
    approvalAuthority: "REVIEW",
    parentId: "usr-107",
    parentIds: ["usr-107", "usr-104"],
    avatarColor: "bg-sky-600",
    status: "active"
  },
  {
    id: "usr-111",
    name: "Amina Zaidi",
    email: "amina.zaidi@mep-calc.com",
    designation: "BIM Specialist & Modeler",
    department: "BIM & IT",
    role: "ENGINEER",
    approvalAuthority: "REVIEW",
    parentId: "usr-103",
    parentIds: ["usr-103", "usr-105"],
    avatarColor: "bg-violet-600",
    status: "active"
  },
  {
    id: "usr-112",
    name: "Kevin Chen",
    email: "kevin.chen@mep-calc.com",
    designation: "Junior Plumbing Engineer",
    department: "Plumbing",
    role: "USER",
    approvalAuthority: "NONE",
    parentId: "usr-106",
    parentIds: ["usr-106", "usr-108"],
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
      parentIds: [],
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
      parentIds: [rootId],
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
      parentIds: [rootId],
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
      parentIds: [rootId],
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
      parentIds: ["usr-104", rootId], // Multi-manager connectivity
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
      parentIds: ["usr-105", rootId],
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
      parentIds: ["usr-106"],
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
      parentIds: ["usr-106", "usr-108"],
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
  
  const isAuthorized = true;
  const [members, setMembers] = useState<HierarchyUser[]>(() => {
    const loaded = loadOrgHierarchyFromStorage(userData, profile);
    if (loaded && loaded.length > 0) return deduplicateHierarchyByEmail(loaded);
    return deduplicateHierarchyByEmail(DEFAULT_ORG_ADMIN_HIERARCHY(currentUserName, currentUserEmail));
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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
    if ((e.target as HTMLElement).closest("button, input, select, a, textarea, [data-node-id]")) return;
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

  // Custom Card Repositioning State
  const [customPositions, setCustomPositions] = useState<Record<string, { x: number; y: number }>>(() => {
    if (typeof window !== "undefined") {
      try {
        const orgId = getEffectiveOrgId(userData, profile);
        const key = getOrgHierarchyStorageKey(userData, profile) + "_pos";
        const saved = localStorage.getItem(key);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return {};
  });

  const draggingNodeRef = useRef<{
    id: string;
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const handleNodeDragStart = useCallback((e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    e.stopPropagation();
    e.preventDefault();
    const currentPos = customPositions[nodeId] || { x: 0, y: 0 };
    draggingNodeRef.current = {
      id: nodeId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: currentPos.x,
      startPosY: currentPos.y,
    };
  }, [customPositions]);



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
  const [formParentIds, setFormParentIds] = useState<string[]>([]);

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

    const loadCloudHierarchy = async () => {
      try {
        const orgId = getEffectiveOrgId(userData, profile);
        const cloudHierarchy = await api.getOrgHierarchy(orgId).catch(() => null);
        if (cloudHierarchy && Array.isArray(cloudHierarchy) && cloudHierarchy.length > 0) {
          const dedupped = deduplicateHierarchyByEmail(cloudHierarchy);
          saveOrgHierarchyToStorage(dedupped, userData, profile);
          if (isMounted) setMembers(dedupped);
        }
      } catch (e) {}
    };

    loadOrgUsers();
    loadCloudHierarchy();

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
            const orgId = getEffectiveOrgId(userData, profile);
            saveOrgHierarchyToStorage(next, userData, profile);
            api.saveOrgHierarchy(next, orgId).catch(console.error);
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
    if (!formEmail.trim()) return orgUsersList;
    const q = formEmail.toLowerCase().trim();
    return orgUsersList.filter((u: any) => 
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.name && u.name.toLowerCase().includes(q))
    );
  }, [orgUsersList, formEmail]);

  // Suggestions for Name input
  const nameSuggestions = useMemo(() => {
    if (!formName.trim()) return orgUsersList;
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

  const saveHierarchy = (newMembers: HierarchyUser[]) => {
    const cleanMembers = deduplicateHierarchyByEmail(newMembers);
    const orgId = getEffectiveOrgId(userData, profile);
    setMembers(cleanMembers);
    saveOrgHierarchyToStorage(cleanMembers, userData, profile);
    api.saveOrgHierarchy(cleanMembers, orgId).catch(console.error);
  };

  const handleCreateOrgHierarchy = () => {
    if (currentRole === "ORG_ADMIN") {
      saveHierarchy(DEFAULT_ORG_ADMIN_HIERARCHY(currentUserName, currentUserEmail));
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
    setFormApprovalAuthority("NONE");
    const initialParents = presetParentId !== undefined ? (presetParentId ? [presetParentId] : []) : (members[0]?.id ? [members[0].id] : []);
    setFormParentIds(initialParents);
    setFormParentId(initialParents[0] || null);
    setEditingMember(null);
    setIsAddModalOpen(true);
  };

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
    setFormApprovalAuthority(member.approvalAuthority || "NONE");
    const pIds = getMemberParentIds(member);
    setFormParentIds(pIds);
    setFormParentId(pIds[0] || null);
    setIsAddModalOpen(true);
  };

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

    const existingIndex = members.findIndex((m) => {
      if (editingMember && m.id === editingMember.id) return true;
      const mEmail = String(m.email || "").toLowerCase().trim();
      const tEmail = targetEmail.toLowerCase().trim();
      return Boolean(tEmail && mEmail === tEmail);
    });

    if (existingIndex >= 0) {
      const updated = members.map((m, idx) => {
        if (idx === existingIndex) {
          return {
            ...m,
            name: targetName,
            email: targetEmail,
            designation: targetDesignation,
            department: targetDepartment,
            role: targetRole,
            approvalAuthority: targetAuthority,
            parentId: formParentIds[0] || null,
            parentIds: formParentIds,
          };
        }
        return m;
      });
      saveHierarchy(updated);
      toast.success(`Updated ${targetName} (${targetEmail}) in hierarchy!`);
    } else {
      const newMember: HierarchyUser = {
        id: `usr-${Date.now()}`,
        name: targetName,
        email: targetEmail,
        designation: targetDesignation,
        department: targetDepartment,
        role: targetRole,
        approvalAuthority: targetAuthority,
        parentId: formParentIds[0] || null,
        parentIds: formParentIds,
        avatarColor: colorPalette[Math.floor(Math.random() * colorPalette.length)],
        status: "active"
      };
      saveHierarchy([...members, newMember]);
      toast.success(`Added ${newMember.name} (${targetDesignation}) to hierarchy!`);
    }

    const profileUpdates = {
      name: targetName,
      email: targetEmail,
      designation: targetDesignation,
      role: targetRole,
      department: targetDepartment,
      approvalAuthority: targetAuthority
    };

    api.adminUpdateProfile(targetEmail, profileUpdates).catch(err => {
      console.warn("adminUpdateProfile background sync warning:", err);
    });

    api.adminToggleRole(targetEmail, targetRole).catch(err => {
      console.warn("adminToggleRole background sync warning:", err);
    });

    setIsAddModalOpen(false);
  };

  const handleDeleteMember = (id: string, name: string) => {
    if (confirm(`Are you sure you want to remove ${name} from the hierarchy?`)) {
      const target = members.find((m) => m.id === id);
      const targetParents = target ? getMemberParentIds(target) : [];

      const updated = members
        .filter((m) => m.id !== id)
        .map((m) => {
          const currentParents = getMemberParentIds(m);
          if (currentParents.includes(id)) {
            const nextParents = currentParents.filter((pId) => pId !== id);
            if (nextParents.length === 0 && targetParents.length > 0) {
              nextParents.push(...targetParents);
            }
            const cleanNext = Array.from(new Set(nextParents));
            return {
              ...m,
              parentId: cleanNext[0] || null,
              parentIds: cleanNext,
            };
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

  // Compute depth level groups for DAG tree canvas rendering
  const levelGroups = useMemo(() => {
    const levelMap = computeMemberLevels(visibleMembers);
    const groups = new Map<number, HierarchyUser[]>();

    visibleMembers.forEach((m) => {
      const lvl = levelMap.get(m.id) ?? 0;
      if (!groups.has(lvl)) groups.set(lvl, []);
      groups.get(lvl)!.push(m);
    });

    const sortedLevels = Array.from(groups.keys()).sort((a, b) => a - b);
    return sortedLevels.map((lvl) => ({
      level: lvl,
      members: groups.get(lvl)!,
    }));
  }, [visibleMembers]);

  // Dynamic SVG directed lines calculation between nodes
  const [lines, setLines] = useState<Array<{
    id: string;
    fromId: string;
    toId: string;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }>>([]);
  const [coordsMap, setCoordsMap] = useState<Map<string, NodePos>>(new Map());

  const levelMap = useMemo(() => computeMemberLevels(visibleMembers), [visibleMembers]);

  const updateLines = useCallback(() => {
    if (!contentRef.current) return;
    const container = contentRef.current;
    const containerRect = container.getBoundingClientRect();
    const nodeEls = container.querySelectorAll<HTMLElement>('[data-node-id]');

    const coords = new Map<string, NodePos>();
    const currentScale = zoom || 1;

    nodeEls.forEach((el) => {
      const id = el.getAttribute('data-node-id');
      if (!id) return;

      const elRect = el.getBoundingClientRect();

      const left = (elRect.left - containerRect.left) / currentScale;
      const top = (elRect.top - containerRect.top) / currentScale;
      const width = elRect.width / currentScale;
      const height = elRect.height / currentScale;

      coords.set(id, {
        x: left + width / 2,
        topY: top,
        bottomY: top + height,
        left,
        right: left + width,
        width,
        height,
      });
    });

    setCoordsMap(coords);

    const newLines: Array<{
      id: string;
      fromId: string;
      toId: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }> = [];

    visibleMembers.forEach((m) => {
      const pIds = getMemberParentIds(m);
      const subPos = coords.get(m.id);
      if (!subPos) return;

      pIds.forEach((pId) => {
        const mgrPos = coords.get(pId);
        if (!mgrPos) return;

        newLines.push({
          id: `${m.id}->${pId}`,
          fromId: m.id,
          toId: pId,
          x1: subPos.x,
          y1: subPos.topY,      // Subordinate top-center
          x2: mgrPos.x,
          y2: mgrPos.bottomY,   // Manager bottom-center
        });
      });
    });

    setLines(newLines);
  }, [visibleMembers, zoom]);

  useLayoutEffect(() => {
    updateLines();
    const t1 = setTimeout(updateLines, 50);
    const t2 = setTimeout(updateLines, 200);
    const t3 = setTimeout(updateLines, 500);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && contentRef.current) {
      ro = new ResizeObserver(() => updateLines());
      ro.observe(contentRef.current);
    }

    window.addEventListener("resize", updateLines);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", updateLines);
    };
  }, [updateLines, members, customPositions]);

  // Global drag listener for card movement (placed after updateLines declaration)
  useEffect(() => {
    let rafId: number | null = null;

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!draggingNodeRef.current) return;
      const { id, startMouseX, startMouseY, startPosX, startPosY } = draggingNodeRef.current;
      const currentZoom = zoom || 1;
      const dx = (e.clientX - startMouseX) / currentZoom;
      const dy = (e.clientY - startMouseY) / currentZoom;

      setCustomPositions((prev) => ({
        ...prev,
        [id]: {
          x: Math.round(startPosX + dx),
          y: Math.round(startPosY + dy),
        },
      }));

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateLines();
      });
    };

    const handleGlobalMouseUp = () => {
      if (!draggingNodeRef.current) return;
      draggingNodeRef.current = null;
      if (rafId) cancelAnimationFrame(rafId);
      updateLines();
      try {
        const key = getOrgHierarchyStorageKey(userData, profile) + "_pos";
        setCustomPositions((latest) => {
          localStorage.setItem(key, JSON.stringify(latest));
          return latest;
        });
      } catch (e) {}
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [zoom, userData, profile, updateLines]);

  const handleResetPositions = useCallback(() => {
    setCustomPositions({});
    try {
      const key = getOrgHierarchyStorageKey(userData, profile) + "_pos";
      localStorage.removeItem(key);
    } catch (e) {}
    toast.success("Reset custom card positions to auto layout!");
  }, [userData, profile]);

  const handleWorkflowAction = useCallback((action: string, member: HierarchyUser, managers: HierarchyUser[]) => {
    let title = "";
    let message = "";
    let recipients: string[] = [];
    
    if (action === "submit") {
      title = "Task Submitted";
      message = `${member.name} has submitted a task for review.`;
      recipients = managers.map(m => m.email);
      toast.success("Task submitted successfully. Managers notified.");
    } else if (action === "review") {
      title = "Task Reviewed & Commented";
      message = `${member.name} has reviewed the task and added comments.`;
      recipients = managers.map(m => m.email);
      toast.success("Task reviewed. Discipline Coordinator notified.");
    } else if (action === "approve" || action === "reject") {
      title = action === "approve" ? "Task Approved" : "Task Rejected";
      message = action === "approve" 
        ? `${member.name} has approved the task.` 
        : `${member.name} has rejected the task. Please revise.`;
      
      const children = members.filter(m => {
          const pIds = getMemberParentIds(m);
          return pIds.includes(member.id) || pIds.some(pid => {
              const parent = members.find(pm => pm.id === pid);
              return parent && getMemberParentIds(parent).includes(member.id);
          });
      });
      recipients = children.map(m => m.email);
      if (action === "approve") {
          toast.success("Task approved. Team notified.");
      } else {
          toast.error("Task rejected. Team notified.");
      }
    }

    recipients = Array.from(new Set(recipients));

    recipients.forEach(rEmail => {
      api.sendNotification({
        recipientId: rEmail,
        title,
        message,
        link: "/company-hierarchy",
        metadata: {
          targetId: member.id,
          targetType: "HierarchyTask",
          targetName: title
        }
      }).catch(e => console.error("Failed to notify", e));
    });
  }, [members]);


  return (
    <AppShell 
      title="Company Hierarchy" 
      subtitle="Organization Role & Reporting Hierarchy Connectivity Chart"
      actions={
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {viewMode === "table" && (
            <>
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
            </>
          )}

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

          <button
            onClick={() => handleOpenAddModal(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-xs cursor-pointer shrink-0"
            title="Add Team Member"
          >
            <UserPlus className="size-3.5" /> <span>Add Member</span>
          </button>

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
        {visibleMembers.length === 0 ? (
          <div className="bg-card border border-border rounded-3xl p-8 sm:p-12 shadow-sm text-center flex flex-col items-center justify-center space-y-6 flex-1 h-full w-full min-h-0">
            <div className="size-24 rounded-3xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-inner border border-blue-500/20">
              <Network className="size-12" />
            </div>
            
            <div className="max-w-lg space-y-2.5">
              <h3 className="text-2xl font-extrabold text-foreground">No Hierarchy Configured</h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Initialize a complete pre-built MEP engineering team hierarchy or add members to build custom organization connectivity.
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
                <UserPlus className="size-4 text-primary" /> Add Root Member
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* VIEW MODE 1: VISUAL TREE HIERARCHY WITH DIRECTED SVG CONNECTIVITY & PAN-ZOOM */}
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
                {/* Floating Canvas Controls */}
                <div className="absolute bottom-5 right-5 z-30 flex items-center gap-1.5 bg-card/95 backdrop-blur-md border border-border p-1.5 rounded-2xl shadow-xl">
                  <button
                    onClick={handleZoomOut}
                    className="size-8 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground flex items-center justify-center transition-all cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="size-4" />
                  </button>

                  <div 
                    onClick={handleResetZoom}
                    className="px-2.5 py-1 text-[11px] font-mono font-bold text-foreground hover:text-primary cursor-pointer transition-colors select-none"
                    title="Click to reset zoom"
                  >
                    {Math.round(zoom * 100)}%
                  </div>

                  <button
                    onClick={handleZoomIn}
                    className="size-8 rounded-xl bg-surface-2 hover:bg-surface-3 text-foreground flex items-center justify-center transition-all cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="size-4" />
                  </button>

                  <div className="w-px h-5 bg-border/80 mx-0.5" />

                  <button
                    onClick={handleFitView}
                    className="px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Fit View"
                  >
                    <Scan className="size-3.5" /> Fit View
                  </button>

                  <button
                    onClick={handleResetPositions}
                    className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Reset custom card positions to automatic layout"
                  >
                    <RotateCcw className="size-3.5 text-primary" /> Reset Layout
                  </button>

                  <button
                    onClick={handleResetZoom}
                    className="size-8 rounded-xl bg-surface-2 hover:bg-surface-3 text-muted-foreground hover:text-foreground flex items-center justify-center transition-all cursor-pointer"
                    title="Reset Zoom & Pan Position"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                </div>

                {/* Scalable Transform Canvas Content */}
                <div
                  ref={contentRef}
                  className="relative w-full h-full p-12 flex flex-col items-center min-w-max transition-transform duration-75 ease-out origin-top"
                  style={{
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0px) scale(${zoom})`,
                    transformOrigin: "center top",
                  }}
                >
                  {/* SVG Directed Connection Lines with Arrowheads */}
                  <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-10">
                    <defs>
                      <marker
                        id="hierarchy-arrowhead"
                        viewBox="0 0 10 10"
                        refX="6"
                        refY="5"
                        markerWidth="8"
                        markerHeight="8"
                        orient="auto"
                      >
                        <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="currentColor" />
                      </marker>
                    </defs>
                    {lines.map((line) => {
                      const isHovered = hoveredNodeId === line.fromId || hoveredNodeId === line.toId;
                      const isOutbound = line.fromId === hoveredNodeId;

                      const pathD = computeHierarchyPathD(line, coordsMap, levelMap, visibleMembers);

                      return (
                        <g key={line.id}>
                          {isHovered && (
                            <path
                              d={pathD}
                              fill="none"
                              stroke="#3b82f6"
                              strokeWidth={5}
                              strokeOpacity={0.35}
                              className="animate-pulse"
                            />
                          )}
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isHovered ? (isOutbound ? "#2563eb" : "#10b981") : "#64748b"}
                            strokeWidth={isHovered ? 2.5 : 1.8}
                            strokeDasharray={isHovered ? "6 3" : undefined}
                            markerEnd="url(#hierarchy-arrowhead)"
                            className={`transition-all duration-200 ${
                              isHovered
                                ? "opacity-100 text-blue-600 dark:text-blue-400"
                                : "opacity-60 text-slate-500 dark:text-slate-400"
                            }`}
                          />
                        </g>
                      );
                    })}
                  </svg>

                  {/* Level Tier Rows & Nodes */}
                  <div className="flex flex-col items-center space-y-24 relative z-20 pb-36 w-full">
                    {levelGroups.map((group, idx) => (
                      <div key={group.level} className="relative flex flex-col items-center w-full">
                        {/* Horizontal dashed level divider line (matching screenshot) */}
                        {idx > 0 && (
                          <div className="absolute -top-12 left-0 right-0 border-b-2 border-dashed border-border/40 w-full" />
                        )}

                        <div className="flex items-center justify-center gap-12 sm:gap-16 flex-wrap">
                          {group.members.map((member) => {
                            const parentIds = getMemberParentIds(member);
                            const managers = members.filter((p) => parentIds.includes(p.id));
                            return (
                              <div
                                key={member.id}
                                onMouseEnter={() => setHoveredNodeId(member.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                className="relative"
                              >
                                <NodeCard
                                  member={member}
                                  managers={managers}
                                  position={customPositions[member.id]}
                                  currentUserEmail={currentUserEmail}
                                  hasSubordinates={members.some(m => getMemberParentIds(m).includes(member.id))}
                                  onStartDrag={handleNodeDragStart}
                                  onAddReport={handleOpenAddModal}
                                  onEdit={handleOpenEditModal}
                                  onDelete={handleDeleteMember}
                                  onWorkflowAction={handleWorkflowAction}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
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
                        <th className="py-3 px-4">Reporting Managers</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredMembers.map((m) => {
                        const parentIds = getMemberParentIds(m);
                        const managers = members.filter((p) => parentIds.includes(p.id));
                        return (
                          <tr key={m.id} className="hover:bg-surface-2/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`size-8 rounded-full ${m.avatarColor || "bg-primary"} text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs`}>
                                  {m.name.charAt(0)}
                                </div>
                                <div className="flex flex-col min-w-0">
                                  <span className="font-bold text-foreground text-xs truncate">{m.name}</span>
                                  <span className="text-[10px] text-muted-foreground truncate">{m.email}</span>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-foreground">{getMemberDisplayDesignation(m)}</td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10.5px] font-bold bg-primary/10 text-primary border border-primary/20">
                                {m.department}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {managers.length === 0 ? (
                                <span className="text-amber-600 dark:text-amber-400 font-bold text-[10.5px] flex items-center gap-1">
                                  <Crown className="size-3" /> Top Leader
                                </span>
                              ) : (
                                <div className="flex flex-wrap items-center gap-1 font-medium text-foreground">
                                  <User className="size-3.5 text-muted-foreground shrink-0 mr-0.5" />
                                  {managers.map((mgr) => (
                                    <span key={mgr.id} className="px-2 py-0.5 rounded-full text-[10.5px] bg-surface-2 border border-border/60 text-foreground font-semibold">
                                      {mgr.name}
                                    </span>
                                  ))}
                                </div>
                              )}
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
                                  title="Edit Role & Managers"
                                >
                                  <Edit3 className="size-3.5" />
                                </button>
                                {parentIds.length > 0 && (
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
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ADD / EDIT MEMBER MODAL WITH MULTI-MANAGER CHECKLIST */}
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
                  <p className="text-xs text-muted-foreground">Define role, authority, and multi-manager reporting connectivity.</p>
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
              <div className="relative">
                <label className="font-bold text-foreground block mb-1">Full Name *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
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

                {showNameSuggestions && nameSuggestions.length > 0 && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowNameSuggestions(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-card border border-border rounded-2xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1 animate-in fade-in zoom-in-95 duration-100">
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
                              <span className="text-[10.5px] text-muted-foreground truncate">{u.email}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="relative">
                <label className="font-bold text-foreground block mb-1">Email Address *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="rahul@company.com"
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
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Designation / Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Lead HVAC Engineer"
                    value={formDesignation}
                    onChange={(e) => setFormDesignation(e.target.value)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Department</label>
                  <select
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value as any)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium text-foreground cursor-pointer"
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
                    }}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium text-foreground cursor-pointer"
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
                  <label className="font-bold text-foreground block mb-1">Approval Authority</label>
                  <select
                    value={formApprovalAuthority}
                    onChange={(e) => setFormApprovalAuthority(e.target.value as ApprovalAuthority)}
                    className="w-full bg-surface-2 border border-border/80 focus:border-primary rounded-xl px-3.5 py-2.5 outline-none font-medium text-foreground cursor-pointer"
                  >
                    <option value="NONE">None</option>
                    <option value="REVIEW">Review</option>
                    <option value="APPROVE_REJECT">Approve / Reject</option>
                    <option value="SUBMIT_TASK">Submit Task</option>
                  </select>
                </div>
              </div>

              {/* Multi-Manager Reporting Connectivity Selector */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-foreground block">
                    Reporting Manager(s) <span className="text-primary font-bold">({formParentIds.length} selected)</span>
                  </label>
                  {formParentIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormParentIds([]);
                        setFormParentId(null);
                      }}
                      className="text-[10.5px] text-rose-500 hover:text-rose-600 font-bold cursor-pointer"
                    >
                      Clear Managers
                    </button>
                  )}
                </div>

                {formParentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2 p-1.5 bg-surface-2 border border-border/60 rounded-xl">
                    {formParentIds.map((pId) => {
                      const mgr = members.find((m) => m.id === pId);
                      return (
                        <span key={pId} className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-primary/10 text-primary border border-primary/20">
                          <span>{mgr ? mgr.name : pId}</span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = formParentIds.filter((id) => id !== pId);
                              setFormParentIds(next);
                              setFormParentId(next[0] || null);
                            }}
                            className="hover:text-rose-500 transition-colors ml-0.5 cursor-pointer font-extrabold"
                          >
                            ✕
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="bg-surface-2 border border-border/80 rounded-xl p-1.5 max-h-36 overflow-y-auto custom-scrollbar space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setFormParentIds([]);
                      setFormParentId(null);
                    }}
                    className={`w-full text-left px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      formParentIds.length === 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold" : "hover:bg-surface-3 text-muted-foreground"
                    }`}
                  >
                    <span>No Manager (Top Leader)</span>
                    {formParentIds.length === 0 && <Check className="size-3.5" />}
                  </button>
                  {members
                    .filter((m) => !editingMember || m.id !== editingMember.id)
                    .map((m) => {
                      const isSelected = formParentIds.includes(m.id);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            const next = isSelected ? formParentIds.filter((id) => id !== m.id) : [...formParentIds, m.id];
                            setFormParentIds(next);
                            setFormParentId(next[0] || null);
                          }}
                          className={`w-full text-left px-2.5 py-1 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? "bg-primary/10 text-primary font-bold border border-primary/20"
                              : "hover:bg-surface-3 text-foreground font-medium"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`size-5 rounded-full ${m.avatarColor || "bg-primary"} text-white flex items-center justify-center font-bold text-[9.5px] shrink-0`}>
                              {m.name.charAt(0)}
                            </div>
                            <span className="truncate">{m.name} ({getMemberDisplayDesignation(m)})</span>
                          </div>
                          {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                        </button>
                      );
                    })}
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
    </AppShell>
  );
}

// Node Card Component for DAG Layout
const DEPARTMENT_META: Record<string, { badge: string; dot: string }> = {
  Management: {
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    dot: "bg-purple-500",
  },
  HVAC: {
    badge: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    dot: "bg-sky-500",
  },
  Electrical: {
    badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  Plumbing: {
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
  },
  "Fire Fighting": {
    badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    dot: "bg-rose-500",
  },
  "BIM & IT": {
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
};

// Modern, Attractive Node Card Component for Visual Hierarchy Tree
function NodeCard({
  member,
  managers,
  position,
  currentUserEmail,
  hasSubordinates,
  onStartDrag,
  onAddReport,
  onEdit,
  onDelete,
}: {
  member: HierarchyUser;
  managers: HierarchyUser[];
  position?: { x: number; y: number };
  currentUserEmail?: string;
  hasSubordinates?: boolean;
  onStartDrag: (e: React.MouseEvent, id: string) => void;
  onAddReport: (parentId: string) => void;
  onEdit: (m: HierarchyUser) => void;
  onDelete: (id: string, name: string) => void;
  onWorkflowAction?: (action: string, member: HierarchyUser, managers: HierarchyUser[]) => void;
}) {
  const displayTitle = getMemberDisplayDesignation(member);
  const parentIds = getMemberParentIds(member);
  const isMoved = Boolean(position && (position.x !== 0 || position.y !== 0));
  const isCurrentUser = member.email.toLowerCase().trim() === (currentUserEmail || "").toLowerCase().trim();
  const isRootLeader = parentIds.length === 0;

  const deptMeta = DEPARTMENT_META[member.department] || {
    badge: "bg-primary/10 text-primary border-primary/20",
    dot: "bg-primary",
  };

  const tooltipTitle = managers.length > 0
    ? `${member.name} (${displayTitle}) • Department: ${member.department}`
    : `${member.name} (${displayTitle}) • Organization Head`;

  return (
    <div
      data-node-id={member.id}
      onMouseDown={(e) => onStartDrag(e, member.id)}
      style={{
        transform: position ? `translate3d(${position.x}px, ${position.y}px, 0px)` : undefined,
      }}
      title={tooltipTitle}
      className={`group relative bg-card/95 hover:bg-card border p-4 rounded-2xl shadow-xs hover:shadow-xl transition-all duration-200 w-72 flex flex-col gap-3 select-none cursor-grab active:cursor-grabbing backdrop-blur-xs ${
        isMoved
          ? "border-primary/50 ring-2 ring-primary/20 shadow-md"
          : isCurrentUser
            ? "border-blue-500/50 ring-2 ring-blue-500/15 hover:border-blue-500/70"
            : "border-border/80 hover:border-primary/50"
      }`}
    >
      {/* Top Header: Department Pill + Actions (Add, Edit, Delete) & Drag Handle */}
      <div className="flex items-center justify-between gap-1.5">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border tracking-wider uppercase ${deptMeta.badge}`}
        >
          <span className={`size-1.5 rounded-full ${deptMeta.dot} shrink-0`} />
          {member.department}
        </span>

        <div className="flex items-center gap-1">
          {/* Quick Actions (revealed smoothly on hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAddReport(member.id);
              }}
              className="p-1 hover:bg-primary/10 text-primary rounded-lg transition-all cursor-pointer"
              title="Add Direct Report"
            >
              <UserPlus className="size-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(member);
              }}
              className="p-1 hover:bg-surface-3 text-muted-foreground hover:text-foreground rounded-lg transition-all cursor-pointer"
              title="Edit Member"
            >
              <Edit3 className="size-3.5" />
            </button>
            {!isRootLeader && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(member.id, member.name);
                }}
                className="p-1 hover:bg-rose-500/10 text-rose-500 rounded-lg transition-all cursor-pointer"
                title="Remove Member"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>

          {/* Drag Handle */}
          <div
            className="p-1 text-muted-foreground/40 group-hover:text-muted-foreground hover:text-primary rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-grab"
            title="Click and hold to reposition card"
          >
            <GripVertical className="size-3.5" />
          </div>
        </div>
      </div>

      {/* Middle Section: Avatar + Name + Designation */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <div
            className={`size-11 rounded-2xl ${
              member.avatarColor || "bg-gradient-to-tr from-blue-600 to-indigo-600"
            } text-white flex items-center justify-center font-extrabold text-sm shadow-xs`}
          >
            {member.name.charAt(0).toUpperCase()}
          </div>
          <span
            className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card"
            title="Active"
          />
        </div>

        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-extrabold text-foreground text-sm truncate tracking-tight group-hover:text-primary transition-colors">
              {member.name}
            </span>
            {isCurrentUser && (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shrink-0">
                You
              </span>
            )}
          </div>
          <span
            className="text-[11.5px] font-medium text-muted-foreground truncate leading-tight mt-0.5"
            title={displayTitle}
          >
            {displayTitle}
          </span>
        </div>
      </div>

      {/* Bottom Footer: Contact Mail & Hierarchy Status */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/50 text-[10.5px]">
        <div className="flex items-center gap-1.5 text-muted-foreground/80 truncate min-w-0" title={member.email}>
          <Mail className="size-3 shrink-0 text-muted-foreground/50" />
          <span className="truncate">{member.email}</span>
        </div>

        {isRootLeader ? (
          <span
            className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
            title="Organization Head / CEO"
          >
            <Crown className="size-2.5" /> Leader
          </span>
        ) : hasSubordinates ? (
          <span
            className="shrink-0 text-[9.5px] font-bold text-muted-foreground/70 bg-surface-2 px-1.5 py-0.5 rounded-md border border-border/40"
            title="Direct Manager with reports"
          >
            Manager
          </span>
        ) : null}
      </div>
    </div>
  );
}

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
    case "SUBMIT_TASK":
      return (
        <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-wider flex items-center gap-1" title="Can submit calculation sheets">
          <ArrowRight className="size-3" /> Submit
        </span>
      );
    case "NONE":
    default:
      return null;
  }
}

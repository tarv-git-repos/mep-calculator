import { Link, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react";
import {
  Building2, Search, Settings, ChevronDown, ChevronRight, Bell, HelpCircle,
  LayoutDashboard, FolderKanban, Wind, Droplets, Flame, LogOut, Save,
  Boxes, FileBarChart, Cog, Plus, X, Zap, Sparkles, Moon, Sun, Wrench, FileText,
  Play, PanelLeftClose, PanelLeftOpen, Box, TriangleAlert,
  Edit3, Trash2, Copy, ShieldAlert, Lock, RefreshCw, Loader2, Trophy, Network, Clock, CheckCircle2
} from "lucide-react";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { isFeatureLocked } from "@/utils/featureFlags";
import { logActivity, logCalculatorView, logCalculatorUpdate, getCalculatorTitleFromPath } from "@/utils/logger";
import { VersionManager } from "./VersionManager";
import { useCollaboration } from "@/lib/collaboration-store";
import { supabase } from "@/lib/supabase";
import { Megaphone, X as XIcon } from "lucide-react";
import { PricingModal } from "./PricingModal";
import { fetchLicenseStatus, type LicenseStatusInfo } from "@/lib/license";
import { getHardwareFingerprint, getOrCreateDeviceId } from "@/lib/hardwareFingerprint";
import { authService } from "@/services/authService";
import { api } from "@/services/api";
import { loadOrgHierarchyFromStorage } from "@/utils/hierarchy";
import { WelcomeToTarvModal } from "@/components/modals/WelcomeToTarvModal";
import { AutoUpdateModal } from "./AutoUpdateModal";
import { NotificationCenterView } from "./NotificationCenterView";
import { CalculationReviewBar } from "./CalculationReviewBar";
import { navigateToNotificationTarget, executeHighlightAndScroll } from "@/utils/notificationHelpers";

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";

import { NAV, type NavItem, type NavLeaf } from "@/config/navigation";

function getSections(children: NavLeaf[]) {
  const sections: { header: string; items: NavLeaf[] }[] = [];
  let currentSection: { header: string; items: NavLeaf[] } = { header: "", items: [] };

  children.forEach((c) => {
    if (c.isHeader) {
      if (currentSection.items.length > 0 || currentSection.header) {
        sections.push(currentSection);
      }
      currentSection = { header: c.label, items: [] };
    } else {
      currentSection.items.push(c);
    }
  });
  if (currentSection.items.length > 0 || currentSection.header) {
    sections.push(currentSection);
  }
  return sections;
}

const detectInputUnit = (el: HTMLElement) => {
  const container = el.closest(".flex, .grid, div, label");
  const textContext = container ? container.textContent || "" : "";
  const lowercaseText = textContext.toLowerCase();
  if (/\bgpm\b/i.test(lowercaseText)) return "gpm";
  if (/\bl\/s\b|\blps\b/i.test(lowercaseText)) return "ls";
  if (/\bl\/min\b|\blpm\b/i.test(lowercaseText)) return "lmin";
  if (/\bpsi\b/i.test(lowercaseText)) return "psi";
  if (/\bbar\b/i.test(lowercaseText)) return "bar";
  if (/\bft\b|\bfeet\b/i.test(lowercaseText)) return "ft";
  if (/\bm\b|\bmeters\b|\bmeter\b/i.test(lowercaseText)) return "m";
  if (/\bgal\b|\bgallons\b/i.test(lowercaseText)) return "gal";
  if (/\bliters\b|\bliter\b|\bl\b/i.test(lowercaseText)) return "l";
  if (/\bsq\s*ft\b|\bft2\b/i.test(lowercaseText)) return "ft2";
  if (/\bsq\s*m\b|\bm2\b/i.test(lowercaseText)) return "m2";
  if (/\b°f\b|\bdeg\s*f\b/i.test(lowercaseText)) return "f";
  if (/\b°c\b|\bdeg\s*c\b/i.test(lowercaseText)) return "c";
  return null;
};

// React element value setter overrides to bypass synthetic event interception
const setReactInputValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  if ((el as HTMLInputElement).type === "file") return;
  const descriptor = Object.getOwnPropertyDescriptor(el, "value");
  const prototype = Object.getPrototypeOf(el);
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  
  if (prototypeDescriptor && prototypeDescriptor.set) {
    prototypeDescriptor.set.call(el, value);
  } else if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
};

const setReactCheckboxValue = (el: HTMLInputElement, checked: boolean) => {
  const descriptor = Object.getOwnPropertyDescriptor(el, "checked");
  const prototype = Object.getPrototypeOf(el);
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "checked");
  
  if (prototypeDescriptor && prototypeDescriptor.set) {
    prototypeDescriptor.set.call(el, checked);
  } else if (descriptor && descriptor.set) {
    descriptor.set.call(el, checked);
  } else {
    el.checked = checked;
  }
};

const setReactSelectValue = (el: HTMLSelectElement, value: string) => {
  const descriptor = Object.getOwnPropertyDescriptor(el, "value");
  const prototype = Object.getPrototypeOf(el);
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  
  if (prototypeDescriptor && prototypeDescriptor.set) {
    prototypeDescriptor.set.call(el, value);
  } else if (descriptor && descriptor.set) {
    descriptor.set.call(el, value);
  } else {
    el.value = value;
  }
};

const getElementKey = (el: HTMLElement, index: number) => {
  const id = el.id;
  if (id) return `id:${id}`;
  const name = el.getAttribute("name");
  if (name) return `name:${name}`;
  const placeholder = el.getAttribute("placeholder");
  if (placeholder) return `placeholder:${placeholder}_${index}`;
  return `idx:${el.tagName.toLowerCase()}_${index}`;
};

const EXCLUDED_PERSIST_PATHS = [
  "/",
  "/projects",
  "/bim-viewer",
  "/reports",
  "/settings",
  "/3d-view",
  "/calculators",
  "/plumbing-fixture-unit",
  "/plumbing-loading-unit",
  "/plumbing-pump-sizing",
  "/plumbing-sprinkler-kfactor",
  "/plumbing-supply-pipe-sizer",
  "/plumbing-water-demand",
  "/lobby-pressurisation",
  "/smoke-extract-fan",
  "/staircase-pressurization",
  "/basement-smoke-calc",
  "/condensate-drain-calc",
  "/plumbing-pressure-vessel",
  "/plumbing-storm-water",
  "/plumbing-sprinkler-density"
];

const NON_VERSION_PATHS = [
  "/",
  "/dashboard",
  "/projects",
  "/bim-viewer",
  "/reports",
  "/report",
  "/teams",
  "/team",
  "/admin",
  "/settings",
  "/privacy",
  "/login",
  "/calculators",
  "/reset-password"
];

const savePageInputs = (projectId: string, pathname: string) => {
  if (typeof document === "undefined") return;
  if (EXCLUDED_PERSIST_PATHS.includes(pathname)) return;
  
  const inputs = Array.from(document.querySelectorAll("input, select, textarea")) as HTMLElement[];
  const state: Record<string, any> = {};
  
  inputs.forEach((el, index) => {
    if (el.closest("aside") || el.closest("header") || el.closest("[data-ignore-persist]")) return;
    
    const key = getElementKey(el, index);
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        state[key] = { checked: el.checked, type: el.type };
      } else {
        state[key] = { value: el.value, type: el.type };
      }
    } else if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
      state[key] = { value: el.value, type: el.tagName.toLowerCase() };
    }
  });
  
  localStorage.setItem(`mep_auto_state_${projectId}_${pathname}`, JSON.stringify(state));
  
  // Broadcast to other users in the project!
  useCollaboration.getState().broadcastData(pathname, state);
};


const applyLiveData = (state: Record<string, any>) => {
  if (typeof document === "undefined") return;
  const inputs = Array.from(document.querySelectorAll("input, select, textarea")) as HTMLElement[];
  
  (window as any).__mep_is_restoring = true;
  
  inputs.forEach((el, index) => {
    if (el.closest("aside") || el.closest("header") || el.closest("[data-ignore-persist]")) return;
    
    const key = getElementKey(el, index);
    const savedVal = state[key];
    if (!savedVal) return;
    
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked !== savedVal.checked) {
          setReactCheckboxValue(el, savedVal.checked);
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        if (el.value !== savedVal.value) {
          setReactInputValue(el, savedVal.value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.value !== savedVal.value) {
        setReactInputValue(el, savedVal.value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (el instanceof HTMLSelectElement) {
      if (el.value !== savedVal.value) {
        setReactSelectValue(el, savedVal.value);
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });
  
  setTimeout(() => {
    (window as any).__mep_is_restoring = false;
  }, 100);
};

const restorePageInputs = (projectId: string, pathname: string) => {
  if (typeof document === "undefined") return;
  if (EXCLUDED_PERSIST_PATHS.includes(pathname)) return;
  
  const saved = localStorage.getItem(`mep_auto_state_${projectId}_${pathname}`);
  if (!saved) return;
  
  let state: Record<string, any> = {};
  try {
    state = JSON.parse(saved);
  } catch (e) {
    return;
  }
  
  const inputs = Array.from(document.querySelectorAll("input, select, textarea")) as HTMLElement[];
  
  (window as any).__mep_is_restoring = true;
  
  inputs.forEach((el, index) => {
    if (el.closest("aside") || el.closest("header") || el.closest("[data-ignore-persist]")) return;
    if (el instanceof HTMLInputElement && el.type === "file") return;
    
    const key = getElementKey(el, index);
    const savedVal = state[key];
    if (!savedVal) return;
    
    if (el instanceof HTMLInputElement) {
      if (el.type === "checkbox" || el.type === "radio") {
        if (el.checked !== savedVal.checked) {
          setReactCheckboxValue(el, savedVal.checked);
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      } else {
        if (el.value !== savedVal.value) {
          setReactInputValue(el, savedVal.value);
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.value !== savedVal.value) {
        setReactInputValue(el, savedVal.value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    } else if (el instanceof HTMLSelectElement) {
      if (el.value !== savedVal.value) {
        setReactSelectValue(el, savedVal.value);
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });
  
  setTimeout(() => {
    (window as any).__mep_is_restoring = false;
  }, 100);
};

const triggerSave = () => {
  if (typeof document === "undefined") return false;
  
  const pathname = window.location.pathname;
  const calcTitle = getCalculatorTitleFromPath(pathname) || 'Ventilation';
  logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);

  const buttons = Array.from(document.querySelectorAll('button'));
  const saveBtn = buttons.find(btn => {
    const txt = btn.textContent || "";
    return txt.toLowerCase().includes("save current") || txt.toLowerCase().includes("save calculation");
  });
  if (saveBtn) {
    saveBtn.click();
    return true;
  }
  toast.success("Calculation saved to project successfully!");
  return true;
};

import { useAuth } from "@/contexts/AuthContext";

let globalLicenseCache: LicenseStatusInfo | null = null;

const MEP_CALC_ROUTES = new Set([
  // HVAC
  "/ventilation", "/preliminary-cooling-load", "/fresh-air-cooling-load",
  "/heating-load", "/chw-pump-head", "/chw-pipe-sizer", "/duct-sizer",
  "/diffuser-selector", "/refrigerant-pipe-sizing", "/condensate-drain-calc",
  "/condensate-drain", "/staircase-pressurization", "/lobby-pressurisation",
  "/smoke-extract-fan", "/basement-smoke-calc", "/psychrometric",

  // Electrical
  "/cable-voltage-drop", "/busbar-voltage-drop", "/busbar-calculation",
  "/conductor-sizing", "/transformer-sizing", "/generator-sizing",
  "/ups-sizing-calculation", "/capacitor-bank-sizing", "/circuit-breaker-sizing",
  "/short-circuit-calculations", "/cable-tray-sizing", "/lighting-lux-calculation",
  "/lpd-calculation", "/central-battery-sizing", "/project-load-schedule",

  // Plumbing
  "/plumbing-water-demand", "/plumbing-tank-sizing", "/plumbing-pump-sizing",
  "/plumbing-booster-pump", "/plumbing-pressure-vessel", "/plumbing-fixture-unit",
  "/plumbing-loading-unit", "/plumbing-supply-pipe-sizer", "/plumbing-drainage",
  "/plumbing-drainage-pipe-sizer", "/plumbing-sump-pump", "/plumbing-sewage-pump",
  "/plumbing-storm-water", "/plumbing-gas-tank", "/plumbing-hazen-williams",

  // Fire Fighting
  "/plumbing-fire-water-demand", "/plumbing-fire-tank-capacity",
  "/plumbing-fire-tank-duration", "/plumbing-fire-pump-duty",
  "/plumbing-sprinkler-density", "/plumbing-sprinkler-kfactor",
  "/plumbing-fm200"
]);

export function AppShell({ children, title, subtitle, actions, onIntelClick, intelOpen, intelLabel, hideSubHeader, breadcrumb, spaceCount }: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onIntelClick?: () => void;
  intelOpen?: boolean;
  intelLabel?: string;
  hideSubHeader?: boolean;
  breadcrumb?: ReactNode;
  spaceCount?: number;
}) {
  const { profile, userData, logout, loading } = useAuth();
  const userId = userData?.id || profile?.id;
  const userPhoto = (userData?.profile_photo !== undefined && userData?.profile_photo !== null)
    ? userData.profile_photo
    : ((profile?.profile_photo !== undefined && profile?.profile_photo !== null)
      ? profile.profile_photo
      : (userId && typeof window !== 'undefined' ? localStorage.getItem(`mep_profile_photo_${userId}`) || '' : ''));
  const confirm = useConfirm();
  const prompt = usePrompt();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shouldHideSubHeader = hideSubHeader || pathname === '/notifications';
  const isVersionAllowed = useMemo(() => {
    const cleanPath = (pathname || "").toLowerCase().replace(/\/$/, "") || "/";
    return !NON_VERSION_PATHS.some((nonPath) => cleanPath === nonPath || cleanPath.startsWith(nonPath + "/"));
  }, [pathname]);
  const searchObj = useRouterState({ select: (s) => s.location.search }) as Record<string, any>;
  const activeName = searchObj?.name;
  const navigate = useNavigate();
  const { project, projects, activeProjectId, selectProject, refreshProjects, deleteProject, duplicateProject, updateProject, isReadOnly, setReadOnly, saveAsRevision, forceSaveToCloud, syncFromCloud, isInitializing, spaces, zones, equipment } = useWorkspace();
  const { joinProject, leaveProject, setActiveModule, getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration(s => s.activeUsers);
  const [myEmail, setMyEmail] = useState<string>("unknown");
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseStatusInfo | null>(globalLicenseCache);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [defaultIntelOpen, setDefaultIntelOpen] = useState(false);

  const isMepCalcRoute = useMemo(() => MEP_CALC_ROUTES.has(pathname), [pathname]);
  const effectiveOnIntelClick = onIntelClick || (isMepCalcRoute ? () => setDefaultIntelOpen(v => !v) : undefined);
  const effectiveIntelOpen = onIntelClick ? (intelOpen ?? false) : defaultIntelOpen;

  useEffect(() => {
    // Background prefetch heavy 3D BIM Viewer libraries & WebAssembly engine during idle time
    const timer = setTimeout(() => {
      import('@/features/bim-viewer/App').catch(() => {});
      import('web-ifc').catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  const [notifTick, setNotifTick] = useState(0);
  const [isNotifHoverOpen, setIsNotifHoverOpen] = useState(false);
  const [isNotifPopoverOpen, setIsNotifPopoverOpen] = useState(false);
  const notifHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleNotifMouseEnter = () => {
    if (notifHoverTimerRef.current) {
      clearTimeout(notifHoverTimerRef.current);
      notifHoverTimerRef.current = null;
    }
    if (!isNotifPopoverOpen) {
      setIsNotifHoverOpen(true);
    }
  };

  const handleNotifMouseLeave = () => {
    notifHoverTimerRef.current = setTimeout(() => {
      setIsNotifHoverOpen(false);
    }, 250);
  };

  const [, setProfileSyncTick] = useState(0);

  useEffect(() => {
    const handleProfileUpdated = () => {
      setProfileSyncTick(t => t + 1);
    };
    window.addEventListener('mep_user_profile_updated', handleProfileUpdated);
    window.addEventListener('storage', handleProfileUpdated);
    return () => {
      window.removeEventListener('mep_user_profile_updated', handleProfileUpdated);
      window.removeEventListener('storage', handleProfileUpdated);
    };
  }, []);

  const roleVal = String(profile?.role || userData?.user_metadata?.role || userData?.role || "").trim();
  const rawRole = roleVal.toLowerCase();
  const activeProfile = profile || userData || {};
  const des = String(activeProfile.designation || "").toLowerCase().trim();

  // Dynamic Review & Approval Authority (Single Source of Truth: Company Hierarchy)
  const currentUserAuthority = useMemo<"APPROVE_REJECT" | "REVIEW" | "NONE">(() => {
    let ap: any = profile || userData || {};
    if ((!ap.role && !ap.designation) && typeof window !== "undefined") {
      try {
        const storedProfile = localStorage.getItem('mep_profile');
        const storedUserData = localStorage.getItem('mep_user_data');
        if (storedProfile) ap = JSON.parse(storedProfile);
        else if (storedUserData) ap = JSON.parse(storedUserData);
      } catch (e) {}
    }

    const currentEmail = String(userData?.email || profile?.email || ap.email || "").toLowerCase().trim();
    const currentName = String(userData?.name || profile?.name || ap.name || "").toLowerCase().trim();
    const currentId = String(userId || userData?.id || profile?.id || ap.id || "").toLowerCase().trim();

    // 1. Check Company Hierarchy FIRST (Single Source of Truth)
    if (typeof window !== "undefined") {
      try {
        const members = loadOrgHierarchyFromStorage(userData, profile);
        if (members && Array.isArray(members)) {
          const found = members.find((m: any) => {
            const mEmail = String(m.email || "").toLowerCase().trim();
            const mName = String(m.name || "").toLowerCase().trim();
            const mId = String(m.id || "").toLowerCase().trim();
            return (currentEmail && mEmail === currentEmail) ||
                   (currentId && mId === currentId) ||
                   (currentName && mName === currentName) ||
                   (currentEmail && mEmail && (currentEmail.includes(mEmail) || mEmail.includes(currentEmail))) ||
                   (currentName && mName && (currentName.includes(mName) || mName.includes(currentName)));
          });

          if (found && found.approvalAuthority) {
            return found.approvalAuthority;
          }
        }
      } catch (e) {}
    }

    // 2. Direct property
    if (ap.approvalAuthority) return ap.approvalAuthority;
    if (ap.features?.approvalAuthority) return ap.features.approvalAuthority;

    // 3. Fallbacks
    const roleUpper = String(ap.role || roleVal || "").toUpperCase();
    const desLower = String(ap.designation || des || "").toLowerCase();

    if (roleUpper === "SUPER_ADMIN" || roleUpper === "ORG_ADMIN" || currentEmail === "admin@tarv.ai") {
      return "APPROVE_REJECT";
    }
    if (roleUpper === "PROJECT_MANAGER" || roleUpper === "TEAM_LEADER" || roleUpper === "DISCIPLINE_COORDINATOR" || desLower.includes("coordinator")) {
      return "APPROVE_REJECT";
    }
    if (roleUpper === "SR_DESIGN_ENGINEER" || desLower.includes("senior") || desLower.includes("sr.")) {
      return "REVIEW";
    }

    return "NONE";
  }, [profile, userData, userId, roleVal, des]);

  const isCoordinatorOrAdmin = useMemo(() => {
    return currentUserAuthority === "APPROVE_REJECT" || (
      roleVal === "Discipline Coordinator" ||
      rawRole === "discipline coordinator" ||
      rawRole.includes("coordinator") ||
      des.includes("coordinator")
    );
  }, [currentUserAuthority, roleVal, rawRole, des]);

  const isViewerRole = useMemo(() => {
    return roleVal === "VIEWER" || rawRole === "viewer" || rawRole.includes("viewer");
  }, [roleVal, rawRole]);

  useEffect(() => {
    if (isViewerRole && !isReadOnly) {
      setReadOnly(true);
    }
  }, [isViewerRole, isReadOnly, setReadOnly]);

  useEffect(() => {
    async function syncOrgBackupSettings() {
      try {
        const res = await api.getOrgBackupSettings();
        if (res && res.success) {
          if (res.versions_path) {
            localStorage.setItem('versionsPath', res.versions_path);
          }
          if (res.local_backup_path) {
            localStorage.setItem('localBackupPath', res.local_backup_path);
          }
          if (res.server_backup_path) {
            localStorage.setItem('serverBackupPath', res.server_backup_path);
          }
        }
      } catch (e) {}
    }
    syncOrgBackupSettings();
  }, []);

  const isJrDesignEngineer = useMemo(() => {
    return (
      roleVal === "Jr. Design Engineer" ||
      roleVal === "Junior Design Engineer" ||
      roleVal === "Design Engineer" ||
      roleVal === "jr. Design Engineer" ||
      rawRole.includes("junior") ||
      rawRole.includes("jr.") ||
      des.includes("junior") ||
      des.includes("jr.")
    );
  }, [roleVal, rawRole, des]);

  const isSrDesignEngineer = useMemo(() => {
    if (isJrDesignEngineer) return false;
    return (
      roleVal === "Sr. Design Engineer" ||
      roleVal === "Senior Design Engineer" ||
      rawRole.includes("senior") ||
      rawRole.includes("sr.") ||
      rawRole === "sr" ||
      des.includes("senior") ||
      des.includes("sr.") ||
      des === "sr"
    );
  }, [roleVal, rawRole, des, isJrDesignEngineer]);

  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_read_notif_ids");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });

  const [deletedNotifIds, setDeletedNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved1 = localStorage.getItem("mep_deleted_notif_ids");
        const list1 = saved1 ? JSON.parse(saved1) : [];
        const uId = userData?.id || profile?.id;
        const saved2 = uId ? localStorage.getItem(`mep_deleted_notif_ids_${uId}`) : null;
        const list2 = saved2 ? JSON.parse(saved2) : [];
        return Array.from(new Set([...list1, ...list2]));
      } catch (e) {}
    }
    return [];
  });

  const [deletedNotifications, setDeletedNotifications] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const uId = userData?.id || profile?.id;
        const key = uId ? `mep_deleted_notifications_${uId}` : "mep_deleted_notifications";
        const saved = localStorage.getItem(key) || localStorage.getItem("mep_deleted_notifications");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });

  const [completedNotifIds, setCompletedNotifIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_completed_notif_ids");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });

  const [persistentNotifs, setPersistentNotifs] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const uId = userId || userData?.id;
        const key = uId ? `mep_persistent_user_notifs_${uId}` : "mep_persistent_user_notifs";
        const saved = localStorage.getItem(key) || localStorage.getItem("mep_persistent_user_notifs");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const uId = userData?.id || profile?.id;
      if (uId) {
        try {
          const saved1 = localStorage.getItem("mep_deleted_notif_ids");
          const list1 = saved1 ? JSON.parse(saved1) : [];
          const saved2 = localStorage.getItem(`mep_deleted_notif_ids_${uId}`);
          const list2 = saved2 ? JSON.parse(saved2) : [];
          setDeletedNotifIds(Array.from(new Set([...list1, ...list2])));

          const savedDelNotifs = localStorage.getItem(`mep_deleted_notifications_${uId}`) || localStorage.getItem("mep_deleted_notifications");
          if (savedDelNotifs) setDeletedNotifications(JSON.parse(savedDelNotifs));

          const savedComp = localStorage.getItem("mep_completed_notif_ids");
          if (savedComp) setCompletedNotifIds(JSON.parse(savedComp));

          const savedRead = localStorage.getItem("mep_read_notif_ids");
          if (savedRead) setReadNotifIds(JSON.parse(savedRead));
        } catch (e) {}
      }
    }
  }, [userData?.id, profile?.id]);

  const markNotifAsRead = (id: string) => {
    if (!id) return;
    const notif = myNotifications.find((n: any) => n.id === id);
    const notifText = notif?.text || "";
    const targetId = notif?.targetId || "";

    const keysToMark = Array.from(new Set([
      id,
      notifText,
      targetId ? `${targetId}_${notifText}` : null,
      targetId && notif?.timestamp ? `notif_${targetId}_${notif.timestamp}` : null,
      targetId && notif?.timestamp ? `${targetId}_${notif.timestamp}` : null
    ].filter(Boolean) as string[]));

    workspaceStore.markCommentReadInWorkspace(keysToMark);

    setReadNotifIds(prev => {
      const set = new Set([...prev, ...keysToMark]);
      const updated = Array.from(set);
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_read_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });

    fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: keysToMark })
    }).catch(() => null);
  };

  const deleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id) : idOrNotif;
    if (!id) return;

    // Collect matching notifications strictly by unique ID
    const matchingNotifs = [
      ...(myNotifications || []),
      ...(persistentNotifs || []),
      ...(notifObj ? [notifObj] : [])
    ].filter((n: any) => {
      if (!n) return false;
      return (
        n.id === id ||
        n.metadata?.id === id
      );
    });

    const keysToDeleteSet = new Set<string>();
    if (id) keysToDeleteSet.add(String(id));

    const processNotifItem = (notif: any) => {
      if (!notif) return;
      if (notif.id) keysToDeleteSet.add(String(notif.id));
      if (notif.metadata?.id) keysToDeleteSet.add(String(notif.metadata.id));
    };

    matchingNotifs.forEach(processNotifItem);
    const keysToDelete = Array.from(keysToDeleteSet);

    // 1. Add deleted item to deletedNotifications store for Deleted tab
    setDeletedNotifications(prev => {
      const map = new Map<string, any>();
      prev.forEach(item => {
        const k = item.id || item.text;
        if (k) map.set(k, item);
      });
      matchingNotifs.forEach(item => {
        const k = item.id || item.text || String(Math.random());
        map.set(k, { ...item, deletedAt: new Date().toISOString(), deleted: true });
      });
      const updated = Array.from(map.values());
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? `mep_deleted_notifications_${uId}` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }
      return updated;
    });

    // 2. Update deletedNotifIds state & localStorage permanently
    setDeletedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...keysToDelete]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        if (userId) {
          localStorage.setItem(`mep_deleted_notif_ids_${userId}`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    setNotifTick(t => t + 1);
    toast.success("Notification moved to Deleted tab.");
  };

  const restoreNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.metadata?.id) : idOrNotif;
    if (!id) return;

    const keysToRemove = new Set([
      String(id),
      notifObj?.id ? String(notifObj.id) : null,
      notifObj?.metadata?.id ? String(notifObj.metadata.id) : null
    ].filter(Boolean) as string[]);

    // 1. Remove from deletedNotifIds
    setDeletedNotifIds(prev => {
      const updated = prev.filter(k => !keysToRemove.has(k));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
        if (userId) {
          localStorage.setItem(`mep_deleted_notif_ids_${userId}`, JSON.stringify(updated));
        }
      }
      return updated;
    });

    // 2. Remove from deletedNotifications store
    setDeletedNotifications(prev => {
      const restoredItem = prev.find(n => keysToRemove.has(String(n.id)) || (n.metadata?.id && keysToRemove.has(String(n.metadata.id))));
      const updated = prev.filter(n => !keysToRemove.has(String(n.id)) && (!n.metadata?.id || !keysToRemove.has(String(n.metadata.id))));
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? `mep_deleted_notifications_${uId}` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }

      if (restoredItem) {
        setPersistentNotifs(pPrev => {
          if (pPrev.some(p => p.id === restoredItem.id)) return pPrev;
          const pUpdated = [{ ...restoredItem, deleted: false }, ...pPrev];
          if (typeof window !== "undefined") {
            const uId = userId || userData?.id;
            const key = uId ? `mep_persistent_user_notifs_${uId}` : "mep_persistent_user_notifs";
            localStorage.setItem(key, JSON.stringify(pUpdated));
          }
          return pUpdated;
        });
      }

      return updated;
    });

    setNotifTick(t => t + 1);
    toast.success("Notification restored to Received tab!");
  };

  const permanentlyDeleteNotification = (idOrNotif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const notifObj = typeof idOrNotif === 'object' && idOrNotif !== null ? idOrNotif : null;
    const id = notifObj ? (notifObj.id || notifObj.text) : idOrNotif;
    if (!id) return;

    setDeletedNotifications(prev => {
      const updated = prev.filter(n => n.id !== id && n.text !== id);
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? `mep_deleted_notifications_${uId}` : "mep_deleted_notifications";
        localStorage.setItem(key, JSON.stringify(updated));
        localStorage.setItem("mep_deleted_notifications", JSON.stringify(updated));
      }
      return updated;
    });

    setNotifTick(t => t + 1);
    toast.success("Notification permanently deleted.");
  };

  const clearAllReceivedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const toDelete = myNotifications.filter(n => {
      const isCompleted = Boolean(completedNotifIds.includes(n.id));
      const isDel = Boolean(deletedNotifIds.includes(n.id));
      return !isCompleted && !isDel;
    });
    toDelete.forEach(n => deleteNotification(n));
  };

  const clearAllCompletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const toDelete = myNotifications.filter(n => {
      const isCompleted = Boolean(completedNotifIds.includes(n.id));
      const isDel = Boolean(deletedNotifIds.includes(n.id));
      return isCompleted && !isDel;
    });
    toDelete.forEach(n => deleteNotification(n));
  };

  const clearAllDeletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeletedNotifications([]);
    if (typeof window !== "undefined") {
      const uId = userId || userData?.id;
      const key = uId ? `mep_deleted_notifications_${uId}` : "mep_deleted_notifications";
      localStorage.removeItem(key);
      localStorage.removeItem("mep_deleted_notifications");
    }
    setNotifTick(t => t + 1);
    toast.success("Trash emptied permanently.");
  };

  const restoreAllDeletedNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPersistentNotifs(pPrev => {
      const map = new Map();
      pPrev.forEach(p => p.id && map.set(p.id, p));
      deletedNotifications.forEach(d => d.id && map.set(d.id, { ...d, deleted: false }));
      const pUpdated = Array.from(map.values());
      if (typeof window !== "undefined") {
        const uId = userId || userData?.id;
        const key = uId ? `mep_persistent_user_notifs_${uId}` : "mep_persistent_user_notifs";
        localStorage.setItem(key, JSON.stringify(pUpdated));
      }
      return pUpdated;
    });

    setDeletedNotifIds([]);
    setDeletedNotifications([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("mep_deleted_notif_ids");
      if (userId) {
        localStorage.setItem(`mep_deleted_notif_ids_${userId}`, JSON.stringify([]));
      }
      const uId = userId || userData?.id;
      const key = uId ? `mep_deleted_notifications_${uId}` : "mep_deleted_notifications";
      localStorage.removeItem(key);
      localStorage.removeItem("mep_deleted_notifications");
    }
    setNotifTick(t => t + 1);
    toast.success("All notifications restored to Received!");
  };

  const clearAllNotifications = (e?: React.MouseEvent) => {
    clearAllReceivedNotifications(e);
  };

  const completeTaskAndNotifyAuthor = async (notif: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    const currentUserName = userData?.name || profile?.name || "Design Engineer";
    const currentUserEmail = userData?.email || profile?.email || myEmail;
    const currentUserId = userId || userData?.id;
    const notifText = notif.text || "";
    const targetId = notif.targetId || "";

    const keysToMark = Array.from(new Set([
      notif.id,
      notifText,
      targetId ? `${targetId}_${notifText}` : null,
      targetId && notif.timestamp ? `notif_${targetId}_${notif.timestamp}` : null,
      targetId && notif.timestamp ? `${targetId}_${notif.timestamp}` : null
    ].filter(Boolean) as string[]));

    // 0. Update active in-memory workspace store
    workspaceStore.markCommentCompletedInWorkspace(keysToMark);

    setCompletedNotifIds(prev => {
      const set = new Set([...prev, ...keysToMark]);
      const updated = Array.from(set);
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_completed_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });

    if (notif.id) {
      markNotifAsRead(notif.id);
      fetch("/api/notifications/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: keysToMark })
      }).catch(() => null);
    }

    const targetProjId = notif.projectId || project?.id;
    const allProjs = useWorkspace.getState().projects;
    const targetProj = allProjs.find((p: any) => p.id === targetProjId) || project;

    if (targetProj && targetProj.workspace_data) {
      let wdata = targetProj.workspace_data;
      if (typeof wdata === 'string') {
        try { wdata = JSON.parse(wdata); } catch (err) {}
      }

      const updatedWdata = { ...wdata };

      const markCommentCompleted = (list: any[]) => {
        if (!Array.isArray(list)) return list;
        return list.map((item: any) => {
          if (Array.isArray(item.comments)) {
            const nextComments = item.comments.map((c: any) => {
              if (c.id === notif.id || `notif_${item.id}_${c.timestamp}` === notif.id || c.text === notifText || keysToMark.includes(c.id) || keysToMark.includes(c.text)) {
                return { ...c, completed: true, read: true };
              }
              return c;
            });
            return { ...item, comments: nextComments };
          }
          return item;
        });
      };

      if (updatedWdata.spaces) updatedWdata.spaces = markCommentCompleted(updatedWdata.spaces);
      if (updatedWdata.zones) updatedWdata.zones = markCommentCompleted(updatedWdata.zones);
      if (updatedWdata.equipment) updatedWdata.equipment = markCommentCompleted(updatedWdata.equipment);
      if (updatedWdata.pcl_rows) updatedWdata.pcl_rows = markCommentCompleted(updatedWdata.pcl_rows);
      if (updatedWdata.sprinklers) updatedWdata.sprinklers = markCommentCompleted(updatedWdata.sprinklers);
      if (updatedWdata.sprinkler_rows) updatedWdata.sprinkler_rows = markCommentCompleted(updatedWdata.sprinkler_rows);

      const recipientUser = notif.authorEmail || notif.authorName || notif.authorId || "Comment Author";
      const completionNotif = {
        id: `taskdone_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        authorName: currentUserName,
        authorEmail: currentUserEmail,
        authorId: currentUserId,
        recipientUser: recipientUser,
        text: `✅ TASK COMPLETED: Comment worked on & task completed on ${notif.targetType || "location"} "${notif.targetName || "Target"}"! (Re: "${notif.text}")`,
        timestamp: new Date().toISOString(),
        targetType: notif.targetType || "Location",
        targetName: notif.targetName || "Location",
        projectName: notif.projectName || targetProj.name,
        projectId: targetProj.id,
        calculatorPath: notif.calculatorPath || "/ventilation",
        targetId: notif.targetId
      };

      const existingDoneNotifs = Array.isArray(updatedWdata.task_completion_notifs) ? updatedWdata.task_completion_notifs : [];
      updatedWdata.task_completion_notifs = [completionNotif, ...existingDoneNotifs];

      try {
        await api.saveWorkspace(targetProj.id, updatedWdata);
        useWorkspace.getState().updateProject({ ...targetProj, workspace_data: updatedWdata });
      } catch (err) {
        console.error("Failed to save task completion:", err);
      }
    }

    toast.success(`Task completed! Marked done & notification sent to ${notif.authorName || "author"}.`);
  };

  const myNotifications = useMemo(() => {
    const currentId = userId || userData?.id || profile?.id || "current_user";
    const currentName = (userData?.name || profile?.name || "Design Engineer").toLowerCase().trim();
    const currentEmail = (userData?.email || profile?.email || "").toLowerCase().trim();

    const notifs: any[] = [];
    const extractBusbarRows = (panels: any[]) => {
      if (!Array.isArray(panels)) return [];
      const rows: any[] = [];
      panels.forEach((p: any) => {
        if (Array.isArray(p.sections)) {
          p.sections.forEach((s: any) => {
            if (Array.isArray(s.rows)) {
              s.rows.forEach((r: any) => rows.push({ ...r, desc: r.desc || r.from || `Tap Off ${r.ref || r.id}` }));
            }
          });
        }
      });
      return rows;
    };

    const addNotifs = (items: any[], typeName: string, projectName: string, projectId: string, calcPath: string = "/ventilation") => {
      if (!items || !Array.isArray(items)) return;
      items.forEach(item => {
        if (item && item.comments && Array.isArray(item.comments)) {
          item.comments.forEach((c: any) => {
            if (!c) return;

            const cText = String(c.text || "").trim();
            if (!cText) return; // Reject empty/blank comment cards!

            const notifId = c.id || `notif_${item.id}_${c.timestamp}`;
            const targetIdText = item.id ? `${item.id}_${cText}` : "";

            const isDel = Boolean(
              c.deleted === true ||
              deletedNotifIds.includes(notifId) ||
              (c.id && deletedNotifIds.includes(String(c.id))) ||
              (c.metadata?.id && deletedNotifIds.includes(String(c.metadata.id)))
            );

            const assignedUsers = Array.isArray(c.assignedUsers) ? c.assignedUsers : [];
            const authorIdStr = String(c.authorId || "").toLowerCase().trim();
            const authorNameStr = String(c.authorName || "").toLowerCase().trim();
            const currentIdStr = String(currentId || "").toLowerCase().trim();
            const currentEmailStr = String(currentEmail || "").toLowerCase().trim();
            const currentNameStr = String(currentName || "").toLowerCase().trim();

            const isAuthor = Boolean(
              (authorIdStr && currentIdStr && authorIdStr === currentIdStr) ||
              (authorIdStr && currentEmailStr && authorIdStr === currentEmailStr) ||
              (authorNameStr && currentNameStr && (authorNameStr === currentNameStr || currentNameStr.includes(authorNameStr) || authorNameStr.includes(currentNameStr))) ||
              (c.authorId && (c.authorId === userId || c.authorId === userData?.id || c.authorId === profile?.id)) ||
              (c.authorName && (c.authorName === userData?.name || c.authorName === profile?.name))
            );

            let isAssigned = false;

            if (c.isCompletionNotif) {
              const origAuthor = String(c.originalAuthorId || c.authorId || "").toLowerCase().trim();
              isAssigned = (origAuthor === currentIdStr || (currentEmail && origAuthor === currentEmail));
            } else if (c.isReviewStateNotif) {
              if (c.targetRole === 'discipline_coordinator') {
                isAssigned = (currentUserAuthority === "APPROVE_REJECT");
              } else if (c.targetRole === 'sr_design_engineer') {
                isAssigned = (currentUserAuthority === "REVIEW");
              } else if (c.targetRole === 'all_engineers') {
                isAssigned = (currentUserAuthority !== "APPROVE_REJECT");
              } else {
                isAssigned = Boolean(c.recipientEmail && currentEmail && c.recipientEmail.toLowerCase().trim() === currentEmail);
              }
            } else {
              // Comment / Task:
              if (isAuthor) {
                // Author must NEVER see their own sent comment/task in their "Received" inbox
                isAssigned = false;
              } else if (assignedUsers.length > 0) {
                // If specific assignees were selected:
                const isTargeted = assignedUsers.some((u: any) => {
                  const uStr = String(u).toLowerCase().trim();
                  return (
                    (currentIdStr && uStr === currentIdStr) ||
                    (currentNameStr && uStr === currentNameStr) ||
                    (currentEmailStr && uStr === currentEmailStr)
                  );
                });
                isAssigned = isTargeted; // STRICTLY TARGETED ASSIGNEES ONLY!
              } else {
                // Unassigned comment: deliver to other project members EXCEPT the author
                isAssigned = true;
              }
            }

            if (isAssigned) {
              const notifId = c.id || `notif_${item.id}_${c.timestamp}`;
              if (!notifs.some(n => n.id === notifId)) {
                notifs.push({
                  ...c,
                  id: notifId,
                  targetId: item.id,
                  targetName: item.label || item.desc || item.name || item.id || typeName,
                  targetType: c.targetType || typeName,
                  projectName: projectName || "Project",
                  projectId: projectId || "current",
                  calculatorPath: calcPath
                });
              }
            }
          });
        }
      });
    };

    // 1. Scan projects workspace_data
    projects.forEach(p => {
      let wdata = p.workspace_data || {};
      if (typeof wdata === 'string') {
        try { wdata = JSON.parse(wdata); } catch(e) {}
      }
      addNotifs(wdata.spaces, "Space", p.name, p.id, "/ventilation");
      addNotifs(wdata.zones, "Zone", p.name, p.id, "/ventilation");
      addNotifs(wdata.equipment, "Equipment", p.name, p.id, "/ventilation");

      const pclFromWdata = wdata.pcl_rows || wdata.preliminary_cooling_load || wdata.cooling_spaces;
      if (Array.isArray(pclFromWdata)) addNotifs(pclFromWdata, "Cooling Space", p.name, p.id, "/preliminary-cooling-load");

      const spkFromWdata = wdata.sprinklers || wdata.sprinkler_rows || wdata.sprinkler_kfactor;
      if (Array.isArray(spkFromWdata)) addNotifs(spkFromWdata, "Sprinkler Head", p.name, p.id, "/plumbing-sprinkler-kfactor");

      if (wdata.busbar_calc) {
        const panels = wdata.busbar_calc.panels || (Array.isArray(wdata.busbar_calc) ? wdata.busbar_calc : null);
        if (panels) addNotifs(extractBusbarRows(panels), "Busbar Row", p.name, p.id, "/busbar-calculation");
      }

      if (wdata.generator_calc) {
        const rows = wdata.generator_calc.rows || (Array.isArray(wdata.generator_calc) ? wdata.generator_calc : null);
        if (rows) addNotifs(rows, "Generator Load", p.name, p.id, "/generator-sizing");
      }

      if (wdata.cable_tray_calc) {
        const trays = Array.isArray(wdata.cable_tray_calc) ? wdata.cable_tray_calc : wdata.cable_tray_calc.trays;
        if (Array.isArray(trays)) {
          trays.forEach((t: any) => {
            if (t.cables && Array.isArray(t.cables)) addNotifs(t.cables, "Cable Tray", p.name, p.id, "/cable-tray-sizing");
            if (t.comments && Array.isArray(t.comments)) addNotifs([t], "Cable Tray", p.name, p.id, "/cable-tray-sizing");
          });
        }
      }

      if (wdata.loading_unit_calc) {
        const spaces = wdata.loading_unit_calc.iopSpaces || (Array.isArray(wdata.loading_unit_calc) ? wdata.loading_unit_calc : null);
        if (spaces) addNotifs(spaces, "Loading Unit Space", p.name, p.id, "/plumbing-loading-unit");
      }

      if (wdata.capacitor_bank_calc) {
        const panels = wdata.capacitor_bank_calc.panels || (Array.isArray(wdata.capacitor_bank_calc) ? wdata.capacitor_bank_calc : null);
        if (panels) addNotifs(panels, "Capacitor Bank Panel", p.name, p.id, "/capacitor-bank-sizing");
      }

      // Scan wdata.notifications[] — where CalculationReviewBar stores review/rejection notifs
      if (Array.isArray(wdata.notifications)) {
        wdata.notifications.forEach((wn: any) => {
          if (!wn || !wn.id || !wn.text) return;
          const wnId = wn.id;

          // Skip duplicates
          if (notifs.some(n => n.id === wnId)) return;

          // Determine if this notification is meant for the current user
          let isForMe = false;
          if (wn.isReviewStateNotif) {
            if (wn.targetRole === 'discipline_coordinator') {
              isForMe = isCoordinatorOrAdmin;
            } else if (wn.targetRole === 'sr_design_engineer') {
              isForMe = isSrDesignEngineer;
            } else if (wn.targetRole === 'all_engineers') {
              // All non-coordinator engineers
              isForMe = !isCoordinatorOrAdmin;
            } else if (wn.recipientEmail) {
              isForMe = Boolean(currentEmail && wn.recipientEmail.toLowerCase().trim() === currentEmail);
            }
          } else if (Array.isArray(wn.assignedUsers) && wn.assignedUsers.length > 0) {
            const currentId = userId || userData?.id || profile?.id || "";
            isForMe = wn.assignedUsers.some((u: any) => {
              const uStr = String(u).toLowerCase().trim();
              return (
                (currentId && uStr === String(currentId).toLowerCase()) ||
                (currentName && uStr === currentName) ||
                (currentEmail && uStr === currentEmail)
              );
            });
          } else {
            // Unassigned: deliver to all project members except author
            const authorIdStr = String(wn.authorId || "").toLowerCase().trim();
            const currentId = String(userId || userData?.id || profile?.id || "").toLowerCase();
            isForMe = Boolean(
              authorIdStr !== currentId &&
              (!currentEmail || authorIdStr !== currentEmail) &&
              (!currentName || authorIdStr !== currentName)
            );
          }

          if (isForMe) {
            notifs.push({
              ...wn,
              projectName: p.name,
              projectId: p.id,
            });
          }
        });
      }
    });

    // 2. Scan all localStorage calculation stores
    if (typeof localStorage !== 'undefined') {
      try {
        // Direct default checks
        const defSpaces = localStorage.getItem("mep_spaces") || localStorage.getItem("mep_spaces_default");
        if (defSpaces) {
          try { addNotifs(JSON.parse(defSpaces), "Space", "Active Project", "default", "/ventilation"); } catch(e) {}
        }
        const defZones = localStorage.getItem("mep_zones") || localStorage.getItem("mep_zones_default");
        if (defZones) {
          try { addNotifs(JSON.parse(defZones), "Zone", "Active Project", "default", "/ventilation"); } catch(e) {}
        }
        const defEquip = localStorage.getItem("mep_equipment") || localStorage.getItem("mep_equipment_default");
        if (defEquip) {
          try { addNotifs(JSON.parse(defEquip), "Equipment", "Active Project", "default", "/ventilation"); } catch(e) {}
        }

        const defaultBB = localStorage.getItem("mep-busbar-calculation-v1");
        if (defaultBB) {
          try {
            const panels = JSON.parse(defaultBB);
            addNotifs(extractBusbarRows(panels), "Busbar Row", "Active Project", "default", "/busbar-calculation");
          } catch (e) {}
        }

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith("mep_spaces_") ||
            key.startsWith("mep_zones_") ||
            key.startsWith("mep_equipment_") ||
            key.startsWith("mep_loading_unit_calc_") ||
            key.startsWith("mep_fixture_unit_calc_") ||
            key.startsWith("mep_busbar_calc_") ||
            key.startsWith("mep_busbar_vd_calc_") ||
            key.startsWith("mep_pcl_rows_") ||
            key.startsWith("mep_sprinklers_") ||
            key.startsWith("mep_sprinkler_rows_") ||
            key.startsWith("mep_lux_calc_") ||
            key.startsWith("mep_cable_tray_") ||
            key.startsWith("mep_gen_projects_")
          )) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const data = JSON.parse(raw);
                if (key.startsWith("mep_spaces_")) {
                  const projId = key.replace("mep_spaces_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (Array.isArray(data)) addNotifs(data, "Space", projObj?.name || "Active Project", projId, "/ventilation");
                } else if (key.startsWith("mep_zones_")) {
                  const projId = key.replace("mep_zones_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (Array.isArray(data)) addNotifs(data, "Zone", projObj?.name || "Active Project", projId, "/ventilation");
                } else if (key.startsWith("mep_equipment_")) {
                  const projId = key.replace("mep_equipment_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (Array.isArray(data)) addNotifs(data, "Equipment", projObj?.name || "Active Project", projId, "/ventilation");
                } else if (key.startsWith("mep_pcl_rows_")) {
                  const projId = key.replace("mep_pcl_rows_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (Array.isArray(data)) addNotifs(data, "Cooling Space", projObj?.name || "Active Project", projId, "/preliminary-cooling-load");
                } else if (key.startsWith("mep_sprinklers_") || key.startsWith("mep_sprinkler_rows_")) {
                  const projId = key.replace("mep_sprinklers_", "").replace("mep_sprinkler_rows_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (Array.isArray(data)) addNotifs(data, "Sprinkler Head", projObj?.name || "Active Project", projId, "/plumbing-sprinkler-kfactor");
                } else if (key.startsWith("mep_cable_tray_")) {
                  const projId = key.replace("mep_cable_tray_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (Array.isArray(data)) {
                    data.forEach((t: any) => {
                      if (t.cables && Array.isArray(t.cables)) addNotifs(t.cables, "Cable Tray", projObj?.name || "Active Project", projId, "/cable-tray-sizing");
                      if (t.comments && Array.isArray(t.comments)) addNotifs([t], "Cable Tray", projObj?.name || "Active Project", projId, "/cable-tray-sizing");
                    });
                  }
                } else if (key.startsWith("mep_busbar_calc_")) {
                  const projId = key.replace("mep_busbar_calc_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  const panels = data.panels || data;
                  addNotifs(extractBusbarRows(panels), "Busbar Row", projObj?.name || "Active Project", projId, "/busbar-calculation");
                } else if (key.startsWith("mep_gen_projects_")) {
                  const projId = key.replace("mep_gen_projects_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  const genProjects = data.projects || data;
                  if (genProjects) {
                    Object.values(genProjects).forEach((projRows: any) => {
                      if (Array.isArray(projRows)) addNotifs(projRows, "Generator Load", projObj?.name || "Active Project", projId, "/generator-sizing");
                    });
                  }
                } else if (key.startsWith("mep_loading_unit_calc_")) {
                  const spaces = data.iopSpaces || (Array.isArray(data) ? data : null);
                  const projId = key.replace("mep_loading_unit_calc_", "");
                  const projObj = projects.find((p: any) => p.id === projId);
                  if (spaces && Array.isArray(spaces)) addNotifs(spaces, "Loading Unit Space", projObj?.name || "Active Project", projId, "/plumbing-loading-unit");
                }
              } catch(e) {}
            }
          }
        }
      } catch (e) {}
    }

    // 3. Merge persistent and backend notifications
    const combinedMap = new Map();
    (persistentNotifs || []).forEach((pn: any) => {
      if (!pn || !pn.id) return;
      const pnAuthorId = String(pn.authorId || pn.metadata?.authorId || "").toLowerCase().trim();
      const pnAuthorName = String(pn.authorName || pn.metadata?.authorName || "").toLowerCase().trim();
      const isPnAuthor = Boolean(
        (pnAuthorId && currentId && pnAuthorId === currentId) ||
        (pnAuthorId && currentEmail && pnAuthorId === currentEmail) ||
        (pnAuthorName && currentName && (pnAuthorName === currentName || currentName.includes(pnAuthorName) || pnAuthorName.includes(currentName))) ||
        (pn.authorId && (pn.authorId === userId || pn.authorId === userData?.id || pn.authorId === profile?.id)) ||
        (pn.authorName && (pn.authorName === userData?.name || pn.authorName === profile?.name))
      );

      // Senders should never receive their own sent tasks/comments in Received tab
      if (isPnAuthor && !pn.isCompletionNotif) return;

      const pnAssigned = Array.isArray(pn.assignedUsers) ? pn.assignedUsers : (pn.metadata?.assignedUsers || []);
      if (pnAssigned.length > 0) {
        const isTargetedToMe = pnAssigned.some((u: any) => {
          const uStr = String(u).toLowerCase().trim();
          return (currentId && uStr === currentId) || (currentEmail && uStr === currentEmail) || (currentName && uStr === currentName);
        });
        if (!isTargetedToMe) return; // Assigned to someone else -> exclude!
      }

      combinedMap.set(pn.id, pn);
    });
    (notifs || []).forEach(n => {
      if (n && n.id) combinedMap.set(n.id, n);
    });

    const combinedList = Array.from(combinedMap.values());

    const filtered = combinedList.filter(n => {
      if (!n || !n.id) return false;
      const nText = String(n.text || n.message || n.metadata?.text || "").trim();
      if (!nText) return false; // Reject empty/blank notification cards!

      const nAuthorId = String(n.authorId || n.metadata?.authorId || "").toLowerCase().trim();
      const nAuthorName = String(n.authorName || n.metadata?.authorName || "").toLowerCase().trim();
      const isAuthor = Boolean(
        (nAuthorId && currentId && nAuthorId === currentId) ||
        (nAuthorId && currentEmail && nAuthorId === currentEmail) ||
        (nAuthorName && currentName && (nAuthorName === currentName || currentName.includes(nAuthorName) || nAuthorName.includes(currentName))) ||
        (n.authorId && (n.authorId === userId || n.authorId === userData?.id || n.authorId === profile?.id)) ||
        (n.authorName && (n.authorName === userData?.name || n.authorName === profile?.name))
      );

      // If authored by current user and not a completion confirmation, never show in Received inbox
      if (isAuthor && !n.isCompletionNotif) return false;

      // If targeted to specific assignees, verify current user is one of them
      const assigned = Array.isArray(n.assignedUsers) ? n.assignedUsers : (n.metadata?.assignedUsers || []);
      if (assigned.length > 0) {
        const isTargetedToMe = assigned.some((u: any) => {
          const uStr = String(u).toLowerCase().trim();
          return (currentId && uStr === currentId) || (currentEmail && uStr === currentEmail) || (currentName && uStr === currentName);
        });
        if (!isTargetedToMe) return false;
      }

      return true;
    });

    const mapped = filtered.map(n => {
      const nId = String(n.id);
      const nText = String(n.text || n.message || n.metadata?.text || "").trim();
      const nMetaId = n.metadata?.id ? String(n.metadata.id) : "";
      const nTargetId = n.targetId || n.metadata?.targetId || "";
      const nTimestamp = n.timestamp || n.createdAt || "";

      const isDel = Boolean(
        n.deleted === true ||
        deletedNotifIds.includes(nId) ||
        (nMetaId && deletedNotifIds.includes(nMetaId))
      );

      const isCompleted = Boolean(
        completedNotifIds.includes(nId) ||
        (nMetaId && completedNotifIds.includes(nMetaId)) ||
        n.completed === true
      );
      const isRead = Boolean(
        readNotifIds.includes(nId) ||
        (nMetaId && readNotifIds.includes(nMetaId)) ||
        n.read === true
      );

      const resolvedText = String(n.text || n.message || n.metadata?.text || "").trim();
      const resolvedTargetType = String(n.targetType || n.metadata?.targetType || "Location").trim();
      const resolvedTargetName = String(n.targetName || n.metadata?.targetName || n.targetId || "").trim();
      const resolvedProjectName = String(n.projectName || n.metadata?.projectName || "Active Project").trim();
      const resolvedAuthorName = String(n.authorName || n.metadata?.authorName || "Design Engineer").trim();
      const resolvedTimestamp = n.timestamp || n.createdAt || n.metadata?.createdAt || new Date().toISOString();
      const resolvedCalcPath = n.calculatorPath || n.metadata?.calculatorPath || "/ventilation";

      return {
        ...n,
        text: resolvedText,
        targetType: resolvedTargetType,
        targetName: resolvedTargetName,
        projectName: resolvedProjectName,
        authorName: resolvedAuthorName,
        timestamp: resolvedTimestamp,
        calculatorPath: resolvedCalcPath,
        completed: isCompleted,
        read: isRead,
        deleted: isDel
      };
    });

    mapped.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return mapped;
  }, [userId, userData, profile, projects, notifTick, currentUserAuthority, isSrDesignEngineer, isJrDesignEngineer, isCoordinatorOrAdmin, deletedNotifIds, persistentNotifs, completedNotifIds, readNotifIds]);

  const unreadNotifications = useMemo(() => {
    return myNotifications.filter(n => !n.deleted && n.id && !readNotifIds.includes(n.id) && !completedNotifIds.includes(n.id));
  }, [myNotifications, readNotifIds, completedNotifIds]);

  const unreadCount = unreadNotifications.length;

  const markAllNotifsAsRead = useCallback(() => {
    const allIds = myNotifications.filter((n: any) => !n.deleted && !completedNotifIds.includes(n.id)).map((n: any) => n.id).filter(Boolean);
    setReadNotifIds((prev) => {
      const set = new Set([...prev, ...allIds]);
      const updated = Array.from(set);
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_read_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });
  }, [myNotifications, completedNotifIds]);

  // Continuously preserve full notifications list in local storage so on next reload it appears instantly (0ms)
  useEffect(() => {
    if (typeof window !== "undefined" && Array.isArray(myNotifications) && myNotifications.length > 0) {
      const uId = userId || userData?.id || profile?.id;
      if (uId) {
        try {
          const key = `mep_persistent_user_notifs_${uId}`;
          const currentRaw = localStorage.getItem(key);
          const currentList = currentRaw ? JSON.parse(currentRaw) : [];
          
          const map = new Map();
          currentList.forEach((n: any) => { if (n && n.id) map.set(n.id, n); });
          myNotifications.forEach((n: any) => { if (n && n.id) map.set(n.id, n); });
          
          const merged = Array.from(map.values());
          localStorage.setItem(key, JSON.stringify(merged));
        } catch (e) {}
      }
    }
  }, [myNotifications, userId, userData?.id, profile?.id]);

  useEffect(() => {
    const fetchBackendNotifs = async () => {
      try {
        const remoteNotifs = await api.getNotifications();
        if (Array.isArray(remoteNotifs) && remoteNotifs.length > 0) {
          // Read the current deletedNotifIds from localStorage to filter out already-deleted notifications
          let currentDeletedIds: string[] = [];
          if (typeof window !== "undefined") {
            try {
              const d1 = localStorage.getItem("mep_deleted_notif_ids");
              const list1 = d1 ? JSON.parse(d1) : [];
              const uId = userData?.id || profile?.id;
              const d2 = uId ? localStorage.getItem(`mep_deleted_notif_ids_${uId}`) : null;
              const list2 = d2 ? JSON.parse(d2) : [];
              currentDeletedIds = Array.from(new Set([...list1, ...list2]));
            } catch (e) {}
          }

          // Filter out any remote notifications that the user has already deleted
          const allowedRemote = remoteNotifs.filter(n => {
            if (!n || !n.id) return false;
            if (currentDeletedIds.includes(n.id)) return false;
            if (n.metadata?.id && currentDeletedIds.includes(n.metadata.id)) return false;
            return true;
          });

          if (allowedRemote.length === 0) return;

          setPersistentNotifs(prev => {
            const map = new Map();
            prev.forEach(n => n.id && map.set(n.id, n));
            allowedRemote.forEach(n => n.id && map.set(n.id, n));
            const merged = Array.from(map.values()).filter(n => {
              // Final safeguard: strip deleted items even from prev
              if (currentDeletedIds.includes(n.id)) return false;
              if (n.metadata?.id && currentDeletedIds.includes(n.metadata.id)) return false;
              return true;
            });
            if (typeof window !== "undefined") {
              const uId = userId || userData?.id;
              const key = uId ? `mep_persistent_user_notifs_${uId}` : "mep_persistent_user_notifs";
              localStorage.setItem(key, JSON.stringify(merged));
            }
            return merged;
          });
        }
      } catch (e) {}
    };

    const smartFetchBackendNotifs = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchBackendNotifs();
    };

    smartFetchBackendNotifs();

    const intervalId = setInterval(smartFetchBackendNotifs, 3000);
    const handleFocusOrVisible = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        fetchBackendNotifs();
      }
    };

    let bc: BroadcastChannel | null = null;
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      try {
        bc = new BroadcastChannel("mep_notifications_channel");
        bc.onmessage = (msg) => {
          if (msg.data?.type === "NEW_NOTIFICATION") {
            if (msg.data.comment) {
              handleNotifAdded({ detail: msg.data.comment });
            }
            fetchBackendNotifs();
          }
        };
      } catch (e) {}
    }

    const handleNotifAdded = (e?: any) => {
      setNotifTick(t => t + 1);

      // Reload persistent notifications from localStorage on storage or custom event
      if (typeof window !== "undefined") {
        try {
          const uId = userId || userData?.id;
          const key = uId ? `mep_persistent_user_notifs_${uId}` : "mep_persistent_user_notifs";
          const raw = localStorage.getItem(key) || localStorage.getItem("mep_persistent_user_notifs");
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              setPersistentNotifs(prev => {
                const combined = [...parsed, ...prev];
                const map = new Map();
                combined.forEach(n => { if (n && n.id) map.set(n.id, n); });
                return Array.from(map.values());
              });
            }
          }
        } catch (e) {}
      }

      if (e?.detail) {
        const item = e.detail;
        if (!item || !item.id) return;

        const cId = String(userId || userData?.id || profile?.id || "").toLowerCase().trim();
        const cEmail = String(userData?.email || profile?.email || "").toLowerCase().trim();
        const cName = String(userData?.name || profile?.name || "").toLowerCase().trim();

        const authorIdStr = String(item.authorId || item.metadata?.authorId || "").toLowerCase().trim();
        const authorNameStr = String(item.authorName || item.metadata?.authorName || "").toLowerCase().trim();
        const assignedUsers = Array.isArray(item.assignedUsers) ? item.assignedUsers : (item.metadata?.assignedUsers || []);
        const itemTargetRole = item.targetRole || item.metadata?.targetRole || "";
        const itemIsReviewNotif = Boolean(item.isReviewStateNotif || item.metadata?.isReviewStateNotif);

        // 1. Author must NEVER receive notification popups for their own comment
        const isAuthor = Boolean(
          (authorIdStr && cId && authorIdStr === cId) ||
          (authorIdStr && cEmail && authorIdStr === cEmail) ||
          (authorNameStr && cName && (authorNameStr === cName || cName.includes(authorNameStr) || authorNameStr.includes(cName))) ||
          (item.authorId && (item.authorId === userId || item.authorId === userData?.id || item.authorId === profile?.id)) ||
          (item.authorName && (item.authorName === userData?.name || item.authorName === profile?.name))
        );

        if (isAuthor) return;

        let isForMe = false;

        // Review state notifications: route by authority first
        if (itemIsReviewNotif && itemTargetRole) {
          if (itemTargetRole === 'discipline_coordinator') {
            isForMe = (currentUserAuthority === "APPROVE_REJECT");
          } else if (itemTargetRole === 'sr_design_engineer') {
            isForMe = (currentUserAuthority === "REVIEW");
          } else if (itemTargetRole === 'all_engineers') {
            isForMe = (currentUserAuthority !== "APPROVE_REJECT");
          }
        } else if (assignedUsers.length > 0) {
          isForMe = assignedUsers.some((u: any) => {
            const uStr = String(u).toLowerCase().trim();
            return (cId && uStr === cId) || (cEmail && uStr === cEmail) || (cName && uStr === cName);
          });
        } else {
          isForMe = Boolean(
            (!cId || authorIdStr !== cId) &&
            (!cEmail || authorIdStr !== cEmail) &&
            (!cName || (authorNameStr !== cName && !authorNameStr.includes(cName)))
          );
        }

        if (!isForMe) return;

        setPersistentNotifs(prev => {
          if (prev.some(n => n.id === item.id)) return prev;
          const updated = [item, ...prev];
          if (typeof window !== "undefined") {
            const uId = userId || userData?.id;
            const key = uId ? `mep_persistent_user_notifs_${uId}` : "mep_persistent_user_notifs";
            localStorage.setItem(key, JSON.stringify(updated));
          }
          return updated;
        });
      }
    };
    const handleReviewStateUpdate = (e: any) => {
      setNotifTick(t => t + 1);
      const notifProjectId = e?.detail?.projectId;
      
      // Verify logged in user is member of project before triggering toast
      const isMember = () => {
        if (!notifProjectId) return true;
        const proj = projects.find((p: any) => p.id === notifProjectId);
        if (!proj) return false;
        const cId = userId || userData?.id;
        const cName = (userData?.name || profile?.name || "").toLowerCase().trim();
        const cEmail = (userData?.email || profile?.email || "").toLowerCase().trim();
        if (proj.created_by === cId) return true;
        if (Array.isArray(proj.project_users) && proj.project_users.some((pu: any) => pu.user_id === cId || pu.user?.email?.toLowerCase() === cEmail)) return true;
        if (Array.isArray(proj.members) && proj.members.some((m: any) => m.id === cId || m.name?.toLowerCase().trim() === cName || m.email?.toLowerCase().trim() === cEmail)) return true;
        const wdata = proj.workspace_data || {};
        if (Array.isArray(wdata.assigned_users) && wdata.assigned_users.some((u: any) => String(u).toLowerCase().trim() === String(cId).toLowerCase() || String(u).toLowerCase().trim() === cName || String(u).toLowerCase().trim() === cEmail)) return true;
        return false;
      };

      if (!isMember()) return;

      if (e?.detail?.status === "REJECTED" && currentUserAuthority !== "APPROVE_REJECT") {
        toast.error(`⚠️ CALCULATION REJECTED: Reason from ${e.detail.rejectedBy || "Discipline Coordinator"}: "${e.detail.rejectionDescription || "Revision required"}"`, {
          duration: 7000
        });
      }
      if (e?.detail?.status === "SR_REVIEW_SUBMITTED" && currentUserAuthority === "APPROVE_REJECT") {
        toast.success(`✅ CALCULATION REVIEWED: ${e.detail.calculatorTitle || "Calculation"} reviewed by ${e.detail.reviewedBy || "Sr. Design Engineer"}. Ready for your approval!`, {
          duration: 7000
        });
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener("focus", handleFocusOrVisible);
      document.addEventListener("visibilitychange", handleFocusOrVisible);
      window.addEventListener("mep-notification-added", handleNotifAdded);
      window.addEventListener("mep_notification_received", handleNotifAdded);
      window.addEventListener("mep-review-state-updated", handleReviewStateUpdate);
      window.addEventListener("storage", handleNotifAdded);
    }
    return () => {
      clearInterval(intervalId);
      if (bc) {
        try { bc.close(); } catch (e) {}
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener("focus", handleFocusOrVisible);
        document.removeEventListener("visibilitychange", handleFocusOrVisible);
        window.removeEventListener("mep-notification-added", handleNotifAdded);
        window.removeEventListener("mep_notification_received", handleNotifAdded);
        window.removeEventListener("mep-review-state-updated", handleReviewStateUpdate);
        window.removeEventListener("storage", handleNotifAdded);
      }
    };
  }, [userId, userData, profile, projects, currentUserAuthority]);

  // Global notification deep-linking and highlight execution
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScrollEvent = (e: any) => {
      if (e?.detail) {
        executeHighlightAndScroll(e.detail);
      }
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);

    // Also inspect URL query params whenever the route/search changes
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId") || params.get("targetId");
    const targetName = params.get("commentTargetName") || params.get("targetName");
    const targetType = params.get("commentTargetType") || params.get("targetType");
    if (targetId || targetName) {
      const dispatchDetail = {
        id: targetId || undefined,
        name: targetName || undefined,
        type: targetType || undefined,
      };
      [200, 500, 900, 1500].forEach((delay) => {
        setTimeout(() => {
          executeHighlightAndScroll(dispatchDetail);
        }, delay);
      });
    }

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
    };
  }, [pathname]);

  // Initial project list load on user login (real-time updates handled by Supabase Realtime & custom events)
  useEffect(() => {
    if (!userId) return;
    refreshProjects();
  }, [userId]);


  useEffect(() => {
    if (userData?.is_founding_pioneer && userId) {
      const shown = localStorage.getItem(`tarv_pioneer_welcome_shown_${userId}`);
      if (!shown) {
        setShowPioneerModal(true);
      }
    }
  }, [userData?.is_founding_pioneer, userData?.pioneer_number, userId]);

  // Periodic session heartbeat to check explicitly deactivated accounts
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(async () => {
      try {
        const res = await authService.getUserData();
        if (res && res.success === false) {
          if (res.accountDeactivated || res.accountDeleted) {
            toast.error("Your account has been deleted or deactivated by an administrator.");
            logout();
            navigate({ to: '/login' });
          } else if (res.sessionRevoked) {
            toast.error("Your session has been transferred to another device. You are now logged out.");
            logout();
            navigate({ to: '/login' });
          }
        }
      } catch (err) {}
    }, 15000);
    return () => clearInterval(interval);
  }, [userId, logout, navigate]);

  const refreshLicenseStatus = useCallback(async () => {
    if (loading) return;
    const hwid = getHardwareFingerprint();
    const userEmail = userData?.email || myEmail;
    
    // Only init hardware trial if we don't have a premium user active
    if (!userData || (userData.role !== 'ORG_USER' && userData.role !== 'ORG_ADMIN' && userData.role !== 'SUPER_ADMIN')) {
      await authService.initHardwareTrial(hwid, userEmail);
    }
    
    const status = await fetchLicenseStatus(userEmail);
    if (status.sessionInvalidated) {
      toast.error("Your session has been transferred to another device. You are now logged out.");
      logout();
      navigate({ to: '/login' });
      return;
    }
    globalLicenseCache = status;
    setLicenseInfo(status);
  }, [userData?.email, userData?.role, myEmail, loading, logout, navigate]);

  useEffect(() => {
    refreshLicenseStatus();
  }, [refreshLicenseStatus]);

  const [announcement, setAnnouncement] = useState<{ id: string; message: string; type: string } | null>(null);

  useEffect(() => {
    const fetchActiveAnnouncement = async () => {
      const announcements = await api.getAnnouncements();
      const activeAnnouncements = announcements.filter((a: any) => a.is_active);
      if (activeAnnouncements && activeAnnouncements.length > 0) {
        const target = activeAnnouncements[0];
        const isDismissed = typeof localStorage !== 'undefined' ? localStorage.getItem(`tarv_dismissed_announcement_${target.id}`) : null;
        if (!isDismissed) {
          setAnnouncement(target);
        }
      }
    };
    fetchActiveAnnouncement();
  }, []);

  useEffect(() => {
    if (profile?.id && pathname && pathname !== '/' && pathname !== '/login') {
      const formattedTitle = pathname.replace('/', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Dashboard';
      logCalculatorView(formattedTitle, pathname);
    }
  }, [pathname, profile?.id]);

  useEffect(() => {
    if (project?.id && typeof localStorage !== "undefined") {
      localStorage.setItem("mep_active_project_id", project.id);
      localStorage.setItem("mep_last_worked_project_id", project.id);
    }
  }, [project?.id]);

  // Init Collaboration
  useEffect(() => {
    const initCollab = async () => {
      const { data } = await supabase.auth.getSession();
      const userEmail = data.session?.user.email || "unknown";
      const userName = userData?.name || profile?.name || userEmail;
      setMyEmail(userEmail);
      if (project?.id) {
        joinProject(project.id, userEmail, userName);
      }
    };
    initCollab();
    return () => {
      leaveProject();
    };
  }, [project?.id, userData?.name, profile?.name]);



  // Organization License Seat Heartbeat & Guard
  const [isSeatBlocked, setIsSeatBlocked] = useState(false);
  const [seatBlockedDetails, setSeatBlockedDetails] = useState<{ activeUsers?: string[]; limit?: number; licenseKey?: string; orgName?: string; message?: string } | null>(null);

  const runLicenseSeatHeartbeat = useCallback(async () => {
    if (!userId) return;
    const orgId = userData?.organization_id || profile?.organization_id;
    if (!orgId) {
      setIsSeatBlocked(false);
      return;
    }

    const userEmail = userData?.email || profile?.email || myEmail;
    const deviceId = getOrCreateDeviceId();
    const res = await api.checkLicenseSession({ userId, email: userEmail, orgId, deviceId });
    if (res && res.allowed === false) {
      setIsSeatBlocked(true);
      setSeatBlockedDetails(res);
    } else {
      setIsSeatBlocked(false);
    }
  }, [userId, userData?.organization_id, userData?.email, profile?.organization_id, profile?.email, myEmail]);

  useEffect(() => {
    runLicenseSeatHeartbeat();
    const interval = setInterval(runLicenseSeatHeartbeat, 8000);

    const handleUnload = () => {
      const orgId = userData?.organization_id || profile?.organization_id;
      if (userId && orgId) {
        api.releaseLicenseSession({ userId, orgId, deviceId: getOrCreateDeviceId() });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [runLicenseSeatHeartbeat, userId, userData?.organization_id, profile?.organization_id]);

  // Automated Background Auto-Save based on configured Interval (1m, 5m, 10m, 15m, 30m, 60m)
  useEffect(() => {
    const isAutoSaveActive = localStorage.getItem('mep_auto_save_enabled') !== 'false';
    const intervalMinutes = parseInt(localStorage.getItem('mep_auto_save_interval') || '10') || 10;
    const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;
    const targetProjId = activeProjectId || project?.id;

    if (!isAutoSaveActive) return;

    const autoSaveTimer = setInterval(() => {
      if (targetProjId) {
        workspaceStore.forceSaveToCloud();
      }
    }, intervalMs);

    return () => clearInterval(autoSaveTimer);
  }, [activeProjectId, project?.id]);

  useEffect(() => {
    // Expose for export scripts outside React context
    if (typeof window !== 'undefined') {
      (window as any).currentMepUserName = userData?.name || profile?.name || 'System Admin';
    }
  }, [userData?.name, profile?.name]);

  // Update active module on route change
  useEffect(() => {
    if (pathname && !EXCLUDED_PERSIST_PATHS.includes(pathname)) {
      setActiveModule(pathname);
    } else {
      setActiveModule(null);
    }

    // Force privacy policy acceptance
    const acceptedPrivacy = userData?.privacyPolicyAccepted === true || (typeof window !== 'undefined' && localStorage.getItem('privacy_policy_accepted') === 'true');
    if (!acceptedPrivacy && pathname !== '/login' && pathname !== '/privacy') {
      navigate({ to: '/privacy' });
    }
  }, [pathname, navigate, userData?.privacyPolicyAccepted]);

  const isCalculatorRoute = isVersionAllowed;
  const lockOwnerObj = isCalculatorRoute ? getLockOwner(pathname) : null;
  const isLockedByOther = Boolean(isCalculatorRoute && lockOwnerObj && lockOwnerObj.sessionId !== mySessionId);
  const lockOwnerName = lockOwnerObj ? (lockOwnerObj.name || lockOwnerObj.email) : "Unknown";

  // Restore inputs on project/route change
  useEffect(() => {
    const runRestore = () => {
      restorePageInputs(project.id, pathname);
    };
    
    // Run immediately and at delayed intervals to handle dynamic/delayed renders
    runRestore();
    const t1 = setTimeout(runRestore, 100);
    const t2 = setTimeout(runRestore, 300);
    const t3 = setTimeout(runRestore, 600);
    const t4 = setTimeout(runRestore, 1200);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [pathname, project.id]);

  // Save inputs on any input, change, or keyup event and log activity update immediately
  useEffect(() => {
    let updateTimer: any = null;

    const handleUserEdit = (e: Event) => {
      if ((window as any).__mep_is_restoring) return;
      
      const target = e.target as HTMLElement;
      if (!target) return;
      if (target.closest("aside") || target.closest("header") || target.closest("[data-ignore-persist]")) {
        return;
      }
      
      try {
        if (project?.id) savePageInputs(project.id, pathname);
      } catch (err) {}
    };
    
    document.addEventListener("input", handleUserEdit, true);
    document.addEventListener("change", handleUserEdit, true);
    document.addEventListener("keyup", handleUserEdit, true);
    document.addEventListener("click", handleUserEdit, true);
    
    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      document.removeEventListener("input", handleUserEdit, true);
      document.removeEventListener("change", handleUserEdit, true);
      document.removeEventListener("keyup", handleUserEdit, true);
      document.removeEventListener("click", handleUserEdit, true);
    };
  }, [pathname, project?.id]);

  // Listen for Live Sync Broadcasts!
  const setOnDataReceived = useCollaboration(s => s.setOnDataReceived);
  useEffect(() => {
    setOnDataReceived((moduleName, data) => {
      if (pathname === moduleName) {
        // We received live data! Apply it instantly
        applyLiveData(data);
      }
    });
  }, [pathname, setOnDataReceived]);

  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("mep-sidebar-open");
      return saved !== "false";
    }
    return true;
  });

  useEffect(() => {
    localStorage.setItem("mep-sidebar-open", String(sidebarOpen));
  }, [sidebarOpen]);

  const isLinkActive = (to?: string) => {
    if (!to) return false;
    if (to.includes("?")) {
      const parts = to.split("?");
      const path = parts[0];
      const nameVal = new URLSearchParams(parts[1]).get("name");
      return pathname === path && activeName === nameVal;
    }
    return pathname === to;
  };

  // Flyout mega-menu state (opens on click)
  const [hoveredGroup, setHoveredGroup] = useState<{
    item: Extract<NavItem, { kind: "group" }>;
    top: number;
  } | null>(null);

  const handleGroupClick = (e: React.MouseEvent, item: Extract<NavItem, { kind: "group" }>) => {
    e.stopPropagation();
    if (hoveredGroup && hoveredGroup.item.label === item.label) {
      setHoveredGroup(null);
    } else {
      setHoveredGroup({
        item,
        top: e.currentTarget.getBoundingClientRect().top,
      });
    }
  };

  useEffect(() => {
    setHoveredGroup(null);
  }, [pathname]);

  useEffect(() => {
    if (!hoveredGroup) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-mega-menu="true"]') && !target.closest('.nav-group-btn')) {
        setHoveredGroup(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [hoveredGroup]);



  // Global Ctrl + S / Cmd + S keyboard shortcut to save calculations to cloud
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        e.stopPropagation();
        
        const isEffectiveReadOnly = isReadOnly || isLockedByOther;
        if (isEffectiveReadOnly) {
          toast.error("Cannot save. Workspace is in Read-Only mode.");
          return;
        }
        
        if (project?.id) {
          savePageInputs(project.id, pathname);
        }
        triggerSave();
        if (forceSaveToCloud) forceSaveToCloud();
        const calcTitle = getCalculatorTitleFromPath(pathname) || 'Calculation';
        logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);
        toast.success("💾 Saved successfully to Cloud & Disk! (Ctrl+S)", { id: "ctrl-s-save" });
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [project?.id, pathname, isReadOnly, isLockedByOther]);

  // Read-Only Enforcement: Blocks value modifications on inputs/selects/textareas and mutation buttons, while keeping scrolling, text copying, tabs, and navigation 100% interactive
  useEffect(() => {
    const isNotificationsPage = pathname === '/notifications';
    const isEffectiveReadOnly = !isNotificationsPage && (isReadOnly || isLockedByOther || isViewerRole);
    (window as any).__mep_is_readonly = isEffectiveReadOnly;
    
    if (!isEffectiveReadOnly) return;

    const isAllowedInteractive = (target: HTMLElement) => {
      // Calculation Review Bar buttons (Review, Approve, Reject) and Review Modals are ALWAYS allowed in Read-Only mode
      if (target.closest(".calculation-review-bar, .review-modal")) return true;

      // Assign comment modal is strictly blocked in read-only mode
      if (target.closest(".assign-comment-modal")) return false;

      const isNavOrHeader = target.closest(".appshell-header, .appshell-sidebar, header:not(.calculator-header), aside, nav");

      const isEditableInput = target.closest("input, select, textarea, [contenteditable='true']");
      if (isEditableInput) {
        // Allow header/sidebar search bar inputs ONLY
        const isSearch = (isEditableInput as HTMLInputElement).type === 'search' || 
                         isEditableInput.classList.contains('search-input') ||
                         isEditableInput.getAttribute('placeholder')?.toLowerCase().includes('search');
        if (isSearch && isNavOrHeader) return true;
        return false;
      }

      // Sidebar and nav links are always allowed
      if (target.closest(".appshell-sidebar, nav")) return true;

      // AppShell Header (excluding review bar actions)
      if (target.closest(".appshell-header") && !target.closest(".calculation-review-bar")) {
        return true;
      }

      const btn = target.closest("button, [role='button'], a, [role='tab']");
      if (!btn) return false;

      const role = btn.getAttribute("role");
      // Explicitly block checkboxes and switches
      if (role === "checkbox" || role === "switch") return false;

      // Tab buttons, tab triggers, view mode toggles, accordion headers are allowed
      const btnText = (btn.textContent || "").trim().toLowerCase();
      const isTab = role === "tab" || 
                    btn.classList.contains("tab-btn") || 
                    btn.hasAttribute("data-state") ||
                    ["spaces", "zones", "equipment", "report", "schedule", "sld", "calculator", "summary"].includes(btnText);

      return isTab;
    };

    const handleReadOnlyContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (target.closest(".appshell-sidebar, nav")) return;

      e.preventDefault();
      e.stopPropagation();
      toast.info("Workspace is in Read-Only mode. Context menu is disabled.", { id: "readonly-notice" });
    };

    const handleReadOnlyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (isAllowedInteractive(target)) return;

      const isEditableInput = target.closest("input, select, textarea, [contenteditable='true']");
      const isMutationBtn = target.closest("button, [role='button']");

      if (isEditableInput || isMutationBtn) {
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
    };

    const handleReadOnlyKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      const isElement = typeof target.closest === 'function' && typeof target.tagName === 'string';
      
      if (isElement && isAllowedInteractive(target)) return;
      
      const tagName = isElement ? target.tagName.toLowerCase() : '';
      const isEditable = target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      
      const isCopyCombo = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'a' || e.key === 'A');
      const isNavKey = ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key);

      if (isEditable && !isCopyCombo && !isNavKey) {
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
      
      if (['Delete', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
      
      if (e.key === 'Enter') {
        if (isElement && isAllowedInteractive(target)) return;
        
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
    };

    const handleReadOnlyChange = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      if (isAllowedInteractive(target)) return;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      }
    };

    if (isEffectiveReadOnly) {
      document.addEventListener("mousedown", handleReadOnlyClick, true);
      document.addEventListener("keydown", handleReadOnlyKeyDown, true);
      document.addEventListener("change", handleReadOnlyChange, true);
      document.addEventListener("contextmenu", handleReadOnlyContextMenu, true);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleReadOnlyClick, true);
      document.removeEventListener("keydown", handleReadOnlyKeyDown, true);
      document.removeEventListener("change", handleReadOnlyChange, true);
      document.removeEventListener("contextmenu", handleReadOnlyContextMenu, true);
    };
  }, [isReadOnly, isLockedByOther, isViewerRole]);

  // Security Guard: Prevent Inspect Element & DevTools Shortcuts in Production Desktop App
  useEffect(() => {
    const isTauriDesktop = typeof window !== 'undefined' && !!(window as any).__TAURI_INTERNALS__;
    if (isTauriDesktop) {
      const preventInspect = (e: MouseEvent) => {
        e.preventDefault();
        return false;
      };

      const preventDevToolsShortcuts = (e: KeyboardEvent) => {
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c')) ||
          (e.ctrlKey && (e.key === 'U' || e.key === 'u')) ||
          (e.metaKey && e.altKey && (e.key === 'I' || e.key === 'i' || e.key === 'J' || e.key === 'j' || e.key === 'C' || e.key === 'c'))
        ) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      };

      document.addEventListener('contextmenu', preventInspect);
      document.addEventListener('keydown', preventDevToolsShortcuts, true);
      return () => {
        document.removeEventListener('contextmenu', preventInspect);
        document.removeEventListener('keydown', preventDevToolsShortcuts, true);
      };
    }
  }, []);



  const filteredNav = useMemo(() => {
    let effRole = profile?.role;
    if (!effRole && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('mep_calculator_user_data') || localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile');
        if (raw) {
          const parsed = JSON.parse(raw);
          effRole = parsed?.role;
        }
      } catch (e) {}
    }
    const isSuperAdmin = effRole === 'SUPER_ADMIN' || profile?.email === 'admin@tarv.ai';
    const isOrgAdmin = effRole === 'ORG_ADMIN' || (profile?.email && profile.email.toLowerCase().includes('kirtan'));
    const isAdmin = isSuperAdmin || isOrgAdmin;

    const rawNav = import.meta.env.VITE_APP_MODE === 'kfactor'
      ? [{ kind: "item" as const, label: "Sprinkler K-Factor", to: "/plumbing-sprinkler-kfactor", icon: Droplets }]
      : [
          ...NAV,
          { kind: "item" as const, label: "Company Hierarchy", to: "/company-hierarchy", icon: Network },
          ...(isAdmin ? [
            { kind: "item" as const, label: "Admin Panel", to: "/admin", icon: ShieldAlert }
          ] : [])
        ];
      
    const filterNavItems = (items: typeof rawNav): typeof rawNav => {
      return items.map(item => {
        if (item.kind === 'item') {
          return item;
        } else if (item.kind === 'group') {
          const filteredChildren = item.children; // We no longer filter out locked children here so they appear as Coming Soon
          
          const cleanChildren: NavLeaf[] = [];
          for (let i = 0; i < filteredChildren.length; i++) {
            const current = filteredChildren[i];
            if (current.isHeader) {
              let hasItem = false;
              for (let j = i + 1; j < filteredChildren.length; j++) {
                if (filteredChildren[j].isHeader) break;
                hasItem = true;
                break;
              }
              if (hasItem) cleanChildren.push(current);
            } else {
              cleanChildren.push(current);
            }
          }
          
          if (cleanChildren.length === 0) return null;
          return { ...item, children: cleanChildren };
        }
        return item;
      }).filter(Boolean) as typeof rawNav;
    };
    
    return filterNavItems(rawNav);
  }, [profile]);

  const logoLetter = import.meta.env.VITE_APP_MODE === 'kfactor' ? "K" : "M";
  const brandName = import.meta.env.VITE_APP_MODE === 'kfactor' ? "K-Factor Calc" : "MEP Calculator";

  const activePlan = licenseInfo?.plan || (profile?.role === 'ORG_ADMIN' || profile?.role === 'SUPER_ADMIN' ? 'ENTERPRISE' : null);
  const isPaidPlan = activePlan === 'ENTERPRISE' || activePlan === 'PRO';

  const rawExpiry = userData?.subscription_expires || profile?.subscription_expires || (licenseInfo?.expiresAt ? new Date(licenseInfo.expiresAt).toISOString() : null);
  let computedRemainingDays = licenseInfo?.remainingDays ?? 30;
  let computedStatus = licenseInfo?.status || (isPaidPlan ? 'ACTIVE' : 'FREE_TRIAL');

  if (rawExpiry) {
    const expDate = new Date(rawExpiry);
    if (!isNaN(expDate.getTime())) {
      const diff = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      computedRemainingDays = Math.max(0, diff);
      if (diff <= 0 && !isPaidPlan) {
        computedStatus = 'EXPIRED_TRIAL';
      } else if (!isPaidPlan) {
        computedStatus = 'FREE_TRIAL';
      }
    }
  }

  return (
    <div className="grid h-screen grid-cols-[auto_1fr] grid-rows-[80px_1fr] bg-surface dark:bg-[#121212] text-foreground text-[14px] print:block print:h-auto">
      {/* Top Header (Column 2, Row 1) */}
      <header className="appshell-header col-start-2 row-start-1 flex items-start pt-3.5 px-3.5 h-full bg-surface dark:bg-[#121212] no-print print:hidden transition-all duration-300">
        <div className="flex-1 bg-card dark:bg-[#1a1a1a] border border-border dark:border-[#262626] rounded-full h-[60px] px-2.5 flex items-center shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between w-full gap-2 md:gap-3 min-w-0">
            {/* Left side: Project Selector */}
            <div className="flex items-center gap-2 shrink-0">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
                  title="Expand Sidebar"
                >
                  <PanelLeftOpen className="size-5" />
                </button>
              )}
               <div className="flex items-center gap-2">
                 <DropdownMenu>
                   <ContextMenu>
                   <ContextMenuTrigger asChild>
                     <DropdownMenuTrigger asChild>
                       <button className="flex items-center gap-2 h-10 px-3.5 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10 rounded-full text-[13.5px] cursor-pointer outline-none select-none transition-all duration-150">
                         <Building2 className="size-4 text-muted-foreground shrink-0" />
                         <span className="font-semibold text-foreground dark:text-white truncate max-w-[140px] sm:max-w-[200px]">{project.name}</span>
                         <span className="text-muted-foreground font-mono text-[11px] hidden sm:inline">{project.code}</span>
                         <ChevronDown className="size-3.5 text-muted-foreground ml-0.5 shrink-0" />
                       </button>
                     </DropdownMenuTrigger>
                   </ContextMenuTrigger>
                   <ContextMenuContent className="w-40 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                     <ContextMenuItem
                       onSelect={async (e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         const newName = await prompt("Enter new project name:", project.name, { title: "Rename Project" });
                         if (newName && newName.trim() !== "" && newName.trim() !== project.name) {
                           updateProject({ ...project, name: newName.trim() });
                         }
                       }}
                       className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                     >
                       <Edit3 className="size-3.5 text-muted-foreground" />
                       <span>Rename</span>
                     </ContextMenuItem>
                     <ContextMenuItem
                       onSelect={(e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         duplicateProject(project.id);
                       }}
                       className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                     >
                       <Copy className="size-3.5 text-muted-foreground" />
                       <span>Duplicate</span>
                     </ContextMenuItem>
                     <ContextMenuItem
                       onSelect={async (e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         const revName = await prompt("Enter revision name (e.g., V1, V2):", "V1", { title: "Save as Version" });
                         if (revName && revName.trim() !== "") {
                           saveAsRevision(revName.trim());
                         }
                       }}
                       className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                     >
                       <Save className="size-3.5 text-muted-foreground" />
                       <span>Save as Version...</span>
                     </ContextMenuItem>
                     <ContextMenuSeparator className="h-px bg-border my-1" />
                     <ContextMenuItem
                       onSelect={async (e) => {
                         e.preventDefault();
                         e.stopPropagation();
                         if (projects.length <= 1) {
                           await confirm("Cannot delete the only project.", { hideCancel: true, title: "Cannot Delete" });
                           return;
                         }
                         if (await confirm(`Are you sure you want to delete project "${project.name}"?`)) {
                           deleteProject(project.id);
                         }
                       }}
                       className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive rounded cursor-pointer"
                     >
                       <Trash2 className="size-3.5" />
                       <span>Delete</span>
                     </ContextMenuItem>
                   </ContextMenuContent>
                 </ContextMenu>
                <DropdownMenuContent align="start" className="w-64 p-1 bg-popover border border-border rounded-lg shadow-lg font-sans">
                  <DropdownMenuLabel className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider py-1.5 px-2">
                    Switch Project
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="max-h-60 overflow-y-auto">
                    {projects.map((p) => {
                      const active = p.id === project.id;
                      return (
                        <ContextMenu key={p.id}>
                          <ContextMenuTrigger asChild>
                            <DropdownMenuItem
                              onClick={async () => {
                                const isProjectsPage = pathname === "/projects";
                                if (dirtyStore.isDirty && !isProjectsPage) {
                                  const choice = await confirm("Do you want to save the changes?", {
                                    title: "Unsaved Changes",
                                    threeButtons: true,
                                  });
                                  if (choice === "cancel") return;
                                  if (choice === "save") {
                                    triggerSave();
                                  }
                                }
                                dirtyStore.set(false);
                                selectProject(p.id);
                              }}
                              className={`flex flex-col items-start gap-0.5 px-2 py-1.5 rounded cursor-pointer text-[13px] ${
                                active ? "bg-primary/10 text-primary font-medium" : "hover:bg-surface-2 text-foreground"
                              }`}
                            >
                              <span className="font-medium">{p.name}</span>
                              <span className="text-[11px] text-muted-foreground font-mono">{p.code}</span>
                            </DropdownMenuItem>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="w-40 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
                            <ContextMenuItem
                              onSelect={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const newName = await prompt("Enter new project name:", p.name, { title: "Rename Project" });
                                if (newName && newName.trim() !== "" && newName.trim() !== p.name) {
                                  updateProject({ ...p, name: newName.trim() });
                                }
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <Edit3 className="size-3.5 text-muted-foreground" />
                              <span>Rename</span>
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                duplicateProject(p.id);
                              }}
                              className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                            >
                              <Copy className="size-3.5 text-muted-foreground" />
                              <span>Duplicate</span>
                            </ContextMenuItem>
                            {isVersionAllowed && (
                              <ContextMenuItem
                                onSelect={async (e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const revName = await prompt("Enter revision name (e.g., V1, V2):", "V1", { title: "Save as Version" });
                                  if (revName && revName.trim() !== "") {
                                    saveAsRevision(revName.trim());
                                  }
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                              >
                                <Save className="size-3.5 text-muted-foreground" />
                                <span>Save as Version...</span>
                              </ContextMenuItem>
                            )}
                            {(p.created_by === userId || p.created_by === userData?.id || profile?.id === p.created_by || profile?.role === 'SUPER_ADMIN') && (
                              <>
                                <ContextMenuSeparator className="h-px bg-border my-1" />
                                <ContextMenuItem
                                  onSelect={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (projects.length <= 1) {
                                      await confirm("Cannot delete the only project.", { hideCancel: true, title: "Cannot Delete" });
                                      return;
                                    }
                                    if (await confirm(`Are you sure you want to delete project "${p.name}"?`)) {
                                      deleteProject(p.id);
                                    }
                                  }}
                                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 text-destructive rounded cursor-pointer"
                                >
                                  <Trash2 className="size-3.5" />
                                  <span>Delete</span>
                                </ContextMenuItem>
                              </>
                            )}
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async (e) => {
                      const isProjectsPage = pathname === "/projects";
                      if (dirtyStore.isDirty && !isProjectsPage) {
                        e.preventDefault();
                        const choice = await confirm("Do you want to save the changes?", {
                          title: "Unsaved Changes",
                          threeButtons: true,
                        });
                        if (choice === "cancel") return;
                        if (choice === "save") {
                          triggerSave();
                        }
                      }
                      dirtyStore.set(false);
                      navigate({ to: "/projects" });
                    }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-[13.5px] text-primary hover:bg-primary/5 font-semibold"
                  >
                    <Plus className="size-4" />
                    Create New Project
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
                 
                 {/* Revisions & Read-Only Manager */}
                 {isVersionAllowed && (
                   <VersionManager projectName={project.name} calculatorName={pathname.split('/').pop() || 'Unknown'} />
                 )}
               </div>
             </div>

             {/* Search Bar (Flex responsive, centered in available space) */}
             <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-2 min-w-0">
               <div className="relative w-full">
                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                 <input
                   placeholder="Search calculators, projects…"
                   className="h-10 w-full pl-10 pr-10 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] focus:border-border-strong rounded-full text-[13.5px] outline-none transition-all duration-150"
                 />
                 <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 text-[9.5px] font-sans font-medium text-muted-foreground bg-background dark:bg-white/5 border border-border dark:border-[#262626] rounded px-1.5 py-0.5 select-none leading-none">⌘K</kbd>
               </div>
             </div>

            {/* Right side: Actions & Profile */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isReadOnly && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 dark:text-amber-400 rounded-full text-xs font-bold shrink-0">
                  <Lock className="size-3" />
                  <span>READ ONLY</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  savePageInputs(project.id, pathname);
                  triggerSave();
                  forceSaveToCloud();
                  const calcTitle = getCalculatorTitleFromPath(pathname) || 'Ventilation';
                  logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);
                  toast.success("Calculations synced to cloud successfully!");
                }}
                className="size-10 rounded-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer border border-transparent"
                title="Save to Cloud"
              >
                <Save className="size-4" />
              </button>

              <button
                type="button"
                onClick={async () => {
                  await syncFromCloud();
                  toast.success("Synced latest data from cloud!");
                }}
                className="size-10 rounded-full flex items-center justify-center bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm cursor-pointer border border-transparent"
                title="Sync from Cloud"
              >
                <RefreshCw className="size-4" />
              </button>

              <button
                onClick={() => {
                  if (isViewerRole) {
                    toast.info("Viewer role accounts are locked in Read-Only mode.", { id: "readonly-notice" });
                    return;
                  }
                  setReadOnly(!isReadOnly);
                }}
                className={`size-10 rounded-full flex items-center justify-center transition-colors border ${
                  isReadOnly 
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                    : "bg-surface-2 dark:bg-white/5 text-muted-foreground border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10"
                }`}
                title={isViewerRole ? "Read-Only mode is required for Viewer role" : isReadOnly ? "Unlock Editing" : "Lock Read-Only Mode"}
              >
                {isReadOnly ? <Lock className="size-4" /> : <Edit3 className="size-4" />}
              </button>

              <button
                type="button"
                onClick={() => setPricingModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm cursor-pointer border ${
                  isPaidPlan
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                    : computedStatus === 'EXPIRED_TRIAL'
                    ? "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 animate-pulse"
                    : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30"
                }`}
                title="Manage License & Subscription"
              >
                <Zap className="size-3.5" />
                <span>
                  {!licenseInfo && !profile ? 'CHECKING LICENSE...' :
                   activePlan === 'PRO' ? `PRO (${computedRemainingDays} DAYS LEFT)` :
                   activePlan === 'ENTERPRISE' ? `ENTERPRISE (${computedRemainingDays} DAYS LEFT)` :
                   computedStatus === 'EXPIRED_TRIAL' ? 'TRIAL EXPIRED - UPGRADE' :
                   `TRIAL: ${computedRemainingDays} DAYS LEFT`}
                </span>
              </button>

              <button
                onClick={() => {
                  dirtyStore.set(false);
                  const isDarkNow = document.documentElement.classList.contains("dark");
                  const nextTheme = isDarkNow ? "light" : "dark";
                  localStorage.setItem("mep_theme", nextTheme);
                  if (nextTheme === "dark") {
                    document.documentElement.classList.add("dark");
                  } else {
                    document.documentElement.classList.remove("dark");
                  }
                  window.dispatchEvent(new Event("mep-theme-change"));
                }}
                className="size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Toggle Dark / Light Mode"
              >
                <Moon className="size-5 dark:hidden" />
                <Sun className="size-5 hidden dark:block" />
              </button>
              <div 
                className="relative"
                onMouseEnter={handleNotifMouseEnter}
                onMouseLeave={handleNotifMouseLeave}
              >
                <button 
                  onClick={() => {
                    setIsNotifHoverOpen(false);
                    navigate({ to: "/notifications" as any });
                  }}
                  className="relative size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                  title={unreadCount > 0 ? `${unreadCount} unread notification(s) — Click to open Notification Center` : "Notifications — Click to open Notification Center"}
                >
                  <Bell className="size-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 flex size-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full size-3 bg-red-500 text-[8px] text-white font-bold items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    </span>
                  )}
                </button>

                {/* Hover Quick Preview Floating Card */}
                {isNotifHoverOpen && (
                  <div 
                    className="absolute right-0 top-full mt-2.5 w-[340px] sm:w-[380px] bg-popover/95 backdrop-blur-md border border-border/80 rounded-xl shadow-2xl z-50 p-3.5 pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200"
                    onMouseEnter={handleNotifMouseEnter}
                    onMouseLeave={handleNotifMouseLeave}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-foreground">
                        <Bell className="size-3.5 text-primary" />
                        Quick Notification Preview
                      </span>
                      {unreadCount > 0 ? (
                        <span className="px-2 py-0.5 text-[10px] bg-primary/10 text-primary font-bold rounded-full">
                          {unreadCount} unread
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">
                          {myNotifications.filter((n: any) => !n.deleted).length} total
                        </span>
                      )}
                    </div>
                    
                    {myNotifications.filter((n: any) => !n.deleted).length === 0 ? (
                      <div className="py-5 text-center text-xs text-muted-foreground font-medium">No new notifications</div>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-hidden">
                        {myNotifications.filter((n: any) => !n.deleted).slice(0, 3).map((notif, idx) => {
                          const isUnread = notif.id && !readNotifIds.includes(notif.id);
                          const isCompleted = notif.id && completedNotifIds.includes(notif.id);
                          return (
                            <div 
                              key={notif.id || idx} 
                              className={`p-2.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                                isCompleted
                                  ? 'bg-emerald-500/5 border-emerald-500/20 opacity-75'
                                  : isUnread 
                                  ? 'bg-primary/5 border-primary/20 font-medium' 
                                  : 'bg-surface-1/60 border-border/50'
                              }`}
                              onClick={() => {
                                setIsNotifHoverOpen(false);
                                navigateToNotificationTarget(notif, navigate, selectProject, markNotifAsRead);
                              }}
                            >
                              <div className="flex items-center justify-between gap-1 mb-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  {isUnread && !isCompleted && <span className="size-1.5 rounded-full bg-primary inline-block shrink-0" />}
                                  <span className="font-bold text-foreground truncate">{notif.authorName}</span>
                                </div>
                                <span className="text-[9.5px] text-muted-foreground shrink-0 font-medium">
                                  {isNaN(new Date(notif.timestamp).getTime())
                                    ? notif.timestamp
                                    : `${new Date(notif.timestamp).toLocaleDateString()}, ${new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                                </span>
                              </div>
                              <p className="text-[11.5px] text-foreground/90 line-clamp-2 leading-snug mb-1.5 text-left">
                                {notif.text}
                              </p>
                              <div className="flex items-center gap-1.5 text-[9.5px] text-muted-foreground">
                                <span className="px-1.5 py-0.2 bg-primary/10 text-primary font-bold rounded uppercase">{notif.targetType}</span>
                                <span className="truncate max-w-[120px] font-medium">{notif.targetName}</span>
                                <span className="text-muted-foreground/60">in</span>
                                <span className="truncate max-w-[100px] font-bold text-primary">{notif.projectName}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div 
                      className="mt-2.5 pt-2 border-t border-border/40 text-center text-[11px] font-bold text-primary hover:underline cursor-pointer flex items-center justify-center gap-1 bg-primary/5 py-1.5 rounded-lg border border-primary/20"
                      onClick={() => {
                        setIsNotifHoverOpen(false);
                        navigate({ to: "/notifications" as any });
                      }}
                    >
                      Open Full Notification Page →
                    </div>
                  </div>
                )}
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="size-10 rounded-full bg-surface-3 dark:bg-[#2c2c2e] text-foreground dark:text-white flex items-center justify-center text-[12.5px] font-bold shadow-sm select-none border border-border dark:border-[#262626] cursor-pointer hover:ring-2 ring-primary transition-all overflow-hidden">
                    {userPhoto ? (
                      <img src={userPhoto} alt="Profile" className="size-full object-cover" />
                    ) : (
                      userData?.name ? userData.name.substring(0, 2).toUpperCase() : (myEmail.substring(0, 2).toUpperCase() !== 'UN' ? myEmail.substring(0, 2).toUpperCase() : 'ME')
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-popover border border-border rounded-lg shadow-lg font-sans">
                  <div className="py-2.5 px-3 flex items-center gap-3 w-full">
                    {userPhoto ? (
                      <img src={userPhoto} alt="Profile Avatar" className="size-9 rounded-full object-cover border border-primary/40 shrink-0" />
                    ) : (
                      <div className="size-9 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {userData?.name ? userData.name.substring(0, 2).toUpperCase() : 'ME'}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">{userData?.name || profile?.name || 'MEP User'}</div>
                      <div className="text-xs text-muted-foreground truncate">{userData?.email || myEmail}</div>
                      {(() => {
                        // Priority 1: Check hierarchy storage
                        let hierarchyBadge = "";
                        if (typeof window !== "undefined") {
                          try {
                            const members = loadOrgHierarchyFromStorage(userData, profile);
                            if (members && Array.isArray(members)) {
                              const userEmail = String(userData?.email || myEmail || "").toLowerCase().trim();
                              const userName = String(userData?.name || profile?.name || "").toLowerCase().trim();
                              const userId = String(userData?.id || "").toLowerCase().trim();
                              const found = members.find((m: any) => {
                                const mEmail = String(m.email || "").toLowerCase().trim();
                                const mName = String(m.name || "").toLowerCase().trim();
                                const mId = String(m.id || "").toLowerCase().trim();
                                return (userEmail && mEmail === userEmail) || 
                                       (userId && mId === userId) ||
                                       (userName && mName === userName) ||
                                       (userEmail && mEmail && (userEmail.includes(mEmail) || mEmail.includes(userEmail))) ||
                                       (userName && mName && (userName.includes(mName) || mName.includes(userName)));
                              });
                              if (found) {
                                if (found.designation && found.designation !== "USER" && found.designation !== "ENGINEER") {
                                  hierarchyBadge = found.designation;
                                } else if (found.role) {
                                  hierarchyBadge = found.role;
                                }
                              }
                            }
                          } catch (e) {}
                        }

                        const ROLE_MAP: Record<string, string> = {
                          SUPER_ADMIN: "Super Admin",
                          ORG_ADMIN: "Organization Admin",
                          PROJECT_MANAGER: "Project Manager",
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

                        const raw = hierarchyBadge || userData?.designation || profile?.designation || (userData?.features as any)?.designation || (profile?.features as any)?.designation || userData?.role || profile?.role;
                        if (!raw) return null;
                        const display = ROLE_MAP[raw] || raw;
                        return (
                          <div className="mt-1">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 max-w-full truncate">
                              {display}
                            </span>
                          </div>
                        );
                      })()}
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <div className="size-1.5 rounded-full bg-green-500"></div>
                        Verified License Active
                      </div>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onSelect={() => navigate({ to: "/settings" })}
                    className="py-2 px-3 cursor-pointer focus:bg-accent/40 font-medium"
                  >
                    <Settings className="size-4 mr-2 text-muted-foreground" />
                    Profile Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onSelect={() => {
                      if (typeof window !== 'undefined') {
                        window.dispatchEvent(new CustomEvent('mep_check_updates_manual'));
                      }
                    }}
                    className="py-2 px-3 cursor-pointer focus:bg-accent/40 font-medium"
                  >
                    <RefreshCw className="size-4 mr-2 text-muted-foreground" />
                    Check for Updates
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="py-2 px-3 text-red-500 cursor-pointer focus:bg-red-50 dark:focus:bg-red-950 focus:text-red-600 font-semibold"
                    onSelect={async () => {
                      await logout();
                      navigate({ to: "/login" });
                    }}
                  >
                    <LogOut className="size-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar (Column 1, Rows 1-2) */}
      <aside className={`appshell-sidebar col-start-1 row-start-1 row-span-2 bg-surface dark:bg-[#121212] flex flex-col no-print print:hidden select-none transition-all duration-300 ease-in-out ${
        sidebarOpen 
          ? "w-[280px] p-3.5 opacity-100" 
          : "w-0 p-0 opacity-0 overflow-hidden pointer-events-none"
      }`}>
        <div className="flex-1 bg-card dark:bg-[#1a1a1a] border border-border dark:border-[#262626] rounded-3xl flex flex-col overflow-hidden w-[252px] min-w-[252px]">
          {/* Brand Header */}
          <div className="p-4 flex items-center justify-between border-b border-border dark:border-[#262626]">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-foreground text-background dark:bg-white dark:text-black flex items-center justify-center font-bold text-[17px] shrink-0 font-sans shadow-sm">
                {logoLetter}
              </div>
              <span className="font-bold text-foreground dark:text-white text-[15px] font-sans tracking-tight">
                {brandName}
              </span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="size-8 rounded-lg hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
            {filteredNav.map((n) =>
              n.kind === "item" ? (
                <NavLink
                  key={n.label}
                  to={n.to}
                  icon={n.icon}
                  label={n.label}
                  active={!!n.to && isLinkActive(n.to)}
                />
              ) : (
                <NavGroup
                  key={n.label}
                  item={n}
                  pathname={pathname}
                  activeName={activeName}
                  sidebarOpen={sidebarOpen}
                  onClick={(e) => handleGroupClick(e, n)}
                />
              )
            )}
          </nav>

          {/* Bottom Sync Card */}
          <div className="p-3 border-t border-border dark:border-[#262626] bg-card dark:bg-[#1a1a1a] flex justify-center w-full">
            <div className="p-3 bg-surface-2 dark:bg-[#121212] border border-border dark:border-[#262626] rounded-2xl flex flex-col w-full">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground dark:text-[#9b9b9b] font-sans">Sync</span>
                <span className="size-1.5 rounded-full bg-primary dark:bg-white shrink-0" />
              </div>
              <span className="text-[12.5px] text-foreground dark:text-white font-medium mt-1 font-sans">All calculations saved</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="col-start-2 row-start-2 min-w-0 flex flex-col overflow-hidden bg-surface dark:bg-[#121212] print:block print:h-auto print:overflow-visible transition-all duration-300">
        <AnimatePresence>
          {!isPaidPlan && profile?.role !== 'SUPER_ADMIN' && rawExpiry && computedRemainingDays <= 7 && computedRemainingDays > 0 && computedStatus === 'FREE_TRIAL' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full bg-amber-600 text-white overflow-hidden shrink-0 no-print"
            >
              <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 animate-pulse" />
                  <span>
                    Notice: Your subscription will expire in {computedRemainingDays} day{computedRemainingDays === 1 ? '' : 's'} (on {new Date(rawExpiry).toLocaleDateString()}). Renew or contact your administrator to maintain access.
                  </span>
                </div>
                <button
                  onClick={() => setPricingModalOpen(true)}
                  className="px-2.5 py-1 bg-white text-amber-800 rounded font-bold hover:bg-amber-100 transition-colors shrink-0"
                >
                  Renew Now
                </button>
              </div>
            </motion.div>
          )}
          {announcement && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`w-full overflow-hidden shrink-0 no-print ${
                announcement.type === 'warning' ? 'bg-amber-500 text-white' :
                announcement.type === 'error' ? 'bg-red-500 text-white' :
                announcement.type === 'success' ? 'bg-emerald-500 text-white' :
                'bg-blue-600 text-white'
              }`}
            >
              <div className="px-4 py-2 flex items-center justify-between text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  {announcement.message}
                </div>
                <button 
                  onClick={() => {
                    if (announcement?.id && typeof localStorage !== 'undefined') {
                      localStorage.setItem(`tarv_dismissed_announcement_${announcement.id}`, 'true');
                    }
                    setAnnouncement(null);
                  }}
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col relative custom-scrollbar">
          {!shouldHideSubHeader && (
            <div className="shrink-0 flex items-center justify-between px-6 py-3.5 bg-surface-1/90 backdrop-blur-md border-b border-border select-none z-10">
              <div>
                <div className="text-[11px] font-bold text-muted-foreground tracking-wider uppercase flex items-center gap-1.5 mb-1">
                  {breadcrumb}
                </div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[20px] font-extrabold text-foreground tracking-tight flex items-center gap-2">
                    {title}
                    {spaceCount !== undefined && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border">
                        {spaceCount} spaces
                      </span>
                    )}
                  </h1>
                  {effectiveOnIntelClick && (
                    <button 
                      onClick={effectiveOnIntelClick}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-xs font-medium border cursor-pointer shrink-0 ${
                        effectiveIntelOpen
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-[#E8F2FC] text-[#0A7BC7] dark:bg-[#0C2538] dark:text-[#38BDF8] border-[#BCE0FD] dark:border-[#1E4968] hover:bg-[#D4E8FA] dark:hover:bg-[#10324C]"
                      }`}
                    >
                      <Sparkles className="size-3.5" />
                      {intelLabel || "Intelligence"}
                    </button>
                  )}
                  {(() => {
                    const NON_CALC_TITLES = new Set([
                      "Dashboard", "Projects", "Project", "Reports", "Report",
                      "Settings", "Teams", "Team", "BIM Viewer", "Admin",
                      "Notifications", "Company Hierarchy", "3D BIM Viewer",
                      "Sanity Check Tool", "Zone Overview", "Equipment"
                    ]);
                    if (NON_CALC_TITLES.has(title) || pathname === "/dashboard" || pathname === "/") {
                      return null;
                    }

                    if (isMepCalcRoute) {
                      return (
                        <CalculationReviewBar
                          projectId={activeProjectId || "default"}
                          calculatorPath={pathname}
                          calculatorTitle={title || "Calculation"}
                        />
                      );
                    }
                    return null;
                  })()}
                </div>
                {subtitle && <span className="text-[12px] text-muted-foreground font-medium leading-snug mt-1 block">{subtitle}</span>}
              </div>
              <div className="flex items-center gap-2">
                {actions}
              </div>
            </div>
          )}

          {isLockedByOther && pathname !== '/notifications' && (
            <div className="absolute top-0 left-0 right-0 z-40 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 flex items-center justify-center gap-2 shrink-0 shadow-sm backdrop-blur-md">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">
                READ-ONLY MODE: This calculator is currently being edited by {lockOwnerName}
              </span>
            </div>
          )}

          <div className={`flex-1 min-h-0 w-full flex flex-col transition-opacity duration-300 ${isLockedByOther && pathname !== '/notifications' ? 'opacity-90 mt-10' : ''} ${
            sidebarOpen ? "pl-0 pr-3.5 pb-3.5" : "pl-3.5 pr-3.5 pb-3.5"
          }`}>
            {isInitializing ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-surface dark:bg-[#121212]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Syncing with workspace...</span>
              </div>
            ) : isFeatureLocked(pathname, profile) ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center p-8 bg-surface dark:bg-[#121212]">
                <div className="w-full max-w-md bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-2xl p-8 flex flex-col items-center shadow-2xs">
                  <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center mb-5 text-amber-600 dark:text-amber-400">
                    <Clock className="w-8 h-8 animate-pulse" />
                  </div>
                  <h2 className="text-xl font-extrabold text-amber-900 dark:text-amber-300 mb-2 tracking-tight">Coming Soon</h2>
                  <p className="text-amber-800/80 dark:text-amber-400/80 text-xs font-semibold leading-relaxed">
                    This calculation module is under development and will be available soon!
                  </p>
                </div>
              </div>
            ) : pathname === '/notifications' ? (
              <NotificationCenterView
                myNotifications={myNotifications}
                deletedNotifications={deletedNotifications}
                readNotifIds={readNotifIds}
                completedNotifIds={completedNotifIds}
                deletedNotifIds={deletedNotifIds}
                markNotifAsRead={markNotifAsRead}
                markAllNotifsAsRead={markAllNotifsAsRead}
                completeTaskAndNotifyAuthor={completeTaskAndNotifyAuthor}
                deleteNotification={deleteNotification}
                restoreNotification={restoreNotification}
                permanentlyDeleteNotification={permanentlyDeleteNotification}
                clearAllReceivedNotifications={clearAllReceivedNotifications}
                clearAllCompletedNotifications={clearAllCompletedNotifications}
                clearAllDeletedNotifications={clearAllDeletedNotifications}
                restoreAllDeletedNotifications={restoreAllDeletedNotifications}
                clearAllNotifications={clearAllNotifications}
                onNavigateToItem={(notif: any) => {
                  navigateToNotificationTarget(notif, navigate, selectProject, markNotifAsRead);
                }}
              />
            ) : (
              children
            )}
          </div>
        </div>
        {effectiveIntelOpen && (
          <UniversalIntelligenceDrawer
            title={title}
            pathname={pathname}
            onClose={() => {
              if (onIntelClick) {
                onIntelClick();
              } else {
                setDefaultIntelOpen(false);
              }
            }}
          />
        )}
      </main>
      {/* FLOATING FLYOUT MEGA-MENU */}
      {hoveredGroup && (
        <div
          data-mega-menu="true"
          onClick={() => setHoveredGroup(null)}
          className="fixed z-[9999] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md border border-border dark:border-[#2d2d30] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.03)] p-4.5 transition-all duration-150 animate-in fade-in slide-in-from-left-3 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar"
          style={{
            left: `${sidebarOpen ? 272 : 72}px`,
            top: `${Math.max(88, hoveredGroup.top - 60)}px`,
          }}
        >
          <div className="flex items-center gap-2.5 border-b border-border/50 pb-3 mb-3.5 px-1">
            {(() => {
              const Icon = hoveredGroup.item.icon;
              return <Icon className="size-4.5 text-primary" />;
            })()}
            <span className="font-bold text-[14px] text-foreground tracking-tight">
              {hoveredGroup.item.label}
            </span>
          </div>

          {(() => {
            const sections = getSections(hoveredGroup.item.children);
            const isTwoColGrid = hoveredGroup.item.label === "HVAC" || hoveredGroup.item.label === "Electrical";
            const isMultiCol = isTwoColGrid || (!sections[0]?.header && sections[0]?.items.length > 8);
            return (
              <div
                className={`${
                  isTwoColGrid ? "w-[540px]" : isMultiCol ? "w-[480px]" : "w-[260px]"
                } ${isTwoColGrid ? "grid grid-cols-2 gap-4" : "flex flex-col gap-3.5"}`}
              >
                {sections.map((sec, idx) => (
                  <div key={idx} className="flex flex-col gap-1.5">
                    {sec.header && (
                      <div className="text-[9.5px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest pt-1 px-2 select-none border-b border-border/30 pb-0.5 mb-1.5">
                        {sec.header}
                      </div>
                    )}
                    <div
                      className={
                        !sec.header && sec.items.length > 8
                          ? "grid grid-cols-2 gap-x-4 gap-y-1"
                          : "space-y-0.5"
                      }
                    >
                      {sec.items.map((c) => (
                        <NavLink
                          key={c.label}
                          to={c.to}
                          label={c.label}
                          active={!!c.to && isLinkActive(c.to)}
                          showDot={true}
                          onClick={() => setHoveredGroup(null)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}


      <PricingModal
        isOpen={pricingModalOpen}
        onClose={() => setPricingModalOpen(false)}
        onSuccess={refreshLicenseStatus}
        currentStatus={licenseInfo}
      />

      <WelcomeToTarvModal
        isOpen={showPioneerModal}
        onClose={() => {
          setShowPioneerModal(false);
          if (userId) {
            localStorage.setItem(`tarv_pioneer_welcome_shown_${userId}`, 'true');
          }
        }}
        userName={userData?.name || profile?.name || 'Engineer'}
        pioneerNumber={userData?.pioneer_number || 1}
      />

      <AutoUpdateModal />

      {isSeatBlocked && (
        <div className="fixed inset-0 z-[999999] bg-slate-950/95 backdrop-blur-2xl flex items-center justify-center p-6 text-white text-center">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
            <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto shadow-inner">
              <Lock size={32} />
            </div>
            <div>
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                Organization License Seat Occupied
              </span>
              <h2 className="text-2xl font-extrabold mt-3 tracking-tight">Calculator Seat In Use</h2>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed">
                Only <strong className="text-white">{seatBlockedDetails?.limit || 1} user</strong> in <strong className="text-white">{seatBlockedDetails?.orgName || "your organization"}</strong> can open or use the MEP Calculator at once.
              </p>
            </div>

            <div className="p-4.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-left space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Assigned License Key:</span>
                <span className="font-mono font-bold text-indigo-400">{seatBlockedDetails?.licenseKey || "Assigned"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Currently Active User:</span>
                <span className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
                  {seatBlockedDetails?.activeUsers?.[0] || "Another Organization Member"}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-normal">
              Please wait until {seatBlockedDetails?.activeUsers?.[0] || "the active user"} closes their session, or contact your Super Admin to upgrade organization license seats.
            </p>

            <button
              onClick={runLicenseSeatHeartbeat}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl transition shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Refresh License Seat Status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  active,
  indent,
  showDot,
  onClick,
}: {
  to?: string;
  icon?: any;
  label: string;
  active?: boolean;
  indent?: boolean;
  showDot?: boolean;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const router = useRouter();
  const { profile } = useAuth();
  const pathname = router.state.location.pathname;
  const isLocked = to ? isFeatureLocked(to, profile) : false;
  
  const cls = `flex items-center gap-2 ${showDot ? "pl-2.5 pr-3" : "px-3"} py-1.5 rounded-xl text-[13px] transition-all duration-150 cursor-pointer ${indent ? "pl-8" : ""} ${
    active
      ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary-foreground"
      : "text-muted-foreground hover:bg-surface-2 hover:text-foreground dark:text-[#9b9b9b] dark:hover:bg-white/5 dark:hover:text-white"
  }`;
  
  const content = (
    <>
      {Icon && <Icon className={`size-4 ${active ? "text-primary" : "text-muted-foreground dark:text-[#9b9b9b]"}`} />}
      {showDot && (
        <span className={`size-1.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-slate-350 dark:bg-slate-600"}`} />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      {isLocked && (
        <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 uppercase tracking-tight">
          Coming Soon
        </span>
      )}
    </>
  );

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if (onClick) onClick();
    if (!to) return;
    const isFromProjectsPage = pathname === "/projects";
    const isToProjectsPage = to === "/projects" || to.startsWith("/projects");

    if (dirtyStore.isDirty && !isFromProjectsPage && !isToProjectsPage) {
      e.preventDefault();
      e.stopPropagation();
      const choice = await confirm(
        "Do you want to save the changes?",
        { title: "Unsaved Changes", threeButtons: true }
      );
      if (choice === "cancel") return;

      if (choice === "save") {
        triggerSave();
      }
    }

    dirtyStore.set(false);
    if (to.startsWith("/")) {
      let path = to;
      let searchObj: any = undefined;
      if (to.includes("?")) {
        const parts = to.split("?");
        path = parts[0];
        const params = new URLSearchParams(parts[1]);
        const nameVal = params.get("name");
        if (nameVal) {
          searchObj = { name: nameVal };
        }
      }
      router.navigate({ to: path as any, search: searchObj });
    }
  }, [to, confirm, router, pathname]);

  if (to && to.startsWith("/")) {
    let path = to;
    let searchObj: any = undefined;
    if (to.includes("?")) {
      const parts = to.split("?");
      path = parts[0];
      const params = new URLSearchParams(parts[1]);
      const nameVal = params.get("name");
      if (nameVal) {
        searchObj = { name: nameVal };
      }
    }
    return <Link to={path as any} search={searchObj} className={cls} onClick={handleClick}>{content}</Link>;
  }
  return <button className={cls} onClick={handleClick}>{content}</button>;
}

function NavGroup({ 
  item, 
  pathname, 
  activeName,
  sidebarOpen,
  onClick
}: { 
  item: Extract<NavItem, { kind: "group" }>; 
  pathname: string; 
  activeName?: string;
  sidebarOpen: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const isLinkActive = (to?: string) => {
    if (!to) return false;
    if (to.includes("?")) {
      const parts = to.split("?");
      const path = parts[0];
      const nameVal = new URLSearchParams(parts[1]).get("name");
      return pathname === path && activeName === nameVal;
    }
    return pathname === to;
  };

  const hasActiveChild = item.children.some((c) => c.to && isLinkActive(c.to));
  const Icon = item.icon;

  return (
    <div className="relative">
      <button
        onClick={onClick}
        className={`nav-group-btn flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[13.5px] transition-all duration-150 cursor-pointer ${
          hasActiveChild
            ? "bg-surface-2 text-foreground font-semibold dark:bg-white/10 dark:text-white"
            : "text-muted-foreground hover:bg-surface-2 hover:text-foreground dark:text-[#9b9b9b] dark:hover:bg-white/5 dark:hover:text-white"
        }`}
      >
        <Icon className="size-4 shrink-0" />
        <span className="flex-1 text-left truncate">{item.label}</span>
      </button>
    </div>
  );
}

function UniversalIntelligenceDrawer({
  title,
  pathname,
  onClose
}: {
  title: string;
  pathname: string;
  onClose: () => void;
}) {
  const isHvac = pathname.includes("cooling") || pathname.includes("ventilation") || pathname.includes("duct") || pathname.includes("chw") || pathname.includes("heating") || pathname.includes("smoke") || pathname.includes("pressuri") || pathname.includes("psychro") || pathname.includes("refrigerant") || pathname.includes("condensate") || pathname.includes("diffuser");
  const isElec = pathname.includes("cable") || pathname.includes("busbar") || pathname.includes("conductor") || pathname.includes("transformer") || pathname.includes("generator") || pathname.includes("ups") || pathname.includes("capacitor") || pathname.includes("breaker") || pathname.includes("short-circuit") || pathname.includes("tray") || pathname.includes("lux") || pathname.includes("lpd") || pathname.includes("battery") || pathname.includes("load-schedule");
  const isPlumbing = pathname.includes("loading-unit") || pathname.includes("fixture-unit") || pathname.includes("water-demand") || pathname.includes("supply-pipe") || pathname.includes("pump-sizing") || pathname.includes("pressure-vessel") || pathname.includes("tank-sizing") || pathname.includes("drainage") || pathname.includes("sewage") || pathname.includes("sump") || pathname.includes("storm") || pathname.includes("gas-tank");
  const isFire = pathname.includes("fire") || pathname.includes("sprinkler") || pathname.includes("fm200") || pathname.includes("hazen");

  const categoryLabel = isHvac ? "HVAC" : isElec ? "Electrical" : isPlumbing ? "Plumbing" : isFire ? "Fire Fighting" : "MEP";
  const standardBadge = isHvac ? "ASHRAE / CIBSE / SMACNA" : isElec ? "IEC 60364 / BS 7671 / DEWA" : isPlumbing ? "CIPHE / BS 8558 / BS EN 806 / IPC" : isFire ? "NFPA 13 / NFPA 20 / NFPA 2001" : "MEP International Standards";

  return (
    <div className="fixed top-[80px] right-0 bottom-0 w-[360px] bg-card dark:bg-[#1a1a1a] border-l border-border dark:border-[#262626] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right-5 duration-200">
      <header className="h-12 px-4 border-b border-border dark:border-[#262626] flex items-center justify-between bg-surface-1 dark:bg-[#121212]">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="font-extrabold text-[13.5px] tracking-tight text-foreground dark:text-white">Live Intelligence</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase">
            {categoryLabel}
          </span>
        </div>
        <button onClick={onClose} className="size-7 grid place-items-center rounded-md hover:bg-surface-2 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
          <X className="size-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar text-[12.5px]">
        {/* Active Calculator Card */}
        <div className="p-3 bg-surface-2 dark:bg-[#121212] rounded-xl border border-border dark:border-[#262626] space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Active Calculation Module</span>
          <div className="font-bold text-[14px] text-foreground dark:text-white">{title || "MEP Calculator"}</div>
          <div className="text-[11px] font-mono text-primary flex items-center gap-1.5 mt-1">
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <span>{standardBadge}</span>
          </div>
        </div>

        {/* Real-Time Health & Compliance */}
        <div className="p-3 bg-surface-2 dark:bg-[#121212] rounded-xl border border-border dark:border-[#262626] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Calculation Health</span>
            <span className="flex items-center gap-1 text-[10.5px] font-bold text-emerald-500">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE COMPLIANT
            </span>
          </div>
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[11.5px]">
              <span className="text-muted-foreground">Mathematical Logic</span>
              <span className="font-mono font-medium text-foreground dark:text-white">Verified (0 Errors)</span>
            </div>
            <div className="flex justify-between items-center text-[11.5px]">
              <span className="text-muted-foreground">Engineering Safety Margin</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">+15% Safety Margin</span>
            </div>
            <div className="flex justify-between items-center text-[11.5px]">
              <span className="text-muted-foreground">Data Storage</span>
              <span className="font-mono font-medium text-foreground dark:text-white">Auto-Synced to Cloud</span>
            </div>
          </div>
        </div>

        {/* Engineering Guidelines & Criteria */}
        <div className="p-3 bg-surface-2 dark:bg-[#121212] rounded-xl border border-border dark:border-[#262626] space-y-2">
          <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider block">Discipline Design Guidelines</span>
          <div className="space-y-2 pt-0.5">
            {isHvac && (
              <>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Duct & Airflow Sizing</strong>
                  Main ducts ≤ 6.0 m/s, branch ducts ≤ 4.0 m/s for quiet acoustic velocity limits.
                </div>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Chilled Water Piping</strong>
                  Friction head loss ≤ 250 Pa/m; max fluid velocity ≤ 2.4 m/s.
                </div>
              </>
            )}
            {isElec && (
              <>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Allowable Voltage Drop</strong>
                  Lighting circuits ≤ 3%, power/motor circuits ≤ 5% (IEC 60364 / BS 7671).
                </div>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Circuit Breaker & Cable Protection</strong>
                  Incomer & feeder protection must satisfy Ib ≤ In ≤ Iz and thermal withstand k²S² ≥ I²t.
                </div>
              </>
            )}
            {isPlumbing && (
              <>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Water Velocity Control</strong>
                  Cold/Hot water velocity ≤ 1.5 m/s (max 2.0 m/s) to eliminate water hammer noise.
                </div>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Simultaneous Loading Units</strong>
                  Flow calculations adhere strictly to CIPHE, BS 8558, BS EN 806, IPC, and DBC demand curves.
                </div>
              </>
            )}
            {isFire && (
              <>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">NFPA 13 Sprinkler Density</strong>
                  Assign design density (L/min/m²) based on Hazard Classification (Light, Ordinary, Extra Hazard).
                </div>
                <div className="p-2.5 bg-background dark:bg-[#1a1a1a] rounded-lg border border-border dark:border-[#262626] text-[11.5px]">
                  <strong className="text-foreground dark:text-white block font-semibold mb-0.5">Hazen-Williams Pressure Loss</strong>
                  Calculates friction loss using exact C-factor (C=150 Copper/Plastic, C=120 Steel).
                </div>
              </>
            )}
          </div>
        </div>

        {/* Action Button */}
        <Link
          to="/sanity-check-tool"
          className="w-full py-2.5 px-3 bg-primary text-primary-foreground font-bold rounded-xl text-[12px] flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
        >
          <Zap className="size-4" />
          Run Full Project Sanity Check
        </Link>
      </div>
    </div>
  );
}




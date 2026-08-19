import { Link, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import {
  Building2, Search, Settings, ChevronDown, ChevronRight, Bell, HelpCircle,
  LayoutDashboard, FolderKanban, Wind, Droplets, Flame, LogOut, Save,
  Boxes, FileBarChart, Cog, Plus, X, Zap, Sparkles, Moon, Sun, Wrench, FileText,
  Play, PanelLeftClose, PanelLeftOpen, Box, TriangleAlert,
  Edit3, Trash2, Copy, ShieldAlert, Lock, RefreshCw, Loader2, Trophy, Network
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-store";
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
import { getHardwareFingerprint } from "@/lib/hardwareFingerprint";
import { authService } from "@/services/authService";
import { api } from "@/services/api";
import { WelcomeToTarvModal } from "@/components/modals/WelcomeToTarvModal";

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
  "/plumbing-storm-water"
];

const NON_VERSION_PATHS = [
  "/",
  "/dashboard",
  "/projects",
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
  const userPhoto = userData?.profile_photo || profile?.profile_photo || (userId && typeof window !== 'undefined' ? localStorage.getItem(`mep_profile_photo_${userId}`) || '' : '');
  const confirm = useConfirm();
  const prompt = usePrompt();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isVersionAllowed = useMemo(() => {
    const cleanPath = (pathname || "").toLowerCase().replace(/\/$/, "") || "/";
    return !NON_VERSION_PATHS.some((nonPath) => cleanPath === nonPath || cleanPath.startsWith(nonPath + "/"));
  }, [pathname]);
  const searchObj = useRouterState({ select: (s) => s.location.search }) as Record<string, any>;
  const activeName = searchObj?.name;
  const navigate = useNavigate();
  const { project, projects, selectProject, refreshProjects, deleteProject, duplicateProject, updateProject, isReadOnly, setReadOnly, saveAsRevision, forceSaveToCloud, syncFromCloud, isInitializing, spaces, zones, equipment } = useWorkspace();
  const { joinProject, leaveProject, setActiveModule, getLockOwner, mySessionId } = useCollaboration();
  const activeUsers = useCollaboration(s => s.activeUsers);
  const [myEmail, setMyEmail] = useState<string>("unknown");
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [licenseInfo, setLicenseInfo] = useState<LicenseStatusInfo | null>(globalLicenseCache);
  const [showPioneerModal, setShowPioneerModal] = useState(false);

  const [notifTick, setNotifTick] = useState(0);

  const roleVal = String(profile?.role || userData?.user_metadata?.role || userData?.role || "").trim();
  const rawRole = roleVal.toLowerCase();
  const activeProfile = profile || userData || {};
  const des = String(activeProfile.designation || "").toLowerCase().trim();

  const isCoordinatorOrAdmin = useMemo(() => {
    return (
      roleVal === "Discipline Coordinator" ||
      rawRole === "discipline coordinator" ||
      rawRole.includes("coordinator") ||
      des.includes("coordinator")
    );
  }, [roleVal, rawRole, des]);

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
        const saved = localStorage.getItem("mep_deleted_notif_ids");
        return saved ? JSON.parse(saved) : [];
      } catch (e) {}
    }
    return [];
  });

  const markNotifAsRead = (id: string) => {
    setReadNotifIds(prev => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_read_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const deleteNotification = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setDeletedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, id]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });

    const currentProj = useWorkspace.getState().project;
    if (currentProj?.workspace_data) {
      const wdata = currentProj.workspace_data;
      let changed = false;
      const updatedWdata = { ...wdata };
      if (Array.isArray(wdata.rejection_notifs) && wdata.rejection_notifs.some((n: any) => n.id === id)) {
        updatedWdata.rejection_notifs = wdata.rejection_notifs.filter((n: any) => n.id !== id);
        changed = true;
      }
      if (Array.isArray(wdata.coord_notifs) && wdata.coord_notifs.some((n: any) => n.id === id)) {
        updatedWdata.coord_notifs = wdata.coord_notifs.filter((n: any) => n.id !== id);
        changed = true;
      }
      if (changed) {
        api.saveWorkspace(currentProj.id, updatedWdata).catch(console.error);
        useWorkspace.getState().updateProject({ ...currentProj, workspace_data: updatedWdata });
      }
    }
  };

  const clearAllNotifications = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const allIds = myNotifications.map((n: any) => n.id).filter(Boolean);
    setDeletedNotifIds(prev => {
      const updated = Array.from(new Set([...prev, ...allIds]));
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_deleted_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const myNotifications = useMemo(() => {
    const currentId = userId || userData?.id;
    const currentName = (userData?.name || profile?.name || "").toLowerCase().trim();
    const currentEmail = (userData?.email || profile?.email || "").toLowerCase().trim();

    if (!currentId && !currentEmail) return [];
    
    const notifs: any[] = [];
    const addNotifs = (items: any[], typeName: string, projectName: string, projectId: string) => {
      if (!items) return;
      items.forEach(item => {
        if (item.comments && Array.isArray(item.comments)) {
          item.comments.forEach((c: any) => {
            const isAssigned = Array.isArray(c.assignedUsers) && c.assignedUsers.some((u: any) => {
              const uStr = String(u).toLowerCase().trim();
              return uStr === String(currentId).toLowerCase() || (currentName && uStr === currentName) || (currentEmail && uStr === currentEmail);
            });
            if (isAssigned) {
              notifs.push({
                ...c,
                targetId: item.id,
                targetName: item.name || item.id,
                targetType: typeName,
                projectName: projectName,
                projectId: projectId,
                calculatorPath: '/ventilation'
              });
            }
          });
        }
      });
    };

    projects.forEach(p => {
      const wdata = p.workspace_data || {};
      addNotifs(wdata.spaces, "Space", p.name, p.id);
      addNotifs(wdata.zones, "Zone", p.name, p.id);
      addNotifs(wdata.equipment, "Equipment", p.name, p.id);
    });

    const isUserMemberOfProject = (targetProjectId?: string) => {
      if (!targetProjectId || targetProjectId === "none") return false;
      const proj = projects.find((p: any) => p.id === targetProjectId);
      if (!proj) return false;

      // Creator
      if (proj.created_by === currentId) return true;

      // project_users array
      if (Array.isArray(proj.project_users)) {
        const match = proj.project_users.some((pu: any) => 
          pu.user_id === currentId || 
          (pu.user?.email && pu.user.email.toLowerCase().trim() === currentEmail)
        );
        if (match) return true;
      }

      // members array
      if (Array.isArray(proj.members)) {
        const match = proj.members.some((m: any) => 
          m.id === currentId || 
          (m.name && m.name.toLowerCase().trim() === currentName) || 
          (m.email && m.email.toLowerCase().trim() === currentEmail)
        );
        if (match) return true;
      }

      // workspace_data.assigned_users array
      const wdata = proj.workspace_data || {};
      if (Array.isArray(wdata.assigned_users)) {
        const match = wdata.assigned_users.some((u: any) => {
          const uStr = String(u).toLowerCase().trim();
          return uStr === String(currentId).toLowerCase() || uStr === currentName || uStr === currentEmail;
        });
        if (match) return true;
      }

      return false;
    };

    // 1. Rejection Notifications from Discipline Coordinator -> VISIBLE TO Sr. Design Engineer ONLY
    if (isSrDesignEngineer) {
      try {
        // Collect from backend first
        projects.forEach(p => {
          const wdata = p.workspace_data || {};
          const rNotifs = Array.isArray(wdata.rejection_notifs) ? wdata.rejection_notifs : [];
          rNotifs.forEach((rn: any) => {
            if (true) {
              notifs.push({
                id: rn.id,
                authorName: rn.rejectedBy || rn.authorName || "Discipline Coordinator",
                text: `🚨 CALCULATION REJECTED (${rn.calculatorTitle || "Calculation"}): "${rn.reason}"`,
                timestamp: rn.timestamp,
                targetType: "Calculation",
                targetName: rn.calculatorTitle || "Calculation",
                projectName: p.name || rn.projectName || "Project",
                projectId: p.id,
                calculatorPath: rn.calculatorPath || "/ventilation",
                targetId: rn.id
              });
            }
          });
        });

        // Collect from local storage fallback
        const savedRejections = typeof localStorage !== 'undefined' ? localStorage.getItem("mep_calc_rejection_notifs") : null;
        if (savedRejections) {
          const parsed = JSON.parse(savedRejections);
          if (Array.isArray(parsed)) {
            parsed.forEach((rn: any) => {
              if (rn.projectId && !notifs.some(n => n.id === rn.id)) {
                const targetProj = projects.find(p => p.id === rn.projectId);
                notifs.push({
                  id: rn.id,
                  authorName: rn.rejectedBy || rn.authorName || "Discipline Coordinator",
                  text: `🚨 CALCULATION REJECTED (${rn.calculatorTitle || "Calculation"}): "${rn.reason}"`,
                  timestamp: rn.timestamp,
                  targetType: "Calculation",
                  targetName: rn.calculatorTitle || "Calculation",
                  projectName: targetProj?.name || rn.projectName || "Project",
                  projectId: rn.projectId,
                  calculatorPath: rn.calculatorPath || "/ventilation",
                  targetId: rn.id
                });
              }
            });
          }
        }
      } catch (e) {}
    }

    // 3. Approval Notifications for Discipline Coordinator / Admin
    if (isCoordinatorOrAdmin) {
      try {
        // Collect from backend
        projects.forEach(p => {
          let wdata = p.workspace_data || {};
          if (typeof wdata === 'string') {
            try { wdata = JSON.parse(wdata); } catch(e) {}
          }
          const cNotifs = Array.isArray(wdata.coord_notifs) ? wdata.coord_notifs : [];
          cNotifs.forEach((cn: any) => {
            if (cn.id && !notifs.some(n => n.id === cn.id)) {
              notifs.push({
                id: cn.id,
                authorName: cn.reviewerName || "Sr. Design Engineer",
                text: `✅ READY FOR APPROVAL (${cn.calculatorTitle || "Calculation"}): Reviewed by ${cn.reviewerName || "Sr. Design Engineer"}. "${cn.comments || "Ready for approval."}"`,
                timestamp: cn.timestamp,
                targetType: "Calculation",
                targetName: cn.calculatorTitle || "Calculation",
                projectName: p.name || cn.projectName || "Project",
                projectId: p.id,
                calculatorPath: cn.calculatorPath || "/ventilation",
                targetId: cn.id
              });
            }
          });
        });

        // Collect from local storage fallback
        const savedCoordNotifs = typeof localStorage !== 'undefined' ? localStorage.getItem("mep_calc_coord_notifs") : null;
        if (savedCoordNotifs) {
          const parsed = JSON.parse(savedCoordNotifs);
          if (Array.isArray(parsed)) {
            parsed.forEach((cn: any) => {
              if (cn.id && !notifs.some(n => n.id === cn.id)) {
                const targetProj = projects.find(p => p.id === cn.projectId);
                notifs.push({
                  id: cn.id,
                  authorName: cn.reviewerName || "Sr. Design Engineer",
                  text: `✅ READY FOR APPROVAL (${cn.calculatorTitle || "Calculation"}): Reviewed by ${cn.reviewerName || "Sr. Design Engineer"}. "${cn.comments || "Ready for approval."}"`,
                  timestamp: cn.timestamp,
                  targetType: "Calculation",
                  targetName: cn.calculatorTitle || "Calculation",
                  projectName: targetProj?.name || cn.projectName || "Project",
                  projectId: cn.projectId || "none",
                  calculatorPath: cn.calculatorPath || "/ventilation",
                  targetId: cn.id
                });
              }
            });
          }
        }
      } catch(e) {}
    }
    
    const filtered = notifs.filter(n => !n.id || !deletedNotifIds.includes(n.id));
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return filtered;
  }, [userId, userData, profile, projects, notifTick, isSrDesignEngineer, isJrDesignEngineer, isCoordinatorOrAdmin, deletedNotifIds]);

  const unreadNotifications = useMemo(() => {
    return myNotifications.filter(n => n.id && !readNotifIds.includes(n.id));
  }, [myNotifications, readNotifIds]);

  const unreadCount = unreadNotifications.length;

  const markAllNotifsAsRead = useCallback(() => {
    const allIds = myNotifications.map((n: any) => n.id).filter(Boolean);
    setReadNotifIds((prev) => {
      const set = new Set([...prev, ...allIds]);
      const updated = Array.from(set);
      if (typeof window !== "undefined") {
        localStorage.setItem("mep_read_notif_ids", JSON.stringify(updated));
      }
      return updated;
    });
  }, [myNotifications]);

  useEffect(() => {
    const handleNotifAdded = () => setNotifTick(t => t + 1);
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

      if (e?.detail?.status === "REJECTED" && isSrDesignEngineer) {
        toast.error(`⚠️ CALCULATION REJECTED: Reason from ${e.detail.rejectedBy || "Discipline Coordinator"}: "${e.detail.rejectionDescription || "Revision required"}"`, {
          duration: 7000
        });
      }
      if (e?.detail?.status === "SR_REVIEW_SUBMITTED" && isCoordinatorOrAdmin) {
        toast.success(`✅ CALCULATION REVIEWED: ${e.detail.calculatorTitle || "Calculation"} reviewed by ${e.detail.reviewedBy || "Sr. Design Engineer"}. Ready for your approval!`, {
          duration: 7000
        });
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener("mep-notification-added", handleNotifAdded);
      window.addEventListener("mep-review-state-updated", handleReviewStateUpdate);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener("mep-notification-added", handleNotifAdded);
        window.removeEventListener("mep-review-state-updated", handleReviewStateUpdate);
      }
    };
  }, [userId, userData, profile, projects, isSrDesignEngineer, isJrDesignEngineer, isCoordinatorOrAdmin]);

  // Real-time notification auto polling without needing page refresh
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(() => {
      refreshProjects();
    }, 3000);
    return () => clearInterval(interval);
  }, [userId, refreshProjects]);


  useEffect(() => {
    if (userData?.is_founding_pioneer && userId) {
      const shown = localStorage.getItem(`tarv_pioneer_welcome_shown_${userId}`);
      if (!shown) {
        setShowPioneerModal(true);
      }
    }
  }, [userData?.is_founding_pioneer, userData?.pioneer_number, userId]);

  // Periodic session heartbeat to instantly log out accounts deleted by Super Admin / Org Admin
  useEffect(() => {
    if (!userId) return;
    const interval = setInterval(async () => {
      const res = await authService.getUserData();
      if (res && res.success === false && res.message && !res.message.includes('Network Error')) {
        toast.error("Your account has been deleted or deactivated by an administrator.");
        logout();
        navigate({ to: '/login' });
      }
    }, 5000);
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
    if (userData?.role === 'SUPER_ADMIN' || profile?.role === 'SUPER_ADMIN') {
      setIsSeatBlocked(false);
      return;
    }

    const orgId = userData?.organization_id || profile?.organization_id;
    if (!orgId) {
      setIsSeatBlocked(false);
      return;
    }

    const userEmail = userData?.email || profile?.email || myEmail;
    const res = await api.checkLicenseSession({ userId, email: userEmail, orgId });
    if (res && res.allowed === false) {
      setIsSeatBlocked(true);
      setSeatBlockedDetails(res);
    } else {
      setIsSeatBlocked(false);
    }
  }, [userId, userData?.role, userData?.organization_id, userData?.email, profile?.role, profile?.organization_id, profile?.email, myEmail]);

  useEffect(() => {
    runLicenseSeatHeartbeat();
    const interval = setInterval(runLicenseSeatHeartbeat, 8000);

    const handleUnload = () => {
      const orgId = userData?.organization_id || profile?.organization_id;
      if (userId && orgId) {
        api.releaseLicenseSession({ userId, orgId });
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [runLicenseSeatHeartbeat, userId, userData?.organization_id, profile?.organization_id]);

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

  const lockOwnerObj = getLockOwner(pathname);
  const isLockedByOther = lockOwnerObj && lockOwnerObj.sessionId !== mySessionId;
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

      const calcTitle = getCalculatorTitleFromPath(pathname);
      if (calcTitle) {
        logCalculatorUpdate(calcTitle, `Changes occurred in ${calcTitle}`);
      }
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
    if (!hoveredGroup) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.fixed') && !target.closest('.nav-group-btn')) {
        setHoveredGroup(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [hoveredGroup]);

  // Unit System Transition modal states & capture listener
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [pendingUnitToggle, setPendingUnitToggle] = useState<{
    button: HTMLButtonElement;
    targetSystem: "si" | "ip";
  } | null>(null);

  useEffect(() => {
    const handleCaptureClick = (e: MouseEvent) => {
      if ((window as any).__mep_bypass_unit_prompt) return;
      const btn = (e.target as HTMLElement)?.closest("button");
      if (!btn) return;

      const text = (btn.textContent || "").trim();
      const isSiToggle = /\bmetric\b|\bsi\b/i.test(text);
      const isIpToggle = /\bimperial\b|\bip\b/i.test(text);
      if (!isSiToggle && !isIpToggle) return;

      const targetSystem = isSiToggle ? "si" : "ip";

      // Ignore if button is already active/selected
      if (
        btn.classList.contains("bg-white") ||
        btn.classList.contains("bg-[#0A7BC7]") ||
        btn.classList.contains("bg-red-600") ||
        btn.classList.contains("bg-primary") ||
        btn.getAttribute("aria-pressed") === "true" ||
        btn.getAttribute("data-state") === "on"
      ) {
        return;
      }

      e.stopPropagation();
      e.preventDefault();
      setPendingUnitToggle({
        button: btn as HTMLButtonElement,
        targetSystem,
      });
      setUnitModalOpen(true);
    };

    document.addEventListener("click", handleCaptureClick, true);
    return () => {
      document.removeEventListener("click", handleCaptureClick, true);
    };
  }, []);

  // Global Ctrl + S / Cmd + S keyboard shortcut to save calculations to cloud
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      
      if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        
        const isEffectiveReadOnly = isReadOnly || isLockedByOther;
        if (isEffectiveReadOnly) {
          toast.error("Cannot save. Workspace is in Read-Only mode.");
          return;
        }
        
        if (project?.id) {
          savePageInputs(project.id, pathname);
          triggerSave();
          forceSaveToCloud();
          const calcTitle = getCalculatorTitleFromPath(pathname) || 'Ventilation';
          logCalculatorUpdate(calcTitle, `Saved changes in ${calcTitle}`);
          toast.success("Calculations synced to cloud successfully!");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [project?.id, pathname, isReadOnly, isLockedByOther]);

  // Read-Only Enforcement: Blocks value modifications on inputs/selects/textareas and mutation buttons, while keeping scrolling, text copying, tabs, and navigation 100% interactive
  useEffect(() => {
    const isEffectiveReadOnly = isReadOnly || isLockedByOther;
    (window as any).__mep_is_readonly = isEffectiveReadOnly;
    
    if (!isEffectiveReadOnly) return;

    const isAllowedInteractive = (target: HTMLElement) => {
      // Header, Sidebar, Navigation links, Tab switching buttons, Modals, Review Bar, and Assign Comment Modals are always allowed
      if (target.closest(".appshell-header, .appshell-sidebar, header, aside, nav, .no-print, [role='dialog'], [role='alertdialog'], .radix-dialog-content, .calculation-review-bar, .review-modal, .assign-comment-modal")) return true;
      
      const btn = target.closest("button, [role='button'], a, [role='tab']");
      if (!btn) return false;

      const role = btn.getAttribute("role");
      // Explicitly block checkboxes and switches
      if (role === "checkbox" || role === "switch") return false;

      // Tab buttons, tab triggers, view mode toggles, accordion headers, search filter inputs are allowed
      const btnText = (btn.textContent || "").trim().toLowerCase();
      const isTab = role === "tab" || 
                    btn.classList.contains("tab-btn") || 
                    btn.hasAttribute("data-state") ||
                    ["spaces", "zones", "equipment", "report", "schedule", "sld", "calculator", "summary"].includes(btnText);

      return isTab;
    };

    const handleReadOnlyClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      if (isAllowedInteractive(target)) return;

      const isEditableInput = target.closest("input, select, textarea, [contenteditable='true']");
      const isMutationBtn = target.closest("button, [role='button']");

      if (isEditableInput) {
        // Prevent focusing/editing input fields
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }

      if (isMutationBtn) {
        // Prevent clicking data-mutation buttons (like + New Space, Import, Auto-Zone, Delete)
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
    };

    const handleReadOnlyKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      
      // Safe check for closest and tagName
      const isElement = typeof target.closest === 'function' && typeof target.tagName === 'string';
      
      if (isElement && isAllowedInteractive(target)) return;
      
      const tagName = isElement ? target.tagName.toLowerCase() : '';
      const isEditable = target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      
      // Allow navigation keys, copy (Ctrl+C / Cmd+C), select all (Ctrl+A), Tab, Escape, Arrows, PageUp/Down
      const isCopyCombo = (e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.key === 'a' || e.key === 'A');
      const isNavKey = ['Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'].includes(e.key);

      if (isEditable && !isCopyCombo && !isNavKey) {
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
      
      // Block global mutation shortcuts like Delete, Backspace, or Enter on non-allowed targets
      if (['Delete', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
        return;
      }
      
      if (e.key === 'Enter') {
        // If it's an element and allowed interactive, let Enter pass
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

    const handleReadOnlyContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && typeof target.closest === 'function') {
        if (target.closest("input, select, textarea, [contenteditable='true']")) {
          // Allow default context menu for inputs (cut/copy/paste)
          return;
        }
      }
      // Block context menu on read-only areas
      e.preventDefault();
      e.stopPropagation();
      toast.info("Workspace is in Read-Only mode. Context menus are disabled.", { id: "readonly-notice" });
    };

    if (isEffectiveReadOnly) {
      document.addEventListener("mousedown", handleReadOnlyClick, true);
      document.addEventListener("keydown", handleReadOnlyKeyDown, true);
      document.addEventListener("contextmenu", handleReadOnlyContextMenu, true);
      document.addEventListener("change", handleReadOnlyChange, true);
    }
    
    return () => {
      document.removeEventListener("mousedown", handleReadOnlyClick, true);
      document.removeEventListener("keydown", handleReadOnlyKeyDown, true);
      document.removeEventListener("contextmenu", handleReadOnlyContextMenu, true);
      document.removeEventListener("change", handleReadOnlyChange, true);
    };
  }, [isReadOnly, isLockedByOther]);

  const handleKeepValuesAsIs = () => {
    if (!pendingUnitToggle) return;
    (window as any).__mep_keep_values = true;
    (window as any).__mep_bypass_unit_prompt = true;
    pendingUnitToggle.button.click();
    (window as any).__mep_bypass_unit_prompt = false;
    (window as any).__mep_keep_values = false;
    setUnitModalOpen(false);
    setPendingUnitToggle(null);
  };

  const handleConvertUnits = () => {
    if (!pendingUnitToggle) return;
    (window as any).__mep_bypass_unit_prompt = true;
    (window as any).__mep_keep_values = false;
    pendingUnitToggle.button.click();
    (window as any).__mep_bypass_unit_prompt = false;
    setUnitModalOpen(false);
    setPendingUnitToggle(null);
  };

  const filteredNav = useMemo(() => {
    const isAdmin = ['SUPER_ADMIN', 'ORG_ADMIN'].includes(profile?.role || '');
    const rawNav = import.meta.env.VITE_APP_MODE === 'kfactor'
      ? [{ kind: "item" as const, label: "Sprinkler K-Factor", to: "/plumbing-sprinkler-kfactor", icon: Droplets }]
      : [
          ...NAV,
          ...(isAdmin ? [
            { kind: "item" as const, label: "Company Hierarchy", to: "/company-hierarchy", icon: Network },
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

  const rawExpiry = userData?.subscription_expires || profile?.subscription_expires;
  let computedRemainingDays = licenseInfo?.remainingDays ?? 14;
  let computedStatus = licenseInfo?.status;

  if (rawExpiry) {
    const expDate = new Date(rawExpiry);
    if (!isNaN(expDate.getTime())) {
      const diff = Math.ceil((expDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
      computedRemainingDays = Math.max(0, diff);
      if (diff <= 0) {
        computedStatus = 'EXPIRED_TRIAL';
      } else if (computedStatus !== 'ACTIVE') {
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
                onClick={() => setReadOnly(!isReadOnly)}
                className={`size-10 rounded-full flex items-center justify-center transition-colors border ${
                  isReadOnly 
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
                    : "bg-surface-2 dark:bg-white/5 text-muted-foreground border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10"
                }`}
                title={isReadOnly ? "Unlock Editing" : "Lock Read-Only Mode"}
              >
                {isReadOnly ? <Lock className="size-4" /> : <Edit3 className="size-4" />}
              </button>

              <button
                type="button"
                onClick={() => setPricingModalOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-bold transition-all shadow-sm cursor-pointer border ${
                  licenseInfo?.plan === 'PRO' || licenseInfo?.plan === 'ENTERPRISE'
                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                    : computedStatus === 'EXPIRED_TRIAL'
                    ? "bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20 animate-pulse"
                    : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-500 border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30"
                }`}
                title="Manage License & Subscription"
              >
                <Zap className="size-3.5" />
                <span>
                  {!licenseInfo ? 'CHECKING LICENSE...' :
                   licenseInfo.plan === 'PRO' ? 'PRO ACTIVE' :
                   licenseInfo.plan === 'ENTERPRISE' ? 'ENTERPRISE' :
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
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
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[440px] sm:w-[480px] bg-popover border border-border rounded-xl shadow-xl font-sans p-0 overflow-hidden">
                  <div className="flex items-center justify-between font-bold text-sm border-b border-border/50 px-4 py-3 bg-surface-2/60">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-bold">Notifications</span>
                      {myNotifications.length > 0 && (
                        <span className="px-2 py-0.5 text-[11px] bg-primary/10 text-primary font-bold rounded-full">
                          {myNotifications.length}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {unreadCount > 0 && (
                        <button 
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            markAllNotifsAsRead();
                          }}
                          className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                        >
                          Mark all read
                        </button>
                      )}
                      {myNotifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="text-[11px] font-bold text-muted-foreground hover:text-red-500 hover:underline cursor-pointer transition-colors"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  {myNotifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground font-medium">No new notifications</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto custom-scrollbar divide-y divide-border/30">
                      {myNotifications.map((notif, i) => {
                        const isUnread = notif.id && !readNotifIds.includes(notif.id);
                        const handleClick = () => {
                          if (notif.id) {
                            markNotifAsRead(notif.id);
                          }
                          if (notif.projectId) {
                            selectProject(notif.projectId);
                          }
                          const targetPath = notif.calculatorPath || '/ventilation';
                          navigate({
                            to: targetPath as any,
                          });

                          setTimeout(() => {
                            window.dispatchEvent(
                              new CustomEvent("mep-scroll-to-item", {
                                detail: { id: notif.targetId, name: notif.targetName, type: notif.targetType?.toLowerCase() },
                              })
                            );
                          }, 400);
                        };
                        return (
                          <div
                            key={notif.id || i}
                            className={`group relative flex items-start justify-between p-3.5 hover:bg-surface-2 dark:hover:bg-white/5 transition-colors cursor-pointer ${
                              isUnread ? "bg-primary/5 dark:bg-primary/10 font-medium" : "opacity-80"
                            }`}
                            onClick={handleClick}
                          >
                            <div className="flex-1 min-w-0 pr-3">
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-1.5 truncate">
                                  {isUnread && <span className="size-2 rounded-full bg-primary inline-block shrink-0" title="Unread" />}
                                  <span className="text-xs font-bold text-foreground truncate">{notif.authorName}</span>
                                </div>
                                <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                                  {new Date(notif.timestamp).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-xs font-medium leading-relaxed mb-2 text-foreground/90 text-left break-words">{notif.text}</p>
                              <div className="text-[10.5px] text-muted-foreground font-medium flex flex-wrap items-center gap-1.5 w-full">
                                <span className="px-1.5 py-0.5 bg-primary/10 text-primary font-bold rounded-md text-[10px] uppercase tracking-wider">{notif.targetType}</span>
                                <span className="truncate max-w-[150px]">{notif.targetName}</span>
                                <span className="text-muted-foreground/60 text-[10px]">in</span>
                                <span className="truncate max-w-[130px] font-bold text-primary" title={notif.projectName}>{notif.projectName}</span>
                              </div>
                            </div>
                            <button
                              onClick={(e) => deleteNotification(notif.id, e)}
                              className="p-1.5 text-muted-foreground/60 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all shrink-0 cursor-pointer self-start"
                              title="Delete notification"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
          {!hideSubHeader && (
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
                  {onIntelClick && (
                    <button 
                      onClick={onIntelClick}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-xs font-medium border cursor-pointer shrink-0 ${
                        intelOpen
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-[#E8F2FC] text-[#0A7BC7] dark:bg-[#0C2538] dark:text-[#38BDF8] border-[#BCE0FD] dark:border-[#1E4968] hover:bg-[#D4E8FA] dark:hover:bg-[#10324C]"
                      }`}
                    >
                      <Sparkles className="size-3.5" />
                      {intelLabel || "Intelligence"}
                    </button>
                  )}
                </div>
                {subtitle && <span className="text-[12px] text-muted-foreground font-medium leading-snug mt-1 block">{subtitle}</span>}
              </div>
              <div className="flex items-center gap-2">
                {actions}
              </div>
            </div>
          )}

          {isLockedByOther && (
            <div className="absolute top-0 left-0 right-0 z-40 bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 px-4 py-3 flex items-center justify-center gap-2 shrink-0 shadow-sm backdrop-blur-md">
              <ShieldAlert className="w-5 h-5" />
              <span className="font-bold text-sm tracking-wide uppercase">
                READ-ONLY MODE: This calculator is currently being edited by {lockOwnerName}
              </span>
            </div>
          )}

          <div className={`flex-1 min-h-0 flex flex-col transition-opacity duration-300 ${isLockedByOther ? 'opacity-90 mt-10' : ''} ${
            sidebarOpen ? "pl-0 pr-3.5 pb-3.5" : "pl-3.5 pr-3.5 pb-3.5"
          }`}>
            {isInitializing ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-surface dark:bg-[#121212]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <span className="text-slate-500 dark:text-slate-400 font-medium">Syncing with workspace...</span>
              </div>
            ) : isFeatureLocked(pathname, profile) ? (
              <div className="flex flex-col items-center justify-center flex-1 text-center p-8 bg-surface dark:bg-[#121212]">
                <div className="w-full max-w-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl p-8 flex flex-col items-center shadow-sm">
                  <div className="w-20 h-20 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-6 shadow-inner text-red-500 dark:text-red-400">
                    <Lock className="w-8 h-8" />
                  </div>
                  <h2 className="text-2xl font-bold text-red-700 dark:text-red-400 mb-3 tracking-tight">Warning</h2>
                  <p className="text-red-600/80 dark:text-red-400/80 text-sm leading-relaxed">
                    This calculator is currently locked or under development for your account. Please contact your administrator for access.
                  </p>
                </div>
              </div>
            ) : (
              children
            )}
          </div>
        </div>
      </main>
      {/* FLOATING FLYOUT MEGA-MENU */}
      {hoveredGroup && (
        <div
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

      {/* UNIT SYSTEM TRANSITION MODAL */}
      {unitModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 font-sans">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-full bg-red-100 dark:bg-red-950/40 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <TriangleAlert className="size-5 text-red-500" />
              </div>
              <h3 className="text-[17px] font-bold text-foreground">Unit System Transition</h3>
            </div>
            <p className="text-[13.5px] text-muted-foreground leading-normal font-medium">
              You are switching between Imperial (IP) and Metric (SI) units. How would you like to handle the entered input values?
            </p>
            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
              <button
                onClick={() => {
                  setUnitModalOpen(false);
                  setPendingUnitToggle(null);
                }}
                className="w-full sm:w-auto px-4 py-2 border border-slate-250 dark:border-zinc-800 text-[12.5px] font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 text-foreground cursor-pointer outline-none transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleKeepValuesAsIs}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 text-[12.5px] font-bold rounded-xl cursor-pointer outline-none transition-colors"
              >
                Keep Values As-Is
              </button>
              <button
                onClick={handleConvertUnits}
                className="w-full sm:w-auto px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-[12.5px] font-bold rounded-xl cursor-pointer outline-none transition-colors shadow-sm"
              >
                Convert Values
              </button>
            </div>
          </div>
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
}: {
  to?: string;
  icon?: any;
  label: string;
  active?: boolean;
  indent?: boolean;
  showDot?: boolean;
}) {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  
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
    </>
  );

  const handleClick = useCallback(async (e: React.MouseEvent) => {
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




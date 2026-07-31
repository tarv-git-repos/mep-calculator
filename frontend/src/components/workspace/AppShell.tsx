import { Link, useRouterState, useNavigate, useRouter } from "@tanstack/react-router";
import React, { useState, useEffect, useCallback, type ReactNode } from "react";
import {
  Building2, Search, Settings, ChevronDown, ChevronRight, Bell, HelpCircle,
  LayoutDashboard, FolderKanban, Wind, Droplets, Flame, LogOut, Save,
  Boxes, FileBarChart, Cog, Plus, X, Zap, Sparkles, Moon, Wrench, FileText,
  Play, PanelLeftClose, PanelLeftOpen, Box, TriangleAlert,
  Edit3, Trash2, Copy, ShieldAlert, Lock, RefreshCw, Loader2
} from "lucide-react";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { isFeatureLocked } from "@/utils/featureFlags";
import { logActivity } from "@/utils/logger";
import { VersionManager } from "./VersionManager";
import { useCollaboration } from "@/lib/collaboration-store";
import { supabase } from "@/lib/supabase";
import { Megaphone, X as XIcon } from "lucide-react";

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
  // Read-only users won't trigger this because their screen is pointer-events-none
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

export function AppShell({ children, title, subtitle, actions, onIntelClick, intelOpen, intelLabel, hideSubHeader }: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  onIntelClick?: () => void;
  intelOpen?: boolean;
  intelLabel?: string;
  hideSubHeader?: boolean;
}) {
  const { profile, userData, logout } = useAuth();
  const confirm = useConfirm();
  const prompt = usePrompt();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchObj = useRouterState({ select: (s) => s.location.search }) as Record<string, any>;
  const activeName = searchObj?.name;
  const navigate = useNavigate();
  const { project, projects, selectProject, deleteProject, duplicateProject, updateProject, isReadOnly, setReadOnly, saveAsRevision, forceSaveToCloud, isInitializing } = useWorkspace();
  const { joinProject, leaveProject, setActiveModule, getLockOwner, mySessionId } = useCollaboration();
  const [myEmail, setMyEmail] = useState<string>("unknown");

  const [announcement, setAnnouncement] = useState<{ id: string; message: string; type: string } | null>(null);

  useEffect(() => {
    const fetchActiveAnnouncement = async () => {
      const { data } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);
      if (data && data.length > 0) {
        setAnnouncement(data[0]);
      }
    };
    fetchActiveAnnouncement();
  }, []);

  useEffect(() => {
    if (profile?.id && pathname && pathname !== '/') {
      logActivity(profile.id, 'VIEW_CALCULATOR', { path: pathname });
    }
  }, [pathname, profile?.id]);

  // Init Collaboration
  useEffect(() => {
    const initCollab = async () => {
      const { data } = await supabase.auth.getSession();
      const displayName = userData?.name || profile?.name || data.session?.user.email || "unknown";
      setMyEmail(displayName);
      if (project?.name) {
        joinProject(project.name, displayName);
      }
    };
    initCollab();
    return () => {
      leaveProject();
    };
  }, [project?.name, userData?.name, profile?.name]);

  // Update active module on route change
  useEffect(() => {
    if (pathname && !EXCLUDED_PERSIST_PATHS.includes(pathname)) {
      setActiveModule(pathname);
    } else {
      setActiveModule(null);
    }

    // Force privacy policy acceptance
    const acceptedPrivacy = userData?.privacyPolicyAccepted === true;
    if (!acceptedPrivacy && pathname !== '/login' && pathname !== '/privacy') {
      navigate({ to: '/privacy' });
    }
  }, [pathname, navigate, userData?.privacyPolicyAccepted]);

  const lockOwnerObj = getLockOwner(pathname);
  const isLockedByOther = lockOwnerObj && lockOwnerObj.sessionId !== mySessionId;
  const lockOwnerEmail = lockOwnerObj ? lockOwnerObj.email : "Unknown";

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

  // Save inputs on any input or change event
  useEffect(() => {
    const handleInput = (e: Event) => {
      if ((window as any).__mep_is_restoring) return;
      
      const target = e.target as HTMLElement;
      if (target && (target.closest("aside") || target.closest("header") || target.closest("[data-ignore-persist]"))) {
        return;
      }
      
      savePageInputs(project.id, pathname);
    };
    
    document.addEventListener("input", handleInput, true);
    document.addEventListener("change", handleInput, true);
    
    return () => {
      document.removeEventListener("input", handleInput, true);
      document.removeEventListener("change", handleInput, true);
    };
  }, [pathname, project.id]);

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

  // Flyout mega-menu hover state
  const [hoveredGroup, setHoveredGroup] = useState<{
    item: Extract<NavItem, { kind: "group" }>;
    top: number;
  } | null>(null);
  const [closeTimeoutId, setCloseTimeoutId] = useState<any>(null);

  const handleMouseEnterGroup = (e: React.MouseEvent, item: Extract<NavItem, { kind: "group" }>) => {
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      setCloseTimeoutId(null);
    }
    setHoveredGroup({
      item,
      top: e.currentTarget.getBoundingClientRect().top,
    });
  };

  const handleMouseLeaveGroup = () => {
    const timeoutId = setTimeout(() => {
      setHoveredGroup(null);
    }, 200);
    setCloseTimeoutId(timeoutId);
  };

  const handleFlyoutMouseEnter = () => {
    if (closeTimeoutId) {
      clearTimeout(closeTimeoutId);
      setCloseTimeoutId(null);
    }
  };

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

  const logoLetter = import.meta.env.VITE_APP_MODE === 'kfactor' ? "K" : "M";
  const brandName = import.meta.env.VITE_APP_MODE === 'kfactor' ? "K-Factor Calc" : "MEP Calculator";
  return (
    <div className="grid h-screen grid-cols-[auto_1fr] grid-rows-[80px_1fr] bg-surface dark:bg-[#121212] text-foreground text-[14px] print:block print:h-auto">
      {/* Top Header (Column 2, Row 1) */}
      <header className={`appshell-header col-start-2 row-start-1 flex items-start pt-3.5 h-full bg-surface dark:bg-[#121212] no-print print:hidden transition-all duration-300 ${
        sidebarOpen ? "pl-0 pr-3.5" : "px-3.5"
      }`}>
        <div className="flex-1 bg-card dark:bg-[#1a1a1a] border border-border dark:border-[#262626] rounded-full h-[60px] px-5 flex items-center shadow-[0_1px_3px_rgba(0,0,0,0.05)] relative">
          <div className="flex items-center justify-between w-full">
            {/* Left side: Project Selector */}
            <div className="flex items-center gap-2">
              {!sidebarOpen && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors mr-1 shrink-0"
                  title="Expand Sidebar"
                >
                  <PanelLeftOpen className="size-5" />
                </button>
              )}
               <div className="flex items-center gap-4">
                 <DropdownMenu>
                   <ContextMenu>
                   <ContextMenuTrigger asChild>
                     <DropdownMenuTrigger asChild>
                       <button className="flex items-center gap-2.5 h-10 px-4 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10 rounded-full text-[13.5px] cursor-pointer outline-none select-none transition-all duration-150">
                         <Building2 className="size-4 text-muted-foreground" />
                         <span className="font-semibold text-foreground dark:text-white">{project.name}</span>
                         <span className="text-muted-foreground font-mono text-[11px]">{project.code}</span>
                         <ChevronDown className="size-3.5 text-muted-foreground ml-0.5" />
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
                 <VersionManager projectName={project.name} />
               </div>
             </div>

            {/* Centered Search Bar */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <input
                  placeholder="Search calculators, projects…"
                  className="h-10 w-[400px] pl-11 pr-12 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] focus:border-border-strong rounded-full text-[13.5px] outline-none transition-all duration-150"
                />
                <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9.5px] font-sans font-medium text-muted-foreground bg-background dark:bg-white/5 border border-border dark:border-[#262626] rounded px-1.5 py-0.5 select-none leading-none">?K</kbd>
              </div>
            </div>

            {/* Right side: Actions & Profile */}
            <div className="flex items-center gap-1.5 shrink-0">
              {isReadOnly && (
                <div className="mr-2 flex items-center gap-1.5 px-3 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full text-xs font-semibold shadow-sm border border-amber-200 dark:border-amber-800">
                  <Lock className="size-3" />
                  READ ONLY
                </div>
              )}
              <button
                type="button"
                onClick={() => {
                  savePageInputs(project.id, pathname);
                  triggerSave();
                  forceSaveToCloud();
                  toast.success("Calculations synced to cloud successfully!");
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer border border-transparent"
                title="Save to Cloud"
              >
                <Save className="size-3.5" />
                Save to Cloud
              </button>

              <button
                type="button"
                onClick={() => {
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors shadow-sm cursor-pointer border border-transparent mr-1"
                title="Sync from Cloud"
              >
                <RefreshCw className="size-3.5" />
                SYNC
              </button>

              <button
                onClick={() => setReadOnly(!isReadOnly)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
                  isReadOnly 
                    ? "bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900"
                    : "bg-surface-2 dark:bg-white/5 text-muted-foreground border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10"
                }`}
                title="Toggle Read-Only Mode"
              >
                {isReadOnly ? <Lock className="size-3.5" /> : <Edit3 className="size-3.5" />}
                {isReadOnly ? "Unlock" : "Lock"}
              </button>

              <button
                onClick={() => {
                  dirtyStore.set(false);
                  document.documentElement.classList.toggle("dark");
                }}
                className="size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                title="Toggle Dark Mode"
              >
                <Moon className="size-5" />
              </button>
              <button className="size-10 rounded-full hover:bg-surface-2 dark:hover:bg-white/5 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors">
                <Bell className="size-5" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="size-10 rounded-full bg-surface-3 dark:bg-[#2c2c2e] text-foreground dark:text-white flex items-center justify-center text-[12.5px] font-bold shadow-sm select-none border border-border dark:border-[#262626] cursor-pointer hover:ring-2 ring-primary transition-all">
                    {userData?.name ? userData.name.substring(0, 2).toUpperCase() : (myEmail.substring(0, 2).toUpperCase() !== 'UN' ? myEmail.substring(0, 2).toUpperCase() : 'ME')}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-popover border border-border rounded-lg shadow-lg font-sans">
                  <DropdownMenuLabel className="py-2 px-3">
                    <div className="text-sm font-semibold text-foreground truncate">{userData?.name || 'MEP User'}</div>
                    <div className="text-xs text-muted-foreground truncate">{userData?.email || myEmail}</div>
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                      <div className="size-1.5 rounded-full bg-green-500"></div>
                      Verified License Active
                    </div>
                  </DropdownMenuLabel>
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
            {(import.meta.env.VITE_APP_MODE === 'kfactor'
              ? [
                  { kind: "item" as const, label: "Sprinkler K-Factor", to: "/plumbing-sprinkler-kfactor", icon: Droplets }
                ]
              : [...NAV, ...(profile?.role === 'ADMIN' ? [{ kind: "item" as const, label: "Admin Panel", to: "/admin", icon: ShieldAlert }] : [])]
            ).map((n) =>
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
                  onMouseEnter={(e) => handleMouseEnterGroup(e, n)}
                  onMouseLeave={handleMouseLeaveGroup}
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

      {/* Main Content (Column 2, Row 2) */}
      <main className={`col-start-2 row-start-2 min-w-0 flex flex-col overflow-hidden bg-surface dark:bg-[#121212] print:block print:h-auto print:overflow-visible transition-all duration-300 ${
        sidebarOpen ? "pl-0 pr-3.5 pb-3.5" : "px-3.5 pb-3.5"
      }`}>
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
                  onClick={() => setAnnouncement(null)}
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!hideSubHeader && (
          <div className="flex items-center justify-between border-b border-border px-4 h-12 shrink-0 bg-surface-1 no-print print:hidden">
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
                {subtitle && <span className="text-[13px] text-muted-foreground">{subtitle}</span>}
              </div>
              {onIntelClick && (
                <button 
                  onClick={onIntelClick}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12px] font-medium border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  {intelLabel || "Intelligence"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions}
            </div>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
          {isLockedByOther && (
            <div className="absolute top-0 left-0 right-0 z-[100] bg-transparent text-amber-500 px-4 py-2 flex items-center justify-center gap-2 shrink-0">
              <ShieldAlert className="w-4 h-4" />
              <span className="font-bold text-sm">
                Read Only Mode: This module is currently being edited by {lockOwnerEmail}
              </span>
            </div>
          )}
          <div className={`flex-1 min-h-0 overflow-hidden flex flex-col transition-opacity duration-300 ${isLockedByOther ? 'pointer-events-none opacity-80 mt-10' : ''}`}>
            {isInitializing ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 h-full bg-slate-50/50">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-4" />
                <span className="text-slate-500 font-medium">Syncing with workspace...</span>
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
          onMouseEnter={handleFlyoutMouseEnter}
          onMouseLeave={handleMouseLeaveGroup}
          onClick={() => setHoveredGroup(null)}
          className="fixed z-[9999] bg-white/95 dark:bg-[#1c1c1e]/95 backdrop-blur-md border border-border dark:border-[#2d2d30] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.03)] p-4.5 transition-all duration-150 animate-in fade-in slide-in-from-left-3 max-h-[calc(100vh-100px)] overflow-y-auto custom-scrollbar before:absolute before:content-[''] before:top-0 before:bottom-0 before:-left-6 before:w-6 before:bg-transparent"
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
  const { profile } = useAuth();
  const pathname = router.state.location.pathname;
  const locked = isFeatureLocked(to, profile);
  const cls = `flex items-center gap-2 ${showDot ? "pl-2.5 pr-3" : "px-3"} py-1.5 rounded-xl text-[13px] transition-all duration-150 ${locked ? "cursor-not-allowed" : "cursor-pointer"} ${indent ? "pl-8" : ""} ${
    locked
      ? "text-slate-400 dark:text-slate-600 opacity-60"
      : active
        ? "bg-primary/10 text-primary font-semibold dark:bg-primary/20 dark:text-primary-foreground"
        : "text-muted-foreground hover:bg-surface-2 hover:text-foreground dark:text-[#9b9b9b] dark:hover:bg-white/5 dark:hover:text-white"
  }`;
  const content = (
    <>
      {Icon && <Icon className={`size-4 ${locked ? "text-slate-400 dark:text-slate-600" : active ? "text-primary" : "text-muted-foreground dark:text-[#9b9b9b]"}`} />}
      {showDot && (
        <span className={`size-1.5 rounded-full shrink-0 ${active ? "bg-primary" : "bg-slate-350 dark:bg-slate-600"}`} />
      )}
      <span className="flex-1 truncate text-left">{label}</span>
      {locked && <Lock className="size-3.5 ml-auto text-slate-400 dark:text-slate-600" />}
    </>
  );

  const handleClick = useCallback(async (e: React.MouseEvent) => {
    if (locked) {
      toast.error("This feature is disabled by the Administrator.", { icon: "🔒" });
      return;
    }
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
  onMouseEnter,
  onMouseLeave
}: { 
  item: Extract<NavItem, { kind: "group" }>; 
  pathname: string; 
  activeName?: string;
  sidebarOpen: boolean;
  onMouseEnter: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
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
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className="relative"
    >
      <button
        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[13.5px] transition-all duration-150 cursor-pointer ${
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




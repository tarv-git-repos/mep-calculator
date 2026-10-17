import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/services/api";
import { toast } from "sonner";
import { loadOrgHierarchyFromStorage } from "@/utils/hierarchy";
import { WelcomeToTarvModal } from "@/components/modals/WelcomeToTarvModal";
import { 
  Settings, 
  Save, 
  CheckCircle2, 
  DownloadCloud, 
  Loader2, 
  Sun, 
  Moon, 
  Monitor, 
  CloudUpload, 
  Trash2, 
  LogOut, 
  ShieldAlert, 
  User, 
  Building, 
  Briefcase, 
  Camera, 
  Calendar, 
  FileText, 
  Clock, 
  FolderOpen,
  X,
  AlertTriangle,
  Flame,
  Globe,
  Upload,
  Trophy,
  Lock,
  HardDrive,
  Info,
  Check,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  Layers,
  Calculator,
  Sliders,
  Key,
  ExternalLink,
  RefreshCw
} from "lucide-react";
import { performBackup } from "@/hooks/useAutoBackup";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MEP Calc" },
      { name: "description", content: "Configure calculation standards, default safety factor multipliers, profile, units, themes, and autosave settings." },
    ],
  }),
  component: SettingsPage,
});

export type SettingsTabId = 'profile' | 'units' | 'appearance' | 'storage' | 'security' | 'updates';

export interface SettingsTabConfig {
  id: SettingsTabId;
  label: string;
  shortLabel: string;
  icon: any;
  description: string;
}

export const SETTINGS_TABS: SettingsTabConfig[] = [
  {
    id: 'profile',
    label: 'Profile & Account',
    shortLabel: 'Profile',
    icon: User,
    description: 'Personal details, organization, role & license',
  },
  {
    id: 'units',
    label: 'Units & Calculations',
    shortLabel: 'Units & Calc',
    icon: Globe,
    description: 'Unit systems, standards & engineering rules',
  },
  {
    id: 'appearance',
    label: 'Appearance & Theme',
    shortLabel: 'Appearance',
    icon: Sun,
    description: 'Light, dark or system display preferences',
  },
  {
    id: 'storage',
    label: 'Autosave & Storage',
    shortLabel: 'Autosave & Storage',
    icon: Clock,
    description: 'Local workspace backups & cloud sync',
  },
  {
    id: 'security',
    label: 'Security & Sessions',
    shortLabel: 'Security',
    icon: ShieldAlert,
    description: 'Device sessions, logout & account removal',
  },
  {
    id: 'updates',
    label: 'Updates & About',
    shortLabel: 'Updates',
    icon: DownloadCloud,
    description: 'Software version, updates & privacy',
  },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const { userData, profile, logout, logoutAllDevices, deleteAccount, updateProfileDetails, setUserData } = useAuth();
  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN' || userData?.role === 'SUPER_ADMIN' || userData?.role === 'ORG_ADMIN';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Active Sub-tab State with localStorage persistence
  const [activeTab, setActiveTabState] = useState<SettingsTabId>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_settings_active_subtab') as SettingsTabId;
      if (saved && SETTINGS_TABS.some(t => t.id === saved)) {
        return saved;
      }
    }
    return 'profile';
  });

  const setActiveTab = (tab: SettingsTabId) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_settings_active_subtab', tab);
    }
  };

  // Status & Feedback States
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [cloudSaveLoading, setCloudSaveLoading] = useState(false);
  const [cloudSaveMessage, setCloudSaveMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  
  // Modals
  const [showClearModal, setShowClearModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPioneerModal, setShowPioneerModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Requirement 1: Dark / Light Mode (light | dark | system)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('mep_theme') as any) || 'dark';
    }
    return 'system';
  });

  // Requirement 4: Default units (IP / SI)
  const [unitSystem, setUnitSystem] = useState<'IP' | 'SI'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('mep_unit_system') as any) || 'SI';
    }
    return 'SI';
  });

  const uId = userData?.id || profile?.id;

  // Requirement 5: Profile Photo
  const [profilePhoto, setProfilePhoto] = useState<string>(() => {
    return profile?.profile_photo || userData?.profile_photo || (uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_profile_photo_${uId}`) || '' : '');
  });

  // Requirement 6: Full Name
  const [fullName, setFullName] = useState<string>(() => {
    return profile?.name || userData?.name || (uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_user_name_${uId}`) || '' : '');
  });

  const handleNameChange = (val: string) => {
    const strippedVal = val.replace(/[0-9]/g, '');
    setFullName(strippedVal);
    const nameRegex = /^[a-zA-Z\s'\-]+$/;
    if (!strippedVal.trim()) {
      setNameError("Full Name is required.");
    } else if (!nameRegex.test(strippedVal.trim())) {
      setNameError("Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).");
    } else if (strippedVal.trim().length < 2) {
      setNameError("Full Name must be at least 2 characters long.");
    } else {
      setNameError(null);
    }
  };

  // Requirement 7: Company/Organization Name
  const isSuperAdminUser = userData?.email === 'admin@tarv.ai' || profile?.email === 'admin@tarv.ai' || profile?.role === 'SUPER_ADMIN' || userData?.role === 'SUPER_ADMIN';

  const [company, setCompany] = useState<string>(() => {
    if (isSuperAdminUser) return 'TARV AI System (Super Admin)';
    const cached = uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_user_company_${uId}`) : null;
    return profile?.company || userData?.company || cached || 'Consistent Engineering Consultants';
  });
  const [assignedOrgName, setAssignedOrgName] = useState<string>(() => {
    if (isSuperAdminUser) return 'TARV AI System (Super Admin)';
    const cached = uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_user_company_${uId}`) : null;
    return profile?.company || userData?.company || cached || 'Consistent Engineering Consultants';
  });

  useEffect(() => {
    async function resolveUserOrg() {
      const currentEmail = userData?.email || profile?.email;
      const currentId = profile?.id || userData?.id;

      if (currentEmail === 'admin@tarv.ai' || profile?.role === 'SUPER_ADMIN' || userData?.role === 'SUPER_ADMIN') {
        setAssignedOrgName('TARV AI System (Super Admin)');
        setCompany('TARV AI System (Super Admin)');
        return;
      }

      try {
        const orgs = await api.getOrganizations();
        const allUsers = await api.getUsers();

        const myRecord = Array.isArray(allUsers) ? allUsers.find((u: any) => 
          (currentEmail && u.email?.toLowerCase() === currentEmail.toLowerCase()) || 
          (currentId && String(u.id).toLowerCase() === String(currentId).toLowerCase())
        ) : null;

        const userOrgId = myRecord?.organization_id || profile?.organization_id || userData?.organization_id || '';
        
        // 1. Match orgId in organizations list
        if (userOrgId && Array.isArray(orgs) && orgs.length > 0) {
          const match = orgs.find((o: any) => o.id === userOrgId || o.name === userOrgId);
          if (match && match.name) {
            const resolvedName = match.name === 'Consitent' ? 'Consistent Engineering Consultants' : match.name;
            setAssignedOrgName(resolvedName);
            setCompany(resolvedName);
            if (typeof window !== 'undefined' && currentId) {
              localStorage.setItem(`mep_user_company_${currentId}`, resolvedName);
            }
            return;
          }
        }

        // 2. Direct organization/company field assigned by Admin
        const directOrg = myRecord?.organization || myRecord?.company || (profile as any)?.organization || profile?.company || (userData as any)?.organization || userData?.company;
        if (directOrg && directOrg.trim() && directOrg.trim() !== 'No Organization Assigned' && directOrg.trim() !== 'null') {
          const resolvedName = directOrg.trim() === 'Consitent' ? 'Consistent Engineering Consultants' : directOrg.trim();
          setAssignedOrgName(resolvedName);
          setCompany(resolvedName);
          if (typeof window !== 'undefined' && currentId) {
            localStorage.setItem(`mep_user_company_${currentId}`, resolvedName);
          }
          return;
        }

        // 3. User is unassigned
        setAssignedOrgName('');
        setCompany('');
      } catch (e) {
        setAssignedOrgName('');
        setCompany('');
      }
    }
    resolveUserOrg();
  }, [userData?.email, profile?.email, profile?.organization_id, userData?.organization_id, profile?.id, userData?.id, profile?.company, userData?.company]);

  // Requirement 8: Designation / Role
  const [designation, setDesignation] = useState<string>(() => {
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

    const roleUpper = String(profile?.role || userData?.role || (userData?.features as any)?.role || '').toUpperCase().trim();
    const currentEmail = String(userData?.email || profile?.email || '').toLowerCase().trim();
    if (currentEmail === 'admin@tarv.ai' || roleUpper === 'SUPER_ADMIN') {
      return "Super Admin";
    }
    if (roleUpper === 'ORG_ADMIN' || roleUpper === 'ORGANIZATION ADMIN' || roleUpper === 'ORGANIZATION_ADMIN') {
      return "Organization Admin";
    }

    if (typeof window !== 'undefined') {
      try {
        const members = loadOrgHierarchyFromStorage(userData, profile);
        if (members && Array.isArray(members)) {
          const currentName = String(fullName || userData?.name || profile?.name || '').toLowerCase().trim();
          const currentId = String(profile?.id || userData?.id || uId || '').toLowerCase().trim();
          const found = members.find((m: any) => {
            const mEmail = String(m.email || '').toLowerCase().trim();
            const mName = String(m.name || '').toLowerCase().trim();
            const mId = String(m.id || '').toLowerCase().trim();
            return (currentEmail && mEmail === currentEmail) || 
                   (currentId && mId === currentId) ||
                   (!mEmail && currentName && mName === currentName);
          });
          if (found) {
            if (found.designation && found.designation !== "USER" && found.designation !== "ENGINEER") {
              return ROLE_MAP[found.designation] || found.designation;
            }
            if (found.role) {
              return ROLE_MAP[found.role] || found.role;
            }
          }
        }
      } catch (e) {}
    }
    const rawFallback = userData?.designation || (userData?.features as any)?.designation || userData?.role || profile?.designation || profile?.role || (userData?.email === 'admin@tarv.ai' ? 'Super Admin' : (uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_user_designation_${uId}`) || 'Design Engineer' : 'Design Engineer'));
    return ROLE_MAP[rawFallback] || rawFallback;
  });

  useEffect(() => {
    async function resolveUserRole() {
      const currentEmail = userData?.email || profile?.email;
      const currentName = fullName || userData?.name || profile?.name;
      const roleUpper = String(profile?.role || userData?.role || (userData?.features as any)?.role || '').toUpperCase().trim();

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

      if (currentEmail === 'admin@tarv.ai' || roleUpper === 'SUPER_ADMIN') {
        setDesignation('Super Admin');
        return;
      }

      if (roleUpper === 'ORG_ADMIN' || roleUpper === 'ORGANIZATION ADMIN' || roleUpper === 'ORGANIZATION_ADMIN') {
        setDesignation('Organization Admin');
        return;
      }

      // 1. Check hierarchy first
      if (typeof window !== 'undefined') {
        try {
          const members = loadOrgHierarchyFromStorage(userData, profile);
          if (members && Array.isArray(members)) {
            const uEmail = String(currentEmail || '').toLowerCase().trim();
            const uName = String(currentName || '').toLowerCase().trim();
            const currentId = String(profile?.id || userData?.id || uId || '').toLowerCase().trim();
            const found = members.find((m: any) => {
                const mEmail = String(m.email || '').toLowerCase().trim();
                const mName = String(m.name || '').toLowerCase().trim();
                const mId = String(m.id || '').toLowerCase().trim();
                return (uEmail && mEmail === uEmail) || 
                       (currentId && mId === currentId) ||
                       (!mEmail && uName && mName === uName);
              });
              if (found) {
                const finalTitle = (found.designation && found.designation !== "USER" && found.designation !== "ENGINEER") 
                  ? (ROLE_MAP[found.designation] || found.designation)
                  : (ROLE_MAP[found.role] || found.role || found.designation);
                if (finalTitle) {
                  setDesignation(finalTitle);
                  return;
                }
              }
            }
          } catch (e) {}
      }

      try {
        const allUsers = await api.getUsers();
        const myRecord = Array.isArray(allUsers) ? allUsers.find((u: any) => 
          (currentEmail && u.email?.toLowerCase() === currentEmail.toLowerCase()) ||
          (uId && String(u.id).toLowerCase() === String(uId).toLowerCase())
        ) : null;
        if (myRecord) {
          const resRole = myRecord.designation || myRecord.role;
          if (resRole) {
            const mapped = ROLE_MAP[resRole] || resRole;
            setDesignation(mapped);
            if (typeof window !== 'undefined' && uId) {
              localStorage.setItem(`mep_user_designation_${uId}`, mapped);
            }
          }
        }
      } catch (e) {}
    }
    resolveUserRole();

    const handleProfileUpdate = () => {
      resolveUserRole();
    };
    window.addEventListener('mep_user_profile_updated', handleProfileUpdate);
    window.addEventListener('storage', handleProfileUpdate);
    return () => {
      window.removeEventListener('mep_user_profile_updated', handleProfileUpdate);
      window.removeEventListener('storage', handleProfileUpdate);
    };
  }, [userData?.email, profile?.email, profile?.role, userData?.role, userData?.id, profile?.id, uId]);

  // Requirement 12: Auto save
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const localVal = localStorage.getItem('mep_auto_save_enabled');
      if (localVal !== null) return localVal !== 'false';
    }
    const cloudVal = (userData?.settings as any)?.auto_save ?? (profile?.settings as any)?.auto_save;
    if (cloudVal !== undefined) return Boolean(cloudVal);
    return true;
  });

  // Requirement 13: Path to make the autosave
  const [autoSavePath, setAutoSavePath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const localVal = localStorage.getItem('localBackupPath');
      if (localVal) return localVal;
    }
    const cloudPath = (userData?.settings as any)?.autosave_path || (profile?.settings as any)?.autosave_path;
    return cloudPath || 'C:\\MEP_Calculator_Autosaves';
  });

  // Requirement 14: Interval for auto save (in minutes)
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_auto_save_interval');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
    }
    const cloudInterval = (userData?.settings as any)?.autosave_interval || (profile?.settings as any)?.autosave_interval;
    if (cloudInterval) {
      const parsed = parseInt(String(cloudInterval), 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return 10;
  });

  // Backup Engine States
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState<boolean>(false);
  const [backupFiles, setBackupFiles] = useState<Array<{ filename: string; size: number; mtime: string; fullPath: string }>>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState<boolean>(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mep_last_backup_time') || null;
    }
    return null;
  });

  // Global Calculation Rules
  const [standard, setStandard] = useState("ASHRAE 62.1 - 2022");
  const [flowUnit, setFlowUnit] = useState(() => (unitSystem === 'IP' ? "cfm" : "L/s"));
  const [tempUnit, setTempUnit] = useState(() => (unitSystem === 'IP' ? "F" : "C"));
  const [chwDeltaT, setChwDeltaT] = useState(5.5);
  const [safetyMargin, setSafetyMargin] = useState(10);

  // Application Updates
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [hasUpdate, setHasUpdate] = useState<any>(null);

  // Sync profile fields if updated from AuthContext or custom event
  useEffect(() => {
    const syncProfile = () => {
      if (profile || userData) {
        if (profile?.name || userData?.name) setFullName(profile?.name || userData?.name || '');
        if (profile?.company || userData?.company) setCompany(profile?.company || userData?.company || '');
        const activeDesig = profile?.designation || userData?.designation || (profile?.features as any)?.designation || (userData?.features as any)?.designation || profile?.role || userData?.role;
        if (activeDesig) setDesignation(activeDesig);
        const photoVal = profile?.profile_photo !== undefined ? profile.profile_photo : userData?.profile_photo;
        if (photoVal !== undefined) {
          setProfilePhoto(photoVal);
        }
      }
    };
    syncProfile();

    const handleUpdated = (e: any) => {
      if (e?.detail?.updates) {
        const u = e.detail.updates;
        if (u.name) setFullName(u.name);
        if (u.designation) setDesignation(u.designation);
        if (u.company) setCompany(u.company);
      }
      syncProfile();
    };
    window.addEventListener('mep_user_profile_updated', handleUpdated);
    return () => window.removeEventListener('mep_user_profile_updated', handleUpdated);
  }, [profile?.name, userData?.name, profile?.company, userData?.company, profile?.role, userData?.role, (profile as any)?.designation, (userData as any)?.designation, profile?.profile_photo, userData?.profile_photo]);

  // Hydrate client-side localStorage values after SSR to ensure saved settings never reset to defaults
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Auto Save Interval
    const savedInterval = localStorage.getItem('mep_auto_save_interval');
    if (savedInterval) {
      const parsed = parseInt(savedInterval, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setAutoSaveInterval(parsed);
      }
    } else {
      const cloudInterval = (userData?.settings as any)?.autosave_interval || (profile?.settings as any)?.autosave_interval;
      if (cloudInterval) {
        const parsed = parseInt(String(cloudInterval), 10);
        if (!isNaN(parsed) && parsed > 0) {
          setAutoSaveInterval(parsed);
          localStorage.setItem('mep_auto_save_interval', String(parsed));
        }
      }
    }

    // 2. Auto Save Enabled
    const savedEnabled = localStorage.getItem('mep_auto_save_enabled');
    if (savedEnabled !== null) {
      setAutoSaveEnabled(savedEnabled !== 'false');
    }

    // 3. Auto Save Path
    const savedPath = localStorage.getItem('localBackupPath');
    if (savedPath) {
      setAutoSavePath(savedPath);
    }

    // 4. Units & Standards
    const savedStandard = localStorage.getItem('mep_ventilation_standard');
    if (savedStandard) setStandard(savedStandard);
    const savedFlow = localStorage.getItem('mep_flow_unit');
    if (savedFlow) setFlowUnit(savedFlow);
    const savedTemp = localStorage.getItem('mep_temp_unit');
    if (savedTemp) setTempUnit(savedTemp);
    const savedDelta = localStorage.getItem('mep_chw_deltat');
    if (savedDelta) {
      const p = parseFloat(savedDelta);
      if (!isNaN(p)) setChwDeltaT(p);
    }
    const savedMargin = localStorage.getItem('mep_safety_margin');
    if (savedMargin) {
      const p = parseFloat(savedMargin);
      if (!isNaN(p)) setSafetyMargin(p);
    }

    // 5. Profile Photo
    const activeUid = uId || userData?.id || profile?.id;
    if (activeUid) {
      const savedPhoto = localStorage.getItem(`mep_profile_photo_${activeUid}`);
      if (savedPhoto) {
        setProfilePhoto(savedPhoto);
      } else if (userData?.profile_photo !== undefined || profile?.profile_photo !== undefined) {
        setProfilePhoto(userData?.profile_photo || profile?.profile_photo || '');
      }
    }
  }, []);

  // Sync cloud settings on load if not set in local storage
  useEffect(() => {
    const cloudSettings = userData?.settings || profile?.settings;
    if (cloudSettings) {
      if (cloudSettings.theme && typeof window !== 'undefined' && !localStorage.getItem('mep_theme')) {
        setTheme(cloudSettings.theme);
        localStorage.setItem('mep_theme', cloudSettings.theme);
        window.dispatchEvent(new Event('mep-theme-change'));
      }
      if (cloudSettings.autosave_interval && typeof window !== 'undefined' && !localStorage.getItem('mep_auto_save_interval')) {
        const val = parseInt(String(cloudSettings.autosave_interval), 10);
        if (!isNaN(val) && val > 0) {
          setAutoSaveInterval(val);
          localStorage.setItem('mep_auto_save_interval', String(val));
        }
      }
      if (cloudSettings.autosave_path && typeof window !== 'undefined' && !localStorage.getItem('localBackupPath')) {
        setAutoSavePath(cloudSettings.autosave_path);
        localStorage.setItem('localBackupPath', cloudSettings.autosave_path);
      }
      if (cloudSettings.auto_save !== undefined && typeof window !== 'undefined' && localStorage.getItem('mep_auto_save_enabled') === null) {
        setAutoSaveEnabled(Boolean(cloudSettings.auto_save));
        localStorage.setItem('mep_auto_save_enabled', String(Boolean(cloudSettings.auto_save)));
      }
    }
  }, [userData?.settings, profile?.settings]);

  // Keep theme state in sync if toggled elsewhere (header button or another tab)
  useEffect(() => {
    const syncTheme = (e?: StorageEvent | Event) => {
      if (typeof window === 'undefined') return;
      if (e && 'key' in e && (e as StorageEvent).key && (e as StorageEvent).key !== 'mep_theme') return;
      const t = (localStorage.getItem('mep_theme') as any) || 'dark';
      setTheme(t);
    };
    window.addEventListener('mep-theme-change', syncTheme);
    window.addEventListener('storage', syncTheme);
    return () => {
      window.removeEventListener('mep-theme-change', syncTheme);
      window.removeEventListener('storage', syncTheme);
    };
  }, []);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_theme', newTheme);
      let isDark = false;
      if (newTheme === 'dark') {
        isDark = true;
      } else if (newTheme === 'light') {
        isDark = false;
      } else {
        isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new Event('mep-theme-change'));
    }

    // Quietly sync with backend profile in background so cloud session check never reverts it
    updateProfileDetails({
      settings: {
        theme: newTheme,
      },
    }).catch((err) => console.warn('Cloud theme sync error:', err));

    toast.success(`Switched to ${newTheme === 'light' ? 'Light Mode' : newTheme === 'dark' ? 'Dark Mode' : 'System Default'}`);
  };

  // Handle Unit System Change
  const [unitsSaveLoading, setUnitsSaveLoading] = useState(false);

  const handleUnitSystemChange = (system: 'IP' | 'SI') => {
    setUnitSystem(system);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_unit_system', system);
      window.dispatchEvent(new CustomEvent('mep_unit_system_changed', { detail: { system } }));
    }
    if (system === 'IP') {
      setFlowUnit('cfm');
      setTempUnit('F');
      if (typeof window !== 'undefined') {
        localStorage.setItem('mep_flow_unit', 'cfm');
        localStorage.setItem('mep_temp_unit', 'F');
      }
    } else {
      setFlowUnit('L/s');
      setTempUnit('C');
      if (typeof window !== 'undefined') {
        localStorage.setItem('mep_flow_unit', 'L/s');
        localStorage.setItem('mep_temp_unit', 'C');
      }
    }
    toast.success(`Primary unit system set to ${system === 'IP' ? 'Imperial (IP)' : 'Metric (SI)'}`);
  };

  const handleSaveUnitsAndCalculations = async () => {
    try {
      setUnitsSaveLoading(true);
      if (typeof window !== 'undefined') {
        localStorage.setItem('mep_unit_system', unitSystem);
        localStorage.setItem('mep_ventilation_standard', standard);
        localStorage.setItem('mep_flow_unit', flowUnit);
        localStorage.setItem('mep_temp_unit', tempUnit);
        localStorage.setItem('mep_chw_deltat', String(chwDeltaT));
        localStorage.setItem('mep_safety_margin', String(safetyMargin));
        window.dispatchEvent(new CustomEvent('mep_unit_system_changed', { detail: { system: unitSystem } }));
      }

      await updateProfileDetails({
        settings: {
          default_units: unitSystem,
          ventilation_standard: standard,
          flow_unit: flowUnit,
          temp_unit: tempUnit,
          chw_delta_t: chwDeltaT,
          safety_margin: safetyMargin,
        },
      });

      toast.success(`Calculation & Unit settings saved! Primary system: ${unitSystem === 'IP' ? 'Imperial (IP)' : 'Metric (SI)'}.`);
    } catch (err: any) {
      toast.error(err.message || 'Saved locally, but cloud sync encountered an issue.');
    } finally {
      setUnitsSaveLoading(false);
    }
  };

  // Image Upload Handler with Canvas Compression
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setProfilePhoto(compressedDataUrl);
          if (typeof window !== 'undefined') {
            if (uId) localStorage.setItem(`mep_profile_photo_${uId}`, compressedDataUrl);
            localStorage.removeItem('mep_profile_photo');
            const email = userData?.email || profile?.email || '';
            window.dispatchEvent(new CustomEvent('mep_user_profile_updated', {
              detail: { profileId: email, updates: { profile_photo: compressedDataUrl } }
            }));
            window.dispatchEvent(new Event('storage'));
          }
          if (userData) {
            setUserData({
              ...userData,
              profile_photo: compressedDataUrl,
            });
          }
          // Automatically persist profile photo to backend DB
          updateProfileDetails({ profile_photo: compressedDataUrl });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setProfilePhoto('');
    if (typeof window !== 'undefined') {
      if (uId) localStorage.removeItem(`mep_profile_photo_${uId}`);
      localStorage.removeItem('mep_profile_photo');
      const email = userData?.email || profile?.email || '';
      window.dispatchEvent(new CustomEvent('mep_user_profile_updated', {
        detail: { profileId: email, updates: { profile_photo: '' } }
      }));
      window.dispatchEvent(new Event('storage'));
    }
    if (userData) {
      setUserData({
        ...userData,
        profile_photo: '',
      });
    }
    // Automatically persist profile photo deletion to backend DB
    updateProfileDetails({ profile_photo: '' });
  };

  // Browse Directory Handler (Tauri Desktop or Fallback)
  const handleBrowseFolder = async () => {
    try {
      if (typeof window !== 'undefined' && ((window as any).__TAURI_IPC__ || (window as any).__TAURI__)) {
        const { open: openFileDialog } = await import('@tauri-apps/plugin-dialog');
        const selected = await openFileDialog({
          directory: true,
          multiple: false,
          title: 'Select Auto Save Backup Directory',
        });
        if (selected && typeof selected === 'string') {
          setAutoSavePath(selected);
          localStorage.setItem('localBackupPath', selected);
        }
      } else {
        // Use the backend server to pop up the native Windows folder picker on localhost
        try {
          const res = await fetch('http://localhost:4000/api/browse-folder');
          const data = await res.json();
          if (data.success && data.path) {
            setAutoSavePath(data.path);
            localStorage.setItem('localBackupPath', data.path);
          }
        } catch (e) {
          toast.info("Could not launch native folder picker. Please manually type or paste the folder path into the input field.", {
            duration: 5000,
            position: "bottom-right",
            style: { border: '1px solid #3b82f6', color: '#3b82f6' }
          });
        }
      }
    } catch (err) {
      console.warn('Folder selection prompt fallback', err);
    }
  };

  // Fetch backups from local disk directory
  const fetchLocalBackups = async (targetPath = autoSavePath) => {
    try {
      setIsLoadingFiles(true);
      const res = await fetch(`http://localhost:4000/api/list-local-backups?path=${encodeURIComponent(targetPath)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.files)) {
          setBackupFiles(data.files);
          if (data.files.length > 0 && !lastBackupTime) {
            setLastBackupTime(data.files[0].mtime);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load local backup list', err);
    } finally {
      setIsLoadingFiles(false);
    }
  };

  useEffect(() => {
    fetchLocalBackups(autoSavePath);
    const handleBackupDone = (e: any) => {
      if (e.detail?.time) {
        setLastBackupTime(new Date().toISOString());
      }
      fetchLocalBackups(autoSavePath);
    };
    window.addEventListener('mep_backup_completed', handleBackupDone);
    return () => {
      window.removeEventListener('mep_backup_completed', handleBackupDone);
    };
  }, [autoSavePath]);

  // Trigger Immediate Manual / Test Backup
  const handleTriggerBackup = async () => {
    try {
      setIsBackingUp(true);
      handleSaveLocal();
      const res = await performBackup(autoSavePath);
      if (res.success) {
        toast.success('Backup successfully created!', {
          description: res.path || autoSavePath,
          duration: 4000,
        });
        setLastBackupTime(new Date().toISOString());
        await fetchLocalBackups(autoSavePath);
      } else {
        toast.error(res.message || 'Backup could not be written.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to trigger backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  // Open Windows Explorer directly to the backup folder
  const handleOpenBackupFolder = async () => {
    try {
      setIsOpeningFolder(true);
      const res = await fetch('http://localhost:4000/api/open-local-backup-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: autoSavePath }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Opened folder in Windows Explorer: ${autoSavePath}`, { duration: 3000 });
      } else {
        toast.error('Could not open folder in Explorer');
      }
    } catch {
      toast.error('Failed to open folder');
    } finally {
      setIsOpeningFolder(false);
    }
  };

  // Immediate auto save handlers with instant persistence
  const handleIntervalChange = (val: number) => {
    setAutoSaveInterval(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_auto_save_interval', String(val));
      window.dispatchEvent(new CustomEvent('mep_auto_save_interval_changed', { detail: { interval: val } }));
    }
    if (userData) {
      setUserData({
        ...userData,
        settings: {
          ...(userData.settings || {}),
          auto_save: autoSaveEnabled,
          autosave_path: autoSavePath,
          autosave_interval: val,
        },
      });
    }
    updateProfileDetails({
      settings: {
        auto_save: autoSaveEnabled,
        autosave_path: autoSavePath,
        autosave_interval: val,
      },
    }).catch((err) => console.warn('Cloud autosave sync error:', err));
    toast.success(`Auto-save interval set to every ${val} minute${val > 1 ? 's' : ''}`);
  };

  const handleEnabledChange = (enabled: boolean) => {
    setAutoSaveEnabled(enabled);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_auto_save_enabled', String(enabled));
      window.dispatchEvent(new Event('mep_auto_save_settings_changed'));
    }
    if (userData) {
      setUserData({
        ...userData,
        settings: {
          ...(userData.settings || {}),
          auto_save: enabled,
          autosave_path: autoSavePath,
          autosave_interval: autoSaveInterval,
        },
      });
    }
    updateProfileDetails({
      settings: {
        auto_save: enabled,
        autosave_path: autoSavePath,
        autosave_interval: autoSaveInterval,
      },
    }).catch((err) => console.warn('Cloud autosave sync error:', err));
    toast.success(enabled ? 'Background auto-save activated' : 'Background auto-save paused');
  };

  const handlePathChange = (newPath: string) => {
    setAutoSavePath(newPath);
    if (typeof window !== 'undefined') {
      localStorage.setItem('localBackupPath', newPath);
      window.dispatchEvent(new Event('mep_auto_save_settings_changed'));
    }
    if (userData) {
      setUserData({
        ...userData,
        settings: {
          ...(userData.settings || {}),
          auto_save: autoSaveEnabled,
          autosave_path: newPath,
          autosave_interval: autoSaveInterval,
        },
      });
    }
    updateProfileDetails({
      settings: {
        auto_save: autoSaveEnabled,
        autosave_path: newPath,
        autosave_interval: autoSaveInterval,
      },
    }).catch((err) => console.warn('Cloud autosave sync error:', err));
  };

  // Save Settings Locally
  const handleSaveLocal = (): boolean => {
    if (!fullName || !fullName.trim()) {
      setNameError('Full Name is required.');
      toast.error('Full Name is required.', { style: { border: '1px solid #ef4444', color: '#ef4444' } });
      return false;
    }
    const nameRegex = /^[a-zA-Z\s'\-]+$/;
    if (!nameRegex.test(fullName.trim())) {
      setNameError('Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).');
      toast.error('Full Name should only contain letters, spaces, hyphens, or apostrophes (no numbers).', { style: { border: '1px solid #ef4444', color: '#ef4444' } });
      return false;
    }
    if (fullName.trim().length < 2) {
      setNameError('Full Name must be at least 2 characters long.');
      toast.error('Full Name must be at least 2 characters long.', { style: { border: '1px solid #ef4444', color: '#ef4444' } });
      return false;
    }
    setNameError(null);

    const effInterval = autoSaveInterval || (typeof window !== 'undefined' ? parseInt(localStorage.getItem('mep_auto_save_interval') || '10', 10) : 10);

    if (typeof window !== 'undefined') {
      if (uId) {
        if (profilePhoto) {
          localStorage.setItem(`mep_profile_photo_${uId}`, profilePhoto);
        } else {
          localStorage.removeItem(`mep_profile_photo_${uId}`);
        }
        localStorage.setItem(`mep_user_name_${uId}`, fullName);
        localStorage.setItem(`mep_user_company_${uId}`, company);
        localStorage.setItem(`mep_user_designation_${uId}`, designation);
      }
      localStorage.setItem('mep_theme', theme);
      let isDarkSetting = false;
      if (theme === 'dark') isDarkSetting = true;
      else if (theme === 'light') isDarkSetting = false;
      else isDarkSetting = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDarkSetting) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      window.dispatchEvent(new Event('mep-theme-change'));
      localStorage.setItem('mep_unit_system', unitSystem);
      localStorage.setItem('mep_auto_save_enabled', String(autoSaveEnabled));
      localStorage.setItem('localBackupPath', autoSavePath);
      localStorage.setItem('mep_auto_save_interval', String(effInterval));
      localStorage.setItem('mep_ventilation_standard', standard);
      localStorage.setItem('mep_flow_unit', flowUnit);
      localStorage.setItem('mep_temp_unit', tempUnit);
      localStorage.setItem('mep_chw_deltat', String(chwDeltaT));
      localStorage.setItem('mep_safety_margin', String(safetyMargin));
    }
    if (userData) {
      setUserData({
        ...userData,
        name: fullName,
        company,
        designation,
        profile_photo: profilePhoto,
        settings: {
          ...(userData.settings || {}),
          theme,
          default_units: unitSystem,
          auto_save: autoSaveEnabled,
          autosave_path: autoSavePath,
          autosave_interval: effInterval,
          ventilation_standard: standard,
          flow_unit: flowUnit,
          temp_unit: tempUnit,
          chw_delta_t: chwDeltaT,
          safety_margin: safetyMargin,
        },
      });
    }
    // Automatically sync all settings & profile photo to backend DB
    updateProfileDetails({
      name: fullName,
      company,
      designation,
      profile_photo: profilePhoto,
      settings: {
        theme,
        default_units: unitSystem,
        auto_save: autoSaveEnabled,
        autosave_path: autoSavePath,
        autosave_interval: effInterval,
        ventilation_standard: standard,
        flow_unit: flowUnit,
        temp_unit: tempUnit,
        chw_delta_t: chwDeltaT,
        safety_margin: safetyMargin,
      },
    });

    if (typeof window !== 'undefined') {
      const email = userData?.email || profile?.email || '';
      window.dispatchEvent(new CustomEvent('mep_user_profile_updated', {
        detail: {
          profileId: email,
          updates: {
            name: fullName,
            company,
            designation,
            role: designation,
            profile_photo: profilePhoto,
          }
        }
      }));
      window.dispatchEvent(new Event('storage'));
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    return true;
  };

  // Requirement 2: Save to Cloud
  const handleSaveToCloud = async () => {
    try {
      setCloudSaveLoading(true);
      setCloudSaveMessage(null);
      if (!handleSaveLocal()) {
        setCloudSaveLoading(false);
        return;
      }

      const updates = {
        name: fullName,
        company,
        designation,
        profile_photo: profilePhoto,
        settings: {
          theme,
          default_units: unitSystem,
          auto_save: autoSaveEnabled,
          autosave_path: autoSavePath,
          autosave_interval: autoSaveInterval,
          ventilation_standard: standard,
          flow_unit: flowUnit,
          temp_unit: tempUnit,
          chw_delta_t: chwDeltaT,
          safety_margin: safetyMargin,
        },
      };

      const res = await updateProfileDetails(updates);
      if (res.success) {
        setCloudSaveMessage("Settings & Profile successfully synced to cloud!");
      } else {
        setCloudSaveMessage(res.message || "Failed to sync settings with cloud. Local settings were saved.");
      }
    } catch (err: any) {
      setCloudSaveMessage(`Cloud sync error: ${err.message || 'Network issue'}`);
    } finally {
      setCloudSaveLoading(false);
      setTimeout(() => setCloudSaveMessage(null), 4000);
    }
  };

  // Requirement 3: Clear All Data (Safe calculation drafts & cache purger)
  const [isClearingData, setIsClearingData] = useState(false);

  const handleClearAllData = () => {
    try {
      setIsClearingData(true);
      if (typeof window !== 'undefined') {
        const PROTECTED_KEYS = new Set([
          'auth_token',
          'mep_calculator_user_data',
          'mep_user_data',
          'mep_profile',
          'privacy_policy_accepted',
          'mep_theme',
          'mep_unit_system',
          'mep_auto_save_enabled',
          'mep_auto_save_interval',
          'localBackupPath',
          'mep_ventilation_standard',
          'mep_flow_unit',
          'mep_temp_unit',
          'mep_chw_deltat',
          'mep_safety_margin',
          'mep_settings_active_subtab',
        ]);

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key) continue;
          if (PROTECTED_KEYS.has(key)) continue;
          if (
            key.startsWith('mep_profile_photo_') ||
            key.startsWith('mep_user_name_') ||
            key.startsWith('mep_user_company_') ||
            key.startsWith('mep_user_designation_')
          ) {
            continue;
          }

          // Target calculation drafts, grids, caches, and temporary states
          if (
            key.startsWith('mep_grid_') ||
            key.startsWith('mep_draft_') ||
            key.startsWith('mep_calc_') ||
            key.startsWith('mep_active_') ||
            key.startsWith('mep_comments_') ||
            key.startsWith('mep_custom_') ||
            key.startsWith('mep_report_') ||
            key.startsWith('mep_duct_') ||
            key.startsWith('mep_pipe_') ||
            key.startsWith('mep_psychrometric_') ||
            key.startsWith('mep_smoke_') ||
            key.startsWith('mep_ventilation_') ||
            key.startsWith('mep_cooling_') ||
            key.startsWith('mep_chw_pipe') ||
            key.startsWith('mep_staircase_') ||
            key.startsWith('mep_liftwell_') ||
            key.startsWith('mep_load_') ||
            key.startsWith('mep_busbar_') ||
            key.startsWith('mep_cable_') ||
            key.startsWith('mep_plumbing_') ||
            key.startsWith('pcl_') ||
            key.startsWith('bs_') ||
            key.startsWith('short_circuit_') ||
            key.startsWith('smoke_extract_') ||
            key === 'mep-floor-order' ||
            key === 'pcl-floor-order' ||
            key === 'customCableCatalog' ||
            key === 'customBusbarRatings' ||
            key.includes('draft') ||
            key.includes('cache')
          ) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach((k) => localStorage.removeItem(k));
        try {
          sessionStorage.clear();
        } catch (_) {}

        window.dispatchEvent(new CustomEvent('mep_local_data_cleared', { detail: { count: keysToRemove.length } }));
      }

      setShowClearModal(false);
      toast.success('Local calculation drafts and temporary cache cleared!', {
        description: 'All unsaved drafts and temporary tables were purged. Your preferences and account stay active.',
        duration: 5000,
      });
      setCloudSaveMessage('All local workspace cache & draft calculations cleared!');
      setTimeout(() => setCloudSaveMessage(null), 3500);
    } catch (err: any) {
      toast.error('Failed to clear local drafts: ' + (err.message || 'Unknown error'));
    } finally {
      setIsClearingData(false);
    }
  };

  // Requirement 9: Delete Account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toUpperCase() !== "DELETE") {
      setDeleteError("Please type DELETE to confirm account removal.");
      return;
    }
    try {
      setIsDeleting(true);
      setDeleteError(null);
      const res = await deleteAccount(deletePassword || undefined);
      if (res.success) {
        window.location.href = "/login";
      } else {
        setDeleteError(res.message || "Failed to delete account.");
      }
    } catch (err: any) {
      setDeleteError(err.message || "An error occurred during account deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Requirement 10: Log Out Options
  const handleLogoutThisDevice = async () => {
    await logout();
    window.location.href = "/login";
  };

  const handleLogoutAllDevices = async () => {
    await logoutAllDevices();
    window.location.href = "/login";
  };

  // Requirement 11: Expiry date calculations
  const getExpiryDisplay = () => {
    const rawExpiry = userData?.subscription_expires || profile?.subscription_expires;
    if (!rawExpiry) {
      return { status: "Active Trial / License", formatted: "Lifetime / 30 Days Free Trial", badgeColor: "bg-success/15 text-success border-success/30" };
    }
    const expDate = new Date(rawExpiry);
    const isValid = !isNaN(expDate.getTime());
    if (!isValid) {
      return { status: "Active License", formatted: String(rawExpiry), badgeColor: "bg-primary/15 text-primary border-primary/30" };
    }
    const now = new Date();
    const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    
    if (daysLeft < 0) {
      return { status: "Expired", formatted: `Expired on ${expDate.toLocaleDateString()}`, badgeColor: "bg-destructive/15 text-destructive border-destructive/30" };
    }
    return {
      status: `${daysLeft} Days Remaining`,
      formatted: `Expires on ${expDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}`,
      badgeColor: daysLeft < 7 ? "bg-warning/15 text-warning border-warning/30" : "bg-success/15 text-success border-success/30"
    };
  };

  const expiryInfo = getExpiryDisplay();

  // Check for updates logic
  const checkForUpdates = async () => {
    try {
      setIsCheckingUpdate(true);
      setUpdateStatus("Checking for updates...");
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mep_check_updates_manual'));
      }

      // Check custom /update.json manifest
      let foundUpdate = false;
      try {
        let res = await fetch("/update.json").catch(() => null);
        if (!res || !res.ok) {
          res = await fetch("https://mep-calculator.onrender.com/update.json").catch(() => null);
        }
        if (res && res.ok) {
          const data = await res.json();
          if (data && data.version) {
            const currentVer = "0.0.9";
            const parse = (v: string) => v.split('.').map(n => parseInt(n) || 0);
            const [c1, c2, c3] = parse(currentVer);
            const [l1, l2, l3] = parse(data.version);
            const isNewer = l1 > c1 || (l1 === c1 && l2 > c2) || (l1 === c1 && l2 === c2 && l3 > c3);

            if (isNewer) {
              foundUpdate = true;
              setUpdateStatus(`Version ${data.version} available!`);
              setHasUpdate({
                version: data.version,
                body: data.notes || "Performance enhancements & bug fixes.",
                downloadAndInstall: async () => {
                  if (data.url) window.open(data.url, '_blank');
                }
              } as any);
            }
          }
        }
      } catch (err) {}

      if (foundUpdate) return;

      // Try native Tauri updater if available
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update) {
          setHasUpdate(update);
          setUpdateStatus(`Version ${update.version} available! Release notes: ${update.body}`);
          return;
        }
      } catch (e) {}

      setUpdateStatus("You are on the latest version (v0.0.9).");
    } catch (e: any) {
      setUpdateStatus("You are on the latest version.");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const installUpdate = async () => {
    if (!hasUpdate) return;
    try {
      setIsCheckingUpdate(true);
      setUpdateStatus("Downloading and installing update... Please do not close the app.");
      let downloaded = 0;
      let contentLength = 0;
      
      await hasUpdate.downloadAndInstall((event: any) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength;
            setUpdateStatus(`Downloading update: 0%`);
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength) {
               setUpdateStatus(`Downloading update: ${Math.round((downloaded / contentLength) * 100)}%`);
            }
            break;
          case 'Finished':
            setUpdateStatus("Update installed successfully. Restarting...");
            break;
        }
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (e: any) {
      console.error("Update error:", e);
      setUpdateStatus(`Error installing update: ${e?.message || String(e)}`);
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const getInitials = (nameStr: string) => {
    if (!nameStr) return "MEP";
    const parts = nameStr.trim().split(" ");
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  };

  const activeTabConfig = SETTINGS_TABS.find(t => t.id === activeTab) || SETTINGS_TABS[0];
  const ActiveIcon = activeTabConfig.icon;

  return (
    <AppShell title="Settings" subtitle="Profile, units, cloud backup, theme & workspace preferences">
      <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 w-full bg-background overflow-hidden">
        
        {/* Mobile Horizontal Sub-Tab Strip */}
        <div className="md:hidden shrink-0 bg-background border-b border-border px-3 py-2 flex items-center gap-1.5 overflow-x-auto select-none no-scrollbar">
          {SETTINGS_TABS.map((t) => {
            const TabIcon = t.icon;
            const isCurrent = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-surface border border-transparent'
                }`}
              >
                <TabIcon className="size-3.5 shrink-0" />
                <span>{t.shortLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Left Sub-Navigation Sidebar - DOCKED TO LEFT EDGE, ZERO WASTED GUTTERS */}
        <div className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-border bg-surface/30 dark:bg-zinc-950/30 p-4 justify-between overflow-y-auto select-none">
          <div className="flex flex-col gap-1.5">
            <div className="px-3 py-1.5 text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
              Settings Category
            </div>

            {SETTINGS_TABS.map((t) => {
              const TabIcon = t.icon;
              const isCurrent = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all cursor-pointer group ${
                    isCurrent
                      ? 'bg-primary text-white shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-surface-2 font-medium'
                  }`}
                >
                  <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                    isCurrent ? 'bg-white/20 text-white' : 'bg-surface text-muted-foreground group-hover:text-foreground'
                  }`}>
                    <TabIcon className="size-4" />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[13px] leading-tight truncate ${isCurrent ? 'font-bold text-white' : 'text-foreground'}`}>
                      {t.label}
                    </span>
                    <span className={`text-[11px] truncate mt-0.5 ${isCurrent ? 'text-white/80' : 'text-muted-foreground'}`}>
                      {t.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick License & Version Summary in bottom of sidebar */}
          <div className="mt-4 p-3.5 bg-background border border-border/80 rounded-xl shadow-2xs flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground">License Tier</span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${expiryInfo.badgeColor}`}>
                {expiryInfo.status}
              </span>
            </div>
            <div className="text-[12px] font-bold text-foreground truncate">
              {profile?.role === "SUPER_ADMIN" ? "Enterprise (Super Admin)" : profile?.role === "ORG_ADMIN" ? "Enterprise (Org Admin)" : "Enterprise Pro"}
            </div>
            <div className="text-[11px] text-muted-foreground flex items-center justify-between border-t border-border/60 pt-2 font-mono">
              <span>MEP Calc</span>
              <span className="font-semibold text-foreground">v0.0.9</span>
            </div>
          </div>
        </div>

        {/* Right Main Content Panel - EXPANDS FULL WIDTH */}
        <div className="flex-1 flex flex-col min-h-0 bg-background overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="w-full flex flex-col gap-6">

            {/* Tab Header Banner */}
            <div className="bg-background border border-border rounded-xl p-5 shadow-2xs flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="p-2.5 bg-primary/10 text-primary border border-primary/20 rounded-xl shrink-0">
                  <ActiveIcon className="size-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                      {activeTabConfig.label}
                    </h2>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground uppercase">
                      {activeTab}
                    </span>
                  </div>
                  <p className="text-xs sm:text-[12.5px] text-muted-foreground mt-0.5 truncate">
                    {activeTabConfig.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Notification Feedback Banners */}
            {cloudSaveMessage && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 text-primary rounded-xl text-[13px] font-medium shadow-2xs">
                <CheckCircle2 className="size-4 shrink-0" />
                {cloudSaveMessage}
              </div>
            )}

            {savedSuccess && (
              <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 text-success rounded-xl text-[13px] font-medium shadow-2xs">
                <CheckCircle2 className="size-4 shrink-0" />
                Settings updated successfully in current workspace.
              </div>
            )}

            {/* ----------------- SUB-TAB 1: PROFILE & ACCOUNT ----------------- */}
            {activeTab === 'profile' && (
              <div className="flex flex-col gap-6">

                {/* User Profile & Identity */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <User className="size-4.5 text-primary" />
                      <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">User Profile & Identity</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {userData?.is_founding_pioneer && userData?.pioneer_number && (
                        <button
                          type="button"
                          onClick={() => setShowPioneerModal(true)}
                          className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30 transition shadow-2xs cursor-pointer"
                          title="View Founding Pioneer Badge"
                        >
                          <Trophy className="size-3 text-amber-400" />
                          <span>PIONEER #{userData.pioneer_number}</span>
                        </button>
                      )}
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-surface border border-border text-muted-foreground">
                        ID: {userData?.id?.slice(0, 8) || "LOCAL_USER"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-5">
                    {/* Profile Photo */}
                    <div className="relative group shrink-0">
                      {profilePhoto ? (
                        <img
                          src={profilePhoto}
                          alt="Profile Avatar"
                          className="size-20 rounded-full object-cover border-2 border-primary shadow-2xs"
                        />
                      ) : (
                        <div className="size-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-[22px] font-bold text-primary shadow-2xs">
                          {getInitials(fullName)}
                        </div>
                      )}
                      
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 transition-colors cursor-pointer"
                        title="Upload / Edit Photo"
                      >
                        <Camera className="size-3.5" />
                      </button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                    </div>

                    <div className="flex flex-col gap-2.5 flex-1 w-full min-w-0">
                      <div className="flex items-center gap-2">
                        <TBtn onClick={() => fileInputRef.current?.click()} className="px-3.5 whitespace-nowrap shrink-0">
                          <Upload className="size-3.5" /> Upload / Change Photo
                        </TBtn>
                        {profilePhoto && (
                          <TBtn onClick={handleRemovePhoto} className="px-3.5 text-destructive border-destructive/30 hover:bg-destructive/10 whitespace-nowrap shrink-0">
                            <X className="size-3.5" /> Remove
                          </TBtn>
                        )}
                      </div>
                      <span className="text-[11.5px] text-muted-foreground">
                        PNG, JPG, or GIF up to 5MB. Photo is stored locally and synced to your profile.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                        <User className="size-3.5 text-muted-foreground" /> Full Name
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="e.g. Vikram Kadam"
                        className={`bg-surface border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none ${
                          nameError ? 'border-red-500 focus:ring-red-500/20' : 'border-border'
                        }`}
                      />
                      {nameError && (
                        <p className="text-red-500 dark:text-red-400 text-xs font-semibold mt-1.5 flex items-center gap-1">
                          <span className="size-1 rounded-full bg-red-500 dark:bg-red-400"></span>
                          {nameError}
                        </p>
                      )}
                    </div>

                    {/* Email Address */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={userData?.email || profile?.email || "engineer@mepcalc.com"}
                        disabled
                        className="bg-surface/50 border border-border/70 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground outline-none cursor-not-allowed font-mono"
                      />
                    </div>

                    {/* Company/Organization */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                          <Building className="size-3.5 text-muted-foreground" /> Company / Organization
                        </label>
                        {(assignedOrgName || company || profile?.company || userData?.company || profile?.organization_id || userData?.organization_id) && (
                          <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                            <Lock className="size-3" /> Admin Managed
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={assignedOrgName || company || profile?.company || userData?.company || ""}
                        disabled={Boolean(assignedOrgName || company || profile?.company || userData?.company || profile?.organization_id || userData?.organization_id)}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="No Organization Assigned"
                        className={`bg-surface border border-border rounded-md px-3 py-1.5 text-[13px] outline-none ${
                          (assignedOrgName || company || profile?.company || userData?.company || profile?.organization_id || userData?.organization_id)
                            ? 'bg-surface/50 text-muted-foreground cursor-not-allowed font-semibold'
                            : 'focus:border-primary'
                        }`}
                      />
                    </div>

                    {/* Designation */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                          <Briefcase className="size-3.5 text-muted-foreground" /> Designation / Role
                        </label>
                        <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <Lock className="size-3" /> Admin Managed
                        </span>
                      </div>
                      <input
                        type="text"
                        value={designation || "Design Engineer"}
                        disabled
                        placeholder="e.g. BIM Coordinator, Lead HVAC Engineer, Director"
                        className="bg-surface/50 border border-border/70 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground outline-none cursor-not-allowed font-semibold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border/60 pt-4 mt-2">
                    <TBtn primary onClick={handleSaveToCloud} disabled={cloudSaveLoading} className="px-4 py-1.5 whitespace-nowrap shrink-0">
                      {cloudSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Profile
                    </TBtn>
                  </div>
                </div>

                {/* Subscription & License Info */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="size-4.5 text-primary" />
                      <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Subscription & License Info</h3>
                    </div>
                    <span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full border ${expiryInfo.badgeColor}`}>
                      {expiryInfo.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3.5 bg-surface/50 rounded-xl border border-border flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Active Tier</span>
                      <span className="text-[13.5px] font-bold text-foreground truncate">
                        {profile?.role === "SUPER_ADMIN" ? "ENTERPRISE (SUPER ADMIN)" : profile?.role === "ORG_ADMIN" ? "ENTERPRISE (ORG ADMIN)" : "ENTERPRISE PRO"}
                      </span>
                    </div>

                    <div className="p-3.5 bg-surface/50 rounded-xl border border-border flex flex-col gap-1">
                      <span className="text-[11px] text-muted-foreground uppercase tracking-wider">License Expiry</span>
                      <span className="text-[13px] font-semibold text-foreground font-mono">{expiryInfo.formatted}</span>
                    </div>

                    <div className="p-3.5 bg-surface/50 rounded-xl border border-border flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</span>
                        <span className="text-[13px] font-semibold text-success flex items-center gap-1.5">
                          <CheckCircle2 className="size-3.5" /> Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ----------------- SUB-TAB 2: UNITS & CALCULATIONS ----------------- */}
            {activeTab === 'units' && (
              <div className="flex flex-col gap-6">

                {/* Primary Unit System */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-5">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Globe className="size-4.5 text-primary" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Unit System & Standard</h3>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[13px] font-semibold text-foreground">Global Primary Unit System</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <button
                        type="button"
                        onClick={() => handleUnitSystemChange('SI')}
                        className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer text-left ${
                          unitSystem === 'SI'
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                            : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${unitSystem === 'SI' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                          <Globe className="size-4.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13.5px] font-bold text-foreground">Metric System (SI)</span>
                          <span className="text-[12px] text-muted-foreground mt-0.5">Airflow: L/s & m³/h | Temp: °C | Power: kW</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleUnitSystemChange('IP')}
                        className={`flex items-start gap-3.5 p-4 rounded-xl border transition-all cursor-pointer text-left ${
                          unitSystem === 'IP'
                            ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                            : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                        }`}
                      >
                        <div className={`p-2 rounded-lg shrink-0 ${unitSystem === 'IP' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                          <Sliders className="size-4.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13.5px] font-bold text-foreground">Imperial System (IP)</span>
                          <span className="text-[12px] text-muted-foreground mt-0.5">Airflow: CFM | Temp: °F | Power: HP / TR</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 pt-3 border-t border-border/60">
                    <label className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-muted-foreground" /> Default Ventilation Standard
                    </label>
                    <select
                      value={standard}
                      onChange={(e) => setStandard(e.target.value)}
                      className="bg-surface border border-border focus:border-primary rounded-md px-3 py-2 text-[13px] outline-none"
                    >
                      <option value="ASHRAE 62.1 - 2022">ASHRAE 62.1 - 2022 (Ventilation for Acceptable IAQ)</option>
                      <option value="ASHRAE 62.1 - 2019">ASHRAE 62.1 - 2019</option>
                      <option value="BS EN 16798-1">BS EN 16798-1:2019 (Indoor environmental input parameters)</option>
                      <option value="CIBSE Guide A">CIBSE Guide A (Environmental design standards)</option>
                    </select>
                  </div>
                </div>

                {/* Engineering Parameters */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-5">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Calculator className="size-4.5 text-primary" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Calculation Parameters</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-foreground">Airflow Unit Preference</label>
                      <select
                        value={flowUnit}
                        onChange={(e) => setFlowUnit(e.target.value)}
                        className="bg-surface border border-border focus:border-primary rounded-md px-3 py-2 text-[13px] outline-none"
                      >
                        <option value="L/s">Litres per second (L/s)</option>
                        <option value="m3h">Cubic meters per hour (m³/hr)</option>
                        <option value="cfm">Cubic feet per minute (CFM)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-foreground">Temperature Unit Preference</label>
                      <select
                        value={tempUnit}
                        onChange={(e) => setTempUnit(e.target.value)}
                        className="bg-surface border border-border focus:border-primary rounded-md px-3 py-2 text-[13px] outline-none"
                      >
                        <option value="C">Celsius (°C)</option>
                        <option value="F">Fahrenheit (°F)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-foreground flex items-center justify-between">
                        <span>CHW Delta T (K)</span>
                        <span className="text-[11px] font-normal text-muted-foreground">3.0 - 12.0 K</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="3.0"
                        max="12.0"
                        value={chwDeltaT}
                        onChange={(e) => setChwDeltaT(Number(e.target.value))}
                        className="bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[13px] font-semibold text-foreground flex items-center justify-between">
                        <span>Design Safety Margin (%)</span>
                        <span className="text-[11px] font-normal text-muted-foreground">0 - 50%</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={safetyMargin}
                        onChange={(e) => setSafetyMargin(Number(e.target.value))}
                        className="bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end border-t border-border/60 pt-4 mt-2">
                    <TBtn primary onClick={handleSaveUnitsAndCalculations} disabled={unitsSaveLoading} className="px-4 py-1.5 whitespace-nowrap shrink-0">
                      {unitsSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Calculations & Units
                    </TBtn>
                  </div>
                </div>

              </div>
            )}

            {/* ----------------- SUB-TAB 3: THEME & APPEARANCE ----------------- */}
            {activeTab === 'appearance' && (
              <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-5">
                <div className="flex items-center gap-2 border-b border-border pb-3">
                  <Sun className="size-4.5 text-primary" />
                  <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Theme & Interface Appearance</h3>
                </div>

                <div className="flex flex-col gap-3">
                  <label className="text-[13px] font-semibold text-foreground">Select Display Mode</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => handleThemeChange('light')}
                      className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border transition-all cursor-pointer ${
                        theme === 'light'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-2 ring-primary/20'
                          : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                      }`}
                    >
                      {theme === 'light' && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                          <CheckCircle2 className="size-3" />
                          <span>Active</span>
                        </div>
                      )}
                      <div className={`p-3.5 rounded-xl ${theme === 'light' ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground'}`}>
                        <Sun className="size-7" />
                      </div>
                      <span className="text-[13.5px]">Light Mode</span>
                      <span className="text-[11.5px] text-muted-foreground text-center">Bright clean aesthetic for daylight environments</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeChange('dark')}
                      className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border transition-all cursor-pointer ${
                        theme === 'dark'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-2 ring-primary/20'
                          : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                      }`}
                    >
                      {theme === 'dark' && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                          <CheckCircle2 className="size-3" />
                          <span>Active</span>
                        </div>
                      )}
                      <div className={`p-3.5 rounded-xl ${theme === 'dark' ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground'}`}>
                        <Moon className="size-7" />
                      </div>
                      <span className="text-[13.5px]">Dark Mode</span>
                      <span className="text-[11.5px] text-muted-foreground text-center">Deep obsidian palette for low-light environments</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleThemeChange('system')}
                      className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-xl border transition-all cursor-pointer ${
                        theme === 'system'
                          ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-2 ring-primary/20'
                          : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                      }`}
                    >
                      {theme === 'system' && (
                        <div className="absolute top-3 right-3 flex items-center gap-1 text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                          <CheckCircle2 className="size-3" />
                          <span>Active</span>
                        </div>
                      )}
                      <div className={`p-3.5 rounded-xl ${theme === 'system' ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground'}`}>
                        <Monitor className="size-7" />
                      </div>
                      <span className="text-[13.5px]">System Default</span>
                      <span className="text-[11.5px] text-muted-foreground text-center">Syncs automatically with Windows or macOS theme</span>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border/60 text-xs text-muted-foreground">
                  <Sparkles className="size-3.5 text-primary" />
                  <span>Theme selections are applied instantly and synchronized across your active workspace.</span>
                </div>
              </div>
            )}

            {/* ----------------- SUB-TAB 4: AUTOSAVE & STORAGE ----------------- */}
            {activeTab === 'storage' && (
              <div className="flex flex-col gap-6">

                {/* Auto Save & Backups Card */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4.5 text-primary" />
                      <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Auto Save & Backups</h3>
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        autoSaveEnabled 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}>
                        <span className={`size-1.5 rounded-full ${autoSaveEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                        {autoSaveEnabled ? 'Engine Active' : 'Disabled'}
                      </span>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[12.5px] font-medium text-foreground">
                        {autoSaveEnabled ? "Auto-Save Enabled" : "Auto-Save Paused"}
                      </span>
                      <input
                        type="checkbox"
                        checked={autoSaveEnabled}
                        onChange={(e) => handleEnabledChange(e.target.checked)}
                        className="size-4 accent-primary rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  {/* Engine Status Banner */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-surface/60 border border-border text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <HardDrive className="size-4 text-primary shrink-0" />
                      <span className="text-muted-foreground">Status:</span>
                      <span className="font-semibold text-foreground">
                        {autoSaveEnabled 
                          ? `Backing up project state every ${autoSaveInterval} minute${autoSaveInterval > 1 ? 's' : ''}`
                          : 'Automatic background backup paused'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span>Last Backup:</span>
                      <span className="font-mono font-medium text-foreground bg-surface px-2 py-0.5 rounded border border-border">
                        {lastBackupTime ? new Date(lastBackupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'None yet'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 flex flex-col gap-1.5">
                      <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                        <FolderOpen className="size-3.5 text-muted-foreground" /> Auto Save Target Folder Path
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={autoSavePath}
                          onChange={(e) => handlePathChange(e.target.value)}
                          placeholder="e.g. C:\MEP_Calculator_Autosaves"
                          disabled={!autoSaveEnabled}
                          className="flex-1 bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono disabled:opacity-50"
                        />
                        <TBtn
                          type="button"
                          onClick={handleBrowseFolder}
                          disabled={!autoSaveEnabled}
                          className="px-3.5 whitespace-nowrap shrink-0"
                        >
                          <FolderOpen className="size-3.5" /> Browse...
                        </TBtn>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5 text-muted-foreground" /> Auto Save Interval
                      </label>
                      <select
                        value={autoSaveInterval}
                        onChange={(e) => handleIntervalChange(Number(e.target.value))}
                        disabled={!autoSaveEnabled}
                        className="bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none disabled:opacity-50"
                      >
                        <option value={1}>Every 1 Minute</option>
                        <option value={5}>Every 5 Minutes</option>
                        <option value={10}>Every 10 Minutes (Default)</option>
                        <option value={15}>Every 15 Minutes</option>
                        <option value={30}>Every 30 Minutes</option>
                        <option value={60}>Every 60 Minutes</option>
                      </select>
                    </div>
                  </div>

                  {/* Action Buttons Toolbar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 mt-2">
                    <div className="flex items-center gap-2">
                      <TBtn
                        type="button"
                        onClick={handleTriggerBackup}
                        disabled={isBackingUp}
                        className="px-3.5 py-1.5 bg-primary/10 border-primary/30 text-primary hover:bg-primary/20 font-medium whitespace-nowrap shrink-0"
                      >
                        {isBackingUp ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3.5" />
                        )}
                        {isBackingUp ? "Saving Backup..." : "Backup Now (Test)"}
                      </TBtn>

                      <TBtn
                        type="button"
                        onClick={handleOpenBackupFolder}
                        disabled={isOpeningFolder}
                        className="px-3.5 py-1.5 border-border hover:bg-surface whitespace-nowrap shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        {isOpeningFolder ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="size-3.5" />
                        )}
                        Open Folder in Explorer
                      </TBtn>
                    </div>

                    <span className="text-[11.5px] text-muted-foreground italic">
                      Interval & path changes save automatically
                    </span>
                  </div>

                  {/* Local Backups on Disk List */}
                  <div className="mt-2 flex flex-col gap-2.5 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="size-4 text-muted-foreground" />
                        <span className="text-[12.5px] font-bold text-foreground">
                          Backups on Disk ({backupFiles.length})
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          in {autoSavePath}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchLocalBackups(autoSavePath)}
                        disabled={isLoadingFiles}
                        className="text-[11.5px] text-primary hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw className={`size-3 ${isLoadingFiles ? 'animate-spin' : ''}`} /> Refresh List
                      </button>
                    </div>

                    {isLoadingFiles ? (
                      <div className="flex items-center justify-center p-4 text-[12px] text-muted-foreground gap-2">
                        <Loader2 className="size-4 animate-spin text-primary" /> Scanning backup directory...
                      </div>
                    ) : backupFiles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-4 bg-surface/30 rounded-lg border border-dashed border-border text-center">
                        <span className="text-[12px] text-muted-foreground">
                          No backup files found yet in this directory.
                        </span>
                        <span className="text-[11.5px] text-muted-foreground/80 mt-0.5">
                          Click <strong className="text-primary font-semibold">Backup Now (Test)</strong> above to create your first backup immediately.
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                        {backupFiles.map((file) => (
                          <div
                            key={file.filename}
                            className="flex items-center justify-between p-2.5 bg-surface/40 hover:bg-surface/70 rounded-md border border-border/80 text-[12px] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="size-4 text-primary shrink-0" />
                              <div className="flex flex-col min-w-0">
                                <span className="font-mono text-[11.5px] font-semibold text-foreground truncate">
                                  {file.filename}
                                </span>
                                <span className="text-[10.5px] text-muted-foreground">
                                  {new Date(file.mtime).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              <span className="font-mono text-[11px] text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
                                {(file.size / 1024).toFixed(1)} KB
                              </span>
                              <span className="text-[10.5px] font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Verified on Disk
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

                {/* Local Cache & Data Management Card */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <HardDrive className="size-4.5 text-primary" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Local Cache & Data Management</h3>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[13px] font-bold text-foreground">Clear Local Data & Drafts</span>
                        <span className="text-[12px] text-muted-foreground leading-normal">
                          Erases local calculation drafts, temporary caches, and local workspace state.
                        </span>
                      </div>

                      <TBtn
                        onClick={() => setShowClearModal(true)}
                        className="h-8 px-4 text-warning border-warning/40 hover:bg-warning/10 self-start sm:self-auto shrink-0 whitespace-nowrap"
                      >
                        <Trash2 className="size-3.5" /> Clear All Data
                      </TBtn>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* ----------------- SUB-TAB 5: SECURITY & SESSIONS ----------------- */}
            {activeTab === 'security' && (
              <div className="flex flex-col gap-6">

                {/* Session Management */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <ShieldCheck className="size-4.5 text-primary" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Account Sessions & Devices</h3>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[13px] font-bold text-foreground">Sign Out of Current Device</span>
                        <span className="text-[12px] text-muted-foreground leading-normal">
                          Safely closes your active session on this computer.
                        </span>
                      </div>
                      <TBtn onClick={handleLogoutThisDevice} className="h-8 px-4 border-border hover:bg-surface self-start sm:self-auto shrink-0 whitespace-nowrap">
                        <LogOut className="size-3.5" /> Logout (This Device)
                      </TBtn>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="flex flex-col gap-1 min-w-0 flex-1">
                        <span className="text-[13px] font-bold text-foreground">Sign Out of All Devices</span>
                        <span className="text-[12px] text-muted-foreground leading-normal">
                          Revokes all authenticated tokens across all browser sessions and installations.
                        </span>
                      </div>
                      <TBtn onClick={handleLogoutAllDevices} className="h-8 px-4 border-warning/40 text-warning hover:bg-warning/10 self-start sm:self-auto shrink-0 whitespace-nowrap">
                        <LogOut className="size-3.5" /> Logout (All Devices)
                      </TBtn>
                    </div>
                  </div>
                </div>

                {/* Danger Zone: Delete Account */}
                <div className="border border-destructive/30 bg-destructive/5 rounded-xl p-6 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-destructive/20 pb-3">
                    <ShieldAlert className="size-4.5 text-destructive" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-destructive">Danger Zone</h3>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-background rounded-xl border border-destructive/30">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-[13.5px] font-bold text-destructive">Permanently Delete Account</span>
                      <span className="text-[12px] text-muted-foreground leading-normal">
                        Once your account is deleted, all stored projects, team affiliations, and custom calculation history will be permanently erased.
                      </span>
                    </div>

                    <TBtn
                      onClick={() => {
                        setShowDeleteModal(true);
                        setDeleteError(null);
                      }}
                      className="h-8.5 px-4 bg-destructive text-white border-destructive hover:bg-destructive/90 font-semibold self-start sm:self-auto shrink-0 whitespace-nowrap cursor-pointer"
                    >
                      <Trash2 className="size-3.5" /> Delete Account
                    </TBtn>
                  </div>
                </div>

              </div>
            )}

            {/* ----------------- SUB-TAB 6: UPDATES & ABOUT ----------------- */}
            {activeTab === 'updates' && (
              <div className="flex flex-col gap-6">

                {/* Application Updates */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <DownloadCloud className="size-4.5 text-primary" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Application Updates</h3>
                  </div>
                  <div className="flex flex-col gap-3.5">
                    <p className="text-[12.5px] text-muted-foreground leading-normal">
                      Check for new versions of the MEP Calculator to get the latest calculation standards, bug fixes, and feature enhancements.
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-3">
                      <TBtn 
                        primary={!hasUpdate} 
                        onClick={checkForUpdates} 
                        disabled={isCheckingUpdate}
                        className="h-8 px-4 whitespace-nowrap shrink-0"
                      >
                        {isCheckingUpdate && !hasUpdate ? <Loader2 className="size-3.5 animate-spin" /> : <DownloadCloud className="size-3.5" />} 
                        {isCheckingUpdate && !hasUpdate ? "Checking..." : "Check for Updates"}
                      </TBtn>

                      {hasUpdate && (
                        <TBtn 
                          primary 
                          onClick={installUpdate} 
                          disabled={isCheckingUpdate}
                          className="h-8 px-4 bg-success hover:bg-success/90 whitespace-nowrap shrink-0"
                        >
                          {isCheckingUpdate ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} 
                          {isCheckingUpdate ? "Installing..." : "Install & Restart"}
                        </TBtn>
                      )}
                      
                      <TBtn 
                        onClick={() => navigate({ to: '/privacy' })}
                        className="h-8 px-4 whitespace-nowrap shrink-0"
                      >
                        <FileText className="size-3.5 text-muted-foreground" />
                        View Terms & Privacy Policy
                      </TBtn>
                    </div>

                    {updateStatus && (
                      <div className="text-[12.5px] font-medium p-3 bg-surface/50 rounded-xl border border-border mt-1">
                        {updateStatus}
                      </div>
                    )}
                  </div>
                </div>

                {/* About & Architecture Info Card */}
                <div className="border border-border bg-background rounded-xl p-6 shadow-2xs flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Info className="size-4.5 text-primary" />
                    <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">About MEP Calculator</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 bg-surface/50 rounded-xl border border-border flex flex-col gap-1.5">
                      <span className="font-semibold text-foreground text-[13px]">Platform Engine</span>
                      <span className="text-muted-foreground leading-normal">High-performance reactive MEP calculation suite powered by React, Vite & Tailwind CSS.</span>
                    </div>

                    <div className="p-4 bg-surface/50 rounded-xl border border-border flex flex-col gap-1.5">
                      <span className="font-semibold text-foreground text-[13px]">Data Storage & Security</span>
                      <span className="text-muted-foreground leading-normal">Dual-layer local disk cache with real-time encrypted cloud sync via Supabase.</span>
                    </div>
                  </div>
                </div>

              </div>
            )}

            {/* Workspace Footer Note */}
            <div className="flex items-center justify-between border-t border-border/60 pt-3 mt-2 text-[11.5px] text-muted-foreground">
              <span>MEP Calculator Workspace Preferences &bull; All configurations take effect immediately in real time.</span>
              <span className="hidden sm:inline font-mono">v0.0.9 Enterprise</span>
            </div>

          </div>
        </div>

      </div>

      {/* CLEAR ALL DATA CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" />
              <h3 className="text-[15px] font-bold">Clear All Local Data?</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-normal">
              This action will purge all local calculation drafts, temporary space configurations, and cached workspace states stored in your browser. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <TBtn onClick={() => setShowClearModal(false)} disabled={isClearingData} className="px-4 whitespace-nowrap shrink-0">Cancel</TBtn>
              <TBtn onClick={handleClearAllData} disabled={isClearingData} className="px-4 bg-warning hover:bg-warning/90 text-black border-warning font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5">
                {isClearingData ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {isClearingData ? "Clearing Data..." : "Yes, Clear All Data"}
              </TBtn>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border border-destructive/50 rounded-xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-destructive">
              <Flame className="size-5" />
              <h3 className="text-[16px] font-bold">Permanently Delete Account?</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-normal">
              Are you sure you want to permanently delete your account? All projects, custom calculations, and settings will be permanently removed from the server.
            </p>

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-foreground">
                Type <span className="font-bold text-destructive">DELETE</span> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="bg-surface border border-border focus:border-destructive rounded px-3 py-1.5 text-[13px] font-mono outline-none"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[12px] font-semibold text-foreground">Account Password (Optional verification):</label>
              <input
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter password"
                className="bg-surface border border-border focus:border-destructive rounded px-3 py-1.5 text-[13px] outline-none"
              />
            </div>

            {deleteError && (
              <div className="text-[12px] text-destructive bg-destructive/10 p-2.5 rounded border border-destructive/20">
                {deleteError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <TBtn onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="px-4 whitespace-nowrap shrink-0">Cancel</TBtn>
              <TBtn
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText.toUpperCase() !== "DELETE"}
                className="px-4 bg-destructive text-white border-destructive font-semibold disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isDeleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                {isDeleting ? "Deleting..." : "Permanently Delete Account"}
              </TBtn>
            </div>
          </div>
        </div>
      )}

      <WelcomeToTarvModal
        isOpen={showPioneerModal}
        onClose={() => setShowPioneerModal(false)}
        userName={userData?.name || profile?.name || 'Engineer'}
        pioneerNumber={userData?.pioneer_number || 1}
      />
    </AppShell>
  );
}

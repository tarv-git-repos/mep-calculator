import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useAuth } from "@/contexts/AuthContext";
import { WelcomeToTarvModal } from "@/components/modals/WelcomeToTarvModal";
import { 
  Settings, 
  Save, 
  CheckCircle2, 
  RotateCcw, 
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
  Clock, 
  FolderOpen,
  X,
  AlertTriangle,
  Flame,
  Globe,
  Upload,
  Trophy,
  Lock
} from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MEP Calc" },
      { name: "description", content: "Configure calculation standards, default safety factor multipliers, profile, units, themes, and autosave settings." },
    ],
  }),
  component: SettingsPage,
});

export function SettingsPage() {
  const { userData, profile, logout, logoutAllDevices, deleteAccount, updateProfileDetails, setUserData } = useAuth();
  const isAdmin = profile?.role === 'SUPER_ADMIN' || profile?.role === 'ORG_ADMIN' || userData?.role === 'SUPER_ADMIN' || userData?.role === 'ORG_ADMIN';
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    return profile?.company || userData?.company || (uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_user_company_${uId}`) || '' : '');
  });
  const [assignedOrgName, setAssignedOrgName] = useState<string>(() => {
    if (isSuperAdminUser) return 'TARV AI System (Super Admin)';
    return '';
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
          (currentId && u.id === currentId)
        ) : null;

        const userOrgId = myRecord?.organization_id || profile?.organization_id || userData?.organization_id;
        
        // 1. Match orgId in organizations list
        if (userOrgId && Array.isArray(orgs)) {
          const match = orgs.find((o: any) => o.id === userOrgId);
          if (match && match.name) {
            setAssignedOrgName(match.name);
            setCompany(match.name);
            return;
          }
        }

        // 2. Direct organization/company field assigned by Admin
        const directOrg = myRecord?.organization || myRecord?.company || profile?.organization || profile?.company || userData?.organization || userData?.company;
        if (directOrg && directOrg.trim()) {
          setAssignedOrgName(directOrg.trim());
          setCompany(directOrg.trim());
          return;
        }

        // 3. Fallback check for local storage cached company
        if (typeof window !== 'undefined' && currentId) {
          const cachedUserCompany = localStorage.getItem(`mep_user_company_${currentId}`);
          if (cachedUserCompany && cachedUserCompany.trim()) {
            setAssignedOrgName(cachedUserCompany.trim());
            setCompany(cachedUserCompany.trim());
            return;
          }
        }
      } catch (e) {}
    }
    resolveUserOrg();
  }, [userData?.email, profile?.email, profile?.organization_id, userData?.organization_id, profile?.id, userData?.id, profile?.company, userData?.company]);

  // Requirement 8: Designation / Role
  const [designation, setDesignation] = useState<string>(() => {
    if (isSuperAdminUser) return 'Super Admin';
    return profile?.role || profile?.designation || userData?.role || userData?.designation || (uId && typeof window !== 'undefined' ? localStorage.getItem(`mep_user_designation_${uId}`) || 'Design Engineer' : 'Design Engineer');
  });

  useEffect(() => {
    async function resolveUserRole() {
      const currentEmail = userData?.email || profile?.email;
      if (currentEmail === 'admin@tarv.ai' || profile?.role === 'SUPER_ADMIN' || userData?.role === 'SUPER_ADMIN') {
        setDesignation('Super Admin');
        return;
      }
      try {
        const allUsers = await api.getUsers();
        const myRecord = Array.isArray(allUsers) ? allUsers.find((u: any) => u.email?.toLowerCase() === currentEmail?.toLowerCase()) : null;
        if (myRecord?.role) {
          setDesignation(myRecord.role);
        }
      } catch (e) {}
    }
    resolveUserRole();
  }, [userData?.email, profile?.email, profile?.role, userData?.role]);

  // Requirement 12: Auto save
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mep_auto_save_enabled') !== 'false';
    }
    return true;
  });

  // Requirement 13: Path to make the autosave
  const [autoSavePath, setAutoSavePath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('localBackupPath') || 'C:\\MEP_Calculator_Autosaves';
    }
    return 'C:\\MEP_Calculator_Autosaves';
  });

  // Requirement 14: Interval for auto save (in minutes)
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_auto_save_interval');
      return saved ? parseInt(saved, 10) : 10;
    }
    return 10;
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

  // Sync profile fields if updated from AuthContext
  useEffect(() => {
    if (profile || userData) {
      if (profile?.name || userData?.name) setFullName(profile?.name || userData?.name || '');
      if (profile?.company || userData?.company) setCompany(profile?.company || userData?.company || '');
      const activeRole = profile?.role || profile?.designation || userData?.role || userData?.designation;
      if (activeRole) setDesignation(activeRole);
      if (profile?.profile_photo || userData?.profile_photo) setProfilePhoto(profile?.profile_photo || userData?.profile_photo || '');
    }
  }, [profile, userData]);

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_theme', newTheme);
      window.dispatchEvent(new Event('mep-theme-change'));
    }
  };

  // Handle Unit System Change
  const handleUnitSystemChange = (system: 'IP' | 'SI') => {
    setUnitSystem(system);
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_unit_system', system);
    }
    if (system === 'IP') {
      setFlowUnit('cfm');
      setTempUnit('F');
    } else {
      setFlowUnit('L/s');
      setTempUnit('C');
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
          }
          if (userData) {
            setUserData({ ...userData, profile_photo: compressedDataUrl });
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
    }
    if (userData) {
      setUserData({ ...userData, profile_photo: '' });
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
      }
    } catch (err) {
      console.warn('Folder selection prompt fallback', err);
    }
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

    if (typeof window !== 'undefined') {
      if (uId) {
        localStorage.setItem(`mep_profile_photo_${uId}`, profilePhoto);
        localStorage.setItem(`mep_user_name_${uId}`, fullName);
        localStorage.setItem(`mep_user_company_${uId}`, company);
        localStorage.setItem(`mep_user_designation_${uId}`, designation);
      }
      localStorage.setItem('mep_unit_system', unitSystem);
      localStorage.setItem('mep_auto_save_enabled', String(autoSaveEnabled));
      localStorage.setItem('localBackupPath', autoSavePath);
      localStorage.setItem('mep_auto_save_interval', String(autoSaveInterval));
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
        autosave_interval: autoSaveInterval,
        ventilation_standard: standard,
        flow_unit: flowUnit,
        temp_unit: tempUnit,
        chw_delta_t: chwDeltaT,
        safety_margin: safetyMargin,
      },
    });
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

  // Requirement 3: Clear All Data
  const handleClearAllData = () => {
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('mep-') || key.startsWith('mep_') || key.startsWith('pcl_') || key.includes('project') || key.includes('calculator'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    }
    setShowClearModal(false);
    setCloudSaveMessage("All local workspace cache & draft calculations cleared!");
    setTimeout(() => setCloudSaveMessage(null), 3500);
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
      const { check } = await import('@tauri-apps/plugin-updater');
      const update = await check();
      if (update) {
        setHasUpdate(update);
        setUpdateStatus(`Version ${update.version} available! Release notes: ${update.body}`);
      } else {
        setUpdateStatus("You are on the latest version.");
      }
    } catch (e: any) {
      console.error("Update error:", e);
      setUpdateStatus(`Error checking for updates: ${e.message || String(e)}`);
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

  return (
    <AppShell title="Settings" subtitle="Profile, units, cloud backup, theme & workspace preferences">
      <div className="p-6 overflow-y-auto h-full bg-surface/30">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">

          {/* Feedback Banners */}
          {cloudSaveMessage && (
            <div className="flex items-center gap-2 p-3 bg-primary/10 border border-primary/20 text-primary rounded-md text-[13px] font-medium shadow-xs">
              <CheckCircle2 className="size-4 shrink-0" />
              {cloudSaveMessage}
            </div>
          )}

          {savedSuccess && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 text-success rounded-md text-[13px] font-medium shadow-xs">
              <CheckCircle2 className="size-4 shrink-0" />
              Settings updated successfully in current workspace.
            </div>
          )}

          {/* 1. USER PROFILE SECTION (Requirements 5, 6, 7, 8) */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <User className="size-4.5 text-primary" />
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">User Profile & Identity</h3>
              </div>
              <div className="flex items-center gap-2">
                {userData?.is_founding_pioneer && userData?.pioneer_number && (
                  <button
                    type="button"
                    onClick={() => setShowPioneerModal(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-yellow-500/20 text-amber-500 dark:text-amber-300 border border-amber-500/40 hover:from-amber-500/30 hover:to-orange-500/30 transition shadow-sm cursor-pointer"
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
                    className="size-20 rounded-full object-cover border-2 border-primary shadow-xs"
                  />
                ) : (
                  <div className="size-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-[22px] font-bold text-primary shadow-xs">
                    {getInitials(fullName)}
                  </div>
                )}
                
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 p-1.5 bg-primary text-white rounded-full shadow-md hover:bg-primary/90 transition-colors"
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

              <div className="flex flex-col gap-2.5 flex-1 w-full">
                <div className="flex items-center gap-2">
                  <TBtn onClick={() => fileInputRef.current?.click()} className="px-3">
                    <Upload className="size-3.5" /> Upload / Change Photo
                  </TBtn>
                  {profilePhoto && (
                    <TBtn onClick={handleRemovePhoto} className="px-3 text-destructive border-destructive/30 hover:bg-destructive/10">
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
              {/* Requirement 6: Full Name */}
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

              {/* Email Address (Read-only) */}
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

              {/* Requirement 7: Company/Organization Name */}
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
                  value={assignedOrgName || company || profile?.company || userData?.company || ((profile?.organization_id || userData?.organization_id) ? "Consitent" : "")}
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

              {/* Requirement 8: Designation */}
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
                  value={
                    designation === 'SUPER_ADMIN' ? 'Super Admin' :
                    designation === 'ORG_ADMIN' ? 'Organization Admin' :
                    designation
                  }
                  disabled
                  className="bg-surface/50 border border-border/70 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground outline-none cursor-not-allowed font-semibold"
                />
                <p className="text-[11px] text-muted-foreground italic">
                  Your role is managed in the Admin Control Panel and cannot be self-edited.
                </p>
              </div>
            </div>

            <div className="flex justify-end border-t border-border/60 pt-4 mt-2">
              <TBtn primary onClick={handleSaveToCloud} disabled={cloudSaveLoading} className="px-4 py-1.5">
                {cloudSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Profile
              </TBtn>
            </div>
          </div>

          {/* 2. SUBSCRIPTION & LICENSE EXPIRY (Requirement 11) */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="size-4.5 text-primary" />
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Subscription & License Expiry</h3>
              </div>
              <span className={`text-[11.5px] font-semibold px-2.5 py-0.5 rounded-full border ${expiryInfo.badgeColor}`}>
                {expiryInfo.status}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface/50 p-4 rounded-md border border-border">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Current Tier</span>
                <span className="text-[14px] font-bold text-foreground">
                  {profile?.role === "SUPER_ADMIN" ? "ENTERPRISE (SUPER ADMIN)" : profile?.role === "ORG_ADMIN" ? "ENTERPRISE (ORG ADMIN)" : "ENTERPRISE PRO"}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">License Expiry Date</span>
                <span className="text-[13px] font-semibold text-foreground font-mono">{expiryInfo.formatted}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Verification Status</span>
                <span className="text-[13px] font-medium text-success flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" /> Account Verified
                </span>
              </div>
            </div>
          </div>

          {/* 3. APPEARANCE & THEME (Requirement 1) */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Sun className="size-4.5 text-primary" />
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Theme & Interface Appearance</h3>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-foreground">Select Display Mode</label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleThemeChange('light')}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-lg border transition-all cursor-pointer ${
                    theme === 'light'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                  }`}
                >
                  <Sun className="size-5" />
                  <span className="text-[12.5px]">Light Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('dark')}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-lg border transition-all cursor-pointer ${
                    theme === 'dark'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                  }`}
                >
                  <Moon className="size-5" />
                  <span className="text-[12.5px]">Dark Mode</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`flex flex-col items-center justify-center gap-2 p-3.5 rounded-lg border transition-all cursor-pointer ${
                    theme === 'system'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                  }`}
                >
                  <Monitor className="size-5" />
                  <span className="text-[12.5px]">System Default</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end border-t border-border/60 pt-4 mt-2">
              <TBtn primary onClick={handleSaveToCloud} disabled={cloudSaveLoading} className="px-4 py-1.5">
                {cloudSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Appearance
              </TBtn>
            </div>
          </div>

          {/* 4. DEFAULT UNITS & CALCULATION ENGINE (Requirement 4) */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-5">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Globe className="size-4.5 text-primary" />
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Default Unit System & Calculations</h3>
            </div>

            {/* Requirement 4: Default Units IP/SI */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-foreground">Global Primary Unit System</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleUnitSystemChange('SI')}
                  className={`flex items-center justify-center gap-2.5 p-3 rounded-lg border transition-all cursor-pointer ${
                    unitSystem === 'SI'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                  }`}
                >
                  <span className="text-[13px]">Metric System (SI) — L/s, m³, °C, kW</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUnitSystemChange('IP')}
                  className={`flex items-center justify-center gap-2.5 p-3 rounded-lg border transition-all cursor-pointer ${
                    unitSystem === 'IP'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-surface text-muted-foreground hover:bg-surface-2'
                  }`}
                >
                  <span className="text-[13px]">Imperial System (IP) — CFM, ft³, °F, HP</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
              <label className="text-[13px] font-semibold text-foreground">Default Ventilation Standard</label>
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
                <label className="text-[13px] font-semibold text-foreground">CHW Delta T (K)</label>
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
                <label className="text-[13px] font-semibold text-foreground">Design Safety Margin (%)</label>
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
              <TBtn primary onClick={handleSaveToCloud} disabled={cloudSaveLoading} className="px-4 py-1.5">
                {cloudSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Calculations & Units
              </TBtn>
            </div>
          </div>

          {/* 5. AUTO SAVE & BACKUP CONFIGURATION (Requirements 12, 13, 14) */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Clock className="size-4.5 text-primary" />
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Auto Save & Workspace Backups</h3>
              </div>

              {/* Requirement 12: Auto Save Toggle */}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-[12.5px] font-medium text-foreground">
                  {autoSaveEnabled ? "Auto Save Active" : "Auto Save Disabled"}
                </span>
                <input
                  type="checkbox"
                  checked={autoSaveEnabled}
                  onChange={(e) => setAutoSaveEnabled(e.target.checked)}
                  className="size-4 accent-primary rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Requirement 13: Path to make the autosave */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <FolderOpen className="size-3.5 text-muted-foreground" /> Auto Save Target Folder Path
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={autoSavePath}
                    onChange={(e) => setAutoSavePath(e.target.value)}
                    placeholder="e.g. C:\MEP_Backups"
                    disabled={!autoSaveEnabled}
                    className="flex-1 bg-surface border border-border focus:border-primary rounded-md px-3 py-1.5 text-[13px] outline-none font-mono disabled:opacity-50"
                  />
                  <TBtn
                    type="button"
                    onClick={handleBrowseFolder}
                    disabled={!autoSaveEnabled}
                    className="px-3"
                  >
                    <FolderOpen className="size-3.5" /> Browse...
                  </TBtn>
                </div>
              </div>

              {/* Requirement 14: Interval for auto save */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[12.5px] font-semibold text-foreground flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground" /> Auto Save Interval
                </label>
                <select
                  value={autoSaveInterval}
                  onChange={(e) => setAutoSaveInterval(Number(e.target.value))}
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

            <div className="flex justify-end border-t border-border/60 pt-4 mt-2">
              <TBtn primary onClick={handleSaveToCloud} disabled={cloudSaveLoading} className="px-4 py-1.5">
                {cloudSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Backup Settings
              </TBtn>
            </div>
          </div>

          {/* 6. CLOUD SYNC & DATA MANAGEMENT (Requirements 2, 3) */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <CloudUpload className="size-4.5 text-primary" />
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Cloud Sync & Cache Management</h3>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-col gap-1 max-w-md">
                <span className="text-[13px] font-semibold text-foreground">Save & Sync to Cloud</span>
                <span className="text-[11.5px] text-muted-foreground">
                  Pushes your profile details, unit choices, and workspace settings to your online account.
                </span>
              </div>

              {/* Requirement 2: Save to Cloud */}
              <TBtn
                primary
                onClick={handleSaveToCloud}
                disabled={cloudSaveLoading}
                className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-white font-medium"
              >
                {cloudSaveLoading ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
                {cloudSaveLoading ? "Syncing..." : "Save to Cloud"}
              </TBtn>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-border/60">
              <div className="flex flex-col gap-1 max-w-md">
                <span className="text-[13px] font-semibold text-foreground">Clear All Local Data & Drafts</span>
                <span className="text-[11.5px] text-muted-foreground">
                  Erases local calculation drafts, temporary caches, and local workspace state.
                </span>
              </div>

              {/* Requirement 3: Clear all data */}
              <TBtn
                onClick={() => setShowClearModal(true)}
                className="px-4 text-warning border-warning/40 hover:bg-warning/10"
              >
                <Trash2 className="size-3.5" /> Clear All Data
              </TBtn>
            </div>
          </div>

          {/* APPLICATION UPDATES */}
          <div className="border border-border bg-background rounded-lg p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <DownloadCloud className="size-4.5 text-primary" />
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Application Updates</h3>
            </div>
            <div className="flex flex-col gap-3">
              <p className="text-[12.5px] text-muted-foreground">
                Check for new versions of the MEP Calculator to get the latest features and calculation updates.
              </p>
              
              <div className="flex items-center gap-4">
                <TBtn 
                  primary={!hasUpdate} 
                  onClick={checkForUpdates} 
                  disabled={isCheckingUpdate}
                  className="px-4"
                >
                  {isCheckingUpdate && !hasUpdate ? <Loader2 className="size-3.5 animate-spin" /> : <DownloadCloud className="size-3.5" />} 
                  {isCheckingUpdate && !hasUpdate ? "Checking..." : "Check for Updates"}
                </TBtn>

                {hasUpdate && (
                  <TBtn 
                    primary 
                    onClick={installUpdate} 
                    disabled={isCheckingUpdate}
                    className="px-4 bg-success hover:bg-success/90"
                  >
                    {isCheckingUpdate ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} 
                    {isCheckingUpdate ? "Installing..." : "Install & Restart"}
                  </TBtn>
                )}
                <TBtn 
                  onClick={() => navigate({ to: '/privacy' })}
                  className="px-4"
                >
                  <FileText className="size-3.5 text-muted-foreground" />
                  View Terms & Privacy Policy
                </TBtn>
              </div>

              {updateStatus && (
                <div className="text-[12.5px] font-medium p-3 bg-surface/50 rounded border border-border">
                  {updateStatus}
                </div>
              )}
            </div>
          </div>

          {/* 7. ACCOUNT MANAGEMENT & DANGER ZONE (Requirements 9, 10) */}
          <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-destructive/20 pb-3">
              <ShieldAlert className="size-4.5 text-destructive" />
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-destructive">Account Sessions & Security</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Requirement 10: Log Out Options */}
              <div className="flex flex-col gap-2 p-4 bg-background rounded-md border border-border">
                <span className="text-[13px] font-bold text-foreground">Log Out Sessions</span>
                <span className="text-[11.5px] text-muted-foreground">Sign out from this device or revoke all active device sessions.</span>
                <div className="flex flex-wrap gap-2 mt-2">
                  <TBtn onClick={handleLogoutThisDevice} className="px-3 border-border hover:bg-surface">
                    <LogOut className="size-3.5" /> Logout (This Device)
                  </TBtn>
                  <TBtn onClick={handleLogoutAllDevices} className="px-3 border-warning/40 text-warning hover:bg-warning/10">
                    <LogOut className="size-3.5" /> Logout (All Devices)
                  </TBtn>
                </div>
              </div>

              {/* Requirement 9: Delete Account */}
              <div className="flex flex-col gap-2 p-4 bg-background rounded-md border border-destructive/30">
                <span className="text-[13px] font-bold text-destructive">Delete Account</span>
                <span className="text-[11.5px] text-muted-foreground">Permanently delete your profile and cloud workspace data.</span>
                <div className="mt-2">
                  <TBtn
                    onClick={() => {
                      setShowDeleteModal(true);
                      setDeleteError(null);
                    }}
                    className="px-3 bg-destructive text-white border-destructive hover:bg-destructive/90"
                  >
                    <Trash2 className="size-3.5" /> Delete Account
                  </TBtn>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex gap-3 justify-end border-t border-border pt-4 mt-2">
            <TBtn onClick={handleSaveLocal} className="px-4">
              <RotateCcw className="size-3.5" /> Save Locally
            </TBtn>
            <TBtn primary onClick={handleSaveToCloud} disabled={cloudSaveLoading} className="px-5 py-1.5">
              {cloudSaveLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save Settings
            </TBtn>
          </div>

        </div>

      {/* CLEAR ALL DATA CONFIRMATION MODAL */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg max-w-md w-full p-6 shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="size-5" />
              <h3 className="text-[15px] font-bold">Clear All Local Data?</h3>
            </div>
            <p className="text-[13px] text-muted-foreground leading-normal">
              This action will purge all local calculation drafts, temporary space configurations, and cached workspace states stored in your browser. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <TBtn onClick={() => setShowClearModal(false)} className="px-4">Cancel</TBtn>
              <TBtn onClick={handleClearAllData} className="px-4 bg-warning text-black border-warning font-semibold">
                Yes, Clear All Data
              </TBtn>
            </div>
          </div>
        </div>
      )}

      {/* DELETE ACCOUNT CONFIRMATION MODAL */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-background border border-destructive/50 rounded-lg max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
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
              <TBtn onClick={() => setShowDeleteModal(false)} disabled={isDeleting} className="px-4">Cancel</TBtn>
              <TBtn
                onClick={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmText.toUpperCase() !== "DELETE"}
                className="px-4 bg-destructive text-white border-destructive font-semibold disabled:opacity-50"
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
      </div>
    </AppShell>
  );
}

import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, ShieldAlert, Trash2, Settings, DownloadCloud, Users, HardDrive, Settings as SettingsIcon, LogOut, FolderOpen, Save, CheckCircle2, ArrowLeft, Activity, Megaphone, Key, Copy, Building, Crown, UserCheck, History, UserPlus, CheckSquare, Square, Check, Edit3 } from "lucide-react"
import { NAV } from "@/config/navigation"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { api } from '@/services/api'
import { useConfirm } from '@/hooks/use-confirm'

import { createClient } from '@supabase/supabase-js'
import { DEFAULT_UNLOCKED_FEATURES, isFeatureLocked } from '@/utils/featureFlags'

// Create a secondary client specifically for admin user creation without overwriting the current session
const adminAuthClient = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      storageKey: 'admin-auth-temp-key'
    }
  }
)



type Profile = {
  id: string
  email: string
  role: string
  subscription_status: string
  subscription_expires: string
  features?: any
  organization_id?: string
}

type ActivityLog = {
  id: string
  user_id: string
  action_type: string
  details: any
  created_at: string
  profiles?: {
    email: string
  }
}

type Announcement = {
  id: string
  message: string
  type: 'info' | 'warning' | 'success' | 'error'
  is_active: boolean
  created_at: string
}

export function SuperAdminDashboard() {
  const { session, profile, userData, user } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()
  
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)
  const [activeTab, setActiveTab] = useState<'users' | 'organizations' | 'projects' | 'storage' | 'settings' | 'activity' | 'broadcasts' | 'licenses'>('users')
  
  // Projects Explorer State for Super Admin
  const [allProjectsList, setAllProjectsList] = useState<any[]>([])
  const [loadingProjects, setLoadingProjects] = useState<boolean>(false)
  const [selectedOrgForProjects, setSelectedOrgForProjects] = useState<string>('ALL')
  const [projectSearchQuery, setProjectSearchQuery] = useState<string>('')
  const [inspectingProject, setInspectingProject] = useState<any | null>(null)
  
  // License management state
  const [licensesList, setLicensesList] = useState<any[]>([])
  const [trialsList, setTrialsList] = useState<any[]>([])
  const [loadingLicenses, setLoadingLicenses] = useState(false)
  const [genTier, setGenTier] = useState<'PRO' | 'ENTERPRISE'>('PRO')
  const [genDays, setGenDays] = useState<number>(365)
  const [genTargetEmail, setGenTargetEmail] = useState<string>('')
  const [generatedAdminKey, setGeneratedAdminKey] = useState<string>('')
  
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loadingProfiles, setLoadingProfiles] = useState(false)
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('ALL')

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('ALL')
  const [logSearchQuery, setLogSearchQuery] = useState<string>('')
  const [logOrgFilter, setLogOrgFilter] = useState<string>('ALL')

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState('')
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'error'>('info')

  // State for Add User modal
  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [isAddingUser, setIsAddingUser] = useState(false)

  // State for Permissions editing
  const [editingPermissionsFor, setEditingPermissionsFor] = useState<Profile | null>(null)

  // State for Expiry editing
  const [editingExpiryFor, setEditingExpiryFor] = useState<string | null>(null)
  const [newExpiryDate, setNewExpiryDate] = useState<string>('')
  
  const [localBackupPath, setLocalBackupPath] = useState(localStorage.getItem('localBackupPath') || '')
  const [serverBackupPath, setServerBackupPath] = useState(localStorage.getItem('serverBackupPath') || '')
  const [versionsPath, setVersionsPath] = useState(localStorage.getItem('versionsPath') || '')

  const [organizations, setOrganizations] = useState<any[]>([])
  const [loadingOrganizations, setLoadingOrganizations] = useState(false)
  const [showAddOrg, setShowAddOrg] = useState(false)
  const [isAddingOrg, setIsAddingOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  const [newOrgPlan, setNewOrgPlan] = useState('PRO')
  const [newOrgUsers, setNewOrgUsers] = useState(5)
  const [selectedOrgForManagement, setSelectedOrgForManagement] = useState<any | null>(null)
  const [selectedExistingUserToAdd, setSelectedExistingUserToAdd] = useState<string>('')
  const [selectedUserIds, setSelectedUserIdsState] = useState<string[]>([])
  const [historyStack, setHistoryStack] = useState<string[][]>([[]])
  const [historyIndex, setHistoryIndex] = useState<number>(0)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null)

  const updateSelection = (newSelection: string[]) => {
    setSelectedUserIdsState(newSelection);
    setHistoryStack(prev => [...prev.slice(0, historyIndex + 1), newSelection]);
    setHistoryIndex(prev => prev + 1);
  };

  const setSelectedUserIds = (action: string[] | ((prev: string[]) => string[])) => {
    const nextVal = typeof action === 'function' ? action(selectedUserIds) : action;
    updateSelection(nextVal);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setSelectedUserIdsState(historyStack[prevIdx]);
      toast.info("Undo selection (Ctrl+Z)", { duration: 1200 });
    }
  };

  const handleRedo = () => {
    if (historyIndex < historyStack.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setSelectedUserIdsState(historyStack[nextIdx]);
      toast.info("Redo selection (Ctrl+Y)", { duration: 1200 });
    }
  };

  const [bulkTargetOrgId, setBulkTargetOrgId] = useState<string>('')
  const [userSearchQuery, setUserSearchQuery] = useState<string>('')

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === 'Escape') {
        if (selectedUserIds.length > 0) {
          updateSelection([]);
          toast.info("Deselected all users (Esc)", { duration: 1200 });
        }
        return;
      }

      if (cmdOrCtrl && !isTyping) {
        const key = e.key.toLowerCase();
        if (key === 'a') {
          e.preventDefault();
          const visibleIds = profiles.filter(p => {
            if (selectedOrgFilter === 'ALL') return true;
            if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
            return p.organization_id === selectedOrgFilter;
          }).map(p => p.id);
          updateSelection(visibleIds);
          toast.info(`Selected all ${visibleIds.length} users (Ctrl+A)`, { duration: 1200 });
        } else if (key === 'z') {
          if (e.shiftKey) {
            e.preventDefault();
            handleRedo();
          } else {
            e.preventDefault();
            handleUndo();
          }
        } else if (key === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [profiles, selectedOrgFilter, historyIndex, historyStack, selectedUserIds]);

  const [editingSeatsForOrg, setEditingSeatsForOrg] = useState<boolean>(false)
  const [newSeatsValue, setNewSeatsValue] = useState<number>(5)
  const [showAddUserModalForOrg, setShowAddUserModalForOrg] = useState<boolean>(false)

  const handleUpdateMaxSeats = async (orgId: string, newMax: number) => {
    const currentMemberCount = profiles.filter(p => p.organization_id === orgId).length;
    if (isNaN(newMax) || newMax < 1) {
      toast.error("Seats limit must be at least 1");
      return;
    }
    if (newMax < currentMemberCount) {
      toast.error(`Cannot set seat limit to ${newMax}. The organization currently has ${currentMemberCount} active members. Set limit to at least ${currentMemberCount}.`);
      return;
    }
    try {
      await api.updateOrganization({ orgId, max_users: newMax, max_concurrent_users: newMax });
      setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, max_users: newMax, max_concurrent_users: newMax } : o));
      if (selectedOrgForManagement && selectedOrgForManagement.id === orgId) {
        setSelectedOrgForManagement((prev: any) => prev ? { ...prev, max_users: newMax, max_concurrent_users: newMax } : null);
      }
      setEditingSeatsForOrg(false);
      toast.success(`Member seats updated to ${newMax} for organization!`);
    } catch (err) {
      console.error("Failed to update seat limit", err);
      toast.error("Failed to update seat limit.");
    }
  };

  const [editingLicenseKey, setEditingLicenseKey] = useState<boolean>(false)
  const [newLicenseKeyVal, setNewLicenseKeyVal] = useState<string>('')
  const [editingConcurrentLimit, setEditingConcurrentLimit] = useState<boolean>(false)
  const [newConcurrentVal, setNewConcurrentVal] = useState<number>(1)

  const handleUpdateOrgLicense = async (orgId: string, licenseKey: string, maxConcurrent: number) => {
    try {
      const res = await api.updateOrganization({
        orgId,
        license_key: licenseKey,
        max_concurrent_users: maxConcurrent
      });
      if (res && res.success) {
        setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, license_key: licenseKey, max_concurrent_users: maxConcurrent } : o));
        if (selectedOrgForManagement && selectedOrgForManagement.id === orgId) {
          setSelectedOrgForManagement((prev: any) => prev ? { ...prev, license_key: licenseKey, max_concurrent_users: maxConcurrent } : null);
        }
        setEditingLicenseKey(false);
        setEditingConcurrentLimit(false);
        toast.success(`License key & concurrent user limit updated for organization!`);
      } else {
        toast.error((res && res.message) || "Failed to update organization license.");
      }
    } catch (err) {
      console.error("Failed to update org license", err);
      toast.error("Failed to update organization license.");
    }
  };

  const handleBulkAssignToOrg = async (targetOrgId: string, targetOrgName: string) => {
    if (selectedUserIds.length === 0) {
      toast.error("Please select at least one user first.");
      return;
    }
    if (!targetOrgId) {
      toast.error("Please select an organization.");
      return;
    }

    const targetOrg = organizations.find((o: any) => o.id === targetOrgId);
    const maxUsers = targetOrg?.max_users || 5;
    const currentMemberCount = profiles.filter(p => p.organization_id === targetOrgId).length;
    const usersToAssignNotInOrg = selectedUserIds.filter(id => {
      const p = profiles.find(pr => pr.id === id);
      return p?.organization_id !== targetOrgId;
    });

    if (currentMemberCount + usersToAssignNotInOrg.length > maxUsers) {
      toast.error(`Seat limit reached for "${targetOrgName}" (${currentMemberCount}/${maxUsers} Seats Used)! Adding ${usersToAssignNotInOrg.length} more user(s) exceeds the ${maxUsers} seat limit. Please click "Edit Seats" to increase the seat limit first.`);
      return;
    }

    const count = selectedUserIds.length;
    const userIdsToAssign = [...selectedUserIds];

    // 1. INSTANT STATE UPDATE (0ms delay)
    setProfiles(prev => prev.map(p => userIdsToAssign.includes(p.id) ? { ...p, organization_id: targetOrgId, company: targetOrgName } : p));
    if (typeof window !== 'undefined') {
      userIdsToAssign.forEach(id => localStorage.setItem(`mep_user_company_${id}`, targetOrgName));
    }
    setSelectedUserIds([]);
    toast.success(`Successfully assigned ${count} user(s) to ${targetOrgName}!`);

    // 2. Parallel background updates
    await Promise.all(userIdsToAssign.map(id => api.adminUpdateProfile(id, { 
      organization_id: targetOrgId,
      company: targetOrgName,
      organization: targetOrgName 
    })));
    fetchOrganizations();
  };

  const deleteOrganization = async (orgId: string, name: string) => {
    const choice = await confirm(`Are you sure you want to delete organization "${name}"?\n\nThis will unassign all members from this organization.`, { title: "Delete Organization", confirmText: "Delete", cancelText: "Cancel" });
    if (!choice) return;

    const res = await api.deleteOrganization(orgId);
    if (!res.success) {
      toast.error(res.message || "Failed to delete organization");
    } else {
      toast.success("Organization deleted successfully");
      if (selectedOrgForManagement?.id === orgId) setSelectedOrgForManagement(null);
      const updatedProfiles = profiles.map(p => p.organization_id === orgId ? { ...p, organization_id: '', company: '', organization: '' } : p);
      setProfiles(updatedProfiles);
      try {
        localStorage.setItem('mep_local_users', JSON.stringify(updatedProfiles));
        localStorage.setItem('cachedAllUsers', JSON.stringify(updatedProfiles));
      } catch (e) {}
      fetchOrganizations();
      fetchProfiles();
    }
  };

  const fetchOrganizations = async () => {
    setLoadingOrganizations(true);
    try {
      const res = await api.getOrganizations();
      setOrganizations(Array.isArray(res) ? res : []);
    } catch (e) {
      setOrganizations([]);
    } finally {
      setLoadingOrganizations(false);
    }
  };

  const generate20CharKey = (orgName: string) => {
    const clean = (orgName || 'ORG').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase().padEnd(4, 'X');
    const rand = (len: number) => Array.from({ length: len }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]).join('');
    return `MEP-${clean}-${rand(4)}-${rand(4)}-${rand(4)}`;
  };

  const handleAddOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgName.trim()) return toast.error("Organization name is required");
    setIsAddingOrg(true);
    try {
      const autoKey = generate20CharKey(newOrgName.trim());
      const res = await api.createOrganization({ name: newOrgName.trim(), subscription_plan: newOrgPlan, max_users: newOrgUsers, license_key: autoKey });
      if (res && res.success) {
        toast.success(`Organization created with License Key: ${autoKey}`);
        setShowAddOrg(false);
        setNewOrgName('');
        await fetchOrganizations();
      } else {
        toast.error((res && res.message) || "Failed to create organization");
      }
    } catch (err: any) {
      toast.error("Error creating organization: " + (err?.message || String(err)));
    } finally {
      setIsAddingOrg(false);
    }
  };

  useEffect(() => {
    if (!session) {
      navigate({ to: '/login' })
      return
    }

    const checkAdminStatus = async () => {
      // Allow any user with role SUPER_ADMIN or email admin@tarv.ai
      if (profile?.role === 'SUPER_ADMIN' || session?.user?.email === 'admin@tarv.ai') {
        setIsAdmin(true)
        fetchProfiles()
        fetchOrganizations()
      } else {
        setIsAdmin(false)
      }
      setChecking(false)
    }

    checkAdminStatus()
  }, [session, profile, navigate])

  const [debugInfo, setDebugInfo] = useState<any>(null)
  
  useEffect(() => {
    if (!isAdmin && session) {
      // Fetch debug info
      api.getUsers().then(users => {
        const userList = Array.isArray(users) ? users : [];
        const myUser = userList.find((u: any) => u.id === session.user.id)
        setDebugInfo({ data: myUser, error: null, userId: session.user.id })
      })
    }
  }, [isAdmin, session])

  const fetchProfiles = async () => {
    setLoadingProfiles(true)
    const users = await api.getUsers()
    const userList = Array.isArray(users) ? users : [];
    
    // Map custom_users to the expected profiles shape
    const mappedProfiles = userList.map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.role || 'USER',
      name: u.name,
      subscription_expires: u.subscription_expires || null,
      status: u.isAccountVerified ? 'ACTIVE' : 'TRIAL',
      features: u.features || {},
      organization_id: u.organization_id
    }))
    
    setProfiles(mappedProfiles)
    setLoadingProfiles(false)
  }

  const fetchActivityLogs = async () => {
    const logs = await api.getAdminActivityLogs()
    
    const mappedLogs = (logs || [])
      .map((log: any) => ({
        ...log,
        profiles: { email: log.email }
      }))
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    
    setActivityLogs(mappedLogs)
    setLoadingLogs(false)
  }

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    const data = await api.getAnnouncements()
    if (data) setAnnouncements(data)
    setLoadingAnnouncements(false)
  }

  const fetchAdminLicenses = async () => {
    setLoadingLicenses(true)
    const res = await authService.adminListLicenses()
    if (res && res.success) {
      setLicensesList(res.licenses || [])
      setTrialsList(res.trials || [])
    }
    setLoadingLicenses(false)
  }

  const fetchOrgBackupSettings = async (orgId?: string) => {
    const targetId = orgId || (selectedOrgFilter !== 'ALL' && selectedOrgFilter !== 'UNASSIGNED' ? selectedOrgFilter : '');
    const res = await api.getOrgBackupSettings(targetId);
    if (res && res.success) {
      setLocalBackupPath(res.local_backup_path || '');
      setServerBackupPath(res.server_backup_path || '');
      setVersionsPath(res.versions_path || '');
    }
  };

  const fetchAllProjects = async () => {
    setLoadingProjects(true);
    try {
      const projects = await api.getProjects();
      setAllProjectsList(projects || []);
    } catch (e) {
      toast.error("Failed to load organization projects");
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLogs();
      const interval = setInterval(fetchActivityLogs, 30000);
      return () => clearInterval(interval);
    }
    if (activeTab === 'broadcasts') fetchAnnouncements()
    if (activeTab === 'licenses') fetchAdminLicenses()
    if (activeTab === 'organizations') fetchOrganizations()
    if (activeTab === 'projects') fetchAllProjects()
    if (activeTab === 'storage') fetchOrgBackupSettings()
  }, [activeTab])

  const handleAdminGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await authService.adminGenerateLicenseKey(genTier, genDays, genTargetEmail)
    if (res && res.success) {
      setGeneratedAdminKey(res.key)
      toast.success(res.message || "License Key Generated!")
      fetchAdminLicenses()
    } else {
      toast.error(res.message || "Failed to generate key")
    }
  }

  const handleAdminRevokeKey = async (key: string) => {
    const choice = await confirm(`Revoke license key ${key}? User will lose Pro access immediately.`, { title: "Revoke License Key", confirmText: "Revoke", cancelText: "Cancel" })
    if (!choice) return
    const res = await authService.adminRevokeLicenseKey(key)
    if (res && res.success) {
      toast.success(res.message || "License Key Revoked")
      fetchAdminLicenses()
    } else {
      toast.error(res.message || "Revocation failed")
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate({ to: '/login' })
  }

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAnnouncementMsg.trim()) return

    const res = await api.createAnnouncement(newAnnouncementMsg, true)
    
    if (!res.success) {
      toast.error(res.message)
    } else {
      toast.success("Broadcast created successfully!")
      setNewAnnouncementMsg('')
      fetchAnnouncements()
    }
  }

  const toggleAnnouncement = async (id: string, currentStatus: boolean) => {
    const res = await api.toggleAnnouncement(id, !currentStatus)
    
    if (!res.success) toast.error(res.message)
    else fetchAnnouncements()
  }

  const deleteAnnouncement = async (id: string) => {
    const choice = await confirm("Delete this broadcast permanently?", { title: "Delete Broadcast", confirmText: "Delete", cancelText: "Cancel" })
    if (!choice) return

    const res = await api.deleteAnnouncement(id)
    if (!res.success) toast.error(res.message)
    else fetchAnnouncements()
  }

  const handleRoleChange = async (profileId: string, newRole: string) => {
    const currentId = userData?.id || profile?.id || session?.user?.id;
    if (profileId === currentId) {
      toast.error("You cannot change your own role.")
      return
    }
    
    // 1. INSTANT STATE UPDATE (0ms delay)
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
    toast.success(`Role updated to ${newRole}`);
    
    // 2. Async API update
    await api.adminToggleRole(profileId, newRole);
  }

  const deleteUser = async (profileId: string, email: string) => {
    const currentId = userData?.id || profile?.id;
    const currentEmail = userData?.email || profile?.email;
    if (profileId === currentId || email === currentEmail) {
      toast.error("You cannot delete your own account.");
      return;
    }
    const choice = await confirm(`Are you sure you want to delete ${email}?\n\nThey will permanently lose access to the application.`, { title: "Delete User", confirmText: "Delete", cancelText: "Cancel" });
    if (!choice) return;

    const res = await api.adminDeleteUser(profileId);
    
    if (!res.success) {
      toast.error(res.message);
    } else {
      toast.success("User deleted successfully");
      fetchProfiles();
    }
  };

  const [signUpErrorDetails, setSignUpErrorDetails] = useState<string | null>(null)

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) return
    setSignUpErrorDetails(null)
    setIsAddingUser(true)
    
    // Disabled during custom auth migration
    toast.error("User creation via Admin panel temporarily disabled during backend migration")
    
    setIsAddingUser(false)
  }

  const saveExpiry = async (profileId: string) => {
    let dateStr: string | null = null;
    if (newExpiryDate) {
      const exp = new Date(newExpiryDate);
      exp.setHours(23, 59, 59, 999);
      dateStr = exp.toISOString();
    }
    
    // Optimistic UI update
    setProfiles(prevProfiles => prevProfiles.map(p => 
      p.id === profileId ? { ...p, subscription_expires: dateStr || '' } : p
    ));

    const res = await api.adminUpdateProfile(profileId, { subscription_expires: dateStr });
      
    if (!res.success) {
      toast.error("Failed to update expiry: " + res.message)
      fetchProfiles()
    } else {
      toast.success("Expiry date updated successfully!")
      setEditingExpiryFor(null)
      fetchProfiles()
    }
  }

  const toggleFeature = async (featureKey: string) => {
    if (!editingPermissionsFor) return;
    
    const cleanKey = featureKey.replace('/', '').split('?')[0];
    const path = `/${cleanKey}`;
    const isCurrentlyUnlocked = !isFeatureLocked(path, editingPermissionsFor);
    
    const updatedFeatures = {
      ...editingPermissionsFor.features,
      [cleanKey]: !isCurrentlyUnlocked
    };
    
    // Optimistic UI update
    setEditingPermissionsFor({ ...editingPermissionsFor, features: updatedFeatures });
    
    // Also update the main profiles list immediately to prevent stale data when re-opening
    setProfiles(prevProfiles => prevProfiles.map(p => 
      p.id === editingPermissionsFor.id ? { ...p, features: updatedFeatures } : p
    ));
    
    const res = await api.adminUpdateProfile(editingPermissionsFor.id, { features: updatedFeatures });
      
    if (!res.success) {
      toast.error("Failed to update permission: " + res.message);
    }
  }

  const toggleSection = async (items: any[]) => {
    if (!editingPermissionsFor) return;

    // Check if ALL items in this section are currently unlocked
    const allUnlocked = items.every(item => !isFeatureLocked(item.to, editingPermissionsFor));
    const newValue = !allUnlocked;

    const updatedFeatures = { ...editingPermissionsFor.features };
    items.forEach(item => {
      const routeKey = item.to!.replace('/', '').split('?')[0];
      updatedFeatures[routeKey] = newValue;
    });

    setEditingPermissionsFor({ ...editingPermissionsFor, features: updatedFeatures });
    setProfiles(prevProfiles => prevProfiles.map(p => 
      p.id === editingPermissionsFor.id ? { ...p, features: updatedFeatures } : p
    ));

    const res = await api.adminUpdateProfile(editingPermissionsFor.id, { features: updatedFeatures });
    if (!res.success) {
      toast.error("Failed to update section permissions: " + res.message);
    }
  }

  const handlePickFolder = async (type: 'local' | 'server' | 'versions') => {
    const title = type === 'local' 
      ? 'Select Local Backup Folder' 
      : type === 'server' 
      ? 'Select Server Backup Folder' 
      : 'Select Organization Common Version Storage Directory';

    const updatePathState = (selectedPath: string) => {
      if (type === 'local') {
        setLocalBackupPath(selectedPath);
        localStorage.setItem('localBackupPath', selectedPath);
        toast.success("Local backup path updated!");
      } else if (type === 'server') {
        setServerBackupPath(selectedPath);
        localStorage.setItem('serverBackupPath', selectedPath);
        toast.success("Server backup path updated!");
      } else {
        setVersionsPath(selectedPath);
        localStorage.setItem('versionsPath', selectedPath);
        toast.success("Versions path updated!");
      }
    };

    // 1. Desktop (Tauri) Native File Dialog
    try {
      if (typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)) {
        const { open: openFileDialog } = await import('@tauri-apps/plugin-dialog');
        const selected = await openFileDialog({
          directory: true,
          multiple: false,
          title,
        });
        if (selected && typeof selected === 'string') {
          updatePathState(selected);
          return;
        }
      }
    } catch (e) {
      console.warn("Tauri dialog not available:", e);
    }

    // 2. HTML5 File System Access API (showDirectoryPicker) for Web Browsers
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          const currentVal = type === 'local' ? localBackupPath : type === 'server' ? serverBackupPath : versionsPath;
          const defaultSuggestion = currentVal 
            ? `${currentVal.replace(/[/\\]+$/, '')}\\${dirHandle.name}` 
            : `Z:\\${dirHandle.name}`;

          const userConfirmedPath = window.prompt(
            `Selected folder: "${dirHandle.name}"\n\nPlease confirm or enter the full shared network / local disk path for your organization:`,
            defaultSuggestion
          );

          if (userConfirmedPath && userConfirmedPath.trim()) {
            updatePathState(userConfirmedPath.trim());
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        console.warn("showDirectoryPicker error:", err);
      }
    }

    // 3. Fallback Prompt
    const currentVal = type === 'local' ? localBackupPath : type === 'server' ? serverBackupPath : versionsPath;
    const inputPath = window.prompt(
      `Enter or paste the full directory path for ${title} (e.g., Z:\\Versions or \\\\server-m\\Versions):`,
      currentVal || ''
    );
    if (inputPath && inputPath.trim()) {
      updatePathState(inputPath.trim());
    }
  }

  const assignOrganization = async (profileId: string, orgId: string) => {
    const orgObj = organizations.find((o: any) => o.id === orgId);
    const orgName = orgObj ? orgObj.name : "";

    // Seat limit check when assigning user to a non-empty organization
    if (orgId && orgObj) {
      const targetUser = profiles.find(p => p.id === profileId);
      if (targetUser && targetUser.organization_id !== orgId) {
        const currentMembers = profiles.filter(p => p.organization_id === orgId);
        const maxUsers = orgObj.max_users || 5;
        if (currentMembers.length >= maxUsers) {
          toast.error(`Cannot assign user. Organization "${orgName}" has reached its maximum limit of ${maxUsers} seats (${currentMembers.length}/${maxUsers} Used). Please edit/increase max seats first.`);
          return;
        }
      }
    }
    
    // Update local state & local storage instantly
    const updatedProfiles = profiles.map(p => (p.id === profileId || (p.email && p.email.toLowerCase() === String(profileId).toLowerCase())) ? { ...p, organization_id: orgId || '', company: orgName, organization: orgName } : p);
    setProfiles(updatedProfiles);
    try {
      localStorage.setItem('mep_local_users', JSON.stringify(updatedProfiles));
      localStorage.setItem('cachedAllUsers', JSON.stringify(updatedProfiles));
      if (profileId) {
        localStorage.setItem(`mep_user_company_${profileId}`, orgName);
      }
      const orgOverrides = JSON.parse(localStorage.getItem('mep_user_org_overrides') || '{}');
      const targetUser = profiles.find(p => p.id === profileId || (p.email && p.email.toLowerCase() === String(profileId).toLowerCase()));
      if (targetUser) {
        const valToStore = orgId || 'No Organization';
        if (targetUser.email) orgOverrides[targetUser.email.toLowerCase()] = valToStore;
        if (targetUser.id) orgOverrides[String(targetUser.id).toLowerCase()] = valToStore;
        orgOverrides[String(profileId).toLowerCase()] = valToStore;
        localStorage.setItem('mep_user_org_overrides', JSON.stringify(orgOverrides));
      }
    } catch (e) {}

    const res = await api.adminUpdateProfile(profileId, { 
      organization_id: orgId || null,
      company: orgName,
      organization: orgName 
    });
    if (res.success) {
      toast.success(orgName ? `Organization "${orgName}" assigned successfully!` : "Organization unassigned!");
      fetchProfiles();
    } else {
      toast.error("Failed to assign organization");
    }
  };



  if (checking) return (
    <div className="flex items-center justify-center h-screen bg-slate-50 dark:bg-slate-950">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-slate-950 p-4">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground mt-2">You do not have administrator privileges to view this page.</p>
        
        {debugInfo && (
          <div className="mt-8 p-4 bg-slate-200 dark:bg-slate-800 rounded-lg text-left max-w-md w-full overflow-auto">
            <h3 className="font-bold mb-2">Debug Info (Take a screenshot):</h3>
            <pre className="text-xs text-slate-700 dark:text-slate-300">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}

        <button 
          onClick={handleLogout}
          className="mt-6 px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50/60 dark:bg-slate-950 p-3 md:p-5 flex flex-col gap-3.5">
      {/* Compact, Modern Header Bar */}
      <div className="w-full flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link 
            to="/" 
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          </Link>
          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-100 dark:border-blue-800/40">
            <ShieldAlert className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm md:text-base font-bold text-slate-900 dark:text-white tracking-tight">Admin Control Panel</h1>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono hidden sm:inline">({user?.email})</span>
          </div>
        </div>
        
        <button 
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-lg border border-red-200/60 dark:border-red-800/40 transition-all cursor-pointer shadow-2xs"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>

      {/* Main Full-Width Stretched Container */}
      <div className="w-full flex-1 flex flex-col md:flex-row gap-3.5 items-stretch min-h-0">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-60 shrink-0 flex flex-col gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs h-fit md:h-auto">
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'users' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users size={16} />
              User Access
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('organizations')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'organizations' 
                ? 'bg-indigo-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Building size={16} />
              Organizations
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'projects' 
                ? 'bg-purple-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen size={16} />
              Organization Projects
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('broadcasts')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'broadcasts' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Megaphone size={16} />
              Broadcasts
            </div>
          </button>
          <button 
            onClick={() => setActiveTab('licenses')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'licenses' 
                ? 'bg-amber-600 text-white shadow-xs' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Key size={16} />
              Key Manager & Licensing
            </div>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col min-h-[700px]">
          {activeTab === 'users' && (
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Users by Organization</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Select an organization from the dropdown to view its members, organization admin representative, and seat usage.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 px-3 py-1 rounded-lg">
                      <span className="text-slate-400">⌨️ Shortcuts:</span>
                      <kbd className="px-1 py-0.2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Ctrl+A</kbd> Select All
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <kbd className="px-1 py-0.2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Shift+Click</kbd> Range
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <kbd className="px-1 py-0.2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Ctrl+Z</kbd> Undo
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <kbd className="px-1 py-0.2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Ctrl+Y</kbd> Redo
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <kbd className="px-1 py-0.2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-[10px] font-mono text-slate-700 dark:text-slate-300">Esc</kbd> Clear
                    </div>
                    <button onClick={fetchProfiles} className="text-sm text-blue-600 hover:underline font-medium">Refresh</button>
                    <button 
                      onClick={() => setShowAddUser(true)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      + Add User
                    </button>
                  </div>
                </div>

                {/* Requirement: Organization Selector Dropdown */}
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3 flex-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
                      <Building size={16} className="text-blue-600" />
                      Select Organization:
                    </label>
                    <select
                      value={selectedOrgFilter}
                      onChange={(e) => setSelectedOrgFilter(e.target.value)}
                      className="text-sm p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 max-w-md w-full shadow-xs cursor-pointer"
                    >
                      <option value="ALL">🏢 All Organizations & Members ({profiles.length} total users)</option>
                      <option value="UNASSIGNED">👤 Unassigned Users (No Organization) ({profiles.filter(p => !p.organization_id && p.role !== 'SUPER_ADMIN').length})</option>
                      {organizations.map(org => {
                        const count = profiles.filter(p => p.organization_id === org.id).length;
                        const orgAdmin = profiles.find(p => p.organization_id === org.id && p.role === 'ORG_ADMIN');
                        const adminStr = orgAdmin ? ` — Admin: ${orgAdmin.email}` : '';
                        return (
                          <option key={org.id} value={org.id}>
                            🏢 {org.name} ({count} users{adminStr})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="text-xs font-semibold text-slate-500">
                    Showing {profiles.filter(p => {
                      if (selectedOrgFilter === 'ALL') return true;
                      if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                      return p.organization_id === selectedOrgFilter;
                    }).length} Users
                  </div>
                </div>

                {/* Requirement: Organization Admin Representative Card */}
                {selectedOrgFilter !== 'ALL' && selectedOrgFilter !== 'UNASSIGNED' && (() => {
                  const currentOrg = (organizations || []).find(o => o && o.id === selectedOrgFilter);
                  if (!currentOrg) return null;
                  const currentOrgAdmin = (profiles || []).find(p => p && p.organization_id === currentOrg.id && p.role === 'ORG_ADMIN');
                  const currentOrgUsers = (profiles || []).filter(p => p && p.organization_id === currentOrg.id);
                  const orgName = currentOrg.name || 'Organization';

                  return (
                    <div className="mb-6 p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/60 dark:bg-purple-900/10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                          {orgName.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">{orgName}</h3>
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {currentOrg.subscription_plan || 'PRO PLAN'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                            <span className="font-semibold text-purple-700 dark:text-purple-400">Organization Representative / Admin:</span>
                            {currentOrgAdmin ? (
                              <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                                <Crown size={14} className="text-amber-500" /> {currentOrgAdmin.email}
                              </span>
                            ) : (
                              <span className="italic text-slate-400">No Org Admin assigned yet</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-purple-100 dark:border-purple-900/40 font-medium">
                          <span className="text-slate-500">Seats Used: </span>
                          <span className="font-bold text-purple-700 dark:text-purple-300">{currentOrgUsers.length}</span> / {currentOrg.max_users || 5} Max Seats
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {showAddUser && (
                  <div className="mb-6 p-5 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl">
                    <h3 className="text-sm font-semibold mb-3">Create New Engineer</h3>
                    <form onSubmit={handleAddUser} className="flex items-end gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
                        <input 
                          type="email" 
                          required 
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-slate-500 mb-1">Password</label>
                        <input 
                          type="password" 
                          required 
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={isAddingUser}
                        className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {isAddingUser ? 'Creating...' : 'Create'}
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setShowAddUser(false)}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </form>
                    {signUpErrorDetails && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                        <p className="text-sm font-bold text-red-600 dark:text-red-400 mb-1">Failed to create user:</p>
                        <pre className="text-xs text-red-500 whitespace-pre-wrap font-mono overflow-auto max-h-40">{signUpErrorDetails}</pre>
                      </div>
                    )}
                  </div>
                )}
                
                {/* Sleek Floating Dock Action Bar (Fixed at Bottom Center - Never shifts table layout) */}
                {selectedUserIds.length > 0 && (
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 backdrop-blur-md text-white border border-indigo-500/50 p-3 px-5 rounded-2xl shadow-2xl flex items-center justify-between gap-5 animate-in fade-in slide-in-from-bottom-6 duration-200 min-w-[650px] max-w-[90vw]">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-lg bg-indigo-600 text-xs font-bold shadow-xs whitespace-nowrap">
                        {selectedUserIds.length} Selected
                      </span>
                      <p className="text-xs text-slate-300 font-medium hidden sm:block">
                        Assign selected user(s) to target organization:
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <select
                        value={bulkTargetOrgId}
                        onChange={(e) => setBulkTargetOrgId(e.target.value)}
                        className="text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold cursor-pointer min-w-[200px] focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Select Target Organization --</option>
                        {organizations.map(org => (
                          <option key={org.id} value={org.id}>{org.name}</option>
                        ))}
                      </select>
                      
                      <button
                        disabled={!bulkTargetOrgId}
                        onClick={() => {
                          const orgObj = organizations.find(o => o.id === bulkTargetOrgId);
                          if (orgObj) handleBulkAssignToOrg(bulkTargetOrgId, orgObj.name);
                        }}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer border border-emerald-400/30 active:scale-95 whitespace-nowrap"
                      >
                        <CheckCircle2 size={15} /> Confirm & Add
                      </button>

                      <button
                        onClick={() => setSelectedUserIds([])}
                        className="text-slate-400 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                        title="Deselect All"
                      >
                        Cancel ✕
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                        <th className="pb-3 px-2 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={profiles.length > 0 && profiles.every(p => selectedUserIds.includes(p.id))}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedUserIds(profiles.map(p => p.id));
                              else setSelectedUserIds([]);
                            }}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                            title="Select All Users"
                          />
                        </th>
                        <th className="pb-3 font-medium">Email</th>
                        <th className="pb-3 font-medium">Role</th>
                        <th className="pb-3 font-medium">Organization</th>
                        <th className="pb-3 font-medium">Status</th>
                        <th className="pb-3 font-medium">Expires</th>
                        <th className="pb-3 font-medium text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {loadingProfiles ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-500">Loading...</td></tr>
                      ) : profiles.filter(p => {
                        if (selectedOrgFilter === 'ALL') return true;
                        if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                        return p.organization_id === selectedOrgFilter;
                      }).length === 0 ? (
                        <tr><td colSpan={7} className="py-8 text-center text-slate-500">No users found for this organization selection.</td></tr>
                      ) : (() => {
                        const visibleProfiles = profiles.filter(p => {
                          if (selectedOrgFilter === 'ALL') return true;
                          if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                          return p.organization_id === selectedOrgFilter;
                        });

                        return visibleProfiles.map((p, idx) => (
                          <tr key={p.id} className={`border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${selectedUserIds.includes(p.id) ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : ''}`}>
                            <td className="py-4 px-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedUserIds.includes(p.id)}
                                onClick={(e) => {
                                  if (e.shiftKey && lastSelectedIndex !== null && lastSelectedIndex !== idx) {
                                    const start = Math.min(lastSelectedIndex, idx);
                                    const end = Math.max(lastSelectedIndex, idx);
                                    const rangeIds = visibleProfiles.slice(start, end + 1).map(item => item.id);
                                    const combined = Array.from(new Set([...selectedUserIds, ...rangeIds]));
                                    updateSelection(combined);
                                    toast.info(`Selected range of ${rangeIds.length} users (Shift+Click)`, { duration: 1200 });
                                  } else {
                                    const next = selectedUserIds.includes(p.id)
                                      ? selectedUserIds.filter(id => id !== p.id)
                                      : [...selectedUserIds, p.id];
                                    updateSelection(next);
                                  }
                                  setLastSelectedIndex(idx);
                                }}
                                onChange={() => {}}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                              />
                            </td>
                            <td className="py-4 font-medium flex items-center gap-2">
                              {p.role === 'ORG_ADMIN' && <Crown size={15} className="text-amber-500 shrink-0" title="Organization Admin Representative" />}
                              <span>{p.email}</span>
                            </td>
                            <td className="py-4">
                              <select
                                value={p.role || 'Design Engineer'}
                                onChange={(e) => handleRoleChange(p.id, e.target.value)}
                                className="text-xs p-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 cursor-pointer shadow-xs focus:ring-2 focus:ring-blue-500 max-w-[170px]"
                              >
                                <option value="SUPER_ADMIN">⚡ SUPER_ADMIN</option>
                                <option value="ORG_ADMIN">👑 ORG_ADMIN</option>
                                <option value="Jr. Design Engineer">Jr. Design Engineer</option>
                                <option value="Design Engineer">Design Engineer</option>
                                <option value="Sr. Design Engineer">Sr. Design Engineer</option>
                                <option value="Discipline Coordinator">Discipline Coordinator</option>
                                <option value="BIM Modeler">BIM Modeler</option>
                                <option value="BIM Coordinator">BIM Coordinator</option>
                                <option value="Team Leader">Team Leader</option>
                                <option value="2D Draftsman">2D Draftsman</option>
                                <option value="Viewer">Viewer</option>
                                <option value="Client">Client</option>
                              </select>
                            </td>
                            <td className="py-4">
                              {p.role === 'SUPER_ADMIN' ? (
                                <span className="text-slate-400 text-xs italic">N/A</span>
                              ) : (
                                <select 
                                  value={p.organization_id || ''}
                                  onChange={(e) => assignOrganization(p.id, e.target.value)}
                                  className="text-xs p-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 max-w-[150px] truncate cursor-pointer font-medium"
                                >
                                  <option value="">No Organization</option>
                                  {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                            <td className="py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${p.subscription_status === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'}`}>
                                {p.subscription_status}
                              </span>
                            </td>
                            <td className="py-4 text-slate-500">
                              {editingExpiryFor === p.id ? (
                                <div className="flex items-center gap-2">
                                  <input 
                                    type="date" 
                                    value={newExpiryDate.split('T')[0]} 
                                    onChange={(e) => setNewExpiryDate(e.target.value)}
                                    className="p-1 border rounded text-xs"
                                  />
                                  <button onClick={() => saveExpiry(p.id)} className="text-blue-600 font-medium text-xs hover:underline">Save</button>
                                  <button onClick={() => setEditingExpiryFor(null)} className="text-slate-500 font-medium text-xs hover:underline">Cancel</button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span>{p.subscription_expires ? new Date(p.subscription_expires).toLocaleDateString() : 'Never'}</span>
                                  <button 
                                    onClick={() => {
                                      setEditingExpiryFor(p.id);
                                      const d = p.subscription_expires ? new Date(p.subscription_expires) : null;
                                      setNewExpiryDate(d && !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : '');
                                    }}
                                    className="text-blue-600 text-[10px] uppercase font-bold tracking-wider hover:underline opacity-60 hover:opacity-100"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-4 text-right space-x-2 whitespace-nowrap">
                              <button 
                                onClick={() => setEditingPermissionsFor(p)}
                                className="px-3 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 rounded text-xs font-medium transition-colors"
                              >
                                Permissions
                              </button>
                              <button 
                                onClick={() => deleteUser(p.id, p.email)}
                                className="px-3 py-1 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded text-xs font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'organizations' && (
              <div className="p-6 space-y-6">
                {selectedOrgForManagement ? (
                  <div className="space-y-6 animate-fade-in">
                    {/* Organization Manager Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
                      <div className="flex items-center gap-3.5">
                        <button 
                          onClick={() => {
                            setSelectedOrgForManagement(null);
                            setEditingSeatsForOrg(false);
                          }}
                          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors cursor-pointer border border-slate-200/80 dark:border-slate-700"
                          title="Back to Organizations List"
                        >
                          <ArrowLeft size={16} />
                        </button>
                        <div>
                          <div className="flex items-center gap-2.5">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                              {(selectedOrgForManagement.name === 'Consitent' || selectedOrgForManagement.name === 'Consistent')
                                ? 'Consistent Engineering Consultants'
                                : selectedOrgForManagement.name}
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
                              {selectedOrgForManagement.subscription_plan || "PRO PLAN"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Manage members, assign existing users, change member roles, or delete users for this organization.
                          </p>
                        </div>
                      </div>

                      {/* EDITABLE SEATS ALLOCATION DISPLAY */}
                      <div className="flex items-center gap-3 shrink-0">
                        {editingSeatsForOrg ? (
                          <div className="flex items-center gap-2 bg-surface-2 border border-primary/40 p-1.5 rounded-xl shadow-xs">
                            <span className="text-xs font-bold text-foreground pl-2">Max Seats:</span>
                            <input
                              type="number"
                              min={1}
                              value={newSeatsValue}
                              onChange={(e) => setNewSeatsValue(parseInt(e.target.value) || 1)}
                              className="w-20 px-2.5 py-1 text-xs font-bold bg-background border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => handleUpdateMaxSeats(selectedOrgForManagement.id, newSeatsValue)}
                              className="px-3 py-1 bg-primary text-primary-foreground font-bold text-xs rounded-lg transition cursor-pointer shadow-xs hover:bg-primary/90"
                            >
                              Save Seats
                            </button>
                            <button
                              onClick={() => setEditingSeatsForOrg(false)}
                              className="px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={`flex items-center gap-3.5 border px-4 py-2 rounded-xl shadow-xs ${
                            profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length >= (selectedOrgForManagement.max_users || 5)
                              ? 'bg-amber-500/10 border-amber-500/40'
                              : 'bg-surface-2 border-border/80'
                          }`}>
                            <div className="flex items-center gap-2">
                              <Users size={16} className={profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length >= (selectedOrgForManagement.max_users || 5) ? "text-amber-600" : "text-primary"} />
                              <div className="text-xs font-bold text-foreground">
                                <span>{profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length}</span>
                                <span className="text-muted-foreground font-normal"> / </span>
                                <span className="text-primary font-extrabold">{selectedOrgForManagement.max_users || 5}</span>
                                <span className="text-muted-foreground font-semibold"> Seats Used</span>
                                {profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length >= (selectedOrgForManagement.max_users || 5) && (
                                  <span className="ml-1.5 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] uppercase">
                                    Full (Limit Reached)
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setNewSeatsValue(selectedOrgForManagement.max_users || 5);
                                setEditingSeatsForOrg(true);
                              }}
                              className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-bold rounded-lg border border-primary/20 transition cursor-pointer flex items-center gap-1.5"
                              title="Increase or edit member seat limit"
                            >
                              <Edit3 size={13} />
                              <span>Edit Seats</span>
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => {
                            setSelectedUserIds([]);
                            setShowAddUserModalForOrg(true);
                          }}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <UserPlus size={15} />
                          <span>+ Add Users</span>
                        </button>
                      </div>
                    </div>

                    {/* Organization License Key String (READ ONLY) */}
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/50">
                          <Key size={16} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Assigned License Key String:</span>
                            <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-lg text-xs tracking-wider shadow-2xs">
                              {selectedOrgForManagement.license_key || "MEP-CONS-8F92-4A7B-9021"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Unique 20-character license key assigned in database for this organization.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* + ADD USERS TO ORGANIZATION MODAL OVERLAY */}
                    {showAddUserModalForOrg && (
                      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                                <UserPlus size={18} />
                              </div>
                              <div>
                                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                                  Add Users to {selectedOrgForManagement.name}
                                </h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Select existing application users below to add them to this organization.
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => setShowAddUserModalForOrg(false)}
                              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Search bar & Capacity indicator */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="relative flex-1">
                              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                              <input 
                                type="text"
                                placeholder="Search available users by email or role..."
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white w-full outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <span className="text-xs font-semibold text-slate-500 shrink-0">
                              {profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length}/{selectedOrgForManagement.max_users || 5} Seats Used
                            </span>
                          </div>

                          {/* Multi-Select Grid */}
                          <div className="flex-1 overflow-y-auto max-h-[50vh] pr-1 space-y-2">
                            {(() => {
                              const availableUsers = profiles.filter(p => 
                                p.organization_id !== selectedOrgForManagement.id && 
                                p.role !== 'SUPER_ADMIN' &&
                                (userSearchQuery ? p.email.toLowerCase().includes(userSearchQuery.toLowerCase()) || p.role?.toLowerCase().includes(userSearchQuery.toLowerCase()) : true)
                              );

                              const allAvailableSelected = availableUsers.length > 0 && availableUsers.every(u => selectedUserIds.includes(u.id));

                              if (availableUsers.length === 0) {
                                return (
                                  <p className="text-xs text-slate-500 italic py-8 text-center">
                                    {userSearchQuery ? "No matching available users found." : "All application users are already members of this organization!"}
                                  </p>
                                );
                              }

                              return (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                      <input
                                        type="checkbox"
                                        checked={allAvailableSelected}
                                        onChange={(e) => {
                                          if (e.target.checked) {
                                            setSelectedUserIds(prev => Array.from(new Set([...prev, ...availableUsers.map(u => u.id)])));
                                          } else {
                                            const availIds = new Set(availableUsers.map(u => u.id));
                                            setSelectedUserIds(prev => prev.filter(id => !availIds.has(id)));
                                          }
                                        }}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                      />
                                      <span>Select All Available Users ({availableUsers.length})</span>
                                    </label>
                                    <span className="text-[11px] text-slate-500 font-normal">
                                      {selectedUserIds.length} users selected
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                    {availableUsers.map(u => {
                                      const isSelected = selectedUserIds.includes(u.id);
                                      return (
                                        <div
                                          key={u.id}
                                          onClick={() => {
                                            setSelectedUserIds(prev => isSelected ? prev.filter(id => id !== u.id) : [...prev, u.id]);
                                          }}
                                          className={`p-3 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                                            isSelected 
                                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 font-semibold text-blue-900 dark:text-blue-200 shadow-xs' 
                                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300'
                                          }`}
                                        >
                                          <div className="flex items-center gap-2.5 truncate">
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={() => {}}
                                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                            />
                                            <div className="truncate">
                                              <p className="font-semibold truncate text-slate-900 dark:text-white">{u.email}</p>
                                              <p className="text-[10px] text-slate-500 truncate">
                                                {u.role} • {u.organization_id ? 'In another org' : 'Unassigned'}
                                              </p>
                                            </div>
                                          </div>
                                          {isSelected && <Check size={14} className="text-blue-600 shrink-0 ml-1" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Footer action buttons */}
                          <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-3">
                            <button
                              onClick={() => setShowAddUserModalForOrg(false)}
                              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 transition"
                            >
                              Cancel
                            </button>
                            <button
                              disabled={
                                selectedUserIds.length === 0 || 
                                profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length >= (selectedOrgForManagement.max_users || 5) ||
                                profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length + selectedUserIds.length > (selectedOrgForManagement.max_users || 5)
                              }
                              onClick={async () => {
                                await handleBulkAssignToOrg(selectedOrgForManagement.id, selectedOrgForManagement.name);
                                setShowAddUserModalForOrg(false);
                              }}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer"
                            >
                              <UserCheck size={15} />
                              <span>
                                {profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length >= (selectedOrgForManagement.max_users || 5)
                                  ? `Seat Limit Full (${selectedOrgForManagement.max_users} Seats)`
                                  : profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length + selectedUserIds.length > (selectedOrgForManagement.max_users || 5)
                                    ? `Exceeds Limit (${profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length + selectedUserIds.length}/${selectedOrgForManagement.max_users})`
                                    : `Add (${selectedUserIds.length}) Selected to ${selectedOrgForManagement.name}`
                                }
                              </span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section: Organization Members Table */}
                    <div>
                      <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Users size={16} className="text-primary" />
                        Current Organization Members ({profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length})
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-surface-2/80 border-b border-border text-[11px] font-extrabold tracking-wider text-muted-foreground uppercase">
                              <th className="py-3.5 px-4">User Email</th>
                              <th className="py-3.5 px-4">Role</th>
                              <th className="py-3.5 px-4">Status</th>
                              <th className="py-3.5 px-4 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="text-xs divide-y divide-border/40">
                            {profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length === 0 ? (
                              <tr>
                                <td colSpan={4} className="py-8 text-center text-muted-foreground italic">
                                  No members in this organization yet. Select an existing user above to add them!
                                </td>
                              </tr>
                            ) : (
                              profiles
                                .filter(p => p.organization_id === selectedOrgForManagement.id)
                                .map(user => (
                                  <tr key={user.id} className="hover:bg-surface-2/60 transition-colors">
                                    <td className="py-3 px-4 font-semibold text-foreground flex items-center gap-2">
                                      {user.role === 'ORG_ADMIN' && <Crown size={15} className="text-amber-500 shrink-0" title="Organization Admin Representative" />}
                                      <span>{user.email}</span>
                                    </td>
                                    <td className="py-3 px-4">
                                      <select
                                        value={user.role || 'Design Engineer'}
                                        onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                        className="text-xs p-2 rounded-xl border border-border bg-background font-semibold text-foreground cursor-pointer shadow-2xs focus:ring-2 focus:ring-primary/20 max-w-[180px] outline-none"
                                      >
                                        <option value="SUPER_ADMIN">⚡ SUPER_ADMIN</option>
                                        <option value="ORG_ADMIN">👑 ORG_ADMIN</option>
                                        <option value="Jr. Design Engineer">Jr. Design Engineer</option>
                                        <option value="Design Engineer">Design Engineer</option>
                                        <option value="Sr. Design Engineer">Sr. Design Engineer</option>
                                        <option value="Discipline Coordinator">Discipline Coordinator</option>
                                        <option value="BIM Modeler">BIM Modeler</option>
                                        <option value="BIM Coordinator">BIM Coordinator</option>
                                        <option value="Team Leader">Team Leader</option>
                                        <option value="2D Draftsman">2D Draftsman</option>
                                        <option value="Viewer">Viewer</option>
                                        <option value="Client">Client</option>
                                      </select>
                                    </td>
                                    <td className="py-3 px-4">
                                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        {user.status || 'ACTIVE'}
                                      </span>
                                    </td>
                                    <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap">
                                      <button
                                        onClick={async () => {
                                          await assignOrganization(user.id, '');
                                          toast.info(`Removed ${user.email} from ${selectedOrgForManagement.name}`);
                                        }}
                                        className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                        title="Remove user from this organization"
                                      >
                                        Remove from Org
                                      </button>
                                      <button
                                        onClick={() => deleteUser(user.id, user.email)}
                                        className="px-3.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer"
                                        title="Permanently delete user"
                                      >
                                        Delete User
                                      </button>
                                    </td>
                                  </tr>
                                ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl font-bold">Manage Organizations</h2>
                      <div className="flex items-center gap-3">
                        <button onClick={fetchOrganizations} className="text-sm text-blue-600 hover:underline">Refresh</button>
                        <button 
                          onClick={() => setShowAddOrg(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg shadow-xs transition-colors"
                        >
                          + Create Organization
                        </button>
                      </div>
                    </div>

                    {showAddOrg && (
                      <div className="mb-6 p-5 border border-indigo-100 dark:border-indigo-900/30 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl">
                        <h3 className="text-sm font-semibold mb-3">Create New Organization</h3>
                        <form onSubmit={handleAddOrg} className="flex flex-wrap items-end gap-3">
                          <div className="flex-1 min-w-[200px]">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Org Name</label>
                            <input 
                              type="text" 
                              required 
                              value={newOrgName}
                              onChange={(e) => setNewOrgName(e.target.value)}
                              className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                          </div>
                          <div className="w-32">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Plan</label>
                            <select 
                              value={newOrgPlan}
                              onChange={(e) => setNewOrgPlan(e.target.value)}
                              className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            >
                              <option value="PRO">PRO</option>
                              <option value="ENTERPRISE">ENTERPRISE</option>
                            </select>
                          </div>
                          <div className="w-24">
                            <label className="block text-xs font-medium text-slate-500 mb-1">Max Users</label>
                            <input 
                              type="number" 
                              min="1"
                              required 
                              value={newOrgUsers}
                              onChange={(e) => setNewOrgUsers(parseInt(e.target.value))}
                              className="w-full text-sm p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                            />
                          </div>
                          <button 
                            type="submit" 
                            disabled={isAddingOrg}
                            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                          >
                            {isAddingOrg ? 'Creating...' : 'Create'}
                          </button>
                          <button 
                            type="button" 
                            onClick={() => setShowAddOrg(false)}
                            className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-sm font-medium hover:bg-slate-300 dark:hover:bg-slate-700"
                          >
                            Cancel
                          </button>
                        </form>
                      </div>
                    )}
                    
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
                            <th className="pb-3 font-medium">Name</th>
                            <th className="pb-3 font-medium">Plan</th>
                            <th className="pb-3 font-medium">Licenses / Seats</th>
                            <th className="pb-3 font-medium text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-sm">
                          {loadingOrganizations ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-500">Loading...</td></tr>
                          ) : organizations.length === 0 ? (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-500">No organizations found.</td></tr>
                          ) : (
                            organizations.map((org) => {
                              const memberCount = profiles.filter(p => p.organization_id === org.id).length;
                              return (
                                <tr key={org.id} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td 
                                    className="py-4 font-bold text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
                                    onClick={() => setSelectedOrgForManagement(org)}
                                  >
                                    🏢 {org.name}
                                  </td>
                                  <td className="py-4">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                                      {org.subscription_plan}
                                    </span>
                                  </td>
                                  <td className="py-4 font-semibold text-slate-700 dark:text-slate-300">
                                    {memberCount} / {org.max_users || 10} Members
                                  </td>
                                  <td className="py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => setSelectedOrgForManagement(org)}
                                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
                                      >
                                        <Users size={14} /> Manage Members ({memberCount})
                                      </button>
                                      <button
                                        onClick={() => deleteOrganization(org.id, org.name)}
                                        className="px-3 py-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                                      >
                                        Delete Org
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'broadcasts' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold">Global Broadcasts</h2>
                  <button onClick={fetchAnnouncements} className="text-sm text-blue-600 hover:underline">Refresh</button>
                </div>

                <div className="mb-8 p-5 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl">
                  <h3 className="text-sm font-semibold mb-3">Create New Broadcast</h3>
                  <form onSubmit={handleCreateAnnouncement} className="flex gap-3">
                    <div className="flex-1">
                      <input 
                        type="text"
                        placeholder="Type your message here (e.g., Update 2.0 is coming tomorrow)"
                        required
                        value={newAnnouncementMsg}
                        onChange={(e) => setNewAnnouncementMsg(e.target.value)}
                        className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    </div>
                    <select
                      value={newAnnouncementType}
                      onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                      className="text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 w-32"
                    >
                      <option value="info">Info</option>
                      <option value="warning">Warning</option>
                      <option value="success">Success</option>
                      <option value="error">Error</option>
                    </select>
                    <button 
                      type="submit"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
                    >
                      Broadcast
                    </button>
                  </form>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Past Broadcasts</h3>
                  {loadingAnnouncements ? (
                    <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-slate-400" /></div>
                  ) : announcements.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">No broadcasts found.</div>
                  ) : (
                    announcements.map((ann) => (
                      <div key={ann.id} className={`p-4 rounded-xl border flex items-center justify-between ${
                        ann.is_active 
                          ? 'border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/20' 
                          : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-75'
                      }`}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${
                              ann.type === 'warning' ? 'bg-amber-100 text-amber-800' :
                              ann.type === 'error' ? 'bg-red-100 text-red-800' :
                              ann.type === 'success' ? 'bg-emerald-100 text-emerald-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {ann.type}
                            </span>
                            <span className="text-xs text-slate-500">{new Date(ann.created_at).toLocaleString()}</span>
                          </div>
                          <p className="text-sm font-medium">{ann.message}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => toggleAnnouncement(ann.id, ann.is_active)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${ann.is_active ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${ann.is_active ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                          <button onClick={() => deleteAnnouncement(ann.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            
            {activeTab === 'projects' && (
              <div className="p-6 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FolderOpen className="text-purple-600 dark:text-purple-400" size={24} />
                      Organization Projects & Workspaces
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Inspect projects created across all organizations using the platform. Click on an organization card to view projects belonging strictly to that organization.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={fetchAllProjects}
                      className="px-3.5 py-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-lg transition shadow-2xs cursor-pointer"
                    >
                      Refresh Projects List
                    </button>
                  </div>
                </div>

                {/* Organization Selection Cards Grid */}
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                    Select Organization ({organizations.length} Registered Organizations)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* ALL ORGANIZATIONS CARD */}
                    <button
                      onClick={() => setSelectedOrgForProjects('ALL')}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${
                        selectedOrgForProjects === 'ALL'
                          ? 'border-purple-600 bg-purple-50/80 dark:bg-purple-900/30 ring-2 ring-purple-500/20'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-purple-300 dark:hover:border-purple-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                          ALL
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                          {allProjectsList.length} Total Projects
                        </span>
                      </div>
                      <div className="mt-3">
                        <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">All Organizations</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">View all projects platform-wide</p>
                      </div>
                    </button>

                    {/* INDIVIDUAL ORGANIZATIONS CARDS */}
                    {organizations.map((org) => {
                      const orgUsers = profiles.filter(u => u.organization_id === org.id).map(u => u.id);
                      const orgProjects = allProjectsList.filter(p => (p.organization_id && p.organization_id === org.id) || orgUsers.includes(p.created_by));
                      const orgAdmin = profiles.find(p => p.organization_id === org.id && p.role === 'ORG_ADMIN');

                      return (
                        <button
                          key={org.id}
                          onClick={() => setSelectedOrgForProjects(org.id)}
                          className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${
                            selectedOrgForProjects === org.id
                              ? 'border-purple-600 bg-purple-50/80 dark:bg-purple-900/30 ring-2 ring-purple-500/20'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-purple-300 dark:hover:border-purple-800'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="size-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
                              {(org.name || 'OR').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300">
                              {orgProjects.length} Project{orgProjects.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{org.name}</h4>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {org.subscription_plan || 'PRO'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              Admin: {orgAdmin ? orgAdmin.email : 'No Org Admin'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Filter Controls & Search */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search projects by name, code, or client..."
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500/20"
                    />
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Showing projects for: <strong className="text-purple-600 dark:text-purple-400">
                      {selectedOrgForProjects === 'ALL'
                        ? 'All Organizations'
                        : (organizations.find(o => o.id === selectedOrgForProjects)?.name || 'Selected Organization')}
                    </strong>
                  </div>
                </div>

                {/* Projects Display Grid */}
                {loadingProjects ? (
                  <div className="py-12 text-center space-y-2">
                    <Loader2 className="size-8 text-purple-600 animate-spin mx-auto" />
                    <p className="text-xs text-slate-500">Loading organization projects...</p>
                  </div>
                ) : (() => {
                  const filteredProjects = allProjectsList.filter(p => {
                    if (selectedOrgForProjects !== 'ALL') {
                      const orgUsers = profiles.filter(u => u.organization_id === selectedOrgForProjects).map(u => u.id);
                      const isMatchingOrg = (p.organization_id && p.organization_id === selectedOrgForProjects) || orgUsers.includes(p.created_by);
                      if (!isMatchingOrg) return false;
                    }

                    if (projectSearchQuery.trim()) {
                      const q = projectSearchQuery.toLowerCase();
                      const matchName = p.name?.toLowerCase().includes(q);
                      const matchCode = p.code?.toLowerCase().includes(q);
                      const matchClient = p.client?.toLowerCase().includes(q);
                      if (!matchName && !matchCode && !matchClient) return false;
                    }

                    return true;
                  });

                  if (filteredProjects.length === 0) {
                    return (
                      <div className="py-12 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                        <FolderOpen className="size-12 text-slate-400 mx-auto mb-2" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Projects Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                          {selectedOrgForProjects === 'ALL'
                            ? 'No projects have been created across any organization yet.'
                            : 'This organization has not created any projects yet.'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredProjects.map((proj) => {
                        const creatorProfile = profiles.find(u => u.id === proj.created_by || u.email === proj.created_by);
                        const matchedOrgId = proj.organization_id || creatorProfile?.organization_id;
                        const matchedOrg = organizations.find(o => o.id === matchedOrgId);
                        const spacesCount = proj.workspace_data?.spaces?.length || 0;
                        const zonesCount = proj.workspace_data?.zones?.length || 0;
                        const equipCount = proj.workspace_data?.equipment?.length || 0;

                        return (
                          <div
                            key={proj.id}
                            className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-2xs hover:shadow-md transition flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-md border border-purple-200 dark:border-purple-800">
                                  {proj.code || 'NO-CODE'}
                                </span>
                                {matchedOrg && (
                                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800 flex items-center gap-1">
                                    🏢 {matchedOrg.name}
                                  </span>
                                )}
                              </div>

                              <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                                {proj.name}
                              </h3>

                              {proj.client && (
                                <p className="text-xs text-slate-500 font-medium">
                                  Client: <strong className="text-slate-700 dark:text-slate-300">{proj.client}</strong>
                                  {proj.location ? ` | ${proj.location}` : ''}
                                </p>
                              )}
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                              <div>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">Spaces</span>
                                <span className="font-extrabold text-purple-600 dark:text-purple-400">{spacesCount}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">Zones</span>
                                <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{zonesCount}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">Equipment</span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">{equipCount}</span>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500">
                              <span>By: {creatorProfile?.email || proj.created_by || 'Unknown'}</span>
                              <button
                                onClick={() => setInspectingProject(proj)}
                                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
                              >
                                Inspect Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'licenses' && (
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Key Manager & Licensing</h2>
                    <p className="text-xs text-slate-500">Generate unique non-repeatable license keys and manage hardware trials.</p>
                  </div>
                  <button onClick={fetchAdminLicenses} className="text-sm text-blue-600 hover:underline">Refresh List</button>
                </div>

                {/* Generator Form */}
                <div className="p-5 border border-amber-200 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-900/10 rounded-2xl space-y-4">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 flex items-center gap-2">
                    <Key className="size-4" />
                    Generate Unique Non-Repeatable License Key
                  </h3>

                  <form onSubmit={handleAdminGenerateKey} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">License Tier</label>
                      <select
                        value={genTier}
                        onChange={(e) => setGenTier(e.target.value as any)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold"
                      >
                        <option value="PRO">PRO Plan</option>
                        <option value="ENTERPRISE">ENTERPRISE Plan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Duration (Days)</label>
                      <input
                        type="number"
                        value={genDays}
                        onChange={(e) => setGenDays(parseInt(e.target.value) || 365)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target User Email (Optional)</label>
                      <input
                        type="email"
                        value={genTargetEmail}
                        onChange={(e) => setGenTargetEmail(e.target.value)}
                        placeholder="user@domain.com"
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <button
                      type="submit"
                      className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Generate Key
                    </button>
                  </form>

                  {generatedAdminKey && (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Generated Key:</span>
                        <code className="text-sm font-mono font-bold text-amber-500 tracking-wider">{generatedAdminKey}</code>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedAdminKey);
                          toast.success("License key copied to clipboard!");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/30 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Copy className="size-3.5" />
                        Copy Key
                      </button>
                    </div>
                  )}
                </div>

                {/* Generated Keys Table */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active & Generated License Keys ({licensesList.length})</h3>
                  {loadingLicenses ? (
                    <div className="py-8 text-center text-slate-400"><Loader2 className="animate-spin size-6 mx-auto mb-2" />Loading keys...</div>
                  ) : licensesList.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic">No custom license keys generated yet.</div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-slate-500 text-[10px]">
                          <tr>
                            <th className="p-3">License Key</th>
                            <th className="p-3">Tier</th>
                            <th className="p-3">Bound Email</th>
                            <th className="p-3">Status</th>
                            <th className="p-3">Expires</th>
                            <th className="p-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {licensesList.map((lic) => (
                            <tr key={lic.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3 font-bold text-amber-600 dark:text-amber-400">{lic.key}</td>
                              <td className="p-3 font-semibold">{lic.tier}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{lic.boundEmail || 'Unbound'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  lic.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                }`}>
                                  {lic.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{new Date(lic.expiresAt).toLocaleDateString()}</td>
                              <td className="p-3 text-right">
                                {lic.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleAdminRevokeKey(lic.key)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Hardware Fingerprint Trials Table */}
                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hardware Fingerprinted Trials ({trialsList.length})</h3>
                  {trialsList.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs italic">No hardware device trials logged yet.</div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 font-bold uppercase text-slate-500 text-[10px]">
                          <tr>
                            <th className="p-3">Hardware ID (HWID)</th>
                            <th className="p-3">Bound Email</th>
                            <th className="p-3">First Claimed</th>
                            <th className="p-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                          {trialsList.map((tr) => (
                            <tr key={tr.hwid} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">{tr.hwid}</td>
                              <td className="p-3 text-slate-500">{tr.email}</td>
                              <td className="p-3 text-slate-500">{new Date(tr.firstSeenAt).toLocaleDateString()}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  Date.now() > tr.expiresAt ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                                }`}>
                                  {Date.now() > tr.expiresAt ? 'EXPIRED' : 'FREE_TRIAL'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      
      {/* Permissions Modal */}
      {editingPermissionsFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">App Permissions</h3>
                <p className="text-sm text-slate-500">{editingPermissionsFor.email}</p>
              </div>
              <button onClick={() => setEditingPermissionsFor(null)} className="text-slate-400 hover:text-slate-600">×</button>
            </div>
            
            <div className="p-0 max-h-[65vh] overflow-y-auto">
              {NAV.map((navItem, i) => {
                if (navItem.kind !== 'group') return null;
                const items = navItem.children.filter(c => !c.isHeader && c.to);
                if (items.length === 0) return null;
                const isSectionUnlocked = items.every(item => !isFeatureLocked(item.to, editingPermissionsFor));
                
                return (
                  <div key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-0 p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-bold text-sm uppercase tracking-wider text-slate-500">{navItem.label}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Toggle All</span>
                        <button 
                          onClick={() => toggleSection(items)}
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isSectionUnlocked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                        >
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isSectionUnlocked ? 'translate-x-5' : 'translate-x-1'}`} />
                        </button>
                      </div>
                    </div>
                    {items.map((item, j) => {
                      const isUnlocked = !isFeatureLocked(item.to, editingPermissionsFor);
                      
                      return (
                        <div key={j} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                          <div>
                            <h4 className="font-medium text-sm">{item.label}</h4>
                            <p className="text-xs text-slate-500">Path: {item.to}</p>
                          </div>
                          <button 
                            onClick={() => toggleFeature(item.to!)}
                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${isUnlocked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                          >
                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isUnlocked ? 'translate-x-5' : 'translate-x-1'}`} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
            
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/20 text-right">
              <button 
                onClick={() => setEditingPermissionsFor(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project Inspector Modal */}
      {inspectingProject && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-scale-in">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-800">
                    {inspectingProject.code || 'NO-CODE'}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {inspectingProject.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Client: <strong className="text-slate-700 dark:text-slate-300">{inspectingProject.client || 'N/A'}</strong>
                  {inspectingProject.location ? ` | Location: ${inspectingProject.location}` : ''}
                </p>
              </div>

              <button
                onClick={() => setInspectingProject(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Created By User</span>
                <p className="font-bold text-slate-900 dark:text-white">
                  {profiles.find(u => u.id === inspectingProject.created_by || u.email === inspectingProject.created_by)?.email || inspectingProject.created_by || 'N/A'}
                </p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Organization Tag</span>
                <p className="font-bold text-indigo-600 dark:text-indigo-400">
                  {organizations.find(o => o.id === (inspectingProject.organization_id || profiles.find(u => u.id === inspectingProject.created_by)?.organization_id))?.name || 'Standard Organization'}
                </p>
              </div>
            </div>

            {inspectingProject.description && (
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Description</h4>
                <p className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                  {inspectingProject.description}
                </p>
              </div>
            )}

            {/* Workspace Elements Summary */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Workspace Contents</h4>
              <div className="grid grid-cols-3 gap-3 text-center text-xs">
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-900/30 rounded-xl">
                  <span className="block text-[10px] font-bold text-purple-600 dark:text-purple-300 uppercase">Spaces Configured</span>
                  <span className="text-lg font-black text-purple-700 dark:text-purple-200">
                    {inspectingProject.workspace_data?.spaces?.length || 0}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl">
                  <span className="block text-[10px] font-bold text-indigo-600 dark:text-indigo-300 uppercase">Thermal Zones</span>
                  <span className="text-lg font-black text-indigo-700 dark:text-indigo-200">
                    {inspectingProject.workspace_data?.zones?.length || 0}
                  </span>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/30 rounded-xl">
                  <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-300 uppercase">Equipment Schedules</span>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-200">
                    {inspectingProject.workspace_data?.equipment?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setInspectingProject(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

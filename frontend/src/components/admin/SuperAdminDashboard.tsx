import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { Loader2, Plus, Search, ShieldAlert, Trash2, Settings, DownloadCloud, Users, HardDrive, Settings as SettingsIcon, LogOut, FolderOpen, Save, CheckCircle2, ArrowLeft, Activity, Megaphone, Key, Copy, Building, Crown, UserCheck, History, UserPlus, CheckSquare, Square, Check, Edit3, ArrowUpDown, ChevronDown, X, MoreVertical, UserMinus, AlertCircle } from "lucide-react"
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
  username?: string
  name?: string
  role: string
  subscription_status: string
  plan?: string
  subscription_expires: string
  features?: any
  organization_id?: string
  designation?: string
  status?: string
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
  const [activeTab, setActiveTabState] = useState<'users' | 'organizations' | 'projects' | 'storage' | 'settings' | 'activity' | 'broadcasts' | 'licenses'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_admin_active_tab');
      if (saved && ['organizations', 'users', 'projects', 'broadcasts', 'licenses', 'activity'].includes(saved)) {
        return saved as any;
      }
    }
    return 'users';
  });

  const setActiveTab = (tab: any) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_admin_active_tab', tab);
    }
    setActiveTabState(tab);
  };

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
  const [selectedOrgFilter, setSelectedOrgFilterState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mep_user_org_filter') || 'ALL';
    }
    return 'ALL';
  });

  const setSelectedOrgFilter = (val: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mep_user_org_filter', val);
    }
    setSelectedOrgFilterState(val);
  };

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
  const [selectedOrgForManagement, setSelectedOrgForManagementState] = useState<any | null>(null)
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null)
  const [editedOrgName, setEditedOrgName] = useState<string>('')

  const handleSaveOrgName = async (orgId: string, newName: string) => {
    if (!newName || !newName.trim()) return toast.error("Organization name cannot be empty");
    const nameToSave = newName.trim();
    try {
      const res = await api.updateOrganization({ orgId, name: nameToSave });
      if (res && res.success !== false) {
        toast.success(`Organization name updated to "${nameToSave}"`);
        setSelectedOrgForManagementState((prev: any) => prev && prev.id === orgId ? { ...prev, name: nameToSave } : prev);
        setOrganizations(prev => prev.map(o => o.id === orgId ? { ...o, name: nameToSave } : o));
        setEditingOrgId(null);
      } else {
        toast.error((res && res.message) || "Failed to update organization name");
      }
    } catch (err: any) {
      toast.error("Error updating organization name: " + (err?.message || String(err)));
    }
  };

  const setSelectedOrgForManagement = (action: any) => {
    setSelectedOrgForManagementState((prev: any) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next && next.id) {
        localStorage.setItem('mep_admin_selected_org_id', next.id);
      } else {
        localStorage.removeItem('mep_admin_selected_org_id');
      }
      return next;
    });
  };

  // Preserve & Restore Scroll Position across data updates and tab switches
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        sessionStorage.setItem('mep_admin_scroll_y', window.scrollY.toString());
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const savedY = sessionStorage.getItem('mep_admin_scroll_y');
    if (savedY) {
      const y = parseInt(savedY, 10);
      if (!isNaN(y) && y > 0) {
        requestAnimationFrame(() => {
          window.scrollTo({ top: y, behavior: 'instant' as any });
        });
      }
    }
  }, [activeTab, selectedOrgForManagement]);
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
  const [userSearchQuery, setUserSearchQueryState] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('mep_user_search_query') || '';
    }
    return '';
  });

  const setUserSearchQuery = (val: string | ((prev: string) => string)) => {
    setUserSearchQueryState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mep_user_search_query', next);
      }
      return next;
    });
  };

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
          }).filter(p => {
            if (!userSearchQuery.trim()) return true;
            const q = userSearchQuery.trim().toLowerCase();
            const email = (p.email || '').toLowerCase();
            const name = ((p as any).name || (p as any).username || '').toLowerCase();
            const role = (p.role || '').toLowerCase();
            const orgName = (organizations.find(o => o.id === p.organization_id)?.name || (p as any).company || 'Unassigned').toLowerCase();
            return email.includes(q) || name.includes(q) || role.includes(q) || orgName.includes(q);
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
  const [newSeatsValue, setNewSeatsValue] = useState<number | ''>(5)
  const [showAddUserModalForOrg, setShowAddUserModalForOrg] = useState<boolean>(false)
  const [addUsersModalFilter, setAddUsersModalFilter] = useState<'unassigned' | 'all'>('unassigned')
  const [activeMemberMenuId, setActiveMemberMenuId] = useState<string | null>(null)
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null)
  const [activeOrgMenuId, setActiveOrgMenuId] = useState<string | null>(null)

  // User Sorting States with localStorage Persistence
  const [userSortField, setUserSortFieldState] = useState<'email' | 'username' | 'role' | 'organization' | 'created_at' | 'expires' | 'plan'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_user_sort_field');
      if (saved && ['email', 'username', 'role', 'organization', 'created_at', 'expires', 'plan'].includes(saved)) {
        return saved as any;
      }
    }
    return 'email';
  });

  const setUserSortField = (field: 'email' | 'username' | 'role' | 'organization' | 'created_at' | 'expires' | 'plan' | ((prev: any) => any)) => {
    setUserSortFieldState(prev => {
      const next = typeof field === 'function' ? field(prev) : field;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mep_user_sort_field', next);
      }
      return next;
    });
  };

  const [userSortOrder, setUserSortOrderState] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_user_sort_order');
      if (saved === 'asc' || saved === 'desc') return saved;
    }
    return 'asc';
  });

  const setUserSortOrder = (order: 'asc' | 'desc' | ((prev: any) => any)) => {
    setUserSortOrderState(prev => {
      const next = typeof order === 'function' ? order(prev) : order;
      if (typeof window !== 'undefined') {
        localStorage.setItem('mep_user_sort_order', next);
      }
      return next;
    });
  };

  const handleUpdateMaxSeats = async (orgId: string, newMaxInput: number | '') => {
    const newMax = typeof newMaxInput === 'number' ? newMaxInput : parseInt(String(newMaxInput), 10);
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

    const availableSeats = Math.max(0, maxUsers - currentMemberCount);

    if (currentMemberCount >= maxUsers) {
      toast.error(`Seat limit reached for "${targetOrgName}" (${currentMemberCount}/${maxUsers} Seats Used)! You cannot add more users. Please click "Edit Seats" to increase the seat limit first.`);
      return;
    }

    if (usersToAssignNotInOrg.length > availableSeats) {
      toast.error(`Cannot assign ${usersToAssignNotInOrg.length} user(s). "${targetOrgName}" has only ${availableSeats} seat(s) available (${currentMemberCount}/${maxUsers} Seats Used). Please click "Edit Seats" to increase the seat limit first.`);
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
      } catch (e) { }
      fetchOrganizations();
      fetchProfiles();
    }
  };

  const fetchOrganizations = async () => {
    if (organizations.length === 0) setLoadingOrganizations(true);
    try {
      const res = await api.getOrganizations();
      const list = Array.isArray(res) ? res : [];
      setOrganizations(list);

      // Restore selected organization view if saved in localStorage
      const savedOrgId = localStorage.getItem('mep_admin_selected_org_id');
      if (savedOrgId && list.length > 0) {
        const found = list.find((o: any) => o.id === savedOrgId);
        if (found) {
          setSelectedOrgForManagementState(found);
        }
      }
    } catch (e) {
      setOrganizations([]);
    } finally {
      setLoadingOrganizations(false);
    }
  };

  const generate25CharKey = (orgName: string) => {
    const clean = (orgName || 'ORG').replace(/[^a-zA-Z0-9]/g, '').substring(0, 4).toUpperCase().padEnd(4, 'X');
    const rand = (len: number) => Array.from({ length: len }, () => '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 36)]).join('');
    return `MEP-${clean}-${rand(4)}-${rand(4)}-${rand(4)}-${rand(4)}`;
  };

  const handleAddOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgName.trim()) return toast.error("Organization name is required");
    setIsAddingOrg(true);
    try {
      const isTrial = newOrgPlan === 'FREE_TRIAL';
      const autoKey = isTrial ? 'TRIAL-FREE' : generate25CharKey(newOrgName.trim());
      const res = await api.createOrganization({
        name: newOrgName.trim(),
        subscription_plan: newOrgPlan,
        max_users: newOrgUsers,
        license_key: autoKey
      });
      if (res && res.success) {
        if (isTrial) {
          toast.success(`Organization created under FREE_TRIAL! License key will form automatically when upgraded to PRO/ENTERPRISE plan.`);
        } else {
          toast.success(`Organization created with 25-char License Key: ${autoKey}`);
        }
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
    if (profiles.length === 0) setLoadingProfiles(true);
    const users = await api.getUsers();
    const userList = Array.isArray(users) ? users : [];

    // Map custom_users to the expected profiles shape
    const mappedProfiles = userList.map((u: any) => ({
      id: u.id,
      email: u.email,
      role: u.role || 'USER',
      username: u.username || u.name || (u.email ? u.email.split('@')[0] : ''),
      name: u.name || u.username || '',
      designation: u.designation || u.features?.designation || '',
      subscription_expires: u.subscription_expires || null,
      status: u.isAccountVerified ? 'ACTIVE' : 'TRIAL',
      plan: u.plan || u.subscription_status || u.features?.plan || u.features?.subscription_status || (u.organization_id ? 'ENTERPRISE' : 'PRO'),
      subscription_status: u.subscription_status || u.plan || u.features?.subscription_status || u.features?.plan || (u.organization_id ? 'ENTERPRISE' : 'PRO'),
      features: u.features || {},
      organization_id: u.organization_id
    }));

    setProfiles(mappedProfiles);
    setLoadingProfiles(false);
  };

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

    const designation = newRole === 'ORG_ADMIN' ? 'Organization Admin' : (newRole === 'SUPER_ADMIN' ? 'Super Admin' : newRole);

    // 1. INSTANT STATE UPDATE (0ms delay)
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole, designation } : p));
    toast.success(`Role updated to ${newRole}`);

    // 2. Async API update
    await api.adminToggleRole(profileId, newRole);
    await api.adminUpdateProfile(profileId, { role: newRole, designation });
  }

  const handlePlanChange = async (profileId: string, newPlan: string) => {
    const currentProfile = profiles.find(p => p.id === profileId);

    // 1. Instant optimistic state update
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, plan: newPlan, subscription_status: newPlan } : p));

    const displayLabel = newPlan === 'FREE_TRIAL' ? 'Free Trial' : (newPlan === 'ENTERPRISE' ? 'Enterprise' : 'Pro');
    toast.success(`Plan assigned: ${displayLabel}`);

    // 2. Async API update
    const res = await api.adminUpdateProfile(profileId, {
      plan: newPlan,
      subscription_status: newPlan,
      email: currentProfile?.email
    });

    if (!res.success) {
      toast.error("Failed to update plan: " + (res.message || 'Unknown error'));
      await fetchProfiles();
    } else {
      await fetchProfiles();
    }
  };

  const deleteUser = async (profileId: string, email: string) => {
    const currentId = userData?.id || profile?.id;
    const currentEmail = userData?.email || profile?.email;
    if (profileId === currentId || (email && currentEmail && email.toLowerCase() === currentEmail.toLowerCase())) {
      toast.error("You cannot delete your own account.");
      return;
    }
    const choice = await confirm(`Are you sure you want to delete ${email}?\n\nThey will permanently lose access to the application.`, { title: "Delete User", confirmText: "Delete", cancelText: "Cancel" });
    if (!choice) return;

    // 1. Instant optimistic UI removal (0ms delay)
    const pidLower = String(profileId || '').toLowerCase().trim();
    const emailLower = String(email || '').toLowerCase().trim();
    setProfiles(prev => prev.filter(p =>
      String(p.id).toLowerCase().trim() !== pidLower &&
      (p.email ? p.email.toLowerCase().trim() !== emailLower : true)
    ));
    setSelectedUserIds(prev => prev.filter(id => String(id).toLowerCase().trim() !== pidLower));
    toast.success("User deleted successfully");

    // 2. Real-time backend and DB deletion
    const res = await api.adminDeleteUser(profileId);
    if (!res.success) {
      toast.error(res.message || "Failed to delete user from database");
      fetchProfiles();
    } else {
      await fetchProfiles();
      await fetchOrganizations();
    }
  };

  const [signUpErrorDetails, setSignUpErrorDetails] = useState<string | null>(null)

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEmail || !newPassword) return
    setSignUpErrorDetails(null)
    setIsAddingUser(true)

    try {
      if (newOrgId) {
        const targetOrg = organizations.find((o: any) => o.id === newOrgId);
        if (targetOrg) {
          const maxUsers = targetOrg.max_users || 5;
          const currentMembers = profiles.filter(p => p.organization_id === newOrgId).length;
          if (currentMembers >= maxUsers) {
            toast.error(`Cannot assign to organization "${targetOrg.name}": maximum seat limit of ${maxUsers} reached (${currentMembers}/${maxUsers} Used). Please edit seats to increase capacity first.`);
            setIsAddingUser(false);
            return;
          }
        }
      }

      let dateStr: string | null = null;
      if (newExpiryDate) {
        const exp = new Date(newExpiryDate);
        exp.setHours(23, 59, 59, 999);
        dateStr = exp.toISOString();
      }

      const res = await api.adminCreateUser({
        name: newFullName || newEmail.split('@')[0],
        email: newEmail,
        password: newPassword,
        role: newRole,
        organization_id: newOrgId || null,
        company: newCompanyName || 'Tarv',
        designation: newRole,
        subscription_expires: dateStr
      });

      if (res.success) {
        toast.success("User created successfully!");
        setShowAddUserModal(false);
        setNewEmail("");
        setNewPassword("");
        setNewFullName("");
        setNewOrgId("");
        setNewExpiryDate("");
        fetchProfiles();
      } else {
        toast.error(res.message || "Failed to create user");
      }
    } catch (err: any) {
      toast.error(err.message || "Error creating user");
    } finally {
      setIsAddingUser(false);
    }
  }

  const getExpiryDisplay = (expStr?: string | null) => {
    if (!expStr) return <span className="text-slate-500 font-medium">Never (Lifetime)</span>;

    // Parse YYYY-MM-DD without UTC timezone rollover
    const cleanDatePart = expStr.split('T')[0];
    const parts = cleanDatePart.split('-').map(Number);
    let expDate: Date;
    if (parts.length === 3 && !parts.some(isNaN)) {
      expDate = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
    } else {
      expDate = new Date(expStr);
    }

    if (isNaN(expDate.getTime())) return <span className="text-slate-500 font-medium">Never</span>;

    const now = new Date();
    const diffMs = expDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    const dateFormatted = expDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

    if (diffDays < 0) {
      const pastDays = Math.abs(diffDays);
      return (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{dateFormatted}</span>
          <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
            ({pastDays}d ago)
          </span>
        </div>
      );
    } else if (diffDays === 0) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{dateFormatted}</span>
          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
            (Today)
          </span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs">{dateFormatted}</span>
          <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            ({diffDays}d left)
          </span>
        </div>
      );
    }
  };

  const formatLocalDateForInput = (expStr?: string | null) => {
    if (!expStr) return '';
    const cleanDatePart = expStr.split('T')[0];
    const parts = cleanDatePart.split('-');
    if (parts.length === 3) return cleanDatePart;
    const d = new Date(expStr);
    if (isNaN(d.getTime())) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const saveExpiry = async (profileId: string) => {
    let dateStr: string | null = null;
    if (newExpiryDate) {
      const cleanDate = newExpiryDate.split('T')[0];
      dateStr = `${cleanDate}T23:59:59.999Z`;
    }

    const currentProfile = profiles.find(p => p.id === profileId);

    // Optimistic UI update
    setProfiles(prevProfiles => prevProfiles.map(p =>
      p.id === profileId ? { ...p, subscription_expires: dateStr || '' } : p
    ));

    const res = await api.adminUpdateProfile(profileId, {
      subscription_expires: dateStr,
      email: currentProfile?.email
    });

    if (!res.success) {
      toast.error("Failed to update expiry: " + (res.message || 'Unknown error'));
      await fetchProfiles();
    } else {
      toast.success("Expiry date updated successfully!");
      setEditingExpiryFor(null);
      await fetchProfiles();
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

    // 1. Desktop Application (Tauri v2) - Native OS File/Folder Dialog
    const isDesktopApp = typeof window !== 'undefined' && !!(
      (window as any).__TAURI_INTERNALS__ ||
      (window as any).__TAURI__ ||
      (window as any).__TAURI_IPC__ ||
      window.location.protocol === 'tauri:' ||
      window.location.protocol === 'asset:'
    );

    if (isDesktopApp) {
      try {
        const { open: openFileDialog } = await import('@tauri-apps/plugin-dialog');
        const selected = await openFileDialog({
          directory: true,
          multiple: false,
          title,
          defaultPath: currentVal || undefined,
        });
        if (selected && typeof selected === 'string') {
          updatePathState(selected);
          return;
        } else if (selected === null) {
          return; // User cancelled
        }
      } catch (e) {
        console.warn("Tauri dialog error:", e);
      }
    }

    // 2. Try HTML5 File System Access API in Web Browsers (Chrome / Edge / Opera)
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const dirHandle = await (window as any).showDirectoryPicker();
        if (dirHandle && dirHandle.name) {
          const defaultSuggestion = currentVal
            ? `${currentVal.replace(/[/\\]+$/, '')}\\${dirHandle.name}`
            : type === 'local'
              ? `C:\\MEP_Calculator_Autosaves`
              : `Z:\\${dirHandle.name}`;

          const userConfirmedPath = window.prompt(
            `Selected folder name: "${dirHandle.name}"\n\nPlease confirm or enter the full shared network / disk path for your organization:`,
            defaultSuggestion
          );

          if (userConfirmedPath && userConfirmedPath.trim()) {
            updatePathState(userConfirmedPath.trim());
            return;
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return; // User cancelled
        console.warn("showDirectoryPicker error:", err);
      }
    }

    // 3. Prompt Fallback
    const promptSuggestion = currentVal || (type === 'local' ? 'C:\\MEP_Calculator_Autosaves' : type === 'server' ? 'Z:\\Backups' : 'Z:\\Versions');
    const inputPath = window.prompt(
      `Enter or paste the full directory path for ${title} (e.g., Z:\\Versions or \\\\server-m\\Versions):`,
      promptSuggestion
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
    } catch (e) { }

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
    <div className="h-screen max-h-screen bg-slate-50/60 dark:bg-slate-950 p-3 md:p-5 flex flex-col gap-3.5 overflow-hidden">
      {/* Compact, Modern Header Bar */}
      <div className="w-full flex items-center justify-between bg-white dark:bg-slate-900 px-4 py-2.5 rounded-xl shadow-xs border border-slate-200/80 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer"
            title="Back to Home"
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
      <div className="w-full flex-1 flex flex-col md:flex-row gap-3.5 items-stretch min-h-0 overflow-hidden">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-60 shrink-0 flex flex-col gap-1.5 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs h-fit md:h-full md:overflow-y-auto">
          <button
            onClick={() => setActiveTab('organizations')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'organizations'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
          >
            <div className="flex items-center gap-2.5">
              <Building size={16} />
              Organizations
            </div>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'users'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
          >
            <div className="flex items-center gap-2.5">
              <Users size={16} />
              User Access
            </div>
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'projects'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
          >
            <div className="flex items-center gap-2.5">
              <FolderOpen size={16} />
              Organization Projects
            </div>
          </button>
          <button
            onClick={() => setActiveTab('broadcasts')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'broadcasts'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
          >
            <div className="flex items-center gap-2.5">
              <Megaphone size={16} />
              Broadcasts
            </div>
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${activeTab === 'licenses'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
          >
            <div className="flex items-center gap-2.5">
              <Key size={16} />
              Key Manager & Licensing
            </div>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl shadow-xs overflow-hidden flex flex-col min-h-0">
          {activeTab === 'users' && (
            <div className="p-4 md:p-6 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Users by Organization</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Select an organization from the dropdown to view its members, organization admin representative, and seat usage.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={fetchProfiles}
                    className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition cursor-pointer"
                  >
                    Refresh
                  </button>
                  <button
                    onClick={() => setShowAddUser(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs transition-all cursor-pointer"
                  >
                    + Add User
                  </button>
                </div>
              </div>

              {/* Requirement: Organization Selector Dropdown, Universal Search & Sorting Options */}
              <div className="mb-4 p-3.5 md:p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3 md:gap-4 shadow-xs shrink-0">
                <div className="flex flex-col lg:flex-row lg:items-center gap-3 flex-1 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 shrink-0 flex items-center gap-1.5">
                      <Building size={16} className="text-blue-600" />
                      Organization:
                    </label>
                    <select
                      value={selectedOrgFilter}
                      onChange={(e) => setSelectedOrgFilter(e.target.value)}
                      className="text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 w-full shadow-xs cursor-pointer"
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

                  {/* UNIVERSAL SEARCH BAR & SEARCH BUTTON */}
                  <div className="flex items-center gap-1.5 lg:border-l border-slate-200 dark:border-slate-700 lg:pl-3">
                    <div className="relative flex items-center">
                      <Search size={14} className="absolute left-2.5 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && userSearchQuery.trim()) {
                            toast.info(`Filtered users matching "${userSearchQuery.trim()}"`, { duration: 1200 });
                          }
                        }}
                        placeholder="Search username, email, org..."
                        className="pl-8 pr-7 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none focus:border-blue-500 w-[190px] sm:w-[220px] transition"
                      />
                      {userSearchQuery && (
                        <button
                          onClick={() => setUserSearchQuery('')}
                          className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-0.5 cursor-pointer"
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        if (userSearchQuery.trim()) {
                          toast.info(`Filtered users matching "${userSearchQuery.trim()}"`, { duration: 1200 });
                        }
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0"
                      title="Search users across username, email, role, and organization"
                    >
                      <Search size={13} />
                      Search
                    </button>
                  </div>

                  {/* EXACT STATIC-WIDTH SINGLE BUTTON SORT BY CONTROL */}
                  <div className="flex items-center gap-2 lg:border-l border-slate-200 dark:border-slate-700 lg:pl-3">
                    <div className="relative inline-flex items-center w-[230px] shrink-0">
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs hover:border-slate-400 dark:hover:border-slate-600 transition cursor-pointer pointer-events-none w-[230px] shrink-0">
                        <div className="flex items-center gap-1.5 truncate">
                          <ArrowUpDown size={13} className="text-blue-600 shrink-0" />
                          <span className="text-slate-600 dark:text-slate-400 font-bold shrink-0">Sort By:</span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {userSortField === 'email' && (userSortOrder === 'asc' ? 'Email (A-Z ↑)' : 'Email (Z-A ↓)')}
                            {userSortField === 'username' && (userSortOrder === 'asc' ? 'Username (A-Z ↑)' : 'Username (Z-A ↓)')}
                            {userSortField === 'role' && (userSortOrder === 'asc' ? 'Role (High-Low ↑)' : 'Role (Low-High ↓)')}
                            {userSortField === 'organization' && (userSortOrder === 'asc' ? 'Org (A-Z ↑)' : 'Org (Z-A ↓)')}
                            {userSortField === 'plan' && (userSortOrder === 'asc' ? 'Plan (A-Z ↑)' : 'Plan (Z-A ↓)')}
                            {userSortField === 'created_at' && (userSortOrder === 'desc' ? 'Date (Newest ↓)' : 'Date (Oldest ↑)')}
                            {userSortField === 'expires' && (userSortOrder === 'asc' ? 'Expiry (Soonest ↑)' : 'Expiry (Latest ↓)')}
                          </span>
                        </div>
                        <ChevronDown size={13} className="text-slate-600 dark:text-slate-400 shrink-0" />
                      </div>
                      <select
                        value={`${userSortField}_${userSortOrder}`}
                        onChange={(e) => {
                          const [field, order] = e.target.value.split('_');
                          setUserSortField(field as any);
                          setUserSortOrder(order as any);
                        }}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      >
                        <option value="email_asc">Sort By: Email Address (A to Z ↑)</option>
                        <option value="email_desc">Sort By: Email Address (Z to A ↓)</option>
                        <option value="username_asc">Sort By: Username (A to Z ↑)</option>
                        <option value="username_desc">Sort By: Username (Z to A ↓)</option>
                        <option value="role_asc">Sort By: Role Priority (High to Low ↑)</option>
                        <option value="role_desc">Sort By: Role Priority (Low to High ↓)</option>
                        <option value="organization_asc">Sort By: Organization Name (A to Z ↑)</option>
                        <option value="organization_desc">Sort By: Organization Name (Z to A ↓)</option>
                        <option value="plan_asc">Sort By: Plan (A to Z ↑)</option>
                        <option value="plan_desc">Sort By: Plan (Z to A ↓)</option>
                        <option value="created_at_desc">Sort By: Creation Date (Newest First ↓)</option>
                        <option value="created_at_asc">Sort By: Creation Date (Oldest First ↑)</option>
                        <option value="expires_asc">Sort By: Subscription Expiry (Soonest First ↑)</option>
                        <option value="expires_desc">Sort By: Subscription Expiry (Latest First ↓)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-semibold text-slate-500 shrink-0 flex items-center gap-2">
                  <span>
                    Showing {profiles.filter(p => {
                      if (selectedOrgFilter === 'ALL') return true;
                      if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                      return p.organization_id === selectedOrgFilter;
                    }).filter(p => {
                      if (!userSearchQuery.trim()) return true;
                      const q = userSearchQuery.trim().toLowerCase();
                      const email = (p.email || '').toLowerCase();
                      const name = ((p as any).name || (p as any).username || '').toLowerCase();
                      const role = (p.role || '').toLowerCase();
                      const orgName = (organizations.find(o => o.id === p.organization_id)?.name || (p as any).company || 'Unassigned').toLowerCase();
                      return email.includes(q) || name.includes(q) || role.includes(q) || orgName.includes(q);
                    }).length} Users
                  </span>
                  {userSearchQuery && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer"
                      title="Reset Search"
                    >
                      (Clear Search)
                    </button>
                  )}
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
                  <div className="mb-4 p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="size-11 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                        {orgName.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900 dark:text-white">{orgName}</h3>
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            {currentOrg.subscription_plan || 'PRO PLAN'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span className="font-semibold text-blue-700 dark:text-blue-400">Organization Representative / Admin:</span>
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
                      <div className="bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/40 font-medium">
                        <span className="text-slate-500">Seats Used: </span>
                        <span className="font-bold text-blue-700 dark:text-blue-300">{currentOrgUsers.length}</span> / {currentOrg.max_users || 5} Max Seats
                      </div>
                    </div>
                  </div>
                );
              })()}

              {showAddUser && (
                <div className="mb-4 p-4 border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 rounded-xl shrink-0">
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
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 backdrop-blur-md text-white border border-blue-500/50 p-3 px-5 rounded-2xl shadow-2xl flex items-center justify-between gap-5 animate-in fade-in slide-in-from-bottom-6 duration-200 min-w-[650px] max-w-[90vw]">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-blue-600 text-xs font-bold shadow-xs whitespace-nowrap">
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
                      className="text-xs p-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold cursor-pointer min-w-[200px] focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Target Organization --</option>
                      {organizations.map(org => {
                        const memberCount = profiles.filter(p => p.organization_id === org.id).length;
                        const maxSeats = org.max_users || 5;
                        const isFull = memberCount >= maxSeats;
                        return (
                          <option key={org.id} value={org.id} disabled={isFull}>
                            {org.name} ({memberCount}/{maxSeats} seats{isFull ? ' - FULL' : ''})
                          </option>
                        );
                      })}
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

              <div className="flex-1 min-h-0 overflow-auto border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-850/95 backdrop-blur-xs z-10 shadow-2xs">
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/90">
                      <th className="py-3 px-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={(() => {
                            const orgAndSearchProfiles = profiles.filter(p => {
                              if (selectedOrgFilter === 'ALL') return true;
                              if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                              return p.organization_id === selectedOrgFilter;
                            }).filter(p => {
                              if (!userSearchQuery.trim()) return true;
                              const q = userSearchQuery.trim().toLowerCase();
                              const email = (p.email || '').toLowerCase();
                              const name = ((p as any).name || (p as any).username || '').toLowerCase();
                              const role = (p.role || '').toLowerCase();
                              const orgName = (organizations.find(o => o.id === p.organization_id)?.name || (p as any).company || 'Unassigned').toLowerCase();
                              return email.includes(q) || name.includes(q) || role.includes(q) || orgName.includes(q);
                            });
                            return orgAndSearchProfiles.length > 0 && orgAndSearchProfiles.every(p => selectedUserIds.includes(p.id));
                          })()}
                          onChange={(e) => {
                            const orgAndSearchProfiles = profiles.filter(p => {
                              if (selectedOrgFilter === 'ALL') return true;
                              if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                              return p.organization_id === selectedOrgFilter;
                            }).filter(p => {
                              if (!userSearchQuery.trim()) return true;
                              const q = userSearchQuery.trim().toLowerCase();
                              const email = (p.email || '').toLowerCase();
                              const name = ((p as any).name || (p as any).username || '').toLowerCase();
                              const role = (p.role || '').toLowerCase();
                              const orgName = (organizations.find(o => o.id === p.organization_id)?.name || (p as any).company || 'Unassigned').toLowerCase();
                              return email.includes(q) || name.includes(q) || role.includes(q) || orgName.includes(q);
                            });
                            if (e.target.checked) {
                              const ids = orgAndSearchProfiles.map(p => p.id);
                              setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...ids])));
                            } else {
                              const idSet = new Set(orgAndSearchProfiles.map(p => p.id));
                              setSelectedUserIds(selectedUserIds.filter(id => !idSet.has(id)));
                            }
                          }}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                          title="Select All Filtered Users"
                        />
                      </th>
                      <th
                        onClick={() => {
                          if (userSortField === 'email') setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setUserSortField('email'); setUserSortOrder('asc'); }
                        }}
                        className="py-3 px-3 font-semibold cursor-pointer hover:text-blue-600 select-none transition text-left"
                        title="Click to sort by Email"
                      >
                        <div className="flex items-center gap-1">
                          <span>Email</span>
                          <span className="text-xs text-blue-600 font-bold">{userSortField === 'email' ? (userSortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (userSortField === 'username') setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setUserSortField('username'); setUserSortOrder('asc'); }
                        }}
                        className="py-3 px-3 font-semibold cursor-pointer hover:text-blue-600 select-none transition text-left"
                        title="Click to sort by Username"
                      >
                        <div className="flex items-center gap-1">
                          <span>Username</span>
                          <span className="text-xs text-blue-600 font-bold">{userSortField === 'username' ? (userSortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (userSortField === 'role') setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setUserSortField('role'); setUserSortOrder('asc'); }
                        }}
                        className="py-3 px-3 font-semibold cursor-pointer hover:text-blue-600 select-none transition text-left"
                        title="Click to sort by Role Priority"
                      >
                        <div className="flex items-center justify-start gap-1">
                          <span>Role</span>
                          <span className="text-xs text-blue-600 font-bold">{userSortField === 'role' ? (userSortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (userSortField === 'organization') setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setUserSortField('organization'); setUserSortOrder('asc'); }
                        }}
                        className="py-3 px-3 font-semibold cursor-pointer hover:text-blue-600 select-none transition text-center"
                        title="Click to sort by Organization Name"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Organization</span>
                          <span className="text-xs text-blue-600 font-bold">{userSortField === 'organization' ? (userSortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (userSortField === 'plan') setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setUserSortField('plan'); setUserSortOrder('asc'); }
                        }}
                        className="py-3 px-3 font-semibold cursor-pointer hover:text-blue-600 select-none transition text-center"
                        title="Click to sort by Subscription Plan"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Plan</span>
                          <span className="text-xs text-blue-600 font-bold">{userSortField === 'plan' ? (userSortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </th>
                      <th
                        onClick={() => {
                          if (userSortField === 'expires') setUserSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          else { setUserSortField('expires'); setUserSortOrder('asc'); }
                        }}
                        className="py-3 px-3 font-semibold cursor-pointer hover:text-blue-600 select-none transition text-center w-[210px]"
                        title="Click to sort by Expiry Date"
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>Expires</span>
                          <span className="text-xs text-blue-600 font-bold">{userSortField === 'expires' ? (userSortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </th>
                      <th className="py-3 px-3 font-semibold text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loadingProfiles ? (
                      <tr><td colSpan={8} className="py-8 text-center text-slate-500">Loading...</td></tr>
                    ) : (() => {
                      const visibleProfiles = profiles.filter(p => {
                        if (selectedOrgFilter === 'ALL') return true;
                        if (selectedOrgFilter === 'UNASSIGNED') return !p.organization_id && p.role !== 'SUPER_ADMIN';
                        return p.organization_id === selectedOrgFilter;
                      }).filter(p => {
                        if (!userSearchQuery.trim()) return true;
                        const q = userSearchQuery.trim().toLowerCase();
                        const email = (p.email || '').toLowerCase();
                        const name = ((p as any).name || (p as any).username || '').toLowerCase();
                        const role = (p.role || '').toLowerCase();
                        const orgName = (organizations.find(o => o.id === p.organization_id)?.name || (p as any).company || 'Unassigned').toLowerCase();
                        const plan = (p.plan || p.subscription_status || '').toLowerCase();
                        return email.includes(q) || name.includes(q) || role.includes(q) || orgName.includes(q) || plan.includes(q);
                      }).sort((a, b) => {
                        let res = 0;
                        if (userSortField === 'email') {
                          res = (a.email || '').localeCompare(b.email || '');
                        } else if (userSortField === 'username') {
                          const nameA = a.username || (a as any).name || (a.email?.split('@')[0]) || '';
                          const nameB = b.username || (b as any).name || (b.email?.split('@')[0]) || '';
                          res = nameA.localeCompare(nameB);
                        } else if (userSortField === 'role') {
                          const rolePriority: Record<string, number> = { 'SUPER_ADMIN': 1, 'ORG_ADMIN': 2, 'ENGINEER': 3, 'USER': 4 };
                          const pA = rolePriority[a.role || ''] || 5;
                          const pB = rolePriority[b.role || ''] || 5;
                          res = pA - pB;
                        } else if (userSortField === 'organization') {
                          const nameA = organizations.find(o => o.id === a.organization_id)?.name || a.company || 'Unassigned';
                          const nameB = organizations.find(o => o.id === b.organization_id)?.name || b.company || 'Unassigned';
                          res = nameA.localeCompare(nameB);
                        } else if (userSortField === 'plan') {
                          const planA = a.plan || a.subscription_status || 'PRO';
                          const planB = b.plan || b.subscription_status || 'PRO';
                          res = planA.localeCompare(planB);
                        } else if (userSortField === 'created_at') {
                          const timeA = new Date((a as any).created_at || 0).getTime();
                          const timeB = new Date((b as any).created_at || 0).getTime();
                          res = timeA - timeB;
                        } else if (userSortField === 'expires') {
                          const expA = a.subscription_expires ? new Date(a.subscription_expires).getTime() : 9999999999999;
                          const expB = b.subscription_expires ? new Date(b.subscription_expires).getTime() : 9999999999999;
                          res = expA - expB;
                        }
                        return userSortOrder === 'asc' ? res : -res;
                      });

                      if (visibleProfiles.length === 0) {
                        return (
                          <tr>
                            <td colSpan={8} className="py-12 text-center text-slate-500">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Search size={24} className="text-slate-400 mb-1" />
                                <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                                  {userSearchQuery.trim()
                                    ? `No users found matching "${userSearchQuery.trim()}".`
                                    : 'No users found for this organization selection.'}
                                </p>
                                {userSearchQuery.trim() && (
                                  <button
                                    onClick={() => setUserSearchQuery('')}
                                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold cursor-pointer mt-1"
                                  >
                                    Clear search filter
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return visibleProfiles.map((p, idx) => (
                        <tr key={p.id} className={`border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors ${selectedUserIds.includes(p.id) ? 'bg-blue-50/70 dark:bg-blue-900/20' : ''}`}>
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
                              onChange={() => { }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                            />
                          </td>
                          {/* 1. Email */}
                          <td className="py-3.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-2">
                              <div className="size-7 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-extrabold flex items-center justify-center text-[11px] shrink-0 border border-blue-200 dark:border-blue-800">
                                {(p.email || 'U')[0].toUpperCase()}
                              </div>
                              <div className="flex items-center gap-1 min-w-0">
                                {p.role === 'ORG_ADMIN' && <Crown size={14} className="text-amber-500 shrink-0" title="Organization Admin Representative" />}
                                <span className="truncate text-xs font-semibold" title={p.email}>{p.email}</span>
                              </div>
                            </div>
                          </td>
                          {/* 2. Username */}
                          <td className="py-3.5 px-3 text-left">
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate block max-w-[140px]" title={p.username || p.name || p.email?.split('@')[0]}>
                              {p.username || p.name || p.email?.split('@')[0] || '—'}
                            </span>
                          </td>
                          {/* 3. Role */}
                          <td className="py-3.5 px-3 text-left">
                            {p.role === 'SUPER_ADMIN' ? (
                              <span className="inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-2xs">
                                <span>⚡</span>
                                <span>SUPER_ADMIN</span>
                              </span>
                            ) : p.role === 'ORG_ADMIN' ? (
                              <span className="inline-flex items-center justify-start gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/50 shadow-2xs">
                                <Crown size={12} className="text-amber-500 shrink-0" />
                                <span>ORG_ADMIN</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center justify-start px-2.5 py-1 rounded-lg text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50/70 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/60 shadow-2xs truncate max-w-[160px]" title={p.role || 'Design Engineer'}>
                                {p.role || 'Design Engineer'}
                              </span>
                            )}
                          </td>
                          {/* 4. Organization */}
                          <td className="py-3.5 px-3 text-center">
                            {p.role === 'SUPER_ADMIN' ? (
                              <span className="text-slate-400 text-xs italic">N/A</span>
                            ) : (
                              <select
                                value={p.organization_id || ''}
                                onChange={(e) => assignOrganization(p.id, e.target.value)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 max-w-[155px] truncate cursor-pointer font-medium text-slate-800 dark:text-slate-200 shadow-2xs outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="">No Organization</option>
                                {organizations.map(org => {
                                  const memberCount = profiles.filter(pr => pr.organization_id === org.id).length;
                                  const maxSeats = org.max_users || 5;
                                  const isFull = memberCount >= maxSeats;
                                  const isCurrentOrg = p.organization_id === org.id;
                                  return (
                                    <option
                                      key={org.id}
                                      value={org.id}
                                      disabled={isFull && !isCurrentOrg}
                                    >
                                      {org.name} {isFull && !isCurrentOrg ? `(FULL - ${memberCount}/${maxSeats})` : `(${memberCount}/${maxSeats})`}
                                    </option>
                                  );
                                })}
                              </select>
                            )}
                          </td>
                          {/* 5. Plan */}
                          <td className="py-3.5 px-3 text-center">
                            <select
                              value={p.plan || p.subscription_status || (p.organization_id ? 'ENTERPRISE' : 'PRO')}
                              onChange={(e) => handlePlanChange(p.id, e.target.value)}
                              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/90 cursor-pointer font-semibold text-slate-800 dark:text-slate-200 shadow-2xs outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="FREE_TRIAL">🎁 Free Trial</option>
                              <option value="PRO">⭐ Pro</option>
                              <option value="ENTERPRISE">🚀 Enterprise</option>
                            </select>
                          </td>
                          {/* 6. Expires */}
                          <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap text-center w-[210px]">
                            {editingExpiryFor === p.id ? (
                              <div className="flex items-center justify-center gap-1.5 w-[195px] mx-auto">
                                <input
                                  type="date"
                                  value={newExpiryDate.split('T')[0]}
                                  onChange={(e) => setNewExpiryDate(e.target.value)}
                                  className="px-2 py-1 border border-slate-300 dark:border-slate-700 focus:border-blue-500 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none w-[120px] shrink-0 font-mono shadow-2xs"
                                />
                                <button
                                  onClick={() => saveExpiry(p.id)}
                                  className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition cursor-pointer shrink-0 shadow-2xs"
                                  title="Save Date"
                                >
                                  <Check size={13} />
                                </button>
                                <button
                                  onClick={() => setEditingExpiryFor(null)}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition shrink-0 cursor-pointer"
                                  title="Cancel"
                                >
                                  <X size={13} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 w-[195px] mx-auto">
                                <div className="flex-1 truncate text-left">
                                  {getExpiryDisplay(p.subscription_expires)}
                                </div>
                                <button
                                  onClick={() => {
                                    setEditingExpiryFor(p.id);
                                    setNewExpiryDate(formatLocalDateForInput(p.subscription_expires));
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition cursor-pointer shrink-0"
                                  title="Edit Expiry Date"
                                >
                                  <Edit3 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                          {/* 7. Actions */}
                          <td className="py-3.5 px-3 text-center relative whitespace-nowrap">
                            <div className="inline-block text-left relative">
                              <button
                                type="button"
                                onClick={() => setActiveUserMenuId(activeUserMenuId === p.id ? null : p.id)}
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${activeUserMenuId === p.id
                                  ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/60 dark:border-blue-800'
                                  : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                  }`}
                                title="User Actions"
                              >
                                <MoreVertical size={16} />
                              </button>

                              {activeUserMenuId === p.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-30"
                                    onClick={() => setActiveUserMenuId(null)}
                                  />
                                  <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in-50 zoom-in-95 text-left">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveUserMenuId(null);
                                        setEditingPermissionsFor(p);
                                      }}
                                      className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <ShieldAlert size={15} className="text-blue-600 dark:text-blue-400" />
                                      <span>Permissions</span>
                                    </button>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveUserMenuId(null);
                                        deleteUser(p.id, p.email);
                                      }}
                                      className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
                                    >
                                      <Trash2 size={15} className="text-red-500" />
                                      <span>Delete User</span>
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
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
            <div className={`p-4 md:p-6 flex-1 min-h-0 ${selectedOrgForManagement ? 'flex flex-col overflow-hidden' : 'space-y-6 overflow-y-auto'}`}>
              {selectedOrgForManagement ? (
                <div className="flex-1 flex flex-col min-h-0 gap-4 overflow-hidden animate-fade-in">
                  {/* Organization Manager Header */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
                    <div className="flex items-center gap-3.5">
                      <button
                        onClick={() => {
                          setSelectedOrgForManagement(null);
                          setEditingSeatsForOrg(false);
                        }}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
                        title="Back to Organizations List"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <div>
                        <div className="flex items-center gap-3 flex-wrap">
                          {editingOrgId === selectedOrgForManagement.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editedOrgName}
                                onChange={(e) => setEditedOrgName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveOrgName(selectedOrgForManagement.id, editedOrgName);
                                  if (e.key === 'Escape') setEditingOrgId(null);
                                }}
                                autoFocus
                                className="px-3 py-1 text-sm font-extrabold bg-white dark:bg-slate-900 border border-blue-500 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveOrgName(selectedOrgForManagement.id, editedOrgName)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-2xs"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingOrgId(null)}
                                className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                {(selectedOrgForManagement.name === 'Consitent' || selectedOrgForManagement.name === 'Consistent')
                                  ? 'Consistent Engineering Consultants'
                                  : selectedOrgForManagement.name}
                              </h2>
                              <button
                                type="button"
                                onClick={() => {
                                  const currentName = (selectedOrgForManagement.name === 'Consitent' || selectedOrgForManagement.name === 'Consistent')
                                    ? 'Consistent Engineering Consultants'
                                    : selectedOrgForManagement.name;
                                  setEditedOrgName(currentName);
                                  setEditingOrgId(selectedOrgForManagement.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition cursor-pointer"
                                title="Edit Organization Name"
                              >
                                <Edit3 size={16} />
                              </button>
                            </div>
                          )}
                          {selectedOrgForManagement.subscription_plan === 'FREE_TRIAL' ? (
                            <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800 uppercase tracking-wider shadow-2xs">
                              🎁 FREE TRIAL
                            </span>
                          ) : selectedOrgForManagement.subscription_plan === 'ENTERPRISE' ? (
                            <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 uppercase tracking-wider shadow-2xs">
                              🚀 ENTERPRISE PLAN
                            </span>
                          ) : (
                            <span className="px-3 py-0.5 rounded-full text-xs font-extrabold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900 uppercase tracking-wider shadow-2xs">
                              ⭐ PRO PLAN
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Manage organization members, assign available users, or change subscription tier.
                        </p>
                      </div>
                    </div>

                    {/* HEADER CONTROLS BAR: Plan Selector, Seats Display & + Add Users */}
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      {/* Elegant Plan Selector Pill */}
                      <div className="flex items-center gap-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 px-3.5 py-2 rounded-xl shadow-2xs">
                        <span className="text-xs font-extrabold uppercase text-blue-700 dark:text-blue-300 shrink-0">
                          Subscription:
                        </span>
                        <select
                          value={selectedOrgForManagement.subscription_plan || 'PRO'}
                          onChange={async (e) => {
                            const newPlan = e.target.value;
                            let newKey = selectedOrgForManagement.license_key;
                            if (newPlan !== 'FREE_TRIAL' && (!newKey || newKey === 'TRIAL-FREE' || newKey === 'MEP-LIC-ORG-PRO' || newKey.length < 25)) {
                              newKey = generate25CharKey(selectedOrgForManagement.name);
                            }
                            try {
                              await api.updateOrganization({
                                orgId: selectedOrgForManagement.id,
                                subscription_plan: newPlan,
                                license_key: newKey
                              });
                              setSelectedOrgForManagement((prev: any) => ({ ...prev, subscription_plan: newPlan, license_key: newKey }));
                              setOrganizations(prev => prev.map(o => o.id === selectedOrgForManagement.id ? { ...o, subscription_plan: newPlan, license_key: newKey } : o));
                              if (newPlan !== 'FREE_TRIAL') {
                                toast.success(`Plan updated to ${newPlan}! 25-char License Key generated: ${newKey}`);
                              } else {
                                toast.info(`Organization plan updated to FREE_TRIAL`);
                              }
                            } catch (err) {
                              toast.error("Failed to update organization plan");
                            }
                          }}
                          className="text-xs font-bold bg-transparent text-blue-900 dark:text-blue-200 outline-none cursor-pointer"
                        >
                          <option value="FREE_TRIAL" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🎁 FREE_TRIAL (7-Day)</option>
                          <option value="PRO" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">⭐ PRO PLAN</option>
                          <option value="ENTERPRISE" className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">🚀 ENTERPRISE PLAN</option>
                        </select>
                      </div>

                      {/* Editable Seats Allocation Display */}
                      {editingSeatsForOrg ? (
                        <div className="flex items-center gap-2 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-800 p-1.5 rounded-xl shadow-2xs">
                          <span className="text-xs font-bold text-blue-900 dark:text-blue-200 pl-1">Max Seats:</span>
                          <input
                            type="number"
                            min={1}
                            value={newSeatsValue}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '') setNewSeatsValue('');
                              else {
                                const parsed = parseInt(val, 10);
                                setNewSeatsValue(isNaN(parsed) ? '' : parsed);
                              }
                            }}
                            className="w-16 px-2 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => handleUpdateMaxSeats(selectedOrgForManagement.id, newSeatsValue)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-xs"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingSeatsForOrg(false)}
                            className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (() => {
                        const memberCount = profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length;
                        const maxSeats = selectedOrgForManagement.max_users || 5;
                        const pct = Math.min(100, Math.round((memberCount / maxSeats) * 100));
                        const isOver = memberCount > maxSeats;
                        const isFull = memberCount >= maxSeats;
                        const remainingSeats = Math.max(0, maxSeats - memberCount);

                        return (
                          <div className="flex items-center gap-3 border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 px-3.5 py-2 rounded-xl shadow-2xs">
                            <div className="flex items-center gap-2.5">
                              <Users size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
                              <div className="flex items-center gap-2">
                                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                  <span className="text-blue-700 dark:text-blue-300 font-extrabold">{memberCount}</span>
                                  <span className="text-slate-400 font-normal"> / </span>
                                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{maxSeats} Seats Used</span>
                                </div>
                                <div className="w-16 h-2 bg-blue-100 dark:bg-blue-900/50 rounded-full overflow-hidden shrink-0 hidden sm:block">
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${isOver ? 'bg-red-500' : isFull ? 'bg-amber-500' : 'bg-blue-600'}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {isOver ? (
                                  <span className="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300 font-extrabold text-[10px] uppercase border border-red-300 dark:border-red-800/60">
                                    +{memberCount - maxSeats} Over Limit
                                  </span>
                                ) : isFull ? (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-extrabold text-[10px] uppercase border border-amber-300 dark:border-amber-800/60">
                                    Capacity Full
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] uppercase border border-emerald-200 dark:border-emerald-800/60">
                                    {remainingSeats} Available
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setNewSeatsValue(selectedOrgForManagement.max_users || 5);
                                setEditingSeatsForOrg(true);
                              }}
                              className="px-2.5 py-1 bg-white hover:bg-blue-50 text-blue-700 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800 text-[11px] font-bold rounded-lg border border-blue-200 dark:border-blue-800 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Increase or edit member seat limit"
                            >
                              <Edit3 size={12} />
                              <span>Edit Seats</span>
                            </button>
                          </div>
                        );
                      })()}

                      {/* + Add Users Modal Button */}
                      {(() => {
                        const memberCount = profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length;
                        const maxSeats = selectedOrgForManagement.max_users || 5;
                        const isFull = memberCount >= maxSeats;
                        const isOver = memberCount > maxSeats;
                        const remainingSeats = Math.max(0, maxSeats - memberCount);

                        return (
                          <button
                            disabled={isFull}
                            onClick={() => {
                              if (isFull) {
                                toast.error(`Seat limit reached for "${selectedOrgForManagement.name}" (${memberCount}/${maxSeats} Seats Used). Please click "Edit Seats" to increase the seat limit.`);
                                return;
                              }
                              setSelectedUserIds([]);
                              setShowAddUserModalForOrg(true);
                            }}
                            className={`px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 ${isFull
                              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300/80 dark:border-slate-700/80'
                              : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                              }`}
                            title={isFull ? `Seat limit full (${memberCount}/${maxSeats} Used). Click "Edit Seats" to increase limit.` : `Add users (${remainingSeats} seats available)`}
                          >
                            <UserPlus size={15} />
                            <span>{isOver ? `Over Seat Limit (${memberCount}/${maxSeats})` : isFull ? `Seat Limit Full (${maxSeats}/${maxSeats})` : `+ Add Users (${remainingSeats} left)`}</span>
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Exceeded seat limit warning banner */}
                  {(() => {
                    const memberCount = profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length;
                    const maxSeats = selectedOrgForManagement.max_users || 5;
                    if (memberCount <= maxSeats) return null;
                    return (
                      <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex items-center gap-2.5 text-red-700 dark:text-red-300 shrink-0 shadow-2xs">
                        <AlertCircle size={16} className="text-red-600 shrink-0" />
                        <div className="flex-1">
                          <span className="font-extrabold uppercase tracking-wide">⚠️ Seat Limit Exceeded:</span> This organization currently has <strong className="font-extrabold">{memberCount}</strong> members against a configured limit of <strong className="font-extrabold">{maxSeats}</strong> seats ({memberCount - maxSeats} over limit). New members cannot enter until you unassign surplus members or click <button type="button" className="underline font-bold hover:text-red-900 dark:hover:text-red-200 cursor-pointer" onClick={() => { setNewSeatsValue(memberCount); setEditingSeatsForOrg(true); }}>Edit Seats</button> to increase capacity to at least {memberCount}.
                        </div>
                      </div>
                    );
                  })()}

                  {/* Organization License Key String (READ ONLY) */}
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="size-9 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-900/50">
                        <Key size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-extrabold uppercase text-slate-700 dark:text-slate-300">Assigned License Key String:</span>
                          {selectedOrgForManagement.subscription_plan === 'FREE_TRIAL' || selectedOrgForManagement.license_key === 'TRIAL-FREE' ? (
                            <span className="font-mono font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-3 py-1 rounded-lg text-xs tracking-wider shadow-2xs">
                              🎁 FREE TRIAL ACTIVE (Upgrade plan to PRO/ENTERPRISE to form key)
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 px-3 py-1 rounded-lg text-xs tracking-wider shadow-2xs">
                                {selectedOrgForManagement.license_key && selectedOrgForManagement.license_key !== "MEP-LIC-ORG-PRO" && selectedOrgForManagement.license_key !== "TRIAL-FREE"
                                  ? selectedOrgForManagement.license_key
                                  : "MEP-CONS-8F92-4A7B-9021-X9K3"}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const keyToCopy = (selectedOrgForManagement.license_key && selectedOrgForManagement.license_key !== "MEP-LIC-ORG-PRO" && selectedOrgForManagement.license_key !== "TRIAL-FREE")
                                    ? selectedOrgForManagement.license_key
                                    : "MEP-CONS-8F92-4A7B-9021-X9K3";
                                  navigator.clipboard.writeText(keyToCopy);
                                  toast.success("License Key copied! Send this key to users to enter in their activation box.");
                                }}
                                className="px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 text-[11px] font-bold rounded-lg border border-blue-200 dark:border-blue-800 transition cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="Copy 25-character License Key string"
                              >
                                <Copy size={12} />
                                <span>Copy Key</span>
                              </button>
                            </div>
                          )}
                        </div>
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

                        {/* Search Bar & Capacity Indicator */}
                        {(() => {
                          const memberCount = profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length;
                          const maxSeats = selectedOrgForManagement.max_users || 5;
                          const remainingSeats = Math.max(0, maxSeats - memberCount);
                          const isFull = memberCount >= maxSeats;

                          return (
                            <>
                              {isFull && (
                                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl text-xs flex items-center gap-2 text-red-700 dark:text-red-300">
                                  <AlertCircle size={16} className="text-red-600 shrink-0" />
                                  <span><strong>Seat Limit Reached:</strong> Organization has reached its limit of {maxSeats} seats ({memberCount}/{maxSeats} Used). You cannot add more members until seats are increased or existing members are removed.</span>
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                                <div className="relative flex-1">
                                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                  <input
                                    type="text"
                                    placeholder="Search unassigned users by email or role..."
                                    value={userSearchQuery}
                                    onChange={(e) => setUserSearchQuery(e.target.value)}
                                    className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white w-full outline-none focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${isFull
                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                                    }`}>
                                    {remainingSeats} Seat{remainingSeats === 1 ? '' : 's'} Remaining
                                  </span>
                                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                    ({memberCount}/{maxSeats} Used)
                                  </span>
                                </div>
                              </div>
                            </>
                          );
                        })()}

                        {/* Multi-Select Grid (STRICTLY UNASSIGNED USERS ONLY) */}
                        <div className="flex-1 overflow-y-auto max-h-[48vh] pr-1 space-y-2">
                          {(() => {
                            const memberCount = profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length;
                            const maxSeats = selectedOrgForManagement.max_users || 5;
                            const remainingSeats = Math.max(0, maxSeats - memberCount);
                            const isFull = memberCount >= maxSeats;

                            const availableUsers = profiles.filter(p => {
                              if (p.role === 'SUPER_ADMIN') return false;

                              // Strictly users not assigned to any organization
                              const isUnassigned = !p.organization_id ||
                                p.organization_id === '' ||
                                p.organization_id === 'UNASSIGNED' ||
                                p.organization_id === 'No Organization' ||
                                p.organization_id === 'null' ||
                                !p.company ||
                                p.company === '' ||
                                p.company === 'No Organization';

                              if (!isUnassigned) return false;

                              if (userSearchQuery) {
                                const q = userSearchQuery.toLowerCase();
                                return p.email.toLowerCase().includes(q) || p.role?.toLowerCase().includes(q);
                              }
                              return true;
                            });

                            const selectableCount = Math.min(availableUsers.length, remainingSeats);
                            const allAvailableSelected = selectableCount > 0 && availableUsers.slice(0, selectableCount).every(u => selectedUserIds.includes(u.id));

                            if (availableUsers.length === 0) {
                              return (
                                <div className="py-8 text-center space-y-2">
                                  <p className="text-xs text-slate-500 italic">
                                    {userSearchQuery
                                      ? "No matching unassigned users found."
                                      : "There are currently no unassigned users. All registered users are assigned to an organization."
                                    }
                                  </p>
                                </div>
                              );
                            }

                            return (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200">
                                  <label className={`flex items-center gap-2 select-none ${isFull ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}>
                                    <input
                                      type="checkbox"
                                      disabled={isFull || remainingSeats <= 0}
                                      checked={allAvailableSelected}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          if (remainingSeats <= 0) {
                                            toast.error("Cannot select users: organization has reached its seat limit.");
                                            return;
                                          }
                                          const toSelect = availableUsers.slice(0, remainingSeats).map(u => u.id);
                                          setSelectedUserIds(toSelect);
                                          if (availableUsers.length > remainingSeats) {
                                            toast.info(`Selected the first ${remainingSeats} available user(s) to match seat capacity.`);
                                          }
                                        } else {
                                          setSelectedUserIds([]);
                                        }
                                      }}
                                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                    />
                                    <span>
                                      Select Available Users ({remainingSeats > 0 ? `up to ${remainingSeats} seat${remainingSeats === 1 ? '' : 's'}` : 'Limit Full'})
                                    </span>
                                  </label>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    {selectedUserIds.length} / {remainingSeats} selected
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                  {availableUsers.map(u => {
                                    const isSelected = selectedUserIds.includes(u.id);
                                    const canSelectMore = selectedUserIds.length < remainingSeats;
                                    const isDisabled = !isSelected && (!canSelectMore || isFull);

                                    return (
                                      <div
                                        key={u.id}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedUserIds(prev => prev.filter(id => id !== u.id));
                                          } else {
                                            if (isFull || remainingSeats <= 0) {
                                              toast.error(`Seat limit reached for "${selectedOrgForManagement.name}" (${memberCount}/${maxSeats} Used).`);
                                              return;
                                            }
                                            if (!canSelectMore) {
                                              toast.error(`Cannot select more than ${remainingSeats} user(s). The organization has only ${remainingSeats} seat(s) remaining.`);
                                              return;
                                            }
                                            setSelectedUserIds(prev => [...prev, u.id]);
                                          }
                                        }}
                                        className={`p-3 rounded-xl border text-xs flex items-center justify-between transition-all ${isSelected
                                          ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 font-semibold text-blue-900 dark:text-blue-200 shadow-xs cursor-pointer'
                                          : isDisabled
                                            ? 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-400 opacity-60 cursor-not-allowed'
                                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 cursor-pointer'
                                          }`}
                                      >
                                        <div className="flex items-center gap-2.5 truncate">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            disabled={isDisabled}
                                            onChange={() => { }}
                                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                          />
                                          <div className="truncate">
                                            <p className="font-semibold truncate text-slate-900 dark:text-white">{u.email}</p>
                                            <p className="text-[10px] text-slate-500 truncate">
                                              {u.role} • Unassigned
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
                  <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2.5 flex items-center gap-2 shrink-0">
                      <Users size={16} className="text-blue-600 dark:text-blue-400" />
                      Current Organization Members ({profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length})
                    </h3>

                    <div className="flex-1 min-h-0 overflow-auto border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-850/95 backdrop-blur-xs z-10 shadow-2xs">
                          <tr className="bg-slate-50 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-800 text-[11px] font-extrabold tracking-wider text-slate-500 uppercase">
                            <th className="py-3 px-4">User Email</th>
                            <th className="py-3 px-4">Role</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="text-xs divide-y divide-slate-100 dark:divide-slate-800">
                          {profiles.filter(p => p.organization_id === selectedOrgForManagement.id).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                                No members in this organization yet. Select an existing user above to add them!
                              </td>
                            </tr>
                          ) : (
                            profiles
                              .filter(p => p.organization_id === selectedOrgForManagement.id)
                              .map(user => (
                                <tr key={user.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                    {user.role === 'ORG_ADMIN' && <Crown size={15} className="text-amber-500 shrink-0" title="Organization Admin Representative" />}
                                    <span>{user.email}</span>
                                  </td>
                                  <td className="py-3 px-4">
                                    <select
                                      value={user.role || 'Design Engineer'}
                                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                      className="text-xs p-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white cursor-pointer shadow-2xs focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 max-w-[180px] outline-none"
                                    >
                                      <option value="SUPER_ADMIN">⚡ SUPER_ADMIN</option>
                                      <option value="ORG_ADMIN">👑 ORG_ADMIN</option>
                                      <option value="Lead Project Manager">Lead Project Manager</option>
                                      <option value="Project Manager">Project Manager</option>
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
                                  <td className="py-3 px-4 text-right relative">
                                    <div className="inline-block text-left relative">
                                      <button
                                        type="button"
                                        onClick={() => setActiveMemberMenuId(activeMemberMenuId === user.id ? null : user.id)}
                                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${activeMemberMenuId === user.id
                                          ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/60 dark:border-blue-800'
                                          : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                          }`}
                                        title="More Options"
                                      >
                                        <MoreVertical size={16} />
                                      </button>

                                      {activeMemberMenuId === user.id && (
                                        <>
                                          <div
                                            className="fixed inset-0 z-30"
                                            onClick={() => setActiveMemberMenuId(null)}
                                          />
                                          <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in-50 zoom-in-95 text-left">
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                setActiveMemberMenuId(null);
                                                await assignOrganization(user.id, '');
                                                toast.info(`Removed ${user.email} from ${selectedOrgForManagement.name}`);
                                              }}
                                              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                              <UserMinus size={15} className="text-slate-400" />
                                              <span>Remove from Organization</span>
                                            </button>
                                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveMemberMenuId(null);
                                                deleteUser(user.id, user.email);
                                              }}
                                              className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
                                            >
                                              <Trash2 size={15} className="text-red-500" />
                                              <span>Delete User</span>
                                            </button>
                                          </div>
                                        </>
                                      )}
                                    </div>
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
                    <div>
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Manage Organizations</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        View and configure registered organizations, subscription tiers, and member allocations.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setShowAddOrg(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={15} /> Create Organization
                      </button>
                    </div>
                  </div>

                  {showAddOrg && (
                    <div className="mb-6 p-5 border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl animate-fade-in">
                      <h3 className="text-sm font-semibold mb-3 text-slate-900 dark:text-white">Create New Organization</h3>
                      <form onSubmit={handleAddOrg} className="flex flex-wrap items-end gap-3">
                        <div className="flex-1 min-w-[200px]">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Org Name</label>
                          <input
                            type="text"
                            required
                            value={newOrgName}
                            onChange={(e) => setNewOrgName(e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <div className="w-32">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Plan</label>
                          <select
                            value={newOrgPlan}
                            onChange={(e) => setNewOrgPlan(e.target.value)}
                            className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          >
                            <option value="FREE_TRIAL">🎁 FREE_TRIAL (7-Day Trial)</option>
                            <option value="PRO">⭐ PRO</option>
                            <option value="ENTERPRISE">🚀 ENTERPRISE</option>
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
                            className="w-full text-sm p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isAddingOrg}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                        >
                          {isAddingOrg ? 'Creating...' : 'Create'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowAddOrg(false)}
                          className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-medium hover:bg-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </form>
                    </div>
                  )}

                  <div className="overflow-auto border border-slate-200/80 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-2xs min-h-[260px] pb-12">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-850/95 backdrop-blur-xs z-10 shadow-2xs">
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/90">
                          <th className="py-3 px-4 font-semibold">Name</th>
                          <th className="py-3 px-4 font-semibold">Plan</th>
                          <th className="py-3 px-4 font-semibold">Licenses / Seats</th>
                          <th className="py-3 px-4 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="text-sm">
                        {loadingOrganizations ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-500">Loading...</td></tr>
                        ) : organizations.length === 0 ? (
                          <tr><td colSpan={4} className="py-8 text-center text-slate-500">No organizations found.</td></tr>
                        ) : (
                          organizations.map((org, idx) => {
                            const memberCount = profiles.filter(p => p.organization_id === org.id).length;
                            const isNearBottom = idx >= organizations.length - 2 && organizations.length > 2;
                            return (
                              <tr
                                key={org.id}
                                onClick={() => {
                                  if (editingOrgId !== org.id) {
                                    setSelectedOrgForManagement(org);
                                  }
                                }}
                                className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer group"
                                title="Click to view and manage organization"
                              >
                                <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                                  {editingOrgId === org.id ? (
                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        value={editedOrgName}
                                        onChange={(e) => setEditedOrgName(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveOrgName(org.id, editedOrgName);
                                          if (e.key === 'Escape') setEditingOrgId(null);
                                        }}
                                        autoFocus
                                        className="px-2.5 py-1 text-xs font-bold bg-white dark:bg-slate-900 border border-blue-500 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSaveOrgName(org.id, editedOrgName);
                                        }}
                                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition cursor-pointer shadow-2xs"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditingOrgId(null);
                                        }}
                                        className="px-2 py-1 text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group">
                                      <span
                                        className="group-hover:text-blue-600 dark:group-hover:text-blue-400 flex items-center gap-1.5 transition-colors"
                                      >
                                        🏢 {(org.name === 'Consitent' || org.name === 'Consistent') ? 'Consistent Engineering Consultants' : org.name}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const nameToUse = (org.name === 'Consitent' || org.name === 'Consistent') ? 'Consistent Engineering Consultants' : org.name;
                                          setEditedOrgName(nameToUse);
                                          setEditingOrgId(org.id);
                                        }}
                                        className="p-1 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/40 transition opacity-0 group-hover:opacity-100 cursor-pointer"
                                        title="Edit Organization Name"
                                      >
                                        <Edit3 size={13} />
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="py-3.5 px-4">
                                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800">
                                    {org.subscription_plan}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                                  <div className="flex items-center gap-2">
                                    <span>{memberCount} / {org.max_users || 10} Members</span>
                                    <div className="w-16 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                                      <div
                                        className={`h-full rounded-full ${memberCount > (org.max_users || 10) ? 'bg-amber-500' : 'bg-blue-600'}`}
                                        style={{ width: `${Math.min(100, (memberCount / (org.max_users || 10)) * 100)}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3.5 px-4 text-right relative whitespace-nowrap">
                                  <div className="inline-block text-left relative">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveOrgMenuId(activeOrgMenuId === org.id ? null : org.id);
                                      }}
                                      className={`p-1.5 rounded-lg border transition-all cursor-pointer ${activeOrgMenuId === org.id
                                        ? 'bg-blue-50 border-blue-300 text-blue-600 dark:bg-blue-950/60 dark:border-blue-800'
                                        : 'border-transparent hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                        }`}
                                      title="Organization Actions"
                                    >
                                      <MoreVertical size={16} />
                                    </button>

                                    {activeOrgMenuId === org.id && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-30"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveOrgMenuId(null);
                                          }}
                                        />
                                        <div
                                          onClick={(e) => e.stopPropagation()}
                                          className={`absolute right-0 ${isNearBottom ? 'bottom-full mb-1' : 'top-full mt-1'} w-52 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-40 py-1 overflow-hidden animate-in fade-in-50 zoom-in-95 text-left`}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveOrgMenuId(null);
                                              setSelectedOrgForManagement(org);
                                            }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                          >
                                            <Users size={15} className="text-blue-600 dark:text-blue-400" />
                                            <span>Manage Members ({memberCount})</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveOrgMenuId(null);
                                              const nameToUse = (org.name === 'Consitent' || org.name === 'Consistent') ? 'Consistent Engineering Consultants' : org.name;
                                              setEditedOrgName(nameToUse);
                                              setEditingOrgId(org.id);
                                            }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                                          >
                                            <Edit3 size={15} className="text-slate-400" />
                                            <span>Rename Organization</span>
                                          </button>
                                          <div className="h-px bg-slate-100 dark:bg-slate-800 my-0.5" />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveOrgMenuId(null);
                                              deleteOrganization(org.id, org.name);
                                            }}
                                            className="w-full text-left px-3.5 py-2.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors cursor-pointer"
                                          >
                                            <Trash2 size={15} className="text-red-500" />
                                            <span>Delete Organization</span>
                                          </button>
                                        </div>
                                      </>
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
                </>
              )}
            </div>
          )}

          {activeTab === 'broadcasts' && (
            <div className="p-4 md:p-6 space-y-6 flex-1 overflow-y-auto min-h-0">
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
                    <div key={ann.id} className={`p-4 rounded-xl border flex items-center justify-between ${ann.is_active
                      ? 'border-blue-200 bg-blue-50 dark:border-blue-800/30 dark:bg-blue-900/20'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/30 opacity-75'
                      }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full ${ann.type === 'warning' ? 'bg-amber-100 text-amber-800' :
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
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Fixed / Constant Top Section: Header, Org Selection & Filter Controls */}
              <div className="p-4 md:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-4 shrink-0 bg-white dark:bg-slate-900 z-10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FolderOpen className="text-blue-600 dark:text-blue-400" size={24} />
                      Organization Projects & Workspaces
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={fetchAllProjects}
                      className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition shadow-2xs cursor-pointer"
                    >
                      Refresh Projects List
                    </button>
                  </div>
                </div>

                {/* Organization Selection Cards Grid */}
                <div>
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">
                    Select Organization ({organizations.length} Registered Organizations)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 max-h-[190px] overflow-y-auto pr-1">
                    {/* ALL ORGANIZATIONS CARD */}
                    <button
                      onClick={() => setSelectedOrgForProjects('ALL')}
                      className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${selectedOrgForProjects === 'ALL'
                        ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-800'
                        }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="size-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                          ALL
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
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
                          className={`p-4 rounded-xl border text-left transition-all cursor-pointer shadow-2xs flex flex-col justify-between ${selectedOrgForProjects === org.id
                            ? 'border-blue-600 bg-blue-50/80 dark:bg-blue-900/30 ring-2 ring-blue-500/20'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-800'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="size-9 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                              {(org.name || 'OR').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                              {orgProjects.length} Project{orgProjects.length === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="mt-3">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-extrabold text-slate-900 dark:text-white truncate">{org.name}</h4>
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200 dark:bg-slate-700 dark:text-slate-300">
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search projects by name, code, or client..."
                      value={projectSearchQuery}
                      onChange={(e) => setProjectSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                    />
                  </div>
                  <div className="text-xs font-semibold text-slate-500">
                    Showing projects for: <strong className="text-blue-600 dark:text-blue-400">
                      {selectedOrgForProjects === 'ALL'
                        ? 'All Organizations'
                        : (organizations.find(o => o.id === selectedOrgForProjects)?.name || 'Selected Organization')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Projects Display Grid (Scrollable Section) */}
              <div className="p-4 md:p-6 flex-1 overflow-y-auto min-h-0">
                {loadingProjects ? (
                  <div className="py-12 text-center space-y-2">
                    <Loader2 className="size-8 text-blue-600 animate-spin mx-auto" />
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
                            className="bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition flex flex-col justify-between space-y-4"
                          >
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-md border border-blue-200 dark:border-blue-800">
                                  {proj.code || 'NO-CODE'}
                                </span>
                                {matchedOrg && (
                                  <span className="px-2.5 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 flex items-center gap-1">
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
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">{spacesCount}</span>
                              </div>
                              <div>
                                <span className="block text-[10px] text-slate-400 font-bold uppercase">Zones</span>
                                <span className="font-extrabold text-blue-600 dark:text-blue-400">{zonesCount}</span>
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
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg transition shadow-2xs hover:shadow-xs cursor-pointer flex items-center gap-1"
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
            </div>
          )}

          {activeTab === 'licenses' && (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {/* Fixed / Constant Top Section: Header & Key Generator Form */}
              <div className="p-4 md:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 space-y-4 shrink-0 bg-white dark:bg-slate-900 z-10">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Key className="text-blue-600 dark:text-blue-400" size={24} />
                      Key Manager & Licensing
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Generate unique non-repeatable license keys and manage hardware trials.</p>
                  </div>
                  <button
                    onClick={fetchAdminLicenses}
                    className="px-3.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition shadow-2xs cursor-pointer shrink-0"
                  >
                    Refresh List
                  </button>
                </div>

                {/* Generator Form */}
                <div className="p-4 sm:p-5 border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 rounded-2xl space-y-3.5">
                  <h3 className="text-sm font-bold text-blue-950 dark:text-blue-200 flex items-center gap-2">
                    <Key className="size-4 text-blue-600 dark:text-blue-400" />
                    Generate Unique Non-Repeatable License Key
                  </h3>

                  <form onSubmit={handleAdminGenerateKey} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">License Tier</label>
                      <select
                        value={genTier}
                        onChange={(e) => setGenTier(e.target.value as any)}
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
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
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Target User Email (Optional)</label>
                      <input
                        type="email"
                        value={genTargetEmail}
                        onChange={(e) => setGenTargetEmail(e.target.value)}
                        placeholder="user@domain.com"
                        className="w-full h-9 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="submit"
                      className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer"
                    >
                      Generate Key
                    </button>
                  </form>

                  {generatedAdminKey && (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-blue-200 dark:border-blue-800 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-semibold">Generated Key:</span>
                        <code className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400 tracking-wider">{generatedAdminKey}</code>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedAdminKey);
                          toast.success("License key copied to clipboard!");
                        }}
                        className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 hover:bg-blue-100 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Copy className="size-3.5" />
                        Copy Key
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Independent Scrollable Section: License Keys & Trials Tables */}
              <div className="p-4 md:p-6 flex-1 flex flex-col min-h-0 gap-4 overflow-hidden">
                {/* Generated Keys Table (Independent Scroll) */}
                <div className="flex-1 flex flex-col min-h-[140px] overflow-hidden">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active & Generated License Keys ({licensesList.length})</h3>
                  </div>
                  {loadingLicenses ? (
                    <div className="py-8 text-center text-slate-400"><Loader2 className="animate-spin size-6 mx-auto mb-2" />Loading keys...</div>
                  ) : licensesList.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">No custom license keys generated yet.</div>
                  ) : (
                    <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-y-auto min-h-0 shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-xs font-bold uppercase text-slate-500 text-[10px] z-10 border-b border-slate-200 dark:border-slate-700">
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
                              <td className="p-3 font-bold text-blue-600 dark:text-blue-400">{lic.key}</td>
                              <td className="p-3 font-semibold">{lic.tier}</td>
                              <td className="p-3 text-slate-600 dark:text-slate-300">{lic.boundEmail || 'Unbound'}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${lic.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'
                                  }`}>
                                  {lic.status}
                                </span>
                              </td>
                              <td className="p-3 text-slate-500">{new Date(lic.expiresAt).toLocaleDateString()}</td>
                              <td className="p-3 text-right">
                                {lic.status === 'ACTIVE' && (
                                  <button
                                    onClick={() => handleAdminRevokeKey(lic.key)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition cursor-pointer"
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

                {/* Hardware Fingerprint Trials Table (Independent Scroll) */}
                <div className="flex-1 flex flex-col min-h-[140px] overflow-hidden pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2 shrink-0">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Hardware Fingerprinted Trials ({trialsList.length})</h3>
                  </div>
                  {trialsList.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs italic border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">No hardware device trials logged yet.</div>
                  ) : (
                    <div className="flex-1 border border-slate-200 dark:border-slate-800 rounded-xl overflow-y-auto min-h-0 shadow-2xs">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/95 backdrop-blur-xs font-bold uppercase text-slate-500 text-[10px] z-10 border-b border-slate-200 dark:border-slate-700">
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
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${Date.now() > tr.expiresAt ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
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
                  <span className="px-2.5 py-0.5 text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
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
                <p className="font-bold text-blue-600 dark:text-blue-400">
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
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl">
                  <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Spaces Configured</span>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-200">
                    {inspectingProject.workspace_data?.spaces?.length || 0}
                  </span>
                </div>
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl">
                  <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Thermal Zones</span>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-200">
                    {inspectingProject.workspace_data?.zones?.length || 0}
                  </span>
                </div>
                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl">
                  <span className="block text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Equipment Schedules</span>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-200">
                    {inspectingProject.workspace_data?.equipment?.length || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setInspectingProject(null)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
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

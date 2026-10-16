import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useMemo } from 'react'
import { Loader2, Plus, UserPlus, Users, HardDrive, LogOut, FolderOpen, Save, ArrowLeft, Megaphone, Trash2, Filter, Crown, ShieldCheck, Activity, Search, FileText, UserCheck, Eye, Edit3, Key, Clock, ChevronRight, Lock, ExternalLink, CheckCircle2, FolderKanban, Zap, AlertTriangle, TrendingUp, Sparkles, Layers, Palette, Building2, UploadCloud, RefreshCw, FileDown, Stamp } from "lucide-react"
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useConfirm } from '@/hooks/use-confirm'
import { getCompanyBranding, saveCompanyBranding, DEFAULT_BRANDING, type CompanyBrandingSettings } from '@/utils/branding'
import jsPDF from 'jspdf'
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter } from '@/lib/pdfHelpers'

type Profile = {
  id: string
  email: string
  role: string
  name: string
  status: string
  organization_id?: string
}

type Announcement = {
  id: string
  message: string
  type: string
  is_active: boolean
  created_at: string
}

const PLATFORM_ROLES = [
  'Jr. Design Engineer',
  'Design Engineer',
  'Sr. Design Engineer',
  'Discipline Coordinator',
  'BIM Modeler',
  'BIM Coordinator',
  'Team Leader',
  '2D Draftsman',
  'Viewer',
  'Client'
]

export function OrgAdminDashboard() {
  const { session, profile: currentUserProfile, userData, logout } = useAuth()
  const confirm = useConfirm()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      navigate({ to: '/login' })
    } catch (e) {
      console.error("Logout failed:", e)
      navigate({ to: '/login' })
    }
  }

  const [activeTab, setActiveTabState] = useState<'users' | 'activity' | 'storage' | 'broadcasts' | 'branding'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_org_admin_active_tab');
      if (saved && ['users', 'activity', 'storage', 'broadcasts', 'branding'].includes(saved)) return saved as any;
    }
    return 'users';
  })
  const setActiveTab = (tab: any) => {
    if (typeof window !== 'undefined') localStorage.setItem('mep_org_admin_active_tab', tab);
    setActiveTabState(tab);
  }

  // Users State with localStorage Persistence
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRoleFilter, setSelectedRoleFilterState] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mep_org_user_role_filter') || 'ALL';
    return 'ALL';
  })
  const setSelectedRoleFilter = (val: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('mep_org_user_role_filter', val);
    setSelectedRoleFilterState(val);
  }

  const [sortByRole, setSortByRoleState] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_org_user_sort_role');
      if (saved !== null) return saved === 'true';
    }
    return true;
  })
  const setSortByRole = (val: boolean | ((prev: boolean) => boolean)) => {
    setSortByRoleState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined') localStorage.setItem('mep_org_user_sort_role', String(next));
      return next;
    });
  }
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviteRole, setInviteRole] = useState('Design Engineer')
  const [isInviting, setIsInviting] = useState(false)
  const [orgDetails, setOrgDetails] = useState<any | null>(null)

  // Projects State for KPI Dashboard & Project Tracking
  const [projects, setProjects] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const uid = currentUserProfile?.id || userData?.id;
        const raw = (uid ? localStorage.getItem(`mep_cached_projects_${uid}`) : null) || localStorage.getItem('mep_cached_projects');
        if (raw) return JSON.parse(raw);
      } catch (e) {}
    }
    return [];
  })
  const [loadingProjects, setLoadingProjects] = useState(false)

  const fetchProjects = async () => {
    setLoadingProjects(true)
    try {
      const projs = await api.getProjects()
      if (Array.isArray(projs)) {
        setProjects(projs)
      }
    } catch (e) {
      console.warn("Failed to fetch projects in Org Admin:", e)
    } finally {
      setLoadingProjects(false)
    }
  }

  const fetchOrgDetails = async () => {
    try {
      const orgs = await api.getOrganizations()
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || (userData?.features as any)?.organization_id
      const myOrgName = currentUserProfile?.company || userData?.company || (userData?.features as any)?.organization_name || (userData?.features as any)?.company || 'Tarv'
      if (Array.isArray(orgs)) {
        let found = null
        if (myOrgId) {
          found = orgs.find((o: any) => o.id === myOrgId || o.name === myOrgId)
        }
        if (!found && myOrgName) {
          found = orgs.find((o: any) => o.name?.toLowerCase() === myOrgName?.toLowerCase() || o.id === myOrgName)
        }
        if (found) setOrgDetails(found)
      }
    } catch (e) { }
  }

  // --- Company Branding & Deliverables Customization State ---
  const [branding, setBranding] = useState<CompanyBrandingSettings>(() => getCompanyBranding());
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    const loadBranding = async () => {
      const orgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id;
      try {
        const res = await api.getOrgBranding(orgId);
        if (res && res.success && res.branding) {
          setBranding(res.branding);
          saveCompanyBranding(res.branding);
        }
      } catch (e) {
        console.error("Could not fetch remote branding", e);
      }
    };
    loadBranding();
  }, [currentUserProfile, userData, orgDetails]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file size must be less than 2MB');
      return;
    }

    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const result = uploadEvent.target?.result as string;
      if (result) {
        setBranding(prev => ({ ...prev, logoUrl: result }));
        toast.success('Logo uploaded successfully! Preview updated.');
      }
      setLogoUploading(false);
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setBranding(prev => ({ ...prev, logoUrl: '' }));
    toast.info('Logo removed.');
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      saveCompanyBranding(branding);
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
      const res = await api.saveOrgBranding(branding, myOrgId);
      if (res && res.success) {
        toast.success('Company branding and report customization saved successfully!');
      } else {
        toast.success('Branding saved locally! (Server: ' + (res?.message || 'applied') + ')');
      }
    } catch (e: any) {
      toast.error('Failed to save branding: ' + e.message);
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleResetBranding = async () => {
    const confirmed = await confirm('Reset all branding and signature settings back to defaults?', {
      title: 'Reset Branding',
      confirmText: 'Reset',
      kind: 'warning'
    });
    if (!confirmed) return;

    setBranding(DEFAULT_BRANDING);
    saveCompanyBranding(DEFAULT_BRANDING);
    const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
    await api.saveOrgBranding(DEFAULT_BRANDING, myOrgId);
    toast.success('Branding reset to default configuration');
  };

  const handleExportSamplePdf = () => {
    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const startY = addPdfHeader(doc, 'VENTILATION & SMOKE CONTROL CALCULATION', {
        calcNo: 'TRV-CAL-VENT-001',
        revNo: 'Rev 0 - IFC',
        projectNo: 'PRJ-2026-HQ',
        projectName: 'Grand Commercial Tower - MEP Design',
        client: 'Apex Infrastructure Ltd',
        endUser: 'Metropolitan Development Authority',
        date: new Date().toLocaleDateString('en-GB')
      });

      // Render a sample preview table
      (doc as any).autoTable({
        startY: startY + 2,
        head: [['Zone / Room ID', 'Airflow (CFM)', 'Airflow (L/s)', 'ACH Required', 'ACH Calculated', 'Fan Selection', 'Compliance']],
        body: [
          ['Basement Car Park B1', '14,200', '6,701', '6.0', '6.2', 'Jet Fan System J-01', 'PASSED (ASHRAE 62.1)'],
          ['Main Plant Room', '8,400', '3,964', '10.0', '10.4', 'Centrifugal In-Line F-02', 'PASSED (NBC 2016)'],
          ['Electrical Substation', '4,800', '2,265', '8.0', '8.1', 'Wall Axial Exhaust W-01', 'PASSED (IS 732)'],
          ['Elevator Machine Room', '2,600', '1,227', '5.0', '5.2', 'Propeller Exhaust P-04', 'PASSED (NBC Part 4)']
        ],
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 41, 59] },
        margin: { left: 14, right: 14 }
      });

      const tableEndY = (doc as any).lastAutoTable?.finalY || (startY + 45);

      addPdfSignatureBlock(doc, tableEndY, {
        originatedName: currentUserProfile?.name || userData?.name || 'Design Engineer',
        originatedDate: new Date().toLocaleDateString('en-GB'),
        reviewerName: 'Sr. Discipline Lead',
        reviewerDate: new Date().toLocaleDateString('en-GB'),
        approverName: 'Principal MEP Director',
        approverDate: new Date().toLocaleDateString('en-GB')
      });

      addPdfFooter(doc, 1, 1);

      doc.save(`${(branding.companyName || 'MEP').replace(/[^a-zA-Z0-9]/g, '_')}_Sample_Report.pdf`);
      toast.success('Sample branded calculation PDF generated and downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate sample PDF: ' + err.message);
    }
  };

  // Activity Logs State with localStorage Persistence
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [logCategoryFilter, setLogCategoryFilterState] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mep_log_cat_filter') || 'ALL';
    return 'ALL';
  })
  const setLogCategoryFilter = (val: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('mep_log_cat_filter', val);
    setLogCategoryFilterState(val);
  }

  const [logProjectFilter, setLogProjectFilterState] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mep_log_proj_filter') || 'ALL';
    return 'ALL';
  })
  const setLogProjectFilter = (val: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('mep_log_proj_filter', val);
    setLogProjectFilterState(val);
  }

  const [logPageFilter, setLogPageFilterState] = useState<string>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('mep_log_page_filter') || 'ALL';
    return 'ALL';
  })
  const setLogPageFilter = (val: string) => {
    if (typeof window !== 'undefined') localStorage.setItem('mep_log_page_filter', val);
    setLogPageFilterState(val);
  }

  const [logSearchQuery, setLogSearchQuery] = useState<string>('')
  const [logPage, setLogPage] = useState<number>(1)
  const [logPageSize, setLogPageSizeState] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_log_page_size');
      if (saved && [10, 20, 25, 50, 100].includes(Number(saved))) return Number(saved);
    }
    return 20;
  });
  const setLogPageSize = (val: number) => {
    if (typeof window !== 'undefined') localStorage.setItem('mep_log_page_size', String(val));
    setLogPageSizeState(val);
  };

  const [logSortField, setLogSortFieldState] = useState<'timestamp' | 'project' | 'page' | 'user' | 'action'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_log_sort_field');
      if (saved && ['timestamp', 'project', 'page', 'user', 'action'].includes(saved)) return saved as any;
    }
    return 'timestamp';
  })
  const setLogSortField = (val: any) => {
    setLogSortFieldState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined') localStorage.setItem('mep_log_sort_field', next);
      return next;
    });
  }

  const [logSortOrder, setLogSortOrderState] = useState<'asc' | 'desc'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_log_sort_order');
      if (saved === 'asc' || saved === 'desc') return saved;
    }
    return 'desc';
  })
  const setLogSortOrder = (val: any) => {
    setLogSortOrderState(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (typeof window !== 'undefined') localStorage.setItem('mep_log_sort_order', next);
      return next;
    });
  }

  // Storage State
  const [localBackupPath, setLocalBackupPath] = useState(localStorage.getItem('localBackupPath') || '')
  const [serverBackupPath, setServerBackupPath] = useState(localStorage.getItem('serverBackupPath') || '')
  const [versionsPath, setVersionsPath] = useState(localStorage.getItem('versionsPath') || '')

  // Broadcasts State
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(false)
  const [newAnnouncementMsg, setNewAnnouncementMsg] = useState('')
  const [newAnnouncementType, setNewAnnouncementType] = useState<'info' | 'warning' | 'success' | 'error'>('info')

  const fetchUsers = async () => {
    setLoading(true)
    let fetchedUsers = await api.getOrgUsers()

    if (fetchedUsers && fetchedUsers.length > 0) {
      fetchedUsers = fetchedUsers.filter((u: any) => u.role !== 'SUPER_ADMIN' && u.email !== 'admin@tarv.ai');
    }

    setUsers(fetchedUsers || [])
    setLoading(false)
  }

  const fetchOrgActivityLogs = async () => {
    setLoadingLogs(true)
    const logs = await api.getOrgActivityLogs()
    setActivityLogs(Array.isArray(logs) ? logs.filter(Boolean) : [])
    setLoadingLogs(false)
  }

  const fetchAnnouncements = async () => {
    setLoadingAnnouncements(true)
    const data = await api.getAnnouncements()
    if (data) setAnnouncements(data)
    setLoadingAnnouncements(false)
  }

  const fetchBackupSettings = async () => {
    const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || '';
    const res = await api.getOrgBackupSettings(myOrgId)
    if (res && res.success) {
      if (res.local_backup_path) setLocalBackupPath(res.local_backup_path)
      if (res.server_backup_path) setServerBackupPath(res.server_backup_path)
      if (res.versions_path) {
        setVersionsPath(res.versions_path)
        localStorage.setItem('versionsPath', res.versions_path)
      }
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchOrgDetails()
    fetchProjects()
    fetchOrgActivityLogs()
    if (activeTab === 'storage') fetchBackupSettings()
    if (activeTab === 'broadcasts') fetchAnnouncements()
  }, [activeTab])

  // --- KPI Metrics & Statistical Computations ---
  const maxSeats = orgDetails?.max_users || (orgDetails?.subscription_plan === 'ENTERPRISE' ? 500 : 5);
  const seatsUsed = users.length;
  const seatPercentage = Math.min(100, Math.round((seatsUsed / Math.max(1, maxSeats)) * 100));
  const isSeatLimitReached = seatsUsed >= maxSeats;
  const isSeatNearLimit = seatPercentage >= 80 && !isSeatLimitReached;

  // 1. Active Projects Stats for KPI Dashboard
  const projectStats = useMemo(() => {
    const total = projects.length;
    const archived = projects.filter((p: any) =>
      p.status === 'archived' ||
      p.status === 'completed' ||
      p.status === 'locked' ||
      p.current_stage === 'Completed'
    ).length;
    const active = Math.max(0, total - archived);
    return { total, active, archived };
  }, [projects]);

  // 2. Pending Review & Approval Queue Stats for KPI Dashboard
  const reviewStats = useMemo(() => {
    let submitted = 0; // Awaiting Senior Engineer review
    let reviewed = 0;  // Awaiting Coordinator / Org Admin approval
    let approved = 0;  // Approved & Signed-off
    let rejected = 0;
    const trackedKeys = new Set<string>();

    // Scan from loaded projects workspace_data
    projects.forEach((p: any) => {
      const rStates = p.workspace_data?.review_states || {};
      Object.entries(rStates).forEach(([key, val]: [string, any]) => {
        if (val && typeof val === 'object' && val.status) {
          trackedKeys.add(key);
          if (val.status === 'SUBMITTED') submitted++;
          else if (val.status === 'REVIEWED') reviewed++;
          else if (val.status === 'APPROVED') approved++;
          else if (val.status === 'REJECTED') rejected++;
        }
      });
    });

    // Scan from localStorage for active workspace sessions
    if (typeof window !== 'undefined') {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('mep_calc_review_') && !trackedKeys.has(k)) {
            try {
              const parsed = JSON.parse(localStorage.getItem(k) || '');
              if (parsed && parsed.status) {
                if (parsed.status === 'SUBMITTED') submitted++;
                else if (parsed.status === 'REVIEWED') reviewed++;
                else if (parsed.status === 'APPROVED') approved++;
                else if (parsed.status === 'REJECTED') rejected++;
              }
            } catch {}
          }
        }
      } catch {}
    }

    const totalPending = submitted + reviewed;
    return { submitted, reviewed, approved, rejected, totalPending };
  }, [projects]);

  // 3. License & Subscription Health Statistics for KPI Dashboard
  const licenseStats = useMemo(() => {
    const plan = orgDetails?.subscription_plan ||
                 orgDetails?.subscription?.plan ||
                 (userData?.features as any)?.plan ||
                 (currentUserProfile?.role === 'ORG_ADMIN' || currentUserProfile?.role === 'SUPER_ADMIN' ? 'ENTERPRISE' : 'PRO');

    const rawExpiry = orgDetails?.subscription_expires ||
                      orgDetails?.subscription?.expires_at ||
                      userData?.subscription_expires ||
                      currentUserProfile?.subscription_expires ||
                      (userData?.features as any)?.subscription_expires;

    if (!rawExpiry) {
      return {
        plan,
        daysRemaining: 365,
        formattedExpiry: 'Active Annual Renewal',
        status: 'ACTIVE' as const,
        isExpiringSoon: false,
        isExpired: false
      };
    }

    const expDate = new Date(rawExpiry);
    if (isNaN(expDate.getTime())) {
      return {
        plan,
        daysRemaining: 365,
        formattedExpiry: 'Active Subscription',
        status: 'ACTIVE' as const,
        isExpiringSoon: false,
        isExpired: false
      };
    }

    const diffDays = Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const isExpired = diffDays <= 0;
    const isExpiringSoon = diffDays > 0 && diffDays <= 14;

    return {
      plan,
      daysRemaining: Math.max(0, diffDays),
      formattedExpiry: expDate.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
      status: (isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING_SOON' : 'ACTIVE') as 'EXPIRED' | 'EXPIRING_SOON' | 'ACTIVE',
      isExpiringSoon,
      isExpired
    };
  }, [orgDetails, userData, currentUserProfile]);

  // --- Users Handlers ---
  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSeatLimitReached) {
      return toast.error(`Organization seat limit reached (${users.length}/${maxSeats} Used). You cannot invite more members. Please contact Super Admin to increase seats.`)
    }
    if (!inviteEmail || !inviteName) return toast.error("Please fill all fields")
    setIsInviting(true)
    const res = await api.inviteOrgUser({ email: inviteEmail, name: inviteName, role: inviteRole })
    if (res.success) {
      toast.success("User invited successfully!")
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteName('')
      setInviteRole('Design Engineer')
      fetchUsers()
    } else {
      toast.error(res.message || "Failed to invite user")
    }
    setIsInviting(false)
  }

  const handleRemoveUser = async (user: Profile) => {
    const choice = await confirm(`Are you sure you want to remove ${user.email} from the organization?`, { title: 'Confirm Removal', kind: 'warning' })
    if (!choice) return

    toast.info("Removing user...")
    const res = await api.adminDeleteUser(user.id)
    if (res && res.success) {
      toast.success("User removed successfully")
      fetchUsers()
    } else {
      toast.error("Failed to remove user")
    }
  }

  const handleChangeRole = async (user: Profile, newRole: string) => {
    if (user.id === currentUserProfile?.id) {
      toast.error("You cannot change your own role.")
      return
    }
    toast.info(`Updating role for ${user.email} to ${newRole}...`)
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole as Role } : u));
    const res = await api.adminToggleRole(user.id, newRole)
    await api.adminUpdateProfile(user.id, { role: newRole });
    if (res && res.success) {
      toast.success(`Role for ${user.name || user.email} updated to ${newRole}`)
      fetchUsers()
    } else {
      toast.error(res.message || "Failed to update role")
    }
  }

  const handleChangeApprovalAuthority = async (user: Profile, newAuthority: 'APPROVE_REJECT' | 'REVIEW' | 'NONE' | 'SUBMIT_TASK') => {
    toast.info(`Updating review rights for ${user.name || user.email}...`)
    setUsers(prev => prev.map(u => u.id === user.id ? {
      ...u,
      approvalAuthority: newAuthority,
      features: { ...(u.features || {}), approvalAuthority: newAuthority }
    } : u));
    const res = await api.adminUpdateProfile(user.id, {
      email: user.email,
      approvalAuthority: newAuthority,
      features: { ...(user.features || {}), approvalAuthority: newAuthority }
    });
    toast.success(`Review rights updated for ${user.name || user.email}`)
    fetchUsers()
  }

  const ROLE_ORDER: Record<string, number> = {
    'ORG_ADMIN': 1,
    'jr. Design Engineer': 2,
    'Design Engineer': 3,
    'Sr. Design Engineer': 4,
    'Discipline Coordinator': 5,
    'BIM Modeler': 6,
    'BIM Coordinator': 7,
    'Team Leader': 8,
    '2D Draftsman': 9,
    'Viewer': 10,
    'Client': 11
  }

  // --- Storage Handlers ---
  const [verifyingPath, setVerifyingPath] = useState<string | null>(null);

  const handlePickFolder = async (type: 'local' | 'server' | 'versions') => {
    const title = type === 'local'
      ? 'Select Local Backup Folder'
      : type === 'server'
        ? 'Select Server Backup Folder'
        : 'Select Organization Common Version Storage Directory';

    const currentVal = type === 'local' ? localBackupPath : type === 'server' ? serverBackupPath : versionsPath;

    const updatePathState = (selectedPath: string) => {
      if (type === 'local') {
        setLocalBackupPath(selectedPath);
        localStorage.setItem('localBackupPath', selectedPath);
        toast.success(`Local backup folder set: ${selectedPath}`);
      } else if (type === 'server') {
        setServerBackupPath(selectedPath);
        localStorage.setItem('serverBackupPath', selectedPath);
        toast.success(`Server backup folder set: ${selectedPath}`);
      } else {
        setVersionsPath(selectedPath);
        localStorage.setItem('versionsPath', selectedPath);
        toast.success(`Organization common versions folder set: ${selectedPath}`);
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
        if (err.name === 'AbortError') return; // User cancelled directory dialog
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

  const handleOpenFolder = async (folderPath: string, label: string) => {
    if (!folderPath || !folderPath.trim()) {
      toast.error(`Please enter or browse a folder path for ${label} first`);
      return;
    }
    toast.info(`Opening ${folderPath} in Windows Explorer...`, { duration: 2000 });
    const res = await api.openFolder(folderPath.trim());
    if (res && res.success) {
      toast.success(`Opened ${folderPath} in Windows Explorer!`);
    } else {
      toast.error(res?.message || `Could not open ${folderPath}`);
    }
  };

  const handleVerifyFolder = async (folderPath: string, label: string) => {
    if (!folderPath || !folderPath.trim()) {
      toast.error(`Please enter or browse a folder path for ${label} first`);
      return;
    }
    setVerifyingPath(folderPath);
    try {
      const res = await api.verifyFolder(folderPath.trim());
      if (res && res.success) {
        toast.success(res.message || `${label} is verified and writable!`);
      } else {
        toast.error(res?.message || `${label} path is not accessible!`);
      }
    } catch (e: any) {
      toast.error(`Verification error: ${e.message}`);
    } finally {
      setVerifyingPath(null);
    }
  };

  // --- Broadcasts Handlers ---
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

  // Format log details cleanly into human readable sentences
  const formatLogDetail = (log: any) => {
    if (!log) return 'No details provided';

    let d: any = log.details;
    if (typeof d === 'string') {
      try {
        const parsed = JSON.parse(d);
        if (parsed && typeof parsed === 'object') d = parsed;
      } catch (e) {
        // Keep as string if not JSON
      }
    }

    const isObj = typeof d === 'object' && d !== null;

    if (isObj && d.message) return d.message;
    if (isObj && d.summary) return d.summary;

    if (log.action_type === 'LOGIN') {
      return 'User logged into platform';
    }

    if (log.action_type === 'UPDATED') {
      if (typeof d === 'string' && d.trim() && !d.startsWith('{')) return d;
      const calcName = isObj ? (d.calculator_name || d.calculator || d.project_name || 'Calculation') : 'Calculation';
      const projName = isObj ? (d.project_name || '') : '';
      return `Calculation ${calcName} was updated and saved${projName ? ` in project ${projName}` : ''}`;
    }

    if (log.action_type === 'ADMIN_TOGGLE_ROLE') {
      const role = isObj ? (d.newRole || d.role || '') : '';
      return `Updated user role ${role ? `to ${role}` : ''}`;
    }

    if (log.action_type === 'UPDATE_ANNOUNCEMENT') {
      const active = isObj ? d.is_active : undefined;
      return `Global Announcement ${active === true ? 'Activated' : active === false ? 'Deactivated' : 'Updated'}`;
    }

    if (log.action_type === 'CREATE_ANNOUNCEMENT') {
      return `Created global announcement: "${isObj ? (d.message || d.text || 'Notification') : String(d)}"`;
    }

    if (log.action_type === 'DELETE_ANNOUNCEMENT') {
      return 'Deleted global announcement';
    }

    if (log.action_type === 'INVITE_USER') {
      const email = isObj ? (d.invitedEmail || d.email || '') : '';
      const role = isObj ? (d.role || '') : '';
      return `Invited team member ${email ? `${email} ` : ''}${role ? `as ${role}` : ''}`;
    }

    if (log.action_type === 'ADMIN_DELETE_USER') {
      return 'Removed team member from organization';
    }

    if (log.action_type === 'CREATE_TEAM') {
      return `Created team "${isObj ? (d.name || d.teamName || 'Team') : String(d)}"`;
    }

    if (log.action_type === 'CALCULATION_APPROVED') {
      return `Calculation approved${isObj && d.calculatorTitle ? `: ${d.calculatorTitle}` : ''}`;
    }

    if (log.action_type === 'CALCULATION_REVIEWED') {
      return `Calculation reviewed${isObj && d.calculatorTitle ? `: ${d.calculatorTitle}` : ''}`;
    }

    if (log.action_type === 'CALCULATION_REJECTED') {
      return `Calculation rejected${isObj && d.calculatorTitle ? `: ${d.calculatorTitle}` : ''}`;
    }

    if (isObj) {
      const parts = Object.entries(d)
        .filter(([k]) => k !== 'id' && k !== 'user_id' && k !== 'targetUser')
        .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`);
      if (parts.length > 0) return parts.join(' | ');
    }

    return String(d || 'No details provided');
  };

  const getLogProject = (log: any): string => {
    if (!log) return 'Global / System';
    let d: any = log.details;
    if (typeof d === 'string') {
      try {
        const parsed = JSON.parse(d);
        if (parsed && typeof parsed === 'object') d = parsed;
      } catch (e) { }
    }
    const isObj = typeof d === 'object' && d !== null;

    if (log.project_name) return log.project_name;
    if (log.projectName) return log.projectName;
    if (log.project) return log.project;

    if (isObj) {
      if (d.project_name) return d.project_name;
      if (d.projectName) return d.projectName;
      if (d.project) return d.project;
      if (d.project_code) return `Project ${d.project_code}`;
      if (d.projectCode) return `Project ${d.projectCode}`;
      if (d.orgName || d.org_name) return d.orgName || d.org_name;
    }

    if (typeof d === 'string') {
      const projMatch = d.match(/in project\s+([^,\|]+)/i) || d.match(/project\s+([^,\|]+)/i);
      if (projMatch && projMatch[1]) return projMatch[1].trim();
    }

    if (log.action_type === 'LOGIN' || log.action_type === 'LOGOUT') return 'System / Account';
    if (log.action_type?.includes('ANNOUNCEMENT')) return 'Global Broadcasts';
    if (log.action_type?.includes('TEAM') || log.action_type?.includes('ROLE') || log.action_type?.includes('USER')) return 'Organization Admin';
    if (log.action_type?.includes('BACKUP') || log.action_type?.includes('SETTING')) return 'System Settings';

    return 'Global / System';
  };

  const getLogPage = (log: any): string => {
    if (!log) return 'Dashboard Page';
    let d: any = log.details;
    if (typeof d === 'string') {
      try {
        const parsed = JSON.parse(d);
        if (parsed && typeof parsed === 'object') d = parsed;
      } catch (e) { }
    }
    const isObj = typeof d === 'object' && d !== null;

    if (log.page) return log.page;
    if (isObj && d.page) return d.page;
    if (log.calculator_name) return log.calculator_name;
    if (log.calculatorName) return log.calculatorName;
    if (log.calculator) return log.calculator;

    if (isObj) {
      if (d.calculator_name) return d.calculator_name;
      if (d.calculatorName) return d.calculatorName;
      if (d.calculator) return d.calculator;
      if (d.calculatorTitle) return d.calculatorTitle;
      if (d.section) return d.section;
      if (d.module) return d.module;
    }

    const action = log.action_type || '';
    if (action === 'LOGIN' || action === 'LOGOUT') return 'Login Page';
    if (action.includes('ANNOUNCEMENT')) return 'Global Broadcasts';
    if (action === 'INVITE_USER' || action === 'ADMIN_TOGGLE_ROLE' || action === 'ADMIN_DELETE_USER' || action.includes('TEAM')) return 'Team Members Admin';
    if (action.includes('BACKUP') || action.includes('SETTING')) return 'Server & Sync Settings';
    if (action.includes('ORGANIZATION')) return 'Organization Manager';
    if (action === 'VIEW_CALCULATOR' || action === 'VIEWED' || action === 'UPDATED' || action.includes('CALCULATION')) return 'Calculator Workspace';
    if (action.includes('REPORT') || action === 'EXPORT') return 'Reports & Exports';

    return 'Dashboard Page';
  };

  const availableProjects = useMemo(() => {
    const set = new Set<string>();
    activityLogs.forEach(l => {
      const proj = getLogProject(l);
      if (proj) set.add(proj);
    });
    return Array.from(set).sort();
  }, [activityLogs]);

  const availablePages = useMemo(() => {
    const set = new Set<string>();
    activityLogs.forEach(l => {
      const pg = getLogPage(l);
      if (pg) set.add(pg);
    });
    return Array.from(set).sort();
  }, [activityLogs]);

  const handleSortLog = (field: 'timestamp' | 'project' | 'page' | 'user' | 'action') => {
    if (logSortField === field) {
      setLogSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setLogSortField(field);
      setLogSortOrder('asc');
    }
  };

  const processedLogs = useMemo(() => {
    return activityLogs
      .filter(log => {
        // Category Filter
        if (logCategoryFilter === 'LOGIN' && log.action_type !== 'LOGIN') return false;
        if (logCategoryFilter === 'VIEWED' && log.action_type !== 'VIEWED' && log.action_type !== 'VIEW_CALCULATOR') return false;
        if (logCategoryFilter === 'UPDATED' && log.action_type !== 'UPDATED' && !log.action_type?.includes('UPDATE')) return false;
        if (logCategoryFilter === 'CALCULATION_RUN' && !log.action_type?.includes('CALCULATION')) return false;
        if (logCategoryFilter === 'REPORT_GENERATED' && !log.action_type?.includes('REPORT') && log.action_type !== 'EXPORT') return false;
        if (logCategoryFilter === 'USER_MGMT' && (log.action_type === 'LOGIN' || log.action_type === 'VIEWED' || log.action_type === 'UPDATED' || log.action_type?.includes('CALCULATION') || log.action_type?.includes('REPORT'))) return false;

        // Project Filter
        const proj = getLogProject(log);
        if (logProjectFilter !== 'ALL' && proj.toLowerCase() !== logProjectFilter.toLowerCase()) return false;

        // Page Filter
        const pg = getLogPage(log);
        if (logPageFilter !== 'ALL' && pg.toLowerCase() !== logPageFilter.toLowerCase()) return false;

        // Search Query
        if (logSearchQuery.trim()) {
          const q = logSearchQuery.toLowerCase();
          const name = (log.name || log.profiles?.name || log.user_name || '').toLowerCase();
          const email = (log.profiles?.email || log.email || '').toLowerCase();
          const action = (log.action_type || '').toLowerCase();
          const formattedDate = new Date(log.created_at).toLocaleString().toLowerCase();
          const detailsStr = typeof log.details === 'string' ? log.details.toLowerCase() : JSON.stringify(log.details || {}).toLowerCase();
          return (
            name.includes(q) ||
            email.includes(q) ||
            action.includes(q) ||
            proj.toLowerCase().includes(q) ||
            pg.toLowerCase().includes(q) ||
            formattedDate.includes(q) ||
            detailsStr.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA: any = '';
        let valB: any = '';

        if (logSortField === 'timestamp') {
          valA = new Date(a.created_at).getTime();
          valB = new Date(b.created_at).getTime();
        } else if (logSortField === 'project') {
          valA = getLogProject(a).toLowerCase();
          valB = getLogProject(b).toLowerCase();
        } else if (logSortField === 'page') {
          valA = getLogPage(a).toLowerCase();
          valB = getLogPage(b).toLowerCase();
        } else if (logSortField === 'user') {
          valA = (a.name || a.email || '').toLowerCase();
          valB = (b.name || b.email || '').toLowerCase();
        } else if (logSortField === 'action') {
          valA = (a.action_type || '').toLowerCase();
          valB = (b.action_type || '').toLowerCase();
        }

        if (valA < valB) return logSortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return logSortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [activityLogs, logCategoryFilter, logProjectFilter, logPageFilter, logSearchQuery, logSortField, logSortOrder]);

  const totalLogPages = Math.max(1, Math.ceil(processedLogs.length / logPageSize));
  const paginatedLogs = useMemo(() => {
    const start = (logPage - 1) * logPageSize;
    return processedLogs.slice(start, start + logPageSize);
  }, [processedLogs, logPage, logPageSize]);

  return (
    <div className="flex h-screen bg-slate-50/60 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* Full-Height Left Sidebar */}
      <aside className="w-64 shrink-0 h-screen border-r border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col justify-between p-4 z-10">
        <div>
          {/* Back to App Link */}
          <button
            onClick={() => navigate({ to: '/dashboard' })}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-primary dark:hover:text-primary transition-colors mb-5 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to App</span>
          </button>

          {/* Org Admin Brand */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">Org Admin</h1>
                {orgDetails?.name && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold border border-primary/20 truncate max-w-[90px]">
                    {orgDetails.name}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Control Panel & Team Analytics</p>
            </div>
          </div>

          {/* Sidebar Nav Items */}
          <div className="flex flex-col gap-1.5">
            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={16} />
                Team Members
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {users.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('activity')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'activity'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Activity size={16} />
                Activity Audit Logs
              </div>
              {activityLogs.length > 0 && (
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'activity' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {activityLogs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('storage')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'storage'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <HardDrive size={16} />
              Server & Sync Settings
            </button>

            <button
              onClick={() => setActiveTab('branding')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'branding'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Palette size={16} />
              Branding & Reports
            </button>

            <button
              onClick={() => setActiveTab('broadcasts')}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'broadcasts'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Megaphone size={16} />
              Global Broadcasts
            </button>
          </div>
        </div>

        {/* Current User Card & Logout at Bottom */}
        <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center text-xs shrink-0 border border-primary/20">
                {(currentUserProfile?.name || currentUserProfile?.email || 'A')[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold truncate text-slate-900 dark:text-slate-100 flex items-center gap-1">
                  <span>{currentUserProfile?.name || 'Org Admin'}</span>
                  <Crown size={12} className="text-amber-500 shrink-0" />
                </div>
                <div className="text-[11px] text-slate-500 truncate">{currentUserProfile?.email || userData?.email}</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 rounded-xl border border-red-200/60 dark:border-red-800/40 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 h-screen ${
        activeTab === 'activity' ? 'flex flex-col overflow-hidden p-3 md:p-4 pb-2' : 'overflow-y-auto space-y-4 p-4 md:p-6'
      }`}>
        {/* Executive KPI Dashboard: 4 Real-time Stat Cards */}
        <section className="shrink-0 mb-2">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Organization Executive KPI Dashboard
              </h2>
              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time operational governance and capacity metrics for <span className="font-bold text-slate-800 dark:text-slate-200">{orgDetails?.name || 'Your Organization'}</span>
              </p>
            </div>
            <button
              onClick={() => {
                fetchUsers();
                fetchProjects();
                fetchOrgDetails();
                fetchOrgActivityLogs();
                toast.success("KPI metrics synchronized with live server data");
              }}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold transition-all cursor-pointer shadow-2xs"
              title="Refresh all real-time metrics"
            >
              <Activity className="w-3.5 h-3.5 text-primary" />
              <span>Sync Metrics</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Seat Utilization */}
            <div 
              onClick={() => setActiveTab('users')}
              className={`relative overflow-hidden rounded-2xl border p-4 shadow-xs transition-all cursor-pointer hover:shadow-md ${
                isSeatLimitReached
                  ? 'border-red-300 dark:border-red-900/60 bg-gradient-to-br from-red-50/50 to-white dark:from-red-950/20 dark:to-slate-900'
                  : isSeatNearLimit
                  ? 'border-amber-300 dark:border-amber-900/60 bg-gradient-to-br from-amber-50/50 to-white dark:from-amber-950/20 dark:to-slate-900'
                  : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50'
              }`}
              title="Click to view Team Members"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Seat Utilization
                </span>
                <div className={`p-2 rounded-xl border ${
                  isSeatLimitReached 
                    ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                    : isSeatNearLimit 
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                    : 'bg-primary/10 text-primary border-primary/20'
                }`}>
                  <Users className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {seatsUsed}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  / {maxSeats} Seats Occupied
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mb-2.5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSeatLimitReached 
                      ? 'bg-red-500' 
                      : isSeatNearLimit 
                      ? 'bg-amber-500' 
                      : 'bg-primary'
                  }`}
                  style={{ width: `${seatPercentage}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px]">
                <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                  isSeatLimitReached
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50'
                    : isSeatNearLimit
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50'
                }`}>
                  {isSeatLimitReached ? 'Limit Reached (Full)' : `${Math.max(0, maxSeats - seatsUsed)} Seats Available`}
                </span>
                <span className="text-slate-500 font-medium">{seatPercentage}% allocated</span>
              </div>
            </div>

            {/* Card 2: Active Projects */}
            <div 
              onClick={() => navigate({ to: '/projects' })}
              className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs transition-all cursor-pointer hover:shadow-md hover:border-blue-500/50"
              title="Click to view all company projects"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Active Projects
                </span>
                <div className="p-2 rounded-xl border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20">
                  <FolderKanban className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {projectStats.active}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Active Designs
                </span>
              </div>

              <p className="text-[11.5px] text-slate-500 dark:text-slate-400 mb-2.5 truncate">
                {projectStats.total} total workspaces under management
              </p>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                  <span>{projectStats.archived} Completed / Locked</span>
                </div>
                <span className="text-primary font-bold text-[11px] flex items-center gap-0.5">
                  <span>Manage</span>
                  <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </div>

            {/* Card 3: Pending Review & Approval Queue */}
            <div 
              onClick={() => {
                setActiveTab('activity');
                setLogCategoryFilter('CALCULATION_RUN');
              }}
              className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs transition-all cursor-pointer hover:shadow-md hover:border-amber-500/50"
              title="Click to view calculation audit queue"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Review & Approval Queue
                </span>
                <div className={`p-2 rounded-xl border ${
                  reviewStats.totalPending > 0
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {reviewStats.totalPending}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Awaiting Action
                </span>
              </div>

              <div className="flex items-center gap-2 mb-2 text-[11px]">
                <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/20 text-[10px]">
                  {reviewStats.submitted} In Review
                </span>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20 text-[10px]">
                  {reviewStats.reviewed} Ready to Approve
                </span>
              </div>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 font-medium">
                  {reviewStats.approved} approved & frozen
                </span>
                <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full border ${
                  reviewStats.totalPending > 0
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50'
                }`}>
                  {reviewStats.totalPending > 0 ? 'Action Required' : 'All Clear'}
                </span>
              </div>
            </div>

            {/* Card 4: License & Subscription Health */}
            <div 
              onClick={() => {
                toast.info(
                  `Organization Plan: ${licenseStats.plan} | Expiry: ${licenseStats.formattedExpiry} (${licenseStats.daysRemaining} days remaining)`
                );
              }}
              className="relative overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs transition-all cursor-pointer hover:shadow-md hover:border-emerald-500/50"
              title="Click for license details"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  License & Subscription
                </span>
                <div className={`p-2 rounded-xl border ${
                  licenseStats.isExpired
                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                    : licenseStats.isExpiringSoon
                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  <Zap className="w-4 h-4" />
                </div>
              </div>

              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                  {licenseStats.plan}
                </span>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Plan
                </span>
              </div>

              <p className="text-[11.5px] font-medium text-slate-600 dark:text-slate-300 mb-2 truncate">
                {licenseStats.isExpired 
                  ? 'License expired. Please renew.' 
                  : `${licenseStats.daysRemaining} days remaining`}
              </p>

              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-slate-100 dark:border-slate-800/80">
                <span className="text-slate-500 truncate" title={`Expires on ${licenseStats.formattedExpiry}`}>
                  {licenseStats.formattedExpiry}
                </span>
                <span className={`px-2 py-0.5 rounded-full font-bold border text-[10px] ${
                  licenseStats.isExpired
                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/50'
                    : licenseStats.isExpiringSoon
                    ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/50'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/50'
                }`}>
                  {licenseStats.isExpired ? 'Expired' : licenseStats.isExpiringSoon ? 'Expiring Soon' : 'Active'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Tab Content Container */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs ${
          activeTab === 'activity' ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-3.5 md:p-4 pb-1.5 md:pb-2' : 'p-5 md:p-6 space-y-5'
        }`}>
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Organization Team Members</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${isSeatLimitReached
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                        : 'bg-primary/10 text-primary border-primary/25'
                        }`}>
                        {users.length} / {maxSeats} Seats Used {isSeatLimitReached ? '(FULL)' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage user access and assign platform roles to organization members.</p>
                  </div>
                  <button
                    disabled={isSeatLimitReached}
                    onClick={() => {
                      if (isSeatLimitReached) {
                        toast.error(`Seat limit reached (${users.length}/${maxSeats} Used). Contact Super Admin to upgrade seats.`);
                        return;
                      }
                      setShowInviteModal(true);
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all shrink-0 shadow-sm ${isSeatLimitReached
                      ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                      : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                      }`}
                    title={isSeatLimitReached ? `Seat limit full (${users.length}/${maxSeats} Used)` : 'Invite Team Member'}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{isSeatLimitReached ? `Seat Limit Full (${maxSeats}/${maxSeats})` : '+ Invite Team Member'}</span>
                  </button>
                </div>

                {/* Filter & Sort Controls */}
                <div className="p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1.5 shrink-0">
                      <Filter size={14} className="text-primary" />
                      Filter by Role:
                    </label>
                    <select
                      value={selectedRoleFilter}
                      onChange={(e) => setSelectedRoleFilter(e.target.value)}
                      className="text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer min-w-[220px]"
                    >
                      <option value="ALL">All Roles ({users.length})</option>
                      {PLATFORM_ROLES.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                      <option value="ORG_ADMIN">Org Admin</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSortByRole(!sortByRole)}
                      className={`text-xs px-4 py-2 rounded-full font-semibold transition-all cursor-pointer shadow-xs ${
                        sortByRole 
                          ? 'bg-primary hover:bg-primary/90 text-primary-foreground' 
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-primary/5 hover:text-primary'
                      }`}
                    >
                      {sortByRole ? 'Sorted by Role Hierarchy' : 'Sorted Alphabetically'}
                    </button>
                  </div>
                </div>

                {/* Members Table */}
                <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                  {loading ? (
                    <div className="flex items-center justify-center p-12">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
                      <p>No team members found.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800">
                          <tr>
                            <th className="px-5 py-3.5 font-bold">Team Member</th>
                            <th className="px-5 py-3.5 font-bold">Calculation Review Rights</th>
                            <th className="px-5 py-3.5 font-bold">Assigned Platform Role</th>
                            <th className="px-5 py-3.5 font-bold">Account Status</th>
                            <th className="px-5 py-3.5 font-bold text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                          {users
                            .filter(u => {
                              if (selectedRoleFilter === 'ALL') return true;
                              if (selectedRoleFilter === 'Design Engineer') return u.role === 'Design Engineer' || u.role === 'ENGINEER' || u.role === 'USER';
                              return u.role === selectedRoleFilter;
                            })
                            .sort((a, b) => {
                              if (sortByRole) {
                                const orderA = ROLE_ORDER[a.role] || 99;
                                const orderB = ROLE_ORDER[b.role] || 99;
                                if (orderA !== orderB) return orderA - orderB;
                              }
                              return (a.name || a.email).localeCompare(b.name || b.email);
                            })
                            .map((u) => (
                              <tr key={u.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center text-xs shrink-0 border border-blue-200/80 dark:border-blue-800/60">
                                      {(u.name || u.email || 'U')[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                                        {u.role === 'ORG_ADMIN' && <Crown size={14} className="text-amber-500 shrink-0" title="Org Admin" />}
                                        <span>{u.name || u.email}</span>
                                      </div>
                                      <div className="text-slate-500 text-xs mt-0.5">{u.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5">
                                  <select
                                    value={
                                      u.approvalAuthority || (u.features as any)?.approvalAuthority || (
                                        (u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'Discipline Coordinator' || u.role === 'Team Leader')
                                          ? 'APPROVE_REJECT'
                                          : (u.role === 'Sr. Design Engineer' ? 'REVIEW' : 'NONE')
                                      )
                                    }
                                    onChange={(e) => handleChangeApprovalAuthority(u, e.target.value as 'APPROVE_REJECT' | 'REVIEW' | 'NONE' | 'SUBMIT_TASK')}
                                    className={`text-xs px-2.5 py-1.5 rounded-lg border font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs ${(u.approvalAuthority || (u.features as any)?.approvalAuthority) === 'APPROVE_REJECT' || (!u.approvalAuthority && (u.role === 'ORG_ADMIN' || u.role === 'SUPER_ADMIN' || u.role === 'Discipline Coordinator' || u.role === 'Team Leader'))
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                                      : (u.approvalAuthority || (u.features as any)?.approvalAuthority) === 'REVIEW' || (!u.approvalAuthority && u.role === 'Sr. Design Engineer')
                                        ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800'
                                        : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                                      }`}
                                  >
                                    <option value="APPROVE_REJECT">Approve / Reject & Review</option>
                                    <option value="REVIEW">Reviewal Only</option>
                                    <option value="SUBMIT_TASK">Submit Task</option>
                                    <option value="NONE">No Reviewal Rights</option>
                                  </select>
                                </td>
                                <td className="px-5 py-3.5">
                                  {u.id === currentUserProfile?.id ? (
                                    <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded-md text-xs font-bold border border-blue-200 dark:border-blue-800">
                                      Org Admin (You)
                                    </span>
                                  ) : (
                                    <select
                                      value={u.role || 'Design Engineer'}
                                      onChange={(e) => handleChangeRole(u, e.target.value)}
                                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                                    >
                                      {PLATFORM_ROLES.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                      <option value="ORG_ADMIN">Org Admin</option>
                                    </select>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  {u.status === 'invited' ? (
                                    <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-full text-[11px] font-bold">
                                      Pending Invite
                                    </span>
                                  ) : (
                                    <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-[11px] font-bold">
                                      Active
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  {u.id !== currentUserProfile?.id && (
                                    <button
                                      onClick={() => handleRemoveUser(u)}
                                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="Remove User"
                                    >
                                      <Trash2 className="w-4 h-4" />
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
              </div>
            )}

          {/* Team Activity Audit Logs Tab */}
          {activeTab === 'activity' && (
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Static Top Header */}
              <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2.5">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    Team Activity Audit Logs
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Real-time audit log tracking Logins, Calculator Views, and Parameter Updates ("Changes Occurred") across your team.</p>
                </div>
                <button
                  onClick={fetchOrgActivityLogs}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-full text-xs font-bold transition-colors border border-primary/25 self-start md:self-auto cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  Refresh Activity Logs
                </button>
              </div>

              {/* Static Filter Controls Bar */}
              <div className="shrink-0 p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-2.5 shadow-xs mb-2.5">
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1 shrink-0">
                      <Filter size={14} className="text-primary" /> Action:
                    </span>
                    {[
                      { id: 'ALL', label: 'All Actions' },
                      { id: 'LOGIN', label: '🔑 Logins' },
                      { id: 'VIEWED', label: '👁️ Views' },
                      { id: 'UPDATED', label: '✏️ Changes' },
                      { id: 'CALCULATION_RUN', label: '🧮 Calculations' },
                      { id: 'REPORT_GENERATED', label: '📄 Reports' },
                      { id: 'USER_MGMT', label: '👥 Team Mgmt' }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => { setLogCategoryFilter(cat.id); setLogPage(1); }}
                        className={`text-xs px-3.5 py-1.5 rounded-full font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${logCategoryFilter === cat.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-primary/5 hover:text-primary'
                          }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative w-full xl:w-80 shrink-0">
                    <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      value={logSearchQuery}
                      onChange={e => { setLogSearchQuery(e.target.value); setLogPage(1); }}
                      placeholder="Search timestamp, project, user, action..."
                      className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                {/* Sub-Filters for Project and Page */}
                <div className="flex flex-wrap items-center gap-3 pt-2.5 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Project:</span>
                    <select
                      value={logProjectFilter}
                      onChange={e => { setLogProjectFilter(e.target.value); setLogPage(1); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer max-w-[220px]"
                    >
                      <option value="ALL">All Projects ({availableProjects.length})</option>
                      {availableProjects.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Page / Module:</span>
                    <select
                      value={logPageFilter}
                      onChange={e => { setLogPageFilter(e.target.value); setLogPage(1); }}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer max-w-[240px]"
                    >
                      <option value="ALL">All Pages ({availablePages.length})</option>
                      {availablePages.map(pg => (
                        <option key={pg} value={pg}>{pg}</option>
                      ))}
                    </select>
                  </div>

                  {(logCategoryFilter !== 'ALL' || logProjectFilter !== 'ALL' || logPageFilter !== 'ALL' || logSearchQuery) && (
                    <button
                      onClick={() => {
                        setLogCategoryFilter('ALL');
                        setLogProjectFilter('ALL');
                        setLogPageFilter('ALL');
                        setLogSearchQuery('');
                        setLogPage(1);
                      }}
                      className="text-xs text-primary hover:underline font-bold ml-auto cursor-pointer"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </div>

              {/* Logs Table Container - Scrollable with sticky header */}
              <div className="flex-1 min-h-0 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900 flex flex-col">
                {loadingLogs ? (
                  <div className="flex-1 flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : processedLogs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500">
                    <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p className="font-semibold text-sm">No activity logs found for this filter.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-h-0 overflow-auto w-full">
                      <table className="w-full text-sm text-left border-collapse min-w-[1100px]">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 select-none sticky top-0 z-10 shadow-xs">
                          <tr>
                            <th
                              className="px-5 py-3.5 font-bold cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors w-[180px] whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                              onClick={() => handleSortLog('timestamp')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Timestamp</span>
                                {logSortField === 'timestamp' && (<span>{logSortOrder === 'asc' ? '▲' : '▼'}</span>)}
                              </div>
                            </th>
                            <th
                              className="px-5 py-3.5 font-bold cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors w-[210px] whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                              onClick={() => handleSortLog('project')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Project</span>
                                {logSortField === 'project' && (<span>{logSortOrder === 'asc' ? '▲' : '▼'}</span>)}
                              </div>
                            </th>
                            <th
                              className="px-5 py-3.5 font-bold cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors w-[190px] whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                              onClick={() => handleSortLog('page')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Page</span>
                                {logSortField === 'page' && (<span>{logSortOrder === 'asc' ? '▲' : '▼'}</span>)}
                              </div>
                            </th>
                            <th
                              className="px-5 py-3.5 font-bold cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors w-[220px] whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                              onClick={() => handleSortLog('user')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Team Member</span>
                                {logSortField === 'user' && (<span>{logSortOrder === 'asc' ? '▲' : '▼'}</span>)}
                              </div>
                            </th>
                            <th
                              className="px-5 py-3.5 font-bold cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors w-[180px] whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                              onClick={() => handleSortLog('action')}
                            >
                              <div className="flex items-center gap-1.5">
                                <span>Action Type</span>
                                {logSortField === 'action' && (<span>{logSortOrder === 'asc' ? '▲' : '▼'}</span>)}
                              </div>
                            </th>
                            <th className="px-5 py-3.5 font-bold min-w-[280px] bg-slate-50 dark:bg-slate-900">Activity Summary & Details</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                          {paginatedLogs.map((log) => {
                            const userName = log.name || log.profiles?.name || log.user_name || log.email || 'Team User';
                            const userEmail = log.profiles?.email || log.email || '';
                            const isLogin = log.action_type === 'LOGIN';
                            const isView = log.action_type === 'VIEWED' || log.action_type === 'VIEW_CALCULATOR';
                            const isUpdate = log.action_type === 'UPDATED' || log.action_type?.includes('UPDATE');
                            const isReport = log.action_type?.includes('REPORT') || log.action_type === 'EXPORT';

                            const projName = getLogProject(log);
                            const pageName = getLogPage(log);

                            return (
                              <tr key={log.id} className="hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors">
                                <td className="px-5 py-3.5 text-xs font-mono text-slate-500 whitespace-nowrap w-[180px]">
                                  {new Date(log.created_at).toLocaleString()}
                                </td>
                                <td className="px-5 py-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 w-[210px]">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/50 whitespace-nowrap max-w-[200px] truncate" title={projName}>
                                    📁 <span className="truncate">{projName}</span>
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-xs font-bold text-slate-800 dark:text-slate-200 w-[190px]">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap max-w-[180px] truncate" title={pageName}>
                                    📄 <span className="truncate">{pageName}</span>
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 w-[220px]">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-extrabold flex items-center justify-center text-xs shrink-0 border border-primary/20">
                                      {(userName || 'U')[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-extrabold text-slate-900 dark:text-slate-100 text-xs truncate max-w-[160px]" title={userName}>
                                        {userName}
                                      </div>
                                      {userEmail && <div className="text-[11px] text-slate-500 truncate max-w-[160px]" title={userEmail}>{userEmail}</div>}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 w-[180px] whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                    {isLogin && <Key size={12} className="text-primary" />}
                                    {isView && <Eye size={12} className="text-primary" />}
                                    {isUpdate && <Edit3 size={12} className="text-primary" />}
                                    {isReport && <FileText size={12} className="text-primary" />}
                                    {isUpdate ? 'UPDATED / CHANGES' : log.action_type}
                                  </span>
                                </td>
                                <td className="px-5 py-3.5 text-xs font-medium text-slate-700 dark:text-slate-300 min-w-[280px]">
                                  {formatLogDetail(log)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="shrink-0 px-4 py-2 bg-slate-50/80 dark:bg-slate-900/80 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                      <div className="text-slate-500 font-medium">
                        Showing <span className="font-bold text-slate-800 dark:text-slate-200">{processedLogs.length === 0 ? 0 : (logPage - 1) * logPageSize + 1}</span> to <span className="font-bold text-slate-800 dark:text-slate-200">{Math.min(logPage * logPageSize, processedLogs.length)}</span> of <span className="font-bold text-slate-800 dark:text-slate-200">{processedLogs.length}</span> audit logs
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 mr-2">
                          <span className="text-slate-500">Rows:</span>
                          <select
                            value={logPageSize}
                            onChange={(e) => {
                              setLogPageSize(Number(e.target.value));
                              setLogPage(1);
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                          </select>
                        </div>
                        <button
                          disabled={logPage <= 1}
                          onClick={() => setLogPage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          Previous
                        </button>
                        <span className="px-2 font-bold text-slate-600 dark:text-slate-400">
                          Page {logPage} of {totalLogPages}
                        </span>
                        <button
                          disabled={logPage >= totalLogPages}
                          onClick={() => setLogPage(p => Math.min(totalLogPages, p + 1))}
                          className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-semibold text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Storage & Backup Tab */}
          {activeTab === 'storage' && (
            <div className="space-y-5">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Server & Sync Settings</h2>

              <div className="space-y-6 max-w-3xl">
                {/* Organization Common Versions Directory (Admin Managed) */}
                <div className="bg-blue-50/20 dark:bg-blue-950/20 p-5 rounded-xl border border-blue-200/80 dark:border-blue-900/40 shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0">
                      <FolderOpen className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-base text-slate-900 dark:text-white">Organization Common Version & Backup Storage Path</h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Admin Configured
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5">
                        Centralized network folder path (e.g. <code className="bg-slate-200/80 dark:bg-slate-800 px-1 rounded text-xs font-mono text-foreground">Z:\Versions</code> or <code className="bg-slate-200/80 dark:bg-slate-800 px-1 rounded text-xs font-mono text-foreground">\\server-m\Versions</code>). Only Organization Admins can set this shared path. All team members in your organization will automatically use this common directory to save and view project versions and backups.
                      </p>

                      <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                        <input
                          type="text"
                          value={versionsPath}
                          onChange={(e) => setVersionsPath(e.target.value)}
                          placeholder="e.g. Z:\Versions or \\server-m\Versions"
                          className="flex-1 min-w-[200px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handlePickFolder('versions')}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                          title="Browse with native Windows folder picker"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Browse
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFolder(versionsPath, 'Organization Versions Path')}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                          title="Open this folder in Windows Explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyFolder(versionsPath, 'Organization Versions Path')}
                          disabled={verifyingPath === versionsPath}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                          title="Verify folder exists and has write permissions"
                        >
                          {verifyingPath === versionsPath ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          Verify
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Presets:</span>
                        <button
                          type="button"
                          onClick={() => { setVersionsPath('Z:\\Versions'); localStorage.setItem('versionsPath', 'Z:\\Versions'); toast.success('Selected Z:\\Versions'); }}
                          className="px-2 py-0.5 bg-slate-200/70 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary rounded text-[11px] font-mono transition-colors cursor-pointer"
                        >
                          Z:\Versions
                        </button>
                        <button
                          type="button"
                          onClick={() => { setVersionsPath('\\\\server-m\\Versions'); localStorage.setItem('versionsPath', '\\\\server-m\\Versions'); toast.success('Selected \\\\server-m\\Versions'); }}
                          className="px-2 py-0.5 bg-slate-200/70 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary rounded text-[11px] font-mono transition-colors cursor-pointer"
                        >
                          \\server-m\Versions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base text-slate-900 dark:text-white">10-Minute Local Backup (AppData)</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5">Automatically save project versions locally every 10 minutes to prevent data loss.</p>

                      <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                        <input
                          type="text"
                          value={localBackupPath}
                          onChange={(e) => setLocalBackupPath(e.target.value)}
                          placeholder="e.g. C:\MEP_Calculator_Autosaves or C:\Users\Admin\AppData\Local\MEPCalc\Backups"
                          className="flex-1 min-w-[200px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handlePickFolder('local')}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                          title="Browse with native Windows folder picker"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Browse
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFolder(localBackupPath, 'Local Backup Folder')}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                          title="Open this folder in Windows Explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyFolder(localBackupPath, 'Local Backup Folder')}
                          disabled={verifyingPath === localBackupPath}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                          title="Verify folder exists and has write permissions"
                        >
                          {verifyingPath === localBackupPath ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          Verify
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Presets:</span>
                        <button
                          type="button"
                          onClick={() => { setLocalBackupPath('C:\\MEP_Calculator_Autosaves'); localStorage.setItem('localBackupPath', 'C:\\MEP_Calculator_Autosaves'); toast.success('Selected C:\\MEP_Calculator_Autosaves'); }}
                          className="px-2 py-0.5 bg-slate-200/70 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary rounded text-[11px] font-mono transition-colors cursor-pointer"
                        >
                          C:\MEP_Calculator_Autosaves
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50/70 dark:bg-slate-800/40 p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                  <div className="flex items-start gap-4">
                    <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20 shrink-0">
                      <Save className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-base text-slate-900 dark:text-white">1-Hour Server Backup</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-3.5">Automatically sync a major version of the project to your local server drive or cloud sync folder every hour.</p>

                      <div className="flex flex-wrap sm:flex-nowrap gap-2 items-center">
                        <input
                          type="text"
                          value={serverBackupPath}
                          onChange={(e) => setServerBackupPath(e.target.value)}
                          placeholder="e.g. Z:\Backups or \\server-m\Backups"
                          className="flex-1 min-w-[200px] px-3.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <button
                          type="button"
                          onClick={() => handlePickFolder('server')}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                          title="Browse with native Windows folder picker"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          Browse
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenFolder(serverBackupPath, 'Server Backup Folder')}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer"
                          title="Open this folder in Windows Explorer"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                          Open
                        </button>
                        <button
                          type="button"
                          onClick={() => handleVerifyFolder(serverBackupPath, 'Server Backup Folder')}
                          disabled={verifyingPath === serverBackupPath}
                          className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                          title="Verify folder exists and has write permissions"
                        >
                          {verifyingPath === serverBackupPath ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          )}
                          Verify
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-600 dark:text-slate-400">Presets:</span>
                        <button
                          type="button"
                          onClick={() => { setServerBackupPath('Z:\\Backups'); localStorage.setItem('serverBackupPath', 'Z:\\Backups'); toast.success('Selected Z:\\Backups'); }}
                          className="px-2 py-0.5 bg-slate-200/70 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary rounded text-[11px] font-mono transition-colors cursor-pointer"
                        >
                          Z:\Backups
                        </button>
                        <button
                          type="button"
                          onClick={() => { setServerBackupPath('\\\\server-m\\Backups'); localStorage.setItem('serverBackupPath', '\\\\server-m\\Backups'); toast.success('Selected \\\\server-m\\Backups'); }}
                          className="px-2 py-0.5 bg-slate-200/70 hover:bg-primary hover:text-white dark:bg-slate-800 dark:hover:bg-primary rounded text-[11px] font-mono transition-colors cursor-pointer"
                        >
                          \\server-m\Backups
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex items-center gap-3">
                  <button
                    onClick={async () => {
                      localStorage.setItem('localBackupPath', localBackupPath);
                      localStorage.setItem('serverBackupPath', serverBackupPath);
                      localStorage.setItem('versionsPath', versionsPath);
                      toast.info("Saving organization backup settings to server...");
                      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
                      const res = await api.saveOrgBackupSettings(localBackupPath, serverBackupPath, versionsPath, myOrgId);
                      if (res && res.success) {
                        toast.success("Organization storage & version settings saved successfully!");
                      } else {
                        toast.error(res.message || "Failed to save backup settings");
                      }
                    }}
                    className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-full transition-colors shadow-sm cursor-pointer"
                  >
                    Save Organization Storage Settings
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Broadcasts Tab */}
          {activeTab === 'broadcasts' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Global Broadcasts</h2>
                <button onClick={fetchAnnouncements} className="text-xs font-bold text-primary hover:underline cursor-pointer">Refresh</button>
              </div>

              <div className="p-4 border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2.5">Create New Broadcast</h3>
                <form onSubmit={handleCreateAnnouncement} className="flex gap-2.5">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Type your message here (e.g., Update 2.0 is coming tomorrow)"
                      required
                      value={newAnnouncementMsg}
                      onChange={(e) => setNewAnnouncementMsg(e.target.value)}
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <select
                    value={newAnnouncementType}
                    onChange={(e) => setNewAnnouncementType(e.target.value as any)}
                    className="text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-32 font-bold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-full text-xs transition-colors shadow-xs cursor-pointer shrink-0"
                  >
                    Broadcast
                  </button>
                </form>
              </div>

              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">Past Broadcasts</h3>
                {loadingAnnouncements ? (
                  <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" /></div>
                ) : announcements.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs font-medium">No broadcasts found.</div>
                ) : (
                  announcements.map((ann) => (
                    <div key={ann.id} className={`p-3.5 rounded-xl border flex items-center justify-between shadow-2xs ${ann.is_active
                      ? 'border-blue-200/80 bg-blue-50/20 dark:border-blue-900/40 dark:bg-blue-950/20'
                      : 'border-slate-200/80 bg-slate-50/50 opacity-60 dark:border-slate-800 dark:bg-slate-900/30'
                      }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                            {ann.type}
                          </span>
                          <span className="text-xs text-slate-500">{new Date(ann.created_at).toLocaleString()}</span>
                        </div>
                        <p className={`text-xs ${ann.is_active ? 'text-slate-900 dark:text-slate-100 font-semibold' : 'line-through text-slate-500'}`}>
                          {ann.message}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button
                          onClick={() => toggleAnnouncement(ann.id, ann.is_active)}
                          className="text-xs px-3.5 py-1.5 rounded-full font-bold transition-colors bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-primary/10 hover:text-primary border border-slate-200 dark:border-slate-700 cursor-pointer"
                        >
                          {ann.is_active ? 'Deactivate' : 'Reactivate'}
                        </button>
                        <button
                          onClick={() => deleteAnnouncement(ann.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Company Branding & Deliverables Customization Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Header with Title and Action Buttons */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">Company Branding & Deliverables</h2>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Permeates All 9 Calculators
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
                    Configure your corporate identity, high-res logo, ISO credentials, 3-tier signature block titles, and legal disclaimers. Automatically injected into all PDF calculation sheets and client Excel deliverables.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetBranding}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <RefreshCw size={14} />
                    Reset Defaults
                  </button>
                  <button
                    type="button"
                    onClick={handleExportSamplePdf}
                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <FileDown size={14} className="text-primary" />
                    Test Sample PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBranding}
                    disabled={isSavingBranding}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isSavingBranding ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {isSavingBranding ? 'Saving...' : 'Save Branding'}
                  </button>
                </div>
              </div>

              {/* Main 2-Column Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* Left Column: Form Controls (7 cols) */}
                <div className="xl:col-span-7 space-y-5">
                  {/* 1. Corporate Identity & Logo Upload Card */}
                  <div className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Corporate Identity & Logo</h3>
                        <p className="text-[11px] text-slate-400">High-resolution company logo and letterhead details</p>
                      </div>
                    </div>

                    {/* Logo Upload Box */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                        Company Logo
                      </label>
                      <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/50 hover:border-primary/50 transition-colors">
                        <div className="w-32 h-16 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs">
                          {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Company Logo" className="max-w-full max-h-full object-contain p-1" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400">
                              <Building2 size={24} className="opacity-50" />
                              <span className="text-[9px] font-semibold mt-1">No Logo</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 justify-center sm:justify-start">
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg cursor-pointer transition-colors border border-primary/20">
                              <UploadCloud size={13} />
                              <span>{logoUploading ? 'Uploading...' : branding.logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                              <input
                                type="file"
                                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                onChange={handleLogoUpload}
                                className="hidden"
                              />
                            </label>
                            {branding.logoUrl && (
                              <button
                                type="button"
                                onClick={handleRemoveLogo}
                                className="px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Recommended: PNG with transparent background or high-contrast SVG / JPEG (Max 2MB).
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Company Details Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Company Legal Name
                        </label>
                        <input
                          type="text"
                          value={branding.companyName}
                          onChange={(e) => setBranding(prev => ({ ...prev, companyName: e.target.value }))}
                          placeholder="e.g. Vikram MEP Engineering Consultancy"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Tagline / Subtitle
                        </label>
                        <input
                          type="text"
                          value={branding.tagline}
                          onChange={(e) => setBranding(prev => ({ ...prev, tagline: e.target.value }))}
                          placeholder="e.g. HVAC • Electrical • Plumbing • Fire Protection"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Consulting License ID
                        </label>
                        <input
                          type="text"
                          value={branding.licenseId}
                          onChange={(e) => setBranding(prev => ({ ...prev, licenseId: e.target.value }))}
                          placeholder="e.g. MEP-CONS-2026-A1"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          ISO Certification Number
                        </label>
                        <input
                          type="text"
                          value={branding.isoCertNumber}
                          onChange={(e) => setBranding(prev => ({ ...prev, isoCertNumber: e.target.value }))}
                          placeholder="e.g. ISO 9001:2015 & ISO 14001:2015"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Corporate Office Address
                        </label>
                        <input
                          type="text"
                          value={branding.address}
                          onChange={(e) => setBranding(prev => ({ ...prev, address: e.target.value }))}
                          placeholder="e.g. Suite 400, Engineering Tower, Tech Park Road, Mumbai"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Official Phone Number
                        </label>
                        <input
                          type="text"
                          value={branding.phone}
                          onChange={(e) => setBranding(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="e.g. +91 98765 43210"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Contact Email
                        </label>
                        <input
                          type="email"
                          value={branding.email}
                          onChange={(e) => setBranding(prev => ({ ...prev, email: e.target.value }))}
                          placeholder="e.g. contact@vikrammep.com"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Official Website URL
                        </label>
                        <input
                          type="text"
                          value={branding.website}
                          onChange={(e) => setBranding(prev => ({ ...prev, website: e.target.value }))}
                          placeholder="e.g. www.vikrammep.com"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Standard 3-Tier Signature & Approval Workflow Card */}
                  <div className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                        <Stamp size={16} />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Standard Signature & Approval Blocks</h3>
                        <p className="text-[11px] text-slate-400">Customize the 3-tier engineering titles and seal options on exported calculation deliverables</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Tier 1: Originator Box
                        </label>
                        <input
                          type="text"
                          value={branding.preparedByTitle}
                          onChange={(e) => setBranding(prev => ({ ...prev, preparedByTitle: e.target.value }))}
                          placeholder="e.g. Design Engineer"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Signed by calculating engineer</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Tier 2: Reviewer Box
                        </label>
                        <input
                          type="text"
                          value={branding.reviewedByTitle}
                          onChange={(e) => setBranding(prev => ({ ...prev, reviewedByTitle: e.target.value }))}
                          placeholder="e.g. Sr. Design Engineer"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Signed upon QA/QC check</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Tier 3: Approver Box
                        </label>
                        <input
                          type="text"
                          value={branding.approvedByTitle}
                          onChange={(e) => setBranding(prev => ({ ...prev, approvedByTitle: e.target.value }))}
                          placeholder="e.g. Discipline Coordinator"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Final sign-off authority</span>
                      </div>
                    </div>

                    {/* Stamp & Seal Toggle */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Stamp size={14} className="text-primary" />
                            <span>Append Engineering Stamp & Seal Box</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            Includes a dedicated box for physical or digital Professional Engineer (PE) rubber stamp / seal next to signatures.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={branding.enableStampBox}
                            onChange={(e) => setBranding(prev => ({ ...prev, enableStampBox: e.target.checked }))}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* 3. Legal Disclaimers & Regulatory Notices Card */}
                  <div className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <FileText size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Standard Legal Disclaimer</h3>
                          <p className="text-[11px] text-slate-400">Appended automatically at the bottom of all calculation deliverables</p>
                        </div>
                      </div>
                    </div>

                    <div>
                      {/* Presets */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Insert Preset:</span>
                        <button
                          type="button"
                          onClick={() => setBranding(prev => ({
                            ...prev,
                            disclaimerText: "CONFIDENTIAL & PROPRIETARY: This calculation sheet is prepared exclusively for the designated project and client. Calculations are performed in accordance with applicable ASHRAE, NBC, IS, and NFPA engineering standards. No alterations or reproductions permitted without written engineering consent."
                          }))}
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Standard Engineering
                        </button>
                        <button
                          type="button"
                          onClick={() => setBranding(prev => ({
                            ...prev,
                            disclaimerText: "PRELIMINARY DESIGN DRAFT: This document represents conceptual sizing for preliminary budget and planning purposes. Final equipment selections and duct/pipe routing must be verified against site coordinates and manufacturer shop submittals prior to fabrication."
                          }))}
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Preliminary Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => setBranding(prev => ({
                            ...prev,
                            disclaimerText: "ISSUED FOR CONSTRUCTION (IFC): All design parameters have been coordinated with architectural and structural layouts. Any field discrepancies must be brought to the engineer of record immediately before commencement of installation."
                          }))}
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Issued For Construction (IFC)
                        </button>
                      </div>

                      <textarea
                        rows={4}
                        value={branding.disclaimerText}
                        onChange={(e) => setBranding(prev => ({ ...prev, disclaimerText: e.target.value }))}
                        placeholder="Enter the legal disclaimer and confidentiality terms for all generated engineering reports..."
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-[11px] leading-relaxed"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Interactive A4 Document Preview Card (5 cols) */}
                <div className="xl:col-span-5 sticky top-4 space-y-4">
                  <div className="p-4 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">Live Deliverable Preview</span>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        A4 Ratio (Scaled)
                      </span>
                    </div>

                    {/* Scaled A4 Sheet Container */}
                    <div className="bg-white text-slate-900 rounded-lg border border-slate-300 shadow-md p-4 space-y-3 font-sans text-[10px] select-none">
                      {/* 1. Corporate Header Band */}
                      <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Logo" className="h-9 max-w-[80px] object-contain shrink-0" />
                          ) : (
                            <div className="w-9 h-9 rounded bg-slate-800 text-white font-bold flex items-center justify-center text-[10px] shrink-0">
                              {(branding.companyName || 'MEP').slice(0, 3).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-[11px] text-slate-950 truncate leading-tight">
                              {branding.companyName || "Vikram MEP Engineering Consultancy"}
                            </h4>
                            <p className="text-[8.5px] italic text-slate-600 truncate">
                              {branding.tagline || "HVAC • Electrical • Plumbing • Fire Protection"}
                            </p>
                          </div>
                        </div>

                        {/* Top Right Credentials */}
                        <div className="text-right shrink-0 text-[8px] space-y-0.5 text-slate-600">
                          {(branding.licenseId || branding.isoCertNumber) && (
                            <div className="font-bold text-slate-800">
                              {[branding.licenseId ? `Lic: ${branding.licenseId}` : '', branding.isoCertNumber ? `ISO: ${branding.isoCertNumber}` : ''].filter(Boolean).join("  |  ")}
                            </div>
                          )}
                          {(branding.phone || branding.email) && (
                            <div>{[branding.phone, branding.email].filter(Boolean).join(" • ")}</div>
                          )}
                          {branding.website && <div className="text-primary font-medium">{branding.website}</div>}
                        </div>
                      </div>

                      {/* 2. Document Title */}
                      <div className="pt-0.5">
                        <h5 className="font-bold text-[10.5px] text-slate-900 uppercase tracking-wide">
                          Ventilation & Smoke Control Calculation Report
                        </h5>
                      </div>

                      {/* 3. Metadata Outer Box */}
                      <div className="border border-slate-800 grid grid-cols-2 divide-x divide-slate-800 text-[8px]">
                        <div className="divide-y divide-slate-800">
                          <div className="p-1 px-1.5 flex justify-between">
                            <span className="font-bold">Calculation No.:</span>
                            <span className="font-normal text-slate-700">TRV-CAL-VENT-001</span>
                          </div>
                          <div className="p-1 px-1.5 flex justify-between">
                            <span className="font-bold">Project No.:</span>
                            <span className="font-normal text-slate-700">PRJ-2026-HQ</span>
                          </div>
                          <div className="p-1 px-1.5 flex justify-between">
                            <span className="font-bold">Project Name:</span>
                            <span className="font-normal text-slate-700 truncate max-w-[100px]">Grand Tower</span>
                          </div>
                        </div>
                        <div className="divide-y divide-slate-800">
                          <div className="p-1 px-1.5 flex justify-between">
                            <span className="font-bold">Rev No. / Date:</span>
                            <span className="font-normal text-slate-700">R0 • {new Date().toLocaleDateString('en-GB')}</span>
                          </div>
                          <div className="p-1 px-1.5 flex justify-between">
                            <span className="font-bold">Client:</span>
                            <span className="font-normal text-slate-700 truncate max-w-[100px]">Apex Infra</span>
                          </div>
                          <div className="p-1 px-1.5 flex justify-between">
                            <span className="font-bold">End User:</span>
                            <span className="font-normal text-slate-700 truncate max-w-[100px]">Metro Authority</span>
                          </div>
                        </div>
                      </div>

                      {/* 4. Simulated Calculation Content */}
                      <div className="space-y-1">
                        <div className="bg-slate-800 text-white font-bold p-1 px-2 rounded-xs flex justify-between text-[8px]">
                          <span>Zone / Description</span>
                          <span>Airflow (CFM)</span>
                          <span>ACH</span>
                          <span>Status</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 p-1 px-2 flex justify-between text-[8px] text-slate-700">
                          <span>Basement Car Park B1</span>
                          <span>14,200 CFM</span>
                          <span>6.2 ACH</span>
                          <span className="text-emerald-600 font-bold">PASSED</span>
                        </div>
                        <div className="bg-white border border-slate-200 p-1 px-2 flex justify-between text-[8px] text-slate-700">
                          <span>Main Electrical Substation</span>
                          <span>4,800 CFM</span>
                          <span>8.1 ACH</span>
                          <span className="text-emerald-600 font-bold">PASSED</span>
                        </div>
                      </div>

                      {/* 5. Standard 3-Tier Signature Block */}
                      <div className="pt-2">
                        <table className="w-full border-collapse border border-slate-400 text-[8px]">
                          <thead>
                            <tr className="bg-[#FDEBDA] text-slate-900 font-bold">
                              <th className="border border-slate-400 p-1 w-1/4 text-right"></th>
                              <th className="border border-slate-400 p-1 w-1/4 text-center">{branding.preparedByTitle || "Design Engineer"}</th>
                              <th className="border border-slate-400 p-1 w-1/4 text-center">{branding.reviewedByTitle || "Sr. Design Engineer"}</th>
                              <th className="border border-slate-400 p-1 w-1/4 text-center">{branding.approvedByTitle || "Discipline Coordinator"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border border-slate-400 p-1 font-bold text-right bg-slate-50">Name:</td>
                              <td className="border border-slate-400 p-1 text-center font-medium">{currentUserProfile?.name || 'Design Lead'}</td>
                              <td className="border border-slate-400 p-1 text-center font-medium">QA Lead</td>
                              <td className="border border-slate-400 p-1 text-center font-medium">Principal Engineer</td>
                            </tr>
                            <tr>
                              <td className="border border-slate-400 p-1 font-bold text-right bg-slate-50">Date:</td>
                              <td className="border border-slate-400 p-1 text-center text-slate-600">{new Date().toLocaleDateString('en-GB')}</td>
                              <td className="border border-slate-400 p-1 text-center text-slate-600">{new Date().toLocaleDateString('en-GB')}</td>
                              <td className="border border-slate-400 p-1 text-center text-slate-600">{new Date().toLocaleDateString('en-GB')}</td>
                            </tr>
                          </tbody>
                        </table>

                        {/* Stamp Box (if enabled) */}
                        {branding.enableStampBox && (
                          <div className="mt-2 flex justify-end">
                            <div className="w-36 h-14 border border-dashed border-slate-400 rounded-xs flex flex-col items-center justify-center p-1 text-slate-500 bg-slate-50/50">
                              <span className="text-[7.5px] font-bold tracking-wider text-slate-700">ENGINEERING STAMP & SEAL</span>
                              <span className="text-[6.5px] italic text-slate-400 mt-0.5">[ Registered PE Seal ]</span>
                            </div>
                          </div>
                        )}

                        {/* Legal Disclaimer Box */}
                        {branding.disclaimerText && (
                          <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xs text-[7px] text-slate-500 leading-tight">
                            <span className="font-bold text-slate-700">Notice: </span>
                            {branding.disclaimerText}
                          </div>
                        )}
                      </div>

                      {/* 6. Footer Line */}
                      <div className="pt-2 border-t border-slate-200 flex justify-between text-[7px] text-slate-400">
                        <span>{branding.companyName || "Vikram MEP Engineering"} • Confidential & Proprietary</span>
                        <span>Page 1 of 1</span>
                      </div>
                    </div>

                    <div className="mt-3 p-2.5 rounded-xl bg-primary/5 border border-primary/10 flex items-center gap-2">
                      <Sparkles size={14} className="text-primary shrink-0" />
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        This branding is saved centrally and immediately permeating all 9 calculator PDF exports, bulk reports, and Excel sheets.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-slate-900 dark:text-white">Invite Team Member</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer">✕</button>
            </div>
            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                <input
                  type="text"
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="john@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Platform Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                >
                  {PLATFORM_ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  {isInviting ? 'Inviting...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

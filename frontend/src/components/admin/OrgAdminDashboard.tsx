import { useNavigate, Link } from '@tanstack/react-router'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState, useMemo, useRef } from 'react'
import { Loader2, Plus, UserPlus, Users, HardDrive, LogOut, FolderOpen, Save, ArrowLeft, Megaphone, Trash2, Filter, Crown, ShieldCheck, Activity, Search, FileText, UserCheck, Eye, Edit3, Key, Copy, Clock, ChevronRight, Lock, Unlock, Download, Archive, FileArchive, Check, ExternalLink, CheckCircle2, FolderKanban, Zap, AlertTriangle, TrendingUp, Sparkles, Layers, Palette, Building2, UploadCloud, RefreshCw, FileDown, Stamp, UserX, UserMinus, ArrowRightLeft, PlayCircle, PauseCircle, Send, CheckCircle, HelpCircle } from "lucide-react"
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { workspaceStore } from '@/lib/workspace-store'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { api } from '@/services/api'
import { useConfirm } from '@/hooks/use-confirm'
import { getCompanyBranding, saveCompanyBranding, DEFAULT_BRANDING, DEFAULT_HEADER_FIELDS, type CompanyBrandingSettings, type HeaderCustomField } from '@/utils/branding'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { addPdfHeader, addPdfSignatureBlock, addPdfFooter } from '@/lib/pdfHelpers'

type Profile = {
  id: string
  email: string
  role: string
  name: string
  status: string
  organization_id?: string
  approvalAuthority?: 'APPROVE_REJECT' | 'REVIEW' | 'NONE' | 'SUBMIT_TASK'
  features?: any
  deactivated_at?: string
  deactivation_reason?: string
  deactivated_by?: string
}

type LicenseUpgradeRequest = {
  id: string
  org_id: string
  org_name: string
  current_seats: number
  requested_seats: number
  target_seats: number
  reason: string
  urgency: string
  contact_phone?: string
  requested_by_name: string
  requested_by_email: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
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

  const [activeTab, setActiveTabState] = useState<'users' | 'projects' | 'activity' | 'storage' | 'broadcasts' | 'branding' | 'licenses'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mep_org_admin_active_tab');
      if (saved && ['users', 'projects', 'activity', 'storage', 'broadcasts', 'branding', 'licenses'].includes(saved)) return saved as any;
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

  // --- Centralized Project Governance & Archive Controls State ---
  const [projectSearchQuery, setProjectSearchQuery] = useState('')
  const [projectStatusFilter, setProjectStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL')
  const [projectTypeFilter, setProjectTypeFilter] = useState<string>('ALL')
  const [projectSortBy, setProjectSortBy] = useState<'lastModified' | 'name' | 'code' | 'created'>('lastModified')
  const [projectToLock, setProjectToLock] = useState<any | null>(null)
  const [lockReason, setLockReason] = useState('')
  const [isLocking, setIsLocking] = useState(false)
  const [isBulkExporting, setIsBulkExporting] = useState(false)
  const [downloadingProjectId, setDownloadingProjectId] = useState<string | null>(null)

  const handleOpenLockModal = (proj: any) => {
    setProjectToLock(proj);
    setLockReason(proj.is_locked ? '' : 'Client Submission / Final Approved Calculations');
  };

  const handleConfirmToggleLock = async () => {
    if (!projectToLock) return;
    setIsLocking(true);
    const targetLockState = !projectToLock.is_locked;
    try {
      const res = await api.toggleProjectLock({
        project_id: projectToLock.id,
        is_locked: targetLockState,
        reason: lockReason.trim() || (targetLockState ? 'Client Submission' : 'Administrative Unlock')
      });

      if (res && res.success) {
        const meta = res.meta || {};
        setProjects(prev => prev.map(p => {
          if (p.id === projectToLock.id) {
            return {
              ...p,
              is_locked: meta.is_locked,
              locked_at: meta.locked_at,
              locked_by: meta.locked_by,
              locked_by_name: meta.locked_by_name,
              lock_reason: meta.lock_reason,
              status: meta.is_locked ? 'LOCKED' : (p.status === 'LOCKED' ? 'active' : p.status),
            };
          }
          return p;
        }));

        // Also update workspaceStore if it's the active project
        try {
          await workspaceStore.toggleProjectLock(
            projectToLock.id,
            targetLockState,
            lockReason.trim()
          );
        } catch (e) {}

        toast.success(
          targetLockState
            ? `Project "${projectToLock.name}" is now locked & frozen against calculation changes.`
            : `Project "${projectToLock.name}" has been unlocked. Calculation edits are now enabled.`
        );
        setProjectToLock(null);
        fetchProjects();
        fetchOrgActivityLogs();
      } else {
        toast.error(res?.message || res?.error || 'Failed to update project lock status');
      }
    } catch (err: any) {
      console.error("Lock toggle failed:", err);
      toast.error('Error updating project lock: ' + (err.message || err));
    } finally {
      setIsLocking(false);
    }
  };

  const handleDownloadSingleProject = async (proj: any) => {
    setDownloadingProjectId(proj.id);
    try {
      let fullProj = proj;
      if (!fullProj.workspace_data) {
        const fetched = await api.getProject(proj.id);
        if (fetched) fullProj = fetched;
      }

      const exportPayload = {
        project_id: fullProj.id,
        code: fullProj.code || '---',
        name: fullProj.name || 'Untitled Project',
        client: fullProj.client || 'N/A',
        location: fullProj.location || 'N/A',
        description: fullProj.description || '',
        building_type: fullProj.building_type || fullProj.type || 'Commercial',
        current_stage: fullProj.current_stage || 'Schematic Design',
        status: fullProj.status || (fullProj.is_locked ? 'LOCKED' : 'active'),
        is_locked: Boolean(fullProj.is_locked),
        locked_at: fullProj.locked_at || null,
        locked_by_name: fullProj.locked_by_name || null,
        lock_reason: fullProj.lock_reason || null,
        created_at: fullProj.created_at || fullProj.createdDate || new Date().toISOString(),
        last_modified: fullProj.last_modified || fullProj.lastModified || fullProj.updated_at || new Date().toISOString(),
        exported_at: new Date().toISOString(),
        exported_by: currentUserProfile?.name || userData?.name || 'Org Admin',
        spaces_count: Array.isArray(fullProj.workspace_data?.spaces) ? fullProj.workspace_data.spaces.length : 0,
        zones_count: Array.isArray(fullProj.workspace_data?.zones) ? fullProj.workspace_data.zones.length : 0,
        equipment_count: Array.isArray(fullProj.workspace_data?.equipment) ? fullProj.workspace_data.equipment.length : 0,
        workspace_data: fullProj.workspace_data || {},
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const cleanCode = String(fullProj.code || 'PROJ').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanName = String(fullProj.name || 'Workspace').replace(/[^a-zA-Z0-9_-]/g, '_');
      saveAs(blob, `${cleanCode}_${cleanName}_calculations.json`);
      toast.success(`Exported calculation workspace for "${fullProj.name}"`);
    } catch (err: any) {
      console.error("Single project export error:", err);
      toast.error('Failed to export project: ' + err.message);
    } finally {
      setDownloadingProjectId(null);
    }
  };

  const handleBulkProjectBackup = async () => {
    setIsBulkExporting(true);
    const toastId = toast.loading("Collecting all organization calculation workspaces...");
    try {
      let exportProjects: any[] = [];
      try {
        const res = await api.getBulkProjectsExport();
        if (res && res.success && Array.isArray(res.projects) && res.projects.length > 0) {
          exportProjects = res.projects;
        }
      } catch (e) {
        console.warn('getBulkProjectsExport error:', e);
      }

      if (exportProjects.length === 0 && Array.isArray(projects) && projects.length > 0) {
        exportProjects = projects;
      }

      if (exportProjects.length === 0) {
        toast.dismiss(toastId);
        toast.error('No organization projects found to backup');
        return;
      }

      toast.loading(`Archiving ${exportProjects.length} project workspaces into ZIP...`, { id: toastId });
      const zip = new JSZip();
      const projectsFolder = zip.folder("projects");

      const manifestProjects: any[] = [];

      for (const p of exportProjects) {
        const cleanCode = String(p.code || 'PROJ').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanName = String(p.name || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${cleanCode}_${cleanName}.json`;

        const wdata = p.workspace_data || {};
        const spacesCount = Array.isArray(wdata.spaces) ? wdata.spaces.length : 0;
        const zonesCount = Array.isArray(wdata.zones) ? wdata.zones.length : 0;
        const equipCount = Array.isArray(wdata.equipment) ? wdata.equipment.length : 0;

        manifestProjects.push({
          id: p.id,
          code: p.code,
          name: p.name,
          client: p.client,
          location: p.location,
          stage: p.current_stage || 'Schematic Design',
          is_locked: Boolean(p.is_locked),
          locked_at: p.locked_at,
          locked_by_name: p.locked_by_name,
          lock_reason: p.lock_reason,
          created_at: p.created_at,
          last_modified: p.last_modified || p.updated_at,
          spaces_count: spacesCount,
          zones_count: zonesCount,
          equipment_count: equipCount,
          file: `projects/${fileName}`
        });

        const projectExportData = {
          ...p,
          exported_at: new Date().toISOString(),
          exported_by: currentUserProfile?.name || userData?.name || 'Org Admin'
        };

        projectsFolder?.file(fileName, JSON.stringify(projectExportData, null, 2));
      }

      const orgDisplayName = orgDetails?.name || currentUserProfile?.company || userData?.company || 'Organization';
      const manifest = {
        organization_id: currentUserProfile?.organization_id || userData?.organization_id || 'org',
        organization_name: orgDisplayName,
        exported_at: new Date().toISOString(),
        exported_by: currentUserProfile?.name || userData?.name || 'Org Admin',
        total_projects: exportProjects.length,
        locked_projects_count: manifestProjects.filter(p => p.is_locked).length,
        projects: manifestProjects
      };

      zip.file("organization_backup_manifest.json", JSON.stringify(manifest, null, 2));

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const dateStr = new Date().toISOString().split('T')[0];
      const cleanOrg = orgDisplayName.replace(/[^a-zA-Z0-9_-]/g, '_');
      saveAs(zipBlob, `${cleanOrg}_MEP_Calculations_Backup_${dateStr}.zip`);

      toast.dismiss(toastId);
      toast.success(`Successfully downloaded complete backup of ${exportProjects.length} projects!`);
      fetchOrgActivityLogs();
    } catch (err: any) {
      console.error("Bulk backup failed:", err);
      toast.dismiss(toastId);
      toast.error('Bulk backup failed: ' + (err.message || err));
    } finally {
      setIsBulkExporting(false);
    }
  };

  const handleOpenProjectInApp = async (proj: any) => {
    try {
      await workspaceStore.selectProject(proj.id);
      navigate({ to: '/dashboard' });
    } catch (e: any) {
      console.error("Open project failed:", e);
      toast.error("Failed to load project into workspace");
    }
  };

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      // Search Filter
      if (projectSearchQuery.trim()) {
        const q = projectSearchQuery.toLowerCase();
        const name = (p.name || '').toLowerCase();
        const code = (p.code || '').toLowerCase();
        const client = (p.client || '').toLowerCase();
        const loc = (p.location || '').toLowerCase();
        const createdBy = (p.created_by_name || p.created_by || '').toLowerCase();
        const matches = name.includes(q) || code.includes(q) || client.includes(q) || loc.includes(q) || createdBy.includes(q);
        if (!matches) return false;
      }

      // Status Filter
      if (projectStatusFilter === 'ACTIVE') {
        if (p.is_locked || p.status === 'LOCKED') return false;
      } else if (projectStatusFilter === 'LOCKED') {
        if (!p.is_locked && p.status !== 'LOCKED') return false;
      }

      // Type Filter
      if (projectTypeFilter !== 'ALL') {
        const bType = (p.building_type || p.type || '').toLowerCase();
        if (!bType.includes(projectTypeFilter.toLowerCase())) return false;
      }

      return true;
    }).sort((a, b) => {
      if (projectSortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '');
      } else if (projectSortBy === 'code') {
        return (a.code || '').localeCompare(b.code || '');
      } else if (projectSortBy === 'created') {
        const dateA = new Date(a.created_at || a.createdDate || 0).getTime();
        const dateB = new Date(b.created_at || b.createdDate || 0).getTime();
        return dateB - dateA;
      } else {
        const dateA = new Date(a.last_modified || a.lastModified || a.updated_at || 0).getTime();
        const dateB = new Date(b.last_modified || b.lastModified || b.updated_at || 0).getTime();
        return dateB - dateA;
      }
    });
  }, [projects, projectSearchQuery, projectStatusFilter, projectTypeFilter, projectSortBy]);

  const projectGovernanceStats = useMemo(() => {
    const total = projects.length;
    const locked = projects.filter(p => p.is_locked || p.status === 'LOCKED').length;
    const active = total - locked;
    let totalSpaces = 0;
    projects.forEach(p => {
      if (p.workspace_data && Array.isArray(p.workspace_data.spaces)) {
        totalSpaces += p.workspace_data.spaces.length;
      }
    });
    return { total, locked, active, totalSpaces };
  }, [projects]);

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
  const [stampUploading, setStampUploading] = useState(false);

  const remoteBrandingLoadedRef = useRef(false);

  useEffect(() => {
    // Only fetch remote branding once on mount so background state updates never overwrite active user edits
    if (remoteBrandingLoadedRef.current) return;

    const loadBranding = async () => {
      const orgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id;
      try {
        const res = await api.getOrgBranding(orgId);
        if (res && res.success && res.branding) {
          remoteBrandingLoadedRef.current = true;
          // Merge remote branding while preserving existing local dynamic header fields if remote has none
          const localCurrent = getCompanyBranding();
          const remoteBranding = res.branding;
          if ((!remoteBranding.headerFields || remoteBranding.headerFields.length === 0) && localCurrent.headerFields && localCurrent.headerFields.length > 0) {
            remoteBranding.headerFields = localCurrent.headerFields;
          }
          saveCompanyBranding(remoteBranding);
          setBranding(getCompanyBranding());
        }
      } catch (e) {
        console.error("Could not fetch remote branding", e);
      }
    };
    if (currentUserProfile || userData || orgDetails) {
      loadBranding();
    }
  }, [currentUserProfile, userData, orgDetails]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset input value immediately so user can re-upload or select same file again
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo file size must be less than 5MB');
      return;
    }

    setLogoUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const rawResult = uploadEvent.target?.result as string;
      if (!rawResult) {
        toast.error('Failed to read image file');
        setLogoUploading(false);
        return;
      }

      // Convert image via Canvas to an optimized PNG format for universal jsPDF and browser compatibility
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width || 320;
          let height = img.naturalHeight || img.height || 120;
          const maxW = 600;
          const maxH = 220;
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedUrl = canvas.toDataURL('image/png', 0.95);
            saveAndApplyLogo(optimizedUrl);
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas optimization error, falling back to raw image:', canvasErr);
        }
        saveAndApplyLogo(rawResult);
      };
      img.onerror = () => {
        // Fallback to raw data url if Image onload fails
        saveAndApplyLogo(rawResult);
      };
      img.src = rawResult;
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
      setLogoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const saveAndApplyLogo = async (logoDataUrl: string) => {
    try {
      const updated = { ...branding, logoUrl: logoDataUrl };
      setBranding(updated);
      saveCompanyBranding(updated);
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
      await api.saveOrgBranding(updated, myOrgId);
      toast.success('Company logo uploaded & saved! Ready for all PDF & Excel deliverables.');
    } catch (err) {
      console.error('Failed syncing logo to server:', err);
      toast.success('Logo uploaded and applied to preview.');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    const updated = { ...branding, logoUrl: '' };
    setBranding(updated);
    saveCompanyBranding(updated);
    try {
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
      await api.saveOrgBranding(updated, myOrgId);
    } catch (e) {}
    toast.info('Logo removed.');
  };

  const handleStampUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Stamp file size must be less than 5MB');
      return;
    }

    setStampUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const rawResult = uploadEvent.target?.result as string;
      if (!rawResult) {
        toast.error('Failed to read stamp file');
        setStampUploading(false);
        return;
      }

      // Convert image via Canvas to optimized PNG with transparency preservation
      const img = new Image();
      img.onload = () => {
        try {
          let width = img.naturalWidth || img.width || 320;
          let height = img.naturalHeight || img.height || 160;
          const maxW = 500;
          const maxH = 260;
          if (width > maxW || height > maxH) {
            const ratio = Math.min(maxW / width, maxH / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const optimizedUrl = canvas.toDataURL('image/png', 0.95);
            saveAndApplyStamp(optimizedUrl);
            return;
          }
        } catch (canvasErr) {
          console.warn('Canvas optimization error for stamp:', canvasErr);
        }
        saveAndApplyStamp(rawResult);
      };
      img.onerror = () => {
        saveAndApplyStamp(rawResult);
      };
      img.src = rawResult;
    };
    reader.onerror = () => {
      toast.error('Failed to read image file');
      setStampUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const saveAndApplyStamp = async (stampDataUrl: string) => {
    try {
      const updated = { ...branding, stampUrl: stampDataUrl, sealUrl: stampDataUrl };
      setBranding(updated);
      saveCompanyBranding(updated);
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
      await api.saveOrgBranding(updated, myOrgId);
      toast.success('Engineering Stamp & Seal uploaded & saved successfully!');
    } catch (err) {
      console.error('Failed syncing stamp to server:', err);
      toast.success('Stamp uploaded and applied to preview.');
    } finally {
      setStampUploading(false);
    }
  };

  const handleRemoveStamp = async () => {
    const updated = { ...branding, stampUrl: '', sealUrl: '' };
    setBranding(updated);
    saveCompanyBranding(updated);
    try {
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
      await api.saveOrgBranding(updated, myOrgId);
    } catch (e) {}
    toast.info('Engineering Stamp & Seal removed.');
  };

  const updateBrandingProperty = (patch: Partial<CompanyBrandingSettings>) => {
    setBranding(prev => {
      const updated: CompanyBrandingSettings = { ...prev, ...patch };
      saveCompanyBranding(updated);
      return updated;
    });
  };

  const handleAddHeaderField = () => {
    const newField: HeaderCustomField = {
      id: 'hf-' + Date.now(),
      label: 'New Field Title',
      value: ''
    };
    setBranding(prev => {
      const updated: CompanyBrandingSettings = {
        ...prev,
        headerFields: [...(prev.headerFields || []), newField]
      };
      saveCompanyBranding(updated);
      return updated;
    });
  };

  const handleUpdateHeaderField = (id: string, key: 'label' | 'value', value: string) => {
    setBranding(prev => {
      const updated: CompanyBrandingSettings = {
        ...prev,
        headerFields: (prev.headerFields || []).map(f => f.id === id ? { ...f, [key]: value } : f)
      };
      saveCompanyBranding(updated);
      return updated;
    });
  };

  const handleRemoveHeaderField = (id: string) => {
    setBranding(prev => {
      const updated: CompanyBrandingSettings = {
        ...prev,
        headerFields: (prev.headerFields || []).filter(f => f.id !== id)
      };
      saveCompanyBranding(updated);
      return updated;
    });
    toast.info('Header field removed.');
  };

  const handleResetHeaderFields = () => {
    setBranding(prev => {
      const updated: CompanyBrandingSettings = {
        ...prev,
        headerFields: [...DEFAULT_HEADER_FIELDS]
      };
      saveCompanyBranding(updated);
      return updated;
    });
    toast.info('Header fields restored to defaults.');
  };

  const handleSaveBranding = async () => {
    setIsSavingBranding(true);
    try {
      saveCompanyBranding(branding);
      const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
      const res = await api.saveOrgBranding(branding, myOrgId);
      if (res && res.success) {
        toast.success('Company branding and report customization saved successfully to cloud!');
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

    setBranding({ ...DEFAULT_BRANDING, headerFields: [...DEFAULT_HEADER_FIELDS] });
    saveCompanyBranding(DEFAULT_BRANDING);
    const myOrgId = currentUserProfile?.organization_id || userData?.organization_id || orgDetails?.id || 'GLOBAL';
    await api.saveOrgBranding(DEFAULT_BRANDING, myOrgId);
    toast.success('Branding reset to default configuration');
  };

  const handleExportSamplePdf = () => {
    try {
      saveCompanyBranding(branding);
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const startY = addPdfHeader(doc, 'VENTILATION & SMOKE CONTROL CALCULATION', {
        calcNo: 'TRV-CAL-VENT-001',
        revNo: 'Rev 0 - IFC',
        projectNo: 'PRJ-2026-HQ',
        projectName: 'Grand Commercial Tower - MEP Design',
        client: 'Apex Infrastructure Ltd',
        endUser: 'Metropolitan Development Authority',
        date: new Date().toLocaleDateString('en-GB'),
        branding: branding
      });

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === 'function') {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === 'function') {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === 'function') {
          pdfDoc.autoTable(options);
        }
      };

      // Render a sample preview table
      callAutoTable(doc, {
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
        approverDate: new Date().toLocaleDateString('en-GB'),
        branding: branding
      });

      addPdfFooter(doc, 1, 1, branding);

      doc.save(`${(branding.companyName || 'MEP').replace(/[^a-zA-Z0-9]/g, '_')}_Sample_Report.pdf`);
      toast.success('Sample branded calculation PDF generated and downloaded!');
    } catch (err: any) {
      console.error('Failed to generate sample PDF:', err);
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

  // License & Capacity Management State
  const [upgradeRequests, setUpgradeRequests] = useState<LicenseUpgradeRequest[]>([])
  const [loadingUpgradeRequests, setLoadingUpgradeRequests] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [upgradeSeatsCount, setUpgradeSeatsCount] = useState<number>(5)
  const [upgradeReason, setUpgradeReason] = useState('')
  const [upgradeUrgency, setUpgradeUrgency] = useState<'Standard' | 'Urgent'>('Standard')
  const [upgradeContactPhone, setUpgradeContactPhone] = useState('')
  const [isSubmittingUpgrade, setIsSubmittingUpgrade] = useState(false)

  // Reassign Seat State
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [selectedFormerUser, setSelectedFormerUser] = useState<Profile | null>(null)
  const [reassignNewName, setReassignNewName] = useState('')
  const [reassignNewEmail, setReassignNewEmail] = useState('')
  const [reassignNewRole, setReassignNewRole] = useState('Design Engineer')
  const [reassignNewAuthority, setReassignNewAuthority] = useState<'APPROVE_REJECT' | 'REVIEW' | 'SUBMIT_TASK' | 'NONE'>('NONE')
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false)

  const fetchUpgradeRequests = async () => {
    setLoadingUpgradeRequests(true)
    try {
      const res = await api.getSeatUpgradeRequests()
      if (res && res.success && Array.isArray(res.requests)) {
        setUpgradeRequests(res.requests)
      }
    } catch (e) {
      console.error('Failed to fetch upgrade requests:', e)
    } finally {
      setLoadingUpgradeRequests(false)
    }
  }

  const fetchUsers = async () => {
    setLoading(true)
    let fetchedUsers = await api.getOrgUsers()

    if (fetchedUsers && fetchedUsers.length > 0) {
      fetchedUsers = fetchedUsers.filter((u: any) => u.role !== 'SUPER_ADMIN' && u.email !== 'admin@tarv.ai');
    }

    setUsers(fetchedUsers || [])
    setLoading(false)
  }

  const fetchOrgActivityLogs = async (customOrgId?: string) => {
    setLoadingLogs(true)
    const myOrgId = customOrgId || currentUserProfile?.organization_id || userData?.organization_id || (userData?.features as any)?.organization_id || orgDetails?.id || '';
    const logs = await api.getOrgActivityLogs(myOrgId)
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
    fetchUpgradeRequests()
    if (activeTab === 'storage') fetchBackupSettings()
    if (activeTab === 'broadcasts') fetchAnnouncements()
    if (activeTab === 'licenses') fetchUpgradeRequests()
  }, [activeTab])

  useEffect(() => {
    if (orgDetails?.id) {
      fetchOrgActivityLogs(orgDetails.id)
    }
  }, [orgDetails?.id])

  // --- KPI Metrics & Statistical Computations ---
  const maxSeats = orgDetails?.max_users || (orgDetails?.subscription_plan === 'ENTERPRISE' ? 500 : 5);
  const activeUsers = useMemo(() => users.filter(u => u && u.status !== 'deactivated' && u.status !== 'inactive'), [users]);
  const deactivatedUsers = useMemo(() => users.filter(u => u && (u.status === 'deactivated' || u.status === 'inactive')), [users]);
  const seatsUsed = activeUsers.length;
  const deactivatedCount = deactivatedUsers.length;
  const availableSeats = Math.max(0, maxSeats - seatsUsed);
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

  const handleDeactivateUser = async (user: Profile) => {
    if (user.id === currentUserProfile?.id) {
      return toast.error("You cannot deactivate your own admin seat.");
    }
    const choice = await confirm(
      `Are you sure you want to temporarily deactivate ${user.name || user.email}'s seat? This frees up 1 seat license for a new hire while preserving all project calculations and audit history.`,
      { title: 'Deactivate Seat License', kind: 'warning' }
    );
    if (!choice) return;

    toast.info(`Deactivating seat for ${user.name || user.email}...`);
    const res = await api.deactivateUserSeat(user.id, 'Deactivated by Org Admin');
    if (res && res.success) {
      toast.success(res.message || `Seat for ${user.name || user.email} deactivated. 1 seat has been freed!`);
      fetchUsers();
    } else {
      toast.error(res?.message || "Failed to deactivate seat");
    }
  };

  const handleReactivateUser = async (user: Profile) => {
    if (isSeatLimitReached) {
      toast.error(`Cannot reactivate: all ${maxSeats} seats are occupied (${seatsUsed}/${maxSeats} Active Seats). Please request additional seats first.`);
      setShowUpgradeModal(true);
      return;
    }
    toast.info(`Reactivating seat for ${user.name || user.email}...`);
    const res = await api.reactivateUserSeat(user.id);
    if (res && res.success) {
      toast.success(res.message || `Seat reactivated successfully for ${user.name || user.email}!`);
      fetchUsers();
    } else {
      toast.error(res?.message || "Failed to reactivate seat");
    }
  };

  const handleOpenReassign = (user: Profile) => {
    setSelectedFormerUser(user);
    setReassignNewName('');
    setReassignNewEmail('');
    setReassignNewRole(user.role || 'Design Engineer');
    setReassignNewAuthority((user.approvalAuthority || (user.features as any)?.approvalAuthority || 'NONE') as any);
    setShowReassignModal(true);
  };

  const handleSubmitReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFormerUser) return;
    if (!reassignNewName.trim() || !reassignNewEmail.trim()) {
      return toast.error("Please enter both Name and Email for the new hire.");
    }
    setIsSubmittingReassign(true);
    toast.info(`Reassigning seat to ${reassignNewName}...`);
    try {
      const res = await api.reassignUserSeat({
        formerUserId: selectedFormerUser.id,
        newHireName: reassignNewName.trim(),
        newHireEmail: reassignNewEmail.trim(),
        newHireRole: reassignNewRole,
        newHireAuthority: reassignNewAuthority
      });
      if (res && res.success) {
        toast.success(res.message || `Seat successfully reassigned to ${reassignNewName}!`);
        setShowReassignModal(false);
        fetchUsers();
      } else {
        toast.error(res?.message || "Failed to reassign seat");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to reassign seat");
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  const handleSubmitUpgradeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (upgradeSeatsCount <= 0) {
      return toast.error("Please select at least 1 additional seat.");
    }
    setIsSubmittingUpgrade(true);
    toast.info(`Submitting request for +${upgradeSeatsCount} seats...`);
    try {
      const res = await api.requestSeatUpgrade({
        requestedSeats: upgradeSeatsCount,
        reason: upgradeReason.trim(),
        urgency: upgradeUrgency,
        contactPhone: upgradeContactPhone.trim()
      });
      if (res && res.success) {
        toast.success(res.message || `Seat upgrade request for +${upgradeSeatsCount} seats submitted to Super Admin!`);
        setShowUpgradeModal(false);
        setUpgradeReason('');
        fetchUpgradeRequests();
      } else {
        toast.error(res?.message || "Failed to submit upgrade request");
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to submit upgrade request");
    } finally {
      setIsSubmittingUpgrade(false);
    }
  };

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
    const orgMemberEmails = new Set(users.map((u: any) => u.email?.toLowerCase().trim()).filter(Boolean));
    const orgMemberIds = new Set(users.map((u: any) => String(u.id || '').toLowerCase().trim()).filter(Boolean));
    const myOrgId = String(currentUserProfile?.organization_id || userData?.organization_id || (userData?.features as any)?.organization_id || orgDetails?.id || '').toLowerCase().trim();

    return activityLogs
      .filter(log => {
        if (!log) return false;

        // 1. Never show global super admin actions or System Admin in org activity
        const logEmail = String(log.email || '').toLowerCase().trim();
        const logAction = String(log.action_type || '');
        if (logEmail === 'admin@tarv.ai') return false;
        if (logAction.startsWith('ADMIN_')) return false;

        // 2. Strict tenant check: if log specifies an org, it must match myOrgId
        const logOrg = String(log.organization_id || log.org_id || '').toLowerCase().trim();
        if (myOrgId && logOrg && logOrg !== myOrgId) return false;

        // 3. User check: if we have org users loaded, verify log belongs to an org member or is stamped with our org
        if (users.length > 0) {
          const logUid = String(log.user_id || '').toLowerCase().trim();
          const isMember = (logEmail && orgMemberEmails.has(logEmail)) || (logUid && orgMemberIds.has(logUid));
          const isOrgTagged = myOrgId && logOrg === myOrgId;
          if (!isMember && !isOrgTagged) return false;
        }

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
  }, [activityLogs, users, currentUserProfile, userData, orgDetails, logCategoryFilter, logProjectFilter, logPageFilter, logSearchQuery, logSortField, logSortOrder]);

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
              onClick={() => setActiveTab('licenses')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'licenses'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Zap size={16} />
                License & Capacity
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                activeTab === 'licenses' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {seatsUsed}/{maxSeats}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('projects')}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'projects'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <FolderKanban size={16} />
                Projects Directory
              </div>
              <div className="flex items-center gap-1">
                {projectGovernanceStats.locked > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-0.5" title={`${projectGovernanceStats.locked} locked / frozen`}>
                    <Lock size={9} />
                    {projectGovernanceStats.locked}
                  </span>
                )}
                <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'projects' ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}>
                  {projects.length}
                </span>
              </div>
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
        activeTab === 'activity' || activeTab === 'projects' || activeTab === 'branding' ? 'flex flex-col overflow-hidden p-3 md:p-4 pb-2' : 'overflow-y-auto space-y-4 p-4 md:p-6'
      }`}>
        {/* Executive KPI Dashboard: 4 Real-time Stat Cards (Rendered only on License & Capacity tab) */}
        {activeTab === 'licenses' && (
        <section className="shrink-0 mb-2">
          {/* Compact 1-line KPI Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Organization Executive KPI & Capacity
              </h2>
              <span className="text-[11px] text-slate-400 hidden md:inline">• {orgDetails?.name || 'Your Organization'}</span>
            </div>
            <button
              onClick={() => {
                fetchUsers();
                fetchProjects();
                fetchOrgDetails();
                fetchOrgActivityLogs();
                toast.success("KPI metrics synchronized with live server data");
              }}
              className="text-[11px] flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold transition-all cursor-pointer shadow-2xs"
              title="Refresh all real-time metrics"
            >
              <Activity className="w-3 h-3 text-primary" />
              <span>Sync Metrics</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {/* Card 1: Seat Utilization */}
            <div 
              onClick={() => setActiveTab('users')}
              className={`p-3 rounded-xl border shadow-2xs transition-all cursor-pointer hover:shadow-xs flex items-center justify-between ${
                isSeatLimitReached
                  ? 'border-red-300 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20'
                  : isSeatNearLimit
                  ? 'border-amber-300 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20'
                  : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-primary/50'
              }`}
              title="Click to view Team Members"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Seat Usage</span>
                  <span className={`text-[10px] font-extrabold ${isSeatLimitReached ? 'text-red-600' : 'text-slate-500'}`}>
                    {seatPercentage}%
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {seatsUsed}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    / {maxSeats} Seats
                  </span>
                  <span className={`ml-auto text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${
                    isSeatLimitReached
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                  }`}>
                    {isSeatLimitReached ? 'FULL' : `${Math.max(0, maxSeats - seatsUsed)} free`}
                  </span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSeatLimitReached ? 'bg-red-500' : isSeatNearLimit ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${seatPercentage}%` }}
                  />
                </div>
              </div>
              <div className={`p-2 rounded-lg shrink-0 border ${
                isSeatLimitReached 
                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                  : isSeatNearLimit 
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' 
                  : 'bg-primary/10 text-primary border-primary/20'
              }`}>
                <Users className="w-4 h-4" />
              </div>
            </div>

            {/* Card 2: Active Projects */}
            <div 
              onClick={() => setActiveTab('projects')}
              className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-all cursor-pointer hover:shadow-xs hover:border-blue-500/50 flex items-center justify-between"
              title="Click to view all company projects"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Active Projects
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {projectStats.active}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Active</span>
                  <span className="text-[11px] text-slate-400">({projectStats.total} total)</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
                  <span>{projectStats.archived} Completed / Locked</span>
                </div>
              </div>
              <div className="p-2 rounded-lg shrink-0 bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <FolderKanban className="w-4 h-4" />
              </div>
            </div>

            {/* Card 3: Pending Review & Approval Queue */}
            <div 
              onClick={() => {
                setActiveTab('activity');
                setLogCategoryFilter('CALCULATION_RUN');
              }}
              className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-all cursor-pointer hover:shadow-xs hover:border-amber-500/50 flex items-center justify-between"
              title="Click to view calculation audit queue"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>Review Queue</span>
                  <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-full border ${
                    reviewStats.totalPending > 0
                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50'
                  }`}>
                    {reviewStats.totalPending > 0 ? 'Pending' : 'All Clear'}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {reviewStats.totalPending}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">Awaiting</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  {reviewStats.submitted} In Review • {reviewStats.reviewed} Ready
                </div>
              </div>
              <div className={`p-2 rounded-lg shrink-0 border ${
                reviewStats.totalPending > 0
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>

            {/* Card 4: License & Subscription Health */}
            <div 
              onClick={() => setActiveTab('licenses')}
              className="p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs transition-all cursor-pointer hover:shadow-xs hover:border-emerald-500/50 flex items-center justify-between"
              title="Click to manage seat capacity & subscription"
            >
              <div className="min-w-0 flex-1 pr-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                  <span>License Plan</span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {licenseStats.daysRemaining}d left
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5 mt-0.5 truncate">
                  <span className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                    {licenseStats.plan}
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold shrink-0">
                    ({seatsUsed}/{maxSeats})
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                  Expires: {licenseStats.formattedExpiry}
                </div>
              </div>
              <div className={`p-2 rounded-lg shrink-0 border ${
                licenseStats.isExpired
                  ? 'bg-red-500/10 text-red-500 border-red-500/20'
                  : licenseStats.isExpiringSoon
                  ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                <Zap className="w-4 h-4" />
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Tab Content Container */}
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs ${
          activeTab === 'activity' || activeTab === 'projects' || activeTab === 'branding' ? 'flex-1 min-h-0 flex flex-col overflow-hidden p-3.5 md:p-4 pb-1.5 md:pb-2' : 'p-5 md:p-6 space-y-5'
        }`}>
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-xl font-bold text-slate-900 dark:text-white">Organization Team Members</h2>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${isSeatLimitReached
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                        : 'bg-primary/10 text-primary border-primary/25'
                        }`}>
                        {seatsUsed} / {maxSeats} Active Seats {isSeatLimitReached ? '(FULL)' : ''}
                      </span>
                      {deactivatedCount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                          {deactivatedCount} Deactivated (Seat Freed)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Manage user access, review rights, and seat assignments. Deactivating a seat frees up 1 license for new hires without deleting past calculations.
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-all cursor-pointer shadow-2xs"
                      title="Request additional seats from Super Admin"
                    >
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span>Request Additional Seats</span>
                    </button>
                    <button
                      disabled={isSeatLimitReached}
                      onClick={() => {
                        if (isSeatLimitReached) {
                          toast.error(`Seat limit reached (${seatsUsed}/${maxSeats} Active). Deactivate an inactive user seat to free up a license or request additional seats.`);
                          setShowUpgradeModal(true);
                          return;
                        }
                        setShowInviteModal(true);
                      }}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold transition-all shrink-0 shadow-sm ${isSeatLimitReached
                        ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer'
                        }`}
                      title={isSeatLimitReached ? `Seat limit full (${seatsUsed}/${maxSeats} Active Used)` : 'Invite Team Member'}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isSeatLimitReached ? `Seat Limit Full (${seatsUsed}/${maxSeats})` : '+ Invite Team Member'}</span>
                    </button>
                  </div>
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
                                  {u.status === 'deactivated' || u.status === 'inactive' ? (
                                    <div className="flex flex-col gap-0.5">
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-full text-[11px] font-bold w-fit">
                                        <UserX size={12} className="text-amber-600 dark:text-amber-400" />
                                        Deactivated (Seat Freed)
                                      </span>
                                      {u.deactivated_at && (
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 pl-1">
                                          {new Date(u.deactivated_at).toLocaleDateString()}
                                        </span>
                                      )}
                                    </div>
                                  ) : u.status === 'invited' ? (
                                    <span className="px-2.5 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 rounded-full text-[11px] font-bold">
                                      Pending Invite
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-[11px] font-bold">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      Active (1 Seat)
                                    </span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5 text-right">
                                  {u.id !== currentUserProfile?.id && (
                                    <div className="flex items-center justify-end gap-1.5">
                                      {/* If Active: Allow Deactivating Seat to free license */}
                                      {u.status !== 'deactivated' && u.status !== 'inactive' ? (
                                        <button
                                          onClick={() => handleDeactivateUser(u)}
                                          className="p-1.5 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-amber-200 dark:hover:border-amber-800/50"
                                          title="Temporarily deactivate seat & free 1 license for new hires (preserves project history)"
                                        >
                                          <UserMinus className="w-4 h-4" />
                                        </button>
                                      ) : (
                                        /* If Deactivated: Allow Reactivate and Reassign */
                                        <>
                                          <button
                                            onClick={() => handleReactivateUser(u)}
                                            className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800/50"
                                            title="Reactivate seat for this member"
                                          >
                                            <UserCheck className="w-4 h-4" />
                                          </button>
                                          <button
                                            onClick={() => handleOpenReassign(u)}
                                            className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-blue-200 dark:hover:border-blue-800/50"
                                            title="Reassign this seat to a new hire without losing project history"
                                          >
                                            <ArrowRightLeft className="w-4 h-4" />
                                          </button>
                                        </>
                                      )}

                                      <button
                                        onClick={() => handleRemoveUser(u)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                        title="Permanently remove user"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
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

          {/* Projects Directory & Governance Tab */}
          {activeTab === 'projects' && (
            <div className="flex-1 min-h-0 flex flex-col space-y-3">
              {/* Header with Title and Actions */}
              <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FolderKanban className="w-5 h-5 text-primary" />
                      Organization Projects Directory & Governance
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-primary/10 text-primary border-primary/25">
                      {projects.length} Total Workspaces
                    </span>
                    {projectGovernanceStats.locked > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center gap-1">
                        <Lock size={12} />
                        {projectGovernanceStats.locked} Frozen / Locked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Centralized directory of all calculation workspaces across your organization. Freeze completed projects to prevent accidental edits after client submission, or download complete bulk backups.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={fetchProjects}
                    disabled={loadingProjects}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                    title="Refresh projects list from server"
                  >
                    <RefreshCw size={14} className={loadingProjects ? "animate-spin" : ""} />
                    <span>Refresh</span>
                  </button>

                  <button
                    onClick={handleBulkProjectBackup}
                    disabled={isBulkExporting || projects.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    title="Download all organization project calculation files as a single ZIP archive"
                  >
                    {isBulkExporting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Generating ZIP...</span>
                      </>
                    ) : (
                      <>
                        <FileArchive size={14} />
                        <span>Bulk Project Backup (.ZIP)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* KPI Mini-Cards Ribbon for Projects */}
              <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Workspaces</div>
                    <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{projectGovernanceStats.total}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <FolderKanban size={18} />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Workspaces</div>
                    <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">{projectGovernanceStats.active}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 size={18} />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Frozen / Locked</div>
                    <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5">{projectGovernanceStats.locked}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    <Lock size={18} />
                  </div>
                </div>

                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Managed Spaces</div>
                    <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">{projectGovernanceStats.totalSpaces}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <Layers size={18} />
                  </div>
                </div>
              </div>

              {/* Filter and Search Bar */}
              <div className="shrink-0 p-3 bg-slate-50/70 dark:bg-slate-800/40 rounded-xl border border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mr-1 flex items-center gap-1">
                    <Filter size={13} className="text-primary" /> Filter:
                  </span>
                  {[
                    { id: 'ALL', label: `All (${projects.length})` },
                    { id: 'ACTIVE', label: `🟢 Active (${projectGovernanceStats.active})` },
                    { id: 'LOCKED', label: `🔒 Frozen (${projectGovernanceStats.locked})` }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setProjectStatusFilter(tab.id as any)}
                      className={`text-xs px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
                        projectStatusFilter === tab.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-primary/5 hover:text-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}

                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

                  {/* Building Type Filter */}
                  <select
                    value={projectTypeFilter}
                    onChange={(e) => setProjectTypeFilter(e.target.value)}
                    className="h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="ALL">All Building Types</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Residential">Residential</option>
                    <option value="Healthcare">Healthcare</option>
                    <option value="Data Center">Data Center</option>
                    <option value="Industrial">Industrial</option>
                    <option value="Hospitality">Hospitality</option>
                    <option value="Educational">Educational</option>
                    <option value="Mixed Use">Mixed Use</option>
                  </select>

                  {/* Sort Filter */}
                  <select
                    value={projectSortBy}
                    onChange={(e) => setProjectSortBy(e.target.value as any)}
                    className="h-8 px-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="lastModified">Recently Modified</option>
                    <option value="created">Creation Date</option>
                    <option value="name">Project Name (A-Z)</option>
                    <option value="code">Project Code</option>
                  </select>
                </div>

                {/* Search Input */}
                <div className="relative w-full md:w-72 shrink-0">
                  <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={projectSearchQuery}
                    onChange={(e) => setProjectSearchQuery(e.target.value)}
                    placeholder="Search code, name, client, author..."
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  {projectSearchQuery && (
                    <button
                      onClick={() => setProjectSearchQuery('')}
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Projects Table (Scrollable Viewport) */}
              <div className="flex-1 min-h-0 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs bg-white dark:bg-slate-900 flex flex-col">
                {loadingProjects ? (
                  <div className="p-12 text-center my-auto">
                    <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-slate-500 font-medium mt-2.5">Loading organization project directory...</p>
                  </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="p-12 text-center text-slate-500 space-y-2 my-auto">
                    <FolderKanban className="w-10 h-10 mx-auto opacity-30 text-slate-400" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No projects match the selected criteria.</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      Try resetting your search query or status filter to see all organization projects.
                    </p>
                    {(projectSearchQuery || projectStatusFilter !== 'ALL' || projectTypeFilter !== 'ALL') && (
                      <button
                        onClick={() => {
                          setProjectSearchQuery('');
                          setProjectStatusFilter('ALL');
                          setProjectTypeFilter('ALL');
                        }}
                        className="mt-2 text-xs font-bold text-primary hover:underline cursor-pointer"
                      >
                        Reset all filters
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-500 uppercase tracking-wider shadow-xs">
                        <tr>
                          <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900">Project Code & Name</th>
                          <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900">Client & Location</th>
                          <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900">Type</th>
                          <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900">Stage</th>
                          <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900">Calculations</th>
                          <th className="px-4 py-3 bg-slate-50 dark:bg-slate-900">Governance Status</th>
                          <th className="px-4 py-3 text-right bg-slate-50 dark:bg-slate-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                        {filteredProjects.map((p) => {
                          const isLocked = Boolean(p.is_locked || p.status === 'LOCKED');
                          const wdata = p.workspace_data || {};
                          const spacesCount = Array.isArray(wdata.spaces) ? wdata.spaces.length : 0;
                          const zonesCount = Array.isArray(wdata.zones) ? wdata.zones.length : 0;
                          const equipCount = Array.isArray(wdata.equipment) ? wdata.equipment.length : 0;

                          return (
                            <tr
                              key={p.id}
                              className={`transition-colors ${
                                isLocked
                                  ? 'bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/40 dark:hover:bg-amber-950/20'
                                  : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                              }`}
                            >
                              {/* Project Code & Name */}
                              <td className="px-4 py-3.5">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-[11px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200">
                                      {p.code || 'PROJ'}
                                    </span>
                                    <span className="text-xs font-bold text-slate-900 dark:text-white hover:text-primary transition-colors">
                                      {p.name}
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate max-w-xs">
                                    {p.description || `Created by ${p.created_by_name || p.created_by || 'Team Member'}`}
                                  </div>
                                </div>
                              </td>

                              {/* Client & Location */}
                              <td className="px-4 py-3.5 text-xs">
                                <div className="font-semibold text-slate-800 dark:text-slate-200">{p.client || 'N/A'}</div>
                                <div className="text-[11px] text-slate-400">{p.location || 'N/A'}</div>
                              </td>

                              {/* Building Type */}
                              <td className="px-4 py-3.5 text-xs">
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                  {p.building_type || p.type || 'Commercial'}
                                </span>
                              </td>

                              {/* Stage */}
                              <td className="px-4 py-3.5 text-xs">
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                                    {p.current_stage || 'Schematic Design'}
                                  </span>
                                  <div className="w-20 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full"
                                      style={{
                                        width:
                                          p.current_stage === 'Issued For Construction' ? '100%' :
                                          p.current_stage === 'Tender Documentation' ? '80%' :
                                          p.current_stage === 'Detailed Design' ? '60%' :
                                          p.current_stage === 'Schematic Design' ? '40%' : '20%'
                                      }}
                                    />
                                  </div>
                                </div>
                              </td>

                              {/* Calculations Data Scope */}
                              <td className="px-4 py-3.5 text-xs">
                                <div className="text-slate-700 dark:text-slate-300 font-medium text-[11px]">
                                  <span className="font-bold text-slate-900 dark:text-white">{spacesCount}</span> spaces • <span className="font-bold text-slate-900 dark:text-white">{zonesCount}</span> zones
                                </div>
                                <div className="text-[10.5px] text-slate-400">
                                  {equipCount} equipment items
                                </div>
                              </td>

                              {/* Governance Status */}
                              <td className="px-4 py-3.5 text-xs">
                                {isLocked ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      <Lock size={11} className="text-amber-600 dark:text-amber-400" />
                                      FROZEN / LOCKED
                                    </span>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                      {p.locked_by_name ? `By ${p.locked_by_name}` : 'Locked'}
                                      {p.locked_at ? ` • ${new Date(p.locked_at).toLocaleDateString()}` : ''}
                                    </div>
                                    {p.lock_reason && (
                                      <div className="text-[10px] text-amber-600/90 dark:text-amber-400/90 italic truncate max-w-[170px]" title={p.lock_reason}>
                                        "{p.lock_reason}"
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      Active (Editable)
                                    </span>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      Modified: {new Date(p.last_modified || p.lastModified || p.updated_at || Date.now()).toLocaleDateString()}
                                    </div>
                                  </div>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Lock / Freeze Button */}
                                  {isLocked ? (
                                    <button
                                      onClick={() => handleOpenLockModal(p)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors cursor-pointer"
                                      title="Unlock project to enable calculation editing for revisions"
                                    >
                                      <Unlock size={12} className="text-emerald-600" />
                                      <span>Unlock</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleOpenLockModal(p)}
                                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 rounded-lg transition-colors cursor-pointer"
                                      title="Freeze calculations to prevent accidental edits after client submission"
                                    >
                                      <Lock size={12} />
                                      <span>Lock / Freeze</span>
                                    </button>
                                  )}

                                  {/* Download Project Calculations JSON */}
                                  <button
                                    onClick={() => handleDownloadSingleProject(p)}
                                    disabled={downloadingProjectId === p.id}
                                    className="p-1.5 text-slate-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                                    title="Download complete calculation workspace file (.json)"
                                  >
                                    {downloadingProjectId === p.id ? (
                                      <Loader2 size={14} className="animate-spin text-primary" />
                                    ) : (
                                      <Download size={14} />
                                    )}
                                  </button>

                                  {/* Open in App */}
                                  <button
                                    onClick={() => handleOpenProjectInApp(p)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-800"
                                    title="Open this project in the calculation workspace"
                                  >
                                    <ExternalLink size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
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
            <div className="flex-1 min-h-0 flex flex-col">
              {/* Header with Title and Action Buttons (Static) */}
              <div className="shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-4 mb-4">
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

              {/* Scrollable Form Body */}
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                {/* Main 2-Column Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start pb-6">
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
                        <div
                          onClick={() => document.getElementById('org-admin-logo-upload-input')?.click()}
                          className="w-32 h-16 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs cursor-pointer hover:border-primary/60 transition-colors group"
                          title="Click to choose company logo"
                        >
                          {branding.logoUrl ? (
                            <img src={branding.logoUrl} alt="Company Logo" className="max-w-full max-h-full object-contain p-1" />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-primary transition-colors">
                              <Building2 size={24} className="opacity-50" />
                              <span className="text-[9px] font-semibold mt-1">Click to Upload</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2 justify-center sm:justify-start">
                            <label
                              htmlFor="org-admin-logo-upload-input"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg cursor-pointer transition-colors border border-primary/20"
                            >
                              {logoUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                              <span>{logoUploading ? 'Processing...' : branding.logoUrl ? 'Change Logo' : 'Upload Logo'}</span>
                            </label>
                            <input
                              id="org-admin-logo-upload-input"
                              type="file"
                              accept="image/png,image/jpeg,image/svg+xml,image/webp"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
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
                            Recommended: PNG with transparent background or high-contrast SVG / JPEG (Max 5MB).
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
                          value={branding.companyName || ''}
                          onChange={(e) => updateBrandingProperty({ companyName: e.target.value })}
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
                          value={branding.tagline || ''}
                          onChange={(e) => updateBrandingProperty({ tagline: e.target.value })}
                          placeholder="e.g. HVAC • Electrical • Plumbing • Fire Protection"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                      </div>
                    </div>

                    {/* Dynamic Header Fields & Credentials Editor */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Header Credentials & Details (Dynamic Fields)
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {(branding.headerFields || []).length} Fields
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">
                            Edit titles and values, delete unneeded fields, or add custom entries (e.g. Tax ID, GSTIN, Branch).
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleResetHeaderFields}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            title="Reset to default fields (License, ISO, Address, Phone, Email, Website)"
                          >
                            Restore Defaults
                          </button>
                          <button
                            type="button"
                            onClick={handleAddHeaderField}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg border border-primary/20 cursor-pointer transition-colors"
                          >
                            <Plus size={13} />
                            <span>Add Field</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveBranding}
                            disabled={isSavingBranding}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                            title="Save header fields & branding to server"
                          >
                            {isSavingBranding ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            <span>Save Changes</span>
                          </button>
                        </div>
                      </div>

                      {/* Header Fields List */}
                      <div className="space-y-2.5">
                        {(!branding.headerFields || branding.headerFields.length === 0) ? (
                          <div className="p-4 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                            No custom header fields defined. Click <strong>+ Add Field</strong> or <strong>Restore Defaults</strong> to configure top-right report credentials.
                          </div>
                        ) : (
                          branding.headerFields.map((field) => (
                            <div
                              key={field.id}
                              className="group flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 hover:border-primary/40 transition-colors"
                            >
                              {/* Field Title / Label */}
                              <div className="sm:w-1/3 min-w-[130px]">
                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Field Title
                                </label>
                                <input
                                  type="text"
                                  value={field.label}
                                  onChange={(e) => handleUpdateHeaderField(field.id, 'label', e.target.value)}
                                  placeholder="e.g. License ID, GSTIN, Address"
                                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary font-semibold"
                                />
                              </div>

                              {/* Field Value */}
                              <div className="flex-1 min-w-0">
                                <label className="block text-[9.5px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">
                                  Field Value
                                </label>
                                <input
                                  type="text"
                                  value={field.value}
                                  onChange={(e) => handleUpdateHeaderField(field.id, 'value', e.target.value)}
                                  placeholder="Enter credential, phone, address, or details..."
                                  className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                />
                              </div>

                              {/* Delete Trash Button */}
                              <div className="sm:self-end pt-1 sm:pt-0">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveHeaderField(field.id)}
                                  className="w-full sm:w-auto p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer flex items-center justify-center gap-1"
                                  title={`Remove ${field.label || 'field'} from report headers`}
                                >
                                  <Trash2 size={14} />
                                  <span className="sm:hidden text-xs font-semibold text-red-500">Remove Field</span>
                                </button>
                              </div>
                            </div>
                          ))
                        )}
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
                          value={branding.preparedByTitle || ''}
                          onChange={(e) => updateBrandingProperty({ preparedByTitle: e.target.value })}
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
                          value={branding.reviewedByTitle || ''}
                          onChange={(e) => updateBrandingProperty({ reviewedByTitle: e.target.value })}
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
                          value={branding.approvedByTitle || ''}
                          onChange={(e) => updateBrandingProperty({ approvedByTitle: e.target.value })}
                          placeholder="e.g. Discipline Coordinator"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-semibold"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Final sign-off authority</span>
                      </div>
                    </div>

                    {/* Stamp & Seal Toggle & Graphic Upload */}
                    <div className="pt-2 space-y-3">
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
                            checked={Boolean(branding.enableStampBox)}
                            onChange={(e) => updateBrandingProperty({ enableStampBox: e.target.checked, showStampBox: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
                        </label>
                      </div>

                      {/* Photo / Graphic of Stamp & Seal (Shown when enabled) */}
                      {branding.enableStampBox && (
                        <div className="p-4 border border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Stamp size={13} className="text-indigo-600 dark:text-indigo-400" />
                                <span>Official Engineering Stamp & PE Seal Photo</span>
                              </div>
                              <p className="text-[10.5px] text-slate-500 dark:text-slate-400">
                                Upload a photo or graphic of your licensed engineer rubber stamp or authority seal to automatically display inside calculation deliverables.
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
                            <div
                              onClick={() => document.getElementById('org-admin-stamp-upload-input')?.click()}
                              className="w-36 h-20 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs cursor-pointer hover:border-indigo-500/60 transition-colors group p-1"
                              title="Click to choose Stamp & Seal photo"
                            >
                              {branding.stampUrl ? (
                                <img src={branding.stampUrl} alt="Engineering Stamp" className="max-w-full max-h-full object-contain" />
                              ) : (
                                <div className="flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors text-center px-1">
                                  <Stamp size={22} className="opacity-50 mb-1" />
                                  <span className="text-[9px] font-semibold">Upload Stamp Photo</span>
                                </div>
                              )}
                            </div>

                            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
                              <div className="flex items-center gap-2 justify-center sm:justify-start">
                                <label
                                  htmlFor="org-admin-stamp-upload-input"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg cursor-pointer transition-colors border border-indigo-500/20"
                                >
                                  {stampUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                                  <span>{stampUploading ? 'Processing...' : branding.stampUrl ? 'Change Stamp Photo' : 'Upload Stamp Photo'}</span>
                                </label>
                                <input
                                  id="org-admin-stamp-upload-input"
                                  type="file"
                                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                                  onChange={handleStampUpload}
                                  className="hidden"
                                />
                                {branding.stampUrl && (
                                  <button
                                    type="button"
                                    onClick={handleRemoveStamp}
                                    className="px-2.5 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Recommended: Circular PE seal or firm stamp on transparent background (PNG / JPEG up to 5MB).
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 3. Legal Disclaimers & Custom Footer Card */}
                  <div className="p-5 border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-xs space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <FileText size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Legal Notice & Custom Footer Design</h3>
                          <p className="text-[11px] text-slate-400">Appended automatically at the bottom of all calculation deliverables</p>
                        </div>
                      </div>
                    </div>

                    {/* Footer Controls: Left Text, Right Text, Show Page Numbers */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Left Footer Text (Confidentiality / Tag)
                        </label>
                        <input
                          type="text"
                          value={branding.footerLeftText || ''}
                          onChange={(e) => updateBrandingProperty({ footerLeftText: e.target.value })}
                          placeholder={`e.g. ${branding.companyName || 'Vikram MEP Consultancy'} • Confidential & Proprietary`}
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Bottom-left of every report page (defaults to Company Name • Confidential)</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                          Right Footer Text (Certification / Tag)
                        </label>
                        <input
                          type="text"
                          value={branding.footerRightText || ''}
                          onChange={(e) => updateBrandingProperty({ footerRightText: e.target.value })}
                          placeholder="e.g. All Rights Reserved • ISO 9001:2015"
                          className="w-full text-xs p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        />
                        <span className="text-[10px] text-slate-400 mt-1 block">Bottom-right next to or replacing page numbering</span>
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
                        <div>
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">Include Page Numbers ("Page X of Y")</span>
                          <p className="text-[10px] text-slate-400">Automatically display dynamic page counts on the bottom-right footer of all exported calculation pages</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={branding.showPageNumbers !== false}
                          onChange={(e) => updateBrandingProperty({ showPageNumbers: e.target.checked })}
                          className="w-4 h-4 text-primary rounded border-slate-300 focus:ring-primary cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                          Legal Disclaimer & Regulatory Notice
                        </label>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Title:</span>
                          <input
                            type="text"
                            value={branding.disclaimerTitle || ''}
                            onChange={(e) => updateBrandingProperty({ disclaimerTitle: e.target.value })}
                            placeholder="e.g. Notice & Legal Disclaimer"
                            className="text-xs p-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-1 focus:ring-primary w-48 font-semibold"
                          />
                        </div>
                      </div>

                      {/* Presets */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Insert Preset:</span>
                        <button
                          type="button"
                          onClick={() => updateBrandingProperty({
                            disclaimerText: "CONFIDENTIAL & PROPRIETARY: This calculation sheet is prepared exclusively for the designated project and client. Calculations are performed in accordance with applicable ASHRAE, NBC, IS, and NFPA engineering standards. No alterations or reproductions permitted without written engineering consent.",
                            disclaimer: "CONFIDENTIAL & PROPRIETARY: This calculation sheet is prepared exclusively for the designated project and client. Calculations are performed in accordance with applicable ASHRAE, NBC, IS, and NFPA engineering standards. No alterations or reproductions permitted without written engineering consent."
                          })}
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Standard Engineering
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBrandingProperty({
                            disclaimerText: "PRELIMINARY DESIGN DRAFT: This document represents conceptual sizing for preliminary budget and planning purposes. Final equipment selections and duct/pipe routing must be verified against site coordinates and manufacturer shop submittals prior to fabrication.",
                            disclaimer: "PRELIMINARY DESIGN DRAFT: This document represents conceptual sizing for preliminary budget and planning purposes. Final equipment selections and duct/pipe routing must be verified against site coordinates and manufacturer shop submittals prior to fabrication."
                          })}
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Preliminary Draft
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBrandingProperty({
                            disclaimerText: "ISSUED FOR CONSTRUCTION (IFC): All design parameters have been coordinated with architectural and structural layouts. Any field discrepancies must be brought to the engineer of record immediately before commencement of installation.",
                            disclaimer: "ISSUED FOR CONSTRUCTION (IFC): All design parameters have been coordinated with architectural and structural layouts. Any field discrepancies must be brought to the engineer of record immediately before commencement of installation."
                          })}
                          className="text-[10px] font-semibold px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                        >
                          Issued For Construction (IFC)
                        </button>
                      </div>

                      <textarea
                        rows={4}
                        value={branding.disclaimerText || ''}
                        onChange={(e) => updateBrandingProperty({ disclaimerText: e.target.value, disclaimer: e.target.value })}
                        placeholder="Enter the legal disclaimer and confidentiality terms for all generated engineering reports..."
                        className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-[11px] leading-relaxed"
                      />
                    </div>

                    <div className="pt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSaveBranding}
                        disabled={isSavingBranding}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors shadow-2xs disabled:opacity-50"
                        title="Save footer and branding settings to cloud server"
                      >
                        {isSavingBranding ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                        <span>Save Branding Changes</span>
                      </button>
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
                        <div className="text-right shrink-0 text-[7.5px] space-y-0.5 text-slate-600 max-w-[210px]">
                          {branding.headerFields && branding.headerFields.length > 0 ? (
                            branding.headerFields.filter(f => (f.label && f.label.trim()) || (f.value && f.value.trim())).slice(0, 7).map(f => (
                              <div key={f.id} className="truncate">
                                <span className="font-bold text-slate-800">{f.label || 'Field'}: </span>
                                <span className="text-slate-600">{f.value || <span className="text-slate-400 italic font-normal">[value]</span>}</span>
                              </div>
                            ))
                          ) : (
                            <>
                              {(branding.licenseId || branding.isoCertNumber) && (
                                <div className="font-bold text-slate-800">
                                  {[branding.licenseId ? `Lic: ${branding.licenseId}` : '', branding.isoCertNumber ? `ISO: ${branding.isoCertNumber}` : ''].filter(Boolean).join("  |  ")}
                                </div>
                              )}
                              {(branding.phone || branding.email) && (
                                <div>{[branding.phone, branding.email].filter(Boolean).join(" • ")}</div>
                              )}
                              {branding.website && <div className="text-primary font-medium">{branding.website}</div>}
                            </>
                          )}
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
                            <div className="w-36 h-14 border border-dashed border-slate-400 rounded-xs flex flex-col items-center justify-center p-1 text-slate-500 bg-slate-50/50 overflow-hidden relative">
                              {branding.stampUrl ? (
                                <img src={branding.stampUrl} alt="Engineering Stamp & Seal" className="max-w-full max-h-full object-contain" />
                              ) : (
                                <>
                                  <span className="text-[7.5px] font-bold tracking-wider text-slate-700">ENGINEERING STAMP & SEAL</span>
                                  <span className="text-[6.5px] italic text-slate-400 mt-0.5">[ Registered PE Seal ]</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Legal Disclaimer Box */}
                        {branding.disclaimerText && (
                          <div className="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded-xs text-[7px] text-slate-500 leading-tight">
                            <span className="font-bold text-slate-700">{branding.disclaimerTitle || "Notice"}: </span>
                            {branding.disclaimerText}
                          </div>
                        )}
                      </div>

                      {/* 6. Footer Line */}
                      <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-[7px] text-slate-400">
                        <span className="truncate max-w-[200px]">
                          {branding.footerLeftText || `${branding.companyName || "Vikram MEP Engineering"} • Confidential & Proprietary`}
                        </span>
                        <span className="shrink-0 text-right">
                          {branding.showPageNumbers !== false ? 'Page 1 of 1' : ''}
                          {branding.footerRightText ? `${branding.showPageNumbers !== false ? ' • ' : ''}${branding.footerRightText}` : ''}
                        </span>
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
          </div>
        )}

          {/* License & Capacity Management Tab */}
          {activeTab === 'licenses' && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Zap className="w-5 h-5 text-primary" />
                      License & Seat Capacity Management
                    </h2>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${isSeatLimitReached
                      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/50'
                      : 'bg-primary/10 text-primary border-primary/25'
                    }`}>
                      {seatsUsed} / {maxSeats} Active Seats {isSeatLimitReached ? '(FULL)' : ''}
                    </span>
                    {deactivatedCount > 0 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50">
                        {deactivatedCount} Deactivated (Seat Freed)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Manage enterprise seat allocations, request capacity upgrades from Super Admin, or temporarily deactivate seats to reassign to new hires without losing any project calculation history.
                  </p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    onClick={() => {
                      fetchUsers();
                      fetchUpgradeRequests();
                      toast.success("License and seat capacity refreshed");
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => {
                      setUpgradeSeatsCount(5);
                      setShowUpgradeModal(true);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground transition-all cursor-pointer shadow-xs"
                  >
                    <Zap className="w-4 h-4" />
                    <span>Request Additional Seats</span>
                  </button>
                </div>
              </div>

              {/* Organization License Key Card (Step E: Admin Shares License with Users) */}
              <div className="p-4 rounded-2xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 dark:from-indigo-950/40 dark:via-slate-900 dark:to-purple-950/20 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200 dark:border-indigo-800">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">Organization License Key</h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                        Share with Team
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Share this license key with engineers in your organization. When they paste it in their application popup, they will automatically join your organization.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <code className="px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-xl font-mono text-xs font-bold text-indigo-700 dark:text-indigo-300 tracking-wider shadow-2xs">
                    {orgDetails?.license_key || 'MEP-LIC-ORG-PRO'}
                  </code>
                  <button
                    type="button"
                    onClick={() => {
                      const key = orgDetails?.license_key || 'MEP-LIC-ORG-PRO';
                      navigator.clipboard.writeText(key);
                      toast.success("License key copied! Share this with your organization users.");
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-xs"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Key</span>
                  </button>
                </div>
              </div>

              {/* Top Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Card 1: Subscription Tier */}
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Organization Plan
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      licenseStats.isExpired
                        ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                    }`}>
                      {licenseStats.isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mb-1">
                    {licenseStats.plan}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Valid until {licenseStats.formattedExpiry} ({licenseStats.daysRemaining} days left)
                  </p>
                  <div className="flex flex-wrap gap-1 text-[10px]">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border border-blue-500/20">
                      Multi-User MEP Suite
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                      9 HVAC/Plumb Calcs
                    </span>
                    <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/20">
                      Custom PDF Branding
                    </span>
                  </div>
                </div>

                {/* Card 2: Seat Allocation Progress */}
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Active Seat Usage
                    </span>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      {seatPercentage}% Utilized
                    </span>
                  </div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mb-2">
                    {seatsUsed} <span className="text-sm font-semibold text-slate-500">/ {maxSeats} Seats</span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden mb-3">
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

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Available</span>
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{availableSeats} Seats</span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                      <span className="block text-[10px] uppercase font-bold text-slate-400">Freed (Deactivated)</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{deactivatedCount} Seats</span>
                    </div>
                  </div>
                </div>

                {/* Card 3: Instant Quick Upgrade */}
                <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Quick Expansion
                      </span>
                      <Zap className="w-4 h-4 text-amber-500" />
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-3">
                      Need more seats for expanding MEP teams? Choose an amount to submit an instant upgrade request:
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[1, 5, 10, 20].map((count) => (
                        <button
                          key={count}
                          onClick={() => {
                            setUpgradeSeatsCount(count);
                            setShowUpgradeModal(true);
                          }}
                          className="py-1.5 px-2 bg-white dark:bg-slate-900 hover:bg-primary/10 hover:text-primary hover:border-primary border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 transition-all cursor-pointer text-center"
                        >
                          +{count}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-2 border-t border-slate-200/70 dark:border-slate-800">
                    <span>Priority Dispatch to Super Admin</span>
                    <button
                      onClick={() => setShowUpgradeModal(true)}
                      className="font-bold text-primary hover:underline cursor-pointer"
                    >
                      Custom Request →
                    </button>
                  </div>
                </div>
              </div>

              {/* Seats Breakdown Table (Active vs Deactivated) */}
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-primary" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Seat Allocation & History Protection</h3>
                  </div>
                  <span className="text-xs text-slate-500">
                    Showing {users.length} members ({seatsUsed} Active, {deactivatedCount} Deactivated)
                  </span>
                </div>

                <div className="overflow-x-auto overflow-y-auto max-h-[300px]">
                  <table className="w-full text-sm text-left">
                    <thead className="sticky top-0 z-10 text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
                      <tr>
                        <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Team Member</th>
                        <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Role</th>
                        <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Quota Impact</th>
                        <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Project History</th>
                        <th className="px-5 py-3 font-bold text-right bg-slate-50 dark:bg-slate-900">Seat Control</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                      {users.map((u) => {
                        const isDeactivated = u.status === 'deactivated' || u.status === 'inactive';
                        const isSelf = u.id === currentUserProfile?.id;
                        return (
                          <tr key={u.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-950/20 transition-colors">
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full font-extrabold flex items-center justify-center text-xs shrink-0 border ${
                                  isDeactivated 
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-300 dark:border-slate-700' 
                                    : 'bg-primary/10 text-primary border-primary/20'
                                }`}>
                                  {(u.name || u.email || 'U')[0].toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                                    {isSelf && <Crown size={13} className="text-amber-500" />}
                                    <span>{u.name || u.email}</span>
                                    {isSelf && <span className="text-[10px] text-slate-400">(You)</span>}
                                  </div>
                                  <div className="text-slate-500 text-xs">{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                              {u.role || 'Design Engineer'}
                            </td>
                            <td className="px-5 py-3.5">
                              {isDeactivated ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                  <UserX size={12} />
                                  Freed (0 Seats)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  Occupies 1 Seat
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-xs">
                              {isDeactivated ? (
                                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                  <Lock size={12} className="text-amber-500" />
                                  Preserved & Frozen
                                </span>
                              ) : (
                                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                                  <CheckCircle2 size={12} />
                                  Active & Modifiable
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {!isSelf && (
                                <div className="flex items-center justify-end gap-1.5">
                                  {!isDeactivated ? (
                                    <button
                                      onClick={() => handleDeactivateUser(u)}
                                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-800 rounded-lg transition-colors cursor-pointer"
                                      title="Temporarily deactivate seat to free up license for new hire (calculations remain intact)"
                                    >
                                      <UserMinus size={13} />
                                      <span>Deactivate Seat</span>
                                    </button>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleReactivateUser(u)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 border border-emerald-300 dark:border-emerald-800 rounded-lg transition-colors cursor-pointer"
                                        title="Reactivate seat for this employee"
                                      >
                                        <UserCheck size={13} />
                                        <span>Reactivate</span>
                                      </button>
                                      <button
                                        onClick={() => handleOpenReassign(u)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border border-blue-300 dark:border-blue-800 rounded-lg transition-colors cursor-pointer"
                                        title="Transfer seat to a new hire without deleting past calculations"
                                      >
                                        <ArrowRightLeft size={13} />
                                        <span>Reassign Seat</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Upgrade Requests History */}
              <div className="border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
                <div className="p-3.5 bg-slate-50/80 dark:bg-slate-900/80 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-primary" />
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Seat Upgrade Requests History</h3>
                  </div>
                  {upgradeRequests.length > 0 && (
                    <span className="text-xs font-bold text-slate-500">
                      {upgradeRequests.length} Request{upgradeRequests.length === 1 ? '' : 's'} Logged
                    </span>
                  )}
                </div>

                {loadingUpgradeRequests ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                    <p className="text-xs text-slate-500 mt-2">Loading upgrade requests...</p>
                  </div>
                ) : upgradeRequests.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 space-y-2">
                    <Zap className="w-8 h-8 mx-auto opacity-30 text-amber-500" />
                    <p className="text-xs font-semibold">No seat upgrade requests submitted yet.</p>
                    <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                      When your team approaches full capacity, use the "Request Additional Seats" button to notify the Super Admin or support team.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto overflow-y-auto max-h-[280px]">
                    <table className="w-full text-sm text-left">
                      <thead className="sticky top-0 z-10 text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 shadow-2xs">
                        <tr>
                          <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Request Date</th>
                          <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Additional Seats</th>
                          <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Target Capacity</th>
                          <th className="px-5 py-3 font-bold bg-slate-50 dark:bg-slate-900">Urgency & Reason</th>
                          <th className="px-5 py-3 font-bold text-right bg-slate-50 dark:bg-slate-900">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800">
                        {upgradeRequests.map((req) => (
                          <tr key={req.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                            <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-300">
                              {new Date(req.created_at).toLocaleString()}
                            </td>
                            <td className="px-5 py-3">
                              <span className="font-extrabold text-xs text-primary">
                                +{req.requested_seats} Seats
                              </span>
                            </td>
                            <td className="px-5 py-3 text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {req.current_seats} → {req.target_seats} Total
                            </td>
                            <td className="px-5 py-3">
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  req.urgency === 'Urgent'
                                    ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {req.urgency}
                                </span>
                                <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-xs" title={req.reason}>
                                  {req.reason || 'General team expansion'}
                                </span>
                              </div>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                req.status === 'APPROVED'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : req.status === 'REJECTED'
                                  ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300'
                              }`}>
                                {req.status === 'APPROVED' ? <CheckCircle size={12} /> : req.status === 'REJECTED' ? <AlertTriangle size={12} /> : <Clock size={12} />}
                                {req.status}
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

      {/* Request Additional Seats Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold shrink-0">
                  <Zap size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Request Additional Seats</h3>
                  <p className="text-[11px] text-slate-500">Super Admin License Upgrade Request</p>
                </div>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitUpgradeRequest} className="p-6 space-y-4">
              {/* Current Status Pill */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400">Current Seat Capacity</span>
                  <span className="font-extrabold text-slate-800 dark:text-slate-100">{seatsUsed} Active / {maxSeats} Total</span>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] uppercase font-bold text-slate-400">New Target Total</span>
                  <span className="font-extrabold text-primary">{maxSeats + Number(upgradeSeatsCount || 0)} Total Seats</span>
                </div>
              </div>

              {/* Number of Seats Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  How many seats do you need?
                </label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {[1, 5, 10, 20].map((num) => (
                    <button
                      type="button"
                      key={num}
                      onClick={() => setUpgradeSeatsCount(num)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        upgradeSeatsCount === num
                          ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                          : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      +{num} {num === 1 ? 'Seat' : 'Seats'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-medium">Or enter custom count:</span>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={upgradeSeatsCount}
                    onChange={(e) => setUpgradeSeatsCount(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-24 h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold text-center focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              {/* Urgency */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                  Urgency / Timeline
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUpgradeUrgency('Standard')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer text-left ${
                      upgradeUrgency === 'Standard'
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div>Standard</div>
                    <div className="text-[10px] font-normal opacity-80">Next 1–2 business days</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpgradeUrgency('Urgent')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer text-left ${
                      upgradeUrgency === 'Urgent'
                        ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div>Urgent / High Priority</div>
                    <div className="text-[10px] font-normal opacity-80">Immediate project onboarding</div>
                  </button>
                </div>
              </div>

              {/* Justification / Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Reason / Project Scope (Optional)
                </label>
                <textarea
                  rows={2}
                  value={upgradeReason}
                  onChange={(e) => setUpgradeReason(e.target.value)}
                  placeholder="e.g. Onboarding 3 new HVAC draftsmen for Metro Project Phase 2"
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              {/* Contact Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Contact Phone / Extension (Optional)
                </label>
                <input
                  type="text"
                  value={upgradeContactPhone}
                  onChange={(e) => setUpgradeContactPhone(e.target.value)}
                  placeholder="e.g. +91 98765 43210"
                  className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingUpgrade}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmittingUpgrade ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Request</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Seat to New Hire Modal */}
      {showReassignModal && selectedFormerUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-blue-500/10 via-primary/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <ArrowRightLeft size={16} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">Reassign Seat to New Hire</h3>
                  <p className="text-[11px] text-slate-500">Preserves Project History & Transfers Seat</p>
                </div>
              </div>
              <button
                onClick={() => setShowReassignModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitReassign} className="p-6 space-y-4">
              {/* Former Employee Notice */}
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <ShieldCheck size={14} className="text-amber-600" />
                  <span>Former Seat Holder (History Intact)</span>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-bold">{selectedFormerUser.name || selectedFormerUser.email}</span> ({selectedFormerUser.email})
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  All past calculations, approved designs, and drawing revisions by this employee remain securely preserved and linked to their name.
                </p>
              </div>

              {/* New Hire Name */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  New Hire Full Name
                </label>
                <input
                  type="text"
                  required
                  value={reassignNewName}
                  onChange={(e) => setReassignNewName(e.target.value)}
                  placeholder="e.g. Sarah Jenkins"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* New Hire Email */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  New Hire Email Address
                </label>
                <input
                  type="email"
                  required
                  value={reassignNewEmail}
                  onChange={(e) => setReassignNewEmail(e.target.value)}
                  placeholder="e.g. sjenkins@company.com"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              {/* Platform Role */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Platform Role
                </label>
                <select
                  value={reassignNewRole}
                  onChange={(e) => setReassignNewRole(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                >
                  {PLATFORM_ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="ORG_ADMIN">Org Admin</option>
                </select>
              </div>

              {/* Calculation Review Authority */}
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1">
                  Calculation Review & Approval Authority
                </label>
                <select
                  value={reassignNewAuthority}
                  onChange={(e) => setReassignNewAuthority(e.target.value as any)}
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer"
                >
                  <option value="APPROVE_REJECT">Approve / Reject & Review</option>
                  <option value="REVIEW">Reviewal Only</option>
                  <option value="SUBMIT_TASK">Submit Task</option>
                  <option value="NONE">No Reviewal Rights</option>
                </select>
              </div>

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowReassignModal(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReassign}
                  className="flex-1 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSubmittingReassign ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Reassigning...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      <span>Confirm Reassign</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Lock / Freeze Confirmation Modal */}
      {projectToLock && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b border-slate-200/80 dark:border-slate-800 flex justify-between items-center ${
              projectToLock.is_locked
                ? 'bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent'
                : 'bg-gradient-to-r from-amber-500/10 via-primary/5 to-transparent'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                  projectToLock.is_locked
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30'
                }`}>
                  {projectToLock.is_locked ? <Unlock size={18} /> : <Lock size={18} />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                    {projectToLock.is_locked ? 'Unlock Project Workspace' : 'Freeze & Lock Project Workspace'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {projectToLock.is_locked ? 'Restore editing permissions for team members' : 'Governance protection against unauthorized changes'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setProjectToLock(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-4">
              {/* Project Summary Box */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-slate-800 dark:text-slate-200">
                    {projectToLock.code || 'PROJ'}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {projectToLock.building_type || projectToLock.type || 'Commercial'} • {projectToLock.current_stage || 'Schematic Design'}
                  </span>
                </div>
                <div className="font-bold text-sm text-slate-900 dark:text-white">
                  {projectToLock.name}
                </div>
                <div className="text-xs text-slate-500">
                  Client: <span className="font-semibold text-slate-700 dark:text-slate-300">{projectToLock.client || 'N/A'}</span>
                </div>
              </div>

              {!projectToLock.is_locked ? (
                <>
                  {/* Warning Box */}
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={14} />
                      Read-Only Calculation Protection
                    </div>
                    <p className="text-[11.5px] leading-relaxed">
                      Freezing this project puts all airflow rates, equipment selections, and spaces in <strong>strictly read-only mode</strong>. Team members will not be able to modify, recalculate, or overwrite approved deliverables after submission to the client or authority.
                    </p>
                  </div>

                  {/* Quick Reason Suggestions */}
                  <div>
                    <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                      Lock Reason / Milestone
                    </label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {[
                        'Client Submission (Rev 0)',
                        'Authority / Municipal Approval',
                        'Tender Package Frozen',
                        'Issued For Construction (IFC)',
                        'Final Sign-off'
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLockReason(preset)}
                          className={`text-[11px] px-2.5 py-1 rounded-lg font-semibold border transition-all cursor-pointer ${
                            lockReason === preset
                              ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={lockReason}
                      onChange={(e) => setLockReason(e.target.value)}
                      placeholder="e.g. Client Submission (Rev 0) or Final Approved Package"
                      className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </>
              ) : (
                /* Unlocking Notice */
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 size={14} />
                    Unlocking for Revision
                  </div>
                  <p className="text-[11.5px] leading-relaxed">
                    Unlocking will enable team members with editing permissions to modify space data, run calculations, and save workspace updates for this project again.
                  </p>
                  {projectToLock.lock_reason && (
                    <div className="text-[11px] text-slate-500 mt-2">
                      Previous Lock Reason: <span className="font-semibold text-slate-700 dark:text-slate-300">"{projectToLock.lock_reason}"</span>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setProjectToLock(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmToggleLock}
                  disabled={isLocking}
                  className={`flex-1 px-4 py-2.5 rounded-full text-xs font-bold transition-colors disabled:opacity-50 shadow-xs cursor-pointer flex items-center justify-center gap-1.5 text-white ${
                    projectToLock.is_locked
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {isLocking ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{projectToLock.is_locked ? 'Unlocking...' : 'Locking...'}</span>
                    </>
                  ) : (
                    <>
                      {projectToLock.is_locked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                      <span>{projectToLock.is_locked ? 'Confirm Unlock' : 'Freeze & Lock Workspace'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

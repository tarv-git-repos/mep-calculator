import React, { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquare, 
  Send, UserCheck, ShieldCheck, ChevronDown, User, Sparkles, RefreshCw, FileText, Lock, Unlock, Info, History
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/services/api";
import { workspaceStore } from "@/lib/workspace-store";
import { loadOrgHierarchyFromStorage } from "@/utils/hierarchy";

export type WorkflowRole = "Jr. / Design Engineer" | "Sr. Design Engineer" | "Discipline Coordinator";

export type ReviewStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";

export interface CalculationReviewState {
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerComments?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionDescription?: string;
  history?: Array<{
    action: ReviewStatus;
    user: string;
    role: string;
    timestamp: string;
    comment?: string;
  }>;
}

export function useCalculationLock(calculatorPath?: string, projectId?: string) {
  const currentProj = workspaceStore.getState().project;
  const effectiveProjectId = (projectId && projectId !== "none" && projectId !== "active_project") 
    ? projectId 
    : (currentProj?.id || "default");
    
  const storageKey = `mep_calc_review_${effectiveProjectId}_${calculatorPath || "ventilation"}`;

  const [isLocked, setIsLocked] = useState<boolean>(() => {
    const proj = workspaceStore.getState().project;
    if (proj && (proj.id === effectiveProjectId || effectiveProjectId === "default")) {
      const reviewStates = proj.workspace_data?.review_states || {};
      if (reviewStates[storageKey]) {
        return reviewStates[storageKey].status === "APPROVED";
      }
    }
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          return parsed.status === "APPROVED";
        }
      } catch (e) {}
    }
    return false;
  });

  useEffect(() => {
    const checkLock = () => {
      const proj = workspaceStore.getState().project;
      if (proj && (proj.id === effectiveProjectId || effectiveProjectId === "default")) {
        const reviewStates = proj.workspace_data?.review_states || {};
        if (reviewStates[storageKey]) {
          setIsLocked(reviewStates[storageKey].status === "APPROVED");
          return;
        }
      }
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem(storageKey);
          if (saved) {
            const parsed = JSON.parse(saved);
            setIsLocked(parsed.status === "APPROVED");
            return;
          }
        } catch (e) {}
      }
      setIsLocked(false);
    };

    checkLock();

    if (typeof window !== "undefined") {
      window.addEventListener("mep-review-state-updated", checkLock);
      window.addEventListener("storage", checkLock);
      return () => {
        window.removeEventListener("mep-review-state-updated", checkLock);
        window.removeEventListener("storage", checkLock);
      };
    }
  }, [storageKey, effectiveProjectId]);

  return isLocked;
}

interface CalculationReviewBarProps {
  projectId?: string;
  calculatorPath: string;
  calculatorTitle: string;
  onReviewStateChange?: (state: CalculationReviewState) => void;
}

export function CalculationReviewBar({
  projectId,
  calculatorPath,
  calculatorTitle,
  onReviewStateChange
}: CalculationReviewBarProps) {
  const currentProj = workspaceStore.getState().project;
  const effectiveProjectId = (projectId && projectId !== "none" && projectId !== "active_project") 
    ? projectId 
    : (currentProj?.id || "default");

  const { profile, userData } = useAuth();
  
  const currentUserName = userData?.name || profile?.name || "Engineering User";
  const currentUserEmail = userData?.email || profile?.email || "";

  // Dynamic Review & Approval Authority (Single Source of Truth: Company Hierarchy)
  const userAuthority = useMemo<"APPROVE_REJECT" | "REVIEW" | "NONE">(() => {
    let activeProfile: any = profile || userData || {};
    
    // Check local storage caches
    if ((!activeProfile.role && !activeProfile.designation) && typeof window !== "undefined") {
      try {
        const storedProfile = localStorage.getItem('mep_profile');
        const storedUserData = localStorage.getItem('mep_user_data');
        if (storedProfile) activeProfile = JSON.parse(storedProfile);
        else if (storedUserData) activeProfile = JSON.parse(storedUserData);
      } catch (e) {}
    }

    const currentEmail = String(currentUserEmail || activeProfile.email || "").toLowerCase().trim();
    const currentName = String(currentUserName || activeProfile.name || "").toLowerCase().trim();
    const currentId = String(activeProfile.id || "").toLowerCase().trim();

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

    // 2. Check direct approvalAuthority property on active profile / features
    if (activeProfile.approvalAuthority) return activeProfile.approvalAuthority;
    if (activeProfile.features?.approvalAuthority) return activeProfile.features.approvalAuthority;

    // 3. Fallback defaults if no explicit authority was configured in hierarchy:
    const roleVal = String(activeProfile?.role || "").toUpperCase();
    const desVal = String(activeProfile?.designation || "").toLowerCase();

    if (roleVal === "SUPER_ADMIN" || roleVal === "ORG_ADMIN" || currentEmail === "admin@tarv.ai") {
      return "APPROVE_REJECT";
    }
    if (roleVal === "PROJECT_MANAGER" || roleVal === "TEAM_LEADER" || roleVal === "DISCIPLINE_COORDINATOR" || desVal.includes("coordinator")) {
      return "APPROVE_REJECT";
    }
    if (roleVal === "SR_DESIGN_ENGINEER" || desVal.includes("senior") || desVal.includes("sr.")) {
      return "REVIEW";
    }

    return "NONE";
  }, [profile, userData, currentUserEmail, currentUserName]);

  // Backward compatibility alias
  const userRole = useMemo<WorkflowRole>(() => {
    if (userAuthority === "APPROVE_REJECT") return "Discipline Coordinator";
    if (userAuthority === "REVIEW") return "Sr. Design Engineer";
    return "Jr. / Design Engineer";
  }, [userAuthority]);

  const storageKey = `mep_calc_review_${effectiveProjectId}_${calculatorPath || "ventilation"}`;

  // 2. Calculation Review State
  const [reviewState, setReviewState] = useState<CalculationReviewState>(() => {
    const currentProj = workspaceStore.getState().project;
    if (currentProj && (currentProj.id === effectiveProjectId || effectiveProjectId === "default")) {
      const reviewStates = currentProj.workspace_data?.review_states || {};
      if (reviewStates[storageKey]) {
        return reviewStates[storageKey];
      }
    }

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return { status: "DRAFT" };
  });

  // Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  const [srComments, setSrComments] = useState("");
  const [approveComments, setApproveComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  // Synchronize global read-only flag for approved status
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__mep_approved_readonly = (reviewState.status === "APPROVED");
    }
  }, [reviewState.status]);

  // Sync state when storageKey changes
  useEffect(() => {
    const currentProj = workspaceStore.getState().project;
    if (currentProj && (currentProj.id === effectiveProjectId || effectiveProjectId === "default")) {
      const reviewStates = currentProj.workspace_data?.review_states || {};
      if (reviewStates[storageKey]) {
        setReviewState(reviewStates[storageKey]);
        if (onReviewStateChange) onReviewStateChange(reviewStates[storageKey]);
        return;
      }
    }

    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          setReviewState(parsed);
          if (onReviewStateChange) onReviewStateChange(parsed);
          return;
        }
      } catch (e) {}
    }
  }, [storageKey, effectiveProjectId]);

  const updateReviewState = (newState: CalculationReviewState) => {
    setReviewState(newState);
    if (onReviewStateChange) onReviewStateChange(newState);

    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(newState));
      (window as any).__mep_approved_readonly = (newState.status === "APPROVED");
    }

    const currentProj = workspaceStore.getState().project;
    if (currentProj && (currentProj.id === effectiveProjectId || effectiveProjectId === "default")) {
      const wdata = currentProj.workspace_data || {};
      const updatedReviewStates = {
        ...(wdata.review_states || {}),
        [storageKey]: newState
      };
      const updatedWdata = {
        ...wdata,
        review_states: updatedReviewStates
      };
      
      workspaceStore.updateProject({
        ...currentProj,
        workspace_data: updatedWdata
      });

      api.saveWorkspace(effectiveProjectId, updatedWdata).catch(console.error);
    }

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep-review-state-updated", { 
        detail: { 
          storageKey, 
          state: newState,
          status: newState.status,
          projectId: effectiveProjectId,
          calculatorTitle 
        } 
      }));
    }
  };

  // Action 1: Sr. Design Engineer Submit Review
  const handleSrReviewSubmit = async () => {
    const isViewer = profile?.role === 'VIEWER' || userData?.role === 'VIEWER';
    if (isViewer) {
      toast.info("Viewer role cannot submit review actions.", { id: "readonly-notice" });
      setShowReviewModal(false);
      return;
    }
    const timestamp = new Date().toLocaleString();
    const commentText = srComments.trim() || "Calculation reviewed by Sr. Design Engineer";
    const updated: CalculationReviewState = {
      ...reviewState,
      status: "REVIEWED",
      reviewedBy: currentUserName,
      reviewedAt: timestamp,
      reviewerComments: commentText,
      history: [
        ...(reviewState.history || []),
        {
          action: "REVIEWED",
          user: currentUserName,
          role: "Sr. Design Engineer",
          timestamp,
          comment: commentText
        }
      ]
    };

    updateReviewState(updated);
    setShowReviewModal(false);

    try {
      const coordNotifRecord = {
        id: `review_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        targetId: `calc_${calculatorPath || "review"}`,
        targetName: calculatorTitle,
        targetType: "Calculation Review",
        text: `${currentUserName} (Sr. Design Engineer) has marked "${calculatorTitle}" as REVIEWED and ready for approval: "${commentText}"`,
        authorId: profile?.id || userData?.id || "sr_designer",
        authorName: currentUserName,
        timestamp: new Date().toISOString(),
        isReviewStateNotif: true,
        targetRole: "discipline_coordinator",
        projectId: effectiveProjectId,
        calculatorPath
      };

      const currentProj = workspaceStore.getState().project;
      if (currentProj) {
        const wdata = currentProj.workspace_data || {};
        const existingNotifs = Array.isArray(wdata.notifications) ? wdata.notifications : [];
        const updatedWdata = {
          ...wdata,
          notifications: [coordNotifRecord, ...existingNotifs]
        };
        api.saveWorkspace(effectiveProjectId, updatedWdata).catch(console.error);
        workspaceStore.updateProject({ ...currentProj, workspace_data: updatedWdata });

        // Directly notify all Discipline Coordinators via notification API
        try {
          const allUsers = await api.getUsers().catch(() => []);
          const projectUsers: any[] = (currentProj as any)?.project_users || (currentProj as any)?.members || [];
          
          const memberUserIds = new Set<string>();
          if (currentProj?.created_by) memberUserIds.add(String(currentProj.created_by).toLowerCase().trim());
          
          projectUsers.forEach((pu: any) => {
            if (!pu) return;
            const uId = String(pu.user_id || pu.id || pu.user?.id || pu.email || '').toLowerCase().trim();
            if (uId) memberUserIds.add(uId);
          });

          // Resolve target coordinators
          const targetCoordinators: any[] = [];
          const seenCoordIds = new Set<string>();

          const addCoordCandidate = (u: any) => {
            if (!u) return;
            const uId = String(u.id || u.user_id || u.user?.id || u.email || '').trim();
            if (!uId || seenCoordIds.has(uId.toLowerCase())) return;

            const uRole = String(u.role || u.user_metadata?.role || u.designation || '').toLowerCase();
            const isCoord = (
              uRole === 'discipline coordinator' ||
              uRole.includes('coordinator') ||
              uRole.includes('discipline') ||
              uRole.includes('org_admin') ||
              uRole.includes('super_admin') ||
              uRole.includes('admin') ||
              uRole.includes('project_manager')
            );

            if (isCoord) {
              seenCoordIds.add(uId.toLowerCase());
              targetCoordinators.push(u);
            }
          };

          // Check all system users
          (allUsers || []).forEach(addCoordCandidate);
          // Check project users
          (projectUsers || []).forEach(addCoordCandidate);

          const notifLink = `${calculatorPath}`;

          targetCoordinators.forEach((coord: any) => {
            const recipientId = String(coord.id || coord.user_id || coord.email);
            if (!recipientId) return;

            api.sendNotification({
              recipientId,
              title: `\u2705 CALCULATION REVIEWED: ${calculatorTitle}`,
              message: `${currentUserName} (Sr. Design Engineer) has reviewed "${calculatorTitle}" and it is ready for your approval. Notes: "${commentText}"`,
              link: notifLink,
              metadata: {
                id: coordNotifRecord.id,
                projectId: effectiveProjectId,
                calculatorPath,
                targetId: coordNotifRecord.targetId,
                targetName: calculatorTitle,
                targetType: "Calculation Review",
                authorName: currentUserName,
                text: coordNotifRecord.text,
                isReviewStateNotif: true,
                targetRole: "discipline_coordinator",
                createdAt: coordNotifRecord.timestamp,
              }
            }).catch(e => console.error("Failed to notify coordinator", recipientId, e));
          });
        } catch (err) {
          console.error("Failed to send review notifications to coordinators:", err);
        }
      }

      window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: coordNotifRecord }));
      window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: coordNotifRecord }));
      window.dispatchEvent(new CustomEvent("mep-review-state-updated", { 
        detail: {
          status: "SR_REVIEW_SUBMITTED",
          reviewedBy: currentUserName,
          reviewerComments: srComments.trim(),
          calculatorTitle,
          projectId: effectiveProjectId
        } 
      }));
    } catch (e) {
      console.error("Failed to save notification:", e);
    }

    setSrComments("");

    try {
      await api.logActivity("CALCULATION_REVIEWED", {
        calculatorTitle,
        reviewedBy: currentUserName,
        comments: srComments
      });
    } catch (e) {}

    toast.success("Review submitted! Discipline Coordinator has been notified to check for approval.");
  };

  // Action 2: Discipline Coordinator Hits "Approve"
  const handleCoordinatorApprove = async () => {
    const isViewer = profile?.role === 'VIEWER' || userData?.role === 'VIEWER';
    if (isViewer) {
      toast.info("Viewer role cannot submit review actions.", { id: "readonly-notice" });
      setShowApproveModal(false);
      return;
    }
    const timestamp = new Date().toLocaleString();
    const commentText = approveComments.trim() || "Calculation Approved";
    const updated: CalculationReviewState = {
      ...reviewState,
      status: "APPROVED",
      approvedBy: currentUserName,
      approvedAt: timestamp,
      reviewerComments: approveComments.trim() || reviewState.reviewerComments,
      history: [
        ...(reviewState.history || []),
        {
          action: "APPROVED",
          user: currentUserName,
          role: "Discipline Coordinator",
          timestamp,
          comment: commentText
        }
      ]
    };

    updateReviewState(updated);
    setShowApproveModal(false);
    setApproveComments("");

    try {
      await api.logActivity("CALCULATION_APPROVED", {
        calculatorTitle,
        approvedBy: currentUserName,
        comment: commentText
      });
      
      const revisions = workspaceStore.getState().project?.revisions || [];
      const newRevNumber = revisions.length + 1;
      const dateStr = new Date().toLocaleDateString();
      workspaceStore.saveAsRevision(`V_${newRevNumber} - Approved on ${dateStr}`);
    } catch (e) {}

    toast.success("Calculation APPROVED! Status updated for all team members.");
  };

  // Action 3: Discipline Coordinator Hits "Reject"
  const handleCoordinatorRejectSubmit = async () => {
    const isViewer = profile?.role === 'VIEWER' || userData?.role === 'VIEWER';
    if (isViewer) {
      toast.info("Viewer role cannot submit review actions.", { id: "readonly-notice" });
      setShowRejectModal(false);
      return;
    }
    const timestamp = new Date().toLocaleString();
    if (!rejectReason.trim()) {
      toast.error("Please enter the rejection description for the Sr. Design Engineer.");
      return;
    }

    const updated: CalculationReviewState = {
      ...reviewState,
      status: "REJECTED",
      rejectedBy: currentUserName,
      rejectedAt: timestamp,
      rejectionDescription: rejectReason.trim(),
      history: [
        ...(reviewState.history || []),
        {
          action: "REJECTED",
          user: currentUserName,
          role: "Discipline Coordinator",
          timestamp,
          comment: rejectReason.trim()
        }
      ]
    };

    updateReviewState(updated);
    setShowRejectModal(false);

    try {
      // targetRole: "all_engineers" so ALL non-coordinator engineers see this in their notification center
      const notifRecord = {
        id: `reject_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        targetId: `calc_${calculatorPath || "review"}`,
        targetName: calculatorTitle,
        targetType: "Calculation Rejection",
        text: `Calculation "${calculatorTitle}" was REJECTED by ${currentUserName} (Discipline Coordinator): "${rejectReason.trim()}"`,
        authorId: profile?.id || userData?.id || "coordinator",
        authorName: currentUserName,
        timestamp: new Date().toISOString(),
        isReviewStateNotif: true,
        targetRole: "all_engineers",
        projectId: effectiveProjectId,
        calculatorPath
      };

      const currentProj = workspaceStore.getState().project;
      if (currentProj) {
        const wdata = currentProj.workspace_data || {};
        const existingNotifs = Array.isArray(wdata.notifications) ? wdata.notifications : [];
        const updatedWdata = {
          ...wdata,
          notifications: [notifRecord, ...existingNotifs]
        };
        api.saveWorkspace(effectiveProjectId, updatedWdata).catch(console.error);
        workspaceStore.updateProject({ ...currentProj, workspace_data: updatedWdata });

        // Send direct API notification to ALL engineers in the project
        const projectUsers: any[] = (currentProj as any).project_users || [];
        const coordinatorUserId = String(profile?.id || userData?.id || "");
        const notifLink = `${calculatorPath}`;

        projectUsers.forEach((pu: any) => {
          if (!pu) return;
          const puId = pu.user_id || pu.id || pu.user?.id || pu.email || pu.user?.email;
          if (!puId) return;
          const puIdStr = String(puId);
          if (coordinatorUserId && puIdStr === coordinatorUserId) return; // skip self
          api.sendNotification({
            recipientId: puIdStr,
            title: `\u274C CALCULATION REJECTED: ${calculatorTitle}`,
            message: `"${calculatorTitle}" was REJECTED by ${currentUserName} (Discipline Coordinator). Reason: "${rejectReason.trim()}"`,
            link: notifLink,
            metadata: {
              id: notifRecord.id,
              projectId: effectiveProjectId,
              calculatorPath,
              targetId: notifRecord.targetId,
              targetName: calculatorTitle,
              targetType: "Calculation Rejection",
              authorName: currentUserName,
              text: notifRecord.text,
              isReviewStateNotif: true,
              targetRole: "all_engineers",
              rejectedBy: currentUserName,
              rejectionDescription: rejectReason.trim(),
              createdAt: notifRecord.timestamp,
            }
          }).catch(e => console.error("Failed to notify engineer", puIdStr, e));
        });
      }

      window.dispatchEvent(new CustomEvent("mep-notification-added"));
      window.dispatchEvent(new CustomEvent("mep-review-state-updated", {
        detail: {
          status: "REJECTED",
          rejectedBy: currentUserName,
          rejectionDescription: rejectReason.trim(),
          calculatorTitle,
          projectId: effectiveProjectId
        }
      }));
    } catch (e) {}

    setRejectReason("");

    try {
      await api.logActivity("CALCULATION_REJECTED", {
        calculatorTitle,
        rejectedBy: currentUserName,
        reason: rejectReason
      });
    } catch (e) {}

    toast.error("Calculation REJECTED. All engineers in the project have been notified.");
  };

  // Action 4: Discipline Coordinator Hits "Unlock"
  const handleCoordinatorUnlock = async () => {
    const isViewer = profile?.role === 'VIEWER' || userData?.role === 'VIEWER';
    if (isViewer) {
      toast.info("Viewer role cannot submit review actions.", { id: "readonly-notice" });
      setShowUnlockModal(false);
      return;
    }
    const timestamp = new Date().toLocaleString();
    const updated: CalculationReviewState = {
      ...reviewState,
      status: "DRAFT",
      history: [
        ...(reviewState.history || []),
        {
          action: "DRAFT",
          user: currentUserName,
          role: "Discipline Coordinator",
          timestamp,
          comment: "Calculation unlocked and returned to Draft mode for editing"
        }
      ]
    };

    updateReviewState(updated);
    setShowUnlockModal(false);

    try {
      await api.logActivity("CALCULATION_UNLOCKED", {
        calculatorTitle,
        unlockedBy: currentUserName
      });
    } catch (e) {}

    toast.success("Calculation unlocked! Editing is now enabled for all engineers.");
  };

  const isApproved = reviewState.status === "APPROVED";
  const isReviewed = reviewState.status === "REVIEWED";
  const isRejected = reviewState.status === "REJECTED";

  return (
    <div className="calculation-review-bar no-print select-none inline-flex items-center gap-2">
      {/* 1. STATUS BADGE (Clean & Compact Pill) */}
      {isApproved && (
        <button
          onClick={() => setShowDetailsModal(true)}
          title="Click to view full approval details"
          className="px-3 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
        >
          <Lock className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Approved & Locked</span>
          <Info className="size-3 text-emerald-600/70 dark:text-emerald-400/70 ml-0.5" />
        </button>
      )}

      {isReviewed && (
        <button
          onClick={() => setShowDetailsModal(true)}
          title="Click to view reviewer notes"
          className="px-3 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
        >
          <Clock className="size-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span>Reviewed by Sr. Engineer</span>
          <Info className="size-3 text-indigo-600/70 dark:text-indigo-400/70 ml-0.5" />
        </button>
      )}

      {isRejected && (
        <button
          onClick={() => setShowDetailsModal(true)}
          title="Click to view rejection reason"
          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30 text-xs font-bold rounded-full transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
        >
          <XCircle className="size-3.5 text-red-600 dark:text-red-400 shrink-0" />
          <span>Rejected</span>
          <Info className="size-3 text-red-600/70 dark:text-red-400/70 ml-0.5" />
        </button>
      )}

      {/* 2. ACTION CONTROLS */}
      
      {/* UNLOCK BUTTON: Always visible and accessible whenever calculation is Approved & Locked */}
      {isApproved && (
        <button
          onClick={() => setShowUnlockModal(true)}
          className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-bold text-xs rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          title="Unlock calculation to allow engineers to make edits"
        >
          <Unlock className="size-3.5 text-amber-600 dark:text-amber-400" />
          <span>Unlock</span>
        </button>
      )}

      {/* A. DISCIPLINE COORDINATOR (Approve / Reject when not approved) */}
      {userRole === "Discipline Coordinator" && !isApproved && (
        <div className="inline-flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowApproveModal(true)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="size-3.5" />
            <span>Approve</span>
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <XCircle className="size-3.5" />
            <span>Reject</span>
          </button>
        </div>
      )}

      {/* B. SR. DESIGN ENGINEER (Review only) */}
      {userRole === "Sr. Design Engineer" && !isApproved && (
        <button
          onClick={() => setShowReviewModal(true)}
          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <ShieldCheck className="size-3.5" />
          <span>{isReviewed ? "Reviewed" : "Review"}</span>
        </button>
      )}

      {/* C. JR / DESIGN ENGINEER NOTES BUTTON (Only when Reviewed by Sr. Engineer and NOT Rejected/Approved) */}
      {userRole === "Jr. / Design Engineer" && isReviewed && reviewState.reviewerComments && !isApproved && !isRejected && (
        <button
          onClick={() => setShowDetailsModal(true)}
          className="px-3 py-1 bg-surface-2 hover:bg-surface-3 text-foreground/80 border border-border/70 text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
        >
          <MessageSquare className="size-3.5 text-primary" />
          <span>Review Notes</span>
        </button>
      )}

      {/* MODAL 1: Sr. Design Engineer Review Comments Modal */}
      {showReviewModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 review-modal" role="dialog">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-2">
              <ShieldCheck className="size-5 text-indigo-500" />
              Mark Calculation as Reviewed
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              You are confirming that you have reviewed the calculation for <span className="font-bold text-foreground">{calculatorTitle}</span>. You can optionally add notes for the Design Engineers or Discipline Coordinator.
            </p>
            <textarea
              value={srComments}
              onChange={(e) => setSrComments(e.target.value)}
              placeholder="Add optional reviewer comments or guidelines for Jr. / Design Engineers…"
              rows={4}
              className="w-full p-3 bg-surface-2 border border-border rounded-xl text-xs font-medium outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 text-foreground resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowReviewModal(false)}
                className="px-4 py-2 border border-border text-xs font-semibold rounded-xl hover:bg-surface-2 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSrReviewSubmit}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <Send className="size-3.5" />
                Submit Reviewed Status
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: Discipline Coordinator Approve Modal */}
      {showApproveModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 review-modal" role="dialog">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 mb-2">
              <CheckCircle2 className="size-5 text-emerald-500" />
              Approve Calculation
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              You are approving the calculation for <span className="font-bold text-foreground">{calculatorTitle}</span>. All inputs will be locked in Read-Only mode for the team.
            </p>
            <textarea
              value={approveComments}
              onChange={(e) => setApproveComments(e.target.value)}
              placeholder="Add optional approval comments or notes…"
              rows={4}
              className="w-full p-3 bg-surface-2 border border-emerald-300 dark:border-emerald-900/50 rounded-xl text-xs font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 text-foreground resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-border text-xs font-semibold rounded-xl hover:bg-surface-2 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCoordinatorApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="size-3.5" />
                Confirm & Approve
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 3: Discipline Coordinator Reject Modal */}
      {showRejectModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 review-modal" role="dialog">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="size-5 text-red-500" />
              Reject Calculation
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Please enter the exact reason and description for rejecting the calculation. This description will be sent directly to the Sr. Design Engineer to rectify.
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter detailed description of why the calculation is rejected…"
              rows={4}
              className="w-full p-3 bg-surface-2 border border-red-300 dark:border-red-900/50 rounded-xl text-xs font-medium outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/20 text-foreground resize-none"
            />
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 border border-border text-xs font-semibold rounded-xl hover:bg-surface-2 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCoordinatorRejectSubmit}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <XCircle className="size-3.5" />
                Reject Calculation
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 4: Discipline Coordinator Unlock Confirmation Modal */}
      {showUnlockModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 review-modal" role="dialog">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center gap-2 mb-2">
              <Unlock className="size-5 text-amber-500" />
              Unlock Calculation for Editing
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Are you sure you want to unlock <span className="font-bold text-foreground">{calculatorTitle}</span>? This will return the calculation to <strong>Draft</strong> status and allow all engineers to edit values again.
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowUnlockModal(false)}
                className="px-4 py-2 border border-border text-xs font-semibold rounded-xl hover:bg-surface-2 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCoordinatorUnlock}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
              >
                <Unlock className="size-3.5" />
                Confirm & Unlock
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 5: Full Audit & Details Modal */}
      {showDetailsModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 review-modal" role="dialog">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-lg p-6 animate-scale-in">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-3">
              <ShieldCheck className="size-5 text-primary" />
              Workflow Status & Audit Details
            </h3>

            <div className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border/60">
                <span className="font-semibold text-muted-foreground">Current Status:</span>
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                  isApproved 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" 
                    : isReviewed 
                    ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30"
                    : isRejected
                    ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30"
                    : "bg-surface-3 text-muted-foreground"
                }`}>
                  {reviewState.status}
                </span>
              </div>

              {isApproved && (
                <div className="p-3.5 bg-emerald-500/5 rounded-xl border border-emerald-500/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Approved By:</span>
                    <span className="font-bold text-foreground">{reviewState.approvedBy || "Discipline Coordinator"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Approval Date:</span>
                    <span className="text-foreground">{reviewState.approvedAt || "Recently"}</span>
                  </div>
                  {reviewState.reviewerComments && (
                    <div className="pt-2 border-t border-emerald-500/10 mt-2">
                      <span className="font-semibold text-muted-foreground block mb-1">Approval Notes:</span>
                      <p className="bg-background p-2.5 rounded-lg border border-border/50 text-foreground text-[11.5px]">
                        {reviewState.reviewerComments}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isReviewed && (
                <div className="p-3.5 bg-indigo-500/5 rounded-xl border border-indigo-500/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Reviewed By:</span>
                    <span className="font-bold text-foreground">{reviewState.reviewedBy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Review Date:</span>
                    <span className="text-foreground">{reviewState.reviewedAt}</span>
                  </div>
                  {reviewState.reviewerComments && (
                    <div className="pt-2 border-t border-indigo-500/10 mt-2">
                      <span className="font-semibold text-muted-foreground block mb-1">Reviewer Notes:</span>
                      <p className="bg-background p-2.5 rounded-lg border border-border/50 text-foreground text-[11.5px]">
                        {reviewState.reviewerComments}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {isRejected && (
                <div className="p-3.5 bg-red-500/5 rounded-xl border border-red-500/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Rejected By:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">{reviewState.rejectedBy}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-muted-foreground">Rejection Date:</span>
                    <span className="text-foreground">{reviewState.rejectedAt}</span>
                  </div>
                  {reviewState.rejectionDescription && (
                    <div className="pt-2 border-t border-red-500/10 mt-2">
                      <span className="font-semibold text-red-600 dark:text-red-400 block mb-1">Reason for Rejection:</span>
                      <p className="bg-background p-2.5 rounded-lg border border-red-200 dark:border-red-900/50 text-foreground text-[11.5px]">
                        {reviewState.rejectionDescription}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              {isApproved && (
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setShowUnlockModal(true);
                  }}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <Unlock className="size-3.5" />
                  <span>Unlock Calculation</span>
                </button>
              )}
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

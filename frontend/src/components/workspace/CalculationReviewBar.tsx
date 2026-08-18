import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, 
  Send, ShieldCheck
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/services/api";
import { workspaceStore } from "@/lib/workspace-store";

export type ReviewStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";

export interface CalculationReviewState {
  status: ReviewStatus;
  reviewedBy?: string;
  reviewedAt?: string;
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

interface CalculationReviewBarProps {
  projectId: string;
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
  // If no valid project is selected, calculation review bar must be hidden
  if (!projectId || projectId === "" || projectId === "none" || projectId === "active_project") {
    return null;
  }

  const { profile, userData } = useAuth();
  
  const currentUserName = userData?.name || profile?.name || "Engineering User";

  // Check if current user is Sr. Design Engineer or Admin
  const isSrEngineerOrAdmin = useMemo(() => {
    const activeProfile = profile || userData || {};
    const roleVal = String(activeProfile.role || userData?.user_metadata?.role || userData?.role || "").trim();
    const des = String(activeProfile.designation || "").toLowerCase().trim();
    const rawRole = roleVal.toLowerCase();

    return (
      roleVal === "Sr. Design Engineer" ||
      roleVal === "Senior Design Engineer" ||
      roleVal === "Admin" ||
      roleVal === "SUPER_ADMIN" ||
      roleVal === "ORG_ADMIN" ||
      rawRole.includes("senior") ||
      rawRole.includes("sr") ||
      rawRole.includes("admin") ||
      des.includes("senior") ||
      des.includes("sr") ||
      (!roleVal && !des) // Fallback for active dev workspace user
    );
  }, [profile, userData]);

  // Check if current user is Discipline Coordinator or Admin
  const isCoordinatorOrAdmin = useMemo(() => {
    const activeProfile = profile || userData || {};
    const roleVal = String(activeProfile.role || userData?.user_metadata?.role || userData?.role || "").trim();
    const des = String(activeProfile.designation || "").toLowerCase().trim();
    const rawRole = roleVal.toLowerCase();

    return (
      roleVal === "Discipline Coordinator" ||
      roleVal === "Admin" ||
      roleVal === "SUPER_ADMIN" ||
      roleVal === "ORG_ADMIN" ||
      rawRole.includes("coordinator") ||
      rawRole.includes("lead") ||
      rawRole.includes("admin") ||
      des.includes("coordinator") ||
      des.includes("lead") ||
      (!roleVal && !des) // Fallback for active dev workspace user
    );
  }, [profile, userData]);

  const storageKey = `mep_calc_review_${projectId || "default"}_${calculatorPath || "ventilation"}`;

  // 2. Calculation Review State
  const [reviewState, setReviewState] = useState<CalculationReviewState>(() => {
    // Priority 1: Backend Workspace Data
    const currentProj = workspaceStore.getState().project;
    if (currentProj && currentProj.id === projectId) {
      const reviewStates = currentProj.workspace_data?.review_states || {};
      if (reviewStates[storageKey]) {
        return reviewStates[storageKey];
      }
    }

    // Priority 2: Local Storage fallback
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return { status: "DRAFT" };
  });

  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Sync state when storageKey changes
  useEffect(() => {
    const currentProj = workspaceStore.getState().project;
    if (currentProj && currentProj.id === projectId) {
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
    const initialState: CalculationReviewState = { status: "DRAFT" };
    setReviewState(initialState);
    if (onReviewStateChange) onReviewStateChange(initialState);
  }, [storageKey, projectId]);

  // Helper to persist & sync state
  const updateReviewState = (next: CalculationReviewState, skipSaveBackend = false) => {
    setReviewState(next);
    
    // Save to Backend
    if (!skipSaveBackend) {
      const currentProj = workspaceStore.getState().project;
      if (currentProj && currentProj.id === projectId) {
        const currentWdata = currentProj.workspace_data || {};
        const reviewStates = currentWdata.review_states || {};
        const updatedWdata = {
          ...currentWdata,
          review_states: {
            ...reviewStates,
            [storageKey]: next
          }
        };
        
        api.saveWorkspace(projectId, updatedWdata).catch(console.error);
        workspaceStore.updateProject({ ...currentProj, workspace_data: updatedWdata });
      }
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(storageKey, JSON.stringify(next));
    }
    if (onReviewStateChange) {
      onReviewStateChange(next);
    }

    // Trigger custom window event for cross-component sync
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("mep-review-state-updated", { detail: next }));
    }
  };

  // Action 1: Sr. Design Engineer Hits "Review"
  const handleSrReviewSubmit = async () => {
    const timestamp = new Date().toLocaleString();
    const updated: CalculationReviewState = {
      ...reviewState,
      status: "REVIEWED",
      reviewedBy: currentUserName,
      reviewedAt: timestamp,
      history: [
        ...(reviewState.history || []),
        {
          action: "REVIEWED",
          user: currentUserName,
          role: "Sr. Design Engineer",
          timestamp,
          comment: "Calculation Reviewed"
        }
      ]
    };

    updateReviewState(updated, true);

    // Send notification to Discipline Coordinator to review/approve
    try {
      if (typeof window !== 'undefined') {
        const coordNotifRecord = {
          id: `coord-notif-${Date.now()}`,
          reviewerName: currentUserName,
          calculatorTitle,
          calculatorPath,
          projectId,
          timestamp: new Date().toISOString()
        };

        const currentProj = workspaceStore.getState().project;
        if (currentProj && currentProj.id === projectId) {
          const currentWdata = currentProj.workspace_data || {};
          const existingCoord = Array.isArray(currentWdata.coord_notifs) ? currentWdata.coord_notifs : [];
          const reviewStates = currentWdata.review_states || {};

          const updatedWdata = {
            ...currentWdata,
            review_states: {
              ...reviewStates,
              [storageKey]: updated
            },
            coord_notifs: [coordNotifRecord, ...existingCoord].slice(0, 20)
          };

          api.saveWorkspace(projectId, updatedWdata).catch(console.error);
          workspaceStore.updateProject({ ...currentProj, workspace_data: updatedWdata });
        }

        try {
          const existingCoordLS = JSON.parse(localStorage.getItem("mep_calc_coord_notifs") || "[]");
          if (!existingCoordLS.some((n: any) => n.id === coordNotifRecord.id)) {
            existingCoordLS.unshift(coordNotifRecord);
            localStorage.setItem("mep_calc_coord_notifs", JSON.stringify(existingCoordLS.slice(0, 20)));
          }
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("mep-notification-added"));
        window.dispatchEvent(new CustomEvent("mep-review-state-updated", { 
          detail: {
            status: "SR_REVIEW_SUBMITTED",
            reviewedBy: currentUserName,
            calculatorTitle,
            projectId
          } 
        }));
      }
    } catch (e) {
      console.error("Failed to save notification:", e);
    }

    try {
      await api.logActivity("CALCULATION_REVIEWED", {
        calculatorTitle,
        reviewedBy: currentUserName
      });
    } catch (e) {}

    toast.success("Calculation marked as REVIEWED! Notification sent to Discipline Coordinator.");
  };

  // Action 2: Discipline Coordinator Hits "Approve"
  const handleCoordinatorApprove = async () => {
    const timestamp = new Date().toLocaleString();
    const updated: CalculationReviewState = {
      ...reviewState,
      status: "APPROVED",
      approvedBy: currentUserName,
      approvedAt: timestamp,
      history: [
        ...(reviewState.history || []),
        {
          action: "APPROVED",
          user: currentUserName,
          role: "Discipline Coordinator",
          timestamp,
          comment: "Calculation Approved"
        }
      ]
    };

    updateReviewState(updated);

    try {
      await api.logActivity("CALCULATION_APPROVED", {
        calculatorTitle,
        approvedBy: currentUserName
      });
      
      const revisions = workspaceStore.getState().project?.revisions || [];
      const newRevNumber = revisions.length + 1;
      const dateStr = new Date().toLocaleDateString();
      workspaceStore.saveAsRevision(`V_${newRevNumber} - Approved on ${dateStr}`);
    } catch (e) {}

    toast.success(`Calculation APPROVED! Status updated for all team members.`);
  };

  // Action 3: Discipline Coordinator Hits "Reject"
  const handleCoordinatorRejectSubmit = async () => {
    if (!rejectReason.trim()) {
      toast.error("Please enter a description/reason for rejection.");
      return;
    }

    const timestamp = new Date().toLocaleString();
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

    updateReviewState(updated, true);
    setShowRejectModal(false);

    // Create Notification for Sr. Design Engineer
    try {
      if (typeof window !== 'undefined') {
        const notifRecord = {
          id: `rejection-${Date.now()}`,
          rejectedBy: currentUserName,
          reason: rejectReason.trim(),
          calculatorTitle,
          calculatorPath,
          projectId,
          timestamp: new Date().toISOString()
        };
        
        const currentProj = workspaceStore.getState().project;
        if (currentProj && currentProj.id === projectId) {
          const currentWdata = currentProj.workspace_data || {};
          const existing = Array.isArray(currentWdata.rejection_notifs) ? currentWdata.rejection_notifs : [];
          const reviewStates = currentWdata.review_states || {};
          const updatedWdata = {
            ...currentWdata,
            review_states: {
              ...reviewStates,
              [storageKey]: updated
            },
            rejection_notifs: [notifRecord, ...existing].slice(0, 20)
          };
          api.saveWorkspace(projectId, updatedWdata).catch(console.error);
          workspaceStore.updateProject({ ...currentProj, workspace_data: updatedWdata });
        } else {
          const existing = JSON.parse(localStorage.getItem("mep_calc_rejection_notifs") || "[]");
          existing.unshift(notifRecord);
          localStorage.setItem("mep_calc_rejection_notifs", JSON.stringify(existing.slice(0, 20)));
        }
        window.dispatchEvent(new CustomEvent("mep-notification-added"));
        window.dispatchEvent(new CustomEvent("mep-review-state-updated", {
          detail: {
            status: "REJECTED",
            rejectedBy: currentUserName,
            rejectionDescription: rejectReason.trim(),
            calculatorTitle,
            projectId
          }
        }));
      }
    } catch (e) {}

    setRejectReason("");

    try {
      await api.logActivity("CALCULATION_REJECTED", {
        calculatorTitle,
        rejectedBy: currentUserName,
        reason: rejectReason
      });
    } catch (e) {}

    toast.error("Calculation REJECTED and rejection notification sent.");
  };

  return (
    <div className="no-print select-none inline-flex items-center gap-3">
      {/* 1. DIRECT HEADER ACTION BUTTONS */}
      <div className="inline-flex items-center gap-2 shrink-0">
        {/* SR. DESIGN ENGINEER / ADMIN REVIEW BUTTON */}
        {isSrEngineerOrAdmin && (
          <button
            onClick={handleSrReviewSubmit}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="size-3.5" />
            <span>{reviewState.status === "REVIEWED" || reviewState.status === "APPROVED" ? "Reviewed" : "Review"}</span>
          </button>
        )}

        {/* DISCIPLINE COORDINATOR / ADMIN APPROVE & REJECT BUTTONS */}
        {isCoordinatorOrAdmin && (
          <div className="inline-flex items-center gap-2 shrink-0">
            <button
              onClick={handleCoordinatorApprove}
              disabled={reviewState.status === "APPROVED"}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <CheckCircle2 className="size-3.5" />
              <span>Approve</span>
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={reviewState.status === "REJECTED"}
              className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <XCircle className="size-3.5" />
              <span>Reject</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. STATUS BADGES */}
      {reviewState.status === "APPROVED" && (
        <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 dark:bg-emerald-950/40 dark:border-emerald-700/50 rounded-xl flex items-center gap-2.5 shadow-xs shrink-0">
          <div className="size-6 rounded-md bg-emerald-500 text-white flex items-center justify-center font-bold shrink-0">
            <CheckCircle2 className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[11px] text-emerald-700 dark:text-emerald-300 tracking-wide uppercase">
              CALCULATION APPROVED
            </span>
            <span className="text-[9.5px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
              Official Record
            </span>
          </div>
          <span className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-medium border-l border-emerald-500/30 pl-2.5">
            Approved by <span className="font-bold">{reviewState.approvedBy || "Discipline Coordinator"}</span> on {reviewState.approvedAt || "recently"}
          </span>
        </div>
      )}

      {reviewState.status === "REJECTED" && (
        <div className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 dark:bg-red-950/40 dark:border-red-700/50 rounded-xl flex items-center gap-2.5 shadow-xs shrink-0">
          <div className="size-6 rounded-md bg-red-500 text-white flex items-center justify-center font-bold shrink-0">
            <XCircle className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-[11px] text-red-600 dark:text-red-400 tracking-wide uppercase">
              CALCULATION REJECTED
            </span>
          </div>
          <span className="text-[11px] text-red-700/90 dark:text-red-300/90 font-medium border-l border-red-500/30 pl-2.5">
            Reason from {reviewState.rejectedBy}: "{reviewState.rejectionDescription}"
          </span>
        </div>
      )}

      {reviewState.status === "REVIEWED" && (
        <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/40 dark:border-amber-700/50 rounded-xl flex items-center gap-2.5 shadow-xs shrink-0">
          <div className="size-6 rounded-md bg-amber-500 text-white flex items-center justify-center font-bold shrink-0">
            <Clock className="size-3.5" />
          </div>
          <span className="font-extrabold text-[11px] text-amber-700 dark:text-amber-300 tracking-wide uppercase">
            REVIEWED BY SR. DESIGN ENGINEER
          </span>
          <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 font-medium border-l border-amber-500/30 pl-2.5">
            Reviewed by <span className="font-bold">{reviewState.reviewedBy}</span> on {reviewState.reviewedAt}
          </span>
        </div>
      )}

      {/* MODAL: Reject Reason Modal (Only for rejection description) */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-red-600 dark:text-red-400 flex items-center gap-2 mb-2">
              <AlertTriangle className="size-5 text-red-500" />
              Reject Calculation
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Please enter the exact reason and description for rejecting the calculation.
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
        </div>
      )}
    </div>
  );
}

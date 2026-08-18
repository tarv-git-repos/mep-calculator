import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ShieldCheck, 
  AlertTriangle
} from "lucide-react";
import { workspaceStore } from "@/lib/workspace-store";
import { api } from "@/services/api";
import { toast } from "sonner";

export type WorkflowRole = 
  | "Jr. / Design Engineer"
  | "Sr. Design Engineer"
  | "Discipline Coordinator";

export interface CalculationReviewState {
  status: "DRAFT" | "REVIEWED" | "APPROVED" | "REJECTED";
  reviewedBy?: string;
  reviewedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionDescription?: string;
  history?: Array<{
    action: "REVIEWED" | "APPROVED" | "REJECTED";
    user: string;
    role: string;
    timestamp: string;
    comment?: string;
  }>;
}

interface CalculationReviewBarProps {
  projectId: string;
  calculatorPath: string; // e.g. "/ventilation", "/lighting-lux-calculation"
  calculatorTitle: string; // e.g. "Ventilation", "Lighting Lux"
  onReviewStateChange?: (state: CalculationReviewState) => void;
}

export function CalculationReviewBar({
  projectId,
  calculatorPath,
  calculatorTitle,
  onReviewStateChange
}: CalculationReviewBarProps) {
  // Resolve current active logged-in user profile
  const profile = (workspaceStore.getState() as any)?.profile;
  const userData = (workspaceStore.getState() as any)?.user;
  const currentUserName = userData?.name || profile?.name || "System Admin";

  // 1. Workflow Role derived automatically from designation & profile role
  const userRole = useMemo<WorkflowRole>(() => {
    const activeProfile = profile || userData || {};
    const roleVal = String(activeProfile.role || userData?.user_metadata?.role || userData?.role || "").trim();
    const des = String(activeProfile.designation || "").toLowerCase().trim();
    const rawRole = roleVal.toLowerCase();

    // First priority: Explicit Junior / Design Engineer check (Must NEVER get Review or Approve buttons)
    if (
      roleVal === "Jr. Design Engineer" ||
      roleVal === "Junior Design Engineer" ||
      roleVal === "Design Engineer" ||
      roleVal === "jr. Design Engineer" ||
      rawRole.includes("junior") ||
      rawRole.includes("jr.") ||
      des.includes("junior") ||
      des.includes("jr.")
    ) {
      return "Jr. / Design Engineer";
    }

    // Second priority: Discipline Coordinator check ONLY (ONLY Discipline Coordinator gets Approve & Reject buttons)
    if (
      roleVal === "Discipline Coordinator" ||
      rawRole === "discipline coordinator" ||
      rawRole.includes("coordinator") ||
      des.includes("coordinator")
    ) {
      return "Discipline Coordinator";
    }

    // Third priority: Sr. Design Engineer check (ONLY role that gets the Review button)
    if (
      roleVal === "Sr. Design Engineer" ||
      roleVal === "Senior Design Engineer" ||
      rawRole.includes("senior") ||
      rawRole.includes("sr.") ||
      rawRole === "sr" ||
      des.includes("senior") ||
      des.includes("sr.") ||
      des === "sr"
    ) {
      return "Sr. Design Engineer";
    }

    // Default fallback: Jr. / Design Engineer
    return "Jr. / Design Engineer";
  }, [profile, userData]);

  const storageKey = `mep_calc_review_${projectId || "default"}_${calculatorPath || "/ventilation"}`;

  // 2. Calculation Review State
  const [reviewState, setReviewState] = useState<CalculationReviewState>(() => {
    const currentProj = workspaceStore.getState().project;
    if (currentProj && currentProj.id === projectId) {
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

  // Action 1: Sr. Design Engineer Hits "Reviewed"
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
          comment: "Calculation reviewed."
        }
      ]
    };

    updateReviewState(updated, true);
    setShowReviewModal(false);

    // Always send notification to Discipline Coordinator to review
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
            localStorage.setItem("mep_calc_coord_notifs", JSON.stringify([coordNotifRecord, ...existingCoordLS].slice(0, 20)));
          }
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("mep-review-state-updated", {
          detail: {
            ...updated,
            calculatorTitle,
            calculatorPath,
            projectId,
            status: "SR_REVIEW_SUBMITTED"
          }
        }));
      }
    } catch (e) {}

    toast.success("Calculation marked as REVIEWED and sent to Discipline Coordinator for approval.");
  };

  // Action 2: Discipline Coordinator Hits "Approve"
  const handleCoordinatorApprove = () => {
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
          comment: "Calculation approved."
        }
      ]
    };
    updateReviewState(updated);
    toast.success("Calculation officially APPROVED!");
  };

  // Action 3: Discipline Coordinator Hits "Reject"
  const handleCoordinatorRejectSubmit = () => {
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason/description.");
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
    setRejectReason("");

    // Persist rejection notification for Sr. Design Engineer ONLY
    try {
      if (typeof window !== 'undefined') {
        const rejectionNotifRecord = {
          id: `rejection-notif-${Date.now()}`,
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
            rejection_notifs: [rejectionNotifRecord, ...existing].slice(0, 20)
          };

          api.saveWorkspace(projectId, updatedWdata).catch(console.error);
          workspaceStore.updateProject({ ...currentProj, workspace_data: updatedWdata });
        }

        try {
          const existingLS = JSON.parse(localStorage.getItem("mep_calc_rejection_notifs") || "[]");
          if (!existingLS.some((n: any) => n.id === rejectionNotifRecord.id)) {
            localStorage.setItem("mep_calc_rejection_notifs", JSON.stringify([rejectionNotifRecord, ...existingLS].slice(0, 20)));
          }
        } catch (e) {}

        window.dispatchEvent(new CustomEvent("mep-review-state-updated", {
          detail: {
            ...updated,
            calculatorTitle,
            calculatorPath,
            projectId,
            status: "REJECTED"
          }
        }));
      }
    } catch (e) {}

    toast.error("Calculation REJECTED and notification sent to Sr. Design Engineer.");
  };

  return (
    <div className="no-print select-none inline-flex items-center gap-3">
      {/* 1. DIRECT HEADER ACTION BUTTONS (Rendered on Left) */}
      <div className="inline-flex items-center gap-2 shrink-0">
        {/* SR. DESIGN ENGINEER ACTION BUTTON */}
        {userRole === "Sr. Design Engineer" && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-full shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <CheckCircle2 className="size-3.5" />
            <span>{reviewState.status === "REVIEWED" || reviewState.status === "APPROVED" ? "Reviewed" : "Review"}</span>
          </button>
        )}

        {/* DISCIPLINE COORDINATOR ACTION BUTTONS */}
        {userRole === "Discipline Coordinator" && (
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

      {/* 2. STATUS BADGE / BANNER */}
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

      {reviewState.status === "REJECTED" && (userRole === "Sr. Design Engineer" || userRole === "Discipline Coordinator") && (
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

      {/* MODAL 1: Sr. Design Engineer Review Confirmation Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-2">
              <ShieldCheck className="size-5 text-indigo-500" />
              Mark Calculation as Reviewed
            </h3>
            <p className="text-xs text-muted-foreground mb-6">
              Are you sure you want to mark the calculation for <span className="font-bold text-foreground">{calculatorTitle}</span> as Reviewed? This will notify the Discipline Coordinator for approval.
            </p>
            <div className="flex items-center justify-end gap-2">
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
                <CheckCircle2 className="size-3.5" />
                Confirm Review
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Discipline Coordinator Reject Modal (Mandatory Rejection Description) */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
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
        </div>
      )}
    </div>
  );
}

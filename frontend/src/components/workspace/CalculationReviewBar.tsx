import React, { useState, useEffect, useMemo } from "react";
import { 
  CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquare, 
  Send, UserCheck, ShieldCheck, ChevronDown, User, Sparkles, RefreshCw, FileText 
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { api } from "@/services/api";
import { workspaceStore } from "@/lib/workspace-store";

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
  const currentUserEmail = userData?.email || profile?.email || "";

  // 1. Workflow Role derived automatically from admin-assigned designation & profile role
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

    // Second priority: Discipline Coordinator / Admin check (Gets Approve & Reject buttons)
    if (
      roleVal === "Discipline Coordinator" ||
      roleVal === "Admin" ||
      roleVal === "SUPER_ADMIN" ||
      roleVal === "ORG_ADMIN" ||
      rawRole.includes("coordinator") ||
      rawRole.includes("lead") ||
      rawRole.includes("admin") ||
      des.includes("coordinator") ||
      des.includes("lead")
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

  // Modal States
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  
  const [srComments, setSrComments] = useState("");
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
      reviewerComments: srComments.trim() || undefined,
      history: [
        ...(reviewState.history || []),
        {
          action: "REVIEWED",
          user: currentUserName,
          role: "Sr. Design Engineer",
          timestamp,
          comment: srComments.trim() || "Calculation reviewed and submitted to Discipline Coordinator."
        }
      ]
    };

    // Pass skipSaveBackend = true, we will do one combined save below
    updateReviewState(updated, true);
    setShowReviewModal(false);

    // Always send notification to Discipline Coordinator to review
    try {
      if (typeof window !== 'undefined') {
        const coordNotifRecord = {
          id: `coord-notif-${Date.now()}`,
          reviewerName: currentUserName,
          comments: srComments.trim() || "Ready for approval.",
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

        // Save to LocalStorage fallback as well for immediate cross-tab/local sync
        try {
          const existingCoordLS = JSON.parse(localStorage.getItem("mep_calc_coord_notifs") || "[]");
          if (!existingCoordLS.some((n: any) => n.id === coordNotifRecord.id)) {
            existingCoordLS.unshift(coordNotifRecord);
            localStorage.setItem("mep_calc_coord_notifs", JSON.stringify(existingCoordLS.slice(0, 20)));
          }
        } catch (e) {}

        // Dispatch event to notify Jr. Design Engineers & Coordinators
        window.dispatchEvent(new CustomEvent("mep-notification-added"));
        window.dispatchEvent(new CustomEvent("mep-review-state-updated", { 
          detail: {
            status: "SR_REVIEW_SUBMITTED",
            reviewedBy: currentUserName,
            reviewerComments: srComments.trim(),
            calculatorTitle,
            projectId
          } 
        }));
      }
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

    toast.success("Review submitted! Revision instructions sent to Design Engineers.");
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
      
      // Auto-save version
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

    // Pass skipSaveBackend = true, we will do one combined save below
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

    toast.error("Calculation REJECTED and rejection notification sent to Sr. Design Engineer.");
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

        {/* JR / DESIGN ENGINEER VIEW NOTES */}
        {userRole === "Jr. / Design Engineer" && reviewState.reviewerComments && (
          <button
            onClick={() => setShowCommentsModal(true)}
            className="px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 text-xs font-semibold rounded-full transition-colors flex items-center gap-1 cursor-pointer shrink-0"
          >
            <MessageSquare className="size-3.5" /> Reviewer Notes
          </button>
        )}
      </div>

      {/* 2. STATUS BADGE / BANNER (Rendered on Right of Approve/Reject Buttons) */}
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

      {/* MODAL 1: Sr. Design Engineer Review Comments Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
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

      {/* MODAL 3: View Reviewer Notes Modal */}
      {showCommentsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-6 animate-scale-in">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2 mb-2">
              <MessageSquare className="size-5 text-primary" />
              Reviewer Notes & Feedback
            </h3>
            {reviewState.reviewerComments && (
              <div className="mb-4">
                <span className="text-[11px] font-bold text-muted-foreground uppercase">Sr. Design Engineer Notes:</span>
                <p className="text-xs text-foreground bg-surface-2 p-3 rounded-xl border border-border mt-1">
                  {reviewState.reviewerComments}
                </p>
              </div>
            )}
            {reviewState.rejectionDescription && (
              <div className="mb-4">
                <span className="text-[11px] font-bold text-red-500 uppercase">Discipline Coordinator Rejection Description:</span>
                <p className="text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 p-3 rounded-xl border border-red-200 dark:border-red-900/50 mt-1">
                  {reviewState.rejectionDescription}
                </p>
              </div>
            )}
            <div className="flex items-center justify-end mt-5">
              <button
                onClick={() => setShowCommentsModal(false)}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { workspaceStore } from "@/lib/workspace-store";

export function formatDateStr(rawDate?: string): string {
  if (!rawDate) return "";
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {}

  const datePart = String(rawDate).split(",")[0].trim();
  if (datePart.includes("/")) {
    const parts = datePart.split("/");
    if (parts.length === 3) {
      const day = parts[0].padStart(2, "0");
      const month = parts[1].padStart(2, "0");
      const year = parts[2];
      return `${day}/${month}/${year}`;
    }
  } else if (datePart.includes("-")) {
    const parts = datePart.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[2].padStart(2, "0")}/${parts[1].padStart(2, "0")}/${parts[0]}`;
      }
    }
  }
  return datePart;
}

export function getExporterUserName(metaUserName?: string): string {
  if (metaUserName && metaUserName.trim() && metaUserName !== "System Admin") {
    return metaUserName.trim();
  }

  if (typeof window !== "undefined") {
    // 1. Check window global if attached by active session
    if ((window as any).currentMepUserName) return (window as any).currentMepUserName;

    // 2. Check active auth user from 'mep_user'
    try {
      const uStr = localStorage.getItem('mep_user');
      if (uStr) {
        const u = JSON.parse(uStr);
        if (u.name) return u.name;
        if (u.user?.name) return u.user.name;
      }
    } catch (e) {}

    // 3. Check workspace store current user
    try {
      const storeUser = (workspaceStore.getState() as any)?.user;
      if (storeUser?.name) return storeUser.name;
    } catch (e) {}

    // 4. Check secondary profile keys
    try {
      const pStr = localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile');
      if (pStr) {
        const p = JSON.parse(pStr);
        if (p.name) return p.name;
        if (p.user?.name) return p.user.name;
      }
    } catch (e) {}
  }

  return metaUserName?.trim() || "System Admin";
}

export function resolveLatestReviewState(projectId: string, calculatorPath: string) {
  const rawPath = calculatorPath || "ventilation";
  const pathWithSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const pathNoSlash = rawPath.replace(/^\//, "");
  const currentProj = workspaceStore.getState().project;
  const pId = projectId || currentProj?.id || "default";

  const key1 = `mep_calc_review_${pId}_${rawPath}`;
  const key2 = `mep_calc_review_${pId}_${pathWithSlash}`;
  const key3 = `mep_calc_review_${pId}_${pathNoSlash}`;
  const keysToTry = [key1, key2, key3];

  let candidateBackend: any = null;
  let candidateLocal: any = null;

  // 1. Fetch from workspaceStore project workspace_data
  if (currentProj) {
    const reviewStates = currentProj.workspace_data?.review_states || {};
    for (const k of keysToTry) {
      if (reviewStates[k] && (reviewStates[k].status || reviewStates[k].history)) {
        candidateBackend = reviewStates[k];
        break;
      }
    }
  }

  // 2. Fetch from LocalStorage
  if (typeof window !== "undefined") {
    for (const k of keysToTry) {
      try {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.status || parsed.history || parsed.approvedBy || parsed.reviewedBy)) {
            candidateLocal = parsed;
            break;
          }
        }
      } catch (e) {}
    }
  }

  // If local storage has a newer history or approval, return candidateLocal
  if (candidateBackend && candidateLocal) {
    const bHistLen = Array.isArray(candidateBackend.history) ? candidateBackend.history.length : 0;
    const lHistLen = Array.isArray(candidateLocal.history) ? candidateLocal.history.length : 0;
    if (lHistLen >= bHistLen) {
      return candidateLocal;
    }
    return candidateBackend;
  }

  return candidateLocal || candidateBackend || {};
}

export function getSignatureBlockDetails(
  projectId: string,
  calculatorPath: string,
  exporterName: string
) {
  const reviewState = resolveLatestReviewState(projectId, calculatorPath);
  const currentProj = workspaceStore.getState().project;

  // Originated by Date = Date of creation of that project
  const projectCreationDateRaw = currentProj?.created_at || currentProj?.createdAt || currentProj?.date;
  let projectCreatedDateStr = "";
  if (projectCreationDateRaw) {
    projectCreatedDateStr = formatDateStr(projectCreationDateRaw);
  }
  if (!projectCreatedDateStr) {
    projectCreatedDateStr = formatDateStr(new Date().toISOString());
  }

  // 1. Originated By: Name = user who exported PDF/Excel (Primary auth user), Date = project creation date
  const originatedName = getExporterUserName(exporterName);
  const originatedDate = projectCreatedDateStr;

  // 2. Reviewed By: Find the LATEST reviewed action
  let reviewerName = "";
  let reviewerDate = "";

  if (reviewState?.history && Array.isArray(reviewState.history) && reviewState.history.length > 0) {
    const revItem = [...reviewState.history].reverse().find((h: any) => h.action === "REVIEWED");
    if (revItem) {
      reviewerName = revItem.user;
      reviewerDate = formatDateStr(revItem.timestamp);
    }
  }

  if (!reviewerName && reviewState?.reviewedBy) {
    reviewerName = reviewState.reviewedBy;
    reviewerDate = formatDateStr(reviewState.reviewedAt);
  }

  // 3. Approved By: Find the LATEST approved action
  let approverName = "";
  let approverDate = "";

  if (reviewState?.history && Array.isArray(reviewState.history) && reviewState.history.length > 0) {
    const appItem = [...reviewState.history].reverse().find((h: any) => h.action === "APPROVED");
    if (appItem) {
      approverName = appItem.user;
      approverDate = formatDateStr(appItem.timestamp);
    }
  }

  if (!approverName && reviewState?.status === "APPROVED" && reviewState?.approvedBy) {
    approverName = reviewState.approvedBy;
    approverDate = formatDateStr(reviewState.approvedAt);
  }

  return {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate
  };
}

/**
 * Appends the 3-tier signature block to a jsPDF instance.
 * @param doc The jsPDF document instance
 * @param startY The Y coordinate to start drawing the table
 * @param creatorName Name of the originator / exporter
 * @param projectId Project ID
 * @param calculatorPath Current path to derive storage key
 */
export function addPdfSignatureBlock(
  doc: jsPDF,
  startY: number,
  creatorName: string,
  projectId: string,
  calculatorPath: string
): number {
  const {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate
  } = getSignatureBlockDetails(projectId, calculatorPath, creatorName);

  const head = [["", "Originated by", "Reviewed by", "Approved by"]];
  const body = [
    ["Name:", originatedName, reviewerName, approverName],
    ["Date:", originatedDate, reviewerDate, approverDate],
  ];

  autoTable(doc, {
    startY: startY + 10,
    head: head,
    body: body,
    theme: "grid",
    headStyles: {
      fillColor: [253, 235, 218],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
    },
    bodyStyles: {
      halign: "center",
      valign: "middle",
    },
    columnStyles: {
      0: { fontStyle: "bold", halign: "right", cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 50 },
      3: { cellWidth: 50 },
    },
    styles: {
      fontSize: 10,
      cellPadding: 3,
    },
    margin: { left: 14 }
  });

  return (doc as any).lastAutoTable.finalY;
}

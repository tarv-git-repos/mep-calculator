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

export function getSignatureBlockDetails(
  projectId: string,
  calculatorPath: string,
  exporterName: string
) {
  let reviewState: any = {};
  
  const rawPath = calculatorPath || "ventilation";
  const pathWithSlash = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
  const pathNoSlash = rawPath.replace(/^\//, "");
  const currentProj = workspaceStore.getState().project;
  const pId = projectId || currentProj?.id || "default";

  const key1 = `mep_calc_review_${pId}_${rawPath}`;
  const key2 = `mep_calc_review_${pId}_${pathWithSlash}`;
  const key3 = `mep_calc_review_${pId}_${pathNoSlash}`;

  // Originated by Date = Date of creation of that project
  const projectCreationDateRaw = currentProj?.created_at || currentProj?.createdAt || currentProj?.date;
  let projectCreatedDateStr = "";
  if (projectCreationDateRaw) {
    projectCreatedDateStr = formatDateStr(projectCreationDateRaw);
  }
  if (!projectCreatedDateStr) {
    projectCreatedDateStr = formatDateStr(new Date().toISOString());
  }

  // Fetch Review State from Workspace Project Data
  if (currentProj) {
    const reviewStates = currentProj.workspace_data?.review_states || {};
    if (reviewStates[key1]) reviewState = reviewStates[key1];
    else if (reviewStates[key2]) reviewState = reviewStates[key2];
    else if (reviewStates[key3]) reviewState = reviewStates[key3];
  }

  // Fallback to LocalStorage
  if (!reviewState?.status && typeof window !== "undefined") {
    const keysToTry = [key1, key2, key3];
    for (const k of keysToTry) {
      try {
        const saved = localStorage.getItem(k);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && (parsed.status || parsed.reviewedBy || parsed.approvedBy)) {
            reviewState = parsed;
            break;
          }
        }
      } catch (e) {}
    }
  }

  // 1. Originated By: Name = user who exported PDF/Excel (Primary auth user), Date = project creation date
  const originatedName = getExporterUserName(exporterName);
  const originatedDate = projectCreatedDateStr;

  // 2. Reviewed By: Name = recently reviewed user, Date = review date
  let reviewerName = "";
  let reviewerDate = "";
  if (reviewState?.reviewedBy) {
    reviewerName = reviewState.reviewedBy;
    reviewerDate = formatDateStr(reviewState.reviewedAt);
  } else if (reviewState?.history && Array.isArray(reviewState.history)) {
    const revItem = [...reviewState.history].reverse().find((h: any) => h.action === "REVIEWED");
    if (revItem) {
      reviewerName = revItem.user;
      reviewerDate = formatDateStr(revItem.timestamp);
    }
  }

  // 3. Approved By: Name = recently approved user, Date = approval date
  let approverName = "";
  let approverDate = "";
  if (reviewState?.approvedBy) {
    approverName = reviewState.approvedBy;
    approverDate = formatDateStr(reviewState.approvedAt);
  } else if (reviewState?.history && Array.isArray(reviewState.history)) {
    const appItem = [...reviewState.history].reverse().find((h: any) => h.action === "APPROVED");
    if (appItem) {
      approverName = appItem.user;
      approverDate = formatDateStr(appItem.timestamp);
    }
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

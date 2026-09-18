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

export function getExporterUserName(metaUserName?: any): string {
  if (typeof metaUserName === 'object' && metaUserName !== null) {
    if (typeof metaUserName.originatedName === 'string' && metaUserName.originatedName.trim()) {
      return metaUserName.originatedName.trim();
    }
    if (typeof metaUserName.name === 'string' && metaUserName.name.trim()) {
      return metaUserName.name.trim();
    }
  }

  const safeName = typeof metaUserName === 'string' ? metaUserName.trim() : "";
  if (safeName && safeName !== "System Admin") {
    return safeName;
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

  return safeName || "System Admin";
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
  exporterName: string,
  liveReviewState?: any
) {
  const resolvedState = resolveLatestReviewState(projectId, calculatorPath);
  const reviewState = (liveReviewState && typeof liveReviewState === "object" && (liveReviewState.status || liveReviewState.approvedBy || liveReviewState.history))
    ? { ...resolvedState, ...liveReviewState }
    : resolvedState;
  const currentProj = workspaceStore.getState().project;

  // 1. Originator: Name = user who exported PDF/Excel (Primary auth user), Date = Current export/calculation date
  const originatedName = getExporterUserName(exporterName);
  const originatedDate = formatDateStr(new Date().toISOString());

  // 2. Reviewer: Find the LATEST reviewed action
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

  if (!reviewerName && (currentProj as any)?.reviewedBy) {
    reviewerName = (currentProj as any).reviewedBy;
    reviewerDate = formatDateStr((currentProj as any).reviewedAt || new Date().toISOString());
  }

  // 3. Approver: Find the LATEST approved action
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

  if (!approverName && (currentProj as any)?.approvedBy) {
    approverName = (currentProj as any).approvedBy;
    approverDate = formatDateStr((currentProj as any).approvedAt || new Date().toISOString());
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
  creatorOrDetails: any,
  projectId?: string,
  calculatorPath?: string,
  marginOptions?: { left?: number; right?: number }
): number {
  let details: any;
  if (creatorOrDetails && typeof creatorOrDetails === "object" && "originatedName" in creatorOrDetails) {
    details = creatorOrDetails;
  } else {
    details = getSignatureBlockDetails(
      projectId || "default",
      calculatorPath || "/ventilation",
      typeof creatorOrDetails === "string" ? creatorOrDetails : ""
    );
  }

  const {
    originatedName = "System Admin",
    originatedDate = formatDateStr(new Date().toISOString()),
    reviewerName = "",
    reviewerDate = "",
    approverName = "",
    approverDate = ""
  } = details;

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = marginOptions?.left ?? (pageWidth > 500 ? 40 : 14);
  const rightMargin = marginOptions?.right ?? (pageWidth > 500 ? 40 : 14);
  const availableWidth = pageWidth - leftMargin - rightMargin;

  const col0Width = Math.max(65, Math.floor(availableWidth * 0.16));
  const remainingWidth = availableWidth - col0Width;
  const colSigWidth = Math.floor(remainingWidth / 3);
  const lastColWidth = remainingWidth - (colSigWidth * 2);

  const head = [["", "Originator", "Reviewer", "Approver"]];
  const body = [
    ["Name:", originatedName || "-", reviewerName || "-", approverName || "-"],
    ["Date:", originatedDate || "-", reviewerDate || "-", approverDate || "-"],
  ];

  const callTable = (pdfDoc: any, options: any) => {
    if (typeof autoTable === "function") {
      autoTable(pdfDoc, options);
    } else if (typeof (autoTable as any)?.default === "function") {
      (autoTable as any).default(pdfDoc, options);
    } else if (typeof pdfDoc.autoTable === "function") {
      pdfDoc.autoTable(options);
    }
  };

  callTable(doc, {
    startY: startY + 15,
    head: head,
    body: body,
    theme: "grid",
    headStyles: {
      fillColor: [253, 235, 218],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      fontSize: 9,
    },
    bodyStyles: {
      halign: "center",
      valign: "middle",
      textColor: [20, 20, 20],
      fontSize: 8.5,
    },
    columnStyles: {
      0: { fontStyle: "bold", halign: "right", cellWidth: col0Width },
      1: { cellWidth: colSigWidth },
      2: { cellWidth: colSigWidth },
      3: { cellWidth: lastColWidth },
    },
    styles: {
      fontSize: 8.5,
      cellPadding: 4,
      overflow: "linebreak",
    },
    margin: { left: leftMargin, right: rightMargin }
  });

  return (doc as any).lastAutoTable?.finalY || (startY + 70);
}

export interface PdfHeaderOptions {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
}

export function addPdfHeader(
  doc: jsPDF,
  title: string,
  options: PdfHeaderOptions | string = {}
): number {
  const opts: PdfHeaderOptions = typeof options === "object" && options !== null ? options : {};
  const activeProj: any = workspaceStore.getState()?.project || {};

  const calcNo = opts.calcNo || activeProj?.calcNo || "TRV-CAL-101-R01";
  const today = opts.date || formatDateStr(new Date().toISOString());
  const projectNo = opts.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
  const projectName = opts.projectName || activeProj?.name || activeProj?.projectName || "";
  const clientName = opts.client || activeProj?.client || "";
  const endUser = opts.endUser || activeProj?.endUser || activeProj?.location || "";

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;
  const contentWidth = rightMargin - leftMargin;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, leftMargin, 14);

  // Metadata Outer Box
  doc.setFontSize(9);
  doc.setLineWidth(0.3);
  doc.rect(leftMargin, 18, contentWidth, 18);

  const midX = leftMargin + contentWidth / 2;

  // Vertical dividing line
  doc.line(midX, 18, midX, 36);

  // Horizontal dividing lines
  doc.line(leftMargin, 24, rightMargin, 24);
  doc.line(leftMargin, 30, rightMargin, 30);

  // Column 1
  doc.setFont("helvetica", "bold");
  doc.text("Calculation No.:", leftMargin + 2, 22);
  doc.setFont("helvetica", "normal");
  doc.text(String(calcNo), leftMargin + 31, 22);

  doc.setFont("helvetica", "bold");
  doc.text("Project No.:", leftMargin + 2, 28);
  doc.setFont("helvetica", "normal");
  doc.text(String(projectNo), leftMargin + 26, 28);

  doc.setFont("helvetica", "bold");
  doc.text("Project Name:", leftMargin + 2, 34);
  doc.setFont("helvetica", "normal");
  doc.text(String(projectName), leftMargin + 28, 34);

  // Column 2
  doc.setFont("helvetica", "bold");
  doc.text("Date:", midX + 2, 22);
  doc.setFont("helvetica", "normal");
  doc.text(String(today), midX + 15, 22);

  doc.setFont("helvetica", "bold");
  doc.text("Client:", midX + 2, 28);
  doc.setFont("helvetica", "normal");
  doc.text(String(clientName), midX + 15, 28);

  doc.setFont("helvetica", "bold");
  doc.text("End User:", midX + 2, 34);
  doc.setFont("helvetica", "normal");
  doc.text(String(endUser), midX + 20, 34);

  return 42;
}

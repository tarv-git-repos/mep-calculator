import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { workspaceStore } from "@/lib/workspace-store";
import { getCompanyBranding } from "@/utils/branding";

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

  const origDisplay = originatedName || "-";
  const origDateDisplay = originatedDate || formatDateStr(new Date().toISOString());
  const revDisplay = reviewerName || "-";
  const revDateDisplay = reviewerDate || "-";
  const appDisplay = approverName || "-";
  const appDateDisplay = approverDate || "-";

  const branding = getCompanyBranding();
  const preparedByTitle = branding.preparedByTitle || "Prepared By";
  const reviewedByTitle = branding.reviewedByTitle || "Reviewed By";
  const approvedByTitle = branding.approvedByTitle || "Approved By";

  return {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate,
    preparedByTitle,
    reviewedByTitle,
    approvedByTitle,
    disclaimerText: branding.disclaimerText,
    enableStampBox: branding.enableStampBox,
    originator: {
      name: origDisplay,
      role: preparedByTitle,
      date: origDateDisplay,
      status: originatedName ? "Signed" : "-"
    },
    reviewer: {
      name: revDisplay,
      role: reviewedByTitle,
      date: revDateDisplay,
      status: reviewerName ? "Reviewed" : "-"
    },
    approver: {
      name: appDisplay,
      role: approvedByTitle,
      date: appDateDisplay,
      status: approverName ? "Approved" : "-"
    }
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

  const branding = getCompanyBranding();

  const {
    originatedName = "System Admin",
    originatedDate = formatDateStr(new Date().toISOString()),
    reviewerName = "",
    reviewerDate = "",
    approverName = "",
    approverDate = ""
  } = details;

  const preparedTitle = details.preparedByTitle || branding.preparedByTitle || "Prepared By";
  const reviewedTitle = details.reviewedByTitle || branding.reviewedByTitle || "Reviewed By";
  const approvedTitle = details.approvedByTitle || branding.approvedByTitle || "Approved By";

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = marginOptions?.left ?? (pageWidth > 500 ? 40 : 14);
  const rightMargin = marginOptions?.right ?? (pageWidth > 500 ? 40 : 14);
  const availableWidth = pageWidth - leftMargin - rightMargin;

  const col0Width = Math.max(65, Math.floor(availableWidth * 0.16));
  const remainingWidth = availableWidth - col0Width;
  const colSigWidth = Math.floor(remainingWidth / 3);
  const lastColWidth = remainingWidth - (colSigWidth * 2);

  const head = [["", preparedTitle, reviewedTitle, approvedTitle]];
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

  let endY = (doc as any).lastAutoTable?.finalY || (startY + 70);

  // 1. Engineering Stamp & Seal Box (if enabled)
  const shouldStamp = details.enableStampBox ?? branding.enableStampBox;
  if (shouldStamp) {
    const stampWidth = 54;
    const stampHeight = 22;
    const stampX = pageWidth - rightMargin - stampWidth;
    const stampY = endY + 4;

    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.roundedRect(stampX, stampY, stampWidth, stampHeight, 1.5, 1.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("ENGINEERING STAMP & SEAL", stampX + (stampWidth / 2), stampY + 5.5, { align: "center" });

    doc.setFont("helvetica", "italic");
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text("[ Consulting PE / Reg. Stamp ]", stampX + (stampWidth / 2), stampY + 13.5, { align: "center" });

    endY = stampY + stampHeight;
  }

  // 2. Standard Legal Disclaimer (if configured)
  const disclaimer = details.disclaimerText || branding.disclaimerText;
  if (disclaimer) {
    const discY = endY + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const splitDisclaimer = doc.splitTextToSize(disclaimer, availableWidth);
    doc.text(splitDisclaimer, leftMargin, discY);
    endY = discY + (splitDisclaimer.length * 3.2);
  }

  return endY;
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
  const branding = getCompanyBranding();

  const calcNo = opts.calcNo || activeProj?.calcNo || "TRV-CAL-101-R01";
  const revNo = opts.revNo || activeProj?.revNo || "Rev 0 - IFC";
  const today = opts.date || formatDateStr(new Date().toISOString());
  const projectNo = opts.projectNo || activeProj?.code || activeProj?.projectNo || "P000";
  const projectName = opts.projectName || activeProj?.name || activeProj?.projectName || "";
  const clientName = opts.client || activeProj?.client || "";
  const endUser = opts.endUser || activeProj?.endUser || activeProj?.location || "";

  const pageWidth = doc.internal.pageSize.getWidth();
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;
  const contentWidth = rightMargin - leftMargin;
  const isLandscape = pageWidth > 250;

  const hasBranding = Boolean(
    (branding.companyName && branding.companyName.trim()) ||
    branding.logoUrl ||
    branding.licenseId ||
    branding.isoCertNumber
  );

  if (hasBranding) {
    // 1. Corporate Identity Header Bar
    let compTextX = leftMargin;
    if (branding.logoUrl) {
      try {
        doc.addImage(branding.logoUrl, "PNG", leftMargin, 5, 26, 10);
        compTextX = leftMargin + 29;
      } catch (e) {
        compTextX = leftMargin;
      }
    }

    // Company Name & Tagline
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(branding.companyName || "MEP ENGINEERING CONSULTANCY", compTextX, 9.5);

    if (branding.tagline) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.8);
      doc.setTextColor(100, 116, 139);
      doc.text(branding.tagline, compTextX, 13.5);
    }

    // Right-aligned Credentials & Contact
    const credParts = [];
    if (branding.licenseId) credParts.push(`Lic: ${branding.licenseId}`);
    if (branding.isoCertNumber) credParts.push(`ISO: ${branding.isoCertNumber}`);
    const credStr = credParts.join("  |  ");

    if (credStr) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.8);
      doc.setTextColor(71, 85, 105);
      doc.text(credStr, rightMargin, 9, { align: "right" });
    }

    const contactParts = [branding.phone, branding.email, branding.website].filter(Boolean);
    if (contactParts.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.2);
      doc.setTextColor(100, 116, 139);
      doc.text(contactParts.join(" • "), rightMargin, 13, { align: "right" });
    }

    // Divider Line
    doc.setDrawColor(218, 225, 233);
    doc.setLineWidth(0.3);
    doc.line(leftMargin, 15.5, rightMargin, 15.5);

    // Document Title
    doc.setFontSize(12.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(title, leftMargin, 20.5);

    // Metadata Outer Box
    const boxStartY = 22.5;
    const boxHeight = 15;
    const rowHeight = 5;

    doc.setFontSize(8);
    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.rect(leftMargin, boxStartY, contentWidth, boxHeight);

    const midX = isLandscape ? leftMargin + (contentWidth / 2) : 105;
    const dateColX = isLandscape ? midX + 67 : 155;

    // Vertical dividing line
    doc.line(midX, boxStartY, midX, boxStartY + boxHeight);

    // Horizontal dividing lines
    doc.line(leftMargin, boxStartY + rowHeight, rightMargin, boxStartY + rowHeight);
    doc.line(leftMargin, boxStartY + (rowHeight * 2), rightMargin, boxStartY + (rowHeight * 2));

    // Row 1 divider for Date
    doc.line(dateColX, boxStartY, dateColX, boxStartY + rowHeight);

    // Column 1 - Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", leftMargin + 2, boxStartY + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(calcNo), leftMargin + 31, boxStartY + 3.8);

    // Column 1 - Row 2
    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", leftMargin + 2, boxStartY + rowHeight + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectNo), leftMargin + 26, boxStartY + rowHeight + 3.8);

    // Column 1 - Row 3
    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", leftMargin + 2, boxStartY + (rowHeight * 2) + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectName), leftMargin + 28, boxStartY + (rowHeight * 2) + 3.8);

    // Column 2 - Row 1: Rev No & Date
    doc.setFont("helvetica", "bold");
    doc.text("Rev No.:", midX + 2, boxStartY + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(revNo), midX + 17, boxStartY + 3.8);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", dateColX + 2, boxStartY + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(today), dateColX + 12, boxStartY + 3.8);

    // Column 2 - Row 2: Client
    doc.setFont("helvetica", "bold");
    doc.text("Client:", midX + 2, boxStartY + rowHeight + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(clientName), midX + 15, boxStartY + rowHeight + 3.8);

    // Column 2 - Row 3: End User
    doc.setFont("helvetica", "bold");
    doc.text("End User:", midX + 2, boxStartY + (rowHeight * 2) + 3.8);
    doc.setFont("helvetica", "normal");
    doc.text(String(endUser), midX + 20, boxStartY + (rowHeight * 2) + 3.8);

    return 42;
  } else {
    // Standard layout (when no custom company branding is configured)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(title, leftMargin, 14);

    // Metadata Outer Box
    doc.setFontSize(8.5);
    doc.setLineWidth(0.3);
    doc.rect(leftMargin, 18, contentWidth, 18);

    const midX = isLandscape ? leftMargin + 134.5 : 105;
    const dateColX = isLandscape ? midX + 67 : 155;

    // Vertical dividing line
    doc.line(midX, 18, midX, 36);

    // Horizontal dividing lines
    doc.line(leftMargin, 24, rightMargin, 24);
    doc.line(leftMargin, 30, rightMargin, 30);

    // Row 1 divider for Date
    doc.line(dateColX, 18, dateColX, 24);

    // Column 1 - Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", leftMargin + 2, 22);
    doc.setFont("helvetica", "normal");
    doc.text(String(calcNo), leftMargin + 31, 22);

    // Column 1 - Row 2
    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", leftMargin + 2, 28);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectNo), leftMargin + 26, 28);

    // Column 1 - Row 3
    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", leftMargin + 2, 34);
    doc.setFont("helvetica", "normal");
    doc.text(String(projectName), leftMargin + 28, 34);

    // Column 2 - Row 1: Rev No & Date
    doc.setFont("helvetica", "bold");
    doc.text("Rev No.:", midX + 2, 22);
    doc.setFont("helvetica", "normal");
    doc.text(String(revNo), midX + 17, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", dateColX + 2, 22);
    doc.setFont("helvetica", "normal");
    doc.text(String(today), dateColX + 12, 22);

    // Column 2 - Row 2: Client
    doc.setFont("helvetica", "bold");
    doc.text("Client:", midX + 2, 28);
    doc.setFont("helvetica", "normal");
    doc.text(String(clientName), midX + 15, 28);

    // Column 2 - Row 3: End User
    doc.setFont("helvetica", "bold");
    doc.text("End User:", midX + 2, 34);
    doc.setFont("helvetica", "normal");
    doc.text(String(endUser), midX + 20, 34);

    return 42;
  }
}

/**
 * Appends a corporate footer with document confidentiality and page numbers.
 */
export function addPdfFooter(
  doc: jsPDF,
  pageNo?: number,
  totalPages?: number
): void {
  const branding = getCompanyBranding();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const leftMargin = 14;
  const rightMargin = pageWidth - 14;
  const footerY = pageHeight - 8;

  // Thin dividing line
  doc.setDrawColor(218, 225, 233);
  doc.setLineWidth(0.25);
  doc.line(leftMargin, footerY - 3, rightMargin, footerY - 3);

  // Left side: Company Name & Confidentiality
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(130, 140, 150);
  const leftText = branding.companyName
    ? `${branding.companyName}  •  Confidential & Proprietary`
    : "MEP Engineering Calculation  •  Confidential & Proprietary";
  doc.text(leftText, leftMargin, footerY);

  // Right side: Page X of Y or Date
  if (pageNo !== undefined) {
    const pageText = totalPages ? `Page ${pageNo} of ${totalPages}` : `Page ${pageNo}`;
    doc.text(pageText, rightMargin, footerY, { align: "right" });
  } else {
    doc.text(formatDateStr(new Date().toISOString()), rightMargin, footerY, { align: "right" });
  }
}


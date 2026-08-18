import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { workspaceStore } from "@/lib/workspace-store";

/**
 * Appends the 3-tier signature block to a jsPDF instance.
 * @param doc The jsPDF document instance
 * @param startY The Y coordinate to start drawing the table
 * @param creatorName Name of the originator
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
  let reviewState: any = {};
  const storageKey = `mep_calc_review_${projectId || "default"}_${calculatorPath}`;

  const currentProj = workspaceStore.getState().project;
  if (currentProj && currentProj.id === projectId) {
    const reviewStates = currentProj.workspace_data?.review_states || {};
    if (reviewStates[storageKey]) {
      reviewState = reviewStates[storageKey];
    }
  }

  if (!reviewState?.status && typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        reviewState = JSON.parse(saved);
      }
    } catch (e) {}
  }
  const reviewerName = reviewState?.status === "REVIEWED" || reviewState?.status === "APPROVED" 
    ? reviewState?.reviewedBy || "" 
    : "";
  const reviewerDate = reviewState?.status === "REVIEWED" || reviewState?.status === "APPROVED" 
    ? (reviewState?.reviewedAt?.split(',')[0] || "") 
    : "";
    
  const approverName = reviewState?.status === "APPROVED" ? reviewState?.approvedBy || "" : "";
  const approverDate = reviewState?.status === "APPROVED" ? (reviewState?.approvedAt?.split(',')[0] || "") : "";

  const creatorDate = new Date().toLocaleDateString();

  const head = [["", "Originated by", "Reviewed by", "Approved by"]];
  const body = [
    ["Name:", creatorName || "System Admin", reviewerName, approverName],
    ["Date:", creatorDate, reviewerDate, approverDate],
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

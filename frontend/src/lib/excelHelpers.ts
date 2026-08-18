import type { Worksheet } from "exceljs";

import { workspaceStore } from "@/lib/workspace-store";

/**
 * Appends the 3-tier signature block to an Excel worksheet.
 * @param worksheet The exceljs Worksheet instance
 * @param startRow The row number to start drawing the table
 * @param creatorName Name of the originator
 * @param projectId Project ID
 * @param calculatorPath Current path to derive storage key
 */
export function addExcelSignatureBlock(
  worksheet: Worksheet,
  startRow: number,
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

  // Create table structure
  // We'll use 4 columns: A (Label), B (Originated), C (Reviewed), D (Approved)
  // Assuming the worksheet might have different column layouts, we use specific cells but merge if needed, 
  // or just use columns 1, 2, 3, 4. We will use columns 1-4 for simplicity.

  const headerRow = worksheet.getRow(startRow);
  headerRow.getCell(2).value = "Originated by";
  headerRow.getCell(3).value = "Reviewed by";
  headerRow.getCell(4).value = "Approved by";

  const nameRow = worksheet.getRow(startRow + 1);
  nameRow.getCell(1).value = "Name:";
  nameRow.getCell(2).value = creatorName || "System Admin";
  nameRow.getCell(3).value = reviewerName;
  nameRow.getCell(4).value = approverName;

  const dateRow = worksheet.getRow(startRow + 2);
  dateRow.getCell(1).value = "Date:";
  dateRow.getCell(2).value = creatorDate;
  dateRow.getCell(3).value = reviewerDate;
  dateRow.getCell(4).value = approverDate;

  // Styling
  const bgHeader = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDEBDA" }, // Light orange/peach
  } as const;

  const borderAll = {
    top: { style: "thin" as const },
    left: { style: "thin" as const },
    bottom: { style: "thin" as const },
    right: { style: "thin" as const },
  };

  const fontBold = { bold: true };
  const alignCenter = { vertical: "middle" as const, horizontal: "center" as const };
  const alignRight = { vertical: "middle" as const, horizontal: "right" as const };

  [startRow, startRow + 1, startRow + 2].forEach(r => {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.border = borderAll;
      
      if (r === startRow) {
        cell.fill = bgHeader;
        cell.font = fontBold;
        cell.alignment = alignCenter;
      } else {
        if (c === 1) {
          cell.font = fontBold;
          cell.alignment = alignRight;
        } else {
          cell.alignment = alignCenter;
        }
      }
    }
  });

  return startRow + 3;
}

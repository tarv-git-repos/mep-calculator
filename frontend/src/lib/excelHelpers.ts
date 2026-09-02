import type { Worksheet } from "exceljs";
import { getSignatureBlockDetails } from "@/lib/pdfHelpers";

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
  calculatorPath: string,
  totalColumns: number = 7
): number {
  const {
    originatedName,
    originatedDate,
    reviewerName,
    reviewerDate,
    approverName,
    approverDate
  } = getSignatureBlockDetails(projectId, calculatorPath, creatorName);

  const baseFont = { name: "Arial", size: 10, family: 2 };
  const boldFont = { ...baseFont, bold: true };
  const peachFill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFDEBDA" }, // Light orange/peach
  } as const;

  const setCellBorder = (
    cell: any,
    topStyle: string = "thin",
    bottomStyle: string = "thin",
    leftStyle: string = "thin",
    rightStyle: string = "thin"
  ) => {
    cell.border = {
      top: { style: topStyle, color: { argb: "FF000000" } },
      bottom: { style: bottomStyle, color: { argb: "FF000000" } },
      left: { style: leftStyle, color: { argb: "FF000000" } },
      right: { style: rightStyle, color: { argb: "FF000000" } },
    };
  };

  const sigStartRow = startRow;
  worksheet.getRow(sigStartRow).height = 24;

  if (totalColumns === 10) {
    // 10-column layout spanning Columns A through J
    worksheet.mergeCells(`B${sigStartRow}:D${sigStartRow}`);
    worksheet.getCell(`B${sigStartRow}`).value = "Originated by";
    worksheet.getCell(`B${sigStartRow}`).font = boldFont;
    worksheet.getCell(`B${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`E${sigStartRow}:G${sigStartRow}`);
    worksheet.getCell(`E${sigStartRow}`).value = "Reviewed by";
    worksheet.getCell(`E${sigStartRow}`).font = boldFont;
    worksheet.getCell(`E${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`H${sigStartRow}:J${sigStartRow}`);
    worksheet.getCell(`H${sigStartRow}`).value = "Approved by";
    worksheet.getCell(`H${sigStartRow}`).font = boldFont;
    worksheet.getCell(`H${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getCell(sigStartRow, c);
      cell.fill = peachFill;
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = (c === 1 || c === 4 || c === 7 || c === 10) ? "medium" : "thin";
      setCellBorder(cell, "medium", "thin", leftStyle, rightStyle);
    }

    // Name Row
    const nameRow = sigStartRow + 1;
    worksheet.getRow(nameRow).height = 24;
    worksheet.getCell(`A${nameRow}`).value = "Name:";
    worksheet.getCell(`A${nameRow}`).font = boldFont;
    worksheet.getCell(`A${nameRow}`).alignment = { horizontal: "right", vertical: "middle" };

    worksheet.mergeCells(`B${nameRow}:D${nameRow}`);
    worksheet.getCell(`B${nameRow}`).value = originatedName;
    worksheet.getCell(`B${nameRow}`).font = baseFont;
    worksheet.getCell(`B${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`E${nameRow}:G${nameRow}`);
    worksheet.getCell(`E${nameRow}`).value = reviewerName;
    worksheet.getCell(`E${nameRow}`).font = baseFont;
    worksheet.getCell(`E${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`H${nameRow}:J${nameRow}`);
    worksheet.getCell(`H${nameRow}`).value = approverName;
    worksheet.getCell(`H${nameRow}`).font = baseFont;
    worksheet.getCell(`H${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getCell(nameRow, c);
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = (c === 1 || c === 4 || c === 7 || c === 10) ? "medium" : "thin";
      setCellBorder(cell, "thin", "thin", leftStyle, rightStyle);
    }

    // Date Row
    const dateRow = sigStartRow + 2;
    worksheet.getRow(dateRow).height = 24;
    worksheet.getCell(`A${dateRow}`).value = "Date:";
    worksheet.getCell(`A${dateRow}`).font = boldFont;
    worksheet.getCell(`A${dateRow}`).alignment = { horizontal: "right", vertical: "middle" };

    worksheet.mergeCells(`B${dateRow}:D${dateRow}`);
    worksheet.getCell(`B${dateRow}`).value = originatedDate;
    worksheet.getCell(`B${dateRow}`).font = baseFont;
    worksheet.getCell(`B${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`E${dateRow}:G${dateRow}`);
    worksheet.getCell(`E${dateRow}`).value = reviewerDate;
    worksheet.getCell(`E${dateRow}`).font = baseFont;
    worksheet.getCell(`E${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`H${dateRow}:J${dateRow}`);
    worksheet.getCell(`H${dateRow}`).value = approverDate;
    worksheet.getCell(`H${dateRow}`).font = baseFont;
    worksheet.getCell(`H${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 10; c++) {
      const cell = worksheet.getCell(dateRow, c);
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = (c === 1 || c === 4 || c === 7 || c === 10) ? "medium" : "thin";
      setCellBorder(cell, "thin", "medium", leftStyle, rightStyle);
    }
  } else if (totalColumns === 7) {
    // 7-column layout spanning Columns A through G
    worksheet.mergeCells(`B${sigStartRow}:C${sigStartRow}`);
    worksheet.getCell(`B${sigStartRow}`).value = "Originated by";
    worksheet.getCell(`B${sigStartRow}`).font = boldFont;
    worksheet.getCell(`B${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`D${sigStartRow}:E${sigStartRow}`);
    worksheet.getCell(`D${sigStartRow}`).value = "Reviewed by";
    worksheet.getCell(`D${sigStartRow}`).font = boldFont;
    worksheet.getCell(`D${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`F${sigStartRow}:G${sigStartRow}`);
    worksheet.getCell(`F${sigStartRow}`).value = "Approved by";
    worksheet.getCell(`F${sigStartRow}`).font = boldFont;
    worksheet.getCell(`F${sigStartRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 7; c++) {
      const cell = worksheet.getCell(sigStartRow, c);
      cell.fill = peachFill;
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = (c === 1 || c === 3 || c === 5 || c === 7) ? "medium" : "thin";
      setCellBorder(cell, "medium", "thin", leftStyle, rightStyle);
    }

    // Name Row
    const nameRow = sigStartRow + 1;
    worksheet.getRow(nameRow).height = 24;
    worksheet.getCell(`A${nameRow}`).value = "Name:";
    worksheet.getCell(`A${nameRow}`).font = boldFont;
    worksheet.getCell(`A${nameRow}`).alignment = { horizontal: "right", vertical: "middle" };

    worksheet.mergeCells(`B${nameRow}:C${nameRow}`);
    worksheet.getCell(`B${nameRow}`).value = originatedName;
    worksheet.getCell(`B${nameRow}`).font = baseFont;
    worksheet.getCell(`B${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`D${nameRow}:E${nameRow}`);
    worksheet.getCell(`D${nameRow}`).value = reviewerName;
    worksheet.getCell(`D${nameRow}`).font = baseFont;
    worksheet.getCell(`D${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`F${nameRow}:G${nameRow}`);
    worksheet.getCell(`F${nameRow}`).value = approverName;
    worksheet.getCell(`F${nameRow}`).font = baseFont;
    worksheet.getCell(`F${nameRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 7; c++) {
      const cell = worksheet.getCell(nameRow, c);
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = (c === 1 || c === 3 || c === 5 || c === 7) ? "medium" : "thin";
      setCellBorder(cell, "thin", "thin", leftStyle, rightStyle);
    }

    // Date Row
    const dateRow = sigStartRow + 2;
    worksheet.getRow(dateRow).height = 24;
    worksheet.getCell(`A${dateRow}`).value = "Date:";
    worksheet.getCell(`A${dateRow}`).font = boldFont;
    worksheet.getCell(`A${dateRow}`).alignment = { horizontal: "right", vertical: "middle" };

    worksheet.mergeCells(`B${dateRow}:C${dateRow}`);
    worksheet.getCell(`B${dateRow}`).value = originatedDate;
    worksheet.getCell(`B${dateRow}`).font = baseFont;
    worksheet.getCell(`B${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`D${dateRow}:E${dateRow}`);
    worksheet.getCell(`D${dateRow}`).value = reviewerDate;
    worksheet.getCell(`D${dateRow}`).font = baseFont;
    worksheet.getCell(`D${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

    worksheet.mergeCells(`F${dateRow}:G${dateRow}`);
    worksheet.getCell(`F${dateRow}`).value = approverDate;
    worksheet.getCell(`F${dateRow}`).font = baseFont;
    worksheet.getCell(`F${dateRow}`).alignment = { horizontal: "center", vertical: "middle" };

    for (let c = 1; c <= 7; c++) {
      const cell = worksheet.getCell(dateRow, c);
      const leftStyle = c === 1 ? "medium" : "thin";
      const rightStyle = (c === 1 || c === 3 || c === 5 || c === 7) ? "medium" : "thin";
      setCellBorder(cell, "thin", "medium", leftStyle, rightStyle);
    }
  } else {
    // 4-column fallback
    worksheet.getCell(sigStartRow, 2).value = "Originated by";
    worksheet.getCell(sigStartRow, 3).value = "Reviewed by";
    worksheet.getCell(sigStartRow, 4).value = "Approved by";

    const nameRow = sigStartRow + 1;
    worksheet.getCell(nameRow, 1).value = "Name:";
    worksheet.getCell(nameRow, 2).value = originatedName;
    worksheet.getCell(nameRow, 3).value = reviewerName;
    worksheet.getCell(nameRow, 4).value = approverName;

    const dateRow = sigStartRow + 2;
    worksheet.getCell(dateRow, 1).value = "Date:";
    worksheet.getCell(dateRow, 2).value = originatedDate;
    worksheet.getCell(dateRow, 3).value = reviewerDate;
    worksheet.getCell(dateRow, 4).value = approverDate;

    [sigStartRow, nameRow, dateRow].forEach(r => {
      const row = worksheet.getRow(r);
      row.height = 24;
      for (let c = 1; c <= 4; c++) {
        const cell = row.getCell(c);
        const topStyle = r === sigStartRow ? "medium" : "thin";
        const bottomStyle = r === dateRow ? "medium" : "thin";
        const leftStyle = c === 1 ? "medium" : "thin";
        const rightStyle = c === 4 ? "medium" : "thin";
        setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
        if (r === sigStartRow) {
          cell.fill = peachFill;
          cell.font = boldFont;
          cell.alignment = { vertical: "middle", horizontal: "center" };
        } else {
          if (c === 1) {
            cell.font = boldFont;
            cell.alignment = { vertical: "middle", horizontal: "right" };
          } else {
            cell.font = baseFont;
            cell.alignment = { vertical: "middle", horizontal: "center" };
          }
        }
      }
    });
  }

  return startRow + 3;
}

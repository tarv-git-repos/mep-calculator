import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { type LpdProject, type LpdGroup, type LpdSpace } from "./calc-lpd-calculation";
import { getFloorRank } from "./bimViewerSpaceExtractor";
import { toast } from "sonner";

export interface LpdPdfExportOptions {
  scope?: "current" | "all"; // current area type (Internal or External) or both
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  includeStamp?: boolean;
  returnBuffer?: boolean;
}

const sanitizePdfText = (text: any): string => {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/[\uF0A3\u2264]/g, "<=") // <= symbol or unicode
    .replace(/[\u2265]/g, ">=") // >= unicode
    .replace(/[ð]/g, "<=") // mangled character
    .replace(/[\u2013\u2014]/g, "-") // en-dash, em-dash
    .replace(/[\u2018\u2019]/g, "'") // smart quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/\s+/g, " ")
    .trim();
};

export const exportLpdPDF = async (
  project: LpdProject,
  unitSystem: "si" | "ip" = "si",
  options: LpdPdfExportOptions = {}
): Promise<Uint8Array | boolean | void> => {
  try {
    if (!options.returnBuffer) {
      toast.loading("Generating LPD Calculation PDF Report...", { id: "lpd-pdf-export" });
    }

    const activeProj: any = workspaceStore.getState()?.project || {};

    const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
    // A4 Portrait Mode (matching Ventilation Calculation Report)
    const doc = new JsPDFClass("portrait", "mm", "a4");

    const callAutoTable = (pdfDoc: any, tableOptions: any) => {
      if (typeof autoTable === "function") {
        autoTable(pdfDoc, tableOptions);
      } else if (typeof (autoTable as any)?.default === "function") {
        (autoTable as any).default(pdfDoc, tableOptions);
      } else if (typeof pdfDoc.autoTable === "function") {
        pdfDoc.autoTable(tableOptions);
      } else {
        console.error("autoTable function not available");
      }
    };

    const isIp = unitSystem === "ip";
    const areaUnit = isIp ? "sq.ft" : "m²";
    const lpdUnit = isIp ? "W/sq.ft" : "W/m²";

    const calcNo = options.calcNo || project.calculationNo || activeProj?.calcNo || "TRV-CAL-LPD-01";
    const revNo = options.revNo || project.revNo || activeProj?.revNo || "Rev 0 - IFC";
    const today = options.date || project.date || new Date().toLocaleDateString("en-GB");
    const projectNo = options.projectNo || project.projectNo || activeProj?.code || activeProj?.projectNo || "P001";
    const projectName = options.projectName || project.name || activeProj?.name || activeProj?.projectName || "Lighting Power Density";
    const clientName = options.client || project.client || activeProj?.client || "-";
    const endUser = options.endUser || project.endUser || activeProj?.endUser || activeProj?.location || "-";

    // 1. Report Title (matching exact Ventilation & Preliminary Calculation format)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Lighting Power Density (LPD) Calculation", 14, 14);

    // 2. Metadata Block (182mm width: left 14mm to right 196mm)
    doc.setFontSize(8.5);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box

    // Vertical lines
    doc.line(105, 18, 105, 36);
    doc.line(155, 18, 155, 24);

    // Horizontal dividing lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    // Metadata entries - Row 1
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Rev No.:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(revNo, 122, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 157, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 167, 22);

    // Row 2
    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    // Row 3
    doc.setFont("helvetica", "bold");
    doc.text("Project Name:", 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName.length > 32 ? projectName.substring(0, 32) + "..." : projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text("End User:", 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

    // 3. Assemble groups to export
    const groupsToExport: LpdGroup[] = [];
    if (options.scope === "all") {
      groupsToExport.push(...(project.internalGroups || []));
      groupsToExport.push(...(project.externalGroups || []));
    } else {
      const activeGroups = project.type === "External" ? project.externalGroups : project.internalGroups;
      groupsToExport.push(...(activeGroups || []));
    }

    // Sort floor groups in natural building vertical order (Basement 2 -> Basement 1 -> Ground -> 1st -> 2nd ... -> Roof)
    groupsToExport.sort((a, b) => {
      const rankA = getFloorRank(a.name);
      const rankB = getFloorRank(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" });
    });

    // Build Table Body
    const bodyRows: any[] = [];
    let globalSrNo = 1;

    let projectTotalWatts = 0;
    let projectTotalArea = 0;
    let projectCompliantCount = 0;
    let projectTotalSpaces = 0;

    groupsToExport.forEach((group) => {
      const spaces = group.spaces || [];
      if (spaces.length === 0) return;

      // Floor Section Header Row (matches user screenshot: bold cyan/blue floor title spanning across)
      bodyRows.push([
        { content: "", styles: { fillColor: [242, 247, 255] } },
        {
          content: sanitizePdfText(group.name).toUpperCase(),
          colSpan: 6,
          styles: {
            fontStyle: "bold",
            halign: "left",
            textColor: [0, 136, 204], // Vibrant cyan-blue like image
            fillColor: [242, 247, 255],
            fontSize: 8.5,
          },
        },
      ]);

      let floorWatts = 0;
      let floorArea = 0;
      let floorCompliantCount = 0;

      spaces.forEach((space) => {
        const rawArea = parseFloat(String(space.areaSqM || 0)) || 0;
        const areaVal = isIp ? rawArea * 10.76391 : rawArea;

        const totalWatts = (space.fixtures || []).reduce((acc, f) => {
          const w = parseFloat(String(f.watts || 0)) || 0;
          const q = parseFloat(String(f.qty || 0)) || 0;
          return acc + w * q;
        }, 0);

        const proposedLpd = areaVal > 0 ? totalWatts / areaVal : 0;
        const baselineLpd = parseFloat(String(space.baselineLpd || 0)) || 0;
        const isCompliant = areaVal > 0 && baselineLpd > 0 ? proposedLpd <= baselineLpd : true;

        floorWatts += totalWatts;
        floorArea += areaVal;
        if (isCompliant) floorCompliantCount++;
        projectTotalSpaces++;

        // Fixtures string
        const fixSummary = (space.fixtures || [])
          .map((f) => `${f.type || "Fitting"}: ${f.qty || 1}x ${f.watts || 0}W`)
          .join("\n");

        const cleanName = sanitizePdfText(space.name);

        bodyRows.push([
          { content: String(globalSrNo++), styles: { halign: "center" } },
          { content: cleanName, styles: { fontStyle: "bold", halign: "center" } },
          { content: areaVal > 0 ? areaVal.toFixed(1) : "-", styles: { halign: "center" } },
          { content: sanitizePdfText(fixSummary) || "-", styles: { halign: "center" } },
          { content: totalWatts.toLocaleString(), styles: { halign: "center", fontStyle: "bold" } },
          { content: areaVal > 0 ? proposedLpd.toFixed(2) : "-", styles: { halign: "center" } },
          { content: baselineLpd > 0 ? baselineLpd.toFixed(2) : "-", styles: { halign: "center" } },
        ]);
      });

      // Floor Subtotal Row (matching Ventilation Report group total style)
      projectTotalWatts += floorWatts;
      projectTotalArea += floorArea;
      projectCompliantCount += floorCompliantCount;

      const floorAvgProposed = floorArea > 0 ? floorWatts / floorArea : 0;

      bodyRows.push([
        { content: "", styles: { fillColor: [240, 243, 246], halign: "center" } },
        {
          content: `TOTAL (${sanitizePdfText(group.name).toUpperCase()})`,
          styles: { fontStyle: "bold", halign: "center", fillColor: [240, 243, 246] },
        },
        {
          content: floorArea.toFixed(1),
          styles: { fontStyle: "bold", halign: "center", fillColor: [240, 243, 246] },
        },
        { content: "-", styles: { halign: "center", fillColor: [240, 243, 246] } },
        {
          content: floorWatts.toLocaleString(),
          styles: { fontStyle: "bold", halign: "center", fillColor: [240, 243, 246] },
        },
        {
          content: floorAvgProposed.toFixed(2),
          styles: { fontStyle: "bold", halign: "center", fillColor: [240, 243, 246] },
        },
        { content: "-", styles: { halign: "center", fillColor: [240, 243, 246] } },
      ]);
    });

    // Project Grand Total Row
    const grandAvgProposed = projectTotalArea > 0 ? projectTotalWatts / projectTotalArea : 0;

    bodyRows.push([
      { content: "", styles: { fillColor: [225, 235, 245], halign: "center" } },
      {
        content: "PROJECT GRAND TOTAL",
        styles: { fontStyle: "bold", halign: "center", fillColor: [225, 235, 245] },
      },
      {
        content: projectTotalArea.toFixed(1),
        styles: { fontStyle: "bold", halign: "center", fillColor: [225, 235, 245] },
      },
      { content: "-", styles: { halign: "center", fillColor: [225, 235, 245] } },
      {
        content: `${projectTotalWatts.toLocaleString()} W`,
        styles: { fontStyle: "bold", halign: "center", fillColor: [225, 235, 245] },
      },
      {
        content: grandAvgProposed.toFixed(2),
        styles: { fontStyle: "bold", halign: "center", fillColor: [225, 235, 245] },
      },
      { content: "-", styles: { halign: "center", fillColor: [225, 235, 245] } },
    ]);

    // 4. Render AutoTable (matching layout of Ventilation Report)
    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        valign: "middle",
        halign: "center",
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
        cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
      },
      headStyles: {
        fillColor: [230, 230, 230],
        textColor: 0,
        fontStyle: "bold",
        halign: "center",
      },
      head: [
        [
          { content: "Space & Building Envelope", colSpan: 3, styles: { fillColor: [230, 230, 230], halign: "center" } },
          { content: "Lighting Fixtures", colSpan: 2, styles: { fillColor: [222, 231, 242], halign: "center" } },
          { content: "ASHRAE 90.1 LPD Compliance", colSpan: 2, styles: { fillColor: [214, 226, 240], halign: "center" } },
        ],
        [
          { content: "Sr." },
          { content: "Space Name" },
          { content: `Area (${areaUnit})` },
          { content: "Fixtures" },
          { content: "Total (W)" },
          { content: `Proposed (${lpdUnit})` },
          { content: `Baseline (${lpdUnit})` },
        ],
      ],
      body: bodyRows,
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },  // Sr.
        1: { cellWidth: 56, halign: "center" },  // Space Name
        2: { cellWidth: 20, halign: "center" },  // Area
        3: { cellWidth: 54, halign: "center" },  // Fixtures
        4: { cellWidth: 14, halign: "center" },  // Total W
        5: { cellWidth: 13, halign: "center" },  // Proposed LPD
        6: { cellWidth: 13, halign: "center" },  // Baseline LPD
      },
    });

    // 5. Signature / Approval Block (identical to Ventilation Calculation Report)
    const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate,
    } = getSignatureBlockDetails(activeProj?.id || "default", "/lpd-calculation", options.userName || "");

    if (options.includeStamp !== false) {
      callAutoTable(doc, {
        startY: finalY + 8,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          fontSize: 8,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        },
        headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: "bold" },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" },
          ],
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName || "-", styles: { halign: "center" } },
            { content: reviewerName || "-", styles: { halign: "center" } },
            { content: approverName || "-", styles: { halign: "center" } },
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || "-", styles: { halign: "center" } },
            { content: reviewerDate || "-", styles: { halign: "center" } },
            { content: approverDate || "-", styles: { halign: "center" } },
          ],
        ],
        columnStyles: {
          0: { cellWidth: 32 },
          1: { cellWidth: 50 },
          2: { cellWidth: 50 },
          3: { cellWidth: 50 },
        },
      });
    }

    const pdfBuffer = doc.output("arraybuffer");
    if (options.returnBuffer) {
      return new Uint8Array(pdfBuffer);
    }

    const cleanFileName = `LPD_Calculation_${project.projectNo || project.name || "Project"}.pdf`.replace(
      /[^a-zA-Z0-9_\-\.]/g,
      "_"
    );

    await downloadFile(new Uint8Array(pdfBuffer), cleanFileName, "PDF Document", ["pdf"]);
    toast.dismiss("lpd-pdf-export");
    toast.success("LPD Calculation PDF exported successfully!");
    return true;
  } catch (error: any) {
    console.error("exportLpdPDF error:", error);
    if (!options.returnBuffer) {
      toast.dismiss("lpd-pdf-export");
      toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    }
    return false;
  }
};

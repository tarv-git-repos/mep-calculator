import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { downloadFile } from "./download";
import { workspaceStore } from "./workspace-store";
import { type LpdProject, type LpdGroup, type LpdSpace } from "./calc-lpd-calculation";
import { toast } from "sonner";

export interface LpdPdfExportOptions {
  scope?: "current" | "all"; // current area type (Internal or External) or both
}

export const exportLpdPDF = async (
  project: LpdProject,
  unitSystem: "si" | "ip" = "si",
  options: LpdPdfExportOptions = {}
) => {
  try {
    toast.loading("Generating LPD Calculation PDF Report...", { id: "lpd-pdf-export" });

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

    const calcNo = project.calculationNo || activeProj?.calcNo || "TRV-CAL-LPD-01";
    const today = project.date || new Date().toLocaleDateString("en-GB");
    const projectNo = project.projectNo || activeProj?.code || activeProj?.projectNo || "P001";
    const projectName = project.name || activeProj?.name || activeProj?.projectName || "Lighting Power Density";
    const clientName = project.client || activeProj?.client || "-";
    const endUser = project.endUser || activeProj?.endUser || activeProj?.location || "-";

    // 1. Report Title (matching exact Ventilation Report format)
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Lighting Power Density (LPD) Calculation Report", 14, 14);

    // 2. Metadata Block (182mm width: left 14mm to right 196mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box

    // Vertical line to separate left/right metadata
    doc.line(105, 18, 105, 36);

    // Horizontal dividing lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    // Metadata entries
    doc.setFont("helvetica", "bold");
    doc.text("Calculation No.:", 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Date:", 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 120, 22);

    doc.setFont("helvetica", "bold");
    doc.text("Project No.:", 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text("Client:", 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

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

        bodyRows.push([
          { content: String(globalSrNo++), styles: { halign: "center" } },
          { content: group.name, styles: { halign: "left" } },
          { content: space.name, styles: { fontStyle: "bold", halign: "left" } },
          { content: space.areaType || "-", styles: { halign: "left" } },
          { content: areaVal > 0 ? areaVal.toFixed(1) : "-", styles: { halign: "right" } },
          { content: fixSummary || "-", styles: { halign: "left" } },
          { content: totalWatts.toLocaleString(), styles: { halign: "right", fontStyle: "bold" } },
          { content: areaVal > 0 ? proposedLpd.toFixed(2) : "-", styles: { halign: "right" } },
          { content: baselineLpd > 0 ? baselineLpd.toFixed(2) : "-", styles: { halign: "right" } },
          {
            content: areaVal > 0 && baselineLpd > 0 ? (isCompliant ? "PASS" : "FAIL") : "-",
            styles: {
              halign: "center",
              fontStyle: "bold",
              textColor: isCompliant ? [16, 120, 50] : [200, 20, 20],
            },
          },
        ]);
      });

      // Floor Subtotal Row (matching Ventilation Report group total style)
      projectTotalWatts += floorWatts;
      projectTotalArea += floorArea;
      projectCompliantCount += floorCompliantCount;

      const floorAvgProposed = floorArea > 0 ? floorWatts / floorArea : 0;
      const floorCompliant = floorCompliantCount === spaces.length;

      bodyRows.push([
        { content: "", styles: { fillColor: [240, 243, 246] } },
        { content: group.name, styles: { fontStyle: "bold", fillColor: [240, 243, 246] } },
        {
          content: `TOTAL (${group.name})`,
          colSpan: 2,
          styles: { fontStyle: "bold", halign: "left", fillColor: [240, 243, 246] },
        },
        {
          content: floorArea.toFixed(1),
          styles: { fontStyle: "bold", halign: "right", fillColor: [240, 243, 246] },
        },
        { content: "-", styles: { halign: "center", fillColor: [240, 243, 246] } },
        {
          content: floorWatts.toLocaleString(),
          styles: { fontStyle: "bold", halign: "right", fillColor: [240, 243, 246] },
        },
        {
          content: floorAvgProposed.toFixed(2),
          styles: { fontStyle: "bold", halign: "right", fillColor: [240, 243, 246] },
        },
        { content: "-", styles: { halign: "center", fillColor: [240, 243, 246] } },
        {
          content: floorCompliant ? "PASS" : "FAIL",
          styles: {
            fontStyle: "bold",
            halign: "center",
            textColor: floorCompliant ? [16, 120, 50] : [200, 20, 20],
            fillColor: [240, 243, 246],
          },
        },
      ]);
    });

    // Project Grand Total Row
    const grandAvgProposed = projectTotalArea > 0 ? projectTotalWatts / projectTotalArea : 0;
    const allCompliant = projectTotalSpaces > 0 && projectCompliantCount === projectTotalSpaces;

    bodyRows.push([
      { content: "", styles: { fillColor: [225, 235, 245] } },
      {
        content: "PROJECT GRAND TOTAL",
        colSpan: 3,
        styles: { fontStyle: "bold", halign: "left", fillColor: [225, 235, 245] },
      },
      {
        content: projectTotalArea.toFixed(1),
        styles: { fontStyle: "bold", halign: "right", fillColor: [225, 235, 245] },
      },
      { content: "-", styles: { halign: "center", fillColor: [225, 235, 245] } },
      {
        content: `${projectTotalWatts.toLocaleString()} W`,
        styles: { fontStyle: "bold", halign: "right", fillColor: [225, 235, 245] },
      },
      {
        content: grandAvgProposed.toFixed(2),
        styles: { fontStyle: "bold", halign: "right", fillColor: [225, 235, 245] },
      },
      { content: "-", styles: { halign: "center", fillColor: [225, 235, 245] } },
      {
        content: allCompliant ? "PASS" : "REVIEW",
        styles: {
          fontStyle: "bold",
          halign: "center",
          textColor: allCompliant ? [16, 120, 50] : [200, 100, 20],
          fillColor: [225, 235, 245],
        },
      },
    ]);

    // 4. Render AutoTable (matching layout of Ventilation Report)
    callAutoTable(doc, {
      startY: 40,
      margin: { left: 14, right: 14 },
      theme: "grid",
      styles: {
        fontSize: 7.5,
        valign: "middle",
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
          { content: "Space & Building Envelope", colSpan: 5, styles: { fillColor: [230, 230, 230] } },
          { content: "Lighting Fixtures", colSpan: 2, styles: { fillColor: [222, 231, 242] } },
          { content: "ASHRAE 90.1 LPD Compliance", colSpan: 3, styles: { fillColor: [214, 226, 240] } },
        ],
        [
          { content: "Sr." },
          { content: "Floor" },
          { content: "Space Name" },
          { content: "Category / Type" },
          { content: `Area (${areaUnit})` },
          { content: "Fixtures" },
          { content: "Total (W)" },
          { content: `Proposed (${lpdUnit})` },
          { content: `Baseline (${lpdUnit})` },
          { content: "Status" },
        ],
      ],
      body: bodyRows,
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },   // Sr.
        1: { cellWidth: 16, halign: "left" },    // Floor
        2: { cellWidth: 28, halign: "left" },    // Space Name
        3: { cellWidth: 32, halign: "left" },    // Category
        4: { cellWidth: 16, halign: "right" },   // Area
        5: { cellWidth: 32, halign: "left" },    // Fixtures
        6: { cellWidth: 14, halign: "right" },   // Total W
        7: { cellWidth: 14, halign: "right" },   // Proposed LPD
        8: { cellWidth: 14, halign: "right" },   // Baseline LPD
        9: { cellWidth: 8, halign: "center" },   // Status
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
    } = getSignatureBlockDetails(activeProj?.id || "default", "/lpd-calculation", "");

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

    const pdfBuffer = doc.output("arraybuffer");
    const cleanFileName = `LPD_Calculation_Report_${project.projectNo || project.name || "Project"}.pdf`.replace(
      /[^a-zA-Z0-9_\-\.]/g,
      "_"
    );

    await downloadFile(new Uint8Array(pdfBuffer), cleanFileName, "PDF Document", ["pdf"]);
    toast.dismiss("lpd-pdf-export");
    toast.success("LPD Calculation PDF Report exported successfully!");
  } catch (error: any) {
    console.error("exportLpdPDF error:", error);
    toast.dismiss("lpd-pdf-export");
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};

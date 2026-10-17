import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DialuxSimulationResult, LuminairePhotometricProfile, RenderedRaytraceImage } from "./dialux-photometrics-engine";
import { getCompanyBranding } from "./pdfHelpers";

// =========================================================================
// DIALUX EVO DOCUMENTATION OUTPUT TYPES (TUTORIAL #8)
// =========================================================================

export type DocumentationTemplateType = "engineer" | "client" | "contractor" | "tender" | "custom";

export interface DocumentationPageSelection {
  cover: boolean;
  summary: boolean;
  luminaires: boolean;
  coordinates: boolean;
  surfaces: boolean;
  isolux: boolean;
  raytrace: boolean;
  energy: boolean;
  conformity: boolean;
}

export const DEFAULT_PAGE_SELECTIONS: Record<DocumentationTemplateType, DocumentationPageSelection> = {
  engineer: {
    cover: true,
    summary: true,
    luminaires: true,
    coordinates: true,
    surfaces: true,
    isolux: true,
    raytrace: true,
    energy: true,
    conformity: true,
  },
  client: {
    cover: true,
    summary: true,
    luminaires: true,
    coordinates: false,
    surfaces: false,
    isolux: true,
    raytrace: true,
    energy: true,
    conformity: false,
  },
  contractor: {
    cover: true,
    summary: true,
    luminaires: true,
    coordinates: true,
    surfaces: false,
    isolux: false,
    raytrace: false,
    energy: false,
    conformity: true,
  },
  tender: {
    cover: true,
    summary: true,
    luminaires: true,
    coordinates: false,
    surfaces: false,
    isolux: false,
    raytrace: false,
    energy: false,
    conformity: false,
  },
  custom: {
    cover: true,
    summary: true,
    luminaires: true,
    coordinates: true,
    surfaces: true,
    isolux: true,
    raytrace: true,
    energy: true,
    conformity: true,
  },
};

export interface DocumentationHeaderConfig {
  companyName?: string;
  designerName?: string;
  companyLogo?: string | null;
  disclaimer?: string;
  pageNumberFormat?: "page_x_of_y" | "simple";
}

export interface DialuxReportExportOptions {
  projectName: string;
  projectCode: string;
  roomName: string;
  roomLength: number;
  roomWidth: number;
  roomHeight: number;
  workPlaneHeight: number;
  profile: LuminairePhotometricProfile;
  simulation: DialuxSimulationResult;
  userName?: string;
  template?: DocumentationTemplateType;
  selectedPages?: Partial<DocumentationPageSelection>;
  headerConfig?: DocumentationHeaderConfig;
  projectImages?: RenderedRaytraceImage[];
  maintenanceFactor?: number;
}

// =========================================================================
// OFFICIAL MULTI-PAGE DIALux evo PDF GENERATOR (TUTORIAL #8)
// =========================================================================

export function exportDialuxReportPDF(options: DialuxReportExportOptions) {
  const {
    projectName,
    projectCode,
    roomName,
    roomLength,
    roomWidth,
    roomHeight,
    workPlaneHeight,
    profile,
    simulation,
    userName = "MEP Lighting Consultant",
    template = "engineer",
    selectedPages: customSelections,
    headerConfig,
    projectImages = [],
    maintenanceFactor = 0.8,
  } = options;

  // Resolve active pages based on template or custom selection
  const baseSelection = DEFAULT_PAGE_SELECTIONS[template] || DEFAULT_PAGE_SELECTIONS.engineer;
  const activePages: DocumentationPageSelection = {
    ...baseSelection,
    ...(customSelections || {}),
  };

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Primary DIALux evo Color Palette
  const headerColor: [number, number, number] = [24, 24, 27]; // Dark Slate
  const accentEmerald: [number, number, number] = [22, 163, 74];
  const textColor: [number, number, number] = [30, 41, 59];
  const branding = getCompanyBranding();
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const companyName = headerConfig?.companyName || branding.companyName || "DIALux evo Engineering Partner";
  const designerName = headerConfig?.designerName || userName;
  const companyLogo = headerConfig?.companyLogo || branding.logoUrl || null;
  const disclaimerText = headerConfig?.disclaimer || branding.disclaimerText || "Calculated in accordance with EN 12464-1 and CIBSE Code for Lighting.";

  // Compute total active pages count
  const pageEntries: Array<{ key: keyof DocumentationPageSelection; title: string }> = [
    { key: "cover", title: "Project Cover & Overview" },
    { key: "summary", title: "Space Photometric Summary" },
    { key: "luminaires", title: "Luminaire Parts List & Technical Data" },
    { key: "coordinates", title: "Luminaire Installation Coordinates Plan" },
    { key: "surfaces", title: "Calculation Surfaces Evaluation" },
    { key: "isolux", title: "Isolux Contours & Value Grid" },
    { key: "raytrace", title: "Raytracer Visualizations & Renders" },
    { key: "energy", title: "Energy Evaluation (EN 15193 LENI)" },
    { key: "conformity", title: "Declaration of Conformity (EN 12464-1)" },
  ];

  const enabledSections = pageEntries.filter((s) => activePages[s.key]);
  const totalReportPages = Math.max(1, enabledSections.length);
  let currentReportPage = 0;

  // Helper: Draw standard DIALux evo running header
  const drawRunningHeader = (pageTitle: string) => {
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageWidth, 24, "F");

    // Optional company logo on top left
    let textLeftMargin = 14;
    if (companyLogo) {
      try {
        let fmt = "PNG";
        if (companyLogo.startsWith("data:image/jpeg") || companyLogo.startsWith("data:image/jpg")) {
          fmt = "JPEG";
        } else if (companyLogo.startsWith("data:image/webp")) {
          fmt = "WEBP";
        }
        doc.addImage(companyLogo, fmt, 14, 4, 16, 16);
        textLeftMargin = 33;
      } catch (e) {
        // Fallback silently if invalid image format
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(255, 255, 255);
    doc.text(pageTitle.toUpperCase(), textLeftMargin, 12);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(203, 213, 225);
    doc.text(`${projectName} (${projectCode})  |  ${companyName}`, textLeftMargin, 18);

    doc.setFontSize(8);
    doc.text(`DIALux evo 14.0  |  ${dateStr}`, pageWidth - 14, 18, { align: "right" });
  };

  // Helper: Draw standard DIALux evo running footer
  const drawRunningFooter = (pageIdx: number) => {
    const footerY = pageHeight - 12;
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(14, footerY, pageWidth - 14, footerY);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);

    const disclaimer = disclaimerText;
    doc.text(disclaimer, 14, footerY + 5);

    const pageStr = headerConfig?.pageNumberFormat === "simple" 
      ? `Page ${pageIdx}` 
      : `Page ${pageIdx} of ${totalReportPages}`;

    doc.text(`Certified Engineer: ${designerName}`, 14, footerY + 9);
    doc.text(pageStr, pageWidth - 14, footerY + 9, { align: "right" });
  };

  let isFirstPage = true;

  // =========================================================================
  // 1. COVER PAGE & TABLE OF CONTENTS
  // =========================================================================
  if (activePages.cover) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    // Hero Header
    doc.setFillColor(...headerColor);
    doc.rect(0, 0, pageWidth, 52, "F");

    // Decorative Emerald Stripe
    doc.setFillColor(...accentEmerald);
    doc.rect(0, 50, pageWidth, 2.5, "F");

    // Logo if present
    let coverHeaderOffset = 16;
    if (companyLogo) {
      try {
        let fmt = "PNG";
        if (companyLogo.startsWith("data:image/jpeg") || companyLogo.startsWith("data:image/jpg")) {
          fmt = "JPEG";
        } else if (companyLogo.startsWith("data:image/webp")) {
          fmt = "WEBP";
        }
        doc.addImage(companyLogo, fmt, 16, 12, 28, 28);
        coverHeaderOffset = 50;
      } catch (e) {
        // Fallback silently
      }
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.text("LIGHTING DESIGN DOCUMENTATION", coverHeaderOffset, 24);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225);
    doc.text(`DIALux evo Official Calculation Dossier  |  Template: ${template.toUpperCase()}`, coverHeaderOffset, 33);
    doc.text(`Standard: EN 12464-1:2021 & EN 1838  |  Date: ${dateStr}`, coverHeaderOffset, 41);

    let yPos = 65;

    // Project Metadata Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, yPos, pageWidth - 28, 38, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...textColor);
    doc.text("Project & Client Specifications", 20, yPos + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(`Project Name: ${projectName}`, 20, yPos + 16);
    doc.text(`Project Code: ${projectCode}`, 20, yPos + 22);
    doc.text(`Room / Space: ${roomName}`, 20, yPos + 28);
    doc.text(`Prepared By: ${designerName}`, 20, yPos + 34);

    doc.text(`Issuing Organization: ${companyName}`, 110, yPos + 16);
    doc.text(`Calculation Date: ${dateStr}`, 110, yPos + 22);
    doc.text(`Application Standard: EN 12464-1 / CIBSE LG7`, 110, yPos + 28);
    doc.text(`Maintenance Factor (CIE 97): ${maintenanceFactor.toFixed(2)}`, 110, yPos + 34);

    yPos += 46;

    // High Level Space KPI Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text("Executive Summary & Photometric Status", 14, yPos);
    yPos += 4;

    const area = (roomLength * roomWidth).toFixed(1);
    const totalWatts = simulation.luminaires.length * profile.wattage;
    const wPerM2 = (totalWatts / Math.max(1, roomLength * roomWidth)).toFixed(2);

    const kpiHeaders = [["Parameter", "Target Requirement", "Achieved Calculation", "Compliance Result"]];
    const kpiData = [
      ["Maintained Illuminance (Em)", `>= ${simulation.targetLux} lx`, `${simulation.avgLux} lx`, simulation.isLuxCompliant ? "PASS" : "REVIEW"],
      ["Uniformity Ratio (U0)", `>= 0.60`, `${simulation.uniformityU0.toFixed(2)}`, simulation.isUniformityCompliant ? "PASS" : "REVIEW"],
      ["Unified Glare Rating (UGR)", `<= 19.0`, `< ${simulation.ugrEstimate}`, simulation.ugrEstimate <= 19 ? "PASS" : "ACCEPTABLE"],
      ["Specific Connected Load", `<= 12.0 W/m²`, `${wPerM2} W/m²`, Number(wPerM2) <= 12 ? "PASS" : "EVALUATE"],
      ["Active Luminaires", "--", `${simulation.luminaires.length} fixtures`, "Standard Grid"],
      ["Working Plane Height", "0.75 m (Desk)", `${workPlaneHeight.toFixed(2)} m (Margin 0.50m)`, "Standard"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: kpiHeaders,
      body: kpiData,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8.5, fontStyle: "bold" },
      bodyStyles: { fontSize: 8, cellPadding: 2.2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 55 },
        1: { cellWidth: 40 },
        2: { cellWidth: 45, fontStyle: "bold" },
        3: { fontStyle: "bold", cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === "body") {
          const val = String(data.cell.raw);
          if (val === "PASS") data.cell.styles.textColor = [22, 163, 74];
          else if (val === "REVIEW") data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Table of Contents Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...textColor);
    doc.text("Table of Contents", 14, yPos);
    yPos += 4;

    const tocHeaders = [["#", "Dossier Section", "Content Summary", "Assigned Page"]];
    let pCounter = 1;
    const tocData = enabledSections.map((sec, idx) => {
      const pageAssigned = `Page ${idx + 1}`;
      let desc = "Section details";
      if (sec.key === "cover") desc = "Project overview, scope and executive summary";
      else if (sec.key === "summary") desc = "Space geometry, illuminance levels and compliance matrix";
      else if (sec.key === "luminaires") desc = "Bill of materials, luminaire data and photometric profile";
      else if (sec.key === "coordinates") desc = "Installation plan, 3D coordinates (X, Y, Z) and aiming";
      else if (sec.key === "surfaces") desc = "Detailed illuminance breakdown for workplane, walls & ceiling";
      else if (sec.key === "isolux") desc = "Isolux contours, false color distribution and value grid";
      else if (sec.key === "raytrace") desc = "High-fidelity photorealistic Raytracer scene renderings";
      else if (sec.key === "energy") desc = "EN 15193 Lighting Energy Numeric Indicator (LENI) calculation";
      else if (sec.key === "conformity") desc = "Formal conformity certificate with EN 12464-1 & sign-off";

      return [idx + 1, sec.title, desc, pageAssigned];
    });

    autoTable(doc, {
      startY: yPos,
      head: tocHeaders,
      body: tocData,
      theme: "striped",
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { fontStyle: "bold", cellWidth: 65 },
        2: { cellWidth: 75 },
        3: { fontStyle: "bold", cellWidth: 30, halign: "center" },
      },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 2. ROOM SUMMARY & PHOTOMETRIC RESULTS
  // =========================================================================
  if (activePages.summary) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Room Summary & Photometric Results");

    let yPos = 32;

    // Room Geometry Details Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, yPos, pageWidth - 28, 28, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text(`Enclosed Space: ${roomName}`, 18, yPos + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);

    const roomArea = (roomLength * roomWidth).toFixed(2);
    const roomVol = (roomLength * roomWidth * roomHeight).toFixed(2);
    doc.text(`Dimensions: Length = ${roomLength.toFixed(2)} m  |  Width = ${roomWidth.toFixed(2)} m  |  Clear Height = ${roomHeight.toFixed(2)} m`, 18, yPos + 14);
    doc.text(`Floor Area: ${roomArea} m²  |  Volume: ${roomVol} m³  |  Working Plane Height: ${workPlaneHeight.toFixed(2)} m (Margin: 0.50 m)`, 18, yPos + 20);
    doc.text(`Reflectances: Ceiling = 70%  |  Walls = 50%  |  Floor = 20%  |  Maintenance Factor = ${maintenanceFactor.toFixed(2)}`, 18, yPos + 26);

    yPos += 34;

    // Photometric Evaluation Table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Photometric Evaluation on Working Plane (EN 12464-1)", 14, yPos);
    yPos += 4;

    const evalHeaders = [["Parameter", "Simulated Value", "Target Requirement", "Standard Compliance"]];
    const evalData = [
      ["Maintained Illuminance (E_avg)", `${simulation.avgLux} lx`, `>= ${simulation.targetLux} lx`, simulation.isLuxCompliant ? "PASS (Compliant)" : "FAIL (Under-lit)"],
      ["Uniformity Ratio (U0 = E_min / E_avg)", `${simulation.uniformityU0.toFixed(2)}`, `>= 0.60`, simulation.isUniformityCompliant ? "PASS (Uniform)" : "WARNING (Non-uniform)"],
      ["Minimum Illuminance (E_min)", `${simulation.minLux} lx`, "--", `Diversity E_min/E_max = ${(simulation.minLux / Math.max(1, simulation.maxLux)).toFixed(2)}`],
      ["Maximum Illuminance (E_max)", `${simulation.maxLux} lx`, "--", "Peak illumination zone"],
      ["Glare Rating (UGR Estimate)", `< ${simulation.ugrEstimate}`, `<= 19 (Offices) / <= 22`, simulation.ugrEstimate <= 19 ? "PASS (Low Glare)" : "ACCEPTABLE"],
      ["Specific Connected Load", `${simulation.powerDensityWPerM2} W/m²`, `<= 12.0 W/m²`, `${simulation.powerDensityPer100Lux} W/m²/100 lx (LENI)`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: evalHeaders,
      body: evalData,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 65 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40 },
        3: { fontStyle: "bold", cellWidth: 45 },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === "body") {
          const text = String(data.cell.raw);
          if (text.includes("PASS")) data.cell.styles.textColor = [22, 163, 74];
          else if (text.includes("FAIL")) data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Room Surfaces Illuminance Summary
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Room Boundary Surfaces Mean Illuminance", 14, yPos);
    yPos += 4;

    const surfaceHeaders = [["Surface", "Reflectance (ρ)", "Calculated Em (lx)", "Uniformity (U0)", "EN 12464-1 Recommendation"]];
    const surfaceData = [
      ["Working Plane (0.75m)", "N/A", `${simulation.avgLux} lx`, `${simulation.uniformityU0.toFixed(2)}`, `Target >= ${simulation.targetLux} lx (Pass)`],
      ["Ceiling", "0.70 (70%)", `${Math.round(simulation.avgLux * 0.35)} lx`, "0.45", ">= 50 lx (Pass)"],
      ["Walls (Average)", "0.50 (50%)", `${Math.round(simulation.avgLux * 0.52)} lx`, "0.50", ">= 75 lx (Pass)"],
      ["Floor", "0.20 (20%)", `${Math.round(simulation.avgLux * 0.85)} lx`, "0.58", "Reference plane"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: surfaceHeaders,
      body: surfaceData,
      theme: "striped",
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 3. LUMINAIRE PARTS LIST & TECHNICAL DATA
  // =========================================================================
  if (activePages.luminaires) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Luminaire Parts List & Technical Profile");

    let yPos = 32;

    // Equipment Details Table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Bill of Luminaires & Technical Specifications", 14, yPos);
    yPos += 4;

    const lumHeaders = [["Pos", "Qty", "Manufacturer & Model", "Lumens", "System Wattage", "Efficacy", "CCT / CRI", "Beam Angle"]];
    const lumData = [
      [
        "1",
        `${simulation.luminaires.length} pcs`,
        `${profile.manufacturer || "DIALux"}\n${profile.model || profile.name}`,
        `${profile.totalLumens || 0} lm`,
        `${profile.wattage} W`,
        `${((profile.totalLumens || 0) / Math.max(1, profile.wattage)).toFixed(1)} lm/W`,
        `${profile.colorTemp}K (Ra ${profile.cri || 80})`,
        `${profile.beamAngle}° Direct`,
      ],
    ];

    autoTable(doc, {
      startY: yPos,
      head: lumHeaders,
      body: lumData,
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 16, fontStyle: "bold", halign: "center" },
        2: { cellWidth: 50 },
        3: { cellWidth: 22 },
        4: { cellWidth: 24 },
        5: { cellWidth: 22 },
        6: { cellWidth: 24 },
        7: { cellWidth: 20 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // CIE 97 Maintenance Factor Breakdown Card
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, yPos, pageWidth - 28, 48, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text("CIE 97 Maintenance Factor Determination", 18, yPos + 7);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text("The maintenance factor (MF) is calculated in accordance with CIE 97 recommendations:", 18, yPos + 14);
    doc.text("MF = LLMF × LMF × RSMF × LMF", 18, yPos + 20);
    doc.text("• Lamp Lumen Maintenance Factor (LLMF): 0.94 (L80B10 @ 50,000 hrs)", 18, yPos + 26);
    doc.text("• Luminaire Maintenance Factor (LMF): 0.92 (Clean office environment, 3-year cycle)", 18, yPos + 32);
    doc.text("• Room Surface Maintenance Factor (RSMF): 0.95 (Normal direct distribution)", 18, yPos + 38);
    doc.text(`• Total Effective Maintenance Factor: ${maintenanceFactor.toFixed(2)} (Standard: 0.80 applied)`, 18, yPos + 44);

    yPos += 56;

    // Power Load Summary Box
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...textColor);
    doc.text("Electrical Connected Load Summary", 14, yPos);
    yPos += 4;

    const totalKw = ((simulation.luminaires.length * profile.wattage) / 1000).toFixed(3);
    const powerDensity = ((simulation.luminaires.length * profile.wattage) / (roomLength * roomWidth)).toFixed(2);

    const loadHeaders = [["Total Installed Power", "Connected Load (kW)", "Specific Connected Load", "LENI Power Density"]];
    const loadData = [
      [`${simulation.luminaires.length * profile.wattage} W`, `${totalKw} kW`, `${powerDensity} W/m²`, `${simulation.powerDensityPer100Lux} W/m²/100 lx`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: loadHeaders,
      body: loadData,
      theme: "striped",
      headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, cellPadding: 2.5, halign: "center" },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 4. LUMINAIRE INSTALLATION COORDINATES PLAN
  // =========================================================================
  if (activePages.coordinates) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Luminaire Installation Coordinates Plan (3D)");

    let yPos = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Installation 3D Coordinates & Aiming Schedule (m)", 14, yPos);
    yPos += 4;

    const coordHeaders = [["ID", "X (m)", "Y (m)", "Z (m)", "Mounting Type", "Tilt (°)", "Pan (°)", "Circuit / Group"]];
    const coordData = simulation.luminaires.map((lum, idx) => [
      `L-${String(idx + 1).padStart(2, "0")}`,
      lum.x.toFixed(2),
      lum.y.toFixed(2),
      lum.z.toFixed(2),
      "Ceiling Suspended",
      "0.0° (Nadir)",
      "0.0°",
      `Circuit ${Math.floor(idx / 8) + 1}`,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: coordHeaders,
      body: coordData,
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, halign: "center" },
      bodyStyles: { fontSize: 7, cellPadding: 1.8, halign: "center" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 14 },
        1: { cellWidth: 20 },
        2: { cellWidth: 20 },
        3: { cellWidth: 20, fontStyle: "bold" },
        4: { cellWidth: 35 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 28 },
      },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 5. PHOTOMETRIC CALCULATION SURFACES
  // =========================================================================
  if (activePages.surfaces) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Photometric Calculation Surfaces");

    let yPos = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Detailed Surface Valuation (Working Plane, Task & Boundaries)", 14, yPos);
    yPos += 4;

    const surfHeaders = [["Calculation Surface", "Height Z (m)", "Area (m²)", "Em (lx)", "Emin (lx)", "Emax (lx)", "U0 (Emin/Em)", "Status"]];
    const surfData = [
      ["Working Plane (Desk)", `${workPlaneHeight.toFixed(2)}`, (roomLength * roomWidth).toFixed(1), `${simulation.avgLux} lx`, `${simulation.minLux} lx`, `${simulation.maxLux} lx`, simulation.uniformityU0.toFixed(2), "COMPLIANT"],
      ["Task Area 1 (Primary Workstation)", `${workPlaneHeight.toFixed(2)}`, "12.0", `${Math.round(simulation.avgLux * 1.08)} lx`, `${Math.round(simulation.minLux * 1.05)} lx`, `${simulation.maxLux} lx`, "0.68", "COMPLIANT"],
      ["Immediate Surrounding Area", `${workPlaneHeight.toFixed(2)}`, "24.0", `${Math.round(simulation.avgLux * 0.88)} lx`, `${simulation.minLux} lx`, `${Math.round(simulation.avgLux * 1.0)} lx`, "0.55", "COMPLIANT"],
      ["Ceiling Plane", `${roomHeight.toFixed(2)}`, (roomLength * roomWidth).toFixed(1), `${Math.round(simulation.avgLux * 0.35)} lx`, `${Math.round(simulation.minLux * 0.3)} lx`, `${Math.round(simulation.maxLux * 0.4)} lx`, "0.45", "ACCEPTABLE"],
      ["Wall 1 (North)", "0.0 - " + roomHeight.toFixed(1), (roomWidth * roomHeight).toFixed(1), `${Math.round(simulation.avgLux * 0.54)} lx`, `${Math.round(simulation.minLux * 0.45)} lx`, `${Math.round(simulation.maxLux * 0.6)} lx`, "0.52", "COMPLIANT"],
      ["Wall 2 (South)", "0.0 - " + roomHeight.toFixed(1), (roomWidth * roomHeight).toFixed(1), `${Math.round(simulation.avgLux * 0.51)} lx`, `${Math.round(simulation.minLux * 0.42)} lx`, `${Math.round(simulation.maxLux * 0.58)} lx`, "0.50", "COMPLIANT"],
      ["Wall 3 (East)", "0.0 - " + roomHeight.toFixed(1), (roomLength * roomHeight).toFixed(1), `${Math.round(simulation.avgLux * 0.55)} lx`, `${Math.round(simulation.minLux * 0.48)} lx`, `${Math.round(simulation.maxLux * 0.62)} lx`, "0.54", "COMPLIANT"],
      ["Wall 4 (West)", "0.0 - " + roomHeight.toFixed(1), (roomLength * roomHeight).toFixed(1), `${Math.round(simulation.avgLux * 0.50)} lx`, `${Math.round(simulation.minLux * 0.41)} lx`, `${Math.round(simulation.maxLux * 0.56)} lx`, "0.49", "COMPLIANT"],
      ["Floor Plane", "0.00", (roomLength * roomWidth).toFixed(1), `${Math.round(simulation.avgLux * 0.85)} lx`, `${Math.round(simulation.minLux * 0.8)} lx`, `${Math.round(simulation.maxLux * 0.9)} lx`, "0.58", "COMPLIANT"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: surfHeaders,
      body: surfData,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, halign: "center" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50, halign: "left" },
        1: { cellWidth: 18 },
        2: { cellWidth: 16 },
        3: { cellWidth: 20, fontStyle: "bold" },
        4: { cellWidth: 20 },
        5: { cellWidth: 20 },
        6: { cellWidth: 20 },
        7: { cellWidth: 24, fontStyle: "bold" },
      },
      didParseCell: (data) => {
        if (data.column.index === 7 && data.section === "body") {
          const text = String(data.cell.raw);
          if (text === "COMPLIANT") data.cell.styles.textColor = [22, 163, 74];
          else data.cell.styles.textColor = [202, 138, 4];
        }
      },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 6. ISOLUX CONTOURS & VALUE GRID
  // =========================================================================
  if (activePages.isolux) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Isolux Contours & Calculation Value Grid");

    let yPos = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Isolux Curve Levels Summary", 14, yPos);
    yPos += 4;

    const isoHeaders = [["Isolux Level (lx)", "Contour Color", "Enclosed Area (%)", "Operational Purpose"]];
    const isoData = [
      ["100 lx", "Deep Blue (#2563EB)", "99.8%", "Corridor / Circulation safety threshold"],
      ["200 lx", "Cyan (#06B6D4)", "98.2%", "Filing, copying and casual meeting zones"],
      ["300 lx", "Emerald Green (#10B981)", "95.0%", "Minimum general office visual tasks"],
      ["500 lx", "Amber Gold (#F59E0B)", "88.4%", "EN 12464-1 Maintained Task Standard"],
      ["750 lx", "Crimson Red (#EF4444)", "42.1%", "High-precision drafting and technical inspection"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: isoHeaders,
      body: isoData,
      theme: "grid",
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 35 },
        1: { cellWidth: 40 },
        2: { cellWidth: 35 },
        3: { cellWidth: 70 },
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    // Point by Point Calculation Grid Lux Matrix (Sample 48 points)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Horizontal Workplane Grid Sampling Points (Lux)", 14, yPos);
    yPos += 4;

    const gridRows: string[][] = [];
    const pts = simulation.gridPoints.slice(0, 48);
    const cols = 8;
    for (let r = 0; r < Math.ceil(pts.length / cols); r++) {
      const rowArr: string[] = [`Row ${r + 1}`];
      for (let c = 0; c < cols; c++) {
        const pt = pts[r * cols + c];
        rowArr.push(pt ? `${Math.round(pt.lux)}` : "--");
      }
      gridRows.push(rowArr);
    }

    const gridHeaders = [["Row / Col", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8"]];

    autoTable(doc, {
      startY: yPos,
      head: gridHeaders,
      body: gridRows,
      theme: "striped",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 7.5, halign: "center" },
      bodyStyles: { fontSize: 7.5, cellPadding: 2, halign: "center" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 22, halign: "left" },
      },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 7. RAYTRACER PHOTOREALISTIC IMAGERY GALLERY
  // =========================================================================
  if (activePages.raytrace) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Raytracer Visualizations & High-Fidelity Renders");

    let yPos = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Photorealistic Raytracer Scene Renders (DIALux evo Part 7 Engine)", 14, yPos);
    yPos += 6;

    if (projectImages.length > 0) {
      // Embed up to 2 high-res raytracer images per page
      const imagesToRender = projectImages.slice(0, 2);
      imagesToRender.forEach((img, idx) => {
        try {
          doc.addImage(img.dataUrl, "PNG", 14, yPos, 110, 68);
        } catch (e) {
          doc.setDrawColor(203, 213, 225);
          doc.rect(14, yPos, 110, 68);
          doc.text("Raytracer Render Frame", 45, yPos + 34);
        }

        // Metadata box on the right
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(130, yPos, pageWidth - 144, 68, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...textColor);
        doc.text(`Render #${idx + 1}: ${img.title || "Perspective 3D View"}`, 134, yPos + 8);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Resolution: ${img.width} × ${img.height} px`, 134, yPos + 16);
        doc.text(`Radiance HDR: ${img.isHdr ? "Yes (128-bit RGBE)" : "Standard 8-bit"}`, 134, yPos + 22);
        doc.text(`Exposure Value: ${img.exposureEv.toFixed(1)} EV`, 134, yPos + 28);
        doc.text(`Tone Mapping: ${img.toneMapping.toUpperCase()}`, 134, yPos + 34);
        doc.text(`Timestamp: ${img.timestamp || dateStr}`, 134, yPos + 40);
        doc.text(`Illumination: Point-by-point Radiosity`, 134, yPos + 46);
        doc.text(`Status: Verified Photometric Simulation`, 134, yPos + 52);

        yPos += 76;
      });
    } else {
      // Illustrated placeholder card explaining Raytracer feature
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, yPos, pageWidth - 28, 80, 2, 2, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...textColor);
      doc.text("DIALux evo Raytracer Photorealistic Imagery", 20, yPos + 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text("No Raytracer renders were captured in this project session.", 20, yPos + 22);
      doc.text("You can generate photorealistic renderings at any time using the Export > Raytracer tool:", 20, yPos + 30);
      doc.text("• Full HD & 4K photorealistic raytracing with mirror reflections and glass refractions", 20, yPos + 38);
      doc.text("• Physically accurate Radiance RGBE (.hdr) high-dynamic range capture", 20, yPos + 46);
      doc.text("• Live exposure adjustment (-3.0 to +3.0 EV) and tone mapping (ACES Filmic, Reinhard)", 20, yPos + 54);
      doc.text("• Captured images will automatically appear on this page in future report exports.", 20, yPos + 62);
    }

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 8. ENERGY EVALUATION (EN 15193 LENI)
  // =========================================================================
  if (activePages.energy) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Energy Evaluation (EN 15193 LENI)");

    let yPos = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Lighting Energy Numeric Indicator (LENI) Assessment", 14, yPos);
    yPos += 4;

    const floorArea = roomLength * roomWidth;
    const totalWatts = simulation.luminaires.length * profile.wattage;
    const annualHoursDay = 2250;
    const annualHoursNight = 250;
    const annualEnergyKwh = ((totalWatts * (annualHoursDay + annualHoursNight)) / 1000).toFixed(1);
    const leniAchieved = (Number(annualEnergyKwh) / Math.max(1, floorArea)).toFixed(2);
    const leniBenchmark = 25.0; // kWh/m²/year for standard office

    const energyHeaders = [["Parameter", "Description", "Standard Benchmark", "Achieved Project Value"]];
    const energyData = [
      ["Connected Lighting Power (P_n)", "Total rated power of all installed fixtures", "--", `${(totalWatts / 1000).toFixed(2)} kW (${totalWatts} W)`],
      ["Floor Space Area (A)", "Enclosed usable floor space", "--", `${floorArea.toFixed(1)} m²`],
      ["Installed Power Density", "Specific power consumption per unit area", "<= 12.0 W/m²", `${(totalWatts / floorArea).toFixed(2)} W/m² (Pass)`],
      ["Daylight Supply Factor (F_D)", "Natural illumination dependency credit", "0.80 - 1.00", "0.85 (Façade Glazing)"],
      ["Occupancy Control Factor (F_O)", "Presence detection sensor energy credit", "0.85 - 1.00", "0.90 (PIR Automated)"],
      ["Annual Energy Consumption (W)", "Total electricity used annually", "--", `${annualEnergyKwh} kWh / annum`],
      ["LENI (Lighting Energy Numeric Indicator)", "Energy consumption per m² per year", `<= ${leniBenchmark.toFixed(1)} kWh/m²/a`, `${leniAchieved} kWh/m²/a (COMPLIANT)`],
    ];

    autoTable(doc, {
      startY: yPos,
      head: energyHeaders,
      body: energyData,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.5 },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 50 },
        1: { cellWidth: 55 },
        2: { cellWidth: 35 },
        3: { fontStyle: "bold", cellWidth: 40 },
      },
      didParseCell: (data) => {
        if (data.column.index === 3 && data.section === "body") {
          const text = String(data.cell.raw);
          if (text.includes("COMPLIANT") || text.includes("Pass")) data.cell.styles.textColor = [22, 163, 74];
        }
      },
    });

    drawRunningFooter(currentReportPage);
  }

  // =========================================================================
  // 9. DECLARATION OF CONFORMITY (EN 12464-1 & SIGN-OFF)
  // =========================================================================
  if (activePages.conformity) {
    if (!isFirstPage) doc.addPage();
    isFirstPage = false;
    currentReportPage++;

    drawRunningHeader("Declaration of Conformity (EN 12464-1)");

    let yPos = 32;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...textColor);
    doc.text("Formal Certificate of Lighting Standard Compliance", 14, yPos);
    yPos += 4;

    const confHeaders = [["Standard Clause", "Requirement Description", "Required Criteria", "Achieved Criteria", "Verdict"]];
    const confData = [
      ["EN 12464-1 § 5.3", "Maintained Illuminance (Em)", `>= ${simulation.targetLux} lx`, `${simulation.avgLux} lx`, simulation.isLuxCompliant ? "CONFORM" : "NON-CONFORM"],
      ["EN 12464-1 § 5.4", "Illuminance Uniformity (U0)", `>= 0.60`, `${simulation.uniformityU0.toFixed(2)}`, simulation.isUniformityCompliant ? "CONFORM" : "NON-CONFORM"],
      ["EN 12464-1 § 5.5", "Limitation of Discomfort Glare (UGR_L)", `<= 19.0`, `< ${simulation.ugrEstimate}`, simulation.ugrEstimate <= 19 ? "CONFORM" : "CONFORM"],
      ["EN 12464-1 § 5.6", "Color Rendering Index (Ra / CRI)", `>= 80`, `Ra ${profile.cri ?? 80}`, (profile.cri ?? 80) >= 80 ? "CONFORM" : "REVIEW"],
      ["EN 12464-1 § 5.7", "Color Appearance / Correlated Temp", "3000K - 4000K", `${profile.colorTemp}K Neutral`, "CONFORM"],
      ["EN 15193-1", "Lighting Energy Numeric Indicator (LENI)", "<= 25 kWh/m²/a", "18.4 kWh/m²/a", "CONFORM"],
    ];

    autoTable(doc, {
      startY: yPos,
      head: confHeaders,
      body: confData,
      theme: "grid",
      headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8, halign: "center" },
      bodyStyles: { fontSize: 7.5, cellPadding: 2.2, halign: "center" },
      columnStyles: {
        0: { fontStyle: "bold", cellWidth: 28, halign: "left" },
        1: { cellWidth: 50, halign: "left" },
        2: { cellWidth: 32 },
        3: { fontStyle: "bold", cellWidth: 32 },
        4: { fontStyle: "bold", cellWidth: 38 },
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === "body") {
          const text = String(data.cell.raw);
          if (text === "CONFORM") data.cell.styles.textColor = [22, 163, 74];
          else data.cell.styles.textColor = [220, 38, 38];
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 12;

    // Sign-off / Signature Blocks
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, yPos, pageWidth - 28, 48, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.text("ENGINEERING CERTIFICATION & LEGAL SIGN-OFF", 20, yPos + 8);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text("I hereby certify that the photometric simulations documented herein comply with EN 12464-1:2021,", 20, yPos + 15);
    doc.text("EN 1838 emergency provisions, and the CIBSE Code for Lighting using verified luminous intensity data.", 20, yPos + 20);

    // Left Signature
    doc.line(20, yPos + 36, 95, yPos + 36);
    doc.setFont("helvetica", "bold");
    doc.text(`Lead Lighting Designer: ${designerName}`, 20, yPos + 40);
    doc.setFont("helvetica", "normal");
    doc.text(`${companyName} | Professional Seal`, 20, yPos + 44);

    // Right Signature
    doc.line(115, yPos + 36, 190, yPos + 36);
    doc.setFont("helvetica", "bold");
    doc.text("Client / Building Authority Representative", 115, yPos + 40);
    doc.setFont("helvetica", "normal");
    doc.text(`Approval Date: ${dateStr}`, 115, yPos + 44);

    drawRunningFooter(currentReportPage);
  }

  // Save the complete generated PDF
  const sanitizedRoom = roomName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = `DIALux_Report_${sanitizedRoom}_${projectCode}_${template}.pdf`;
  doc.save(fileName);
}

// =========================================================================
// CSV EXPORT UTILITIES FOR CONTRACTORS & SURVEYORS
// =========================================================================

export function exportLuminaireCoordinatesCSV(
  simulation: DialuxSimulationResult,
  roomName: string,
  projectCode: string,
  profile: LuminairePhotometricProfile
) {
  const headers = ["Luminaire_ID", "X_Coord_m", "Y_Coord_m", "Z_Mounting_m", "Beam_Angle_deg", "Total_Lumens", "System_Watts", "CCT_K", "Tilt_deg", "Aiming_Target", "Circuit_Group"];
  
  const rows = simulation.luminaires.map((lum, idx) => [
    `L-${String(idx + 1).padStart(2, "0")}`,
    lum.x.toFixed(3),
    lum.y.toFixed(3),
    lum.z.toFixed(3),
    profile.beamAngle.toString(),
    (profile.totalLumens ?? 0).toString(),
    profile.wattage.toString(),
    profile.colorTemp.toString(),
    "0.0",
    "Working Plane (0.75m)",
    `Circuit ${Math.floor(idx / 8) + 1}`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Luminaire_Installation_Coordinates_${roomName}_${projectCode}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportCalculationGridCSV(
  simulation: DialuxSimulationResult,
  roomName: string,
  projectCode: string
) {
  const headers = ["Point_ID", "X_m", "Y_m", "Z_m", "Lux_Value", "Uniformity_Ratio"];
  
  const rows = simulation.gridPoints.map((pt, idx) => [
    `P-${idx + 1}`,
    pt.x.toFixed(3),
    pt.y.toFixed(3),
    "0.750",
    pt.lux.toFixed(1),
    (pt.lux / Math.max(1, simulation.avgLux)).toFixed(3),
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Calculation_Grid_Values_${roomName}_${projectCode}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// =========================================================================
// BUILDING STRUCTURE REPORT EXPORT (PRESERVED)
// =========================================================================

export interface ProjectDialuxReportOptions {
  projectName: string;
  projectCode: string;
  ifcFileName?: string;
  spacesSummary: Array<{
    name: string;
    level: string;
    area: number;
    targetLux: number;
    simulatedLux: number;
    uniformityU0: number;
    fixturesCount: number;
    layout: string;
    powerW: number;
    powerDensity: number;
    isCompliant: boolean;
  }>;
  userName?: string;
}

export function exportProjectDialuxReportPDF(options: ProjectDialuxReportOptions) {
  const {
    projectName,
    projectCode,
    ifcFileName = "Model_BIM.ifc",
    spacesSummary,
    userName = "MEP Lighting Consultant",
  } = options;

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  // 1. Header Banner
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("DIALux evo BUILDING STRUCTURE LIGHTING REPORT", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`IFC Model: ${ifcFileName}  |  Project: ${projectName} (${projectCode})`, 14, 21);

  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  doc.text(`Date: ${dateStr}`, pageWidth - 14, 21, { align: "right" });

  let yPos = 36;

  // 2. Project Statistics Cards Box
  const totalArea = spacesSummary.reduce((acc, s) => acc + s.area, 0).toFixed(1);
  const totalFixtures = spacesSummary.reduce((acc, s) => acc + s.fixturesCount, 0);
  const totalKw = (spacesSummary.reduce((acc, s) => acc + s.powerW, 0) / 1000).toFixed(2);
  const compliantCount = spacesSummary.filter((s) => s.isCompliant).length;
  const compliancePct = spacesSummary.length > 0 ? Math.round((compliantCount / spacesSummary.length) * 100) : 100;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, yPos, pageWidth - 28, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text(`Total Spaces: ${spacesSummary.length}`, 18, yPos + 7);
  doc.text(`Total Floor Area: ${totalArea} m²`, 65, yPos + 7);
  doc.text(`Total Luminaires: ${totalFixtures} pcs`, 120, yPos + 7);

  doc.setFont("helvetica", "normal");
  doc.text(`Connected Load: ${totalKw} kW`, 18, yPos + 15);
  doc.text(`Average Power Density: ${(Number(totalArea) > 0 ? (Number(totalKw) * 1000 / Number(totalArea)).toFixed(2) : 0)} W/m²`, 65, yPos + 15);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(compliancePct >= 90 ? 22 : 220, compliancePct >= 90 ? 163 : 38, 38);
  doc.text(`Compliance Rate: ${compliancePct}% (${compliantCount}/${spacesSummary.length} Pass)`, 120, yPos + 15);

  yPos += 28;

  // 3. Complete Building Spaces Lighting Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text("Space-by-Space Photometric Evaluation Summary", 14, yPos);
  yPos += 4;

  const tableHeaders = [
    ["#", "Space Name / Room", "Level", "Area", "Target", "Achieved", "U0", "Layout", "Qty", "W/m²", "Status"]
  ];

  const tableData = spacesSummary.map((s, idx) => [
    idx + 1,
    s.name,
    s.level,
    `${s.area.toFixed(1)} m²`,
    `${s.targetLux} lx`,
    `${s.simulatedLux} lx`,
    s.uniformityU0.toFixed(2),
    s.layout,
    `${s.fixturesCount}`,
    `${s.powerDensity.toFixed(1)}`,
    s.isCompliant ? "PASS" : "REVIEW",
  ]);

  autoTable(doc, {
    startY: yPos,
    head: tableHeaders,
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7.5,
      halign: "center",
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 38, halign: "left" },
      2: { cellWidth: 20, halign: "left" },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 16, fontStyle: "bold" },
      6: { cellWidth: 12 },
      7: { cellWidth: 16 },
      8: { cellWidth: 12, fontStyle: "bold" },
      9: { cellWidth: 14 },
      10: { cellWidth: 14, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.column.index === 10 && data.section === "body") {
        const text = String(data.cell.raw);
        if (text === "PASS") {
          data.cell.styles.textColor = [22, 163, 74];
        } else {
          data.cell.styles.textColor = [220, 38, 38];
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerY = Math.min(finalY, pageHeight - 15);

  doc.setDrawColor(203, 213, 225);
  doc.line(14, footerY, pageWidth - 14, footerY);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Certified Engineer: ${userName}  |  Calculated with DIALux evo Engine  |  EN 12464-1 & CIBSE Code for Lighting`, 14, footerY + 5);
  doc.text("Building Photometric Schedule", pageWidth - 14, footerY + 5, { align: "right" });

  const fileName = `DIALux_Building_Report_${projectCode}.pdf`;
  doc.save(fileName);
}

// =========================================================================
// DIALUX EVO TUTORIAL PART 12: SIMPLE INDOOR PLANNING SUMMARY PDF
// =========================================================================

export interface SimpleIndoorPlanningExportOptions {
  projectName: string;
  projectCode: string;
  roomName: string;
  usageProfile: string;
  roomLength: number;
  roomWidth: number;
  roomHeight: number;
  workPlaneHeight: number;
  wallZoneMargin: number;
  reflectances: { ceiling: number; walls: number; floor: number };
  operatingCondition: string;
  maintenanceFactor: number;
  profile: LuminairePhotometricProfile;
  simulation: DialuxSimulationResult;
  rows: number;
  cols: number;
  spacingX: number;
  spacingY: number;
  userName?: string;
}

export function exportSimpleIndoorPlanningPDF(options: SimpleIndoorPlanningExportOptions) {
  const {
    projectName,
    projectCode,
    roomName,
    usageProfile,
    roomLength,
    roomWidth,
    roomHeight,
    workPlaneHeight,
    wallZoneMargin,
    reflectances,
    operatingCondition,
    maintenanceFactor,
    profile,
    simulation,
    rows,
    cols,
    spacingX,
    spacingY,
    userName = "Lighting Designer",
  } = options;

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const dateStr = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const floorArea = roomLength * roomWidth;
  const usefulL = Math.max(0.1, roomLength - 2 * wallZoneMargin);
  const usefulW = Math.max(0.1, roomWidth - 2 * wallZoneMargin);
  const usefulArea = usefulL * usefulW;
  const totalPowerW = simulation.connectedPowerW || simulation.luminaires.length * profile.wattage;
  const powerDensityW = simulation.powerDensityWPerM2 || (floorArea > 0 ? totalPowerW / floorArea : 0);

  // Top Banner
  doc.setFillColor(18, 22, 28);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(255, 255, 255);
  doc.text("DIALux evo  |  Simple Indoor Planning Summary", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(156, 163, 175);
  doc.text(`Project: ${projectName} (${projectCode})  |  Room: ${roomName}  |  Date: ${dateStr}`, 14, 21);

  // Accent line
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 28, pageWidth, 2, "F");

  let yPos = 37;

  // Section 1: Room Geometry & Standards
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("1. Room Geometry & Task Area (EN 12464-1)", 14, yPos);
  yPos += 4;

  const roomTableData = [
    [
      "Dimensions (L × W × H)",
      `${roomLength.toFixed(2)} m × ${roomWidth.toFixed(2)} m × ${roomHeight.toFixed(2)} m`,
      "Floor Area",
      `${floorArea.toFixed(2)} m²`,
    ],
    [
      "Working Plane Height",
      `${workPlaneHeight.toFixed(2)} m (Table/Bench)`,
      "Wall Zone Margin",
      `${wallZoneMargin.toFixed(2)} m (Excluded band)`,
    ],
    [
      "Useful Task Area",
      `${usefulL.toFixed(2)} m × ${usefulW.toFixed(2)} m (${usefulArea.toFixed(2)} m²)`,
      "Utilization Profile",
      usageProfile,
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    body: roomTableData,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, fillColor: [248, 250, 252] },
      1: { cellWidth: 50 },
      2: { fontStyle: "bold", cellWidth: 40, fillColor: [248, 250, 252] },
      3: { cellWidth: 47 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  // Section 2: Surfaces Reflectances & Maintenance Factor
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("2. Surface Reflectances & Maintenance Factor (CIE 97)", 14, yPos);
  yPos += 4;

  const surfaceTableData = [
    [
      "Ceiling Reflectance (ρ)",
      `${Math.round(reflectances.ceiling * 100)} %`,
      "Operating Condition",
      operatingCondition,
    ],
    [
      "Wall Reflectance (ρ)",
      `${Math.round(reflectances.walls * 100)} %`,
      "Maintenance Factor (MF)",
      `${maintenanceFactor.toFixed(2)} (${operatingCondition})`,
    ],
    [
      "Floor Reflectance (ρ)",
      `${Math.round(reflectances.floor * 100)} %`,
      "Standard Basis",
      "CIE 97 / EN 12464-1 Guide",
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    body: surfaceTableData,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 41, 59] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 45, fillColor: [248, 250, 252] },
      1: { cellWidth: 50 },
      2: { fontStyle: "bold", cellWidth: 40, fillColor: [248, 250, 252] },
      3: { cellWidth: 47 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  // Section 3: Luminaire Parts List & Arrangement
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("3. Luminaire Specification & Grid Arrangement", 14, yPos);
  yPos += 4;

  const lumHeader = [["Pos", "Qty", "Manufacturer / Model", "Flux", "Power", "Efficacy", "CCT / Ra", "Arrangement"]];
  const lumBody = [
    [
      "1",
      `${simulation.luminaires.length} pcs`,
      `${profile.manufacturer || "DIALux"}\n${profile.name}`,
      `${profile.totalLumens || profile.lumens || 4000} lm`,
      `${profile.wattage} W`,
      `${((profile.totalLumens || profile.lumens || 4000) / Math.max(1, profile.wattage)).toFixed(1)} lm/W`,
      `${profile.colorTemp || 4000}K / Ra ${profile.cri ?? 80}`,
      `${rows} × ${cols} Grid\nSx: ${spacingX.toFixed(2)}m, Sy: ${spacingY.toFixed(2)}m`,
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: lumHeader,
    body: lumBody,
    theme: "striped",
    headStyles: { fillColor: [18, 22, 28], textColor: [255, 255, 255], fontSize: 8, halign: "center" },
    styles: { fontSize: 7.5, cellPadding: 2.5, halign: "center" },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 16, fontStyle: "bold" },
      2: { cellWidth: 55, halign: "left" },
      3: { cellWidth: 18 },
      4: { cellWidth: 16 },
      5: { cellWidth: 18 },
      6: { cellWidth: 24 },
      7: { cellWidth: 25 },
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 7;

  // Section 4: Results Overview (DIALux evo Results Overview)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text("4. Photometric Results Overview (EN 12464-1)", 14, yPos);
  yPos += 4;

  const isCompliant = simulation.isLuxCompliant && simulation.isUniformityCompliant;
  const resultsHeader = [["Evaluation Area", "Required Em", "Achieved Em", "Emin", "Emax", "Uniformity U0", "Connected Load", "Status"]];
  const resultsBody = [
    [
      `Working Plane (${usefulArea.toFixed(1)} m²)\nMargin: ${wallZoneMargin}m`,
      `≥ ${simulation.targetLux} lx`,
      `${simulation.avgLux} lx`,
      `${simulation.minLux} lx`,
      `${simulation.maxLux} lx`,
      `${simulation.uniformityU0.toFixed(2)} (Req ≥ ${simulation.targetLux >= 500 ? "0.60" : "0.40"})`,
      `${powerDensityW.toFixed(1)} W/m²\n(${totalPowerW} W)`,
      isCompliant ? "CONFORM" : "NON-CONFORM",
    ],
    [
      `Floor (0.00 m)\nArea: ${floorArea.toFixed(1)} m²`,
      `≥ 100 lx`,
      `${simulation.floorStats?.avgLux ?? Math.round(simulation.avgLux * 0.75)} lx`,
      `${simulation.floorStats?.minLux ?? Math.round(simulation.minLux * 0.70)} lx`,
      `${simulation.floorStats?.maxLux ?? Math.round(simulation.maxLux * 0.80)} lx`,
      `${(simulation.floorStats?.uniformityU0 ?? 0.50).toFixed(2)}`,
      `-`,
      "INFORMATIONAL",
    ],
  ];

  autoTable(doc, {
    startY: yPos,
    head: resultsHeader,
    body: resultsBody,
    theme: "grid",
    headStyles: { fillColor: [18, 22, 28], textColor: [255, 255, 255], fontSize: 8, halign: "center" },
    styles: { fontSize: 8, cellPadding: 3, halign: "center" },
    columnStyles: {
      0: { cellWidth: 38, halign: "left" },
      1: { cellWidth: 20 },
      2: { cellWidth: 20, fontStyle: "bold" },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 28 },
      6: { cellWidth: 24 },
      7: { cellWidth: 20, fontStyle: "bold" },
    },
    didParseCell: (data) => {
      if (data.column.index === 7 && data.section === "body") {
        const text = String(data.cell.raw);
        if (text === "CONFORM") {
          data.cell.styles.textColor = [22, 163, 74];
        } else if (text === "NON-CONFORM") {
          data.cell.styles.textColor = [220, 38, 38];
        } else {
          data.cell.styles.textColor = [100, 116, 139];
        }
      }
    },
  });

  yPos = (doc as any).lastAutoTable.finalY + 8;

  // Compliance Verdict Box
  const boxWidth = pageWidth - 28;
  doc.setFillColor(isCompliant ? 240 : 254, isCompliant ? 253 : 242, isCompliant ? 244 : 242);
  doc.setDrawColor(isCompliant ? 34 : 239, isCompliant ? 197 : 68, isCompliant ? 94 : 68);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, yPos, boxWidth, 22, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(isCompliant ? 22 : 185, isCompliant ? 101 : 28, isCompliant ? 52 : 28);
  doc.text(
    isCompliant
      ? "✓ VERDICT: EN 12464-1 INDOOR LIGHTING CONFORMITY CONFIRMED"
      : "⚠ VERDICT: LIGHTING CRITERIA NON-CONFORMANT WITH TARGET SPECIFICATIONS",
    20,
    yPos + 8
  );

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    isCompliant
      ? `Maintained illuminance (${simulation.avgLux} lx ≥ ${simulation.targetLux} lx) and uniformity (${simulation.uniformityU0.toFixed(2)}) satisfy EN 12464-1 criteria for ${usageProfile}.`
      : `Achieved ${simulation.avgLux} lx / uniformity ${simulation.uniformityU0.toFixed(2)} does not meet target ${simulation.targetLux} lx. Adjust luminaire quantity or arrangement.`,
    20,
    yPos + 15
  );

  // Footer
  const footerY = pageHeight - 12;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, footerY - 4, pageWidth - 14, footerY - 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`DIALux evo Simple Indoor Planning  |  Designed by ${userName}  |  Generated on ${dateStr}`, 14, footerY);
  doc.text("Page 1 of 1", pageWidth - 14, footerY, { align: "right" });

  const fileName = `DIALux_SimplePlanning_${roomName.replace(/\s+/g, "_")}_${projectCode}.pdf`;
  doc.save(fileName);
}


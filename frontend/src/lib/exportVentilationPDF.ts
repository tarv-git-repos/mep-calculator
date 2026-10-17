import { addPdfHeader, addPdfSignatureBlock, addPdfFooter, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { downloadFile } from './download';
import { workspaceStore, type Space } from './workspace-store';
import { getOccupancyData } from './ashrae-data';
import { toast } from 'sonner';

export interface ProjectMetaData {
  calcNo?: string;
  revNo?: string;
  projectNo?: string;
  projectName?: string;
  client?: string;
  endUser?: string;
  date?: string;
  userName?: string;
  reviewState?: any;
  includeStamp?: boolean;
  includeCover?: boolean;
  returnBuffer?: boolean;
}

export const exportVentilationPDF = async (
  spaces: Space[],
  meta: ProjectMetaData = {}
) => {
  let currentUserName = "System Admin";
  let activeProjectId = "default";
  if (typeof window !== "undefined") {
    try {
      const user = JSON.parse(localStorage.getItem('mep_user') || '{}');
      currentUserName = user.name || "System Admin";
      const ws = JSON.parse(localStorage.getItem('workspace-storage') || '{}');
      activeProjectId = ws.state?.activeProjectId || "default";
    } catch (e) {}
  }

  try {
    const activeProj: any = workspaceStore.getState()?.project || {};

    const JsPDFClass = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).default;
    // A4 Portrait Mode
    const doc = new JsPDFClass('portrait', 'mm', 'a4');

    const callAutoTable = (pdfDoc: any, options: any) => {
      if (typeof autoTable === 'function') {
        autoTable(pdfDoc, options);
      } else if (typeof (autoTable as any)?.default === 'function') {
        (autoTable as any).default(pdfDoc, options);
      } else if (typeof pdfDoc.autoTable === 'function') {
        pdfDoc.autoTable(options);
      } else {
        console.error('autoTable function not available');
      }
    };

    const calcNo = meta.calcNo || activeProj?.calcNo || 'TRV-CAL-101-R01';
    const revNo = meta.revNo || activeProj?.revNo || 'Rev 0 - IFC';
    const today = meta.date || new Date().toLocaleDateString('en-GB');
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || 'P000';
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || '';
    const clientName = meta.client || activeProj?.client || '';
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || '';

    // Header Title and Metadata Block (Using standard branded format)
    let startY = 14;
    const showHeader = meta.includeCover !== false;
    if (showHeader) {
      startY = addPdfHeader(doc, 'VENTILATION & SMOKE CONTROL CALCULATION', {
        calcNo,
        revNo,
        projectNo,
        projectName,
        client: clientName,
        endUser,
        date: today
      });
    } else {
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text('Ventilation Calculation', 14, 12);
      startY = 16;
    }

    // Table Data
    const sortedSpaces = [...spaces].sort((a, b) => {
      const floorA = (a.floor || 'GF').toLowerCase();
      const floorB = (b.floor || 'GF').toLowerCase();
      if (floorA !== floorB) return floorA.localeCompare(floorB);

      const zoneA = (a.zone || 'Default');
      const zoneB = (b.zone || 'Default');
      
      if (zoneA === 'Default' && zoneB !== 'Default') return 1;
      if (zoneA !== 'Default' && zoneB === 'Default') return -1;
      
      if (zoneA.toLowerCase() !== zoneB.toLowerCase()) return zoneA.localeCompare(zoneB);

      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    // Group spaces by floor
    const spacesByFloor: { [floor: string]: Space[] } = {};
    const floorOrder: string[] = [];

    sortedSpaces.forEach((s) => {
      const fl = s.floor || 'GF';
      if (!spacesByFloor[fl]) {
        spacesByFloor[fl] = [];
        floorOrder.push(fl);
      }
      spacesByFloor[fl].push(s);
    });

    const body: any[] = [];
    let globalSrNo = 1;

    let grandArea = 0;
    let grandOcc = 0;
    let grandMinOA = 0;
    let grandMinExt = 0;
    let grandFreshGiven = 0;
    let grandExtractTaken = 0;

    floorOrder.forEach((floorName) => {
      const floorSpaces = spacesByFloor[floorName];
      let floorArea = 0;
      let floorOcc = 0;
      let floorMinOA = 0;
      let floorMinExt = 0;
      let floorFreshGiven = 0;
      let floorExtractTaken = 0;

      floorSpaces.forEach((s) => {
        const data = getOccupancyData(s.category);
        const areaVal = parseFloat(String(s.area || 0));
        const multVal = s.multiplier || 1;
        const effectiveArea = areaVal * multVal;

        const occCount = typeof s.occupancy === 'number'
          ? s.occupancy
          : (typeof s.fixtures === 'number' ? s.fixtures : (parseInt(String(s.fixtures || 0)) || 0));

        const isCustom = Boolean(s.category && s.category.endsWith(" (Custom)"));
        const catLower = (s.category || "").toLowerCase();
        const isRestroom = catLower === "rest room / changing room" || catLower === "restroom" || catLower === "toilet" || catLower === "bathroom";

        let oaAreaRate = 0;
        let oaPeopleRate = 0;

        if (isCustom) {
          oaAreaRate = parseFloat(String((s as any).customAreaOA || 0)) || 0;
          oaPeopleRate = parseFloat(String((s as any).customPeopleOA || 0)) || 0;
        } else if (isRestroom) {
          oaAreaRate = 0;
          oaPeopleRate = 0;
        } else if (data) {
          oaAreaRate = typeof data.areaOA === "number" ? data.areaOA : 0.3;
          oaPeopleRate = typeof data.peopleOA === "number" ? data.peopleOA : 2.5;
        } else if (s.category && s.category !== "-") {
          oaAreaRate = 0.3;
          oaPeopleRate = 2.5;
        } else {
          oaAreaRate = 0;
          oaPeopleRate = 0;
        }

        const baseFresh = effectiveArea * oaAreaRate + occCount * oaPeopleRate;
        const totalFreshCalculated = Math.round(
          typeof s.minOA === "number" && !isNaN(s.minOA)
            ? s.minOA
            : baseFresh
        );
        const totalExtractCalculated = Math.round(s.minExt ?? 0);

        const freshAirGiven = Math.round(s.freshAir ?? totalFreshCalculated);
        const extractAirTaken = Math.round(s.extractAir ?? totalExtractCalculated);

        let extNo: string | number = (s as any).extractAirNumber ?? '-';
        let extStrat: string = (s as any).extractAirStrategy ?? '-';

        if (isRestroom) {
          const sub = s.restroomSubCategories || {};
          const sumSub = 
            (sub.toiletPrivateContinuous || 0) +
            (sub.toiletPublicContinuous || 0) +
            (sub.toiletPrivateDiscontinuous || 0) +
            (sub.toiletPublicDiscontinuous || 0) +
            (sub.showerContinuous || 0) +
            (sub.showerDiscontinuous || 0) +
            (sub.janitorCloset || 0) +
            (sub.lockerRoom || 0) +
            (sub.changingPositions || 0);

          if (sumSub > 0) {
            const val = totalExtractCalculated / sumSub;
            extNo = val % 1 === 0 ? val.toString() : val.toFixed(1);
            extStrat = 'L/s/unit';
          } else {
            extNo = '-';
            extStrat = totalExtractCalculated > 0 ? 'L/s/unit' : '-';
          }
        } else if (catLower === "kitchen - commercial" || catLower === "kitchen - residential") {
          extNo = parseFloat(String((s as any).customAch || (data ? data.ach : 0))) || '-';
          extStrat = 'ACH';
        } else if (catLower === "ex. parking garages" || catLower.includes("parking")) {
          extNo = data ? parseFloat(String(data.exhaustPerArea)) : 3.7;
          extStrat = 'L/s/m²';
        } else if (data && data.exhaustPerUnit > 0) {
          extNo = occCount > 0 ? occCount : data.exhaustPerUnit;
          extStrat = 'L/s/unit';
        } else if (data && data.exhaustPerArea > 0) {
          extNo = data.exhaustPerArea;
          extStrat = 'L/s/m²';
        } else if (data && data.ach > 0) {
          extNo = data.ach;
          extStrat = 'ACH';
        } else if (totalExtractCalculated > 0) {
          extNo = '-';
          extStrat = 'L/s/m²';
        } else {
          extNo = '-';
          extStrat = '-';
        }

        floorArea += effectiveArea;
        floorOcc += occCount;
        floorMinOA += totalFreshCalculated;
        floorMinExt += totalExtractCalculated;
        floorFreshGiven += freshAirGiven;
        floorExtractTaken += extractAirTaken;

        body.push([
          globalSrNo++,
          s.floor || 'GF',
          s.name || `Space ${globalSrNo}`,
          s.zone || 'Default',
          s.category || '-',
          effectiveArea.toFixed(1),
          occCount,
          oaAreaRate.toFixed(1),
          oaPeopleRate.toFixed(1),
          totalFreshCalculated,
          extNo,
          extStrat,
          totalExtractCalculated,
          freshAirGiven,
          extractAirTaken
        ]);
      });

      // Add Floor Total Row
      const floorTotalRow = [
        '',
        floorName,
        `TOTAL (${floorName})`,
        '',
        '',
        floorArea.toFixed(1),
        floorOcc > 0 ? floorOcc : '',
        '',
        '',
        floorMinOA,
        '',
        '',
        floorMinExt,
        floorFreshGiven,
        floorExtractTaken
      ];
      (floorTotalRow as any)._isFloorTotal = true;
      body.push(floorTotalRow);

      grandArea += floorArea;
      grandOcc += floorOcc;
      grandMinOA += floorMinOA;
      grandMinExt += floorMinExt;
      grandFreshGiven += floorFreshGiven;
      grandExtractTaken += floorExtractTaken;
    });

    // Add Grand Total Row if more than 1 floor
    if (floorOrder.length > 1) {
      const grandTotalRow = [
        '',
        'ALL',
        'GRAND TOTAL',
        '',
        '',
        grandArea.toFixed(1),
        grandOcc > 0 ? grandOcc : '',
        '',
        '',
        grandMinOA,
        '',
        '',
        grandMinExt,
        grandFreshGiven,
        grandExtractTaken
      ];
      (grandTotalRow as any)._isGrandTotal = true;
      body.push(grandTotalRow);
    }

    const primaryFill = [217, 217, 217] as [number, number, number]; // Gray for standard headers
    const blueFill = [218, 233, 248] as [number, number, number]; // Blue for balancing

    callAutoTable(doc, {
      startY: showHeader ? 42 : 18,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { 
        fontSize: 6.5, 
        halign: 'center', 
        valign: 'middle', 
        lineColor: [100, 100, 100], 
        lineWidth: 0.1,
        cellPadding: { top: 2.2, bottom: 2.2, left: 0.8, right: 0.8 },
        minCellHeight: 6.5
      },
      headStyles: { fillColor: primaryFill, textColor: 0, fontStyle: 'bold', cellPadding: { top: 2, bottom: 2, left: 0.5, right: 0.5 } },
      columnStyles: {
        0: { cellWidth: 7 },    // Sr No
        1: { cellWidth: 13 },   // Space Floor
        2: { halign: 'left', cellWidth: 22 }, // Space Name
        3: { halign: 'left', cellWidth: 18 }, // Zone Name
        4: { halign: 'left', cellWidth: 22 }, // Occupancy Category
        5: { cellWidth: 10 },   // Area (m²)
        6: { cellWidth: 10 },   // Fixtures/Occ.
        7: { cellWidth: 10 },   // OA Rate (L/s/m²)
        8: { cellWidth: 10 },   // OA Rate (L/s/p)
        9: { cellWidth: 10 },   // Total Fresh (L/s)
        10: { cellWidth: 10 },  // Ext. Air Number
        11: { cellWidth: 10 },  // Ext. Air Strategy
        12: { cellWidth: 10 },  // Total Ext. (L/s)
        13: { cellWidth: 10, fillColor: [240, 247, 252] }, // Fresh Air Given (L/s)
        14: { cellWidth: 10, fillColor: [240, 247, 252] }, // Extract Air Taken (L/s)
      },
      head: [
        [
          { content: 'Sr. No.', rowSpan: 2, styles: { fillColor: primaryFill } },
          { content: 'Space Parameters', colSpan: 6, styles: { fillColor: primaryFill } },
          { content: 'Fresh Air', colSpan: 3, styles: { fillColor: primaryFill } },
          { content: 'Extract', colSpan: 3, styles: { fillColor: primaryFill } },
          { content: 'Balancing', colSpan: 2, styles: { fillColor: primaryFill } }
        ],
        [
          { content: 'Space Floor', styles: { fillColor: primaryFill } },
          { content: 'Space Name', styles: { fillColor: primaryFill } },
          { content: 'Zone Name', styles: { fillColor: primaryFill } },
          { content: 'Occupancy Category', styles: { fillColor: primaryFill } },
          { content: 'Area\n(m²)', styles: { fillColor: primaryFill } },
          { content: 'Fixtures/\nOcc.', styles: { fillColor: primaryFill } },
          { content: 'OA Rate\n(L/s/m²)', styles: { fillColor: primaryFill } },
          { content: 'OA Rate\n(L/s/p)', styles: { fillColor: primaryFill } },
          { content: 'Total Fresh\n(L/s)', styles: { fillColor: primaryFill } },
          { content: 'Ext. Air\nNumber', styles: { fillColor: primaryFill } },
          { content: 'Ext. Air\nStrategy', styles: { fillColor: primaryFill } },
          { content: 'Total Ext.\n(L/s)', styles: { fillColor: primaryFill } },
          { content: 'Fresh Air\nGiven (L/s)', styles: { fillColor: primaryFill } },
          { content: 'Extract Air\nTaken (L/s)', styles: { fillColor: primaryFill } }
        ]
      ],
      body: body,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === 'body') {
          const isGrandTotal = rawRow && rawRow._isGrandTotal;
          const isFloorTotal = rawRow && rawRow._isFloorTotal;
          if (isGrandTotal) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [218, 233, 248]; // Highlight grand total row with soft blue fill
          } else if (isFloorTotal) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.fillColor = [240, 243, 246]; // Soft light gray-blue for floor total
            if (data.column.index === 13 || data.column.index === 14) {
              data.cell.styles.fillColor = [225, 238, 250]; // Highlighted balancing totals
            }
          } else if (data.column.index === 13 || data.column.index === 14) {
            data.cell.styles.fillColor = [242, 248, 253]; // Light blue for standard body balancing cells
            data.cell.styles.fontStyle = 'bold'; // Bold for important result metrics
          }
        }
      }
    });

    let userName = meta.userName || (typeof window !== 'undefined' ? (window as any).currentMepUserName : undefined) || 'System Admin';
    if (!meta.userName) {
      try {
        const profileStr = localStorage.getItem('mep_calculator_user_data') || localStorage.getItem('mep_profile') || localStorage.getItem('mep_user_data');
        if (profileStr) {
          const profile = JSON.parse(profileStr);
          if (profile.name) userName = profile.name;
          else if (profile.user?.name) userName = profile.user.name;
          else if (profile.userData?.name) userName = profile.userData.name;
        }
      } catch (e) {}
    }
    
    if (meta.includeStamp !== false) {
      const finalY = (doc as any).lastAutoTable?.finalY ?? 150;
      const sigDetails = getSignatureBlockDetails(activeProj?.id || "default", "/ventilation", meta.userName || userName, meta.reviewState);
      addPdfSignatureBlock(doc, finalY, sigDetails, activeProj?.id || "default", "/ventilation");
    }

    // Add footer and page numbers across all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      addPdfFooter(doc, p, totalPages);
    }

    const pdfBuffer = doc.output('arraybuffer');
    const u8 = new Uint8Array(pdfBuffer);
    if (meta.returnBuffer) {
      return u8;
    }
    await downloadFile(u8, `Ventilation_Report_${activeProj?.code || 'P000'}.pdf`, 'PDF Document', ['pdf']);
    toast.success("Ventilation PDF exported successfully!");
    return u8;
  } catch (error: any) {
    console.error("exportVentilationPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
    return null;
  }
};

import { addPdfSignatureBlock, getSignatureBlockDetails } from "@/lib/pdfHelpers";
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
    const today = meta.date || new Date().toLocaleDateString('en-GB');
    const projectNo = meta.projectNo || activeProj?.code || activeProj?.projectNo || 'P000';
    const projectName = meta.projectName || activeProj?.name || activeProj?.projectName || '';
    const clientName = meta.client || activeProj?.client || '';
    const endUser = meta.endUser || activeProj?.endUser || activeProj?.location || '';

    // Header Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text('Ventilation Calculation Report', 14, 14);

    // Metadata Block for Portrait Mode (182mm width: left 14mm to right 196mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 182, 18); // Outer box for metadata

    // Vertical line to separate left/right metadata
    doc.line(105, 18, 105, 36);
    
    // Horizontal lines
    doc.line(14, 24, 196, 24);
    doc.line(14, 30, 196, 30);

    doc.setFont("helvetica", "bold");
    doc.text(`Calculation No.:`, 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text(`Date:`, 107, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 120, 22);

    doc.setFont("helvetica", "bold");
    doc.text(`Project No.:`, 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text(`Client:`, 107, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 120, 28);

    doc.setFont("helvetica", "bold");
    doc.text(`Project Name:`, 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text(`End User:`, 107, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 125, 34);

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

        const oaAreaRate = data ? data.areaOA : 0.3;
        const oaPeopleRate = data ? data.peopleOA : 2.5;

        const totalFreshCalculated = Math.round(s.minOA ?? (effectiveArea * oaAreaRate + occCount * oaPeopleRate));
        const totalExtractCalculated = Math.round(s.minExt ?? 0);

        const freshAirGiven = Math.round(s.freshAir ?? totalFreshCalculated);
        const extractAirTaken = Math.round(s.extractAir ?? totalExtractCalculated);

        let extNo: string | number = (s as any).extractAirNumber ?? (data && data.exhaustPerUnit > 0 ? occCount : '-');
        let extStrat: string = (s as any).extractAirStrategy ?? (data && data.exhaustPerUnit > 0 ? 'L/s/unit' : 'L/s/m²');

        const catLower = (s.category || "").toLowerCase();
        if (catLower === "rest room / changing room") {
          const sub = s.restroomSubCategories || {};
          const sumSub = 
            (sub.toiletPrivateContinuous || 0) +
            (sub.toiletPublicContinuous || 0) +
            (sub.toiletPrivateDiscontinuous || 0) +
            (sub.toiletPublicDiscontinuous || 0) +
            (sub.showerContinuous || 0) +
            (sub.showerDiscontinuous || 0) +
            (sub.janitorCloset || 0) +
            (sub.lockerRoom || 0);

          if (sumSub > 0) {
            const val = totalExtractCalculated / sumSub;
            extNo = val % 1 === 0 ? val.toString() : val.toFixed(1);
            extStrat = 'L/s/unit';
          }
        } else if (catLower === "kitchen - commercial" || catLower === "kitchen - residential") {
          extNo = parseFloat(String((s as any).customAch || (data ? data.ach : 0)));
          extStrat = 'ACH';
        } else if (catLower === "ex. parking garages") {
          extNo = data ? parseFloat(String(data.exhaustPerArea)) : 3.7;
          extStrat = 'L/s/m²';
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
      startY: 42,
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
          { content: 'Balancing', colSpan: 2, styles: { fillColor: blueFill } }
        ],
        [
          { content: 'Space Floor' },
          { content: 'Space Name' },
          { content: 'Zone Name' },
          { content: 'Occupancy Category' },
          { content: 'Area\n(m²)' },
          { content: 'Fixtures/\nOcc.' },
          { content: 'OA Rate\n(L/s/m²)' },
          { content: 'OA Rate\n(L/s/p)' },
          { content: 'Total Fresh\n(L/s)' },
          { content: 'Ext. Air\nNumber' },
          { content: 'Ext. Air\nStrategy' },
          { content: 'Total Ext.\n(L/s)' },
          { content: 'Fresh Air\nGiven (L/s)', styles: { fillColor: blueFill } },
          { content: 'Extract Air\nTaken (L/s)', styles: { fillColor: blueFill } }
        ]
      ],
      body: body,
      didParseCell: function(data: any) {
        const rawRow = data.row.raw;
        if (data.section === 'body') {
          const isTotalRow = rawRow && (rawRow._isFloorTotal || rawRow._isGrandTotal);
          if (isTotalRow) {
            data.cell.styles.fontStyle = 'bold';
            // Highlight Fresh Air Given (col 13) and Extract Air Taken (col 14) in column header grey
            if (data.column.index === 13 || data.column.index === 14) {
              data.cell.styles.fillColor = primaryFill;
            }
          } else if (data.column.index === 13 || data.column.index === 14) {
            data.cell.styles.fillColor = [242, 248, 253]; // Light blue for standard body balancing cells
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
    
    const finalY = (doc as any).lastAutoTable?.finalY ?? 150;

    const {
      originatedName,
      originatedDate,
      reviewerName,
      reviewerDate,
      approverName,
      approverDate
    } = getSignatureBlockDetails(activeProj?.id || "default", "/ventilation", meta.userName || "");

    callAutoTable(doc, {
      startY: finalY + 8,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { fontSize: 8, halign: 'center', valign: 'middle', lineColor: [100, 100, 100], lineWidth: 0.1, cellPadding: { top: 2, bottom: 2, left: 1, right: 1 } },
      headStyles: { fillColor: [255, 230, 204], textColor: 0, fontStyle: 'bold' },
      head: [
        [
          { content: '' },
          { content: 'Originated by' },
          { content: 'Reviewed by' },
          { content: 'Approved by' }
        ]
      ],
      body: [
        [
          { content: 'Name:', styles: { fontStyle: 'bold', halign: 'right' } },
          { content: originatedName, styles: { halign: 'center' } },
          { content: reviewerName, styles: { halign: 'center' } },
          { content: approverName, styles: { halign: 'center' } }
        ],
        [
          { content: 'Date:', styles: { fontStyle: 'bold', halign: 'right' } },
          { content: originatedDate, styles: { halign: 'center' } },
          { content: reviewerDate, styles: { halign: 'center' } },
          { content: approverDate, styles: { halign: 'center' } }
        ]
      ],
      columnStyles: {
        0: { cellWidth: 32 },
        1: { cellWidth: 50 },
        2: { cellWidth: 50 },
        3: { cellWidth: 50 },
      }
    });

    const pdfBuffer = doc.output('arraybuffer');
    await downloadFile(new Uint8Array(pdfBuffer), `Ventilation_Report_${activeProj?.code || 'P000'}.pdf`, 'PDF Document', ['pdf']);
    toast.success("Ventilation PDF exported successfully!");
  } catch (error: any) {
    console.error("exportVentilationPDF error:", error);
    toast.error(`Export PDF failed: ${error?.message || String(error)}`);
  }
};

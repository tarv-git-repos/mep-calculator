import { addPdfSignatureBlock, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { workspaceStore } from './workspace-store';
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

export const exportDischargeUnitPDF = async (
  spaces: any[],
  calculations: any,
  meta: ProjectMetaData = {}
) => {
  try {
    const activeProj: any = workspaceStore.getState()?.project || {};

    const JsPDFClass = typeof jsPDF === 'function' ? jsPDF : (jsPDF as any).default;
    // A4 Landscape Mode
    const doc = new JsPDFClass('landscape', 'mm', 'a4');

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
    doc.text('Plumbing Discharge Unit Calculation Report', 14, 14);

    // Metadata Block for Landscape Mode (269mm width: left 14mm to right 283mm)
    doc.setFontSize(9);
    doc.setLineWidth(0.3);
    doc.rect(14, 18, 269, 18); // Outer box for metadata

    // Vertical line to separate left/right metadata
    doc.line(148, 18, 148, 36);
    
    // Horizontal lines
    doc.line(14, 24, 283, 24);
    doc.line(14, 30, 283, 30);

    doc.setFont("helvetica", "bold");
    doc.text(`Calculation No.:`, 16, 22);
    doc.setFont("helvetica", "normal");
    doc.text(calcNo, 45, 22);

    doc.setFont("helvetica", "bold");
    doc.text(`Date:`, 150, 22);
    doc.setFont("helvetica", "normal");
    doc.text(today, 163, 22);

    doc.setFont("helvetica", "bold");
    doc.text(`Project No.:`, 16, 28);
    doc.setFont("helvetica", "normal");
    doc.text(projectNo, 40, 28);

    doc.setFont("helvetica", "bold");
    doc.text(`Client:`, 150, 28);
    doc.setFont("helvetica", "normal");
    doc.text(clientName, 163, 28);

    doc.setFont("helvetica", "bold");
    doc.text(`Project Name:`, 16, 34);
    doc.setFont("helvetica", "normal");
    doc.text(projectName, 42, 34);

    doc.setFont("helvetica", "bold");
    doc.text(`End User:`, 150, 34);
    doc.setFont("helvetica", "normal");
    doc.text(endUser, 168, 34);

    // Group spaces by floor
    const sortedSpaces = [...spaces].sort((a, b) => {
      const floorA = (a.floor || 'GF').toLowerCase();
      const floorB = (b.floor || 'GF').toLowerCase();
      if (floorA !== floorB) return floorA.localeCompare(floorB);
      const nameA = (a.desc || '').toLowerCase();
      const nameB = (b.desc || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    const spacesByFloor: { [floor: string]: any[] } = {};
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
    
    floorOrder.forEach((floorName) => {
      const floorSpaces = spacesByFloor[floorName];
      let floorBlackTotal = 0;
      let floorGreyTotal = 0;
      let floorTotalDU = 0;

      floorSpaces.forEach((s) => {
        const spaceBlack = calculations.spaceBlackTotals[s.id] || 0;
        const spaceGrey = calculations.spaceGreyTotals[s.id] || 0;
        const spaceTotal = calculations.spaceTotals[s.id] || 0;
        
        floorBlackTotal += spaceBlack;
        floorGreyTotal += spaceGrey;
        floorTotalDU += spaceTotal;

        body.push([
          floorName,
          s.desc || '-',
          s.fixtures?.wc || '-',
          s.fixtures?.urinal || '-',
          s.fixtures?.basin || '-',
          s.fixtures?.bath || '-',
          s.fixtures?.shower || '-',
          s.fixtures?.sink || '-',
          s.fixtures?.bibtap || '-',
          s.fixtures?.laundry || '-',
          s.fixtures?.catchbasin || '-',
          spaceBlack.toFixed(1),
          spaceGrey.toFixed(1),
          spaceTotal.toFixed(1)
        ]);
      });

      // Floor summary row
      const floorTotalRow = [
        { content: `Total for ${floorName}`, colSpan: 11, styles: { fontStyle: 'bold', halign: 'right', fillColor: [240, 240, 240] } },
        { content: floorBlackTotal.toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: floorGreyTotal.toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } },
        { content: floorTotalDU.toFixed(1), styles: { fontStyle: 'bold', fillColor: [240, 240, 240] } }
      ];
      (floorTotalRow as any)._isFloorTotal = true;
      body.push(floorTotalRow);
    });

    // Grand totals row
    const grandTotalRow = [
      { content: `GRAND TOTAL`, colSpan: 11, styles: { fontStyle: 'bold', halign: 'right', fillColor: [220, 230, 241] } },
      { content: calculations.blackTotalDU.toFixed(1), styles: { fontStyle: 'bold', fillColor: [220, 230, 241] } },
      { content: calculations.greyTotalDU.toFixed(1), styles: { fontStyle: 'bold', fillColor: [220, 230, 241] } },
      { content: calculations.totalDU.toFixed(1), styles: { fontStyle: 'bold', fillColor: [220, 230, 241] } }
    ];
    (grandTotalRow as any)._isGrandTotal = true;
    body.push(grandTotalRow);

    // Summary Flow row
    const flowRow = [
      { content: `PEAK DEMAND FLOW RATE:`, colSpan: 11, styles: { fontStyle: 'bold', halign: 'right', fillColor: [220, 230, 241] } },
      { content: calculations.displayFlow, colSpan: 3, styles: { fontStyle: 'bold', halign: 'center', fillColor: [220, 230, 241] } },
    ];
    (flowRow as any)._isGrandTotal = true;
    body.push(flowRow);

    const primaryFill = [217, 217, 217] as [number, number, number]; // Gray for standard space & fixture headers
    const blueFill = [218, 233, 248] as [number, number, number];    // Blue for Discharge Unit result headers

    callAutoTable(doc, {
      startY: 42,
      margin: { left: 14, right: 14, top: 14, bottom: 20 },
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: { top: 2, bottom: 2, left: 1, right: 1 },
        halign: 'center',
        valign: 'middle',
        lineColor: [100, 100, 100],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: primaryFill,
        textColor: [0, 0, 0],
        fontSize: 7.5,
        fontStyle: 'bold',
        halign: 'center',
        valign: 'middle'
      },
      head: [
        [
          { content: 'Space Parameters & Fixture Schedule', colSpan: 11, styles: { fillColor: primaryFill } },
          { content: 'Discharge Units (D.U.)', colSpan: 3, styles: { fillColor: blueFill } }
        ],
        [
          { content: 'Floor', styles: { fillColor: primaryFill } },
          { content: 'Space / Description', styles: { fillColor: primaryFill } },
          { content: 'WC', styles: { fillColor: primaryFill } },
          { content: 'Urinal', styles: { fillColor: primaryFill } },
          { content: 'Basin', styles: { fillColor: primaryFill } },
          { content: 'Bath', styles: { fillColor: primaryFill } },
          { content: 'Shower', styles: { fillColor: primaryFill } },
          { content: 'Sink', styles: { fillColor: primaryFill } },
          { content: 'BIB TAP', styles: { fillColor: primaryFill } },
          { content: 'Laundry', styles: { fillColor: primaryFill } },
          { content: 'Catch\nBasin', styles: { fillColor: primaryFill } },
          { content: 'Black Water\n(D.U.)', styles: { fillColor: blueFill } },
          { content: 'Grey Water\n(D.U.)', styles: { fillColor: blueFill } },
          { content: 'Total\n(D.U.)', styles: { fillColor: blueFill } }
        ]
      ],
      body: body,
      columnStyles: {
        0: { halign: 'center', cellWidth: 16 },  // Floor
        1: { halign: 'left', cellWidth: 50 },    // Space / Description
        2: { cellWidth: 15 },                     // WC
        3: { cellWidth: 15 },                     // Urinal
        4: { cellWidth: 15 },                     // Basin
        5: { cellWidth: 15 },                     // Bath
        6: { cellWidth: 15 },                     // Shower
        7: { cellWidth: 15 },                     // Sink
        8: { cellWidth: 15 },                     // BIB TAP
        9: { cellWidth: 16 },                     // Laundry
        10: { cellWidth: 16 },                    // Catch Basin
        11: { cellWidth: 22, fontStyle: 'bold', textColor: [153, 0, 0], fillColor: [242, 248, 253] },  // Black DU
        12: { cellWidth: 22, fontStyle: 'bold', textColor: [0, 102, 0], fillColor: [242, 248, 253] },   // Grey DU
        13: { cellWidth: 22, fontStyle: 'bold', textColor: [0, 0, 153], fillColor: [242, 248, 253] },   // Total DU
      },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          const rawRow = data.row.raw;
          const isTotalRow = rawRow && (rawRow._isFloorTotal || rawRow._isGrandTotal);
          if (isTotalRow) {
            data.cell.styles.fontStyle = 'bold';
            if (rawRow._isFloorTotal) {
              data.cell.styles.fillColor = [240, 240, 240];
            } else if (rawRow._isGrandTotal) {
              data.cell.styles.fillColor = [220, 230, 241];
            }
          }
        }
      },
      didDrawPage: (data: any) => {
        const pageSize = doc.internal.pageSize;
        const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight();
        
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        const userStr = `Generated by: ${meta.userName || 'User'}`;
        const timestamp = new Date().toLocaleString();
        
        doc.text(userStr, 14, pageHeight - 10);
        doc.text(`Date & Time: ${timestamp}`, 100, pageHeight - 10);
        
        const pageStr = `Page ${doc.internal.getNumberOfPages()}`;
        doc.text(pageStr, pageSize.getWidth() - 14 - doc.getTextWidth(pageStr), pageHeight - 10);
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const signatureDetails = getSignatureBlockDetails(
      activeProj?.id || "default", 
      "/plumbing-discharge-unit", 
      meta.userName || ""
    );
    
    addPdfSignatureBlock(
      doc, 
      finalY, 
      signatureDetails,
      activeProj?.id || "default",
      "/plumbing-discharge-unit",
      { left: 14, right: 14 } // Landscape margins
    );

    const safeProj = projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalFilename = `discharge_unit_report_${safeProj || 'calc'}.pdf`;
    
    doc.save(finalFilename);

  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
};

const fs = require('fs');
const path = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';

let content = fs.readFileSync(path, 'utf8');

// Replace handleExport
const oldExport = `  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sump Pump');
    ws.columns = [
      { header: 'Parameter', key: 'param', width: 30 },
      { header: 'Value', key: 'val', width: 15 },
      { header: 'Unit', key: 'unit', width: 10 },
      { header: 'Formula', key: 'form', width: 30 }
    ];
    ws.addRow(['Sump Pump Sizing & Motor Calculation', '', '', '']);
    ws.addRow(['']);
    
    const rows = [
      ['Sump Volumetric Req', req, 'L', ''],
      ['Req Drawdown Time', time, 'Hours', ''],
      ['Calc Flow Rate', calcResults.Q_flow.toFixed(2), 'L/s', 'Volume / Time'],
      ['Pit Flow', pitFlow, 'L/s', ''],
      ['Pit Hold', pitHold, 'min', ''],
      ['Pit Volume Req', calcResults.pitVol.toFixed(2), 'm³', ''],
      ['Pipe Invert', calcResults.invertVal.toFixed(2), 'm', ''],
      ['Pit Depth', calcResults.propDepth.toFixed(2), 'm', ''],
      ['Total Equiv Length', calcResults.L_equiv.toFixed(2), 'm', ''],
      ['Friction Loss', calcResults.H_loss.toFixed(3), 'bar', ''],
      ['TDH Req', calcResults.H_pump_calc.toFixed(3), 'bar', ''],
      ['Motor Power', calcResults.P_motor.toFixed(2), 'kW', ''],
      ['Motor HP', calcResults.HP.toFixed(2), 'HP', '']
    ];
    rows.forEach(r => ws.addRow(r));
    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), 'Sump_Pump_Report.xlsx');
  };`;

const newExport = `  const handleExport = () => {
    try {
      const isSI = unitSystem === "si";
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        } else {
          console.error("autoTable function not available");
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-SMP-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Sump Pump Station";
      const clientName = project?.client || "";
      const endUser = (project as any)?.endUser || (project as any)?.location || "";

      // Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Sump Pump Sizing Calculation Report", 14, 13);

      // Metadata Block
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17); // Outer box for metadata
      doc.line(105, 16, 105, 33);
      doc.line(14, 21.7, 196, 21.7);
      doc.line(14, 27.4, 196, 27.4);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 45, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 107, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 127, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 16, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 35, 31.6);

      doc.setFont("helvetica", "bold");
      doc.text("End User / Loc.:", 107, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(endUser, 133, 31.6);

      // Parameters Table
      const GPM_TO_LPS = 0.06309;
      const PSI_TO_BAR = 0.0689476;
      const FT_TO_M = 0.3048;
      const GAL_TO_M3 = 0.00378541;
      const GAL_TO_L = 3.78541;

      const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
      const flowUnit = isSI ? "L/s" : "GPM";
      const pitV = isSI ? calcResults.pitVol : calcResults.pitVol / GAL_TO_M3;
      const pitVUnit = isSI ? "m³" : "Gal";
      const h_loss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
      const l_equiv = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
      const l_unit = isSI ? "m" : "ft";
      const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
      const tdhUnit = isSI ? "bar" : "psi";

      const tableData = [
        ["Required Volume", isSI ? req : typeof req === "number" ? req / GAL_TO_L : "", isSI ? "L" : "Gal", "Input"],
        ["Drawdown Time", time, "Hrs", "Input"],
        ["Calculated Flow Rate", flow.toFixed(2), flowUnit, "Volume / Time"],
        ["Pit Storage Volume", pitV.toFixed(2), pitVUnit, "Pit Flow x Hold"],
        ["Total Equivalent Length", l_equiv.toFixed(2), l_unit, "Pipe + Fittings"],
        ["Friction Loss", h_loss.toFixed(3), tdhUnit, "Hazen Williams"],
        ["Total Dynamic Head (TDH)", tdh.toFixed(3), tdhUnit, "Static + Friction + Residual"],
        ["Motor Power", isSI ? calcResults.P_motor.toFixed(2) : calcResults.HP.toFixed(2), isSI ? "kW" : "HP", "Power Equation"]
      ];

      callAutoTable(doc, {
        startY: 38,
        head: [["Parameter", "Value", "Unit", "Source / Formula"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: "bold", halign: "center" },
        bodyStyles: { fontSize: 8.5, textColor: 50 },
        columnStyles: {
          0: { cellWidth: 55, fontStyle: "bold" },
          1: { cellWidth: 35, halign: "center", fontStyle: "bold", textColor: [0, 0, 0] },
          2: { cellWidth: 25, halign: "center" },
          3: { cellWidth: "auto" }
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        styles: { cellPadding: 2.5, lineColor: [200, 200, 200], lineWidth: 0.1 }
      });

      // Signature Block
      try {
        const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 200;
        const pageHeight = doc.internal.pageSize.getHeight();
        if (finalY + 45 > pageHeight) {
          doc.addPage();
          getSignatureBlockDetails(doc, 20, project, user, "Mechanical Designer", "Design Engineer");
        } else {
          getSignatureBlockDetails(doc, finalY + 15, project, user, "Mechanical Designer", "Design Engineer");
        }
      } catch (e) {
        console.error("Signature block failed", e);
      }

      doc.save(\`Sump_Pump_Report_\${calcNo}_\${Date.now()}.pdf\`);
    } catch (err: any) {
      console.error("Export Error:", err);
      alert("Failed to export PDF: " + err.message);
    }
  };`;

content = content.replace(oldExport, newExport);

const oldText = `<p className="text-muted-foreground text-sm max-w-md text-center mb-6">
                    Review the full sizing report and export it as an Excel spreadsheet for your records.
                  </p>
                  <TBtn size="lg" onClick={handleExport} className="font-bold shadow-md bg-primary text-primary-foreground hover:bg-primary/90">
                    <Download className="w-5 h-5 mr-2" />
                    Download Excel Report
                  </TBtn>`;

const newText = `<p className="text-muted-foreground text-sm max-w-md text-center mb-6">
                    Review the full sizing report and export it as a PDF for your records.
                  </p>
                  <TBtn size="lg" onClick={handleExport} className="font-bold shadow-md bg-primary text-primary-foreground hover:bg-primary/90">
                    <FileText className="w-5 h-5 mr-2" />
                    Download PDF Report
                  </TBtn>`;

content = content.replace(oldText, newText);

fs.writeFileSync(path, content, 'utf8');
console.log('PDF export injected');

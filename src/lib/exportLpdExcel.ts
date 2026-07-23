import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { LpdProject } from '../routes/lpd-calculation';

const getColLetter = (colIndex: number) => {
  let temp, letter = '';
  while (colIndex > 0) {
    temp = (colIndex - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    colIndex = (colIndex - temp - 1) / 26;
  }
  return letter;
};

const getBorder = (r: number, c: number, lastR: number, lastC: number): Partial<ExcelJS.Borders> => {
  return {
    top: { style: r === 1 ? 'double' : 'thin' },
    bottom: { style: r === lastR ? 'double' : 'thin' },
    left: { style: c === 1 ? 'double' : 'thin' },
    right: { style: c === lastC ? 'double' : 'thin' }
  };
};

export const exportLpdExcel = async (project: LpdProject) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("LPD", {
    views: [{ showGridLines: false }]
  });

  const activeGroups = project.type === "Internal" ? project.internalGroups : project.externalGroups;
  let maxFixtures = 1; // Dynamically scale based on actual usage instead of forcing 3
  activeGroups.forEach(g => {
    g.spaces.forEach(s => {
      if (s.fixtures.length > maxFixtures) maxFixtures = s.fixtures.length;
    });
  });

  const lastColIdx = 2 + (maxFixtures * 3) + 6;

  // Calculate total rows
  let totalRows = 4; // headers and meta
  activeGroups.forEach(g => {
    totalRows++; // Group row
    totalRows += g.spaces.length; // Space rows
  });

  const baseFont = { name: 'Cambria', size: 11, family: 1 };
  const boldFont = { ...baseFont, bold: true };

  // Set Row Heights
  sheet.getRow(1).height = 24.95;
  sheet.getRow(2).height = 24.95;
  sheet.getRow(3).height = 24.95;
  sheet.getRow(4).height = 60.75;
  for (let r = 5; r <= totalRows; r++) {
    sheet.getRow(r).height = 30; // Data rows
  }

  // Set Column Widths (matching template)
  sheet.getColumn(1).width = 12; // S.NO
  sheet.getColumn(2).width = 37.14; // AREA
  
  let colIdx = 3;
  for (let i = 0; i < maxFixtures; i++) {
    sheet.getColumn(colIdx++).width = 13.43; // LIGHT TYPE
    sheet.getColumn(colIdx++).width = 11.86; // WATTS
    sheet.getColumn(colIdx++).width = 10.14; // NO OF LIGHTS
  }
  
  sheet.getColumn(colIdx++).width = 13.14; // TOTAL WATTAGE
  sheet.getColumn(colIdx++).width = 13.14; // SQ.M
  sheet.getColumn(colIdx++).width = 14.00; // SQ.F (increased from 9.57)
  sheet.getColumn(colIdx++).width = 12.29; // DENSITY
  sheet.getColumn(colIdx++).width = 15.43; // LPD AS PER AUTHORITY
  sheet.getColumn(colIdx++).width = 25.43; // REMARKS

  // Apply default styles (borders and font) to the entire grid region
  for (let r = 1; r <= totalRows; r++) {
    for (let c = 1; c <= lastColIdx; c++) {
      const cell = sheet.getCell(r, c);
      cell.font = baseFont;
      cell.border = getBorder(r, c, totalRows, lastColIdx);
    }
  }

  // Meta block Row 1
  sheet.mergeCells(`A1:B1`);
  sheet.getCell('A1').value = `Calculation No: ${project.calculationNo || ""}   Rev. No: ${project.revNo || ""}`;
  sheet.getCell('A1').font = boldFont;
  sheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.mergeCells(`C1:${getColLetter(lastColIdx)}1`);
  sheet.getCell('C1').value = `Date       : ${project.date || ""}`;
  sheet.getCell('C1').font = boldFont;
  sheet.getCell('C1').alignment = { horizontal: 'left', vertical: 'middle' };

  // Meta block Row 2
  sheet.mergeCells(`A2:B2`);
  sheet.getCell('A2').value = `Project No      : ${project.projectNo || ""}`;
  sheet.getCell('A2').font = boldFont;
  sheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.mergeCells(`C2:${getColLetter(lastColIdx)}2`);
  sheet.getCell('C2').value = `Client     : ${project.client || ""}`;
  sheet.getCell('C2').font = boldFont;
  sheet.getCell('C2').alignment = { horizontal: 'left', vertical: 'middle' };

  // Meta block Row 3
  sheet.mergeCells(`A3:B3`);
  sheet.getCell('A3').value = `Project Name : ${project.name || ""}`;
  sheet.getCell('A3').font = boldFont;
  sheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.mergeCells(`C3:${getColLetter(lastColIdx)}3`);
  sheet.getCell('C3').value = `End User : ${project.endUser || ""}`;
  sheet.getCell('C3').font = boldFont;
  sheet.getCell('C3').alignment = { horizontal: 'left', vertical: 'middle' };

  // Headers (Row 4)
  const headers = ['S.NO.', 'AREA'];
  for (let i = 1; i <= maxFixtures; i++) {
    headers.push('LIGHT TYPE', 'WATTS', 'NO. OF LIGHTS');
  }
  headers.push(
    ' TOTAL WATTAGE',
    'SQ. M AREA',
    'SQ. F AREA',
    'DENSITY W/SQ.M',
    'LPD AS PER AUTHORITY UNDER JURISDICTION',
    'REMARKS'
  );

  const headerRow = sheet.getRow(4);
  headers.forEach((h, idx) => {
    const c = idx + 1;
    const cell = headerRow.getCell(c);
    cell.value = h;
    cell.font = boldFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    // Set grey background color matching template
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9D9D9' } };
  });

  // Data population
  let currentRow = 5;
  let globalSrNo = 1;

  activeGroups.forEach(group => {
    // Group row
    const gRow = sheet.getRow(currentRow);
    gRow.getCell(2).value = group.name;
    gRow.getCell(2).font = { ...boldFont, color: { argb: 'FF0070C0' } };
    gRow.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    currentRow++;

    // Spaces
    group.spaces.forEach(space => {
      const row = sheet.getRow(currentRow);
      row.getCell(1).value = globalSrNo++;
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      
      // Since TYPE OF AREA is removed, include it in AREA or just leave as is. User wanted it exact, so we'll just put name. 
      // If areaType is selected, append it in brackets to preserve data!
      let spaceStr = space.name;
      if (space.areaType) {
         spaceStr += `\n(${space.areaType.replace(/\b\w/g, l => l.toUpperCase())})`;
      }
      row.getCell(2).value = spaceStr;
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

      let cIdx = 3;
      for (let i = 0; i < maxFixtures; i++) {
        const fixture = space.fixtures[i];
        if (fixture) {
          row.getCell(cIdx).value = fixture.type || "";
          row.getCell(cIdx + 1).value = fixture.watts ? parseFloat(String(fixture.watts)) : null;
          row.getCell(cIdx + 2).value = fixture.qty ? parseFloat(String(fixture.qty)) : null;
        }
        
        row.getCell(cIdx).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        row.getCell(cIdx + 1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(cIdx + 2).alignment = { horizontal: 'center', vertical: 'middle' };
        cIdx += 3;
      }

      // Calculate results in JS to ensure they display immediately even in Protected View
      let calculatedTotalWatts = 0;
      for (let i = 0; i < maxFixtures; i++) {
        const fixture = space.fixtures[i];
        if (fixture) {
          calculatedTotalWatts += (parseFloat(String(fixture.watts)) || 0) * (parseFloat(String(fixture.qty)) || 0);
        }
      }
      const calculatedSqM = space.areaSqM ? parseFloat(String(space.areaSqM)) : 0;
      const calculatedSqF = calculatedSqM * 10.764;
      const calculatedDensity = calculatedSqM > 0 ? calculatedTotalWatts / calculatedSqM : 0;
      const baselineLpd = space.baselineLpd ? parseFloat(String(space.baselineLpd)) : 0;

      // Assign calculated values directly to cells to ensure they are visible in all Excel viewers
      row.getCell(cIdx).value = calculatedTotalWatts;
      row.getCell(cIdx + 1).value = calculatedSqM;
      row.getCell(cIdx + 2).value = calculatedSqF;
      row.getCell(cIdx + 3).value = calculatedDensity;
      row.getCell(cIdx + 4).value = baselineLpd;
      row.getCell(cIdx + 5).value = space.remarks || "";
      
      // Formatting
      [cIdx, cIdx + 1, cIdx + 2, cIdx + 3, cIdx + 4, cIdx + 5].forEach(c => {
        row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      
      row.getCell(cIdx).numFmt = '0.00';
      row.getCell(cIdx + 1).numFmt = '0.00';
      row.getCell(cIdx + 2).numFmt = '0.00';
      row.getCell(cIdx + 3).numFmt = '0.0000';
      row.getCell(cIdx + 4).numFmt = '0.0000';

      currentRow++;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buffer]), `LPD Calculation - ${project.type} Area.xlsx`);
};

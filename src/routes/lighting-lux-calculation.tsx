import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { Plus, Download, Trash, Copy, Trash2, X, Database } from "lucide-react";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

export const Route = createFileRoute("/lighting-lux-calculation")({
  head: () => ({
    meta: [
      { title: "Lighting LUX Calculation — MEP Calc" },
      { name: "description", content: "Calculate Lighting LUX requirements" },
    ],
  }),
  component: LightingLuxCalculationPage,
});

interface LuxRow {
  id: string;
  location: string;
  lightType: string;
  ipRating: string;
  length: number;
  width: number;
  height: number;
  roomIndex: number;
  area: number;
  reqLux: number;
  lumen: number;
  mf: number;
  uf: number;
  reqQty: number;
  remarks: string;
}

// Helper to compute calculated fields
function computeRowOutputs(row: LuxRow): LuxRow {
  const L = row.length || 0;
  const W = row.width || 0;
  const H = row.height || 0; // Mounting Height
  
  const area = L * W;
  let roomIndex = 0;
  if (H > 0 && (L + W) > 0) {
    roomIndex = (L * W) / (H * (L + W));
  }

  const LL = row.reqLux || 0;
  const lumen = row.lumen || 0;
  const mf = row.mf || 0;
  const uf = row.uf || 0;
  
  let reqQty = 0;
  if (lumen > 0 && mf > 0 && uf > 0) {
    reqQty = Math.ceil((LL * area) / (lumen * mf * uf));
  }

  return {
    ...row,
    area: parseFloat(area.toFixed(2)),
    roomIndex: parseFloat(roomIndex.toFixed(2)),
    reqQty: reqQty
  };
}

const DEFAULT_ROWS: LuxRow[] = [];

// Helper to push history state
function pushToHistory(
  current: LuxRow[], 
  history: LuxRow[][], 
  setHistory: React.Dispatch<React.SetStateAction<LuxRow[][]>>,
  setRedoStack?: React.Dispatch<React.SetStateAction<LuxRow[][]>>
) {
  const next = [...history, current].slice(-50); // Keep last 50 states
  setHistory(next);
  if (setRedoStack) {
    setRedoStack([]);
  }
}

function LightingLuxCalculationPage() {
  const { project } = useWorkspace();
  const confirm = useConfirm();

  const [rows, setRows] = useState<LuxRow[]>(DEFAULT_ROWS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string | undefined>();
  const [history, setHistory] = useState<LuxRow[][]>([]);
  const [redoStack, setRedoStack] = useState<LuxRow[][]>([]);

  // Helper to update a row
  const updateRow = (id: string, updates: Partial<LuxRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    // If the edited row is currently selected, and multiple are selected, apply to all
    const targetIds = (selected.has(id) && selected.size > 1) ? selected : new Set([id]);

    setRows(prev => prev.map(r => {
      if (!targetIds.has(r.id)) return r;
      const updated = { ...r, ...updates };
      return computeRowOutputs(updated);
    }));
  };

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && lastSelectedId) {
        const lastIdx = rows.findIndex(r => r.id === lastSelectedId);
        const currentIdx = rows.findIndex(r => r.id === id);
        if (lastIdx !== -1 && currentIdx !== -1) {
          if (!isCtrl) next.clear();
          const start = Math.min(lastIdx, currentIdx);
          const end = Math.max(lastIdx, currentIdx);
          for (let i = start; i <= end; i++) {
            next.add(rows[i].id);
          }
        }
      } else if (next.has(id)) {
        if (!isCtrl && !isShift && next.size > 1) {
          // If clicking an already selected row without modifiers, but multiple are selected,
          // clear others and just select this one.
          next.clear();
          next.add(id);
        } else {
          next.delete(id);
        }
      } else {
        if (!isCtrl && !isShift) {
          next.clear();
        }
        next.add(id);
      }
      return next;
    });
    setLastSelectedId(id);
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const addRow = () => {
    const newId = `lux_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: LuxRow = {
      id: newId,
      location: "",
      lightType: "",
      ipRating: "",
      length: 0,
      width: 0,
      height: 0,
      roomIndex: 0,
      area: 0,
      reqLux: 0,
      lumen: 0,
      mf: 0,
      uf: 0,
      reqQty: 0,
      remarks: ""
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, computeRowOutputs(newRow)]);
    setSelected(new Set([newId]));
    setActiveRowId(newId);
  };

  const loadDummyData = () => {
    const dummy: LuxRow[] = [
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Manager Office", lightType: "LED Panel 600x600", ipRating: "IP20", length: 5, width: 4, height: 2.8, roomIndex: 0, area: 0, reqLux: 500, lumen: 3200, mf: 0.8, uf: 0.6, reqQty: 0, remarks: "Task lighting required" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Open Workspace", lightType: "Linear LED Surface", ipRating: "IP20", length: 15, width: 10, height: 3.2, roomIndex: 0, area: 0, reqLux: 400, lumen: 4500, mf: 0.75, uf: 0.65, reqQty: 0, remarks: "" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Meeting Room A", lightType: "LED Downlight 20W", ipRating: "IP44", length: 6, width: 4.5, height: 2.7, roomIndex: 0, area: 0, reqLux: 500, lumen: 2000, mf: 0.8, uf: 0.55, reqQty: 0, remarks: "Dimmable" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Corridor", lightType: "LED Downlight 12W", ipRating: "IP20", length: 20, width: 2, height: 2.5, roomIndex: 0, area: 0, reqLux: 150, lumen: 1200, mf: 0.7, uf: 0.5, reqQty: 0, remarks: "" },
      { id: `lux_${Math.random().toString(36).slice(2, 9)}`, location: "Pantry", lightType: "LED Panel 300x1200", ipRating: "IP44", length: 4, width: 3, height: 2.6, roomIndex: 0, area: 0, reqLux: 300, lumen: 2800, mf: 0.75, uf: 0.6, reqQty: 0, remarks: "" }
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...dummy.map(computeRowOutputs)]);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => prev.filter(r => !selected.has(r.id)));
      setSelected(new Set());
      setActiveRowId(undefined);
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    const duplicated: LuxRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `lux_dup_${Math.random().toString(36).slice(2, 9)}`,
          location: `${r.location} (Copy)`
        });
      }
    });
    setRows(prev => [...prev, ...duplicated]);
  };

  // Keyboard Navigation & Bulk Actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // Enter to blur/commit
      if (e.key === "Enter" && activeEl.tagName === "INPUT") {
        activeEl.blur();
        return;
      }

      // Escape to deselect all and blur
      if (e.key === "Escape") {
        activeEl?.blur();
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setActiveRowId(undefined);
        }
        return;
      }

      // Spreadsheet Navigation
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) && activeEl.tagName === "INPUT") {
        const rowIdxStr = activeEl.getAttribute("data-row-idx");
        const colIdxStr = activeEl.getAttribute("data-col-idx");
        if (rowIdxStr !== null && colIdxStr !== null) {
          let rIdx = parseInt(rowIdxStr);
          let cIdx = parseInt(colIdxStr);
          
          if (e.key === "ArrowUp") rIdx--;
          else if (e.key === "ArrowDown") rIdx++;
          else if (e.key === "ArrowLeft") cIdx--;
          else if (e.key === "ArrowRight") cIdx++;

          const nextInput = document.querySelector(`input[data-row-idx="${rIdx}"][data-col-idx="${cIdx}"]`) as HTMLInputElement;
          if (nextInput) {
            e.preventDefault();
            nextInput.focus();
            setTimeout(() => nextInput.select(), 0);
          }
          return;
        }
      }

      // If typing in input, don't trigger bulk actions
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      if (isInput) return;

      // Select All: Ctrl + A
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(rows.map(r => r.id)));
      }

      // Undo: Ctrl + Z
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (history.length > 0) {
          const prev = history[history.length - 1];
          setHistory(h => h.slice(0, h.length - 1));
          setRedoStack(r => [...r, rows]);
          setRows(prev);
        }
      }

      // Redo: Ctrl + Y or Ctrl + Shift + Z
      if (isCmdOrCtrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        if (redoStack.length > 0) {
          const nextState = redoStack[redoStack.length - 1];
          setRedoStack(r => r.slice(0, r.length - 1));
          setHistory(h => [...h, rows]);
          setRows(nextState);
        }
      }

      // Delete / Backspace
      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      // Copy: Ctrl + C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_lux", JSON.stringify(toCopy));
      }

      // Cut: Ctrl + X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x" && selected.size > 0) {
        e.preventDefault();
        const toCopy = rows.filter(r => selected.has(r.id));
        localStorage.setItem("mep_clipboard_lux", JSON.stringify(toCopy));
        pushToHistory(rows, history, setHistory, setRedoStack);
        setRows(prev => prev.filter(r => !selected.has(r.id)));
        setSelected(new Set());
      }

      // Paste: Ctrl + V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        try {
          const clip = localStorage.getItem("mep_clipboard_lux");
          if (clip) {
            const parsed = JSON.parse(clip) as LuxRow[];
            const pasted = parsed.map((item, i) => ({
              ...item,
              id: `lux_paste_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 9)}`,
              location: `${item.location} (Copy)`
            }));
            pushToHistory(rows, history, setHistory, setRedoStack);
            setRows(prev => [...prev, ...pasted]);
          }
        } catch (err) {}
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, history]);

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: LuxRow[] = mappedRows.map((mr, idx) => ({
      id: `lux_import_${Date.now()}_${idx}`,
      location: mr.location || "",
      lightType: mr.lightType || "",
      ipRating: mr.ipRating || "",
      length: Number(mr.length) || 0,
      width: Number(mr.width) || 0,
      height: Number(mr.height) || 0,
      roomIndex: 0,
      area: 0,
      reqLux: Number(mr.reqLux) || 0,
      lumen: Number(mr.lumen) || 0,
      mf: Number(mr.mf) || 0.8,
      uf: Number(mr.uf) || 0.6,
      requiredFittings: 0,
      providedFittings: 0,
      achievedLux: 0,
      isPass: false,
    }));
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => [...prev, ...newRows]);
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Lighting Lux Calc");

    // Add Project Info Block (Rows 1-3)
    worksheet.mergeCells("A1:I1");
    worksheet.mergeCells("J1:O1");
    worksheet.getCell("A1").value = "Calculation No: CEC-EED-PXXX-101   Rev. No:";
    worksheet.getCell("J1").value = "Date :";

    worksheet.mergeCells("A2:I2");
    worksheet.mergeCells("J2:O2");
    worksheet.getCell("A2").value = `Project No : ${project.code}`;
    worksheet.getCell("J2").value = "Client :";

    worksheet.mergeCells("A3:I3");
    worksheet.mergeCells("J3:O3");
    worksheet.getCell("A3").value = `Project Name : ${project.name}`;
    worksheet.getCell("J3").value = "End User :";

    // Style the metadata block
    for (let r = 1; r <= 3; r++) {
      const row = worksheet.getRow(r);
      row.height = 22;
      for (let c = 1; c <= 15; c++) {
        const cell = worksheet.getCell(r, c);
        cell.font = { bold: true, name: "Arial", size: 10 };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } }
        };
      }
    }

    // Define headers (Row 4)
    const headers = [
      "Sr. No.", "Location", "Type of Light", "IP RATING", 
      "Length (L)\nmtr.", "Width (W)\nmtr.", "Height (H)\nmtr.", 
      "Room Index\n(RI)", "Area (A)m²", "Req.Lux\nLevel (LL)", 
      "Lumen", "Maintenance\nFactor (M.F)", "Utility Factor\n(U.F)", 
      "Req. Light\nQTY.", "Remarks"
    ];

    const headerRow = worksheet.getRow(4);
    headerRow.values = headers;
    headerRow.height = 35;
    
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9D9D9" } // Light gray background
      };
      cell.font = { bold: true, name: "Arial", size: 9 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "000000" } },
        left: { style: "thin", color: { argb: "000000" } },
        bottom: { style: "thin", color: { argb: "000000" } },
        right: { style: "thin", color: { argb: "000000" } }
      };
    });

    // Add Data Rows
    rows.forEach((r, i) => {
      const row = worksheet.addRow([
        i + 1,
        r.location,
        r.lightType,
        r.ipRating,
        r.length,
        r.width,
        r.height,
        r.roomIndex,
        r.area,
        r.reqLux,
        r.lumen,
        r.mf,
        r.uf,
        r.reqQty,
        r.remarks
      ]);

      row.eachCell((cell) => {
        cell.font = { name: "Arial", size: 10 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = {
          top: { style: "thin", color: { argb: "000000" } },
          left: { style: "thin", color: { argb: "000000" } },
          bottom: { style: "thin", color: { argb: "000000" } },
          right: { style: "thin", color: { argb: "000000" } }
        };
      });
    });

    let currentRow = worksheet.rowCount + 1;

    // Reference Block
    for (let r = 0; r < 3; r++) {
      const rIdx = currentRow + r;
      worksheet.getRow(rIdx).height = 20;
      for (let c = 1; c <= 15; c++) {
        worksheet.getCell(rIdx, c).border = {
          left: c === 1 ? { style: "thin", color: { argb: "000000" } } : undefined,
          right: c === 15 ? { style: "thin", color: { argb: "000000" } } : undefined,
          top: r === 0 ? { style: "thin", color: { argb: "000000" } } : undefined,
          bottom: r === 2 ? { style: "thin", color: { argb: "000000" } } : undefined
        };
      }
      worksheet.mergeCells(rIdx, 1, rIdx, 15);
    }
    
    worksheet.getCell(currentRow, 1).value = "  Reference: 1. Architectural Drawings";
    worksheet.getCell(currentRow + 1, 1).value = "                    2. DBR";
    worksheet.getCell(currentRow + 2, 1).value = "                    3. Light Fitting/lamp data";
    
    for (let r = 0; r < 3; r++) {
       const cell = worksheet.getCell(currentRow + r, 1);
       cell.font = { name: "Arial", size: 9, bold: true };
       cell.alignment = { horizontal: "left", vertical: "middle" };
    }

    currentRow += 3;

    // Signature Block Header
    worksheet.getRow(currentRow).height = 25;
    const orangeFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFCD5B4" } // Light orange/peach
    } as ExcelJS.Fill;

    for(let c = 1; c <= 15; c++) {
        const cell = worksheet.getCell(currentRow, c);
        cell.fill = orangeFill;
        cell.border = {
            top: { style: "thin", color: { argb: "000000" } }, 
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } }, 
            right: { style: "thin", color: { argb: "000000" } }
        };
    }
    
    worksheet.mergeCells(currentRow, 1, currentRow, 3);
    worksheet.mergeCells(currentRow, 4, currentRow, 7);
    worksheet.mergeCells(currentRow, 8, currentRow, 11);
    worksheet.mergeCells(currentRow, 12, currentRow, 15);

    const sigCol4 = worksheet.getCell(currentRow, 4);
    sigCol4.value = "Originated by";
    const sigCol8 = worksheet.getCell(currentRow, 8);
    sigCol8.value = "Reviewed by";
    const sigCol12 = worksheet.getCell(currentRow, 12);
    sigCol12.value = "Approved by";

    [sigCol4, sigCol8, sigCol12].forEach(cell => {
      cell.font = { bold: true, name: "Arial", size: 10 };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    currentRow += 1;

    // Signature Block Rows (Name, Signature, Date)
    const labels = ["Name:", "Signature:", "Date:"];
    labels.forEach((label) => {
      worksheet.getRow(currentRow).height = 25;
      
      for(let c = 1; c <= 15; c++) {
          worksheet.getCell(currentRow, c).border = {
              top: { style: "thin", color: { argb: "000000" } }, 
              left: { style: "thin", color: { argb: "000000" } },
              bottom: { style: "thin", color: { argb: "000000" } }, 
              right: { style: "thin", color: { argb: "000000" } }
          };
      }

      worksheet.mergeCells(currentRow, 1, currentRow, 3);
      worksheet.mergeCells(currentRow, 4, currentRow, 7);
      worksheet.mergeCells(currentRow, 8, currentRow, 11);
      worksheet.mergeCells(currentRow, 12, currentRow, 15);

      const cellA = worksheet.getCell(currentRow, 1);
      cellA.value = `  ${label}`;
      cellA.font = { name: "Arial", size: 10, bold: true };
      cellA.alignment = { horizontal: "left", vertical: "middle" };

      currentRow += 1;
    });

    // Column Widths
    worksheet.getColumn(1).width = 8;
    worksheet.getColumn(2).width = 25;
    worksheet.getColumn(3).width = 20;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 12;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 12;
    worksheet.getColumn(9).width = 12;
    worksheet.getColumn(10).width = 12;
    worksheet.getColumn(11).width = 12;
    worksheet.getColumn(12).width = 14;
    worksheet.getColumn(13).width = 14;
    worksheet.getColumn(14).width = 12;
    worksheet.getColumn(15).width = 25;

    // Generate and save file
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `LUX_Calculation_${project.code}.xlsx`);
  };

  const columns: Column<LuxRow>[] = useMemo(() => [
    {
      key: "id",
      header: "Sr. No.",
      width: 70,
      align: "center",
      render: (row) => {
        const index = rows.findIndex(r => r.id === row.id) + 1;
        return <span className="text-muted-foreground">{index}</span>;
      }
    },
    {
      key: "location",
      header: "Location",
      width: 150,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.location}
            onChange={(e) => updateRow(row.id, { location: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={1}
          />
        );
      }
    },
    {
      key: "lightType",
      header: "Type of Light",
      width: 150,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.lightType}
            onChange={(e) => updateRow(row.id, { lightType: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={2}
          />
        );
      }
    },
    {
      key: "ipRating",
      header: "IP Rating",
      width: 100,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.ipRating}
            onChange={(e) => updateRow(row.id, { ipRating: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={3}
          />
        );
      }
    },
    {
      key: "length",
      header: "Length (L) m",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.length === 0 ? "" : row.length}
            onChange={(e) => updateRow(row.id, { length: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={4}
          />
        );
      }
    },
    {
      key: "width",
      header: "Width (W) m",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.width === 0 ? "" : row.width}
            onChange={(e) => updateRow(row.id, { width: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={5}
          />
        );
      }
    },
    {
      key: "height",
      header: "Height (H) m",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.height === 0 ? "" : row.height}
            onChange={(e) => updateRow(row.id, { height: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={6}
          />
        );
      }
    },
    {
      key: "roomIndex",
      header: "Room Index (RI)",
      width: 110,
      align: "right",
      render: (row) => <span className="text-blue-600 dark:text-blue-400 font-medium px-2">{row.roomIndex}</span>
    },
    {
      key: "area",
      header: "Area (m²)",
      width: 100,
      align: "right",
      render: (row) => <span className="font-medium px-2">{row.area}</span>
    },
    {
      key: "reqLux",
      header: "Req. Lux (LL)",
      width: 110,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.reqLux === 0 ? "" : row.reqLux}
            onChange={(e) => updateRow(row.id, { reqLux: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right font-medium text-amber-600 dark:text-amber-500 focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={9}
          />
        );
      }
    },
    {
      key: "lumen",
      header: "Lumen",
      width: 100,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            value={row.lumen === 0 ? "" : row.lumen}
            onChange={(e) => updateRow(row.id, { lumen: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={10}
          />
        );
      }
    },
    {
      key: "mf",
      header: "M.F",
      width: 80,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.1"
            value={row.mf === 0 ? "" : row.mf}
            onChange={(e) => updateRow(row.id, { mf: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={11}
          />
        );
      }
    },
    {
      key: "uf",
      header: "U.F",
      width: 80,
      align: "right",
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            type="number"
            step="0.1"
            value={row.uf === 0 ? "" : row.uf}
            onChange={(e) => updateRow(row.id, { uf: parseFloat(e.target.value) || 0 })}
            className="w-full h-full bg-transparent border-none outline-none px-2 text-right focus:bg-primary/5"
            data-row-idx={rowIdx}
            data-col-idx={12}
          />
        );
      }
    },
    {
      key: "reqQty",
      header: "Req. QTY",
      width: 90,
      align: "center",
      render: (row) => (
        <div className="h-full w-full flex items-center justify-center bg-green-500/10 text-green-700 dark:text-green-400 font-bold border-x border-green-500/20">
          {row.reqQty}
        </div>
      )
    },
    {
      key: "remarks",
      header: "Remarks",
      width: 200,
      render: (row) => {
        const rowIdx = rows.findIndex(r => r.id === row.id);
        return (
          <input 
            value={row.remarks}
            onChange={(e) => updateRow(row.id, { remarks: e.target.value })}
            className="w-full h-full bg-transparent border-none outline-none px-2 focus:bg-primary/5"
            autoComplete="off"
            data-row-idx={rowIdx}
            data-col-idx={14}
          />
        );
      }
    }
  ], [rows]);

  const renderContextMenu = (row: LuxRow) => {
    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => {
          const newRow = { ...row, id: `lux_${Math.random().toString(36).slice(2, 9)}` };
          pushToHistory(rows, history, setHistory);
          setRows(prev => {
            const idx = prev.findIndex(r => r.id === row.id);
            const next = [...prev];
            next.splice(idx + 1, 0, newRow);
            return next;
          });
        }}>
          <Copy className="size-4 mr-2" /> Duplicate Row
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => {
          pushToHistory(rows, history, setHistory);
          setRows(prev => prev.filter(r => r.id !== row.id));
          setSelected(prev => {
            const next = new Set(prev);
            next.delete(row.id);
            return next;
          });
        }} className="text-red-600 dark:text-red-400 focus:text-red-600">
          <Trash className="size-4 mr-2" /> Delete Row
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  return (
    <AppShell 
      title="Lighting LUX Calculation" 
      subtitle="Design and calculate lighting levels for different spaces"
      actions={
        <div className="flex gap-2">
          <ImportExcelBtn
            columnMapping={{
              "Location": "location",
              "Type of Light Fitting": "lightType",
              "IP Rating": "ipRating",
              "Length (L)": "length",
              "Width (W)": "width",
              "Height (H)": "height",
              "Required Lux Level": "reqLux",
              "Light Lumen": "lumen",
              "MF": "mf",
              "UF": "uf"
            }}
            onImport={handleImportExcelRows}
            className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors"
          />
          <button onClick={exportExcel} className="flex items-center gap-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded px-3 py-1.5 text-[12.5px] font-medium transition-colors">
            <Download className="size-3.5" /> Export Excel
          </button>
        </div>
      }
    >
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md shrink-0 select-none">
            <div className="flex items-center gap-2">
              <button 
                onClick={addRow}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[12.5px] font-medium shadow-sm transition-all"
              >
                <Plus className="size-3.5" /> Add Row
              </button>
              
              <div className="w-px h-4 bg-border mx-1" />
              
              <button 
                disabled={selected.size === 0}
                onClick={deleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 rounded text-[12.5px] font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                <Trash className="size-3.5" /> Delete Selected
              </button>

              <div className="w-px h-4 bg-border mx-1" />
              
              <button 
                onClick={loadDummyData}
                className="flex items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded text-[12.5px] font-medium transition-colors"
              >
                <Database className="size-3.5" /> Load Sample Data
              </button>
            </div>
            
            <div className="text-[12px] font-medium text-muted-foreground flex items-center gap-2">
              <div className="px-2 py-1 rounded bg-surface-2 border border-border">
                {rows.length} Total Spaces
              </div>
            </div>
          </div>
          
          {/* Main Grid Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-white/40 dark:bg-black/20 backdrop-blur-sm m-3 rounded-xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] overflow-hidden relative">
            {rows.length > 0 ? (
              <>
                <DataGrid
                  rows={rows}
                  columns={columns}
                  selected={selected}
                  onToggle={handleToggle}
                  onToggleAll={handleToggleAll}
                  renderContextMenu={renderContextMenu}
                />
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                  <Plus className="size-5 text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">No calculation rows</h3>
                <p className="text-xs text-muted-foreground max-w-sm mb-4">
                  Add a row to start calculating lighting requirements based on your project parameters.
                </p>
                <button 
                  onClick={addRow}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-sm transition-all"
                >
                  <Plus className="size-4" /> Add First Row
                </button>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </AppShell>
  );
}

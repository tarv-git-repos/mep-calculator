import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Plus, Download, Trash, Copy, Trash2, X, Settings, FolderPlus, HelpCircle, Database, Upload } from "lucide-react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;

export const Route = createFileRoute("/busbar-voltage-drop")({
  head: () => ({
    meta: [
      { title: "Busbar Voltage Drop — MEP Calc" },
      { name: "description", content: "Electrical busbar voltage drop calculations" },
    ],
  }),
  component: BusbarVoltageDropPage,
});

interface BusbarVDRow {
  id: string;
  isGroup: boolean;
  ref: string;
  from: string;
  tapOff: string;
  length: number;
  smdbLoad: number;
  tcl: number;
  voltage: number;
  pf: number;
  df: number;
  maxDemand: number; // calculated
  lineCurrent: number; // calculated
  vd: number; // calculated
  vdPercent: number; // calculated
  cumulativeVd: number; // For groups this is input (parent VD), for nodes it is calculated
}

interface BusbarRatingDef {
  rating: string;
  r: number;
  x: number;
}

const DEFAULT_RATINGS: BusbarRatingDef[] = [
  { rating: "800 (Rt)", r: 0.0750, x: 0.0200 },
  { rating: "1000 (Rt)", r: 0.0523, x: 0.0190 },
  { rating: "1250 (Rt)", r: 0.0400, x: 0.0150 },
  { rating: "1600 (Rt)", r: 0.0300, x: 0.0130 },
  { rating: "2000 (Rt)", r: 0.0220, x: 0.0110 },
  { rating: "2500 (Rt)", r: 0.0177, x: 0.0100 },
  { rating: "3200 (Rt)", r: 0.0130, x: 0.0090 },
  { rating: "4000 (Rt)", r: 0.0100, x: 0.0080 },
];

const computeAllRows = (rows: BusbarVDRow[], globalR: number, globalX: number): BusbarVDRow[] => {
  let currentGroupVd = 0;

  return rows.map((row) => {
    if (row.isGroup) {
      currentGroupVd = row.cumulativeVd || 0; // Use the input parent VD for this group
      return { ...row, maxDemand: 0, lineCurrent: 0, vd: 0, vdPercent: 0 };
    }

    const V = row.voltage || 1; // prevent div/0
    const PF = row.pf || 1;

    // Maximum Demand Load (KW) = TCL * Diversity Factor
    const maxDemand = row.tcl * row.df;
    
    // Line Current (A) = (Max Demand * 1000) / (1.732 * Voltage * PF)
    const lineCurrent = (maxDemand * 1000) / (1.732 * V * PF);

    // VOLTAGE DROP (Vd) = (1.732 * Line Current * Length * (R*CosPhi + X*SinPhi)) / 1000
    // CosPhi = PF, SinPhi = sin(arccos(PF))
    const sinPhi = Math.sin(Math.acos(Math.min(1, Math.max(-1, PF))));
    const vd = (1.732 * lineCurrent * row.length * ((globalR * PF) + (globalX * sinPhi))) / 1000;

    // Vdrop % = (VD / Voltage) * 100
    const vdPercent = (vd / V) * 100;

    // Cumulative VD = Group VD + Node VD%
    const cumulativeVd = currentGroupVd + vdPercent;

    return {
      ...row,
      maxDemand: Number(maxDemand.toFixed(2)),
      lineCurrent: Number(lineCurrent.toFixed(2)),
      vd: Number(vd.toFixed(2)),
      vdPercent: Number(vdPercent.toFixed(2)),
      cumulativeVd: Number(cumulativeVd.toFixed(2))
    };
  });
};

const pushToHistory = (
  currentRows: BusbarVDRow[],
  history: BusbarVDRow[][],
  setHistory: (h: BusbarVDRow[][]) => void,
  setRedoStack?: (r: BusbarVDRow[][]) => void
) => {
  setHistory([...history, [...currentRows]]);
  if (setRedoStack) setRedoStack([]);
};

function BusbarVoltageDropPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const confirm = useConfirm();

  const [rows, setRows] = useState<BusbarVDRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string>();
  
  const [history, setHistory] = useState<BusbarVDRow[][]>([]);
  const [redoStack, setRedoStack] = useState<BusbarVDRow[][]>([]);

  const [globalRating, setGlobalRating] = useState<string>("1000 (Rt)");
  const [globalR, setGlobalR] = useState<number>(0.0523);
  const [globalX, setGlobalX] = useState<number>(0.019);

  const [customRatings, setCustomRatings] = useState<BusbarRatingDef[]>([]);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("customBusbarRatings");
      if (stored) {
        setCustomRatings(JSON.parse(stored));
      }
    } catch (e) {  if (project?.id) setLoadedProjectId(project.id); else setLoadedProjectId("loaded");
    }
  }, []);

  const allRatings = useMemo(() => [...DEFAULT_RATINGS, ...customRatings], [customRatings]);

  // Recompute when global R/X change
  useEffect(() => {
    setRows(prev => computeAllRows(prev, globalR, globalX));
  }, [globalR, globalX]);

  const updateRow = (id: string, updates: Partial<BusbarVDRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    let newRows = [...rows];
    
    if (selected.has(id) && selected.size > 1) {
      newRows = newRows.map(row => {
        if (selected.has(row.id)) {
          return { ...row, ...updates };
        }
        return row;
      });
    } else {
      newRows = newRows.map(row => 
        row.id === id ? { ...row, ...updates } : row
      );
    }
    
    setRows(computeAllRows(newRows, globalR, globalX));
  };

  const handleToggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (isShift && activeRowId) {
        const currentIndex = rows.findIndex(r => r.id === id);
        const activeIndex = rows.findIndex(r => r.id === activeRowId);
        
        if (currentIndex !== -1 && activeIndex !== -1) {
          const start = Math.min(currentIndex, activeIndex);
          const end = Math.max(currentIndex, activeIndex);
          for (let i = start; i <= end; i++) {
            next.add(rows[i].id);
          }
          return next;
        }
      }
      
      if (next.has(id)) next.delete(id);
      else next.add(id);
      
      return next;
    });
    setActiveRowId(id);
  };

  const handleToggleAll = () => {
    if (selected.size === rows.length && rows.length > 0) {
       setSelected(new Set());
    } else {
       setSelected(new Set(rows.map(r => r.id)));
    }
  };

  const addRow = (isGroup: boolean = false) => {
    const newId = `bb_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: BusbarVDRow = {
      id: newId,
      isGroup,
      ref: isGroup ? "BUSBAR REF. NAME:" : "",
      from: "",
      tapOff: "",
      length: 0,
      smdbLoad: 0,
      tcl: 0,
      voltage: 400,
      pf: 0.8,
      df: 1.0,
      maxDemand: 0,
      lineCurrent: 0,
      vd: 0,
      vdPercent: 0,
      cumulativeVd: 0,
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => computeAllRows([...prev, newRow], globalR, globalX));
    setSelected(new Set([newId]));
    setActiveRowId(newId);
  };

  const loadDummyData = () => {
    const dummy: BusbarVDRow[] = [
      { id: `bb_${Math.random().toString(36).slice(2, 9)}`, isGroup: true, ref: "BUSBAR REF. NAME: BB-A", from: "", tapOff: "", length: 0, smdbLoad: 0, tcl: 0, voltage: 0, pf: 0, df: 0, maxDemand: 0, lineCurrent: 0, vd: 0, vdPercent: 0, cumulativeVd: 0.5 },
      { id: `bb_${Math.random().toString(36).slice(2, 9)}`, isGroup: false, ref: "", from: "MDB", tapOff: "SMDB-1", length: 15, smdbLoad: 250, tcl: 300, voltage: 400, pf: 0.8, df: 0.85, maxDemand: 0, lineCurrent: 0, vd: 0, vdPercent: 0, cumulativeVd: 0 },
      { id: `bb_${Math.random().toString(36).slice(2, 9)}`, isGroup: false, ref: "", from: "MDB", tapOff: "SMDB-2", length: 25, smdbLoad: 150, tcl: 180, voltage: 400, pf: 0.8, df: 0.9, maxDemand: 0, lineCurrent: 0, vd: 0, vdPercent: 0, cumulativeVd: 0 },
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => computeAllRows([...prev, ...dummy], globalR, globalX));
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => computeAllRows(prev.filter(r => !selected.has(r.id)), globalR, globalX));
      setSelected(new Set());
      setActiveRowId(undefined);
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    const duplicated: BusbarVDRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `bb_dup_${Math.random().toString(36).slice(2, 9)}`,
          ref: `${r.ref} (Copy)`
        });
      }
    });
    setRows(prev => computeAllRows([...prev, ...duplicated], globalR, globalX));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement;
      
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Enter" && activeEl.tagName === "INPUT") {
        activeEl.blur();
        return;
      }

      if (e.key === "Escape") {
        activeEl?.blur();
        if (selected.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setActiveRowId(undefined);
        }
        return;
      }

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

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "SELECT" ||
        activeEl.tagName === "TEXTAREA" ||
        activeEl.isContentEditable
      );
      if (isInput) return;

      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelected(new Set(rows.map(r => r.id)));
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
        e.preventDefault();
        deleteSelected();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (history.length > 0) {
          const previous = history[history.length - 1];
          setRedoStack(prev => [...prev, rows]);
          setRows(previous);
          setHistory(prev => prev.slice(0, -1));
        }
      }

      if (isCmdOrCtrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        if (redoStack.length > 0) {
          const next = redoStack[redoStack.length - 1];
          setHistory(prev => [...prev, rows]);
          setRows(next);
          setRedoStack(prev => prev.slice(0, -1));
        }
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "c" && selected.size > 0) {
        e.preventDefault();
        const selectedRows = rows.filter(r => selected.has(r.id));
        navigator.clipboard.writeText(JSON.stringify(selectedRows));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then(text => {
          try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed.length > 0 && "smdbLoad" in parsed[0]) {
              pushToHistory(rows, history, setHistory, setRedoStack);
              const newRows = parsed.map(r => ({
                ...r,
                id: `bb_paste_${Math.random().toString(36).slice(2, 9)}`
              }));
              setRows(prev => computeAllRows([...prev, ...newRows], globalR, globalX));
            }
          } catch (err) {
            console.error("Failed to paste", err);
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    
  useEffect(() => {
    if (true) {
      const dataToSave = { rows, selected, activeRowId, history, redoStack, globalRating, globalR, globalX, customRatings };
      localStorage.setItem(`customBusbarRatings`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [rows, selected, activeRowId, history, redoStack, globalRating, globalR, globalX, customRatings]);

  return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, history, redoStack, activeRowId]);

  const handleImportRatings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split("\n").map(l => l.trim()).filter(l => l);
        
        const newRatings: BusbarRatingDef[] = [];
        
        // Skip header if first line has non-numeric R/X
        let startIdx = 0;
        if (lines.length > 0) {
          const firstCols = lines[0].split(",");
          if (firstCols.length >= 3 && isNaN(parseFloat(firstCols[1]))) {
            startIdx = 1;
          }
        }

        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].split(",");
          if (cols.length >= 3) {
            const rating = cols[0].trim();
            const r = parseFloat(cols[1].trim());
            const x = parseFloat(cols[2].trim());
            
            if (rating && !isNaN(r) && !isNaN(x)) {
              // Only add if not already in defaults
              if (!DEFAULT_RATINGS.find(d => d.rating === rating)) {
                newRatings.push({ rating, r, x });
              }
            }
          }
        }

        if (newRatings.length > 0) {
          const updated = [...customRatings];
          // Update or push
          newRatings.forEach(nr => {
            const existingIdx = updated.findIndex(u => u.rating === nr.rating);
            if (existingIdx >= 0) updated[existingIdx] = nr;
            else updated.push(nr);
          });
          
          setCustomRatings(updated);
          localStorage.setItem("customBusbarRatings", JSON.stringify(updated));
          alert(`Successfully imported ${newRatings.length} ratings!`);
        } else {
          alert("No valid ratings found. Ensure CSV format is: Rating,R,X");
        }
      } catch (err) {
        alert("Failed to parse CSV file.");
      }
    };
    reader.readAsText(file);
    e.target.value = ""; // reset
  };

  const clearCustomRatings = async () => {
    if (await confirm("Are you sure you want to clear all imported custom ratings?")) {
      setCustomRatings([]);
      localStorage.removeItem("customBusbarRatings");
    }
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: BusbarVDRow[] = mappedRows.map((mr, idx) => ({
      id: `vd_import_${Date.now()}_${idx}`,
      isGroup: false,
      busbarRef: mr.busbarRef || `Imported Busbar ${idx + 1}`,
      from: mr.from || "",
      to: mr.to || "",
      length: Number(mr.length) || 10,
      loadKw: Number(mr.loadKw) || 0,
      powerFactor: Number(mr.powerFactor) || 0.8,
      phase: Number(mr.phase) || 3,
      voltageDropLimit: Number(mr.voltageDropLimit) || 5,
      rating: mr.rating || "800",
      ambientTemp: Number(mr.ambientTemp) || 50,
      diversityFactor: Number(mr.diversityFactor) || 1,
    }));
    
    setRows(prev => computeAllRows([...prev, ...newRows]));
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Busbar VD");

    sheet.columns = [
      { width: 5 },  // spacer
      { width: 10 }, // Tap Off No.
      { width: 20 }, // Busbar reference
      { width: 15 }, // From
      { width: 20 }, // Tap off points
      { width: 15 }, // Length
      { width: 15 }, // SMDB load
      { width: 15 }, // TCL
      { width: 12 }, // Voltage
      { width: 12 }, // PF
      { width: 12 }, // DF
      { width: 15 }, // Max Demand
      { width: 15 }, // Line Current
      { width: 20 }, // Busbar Rating
      { width: 15 }, // R
      { width: 15 }, // X
      { width: 15 }, // Vd
      { width: 15 }, // Vdrop %
      { width: 20 }, // Cumulative %
    ];

    const titleRow = sheet.addRow([
      "Calculation No: CEC-EED-PXXX-210  Rev. No: 0", "", "", "", "", "", "", "", "", "", "", "", "Date       :"
    ]);
    titleRow.font = { bold: true };
    const projectRow = sheet.addRow([
      `Project No      : ${project?.id || ""}`, "", "", "", "", "", "", "", "", "", "", "", "Client     :"
    ]);
    projectRow.font = { bold: true };
    const nameRow = sheet.addRow([
      `Project Name : ${project?.name || ""}`, "", "", "", "", "", "", "", "", "", "", "", "End User : "
    ]);
    nameRow.font = { bold: true };

    sheet.mergeCells("A1:K1");
    sheet.mergeCells("A2:K2");
    sheet.mergeCells("A3:K3");
    
    const headerTitle = sheet.addRow(["BUSBAR VOLTAGE DROP CALCULATIONS"]);
    headerTitle.font = { bold: true, size: 14 };
    sheet.mergeCells(4, 1, 4, 19);
    headerTitle.alignment = { horizontal: 'center' };
    
    sheet.addRow([]);

    const header1 = sheet.addRow([
      "", "Tap Off No.", "Busbar reference", "From", "Tap off points",
      "Length of busbar upto tap off (m)", "SMDB load (kW)", "TCL at Tap Off Point (KW)",
      "Voltage (v)", "Power Factor (Cos Φ)", "Diversity Factor",
      "Maximum Demand Load at Tap off Point(KW)", "Line Current (A)",
      "Busbar Rating (A) (Copper)", "Resistance R (mΩ/m)", "Reactance X (mΩ/m)",
      "Volt Drop (Vd)", "Vdrop %", "Cumulative V drop in Bus bar %"
    ]);

    header1.eachCell((cell, colNumber) => {
      if (colNumber > 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        cell.font = { bold: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      }
    });
    sheet.getRow(6).height = 45;

    let itemCounter = 1;

    rows.forEach((row) => {
      if (row.isGroup) {
        const xlRow = sheet.addRow([
          "", "", row.ref, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "Parent %:", row.cumulativeVd
        ]);
        xlRow.font = { bold: true };
        itemCounter = 1; // Reset items in new group
        xlRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          }
        });
        sheet.mergeCells(xlRow.number, 3, xlRow.number, 17);
      } else {
        const xlRow = sheet.addRow([
          "",
          itemCounter++,
          row.ref,
          row.from,
          row.tapOff,
          row.length,
          row.smdbLoad,
          row.tcl,
          row.voltage,
          row.pf,
          row.df,
          row.maxDemand,
          row.lineCurrent,
          globalRating,
          globalR,
          globalX,
          row.vd,
          row.vdPercent,
          row.cumulativeVd
        ]);
        xlRow.eachCell((cell, colNumber) => {
          if (colNumber > 1) {
            if (colNumber > 5) cell.alignment = { horizontal: 'center' };
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          }
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Busbar_Voltage_Drop_Calculations.xlsx");
  };

  const columns = useMemo<Column<BusbarVDRow>[]>(() => [
    {
      key: "ref",
      header: "Busbar Ref / Name",
      width: 150,
      render: (row) => {
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            data-row-idx={idx}
            data-col-idx={0}
            className={`w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 ${row.isGroup ? 'font-bold' : ''}`}
            value={row.ref}
            onChange={(e) => updateRow(row.id, { ref: e.target.value })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "from",
      header: "From",
      width: 90,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            data-row-idx={idx}
            data-col-idx={1}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
            value={row.from}
            onChange={(e) => updateRow(row.id, { from: e.target.value })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "tapOff",
      header: "Tap Off Point",
      width: 100,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            data-row-idx={idx}
            data-col-idx={2}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
            value={row.tapOff}
            onChange={(e) => updateRow(row.id, { tapOff: e.target.value })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "length",
      header: "Length (m)",
      width: 80,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            type="number"
            data-row-idx={idx}
            data-col-idx={3}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.length || ""}
            onChange={(e) => updateRow(row.id, { length: parseFloat(e.target.value) || 0 })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "smdbLoad",
      header: "SMDB Load (kW)",
      width: 100,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            type="number"
            data-row-idx={idx}
            data-col-idx={4}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.smdbLoad || ""}
            onChange={(e) => updateRow(row.id, { smdbLoad: parseFloat(e.target.value) || 0 })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "tcl",
      header: "TCL (kW)",
      width: 80,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            type="number"
            data-row-idx={idx}
            data-col-idx={5}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center font-medium"
            value={row.tcl || ""}
            onChange={(e) => updateRow(row.id, { tcl: parseFloat(e.target.value) || 0 })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "voltage",
      header: "Voltage",
      width: 80,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            type="number"
            data-row-idx={idx}
            data-col-idx={6}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.voltage || ""}
            onChange={(e) => updateRow(row.id, { voltage: parseFloat(e.target.value) || 0 })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "pf",
      header: "PF",
      width: 60,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            type="number"
            step="0.01"
            data-row-idx={idx}
            data-col-idx={7}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.pf || ""}
            onChange={(e) => updateRow(row.id, { pf: parseFloat(e.target.value) || 0 })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "df",
      header: "DF",
      width: 60,
      render: (row) => {
        if (row.isGroup) return null;
        const idx = rows.findIndex(r => r.id === row.id);
        return (
          <input
            type="number"
            step="0.01"
            data-row-idx={idx}
            data-col-idx={8}
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.df || ""}
            onChange={(e) => updateRow(row.id, { df: parseFloat(e.target.value) || 0 })}
            onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "maxDemand",
      header: "Max Demand",
      width: 100,
      render: (row) => !row.isGroup ? <div className="w-full text-center font-medium text-slate-700 dark:text-slate-300">{row.maxDemand}</div> : null,
    },
    {
      key: "lineCurrent",
      header: "Line A",
      width: 80,
      render: (row) => !row.isGroup ? <div className="w-full text-center text-slate-500">{row.lineCurrent}</div> : null,
    },
    {
      key: "vd",
      header: "VD (V)",
      width: 80,
      render: (row) => !row.isGroup ? <div className="w-full text-center font-medium">{row.vd}</div> : null,
    },
    {
      key: "vdPercent",
      header: "VD (%)",
      width: 80,
      render: (row) => !row.isGroup ? <div className="w-full text-center font-bold text-[#06456F] dark:text-sky-400">{row.vdPercent}</div> : null,
    },
    {
      key: "cumulativeVd",
      header: "Cumul. %V",
      width: 90,
      render: (row) => {
        const idx = rows.findIndex(r => r.id === row.id);
        if (row.isGroup) {
          return (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded px-1">
              <span className="text-[10px] text-slate-500">Parent:</span>
              <input
                type="number"
                step="0.01"
                data-row-idx={idx}
                data-col-idx={12}
                className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded text-center text-sm font-bold"
                value={row.cumulativeVd}
                onChange={(e) => updateRow(row.id, { cumulativeVd: parseFloat(e.target.value) || 0 })}
                onFocus={() => { setSelected(new Set([row.id])); setActiveRowId(row.id); }}
                title="Input the parent Voltage Drop % to cascade to these children"
              />
            </div>
          );
        }
        return <div className="w-full text-center font-bold text-blue-600 dark:text-blue-400">{row.cumulativeVd}</div>;
      },
    },
  ], [rows]);

  return (
    <AppShell 
      title="Busbar Voltage Drop Calculations" 
      subtitle="Calculate busbar voltage drop with resistive and reactive components."
      actions={
        <div className="flex gap-2">
          <ImportExcelBtn
            columnMapping={{
              "Busbar Ref": "busbarRef",
              "From": "from",
              "To": "to",
              "Length (m)": "length",
              "Length": "length",
              "Load (kW)": "loadKw",
              "Load": "loadKw",
              "PF": "powerFactor",
              "Power Factor": "powerFactor",
              "Phase": "phase",
              "VD Limit (%)": "voltageDropLimit",
              "VD Limit": "voltageDropLimit",
              "Rating": "rating",
              "Ambient Temp (C)": "ambientTemp",
              "Diversity Factor": "diversityFactor",
              "DF": "diversityFactor"
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
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-background/80 backdrop-blur-md shrink-0 select-none">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => addRow(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[12.5px] font-medium shadow-sm transition-all"
              >
                <FolderPlus className="size-3.5" /> Add Group
              </button>
              <button 
                onClick={() => addRow(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-primary/20 text-primary hover:bg-primary/10 rounded text-[12.5px] font-medium shadow-sm transition-all"
              >
                <Plus className="size-3.5" /> Add Tap Off
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

              <div className="w-px h-4 bg-border mx-1" />

              <div className="flex items-center gap-3 bg-slate-100/50 dark:bg-slate-900/50 px-3 py-1 rounded-md border border-border">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Rating:</span>
                  <select 
                    value={globalRating}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGlobalRating(val);
                      if (val !== "Custom") {
                        const found = allRatings.find(r => r.rating === val);
                        if (found) {
                          setGlobalR(found.r);
                          setGlobalX(found.x);
                        }
                      }
                    }}
                    className="bg-transparent border border-border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary min-w-[100px]"
                  >
                    {allRatings.map(rt => (
                      <option key={rt.rating} value={rt.rating}>{rt.rating}</option>
                    ))}
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">R:</span>
                  <input 
                    type="number" step="0.0001"
                    value={globalR} onChange={e => setGlobalR(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent border border-border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-muted-foreground">X:</span>
                  <input 
                    type="number" step="0.0001"
                    value={globalX} onChange={e => setGlobalX(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-transparent border border-border rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="w-px h-4 bg-border mx-1" />
                
                <div className="flex items-center">
                  <label className="flex items-center gap-1 cursor-pointer text-xs font-medium text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors">
                    <Upload className="size-3.5" /> Import
                    <input 
                      type="file" 
                      accept=".csv,.txt" 
                      className="hidden" 
                      onChange={handleImportRatings}
                    />
                  </label>
                  {customRatings.length > 0 && (
                    <button 
                      onClick={clearCustomRatings}
                      className="flex items-center gap-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 rounded transition-colors ml-1"
                      title="Clear Custom Ratings"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col relative p-4">
             <div className="flex-1 flex flex-col bg-white/80 dark:bg-black/40 backdrop-blur-sm rounded-xl border border-white/50 dark:border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.04)] overflow-hidden">
                {rows.length > 0 ? (
                  <DataGrid
                    rows={rows}
                    columns={columns}
                    selected={selected}
                    onToggle={handleToggle}
                    onToggleAll={handleToggleAll}
                    renderContextMenu={(row) => (
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem onClick={() => addRow(false)}>
                          <Plus className="size-4 mr-2" /> Add Tap Off
                        </ContextMenuItem>
                        <ContextMenuItem onClick={() => addRow(true)}>
                          <FolderPlus className="size-4 mr-2" /> Add Group
                        </ContextMenuItem>
                        <ContextMenuItem onClick={duplicateSelected} disabled={selected.size === 0}>
                          <Copy className="size-4 mr-2" /> Duplicate Selected
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem 
                          onClick={deleteSelected} 
                          disabled={selected.size === 0}
                          className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                        >
                          <Trash className="size-4 mr-2" /> Delete Selected
                        </ContextMenuItem>
                      </ContextMenuContent>
                    )}
                  />
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                    <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                      <Plus className="size-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">No busbar rows</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-4">
                      Add a group or load sample data to begin calculating your busbar voltage drops.
                    </p>
                    <button 
                      onClick={() => addRow(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded text-[13px] font-medium shadow-sm transition-all"
                    >
                      <Plus className="size-4" /> Add First Group
                    </button>
                  </div>
                )}
             </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

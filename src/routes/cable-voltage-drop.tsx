import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/workspace/AppShell";
import { useState, useMemo, useEffect } from "react";
import { useWorkspace } from "@/lib/workspace-store";
import { useConfirm } from "@/hooks/use-confirm";
import { DataGrid, Column } from "@/components/workspace/DataGrid";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Plus, Download, Trash, Copy, Trash2, X, Settings, FolderPlus, HelpCircle, Database } from "lucide-react";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import { useElectricalNetworkStore, calculateCircuitLoad } from "@/store/electrical-network";

export const Route = createFileRoute("/cable-voltage-drop")({
  head: () => ({
    meta: [
      { title: "Cable Voltage Drop — MEP Calc" },
      { name: "description", content: "Electrical cable voltage drop calculations" },
    ],
  }),
  component: CableVoltageDropPage,
});

interface CableVDRow {
  id: string;
  isGroup: boolean;
  from: string;
  description: string;
  load: number; // KW
  voltage: number;
  pf: number;
  lineCurrent: number; // calculated
  runs: number;
  size: string;
  currentPerCable: number; // calculated
  length: number;
  mvAm: number;
  vd: number; // calculated
  vdPercent: number; // calculated
  cumulativeVd: number; // For groups this is input (parent VD), for nodes it is calculated
  isLinked?: boolean;
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  onFocus?: (e: any) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, onFocus }: InlineInputProps) {
  const [localVal, setLocalVal] = useState(String(value));

  useEffect(() => {
    const strVal = String(value);
    if (localVal !== strVal) {
      const parsedLocal = parseFloat(localVal);
      const parsedValue = parseFloat(strVal);
      // Don't overwrite if user is typing a decimal or a negative sign
      if (localVal.endsWith('.') && parsedLocal === parsedValue) return;
      if (localVal === '' && parsedValue === 0) return;
      if (localVal === '-' && parsedValue === 0) return;
      
      setLocalVal(strVal);
    }
  }, [value, localVal]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
    onCommit(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Escape") {
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      step={step}
      min={min}
      value={localVal}
      onChange={handleChange}
      onFocus={onFocus}
      onKeyDown={handleKeyDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={`bg-transparent w-full border border-transparent hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 py-0.5 px-1 rounded text-foreground transition-colors cursor-text ${className}`}
    />
  );
}

const CABLE_CATALOGUE: Record<string, number> = {
  "4c 16": 2.5,
  "4c 25": 1.65,
  "4c 35": 1.15,
  "4c 50": 0.87,
  "4c 70": 0.60,
  "4c 95": 0.43,
  "4c 120": 0.35,
  "4c 150": 0.29,
  "4c 185": 0.24,
  "4c 240": 0.19,
  "4c 300": 0.16,
  "1c 16": 2.5,
  "1c 25": 1.65,
  "1c 35": 1.15,
  "1c 50": 0.87,
  "1c 70": 0.60,
  "1c 95": 0.43,
  "1c 120": 0.35,
  "1c 150": 0.29,
  "1c 185": 0.24,
  "1c 240": 0.19,
  "1c 300": 0.16,
  "1c 400": 0.13,
  "1c 500": 0.11,
  "1c 630": 0.09
};

const normalizeString = (s: string) => (s || "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const computeAllRows = (rows: CableVDRow[]): CableVDRow[] => {
  let currentGroupVd = 0;
  const computedVdMap = new Map<string, number>();
  let busbarVdMap: Record<string, number> = {};
  
  if (typeof window !== "undefined") {
    try {
      const saved = localStorage.getItem("mep-busbar-calculated-vd-v1");
      if (saved) busbarVdMap = JSON.parse(saved);
    } catch (e) {}
  }

  return rows.map((row) => {
    if (row.isGroup) {
      const fromName = normalizeString(row.from);
      let parentVd = row.cumulativeVd || 0;
      
      if (fromName) {
        if (computedVdMap.has(fromName)) {
           parentVd = computedVdMap.get(fromName)!;
        } else {
           for (const key of Object.keys(busbarVdMap)) {
              if (normalizeString(key) === fromName) {
                  parentVd = busbarVdMap[key];
                  break;
              }
           }
        }
      }
      
      currentGroupVd = parentVd; 
      
      return { 
        ...row, 
        cumulativeVd: parentVd, 
        lineCurrent: 0, 
        currentPerCable: 0, 
        vd: 0, 
        vdPercent: 0 
      };
    }

    const V = row.voltage || 1; // prevent div/0
    const PF = row.pf || 1;
    const Runs = row.runs || 1;

    // Line Current (A) = (Load * 1000) / (1.732 * Voltage * PF)
    const lineCurrent = (row.load * 1000) / (1.732 * V * PF);
    
    // Line Current Per cable (A) = Line Current / No. of cable Runs
    const currentPerCable = lineCurrent / Runs;

    // VOLTAGE DROP (V) = (mV/A/m * Current Per Cable * Length) / 1000
    const vd = (row.mvAm * currentPerCable * row.length) / 1000;

    // VOLTAGE DROP %V = (VD / Voltage) * 100
    const vdPercent = (vd / V) * 100;

    // Cumulative VD = Group VD + Node VD%
    const cumulativeVd = currentGroupVd + vdPercent;

    if (row.description) {
      computedVdMap.set(normalizeString(row.description), cumulativeVd);
    }

    return {
      ...row,
      lineCurrent: Number(lineCurrent.toFixed(2)),
      currentPerCable: Number(currentPerCable.toFixed(2)),
      vd: Number(vd.toFixed(2)),
      vdPercent: Number(vdPercent.toFixed(2)),
      cumulativeVd: Number(cumulativeVd.toFixed(2))
    };
  });
};

const pushToHistory = (
  currentRows: CableVDRow[],
  history: CableVDRow[][],
  setHistory: (h: CableVDRow[][]) => void,
  setRedoStack?: (r: CableVDRow[][]) => void
) => {
  setHistory([...history, [...currentRows]]);
  if (setRedoStack) setRedoStack([]);
};

function CableVoltageDropPage() {
  const { project } = useWorkspace();
  const confirm = useConfirm();
  const boards = useElectricalNetworkStore(state => state.boards);
  const setBoards = useElectricalNetworkStore(state => state.setBoards);

  const [rows, setRows] = useState<CableVDRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeRowId, setActiveRowId] = useState<string>();
  
  const [history, setHistory] = useState<CableVDRow[][]>([]);
  const [redoStack, setRedoStack] = useState<CableVDRow[][]>([]);

  const updateRow = (id: string, updates: Partial<CableVDRow>) => {
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    let newRows = [...rows];
    
    if (selected.has(id) && selected.size > 1) {
      newRows = newRows.map(row => {
        if (selected.has(row.id)) {
          const updatedRow = { ...row, ...updates };
          if (updates.size !== undefined) {
             const normalizedSize = updates.size.toLowerCase().trim();
             if (CABLE_CATALOGUE[normalizedSize] !== undefined) {
                updatedRow.mvAm = CABLE_CATALOGUE[normalizedSize];
             }
          }
          return updatedRow;
        }
        return row;
      });
    } else {
      newRows = newRows.map(row => {
        if (row.id === id) {
          const updatedRow = { ...row, ...updates };
          
          if (updates.description !== undefined || updates.from !== undefined) {
            if (!updatedRow.isGroup && updatedRow.from && updatedRow.description) {
              const fromNorm = normalizeString(updatedRow.from);
              const descNorm = normalizeString(updatedRow.description);
              
              const parentBoard = boards.find(b => normalizeString(b.name) === fromNorm);
              if (parentBoard) {
                const circuit = parentBoard.circuits.find(c => {
                    const cDesc = c.desc || c.roomArea || "";
                    return normalizeString(cDesc) === descNorm;
                });
                if (circuit) {
                  updatedRow.isLinked = true;
                  const loadW = circuit.loadW !== undefined ? circuit.loadW : calculateCircuitLoad(circuit);
                  if (loadW) updatedRow.load = Number((loadW / 1000).toFixed(2));
                  if (circuit.qty) updatedRow.runs = Number(circuit.qty);
                  if (circuit.wire || circuit.wireEcc) updatedRow.size = circuit.wire || circuit.wireEcc;
                  if (circuit.len) updatedRow.length = Number(circuit.len);
                  
                  const size = circuit.wire || circuit.wireEcc || "";
                  const normalizedSize = size.toLowerCase().trim();
                  if (CABLE_CATALOGUE[normalizedSize] !== undefined) {
                     updatedRow.mvAm = CABLE_CATALOGUE[normalizedSize];
                  }
                } else {
                  updatedRow.isLinked = false;
                }
              } else {
                updatedRow.isLinked = false;
              }
            } else {
               updatedRow.isLinked = false;
            }
          }
          
          if (updates.size !== undefined) {
             const normalizedSize = updates.size.toLowerCase().trim();
             if (CABLE_CATALOGUE[normalizedSize] !== undefined) {
                updatedRow.mvAm = CABLE_CATALOGUE[normalizedSize];
             }
          }
          
          return updatedRow;
        }
        return row;
      });
    }
    
    setRows(computeAllRows(newRows));
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
    const newId = `vd_${Math.random().toString(36).slice(2, 9)}`;
    const newRow: CableVDRow = {
      id: newId,
      isGroup,
      from: "",
      description: isGroup ? "VOLTAGE DROP FROM SMDB-XX TO DBs/EQUIPMENTS AS FOLLOW" : "",
      load: 0,
      voltage: 400,
      pf: 0.8,
      lineCurrent: 0,
      runs: 1,
      size: "",
      currentPerCable: 0,
      length: 0,
      mvAm: 0,
      vd: 0,
      vdPercent: 0,
      cumulativeVd: 0,
    };
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => computeAllRows([...prev, newRow]));
    setSelected(new Set([newId]));
    setActiveRowId(newId);
  };

  const loadDummyData = () => {
    // 1. Inject Sample Load Schedule Data
    const sampleMDB: any = {
      id: "board-sample-mdb",
      name: "MDB-MAIN",
      type: "MDB",
      phaseType: "3-Phase",
      fedFrom: "DEWA",
      incomer: { rating: "1600A", sptp: "4P", faultKa: "50", cableSize: "300", eccSize: "150", inc1: "", inc2: "", meterType: "None" },
      circuits: [
        {
          id: "c-1", cirNo: 1, desc: "SMDB-1", qty: 1, loadW: 45000, phase: "R", df: 1, mcb: "100", faultKa: "36", wire: "4c 35", type: "XLPE", ecc: "16", len: "45", ph1Mtr: "", ph3Mtr: "", ctMtr: "", remarks: ""
        },
        {
          id: "c-2", cirNo: 2, desc: "CHILLER-1", qty: 2, loadW: 120000, phase: "Y", df: 1, mcb: "250", faultKa: "36", wire: "4c 120", type: "XLPE", ecc: "70", len: "60", ph1Mtr: "", ph3Mtr: "", ctMtr: "", remarks: ""
        }
      ]
    };
    
    // Check if it already exists so we don't duplicate
    if (!boards.find(b => b.name === "MDB-MAIN")) {
      setBoards([...boards, sampleMDB]);
    }

    // 2. Inject Sample Busbar Data
    const sampleBusbarCalc = {
      "lv panel 01": 0.42,
      "bb 1": 0.42,
      "smdb 1": 0.25
    };
    localStorage.setItem("mep-busbar-calculated-vd-v1", JSON.stringify(sampleBusbarCalc));
    
    const sampleBusbarPanels = [{
      id: "pan_sample",
      name: "LV PANEL-01",
      sections: [{
        id: "sec_sample",
        name: "BB-1",
        ratingId: "1600_rt",
        volts: 415,
        pf: 0.8,
        rows: [
          { id: "bb_1", from: "LV PANEL-01", desc: "SMDB-1", ref: "BB-1", length: 15, loadKw: 45, div: 1 }
        ]
      }]
    }];
    localStorage.setItem("mep-busbar-calculation-v1", JSON.stringify(sampleBusbarPanels));

    // 3. Provide an empty workspace for the user to try the automation
    const dummy: CableVDRow[] = [
      { id: `vd_${Math.random().toString(36).slice(2, 9)}`, isGroup: true, from: "BB-1", description: "VOLTAGE DROP FROM BB-1 TO SMDB-1", load: 0, voltage: 0, pf: 0, lineCurrent: 0, runs: 0, size: "", currentPerCable: 0, length: 0, mvAm: 0, vd: 0, vdPercent: 0, cumulativeVd: 0 },
      { id: `vd_${Math.random().toString(36).slice(2, 9)}`, isGroup: false, from: "", description: "", load: 0, voltage: 400, pf: 0.8, lineCurrent: 0, runs: 1, size: "", currentPerCable: 0, length: 0, mvAm: 0, vd: 0, vdPercent: 0, cumulativeVd: 0 },
    ];
    
    pushToHistory(rows, history, setHistory, setRedoStack);
    setRows(prev => computeAllRows([...prev, ...dummy]));

    setTimeout(() => {
        alert("Sample data loaded successfully!\n\n1. I've added 'MDB-MAIN' to your Project Load Schedule.\n2. I've added 'LV PANEL-01' to your Busbar Calculation.\n\nTo see the automation work right now:\nClick on the empty row at the bottom and type:\nFrom: MDB MAIN\nDescription: SMDB 1");
    }, 100);
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (await confirm(`Are you sure you want to delete ${selected.size} selected row(s)?`)) {
      pushToHistory(rows, history, setHistory, setRedoStack);
      setRows(prev => computeAllRows(prev.filter(r => !selected.has(r.id))));
      setSelected(new Set());
      setActiveRowId(undefined);
    }
  };

  const duplicateSelected = () => {
    if (selected.size === 0) return;
    pushToHistory(rows, history, setHistory, setRedoStack);
    
    const duplicated: CableVDRow[] = [];
    rows.forEach(r => {
      if (selected.has(r.id)) {
        duplicated.push({
          ...r,
          id: `vd_dup_${Math.random().toString(36).slice(2, 9)}`,
          description: `${r.description} (Copy)`
        });
      }
    });
    setRows(prev => computeAllRows([...prev, ...duplicated]));
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
            if (Array.isArray(parsed) && parsed.length > 0 && "cumulativeVd" in parsed[0]) {
              pushToHistory(rows, history, setHistory, setRedoStack);
              const newRows = parsed.map(r => ({
                ...r,
                id: `vd_paste_${Math.random().toString(36).slice(2, 9)}`
              }));
              setRows(prev => computeAllRows([...prev, ...newRows]));
            }
          } catch (err) {
            console.error("Failed to paste", err);
          }
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rows, selected, history, redoStack, activeRowId]);

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newRows: CableVDRow[] = mappedRows.map((mr, idx) => ({
      id: `vd_import_${Date.now()}_${idx}`,
      isGroup: false,
      loadRef: mr.loadRef || `Imported Load ${idx + 1}`,
      from: mr.from || "",
      to: mr.to || "",
      length: Number(mr.length) || 10,
      loadKw: Number(mr.loadKw) || 0,
      powerFactor: Number(mr.powerFactor) || 0.8,
      phase: Number(mr.phase) || 3,
      voltageDropLimit: Number(mr.voltageDropLimit) || 5,
      cableType: mr.cableType || "XLPE/SWA/PVC",
      conductor: mr.conductor || "Cu",
      installationMethod: mr.installationMethod || "In Trench",
      ambientTemp: Number(mr.ambientTemp) || 50,
      groupingFactor: Number(mr.groupingFactor) || 1,
    }));
    
    setRows(prev => computeAllRows([...prev, ...newRows]));
  };

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cable VD");

    sheet.columns = [
      { width: 8 },  // S.No
      { width: 15 }, // From
      { width: 35 }, // Description
      { width: 15 }, // Load
      { width: 15 }, // Voltage
      { width: 15 }, // PF
      { width: 15 }, // Line Current
      { width: 15 }, // Runs
      { width: 15 }, // Size
      { width: 15 }, // Current/Cable
      { width: 15 }, // Length
      { width: 15 }, // mV/A/m
      { width: 20 }, // VD (V)
      { width: 20 }, // VD %
      { width: 25 }, // Cumulative %
    ];

    const titleRow = sheet.addRow([`Calculation No: CEC-EED-PXXX-209  Rev. No: 0`, "", "", "", "", "", "Date       :"]);
    titleRow.font = { bold: true };
    const projectRow = sheet.addRow([`Project No      : ${project?.id || ""}`, "", "", "", "", "", "Client     :"]);
    projectRow.font = { bold: true };
    const nameRow = sheet.addRow([`Project Name : ${project?.name || ""}`, "", "", "", "", "", "End User :"]);
    nameRow.font = { bold: true };

    sheet.mergeCells("A1:F1");
    sheet.mergeCells("A2:F2");
    sheet.mergeCells("A3:F3");
    
    const headerTitle = sheet.addRow(["CABLE VOLTAGE DROP CALCULATIONS"]);
    headerTitle.font = { bold: true, size: 14 };
    sheet.mergeCells(4, 1, 4, 15);
    headerTitle.alignment = { horizontal: 'center' };
    
    sheet.addRow([]);

    const header1 = sheet.addRow([
      "Tap Off No.", "From", "Description of connection (SMDB/DB)", "Total Connected Load (KW)",
      "Voltage (v)", "Power Factor (Cos Φ)", "Line Current (A)", "No. of cable Runs",
      "Cable size", "Line Current Per cable (A)", "Length (m)", "mV/A/m",
      "VOLTAGE DROP IN CABLE (V)", "VOLTAGE DROP %V", "CUMULATIVE VOLTAGE DROP UPTO DB %V"
    ]);

    header1.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    sheet.getRow(6).height = 40;

    let itemCounter = 1;

    rows.forEach((row) => {
      if (row.isGroup) {
        const xlRow = sheet.addRow([
          "", "", row.description, "", "", "", "", "", "", "", "", "", "", "Parent %:", row.cumulativeVd
        ]);
        xlRow.font = { bold: true };
        itemCounter = 1; // Reset items in new group
        xlRow.eachCell(cell => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
        sheet.mergeCells(xlRow.number, 3, xlRow.number, 13);
      } else {
        const xlRow = sheet.addRow([
          itemCounter++,
          row.from,
          row.description,
          row.load,
          row.voltage,
          row.pf,
          row.lineCurrent,
          row.runs,
          row.size,
          row.currentPerCable,
          row.length,
          row.mvAm,
          row.vd,
          row.vdPercent,
          row.cumulativeVd
        ]);
        xlRow.eachCell((cell, colNumber) => {
          if (colNumber > 3 && colNumber < 16) cell.alignment = { horizontal: 'center' };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "Cable_Voltage_Drop_Calculations.xlsx");
  };

  const columns = useMemo<Column<CableVDRow>[]>(() => [
    {
      key: "from",
      header: "From",
      width: 100,
      render: (row) => {
        if (row.isGroup) return null;
        return (
          <InlineInput
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1"
            value={row.from}
            onCommit={(val) => updateRow(row.id, { from: val })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "description",
      header: "Description",
      width: 250,
      render: (row) => {
        return (
          <div className="relative flex items-center w-full">
            <InlineInput
              className={`w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 pr-6 ${row.isGroup ? 'font-bold' : ''}`}
              value={row.description}
              onCommit={(val) => updateRow(row.id, { description: val })}
              onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
            />
            {!row.isGroup && row.isLinked && (
               <div className="absolute right-1 text-green-500 bg-white dark:bg-slate-900 rounded-full" title="Linked to Load Schedule">
                  <Database size={14} />
               </div>
            )}
            {!row.isGroup && !row.isLinked && (
               <div className="absolute right-1 text-slate-300 dark:text-slate-600 bg-white dark:bg-slate-900 rounded-full" title="Not found in Load Schedule">
                  <Database size={14} />
               </div>
            )}
          </div>
        );
      },
    },
    {
      key: "load",
      header: "Load (kW)",
      width: 90,
      render: (row) => {
        if (row.isGroup) return null;
        return (
          <InlineInput
            type="number"
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.load}
            onCommit={(val) => updateRow(row.id, { load: parseFloat(val) || 0 })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
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
        return (
          <InlineInput
            type="number"
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.voltage}
            onCommit={(val) => updateRow(row.id, { voltage: parseFloat(val) || 0 })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
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
        return (
          <InlineInput
            type="number"
            step="0.01"
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.pf}
            onCommit={(val) => updateRow(row.id, { pf: parseFloat(val) || 0 })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "lineCurrent",
      header: "Line A",
      width: 80,
      render: (row) => !row.isGroup ? <div className="w-full text-center text-slate-500">{row.lineCurrent}</div> : null,
    },
    {
      key: "runs",
      header: "Runs",
      width: 60,
      render: (row) => {
        if (row.isGroup) return null;
        return (
          <InlineInput
            type="number"
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.runs}
            onCommit={(val) => updateRow(row.id, { runs: parseFloat(val) || 1 })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "size",
      header: "Cable Size",
      width: 100,
      render: (row) => {
        if (row.isGroup) return null;
        return (
          <InlineInput
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.size}
            onCommit={(val) => updateRow(row.id, { size: val })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "currentPerCable",
      header: "A / Cable",
      width: 90,
      render: (row) => !row.isGroup ? <div className="w-full text-center text-slate-500">{row.currentPerCable}</div> : null,
    },
    {
      key: "length",
      header: "Len (m)",
      width: 80,
      render: (row) => {
        if (row.isGroup) return null;
        return (
          <InlineInput
            type="number"
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.length}
            onCommit={(val) => updateRow(row.id, { length: parseFloat(val) || 0 })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
          />
        );
      },
    },
    {
      key: "mvAm",
      header: "mV/A/m",
      width: 80,
      render: (row) => {
        if (row.isGroup) return null;
        return (
          <InlineInput
            type="number"
            step="0.01"
            className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded px-1 text-center"
            value={row.mvAm}
            onCommit={(val) => updateRow(row.id, { mvAm: parseFloat(val) || 0 })}
            onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
          />
        );
      },
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
        if (row.isGroup) {
          return (
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded px-1">
              <span className="text-[10px] text-slate-500">Parent:</span>
              <InlineInput
                type="number"
                step="0.01"
                className="w-full bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded text-center text-sm font-bold"
                value={row.cumulativeVd}
                onCommit={(val) => updateRow(row.id, { cumulativeVd: parseFloat(val) || 0 })}
                onFocus={(e) => { if (!selected.has(row.id)) { setSelected(new Set([row.id])); } setActiveRowId(row.id); }}
              />
            </div>
          );
        }
        return <div className="w-full text-center font-bold text-blue-600 dark:text-blue-400">{row.cumulativeVd}</div>;
      },
    },
  ], [rows, selected]);

  return (
    <AppShell 
      title="Cable Voltage Drop Calculations" 
      subtitle="Calculate electrical cable voltage drop."
      actions={
        <div className="flex gap-2">
          <ImportExcelBtn
            columnMapping={{
              "Load Ref": "loadRef",
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
              "Cable Type": "cableType",
              "Conductor": "conductor",
              "Installation": "installationMethod",
              "Ambient Temp (C)": "ambientTemp",
              "Grouping Factor": "groupingFactor"
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
                <Plus className="size-3.5" /> Add Node
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
                          <Plus className="size-4 mr-2" /> Add Node
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
                    <h3 className="text-sm font-semibold text-foreground mb-1">No cable VD rows</h3>
                    <p className="text-xs text-muted-foreground max-w-sm mb-4">
                      Add a group or load sample data to begin calculating your cable voltage drops.
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

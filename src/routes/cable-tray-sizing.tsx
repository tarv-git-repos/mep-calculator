import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Plus, Trash2, Search, Download, Trash, Upload, RefreshCcw } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { exportCableTrayExcel } from '../lib/exportCableTrayExcel';
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";
import { Cable, Tray, TRAY_RANGES, getCableTraySize } from "../lib/cableTrayHelpers";

export const Route = createFileRoute("/cable-tray-sizing")({
  head: () => ({
    meta: [
      { title: "Cable Tray Sizing — MEP Calc" },
      { name: "description", content: "Calculate cable tray containment sizes." },
    ],
  }),
  component: CableTraySizingPage,
});

const DEFAULT_CABLE_DATABASE: Record<string, Record<string, number>> = {
  "1C": { "2.5": 3.7, "4": 4.7, "6": 5.6, "10": 6.3, "16": 7.4, "25": 9.1, "35": 10.3, "50": 12.3, "70": 14.2, "95": 16.2, "120": 17.9, "150": 20.2, "185": 22.2, "240": 28.0, "300": 30.0, "630": 48.8 },
  "2C": { "2.5": 12.3, "4": 13.4, "6": 14.5, "10": 16.7, "16": 19.5, "25": 20.8, "35": 23.4, "50": 25.5, "70": 29.0, "95": 31.9, "120": 34.4, "150": 37.9, "185": 42.4, "240": 46.4, "300": 50.3 },
  "3C": { "2.5": 13.0, "4": 16.0, "6": 16.0, "10": 18.0, "16": 21.0, "25": 21.0, "35": 26.0, "50": 30.0, "70": 34.0, "95": 36.0, "120": 38.0, "150": 45.0, "185": 49.0, "240": 54.0, "300": 59.0 },
  "4C": { "2.5": 13.5, "4": 15.0, "6": 17.3, "10": 19.8, "16": 22.3, "25": 27.6, "35": 30.6, "50": 32.7, "70": 38.0, "95": 41.3, "120": 46.4, "150": 50.5, "185": 55.3, "240": 61.1, "300": 66.7 }
};

function formatTraySize(size: string, isSI: boolean) {
  if (size === 'N/A') return 'N/A';
  if (isSI) return size + ' mm';
  
  const sizeMap: Record<string, string> = {
    "100": "4\"",
    "150": "6\"",
    "225": "9\"",
    "300": "12\"",
    "450": "18\"",
    "600": "24\"",
    "750": "30\"",
    "900": "36\""
  };

  return size.split(', ').map(s => {
    const parts = s.split(' X ');
    if (parts.length === 2) {
      const qty = parts[0];
      const val = parts[1];
      return `${qty} X ${sizeMap[val] || val}`;
    }
    return sizeMap[s] || s;
  }).join(', ');
}

function CableTraySizingPage() {
  const confirm = useConfirm();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [cableDatabase, setCableDatabase] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const saved = localStorage.getItem("customCableCatalog");
      if (saved) return JSON.parse(saved);
    } catch {}
    return DEFAULT_CABLE_DATABASE;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [lastSelectedRowId, setLastSelectedRowId] = useState<string | null>(null);

  const [undoStack, setUndoStack] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);

  const pushToUndo = (state: any[]) => {
    setUndoStack(prev => [...prev, JSON.parse(JSON.stringify(state))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(old => old.slice(0, -1));
    setRedoStack(old => [...old, JSON.parse(JSON.stringify(trays))]);
    setTrays(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(old => old.slice(0, -1));
    setUndoStack(old => [...old, JSON.parse(JSON.stringify(trays))]);
    setTrays(next);
  };

  const toggleRowSelect = (rowId: string, isShift: boolean, isCtrl: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      const allRows: any[] = [];
      trays.forEach(t => t.cables.forEach(c => allRows.push(c)));
      const clickedIdx = allRows.findIndex(c => c.id === rowId);
      if (clickedIdx === -1) return prev;

      if (isShift && lastSelectedRowId) {
        const lastIdx = allRows.findIndex(c => c.id === lastSelectedRowId);
        if (lastIdx !== -1) {
          const start = Math.min(lastIdx, clickedIdx);
          const end = Math.max(lastIdx, clickedIdx);
          if (!isCtrl) {
            next.clear();
          }
          for (let i = start; i <= end; i++) {
            next.add(allRows[i].id);
          }
        }
      } else if (isCtrl) {
        if (next.has(rowId)) {
          next.delete(rowId);
        } else {
          next.add(rowId);
        }
      } else {
        next.clear();
        next.add(rowId);
      }
      return next;
    });
    setLastSelectedRowId(rowId);
  };

  const copyRows = (ids: string[]) => {
    const toCopy: any[] = [];
    trays.forEach(t => t.cables.forEach(c => {
      if (ids.includes(c.id)) {
        toCopy.push(c);
      }
    }));
    if (toCopy.length > 0) {
      localStorage.setItem("mep_clipboard_cables", JSON.stringify(toCopy));
      const text = toCopy.map(c => `${c.type}\t${c.from}\t${c.to}\t${c.cores}\t${c.size}\t${c.qty}\t${c.customOd || ""}\t${c.spacingFactor || ""}`).join("\n");
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  const cutRows = (ids: string[]) => {
    pushToUndo(trays);
    copyRows(ids);
    setTrays(prev => prev.map(t => ({
      ...t,
      cables: t.cables.filter(c => !ids.includes(c.id))
    })));
  };

  const pasteRows = () => {
    pushToUndo(trays);
    try {
      const clipboardData = localStorage.getItem("mep_clipboard_cables");
      if (clipboardData) {
        const parsed = JSON.parse(clipboardData);
        if (Array.isArray(parsed)) {
          const newRows = parsed.map(c => ({
            ...c,
            id: `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          }));
          
          setTrays(prev => {
            const next = [...prev];
            if (next.length > 0) {
              next[0].cables = [...next[0].cables, ...newRows];
            }
            return next;
          });
          setSelectedRows(new Set(newRows.map(c => c.id)));
          return newRows;
        }
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const [expandedTrayId, setExpandedTrayId] = useState<string | null>(null);
  const [trays, setTrays] = useState<Tray[]>([
    {
      id: `tray_${Date.now()}_1`,
      name: "Cable Tray 1 (Floor 1)",
      spareCapacity: 20,
      cables: [
        { id: `c_${Date.now()}_11`, type: 'XLPE/SWA/PVC', from: '', to: '', cores: '4C', size: '150', qty: 2 },
        { id: `c_${Date.now()}_12`, type: 'XLPE/SWA/PVC', from: '', to: '', cores: '4C', size: '240', qty: 1 }
      ]
    },
    {
      id: `tray_${Date.now()}_2`,
      name: "Cable Tray 2 (Floor 2)",
      spareCapacity: 20,
      cables: [
        { id: `c_${Date.now()}_21`, type: 'XLPE/SWA/PVC', from: '', to: '', cores: '4C', size: '16', qty: 3 }
      ]
    }
  ]);

  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      const clipboardData = e.clipboardData?.getData("Text");
      if (!clipboardData) return;
      e.preventDefault();

      pushToUndo(trays);

      // Check if it's JSON from our copy/cut action
      try {
        if (clipboardData.trim().startsWith("[") && clipboardData.trim().endsWith("]")) {
          const parsed = JSON.parse(clipboardData);
          if (Array.isArray(parsed) && parsed.length > 0 && 'cores' in parsed[0]) {
            const newRows = parsed.map(c => ({
              ...c,
              id: `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            }));
            setTrays(prev => {
              const next = [...prev];
              if (next.length > 0) {
                next[0].cables = [...next[0].cables, ...newRows];
              }
              return next;
            });
            setSelectedRows(new Set(newRows.map(c => c.id)));
            return;
          }
        }
      } catch (err) {
        // Fall back to tab-separated text
      }

      const pastedRows = clipboardData.trim().split("\n").map(r => r.split("\t"));
      
      const newRows = pastedRows.map((cols) => {
        return {
          id: `c_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          type: cols[0]?.trim() || "XLPE/SWA/PVC",
          from: cols[1]?.trim() || "",
          to: cols[2]?.trim() || "",
          cores: cols[3]?.trim() || "4C",
          size: cols[4]?.trim() || "16",
          qty: Number(cols[5]) || 1,
          customOd: cols[6] !== undefined && cols[6] !== "" ? Number(cols[6]) : undefined,
          spacingFactor: cols[7] !== undefined && cols[7] !== "" ? Number(cols[7]) : undefined,
        };
      });

      setTrays(prev => {
        const next = [...prev];
        if (next.length > 0) {
          next[0].cables = [...next[0].cables, ...newRows];
        }
        return next;
      });
      setSelectedRows(new Set(newRows.map(c => c.id)));
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [trays]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = new Set<string>();
        trays.forEach(t => t.cables.forEach(c => allIds.add(c.id)));
        setSelectedRows(allIds);
      }
      
      if (e.key === 'Escape') {
        setSelectedRows(new Set());
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          pushToUndo(trays);
          setTrays(prev => prev.map(t => ({
            ...t,
            cables: t.cables.filter(c => !selectedRows.has(c.id))
          })));
          setSelectedRows(new Set());
        }
      }

      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      }

      if ((isCmdOrCtrl && e.key.toLowerCase() === 'y') || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'c' && selectedRows.size > 0) {
        e.preventDefault();
        copyRows(Array.from(selectedRows));
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'x' && selectedRows.size > 0) {
        e.preventDefault();
        cutRows(Array.from(selectedRows));
        setSelectedRows(new Set());
      }

      if (isCmdOrCtrl && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        pasteRows();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [trays, selectedRows]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, rowIndex: number, colIndex: number) => {
    const isSelect = e.currentTarget.tagName === 'SELECT';

    if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Enter') {
      // Allow native select dropdown navigation
      if (isSelect && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;

      e.preventDefault();
      const allRows = document.querySelectorAll('tr[data-cable-row="true"]');
      let targetRowIndex = rowIndex;
      
      if (e.key === 'ArrowUp') targetRowIndex = Math.max(0, rowIndex - 1);
      if (e.key === 'ArrowDown' || e.key === 'Enter') targetRowIndex = Math.min(allRows.length - 1, rowIndex + 1);

      if (targetRowIndex !== rowIndex && allRows[targetRowIndex]) {
        const targetRow = allRows[targetRowIndex];
        const inputs = targetRow.querySelectorAll('input:not([type="hidden"]), select');
        const targetInput = inputs[colIndex] as HTMLElement;
        if (targetInput) {
          targetInput.focus();
          if (targetInput instanceof HTMLInputElement) {
            setTimeout(() => {
              try { targetInput.select(); } catch (e) {}
            }, 0);
          }
        }
      }
    }
    
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const currentInput = e.currentTarget;
      if (currentInput instanceof HTMLInputElement) {
        if (currentInput.type === 'text') {
          const isAtStart = currentInput.selectionStart === 0;
          const isAtEnd = currentInput.selectionEnd === (currentInput.value?.length || 0);
          
          if (!isAtStart && !isAtEnd) return;
          if (e.key === 'ArrowLeft' && !isAtStart) return;
          if (e.key === 'ArrowRight' && !isAtEnd) return;
        }
        // For number inputs, we just jump cell because selectionStart throws error
      }

      e.preventDefault();
      const currentRow = currentInput.closest('tr');
      if (currentRow) {
        const inputs = Array.from(currentRow.querySelectorAll('input:not([type="hidden"]), select')) as HTMLElement[];
        let targetColIndex = colIndex;
        if (e.key === 'ArrowLeft') targetColIndex = Math.max(0, colIndex - 1);
        if (e.key === 'ArrowRight') targetColIndex = Math.min(inputs.length - 1, colIndex + 1);
        
        if (targetColIndex !== colIndex && inputs[targetColIndex]) {
          inputs[targetColIndex].focus();
          if (inputs[targetColIndex] instanceof HTMLInputElement) {
            setTimeout(() => {
              try { (inputs[targetColIndex] as HTMLInputElement).select(); } catch (e) {}
            }, 0);
          }
        }
      }
    }
  };

  const addTray = () => {
    pushToUndo(trays);
    setTrays([...trays, {
      id: `tray_${Date.now()}_${Math.random()}`,
      name: `Cable Tray ${trays.length + 1}`,
      spareCapacity: 20,
      cables: []
    }]);
  };

  const removeTray = async (id: string) => {
    if (await confirm("Are you sure you want to delete this tray and all its cables?")) {
      pushToUndo(trays);
      setTrays(trays.filter(t => t.id !== id));
    }
  };

  const clearTray = async (id: string) => {
    if (await confirm("Are you sure you want to remove all cables from this tray?")) {
      pushToUndo(trays);
      setTrays(trays.map(t => t.id === id ? { ...t, cables: [] } : t));
    }
  };

  const updateTrayName = (id: string, name: string) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => t.id === id ? { ...t, name } : t));
  };

  const updateTraySpareCapacity = (id: string, spareCapacity: number | string) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => t.id === id ? { ...t, spareCapacity } : t));
  };

  const updateTraySpacingFactor = (id: string, spacingFactor: number | string) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => t.id === id ? { ...t, spacingFactor } : t));
  };

  const handleImportExcelCables = (trayId: string, mappedRows: any[]) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => {
      if (t.id === trayId) {
        const newCables: Cable[] = mappedRows.map((mr, idx) => ({
          id: `c_${Date.now()}_${Math.random()}_${idx}`,
          from: mr.from || "",
          to: mr.to || "",
          type: mr.type || "XLPE/SWA/PVC",
          cores: mr.cores || "4C",
          size: mr.size || "",
          qty: Number(mr.qty) || 1
        }));
        return {
          ...t,
          cables: [...t.cables, ...newCables]
        };
      }
      return t;
    }));
  };

  const addCable = (trayId: string) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => {
      if (t.id === trayId) {
        return {
          ...t,
          cables: [...t.cables, { id: `c_${Date.now()}_${Math.random()}`, type: 'XLPE/SWA/PVC', from: '', to: '', cores: '4C', size: '', qty: 1 }]
        };
      }
      return t;
    }));
  };

  const updateCable = (trayId: string, cableId: string, field: keyof Cable, val: any) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => {
      if (t.id === trayId) {
        return {
          ...t,
          cables: t.cables.map(c => c.id === cableId ? { ...c, [field]: val } : c)
        };
      }
      return t;
    }));
  };

  const removeCable = (trayId: string, cableId: string) => {
    pushToUndo(trays);
    setTrays(prev => prev.map(t => {
      if (t.id === trayId) {
        return { ...t, cables: t.cables.filter(c => c.id !== cableId) };
      }
      return t;
    }));
  };

  const exportExcel = () => {
    exportCableTrayExcel(trays, unitSystem, cableDatabase);
  };

  const handleImportCatalog = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      // Dynamically import exceljs to save initial bundle size
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      if (file.name.toLowerCase().endsWith(".csv")) {
        // Simple CSV parser for browser instead of exceljs node-based csv reader
        const text = await file.text();
        const lines = text.split("\\n");
        const newDb: Record<string, Record<string, number>> = {};
        if (lines.length > 0) {
          const headers = lines[0].toLowerCase().split(",");
          const coreIdx = headers.findIndex(h => h.includes("core"));
          const sizeIdx = headers.findIndex(h => h.includes("size") || h.includes("area"));
          const odIdx = headers.findIndex(h => h.includes("od") || h.includes("diameter"));
          if (coreIdx !== -1 && sizeIdx !== -1 && odIdx !== -1) {
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(",");
              if (cols.length > Math.max(coreIdx, sizeIdx, odIdx)) {
                let core = cols[coreIdx].trim();
                const size = cols[sizeIdx].trim();
                const od = Number(cols[odIdx].trim());
                if (core && size && !isNaN(od)) {
                  if (!core.toUpperCase().endsWith("C")) core += "C";
                  core = core.toUpperCase();
                  if (!newDb[core]) newDb[core] = {};
                  newDb[core][size] = od;
                }
              }
            }
          }
        }
        if (Object.keys(newDb).length > 0) {
          setCableDatabase(newDb);
          localStorage.setItem("customCableCatalog", JSON.stringify(newDb));
          alert("CSV Catalog imported successfully!");
        } else {
          alert("Invalid CSV format. Need columns containing 'Core', 'Size', and 'OD'.");
        }
      } else {
        await workbook.xlsx.load(arrayBuffer);
        const sheet = workbook.worksheets[0];
        const newDb: Record<string, Record<string, number>> = {};
        let coreIdx = -1, sizeIdx = -1, odIdx = -1;
        
        const headerRow = sheet.getRow(1);
        headerRow.eachCell((cell, colNumber) => {
          const val = String(cell.value || "").toLowerCase();
          if (val.includes("core")) coreIdx = colNumber;
          else if (val.includes("size") || val.includes("area")) sizeIdx = colNumber;
          else if (val.includes("od") || val.includes("diameter")) odIdx = colNumber;
        });

        if (coreIdx === -1 || sizeIdx === -1 || odIdx === -1) {
          alert("Invalid format! Excel must have columns containing 'Core', 'Size', and 'OD' (or 'Diameter').");
          return;
        }

        sheet.eachRow((row, rowNumber) => {
          if (rowNumber === 1) return; // skip header
          let core = String(row.getCell(coreIdx).value || "").trim();
          const size = String(row.getCell(sizeIdx).value || "").trim();
          const od = Number(row.getCell(odIdx).value);
          if (core && size && !isNaN(od)) {
            if (!core.toUpperCase().endsWith("C")) core += "C";
            core = core.toUpperCase();
            if (!newDb[core]) newDb[core] = {};
            newDb[core][size] = od;
          }
        });
        
        if (Object.keys(newDb).length > 0) {
          setCableDatabase(newDb);
          localStorage.setItem("customCableCatalog", JSON.stringify(newDb));
          alert("Excel Catalog imported successfully!");
        } else {
          alert("No valid data found in the Excel file.");
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error parsing file.");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const resetCatalog = async () => {
    if (await confirm("Are you sure you want to reset the cable catalog to defaults?")) {
      setCableDatabase(DEFAULT_CABLE_DATABASE);
      localStorage.removeItem("customCableCatalog");
    }
  };

  const exportPdf = () => {
    const doc = new jsPDF("landscape");
    doc.text("Cable Tray Sizing", 14, 15);
    
    let currentY = 20;

    trays.forEach((tray, i) => {
      let subTotal1 = 0;
      let hasValidCables = false;
      const tableData = tray.cables.map((c, idx) => {
        const baseOd = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
        const od = c.customOd !== undefined && c.customOd !== "" ? Number(c.customOd) : baseOd;
        const qtyNum = typeof c.qty === "number" ? c.qty : 0;
        const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
        if (!isNaN(sumOd) && qtyNum > 0) {
          subTotal1 += sumOd;
          hasValidCables = true;
        }
        return [
          idx + 1, c.type, c.cores, c.size, c.qty.toString(), 
          isNaN(od) ? "-" : od.toFixed(1),
          isNaN(sumOd) ? "-" : sumOd.toFixed(1)
        ];
      });

      const spacingFactor = Number(tray.spacingFactor ?? 1);
      const spacingWidth = subTotal1 * spacingFactor;
      const subTotal2 = subTotal1 + spacingWidth;
      const sparePercentage = Number(tray.spareCapacity ?? 20);
      const spareWidth = subTotal2 * (sparePercentage / 100);
      const totalWidth = subTotal2 + spareWidth;
      const traySize = hasValidCables ? getCableTraySize(totalWidth) : 'N/A';

      if (i > 0 && currentY > 160) {
         doc.addPage();
         currentY = 15;
      }

      doc.setFontSize(12);
      doc.text(tray.name, 14, currentY + 5);

      autoTable(doc, {
        head: [["No.", "Cable Type", "Cores", "Size (mm²)", "Qty", "O.D.(mm)", "Sum O.D.(mm)"]],
        body: tableData,
        startY: currentY + 10,
        styles: { fontSize: 9 },
        margin: { bottom: 20 }
      });

      currentY = (doc as any).lastAutoTable.finalY;
      
      doc.setFontSize(10);
      doc.text(`Required Width: ${hasValidCables ? Math.round(totalWidth) + ' mm' : '-'}`, 14, currentY + 7);
      doc.text(`Cable Tray Size: ${traySize}`, 100, currentY + 7);
      
      currentY += 15;
    });

    if (trays.length === 0) {
       doc.text("No trays to export.", 14, 30);
    }

    doc.save("Cable_Tray_Sizing.pdf");
  };

  const actions = (
    <>
      <div className="relative w-64 mr-2 hidden md:block">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search cables or trays..."
          className="flex h-8 w-full rounded-md border border-input bg-background pl-9 pr-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
      <input type="file" ref={fileInputRef} onChange={handleImportCatalog} className="hidden" accept=".xlsx, .xls, .csv" />
      <TBtn onClick={() => fileInputRef.current?.click()}><Upload className="size-3.5" /> Import Catalog</TBtn>
      <TBtn onClick={resetCatalog}><RefreshCcw className="size-3.5" /> Reset</TBtn>
      <TBtn onClick={exportExcel}><Download className="size-3.5" /> Excel</TBtn>
      <TBtn onClick={exportPdf}><Download className="size-3.5" /> PDF</TBtn>
      <TBtn primary onClick={addTray}><Plus className="size-3.5" /> Add Tray</TBtn>
    </>
  );

  let globalRowIndex = 0;

  return (
    <AppShell title="Cable Tray Sizing" subtitle="Calculate cable tray containment sizes" actions={actions}>
      <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30">
        {/* Subtle Grid Background */}
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        <div className="relative z-10 flex flex-col h-full w-full">
        {/* Sizer Section Header with Unit Switcher */}
        <div className="flex items-center justify-between px-4 h-9 border-b border-border bg-background shrink-0 select-none">
          <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wide">
            Sizer Workspace
          </div>
          <div className="flex rounded border border-border p-0.5 bg-surface-2 shrink-0 my-1 mr-3">
            <button
              onClick={() => setUnitSystem("si")}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                unitSystem === "si" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SI
            </button>
            <button
              onClick={() => setUnitSystem("ip")}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                unitSystem === "ip" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              IP
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto flex flex-col p-4 gap-6 bg-surface-1/50">
        
        {trays.map((tray, trayIndex) => {
          const sq = searchQuery.toLowerCase();
          const filteredCables = tray.cables.filter(c => 
            (c.type || '').toLowerCase().includes(sq) || 
            (c.cores || '').toLowerCase().includes(sq) || 
            (c.size || '').toLowerCase().includes(sq) ||
            (tray.name || '').toLowerCase().includes(sq)
          );

          if (sq && filteredCables.length === 0 && !(tray.name.toLowerCase().includes(sq))) {
            return null;
          }

          let subTotal1 = 0;
          let hasValidCables = false;
          
          const calcCables = filteredCables.map(c => {
            const baseOd = c.cores && c.size ? cableDatabase[c.cores]?.[c.size] || NaN : NaN;
            const od = c.customOd !== undefined && c.customOd !== "" ? Number(c.customOd) : baseOd;
            const qtyNum = typeof c.qty === 'number' ? c.qty : 0;
            const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
            
            if (!isNaN(sumOd) && qtyNum > 0) {
              subTotal1 += sumOd;
              hasValidCables = true;
            }
            return { ...c, od, sumOd };
          });

          const spacingFactor = Number(tray.spacingFactor ?? 1);
          const spacingWidth = subTotal1 * spacingFactor;
          const subTotal2 = subTotal1 + spacingWidth;
          const sparePercentage = Number(tray.spareCapacity ?? 20);
          const spareWidth = subTotal2 * (sparePercentage / 100);
          const totalWidth = subTotal2 + spareWidth;
          const traySize = hasValidCables ? getCableTraySize(totalWidth) : 'N/A';

          const isExpanded = expandedTrayId === null ? trayIndex === 0 : expandedTrayId === tray.id;

          return (
            <div key={tray.id} className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col overflow-hidden shrink-0">
              
              {/* Tray Header */}
              <div 
                className="bg-surface-2/50 border-b border-border px-3 py-1.5 flex items-center justify-between gap-3 flex-wrap cursor-pointer select-none hover:bg-surface-2/80 transition-colors"
                onClick={() => setExpandedTrayId(isExpanded ? "NONE" : tray.id)}
              >
                <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                  <div className="w-1 h-4 bg-primary rounded-sm"></div>
                  <input 
                    type="text" 
                    className="font-bold text-sm bg-transparent border-none outline-none focus:border-b-2 focus:border-primary px-1 py-0 text-foreground w-full max-w-sm"
                    value={tray.name}
                    onChange={(e) => updateTrayName(tray.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Tray Name..."
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <TBtn onClick={() => clearTray(tray.id)}><Trash2 className="size-3.5" /> Clear Cables</TBtn>
                    <button 
                      onClick={() => removeTray(tray.id)}
                      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-xs font-medium transition-colors focus-visible:outline-none h-8 px-3 py-1 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash className="size-3.5" /> Delete Tray
                    </button>
                  </div>
                  <div className="px-2 text-muted-foreground flex items-center justify-center pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn("h-4 w-4 transition-transform duration-200", isExpanded ? "rotate-180" : "")}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Collapsible Content */}
              {isExpanded && (
                <div className="flex flex-col">

              {/* Cables Table */}
              <div className="w-full overflow-x-auto">
                <table className="w-full text-[13px] border-collapse whitespace-nowrap">
                  <thead className="bg-header-bg border-b border-border text-muted-foreground font-semibold">
                    <tr className="text-left">
                      <th className="px-3 py-1.5 border-r border-border text-center w-10">No.</th>
                      <th className="px-3 py-1.5 border-r border-border w-1/4">Cable Type</th>
                      <th className="px-3 py-1.5 border-r border-border w-32">From</th>
                      <th className="px-3 py-1.5 border-r border-border w-32">To</th>
                      <th className="px-3 py-1.5 border-r border-border w-32">No. of Cores</th>
                      <th className="px-3 py-1.5 border-r border-border w-32">Cable Size (mm²)</th>
                      <th className="px-3 py-1.5 border-r border-border w-20 text-center">Qty</th>
                      <th className="px-3 py-1.5 border-r border-border w-24 text-center bg-surface-2 text-foreground">O.D. ({unitSystem === "si" ? "mm" : "in"})</th>
                      <th className="px-3 py-1.5 border-r border-border w-24 text-center bg-surface-2 text-foreground">Sum O.D. ({unitSystem === "si" ? "mm" : "in"})</th>
                      <th className="px-3 py-1.5 text-center w-10">✕</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {calcCables.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground italic">
                          No cables in this tray. Click "+ Add Cable" to start.
                        </td>
                      </tr>
                    ) : (
                      calcCables.map((c, idx) => {
                        const currentGlobalRowIndex = globalRowIndex++;
                        const sizesForCore = c.cores ? Object.keys(cableDatabase[c.cores] || {}).sort((a,b) => parseFloat(a) - parseFloat(b)) : [];
                        return (
                          <tr key={c.id} data-cable-row="true" className={cn(
                            "hover:bg-surface-2/50 transition-colors",
                            selectedRows.has(c.id) ? "bg-primary/10" : ""
                          )} onClick={(e) => {
                            const tagName = (e.target as HTMLElement).tagName;
                            if (tagName === 'TD') {
                              toggleRowSelect(c.id, e.shiftKey, e.ctrlKey || e.metaKey);
                            }
                          }}>
                            <td className="text-center text-muted-foreground border-r border-border">{idx + 1}</td>
                            <td className="p-0 border-r border-border">
                              <select 
                                className="w-full bg-transparent outline-none h-full focus:bg-background px-2 cursor-pointer"
                                value={c.type}
                                onChange={e => updateCable(tray.id, c.id, "type", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 0)}
                              >
                                <option value="XLPE/SWA/PVC">XLPE/SWA/PVC</option>
                                <option value="PVC/PVC">PVC/PVC</option>
                                <option value="XLPE/PVC">XLPE/PVC</option>
                                <option value="Fire Resistant">Fire Resistant</option>
                              </select>
                            </td>
                            <td className="p-0 border-r border-border">
                              <input 
                                className="w-full h-8 px-2 bg-transparent outline-none focus:bg-background"
                                value={c.from || ""}
                                onChange={e => updateCable(tray.id, c.id, "from", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 1)}
                                placeholder="e.g. PANEL-01"
                              />
                            </td>
                            <td className="p-0 border-r border-border">
                              <input 
                                className="w-full h-8 px-2 bg-transparent outline-none focus:bg-background"
                                value={c.to || ""}
                                onChange={e => updateCable(tray.id, c.id, "to", e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 2)}
                                placeholder="e.g. SMDB-01"
                              />
                            </td>
                            <td className="p-0 border-r border-border">
                              <select 
                                className="w-full bg-transparent outline-none h-full focus:bg-background px-2 cursor-pointer"
                                value={c.cores}
                                onChange={e => {
                                  updateCable(tray.id, c.id, "cores", e.target.value);
                                  updateCable(tray.id, c.id, "size", ""); // reset size
                                  updateCable(tray.id, c.id, "customOd", ""); // reset OD
                                }}
                                onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 3)}
                              >
                                <option value="">-- Select --</option>
                                {Object.keys(cableDatabase).map(core => (
                                  <option key={core} value={core}>{core}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-0 border-r border-border">
                              <select className="w-full h-8 px-3 bg-transparent outline-none focus:bg-background text-foreground cursor-pointer" value={c.size} onChange={e => {
                                updateCable(tray.id, c.id, "size", e.target.value);
                                updateCable(tray.id, c.id, "customOd", ""); // reset OD on size change
                              }} onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 4)} disabled={!c.cores}>
                                <option value="">{c.cores ? "-- Select --" : "-- Core First --"}</option>
                                {sizesForCore.map(sz => (
                                  <option key={sz} value={sz}>{sz}</option>
                                ))}
                              </select>
                            </td>
                            <td className="p-0 border-r border-border">
                              <input type="number" min="1" className="w-full h-8 px-3 text-center bg-transparent outline-none focus:bg-background text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={c.qty} onChange={e => {
                                const val = e.target.value;
                                updateCable(tray.id, c.id, "qty", val === "" ? "" : (parseInt(val) || 1));
                              }} onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 5)} />
                            </td>
                            <td className="p-0 border-r border-border bg-surface-2 text-foreground">
                              <input 
                                type="number" 
                                step="any"
                                className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-background font-mono font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                                value={c.customOd !== undefined && c.customOd !== "" ? (unitSystem === "si" ? c.customOd : (Number(c.customOd) / 25.4).toFixed(2)) : (isNaN(c.od) ? "" : (unitSystem === "si" ? c.od.toFixed(1) : (c.od / 25.4).toFixed(2)))} 
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val === "") {
                                    updateCable(tray.id, c.id, "customOd", "");
                                  } else {
                                    updateCable(tray.id, c.id, "customOd", unitSystem === "si" ? val : (parseFloat(val) * 25.4).toString());
                                  }
                                }} 
                                onKeyDown={(e) => handleKeyDown(e, currentGlobalRowIndex, 6)} 
                              />
                            </td>
                            <td className="px-3 py-1 text-center font-mono font-medium border-r border-border bg-surface-2 text-foreground">
                              {isNaN(c.sumOd) ? "-" : (unitSystem === "si" ? c.sumOd.toFixed(1) : (c.sumOd / 25.4).toFixed(2))}
                            </td>
                            <td className="text-center p-0">
                              <button onClick={() => removeCable(tray.id, c.id)} className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 w-full h-8 flex items-center justify-center transition-colors">
                                <Trash2 className="size-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                    {/* Add Cable Row button inline */}
                    <tr>
                      <td colSpan={10} className="p-0">
                        <div className="flex border-t border-border border-dashed w-full">
                          <button onClick={() => addCable(tray.id)} className="flex-1 py-1.5 flex items-center justify-center gap-2 text-sm text-primary font-medium hover:bg-primary/5 transition-colors">
                            <Plus className="size-3.5" /> Add Cable
                          </button>
                          <div className="w-px bg-border border-dashed" />
                          <ImportExcelBtn
                            columnMapping={{
                              "From": "from",
                              "To": "to",
                              "Cable Type": "type",
                              "Type": "type",
                              "Cores": "cores",
                              "Core": "cores",
                              "Size": "size",
                              "Qty": "qty",
                              "Quantity": "qty"
                            }}
                            onImport={(rows) => handleImportExcelCables(tray.id, rows)}
                            className="flex-1 py-1.5 flex items-center justify-center gap-2 text-sm text-primary font-medium hover:bg-primary/5 transition-colors !border-0 bg-transparent rounded-none"
                          />
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Excel-like Breakdown Footer */}
              <div className="bg-surface-2/30 border-t border-border p-4 flex justify-end">
                <div className="flex flex-col gap-1.5 w-72 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Sub Total 1</span>
                    <span className="font-mono">{hasValidCables ? (unitSystem === "si" ? Math.round(subTotal1) : (subTotal1 / 25.4).toFixed(1)) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground border-b border-border border-dashed pb-1.5">
                    <span className="flex items-center gap-1">
                      <input 
                        type="text" 
                        className="w-12 bg-transparent border-b border-muted-foreground/30 text-foreground font-medium outline-none focus:border-primary text-center p-0 cursor-text" 
                        value={tray.spacingFactor !== undefined ? tray.spacingFactor : "1"} 
                        onChange={(e) => updateTraySpacingFactor(tray.id, e.target.value)} 
                        onBlur={(e) => updateTraySpacingFactor(tray.id, e.target.value === '' ? 1 : Number(e.target.value))}
                      />
                      D spacing
                    </span>
                    <span className="font-mono">{hasValidCables ? (unitSystem === "si" ? Math.round(spacingWidth) : (spacingWidth / 25.4).toFixed(1)) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1.5">
                    <span className="font-medium">Sub Total 2</span>
                    <span className="font-mono font-medium">{hasValidCables ? (unitSystem === "si" ? Math.round(subTotal2) : (subTotal2 / 25.4).toFixed(1)) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground border-b border-border border-dashed pb-1.5">
                    <span className="flex items-center gap-1">
                      <select 
                        className="bg-transparent border-b border-muted-foreground/30 text-foreground font-medium outline-none focus:border-primary text-center p-0 cursor-pointer"
                        value={tray.spareCapacity !== undefined ? tray.spareCapacity : 20}
                        onChange={(e) => updateTraySpareCapacity(tray.id, Number(e.target.value))}
                      >
                        <option value="0">0</option>
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="15">15</option>
                        <option value="20">20</option>
                        <option value="25">25</option>
                        <option value="30">30</option>
                        <option value="40">40</option>
                        <option value="50">50</option>
                      </select>
                      % Minimum spare Space
                    </span>
                    <span className="font-mono">{hasValidCables ? (unitSystem === "si" ? Math.round(spareWidth) : (spareWidth / 25.4).toFixed(1)) : '-'}</span>
                  </div>
                  <div className="flex justify-between text-foreground pt-1.5 font-bold">
                    <span>Total</span>
                    <span className="font-mono">{hasValidCables ? (unitSystem === "si" ? Math.round(totalWidth) : (totalWidth / 25.4).toFixed(1)) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center text-primary pt-3 mt-1 border-t border-border font-black text-base">
                    <span>Cable Tray Size</span>
                    <span className="font-mono bg-primary/10 px-2 py-0.5 rounded">{formatTraySize(traySize, unitSystem === "si")}</span>
                  </div>
                </div>
              </div>

              </div>
              )}

            </div>
          );
        })}
        
        {trays.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl p-10">
            <Trash2 className="size-10 mb-4 opacity-20" />
            <p className="text-lg font-medium">No cable trays found.</p>
            <p className="text-sm">Click "Add Tray" in the top bar to get started.</p>
          </div>
        )}
      </div>
      </div>
      </div>
    </AppShell>
  );
}

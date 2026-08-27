import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/lib/workspace-store";
import { addPdfSignatureBlock, addPdfHeader } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { TBtn } from "@/components/workspace/Button";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { TaskComment } from "@/lib/ventilation-calc";
import { toast } from "sonner";
import { Plus, Trash2, Download, Upload, ChevronRight, ChevronDown, Trash, Copy, Check, ArrowRight, Zap, FolderPlus, X, Eye, EyeOff, LayoutGrid, Info, Search, FileText, Edit3, MessageSquare } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/busbar-calculation")({
  head: () => ({
    meta: [
      { title: "Busbar Calculation — MEP Calc" },
      { name: "description", content: "Calculate busbar voltage drop and parameters." },
    ],
  }),
  component: BusbarCalculationPage,
});

const COPPER_BUSBAR_DATA: Record<string, { r: number; x: number; label: string }> = {
  "1000_rt": { r: 0.0523, x: 0.019, label: "1000 (Rt)" },
  "1000_r50": { r: 0.0474, x: 0.019, label: "1000 (R@50%RC)" },
  "1250_rt": { r: 0.0398, x: 0.017, label: "1250 (Rt)" },
  "1250_r50": { r: 0.0348, x: 0.017, label: "1250 (R@50%RC)" },
  "1600_rt": { r: 0.0277, x: 0.015, label: "1600 (Rt)" },
  "1600_r50": { r: 0.0237, x: 0.015, label: "1600 (R@50%RC)" },
  "2000_rt": { r: 0.0218, x: 0.014, label: "2000 (Rt)" },
  "2000_r50": { r: 0.0187, x: 0.014, label: "2000 (R@50%RC)" },
  "2500_rt": { r: 0.0177, x: 0.010, label: "2500 (Rt)" },
  "2500_r50": { r: 0.0151, x: 0.010, label: "2500 (R@50%RC)" },
  "3200_rt": { r: 0.0121, x: 0.006, label: "3200 (Rt)" },
  "3200_r50": { r: 0.0114, x: 0.006, label: "3200 (R@50%RC)" },
  "4000_rt": { r: 0.0108, x: 0.006, label: "4000 (Rt)" },
  "4000_r50": { r: 0.0093, x: 0.006, label: "4000 (R@50%RC)" },
  "5000_rt": { r: 0.0089, x: 0.005, label: "5000 (Rt)" },
  "5000_r50": { r: 0.0075, x: 0.005, label: "5000 (R@50%RC)" },
  "6300_rt": { r: 0.0065, x: 0.005, label: "6300 (Rt)" },
  "6300_r50": { r: 0.0061, x: 0.005, label: "6300 (R@50%RC)" }
};

interface BusbarRow {
  id: string;
  from: string;
  desc: string;
  ref: string;
  length: number | "";
  loadKw: number | "";
  div: number | "";
  comments?: TaskComment[];
}

interface BusbarSection {
  id: string;
  name: string;
  ratingId: string;
  volts: number | "";
  pf: number | "";
  rows: BusbarRow[];
}

interface LVPanel {
  id: string;
  name: string;
  sections: BusbarSection[];
}

function BusbarCalculationPage() {
  const { userData, profile } = useAuth();
  const { project } = useWorkspace();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const [panels, setPanels] = useState<LVPanel[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep-busbar-calculation-v1");
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse busbar panels:", e);
      }
    }
    const isIp = false;
    return [{
      id: `pan_${Date.now()}`,
      name: "LV PANEL-1",
      sections: [{
        id: `sec_${Date.now()}`,
        name: "BB-1",
        ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: [
          { id: `bb_${Date.now()}_1`, from: 'LV PANEL-1', desc: 'SMDB-L7-1', ref: 'BB-1', length: isIp ? Number((160.0 * 3.28084).toFixed(2)) : 160.0, loadKw: 112.08, div: 0.7 },
          { id: `bb_${Date.now()}_2`, from: 'LV PANEL-1', desc: 'SMDB-L8-1', ref: 'BB-1', length: isIp ? Number((3.5 * 3.28084).toFixed(2)) : 3.5, loadKw: 112.08, div: 0.7 },
          { id: `bb_${Date.now()}_3`, from: 'LV PANEL-1', desc: 'SMDB-L9-1', ref: 'BB-1', length: isIp ? Number((3.5 * 3.28084).toFixed(2)) : 3.5, loadKw: 112.08, div: 0.7 },
          { id: `bb_${Date.now()}_4`, from: 'LV PANEL-1', desc: 'SMDB-L10-1', ref: 'BB-1', length: isIp ? Number((3.5 * 3.28084).toFixed(2)) : 3.5, loadKw: 112.08, div: 0.7 }
        ]
      }]
    }];
  });

  useEffect(() => {
    localStorage.setItem("mep-busbar-calculation-v1", JSON.stringify(panels));
    if (project?.id) {
      try {
        localStorage.setItem(`mep_busbar_calc_${project.id}`, JSON.stringify({
          panels,
          updatedAt: new Date().toISOString()
        }));
      } catch (e) {}
    }
  }, [panels, project?.id]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    panelId: string;
    sectionId: string;
    rowId: string;
  } | null>(null);

  const [commentTarget, setCommentTarget] = useState<{
    id: string;
    name: string;
    type: 'space' | 'zone' | 'equipment';
    panelId: string;
    sectionId: string;
  } | null>(null);

  const [assignCommentOpen, setAssignCommentOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  const [customBusbars, setCustomBusbars] = useState<Record<string, { r: number; x: number; label: string }>>({});
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [collapsedPanels, setCollapsedPanels] = useState<Set<string>>(new Set());
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
    setRedoStack(old => [...old, JSON.parse(JSON.stringify(panels))]);
    setPanels(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(old => old.slice(0, -1));
    setUndoStack(old => [...old, JSON.parse(JSON.stringify(panels))]);
    setPanels(next);
  };

  const toggleRowSelect = (rowId: string, isShift: boolean, isCtrl: boolean) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      const allRows: any[] = [];
      panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => allRows.push(r))));
      const clickedIdx = allRows.findIndex(r => r.id === rowId);
      if (clickedIdx === -1) return prev;

      if (isShift && lastSelectedRowId) {
        const lastIdx = allRows.findIndex(r => r.id === lastSelectedRowId);
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
    panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => {
      if (ids.includes(r.id)) {
        toCopy.push(r);
      }
    })));
    if (toCopy.length > 0) {
      localStorage.setItem("mep_clipboard_busbars", JSON.stringify(toCopy));
      const text = toCopy.map(r => `${r.from}\t${r.desc}\t${r.ref}\t${r.length}\t${r.loadKw}\t${r.div}`).join("\n");
      navigator.clipboard?.writeText(text).catch(() => {});
    }
  };

  const cutRows = (ids: string[]) => {
    pushToUndo(panels);
    copyRows(ids);
    setPanels(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => ({
        ...s,
        rows: s.rows.filter(r => !ids.includes(r.id))
      }))
    })));
  };

  const pasteRows = () => {
    pushToUndo(panels);
    try {
      const clipboardData = localStorage.getItem("mep_clipboard_busbars");
      if (clipboardData) {
        const parsed = JSON.parse(clipboardData);
        if (Array.isArray(parsed)) {
          const newRows = parsed.map(r => ({
            ...r,
            id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`
          }));
          
          setPanels(prev => {
            const next = [...prev];
            if (next.length > 0 && next[0].sections.length > 0) {
              next[0].sections[0] = { 
                ...next[0].sections[0], 
                rows: [...next[0].sections[0].rows, ...newRows] 
              };
            }
            return next;
          });
          setSelectedRows(new Set(newRows.map(r => r.id)));
          return newRows;
        }
      }
    } catch (err) {
      console.error(err);
    }
    return [];
  };

  const ALL_BUSBAR_DATA = useMemo(() => ({ ...COPPER_BUSBAR_DATA, ...customBusbars }), [customBusbars]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      const clipboardData = e.clipboardData?.getData("Text");
      if (!clipboardData) return;
      e.preventDefault();

      pushToUndo(panels);

      // Check if it's JSON from our copy/cut action
      try {
        if (clipboardData.trim().startsWith("[") && clipboardData.trim().endsWith("]")) {
          const parsed = JSON.parse(clipboardData);
          if (Array.isArray(parsed) && parsed.length > 0 && 'from' in parsed[0]) {
            const newRows = parsed.map(r => ({
              ...r,
              id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`
            }));
            setPanels(prev => {
              const next = [...prev];
              if (next.length > 0 && next[0].sections.length > 0) {
                next[0].sections[0] = { 
                  ...next[0].sections[0], 
                  rows: [...next[0].sections[0].rows, ...newRows] 
                };
              }
              return next;
            });
            setSelectedRows(new Set(newRows.map(r => r.id)));
            return;
          }
        }
      } catch (err) {
        // Fall back to tab-separated text
      }

      const pastedRows = clipboardData.trim().split("\n").map(r => r.split("\t"));
      
      const newRows = pastedRows.map((cols) => {
        return {
          id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          from: cols[0]?.trim() || "LV PANEL-1",
          desc: cols[1]?.trim() || "",
          ref: cols[2]?.trim() || "BB-1",
          length: (cols[3] !== undefined && cols[3] !== "" ? Number(cols[3]) : "") as number | "",
          loadKw: (cols[4] !== undefined && cols[4] !== "" ? Number(cols[4]) : "") as number | "",
          div: cols[5] !== undefined && cols[5] !== "" ? Number(cols[5]) : 0.7,
        };
      });

      setPanels(prev => {
        const next = [...prev];
        if (next.length > 0 && next[0].sections.length > 0) {
          next[0].sections[0] = { ...next[0].sections[0], rows: [...next[0].sections[0].rows, ...newRows] };
        }
        return next;
      });
      setSelectedRows(new Set(newRows.map(r => r.id)));
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [panels]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          setSelectedRows(new Set());
          setLastSelectedRowId(null);
        }
        return;
      }

      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const allIds = new Set<string>();
        panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => allIds.add(r.id))));
        setSelectedRows(allIds);
      }
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedRows.size > 0) {
          e.preventDefault();
          pushToUndo(panels);
          setPanels(prev => prev.map(p => ({
            ...p,
            sections: p.sections.map(s => ({
              ...s,
              rows: s.rows.filter(r => !selectedRows.has(r.id))
            }))
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
  }, [panels, selectedRows, undoStack, redoStack]);

  const togglePanel = (id: string) => {
    setCollapsedPanels(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleUnitToggle = (newSystem: "si" | "ip") => {
    if (newSystem === unitSystem) return;
    pushToUndo(panels);
    setUnitSystem(newSystem);
    setPanels(prev => prev.map(p => ({
      ...p,
      sections: p.sections.map(s => ({
        ...s,
        rows: s.rows.map(r => ({
          ...r,
          length: newSystem === "ip" ? Number((Number(r.length) * 3.28084).toFixed(2)) : Number((Number(r.length) / 3.28084).toFixed(2))
        }))
      }))
    })));
  };

  const addPanel = () => {
    pushToUndo(panels);
    const num = panels.length + 1;
    setPanels([...panels, {
      id: `pan_${Date.now()}`,
      name: `LV PANEL-${num}`,
      sections: [{
        id: `sec_${Date.now()}`,
        name: `BB-1`,
        ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: []
      }]
    }]);
  };

  const removePanel = async (id: string) => {
    if (panels.length === 1) {
      if (await confirm("Are you sure you want to clear the only panel?")) {
        pushToUndo(panels);
        setPanels([{ ...panels[0], sections: [] }]);
      }
      return;
    }
    if (await confirm("Are you sure you want to remove this LV Panel?")) {
      pushToUndo(panels);
      setPanels(panels.filter(p => p.id !== id));
    }
  };

  const updatePanel = (id: string, field: keyof LVPanel, val: any) => {
    pushToUndo(panels);
    setPanels(panels.map(p => p.id === id ? { ...p, [field]: val } : p));
  };

  const addSection = (panelId: string) => {
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        const num = p.sections.length + 1;
        return {
          ...p,
          sections: [...p.sections, {
            id: `sec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: `BB-${num}`,
            ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: []
          }]
        };
      }
      return p;
    }));
  };

  const removeSection = async (panelId: string, sectionId: string) => {
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return { ...p, sections: p.sections.filter(s => s.id !== sectionId) };
      }
      return p;
    }));
  };

  const updateSection = (panelId: string, sectionId: string, field: keyof BusbarSection, val: any) => {
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => s.id === sectionId ? { ...s, [field]: val } : s)
        };
      }
      return p;
    }));
  };

  const handleImportExcelRows = (panelId: string, sectionId: string, mappedRows: any[]) => {
    if (!mappedRows || mappedRows.length === 0) return;
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => {
            if (s.id === sectionId) {
              // Check if current section only has a single default empty row
              const isDefaultSingleRow = s.rows.length === 1 && 
                (!s.rows[0].loadKw || s.rows[0].loadKw === 0) && 
                (!s.rows[0].length || s.rows[0].length === 10) &&
                (!s.rows[0].desc || s.rows[0].desc === "Tap Off 1");

              if (isDefaultSingleRow || s.rows.length === 0) {
                // Completely replace default row with imported Excel rows
                const newRows: BusbarRow[] = mappedRows.map((mr, idx) => ({
                  id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`,
                  from: mr.from !== undefined && String(mr.from).trim() !== "" ? String(mr.from).trim() : (idx === 0 ? p.name : ""),
                  desc: mr.desc !== undefined && String(mr.desc).trim() !== "" ? String(mr.desc).trim() : `Tap Off ${idx + 1}`,
                  ref: mr.ref !== undefined && String(mr.ref).trim() !== "" ? String(mr.ref).trim() : s.name,
                  length: mr.length !== undefined && mr.length !== "" && !isNaN(Number(mr.length)) ? Number(mr.length) : 10,
                  loadKw: mr.loadKw !== undefined && mr.loadKw !== "" && !isNaN(Number(mr.loadKw)) ? Number(mr.loadKw) : 0,
                  div: mr.div !== undefined && mr.div !== "" && !isNaN(Number(mr.div)) ? Number(mr.div) : 0.7,
                }));
                return { ...s, rows: newRows };
              }

              const currentRows = [...s.rows];
              const updatedRows: BusbarRow[] = [];

              mappedRows.forEach((mr, idx) => {
                const descVal = mr.desc !== undefined ? String(mr.desc).trim() : "";
                const fromVal = mr.from !== undefined ? String(mr.from).trim() : "";
                const refVal = mr.ref !== undefined ? String(mr.ref).trim() : "";
                const lenVal = mr.length !== undefined && mr.length !== "" && !isNaN(Number(mr.length)) ? Number(mr.length) : "";
                const loadVal = mr.loadKw !== undefined && mr.loadKw !== "" && !isNaN(Number(mr.loadKw)) ? Number(mr.loadKw) : "";
                const divVal = mr.div !== undefined && mr.div !== "" && !isNaN(Number(mr.div)) ? Number(mr.div) : 0.7;

                if (idx < currentRows.length) {
                  // Update existing row
                  updatedRows.push({
                    ...currentRows[idx],
                    desc: descVal !== "" ? descVal : currentRows[idx].desc,
                    from: fromVal !== "" ? fromVal : currentRows[idx].from,
                    ref: refVal !== "" ? refVal : currentRows[idx].ref,
                    length: lenVal !== "" ? lenVal : currentRows[idx].length,
                    loadKw: loadVal !== "" ? loadVal : currentRows[idx].loadKw,
                    div: divVal !== "" ? divVal : currentRows[idx].div,
                  });
                } else {
                  // Append new row
                  updatedRows.push({
                    id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}_${idx}`,
                    from: fromVal || p.name,
                    desc: descVal || `Tap Off ${idx + 1}`,
                    ref: refVal || s.name,
                    length: lenVal !== "" ? lenVal : 10,
                    loadKw: loadVal !== "" ? loadVal : 0,
                    div: divVal,
                  });
                }
              });

              // Keep any remaining existing rows if imported rows count < currentRows.length
              if (mappedRows.length < currentRows.length) {
                for (let i = mappedRows.length; i < currentRows.length; i++) {
                  updatedRows.push(currentRows[i]);
                }
              }

              return { ...s, rows: updatedRows };
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const addRow = (panelId: string, sectionId: string) => {
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => {
            if (s.id === sectionId) {
              const newRow: BusbarRow = {
                id: `bb_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                from: s.rows.length === 0 ? p.name : s.rows[s.rows.length - 1].from,
                desc: s.rows.length === 0 ? "SMDB-L7-1" : "",
                ref: s.name,
                length: "",
                loadKw: "",
                div: 0.7,
              };
              return { ...s, rows: [...s.rows, newRow] };
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const removeRow = (panelId: string, sectionId: string, rowId: string) => {
    pushToUndo(panels);
    setPanels(panels.map(p => {
      if (p.id === panelId) {
        return {
          ...p,
          sections: p.sections.map(s => {
            if (s.id === sectionId) {
              return { ...s, rows: s.rows.filter(r => r.id !== rowId) };
            }
            return s;
          })
        };
      }
      return p;
    }));
  };

  const updateRow = (panelId: string, sectionId: string, rowId: string, field: keyof BusbarRow, val: any) => {
    pushToUndo(panels);
    const isBulkEdit = selectedRows.has(rowId);
    
    setPanels(panels.map(p => {
      if (!isBulkEdit && p.id !== panelId) return p;
      
      return {
        ...p,
        sections: p.sections.map(s => {
          if (!isBulkEdit && s.id !== sectionId) return s;
          
          return {
            ...s,
            rows: s.rows.map(r => {
              if (isBulkEdit && selectedRows.has(r.id)) {
                return { ...r, [field]: val };
              } else if (!isBulkEdit && r.id === rowId) {
                return { ...r, [field]: val };
              }
              return r;
            })
          };
        })
      };
    }));
  };

  const clearAll = async () => {
    if (await confirm("Are you sure you want to clear all data?")) {
      pushToUndo(panels);
      setPanels([{
        id: `pan_${Date.now()}`,
        name: "LV PANEL-1",
        sections: [{
          id: `sec_${Date.now()}`,
          name: "BB-1",
          ratingId: "2500_rt",
        volts: 415,
        pf: 0.8,
        rows: []
        }]
      }]);
    }
  };

  // Calculations
  const calculatedPanels = useMemo(() => {
    return panels.map(panel => {
      const calcSections = panel.sections.map(section => {
        let totalLoad = 0;
        section.rows.forEach(r => totalLoad += (Number(r.loadKw) || 0));

        let currentRemainingTCL = totalLoad;
        let cumulativeVdPercent = 0;

        const calcRows = section.rows.map((r) => {
          const tcl = currentRemainingTCL;
          const md = tcl * (Number(r.div) || 0);
          let current = 0;
          const volts = Number(section.volts) || 0;
          const isThreePhase = volts >= 300;
          const pf = Number(section.pf) || 0;
          if (volts > 0 && pf > 0) {
            if (isThreePhase) {
              current = (md * 1000) / (Math.sqrt(3) * volts * pf);
            } else {
              current = (md * 1000) / (volts * pf);
            }
          }

          const rData = ALL_BUSBAR_DATA[section.ratingId] || { r: 0, x: 0 };
          const phi = Math.acos(pf);
          const sinPhi = Math.sin(phi);
          
          const lenNum = Number(r.length) || 0;
          const lenMeters = unitSystem === "ip" ? lenNum * 0.3048 : lenNum;
          
          let vd = 0;
          if (isThreePhase) {
            vd = (Math.sqrt(3) * current * lenMeters * ((rData.r * pf) + (rData.x * sinPhi))) / 1000;
          } else {
            vd = (2 * current * lenMeters * ((rData.r * pf) + (rData.x * sinPhi))) / 1000;
          }
          
          const vdPercent = volts > 0 ? (vd / volts) * 100 : 0;
          cumulativeVdPercent += vdPercent;
          currentRemainingTCL -= (Number(r.loadKw) || 0);

          return {
            ...r,
            tcl,
            md,
            current,
            r: rData.r,
            x: rData.x,
            vd,
            vdPercent,
            cumulativeVdPercent
          };
        });

        const totalCumulativeVd = calcRows.length > 0 ? calcRows[calcRows.length - 1].cumulativeVdPercent : 0;

        return {
          ...section,
          calcRows,
          totalCumulativeVd
        };
      });

      return {
        ...panel,
        calcSections
      };
    });
  }, [panels, ALL_BUSBAR_DATA, unitSystem]);

  useEffect(() => {
    const vdMap: Record<string, number> = {};
    calculatedPanels.forEach(p => {
      p.calcSections.forEach(s => {
        s.calcRows.forEach(r => {
          if (r.desc) {
            vdMap[r.desc.trim()] = r.cumulativeVdPercent;
          }
        });
        if (s.name) {
          vdMap[s.name.trim()] = s.totalCumulativeVd;
        }
      });
    });
    localStorage.setItem("mep-busbar-calculated-vd-v1", JSON.stringify(vdMap));
  }, [calculatedPanels]);

  const flatCalculatedSections = useMemo(() => {
    return calculatedPanels.flatMap(p => p.calcSections.map(s => ({ ...s, panelName: p.name })));
  }, [calculatedPanels]);

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();

    const fontBold = { name: "Arial", size: 10, bold: true };
    const fontNormal = { name: "Arial", size: 10 };
    const alignCenter: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: true };
    const alignCenterNoWrap: Partial<ExcelJS.Alignment> = { horizontal: "center", vertical: "middle", wrapText: false };
    const alignLeft: Partial<ExcelJS.Alignment> = { horizontal: "left", vertical: "middle", wrapText: true };
    const headerBg = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF92CDDC" } 
    } as ExcelJS.Fill;
    
    const setBorder = (cell: ExcelJS.Cell) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" }
      };
    };

    const lenLabel = unitSystem === "ip" ? "Length (ft)" : "Length (m)";
    const rLabel = unitSystem === "ip" ? "Resistance, R\n(mΩ/ft)" : "Resistance, R\n(mΩ/m)";
    const xLabel = unitSystem === "ip" ? "Reactance, X\n(mΩ/ft)" : "Reactance, X\n(mΩ/m)";

    flatCalculatedSections.forEach((section, sIndex) => {
      let safeName = section.name.replace(/[\\/*?:\[\]]/g, '');
      if (!safeName) safeName = `BB-${sIndex + 1}`;
      if (safeName.length > 31) safeName = safeName.substring(0, 31);
      
      let finalName = safeName;
      let counter = 1;
      while (workbook.getWorksheet(finalName)) {
        finalName = `${safeName.substring(0, 28)}_${counter}`;
        counter++;
      }

      const worksheet = workbook.addWorksheet(finalName);

      worksheet.columns = [
        { width: 8 },  // A: No.
        { width: 15 }, // B: From
        { width: 30 }, // C: Description
        { width: 12 }, // D: Busbar reference
        { width: 10 }, // E: Length
        { width: 12 }, // F: SMDB load
        { width: 12 }, // G: TCL
        { width: 12 }, // H: Volts
        { width: 12 }, // I: PF
        { width: 12 }, // J: Diversity
        { width: 12 }, // K: Max Demand
        { width: 12 }, // L: Line Current
        { width: 16 }, // M: Busbar Rating
        { width: 14 }, // N: Resistance
        { width: 14 }, // O: Reactance
        { width: 14 }, // P: Volt Drop
        { width: 14 }  // Q: Vdrop %
      ];

      const firstRef = section.calcRows.length > 0 ? section.calcRows[0].ref : section.name;
      
      // Titles
      worksheet.mergeCells("A1:Q1");
      const t1 = worksheet.getCell("A1");
      t1.value = `VOLTAGE DROP CALCULATION- ${firstRef} (${firstRef})`;
      t1.font = { name: "Arial", size: 12, bold: true, underline: true };
      t1.alignment = alignCenter;

      worksheet.mergeCells("A2:Q2");
      const t2 = worksheet.getCell("A2");
      t2.value = "PROJECT - ";
      t2.font = { name: "Arial", size: 11, bold: true, underline: true };
      t2.alignment = alignCenter;

      // Formula block
      worksheet.getCell("G4").value = "Voltage Drop, Vd=1.732 x L x I x (Rcos Φ + Xsin Φ)";
      worksheet.getCell("G4").font = fontBold;
      worksheet.getCell("G5").value = "Where,";
      worksheet.getCell("G5").font = fontBold;
      worksheet.getCell("G6").value = "L = Length in meter";
      worksheet.getCell("G6").font = fontBold;
      worksheet.getCell("G7").value = "I = Current in Amps";
      worksheet.getCell("G7").font = fontBold;
      worksheet.getCell("G8").value = "R = Resistance in mΩ/m";
      worksheet.getCell("G8").font = fontBold;
      worksheet.getCell("G9").value = "X = Reactance in mΩ/m";
      worksheet.getCell("G9").font = fontBold;

      // Sub-title
      worksheet.getCell("A10").value = firstRef;
      worksheet.getCell("A10").font = { name: "Arial", size: 12, bold: true };

      // Headers Row 1 (for merged R&X Value)
      worksheet.getRow(11).height = 15;
      worksheet.mergeCells("N11:O11");
      const rxCell = worksheet.getCell("N11");
      rxCell.value = "R&X Value";
      rxCell.fill = headerBg;
      rxCell.font = fontBold;
      rxCell.alignment = alignCenter;
      setBorder(rxCell);
      setBorder(worksheet.getCell("O11"));

      // Headers Row 2
      worksheet.getRow(12).height = 50;
      const headers = [
        "No. of\nTap\nOff",
        "From",
        "Description of connection",
        "Busbar\nreferece",
        lenLabel,
        "SMDB load\n(kW)",
        "TCL at Tap off\npoint (kW)",
        "Volts (V)",
        "Power\nfactor\n(Cos Φ)",
        "Diversity",
        "Maximum\nDemand\nLoad (kW)",
        "Line\nCurrent\n(A)",
        "Busbar Rating\n(A) (Copper)",
        rLabel,
        xLabel,
        "Volt Drop\n(Vd)",
        "Vdrop\n%"
      ];

      headers.forEach((h, i) => {
        const col = i + 1;
        if (col !== 14 && col !== 15) {
          worksheet.mergeCells(11, col, 12, col);
          const cell = worksheet.getCell(11, col);
          cell.value = h.replace(/\\n/g, '\n');
          cell.fill = headerBg;
          cell.font = fontBold;
          cell.alignment = alignCenter;
          setBorder(cell);
          setBorder(worksheet.getCell(12, col));
        } else {
          const cell = worksheet.getCell(12, col);
          cell.value = h.replace(/\\n/g, '\n');
          cell.fill = headerBg;
          cell.font = fontBold;
          cell.alignment = alignCenter;
          setBorder(cell);
        }
      });

      let rowIndex = 13;

      section.calcRows.forEach((r, idx) => {
        const row = worksheet.getRow(rowIndex);
        row.height = 20;

        const rVal = Number((unitSystem === "ip" ? r.r * 0.3048 : r.r).toFixed(4));
        const xVal = Number((unitSystem === "ip" ? r.x * 0.3048 : r.x).toFixed(4));

        row.getCell(1).value = idx + 1;
        row.getCell(2).value = section.panelName;
        row.getCell(3).value = r.desc;
        row.getCell(4).value = section.name;
        row.getCell(5).value = Number((Number(r.length) || 0).toFixed(2));
        row.getCell(6).value = Number((Number(r.loadKw) || 0).toFixed(2));
        row.getCell(7).value = Number((Number(r.tcl) || 0).toFixed(2));
        row.getCell(8).value = Number(section.volts) || 0;
        row.getCell(9).value = Number(section.pf) || 0;
        row.getCell(10).value = Number((Number(r.div) || 0).toFixed(2));
        row.getCell(11).value = Number((Number(r.md) || 0).toFixed(2));
        row.getCell(12).value = Number((Number(r.current) || 0).toFixed(2));
        row.getCell(13).value = ALL_BUSBAR_DATA[section.ratingId]?.label || "";
        row.getCell(14).value = rVal;
        row.getCell(15).value = xVal;
        row.getCell(16).value = Number((Number(r.vd) || 0).toFixed(2));
        row.getCell(17).value = Number(r.vdPercent).toFixed(3) + "%";
        if (r.vdPercent > 2.5) {
          row.getCell(17).font = { ...fontNormal, color: { argb: "FFFF0000" } };
        }
        
        for (let c = 1; c <= 17; c++) {
          const cell = row.getCell(c);
          if (!cell.font) cell.font = fontNormal;
          cell.alignment = { 
            horizontal: c === 3 ? "left" : "center", 
            vertical: "middle", 
            wrapText: c === 3 
          };
          setBorder(cell);
        }
        
        rowIndex++;
      });

      if (section.calcRows.length > 1) {
        worksheet.mergeCells(13, 2, rowIndex - 1, 2);
        worksheet.mergeCells(13, 4, rowIndex - 1, 4);
      }

      if (section.calcRows.length > 0) {
        const footerRow = worksheet.getRow(rowIndex);
        footerRow.height = 20;
        worksheet.mergeCells(rowIndex, 14, rowIndex, 15);
        const cumLabelCell = worksheet.getCell(rowIndex, 14);
        cumLabelCell.value = "Cumulative VD up to SMDB";
        cumLabelCell.alignment = { horizontal: "right", vertical: "middle", wrapText: false };
        cumLabelCell.font = fontBold;
        setBorder(cumLabelCell);
        setBorder(worksheet.getCell(rowIndex, 15));

        const cumValCell = worksheet.getCell(rowIndex, 16);
        const totalVd = section.calcRows.reduce((sum, row) => sum + (Number(row.vd) || 0), 0);
        cumValCell.value = Number(totalVd.toFixed(2));
        cumValCell.alignment = alignCenterNoWrap;
        cumValCell.font = fontNormal;
        setBorder(cumValCell);
        
        rowIndex++;
      }

      rowIndex += 2;
      
      const allData = Object.values(ALL_BUSBAR_DATA);
      if (allData.length > 0) {
        worksheet.mergeCells(rowIndex, 2, rowIndex, 3);
        const rtHead = worksheet.getCell(rowIndex, 2);
        rtHead.value = "Rating";
        rtHead.fill = headerBg;
        rtHead.font = fontBold;
        rtHead.alignment = alignCenter;
        setBorder(rtHead);
        setBorder(worksheet.getCell(rowIndex, 3));

        const resHead = worksheet.getCell(rowIndex, 4);
        resHead.value = "Resistance";
        resHead.fill = headerBg;
        resHead.font = fontBold;
        resHead.alignment = alignCenter;
        setBorder(resHead);

        const reactHead = worksheet.getCell(rowIndex, 5);
        reactHead.value = "Reactance";
        reactHead.fill = headerBg;
        reactHead.font = fontBold;
        reactHead.alignment = alignCenter;
        setBorder(reactHead);

        rowIndex++;

        allData.forEach((data) => {
          worksheet.mergeCells(rowIndex, 2, rowIndex, 3);
          const rtCell = worksheet.getCell(rowIndex, 2);
          rtCell.value = data.label;
          rtCell.alignment = alignCenter;
          rtCell.font = fontNormal;
          setBorder(rtCell);
          setBorder(worksheet.getCell(rowIndex, 3));

          const rValCell = worksheet.getCell(rowIndex, 4);
          rValCell.value = Number((unitSystem === "ip" ? data.r * 0.3048 : data.r).toFixed(4));
          rValCell.alignment = alignCenter;
          rValCell.font = fontNormal;
          setBorder(rValCell);

          const xValCell = worksheet.getCell(rowIndex, 5);
          xValCell.value = Number((unitSystem === "ip" ? data.x * 0.3048 : data.x).toFixed(4));
          xValCell.alignment = alignCenter;
          xValCell.font = fontNormal;
          setBorder(xValCell);

          rowIndex++;
        });

        rowIndex++;
        
        worksheet.getCell(rowIndex, 2).value = "Where,";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
        rowIndex++;
        worksheet.getCell(rowIndex, 2).value = "Rt- Resistance at thermal balance";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
        rowIndex++;
        worksheet.getCell(rowIndex, 2).value = "R@50%RC - Resistance at 50% rated current";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
        rowIndex += 2;
        worksheet.getCell(rowIndex, 2).value = "Note:";
        worksheet.getCell(rowIndex, 2).font = { name: "Arial", size: 10, bold: true, underline: true };
        rowIndex++;
        worksheet.getCell(rowIndex, 2).value = "Resistance & reactance values were taken at 50°C ambient temperature";
        worksheet.getCell(rowIndex, 2).font = fontNormal;
      }
    });

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "busbar-calculation");
    const buffer = await workbook.xlsx.writeBuffer();
    await downloadFile(new Uint8Array(buffer), "Busbar_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    try {
      const doc = new jsPDF("landscape");
      
      if (flatCalculatedSections.length === 0) {
        const startY = addPdfHeader(doc, "Busbar Voltage Drop Calculation Report");
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text("No busbar sections calculated.", 14, startY + 5);
      } else {
        flatCalculatedSections.forEach((section, sIndex) => {
          if (sIndex > 0) doc.addPage();
          
          const headerStartY = addPdfHeader(doc, "Busbar Voltage Drop Calculation Report");
          
          const ratingLabel = ALL_BUSBAR_DATA[section.ratingId]?.label || section.ratingId;
          const rawR = ALL_BUSBAR_DATA[section.ratingId]?.r || 0;
          const rawX = ALL_BUSBAR_DATA[section.ratingId]?.x || 0;
          const rVal = (unitSystem === "ip" ? (rawR * 0.3048) : rawR).toFixed(4);
          const xVal = (unitSystem === "ip" ? (rawX * 0.3048) : rawX).toFixed(4);
          const rUnit = unitSystem === "ip" ? "mΩ/ft" : "mΩ/m";

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(`Panel: ${section.panelName} | Busbar Section: ${section.name}`, 14, headerStartY + 2);
          
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.text(`Selected / Suggested Busbar: ${ratingLabel} (R: ${rVal} ${rUnit}, X: ${xVal} ${rUnit}) | Voltage: ${section.volts}V | Power Factor: ${section.pf}`, 14, headerStartY + 7);

          const tableData = (section.calcRows || []).map((r, idx) => [
            idx + 1,
            r.desc || "",
            (r.length || 0).toString(),
            (r.loadKw || 0).toString(),
            (r.tcl || 0).toFixed(2),
            (r.md || 0).toFixed(2),
            (r.current || 0).toFixed(2),
            (r.vd || 0).toFixed(2),
            (r.vdPercent || 0).toFixed(3) + "%",
            (r.cumulativeVdPercent || 0).toFixed(3) + "%"
          ]);

          const totalVd = (section.calcRows || []).reduce((sum, row) => sum + (Number(row.vd) || 0), 0);
          const isExceeded = section.totalCumulativeVd > 2.5;

          const footData = [[
            "",
            "Cumulative VD up to SMDB",
            "",
            "",
            "",
            "",
            "",
            totalVd.toFixed(2) + " V",
            section.totalCumulativeVd.toFixed(3) + "%",
            isExceeded ? "EXCEEDS (FAIL)" : "PASS"
          ]];

          const lenHeader = unitSystem === "ip" ? "Len(ft)" : "Len(m)";
          autoTable(doc, {
            head: [["No.", "Description", lenHeader, "Load(kW)", "TCL(kW)", "MD(kW)", "Current(A)", "Vdrop(V)", "Vdrop %", "Cum.%"]],
            body: tableData,
            foot: footData,
            startY: headerStartY + 11,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: "bold" },
            footStyles: { fillColor: isExceeded ? [231, 76, 60] : [240, 240, 240], textColor: isExceeded ? 255 : 0, fontStyle: "bold" }
          });

          const finalY = (doc as any).lastAutoTable?.finalY || (headerStartY + 35);
          
          // Draw Summary & Recommendation Box
          doc.setFillColor(isExceeded ? 253 : 240, isExceeded ? 237 : 248, isExceeded ? 237 : 245);
          doc.setDrawColor(isExceeded ? 231 : 46, isExceeded ? 76 : 204, isExceeded ? 60 : 113);
          doc.roundedRect(14, finalY + 4, 269, 14, 2, 2, "FD");

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(isExceeded ? 192 : 39, isExceeded ? 57 : 174, isExceeded ? 43 : 96);
          doc.text(`SELECTED / SUGGESTED BUSBAR: ${ratingLabel}`, 18, finalY + 9);
          
          doc.setFont("helvetica", "normal");
          doc.setTextColor(0, 0, 0);
          doc.text(`Cumulative Voltage Drop: ${section.totalCumulativeVd.toFixed(3)}% | Status: ${isExceeded ? 'EXCEEDS 2.5% STANDARD LIMIT (Select larger busbar rating)' : 'WITHIN 2.5% STANDARD LIMIT (PASS)'}`, 18, finalY + 14);
        });
      }
      
      const sigFinalY = Math.max(((doc as any).lastAutoTable?.finalY || 50) + 24, 75);
      addPdfSignatureBlock(doc, sigFinalY, currentUserName, project?.id || "default", "busbar-calculation");
      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "Busbar_Calculation.pdf", "PDF Document", ["pdf"]);
    } catch (err) {
      console.error("Failed to export PDF:", err);
    }
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const excelRows = XLSX.utils.sheet_to_json<any>(firstSheet, { raw: true });

      let importedCount = 0;
      const newCustoms = { ...customBusbars };
      
      excelRows.forEach((row: any) => {
        let rating: any = null, r: number | null = null, x: number | null = null, label: string | null = null;
        for (const key in row) {
          if (!key) continue;
          const k = key.toString().toLowerCase();
          const val = row[key];
          if (k.includes('rating') || k.includes('size')) rating = val;
          else if (k === 'r' || k.includes('resist')) r = parseFloat(val);
          else if (k === 'x' || k.includes('react')) x = parseFloat(val);
          else if (k.includes('label') || k.includes('type')) label = val;
        }
        
        if (rating && r != null && !isNaN(r) && x != null && !isNaN(x)) {
          const ratingStr = String(rating).trim();
          const safeLabel = label ? `${ratingStr} (${label})` : `${ratingStr} (Custom)`;
          const id = `custom_${ratingStr}_${Date.now()}_${importedCount}`;
          
          newCustoms[id] = { r, x, label: safeLabel };
          importedCount++;
        }
      });

      if (importedCount > 0) {
        setCustomBusbars(newCustoms);
        confirm(`Successfully imported ${importedCount} custom busbar ratings!`);
      } else {
        confirm("Could not find columns for Rating, Resistance, and Reactance in the Excel file.\nPlease ensure your Excel file has headers like 'Busbar Rating', 'Resistance', and 'Reactance'.");
      }
      
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const actions = (
    <>
      <label className="cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2">
        <Upload className="size-3.5" /> Import Ratings
        <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
      </label>
      <TBtn onClick={exportPdf}><Download className="size-3.5" /> PDF</TBtn>
      <TBtn onClick={clearAll}><Trash2 className="size-3.5" /> Clear All</TBtn>
      <TBtn primary onClick={addPanel}><Plus className="size-3.5" /> Add LV Panel</TBtn>
    </>
  );

  return (
    <AppShell title="Busbar Calculation" subtitle="Calculate voltage drop over multiple busbars and panels" actions={actions}>
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
              onClick={() => handleUnitToggle("si")}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                unitSystem === "si" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              SI
            </button>
            <button
              onClick={() => handleUnitToggle("ip")}
              className={`px-2.5 py-0.5 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                unitSystem === "ip" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              IP
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-surface-1/50 p-4 gap-6 flex flex-col min-h-0">
          {calculatedPanels.map((panel, pIdx) => {
            return (
              <div key={panel.id} className="flex flex-col bg-surface-2/30 border-2 border-border/60 rounded-2xl shadow-xl overflow-hidden shrink-0">
                {/* Panel Header */}
                <div className="bg-surface-2/80 border-b border-border/60 py-2 px-4 flex gap-4 items-center flex-wrap hover:bg-surface-2 transition-colors">
                  <button onClick={() => togglePanel(panel.id)} className="p-1 rounded hover:bg-black/5 flex items-center justify-center shrink-0">
                    {collapsedPanels.has(panel.id) ? <ChevronRight className="size-5 text-muted-foreground" /> : <ChevronDown className="size-5 text-muted-foreground" />}
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px] font-bold text-foreground uppercase tracking-wider">Panel Name:</span>
                    <input 
                      type="text" 
                      value={panel.name} 
                      onChange={e => updatePanel(panel.id, "name", e.target.value)}
                      className="h-8 px-2 border border-border rounded bg-background focus:bg-white outline-none font-bold w-48 text-[13px]"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  
                  <div className="ml-auto flex items-center gap-3">
                      <TBtn onClick={(e) => { e.stopPropagation(); addSection(panel.id); }} primary><Plus className="size-3.5" /> Add Busbar</TBtn>
                      <TBtn onClick={(e) => { e.stopPropagation(); removePanel(panel.id); }}><Trash2 className="size-3.5" /> Remove Panel</TBtn>
                  </div>
                </div>

                {!collapsedPanels.has(panel.id) && (
                <div className="p-4 flex flex-col gap-4">
                  {panel.calcSections.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground italic bg-background rounded-lg border border-border">
                      No busbars added to {panel.name}. Click "+ Add Busbar".
                    </div>
                  ) : panel.calcSections.map((section, sIdx) => {
                      const isAllSelected = section.calcRows.length > 0 && section.calcRows.every(r => selectedRows.has(r.id));
                      
                      return (
                        <div key={section.id} className="flex flex-col bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] overflow-hidden shrink-0">
                          <div className="bg-white/40 dark:bg-white/5 border-b border-white/40 dark:border-white/10 py-2 px-3 flex gap-4 items-center justify-between flex-wrap">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">Name:</span>
                                <input 
                                  type="text" 
                                  value={section.name} 
                                  onChange={e => updateSection(panel.id, section.id, "name", e.target.value)}
                                  className="h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium w-24 text-sm"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">Volts:</span>
                                <input 
                                  type="number" 
                                  value={section.volts} 
                                  onChange={e => updateSection(panel.id, section.id, "volts", e.target.value === "" ? "" : Number(e.target.value))}
                                  className="h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">PF:</span>
                                <input 
                                  type="number" 
                                  step="0.01" max="1"
                                  value={section.pf} 
                                  onChange={e => updateSection(panel.id, section.id, "pf", e.target.value === "" ? "" : Number(e.target.value))}
                                  className="h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium w-16 text-center text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-muted-foreground">Rating:</span>
                                <select
                                    className="h-7 px-2 border border-border rounded bg-background focus:bg-white outline-none font-medium cursor-pointer text-sm"
                                    value={section.ratingId}
                                    onChange={(e) => updateSection(panel.id, section.id, "ratingId", e.target.value)}
                                >
                                  {Object.entries(ALL_BUSBAR_DATA).map(([id, data]) => (
                                    <option key={id} value={id}>{data.label}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="flex items-center gap-3 ml-2 bg-surface-1 px-2 py-1 rounded border border-border/50">
                                <span className="text-[10px] text-muted-foreground font-medium uppercase">R: <span className="text-foreground text-[11px] font-mono">{((unitSystem === "ip" ? ALL_BUSBAR_DATA[section.ratingId]?.r * 0.3048 : ALL_BUSBAR_DATA[section.ratingId]?.r) || 0).toFixed(4)}</span></span>
                                <span className="text-[10px] text-muted-foreground font-medium uppercase">X: <span className="text-foreground text-[11px] font-mono">{((unitSystem === "ip" ? ALL_BUSBAR_DATA[section.ratingId]?.x * 0.3048 : ALL_BUSBAR_DATA[section.ratingId]?.x) || 0).toFixed(4)}</span></span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                {section.totalCumulativeVd > 2.5 ? (
                                  <div className="flex items-center gap-3 bg-destructive/10 border border-destructive/20 px-3 py-1.5 rounded-md mr-1" title="Voltage drop exceeds the 2.5% standard limit!">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-destructive">Cum V.Drop</span>
                                    <span className="text-[15px] font-black font-mono text-destructive leading-none">{section.totalCumulativeVd.toFixed(3)}% ⚠</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-md mr-1">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Cum V.Drop</span>
                                    <span className="text-[15px] font-black font-mono text-primary leading-none">{section.totalCumulativeVd.toFixed(3)}%</span>
                                  </div>
                                )}
                                <ImportExcelBtn
                                  columnMapping={{
                                    from: ["From", "Source", "Panel", "From Panel"],
                                    desc: ["Description of connection", "Description", "Tap Off Points", "Tap Off Point", "Tap Off", "Connection", "Name", "Desc"],
                                    ref: ["Busbar Reference", "Busbar ref", "Busbar reference", "Ref", "Reference"],
                                    length: ["Length of busbar upto tap off (m)", "Length of busbar", "Length (m)", "Length (ft)", "Length", "Len"],
                                    loadKw: ["SMDB load (kW)", "SMDB load", "Load (kW)", "Load kW", "LoadKW", "Load", "KW"],
                                    div: ["Diversity Factor", "Diversity", "DF", "Div"]
                                  }}
                                  onImport={(rows) => handleImportExcelRows(panel.id, section.id, rows)}
                                  className="h-7 px-3 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-md transition-colors"
                                />
                                <TBtn onClick={() => addRow(panel.id, section.id)} primary className="h-7 px-3 text-xs"><Plus className="size-3" /> Tap Off</TBtn>
                                <TBtn onClick={() => removeSection(panel.id, section.id)} className="h-7 px-3 text-xs"><Trash2 className="size-3" /> Remove</TBtn>
                            </div>
                          </div>

                          <div className="overflow-auto max-h-[500px]">
                            <table className="w-full text-[12px] border-collapse whitespace-nowrap">
                              <thead className="bg-header-bg sticky top-0 z-10 border-b border-border text-muted-foreground font-semibold">
                                <tr className="text-left">
                                  <th className="px-1 py-2 border-r border-border text-center w-6">
                                    <input 
                                      type="checkbox" 
                                      className="cursor-pointer"
                                      checked={isAllSelected}
                                      onChange={(e) => {
                                        const newSet = new Set(selectedRows);
                                        section.calcRows.forEach(r => {
                                          if (e.target.checked) newSet.add(r.id);
                                          else newSet.delete(r.id);
                                        });
                                        setSelectedRows(newSet);
                                      }}
                                    />
                                  </th>
                                  <th className="px-1 py-2 border-r border-border text-center w-6 text-[11px]">No.</th>
                                  <th className="px-2 py-2 border-r border-border w-32">Description</th>
                                  <th className="px-2 py-2 border-r border-border w-20 text-center">Len ({unitSystem === "ip" ? "ft" : "m"})</th>
                                  <th className="px-2 py-2 border-r border-border w-20 text-center">Load (kW)</th>
                                  <th className="px-2 py-2 border-r border-border w-20 text-center bg-surface-2 text-foreground">TCL (kW)</th>
                                  <th className="px-2 py-2 border-r border-border w-16 text-center">Div</th>
                                  <th className="px-2 py-2 border-r border-border w-20 text-center bg-surface-2 text-foreground">MD (kW)</th>
                                  <th className="px-2 py-2 border-r border-border w-20 text-center bg-surface-2 text-foreground">Cur. (A)</th>
                                  <th className="px-2 py-2 border-r border-border w-16 text-center text-primary">Vd (V)</th>
                                  <th className="px-2 py-2 border-r border-border w-20 text-center text-primary">Vd %</th>
                                  <th className="px-2 py-2 text-center w-10">✕</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {section.calcRows.length === 0 ? (
                                  <tr>
                                    <td colSpan={16} className="text-center py-10 text-muted-foreground italic">
                                      No tap offs added to {section.name}.
                                    </td>
                                  </tr>
                                ) : (
                                  section.calcRows.map((r, idx) => {
                                      const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>, colIndex: number) => {
                                        const target = e.target as HTMLInputElement;
                                        if (["ArrowUp", "ArrowDown", "Enter"].includes(e.key)) {
                                          e.preventDefault();
                                          let nextRow = idx;
                                          if (e.key === "ArrowUp") nextRow--;
                                          if (e.key === "ArrowDown" || e.key === "Enter") nextRow++;
                                          
                                          const nextEl = document.querySelector(`[data-pan="${pIdx}"][data-sec="${sIdx}"][data-row="${nextRow}"][data-col="${colIndex}"]`) as HTMLElement;
                                          if (nextEl) {
                                            nextEl.focus();
                                            if (nextEl instanceof HTMLInputElement) nextEl.select();
                                          }
                                        } else if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
                                          let shouldMove = false;
                                          if (target.tagName === 'SELECT' || target.value === "" || target.value === undefined) {
                                            shouldMove = true;
                                          } else {
                                            if (e.key === "ArrowLeft" && target.selectionStart === 0) shouldMove = true;
                                            if (e.key === "ArrowRight" && target.selectionEnd === target.value.length) shouldMove = true;
                                          }

                                          if (shouldMove) {
                                            e.preventDefault();
                                            let nextCol = colIndex;
                                            if (e.key === "ArrowLeft") nextCol--;
                                            if (e.key === "ArrowRight") nextCol++;
                                            const nextEl = document.querySelector(`[data-pan="${pIdx}"][data-sec="${sIdx}"][data-row="${idx}"][data-col="${nextCol}"]`) as HTMLElement;
                                            if (nextEl) {
                                              nextEl.focus();
                                              if (nextEl instanceof HTMLInputElement) nextEl.select();
                                            }
                                          }
                                        }
                                      };

                                    return (
                                    <tr 
                                      key={r.id} 
                                      data-row-id={r.id}
                                      className={`hover:bg-surface-2 transition-colors cursor-pointer ${selectedRows.has(r.id) ? "bg-primary/5" : ""}`}
                                      onClick={(e) => {
                                        const tagName = (e.target as HTMLElement).tagName;
                                        if (tagName === 'TD') {
                                          toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                        }
                                      }}
                                      onContextMenu={(e) => {
                                        e.preventDefault();
                                        if (!selectedRows.has(r.id)) {
                                          toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                        }
                                        setContextMenu({
                                          x: e.clientX,
                                          y: e.clientY,
                                          panelId: panel.id,
                                          sectionId: section.id,
                                          rowId: r.id
                                        });
                                      }}
                                    >
                                      <td className="p-0 border-r border-border text-center w-6">
                                          <div className="flex items-center justify-center h-full w-full">
                                            <input 
                                              type="checkbox" 
                                              className="cursor-pointer"
                                              checked={selectedRows.has(r.id)}
                                              onChange={() => {}}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                              }}
                                            />
                                          </div>
                                        </td>
                                        <td className="text-center text-muted-foreground font-medium border-r border-border w-6 px-0.5 text-[11.5px]">{idx + 1}</td>
                                      <td className="p-0 border-r border-border">
                                        <div className="flex items-center gap-1.5 w-full px-1">
                                          {r.comments && r.comments.length > 0 && (
                                            <span 
                                              className="inline-flex items-center justify-center p-1 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300 shrink-0 cursor-pointer"
                                              title={`${r.comments.length} comment(s):\n${r.comments.map((c: any) => `${c.authorName}: ${c.text}`).join('\n')}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setCommentTarget({
                                                  id: r.id,
                                                  name: r.desc || r.from || `Tap Off ${r.ref || r.id}`,
                                                  type: 'space',
                                                  panelId: panel.id,
                                                  sectionId: section.id
                                                });
                                                setAssignCommentOpen(true);
                                              }}
                                            >
                                              <MessageSquare className="size-3.5" />
                                            </span>
                                          )}
                                          <input data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={0} onKeyDown={(e) => handleKeyDown(e, 0)} type="text" className="w-full h-8 px-1 bg-transparent outline-none focus:bg-white flex-1" value={r.desc} onChange={e => updateRow(panel.id, section.id, r.id, "desc", e.target.value)} />
                                        </div>
                                      </td>
                                      <td className="p-0 border-r border-border"><input data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={1} onKeyDown={(e) => handleKeyDown(e, 1)} type="number" step="0.1" className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground" value={r.length} onChange={e => updateRow(panel.id, section.id, r.id, "length", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} /></td>
                                      <td className="p-0 border-r border-border"><input data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={2} onKeyDown={(e) => handleKeyDown(e, 2)} type="number" step="0.1" className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground" value={r.loadKw} onChange={e => updateRow(panel.id, section.id, r.id, "loadKw", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} /></td>
                                      
                                      <td className="px-2 py-1 text-center font-bold bg-surface-2 border-r border-border text-foreground">{r.tcl.toFixed(2)}</td>
                                      
                                      <td className="p-0 border-r border-border"><input data-pan={pIdx} data-sec={sIdx} data-row={idx} data-col={3} onKeyDown={(e) => handleKeyDown(e, 3)} type="number" step="0.01" max="1" className="w-full h-8 px-2 text-center bg-transparent outline-none focus:bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground" value={r.div} onChange={e => updateRow(panel.id, section.id, r.id, "div", e.target.value === "" ? "" : (parseFloat(e.target.value) || 0))} /></td>
                                      
                                      <td className="px-2 py-1 text-center font-semibold bg-surface-2 border-r border-border font-mono text-foreground">{r.md.toFixed(2)}</td>
                                      <td className="px-2 py-1 text-center font-semibold bg-surface-2 border-r border-border font-mono text-foreground">{r.current.toFixed(2)}</td>
                                      <td className="px-2 py-1 text-center text-primary font-medium border-r border-border font-mono">{r.vd.toFixed(2)}</td>
                                      <td className={`px-2 py-1 text-center border-r border-border font-mono font-medium ${r.vdPercent > 2.5 ? "text-destructive bg-destructive/5" : "text-primary"}`}>{r.vdPercent.toFixed(3)}%</td>
                                      
                                      <td className="text-center p-0">
                                        <button onClick={() => removeRow(panel.id, section.id, r.id)} className="text-destructive/70 hover:text-destructive w-full h-8 flex items-center justify-center transition-colors">
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                  })}
                </div>
              )}
              </div>
            );
          })}
        </div>
      </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xl py-1.5 text-xs font-bold text-foreground w-48 select-none"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10.5px] text-muted-foreground border-b border-border/60 uppercase">
            Options ({selectedRows.has(contextMenu.rowId) ? selectedRows.size : 1} selected)
          </div>
          <button
            onClick={() => {
              const idsToCopy = selectedRows.has(contextMenu.rowId) ? Array.from(selectedRows) : [contextMenu.rowId];
              copyRows(idsToCopy);
              pasteRows();
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Copy className="size-3.5 text-[#0A7BC7]" /> Duplicate Row(s)
          </button>
          <button
            onClick={() => {
              const inputEl = document.querySelector(`tr[data-row-id="${contextMenu.rowId}"] input[type="text"]`) as HTMLInputElement;
              if (inputEl) {
                inputEl.focus();
                inputEl.select();
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Edit3 className="size-3.5 text-amber-500" /> Edit Parameters
          </button>
          <button
            onClick={() => {
              let targetRowName = "";
              panels.forEach(p => p.sections.forEach(s => s.rows.forEach(r => {
                if (r.id === contextMenu.rowId) targetRowName = r.desc || r.from || `Tap Off ${r.ref || contextMenu.rowId}`;
              })));
              setCommentTarget({
                id: contextMenu.rowId,
                name: targetRowName,
                type: 'space',
                panelId: contextMenu.panelId,
                sectionId: contextMenu.sectionId
              });
              setAssignCommentOpen(true);
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-blue-600 dark:text-blue-400"
          >
            <MessageSquare className="size-3.5" /> Add comment
          </button>
          <div className="my-1 border-t border-border/60"></div>
          <button
            onClick={() => {
              const idsToDelete = selectedRows.has(contextMenu.rowId) ? Array.from(selectedRows) : [contextMenu.rowId];
              pushToUndo(panels);
              setPanels(prev => prev.map(p => ({
                ...p,
                sections: p.sections.map(s => ({
                  ...s,
                  rows: s.rows.filter(r => !idsToDelete.includes(r.id))
                }))
              })));
              setSelectedRows(new Set());
              setContextMenu(null);
              toast.info(`Deleted ${idsToDelete.length} row(s)`);
            }}
            className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-semibold"
          >
            <Trash2 className="size-3.5" /> Delete Row(s)
          </button>
        </div>
      )}

      {/* Assign Comment Modal Overlay */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={assignCommentOpen}
          onClose={() => {
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType={commentTarget.type}
          onSave={(newComment) => {
            pushToUndo(panels);
            setPanels(prev => {
              const next = prev.map(p => {
                if (p.id === commentTarget.panelId) {
                  return {
                    ...p,
                    sections: p.sections.map(s => {
                      if (s.id === commentTarget.sectionId) {
                        return {
                          ...s,
                          rows: s.rows.map(r => {
                            if (r.id === commentTarget.id) {
                              const comments = [...(r.comments || []), newComment];
                              return { ...r, comments };
                            }
                            return r;
                          })
                        };
                      }
                      return s;
                    })
                  };
                }
                return p;
              });

              const projId = project?.id || "default";
              try {
                localStorage.setItem(`mep_busbar_calc_${projId}`, JSON.stringify({
                  panels: next,
                  updatedAt: new Date().toISOString()
                }));
              } catch (e) {}

              return next;
            });

            toast.success(`Comment assigned on "${commentTarget.name}"`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent("mep-notification-added"));
            }
          }}
        />
      )}
    </AppShell>
  );
}

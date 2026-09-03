import { CalculationReviewBar, useCalculationLock } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { DataGrid } from "@/components/workspace/DataGrid";
import { ContextMenuItem, ContextMenuSeparator, ContextMenuContent } from "@/components/ui/context-menu";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Copy, Plus, Printer, Download, RefreshCw, Gauge, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import excel from "exceljs";
import { saveAs } from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const Route = createFileRoute("/conductor-sizing")({
  head: () => ({
    meta: [
      { title: "Conductor Sizing — MEP Calc" },
      { name: "description", content: "Electrical conductor (cable) sizing calculations" },
    ],
  }),
  component: ConductorSizingPage,
});

const CABLE_DATABASE = [
  { size: 1.5, ampacityCuPVC_1Ph: 19.5, ampacityCuPVC_3Ph: 17.5, ampacityCuXLPE_1Ph: 24, ampacityCuXLPE_3Ph: 22, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 14.8, rCuXLPE: 15.4, rAlPVC: 24.4, rAlXLPE: 25.3, x: 0.09 },
  { size: 2.5, ampacityCuPVC_1Ph: 27, ampacityCuPVC_3Ph: 24, ampacityCuXLPE_1Ph: 33, ampacityCuXLPE_3Ph: 30, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 8.87, rCuXLPE: 9.24, rAlPVC: 14.6, rAlXLPE: 15.1, x: 0.09 },
  { size: 4, ampacityCuPVC_1Ph: 36, ampacityCuPVC_3Ph: 32, ampacityCuXLPE_1Ph: 45, ampacityCuXLPE_3Ph: 40, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 5.54, rCuXLPE: 5.77, rAlPVC: 9.15, rAlXLPE: 9.5, x: 0.085 },
  { size: 6, ampacityCuPVC_1Ph: 46, ampacityCuPVC_3Ph: 41, ampacityCuXLPE_1Ph: 58, ampacityCuXLPE_3Ph: 52, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 3.69, rCuXLPE: 3.84, rAlPVC: 6.09, rAlXLPE: 6.32, x: 0.082 },
  { size: 10, ampacityCuPVC_1Ph: 63, ampacityCuPVC_3Ph: 57, ampacityCuXLPE_1Ph: 80, ampacityCuXLPE_3Ph: 71, ampacityAlPVC_1Ph: 0, ampacityAlPVC_3Ph: 0, ampacityAlXLPE_1Ph: 0, ampacityAlXLPE_3Ph: 0, rCuPVC: 2.19, rCuXLPE: 2.28, rAlPVC: 3.61, rAlXLPE: 3.75, x: 0.078 },
  { size: 16, ampacityCuPVC_1Ph: 85, ampacityCuPVC_3Ph: 76, ampacityCuXLPE_1Ph: 107, ampacityCuXLPE_3Ph: 96, ampacityAlPVC_1Ph: 66, ampacityAlPVC_3Ph: 59, ampacityAlXLPE_1Ph: 83, ampacityAlXLPE_3Ph: 74, rCuPVC: 1.38, rCuXLPE: 1.44, rAlPVC: 2.27, rAlXLPE: 2.36, x: 0.077 },
  { size: 25, ampacityCuPVC_1Ph: 112, ampacityCuPVC_3Ph: 101, ampacityCuXLPE_1Ph: 138, ampacityCuXLPE_3Ph: 127, ampacityAlPVC_1Ph: 87, ampacityAlPVC_3Ph: 78, ampacityAlXLPE_1Ph: 107, ampacityAlXLPE_3Ph: 98, rCuPVC: 0.884, rCuXLPE: 0.927, rAlPVC: 1.46, rAlXLPE: 1.52, x: 0.076 },
  { size: 35, ampacityCuPVC_1Ph: 138, ampacityCuPVC_3Ph: 125, ampacityCuXLPE_1Ph: 171, ampacityCuXLPE_3Ph: 155, ampacityAlPVC_1Ph: 108, ampacityAlPVC_3Ph: 97, ampacityAlXLPE_1Ph: 133, ampacityAlXLPE_3Ph: 120, rCuPVC: 0.638, rCuXLPE: 0.669, rAlPVC: 1.05, rAlXLPE: 1.09, x: 0.075 },
  { size: 50, ampacityCuPVC_1Ph: 169, ampacityCuPVC_3Ph: 151, ampacityCuXLPE_1Ph: 209, ampacityCuXLPE_3Ph: 190, ampacityAlPVC_1Ph: 131, ampacityAlPVC_3Ph: 117, ampacityAlXLPE_1Ph: 162, ampacityAlXLPE_3Ph: 147, rCuPVC: 0.471, rCuXLPE: 0.494, rAlPVC: 0.778, rAlXLPE: 0.81, x: 0.074 },
  { size: 70, ampacityCuPVC_1Ph: 213, ampacityCuPVC_3Ph: 192, ampacityCuXLPE_1Ph: 269, ampacityCuXLPE_3Ph: 240, ampacityAlPVC_1Ph: 166, ampacityAlPVC_3Ph: 149, ampacityAlXLPE_1Ph: 209, ampacityAlXLPE_3Ph: 189, rCuPVC: 0.328, rCuXLPE: 0.343, rAlPVC: 0.541, rAlXLPE: 0.563, x: 0.074 },
  { size: 95, ampacityCuPVC_1Ph: 258, ampacityCuPVC_3Ph: 232, ampacityCuXLPE_1Ph: 326, ampacityCuXLPE_3Ph: 292, ampacityAlPVC_1Ph: 202, ampacityAlPVC_3Ph: 180, ampacityAlXLPE_1Ph: 253, ampacityAlXLPE_3Ph: 229, rCuPVC: 0.235, rCuXLPE: 0.246, rAlPVC: 0.388, rAlXLPE: 0.404, x: 0.073 },
  { size: 120, ampacityCuPVC_1Ph: 299, ampacityCuPVC_3Ph: 269, ampacityCuXLPE_1Ph: 379, ampacityCuXLPE_3Ph: 340, ampacityAlPVC_1Ph: 235, ampacityAlPVC_3Ph: 209, ampacityAlXLPE_1Ph: 294, ampacityAlXLPE_3Ph: 267, rCuPVC: 0.186, rCuXLPE: 0.195, rAlPVC: 0.307, rAlXLPE: 0.32, x: 0.073 },
  { size: 150, ampacityCuPVC_1Ph: 344, ampacityCuPVC_3Ph: 309, ampacityCuXLPE_1Ph: 436, ampacityCuXLPE_3Ph: 391, ampacityAlPVC_1Ph: 270, ampacityAlPVC_3Ph: 240, ampacityAlXLPE_1Ph: 338, ampacityAlXLPE_3Ph: 307, rCuPVC: 0.151, rCuXLPE: 0.158, rAlPVC: 0.25, rAlXLPE: 0.26, x: 0.073 },
  { size: 185, ampacityCuPVC_1Ph: 392, ampacityCuPVC_3Ph: 353, ampacityCuXLPE_1Ph: 500, ampacityCuXLPE_3Ph: 448, ampacityAlPVC_1Ph: 309, ampacityAlPVC_3Ph: 275, ampacityAlXLPE_1Ph: 388, ampacityAlXLPE_3Ph: 352, rCuPVC: 0.122, rCuXLPE: 0.128, rAlPVC: 0.201, rAlXLPE: 0.21, x: 0.073 },
  { size: 240, ampacityCuPVC_1Ph: 461, ampacityCuPVC_3Ph: 415, ampacityCuXLPE_1Ph: 590, ampacityCuXLPE_3Ph: 528, ampacityAlPVC_1Ph: 364, ampacityAlPVC_3Ph: 324, ampacityAlXLPE_1Ph: 457, ampacityAlXLPE_3Ph: 415, rCuPVC: 0.095, rCuXLPE: 0.099, rAlPVC: 0.157, rAlXLPE: 0.163, x: 0.072 },
  { size: 300, ampacityCuPVC_1Ph: 530, ampacityCuPVC_3Ph: 477, ampacityCuXLPE_1Ph: 678, ampacityCuXLPE_3Ph: 608, ampacityAlPVC_1Ph: 419, ampacityAlPVC_3Ph: 373, ampacityAlXLPE_1Ph: 526, ampacityAlXLPE_3Ph: 478, rCuPVC: 0.077, rCuXLPE: 0.081, rAlPVC: 0.128, rAlXLPE: 0.133, x: 0.072 },
  { size: 400, ampacityCuPVC_1Ph: 625, ampacityCuPVC_3Ph: 563, ampacityCuXLPE_1Ph: 800, ampacityCuXLPE_3Ph: 718, ampacityAlPVC_1Ph: 494, ampacityAlPVC_3Ph: 441, ampacityAlXLPE_1Ph: 621, ampacityAlXLPE_3Ph: 564, rCuPVC: 0.061, rCuXLPE: 0.064, rAlPVC: 0.101, rAlXLPE: 0.105, x: 0.072 },
  { size: 500, ampacityCuPVC_1Ph: 720, ampacityCuPVC_3Ph: 648, ampacityCuXLPE_1Ph: 922, ampacityCuXLPE_3Ph: 827, ampacityAlPVC_1Ph: 570, ampacityAlPVC_3Ph: 508, ampacityAlXLPE_1Ph: 716, ampacityAlXLPE_3Ph: 651, rCuPVC: 0.05, rCuXLPE: 0.052, rAlPVC: 0.083, rAlXLPE: 0.086, x: 0.072 },
  { size: 630, ampacityCuPVC_1Ph: 830, ampacityCuPVC_3Ph: 747, ampacityCuXLPE_1Ph: 1060, ampacityCuXLPE_3Ph: 952, ampacityAlPVC_1Ph: 657, ampacityAlPVC_3Ph: 586, ampacityAlXLPE_1Ph: 826, ampacityAlXLPE_3Ph: 751, rCuPVC: 0.041, rCuXLPE: 0.043, rAlPVC: 0.068, rAlXLPE: 0.071, x: 0.072 }
];

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

function ConductorSizingPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const [globalDerating, setGlobalDerating] = useState(0.85);
  const [globalVdLimit, setGlobalVdLimit] = useState(3);
  const [globalPf, setGlobalPf] = useState(0.85);
  const [activeRowId, setActiveRowId] = useState<string>();
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<any[][]>([]);
  
  const pushToHistory = (newRows: any[]) => {
    setHistory([...history, newRows]);
  };

  const calculatedRows = useMemo(() => {
    return rows.map((r, index) => {
      const srNo = index + 1;
      const loadKw = r.connectedLoad === "" ? 0 : Number(r.connectedLoad);
      const v = r.voltage === "" ? 0 : Number(r.voltage);
      const runs = r.parallelRuns === "" || Number(r.parallelRuns) <= 0 ? 1 : Number(r.parallelRuns);
      const length = r.length === "" ? 0 : Number(r.length);
      let designCurrent = 0;
      if (loadKw > 0 && v > 0 && r.phase !== "") {
        if (r.phase === "Single Phase") designCurrent = (loadKw * 1e3) / (v * globalPf);
        else if (r.phase === "Three Phase") designCurrent = (loadKw * 1e3) / (Math.sqrt(3) * v * globalPf);
      }
      let minCableSize = 0;
      let baseAmpacity = 0;
      let deratedAmpacity = 0;
      let vdV = 0;
      let vdPercent = 0;
      let utilization = 0;
      let status = "Pass";
      let notes = "";
      if (designCurrent > 0 && r.material !== "" && r.type !== "" && r.phase !== "") {
        let found = false;
        for (const spec of CABLE_DATABASE) {
          if (r.material === "Aluminium" && spec.size < 16) continue;
          let baseAmp = 0;
          if (r.material === "Copper") {
            if (r.type === "PVC") baseAmp = r.phase === "Single Phase" ? spec.ampacityCuPVC_1Ph : spec.ampacityCuPVC_3Ph;
            else baseAmp = r.phase === "Single Phase" ? spec.ampacityCuXLPE_1Ph : spec.ampacityCuXLPE_3Ph;
          } else {
            if (r.type === "PVC") baseAmp = r.phase === "Single Phase" ? spec.ampacityAlPVC_1Ph : spec.ampacityAlPVC_3Ph;
            else baseAmp = r.phase === "Single Phase" ? spec.ampacityAlXLPE_1Ph : spec.ampacityAlXLPE_3Ph;
          }
          const deratedAmp = baseAmp * globalDerating * runs;
          if (deratedAmp >= designCurrent) {
            const rVal = r.material === "Copper" ? (r.type === "PVC" ? spec.rCuPVC : spec.rCuXLPE) : (r.type === "PVC" ? spec.rAlPVC : spec.rAlXLPE);
            const xVal = spec.x;
            const cosPhi = globalPf;
            const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
            let calculatedVd = 0;
            const currentPerRun = designCurrent / runs;
            if (r.phase === "Single Phase") calculatedVd = (2 * currentPerRun * length * (rVal * cosPhi + xVal * sinPhi)) / 1e3;
            else calculatedVd = (Math.sqrt(3) * currentPerRun * length * (rVal * cosPhi + xVal * sinPhi)) / 1e3;
            const calculatedVdPercent = v > 0 ? (calculatedVd / v) * 100 : 0;
            if (calculatedVdPercent <= globalVdLimit) {
              minCableSize = spec.size;
              baseAmpacity = baseAmp;
              deratedAmpacity = deratedAmp;
              vdV = calculatedVd;
              vdPercent = calculatedVdPercent;
              utilization = (designCurrent / deratedAmp) * 100;
              found = true;
              break;
            }
          }
        }
        if (!found) {
          status = "Fail";
          notes = "No standard cable size satisfies both voltage drop and derated ampacity criteria.";
        } else if (utilization > 95) {
          status = "Warning";
          notes = "Cable utilization is very high (> 95%). Consider upgrading to a larger size.";
        }
      } else {
        status = "Error";
        notes = "Missing Connected Load or Voltage parameters.";
      }
      return {
        ...r,
        srNo,
        designCurrent: Number(designCurrent.toFixed(2)),
        minCableSize,
        baseAmpacity: Number(baseAmpacity.toFixed(1)),
        deratedAmpacity: Number(deratedAmpacity.toFixed(1)),
        vdV: Number(vdV.toFixed(2)),
        vdPercent: Number(vdPercent.toFixed(2)),
        utilization: Number(utilization.toFixed(1)),
        status,
        notes
      };
    });
  }, [rows, globalDerating, globalVdLimit, globalPf]);

  const totalConnectedKw = useMemo(() => rows.reduce((acc, row) => acc + (row.connectedLoad === "" ? 0 : Number(row.connectedLoad)), 0), [rows]);
  const maxDesignCurrent = useMemo(() => calculatedRows.reduce((max, row) => Math.max(max, row.designCurrent), 0), [calculatedRows]);
  const maxVdPercent = useMemo(() => calculatedRows.reduce((max, row) => Math.max(max, row.vdPercent), 0), [calculatedRows]);
  const maxUtilization = useMemo(() => calculatedRows.reduce((max, row) => Math.max(max, row.utilization), 0), [calculatedRows]);
  const largestCableSize = useMemo(() => calculatedRows.reduce((max, row) => Math.max(max, row.minCableSize), 0), [calculatedRows]);
  const activeCalculatedRow = useMemo(() => activeRowId ? calculatedRows.find((cr) => cr.id === activeRowId) || null : null, [calculatedRows, activeRowId]);

  const handleAddRow = () => {
    const newRow = {
      id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      description: "",
      connectedLoad: "",
      voltage: "",
      phase: "",
      length: "",
      material: "",
      type: "",
      parallelRuns: "",
      remarks: ""
    };
    setRows([...rows, newRow]);
    setActiveRowId(newRow.id);
  };

  const clearSelection = () => setSelected(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selected.size === 0) return;
        
        // Prevent deleting if the user is typing in an input
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') {
           return;
        }

        setRows(prev => prev.filter(r => !selected.has(r.id)));
        clearSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selected]);

  const handleUpdateRow = (id: string, field: string, val: any) => {
    pushToHistory(rows);
    if (selected.size > 1 && selected.has(id)) {
      setRows(rows.map((r) => {
        if (selected.has(r.id)) {
          const updated = { ...r, [field]: val };
          if (field === "phase") updated.voltage = val === "Single Phase" ? 230 : 400;
          return updated;
        }
        return r;
      }));
    } else {
      setRows(rows.map((r) => {
        if (r.id === id) {
          const updated = { ...r, [field]: val };
          if (field === "phase") updated.voltage = val === "Single Phase" ? 230 : 400;
          return updated;
        }
        return r;
      }));
    }
  };

  const handleReset = async () => {
    if (window.confirm("Are you sure you want to reset all calculations?")) {
      setRows([]);
      setGlobalDerating(0.85);
      setGlobalVdLimit(3);
      setGlobalPf(0.85);
      clearSelection();
      setActiveRowId(undefined);
    }
  };

  const handleToggle = (id: string, isShift: boolean, isCtrl: boolean) => {
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

  const columns = [
    {
      key: "srNo", header: "Sr. No.", width: 50, align: "center",
      render: (row: any) => <div className="text-center font-mono text-[11px]">{row.srNo}</div>
    },
    {
      key: "description", header: "Description", width: 170,
      render: (row: any) => (
        <InlineInput
          value={row.description}
          onCommit={(val) => handleUpdateRow(row.id, "description", val)}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="text-[11px] font-medium"
        />
      )
    },
    {
      key: "connectedLoad", header: "Load (kW)", width: 95, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          value={row.connectedLoad}
          onCommit={(val) => handleUpdateRow(row.id, "connectedLoad", val === "" ? "" : Number(val))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="text-[11px] text-center font-bold font-mono"
        />
      )
    },
    {
      key: "voltage", header: "Voltage (V)", width: 90, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          value={row.voltage}
          onCommit={(val) => handleUpdateRow(row.id, "voltage", val === "" ? "" : Number(val))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="text-[11px] text-center font-medium font-mono"
        />
      )
    },
    {
      key: "phase", header: "Phase", width: 125, align: "center",
      render: (row: any) => (
        <select
          value={row.phase}
          onChange={(e) => handleUpdateRow(row.id, "phase", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-semibold cursor-pointer text-foreground"
        >
          <option value="" disabled hidden>Phase</option>
          <option value="Single Phase">Single Phase</option>
          <option value="Three Phase">Three Phase</option>
        </select>
      )
    },
    {
      key: "length", header: "Length (m)", width: 90, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          value={row.length}
          onCommit={(val) => handleUpdateRow(row.id, "length", val === "" ? "" : Number(val))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="text-[11px] text-center font-medium font-mono"
        />
      )
    },
    {
      key: "material", header: "Material", width: 110, align: "center",
      render: (row: any) => (
        <select
          value={row.material}
          onChange={(e) => handleUpdateRow(row.id, "material", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-medium cursor-pointer text-foreground"
        >
          <option value="" disabled hidden>Material</option>
          <option value="Copper">Copper</option>
          <option value="Aluminium">Aluminium</option>
        </select>
      )
    },
    {
      key: "type", header: "Cable Type", width: 110, align: "center",
      render: (row: any) => (
        <select
          value={row.type}
          onChange={(e) => handleUpdateRow(row.id, "type", e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="w-full bg-transparent outline-none focus:ring-1 focus:ring-primary rounded pl-2 pr-4.5 py-0.5 text-[11px] font-medium cursor-pointer text-foreground"
        >
          <option value="" disabled hidden>Type</option>
          <option value="XLPE">XLPE</option>
          <option value="PVC">PVC</option>
          <option value="LSZH">LSZH</option>
        </select>
      )
    },
    {
      key: "parallelRuns", header: "Runs", width: 70, align: "center",
      render: (row: any) => (
        <InlineInput
          type="number"
          min={1}
          value={row.parallelRuns}
          onCommit={(val) => handleUpdateRow(row.id, "parallelRuns", val === "" ? "" : Math.max(1, Number(val)))}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="text-[11px] text-center font-medium font-mono"
        />
      )
    },
    {
      key: "designCurrent", header: "Current (A)", width: 105, align: "center",
      render: (row: any) => <div className="text-center font-mono text-[11px] font-bold text-primary">{row.designCurrent}</div>
    },
    {
      key: "minCableSize", header: "Sized Cable", width: 115, align: "center",
      render: (row: any) => {
        if (row.connectedLoad === "" || row.voltage === "") return <div className="text-center text-muted-foreground/60 text-[11px] font-mono">-</div>;
        return (
          <div className={`text-center font-bold text-[11px] ${row.minCableSize > 0 ? "text-emerald-600 dark:text-emerald-400 font-mono" : "text-red-500 font-sans"}`}>
            {row.minCableSize > 0 ? `${row.minCableSize} mm²` : "Size Out of Range"}
          </div>
        );
      }
    },
    {
      key: "remarks", header: "Remarks", width: 130,
      render: (row: any) => (
        <InlineInput
          value={row.remarks}
          onCommit={(val) => handleUpdateRow(row.id, "remarks", val)}
          onFocus={() => { if (!selected.has(row.id)) { clearSelection(); setSelected(new Set([row.id])); setActiveRowId(row.id); } }}
          className="text-[11px] font-medium"
        />
      )
    }
  ];

  const renderRowContextMenu = (row: any) => (
    <ContextMenuContent className="w-48 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
      <ContextMenuItem onClick={() => {
        const duplicated = { ...row, id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, description: `${row.description} (Copy)` };
        setRows([...rows, duplicated]);
        setActiveRowId(duplicated.id);
      }} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer">
        <Copy className="size-3.5" /> Duplicate Row
      </ContextMenuItem>
      <ContextMenuSeparator className="my-1 border-t border-border" />
      <ContextMenuItem onClick={() => {
        if (window.confirm("Are you sure you want to delete this row?")) {
          setRows(rows.filter((r) => r.id !== row.id));
          if (activeRowId === row.id) setActiveRowId(undefined);
        }
      }} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-red-500 font-semibold">
        <Trash2 className="size-3.5" /> Delete Row
      </ContextMenuItem>
    </ContextMenuContent>
  );

  return (
    <AppShell title="Conductor (Cable) Sizing" hideSubHeader>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6">
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">ELECTRICAL {'>'} CONDUCTOR (CABLE) Sizing</span>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Conductor (Cable) Sizing</h1>
                  <span className="text-[15px] font-semibold text-muted-foreground">{rows.length} segments</span>
                </div>
                
              </div>
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">Calculate conductor (cable) sizing automatically complying with IEC standards.</p>
            </div>
          </div>
          <div className="flex-1 flex flex-col gap-6 min-h-[450px] mb-6">
            <div className="bg-card border border-border rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.05)] flex-1 flex flex-col min-h-[450px] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/80">
                <div className="flex flex-wrap items-center gap-6 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Derating Factor:</span>
                    <input type="number" step="0.05" value={globalDerating} onChange={(e) => setGlobalDerating(Number(e.target.value))} className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">VD Limit (%):</span>
                    <input type="number" step="0.5" value={globalVdLimit} onChange={(e) => setGlobalVdLimit(Number(e.target.value))} className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground uppercase tracking-wider text-[10.5px]">Power Factor:</span>
                    <input type="number" step="0.05" value={globalPf} onChange={(e) => setGlobalPf(Number(e.target.value))} className="w-16 bg-background border border-border rounded px-2 py-1 text-center font-bold font-mono text-foreground focus:border-primary outline-none" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" onClick={handleReset} className="h-8 text-xs"><RefreshCw className="size-3.5 mr-1.5" /> Reset</Button>
                  <Button size="sm" onClick={handleAddRow} className="h-8 text-xs"><Plus className="size-3.5 mr-1.5" /> Add Row</Button>
                </div>
              </div>
              <div className="flex flex-col xl:flex-row flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
                <div className="flex-grow min-w-0 flex flex-col bg-transparent relative">
                  <div className="flex-grow flex flex-col relative min-h-[350px]">
                    {rows.length > 0 ? (
                      <DataGrid
                        rows={calculatedRows}
                        columns={columns}
                        selected={selected}
                        onToggle={handleToggle}
                        onToggleAll={handleToggleAll}
                        renderContextMenu={renderRowContextMenu}
                      />
                    ) : (
                      <div className="flex-grow flex flex-col items-center justify-center text-center p-8 border border-dashed border-border rounded-2xl bg-slate-50/20 dark:bg-slate-900/10 m-4 min-h-[350px]">
                        <div className="size-12 rounded-full bg-surface-2 flex items-center justify-center mb-4 border border-border shadow-sm">
                          <Plus className="size-5 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">No calculation rows</h3>
                        <p className="text-xs text-muted-foreground max-w-sm mb-4">Add a conductor row or import data to start calculating.</p>
                        <Button onClick={handleAddRow} className="h-8 text-xs"><Plus className="size-3.5 mr-1.5" /> Add First Row</Button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col w-full xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-border bg-slate-50/30 dark:bg-slate-900/20 overflow-y-auto p-4 gap-4">
                  {activeCalculatedRow && (
                    <div className="bg-background border border-border rounded-xl shadow-sm p-4 shrink-0 transition-all duration-300">
                      <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2 flex items-center justify-between">
                        <span>Active Conductor Sizing</span>
                        <span className="font-mono text-[10px] text-muted-foreground/80">#{activeCalculatedRow.srNo}</span>
                      </h4>
                      <div className="space-y-4 text-[13px]">
                        {activeCalculatedRow.minCableSize > 0 ? (
                          <div className="flex flex-col border border-emerald-500/30 rounded-xl bg-emerald-500/10 p-3 shadow-sm transition-all">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Recommended Cable Size</span>
                            <div className="text-[24px] font-black text-emerald-600 dark:text-emerald-500 mt-1 font-mono tracking-tight">{activeCalculatedRow.minCableSize} mm²</div>
                            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-medium mt-0.5">{activeCalculatedRow.material || "-"} / {activeCalculatedRow.type || "-"} Insulation</span>
                          </div>
                        ) : (
                          <div className="flex flex-col border border-red-500/30 rounded-xl bg-red-500/10 p-3 shadow-sm transition-all">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Recommended Cable Size</span>
                            <div className="text-[20px] font-black text-red-600 dark:text-red-500 mt-1 font-sans">Size Out of Range</div>
                            <span className="text-[10px] text-red-700/80 dark:text-red-400/80 font-medium mt-0.5">Criteria not met</span>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm">
                            <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Design Current</span>
                            <strong className="text-[14px] font-bold font-mono text-foreground mt-1">{activeCalculatedRow.designCurrent} A</strong>
                          </div>
                          <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm">
                            <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Capacity (Iz)</span>
                            <strong className="text-[14px] font-bold font-mono text-foreground mt-1">{activeCalculatedRow.deratedAmpacity} A</strong>
                          </div>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm gap-1.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Voltage Drop</span>
                            <span className="font-mono text-xs font-bold text-foreground">{activeCalculatedRow.vdPercent.toFixed(2)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${activeCalculatedRow.vdPercent > globalVdLimit ? "bg-red-500" : activeCalculatedRow.vdPercent > globalVdLimit * 0.8 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${Math.min(100, (activeCalculatedRow.vdPercent / (globalVdLimit || 3)) * 100)}%` }}></div>
                          </div>
                          <span className="text-[9px] text-muted-foreground">Limit: {globalVdLimit}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="bg-background border border-border rounded-xl shadow-sm p-4 shrink-0 transition-all duration-300">
                    <h4 className="text-[11.5px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-border pb-2">Project Sizing Summary</h4>
                    <div className="space-y-4 text-[13px]">
                      <div className="flex flex-col border border-indigo-500/30 rounded-xl bg-indigo-500/10 p-3 shadow-sm">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Largest Conductor Size</span>
                        <div className="text-[24px] font-black text-indigo-600 dark:text-indigo-500 mt-1 font-mono tracking-tight">{largestCableSize ? `${largestCableSize} mm²` : "-"}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm">
                          <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Connected Load</span>
                          <strong className="text-[14px] font-bold font-mono text-foreground mt-1">{totalConnectedKw.toFixed(1)} kW</strong>
                        </div>
                        <div className="bg-background border border-border rounded-xl p-3 flex flex-col shadow-sm">
                          <span className="text-[9.5px] font-bold text-muted-foreground uppercase tracking-wider">Max Current</span>
                          <strong className="text-[14px] font-bold font-mono text-foreground mt-1">{maxDesignCurrent.toFixed(1)} A</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

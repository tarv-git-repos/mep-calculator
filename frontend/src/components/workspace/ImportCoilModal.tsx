import React, { useState, useRef, useMemo } from "react";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Layers, Trash2, CheckSquare, Square, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { cToF, fToC, lpsToCfm, cfmToLps } from "@/utils/conversions";
import type { CoilRow } from "./EditCoilModal";

// ASHRAE saturation pressure model
function satP(tK: number): number {
  if (tK >= 273.15) {
    return Math.exp(
      -5800.2206 / tK + 1.3914993 - 0.04864 * tK +
      4.1764768e-5 * tK ** 2 - 1.4452093e-8 * tK ** 3 +
      6.5459673 * Math.log(tK)
    );
  }
  return Math.exp(
    -5674.5359 / tK + 6.3925247 - 0.009677843 * tK +
    6.2215701e-7 * tK ** 2 + 2.0747825e-9 * tK ** 3 -
    9.484024e-19 * tK ** 4 + 4.1635019 * Math.log(tK)
  );
}

function wFromWB(db: number, wb: number, p: number = 101325): number {
  const ws = 0.621945 * satP(wb + 273.15) / (p - satP(wb + 273.15));
  const w = ((2501 - 2.381 * wb) * ws - 1.006 * (db - wb)) / (2501 + 1.805 * db - 4.186 * wb);
  return Math.max(0, w);
}

interface ParsedImportRow {
  id: string;
  name: string;
  dbIn: number;
  wbIn: number;
  dbOut: number;
  wbOut: number;
  flow: number;
  qty?: number;
  isValid: boolean;
  warnings?: string[];
}

interface ImportCoilModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (importedRows: CoilRow[]) => void;
  currentUnitSystem: "si" | "ip";
}

export function ImportCoilModal({
  isOpen,
  onClose,
  onImport,
  currentUnitSystem
}: ImportCoilModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileData, setFileData] = useState<ParsedImportRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [fileName, setFileName] = useState<string>("");
  const [fileTempUnit, setFileTempUnit] = useState<"c" | "f">("c");
  const [fileFlowUnit, setFileFlowUnit] = useState<"lps" | "cfm">("lps");
  const [isDragging, setIsDragging] = useState(false);

  const handleReset = () => {
    setFileData([]);
    setSelectedIds(new Set());
    setFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const parseWorkbook = (workbook: XLSX.WorkBook, name: string) => {
    try {
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

      if (jsonData.length === 0) {
        toast.error("The selected file is empty.");
        return;
      }

      // Find header row
      let headerRowIndex = -1;
      let headers: string[] = [];

      for (let r = 0; r < Math.min(20, jsonData.length); r++) {
        const row = jsonData[r];
        if (row && Array.isArray(row)) {
          const rowNorm = row.map((c) => (c !== undefined && c !== null ? String(c).trim().toLowerCase() : ""));
          const hasName = rowNorm.some((c) => /unit\s*ref|tag|coil|equipment|name|ref/i.test(c));
          const hasDb = rowNorm.some((c) => /on\s*(coil\s*)?(condn\s*)?db|entering\s*db|db|dry\s*bulb/i.test(c));
          const hasFlow = rowNorm.some((c) => /air\s*flow|airflow|flow|cfm|l\/s|lps/i.test(c));

          if ((hasName && hasDb) || (hasDb && hasFlow) || (hasName && hasFlow)) {
            headerRowIndex = r;
            headers = rowNorm;
            break;
          }
        }
      }

      // If no explicit header matched, use first non-empty row as header
      if (headerRowIndex === -1) {
        for (let r = 0; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (row && Array.isArray(row) && row.some(c => c !== null && c !== undefined && String(c).trim() !== "")) {
            headerRowIndex = r;
            headers = row.map((c) => (c !== undefined && c !== null ? String(c).trim().toLowerCase() : ""));
            break;
          }
        }
      }

      if (headerRowIndex === -1) {
        toast.error("Could not locate column headers in the spreadsheet.");
        return;
      }

      // Helper to find column index matching patterns
      const findCol = (...patterns: RegExp[]) => {
        for (const pat of patterns) {
          const idx = headers.findIndex((h) => pat.test(h));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const idxName = findCol(/unit\s*ref/i, /unit/i, /tag/i, /equipment/i, /coil/i, /name/i, /ref/i);
      const idxDbIn = findCol(/on\s*(coil\s*)?(condn\s*)?dry\s*bulb/i, /on\s*(coil\s*)?(condn\s*)?db/i, /entering\s*db/i, /on\s*db/i, /eat\s*db/i, /db\s*in/i, /db1/i);
      const idxWbIn = findCol(/on\s*(coil\s*)?(condn\s*)?wet\s*bulb/i, /on\s*(coil\s*)?(condn\s*)?wb/i, /entering\s*wb/i, /on\s*wb/i, /eat\s*wb/i, /wb\s*in/i, /wb1/i);
      const idxDbOut = findCol(/off\s*(coil\s*)?(condn\s*)?dry\s*bulb/i, /off\s*(coil\s*)?(condn\s*)?db/i, /leaving\s*db/i, /off\s*db/i, /lat\s*db/i, /db\s*out/i, /db2/i);
      const idxWbOut = findCol(/off\s*(coil\s*)?(condn\s*)?wet\s*bulb/i, /off\s*(coil\s*)?(condn\s*)?wb/i, /leaving\s*wb/i, /off\s*wb/i, /lat\s*wb/i, /wb\s*out/i, /wb2/i);
      const idxFlow = findCol(/air\s*flow\s*rate/i, /air\s*flow/i, /airflow/i, /flow\s*rate/i, /flow/i, /cfm/i, /l\/s/i, /lps/i);
      const idxQty = findCol(/qty/i, /quantity/i, /nos/i, /count/i);

      // Check for temperature and airflow unit hints in header text
      const fullHeaderText = headers.join(" ");
      let detectedTempUnit: "c" | "f" = "c";
      if (/°f|deg\s*f|fahrenheit/i.test(fullHeaderText)) {
        detectedTempUnit = "f";
      } else if (/°c|deg\s*c|celsius/i.test(fullHeaderText)) {
        detectedTempUnit = "c";
      } else {
        detectedTempUnit = currentUnitSystem === "ip" ? "f" : "c";
      }

      let detectedFlowUnit: "lps" | "cfm" = "lps";
      if (/\bcfm\b/i.test(fullHeaderText)) {
        detectedFlowUnit = "cfm";
      } else if (/l\/s|lps|liters/i.test(fullHeaderText)) {
        detectedFlowUnit = "lps";
      } else {
        detectedFlowUnit = currentUnitSystem === "ip" ? "cfm" : "lps";
      }

      setFileTempUnit(detectedTempUnit);
      setFileFlowUnit(detectedFlowUnit);

      const parsed: ParsedImportRow[] = [];

      for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row || !Array.isArray(row) || row.length === 0) continue;

        const rawName = idxName !== -1 && row[idxName] !== undefined ? String(row[idxName]).trim() : "";
        if (!rawName && row.every(c => c === undefined || c === null || String(c).trim() === "")) {
          continue;
        }

        // Stop on total/reference/summary rows
        if (/total|reference|summary|originated|reviewed|approved/i.test(rawName)) {
          continue;
        }

        // Clean numbers
        const cleanNum = (val: any, fallback: number = 0) => {
          if (val === undefined || val === null || val === "") return fallback;
          if (typeof val === "string" && val.includes("/")) {
            // If cell has "24 / 17" DB/WB pair
            const parts = val.split("/").map(p => parseFloat(p.trim())).filter(p => !isNaN(p));
            if (parts.length > 0) return parts[0];
          }
          const num = Number(String(val).replace(/[^0-9.-]/g, ""));
          return isNaN(num) ? fallback : num;
        };

        // Check if DB/WB combined column exists (e.g. "24 / 17")
        let dbInVal = cleanNum(idxDbIn !== -1 ? row[idxDbIn] : null, detectedTempUnit === "f" ? 75.2 : 24.0);
        let wbInVal = cleanNum(idxWbIn !== -1 ? row[idxWbIn] : null, detectedTempUnit === "f" ? 62.6 : 17.0);
        let dbOutVal = cleanNum(idxDbOut !== -1 ? row[idxDbOut] : null, detectedTempUnit === "f" ? 57.2 : 14.0);
        let wbOutVal = cleanNum(idxWbOut !== -1 ? row[idxWbOut] : null, detectedTempUnit === "f" ? 55.4 : 13.0);

        if (idxDbIn !== -1 && typeof row[idxDbIn] === "string" && row[idxDbIn].includes("/") && idxWbIn === -1) {
          const parts = row[idxDbIn].split("/").map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
          if (parts.length >= 2) {
            dbInVal = parts[0];
            wbInVal = parts[1];
          }
        }

        if (idxDbOut !== -1 && typeof row[idxDbOut] === "string" && row[idxDbOut].includes("/") && idxWbOut === -1) {
          const parts = row[idxDbOut].split("/").map((p: string) => parseFloat(p.trim())).filter((p: number) => !isNaN(p));
          if (parts.length >= 2) {
            dbOutVal = parts[0];
            wbOutVal = parts[1];
          }
        }

        const flowVal = cleanNum(idxFlow !== -1 ? row[idxFlow] : null, detectedFlowUnit === "cfm" ? 1000 : 500);
        const qtyVal = idxQty !== -1 ? cleanNum(row[idxQty], 1) : 1;

        const coilName = rawName || `Coil-${parsed.length + 1}`;
        const warnings: string[] = [];

        if (wbInVal > dbInVal) warnings.push("Entering WB > Entering DB");
        if (wbOutVal > dbOutVal) warnings.push("Leaving WB > Leaving DB");
        if (flowVal <= 0) warnings.push("Airflow is 0 or negative");

        parsed.push({
          id: `import-${Date.now()}-${r}-${Math.random().toString(36).slice(2, 6)}`,
          name: coilName,
          dbIn: dbInVal,
          wbIn: wbInVal,
          dbOut: dbOutVal,
          wbOut: wbOutVal,
          flow: flowVal,
          qty: qtyVal,
          isValid: warnings.length === 0,
          warnings
        });
      }

      if (parsed.length === 0) {
        toast.error("No valid coil rows found in spreadsheet.");
        return;
      }

      setFileData(parsed);
      setSelectedIds(new Set(parsed.map(p => p.id)));
      setFileName(name);
      toast.success(`Parsed ${parsed.length} coil rows from "${name}"!`);
    } catch (e) {
      console.error("Failed to parse Excel file", e);
      toast.error("Failed to parse file. Please verify it is a valid Excel or CSV sheet.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        parseWorkbook(workbook, file.name);
      } catch (err) {
        toast.error("Could not read file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        parseWorkbook(workbook, file.name);
      } catch (err) {
        toast.error("Could not read file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === fileData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(fileData.map(d => d.id)));
    }
  };

  // Convert parsed rows into final target unit system
  const convertedPreviewRows = useMemo(() => {
    const isTargetIP = currentUnitSystem === "ip";

    return fileData.map((row) => {
      // 1. Convert DB/WB to Celsius for internal psychrometrics
      const dbInC = fileTempUnit === "f" ? fToC(row.dbIn) : row.dbIn;
      const wbInC = fileTempUnit === "f" ? fToC(row.wbIn) : row.wbIn;
      const dbOutC = fileTempUnit === "f" ? fToC(row.dbOut) : row.dbOut;
      const wbOutC = fileTempUnit === "f" ? fToC(row.wbOut) : row.wbOut;

      // 2. Convert Flow to L/s for internal psychrometrics
      const flowLps = fileFlowUnit === "cfm" ? cfmToLps(row.flow) : row.flow;

      let wIn = 0;
      let wOut = 0;
      try { wIn = wFromWB(dbInC, wbInC); } catch (e) {}
      try { wOut = wFromWB(dbOutC, wbOutC); } catch (e) {}

      const dw = Math.max(0, wIn - wOut);
      const massAirFlow = (flowLps / 1000) * 1.2;
      const condFlowLps = massAirFlow * dw * (row.qty || 1);
      const condFlowLpm = condFlowLps * 60;

      // Values in final workspace unit system
      const finalDbIn = isTargetIP ? (fileTempUnit === "f" ? row.dbIn : Number(cToF(row.dbIn).toFixed(1))) : (fileTempUnit === "c" ? row.dbIn : Number(fToC(row.dbIn).toFixed(1)));
      const finalWbIn = isTargetIP ? (fileTempUnit === "f" ? row.wbIn : Number(cToF(row.wbIn).toFixed(1))) : (fileTempUnit === "c" ? row.wbIn : Number(fToC(row.wbIn).toFixed(1)));
      const finalDbOut = isTargetIP ? (fileTempUnit === "f" ? row.dbOut : Number(cToF(row.dbOut).toFixed(1))) : (fileTempUnit === "c" ? row.dbOut : Number(fToC(row.dbOut).toFixed(1)));
      const finalWbOut = isTargetIP ? (fileTempUnit === "f" ? row.wbOut : Number(cToF(row.wbOut).toFixed(1))) : (fileTempUnit === "c" ? row.wbOut : Number(fToC(row.wbOut).toFixed(1)));
      const finalFlow = isTargetIP ? (fileFlowUnit === "cfm" ? row.flow : Number(lpsToCfm(row.flow).toFixed(0))) : (fileFlowUnit === "lps" ? row.flow : Number(cfmToLps(row.flow).toFixed(0)));

      return {
        ...row,
        finalDbIn,
        finalWbIn,
        finalDbOut,
        finalWbOut,
        finalFlow,
        wIn,
        wOut,
        condFlowLpm
      };
    });
  }, [fileData, fileTempUnit, fileFlowUnit, currentUnitSystem]);

  const handleConfirmImport = () => {
    const selected = convertedPreviewRows.filter(r => selectedIds.has(r.id));
    if (selected.length === 0) {
      toast.error("Please select at least one coil to import.");
      return;
    }

    const newRows: CoilRow[] = selected.map(r => ({
      id: `coil-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: r.name,
      dbIn: r.finalDbIn,
      wbIn: r.finalWbIn,
      dbOut: r.finalDbOut,
      wbOut: r.finalWbOut,
      flow: r.finalFlow,
      comments: []
    }));

    onImport(newRows);
    toast.success(`Successfully imported ${newRows.length} coil${newRows.length > 1 ? "s" : ""}!`);
    onClose();
    handleReset();
  };

  const isTargetIP = currentUnitSystem === "ip";
  const uTemp = isTargetIP ? "°F" : "°C";
  const uFlow = isTargetIP ? "CFM" : "L/s";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-card border border-border w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/80 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Import Cooling Coils Schedule</h2>
              <p className="text-xs text-muted-foreground">Upload an Excel (.xlsx, .xls) or CSV file with coil psychrometric data.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileUpload}
            className="hidden"
          />

          {fileData.length === 0 ? (
            /* Upload Drop Area */
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all duration-200 ${
                isDragging
                  ? "border-[#0A7BC7] bg-[#0A7BC7]/5 scale-[0.99]"
                  : "border-border/80 hover:border-primary/60 hover:bg-muted/30"
              }`}
            >
              <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-sm">
                <Upload className="size-8" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-foreground">Click to upload or drag & drop coil calculation sheet</p>
                <p className="text-xs text-muted-foreground">Supports CEC-MED-FRM-114 templates, equipment schedules, and custom spreadsheets (.xlsx, .xls, .csv)</p>
              </div>
              <div className="mt-2 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-semibold">
                <FileSpreadsheet className="size-4 text-emerald-600" /> Browse Excel File
              </div>
            </div>
          ) : (
            /* File Loaded & Preview */
            <div className="flex flex-col gap-4">
              {/* File Info Bar & Unit Mapping Bar */}
              <div className="bg-slate-50 dark:bg-slate-900/80 p-4 rounded-xl border border-border/80 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="size-4" />
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-foreground truncate">{fileName}</p>
                    <p className="text-[11px] text-muted-foreground">{fileData.length} coil rows detected ({selectedIds.size} selected)</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Source File Units Controls */}
                  <div className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-lg border border-border/60 text-xs">
                    <span className="text-[11px] text-muted-foreground font-semibold">File Temp:</span>
                    <button
                      type="button"
                      onClick={() => setFileTempUnit("c")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${fileTempUnit === "c" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      °C
                    </button>
                    <button
                      type="button"
                      onClick={() => setFileTempUnit("f")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${fileTempUnit === "f" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      °F
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-lg border border-border/60 text-xs">
                    <span className="text-[11px] text-muted-foreground font-semibold">File Airflow:</span>
                    <button
                      type="button"
                      onClick={() => setFileFlowUnit("lps")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${fileFlowUnit === "lps" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      L/s
                    </button>
                    <button
                      type="button"
                      onClick={() => setFileFlowUnit("cfm")}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer transition ${fileFlowUnit === "cfm" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      CFM
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold px-2 py-1 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  >
                    <Trash2 className="size-3.5" /> Re-upload
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-border/80 rounded-xl overflow-hidden shadow-xs flex flex-col">
                <div className="bg-slate-100 dark:bg-slate-800/80 px-4 py-2 border-b border-border/80 flex justify-between items-center text-xs font-bold text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSelectAll}
                      className="flex items-center gap-1.5 text-foreground hover:text-primary transition cursor-pointer"
                    >
                      {selectedIds.size === fileData.length ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4 text-muted-foreground" />
                      )}
                      <span>Select All</span>
                    </button>
                  </div>
                  <span>Target Workspace Units: <strong className="text-foreground">{uTemp} / {uFlow}</strong></span>
                </div>

                <div className="max-h-[320px] overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-[11px] font-bold uppercase text-muted-foreground sticky top-0 border-b border-border/60">
                      <tr>
                        <th className="p-2.5 w-10 text-center"></th>
                        <th className="p-2.5">Unit Ref</th>
                        <th className="p-2.5 text-center">On DB/WB ({uTemp})</th>
                        <th className="p-2.5 text-center">Off DB/WB ({uTemp})</th>
                        <th className="p-2.5 text-right">Airflow ({uFlow})</th>
                        <th className="p-2.5 text-right">Est. Condensate</th>
                        <th className="p-2.5 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {convertedPreviewRows.map((row, idx) => {
                        const isSelected = selectedIds.has(row.id);
                        return (
                          <tr
                            key={row.id}
                            onClick={() => handleToggleSelect(row.id)}
                            className={`transition-colors cursor-pointer ${
                              isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/40 opacity-70"
                            }`}
                          >
                            <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(row.id)}
                                className="rounded border-border text-primary focus:ring-0 cursor-pointer"
                              />
                            </td>
                            <td className="p-2.5 font-bold text-foreground">{row.name}</td>
                            <td className="p-2.5 text-center font-mono">
                              {row.finalDbIn} / {row.finalWbIn}
                            </td>
                            <td className="p-2.5 text-center font-mono">
                              {row.finalDbOut} / {row.finalWbOut}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold">
                              {row.finalFlow}
                            </td>
                            <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              {row.condFlowLpm.toFixed(2)} L/min
                            </td>
                            <td className="p-2.5 text-center">
                              {row.isValid ? (
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="size-3.5" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium" title={row.warnings?.join(", ")}>
                                  <AlertTriangle className="size-3.5" /> Check
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border/80 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/80 rounded-xl hover:bg-muted/80 transition cursor-pointer"
          >
            Cancel
          </button>
          
          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={fileData.length === 0 || selectedIds.size === 0}
            className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#0A7BC7] hover:bg-[#06456F] rounded-xl transition shadow-sm disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
          >
            <Upload className="size-4" /> Import {selectedIds.size > 0 ? `${selectedIds.size} Coils` : "Coils"}
          </button>
        </div>
      </div>
    </div>
  );
}

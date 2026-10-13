import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, resolveLatestReviewState, getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Plus, Trash2, Download, Upload, X, Sparkles, AlertTriangle, CheckCircle2,
  Info, Gauge, FileText, Printer, FileSpreadsheet, Copy, ChevronDown, ChevronUp, Wrench, RefreshCw, Bookmark, HelpCircle,
  Filter, ArrowUpDown, Edit3, MessageSquare, Flag, Box, Wind, Scissors, ClipboardPaste, CopyPlus, SlidersHorizontal
} from "lucide-react";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs = saveAsPkg.saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DataGrid, type Column } from "@/components/workspace/DataGrid";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useWorkspace } from "@/lib/workspace-store";
import { CalculationReviewBar, useCalculationLock, useCalculationReviewState, useCalculationEffectiveReadOnly } from "@/components/workspace/CalculationReviewBar";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { EditPclSpaceModal } from "@/components/workspace/EditPclSpaceModal";
import { PclCategorySelect } from "@/components/workspace/PclCategorySelect";
import { exportPreliminaryCoolingLoadPDF } from "@/lib/exportPreliminaryCoolingLoadPDF";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { ImportSourceModal } from "@/components/workspace/ImportSourceModal";
import {
  checkIfPclMissingData,
  type PclRow,
  SPACE_DENSITIES,
  extractFloor,
  inferTypeFromName,
  computePclData,
  computePclValidationLogs
} from "@/lib/calc-preliminary-cooling-load";
import { extractSpacesFromActiveViewer, extractSpacesFromIFCFile } from "@/lib/bimViewerSpaceExtractor";
import { getProjectIfcFile } from "@/lib/projectIfcStorage";
import { toast } from "sonner";

export const Route = createFileRoute("/preliminary-cooling-load")({
  head: () => ({
    meta: [
      { title: "Preliminary Cooling Load â€” MEP Calc" },
      { name: "description", content: "Preliminary room-by-room cooling load and heat density estimation." },
    ],
  }),
  component: PreliminaryCoolingLoadPage,
});

const displayFloor = (fl?: string): string => {
  if (!fl) return "GF";
  const s = String(fl).trim();
  return s || "GF";
};

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, disabled, readOnly }: InlineInputProps) {
  const isReadOnly = typeof window !== "undefined" && Boolean((window as any).__mep_is_readonly || (window as any).__mep_approved_readonly);
  const isEffectiveDisabled = Boolean(disabled || readOnly || isReadOnly);

  const getCleanVal = (val: any) => {
    if (val === undefined || val === null || val === "undefined" || val === "null") {
      return "";
    }
    return String(val);
  };

  const [localVal, setLocalVal] = useState(getCleanVal(value));

  useEffect(() => {
    const clean = getCleanVal(value);
    setLocalVal((prev) => (prev === clean ? prev : clean));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setLocalVal(getCleanVal(value));
      e.currentTarget.blur();
    }
  };

  return (
    <input
      type={type}
      step={step}
      min={min}
      disabled={isEffectiveDisabled}
      readOnly={isEffectiveDisabled}
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => {
        if (isEffectiveDisabled) return;
        setLocalVal(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (isEffectiveDisabled) {
          setLocalVal(getCleanVal(value));
          return;
        }
        if (localVal !== getCleanVal(value)) {
          onCommit(localVal);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
      }}
      className={`bg-transparent w-full border border-transparent py-0.5 px-1 rounded text-foreground transition-colors ${
        isEffectiveDisabled
          ? "cursor-not-allowed opacity-75 select-none hover:border-transparent focus:border-transparent"
          : "hover:border-muted-foreground/20 focus:border-primary focus:outline-none focus:ring-0 cursor-text"
      } ${className}`}
    />
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Preliminary Cooling Load Intelligence Drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
interface CollapsibleMissingPclSectionProps {
  label: string;
  count: number;
  itemsList: { id: string; name: string; detail: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}

function CollapsibleMissingPclSection({
  label,
  count,
  itemsList,
  isOpen,
  onToggle,
  onItemClick,
}: CollapsibleMissingPclSectionProps) {
  return (
    <div className="border-b border-border/40 last:border-b-0 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5"
      >
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {isOpen ? <ChevronUp className="size-3 text-muted-foreground" /> : <ChevronDown className="size-3 text-muted-foreground" />}
        </span>
        <span className="font-mono tabular font-semibold text-foreground/80">{count}</span>
      </button>

      {isOpen && count > 0 && (
        <div className="mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-md bg-surface-2 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar">
          {itemsList.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              className="block w-full px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left cursor-pointer select-none"
            >
              <div className="text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block">
                <span className="font-sans font-medium text-foreground/80 hover:text-primary transition-colors">
                  {item.name}
                </span>
                <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                  ({item.detail})
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PclIntelligenceDrawer({
  rows,
  onClose,
  onSelectSpace,
}: {
  rows: PclRow[];
  onClose: () => void;
  onSelectSpace: (id: string) => void;
}) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    missingArea: false,
    missingType: false,
    highDensity: false,
    flagged: false,
  });

  const totalSpaces = rows.length;
  const missingAreaSpaces = rows.filter((r) => r.area === "" || r.area === undefined || parseFloat(String(r.area)) <= 0 || isNaN(parseFloat(String(r.area))));
  const missingTypeSpaces = rows.filter((r) => !r.type || r.type.trim() === "" || r.type === "Select Space Type...");
  const flaggedSpaces = rows.filter((r) => r.flagged);
  const highDensitySpaces = rows.filter((r) => (r.density || 0) > 300);

  const missingAreaItems = missingAreaSpaces.map((s) => ({
    id: s.id,
    name: s.name || "Unnamed Space",
    detail: s.floor || "GF",
  }));
  const missingTypeItems = missingTypeSpaces.map((s) => ({
    id: s.id,
    name: s.name || "Unnamed Space",
    detail: s.floor || "GF",
  }));
  const highDensityItems = highDensitySpaces.map((s) => ({
    id: s.id,
    name: `${s.name || "Space"} (${s.density} W/mÂ²)`,
    detail: s.type || "High Density",
  }));
  const flaggedItems = flaggedSpaces.map((s) => ({
    id: s.id,
    name: s.name || "Space",
    detail: s.floor || "GF",
  }));

  const nonCompliantCount = rows.filter((r) => {
    const check = checkIfPclMissingData(r);
    return check.isMissing || r.flagged;
  }).length;

  const compliancePercent = totalSpaces > 0
    ? Math.round(((totalSpaces - nonCompliantCount) / totalSpaces) * 100)
    : 100;

  let totalArea = 0;
  let totalWatts = 0;
  rows.forEach((r) => {
    const a = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
    const d = r.density || (r.type ? (SPACE_DENSITIES[r.type] || 0) : 0);
    totalArea += a;
    totalWatts += a * d;
  });
  const totalKw = totalWatts / 1000;
  const totalTr = totalKw / 3.517;
  const avgDensity = totalArea > 0 ? totalWatts / totalArea : 0;

  return (
    <div className="h-full w-full bg-card flex flex-col animate-fade-in">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0 bg-surface-1">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary animate-pulse" />
          <span className="text-[13px] font-semibold tracking-tight">PCL Intelligence & Audit</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* Compliance Section */}
        <div className="bg-surface-1 border border-border/80 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="size-3 text-emerald-500" /> Space Schedule Compliance
            </span>
            <span className="font-mono text-xs font-bold">{compliancePercent}%</span>
          </div>
          <div className="mt-2 h-1.5 bg-surface-3 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${compliancePercent === 100 ? "bg-emerald-500" : compliancePercent > 70 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${compliancePercent}%` }}
            />
          </div>
          <p className="text-[10.5px] text-muted-foreground mt-2 leading-relaxed">
            {totalSpaces - nonCompliantCount} of {totalSpaces} spaces fully assigned with area, classification, and heat density.
          </p>
        </div>

        {/* Capacity Summary */}
        <div className="bg-surface-1 border border-border/80 rounded-xl p-3">
          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5 mb-2">
            <Gauge className="size-3 text-primary" /> Cooling Capacity Summary
          </span>
          <div className="space-y-1.5 text-[11.5px]">
            <div className="flex justify-between py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Total Conditioned Area:</span>
              <span className="font-mono font-bold text-foreground">{totalArea.toFixed(1)} m²</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Avg Heat Density:</span>
              <span className="font-mono font-bold text-foreground">{avgDensity.toFixed(1)} W/m²</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Total Cooling Load (kW):</span>
              <span className="font-mono font-bold text-primary">{totalKw.toFixed(2)} kW</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-muted-foreground">Total Cooling Load (TR):</span>
              <span className="font-mono font-bold text-pink-600">{totalTr.toFixed(2)} TR</span>
            </div>
          </div>
        </div>

        {/* Heat Load Warnings */}
        <div className="bg-surface-1 border border-border/80 rounded-xl p-3">
          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5 mb-2">
            <AlertTriangle className="size-3 text-amber-500" /> Density & Hotspot Warnings
          </span>
          {avgDensity > 300 ? (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded p-2 mb-2">
              High average heat density detected ({avgDensity.toFixed(1)} W/m²). Ensure dedicated airflow and high air-change rates.
            </div>
          ) : (
            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded p-2 mb-2">
              Average heat density is within normal range ({avgDensity.toFixed(1)} W/m²).
            </div>
          )}
          <CollapsibleMissingPclSection
            label="High density spaces (>300 W/m²)"
            count={highDensityItems.length}
            itemsList={highDensityItems}
            isOpen={openSections.highDensity}
            onToggle={() => setOpenSections((prev) => ({ ...prev, highDensity: !prev.highDensity }))}
            onItemClick={onSelectSpace}
          />
        </div>

        {/* Missing Data Audit */}
        <div className="bg-surface-1 border border-border/80 rounded-xl p-3">
          <span className="text-[11px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5 mb-2">
            <Info className="size-3 text-blue-500" /> Missing Data & Flag Audit
          </span>
          <div className="divide-y divide-border/40">
            <CollapsibleMissingPclSection
              label="Missing space areas"
              count={missingAreaItems.length}
              itemsList={missingAreaItems}
              isOpen={openSections.missingArea}
              onToggle={() => setOpenSections((prev) => ({ ...prev, missingArea: !prev.missingArea }))}
              onItemClick={onSelectSpace}
            />
            <CollapsibleMissingPclSection
              label="Unassigned space types"
              count={missingTypeItems.length}
              itemsList={missingTypeItems}
              isOpen={openSections.missingType}
              onToggle={() => setOpenSections((prev) => ({ ...prev, missingType: !prev.missingType }))}
              onItemClick={onSelectSpace}
            />
            <CollapsibleMissingPclSection
              label="Spaces flagged for review"
              count={flaggedItems.length}
              itemsList={flaggedItems}
              isOpen={openSections.flagged}
              onToggle={() => setOpenSections((prev) => ({ ...prev, flagged: !prev.flagged }))}
              onItemClick={onSelectSpace}
            />
          </div>
        </div>
      </div>
    </div>
  );
}


function PreliminaryCoolingLoadPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/preliminary-cooling-load", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/preliminary-cooling-load", activeProjectId || project?.id);
  const navigate = useNavigate();
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const prompt = usePrompt();

  // State loaded from localStorage to keep 100% database compatibility
  const [projectInfo, setProjectInfo] = useState({
    projectName: "Preliminary Cooling Load Estimation",
    projectNumber: "MEP-PCL-2026",
    client: "Prestige Group developers",
    consultant: "Consistent Engineering Consultants",
    date: new Date().toISOString().split("T")[0],
    revision: "Rev 0",
    calcNumber: "CALC-HVAC-PCL01",
    notes: "Preliminary room-by-room cooling load analysis based on standard target heat dissipation densities.",
  });

  const [rows, setRows] = useState<PclRow[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const activeProjId = localStorage.getItem("mep_active_project_id") || "default";
      const projKey = `mep_pcl_rows_${activeProjId}`;
      const savedProj = localStorage.getItem(projKey);
      if (savedProj !== null) {
        const parsed = JSON.parse(savedProj);
        if (Array.isArray(parsed)) return parsed;
      }
      const savedLegacy = localStorage.getItem("pcl_rows");
      if (savedLegacy !== null) {
        const parsed = JSON.parse(savedLegacy);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [editingSpace, setEditingSpace] = useState<PclRow | null>(null);

  // Review & Approval State
  const isCalcLock = useCalculationLock("/preliminary-cooling-load");
  const isApprovedLocked = isCalcLock || calcReviewState?.status === "APPROVED";

  useEffect(() => {
    if (isApprovedLocked) {
      setSelected(new Set());
      setSelectedPending(new Set());
    }
  }, [isApprovedLocked]);

  // Custom Category Parameter Modal state
  const [customParamModalRow, setCustomParamModalRow] = useState<PclRow | null>(null);
  const [customParamName, setCustomParamName] = useState("Custom");
  const [customParamDensity, setCustomParamDensity] = useState<number>(120);
  const [customParamWorkflow, setCustomParamWorkflow] = useState<"calculate" | "direct">("calculate");
  const [customParamKw, setCustomParamKw] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);

  // Advanced selection, filter, sort and clipboard states
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [filterWarningsOnly, setFilterWarningsOnly] = useState(false);
  const [clipboard, setClipboard] = useState<PclRow[]>([]);

  // Floor ordering state matching Ventilation
  const [floorOrder, setFloorOrder] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("pcl-floor-order");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  // Bulk Edit Modal state
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditValues, setBulkEditValues] = useState({
    floor: "",
    type: "",
    area: "",
    flagged: false,
  });
  const [bulkEditFields, setBulkEditFields] = useState({
    floor: false,
    type: false,
    area: false,
    flagged: false,
  });

  // Revit Excel / JSON / 3D BIM Import Modal state
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingRecords, setPendingRecords] = useState<any[]>([]);
  const [selectedPending, setSelectedPending] = useState<Set<string>>(new Set());
  const [lastClickedPendingIndex, setLastClickedPendingIndex] = useState<number | null>(null);
  const [importBulkValues, setImportBulkValues] = useState({
    floor: "",
    type: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ifcFileInputRef = useRef<HTMLInputElement>(null);

  const mapExtracted3DSpaceToPcl = (sp: any, idx: number): any => {
    const rawName = sp.name || `Space ${idx + 1}`;
    const floor = sp.level || extractFloor(rawName) || "Ground Floor";
    const area = typeof sp.area === "number" ? sp.area : parseFloat(String(sp.area)) || 0;

    // Recognize type of space strictly based on the name of space automatically
    const inferredType = inferTypeFromName(rawName);
    const density = SPACE_DENSITIES[inferredType] || 120;
    const dissipation = area * density;
    const kw = dissipation / 1000;
    const tr = kw / 3.517;
    const isMissing = !inferredType || !area || area <= 0;

    return {
      id: `3d-pcl-${idx}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      floor,
      name: rawName,
      type: inferredType,
      density,
      area,
      occupancy: sp.fixtures || undefined,
      dissipation,
      kw: Number(kw.toFixed(2)),
      tr: Number(tr.toFixed(2)),
      flagged: isMissing,
      source: "3d-viewer",
      aiDetected: Boolean(inferredType),
    };
  };

  const handleSelect3DViewer = async () => {
    let extracted = extractSpacesFromActiveViewer();

    if (extracted.length === 0) {
      const savedFile = await getProjectIfcFile(activeProjectId);
      if (savedFile) {
        try {
          toast.loading("Extracting 3D spaces from active project IFC model...", { id: "ifc-extract" });
          extracted = await extractSpacesFromIFCFile(savedFile);
          toast.dismiss("ifc-extract");
        } catch (err) {
          toast.dismiss("ifc-extract");
          console.warn("Failed to extract spaces from project IFC file:", err);
        }
      }
    }

    if (extracted.length > 0) {
      const parsedPcl = extracted.map((sp, idx) => mapExtracted3DSpaceToPcl(sp, idx));
      setPendingRecords(parsedPcl);
      setSelectedPending(new Set(parsedPcl.map((p) => p.id)));
      setImportOpen(true);
      toast.success(`Extracted ${parsedPcl.length} spaces from 3D Studio!`);
    } else {
      const answer = await confirm(
        "No 3D IFC model is currently loaded in 3D Studio. Please go to 3D Studio and load an IFC model first.",
        {
          title: "3D Model Required",
          confirmText: "Go to 3D Studio",
          cancelText: "Cancel",
        }
      );
      if (answer) {
        navigate({ to: "/bim-viewer" });
      }
    }
  };

  const handleIFCFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading("Parsing 3D IFC Model spaces...", { id: "ifc-parse" });
      const extracted = await extractSpacesFromIFCFile(file);
      toast.dismiss("ifc-parse");
      if (extracted.length === 0) {
        toast.error("No IFCSPACE elements found in the selected model.");
        return;
      }
      const parsedPcl = extracted.map((sp, idx) => mapExtracted3DSpaceToPcl(sp, idx));
      setPendingRecords(parsedPcl);
      setSelectedPending(new Set(parsedPcl.map((p) => p.id)));
      setImportOpen(true);
      toast.success(`Successfully imported ${parsedPcl.length} spaces from 3D IFC Model!`);
    } catch (err) {
      toast.dismiss("ifc-parse");
      toast.error("Failed to parse IFC file. Please ensure it is a valid BIM IFC model.");
    } finally {
      if (e.target) e.target.value = "";
    }
  };

  const handleSelectVentilation = () => {
    let ventSpaces: any[] = [];

    // 1. Check workspaceStore spaces
    try {
      const wsSpaces = workspaceStore.getState().spaces;
      if (Array.isArray(wsSpaces) && wsSpaces.length > 0) {
        ventSpaces = wsSpaces;
      }
    } catch (e) {}

    // 2. Check project workspace_data spaces
    const projWsSpaces = (project as any)?.workspace_data?.spaces;
    if (ventSpaces.length === 0 && projWsSpaces) {
      if (Array.isArray(projWsSpaces) && projWsSpaces.length > 0) {
        ventSpaces = projWsSpaces;
      }
    }

    // 3. Check local storage cache keys
    if (ventSpaces.length === 0 && typeof localStorage !== "undefined") {
      const projId = activeProjectId || project?.id || "";
      const keysToTry = [
        `mep_spaces_${projId}`,
        `spaces_${projId}`,
        "mep_spaces",
        "spaces",
      ];
      for (const k of keysToTry) {
        try {
          const saved = localStorage.getItem(k);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              ventSpaces = parsed;
              break;
            }
          }
        } catch (e) {}
      }
    }

    if (ventSpaces.length === 0) {
      toast.error("No spaces found in the Ventilation schedule for this project yet. Please add spaces in Ventilation first or import from Excel / 3D Studio.");
      return;
    }

    // Map each ventilation space to Preliminary Cooling Load format with name-based space classification
    const parsedPcl = ventSpaces.map((sp, idx) => {
      const rawName = sp.name || `Space ${idx + 1}`;
      const floor = sp.level || sp.floor || extractFloor(rawName) || "Ground Floor";
      const area = typeof sp.area === "number" ? sp.area : (parseFloat(String(sp.area)) || 0);

      const inferredType = inferTypeFromName(rawName);
      const density = SPACE_DENSITIES[inferredType] || 120;
      const dissipation = area * density;
      const kw = dissipation / 1000;
      const tr = kw / 3.517;
      const isMissing = !inferredType || !area || area <= 0;

      return {
        id: `vent-pcl-${idx}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        floor,
        name: rawName,
        type: inferredType,
        density,
        area,
        occupancy: sp.fixtures || sp.occupants || undefined,
        dissipation,
        kw: Number(kw.toFixed(2)),
        tr: Number(tr.toFixed(2)),
        flagged: isMissing,
        source: "ventilation",
        aiDetected: Boolean(inferredType),
      };
    });

    setPendingRecords(parsedPcl);
    setSelectedPending(new Set(parsedPcl.map((p) => p.id)));
    setImportOpen(true);
    toast.success(`Loaded ${parsedPcl.length} spaces from Ventilation schedule!`);
  };

  // Comment & Task Assignment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string; type: "space" | "zone" | "equipment" } | null>(null);

  const handleOpenComment = (row: PclRow) => {
    setCommentTargetItem({ id: String(row.id), name: row.name || "Space", type: "space" });
    setCommentModalOpen(true);
  };

  // Listen for custom event from DataGrid or other comment triggers
  useEffect(() => {
    const handleCustomComment = (e: any) => {
      const detail = e.detail;
      if (detail && detail.id) {
        const found = rows.find((r) => String(r.id) === String(detail.id));
        if (found) {
          handleOpenComment(found);
        } else {
          setCommentTargetItem({ id: String(detail.id), name: detail.name || "Space", type: "space" });
          setCommentModalOpen(true);
        }
      }
    };
    window.addEventListener("open-mep-row-comment", handleCustomComment);
    return () => window.removeEventListener("open-mep-row-comment", handleCustomComment);
  }, [rows]);

  // Sync with project changes
  useEffect(() => {
    const projId = activeProjectId || project?.id;
    if (!projId) return;
    const projKey = `mep_pcl_rows_${projId}`;
    const saved = localStorage.getItem(projKey);
    if (saved !== null) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRows(parsed);
          return;
        }
      } catch (e) {}
    } else {
      // Check legacy pcl_rows only if this project has no dedicated key yet
      const savedLegacy = localStorage.getItem("pcl_rows");
      if (savedLegacy !== null) {
        try {
          const parsed = JSON.parse(savedLegacy);
          if (Array.isArray(parsed)) {
            setRows(parsed);
            return;
          }
        } catch (e) {}
      }
      setRows([]);
    }
  }, [activeProjectId, project?.id, (project as any)?.workspace_data]);

  // Save to local storage and sync on rows change
  const saveRows = (newRows: PclRow[]) => {
    if (isApprovedLocked || (typeof window !== "undefined" && Boolean((window as any).__mep_approved_readonly))) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
      return;
    }
    setRows(newRows);
    try {
      const projId = activeProjectId || project?.id || "default";
      localStorage.setItem(`mep_pcl_rows_${projId}`, JSON.stringify(newRows));
      localStorage.setItem("pcl_rows", JSON.stringify(newRows));
      localStorage.setItem("pcl_rowCount", newRows.length.toString());
      localStorage.setItem("pcl_project_info", JSON.stringify(projectInfo));
      
      // Save directly to cloud workspace and backend storage
      if (typeof forceSaveToCloud === "function") {
        (forceSaveToCloud as any)(true);
      }

      // Trigger PlumbingZoneLinker sync
      if (typeof (window as any).PlumbingZoneLinker?.syncFromPCL === "function") {
        (window as any).PlumbingZoneLinker.syncFromPCL();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Sizing Calculations
  const calculatedData = useMemo(() => {
    return computePclData(rows);
  }, [rows]);

  // Validation Warnings
  const validationLogs = useMemo(() => {
    return computePclValidationLogs(calculatedData, rows);
  }, [calculatedData, rows]);

  // Filter & Sorting Logic
  const allUniqueFloors = useMemo(() => {
    const vals = new Set<string>();
    rows.forEach((r) => {
      if (r.floor) vals.add(r.floor);
    });
    return Array.from(vals).sort();
  }, [rows]);

  const allUniqueTypes = useMemo(() => {
    const vals = new Set<string>();
    rows.forEach((r) => {
      if (r.type) vals.add(r.type);
    });
    return Array.from(vals).sort();
  }, [rows]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedFloor) count++;
    if (selectedType) count++;
    if (filterWarningsOnly) count++;
    return count;
  }, [selectedFloor, selectedType, filterWarningsOnly]);

  const handleResetFilters = () => {
    setSelectedFloor(null);
    setSelectedType(null);
    setFilterWarningsOnly(false);
  };

  const sortedFloorsForGrid = useMemo(() => {
    const ordered = floorOrder.filter((f) => allUniqueFloors.includes(f));
    const remaining = allUniqueFloors.filter((f) => !ordered.includes(f));
    return [...ordered, ...remaining];
  }, [allUniqueFloors, floorOrder]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggingIndex === null || draggingIndex === index) return;

    const nextList = [...sortedFloorsForGrid];
    const draggedItem = nextList[draggingIndex];
    nextList.splice(draggingIndex, 1);
    nextList.splice(index, 0, draggedItem);

    setDraggingIndex(index);
    setFloorOrder(nextList);
    localStorage.setItem("pcl-floor-order", JSON.stringify(nextList));
  };

  const handleDragEnd = () => {
    setDraggingIndex(null);
  };

  const handleResetFloorOrder = () => {
    setFloorOrder([]);
    localStorage.removeItem("pcl-floor-order");
  };

  const handleMoveFloor = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedFloorsForGrid.length) return;

    const nextList = [...sortedFloorsForGrid];
    const item = nextList[index];
    nextList.splice(index, 1);
    nextList.splice(targetIndex, 0, item);

    setFloorOrder(nextList);
    localStorage.setItem("pcl-floor-order", JSON.stringify(nextList));
  };

  const filteredRows = useMemo(() => {
    const q = query.toLowerCase().trim();
    return rows.filter((s) => {
      if (selectedFloor && s.floor !== selectedFloor) return false;
      if (selectedType && s.type !== selectedType) return false;
      if (filterWarningsOnly) {
        const check = checkIfPclMissingData(s);
        if (!check.isMissing && !s.flagged) return false;
      }
      if (q && !`${s.name} ${s.floor} ${s.type}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, selectedFloor, selectedType, filterWarningsOnly]);

  const orderedRows = useMemo(() => {
    const groups: Record<string, PclRow[]> = {};
    filteredRows.forEach((s) => {
      const floor = s.floor || "General";
      if (!groups[floor]) groups[floor] = [];
      groups[floor].push(s);
    });

    const sortedFloors = Object.keys(groups).sort((a, b) => {
      const idxA = sortedFloorsForGrid.indexOf(a);
      const idxB = sortedFloorsForGrid.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });

    const flat: PclRow[] = [];
    sortedFloors.forEach((floor) => {
      flat.push(...groups[floor]);
    });
    return flat;
  }, [filteredRows, sortedFloorsForGrid]);

  const [undoStack, setUndoStack] = useState<PclRow[][]>([]);
  const [redoStack, setRedoStack] = useState<PclRow[][]>([]);

  const pushToUndo = (currentRows: PclRow[]) => {
    setUndoStack((prev) => [...prev, currentRows]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, rows]);
    saveRows(previous);
    setUndoStack((prev) => prev.slice(0, -1));
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, rows]);
    saveRows(next);
    setRedoStack((prev) => prev.slice(0, -1));
    toast.success("Redo successful");
  };

  // Keyboard Shortcuts Hook matching Ventilation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected spaces/rows
      if (e.key === "Escape") {
        if (selected.size > 0 || selectedPending.size > 0) {
          e.preventDefault();
          setSelected(new Set());
          setSelectedPending(new Set());
          setLastClickedIndex(null);
        }
        return;
      }

      const activeEl = document.activeElement;
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 0. Undo / Redo: Ctrl+Z / Ctrl+Y
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (!importOpen) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        if (!importOpen) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      // 1. Ctrl+A (Select All)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (importOpen && pendingRecords.length > 0) {
          setSelectedPending(new Set(pendingRecords.map((r) => r.id)));
        } else if (!importOpen && filteredRows.length > 0) {
          setSelected(new Set(filteredRows.map((r) => r.id)));
        }
        return;
      }

      // 2. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (isApprovedLocked || (typeof window !== "undefined" && Boolean((window as any).__mep_approved_readonly))) {
          e.preventDefault();
          toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to delete spaces.", { id: "readonly-notice" });
          return;
        }
        if (importOpen && selectedPending.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to remove the ${selectedPending.size} selected pending spaces?`).then((ok: any) => {
            if (ok) {
              setPendingRecords((prev) => prev.filter((r) => !selectedPending.has(r.id)));
              setSelectedPending(new Set());
            }
          });
        } else if (!importOpen && selected.size > 0) {
          e.preventDefault();
          confirm(`Are you sure you want to delete the ${selected.size} selected space(s)?`, {
            title: "Delete Spaces",
            confirmText: "Delete",
            cancelText: "Cancel",
            variant: "destructive"
          }).then((ok: any) => {
            if (ok) {
              const selectedIds = Array.from(selected);
              pushToUndo(rows);
              saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
              setSelected(new Set());
              toast.info(`Deleted ${selectedIds.length} space(s)`);
            }
          });
        }
        return;
      }
      // 3. Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          const selectedRows = rows.filter((r) => selected.has(r.id));
          setClipboard(selectedRows);
          toast.success(`${selectedRows.length} space(s) copied`);
        }
        return;
      }

      // 4. Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          const selectedRows = rows.filter((r) => selected.has(r.id));
          setClipboard(selectedRows);
          pushToUndo(rows);
          saveRows(rows.filter((r) => !selected.has(r.id)));
          setSelected(new Set());
          toast.success(`${selectedRows.length} space(s) cut`);
        }
        return;
      }

      // 5. Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (!importOpen && clipboard.length > 0) {
          e.preventDefault();
          const pasted = clipboard.map((r, idx) => ({
            ...r,
            id: `pcl-${Date.now()}-${idx}-${Math.random()}`,
            name: `${r.name} (Copy)`
          }));
          pushToUndo(rows);
          saveRows([...rows, ...pasted]);
          setSelected(new Set(pasted.map((s) => s.id)));
          toast.success(`${pasted.length} space(s) pasted`);
        }
        return;
      }

      // 6. Duplicate: Ctrl+D
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (!importOpen && selected.size > 0) {
          e.preventDefault();
          if (isApprovedLocked) {
            toast.info("Calculation is Approved and Locked. Duplicating is locked.", { id: "readonly-notice" });
            return;
          }
          const selectedIds = Array.from(selected);
          const clones = selectedIds.map((id, index) => {
            const targetRow = rows.find((s) => s.id === id);
            if (!targetRow) return null;
            return {
              ...targetRow,
              id: `pcl-${Date.now()}-${index}-${Math.random()}`,
              name: `${targetRow.name} (Clone)`,
            };
          }).filter(Boolean) as PclRow[];

          if (clones.length > 0) {
            pushToUndo(rows);
            saveRows([...rows, ...clones]);
            setSelected(new Set(clones.map((s) => s.id)));
            toast.success(`Duplicated ${clones.length} space(s)`);
          }
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [importOpen, pendingRecords, filteredRows, selected, selectedPending, rows, clipboard, isApprovedLocked, undoStack, redoStack]);

  // DataGrid callbacks
  const toggle = (id: string, isShift?: boolean, isCtrl?: boolean) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Row selection is locked.", { id: "readonly-notice" });
      return;
    }
    setSelected((prev) => {
      const clickedIndex = orderedRows.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedIndex !== null) {
        const start = Math.min(lastClickedIndex, clickedIndex);
        const end = Math.max(lastClickedIndex, clickedIndex);
        
        if (!isCtrl) {
          next.clear();
        }

        const shouldSelect = prev.has(orderedRows[lastClickedIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = orderedRows[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedIndex(clickedIndex);
      } else {
        if (prev.has(id)) {
          next.delete(id);
          setLastClickedIndex(null);
        } else {
          next.clear();
          next.add(id);
          setLastClickedIndex(clickedIndex);
        }
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Row selection is locked.", { id: "readonly-notice" });
      return;
    }
    setSelected((prev) => (prev.size === filteredRows.length ? new Set() : new Set(filteredRows.map((r) => r.id))));
  };

  const handleToggleGroup = (ids: string[], select: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (select) {
        ids.forEach((id) => next.add(id));
      } else {
        ids.forEach((id) => next.delete(id));
      }
      return next;
    });
  };

  // Table operations

  const handleAddNewSpace = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add spaces.", { id: "readonly-notice" });
      return;
    }
    const defaultNum = rows.length + 1;
    const targetFloor = selectedFloor || (sortedFloorsForGrid.length > 0 ? sortedFloorsForGrid[0] : "GF");
    const defaultName = `Space ${defaultNum}`;

    const newRow: PclRow = {
      id: `pcl-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name: defaultName,
      area: "",
      type: "",
      density: 0,
      dissipation: 0,
      kw: 0,
      tr: 0,
      floor: targetFloor,
      flagged: true, // Auto-flagged: area and type are missing
    };

    saveRows([...rows, newRow]);
    setEditingSpace(newRow);
    toast.success(`New Space "${newRow.name}" created! Edit details in popup.`);
  };

  const handleDeleteSelected = async () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to delete spaces.", { id: "readonly-notice" });
      return;
    }
    const selectedIds = Array.from(selected);
    if (selectedIds.length === 0) {
      alert("Please select at least one space to delete.");
      return;
    }
    const ok = await confirm(`Are you sure you want to delete the ${selectedIds.length} selected space(s)?`, {
      title: "Delete Spaces",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (ok) {
      pushToUndo(rows);
      saveRows(rows.filter((r) => !selectedIds.includes(r.id)));
      setSelected(new Set());
      toast.info(`Deleted ${selectedIds.length} space(s)`);
    }
  };

  const handleClearAll = async () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to clear spaces.", { id: "readonly-notice" });
      return;
    }
    if (await confirm("Are you sure you want to remove all spaces from the schedule? This action cannot be undone.")) {
      saveRows([]);
      setSelected(new Set());
    }
  };

  // Excel / JSON Operations
  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ projectInfo, rows }));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${projectInfo.projectName.replace(/\s+/g, "_")}_pcl_estimation.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import spaces.", { id: "readonly-notice" });
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.projectInfo) setProjectInfo(parsed.projectInfo);
        if (parsed.rows) saveRows(parsed.rows);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  const parseExcelFile = (file: File) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import spaces.", { id: "readonly-notice" });
      return;
    }
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, raw: false });

        if (!jsonData || jsonData.length === 0) {
          alert("The selected Excel file is empty!");
          return;
        }

        const norm = (str: any) => (str !== null && str !== undefined ? String(str).trim().toLowerCase() : "");

        // 1. Find Data Table Header Row
        let headerRowIndex = -1;
        let headers: string[] = [];

        for (let r = 0; r < Math.min(jsonData.length, 25); r++) {
          const row = jsonData[r];
          if (!row || row.length === 0) continue;
          const rowNorm = row.map(norm);

          // Ignore top metadata rows like 'project name :', 'calculation no:'
          const isMetaRow = rowNorm.some(h => h.startsWith("project") || h.startsWith("calculation") || h.startsWith("client"));
          if (isMetaRow) continue;

          const hasArea = rowNorm.some(h => h.includes("area") || h.includes("sq. m") || h.includes("sq.m") || h.includes("sqm") || h.includes("m2") || h.includes("mÂ²"));
          const hasNameOrDesc = rowNorm.some(h => h.includes("description") || h.includes("name") || h.includes("space") || h.includes("room") || h.includes("sr. no") || h.includes("sr no") || h.includes("level") || h.includes("floor"));

          if (hasArea && hasNameOrDesc) {
            headerRowIndex = r;
            headers = rowNorm;
            break;
          }
        }

        // Fallback: scan for any row containing area
        if (headerRowIndex === -1) {
          for (let r = 0; r < Math.min(jsonData.length, 25); r++) {
            const row = jsonData[r];
            if (!row || row.length === 0) continue;
            const rowNorm = row.map(norm);
            if (rowNorm.some(h => h.includes("area") || h.includes("name") || h.includes("level") || h.includes("floor") || h.includes("description"))) {
              headerRowIndex = r;
              headers = rowNorm;
              break;
            }
          }
        }

        if (headerRowIndex === -1) {
          alert("Could not detect table headers in Excel. Please ensure the file contains columns such as Name / Description and Area.");
          return;
        }

        const findCol = (patterns: (string | RegExp)[]) => {
          return headers.findIndex(h => {
            if (!h) return false;
            return patterns.some(p => typeof p === "string" ? h === p || h.includes(p) : p.test(h));
          });
        };

        let idxLevel = findCol([/^level$/i, /^floor$/i, /^storey$/i, /^story$/i, "floor level", "level / floor", "level", "floor", "flr", "lvl"]);
        let idxName = findCol([/^name$/i, /^space\s*name$/i, /^room\s*name$/i, /^description$/i, "space name", "room name", "space description", "description", "room", "space", "name"]);
        let idxArea = findCol([/^area$/i, /^area\s*\(.*?\)$/i, "area (sq. m)", "area (sqm)", "area (m2)", "area (mÂ²)", "area", "sq. m", "sq.m", "sqm", "m2", "mÂ²"]);
        let idxType = findCol([/^type$/i, /^space\s*type$/i, /^room\s*type$/i, /^category$/i, "type of space", "space type", "room type", "category", "type"]);
        let idxOcc = findCol([/^occupancy$/i, /^occupancy\s*\(.*?\)$/i, "occupancy (no.)", "occupancy", "occupants", "number of people", "fixtures"]);

        // Fallbacks for standard column positions if not named explicitly
        if (idxName === -1 && headers.length > 1) {
          idxName = 1;
        }
        if (idxArea === -1 && headers.length > 2) {
          idxArea = 2;
        }

        if (idxArea === -1 && idxName === -1) {
          alert("Missing Name / Description or Area columns in Excel sheet.");
          return;
        }

        let currentActiveFloor = "GF";
        const parsed: any[] = [];

        for (let r = headerRowIndex + 1; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!row || row.length === 0) continue;

          const firstCellStr = norm(row[0]);
          const allCellsStr = row.map(norm).join(" ");

          // 1. Detect Floor Section Banners (e.g. 'GROUND FLOOR', 'FIRST FLOOR', 'TYPICAL FLOOR', 'BASEMENT FLOOR')
          if (firstCellStr.includes("floor") || firstCellStr.includes("ground") || firstCellStr.includes("basement") || firstCellStr.includes("roof") || firstCellStr.includes("typical") || firstCellStr.includes("level")) {
            const match = firstCellStr.match(/(basement|ground|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+(?:st|nd|rd|th)?|roof|mezzanine|podium|typical)\s*(?:floor|level)?/i);
            if (match) {
              const matchedStr = match[0].toUpperCase();
              if (matchedStr.includes("GROUND")) currentActiveFloor = "GF";
              else if (matchedStr.includes("BASEMENT")) currentActiveFloor = "BF";
              else if (matchedStr.includes("ROOF")) currentActiveFloor = "RF";
              else if (matchedStr.includes("FIRST") || matchedStr.includes("1ST") || matchedStr.includes("1 ")) currentActiveFloor = "1F";
              else if (matchedStr.includes("SECOND") || matchedStr.includes("2ND") || matchedStr.includes("2 ")) currentActiveFloor = "2F";
              else if (matchedStr.includes("THIRD") || matchedStr.includes("3RD") || matchedStr.includes("3 ")) currentActiveFloor = "3F";
              else currentActiveFloor = matchedStr;
              continue;
            }
          }

          // Skip total rows, references, or signature lines
          if (
            allCellsStr.includes("total cooling load") ||
            allCellsStr.includes("total fresh air") ||
            allCellsStr.includes("fresh air load") ||
            allCellsStr.includes("reference:") ||
            allCellsStr.includes("Originator") ||
            allCellsStr.includes("Reviewer") ||
            allCellsStr.includes("Approver") ||
            allCellsStr.includes("architectural drawings") ||
            allCellsStr.includes("dbr")
          ) {
            continue;
          }

          const levelVal = idxLevel !== -1 ? String(row[idxLevel] || "").trim() : "";
          const nameVal = idxName !== -1 ? String(row[idxName] || "").trim() : "";
          const rawArea = idxArea !== -1 ? String(row[idxArea] || "").trim() : "";
          const rawType = idxType !== -1 ? String(row[idxType] || "").trim() : "";
          const rawOcc = idxOcc !== -1 ? String(row[idxOcc] || "").trim() : "";

          // If both name and area are empty, skip row
          if (!nameVal && !rawArea) continue;

          const areaCleaned = rawArea.replace(/[^\d\.]/g, "");
          const area = parseFloat(areaCleaned) || 0;

          // Inferred or explicit type
          let inferredType = rawType || inferTypeFromName(nameVal) || "";
          // Check if inferred type is valid in SPACE_DENSITIES
          if (inferredType && !SPACE_DENSITIES[inferredType]) {
            const matchedKey = Object.keys(SPACE_DENSITIES).find(
              k => k.toLowerCase() === inferredType.toLowerCase() || inferredType.toLowerCase().includes(k.toLowerCase())
            );
            if (matchedKey) inferredType = matchedKey;
          }

          const density = inferredType ? (SPACE_DENSITIES[inferredType] || 120) : 0;
          const floor = levelVal || extractFloor(nameVal) || currentActiveFloor || "GF";
          const isMissing = !inferredType || !area || area <= 0;

          parsed.push({
            id: `pending-${r}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            floor,
            name: nameVal || `Space ${r}`,
            type: inferredType,
            density,
            area,
            occupancy: rawOcc ? (parseInt(rawOcc) || rawOcc) : undefined,
            kw: (area * density) / 1000,
            tr: ((area * density) / 1000) / 3.517,
            flagged: isMissing,
          });
        }

        if (parsed.length === 0) {
          alert("No valid space records found in the uploaded file.");
          return;
        }

        setPendingRecords(parsed);
        setSelectedPending(new Set(parsed.map((p) => p.id)));
        setImportOpen(true);
      } catch (err) {
        console.error("Excel parse error:", err);
        alert("Failed to parse Excel file. Please verify file format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
      e.target.value = "";
    }
  };

  const togglePendingRow = (id: string, isShift?: boolean) => {
    setSelectedPending((prev) => {
      const clickedIndex = pendingRecords.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift && lastClickedPendingIndex !== null) {
        const start = Math.min(lastClickedPendingIndex, clickedIndex);
        const end = Math.max(lastClickedPendingIndex, clickedIndex);

        const shouldSelect = prev.has(pendingRecords[lastClickedPendingIndex]?.id || "") || true;

        for (let i = start; i <= end; i++) {
          const rId = pendingRecords[i]?.id;
          if (rId) {
            if (shouldSelect) {
              next.add(rId);
            } else {
              next.delete(rId);
            }
          }
        }
      } else {
        if (prev.has(id)) {
          next.delete(id);
          setLastClickedPendingIndex(null);
        } else {
          next.add(id);
          setLastClickedPendingIndex(clickedIndex);
        }
      }
      return next;
    });
  };

  const handleCommitImport = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import spaces.", { id: "readonly-notice" });
      return;
    }
    const importList = pendingRecords.filter((r) => selectedPending.has(r.id));
    if (importList.length === 0) {
      alert("No spaces selected for import.");
      return;
    }

    const isDefaultData = rows.length === 5 && rows.some((r) => r.name === "G-01 Main Office Lobby");
    const baseRows = isDefaultData ? [] : [...rows];

    const importedSpaces: PclRow[] = importList.map((r, idx) => {
      let resolvedType = r.type || inferTypeFromName(r.name) || "";
      let density = r.density || (resolvedType ? (SPACE_DENSITIES[resolvedType] || 0) : 0);
      const numArea = Number(r.area) || 0;
      const dissipation = numArea * density;
      const kw = dissipation / 1000;
      const tr = kw / 3.517;
      const isNoArea = !r.area || numArea === 0 || isNaN(numArea);
      const isNoType = !resolvedType || resolvedType.trim() === "";
      const isFlagged = Boolean(r.flagged || isNoArea || isNoType);

      return {
        id: `pcl-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`,
        name: r.name,
        area: r.area,
        type: resolvedType,
        density,
        dissipation,
        kw,
        tr,
        floor: r.floor || "Default",
        flagged: isFlagged,
        aiDetected: Boolean(resolvedType),
      };
    });

    saveRows([...baseRows, ...importedSpaces]);
    setImportOpen(false);
    setPendingRecords([]);
    setSelectedPending(new Set());
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Cooling Load", {
      views: [{ showGridLines: true }],
    });

    const baseFont = { name: "Arial", size: 10, family: 2 };
    const boldFont = { ...baseFont, bold: true };
    const titleFont = { name: "Arial", size: 14, bold: true };

    const grayFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD9D9D9" },
    };

    const blueFill: any = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFDAE9F8" },
    };

    const setCellBorder = (
      cell: any,
      topStyle: string = "thin",
      bottomStyle: string = "thin",
      leftStyle: string = "thin",
      rightStyle: string = "thin"
    ) => {
      cell.border = {
        top: { style: topStyle, color: { argb: "FF000000" } },
        bottom: { style: bottomStyle, color: { argb: "FF000000" } },
        left: { style: leftStyle, color: { argb: "FF000000" } },
        right: { style: rightStyle, color: { argb: "FF000000" } },
      };
    };

    // Column widths (7 columns)
    sheet.getColumn(1).width = 8;   // S.No
    sheet.getColumn(2).width = 32;  // Name of Space
    sheet.getColumn(3).width = 16;  // Area (mÂ²)
    sheet.getColumn(4).width = 30;  // Type of Space
    sheet.getColumn(5).width = 18;  // Cooling load Density (W/mÂ²)
    sheet.getColumn(6).width = 16;  // Cooling Load (kW)
    sheet.getColumn(7).width = 16;  // Cooling Load (TR)

    // Row 2: Title Row
    sheet.getRow(2).height = 24;
    sheet.getCell("A2").value = "Preliminary Cooling Load Calculation";
    sheet.getCell("A2").font = titleFont;

    // Metadata Block (Rows 4 to 6) - exact Ventilation standard
    const calcNo = projectInfo.calcNumber || (project as any)?.calcNo || "CEC-MED-PCL-110";
    const today = projectInfo.date || new Date().toLocaleDateString("en-GB");
    const projectNo = projectInfo.projectNumber || project?.code || "P000";
    const projectName = projectInfo.projectName || project?.name || "";
    const clientName = projectInfo.client || project?.client || "";
    const endUser = projectInfo.consultant || (project as any)?.endUser || (project as any)?.location || "";

    sheet.mergeCells("A4:D4");
    sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
    sheet.getCell("A4").font = boldFont;

    sheet.mergeCells("E4:G4");
    sheet.getCell("E4").value = `Date:  ${today}`;
    sheet.getCell("E4").font = boldFont;

    sheet.mergeCells("A5:D5");
    sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
    sheet.getCell("A5").font = boldFont;

    sheet.mergeCells("E5:G5");
    sheet.getCell("E5").value = `Client:   ${clientName}`;
    sheet.getCell("E5").font = boldFont;

    sheet.mergeCells("A6:D6");
    sheet.getCell("A6").value = `Project Name:   ${projectName}`;
    sheet.getCell("A6").font = boldFont;

    sheet.mergeCells("E6:G6");
    sheet.getCell("E6").value = `End User:   ${endUser}`;
    sheet.getCell("E6").font = boldFont;

    for (let r = 4; r <= 6; r++) {
      sheet.getRow(r).height = 22;
      for (let c = 1; c <= 7; c++) {
        const cell = sheet.getCell(r, c);
        const topStyle = r === 4 ? "medium" : "thin";
        const bottomStyle = r === 6 ? "medium" : "thin";
        const leftStyle = c === 1 ? "medium" : "thin";
        const rightStyle = c === 7 ? "medium" : (c === 4 ? "medium" : "thin");
        setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
        cell.alignment = { vertical: "middle", indent: (c === 1 || c === 5) ? 1 : 0 };
        if (!cell.font || !cell.font.bold) cell.font = baseFont;
      }
    }

    // Row 8: Section Header - PROJECT SUMMARY STATS
    sheet.addRow([]);
    sheet.mergeCells("A8:G8");
    const cellA8 = sheet.getCell("A8");
    cellA8.value = "PROJECT SUMMARY STATS";
    cellA8.font = boldFont;
    cellA8.fill = grayFill;
    cellA8.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    setCellBorder(cellA8, "medium", "medium", "medium", "medium");
    sheet.getRow(8).height = 22;

    // Rows 9-11: Summary Stats Grid
    const r9 = sheet.addRow(["Total Spaces:", "", rows.length, "Total Load (TR):", "", "", Number(calculatedData.totalTr.toFixed(2))]);
    sheet.mergeCells(`A9:B9`);
    sheet.mergeCells(`D9:F9`);
    r9.getCell(1).font = boldFont;
    r9.getCell(3).font = boldFont;
    r9.getCell(3).alignment = { horizontal: "right" };
    r9.getCell(4).font = boldFont;
    r9.getCell(7).font = boldFont;
    r9.getCell(7).alignment = { horizontal: "right" };
    r9.getCell(7).numFmt = "0.00";

    const r10 = sheet.addRow(["Total Floor Area (mÂ²):", "", Number(calculatedData.totalArea.toFixed(1)), "Total Load (TR):", "", "", Number(calculatedData.totalTr.toFixed(2))]);
    sheet.mergeCells(`A10:B10`);
    sheet.mergeCells(`D10:F10`);
    r10.getCell(1).font = boldFont;
    r10.getCell(3).font = boldFont;
    r10.getCell(3).alignment = { horizontal: "right" };
    r10.getCell(3).numFmt = "0.0";
    r10.getCell(4).font = boldFont;
    r10.getCell(7).font = boldFont;
    r10.getCell(7).alignment = { horizontal: "right" };
    r10.getCell(7).numFmt = "0.00";

    const r11 = sheet.addRow(["Total Cooling Load (kW):", "", Number(calculatedData.totalKw.toFixed(2)), "Average Load Density (W/mÂ²):", "", "", Number(calculatedData.avgDensity.toFixed(1))]);
    sheet.mergeCells(`A11:B11`);
    sheet.mergeCells(`D11:F11`);
    r11.getCell(1).font = boldFont;
    r11.getCell(3).font = boldFont;
    r11.getCell(3).alignment = { horizontal: "right" };
    r11.getCell(3).numFmt = "0.00";
    r11.getCell(4).font = boldFont;
    r11.getCell(7).font = boldFont;
    r11.getCell(7).alignment = { horizontal: "right" };
    r11.getCell(7).numFmt = "0.0";

    for (let r = 9; r <= 11; r++) {
      sheet.getRow(r).height = 20;
      for (let c = 1; c <= 7; c++) {
        const cell = sheet.getCell(r, c);
        const topStyle = "thin";
        const bottomStyle = r === 11 ? "medium" : "thin";
        const leftStyle = c === 1 ? "medium" : "thin";
        const rightStyle = c === 7 ? "medium" : (c === 3 ? "medium" : "thin");
        setCellBorder(cell, topStyle, bottomStyle, leftStyle, rightStyle);
        if (c === 7) cell.fill = blueFill;
      }
    }

    // Row 13: Section Header - COOLING LOAD SCHEDULE
    sheet.addRow([]);
    sheet.mergeCells("A13:G13");
    const cellA13 = sheet.getCell("A13");
    cellA13.value = "COOLING LOAD SCHEDULE";
    cellA13.font = boldFont;
    cellA13.fill = grayFill;
    cellA13.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    setCellBorder(cellA13, "medium", "medium", "medium", "medium");
    sheet.getRow(13).height = 22;

    // Row 14: Table Headers
    const headerRow = sheet.addRow([
      "Sr. No.",
      "Name of Space",
      "Area (mÂ²)",
      "Type of Space",
      "Cooling load\nDensity\n(W/mÂ²)",
      "Cooling Load\n(kW)",
      "Cooling\nLoad (TR)"
    ]);
    sheet.getRow(14).height = 45;
    headerRow.eachCell((cell, colNumber) => {
      cell.font = boldFont;
      cell.fill = (colNumber === 6 || colNumber === 7) ? blueFill : grayFill;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      setCellBorder(cell, "medium", "medium", colNumber === 1 ? "medium" : "thin", colNumber === 7 ? "medium" : "thin");
    });

    // Grouping by Floor
    const grouped: Record<string, PclRow[]> = {};
    rows.forEach(row => {
      const fl = row.floor || "General";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(row);
    });

    let sNo = 1;
    const floorList = Object.keys(grouped).length > 0 ? Object.keys(grouped).sort() : ["General"];

    floorList.forEach(floor => {
      const floorRows = grouped[floor] || [];
      const floorHeaderRow = sheet.addRow([`Floor: ${floor}`]);
      sheet.mergeCells(`A${floorHeaderRow.number}:G${floorHeaderRow.number}`);
      const fCell = floorHeaderRow.getCell(1);
      fCell.font = boldFont;
      fCell.fill = blueFill;
      fCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      setCellBorder(fCell, "thin", "thin", "medium", "medium");
      floorHeaderRow.height = 20;

      floorRows.forEach(r => {
        const areaVal = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
        const densityVal = r.density || 120;
        const kwVal = typeof r.kw === "number" ? r.kw : (areaVal * densityVal) / 1000;
        const trVal = typeof r.tr === "number" ? r.tr : kwVal / 3.517;

        const dataRow = sheet.addRow([
          sNo++,
          r.name,
          Number(areaVal.toFixed(1)),
          r.type || "Unassigned",
          Number(densityVal.toFixed(1)),
          Number(kwVal.toFixed(2)),
          Number(trVal.toFixed(2))
        ]);

        dataRow.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
        dataRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
        dataRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
        dataRow.getCell(3).numFmt = "0.0";
        dataRow.getCell(4).alignment = { horizontal: "left", vertical: "middle" };
        dataRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
        dataRow.getCell(5).numFmt = "0.0";
        dataRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
        dataRow.getCell(6).numFmt = "0.00";
        dataRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
        dataRow.getCell(7).numFmt = "0.00";

        dataRow.eachCell((cell, colNumber) => {
          cell.font = baseFont;
          setCellBorder(cell, "thin", "thin", colNumber === 1 ? "medium" : "thin", colNumber === 7 ? "medium" : "thin");
        });
      });
    });

    // TOTAL Summary Row
    const totalRow = sheet.addRow([
      "Total:",
      "",
      Number(calculatedData.totalArea.toFixed(1)),
      "",
      Number(calculatedData.avgDensity.toFixed(1)),
      Number(calculatedData.totalKw.toFixed(2)),
      Number(calculatedData.totalTr.toFixed(2))
    ]);
    sheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
    totalRow.height = 25;

    totalRow.getCell(1).alignment = { horizontal: "right", vertical: "middle" };
    totalRow.getCell(3).alignment = { horizontal: "center", vertical: "middle" };
    totalRow.getCell(3).numFmt = "0.0";
    totalRow.getCell(4).alignment = { horizontal: "center", vertical: "middle" };
    totalRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };
    totalRow.getCell(5).numFmt = "0.0";
    totalRow.getCell(6).alignment = { horizontal: "center", vertical: "middle" };
    totalRow.getCell(6).numFmt = "0.00";
    totalRow.getCell(7).alignment = { horizontal: "center", vertical: "middle" };
    totalRow.getCell(7).numFmt = "0.00";

    totalRow.eachCell((cell, colNumber) => {
      cell.font = boldFont;
      cell.fill = (colNumber === 6 || colNumber === 7) ? blueFill : grayFill;
      setCellBorder(cell, "medium", "medium", colNumber === 1 ? "medium" : "thin", colNumber === 7 ? "medium" : "thin");
    });

    // Signature block
    const sigRow = sheet.rowCount ? sheet.rowCount + 2 : 20;
    addExcelSignatureBlock(sheet, sigRow, currentUserName, project?.id || "default", "/preliminary-cooling-load", 7);

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), `${(projectInfo.projectName || "Preliminary_Cooling_Load").replace(/\s+/g, "_")}_report.xlsx`);
  };

  const handlePrintPDF = () => {
    exportPreliminaryCoolingLoadPDF(rows, {
      projectName: projectInfo.projectName,
      client: projectInfo.client,
      projectNo: projectInfo.projectNumber,
      calcNo: projectInfo.calcNumber,
      date: projectInfo.date,
      reviewState: calcReviewState,
    });
  };

  // Bulk Edit Callback
  const handleBulkEditSave = () => {
    const selectedIds = Array.from(selected);
    const updated = rows.map((r) => {
      if (selectedIds.includes(r.id)) {
        const nextRow = { ...r };
        if (bulkEditFields.floor) {
          nextRow.floor = bulkEditValues.floor.trim() || r.floor;
        }
        if (bulkEditFields.type) {
          nextRow.type = bulkEditValues.type;
          nextRow.density = SPACE_DENSITIES[bulkEditValues.type] || 120;
        }
        if (bulkEditFields.area) {
          nextRow.area = parseFloat(bulkEditValues.area) || r.area;
        }
        if (bulkEditFields.flagged) {
          nextRow.flagged = bulkEditValues.flagged;
        }
        const numArea = nextRow.area !== "" ? Number(nextRow.area) : 0;
        nextRow.dissipation = numArea * nextRow.density;
        nextRow.kw = nextRow.dissipation / 1000;
        nextRow.tr = nextRow.kw / 3.517;
        return nextRow;
      }
      return r;
    });
    saveRows(updated);
    setBulkEditOpen(false);
    setSelected(new Set());
  };

  const getSpaceEditIds = (rId: string): string[] => {
    return selected.has(rId) ? Array.from(selected) : [rId];
  };

  // DataGrid Column definitions for PCL
  const columns: Column<PclRow>[] = [
    {
      key: "name",
      header: "NAME OF SPACE",
      width: 240,
      editable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5 w-full">
          <InlineInput disabled={isApprovedLocked} readOnly={isApprovedLocked}
            value={r.name}
            onCommit={(newName) => {
              const editIds = getSpaceEditIds(r.id);
              const editSet = new Set(editIds);
              const floor = extractFloor(newName);
              const inferred = inferTypeFromName(newName);

              saveRows(rows.map(row => {
                if (!editSet.has(row.id)) return row;
                let nextType = row.type || "";
                let density = row.density || 0;
                let aiDetected = row.aiDetected;

                // If row has no type or inferred a valid type from name change
                if (inferred && (!row.type || row.type === "" || inferred !== row.type)) {
                  nextType = inferred;
                  density = SPACE_DENSITIES[inferred] || 120;
                  aiDetected = true;
                } else if (nextType && !density) {
                  density = SPACE_DENSITIES[nextType] || 0;
                }

                const numArea = row.area !== "" ? Number(row.area) : 0;
                const dissipation = numArea * density;
                const kw = dissipation / 1000;
                const tr = kw / 3.517;

                const wasMissing = checkIfPclMissingData(row).isMissing;
                const check = checkIfPclMissingData({
                  ...row,
                  name: newName,
                  type: nextType,
                  area: row.area,
                });
                let flagged = row.flagged;
                if (check.isMissing) {
                  flagged = true;
                } else if (wasMissing && !check.isMissing) {
                  flagged = false;
                }

                return {
                  ...row,
                  name: newName,
                  floor: floor || row.floor,
                  type: nextType,
                  density,
                  dissipation,
                  kw,
                  tr,
                  flagged,
                  aiDetected
                };
              }));

              if (inferred && (!r.type || r.type === "" || inferred !== r.type)) {
                toast.success(`Auto-selected category: ${inferred} (${SPACE_DENSITIES[inferred] || 0} W/m²)`);
              }
            }}
            className="font-normal text-[13px] font-sans flex-1 min-w-0"
          />
        </div>
      ),
    },
    {
      key: "area",
      header: "AREA (M²)",
      width: 95,
      align: "center",
      mono: true,
      editable: true,
      render: (r) => (
        <InlineInput disabled={isApprovedLocked} readOnly={isApprovedLocked}
          type="number"
          min={1}
          value={r.area}
          placeholder="-"
          onCommit={(newAreaStr) => {
            const editIds = getSpaceEditIds(r.id);
            const editSet = new Set(editIds);
            const nextArea = newAreaStr === "" ? "" : Number(newAreaStr);
            const numArea = nextArea !== "" ? Number(nextArea) : 0;

            saveRows(rows.map(row => {
              if (!editSet.has(row.id)) return row;
              const density = row.type ? (SPACE_DENSITIES[row.type] || row.density || 0) : 0;
              const dissipation = numArea * density;
              const kw = dissipation / 1000;
              const tr = kw / 3.517;

              const wasMissing = checkIfPclMissingData(row).isMissing;
              const check = checkIfPclMissingData({
                ...row,
                area: nextArea,
              });
              let flagged = row.flagged;
              if (check.isMissing) {
                flagged = true;
              } else if (wasMissing && !check.isMissing) {
                flagged = false;
              }

              return {
                ...row,
                area: nextArea,
                dissipation,
                kw,
                tr,
                flagged
              };
            }));
          }}
          className="font-mono text-center text-[13px]"
        />
      ),
    },
    {
      key: "type",
      header: "TYPE OF SPACE",
      width: 270,
      editable: true,
      render: (r) => {
        const isCustom = Boolean(r.type && (r.type.endsWith(" (Custom)") || r.type === "Other"));
        return (
          <span className="inline-flex items-center gap-1.5 w-full h-full" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
            <span
              title={r.aiDetected ? "Automatically identified" : undefined}
              className={`size-1.5 rounded-full shrink-0 ${r.aiDetected ? "bg-primary cursor-help" : "bg-transparent pointer-events-none"}`}
            />
            <div className="flex items-center justify-between gap-1 w-full min-w-0 pr-1">
              <PclCategorySelect
                value={r.type || ""}
                densities={SPACE_DENSITIES}
                hideChevron={isCustom}
                onChange={(nextType) => {
                  const editIds = getSpaceEditIds(r.id);
                  const editSet = new Set(editIds);

                  if (nextType === "Other" || nextType === "OTHER") {
                    const categoryName = r.type && r.type.endsWith(" (Custom)") ? r.type : "Custom (Custom)";
                    setCustomParamModalRow({
                      ...r,
                      type: categoryName,
                    });
                    setCustomParamName(categoryName.replace(/\s*\(Custom\)$/, ""));
                    setCustomParamDensity(r.density || 120);
                    setCustomParamWorkflow("calculate");
                    return;
                  }

                  const density = nextType ? (SPACE_DENSITIES[nextType] || 0) : 0;
                  saveRows(
                    rows.map((row) => {
                      if (!editSet.has(row.id)) return row;
                      const numArea = row.area !== "" ? Number(row.area) : 0;
                      const dissipation = numArea * density;
                      const kw = dissipation / 1000;
                      const tr = kw / 3.517;

                      const wasMissing = checkIfPclMissingData(row).isMissing;
                      const check = checkIfPclMissingData({
                        ...row,
                        type: nextType,
                      });
                      let flagged = row.flagged;
                      if (check.isMissing) {
                        flagged = true;
                      } else if (wasMissing && !check.isMissing) {
                        flagged = false;
                      }

                      return {
                        ...row,
                        type: nextType,
                        density,
                        dissipation,
                        kw,
                        tr,
                        flagged,
                        aiDetected: false,
                      };
                    })
                  );
                }}
                triggerClassName="pl-1 pr-1.5 flex-1"
              />
              {isCustom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCustomParamModalRow(r);
                    setCustomParamName(r.type.replace(/\s*\(Custom\)$/, ""));
                    setCustomParamDensity(r.density || 120);
                    setCustomParamWorkflow("calculate");
                  }}
                  className="flex items-center justify-center p-1 rounded hover:bg-surface-2 text-primary hover:text-primary/80 transition-colors cursor-pointer w-6 h-6 shrink-0"
                  title="Configure Custom Parameters"
                >
                  <Wrench className="size-3.5" />
                </button>
              )}
            </div>
          </span>
        );
      },
    },
    {
      key: "density",
      header: "DENSITY",
      width: 100,
      align: "center",
      mono: true,
      render: (r) => (
        <div className="w-full text-center">
          {r.type && r.density ? `${r.density} W/m²` : <span className="text-muted-foreground/40 font-mono">-</span>}
        </div>
      ),
    },
    {
      key: "kw",
      header: "LOAD (KW)",
      width: 100,
      align: "center",
      mono: true,
      render: (r) => (
        <div className="w-full text-center">
          {(!r.area || !r.type || !r.kw || r.kw === 0 || isNaN(r.kw)) ? (
            <span className="text-muted-foreground/40 font-mono">-</span>
          ) : `${r.kw.toFixed(2)} kW`}
        </div>
      ),
    },
    {
      key: "tr",
      header: "LOAD (TR)",
      width: 100,
      align: "center",
      mono: true,
      render: (r) => (
        <div className="w-full text-center">
          {(!r.area || !r.type || !r.tr || r.tr === 0 || isNaN(r.tr)) ? (
            <span className="text-muted-foreground/40 font-mono">-</span>
          ) : `${r.tr.toFixed(2)} TR`}
        </div>
      ),
    },
    {
      key: "flagged",
      header: "",
      width: 36,
      align: "center",
      render: (r) => {
        const check = checkIfPclMissingData(r);
        const isFlagged = Boolean(r.flagged || check.isMissing);
        const tooltip = check.isMissing
          ? check.reason
          : (r.flagged ? "Flagged for engineering review (click to unflag)" : "Click to flag space");

        return (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const editIds = getSpaceEditIds(r.id);
              const editSet = new Set(editIds);
              const nextFlag = !isFlagged;
              saveRows(rows.map((row) => (editSet.has(row.id) ? { ...row, flagged: nextFlag } : row)));
            }}
            className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
            title={tooltip}
          >
            <Flag
              className={`size-3.5 transition-all duration-200 ${
                isFlagged
                  ? "fill-red-500 text-red-500 scale-110"
                  : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
              }`}
            />
          </button>
        );
      },
    },
  ];

  const renderSpaceContextMenu = (row: PclRow) => {
    const selectedIds = selected.has(row.id) ? Array.from(selected) : [row.id];
    const isMulti = selectedIds.length > 1;
    const targetsCount = selectedIds.length;
    const targetRows = rows.filter((s) => selectedIds.includes(s.id));

    return (
      <ContextMenuContent className="w-64 min-w-[16rem] bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        {/* Add Comment */}
        <ContextMenuItem
          onClick={() => handleOpenComment(row)}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium"
        >
          <MessageSquare className="size-3.5" />
          <span>Add Comment</span>
        </ContextMenuItem>

        {/* Flag Space */}
        <ContextMenuItem
          onClick={() => {
            const anyUnflagged = selectedIds.some((id) => !rows.find((s) => s.id === id)?.flagged);
            const editSet = new Set(selectedIds);
            saveRows(rows.map((s) => (editSet.has(s.id) ? { ...s, flagged: anyUnflagged } : s)));
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Flag className={`size-3.5 ${row.flagged ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
          <span>{row.flagged ? (isMulti ? "Unflag Selected" : "Unflag Space") : (isMulti ? "Flag Selected" : "Flag Space")}</span>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Cut */}
        <ContextMenuItem
          onClick={() => {
            if (isApprovedLocked) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            setClipboard(targetRows);
            pushToUndo(rows);
            saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
            setSelected(new Set());
            toast.success(`${targetRows.length} space(s) cut`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Scissors className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Cut Selected" : "Cut"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Copy */}
        <ContextMenuItem
          onClick={() => {
            setClipboard(targetRows);
            toast.success(`${targetRows.length} space(s) copied`);
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Copy className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Copy Selected" : "Copy"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
        </ContextMenuItem>

        {/* Paste */}
        <ContextMenuItem
          disabled={clipboard.length === 0 || isApprovedLocked}
          onClick={() => {
            if (isApprovedLocked) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            if (clipboard.length > 0) {
              const pasted = clipboard.map((r, idx) => ({
                ...r,
                id: `pcl-${Date.now()}-${idx}-${Math.random()}`,
                name: `${r.name} (Copy)`
              }));
              pushToUndo(rows);
              saveRows([...rows, ...pasted]);
              setSelected(new Set(pasted.map((s) => s.id)));
              toast.success(`${pasted.length} space(s) pasted`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer data-[disabled]:opacity-50 data-[disabled]:pointer-events-none"
        >
          <ClipboardPaste className="size-3.5 text-muted-foreground" />
          <span>Paste</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Edit Space (Above duplicate space) */}
        {isMulti ? (
          <ContextMenuItem
            onClick={() => {
              if (isApprovedLocked) {
                toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
                return;
              }
              setBulkEditValues({
                floor: "",
                type: "",
                area: "",
                flagged: false,
              });
              setBulkEditFields({
                floor: false,
                type: false,
                area: false,
                flagged: false,
              });
              setBulkEditOpen(true);
            }}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
            <span className="whitespace-nowrap">Bulk Edit ({targetsCount} spaces)</span>
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            onClick={() => {
              if (isApprovedLocked) {
                toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
                return;
              }
              setEditingSpace(row);
            }}
            className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
          >
            <Edit3 className="size-3.5 text-muted-foreground shrink-0" />
            <span className="whitespace-nowrap">Edit Space</span>
            <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto pl-3 whitespace-nowrap text-right">Double Click</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Duplicate Space (Above delete) */}
        <ContextMenuItem
          onClick={() => {
            if (isApprovedLocked) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            const clones = selectedIds.map((id, index) => {
              const targetRow = rows.find((s) => s.id === id);
              if (!targetRow) return null;
              return {
                ...targetRow,
                id: `pcl-${Date.now()}-${index}-${Math.random()}`,
                name: `${targetRow.name} (Clone)`,
              };
            }).filter(Boolean) as PclRow[];

            if (clones.length > 0) {
              pushToUndo(rows);
              saveRows([...rows, ...clones]);
              setSelected(new Set(clones.map((s) => s.id)));
              toast.success(`Duplicated ${clones.length} space(s)`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <CopyPlus className="size-3.5 text-muted-foreground" />
          <span>{isMulti ? "Duplicate Selected" : "Duplicate Space"}</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuSeparator className="h-px bg-border my-1" />

        {/* Delete (Last at bottom) */}
        <ContextMenuItem
          onClick={async () => {
            if (isApprovedLocked) {
              toast.info("Calculation is Approved and Locked.", { id: "readonly-notice" });
              return;
            }
            const msg = targetsCount === 1
              ? `Are you sure you want to delete space "${row.name}"?`
              : `Are you sure you want to delete the ${targetsCount} selected spaces?`;

            const ok = await confirm(msg, {
              title: "Delete Spaces",
              confirmText: "Delete",
              cancelText: "Cancel",
              variant: "destructive"
            });

            if (ok) {
              pushToUndo(rows);
              saveRows(rows.filter((s) => !selectedIds.includes(s.id)));
              setSelected(new Set());
              toast.info(`Deleted ${targetsCount} space(s)`);
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete</span>
          <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const renderFloorGroupHeader = (floor: string) => {
    const floorRows = filteredRows.filter(r => r.floor === floor);
    return (
      <span className="flex items-center gap-1.5 font-medium">
        <span><strong className="font-bold text-primary">{floor.toLowerCase().includes('floor') ? floor : `Floor - ${floor}`}</strong></span>
        <span className="text-[10px] text-muted-foreground font-normal">({floorRows.length} spaces) (Right-click or press Delete to remove)</span>
      </span>
    );
  };

  const renderFloorGroupContextMenu = (floor: string) => {
    return (
      <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50">
        <ContextMenuItem
          onClick={async () => {
            const newFloor = await prompt("Enter new floor name:", floor, { title: "Rename Floor" });
            if (newFloor && newFloor.trim() !== "" && newFloor.trim() !== floor) {
              const trimmed = newFloor.trim();
              saveRows(rows.map(s => s.floor === floor ? { ...s, floor: trimmed } : s));
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
        >
          <Edit3 className="size-3.5 text-muted-foreground" />
          <span>Rename Floor</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator className="h-px bg-border my-1" />
        
        <ContextMenuItem
          onClick={async () => {
            const floorSpaces = rows.filter((s) => s.floor === floor);
            if (floorSpaces.length > 0) {
              if (await confirm(`Are you sure you want to delete all ${floorSpaces.length} spaces on floor "${floor}"?`)) {
                saveRows(rows.filter((s) => s.floor !== floor));
                setSelected(new Set());
              }
            }
          }}
          className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer"
        >
          <Trash2 className="size-3.5" />
          <span>Delete Floor</span>
        </ContextMenuItem>
      </ContextMenuContent>
    );
  };

  const [intelOpen, setIntelOpen] = useState(false);

  return (
    <AppShell title="Preliminary Cooling Load" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-2 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg">
            <div className="flex flex-col gap-1 w-full">
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Preliminary Cooling Load</h1>

                </div>
                <button
                  onClick={() => setIntelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar
                  projectId={activeProjectId || project?.id || "default"}
                  calculatorPath="/preliminary-cooling-load"
                  calculatorTitle="Preliminary Cooling Load"
                />
              </div>
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            calcReviewState?.status === "APPROVED" 
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/60 modal-blur-bg">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setActiveTab("calculator")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing Calculator
                </button>
                <button
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report
                </button>
              </div>

              {/* Right Side Action Button: Export */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handlePrintPDF}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {activeTab === "calculator" ? (
                <div className="flex-1 min-h-0 flex flex-col relative">
                    
                    {/* Toolbar matching Ventilation */}
                    <div className="relative flex items-center gap-1.5 px-3 h-10 bg-background border-b border-border/60 shrink-0 flex-wrap no-print select-none modal-blur-bg">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Filter spaces..."
                        className="h-7 w-56 px-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none"
                      />

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                              activeFiltersCount > 0
                                ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                                : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                          >
                            <Filter className="size-3.5 shrink-0" />
                            {activeFiltersCount > 0 && (
                              <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                                {activeFiltersCount}
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                          <div className="flex items-center justify-between pb-1.5 border-b border-border">
                            <span className="text-[12px] font-semibold text-foreground">Filters</span>
                            {activeFiltersCount > 0 && (
                              <button
                                onClick={handleResetFilters}
                                className="text-[10px] text-primary hover:underline font-semibold"
                              >
                                Clear All
                              </button>
                            )}
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor</span>
                            <select
                              value={selectedFloor || ""}
                              onChange={(e) => setSelectedFloor(e.target.value || null)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="">All Floors</option>
                              {allUniqueFloors.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1">
                            <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Space Type</span>
                            <select
                              value={selectedType || ""}
                              onChange={(e) => setSelectedType(e.target.value || null)}
                              className="h-8 w-full px-2 bg-surface-2 border border-border rounded-lg text-[12px] outline-none cursor-pointer"
                            >
                              <option value="">All Space Types</option>
                              {allUniqueTypes.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-1 pt-1.5 border-t border-border/60">
                            <label className="flex items-center gap-2 text-[11.5px] font-semibold text-foreground cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={filterWarningsOnly}
                                onChange={(e) => setFilterWarningsOnly(e.target.checked)}
                                className="rounded border-gray-300 text-red-600 size-3.5 focus:ring-red-500"
                              />
                              <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                                <Flag className="size-3 fill-red-500 text-red-500" />
                                Flagged / Warnings Only
                              </span>
                            </label>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                              floorOrder.length > 0
                                ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                                : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                            }`}
                          >
                            <ArrowUpDown className="size-3.5 shrink-0" />
                            {floorOrder.length > 0 && (
                              <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                                ✓
                              </span>
                            )}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans z-50">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11.5px] font-semibold text-foreground">Arrange Floors</span>
                            {floorOrder.length > 0 && (
                              <button
                                onClick={handleResetFloorOrder}
                                className="text-[10px] text-primary hover:underline font-medium"
                              >
                                Reset
                              </button>
                            )}
                          </div>
                          <p className="text-[10.5px] text-muted-foreground mb-3 leading-snug">
                            Use ▲ / ▼ buttons or drag floors to change their sorting order in grid views.
                          </p>
                          <div className="flex flex-col gap-1.5 max-h-[250px] overflow-y-auto pr-0.5">
                            {sortedFloorsForGrid.map((floor, index) => (
                              <div
                                key={floor}
                                draggable
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragOver={(e) => handleDragOver(e, index)}
                                onDragEnd={handleDragEnd}
                                className={`flex items-center justify-between gap-2 p-1.5 bg-surface rounded border border-border text-[11px] cursor-grab active:cursor-grabbing select-none transition-all duration-150 ${
                                  draggingIndex === index
                                    ? "opacity-40 border-primary bg-primary/5 shadow-md"
                                    : "hover:bg-surface-2 hover:border-border-strong"
                                }`}
                              >
                                <span className="font-semibold text-foreground uppercase truncate flex-1 min-w-0">{displayFloor(floor)}</span>

                                {/* Up / Down Move Action Buttons (Works 100% in Desktop EXE / Electron / WebViews) */}
                                <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    disabled={index === 0}
                                    onClick={() => handleMoveFloor(index, "up")}
                                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer ${
                                      index === 0 ? "opacity-25 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    title="Move floor up"
                                  >
                                    <ChevronUp className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={index === sortedFloorsForGrid.length - 1}
                                    onClick={() => handleMoveFloor(index, "down")}
                                    className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer ${
                                      index === sortedFloorsForGrid.length - 1 ? "opacity-25 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    title="Move floor down"
                                  >
                                    <ChevronDown className="size-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      {/* View Options & Column Distribution Popover */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            className="relative inline-flex items-center justify-center h-7 w-7 rounded-full border border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible"
                            title="View / Column Distribution"
                          >
                            <SlidersHorizontal className="size-3.5 shrink-0" />
                            <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                              View Options
                            </span>
                          </button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50 text-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-border">
                            <span className="text-[12px] font-semibold text-foreground">Column Distribution</span>
                          </div>
                          <p className="text-[10.5px] text-muted-foreground leading-snug">
                            Drag column divider lines in table headers to adjust custom widths. Click below to restore auto-distribution.
                          </p>
                          <button
                            onClick={() => {
                              try {
                                localStorage.removeItem("mep_grid_preliminary-cooling-load");
                                window.dispatchEvent(new CustomEvent("mep-reset-column-widths"));
                                window.dispatchEvent(new Event("resize"));
                                toast.success("Column widths reset to auto-distribution");
                              } catch (e) {}
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-surface-2 hover:bg-surface-3 text-foreground font-semibold text-[11.5px] border border-border transition-colors cursor-pointer"
                          >
                            <RefreshCw className="size-3 text-primary" />
                            Reset Column Widths
                          </button>
                        </PopoverContent>
                      </Popover>
                      
                      <div className="ml-auto flex items-center gap-1">
                        <TBtn 
                          disabled={isApprovedLocked}
                          onClick={() => {
                            if (isApprovedLocked) {
                              toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to import spaces.", { id: "readonly-notice" });
                              return;
                            }
                            setSourceModalOpen(true);
                          }}
                        ><Download className="size-3.5" /> Import</TBtn>
                        <TBtn primary onClick={handleAddNewSpace}><Plus className="size-3.5" /> New Space</TBtn>
                      </div>

                      {/* Bulk actions bar overlay matching Ventilation */}
                      {!isApprovedLocked && selected.size > 0 && (
                        <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                          <span className="font-semibold">{selected.size} selected</span>
                          <span className="text-primary/30">·</span>
                          <BulkBtn icon={Edit3} onClick={() => {
                            setBulkEditValues({
                              floor: "",
                              type: "",
                              area: "",
                              flagged: false,
                            });
                            setBulkEditFields({
                              floor: false,
                              type: false,
                              area: false,
                              flagged: false,
                            });
                            setBulkEditOpen(true);
                          }}>Bulk edit</BulkBtn>
                          <BulkBtn icon={Copy} onClick={() => {
                            const selectedIdsArray = Array.from(selected);
                            const selectedSpaces = rows.filter(r => selectedIdsArray.includes(r.id));
                            if (selectedSpaces.length < 2) {
                              toast.error("Please select 2 or more spaces to merge.");
                              return;
                            }
                            const first = selectedSpaces[0];
                            const totalMergedArea = selectedSpaces.reduce((acc, s) => acc + (typeof s.area === "number" ? s.area : parseFloat(String(s.area)) || 0), 0);
                            const mergedName = `${first.name} (Merged)`;
                            const density = first.type ? (SPACE_DENSITIES[first.type] || first.density || 0) : 0;
                            const watts = totalMergedArea * density;
                            const kw = watts / 1000;
                            const tr = kw / 3.517;

                            const mergedSpace: PclRow = {
                              id: `pcl-${Date.now()}`,
                              name: mergedName,
                              floor: first.floor,
                              area: totalMergedArea,
                              type: first.type,
                              density,
                              dissipation: watts,
                              kw: Number(kw.toFixed(2)),
                              tr: Number(tr.toFixed(2)),
                              flagged: false,
                            };

                            const remaining = rows.filter(r => !selectedIdsArray.includes(r.id));
                            pushToUndo(rows);
                            saveRows([...remaining, mergedSpace]);
                            setSelected(new Set([mergedSpace.id]));
                            toast.success(`Merged ${selectedSpaces.length} spaces into "${mergedName}"`);
                          }}>Merge spaces</BulkBtn>
                          <BulkBtn icon={Trash2} onClick={handleDeleteSelected}>Delete</BulkBtn>
                          <button onClick={() => setSelected(new Set())} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer">
                            <X className="size-3" /> Clear
                          </button>
                        </div>
                      )}
                    </div>

                    {/* DataGrid container */}
                    <div className="flex-1 min-h-0 relative flex flex-col">
                      {rows.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-surface-2">
                          <div className="max-w-md w-full bg-background border border-border rounded-xl p-8 shadow-sm flex flex-col items-center text-center animate-scale-in">
                            <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4 animate-bounce">
                              <Download className="size-6" />
                            </div>
                            <h3 className="text-[15px] font-semibold tracking-tight">No Spaces Loaded</h3>
                            <p className="text-[12px] text-muted-foreground mt-2 mb-6 leading-relaxed">
                              Start by importing a Revit Excel space schedule sheet or manually add spaces. The system will automatically detect space classifications, apply heat dissipation densities, and compute cooling load metrics.
                            </p>
                            <div className="flex items-center gap-3 w-full">
                              <button
                                onClick={() => setSourceModalOpen(true)}
                                className="flex-1 bg-primary text-primary-foreground font-semibold h-9 rounded hover:bg-primary/95 transition-colors text-xs flex items-center justify-center gap-2 shadow cursor-pointer"
                              >
                                <Download className="size-3.5" /> Import
                              </button>
                              <button
                                onClick={handleAddNewSpace}
                                className="flex-1 border border-border hover:bg-surface-2 font-semibold h-9 rounded transition-colors text-xs flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <Plus className="size-3.5" /> Add Space
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <DataGrid
                          gridId="preliminary-cooling-load"
                          activeRowId={editingSpace?.id}
                          rows={filteredRows}
                          columns={columns}
                          selected={selected}
                          onToggle={toggle}
                          onToggleAll={toggleAll}
                          isReadOnly={isApprovedLocked}
                          onRowDoubleClick={(r) => setEditingSpace(r)}
                          onCommentClick={handleOpenComment}
                          renderContextMenu={renderSpaceContextMenu}
                          groupBy={(r) => r.floor}
                          groupOrder={sortedFloorsForGrid}
                          renderGroupHeader={renderFloorGroupHeader}
                          renderGroupContextMenu={renderFloorGroupContextMenu}
                          onToggleGroup={handleToggleGroup}
                          rowClassName={(row, index) =>
                            index % 2 === 0
                              ? "bg-[#f4f4f7]/70 dark:bg-[#1c1c21]/80 hover:bg-[#ebebee] dark:hover:bg-[#25252b]"
                              : "bg-card hover:bg-[#ebebee] dark:hover:bg-[#25252b]"
                          }
                        />
                      )}
                      {editingSpace && (
                        <EditPclSpaceModal
                          space={editingSpace}
                          onClose={() => setEditingSpace(null)}
                          onSave={(updated) => {
                            saveRows(rows.map((r) => r.id === updated.id ? updated : r));
                            setEditingSpace(null);
                          }}
                          availableFloors={sortedFloorsForGrid}
                          spaceDensities={SPACE_DENSITIES}
                        />
                      )}
                    </div>

                    {/* Bottom stats summary bar */}
                    <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none no-print modal-blur-bg">
                      <div>Showing <span className="text-foreground font-medium tabular">{filteredRows.length.toLocaleString()}</span> of {rows.length.toLocaleString()} spaces</div>
                      <div className="flex items-center gap-3 tabular">
                        <span>Total Area: <span className="font-mono text-foreground font-bold">{calculatedData.totalArea.toFixed(1)} m²</span></span>
                        <span>Avg Heat Density: <span className="font-mono text-foreground font-bold">{calculatedData.avgDensity.toFixed(1)} W/m²</span></span>
                        <span>Total Load (kW): <span className="font-mono text-primary font-bold">{calculatedData.totalKw.toFixed(2)} kW</span></span>
                        <span>Total Load (TR): <span className="font-mono text-pink-600 font-bold">{calculatedData.totalTr.toFixed(2)} TR</span></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Printable Report tab view matching exact standard layout */
                  <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                    <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">
                      
                      {/* 1. Title */}
                      <div className="pb-1">
                        <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                          Preliminary Cooling Load Calculation
                        </h2>
                      </div>

                      {/* 2. Project Metadata Header Box (Exact 2-column x 3-row format) */}
                      <div className="border border-border rounded-xl overflow-hidden text-xs">
                        <table className="w-full border-collapse">
                          <tbody>
                            <tr className="border-b border-border divide-x divide-border">
                              <td className="p-2.5 font-bold w-40 bg-muted/20">Calculation No.:</td>
                              <td className="p-2.5 font-mono text-foreground font-medium">{projectInfo.calcNumber || "CALC-HVAC-PCL01"}</td>
                              <td className="p-2.5 font-bold w-28 bg-muted/20">Date:</td>
                              <td className="p-2.5 font-mono font-medium">{projectInfo.date || new Date().toISOString().split("T")[0]}</td>
                            </tr>
                            <tr className="border-b border-border divide-x divide-border">
                              <td className="p-2.5 font-bold bg-muted/20">Project No.:</td>
                              <td className="p-2.5 font-mono">{projectInfo.projectNumber || project?.code || "MEP-PCL-2026"}</td>
                              <td className="p-2.5 font-bold bg-muted/20">Client:</td>
                              <td className="p-2.5">{projectInfo.client || project?.client || "Prestige Group developers"}</td>
                            </tr>
                            <tr className="divide-x divide-border">
                              <td className="p-2.5 font-bold bg-muted/20">Project Name:</td>
                              <td className="p-2.5">{projectInfo.projectName || project?.name || "Preliminary Cooling Load Estimation"}</td>
                              <td className="p-2.5 font-bold bg-muted/20">End User:</td>
                              <td className="p-2.5">{(project as any)?.endUser || "g"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 3. Space & Cooling Load Schedule (2-Tier Header Table) */}
                      <div className="border border-border rounded-xl overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                              <th rowSpan={2} className="p-2 border-r border-border w-12 text-center">
                                Sr.<br />No.
                              </th>
                              <th colSpan={3} className="p-2 border-r border-border text-center">
                                Space Parameters
                              </th>
                              <th colSpan={3} className="p-2 border-r border-border text-center">
                                Design Parameters
                              </th>
                              <th colSpan={3} className="p-2 text-center">
                                Cooling Load Metrics
                              </th>
                            </tr>
                            <tr className="bg-[#E5E7EB] dark:bg-zinc-800 text-foreground font-bold border-b border-border text-center">
                              <th className="p-2 border-r border-border w-24 text-center">Space Floor</th>
                              <th className="p-2 border-r border-border text-left min-w-[120px]">Space Name</th>
                              <th className="p-2 border-r border-border text-left min-w-[130px]">Space Type</th>
                              <th className="p-2 border-r border-border w-20 text-center">Area (m²)</th>
                              <th className="p-2 border-r border-border w-20 text-center">Occupancy</th>
                              <th className="p-2 border-r border-border w-24 text-center">Density (W/m²)</th>
                              <th className="p-2 border-r border-border w-24 text-center">Heat Gain (W)</th>
                              <th className="p-2 border-r border-border w-20 text-center">Load (kW)</th>
                              <th className="p-2 w-20 text-center">Load (TR)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {(() => {
                              const rowsByFloor: { [floor: string]: PclRow[] } = {};
                              const floorOrder: string[] = [];

                              const sorted = [...rows].sort((a, b) => {
                                const flA = (a.floor || "Default").toLowerCase();
                                const flB = (b.floor || "Default").toLowerCase();
                                if (flA !== flB) return flA.localeCompare(flB);
                                return (a.name || "").localeCompare(b.name || "");
                              });

                              sorted.forEach((r) => {
                                const fl = r.floor || "Default";
                                if (!rowsByFloor[fl]) {
                                  rowsByFloor[fl] = [];
                                  floorOrder.push(fl);
                                }
                                rowsByFloor[fl].push(r);
                              });

                              let globalSrNo = 1;
                              let grandArea = 0;
                              let grandWatts = 0;
                              let grandKw = 0;
                              let grandTr = 0;

                              return (
                                <>
                                  {floorOrder.map((floorName) => {
                                    const floorRows = rowsByFloor[floorName];
                                    let floorArea = 0;
                                    let floorWatts = 0;
                                    let floorKw = 0;
                                    let floorTr = 0;

                                    return (
                                      <React.Fragment key={floorName}>
                                        {floorRows.map((r) => {
                                          const areaVal = typeof r.area === "number" ? r.area : (parseFloat(String(r.area)) || 0);
                                          const densityVal = r.density || 120;
                                          const wattsVal = r.dissipation || (areaVal * densityVal);
                                          const kwVal = typeof r.kw === "number" && r.kw > 0 ? r.kw : wattsVal / 1000;
                                          const trVal = typeof r.tr === "number" && r.tr > 0 ? r.tr : kwVal / 3.517;

                                          floorArea += areaVal;
                                          floorWatts += wattsVal;
                                          floorKw += kwVal;
                                          floorTr += trVal;

                                          grandArea += areaVal;
                                          grandWatts += wattsVal;
                                          grandKw += kwVal;
                                          grandTr += trVal;

                                          return (
                                            <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/40">
                                              <td className="p-2 border-r border-border text-center text-muted-foreground font-mono">
                                                {globalSrNo++}
                                              </td>
                                              <td className="p-2 border-r border-border text-center">
                                                {r.floor || "Default"}
                                              </td>
                                              <td className="p-2 border-r border-border font-medium">
                                                {r.name || "-"}
                                              </td>
                                              <td className="p-2 border-r border-border text-muted-foreground">
                                                {r.type || "General"}
                                              </td>
                                              <td className="p-2 border-r border-border text-center font-mono">
                                                {areaVal.toFixed(1)}
                                              </td>
                                              <td className="p-2 border-r border-border text-center font-mono text-muted-foreground">
                                                {r.occupancy ? String(r.occupancy) : "-"}
                                              </td>
                                              <td className="p-2 border-r border-border text-center font-mono">
                                                {densityVal.toFixed(0)}
                                              </td>
                                              <td className="p-2 border-r border-border text-center font-mono">
                                                {Math.round(wattsVal).toLocaleString()}
                                              </td>
                                              <td className="p-2 border-r border-border text-center font-mono">
                                                {kwVal.toFixed(2)}
                                              </td>
                                              <td className="p-2 text-center font-mono">
                                                {trVal.toFixed(2)}
                                              </td>
                                            </tr>
                                          );
                                        })}

                                        {/* Floor Total Row matching Screenshot */}
                                        <tr className="bg-slate-50/70 dark:bg-zinc-900/60 font-bold border-t border-b border-border">
                                          <td className="p-2 border-r border-border text-center"></td>
                                          <td className="p-2 border-r border-border text-center font-bold">
                                            {floorName}
                                          </td>
                                          <td className="p-2 border-r border-border font-bold">
                                            TOTAL ({floorName})
                                          </td>
                                          <td className="p-2 border-r border-border"></td>
                                          <td className="p-2 border-r border-border text-center font-mono font-bold">
                                            {floorArea.toFixed(1)}
                                          </td>
                                          <td className="p-2 border-r border-border"></td>
                                          <td className="p-2 border-r border-border"></td>
                                          <td className="p-2 border-r border-border text-center font-mono font-bold">
                                            {Math.round(floorWatts).toLocaleString()}
                                          </td>
                                          <td className="p-2 border-r border-border text-center font-mono font-bold">
                                            {floorKw.toFixed(2)}
                                          </td>
                                          <td className="p-2 text-center font-mono font-bold">
                                            {floorTr.toFixed(2)}
                                          </td>
                                        </tr>
                                      </React.Fragment>
                                    );
                                  })}

                                  {/* Grand Total Row if multiple floors */}
                                  {floorOrder.length > 1 && (
                                    <tr className="bg-slate-100 dark:bg-zinc-800 font-black border-t-2 border-border">
                                      <td className="p-2 border-r border-border text-center"></td>
                                      <td className="p-2 border-r border-border text-center">ALL</td>
                                      <td className="p-2 border-r border-border">OVERALL TOTAL</td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border text-center font-mono">
                                        {grandArea.toFixed(1)}
                                      </td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border"></td>
                                      <td className="p-2 border-r border-border text-center font-mono">
                                        {Math.round(grandWatts).toLocaleString()}
                                      </td>
                                      <td className="p-2 border-r border-border text-center font-mono">
                                        {grandKw.toFixed(2)}
                                      </td>
                                      <td className="p-2 text-center font-mono">
                                        {grandTr.toFixed(2)}
                                      </td>
                                    </tr>
                                  )}
                                </>
                              );
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* 4. 3-Tier Signature Sign-Off Block (Exact #FFE6CC Header) */}
                      {(() => {
                        const sig = getSignatureBlockDetails(
                          project?.id || "default",
                          "/preliminary-cooling-load",
                          currentUserName,
                          calcReviewState
                        );
                        return (
                          <div className="pt-2">
                            <div className="border border-border rounded-xl overflow-hidden text-xs">
                              <table className="w-full border-collapse">
                                <thead className="bg-[#FFE6CC] dark:bg-amber-950/40 text-foreground font-bold border-b border-border">
                                  <tr className="divide-x divide-border">
                                    <th className="p-2.5 w-28 text-center"></th>
                                    <th className="p-2.5 text-center w-1/3">Originator</th>
                                    <th className="p-2.5 text-center w-1/3">Reviewer</th>
                                    <th className="p-2.5 text-center w-1/3">Approver</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                  <tr className="divide-x divide-border">
                                    <td className="p-2.5 font-bold text-center bg-muted/10">Name:</td>
                                    <td className="p-2.5 text-center font-medium">
                                      {sig.originatedName || currentUserName || "Abubakar Chanda"}
                                    </td>
                                    <td className="p-2.5 text-center font-medium">
                                      {sig.reviewerName || ""}
                                    </td>
                                    <td className="p-2.5 text-center font-medium">
                                      {sig.approverName || ""}
                                    </td>
                                  </tr>
                                  <tr className="divide-x divide-border">
                                    <td className="p-2.5 font-bold text-center bg-muted/10">Date:</td>
                                    <td className="p-2.5 text-center font-mono">
                                      {sig.originatedDate || formatDateStr(new Date().toISOString())}
                                    </td>
                                    <td className="p-2.5 text-center font-mono">
                                      {sig.reviewerDate || ""}
                                    </td>
                                    <td className="p-2.5 text-center font-mono">
                                      {sig.approverDate || ""}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}

                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${
            intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg flex flex-col" : "w-0"
          }`}
        >
          {intelOpen && (
            <PclIntelligenceDrawer
              rows={rows}
              onClose={() => setIntelOpen(false)}
              onSelectSpace={(id) => {
                setSelected(new Set([id]));
                const el = document.getElementById(`space-row-${id}`);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
            />
          )}
        </div>
      </div>

      {/* Import Source Selector Modal */}
      <ImportSourceModal
        isOpen={sourceModalOpen}
        onClose={() => setSourceModalOpen(false)}
        onSelectExcel={() => fileInputRef.current?.click()}
        onSelect3DViewer={handleSelect3DViewer}
        onSelectVentilation={handleSelectVentilation}
      />
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".xlsx,.xls,.json"
        className="hidden"
      />
      <input
        type="file"
        ref={ifcFileInputRef}
        accept=".ifc"
        onChange={handleIFCFileUpload}
        className="hidden"
      />

      {/* Import Modal Overlay */}
      {importOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden font-sans">
            <header className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="size-5 text-primary animate-bounce" />
                <h3 className="font-bold text-[15px]">Import Space Schedule</h3>
              </div>
              <button
                onClick={() => {
                  setImportOpen(false);
                  setPendingRecords([]);
                }}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-md p-1 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-6">
              {pendingRecords.length === 0 ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) parseExcelFile(file);
                  }}
                  className="flex-1 min-h-[300px] border-2 border-dashed border-border hover:border-primary/50 rounded-2xl flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-slate-900/10 cursor-pointer transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-4">
                    <Upload className="size-8" />
                  </div>
                  <span className="font-semibold text-sm">Drag & drop your Excel space schedule here</span>
                  <span className="text-xs text-muted-foreground mt-1">or click to browse files from your computer</span>
                  <div className="mt-4 flex items-center gap-2 flex-wrap justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectVentilation();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer text-foreground"
                    >
                      <Wind className="size-3.5 text-sky-500" /> Import from Ventilation
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect3DViewer();
                      }}
                      className="px-3 py-1.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer text-foreground"
                    >
                      <Box className="size-3.5 text-primary" /> Import from 3D Studio
                    </button>
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-3 font-mono">Supports Revit Space Schedules (.xlsx, .xls) and 3D BIM Models</span>
                </div>
              ) : (
                <div className="flex flex-col lg:flex-row gap-6 min-h-[400px]">
                  {/* Left: Pending rows table */}
                  <div className="flex-1 flex flex-col border border-border rounded-xl bg-card overflow-hidden">
                    <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border-b border-border flex items-center justify-between text-xs font-semibold">
                      <span>Previewing {pendingRecords.length} parsed spaces</span>
                      <span>{selectedPending.size} selected</span>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto max-h-[350px]">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50/50 dark:bg-slate-900/20 border-b border-border text-[10.5px] font-bold text-muted-foreground uppercase">
                            <th className="p-3 text-center w-10">
                              <input
                                type="checkbox"
                                checked={selectedPending.size === pendingRecords.length}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPending(new Set(pendingRecords.map(p => p.id)));
                                  } else {
                                    setSelectedPending(new Set());
                                  }
                                }}
                                className="rounded border-gray-300 text-primary size-3.5 cursor-pointer"
                              />
                            </th>
                            <th className="p-3">Level</th>
                            <th className="p-3">Name</th>
                            <th className="p-3">Area (mÂ²)</th>
                            <th className="p-3">Space Type</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40 font-medium">
                          {pendingRecords.map((r, index) => (
                            <tr
                              key={r.id}
                              onClick={(e) => togglePendingRow(r.id, e.shiftKey)}
                              className={`hover:bg-slate-50/40 dark:hover:bg-slate-900/10 cursor-pointer transition-colors ${
                                selectedPending.has(r.id) ? "bg-primary/5" : ""
                              }`}
                            >
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={selectedPending.has(r.id)}
                                  onChange={() => togglePendingRow(r.id)}
                                  className="rounded border-gray-300 text-primary size-3.5 cursor-pointer"
                                />
                              </td>
                              <td className="p-3 font-mono text-[11px] uppercase">{displayFloor(r.floor)}</td>
                              <td className="p-3 text-foreground">{r.name}</td>
                              <td className="p-3 font-mono">{r.area.toFixed(1)}</td>
                              <td className="p-3 font-sans truncate max-w-[150px]">{r.type}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Right: Bulk Editor Panel for Import */}
                  <div className="w-full lg:w-72 border border-border rounded-xl bg-card p-4 flex flex-col gap-4">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Bulk Parameters Config
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      Apply parameters to the {selectedPending.size} selected pending spaces before committing them.
                    </p>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Override Floor</label>
                      <input
                        type="text"
                        value={importBulkValues.floor}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, floor: e.target.value })}
                        placeholder="e.g. L01"
                        className="h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">Set Space Type</label>
                      <select
                        value={importBulkValues.type}
                        onChange={(e) => setImportBulkValues({ ...importBulkValues, type: e.target.value })}
                        className="h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary cursor-pointer"
                      >
                        <option value="">Choose space type...</option>
                        {Object.keys(SPACE_DENSITIES).map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={() => {
                        if (selectedPending.size === 0) {
                          alert("Select pending spaces first.");
                          return;
                        }
                        const updated = pendingRecords.map((r) => {
                          if (selectedPending.has(r.id)) {
                            const next = { ...r };
                            if (importBulkValues.floor) next.floor = importBulkValues.floor.trim();
                            if (importBulkValues.type) {
                              next.type = importBulkValues.type;
                              next.density = SPACE_DENSITIES[importBulkValues.type] || 120;
                              next.kw = (next.area * next.density) / 1000;
                              next.tr = next.kw / 3.517;
                            }
                            return next;
                          }
                          return r;
                        });
                        setPendingRecords(updated);
                      }}
                      className="w-full bg-primary/10 hover:bg-primary/20 text-primary font-bold h-8.5 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      Apply Parameters
                    </button>
                  </div>

                </div>
              )}
            </div>

            {pendingRecords.length > 0 && (
              <footer className="px-6 py-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between shrink-0 font-sans text-xs">
                <button
                  onClick={() => {
                    setPendingRecords([]);
                    setSelectedPending(new Set());
                  }}
                  className="h-9 px-4 border border-border rounded-lg hover:bg-surface-2 font-semibold text-foreground transition-all cursor-pointer"
                >
                  Clear Preview
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setImportOpen(false)}
                    className="h-9 px-4 border border-border rounded-lg hover:bg-surface-2 font-semibold text-foreground transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCommitImport}
                    className="h-9 px-5 bg-primary hover:bg-primary/95 text-primary-foreground font-semibold rounded-lg shadow transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    Import {selectedPending.size} Spaces
                  </button>
                </div>
              </footer>
            )}
          </div>
        </div>
      )}

      {/* Bulk Edit Modal Overlay */}
      {bulkEditOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md animate-scale-in font-sans">
            <header className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-[14px]">Bulk Edit Parameters</h3>
              <button
                onClick={() => setBulkEditOpen(false)}
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-md p-1"
              >
                <X className="size-4" />
              </button>
            </header>
            
            <div className="p-5 flex flex-col gap-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                Modify attributes for the {selected.size} selected spaces. Check the fields you want to update.
              </p>

              {/* Floor Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.floor}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, floor: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span>Floor Level</span>
                </label>
                {bulkEditFields.floor && (
                  <input
                    type="text"
                    value={bulkEditValues.floor}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, floor: e.target.value })}
                    placeholder="e.g. 1F, GF"
                    className="h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary mt-1"
                  />
                )}
              </div>

              {/* Space Type Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.type}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, type: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span>Space Type / Heat Density</span>
                </label>
                {bulkEditFields.type && (
                  <select
                    value={bulkEditValues.type}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, type: e.target.value })}
                    className="h-8 px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary cursor-pointer mt-1"
                  >
                    <option value="" disabled>Select Space Type...</option>
                    {Object.keys(SPACE_DENSITIES).map(k => (
                      <option key={k} value={k}>{k} ({SPACE_DENSITIES[k]} W/mÂ²)</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Area Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.area}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, area: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span>Area (mÂ²)</span>
                </label>
                {bulkEditFields.area && (
                  <input
                    type="number"
                    value={bulkEditValues.area}
                    onChange={(e) => setBulkEditValues({ ...bulkEditValues, area: e.target.value })}
                    placeholder="e.g. 50"
                    className="h-8 px-2.5 bg-surface-2 border border-border rounded-lg text-xs outline-none focus:border-primary mt-1"
                  />
                )}
              </div>

              {/* Flag / Review Field */}
              <div className="flex flex-col gap-1.5 border border-border/60 rounded-xl p-3 bg-slate-50/30 dark:bg-slate-900/5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={bulkEditFields.flagged}
                    onChange={(e) => setBulkEditFields({ ...bulkEditFields, flagged: e.target.checked })}
                    className="rounded border-gray-300 text-primary size-3.5"
                  />
                  <span className="flex items-center gap-1.5">
                    <Flag className="size-3 text-red-500" />
                    <span>Flag / Attention Status</span>
                  </span>
                </label>
                {bulkEditFields.flagged && (
                  <div className="flex items-center gap-4 mt-1 pl-5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="bulkFlagStatus"
                        checked={bulkEditValues.flagged === true}
                        onChange={() => setBulkEditValues({ ...bulkEditValues, flagged: true })}
                        className="text-primary size-3.5"
                      />
                      <span className="text-red-600 dark:text-red-400 font-medium">Flag Selected</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="bulkFlagStatus"
                        checked={bulkEditValues.flagged === false}
                        onChange={() => setBulkEditValues({ ...bulkEditValues, flagged: false })}
                        className="text-primary size-3.5"
                      />
                      <span className="text-muted-foreground">Unflag Selected</span>
                    </label>
                  </div>
                )}
              </div>
            </div>

            <footer className="px-5 py-3.5 border-t border-border bg-slate-50/50 dark:bg-slate-900/10 flex justify-end gap-2 shrink-0">
              <button
                onClick={() => setBulkEditOpen(false)}
                className="h-8 px-4 border border-border rounded-lg hover:bg-surface-2 text-xs font-semibold text-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkEditSave}
                className="h-8 px-4 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-semibold rounded-lg shadow cursor-pointer"
              >
                Apply Changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Assign Comment & Task Modal */}
      {commentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={commentModalOpen}
          onClose={() => {
            setCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="space"
          spaceId={commentTargetItem.id}
          spaceName={commentTargetItem.name}
          calculatorTitle="Preliminary Cooling Load"
          calculatorPath="/preliminary-cooling-load"
          existingComments={getMergedItemComments(
            commentTargetItem.id,
            commentTargetItem.name,
            rows.find(r => String(r.id) === String(commentTargetItem.id))?.comments || [],
            "/preliminary-cooling-load",
            project?.id
          )}
          onSave={(comment) => {
            const updatedRows = rows.map(r => String(r.id) === String(commentTargetItem.id) ? {
              ...r,
              comments: [...(r.comments || []), comment]
            } : r);
            saveRows(updatedRows);
            try {
              workspaceStore.addCommentToTarget(commentTargetItem.id, 'space', comment);
            } catch (e) {}
            if (project?.id) {
              localStorage.setItem(`mep_pcl_rows_${project.id}`, JSON.stringify(updatedRows));
            }
          }}
        />
      )}

      {/* Custom Category Modal for "OTHER" */}
      {customParamModalRow && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-md animate-scale-in text-foreground">
            <header className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-semibold text-[14px]">Configure Custom Parameters</h3>
              </div>
              <button 
                type="button"
                onClick={() => setCustomParamModalRow(null)} 
                className="text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded p-0.5 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </header>
            <div className="p-4 flex flex-col gap-4 text-xs">
              <div>
                <div className="text-muted-foreground mb-2 leading-relaxed">
                  Define custom calculation parameters for the category of space <span className="font-semibold text-foreground">"{customParamModalRow.name || "Space"}"</span>.
                </div>
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Custom Category Name</label>
                <input
                  type="text"
                  value={customParamName}
                  onChange={(e) => setCustomParamName(e.target.value)}
                  placeholder="e.g. Custom (Custom)"
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none text-foreground font-sans focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-muted-foreground font-medium mb-1">Workflow Method</label>
                <select
                  value={customParamWorkflow}
                  onChange={(e) => setCustomParamWorkflow(e.target.value as "calculate" | "direct")}
                  className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none cursor-pointer text-foreground focus:border-primary"
                >
                  <option value="calculate">Calculate Airflow / Cooling Density</option>
                  <option value="direct">Direct Airflow / Cooling Values</option>
                </select>
              </div>

              {customParamWorkflow === "direct" ? (
                <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-3">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Cooling Load (kW)</label>
                    <input
                      type="number"
                      step="any"
                      value={customParamKw || ""}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setCustomParamKw(val);
                        const areaNum = typeof customParamModalRow.area === "number" ? customParamModalRow.area : parseFloat(String(customParamModalRow.area)) || 0;
                        if (areaNum > 0) {
                          setCustomParamDensity(Number(((val * 1000) / areaNum).toFixed(1)));
                        }
                      }}
                      className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono text-foreground focus:border-primary"
                      placeholder="10.0"
                    />
                  </div>
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Cooling Load (TR)</label>
                    <input
                      type="number"
                      step="any"
                      value={customParamKw ? Number((customParamKw / 3.517).toFixed(2)) : ""}
                      onChange={(e) => {
                        const trVal = parseFloat(e.target.value) || 0;
                        const kwVal = trVal * 3.517;
                        setCustomParamKw(Number(kwVal.toFixed(2)));
                        const areaNum = typeof customParamModalRow.area === "number" ? customParamModalRow.area : parseFloat(String(customParamModalRow.area)) || 0;
                        if (areaNum > 0) {
                          setCustomParamDensity(Number(((kwVal * 1000) / areaNum).toFixed(1)));
                        }
                      }}
                      className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono text-foreground focus:border-primary"
                      placeholder="2.84"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
                  <div>
                    <label className="block text-muted-foreground font-medium mb-1">Cooling Load Density (W/mÂ²)</label>
                    <input
                      type="number"
                      step="any"
                      value={customParamDensity ?? ""}
                      onChange={(e) => setCustomParamDensity(parseFloat(e.target.value) || 0)}
                      className="bg-surface-2 border border-border rounded px-2.5 py-1.5 w-full outline-none font-mono text-foreground focus:border-primary"
                      placeholder="120"
                    />
                  </div>
                </div>
              )}
            </div>
            <footer className="px-4 py-3 border-t border-border flex items-center justify-end gap-2 bg-header-bg">
              <button 
                type="button"
                onClick={() => setCustomParamModalRow(null)} 
                className="border border-border text-xs px-3 py-1.5 rounded hover:bg-surface-2 cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => {
                  let catName = customParamName.trim();
                  if (!catName || catName === "Other" || catName === "OTHER") {
                    catName = "Custom (Custom)";
                  } else if (!catName.endsWith(" (Custom)")) {
                    catName = `${catName} (Custom)`;
                  }

                  const editIds = getSpaceEditIds(customParamModalRow.id);
                  const editSet = new Set(editIds);
                  const nextDensity = customParamDensity > 0 ? customParamDensity : 120;

                  saveRows(
                    rows.map((r) => {
                      if (!editSet.has(r.id)) return r;
                      const numArea = r.area !== "" ? Number(r.area) : 0;
                      const dissipation = numArea * nextDensity;
                      const kw = dissipation / 1000;
                      const tr = kw / 3.517;

                      const wasMissing = checkIfPclMissingData(r).isMissing;
                      const check = checkIfPclMissingData({ ...r, type: catName });
                      let flagged = r.flagged;
                      if (check.isMissing) {
                        flagged = true;
                      } else if (wasMissing && !check.isMissing) {
                        flagged = false;
                      }

                      return {
                        ...r,
                        type: catName,
                        density: nextDensity,
                        dissipation,
                        kw,
                        tr,
                        flagged,
                      };
                    })
                  );

                  setCustomParamModalRow(null);
                }} 
                className="bg-[#0A7BC7] hover:bg-[#0866A5] text-white text-xs px-4 py-1.5 rounded font-medium cursor-pointer shadow-sm"
              >
                Save Parameters
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Edit Space Modal */}
      {editingSpace && (
        <EditPclSpaceModal
          space={editingSpace}
          onClose={() => setEditingSpace(null)}
          onSave={(updatedSpace) => {
            saveRows(rows.map((r) => (r.id === updatedSpace.id ? updatedSpace : r)));
            setEditingSpace(null);
          }}
          availableFloors={allUniqueFloors}
          spaceDensities={SPACE_DENSITIES}
        />
      )}
    </AppShell>
  );
}

interface BulkBtnProps {
  icon: any;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}

function BulkBtn({ icon: Icon, onClick, children, disabled }: BulkBtnProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11.5px] font-semibold transition-colors text-[#06456F] hover:bg-primary/10 dark:text-[#0A7BC7] dark:hover:bg-primary/20 border border-transparent hover:border-primary/20 active:bg-primary/20 dark:active:bg-primary/30 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
    >
      <Icon className="size-3 shrink-0" />
      {children}
    </button>
  );
}

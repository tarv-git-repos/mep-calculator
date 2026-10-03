import { calculateGeneratorSizing, getGenRowValidation, STANDARD_SIZES, STARTER_MULTIPLIERS, type GenRow, type StarterType } from "@/lib/calc-generator";
import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfSignatureBlock, addPdfHeader, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { TBtn } from "@/components/workspace/Button";
import { ImportExcelBtn } from "@/components/workspace/ImportExcelBtn";
import { Download, FileSpreadsheet, FileText, Filter, HelpCircle, Plus, Printer, RefreshCw, Save, Settings, SlidersHorizontal, Trash2, FolderKanban, Search, ArrowRight, GripVertical, Upload, Copy, Info, Edit3, MessageSquare, Sparkles, Flag, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";
import { getMergedItemComments } from "@/utils/commentHelpers";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { api } from "@/services/api";
import { notifyCommentAssigned, executeHighlightAndScroll } from "@/utils/notificationHelpers";
import { EditGeneratorRowModal } from "@/components/workspace/EditGeneratorRowModal";
import { TaskComment } from "@/lib/ventilation-calc";
import { useConfirm, usePrompt } from "@/hooks/use-confirm";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import saveAsPkg from "file-saver";
const saveAs: any = (saveAsPkg as any).saveAs || saveAsPkg;
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useEditableGrid, useGridNavigation } from "@/core/gridEngine";
import { toast } from "sonner";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";

export const Route = createFileRoute("/generator-sizing")({
  head: () => ({
    meta: [
      { title: "Generator Sizing â€” MEP Calc" },
      {
        name: "description",
        content: "Calculate DG set size based on connected and emergency loads.",
      },
    ],
  }),
  component: GeneratorSizingPage,
});

function GeneratorSizingPage() {
  const { project, activeProjectId, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/generator-sizing", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/generator-sizing", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";

  const confirm = useConfirm();
  const prompt = usePrompt();
  const isApprovedLocked = useCalculationLock("/generator-sizing", project?.id);
  const isLocked = isApprovedLocked;

  const [projects, setProjects] = useState<Record<string, GenRow[]>>({ "Default Project": [] });
  const [currentProject, setCurrentProject] = useState<string>("Default Project");
  const [isLoaded, setIsLoaded] = useState(false);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStarter, setFilterStarter] = useState<string>("all");
  const [filterEmergency, setFilterEmergency] = useState<string>("all");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [sortBy, setSortBy] = useState<"none" | "desc" | "kw">("none");
  const [draggedRowIndex, setDraggedRowIndex] = useState<number | null>(null);
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: string } | null>(null);
  const [editingRow, setEditingRow] = useState<{ row: GenRow; index: number } | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterStarter !== "all") count++;
    if (filterEmergency !== "all") count++;
    return count;
  }, [filterStarter, filterEmergency]);

  const handleResetFilters = () => {
    setFilterStarter("all");
    setFilterEmergency("all");
  };

  const {
    rows,
    selectedIds: selectedRows,
    toggleSelection,
    clearSelection,
    selectAll,
    updateRow: baseUpdateRow,
    addRow: baseAddRow,
    removeRow: baseRemoveRow,
    bulkDelete,
    bulkDuplicate,
    pushState,
    undo: handleUndo,
    redo: handleRedo,
    canUndo,
    canRedo,
  } = useEditableGrid<GenRow>({
    initialRows: projects[currentProject] || [],
    readOnly: isApprovedLocked,
    onDelete: () => {
      if (isApprovedLocked) {
        toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to delete loads.", { id: "readonly-notice" });
        return;
      }
      bulkDelete();
    },
    onDuplicate: () => {
      if (isApprovedLocked) {
        toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to duplicate loads.", { id: "readonly-notice" });
        return;
      }
      bulkDuplicate();
    },
    onStateChange: (newRows) => {
      setProjects((prev) => {
        if (prev[currentProject] === newRows) return prev;
        return { ...prev, [currentProject]: newRows };
      });
    },
    onNewRow: () => addRow(),
    onSave: () => saveProject(),
    onPrint: () => exportPdf(),
    onExportPdf: () => exportPdf(),
  });

  const flagStats = useMemo(() => {
    let totalCount = 0;
    let flaggedCount = 0;
    (rows || []).forEach((r) => {
      totalCount++;
      const { isFlagged } = getGenRowValidation(r);
      if (isFlagged) flaggedCount++;
    });
    return { totalCount, flaggedCount };
  }, [rows]);

  const toggleFlagRows = (targetRowId: string, currentFlagged: boolean) => {
    const targetIds = selectedRows.has(targetRowId) && selectedRows.size > 1
      ? Array.from(selectedRows)
      : [targetRowId];
    
    const nextState = !currentFlagged;
    const newRows = (rows || []).map((r) =>
      targetIds.includes(r.id) ? { ...r, flagged: nextState } : r
    );
    pushState(newRows);

    toast.info(nextState ? `Flagged ${targetIds.length} load(s) for review` : `Unflagged ${targetIds.length} load(s)`);
  };

  useGridNavigation({ gridId: "generator-grid" });

  const saveProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projects));
    const dlAnchorElem = document.createElement("a");
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "mep_gen_projects.json");
    dlAnchorElem.click();
    toast.success("Project saved successfully");
  };

  const toggleRowSelect = (rowId: string, isShift: boolean, isCtrl: boolean) => {
    toggleSelection(rowId, isCtrl, isShift);
  };

  const [pf, setPf] = useState<number>(0.8);
  const [lf, setLf] = useState<number>(0.9);
  const [userSelectedSize, setUserSelectedSize] = useState<number | null>(null);
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"equipment" | "report">("equipment");
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(true);

  const DEFAULT_GEN_COL_WIDTHS: Record<string, number> = {
    select: 36,
    desc: 140,
    unit: 50,
    kwPerUnit: 70,
    starter: 85,
    multiplier: 52,
    startCur: 70,
    totalKw: 70,
    standby: 70,
    acl: 70,
    emergency: 80,
    powerFail: 95,
    remark: 95,
    actions: 40,
  };

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_gen_col_widths");
        if (saved) return { ...DEFAULT_GEN_COL_WIDTHS, ...JSON.parse(saved) };
      } catch (e) {}
    }
    return DEFAULT_GEN_COL_WIDTHS;
  });

  const handleResizeStart = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || DEFAULT_GEN_COL_WIDTHS[colKey] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(45, startWidth + deltaX);
      setColWidths((prev) => {
        const updated = { ...prev, [colKey]: newWidth };
        try {
          localStorage.setItem("mep_gen_col_widths", JSON.stringify(updated));
        } catch (err) {}
        return updated;
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const activeProject = workspaceStore.getState().project;

  // Version History Restore Listener
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_gen_projects_${project?.id || "default"}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) {}
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) {}
        }
      }
      if (restoredData) {
        if (restoredData.projects) {
          setProjects(restoredData.projects);
          const curProj = restoredData.currentProject || "Default Project";
          setCurrentProject(curProj);
          if (restoredData.pf !== undefined) setPf(restoredData.pf);
          if (restoredData.lf !== undefined) setLf(restoredData.lf);
          if (restoredData.userSelectedSize !== undefined) setUserSelectedSize(restoredData.userSelectedSize);
          if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
          if (restoredData.manualOverrides) setManualOverrides(restoredData.manualOverrides);
          if (restoredData.projects[curProj]) {
            pushState(restoredData.projects[curProj]);
          }
        } else {
          setProjects(restoredData);
          if (restoredData["Default Project"]) {
            pushState(restoredData["Default Project"]);
          }
        }
        toast.success("Generator sizing restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  // Handle notification scroll & highlight
  useEffect(() => {
    const handleScrollToItem = (e: any) => {
      if (e.detail) {
        executeHighlightAndScroll(e.detail);
      }
    };
    window.addEventListener("mep-scroll-to-item" as any, handleScrollToItem);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const targetId = params.get("commentTargetId") || params.get("targetId");
      const targetName = params.get("commentTargetName") || params.get("targetName");
      const targetType = params.get("commentTargetType") || params.get("targetType");
      if (targetId || targetName) {
        setTimeout(() => {
          executeHighlightAndScroll({ id: targetId || undefined, name: targetName || undefined, type: targetType || "Generator Load" });
        }, 500);
      }
    }

    return () => window.removeEventListener("mep-scroll-to-item" as any, handleScrollToItem);
  }, [rows]);

  const setOverride = (key: string, val: string) => {
    setManualOverrides((prev) => ({ ...prev, [key]: val }));
  };

  const clearOverrides = () => {
    setManualOverrides({});
  };

  const handleUnitToggle = (newSystem: "si" | "ip", shouldConvert: boolean = true) => {
    if (newSystem === unitSystem) return;
    setUnitSystem(newSystem);
    clearOverrides();
    if (shouldConvert) {
    const newRows = rows.map((r) => {
      const kw = Number(r.kwPerUnit) || 0;
      const sb = Number(r.standby) || 0;
      const em = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
      const pf = Number(r.powerFail) || 0;
      return {
        ...r,
        kwPerUnit:
          newSystem === "ip" ? Number((kw / 0.746).toFixed(2)) : Number((kw * 0.746).toFixed(2)),
        standby:
          newSystem === "ip" ? Number((sb / 0.746).toFixed(2)) : Number((sb * 0.746).toFixed(2)),
        emergency:
          newSystem === "ip" ? Number((em / 0.746).toFixed(2)) : Number((em * 0.746).toFixed(2)),
        powerFail:
          newSystem === "ip" ? Number((pf / 0.746).toFixed(2)) : Number((pf * 0.746).toFixed(2)),
      };
    });
    pushState(newRows);
    }
  };

  const addRow = () => {
    if (isApprovedLocked || isLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add loads.", { id: "readonly-notice" });
      return;
    }
    const newRow: GenRow = {
      id: `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      desc: "",
      unit: "",
      kwPerUnit: "",
      starter: "DOL",
      multiplier: STARTER_MULTIPLIERS["DOL"],
      standby: "",
      emergency: "",
      powerFail: "",
      remark: "",
    };
    baseAddRow(newRow);
  };

  const removeRow = async (id: string) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "calc-locked" });
      return;
    }
    baseRemoveRow(id);
  };

  const updateRow = (id: string, field: keyof GenRow, val: any) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "calc-locked" });
      return;
    }
    const targetIds = selectedRows.has(id) ? Array.from(selectedRows) : [id];

    const newRows = rows.map((row) => {
      if (!targetIds.includes(row.id)) return row;

      const newRow = { ...row, [field]: val };

      if (field === "starter") {
        newRow.multiplier = STARTER_MULTIPLIERS[val as StarterType] || 1;
      }

      if (field === "kwPerUnit" || field === "unit" || field === "standby") {
        const u = Number(newRow.unit) || 0;
        const kw = Number(newRow.kwPerUnit) || 0;
        const sb = Number(newRow.standby) || 0;
        const tc = u * kw;
        const ac = tc - sb;
        newRow.emergency = ac > 0 ? ac : "";
      }

      return newRow;
    });
    pushState(newRows);
  };

  const setPowerFailPercent = (id: string, percentStr: string) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "calc-locked" });
      return;
    }
    const percent = parseFloat(percentStr);
    if (!percent || isNaN(percent)) return;

    const newRows = rows.map((row) => {
      if (row.id !== id) return row;
      const u = Number(row.unit) || 0;
      const kw = Number(row.kwPerUnit) || 0;
      const sb = Number(row.standby) || 0;
      const actualKw = u * kw - sb;
      const emKw = row.excludeEmergency ? 0 : Number(row.emergency);
      const baseLoad = (!isNaN(emKw) && emKw > 0) ? emKw : (actualKw > 0 ? actualKw : 0);
      return { ...row, powerFail: parseFloat((baseLoad * (percent / 100)).toFixed(2)) };
    });
    pushState(newRows);
  };

  const clearRows = async () => {
    if (rows.length === 0) return;
    if (await confirm("Are you sure you want to clear all loads?")) {
      pushState([]);
    }
  };

  const handleImportExcelRows = (mappedRows: any[]) => {
    const newGenRows: GenRow[] = mappedRows.map(mr => ({
      id: `gen_${Date.now()}_${Math.floor(Math.random() * 100000)}`,
      desc: mr.desc || "",
      unit: mr.unit || "",
      kwPerUnit: mr.kwPerUnit || "",
      starter: (mr.starter as StarterType) || "DOL",
      multiplier: mr.multiplier || "",
      standby: mr.standby || "",
      emergency: mr.emergency || "",
      powerFail: mr.powerFail || "",
      remark: mr.remark || "",
    }));
    pushState([...rows, ...newGenRows]);
  };

  const deleteSelectedRows = () => {
    bulkDelete();
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedRowIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedRowIndex === null || draggedRowIndex === index) return;

    const newRows = [...rows];
    const draggedRow = newRows[draggedRowIndex];
    newRows.splice(draggedRowIndex, 1);
    newRows.splice(index, 0, draggedRow);

    setDraggedRowIndex(index);
    pushState(newRows);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedRows.size > 0) {
          e.preventDefault();
          clearSelection();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedRows, clearSelection]);

  const handleDrop = () => setDraggedRowIndex(null);

  // Calculations
  const calc = useMemo(() => {
    let totalAcl = 0;
    let totalEmergency = 0;
    let maxStartCur = 0;
    let largestMotorKw = 0;
    let largestMotorStarter = "-";

    rows.forEach((r) => {
      const rKw = Number(r.kwPerUnit) || 0;
      const rSb = Number(r.standby) || 0;
      const rEm = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
      const rUnit = Number(r.unit) || 0;
      const rMult = Number(r.multiplier) || 0;

      const kwPerUnit = unitSystem === "ip" ? rKw * 0.746 : rKw;
      const standby = unitSystem === "ip" ? rSb * 0.746 : rSb;
      const emergency = unitSystem === "ip" ? rEm * 0.746 : rEm;

      const totalKw = rUnit * kwPerUnit;
      const actualKw = totalKw - standby;
      totalAcl += actualKw;
      totalEmergency += emergency;

      const startCur = kwPerUnit * 1.739 * rMult;

      if (startCur > maxStartCur) {
        maxStartCur = startCur;
      }

      if (kwPerUnit > largestMotorKw) {
        largestMotorKw = kwPerUnit;
        largestMotorStarter = r.starter;
      }
    });

    const getEffective = (key: string, computed: number) => {
      if (manualOverrides[key] !== undefined && manualOverrides[key] !== "") {
        return parseFloat(manualOverrides[key]) || 0;
      }
      return computed;
    };

    const baseAcl = getEffective("acl", unitSystem === "ip" ? totalAcl / 0.746 : totalAcl);
    const baseEm = getEffective(
      "em",
      unitSystem === "ip" ? totalEmergency / 0.746 : totalEmergency,
    );

    const aclKw = unitSystem === "ip" ? baseAcl * 0.746 : baseAcl;
    const emKw = unitSystem === "ip" ? baseEm * 0.746 : baseEm;

    const demandLoadAcl = getEffective("demandAcl", aclKw / pf);
    const demandLoadEm = getEffective("demandEm", emKw / pf);

    const calcSizeAcl = getEffective("calcAcl", demandLoadAcl / lf);
    const calcSizeEm = getEffective("calcEm", demandLoadEm / lf);

    const effectiveMaxStart = getEffective("maxStart", maxStartCur);

    const maxCalcSize = Math.max(calcSizeAcl, calcSizeEm);
    let autoSize: number;
    const matchingStandard = STANDARD_SIZES.find((size) => size >= maxCalcSize);
    if (matchingStandard) {
      autoSize = matchingStandard;
    } else if (maxCalcSize > 0) {
      autoSize = Math.ceil(maxCalcSize / 50) * 50;
    } else {
      autoSize = STANDARD_SIZES[0] || 5;
    }

    const selectedSize = userSelectedSize !== null ? userSelectedSize : autoSize;

    return {
      totalAcl: baseAcl,
      totalEmergency: baseEm,
      demandLoadAcl,
      demandLoadEm,
      calcSizeAcl,
      calcSizeEm,
      autoSize,
      selectedSize,
      maxStartCur: effectiveMaxStart,
      largestMotorKw,
      largestMotorStarter,
    };
  }, [rows, pf, lf, unitSystem, userSelectedSize, manualOverrides]);

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Generator Sizing", {
      views: [{ showGridLines: false }],
    });

    // Styles
    const fontNormal = { name: "Cambria", size: 10, bold: false };
    const fontBold = { name: "Cambria", size: 10, bold: true };
    const fontTitle = { name: "Cambria", size: 11, bold: true };
    const alignCenter = { horizontal: "center", vertical: "middle", wrapText: true } as any;
    const alignLeft = { horizontal: "left", vertical: "middle", wrapText: true } as any;
    const alignRight = { horizontal: "right", vertical: "middle", wrapText: true } as any;

    const bgGray = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9D9D9" } } as any;
    const bgYellow = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFF00" } } as any;
    const bgGreen = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6E0B4" } } as any;

    const borderThin = {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    } as any;

    // Define columns and widths
    worksheet.columns = [
      { width: 8 }, // A: S.NO
      { width: 40 }, // B: DESCRIPTION
      { width: 8 }, // C: QTY
      { width: 12 }, // D: kW / UNIT
      { width: 15 }, // E: STARTER TYPE
      { width: 15 }, // F: STARTING CURRENT
      { width: 12 }, // G: TOTAL
      { width: 12 }, // H: STANDBY
      { width: 15 }, // I: ACL
      { width: 15 }, // J: EMERGENCY
      { width: 15 }, // K: POWER FAIL
      { width: 30 }, // L: REMARKS
    ];

    const setBorder = (cell: any) => {
      cell.border = borderThin;
    };

    // --- Top Headers ---
    worksheet.mergeCells("A1:F1");
    const r1c1 = worksheet.getCell("A1");
    r1c1.value = "Calculation No:";
    r1c1.font = fontBold;
    r1c1.alignment = alignLeft;
    setBorder(r1c1);

    worksheet.mergeCells("G1:L1");
    const r1c2 = worksheet.getCell("G1");
    r1c2.value = "Date     :";
    r1c2.font = fontBold;
    r1c2.alignment = alignLeft;
    setBorder(r1c2);

    worksheet.mergeCells("A2:F2");
    const r2c1 = worksheet.getCell("A2");
    r2c1.value = "Project No   :";
    r2c1.font = fontBold;
    r2c1.alignment = alignLeft;
    setBorder(r2c1);

    worksheet.mergeCells("G2:L2");
    const r2c2 = worksheet.getCell("G2");
    r2c2.value = "Client   :";
    r2c2.font = fontBold;
    r2c2.alignment = alignLeft;
    setBorder(r2c2);

    worksheet.mergeCells("A3:F3");
    const r3c1 = worksheet.getCell("A3");
    r3c1.value = "Project Name :";
    r3c1.font = fontBold;
    r3c1.alignment = alignLeft;
    setBorder(r3c1);

    worksheet.mergeCells("G3:L3");
    const r3c2 = worksheet.getCell("G3");
    r3c2.value = "End User :";
    r3c2.font = fontBold;
    r3c2.alignment = alignLeft;
    setBorder(r3c2);

    // Apply borders to the merged cells properly
    for (let i = 1; i <= 3; i++) {
      for (let j = 1; j <= 12; j++) {
        setBorder(worksheet.getCell(i, j));
      }
    }

    // --- Table Headers ---
    const h1 = worksheet.addRow([
      "Sr. No.",
      "Description",
      "Unit",
      "kW / UNIT",
      "Starter Types",
      "Starting Current",
      "Total Connected Load",
      "Total Standby Load",
      "Actual Connected Load",
      "Emergency Load",
      "Power Failure Load",
      "Remarks",
    ]);
    const h2 = worksheet.addRow(["", "", "", "", "", "Amps", "kW", "kW", "kW", "kW", "kW", ""]);

    ["A", "B", "C", "D", "E", "L"].forEach((col) => {
      worksheet.mergeCells(`${col}4:${col}5`);
    });

    [h1, h2].forEach((r) => {
      r.eachCell((cell, colNumber) => {
        cell.font = fontBold;
        cell.alignment = alignCenter;
        setBorder(cell);
        if (colNumber === 10 || colNumber === 11) {
          cell.fill = bgYellow;
        } else {
          cell.fill = bgGray;
        }
      });
    });

    // Row 6: GENERATOR LOAD - CALCULATION
    worksheet.mergeCells("A6:L6");
    const titleRow = worksheet.getCell("A6");
    titleRow.value = "GENERATOR LOAD - CALCULATION";
    titleRow.font = fontTitle;
    titleRow.alignment = alignCenter;
    setBorder(titleRow);
    for (let j = 1; j <= 12; j++) setBorder(worksheet.getCell(6, j));

    let rowIndex = 7; // Data starts at row 7

    rows.forEach((r, idx) => {
      const rUnit = Number(r.unit) || 0;
      const rKw = Number(r.kwPerUnit) || 0;
      const rSb = Number(r.standby) || 0;
      const rMult = Number(r.multiplier) || 1;
      const startCur = rKw * 1.739 * rMult;
      const totalKw = rUnit * rKw;
      const actualKw = totalKw - rSb;
      const emergency = r.excludeEmergency ? 0 : Number(r.emergency) || 0;

      const row = worksheet.addRow([
        idx + 1, // A: Sr. No.
        r.desc, // B: Description
        rUnit, // C: Unit
        rKw, // D: kW / UNIT
        r.starter, // E: Starter Types
        { formula: `D${rowIndex}*1.739*${rMult}`, result: startCur }, // F: Starting Current
        { formula: `C${rowIndex}*D${rowIndex}`, result: totalKw }, // G: Total Connected Load
        rSb, // H: Total Standby Load
        { formula: `G${rowIndex}-H${rowIndex}`, result: actualKw }, // I: Actual Connected Load
        emergency, // J: Emergency Load
        Number(r.powerFail) || 0, // K: Power Failure Load
        r.remark || "", // L: Remarks
      ]);

      row.eachCell((cell, colNumber) => {
        cell.font = fontNormal;
        setBorder(cell);
        cell.alignment = colNumber === 2 ? alignLeft : alignCenter;
        if (colNumber === 10 || colNumber === 11) {
          cell.fill = bgYellow;
        }
      });
      rowIndex++;
    });

    // --- Footer Summary ---
    // Add a blank row space between data and footer
    rowIndex++;

    const addFooterRow = (
      title: string,
      aclVal: any,
      emVal: any,
      extra1: string = "",
      extra2: string = "",
    ) => {
      worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
      const titleCell = worksheet.getCell(`A${rowIndex}`);
      titleCell.value = title;
      titleCell.alignment = alignRight;
      titleCell.font = fontNormal;
      for (let col = 1; col <= 8; col++) setBorder(worksheet.getCell(rowIndex, col));

      const aclCell = worksheet.getCell(`I${rowIndex}`);
      aclCell.value = aclVal !== null ? aclVal : "";
      aclCell.alignment = alignCenter;
      aclCell.font = fontNormal;
      setBorder(aclCell);
      if (aclVal !== null) aclCell.fill = bgYellow;

      const emCell = worksheet.getCell(`J${rowIndex}`);
      emCell.value = emVal !== null ? emVal : "";
      emCell.alignment = alignCenter;
      emCell.font = fontNormal;
      setBorder(emCell);
      if (emVal !== null) emCell.fill = bgYellow;

      const x1Cell = worksheet.getCell(`K${rowIndex}`);
      x1Cell.value = extra1;
      x1Cell.font = fontBold;
      setBorder(x1Cell);

      const x2Cell = worksheet.getCell(`L${rowIndex}`);
      x2Cell.value = extra2;
      x2Cell.font = fontNormal;
      setBorder(x2Cell);

      rowIndex++;
    };

    addFooterRow(
      "Total Actual Connected Load in kW (ACL)",
      Number(calc.totalAcl.toFixed(2)),
      Number(calc.totalEmergency.toFixed(2)),
      "Type of Starter",
      "Starting current",
    );
    worksheet.getCell(`L${rowIndex - 1}`).font = fontBold; // Bold "Starting current"

    addFooterRow(
      "Consider power factor (PF Lagging)",
      pf,
      pf,
      "Direct On Line (DOL)",
      "Full load current x 7",
    );
    addFooterRow(
      "Demand load in KVA ( DL = ACL / PF ) kVA",
      Number(calc.demandLoadAcl.toFixed(2)),
      Number(calc.demandLoadEm.toFixed(2)),
      "Star Delta Starter (SD)",
      "Full load current x 3",
    );
    addFooterRow(
      "Consider 90% loading for standby OR 80% loading for Prime Generators (If Standby DG )",
      lf,
      lf,
      "Variable Frequency Drive (VFD)",
      "Full load current",
    );
    addFooterRow(
      "Calculated size for DG set ( DL / LF ) kVA",
      Number(calc.calcSizeAcl.toFixed(2)),
      Number(calc.calcSizeEm.toFixed(2)),
    );
    addFooterRow(
      "Maximum Starting Current for Motor (Amp)",
      Number(calc.maxStartCur.toFixed(2)),
      "",
    );
    worksheet.getCell(`J${rowIndex - 1}`).fill = bgYellow; // Make empty emergency cell yellow
    addFooterRow(
      "Calculated DG Set Size in kVA",
      Math.max(calc.calcSizeAcl, calc.calcSizeEm).toFixed(2),
      "",
    );
    worksheet.getCell(`J${rowIndex - 1}`).fill = bgYellow; // Make empty emergency cell yellow

    // Selected size row
    worksheet.mergeCells(`A${rowIndex}:H${rowIndex}`);
    const selTitle = worksheet.getCell(`A${rowIndex}`);
    selTitle.value = "Selected size of DG Set Size in kVA";
    selTitle.font = fontBold;
    selTitle.alignment = alignRight;
    for (let col = 1; col <= 8; col++) {
      const c = worksheet.getCell(rowIndex, col);
      setBorder(c);
      c.fill = bgGray;
    }

    worksheet.mergeCells(`I${rowIndex}:J${rowIndex}`);
    const selVal = worksheet.getCell(`I${rowIndex}`);
    selVal.value = calc.selectedSize;
    selVal.font = fontBold;
    selVal.alignment = alignCenter;
    setBorder(worksheet.getCell(`I${rowIndex}`));
    setBorder(worksheet.getCell(`J${rowIndex}`));
    selVal.fill = bgYellow;
    worksheet.getCell(`J${rowIndex}`).fill = bgYellow;

    worksheet.mergeCells(`K${rowIndex}:L${rowIndex}`);
    for (let col = 11; col <= 12; col++) {
      const c = worksheet.getCell(rowIndex, col);
      setBorder(c);
      c.fill = bgGray;
    }
    rowIndex++;

    
    const sigRow = worksheet.rowCount ? worksheet.rowCount + 2 : 20;
    addExcelSignatureBlock(worksheet, sigRow, currentUserName, project?.id || "default", "generator-sizing");
    const buffer = await workbook.xlsx.writeBuffer();
    await downloadFile(new Uint8Array(buffer), "Generator_Sizing_Calculation.xlsx", "Excel Document", ["xlsx"]);
  };

  const exportPdf = () => {
    try {
      const doc = new jsPDF("l", "mm", "a4");
      const primaryFill: [number, number, number] = [217, 217, 217];

      const runAutoTable = (options: any) => {
        if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else if (typeof (autoTable as any)?.default === 'function') {
          (autoTable as any).default(doc, options);
        } else if ((doc as any).autoTable) {
          (doc as any).autoTable(options);
        }
      };

      const headerStartY = addPdfHeader(doc, "Generator Sizing Calculation Report");

      const sizeHeader = unitSystem === "ip" ? "HP /\nUnit" : "kW /\nUnit";
      const totalHeader = unitSystem === "ip" ? "Total Conn\n(HP)" : "Total Conn\n(kW)";
      const aclHeader = unitSystem === "ip" ? "Actual Conn\n(HP)" : "Actual Conn\n(kW)";
      const emHeader = unitSystem === "ip" ? "Emerg\n(HP)" : "Emerg\n(kW)";
      const pfHeader = unitSystem === "ip" ? "Power Fail\n(HP)" : "Power Fail\n(kW)";

      const getSanitizedVal = (val: any): string => {
        if (val === undefined || val === null || val === "undefined" || val === "null") return "";
        return String(val);
      };

      const tableData = rows.map((r, idx) => {
        const unit = Number(r.unit) || 0;
        const kwPerUnit = Number(r.kwPerUnit) || 0;
        const totalConn = unit * kwPerUnit;
        const standby = Number(r.standby) || 0;
        const acl = totalConn - standby;
        const em = r.excludeEmergency ? 0 : Number(r.emergency) || 0;
        const pwrFailNum = Number(r.powerFail);
        const pwrFail = !isNaN(pwrFailNum) && r.powerFail !== "" && r.powerFail !== null && r.powerFail !== undefined
          ? pwrFailNum.toFixed(2)
          : (r.powerFail ? String(r.powerFail) : "0.00");
        const mult = Number(r.multiplier) || 1;
        const startCur = kwPerUnit * 1.739 * mult;

        const remarkVal = r.remark || (r as any).remarks || "";

        return [
          idx + 1,
          getSanitizedVal(r.desc),
          unit.toString(),
          kwPerUnit.toFixed(2),
          getSanitizedVal(r.starter || "DOL"),
          startCur.toFixed(2),
          totalConn.toFixed(2),
          standby.toFixed(2),
          acl.toFixed(2),
          em.toFixed(2),
          pwrFail,
          getSanitizedVal(remarkVal)
        ];
      });

      // Dynamic Column Widths (Printable width: 269mm)
      // Col 0: Sr. No (12mm), Col 1: Description (45mm), Col 11: Remarks (28mm)
      // Remaining 9 numerical cols (269 - 12 - 45 - 28) / 9 = 20.44mm each
      const columnStyles: Record<number, any> = {
        0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 45, halign: "left", fontStyle: "bold", cellPadding: { left: 3.5, right: 1.5, top: 3.0, bottom: 3.0 } },
        2: { cellWidth: 20.44, halign: "center" },
        3: { cellWidth: 20.44, halign: "center" },
        4: { cellWidth: 20.44, halign: "center" },
        5: { cellWidth: 20.44, halign: "center" },
        6: { cellWidth: 20.44, halign: "center" },
        7: { cellWidth: 20.44, halign: "center" },
        8: { cellWidth: 20.44, halign: "center" },
        9: { cellWidth: 20.44, halign: "center" },
        10: { cellWidth: 20.44, halign: "center" },
        11: { cellWidth: 28, halign: "center" }
      };

      runAutoTable({
        head: [["Sr. No.", "Description", "Unit", sizeHeader, "Starter\nTypes", "Start Cur\n(A)", totalHeader, "Standby", aclHeader, emHeader, pfHeader, "Remarks"]],
        body: tableData,
        startY: headerStartY + 4,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
          minCellHeight: 8.5
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 1.0, right: 1.0 },
          minCellHeight: 8.5
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
          minCellHeight: 8.5
        },
        columnStyles: columnStyles,
        margin: { left: 14, right: 14 }
      });

      const finalY1 = (doc as any).lastAutoTable?.finalY || (headerStartY + 30);

      // Summary Table matching Excel Export (Spanning full 269mm width)
      const pfVal = Number(pf) || 0.8;
      const lfVal = Number(lf) || 0.9;
      const dgTypeStr = "Standby DG";

      const summaryHead = [["Summary Calculation Parameter", "Connected Load (kW)", "Emergency Load (kW)"]];
      const summaryBody = [
        ["Total Actual Connected Load in kW (ACL)", calc.totalAcl.toFixed(2), calc.totalEmergency.toFixed(2)],
        ["Consider power factor (PF Lagging)", pfVal.toFixed(2), pfVal.toFixed(2)],
        ["Demand load in kVA (DL = ACL / PF)", calc.demandLoadAcl.toFixed(2), calc.demandLoadEm.toFixed(2)],
        [`Consider loading factor (${dgTypeStr})`, `${(lfVal * 100).toFixed(0)}%`, `${(lfVal * 100).toFixed(0)}%`],
        ["Calculated size for DG set (DL / LF) kVA", calc.calcSizeAcl.toFixed(2), calc.calcSizeEm.toFixed(2)],
        ["Maximum Starting Current for Motor (Amp)", calc.maxStartCur.toFixed(2), "-"],
        ["Calculated DG Set Size in kVA", Math.max(calc.calcSizeAcl, calc.calcSizeEm).toFixed(2), "-"],
      ];

      runAutoTable({
        head: summaryHead,
        body: summaryBody,
        startY: finalY1 + 6,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.0,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 2.0, right: 2.0 },
          minCellHeight: 8.5
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 8.0,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 2.0, right: 2.0 },
          minCellHeight: 8.5
        },
        columnStyles: {
          0: { cellWidth: 149, fontStyle: "bold", halign: "left", cellPadding: { left: 3.5, right: 2.0, top: 3.0, bottom: 3.0 } },
          1: { cellWidth: 60, halign: "center" },
          2: { cellWidth: 60, halign: "center" },
        },
        margin: { left: 14, right: 14 }
      });

      const finalY2 = (doc as any).lastAutoTable?.finalY || (finalY1 + 45);

      // Yellow Callout Box for Selected Size (Spanning full 269mm width)
      doc.setFillColor(254, 240, 138); // Yellow-200
      doc.setDrawColor(234, 179, 8); // Yellow-600
      doc.roundedRect(14, finalY2 + 5, 269, 12, 2, 2, "FD");
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(161, 98, 7);
      doc.text(`SELECTED SIZE OF DG SET: ${calc.selectedSize} kVA`, 18, finalY2 + 12.5);

      // Add Signature Block matching Full Page Width (269mm)
      const sigFinalY = finalY2 + 23;
      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(project?.id || "default", "generator-sizing", currentUserName);

      runAutoTable({
        startY: sigFinalY,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        headStyles: {
          fillColor: [255, 230, 204],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        head: [
          [
            { content: "" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 77, halign: "center" },
          2: { cellWidth: 77, halign: "center" },
          3: { cellWidth: 77, halign: "center" }
        }
      });

      const pdfBuffer = doc.output("arraybuffer");
      downloadFile(new Uint8Array(pdfBuffer), "Generator_Sizing_Calculation.pdf", "PDF Document", ["pdf"]);
      toast.success("Generator sizing PDF exported successfully!");
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      toast.error("Failed to export Generator sizing PDF.");
    }
  };

  const duplicateRow = (id: string) => {
    const rowToDup = rows.find((r) => r.id === id);
    if (!rowToDup) return;
    const newRow = { ...rowToDup, id: `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}` };
    const rowIndex = rows.findIndex((r) => r.id === id);
    const newRows = [...rows];
    newRows.splice(rowIndex + 1, 0, newRow);
    pushState(newRows);
  };

  const createNewProject = async () => {
    const name = await prompt("Enter new project name:", "", { title: "New Project" });
    if (name && !projects[name]) {
      setProjects((p) => ({ ...p, [name]: [] }));
      setCurrentProject(name);
      pushState([]);
    }
  };

  const displayRows = useMemo(() => {
    let result = rows || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r => (r.desc || "").toLowerCase().includes(q) || (r.remark || "").toLowerCase().includes(q));
    }

    if (showFlaggedOnly) {
      result = result.filter(r => getGenRowValidation(r).isFlagged);
    }

    if (filterStarter !== "all") {
      result = result.filter(r => r.starter === filterStarter);
    }

    if (filterEmergency === "emergency") {
      result = result.filter(r => !r.excludeEmergency);
    } else if (filterEmergency === "excluded") {
      result = result.filter(r => r.excludeEmergency);
    }

    if (sortBy === "desc") {
      result = [...result].sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
    } else if (sortBy === "kw") {
      result = [...result].sort((a, b) => (Number(b.kwPerUnit) || 0) - (Number(a.kwPerUnit) || 0));
    }

    return result;
  }, [rows, searchQuery, showFlaggedOnly, filterStarter, filterEmergency, sortBy]);

  return (
    <AppShell
      title="Generator Sizing"
      spaceCount={rows.length}
      spaceCountUnit={rows.length === 1 ? "load" : "loads"}

      actions={<UnitToggle unitSystem={unitSystem} onChange={handleUnitToggle} disabled={isEffectiveReadOnly} />}
    >
      
      <div className={`flex-1 flex flex-col overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"} h-full relative overflow-hidden bg-slate-50/30 dark:bg-slate-950/30`}>
        <div className="relative z-10 flex flex-col h-full w-full">
          {/* Sections Navigation (Tabs) */}
          <div className="px-4 py-2 border-b border-border/60 bg-surface-1/50 shrink-0 select-none flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="inline-flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-full gap-1 border border-border/60 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("equipment")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    activeTab === "equipment"
                      ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Generator
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    activeTab === "report"
                      ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing &amp; Report
                </button>
              </div>
            </div>
          </div>

          {activeTab === "report" && (
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Summary View Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-2/40 border border-border p-4 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total ACL</h3>
                  <p className="text-2xl font-black text-foreground mt-1">{calc.totalAcl.toFixed(2)} kW</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Sum of all connected loads</p>
                </div>
                <div className="bg-surface-2/40 border border-border p-4 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Emergency Load</h3>
                  <p className="text-2xl font-black text-primary mt-1">{calc.totalEmergency.toFixed(2)} kW</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Sum of non-excluded emergency loads</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Recommended DG Set</h3>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{calc.selectedSize} kVA</p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">Based on highest load requirement</p>
                </div>
              </div>

              {/* Reports Export Cards */}
              <div className="border border-border rounded-xl p-5 bg-surface-1">
                <h2 className="text-sm font-bold text-foreground mb-4">Export Calculation Reports</h2>
                <div className="grid grid-cols-1 gap-4 max-w-md">
                  <div className="border border-border rounded-lg p-4 bg-background flex flex-col items-start gap-3">
                    <div className="size-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[14px]">PDF Document</h3>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        Generate a formatted PDF calculation report.
                      </p>
                    </div>
                    <TBtn primary onClick={exportPdf} className="mt-2 w-full justify-center">
                      Export PDF
                    </TBtn>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "equipment" && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Filter & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between px-3 sm:px-4 py-2 min-h-[44px] h-auto border-b border-border bg-background shrink-0 select-none gap-2 overflow-visible">
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter loads..."
                      className="h-7 w-full sm:w-56 pl-8 pr-3 bg-surface-2 text-foreground border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
                    />
                  </div>

                  {/* Filters Icon Popover */}
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
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                          Filter
                        </span>
                        {activeFiltersCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                            {activeFiltersCount}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <span className="text-xs font-bold text-foreground">Filter Loads</span>
                        {activeFiltersCount > 0 && (
                          <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold">
                            Reset All
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Starter Type</span>
                        <select
                          value={filterStarter}
                          onChange={(e) => setFilterStarter(e.target.value)}
                          className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="all" className="bg-popover text-popover-foreground">All Starter Types</option>
                          <option value="DOL" className="bg-popover text-popover-foreground">DOL</option>
                          <option value="SD" className="bg-popover text-popover-foreground">Star Delta</option>
                          <option value="Soft Starter" className="bg-popover text-popover-foreground">Soft Starter</option>
                          <option value="VFD" className="bg-popover text-popover-foreground">VFD</option>
                          <option value="None" className="bg-popover text-popover-foreground">None</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Emergency Status</span>
                        <select
                          value={filterEmergency}
                          onChange={(e) => setFilterEmergency(e.target.value)}
                          className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="all" className="bg-popover text-popover-foreground">All Loads</option>
                          <option value="emergency" className="bg-popover text-popover-foreground">Emergency Included</option>
                          <option value="excluded" className="bg-popover text-popover-foreground">Emergency Excluded</option>
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* View Icon Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                          sortBy !== "none" || rowDensity === "compact"
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        <SlidersHorizontal className="size-3.5 shrink-0" />
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                          View / Sort
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                      <div className="pb-1.5 border-b border-border text-xs font-bold text-foreground">
                        View Options
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                        <div className="flex rounded-full border border-border p-0.5 bg-surface-2">
                          <button
                            onClick={() => setRowDensity("default")}
                            className={`flex-1 py-1 text-[11px] font-semibold rounded-full transition-all ${
                              rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            Default
                          </button>
                          <button
                            onClick={() => setRowDensity("compact")}
                            className={`flex-1 py-1 text-[11px] font-semibold rounded-full transition-all ${
                              rowDensity === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            Compact
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="none" className="bg-popover text-popover-foreground">Original Order</option>
                          <option value="desc" className="bg-popover text-popover-foreground">Description (A-Z)</option>
                          <option value="kw" className="bg-popover text-popover-foreground">Load kW (High to Low)</option>
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
                  <ImportExcelBtn
                    columnMapping={{
                      "Description": "desc",
                      "Unit": "unit",
                      "kW / UNIT": "kwPerUnit",
                      "Starter Types": "starter",
                      "Standby (A)": "standby",
                      "Emergency Load": "emergency",
                      "Power Failure Load": "powerFail",
                      "Remarks": "remark"
                    }}
                    onImport={handleImportExcelRows}
                  />

                  <button
                    type="button"
                    onClick={() => setIsPanelOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border transition-all cursor-pointer shadow-2xs ${
                      isPanelOpen
                        ? "border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                        : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                    }`}
                    title={isPanelOpen ? "Collapse Parameters & Results Panel" : "Expand Parameters & Results Panel"}
                  >
                    {isPanelOpen ? (
                      <>
                        <PanelRightClose className="size-3.5" />
                        <span className="hidden sm:inline">Hide Results</span>
                      </>
                    ) : (
                      <>
                        <PanelRightOpen className="size-3.5" />
                        <span>Show Results</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={exportPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="size-3.5" /> Export
                  </button>

                  <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="size-3.5" /> New Row
                  </button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
                {/* Left Side: Table */}
                <div className="flex flex-col flex-1 min-w-0 min-h-0 border-b xl:border-b-0 xl:border-r border-white/40 dark:border-white/10 overflow-y-auto bg-transparent">
                  <div className="p-4 flex-1 w-full overflow-x-auto min-w-0">
                    <div className="w-full min-w-max border border-border/60 rounded-xl overflow-hidden shadow-2xs bg-card">
                      <table id="generator-grid" className="w-full text-[12.5px] border-collapse">
                        <thead className="bg-muted/40 dark:bg-surface-2/60 sticky top-0 z-10 font-semibold text-muted-foreground select-none text-[10.5px] uppercase tracking-wider border-b border-border/60">
                          <tr className="text-left font-semibold">
                            <th style={{ width: `${colWidths.select}px`, minWidth: `${colWidths.select}px` }} className="px-2 py-1.5 text-center relative group/col select-none">
                              <input
                                type="checkbox"
                                className="cursor-pointer rounded border-border"
                                checked={rows.length > 0 && selectedRows.size === rows.length}
                                onChange={(e) => {
                                  if (e.target.checked) selectAll();
                                  else clearSelection();
                                }}
                              />
                              <div onMouseDown={(e) => handleResizeStart("select", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.desc}px`, minWidth: `${colWidths.desc}px` }} className="px-3 py-1.5 relative group/col select-none">
                              Description
                              <div onMouseDown={(e) => handleResizeStart("desc", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.unit}px`, minWidth: `${colWidths.unit}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              Unit
                              <div onMouseDown={(e) => handleResizeStart("unit", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.kwPerUnit}px`, minWidth: `${colWidths.kwPerUnit}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              {unitSystem === "ip" ? "HP / UNIT" : "kW / UNIT"}
                              <div onMouseDown={(e) => handleResizeStart("kwPerUnit", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.starter}px`, minWidth: `${colWidths.starter}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              Starter Type
                              <div onMouseDown={(e) => handleResizeStart("starter", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.multiplier}px`, minWidth: `${colWidths.multiplier}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Multiplication factor for starting current. Typically 7 for DOL, 3.5 for Star Delta/Soft Starter, 1 for VFD."
                              >
                                Mult. <Info className="size-3" />
                              </span>
                              <div onMouseDown={(e) => handleResizeStart("multiplier", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.startCur}px`, minWidth: `${colWidths.startCur}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="kW * 1.739 * Multiplier"
                              >
                                Start Cur. <Info className="size-3" />
                              </span>
                              <div onMouseDown={(e) => handleResizeStart("startCur", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.totalKw}px`, minWidth: `${colWidths.totalKw}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              {unitSystem === "ip" ? "Total (HP)" : "Total (kW)"}
                              <div onMouseDown={(e) => handleResizeStart("totalKw", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.standby}px`, minWidth: `${colWidths.standby}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              {unitSystem === "ip" ? "Standby (HP)" : "Standby (kW)"}
                              <div onMouseDown={(e) => handleResizeStart("standby", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.acl}px`, minWidth: `${colWidths.acl}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Actual Connected Load (Total kW - Standby)"
                              >
                                ACL <Info className="size-3" />
                              </span>
                              <div onMouseDown={(e) => handleResizeStart("acl", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.emergency}px`, minWidth: `${colWidths.emergency}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Defaults to ACL. Used to calculate emergency DG size."
                              >
                                Emergency <Info className="size-3" />
                              </span>
                              <div onMouseDown={(e) => handleResizeStart("emergency", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.powerFail}px`, minWidth: `${colWidths.powerFail}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Power Failure Load"
                              >
                                {unitSystem === "ip" ? "Power Fail (HP)" : "Power Fail (kW)"}
                              </span>
                              <div onMouseDown={(e) => handleResizeStart("powerFail", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.remark}px`, minWidth: `${colWidths.remark}px` }} className="px-3 py-1.5 text-center relative group/col select-none">
                              Remarks
                              <div onMouseDown={(e) => handleResizeStart("remark", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                            <th style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }} className="px-2 py-1.5 text-center relative group/col select-none">
                              Actions
                              <div onMouseDown={(e) => handleResizeStart("actions", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary z-20 group-hover/col:bg-border/60 transition-colors" title="Drag to resize column" />
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {displayRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={14}
                                className="text-center py-10 text-muted-foreground italic"
                              >
                                {showFlaggedOnly ? "No flagged loads found." : "No loads added. Click \"+ Add Load\" to begin."}
                              </td>
                            </tr>
                          ) : (
                            displayRows.map((r, rowIndex) => {
                              const rKw = Number(r.kwPerUnit) || 0;
                              const rSb = Number(r.standby) || 0;
                              const rUnit = Number(r.unit) || 0;
                              const rMult = Number(r.multiplier) || 0;

                              const startCur = rKw * 1.739 * rMult;
                              const totalKw = rUnit * rKw;
                              const actualKw = totalKw - rSb;

                              const isEditing = editingRow?.row.id === r.id;
                              const isModalOpen = editingRow !== null;

                              return (
                                <ContextMenu key={r.id}>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      key={r.id}
                                      id={`gen-row-${r.id}`}
                                      onDoubleClick={() => {
                                        toggleSelection(r.id, false, false);
                                        setEditingRow({ row: r, index: rowIndex });
                                      }}
                                      className={`transition-colors duration-150 cursor-pointer select-none text-[12.5px] border-b border-border/60 ${rowDensity === "compact" ? "h-[26px]" : "h-[30px]"} ${
                                        isEditing
                                          ? "bg-primary/15 font-semibold"
                                          : isModalOpen
                                          ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                          : selectedRows.has(r.id)
                                          ? "bg-primary/10"
                                          : rowIndex % 2 === 0
                                          ? "bg-card hover:bg-muted/40 dark:hover:bg-surface-2/60"
                                          : "bg-muted/15 hover:bg-muted/40 dark:hover:bg-surface-2/60"
                                      } ${draggedRowIndex === rowIndex ? "opacity-50" : ""}`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, rowIndex)}
                                      onDragOver={(e) => handleDragOver(e, rowIndex)}
                                      onDrop={handleDrop}
                                      onDragEnd={handleDrop}
                                      onClick={(e) => {
                                        const tagName = (e.target as HTMLElement).tagName;
                                        if (tagName === "TD") {
                                          toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                        }
                                      }}
                                      onContextMenu={() => {
                                        if (!selectedRows.has(r.id)) {
                                          toggleSelection(r.id, false, false);
                                        }
                                      }}
                                    >
                                      <td style={{ width: `${colWidths.select}px`, minWidth: `${colWidths.select}px` }} className="p-0">
                                        <div className="flex items-center justify-center h-full px-1">
                                          <input
                                            type="checkbox"
                                            className="size-3.5 accent-primary cursor-pointer rounded border-border"
                                            checked={selectedRows.has(r.id)}
                                            onChange={() => {}}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                            }}
                                          />
                                        </div>
                                      </td>
                                      <td style={{ width: `${colWidths.desc}px`, minWidth: `${colWidths.desc}px` }} className="p-0">
                                        <div className="flex items-center gap-1.5 w-full h-full px-2">
                                          {r.comments && r.comments.length > 0 && (
                                            <span
                                              className="inline-flex items-center justify-center p-1 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300 shrink-0 cursor-pointer"
                                              title={`${r.comments.length} comment(s):\n${r.comments.map((c: any) => `${c.authorName}: ${c.text}`).join('\n')}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setCommentTarget({
                                                  id: r.id,
                                                  name: r.desc || `Row ${rowIndex + 1}`,
                                                  type: "space",
                                                });
                                                setAssignCommentOpen(true);
                                              }}
                                            >
                                              <MessageSquare className="size-3.5" />
                                            </span>
                                          )}
                                          <input
                                            data-row={rowIndex}
                                            data-col={0}
                                            type="text"
                                            className="w-full h-full px-1.5 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors flex-1"
                                            value={r.desc}
                                            onChange={(e) => updateRow(r.id, "desc", e.target.value)}
                                            placeholder="Description"
                                          />
                                        </div>
                                      </td>
                                      <td style={{ width: `${colWidths.unit}px`, minWidth: `${colWidths.unit}px` }} className="p-0">
                                        <input
                                          data-row={rowIndex}
                                          data-col={1}
                                          type="number"
                                          className="w-full h-full px-1 text-center text-[12.5px] font-mono text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.unit}
                                          onChange={(e) => updateRow(r.id, "unit", e.target.value)}
                                        />
                                      </td>
                                      <td style={{ width: `${colWidths.kwPerUnit}px`, minWidth: `${colWidths.kwPerUnit}px` }} className="p-0">
                                        <input
                                          data-row={rowIndex}
                                          data-col={2}
                                          type="number"
                                          className="w-full h-full px-1 text-center text-[12.5px] font-mono text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.kwPerUnit}
                                          onChange={(e) => updateRow(r.id, "kwPerUnit", e.target.value)}
                                        />
                                      </td>
                                      <td style={{ width: `${colWidths.starter}px`, minWidth: `${colWidths.starter}px` }} className="p-0">
                                        <select
                                          data-row={rowIndex}
                                          data-col={3}
                                          className="w-full h-full px-1 text-center text-[12px] text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors cursor-pointer"
                                          value={r.starter}
                                          onChange={(e) => updateRow(r.id, "starter", e.target.value)}
                                        >
                                          <option value="DOL" className="bg-popover text-popover-foreground">DOL</option>
                                          <option value="SD" className="bg-popover text-popover-foreground">Star Delta</option>
                                          <option value="Soft Starter" className="bg-popover text-popover-foreground">Soft Starter</option>
                                          <option value="VFD" className="bg-popover text-popover-foreground">VFD</option>
                                          <option value="None" className="bg-popover text-popover-foreground">None</option>
                                        </select>
                                      </td>
                                      <td style={{ width: `${colWidths.multiplier}px`, minWidth: `${colWidths.multiplier}px` }} className="p-0 text-center">
                                        <input
                                          data-row={rowIndex}
                                          data-col={4}
                                          type="number"
                                          className="w-full h-full px-1 text-center text-[12.5px] font-mono text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 font-medium transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.multiplier}
                                          onChange={(e) =>
                                            updateRow(r.id, "multiplier", e.target.value)
                                          }
                                        />
                                      </td>
                                      <td style={{ width: `${colWidths.startCur}px`, minWidth: `${colWidths.startCur}px` }} className="p-0 text-center font-mono text-[12px] font-semibold text-foreground">
                                        {startCur.toFixed(2)}
                                      </td>
                                      <td style={{ width: `${colWidths.totalKw}px`, minWidth: `${colWidths.totalKw}px` }} className="p-0 text-center font-mono text-[12px] text-muted-foreground">
                                        {totalKw.toFixed(2)}
                                      </td>
                                      <td style={{ width: `${colWidths.standby}px`, minWidth: `${colWidths.standby}px` }} className="p-0">
                                        <input
                                          data-row={rowIndex}
                                          data-col={5}
                                          type="number"
                                          className="w-full h-full px-1 text-center text-[12.5px] font-mono text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.standby}
                                          onChange={(e) => updateRow(r.id, "standby", e.target.value)}
                                        />
                                      </td>
                                      <td style={{ width: `${colWidths.acl}px`, minWidth: `${colWidths.acl}px` }} className="p-0 text-center font-mono text-[12px] font-semibold text-primary">
                                        {actualKw.toFixed(2)}
                                      </td>
                                      <td style={{ width: `${colWidths.emergency}px`, minWidth: `${colWidths.emergency}px` }} className="p-0 relative group/em">
                                        <div className="flex items-center w-full h-full">
                                          <input
                                            data-row={rowIndex}
                                            data-col={6}
                                            type="number"
                                            className={`w-full h-full px-1 text-center text-[12.5px] font-mono text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${r.excludeEmergency ? "opacity-30 line-through" : ""}`}
                                            value={r.emergency}
                                            onChange={(e) =>
                                              updateRow(r.id, "emergency", e.target.value)
                                            }
                                            disabled={r.excludeEmergency}
                                          />
                                          <button
                                            onClick={() =>
                                              updateRow(r.id, "excludeEmergency", !r.excludeEmergency)
                                            }
                                            className="absolute right-1 opacity-0 group-hover/em:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity bg-background dark:bg-surface-2 shadow-sm rounded border border-border"
                                            title={
                                              r.excludeEmergency
                                                ? "Include Emergency Load"
                                                : "Exclude Emergency Load"
                                            }
                                          >
                                            {r.excludeEmergency ? (
                                              <Plus className="size-3" />
                                            ) : (
                                              <Trash2 className="size-3" />
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                      <td style={{ width: `${colWidths.powerFail}px`, minWidth: `${colWidths.powerFail}px` }} className="p-0">
                                        <div className="flex items-center w-full h-full">
                                          <input
                                            data-row={rowIndex}
                                            data-col={7}
                                            type="number"
                                            className="w-full h-full px-1 text-center text-[12.5px] font-mono text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1"
                                            value={r.powerFail}
                                            onChange={(e) => updateRow(r.id, "powerFail", e.target.value)}
                                          />
                                          <select
                                            className="h-full w-10 px-0.5 bg-primary/10 text-primary outline-none cursor-pointer border-l border-border/50 text-[10px] font-medium dark:bg-primary/20 dark:text-primary-foreground"
                                            defaultValue=""
                                            onChange={(e) => {
                                              setPowerFailPercent(r.id, e.target.value);
                                              e.target.value = "";
                                            }}
                                          >
                                            <option value="" disabled className="bg-popover text-popover-foreground">
                                              %
                                            </option>
                                            <option value="10" className="bg-popover text-popover-foreground">10%</option>
                                            <option value="20" className="bg-popover text-popover-foreground">20%</option>
                                            <option value="30" className="bg-popover text-popover-foreground">30%</option>
                                            <option value="40" className="bg-popover text-popover-foreground">40%</option>
                                            <option value="50" className="bg-popover text-popover-foreground">50%</option>
                                            <option value="60" className="bg-popover text-popover-foreground">60%</option>
                                            <option value="70" className="bg-popover text-popover-foreground">70%</option>
                                            <option value="80" className="bg-popover text-popover-foreground">80%</option>
                                            <option value="90" className="bg-popover text-popover-foreground">90%</option>
                                            <option value="100" className="bg-popover text-popover-foreground">100%</option>
                                          </select>
                                        </div>
                                      </td>
                                      <td style={{ width: `${colWidths.remark}px`, minWidth: `${colWidths.remark}px` }} className="p-0">
                                        <input
                                          data-row={rowIndex}
                                          data-col={8}
                                          type="text"
                                          className="w-full h-full px-2 text-center text-[12px] text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors"
                                          value={!r.remark || r.remark === "undefined" ? "" : r.remark}
                                          onChange={(e) => updateRow(r.id, "remark", e.target.value)}
                                        />
                                      </td>
                                      <td style={{ width: `${colWidths.actions}px`, minWidth: `${colWidths.actions}px` }} className="p-0 text-center">
                                        <div className="flex items-center justify-center gap-1 h-full w-full px-1">
                                          {(() => {
                                            const { isAutoFlagged, isFlagged, warnings } = getGenRowValidation(r);
                                            const tooltipText = isFlagged
                                              ? warnings.length > 0
                                                ? `Flagged for review. Warning(s): ${warnings.join(", ")}`
                                                : "Flagged for manual review"
                                              : "Flag load for review";

                                            return (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleFlagRows(r.id, isFlagged);
                                                }}
                                                className={`p-0.5 rounded transition-colors cursor-pointer ${
                                                  isFlagged
                                                    ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20"
                                                    : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                }`}
                                                title={tooltipText}
                                              >
                                                <Flag className={`size-3.5 ${isFlagged ? "fill-red-500 text-red-500" : ""}`} />
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </td>
                                    </tr>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-xl p-1 text-[13px] text-popover-foreground z-[999]">
                                    <ContextMenuItem
                                      onClick={() => {
                                        const { isFlagged } = getGenRowValidation(r);
                                        toggleFlagRows(r.id, isFlagged);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <Flag className={`size-3.5 ${getGenRowValidation(r).isFlagged ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
                                      <span>{getGenRowValidation(r).isFlagged ? "Unflag Selected Row(s)" : "Flag Selected Row(s)"}</span>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />

                                    <ContextMenuItem
                                      onClick={() => {
                                        const el = document.querySelector(`input[data-row="${rowIndex}"][data-col="0"]`) as HTMLInputElement;
                                        if (el) el.focus();
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <Edit3 className="size-3.5 text-muted-foreground" />
                                      <span>{selectedRows.size > 1 && selectedRows.has(r.id) ? `Edit Row (${selectedRows.size} selected)` : "Edit Row"}</span>
                                    </ContextMenuItem>

                                    <ContextMenuItem
                                      onClick={() => {
                                        const targets = selectedRows.has(r.id) ? Array.from(selectedRows) : [r.id];
                                        const newClones: GenRow[] = [];
                                        rows.forEach((row) => {
                                          if (targets.includes(row.id)) {
                                            newClones.push({
                                              ...row,
                                              id: `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}_${Math.floor(Math.random() * 1000)}`,
                                              desc: row.desc ? `${row.desc} (Copy)` : "Copy Row",
                                            });
                                          }
                                        });
                                        const newRows = [...rows, ...newClones];
                                        pushState(newRows);
                                        toast.success(`Duplicated ${newClones.length} row(s)`);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      <span>{selectedRows.size > 1 && selectedRows.has(r.id) ? `Duplicate Selected (${selectedRows.size})` : "Duplicate Row"}</span>
                                    </ContextMenuItem>

                                    <ContextMenuItem
                                      onClick={() => {
                                        setCommentTarget({
                                          id: r.id,
                                          name: r.desc || `Row ${rowIndex + 1}`,
                                          type: "space",
                                        });
                                        setAssignCommentOpen(true);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-blue-600 dark:text-blue-400"
                                    >
                                      <MessageSquare className="size-3.5" />
                                      <span>Add comment</span>
                                    </ContextMenuItem>

                                    <ContextMenuSeparator className="h-px bg-border my-1" />

                                    <ContextMenuItem
                                      onClick={() => {
                                        const targets = selectedRows.has(r.id) ? Array.from(selectedRows) : [r.id];
                                        const newRows = rows.map((row) => {
                                          if (targets.includes(row.id)) {
                                            return { ...row, excludeEmergency: !r.excludeEmergency };
                                          }
                                          return row;
                                        });
                                        pushState(newRows);
                                        toast.info(`${r.excludeEmergency ? "Included" : "Excluded"} emergency load for ${targets.length} row(s)`);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                                      <span>{r.excludeEmergency ? "Include Emergency Load" : "Exclude Emergency Load"}</span>
                                    </ContextMenuItem>

                                    <ContextMenuSeparator className="h-px bg-border my-1" />

                                    <ContextMenuItem
                                      onClick={() => {
                                        const targets = selectedRows.has(r.id) ? Array.from(selectedRows) : [r.id];
                                        const newRows = rows.filter((row) => !targets.includes(row.id));
                                        pushState(newRows);
                                        clearSelection();
                                        toast.info(`Deleted ${targets.length} row(s)`);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{selectedRows.size > 1 && selectedRows.has(r.id) ? `Delete Selected (${selectedRows.size})` : "Delete Row"}</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Side: Results & Config */}
                {isPanelOpen && (
                  <div className="flex flex-col w-full xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-white/40 dark:border-white/10 bg-transparent overflow-y-auto p-4 gap-4 transition-all duration-300 animate-in fade-in slide-in-from-right-4">
                    <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 shrink-0">
                      <div className="flex items-center justify-between border-b border-white/40 dark:border-white/10 pb-2 mb-3">
                        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Sizing Parameters
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsPanelOpen(false)}
                          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Collapse Panel"
                        >
                          <ChevronRight className="size-3.5 hidden xl:block" />
                          <ChevronUp className="size-3.5 xl:hidden" />
                        </button>
                      </div>
                      <div className="space-y-3 text-[13px]">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Power Factor (Lag)</span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 px-2 py-1 border border-border bg-surface-2 text-foreground rounded outline-none text-right [appearance:textfield] focus:ring-1 focus:ring-primary focus:border-primary"
                            value={pf}
                            onChange={(e) => setPf(parseFloat(e.target.value) || 0.8)}
                          />
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-medium">Loading Factor</span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-20 px-2 py-1 border border-border bg-surface-2 text-foreground rounded outline-none text-right [appearance:textfield] focus:ring-1 focus:ring-primary focus:border-primary"
                            value={lf}
                            onChange={(e) => setLf(parseFloat(e.target.value) || 0.9)}
                          />
                        </div>
                      </div>
                    </div>

                    <div data-ignore-persist="true" className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col justify-between overflow-hidden shrink-0">
                      <div className="px-4 py-3 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-primary/10">
                        <div className="flex items-center gap-2">
                          <div className="w-1 h-4 bg-primary rounded-full" />
                          <h4 className="font-bold text-[12px] text-primary uppercase tracking-wide">
                            Generator Result
                          </h4>
                        </div>
                        {Object.keys(manualOverrides).length > 0 && (
                          <button 
                            onClick={clearOverrides}
                            className="text-[10px] bg-white/50 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40 text-primary px-2 py-0.5 rounded font-bold uppercase transition-colors shadow-sm"
                          >
                            Clear Overrides
                          </button>
                        )}
                      </div>

                      <div className="p-4 space-y-3">
                        {/* Header Row */}
                        <div className="grid grid-cols-[1fr_75px_75px] sm:grid-cols-[1fr_80px_80px] gap-2 sm:gap-4 pb-2 border-b border-surface-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                            Parameter
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                            ACL Base
                          </span>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                            Emerg. Base
                          </span>
                        </div>

                        <div className="grid grid-cols-[1fr_75px_75px] sm:grid-cols-[1fr_80px_80px] gap-2 sm:gap-4 items-center pb-2 border-b border-surface-2">
                          <span 
                            className="text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit"
                            title="Total Actual Connected Load"
                          >
                            Total ACL ({unitSystem === "ip" ? "HP" : "kW"})
                          </span>
                          <div className="text-right">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["acl"] !== undefined
                                  ? manualOverrides["acl"]
                                  : calc.totalAcl.toFixed(2)
                              }
                              onChange={(e) => setOverride("acl", e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  const copy = { ...manualOverrides };
                                  delete copy["acl"];
                                  setManualOverrides(copy);
                                }
                              }}
                            />
                          </div>
                          <div className="text-right">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["em"] !== undefined
                                  ? manualOverrides["em"]
                                  : calc.totalEmergency.toFixed(2)
                              }
                              onChange={(e) => setOverride("em", e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  const copy = { ...manualOverrides };
                                  delete copy["em"];
                                  setManualOverrides(copy);
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_75px_75px] sm:grid-cols-[1fr_80px_80px] gap-2 sm:gap-4 items-center pb-2 border-b border-surface-2">
                          <span 
                            className="text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit"
                            title="Demand Load = Actual Connected Load / Power Factor"
                          >
                            Demand Load (kVA)
                          </span>
                          <div className="text-right">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["demandAcl"] !== undefined
                                  ? manualOverrides["demandAcl"]
                                  : calc.demandLoadAcl.toFixed(2)
                              }
                              onChange={(e) => setOverride("demandAcl", e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  const copy = { ...manualOverrides };
                                  delete copy["demandAcl"];
                                  setManualOverrides(copy);
                                }
                              }}
                            />
                          </div>
                          <div className="text-right">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["demandEm"] !== undefined
                                  ? manualOverrides["demandEm"]
                                  : calc.demandLoadEm.toFixed(2)
                              }
                              onChange={(e) => setOverride("demandEm", e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  const copy = { ...manualOverrides };
                                  delete copy["demandEm"];
                                  setManualOverrides(copy);
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-[1fr_75px_75px] sm:grid-cols-[1fr_80px_80px] gap-2 sm:gap-4 items-center pb-2 border-b border-surface-2">
                          <span 
                            className="text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit"
                            title="Calculated size for DG set (Demand Load / Loading Factor)"
                          >
                            Calc. DG Size (kVA)
                          </span>
                          <div className="text-right">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["calcAcl"] !== undefined
                                  ? manualOverrides["calcAcl"]
                                  : calc.calcSizeAcl.toFixed(2)
                              }
                              onChange={(e) => setOverride("calcAcl", e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  const copy = { ...manualOverrides };
                                  delete copy["calcAcl"];
                                  setManualOverrides(copy);
                                }
                              }}
                            />
                          </div>
                          <div className="text-right">
                            <input
                              type="number"
                              className="w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                              value={
                                manualOverrides["calcEm"] !== undefined
                                  ? manualOverrides["calcEm"]
                                  : calc.calcSizeEm.toFixed(2)
                              }
                              onChange={(e) => setOverride("calcEm", e.target.value)}
                              onBlur={(e) => {
                                if (e.target.value === "") {
                                  const copy = { ...manualOverrides };
                                  delete copy["calcEm"];
                                  setManualOverrides(copy);
                                }
                              }}
                            />
                          </div>
                        </div>

                        <div className="pt-3 border-t border-surface-2 space-y-3">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Selected DG Set Size
                              </span>
                              {userSelectedSize !== null && (
                                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold uppercase">
                                  Manual
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={String(calc.selectedSize)}
                                onValueChange={(val) => setUserSelectedSize(Number(val))}
                              >
                                <SelectTrigger className="w-full h-9 bg-background border-border text-foreground font-extrabold text-[15px] shadow-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover text-popover-foreground border-border max-h-60">
                                  {STANDARD_SIZES.map((sz) => (
                                    <SelectItem key={sz} value={String(sz)} className="font-semibold text-xs cursor-pointer">
                                      {sz} kVA {sz === calc.autoSize ? "(Recommended)" : ""}
                                    </SelectItem>
                                  ))}
                                  {!STANDARD_SIZES.includes(calc.autoSize) && (
                                    <SelectItem value={String(calc.autoSize)} className="font-semibold text-xs cursor-pointer">
                                      {calc.autoSize} kVA (Calculated)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 text-[12.5px] shrink-0">
                      <h4 className="font-semibold text-muted-foreground mb-3 pb-2 border-b border-white/40 dark:border-white/10">
                        Motor Analysis
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Max Starting Current</span>
                          <span className="font-medium font-mono">
                            {calc.maxStartCur.toFixed(2)} A
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Largest Motor Size</span>
                          <span className="font-medium font-mono">
                            {calc.largestMotorKw > 0
                              ? unitSystem === "ip"
                                ? (calc.largestMotorKw / 0.746).toFixed(2) + " HP"
                                : calc.largestMotorKw.toFixed(2) + " kW"
                              : "-"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Largest Motor Starter</span>
                          <span className="font-medium">
                            {calc.largestMotorKw > 0 ? calc.largestMotorStarter : "-"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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
          existingComments={getMergedItemComments(commentTarget.id, commentTarget.name, rows.find((r) => r.id === commentTarget.id)?.comments, "/generator-sizing", project?.id)}
          onSave={async (newComment) => {
            if (!commentTarget) return;
            const targetId = commentTarget.id;
            const targetRow = rows.find((r) => r.id === targetId);
            if (!targetRow) return;
            const currentUserName = userData?.name || profile?.name || "Design Engineer";
            const projId = activeProjectId || project?.id || "default";
            const projName = project?.name || "Active Project";

            const commentWithMeta = {
              ...newComment,
              targetId: commentTarget.id,
              targetName: commentTarget.name,
              targetType: "Generator Load",
              projectName: projName,
              projectId: projId,
              calculatorPath: "/generator-sizing",
            };

            const existingComments = targetRow.comments || [];
            const updatedComments = [...existingComments, commentWithMeta];

            const newRows = rows.map((r) =>
              r.id === targetId ? { ...r, comments: updatedComments } : r
            );
            pushState(newRows);

            if (project?.id) {
              try {
                let wdata = (project as any)?.workspace_data || {};
                if (typeof wdata === 'string') { try { wdata = JSON.parse(wdata); } catch(e) {} }
                wdata.generator_calc = { ...(wdata.generator_calc || {}), rows: newRows };
                api.updateProject(project.id, { workspace_data: wdata }).catch(console.error);
              } catch(e) {}
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: commentWithMeta }));
              window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: commentWithMeta }));
              window.dispatchEvent(new Event("storage"));
            }

            toast.success(`Task comment saved for space ${commentTarget.name}`);
            notifyCommentAssigned({
              comment: commentWithMeta,
              targetId: commentTarget.id,
              targetName: commentTarget.name,
              targetType: "Generator Load",
              calculatorTitle: "Generator Sizing",
              calculatorPath: "/generator-sizing",
              project,
              currentUserName,
              currentUserId: userData?.id || profile?.id
            }).catch(console.error);
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
        />
      )}
      {/* Double-Click Edit & Calculation Breakdown Modal */}
      {editingRow && (
        <EditGeneratorRowModal
          row={editingRow.row}
          rowIndex={editingRow.index + 1}
          projectName={currentProject}
          pf={pf}
          lf={lf}
          unitSystem={unitSystem}
          onClose={() => setEditingRow(null)}
          onSave={(updated) => {
            const targetId = editingRow.row.id;
            const newRows = rows.map((r) =>
              r.id === targetId
                ? {
                    ...r,
                    desc: updated.desc,
                    unit: updated.unit,
                    kwPerUnit: updated.kwPerUnit,
                    starter: updated.starter,
                    multiplier: updated.multiplier,
                    remark: updated.remark,
                    excludeEmergency: updated.excludeEmergency,
                  }
                : r
            );
            pushState(newRows);
            setEditingRow(null);
            toast.success(`Updated "${updated.desc || 'Load Item'}" parameters.`);
          }}
        />
      )}
    </AppShell>
  );
}

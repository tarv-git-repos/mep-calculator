import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Trash2, Plus, FileSpreadsheet, Info, ChevronDown, ChevronUp, Save, X, Download, Flag } from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-discharge-unit")({
  head: () => ({
    meta: [
      { title: "Discharge Unit Calculator — MEP Calc" },
      { name: "description", content: "Water Supply Discharge Units (D.U.) sizing tool using Hunter's Curve Method." },
    ],
  }),
  component: DischargeUnitPage,
});

interface FUSpace {
  id: number;
  desc: string;
  floor: string;
  std: string;
  fixtures: Record<string, number>;
  isFlagged?: boolean;
}

export const IP_DISCHARGE_UNITS: Record<string, Record<string, number>> = {
  wc: { 'total-du': 4 },
  basin: { 'total-du': 1 },
  bibtap: { 'total-du': 1 },
  shower: { 'total-du': 5 },
  bath: { 'total-du': 10 },
  catchbasin: { 'total-du': 2 },
  urinal: { 'total-du': 0.3 },
  sink: { 'total-du': 3 },
  laundry: { 'total-du': 4 }
};

export const DU_FIXTURES_META = [
  { id: 'wc', short: 'Water Closet' },
  { id: 'urinal', short: 'Urinal' },
  { id: 'basin', short: 'Wash Basin' },
  { id: 'bath', short: 'Bath Tub' },
  { id: 'shower', short: 'Shower' },
  { id: 'sink', short: 'Sink' },
  { id: 'bibtap', short: 'BIB TAP' },
  { id: 'laundry', short: 'Washing Machine' },
  { id: 'catchbasin', short: 'Catch basin' }
];

const IPC_TABLE = [
  { wsfu: 0, gpm: 0 },
  { wsfu: 1, gpm: 3 },
  { wsfu: 2, gpm: 5 },
  { wsfu: 3, gpm: 6.5 },
  { wsfu: 5, gpm: 9.4 },
  { wsfu: 10, gpm: 14.6 },
  { wsfu: 15, gpm: 17.5 },
  { wsfu: 20, gpm: 19.6 },
  { wsfu: 25, gpm: 21.5 },
  { wsfu: 30, gpm: 23.3 },
  { wsfu: 40, gpm: 26.3 },
  { wsfu: 50, gpm: 29.1 },
  { wsfu: 60, gpm: 32 },
  { wsfu: 70, gpm: 35 },
  { wsfu: 80, gpm: 38 },
  { wsfu: 90, gpm: 41 },
  { wsfu: 100, gpm: 43.5 },
  { wsfu: 120, gpm: 48 },
  { wsfu: 140, gpm: 52.5 },
  { wsfu: 160, gpm: 57 },
  { wsfu: 180, gpm: 61 },
  { wsfu: 200, gpm: 65 },
  { wsfu: 225, gpm: 70 },
  { wsfu: 250, gpm: 75 },
  { wsfu: 275, gpm: 80 },
  { wsfu: 300, gpm: 85 },
  { wsfu: 400, gpm: 105 },
  { wsfu: 500, gpm: 124 },
  { wsfu: 750, gpm: 170 },
  { wsfu: 1000, gpm: 208 },
  { wsfu: 1250, gpm: 239 },
  { wsfu: 1500, gpm: 269 },
  { wsfu: 1750, gpm: 297 },
  { wsfu: 2000, gpm: 325 },
  { wsfu: 2500, gpm: 380 },
  { wsfu: 3000, gpm: 433 },
  { wsfu: 4000, gpm: 525 },
  { wsfu: 5000, gpm: 593 }
];

function wsfuToGPM(wsfu: number) {
  const clamped = Math.max(0, Math.min(wsfu, 5000));
  for (let i = 0; i < IPC_TABLE.length; i++) {
    if (IPC_TABLE[i].wsfu === clamped) {
      return IPC_TABLE[i].gpm;
    }
  }
  for (let i = 0; i < IPC_TABLE.length - 1; i++) {
    const lower = IPC_TABLE[i];
    const upper = IPC_TABLE[i + 1];
    if (clamped > lower.wsfu && clamped < upper.wsfu) {
      const ratio = (clamped - lower.wsfu) / (upper.wsfu - lower.wsfu);
      return lower.gpm + ratio * (upper.gpm - lower.gpm);
    }
  }
  return 0;
}

function wsfuToLPS(wsfu: number) {
  return wsfuToGPM(wsfu) * 0.06309;
}

function extractFloorFU(name: string) {
  const match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
  return match ? match[0].toUpperCase().replace(/L$/i, 'F') : 'G';
}

function DischargeUnitPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [headerStd, setHeaderStd] = useState<string>("total-du");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [fuSpaces, setFuSpaces] = useState<FUSpace[]>([]);
  const [previewSpace, setPreviewSpace] = useState<FUSpace | null>(null);
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newStd, setNewStd] = useState("total-du");
  const [newFixtures, setNewFixtures] = useState<Record<string, number>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Selection states for batch update
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStd, setBulkStd] = useState("total-du");

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_discharge_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.headerStd) setHeaderStd(data.headerStd);
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.fuSpaces) setFuSpaces(data.fuSpaces);
        } else {
          // Reset to defaults
          setUnitSystem("si");
          setHeaderStd("total-du");
          setWeightOverrides({});
          setFuSpaces([
            {
              id: 1,
              desc: "1F Male Washroom",
              floor: "1F",
              std: "total-du",
              fixtures: { wc: 4, urinal: 3, basin: 4 }
            },
            {
              id: 2,
              desc: "1F Female Washroom",
              floor: "1F",
              std: "total-du",
              fixtures: { wc: 5, basin: 4 }
            }
          ]);
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load fixture unit calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        headerStd,
        weightOverrides,
        fuSpaces
      };
      localStorage.setItem(`mep_discharge_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, headerStd, weightOverrides, fuSpaces]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          headerStd,
          weightOverrides,
          fuSpaces
        };
        localStorage.setItem(`mep_discharge_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Discharge Unit Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  useEffect(() => {
    const handleGlobalSave = (e: any) => {
      e.detail.handled = true;
      handleSaveCurrent();
    };
    window.addEventListener("mep-trigger-save", handleGlobalSave);
    return () => window.removeEventListener("mep-trigger-save", handleGlobalSave);
  }, [project?.id, unitSystem, headerStd, weightOverrides, fuSpaces, forceSaveToCloud]);

  // Accordion details

  const ip = unitSystem === "ip";

  const getEffectiveUnitFU = (fixtureId: string, spaceStd: string) => {
    if (spaceStd === headerStd && weightOverrides[fixtureId] !== undefined) {
      return weightOverrides[fixtureId];
    }
    return IP_DISCHARGE_UNITS[fixtureId]?.[spaceStd] ?? 0;
  };

  // Sizing Calculations
  const calculations = useMemo(() => {
    let totalDU = 0;
    let blackTotalDU = 0;
    let greyTotalDU = 0;
    const spaceTotals: Record<number, number> = {};
    const spaceBlackTotals: Record<number, number> = {};
    const spaceGreyTotals: Record<number, number> = {};
    const breakdown: string[] = [];
    const detailedSteps: any[] = [];

    fuSpaces.forEach(s => {
      let spaceDU = 0;
      let spaceBlack = 0;
      let spaceGrey = 0;
      const spaceParts: string[] = [];
      const spaceStd = s.std;

      DU_FIXTURES_META.forEach(f => {
        const qty = s.fixtures[f.id] || 0;
        if (qty > 0) {
          const unitFU = getEffectiveUnitFU(f.id, spaceStd);
          const subTotal = qty * unitFU;
          spaceDU += subTotal;
          if (f.id === 'wc' || f.id === 'urinal') {
            blackTotalDU += subTotal;
            spaceBlack += subTotal;
          } else {
            greyTotalDU += subTotal;
            spaceGrey += subTotal;
          }
          spaceParts.push(`${f.short} (${qty} × ${unitFU})`);
        }
      });

      spaceTotals[s.id] = spaceDU;
      spaceBlackTotals[s.id] = spaceBlack;
      spaceGreyTotals[s.id] = spaceGrey;
      totalDU += spaceDU;

      if (spaceDU > 0) {
        const stdLabel = spaceStd.replace("ipc-", "").toUpperCase();
        breakdown.push(`${s.desc} [${stdLabel}]: ${spaceDU.toFixed(1)} D.U.`);
        detailedSteps.push({
          title: `Area: ${s.desc} (${stdLabel})`,
          expr: spaceParts.join(" + ") + ` = ${spaceDU.toFixed(1)} D.U.`
        });
      }
    });

    const flowGPM = wsfuToGPM(totalDU);
    const flowLPS = wsfuToLPS(totalDU);

    return {
      totalDU,
      blackTotalDU,
      greyTotalDU,
      spaceTotals,
      spaceBlackTotals,
      spaceGreyTotals,
      breakdown,
      detailedSteps,
      displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(2)} L/s`
    };
  }, [fuSpaces, headerStd, weightOverrides, ip]);

  const [undoStack, setUndoStack] = useState<any[][]>([]);
  const [redoStack, setRedoStack] = useState<any[][]>([]);
  const [clipboard, setClipboard] = useState<any[]>([]);

  const pushToUndo = (currentSpaces: any[]) => {
    setUndoStack((prev) => [...prev, currentSpaces]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, fuSpaces]);
    setFuSpaces(previous);
    setUndoStack((prev) => prev.slice(0, -1));
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, fuSpaces]);
    setFuSpaces(next);
    setRedoStack((prev) => prev.slice(0, -1));
    toast.success("Redo successful");
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (e.key === "Escape") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          setSelectedIds([]);
        }
        return;
      }

      // Undo / Redo: Ctrl+Z / Ctrl+Y
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        if (!isInput) {
          e.preventDefault();
          handleRedo();
        }
        return;
      }

      // Select All: Ctrl+A
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        if (!isInput && fuSpaces.length > 0) {
          e.preventDefault();
          setSelectedIds(fuSpaces.map(s => s.id));
        }
        return;
      }

      // Copy: Ctrl+C
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (!isInput && selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          toast.success(`${toCopy.length} row(s) copied`);
        }
        return;
      }

      // Cut: Ctrl+X
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (!isInput && selectedIds.length > 0) {
          e.preventDefault();
          const toCopy = fuSpaces.filter(s => selectedIds.includes(s.id));
          setClipboard(toCopy);
          pushToUndo(fuSpaces);
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.success(`${toCopy.length} row(s) cut`);
        }
        return;
      }

      // Paste: Ctrl+V
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        if (!isInput && clipboard.length > 0) {
          e.preventDefault();
          const pasted = clipboard.map((s, idx) => ({
            ...s,
            id: Date.now() + idx + Math.floor(Math.random() * 1000),
            desc: `${s.desc} (Copy)`
          }));
          pushToUndo(fuSpaces);
          setFuSpaces(prev => [...prev, ...pasted]);
          setSelectedIds(pasted.map(p => p.id));
          toast.success(`${pasted.length} row(s) pasted`);
        }
        return;
      }
      // Save: Ctrl+S
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      // Delete / Backspace
      if (!isInput && (e.key === "Delete" || e.key === "Backspace")) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          pushToUndo(fuSpaces);
          setFuSpaces(prev => prev.filter(s => !selectedIds.includes(s.id)));
          setSelectedIds([]);
          toast.success(`${selectedIds.length} row(s) deleted`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, fuSpaces, clipboard, undoStack, redoStack]);

  // Handlers
  const handleAddSpace = () => {
    setFuSpaces([...fuSpaces, {
      id: Date.now(),
      desc: "New Space",
      floor: "Floor Not Identified",
      std: "total-du",
      fixtures: {}
    }]);
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, val: number) => {
    setFuSpaces(fuSpaces.map(s => {
      if (s.id !== spaceId) return s;
      return {
        ...s,
        fixtures: {
          ...s.fixtures,
          [fixtureId]: Math.max(0, val)
        }
      };
    }));
  };

  const handleSpaceChange = (spaceId: number, field: "desc" | "std", val: any) => {
    setFuSpaces(fuSpaces.map(s => {
      if (s.id !== spaceId) return s;
      const updated = { ...s, [field]: val };
      if (field === "desc") {
        updated.floor = extractFloorFU(val);
      }
      return updated;
    }));
  };

  // Bulk actions
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(fuSpaces.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(x => x !== id));
    }
  };

  const handleApplyBulkStd = () => {
    if (selectedIds.length === 0) return;
    setFuSpaces(fuSpaces.map(s => {
      if (selectedIds.includes(s.id)) {
        return { ...s, std: bulkStd };
      }
      return s;
    }));
    setSelectedIds([]);
  };

  // Excel Export
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const rowsData = [
      ["Discharge Unit Sizing Report"],
      ["S.No", "Description", ...DU_FIXTURES_META.map(f => f.short), "Black D.U.", "Grey D.U."],
      ...fuSpaces.map((s, idx) => {
        const row = [
          idx + 1,
          s.desc,
          s.std.replace("ipc-", "").toUpperCase(),
        ];
        DU_FIXTURES_META.forEach(f => {
          row.push(s.fixtures[f.id] || 0);
        });
        row.push(calculations.spaceTotals[s.id] || 0);
        return row;
      }),
      ["TOTALS", "", ...DU_FIXTURES_META.map(() => ""), calculations.blackTotalDU, calculations.greyTotalDU]
    ];

    const summaryData = [
      ["Sizing Summary"],
      ["Total D.U.", calculations.totalDU.toFixed(1)],
      ["Probable Peak Flow", calculations.displayFlow],
      ["Applied Standard", "Curve Fit Polynomial Method (Hunter's Curve)"],
      [],
      ["Assumptions & Basis"],
      ["-", "Sizing is based on the Water Supply Discharge Units (D.U.) methodology."],
      ["-", "Standards options support Black Water, Grey Water, or Total D.U. loadings."],
      ["-", "Probable peak flow rate conversion is derived from the Curve Fit Polynomial matching the Hunter's curve chart data up to 5,000 D.U.s."]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    const wsRows = XLSX.utils.aoa_to_sheet(rowsData);
    XLSX.utils.book_append_sheet(wb, wsRows, "Fixture Schedule");

    const xlsxBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadFile(new Uint8Array(xlsxBuffer), "Fixture_Unit_Calculation_Report.xlsx", "Excel Document", ["xlsx"]);
  };

  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    const grouped: Record<string, FUSpace[]> = {};
    fuSpaces.forEach(s => {
      const fl = s.floor || "G";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [fuSpaces]);

  return (
    <AppShell title="Discharge Unit Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Page Header */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Discharge Unit</h1>
                <span className="text-[15px] font-semibold text-muted-foreground">{fuSpaces.length} spaces</span>
              </div>
              <CalculationReviewBar
                calculatorPath="/plumbing-discharge-unit"
                calculatorTitle="Plumbing Discharge Unit"
              />
            </div>
          </div>

          {/* White card container for Tabs & Data Grid */}
          <div className="flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
            {/* Tabs Selector row */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print modal-blur-bg border-b border-border/50">
              <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                <button
                  onClick={() => setActiveTab("calculator")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spaces
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

              {/* Toolbar */}
              <div className="flex items-center gap-2">
                <button onClick={() => setFuSpaces([])} className="text-red-500 hover:text-red-700 text-[11px] font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1.5 rounded transition-colors cursor-pointer border border-transparent hover:border-red-200">
                  <Trash2 className="size-3.5" /> Clear All Spaces
                </button>
                <button type="button" onClick={handleExportExcel} className="flex items-center gap-1.5 bg-background border border-border hover:bg-surface-2 text-foreground px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer">
                  <Download className="size-3.5" /> Export Excel
                </button>
                <button onClick={handleAddSpace} className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer">
                  <Plus className="size-3.5" /> New Space
                </button>
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 animate-fade-in flex flex-col">
              {activeTab === "calculator" ? (
                <div className="flex flex-col h-full bg-background relative">
          {/* Bulk toolbar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-xs font-bold text-[#06456F] dark:text-sky-400">
                <span className="bg-[#0A7BC7] text-white size-5.5 rounded-full inline-flex items-center justify-center font-mono mr-1.5 text-[10.5px]">{selectedIds.length}</span>
                Zones Selected
              </div>
              <div className="w-px h-5 bg-border"></div>
              
              <button type="button" onClick={() => setSelectedIds([])} className="ml-auto text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline">Deselect All</button>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0 bg-background">


                {/* Table for Adding/Editing spaces */}
                <div className="flex-1 overflow-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60 z-10 select-none">
                        <th rowSpan={2} className="p-2 text-center w-8 border-r border-border/50">
                          <input type="checkbox" checked={selectedIds.length === fuSpaces.length && fuSpaces.length > 0} onChange={e => handleToggleSelectAll(e.target.checked)} className="size-3.5 accent-orange-500 cursor-pointer" />
                        </th>
                        <th rowSpan={2} className="p-2 text-left w-[20%] border-r border-border/50">Description</th>
                        {DU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-2 text-center w-[7%] text-[11px] font-bold border-r border-border/50">{f.short}</th>
                        ))}
                        <th rowSpan={2} className="p-2 text-center w-[8%] bg-red-500/10 text-red-700 dark:text-red-400 font-bold border-r border-border/50" title="Total Black Water D.U.">BLACK DU</th>
                        <th rowSpan={2} className="p-2 text-center w-[8%] bg-green-500/10 text-green-700 dark:text-green-400 font-bold border-r border-border/50" title="Total Grey Water D.U.">GREY DU</th>
                        <th rowSpan={2} className="p-2 text-center w-8 border-r border-border/50"></th>
                      </tr>
                      <tr className="bg-muted/10 border-b border-border/40 text-[10px] text-muted-foreground uppercase tracking-wider">
                        {DU_FIXTURES_META.map(f => {
                          const currentVal = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (IP_DISCHARGE_UNITS[f.id]?.[headerStd] ?? "");
                          return (
                            <th key={f.id} className="p-1 px-0.5 text-center font-bold bg-[#0A7BC7]/5 border-r border-border/50">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={currentVal}
                                onChange={(e) => {
                                  const val = e.target.value !== "" ? Number(e.target.value) : 0;
                                  setWeightOverrides(prev => ({ ...prev, [f.id]: val }));
                                }}
                                className="w-full text-center bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded text-[#0A7BC7] font-extrabold text-[11.5px] py-0.5 outline-none focus:ring-2 focus:ring-[#0A7BC7]"
                                title={`Edit weight for ${f.short} (Click to change)`}
                              />
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    
                    {/* Sizing Rows */}
                    {fuSpaces.length === 0 ? (
                      <tbody>
                        <tr>
                          <td colSpan={DU_FIXTURES_META.length + 4} className="p-8 text-center text-muted-foreground italic">No spaces added. Add one above.</td>
                        </tr>
                      </tbody>
                    ) : (
                      Object.keys(floorsGrouped).map(floor => (
                        <tbody key={floor}>
                          {/* Floor Header row */}
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-foreground font-bold select-none text-[11px]">
                            <td colSpan={DU_FIXTURES_META.length + 4} className="p-1.5 px-3">📍 Floor: {floor}</td>
                          </tr>
                          {floorsGrouped[floor].map(s => (
                            <tr key={s.id} onDoubleClick={() => setPreviewSpace(s)} className={`border-b border-border/40 hover:bg-slate-50/30 dark:hover:bg-slate-900/20 cursor-pointer ${s.isFlagged ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                              <td className="p-2 text-center border-r border-border/50">
                                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={e => handleToggleSelect(s.id, e.target.checked)} className="size-3.5 accent-orange-500 cursor-pointer" />
                              </td>
                              <td className="p-1.5 border-r border-border/50">
                                <input type="text" value={s.desc} onChange={e => handleSpaceChange(s.id, "desc", e.target.value)} className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded" />
                              </td>
                              {DU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1 border-r border-border/50">
                                  <input type="number" min="0" value={s.fixtures[f.id] || ""} onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" />
                                </td>
                              ))}
                              <td className="p-2 text-center font-black text-red-700 dark:text-red-400 bg-red-500/5 border-r border-border/50">
                                {(calculations.spaceBlackTotals[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-2 text-center font-black text-green-700 dark:text-green-400 bg-green-500/5 border-r border-border/50">
                                {(calculations.spaceGreyTotals[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-2 text-center border-r border-border/50">
                                <button onClick={() => setFuSpaces(fuSpaces.map(x => x.id === s.id ? { ...x, isFlagged: !x.isFlagged } : x))} className={`p-1 rounded cursor-pointer transition-colors border-0 bg-transparent ${s.isFlagged ? "text-amber-500 hover:text-amber-600 bg-amber-50 dark:bg-amber-950/20" : "text-slate-300 hover:text-amber-500"}`}>
                                  <Flag className={`size-3.5 ${s.isFlagged ? "fill-current" : ""}`} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      ))
                    )}
                  </table>
                </div>
              </div>


            </div>

              ) : (

                <div className="flex-1 flex justify-center bg-slate-50/30 dark:bg-black/10 overflow-y-auto p-8">
                  <div className="flex flex-col gap-6 w-full max-w-4xl">
                    <div className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-5 shadow-xs">
                      <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                        <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                      </div>

                      <div className="flex flex-col gap-4 font-sans text-sm">
                        <div className="flex justify-between items-center py-2 border-b border-border/40">
                          <span className="font-semibold text-muted-foreground">Total Discharge Units</span>
                          <strong className="font-bold text-foreground font-mono text-base">{calculations.totalDU.toFixed(1)} D.U.</strong>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b border-border/40">
                          <span className="font-bold text-foreground uppercase tracking-wide">Probable Peak Flow</span>
                          <strong className="font-extrabold text-[#0A7BC7] text-xl font-mono">{calculations.displayFlow}</strong>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border/40">
                          <span className="font-semibold text-muted-foreground">Applied Sizing standard</span>
                          <span className="font-semibold text-foreground">IPC Polynomial Method</span>
                        </div>
                      </div>

                      <div className="bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#06456F] dark:text-sky-300 rounded-xl p-4 flex gap-3 text-xs font-sans mt-2">
                        <Info className="size-5 shrink-0 text-[#0A7BC7]" />
                        <span className="leading-relaxed">The fixture values are automatically synced with downstream sizing schedules (e.g. Booster Pump, Transfer Pump, Storage Tanks).</span>
                      </div>
                    </div>

                    {/* Detailed Sizing Steps */}
                    <div className="bg-card border border-border rounded-2xl shadow-xs p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                        <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-sans">Σ Detailed Calculations</h3>
                      </div>
                      <div className="flex flex-col gap-3 text-xs font-sans">
                        {calculations.detailedSteps.length === 0 ? (
                          <span className="text-muted-foreground italic">No detailed calculations available yet. Add spaces in the calculator.</span>
                        ) : (
                          calculations.detailedSteps.map((s, idx) => (
                            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/50">
                              <div className="font-bold text-foreground mb-1">{s.title}</div>
                              <div className="font-mono text-muted-foreground break-all">{s.expr}</div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Assumptions & Basis */}
                    <div className="bg-card border border-border rounded-2xl shadow-xs p-6 flex flex-col gap-4">
                      <div className="flex items-center gap-2 pb-3 border-b border-border/60">
                        <div className="w-1.5 h-4 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground font-sans">ℹ Assumptions & Basis</h3>
                      </div>
                      <div className="text-xs font-sans text-muted-foreground flex flex-col gap-3">
                        <div className="flex gap-2.5">
                          <span className="text-[#0A7BC7] font-bold">•</span>
                          <span className="leading-relaxed">Sizing is based on the Water Supply Discharge Units (D.U.) methodology.</span>
                        </div>
                        <div className="flex gap-2.5">
                          <span className="text-[#0A7BC7] font-bold">•</span>
                          <span className="leading-relaxed">Standards options support Black Water, Grey Water, or Total D.U. loadings.</span>
                        </div>
                        <div className="flex gap-2.5">
                          <span className="text-[#0A7BC7] font-bold">•</span>
                          <span className="leading-relaxed">Probable peak flow rate conversion is derived from the Curve Fit Polynomial matching the Hunter's curve chart data up to 5,000 D.U.s.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {previewSpace && (
        <DischargeSpacePreviewModal 
          space={previewSpace} 
          onClose={() => setPreviewSpace(null)} 
          getEffectiveUnitFU={getEffectiveUnitFU} 
          onSave={(updated) => {
            setFuSpaces(prev => prev.map(s => s.id === updated.id ? updated : s));
            setPreviewSpace(null);
          }}
        />
      )}
    </AppShell>
  );
}



function DischargeSpacePreviewModal({ space, onClose, getEffectiveUnitFU, onSave }: { space: FUSpace, onClose: () => void, getEffectiveUnitFU: (fixtureId: string, spaceStd: string) => number, onSave: (s: FUSpace) => void }) {
  const [showPreview, setShowPreview] = useState(false);
  const [tempSpace, setTempSpace] = useState<FUSpace>({ ...space });

  const spaceStd = tempSpace.std;
  let spaceDU = 0;
  const breakdown: any[] = [];
  
  DU_FIXTURES_META.forEach(f => {
    const qty = tempSpace.fixtures[f.id] || 0;
    if (qty > 0) {
      const unitFU = getEffectiveUnitFU(f.id, spaceStd);
      const subTotal = qty * unitFU;
      spaceDU += subTotal;
      breakdown.push({ name: f.short, qty, unitFU, subTotal });
    }
  });

  const handleFixtureChange = (id: string, qty: number) => {
    setTempSpace(prev => ({ ...prev, fixtures: { ...prev.fixtures, [id]: qty } }));
  }

  const labelClass = "block text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mb-1.5 uppercase tracking-wide";
  const inputClass = "w-full h-9 bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-3 text-[13px] text-neutral-800 dark:text-neutral-200 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div 
        className={`bg-card text-card-foreground flex flex-col rounded-2xl shadow-2xl border border-border overflow-hidden transition-all duration-300 ease-out max-h-[90vh] ${
          showPreview ? "max-w-5xl" : "max-w-2xl"
        } w-full`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-6 py-4 border-b border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-[15px] font-bold tracking-tight text-neutral-800 dark:text-neutral-200">
                Edit Space Parameters
              </h2>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Configure discharge units mapping and fixture quantities.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPreview((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all shadow-sm ${
                showPreview
                  ? "bg-primary text-primary-foreground hover:bg-primary/95 ring-2 ring-primary/20"
                  : "bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <Info className="size-3.5" />
              Calculations Preview
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Form */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 form-scrollbar">
            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                General Parameters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelClass}>Space Name</label>
                  <input type="text" value={tempSpace.desc} onChange={e => setTempSpace(p => ({...p, desc: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Floor</label>
                  <input type="text" value={tempSpace.floor} onChange={e => setTempSpace(p => ({...p, floor: e.target.value}))} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Standard</label>
                  <select value={tempSpace.std} onChange={e => setTempSpace(p => ({...p, std: e.target.value}))} className={inputClass}>
                    <option value="total-du">Total D.U.</option>
                    <option value="black-water">Black Water</option>
                    <option value="grey-water">Grey Water</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-[11px] uppercase font-bold text-primary tracking-widest border-b border-black/5 dark:border-white/5 pb-2">
                Fixture Quantities
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {DU_FIXTURES_META.map(f => (
                  <div key={f.id}>
                    <label className={labelClass}>{f.short}</label>
                    <input 
                      type="number" 
                      min="0" 
                      value={tempSpace.fixtures[f.id] || ""} 
                      onChange={e => handleFixtureChange(f.id, parseInt(e.target.value) || 0)} 
                      className={inputClass} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          <div
            className={`shrink-0 bg-white/30 dark:bg-black/20 backdrop-blur-md border-l border-black/5 dark:border-white/5 overflow-hidden transition-[width,opacity] duration-300 ease-in-out flex flex-col ${
              showPreview ? "w-[400px] opacity-100 p-6" : "w-0 opacity-0 p-0"
            }`}
          >
            <div className="w-[352px] space-y-5 flex flex-col h-full overflow-y-auto">
              <h3 className="text-[11px] uppercase font-bold text-neutral-400 dark:text-neutral-500 tracking-wider pb-1.5 border-b border-black/5 dark:border-white/5 shrink-0">
                Calculations Preview
              </h3>

              <div className="space-y-3 flex-1 min-h-0">
                <div className="p-5 bg-white/40 dark:bg-white/5 border border-black/5 dark:border-white/5 rounded-2xl space-y-4 shadow-sm">
                  <div className="text-[12.5px] font-bold text-neutral-800 dark:text-neutral-200">
                    Discharge Units Breakdown
                  </div>

                  <div className="space-y-2">
                    {breakdown.length === 0 ? (
                      <div className="text-[11px] italic text-muted-foreground py-2 border-t border-black/5 dark:border-white/5">No fixtures added.</div>
                    ) : breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between items-baseline text-[12px] pt-1.5 border-t border-black/5 dark:border-white/5">
                        <span className="text-neutral-500 dark:text-neutral-400 font-medium truncate max-w-[150px]">{b.name}</span>
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span>{b.qty} × {b.unitFU} =</span>
                          <span className="font-bold text-[13px] text-foreground w-12 text-right">{b.subTotal.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-baseline text-[12px] pt-2 border-t-2 border-black/10 dark:border-white/10">
                      <span className="font-bold text-[#06456F] dark:text-sky-400">Total D.U.</span>
                      <span className="font-mono font-black text-[18px] text-[#0A7BC7]">
                        {spaceDU.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <footer className="px-6 h-16 border-t border-black/5 dark:border-white/5 bg-white/10 dark:bg-black/10 flex items-center justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="h-10 px-5 border border-black/10 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 text-neutral-700 dark:text-neutral-300 rounded-xl text-[12.5px] font-medium transition-colors cursor-pointer shadow-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(tempSpace)}
            className="h-10 px-5 bg-primary text-primary-foreground hover:bg-primary/95 rounded-xl text-[12.5px] font-semibold transition-all shadow-md shadow-primary/10 active:scale-[0.98] cursor-pointer"
          >
            Save Changes
          </button>
        </footer>
      </div>
    </div>
  );
}

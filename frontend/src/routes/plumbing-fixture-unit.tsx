import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Trash2, Plus, FileSpreadsheet, Info, ChevronDown, ChevronUp, Save } from "lucide-react";
import * as XLSX from "xlsx";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-fixture-unit")({
  head: () => ({
    meta: [
      { title: "Fixture Unit Calculator — MEP Calc" },
      { name: "description", content: "Water Supply Fixture Units (WSFU) sizing tool using Hunter's Curve Method." },
    ],
  }),
  component: FixtureUnitPage,
});

interface FUSpace {
  id: number;
  desc: string;
  floor: string;
  std: string;
  fixtures: Record<string, number>;
}

export const IP_FIXTURE_UNITS: Record<string, Record<string, number>> = {
  wc: { low: 1.5, med: 2.5, high: 2.5, 'ipc-cold': 2.5, 'ipc-hot': 0, 'ipc-total': 2.5 },
  handspray: { low: 1.0, med: 1.0, high: 2.0, 'ipc-cold': 1.0, 'ipc-hot': 0, 'ipc-total': 1.0 },
  basin: { low: 1.0, med: 1.0, high: 2.0, 'ipc-cold': 0.75, 'ipc-hot': 0.75, 'ipc-total': 1.0 },
  sink: { low: 1.5, med: 1.5, high: 5.0, 'ipc-cold': 1.0, 'ipc-hot': 1.0, 'ipc-total': 1.5 },
  shower: { low: 1.5, med: 2.0, high: 4.0, 'ipc-cold': 1.5, 'ipc-hot': 1.5, 'ipc-total': 2.0 },
  washer: { low: 2.0, med: 3.0, high: 4.0, 'ipc-cold': 2.25, 'ipc-hot': 2.25, 'ipc-total': 3.0 },
  servicesink: { low: 2.0, med: 3.0, high: 5.0, 'ipc-cold': 2.25, 'ipc-hot': 2.25, 'ipc-total': 3.0 },
  hose_bibb: { low: 1.5, med: 2.5, high: 5.0, 'ipc-cold': 2.5, 'ipc-hot': 0, 'ipc-total': 2.5 },
  dishwasher: { low: 1.5, med: 1.5, high: 4.0, 'ipc-cold': 0.0, 'ipc-hot': 1.5, 'ipc-total': 1.5 },
  hose_bibb_1: { low: 1.0, med: 1.0, high: 2.5, 'ipc-cold': 1.0, 'ipc-hot': 0, 'ipc-total': 1.0 },
  bath: { low: 1.4, med: 10.0, high: 12.0, 'ipc-cold': 1.5, 'ipc-hot': 1.5, 'ipc-total': 2.0 },
  urinal: { low: 1.0, med: 1.0, high: 1.0, 'ipc-cold': 3.0, 'ipc-hot': 0, 'ipc-total': 3.0 }
};

export const FU_FIXTURES_META = [
  { id: 'wc', short: 'W/C' },
  { id: 'handspray', short: 'Hand Spray (Bibb)' },
  { id: 'basin', short: 'WASH BASIN' },
  { id: 'sink', short: 'Sink Kitchen' },
  { id: 'shower', short: 'Shower' },
  { id: 'washer', short: 'WASHING MACHINE' },
  { id: 'servicesink', short: 'Service Sink' },
  { id: 'hose_bibb', short: 'Hose Bibb' },
  { id: 'dishwasher', short: 'DISH WASHER' },
  { id: 'hose_bibb_1', short: 'Hose Bibb' }
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

function FixtureUnitPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [headerStd, setHeaderStd] = useState<string>("ipc-total");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [fuSpaces, setFuSpaces] = useState<FUSpace[]>([]);

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newStd, setNewStd] = useState("ipc-total");
  const [newFixtures, setNewFixtures] = useState<Record<string, number>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Selection states for batch update
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkStd, setBulkStd] = useState("ipc-total");

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_fixture_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.headerStd) setHeaderStd(data.headerStd);
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.fuSpaces) setFuSpaces(data.fuSpaces);
        } else {
          // Reset to defaults
          setUnitSystem("si");
          setHeaderStd("ipc-total");
          setWeightOverrides({});
          setFuSpaces([
            {
              id: 1,
              desc: "1F Male Washroom",
              floor: "1F",
              std: "ipc-total",
              fixtures: { wc: 4, urinal: 3, basin: 4 }
            },
            {
              id: 2,
              desc: "1F Female Washroom",
              floor: "1F",
              std: "ipc-total",
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
      localStorage.setItem(`mep_fixture_unit_calc_${project.id}`, JSON.stringify(dataToSave));
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
        localStorage.setItem(`mep_fixture_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Fixture Unit Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  // Accordion details
  const [expandDetails, setExpandDetails] = useState(false);
  const [expandAssumptions, setExpandAssumptions] = useState(false);

  const ip = unitSystem === "ip";

  const getEffectiveUnitFU = (fixtureId: string, spaceStd: string) => {
    if (spaceStd === headerStd && weightOverrides[fixtureId] !== undefined) {
      return weightOverrides[fixtureId];
    }
    return IP_FIXTURE_UNITS[fixtureId]?.[spaceStd] ?? 0;
  };

  // Sizing Calculations
  const calculations = useMemo(() => {
    let totalWSFU = 0;
    const spaceTotals: Record<number, number> = {};
    const breakdown: string[] = [];
    const detailedSteps: any[] = [];

    fuSpaces.forEach(s => {
      let spaceWSFU = 0;
      const spaceParts: string[] = [];
      const spaceStd = s.std;

      FU_FIXTURES_META.forEach(f => {
        const qty = s.fixtures[f.id] || 0;
        if (qty > 0) {
          const unitFU = getEffectiveUnitFU(f.id, spaceStd);
          const subTotal = qty * unitFU;
          spaceWSFU += subTotal;
          spaceParts.push(`${f.short} (${qty} × ${unitFU})`);
        }
      });

      spaceTotals[s.id] = spaceWSFU;
      totalWSFU += spaceWSFU;

      if (spaceWSFU > 0) {
        const stdLabel = spaceStd.replace("ipc-", "").toUpperCase();
        breakdown.push(`${s.desc} [${stdLabel}]: ${spaceWSFU.toFixed(1)} WSFU`);
        detailedSteps.push({
          title: `Area: ${s.desc} (${stdLabel})`,
          expr: spaceParts.join(" + ") + ` = ${spaceWSFU.toFixed(1)} WSFU`
        });
      }
    });

    const flowGPM = wsfuToGPM(totalWSFU);
    const flowLPS = wsfuToLPS(totalWSFU);

    return {
      totalWSFU,
      spaceTotals,
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
    if (!newDesc.trim()) return;
    const floor = extractFloorFU(newDesc);
    const fixturesCleaned: Record<string, number> = {};
    FU_FIXTURES_META.forEach(f => {
      const q = newFixtures[f.id] || 0;
      if (q > 0) fixturesCleaned[f.id] = q;
    });

    setFuSpaces([...fuSpaces, {
      id: Date.now(),
      desc: newDesc.trim(),
      floor,
      std: newStd,
      fixtures: fixturesCleaned
    }]);

    setNewDesc("");
    setNewFixtures({});
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
      ["Fixture Unit Sizing Report"],
      ["S.No", "Description", "Standard", ...FU_FIXTURES_META.map(f => f.short), "Total WSFU"],
      ...fuSpaces.map((s, idx) => {
        const row = [
          idx + 1,
          s.desc,
          s.std.replace("ipc-", "").toUpperCase(),
        ];
        FU_FIXTURES_META.forEach(f => {
          row.push(s.fixtures[f.id] || 0);
        });
        row.push(calculations.spaceTotals[s.id] || 0);
        return row;
      }),
      ["TOTALS", "", "", ...FU_FIXTURES_META.map(() => ""), calculations.totalWSFU]
    ];

    const summaryData = [
      ["Sizing Summary"],
      ["Total WSFU", calculations.totalWSFU.toFixed(1)],
      ["Probable Peak Flow", calculations.displayFlow],
      ["Applied Standard", "Curve Fit Polynomial Method (Hunter's Curve)"]
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
    <AppShell title="Fixture Unit Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full animate-in fade-in-50 duration-200">
          <div className="flex justify-between items-start select-none">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; FIXTURE UNIT SIZER</span>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground mt-0.5">Fixture Unit Calculator</h1>
              <CalculationReviewBar calculatorPath="/plumbing-fixture-unit" calculatorTitle="Plumbing Fixture Unit" />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Select fixtures, quantity, and apply usage standards to calculate Water Supply Fixture Units (WSFU) and peak demand flow.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-slate-50 dark:bg-slate-900/40 p-2.5 border border-border rounded-xl gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground shrink-0 uppercase tracking-wide">Header Standard / Category:</span>
              <select
                value={headerStd}
                onChange={(e) => setHeaderStd(e.target.value)}
                className="bg-white dark:bg-slate-950 border border-border text-foreground text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#0A7BC7] cursor-pointer min-w-[210px]"
              >
                <option value="ipc-total">Total WSFU (IPC / UPC)</option>
                <option value="ipc-cold">Cold Water WSFU (IPC / UPC)</option>
                <option value="ipc-hot">Hot Water WSFU (IPC / UPC)</option>
                <option value="low">Low Demand (Private / Residential)</option>
                <option value="med">Medium Demand (Commercial)</option>
                <option value="high">High Demand (Public / Congested)</option>
              </select>
            </div>
          </div>

          {/* Bulk toolbar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 rounded-xl p-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="text-xs font-bold text-[#06456F] dark:text-sky-400">
                <span className="bg-[#0A7BC7] text-white size-5.5 rounded-full inline-flex items-center justify-center font-mono mr-1.5 text-[10.5px]">{selectedIds.length}</span>
                Zones Selected
              </div>
              <div className="w-px h-5 bg-border"></div>
              <div className="flex items-center gap-2.5 text-xs font-semibold">
                <span className="text-muted-foreground">Batch Standard:</span>
                <select value={bulkStd} onChange={e => setBulkStd(e.target.value)} className="bg-white dark:bg-slate-950 border border-border rounded-lg px-2 py-1 outline-none">
                  <option value="ipc-cold">IPC Cold</option>
                  <option value="ipc-hot">IPC Hot</option>
                  <option value="ipc-total">IPC Total</option>
                  <option value="low">Low Demand</option>
                  <option value="med">Medium Demand</option>
                  <option value="high">High Demand</option>
                </select>
                <button type="button" onClick={handleApplyBulkStd} className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer">Apply to Selected</button>
              </div>
              <button type="button" onClick={() => setSelectedIds([])} className="ml-auto text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline">Deselect All</button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-9 lg:col-span-8 flex flex-col gap-6">
              
              {/* Fixtures quantities schedule card */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-border/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📋 Fixture Quantities (By Space / Area)</h3>
                    {Object.keys(weightOverrides).length > 0 && (
                      <button
                        onClick={() => setWeightOverrides({})}
                        className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full transition-all cursor-pointer"
                        title="Reset custom weights to standard defaults"
                      >
                        ↺ Reset Weights
                      </button>
                    )}
                  </div>
                  <button type="button" onClick={() => setFuSpaces([])} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer border-0 bg-transparent">🗑 Clear All Spaces</button>
                </div>

                {/* Table for Adding/Editing spaces */}
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-[11.5px] font-sans">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th rowSpan={2} className="p-2 text-center w-8">
                          <input type="checkbox" checked={selectedIds.length === fuSpaces.length && fuSpaces.length > 0} onChange={e => handleToggleSelectAll(e.target.checked)} className="size-3.5 accent-orange-500 cursor-pointer" />
                        </th>
                        <th rowSpan={2} className="p-2 text-left min-w-[140px]">Description</th>
                        <th rowSpan={2} className="p-2 text-left w-24">Standard</th>
                        {FU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-2 text-center w-12 text-[11px] font-bold">{f.short}</th>
                        ))}
                        <th rowSpan={2} className="p-2 text-center w-16 bg-[#0A7BC7]/5 text-[#0A7BC7] font-bold" title="Unit WSFU for 1 space">WSFU</th>
                        <th rowSpan={2} className="p-2 text-center w-16 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold" title="Quantity of spaces">Space Qty</th>
                        <th rowSpan={2} className="p-2 text-center w-20 bg-[#0A7BC7]/10 text-[#0A7BC7] font-bold" title="Total = Unit WSFU × Space Qty">TOTAL WSFU</th>
                        <th rowSpan={2} className="p-2 text-center w-8"></th>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                        {FU_FIXTURES_META.map(f => {
                          const currentVal = weightOverrides[f.id] !== undefined ? weightOverrides[f.id] : (IP_FIXTURE_UNITS[f.id]?.[headerStd] ?? "");
                          return (
                            <th key={f.id} className="p-1 px-0.5 text-center font-bold bg-[#0A7BC7]/5">
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                value={currentVal}
                                onChange={(e) => {
                                  const val = e.target.value !== "" ? Number(e.target.value) : 0;
                                  setWeightOverrides(prev => ({ ...prev, [f.id]: val }));
                                }}
                                className="w-12 text-center bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded text-[#0A7BC7] font-extrabold text-[11.5px] py-0.5 outline-none focus:ring-2 focus:ring-[#0A7BC7]"
                                title={`Edit weight for ${f.short} (Click to change)`}
                              />
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="bg-blue-50/40/30 dark:bg-orange-950/10 border-b border-border/70 border-dashed">
                      <tr className="bg-blue-50/40/30 dark:bg-orange-950/10 border-b border-border/70 border-dashed">
                        <td className="p-2 text-center font-extrabold text-[#0A7BC7] text-[15px]">+</td>
                        <td className="p-1.5">
                          <input type="text" placeholder="e.g. 1F Washroom" value={newDesc} onChange={e => setNewDesc(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md px-2 py-1 outline-none focus:border-[#0A7BC7]" />
                        </td>
                        <td className="p-1.5">
                          <select value={newStd} onChange={e => setNewStd(e.target.value)} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md px-1.5 py-1 outline-none">
                            <option value="ipc-cold">IPC Cold</option>
                            <option value="ipc-hot">IPC Hot</option>
                            <option value="ipc-total">IPC Total</option>
                          </select>
                        </td>
                        {FU_FIXTURES_META.map(f => (
                          <td key={f.id} className="p-1">
                            <input type="number" min="0" placeholder="-" value={newFixtures[f.id] || ""} onChange={e => setNewFixtures({ ...newFixtures, [f.id]: e.target.value !== "" ? Number(e.target.value) : 0 })} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center outline-none" />
                          </td>
                        ))}
                        <td className="p-2 text-right font-bold text-[#0A7BC7] font-mono">-</td>
                        <td className="p-2 text-center">
                          <button onClick={handleAddSpace} className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-2 py-1 rounded font-bold transition-all cursor-pointer border-0">Done</button>
                        </td>
                      </tr>
                    </tbody>
                    {/* Sizing Rows */}
                    {fuSpaces.length === 0 ? (
                      <tbody>
                        <tr>
                          <td colSpan={FU_FIXTURES_META.length + 5} className="p-8 text-center text-muted-foreground italic">No spaces added. Add one above.</td>
                        </tr>
                      </tbody>
                    ) : (
                      Object.keys(floorsGrouped).map(floor => (
                        <tbody key={floor}>
                          {/* Floor Header row */}
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-foreground font-bold select-none text-[11px]">
                            <td colSpan={FU_FIXTURES_META.length + 5} className="p-1.5 px-3">📍 Floor: {floor}</td>
                          </tr>
                          {floorsGrouped[floor].map(s => (
                            <tr key={s.id} className="border-b border-border/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                              <td className="p-2 text-center">
                                <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={e => handleToggleSelect(s.id, e.target.checked)} className="size-3.5 accent-orange-500 cursor-pointer" />
                              </td>
                              <td className="p-1.5">
                                <input type="text" value={s.desc} onChange={e => handleSpaceChange(s.id, "desc", e.target.value)} className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded" />
                              </td>
                              <td className="p-1.5">
                                <select value={s.std} onChange={e => handleSpaceChange(s.id, "std", e.target.value)} className="w-full bg-transparent border-0 outline-none cursor-pointer focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded">
                                  <option value="ipc-cold">IPC Cold</option>
                                  <option value="ipc-hot">IPC Hot</option>
                                  <option value="ipc-total">IPC Total</option>
                                </select>
                              </td>
                              {FU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1">
                                  <input type="number" min="0" value={s.fixtures[f.id] || ""} onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" />
                                </td>
                              ))}
                              <td className="p-2 text-right font-mono font-bold text-[#0A7BC7]">{(calculations.spaceTotals[s.id] || 0).toFixed(1)}</td>
                              <td className="p-2 text-center">
                                <button onClick={() => setFuSpaces(fuSpaces.filter(x => x.id !== s.id))} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 dark:hover:bg-red-950/20 rounded cursor-pointer transition-colors border-0 bg-transparent">
                                  <Trash2 className="size-3.5" />
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

              {/* Detailed Sizing Steps */}
              <div className="bg-card border border-border rounded-2xl shadow-xs">
                <button type="button" onClick={() => setExpandDetails(!expandDetails)} className="w-full px-5 py-4 flex items-center justify-between border-0 bg-transparent text-left cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">Σ Detailed Calculations</span>
                  </div>
                  {expandDetails ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>
                {expandDetails && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/40 flex flex-col gap-3 text-xs font-sans">
                    {calculations.detailedSteps.length === 0 ? (
                      <span className="text-muted-foreground italic">No detailed calculations available yet. Add spaces above.</span>
                    ) : (
                      calculations.detailedSteps.map((s, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-border/50">
                          <div className="font-bold text-foreground mb-1">{s.title}</div>
                          <div className="font-mono text-muted-foreground break-all">{s.expr}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Assumptions & Basis */}
              <div className="bg-card border border-border rounded-2xl shadow-xs">
                <button type="button" onClick={() => setExpandAssumptions(!expandAssumptions)} className="w-full px-5 py-4 flex items-center justify-between border-0 bg-transparent text-left cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">ℹ Assumptions & Basis</span>
                  </div>
                  {expandAssumptions ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
                </button>
                {expandAssumptions && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/40 text-xs font-sans text-muted-foreground flex flex-col gap-2.5">
                    <div className="flex gap-2">
                      <span className="text-[#0A7BC7] font-bold">•</span>
                      <span>Sizing is based on the Water Supply Fixture Units (WSFU) methodology.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#0A7BC7] font-bold">•</span>
                      <span>Standards options support IPC Cold, IPC Hot, or IPC Total loadings.</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#0A7BC7] font-bold">•</span>
                      <span>Probable peak flow rate conversion is derived from the Curve Fit Polynomial matching the Hunter's curve chart data up to 5,000 WSFUs.</span>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* Sizing Results sidebar */}
            <div className="xl:col-span-3 lg:col-span-4 flex flex-col gap-5">
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs sticky top-4">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                </div>

                <div className="flex flex-col gap-3 font-sans text-xs">
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Total Fixture Units</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.totalWSFU.toFixed(1)} WSFU</strong>
                  </div>
                  <div className="flex justify-between items-center py-2.5 border-t border-border/60 mt-1 col-span-2">
                    <span className="font-bold text-foreground uppercase text-[11px] tracking-wide">Probable Peak Flow</span>
                    <strong className="font-extrabold text-[#0A7BC7] text-[16px] font-mono">{calculations.displayFlow}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 border-b border-border/40">
                    <span className="font-semibold text-muted-foreground">Applied Sizing standard</span>
                    <span className="font-semibold text-foreground">IPC Polynomial Method</span>
                  </div>
                </div>

                <div className="bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#06456F] dark:text-sky-300 rounded-xl p-3.5 flex gap-2.5 text-[11px] font-sans">
                  <Info className="size-4 shrink-0 mt-0.5 text-[#0A7BC7]" />
                  <span>The fixture values are automatically synced with downstream sizing schedules (e.g. Booster Pump, Transfer Pump, Storage Tanks).</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppShell>
  );
}

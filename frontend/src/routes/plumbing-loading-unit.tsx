import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Trash2, Save, Info, Sparkles, Plus, Building2, Copy, Edit3, CheckSquare, Square, X } from "lucide-react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-loading-unit")({
  head: () => ({
    meta: [
      { title: "Loading Unit & Pipe Sizer — MEP Calc" },
      { name: "description", content: "Dubai (DBC / BS EN 806 / CIBSE), Abu Dhabi (ADM), and IPC/UPC Plumbing Loading Unit & Pipe Sizing Calculator." },
    ],
  }),
  component: LoadingUnitPage,
});

export type StandardPreset = "dubai" | "abudhabi" | "ipc_upc";

interface LUSpace {
  id: number;
  desc: string;
  floor: string;
  qty: number;
  std: "low" | "med" | "high";
  fixtures: Record<string, number>;
}

// Standards Fixture Weight Mappings
export const STANDARD_FIXTURE_WEIGHTS: Record<StandardPreset, Record<string, number>> = {
  // 🇦🇪 Dubai Standard (DBC 2021 / BS EN 806-3 / CIBSE Guide G)
  dubai: {
    wc_tank: 2.0,
    wc_valve: 28.0,
    basin: 1.5,
    handspray: 1.5,
    shower: 3.0,
    bath: 10.0,
    sink: 3.0,
    washer: 3.0,
    dishwasher: 3.0,
    servicesink: 3.0,
    bibtap: 3.0,
  },
  // 🇦🇪 Abu Dhabi Standard (ADM Table 6-7 / Table 6-9 - Matching P539B Excel)
  abudhabi: {
    wc_tank: 2.5,
    wc_valve: 5.0,
    basin: 1.0,
    handspray: 1.0,
    shower: 2.0,
    bath: 1.4,
    sink: 1.5,
    washer: 3.0,
    dishwasher: 1.5,
    servicesink: 3.0,
    bibtap: 2.5,
  },
  // 🌐 International IPC / UPC Standard (WSFU)
  ipc_upc: {
    wc_tank: 2.5,
    wc_valve: 5.0,
    basin: 0.75,
    handspray: 1.0,
    shower: 1.5,
    bath: 1.4,
    sink: 1.125,
    washer: 1.0,
    dishwasher: 1.4,
    servicesink: 2.25,
    bibtap: 2.5,
  }
};

export const LU_FIXTURES_META = [
  { id: 'wc_tank', short: 'W/C (Tank)' },
  { id: 'wc_valve', short: 'W/C (Valve)' },
  { id: 'handspray', short: 'Shattaf/Spray' },
  { id: 'basin', short: 'Basin' },
  { id: 'sink', short: 'Kit. Sink' },
  { id: 'shower', short: 'Shower' },
  { id: 'bath', short: 'Bathtub' },
  { id: 'washer', short: 'Washer' },
  { id: 'dishwasher', short: 'Dishwasher' },
  { id: 'servicesink', short: 'Service Sink' },
  { id: 'bibtap', short: 'Hose Bibb' }
];

// UPC Abu Dhabi Table 6-9 Lookup Table (WSFU -> L/min)
const ADM_TABLE_6_9 = [
  { wsfu: 1, lmin: 0 },
  { wsfu: 2, lmin: 3.8 },
  { wsfu: 3, lmin: 11 },
  { wsfu: 4, lmin: 15 },
  { wsfu: 5, lmin: 19 },
  { wsfu: 6, lmin: 23 },
  { wsfu: 8, lmin: 25 },
  { wsfu: 10, lmin: 30 },
  { wsfu: 12, lmin: 34 },
  { wsfu: 14, lmin: 42 },
  { wsfu: 16, lmin: 45 },
  { wsfu: 18, lmin: 49 },
  { wsfu: 20, lmin: 53 },
  { wsfu: 25, lmin: 64 },
  { wsfu: 30, lmin: 76 },
  { wsfu: 35, lmin: 87 },
  { wsfu: 40, lmin: 95 },
  { wsfu: 45, lmin: 102 },
  { wsfu: 50, lmin: 110 },
  { wsfu: 60, lmin: 121 },
  { wsfu: 70, lmin: 132 },
  { wsfu: 80, lmin: 144 },
  { wsfu: 90, lmin: 155 },
  { wsfu: 100, lmin: 167 },
  { wsfu: 120, lmin: 182 },
  { wsfu: 140, lmin: 201 },
  { wsfu: 160, lmin: 216 },
  { wsfu: 180, lmin: 231 },
  { wsfu: 200, lmin: 246 },
  { wsfu: 225, lmin: 265 },
  { wsfu: 250, lmin: 284 },
  { wsfu: 275, lmin: 303 },
  { wsfu: 300, lmin: 322 },
  { wsfu: 400, lmin: 397 },
  { wsfu: 500, lmin: 473 },
  { wsfu: 750, lmin: 643 },
  { wsfu: 1000, lmin: 787 },
  { wsfu: 1500, lmin: 1000 },
  { wsfu: 2000, lmin: 1200 },
  { wsfu: 5000, lmin: 2500 }
];

function getFlowLPS(totalLU: number, standard: StandardPreset): number {
  if (totalLU <= 0) return 0;

  if (standard === "abudhabi") {
    // Interpolate using ADM Table 6-9
    for (let i = 0; i < ADM_TABLE_6_9.length - 1; i++) {
      const curr = ADM_TABLE_6_9[i];
      const next = ADM_TABLE_6_9[i + 1];
      if (totalLU >= curr.wsfu && totalLU <= next.wsfu) {
        const lmin = curr.lmin + ((totalLU - curr.wsfu) / (next.wsfu - curr.wsfu)) * (next.lmin - curr.lmin);
        return lmin / 60; // Convert L/min to L/s
      }
    }
    if (totalLU > 5000) return (2500 + (totalLU - 5000) * 0.4) / 60;
    return 0;
  } else if (standard === "dubai") {
    // Dubai Building Code / CIBSE Formula: Q = 0.1 * sqrt(sum LU)
    return 0.1 * Math.sqrt(totalLU);
  } else {
    // IPC/UPC Hunter's Curve approximation
    const gpm = 0.8 * Math.pow(totalLU, 0.65);
    return gpm * 0.06309;
  }
}

// Recommended Pipe Sizing Table (15mm to 200mm)
export const PIPE_SIZING_TABLE = [
  { sizeMM: 15, luMax: 3, flowMax: 0.18 },
  { sizeMM: 20, luMax: 6, flowMax: 0.38 },
  { sizeMM: 25, luMax: 14, flowMax: 0.70 },
  { sizeMM: 32, luMax: 25, flowMax: 1.07 },
  { sizeMM: 40, luMax: 30, flowMax: 1.27 },
  { sizeMM: 50, luMax: 80, flowMax: 2.40 },
  { sizeMM: 65, luMax: 275, flowMax: 5.05 },
  { sizeMM: 80, luMax: 500, flowMax: 7.88 },
  { sizeMM: 100, luMax: 750, flowMax: 10.72 },
  { sizeMM: 150, luMax: 4000, flowMax: 33.12 },
  { sizeMM: 200, luMax: 10000, flowMax: 48.52 }
];

export function getRecommendedPipeSize(lu: number, flowLPS: number): { sizeMM: number; maxFlowLPS: number } {
  for (const entry of PIPE_SIZING_TABLE) {
    if (lu <= entry.luMax || flowLPS <= entry.flowMax) {
      return { sizeMM: entry.sizeMM, maxFlowLPS: entry.flowMax };
    }
  }
  return { sizeMM: 200, maxFlowLPS: 48.52 };
}

function LoadingUnitPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [standardPreset, setStandardPreset] = useState<StandardPreset>("dubai");
  const [iopSpaces, setIopSpaces] = useState<LUSpace[]>([]);
  const [floorSections, setFloorSections] = useState<string[]>(["6th FLOOR"]);
  const [activeFloor, setActiveFloor] = useState<string>("6th FLOOR");

  // Selection states for Bulk Editing
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spaceId: number } | null>(null);

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const [newFixtures, setNewFixtures] = useState<Record<string, number>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_loading_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.standardPreset) setStandardPreset(data.standardPreset);
          if (Array.isArray(data.floorSections)) setFloorSections(data.floorSections);
          if (Array.isArray(data.iopSpaces) && data.iopSpaces.length > 0) {
            setIopSpaces(data.iopSpaces);
            if (data.iopSpaces[0].floor) setActiveFloor(data.iopSpaces[0].floor);
            // Derive floorSections if not present
            if (!data.floorSections) {
              const uniqueFs = Array.from(new Set(data.iopSpaces.map((s: LUSpace) => s.floor || "6th FLOOR")));
              setFloorSections(uniqueFs as string[]);
            }
          }
        } else {
          // Defaults for Dubai Project
          setUnitSystem("si");
          setStandardPreset("dubai");
          setActiveFloor("6th FLOOR");
          setFloorSections(["6th FLOOR"]);
          setIopSpaces([
            {
              id: 1,
              desc: "STUDIO",
              floor: "6th FLOOR",
              qty: 3,
              std: "med",
              fixtures: { wc_tank: 1, handspray: 1, basin: 1, sink: 1, shower: 1, washer: 1, dishwasher: 1 }
            },
            {
              id: 2,
              desc: "1 BHK",
              floor: "6th FLOOR",
              qty: 7,
              std: "med",
              fixtures: { wc_tank: 1, handspray: 1, basin: 1, sink: 1, shower: 1, washer: 1, dishwasher: 1 }
            },
            {
              id: 3,
              desc: "2 BHK",
              floor: "6th FLOOR",
              qty: 4,
              std: "med",
              fixtures: { wc_tank: 2, handspray: 2, basin: 2, sink: 1, shower: 2, washer: 1, dishwasher: 1 }
            }
          ]);
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load loading unit calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        standardPreset,
        iopSpaces
      };
      localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, standardPreset, iopSpaces]);

  // Keyboard Shortcuts for Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedIds.length === 0) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleBulkDelete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, iopSpaces]);

  // Click Outside to Close Context Menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          standardPreset,
          iopSpaces
        };
        localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Loading Unit Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  // Unique list of floors currently in the list
  const existingFloors = useMemo(() => {
    const set = new Set<string>();
    iopSpaces.forEach(s => set.add(s.floor || "6th FLOOR"));
    if (!set.has(activeFloor)) set.add(activeFloor);
    return Array.from(set);
  }, [iopSpaces, activeFloor]);

  // Calculations
  const calculations = useMemo(() => {
    let totalLU = 0;
    const spaceUnitLU: Record<number, number> = {};
    const spaceTotalsLU: Record<number, number> = {};
    const weights = STANDARD_FIXTURE_WEIGHTS[standardPreset];

    iopSpaces.forEach(s => {
      let unitLU = 0;
      LU_FIXTURES_META.forEach(f => {
        const count = s.fixtures[f.id] || 0;
        if (count > 0) {
          const w = weights[f.id] || 0;
          unitLU += count * w;
        }
      });

      const qty = s.qty || 1;
      const spaceTotal = unitLU * qty;

      spaceUnitLU[s.id] = unitLU;
      spaceTotalsLU[s.id] = spaceTotal;
      totalLU += spaceTotal;
    });

    const flowLPS = getFlowLPS(totalLU, standardPreset);
    const flowGPM = flowLPS * 15.8503;
    const selectedFlowLPS = Math.ceil(flowLPS * 2) / 2; // CEILING to nearest 0.5 L/s
    const pipeSizing = getRecommendedPipeSize(totalLU, flowLPS);

    return {
      totalLU,
      spaceUnitLU,
      spaceTotalsLU,
      flowLPS,
      flowGPM,
      selectedFlowLPS,
      pipeSizing,
      displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(3)} L/s`,
      displaySelectedFlow: ip ? `${(selectedFlowLPS * 15.8503).toFixed(1)} GPM` : `${selectedFlowLPS.toFixed(1)} L/s`
    };
  }, [iopSpaces, standardPreset, ip]);

  // Selection Handlers
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(iopSpaces.map(s => s.id));
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

  // Bulk Edit Actions
  const handleBulkMoveFloor = () => {
    if (selectedIds.length === 0) return;
    const newTargetFloor = prompt("Enter target Floor Section for selected space(s):", activeFloor);
    if (newTargetFloor && newTargetFloor.trim()) {
      const cleanFloor = newTargetFloor.trim().toUpperCase();
      setIopSpaces(iopSpaces.map(s => {
        if (selectedIds.includes(s.id)) {
          return { ...s, floor: cleanFloor };
        }
        return s;
      }));
      toast.success(`Moved ${selectedIds.length} space(s) to ${cleanFloor}`);
    }
  };

  const handleBulkEditQty = () => {
    if (selectedIds.length === 0) return;
    const newQtyVal = prompt("Enter new Quantity for selected space(s):", "1");
    if (newQtyVal && !isNaN(Number(newQtyVal))) {
      const qtyNum = Math.max(1, Number(newQtyVal));
      setIopSpaces(iopSpaces.map(s => {
        if (selectedIds.includes(s.id)) {
          return { ...s, qty: qtyNum };
        }
        return s;
      }));
      toast.success(`Updated Qty to ${qtyNum} for ${selectedIds.length} space(s)`);
    }
  };

  const handleBulkDuplicate = () => {
    if (selectedIds.length === 0) return;
    const clones: LUSpace[] = [];
    iopSpaces.forEach(s => {
      if (selectedIds.includes(s.id)) {
        clones.push({
          ...s,
          id: Date.now() + Math.random(),
          desc: `${s.desc} (Copy)`
        });
      }
    });
    setIopSpaces([...iopSpaces, ...clones]);
    toast.success(`Duplicated ${clones.length} space(s)`);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setIopSpaces(iopSpaces.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
    toast.info(`Deleted ${count} space(s)`);
  };

  // Handlers
  const handleAddSpaceToFloor = (floorTarget: string) => {
    if (!newDesc.trim()) {
      toast.error("Please enter a space description (e.g. 1 BHK)");
      return;
    }
    const fixturesCleaned: Record<string, number> = {};
    LU_FIXTURES_META.forEach(f => {
      const q = newFixtures[f.id] || 0;
      if (q > 0) fixturesCleaned[f.id] = q;
    });

    setIopSpaces([...iopSpaces, {
      id: Date.now(),
      desc: newDesc.trim(),
      floor: floorTarget,
      qty: Math.max(1, newQty || 1),
      std: "med",
      fixtures: fixturesCleaned
    }]);

    setNewDesc("");
    setNewQty(1);
    setNewFixtures({});
    toast.success(`Added space to ${floorTarget}`);
  };

  const handleAddNewFloorSection = () => {
    const nextNum = floorSections.length + 6;
    const cleanName = `${nextNum}th FLOOR`;
    if (!floorSections.includes(cleanName)) {
      setFloorSections([...floorSections, cleanName]);
    }
    setActiveFloor(cleanName);
    toast.success(`Created ${cleanName} section. You can now add spaces to it.`);
  };

  const handleRenameFloorGroup = (oldFloorName: string, newFloorName: string) => {
    const clean = newFloorName.trim();
    if (!clean || clean === oldFloorName) return;
    setFloorSections(floorSections.map(f => f === oldFloorName ? clean : f));
    setIopSpaces(iopSpaces.map(s => {
      if ((s.floor || "6th FLOOR") === oldFloorName) {
        return { ...s, floor: clean };
      }
      return s;
    }));
    if (activeFloor === oldFloorName) {
      setActiveFloor(clean);
    }
  };

  const handleDeleteFloorGroup = (floorToDelete: string) => {
    if (confirm(`Delete floor section ${floorToDelete} and all its spaces?`)) {
      setFloorSections(floorSections.filter(f => f !== floorToDelete));
      setIopSpaces(iopSpaces.filter(s => s.floor !== floorToDelete));
      toast.info(`Deleted ${floorToDelete} section`);
    }
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, val: number) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          fixtures: {
            ...s.fixtures,
            [fixtureId]: Math.max(0, val)
          }
        };
      }
      return s;
    }));
  };

  const handleSpaceDescChange = (spaceId: number, val: string) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          desc: val
        };
      }
      return s;
    }));
  };

  const handleQtyChange = (spaceId: number, val: number) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          qty: Math.max(1, val)
        };
      }
      return s;
    }));
  };

  // Right Click Handler
  const handleContextMenu = (e: React.MouseEvent, spaceId: number) => {
    e.preventDefault();
    if (!selectedIds.includes(spaceId)) {
      setSelectedIds([spaceId]);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, spaceId });
  };

  // Helper to convert 1-based col number to Excel column letter (e.g. 1 -> A, 14 -> N)
  const getColLetter = (colIdx: number): string => {
    let temp = "";
    let letter = "";
    while (colIdx > 0) {
      temp = (colIdx - 1) % 26;
      letter = String.fromCharCode(65 + temp) + letter;
      colIdx = Math.floor((colIdx - temp - 1) / 26);
    }
    return letter;
  };

  // Excel Export matching P539B Excel Sheet Format
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheetName = standardPreset === "abudhabi" 
        ? "COLD WATER LOADING UNIT B" 
        : standardPreset === "dubai" 
        ? "COLD WATER LOADING UNIT D" 
        : "COLD WATER LOADING UNIT I";
      
      const sheet = workbook.addWorksheet(sheetName);

      const activeFixtures = LU_FIXTURES_META;
      const numFixtures = activeFixtures.length; // 11
      const totalCols = 1 + numFixtures + 3; // 1 (Desc) + 11 (Fixtures) + 1 (WSFU/LU) + 1 (Qty) + 1 (TOTAL WSFU/LU) = 15 columns (A to O)
      const lastColLetter = getColLetter(totalCols);

      const currentWeights = STANDARD_FIXTURE_WEIGHTS[standardPreset];
      const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc";
      const unitLabel = isWsfu ? "WSFU" : "LU";

      // 1. Column Widths matching P539B
      sheet.getColumn(1).width = 25; // Description
      for (let c = 2; c <= 1 + numFixtures; c++) {
        sheet.getColumn(c).width = 13; // Fixtures
      }
      sheet.getColumn(1 + numFixtures + 1).width = 13; // LU per Space
      sheet.getColumn(1 + numFixtures + 2).width = 11; // Space Qty
      sheet.getColumn(1 + numFixtures + 3).width = 14; // TOTAL LU

      // Helper styles
      const fontCambria11Bold = { name: "Cambria", size: 11, bold: true };
      const fontCambria11 = { name: "Cambria", size: 11, bold: false };
      const fontCambria10Bold = { name: "Cambria", size: 10, bold: true };
      const fillHeader = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEFECE1" } };
      const fillBanner = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2DCDB" } };
      const fillPeach = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDEBDA" } };

      const borderThinAll: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      };

      // 2. Fetch Project Metadata (matching Ventilation Calculation)
      const activeProj: any = workspaceStore.getState()?.project || project || {};
      const projectNo = activeProj.code || activeProj.project_number || activeProj.projectNumber || 'P539';
      const calcNo = activeProj.calcNo || activeProj.calc_number || `CEC-MED-${projectNo}-202   Rev. No:1`;
      const today = new Date().toLocaleDateString('en-GB');
      const projectName = activeProj.name || activeProj.project_name || activeProj.projectName || '';
      const clientName = activeProj.client || activeProj.client_name || activeProj.clientName || '';
      const endUser = activeProj.endUser || activeProj.end_user || activeProj.location || '';

      // Title Row (Row 2)
      sheet.getRow(2).height = 26;
      sheet.getCell("A2").value = "Loading Unit & Pipe Sizing Calculation";
      sheet.getCell("A2").font = { name: "Cambria", size: 16, bold: true };

      // Metadata Header Box (Rows 4-6)
      const splitColIndex = Math.max(6, Math.floor(totalCols / 2));
      const splitColLetter = getColLetter(splitColIndex);
      const splitColPlusLetter = getColLetter(splitColIndex + 1);

      // Row 4
      sheet.mergeCells(`A4:${splitColLetter}4`);
      sheet.mergeCells(`${splitColPlusLetter}4:${lastColLetter}4`);
      sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
      sheet.getCell(`${splitColPlusLetter}4`).value = `Date:   ${today}`;

      // Row 5
      sheet.mergeCells(`A5:${splitColLetter}5`);
      sheet.mergeCells(`${splitColPlusLetter}5:${lastColLetter}5`);
      sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
      sheet.getCell(`${splitColPlusLetter}5`).value = `Client:   ${clientName}`;

      // Row 6
      sheet.mergeCells(`A6:${splitColLetter}6`);
      sheet.mergeCells(`${splitColPlusLetter}6:${lastColLetter}6`);
      sheet.getCell("A6").value = `Project Name:   ${projectName}`;
      sheet.getCell(`${splitColPlusLetter}6`).value = `End User:   ${endUser}`;

      // Style Rows 4-6
      for (let r = 4; r <= 6; r++) {
        sheet.getRow(r).height = 22;
        for (let c = 1; c <= totalCols; c++) {
          const cell = sheet.getCell(r, c);
          cell.font = fontCambria11Bold;
          const topStyle = r === 4 ? "medium" : "thin";
          const bottomStyle = r === 6 ? "medium" : "thin";
          const leftStyle = (c === 1 || c === splitColIndex + 1) ? "medium" : "thin";
          const rightStyle = (c === totalCols || c === splitColIndex) ? "medium" : "thin";

          cell.border = {
            top: { style: topStyle },
            bottom: { style: bottomStyle },
            left: { style: leftStyle },
            right: { style: rightStyle }
          };
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      }

      // 3. Table Header Rows (Rows 8 & 9)
      sheet.getRow(8).height = 43;
      sheet.getRow(9).height = 30;

      // Col A: Description (A8:A9)
      sheet.mergeCells("A8:A9");
      sheet.getCell("A8").value = "Description";

      // Fixtures: Row 8 (Name), Row 9 (Weight)
      activeFixtures.forEach((f, idx) => {
        const colIdx = 2 + idx;
        const colLet = getColLetter(colIdx);
        sheet.getCell(`${colLet}8`).value = f.short;
        sheet.getCell(`${colLet}9`).value = currentWeights[f.id] || 0;
      });

      // LU / WSFU per Space
      const luColIdx = 2 + numFixtures;
      const luColLet = getColLetter(luColIdx);
      sheet.mergeCells(`${luColLet}8:${luColLet}9`);
      sheet.getCell(`${luColLet}8`).value = isWsfu ? "WSFU" : "LU per Space";

      // Space Qty
      const qtyColIdx = luColIdx + 1;
      const qtyColLet = getColLetter(qtyColIdx);
      sheet.mergeCells(`${qtyColLet}8:${qtyColLet}9`);
      sheet.getCell(`${qtyColLet}8`).value = "Space Qty";

      // TOTAL LU / WSFU
      const totalLUColIdx = qtyColIdx + 1;
      const totalLUColLet = getColLetter(totalLUColIdx);
      sheet.mergeCells(`${totalLUColLet}8:${totalLUColLet}9`);
      sheet.getCell(`${totalLUColLet}8`).value = isWsfu ? "TOTAL WSFU" : "TOTAL LU";

      // Style Header Rows 8 & 9
      [8, 9].forEach(r => {
        for (let c = 1; c <= totalCols; c++) {
          const cell = sheet.getCell(r, c);
          cell.font = fontCambria11Bold;
          cell.fill = fillHeader;
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = {
            top: r === 8 ? { style: "medium" } : { style: "thin" },
            bottom: r === 9 ? { style: "medium" } : { style: "thin" },
            left: c === 1 ? { style: "medium" } : { style: "thin" },
            right: c === totalCols ? { style: "medium" } : { style: "thin" },
          };
        }
      });

      // 4. Data Rows (Grouped by Floor Section)
      let r = 10;
      const firstFixColLet = "B";
      const lastFixColLet = getColLetter(1 + numFixtures);

      const spaceTotalCellRefs: string[] = [];

      // Determine unique floors from iopSpaces or floorSections
      const activeFloors = floorSections.length > 0 ? floorSections : Array.from(new Set(iopSpaces.map(s => s.floor || "6th FLOOR")));

      activeFloors.forEach(flName => {
        const floorSpaces = iopSpaces.filter(s => (s.floor || activeFloors[0]) === flName);
        if (floorSpaces.length === 0) return;

        // Floor Section Header Banner Row
        sheet.getRow(r).height = 25;
        sheet.mergeCells(`A${r}:${lastColLetter}${r}`);
        const bannerCell = sheet.getCell(`A${r}`);
        bannerCell.value = flName.toUpperCase();
        bannerCell.font = fontCambria11Bold;
        bannerCell.fill = fillBanner;
        bannerCell.alignment = { vertical: "middle", horizontal: "center" };

        for (let c = 1; c <= totalCols; c++) {
          sheet.getCell(r, c).border = {
            top: { style: "medium" },
            bottom: { style: "medium" },
            left: c === 1 ? { style: "medium" } : { style: "thin" },
            right: c === totalCols ? { style: "medium" } : { style: "thin" },
          };
        }
        r++;

        // Space Data Rows
        floorSpaces.forEach(s => {
          sheet.getRow(r).height = 25;

          // Col A: Description
          const cellA = sheet.getCell(`A${r}`);
          cellA.value = s.desc;
          cellA.font = fontCambria11;
          cellA.alignment = { vertical: "middle", horizontal: "left" };
          cellA.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

          // Fixture Counts
          activeFixtures.forEach((f, idx) => {
            const colIdx = 2 + idx;
            const cell = sheet.getCell(r, colIdx);
            const count = s.fixtures[f.id] || 0;
            if (count > 0) cell.value = count;
            cell.font = fontCambria11Bold;
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.numFmt = "0";
            cell.border = borderThinAll;
          });

          // Unit LU Formula: =SUMPRODUCT(B10:L10, $B$9:$L$9)
          const luCell = sheet.getCell(`${luColLet}${r}`);
          luCell.value = { formula: `SUMPRODUCT(${firstFixColLet}${r}:${lastFixColLet}${r},$${firstFixColLet}$9:$${lastFixColLet}$9)` };
          luCell.font = fontCambria11Bold;
          luCell.alignment = { vertical: "middle", horizontal: "center" };
          luCell.numFmt = "0.0";
          luCell.border = borderThinAll;

          // Space Qty
          const qtyCell = sheet.getCell(`${qtyColLet}${r}`);
          qtyCell.value = s.qty || 1;
          qtyCell.font = fontCambria11Bold;
          qtyCell.alignment = { vertical: "middle", horizontal: "center" };
          qtyCell.numFmt = "0";
          qtyCell.border = borderThinAll;

          // Total LU Formula: =L7*M7
          const totalLUCell = sheet.getCell(`${totalLUColLet}${r}`);
          totalLUCell.value = { formula: `${luColLet}${r}*${qtyColLet}${r}` };
          totalLUCell.font = fontCambria11Bold;
          totalLUCell.alignment = { vertical: "middle", horizontal: "center" };
          totalLUCell.numFmt = "0.0";
          totalLUCell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "medium" } };

          spaceTotalCellRefs.push(`${totalLUColLet}${r}`);
          r++;
        });
      });

      // 5. Grand Total Row
      const grandTotalRow = r;
      sheet.getRow(grandTotalRow).height = 25;

      for (let c = 1; c <= totalCols; c++) {
        const cell = sheet.getCell(grandTotalRow, c);
        cell.border = {
          top: { style: "medium" },
          bottom: { style: "medium" },
          left: c === 1 ? { style: "medium" } : { style: "thin" },
          right: c === totalCols ? { style: "medium" } : { style: "thin" },
        };
      }

      const grandTotalCell = sheet.getCell(`${totalLUColLet}${grandTotalRow}`);
      grandTotalCell.value = spaceTotalCellRefs.length > 0 ? { formula: `SUM(${spaceTotalCellRefs.join(",")})` } : 0;
      grandTotalCell.font = { name: "Cambria", size: 11, bold: true, color: { argb: "FFFF0000" } }; // Red font in template
      grandTotalCell.fill = fillHeader;
      grandTotalCell.alignment = { vertical: "middle", horizontal: "center" };
      grandTotalCell.numFmt = "0.0";
      r++;

      // Spacer
      r++;

      // 6. Sizing & Booster Pump Summary Block
      sheet.getRow(r).height = 25;
      sheet.mergeCells(`A${r}:B${r}`);
      const appCell = sheet.getCell(`A${r}`);
      appCell.value = standardPreset === "abudhabi" 
        ? "MEDIUM FREQUENCY APPLICATION" 
        : standardPreset === "dubai" 
        ? "BUILDING WATER DEMAND (DBC / BS EN 806)" 
        : "INTERNATIONAL PLUMBING CODE DEMAND";
      appCell.font = fontCambria11Bold;
      appCell.alignment = { vertical: "middle", horizontal: "center" };
      appCell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = "No of Booster Pump    ";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };
      
      sheet.getCell(`B${r}`).value = "1W+1A+\n1S";
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = `Total Water Supply Fixture Units (${unitLabel})`;
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = { formula: `${totalLUColLet}${grandTotalRow}` };
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.0";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 24;
      const flowRow = r;
      sheet.getCell(`A${r}`).value = "Flow due to loading unit (l/s)";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = Number(calculations.flowLPS.toFixed(3));
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.000";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = "Total Water demand considered (l/s)";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = { formula: `CEILING(B${flowRow},0.5)` };
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.0";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 23;
      sheet.getCell(`A${r}`).value = "Diversity (if any)";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = "";
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = "Selected Water Flow Rate (Q) L/s";
      sheet.getCell(`A${r}`).font = fontCambria10Bold;
      sheet.getCell(`A${r}`).fill = fillHeader;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = { formula: `CEILING(B${flowRow},0.5)` };
      sheet.getCell(`B${r}`).font = fontCambria10Bold;
      sheet.getCell(`B${r}`).fill = fillHeader;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.0";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      // Spacer
      r++;

      // 7. Signature Block
      let currentUserName = "";
      if (typeof window !== "undefined") {
        try {
          const user = JSON.parse(localStorage.getItem('mep_user') || '{}');
          const profile = JSON.parse(localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile') || '{}');
          currentUserName = user.name || user.user?.name || profile.name || profile.user?.name || (window as any).currentMepUserName || "";
        } catch (e) {}
      }

      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails((project as any)?.id || "default", "/plumbing-loading-unit", currentUserName);

      // Header row
      sheet.getRow(r).height = 22;
      sheet.getCell(`A${r}`).value = "";
      sheet.getCell(`A${r}`).border = { top: { style: "medium" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.getCell(`B${r}`).value = "Originated by";

      sheet.mergeCells(`F${r}:G${r}`);
      sheet.getCell(`F${r}`).value = "Reviewed by";

      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);
      sheet.getCell(`H${r}`).value = "Approved by";

      [ `B${r}`, `F${r}`, `H${r}` ].forEach(cellRef => {
        const c = sheet.getCell(cellRef);
        c.font = fontCambria11Bold;
        c.fill = fillPeach;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "medium" }, bottom: { style: "thin" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }
      r++;

      // Name row
      sheet.getRow(r).height = 20;
      sheet.getCell(`A${r}`).value = "Name:";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.getCell(`B${r}`).value = originatedName;

      sheet.mergeCells(`F${r}:G${r}`);
      sheet.getCell(`F${r}`).value = reviewerName;

      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);
      sheet.getCell(`H${r}`).value = approverName;

      [ `B${r}`, `F${r}`, `H${r}` ].forEach(cellRef => {
        const c = sheet.getCell(cellRef);
        c.font = fontCambria11Bold;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }
      r++;

      // Signature row
      sheet.getRow(r).height = 22;
      sheet.getCell(`A${r}`).value = "Signature:";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.mergeCells(`F${r}:G${r}`);
      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);

      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }
      r++;

      // Date row
      sheet.getRow(r).height = 24;
      sheet.getCell(`A${r}`).value = "Date:";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.getCell(`B${r}`).value = originatedDate;

      sheet.mergeCells(`F${r}:G${r}`);
      sheet.getCell(`F${r}`).value = reviewerDate;

      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);
      sheet.getCell(`H${r}`).value = approverDate;

      [ `B${r}`, `F${r}`, `H${r}` ].forEach(cellRef => {
        const c = sheet.getCell(cellRef);
        c.font = fontCambria11;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }

      // Buffer & Download
      const xlsxBuffer = await workbook.xlsx.writeBuffer();
      downloadFile(new Uint8Array(xlsxBuffer), `Loading_Unit_Calculation_${standardPreset.toUpperCase()}.xlsx`, "Excel Document", ["xlsx"]);
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel export.");
    }
  };

  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    const grouped: Record<string, LUSpace[]> = {};
    floorSections.forEach(fl => {
      grouped[fl] = [];
    });
    iopSpaces.forEach(s => {
      const fl = s.floor || "6th FLOOR";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [iopSpaces, floorSections]);

  const activeWeights = STANDARD_FIXTURE_WEIGHTS[standardPreset];
  const allSelected = selectedIds.length === iopSpaces.length && iopSpaces.length > 0;

  return (
    <AppShell title="Loading Unit Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6 animate-in fade-in-50 duration-200">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 select-none">
            <div className="flex flex-col gap-1 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; LOADING UNIT SIZER</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="size-3" /> Dubai Building Code Ready
                </span>
              </div>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground mt-0.5">Loading Unit & Pipe Sizer</h1>
              <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5">
                Calculate Loading Units (LU / WSFU), peak demand flow rates, booster pump sizing, and recommended supply pipe diameters.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-start md:justify-end mt-1 md:mt-0">
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-[12px] sm:text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-xs"
              >
                📊 Export Excel
              </button>
              <button
                onClick={handleSaveCurrent}
                className="flex items-center gap-2 bg-[#0A7BC7] hover:bg-[#06456F] text-white rounded-xl px-3.5 py-2 text-[12px] sm:text-[12.5px] font-bold transition-all border-0 cursor-pointer shadow-xs"
              >
                <Save className="size-4" /> Save Calculation
              </button>
            </div>
          </div>

          {/* Standard & Unit System Selector Header */}
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center bg-slate-100 dark:bg-slate-900/60 p-2.5 sm:p-3 border border-border rounded-2xl gap-3 shadow-xs">
            <div className="flex items-center gap-2 w-full sm:w-auto min-w-0 flex-wrap">
              <span className="text-xs font-bold text-foreground shrink-0 uppercase tracking-wide">Standard Preset:</span>
              <select
                value={standardPreset}
                onChange={(e) => setStandardPreset(e.target.value as StandardPreset)}
                className="bg-white dark:bg-slate-950 border border-border text-foreground text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#0A7BC7] cursor-pointer flex-1 sm:flex-initial min-w-[240px]"
              >
                <option value="dubai">🇦🇪 Dubai Standard (DBC 2021 / BS EN 806 / CIBSE)</option>
                <option value="abudhabi">🇦🇪 Abu Dhabi Standard (ADM Table 6-7 & 6-9)</option>
                <option value="ipc_upc">🌐 International IPC / UPC (WSFU)</option>
              </select>
            </div>

            <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-xl gap-1 select-none shrink-0 self-start sm:self-auto">
              <button type="button" onClick={() => setUnitSystem("si")} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${!ip ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>Metric (SI)</button>
              <button type="button" onClick={() => setUnitSystem("ip")} className={`px-3 py-1 text-xs font-bold rounded-lg transition-all duration-150 cursor-pointer ${ip ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"}`}>Imperial (IP)</button>
            </div>
          </div>

          {/* Bulk Action Toolbar Bar (Visible when items selected) */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#0A7BC7]/10 border border-[#0A7BC7]/30 text-foreground p-2.5 sm:p-3 rounded-2xl animate-in fade-in duration-150 shadow-xs gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#0A7BC7] text-white font-extrabold px-2.5 py-0.5 rounded-full text-xs font-mono">
                  {selectedIds.length} Selected
                </span>
                <span className="text-xs font-bold text-[#0A7BC7]">Bulk Actions:</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
                <button
                  onClick={handleBulkMoveFloor}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  🏢 Move Floor
                </button>
                <button
                  onClick={handleBulkEditQty}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Edit3 className="size-3.5" /> Edit Qty
                </button>
                <button
                  onClick={handleBulkDuplicate}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border-0"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer border-0 bg-transparent ml-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 min-w-0 flex flex-col gap-6">
              
              {/* Fixtures quantities schedule card */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs min-w-0">
                
                {/* Header bar with Floor Section Creator */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📋 Fixture Schedule (Grouped By Floor)</h3>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button
                      onClick={handleAddNewFloorSection}
                      className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="size-3.5" /> Add Floor Section
                    </button>
                    <button type="button" onClick={() => setIopSpaces([])} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer border-0 bg-transparent">🗑 Clear All</button>
                  </div>
                </div>

                {/* Table for Adding/Editing spaces */}
                <div className="overflow-x-auto border border-border rounded-xl w-full custom-scrollbar">
                  <table className="w-full min-w-[760px] border-collapse text-[11.5px] font-sans select-none">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800/80 border-b border-border text-foreground font-semibold">
                        <th rowSpan={2} className="p-2 text-center w-8">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => handleToggleSelectAll(e.target.checked)}
                            className="size-3.5 accent-[#0A7BC7] cursor-pointer rounded"
                          />
                        </th>
                        <th rowSpan={2} className="p-2 text-left min-w-[150px]">Description</th>
                        <th rowSpan={2} className="p-2 text-center w-16 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold">Qty</th>
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-2 text-center w-12">{f.short}</th>
                        ))}
                        <th rowSpan={2} className="p-2 text-center w-24 bg-[#0A7BC7]/5 text-[#0A7BC7] font-bold">TOTAL L.U</th>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-1 px-1.5 text-center font-bold text-[#0A7BC7]/90 bg-[#0A7BC7]/5">{activeWeights[f.id]}</th>
                        ))}
                      </tr>
                    </thead>

                    {/* Floor Section Blocks */}
                    {Object.keys(floorsGrouped).map(floor => (
                      <tbody key={floor} className="border-b border-border/80">
                        
                        {/* Floor Section Header */}
                        <tr className="bg-slate-100 dark:bg-slate-900 border-b border-border text-foreground font-bold text-[11.5px]">
                          <td colSpan={LU_FIXTURES_META.length + 4} className="p-2 px-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Building2 className="size-4 text-[#0A7BC7]" />
                                <span className="text-muted-foreground uppercase text-[10.5px]">Floor Section:</span>
                                <input
                                  type="text"
                                  value={floor}
                                  onChange={(e) => handleRenameFloorGroup(floor, e.target.value)}
                                  className="bg-white dark:bg-slate-950 border border-border rounded px-2.5 py-0.5 font-extrabold text-[#0A7BC7] outline-none focus:ring-1 focus:ring-[#0A7BC7] text-xs uppercase"
                                  placeholder="Floor Name"
                                />
                                <span className="text-[10px] font-semibold text-muted-foreground">({floorsGrouped[floor].length} space types)</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleDeleteFloorGroup(floor)}
                                  className="text-red-500 hover:text-red-700 text-[10.5px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-0.5 rounded cursor-pointer border-0 bg-transparent transition-colors"
                                >
                                  Delete Section
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Interactive adding row inside this floor section */}
                        <tr className="bg-blue-50/40 dark:bg-slate-900/40 border-b border-border/70 border-dashed">
                          <td className="p-2 text-center font-extrabold text-[#0A7BC7] text-[15px]">+</td>
                          <td className="p-1.5">
                            <input type="text" placeholder={`Add space to ${floor}`} value={activeFloor === floor ? newDesc : ""} onChange={e => { setActiveFloor(floor); setNewDesc(e.target.value); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md px-2 py-1 outline-none focus:border-[#0A7BC7]" />
                          </td>
                          <td className="p-1.5">
                            <input type="number" min="1" value={activeFloor === floor ? newQty : 1} onChange={e => { setActiveFloor(floor); setNewQty(Number(e.target.value)); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center font-bold outline-none text-amber-600 dark:text-amber-400" />
                          </td>
                          {LU_FIXTURES_META.map(f => (
                            <td key={f.id} className="p-1">
                              <input type="number" min="0" placeholder="-" value={activeFloor === floor ? (newFixtures[f.id] || "") : ""} onChange={e => { setActiveFloor(floor); setNewFixtures({ ...newFixtures, [f.id]: e.target.value !== "" ? Number(e.target.value) : 0 }); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center outline-none" />
                            </td>
                          ))}
                          <td colSpan={2} className="p-2 text-center">
                            <button onClick={() => handleAddSpaceToFloor(floor)} className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-3 py-1 rounded font-bold transition-all cursor-pointer border-0 text-xs">Add</button>
                          </td>
                        </tr>

                        {/* Existing spaces on this floor */}
                        {floorsGrouped[floor].map((s) => {
                          const isSelected = selectedIds.includes(s.id);
                          return (
                            <tr
                              key={s.id}
                              onContextMenu={(e) => handleContextMenu(e, s.id)}
                              className={`border-b border-border/50 transition-colors ${isSelected ? "bg-blue-500/10 dark:bg-blue-950/30 font-semibold" : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"}`}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleSelect(s.id, e.target.checked)}
                                  className="size-3.5 accent-[#0A7BC7] cursor-pointer rounded"
                                />
                              </td>
                              <td className="p-1.5">
                                <input type="text" value={s.desc} onChange={e => handleSpaceDescChange(s.id, e.target.value)} className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-bold text-foreground" />
                              </td>
                              <td className="p-1 text-center">
                                <input type="number" min="1" value={s.qty || 1} onChange={e => handleQtyChange(s.id, Number(e.target.value))} className="w-full text-center bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono" />
                              </td>
                              {LU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1">
                                  <input type="number" min="0" value={s.fixtures[f.id] || ""} onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" />
                                </td>
                              ))}
                              <td className="p-2 text-center font-mono font-bold text-[#0A7BC7] bg-[#0A7BC7]/5">{(calculations.spaceTotalsLU[s.id] || 0).toFixed(1)}</td>
                            </tr>
                          );
                        })}

                      </tbody>
                    ))}
                  </table>
                </div>
              </div>

            </div>

            {/* Sizing Results & Recommended Pipe Sidebar */}
            <div className="lg:col-span-4 flex flex-col gap-3.5">
              
              {/* Sizing Results Card */}
              <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-xs">
                <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                  <div className="w-1 h-3 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                </div>

                <div className="flex flex-col gap-1.5 font-sans text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-border/30 text-[11.5px]">
                    <span className="font-semibold text-muted-foreground">Active Preset</span>
                    <span className="font-bold text-foreground text-right text-[11px]">{standardPreset === "dubai" ? "Dubai (DBC 2021)" : standardPreset === "abudhabi" ? "Abu Dhabi (ADM)" : "IPC / UPC (WSFU)"}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/30 text-[11.5px]">
                    <span className="font-semibold text-muted-foreground">Total Loading Units</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.totalLU.toFixed(1)} LU</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-border/30 text-[11.5px]">
                    <span className="font-semibold text-muted-foreground">Probable Peak Flow</span>
                    <strong className="font-bold text-[#0A7BC7] font-mono">{calculations.displayFlow}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1.5 px-2.5 my-0.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 rounded-lg text-[11px]">
                    <span className="font-bold text-foreground uppercase tracking-wide text-[10px]">Selected Pump Flow (Q)</span>
                    <strong className="font-extrabold text-[#0A7BC7] text-sm font-mono">{calculations.displaySelectedFlow}</strong>
                  </div>
                </div>
              </div>

              {/* Recommended Pipe Size Card */}
              <div className="bg-card border border-border rounded-2xl p-3.5 flex flex-col gap-2.5 shadow-xs">
                <div className="flex items-center gap-2 pb-1.5 border-b border-border/60">
                  <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-sans">🚰 Recommended Pipe Size</h3>
                </div>

                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Nominal Diameter</span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">DN{calculations.pipeSizing.sizeMM} mm</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span className="text-[9.5px] font-bold text-muted-foreground uppercase">Capacity Limit</span>
                    <span className="text-xs font-mono font-bold text-foreground">{calculations.pipeSizing.maxFlowLPS} L/s</span>
                  </div>
                </div>

                {/* Sizing Schedule Lookup Table */}
                <div className="overflow-y-auto max-h-44 border border-border rounded-lg custom-scrollbar">
                  <table className="w-full border-collapse text-[10px] font-mono">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 z-10">
                      <tr className="text-muted-foreground font-bold border-b border-border">
                        <th className="p-1 text-center">Pipe (mm)</th>
                        <th className="p-1 text-center">Max LU</th>
                        <th className="p-1 text-center">Max L/s</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PIPE_SIZING_TABLE.map((row) => {
                        const isMatch = calculations.pipeSizing.sizeMM === row.sizeMM;
                        return (
                          <tr key={row.sizeMM} className={`border-b border-border/30 ${isMatch ? "bg-emerald-500/25 font-extrabold text-emerald-800 dark:text-emerald-200" : ""}`}>
                            <td className="p-0.5 text-center font-bold">DN{row.sizeMM}</td>
                            <td className="p-0.5 text-center">{row.luMax}</td>
                            <td className="p-0.5 text-center">{row.flowMax}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-lg p-2 flex gap-1.5 text-[10px] text-muted-foreground">
                  <Info className="size-3.5 shrink-0 text-[#0A7BC7] mt-0.5" />
                  <span>Selected in accordance with DBC 2021 &amp; BS EN 806 velocity limits (V &le; 1.5 - 2.0 m/s).</span>
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xl py-1.5 text-xs font-bold text-foreground w-48"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-3 py-1 text-[10.5px] text-muted-foreground border-b border-border/60 uppercase">
            Options ({selectedIds.length} selected)
          </div>
          <button
            onClick={handleBulkDuplicate}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Copy className="size-3.5 text-[#0A7BC7]" /> Duplicate Space(s)
          </button>
          <button
            onClick={handleBulkMoveFloor}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            🏢 Move to Another Floor
          </button>
          <button
            onClick={handleBulkEditQty}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Edit3 className="size-3.5 text-amber-500" /> Edit Quantity
          </button>
          <div className="my-1 border-t border-border/60"></div>
          <button
            onClick={handleBulkDelete}
            className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-semibold"
          >
            <Trash2 className="size-3.5" /> Delete Space(s)
          </button>
        </div>
      )}
    </AppShell>
  );
}

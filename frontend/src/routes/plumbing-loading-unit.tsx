import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditLoadingUnitRowModal } from "@/components/workspace/EditLoadingUnitRowModal";
import { Trash2, Save, Info, Sparkles, Plus, Building2, Copy, Edit3, CheckSquare, Square, X, MessageSquare, Flag, Filter, SlidersHorizontal, Search, Download } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { addPdfHeader, addPdfSignatureBlock, getSignatureBlockDetails } from "@/lib/pdfHelpers";
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

export type StandardPreset = "iop_bs" | "dubai" | "abudhabi" | "ipc_upc";

interface LUSpace {
  id: number;
  desc: string;
  floor: string;
  qty: number;
  floorQty?: number;
  std: string;
  fixtures: Record<string, number>;
  comments?: any[];
  flagged?: boolean;
}

export function getLUSpaceValidation(s?: Partial<LUSpace>) {
  const warnings: string[] = [];
  if (!s) return { isFlagged: false, warnings: [] };

  const descEmpty = !s.desc || s.desc.trim() === "";
  const hasFixtures = s.fixtures && Object.values(s.fixtures).some(v => Number(v) > 0);
  const qtyZero = !s.qty || Number(s.qty) <= 0;

  const isCompletelyEmpty = descEmpty && !hasFixtures && qtyZero;

  if (!isCompletelyEmpty) {
    if (descEmpty) warnings.push("Space description is empty");
    if (qtyZero) warnings.push("Space quantity must be at least 1");
    if (!hasFixtures) warnings.push("No fixtures specified for this space");
  }

  const isManualFlagged = Boolean(s.flagged);
  const isAutoFlagged = warnings.length > 0;
  const isFlagged = isManualFlagged || isAutoFlagged;

  return { isFlagged, isManualFlagged, isAutoFlagged, warnings };
}

export interface StandardCategoryOption {
  id: string;
  label: string;
}

export const STANDARD_CATEGORIES: Record<StandardPreset, StandardCategoryOption[]> = {
  iop_bs: [
    { id: "med", label: "Medium Frequency of Use (Commercial / Offices / Hotels)" },
    { id: "low", label: "Low Frequency of Use (Dwellings / Low Demand)" },
    { id: "high", label: "High Frequency of Use (Public Washrooms / Assembly / Sports)" }
  ],
  dubai: [
    { id: "med", label: "Medium Demand (Commercial / Offices / Hotels)" },
    { id: "low", label: "Low Demand (Dwellings / Private Residential)" },
    { id: "high", label: "High Demand (Public Washrooms / Schools / Sports)" }
  ],
  abudhabi: [
    { id: "med", label: "Medium / Standard Demand (Commercial)" },
    { id: "low", label: "Low / Private Demand (Residential)" },
    { id: "high", label: "High / Public Demand (Assembly / Public)" }
  ],
  ipc_upc: [
    { id: "ipc_total", label: "Total WSFU (IPC Table E103.3(2))" },
    { id: "ipc_cold", label: "Cold Water WSFU (IPC Table E103.3(2))" },
    { id: "ipc_hot", label: "Hot Water WSFU (IPC Table E103.3(2))" },
    { id: "low", label: "Private / Residential WSFU" },
    { id: "high", label: "Public / Assembly WSFU" }
  ]
};

export const DEFAULT_CATEGORY_FOR_PRESET: Record<StandardPreset, string> = {
  iop_bs: "med",
  dubai: "med",
  abudhabi: "med",
  ipc_upc: "ipc_total"
};

export const STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY: Record<
  StandardPreset,
  Record<string, Record<string, number>>
> = {
  // 🇬🇧 IoP PESDG Table 15 / BS EN 806 (Loading Units - LU)
  iop_bs: {
    low: {
      wc: 1.0,           // WC Suite 6L cistern (Low=1)
      wc_tank: 1.0,
      wc_valve: 15.0,
      handspray: 1.0,    // Hand Spray (Low=1)
      basin: 1.0,        // Basin 15mm / 2x8mm (Low=1)
      sink: 2.0,         // Sink 15mm sep/mix (Low=2)
      shower: 2.0,       // Shower 15mm head (Low=2)
      washer: 2.0,       // Clothes washing m/c (Low=2)
      servicesink: 1.0,  // Slop hopper / Bucket sink (Low=1)
      hose_bibb: 1.5,
      dishwasher: 2.0,   // Dishwasher dom (Low=2)
      hose_bibb_1: 1.0,
      bath: 4.0,         // Bath 15mm (Low=4)
      bidet: 1.0,        // Bidet (Low=1)
      urinal: 1.0,       // Urinal (Low=1)
      bibtap: 1.5,
    },
    med: {
      wc: 2.0,           // WC Suite 6L cistern (Med=2)
      wc_tank: 2.0,
      wc_valve: 28.0,
      handspray: 1.0,    // Hand Spray (Med=1)
      basin: 2.0,        // Basin 15mm sep taps (Med=2)
      sink: 5.0,         // Sink 15mm sep/mix (Med=5)
      shower: 3.0,       // Shower 15mm head (Med=3)
      washer: 3.0,       // Clothes washing m/c (Med=3)
      servicesink: 3.0,  // Slop hopper cistern only (Med=3)
      hose_bibb: 2.5,
      dishwasher: 2.0,   // Dishwasher dom (Med=2)
      hose_bibb_1: 1.0,
      bath: 8.0,         // Bath 15mm sep/mix (Med=8)
      bidet: 1.0,        // Bidet (Med=1)
      urinal: 1.0,       // Urinal single bowl/stall (Med=1)
      bibtap: 2.5,
    },
    high: {
      wc: 5.0,           // WC Suite 6L cistern (High=5)
      wc_tank: 5.0,
      wc_valve: 28.0,
      handspray: 2.0,    // Hand Spray (High=2)
      basin: 4.0,        // Basin 15mm sep taps (High=4)
      sink: 10.0,        // Sink 15mm sep/mix (High=10)
      shower: 6.0,       // Shower 15mm head (High=6)
      washer: 4.0,       // Clothes washing m/c (High=4)
      servicesink: 5.0,  // Slop hopper cistern/taps (High=5)
      hose_bibb: 5.0,
      dishwasher: 4.0,   // Dishwasher dom (High=4)
      hose_bibb_1: 2.5,
      bath: 16.0,        // Bath 15mm sep/mix (High=16)
      bidet: 2.0,        // Bidet (High=2)
      urinal: 2.0,       // Urinal (High=2)
      bibtap: 5.0,
    }
  },
  // 🇦🇪 Dubai Standard (DBC 2021 / BS EN 806-3 / CIBSE Guide G)
  dubai: {
    low: {
      wc: 1.5,
      wc_tank: 1.5,
      wc_valve: 15.0,
      handspray: 1.0,
      basin: 1.0,
      sink: 1.5,
      shower: 1.5,
      washer: 2.0,
      servicesink: 2.0,
      hose_bibb: 1.5,
      dishwasher: 1.5,
      hose_bibb_1: 1.0,
      bath: 4.0,
      bibtap: 1.5,
    },
    med: {
      wc: 2.5,
      wc_tank: 2.0,
      wc_valve: 28.0,
      handspray: 1.0,
      basin: 1.0,
      sink: 1.5,
      shower: 2.0,
      washer: 3.0,
      servicesink: 3.0,
      hose_bibb: 2.5,
      dishwasher: 1.5,
      hose_bibb_1: 1.0,
      bath: 10.0,
      bibtap: 2.5,
    },
    high: {
      wc: 2.5,
      wc_tank: 2.5,
      wc_valve: 28.0,
      handspray: 2.0,
      basin: 2.0,
      sink: 5.0,
      shower: 4.0,
      washer: 4.0,
      servicesink: 5.0,
      hose_bibb: 5.0,
      dishwasher: 4.0,
      hose_bibb_1: 2.5,
      bath: 12.0,
      bibtap: 5.0,
    }
  },
  // 🇦🇪 Abu Dhabi Standard (ADM Table 6-7 / Table 6-9)
  abudhabi: {
    low: {
      wc: 2.5,
      wc_tank: 2.5,
      wc_valve: 3.5,
      handspray: 0.75,
      basin: 0.75,
      sink: 1.125,
      shower: 1.5,
      washer: 1.5,
      servicesink: 2.25,
      hose_bibb: 1.5,
      dishwasher: 1.4,
      hose_bibb_1: 1.0,
      bath: 1.4,
      bibtap: 1.5,
    },
    med: {
      wc: 2.5,
      wc_tank: 2.5,
      wc_valve: 5.0,
      handspray: 1.0,
      basin: 1.0,
      sink: 1.5,
      shower: 2.0,
      washer: 3.0,
      servicesink: 3.0,
      hose_bibb: 2.5,
      dishwasher: 1.5,
      hose_bibb_1: 1.0,
      bath: 1.4,
      bibtap: 2.5,
    },
    high: {
      wc: 3.5,
      wc_tank: 3.5,
      wc_valve: 8.0,
      handspray: 2.0,
      basin: 2.0,
      sink: 2.0,
      shower: 4.0,
      washer: 4.0,
      servicesink: 3.0,
      hose_bibb: 3.0,
      dishwasher: 3.0,
      hose_bibb_1: 2.0,
      bath: 3.0,
      bibtap: 3.0,
    }
  },
  // 🌐 International IPC / UPC Standard (IPC Table E103.3(2))
  ipc_upc: {
    ipc_total: {
      wc: 2.2,          // Water closet (Private Flush tank: 2.2 / Public: 5.0 / Flushometer: 10.0)
      wc_tank: 2.2,
      wc_valve: 10.0,
      handspray: 1.0,
      basin: 0.7,       // Lavatory (Private: 0.7 / Public: 2.0)
      sink: 1.4,        // Kitchen sink (Private: 1.4 / Public: 4.0)
      shower: 1.4,      // Shower head (Private: 1.4 / Public: 4.0)
      washer: 1.4,      // Washing machine (Private: 1.4 / Public: 3.0)
      servicesink: 3.0, // Service sink (3.0)
      hose_bibb: 2.5,
      dishwasher: 1.4,  // Dishwashing machine (1.4)
      hose_bibb_1: 1.0,
      bath: 1.4,        // Bathtub (Private: 1.4 / Public: 4.0)
      bidet: 2.0,       // Bidet (2.0)
      urinal: 5.0,      // Urinal (1/2" flushometer: 5.0 / 1" flushometer: 10.0)
      bibtap: 2.5,
    },
    ipc_cold: {
      wc: 2.2,
      wc_tank: 2.2,
      wc_valve: 10.0,
      handspray: 1.0,
      basin: 0.5,       // Lavatory (Cold: 0.5 Private / 1.5 Public)
      sink: 1.0,        // Kitchen sink (Cold: 1.0 Private / 3.0 Public)
      shower: 1.0,      // Shower head (Cold: 1.0 Private / 3.0 Public)
      washer: 1.0,      // Washing machine (Cold: 1.0 Private / 2.25 Public)
      servicesink: 2.25,// Service sink (Cold: 2.25)
      hose_bibb: 2.5,
      dishwasher: 0.0,  // Dishwashing machine (Cold: 0.0)
      hose_bibb_1: 1.0,
      bath: 1.0,        // Bathtub (Cold: 1.0 Private / 3.0 Public)
      bidet: 1.5,       // Bidet (Cold: 1.5)
      urinal: 5.0,      // Urinal (Cold: 5.0)
      bibtap: 2.5,
    },
    ipc_hot: {
      wc: 0.0,
      wc_tank: 0.0,
      wc_valve: 0.0,
      handspray: 0.0,
      basin: 0.5,       // Lavatory (Hot: 0.5 Private / 1.5 Public)
      sink: 1.0,        // Kitchen sink (Hot: 1.0 Private / 3.0 Public)
      shower: 1.0,      // Shower head (Hot: 1.0 Private / 3.0 Public)
      washer: 1.0,      // Washing machine (Hot: 1.0 Private / 2.25 Public)
      servicesink: 2.25,// Service sink (Hot: 2.25)
      hose_bibb: 0.0,
      dishwasher: 1.4,  // Dishwashing machine (Hot: 1.4)
      hose_bibb_1: 0.0,
      bath: 1.0,        // Bathtub (Hot: 1.0 Private / 3.0 Public)
      bidet: 1.5,       // Bidet (Hot: 1.5)
      urinal: 0.0,
      bibtap: 0.0,
    },
    low: {
      wc: 2.2,
      wc_tank: 2.2,
      wc_valve: 6.0,
      handspray: 1.0,
      basin: 0.7,
      sink: 1.4,
      shower: 1.4,
      washer: 1.4,
      servicesink: 3.0,
      hose_bibb: 2.5,
      dishwasher: 1.4,
      hose_bibb_1: 1.0,
      bath: 1.4,
      bibtap: 2.5,
    },
    high: {
      wc: 5.0,
      wc_tank: 5.0,
      wc_valve: 10.0,
      handspray: 2.0,
      basin: 2.0,
      sink: 4.0,
      shower: 4.0,
      washer: 3.0,
      servicesink: 3.0,
      hose_bibb: 3.0,
      dishwasher: 3.0,
      hose_bibb_1: 2.0,
      bath: 4.0,
      bibtap: 3.0,
    }
  }
};

export const STANDARD_FIXTURE_WEIGHTS: Record<StandardPreset, Record<string, number>> = {
  iop_bs: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.iop_bs.med,
  dubai: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.dubai.med,
  abudhabi: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.abudhabi.med,
  ipc_upc: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.ipc_upc.ipc_total,
};

export const LU_FIXTURES_META = [
  { id: 'wc', short: 'W/C' },
  { id: 'handspray', short: 'Hand Spray (Bibb)' },
  { id: 'basin', short: 'WASH BASIN' },
  { id: 'sink', short: 'Sink Kitchen' },
  { id: 'shower', short: 'Shower' },
  { id: 'washer', short: 'WASHING MACHINE' },
  { id: 'servicesink', short: 'Service Sink' },
  { id: 'hose_bibb', short: 'Hose Bibb' },
  { id: 'dishwasher', short: 'DISH WASHER' },
  { id: 'hose_bibb_1', short: 'Bib Tap' }
];

// UPC Abu Dhabi / UBC Table 6-9 Lookup Table (WSFU -> L/min)
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
  { wsfu: 1250, lmin: 908 },
  { wsfu: 1500, lmin: 1011 },
  { wsfu: 1750, lmin: 1113 },
  { wsfu: 2000, lmin: 1215 },
  { wsfu: 2250, lmin: 1317 },
  { wsfu: 2500, lmin: 1419 },
  { wsfu: 2750, lmin: 1522 },
  { wsfu: 3000, lmin: 1635 },
  { wsfu: 4000, lmin: 1987 },
  { wsfu: 5000, lmin: 2245 },
  { wsfu: 6000, lmin: 2434 },
  { wsfu: 7000, lmin: 2593 },
  { wsfu: 8000, lmin: 2718 },
  { wsfu: 9000, lmin: 2820 },
  { wsfu: 10000, lmin: 2911 }
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
    if (totalLU > 10000) return (2911 + (totalLU - 10000) * 0.2) / 60;
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

// Recommended Pipe Sizing Table (15mm to 200mm) matching Table from Image 2
export const PIPE_SIZING_TABLE = [
  { sizeMM: 15, wsfuRange: "1 to 3", luMax: 3, flowMax: 0.18, q4fps: 0.21372, q5fps: 0.26494, q6fps: 0.32146 },
  { sizeMM: 20, wsfuRange: "3.5 to 6", luMax: 6, flowMax: 0.38, q4fps: 0.37994, q5fps: 0.47100, q6fps: 0.57148 },
  { sizeMM: 25, wsfuRange: "6.5 to 14", luMax: 14, flowMax: 0.70, q4fps: 0.59366, q5fps: 0.73594, q6fps: 0.89294 },
  { sizeMM: 32, wsfuRange: "14.5 to 25", luMax: 25, flowMax: 1.07, q4fps: 0.97265, q5fps: 1.20576, q6fps: 1.46299 },
  { sizeMM: 40, wsfuRange: "25.5 to 30", luMax: 30, flowMax: 1.27, q4fps: 1.51976, q5fps: 1.88400, q6fps: 2.28592 },
  { sizeMM: 50, wsfuRange: "30.5 to 80", luMax: 80, flowMax: 2.40, q4fps: 2.37463, q5fps: 2.94375, q6fps: 3.57175 },
  { sizeMM: 65, wsfuRange: "80.5 to 275", luMax: 275, flowMax: 5.05, q4fps: 4.013116, q5fps: 4.974938, q6fps: 6.036258 },
  { sizeMM: 80, wsfuRange: "275.5 to 500", luMax: 500, flowMax: 7.88, q4fps: 6.07904, q5fps: 7.53600, q6fps: 9.14368 },
  { sizeMM: 100, wsfuRange: "501 to 750", luMax: 750, flowMax: 10.72, q4fps: 9.49850, q5fps: 11.77500, q6fps: 14.28700 },
  { sizeMM: 150, wsfuRange: "750 to 4000", luMax: 4000, flowMax: 33.12, q4fps: 21.371625, q5fps: 26.49375, q6fps: 32.14575 },
  { sizeMM: 200, wsfuRange: "4001 to 10000", luMax: 10000, flowMax: 48.52, q4fps: 37.99400, q5fps: 47.10000, q6fps: 57.14800 }
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
  const [selectedCategory, setSelectedCategory] = useState<string>("med");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [iopSpaces, setIopSpaces] = useState<LUSpace[]>([]);
  const [floorSections, setFloorSections] = useState<string[]>(["6th FLOOR"]);
  const [activeFloor, setActiveFloor] = useState<string>("6th FLOOR");
  const [showSpaceQty, setShowSpaceQty] = useState<boolean>(true);
  const [showFloorsCol, setShowFloorsCol] = useState<boolean>(true);

  // Project / Calculation Header Metadata Block (Matching reference submittal sheet)
  const [calcMeta, setCalcMeta] = useState({
    calcNo: "CEC-MED-P539-202",
    revNo: "1",
    projectNo: "P539",
    projectName: "DH-RA Phase 2 Development Yas Island AUH",
    date: "14.07.2026",
    client: "ALDAR",
    endUser: ""
  });

  // Selection states for Bulk Editing
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingSpace, setEditingSpace] = useState<{ space: LUSpace; floor: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spaceId: number } | null>(null);
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: 'space' } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [sortBy, setSortBy] = useState<"none" | "desc" | "lu">("none");

  const flagStats = useMemo(() => {
    let totalCount = 0;
    let flaggedCount = 0;
    (iopSpaces || []).forEach((s) => {
      totalCount++;
      if (getLUSpaceValidation(s).isFlagged) flaggedCount++;
    });
    return { totalCount, flaggedCount };
  }, [iopSpaces]);

  const toggleFlagSpace = (targetId: number, currentFlagged: boolean) => {
    const targetIds = selectedIds.includes(targetId) && selectedIds.length > 1
      ? selectedIds
      : [targetId];
    
    const nextState = !currentFlagged;
    setIopSpaces(prev => prev.map(s => targetIds.includes(s.id) ? { ...s, flagged: nextState } : s));
    toast.info(nextState ? `Flagged ${targetIds.length} space(s)` : `Unflagged ${targetIds.length} space(s)`);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFloor !== "all") count++;
    return count;
  }, [filterFloor]);

  const handleResetFilters = () => {
    setFilterFloor("all");
  };

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const [newFloorQty, setNewFloorQty] = useState<number>(1);
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
          if (data.selectedCategory) {
            setSelectedCategory(data.selectedCategory);
          } else if (data.standardPreset) {
            setSelectedCategory(DEFAULT_CATEGORY_FOR_PRESET[data.standardPreset as StandardPreset] || "med");
          }
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.calcMeta) setCalcMeta(data.calcMeta);
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
          setSelectedCategory("med");
          setWeightOverrides({});
          setCalcMeta({
            calcNo: "CEC-MED-P539-202",
            revNo: "1",
            projectNo: "P539",
            projectName: "DH-RA Phase 2 Development Yas Island AUH",
            date: "14.07.2026",
            client: "ALDAR",
            endUser: ""
          });
          setActiveFloor("6th FLOOR");
          setFloorSections(["6th FLOOR"]);
          setIopSpaces([
            {
              id: 1,
              desc: "STUDIO",
              floor: "6th FLOOR",
              qty: 3,
              std: "med",
              fixtures: { wc: 1, handspray: 1, basin: 1, sink: 1, shower: 1, washer: 1, dishwasher: 1 }
            },
            {
              id: 2,
              desc: "1 BHK",
              floor: "6th FLOOR",
              qty: 7,
              std: "med",
              fixtures: { wc: 1, handspray: 1, basin: 1, sink: 1, shower: 1, washer: 1, dishwasher: 1 }
            },
            {
              id: 3,
              desc: "2 BHK",
              floor: "6th FLOOR",
              qty: 4,
              std: "med",
              fixtures: { wc: 2, handspray: 2, basin: 2, sink: 1, shower: 2, washer: 1, dishwasher: 1 }
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
        selectedCategory,
        weightOverrides,
        calcMeta,
        iopSpaces,
        floorSections
      };
      localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, standardPreset, selectedCategory, weightOverrides, calcMeta, iopSpaces, floorSections]);

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
          selectedCategory,
          weightOverrides,
          iopSpaces,
          floorSections
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

  // Dynamic Fixture Weights for current Standard and Category (with user custom weight overrides)
  const activeWeights = useMemo(() => {
    const catDict = STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset];
    const defaultCat = DEFAULT_CATEGORY_FOR_PRESET[standardPreset];
    const stdWeights = catDict[selectedCategory] || catDict[defaultCat] || STANDARD_FIXTURE_WEIGHTS[standardPreset];
    return {
      ...stdWeights,
      ...weightOverrides
    };
  }, [standardPreset, selectedCategory, weightOverrides]);

  const handleResetWeightsToDefault = () => {
    setWeightOverrides({});
    if (project?.id) {
      try {
        const key = `mep_loading_unit_calc_${project.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          data.weightOverrides = {};
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) {}
    }
    toast.info("Reset fixture weights to standard defaults.");
  };

  // Calculations
  const calculations = useMemo(() => {
    let totalLU = 0;
    const spaceUnitLU: Record<number, number> = {};
    const spaceTotalsLU: Record<number, number> = {};
    const catDict = STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset];
    const defaultCat = DEFAULT_CATEGORY_FOR_PRESET[standardPreset];

    iopSpaces.forEach(s => {
      const cat = s.std && catDict[s.std] ? s.std : selectedCategory;
      const baseWeights = catDict[cat] || catDict[defaultCat] || STANDARD_FIXTURE_WEIGHTS[standardPreset];
      // Include custom user overrides for active category
      const weights = (!s.std || s.std === selectedCategory)
        ? { ...baseWeights, ...weightOverrides }
        : baseWeights;

      let unitLU = 0;
      LU_FIXTURES_META.forEach(f => {
        const count = s.fixtures[f.id] || 0;
        if (count > 0) {
          const w = weights[f.id] ?? 0;
          unitLU += count * w;
        }
      });

      const qty = showSpaceQty ? (s.qty || 1) : 1;
      const floorQty = showFloorsCol ? (s.floorQty || 1) : 1;
      const spaceTotal = unitLU * qty * floorQty;

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
  }, [iopSpaces, standardPreset, selectedCategory, weightOverrides, ip, showSpaceQty, showFloorsCol]);

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

  const handleAddSpace = () => {
    const targetFloor = activeFloor || floorSections[0] || "6th FLOOR";
    const nextId = Date.now();
    setIopSpaces(prev => [...prev, {
      id: nextId,
      desc: "New Space",
      floor: targetFloor,
      qty: 1,
      floorQty: 1,
      std: selectedCategory || "med",
      fixtures: { wc: 1, basin: 1 }
    }]);
    toast.success("Added new space");
  };

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
      floorQty: Math.max(1, newFloorQty || 1),
      std: "med",
      fixtures: fixturesCleaned
    }]);

    setNewDesc("");
    setNewQty(1);
    setNewFloorQty(1);
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

  const handleFloorQtyChange = (spaceId: number, val: number) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          floorQty: Math.max(1, val)
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
      const numFixtures = activeFixtures.length; // 10
      const extraCols = (showSpaceQty ? 1 : 0) + (showFloorsCol ? 1 : 0);
      const totalCols = 1 + numFixtures + 1 + extraCols + 1; // 1 (Desc) + numFixtures + 1 (Unit LU) + extraCols + 1 (TOTAL LU)
      const lastColLetter = getColLetter(totalCols);

      const currentWeights = STANDARD_FIXTURE_WEIGHTS[standardPreset];
      const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc";
      const unitLabel = isWsfu ? "WSFU" : "LU";

      // 1. Column Widths matching P539B
      sheet.getColumn(1).width = 25; // Description
      for (let c = 2; c <= 1 + numFixtures; c++) {
        sheet.getColumn(c).width = 13; // Fixtures
      }
      let currCol = 1 + numFixtures + 1; // Col for LU per Space
      sheet.getColumn(currCol).width = 13;
      const luColLet = getColLetter(currCol);

      let qtyColLet = "";
      if (showSpaceQty) {
        currCol++;
        sheet.getColumn(currCol).width = 11;
        qtyColLet = getColLetter(currCol);
      }

      let floorQtyColLet = "";
      if (showFloorsCol) {
        currCol++;
        sheet.getColumn(currCol).width = 13;
        floorQtyColLet = getColLetter(currCol);
      }

      currCol++;
      sheet.getColumn(currCol).width = 14;
      const totalLUColLet = getColLetter(currCol);

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
      sheet.mergeCells(`${luColLet}8:${luColLet}9`);
      sheet.getCell(`${luColLet}8`).value = isWsfu ? "WSFU" : "LU per Space";

      if (showSpaceQty && qtyColLet) {
        sheet.mergeCells(`${qtyColLet}8:${qtyColLet}9`);
        sheet.getCell(`${qtyColLet}8`).value = "Space Qty";
      }

      if (showFloorsCol && floorQtyColLet) {
        sheet.mergeCells(`${floorQtyColLet}8:${floorQtyColLet}9`);
        sheet.getCell(`${floorQtyColLet}8`).value = "No. of Floors";
      }

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

          let formulaParts = [`${luColLet}${r}`];

          if (showSpaceQty && qtyColLet) {
            const qtyCell = sheet.getCell(`${qtyColLet}${r}`);
            qtyCell.value = s.qty || 1;
            qtyCell.font = fontCambria11Bold;
            qtyCell.alignment = { vertical: "middle", horizontal: "center" };
            qtyCell.numFmt = "0";
            qtyCell.border = borderThinAll;
            formulaParts.push(`${qtyColLet}${r}`);
          }

          if (showFloorsCol && floorQtyColLet) {
            const floorQtyCell = sheet.getCell(`${floorQtyColLet}${r}`);
            floorQtyCell.value = s.floorQty || 1;
            floorQtyCell.font = fontCambria11Bold;
            floorQtyCell.alignment = { vertical: "middle", horizontal: "center" };
            floorQtyCell.numFmt = "0";
            floorQtyCell.border = borderThinAll;
            formulaParts.push(`${floorQtyColLet}${r}`);
          }

          const totalLUCell = sheet.getCell(`${totalLUColLet}${r}`);
          totalLUCell.value = { formula: formulaParts.join("*") };
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

  // PDF Export Function
  const handleExportPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      const doc = new jsPDF("l", "mm", "a4");

      const activeProj: any = workspaceStore.getState()?.project || project || {};
      const projectNo = activeProj.code || activeProj.project_number || activeProj.projectNumber || calcMeta.projectNo || 'P539';
      const calcNo = activeProj.calcNo || activeProj.calc_number || calcMeta.calcNo || `CEC-MED-${projectNo}-202 Rev. No:1`;

      // 1. Add PDF Header
      let startY = addPdfHeader(doc, "Loading Unit & Pipe Sizing Calculation", {
        calcNo,
        projectNo,
        projectName: activeProj.name || activeProj.project_name || calcMeta.projectName || '',
        client: activeProj.client || activeProj.client_name || calcMeta.client || '',
        endUser: activeProj.endUser || activeProj.location || calcMeta.endUser || '',
        date: calcMeta.date || undefined,
      });

      const activeFixtures = LU_FIXTURES_META;
      const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc";
      const unitLabel = isWsfu ? "WSFU" : "LU";

      // 2. Main Fixture Schedule Headers
      const headers = [
        "Description",
        ...activeFixtures.map(f => `${f.short} (${activeWeights[f.id] ?? 0})`),
        `${unitLabel} / Space`,
        ...(showSpaceQty ? ["Space Qty"] : []),
        ...(showFloorsCol ? ["No. of Floors"] : []),
        `TOTAL ${unitLabel}`
      ];

      // 3. Main Fixture Schedule Rows (Grouped by Floor)
      const tableRows: any[] = [];

      floorSections.forEach(fl => {
        const floorItems = iopSpaces.filter(s => (s.floor || "6th FLOOR") === fl);
        if (floorItems.length === 0) return;

        tableRows.push([
          { content: `${fl.toUpperCase()}`, colSpan: headers.length, styles: { fillColor: [242, 220, 219], fontStyle: "bold", halign: "center" } }
        ]);

        floorItems.forEach((item: LUSpace) => {
          const unitLU = calculations.spaceUnitLU[item.id] || 0;
          const totalLu = calculations.spaceTotalsLU[item.id] || 0;

          const rowData = [
            item.desc || "Space",
            ...activeFixtures.map(f => item.fixtures[f.id] || ""),
            Number(unitLU.toFixed(1)),
            ...(showSpaceQty ? [item.qty || 1] : []),
            ...(showFloorsCol ? [item.floors || 1] : []),
            Number(totalLu.toFixed(1))
          ];
          tableRows.push(rowData);
        });
      });

      // Total Building LU Summary Row
      tableRows.push([
        { content: "TOTAL BUILDING LOADING UNITS", colSpan: headers.length - 1, styles: { fontStyle: "bold", halign: "right" } },
        { content: `${calculations.totalLU.toFixed(1)} ${unitLabel}`, styles: { fontStyle: "bold", textColor: [180, 0, 0], halign: "center" } }
      ]);

      const runAutoTable = (options: any) => {
        if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else if ((doc as any).autoTable) {
          (doc as any).autoTable(options);
        }
      };

      runAutoTable({
        startY: startY + 4,
        head: [headers],
        body: tableRows,
        theme: "grid",
        headStyles: {
          fillColor: [239, 236, 225],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7.5,
          halign: "center",
          valign: "middle"
        },
        bodyStyles: {
          fontSize: 7.5,
          halign: "center",
          valign: "middle"
        },
        columnStyles: {
          0: { halign: "left", fontStyle: "bold", cellWidth: 32 }
        },
        styles: {
          cellPadding: 1.8
        },
        margin: { left: 14, right: 14 }
      });

      let finalY = (doc as any).lastAutoTable?.finalY || startY + 50;

      // 4. Building Water Demand Table (Matching Excel Sheet Format Exactly)
      const appTitle = standardPreset === "abudhabi" 
        ? "MEDIUM FREQUENCY APPLICATION" 
        : standardPreset === "dubai" 
        ? "BUILDING WATER DEMAND (DBC / BS EN 806)" 
        : "INTERNATIONAL PLUMBING CODE DEMAND";

      const summaryTableRows = [
        [{ content: appTitle, colSpan: 2, styles: { fontStyle: "bold", halign: "center", fillColor: [242, 242, 242] } }],
        ["No of Booster Pump", "1W+1A+1S"],
        [`Total Water Supply Fixture (${unitLabel})`, `${calculations.totalLU.toFixed(1)}`],
        ["Flow due to loading unit (l/s)", `${calculations.flowLPS.toFixed(3)}`],
        ["Total Water demand considered (l/s)", `${calculations.selectedFlowLPS.toFixed(1)}`],
        ["Diversity (if any)", ""],
        [
          { content: "Selected Water Flow Rate (Q) L/s", styles: { fontStyle: "bold", fillColor: [253, 235, 218], halign: "center" } },
          { content: `${calculations.selectedFlowLPS.toFixed(1)}`, styles: { fontStyle: "bold", fillColor: [253, 235, 218], halign: "center" } }
        ]
      ];

      runAutoTable({
        startY: finalY + 6,
        body: summaryTableRows,
        theme: "grid",
        bodyStyles: {
          fontSize: 8.5,
          valign: "middle"
        },
        columnStyles: {
          0: { fontStyle: "normal", cellWidth: 95, halign: "left" },
          1: { fontStyle: "normal", cellWidth: 65, halign: "center" }
        },
        styles: { cellPadding: 2 },
        margin: { left: 14 }
      });

      finalY = (doc as any).lastAutoTable?.finalY || finalY + 40;

      // 5. Signature Block Table (Matching Excel Sheet Format: Name, Signature, Date)
      let currentUserName = "";
      if (typeof window !== "undefined") {
        try {
          const user = JSON.parse(localStorage.getItem('mep_user') || '{}');
          const profile = JSON.parse(localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile') || '{}');
          currentUserName = user.name || user.user?.name || profile.name || profile.user?.name || (window as any).currentMepUserName || "";
        } catch (e) {}
      }

      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails((project as any)?.id || "default", "/plumbing-loading-unit", currentUserName);

      const sigHeader = [["", "Originated by", "Reviewed by", "Approved by"]];
      const sigBody = [
        ["Name:", originatedName || "System Admin", reviewerName || "", approverName || ""],
        ["Signature:", "", "", ""],
        ["Date:", originatedDate || formatDateStr(new Date().toISOString()), reviewerDate || "", approverDate || ""]
      ];

      runAutoTable({
        startY: finalY + 8,
        head: sigHeader,
        body: sigBody,
        theme: "grid",
        headStyles: {
          fillColor: [253, 235, 218],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 9,
          halign: "center",
          valign: "middle"
        },
        bodyStyles: {
          fontSize: 8.5,
          valign: "middle",
          halign: "center"
        },
        columnStyles: {
          0: { fontStyle: "bold", cellWidth: 30, halign: "left" },
          1: { cellWidth: 70 },
          2: { cellWidth: 70 },
          3: { cellWidth: 70 }
        },
        styles: { cellPadding: 2.5 },
        margin: { left: 14 }
      });

      doc.save(`Loading_Unit_Calculation_${projectNo}.pdf`);
      toast.success("PDF report generated successfully!");

    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err?.message || "Failed to generate PDF export.");
    }
  };

  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    let filtered = iopSpaces || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => (s.desc || "").toLowerCase().includes(q) || (s.floor || "").toLowerCase().includes(q));
    }

    if (showFlaggedOnly) {
      filtered = filtered.filter(s => getLUSpaceValidation(s).isFlagged);
    }

    if (filterFloor !== "all") {
      filtered = filtered.filter(s => (s.floor || "6th FLOOR") === filterFloor);
    }

    if (sortBy === "desc") {
      filtered = [...filtered].sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
    } else if (sortBy === "lu") {
      filtered = [...filtered].sort((a, b) => {
        const currentWeights = STANDARD_FIXTURE_WEIGHTS[standardPreset];
        const luA = Object.entries(a.fixtures || {}).reduce((sum, [fid, qty]) => sum + (Number(qty) || 0) * (currentWeights[fid] || 0), 0);
        const luB = Object.entries(b.fixtures || {}).reduce((sum, [fid, qty]) => sum + (Number(qty) || 0) * (currentWeights[fid] || 0), 0);
        return luB - luA;
      });
    }

    const grouped: Record<string, LUSpace[]> = {};
    floorSections.forEach(fl => {
      grouped[fl] = [];
    });
    filtered.forEach(s => {
      const fl = s.floor || "6th FLOOR";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [iopSpaces, floorSections, searchQuery, showFlaggedOnly, filterFloor, sortBy, standardPreset]);

  const allSelected = selectedIds.length === iopSpaces.length && iopSpaces.length > 0;

  return (
    <AppShell title="Loading Unit Calculator" hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full px-6 pb-6 animate-in fade-in-50 duration-200">
          
          {/* Page Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 select-none">
            <div className="flex flex-col gap-1 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; LOADING UNIT CALCULATOR</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  <Sparkles className="size-3" /> Dubai Building Code Ready
                </span>
              </div>
              <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground mt-0.5">Loading Unit Calculator</h1>
              <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5">
                Calculate Loading Units (LU / WSFU), peak demand flow rates, and booster pump sizing.
              </p>
            </div>
          </div>

          {/* Standard & Unit System Selector Header */}
          <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-slate-100 dark:bg-slate-900/60 p-2.5 sm:p-3 border border-border rounded-2xl gap-3 shadow-xs">
            <div className="flex items-center gap-3 w-full md:w-auto min-w-0 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground shrink-0 uppercase tracking-wide">Standard Preset:</span>
                <select
                  value={standardPreset}
                  onChange={(e) => {
                    const newPreset = e.target.value as StandardPreset;
                    setStandardPreset(newPreset);
                    setSelectedCategory(DEFAULT_CATEGORY_FOR_PRESET[newPreset]);
                    setWeightOverrides({});
                  }}
                  className="bg-white dark:bg-slate-950 border border-border text-foreground text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#0A7BC7] cursor-pointer min-w-[240px]"
                >
                  <option value="iop_bs">IoP PESDG Table 15 / BS EN 806 (LU)</option>
                  <option value="ipc_upc">International Plumbing Code - IPC Table E103.3(2) (WSFU)</option>
                  <option value="dubai">Dubai Standard (DBC 2021 / BS EN 806)</option>
                  <option value="abudhabi">Abu Dhabi Standard (ADM Table 6-7 & 6-9)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-foreground shrink-0 uppercase tracking-wide">Demand Category:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setWeightOverrides({});
                  }}
                  className="bg-white dark:bg-slate-950 border border-border text-foreground text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#0A7BC7] cursor-pointer min-w-[210px]"
                >
                  {STANDARD_CATEGORIES[standardPreset].map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Workspace Header Toolbar Strip */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2 min-h-[44px] h-auto border border-border bg-card rounded-2xl shrink-0 select-none gap-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter spaces..."
                  className="h-7 w-56 pl-8 pr-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
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
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                      Filter
                    </span>
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <span className="text-xs font-bold text-foreground">Filter Spaces</span>
                    {activeFiltersCount > 0 && (
                      <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold">
                        Reset All
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor Section</span>
                    <select
                      value={filterFloor}
                      onChange={(e) => setFilterFloor(e.target.value)}
                      className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                    >
                      <option value="all">All Floor Sections</option>
                      {floorSections.map(fl => (
                        <option key={fl} value={fl}>{fl}</option>
                      ))}
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
                    <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
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
                        className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${
                          rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        Default
                      </button>
                      <button
                        onClick={() => setRowDensity("compact")}
                        className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${
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
                      className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                    >
                      <option value="none">Original Order</option>
                      <option value="desc">Description (A-Z)</option>
                      <option value="lu">Total LU (High to Low)</option>
                    </select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {/* Flag KPI Filter */}
              <button
                onClick={() => setShowFlaggedOnly(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                  showFlaggedOnly
                    ? "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-400"
                    : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3"
                }`}
                title={showFlaggedOnly ? "Show all rows" : "Show flagged rows only"}
              >
                <Flag className={`size-3.5 ${flagStats.flaggedCount > 0 ? "fill-red-500 text-red-500" : ""}`} />
                <span>{flagStats.flaggedCount} Flagged</span>
                {showFlaggedOnly && <span className="text-[9px] bg-red-500 text-white px-1.5 rounded-full font-bold uppercase">Active</span>}
              </button>

              <button
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-border bg-surface-2 text-foreground hover:bg-surface-3 transition-all cursor-pointer"
              >
                <Download className="size-3.5" /> PDF
              </button>

              <button
                onClick={handleAddSpace}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer"
              >
                <Plus className="size-3.5" /> Add Space
              </button>
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
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border rounded-lg px-2 py-0.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-muted-foreground">Category:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const newCat = e.target.value;
                        setIopSpaces(iopSpaces.map(s => selectedIds.includes(s.id) ? { ...s, std: newCat } : s));
                        toast.success(`Updated category for ${selectedIds.length} space(s)`);
                      }
                    }}
                    defaultValue=""
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer text-foreground"
                  >
                    <option value="" disabled>Set Category...</option>
                    {STANDARD_CATEGORIES[standardPreset].map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
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

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <div className="xl:col-span-9 lg:col-span-8 min-w-0 flex flex-col gap-6">
              
              {/* Fixtures quantities schedule card */}
              <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs min-w-0">
                
                {/* Header bar with Floor Section Creator */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📋 Fixture Schedule (Grouped By Floor)</h3>
                    {Object.keys(weightOverrides).length > 0 && (
                      <button
                        onClick={handleResetWeightsToDefault}
                        className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full transition-all cursor-pointer"
                        title="Reset custom weights to standard defaults"
                      >
                        ↺ Reset Weights
                      </button>
                    )}
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
                  <table className="w-full min-w-[800px] border-collapse text-[11.5px] font-sans select-none">
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
                        <th rowSpan={2} className="p-2 text-left min-w-[140px]">Description</th>
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-2 text-center w-12 text-[11px] font-bold">{f.short}</th>
                        ))}
                        <th rowSpan={2} className="p-2 text-center w-16 bg-[#0A7BC7]/5 text-[#0A7BC7] font-bold" title="Unit value per 1 space">
                          {standardPreset === "dubai" ? "LU" : "WSFU"}
                        </th>
                        <th className="p-1.5 text-center w-16 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border-b border-border/40" title="Quantity of spaces per typical floor">
                          Space Qty
                        </th>
                        <th className="p-1.5 text-center w-16 bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border-b border-border/40" title="Number of typical floors">
                          No. of Floors
                        </th>
                        <th rowSpan={2} className="p-2 text-center w-20 bg-[#0A7BC7]/10 text-[#0A7BC7] font-bold" title="Total LU = Unit Value × (Space Qty if ON) × (No. of Floors if ON)">
                          {standardPreset === "dubai" ? "TOTAL LU" : "TOTAL WSFU"}
                        </th>
                        <th rowSpan={2} className="p-2 text-center w-16 font-bold">
                          Actions
                        </th>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-1 px-0.5 text-center font-bold bg-[#0A7BC7]/5">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="50"
                              value={activeWeights[f.id] ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value !== "" ? Number(e.target.value) : 0;
                                const val = Math.min(50, Math.max(0, raw));
                                setWeightOverrides(prev => ({ ...prev, [f.id]: val }));
                              }}
                              className="w-12 text-center bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded text-[#0A7BC7] font-extrabold text-[11.5px] py-0.5 outline-none focus:ring-2 focus:ring-[#0A7BC7]"
                              title={`Edit loading unit weight for ${f.short} (Standard default: ${STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset]?.[selectedCategory]?.[f.id] ?? ""})`}
                            />
                          </th>
                        ))}
                        {/* Toggle button under Space Qty header */}
                        <th className="p-1 text-center bg-amber-500/10 border-b border-border">
                          <button
                            type="button"
                            onClick={() => setShowSpaceQty(!showSpaceQty)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer border ${showSpaceQty ? "bg-amber-500 text-white border-amber-600 shadow-xs" : "bg-slate-200 dark:bg-slate-800 text-slate-500 border-border"}`}
                            title={showSpaceQty ? "Space Qty is ON. Click to turn OFF." : "Space Qty is OFF. Click to turn ON."}
                          >
                            {showSpaceQty ? "ON" : "OFF"}
                          </button>
                        </th>
                        {/* Toggle button under No. of Floors header */}
                        <th className="p-1 text-center bg-sky-500/10 border-b border-border">
                          <button
                            type="button"
                            onClick={() => setShowFloorsCol(!showFloorsCol)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer border ${showFloorsCol ? "bg-sky-500 text-white border-sky-600 shadow-xs" : "bg-slate-200 dark:bg-slate-800 text-slate-500 border-border"}`}
                            title={showFloorsCol ? "No. of Floors is ON. Click to turn OFF." : "No. of Floors is OFF. Click to turn ON."}
                          >
                            {showFloorsCol ? "ON" : "OFF"}
                          </button>
                        </th>
                      </tr>
                    </thead>

                    {/* Floor Section Blocks */}
                    {Object.keys(floorsGrouped).map(floor => (
                      <tbody key={floor} className="border-b border-border/80">
                        
                        {/* Floor Section Header */}
                        <tr className="bg-slate-200 dark:bg-slate-800 border-b border-border text-foreground font-bold text-[11.5px]">
                          <td colSpan={LU_FIXTURES_META.length + 7} className="p-2 px-3 text-center">
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
                          {LU_FIXTURES_META.map(f => (
                            <td key={f.id} className="p-1">
                              <input type="number" min="0" placeholder="-" value={activeFloor === floor ? (newFixtures[f.id] || "") : ""} onChange={e => { setActiveFloor(floor); setNewFixtures({ ...newFixtures, [f.id]: e.target.value !== "" ? Number(e.target.value) : 0 }); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center outline-none" />
                            </td>
                          ))}
                          <td className="p-1 text-center text-muted-foreground font-mono">—</td>
                          <td className="p-1.5 text-center">
                            {showSpaceQty ? (
                              <input type="number" min="1" value={activeFloor === floor ? newQty : 1} onChange={e => { setActiveFloor(floor); setNewQty(Number(e.target.value)); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center font-bold outline-none text-amber-600 dark:text-amber-400" title="Space Qty per floor" />
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {showFloorsCol ? (
                              <input type="number" min="1" value={activeFloor === floor ? newFloorQty : 1} onChange={e => { setActiveFloor(floor); setNewFloorQty(Number(e.target.value)); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center font-bold outline-none text-sky-600 dark:text-sky-400" title="No. of typical floors" />
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => handleAddSpaceToFloor(floor)} className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-3 py-1 rounded font-bold transition-all cursor-pointer border-0 text-xs">Add</button>
                          </td>
                          <td className="p-1 text-center"></td>
                        </tr>

                        {/* Existing spaces on this floor */}
                        {floorsGrouped[floor].map((s) => {
                          const isSelected = selectedIds.includes(s.id);
                          const isEditing = editingSpace?.space.id === s.id;
                          const isModalOpen = editingSpace !== null;

                          return (
                            <tr
                              key={s.id}
                              onDoubleClick={() => {
                                setSelectedIds([s.id]);
                                setEditingSpace({ space: s, floor });
                              }}
                              onContextMenu={(e) => handleContextMenu(e, s.id)}
                              className={`transition-all duration-200 cursor-pointer ${rowDensity === "compact" ? "h-6 text-[11px]" : ""} ${
                                isEditing
                                  ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                  : isModalOpen
                                  ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                  : isSelected
                                  ? "bg-blue-500/10 dark:bg-blue-950/30 font-semibold"
                                  : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                              }`}
                            >
                              <td className="p-2 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleSelect(s.id, e.target.checked)}
                                  className="size-3.5 accent-[#0A7BC7] cursor-pointer rounded"
                                />
                              </td>
                              <td className="p-1.5" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                <div className="flex items-center gap-1.5 w-full">
                                  {s.comments && s.comments.length > 0 && (
                                    <span 
                                      title={`${s.comments.length} comment(s):\n${s.comments.map((c: any) => `${c.authorName}: ${c.text}`).join('\n')}`} 
                                      className="inline-flex items-center justify-center p-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 cursor-help"
                                    >
                                      <MessageSquare className="size-3.5" />
                                    </span>
                                  )}
                                  <input 
                                    type="text" 
                                    value={s.desc} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleSpaceDescChange(s.id, e.target.value)} 
                                    className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-bold text-foreground" 
                                  />
                                </div>
                              </td>
                              {LU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                  <input 
                                    type="number" 
                                    min="0" 
                                    value={s.fixtures[f.id] || ""} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} 
                                    className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" 
                                  />
                                </td>
                              ))}
                              <td className="p-2 text-center font-mono font-bold text-[#0A7BC7] bg-[#0A7BC7]/5" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {(calculations.spaceUnitLU[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-1 text-center" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {showSpaceQty ? (
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={s.qty || 1} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleQtyChange(s.id, Number(e.target.value))} 
                                    className="w-full text-center bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono" 
                                    title="Space Qty per floor" 
                                  />
                                ) : (
                                  <span className="text-muted-foreground font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-1 text-center" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {showFloorsCol ? (
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={s.floorQty || 1} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleFloorQtyChange(s.id, Number(e.target.value))} 
                                    className="w-full text-center bg-sky-500/10 text-sky-700 dark:text-sky-300 font-bold border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono" 
                                    title="No. of typical floors" 
                                  />
                                ) : (
                                  <span className="text-muted-foreground font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-2 text-center font-mono font-extrabold text-[#0A7BC7] bg-[#0A7BC7]/10" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {(calculations.spaceTotalsLU[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-1 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedIds([s.id]);
                                      setEditingSpace({ space: s, floor });
                                    }}
                                    className="text-primary/70 hover:text-primary p-1 rounded hover:bg-primary/10 transition-colors cursor-pointer"
                                    title="Edit Parameters & Calculations Breakdown"
                                  >
                                    <Info className="size-3.5" />
                                  </button>
                                  {(() => {
                                    const totalFixtures = Object.values(s.fixtures || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
                                    const isMissingDesc = !s.desc || s.desc.trim() === "";
                                    const isNoFixtures = totalFixtures === 0;
                                    const isMissingQty = showSpaceQty && (!s.qty || Number(s.qty) <= 0);
                                    const isMissingFloorQty = showFloorsCol && (!s.floorQty || Number(s.floorQty) <= 0);
                                    const isMissingValues = isMissingDesc || isNoFixtures || isMissingQty || isMissingFloorQty;
                                    const isFlagActive = s.flagged || isMissingValues;

                                    const missingMsg: string[] = [];
                                    if (isMissingDesc) missingMsg.push("description");
                                    if (isNoFixtures) missingMsg.push("fixtures (0 selected)");
                                    if (isMissingQty) missingMsg.push("space quantity");
                                    if (isMissingFloorQty) missingMsg.push("floor quantity");

                                    const tooltipTitle = missingMsg.length > 0
                                      ? `Missing required value(s): ${missingMsg.join(", ")}`
                                      : s.flagged ? "Unflag space" : "Flag space";

                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                          const newFlagged = !s.flagged;
                                          setIopSpaces(prev => prev.map(item => targets.includes(item.id) ? { ...item, flagged: newFlagged } : item));
                                        }}
                                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group flex items-center justify-center"
                                        title={tooltipTitle}
                                      >
                                        <Flag 
                                          className={`size-3.5 transition-all duration-200 ${
                                            isFlagActive 
                                              ? "fill-red-500 text-red-500 scale-110" 
                                              : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
                                          }`} 
                                        />
                                      </button>
                                    );
                                  })()}
                                </div>
                              </td>
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
            <div className="xl:col-span-3 lg:col-span-4 flex flex-col gap-3">
              
              {/* Sizing Results Card */}
              <div className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-2 shadow-xs">
                <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
                  <div className="w-1 h-3 bg-[#0A7BC7] rounded-full"></div>
                  <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                </div>

                <div className="flex flex-col gap-1 font-sans text-xs">
                  <div className="flex justify-between items-center py-0.5 border-b border-border/30 text-[11px]">
                    <span className="font-semibold text-muted-foreground">Preset</span>
                    <span className="font-bold text-foreground text-right text-[10.5px]">{standardPreset === "dubai" ? "Dubai (DBC)" : standardPreset === "abudhabi" ? "Abu Dhabi (ADM)" : "IPC / UPC"}</span>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-border/30 text-[11px]">
                    <span className="font-semibold text-muted-foreground">Total Demand</span>
                    <strong className="font-bold text-foreground font-mono">{calculations.totalLU.toFixed(1)} {standardPreset === "dubai" ? "LU" : "WSFU"}</strong>
                  </div>
                  <div className="flex justify-between items-center py-0.5 border-b border-border/30 text-[11px]">
                    <span className="font-semibold text-muted-foreground">Peak Flow</span>
                    <strong className="font-bold text-[#0A7BC7] font-mono">{calculations.displayFlow}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 px-2 my-0.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 rounded-lg text-[10.5px]">
                    <span className="font-bold text-foreground uppercase tracking-wide text-[9.5px]">Pump Flow (Q)</span>
                    <strong className="font-extrabold text-[#0A7BC7] text-xs font-mono">{calculations.displaySelectedFlow}</strong>
                  </div>
                </div>
              </div>

              {/* Recommended Pipe Size Card */}
              <div className="bg-card border border-border rounded-2xl p-3 flex flex-col gap-2 shadow-xs">
                <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
                  <div className="w-1 h-3 bg-emerald-500 rounded-full"></div>
                  <h3 className="text-[10.5px] font-bold uppercase tracking-wider text-muted-foreground font-sans">🚰 Recommended Pipe</h3>
                </div>

                <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Nominal Size</span>
                    <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">DN{calculations.pipeSizing.sizeMM} mm</span>
                  </div>
                  <div className="text-right flex flex-col">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase">Capacity Limit</span>
                    <span className="text-xs font-mono font-bold text-foreground">{calculations.pipeSizing.maxFlowLPS} L/s</span>
                  </div>
                </div>

                {/* Collapsible / Compact Pipe Schedule Table */}
                <details className="group border border-border rounded-lg text-[10px]">
                  <summary className="p-1.5 font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-lg select-none">
                    <span>View Pipe Size Table (15–200mm)</span>
                    <span className="group-open:rotate-180 transition-transform text-[9px]">▼</span>
                  </summary>
                  <div className="overflow-x-auto overflow-y-auto max-h-48 p-1 border-t border-border custom-scrollbar">
                    <table className="w-full border-collapse font-mono text-[9px]">
                      <thead>
                        <tr className="text-muted-foreground font-bold border-b border-border text-[9px] bg-slate-100 dark:bg-slate-800">
                          <th className="p-1 text-center">Pipe (mm)</th>
                          <th className="p-1 text-center">WSFU</th>
                          <th className="p-1 text-center">Max L/s</th>
                          <th className="p-1 text-center">@ 4 fps</th>
                          <th className="p-1 text-center">@ 5 fps</th>
                          <th className="p-1 text-center">@ 6 fps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {PIPE_SIZING_TABLE.map((row) => {
                          const isMatch = calculations.pipeSizing.sizeMM === row.sizeMM;
                          return (
                            <tr key={row.sizeMM} className={`border-b border-border/30 ${isMatch ? "bg-emerald-500/25 font-extrabold text-emerald-800 dark:text-emerald-200" : ""}`}>
                              <td className="p-1 text-center font-bold">DN{row.sizeMM}</td>
                              <td className="p-1 text-center font-semibold">{row.wsfuRange}</td>
                              <td className="p-1 text-center">{row.flowMax}</td>
                              <td className="p-1 text-center">{row.q4fps.toFixed(2)}</td>
                              <td className="p-1 text-center">{row.q5fps.toFixed(2)}</td>
                              <td className="p-1 text-center">{row.q6fps.toFixed(2)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>

                <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-lg p-1.5 flex gap-1 text-[9.5px] text-muted-foreground">
                  <Info className="size-3 shrink-0 text-[#0A7BC7] mt-0.5" />
                  <span>DBC 2021 &amp; BS EN 806 limits (V &le; 1.5 - 2.0 m/s).</span>
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
          <button
            onClick={() => {
              const targetSpace = iopSpaces.find(s => s.id === contextMenu.spaceId);
              if (targetSpace) {
                setCommentTarget({ id: String(targetSpace.id), name: targetSpace.desc, type: 'space' });
                setAssignCommentOpen(true);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-blue-600 dark:text-blue-400"
          >
            <MessageSquare className="size-3.5" /> Add comment
          </button>
          {(() => {
            const targetSpace = iopSpaces.find(s => s.id === contextMenu.spaceId);
            const totalFixtures = Object.values(targetSpace?.fixtures || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
            const isMissingDesc = !targetSpace?.desc || targetSpace?.desc.trim() === "";
            const isNoFixtures = totalFixtures === 0;
            const isMissingQty = showSpaceQty && (!targetSpace?.qty || Number(targetSpace.qty) <= 0);
            const isMissingFloorQty = showFloorsCol && (!targetSpace?.floorQty || Number(targetSpace.floorQty) <= 0);
            const isMissingValues = isMissingDesc || isNoFixtures || isMissingQty || isMissingFloorQty;
            const isFlagActive = targetSpace?.flagged || isMissingValues;

            return (
              <button
                onClick={() => {
                  const targets = selectedIds.includes(contextMenu.spaceId) ? selectedIds : [contextMenu.spaceId];
                  const newFlagged = !targetSpace?.flagged;
                  setIopSpaces(prev => prev.map(s => targets.includes(s.id) ? { ...s, flagged: newFlagged } : s));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
              >
                <Flag className={`size-3.5 ${isFlagActive ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                {targetSpace?.flagged ? "Unflag Space" : isMissingValues ? "Flag Space (Warning Active)" : "Flag Space"}
              </button>
            );
          })()}
          <div className="my-1 border-t border-border/60"></div>
          <button
            onClick={handleBulkDelete}
            className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-semibold"
          >
            <Trash2 className="size-3.5" /> Delete Space(s)
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
            setIopSpaces(prev => {
              const next = prev.map(s => {
                if (String(s.id) === commentTarget.id) {
                  const comments = [...(s.comments || []), newComment];
                  return { ...s, comments };
                }
                return s;
              });

              const projId = project?.id || "default";
              try {
                const existingData = JSON.parse(localStorage.getItem(`mep_loading_unit_calc_${projId}`) || '{}');
                localStorage.setItem(`mep_loading_unit_calc_${projId}`, JSON.stringify({
                  ...existingData,
                  iopSpaces: next,
                  updatedAt: new Date().toISOString()
                }));
              } catch (e) {}
              return next;
            });
            toast.success(`Comment assigned on space "${commentTarget.name}"`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent("mep-notification-added"));
            }
          }}
        />
      )}
      {/* Double-Click Calculation Breakdown & Edit Modal */}
      {editingSpace && (
        <EditLoadingUnitRowModal
          space={editingSpace.space}
          rowIndex={(floorsGrouped[editingSpace.floor] || []).findIndex((sp) => sp.id === editingSpace.space.id) + 1 || 1}
          floorName={editingSpace.floor}
          standardPreset={standardPreset}
          activeWeights={activeWeights}
          showSpaceQty={showSpaceQty}
          showFloorsCol={showFloorsCol}
          onClose={() => setEditingSpace(null)}
          onSave={(updated) => {
            setIopSpaces((prev) =>
              prev.map((sp) =>
                sp.id === editingSpace.space.id
                  ? {
                      ...sp,
                      desc: updated.desc,
                      fixtures: updated.fixtures,
                      qty: updated.qty,
                      floorQty: updated.floorQty,
                    }
                  : sp
              )
            );
            setEditingSpace(null);
            toast.success(`Updated "${updated.desc || 'Space'}" parameters.`);
          }}
        />
      )}
    </AppShell>
  );
}

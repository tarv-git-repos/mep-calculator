import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { useAuth } from "@/contexts/AuthContext";
import { addPdfHeader, addPdfSignatureBlock, formatDateStr, resolveLatestReviewState } from "@/lib/pdfHelpers";
import { addExcelSignatureBlock } from "@/lib/excelHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { Trash2, Plus, Download, Save, Info, Droplet, Building2, Layers, Globe, Sparkles, FileSpreadsheet, MessageSquare, Copy, Calculator, X, FileText, SlidersHorizontal, Check, Filter, ArrowUpDown, Search, Flag, Gauge, RefreshCw } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { TBtn } from "@/components/workspace/Button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { downloadFile } from "@/lib/download";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";

interface OverheadTank {
  id: number;
  name: string;
  splitPct: number;
}

export const Route = createFileRoute("/plumbing-water-demand")({
  head: () => ({
    meta: [
      { title: "Water Demand & Tank Sizing Calculator — MEP Calc" },
      { name: "description", content: "Comprehensive water demand sizing tool for domestic, irrigation, swimming pool, fire fighting, and storage tank capacities." },
    ],
  }),
  component: WaterDemandPage,
});

interface WDRow {
  id: number;
  name: string;
  ppl: number;
  cat: string;
  lpd: number;
  multiplier?: number;
  autoDetected?: boolean;
  flagged?: boolean;
  comments?: any[];
}

interface IrrRow {
  id: number;
  area: number;
  vegType: string;
  lpd: number;
  flagged?: boolean;
  comments?: any[];
}

const WD_TYPE_MAP: Record<string, number> = {
  // Residential
  "Residential buildings (flat)": 300,
  "Villas": 350,
  "Mixed used residential": 350,
  "Labour accommodation": 150,
  // Office & Commercial
  "Offices": 60,
  "Headquarters": 80,
  "Commercial buildings": 100,
  "Mixed used commercial": 80,
  "Logistic, academic & business center": 75,
  // Retail & Leisure
  "Local plaza / retail / town center": 82,
  "Shops": 60,
  "Club house / recreation": 100,
  "Entertainment & leisure / theater": 60,
  "Theatre": 50,
  "Events": 50,
  // Hospitality
  "Hotels (per guest)": 300,
  "Hotels (per employee)": 80,
  "Restaurant (per meal)": 15,
  "Visitors": 40,
  // Education
  "Schools / university": 60,
  "Nursery / child care centre": 70,
  // Medical & Healthcare
  "Medical (per bed)": 450,
  "Day clinic (per medical practitioner) incl. visitors": 450,
  "Laboratory": 80,
  // Industrial
  "Manufacturing / mineral": 80,
  "Industrial (workshops / machinery / warehouse)": 80,
  "Guardhouse": 75,
  // Public & Assembly
  "Mosques": 60,
  "Public amenities": 50,
  // Custom
  "Custom Rate / Category": 100,
};

const IRR_TYPE_MAP: Record<string, number> = {
  "Palm Trees": 150,
  "Small Palm Tree": 75,
  "Ornamental trees": 80,
  "Mix Vegetation / Mixed Planting": 30,
  "Mix Vegetarian": 30,
  "Shrubs & hedges": 15,
  "Ground cover and succulents": 12,
  "Seasonal flowers and creepers": 12,
  "Lawn with pop-up sprays": 10,
};

const PRESET_STANDARDS = {
  dewa: {
    name: "DEWA / Dubai Municipality Guidelines",
    desc: "Standard Middle East domestic consumption rates (Flat: 300 LPD, Villa: 350 LPD, Office: 60 LPD).",
    multiplier: 1.0,
  },
  addc: {
    name: "ADDC / Abu Dhabi RSB Guidelines",
    desc: "Abu Dhabi Distribution Co. consumption standards (Flat: 270 LPD, Villa: 320 LPD, Office: 55 LPD).",
    multiplier: 0.9,
  },
  ipc: {
    name: "ASHRAE / IPC (International Plumbing Code)",
    desc: "US/International standard occupancy demand rates.",
    multiplier: 0.85,
  },
  cibse: {
    name: "BS 8558 / CIBSE Guide G Guidelines",
    desc: "UK & European CIBSE water supply & storage standards.",
    multiplier: 0.8,
  },
};

interface AutoDetectResult {
  people: number;
  cat?: string;
  autoDetected: boolean;
}

function detectAshraeOccupancy(desc: string): AutoDetectResult | null {
  if (!desc) return null;
  const clean = desc.trim().toLowerCase();

  let qty = 1;
  const qtyMatch = clean.match(/^(\d+)\s*(?:x|nos|no|units|flats|apartments|rooms|beds|seats|offices|classrooms|toilets|restrooms)?\s+/i);
  let textToScan = clean;

  if (qtyMatch) {
    const parsedQty = parseInt(qtyMatch[1], 10);
    if (!isNaN(parsedQty) && parsedQty > 0) {
      qty = parsedQty;
      textToScan = clean.substring(qtyMatch[0].length).trim();
    }
  }

  // Healthcare / Medical / Clinic / Lab
  if (textToScan.includes("day clinic") || textToScan.includes("practitioner") || textToScan.includes("polyclinic")) {
    return { people: qty * 5, cat: "Day clinic (per medical practitioner) incl. visitors", autoDetected: true };
  }
  if (
    textToScan.includes("hospital") ||
    textToScan.includes("clinic") ||
    textToScan.includes("patient room") ||
    textToScan.includes("bed") ||
    textToScan.includes("ward") ||
    textToScan.includes("medical")
  ) {
    return { people: qty * 2, cat: "Medical (per bed)", autoDetected: true };
  }
  if (textToScan.includes("lab") || textToScan.includes("laboratory") || textToScan.includes("diagnostic")) {
    return { people: qty * 15, cat: "Laboratory", autoDetected: true };
  }

  // Education
  if (
    textToScan.includes("classroom") ||
    textToScan.includes("class room") ||
    textToScan.includes("school") ||
    textToScan.includes("university") ||
    textToScan.includes("college") ||
    textToScan.includes("institute") ||
    textToScan.includes("lecture")
  ) {
    return { people: qty * 30, cat: "Schools / university", autoDetected: true };
  }
  if (
    textToScan.includes("nursery") ||
    textToScan.includes("child care") ||
    textToScan.includes("daycare") ||
    textToScan.includes("creche") ||
    textToScan.includes("kindergarten") ||
    textToScan.includes("kg")
  ) {
    return { people: qty * 20, cat: "Nursery / child care centre", autoDetected: true };
  }

  // Hospitality & Dining
  if (
    textToScan.includes("hotel room") ||
    textToScan.includes("hotel guest") ||
    textToScan.includes("guest room") ||
    textToScan.includes("hotel") ||
    textToScan.includes("resort")
  ) {
    return { people: qty * 2, cat: "Hotels (per guest)", autoDetected: true };
  }
  if (textToScan.includes("hotel staff") || textToScan.includes("hotel employee") || textToScan.includes("staff quarter")) {
    return { people: qty * 10, cat: "Hotels (per employee)", autoDetected: true };
  }
  if (
    textToScan.includes("restaurant") ||
    textToScan.includes("dining") ||
    textToScan.includes("cafeteria") ||
    textToScan.includes("cafe") ||
    textToScan.includes("food court") ||
    textToScan.includes("bistro") ||
    textToScan.includes("eatery")
  ) {
    return { people: qty * 40, cat: "Restaurant (per meal)", autoDetected: true };
  }
  if (textToScan.includes("visitor") || textToScan.includes("lobby") || textToScan.includes("reception") || textToScan.includes("waiting")) {
    return { people: qty * 20, cat: "Visitors", autoDetected: true };
  }

  // Industrial & Workshops
  if (textToScan.includes("manufacturing") || textToScan.includes("factory") || textToScan.includes("production") || textToScan.includes("mill")) {
    return { people: qty * 15, cat: "Manufacturing / mineral", autoDetected: true };
  }
  if (
    textToScan.includes("workshop") ||
    textToScan.includes("warehouse") ||
    textToScan.includes("depot") ||
    textToScan.includes("plant room") ||
    textToScan.includes("substation") ||
    textToScan.includes("mechanical room") ||
    textToScan.includes("pump room") ||
    textToScan.includes("industrial")
  ) {
    return { people: qty * 10, cat: "Industrial (workshops / machinery / warehouse)", autoDetected: true };
  }

  // Security / Guardhouse
  if (textToScan.includes("guard") || textToScan.includes("guardhouse") || textToScan.includes("security") || textToScan.includes("gatehouse")) {
    return { people: qty * 2, cat: "Guardhouse", autoDetected: true };
  }

  // Mosque & Public
  if (textToScan.includes("mosque") || textToScan.includes("prayer room") || textToScan.includes("masjid") || textToScan.includes("musalla")) {
    return { people: qty * 50, cat: "Mosques", autoDetected: true };
  }

  // Residential Studio / BHK / Villas
  if (textToScan.includes("studio")) {
    return { people: qty * 2, cat: "Residential buildings (flat)", autoDetected: true };
  }

  const bhkMatch = textToScan.match(/(\d+)\s*(?:bhk|bed|bedroom|br)\b/i);
  if (bhkMatch && bhkMatch[1]) {
    const bedrooms = parseInt(bhkMatch[1], 10);
    if (!isNaN(bedrooms) && bedrooms > 0) {
      const isVilla = clean.includes("villa") || clean.includes("house");
      return {
        people: qty * (bedrooms * 2),
        cat: isVilla ? "Villas" : "Residential buildings (flat)",
        autoDetected: true,
      };
    }
  }

  if (textToScan.includes("villa") || textToScan.includes("townhouse") || textToScan.includes("duplex")) {
    return { people: qty * 6, cat: "Villas", autoDetected: true };
  }

  if (textToScan.includes("flat") || textToScan.includes("apartment") || textToScan.includes("residential") || textToScan.includes("residence")) {
    return { people: qty * 4, cat: "Residential buildings (flat)", autoDetected: true };
  }

  if (textToScan.includes("labour") || textToScan.includes("labor") || textToScan.includes("worker") || textToScan.includes("camp")) {
    return { people: qty * 20, cat: "Labour accommodation", autoDetected: true };
  }

  // Restroom / Changing Room / Toilet / Amenities
  if (
    textToScan.includes("rest room") ||
    textToScan.includes("restroom") ||
    textToScan.includes("changing room") ||
    textToScan.includes("toilet") ||
    textToScan.includes("washroom") ||
    textToScan.includes("bathroom") ||
    textToScan.includes("wc")
  ) {
    return { people: qty * 15, cat: "Public amenities", autoDetected: true };
  }

  // Offices & Commercial
  if (textToScan.includes("office") || textToScan.includes("workstation") || textToScan.includes("desk") || textToScan.includes("cubicle")) {
    return { people: qty * 10, cat: "Offices", autoDetected: true };
  }
  if (textToScan.includes("headquarter") || textToScan.includes("hq")) {
    return { people: qty * 50, cat: "Headquarters", autoDetected: true };
  }
  if (textToScan.includes("commercial")) {
    return { people: qty * 25, cat: "Commercial buildings", autoDetected: true };
  }

  // Retail & Leisure
  if (textToScan.includes("shop") || textToScan.includes("retail") || textToScan.includes("store") || textToScan.includes("boutique") || textToScan.includes("supermarket")) {
    return { people: qty * 8, cat: "Shops", autoDetected: true };
  }
  if (textToScan.includes("plaza") || textToScan.includes("mall") || textToScan.includes("town center")) {
    return { people: qty * 100, cat: "Local plaza / retail / town center", autoDetected: true };
  }
  if (textToScan.includes("club") || textToScan.includes("recreation") || textToScan.includes("gym") || textToScan.includes("fitness")) {
    return { people: qty * 30, cat: "Club house / recreation", autoDetected: true };
  }
  if (textToScan.includes("theater") || textToScan.includes("theatre") || textToScan.includes("cinema") || textToScan.includes("auditorium")) {
    return { people: qty * 50, cat: "Theatre", autoDetected: true };
  }
  if (textToScan.includes("event") || textToScan.includes("exhibition") || textToScan.includes("banquet") || textToScan.includes("function hall")) {
    return { people: qty * 50, cat: "Events", autoDetected: true };
  }

  return null;
}

type Tab = "demand" | "tanks" | "report";

function WaterDemandPage() {
  const { project, activeProjectId, isReadOnly, forceSaveToCloud } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-water-demand", activeProjectId || project?.id);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-water-demand", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "System Admin";
  const currentUserId = userData?.id || profile?.id || "user_id";
  const isApprovedLocked = useCalculationLock("/plumbing-water-demand", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";

  type DemandSection = "domestic" | "irrigation" | "pool" | "fire";
  const [tab, setTab] = useState<Tab>("demand");
  const [demandSection, setDemandSection] = useState<DemandSection>("domestic");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [showUnitConfirmModal, setShowUnitConfirmModal] = useState<boolean>(false);
  const [showAddWdModal, setShowAddWdModal] = useState<boolean>(false);
  const [showAddIrrModal, setShowAddIrrModal] = useState<boolean>(false);
  const [pendingUnitTarget, setPendingUnitTarget] = useState<"si" | "ip" | null>(null);
  const [presetStandard, setPresetStandard] = useState<string>("dewa");
  const [intelOpen, setIntelOpen] = useState(false);

  const handleUnitSystemClick = (targetUnit: "si" | "ip") => {
    if (targetUnit === unitSystem) return;
    setPendingUnitTarget(targetUnit);
    setShowUnitConfirmModal(true);
  };

  const executeUnitSystemChange = (targetUnit: "si" | "ip", shouldConvert: boolean) => {
    if (shouldConvert) {
      const convArea = targetUnit === "ip" ? 10.7639 : 1 / 10.7639;
      const convDepth = targetUnit === "ip" ? 3.28084 : 1 / 3.28084;

      setIrrRows((prev) =>
        prev.map((r) => ({
          ...r,
          area: Math.max(1, Math.round(r.area * convArea)),
        }))
      );

      if (poolArea !== "") {
        setPoolArea(Math.max(1, Math.round(Number(poolArea) * convArea)));
      }
      if (poolDepth !== "") {
        setPoolDepth(Number((Number(poolDepth) * convDepth).toFixed(1)));
      }
    }

    setUnitSystem(targetUnit);
    setShowUnitConfirmModal(false);
    setPendingUnitTarget(null);
    toast.success(`Unit system switched to ${targetUnit === "ip" ? "Imperial (IP)" : "Metric (SI)"}`);
  };

  // Storage Tank & Transfer Pump Settings
  const [storageDays, setStorageDays] = useState<number>(1);
  const [groundTankPct, setGroundTankPct] = useState<number>(100);
  const [overheadTanks, setOverheadTanks] = useState<OverheadTank[]>([
    { id: 1, name: "Overhead Roof Tank 1", splitPct: 40 },
  ]);
  const [peakFactor, setPeakFactor] = useState<number>(2.5);
  const [fillWindowHours, setFillWindowHours] = useState<number>(2);

  const handleAddOverheadTank = () => {
    const newId = Date.now();
    setOverheadTanks((prev) => [
      ...prev,
      { id: newId, name: `Overhead Roof Tank ${prev.length + 1}`, splitPct: prev.length === 0 ? 40 : 20 },
    ]);
  };

  const handleRemoveOverheadTank = (id: number) => {
    setOverheadTanks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRenameOverheadTank = (id: number, name: string) => {
    setOverheadTanks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, name } : t))
    );
  };

  const handleUpdateOverheadTankPct = (id: number, splitPct: number) => {
    setOverheadTanks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, splitPct: Math.max(0, Math.min(100, splitPct)) } : t))
    );
  };

  // Domestic state
  const [wdRows, setWdRows] = useState<WDRow[]>([]);
  const [newWdName, setNewWdName] = useState("");
  const [newWdPeople, setNewWdPeople] = useState<number | "">("");
  const [newWdCat, setNewWdCat] = useState("");
  const [newWdCustomLpd, setNewWdCustomLpd] = useState<number | "">("");
  const [newWdMultiplier, setNewWdMultiplier] = useState<number | "">(1);
  const [newWdAutoDetected, setNewWdAutoDetected] = useState<boolean>(false);

  // Irrigation state
  const [irrRows, setIrrRows] = useState<IrrRow[]>([]);
  const [newIrrArea, setNewIrrArea] = useState<number | "">("");
  const [newIrrVegType, setNewIrrVegType] = useState("");

  // Pool state
  const [poolArea, setPoolArea] = useState<number | "">("");
  const [poolDepth, setPoolDepth] = useState<number | "">("");
  const [poolEvap, setPoolEvap] = useState<number>(10);
  const [poolComments, setPoolComments] = useState<any[]>([]);
  const [poolFlagged, setPoolFlagged] = useState<boolean>(false);

  // Fire state
  const [fireFlow, setFireFlow] = useState<number | "">("");
  const [fireComments, setFireComments] = useState<any[]>([]);
  const [fireFlagged, setFireFlagged] = useState<boolean>(false);

  // Comment Modal Target State
  const [commentTarget, setCommentTarget] = useState<{
    targetId: string;
    targetName: string;
    targetType: string;
    rowId?: number;
    isIrrigation?: boolean;
    isPool?: boolean;
    isFire?: boolean;
    existingComments?: any[];
  } | null>(null);

  // Double-Click Calculation Breakdown Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    type: "domestic" | "irrigation" | "summary" | "tank" | "pump" | "pool" | "fire";
    rowId?: number;
  } | null>(null);

  // Search, Filter, Sort state for toolbar
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCatFilter, setSelectedCatFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "ppl" | "lpd" | "load" | "none">("none");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const importFileRef = useRef<HTMLInputElement>(null);

  // Multi-selection state (Ctrl+Click, Shift+Click, Ctrl+A, Esc)
  const [selectedWdRows, setSelectedWdRows] = useState<Set<number>>(new Set());
  const [lastClickedWdIndex, setLastClickedWdIndex] = useState<number | null>(null);

  const [selectedIrrRows, setSelectedIrrRows] = useState<Set<number>>(new Set());
  const [lastClickedIrrIndex, setLastClickedIrrIndex] = useState<number | null>(null);

  // Dynamic Column Width Adjusting State
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    select: 48,
    name: 240,
    ppl: 110,
    multiplier: 120,
    cat: 220,
    lpd: 140,
    load: 130,
    actions: 90,
    irr_select: 48,
    irr_vegType: 240,
    irr_area: 130,
    irr_rate: 130,
    irr_load: 130,
    irr_actions: 90,
  });

  const startResizing = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey] || 120;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const minW = colKey.includes("select") ? 36 : colKey.includes("actions") ? 70 : 80;
      const newWidth = Math.max(minW, startWidth + (moveEvent.clientX - startX));
      setColWidths((prev) => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const activeFiltersCount = (selectedCatFilter ? 1 : 0) + (searchQuery.trim() ? 1 : 0);

  const handleResetFilters = () => {
    setSelectedCatFilter("");
    setSearchQuery("");
  };

  const handleResetSort = () => {
    setSortBy("none");
    setSortOrder("asc");
  };

  const handleQuickAddWd = () => {
    const newId = Date.now();
    const newEntry: WDRow = {
      id: newId,
      name: `New Water Entry ${wdRows.length + 1}`,
      ppl: 50,
      cat: "Offices",
      lpd: 60,
      autoDetected: false,
      comments: [],
    };
    setWdRows((prev) => [...prev, newEntry]);
    dirtyStore.set(true);
    toast.success(`Created "New Water Entry ${wdRows.length + 1}"`);
  };

  const handleImportExcelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });

        if (jsonData.length === 0) {
          toast.error("The uploaded Excel file is empty.");
          return;
        }

        let headerIdx = -1;
        let descCol = 0, pplCol = 1, catCol = 2, lpdCol = 3;

        for (let r = 0; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (Array.isArray(row) && row.length > 0) {
            const rowStr = row.map((c) => String(c || "").toLowerCase());
            if (rowStr.some((c) => c.includes("desc") || c.includes("name") || c.includes("room") || c.includes("people") || c.includes("unit"))) {
              headerIdx = r;
              rowStr.forEach((cell, idx) => {
                if (cell.includes("desc") || cell.includes("name") || cell.includes("room") || cell.includes("title")) descCol = idx;
                else if (cell.includes("people") || cell.includes("unit") || cell.includes("count") || cell.includes("ppl") || cell.includes("occ")) pplCol = idx;
                else if (cell.includes("cat") || cell.includes("type") || cell.includes("use")) catCol = idx;
                else if (cell.includes("lpd") || cell.includes("gpd") || cell.includes("rate") || cell.includes("per capita")) lpdCol = idx;
              });
              break;
            }
          }
        }

        const startRow = headerIdx >= 0 ? headerIdx + 1 : 0;
        const imported: WDRow[] = [];

        for (let r = startRow; r < jsonData.length; r++) {
          const row = jsonData[r];
          if (!Array.isArray(row) || row.length === 0) continue;
          const nameVal = String(row[descCol] || row[0] || "").trim();
          if (!nameVal) continue;
          const pplVal = Number(row[pplCol] || row[1]) || 1;
          const catVal = String(row[catCol] || row[2] || "").trim();
          const matchedCat = Object.keys(WD_TYPE_MAP).find((k) => k.toLowerCase() === catVal.toLowerCase()) || "Offices";
          const defaultLpd = WD_TYPE_MAP[matchedCat] || 60;
          const lpdVal = Number(row[lpdCol] || row[3]) || defaultLpd;

          imported.push({
            id: Date.now() + r + Math.floor(Math.random() * 1000),
            name: nameVal,
            ppl: pplVal,
            cat: matchedCat,
            lpd: lpdVal,
            autoDetected: false,
            comments: [],
          });
        }

        if (imported.length > 0) {
          setWdRows((prev) => [...prev, ...imported]);
          dirtyStore.set(true);
          toast.success(`Successfully imported ${imported.length} entries from "${file.name}"!`);
        } else {
          toast.error("No valid water demand entries found in the file.");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel file. Please ensure it is a valid .xlsx or .csv sheet.");
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredAndSortedWdRows = useMemo(() => {
    let list = [...wdRows];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => r.name.toLowerCase().includes(q) || r.cat.toLowerCase().includes(q));
    }
    if (selectedCatFilter) {
      list = list.filter((r) => r.cat === selectedCatFilter);
    }
    if (sortBy !== "none") {
      list.sort((a, b) => {
        let valA: any = a.name;
        let valB: any = b.name;
        if (sortBy === "ppl") {
          valA = a.ppl;
          valB = b.ppl;
        } else if (sortBy === "lpd") {
          valA = a.lpd;
          valB = b.lpd;
        } else if (sortBy === "load") {
          valA = a.ppl * a.lpd;
          valB = b.ppl * b.lpd;
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return sortOrder === "asc" ? valA - valB : valB - valA;
        }
        return sortOrder === "asc"
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }
    return list;
  }, [wdRows, searchQuery, selectedCatFilter, sortBy, sortOrder]);

  // Domestic selection handlers
  const toggleWdRowSelection = (id: number, isShift?: boolean, isCtrl?: boolean) => {
    setSelectedWdRows((prev) => {
      const list = filteredAndSortedWdRows;
      const clickedIndex = list.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift) {
        const pivotIndex = lastClickedWdIndex !== null ? lastClickedWdIndex : 0;
        const start = Math.min(pivotIndex, clickedIndex);
        const end = Math.max(pivotIndex, clickedIndex);

        if (!isCtrl) {
          next.clear();
        }

        for (let i = start; i <= end; i++) {
          if (list[i]) next.add(list[i].id);
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedWdIndex(clickedIndex);
      } else {
        if (next.has(id) && next.size === 1) {
          next.delete(id);
        } else {
          next.clear();
          next.add(id);
        }
        setLastClickedWdIndex(clickedIndex);
      }

      return next;
    });
  };

  const toggleSelectAllWd = () => {
    if (selectedWdRows.size === filteredAndSortedWdRows.length && filteredAndSortedWdRows.length > 0) {
      setSelectedWdRows(new Set());
    } else {
      setSelectedWdRows(new Set(filteredAndSortedWdRows.map((r) => r.id)));
    }
  };

  // Irrigation selection handlers
  const toggleIrrRowSelection = (id: number, isShift?: boolean, isCtrl?: boolean) => {
    setSelectedIrrRows((prev) => {
      const list = irrRows;
      const clickedIndex = list.findIndex((r) => r.id === id);
      if (clickedIndex === -1) return prev;

      const next = new Set(prev);

      if (isShift) {
        const pivotIndex = lastClickedIrrIndex !== null ? lastClickedIrrIndex : 0;
        const start = Math.min(pivotIndex, clickedIndex);
        const end = Math.max(pivotIndex, clickedIndex);

        if (!isCtrl) {
          next.clear();
        }

        for (let i = start; i <= end; i++) {
          if (list[i]) next.add(list[i].id);
        }
      } else if (isCtrl) {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        setLastClickedIrrIndex(clickedIndex);
      } else {
        if (next.has(id) && next.size === 1) {
          next.delete(id);
        } else {
          next.clear();
          next.add(id);
        }
        setLastClickedIrrIndex(clickedIndex);
      }

      return next;
    });
  };

  const toggleSelectAllIrr = () => {
    if (selectedIrrRows.size === irrRows.length && irrRows.length > 0) {
      setSelectedIrrRows(new Set());
    } else {
      setSelectedIrrRows(new Set(irrRows.map((r) => r.id)));
    }
  };

  // Keydown shortcuts for Ctrl+A, Escape, Delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Escape key: clear selection
      if (e.key === "Escape") {
        if (selectedWdRows.size > 0 || selectedIrrRows.size > 0) {
          e.preventDefault();
          setSelectedWdRows(new Set());
          setSelectedIrrRows(new Set());
          setLastClickedWdIndex(null);
          setLastClickedIrrIndex(null);
          toast.info("Cleared selection");
        }
        return;
      }

      // Skip shortcut keys if focused inside a text input / select box
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

      // 2. Ctrl+A / Cmd+A: Select All rows
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (tab === "demand" && demandSection === "domestic") {
          if (filteredAndSortedWdRows.length > 0) {
            setSelectedWdRows(new Set(filteredAndSortedWdRows.map((r) => r.id)));
            toast.info(`Selected all ${filteredAndSortedWdRows.length} domestic entry(s)`);
          }
        } else if (tab === "demand" && demandSection === "irrigation") {
          if (irrRows.length > 0) {
            setSelectedIrrRows(new Set(irrRows.map((r) => r.id)));
            toast.info(`Selected all ${irrRows.length} irrigation entry(s)`);
          }
        }
        return;
      }

      // 3. Delete / Backspace: Delete selected rows
      if (e.key === "Delete" || e.key === "Backspace") {
        if (tab === "demand" && demandSection === "domestic" && selectedWdRows.size > 0) {
          e.preventDefault();
          const count = selectedWdRows.size;
          setWdRows((prev) => prev.filter((r) => !selectedWdRows.has(r.id)));
          setSelectedWdRows(new Set());
          setLastClickedWdIndex(null);
          toast.info(`Deleted ${count} selected domestic entry(s)`);
        } else if (tab === "demand" && demandSection === "irrigation" && selectedIrrRows.size > 0) {
          e.preventDefault();
          const count = selectedIrrRows.size;
          setIrrRows((prev) => prev.filter((r) => !selectedIrrRows.has(r.id)));
          setSelectedIrrRows(new Set());
          setLastClickedIrrIndex(null);
          toast.info(`Deleted ${count} selected irrigation entry(s)`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedWdRows, selectedIrrRows, filteredAndSortedWdRows, irrRows, tab, demandSection]);

  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_water_demand_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.presetStandard) setPresetStandard(data.presetStandard);
        if (data.storageDays !== undefined) setStorageDays(data.storageDays);
        if (data.groundTankPct !== undefined) setGroundTankPct(data.groundTankPct);
        if (data.overheadTanks) setOverheadTanks(data.overheadTanks);
        if (data.peakFactor !== undefined) setPeakFactor(data.peakFactor);
        if (data.fillWindowHours !== undefined) setFillWindowHours(data.fillWindowHours);
        if (data.wdRows) setWdRows(data.wdRows);
        if (data.irrRows) setIrrRows(data.irrRows);
        if (data.colWidths) setColWidths(data.colWidths);
        if (data.poolArea !== undefined) setPoolArea(data.poolArea);
        if (data.poolDepth !== undefined) setPoolDepth(data.poolDepth);
        if (data.poolEvap !== undefined) setPoolEvap(data.poolEvap);
        if (data.poolComments) setPoolComments(data.poolComments);
        if (data.poolFlagged !== undefined) setPoolFlagged(data.poolFlagged);
        if (data.fireFlow !== undefined) setFireFlow(data.fireFlow);
        if (data.fireComments) setFireComments(data.fireComments);
        if (data.fireFlagged !== undefined) setFireFlagged(data.fireFlagged);
      } else {
        // Reset to defaults
        setUnitSystem("si");
        setPresetStandard("dewa");
        setStorageDays(1);
        setGroundTankPct(100);
        setOverheadTanks([{ id: 1, name: "Overhead Roof Tank 1", splitPct: 40 }]);
        setPeakFactor(2.5);
        setFillWindowHours(2);
        setWdRows([
          { id: 1, name: "Apartment Block A", ppl: 150, cat: "Residential buildings (flat)", lpd: 300, autoDetected: true, comments: [] },
          { id: 2, name: "Ground Floor Offices", ppl: 45, cat: "Offices", lpd: 60, autoDetected: true, comments: [] },
        ]);
        setIrrRows([
          { id: 1, area: 120, vegType: "Lawn with pop-up sprays", lpd: 10, comments: [] },
          { id: 2, area: 15, vegType: "Palm Trees", lpd: 150, comments: [] },
        ]);
        setPoolArea("");
        setPoolDepth("");
        setPoolEvap(10);
        setPoolComments([]);
        setPoolFlagged(false);
        setFireFlow("");
        setFireComments([]);
        setFireFlagged(false);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load water demand calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        presetStandard,
        storageDays,
        groundTankPct,
        overheadTanks,
        peakFactor,
        fillWindowHours,
        wdRows,
        newWdName,
        newWdPeople,
        newWdCat,
        irrRows,
        newIrrArea,
        newIrrVegType,
        poolArea,
        poolDepth,
        poolEvap,
        poolComments,
        poolFlagged,
        fireFlow,
        fireComments,
        fireFlagged,
        colWidths,
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [
    project?.id,
    loadedProjectId,
    unitSystem,
    presetStandard,
    storageDays,
    groundTankPct,
    overheadTanks,
    peakFactor,
    fillWindowHours,
    wdRows,
    newWdName,
    newWdPeople,
    newWdCat,
    irrRows,
    newIrrArea,
    newIrrVegType,
    poolArea,
    poolDepth,
    poolEvap,
    poolComments,
    poolFlagged,
    fireFlow,
    fireComments,
    fireFlagged,
    colWidths,
  ]);

  const handleSaveCurrent = () => {
    try {
      const dataToSave = {
        unitSystem,
        presetStandard,
        storageDays,
        groundTankPct,
        overheadTanks,
        peakFactor,
        fillWindowHours,
        wdRows,
        irrRows,
        poolArea,
        poolDepth,
        poolEvap,
        fireFlow,
        colWidths,
      };
      localStorage.setItem(`mep_water_demand_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(false);
      if (forceSaveToCloud) forceSaveToCloud();
      toast.success("Water Demand Calculation saved to project successfully!");
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  // Core Calculations
  const calculations = useMemo(() => {
    // Domestic Total
    let totalPeople = 0;
    let totalWaterL = 0;
    wdRows.forEach((r) => {
      const mult = r.multiplier && r.multiplier > 0 ? r.multiplier : 1;
      totalPeople += r.ppl * mult;
      totalWaterL += r.ppl * r.lpd * mult;
    });

    // Irrigation Total
    let totalIrrL = 0;
    irrRows.forEach((r) => {
      totalIrrL += r.area * r.lpd;
    });

    // Pool Total
    const pAreaVal = Number(poolArea) || 0;
    const pDepthVal = Number(poolDepth) || 0;
    const poolVolL = pAreaVal * pDepthVal * 1000;
    const poolDemandL = poolVolL * (poolEvap / 100);

    // Fire Total
    const fFlowGPM = Number(fireFlow) || 0;
    const fireLPM = fFlowGPM * 3.78541;
    const fireCapL = fireLPM * 60; // 60 mins reserve

    // Grand Total Daily Demand (Domestic + Irrigation + Pool Makeup)
    const grandTotalL = totalWaterL + totalIrrL + poolDemandL;

    // Storage Tank Calculations
    const reqStorageL = grandTotalL * (storageDays || 1);
    const reqStorageM3 = reqStorageL / 1000;
    const reqStorageGal = reqStorageL / 3.78541;

    const totalOverheadPct = overheadTanks.reduce(
      (sum, t) => sum + (Number(t.splitPct) || 0),
      0
    );
    const groundPct = Number(groundTankPct) || 100;

    const groundTankL = reqStorageL * (groundPct / 100);
    const roofTankL = reqStorageL * (totalOverheadPct / 100);

    // Dimensions helper (assuming rectangular cube with H ~ 2.2m for ground, H ~ 1.5m for roof)
    const estimateDimensions = (volM3: number, hDefault: number) => {
      if (volM3 <= 0) return { l: 0, w: 0, h: 0 };
      const h = hDefault;
      const baseArea = volM3 / h;
      const w = Math.sqrt(baseArea / 1.5);
      const l = w * 1.5;
      return {
        l: Math.round(l * 100) / 100,
        w: Math.round(w * 100) / 100,
        h: Math.round(h * 100) / 100,
      };
    };

    const groundDim = estimateDimensions(groundTankL / 1000, 2.2);

    // Unit Formatter
    const formatVol = (liters: number) => {
      if (ip) {
        return `${Math.round(liters / 3.78541).toLocaleString()} gal`;
      }
      return `${Math.round(liters).toLocaleString()} L`;
    };

    const formatRate = (litersPerDay: number) => {
      if (ip) {
        return `${Math.round(litersPerDay / 3.78541).toLocaleString()} gal/day`;
      }
      return `${Math.round(litersPerDay).toLocaleString()} L/day`;
    };

    const overheadTanksCalculated = overheadTanks.map((t) => {
      const pct = Number(t.splitPct) || 0;
      const volL = reqStorageL * (pct / 100);
      const dim = estimateDimensions(volL / 1000, 1.5);
      return {
        ...t,
        volL,
        sharePct: pct,
        dim,
        displayVol: formatVol(volL),
      };
    });

    // Peak Demand & Transfer Pump Flow
    const peakFactorVal = peakFactor || 2.5;
    const peakHourlyFlowL = (totalWaterL * peakFactorVal) / 10; // Peak 10-hr operating window
    const peakLPS = peakHourlyFlowL / 3600;
    const peakGPM = (peakHourlyFlowL / 3.78541) / 60;

    const fillHrs = fillWindowHours || 2;
    const transferPumpFlowLPH = roofTankL > 0 ? roofTankL / fillHrs : totalWaterL / fillHrs;
    const transferPumpLPS = transferPumpFlowLPH / 3600;
    const transferPumpGPM = (transferPumpFlowLPH / 3.78541) / 60;

    return {
      totalPeople,
      totalWaterL,
      totalIrrL,
      poolVolL,
      poolDemandL,
      fireLPM,
      fireCapL,
      grandTotalL,
      reqStorageL,
      reqStorageM3,
      reqStorageGal,
      totalOverheadPct,
      groundPct,
      groundTankL,
      roofTankL,
      groundDim,
      overheadTanksCalculated,
      peakHourlyFlowL,
      peakLPS,
      peakGPM,
      transferPumpFlowLPH,
      transferPumpLPS,
      transferPumpGPM,
      displayDomestic: formatRate(totalWaterL),
      displayDomesticPeak: ip
        ? `${Math.round(peakGPM).toLocaleString()} GPM`
        : `${peakLPS.toFixed(2)} L/s`,
      displayIrrigation: formatRate(totalIrrL),
      displayPoolVol: formatVol(poolVolL),
      displayPoolDemand: formatRate(poolDemandL),
      displayFireLPM: `${fireLPM.toFixed(1)} L/min (${fFlowGPM} GPM)`,
      displayFireCap: formatVol(fireCapL),
      displayGrandTotal: formatRate(grandTotalL),
      displayTotalStorage: ip
        ? `${Math.round(reqStorageGal).toLocaleString()} gal (${(reqStorageM3 * 35.3147).toFixed(1)} ft³)`
        : `${Math.round(reqStorageL).toLocaleString()} L (${reqStorageM3.toFixed(2)} m³)`,
      displayGroundTank: formatVol(groundTankL),
      displayRoofTank: formatVol(roofTankL),
      displayTransferPump: ip
        ? `${transferPumpGPM.toFixed(1)} GPM`
        : `${transferPumpLPS.toFixed(2)} L/s (${Math.round(transferPumpFlowLPH)} L/hr)`,
    };
  }, [
    wdRows,
    irrRows,
    poolArea,
    poolDepth,
    poolEvap,
    fireFlow,
    storageDays,
    groundTankPct,
    overheadTanks,
    peakFactor,
    fillWindowHours,
    ip,
  ]);

  // Domestic Handlers
  const handleAddWd = () => {
    if (!newWdName.trim()) {
      toast.error("Please enter a description for the space");
      return;
    }
    const cat = newWdCat || "Offices";
    let lpd = 0;
    if (cat === "Custom Rate / Category") {
      const userVal = newWdCustomLpd !== "" ? Number(newWdCustomLpd) : 100;
      lpd = unitSystem === "ip" ? Math.round(userVal * 3.78541) : userVal;
    } else {
      const baseLpd = WD_TYPE_MAP[cat] || 60;
      const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
      lpd = Math.round(baseLpd * mult);
    }

    const multVal = newWdMultiplier !== "" && Number(newWdMultiplier) > 0 ? Number(newWdMultiplier) : 1;
    const pplVal = newWdPeople !== "" ? Math.max(0, Number(newWdPeople)) : 1;

    setWdRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newWdName.trim(),
        ppl: pplVal,
        cat: cat,
        lpd,
        multiplier: multVal,
        autoDetected: newWdAutoDetected,
        comments: [],
      },
    ]);
    toast.success(`Added "${newWdName.trim()}"`);
    setNewWdName("");
    setNewWdPeople("");
    setNewWdCat("");
    setNewWdCustomLpd("");
    setNewWdMultiplier(1);
    setNewWdAutoDetected(false);
    setShowAddWdModal(false);
  };

  // Irrigation Handlers
  const handleAddIrr = () => {
    const areaVal = Number(newIrrArea);
    if (!areaVal || areaVal <= 0) {
      toast.error("Please enter a valid landscape area");
      return;
    }
    const vegType = newIrrVegType || "Lawn with pop-up sprays";
    const lpd = IRR_TYPE_MAP[vegType] || 10;

    setIrrRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        area: areaVal,
        vegType,
        lpd,
        comments: [],
      },
    ]);
    toast.success(`Added "${vegType}" (${areaVal} ${unitSystem === "ip" ? "ft²" : "m²"})`);
    setNewIrrArea("");
    setNewIrrVegType("");
    setShowAddIrrModal(false);
  };

  const handleWdRowChange = (id: number, field: "name" | "ppl" | "cat" | "lpd" | "multiplier", val: any) => {
    setWdRows(
      wdRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === "name") {
          const detected = detectAshraeOccupancy(val);
          if (detected) {
            updated.ppl = detected.people;
            if (detected.cat) {
              updated.cat = detected.cat;
              const baseLpd = WD_TYPE_MAP[detected.cat] || 0;
              const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
              updated.lpd = Math.round(baseLpd * mult);
            }
            updated.autoDetected = true;
          }
        } else if (field === "cat" && val !== "Custom Rate / Category") {
          const baseLpd = WD_TYPE_MAP[val] || 0;
          const mult = PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0;
          updated.lpd = Math.round(baseLpd * mult);
        }
        return updated;
      })
    );
  };

  const handleIrrRowChange = (id: number, field: "area" | "vegType", val: any) => {
    setIrrRows(
      irrRows.map((r) => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === "vegType") {
          updated.lpd = IRR_TYPE_MAP[val] || 0;
        }
        return updated;
      })
    );
  };

  // Save comment to row & dispatch notifications
  const handleSaveRowComment = async (comment: any) => {
    if (!commentTarget) return;
    const { rowId, isIrrigation, isPool, isFire, targetName, targetType } = commentTarget;

    const enrichedComment = {
      ...comment,
      calculatorTitle: "Water Demand Calculator",
      calculatorPath: "/plumbing-water-demand",
      targetId: String(rowId || (isPool ? "swimming_pool" : isFire ? "fire_fighting" : "water_demand")),
      targetName,
      targetType,
      projectId: project?.id || "default",
      projectName: project?.name || "MEP Calculator Project",
    };

    if (isPool) {
      setPoolComments((prev) => [enrichedComment, ...prev]);
    } else if (isFire) {
      setFireComments((prev) => [enrichedComment, ...prev]);
    } else if (isIrrigation) {
      setIrrRows((prev) =>
        prev.map((r) => {
          if (r.id === rowId) {
            const nextComments = [enrichedComment, ...(r.comments || [])];
            return { ...r, comments: nextComments };
          }
          return r;
        })
      );
    } else {
      setWdRows((prev) =>
        prev.map((r) => {
          if (r.id === rowId) {
            const nextComments = [enrichedComment, ...(r.comments || [])];
            return { ...r, comments: nextComments };
          }
          return r;
        })
      );
    }

    dispatchGlobalCommentNotification(enrichedComment, {
      project,
      currentUserName,
      currentUserId,
    });

    toast.success("Task comment added & notification dispatched to selected users!");
    setCommentTarget(null);
  };

  const handleToggleWdFlag = (id: number) => {
    setWdRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.flagged;
          toast.info(nextState ? `Flagged "${r.name}" for review` : `Unflagged "${r.name}"`);
          return { ...r, flagged: nextState };
        }
        return r;
      })
    );
  };

  const handleToggleIrrFlag = (id: number) => {
    setIrrRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          const nextState = !r.flagged;
          toast.info(nextState ? `Flagged "${r.vegType}" for review` : `Unflagged "${r.vegType}"`);
          return { ...r, flagged: nextState };
        }
        return r;
      })
    );
  };

  // Helper for safe autoTable calling across bundler variations
  const callAutoTable = (pdfDoc: any, options: any) => {
    if (typeof autoTable === "function") {
      autoTable(pdfDoc, options);
    } else if (typeof (autoTable as any)?.default === "function") {
      (autoTable as any).default(pdfDoc, options);
    } else if (typeof pdfDoc.autoTable === "function") {
      pdfDoc.autoTable(options);
    } else {
      console.error("autoTable function not available");
    }
  };

  // PDF Exporter
  const handleExportPDF = () => {
    try {
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");
      const projId = project?.id || "default";

      let currentY = addPdfHeader(
        doc,
        "Water Demand & Tank Sizing Calculation Report",
        {
          calcNo: project?.calcNo || "TRV-CAL-101-R01",
          projectNo: project?.code || project?.projectNo || "P000",
          projectName: project?.name || "MEP Calculator Project",
          client: project?.client || "",
          endUser: project?.endUser || project?.location || "",
          date: formatDateStr(new Date().toISOString()),
        }
      );

      // Section 1: Executive Summary Card Table
      callAutoTable(doc, {
        startY: currentY + 4,
        margin: { left: 14, right: 14 },
        head: [["Calculated Parameter", "Value", "Unit / Metric", "Engineering Standard"]],
        body: [
          ["Domestic Daily Water Demand", calculations.displayDomestic, ip ? "gal/day" : "L/day", PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name || "DEWA Guidelines"],
          ["Domestic Peak Flow Rate", calculations.displayDomesticPeak, ip ? "GPM" : "L/s", `Peak Multiplier K = ${peakFactor}`],
          ["Irrigation Daily Water Load", calculations.displayIrrigation, ip ? "gal/day" : "L/day", "Landscaping Area Schedule"],
          ["Pool Daily Makeup Water", calculations.displayPoolDemand, ip ? "gal/day" : "L/day", `Evaporation Rate = ${poolEvap}%/day`],
          ["GRAND TOTAL DAILY DEMAND", calculations.displayGrandTotal, ip ? "gal/day" : "L/day", "Combined Site Daily Load"],
          ["Required Storage Tank Volume", calculations.displayTotalStorage, ip ? "gal" : "m³", `${storageDays} Day(s) Retention`],
          ["Ground Water Tank (Break Tank)", calculations.displayGroundTank, ip ? "gal" : "L", `Ground Split: ${calculations.groundPct}%`],
          ["Overhead Roof Tank Total", calculations.displayRoofTank, ip ? "gal" : "L", `Roof Split: ${calculations.totalOverheadPct}%`],
          ["Transfer Pump Flow Rate", calculations.displayTransferPump, ip ? "GPM" : "L/s", `${fillWindowHours}-Hr Filling Window`],
        ],
        theme: "grid",
        headStyles: { fillColor: [10, 123, 199], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 }, 1: { fontStyle: "bold", textColor: [10, 123, 199] } },
      });

      currentY = (doc as any).lastAutoTable?.finalY || 100;

      // Section 2: Domestic Schedule
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text("Section 1: Domestic Water Demand Schedule", 14, currentY + 8);

      callAutoTable(doc, {
        startY: currentY + 11,
        margin: { left: 14, right: 14 },
        head: [["S.No", "Description", "People / Unit", "Qty / Multiplier", "Category", ip ? "Rate (gpd)" : "Rate (LPD)", ip ? "Total (gal)" : "Total (L)"]],
        body: [
          ...wdRows.map((r, idx) => [
            idx + 1,
            r.name,
            r.ppl,
            `×${r.multiplier || 1}`,
            r.cat,
            ip ? Math.round(r.lpd / 3.78541) : r.lpd,
            ip ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541).toLocaleString() : (r.ppl * r.lpd * (r.multiplier || 1)).toLocaleString(),
          ]),
          ["", "TOTAL DOMESTIC LOAD", calculations.totalPeople, "", "", "", calculations.displayDomestic],
        ],
        theme: "striped",
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
      });

      currentY = (doc as any).lastAutoTable?.finalY || 180;

      // Section 3: Irrigation & Storage Dimensions
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.text("Section 2: Irrigation & Storage Tank Physical Sizing", 14, currentY + 8);

      callAutoTable(doc, {
        startY: currentY + 11,
        margin: { left: 14, right: 14 },
        head: [["Category", "Vegetation / Tank", "Area / Volume", "Rate / Ratio", "Total Output & Dimensions"]],
        body: [
          ...irrRows.map((r) => [
            "Irrigation",
            r.vegType,
            `${r.area} ${ip ? "ft²" : "m²"}`,
            ip ? `${(r.lpd / 40.7458).toFixed(2)} gal/ft²` : `${r.lpd} L/m²`,
            ip ? `${Math.round((r.area * r.lpd) / 3.78541).toLocaleString()} gal` : `${(r.area * r.lpd).toLocaleString()} L`,
          ]),
          ["Ground Tank", "Reinforced Concrete / GRP", `${(calculations.groundTankL / 1000).toFixed(2)} m³`, `${calculations.groundPct}% Share`, `${calculations.groundDim.l}m L × ${calculations.groundDim.w}m W × ${calculations.groundDim.h}m H`],
          ...calculations.overheadTanksCalculated.map((t) => [
            t.name,
            "Modular Sectional Tank",
            `${(t.volL / 1000).toFixed(2)} m³`,
            `${t.sharePct.toFixed(0)}% Share`,
            `${t.dim.l}m L × ${t.dim.w}m W × ${t.dim.h}m H`,
          ]),
        ],
        theme: "grid",
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontSize: 8.5 },
        bodyStyles: { fontSize: 8 },
      });

      currentY = (doc as any).lastAutoTable?.finalY || 240;

      // Add signature block
      const reviewDetails = resolveLatestReviewState(projId, "/plumbing-water-demand");
      addPdfSignatureBlock(
        doc,
        currentY,
        reviewDetails || currentUserName,
        projId,
        "/plumbing-water-demand"
      );

      doc.save(`Water_Demand_Report_${Date.now()}.pdf`);
      toast.success("PDF calculation report generated successfully!");
    } catch (e) {
      console.error("PDF Export error:", e);
      toast.error("Failed to generate PDF report.");
    }
  };

  // Excel Exporter using ExcelJS
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Water Demand & Tank Sizing");

      // Title Banner
      sheet.mergeCells("A1:G1");
      const titleCell = sheet.getCell("A1");
      titleCell.value = "WATER DEMAND & STORAGE TANK SIZING REPORT";
      titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0A7BC7" } };
      titleCell.alignment = { horizontal: "center", vertical: "middle" };
      sheet.getRow(1).height = 30;

      sheet.addRow([]);

      // Section 1: Executive Summary
      sheet.addRow(["EXECUTIVE SIZING SUMMARY"]);
      sheet.getRow(3).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0A7BC7" } };

      const summaryHeaders = ["Parameter", "Calculated Value", "Unit System", "Design Standard / Code"];
      const sRow = sheet.addRow(summaryHeaders);
      sRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      sRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
      });

      const summaryData = [
        ["Domestic Daily Demand", calculations.displayDomestic, ip ? "gal/day" : "L/day", PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name || "DEWA"],
        ["Domestic Peak Flow Rate", calculations.displayDomesticPeak, ip ? "GPM" : "L/s", `Peak Diversity Factor = ${peakFactor}`],
        ["Irrigation Daily Load", calculations.displayIrrigation, ip ? "gal/day" : "L/day", "Landscaping Area Schedule"],
        ["Pool Makeup Water", calculations.displayPoolDemand, ip ? "gal/day" : "L/day", `Evaporation Rate = ${poolEvap}%`],
        ["GRAND TOTAL DAILY DEMAND", calculations.displayGrandTotal, ip ? "gal/day" : "L/day", "Combined Site Consumption"],
        ["Total Storage Requirement", calculations.displayTotalStorage, ip ? "gal" : "m³", `${storageDays} Day(s) Retention`],
        ["Ground Break Tank Capacity", calculations.displayGroundTank, ip ? "gal" : "L", `Split Allocation: ${calculations.groundPct}%`],
        ...calculations.overheadTanksCalculated.map((t) => [
          `${t.name} Capacity`,
          t.displayVol,
          ip ? "gal" : "L",
          `Split Allocation: ${t.sharePct.toFixed(0)}%`,
        ]),
        ["Transfer Pump Duty Flow", calculations.displayTransferPump, ip ? "GPM" : "L/s", `${fillWindowHours}-Hour Roof Tank Filling Window`],
      ];

      summaryData.forEach((r) => sheet.addRow(r));
      sheet.addRow([]);

      // Section 2: Domestic Schedule Table
      sheet.addRow(["DOMESTIC WATER DEMAND SCHEDULE"]);
      const dTitleRow = sheet.getRow(sheet.rowCount);
      dTitleRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0A7BC7" } };

      const domHeaders = ["S.No", "Description", "No. of People", "Space Qty (Multiplier)", "Category", ip ? "Rate (gpd)" : "Rate (LPD)", ip ? "Total (gal/day)" : "Total (L/day)"];
      const dHeaderRow = sheet.addRow(domHeaders);
      dHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      dHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF06456F" } };
      });

      wdRows.forEach((r, idx) => {
        sheet.addRow([
          idx + 1,
          r.name,
          r.ppl,
          r.multiplier || 1,
          r.cat,
          ip ? Math.round(r.lpd / 3.78541) : r.lpd,
          ip ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541) : r.ppl * r.lpd * (r.multiplier || 1),
        ]);
      });

      sheet.addRow(["TOTAL", "DOMESTIC TOTAL", calculations.totalPeople, "", "", "", ip ? Math.round(calculations.totalWaterL / 3.78541) : calculations.totalWaterL]);
      sheet.getRow(sheet.rowCount).font = { name: "Arial", size: 10, bold: true };
      sheet.addRow([]);

      // Section 3: Irrigation Schedule
      sheet.addRow(["IRRIGATION SCHEDULE"]);
      sheet.getRow(sheet.rowCount).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0A7BC7" } };

      const irrHeaders = ["S.No", "Vegetation Type", ip ? "Area (ft²)" : "Area (m²)", ip ? "Rate (gal/ft²)" : "Rate (L/m²)", ip ? "Total Load (gal)" : "Total Load (L)"];
      const iHeaderRow = sheet.addRow(irrHeaders);
      iHeaderRow.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      iHeaderRow.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF06456F" } };
      });

      irrRows.forEach((r, idx) => {
        sheet.addRow([
          idx + 1,
          r.vegType,
          r.area,
          ip ? Number((r.lpd / 40.7458).toFixed(2)) : r.lpd,
          ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd,
        ]);
      });

      sheet.addRow(["TOTAL", "IRRIGATION TOTAL", "", "", ip ? Math.round(calculations.totalIrrL / 3.78541) : calculations.totalIrrL]);
      sheet.getRow(sheet.rowCount).font = { name: "Arial", size: 10, bold: true };
      sheet.addRow([]);

      // Auto width
      sheet.columns.forEach((col) => {
        col.width = 25;
      });

      // Signature block
      const sigRow = sheet.rowCount + 2;
      addExcelSignatureBlock(
        sheet,
        sigRow,
        currentUserName,
        project?.id || "default",
        "/plumbing-water-demand",
        7
      );

      const buffer = await workbook.xlsx.writeBuffer();
      saveAs(new Blob([buffer]), `Water_Demand_Report_${Date.now()}.xlsx`);
      toast.success("Excel report generated successfully!");
    } catch (e) {
      console.error("Excel Export error:", e);
      toast.error("Failed to export Excel report.");
    }
  };

  return (
    <AppShell title="Water Demand & Tank Sizer" hideSubHeader={true} onIntelClick={() => setIntelOpen((v) => !v)} intelOpen={intelOpen}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          {/* Header Bar */}
          <div className="flex justify-between items-start select-none flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[26px] font-extrabold tracking-tight text-foreground mt-0.5">
                  Water Demand &amp; Tank Sizer
                </h1>
                <button 
                  type="button"
                  onClick={() => setIntelOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-xs font-medium border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-[#E8F2FC] text-[#0A7BC7] dark:bg-[#0C2538] dark:text-[#38BDF8] border-[#BCE0FD] dark:border-[#1E4968] hover:bg-[#D4E8FA] dark:hover:bg-[#10324C]"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-water-demand" calculatorTitle="Water Demand Calculator" />
              </div>
              <p className="text-[13px] text-muted-foreground mt-0.5">
                Calculate daily domestic water load, peak flow rate, irrigation demand, pool makeup, storage tank volumes, and transfer pump capacities.
              </p>

            </div>
          </div>

          {/* Unified White Card Container (Matching Ventilation Layout Structure) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED" 
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
            : calcReviewState?.status === "REJECTED"
            ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
            : calcReviewState?.status === "REVIEWED"
            ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"}`}>
            {/* Row 1: Header / Main Tabs on Left + Standard & Unit System Toggle on Right */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50 gap-4 flex-wrap">
              <div className="flex bg-slate-100 dark:bg-slate-900/70 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setTab("demand")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "demand"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Demand Sizing
                </button>

                <button
                  type="button"
                  onClick={() => setTab("tanks")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "tanks"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Storage &amp; Pumps
                </button>

                <button
                  type="button"
                  onClick={() => setTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                    tab === "report"
                      ? "bg-background text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Report
                </button>
              </div>

              {/* Right Side Header Controls */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-1 px-3 rounded-full border border-border/80 text-xs font-semibold select-none">
                  <Globe className="size-3.5 text-[#0A7BC7] shrink-0" />
                  <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Standard:</label>
                  <select
                    value={presetStandard}
                    onChange={(e) => setPresetStandard(e.target.value)}
                    className="bg-background border border-border/60 rounded-full px-2.5 py-0.5 text-xs font-bold text-foreground outline-none focus:border-[#0A7BC7] shadow-2xs cursor-pointer h-7"
                    title={PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.desc}
                  >
                    {Object.keys(PRESET_STANDARDS).map((key) => (
                      <option key={key} value={key}>
                        {PRESET_STANDARDS[key as keyof typeof PRESET_STANDARDS].name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center bg-slate-50 dark:bg-slate-900/60 p-1 rounded-full border border-border/80 text-xs font-semibold select-none">
                  <button
                    type="button"
                    onClick={() => handleUnitSystemClick("ip")}
                    className={`px-3 py-1 rounded-full transition cursor-pointer font-bold text-xs ${
                      unitSystem === "ip"
                        ? "bg-background text-[#0A7BC7] shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    IP (GPD / Imperial)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUnitSystemClick("si")}
                    className={`px-3 py-1 rounded-full transition cursor-pointer font-bold text-xs ${
                      unitSystem === "si"
                        ? "bg-background text-[#0A7BC7] shadow-2xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    SI (LPD / Metric)
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Action Toolbar (Search, Filter, Sort, Import, Export PDF, Auto-Calculate, + New Entry) */}
            {tab !== "report" && (
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 shrink-0 select-none no-print border-b border-border/50 gap-3 flex-wrap">
                {/* Left Side: Search Filter & Sort Options */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex items-center">
                    <Search className="size-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter entries..."
                      className="h-8 w-48 pl-8 pr-3 bg-background border border-border rounded-full text-xs outline-none focus:border-[#0A7BC7] transition-all"
                    />
                  </div>

                  {/* Filter Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer group overflow-visible ${
                          activeFiltersCount > 0
                            ? "bg-[#0A7BC7]/10 border-[#0A7BC7]/45 text-[#0A7BC7] font-medium"
                            : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                        }`}
                        title="Filter entries"
                      >
                        <Filter className="size-3.5 shrink-0" />
                        {activeFiltersCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-[#0A7BC7] text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
                            {activeFiltersCount}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <span className="text-xs font-semibold text-foreground">Filters</span>
                        {activeFiltersCount > 0 && (
                          <button onClick={handleResetFilters} className="text-[10px] text-[#0A7BC7] hover:underline font-semibold cursor-pointer">
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Occupancy Category</span>
                        <select
                          value={selectedCatFilter}
                          onChange={(e) => setSelectedCatFilter(e.target.value)}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="">All Categories</option>
                          {Object.keys(WD_TYPE_MAP).map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* Sort Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer group overflow-visible ${
                          sortBy !== "none"
                            ? "bg-[#0A7BC7]/10 border-[#0A7BC7]/45 text-[#0A7BC7] font-medium"
                            : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                        }`}
                        title="Sort entries"
                      >
                        <ArrowUpDown className="size-3.5 shrink-0" />
                        {sortBy !== "none" && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-[#0A7BC7] text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <span className="text-xs font-semibold text-foreground">Sort Options</span>
                        {sortBy !== "none" && (
                          <button onClick={handleResetSort} className="text-[10px] text-[#0A7BC7] hover:underline font-semibold cursor-pointer">
                            Reset Sort
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</label>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="h-8 w-full px-2 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="none">Default Order</option>
                          <option value="name">Description Name</option>
                          <option value="ppl">People / Units Count</option>
                          <option value="lpd">Per Capita Rate (LPD)</option>
                          <option value="load">Daily Water Load</option>
                        </select>
                      </div>
                      {sortBy !== "none" && (
                        <div className="flex items-center justify-between pt-1 border-t border-border/60">
                          <span className="text-[11px] font-semibold text-muted-foreground">Order</span>
                          <button
                            onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                            className="px-2 py-1 text-[11px] font-bold text-[#0A7BC7] bg-[#0A7BC7]/10 rounded-md hover:bg-[#0A7BC7]/20 cursor-pointer"
                          >
                            {sortOrder === "asc" ? "Ascending ↑" : "Descending ↓"}
                          </button>
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right Side Actions */}
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportExcelFile}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <TBtn onClick={() => importFileRef.current?.click()}>
                    <Download className="size-3.5" /> Import
                  </TBtn>
                  <TBtn onClick={handleExportPDF}>
                    <FileText className="size-3.5" /> Export PDF
                  </TBtn>
                  <TBtn onClick={() => { setPreviewTarget({ type: "summary" }); setPreviewModalOpen(true); }}>
                    <Sparkles className="size-3.5 text-[#0A7BC7]" /> Auto-Calculate
                  </TBtn>
                  <TBtn primary onClick={() => demandSection === "irrigation" ? setShowAddIrrModal(true) : setShowAddWdModal(true)}>
                    <Plus className="size-3.5" /> New Entry
                  </TBtn>
                </div>
              </div>
            )}

            {/* Row 3: Category Sub-Tabs Row (Domestic, Irrigation, Pool, Fire) */}
            {tab === "demand" && (
              <div className="px-4 py-2 bg-slate-100/40 dark:bg-slate-900/20 shrink-0 select-none no-print border-b border-border/50">
                <div className="flex bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-full gap-1 border border-border/60 overflow-x-auto w-fit">
                  <button
                    type="button"
                    onClick={() => setDemandSection("domestic")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "domestic"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Building2 className={`size-3.5 ${demandSection === "domestic" ? "text-[#0A7BC7]" : "text-slate-500"}`} />
                    Domestic Water Demand
                    <span
                      className={`ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                        demandSection === "domestic"
                          ? "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          : "bg-slate-200/40 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {wdRows.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemandSection("irrigation")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "irrigation"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Globe className="size-3.5 text-emerald-500" />
                    Irrigation Water Demand
                    <span
                      className={`ml-0.5 px-1.5 py-0.2 text-[10px] rounded-full font-mono font-bold ${
                        demandSection === "irrigation"
                          ? "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                          : "bg-slate-200/40 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {irrRows.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemandSection("pool")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "pool"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Droplet className="size-3.5 text-sky-500" />
                    Swimming Pool Makeup
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemandSection("fire")}
                    className={`px-3.5 py-1 text-xs transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 rounded-full ${
                      demandSection === "fire"
                        ? "bg-background text-foreground shadow-2xs font-bold"
                        : "text-muted-foreground hover:text-foreground font-semibold"
                    }`}
                  >
                    <Flag className="size-3.5 text-red-500" />
                    Fire Fighting Reserve Sizing
                  </button>
                </div>
              </div>
            )}

            {/* Row 3: Tab Content Body Area */}
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
              {/* 1. Domestic Water Demand Schedule */}
              {tab === "demand" && (
                <>
                  {demandSection === "domestic" && (
                    <div className="flex flex-col gap-0 flex-1 min-h-0">
                      {/* Selection Active Banner */}
                      {selectedWdRows.size > 0 && (
                        <div className="mx-4 mt-3 flex items-center justify-between px-3.5 py-1.5 bg-[#0A7BC7]/10 dark:bg-[#0A7BC7]/20 border border-[#0A7BC7]/30 rounded-xl text-xs font-semibold text-[#0A7BC7] select-none animate-fade-in">
                        <div className="flex items-center gap-2">
                          <span className="bg-[#0A7BC7] text-white px-2 py-0.5 rounded-full text-[10.5px] font-bold shadow-2xs">
                            {selectedWdRows.size} selected
                          </span>
                          <span className="text-muted-foreground text-[11.5px]">
                            Press <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Shift/Ctrl+Click</kbd> for range/multi-select, <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Ctrl+A</kbd> select all, <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Esc</kbd> clear, <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Delete</kbd> remove.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const count = selectedWdRows.size;
                              setWdRows((prev) => prev.filter((r) => !selectedWdRows.has(r.id)));
                              setSelectedWdRows(new Set());
                              setLastClickedWdIndex(null);
                              toast.info(`Deleted ${count} selected entry(s)`);
                            }}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-2xs flex items-center gap-1"
                          >
                            <Trash2 className="size-3" /> Delete Selected ({selectedWdRows.size})
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedWdRows(new Set());
                              setLastClickedWdIndex(null);
                            }}
                            className="px-2 py-1 bg-background hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground rounded-lg text-[11px] font-bold cursor-pointer transition border border-border/60"
                          >
                            Deselect (Esc)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Domestic Table */}
                    <div className="overflow-x-auto w-full flex-1">
                      <table className="w-full border-collapse text-[12px] font-sans text-left">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                            <th style={{ width: colWidths.select, minWidth: colWidths.select }} className="py-2 px-2 text-center relative group">
                              <input
                                type="checkbox"
                                checked={filteredAndSortedWdRows.length > 0 && selectedWdRows.size === filteredAndSortedWdRows.length}
                                onChange={toggleSelectAllWd}
                                className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded"
                                title="Select All / Deselect All (Ctrl+A)"
                              />
                              <div onMouseDown={(e) => startResizing("select", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.name, minWidth: colWidths.name }} className="py-2 px-3 text-left relative group">
                              DESCRIPTION
                              <div onMouseDown={(e) => startResizing("name", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.ppl, minWidth: colWidths.ppl }} className="py-2 px-3 text-center relative group">
                              PEOPLE / UNIT
                              <div onMouseDown={(e) => startResizing("ppl", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.multiplier, minWidth: colWidths.multiplier }} className="py-2 px-3 text-center relative group">
                              SPACE MULTIPLIER
                              <div onMouseDown={(e) => startResizing("multiplier", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.cat, minWidth: colWidths.cat }} className="py-2 px-3 text-left relative group">
                              CATEGORY
                              <div onMouseDown={(e) => startResizing("cat", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.lpd, minWidth: colWidths.lpd }} className="py-2 px-3 text-right relative group">
                              PER CAPITA RATE
                              <div onMouseDown={(e) => startResizing("lpd", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.load, minWidth: colWidths.load }} className="py-2 px-3 text-right relative group">
                              DAILY LOAD
                              <div onMouseDown={(e) => startResizing("load", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                            <th style={{ width: colWidths.actions, minWidth: colWidths.actions }} className="py-2 px-2 text-center relative group">
                              ACTIONS
                              <div onMouseDown={(e) => startResizing("actions", e)} className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] transition-colors z-20" title="Drag to resize column" />
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredAndSortedWdRows.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-8 text-center text-muted-foreground italic">
                                {wdRows.length === 0
                                  ? "No domestic entries added. Fill in the form above or click Import to populate."
                                  : "No domestic entries match the active search/filter criteria."}
                              </td>
                            </tr>
                          ) : (
                            filteredAndSortedWdRows.map((r, idx) => (
                              <ContextMenu key={r.id}>
                                <ContextMenuTrigger asChild>
                                  <tr
                                    id={`row-${r.id}`}
                                    data-row-id={r.id}
                                    onClick={(e) => toggleWdRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                                    onDoubleClick={() => {
                                      setPreviewTarget({ type: "domestic", rowId: r.id });
                                      setPreviewModalOpen(true);
                                    }}
                                    title="Click to select, Shift+Click for range, Ctrl+Click for multi-select. Double-click for breakdown."
                                    className={`border-b border-border/40 transition-colors cursor-pointer select-none ${
                                      selectedWdRows.has(r.id)
                                        ? "bg-[#0A7BC7]/15 dark:bg-[#0A7BC7]/25 border-l-2 border-l-[#0A7BC7]"
                                        : r.flagged
                                        ? "bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/50"
                                        : idx % 2 === 0
                                        ? "bg-white dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                        : "bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                    }`}
                                  >
                                    <td style={{ width: colWidths.select, minWidth: colWidths.select }} className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1.5">
                                        <input
                                          type="checkbox"
                                          checked={selectedWdRows.has(r.id)}
                                          onChange={() => toggleWdRowSelection(r.id, false, true)}
                                          className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded"
                                        />
                                        <span className="text-muted-foreground font-mono text-xs">{idx + 1}</span>
                                        {r.flagged && (
                                          <span title="Flagged for review" className="inline-flex">
                                            <Flag className="size-3 text-amber-500 fill-amber-500" />
                                          </span>
                                        )}
                                        {r.comments && r.comments.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setCommentTarget({
                                                targetId: String(r.id),
                                                targetName: r.name,
                                                targetType: "Domestic Water Load",
                                                rowId: r.id,
                                                isIrrigation: false,
                                                existingComments: r.comments || [],
                                              })
                                            }
                                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-500/20 transition cursor-pointer"
                                            title={`${r.comments.length} comment(s) — Click to view`}
                                          >
                                            <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                            <span>{r.comments.length}</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ width: colWidths.name, minWidth: colWidths.name }} className="py-1.5 px-3" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center gap-2 w-full">
                                        {r.autoDetected && (
                                          <span
                                            className="size-1.5 rounded-full bg-[#0A7BC7] shrink-0 inline-block"
                                            title="Auto-detected according to ASHRAE / DEWA standard"
                                          />
                                        )}
                                        <input
                                          type="text"
                                          value={r.name}
                                          onChange={(e) => handleWdRowChange(r.id, "name", e.target.value)}
                                          className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-semibold text-foreground text-xs"
                                        />
                                      </div>
                                    </td>
                                    <td style={{ width: colWidths.ppl, minWidth: colWidths.ppl }} className="py-1.5 px-3 text-center font-bold" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="number"
                                        value={r.ppl}
                                        onChange={(e) => handleWdRowChange(r.id, "ppl", Number(e.target.value))}
                                        className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium text-xs"
                                      />
                                    </td>
                                    <td style={{ width: colWidths.multiplier, minWidth: colWidths.multiplier }} className="py-1.5 px-3 text-center font-bold" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="number"
                                        min={1}
                                        value={r.multiplier || 1}
                                        onChange={(e) => handleWdRowChange(r.id, "multiplier", Math.max(1, Number(e.target.value)))}
                                        className="w-14 text-center bg-transparent border border-slate-200/80 dark:border-slate-800 hover:border-[#0A7BC7] focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-mono text-xs font-bold outline-none"
                                        title="Space multiplier / quantity of identical spaces"
                                      />
                                    </td>
                                    <td style={{ width: colWidths.cat, minWidth: colWidths.cat }} className="py-1.5 px-3" onClick={(e) => e.stopPropagation()}>
                                      <select
                                        value={r.cat}
                                        onChange={(e) => handleWdRowChange(r.id, "cat", e.target.value)}
                                        className="w-full bg-transparent border border-transparent hover:border-border/60 focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 outline-none cursor-pointer py-0.5 px-1 rounded text-xs font-medium"
                                      >
                                        {Object.keys(WD_TYPE_MAP).map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td style={{ width: colWidths.lpd, minWidth: colWidths.lpd }} className="py-1.5 px-3 text-right font-mono font-medium" onClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-end gap-1">
                                        <input
                                          type="number"
                                          value={ip ? Math.round(r.lpd / 3.78541) : r.lpd}
                                          onChange={(e) => {
                                            const val = Number(e.target.value);
                                            const lpdVal = ip ? Math.round(val * 3.78541) : val;
                                            handleWdRowChange(r.id, "lpd", lpdVal);
                                          }}
                                          className="w-16 text-right bg-transparent border border-slate-200/80 dark:border-slate-800 hover:border-[#0A7BC7] focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-mono text-xs font-bold text-foreground outline-none transition-colors"
                                          title="Click or type to edit custom per capita consumption rate"
                                        />
                                        <span className="text-[10.5px] text-muted-foreground font-semibold select-none">{ip ? "gpd" : "LPD"}</span>
                                      </div>
                                    </td>
                                    <td style={{ width: colWidths.load, minWidth: colWidths.load }} className="py-1.5 px-3 text-right font-mono font-bold text-xs text-[#0A7BC7]">
                                      {(ip ? Math.round((r.ppl * r.lpd * (r.multiplier || 1)) / 3.78541) : r.ppl * r.lpd * (r.multiplier || 1)).toLocaleString()} {ip ? "gal" : "L"}
                                    </td>
                                    <td style={{ width: colWidths.actions, minWidth: colWidths.actions }} className="py-1.5 px-2 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleWdFlag(r.id)}
                                          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                            r.flagged
                                              ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                              : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                          }`}
                                          title={r.flagged ? "Flagged for review" : "Flag for review"}
                                        >
                                          <Flag className={`size-3.5 ${r.flagged ? "fill-amber-500" : ""}`} />
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => {
                                            setWdRows((prev) => prev.filter((x) => x.id !== r.id));
                                            toast.success(`Deleted "${r.name}"`);
                                          }}
                                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                                          title="Delete entry"
                                        >
                                          <Trash2 className="size-3.5" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 font-sans text-xs">
                                  <ContextMenuItem
                                    onClick={() => {
                                      setPreviewTarget({ type: "domestic", rowId: r.id });
                                      setPreviewModalOpen(true);
                                    }}
                                    className="gap-2 cursor-pointer font-semibold text-[#0A7BC7]"
                                  >
                                    <Calculator className="size-3.5" />
                                    <span>Calculation Breakdown &amp; Preview</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() =>
                                      setCommentTarget({
                                        targetId: String(r.id),
                                        targetName: r.name,
                                        targetType: "Domestic Water Load",
                                        rowId: r.id,
                                        isIrrigation: false,
                                        existingComments: r.comments || [],
                                      })
                                    }
                                    className="gap-2 cursor-pointer"
                                  >
                                    <MessageSquare className="size-3.5 text-blue-500" />
                                    <span>Add Comment / Assign Task</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => handleToggleWdFlag(r.id)}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Flag className={`size-3.5 ${r.flagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                    <span>{r.flagged ? "Unflag Row" : "Flag for Review"}</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => {
                                      const dup = { ...r, id: Date.now(), name: `${r.name} (Copy)` };
                                      setWdRows((prev) => [...prev, dup]);
                                      toast.success(`Duplicated "${r.name}"`);
                                    }}
                                    className="gap-2 cursor-pointer"
                                  >
                                    <Copy className="size-3.5 text-slate-500" />
                                    <span>Duplicate Row</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    onClick={() => {
                                      setWdRows((prev) => prev.filter((x) => x.id !== r.id));
                                      toast.success(`Deleted "${r.name}"`);
                                    }}
                                    className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Delete Row</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))
                          )}
                        </tbody>
                      </table>
                      {/* Table Summary Footer Bar (Matching Ventilation Schedule) */}
                      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900/80 border-t border-border/70 text-[11.5px] font-semibold text-muted-foreground select-none">
                        <span>Showing {filteredAndSortedWdRows.length} of {wdRows.length} spaces</span>
                        <div className="flex items-center gap-4">
                          <span>Total Occupancy: <strong className="text-foreground font-mono font-bold">{(calculations.totalPeople || 0).toLocaleString()}</strong> People</span>
                          <span>Total Daily Load: <strong className="text-[#0A7BC7] font-mono font-bold text-xs">{calculations.displayDomestic}</strong></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                  {/* 2. Irrigation Water Demand Schedule */}
                  {demandSection === "irrigation" && (
                    <div className="flex flex-col gap-0 flex-1 min-h-0">
                      {/* Selection Active Banner */}
                      {selectedIrrRows.size > 0 && (
                        <div className="mx-4 mt-3 flex items-center justify-between px-3.5 py-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-700 dark:text-emerald-300 select-none animate-fade-in">
                          <div className="flex items-center gap-2">
                            <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10.5px] font-bold shadow-2xs">
                              {selectedIrrRows.size} selected
                            </span>
                            <span className="text-muted-foreground text-[11.5px]">
                              Press <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Shift/Ctrl+Click</kbd> for range/multi-select, <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Ctrl+A</kbd> select all, <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Esc</kbd> clear, <kbd className="px-1 py-0.5 bg-background border rounded text-[10px] font-mono">Delete</kbd> remove.
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const count = selectedIrrRows.size;
                                setIrrRows((prev) => prev.filter((r) => !selectedIrrRows.has(r.id)));
                                setSelectedIrrRows(new Set());
                                setLastClickedIrrIndex(null);
                                toast.info(`Deleted ${count} selected irrigation entry(s)`);
                              }}
                              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold cursor-pointer transition shadow-2xs flex items-center gap-1"
                            >
                              <Trash2 className="size-3" /> Delete Selected ({selectedIrrRows.size})
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedIrrRows(new Set());
                                setLastClickedIrrIndex(null);
                              }}
                              className="px-2 py-1 bg-background hover:bg-slate-200 dark:hover:bg-slate-800 text-muted-foreground rounded-lg text-[11px] font-bold cursor-pointer transition border border-border/60"
                            >
                              Deselect (Esc)
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="overflow-x-auto w-full flex-1">
                        <table className="w-full border-collapse text-[12px] font-sans text-left">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                              <th style={{ width: colWidths.irr_select, minWidth: colWidths.irr_select }} className="py-2 px-2 text-center relative group">
                                <input
                                  type="checkbox"
                                  checked={irrRows.length > 0 && selectedIrrRows.size === irrRows.length}
                                  onChange={toggleSelectAllIrr}
                                  className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded"
                                  title="Select All / Deselect All (Ctrl+A)"
                                />
                                <div
                                  onMouseDown={(e) => startResizing("irr_select", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_vegType, minWidth: colWidths.irr_vegType }} className="py-2 px-3 text-left relative group">
                                VEGETATION TYPE
                                <div
                                  onMouseDown={(e) => startResizing("irr_vegType", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_area, minWidth: colWidths.irr_area }} className="py-2 px-3 text-center relative group">
                                AREA ({ip ? "FT²" : "M²"})
                                <div
                                  onMouseDown={(e) => startResizing("irr_area", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_rate, minWidth: colWidths.irr_rate }} className="py-2 px-3 text-right relative group">
                                RATE
                                <div
                                  onMouseDown={(e) => startResizing("irr_rate", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_load, minWidth: colWidths.irr_load }} className="py-2 px-3 text-right relative group">
                                TOTAL LOAD
                                <div
                                  onMouseDown={(e) => startResizing("irr_load", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                              <th style={{ width: colWidths.irr_actions, minWidth: colWidths.irr_actions }} className="py-2 px-2 text-center relative group">
                                ACTIONS
                                <div
                                  onMouseDown={(e) => startResizing("irr_actions", e)}
                                  className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#0A7BC7] active:bg-[#0A7BC7] z-20"
                                />
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {irrRows.length === 0 ? (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-muted-foreground italic">
                                  No irrigation entries added. Fill in the form above to calculate plant water demand.
                                </td>
                              </tr>
                            ) : (
                              irrRows.map((r, idx) => (
                                <ContextMenu key={r.id}>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      id={`row-${r.id}`}
                                      data-row-id={r.id}
                                      onClick={(e) => toggleIrrRowSelection(r.id, e.shiftKey, e.ctrlKey || e.metaKey)}
                                      onDoubleClick={() => {
                                        setPreviewTarget({ type: "irrigation", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                      title="Click to select, Shift+Click for range, Ctrl+Click for multi-select. Double-click for breakdown."
                                      className={`group border-b border-border/40 transition-colors cursor-pointer select-none ${
                                        selectedIrrRows.has(r.id)
                                          ? "bg-emerald-500/15 dark:bg-emerald-500/25 border-l-2 border-l-emerald-600"
                                          : r.flagged
                                          ? "bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-100/50"
                                          : idx % 2 === 0
                                          ? "bg-white dark:bg-slate-950 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                          : "bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                      }`}
                                    >
                                      <td style={{ width: colWidths.irr_select, minWidth: colWidths.irr_select }} className="py-1.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1.5">
                                          <input
                                            type="checkbox"
                                            checked={selectedIrrRows.has(r.id)}
                                            onChange={() => toggleIrrRowSelection(r.id, false, true)}
                                            className="cursor-pointer size-3.5 accent-[#0A7BC7] rounded"
                                          />
                                          <span className="text-muted-foreground font-mono text-xs">{idx + 1}</span>
                                          {r.flagged && (
                                            <span title="Flagged for review" className="inline-flex">
                                              <Flag className="size-3 text-amber-500 fill-amber-500" />
                                            </span>
                                          )}
                                          {r.comments && r.comments.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setCommentTarget({
                                                  targetId: String(r.id),
                                                  targetName: r.vegType,
                                                  targetType: "Irrigation Plant Area",
                                                  rowId: r.id,
                                                  isIrrigation: true,
                                                  existingComments: r.comments || [],
                                                })
                                              }
                                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[10px] hover:bg-blue-500/20 transition cursor-pointer"
                                              title={`${r.comments.length} comment(s) — Click to view`}
                                            >
                                              <MessageSquare className="size-3 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                              <span>{r.comments.length}</span>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td style={{ width: colWidths.irr_vegType, minWidth: colWidths.irr_vegType }} className="py-1.5 px-3" onClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center gap-2 w-full">
                                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block" />
                                          <select
                                            value={r.vegType}
                                            onChange={(e) => handleIrrRowChange(r.id, "vegType", e.target.value)}
                                            className="w-full bg-transparent border border-transparent hover:border-border/60 focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 outline-none cursor-pointer py-0.5 px-1 rounded text-xs font-semibold text-foreground"
                                          >
                                            {Object.keys(IRR_TYPE_MAP).map((k) => (
                                              <option key={k} value={k}>
                                                {k}
                                              </option>
                                            ))}
                                          </select>
                                        </div>
                                      </td>
                                      <td style={{ width: colWidths.irr_area, minWidth: colWidths.irr_area }} className="py-1.5 px-3 text-center font-bold font-mono" onClick={(e) => e.stopPropagation()}>
                                        <input
                                          type="number"
                                          value={r.area}
                                          onChange={(e) => handleIrrRowChange(r.id, "area", Number(e.target.value))}
                                          className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium text-xs"
                                        />
                                      </td>
                                      <td style={{ width: colWidths.irr_rate, minWidth: colWidths.irr_rate }} className="py-1.5 px-3 text-right font-mono font-medium text-muted-foreground text-xs">
                                        {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)} {ip ? "gal/ft²" : "L/m²"}
                                      </td>
                                      <td style={{ width: colWidths.irr_load, minWidth: colWidths.irr_load }} className="py-1.5 px-3 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                                        {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()} {ip ? "gal" : "L"}
                                      </td>
                                      <td style={{ width: colWidths.irr_actions, minWidth: colWidths.irr_actions }} className="py-1.5 px-2 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                        <div className="flex items-center justify-center gap-1">
                                          <button
                                            type="button"
                                            onClick={() => handleToggleIrrFlag(r.id)}
                                            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                              r.flagged
                                                ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40 opacity-100"
                                                : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40 opacity-0 group-hover:opacity-100"
                                            }`}
                                            title={r.flagged ? "Flagged for review" : "Flag for review"}
                                          >
                                            <Flag className={`size-3.5 ${r.flagged ? "fill-amber-500" : ""}`} />
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setIrrRows((prev) => prev.filter((x) => x.id !== r.id));
                                              toast.success(`Deleted "${r.vegType}"`);
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                                            title="Delete entry"
                                          >
                                            <Trash2 className="size-3.5" />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-56 font-sans text-xs">
                                    <ContextMenuItem
                                      onClick={() => {
                                        setPreviewTarget({ type: "irrigation", rowId: r.id });
                                        setPreviewModalOpen(true);
                                      }}
                                      className="gap-2 cursor-pointer font-semibold text-[#0A7BC7]"
                                    >
                                      <Calculator className="size-3.5" />
                                      <span>Calculation Breakdown &amp; Preview</span>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onClick={() =>
                                        setCommentTarget({
                                          targetId: String(r.id),
                                          targetName: r.vegType,
                                          targetType: "Irrigation Plant Area",
                                          rowId: r.id,
                                          isIrrigation: true,
                                          existingComments: r.comments || [],
                                        })
                                      }
                                      className="gap-2 cursor-pointer"
                                    >
                                      <MessageSquare className="size-3.5 text-blue-500" />
                                      <span>Add Comment / Assign Task</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => handleToggleIrrFlag(r.id)}
                                      className="gap-2 cursor-pointer"
                                    >
                                      <Flag className={`size-3.5 ${r.flagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                      <span>{r.flagged ? "Unflag Row" : "Flag for Review"}</span>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />
                                    <ContextMenuItem
                                      onClick={() => {
                                        setIrrRows((prev) => prev.filter((x) => x.id !== r.id));
                                        toast.success(`Deleted "${r.vegType}"`);
                                      }}
                                      className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/30 cursor-pointer"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>Delete Row</span>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              ))
                            )}
                          </tbody>
                        </table>
                        {/* Table Summary Footer Bar */}
                        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/90 dark:bg-slate-900/80 border-t border-border/70 text-[11.5px] font-semibold text-muted-foreground select-none">
                          <span>Showing {irrRows.length} vegetation zones</span>
                          <div className="flex items-center gap-4">
                            <span>Total Area: <strong className="text-foreground font-mono font-bold">{irrRows.reduce((a, b) => a + (b.area || 0), 0).toLocaleString()} {ip ? "ft²" : "m²"}</strong></span>
                            <span>Total Daily Load: <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold text-xs">{calculations.displayIrrigation}</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(demandSection === "pool" || demandSection === "fire") && (
                    <div className="flex flex-col gap-6 w-full">
                      {/* Pool Card */}
                      {demandSection === "pool" && (
                        <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <div
                          onDoubleClick={() => {
                            setPreviewTarget({ type: "pool" });
                            setPreviewModalOpen(true);
                          }}
                          title="Double-click to open swimming pool makeup calculation breakdown"
                          className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 shadow-xs transition-colors cursor-pointer select-none ${
                            poolFlagged
                              ? "border-amber-400/80 bg-amber-50/40 dark:bg-amber-950/20"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                                🏊 Swimming Pool Makeup
                                {poolFlagged && (
                                  <span title="Flagged for review" className="inline-flex">
                                    <Flag className="size-3 text-amber-500 fill-amber-500" />
                                  </span>
                                )}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1" onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentTarget({
                                      targetId: "swimming_pool",
                                      targetName: "Swimming Pool Makeup",
                                      targetType: "Swimming Pool",
                                      isPool: true,
                                      existingComments: poolComments,
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors relative cursor-pointer"
                                  title="Add comment & assign task for Swimming Pool"
                                >
                                  <MessageSquare className="size-3.5" />
                                  {poolComments.length > 0 && (
                                    <span className="absolute -top-1 -right-1 size-3.5 bg-blue-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                                      {poolComments.length}
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextState = !poolFlagged;
                                    setPoolFlagged(nextState);
                                    toast.info(nextState ? "Flagged Swimming Pool for review" : "Unflagged Swimming Pool");
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    poolFlagged
                                      ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  }`}
                                  title={poolFlagged ? "Flagged for review" : "Flag for review"}
                                >
                                  <Flag className={`size-3.5 ${poolFlagged ? "fill-amber-500" : ""}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 text-xs font-sans">
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Pool Surface Area ({ip ? "ft²" : "m²"})</label>
                              <input
                                type="number"
                                placeholder="e.g. 80"
                                value={poolArea}
                                onChange={(e) => setPoolArea(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Average Depth ({ip ? "ft" : "m"})</label>
                              <input
                                type="number"
                                placeholder="e.g. 1.5"
                                value={poolDepth}
                                onChange={(e) => setPoolDepth(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Evaporation Rate (%/day)</label>
                              <input
                                type="number"
                                value={poolEvap}
                                onChange={(e) => setPoolEvap(Number(e.target.value))}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>

                            {poolArea && poolDepth && (
                              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 rounded-xl mt-1 flex justify-between items-center">
                                <span className="text-xs font-bold text-blue-800 dark:text-blue-300">Daily Pool Makeup:</span>
                                <strong className="text-sm font-extrabold font-mono text-[#0A7BC7]">{calculations.displayPoolDemand}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 font-sans text-xs">
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "pool" });
                            setPreviewModalOpen(true);
                          }}
                          className="gap-2 cursor-pointer font-semibold text-[#0A7BC7]"
                        >
                          <Calculator className="size-3.5" />
                          <span>Calculation Breakdown &amp; Preview</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() =>
                            setCommentTarget({
                              targetId: "swimming_pool",
                              targetName: "Swimming Pool Makeup",
                              targetType: "Swimming Pool",
                              isPool: true,
                              existingComments: poolComments,
                            })
                          }
                          className="gap-2 cursor-pointer"
                        >
                          <MessageSquare className="size-3.5 text-blue-500" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          onClick={() => {
                            const nextState = !poolFlagged;
                            setPoolFlagged(nextState);
                            toast.info(nextState ? "Flagged Swimming Pool for review" : "Unflagged Swimming Pool");
                          }}
                          className="gap-2 cursor-pointer"
                        >
                          <Flag className={`size-3.5 ${poolFlagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                          <span>{poolFlagged ? "Unflag Card" : "Flag for Review"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                    )}

                    {/* Fire Card */}
                    {demandSection === "fire" && (
                      <ContextMenu>
                        <ContextMenuTrigger asChild>
                        <div
                          onDoubleClick={() => {
                            setPreviewTarget({ type: "fire" });
                            setPreviewModalOpen(true);
                          }}
                          title="Double-click to open fire reserve calculation breakdown"
                          className={`bg-card border rounded-2xl p-5 flex flex-col gap-4 shadow-xs transition-colors cursor-pointer select-none ${
                            fireFlagged
                              ? "border-amber-400/80 bg-amber-50/40 dark:bg-amber-950/20"
                              : "border-border hover:border-border/80"
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-3.5 bg-red-600 rounded-full"></div>
                              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                                🔥 Fire Fighting Reserve Sizing
                                {fireFlagged && (
                                  <span title="Flagged for review" className="inline-flex">
                                    <Flag className="size-3 text-amber-500 fill-amber-500" />
                                  </span>
                                )}
                              </h3>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1" onDoubleClick={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCommentTarget({
                                      targetId: "fire_fighting",
                                      targetName: "Fire Fighting Reserve Sizing",
                                      targetType: "Fire Fighting Reserve",
                                      isFire: true,
                                      existingComments: fireComments,
                                    })
                                  }
                                  className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-colors relative cursor-pointer"
                                  title="Add comment & assign task for Fire Fighting"
                                >
                                  <MessageSquare className="size-3.5" />
                                  {fireComments.length > 0 && (
                                    <span className="absolute -top-1 -right-1 size-3.5 bg-blue-600 text-white font-bold text-[9px] rounded-full flex items-center justify-center">
                                      {fireComments.length}
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextState = !fireFlagged;
                                    setFireFlagged(nextState);
                                    toast.info(nextState ? "Flagged Fire Fighting Reserve for review" : "Unflagged Fire Fighting Reserve");
                                  }}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    fireFlagged
                                      ? "text-amber-500 bg-amber-50 dark:bg-amber-950/40"
                                      : "text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                  }`}
                                  title={fireFlagged ? "Flagged for review" : "Flag for review"}
                                >
                                  <Flag className={`size-3.5 ${fireFlagged ? "fill-amber-500" : ""}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 text-xs font-sans">
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Fire Pump Flow Rate (USGPM)</label>
                              <input
                                type="number"
                                placeholder="e.g. 500"
                                value={fireFlow}
                                onChange={(e) => setFireFlow(e.target.value !== "" ? Number(e.target.value) : "")}
                                className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                              />
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="font-semibold text-foreground">Standard Fire Reserve Duration</label>
                              <div className="w-full bg-slate-100 dark:bg-slate-800 text-muted-foreground border border-border rounded-lg px-3 py-2 font-bold select-none cursor-not-allowed">
                                60 Minutes (Standard fixed NFPA duration)
                              </div>
                            </div>

                            {fireFlow && (
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl mt-1 flex justify-between items-center">
                                <span className="text-xs font-bold text-red-800 dark:text-red-300">Reserve Fire Tank:</span>
                                <strong className="text-sm font-extrabold font-mono text-red-600 dark:text-red-400">{calculations.displayFireCap}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-56 font-sans text-xs">
                        <ContextMenuItem
                          onClick={() => {
                            setPreviewTarget({ type: "fire" });
                            setPreviewModalOpen(true);
                          }}
                          className="gap-2 cursor-pointer font-semibold text-[#0A7BC7]"
                        >
                          <Calculator className="size-3.5" />
                          <span>Calculation Breakdown &amp; Preview</span>
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() =>
                            setCommentTarget({
                              targetId: "fire_fighting",
                              targetName: "Fire Fighting Reserve Sizing",
                              targetType: "Fire Fighting Reserve",
                              isFire: true,
                              existingComments: fireComments,
                            })
                          }
                          className="gap-2 cursor-pointer"
                        >
                          <MessageSquare className="size-3.5 text-blue-500" />
                          <span>Add Comment / Assign Task</span>
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="gap-2 cursor-pointer"
                          onClick={() => {
                            const nextState = !fireFlagged;
                            setFireFlagged(nextState);
                            toast.info(nextState ? "Flagged Fire Fighting Reserve for review" : "Unflagged Fire Fighting Reserve");
                          }}
                        >
                          <Flag className={`size-3.5 ${fireFlagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                          <span>{fireFlagged ? "Unflag Item" : "Flag for Review"}</span>
                        </ContextMenuItem>
                      </ContextMenuContent>
                      </ContextMenu>
                      )}
                    </div>
                  )}
            </>
          )}

          {/* -------------------- TAB 2: STORAGE & PUMPS -------------------- */}
          {tab === "tanks" && (
            <>

              {/* Main Content Layout */}
              <div className="flex flex-col gap-6 w-full">
                {/* 1. Domestic Water Storage Tank Sizing Card */}
                  <div
                    onDoubleClick={() => {
                      setPreviewTarget({ type: "tank" });
                      setPreviewModalOpen(true);
                    }}
                    title="Double-click to open storage tank sizing calculation breakdown"
                    className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                          <Building2 className="size-4 text-[#0A7BC7]" /> 1. Storage Tank Capacity &amp; Split Sizing
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-foreground">Storage Retention Days</label>
                        <select
                          value={storageDays}
                          onChange={(e) => setStorageDays(Number(e.target.value))}
                          className="bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                        >
                          <option value={1}>1 Day Storage (24 Hours — Standard)</option>
                          <option value={1.5}>1.5 Day Storage (36 Hours — Intermediate Reserve)</option>
                          <option value={2}>2 Days Storage (48 Hours — DEWA/ADDC Reserve)</option>
                          <option value={3}>3 Days Storage (72 Hours — Emergency Reserve)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-foreground">Target Storage Volume</label>
                        <div className="bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-[#0A7BC7] flex items-center justify-between">
                          <span>{calculations.displayTotalStorage}</span>
                          <span className="text-[10px] text-muted-foreground font-sans font-medium">({storageDays} Day Retention)</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 mt-2">
                      {/* Ground Water Break Tank */}
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-foreground">
                              Ground Water Break Tank
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-border rounded px-2 py-0.5">
                              <input
                                type="number"
                                min={0}
                                max={500}
                                value={groundTankPct}
                                onChange={(e) => setGroundTankPct(Number(e.target.value))}
                                className="w-12 bg-transparent text-xs font-mono font-bold text-[#0A7BC7] text-right outline-none"
                              />
                              <span className="text-[10px] font-bold text-muted-foreground">%</span>
                            </div>
                            <span className="text-xs font-mono font-extrabold text-[#0A7BC7]">{calculations.displayGroundTank}</span>
                          </div>
                        </div>
                        <div className="text-[11.5px] text-muted-foreground">
                          Suggested Dimensions: <strong className="text-foreground font-mono">{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H</strong> (+ 0.3m freeboard)
                        </div>
                      </div>

                      {/* Overhead Roof Tanks Container */}
                      <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Building2 className="size-4 text-[#0A7BC7]" />
                            <span className="text-xs font-bold text-foreground">
                              Overhead Roof Tanks ({overheadTanks.length})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddOverheadTank();
                            }}
                            className="text-xs text-[#0A7BC7] hover:text-white bg-blue-50 dark:bg-blue-950/50 hover:bg-[#0A7BC7] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                          >
                            <Plus className="size-3.5" /> Add Overhead Tank
                          </button>
                        </div>

                        {overheadTanks.length === 0 ? (
                          <div className="p-3 bg-slate-50 dark:bg-slate-900/30 border border-dashed border-border rounded-xl text-center text-xs text-muted-foreground italic">
                            No overhead roof tanks configured. Click &quot;+ Add Overhead Tank&quot; above to add overhead roof storage tanks.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {calculations.overheadTanksCalculated.map((t) => (
                              <div
                                key={t.id}
                                onClick={(e) => e.stopPropagation()}
                                className="p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col gap-2 relative group"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <input
                                    type="text"
                                    value={t.name}
                                    onChange={(e) => handleRenameOverheadTank(t.id, e.target.value)}
                                    className="bg-transparent font-bold text-xs text-foreground outline-none focus:bg-white dark:focus:bg-slate-950 px-1.5 py-0.5 rounded border border-transparent hover:border-slate-300 focus:border-[#0A7BC7] w-full"
                                    placeholder="Overhead Tank Name"
                                  />
                                  <div className="flex items-center gap-2 shrink-0">
                                    <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-border rounded px-1.5 py-0.5">
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={t.splitPct}
                                        onChange={(e) => handleUpdateOverheadTankPct(t.id, Number(e.target.value))}
                                        className="w-10 bg-transparent text-xs font-mono font-bold text-[#0A7BC7] text-right outline-none"
                                      />
                                      <span className="text-[10px] font-bold text-muted-foreground">%</span>
                                    </div>
                                    <span className="text-xs font-mono font-extrabold text-[#0A7BC7]">
                                      {t.displayVol}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveOverheadTank(t.id);
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded transition-colors cursor-pointer"
                                      title="Remove Overhead Tank"
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  </div>
                                </div>
                                <div className="text-[11.5px] text-muted-foreground">
                                  Suggested Dimensions: <strong className="text-foreground font-mono">{t.dim.l}m L × {t.dim.w}m W × {t.dim.h}m H</strong> (+ 0.3m freeboard)
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Domestic Peak Flow & Transfer Pump Capacity Card */}
                  <div
                    onDoubleClick={() => {
                      setPreviewTarget({ type: "pump" });
                      setPreviewModalOpen(true);
                    }}
                    title="Double-click to open transfer pump duty calculation breakdown"
                    className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs cursor-pointer select-none"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border/60">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans flex items-center gap-1.5">
                          <Sparkles className="size-4 text-[#0A7BC7]" /> 2. Domestic Peak Flow &amp; Transfer Pump Sizing
                        </h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs font-sans">
                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-foreground">Diversity / Peak Multiplier (K)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={peakFactor}
                          onChange={(e) => setPeakFactor(Number(e.target.value))}
                          className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-foreground">Transfer Filling Duration</label>
                        <select
                          value={fillWindowHours}
                          onChange={(e) => setFillWindowHours(Number(e.target.value))}
                          className="w-full bg-slate-100/50 dark:bg-slate-950/40 border border-border/80 rounded-lg px-3 py-2 outline-none font-bold focus:border-[#0A7BC7]"
                        >
                          <option value={1}>1 Hour Filling Window</option>
                          <option value={2}>2 Hours Filling Window (Standard)</option>
                          <option value={3}>3 Hours Filling Window</option>
                          <option value={4}>4 Hours Filling Window</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-foreground">Calculated Peak Flow</label>
                        <div className="bg-slate-100 dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-foreground">
                          {calculations.displayDomesticPeak}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="font-semibold text-foreground">Required Transfer Pump Flow</label>
                        <div className="bg-[#0A7BC7] text-white border border-[#06456F] rounded-lg px-3 py-2 text-xs font-mono font-extrabold">
                          {calculations.displayTransferPump}
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            </>
          )}

          {/* -------------------- TAB 3: REPORT -------------------- */}
          {tab === "report" && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-200">
              {/* Report Header Bar */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-5 text-[#0A7BC7]" />
                    <h2 className="text-base font-extrabold text-foreground tracking-tight">
                      Executive Site Sizing Summary &amp; Calculation Report
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Comprehensive engineering calculation report for domestic, irrigation, swimming pool makeup, storage tank volumes, and transfer pump duties.
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="h-9 px-4 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <FileText className="size-3.5" /> Export PDF Report
                  </button>
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-xs"
                  >
                    <FileSpreadsheet className="size-3.5" /> Export Excel Report
                  </button>
                </div>
              </div>

              {/* KPI Executive Summary Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 shadow-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Grand Total Daily Demand</span>
                  <div className="text-xl font-black text-[#0A7BC7] font-mono mt-1">{calculations.displayGrandTotal}</div>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Domestic + Irrigation + Pool Makeup</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 shadow-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Required Storage Volume</span>
                  <div className="text-xl font-black text-foreground font-mono mt-1">{calculations.displayTotalStorage}</div>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{storageDays} Day(s) Retention ({calculations.groundPct}% Ground / {calculations.totalOverheadPct}% Roof)</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 shadow-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Domestic Peak Flow Rate</span>
                  <div className="text-xl font-black text-foreground font-mono mt-1">{calculations.displayDomesticPeak}</div>
                  <span className="text-[11px] text-muted-foreground mt-0.5">Peak Diversity Factor: {peakFactor}</span>
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-1 shadow-xs">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Transfer Pump Duty Capacity</span>
                  <div className="text-xl font-black text-[#0A7BC7] font-mono mt-1">{calculations.displayTransferPump}</div>
                  <span className="text-[11px] text-muted-foreground mt-0.5">{fillWindowHours}-Hour Roof Tank Filling Window</span>
                </div>
              </div>

              {/* Engineering Compliance & Audit Checklist */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                  <Sparkles className="size-4 text-[#0A7BC7]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Engineering Standard &amp; Regulatory Compliance Audit
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                    <div className="p-1 bg-emerald-500 text-white rounded-full mt-0.5">
                      <Check className="size-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">Design Guideline Preset</div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">
                        {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name} — Mapped to occupancy LPD tables.
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                    <div className="p-1 bg-emerald-500 text-white rounded-full mt-0.5">
                      <Check className="size-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">Storage Retention Period</div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">
                        {storageDays} Day retention verified ({calculations.reqStorageM3.toFixed(1)} m³ total break + roof tank capacity).
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
                    <div className="p-1 bg-emerald-500 text-white rounded-full mt-0.5">
                      <Check className="size-3.5" />
                    </div>
                    <div>
                      <div className="font-bold text-emerald-700 dark:text-emerald-400">Transfer Pump Filling Window</div>
                      <div className="text-[11.5px] text-muted-foreground mt-0.5">
                        {fillWindowHours}-Hour filling window compliant with standard DEWA/ADDC roof tank replenishment guidelines.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 1: Executive Summary Table */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/60">
                  1. Executive Site Sizing Parameter Summary
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                        <th className="py-2 px-3 text-left">Calculated Parameter</th>
                        <th className="py-2 px-3 text-right">Calculated Value</th>
                        <th className="py-2 px-3 text-center">Unit</th>
                        <th className="py-2 px-3 text-left">Engineering Design Basis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      <tr>
                        <td className="py-2 px-3 font-semibold">Domestic Daily Water Load</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#0A7BC7]">{calculations.displayDomestic}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "gal/day" : "L/day"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{wdRows.length} Occupancy Line Item(s)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Domestic Peak Flow Rate</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#0A7BC7]">{calculations.displayDomesticPeak}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "GPM" : "L/s"}</td>
                        <td className="py-2 px-3 text-muted-foreground">Peak Factor K = {peakFactor}</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Irrigation Daily Water Load</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#0A7BC7]">{calculations.displayIrrigation}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "gal/day" : "L/day"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{irrRows.length} Landscaping Vegetation Zone(s)</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Swimming Pool Daily Makeup Water</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#0A7BC7]">{calculations.displayPoolDemand}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "gal/day" : "L/day"}</td>
                        <td className="py-2 px-3 text-muted-foreground">Evaporation Rate = {poolEvap}%</td>
                      </tr>
                      <tr className="bg-blue-50/60 dark:bg-blue-950/30 font-bold">
                        <td className="py-2 px-3 text-[#0A7BC7]">GRAND TOTAL DAILY WATER DEMAND</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-[#0A7BC7] text-sm">{calculations.displayGrandTotal}</td>
                        <td className="py-2 px-3 text-center font-mono text-[#0A7BC7]">{ip ? "gal/day" : "L/day"}</td>
                        <td className="py-2 px-3 text-[#0A7BC7]">Combined Site Service Load</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Total Required Storage Volume</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{calculations.displayTotalStorage}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "gal" : "m³"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{storageDays} Day(s) Total Retention</td>
                      </tr>
                      <tr>
                        <td className="py-2 px-3 font-semibold">Ground Water Break Tank</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{calculations.displayGroundTank}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "gal" : "L"}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {calculations.groundPct}% Share Allocation ({calculations.groundDim.l}m × {calculations.groundDim.w}m × {calculations.groundDim.h}m)
                        </td>
                      </tr>
                      {calculations.overheadTanksCalculated.map((t) => (
                        <tr key={t.id}>
                          <td className="py-2 px-3 font-semibold">{t.name}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{t.displayVol}</td>
                          <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "gal" : "L"}</td>
                          <td className="py-2 px-3 text-muted-foreground">
                            {t.sharePct.toFixed(0)}% Share Allocation ({t.dim.l}m × {t.dim.w}m × {t.dim.h}m)
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td className="py-2 px-3 font-semibold">Transfer Pump Duty Flow Rate</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-[#0A7BC7]">{calculations.displayTransferPump}</td>
                        <td className="py-2 px-3 text-center font-mono text-muted-foreground">{ip ? "GPM" : "L/s"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{fillWindowHours}-Hour Roof Tank Filling Window</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 2: Domestic Water Demand Schedule Table */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/60">
                  2. Domestic Water Demand Detailed Schedule
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                        <th className="py-2 px-2 text-center w-10">S.No</th>
                        <th className="py-2 px-3 text-left">Description</th>
                        <th className="py-2 px-3 text-center w-28">No. of People</th>
                        <th className="py-2 px-3 text-left">Occupancy Category</th>
                        <th className="py-2 px-3 text-right w-32">Per Capita Rate</th>
                        <th className="py-2 px-3 text-right w-36">Total Daily Load</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {wdRows.map((r, idx) => (
                        <tr key={r.id} className={idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/40 dark:bg-slate-900/20"}>
                          <td className="py-1.5 px-2 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-semibold">{r.name}</td>
                          <td className="py-1.5 px-3 text-center font-mono font-bold">{r.ppl}</td>
                          <td className="py-1.5 px-3 text-muted-foreground">{r.cat}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                            {(ip ? Math.round(r.lpd / 3.78541) : r.lpd).toLocaleString()} {ip ? "gpd" : "LPD"}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-[#0A7BC7]">
                            {(ip ? Math.round((r.ppl * r.lpd) / 3.78541) : r.ppl * r.lpd).toLocaleString()} {ip ? "gal" : "L"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100/70 dark:bg-slate-900/50 font-bold">
                        <td colSpan={2} className="py-2 px-3">TOTAL DOMESTIC DEMAND</td>
                        <td className="py-2 px-3 text-center font-mono">{calculations.totalPeople} People</td>
                        <td colSpan={2}></td>
                        <td className="py-2 px-3 text-right font-mono text-[#0A7BC7]">{calculations.displayDomestic}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 3: Irrigation Schedule Table */}
              <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground pb-2 border-b border-border/60">
                  3. Irrigation Landscaping Schedule
                </h3>
                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full border-collapse text-xs font-sans">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[11px] tracking-wider font-bold select-none">
                        <th className="py-2 px-2 text-center w-10">S.No</th>
                        <th className="py-2 px-3 text-left">Vegetation / Plant Type</th>
                        <th className="py-2 px-3 text-center w-32">Landscaping Area</th>
                        <th className="py-2 px-3 text-right w-36">Irrigation Rate</th>
                        <th className="py-2 px-3 text-right w-36">Total Daily Load</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {irrRows.map((r, idx) => (
                        <tr key={r.id} className={idx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/40 dark:bg-slate-900/20"}>
                          <td className="py-1.5 px-2 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="py-1.5 px-3 font-semibold">{r.vegType}</td>
                          <td className="py-1.5 px-3 text-center font-mono font-bold">{r.area} {ip ? "ft²" : "m²"}</td>
                          <td className="py-1.5 px-3 text-right font-mono text-muted-foreground">
                            {(ip ? Math.round((r.lpd / 40.7458) * 100) / 100 : r.lpd).toFixed(ip ? 3 : 1)} {ip ? "gal/ft²" : "L/m²"}
                          </td>
                          <td className="py-1.5 px-3 text-right font-mono font-bold text-[#0A7BC7]">
                            {(ip ? Math.round((r.area * r.lpd) / 3.78541) : r.area * r.lpd).toLocaleString()} {ip ? "gal" : "L"}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-slate-100/70 dark:bg-slate-900/50 font-bold">
                        <td colSpan={2} className="py-2 px-3">TOTAL IRRIGATION DEMAND</td>
                        <td colSpan={2}></td>
                        <td className="py-2 px-3 text-right font-mono text-[#0A7BC7]">{calculations.displayIrrigation}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>

      {/* Double-Click Calculation Breakdown & Edit Preview Modal */}
      {previewModalOpen && previewTarget && (
        <div
          onClick={() => setPreviewModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 dark:bg-black/60 backdrop-blur-2xl animate-fade-in font-sans"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white/90 dark:bg-neutral-950/90 backdrop-blur-2xl border border-white/60 dark:border-white/10 rounded-[24px] shadow-[0_30px_70px_rgba(0,0,0,0.18)] dark:shadow-[0_30px_70px_rgba(0,0,0,0.5)] flex flex-col w-full max-w-3xl max-h-[90vh] overflow-hidden transition-all duration-300 ease-in-out"
          >
            {/* Modal Header */}
            <header className="px-6 h-[72px] flex items-center justify-between border-b border-black/5 dark:border-white/5 shrink-0 bg-white/20 dark:bg-black/20">
              <div className="flex flex-col justify-center min-w-0 pr-4">
                <div className="flex items-center gap-2.5 min-w-0">
                  <h2 className="text-[16px] font-bold text-neutral-800 dark:text-neutral-100 truncate flex items-center gap-2">
                    <Calculator className="size-4.5 text-[#0A7BC7]" /> Water Demand Parameters &amp; Calculations
                  </h2>
                  <span className="px-2.5 py-0.75 rounded-md bg-[#0A7BC7]/10 border border-[#0A7BC7]/20 text-[#0A7BC7] text-[11px] font-bold font-mono tracking-tight shrink-0 uppercase">
                    {PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name} ({unitSystem === "ip" ? "IP Imperial" : "SI Metric"})
                  </span>
                </div>
                <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-normal mt-0.5 truncate">
                  Configure occupancy demand rates, retention reserve days, tank split allocations, and view live step-by-step calculations.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(false)}
                  className="size-9 grid place-items-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </header>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 text-xs font-sans">
              {/* Navigation Tabs inside Modal */}
              <div className="flex items-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-900/80 rounded-2xl border border-black/5 dark:border-white/5 overflow-x-auto">
                <button
                  onClick={() => setPreviewTarget({ type: "summary" })}
                  className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    previewTarget.type === "summary" ? "bg-[#0A7BC7] text-white shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  Executive Summary
                </button>
                <button
                  onClick={() => setPreviewTarget({ type: "domestic", rowId: wdRows[0]?.id })}
                  className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    previewTarget.type === "domestic" ? "bg-[#0A7BC7] text-white shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  Domestic Schedule ({wdRows.length})
                </button>
                <button
                  onClick={() => setPreviewTarget({ type: "tank" })}
                  className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    previewTarget.type === "tank" ? "bg-[#0A7BC7] text-white shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  Storage Tanks
                </button>
                <button
                  onClick={() => setPreviewTarget({ type: "pump" })}
                  className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    previewTarget.type === "pump" ? "bg-[#0A7BC7] text-white shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  Transfer Pumps
                </button>
                <button
                  onClick={() => setPreviewTarget({ type: "irrigation", rowId: irrRows[0]?.id })}
                  className={`px-3.5 py-1.75 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap text-xs ${
                    previewTarget.type === "irrigation" ? "bg-[#0A7BC7] text-white shadow-xs" : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  }`}
                >
                  Irrigation ({irrRows.length})
                </button>
              </div>

              {/* Dynamic Section Content */}
              {previewTarget.type === "domestic" && (() => {
                const selectedRow = wdRows.find((x) => x.id === previewTarget.rowId) || wdRows[0];
                if (!selectedRow) return <div className="text-center py-6 text-muted-foreground">No domestic entries added.</div>;
                const rowLPD = selectedRow.lpd;
                const rowTotalL = selectedRow.ppl * rowLPD;
                const pctShare = calculations.totalWaterL > 0 ? ((rowTotalL / calculations.totalWaterL) * 100).toFixed(1) : "0";

                return (
                  <div className="flex flex-col gap-5">
                    {/* Row Select Dropdown */}
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/60 p-3.5 rounded-2xl border border-black/5 dark:border-white/5">
                      <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">Select Domestic Entry:</label>
                      <select
                        value={selectedRow.id}
                        onChange={(e) => setPreviewTarget({ type: "domestic", rowId: Number(e.target.value) })}
                        className="bg-white/80 dark:bg-neutral-950/80 border border-black/10 dark:border-white/10 rounded-xl px-3 py-1.5 font-bold text-xs outline-none cursor-pointer focus:border-[#0A7BC7]"
                      >
                        {wdRows.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name} — ({r.ppl} ppl, {r.cat})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Editable Fields */}
                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-[#0A7BC7] uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                        <SlidersHorizontal className="size-3.5" /> General Parameters Controls
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Description
                          </label>
                          <input
                            type="text"
                            value={selectedRow.name}
                            onChange={(e) => handleWdRowChange(selectedRow.id, "name", e.target.value)}
                            className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12.5px] outline-none font-medium text-neutral-800 dark:text-neutral-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            No. of People / Units
                          </label>
                          <input
                            type="number"
                            value={selectedRow.ppl}
                            onChange={(e) => handleWdRowChange(selectedRow.id, "ppl", Number(e.target.value))}
                            className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12.5px] outline-none font-bold font-mono text-neutral-800 dark:text-neutral-100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Occupancy Category
                          </label>
                          <select
                            value={selectedRow.cat}
                            onChange={(e) => handleWdRowChange(selectedRow.id, "cat", e.target.value)}
                            className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12px] outline-none font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
                          >
                            {Object.keys(WD_TYPE_MAP).map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Formula & Step-by-Step Breakdown */}
                    <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-4.5 flex flex-col gap-3">
                      <h4 className="text-[11px] font-bold text-[#0A7BC7] uppercase tracking-widest flex items-center gap-1.5 font-sans">
                        <FileText className="size-3.5" /> Step-by-Step Demand Calculation Formula
                      </h4>
                      <div className="flex flex-col gap-2 font-mono text-[12px]">
                        <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] font-sans font-semibold">Per Capita Allowance Formula:</span>
                          <strong className="text-neutral-800 dark:text-neutral-100">
                            Base Rate ({WD_TYPE_MAP[selectedRow.cat] || 0} LPD) × Multiplier ({PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.multiplier || 1.0}×) = {rowLPD} LPD ({Math.round(rowLPD / 3.78541)} gpd)
                          </strong>
                        </div>
                        <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] font-sans font-semibold">Daily Domestic Load Formula:</span>
                          <strong className="text-[#0A7BC7]">
                            {selectedRow.ppl} People × {rowLPD} LPD = {rowTotalL.toLocaleString()} L/day ({Math.round(rowTotalL / 3.78541).toLocaleString()} gal/day)
                          </strong>
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-1 font-sans text-xs">
                          <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                            <span className="text-neutral-500 dark:text-neutral-400 block text-[10px]">Domestic Share:</span>
                            <strong className="text-neutral-800 dark:text-neutral-100 font-bold font-mono">{pctShare}% of total domestic water load</strong>
                          </div>
                          <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                            <span className="text-neutral-500 dark:text-neutral-400 block text-[10px]">Applied Standard:</span>
                            <strong className="text-neutral-800 dark:text-neutral-100 font-bold">{PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name}</strong>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {previewTarget.type === "irrigation" && (() => {
                const selectedRow = irrRows.find((x) => x.id === previewTarget.rowId) || irrRows[0];
                if (!selectedRow) return <div className="text-center py-6 text-muted-foreground">No irrigation entries added.</div>;
                const rowLPD = selectedRow.lpd;
                const rowTotalL = selectedRow.area * rowLPD;
                const pctShare = calculations.totalIrrL > 0 ? ((rowTotalL / calculations.totalIrrL) * 100).toFixed(1) : "0";

                return (
                  <div className="flex flex-col gap-5">
                    <div className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-900/60 p-3.5 rounded-2xl border border-black/5 dark:border-white/5">
                      <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider">Select Plant Zone:</label>
                      <select
                        value={selectedRow.id}
                        onChange={(e) => setPreviewTarget({ type: "irrigation", rowId: Number(e.target.value) })}
                        className="bg-white/80 dark:bg-neutral-950/80 border border-black/10 dark:border-white/10 rounded-xl px-3 py-1.5 font-bold text-xs outline-none cursor-pointer focus:border-[#0A7BC7]"
                      >
                        {irrRows.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.vegType} — ({r.area} {ip ? "ft²" : "m²"})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-[11px] font-bold text-[#0A7BC7] uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                        <SlidersHorizontal className="size-3.5" /> Irrigation Parameters Controls
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Vegetation / Plant Type
                          </label>
                          <select
                            value={selectedRow.vegType}
                            onChange={(e) => handleIrrRowChange(selectedRow.id, "vegType", e.target.value)}
                            className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12px] outline-none font-medium text-neutral-800 dark:text-neutral-100 cursor-pointer"
                          >
                            {Object.keys(IRR_TYPE_MAP).map((k) => (
                              <option key={k} value={k}>
                                {k} — {IRR_TYPE_MAP[k]} L/m²
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                            Area ({ip ? "ft²" : "m²"})
                          </label>
                          <input
                            type="number"
                            value={selectedRow.area}
                            onChange={(e) => handleIrrRowChange(selectedRow.id, "area", Number(e.target.value))}
                            className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12.5px] outline-none font-bold font-mono text-neutral-800 dark:text-neutral-100"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/40 rounded-2xl p-4.5 flex flex-col gap-3">
                      <h4 className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                        <FileText className="size-3.5" /> Irrigation Volume Formula
                      </h4>
                      <div className="flex flex-col gap-2 font-mono text-[12px]">
                        <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] font-sans font-semibold">Plant Water Requirement Rate:</span>
                          <strong className="text-neutral-800 dark:text-neutral-100">
                            {rowLPD} L/m²/day ({(rowLPD / 40.7458).toFixed(2)} gal/ft²/day)
                          </strong>
                        </div>
                        <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] font-sans font-semibold">Total Irrigation Volume Formula:</span>
                          <strong className="text-emerald-700 dark:text-emerald-400">
                            {selectedRow.area} m² × {rowLPD} L/m² = {rowTotalL.toLocaleString()} L/day ({Math.round(rowTotalL / 3.78541).toLocaleString()} gal/day)
                          </strong>
                        </div>
                        <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5 font-sans text-xs">
                          <span className="text-neutral-500 dark:text-neutral-400 block text-[10px]">Irrigation Load Share:</span>
                          <strong className="text-neutral-800 dark:text-neutral-100 font-bold font-mono">{pctShare}% of total site irrigation demand</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {previewTarget.type === "tank" && (
                <div className="flex flex-col gap-5">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-[#0A7BC7] uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                      <Building2 className="size-3.5 text-[#0A7BC7]" /> Storage Capacity &amp; Tank Split Controls
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                          Storage Retention Days
                        </label>
                        <select
                          value={storageDays}
                          onChange={(e) => setStorageDays(Number(e.target.value))}
                          className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12.5px] outline-none font-bold text-neutral-800 dark:text-neutral-100 cursor-pointer"
                        >
                          <option value={1}>1 Day Storage (24 Hours — Standard)</option>
                          <option value={1.5}>1.5 Day Storage (36 Hours — Intermediate Reserve)</option>
                          <option value={2}>2 Days Storage (48 Hours — DEWA/ADDC Reserve)</option>
                          <option value={3}>3 Days Storage (72 Hours — Emergency Reserve)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                          Total Storage Volume Required
                        </label>
                        <div className="h-9.5 px-3 bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-xs font-mono font-bold text-[#0A7BC7] flex items-center justify-between">
                          <span>{calculations.displayTotalStorage}</span>
                          <span className="text-[10px] font-sans text-neutral-500">({calculations.groundPct}% Ground / {calculations.totalOverheadPct}% Roof)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-2xl p-4.5 flex flex-col gap-3 font-mono text-xs">
                    <h4 className="text-[11px] font-bold text-[#0A7BC7] uppercase tracking-widest flex items-center gap-1.5 font-sans">
                      <FileText className="size-3.5" /> Tank Sizing Formulas &amp; Physical Dimensions
                    </h4>
                    <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5">
                      <span className="text-neutral-500 dark:text-neutral-400 block text-[10px] font-sans font-semibold">Total Required Storage Volume:</span>
                      <strong className="text-[#0A7BC7]">
                        Grand Daily Demand ({calculations.displayGrandTotal}) × {storageDays} Day(s) = {calculations.displayTotalStorage}
                      </strong>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-1">
                        <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-sans font-semibold">
                          Ground Break Tank ({calculations.groundPct}% Share):
                        </span>
                        <strong className="text-neutral-800 dark:text-neutral-100">{calculations.displayGroundTank}</strong>
                        <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-sans mt-1">
                          Dimensions: <strong>{calculations.groundDim.l}m L × {calculations.groundDim.w}m W × {calculations.groundDim.h}m H</strong> (+ 0.3m freeboard)
                        </span>
                      </div>
                      {calculations.overheadTanksCalculated.map((t) => (
                        <div key={t.id} className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-1">
                          <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-sans font-semibold">
                            {t.name} ({t.sharePct.toFixed(0)}% Share):
                          </span>
                          <strong className="text-neutral-800 dark:text-neutral-100">{t.displayVol}</strong>
                          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 font-sans mt-1">
                            Dimensions: <strong>{t.dim.l}m L × {t.dim.w}m W × {t.dim.h}m H</strong> (+ 0.3m freeboard)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {previewTarget.type === "pump" && (
                <div className="flex flex-col gap-5">
                  <div className="space-y-3">
                    <h4 className="text-[11px] font-bold text-[#0A7BC7] uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5 flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-[#0A7BC7]" /> Peak Flow &amp; Transfer Pump Duty Parameters
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                          Diversity / Peak Multiplier (K)
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          value={peakFactor}
                          onChange={(e) => setPeakFactor(Number(e.target.value))}
                          className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12.5px] outline-none font-bold font-mono text-neutral-800 dark:text-neutral-100"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest mb-1.5">
                          Roof Tank Filling Window
                        </label>
                        <select
                          value={fillWindowHours}
                          onChange={(e) => setFillWindowHours(Number(e.target.value))}
                          className="w-full h-9.5 px-3 bg-white/40 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-[#0A7BC7] focus:ring-2 focus:ring-[#0A7BC7]/10 rounded-xl text-[12.5px] outline-none font-bold text-neutral-800 dark:text-neutral-100 cursor-pointer"
                        >
                          <option value={1}>1 Hour Filling Window</option>
                          <option value={2}>2 Hours Filling Window (Standard)</option>
                          <option value={3}>3 Hours Filling Window</option>
                          <option value={4}>4 Hours Filling Window</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-900/40 rounded-2xl p-4.5 flex flex-col gap-3 font-mono text-xs">
                    <h4 className="text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                      <FileText className="size-3.5" /> Hydraulic Flow Calculation Formulas
                    </h4>
                    <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-1">
                      <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-sans font-semibold">Peak Domestic Instantaneous Flow Formula:</span>
                      <strong className="text-neutral-800 dark:text-neutral-100">
                        (Daily Domestic Load [{calculations.displayDomestic}] × Peak Factor {peakFactor}) / (10 operating hrs × 3600 sec)
                      </strong>
                      <span className="text-[#0A7BC7] font-bold text-sm mt-1">Calculated Peak Flow = {calculations.displayDomesticPeak}</span>
                    </div>

                    <div className="p-3 bg-white/80 dark:bg-neutral-950/80 rounded-xl border border-black/5 dark:border-white/5 flex flex-col gap-1">
                      <span className="text-neutral-500 dark:text-neutral-400 text-[10px] font-sans font-semibold">Roof Transfer Pump Duty Flow Formula:</span>
                      <strong className="text-neutral-800 dark:text-neutral-100">
                        Roof Tank Capacity [{calculations.displayRoofTank}] / Filling Duration [{fillWindowHours} Hours]
                      </strong>
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm mt-1">Required Transfer Duty Flow = {calculations.displayTransferPump}</span>
                    </div>
                  </div>
                </div>
              )}

              {(previewTarget.type === "summary" || previewTarget.type === "pool" || previewTarget.type === "fire") && (
                <div className="flex flex-col gap-4">
                  <h4 className="text-[11px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-widest border-b border-black/5 dark:border-white/5 pb-1.5">
                    Executive Calculation Summary &amp; Load Breakdown
                  </h4>
                  <div className="overflow-x-auto border border-black/10 dark:border-white/10 rounded-2xl overflow-hidden">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-neutral-900 text-white font-semibold">
                          <th className="p-2.5 text-left">Parameter</th>
                          <th className="p-2.5 text-right">Calculated Value</th>
                          <th className="p-2.5 text-center">Unit</th>
                          <th className="p-2.5 text-left">Design Guideline / Code Reference</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
                        <tr>
                          <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Domestic Daily Demand</td>
                          <td className="p-2.5 text-right font-bold text-[#0A7BC7]">{calculations.displayDomestic}</td>
                          <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                          <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">{PRESET_STANDARDS[presetStandard as keyof typeof PRESET_STANDARDS]?.name}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Domestic Peak Flow Rate</td>
                          <td className="p-2.5 text-right font-bold text-[#0A7BC7]">{calculations.displayDomesticPeak}</td>
                          <td className="p-2.5 text-center">{ip ? "GPM" : "L/s"}</td>
                          <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Peak Factor K = {peakFactor}</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Irrigation Daily Load</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600 dark:text-emerald-400">{calculations.displayIrrigation}</td>
                          <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                          <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Landscaping Area Schedule ({irrRows.length} zones)</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Pool Daily Evaporation Makeup</td>
                          <td className="p-2.5 text-right font-bold text-sky-600 dark:text-sky-400">{calculations.displayPoolDemand}</td>
                          <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                          <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Evaporation Rate = {poolEvap}%/day</td>
                        </tr>
                        <tr className="bg-neutral-100/70 dark:bg-neutral-900/70 font-bold">
                          <td className="p-2.5 font-sans text-neutral-800 dark:text-neutral-100">GRAND TOTAL DAILY CONSUMPTION</td>
                          <td className="p-2.5 text-right text-base text-[#0A7BC7]">{calculations.displayGrandTotal}</td>
                          <td className="p-2.5 text-center">{ip ? "gal/day" : "L/day"}</td>
                          <td className="p-2.5 font-sans text-neutral-700 dark:text-neutral-300">Combined Site Water Demand</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Total Water Storage Requirement</td>
                          <td className="p-2.5 text-right font-bold text-neutral-800 dark:text-neutral-100">{calculations.displayTotalStorage}</td>
                          <td className="p-2.5 text-center">{ip ? "gal" : "m³"}</td>
                          <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">{storageDays} Day(s) Retention Reserve</td>
                        </tr>
                        <tr>
                          <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">Ground Break Tank Capacity</td>
                          <td className="p-2.5 text-right font-bold text-[#0A7BC7]">{calculations.displayGroundTank}</td>
                          <td className="p-2.5 text-center">{ip ? "gal" : "L"}</td>
                          <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Ground Split Allocation: {calculations.groundPct}%</td>
                        </tr>
                        {calculations.overheadTanksCalculated.map((t) => (
                          <tr key={t.id}>
                            <td className="p-2.5 font-sans font-semibold text-neutral-800 dark:text-neutral-100">{t.name} Capacity</td>
                            <td className="p-2.5 text-right font-bold text-[#0A7BC7]">{t.displayVol}</td>
                            <td className="p-2.5 text-center">{ip ? "gal" : "L"}</td>
                            <td className="p-2.5 font-sans text-neutral-500 dark:text-neutral-400">Roof Split Allocation: {t.sharePct.toFixed(0)}%</td>
                          </tr>
                        ))}
                        <tr className="bg-blue-50/60 dark:bg-blue-950/40 font-bold">
                          <td className="p-2.5 font-sans text-[#0A7BC7]">Transfer Pump Duty Flow</td>
                          <td className="p-2.5 text-right text-[#0A7BC7]">{calculations.displayTransferPump}</td>
                          <td className="p-2.5 text-center text-[#0A7BC7]">{ip ? "GPM" : "L/s"}</td>
                          <td className="p-2.5 font-sans text-[#0A7BC7]">{fillWindowHours}-Hour Roof Tank Filling Window</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <footer className="px-6 h-[64px] border-t border-black/5 dark:border-white/5 bg-white/20 dark:bg-black/20 flex items-center justify-between shrink-0">
              <span className="text-[11.5px] text-neutral-500 dark:text-neutral-400 font-semibold flex items-center gap-1.5">
                <Check className="size-4 text-emerald-600 dark:text-emerald-400" /> Changes apply live to project calculation schedule
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-5 py-2.5 bg-[#0A7BC7] hover:bg-[#06456F] text-white font-bold rounded-xl text-xs transition-all cursor-pointer shadow-md"
              >
                Done / Apply Changes
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Row Comment Modal */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={Boolean(commentTarget)}
          onClose={() => setCommentTarget(null)}
          targetId={commentTarget.targetId}
          targetName={commentTarget.targetName}
          targetType={commentTarget.targetType}
          calculatorTitle="Water Demand Calculator"
          calculatorPath="/plumbing-water-demand"
          existingComments={commentTarget.existingComments}
          onSave={handleSaveRowComment}
        />
      )}

      {/* Unit System Change Confirmation Modal */}
      {showUnitConfirmModal && pendingUnitTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 font-sans">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md p-6 flex flex-col gap-5 shadow-2xl animate-fade-in select-none">
            <div className="flex justify-between items-center pb-2 border-b border-border/60">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0A7BC7]/10 rounded-xl text-[#0A7BC7]">
                  <Gauge className="size-5" />
                </div>
                <h3 className="font-bold text-base text-foreground">Unit System Change</h3>
              </div>
              <button
                type="button"
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground text-sm">
                Switching to {pendingUnitTarget === "ip" ? "Imperial (IP - GPD, ft², ft)" : "Metric (SI - LPD, m², m)"}
              </p>
              <p>
                How would you like to handle your existing area and depth inputs (Irrigation Areas, Pool Area, Pool Depth)?
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {/* Option 1: Convert Input Values */}
              <button
                type="button"
                onClick={() => executeUnitSystemChange(pendingUnitTarget, true)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-[#0A7BC7]/30 bg-[#0A7BC7]/5 hover:bg-[#0A7BC7]/10 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-[#0A7BC7]/15 text-[#0A7BC7] shrink-0 mt-0.5">
                  <RefreshCw className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground group-hover:text-[#0A7BC7] transition">
                    Convert Input Values (Convert Numbers)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Convert Areas &amp; Depths to {pendingUnitTarget === "ip" ? "ft² / ft" : "m² / m"} (e.g. {pendingUnitTarget === "ip" ? "100 m² → 1,076 ft²" : "1,076 ft² → 100 m²"}). Water loads recalculate accordingly.
                  </span>
                </div>
              </button>

              {/* Option 2: Keep Current Input Values */}
              <button
                type="button"
                onClick={() => executeUnitSystemChange(pendingUnitTarget, false)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-slate-100/40 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-left group"
              >
                <div className="p-2 rounded-lg bg-slate-200/60 dark:bg-slate-700/60 text-muted-foreground shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-bold text-xs text-foreground transition">
                    Switch Units Only (Keep Numbers)
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Keep your numerical inputs as-is and only change display labels to {pendingUnitTarget === "ip" ? "IP (gpd/gal)" : "SI (lpd/L)"}.
                  </span>
                </div>
              </button>
            </div>

            <div className="pt-2 border-t border-border/60 flex justify-end">
              <button
                type="button"
                onClick={() => { setShowUnitConfirmModal(false); setPendingUnitTarget(null); }}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Domestic Water Entry Modal Popup */}
      {showAddWdModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0A7BC7]/10 rounded-xl text-[#0A7BC7]">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Add Domestic Water Entry</h3>
                  <p className="text-xs text-muted-foreground">Add a new space occupancy entry to the water demand schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddWdModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-foreground">Description / Space Name</label>
                  {newWdAutoDetected && (
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                      <span className="size-2 rounded-full bg-blue-500 inline-block animate-pulse" />
                      Auto-detected standard
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="e.g. Rest Room / Changing Room, 1BHK, Office, Classroom, Clinic"
                  value={newWdName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewWdName(val);
                    const detected = detectAshraeOccupancy(val);
                    if (detected && detected.cat && WD_TYPE_MAP[detected.cat] !== undefined) {
                      setNewWdPeople(detected.people);
                      setNewWdCat(detected.cat);
                      setNewWdAutoDetected(true);
                    } else {
                      setNewWdAutoDetected(false);
                    }
                  }}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">No. of People / Units</label>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    value={newWdPeople}
                    onChange={(e) => setNewWdPeople(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Space Multiplier (Qty)</label>
                  <input
                    type="number"
                    min={1}
                    placeholder="e.g. 1"
                    value={newWdMultiplier}
                    onChange={(e) => setNewWdMultiplier(e.target.value !== "" ? Math.max(1, Number(e.target.value)) : "")}
                    className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Occupancy Category</label>
                <select
                  value={newWdCat}
                  onChange={(e) => setNewWdCat(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                >
                  <option value="">— Select Category —</option>
                  <optgroup label="Residential">
                    <option value="Residential buildings (flat)">Residential buildings (flat) — 300 LPD</option>
                    <option value="Villas">Villas — 350 LPD</option>
                    <option value="Mixed used residential">Mixed used residential — 350 LPD</option>
                    <option value="Labour accommodation">Labour accommodation — 150 LPD</option>
                  </optgroup>
                  <optgroup label="Office & Commercial">
                    <option value="Offices">Offices — 60 LPD</option>
                    <option value="Headquarters">Headquarters — 80 LPD</option>
                    <option value="Commercial buildings">Commercial buildings — 100 LPD</option>
                    <option value="Mixed used commercial">Mixed used commercial — 80 LPD</option>
                    <option value="Logistic, academic & business center">Logistic & business center — 75 LPD</option>
                  </optgroup>
                  <optgroup label="Retail & Leisure">
                    <option value="Local plaza / retail / town center">Local plaza / retail — 82 LPD</option>
                    <option value="Shops">Shops — 60 LPD</option>
                    <option value="Club house / recreation">Club house / recreation — 100 LPD</option>
                    <option value="Entertainment & leisure / theater">Leisure / theater — 60 LPD</option>
                    <option value="Theatre">Theatre — 50 LPD</option>
                    <option value="Events">Events — 50 LPD</option>
                    <option value="Guardhouse">Guardhouse — 75 LPD</option>
                  </optgroup>
                  <optgroup label="Hospitality & Dining">
                    <option value="Hotels (per guest)">Hotels (per guest) — 300 LPD</option>
                    <option value="Hotels (per employee)">Hotels (per employee) — 80 LPD</option>
                    <option value="Restaurant (per meal)">Restaurant (per meal) — 15 LPD</option>
                    <option value="Visitors">Visitors — 40 LPD</option>
                  </optgroup>
                  <optgroup label="Education">
                    <option value="Schools / university">Schools / university — 60 LPD</option>
                    <option value="Nursery / child care centre">Nursery / child care centre — 70 LPD</option>
                  </optgroup>
                  <optgroup label="Healthcare & Medical">
                    <option value="Medical (per bed)">Medical (per bed) — 450 LPD</option>
                    <option value="Day clinic (per medical practitioner) incl. visitors">Day clinic (per practitioner) — 450 LPD</option>
                    <option value="Laboratory">Laboratory — 80 LPD</option>
                  </optgroup>
                  <optgroup label="Industrial & Workshops">
                    <option value="Industrial (workshops / machinery / warehouse)">Industrial (workshops / warehouse) — 80 LPD</option>
                    <option value="Manufacturing / mineral">Manufacturing / mineral — 80 LPD</option>
                  </optgroup>
                  <optgroup label="Public & Assembly">
                    <option value="Mosques">Mosques — 60 LPD</option>
                    <option value="Public amenities">Public amenities — 50 LPD</option>
                  </optgroup>
                  <optgroup label="Custom / Override">
                    <option value="Custom Rate / Category">✨ Custom Rate / Custom Category...</option>
                  </optgroup>
                </select>
              </div>

              {newWdCat === "Custom Rate / Category" && (
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-foreground">Custom Per Capita Rate ({ip ? "gpd" : "LPD"})</label>
                  <input
                    type="number"
                    placeholder={ip ? "e.g. 30 gpd" : "e.g. 100 LPD"}
                    value={newWdCustomLpd}
                    onChange={(e) => setNewWdCustomLpd(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  />
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddWdModal(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddWd}
                className="px-4 py-2 bg-[#0A7BC7] hover:bg-[#0863a0] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="size-4" /> Add Entry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Irrigation Plant Area Modal Popup */}
      {showAddIrrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-[#0A7BC7]/10 rounded-xl text-[#0A7BC7]">
                  <Plus className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">Add Irrigation Plant Area</h3>
                  <p className="text-xs text-muted-foreground">Add a landscape area to the irrigation schedule</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddIrrModal(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Area ({ip ? "ft²" : "m²"})</label>
                <input
                  type="number"
                  placeholder="e.g. 100"
                  value={newIrrArea}
                  onChange={(e) => setNewIrrArea(e.target.value !== "" ? Number(e.target.value) : "")}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-sm font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                  autoFocus
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-foreground">Vegetation Type</label>
                <select
                  value={newIrrVegType}
                  onChange={(e) => setNewIrrVegType(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-border/80 rounded-xl px-3 py-2 text-xs font-medium outline-none focus:border-[#0A7BC7] shadow-2xs"
                >
                  <option value="">— Select Plant Type —</option>
                  {Object.keys(IRR_TYPE_MAP).map((k) => (
                    <option key={k} value={k}>
                      {k} — {IRR_TYPE_MAP[k]} L/m²
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-3 border-t border-border/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddIrrModal(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-bold text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddIrr}
                className="px-4 py-2 bg-[#0A7BC7] hover:bg-[#0863a0] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition cursor-pointer shadow-xs"
              >
                <Plus className="size-4" /> Add Plant Area
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

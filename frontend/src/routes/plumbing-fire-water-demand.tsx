import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditBuildingModal } from "@/components/workspace/EditBuildingModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, Flame, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers, ArrowRight,
  Building2, Building, Factory, SlidersHorizontal, Plus, Download, Search, CheckSquare,
  Square, Eye, ExternalLink, ChevronDown, ChevronRight, RefreshCw, BarChart2, Shield,
  FileSpreadsheet, ArrowUpDown, MousePointerClick
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { TBtn } from "@/components/workspace/Button";
import {
  type CivilDefenseBuilding,
  type CivilDefenseOccupancy,
  type CivilDefenseEvaluation,
  evaluateCivilDefenseFireDemand,
  getRecommendedHeaderSize,
  CIVIL_DEFENSE_PRESETS,
  type CivilDefensePresetConfig
} from "@/lib/civilDefenseFireDemandCalc";

export const Route = createFileRoute("/plumbing-fire-water-demand")({
  head: () => ({
    meta: [
      { title: "UAE Civil Defense Fire Water Demand Calculator — MEP Calc" },
      { name: "description", content: "Determine fire pump flow, pressure, storage tanks, and intermediate staging per UAE Civil Defense Code Tables 9.18 to 9.21.e." },
    ],
  }),
  component: FireWaterDemandPage,
});

// Occupancy Labels and Helpers
export const OCCUPANCY_OPTIONS: { value: CivilDefenseOccupancy; label: string; desc: string }[] = [
  { value: "residential", label: "Residential (Apartments / Labor / Staff)", desc: "Flats, staff accommodation, hostels, boarding houses" },
  { value: "business", label: "Business (Offices / Banks / Professional)", desc: "Corporate offices, service providers, civic buildings" },
  { value: "hotel", label: "Hotel & Hospitality", desc: "Hotels, motels, luxury furnished apartments, resorts" },
  { value: "mercantile_ab", label: "Mercantile Class A & B (Retail / Malls)", desc: "Shopping malls, supermarkets, department stores" },
  { value: "mercantile_c_kiosk", label: "Mercantile Class C / Kiosks", desc: "Small retail shops, kiosks, convenience booths" },
  { value: "assembly", label: "Assembly (Cinemas / Auditoriums / Clubs)", desc: "Theaters, convention centers, places of worship" },
  { value: "education", label: "Education (Schools / Universities)", desc: "Classrooms, libraries, laboratories, nurseries" },
  { value: "healthcare_a", label: "Healthcare Group A (Hospitals / Inpatient)", desc: "Hospitals with sleeping accommodations, ICUs" },
  { value: "healthcare_bc", label: "Healthcare Group B & C (Outpatient Clinics)", desc: "Day clinics, specialized medical consultation" },
  { value: "day_care", label: "Day Care Centers", desc: "Infant and child day care facilities" },
  { value: "detention", label: "Detention & Correctional", desc: "Prisons, correctional centers, reformatories" },
  { value: "animal_housing", label: "Animal Housing / Veterinary", desc: "Stables, veterinary clinics, kennels" },
  { value: "converted_villa", label: "Converted Existing G+1 Villa", desc: "Villas converted to commercial, educational, or medical use" },
  { value: "mosque_with_commercial", label: "Commercial Outlet on Villa / Mosque", desc: "Shops, cafes, or pharmacies attached to villas or mosques" },
];

// Initial Demonstration Project Schedule
const INITIAL_BUILDINGS: CivilDefenseBuilding[] = [
  {
    id: "bld-tower-a",
    name: "Tower A (Super Highrise Hotel & Residences)",
    height: 110,
    floors: 32,
    plotArea: 14000,
    groundFloorArea: 1800,
    occupancy: "hotel",
    standpipeCount: 3,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 2,
    notes: "Requires 1000 GPM @ 17 bar lowest pump + intermediate 1000 GPM @ 6.9 bar staging pump at +90m."
  },
  {
    id: "bld-block-b",
    name: "Block B (Highrise Commercial Offices)",
    height: 65,
    floors: 18,
    plotArea: 18000,
    groundFloorArea: 2200,
    occupancy: "business",
    standpipeCount: 2,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 2,
    notes: "Standard Highrise Tier 1: 750 GPM @ 6.9 bar combined pump, 60-min dedicated water tank."
  },
  {
    id: "bld-podium-c",
    name: "Block C (Podium Retail Mall & Cineplex)",
    height: 14,
    floors: 3,
    plotArea: 24000,
    groundFloorArea: 4800,
    occupancy: "mercantile_ab",
    standpipeCount: 3,
    hasInfraHydrants60m: false,
    isSingleExitStair: false,
    basementCount: 1,
    notes: "Large plot (>20,000 m²) without 60m infra hydrants: 1000 GPM @ 6.9 bar combined pump for yard hydrants."
  },
  {
    id: "bld-staff-d",
    name: "Block D (Staff Accommodation Lowrise)",
    height: 18,
    floors: 5,
    plotArea: 3500,
    groundFloorArea: 800,
    occupancy: "residential",
    standpipeCount: 1,
    hasInfraHydrants60m: true,
    isSingleExitStair: false,
    basementCount: 0,
    notes: "Midrise residential with GFA <= 900 m²: 50 GPM @ 4.5 bar dry riser + hose reel system."
  }
];

type ActiveTab = "schedule" | "tanks" | "report";

export function FireWaterDemandPage() {
  const { userData, profile } = useAuth();
  const currentUserName = userData?.name || profile?.name || "Senior MEP Fire Engineer";

  const { project, isReadOnly, forceSaveToCloud } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-fire-water-demand", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole);

  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);

  // Tabs & navigation
  const [tab, setTab] = useState<ActiveTab>("schedule");
  const [intelOpen, setIntelOpen] = useState(false);

  // Unit System: SI (LPM, bar, m³, m) vs IP (GPM, psi, gal, ft)
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // Multi-Building Schedule State
  const [buildings, setBuildings] = useState<CivilDefenseBuilding[]>(INITIAL_BUILDINGS);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(INITIAL_BUILDINGS[0].id);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set([INITIAL_BUILDINGS[0].id]));
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOccupancy, setFilterOccupancy] = useState<string>("all");

  // Double-Click Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<CivilDefenseBuilding>(INITIAL_BUILDINGS[0]);

  // Report Tab Selected Building View
  const [reportBuildingId, setReportBuildingId] = useState<string>(INITIAL_BUILDINGS[0].id);

  // Physical Tank Dimensions Sizer State for Active Building
  const [tankLength, setTankLength] = useState<number>(10.0); // meters
  const [tankWidth, setTankWidth] = useState<number>(6.0); // meters
  const [tankFreeboard, setTankFreeboard] = useState<number>(0.30); // meters (air gap)
  const [tankDeadVolumeDepth, setTankDeadVolumeDepth] = useState<number>(0.20); // meters (anti-vortex sump)
  const [cityMainRefillFlowGpm, setCityMainRefillFlowGpm] = useState<number>(150); // GPM refill from city network

  // Assign Comment Modal State
  const [commentModalOpen, setCommentModalOpen] = useState(false);
  const [commentTargetId, setCommentTargetId] = useState<string | null>(null);

  // Storage key for persistence
  const storageKey = useMemo(() => {
    return `mep_fire_water_demand_schedule_${project?.id || "default"}`;
  }, [project?.id]);

  // Load saved schedule on mount or project switch
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBuildings(parsed);
          setSelectedBuildingId(parsed[0].id);
          setSelectedRowIds(new Set([parsed[0].id]));
          setReportBuildingId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to load saved fire water demand schedule", e);
      }
    }
  }, [storageKey]);

  // Persist changes
  const saveSchedule = (newBuildings: CivilDefenseBuilding[]) => {
    setBuildings(newBuildings);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newBuildings));
      dirtyStore.set(true);
      forceSaveToCloud?.();
    } catch (e) {
      console.error("Failed to save fire water demand schedule", e);
    }
  };

  // Inline update handler for building inputs or manual output overrides
  const handleUpdateBuilding = (id: string, updates: Partial<CivilDefenseBuilding>, clearOverrides = false) => {
    if (isEffectiveReadOnly) return;
    const nextList = buildings.map((b) => {
      if (b.id !== id) return b;
      if (clearOverrides) {
        const copy: CivilDefenseBuilding = { ...b, ...updates };
        delete copy.overridePumpFlowGpm;
        delete copy.overridePumpPressureBar;
        delete copy.overrideTankDurationMin;
        delete copy.overrideNetStorageM3;
        return copy;
      }
      return { ...b, ...updates };
    });
    saveSchedule(nextList);
  };

  // Reset manual output overrides back to statutory code formulas
  const handleResetRowOverrides = (id: string) => {
    if (isEffectiveReadOnly) return;
    const nextList = buildings.map((b) => {
      if (b.id !== id) return b;
      const copy: CivilDefenseBuilding = { ...b };
      delete copy.overridePumpFlowGpm;
      delete copy.overridePumpPressureBar;
      delete copy.overrideTankDurationMin;
      delete copy.overrideNetStorageM3;
      return copy;
    });
    saveSchedule(nextList);
    toast.success("Reset building outputs to Civil Defense statutory formulas");
  };

  // Version Restore Handler
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = storageKey;
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
      if (Array.isArray(restoredData) && restoredData.length > 0) {
        setBuildings(restoredData);
        setSelectedBuildingId(restoredData[0].id);
        setSelectedRowIds(new Set([restoredData[0].id]));
        setReportBuildingId(restoredData[0].id);
        toast.info("Fire Water Demand schedule restored from version snapshot");
      }
    };

    window.addEventListener("mep-version-restored" as any, handleVersionRestored);
    return () => window.removeEventListener("mep-version-restored" as any, handleVersionRestored);
  }, [storageKey]);

  // Unit toggle handler (Sewage & Drainage format)
  const handleUnitSystemChange = (nextSystem: "ip" | "si", shouldConvert?: boolean) => {
    if (isEffectiveReadOnly) return;
    setUnitSystem(nextSystem);
    dirtyStore.set(true);
  };

  // Computed Evaluations for ALL buildings
  const evaluatedBuildings = useMemo(() => {
    return buildings.map((b) => ({
      building: b,
      evaluation: evaluateCivilDefenseFireDemand(b),
    }));
  }, [buildings]);

  // Currently Active Selected Building & its Evaluation
  const activeItem = useMemo(() => {
    const found = evaluatedBuildings.find((item) => item.building.id === selectedBuildingId);
    return found || evaluatedBuildings[0] || null;
  }, [evaluatedBuildings, selectedBuildingId]);

  // Active Building for Report Tab
  const reportItem = useMemo(() => {
    const found = evaluatedBuildings.find((item) => item.building.id === reportBuildingId);
    return found || activeItem || evaluatedBuildings[0] || null;
  }, [evaluatedBuildings, reportBuildingId, activeItem]);

  // Project KPI Rollups
  const projectSummary = useMemo(() => {
    let maxPumpFlowGpm = 0;
    let maxPumpPressureBar = 0;
    let totalNetStorageM3 = 0;
    let totalGrossStorageM3 = 0;
    let superHighriseCount = 0;
    let yardHydrantRequiredCount = 0;

    for (const item of evaluatedBuildings) {
      const ev = item.evaluation;
      if (ev.lowestFirePumpFlowGpm > maxPumpFlowGpm) {
        maxPumpFlowGpm = ev.lowestFirePumpFlowGpm;
        maxPumpPressureBar = ev.lowestFirePumpPressureBar;
      } else if (ev.lowestFirePumpFlowGpm === maxPumpFlowGpm) {
        if (ev.lowestFirePumpPressureBar > maxPumpPressureBar) {
          maxPumpPressureBar = ev.lowestFirePumpPressureBar;
        }
      }
      totalNetStorageM3 += ev.totalNetWaterStorageM3;
      totalGrossStorageM3 += ev.totalGrossWaterStorageM3;
      if (ev.requiresStagingPumps) superHighriseCount++;
      if (ev.isYardHydrantRequired) yardHydrantRequiredCount++;
    }

    const header = getRecommendedHeaderSize(maxPumpFlowGpm);

    return {
      buildingCount: evaluatedBuildings.length,
      maxPumpFlowGpm,
      maxPumpFlowLpm: Math.round(maxPumpFlowGpm * 3.78541),
      maxPumpPressureBar,
      maxPumpPressurePsi: Math.round(maxPumpPressureBar * 14.5038),
      totalNetStorageM3: parseFloat(totalNetStorageM3.toFixed(1)),
      totalNetStorageGal: Math.round(totalNetStorageM3 / 0.00378541),
      totalGrossStorageM3: parseFloat(totalGrossStorageM3.toFixed(1)),
      totalGrossStorageGal: Math.round(totalGrossStorageM3 / 0.00378541),
      superHighriseCount,
      yardHydrantRequiredCount,
      governingHeaderNps: header.nps,
      governingHeaderDn: header.dn,
      governingHeaderVelocity: header.velocityFps,
    };
  }, [evaluatedBuildings]);

  // Physical Water Tank Calculation for Active Building
  const activeTankSizing = useMemo(() => {
    if (!activeItem) return null;
    const netM3 = activeItem.evaluation.mainTankNetVolumeM3;
    const l = Math.max(1.0, tankLength);
    const w = Math.max(1.0, tankWidth);
    const floorArea = l * w;

    const effectiveDepth = floorArea > 0 ? netM3 / floorArea : 0;
    const totalHeight = effectiveDepth + tankFreeboard + tankDeadVolumeDepth;
    const grossVolumeM3 = floorArea * totalHeight;
    const grossVolumeGal = Math.round(grossVolumeM3 / 0.00378541);

    const refillLpm = cityMainRefillFlowGpm * 3.78541;
    const refillM3h = (refillLpm * 60) / 1000;
    const fillTimeHours = refillM3h > 0 ? netM3 / refillM3h : 0;

    return {
      floorArea: parseFloat(floorArea.toFixed(2)),
      effectiveDepth: parseFloat(effectiveDepth.toFixed(2)),
      totalHeight: parseFloat(totalHeight.toFixed(2)),
      grossVolumeM3: parseFloat(grossVolumeM3.toFixed(1)),
      grossVolumeGal,
      fillTimeHours: parseFloat(fillTimeHours.toFixed(1)),
      waterWavePercent: totalHeight > 0 ? Math.min(85, Math.max(15, (effectiveDepth / totalHeight) * 100)) : 50,
    };
  }, [activeItem, tankLength, tankWidth, tankFreeboard, tankDeadVolumeDepth, cityMainRefillFlowGpm]);

  // Double-Click Handler: Opens EditBuildingModal
  const handleOpenEditModal = (buildingId: string) => {
    const target = buildings.find((b) => b.id === buildingId);
    if (target) {
      setEditingBuilding(target);
      setSelectedBuildingId(buildingId);
      setEditModalOpen(true);
    }
  };

  // Save changes from EditBuildingModal
  const handleSaveEditedBuilding = (updated: CivilDefenseBuilding) => {
    if (isEffectiveReadOnly) return;
    const nextList = buildings.map((b) => (b.id === updated.id ? updated : b));
    saveSchedule(nextList);
    toast.success(`Updated ${updated.name}`);
  };

  // Multi-Selection Handlers (Ventilation-Style)
  const toggleSelectAll = () => {
    if (selectedRowIds.size === buildings.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(buildings.map((b) => b.id)));
    }
  };

  const toggleSelectRow = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const next = new Set(selectedRowIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRowIds(next);
    setSelectedBuildingId(id);
    setReportBuildingId(id);
  };

  // Add Building from Preset
  const handleAddPreset = (presetConfig: CivilDefensePresetConfig) => {
    if (isEffectiveReadOnly) {
      toast.error("Calculation is approved/locked. Unlock to modify schedule.");
      return;
    }
    const newId = `bld-${Date.now().toString(36)}`;
    const newBuilding: CivilDefenseBuilding = {
      ...presetConfig.defaultBuilding,
      id: newId,
      name: `${presetConfig.defaultBuilding.name} (${buildings.length + 1})`,
    };
    const nextList = [...buildings, newBuilding];
    saveSchedule(nextList);
    setSelectedBuildingId(newId);
    setSelectedRowIds(new Set([newId]));
    setReportBuildingId(newId);
    toast.success(`Added ${newBuilding.name} per ${presetConfig.tableRef}`);
  };

  // Add Custom Building
  const handleAddNewBuilding = () => {
    if (isEffectiveReadOnly) {
      toast.error("Calculation is approved/locked.");
      return;
    }
    const newId = `bld-${Date.now().toString(36)}`;
    const newBuilding: CivilDefenseBuilding = {
      id: newId,
      name: `New Building Block (${buildings.length + 1})`,
      height: 25,
      floors: 8,
      plotArea: 10000,
      groundFloorArea: 2000,
      occupancy: "business",
      standpipeCount: 2,
      hasInfraHydrants60m: true,
      isSingleExitStair: false,
      basementCount: 1,
    };
    const nextList = [...buildings, newBuilding];
    saveSchedule(nextList);
    setSelectedBuildingId(newId);
    setSelectedRowIds(new Set([newId]));
    setReportBuildingId(newId);
    setEditingBuilding(newBuilding);
    setEditModalOpen(true);
    toast.success("Added new building block. Configure parameters in modal.");
  };

  // Duplicate Selected
  const handleDuplicateSelected = () => {
    if (isEffectiveReadOnly) return;
    const toDuplicate = buildings.filter((b) => selectedRowIds.has(b.id));
    if (toDuplicate.length === 0) {
      toast.error("No buildings selected to duplicate");
      return;
    }
    const clones: CivilDefenseBuilding[] = toDuplicate.map((b) => ({
      ...b,
      id: `bld-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`,
      name: `${b.name} (Copy)`,
    }));
    const nextList = [...buildings, ...clones];
    saveSchedule(nextList);
    setSelectedRowIds(new Set(clones.map((c) => c.id)));
    setSelectedBuildingId(clones[0].id);
    setReportBuildingId(clones[0].id);
    toast.success(`Duplicated ${toDuplicate.length} building(s)`);
  };

  // Delete Selected
  const handleDeleteSelected = () => {
    if (isEffectiveReadOnly) return;
    if (buildings.length <= 1) {
      toast.error("At least one building is required in the schedule");
      return;
    }
    const nextList = buildings.filter((b) => !selectedRowIds.has(b.id));
    if (nextList.length === 0) {
      toast.error("Cannot delete all buildings");
      return;
    }
    saveSchedule(nextList);
    setSelectedBuildingId(nextList[0].id);
    setSelectedRowIds(new Set([nextList[0].id]));
    setReportBuildingId(nextList[0].id);
    toast.success("Deleted selected building(s)");
  };

  // Export Engineering Report as PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Official Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("UAE CIVIL DEFENSE FIRE WATER DEMAND & LIFE SAFETY CALCULATION", 14, 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(203, 213, 225);
      doc.text(`Project: ${project?.name || "MEP Development Complex"} | Project ID: ${project?.id || "PRJ-UAE-CD-2026"} | Date: ${formatDateStr(new Date())}`, 14, 20);
      doc.text(`Governing Standard: UAE Fire & Life Safety Code Chapter 9 (Tables 9.18 to 9.21.e) & NFPA 13 / 14 / 20 / 22`, pageWidth - 14, 20, { align: "right" });

      const reviewStatus = calcReviewState?.status || "DRAFT";
      doc.setFillColor(reviewStatus === "APPROVED" ? 16 : 217, reviewStatus === "APPROVED" ? 185 : 119, reviewStatus === "APPROVED" ? 129 : 6);
      doc.rect(pageWidth - 55, 6, 45, 8, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text(`STATUS: ${reviewStatus}`, pageWidth - 32.5, 11.5, { align: "center" });

      // Summary KPI Box
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 34, pageWidth - 28, 20, "F");
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, 34, pageWidth - 28, 20, "S");

      doc.setTextColor(15, 23, 42);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`Total Buildings: ${projectSummary.buildingCount}`, 20, 42);
      doc.text(`Governing Civil Defense Fire Pump: ${projectSummary.maxPumpFlowGpm} GPM (${projectSummary.maxPumpFlowLpm} LPM) @ ${projectSummary.maxPumpPressureBar} bar (${projectSummary.maxPumpPressurePsi} psi)`, 20, 49);

      doc.text(`Total Site Net Fire Water Storage: ${projectSummary.totalNetStorageM3} m³ (${projectSummary.totalNetStorageGal.toLocaleString()} US gal)`, pageWidth / 2, 42);
      doc.text(`Discharge Header Sizing: ${projectSummary.governingHeaderNps}" NPS (DN ${projectSummary.governingHeaderDn}) @ ${projectSummary.governingHeaderVelocity} ft/s (NFPA 20 compliant)`, pageWidth / 2, 49);

      const tableRows = evaluatedBuildings.map((item, idx) => {
        const b = item.building;
        const ev = item.evaluation;
        return [
          (idx + 1).toString(),
          b.name,
          `${b.height}m / G+${b.floors}`,
          OCCUPANCY_OPTIONS.find((o) => o.value === b.occupancy)?.label.split(" (")[0] || b.occupancy,
          `${b.groundFloorArea.toLocaleString()} m²`,
          `${b.plotArea.toLocaleString()} m²`,
          b.standpipeCount.toString(),
          ev.categoryCode.replace(/^Table\s+[\d\.]+[a-z]?[\–\-e]*\s*/i, "") || "Standard",
          `${ev.lowestFirePumpFlowGpm} GPM @ ${ev.lowestFirePumpPressureBar} bar`,
          `${ev.mainTankDurationMin} min`,
          `${ev.mainTankNetVolumeM3} m³ (${ev.mainTankNetVolumeGal.toLocaleString()} gal)`,
          ev.requiresStagingPumps ? `Yes (${ev.stagingPumpFlowGpm} GPM @ 6.9 bar)` : "Single Set",
        ];
      });

      autoTable(doc, {
        startY: 58,
        head: [[
          "#",
          "Building / Block Name",
          "Height",
          "Occupancy Class",
          "GFA (m²)",
          "Plot (m²)",
          "Standpipes",
          "Tier / Category",
          "Fire Pump Rating",
          "Duration",
          "Net Fire Water Volume",
          "Intermediate Pumps"
        ]],
        body: tableRows,
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        theme: "grid",
      });

      let finalY = (doc as any).lastAutoTable?.finalY || 140;

      if (finalY > pageHeight - 50) {
        doc.addPage();
        finalY = 20;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text("UAE CIVIL DEFENSE MANDATORY STATUTORY PROVISIONS:", 14, finalY + 8);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      const notes = [
        "1. Water Storage Tank Appurtenances: Provided with low water level detection, dedicated direct breeching inlet for refilling, and anti-vortex plate over pump suction (UAE Code Section 3.1).",
        "2. Fire Pump Sets: 1 Main Electric Duty Pump + 1 Standby Diesel / Electric Pump (100% capacity) + 1 Electric Pressure Maintenance Jockey Pump per UAE Code Section 3.1.",
        "3. Super Highrise (> 90m): Intermediate pump sets provided every 90m (750 GPM for <=2 standpipes, 1000 GPM for >2 standpipes @ 6.9 bar) with 30-min intermediate tanks and auto-refill.",
        "4. Plot Area > 20,000 m²: Yard fire hydrants required throughout site at 60m spacing unless municipal infrastructure hydrants are existing within 60m radius (Section 3.11).",
        "5. Standpipes & Risers: Interconnected at lowest and highest levels of each zone to guarantee 6.9 bar residual pressure at the most remote landing valve.",
      ];
      notes.forEach((note, i) => {
        doc.text(note, 14, finalY + 14 + i * 4);
      });

      const sigY = finalY + 40;
      if (sigY < pageHeight - 20) {
        doc.setDrawColor(203, 213, 225);
        doc.line(14, sigY + 10, 70, sigY + 10);
        doc.line(pageWidth / 2 - 28, sigY + 10, pageWidth / 2 + 28, sigY + 10);
        doc.line(pageWidth - 70, sigY + 10, pageWidth - 14, sigY + 10);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text("PREPARED BY (SENIOR MEP ENGINEER)", 14, sigY + 14);
        doc.text("CHECKED BY (LEAD FIRE CONSULTANT)", pageWidth / 2, sigY + 14, { align: "center" });
        doc.text("UAE CIVIL DEFENSE APPROVAL STAMP", pageWidth - 14, sigY + 14, { align: "right" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(currentUserName, 14, sigY + 18);
        doc.text("Licensed Fire & Life Safety Engineer", pageWidth / 2, sigY + 18, { align: "center" });
        doc.text("AHJ Certification Stamp Required", pageWidth - 14, sigY + 18, { align: "right" });
      }

      doc.save(`UAE_Civil_Defense_Fire_Water_Demand_${project?.id || "Report"}.pdf`);
      toast.success("Exported official Civil Defense Engineering PDF");
    } catch (e) {
      console.error("PDF generation failed", e);
      toast.error("Failed to generate PDF");
    }
  };

  // Filtered buildings for table
  const filteredBuildings = useMemo(() => {
    return evaluatedBuildings.filter((item) => {
      const b = item.building;
      const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOccupancy = filterOccupancy === "all" || b.occupancy === filterOccupancy;
      return matchesSearch && matchesOccupancy;
    });
  }, [evaluatedBuildings, searchQuery, filterOccupancy]);

  return (
    <AppShell
      title="Fire Water Demand"
      hideSubHeader={true}
      onIntelClick={() => setIntelOpen((v) => !v)}
      intelOpen={intelOpen}
      intelLabel="Intelligence"
    >
      <div className="flex h-full min-h-0 bg-transparent">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
          
          {/* ============================================================== */}
          {/* PAGE HEADER: EXACT SEWAGE PUMP SIZING FORMAT                   */}
          {/* ============================================================== */}
          <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-baseline gap-2">
                <h1 className="text-[28px] font-bold tracking-tight text-foreground">Fire Water Demand</h1>
                <span className="text-[14px] font-medium text-muted-foreground">{buildings.length} building block{buildings.length !== 1 ? "s" : ""}</span>
              </div>
              <button 
                onClick={() => setIntelOpen((v) => !v)}
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
                projectId={project?.id || "default"}
                calculatorPath="/plumbing-fire-water-demand"
                calculatorTitle="Fire Water Demand"
                onReviewStateChange={setCalcReviewState}
              />
            </div>
          </div>



          {/* ============================================================== */}
          {/* MAIN CARD CONTAINER & TABS SELECTOR (MATCHING SEWAGE PUMP)      */}
          {/* ============================================================== */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
            isApprovedLocked || calcReviewState?.status === "APPROVED"
              ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
              : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
          }`}>
            
            {/* Tabs Selector row - EXACT SEWAGE PUMP CONTROLS LAYOUT */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              
              {/* Left Side: Tabs + Formula + Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setTab("schedule")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "schedule"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Building Schedule
                  </button>
                  <button
                    onClick={() => setTab("tanks")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "tanks"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Pumps & Water Storage
                  </button>
                  <button
                    onClick={() => setTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                      tab === "report"
                        ? "bg-background text-foreground shadow-sm font-bold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Report
                  </button>
                </div>

                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                {/* Compact Civil Defense Preset Dropdown (Matching SewagePresetSelect style) */}
                <div className="relative group">
                  <button
                    type="button"
                    disabled={isEffectiveReadOnly}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-surface-2 hover:bg-surface text-xs font-semibold text-foreground transition-all cursor-pointer disabled:opacity-50 shadow-2xs select-none"
                  >
                    <Building2 className="size-3.5 text-primary" />
                    <span>Civil Defense Presets</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </button>
                  <div className="absolute left-0 top-full mt-1 w-80 bg-card border border-border rounded-xl shadow-xl p-2 hidden group-hover:block z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider">
                      Add Pre-Configured Building
                    </div>
                    <div className="max-h-80 overflow-y-auto space-y-1">
                      {CIVIL_DEFENSE_PRESETS.map((p) => (
                        <button
                          key={p.key}
                          onClick={() => handleAddPreset(p)}
                          className="w-full text-left p-2 rounded-lg hover:bg-surface-2 transition-all flex flex-col gap-0.5 group/item cursor-pointer"
                        >
                          <div className="text-xs font-semibold text-foreground group-hover/item:text-primary">
                            {p.label}
                          </div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {p.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side Controls: Export & Unit System Toggle (EXACT SEWAGE PUMP FORMAT) */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPDF}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                {/* Sizing Unit system toggle */}
                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  disabled={isEffectiveReadOnly}
                  inputDescriptions="Fire Water Demand (GPM / LPM), Residual Pressure (psi / bar), Water Tank Capacity (gal / m³)"
                  conversionExample={
                    unitSystem === "ip"
                      ? "Convert 1000 GPM → 3785 LPM, 100 psi → 6.9 bar, 60,000 Gal → 227.1 m³"
                      : "Convert 3785 LPM → 1000 GPM, 6.9 bar → 100 psi, 227.1 m³ → 60,000 Gal"
                  }
                />
              </div>
            </div>

            {/* TAB 1: SCHEDULE (FULL-HEIGHT SPACIOUS DATAGRID WITH DOUBLE-CLICK EDITING) */}
            {tab === "schedule" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                
                {/* Search & Action Bar (Matching Ventilation / Sewage Grid Toolbar) */}
                <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-card border-b border-border/60 shrink-0 flex-wrap">
                  <div className="flex items-center gap-2 flex-1 max-w-md">
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search building name or occupancy..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground font-medium">Occupancy:</span>
                    <select
                      value={filterOccupancy}
                      onChange={(e) => setFilterOccupancy(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    >
                      <option value="all">All Occupancies ({buildings.length})</option>
                      {OCCUPANCY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label.split(" (")[0]}
                        </option>
                      ))}
                    </select>

                    <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                    <button
                      disabled={isEffectiveReadOnly}
                      onClick={handleAddNewBuilding}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Plus className="size-3.5" />
                      Add Building
                    </button>
                    <button
                      disabled={isEffectiveReadOnly || selectedRowIds.size === 0}
                      onClick={handleDuplicateSelected}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 border border-border text-xs font-medium text-foreground transition-all cursor-pointer disabled:opacity-50"
                      title="Duplicate Selected"
                    >
                      <Copy className="size-3.5" />
                      Duplicate
                    </button>
                    <button
                      disabled={isEffectiveReadOnly || selectedRowIds.size === 0}
                      onClick={handleDeleteSelected}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-600 border border-red-500/20 text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
                      title="Delete Selected"
                    >
                      <Trash2 className="size-3.5" />
                      Delete ({selectedRowIds.size})
                    </button>
                  </div>
                </div>

                {/* Building Schedule DataGrid Table - Takes Full Container Height */}
                <div className="flex-1 overflow-x-auto overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                      <thead className="bg-surface-2 text-muted-foreground font-semibold uppercase text-[11px] sticky top-0 z-10 border-b border-border shadow-xs">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRowIds.size === buildings.length && buildings.length > 0}
                              onChange={toggleSelectAll}
                              className="rounded border-border cursor-pointer"
                            />
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>BUILDING / BLOCK</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>OCCUPANCY</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>HEIGHT / FLOORS</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">(M)</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>GFA</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">(M²)</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>PLOT AREA</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">(M²)</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>STANDPIPES</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>FIRE PUMP DUTY</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">
                              {unitSystem === "si" ? "(LPM @ BAR)" : "(GPM @ PSI)"}
                            </div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>TANK DURATION</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">(MIN)</div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>NET WATER VOLUME</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">
                              {unitSystem === "si" ? "(M³)" : "(GAL)"}
                            </div>
                          </th>
                          <th className="py-2.5 px-3 text-center">
                            <div>STAGING PUMPS</div>
                            <div className="text-[10px] text-muted-foreground/75 font-normal">(&gt;90M)</div>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredBuildings.map((item) => {
                          const b = item.building;
                          const ev = item.evaluation;
                          const isSelected = b.id === selectedBuildingId;
                          const isChecked = selectedRowIds.has(b.id);
                          const hasOverrides = b.overridePumpFlowGpm !== undefined ||
                            b.overridePumpPressureBar !== undefined ||
                            b.overrideTankDurationMin !== undefined ||
                            b.overrideNetStorageM3 !== undefined;

                          return (
                            <tr
                              key={b.id}
                              onClick={() => {
                                setSelectedBuildingId(b.id);
                                setReportBuildingId(b.id);
                                if (!selectedRowIds.has(b.id)) {
                                  setSelectedRowIds(new Set([b.id]));
                                }
                              }}
                              onDoubleClick={() => handleOpenEditModal(b.id)}
                              className={`transition-colors group ${
                                isSelected
                                  ? "bg-primary/10 hover:bg-primary/15 font-medium"
                                  : "hover:bg-surface-2"
                              }`}
                              title="Double-click row to open full architectural parameters modal"
                            >
                              {/* 1. Selection Checkbox */}
                              <td className="py-2 px-3 text-center" onClick={(e) => toggleSelectRow(b.id, e)}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded border-border cursor-pointer"
                                />
                              </td>

                              {/* 2. Building / Block Name (Editable Input) */}
                              <td className="py-1.5 px-2.5 font-semibold text-foreground" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center gap-1.5 min-w-[210px]">
                                  <input
                                    type="text"
                                    value={b.name}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => handleUpdateBuilding(b.id, { name: e.target.value })}
                                    className="w-full px-2 py-1 text-xs font-semibold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded transition-all"
                                    placeholder="Building Name"
                                  />
                                  {ev.requiresStagingPumps && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-semibold shrink-0" title="Super Highrise (>90m): Mandates intermediate multi-level staging pumps and transfer tanks">
                                      &gt;90m
                                    </span>
                                  )}
                                  {ev.isYardHydrantRequired && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-mono font-semibold shrink-0" title="Plot Area > 20,000 m²: Mandates site yard hydrants spaced at 60m (UAE Code Section 3.11)">
                                      Yard
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 3. Occupancy Dropdown (Editable Select) */}
                              <td className="py-1.5 px-2 text-muted-foreground text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[195px] mx-auto">
                                  <select
                                    value={b.occupancy}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => handleUpdateBuilding(b.id, { occupancy: e.target.value as CivilDefenseOccupancy }, true)}
                                    className="w-full px-2 py-1 text-xs text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-border/40 hover:border-border/80 focus:border-primary focus:ring-1 focus:ring-primary rounded cursor-pointer transition-all"
                                    title={`Occupancy category: ${OCCUPANCY_OPTIONS.find((o) => o.value === b.occupancy)?.desc || b.occupancy}`}
                                  >
                                    {OCCUPANCY_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>
                                        {o.label.split(" (")[0]}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </td>

                              {/* 4. Height & Floors (Editable Inputs) */}
                              <td className="py-1.5 px-2 text-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 min-w-[130px] mx-auto" title="Height (meters) and above-ground stories. Governs Super Highrise (>90m), Highrise (23-90m), Midrise (15-23m), Lowrise (≤15m)">
                                  <div className="relative flex items-center">
                                    <input
                                      type="number"
                                      min="1"
                                      step="0.5"
                                      value={b.height || ""}
                                      disabled={isEffectiveReadOnly}
                                      onChange={(e) => {
                                        const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                        if (!isNaN(v)) handleUpdateBuilding(b.id, { height: v }, true);
                                      }}
                                      className="w-14 px-1.5 py-1 text-xs font-semibold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-right pr-4"
                                    />
                                    <span className="absolute right-1 text-[11px] text-muted-foreground pointer-events-none">m</span>
                                  </div>
                                  <span className="text-muted-foreground text-xs">(G+</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="1"
                                    value={b.floors ?? ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 0 : parseInt(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { floors: v }, true);
                                    }}
                                    className="w-10 px-1 py-1 text-xs font-semibold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                  />
                                  <span className="text-muted-foreground text-xs">)</span>
                                </div>
                              </td>

                              {/* 5. GFA (m²) (Editable Input) */}
                              <td className="py-1.5 px-2 text-muted-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[85px] max-w-[110px] mx-auto" title="Ground Floor Area (m²). Governs code system thresholds (≤500m², 501-3600m², >3600m²)">
                                  <input
                                    type="number"
                                    min="0"
                                    step="10"
                                    value={b.groundFloorArea || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { groundFloorArea: v }, true);
                                    }}
                                    className="w-full px-2 py-1 text-xs text-foreground font-mono bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                  />
                                </div>
                              </td>

                              {/* 6. Plot Area (m²) (Editable Input) */}
                              <td className="py-1.5 px-2 text-muted-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="min-w-[90px] max-w-[115px] mx-auto" title="Plot Area (m²). If >20,000 m², triggers Section 3.11 mandatory Yard Hydrants">
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={b.plotArea || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { plotArea: v }, true);
                                    }}
                                    className="w-full px-2 py-1 text-xs text-foreground font-mono bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded text-center"
                                  />
                                </div>
                              </td>

                              {/* 7. Standpipes (Editable Input) */}
                              <td className="py-1.5 px-2 text-center text-foreground font-mono" onClick={(e) => e.stopPropagation()}>
                                <div className="w-14 mx-auto" title="Number of Standpipes/Stairs. In Highrise, ≤2 standpipes = 750 GPM (2839 LPM); >2 standpipes = 1000 GPM (3785 LPM)">
                                  <input
                                    type="number"
                                    min="1"
                                    max="30"
                                    step="1"
                                    value={b.standpipeCount || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const v = e.target.value === "" ? 1 : parseInt(e.target.value);
                                      if (!isNaN(v)) handleUpdateBuilding(b.id, { standpipeCount: v }, true);
                                    }}
                                    className="w-full px-1 py-1 text-xs font-semibold text-center text-foreground font-mono bg-surface-2/40 hover:bg-surface-2 focus:bg-background border border-transparent hover:border-border/60 focus:border-primary focus:ring-1 focus:ring-primary rounded"
                                  />
                                </div>
                              </td>

                              {/* 8. Fire Pump Duty (OUTPUT - Editable with Overrides) */}
                              <td className="py-1.5 px-2 font-semibold text-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5 min-w-[145px] mx-auto">
                                  {unitSystem === "si" ? (
                                    <>
                                      <input
                                        type="number"
                                        min="0"
                                        step="50"
                                        value={ev.lowestFirePumpFlowLpm || ""}
                                        disabled={isEffectiveReadOnly}
                                        onChange={(e) => {
                                          const lpm = parseFloat(e.target.value);
                                          if (!isNaN(lpm)) {
                                            handleUpdateBuilding(b.id, { overridePumpFlowGpm: Math.round(lpm / 3.78541) });
                                          }
                                        }}
                                        className={`w-16 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                          b.overridePumpFlowGpm !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                        } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                        title={b.overridePumpFlowGpm !== undefined ? "Manual override active. Click reset to restore statutory formula." : `Governing Rule: ${ev.lowestPumpRemarks}`}
                                      />
                                      <span className="text-muted-foreground/70 font-semibold text-xs">@</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={ev.lowestFirePumpPressureBar || ""}
                                        disabled={isEffectiveReadOnly}
                                        onChange={(e) => {
                                          const bar = parseFloat(e.target.value);
                                          if (!isNaN(bar)) {
                                            handleUpdateBuilding(b.id, { overridePumpPressureBar: bar });
                                          }
                                        }}
                                        className={`w-13 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                          b.overridePumpPressureBar !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                        } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                        title={b.overridePumpPressureBar !== undefined ? "Manual override active. Click reset to restore statutory formula." : `Residual Pressure: ${ev.lowestFirePumpPressureBar} bar at remote outlet`}
                                      />
                                      {(b.overridePumpFlowGpm !== undefined || b.overridePumpPressureBar !== undefined) && (
                                        <button
                                          onClick={() => handleUpdateBuilding(b.id, { overridePumpFlowGpm: undefined, overridePumpPressureBar: undefined })}
                                          className="text-amber-500 hover:text-amber-600 p-0.5"
                                          title="Reset to code statutory duty"
                                        >
                                          <RotateCcw className="size-3" />
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <input
                                        type="number"
                                        min="0"
                                        step="25"
                                        value={ev.lowestFirePumpFlowGpm || ""}
                                        disabled={isEffectiveReadOnly}
                                        onChange={(e) => {
                                          const gpm = parseFloat(e.target.value);
                                          if (!isNaN(gpm)) {
                                            handleUpdateBuilding(b.id, { overridePumpFlowGpm: gpm });
                                          }
                                        }}
                                        className={`w-16 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                          b.overridePumpFlowGpm !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                        } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                        title={b.overridePumpFlowGpm !== undefined ? "Manual override active." : `Governing Rule: ${ev.lowestPumpRemarks}`}
                                      />
                                      <span className="text-muted-foreground/70 font-semibold text-xs">@</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="5"
                                        value={ev.lowestFirePumpPressurePsi || ""}
                                        disabled={isEffectiveReadOnly}
                                        onChange={(e) => {
                                          const psi = parseFloat(e.target.value);
                                          if (!isNaN(psi)) {
                                            handleUpdateBuilding(b.id, { overridePumpPressureBar: parseFloat((psi / 14.5038).toFixed(1)) });
                                          }
                                        }}
                                        className={`w-14 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                          b.overridePumpPressureBar !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                        } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                        title={b.overridePumpPressureBar !== undefined ? "Manual override active." : `Residual Pressure: ${ev.lowestFirePumpPressurePsi} psi`}
                                      />
                                      {(b.overridePumpFlowGpm !== undefined || b.overridePumpPressureBar !== undefined) && (
                                        <button
                                          onClick={() => handleUpdateBuilding(b.id, { overridePumpFlowGpm: undefined, overridePumpPressureBar: undefined })}
                                          className="text-amber-500 hover:text-amber-600 p-0.5"
                                          title="Reset to code statutory duty"
                                        >
                                          <RotateCcw className="size-3" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* 9. Tank Duration (OUTPUT - Editable with Overrides) */}
                              <td className="py-1.5 px-2 text-muted-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 min-w-[75px] mx-auto">
                                  <input
                                    type="number"
                                    min="10"
                                    max="240"
                                    step="5"
                                    value={ev.mainTankDurationMin || ""}
                                    disabled={isEffectiveReadOnly}
                                    onChange={(e) => {
                                      const min = parseInt(e.target.value);
                                      if (!isNaN(min)) {
                                        handleUpdateBuilding(b.id, { overrideTankDurationMin: min });
                                      }
                                    }}
                                    className={`w-14 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                      b.overrideTankDurationMin !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                    } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                    title={b.overrideTankDurationMin !== undefined ? "Manual override active. Click to reset." : `Statutory duration: ${ev.mainTankDurationMin} min per UAE Code`}
                                  />
                                  {b.overrideTankDurationMin !== undefined && (
                                    <button
                                      onClick={() => handleUpdateBuilding(b.id, { overrideTankDurationMin: undefined })}
                                      className="text-amber-500 hover:text-amber-600 p-0.5"
                                      title="Reset to code duration"
                                    >
                                      <RotateCcw className="size-3" />
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* 10. Net Water Volume (OUTPUT - Editable with Overrides) */}
                              <td className="py-1.5 px-2 font-semibold text-foreground font-mono text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1 min-w-[90px] mx-auto">
                                  {unitSystem === "si" ? (
                                    <>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={ev.mainTankNetVolumeM3 || ""}
                                        disabled={isEffectiveReadOnly}
                                        onChange={(e) => {
                                          const m3 = parseFloat(e.target.value);
                                          if (!isNaN(m3)) {
                                            handleUpdateBuilding(b.id, { overrideNetStorageM3: m3 });
                                          }
                                        }}
                                        className={`w-18 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                          b.overrideNetStorageM3 !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                        } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                        title={b.overrideNetStorageM3 !== undefined ? "Manual override active. Click reset to restore statutory formula." : `Calculated Net Volume: ${ev.lowestFirePumpFlowGpm} GPM × ${ev.mainTankDurationMin} min = ${ev.mainTankNetVolumeM3} m³`}
                                      />
                                      {b.overrideNetStorageM3 !== undefined && (
                                        <button
                                          onClick={() => handleUpdateBuilding(b.id, { overrideNetStorageM3: undefined })}
                                          className="text-amber-500 hover:text-amber-600 p-0.5"
                                          title="Reset to code volume"
                                        >
                                          <RotateCcw className="size-3" />
                                        </button>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <input
                                        type="number"
                                        min="0"
                                        step="100"
                                        value={ev.mainTankNetVolumeGal || ""}
                                        disabled={isEffectiveReadOnly}
                                        onChange={(e) => {
                                          const gal = parseFloat(e.target.value);
                                          if (!isNaN(gal)) {
                                            handleUpdateBuilding(b.id, { overrideNetStorageM3: parseFloat((gal * 0.00378541).toFixed(1)) });
                                          }
                                        }}
                                        className={`w-20 px-1.5 py-1 text-xs font-bold text-foreground bg-surface-2/40 hover:bg-surface-2 focus:bg-background border ${
                                          b.overrideNetStorageM3 !== undefined ? "border-amber-500/70 ring-1 ring-amber-500/40 text-amber-600 dark:text-amber-400" : "border-transparent hover:border-border/60"
                                        } focus:border-primary focus:ring-1 focus:ring-primary rounded text-center`}
                                        title={b.overrideNetStorageM3 !== undefined ? "Manual override active. Click reset to restore statutory formula." : `Calculated Net Volume: ${ev.lowestFirePumpFlowGpm} GPM × ${ev.mainTankDurationMin} min = ${ev.mainTankNetVolumeGal.toLocaleString()} US gal`}
                                      />
                                      {b.overrideNetStorageM3 !== undefined && (
                                        <button
                                          onClick={() => handleUpdateBuilding(b.id, { overrideNetStorageM3: undefined })}
                                          className="text-amber-500 hover:text-amber-600 p-0.5"
                                          title="Reset to code volume"
                                        >
                                          <RotateCcw className="size-3" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>

                              {/* 11. Staging Pumps (Auto-derived from >90m) */}
                              <td className="py-2.5 px-3 text-muted-foreground text-center">
                                {ev.requiresStagingPumps ? (
                                  <span className="text-purple-600 dark:text-purple-400 font-semibold font-mono text-[11px] whitespace-nowrap">
                                    {ev.stagingPumpFlowGpm} GPM @ 6.9 bar (+90m)
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground text-[11px] whitespace-nowrap">N/A (Single Set)</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Bottom Status / Hint Bar */}
                  <div className="px-4 py-2 bg-surface-2/60 border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="size-3.5 text-primary" />
                      <span>
                        Inputs &amp; outputs are directly editable. Altering any input dynamically recalculates outputs according to UAE Civil Defense statutory formulas. Output overrides are highlighted with ↺ reset.
                      </span>
                    </div>
                    {activeItem && (
                      <div className="flex items-center gap-2">
                        <span>Selected: <strong className="text-foreground">{activeItem.building.name}</strong></span>
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-surface-3 text-foreground/80">
                          {OCCUPANCY_OPTIONS.find((o) => o.value === activeItem.building.occupancy)?.label.split(" (")[0] || activeItem.building.occupancy} • {activeItem.building.height}m
                        </span>
                      </div>
                    )}
                  </div>
              </div>
            )}



            {/* TAB 3: WATER TANK & PUMP ROOM SIZING */}
            {tab === "tanks" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
                {activeTankSizing && activeItem && (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    
                    {/* Left: Interactive Dimensions Input */}
                    <div className="lg:col-span-5 p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col gap-3">
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <div className="flex items-center gap-2">
                          <Waves className="size-4 text-blue-500" />
                          <h3 className="text-sm font-bold text-foreground">
                            Tank Dimensions & Civil Structure
                          </h3>
                        </div>
                        <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
                          {activeItem.evaluation.mainTankNetVolumeM3} m³ Net
                        </span>
                      </div>

                      <div className="space-y-3 text-xs">
                        {/* Target Net Volume Callout */}
                        <div className="p-2.5 rounded-lg bg-surface-2 border border-border/60 flex items-center justify-between">
                          <div>
                            <span className="text-muted-foreground text-[11px]">Required Net Fire Reserve:</span>
                            <div className="text-base font-bold text-foreground font-mono">
                              {unitSystem === "si"
                                ? `${activeItem.evaluation.mainTankNetVolumeM3} m³`
                                : `${activeItem.evaluation.mainTankNetVolumeGal.toLocaleString()} US gal`}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-muted-foreground text-[11px]">Duration:</span>
                            <div className="text-sm font-bold text-foreground font-mono">
                              {activeItem.evaluation.mainTankDurationMin} minutes
                            </div>
                          </div>
                        </div>

                        {/* Length & Width */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Tank Internal Length (m):
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              disabled={isEffectiveReadOnly}
                              value={tankLength}
                              onChange={(e) => setTankLength(parseFloat(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                          </div>
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Tank Internal Width (m):
                            </label>
                            <input
                              type="number"
                              min="1"
                              step="0.5"
                              disabled={isEffectiveReadOnly}
                              value={tankWidth}
                              onChange={(e) => setTankWidth(parseFloat(e.target.value) || 1)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                          </div>
                        </div>

                        {/* Freeboard & Dead Suction Sump */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Freeboard Air Gap (m):
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.05"
                              disabled={isEffectiveReadOnly}
                              value={tankFreeboard}
                              onChange={(e) => setTankFreeboard(parseFloat(e.target.value) || 0.3)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                            <span className="text-[10px] text-muted-foreground">Min 0.30m above overflow</span>
                          </div>
                          <div>
                            <label className="block text-muted-foreground font-medium mb-1">
                              Dead Suction Sump (m):
                            </label>
                            <input
                              type="number"
                              min="0.1"
                              step="0.05"
                              disabled={isEffectiveReadOnly}
                              value={tankDeadVolumeDepth}
                              onChange={(e) => setTankDeadVolumeDepth(parseFloat(e.target.value) || 0.2)}
                              className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                            />
                            <span className="text-[10px] text-muted-foreground">Anti-vortex plate zone</span>
                          </div>
                        </div>

                        {/* City Mains Refilling Flow */}
                        <div>
                          <label className="block text-muted-foreground font-medium mb-1">
                            City Water Replenishment Flow (GPM):
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            disabled={isEffectiveReadOnly}
                            value={cityMainRefillFlowGpm}
                            onChange={(e) => setCityMainRefillFlowGpm(parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-1.5 bg-surface-2 border border-border rounded-lg text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
                          />
                          <span className="text-[10px] text-muted-foreground">
                            Estimated time to refill from empty: {activeTankSizing.fillTimeHours} hours
                          </span>
                        </div>

                        {/* Calculated Dimensions Summary */}
                        <div className="pt-2 border-t border-border/60 grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Effective Water Depth:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.effectiveDepth} m</div>
                          </div>
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Total Tank Height:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.totalHeight} m</div>
                          </div>
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Footprint Area:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.floorArea} m²</div>
                          </div>
                          <div className="p-2 rounded bg-surface-2">
                            <span className="text-muted-foreground text-[10px] uppercase">Gross Tank Volume:</span>
                            <div className="font-bold font-mono text-foreground">{activeTankSizing.grossVolumeM3} m³</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: SVG Graphic Cross-Section & Appurtenances */}
                    <div className="lg:col-span-7 flex flex-col gap-3">
                      
                      {/* Interactive Visual Tank Elevation */}
                      <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col items-center">
                        <div className="w-full flex items-center justify-between text-xs font-bold text-foreground mb-3">
                          <span className="flex items-center gap-1.5">
                            <Droplets className="size-4 text-blue-500" />
                            Civil Defense Dedicated Tank Elevation Diagram (Section 3.1)
                          </span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {tankLength}m × {tankWidth}m × {activeTankSizing.totalHeight}m (H)
                          </span>
                        </div>

                        {/* Tank Elevation Graphic */}
                        <div className="w-full max-w-md h-64 border-2 border-border/80 rounded-xl relative overflow-hidden bg-slate-900/90 p-4 flex flex-col justify-between shadow-inner">
                          {/* Freeboard Zone */}
                          <div className="w-full h-10 border-b border-dashed border-amber-400/60 flex items-center justify-between px-3 text-[11px] text-amber-300 font-mono">
                            <span>Freeboard (+{tankFreeboard}m Air Gap)</span>
                            <span>Overflow Line</span>
                          </div>

                          {/* Effective Water Body */}
                          <div className="relative flex-1 w-full bg-gradient-to-b from-blue-500/30 to-blue-600/50 flex flex-col justify-center items-center text-center p-2">
                            <div className="text-xs font-bold text-blue-200">
                              EFFECTIVE FIRE WATER STORAGE
                            </div>
                            <div className="text-lg font-black text-white font-mono">
                              {unitSystem === "si"
                                ? `${activeItem.evaluation.mainTankNetVolumeM3} m³`
                                : `${activeItem.evaluation.mainTankNetVolumeGal.toLocaleString()} US Gallons`}
                            </div>
                            <div className="text-[10px] text-blue-200/80 font-mono">
                              Depth: {activeTankSizing.effectiveDepth}m ({activeItem.evaluation.mainTankDurationMin} min duration)
                            </div>
                          </div>

                          {/* Anti-Vortex / Sump Zone */}
                          <div className="w-full h-8 border-t border-dashed border-slate-500/60 flex items-center justify-between px-3 text-[10px] text-slate-400 font-mono bg-slate-950/60">
                            <span>Anti-Vortex Plate Level (+{tankDeadVolumeDepth}m)</span>
                            <span>Suction Header</span>
                          </div>
                        </div>
                      </div>

                      {/* Appurtenances & Mandatory Inlets */}
                      <div className="p-4 rounded-xl bg-surface-2 border border-border shadow-xs text-xs space-y-2">
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <ShieldCheck className="size-4 text-emerald-500" />
                          <span>Mandatory Civil Defense Appurtenances (Section 3.1)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-muted-foreground">
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Dedicated Direct Breeching Inlet:</strong> Installed externally on building facade for fire brigade direct refilling.
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Low Water Level Detection:</strong> Connected to fire alarm panel with audio-visual supervisory fault signaling.
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Anti-Vortex Plate:</strong> Fitted over every suction outlet to prevent air entrainment into fire pump impellers.
                          </div>
                          <div className="p-2 rounded bg-card border border-border/50">
                            <strong>• Dual Chamber Tank:</strong> 2 interconnected compartments to allow maintenance without shutting down protection.
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: OFFICIAL ENGINEERING REPORT */}
            {tab === "report" && reportItem && (
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 gap-4">
                
                {/* KPI Banner: Site Overall Fire Water Metrics (Positioned under Report section) */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                  {/* 1. Governing Pump Flow */}
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Governing Fire Pump</span>
                      <Gauge className="size-4 text-red-500" />
                    </div>
                    <div className="mt-1">
                      <div className="text-xl font-bold text-foreground tracking-tight">
                        {unitSystem === "si" ? `${projectSummary.maxPumpFlowLpm} LPM` : `${projectSummary.maxPumpFlowGpm} GPM`}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <span>@ {unitSystem === "si" ? `${projectSummary.maxPumpPressureBar} bar` : `${projectSummary.maxPumpPressurePsi} psi`}</span>
                        <span className="text-emerald-500 font-semibold">• Duty + Standby</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Total Net Fire Water Storage */}
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Total Net Fire Water</span>
                      <Droplets className="size-4 text-blue-500" />
                    </div>
                    <div className="mt-1">
                      <div className="text-xl font-bold text-foreground tracking-tight">
                        {unitSystem === "si" ? `${projectSummary.totalNetStorageM3} m³` : `${projectSummary.totalNetStorageGal.toLocaleString()} gal`}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-medium">
                        Gross: {unitSystem === "si" ? `${projectSummary.totalGrossStorageM3} m³` : `${projectSummary.totalGrossStorageGal.toLocaleString()} gal`} (+10% ullage)
                      </div>
                    </div>
                  </div>

                  {/* 3. Super Highrise Towers */}
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Super Highrise (&gt;90m)</span>
                      <Layers className="size-4 text-purple-500" />
                    </div>
                    <div className="mt-1">
                      <div className="text-xl font-bold text-foreground tracking-tight flex items-baseline gap-1.5">
                        <span>{projectSummary.superHighriseCount}</span>
                        <span className="text-xs font-normal text-muted-foreground">tower{projectSummary.superHighriseCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                        {projectSummary.superHighriseCount > 0 ? "Intermediate pumps every 90m" : "Single basement pump set"}
                      </div>
                    </div>
                  </div>

                  {/* 4. Yard Hydrants Requirement */}
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Plot &gt;20k m² Hydrants</span>
                      <ShieldAlert className="size-4 text-amber-500" />
                    </div>
                    <div className="mt-1">
                      <div className="text-xl font-bold text-foreground tracking-tight flex items-baseline gap-1.5">
                        <span>{projectSummary.yardHydrantRequiredCount}</span>
                        <span className="text-xs font-normal text-muted-foreground">zone{projectSummary.yardHydrantRequiredCount !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                        {projectSummary.yardHydrantRequiredCount > 0 ? "Requires 1000 GPM ring main" : "Exempt / Infra within 60m"}
                      </div>
                    </div>
                  </div>

                  {/* 5. Recommended NFPA 20 Header */}
                  <div className="p-3 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                    <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
                      <span>Discharge Header</span>
                      <Activity className="size-4 text-emerald-500" />
                    </div>
                    <div className="mt-1">
                      <div className="text-xl font-bold text-foreground tracking-tight">
                        {projectSummary.governingHeaderNps}" NPS
                      </div>
                      <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-between">
                        <span>DN {projectSummary.governingHeaderDn}</span>
                        <span className="text-emerald-500 font-semibold">{projectSummary.governingHeaderVelocity} ft/s (≤15)</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Building Block Selector Tabs for Report Deep-Dive */}
                <div className="flex items-center justify-between bg-surface-2 p-2 rounded-xl border border-border shrink-0">
                  <div className="flex items-center gap-2 overflow-x-auto py-0.5">
                    <span className="text-xs font-semibold text-muted-foreground shrink-0 pl-1">
                      Inspect Building Report:
                    </span>
                    {evaluatedBuildings.map((item) => {
                      const isActive = item.building.id === reportBuildingId;
                      return (
                        <button
                          key={item.building.id}
                          onClick={() => setReportBuildingId(item.building.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                            isActive
                              ? "bg-background text-primary shadow-xs font-bold border border-primary/20"
                              : "text-muted-foreground hover:text-foreground hover:bg-surface-3"
                          }`}
                        >
                          {item.building.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <TBtn onClick={handleExportPDF}>
                      <FileText className="size-3.5" /> PDF Report
                    </TBtn>
                    <TBtn onClick={() => window.print()}>
                      <Printer className="size-3.5" /> Print
                    </TBtn>
                  </div>
                </div>

                {/* SECTION 3: GOVERNING CODE BANNER & PRIMARY CAPACITIES */}
                <div className="flex flex-col gap-3">
                  
                  {/* Classification Banner */}
                  <div className="p-4 rounded-xl bg-surface-2 border border-border shadow-xs flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shield className="size-4 text-emerald-500" />
                        <span className="text-sm font-bold text-foreground">
                          {reportItem.evaluation.tableTitle.replace(/^Table\s+[\d\.]+[a-z]?[\–\-e]*:\s*/i, "")}
                        </span>
                      </div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        {reportItem.evaluation.categoryCode.replace(/^Table\s+[\d\.]+[a-z]?[\–\-e]*\s*/i, "") || "Standard"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {reportItem.evaluation.lowestPumpRemarks}
                    </div>
                  </div>

                  {/* Side-by-Side Cards: Lowest Fire Pump Set & Dedicated Water Tank */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    
                    {/* Lowest Fire Pump Set Card */}
                    <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                          <span>Lowest Fire Pump Set</span>
                          <Gauge className="size-4 text-red-500" />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-foreground tracking-tight">
                          {unitSystem === "si"
                            ? `${reportItem.evaluation.lowestFirePumpFlowLpm} LPM`
                            : `${reportItem.evaluation.lowestFirePumpFlowGpm} GPM`}
                        </div>
                        <div className="text-xs font-semibold text-red-600 dark:text-red-400 mt-0.5">
                          @ {unitSystem === "si"
                            ? `${reportItem.evaluation.lowestFirePumpPressureBar} bar`
                            : `${reportItem.evaluation.lowestFirePumpPressurePsi} psi`}{" "}
                          residual
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
                        1 Duty Electric + 1 Standby Diesel + 1 Jockey Pump
                      </div>
                    </div>

                    {/* Dedicated Water Tank Card */}
                    <div className="p-4 rounded-xl bg-card border border-border shadow-xs flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                          <span>Dedicated Water Tank</span>
                          <Droplets className="size-4 text-blue-500" />
                        </div>
                        <div className="mt-2 text-2xl font-bold text-foreground tracking-tight">
                          {unitSystem === "si"
                            ? `${reportItem.evaluation.mainTankNetVolumeM3} m³`
                            : `${reportItem.evaluation.mainTankNetVolumeGal.toLocaleString()} gal`}
                        </div>
                        <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
                          {reportItem.evaluation.mainTankDurationMin} min design duration basis
                        </div>
                      </div>
                      <div className="mt-3 pt-2.5 border-t border-border/60 text-[11px] text-muted-foreground">
                        Gross: {unitSystem === "si" ? `${reportItem.evaluation.mainTankGrossVolumeM3} m³` : `${reportItem.evaluation.mainTankGrossVolumeGal.toLocaleString()} gal`} (+10% ullage & sump)
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: MANDATORY UAE CIVIL DEFENSE FIRE PROTECTION SYSTEMS */}
                  <div className="p-4 rounded-xl bg-card border border-border shadow-xs">
                    <div className="text-xs font-bold text-foreground mb-3 flex items-center justify-between">
                      <span>Mandatory UAE Civil Defense Fire Protection Systems</span>
                      <CheckCircle2 className="size-4 text-emerald-500" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-2 border border-border/60">
                        <Check className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground">Sprinkler System:</span>
                          <div className="text-muted-foreground text-[11px] mt-0.5">{reportItem.evaluation.sprinklerRequirement}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-2 border border-border/60">
                        <Check className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground">Risers & Landing Valves:</span>
                          <div className="text-muted-foreground text-[11px] mt-0.5">{reportItem.evaluation.riserRequirement}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-2 border border-border/60">
                        <Check className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground">Hose Reels:</span>
                          <div className="text-muted-foreground text-[11px] mt-0.5">{reportItem.evaluation.hoseReelRequirement}</div>
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-surface-2 border border-border/60">
                        <Check className="size-4 text-emerald-500 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-foreground">Yard Hydrants:</span>
                          <div className="text-muted-foreground text-[11px] mt-0.5">{reportItem.evaluation.yardHydrantRequirement}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Super Highrise Intermediate Staging Requirement (Purple Box) */}
                  {reportItem.evaluation.requiresStagingPumps && (
                    <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 shadow-xs flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                        <Layers className="size-4" />
                        <span>Super Highrise Intermediate Staging Pump & Upper Tanks Requirement</span>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1.5">
                        <div>• <strong>Upper Staging Pumps:</strong> Additional intermediate fire pump set of <strong>{reportItem.evaluation.stagingPumpFlowGpm} GPM @ 6.9 bar</strong> every 90 m of building height.</div>
                        <div>• <strong>Intermediate Upper Tanks:</strong> Dedicated <strong>30-minute water storage ({reportItem.evaluation.stagingTankNetVolumeM3} m³)</strong> provided on intermediate mechanical floors with automatic utility refill.</div>
                        <div>• <strong>Bypass & Interconnection:</strong> Intermediate pumps shall have direct suction from staging tanks with emergency direct bypass risers from lowest basement pumps.</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Formal Calculation Document Block */}
                <div className="p-5 rounded-xl bg-card border border-border shadow-xs space-y-4 mt-2">
                  <div className="flex justify-between items-start border-b border-border/80 pb-4">
                    <div>
                      <div className="text-[11px] font-bold text-primary uppercase tracking-wider">
                        Official Engineering Calculation Document
                      </div>
                      <h2 className="text-xl font-bold text-foreground">
                        UAE Civil Defense Fire Water Demand & Life Safety Compliance Report
                      </h2>
                      <div className="text-xs text-muted-foreground mt-1">
                        Governing Standard: UAE Fire & Life Safety Code of Practice Chapter 9 (Tables 9.18 to 9.21.e)
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        calcReviewState?.status === "APPROVED"
                          ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                          : "bg-amber-500/10 text-amber-600 border border-amber-500/30"
                      }`}>
                        {calcReviewState?.status || "DRAFT DESIGN"}
                      </span>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Date: {formatDateStr(new Date())}
                      </div>
                    </div>
                  </div>

                  {/* Project Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-surface-2">
                      <span className="text-muted-foreground text-[10px] uppercase">Project Name:</span>
                      <div className="font-bold text-foreground">{project?.name || "MEP Development Complex"}</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-2">
                      <span className="text-muted-foreground text-[10px] uppercase">Governing Pump Flow:</span>
                      <div className="font-bold text-foreground font-mono">{projectSummary.maxPumpFlowGpm} GPM ({projectSummary.maxPumpFlowLpm} LPM)</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-2">
                      <span className="text-muted-foreground text-[10px] uppercase">Total Site Net Storage:</span>
                      <div className="font-bold text-foreground font-mono">{projectSummary.totalNetStorageM3} m³ ({projectSummary.totalNetStorageGal.toLocaleString()} gal)</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-surface-2">
                      <span className="text-muted-foreground text-[10px] uppercase">Prepared By:</span>
                      <div className="font-bold text-foreground">{currentUserName}</div>
                    </div>
                  </div>

                  {/* Summary Schedule Table */}
                  <div>
                    <h3 className="text-xs font-bold text-foreground mb-2 uppercase tracking-wider">
                      Schedule of Buildings & Fire Protection Capacities
                    </h3>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-surface-2 text-muted-foreground font-semibold">
                          <tr>
                            <th className="p-2">Building Block</th>
                            <th className="p-2">Height / Floors</th>
                            <th className="p-2">Occupancy</th>
                            <th className="p-2">Civil Defense Code</th>
                            <th className="p-2">Fire Pump Capacity</th>
                            <th className="p-2">Tank Duration</th>
                            <th className="p-2">Net Storage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {evaluatedBuildings.map((item) => (
                            <tr key={item.building.id} className="hover:bg-surface-2/50">
                              <td className="p-2 font-medium text-foreground">{item.building.name}</td>
                              <td className="p-2 font-mono">{item.building.height}m (G+{item.building.floors})</td>
                              <td className="p-2 text-muted-foreground">
                                {OCCUPANCY_OPTIONS.find((o) => o.value === item.building.occupancy)?.label.split(" (")[0] || item.building.occupancy}
                              </td>
                              <td className="p-2 font-mono font-semibold text-primary">{item.evaluation.tableRef}</td>
                              <td className="p-2 font-mono font-semibold">{item.evaluation.lowestFirePumpFlowGpm} GPM @ {item.evaluation.lowestFirePumpPressureBar} bar</td>
                              <td className="p-2 font-mono">{item.evaluation.mainTankDurationMin} min</td>
                              <td className="p-2 font-mono font-semibold">{item.evaluation.mainTankNetVolumeM3} m³</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mandatory Code Notes */}
                  <div className="p-3.5 rounded-lg bg-surface-2 border border-border text-xs space-y-1.5 text-muted-foreground">
                    <div className="font-bold text-foreground">STATUTORY GENERAL NOTES & REQUIREMENTS:</div>
                    <div>1. All fire pump installations shall comprise 1 Main Electric Duty Pump + 1 Standby Diesel/Electric Pump (100% capacity) + 1 Jockey Pump.</div>
                    <div>2. Dedicated fire water storage shall be physically separated from domestic/irrigation tanks and provided with direct breeching inlets for refilling.</div>
                    <div>3. Towers exceeding 90 meters require multi-stage intermediate booster pumps and 30-min intermediate staging tanks every 90m.</div>
                  </div>

                  {/* Signatures Block */}
                  <div className="pt-6 border-t border-border grid grid-cols-3 gap-6 text-center text-xs">
                    <div>
                      <div className="h-10 border-b border-border flex items-end justify-center pb-1 text-muted-foreground font-mono">
                        {currentUserName}
                      </div>
                      <div className="font-bold text-foreground mt-1">Lead MEP Engineer</div>
                      <div className="text-[10px] text-muted-foreground">Prepared & Checked</div>
                    </div>
                    <div>
                      <div className="h-10 border-b border-border flex items-end justify-center pb-1 text-muted-foreground font-mono">
                        Civil Defense Approved Consultant
                      </div>
                      <div className="font-bold text-foreground mt-1">Consulting Engineering Firm</div>
                      <div className="text-[10px] text-muted-foreground">Reviewed & Stamped</div>
                    </div>
                    <div>
                      <div className="h-10 border-b border-border flex items-end justify-center pb-1 text-muted-foreground font-mono">
                        Pending AHJ Inspection
                      </div>
                      <div className="font-bold text-foreground mt-1">UAE Civil Defense Authority</div>
                      <div className="text-[10px] text-muted-foreground">Authority Having Jurisdiction</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Intelligence Drawer (Right Slide-out) */}
        {intelOpen && (
          <aside className="w-80 border-l border-border bg-card shrink-0 flex flex-col h-full animate-in slide-in-from-right duration-200 shadow-xl">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="text-xs font-bold text-foreground">Civil Defense AI Intelligence</h3>
              </div>
              <button
                onClick={() => setIntelOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
              {/* Insight 1: Super Highrise Alert */}
              {projectSummary.superHighriseCount > 0 ? (
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300">
                    <Layers className="size-3.5" />
                    <span>Super Highrise Staging Active</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {projectSummary.superHighriseCount} tower(s) exceed 90m height. Civil Defense mandates intermediate 750/1000 GPM pump sets and 30-min intermediate upper tanks every 90m.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>No Towers &gt; 90m</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    All buildings are within standard single-zone or two-zone height limits. Single basement pump station is sufficient.
                  </p>
                </div>
              )}

              {/* Insight 2: Plot Area & Yard Hydrants */}
              {projectSummary.yardHydrantRequiredCount > 0 ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-amber-700 dark:text-amber-300">
                    <ShieldAlert className="size-3.5" />
                    <span>Yard Fire Hydrants Required</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Plot area exceeds 20,000 m² without existing infrastructure hydrants within 60m. 1000 GPM @ 6.9 bar pump flow required to cover ring hydrants per Section 3.11.
                  </p>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-surface-2 border border-border space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    <span>Yard Hydrant Exemption Verified</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Infrastructure hydrants available within 60m radius or plot area ≤ 20,000 m². Internal systems govern pump capacity.
                  </p>
                </div>
              )}

              {/* Insight 3: NFPA 20 Pipe Sizing Velocity */}
              <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                <div className="flex items-center justify-between font-bold text-foreground">
                  <span>Discharge Header Velocity Check</span>
                  <span className="text-emerald-500 font-mono text-[11px]">
                    {projectSummary.governingHeaderVelocity} ft/s
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Discharge header of <strong>{projectSummary.governingHeaderNps}" NPS (DN {projectSummary.governingHeaderDn})</strong> keeps water velocity under the NFPA 20 statutory limit of 15 ft/s.
                </p>
              </div>

              {/* Insight 4: Water Tank Ullage Check */}
              <div className="p-3 rounded-xl bg-card border border-border space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <Droplets className="size-3.5 text-blue-500" />
                  <span>Tank Freeboard & Dead Sump</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A minimum 10% safety factor (freeboard + anti-vortex sump depth) is incorporated into the gross tank sizing calculation to ensure full effective capacity.
                </p>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Edit Building Parameters Modal (Opened via Double-Click or Edit Button) */}
      {editingBuilding && (
        <EditBuildingModal
          open={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          building={editingBuilding}
          onSave={handleSaveEditedBuilding}
          isReadOnly={isEffectiveReadOnly}
          occupancyOptions={OCCUPANCY_OPTIONS}
          unitSystem={unitSystem}
        />
      )}

      {/* Assign Comment Modal */}
      <AssignCommentModal
        open={commentModalOpen}
        onOpenChange={setCommentModalOpen}
        targetId={commentTargetId || "fire-water-demand-calc"}
        targetName="Civil Defense Fire Water Demand Calculator"
      />
    </AppShell>
  );
}
export default FireWaterDemandPage;

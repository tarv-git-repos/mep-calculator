import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, CheckCircle2, FileText, X, HelpCircle,
  MessageSquare, Check, Activity, Copy, RotateCcw,
  Trash2, Edit3, Droplets, Waves, Gauge, ShieldCheck, ShieldAlert, Layers,
  Download, Cylinder, ChevronDown, ChevronRight, Search,
  Plus, Minus, SlidersHorizontal, Maximize2, Sparkles, AlertTriangle,
  Zap, ArrowRight, BookOpen, Scissors, ClipboardPaste
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
import { DrainagePresetSelect } from "@/components/workspace/DrainagePresetSelect";
import { CustomDrainageConfigModal } from "@/components/workspace/CustomDrainageConfigModal";
import { useConfirm } from "@/hooks/use-confirm";

export const Route = createFileRoute("/plumbing-drainage")({
  head: () => ({
    meta: [
      { title: "Drainage Pipe Sizing Calculator — MEP Calc" },
      { name: "description", content: "Determine sanitary drainage branch, stack, and building drain/sewer sizes based on Fixture Units (DFU), slope, and Manning hydraulics per IPC & UPC." },
    ],
  }),
  component: DrainagePage,
});

export type DrainagePresetKey =
  | "commercial_office"
  | "residential_apartment"
  | "luxury_hotel"
  | "restaurant_kitchen"
  | "hospital_clinic"
  | "educational_school"
  | "custom";

export interface FixtureRowItem {
  id: string;
  name: string;
  category: "sanitary" | "kitchen" | "laundry" | "special";
  dfu: number;
  val: number;
  minTrapSizeInches: number;
  notes: string;
}

export interface DrainageFixtureMeta {
  id: string;
  name: string;
  short: string;
  category: "sanitary" | "kitchen" | "laundry" | "special";
  dfu: number;
  minTrapSizeInches: number;
  notes: string;
}

export const DRAINAGE_FIXTURES_META: DrainageFixtureMeta[] = [
  { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", short: "WC (Flush)", category: "sanitary", dfu: 4.0, minTrapSizeInches: 3.0, notes: "Public restrooms" },
  { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", short: "WC (Tank)", category: "sanitary", dfu: 3.0, minTrapSizeInches: 3.0, notes: "Private / residential" },
  { id: "lavatory", name: "Lavatory / Hand Basin", short: "LAV / Basin", category: "sanitary", dfu: 1.0, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
  { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", short: "Urinal", category: "sanitary", dfu: 2.0, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
  { id: "bathtub_shower", name: "Bathtub / Shower Combo", short: "Bath/Shower", category: "sanitary", dfu: 2.0, minTrapSizeInches: 1.5, notes: "With overhead shower" },
  { id: "shower_stall", name: "Shower Stall (Dedicated)", short: "Shower", category: "sanitary", dfu: 2.0, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
  { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", short: "Kitchen Sink", category: "kitchen", dfu: 2.0, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
  { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", short: "Pot Sink", category: "kitchen", dfu: 3.0, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
  { id: "dishwasher_comm", name: "Commercial Dishwasher", short: "Dishwasher", category: "kitchen", dfu: 3.0, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
  { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", short: "Washer", category: "laundry", dfu: 3.0, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
  { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", short: "Floor Drain", category: "special", dfu: 2.0, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
  { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", short: "Floor Drain 3\"", category: "special", dfu: 3.0, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
  { id: "service_sink", name: "Service Sink / Janitor Mop Basin", short: "Mop Basin", category: "special", dfu: 3.0, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
  { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", short: "Fountain", category: "special", dfu: 0.5, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
];

export interface DrainageSpaceItem {
  id: string;
  floor: string;
  desc: string;
  fixtures: Record<string, number>;
  spaceQty: number;
  floorsQty: number;
  comments?: any[];
}

export interface DrainagePresetConfig {
  key: DrainagePresetKey;
  label: string;
  category: string;
  description: string;
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
  slope: number; // in/ft (e.g. 0.25 = 1/4 in/ft)
  material: "pvc" | "cast_iron" | "hdpe" | "copper";
  safetyFactor: number; // %
  ventLength: number; // ft
  fixtures: FixtureRowItem[];
}

export const DEFAULT_FIXTURES: FixtureRowItem[] = DRAINAGE_FIXTURES_META.map(f => ({
  id: f.id,
  name: f.name,
  category: f.category,
  dfu: f.dfu,
  val: 0,
  minTrapSizeInches: f.minTrapSizeInches,
  notes: f.notes,
}));

export const DRAINAGE_PRESET_SPACES: Record<DrainagePresetKey, { floorSections: string[]; spaces: DrainageSpaceItem[] }> = {
  commercial_office: {
    floorSections: ["6th FLOOR (CORE)"],
    spaces: [
      { id: "s1", floor: "6th FLOOR (CORE)", desc: "Main Restroom Core (Male & Female)", fixtures: { wc_flush_valve: 8, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s2", floor: "6th FLOOR (CORE)", desc: "Executive Restrooms", fixtures: { wc_flush_valve: 4, urinal_fv: 2, lavatory: 4, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s3", floor: "6th FLOOR (CORE)", desc: "Office Pantry & Coffee Stations", fixtures: { kitchen_sink_dom: 2, floor_drain_2: 1 }, spaceQty: 1, floorsQty: 1 },
      { id: "s4", floor: "6th FLOOR (CORE)", desc: "Janitor Service Closet", fixtures: { service_sink: 2, floor_drain_2: 1 }, spaceQty: 1, floorsQty: 1 },
      { id: "s5", floor: "6th FLOOR (CORE)", desc: "Corridor Drinking Water Coolers", fixtures: { drinking_fountain: 4 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  residential_apartment: {
    floorSections: ["TYPICAL RESIDENTIAL FLOORS"],
    spaces: [
      { id: "s1", floor: "TYPICAL RESIDENTIAL FLOORS", desc: "2-Bedroom Master Bathrooms", fixtures: { wc_tank: 1, lavatory: 2, bathtub_shower: 1, floor_drain_2: 1 }, spaceQty: 2, floorsQty: 6 },
      { id: "s2", floor: "TYPICAL RESIDENTIAL FLOORS", desc: "Guest Bathrooms", fixtures: { wc_tank: 1, lavatory: 1, shower_stall: 1, floor_drain_2: 1 }, spaceQty: 2, floorsQty: 6 },
      { id: "s3", floor: "TYPICAL RESIDENTIAL FLOORS", desc: "Apartment Kitchens & Laundries", fixtures: { kitchen_sink_dom: 1, clothes_washer: 1, floor_drain_2: 1 }, spaceQty: 2, floorsQty: 6 },
    ],
  },
  luxury_hotel: {
    floorSections: ["GUESTROOM WINGS", "PUBLIC & SERVICE PODIUM"],
    spaces: [
      { id: "s1", floor: "GUESTROOM WINGS", desc: "King Deluxe Suite En-Suite", fixtures: { wc_tank: 1, lavatory: 2, bathtub_shower: 1, shower_stall: 1 }, spaceQty: 10, floorsQty: 5 },
      { id: "s2", floor: "GUESTROOM WINGS", desc: "Twin Suite En-Suite", fixtures: { wc_tank: 1, lavatory: 1, shower_stall: 1, floor_drain_2: 1 }, spaceQty: 8, floorsQty: 5 },
      { id: "s3", floor: "PUBLIC & SERVICE PODIUM", desc: "Hotel Banquet Prep Kitchen", fixtures: { kitchen_sink_comm: 4, dishwasher_comm: 2, floor_drain_2: 4, service_sink: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s4", floor: "PUBLIC & SERVICE PODIUM", desc: "Lobby Public Restrooms", fixtures: { wc_flush_valve: 6, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  restaurant_kitchen: {
    floorSections: ["COMMERCIAL KITCHEN & DINING"],
    spaces: [
      { id: "s1", floor: "COMMERCIAL KITCHEN & DINING", desc: "Scullery & Pot Washing Zone", fixtures: { kitchen_sink_comm: 4, dishwasher_comm: 2, floor_drain_2: 4 }, spaceQty: 1, floorsQty: 1 },
      { id: "s2", floor: "COMMERCIAL KITCHEN & DINING", desc: "Hot Prep & Cookline Drains", fixtures: { kitchen_sink_dom: 2, floor_drain_3: 4, service_sink: 2 }, spaceQty: 1, floorsQty: 1 },
      { id: "s3", floor: "COMMERCIAL KITCHEN & DINING", desc: "Customer Restrooms (M/F)", fixtures: { wc_flush_valve: 6, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  hospital_clinic: {
    floorSections: ["INPATIENT WARD (LEVEL 2-4)", "GROUND FLOOR CLINIC"],
    spaces: [
      { id: "s1", floor: "INPATIENT WARD (LEVEL 2-4)", desc: "Patient Private Rooms", fixtures: { wc_flush_valve: 1, lavatory: 1, shower_stall: 1, floor_drain_2: 1 }, spaceQty: 12, floorsQty: 3 },
      { id: "s2", floor: "INPATIENT WARD (LEVEL 2-4)", desc: "Nurses Station & Dirty Utility", fixtures: { service_sink: 2, kitchen_sink_dom: 1, floor_drain_2: 2 }, spaceQty: 2, floorsQty: 3 },
      { id: "s3", floor: "GROUND FLOOR CLINIC", desc: "Outpatient Core Restrooms", fixtures: { wc_flush_valve: 6, urinal_fv: 4, lavatory: 6, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  educational_school: {
    floorSections: ["ACADEMIC WING", "SPORTS & CAFETERIA"],
    spaces: [
      { id: "s1", floor: "ACADEMIC WING", desc: "Boys & Girls Restroom Core", fixtures: { wc_flush_valve: 10, urinal_fv: 8, lavatory: 8, floor_drain_2: 4 }, spaceQty: 2, floorsQty: 3 },
      { id: "s2", floor: "ACADEMIC WING", desc: "Science & Art Laboratories", fixtures: { kitchen_sink_dom: 6, floor_drain_2: 2 }, spaceQty: 2, floorsQty: 3 },
      { id: "s3", floor: "SPORTS & CAFETERIA", desc: "Gym Locker Rooms & Showers", fixtures: { shower_stall: 8, wc_flush_valve: 4, lavatory: 4, floor_drain_2: 4 }, spaceQty: 2, floorsQty: 1 },
      { id: "s4", floor: "SPORTS & CAFETERIA", desc: "Cafeteria Kitchen & Washup", fixtures: { kitchen_sink_comm: 3, dishwasher_comm: 1, service_sink: 2, floor_drain_2: 3 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
  custom: {
    floorSections: ["CUSTOM FLOOR SECTION"],
    spaces: [
      { id: "s1", floor: "CUSTOM FLOOR SECTION", desc: "Sanitary Restroom Core", fixtures: { wc_flush_valve: 4, lavatory: 4, urinal_fv: 2, floor_drain_2: 2 }, spaceQty: 1, floorsQty: 1 },
    ],
  },
};

export const DRAINAGE_PRESETS: Record<DrainagePresetKey, DrainagePresetConfig> = {
  commercial_office: {
    key: "commercial_office",
    label: "Commercial Office Floor",
    category: "IPC / Commercial Branch & Stack",
    description: "Multi-fixture male/female commercial restroom core with WCs, urinals, lavatories, and pantry.",
    systemType: "branch",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 45,
    fixtures: DEFAULT_FIXTURES,
  },
  residential_apartment: {
    key: "residential_apartment",
    label: "Residential Apartment Stack",
    category: "IPC / Multi-Family Stack",
    description: "6-story multi-family apartment residential soil & waste vertical drainage stack.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 60,
    fixtures: DEFAULT_FIXTURES,
  },
  luxury_hotel: {
    key: "luxury_hotel",
    label: "Luxury Hotel Guestrooms & Kitchen",
    category: "IPC / Hospitality Sizing",
    description: "Multi-story luxury guestrooms with heavy drainage scullery prep and public amenities.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "cast_iron",
    safetyFactor: 15,
    ventLength: 75,
    fixtures: DEFAULT_FIXTURES,
  },
  restaurant_kitchen: {
    key: "restaurant_kitchen",
    label: "Restaurant & Commercial Kitchen",
    category: "IPC / High Grease Commercial",
    description: "High-discharge pot washing sinks, commercial dishwashers, and floor drains.",
    systemType: "building_drain",
    slope: 0.25,
    material: "cast_iron",
    safetyFactor: 20,
    ventLength: 50,
    fixtures: DEFAULT_FIXTURES,
  },
  hospital_clinic: {
    key: "hospital_clinic",
    label: "Hospital / Healthcare Clinic",
    category: "IPC / Healthcare Ward",
    description: "Inpatient private suites, clinical janitor dirty utility basins, and outpatient core.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "hdpe",
    safetyFactor: 20,
    ventLength: 65,
    fixtures: DEFAULT_FIXTURES,
  },
  educational_school: {
    key: "educational_school",
    label: "Educational School Campus",
    category: "IPC / Institutional High-Use",
    description: "High simultaneous peak usage school restroom batteries, lab sinks, and sports locker rooms.",
    systemType: "building_drain",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 55,
    fixtures: DEFAULT_FIXTURES,
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "User Defined",
    description: "Custom user-defined drainage layout with specific space configurations.",
    systemType: "branch",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 45,
    fixtures: DEFAULT_FIXTURES,
  },
};

const MATERIAL_ROUGHNESS: Record<string, { n: number; name: string }> = {
  pvc: { n: 0.009, name: "PVC / ABS Schedule 40 (n = 0.009)" },
  cast_iron: { n: 0.012, name: "Cast Iron Hubless / No-Hub (n = 0.012)" },
  hdpe: { n: 0.009, name: "HDPE Drainage Pipe (n = 0.009)" },
  copper: { n: 0.011, name: "Copper Type DWV (n = 0.011)" },
};

const BRANCH_CAPACITY: { size: number; maxDfu: number; dn: number }[] = [
  { size: 1.5, maxDfu: 3, dn: 40 },
  { size: 2.0, maxDfu: 6, dn: 50 },
  { size: 2.5, maxDfu: 12, dn: 65 },
  { size: 3.0, maxDfu: 20, dn: 80 },
  { size: 4.0, maxDfu: 160, dn: 100 },
  { size: 5.0, maxDfu: 360, dn: 125 },
  { size: 6.0, maxDfu: 620, dn: 150 },
  { size: 8.0, maxDfu: 1400, dn: 200 },
  { size: 10.0, maxDfu: 2500, dn: 250 },
  { size: 12.0, maxDfu: 3900, dn: 300 },
];

const STACK_CAPACITY: { size: number; maxShort: number; maxTall: number; dn: number }[] = [
  { size: 1.5, maxShort: 4, maxTall: 8, dn: 40 },
  { size: 2.0, maxShort: 10, maxTall: 24, dn: 50 },
  { size: 2.5, maxShort: 20, maxTall: 42, dn: 65 },
  { size: 3.0, maxShort: 48, maxTall: 72, dn: 80 },
  { size: 4.0, maxShort: 240, maxTall: 500, dn: 100 },
  { size: 5.0, maxShort: 540, maxTall: 1100, dn: 125 },
  { size: 6.0, maxShort: 960, maxTall: 1900, dn: 150 },
  { size: 8.0, maxShort: 2200, maxTall: 3600, dn: 200 },
  { size: 10.0, maxShort: 3800, maxTall: 5600, dn: 250 },
  { size: 12.0, maxShort: 6000, maxTall: 8400, dn: 300 },
];

const BUILDING_DRAIN_CAPACITY: { size: number; s0625: number; s125: number; s25: number; s50: number; dn: number }[] = [
  { size: 1.5, s0625: 0, s125: 0, s25: 1, s50: 1, dn: 40 },
  { size: 2.0, s0625: 0, s125: 0, s25: 21, s50: 26, dn: 50 },
  { size: 2.5, s0625: 0, s125: 0, s25: 24, s50: 31, dn: 65 },
  { size: 3.0, s0625: 0, s125: 36, s25: 42, s50: 50, dn: 80 },
  { size: 4.0, s0625: 180, s125: 216, s25: 250, s50: 290, dn: 100 },
  { size: 5.0, s0625: 390, s125: 480, s25: 575, s50: 675, dn: 125 },
  { size: 6.0, s0625: 700, s125: 840, s25: 1000, s50: 1300, dn: 150 },
  { size: 8.0, s0625: 1400, s125: 1920, s25: 2300, s50: 3000, dn: 200 },
  { size: 10.0, s0625: 2500, s125: 3500, s25: 4200, s50: 5300, dn: 250 },
  { size: 12.0, s0625: 3900, s125: 5600, s25: 6700, s50: 8300, dn: 300 },
];

function computeVentSize(soilStackSize: number, totalDfu: number, ventLengthFt: number): { size: number; dn: number } {
  if (soilStackSize <= 1.5) return { size: 1.25, dn: 32 };
  if (soilStackSize <= 2.0) {
    if (ventLengthFt <= 50) return { size: 1.5, dn: 40 };
    return { size: 2.0, dn: 50 };
  }
  if (soilStackSize <= 3.0) {
    if (totalDfu <= 20 && ventLengthFt <= 60) return { size: 1.5, dn: 40 };
    if (ventLengthFt <= 100) return { size: 2.0, dn: 50 };
    return { size: 2.5, dn: 65 };
  }
  if (soilStackSize <= 4.0) {
    if (totalDfu <= 100 && ventLengthFt <= 50) return { size: 2.0, dn: 50 };
    if (ventLengthFt <= 100) return { size: 2.5, dn: 65 };
    if (ventLengthFt <= 200) return { size: 3.0, dn: 80 };
    return { size: 4.0, dn: 100 };
  }
  if (soilStackSize <= 6.0) {
    if (ventLengthFt <= 100) return { size: 3.0, dn: 80 };
    return { size: 4.0, dn: 100 };
  }
  return { size: 4.0, dn: 100 };
}

function FloorNameInput({
  floor,
  disabled,
  onRename,
}: {
  floor: string;
  disabled: boolean;
  onRename: (oldName: string, newName: string) => void;
}) {
  const getCleanFloor = (f: string) => {
    if (!f || f.toLowerCase() === "undefined" || f.toLowerCase() === "null") return "TYPICAL FLOOR";
    return f;
  };

  const [val, setVal] = useState(getCleanFloor(floor));

  useEffect(() => {
    setVal(getCleanFloor(floor));
  }, [floor]);

  const commitRename = () => {
    const trimmed = val.trim();
    if (trimmed && trimmed !== floor) {
      onRename(floor, trimmed);
    } else {
      setVal(getCleanFloor(floor));
    }
  };

  return (
    <input
      type="text"
      value={val}
      disabled={disabled}
      onChange={e => setVal(e.target.value)}
      onBlur={commitRename}
      onFocus={e => e.target.select()}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setVal(getCleanFloor(floor));
          e.currentTarget.blur();
        }
      }}
      className="bg-transparent border border-transparent hover:border-border/80 focus:border-primary focus:bg-background px-2 py-0.5 rounded-md font-bold text-primary text-xs uppercase outline-none transition-all cursor-text min-w-[100px] max-w-[260px]"
      title="Click to edit floor name (Press Enter or click outside to save)"
    />
  );
}

interface InlineInputProps {
  value: string | number;
  onCommit: (val: string) => void;
  className?: string;
  type?: "text" | "number";
  step?: string;
  min?: number;
  placeholder?: string;
  disabled?: boolean;
  onDoubleClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
}

function InlineInput({ value, onCommit, className = "", type = "text", step, min, placeholder, disabled, onDoubleClick }: InlineInputProps) {
  const getCleanVal = (val: any) => {
    if (val === undefined || val === null || val === "undefined" || val === "null") {
      return "";
    }
    return String(val);
  };

  const [localVal, setLocalVal] = useState(getCleanVal(value));

  useEffect(() => {
    const clean = getCleanVal(value);
    setLocalVal(prev => (prev === clean ? prev : clean));
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (!disabled && localVal !== getCleanVal(value)) {
        onCommit(localVal);
      }
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
      disabled={disabled}
      placeholder={placeholder}
      value={localVal}
      onChange={(e) => {
        if (disabled) return;
        setLocalVal(e.target.value);
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        if (disabled) {
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
        if (onDoubleClick) {
          onDoubleClick(e);
        }
      }}
      className={`bg-transparent border border-transparent rounded transition-colors ${disabled
        ? "cursor-not-allowed opacity-75 select-none"
        : "hover:border-border/60 focus:border-primary focus:bg-background focus:outline-none cursor-text"
        } ${className}`}
    />
  );
}

function DrainagePage() {
  const confirm = useConfirm();
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const { project, activeRoom, isReadOnly, forceSaveToCloud } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-drainage", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");
  const isLocked = isEffectiveReadOnly;

  // Calculation review state listener
  useEffect(() => {
    const handleReviewUpdate = (e: any) => {
      if (e?.detail) {
        setCalcReviewState(e.detail);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mep-review-state-updated", handleReviewUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mep-review-state-updated", handleReviewUpdate);
      }
    };
  }, []);

  // Mode: "calculator" vs "report"
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [intelOpen, setIntelOpen] = useState(false);

  // Unit System
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("si");
  const isSI = unitSystem === "si";

  // Selected preset & custom profile state
  const [selectedPreset, setSelectedPreset] = useState<DrainagePresetKey>("commercial_office");
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customProfileName, setCustomProfileName] = useState("Commercial Office Floor (Custom)");
  const [customWorkflow, setCustomWorkflow] = useState<"matrix" | "direct">("matrix");

  // Drainage parameters
  const [systemType, setSystemType] = useState<"branch" | "stack_short" | "stack_tall" | "building_drain">("branch");
  const [floorSystemTypes, setFloorSystemTypes] = useState<Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain">>({});
  const [slope, setSlope] = useState<number>(0.25); // in/ft
  const [material, setMaterial] = useState<"pvc" | "cast_iron" | "hdpe" | "copper">("pvc");
  const [safetyFactor, setSafetyFactor] = useState<number>(15); // %
  const [ventLength, setVentLength] = useState<number>(45); // ft

  // Matrix Spaces State (Matrix / Table Grid like Loading Unit Calculator)
  const [floorSections, setFloorSections] = useState<string[]>(DRAINAGE_PRESET_SPACES.commercial_office.floorSections);
  const [drainageSpaces, setDrainageSpaces] = useState<DrainageSpaceItem[]>(DRAINAGE_PRESET_SPACES.commercial_office.spaces);
  const [selectedSpaceIds, setSelectedSpaceIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFloor, setFilterFloor] = useState("all");
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Interactive Modals & Comments
  const [editingSpace, setEditingSpace] = useState<{ space: DrainageSpaceItem; floor: string } | null>(null);
  const [showInspectorModal, setShowInspectorModal] = useState<boolean>(false);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [highlightedSpaceId, setHighlightedSpaceId] = useState<string | null>(null);
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Load calculation state & spaces from localStorage and project.workspace_data on project mount/change
  useEffect(() => {
    if (!project?.id) return;
    const pId = project.id;
    const key1 = `mep_plumbing_drainage_${pId}`;
    const key2 = `mep_drainage_pipe_calc_${pId}`;

    try {
      let savedData: any = null;
      const stored1 = localStorage.getItem(key1);
      const stored2 = localStorage.getItem(key2);
      if (stored1) {
        try { savedData = JSON.parse(stored1); } catch (e) { }
      } else if (stored2) {
        try { savedData = JSON.parse(stored2); } catch (e) { }
      }

      if (!savedData && project?.workspace_data) {
        const wdata = typeof project.workspace_data === "string"
          ? JSON.parse(project.workspace_data)
          : project.workspace_data;
        savedData = wdata?.drainage_calc || wdata?.drainage_pipe_calc;
      }

      if (savedData && typeof savedData === "object") {
        if (savedData.unitSystem === "ip" || savedData.unitSystem === "si") setUnitSystem(savedData.unitSystem);
        if (savedData.selectedPreset) setSelectedPreset(savedData.selectedPreset);
        if (savedData.customProfileName) setCustomProfileName(savedData.customProfileName);
        if (savedData.customWorkflow) setCustomWorkflow(savedData.customWorkflow);
        if (savedData.systemType) setSystemType(savedData.systemType);
        if (savedData.floorSystemTypes && typeof savedData.floorSystemTypes === "object") setFloorSystemTypes(savedData.floorSystemTypes);
        if (typeof savedData.slope === "number" && !isNaN(savedData.slope)) setSlope(savedData.slope);
        if (savedData.material) setMaterial(savedData.material);
        if (typeof savedData.safetyFactor === "number" && !isNaN(savedData.safetyFactor)) setSafetyFactor(savedData.safetyFactor);
        if (typeof savedData.ventLength === "number" && !isNaN(savedData.ventLength)) setVentLength(savedData.ventLength);

        let cleanFloors: string[] = [];
        if (Array.isArray(savedData.floorSections) && savedData.floorSections.length > 0) {
          cleanFloors = Array.from(new Set(
            savedData.floorSections
              .map((f: any) => String(f || "").trim())
              .filter((f: string) => f && f !== "undefined" && f !== "null")
          ));
        }

        if (Array.isArray(savedData.drainageSpaces) && savedData.drainageSpaces.length > 0) {
          const cleanSpaces = savedData.drainageSpaces
            .filter((s: any) => s && typeof s === "object")
            .map((s: any, idx: number) => ({
              id: s.id || `space-${Date.now()}-${idx}`,
              floor: String(s.floor || "").trim() && String(s.floor) !== "undefined" && String(s.floor) !== "null"
                ? String(s.floor).trim()
                : (cleanFloors[0] || "6th FLOOR (CORE)"),
              desc: s.desc || `Restroom Space (${idx + 1})`,
              fixtures: s.fixtures && typeof s.fixtures === "object" ? s.fixtures : {},
              spaceQty: Number(s.spaceQty) || 1,
              floorsQty: Number(s.floorsQty) || 1,
              comments: Array.isArray(s.comments) ? s.comments : []
            }));
          if (cleanSpaces.length > 0) {
            setDrainageSpaces(cleanSpaces);
            if (cleanFloors.length === 0) {
              cleanFloors = Array.from(new Set(cleanSpaces.map(s => s.floor)));
            }
          }
        }
        if (cleanFloors.length > 0) {
          setFloorSections(cleanFloors);
        }
      } else {
        // Fresh project default
        setUnitSystem("si");
        setSelectedPreset("commercial_office");
        setFloorSections(DRAINAGE_PRESET_SPACES.commercial_office.floorSections);
        setDrainageSpaces(DRAINAGE_PRESET_SPACES.commercial_office.spaces);
        setSlope(0.25);
        setMaterial("pvc");
        setSafetyFactor(15);
        setVentLength(45);
        setSystemType("branch");
        setFloorSystemTypes({});
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load drainage calculation data:", e);
    }
    setLoadedProjectId(pId);
  }, [project?.id]);

  // Auto-save calculation state to localStorage & project.workspace_data whenever values change
  useEffect(() => {
    if (!project?.id || loadedProjectId !== project.id) return;
    const pId = project.id;
    const key = `mep_plumbing_drainage_${pId}`;

    const cleanFloors = Array.from(new Set(
      floorSections
        .map(f => String(f || "").trim())
        .filter(f => f && f !== "undefined" && f !== "null")
    ));

    const cleanSpaces = drainageSpaces
      .filter(s => s && typeof s === "object")
      .map(s => ({
        ...s,
        floor: String(s.floor || "").trim() && String(s.floor) !== "undefined" && String(s.floor) !== "null"
          ? String(s.floor).trim()
          : (cleanFloors[0] || "TYPICAL FLOOR"),
        spaceQty: Number(s.spaceQty) || 1,
        floorsQty: Number(s.floorsQty) || 1
      }));

    const dataToSave = {
      unitSystem,
      selectedPreset,
      customProfileName,
      customWorkflow,
      systemType,
      floorSystemTypes,
      slope,
      material,
      safetyFactor,
      ventLength,
      floorSections: cleanFloors.length > 0 ? cleanFloors : ["TYPICAL FLOOR"],
      drainageSpaces: cleanSpaces,
      lastUpdated: new Date().toISOString()
    };

    try {
      localStorage.setItem(key, JSON.stringify(dataToSave));
      localStorage.setItem(`mep_drainage_pipe_calc_${pId}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);

      if (forceSaveToCloud) forceSaveToCloud();
    } catch (e) {
      console.error("Failed to auto-save drainage calculation", e);
    }
  }, [
    project?.id,
    loadedProjectId,
    unitSystem,
    selectedPreset,
    customProfileName,
    customWorkflow,
    systemType,
    floorSystemTypes,
    slope,
    material,
    safetyFactor,
    ventLength,
    floorSections,
    drainageSpaces
  ]);

  // Global manual save (Ctrl+S) and Version History snapshot restore listener
  useEffect(() => {
    const handleSaveEvent = () => {
      if (!project?.id) return;
      const pId = project.id;
      const key = `mep_plumbing_drainage_${pId}`;
      const dataToSave = {
        unitSystem,
        selectedPreset,
        customProfileName,
        customWorkflow,
        systemType,
        floorSystemTypes,
        slope,
        material,
        safetyFactor,
        ventLength,
        floorSections: floorSections.filter(f => f && f !== "undefined" && f !== "null"),
        drainageSpaces,
        lastUpdated: new Date().toISOString()
      };
      try {
        localStorage.setItem(key, JSON.stringify(dataToSave));
        localStorage.setItem(`mep_drainage_pipe_calc_${pId}`, JSON.stringify(dataToSave));
        const wdata = project.workspace_data || {};
        workspaceStore.updateProject({
          ...project,
          workspace_data: { ...wdata, drainage_calc: dataToSave, drainage_pipe_calc: dataToSave }
        });
        workspaceStore.forceSaveToCloud();
      } catch (e) { }
    };

    const handleVersionRestored = (e: any) => {
      const pId = project?.id || "default";
      const pKey = `mep_plumbing_drainage_${pId}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && (lsCache[pKey] || lsCache[`mep_drainage_pipe_calc_${pId}`])) {
        try {
          const raw = lsCache[pKey] || lsCache[`mep_drainage_pipe_calc_${pId}`];
          restoredData = typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch (err) { }
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey) || localStorage.getItem(`mep_drainage_pipe_calc_${pId}`);
        if (stored) {
          try { restoredData = JSON.parse(stored); } catch (err) { }
        }
      }
      if (restoredData && typeof restoredData === "object") {
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        if (restoredData.selectedPreset) setSelectedPreset(restoredData.selectedPreset);
        if (restoredData.customProfileName) setCustomProfileName(restoredData.customProfileName);
        if (restoredData.systemType) setSystemType(restoredData.systemType);
        if (restoredData.slope !== undefined) setSlope(restoredData.slope);
        if (restoredData.material) setMaterial(restoredData.material);
        if (restoredData.safetyFactor !== undefined) setSafetyFactor(restoredData.safetyFactor);
        if (restoredData.ventLength !== undefined) setVentLength(restoredData.ventLength);
        if (Array.isArray(restoredData.floorSections) && restoredData.floorSections.length > 0) {
          setFloorSections(restoredData.floorSections.filter((f: any) => f && f !== "undefined" && f !== "null"));
        }
        if (Array.isArray(restoredData.drainageSpaces) && restoredData.drainageSpaces.length > 0) {
          setDrainageSpaces(restoredData.drainageSpaces);
        }
        if (restoredData.floorSystemTypes) setFloorSystemTypes(restoredData.floorSystemTypes);
        toast.success("Restored drainage calculation snapshot!");
      }
    };

    window.addEventListener("mep_save_project", handleSaveEvent);
    window.addEventListener("mep_version_restored", handleVersionRestored);
    return () => {
      window.removeEventListener("mep_save_project", handleSaveEvent);
      window.removeEventListener("mep_version_restored", handleVersionRestored);
    };
  }, [
    project?.id,
    unitSystem,
    selectedPreset,
    customProfileName,
    customWorkflow,
    systemType,
    floorSystemTypes,
    slope,
    material,
    safetyFactor,
    ventLength,
    floorSections,
    drainageSpaces
  ]);

  // Load comments on project switch and merge into spaces
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-drainage`;
    try {
      const stored = localStorage.getItem(storageKey);
      let parsed: any[] = [];
      if (stored) {
        try { parsed = JSON.parse(stored); } catch (e) { }
      }
      const wdata = project?.workspace_data || {};
      const wdataComments = Array.isArray(wdata.drainage_calc_comments) ? wdata.drainage_calc_comments : [];
      const allComments = [...parsed, ...wdataComments];

      const dedupMap = new Map<string, any>();
      allComments.forEach(c => {
        if (c && (c.id || c.text)) {
          const k = c.id || `${c.targetId}_${c.text}_${c.timestamp}`;
          if (!dedupMap.has(k)) dedupMap.set(k, c);
        }
      });
      const mergedComments = Array.from(dedupMap.values());

      if (mergedComments.length > 0) {
        setCommentsList(mergedComments);
        setDrainageSpaces(prev =>
          prev.map(s => {
            const spaceComments = mergedComments.filter(
              (c: any) => c.targetId === s.id || c.targetName === s.desc || c.spaceId === s.id
            );
            return { ...s, comments: spaceComments.length > 0 ? spaceComments : s.comments || [] };
          })
        );
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  const getSpaceComments = (space: { id?: string; desc?: string; comments?: any[] }): any[] => {
    if (!space) return [];
    const directComments = Array.isArray(space.comments) ? space.comments : [];
    const sDescLow = String(space.desc || "").trim().toLowerCase();
    const sId = String(space.id || "").trim();

    const fromList = commentsList.filter((c: any) => {
      if (!c) return false;
      const cTargetId = String(c.targetId || c.metadata?.targetId || "").trim();
      const cTargetName = String(c.targetName || c.metadata?.targetName || "").trim().toLowerCase();
      const cSpaceId = String(c.spaceId || "").trim();

      if (cTargetId && (cTargetId === sId || cTargetId === `space-${sId}` || cTargetId === `space-row-${sId}`)) return true;
      if (cSpaceId && cSpaceId === sId) return true;
      if (cTargetName && (cTargetName === sDescLow || sDescLow.includes(cTargetName) || cTargetName.includes(sDescLow))) return true;
      return false;
    });

    const merged = [...directComments, ...fromList];
    const seen = new Set<string>();
    return merged.filter((c: any) => {
      if (!c) return false;
      const key = c.id || `${c.targetId}_${c.text}_${c.timestamp}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleOpenComment = (id: string, name: string) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Adding comments is locked.", { id: "readonly-notice" });
      return;
    }
    setCommentTargetItem({ id, name });
    setIsCommentModalOpen(true);
  };

  const drainageSpacesRef = useRef(drainageSpaces);
  drainageSpacesRef.current = drainageSpaces;
  const filterFloorRef = useRef(filterFloor);
  filterFloorRef.current = filterFloor;

  // Deep-linking helper to scroll and highlight commented target space
  const handleScrollToTarget = (targetId?: string, targetName?: string) => {
    if (!targetId && !targetName) return;

    const cleanId = String(targetId || "").trim();
    const cleanName = String(targetName || "").trim().toLowerCase();
    const cleanNorm = cleanName.replace(/[^a-z0-9]/g, "");

    const currentSpaces = drainageSpacesRef.current;
    const matched = currentSpaces.find(s => {
      if (cleanId && (s.id === cleanId || `space-row-${s.id}` === cleanId || `space-${s.id}` === cleanId)) return true;
      if (cleanName) {
        const descLow = s.desc.toLowerCase();
        const descNorm = descLow.replace(/[^a-z0-9]/g, "");
        if (descLow === cleanName || descLow.includes(cleanName) || cleanName.includes(descLow)) return true;
        if (cleanNorm && (descNorm === cleanNorm || descNorm.includes(cleanNorm) || cleanNorm.includes(descNorm))) return true;
      }
      return false;
    });

    if (matched) {
      setActiveTab("calculator");
      // If the targeted space is hidden under a different floor filter, show its floor
      if (filterFloorRef.current !== "all" && filterFloorRef.current !== matched.floor) {
        setFilterFloor(matched.floor);
      }
      setHighlightedSpaceId(matched.id);

      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedSpaceId(null);
      }, 4500);

      const delays = [50, 150, 300, 600, 1000];
      delays.forEach(delay => {
        setTimeout(() => {
          const el = document.getElementById(`space-row-${matched.id}`) ||
            document.querySelector(`[data-row-id="${matched.id}"]`) ||
            document.querySelector(`[data-space-id="${matched.id}"]`) ||
            document.querySelector(`[data-comment-target="${matched.id}"]`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, delay);
      });
    }
  };

  // Listen for comment scroll/highlight navigation from notifications and initial URL parameters
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check URL parameters on mount
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId") || params.get("targetId");
    const targetName = params.get("commentTargetName") || params.get("targetName");
    if (targetId || targetName) {
      setTimeout(() => {
        handleScrollToTarget(targetId || undefined, targetName || undefined);
        // Clean URL query parameters so subsequent additions/edits don't re-trigger target scroll
        try {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        } catch (e) { }
      }, 300);
    }

    // Listen to mep-scroll-to-item window events
    const handleScrollEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ id?: string; name?: string; type?: string; commentId?: string }>;
      if (!customEvent || !customEvent.detail) return;
      handleScrollToTarget(customEvent.detail.id, customEvent.detail.name);
    };

    window.addEventListener("mep-scroll-to-item", handleScrollEvent);
    window.addEventListener("mep-data-grid-scroll", handleScrollEvent);

    return () => {
      window.removeEventListener("mep-scroll-to-item", handleScrollEvent);
      window.removeEventListener("mep-data-grid-scroll", handleScrollEvent);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Handle Preset Switching
  const handleApplyPreset = (key: DrainagePresetKey) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    if (key === "custom") {
      setSelectedPreset("custom");
      setCustomModalOpen(true);
      return;
    }
    const config = DRAINAGE_PRESETS[key];
    const presetData = DRAINAGE_PRESET_SPACES[key];
    if (!config) return;
    setSelectedPreset(key);
    setSystemType(config.systemType);
    setSlope(config.slope);
    setMaterial(config.material);
    setSafetyFactor(config.safetyFactor);
    setVentLength(config.ventLength);
    if (presetData) {
      const initialFloorTypes: Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain"> = {};
      presetData.floorSections.forEach(fl => {
        initialFloorTypes[fl] = config.systemType;
      });
      setFloorSections([...presetData.floorSections]);
      setDrainageSpaces(presetData.spaces.map(s => ({ ...s, fixtures: { ...s.fixtures } })));
      setFloorSystemTypes(initialFloorTypes);
    }
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.info(`Loaded "${config.label}" matrix schedule.`);
  };

  const handleApplyCustomConfig = (updated: {
    systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
    slope: number;
    material: "pvc" | "cast_iron" | "hdpe" | "copper";
    safetyFactor: number;
    ventLength: number;
    fixtures: FixtureRowItem[];
    customProfileName: string;
    customWorkflow: "matrix" | "direct";
  }) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    setSelectedPreset("custom");
    setSystemType(updated.systemType);
    setSlope(updated.slope);
    setMaterial(updated.material);
    setSafetyFactor(updated.safetyFactor);
    setVentLength(updated.ventLength);
    setCustomProfileName(updated.customProfileName);
    setCustomWorkflow(updated.customWorkflow);

    // Map fixtures array into default space if in custom mode
    const customFixMap: Record<string, number> = {};
    updated.fixtures.forEach(f => {
      if (f.val > 0) customFixMap[f.id] = f.val;
    });
    setFloorSections(["CUSTOM FACILITY"]);
    setFloorSystemTypes({ "CUSTOM FACILITY": updated.systemType });
    setDrainageSpaces([
      {
        id: `space-${Date.now()}`,
        floor: "CUSTOM FACILITY",
        desc: updated.customProfileName || "Custom Sanitary Area",
        fixtures: customFixMap,
        spaceQty: 1,
        floorsQty: 1,
      }
    ]);
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.success(`Applied "${updated.customProfileName}" configuration!`);
  };

  const handleUnitSystemChange = (target: "ip" | "si") => {
    setUnitSystem(target);
    dirtyStore.set(true);
  };

  // Matrix Space Management
  const handleAddSpace = (targetFloor?: string) => {
    if (isLocked) return;
    const defaultFloor = targetFloor || (filterFloor !== "all" ? filterFloor : (floorSections[floorSections.length - 1] || floorSections[0] || "TYPICAL FLOOR"));
    const newId = `space-${Date.now()}`;
    const newSpace: DrainageSpaceItem = {
      id: newId,
      floor: defaultFloor,
      desc: `New Restroom / Space (${drainageSpaces.length + 1})`,
      fixtures: { wc_flush_valve: 2, lavatory: 2, floor_drain_2: 1 },
      spaceQty: 1,
      floorsQty: 1,
    };
    setDrainageSpaces(prev => [...prev, newSpace]);
    dirtyStore.set(true);
    toast.success(`Added new space to ${defaultFloor}.`);
  };

  const handleAddNewFloorSection = () => {
    if (isLocked) return;
    let count = floorSections.length + 1;
    let newSection = `FLOOR SECTION ${count}`;
    while (floorSections.includes(newSection)) {
      count++;
      newSection = `FLOOR SECTION ${count}`;
    }
    setFloorSections(prev => [...prev, newSection]);
    setFloorSystemTypes(prev => ({ ...prev, [newSection]: systemType }));
    if (filterFloor !== "all") {
      setFilterFloor(newSection);
    }
    handleAddSpace(newSection);
  };

  const handleRenameFloorGroup = (oldName: string, newName: string) => {
    if (isLocked) return;
    setFloorSections(prev => prev.map(f => (f === oldName ? newName : f)));
    setDrainageSpaces(prev => prev.map(s => (s.floor === oldName ? { ...s, floor: newName } : s)));
    setFloorSystemTypes(prev => {
      const next = { ...prev };
      if (next[oldName]) {
        next[newName] = next[oldName];
        delete next[oldName];
      }
      return next;
    });
    if (filterFloor === oldName) {
      setFilterFloor(newName);
    }
    dirtyStore.set(true);
  };

  const handleDeleteFloorGroup = async (floorName: string) => {
    if (isLocked) return;
    if (floorSections.length <= 1) {
      toast.error("At least one floor section is required.");
      return;
    }
    const spacesInFloor = drainageSpaces.filter(s => s.floor === floorName);
    const count = spacesInFloor.length;
    const msg = count > 0
      ? `Are you sure you want to delete floor section "${floorName}" and its ${count} space(s)?`
      : `Are you sure you want to delete floor section "${floorName}"?`;

    const ok = await confirm(msg, {
      title: "Delete Floor Section",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setFloorSections(prev => prev.filter(f => f !== floorName));
    setDrainageSpaces(prev => prev.filter(s => s.floor !== floorName));
    setFloorSystemTypes(prev => {
      const next = { ...prev };
      delete next[floorName];
      return next;
    });
    if (filterFloor === floorName) {
      setFilterFloor("all");
    }
    dirtyStore.set(true);
    toast.info(`Deleted floor section "${floorName}".`);
  };

  const handleFloorSystemTypeChange = (floorName: string, newType: "branch" | "stack_short" | "stack_tall" | "building_drain") => {
    if (isLocked) return;
    setFloorSystemTypes(prev => ({
      ...prev,
      [floorName]: newType,
    }));
    dirtyStore.set(true);
  };

  const getSpaceEditIds = (spaceId: string): string[] => {
    return selectedSpaceIds.includes(spaceId) && selectedSpaceIds.length > 1
      ? selectedSpaceIds
      : [spaceId];
  };

  const handleUpdateSpaceDesc = (spaceId: string, val: string) => {
    if (isLocked) return;
    const clean = val.trim();
    if (!clean) return;
    const targets = getSpaceEditIds(spaceId);
    setDrainageSpaces(prev =>
      prev.map(s => (targets.includes(s.id) ? { ...s, desc: clean } : s))
    );
    dirtyStore.set(true);
    if (targets.length > 1) {
      toast.success(`Updated description for ${targets.length} spaces`);
    }
  };

  const handleUpdateSpaceFixture = (spaceId: string, fixtureId: string, val: number) => {
    if (isLocked) return;
    const clean = Math.max(0, isNaN(val) ? 0 : val);
    const targets = getSpaceEditIds(spaceId);
    setDrainageSpaces(prev =>
      prev.map(s => {
        if (targets.includes(s.id)) {
          return {
            ...s,
            fixtures: {
              ...s.fixtures,
              [fixtureId]: clean,
            },
          };
        }
        return s;
      })
    );
    dirtyStore.set(true);
    if (targets.length > 1) {
      toast.success(`Updated fixture count for ${targets.length} spaces`);
    }
  };

  const handleUpdateSpaceMultiplier = (spaceId: string, field: "spaceQty" | "floorsQty", val: number) => {
    if (isLocked) return;
    const clean = Math.max(1, isNaN(val) ? 1 : val);
    const targets = getSpaceEditIds(spaceId);
    setDrainageSpaces(prev =>
      prev.map(s => (targets.includes(s.id) ? { ...s, [field]: clean } : s))
    );
    dirtyStore.set(true);
    if (targets.length > 1) {
      toast.success(`Updated ${field === "spaceQty" ? "Space Qty" : "Floors Qty"} for ${targets.length} spaces`);
    }
  };

  const handleDuplicateSpace = (space: DrainageSpaceItem) => {
    if (isLocked) return;
    const copy: DrainageSpaceItem = {
      ...space,
      id: `space-${Date.now()}`,
      desc: `${space.desc} (Copy)`,
      fixtures: { ...space.fixtures },
    };
    setDrainageSpaces(prev => [...prev, copy]);
    dirtyStore.set(true);
    toast.success("Duplicated space.");
  };

  const handleDeleteSpace = async (id: string) => {
    if (isLocked) return;
    if (drainageSpaces.length <= 1) {
      toast.error("Cannot delete all spaces. Keep at least one space in schedule.");
      return;
    }
    const target = drainageSpaces.find(s => s.id === id);
    const msg = `Are you sure you want to delete space "${target?.desc || "selected space"}"?`;

    const ok = await confirm(msg, {
      title: "Delete Space",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setDrainageSpaces(prev => prev.filter(s => s.id !== id));
    setSelectedSpaceIds(prev => prev.filter(sId => sId !== id));
    dirtyStore.set(true);
    toast.info("Space removed.");
  };

  const handleClearAllSchedule = async () => {
    if (isLocked) return;
    const ok = await confirm("Are you sure you want to clear all fixture quantities across the schedule?", {
      title: "Clear All Fixtures",
      confirmText: "Clear All",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setDrainageSpaces(prev =>
      prev.map(s => ({
        ...s,
        fixtures: {},
      }))
    );
    dirtyStore.set(true);
    toast.success("Cleared all fixture quantities across schedule.");
  };

  // Selection handlers
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSpaceIds(drainageSpaces.map(s => s.id));
      toast.info(`Selected all ${drainageSpaces.length} space(s)`);
    } else {
      setSelectedSpaceIds([]);
    }
  };

  const handleToggleSelectSpace = (id: string, explicitChecked?: boolean) => {
    setSelectedSpaceIds(prev => {
      const isCurrentlySelected = prev.includes(id);
      const shouldSelect = explicitChecked !== undefined ? explicitChecked : !isCurrentlySelected;
      if (shouldSelect) {
        return isCurrentlySelected ? prev : [...prev, id];
      } else {
        return prev.filter(sId => sId !== id);
      }
    });
  };

  // Undo / Redo Stacks
  const [undoStack, setUndoStack] = useState<DrainageSpaceItem[][]>([]);
  const [redoStack, setRedoStack] = useState<DrainageSpaceItem[][]>([]);

  const pushToUndo = (currentSpaces: DrainageSpaceItem[]) => {
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(currentSpaces))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (isLocked || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(drainageSpaces))]);
    setDrainageSpaces(previous);
    setUndoStack(prev => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (isLocked || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev.slice(-30), JSON.parse(JSON.stringify(drainageSpaces))]);
    setDrainageSpaces(next);
    setRedoStack(prev => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Redo successful");
  };

  const handleBulkDelete = async () => {
    if (isLocked || selectedSpaceIds.length === 0) return;
    if (selectedSpaceIds.length >= drainageSpaces.length) {
      toast.error("Cannot delete all spaces. Keep at least one space in schedule.");
      return;
    }
    const count = selectedSpaceIds.length;
    const msg = count === 1
      ? `Are you sure you want to delete space "${drainageSpaces.find(s => s.id === selectedSpaceIds[0])?.desc || "selected space"}"?`
      : `Are you sure you want to delete the ${count} selected space(s)?`;

    const ok = await confirm(msg, {
      title: "Delete Spaces",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "destructive"
    });
    if (!ok) return;

    pushToUndo(drainageSpaces);
    setDrainageSpaces(prev => prev.filter(s => !selectedSpaceIds.includes(s.id)));
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.info(`Deleted ${count} space(s)`);
  };

  const handleBulkDuplicate = () => {
    if (isLocked || selectedSpaceIds.length === 0) return;
    pushToUndo(drainageSpaces);
    const duplicates: DrainageSpaceItem[] = [];
    selectedSpaceIds.forEach(id => {
      const found = drainageSpaces.find(s => s.id === id);
      if (found) {
        duplicates.push({
          ...found,
          id: `space-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          desc: `${found.desc} (Copy)`,
          fixtures: { ...found.fixtures },
        });
      }
    });
    setDrainageSpaces(prev => [...prev, ...duplicates]);
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.success(`Duplicated ${duplicates.length} space(s).`);
  };

  // Clipboard Storage & Actions (Matching Ventilation & DataGrid Shortcuts)
  const [copiedDrainageSpaces, setCopiedDrainageSpaces] = useState<DrainageSpaceItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_drainage_spaces");
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return [];
  });

  const handleCopySpaces = (ids: string[]) => {
    const targets = drainageSpaces.filter(s => ids.includes(s.id));
    if (targets.length === 0) return;
    const cloned: DrainageSpaceItem[] = JSON.parse(JSON.stringify(targets));
    setCopiedDrainageSpaces(cloned);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mep_clipboard_drainage_spaces", JSON.stringify(cloned));
        const headers = ["Floor", "Space Description", ...DRAINAGE_FIXTURES_META.map(f => f.name), "Space Qty", "Floors Qty"];
        const rows = cloned.map(s => [
          s.floor,
          s.desc,
          ...DRAINAGE_FIXTURES_META.map(f => s.fixtures[f.id] || 0),
          s.spaceQty,
          s.floorsQty,
        ]);
        const tsv = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
        navigator.clipboard?.writeText(tsv).catch(() => { });
      } catch (e) { }
    }
    toast.info(`${targets.length} space(s) copied to clipboard`);
  };

  const handleCutSpaces = (ids: string[]) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const targets = drainageSpaces.filter(s => ids.includes(s.id));
    if (targets.length === 0) return;
    if (targets.length >= drainageSpaces.length) {
      toast.error("Cannot cut all spaces. Keep at least one space in schedule.");
      return;
    }
    pushToUndo(drainageSpaces);
    handleCopySpaces(ids);
    setDrainageSpaces(prev => prev.filter(s => !ids.includes(s.id)));
    setSelectedSpaceIds([]);
    dirtyStore.set(true);
    toast.info(`${targets.length} space(s) cut to clipboard`);
  };

  const handlePasteSpaces = () => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    let sourceSpaces = copiedDrainageSpaces;
    if (sourceSpaces.length === 0 && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_drainage_spaces");
        if (saved) sourceSpaces = JSON.parse(saved);
      } catch (e) { }
    }
    if (sourceSpaces.length === 0) {
      toast.info("Clipboard is empty. Copy or cut spaces first (Ctrl+C).");
      return;
    }

    pushToUndo(drainageSpaces);
    const currentFloor = filterFloor !== "all" ? filterFloor : (floorSections[0] || "TYPICAL FLOOR");
    const pasted: DrainageSpaceItem[] = sourceSpaces.map((s, idx) => ({
      ...s,
      id: `space-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
      floor: floorSections.includes(s.floor) ? s.floor : currentFloor,
      desc: `${s.desc.replace(/ \(Copy(-\d+)?\)$/, "")} (Copy)`,
      fixtures: { ...s.fixtures },
    }));

    setDrainageSpaces(prev => [...prev, ...pasted]);
    setSelectedSpaceIds(pasted.map(s => s.id));
    dirtyStore.set(true);
    toast.success(`${pasted.length} space(s) pasted from clipboard`);
  };

  // Keyboard Shortcuts Listener (Ctrl+A, Escape, Delete, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Deselect all selected spaces
      if (e.key === "Escape") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          setSelectedSpaceIds([]);
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const activeEl = document.activeElement;
      const isModalActive = Boolean(customModalOpen || showFormulaModal || showInspectorModal || isCommentModalOpen || editingSpace);

      // 1. Ctrl+A / Cmd+A (Select All Spaces) - should ALWAYS select all spaces in schedule when no modal is open
      if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
        if (!isModalActive) {
          e.preventDefault();
          if (activeEl && "blur" in activeEl) {
            (activeEl as HTMLElement).blur();
          }
          if (drainageSpaces.length > 0) {
            setSelectedSpaceIds(drainageSpaces.map(s => s.id));
            toast.info(`Selected all ${drainageSpaces.length} space(s) (Ctrl+A)`);
          }
          return;
        }
      }

      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      // 2. Undo / Redo: Ctrl+Z / Ctrl+Y
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // 3. Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // 4. Ctrl+C (Copy)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleCopySpaces(selectedSpaceIds);
        }
        return;
      }

      // 5. Ctrl+X (Cut)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleCutSpaces(selectedSpaceIds);
        }
        return;
      }

      // 6. Ctrl+V (Paste)
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteSpaces();
        return;
      }

      // 7. Ctrl+D (Duplicate)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedSpaceIds.length > 0) {
          e.preventDefault();
          handleBulkDuplicate();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    drainageSpaces,
    selectedSpaceIds,
    isLocked,
    copiedDrainageSpaces,
    floorSections,
    filterFloor,
    undoStack,
    redoStack,
    customModalOpen,
    showFormulaModal,
    showInspectorModal,
    isCommentModalOpen,
    editingSpace,
  ]);

  // Aggregate Calculations from Matrix Spaces
  const calcResults = useMemo(() => {
    // 1. Calculate space DFU subtotals and aggregated fixture totals
    const fixtureTotalCounts: Record<string, number> = {};
    DRAINAGE_FIXTURES_META.forEach(f => {
      fixtureTotalCounts[f.id] = 0;
    });

    let rawDfu = 0;
    let totalConnectedAppliances = 0;

    drainageSpaces.forEach(space => {
      const mult = (space.spaceQty || 1) * (space.floorsQty || 1);
      let spaceUnitDfu = 0;

      Object.entries(space.fixtures || {}).forEach(([fid, qty]) => {
        const meta = DRAINAGE_FIXTURES_META.find(f => f.id === fid);
        const count = Number(qty) || 0;
        if (meta && count > 0) {
          spaceUnitDfu += meta.dfu * count;
          fixtureTotalCounts[fid] = (fixtureTotalCounts[fid] || 0) + (count * mult);
          totalConnectedAppliances += count * mult;
        }
      });

      rawDfu += spaceUnitDfu * mult;
    });

    // 2. Factored Design DFU
    const designDfu = Math.ceil(rawDfu * (1 + safetyFactor / 100));

    // 3. Water Closet 3" NPS Rule Check
    const wcFlushCount = fixtureTotalCounts.wc_flush_valve || 0;
    const wcTankCount = fixtureTotalCounts.wc_tank || 0;
    const wcCount = wcFlushCount + wcTankCount;
    const hasWc = wcCount > 0;

    // 4. Pipe Sizing
    let sizedNps = 1.5;
    let sizedDn = 40;
    let maxAllowedDfu = 3;

    if (systemType === "branch") {
      const match = BRANCH_CAPACITY.find(b => b.maxDfu >= designDfu);
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        maxAllowedDfu = match.maxDfu;
      } else {
        const last = BRANCH_CAPACITY[BRANCH_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = last.maxDfu;
      }
      if (wcCount >= 1 && wcCount <= 2 && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = 20;
      } else if (wcCount > 2 && sizedNps < 4.0) {
        sizedNps = 4.0;
        sizedDn = 100;
        maxAllowedDfu = 160;
      }
    } else if (systemType === "stack_short" || systemType === "stack_tall") {
      const isShort = systemType === "stack_short";
      const match = STACK_CAPACITY.find(s => (isShort ? s.maxShort : s.maxTall) >= designDfu);
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        maxAllowedDfu = isShort ? match.maxShort : match.maxTall;
      } else {
        const last = STACK_CAPACITY[STACK_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = isShort ? last.maxShort : last.maxTall;
      }
      if (hasWc && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = isShort ? 48 : 72;
      }
    } else {
      // Building drain
      const match = BUILDING_DRAIN_CAPACITY.find(b => {
        let cap = b.s25;
        if (slope <= 0.0625) cap = b.s0625;
        else if (slope <= 0.125) cap = b.s125;
        else if (slope <= 0.25) cap = b.s25;
        else cap = b.s50;
        return cap >= designDfu && cap > 0;
      });
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        let cap = match.s25;
        if (slope <= 0.0625) cap = match.s0625;
        else if (slope <= 0.125) cap = match.s125;
        else if (slope <= 0.25) cap = match.s25;
        else cap = match.s50;
        maxAllowedDfu = cap;
      } else {
        const last = BUILDING_DRAIN_CAPACITY[BUILDING_DRAIN_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = slope <= 0.125 ? last.s125 : last.s25;
      }
      if (hasWc && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = slope <= 0.125 ? 36 : 42;
      }
    }

    // 5. Hydraulics & Manning's Equation for Gravity Flow
    const roughness = MATERIAL_ROUGHNESS[material]?.n || 0.009;
    const slopeDecimal = slope / 12.0;
    const dFeet = sizedNps / 12.0;
    const dMeters = (sizedNps * 25.4) / 1000.0;

    const rhFeet = dFeet / 4.0;
    const rhMeters = dMeters / 4.0;
    const areaHalfSqFt = (Math.PI * Math.pow(dFeet, 2)) / 8.0;

    const velocityFps = (1.486 / roughness) * Math.pow(rhFeet, 2 / 3) * Math.pow(slopeDecimal, 0.5);
    const velocityMps = (1.0 / roughness) * Math.pow(rhMeters, 2 / 3) * Math.pow(slopeDecimal, 0.5);

    const qCapCfs = velocityFps * areaHalfSqFt;
    const qCapGpm = qCapCfs * 448.831;
    const qCapLps = qCapGpm * 0.06309;

    // 6. Vent Sizing
    const vent = computeVentSize(sizedNps, designDfu, ventLength);

    // 7. Slope Text Display
    const slopeInPerFt = slope;
    const slopeMmPerM = slope * 83.333;
    const slopePercent = (slope / 12.0) * 100;

    // 8. Breakdown Percentages by Category
    const sanitaryDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "sanitary").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);
    const kitchenDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "kitchen").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);
    const laundryDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "laundry").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);
    const specialDfu = DRAINAGE_FIXTURES_META.filter(f => f.category === "special").reduce((sum, f) => sum + f.dfu * (fixtureTotalCounts[f.id] || 0), 0);

    const breakdown = [
      { id: "sanitary", name: "WCs, Lavs & Urinals", dfu: sanitaryDfu, color: "#2563EB", pct: rawDfu > 0 ? (sanitaryDfu / rawDfu) * 100 : 0 },
      { id: "kitchen", name: "Kitchen & Scullery", dfu: kitchenDfu, color: "#F59E0B", pct: rawDfu > 0 ? (kitchenDfu / rawDfu) * 100 : 0 },
      { id: "laundry", name: "Laundry Standpipes", dfu: laundryDfu, color: "#10B981", pct: rawDfu > 0 ? (laundryDfu / rawDfu) * 100 : 0 },
      { id: "special", name: "Floor Drains & Janitor", dfu: specialDfu, color: "#8B5CF6", pct: rawDfu > 0 ? (specialDfu / rawDfu) * 100 : 0 },
    ];

    // Fixture list format for report and compatibility
    const aggregatedFixtures: FixtureRowItem[] = DRAINAGE_FIXTURES_META.map(f => ({
      id: f.id,
      name: f.name,
      category: f.category,
      dfu: f.dfu,
      val: fixtureTotalCounts[f.id] || 0,
      minTrapSizeInches: f.minTrapSizeInches,
      notes: f.notes,
    }));

    return {
      rawDfu,
      totalCount: totalConnectedAppliances,
      designDfu,
      sizedNps,
      sizedDn,
      maxAllowedDfu,
      capacityUtilization: maxAllowedDfu > 0 ? (designDfu / maxAllowedDfu) * 100 : 0,
      velocityFps: parseFloat(velocityFps.toFixed(2)),
      velocityMps: parseFloat(velocityMps.toFixed(2)),
      isScourVelocityOk: velocityFps >= 2.0,
      qCapGpm: Math.round(qCapGpm),
      qCapLps: parseFloat(qCapLps.toFixed(1)),
      ventNps: vent.size,
      ventDn: vent.dn,
      slopeInPerFt,
      slopeMmPerM: parseFloat(slopeMmPerM.toFixed(1)),
      slopePercent: parseFloat(slopePercent.toFixed(2)),
      roughness,
      materialName: MATERIAL_ROUGHNESS[material]?.name || "PVC DWV",
      hasWc,
      wcCount,
      breakdown,
      fixtureTotalCounts,
      aggregatedFixtures,
    };
  }, [drainageSpaces, systemType, slope, material, safetyFactor, ventLength]);

  // Per-Floor Drainage Sizing Calculations
  const floorSizing = useMemo(() => {
    const res: Record<string, {
      rawDfu: number;
      designDfu: number;
      wcCount: number;
      sizedNps: number;
      sizedDn: number;
      maxAllowedDfu: number;
      systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
    }> = {};

    floorSections.forEach(fl => {
      const flSpaces = drainageSpaces.filter(s => (s.floor || floorSections[0]) === fl);
      let rawDfu = 0;
      let wcCount = 0;

      flSpaces.forEach(space => {
        const mult = (space.spaceQty || 1) * (space.floorsQty || 1);
        DRAINAGE_FIXTURES_META.forEach(f => {
          const count = space.fixtures[f.id] || 0;
          if (count > 0) {
            rawDfu += f.dfu * count * mult;
            if (f.id === "wc_flush_valve" || f.id === "wc_tank") {
              wcCount += count * mult;
            }
          }
        });
      });

      const designDfu = Math.ceil(rawDfu * (1 + safetyFactor / 100));
      const flSysType = floorSystemTypes[fl] || systemType || "branch";
      const hasWc = wcCount > 0;

      let sizedNps = 1.5;
      let sizedDn = 40;
      let maxAllowedDfu = 3;

      if (flSysType === "branch") {
        const match = BRANCH_CAPACITY.find(b => b.maxDfu >= designDfu);
        if (match) {
          sizedNps = match.size;
          sizedDn = match.dn;
          maxAllowedDfu = match.maxDfu;
        } else {
          const last = BRANCH_CAPACITY[BRANCH_CAPACITY.length - 1];
          sizedNps = last.size;
          sizedDn = last.dn;
          maxAllowedDfu = last.maxDfu;
        }
        if (wcCount >= 1 && wcCount <= 2 && sizedNps < 3.0) {
          sizedNps = 3.0;
          sizedDn = 80;
          maxAllowedDfu = 20;
        } else if (wcCount > 2 && sizedNps < 4.0) {
          sizedNps = 4.0;
          sizedDn = 100;
          maxAllowedDfu = 160;
        }
      } else if (flSysType === "stack_short" || flSysType === "stack_tall") {
        const isShort = flSysType === "stack_short";
        const match = STACK_CAPACITY.find(s => (isShort ? s.maxShort : s.maxTall) >= designDfu);
        if (match) {
          sizedNps = match.size;
          sizedDn = match.dn;
          maxAllowedDfu = isShort ? match.maxShort : match.maxTall;
        } else {
          const last = STACK_CAPACITY[STACK_CAPACITY.length - 1];
          sizedNps = last.size;
          sizedDn = last.dn;
          maxAllowedDfu = isShort ? last.maxShort : last.maxTall;
        }
        if (hasWc && sizedNps < 3.0) {
          sizedNps = 3.0;
          sizedDn = 80;
          maxAllowedDfu = isShort ? 48 : 72;
        }
      } else {
        // Building drain
        const match = BUILDING_DRAIN_CAPACITY.find(b => {
          let cap = b.s25;
          if (slope <= 0.0625) cap = b.s0625;
          else if (slope <= 0.125) cap = b.s125;
          else if (slope <= 0.25) cap = b.s25;
          else cap = b.s50;
          return cap >= designDfu && cap > 0;
        });
        if (match) {
          sizedNps = match.size;
          sizedDn = match.dn;
          let cap = match.s25;
          if (slope <= 0.0625) cap = match.s0625;
          else if (slope <= 0.125) cap = match.s125;
          else if (slope <= 0.25) cap = match.s25;
          else cap = match.s50;
          maxAllowedDfu = cap;
        } else {
          const last = BUILDING_DRAIN_CAPACITY[BUILDING_DRAIN_CAPACITY.length - 1];
          sizedNps = last.size;
          sizedDn = last.dn;
          maxAllowedDfu = slope <= 0.125 ? last.s125 : last.s25;
        }
        if (hasWc && sizedNps < 3.0) {
          sizedNps = 3.0;
          sizedDn = 80;
          maxAllowedDfu = slope <= 0.125 ? 36 : 42;
        }
      }

      const capacityUtilization = maxAllowedDfu > 0 ? (designDfu / maxAllowedDfu) * 100 : 0;

      res[fl] = {
        rawDfu,
        designDfu,
        wcCount,
        sizedNps,
        sizedDn,
        maxAllowedDfu,
        capacityUtilization,
        systemType: flSysType,
      };
    });

    return res;
  }, [floorSections, drainageSpaces, safetyFactor, floorSystemTypes, systemType, slope]);

  // Handle Right-Click Context Actions
  const handleCopyField = (name: string, value: any) => {
    toast.success(`Copied ${name}: ${value}`);
  };

  // Group spaces by floor for rendering
  const filteredFloorsGrouped = useMemo(() => {
    let filtered = drainageSpaces || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => s.desc.toLowerCase().includes(q) || s.floor.toLowerCase().includes(q));
    }

    if (filterFloor !== "all") {
      filtered = filtered.filter(s => s.floor === filterFloor);
    }

    const grouped: Record<string, DrainageSpaceItem[]> = {};
    const validFloors = floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null");
    validFloors.forEach(fl => {
      grouped[fl] = [];
    });
    filtered.forEach(s => {
      const fl = (s.floor && s.floor !== "undefined" && s.floor !== "null") ? s.floor : (validFloors[0] || "TYPICAL FLOOR");
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [drainageSpaces, floorSections, searchQuery, filterFloor]);

  // PDF Export
  const handleExportPdf = () => {
    try {
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-DRN-01";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Sanitary Drainage System";
      const clientName = project?.client || "General Contracting Co.";
      const locationRoom = activeRoom?.name || "Main Building Sanitary Drainage";

      // 1. Header Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Drainage Pipe & Stack Sizing Calculation Report", 14, 13);

      // 2. Metadata Block
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17);
      doc.line(105, 16, 105, 33);
      doc.line(14, 21.7, 196, 21.7);
      doc.line(14, 27.4, 196, 27.4);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 31.6);

      doc.setFont("helvetica", "bold");
      doc.text("End User / Location:", 107, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(locationRoom, 142, 31.6);

      // Connected Sanitary Fixture Schedule
      const activeFixtures = calcResults.aggregatedFixtures.filter(f => f.val > 0);
      const fixtureRows = activeFixtures.map((f, idx) => [
        String(idx + 1),
        f.name,
        `${f.dfu} DFU`,
        String(f.val),
        `${f.dfu * f.val} DFU`,
        calcResults.rawDfu > 0 ? `${((f.dfu * f.val / calcResults.rawDfu) * 100).toFixed(1)}%` : "0%",
        `${f.minTrapSizeInches}" NPS`,
      ]);

      fixtureRows.push([
        { content: "TOTAL", colSpan: 2, styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } } as any,
        { content: "-", styles: { halign: "center", fillColor: [218, 233, 248] } },
        { content: String(calcResults.totalCount), styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } },
        { content: `${calcResults.rawDfu} DFU`, styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } },
        { content: "100%", styles: { fontStyle: "bold", halign: "center", fillColor: [218, 233, 248] } },
        { content: `Design: ${calcResults.designDfu} DFU`, styles: { fontStyle: "bold", fillColor: [218, 233, 248] } },
      ]);

      callAutoTable(doc, {
        startY: 37,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { font: "helvetica", fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 } },
        headStyles: { fillColor: [217, 217, 217], textColor: [0, 0, 0], fontStyle: "bold" },
        head: [["No.", "Connected Sanitary Fixture", "Unit DFU", "Qty", "Total DFU", "Share", "Min Trap"]],
        body: fixtureRows,
        columnStyles: {
          0: { cellWidth: 10, halign: "center" },
          1: { cellWidth: 70 },
          2: { cellWidth: 20, halign: "center" },
          3: { cellWidth: 15, halign: "center", fontStyle: "bold" },
          4: { cellWidth: 25, halign: "center", fontStyle: "bold" },
          5: { cellWidth: 18, halign: "center" },
          6: { cellWidth: 24, halign: "center" },
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 185;

      // 3-Tier Signature Block
      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails(project?.id || "default", "/plumbing-drainage", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: finalY + 5,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: { font: "helvetica", fontSize: 8, cellPadding: { top: 2.5, bottom: 2.5, left: 2.5, right: 2.5 } },
        headStyles: { fillColor: [255, 230, 204], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
        head: [["", "Originator", "Reviewer", "Approver"]],
        body: [
          [{ content: "Name:", styles: { fontStyle: "bold", halign: "right" } }, { content: originatedName || "Abubakar Chanda", styles: { halign: "center" } }, { content: reviewerName || "-", styles: { halign: "center" } }, { content: approverName || "-", styles: { halign: "center" } }],
          [{ content: "Date:", styles: { fontStyle: "bold", halign: "right" } }, { content: originatedDate || today, styles: { halign: "center" } }, { content: reviewerDate || "-", styles: { halign: "center" } }, { content: approverDate || "-", styles: { halign: "center" } }],
        ],
        columnStyles: {
          0: { cellWidth: 25, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 52, halign: "center" },
          2: { cellWidth: 52, halign: "center" },
          3: { cellWidth: 53, halign: "center" },
        },
      });

      doc.save(`Drainage_Pipe_Sizing_${projectNo}.pdf`);
      toast.success("Drainage calculation PDF report exported successfully!");
    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err?.message || "Failed to generate PDF export.");
    }
  };

  const allSpacesSelected = selectedSpaceIds.length === drainageSpaces.length && drainageSpaces.length > 0;

  return (
    <AppShell title="Drainage Pipe Sizing" onIntelClick={() => setIntelOpen(v => !v)} intelOpen={intelOpen} hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-2.5 overflow-hidden h-full animate-in fade-in-50 duration-200">

          {/* Top Stationary Header Block */}
          <div className="shrink-0 flex flex-col gap-2.5 pb-1">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 select-none">
              <div className="flex flex-col gap-1 max-w-2xl">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground mt-0.5">Drainage Pipe Sizing</h1>
                  <button
                    onClick={() => setIntelOpen(v => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                      }`}
                  >
                    <Sparkles className="size-3.5" />
                    <span>Intelligence</span>
                  </button>
                  <CalculationReviewBar
                    projectId={project?.id || "default"}
                    calculatorPath="/plumbing-drainage"
                    calculatorTitle="Drainage Pipe Sizing"
                    onReviewStateChange={setCalcReviewState}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Subheader Navigation Bar & Main Card Container */}
          <div className={`flex-1 min-h-0 flex flex-col rounded-2xl transition-all duration-300 overflow-hidden ${isApprovedLocked || calcReviewState?.status === "APPROVED"
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                  <button
                    onClick={() => setActiveTab("calculator")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "calculator"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Drainage Sizer
                  </button>
                  <button
                    onClick={() => setActiveTab("report")}
                    className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report"
                      ? "bg-background text-foreground shadow-sm font-bold"
                      : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    Report
                  </button>
                </div>



                <button
                  type="button"
                  onClick={() => setShowFormulaModal(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View IPC / UPC Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>

                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

                {/* Drainage Application Preset Dropdown */}
                <DrainagePresetSelect
                  value={selectedPreset}
                  customProfileName={customProfileName}
                  onChange={handleApplyPreset}
                  onOpenCustomModal={() => setCustomModalOpen(true)}
                  unitSystem={unitSystem}
                  disabled={isEffectiveReadOnly}
                />
              </div>

              {/* Right Side Controls */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPdf}>
                  <FileText className="size-3.5" /> Export
                </TBtn>

                <UnitToggle
                  unitSystem={unitSystem}
                  onChange={handleUnitSystemChange}
                  disabled={isEffectiveReadOnly}
                  inputDescriptions="Drainage DFU, Pipe Diameters (NPS / mm DN), Slope (in/ft / mm/m), Manning Flow (GPM / L/s)"
                  conversionExample={
                    unitSystem === "ip"
                      ? "Convert 1/4 in/ft → 20.8 mm/m, 4 inch NPS → 100 mm DN, 50 GPM → 3.15 L/s"
                      : "Convert 20.8 mm/m → 1/4 in/ft, 100 mm DN → 4 inch NPS, 3.15 L/s → 50 GPM"
                  }
                />
              </div>
            </div>

            {/* Active Tab View */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {activeTab === "report" ? (
                /* PRINTABLE REPORT PREVIEW TAB */
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
                  <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-8 space-y-6">

                    <div className="flex justify-between items-start pb-4 border-b border-border">
                      <div>
                        <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                          Drainage Pipe & Stack Sizing Calculation Report
                        </h2>
                        <p className="text-[12px] text-muted-foreground mt-0.5">
                          IPC Chapter 7, UPC Chapter 7 & Gravity Sanitary Drainage Hydraulic Analysis
                        </p>
                      </div>
                    </div>


                    {/* Table 1: Design Parameters & Hydraulic Sizing Criteria */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        1. Design Parameters & Hydraulic Sizing Criteria
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Design Parameter Description</th>
                            <th className="border border-border p-2 text-center w-28">Value</th>
                            <th className="border border-border p-2 text-center w-20">Unit</th>
                            <th className="border border-border p-2 text-left">Standard / Code Reference</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">Total Connected Fixture Units (Raw DFU)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.rawDfu}</td>
                            <td className="border border-border p-2 text-center">DFU</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Table 709.1 Sanitary Drainage Load</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">Total Design Load (+Safety Margin)</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.designDfu}</td>
                            <td className="border border-border p-2 text-center">DFU</td>
                            <td className="border border-border p-2 text-muted-foreground">Includes +{safetyFactor}% Engineering Safety Allowance</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">Drainage Segment / System Type</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {systemType === "branch"
                                ? "Horizontal Branch"
                                : systemType === "stack_short"
                                  ? "Stack (≤ 3 Intervals)"
                                  : systemType === "stack_tall"
                                    ? "Stack (> 3 Intervals)"
                                    : "Building Drain / Sewer"}
                            </td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Chapter 7 System Classification</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">Piping Installation Slope / Fall</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? calcResults.slopeMmPerM : calcResults.slopeInPerFt}
                            </td>
                            <td className="border border-border p-2 text-center">{isSI ? "mm/m" : "in/ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">{calcResults.slopePercent}% Gradient / Fall</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">Piping Material Specification</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.materialName}</td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">Manning Roughness Coefficient n = {calcResults.roughness}</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">6</td>
                            <td className="border border-border p-2 font-bold">Active Vent Pipe Developed Length</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? (ventLength * 0.3048).toFixed(1) : ventLength.toFixed(0)}
                            </td>
                            <td className="border border-border p-2 text-center">{isSI ? "m" : "ft"}</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC Table 906.1 Developed Vent Distance</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">7</td>
                            <td className="border border-border p-2 font-bold">Total Fixture Quantity</td>
                            <td className="border border-border p-2 text-center font-bold">{calcResults.totalCount}</td>
                            <td className="border border-border p-2 text-center">units</td>
                            <td className="border border-border p-2 text-muted-foreground">Connected Sanitary Appliances Count</td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">8</td>
                            <td className="border border-border p-2 font-bold">Water Closets Connected (WC Rule)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {calcResults.hasWc ? `Yes (${calcResults.wcCount} WCs)` : "No"}
                            </td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-muted-foreground">IPC 709.2 Minimum 3" NPS Rule for Water Closets</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 2: Hydraulic Sizing Output Summary */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        2. Hydraulic Sizing Output Summary (IPC / UPC Standard)
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="font-bold">
                          <tr>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-center w-12">Item</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Sizing Output Summary (IPC / UPC 7)</th>
                            <th className="bg-[#DAE9F8] dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 border border-border p-2 text-center w-48">Calculated Result</th>
                            <th className="bg-[#D9D9D9] dark:bg-zinc-800 border border-border p-2 text-left">Engineering Basis & Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">A</td>
                            <td className="border border-border p-2">REQUIRED DRAINAGE PIPE DIAMETER (D)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI ? `${calcResults.sizedDn} mm DN` : `${calcResults.sizedNps}" NPS`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">
                              IPC Table 710.1 (Max Capacity: {calcResults.maxAllowedDfu} DFU)
                            </td>
                          </tr>
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">B</td>
                            <td className="border border-border p-2">DRAINAGE CAPACITY UTILIZATION</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {calcResults.capacityUtilization.toFixed(1)} %
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">
                              {calcResults.designDfu} DFU Design Load / {calcResults.maxAllowedDfu} DFU Max Limit
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">C</td>
                            <td className="border border-border p-2 font-bold">Self-Cleansing Scour Velocity (v)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.velocityMps.toFixed(2)} m/s` : `${calcResults.velocityFps.toFixed(2)} ft/s`}
                            </td>
                            <td className="border border-border p-2 text-emerald-600 dark:text-emerald-400 font-medium">
                              {calcResults.isScourVelocityOk
                                ? "Compliant (≥ 2.0 ft/s / 0.6 m/s Self-Scouring per IPC 704.1)"
                                : "Below 2.0 ft/s (Low Velocity Warning)"}
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">D</td>
                            <td className="border border-border p-2 font-bold">Half-Full Gravity Discharge Capacity (Q_cap)</td>
                            <td className="border border-border p-2 text-center font-bold">
                              {isSI ? `${calcResults.qCapLps.toFixed(1)} L/s` : `${calcResults.qCapGpm} GPM`}
                            </td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Manning Equation Gravity Flow Capacity @ 50% Pipe Depth
                            </td>
                          </tr>
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold">
                            <td className="border border-border p-2 text-center">E</td>
                            <td className="border border-border p-2">REQUIRED VENT PIPE DIAMETER (D_vent)</td>
                            <td className="border border-border p-2 text-center text-primary font-black">
                              {isSI ? `${calcResults.ventDn} mm DN` : `${calcResults.ventNps}" NPS`}
                            </td>
                            <td className="border border-border p-2 font-medium text-muted-foreground">
                              IPC Table 906.1 Vent Sizing for {calcResults.designDfu} DFU & {isSI ? (ventLength * 0.3048).toFixed(1) + " m" : ventLength + " ft"} Max Length
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 3: Connected Sanitary Fixture Schedule */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        3. Connected Sanitary Fixture Schedule
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left">Sanitary Fixture</th>
                            <th className="border border-border p-2 text-center w-24">Unit DFU</th>
                            <th className="border border-border p-2 text-center w-20">Qty</th>
                            <th className="border border-border p-2 text-center w-28">Total DFU</th>
                            <th className="border border-border p-2 text-center w-20">Share</th>
                            <th className="border border-border p-2 text-left">Min Trap Size</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calcResults.aggregatedFixtures.filter(f => f.val > 0).map((f, i) => (
                            <tr key={f.id}>
                              <td className="border border-border p-2 text-center text-muted-foreground">{i + 1}</td>
                              <td className="border border-border p-2 font-bold">{f.name}</td>
                              <td className="border border-border p-2 text-center">{f.dfu} DFU</td>
                              <td className="border border-border p-2 text-center font-bold">{f.val}</td>
                              <td className="border border-border p-2 text-center font-bold text-primary">{f.dfu * f.val} DFU</td>
                              <td className="border border-border p-2 text-center text-muted-foreground">
                                {calcResults.rawDfu > 0 ? ((f.dfu * f.val / calcResults.rawDfu) * 100).toFixed(1) : 0}%
                              </td>
                              <td className="border border-border p-2 text-muted-foreground">
                                {f.minTrapSizeInches}" NPS ({Math.round(f.minTrapSizeInches * 25.4)} mm)
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-[#DAE9F8]/60 dark:bg-sky-950/40 font-bold border-t-2 border-border">
                            <td className="border border-border p-2 text-center" colSpan={2}>TOTAL CONNECTED FIXTURES</td>
                            <td className="border border-border p-2 text-center">-</td>
                            <td className="border border-border p-2 text-center font-black">{calcResults.totalCount}</td>
                            <td className="border border-border p-2 text-center font-black text-primary">{calcResults.rawDfu} DFU</td>
                            <td className="border border-border p-2 text-center">100%</td>
                            <td className="border border-border p-2 text-muted-foreground">Design Load: {calcResults.designDfu} DFU</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Table 4: Mandatory Design Standards */}
                    <div className="space-y-2">
                      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
                        4. Mandatory Design Standards & Engineering Guidelines
                      </h3>
                      <table className="w-full text-[12px] border-collapse border border-border">
                        <thead className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold">
                          <tr>
                            <th className="border border-border p-2 text-center w-12">No.</th>
                            <th className="border border-border p-2 text-left w-56">Mandatory Design Standard</th>
                            <th className="border border-border p-2 text-left">Compliance & Engineering Criteria</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">1</td>
                            <td className="border border-border p-2 font-bold">IPC Table 710.1 Pipe Sizing Limits</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Sanitary drainage branch, stack, and building drain sizing shall not exceed maximum fixture unit limits established in IPC Chapter 7.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">2</td>
                            <td className="border border-border p-2 font-bold">IPC 704.1 Self-Scouring Velocity</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Drainage piping shall be installed at a slope that produces a self-cleansing scour velocity of not less than 2.0 ft/s (0.61 m/s) to prevent solids sedimentation.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">3</td>
                            <td className="border border-border p-2 font-bold">IPC 709.2 Water Closet Minimum Size</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Any horizontal drainage branch or vertical stack serving one or more water closets shall be sized at a minimum of 3.0 inches NPS (80 mm DN).
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">4</td>
                            <td className="border border-border p-2 font-bold">IPC Chapter 9 Venting System Sizing</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Vent piping diameter and developed length shall comply with IPC Table 906.1 to ensure adequate air circulation and prevent trap seal siphonage.
                            </td>
                          </tr>
                          <tr>
                            <td className="border border-border p-2 text-center text-muted-foreground">5</td>
                            <td className="border border-border p-2 font-bold">UPC Table 702.1 Fixture Units</td>
                            <td className="border border-border p-2 text-muted-foreground">
                              Fixture unit ratings assigned reflect intermittent peak discharge loading for gravity drainage systems under uniform plumbing standards.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                </div>
              ) : (
                /* Interactive Calculator Mode - Direct Ventilation-Style Full Height Table */
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                  {/* Top Toolbar Bar (Matching Ventilation UI) */}
                  <div className="px-4 py-2.5 bg-card border-b border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 shrink-0 select-none relative min-h-[46px]">

                    {/* Search & Floor Filter */}
                    <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                      <div className="relative flex-1 max-w-xs">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={e => setSearchQuery(e.target.value)}
                          placeholder="Filter spaces..."
                          className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-2 border border-border text-xs outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                        />
                        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                      </div>

                      {floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null").length > 1 && (
                        <select
                          value={filterFloor}
                          onChange={e => setFilterFloor(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-surface-2 border border-border text-xs font-semibold outline-none cursor-pointer text-foreground"
                        >
                          <option value="all">All Floors ({floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null").length})</option>
                          {floorSections.filter(fl => fl && fl !== "undefined" && fl !== "null").map(fl => (
                            <option key={fl} value={fl}>{fl}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0 justify-end w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={handleAddNewFloorSection}
                        disabled={isLocked}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                      >
                        <Plus className="size-3.5" /> Add Floor Section
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddSpace()}
                        disabled={isLocked}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                      >
                        <Plus className="size-3.5" /> Add Space
                      </button>
                    </div>

                    {/* Bulk Actions Bar Overlay (Exact Ventilation Matching Design) */}
                    {!isApprovedLocked && selectedSpaceIds.length > 0 && (
                      <div className="absolute inset-0 flex items-center gap-4 px-4 bg-[#f0f7ff] dark:bg-blue-950/50 text-[12px] text-[#06456F] dark:text-blue-300 z-20 border-b border-border/80 animate-in fade-in duration-100 flex-wrap select-none">
                        <span className="font-bold text-[#06456F] dark:text-blue-300">
                          {selectedSpaceIds.length} selected
                        </span>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            const sp = drainageSpaces.find(s => s.id === selectedSpaceIds[0]);
                            if (sp) setEditingSpace({ space: sp, floor: sp.floor });
                          }}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Edit3 className="size-3.5" /> Bulk edit
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySpaces(selectedSpaceIds)}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer"
                        >
                          <Copy className="size-3.5" /> Copy
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleCutSpaces(selectedSpaceIds)}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Scissors className="size-3.5" /> Cut
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={handlePasteSpaces}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ClipboardPaste className="size-3.5" /> Paste
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={handleBulkDuplicate}
                          className="inline-flex items-center gap-1.5 font-semibold text-[#06456F] dark:text-blue-200 hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Copy className="size-3.5" /> Duplicate
                        </button>

                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={handleBulkDelete}
                          className="inline-flex items-center gap-1.5 font-semibold text-rose-600 hover:text-rose-700 transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="size-3.5" /> Delete
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedSpaceIds([])}
                          className="ml-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors px-2 py-0.5 rounded cursor-pointer"
                        >
                          <X className="size-3" /> Clear
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Schedule Matrix Table Container - Fits screen perfectly without horizontal scrollbar */}
                  <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto w-full custom-scrollbar select-none">
                    <table className="w-full border-collapse text-[11px] font-sans">
                      <thead className="bg-slate-50 dark:bg-slate-900/80 sticky top-0 z-20 border-b border-border text-muted-foreground uppercase text-[10.5px] tracking-wider font-bold">
                        <tr>
                          <th className="p-1 text-center w-8 min-w-[32px] max-w-[34px] border-r border-border/60">
                            <input
                              type="checkbox"
                              checked={allSpacesSelected}
                              onChange={e => handleToggleSelectAll(e.target.checked)}
                              title="Select all spaces (Ctrl+A)"
                              className="size-3.5 accent-primary cursor-pointer rounded"
                            />
                          </th>
                          <th className="p-1.5 px-2 text-left min-w-[130px] border-r border-border/60 whitespace-nowrap">
                            Space / Area Name
                          </th>
                          {DRAINAGE_FIXTURES_META.map(f => (
                            <th key={f.id} className="p-1 px-0.5 text-center border-r border-border/40 min-w-[36px]">
                              <div className="truncate text-[10px] leading-tight font-semibold" title={f.name}>{f.short}</div>
                              <div className="text-[9px] font-mono text-primary/80 lowercase leading-tight">{f.dfu} dfu</div>
                            </th>
                          ))}
                          <th className="p-1.5 px-1.5 text-center text-primary font-bold min-w-[56px] whitespace-nowrap">
                            Total DFU
                          </th>
                        </tr>
                      </thead>

                      {floorSections.filter(fl => fl && fl.toLowerCase() !== "undefined" && fl.toLowerCase() !== "null").map((floor, floorIndex) => {
                        const spacesInFloor = filteredFloorsGrouped[floor] || [];
                        if (filterFloor !== "all" && filterFloor !== floor) return null;

                        return (
                          <tbody key={`floor-tbody-${floorIndex}`} className="divide-y divide-border/60 border-b border-border">
                            {/* Floor Section Header */}
                            <tr id={`floor-section-${floor}`} className="bg-muted/40 font-bold text-[11px] text-foreground">
                              <td colSpan={DRAINAGE_FIXTURES_META.length + 3} className="py-1.5 px-3">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <ChevronDown className="size-3.5 text-primary shrink-0" />
                                    <FloorNameInput
                                      floor={floor}
                                      disabled={isLocked}
                                      onRename={handleRenameFloorGroup}
                                    />
                                    <span className="text-[10px] text-muted-foreground font-normal">
                                      ({spacesInFloor.length} spaces)
                                    </span>
                                  </div>

                                  {/* Individual Floor Drainage Segment / System Type Dropdown & Sizing Pill */}
                                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                                    <span className="text-[10.5px] font-semibold text-muted-foreground hidden sm:inline">Segment Type:</span>
                                    <select
                                      value={floorSystemTypes[floor] || systemType || "branch"}
                                      disabled={isLocked}
                                      onChange={e => handleFloorSystemTypeChange(floor, e.target.value as any)}
                                      className="text-[11px] font-semibold bg-background border border-input rounded-lg px-2 py-0.5 outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer disabled:opacity-60 shadow-2xs text-foreground max-w-[240px] sm:max-w-none truncate"
                                    >
                                      <option value="branch">Horizontal Fixture Branch (IPC Table 710.1(2))</option>
                                      <option value="stack_short">Vertical Stack ≤ 3 Stories (IPC Table 710.1(1))</option>
                                      <option value="stack_tall">Multi-Story Stack &gt; 3 Stories (IPC Table 710.1(1))</option>
                                      <option value="building_drain">Building Drain / Main Sewer Collector</option>
                                    </select>

                                    {floorSizing[floor] && (
                                      <div
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 text-[10px] font-bold shadow-2xs shrink-0"
                                        title={`Floor Sized Pipe: ${isSI ? `${floorSizing[floor].sizedDn} mm DN` : `${floorSizing[floor].sizedNps}" NPS`} for ${floorSizing[floor].designDfu} DFU`}
                                      >
                                        <span>{isSI ? `${floorSizing[floor].sizedDn} mm DN` : `${floorSizing[floor].sizedNps}" NPS`}</span>
                                        <span className="text-[9px] font-medium opacity-80">({floorSizing[floor].designDfu} DFU)</span>
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => handleAddSpace(floor)}
                                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:bg-primary/10 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                      title={`Add space to ${floor}`}
                                    >
                                      <Plus className="size-3" /> Space
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isLocked}
                                      onClick={() => handleDeleteFloorGroup(floor)}
                                      className="text-rose-500 hover:text-rose-700 text-[10px] font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/20 px-2 py-0.5 rounded cursor-pointer transition-colors"
                                    >
                                      Delete Floor
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>

                            {/* Space Rows */}
                            {spacesInFloor.map((space, idx) => {
                              const isSelected = selectedSpaceIds.includes(space.id);
                              let spaceUnitDfu = 0;
                              DRAINAGE_FIXTURES_META.forEach(f => {
                                spaceUnitDfu += f.dfu * (space.fixtures[f.id] || 0);
                              });
                              const mult = (space.spaceQty || 1) * (space.floorsQty || 1);
                              const spaceTotalDfu = spaceUnitDfu * mult;

                              return (
                                <ContextMenu key={space.id}>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      id={`space-row-${space.id}`}
                                      data-row-id={space.id}
                                      data-space-id={space.id}
                                      data-item-id={space.id}
                                      data-comment-target={space.id}
                                      title="Click to select, Ctrl+Click to multi-select, Double-click to edit, Ctrl+A to select all"
                                      onClick={(e) => {
                                        const target = e.target as HTMLElement;
                                        if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("button") || target.closest("input")) {
                                          return;
                                        }
                                        handleToggleSelectSpace(space.id);
                                      }}
                                      onDoubleClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        setEditingSpace({ space, floor });
                                      }}
                                      className={`border-b border-border/60 hover:bg-primary/5 transition-all duration-200 cursor-pointer ${highlightedSpaceId === space.id
                                        ? "row-highlight-flash item-highlight-pulse ring-2 ring-primary bg-primary/25 z-20 relative font-bold"
                                        : isSelected
                                          ? "bg-primary/10"
                                          : idx % 2 === 1
                                            ? "bg-muted/15"
                                            : "bg-card"
                                        }`}
                                    >
                                      <td className="p-1 text-center w-8 min-w-[32px] max-w-[34px]" onDoubleClick={e => e.stopPropagation()}>
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={e => handleToggleSelectSpace(space.id, e.target.checked)}
                                          className="size-3.5 accent-primary cursor-pointer rounded"
                                        />
                                      </td>

                                      <td className="p-1 px-2 font-medium text-foreground min-w-[130px]">
                                        <div className="flex items-center justify-between gap-1 w-full">
                                          <InlineInput
                                            disabled={isLocked}
                                            value={space.desc}
                                            onCommit={val => handleUpdateSpaceDesc(space.id, val)}
                                            className="font-medium text-xs text-foreground px-1 py-0.5 w-full min-w-0"
                                            placeholder="Space / Area Description"
                                          />
                                          {(() => {
                                            const spaceComments = getSpaceComments(space);
                                            if (spaceComments.length === 0) return null;
                                            return (
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenComment(space.id, space.desc);
                                                }}
                                                className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9.5px] font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer shrink-0"
                                                title={`${spaceComments.length} comment(s) / task(s)`}
                                              >
                                                <MessageSquare className="size-2.5 text-blue-500" />
                                                <span>{spaceComments.length}</span>
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </td>

                                      {/* Fixture Quantities */}
                                      {DRAINAGE_FIXTURES_META.map(f => {
                                        const count = space.fixtures[f.id] || 0;
                                        return (
                                          <td key={f.id} className="p-0.5 text-center border-r border-border/30 min-w-[36px]">
                                            <InlineInput
                                              type="number"
                                              min={0}
                                              disabled={isLocked}
                                              value={count === 0 ? "" : count}
                                              placeholder="0"
                                              onCommit={val => handleUpdateSpaceFixture(space.id, f.id, parseInt(val) || 0)}
                                              className={`w-7 sm:w-8 h-6 text-center rounded py-0 text-xs font-mono font-semibold transition-colors mx-auto ${count > 0 ? "bg-primary/10 text-primary font-bold border border-primary/30" : "bg-transparent text-muted-foreground/50 border border-transparent hover:border-border/60"
                                                }`}
                                            />
                                          </td>
                                        );
                                      })}

                                      {/* Total DFU */}
                                      <td className="p-1 px-1.5 text-center font-mono font-bold text-primary whitespace-nowrap text-xs min-w-[56px]">
                                        {spaceTotalDfu.toFixed(1)}
                                      </td>
                                    </tr>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-xs z-50">
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        setEditingSpace({ space, floor });
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Edit3 className="size-3.5 text-muted-foreground" />
                                      <span>Edit Space Quantities</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double-click</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      onClick={() => handleCopySpaces([space.id])}
                                      className="flex items-center gap-2 p-1.5 font-medium cursor-pointer"
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      <span>Copy Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        handleCutSpaces([space.id]);
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Scissors className="size-3.5 text-muted-foreground" />
                                      <span>Cut Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={handlePasteSpaces}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <ClipboardPaste className="size-3.5 text-muted-foreground" />
                                      <span>Paste Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        handleDuplicateSpace(space);
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      <span>Duplicate Space</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator className="h-px bg-border my-1" />
                                    <ContextMenuItem onClick={() => handleOpenComment(space.id, space.desc)} className="flex items-center gap-2 p-1.5 cursor-pointer text-blue-600 font-medium">
                                      <MessageSquare className="size-3.5" />
                                      <span>{getSpaceComments(space).length > 0 ? `Comments / Tasks (${getSpaceComments(space).length})` : "Add Comment / Task"}</span>
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                      disabled={isLocked}
                                      onClick={() => {
                                        if (isLocked) {
                                          toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                                          return;
                                        }
                                        if (selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1) {
                                          handleBulkDelete();
                                        } else {
                                          handleDeleteSpace(space.id);
                                        }
                                      }}
                                      className={`flex items-center gap-2 p-1.5 font-medium ${isLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer text-rose-600"}`}
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{selectedSpaceIds.includes(space.id) && selectedSpaceIds.length > 1 ? `Delete Selected (${selectedSpaceIds.length} spaces)` : "Delete Space"}</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Del</ContextMenuShortcut>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })}
                          </tbody>
                        );
                      })}
                    </table>
                  </div>

                  {/* Bottom Status & Summary Bar (Matching Ventilation UI) */}
                  <div className="px-4 py-2 bg-card border-t border-border flex items-center justify-between text-xs text-muted-foreground shrink-0 select-none flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span>Showing <strong className="text-foreground">{drainageSpaces.length}</strong> of <strong className="text-foreground">{drainageSpaces.length}</strong> spaces</span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-[11px] flex-wrap">
                      <span>Total Fixtures: <strong className="text-foreground">{calcResults.totalCount}</strong></span>
                      <span className="text-border">|</span>
                      <span>Design DFU: <strong className="text-primary font-bold">{calcResults.designDfu} DFU</strong></span>
                      <span className="text-border">|</span>
                      <span>Main Sized Pipe: <strong className="text-foreground">{isSI ? `${calcResults.sizedDn} mm DN` : `${calcResults.sizedNps}" NPS`}</strong></span>
                      <span className="text-border">|</span>
                      <span>Velocity: <strong className={calcResults.isScourVelocityOk ? "text-emerald-600 font-bold" : "text-amber-600 font-bold"}>{isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} fps`}</strong></span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Intelligence drawer */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-card shadow-lg flex flex-col" : "w-0"
            }`}
        >
          {intelOpen && (
            <DrainageIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calcResults={calcResults}
              drainageSpaces={drainageSpaces}
              floorSections={floorSections}
              floorSystemTypes={floorSystemTypes}
              floorSizing={floorSizing}
              systemType={systemType}
              slope={slope}
              material={material}
              ventLength={ventLength}
              unitSystem={unitSystem}
              selectedPreset={selectedPreset}
              isLocked={isLocked}
              onSelectPreset={handleApplyPreset}
              onSetSlope={(sl) => {
                if (isLocked) {
                  toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                  return;
                }
                setSlope(sl);
                dirtyStore.set(true);
              }}
              onSetFormulaModal={setShowFormulaModal}
              onSetInspectorModal={setShowInspectorModal}
              onScrollToSpace={(spaceId) => {
                const el = document.getElementById(`space-row-${spaceId}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "center" });
                  el.classList.add("bg-primary/25");
                  setTimeout(() => el.classList.remove("bg-primary/25"), 2000);
                }
              }}
              onScrollToFloor={(floorName) => {
                const el = document.getElementById(`floor-section-${floorName}`);
                if (el) {
                  el.scrollIntoView({ behavior: "smooth", block: "start" });
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Edit Space Modal (Triggered on Space Double-Click) */}
      {editingSpace && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="size-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Edit Space Fixture Schedule</h3>
                  <p className="text-xs text-muted-foreground">Configure plumbing fixtures and multiplier counts for this space</p>
                </div>
              </div>
              <button
                onClick={() => setEditingSpace(null)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Space Name and Floor Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Space / Room Name</label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={editingSpace.space.desc}
                  onChange={e => {
                    const val = e.target.value;
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, desc: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-semibold text-foreground text-xs disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Floor Section</label>
                <select
                  disabled={isLocked}
                  value={editingSpace.space.floor}
                  onChange={e => {
                    const val = e.target.value;
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, floor: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-semibold text-foreground text-xs cursor-pointer disabled:opacity-60"
                >
                  {floorSections.map(fl => (
                    <option key={fl} value={fl}>{fl}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Multipliers */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Space Typical Quantity</label>
                <input
                  type="number"
                  min={1}
                  disabled={isLocked}
                  value={editingSpace.space.spaceQty}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, spaceQty: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-bold text-foreground text-xs disabled:opacity-60"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-muted-foreground">Number of Typical Floors</label>
                <input
                  type="number"
                  min={1}
                  disabled={isLocked}
                  value={editingSpace.space.floorsQty}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value) || 1);
                    setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, floorsQty: val } } : null);
                  }}
                  className="w-full bg-background border border-input rounded-xl p-2 font-bold text-foreground text-xs disabled:opacity-60"
                />
              </div>
            </div>

            {/* Fixture Counters List */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex justify-between items-center text-xs font-semibold text-muted-foreground">
                <span>Sanitary Fixtures</span>
                <span>Total DFU</span>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {DRAINAGE_FIXTURES_META.map(f => {
                  const count = editingSpace.space.fixtures[f.id] || 0;
                  return (
                    <div key={f.id} className="flex items-center justify-between p-2.5 rounded-xl border border-border/70 bg-surface-2">
                      <div className="flex-1 pr-2">
                        <div className="font-semibold text-xs text-foreground">{f.name}</div>
                        <div className="text-[10px] text-muted-foreground">Unit: {f.dfu} DFU • Trap: {f.minTrapSizeInches}" NPS</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center border border-border rounded-lg bg-background p-0.5">
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const newVal = Math.max(0, count - 1);
                              setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, fixtures: { ...prev.space.fixtures, [f.id]: newVal } } } : null);
                            }}
                            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                          >
                            <Minus className="size-3" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            disabled={isLocked}
                            value={count}
                            onChange={e => {
                              const newVal = Math.max(0, parseInt(e.target.value) || 0);
                              setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, fixtures: { ...prev.space.fixtures, [f.id]: newVal } } } : null);
                            }}
                            className="w-10 text-center text-xs font-bold bg-transparent outline-none disabled:opacity-60"
                          />
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() => {
                              const newVal = count + 1;
                              setEditingSpace(prev => prev ? { ...prev, space: { ...prev.space, fixtures: { ...prev.space.fixtures, [f.id]: newVal } } } : null);
                            }}
                            className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-40"
                          >
                            <Plus className="size-3" />
                          </button>
                        </div>
                        <div className="w-14 text-right text-xs font-bold text-primary">
                          {(count * f.dfu).toFixed(1)} DFU
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setEditingSpace(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => {
                  if (isLocked) {
                    toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
                    return;
                  }
                  if (editingSpace) {
                    setDrainageSpaces(prev => prev.map(s => s.id === editingSpace.space.id ? editingSpace.space : s));
                    dirtyStore.set(true);
                    toast.success(`Updated space "${editingSpace.space.desc}"`);
                  }
                  setEditingSpace(null);
                }}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm hover:bg-primary/90 cursor-pointer disabled:opacity-50"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspector & Engineering Verification Modal (Triggered on Double-Clicking Section 3 or Category Breakdown) */}
      {showInspectorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-3xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                <div>
                  <h3 className="text-base font-bold text-foreground">Engineering Verification & Load Breakdown Analysis</h3>
                  <p className="text-xs text-muted-foreground">Comprehensive IPC 2021 Table 710.1 & Manning partial gravity flow verification</p>
                </div>
              </div>
              <button
                onClick={() => setShowInspectorModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Top 4 KPI Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 select-none">
              {/* Pipe Size Card */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Required Pipe Size</span>
                  <div className="p-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Cylinder className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">
                    {isSI ? `${calcResults.sizedDn} mm` : `${calcResults.sizedNps}"`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {isSI ? `(${calcResults.sizedNps}" NPS)` : `(${calcResults.sizedDn} mm DN)`}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> IPC 710.1 Compliant
                </div>
              </div>

              {/* Total Design Load */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Design Load</span>
                  <div className="p-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Layers className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">{calcResults.designDfu}</span>
                  <span className="text-[11px] font-semibold text-muted-foreground">DFU</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Raw: {calcResults.rawDfu} DFU (+{safetyFactor}% margin)
                </div>
              </div>

              {/* Minimum Slope */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Minimum Slope</span>
                  <div className="p-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <SlidersHorizontal className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">
                    {isSI ? `${calcResults.slopeMmPerM}` : `${calcResults.slopeInPerFt}"`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{isSI ? "mm/m" : "in/ft"}</span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  Grade: {calcResults.slopePercent}% slope
                </div>
              </div>

              {/* Scour Velocity */}
              <div className="bg-surface-2 text-card-foreground border border-border rounded-xl p-3.5 shadow-2xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Scour Flow Velocity</span>
                  <div className="p-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <Waves className="size-3.5" />
                  </div>
                </div>
                <div className="mt-1.5 flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-foreground">
                    {isSI ? `${calcResults.velocityMps}` : `${calcResults.velocityFps}`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{isSI ? "m/s" : "ft/s"}</span>
                </div>
                <div className="mt-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Self-Cleansing Scour Ok
                </div>
              </div>
            </div>

            {/* 1. Capacity Utilization & Code Verification */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pipe Capacity Utilization</span>
                <span className="text-xs font-bold text-primary">{calcResults.capacityUtilization.toFixed(1)}% Utilized</span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, calcResults.capacityUtilization)}%` }}
                  className={`h-full ${calcResults.capacityUtilization > 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1 text-center text-xs">
                <div className="p-2 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Factored Design Load</div>
                  <div className="text-sm font-black text-primary">{calcResults.designDfu} DFU</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Max Permitted Load</div>
                  <div className="text-sm font-black text-foreground">{calcResults.maxAllowedDfu} DFU</div>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Chosen Diameter</div>
                  <div className="text-sm font-black text-emerald-600">{isSI ? `${calcResults.sizedDn} mm` : `${calcResults.sizedNps}" NPS`}</div>
                </div>
              </div>
            </div>

            {/* 2. Hydraulics & Manning Partial Gravity Flow */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Hydraulic Flow & Scour Verification (Manning Eq.)</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Manning Roughness (n)</div>
                  <div className="font-bold text-foreground">{calcResults.roughness}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Installation Slope</div>
                  <div className="font-bold text-foreground">{calcResults.slopePercent}% grade</div>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Scour Flow Velocity</div>
                  <div className={`font-bold ${calcResults.isScourVelocityOk ? "text-emerald-600" : "text-amber-600"}`}>
                    {isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} ft/s`}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-background border border-border/60">
                  <div className="text-muted-foreground text-[10px]">Gravity Flow (Q_cap)</div>
                  <div className="font-bold text-primary">{isSI ? `${calcResults.qCapLps} L/s` : `${calcResults.qCapGpm} GPM`}</div>
                </div>
              </div>
            </div>

            {/* 3. Category Load Contribution Breakdown */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-3 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">Sanitary Fixture Category Shares</h4>
              <div className="h-3.5 w-full bg-muted rounded-full overflow-hidden flex">
                {calcResults.breakdown.map(item => (
                  <div
                    key={item.id}
                    style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                    className="h-full"
                  />
                ))}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                {calcResults.breakdown.map(item => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="size-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                    <div>
                      <div className="font-semibold text-foreground">{item.name}</div>
                      <div className="text-muted-foreground text-[11px]">{item.dfu} DFU ({item.pct.toFixed(1)}%)</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Venting Sizing Criteria */}
            <div className="p-4 rounded-xl border border-border bg-surface-2 space-y-2 text-xs">
              <h4 className="font-bold text-foreground uppercase tracking-wider text-[11px]">IPC Table 906.1 Vent Sizing Compliance</h4>
              <div className="flex justify-between items-center text-xs p-2 rounded-lg bg-background border border-border/60">
                <span>Required Vent Pipe Diameter for {isSI ? (ventLength * 0.3048).toFixed(1) + " m" : ventLength + " ft"} Run:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">{isSI ? `${calcResults.ventDn} mm DN` : `${calcResults.ventNps}" NPS`}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowInspectorModal(false)}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Formula & Engineering Modal */}
      {showFormulaModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 select-none">
          <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="size-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Plumbing Drainage Sizing Engineering Equations</h3>
              </div>
              <button
                onClick={() => setShowFormulaModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs leading-relaxed text-foreground">
              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">1. Drainage Fixture Unit (DFU) Method (IPC Chapter 7)</div>
                <p className="text-muted-foreground">
                  Drainage systems are sized probabilistically using Drainage Fixture Units (DFUs). The total design load is:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"Design DFU = Total Connected Raw DFU × (1 + Safety Margin % / 100)"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">2. Manning's Equation for Gravity Partial Flow</div>
                <p className="text-muted-foreground">
                  The velocity and gravity flow capacity for partially filled drainage pipes are determined using Manning's formula:
                </p>
                <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                  {"Imperial: V = (1.486 / n) × Rh^(2/3) × S^(1/2)   [ft/s]"}
                  <br />
                  {"Metric:   V = (1.0 / n) × Rh^(2/3) × S^(1/2)     [m/s]"}
                </div>
              </div>

              <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                <div className="font-bold text-primary">3. Self-Cleansing Scour Velocity Requirement</div>
                <p className="text-muted-foreground">
                  To prevent sanitary solids settling and pipe blockages, a minimum scour velocity of <strong>2.0 ft/s (0.60 m/s)</strong> is enforced by plumbing standards (IPC Table 704.1 & ASPE).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Drainage Config Modal */}
      <CustomDrainageConfigModal
        isOpen={customModalOpen}
        onClose={() => setCustomModalOpen(false)}
        unitSystem={unitSystem}
        currentValues={{
          systemType,
          slope,
          material,
          safetyFactor,
          ventLength,
          fixtures: calcResults.aggregatedFixtures,
          customProfileName,
          customWorkflow,
        }}
        onApply={handleApplyCustomConfig}
      />

      {/* Assign Comment Modal */}
      {isCommentModalOpen && commentTargetItem && (
        <AssignCommentModal
          isOpen={isCommentModalOpen}
          onClose={() => {
            setIsCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
          targetId={commentTargetItem.id}
          targetName={commentTargetItem.name}
          targetType="space"
          calculatorTitle="Drainage Pipe Sizing"
          calculatorPath="/plumbing-drainage"
          existingComments={commentTargetItem ? getSpaceComments({ id: commentTargetItem.id, desc: commentTargetItem.name } as any) : []}
          onSave={(comment) => {
            const enrichedComment = {
              ...comment,
              calculatorTitle: "Drainage Pipe Sizing",
              calculatorPath: "/plumbing-drainage",
              targetId: commentTargetItem.id,
              targetName: commentTargetItem.name,
              targetType: "space",
              projectId: project?.id || "default",
              projectName: project?.name || "MEP Calculator Project",
            };

            setDrainageSpaces(prev =>
              prev.map(s => {
                if (s.id === commentTargetItem.id || s.desc.trim().toLowerCase() === commentTargetItem.name.trim().toLowerCase()) {
                  const existing = Array.isArray(s.comments) ? s.comments : [];
                  return { ...s, comments: [enrichedComment, ...existing] };
                }
                return s;
              })
            );

            setCommentsList(prev => [enrichedComment, ...prev]);
            const storageKey = `mep_calc_comments_${project?.id || "default"}_/plumbing-drainage`;
            try {
              const existing = JSON.parse(localStorage.getItem(storageKey) || "[]");
              localStorage.setItem(storageKey, JSON.stringify([enrichedComment, ...existing]));
            } catch (e) { }

            try {
              if (project?.id) {
                const wdata = project.workspace_data || {};
                const existingComments = Array.isArray(wdata.drainage_calc_comments) ? wdata.drainage_calc_comments : [];
                const updatedWdata = {
                  ...wdata,
                  drainage_calc_comments: [enrichedComment, ...existingComments]
                };
                workspaceStore.updateProject({ ...project, workspace_data: updatedWdata });
              }
            } catch (e) {
              console.error("Failed to update workspaceStore project comments", e);
            }

            dirtyStore.set(true);
            setIsCommentModalOpen(false);
            setCommentTargetItem(null);
          }}
        />
      )}
    </AppShell>
  );
}

interface DrainageIntelligenceDrawerProps {
  onClose: () => void;
  calcResults: any;
  drainageSpaces: DrainageSpaceItem[];
  floorSections: string[];
  floorSystemTypes: Record<string, "branch" | "stack_short" | "stack_tall" | "building_drain">;
  floorSizing: Record<string, any>;
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
  slope: number;
  material: "pvc" | "cast_iron" | "hdpe" | "copper";
  ventLength: number;
  unitSystem: "ip" | "si";
  selectedPreset: DrainagePresetKey;
  isLocked?: boolean;
  onSelectPreset: (presetKey: DrainagePresetKey) => void;
  onSetSlope: (slope: number) => void;
  onSetFormulaModal: (open: boolean) => void;
  onSetInspectorModal: (open: boolean) => void;
  onScrollToSpace: (spaceId: string) => void;
  onScrollToFloor: (floorName: string) => void;
}

function DrainageIntelligenceDrawer({
  onClose,
  calcResults,
  drainageSpaces,
  floorSections,
  floorSystemTypes,
  floorSizing,
  systemType,
  slope,
  material,
  ventLength,
  unitSystem,
  selectedPreset,
  isLocked,
  onSelectPreset,
  onSetSlope,
  onSetFormulaModal,
  onSetInspectorModal,
  onScrollToSpace,
  onScrollToFloor,
}: DrainageIntelligenceDrawerProps) {
  const isSI = unitSystem === "si";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    compliance: true,
    floors: true,
    fixtures: false,
    diagnostics: true,
    actions: false,
    standards: false,
  });

  const toggleSection = (sec: string) => {
    setOpenSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Compliance calculations
  const isVelocityOk = Boolean(calcResults?.isScourVelocityOk);
  const isUtilizationOk = (calcResults?.capacityUtilization ?? 0) <= 100;
  const isWcOk = !calcResults?.hasWc || (calcResults?.sizedNps ?? 0) >= 3;
  const isVentOk = (calcResults?.ventNps ?? 0) > 0;

  const checks = [isVelocityOk, isUtilizationOk, isWcOk, isVentOk];
  const passedCount = checks.filter(Boolean).length;
  const complianceScore = Math.round((passedCount / checks.length) * 100);

  // Missing data and diagnostics
  const zeroFixtureSpaces = useMemo(() => {
    return (drainageSpaces || []).filter(s => {
      const sum = Object.values(s.fixtures || {}).reduce((a, b) => a + (Number(b) || 0), 0);
      return sum === 0;
    });
  }, [drainageSpaces]);

  const highMultiplierSpaces = useMemo(() => {
    return (drainageSpaces || []).filter(s => (s.spaceQty || 1) * (s.floorsQty || 1) >= 10);
  }, [drainageSpaces]);

  // Active fixtures sorted by DFU
  const activeFixturesSorted = useMemo(() => {
    return [...(calcResults?.aggregatedFixtures || [])]
      .filter((f: any) => f && f.val > 0)
      .sort((a: any, b: any) => (b.dfu * b.val) - (a.dfu * a.val));
  }, [calcResults?.aggregatedFixtures]);

  return (
    <div className="h-full flex flex-col bg-card select-none text-xs w-[360px]">
      {/* Header */}
      <div className="p-3.5 border-b border-border flex items-center justify-between bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h3 className="font-bold text-foreground text-[13.5px] leading-tight">Drainage Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">IPC / UPC & ASPE Compliance Engine</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Intelligence"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {/* Overall Health & Score Card */}
        <div className="p-3 rounded-xl bg-surface-2 border border-border/80 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Code Compliance Status
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10.5px] font-black ${complianceScore === 100
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                }`}
            >
              {complianceScore}% Compliant
            </span>
          </div>

          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${complianceScore === 100 ? "bg-emerald-500" : "bg-amber-500"
                }`}
              style={{ width: `${complianceScore}%` }}
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-1 text-center">
            <div className="p-1.5 rounded-lg bg-card border border-border/50">
              <div className="text-[10px] text-muted-foreground">Spaces</div>
              <div className="font-bold text-foreground text-xs">{(drainageSpaces || []).length}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-card border border-border/50">
              <div className="text-[10px] text-muted-foreground">Fixtures</div>
              <div className="font-bold text-foreground text-xs">{calcResults?.totalCount ?? 0}</div>
            </div>
            <div className="p-1.5 rounded-lg bg-card border border-border/50">
              <div className="text-[10px] text-muted-foreground">Design DFU</div>
              <div className="font-bold text-primary text-xs">{calcResults?.designDfu ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Section 1: Live Code & Hydraulic Checks */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("compliance")}
            className="w-full p-2.5 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Hydraulic & Code Audit</span>
            </div>
            {openSections.compliance ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {openSections.compliance && (
            <div className="p-2.5 space-y-2 bg-background border-t border-border/40">
              {/* Check 1: Scouring Velocity */}
              <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11.5px] text-foreground flex items-center gap-1.5">
                    {isVelocityOk ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                    )}
                    Self-Cleansing Scour Velocity
                  </span>
                  <span className={`font-mono font-bold text-[11px] ${isVelocityOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {isSI ? `${(calcResults?.velocityMps ?? 0).toFixed(2)} m/s` : `${(calcResults?.velocityFps ?? 0).toFixed(2)} ft/s`}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  IPC 704.1 requires min 2.0 ft/s (0.60 m/s) to prevent sanitary solids sedimentation.
                </p>
                {!isVelocityOk && (
                  <button
                    onClick={() => {
                      onSetSlope(0.25);
                      toast.success("Slope updated to 1/4 in/ft (2.08%) to achieve scouring velocity.");
                    }}
                    className="mt-1 w-full py-1 px-2 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10.5px] font-bold transition-colors cursor-pointer text-center"
                  >
                    Auto-Fix: Increase Slope to 1/4" (2%)
                  </button>
                )}
              </div>

              {/* Check 2: Pipe Capacity Utilization */}
              <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11.5px] text-foreground flex items-center gap-1.5">
                    {isUtilizationOk ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <ShieldAlert className="size-3.5 text-destructive shrink-0" />
                    )}
                    Pipe Capacity Utilization
                  </span>
                  <span className="font-mono font-bold text-[11px] text-primary">
                    {(calcResults?.capacityUtilization ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>Sized: <strong>{isSI ? `${calcResults?.sizedDn ?? 40} mm DN` : `${calcResults?.sizedNps ?? 1.5}" NPS`}</strong></span>
                  <span>Limit: <strong>{calcResults?.maxAllowedDfu ?? 0} DFU max</strong></span>
                </div>
              </div>

              {/* Check 3: Water Closet 3" NPS Rule */}
              <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11.5px] text-foreground flex items-center gap-1.5">
                    {isWcOk ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                    )}
                    Water Closet Clearance
                  </span>
                  <span className="text-[10.5px] font-bold text-muted-foreground">
                    {calcResults?.hasWc ? `${calcResults?.wcCount ?? 0} WCs` : "None"}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  IPC 709.2 requires minimum 3" NPS (75/80 mm DN) for drainage lines receiving water closet discharge.
                </p>
              </div>

              {/* Check 4: Vent Stack Sizing */}
              <div className="p-2 rounded-lg bg-muted/20 border border-border/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[11.5px] text-foreground flex items-center gap-1.5">
                    {isVentOk ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
                    )}
                    Vent Pipe Sizing
                  </span>
                  <span className="font-mono font-bold text-[11px] text-primary">
                    {isSI ? `${calcResults?.ventDn ?? 0} mm DN` : `${calcResults?.ventNps ?? 0}" NPS`}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground flex justify-between">
                  <span>Dev. Length: <strong>{isSI ? `${(ventLength * 0.3048).toFixed(1)} m` : `${ventLength} ft`}</strong></span>
                  <span>IPC Table 906.1</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Floor Hierarchy & Contribution */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("floors")}
            className="w-full p-2.5 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <Layers className="size-3.5 text-blue-500" />
              <span>Floor Hierarchy ({(floorSections || []).length})</span>
            </div>
            {openSections.floors ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {openSections.floors && (
            <div className="p-2 space-y-1.5 bg-background border-t border-border/40">
              {(floorSections || []).map((floor) => {
                const sizing = floorSizing?.[floor];
                const fDfu = sizing?.designDfu || 0;
                const totalDesignDfu = calcResults?.designDfu || 0;
                const share = totalDesignDfu > 0 ? Math.round((fDfu / totalDesignDfu) * 100) : 0;
                const segType = floorSystemTypes?.[floor] || systemType || "branch";
                const segLabel = segType === "branch" ? "Branch" : segType === "stack_short" ? "Stack ≤3 Fl" : segType === "stack_tall" ? "Stack >3 Fl" : "Building Drain";
                const capUtil = sizing?.capacityUtilization ?? (sizing?.maxAllowedDfu ? (sizing.designDfu / sizing.maxAllowedDfu) * 100 : 0);

                return (
                  <div
                    key={floor}
                    onClick={() => onScrollToFloor(floor)}
                    className="p-2 rounded-lg bg-surface-2 hover:bg-muted/60 transition-colors border border-border/50 cursor-pointer flex items-center justify-between text-[11px]"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1 pr-2">
                      <div className="font-bold text-foreground truncate flex items-center gap-1.5">
                        <span className="truncate">{floor}</span>
                        <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-primary/10 text-primary shrink-0">
                          {segLabel}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {fDfu} DFU ({share}% total load)
                      </div>
                    </div>
                    {sizing && (
                      <div className="text-right shrink-0">
                        <div className="font-mono font-bold text-primary text-[11px]">
                          {isSI ? `${sizing.sizedDn} mm` : `${sizing.sizedNps}"`}
                        </div>
                        <div className="text-[9px] text-muted-foreground font-mono">
                          {(capUtil || 0).toFixed(0)}% cap
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Section 3: Fixture Distribution */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("fixtures")}
            className="w-full p-2.5 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <Droplets className="size-3.5 text-cyan-500" />
              <span>Active Fixtures ({activeFixturesSorted.length})</span>
            </div>
            {openSections.fixtures ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {openSections.fixtures && (
            <div className="p-2 space-y-1.5 bg-background border-t border-border/40">
              {activeFixturesSorted.length === 0 ? (
                <div className="text-[11px] text-muted-foreground p-2 text-center">No fixtures connected yet.</div>
              ) : (
                activeFixturesSorted.map((f: any) => {
                  const totalDfu = f.dfu * f.val;
                  const totalRawDfu = calcResults?.rawDfu || 0;
                  const share = totalRawDfu > 0 ? Math.round((totalDfu / totalRawDfu) * 100) : 0;
                  return (
                    <div key={f.id} className="p-2 rounded-lg bg-surface-2 border border-border/50 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground truncate pr-2">{f.name}</span>
                        <span className="font-mono font-bold text-primary shrink-0">{totalDfu} DFU</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>{f.val} units × {f.dfu} dfu</span>
                        <span>{share}% load (Trap: {f.minTrapSizeInches}")</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Section 4: Diagnostics & Missing Data */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("diagnostics")}
            className="w-full p-2.5 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-3.5 text-amber-500" />
              <span>Diagnostics & Alerts ({zeroFixtureSpaces.length + (slope < 0.125 ? 1 : 0)})</span>
            </div>
            {openSections.diagnostics ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {openSections.diagnostics && (
            <div className="p-2 space-y-1.5 bg-background border-t border-border/40">
              {zeroFixtureSpaces.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Info className="size-3" />
                    <span>{zeroFixtureSpaces.length} Space(s) with 0 Fixtures:</span>
                  </div>
                  <div className="space-y-1 max-h-28 overflow-y-auto custom-scrollbar">
                    {zeroFixtureSpaces.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => onScrollToSpace(s.id)}
                        className="w-full text-left p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-foreground text-[10.5px] transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <span className="truncate pr-1">{s.desc} ({s.floor})</span>
                        <span className="text-[9px] font-bold text-primary shrink-0">Click to Edit →</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {highMultiplierSpaces.length > 0 && (
                <div className="p-1.5 rounded bg-muted/30 border border-border/50 text-[10.5px] text-muted-foreground">
                  <strong className="text-foreground">{highMultiplierSpaces.length} space(s)</strong> have a high total multiplier (≥ 10×).
                </div>
              )}

              {slope < 0.125 && (
                <div className="p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-[10.5px] text-amber-700 dark:text-amber-300">
                  <strong>Low Slope Alert:</strong> Slope is set to {slope} in/ft (&lt; 1%). Standard IPC mandates min 1/8" (1%) or 1/4" (2%) for small pipes.
                </div>
              )}

              {zeroFixtureSpaces.length === 0 && slope >= 0.125 && highMultiplierSpaces.length === 0 && (
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 p-2 text-center font-medium flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> All spaces configured cleanly.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Section 5: Quick Optimization Actions */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("actions")}
            className="w-full p-2.5 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>Smart Actions & Tools</span>
            </div>
            {openSections.actions ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {openSections.actions && (
            <div className="p-2.5 space-y-2 bg-background border-t border-border/40">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Slope Preset</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "1/8\" (1%)", val: 0.125 },
                    { label: "1/4\" (2%)", val: 0.25 },
                    { label: "1/2\" (4%)", val: 0.5 },
                  ].map((sl) => (
                    <button
                      key={sl.val}
                      type="button"
                      onClick={() => {
                        onSetSlope(sl.val);
                        toast.success(`Slope set to ${sl.label}`);
                      }}
                      className={`py-1 text-[10.5px] font-bold rounded border cursor-pointer transition-colors ${slope === sl.val
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-surface-2 text-foreground border-border/60 hover:bg-muted"
                        }`}
                    >
                      {sl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-1 flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => onSetFormulaModal(true)}
                  className="w-full py-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-surface-2 text-foreground font-semibold text-[11px] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="size-3.5 text-primary" /> View Formulas & Manning Math
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                </button>

                <button
                  type="button"
                  onClick={() => onSetInspectorModal(true)}
                  className="w-full py-1.5 px-2.5 rounded-lg border border-border bg-card hover:bg-surface-2 text-foreground font-semibold text-[11px] flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <Maximize2 className="size-3.5 text-primary" /> System Inspector Modal
                  </span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Section 6: Standard Citations & Code Basis */}
        <div className="border border-border/80 rounded-xl overflow-hidden shadow-2xs">
          <button
            onClick={() => toggleSection("standards")}
            className="w-full p-2.5 bg-muted/30 hover:bg-muted/50 flex items-center justify-between font-bold text-foreground transition-colors cursor-pointer text-xs"
          >
            <div className="flex items-center gap-2">
              <FileText className="size-3.5 text-muted-foreground" />
              <span>Standards & Code Citations</span>
            </div>
            {openSections.standards ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          </button>
          {openSections.standards && (
            <div className="p-2.5 space-y-2 bg-background border-t border-border/40 text-[10.5px] text-muted-foreground leading-relaxed">
              <div className="p-2 rounded bg-muted/20 border border-border/40 space-y-1">
                <strong className="text-foreground">IPC Table 710.1(1) & (2)</strong>
                <p>Governs max allowable DFUs for horizontal fixture branches, vertical sanitary stacks, and building drains.</p>
              </div>
              <div className="p-2 rounded bg-muted/20 border border-border/40 space-y-1">
                <strong className="text-foreground">IPC Table 709.1 & 709.2</strong>
                <p>Prescribes Fixture Unit values and minimum trap diameters for residential and commercial plumbing appliances.</p>
              </div>
              <div className="p-2 rounded bg-muted/20 border border-border/40 space-y-1">
                <strong className="text-foreground">IPC Table 906.1</strong>
                <p>Determines minimum vent stack diameters based on connected DFU load and total developed length.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
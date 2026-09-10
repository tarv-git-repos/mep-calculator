import { 
  LayoutDashboard, 
  FolderKanban, 
  Wind, 
  Zap, 
  Droplets, 
  Wrench, 
  FileBarChart, 
  Trash2, 
  Cog,
  Users,
  Box
} from "lucide-react";

export type NavLeaf = { label: string; to?: string; badge?: string; isHeader?: boolean };
export type NavItem =
  | { kind: "item"; label: string; to?: string; icon: any }
  | { kind: "group"; label: string; icon: any; children: NavLeaf[]; defaultOpen?: boolean };

export const NAV: NavItem[] = [
  { kind: "item", label: "Dashboard", to: "/", icon: LayoutDashboard },
  { kind: "item", label: "Projects", to: "/projects", icon: FolderKanban },
  { kind: "item", label: "3D Studio", to: "/bim-viewer", icon: Box },
  {
    kind: "group", label: "HVAC", icon: Wind, defaultOpen: true,
    children: [
      { label: "CONCEPT DESIGN", isHeader: true },
      { label: "Preliminary Cooling Load", to: "/preliminary-cooling-load" },
      { label: "HYDRONIC SYSTEM", isHeader: true },
      { label: "CHW Pipe Sizer", to: "/chw-pipe-sizer" },
      { label: "CHW Pump Head", to: "/chw-pump-head" },
      { label: "LOAD & VENTILATION", isHeader: true },
      { label: "VENTILATION", to: "/ventilation" },
      { label: "Fresh Air Cooling Load", to: "/fresh-air-cooling-load" },
      { label: "Condensate Drain Calc", to: "/condensate-drain-calc" },
      { label: "Heating Load", to: "/heating-load" },
      { label: "SMOKE", isHeader: true },
      { label: "Lobby Pressurisation", to: "/lobby-pressurisation" },
      { label: "Staircase Pressurization", to: "/staircase-pressurization" },
      { label: "Smoke Extract Fan", to: "/smoke-extract-fan" },
      { label: "Basement Smoke Calc", to: "/basement-smoke-calc" },
      { label: "AIR DISTRIBUTION", isHeader: true },
      { label: "Duct Sizer", to: "/duct-sizer" },
      { label: "Diffuser Selector", to: "/diffuser-selector" },
      { label: "REFRIGERATION & MISC", isHeader: true },
      { label: "Refrigerant Pipe Sizing", to: "/refrigerant-pipe-sizing" },
      { label: "Condensate Drain", to: "/condensate-drain" },
      { label: "DESIGN ASSISTANT", isHeader: true },
      { label: "Sanity Check Tool", to: "/sanity-check-tool" },
      { label: "PSYCHROMETRIC", isHeader: true },
      { label: "Psychrometric", to: "/psychrometric" },
    ],
  },
  {
    kind: "group", label: "Electrical", icon: Zap,
    children: [
      { label: "ESSENTIAL CALCULATIONS", isHeader: true },
      { label: "Central Battery Sizing", to: "/central-battery-sizing" },
      { label: "UPS Sizing Calculation", to: "/ups-sizing-calculation" },
      { label: "Generator Sizing", to: "/generator-sizing" },
      { label: "LIGHTING", isHeader: true },
      { label: "Lighting LUX Calculation", to: "/lighting-lux-calculation" },
      { label: "LPD Calculation", to: "/lpd-calculation" },
      { label: "POWER DISTRIBUTION", isHeader: true },
      { label: "Transformer Sizing", to: "/transformer-sizing" },
      { label: "Circuit Breaker Sizing", to: "/circuit-breaker-sizing" },
      { label: "Busbar Calculation", to: "/busbar-calculation" },
      { label: "Cable Tray Sizing", to: "/cable-tray-sizing" },
      { label: "Capacitor Bank Sizing", to: "/capacitor-bank-sizing" },
      { label: "Conductor (Cable) Sizing", to: "/conductor-sizing" },
      { label: "Cable Voltage Drop", to: "/cable-voltage-drop" },
      { label: "Busbar Voltage Drop", to: "/busbar-voltage-drop" },
      { label: "Short Circuit Calculations", to: "/short-circuit-calculations" },
      { label: "LOAD ANALYSIS", isHeader: true },
      { label: "Load Summary", to: "/load-summary" },
      { label: "Project Load Schedule (DB Builder)", to: "/project-load-schedule" }
    ],
  },
  {
    kind: "group", label: "Fire Fighting", icon: Droplets,
    children: [
      { label: "Sprinkler K-Factor", to: "/plumbing-sprinkler-kfactor" },
      { label: "Sprinkler Density & Flow", to: "/plumbing-sprinkler-density" },
      { label: "Hazen-Williams", to: "/plumbing-hazen-williams" },
      { label: "FM-200 Calculation", to: "/plumbing-fm200" },
      { label: "Fire Water Demand", to: "/plumbing-fire-water-demand" },
      { label: "Fire Pump Duty", to: "/plumbing-fire-pump-duty" },
      { label: "Fire Tank Capacity", to: "/plumbing-fire-tank-capacity" },
      { label: "Tank Duration", to: "/plumbing-fire-tank-duration" }
    ],
  },
  {
    kind: "group", label: "Plumbing", icon: Wrench,
    children: [
      { label: "Water Demand", to: "/plumbing-water-demand" },
      { label: "Fixture Unit Calculator", to: "/plumbing-fixture-unit" },
      { label: "Loading Unit Calculator", to: "/plumbing-loading-unit" },
      { label: "Supply Pipe Sizer", to: "/plumbing-supply-pipe-sizer" },
      { label: "Pump Sizing (Transfer/Booster)", to: "/plumbing-pump-sizing" },
      { label: "Pressure Vessel Sizing", to: "/plumbing-pressure-vessel" },
      { label: "Sump Pump Sizing", to: "/plumbing-sump-pump" },
      { label: "Drainage Sizing", to: "/plumbing-drainage" },
      { label: "Discharge Unit Sizing", to: "/plumbing-discharge-unit" },
      { label: "Sewage Pump Sizing", to: "/plumbing-sewage-pump" },
      { label: "Storm Water Sizing", to: "/plumbing-storm-water" },
      { label: "Tank Sizing", to: "/plumbing-tank-sizing" },
      { label: "Gas Storage Capacity", to: "/plumbing-gas-tank" }
    ],
  },
  { kind: "item", label: "Reports", to: "/reports", icon: FileBarChart },
  { kind: "item", label: "Teams", to: "/teams", icon: Users },
  { kind: "item", label: "Settings", to: "/settings", icon: Cog },
];

import { 
  Home,
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
  { kind: "item", label: "Home", to: "/", icon: Home },
  { kind: "item", label: "Projects", to: "/projects", icon: FolderKanban },
  { kind: "item", label: "3D Studio", to: "/bim-viewer", icon: Box },
  {
    kind: "group", label: "HVAC", icon: Wind, defaultOpen: true,
    children: [
      { label: "Preliminary Cooling Load", to: "/preliminary-cooling-load" },
      { label: "Ventilation", to: "/ventilation" },
      { label: "Basement Smoke Calc", to: "/basement-smoke-calc" },
    ],
  },
  {
    kind: "group", label: "Electrical", icon: Zap, defaultOpen: true,
    children: [
      { label: "LPD Calculation", to: "/lpd-calculation" },
      { label: "Busbar Calculation", to: "/busbar-calculation" },
      { label: "Load Summary", to: "/load-summary" },
    ],
  },
  {
    kind: "group", label: "Plumbing", icon: Wrench, defaultOpen: true,
    children: [
      { label: "Loading Unit Calculator", to: "/plumbing-loading-unit" },
      { label: "Water Demand", to: "/plumbing-water-demand" },
      { label: "Pump Sizing (Transfer/Booster)", to: "/plumbing-pump-sizing" },
    ],
  },
  { kind: "item", label: "Reports", to: "/reports", icon: FileBarChart },
  { kind: "item", label: "Teams", to: "/teams", icon: Users },
  { kind: "item", label: "Settings", to: "/settings", icon: Cog },
];

import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useMemo, useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/workspace/AppShell";
import {
  useWorkspace,
  PROJECT_TYPES,
  PROJECT_STAGES,
  canEditProjectStages,
  type ProjectType,
  type ProjectStageName
} from "@/lib/workspace-store";
import { PROJECT_TYPE_CONFIG, STAGE_CONFIG } from "./projects";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckCircle2, ChevronRight,
  TrendingUp, Clock, BarChart3, PieChart as PieChartIcon,
  ArrowUpDown, FolderKanban, ArrowUpRight,
  Lock, Unlock, ArrowRight, Play, Check,
  Building2, X, Search, Layers, FileText, ChevronDown, Plus,
  Wind, Zap, Droplets, Flame, Calculator, Sparkles
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Home — MEP Calculator" },
      { name: "description", content: "MEP project analytics, compliance, alerts, and quick calculation access." },
    ],
  }),
  component: DashboardPage,
});

const CustomChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3 rounded-2xl shadow-xl text-xs space-y-1.5 min-w-[160px] z-50">
      <p className="font-extrabold text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1">
        {label}
      </p>
      {payload.map((entry: any, index: number) => (
        <div key={`item-${index}`} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span className="size-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
            {entry.name}:
          </span>
          <span className="font-mono font-bold text-slate-900 dark:text-white">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
            {entry.unit ? ` ${entry.unit}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
};

const formatRelativeTime = (dateStr?: string) => {
  if (!dateStr) return 'Just now';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 'Just now';
  const now = new Date();
  const diffSec = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

export interface QuickCalc {
  id: string;
  name: string;
  discipline: "hvac" | "electrical" | "plumbing";
  route: string;
  standard: string;
  desc: string;
}

export const QUICK_CALCULATORS: QuickCalc[] = [
  // HVAC (3 engines)
  {
    id: "prelim_cooling",
    name: "Preliminary Cooling Load",
    discipline: "hvac",
    route: "/preliminary-cooling-load",
    standard: "ASHRAE / Carrier",
    desc: "Sensible & latent room cooling load calculation",
  },
  {
    id: "ventilation",
    name: "Ventilation",
    discipline: "hvac",
    route: "/ventilation",
    standard: "ASHRAE 62.1",
    desc: "Outdoor fresh air ventilation & air change rate calculation",
  },
  {
    id: "basement_smoke",
    name: "Basement Smoke Calc",
    discipline: "hvac",
    route: "/basement-smoke-calc",
    standard: "NFPA 92 / NFPA 204",
    desc: "Car park emergency smoke extract & mechanical ventilation",
  },

  // Electrical (3 engines)
  {
    id: "lpd_calc",
    name: "LPD Calculation",
    discipline: "electrical",
    route: "/lpd-calculation",
    standard: "ASHRAE 90.1 / CIBSE",
    desc: "Lighting power density watts/m² & energy compliance check",
  },
  {
    id: "busbar_calc",
    name: "Busbar Calculation",
    discipline: "electrical",
    route: "/busbar-calculation",
    standard: "IEC 61439 / DEWA",
    desc: "Busbar sizing, ampacity derating & voltage drop verification",
  },
  {
    id: "load_summary",
    name: "Load Summary",
    discipline: "electrical",
    route: "/load-summary",
    standard: "IEC 60364 / IEEE",
    desc: "Connected, diversified & maximum demand electrical schedule",
  },

  // Plumbing (3 engines)
  {
    id: "loading_unit",
    name: "Loading Unit Calculator",
    discipline: "plumbing",
    route: "/plumbing-loading-unit",
    standard: "BS EN 806 / CIPHE",
    desc: "Simultaneous flow demand & water pipe sizing via loading units",
  },
  {
    id: "water_demand",
    name: "Water Demand",
    discipline: "plumbing",
    route: "/plumbing-water-demand",
    standard: "DEWA / IPC / BS 8551",
    desc: "Daily potable water consumption & storage tank requirements",
  },
  {
    id: "pump_sizing",
    name: "Pump Sizing (Transfer/Booster)",
    discipline: "plumbing",
    route: "/plumbing-pump-sizing",
    standard: "ASPE / DIN 1988",
    desc: "Water booster & transfer pump flow rate (Q) and head (H) sizing",
  },
];

export function DashboardPage() {
  const {
    spaces,
    zones,
    equipment,
    activeProjectId,
    projects,
    project,
    selectProject,
    updateProjectStage,
    refreshProjects
  } = useWorkspace();
  const { profile } = useAuth();
  const activeProject = project || projects.find((p) => p.id === activeProjectId);
  
  const [dashboardTypeFilter, setDashboardTypeFilter] = useState<string>("ALL");
  const [portfolioChartMode, setPortfolioChartMode] = useState<"typology_bar" | "stages_pie">("typology_bar");
  const [typologySortOrder, setTypologySortOrder] = useState<"standard" | "count_desc">("standard");
  const canEditStages = canEditProjectStages(profile);

  const [selectedTypologyModal, setSelectedTypologyModal] = useState<{
    title: string;
    count: number;
    percentage?: number;
    projects: any[];
    color?: string;
  } | null>(null);
  const [modalSearchTerm, setModalSearchTerm] = useState("");
  const [calcDisciplineFilter, setCalcDisciplineFilter] = useState<"all" | "hvac" | "electrical" | "plumbing">("all");
  const [calcSearchTerm, setCalcSearchTerm] = useState<string>("");

  const roleStr = String(profile?.role || '').toLowerCase();
  const desigStr = String(profile?.designation || '').toLowerCase();
  const emailStr = String(profile?.email || '').toLowerCase();

  const isSuperAdmin =
    roleStr === 'super_admin' ||
    emailStr === 'admin@tarv.ai' ||
    (roleStr.includes('admin') && !roleStr.includes('org'));

  const isOrgAdmin =
    roleStr === 'org_admin' ||
    desigStr.includes('org admin');

  const isTeamLead =
    roleStr === 'team_leader' ||
    roleStr === 'team_lead' ||
    roleStr === 'project_manager' ||
    desigStr.includes('team leader') ||
    desigStr.includes('team lead') ||
    desigStr.includes('project manager');

  const filteredCalculators = useMemo(() => {
    return QUICK_CALCULATORS.filter((calc) => {
      const matchesDiscipline = calcDisciplineFilter === "all" || calc.discipline === calcDisciplineFilter;
      const term = calcSearchTerm.trim().toLowerCase();
      const matchesSearch = !term ||
        calc.name.toLowerCase().includes(term) ||
        calc.standard.toLowerCase().includes(term) ||
        calc.desc.toLowerCase().includes(term);
      return matchesDiscipline && matchesSearch;
    });
  }, [calcDisciplineFilter, calcSearchTerm]);

  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const tooltipListRef = useRef<HTMLUListElement | null>(null);
  const pieContainerRef = useRef<HTMLDivElement | null>(null);
  const pieTooltipListRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (tooltipListRef.current) {
        e.preventDefault();
        tooltipListRef.current.scrollTop += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = pieContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (pieTooltipListRef.current) {
        e.preventDefault();
        pieTooltipListRef.current.scrollTop += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const [workspaceHistory, setWorkspaceHistory] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`workspace_history_${profile?.id}`) || "{}");
    } catch {
      return {};
    }
  });

  const [globalActivity, setGlobalActivity] = useState<any[]>([]);

  useEffect(() => {
    try {
      const log = JSON.parse(localStorage.getItem(`global_activity_${profile?.id}`) || "[]");
      setGlobalActivity(log);
    } catch {}
  }, [profile?.id]);

  const navigate = useNavigate();

  const handleSelectProject = (id: string) => {
    selectProject(id);
    setWorkspaceHistory(prev => {
      const next = { ...prev, [id]: Date.now() };
      try {
        localStorage.setItem(`workspace_history_${profile?.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleOpenWorkspace = (id: string) => {
    handleSelectProject(id);
    let targetRoute = "";
    try {
      targetRoute =
        localStorage.getItem(`mep_last_route_${id}`) ||
        localStorage.getItem("mep_last_active_route") ||
        "";
    } catch {}

    if (!targetRoute || targetRoute === "/" || targetRoute === "/dashboard" || targetRoute === "/projects") {
      targetRoute = "/bim-viewer";
    }

    const p = projects.find(proj => proj.id === id);
    toast.info(`Opening ${p ? p.name : "workspace"}...`);
    navigate({ to: targetRoute as any });
  };
  
  useEffect(() => {
    refreshProjects();
  }, []);


  // 5b. Portfolio Project Stages Distribution (For Home Page Pie Diagram)
  const stageDistribution = useMemo(() => {
    const targetProjects = dashboardTypeFilter === "ALL"
      ? projects
      : projects.filter(p => (p.project_type || "Buildings / Apartment") === dashboardTypeFilter);

    const counts: Record<string, { name: string; value: number; color: string; projects: string[]; projectList: any[] }> = {
      "Preconcept Design": { name: "Preconcept Design", value: 0, color: "#94a3b8", projects: [], projectList: [] },
      "Concept Design": { name: "Concept Design", value: 0, color: "#64748b", projects: [], projectList: [] },
      "Schematic Design": { name: "Schematic Design", value: 0, color: "#475569", projects: [], projectList: [] },
      "Detailed Design": { name: "Detailed Design", value: 0, color: "#3b82f6", projects: [], projectList: [] },
      "Tender Documentation": { name: "Tender Documentation", value: 0, color: "#2563eb", projects: [], projectList: [] },
      "Issued For Construction": { name: "Issued For Construction", value: 0, color: "#1d4ed8", projects: [], projectList: [] },
      "Completed": { name: "Completed", value: 0, color: "#0f172a", projects: [], projectList: [] },
    };

    targetProjects.forEach(p => {
      const stg = p.current_stage || "Concept Design";
      if (counts[stg]) {
        counts[stg].value += 1;
        counts[stg].projects.push(p.name);
        counts[stg].projectList.push(p);
      } else {
        counts["Concept Design"].value += 1;
        counts["Concept Design"].projects.push(p.name);
        counts["Concept Design"].projectList.push(p);
      }
    });

    const activeList = Object.values(counts).filter(item => item.value > 0);
    // If no projects or empty filtered list, show sample demonstration distribution
    if (activeList.length === 0) {
      return [
        { name: "Preconcept Design", value: 2, color: "#94a3b8", projects: ["Marina Masterplan", "Dubai Hills Villa"], projectList: [] },
        { name: "Concept Design", value: 4, color: "#64748b", projects: ["Downtown Mall", "City Hospital", "Central School", "Park Complex"], projectList: [] },
        { name: "Schematic Design", value: 3, color: "#475569", projects: ["Boulevard Tower", "Oasis Residence", "Medical Clinic"], projectList: [] },
        { name: "Detailed Design", value: 3, color: "#3b82f6", projects: ["Academy Campus", "Business Hub", "Grand Mosque"], projectList: [] },
        { name: "Tender Documentation", value: 2, color: "#2563eb", projects: ["Logistics Park", "Creek Heights"], projectList: [] },
        { name: "Issued For Construction", value: 1, color: "#1d4ed8", projects: ["Palm Luxury Residence"], projectList: [] },
      ];
    }
    return activeList;
  }, [projects, dashboardTypeFilter]);

  const totalStageProjects = useMemo(() => {
    return stageDistribution.reduce((acc, cur) => acc + cur.value, 0);
  }, [stageDistribution]);

  // 5b. Project Typology Volume Analysis: comparing counts across all 7 typologies
  const typologyData = useMemo(() => {
    const total = projects.length || 1;
    const list = PROJECT_TYPES.map((type) => {
      const projs = projects.filter((p) => (p.project_type || "Buildings / Apartment") === type);
      return {
        name: type,
        count: projs.length,
        percentage: Math.round((projs.length / total) * 100),
        projects: projs.map((p) => p.name),
        projectList: projs,
      };
    });

    const maxCount = Math.max(...list.map((i) => i.count));
    const minCount = Math.min(...list.map((i) => i.count));

    const enriched = list.map((item) => ({
      ...item,
      isHighest: maxCount > 0 && item.count === maxCount,
      isLowest: item.count === minCount,
    }));

    if (typologySortOrder === "count_desc") {
      return [...enriched].sort((a, b) => b.count - a.count);
    }
    return enriched;
  }, [projects, typologySortOrder]);

  const typologyHighlights = useMemo(() => {
    const list = [...typologyData].sort((a, b) => b.count - a.count);
    const highest = list[0] || { name: "Buildings / Apartment", count: 0, percentage: 0 };
    const lowest = list[list.length - 1] || { name: "Villa", count: 0, percentage: 0 };
    const zeroList = list.filter((i) => i.count === 0);
    return {
      highest,
      lowest,
      zeroCount: zeroList.length,
      zeroNames: zeroList.map((z) => z.name),
      totalProjects: projects.length,
    };
  }, [typologyData, projects.length]);

  // 5c. Active Project Stage Lifecycle: Completed vs In-Progress vs Remaining
  const activeProjectLifecycle = useMemo(() => {
    const curProj: any = project || projects.find(p => p.id === activeProjectId) || projects[0];
    const appStages: string[] = (curProj?.applicable_stages && curProj.applicable_stages.length > 0)
      ? curProj.applicable_stages
      : (PROJECT_STAGES as unknown as string[]);
    const currentStg: string = curProj?.current_stage || "Concept Design";

    const currentIdx = appStages.indexOf(currentStg as any);
    const isAllCompleted = currentStg === "Completed";

    const completedStages = isAllCompleted
      ? [...appStages]
      : (currentIdx === -1 ? [] : appStages.slice(0, currentIdx));
    
    const inProgressStages = isAllCompleted
      ? []
      : (currentIdx === -1 ? [appStages[0]] : [appStages[currentIdx]]);

    const remainingStages = isAllCompleted
      ? []
      : (currentIdx === -1 ? appStages.slice(1) : appStages.slice(currentIdx + 1));

    let nextStage: string | null = null;
    if (!isAllCompleted) {
      if (currentIdx === -1) {
        nextStage = appStages[0] || null;
      } else if (currentIdx < appStages.length - 1) {
        nextStage = appStages[currentIdx + 1];
      } else {
        nextStage = "Completed";
      }
    }

    const totalCount = appStages.length;
    const completedCount = completedStages.length;
    const inProgressCount = inProgressStages.length;
    const remainingCount = remainingStages.length;

    const progressPct = Math.round((completedCount / totalCount) * 100);

    const pieData = [
      { name: "Completed Stages", value: completedCount, color: "#1e293b" },
      { name: "Current Stage (In Progress)", value: inProgressCount, color: "#3b82f6" },
      { name: "Remaining / Upcoming", value: remainingCount, color: "#cbd5e1" },
    ].filter(d => d.value > 0);

    return {
      project: curProj,
      appStages,
      currentStg,
      isAllCompleted,
      nextStage,
      completedStages,
      inProgressStages,
      remainingStages,
      completedCount,
      inProgressCount,
      remainingCount,
      progressPct,
      pieData: pieData.length > 0 ? pieData : [{ name: "In Progress", value: 1, color: "#3b82f6" }],
    };
  }, [project, projects, activeProjectId]);

  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  const handleAdvanceActiveStage = async (nextStage: string) => {
    if (!activeProjectLifecycle.project?.id) return;
    if (!canEditProjectStages(profile, activeProjectLifecycle.project)) {
      toast.error("Only System Admin, Organization Admin, or assigned Team Leader have permission to update project stages.");
      return;
    }
    setIsUpdatingStage(true);
    try {
      const res = await updateProjectStage(activeProjectLifecycle.project.id, nextStage);
      if (res && res.success) {
        toast.success(`Stage updated to ${nextStage}`);
        await refreshProjects();
      } else {
        toast.error(res?.message || "Failed to update project stage");
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setIsUpdatingStage(false);
    }
  };



  return (
    <AppShell title="Home" hideSubHeader={true}>
      <div className="flex flex-col h-full min-h-0 w-full bg-transparent overflow-hidden">
        
        {/* Sticky Control Header: Full width till left sidebar, exactly matching projects.tsx in Image 2 */}
        <div className="shrink-0 sticky top-0 z-20 bg-background/95 dark:bg-[#09090b]/95 backdrop-blur-md border-b border-border/70 py-3 px-4 md:px-6 flex flex-col gap-3 select-none shadow-2xs">
          {/* Row 1: Executive Command Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-primary/10 text-primary rounded-xl border border-primary/20 shadow-2xs shrink-0">
                <PieChartIcon className="size-4.5" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight">Home</h1>
                  <span className="text-[11px] font-mono font-semibold bg-muted/80 text-foreground/80 border border-border/70 px-2 py-0.5 rounded-md shadow-2xs">
                    {projects.length} Workspaces
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground font-medium truncate">
                  Project analytics, portfolio typology volume & stage lifecycle tracking.
                </p>
              </div>
            </div>

            {/* Action Buttons & View Switcher */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center p-1 rounded-xl bg-surface-2 border border-border/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setPortfolioChartMode("typology_bar")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                    portfolioChartMode === "typology_bar"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  }`}
                  title="Bar Graph showing volume across all project typologies"
                >
                  <BarChart3 className="size-3.5" />
                  <span>Typologies</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPortfolioChartMode("stages_pie")}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg transition-all cursor-pointer ${
                    portfolioChartMode === "stages_pie"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground font-medium"
                  }`}
                  title="Pie Diagram showing distribution across project stages"
                >
                  <PieChartIcon className="size-3.5" />
                  <span>Design Stages</span>
                </button>
              </div>

              {activeProject && (
                <button
                  type="button"
                  onClick={() => handleOpenWorkspace(activeProject.id)}
                  className="h-8.5 px-3.5 rounded-xl border border-border/80 bg-surface-2/80 hover:bg-surface-3 hover:border-border text-foreground text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title={`Continue active workspace: ${activeProject.name}`}
                >
                  <Play className="size-3 fill-primary text-primary" />
                  <span>Continue Active</span>
                </button>
              )}

              <Link
                to="/projects"
                className="h-8.5 px-3.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs hover:shadow-primary/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FolderKanban className="size-3.5" />
                <span>All Projects</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Main Workspace Body: Dual-Pane with Scrollable Analytics & Productivity Companion Panel */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden bg-background">
          
          {/* Left Side: Analytics Content Area */}
          <div className="flex-1 min-h-0 p-4 md:p-6 overflow-y-auto custom-scrollbar">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4.5">

              {/* Card 1: Typology Bar Graph / Portfolio Analytics */}
              <div className="bg-card dark:bg-zinc-900/90 border border-border/70 rounded-2xl p-4 md:p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="pb-3 mb-3 border-b border-border/50">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                      {portfolioChartMode === "typology_bar" ? "Project Typology Volume" : "Stage Distribution Across Projects"}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {portfolioChartMode === "typology_bar"
                        ? "Volume comparison across all 7 project typologies (showing which are more and which are less)"
                        : (dashboardTypeFilter === "ALL" ? "All active workspaces" : `Showing ${dashboardTypeFilter} workspaces`)}
                    </p>
                  </div>

                  {portfolioChartMode === "typology_bar" ? (
                    /* TYPOLOGY VOLUME BAR GRAPH VIEW */
                    <div className="pt-3">
                      {/* Insight Badges: Most Projects vs Lowest / Zero projects & Sequence Sorter */}
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Highest Volume Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#3474c4]/10 border border-[#3474c4]/30 text-[11px]">
                            <span className="font-semibold text-[#3474c4]">More (Highest):</span>
                            <span className="font-extrabold text-[#3474c4]">{typologyHighlights.highest.name}</span>
                            <span className="font-mono font-bold px-1.5 py-0.2 rounded bg-[#3474c4] text-white text-[10px]">
                              {typologyHighlights.highest.count}
                            </span>
                          </div>

                          {/* Lowest / Zero Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-zinc-800/80 border border-border/70 text-[11px]">
                            <span className="font-semibold text-muted-foreground">Less / Zero:</span>
                            <span className="font-bold text-foreground">
                              {typologyHighlights.zeroCount > 0
                                ? `${typologyHighlights.zeroCount} types with 0`
                                : `${typologyHighlights.lowest.name} (${typologyHighlights.lowest.count})`}
                            </span>
                          </div>
                        </div>

                        {/* Sort Sequence Switcher */}
                        <div className="flex items-center gap-1 text-[11px]">
                          <span className="text-muted-foreground font-medium">Order:</span>
                          <button
                            type="button"
                            onClick={() => setTypologySortOrder(typologySortOrder === "standard" ? "count_desc" : "standard")}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 border border-border/70 hover:bg-surface-3 text-foreground font-semibold cursor-pointer transition text-[10.5px]"
                          >
                            <ArrowUpDown className="size-3 text-muted-foreground" />
                            {typologySortOrder === "standard" ? "Standard List Order" : "Highest Volume First"}
                          </button>
                        </div>
                      </div>

                      {/* Recharts Bar Graph */}
                      <div ref={chartContainerRef} className="h-[220px] w-full my-1 relative">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={typologyData} margin={{ top: 16, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="text-border/40" />
                            <XAxis
                              dataKey="name"
                              tick={{ fontSize: 10, fill: "currentColor" }}
                              className="text-muted-foreground"
                              interval={0}
                              tickFormatter={(val: string) => {
                                if (val === "School Projects") return "Schools";
                                if (val === "Mall & Mosque") return "Mall/Mosque";
                                if (val === "Buildings / Apartment") return "Buildings/Apt";
                                if (val === "Offices / Residential") return "Offices/Res";
                                return val;
                              }}
                              height={35}
                            />
                            <YAxis
                              allowDecimals={false}
                              tick={{ fontSize: 10, fill: "currentColor" }}
                              className="text-muted-foreground"
                              width={35}
                            />
                            <Tooltip
                              cursor={{ fill: "rgba(52, 116, 196, 0.08)" }}
                              wrapperStyle={{ pointerEvents: 'auto', zIndex: 1000, outline: 'none' }}
                              allowEscapeViewBox={{ x: true, y: true }}
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const item = payload[0].payload;
                                return (
                                  <div
                                    className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-2xl text-xs space-y-1.5 min-w-[240px] max-w-[320px] pointer-events-auto"
                                    onWheel={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                                      <span className="font-bold text-foreground flex items-center gap-1.5">
                                        <span className="size-2 rounded-full bg-[#3474c4]" />
                                        {item.name}
                                      </span>
                                      <span className="font-mono font-bold text-[#3474c4]">
                                        {item.count} {item.count === 1 ? "project" : "projects"} ({item.percentage}%)
                                      </span>
                                    </div>
                                    <div className="text-[10.5px] text-muted-foreground">
                                      {item.isHighest && <span className="text-[#3474c4] font-bold block mb-1">⭐ Highest Project Volume</span>}
                                      {item.count === 0 && <span className="text-amber-600 dark:text-amber-400 font-semibold block mb-1">No active projects currently</span>}
                                    </div>
                                    {item.projects && item.projects.length > 0 && (
                                      <div className="pt-1.5 border-t border-border/50">
                                        <div className="flex items-center justify-between mb-1 text-[10px]">
                                          <span className="text-muted-foreground font-semibold">Projects ({item.projects.length}):</span>
                                          <span className="text-[9px] text-muted-foreground/80 italic font-mono">Scroll mouse wheel ↓</span>
                                        </div>
                                        <ul
                                          ref={tooltipListRef}
                                          className="text-[10.5px] space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar select-text"
                                          style={{ overscrollBehavior: 'contain' }}
                                          onWheel={(e) => e.stopPropagation()}
                                        >
                                          {item.projects.map((pName: string, pIdx: number) => {
                                            const pObj = item.projectList ? item.projectList[pIdx] : projects.find(p => p.name === pName);
                                            return (
                                              <li
                                                key={pIdx}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (pObj) handleOpenWorkspace(pObj.id);
                                                }}
                                                className="flex items-center justify-between gap-1.5 p-1 rounded-lg hover:bg-surface-2 dark:hover:bg-zinc-800 transition cursor-pointer group/p border border-transparent hover:border-border/60"
                                                title={`Click to open ${pName}`}
                                              >
                                                <span className="truncate text-foreground/90 font-medium group-hover/p:text-[#3474c4]">
                                                  • {pName}
                                                </span>
                                                {pObj?.code && (
                                                  <span className="text-[9px] font-mono text-muted-foreground shrink-0 bg-surface-2/60 dark:bg-zinc-800/60 px-1 rounded border border-border/40">
                                                    {pObj.code}
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTypologyModal({
                                              title: item.name,
                                              count: item.count,
                                              percentage: item.percentage,
                                              projects: item.projectList || projects.filter(p => (p.project_type || "Buildings / Apartment") === item.name),
                                              color: "#3474c4"
                                            });
                                          }}
                                          className="w-full mt-2 pt-1.5 border-t border-border/40 text-[10.5px] font-bold text-[#3474c4] hover:text-[#3474c4]/80 flex items-center justify-center gap-1 cursor-pointer transition"
                                        >
                                          <span>View all {item.count} in searchable dialog</span>
                                          <ChevronRight className="size-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              }}
                            />
                            <Bar
                              dataKey="count"
                              radius={[6, 6, 0, 0]}
                              fill="#3474c4"
                              maxBarSize={45}
                              className="cursor-pointer"
                              onClick={(entry: any) => {
                                if (entry && entry.name && entry.count > 0) {
                                  setSelectedTypologyModal({
                                    title: entry.name,
                                    count: entry.count,
                                    percentage: entry.percentage,
                                    projects: entry.projectList || projects.filter(p => (p.project_type || "Buildings / Apartment") === entry.name),
                                    color: "#3474c4"
                                  });
                                }
                              }}
                            >
                              <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700, fill: "currentColor" }} className="text-foreground pointer-events-none" />
                              {typologyData.map((entry, index) => (
                                <Cell
                                  key={`bar-cell-${index}`}
                                  fill={entry.count === 0 ? "#cbd5e1" : "#3474c4"}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Typologies Breakdown Pills (Clickable to filter or inspect) */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-2 border-t border-border/50">
                        {typologyData.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => {
                              setDashboardTypeFilter(item.name);
                              if (item.count > 0) {
                                setSelectedTypologyModal({
                                  title: item.name,
                                  count: item.count,
                                  percentage: item.percentage,
                                  projects: item.projectList || projects.filter(p => (p.project_type || "Buildings / Apartment") === item.name),
                                  color: "#3474c4"
                                });
                              }
                            }}
                            className={`flex items-center justify-between p-1.5 px-2 rounded-lg border text-[11px] text-left transition cursor-pointer group ${
                              dashboardTypeFilter === item.name
                                ? "bg-primary text-primary-foreground border-primary font-semibold"
                                : "bg-surface-2/60 hover:bg-surface-3/60 border-border/60 text-foreground"
                            }`}
                            title={item.count > 0 ? `Click to filter and view all ${item.count} projects` : item.name}
                          >
                            <span className="truncate pr-1">{item.name}</span>
                            <span className={`font-mono font-bold shrink-0 text-[10.5px] ${
                              dashboardTypeFilter === item.name ? "text-white" : (item.count > 0 ? "text-[#3474c4]" : "text-muted-foreground")
                            }`}>
                              {item.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* EXISTING DESIGN STAGES DONUT PIE DIAGRAM VIEW */
                    <div className="pt-2">
                      {/* Donut Chart with Centered Total */}
                      <div ref={pieContainerRef} className="relative h-[230px] w-full my-1 flex items-center justify-center">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stageDistribution}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={68}
                              outerRadius={95}
                              paddingAngle={3}
                              stroke="none"
                              className="cursor-pointer"
                              onClick={(entry: any) => {
                                if (entry && entry.name && entry.value > 0) {
                                  setSelectedTypologyModal({
                                    title: entry.name,
                                    count: entry.value,
                                    percentage: totalStageProjects > 0 ? Math.round((entry.value / totalStageProjects) * 100) : 0,
                                    projects: entry.projectList || [],
                                    color: entry.color || "#3474c4"
                                  });
                                }
                              }}
                            >
                              {stageDistribution.map((entry, index) => (
                                <Cell key={`cell-stage-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              wrapperStyle={{ pointerEvents: 'auto', zIndex: 1000, outline: 'none' }}
                              allowEscapeViewBox={{ x: true, y: true }}
                              content={({ active, payload }) => {
                                if (!active || !payload || !payload.length) return null;
                                const data = payload[0].payload;
                                return (
                                  <div
                                    className="bg-card/95 dark:bg-slate-900/95 backdrop-blur-md border border-border/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-2xl text-xs space-y-1.5 min-w-[240px] max-w-[320px] pointer-events-auto"
                                    onWheel={(e) => e.stopPropagation()}
                                  >
                                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                                      <span className="font-bold flex items-center gap-1.5" style={{ color: data.color }}>
                                        <span className="size-2 rounded-full" style={{ backgroundColor: data.color }} />
                                        {data.name}
                                      </span>
                                      <span className="font-mono font-bold text-foreground">{data.value}</span>
                                    </div>
                                    {data.projects && data.projects.length > 0 && (
                                      <div className="pt-1.5 border-t border-border/50">
                                        <div className="flex items-center justify-between mb-1 text-[10px]">
                                          <span className="text-muted-foreground font-semibold">Projects ({data.projects.length}):</span>
                                          <span className="text-[9px] text-muted-foreground/80 italic font-mono">Scroll mouse wheel ↓</span>
                                        </div>
                                        <ul
                                          ref={pieTooltipListRef}
                                          className="text-[10.5px] space-y-1 max-h-48 overflow-y-auto pr-1 custom-scrollbar select-text"
                                          style={{ overscrollBehavior: 'contain' }}
                                          onWheel={(e) => e.stopPropagation()}
                                        >
                                          {data.projects.map((pName: string, pIdx: number) => {
                                            const pObj = data.projectList ? data.projectList[pIdx] : projects.find(p => p.name === pName);
                                            return (
                                              <li
                                                key={pIdx}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (pObj) handleOpenWorkspace(pObj.id);
                                                }}
                                                className="flex items-center justify-between gap-1.5 p-1 rounded-lg hover:bg-surface-2 dark:hover:bg-zinc-800 transition cursor-pointer group/p border border-transparent hover:border-border/60"
                                                title={`Click to open ${pName}`}
                                              >
                                                <span className="truncate text-foreground/90 font-medium group-hover/p:text-[#3474c4]">
                                                  • {pName}
                                                </span>
                                                {pObj?.code && (
                                                  <span className="text-[9px] font-mono text-muted-foreground shrink-0 bg-surface-2/60 dark:bg-zinc-800/60 px-1 rounded border border-border/40">
                                                    {pObj.code}
                                                  </span>
                                                )}
                                              </li>
                                            );
                                          })}
                                        </ul>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedTypologyModal({
                                              title: data.name,
                                              count: data.value,
                                              percentage: totalStageProjects > 0 ? Math.round((data.value / totalStageProjects) * 100) : 0,
                                              projects: data.projectList || [],
                                              color: data.color
                                            });
                                          }}
                                          className="w-full mt-2 pt-1.5 border-t border-border/40 text-[10.5px] font-bold text-[#3474c4] hover:text-[#3474c4]/80 flex items-center justify-center gap-1 cursor-pointer transition"
                                        >
                                          <span>View all {data.value} in searchable dialog</span>
                                          <ChevronRight className="size-3" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>

                        {/* Donut Center Label */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <span className="text-[9.5px] uppercase font-bold text-slate-400">Total</span>
                          <span className="text-xl font-black font-mono text-slate-900 dark:text-white leading-none">
                            {totalStageProjects}
                          </span>
                          <span className="text-[9.5px] text-muted-foreground font-semibold">Projects</span>
                        </div>
                      </div>

                      {/* Slices Legend Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/50">
                        {stageDistribution.map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => {
                              if (item.value > 0) {
                                setSelectedTypologyModal({
                                  title: item.name,
                                  count: item.value,
                                  percentage: totalStageProjects > 0 ? Math.round((item.value / totalStageProjects) * 100) : 0,
                                  projects: item.projectList || [],
                                  color: item.color
                                });
                              }
                            }}
                            className="flex items-center justify-between p-1.5 px-2 rounded-lg bg-surface-2/60 hover:bg-surface-3/60 border border-border/60 text-[11px] cursor-pointer transition text-left"
                            title={item.value > 0 ? `Click to view all ${item.value} projects in ${item.name}` : item.name}
                          >
                            <span className="flex items-center gap-1.5 min-w-0 truncate">
                              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                              <span className="truncate text-muted-foreground">{item.name}</span>
                            </span>
                            <span className="font-mono font-bold text-foreground shrink-0 ml-1.5">
                              {item.value} ({totalStageProjects > 0 ? Math.round((item.value / totalStageProjects) * 100) : 0}%)
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Active Project Stages Lifecycle */}
              <div className="bg-card dark:bg-zinc-900/90 border border-border/70 rounded-2xl p-4 md:p-5 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex flex-col gap-2 pb-3 mb-3 border-b border-border/50">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                        Stage Lifecycle Breakdown
                      </h4>
                      {/* Typology Badge */}
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-surface-2 border border-border/70 text-foreground/80 shrink-0">
                        {(activeProjectLifecycle.project as any)?.project_type || "Buildings / Apartment"}
                      </span>
                    </div>

                    {/* Active Project Switcher Dropdown (Transferred from header to Home Stage Lifecycle) */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 h-9 px-3 bg-surface-2 dark:bg-white/5 border border-border dark:border-[#262626] hover:bg-surface-3 dark:hover:bg-white/10 rounded-full text-xs cursor-pointer outline-none select-none transition-all duration-150 max-w-full shadow-2xs"
                            title="Switch Active Project"
                          >
                            <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                            <span className="font-semibold text-foreground dark:text-white truncate max-w-[150px] sm:max-w-[220px]">
                              {activeProjectLifecycle.project?.name || "Select Project"}
                            </span>
                            {activeProjectLifecycle.project?.code && (
                              <span className="text-muted-foreground font-mono text-[10.5px] hidden sm:inline shrink-0">
                                {activeProjectLifecycle.project.code}
                              </span>
                            )}
                            <ChevronDown className="size-3.5 text-muted-foreground ml-0.5 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-64 p-1 bg-popover border border-border rounded-xl shadow-lg font-sans z-50">
                          <DropdownMenuLabel className="text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider py-1.5 px-2">
                            Switch Project
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            {projects.map((p) => {
                              const active = p.id === activeProjectLifecycle.project?.id;
                              return (
                                <DropdownMenuItem
                                  key={p.id}
                                  onClick={() => selectProject(p.id)}
                                  className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs ${
                                    active ? "bg-primary/10 text-primary font-bold" : "hover:bg-accent text-foreground"
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 truncate">
                                    <Building2 className="size-3.5 shrink-0 opacity-70" />
                                    <span className="truncate">{p.name}</span>
                                  </div>
                                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">{p.code}</span>
                                </DropdownMenuItem>
                              );
                            })}
                          </div>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => navigate({ to: "/projects" })}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-xs text-primary hover:bg-primary/5 font-semibold"
                          >
                            <Plus className="size-3.5" />
                            <span>View All / Create Project</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Donut chart for Stages Completion */}
                  <div className="relative h-[160px] w-full my-2 flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={activeProjectLifecycle.pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={48}
                          outerRadius={68}
                          paddingAngle={4}
                          stroke="none"
                        >
                          {activeProjectLifecycle.pieData.map((entry, index) => (
                            <Cell key={`cell-pie-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>

                    {/* Donut Center Progress */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-black font-mono text-slate-900 dark:text-white leading-none">
                        {activeProjectLifecycle.progressPct}%
                      </span>
                      <span className="text-[9px] uppercase font-bold text-slate-400">Complete</span>
                    </div>
                  </div>

                  {/* 3 Metric Pills: Completed vs In Progress vs Remaining */}
                  <div className="grid grid-cols-3 gap-1.5 py-1 text-center">
                    <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60 text-foreground">
                      <span className="block text-sm font-black font-mono">{activeProjectLifecycle.completedCount}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider block text-muted-foreground">Completed</span>
                    </div>
                    <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60 text-foreground">
                      <span className="block text-sm font-black font-mono">{activeProjectLifecycle.inProgressCount}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider block text-muted-foreground">Current</span>
                    </div>
                    <div className="p-2 rounded-xl bg-surface-2/60 border border-border/60 text-foreground">
                      <span className="block text-sm font-black font-mono">{activeProjectLifecycle.remainingCount}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider block text-muted-foreground">Remaining</span>
                    </div>
                  </div>

                  {/* Pipeline Stepper: Applicable Stages with Status Indicators */}
                  <div className="flex flex-col gap-1.5 mt-3 max-h-48 overflow-y-auto custom-scrollbar p-1">
                    {activeProjectLifecycle.appStages.map((stg: string, sIdx: number) => {
                      const isDone = activeProjectLifecycle.completedStages.includes(stg);
                      const isCurrent = activeProjectLifecycle.inProgressStages.includes(stg);
                      const isUpcoming = activeProjectLifecycle.remainingStages.includes(stg);

                      return (
                        <div
                          key={stg}
                          onClick={() => {
                            if (canEditProjectStages(profile, activeProjectLifecycle.project) && !isUpdatingStage && stg !== activeProjectLifecycle.currentStg) {
                              handleAdvanceActiveStage(stg);
                            }
                          }}
                          className={`flex items-center justify-between p-2 rounded-xl border text-[11.5px] transition-all ${
                            canEditProjectStages(profile, activeProjectLifecycle.project) && stg !== activeProjectLifecycle.currentStg ? 'cursor-pointer hover:border-primary/50' : ''
                          } ${
                            isCurrent
                              ? 'bg-slate-100 dark:bg-zinc-800 border-slate-300 dark:border-zinc-600 text-foreground font-semibold shadow-2xs'
                              : isDone
                              ? 'bg-surface-1/50 border-border/60 text-foreground/80'
                              : 'bg-surface-2/20 border-border/40 text-muted-foreground/60'
                          }`}
                          title={
                            canEditProjectStages(profile, activeProjectLifecycle.project)
                              ? (stg === activeProjectLifecycle.currentStg ? `Current stage: ${stg}` : `Click to switch project stage to ${stg}`)
                              : undefined
                          }
                        >
                          <div className="flex items-center gap-2 min-w-0 truncate">
                            {isDone ? (
                              <CheckCircle2 className="size-3.5 text-muted-foreground shrink-0" />
                            ) : isCurrent ? (
                              <span className="size-2 rounded-full bg-primary shrink-0" />
                            ) : (
                              <Clock className="size-3 text-muted-foreground/60 shrink-0" />
                            )}
                            <span className="truncate">{stg}</span>
                          </div>

                          <span className={`text-[9.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md shrink-0 ${
                            isCurrent
                              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                              : isDone
                              ? 'bg-slate-200/80 dark:bg-zinc-700 text-slate-700 dark:text-zinc-200'
                              : 'bg-surface-2 text-muted-foreground'
                          }`}>
                            {isDone ? 'Completed' : (isCurrent ? 'Current' : 'Remaining')}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Team Leader / Admin Quick Advance Controls */}
                <div className="pt-3 mt-3 border-t border-border/50 flex items-center justify-between gap-2">
                  {canEditProjectStages(profile, activeProjectLifecycle.project) ? (
                    <div className="flex items-center justify-between w-full gap-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium">
                        <Unlock className="size-3.5 text-muted-foreground" />
                        <span>Update Stage:</span>
                        {activeProjectLifecycle.nextStage && (
                          <span className="text-[10.5px] text-muted-foreground/80 font-normal ml-0.5">
                            (Next: <span className="font-semibold text-foreground">{activeProjectLifecycle.nextStage}</span>)
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={!activeProjectLifecycle.nextStage || isUpdatingStage}
                        onClick={() => activeProjectLifecycle.nextStage && handleAdvanceActiveStage(activeProjectLifecycle.nextStage)}
                        title={activeProjectLifecycle.nextStage ? `Advance stage to ${activeProjectLifecycle.nextStage}` : "All project stages completed"}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs shadow-2xs hover:bg-primary/90 active:scale-95 transition disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                      >
                        {isUpdatingStage ? (
                          <span>Updating...</span>
                        ) : activeProjectLifecycle.isAllCompleted ? (
                          <>
                            <Check className="size-3.5" />
                            <span>Completed</span>
                          </>
                        ) : (
                          <>
                            <span>Next</span>
                            <ArrowRight className="size-3.5" />
                          </>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground italic w-full justify-center">
                      <Lock className="size-3 text-muted-foreground/70" />
                      <span>Stage progression managed by System Admin, Org Admin, or assigned Team Leader</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Section 5: MEP Quick Launch Calculators (Full 1-Click Access for all Engineering Roles) */}
            <div className="mt-4 bg-card dark:bg-zinc-900/90 border border-border/70 rounded-2xl p-4 md:p-5 shadow-2xs">
              {/* Header & Discipline Selector */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 mb-3.5 border-b border-border/60">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="size-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                      <Calculator className="size-3.5" />
                    </div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground">
                      MEP Engineering Calculators Quick Launch
                    </h3>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {filteredCalculators.length} of {QUICK_CALCULATORS.length} Engines
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Direct 1-click access to the 9 core calculation engines across HVAC, Electrical, and Plumbing.
                  </p>
                </div>

                {/* Discipline Filter Tabs & Quick Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center p-0.5 rounded-xl bg-surface-2 border border-border/70 text-[11px]">
                    {[
                      { id: "all", label: "All (9)", icon: Sparkles },
                      { id: "hvac", label: "HVAC (3)", icon: Wind },
                      { id: "electrical", label: "Electrical (3)", icon: Zap },
                      { id: "plumbing", label: "Plumbing (3)", icon: Droplets },
                    ].map(tab => {
                      const Icon = tab.icon;
                      const isSel = calcDisciplineFilter === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setCalcDisciplineFilter(tab.id as any)}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                            isSel
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <Icon className="size-3" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="relative">
                    <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={calcSearchTerm}
                      onChange={(e) => setCalcSearchTerm(e.target.value)}
                      placeholder="Search engine or code..."
                      className="bg-surface-2 border border-border/80 rounded-xl pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-44 transition"
                    />
                    {calcSearchTerm && (
                      <button
                        type="button"
                        onClick={() => setCalcSearchTerm("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Calculators Grid: 3 columns x 3 rows = 9 core calculations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-1">
                {filteredCalculators.map(calc => {
                  const disciplineColor =
                    calc.discipline === "hvac"
                      ? "text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20"
                      : calc.discipline === "electrical"
                      ? "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/20"
                      : "text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/20";

                  const DiscIcon =
                    calc.discipline === "hvac"
                      ? Wind
                      : calc.discipline === "electrical"
                      ? Zap
                      : Droplets;

                  return (
                    <div
                      key={calc.id}
                      onClick={() => {
                        const targetId = activeProject?.id || projects[0]?.id;
                        if (targetId) {
                          handleSelectProject(targetId);
                          try {
                            localStorage.setItem(`mep_last_route_${targetId}`, calc.route);
                          } catch {}
                        }
                        toast.info(`Launching ${calc.name}...`);
                        navigate({ to: calc.route as any });
                      }}
                      className="group flex flex-col justify-between p-3 rounded-xl border border-border/70 hover:border-primary/50 bg-card hover:bg-surface-2 dark:hover:bg-zinc-800/90 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1.5 mb-1.5">
                          <span className={`flex items-center gap-1 text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${disciplineColor}`}>
                            <DiscIcon className="size-2.5" />
                            {calc.discipline}
                          </span>
                          <span className="text-[9px] font-mono text-muted-foreground/80 truncate max-w-[120px]">
                            {calc.standard}
                          </span>
                        </div>
                        <h4 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">
                          {calc.name}
                        </h4>
                        <p className="text-[10.5px] text-muted-foreground line-clamp-2 mt-1 leading-snug">
                          {calc.desc}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/40 text-[10.5px] font-semibold text-muted-foreground group-hover:text-primary transition-colors">
                        <span>Launch Engine</span>
                        <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Side: Productivity Companion Panel (exact match to projects.tsx) */}
          <div className="w-full lg:w-[320px] shrink-0 border-t lg:border-t-0 lg:border-l border-border/70 bg-card/30 dark:bg-zinc-950/40 backdrop-blur-md p-5 flex flex-col gap-5 overflow-y-auto custom-scrollbar select-none">
            
            {/* Recently Opened */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Recently Opened</h3>
              <div className="flex flex-col gap-2">
                {[...projects].sort((a,b) => (workspaceHistory[b.id] || new Date((b as any).updated_at || (b as any).created_at || 0).getTime()) - (workspaceHistory[a.id] || new Date((a as any).updated_at || (a as any).created_at || 0).getTime())).slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    onClick={() => handleOpenWorkspace(p.id)}
                    className="flex items-center justify-between p-2.5 bg-card/70 border border-border/70 rounded-xl hover:bg-surface-2 hover:border-primary/40 transition-all cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-7 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center shrink-0">
                        <Building2 className="size-3.5" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{p.name}</span>
                        <span className="text-[9.5px] text-muted-foreground font-mono">{p.code}</span>
                      </div>
                    </div>
                    <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-primary transition-colors shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Workspace Activity</h3>
              <div className="flex flex-col gap-2.5">
                {globalActivity.length > 0 ? globalActivity.slice(0, 4).map(act => (
                  <div key={act.id} className="flex gap-2 text-xs leading-relaxed">
                    <div className={`size-1.5 rounded-full ${act.color || 'bg-primary'} mt-1.5 shrink-0`} />
                    <div className="flex flex-col">
                      <span className="font-medium text-foreground text-[11.5px]">{act.action}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {act.detail} · {Math.max(1, Math.floor((Date.now() - act.time) / 60000))}m ago
                      </span>
                    </div>
                  </div>
                )) : (
                  <div className="flex gap-2 text-xs leading-relaxed">
                    <div className="size-1.5 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-medium text-muted-foreground text-[11.5px]">No recent activity</span>
                      <span className="text-[10px] text-muted-foreground/70">Open a calculator to record activity</span>
                    </div>
                  </div>
                )}
              </div>
            </div>



          </div>
        </div>
      </div>

      {/* Full Projects Searchable Modal Dialog (Opens when clicking any bar, pill, or tooltip action) */}
      {selectedTypologyModal && (() => {
        const term = modalSearchTerm.trim().toLowerCase();
        const filtered = selectedTypologyModal.projects.filter(p => {
          if (!term) return true;
          const name = (p.name || '').toLowerCase();
          const code = (p.code || '').toLowerCase();
          const client = (p.client || '').toLowerCase();
          const stage = (p.current_stage || '').toLowerCase();
          return name.includes(term) || code.includes(term) || client.includes(term) || stage.includes(term);
        });
        return (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => { setSelectedTypologyModal(null); setModalSearchTerm(""); }}
          >
            <div
              className="bg-card dark:bg-zinc-900 border border-border rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border/70 bg-surface-1/40">
                <div className="flex items-center gap-3">
                  <div
                    className="size-9 rounded-xl flex items-center justify-center text-white shadow-xs"
                    style={{ backgroundColor: selectedTypologyModal.color || "#3474c4" }}
                  >
                    <FolderKanban className="size-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-foreground">
                        {selectedTypologyModal.title}
                      </h3>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        {selectedTypologyModal.count} {selectedTypologyModal.count === 1 ? "Project" : "Projects"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {selectedTypologyModal.percentage !== undefined
                        ? `${selectedTypologyModal.percentage}% of total portfolio projects`
                        : "Filtered portfolio category"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedTypologyModal(null); setModalSearchTerm(""); }}
                  className="size-8 rounded-lg hover:bg-surface-2 dark:hover:bg-zinc-800 flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Search & Stats Bar */}
              <div className="p-3 border-b border-border/60 bg-surface-2/30 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="size-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    placeholder={`Search in ${selectedTypologyModal.count} projects by name, code, client...`}
                    className="w-full bg-background border border-border/80 rounded-xl pl-9 pr-8 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition"
                  />
                  {modalSearchTerm && (
                    <button
                      type="button"
                      onClick={() => setModalSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground shrink-0 px-2">
                  {filtered.length} of {selectedTypologyModal.count}
                </div>
              </div>

              {/* Scrollable Project List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {filtered.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs font-semibold">No matching projects found</p>
                    <p className="text-[11px] opacity-70">Try typing a different name, code or stage</p>
                  </div>
                ) : (
                  filtered.map((proj: any, idx: number) => {
                    const stageColor = STAGE_CONFIG[proj.current_stage as ProjectStageName]?.color || "#3474c4";
                    return (
                      <div
                        key={proj.id || idx}
                        onClick={() => {
                          setSelectedTypologyModal(null);
                          setModalSearchTerm("");
                          handleOpenWorkspace(proj.id);
                        }}
                        className="group flex items-center justify-between p-3 rounded-xl border border-border/70 hover:border-primary/50 bg-card hover:bg-surface-2 dark:hover:bg-zinc-800/80 transition-all cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 group-hover:bg-primary group-hover:text-white transition-colors">
                            <Building2 className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                                {proj.name}
                              </span>
                              {proj.code && (
                                <span className="text-[10px] font-mono text-muted-foreground bg-surface-2/80 px-1.5 py-0.2 rounded border border-border/60 shrink-0">
                                  {proj.code}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground mt-0.5">
                              {proj.client && <span>{proj.client}</span>}
                              {proj.client && proj.location && <span>•</span>}
                              {proj.location && <span>{proj.location}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          {proj.current_stage && (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0"
                              style={{
                                backgroundColor: `${stageColor}15`,
                                borderColor: `${stageColor}40`,
                                color: stageColor
                              }}
                            >
                              {proj.current_stage}
                            </span>
                          )}
                          <div className="size-7 rounded-lg bg-surface-2 border border-border flex items-center justify-center group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                            <ArrowRight className="size-3.5" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="p-3 border-t border-border/60 bg-surface-1/40 flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-[11px]">Click any project to directly launch its engineering workspace</span>
                <button
                  type="button"
                  onClick={() => { setSelectedTypologyModal(null); setModalSearchTerm(""); }}
                  className="px-3 py-1 text-xs rounded-lg border border-border/80 hover:bg-surface-2 dark:hover:bg-zinc-800 text-foreground transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  FileText, Download, CheckCircle2, AlertTriangle, Clock,
  Search, Wind, Zap, Droplets, Wrench,
  Plus, ExternalLink, Settings2, Trash2, ArrowUpRight,
  Layers, Package, Check, Sparkles, Loader2, Building, ShieldAlert
} from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { useWorkspace } from "@/lib/workspace-store";
import { generateMEPReport, generateMEPBundleZip, generateConsolidatedDossierPdf, type ReportMetaData } from "@/lib/mepReportGenerator";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports & Documentation — Airflow MEP" },
      { name: "description", content: "Generate compliance reports and engineering calculation sheets for project calculators." },
    ],
  }),
  component: ReportsPage,
});

export interface ReportItem {
  id: string;
  name: string;
  discipline: "hvac" | "electrical" | "plumbing";
  disciplineLabel: string;
  standard: string;
  desc: string;
  status: "Live" | "Ready";
  calculatorRoute: string;
}

// EXACT 9 CALCULATORS DEFINED IN APP NAVIGATION
const EXACT_9_REPORTS: ReportItem[] = [
  // HVAC (3)
  {
    id: "preliminary-cooling-load",
    name: "Preliminary Cooling Load",
    discipline: "hvac",
    disciplineLabel: "HVAC",
    standard: "ASHRAE / Carrier E20",
    desc: "Peak sensible, latent, and total cooling capacity summary with space-by-space breakdown.",
    status: "Ready",
    calculatorRoute: "/preliminary-cooling-load",
  },
  {
    id: "ventilation",
    name: "Ventilation (ASHRAE 62.1)",
    discipline: "hvac",
    disciplineLabel: "HVAC",
    standard: "ASHRAE 62.1-2022",
    desc: "Ventilation rates per occupiable space, outdoor air intake, by zone and system.",
    status: "Live",
    calculatorRoute: "/ventilation",
  },
  {
    id: "basement-smoke-calc",
    name: "Basement Smoke Calc",
    discipline: "hvac",
    disciplineLabel: "HVAC",
    standard: "NFPA 92 / BS 7346",
    desc: "Car park emergency smoke extraction (10 ACH), jet fans, and stairwell pressurization.",
    status: "Ready",
    calculatorRoute: "/basement-smoke-calc",
  },

  // Electrical (3)
  {
    id: "lpd-calculation",
    name: "LPD Calculation",
    discipline: "electrical",
    disciplineLabel: "Electrical",
    standard: "ASHRAE 90.1-2022",
    desc: "Space-by-space installed lighting watts vs energy code maximum allowances.",
    status: "Live",
    calculatorRoute: "/lpd-calculation",
  },
  {
    id: "busbar-calculation",
    name: "Busbar Calculation",
    discipline: "electrical",
    disciplineLabel: "Electrical",
    standard: "IEC 61439-6 / BS 7671",
    desc: "Busbar trunking sizing, impedance (Rt & R50), fault capacity & voltage drop analysis.",
    status: "Live",
    calculatorRoute: "/busbar-calculation",
  },
  {
    id: "load-summary",
    name: "Load Summary",
    discipline: "electrical",
    disciplineLabel: "Electrical",
    standard: "NEC / IEC 60364",
    desc: "Connected load, diversified demand, power factor, and transformer capacity schedule.",
    status: "Ready",
    calculatorRoute: "/load-summary",
  },

  // Plumbing (3)
  {
    id: "plumbing-loading-unit",
    name: "Loading Unit Calculator",
    discipline: "plumbing",
    disciplineLabel: "Plumbing",
    standard: "BS EN 806 / BS 6700",
    desc: "Sanitary appliances loading units (LU), design flow rate, and pipe sizing estimation.",
    status: "Ready",
    calculatorRoute: "/plumbing-loading-unit",
  },
  {
    id: "plumbing-water-demand",
    name: "Water Demand",
    discipline: "plumbing",
    disciplineLabel: "Plumbing",
    standard: "BS EN 806 / CIPHE",
    desc: "Daily cold/hot water demand, 24-hr potable water storage tank volume & booster pumps.",
    status: "Ready",
    calculatorRoute: "/plumbing-water-demand",
  },
  {
    id: "plumbing-pump-sizing",
    name: "Pump Sizing (Transfer/Booster)",
    discipline: "plumbing",
    disciplineLabel: "Plumbing",
    standard: "BS EN 806 / ASPE",
    desc: "Domestic water transfer & booster pump flow, static lift, friction head & motor kW.",
    status: "Ready",
    calculatorRoute: "/plumbing-pump-sizing",
  },
];

interface ExportHistoryItem {
  id: string;
  reportId: string;
  name: string;
  format: "PDF" | "XLSX";
  timestamp: string;
  revNo: string;
}

function getDisciplineTheme(disc: string) {
  switch (disc) {
    case "hvac":
      return { icon: Wind, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40", border: "border-cyan-200 dark:border-cyan-800/40" };
    case "electrical":
      return { icon: Zap, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/40", border: "border-amber-200 dark:border-amber-800/40" };
    case "plumbing":
      return { icon: Wrench, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-200 dark:border-blue-800/40" };
    default:
      return { icon: FileText, color: "text-slate-600 dark:text-slate-400", bg: "bg-slate-50 dark:bg-slate-950/40", border: "border-slate-200 dark:border-slate-800/40" };
  }
}

function ReportsPage() {
  const { project, spaces, zones, equipment } = useWorkspace();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");

  // Selection for Batch Handover Bundle (all 9 selected by default)
  const [selectedBundleIds, setSelectedBundleIds] = useState<Set<string>>(() => {
    return new Set(EXACT_9_REPORTS.map((r) => r.id));
  });

  // Loading States
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [dossierGenerating, setDossierGenerating] = useState(false);
  const [bundleProgress, setBundleProgress] = useState<{ current: number; total: number; name: string } | null>(null);

  // Export History (persisted in localStorage)
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_report_export_history");
        if (saved) return JSON.parse(saved);
      } catch (e) {}
    }
    return [
      { id: "h1", reportId: "ventilation", name: "Ventilation (ASHRAE 62.1)", format: "PDF", timestamp: "2h ago", revNo: "Rev 0 - IFC" },
      { id: "h2", reportId: "busbar-calculation", name: "Busbar Calculation", format: "PDF", timestamp: "Today 11:20 AM", revNo: "Rev 0 - IFC" },
    ];
  });

  const addHistoryItem = (reportId: string, name: string, revNo: string) => {
    const newItem: ExportHistoryItem = {
      id: `hist-${Date.now()}`,
      reportId,
      name,
      format: "PDF",
      timestamp: "Just now",
      revNo,
    };
    setExportHistory((prev) => {
      const updated = [newItem, ...prev.slice(0, 19)];
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("mep_report_export_history", JSON.stringify(updated));
        } catch (e) {}
      }
      return updated;
    });
  };

  const clearHistory = () => {
    setExportHistory([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("mep_report_export_history");
    }
    toast.success("Export history cleared");
  };

  // Modals State
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [activeReportForModal, setActiveReportForModal] = useState<ReportItem | null>(null);
  const [newReportModalOpen, setNewReportModalOpen] = useState(false);

  // Configuration Form State
  const [configData, setConfigData] = useState({
    revNo: "Rev 0 - IFC",
    authorName: "Lead MEP Engineer",
    calcNo: "",
    projectName: "",
    projectNo: "",
    clientName: "",
    includeStamp: true,
    includeCover: true,
  });

  // Custom Report Form State
  const [customReportData, setCustomReportData] = useState<{
    title: string;
    discipline: string;
    audience: string;
    packageType: "ZIP" | "PDF";
    selectedCalcIds: string[];
  }>({
    title: "Project Engineering Handover Package",
    discipline: "All Disciplines",
    audience: "Authority Submission",
    packageType: "ZIP",
    selectedCalcIds: EXACT_9_REPORTS.map((r) => r.id),
  });

  // Pre-populate project meta
  useEffect(() => {
    if (project) {
      setConfigData((prev) => ({
        ...prev,
        projectName: project.name || "Airflow Project",
        projectNo: (project as any).code || (project as any).projectNo || "TRV-MEP-001",
        clientName: (project as any).client || "Client Representative",
      }));
    }
  }, [project]);

  // Live Audit Stats
  const unassignedSpacesCount = useMemo(() => {
    const equipIdSet = new Set(equipment.map((e) => e.id));
    const zoneMap = new Map(zones.map((z) => [z.id, z]));
    return spaces.filter((s) => {
      const z = s.zone ? zoneMap.get(s.zone) : null;
      const hasFa = z?.faAssignment && equipIdSet.has(z.faAssignment);
      const hasEa = z?.eaAssignment && equipIdSet.has(z.eaAssignment);
      return !hasFa && !hasEa;
    }).length;
  }, [spaces, zones, equipment]);

  // Filtered Templates (Always among the 9)
  const filteredReports = useMemo(() => {
    return EXACT_9_REPORTS.filter((r) => {
      const matchDisc = selectedDiscipline === "all" || r.discipline === selectedDiscipline;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.desc.toLowerCase().includes(q) ||
        r.standard.toLowerCase().includes(q) ||
        r.disciplineLabel.toLowerCase().includes(q);
      return matchDisc && matchSearch;
    });
  }, [selectedDiscipline, searchQuery]);

  // Direct Generate Action (Pure PDF)
  const handleGenerate = async (report: ReportItem, customConfig?: typeof configData) => {
    setGeneratingId(report.id);
    const activeCfg = customConfig || configData;
    const meta: ReportMetaData = {
      reportId: report.id,
      reportTitle: report.name,
      discipline: report.disciplineLabel,
      projectName: activeCfg.projectName || project?.name || "Airflow Engineering Project",
      projectNo: activeCfg.projectNo || "TRV-MEP-001",
      revNo: activeCfg.revNo || "Rev 0 - IFC",
      client: activeCfg.clientName || "Client Representative",
      userName: activeCfg.authorName,
      calcNo: activeCfg.calcNo,
      includeStamp: activeCfg.includeStamp,
      includeCover: activeCfg.includeCover,
      format: "PDF",
    };

    const success = await generateMEPReport(meta);
    if (success) {
      addHistoryItem(report.id, report.name, meta.revNo || "Rev 0");
    }
    setGeneratingId(null);
  };

  function getDefaultCalcNo(reportId: string, revNo: string): string {
    const shortRev = revNo.match(/Rev\s*([0-9A-Z]+)/i)?.[1] || (revNo.includes("Tender") ? "TND" : "01");
    const idMap: Record<string, string> = {
      "preliminary-cooling-load": "CALC-HVAC-PCL",
      "ventilation": "CALC-HVAC-VENT",
      "ashrae-62-1": "CALC-HVAC-VENT",
      "basement-smoke-calc": "CALC-HVAC-SMK",
      "basement-smoke": "CALC-HVAC-SMK",
      "lpd-calculation": "CALC-ELEC-LPD",
      "busbar-calculation": "CALC-ELEC-BUS",
      "load-summary": "CALC-ELEC-LDS",
      "plumbing-loading-unit": "CALC-PLB-LU",
      "plumbing-water-demand": "CALC-PLB-WTR",
      "plumbing-pump-sizing": "CALC-PLB-PMP",
    };
    const prefix = idMap[reportId] || `CALC-${reportId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)}`;
    return `${prefix}-R${shortRev}`;
  }

  // Open Configure Modal for a Report
  const openConfigureModal = (report: ReportItem) => {
    setActiveReportForModal(report);
    setConfigData((prev) => ({
      ...prev,
      calcNo: getDefaultCalcNo(report.id, prev.revNo),
    }));
    setConfigModalOpen(true);
  };

  // 1. Batch Export Handover Bundle as ZIP (Packages all 9 PDFs into 1 archive)
  const handleDownloadZipBundle = async () => {
    if (selectedBundleIds.size === 0) {
      toast.error("Please select at least one report to bundle.");
      return;
    }

    setBatchGenerating(true);
    const selectedReports = EXACT_9_REPORTS.filter((r) => selectedBundleIds.has(r.id));
    setBundleProgress({ current: 0, total: selectedReports.length, name: "Initializing package..." });

    try {
      const ok = await generateMEPBundleZip(
        selectedReports,
        {
          projectName: configData.projectName || project?.name || "Airflow Engineering Project",
          projectNo: configData.projectNo || "TRV-MEP-001",
          revNo: configData.revNo || "Rev 0 - IFC",
          client: configData.clientName || "Client Representative",
          userName: configData.authorName,
          includeStamp: configData.includeStamp,
          includeCover: configData.includeCover,
          includeMasterPdf: true,
        },
        (completed, total, currentName) => {
          setBundleProgress({ current: completed, total, name: currentName });
        }
      );

      if (ok) {
        addHistoryItem("bundle-zip", `Handover ZIP Package (${selectedReports.length} Reports)`, configData.revNo || "Rev 0");
      }
    } catch (e: any) {
      console.error("Bundle ZIP export failed:", e);
      toast.error(`Bundle download failed: ${e?.message || "Unknown error"}`);
    } finally {
      setBatchGenerating(false);
      setBundleProgress(null);
    }
  };

  // 2. Download Consolidated Master Dossier as a single multi-page PDF
  const handleDownloadMasterDossierPdf = async () => {
    if (selectedBundleIds.size === 0) {
      toast.error("Please select at least one report to compile.");
      return;
    }

    setDossierGenerating(true);
    const selectedReports = EXACT_9_REPORTS.filter((r) => selectedBundleIds.has(r.id));
    toast.info(`Assembling Master Dossier PDF for ${selectedReports.length} reports...`);

    try {
      const ok = await generateConsolidatedDossierPdf(selectedReports, {
        projectName: configData.projectName || project?.name || "Airflow Engineering Project",
        projectNo: configData.projectNo || "TRV-MEP-001",
        revNo: configData.revNo || "Rev 0 - IFC",
        client: configData.clientName || "Client Representative",
        userName: configData.authorName,
        includeStamp: configData.includeStamp,
      });

      if (ok) {
        addHistoryItem("master-dossier", `Master Handover Dossier PDF (${selectedReports.length} Reports)`, configData.revNo || "Rev 0");
      }
    } catch (e: any) {
      console.error("Master Dossier PDF generation failed:", e);
      toast.error(`Master Dossier export failed: ${e?.message || "Unknown error"}`);
    } finally {
      setDossierGenerating(false);
    }
  };

  // Alias for compatibility
  const handleBatchExport = handleDownloadZipBundle;

  // Toggle Selection in Bundle
  const toggleBundleSelection = (id: string) => {
    setSelectedBundleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBundle = () => {
    setSelectedBundleIds(new Set(EXACT_9_REPORTS.map((r) => r.id)));
    toast.success(`Selected all 9 reports`);
  };

  const clearBundleSelection = () => {
    setSelectedBundleIds(new Set());
  };

  // Generate Custom Package from Modal
  const handleGenerateCustomPackage = async () => {
    const selectedReports = EXACT_9_REPORTS.filter((r) =>
      customReportData.selectedCalcIds.includes(r.id)
    );

    if (selectedReports.length === 0) {
      toast.error("Please select at least one calculation to include.");
      return;
    }

    setNewReportModalOpen(false);

    if (customReportData.packageType === "PDF") {
      // Single Master PDF compilation with authentic formats
      setDossierGenerating(true);
      toast.info(`Assembling Master Dossier PDF for ${selectedReports.length} calculations...`);
      try {
        const ok = await generateConsolidatedDossierPdf(selectedReports, {
          projectName: configData.projectName || project?.name || "Airflow Engineering Project",
          projectNo: configData.projectNo || "TRV-MEP-001",
          revNo: configData.revNo || "Rev 0 - IFC",
          client: configData.clientName || "Client Representative",
          userName: configData.authorName,
          includeStamp: configData.includeStamp,
          title: customReportData.title || "Project Calculation Handover Dossier",
        });
        if (ok) {
          addHistoryItem(
            "custom-dossier",
            `${customReportData.title || "Handover Dossier"} (${selectedReports.length} Calcs)`,
            configData.revNo || "Rev 0"
          );
        }
      } catch (err: any) {
        console.error("Custom dossier PDF generation failed:", err);
        toast.error(`Custom dossier generation failed: ${err?.message || "Unknown error"}`);
      } finally {
        setDossierGenerating(false);
      }
    } else {
      // ZIP bundle of the exact authentic calculation PDFs
      setBatchGenerating(true);
      setBundleProgress({ current: 0, total: selectedReports.length, name: "Initializing package..." });
      try {
        const ok = await generateMEPBundleZip(
          selectedReports,
          {
            projectName: configData.projectName || project?.name || "Airflow Engineering Project",
            projectNo: configData.projectNo || "TRV-MEP-001",
            revNo: configData.revNo || "Rev 0 - IFC",
            client: configData.clientName || "Client Representative",
            userName: configData.authorName,
            includeStamp: configData.includeStamp,
            includeCover: configData.includeCover,
            includeMasterPdf: true,
          },
          (completed, total, currentName) => {
            setBundleProgress({ current: completed, total, name: currentName });
          }
        );
        if (ok) {
          addHistoryItem(
            "custom-zip",
            `${customReportData.title || "Handover Bundle"} (${selectedReports.length} Reports)`,
            configData.revNo || "Rev 0"
          );
        }
      } catch (err: any) {
        console.error("Custom bundle ZIP generation failed:", err);
        toast.error(`Custom bundle generation failed: ${err?.message || "Unknown error"}`);
      } finally {
        setBatchGenerating(false);
        setBundleProgress(null);
      }
    }
  };

  return (
    <AppShell
      title="Reports & Documentation"
      subtitle={`9 engineering templates • Project: ${project?.name || "Active Workspace"}`}
      actions={
        <div className="flex items-center gap-2">
          <TBtn onClick={handleDownloadZipBundle} disabled={batchGenerating || dossierGenerating || selectedBundleIds.size === 0} primary>
            {batchGenerating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Package className="size-3.5" />
            )}
            Download Bundle ({selectedBundleIds.size})
          </TBtn>
          <TBtn onClick={() => setNewReportModalOpen(true)}>
            <Plus className="size-3.5" /> New Report
          </TBtn>
        </div>
      }
    >
      <div className="p-4 md:p-6 overflow-auto h-full flex flex-col gap-5">
        {/* Top Filter and Search Toolbar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface-1 border border-border p-3 rounded-lg shadow-xs">
          {/* Discipline Filter Tabs: All (9), HVAC (3), Electrical (3), Plumbing (3) */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { id: "all", label: "All Disciplines", count: EXACT_9_REPORTS.length },
              { id: "hvac", label: "HVAC", count: EXACT_9_REPORTS.filter((r) => r.discipline === "hvac").length },
              { id: "electrical", label: "Electrical", count: EXACT_9_REPORTS.filter((r) => r.discipline === "electrical").length },
              { id: "plumbing", label: "Plumbing", count: EXACT_9_REPORTS.filter((r) => r.discipline === "plumbing").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedDiscipline(tab.id)}
                className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                  selectedDiscipline === tab.id
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
                }`}
              >
                {tab.label}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    selectedDiscipline === tab.id
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-surface-2 text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 md:w-72">
            <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search 9 reports, codes, standards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-[12px] rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-[10px] cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Main Content Layout: Catalog (Left) + Dossier & History Panel (Right) */}
        <div className="flex flex-col lg:flex-row items-start gap-5">
          {/* LEFT: 9 Reports Catalog Grid (3 x 3) */}
          <div className="w-full lg:flex-1 flex flex-col gap-4 min-w-0">
            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-surface-1 border border-border rounded-lg p-2.5 flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <Building className="size-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Spaces in Project</div>
                  <div className="text-[14px] font-bold text-foreground">{spaces.length} Spaces</div>
                </div>
              </div>

              <div className="bg-surface-1 border border-border rounded-lg p-2.5 flex items-center gap-3">
                <div className="p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Layers className="size-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Thermal Zones</div>
                  <div className="text-[14px] font-bold text-foreground">{zones.length} Zones</div>
                </div>
              </div>

              <div className="bg-surface-1 border border-border rounded-lg p-2.5 flex items-center gap-3">
                <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Assigned Plant</div>
                  <div className="text-[14px] font-bold text-foreground">{equipment.length} Units</div>
                </div>
              </div>

              <div className={`border rounded-lg p-2.5 flex items-center gap-3 ${
                unassignedSpacesCount > 0
                  ? "bg-amber-500/5 border-amber-300 dark:border-amber-800/60"
                  : "bg-surface-1 border-border"
              }`}>
                <div className={`p-2 rounded-md ${
                  unassignedSpacesCount > 0 ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-primary/10 text-primary"
                }`}>
                  {unassignedSpacesCount > 0 ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Audit Status</div>
                  <div className={`text-[13px] font-bold ${unassignedSpacesCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {unassignedSpacesCount > 0 ? `${unassignedSpacesCount} Unassigned` : "100% Assigned"}
                  </div>
                </div>
              </div>
            </div>

            {/* Template Cards Grid (3 Columns = 3x3 layout) */}
            {filteredReports.length === 0 ? (
              <div className="bg-surface-1 border border-dashed border-border rounded-xl p-12 text-center flex flex-col items-center justify-center">
                <FileText className="size-10 text-muted-foreground/40 mb-3" />
                <h3 className="text-[15px] font-semibold text-foreground">No reports match your filters</h3>
                <p className="text-[12.5px] text-muted-foreground mt-1 max-w-sm">
                  Try adjusting your search query or discipline filter tabs to discover available calculation reports.
                </p>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedDiscipline("all");
                    setSelectedFormat("all");
                  }}
                  className="mt-4 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-medium cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                {filteredReports.map((r) => {
                  const theme = getDisciplineTheme(r.discipline);
                  const Icon = theme.icon;
                  const isSelectedForBundle = selectedBundleIds.has(r.id);
                  const isGeneratingThis = generatingId === r.id;

                  return (
                    <div
                      key={r.id}
                      className={`border rounded-lg p-4 bg-background transition-all flex flex-col justify-between group hover:shadow-md ${
                        isSelectedForBundle
                          ? "border-primary/50 shadow-xs ring-1 ring-primary/20"
                          : "border-border hover:border-border-strong"
                      }`}
                    >
                      <div>
                        {/* Header Row */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-md border ${theme.bg} ${theme.border} ${theme.color}`}>
                              <Icon className="size-3.5" />
                            </div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {r.disciplineLabel}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Standard Pill */}
                            <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-surface-2 text-muted-foreground border border-border">
                              {r.standard}
                            </span>

                            {/* Bundle Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleBundleSelection(r.id)}
                              title={isSelectedForBundle ? "Remove from bundle" : "Add to export bundle"}
                              className={`size-5 rounded flex items-center justify-center border transition-colors cursor-pointer ${
                                isSelectedForBundle
                                  ? "bg-primary border-primary text-primary-foreground"
                                  : "border-border hover:border-primary/50 bg-surface-1 text-transparent"
                              }`}
                            >
                              <Check className="size-3" />
                            </button>
                          </div>
                        </div>

                        {/* Title & Description */}
                        <h3 className="mt-3 text-[14px] font-semibold text-foreground group-hover:text-primary transition-colors flex items-center justify-between">
                          <span>{r.name}</span>
                          {r.status === "Live" && (
                            <span className="text-[9.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Live Data
                            </span>
                          )}
                        </h3>
                        <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed line-clamp-2">
                          {r.desc}
                        </p>
                      </div>

                      {/* Footer Actions */}
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
                        {/* Left action buttons */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Direct PDF Download */}
                          <TBtn
                            onClick={() => handleGenerate(r)}
                            disabled={isGeneratingThis}
                            className="h-7 px-3 text-[11.5px]"
                          >
                            {isGeneratingThis ? (
                              <Loader2 className="size-3 animate-spin text-primary" />
                            ) : (
                              <Download className="size-3 text-primary" />
                            )}
                            PDF
                          </TBtn>

                          {/* Configure & Generate Modal */}
                          <button
                            type="button"
                            onClick={() => openConfigureModal(r)}
                            title="Configure parameters & export"
                            className="size-7 rounded-full flex items-center justify-center border border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                          >
                            <Settings2 className="size-3" />
                          </button>
                        </div>

                        {/* Link to actual calculator */}
                        {r.calculatorRoute && (
                          <Link
                            to={r.calculatorRoute}
                            title="Open related calculator"
                            className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <span>Calc</span>
                            <ArrowUpRight className="size-3" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT: Master Handover Package & Export History Panel */}
          <div className="w-full lg:w-80 shrink-0 flex flex-col gap-4">
            {/* 1. Master Handover Dossier Box */}
            <div className="border border-border rounded-xl bg-surface-1 p-4 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  <h4 className="text-[13px] font-bold text-foreground">Project Handover Dossier</h4>
                </div>
                <span className="text-[10.5px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono">
                  {selectedBundleIds.size} / {EXACT_9_REPORTS.length}
                </span>
              </div>

              <p className="text-[11.5px] text-muted-foreground mt-2 leading-relaxed">
                Bundle the 9 MEP calculation sheets into a consolidated engineering handover package.
              </p>

              {/* Quick Selection Shortcuts */}
              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={selectAllBundle}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-background border border-border hover:bg-surface-2 text-foreground cursor-pointer transition-colors"
                >
                  Select All (9)
                </button>
                <button
                  type="button"
                  onClick={clearBundleSelection}
                  className="px-2.5 py-1 rounded text-[11px] font-medium bg-background border border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  Clear
                </button>
              </div>

              {/* Live Progress Card while bundling */}
              {batchGenerating && (
                <div className="mt-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex flex-col gap-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-[11px] font-bold text-primary">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="size-3.5 animate-spin" /> Packaging Dossier...
                    </span>
                    <span className="font-mono text-[10px]">
                      {bundleProgress?.current || 0} / {bundleProgress?.total || selectedBundleIds.size}
                    </span>
                  </div>
                  <div className="text-[10.5px] text-muted-foreground truncate">
                    {bundleProgress?.name || "Processing calculations..."}
                  </div>
                  <div className="w-full bg-primary/20 h-1.5 rounded-full overflow-hidden mt-0.5">
                    <div
                      className="bg-primary h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${Math.round(
                          ((bundleProgress?.current || 0) / (bundleProgress?.total || selectedBundleIds.size || 1)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {dossierGenerating && (
                <div className="mt-3 p-2.5 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-[11px] font-bold text-primary animate-in fade-in duration-200">
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Compiling Consolidated Master PDF...</span>
                </div>
              )}

              {/* Handover Download Actions */}
              <div className="mt-3.5 flex flex-col gap-2">
                {/* 1. Primary Action: ZIP Bundle */}
                <button
                  type="button"
                  onClick={handleDownloadZipBundle}
                  disabled={batchGenerating || dossierGenerating || selectedBundleIds.size === 0}
                  className="w-full h-8.5 rounded-md bg-primary text-primary-foreground font-semibold text-[12px] flex items-center justify-center gap-2 shadow-xs hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {batchGenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Creating ZIP Archive...</span>
                    </>
                  ) : (
                    <>
                      <Package className="size-3.5" />
                      <span>Download ZIP Bundle ({selectedBundleIds.size} PDFs)</span>
                    </>
                  )}
                </button>

                {/* 2. Secondary Action: Single Master PDF */}
                <button
                  type="button"
                  onClick={handleDownloadMasterDossierPdf}
                  disabled={batchGenerating || dossierGenerating || selectedBundleIds.size === 0}
                  className="w-full h-8 rounded-md bg-background border border-border hover:bg-surface-2 text-foreground font-medium text-[11.5px] flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {dossierGenerating ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      <span>Compiling Master PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="size-3.5 text-primary" />
                      <span>Download Master Dossier (.pdf)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Help / Manifest Note */}
              <div className="mt-3 pt-2.5 border-t border-border/60 text-[10.5px] text-muted-foreground leading-normal flex items-start gap-1.5">
                <Sparkles className="size-3 text-primary mt-0.5 shrink-0" />
                <span>Packages all {selectedBundleIds.size} calculation PDFs, Master Dossier, and QA/QC Sign-off manifest in 1 single file.</span>
              </div>
            </div>

            {/* 2. Unassigned Spaces Alert Card (if any) */}
            {unassignedSpacesCount > 0 && (
              <div className="border border-amber-300 dark:border-amber-800/80 rounded-xl bg-amber-500/5 p-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="size-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <h5 className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200">
                      QA/QC Audit Alert
                    </h5>
                    <p className="text-[11.5px] text-amber-800/80 dark:text-amber-300/80 mt-1 leading-relaxed">
                      {unassignedSpacesCount} spaces in this project lack HVAC equipment assignments.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        generateMEPReport({
                          reportId: "spaces-audit",
                          reportTitle: "Spaces Without Equipment Audit",
                          discipline: "Audit & QA/QC",
                          projectName: project?.name || "Airflow Project",
                          projectNo: "TRV-MEP-001",
                          revNo: configData.revNo,
                          format: "PDF",
                        })
                      }
                      className="mt-2.5 inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                    >
                      <Download className="size-3" />
                      Download Missing Spaces Audit (PDF)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Export History & Activity Log */}
            <div className="border border-border rounded-xl bg-surface-1 p-4 shadow-xs flex flex-col flex-1">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  <h4 className="text-[13px] font-bold text-foreground">Recent Downloads</h4>
                </div>
                {exportHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    title="Clear history"
                    className="text-[10px] text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>

              {exportHistory.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-[11.5px]">
                  No reports downloaded yet in this session.
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-border/60 mt-1 max-h-80 overflow-y-auto pr-1">
                  {exportHistory.map((item) => {
                    const matchedReport = EXACT_9_REPORTS.find((t) => t.id === item.reportId);

                    return (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-2 group">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-semibold text-primary/80">{item.format}</span>
                            <span>•</span>
                            <span>{item.revNo}</span>
                            <span>•</span>
                            <span>{item.timestamp}</span>
                          </div>
                        </div>

                        {/* Instant Re-download */}
                        {matchedReport && (
                          <button
                            type="button"
                            onClick={() => handleGenerate(matchedReport, item.format)}
                            title="Download again"
                            className="size-7 rounded-md flex items-center justify-center border border-border hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors shrink-0"
                          >
                            <Download className="size-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Configure & Export Modal */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold flex items-center gap-2">
              <Settings2 className="size-4 text-primary" />
              Configure & Export Report
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Customise engineering metadata, revision numbering, and official stamp options for{" "}
              <strong className="text-foreground">{activeReportForModal?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-[12px]">
            {/* Revision & Calc Number */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Revision Code
                </label>
                <select
                  value={configData.revNo}
                  onChange={(e) => {
                    const newRev = e.target.value;
                    setConfigData((prev) => {
                      const oldDefault = activeReportForModal ? getDefaultCalcNo(activeReportForModal.id, prev.revNo) : "";
                      const shouldAutoUpdate = !prev.calcNo || prev.calcNo === oldDefault || prev.calcNo.endsWith("-Rev");
                      return {
                        ...prev,
                        revNo: newRev,
                        calcNo: (shouldAutoUpdate && activeReportForModal) ? getDefaultCalcNo(activeReportForModal.id, newRev) : prev.calcNo,
                      };
                    });
                  }}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
                >
                  <option value="Rev 0 - IFC">Rev 0 - IFC (Construction)</option>
                  <option value="Rev 1 - For Review">Rev 1 - For Review</option>
                  <option value="Rev 2 - For Approval">Rev 2 - For Approval</option>
                  <option value="Rev A - Preliminary">Rev A - Preliminary</option>
                  <option value="Tender Issue">Tender Issue</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Doc / Calc Number
                </label>
                <input
                  type="text"
                  value={configData.calcNo}
                  onChange={(e) => setConfigData({ ...configData, calcNo: e.target.value })}
                  placeholder="CALC-MEP-001"
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
                />
              </div>
            </div>

            {/* Engineer Name */}
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Lead Engineer / Originator
              </label>
              <input
                type="text"
                value={configData.authorName}
                onChange={(e) => setConfigData({ ...configData, authorName: e.target.value })}
                placeholder="Engineer Name"
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
              />
            </div>

            {/* Project Name & Client */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={configData.projectName}
                  onChange={(e) => setConfigData({ ...configData, projectName: e.target.value })}
                  placeholder="Project Name"
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Client Representative
                </label>
                <input
                  type="text"
                  value={configData.clientName}
                  onChange={(e) => setConfigData({ ...configData, clientName: e.target.value })}
                  placeholder="Client"
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
                />
              </div>
            </div>

            {/* Stamp & Header Banner Toggles */}
            <div className="pt-3 border-t border-border flex flex-col gap-2">
              <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 cursor-pointer transition-colors select-none">
                <div className="flex flex-col pr-2">
                  <span className="text-[12px] font-semibold text-foreground">
                    Include Official Engineering Stamp & Signature Block
                  </span>
                  <span className="text-[10.5px] text-muted-foreground mt-0.5">
                    Adds the Originator, Reviewer, and Approver signature table at the bottom
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={configData.includeStamp}
                  onChange={(e) => setConfigData({ ...configData, includeStamp: e.target.checked })}
                  className="size-4.5 rounded text-primary cursor-pointer accent-primary shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface-1 hover:bg-surface-2 cursor-pointer transition-colors select-none">
                <div className="flex flex-col pr-2">
                  <span className="text-[12px] font-semibold text-foreground">
                    Include Professional Header Banner & Company Metadata
                  </span>
                  <span className="text-[10.5px] text-muted-foreground mt-0.5">
                    Includes the top Navy header banner, Project & Client info, and Calc No box
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={configData.includeCover}
                  onChange={(e) => setConfigData({ ...configData, includeCover: e.target.checked })}
                  className="size-4.5 rounded text-primary cursor-pointer accent-primary shrink-0"
                />
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setConfigModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-border text-[12px] font-medium hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!activeReportForModal) return;
                const target = activeReportForModal;
                const currentConfig = { ...configData };
                setConfigModalOpen(false);
                await handleGenerate(target, currentConfig);
              }}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="size-3.5" />
              Generate & Download (PDF)
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: + New Custom Report Modal */}
      <Dialog open={newReportModalOpen} onOpenChange={setNewReportModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Create Custom Engineering Package
            </DialogTitle>
            <DialogDescription className="text-[12px]">
              Assemble authentic calculation sheets from the 9 active calculators into an engineering submission package.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2 text-[12px]">
            <div>
              <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                Report / Dossier Title
              </label>
              <input
                type="text"
                value={customReportData.title}
                onChange={(e) => setCustomReportData({ ...customReportData, title: e.target.value })}
                placeholder="e.g. Project Engineering Handover Package"
                className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Package Output Format
                </label>
                <select
                  value={customReportData.packageType}
                  onChange={(e) =>
                    setCustomReportData({ ...customReportData, packageType: e.target.value as "ZIP" | "PDF" })
                  }
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
                >
                  <option value="ZIP">ZIP Package (Authentic Individual PDFs)</option>
                  <option value="PDF">Consolidated Master PDF (Multi-Sheet Dossier)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Target Audience
                </label>
                <select
                  value={customReportData.audience}
                  onChange={(e) => setCustomReportData({ ...customReportData, audience: e.target.value })}
                  className="w-full h-8 px-2.5 rounded-md border border-border bg-background text-foreground text-[12px]"
                >
                  <option value="Authority Submission">Authority Submission</option>
                  <option value="Client Handover">Client Handover</option>
                  <option value="Tender / Contractor">Tender / Contractor</option>
                  <option value="Internal QA/QC">Internal QA/QC</option>
                </select>
              </div>
            </div>

            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-semibold text-muted-foreground">
                  Select Calculations ({customReportData.selectedCalcIds.length} of 9):
                </label>
                <div className="flex items-center gap-1.5 text-[10px]">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomReportData({ ...customReportData, selectedCalcIds: EXACT_9_REPORTS.map((r) => r.id) })
                    }
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    All
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomReportData({
                        ...customReportData,
                        selectedCalcIds: EXACT_9_REPORTS.filter((r) => r.discipline === "hvac").map((r) => r.id),
                      })
                    }
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    HVAC
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomReportData({
                        ...customReportData,
                        selectedCalcIds: EXACT_9_REPORTS.filter((r) => r.discipline === "electrical").map((r) => r.id),
                      })
                    }
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Electrical
                  </button>
                  <span className="text-muted-foreground">•</span>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomReportData({
                        ...customReportData,
                        selectedCalcIds: EXACT_9_REPORTS.filter((r) => r.discipline === "plumbing").map((r) => r.id),
                      })
                    }
                    className="text-primary hover:underline font-medium cursor-pointer"
                  >
                    Plumbing
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
                {EXACT_9_REPORTS.map((report) => {
                  const isChecked = customReportData.selectedCalcIds.includes(report.id);
                  return (
                    <label
                      key={report.id}
                      className="flex items-center justify-between p-2 rounded-md border border-border bg-surface-1 hover:bg-surface-2 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const newIds = e.target.checked
                              ? [...customReportData.selectedCalcIds, report.id]
                              : customReportData.selectedCalcIds.filter((id) => id !== report.id);
                            setCustomReportData({ ...customReportData, selectedCalcIds: newIds });
                          }}
                          className="rounded text-primary size-3.5"
                        />
                        <span className="text-[12px] font-medium">{report.name}</span>
                      </div>
                      <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {report.disciplineLabel}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <button
              type="button"
              onClick={() => setNewReportModalOpen(false)}
              className="px-3 py-1.5 rounded-md border border-border text-[12px] font-medium hover:bg-surface-2 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerateCustomPackage}
              disabled={customReportData.selectedCalcIds.length === 0}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/90 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              Generate Custom Package ({customReportData.selectedCalcIds.length})
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
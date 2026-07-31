import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import {
  LayoutDashboard, AlertTriangle, CheckCircle2, ChevronRight,
  TrendingUp, Activity, ShieldCheck, Layers, Boxes, FileText
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/" });
  },
});

export function DashboardPage() {
  const { spaces, zones, equipment } = useWorkspace();

  const stats = useMemo(() => {
    // Total ventilation flowrate
    const totalFresh = spaces.reduce((sum, s) => sum + (s.freshAir || 0), 0);
    const totalExtract = spaces.reduce((sum, s) => sum + (s.extractAir || 0), 0);

    // Active warnings count
    // Spaces with zero air flow but requires occupancy ventilation, or negative pressure imbalance
    let warnings = 0;
    spaces.forEach((s) => {
      if (s.freshAir === 0 && s.occupancy && s.occupancy > 0) warnings++;
      if (s.freshAir < (s.minOA || 0)) warnings++;
    });

    zones.forEach((z) => {
      if (z.pressureType === "neutral" && Math.abs(z.pressure) > 50) warnings++;
    });

    const compliance = Math.max(0, Math.min(100, Math.round(100 - (warnings / (spaces.length || 1)) * 100)));

    return {
      totalFresh,
      totalExtract,
      warnings,
      compliance,
    };
  }, [spaces, zones]);

  // List of active alerts to display on dashboard
  const activeAlerts = useMemo(() => {
    const alerts: Array<{ id: string; title: string; desc: string; type: "critical" | "warning" }> = [];
    
    // Check for high pressure differences
    zones.forEach((z) => {
      if (Math.abs(z.pressure) > 100) {
        alerts.push({
          id: `zone-${z.id}`,
          title: `Zone Imbalance: ${z.name}`,
          desc: `Flow imbalance is ${z.pressure > 0 ? "+" : ""}${z.pressure.toFixed(0)} L/s. Door force criteria may fail.`,
          type: "critical",
        });
      }
    });

    // Check for spaces with insufficient fresh air
    spaces.slice(0, 4).forEach((s) => {
      if (s.freshAir < (s.minOA || 0)) {
        alerts.push({
          id: `space-${s.id}`,
          title: `Low Fresh Air: ${s.name}`,
          desc: `Supplying ${s.freshAir} L/s but design standard requires minimum ${s.minOA} L/s.`,
          type: "warning",
        });
      }
    });

    return alerts;
  }, [spaces, zones]);

  return (
    <AppShell title="Dashboard" subtitle="Active metrics summary">
      <div className="p-6 overflow-y-auto h-full bg-slate-50/30 dark:bg-zinc-950/20">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          {/* Quick stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-5">
            <StatCard
              icon={<Layers className="size-5 text-primary" />}
              label="Total Spaces"
              value={spaces.length}
              desc="Active design rooms"
            />
            <StatCard
              icon={<Boxes className="size-5 text-primary" />}
              label="Equipment Count"
              value={equipment.length}
              desc="AHU, Ecology, Fans"
            />
            <StatCard
              icon={<Activity className="size-5 text-success" />}
              label="Fresh Intake"
              value={`${stats.totalFresh.toLocaleString()} L/s`}
              desc="Total treated air"
            />
            <StatCard
              icon={<ShieldCheck className="size-5 text-primary" />}
              label="Compliance"
              value={`${stats.compliance}%`}
              desc="Ventilation compliance score"
              progress={stats.compliance}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
            {/* Active alerts & issues checklist */}
            <div className="border border-border/80 rounded-3xl bg-card p-6 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between border-b border-border/50 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4.5 text-warning" />
                  <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Active Warnings & Compliance Issues</h3>
                </div>
                <span className="text-[10px] font-mono bg-warning/10 text-warning px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  {stats.warnings} Flagged
                </span>
              </div>

              {activeAlerts.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {activeAlerts.map((a) => (
                    <div key={a.id} className={`p-4 rounded-2xl border text-[12.5px] flex gap-3.5 transition-all hover:bg-surface-2 dark:hover:bg-zinc-800/30 ${
                      a.type === "critical" 
                        ? "border-destructive/20 bg-destructive/5 text-destructive-foreground" 
                        : "border-warning/20 bg-warning/5 text-foreground"
                    }`}>
                      <AlertTriangle className={`size-4.5 shrink-0 mt-0.5 ${a.type === "critical" ? "text-destructive" : "text-warning"}`} />
                      <div>
                        <div className="font-bold text-[13px]">{a.title}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-1 font-medium leading-relaxed">{a.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3.5 bg-surface-2 dark:bg-zinc-800/40 rounded-2xl border border-border/80">
                  <CheckCircle2 className="size-10 text-success" />
                  <span className="text-[13px] font-semibold text-center px-4">All spaces and zones comply with current design criteria!</span>
                </div>
              )}
            </div>

            {/* Calculations Index / Shortcut menu */}
            <div className="border border-border/80 rounded-3xl bg-card p-6 flex flex-col gap-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center gap-2 border-b border-border/50 pb-3">
                <LayoutDashboard className="size-4.5 text-primary" />
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-zinc-400">Calculators Quick Access</h3>
              </div>
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1.5 custom-scrollbar">
                <CalcLink name="Cooling Load" label="Cooling Load Sizer" />
                <CalcLink name="Fresh Air Cooling Load" label="Fresh Air Load" />
                <CalcLink name="Heating Load" label="Heating Load" />
                <CalcLink name="Lobby Pressurization" label="Lobby Smoke Control" />
                <CalcLink name="Staircase Pressurization" label="Staircase Overpressure" />
                <Link
                  to="/plumbing-sprinkler-kfactor"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Sprinkler K-Factor</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-sprinkler-density"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Sprinkler Density & Flow</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-hazen-williams"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Hazen-Williams</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-fm200"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>FM-200 Calculation</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-water-demand"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Water Demand Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-fixture-unit"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Fixture Unit Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-loading-unit"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Loading Unit Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-supply-pipe-sizer"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Supply Pipe Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-pump-sizing"
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
                >
                  <span>Pump Sizing (Transfer/Booster)</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </AppShell>
  );
}

function StatCard({ icon, label, value, desc, progress }: { icon: React.ReactNode; label: string; value: string | number; desc: string; progress?: number }) {
  return (
    <div className="border border-border/80 rounded-3xl bg-card p-5 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.02)] min-h-[140px] transition-all hover:shadow-md hover:border-border/100">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="p-2 rounded-xl bg-surface-3 dark:bg-zinc-800/50 flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>
      <div className="mt-2">
        <div className="text-[24px] font-bold tracking-tight font-mono text-foreground">{value}</div>
        <span className="text-[11.5px] text-muted-foreground font-medium mt-0.5 block">{desc}</span>
      </div>
      {progress !== undefined && (
        <div className="w-full h-2.5 bg-[#e2e8f0] dark:bg-zinc-700 rounded-full mt-2 overflow-hidden shadow-inner">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

function CalcLink({ name, label }: { name: string; label: string }) {
  return (
    <Link
      to="/calculators"
      search={{ name }}
      className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-surface-2 dark:hover:bg-zinc-800/40 transition-all border border-transparent hover:border-border/60 text-[12.5px] text-foreground font-semibold group"
    >
      <span>{label}</span>
      <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import {
  LayoutDashboard, AlertTriangle, CheckCircle2, ChevronRight,
  TrendingUp, Activity, ShieldCheck, Layers, Boxes, FileText
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Airflow" },
      { name: "description", content: "System-wide calculations metrics, active warnings, and project compliance." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
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
      <div className="p-6 overflow-y-auto h-full bg-surface/30">
        <div className="max-w-5xl mx-auto flex flex-col gap-6">

          {/* Quick stats grid */}
          <div className="grid grid-cols-4 gap-4">
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

          <div className="grid grid-cols-[1.5fr_1fr] gap-4">
            {/* Active alerts & issues checklist */}
            <div className="border border-border rounded bg-background p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4.5 text-warning" />
                  <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Active Warnings & Compliance Issues</h3>
                </div>
                <span className="text-[11px] font-mono bg-warning/10 text-warning px-2 py-0.5 rounded-full font-semibold">
                  {stats.warnings} Flagged
                </span>
              </div>

              {activeAlerts.length > 0 ? (
                <div className="flex flex-col gap-2.5">
                  {activeAlerts.map((a) => (
                    <div key={a.id} className={`p-3 rounded border text-[12.5px] flex gap-3 ${
                      a.type === "critical" 
                        ? "border-destructive/20 bg-destructive/5 text-destructive-foreground" 
                        : "border-warning/20 bg-warning/5 text-foreground"
                    }`}>
                      <AlertTriangle className={`size-4 shrink-0 mt-0.5 ${a.type === "critical" ? "text-destructive" : "text-warning"}`} />
                      <div>
                        <div className="font-semibold">{a.title}</div>
                        <div className="text-[11.5px] text-muted-foreground mt-0.5">{a.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                  <CheckCircle2 className="size-8 text-success" />
                  <span className="text-[13px] font-medium">All spaces and zones comply with current design criteria!</span>
                </div>
              )}
            </div>

            {/* Calculations Index / Shortcut menu */}
            <div className="border border-border rounded bg-background p-5 flex flex-col gap-4 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border pb-3">
                <LayoutDashboard className="size-4.5 text-primary" />
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Calculators Quick Access</h3>
              </div>
              <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[300px]">
                <CalcLink name="Cooling Load" label="Cooling Load Sizer" />
                <CalcLink name="Fresh Air Cooling Load" label="Fresh Air Load" />
                <CalcLink name="Heating Load" label="Heating Load" />
                <CalcLink name="Lobby Pressurization" label="Lobby Smoke Control" />
                <CalcLink name="Staircase Pressurization" label="Staircase Overpressure" />
                <Link
                  to="/plumbing-sprinkler-kfactor"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Sprinkler K-Factor</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-sprinkler-density"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Sprinkler Density & Flow</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-hazen-williams"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Hazen-Williams</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-fm200"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>FM-200 Calculation</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-water-demand"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Water Demand Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-fixture-unit"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Fixture Unit Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-loading-unit"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Loading Unit Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-supply-pipe-sizer"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
                >
                  <span>Supply Pipe Sizer</span>
                  <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
                <Link
                  to="/plumbing-pump-sizing"
                  className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
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
    <div className="border border-border rounded bg-background p-4 flex flex-col gap-2 shadow-sm">
      <div className="flex justify-between items-center">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className="text-[22px] font-bold tracking-tight font-mono text-foreground mt-1">{value}</div>
      <span className="text-[11.5px] text-muted-foreground">{desc}</span>
      {progress !== undefined && (
        <div className="w-full h-1 bg-muted rounded-full mt-1.5 overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
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
      className="flex items-center justify-between p-2 rounded hover:bg-surface-2 transition-all border border-transparent hover:border-border text-[12.5px] text-foreground font-medium group"
    >
      <span>{label}</span>
      <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
    </Link>
  );
}

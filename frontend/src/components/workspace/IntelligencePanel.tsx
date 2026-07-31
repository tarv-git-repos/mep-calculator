import { AlertTriangle, CheckCircle2, Activity, Wind, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { workspace } from "@/lib/workspace-store";

export function IntelligencePanel() {
  const totalFresh = workspace.spaces.reduce((a, s) => a + s.freshAir, 0);
  const totalExtract = workspace.spaces.reduce((a, s) => a + s.extractAir, 0);
  const balance = totalFresh - totalExtract;
  const warnings = workspace.spaces.filter((s) => s.status === "warning").length;
  const complete = workspace.spaces.filter((s) => s.status === "complete").length;
  const completion = Math.round((complete / workspace.spaces.length) * 100);

  return (
    <div className="text-[12.5px]">
      <div className="px-3 h-11 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Activity className="size-3.5 text-primary" />
          <span className="font-semibold text-[12.5px]">Intelligence</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-success animate-pulse" />
          <span className="text-[10.5px] text-muted-foreground uppercase tracking-wide">Live</span>
        </div>
      </div>

      <Panel title="Airflow Totals">
        <Metric label="Fresh Air" value={totalFresh.toLocaleString()} unit="L/s" trend="up" delta="+2.4%" />
        <Metric label="Extract Air" value={totalExtract.toLocaleString()} unit="L/s" trend="down" delta="-0.8%" />
        <div className="mt-2 pt-2 border-t border-border flex items-center justify-between">
          <span className="text-muted-foreground text-[11.5px]">Balance</span>
          <span className={`font-mono tabular text-[12.5px] font-medium ${balance >= 0 ? "text-success" : "text-destructive"}`}>
            {balance >= 0 ? "+" : ""}{balance.toLocaleString()} L/s
          </span>
        </div>
      </Panel>

      <Panel title="Calculation Status">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="text-[20px] font-semibold tabular">{completion}%</span>
          <span className="text-[11px] text-muted-foreground">{complete} / {workspace.spaces.length} spaces</span>
        </div>
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10.5px]">
          <Pill color="success" label="Complete" value={complete} />
          <Pill color="primary" label="In progress" value={workspace.spaces.filter(s => s.status === "in-progress").length} />
          <Pill color="muted" label="Draft" value={workspace.spaces.filter(s => s.status === "draft").length} />
        </div>
      </Panel>

      <Panel title="Zone Summary">
        <Row label="Total zones" value={workspace.zones.length} />
        <Row label="Positive pressure" value={workspace.zones.filter(z => z.pressureType === "positive").length} />
        <Row label="Negative pressure" value={workspace.zones.filter(z => z.pressureType === "negative").length} />
        <Row label="Neutral" value={workspace.zones.filter(z => z.pressureType === "neutral").length} />
      </Panel>

      <Panel title="Equipment">
        <Row label="Total units" value={workspace.equipment.length} />
        <Row label="Avg utilization" value={`${Math.round(workspace.equipment.reduce((a, e) => a + e.utilization, 0) / workspace.equipment.length)}%`} />
        <Row label="Over capacity" value={workspace.equipment.filter(e => e.utilization > 92).length} tone={workspace.equipment.filter(e => e.utilization > 92).length ? "warn" : undefined} />
      </Panel>

      <Panel title={`Warnings · ${warnings}`} accent>
        <Issue tone="warn" title="Pressure imbalance" detail="Zone Z-014 exceeds ±50 L/s tolerance" />
        <Issue tone="warn" title="Under-ventilated" detail="6 spaces below ASHRAE 62.1 minimum" />
        <Issue tone="error" title="Missing equipment" detail="3 spaces have no AHU assigned" />
        <Issue tone="ok" title="Compliance" detail="Local code checks passing" />
      </Panel>
    </div>
  );
}

function Panel({ title, children, accent }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <section className="border-b border-border px-3 py-2.5">
      <h3 className={`text-[10.5px] font-semibold uppercase tracking-wider mb-2 ${accent ? "text-primary" : "text-muted-foreground"}`}>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function Metric({ label, value, unit, trend, delta }: { label: string; value: string; unit: string; trend: "up" | "down"; delta: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div className="flex items-center gap-1.5">
        <Wind className="size-3 text-muted-foreground" />
        <span className="text-[11.5px] text-muted-foreground">{label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono tabular text-[12.5px] font-medium">{value}</span>
        <span className="text-[10.5px] text-muted-foreground">{unit}</span>
        <span className={`inline-flex items-center text-[10.5px] tabular ${trend === "up" ? "text-success" : "text-muted-foreground"}`}>
          {trend === "up" ? <ArrowUpRight className="size-2.5" /> : <ArrowDownRight className="size-2.5" />}
          {delta}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "warn" }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11.5px] text-muted-foreground">{label}</span>
      <span className={`font-mono tabular text-[12px] font-medium ${tone === "warn" ? "text-warning" : ""}`}>{value}</span>
    </div>
  );
}

function Pill({ color, label, value }: { color: "success" | "primary" | "muted"; label: string; value: number }) {
  const dot = color === "success" ? "bg-success" : color === "primary" ? "bg-primary" : "bg-muted-foreground/40";
  return (
    <div className="flex flex-col items-start gap-0.5 px-1.5 py-1 bg-surface-2 rounded">
      <span className="flex items-center gap-1 text-muted-foreground">
        <span className={`size-1.5 rounded-full ${dot}`} /> {label}
      </span>
      <span className="font-mono tabular text-[11.5px] font-medium">{value}</span>
    </div>
  );
}

function Issue({ tone, title, detail }: { tone: "warn" | "error" | "ok"; title: string; detail: string }) {
  const Icon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  const color = tone === "error" ? "text-destructive" : tone === "warn" ? "text-warning" : "text-success";
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
      <Icon className={`size-3.5 mt-0.5 ${color}`} />
      <div className="min-w-0">
        <div className="text-[12px] font-medium">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-snug">{detail}</div>
      </div>
    </div>
  );
}
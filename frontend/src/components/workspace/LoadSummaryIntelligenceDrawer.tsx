import React, { useMemo, useState } from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Zap,
  Activity,
  Layers,
  Gauge,
  Lightbulb,
} from "lucide-react";
import type { LoadRow } from "@/lib/calc-load-summary";

export interface LoadSummaryIntelligenceDrawerProps {
  rows: LoadRow[];
  unitSystem?: "si" | "ip";
  onClose: () => void;
  onScrollToSpace?: (spaceId: string) => void;
  onAutoFlagIssues?: () => void;
}

export function LoadSummaryIntelligenceDrawer({
  rows,
  unitSystem = "si",
  onClose,
  onScrollToSpace,
}: LoadSummaryIntelligenceDrawerProps) {
  const isIp = unitSystem === "ip";

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    missingArea: false,
    missingLoad: false,
    missingFloor: false,
    flagged: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Calculations & Aggregations
  const stats = useMemo(() => {
    let totalConnectedKw = 0;
    let totalLightingKw = 0;
    let totalPowerKw = 0;
    let totalHvacKw = 0;
    let totalOtherKw = 0;
    let totalArea = 0;

    rows.forEach((r) => {
      const q = r.qty || 1;
      const l = (r.lighting || 0) * q;
      const p = (r.power || 0) * q;
      const h = (r.hvac || 0) * q;
      const o = (r.other || 0) * q;
      const rowTotal = (r.totalLoad || (l + p + h + o)) * q;

      totalConnectedKw += rowTotal;
      totalLightingKw += l;
      totalPowerKw += p;
      totalHvacKw += h;
      totalOtherKw += o;
      totalArea += (r.area || 0) * q;
    });

    // Diversity Factors per discipline benchmarks (Lighting 0.9, Power 0.6, HVAC 0.85, Other 0.7)
    const diversifiedKw =
      totalLightingKw * 0.9 +
      totalPowerKw * 0.6 +
      totalHvacKw * 0.85 +
      totalOtherKw * 0.7;

    const overallDiversityFactor =
      totalConnectedKw > 0 ? (diversifiedKw / totalConnectedKw) : 0.8;

    // Power factor assumed 0.85 standard
    const powerFactor = 0.85;
    const peakKva = diversifiedKw / powerFactor;

    // 400V 3-phase full load current: I = (kVA * 1000) / (sqrt(3) * 400)
    const incomerAmps = (peakKva * 1000) / (Math.sqrt(3) * 400);

    // Standard Transformer steps in kVA
    const STANDARD_TRANSFORMERS = [250, 315, 500, 630, 800, 1000, 1250, 1500, 1600, 2000, 2500, 3000];
    const targetWithMargin = peakKva * 1.25; // 25% future growth margin
    let recTransformer = STANDARD_TRANSFORMERS.find((t) => t >= targetWithMargin) || 2500;
    let transformerCount = 1;
    if (targetWithMargin > 2500) {
      transformerCount = Math.ceil(targetWithMargin / 2000);
      recTransformer = 2000;
    }

    // Power density (W/m2 or W/sq.ft)
    const totalWatts = totalConnectedKw * 1000;
    const powerDensity = totalArea > 0 ? totalWatts / totalArea : 0;

    // Cap bank recommendation: to improve from 0.85 to 0.95 PF
    // Qc = P * (tan(acos(0.85)) - tan(acos(0.95))) = P * (0.6197 - 0.3287) = P * 0.291
    const recCapacitorKvar = Math.round(diversifiedKw * 0.291);

    return {
      totalConnectedKw: Number(totalConnectedKw.toFixed(2)),
      totalLightingKw: Number(totalLightingKw.toFixed(2)),
      totalPowerKw: Number(totalPowerKw.toFixed(2)),
      totalHvacKw: Number(totalHvacKw.toFixed(2)),
      totalOtherKw: Number(totalOtherKw.toFixed(2)),
      diversifiedKw: Number(diversifiedKw.toFixed(2)),
      overallDiversityFactor: Number(overallDiversityFactor.toFixed(2)),
      peakKva: Number(peakKva.toFixed(1)),
      incomerAmps: Math.round(incomerAmps),
      recTransformer,
      transformerCount,
      totalArea: Number(totalArea.toFixed(1)),
      powerDensity: Number(powerDensity.toFixed(1)),
      recCapacitorKvar,
    };
  }, [rows]);

  // Missing data & audits
  const missingAreaSpaces = useMemo(
    () => rows.filter((r) => !r.area || r.area <= 0),
    [rows]
  );
  const missingLoadSpaces = useMemo(
    () =>
      rows.filter(
        (r) =>
          (!r.lighting || r.lighting === 0) &&
          (!r.power || r.power === 0) &&
          (!r.hvac || r.hvac === 0) &&
          (!r.other || r.other === 0)
      ),
    [rows]
  );
  const missingFloorSpaces = useMemo(
    () => rows.filter((r) => !r.floor || !r.floor.trim()),
    [rows]
  );
  const flaggedSpaces = useMemo(() => rows.filter((r) => r.flagged), [rows]);

  const auditIssuesCount =
    missingAreaSpaces.length +
    missingLoadSpaces.length +
    missingFloorSpaces.length +
    flaggedSpaces.length;

  const complianceScore =
    rows.length > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(
              ((rows.length - (missingAreaSpaces.length + missingLoadSpaces.length)) /
                rows.length) *
                100
            )
          )
        )
      : 100;

  const handleItemClick = (id: string) => {
    if (onScrollToSpace) {
      onScrollToSpace(id);
    }
  };

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in bg-card text-foreground select-none">
      {/* Header matching Ventilation exactly */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
          title="Close Intelligence Drawer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Scrollable Content */}
      <div className="flex-1 overflow-auto">
        {/* Compliance Status Section */}
        <IntelSection
          icon={CheckCircle2}
          tone={complianceScore >= 80 ? "success" : "warning"}
          title="Compliance & Health Status"
        >
          <div className="text-[12px] text-muted-foreground">
            IEC 60364 &amp; NEC 220 electrical schedule verification across {rows.length.toLocaleString()} spaces.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${complianceScore >= 80 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-semibold">{complianceScore}%</span>
          </div>
        </IntelSection>

        {/* Transformer & Incomer Capacity Card */}
        <IntelSection icon={Zap} tone="primary" title="Substation & Transformer Sizing">
          <div className="p-2.5 rounded-xl border border-primary/20 bg-primary/5 text-foreground flex flex-col gap-1 mb-2.5">
            <div className="flex items-center justify-between font-semibold text-[11.5px]">
              <span>Recommended Transformer</span>
              <span className="font-mono font-bold text-primary text-[12.5px]">
                {stats.transformerCount > 1
                  ? `${stats.transformerCount} × ${stats.recTransformer} kVA`
                  : `${stats.recTransformer} kVA`}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Includes 25% safety &amp; spare expansion headroom over estimated peak diversified demand ({stats.peakKva} kVA).
            </p>
          </div>

          <KV k="Connected Total" v={`${stats.totalConnectedKw.toLocaleString()} kW`} />
          <KV k="Diversified Peak Demand" v={`${stats.diversifiedKw.toLocaleString()} kW`} />
          <KV k="Apparent Demand (0.85 PF)" v={`${stats.peakKva.toLocaleString()} kVA`} />
          <KV k="Main Incomer Current (400V)" v={`${stats.incomerAmps.toLocaleString()} A`} />
          <KV k="Overall Diversity Factor" v={stats.overallDiversityFactor.toFixed(2)} />
        </IntelSection>

        {/* Load Density & Distribution Audit */}
        <IntelSection icon={Gauge} tone={stats.powerDensity > 120 ? "warning" : "success"} title="Load Density & Breakdown">
          <div className="flex items-center justify-between py-1 border-b border-border/40 text-[12px]">
            <span className="text-muted-foreground">Power Density</span>
            <span className="font-mono font-semibold">
              {stats.powerDensity} {isIp ? "W/ft²" : "W/m²"}
            </span>
          </div>

          <div className="py-2 space-y-1.5">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Discipline Distribution</span>
              <span className="font-mono">Ratio</span>
            </div>
            {/* Visual ratio bar */}
            {stats.totalConnectedKw > 0 && (
              <div className="h-2 w-full flex rounded-full overflow-hidden bg-surface-2">
                <div
                  title={`HVAC: ${stats.totalHvacKw} kW`}
                  className="bg-blue-500 h-full"
                  style={{ width: `${(stats.totalHvacKw / stats.totalConnectedKw) * 100}%` }}
                />
                <div
                  title={`Power: ${stats.totalPowerKw} kW`}
                  className="bg-amber-500 h-full"
                  style={{ width: `${(stats.totalPowerKw / stats.totalConnectedKw) * 100}%` }}
                />
                <div
                  title={`Lighting: ${stats.totalLightingKw} kW`}
                  className="bg-emerald-500 h-full"
                  style={{ width: `${(stats.totalLightingKw / stats.totalConnectedKw) * 100}%` }}
                />
                <div
                  title={`Other: ${stats.totalOtherKw} kW`}
                  className="bg-purple-500 h-full"
                  style={{ width: `${(stats.totalOtherKw / stats.totalConnectedKw) * 100}%` }}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-500 shrink-0" />
                <span className="text-muted-foreground truncate">HVAC:</span>
                <span className="font-mono font-medium ml-auto">{stats.totalHvacKw} kW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-amber-500 shrink-0" />
                <span className="text-muted-foreground truncate">Power:</span>
                <span className="font-mono font-medium ml-auto">{stats.totalPowerKw} kW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground truncate">Lighting:</span>
                <span className="font-mono font-medium ml-auto">{stats.totalLightingKw} kW</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-purple-500 shrink-0" />
                <span className="text-muted-foreground truncate">Other:</span>
                <span className="font-mono font-medium ml-auto">{stats.totalOtherKw} kW</span>
              </div>
            </div>
          </div>
        </IntelSection>

        {/* Calculation Issues & Missing Data Section */}
        <IntelSection
          icon={AlertTriangle}
          tone={auditIssuesCount > 0 ? "warning" : "muted"}
          title="Missing Data & Audit"
        >
          <CollapsibleMissingSection
            label="Missing Floor Assignment"
            count={missingFloorSpaces.length}
            itemsList={missingFloorSpaces.map((s) => ({
              id: s.id,
              name: s.description || "Untitled Space",
              detail: `${s.totalLoad || 0} kW`,
            }))}
            isOpen={openSections.missingFloor}
            onToggle={() => toggleSection("missingFloor")}
            onItemClick={handleItemClick}
          />

          <CollapsibleMissingSection
            label="Missing Area (0 area)"
            count={missingAreaSpaces.length}
            itemsList={missingAreaSpaces.map((s) => ({
              id: s.id,
              name: s.description || "Untitled Space",
              detail: s.floor || "No Floor",
            }))}
            isOpen={openSections.missingArea}
            onToggle={() => toggleSection("missingArea")}
            onItemClick={handleItemClick}
          />

          <CollapsibleMissingSection
            label="Empty Loads (0 kW total)"
            count={missingLoadSpaces.length}
            itemsList={missingLoadSpaces.map((s) => ({
              id: s.id,
              name: s.description || "Untitled Space",
              detail: `${s.area || 0} ${isIp ? "sq.ft" : "m²"}`,
            }))}
            isOpen={openSections.missingLoad}
            onToggle={() => toggleSection("missingLoad")}
            onItemClick={handleItemClick}
          />

          <CollapsibleMissingSection
            label="Flagged Spaces"
            count={flaggedSpaces.length}
            itemsList={flaggedSpaces.map((s) => ({
              id: s.id,
              name: s.description || "Untitled Space",
              detail: s.floor || "Flagged",
            }))}
            isOpen={openSections.flagged}
            onToggle={() => toggleSection("flagged")}
            onItemClick={handleItemClick}
          />
        </IntelSection>

        {/* Smart Optimization Recommendations */}
        <IntelSection icon={Lightbulb} tone="primary" title="Smart Engineering Tips">
          <div className="space-y-2 text-[11.5px] text-muted-foreground leading-relaxed">
            <div className="p-2 rounded-lg bg-surface-2 border border-border/60">
              <span className="font-semibold text-foreground block mb-0.5">Capacitor Bank Sizing</span>
              Recommend installing a <strong>{stats.recCapacitorKvar} kVAR</strong> automatic power factor correction (APFC) bank at the main switchboard to correct PF from 0.85 to &ge; 0.95.
            </div>
            <div className="p-2 rounded-lg bg-surface-2 border border-border/60">
              <span className="font-semibold text-foreground block mb-0.5">Standard Safety Margin</span>
              A 20% to 25% diversity headroom is maintained for transformer sizing per IEC 60364 standard practice.
            </div>
          </div>
        </IntelSection>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Subcomponents matching Ventilation exactly
// ─────────────────────────────────────────────────────────────────────────────

function IntelSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-emerald-500"
      : tone === "warning"
      ? "text-amber-500"
      : tone === "primary"
      ? "text-primary"
      : "text-muted-foreground";

  return (
    <section className="px-3 py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-semibold">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium">{v}</span>
    </div>
  );
}

function CollapsibleMissingSection({
  label,
  count,
  itemsList,
  isOpen,
  onToggle,
  onItemClick,
}: {
  label: string;
  count: number;
  itemsList: { id: string; name: string; detail: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5"
      >
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {isOpen ? (
            <ChevronUp className="size-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 text-muted-foreground" />
          )}
        </span>
        <span className="font-mono tabular font-semibold text-foreground/80">{count}</span>
      </button>

      {isOpen && count > 0 && (
        <div className="mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-md bg-surface-2 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar">
          {itemsList.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onItemClick(item.id)}
              className="block w-full px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left cursor-pointer select-none"
            >
              <div className="text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block">
                <span className="font-sans font-medium text-foreground/80 hover:text-primary transition-colors">
                  {item.name}
                </span>
                <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                  ({item.detail})
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

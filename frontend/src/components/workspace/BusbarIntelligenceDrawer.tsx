import React, { useMemo, useState } from "react";
import { 
  Sparkles, X, AlertTriangle, CheckCircle2, Zap, ArrowRight, 
  Layers, ShieldCheck, Info, ChevronRight, Activity, TrendingDown,
  Building, Gauge, Check, SlidersHorizontal, Edit3, ChevronDown, ChevronUp,
  Lightbulb
} from "lucide-react";
import { LVPanel, BusbarSection, BusbarRow } from "@/lib/calc-busbar-calculation";

const COPPER_RATINGS = [
  { id: "1000_rt", label: "1000 (Rt)", amp: 1000, r: 0.0523, x: 0.0190 },
  { id: "1250_rt", label: "1250 (Rt)", amp: 1250, r: 0.0398, x: 0.0170 },
  { id: "1600_rt", label: "1600 (Rt)", amp: 1600, r: 0.0277, x: 0.0150 },
  { id: "2000_rt", label: "2000 (Rt)", amp: 2000, r: 0.0218, x: 0.0140 },
  { id: "2500_rt", label: "2500 (Rt)", amp: 2500, r: 0.0177, x: 0.0100 },
  { id: "3200_rt", label: "3200 (Rt)", amp: 3200, r: 0.0121, x: 0.0060 },
  { id: "4000_rt", label: "4000 (Rt)", amp: 4000, r: 0.0108, x: 0.0060 },
  { id: "5000_rt", label: "5000 (Rt)", amp: 5000, r: 0.0089, x: 0.0050 },
  { id: "6300_rt", label: "6300 (Rt)", amp: 6300, r: 0.0065, x: 0.0050 },
];

export interface BusbarIntelligenceDrawerProps {
  panels: LVPanel[];
  flatCalculatedSections: Array<any>;
  selectedRowIds: Set<string>;
  onClose: () => void;
  onUpdateSectionRating: (panelId: string, sectionId: string, newRatingId: string) => void;
  onOpenEditModal?: (row: any, panelId: string, sectionId: string) => void;
}

export function BusbarIntelligenceDrawer({
  panels,
  flatCalculatedSections,
  selectedRowIds,
  onClose,
  onUpdateSectionRating,
  onOpenEditModal,
}: BusbarIntelligenceDrawerProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    zeroLength: false,
    zeroLoad: false,
    defaultRating: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Aggregate system-wide totals
  const systemMetrics = useMemo(() => {
    const totalPanels = panels.length;
    const totalSections = flatCalculatedSections.length;
    let totalTapOffs = 0;
    let totalTcl = 0;
    let totalMd = 0;
    let totalLengthM = 0;
    let maxVdPercent = 0;
    let maxVdSection: (typeof flatCalculatedSections)[0] | null = null;
    const overLimitSections: Array<{
      section: (typeof flatCalculatedSections)[0];
      cumVdPercent: number;
      recommendedRating: (typeof COPPER_RATINGS)[0] | null;
      projectedVdPercent: number;
      longRunRow: BusbarRow | null;
    }> = [];

    flatCalculatedSections.forEach((sec) => {
      totalTapOffs += sec.calcRows.length;
      if (sec.calcRows.length > 0) {
        const firstRow = sec.calcRows[0];
        totalTcl += firstRow.tcl || 0;
        totalMd += firstRow.md || 0;
      }

      let secLength = 0;
      sec.calcRows.forEach((r: any) => {
        secLength += Number(r.length) || 0;
      });
      totalLengthM += secLength;

      const lastRow = sec.calcRows[sec.calcRows.length - 1];
      const cumVd = lastRow ? lastRow.cumulativeVdPercent : (sec.totalCumulativeVd || 0);
      if (cumVd > maxVdPercent) {
        maxVdPercent = cumVd;
        maxVdSection = sec;
      }

      if (cumVd > 2.5) {
        let longestRow: BusbarRow | null = null;
        let maxRowLen = 0;
        sec.calcRows.forEach((r: any) => {
          const l = Number(r.length) || 0;
          if (l > maxRowLen) {
            maxRowLen = l;
            longestRow = r;
          }
        });

        const curRatingIdx = COPPER_RATINGS.findIndex((cr) => cr.id === sec.ratingId);
        const curR = COPPER_RATINGS[curRatingIdx]?.r || 0.0277;
        const curX = COPPER_RATINGS[curRatingIdx]?.x || 0.0150;

        let bestRating: (typeof COPPER_RATINGS)[0] | null = null;
        let projected = cumVd;

        for (let i = curRatingIdx + 1; i < COPPER_RATINGS.length; i++) {
          const cand = COPPER_RATINGS[i];
          const phi = Math.acos(Math.min(1, Math.max(-1, sec.pf || 0.8)));
          const sinPhi = Math.sin(phi);
          const curZ = curR * (sec.pf || 0.8) + curX * sinPhi;
          const candZ = cand.r * (sec.pf || 0.8) + cand.x * sinPhi;
          const ratio = curZ > 0 ? candZ / curZ : 1;
          const candDrop = cumVd * ratio;

          if (candDrop <= 2.5) {
            bestRating = cand;
            projected = candDrop;
            break;
          }
        }

        if (!bestRating && curRatingIdx < COPPER_RATINGS.length - 1) {
          bestRating = COPPER_RATINGS[COPPER_RATINGS.length - 1];
          const phi = Math.acos(Math.min(1, Math.max(-1, sec.pf || 0.8)));
          const sinPhi = Math.sin(phi);
          const curZ = curR * (sec.pf || 0.8) + curX * sinPhi;
          const candZ = bestRating.r * (sec.pf || 0.8) + bestRating.x * sinPhi;
          projected = cumVd * (candZ / curZ);
        }

        overLimitSections.push({
          section: sec,
          cumVdPercent: cumVd,
          recommendedRating: bestRating,
          projectedVdPercent: Number(projected.toFixed(3)),
          longRunRow: longestRow,
        });
      }
    });

    const compliantSections = flatCalculatedSections.filter(s => {
      const lastRow = s.calcRows[s.calcRows.length - 1];
      const cumVd = lastRow ? lastRow.cumulativeVdPercent : (s.totalCumulativeVd || 0);
      return cumVd <= 2.5;
    });

    const complianceScore = totalSections > 0 ? Math.round((compliantSections.length / totalSections) * 100) : 100;

    return {
      totalPanels,
      totalSections,
      totalTapOffs,
      totalTcl: Number(totalTcl.toFixed(2)),
      totalMd: Number(totalMd.toFixed(2)),
      totalLengthM: Number(totalLengthM.toFixed(1)),
      maxVdPercent: Number(maxVdPercent.toFixed(3)),
      maxVdSection,
      overLimitSections,
      compliantSections,
      complianceScore,
    };
  }, [panels, flatCalculatedSections]);

  // Missing data audits
  const zeroLengthItems = useMemo(() => {
    const list: { id: string; name: string; detail: string }[] = [];
    flatCalculatedSections.forEach(sec => {
      sec.calcRows.forEach((r: any) => {
        if (!r.length || Number(r.length) === 0) {
          list.push({
            id: r.id,
            name: r.desc || "Tap Off",
            detail: `${sec.panelName || "Panel"} · ${sec.name}`,
          });
        }
      });
    });
    return list;
  }, [flatCalculatedSections]);

  const zeroLoadItems = useMemo(() => {
    const list: { id: string; name: string; detail: string }[] = [];
    flatCalculatedSections.forEach(sec => {
      if (sec.calcRows.length === 0 || ((sec.calcRows[0]?.tcl || 0) === 0 && (sec.calcRows[0]?.md || 0) === 0)) {
        list.push({
          id: sec.id,
          name: sec.name || "Section",
          detail: `${sec.panelName || "Panel"} · 0 kW`,
        });
      }
    });
    return list;
  }, [flatCalculatedSections]);

  const defaultRatingItems = useMemo(() => {
    const list: { id: string; name: string; detail: string }[] = [];
    flatCalculatedSections.forEach(sec => {
      if (!sec.ratingId || sec.ratingId === "1000_rt") {
        list.push({
          id: sec.id,
          name: sec.name || "Section",
          detail: `${sec.panelName || "Panel"} · 1000A Default`,
        });
      }
    });
    return list;
  }, [flatCalculatedSections]);

  // Find currently selected row details
  const selectedRowInfo = useMemo(() => {
    if (selectedRowIds.size === 0) return null;
    const targetId = Array.from(selectedRowIds)[0];

    for (const sec of flatCalculatedSections) {
      const foundIdx = sec.calcRows.findIndex((r: any) => r.id === targetId);
      if (foundIdx !== -1) {
        return {
          row: sec.calcRows[foundIdx],
          section: sec,
          index: foundIdx + 1,
          totalInSec: sec.calcRows.length,
        };
      }
    }
    return null;
  }, [selectedRowIds, flatCalculatedSections]);

  const handleItemClick = (id: string) => {
    const el = document.getElementById(`row-${id}`) || document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  };

  return (
    <div className="flex flex-col h-full bg-card select-none text-foreground animate-fade-in w-[360px]">
      {/* Header exactly matching Ventilation */}
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

      {/* Drawer Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Section 1: Compliance Status */}
        <IntelSection
          icon={CheckCircle2}
          tone={systemMetrics.complianceScore >= 100 ? "success" : "warning"}
          title="Compliance Status"
        >
          <div className="text-[12px] text-muted-foreground">
            IEC 61439-6 &amp; BS 7671 voltage drop validation across {systemMetrics.totalSections} sections.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full ${systemMetrics.complianceScore >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                style={{ width: `${systemMetrics.complianceScore}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-semibold">{systemMetrics.complianceScore}%</span>
          </div>
          <div className="text-[11.5px] text-muted-foreground border-t border-border/50 pt-2 mt-2 flex justify-between">
            <span>Sections Compliant (&le; 2.50%):</span>
            <span className="font-mono font-bold text-foreground">
              {systemMetrics.compliantSections.length}/{systemMetrics.totalSections}
            </span>
          </div>
        </IntelSection>

        {/* Section 2: System Electrical Overview */}
        <IntelSection icon={Zap} tone="primary" title="System Electrical Overview">
          <KV k="Total Connected (TCL)" v={`${systemMetrics.totalTcl.toLocaleString()} kW`} />
          <KV k="Maximum Demand (MD)" v={`${systemMetrics.totalMd.toLocaleString()} kW`} />
          <KV k="Total Riser Run" v={`${systemMetrics.totalLengthM.toLocaleString()} m`} />
          <KV k="Distribution Tap-Offs" v={`${systemMetrics.totalTapOffs} nodes (${systemMetrics.totalPanels} panels)`} />
          <KV 
            k="Max Voltage Drop" 
            v={
              <span className={systemMetrics.maxVdPercent > 2.5 ? "text-destructive font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                {systemMetrics.maxVdPercent}%
              </span>
            } 
          />
        </IntelSection>

        {/* Section 3: Critical Voltage Drop Issues */}
        <IntelSection 
          icon={AlertTriangle} 
          tone={systemMetrics.overLimitSections.length > 0 ? "warning" : "muted"} 
          title="Voltage Drop Limit Warnings"
        >
          {systemMetrics.overLimitSections.length > 0 ? (
            <div className="space-y-2.5">
              <div className="text-[12px] text-amber-600 dark:text-amber-400 font-medium">
                {systemMetrics.overLimitSections.length} riser section(s) exceed standard allowable voltage drop (&gt; 2.50%).
              </div>

              {systemMetrics.overLimitSections.map((item, i) => (
                <div
                  key={i}
                  className="p-2.5 bg-surface-2 border border-red-500/25 rounded-xl space-y-2"
                >
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="font-bold text-foreground truncate max-w-[200px]">
                      {item.section.panelName} &rarr; {item.section.name}
                    </span>
                    <span className="font-mono font-bold text-destructive">
                      {item.cumVdPercent}%
                    </span>
                  </div>

                  {item.longRunRow && (
                    <p className="text-[10.5px] text-muted-foreground leading-snug">
                      Root cause: Long run of <strong className="text-foreground">{item.longRunRow.length}m</strong> on <em>"{item.longRunRow.desc}"</em> carries heavy riser current.
                    </p>
                  )}

                  {item.recommendedRating && (
                    <div className="pt-2 border-t border-border/60 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-[10.5px]">
                        <span className="text-muted-foreground">Recommended Sizing:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          {item.recommendedRating.label} (~{item.projectedVdPercent}%)
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onUpdateSectionRating(
                            item.section.panelId,
                            item.section.id,
                            item.recommendedRating!.id
                          )
                        }
                        className="w-full py-1.5 px-3 bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-[11px] rounded-lg shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-0.5"
                      >
                        <Zap className="size-3.5 fill-current" />
                        Auto-Upsize to {item.recommendedRating.label}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 py-1">
              <Check className="size-3.5" /> All busbar sections compliant with &le; 2.50% drop limit.
            </div>
          )}
        </IntelSection>

        {/* Section 4: Missing Data & Audit */}
        <IntelSection
          icon={Info}
          tone={(zeroLengthItems.length + zeroLoadItems.length + defaultRatingItems.length) > 0 ? "warning" : "muted"}
          title="Missing Data & Audit"
        >
          <CollapsibleMissingSection
            label="Tap-Offs with 0m Length"
            count={zeroLengthItems.length}
            itemsList={zeroLengthItems}
            isOpen={openSections.zeroLength}
            onToggle={() => toggleSection("zeroLength")}
            onItemClick={handleItemClick}
          />
          <CollapsibleMissingSection
            label="Sections with 0 kW Load"
            count={zeroLoadItems.length}
            itemsList={zeroLoadItems}
            isOpen={openSections.zeroLoad}
            onToggle={() => toggleSection("zeroLoad")}
            onItemClick={handleItemClick}
          />
          <CollapsibleMissingSection
            label="Sections on 1000A Default Rating"
            count={defaultRatingItems.length}
            itemsList={defaultRatingItems}
            isOpen={openSections.defaultRating}
            onToggle={() => toggleSection("defaultRating")}
            onItemClick={handleItemClick}
          />
        </IntelSection>

        {/* Section 5: Selected Tap-Off Node Inspector */}
        <IntelSection icon={Activity} tone="primary" title="Tap-Off Node Inspector">
          {selectedRowInfo ? (
            <div className="p-2.5 bg-surface-2 border border-border/80 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-foreground text-xs block">
                    {selectedRowInfo.row.desc || "Tap Off"}
                  </span>
                  <span className="text-[10.5px] text-muted-foreground font-mono">
                    {selectedRowInfo.section.name} &bull; Tap-Off #{selectedRowInfo.index} of {selectedRowInfo.totalInSec}
                  </span>
                </div>
                {onOpenEditModal && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenEditModal(
                        selectedRowInfo.row,
                        selectedRowInfo.section.panelId,
                        selectedRowInfo.section.id
                      )
                    }
                    className="p-1 px-2 text-[11px] text-primary hover:bg-primary/10 rounded-lg flex items-center gap-1 cursor-pointer font-semibold border border-primary/20"
                    title="Open Full Parameter Modal"
                  >
                    <Edit3 className="size-3" /> Edit
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div className="p-1.5 bg-card rounded border border-border/50">
                  <span className="text-[10px] text-muted-foreground block">Length</span>
                  <span className="font-mono font-bold text-foreground">{selectedRowInfo.row.length} m</span>
                </div>
                <div className="p-1.5 bg-card rounded border border-border/50">
                  <span className="text-[10px] text-muted-foreground block">Floor Load</span>
                  <span className="font-mono font-bold text-foreground">{selectedRowInfo.row.loadKw} kW</span>
                </div>
                <div className="p-1.5 bg-card rounded border border-border/50">
                  <span className="text-[10px] text-muted-foreground block">Line Current</span>
                  <span className="font-mono font-bold text-primary">
                    {selectedRowInfo.row.current.toFixed(1)} A
                  </span>
                </div>
                <div className="p-1.5 bg-card rounded border border-border/50">
                  <span className="text-[10px] text-muted-foreground block">Voltage Drop</span>
                  <span
                    className={`font-mono font-bold ${
                      selectedRowInfo.row.vdPercent > 2.5
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {selectedRowInfo.row.vd.toFixed(2)} V ({selectedRowInfo.row.vdPercent.toFixed(3)}%)
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-surface-2/60 border border-dashed border-border rounded-xl text-center text-muted-foreground">
              <p className="text-[11px] leading-relaxed">
                Click any tap-off row in the schedule to inspect live current, phase reactance, and cumulative volt drop.
              </p>
            </div>
          )}
        </IntelSection>

        {/* Section 6: Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>For horizontal feeders exceeding 100m, upsize conductor rating by 1 step to curtail cumulative drop.</li>
            <li>Maintain balanced phase loading across 3 phases on multi-story risers.</li>
            <li>Consider sandwich copper construction for high ampacity (&ge;2000A) to reduce skin-effect reactance.</li>
          </ul>
        </IntelSection>

        {/* Section 7: Engineering Notes */}
        <IntelSection icon={Info} tone="muted" title="Engineering Standards Notes">
          <div className="text-[11.5px] text-muted-foreground space-y-1">
            <p><strong>IEC 61439-6:</strong> Low-voltage switchgear and controlgear assemblies &mdash; Busbar trunking systems.</p>
            <p><strong>BS 7671 (18th Edition):</strong> Recommends maximum 2.5% drop on sub-main distribution busducts.</p>
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
              type="button"
              key={item.id}
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
